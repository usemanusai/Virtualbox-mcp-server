import { VagrantClient } from '@virtualbox-mcp/vagrant-client';
import { logger, SystemMonitor } from '@virtualbox-mcp/shared-utils';
import path from 'path';

export interface Violation {
    type: 'NO_SPACE' | 'MEMORY_LOW' | 'ZOMBIE_VMS' | 'INVALID_WORKSPACE' | 'SYSTEM_PROTECTION';
    message: string;
    severity: 'WARNING' | 'CRITICAL';
    details?: any;
}

export class GuardrailsManager {
    private vagrant: VagrantClient;
    private systemMonitor: SystemMonitor;

    // Configurable limits
    private readonly MIN_DISK_SPACE_GB_HARD = 2; // Critical stop
    private readonly MIN_DISK_SPACE_GB_SOFT = 5; // Warning
    private readonly ZOMBIE_THRESHOLD_DAYS = 7;

    constructor(vagrant: VagrantClient) {
        this.vagrant = vagrant;
        this.systemMonitor = new SystemMonitor();
    }

    /**
     * Validates operation safety before execution
     * @param toolName The tool being called
     * @param args Tool arguments
     */
    async validate(toolName: string, args: any): Promise<Violation[]> {
        const violations: Violation[] = [];

        // 1. Workspace Validation (for irrelevant tools, skip)
        // Actually, we don't always have workspace path in args. 
        // But for things that use paths:
        if (args.path && typeof args.path === 'string') {
            const check = this.systemMonitor.validateWorkspace(args.path);
            if (!check.valid) {
                violations.push({
                    type: 'SYSTEM_PROTECTION',
                    message: `Operation blocked: ${check.reason} (${args.path})`,
                    severity: 'CRITICAL'
                });
                return violations; // Stop immediately
            }
        }

        // 2. Resource Checks for Heavy Operations
        if (['create_vm', 'snapshot_save', 'start_download'].includes(toolName)) {
            const diskCheck = await this.systemMonitor.checkDiskSpace(process.cwd()); // Check execution drive

            if (diskCheck.freeGB < this.MIN_DISK_SPACE_GB_HARD) {
                violations.push({
                    type: 'NO_SPACE',
                    message: `CRITICAL: Insufficient disk space (${diskCheck.freeGB}GB). Minimum ${this.MIN_DISK_SPACE_GB_HARD}GB required.`,
                    severity: 'CRITICAL',
                    details: diskCheck
                });
            } else if (diskCheck.freeGB < this.MIN_DISK_SPACE_GB_SOFT) {
                violations.push({
                    type: 'NO_SPACE',
                    message: `WARNING: Low disk space (${diskCheck.freeGB}GB). Recommended ${this.MIN_DISK_SPACE_GB_SOFT}GB.`,
                    severity: 'WARNING',
                    details: diskCheck
                });
            }
        }

        return violations;
    }

    /**
     * Gets current system health status
     */
    async getSystemStatus() {
        const disk = await this.systemMonitor.checkDiskSpace(process.cwd());
        const memory = this.systemMonitor.getMemoryUsage();
        const { zombies } = await this.scanForZombies();

        return {
            disk,
            memory,
            zombies,
            status: disk.isLow || zombies.length > 5 ? 'WARNING' : 'OK'
        };
    }

    /**
     * Scans for "Zombie" VMs (abandoned/unused)
     */
    async scanForZombies(): Promise<{
        zombies: any[];
        totalVSMs: number;
    }> {
        // This is a heuristic scan.
        // We look for VMs that are 'poweroff' or 'aborted'
        // And check their last modification time if possible (not easy via vagrant global-status)
        // For now, we'll list all global-status and flag those that look suspicious?

        // Actually, Vagrant global-status is unreliable for "last used".
        // But we can check the 'state'.
        // Let's rely on explicit manual confirmation for now, but report ALL non-running VMs as potential cleanup candidates
        // if they match certain patterns or are just sitting there.

        // Better approach: Use the SyncManager's knowledge or VagrantClient's list.
        return { zombies: [], totalVSMs: 0 }; // Implementation placeholder until we have robust "last used" tracking.
    }
}
