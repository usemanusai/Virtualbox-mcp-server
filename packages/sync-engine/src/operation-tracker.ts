/**
 * OperationTracker - Tracks progress of long-running operations in VMs
 * 
 * This class provides real-time progress awareness for operations like downloads,
 * compilations, installations, and file extractions. It enables the AI to properly
 * wait for operations to complete rather than proceeding blindly.
 */

import { VagrantClient, VMCredentials } from '@virtualbox-mcp/vagrant-client';
import { logger } from '@virtualbox-mcp/shared-utils';
import { randomUUID } from 'crypto';

/**
 * Types of operations that can be tracked
 */
export type OperationType = 'download' | 'upload' | 'compile' | 'install' | 'extract' | 'command' | 'custom';

/**
 * Status of a tracked operation
 */
export type OperationStatus = 'pending' | 'running' | 'completed' | 'failed' | 'timeout' | 'cancelled';

/**
 * Detailed progress information for a tracked operation
 */
export interface ProgressInfo {
    /** Unique identifier for this operation */
    operationId: string;
    /** Type of operation */
    type: OperationType;
    /** Current status */
    status: OperationStatus;
    /** Name of the VM where operation is running */
    vmName: string;

    // === Progress Metrics ===
    /** Total bytes expected (if known) */
    bytesTotal?: number;
    /** Bytes completed so far */
    bytesCompleted?: number;
    /** Completion percentage (0-100) */
    percentComplete?: number;
    /** Transfer/processing speed in bytes/second */
    bytesPerSecond?: number;

    // === Time Tracking ===
    /** When the operation started */
    startedAt: Date;
    /** When the operation completed (if finished) */
    completedAt?: Date;
    /** Estimated time remaining in seconds */
    estimatedTimeRemaining?: number;
    /** Last time progress was updated */
    lastUpdatedAt: Date;
    /** Duration in seconds */
    durationSeconds?: number;

    // === Command Info ===
    /** The command or URL being executed */
    command: string;
    /** Process ID in the VM (if applicable) */
    pid?: number;
    /** Path to log file in the VM */
    logFile?: string;
    /** Path to the output file (for downloads) */
    outputPath?: string;

    // === Completion Info ===
    /** Exit code (if completed) */
    exitCode?: number;
    /** Error message (if failed) */
    errorMessage?: string;
    /** Human-readable status message */
    statusMessage: string;
}

/**
 * Options for starting a tracked operation
 */
export interface StartOperationOptions {
    /** VM name */
    vmName: string;
    /** Type of operation */
    type: OperationType;
    /** Command to execute */
    command: string;
    /** Working directory */
    workingDir?: string;
    /** Expected total bytes (for downloads) */
    expectedBytes?: number;
    /** Path where output will be written */
    outputPath?: string;
    /** Custom log file path */
    logFile?: string;
    /** Description for status messages */
    description?: string;
}

/**
 * Options for waiting on an operation
 */
export interface WaitOptions {
    /** Maximum time to wait in seconds (default: 600 = 10 minutes) */
    timeoutSeconds?: number;
    /** Interval between progress checks in milliseconds (default: 2000) */
    pollIntervalMs?: number;
    /** Callback for progress updates */
    onProgress?: (progress: ProgressInfo) => void;
}

/**
 * Default polling interval for progress checks
 */
const DEFAULT_POLL_INTERVAL_MS = 2000;

/**
 * Default timeout for wait operations
 */
const DEFAULT_TIMEOUT_SECONDS = 600;

/**
 * Manages tracking and monitoring of long-running operations
 */
export class OperationTracker {
    /** Registry of all tracked operations, keyed by operationId */
    private operations: Map<string, ProgressInfo> = new Map();

    /** Index of operations by VM name */
    private operationsByVM: Map<string, Set<string>> = new Map();

    /** Reference to VagrantClient for VM operations */
    private vagrant: VagrantClient;

