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
            const isValid = this.systemMonitor.validateWorkspace(args.path);
            if (!isValid) {
                violations.push({
                    type: 'SYSTEM_PROTECTION',
                    message: `Operation blocked: Path validation failed (${args.path})`,
                    severity: 'CRITICAL'
                });
                return violations; // Stop immediately
            }
        }

        // 2. Resource Checks for Heavy Operations
        if (['create_vm', 'snapshot_save', 'start_download'].includes(toolName)) {
            const healthReport = await this.systemMonitor.checkHealth(process.cwd());

            if (healthReport.disk.free / 1024 < this.MIN_DISK_SPACE_GB_HARD) {
                violations.push({
                    type: 'NO_SPACE',
                    message: `CRITICAL: Insufficient disk space (${Math.round(healthReport.disk.free / 1024)}GB). Minimum ${this.MIN_DISK_SPACE_GB_HARD}GB required.`,
                    severity: 'CRITICAL',
                    details: healthReport.disk
                });
            } else if (healthReport.disk.free / 1024 < this.MIN_DISK_SPACE_GB_SOFT) {
                violations.push({
                    type: 'NO_SPACE',
                    message: `WARNING: Low disk space (${Math.round(healthReport.disk.free / 1024)}GB). Recommended ${this.MIN_DISK_SPACE_GB_SOFT}GB.`,
                    severity: 'WARNING',
                    details: healthReport.disk
                });
            }
        }

        return violations;
    }

    /**
     * Gets current system health status
     */
    async getSystemStatus() {
        const healthReport = await this.systemMonitor.checkHealth(process.cwd());
        const { zombies } = await this.scanForZombies();

        return {
            disk: healthReport.disk,
            memory: healthReport.memory,
            zombies,
            status: !healthReport.isHealthy || zombies.length > 5 ? 'WARNING' : 'OK'
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
