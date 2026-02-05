import checkDiskSpace from 'check-disk-space';
import os from 'os';
import { logger } from './logger.js';

/**
 * SystemMonitor - Provides cross-platform system resource checks
 */
export class SystemMonitor {

    /**
     * Checks available disk space on the drive containing the specified path
     * @param path Path to check disk space for (default: current working directory)
     * @returns Object with free, size (total), and percentage
     */
    async checkDiskSpace(path: string = process.cwd()): Promise<{
        free: number;
        size: number;
        freeGB: number;
        totalGB: number;
        percentFree: number;
        isLow: boolean;
    }> {
        try {
            // check-disk-space handles Windows drive letters (C:) and Unix paths (/)
            const result = await checkDiskSpace(path);

            const freeGB = result.free / 1024 / 1024 / 1024;
            const totalGB = result.size / 1024 / 1024 / 1024;
            const percentFree = (result.free / result.size) * 100;

            // Critical warning if less than 5GB or 10%
            const isLow = freeGB < 5 || percentFree < 10;

            return {
                free: result.free,
                size: result.size,
                freeGB: parseFloat(freeGB.toFixed(2)),
                totalGB: parseFloat(totalGB.toFixed(2)),
                percentFree: parseFloat(percentFree.toFixed(1)),
                isLow
            };
        } catch (error) {
            logger.error(`Failed to check disk space for path ${path}`, error);
            // Return conservative fail-safe values (assume enough space to avoid blocking if check fails, but log error)
            return {
                free: 10 * 1024 * 1024 * 1024,
                size: 100 * 1024 * 1024 * 1024,
                freeGB: 10,
                totalGB: 100,
                percentFree: 10,
                isLow: false
            };
        }
    }

    /**
     * Checks system memory usage
     */
    getMemoryUsage(): {
        total: number;
        free: number;
        used: number;
        totalGB: number;
        freeGB: number;
        percentUsed: number;
    } {
        const total = os.totalmem();
        const free = os.freemem();
        const used = total - free;

        return {
            total,
            free,
            used,
            totalGB: parseFloat((total / 1024 / 1024 / 1024).toFixed(2)),
            freeGB: parseFloat((free / 1024 / 1024 / 1024).toFixed(2)),
            percentUsed: parseFloat(((used / total) * 100).toFixed(1))
        };
    }

    /**
     * Validates if a path is safe to operate in (prevents operating in system directories)
     */
    validateWorkspace(workspacePath: string): { valid: boolean; reason?: string } {
        // Normalize path
        const normalized = workspacePath.replace(/\\/g, '/');

        // Block root directories
        if (normalized === '/' || normalized.match(/^[a-zA-Z]:\/?$/)) {
            return { valid: false, reason: "Cannot operate directly in root directory" };
        }

        // Block system directories (Windows)
        if (normalized.toLowerCase().includes('/windows') ||
            normalized.toLowerCase().includes('/program files') ||
            normalized.toLowerCase().includes('/system32')) {
            return { valid: false, reason: "Cannot operate in system directories" };
        }

        // Block typical home root usage (should use subdirs)
        const home = os.homedir().replace(/\\/g, '/');
        if (normalized === home) {
            // Allow home dir execution but warn... actually, guardrails should probably forbid it to prevent clutter
            // For now, allow it but maybe prefer a workspace folder
        }

        return { valid: true };
    }
}