    /**
     * Creates a new OperationTracker
     * @param vagrant - VagrantClient instance for VM operations
     */
    constructor(vagrant: VagrantClient) {
        this.vagrant = vagrant;
        logger.info('OperationTracker initialized');
    }

    /**
     * Alias for startOperation with type 'download'.
     * Needed for index.ts compatibility.
     */
    async startDownload(vmName: string, url: string, destination: string, credentials: VMCredentials = {}): Promise<{ operationId: string; progress: ProgressInfo }> {
        return this.startOperation({
            vmName,
            type: 'download',
            command: `wget -q "${url}" -O "${destination}"`, // Simple wget, can be upgraded
            outputPath: destination,
            expectedBytes: 0, // Unknown initially
            description: `Downloading ${url} to ${destination}`
        });
    }

    /**
     * Alias for getProgress.
     * Needed for index.ts compatibility.
     */
    getOperationProgress(operationId: string): ProgressInfo | undefined {
        return this.getProgress(operationId);
    }

    /**
     * Alias for waitForCompletion.
     * Needed for index.ts compatibility.
     */
    async waitForOperation(operationId: string, options: { timeoutMs?: number } = {}): Promise<ProgressInfo> {
        return this.waitForCompletion(operationId, { timeoutSeconds: options.timeoutMs ? options.timeoutMs / 1000 : undefined });
    }

    /**
     * Alias for getActiveOperations.
     * Needed for index.ts compatibility.
     */
    listActiveOperations(vmName?: string): ProgressInfo[] {
        return this.getActiveOperations(vmName);
    }

    /**
     * Registers and starts a new tracked operation
     * 
     * @param options - Options for the operation
     * @returns The operation ID and initial progress info
     */
    async startOperation(options: StartOperationOptions): Promise<{ operationId: string; progress: ProgressInfo }> {
        const operationId = randomUUID();
        const now = new Date();
        const logFile = options.logFile || `/tmp/mcp_op_${operationId}.log`;
        const stderrFile = `/tmp/mcp_op_${operationId}.err`;

        // Build the wrapped command that writes to log file and captures PID
        const wrappedCommand = this.buildTrackedCommand(options.command, logFile, stderrFile, options.workingDir);

        // Execute the command and capture PID
        const result = await this.vagrant.executeCommand(options.vmName, wrappedCommand);

        // Parse PID from output
        const pidMatch = result.stdout.match(/PID:(\d+)/);
        const pid = pidMatch ? parseInt(pidMatch[1], 10) : undefined;

        if (!pid) {
            throw new Error(`Failed to start operation: could not capture PID. Output: ${result.stdout}`);
        }

        // Create progress info
        const progress: ProgressInfo = {
            operationId,
            type: options.type,
            status: 'running',
            vmName: options.vmName,
            bytesTotal: options.expectedBytes,
            bytesCompleted: 0,
            percentComplete: 0,
            startedAt: now,
            lastUpdatedAt: now,
            command: options.command,
            pid,
            logFile,
            outputPath: options.outputPath,
            statusMessage: options.description || `Started ${options.type} operation`
        };

        // Register the operation
        this.operations.set(operationId, progress);

        // Add to VM index
        if (!this.operationsByVM.has(options.vmName)) {
            this.operationsByVM.set(options.vmName, new Set());
        }
        this.operationsByVM.get(options.vmName)!.add(operationId);

        logger.info(`Started tracked operation ${operationId} (PID: ${pid}) on VM ${options.vmName}`);

        return { operationId, progress };
    }

    /**
     * Builds a command that runs in background and can be tracked
     */
    private buildTrackedCommand(command: string, logFile: string, stderrFile: string, workingDir?: string): string {
        const cdPrefix = workingDir ? `cd "${workingDir}" && ` : '';
        // Start in background, capture PID, write to log files
        // Using sh -c to ensure proper background handling
        return `${cdPrefix}nohup sh -c '${command.replace(/'/g, "'\\''")}' > "${logFile}" 2> "${stderrFile}" & echo "PID:$!"`;
    }

