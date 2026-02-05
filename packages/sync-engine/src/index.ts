import { VagrantClient, VMCredentials } from '@virtualbox-mcp/vagrant-client';
import { logger } from '@virtualbox-mcp/shared-utils';
import * as chokidar from 'chokidar';
import { execa } from 'execa';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

export type SyncDirection = 'bidirectional' | 'to_vm' | 'from_vm';
export type SyncStatus = 'idle' | 'syncing' | 'error';
export type ConflictResolution = 'use_host' | 'use_vm';

interface SyncConfig {
    vmName: string;
    hostPath: string;
    guestPath: string;
    direction: SyncDirection;
    excludePatterns?: string[];
    credentials?: VMCredentials;
}

interface SyncState {
    status: SyncStatus;
    lastSyncTime?: Date;
    conflicts: string[]; // Paths with conflicts
}

export class SyncManager {
    private watchers: Map<string, chokidar.FSWatcher> = new Map();
    private configs: Map<string, SyncConfig> = new Map();
    private states: Map<string, SyncState> = new Map();
    private fileHashes: Map<string, string> = new Map(); // Cache for file hashes

    constructor(private vagrant: VagrantClient) { }

    async configureSync(config: SyncConfig): Promise<void> {
        this.configs.set(config.vmName, config);
        this.states.set(config.vmName, { status: 'idle', conflicts: [] });

        // Stop existing watcher if any
        if (this.watchers.has(config.vmName)) {
            await this.watchers.get(config.vmName)?.close();
            this.watchers.delete(config.vmName);
        }

        if (config.direction !== 'from_vm') {
            await this.startHostWatcher(config);
        }
    }

    private async startHostWatcher(config: SyncConfig) {
        logger.info(`Starting host watcher for ${config.vmName} on ${config.hostPath}`);

        const watcher = chokidar.watch(config.hostPath, {
            ignored: (path, stats) => {
                if (!config.excludePatterns) return false;
                return config.excludePatterns.some(pattern => path.includes(pattern));
            },
            persistent: true,
            ignoreInitial: true,
            awaitWriteFinish: {
                stabilityThreshold: 500,
                pollInterval: 100
            }
        });

        watcher.on('all', async (event, filePath) => {
            logger.debug(`File event ${event}: ${filePath}`);
            await this.syncToVM(config.vmName, filePath);
        });

        this.watchers.set(config.vmName, watcher);
    }

    private async computeHash(filePath: string): Promise<string | null> {
        try {
            const content = await fs.promises.readFile(filePath);
            return crypto.createHash('md5').update(content).digest('hex');
        } catch (error) {
            return null; // File might be deleted or inaccessible
        }
    }

    async syncToVM(vmName: string, changedFile: string): Promise<void> {
        const config = this.configs.get(vmName);
        if (!config) return;

        // Skip if file is deleted (handling deletions is complex in this simple sync)
        if (!fs.existsSync(changedFile)) return;

        // Compute hash to avoid redundant transfers
        const newHash = await this.computeHash(changedFile);
        if (newHash && this.fileHashes.get(changedFile) === newHash) {
            logger.debug(`Skipping sync for ${changedFile} (content unchanged)`);
            return;
        }

        const state = this.states.get(vmName)!;
        state.status = 'syncing';

        try {
            const relPath = path.relative(config.hostPath, changedFile);
            const destPath = path.join(config.guestPath, relPath).replace(/\\/g, '/'); // Ensure posix paths for VM

            logger.info(`Syncing ${relPath} to VM ${vmName}`);

            // Update hash cache BEFORE upload (optimistic) or AFTER? 
            // Better updating it after success, but to prevent rapid-fire triggers, maybe before?
            // Let's do after to ensure integrity.

            await this.vagrant.uploadFile(vmName, changedFile, destPath, config.credentials);

            if (newHash) this.fileHashes.set(changedFile, newHash);

            state.lastSyncTime = new Date();
            state.status = 'idle';
        } catch (error) {
            logger.error(`Sync failed for ${vmName}`, error);
            state.status = 'error';
        }
    }

