import checkDiskSpace from 'check-disk-space';
import os from 'os';
import path from 'path';

export interface DiskSpaceInfo {
    free: number;
    size: number;
    used: number;
    percentUsed: number;
    path: string;
}

export interface MemoryInfo {
    totalMB: number;
    freeMB: number;
    usedMB: number;
    percentUsed: number;
}

export interface SystemHealthReport {
    disk: DiskSpaceInfo;
    memory: MemoryInfo;
    warnings: string[];
    isHealthy: boolean;
}

/**
 * System Monitor for checking disk space, memory, and workspace validation.
 * Used by GuardrailsManager for pre-flight checks before VM operations.
 */
export class SystemMonitor {
    private minDiskSpaceMB: number;
    private minMemoryMB: number;

    constructor(config?: { minDiskSpaceMB?: number; minMemoryMB?: number }) {
        this.minDiskSpaceMB = config?.minDiskSpaceMB || 5000; // 5GB default
        this.minMemoryMB = config?.minMemoryMB || 2000;       // 2GB default
    }

    /**
     * Gets disk space information for a specific path.
     * @param targetPath - Path to check (uses OS root if not specified)
     */
    async getDiskSpace(targetPath?: string): Promise<DiskSpaceInfo> {
        const diskPath = targetPath || (process.platform === 'win32' ? 'C:' : '/');
        const info = await checkDiskSpace(diskPath);

        return {
            free: Math.round(info.free / 1024 / 1024), // Convert to MB
            size: Math.round(info.size / 1024 / 1024),
            used: Math.round((info.size - info.free) / 1024 / 1024),
            percentUsed: Math.round(((info.size - info.free) / info.size) * 100),
            path: diskPath
        };
    }

    /**
     * Gets system memory information.
     */
    getMemoryInfo(): MemoryInfo {
        const totalBytes = os.totalmem();
        const freeBytes = os.freemem();
        const usedBytes = totalBytes - freeBytes;

        return {
            totalMB: Math.round(totalBytes / 1024 / 1024),
            freeMB: Math.round(freeBytes / 1024 / 1024),
            usedMB: Math.round(usedBytes / 1024 / 1024),
            percentUsed: Math.round((usedBytes / totalBytes) * 100)
        };
    }

    /**
     * Validates that a workspace path is safe and not a system directory.
     * @param workspacePath - Path to validate
     * @returns True if the path is safe to use
     */
    validateWorkspace(workspacePath: string): boolean {
        const normalizedPath = path.resolve(workspacePath).toLowerCase();
        
        // List of dangerous paths that should never be used as workspaces
        const dangerousPaths = [
            process.platform === 'win32' ? 'c:\\windows' : '/bin',
            process.platform === 'win32' ? 'c:\\program files' : '/usr',
            process.platform === 'win32' ? 'c:\\system32' : '/etc',
            '/boot', '/dev', '/proc', '/sys'
        ];

        for (const dangerous of dangerousPaths) {
            if (normalizedPath.startsWith(dangerous.toLowerCase())) {
                return false;
            }
        }

        return true;
    }

    /**
     * Runs a full system health check.
     * @param workspacePath - Optional workspace path to check disk space for
     */
    async checkHealth(workspacePath?: string): Promise<SystemHealthReport> {
        const disk = await this.getDiskSpace(workspacePath);
        const memory = this.getMemoryInfo();
        const warnings: string[] = [];

        if (disk.free < this.minDiskSpaceMB) {
            warnings.push(`Low disk space: Only ${disk.free}MB free (minimum: ${this.minDiskSpaceMB}MB)`);
        }

        if (memory.freeMB < this.minMemoryMB) {
            warnings.push(`Low memory: Only ${memory.freeMB}MB free (minimum: ${this.minMemoryMB}MB)`);
        }

        return {
            disk,
            memory,
            warnings,
            isHealthy: warnings.length === 0
        };
    }
}