    /**
     * Updates progress for an operation by checking VM state
     * 
     * @param operationId - The operation to update
     * @returns Updated progress info
     */
    async updateProgress(operationId: string): Promise<ProgressInfo> {
        const progress = this.operations.get(operationId);
        if (!progress) {
            throw new Error(`Operation ${operationId} not found`);
        }

        // Don't update if already in terminal state
        if (['completed', 'failed', 'timeout', 'cancelled'].includes(progress.status)) {
            return progress;
        }

        const now = new Date();
        const durationSeconds = (now.getTime() - progress.startedAt.getTime()) / 1000;

        try {
            // Check if process is still running
            const isRunning = await this.checkProcessRunning(progress.vmName, progress.pid!);

            if (isRunning) {
                // Update progress based on operation type
                await this.updateProgressMetrics(progress);
                progress.status = 'running';
            } else {
                // Process has stopped - check exit status
                const exitInfo = await this.getProcessExitInfo(progress.vmName, progress.pid!, progress.logFile!);

                if (exitInfo.exitCode === 0) {
                    progress.status = 'completed';
                    progress.exitCode = 0;
                    progress.percentComplete = 100;
                    progress.statusMessage = 'Operation completed successfully';
                } else {
                    progress.status = 'failed';
                    progress.exitCode = exitInfo.exitCode;
                    progress.errorMessage = exitInfo.stderr;
                    progress.statusMessage = `Operation failed with exit code ${exitInfo.exitCode}`;
                }
                progress.completedAt = now;
            }

            progress.lastUpdatedAt = now;
            progress.durationSeconds = durationSeconds;
            this.operations.set(operationId, progress);

        } catch (error: any) {
            logger.error(`Failed to update progress for ${operationId}`, error);
            progress.lastUpdatedAt = now;
            progress.durationSeconds = durationSeconds;
        }

        return progress;
    }

    /**
     * Updates progress metrics based on operation type
     */
    private async updateProgressMetrics(progress: ProgressInfo): Promise<void> {
        switch (progress.type) {
            case 'download':
                await this.updateDownloadProgress(progress);
                break;
            case 'extract':
                await this.updateExtractProgress(progress);
                break;
            default:
                await this.updateGenericProgress(progress);
        }
    }

    /**
     * Updates download-specific progress (file size)
     */
    private async updateDownloadProgress(progress: ProgressInfo): Promise<void> {
        if (!progress.outputPath) return;

        try {
            // Get current file size
            const sizeResult = await this.vagrant.executeCommand(
                progress.vmName,
                `stat -c %s "${progress.outputPath}" 2>/dev/null || echo "0"`
            );
            const currentSize = parseInt(sizeResult.stdout.trim(), 10) || 0;

            const previousSize = progress.bytesCompleted || 0;
            const timeDelta = (new Date().getTime() - progress.lastUpdatedAt.getTime()) / 1000;

            progress.bytesCompleted = currentSize;

            // Calculate speed
            if (timeDelta > 0) {
                progress.bytesPerSecond = Math.round((currentSize - previousSize) / timeDelta);
            }

            // Calculate percentage if total is known
            if (progress.bytesTotal && progress.bytesTotal > 0) {
                progress.percentComplete = Math.round((currentSize / progress.bytesTotal) * 100);

                // Calculate ETA
                if (progress.bytesPerSecond && progress.bytesPerSecond > 0) {
                    const remaining = progress.bytesTotal - currentSize;
                    progress.estimatedTimeRemaining = Math.round(remaining / progress.bytesPerSecond);
                }
            }

            progress.statusMessage = this.formatDownloadStatus(progress);
        } catch (error) {
            // Ignore errors during progress update
        }
    }