    async getSyncStatus(vmName: string): Promise<SyncState | undefined> {
        return this.states.get(vmName);
    }

    async resolveConflict(vmName: string, filePath: string, resolution: ConflictResolution): Promise<void> {
        const config = this.configs.get(vmName);
        if (!config) throw new Error(`No sync config for VM ${vmName}`);

        if (resolution === 'use_host') {
            await this.syncToVM(vmName, path.join(config.hostPath, filePath));
        } else {
            // use_vm: Download file from VM via cat
            const result = await this.vagrant.executeCommand(vmName, `cat "${path.join(config.guestPath, filePath).replace(/\\/g, '/')}"`, config.credentials);
            if (result.exitCode === 0) {
                const hostFilePath = path.join(config.hostPath, filePath);
                fs.mkdirSync(path.dirname(hostFilePath), { recursive: true });
                fs.writeFileSync(hostFilePath, result.stdout);
                logger.info(`Downloaded ${filePath} from VM ${vmName}`);
            } else {
                throw new Error(`Failed to read file from VM: ${result.stderr}`);
            }
        }

        // Remove from conflicts list
        const state = this.states.get(vmName);
        if (state) {
            state.conflicts = state.conflicts.filter(c => c !== filePath);
        }
    }

    /**
     * Trigger a full rsync to VM (used by sync_to_vm tool)
     */
    async syncToVMFull(vmName: string): Promise<{ syncedFiles: string[]; syncTimeMs: number }> {
        const startTime = Date.now();
        const state = this.states.get(vmName);
        const config = this.configs.get(vmName);
        if (state) state.status = 'syncing';

        try {
            try {
                await this.vagrant.rsyncToVM(vmName);
            } catch (error) {
                if (config) {
                    logger.info(`Vagrant rsync failed for ${vmName}, falling back to native recursive upload...`);
                    await this.vagrant.uploadFile(vmName, config.hostPath, config.guestPath, config.credentials);
                } else {
                    throw error;
                }
            }
            const syncTimeMs = Date.now() - startTime;
            if (state) {
                state.status = 'idle';
                state.lastSyncTime = new Date();
            }
            return { syncedFiles: ['(full sync completed)'], syncTimeMs };
        } catch (error) {
            if (state) state.status = 'error';
            throw error;
        }
    }

    /**
     * Trigger a full rsync from VM (used by sync_from_vm tool)
     */
    async syncFromVMFull(vmName: string): Promise<{ syncedFiles: string[]; syncTimeMs: number }> {
        const startTime = Date.now();
        const state = this.states.get(vmName);
        const config = this.configs.get(vmName);
        if (state) state.status = 'syncing';

        try {
            try {
                await this.vagrant.rsyncFromVM(vmName);
            } catch (error) {
                if (config) {
                    logger.info(`Vagrant rsync-back failed for ${vmName}, falling back to manual download...`);
                    // Note: Manual recursive download from VM is complex with guestcontrol.
                    // For now we'll throw an informative error or implement individual file download if needed.
                    throw new Error(`Full sync from native VM is not yet supported. Use 'resolve_conflict' for specific files.`);
                } else {
                    throw error;
                }
            }
            const syncTimeMs = Date.now() - startTime;
            if (state) {
                state.status = 'idle';
                state.lastSyncTime = new Date();
            }
            return { syncedFiles: ['(full sync from VM completed)'], syncTimeMs };
        } catch (error) {
            if (state) state.status = 'error';
            throw error;
        }
    }
}

// Export BackgroundTaskManager for observability
export { BackgroundTaskManager, TaskInfo, TaskOutput, TaskStatus, TaskRegistrationResult } from './background-task-manager.js';

// Export OperationTracker for progress awareness
export { OperationTracker, ProgressInfo, OperationType, OperationStatus, StartOperationOptions, WaitOptions } from './operation-tracker.js';

// Export GuardrailsManager for safety
export { GuardrailsManager, Violation } from './guardrails-manager.js';