    /**
     * Updates extract-specific progress (file count)
     */
    private async updateExtractProgress(progress: ProgressInfo): Promise<void> {
        if (!progress.outputPath) return;

        try {
            // Count extracted files
            const countResult = await this.vagrant.executeCommand(
                progress.vmName,
                `find "${progress.outputPath}" -type f 2>/dev/null | wc -l`
            );
            const fileCount = parseInt(countResult.stdout.trim(), 10) || 0;
            progress.statusMessage = `Extracting... ${fileCount} files extracted`;
        } catch (error) {
            // Ignore errors
        }
    }

    /**
     * Updates generic command progress (log file size)
     */
    private async updateGenericProgress(progress: ProgressInfo): Promise<void> {
        if (!progress.logFile) return;

        try {
            // Get log file line count as progress indicator
            const lineResult = await this.vagrant.executeCommand(
                progress.vmName,
                `wc -l "${progress.logFile}" 2>/dev/null | awk '{print $1}'`
            );
            const lineCount = parseInt(lineResult.stdout.trim(), 10) || 0;
            progress.statusMessage = `Running... ${lineCount} log lines`;
        } catch (error) {
            // Ignore errors
        }
    }

    /**
     * Formats download status message
     */
    private formatDownloadStatus(progress: ProgressInfo): string {
        const completed = this.formatBytes(progress.bytesCompleted || 0);
        const total = progress.bytesTotal ? this.formatBytes(progress.bytesTotal) : 'unknown';
        const speed = progress.bytesPerSecond ? `${this.formatBytes(progress.bytesPerSecond)}/s` : '';
        const eta = progress.estimatedTimeRemaining ? `ETA: ${this.formatDuration(progress.estimatedTimeRemaining)}` : '';

        return `Downloading: ${completed} / ${total} (${progress.percentComplete || 0}%) ${speed} ${eta}`.trim();
    }

    /**
     * Formats bytes to human-readable string
     */
    private formatBytes(bytes: number): string {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Formats duration in seconds to human-readable string
     */
    private formatDuration(seconds: number): string {
        if (seconds < 60) return `${seconds}s`;
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        return `${hours}h ${mins}m`;
    }

    /**
     * Checks if a process is still running in the VM
     */
    private async checkProcessRunning(vmName: string, pid: number): Promise<boolean> {
        try {
            const result = await this.vagrant.executeCommand(
                vmName,
                `kill -0 ${pid} 2>/dev/null && echo "RUNNING" || echo "STOPPED"`
            );
            return result.stdout.trim() === 'RUNNING';
        } catch {
            return false;
        }
    }

    /**
     * Gets exit information for a completed process
     */
    private async getProcessExitInfo(vmName: string, pid: number, logFile: string): Promise<{
        exitCode: number;
        stdout: string;
        stderr: string;
    }> {
        try {
            // Try to get exit code (may not always be available)
            const stderrFile = logFile.replace('.log', '.err');

            const [stdoutResult, stderrResult] = await Promise.all([
                this.vagrant.executeCommand(vmName, `tail -100 "${logFile}" 2>/dev/null || echo ""`),
                this.vagrant.executeCommand(vmName, `tail -50 "${stderrFile}" 2>/dev/null || echo ""`)
            ]);

            // Check stderr for error indicators
            const hasError = stderrResult.stdout.toLowerCase().includes('error') ||
                stderrResult.stdout.toLowerCase().includes('failed') ||
                stderrResult.stdout.toLowerCase().includes('fatal');

            return {
                exitCode: hasError ? 1 : 0,
                stdout: stdoutResult.stdout,
                stderr: stderrResult.stdout
            };
        } catch {
            return { exitCode: -1, stdout: '', stderr: 'Failed to get exit info' };
        }
    }

    /**
     * Gets current progress for an operation
     * 
     * @param operationId - The operation ID
     * @returns Current progress info
     */
    getProgress(operationId: string): ProgressInfo | undefined {
        return this.operations.get(operationId);
    }

    /**
     * Waits for an operation to complete with progress updates
     * 
     * @param operationId - The operation to wait for
     * @param options - Wait options (timeout, poll interval, callbacks)
     * @returns Final progress info
     */
    async waitForCompletion(operationId: string, options: WaitOptions = {}): Promise<ProgressInfo> {
        const timeout = (options.timeoutSeconds || DEFAULT_TIMEOUT_SECONDS) * 1000;
        const pollInterval = options.pollIntervalMs || DEFAULT_POLL_INTERVAL_MS;
        const startTime = Date.now();

        let progress = this.operations.get(operationId);
        if (!progress) {
            throw new Error(`Operation ${operationId} not found`);
        }

        while (!['completed', 'failed', 'timeout', 'cancelled'].includes(progress.status)) {
            // Check timeout
            if (Date.now() - startTime > timeout) {
                progress.status = 'timeout';
                progress.statusMessage = `Operation timed out after ${options.timeoutSeconds || DEFAULT_TIMEOUT_SECONDS} seconds`;
                progress.completedAt = new Date();
                this.operations.set(operationId, progress);

                logger.warn(`Operation ${operationId} timed out`);
                break;
            }

            // Wait before next poll
            await new Promise(resolve => setTimeout(resolve, pollInterval));

            // Update progress
            progress = await this.updateProgress(operationId);

            // Call progress callback if provided
            if (options.onProgress) {
                options.onProgress(progress);
            }
        }

        return progress;
    }

    /**
     * Cancels a running operation
     * 
     * @param operationId - The operation to cancel
     * @returns True if cancelled successfully
     */
    async cancelOperation(operationId: string): Promise<boolean> {
        const progress = this.operations.get(operationId);
        if (!progress) {
            return false;
        }

        if (!['pending', 'running'].includes(progress.status)) {
            return false; // Already in terminal state
        }

        try {
            if (progress.pid) {
                // Kill the process
                await this.vagrant.executeCommand(
                    progress.vmName,
                    `kill -SIGTERM ${progress.pid} 2>/dev/null; sleep 1; kill -SIGKILL ${progress.pid} 2>/dev/null || true`
                );
            }

            progress.status = 'cancelled';
            progress.statusMessage = 'Operation cancelled by user';
            progress.completedAt = new Date();
            this.operations.set(operationId, progress);

            logger.info(`Operation ${operationId} cancelled`);
            return true;
        } catch (error) {
            logger.error(`Failed to cancel operation ${operationId}`, error);
            return false;
        }
    }

    /**
     * Gets all operations for a VM
     * 
     * @param vmName - Name of the VM
     * @returns Array of progress info
     */
    getOperationsByVM(vmName: string): ProgressInfo[] {
        const ids = this.operationsByVM.get(vmName);
        if (!ids) return [];

        return Array.from(ids)
            .map(id => this.operations.get(id))
            .filter((p): p is ProgressInfo => p !== undefined);
    }

    /**
     * Gets all active (running) operations
     * 
     * @param vmName - Optional VM name filter
     * @returns Array of active operations
     */
    getActiveOperations(vmName?: string): ProgressInfo[] {
        const allOps = vmName
            ? this.getOperationsByVM(vmName)
            : Array.from(this.operations.values());

        return allOps.filter(op => ['pending', 'running'].includes(op.status));
    }

    /**
     * Cleans up completed operations
     * 
     * @param operationId - Operation to clean up
     */
    async cleanupOperation(operationId: string): Promise<void> {
        const progress = this.operations.get(operationId);
        if (!progress) return;

        try {
            // Remove log files
            const stderrFile = progress.logFile?.replace('.log', '.err');
            if (progress.logFile) {
                await this.vagrant.executeCommand(
                    progress.vmName,
                    `rm -f "${progress.logFile}" "${stderrFile}" 2>/dev/null || true`
                );
            }
        } catch (error) {
            logger.error(`Failed to cleanup operation ${operationId}`, error);
        }

        // Remove from registries
        const vmOps = this.operationsByVM.get(progress.vmName);
        if (vmOps) {
            vmOps.delete(operationId);
        }
        this.operations.delete(operationId);
    }
}

export { OperationTracker as default };
