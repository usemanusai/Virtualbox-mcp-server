/**
 * BackgroundTaskManager - Tracks and manages background tasks spawned in VMs
 * 
 * This class maintains a registry of background tasks started via run_background_task,
 * allowing the AI to monitor their status, retrieve output, and manage their lifecycle.
 */

import { VagrantClient, VMCredentials } from '@virtualbox-mcp/vagrant-client';
import { logger } from '@virtualbox-mcp/shared-utils';
import { randomUUID } from 'crypto';

/**
 * Status of a background task
 */
export type TaskStatus = 'running' | 'completed' | 'failed' | 'unknown';

/**
 * Information about a tracked background task
 */
export interface TaskInfo {
    /** Unique identifier for this task */
    taskId: string;
    /** Name of the VM where the task is running */
    vmName: string;
    /** Process ID of the background task in the VM */
    pid: number;
    /** The command that was executed */
    command: string;
    /** Path to the log file capturing stdout/stderr */
    logFile: string;
    /** Path to the stderr log file (if separate) */
    stderrFile: string;
    /** When the task was started */
    startedAt: Date;
    /** Current status of the task */
    status: TaskStatus;
    /** Working directory where the task was executed */
    workingDir: string;
    /** Exit code if the task has completed */
    exitCode?: number;
    /** Last time the status was checked */
    lastCheckedAt?: Date;
    /** Credentials used to start the task */
    credentials?: VMCredentials;
}

/**
 * Output from a background task
 */
export interface TaskOutput {
    /** Standard output content */
    stdout: string;
    /** Standard error content */
    stderr: string;
    /** Number of lines in stdout */
    stdoutLines: number;
    /** Number of lines in stderr */
    stderrLines: number;
    /** Whether the output was truncated */
    truncated: boolean;
    /** Current task status */
    status: TaskStatus;
    /** Exit code if available */
    exitCode?: number;
}

/**
 * Result from registering a new task
 */
export interface TaskRegistrationResult {
    /** Unique task identifier */
    taskId: string;
    /** Process ID in the VM */
    pid: number;
    /** Log file path in the VM */
    logFile: string;
    /** Stderr file path in the VM */
    stderrFile: string;
}

/**
 * Maximum output size to retrieve (in bytes)
 */
const MAX_OUTPUT_SIZE = 1024 * 1024; // 1MB

/**
 * Maximum number of lines to retrieve by default
 */
const DEFAULT_MAX_LINES = 1000;

/**
 * Manages background tasks running in Vagrant VMs
 */
export class BackgroundTaskManager {
    /** Registry of all tracked tasks, keyed by taskId */
    private tasks: Map<string, TaskInfo> = new Map();

    /** Index of tasks by VM name for quick lookup */
    private tasksByVM: Map<string, Set<string>> = new Map();

    /** Reference to VagrantClient for executing commands */
    private vagrant: VagrantClient;

    /**
     * Creates a new BackgroundTaskManager
     * @param vagrant - VagrantClient instance for VM operations
     */
    constructor(vagrant: VagrantClient) {
        this.vagrant = vagrant;
        logger.info('BackgroundTaskManager initialized');
    }

    /**
     * Alias for registerTask.
     * Needed for index.ts compatibility.
     */
    async startTask(vmName: string, command: string, workingDir?: string, credentials?: VMCredentials): Promise<TaskRegistrationResult> {
        return this.registerTask(vmName, command, workingDir, credentials);
    }

    /**
     * Registers a new background task
     * 
     * @param vmName - Name of the VM where the task is running
     * @param command - The command that was executed
     * @param workingDir - Working directory for the task
     * @returns Registration result with taskId and file paths
     */
    async registerTask(
        vmName: string,
        command: string,
        workingDir: string = '/home/vagrant',
        credentials?: VMCredentials
    ): Promise<TaskRegistrationResult> {
        const taskId = randomUUID();
        const timestamp = Date.now();
        const logFile = `/tmp/mcp_task_${taskId}_stdout.log`;
        const stderrFile = `/tmp/mcp_task_${taskId}_stderr.log`;

        // Build the background command with proper output redirection
        // Using nohup and disown to ensure the process survives SSH disconnection
        const wrappedCommand = [
            `cd "${workingDir}"`,
            `nohup sh -c '${command.replace(/'/g, "'\\''")}' > "${logFile}" 2> "${stderrFile}" &`,
            `echo $!`  // Echo the PID of the background process
        ].join(' && ');

        // Execute the command and capture the PID
        const result = await this.vagrant.executeCommand(vmName, wrappedCommand, credentials);

        if (result.exitCode !== 0) {
            logger.error(`Failed to start background task: ${result.stderr}`);
            throw new Error(`Failed to start background task: ${result.stderr || 'Unknown error'}`);
        }

        // Parse the PID from stdout
        const pidStr = result.stdout.trim().split('\n').pop()?.trim();
        const pid = parseInt(pidStr || '0', 10);

        if (isNaN(pid) || pid <= 0) {
            logger.error(`Invalid PID received: ${pidStr}`);
            throw new Error(`Failed to get valid PID for background task. Got: ${pidStr}`);
        }

        // Create task info
        const taskInfo: TaskInfo = {
            taskId,
            vmName,
            pid,
            command,
            logFile,
            stderrFile,
            startedAt: new Date(),
            status: 'running',
            workingDir,
            lastCheckedAt: new Date(),
            credentials
        };

        // Register in the task map
        this.tasks.set(taskId, taskInfo);

        // Add to VM index
        if (!this.tasksByVM.has(vmName)) {
            this.tasksByVM.set(vmName, new Set());
        }
        this.tasksByVM.get(vmName)!.add(taskId);

        logger.info(`Registered background task ${taskId} with PID ${pid} on VM ${vmName}`);

        return {
            taskId,
            pid,
            logFile,
            stderrFile
        };
    }

    /**
     * Gets information about a specific task
     * 
     * @param taskId - The task identifier
     * @returns Task info or undefined if not found
     */
    getTask(taskId: string): TaskInfo | undefined {
        return this.tasks.get(taskId);
    }

    /**
     * Gets all tasks for a specific VM
     * 
     * @param vmName - Name of the VM
     * @returns Array of task info objects
     */
    getTasksByVM(vmName: string): TaskInfo[] {
        const taskIds = this.tasksByVM.get(vmName);
        if (!taskIds) return [];

        return Array.from(taskIds)
            .map(id => this.tasks.get(id))
            .filter((task): task is TaskInfo => task !== undefined);
    }

    /**
     * Gets all registered tasks
     * 
     * @returns Array of all task info objects
     */
    getAllTasks(): TaskInfo[] {
        return Array.from(this.tasks.values());
    }

    /**
     * Retrieves the output of a background task
     * 
     * @param taskId - The task identifier
     * @param maxLines - Maximum number of lines to retrieve (default: 1000)
     * @param tailOnly - If true, only get the last N lines; if false, get from beginning
     * @returns Task output containing stdout, stderr, and status
     */
    async getTaskOutput(
        taskId: string,
        maxLines: number = DEFAULT_MAX_LINES,
        tailOnly: boolean = true
    ): Promise<TaskOutput> {
        const task = this.tasks.get(taskId);
        if (!task) {
            throw new Error(`Task ${taskId} not found`);
        }

        // Update task status first
        await this.updateTaskStatus(taskId);

        // Build commands to read output files
        const readCmd = tailOnly ? `tail -n ${maxLines}` : `head -n ${maxLines}`;

        // Read stdout
        const stdoutResult = await this.vagrant.executeCommand(
            task.vmName,
            `${readCmd} "${task.logFile}" 2>/dev/null || echo ""`,
            task.credentials
        );

        // Read stderr
        const stderrResult = await this.vagrant.executeCommand(
            task.vmName,
            `${readCmd} "${task.stderrFile}" 2>/dev/null || echo ""`,
            task.credentials
        );

        // Count total lines in files
        const lineCountResult = await this.vagrant.executeCommand(
            task.vmName,
            `wc -l "${task.logFile}" "${task.stderrFile}" 2>/dev/null | tail -2 | head -2`,
            task.credentials
        );

        // Parse line counts
        const lineCounts = lineCountResult.stdout.split('\n')
            .map(line => parseInt(line.trim().split(/\s+/)[0] || '0', 10));
        const stdoutLines = lineCounts[0] || 0;
        const stderrLines = lineCounts[1] || 0;

        // Determine if output was truncated
        const truncated = stdoutLines > maxLines || stderrLines > maxLines;

        // Refresh task from map (status may have been updated)
        const updatedTask = this.tasks.get(taskId)!;

        return {
            stdout: stdoutResult.stdout,
            stderr: stderrResult.stdout, // Note: stderrResult.stdout contains the content read from stderrFile
            stdoutLines,
            stderrLines,
            truncated,
            status: updatedTask.status,
            exitCode: updatedTask.exitCode
        };
    }

    /**
     * Updates the status of a task by checking if the process is still running
     * 
     * @param taskId - The task identifier
     */
    async updateTaskStatus(taskId: string): Promise<void> {
        const task = this.tasks.get(taskId);
        if (!task) {
            throw new Error(`Task ${taskId} not found`);
        }

        // Skip if already in terminal state
        if (task.status === 'completed' || task.status === 'failed') {
            return;
        }

        try {
            // Check if process is still running using kill -0 (doesn't actually send a signal)
            const checkResult = await this.vagrant.executeCommand(
                task.vmName,
                `kill -0 ${task.pid} 2>/dev/null && echo "RUNNING" || echo "STOPPED"`,
                task.credentials
            );

            const isRunning = checkResult.stdout.trim() === 'RUNNING';

            if (isRunning) {
                task.status = 'running';
            } else {
                // Process has stopped, try to get exit code from a marker file
                // We need to check if the process exited cleanly
                const exitCodeResult = await this.vagrant.executeCommand(
                    task.vmName,
                    `wait ${task.pid} 2>/dev/null; echo $?`,
                    task.credentials
                );

                const exitCode = parseInt(exitCodeResult.stdout.trim(), 10);
                task.exitCode = isNaN(exitCode) ? undefined : exitCode;
                task.status = (exitCode === 0) ? 'completed' : 'failed';
            }

            task.lastCheckedAt = new Date();
            this.tasks.set(taskId, task);

            logger.debug(`Task ${taskId} status updated to ${task.status}`);
        } catch (error) {
            logger.error(`Failed to update status for task ${taskId}`, error);
            task.status = 'unknown';
            task.lastCheckedAt = new Date();
            this.tasks.set(taskId, task);
        }
    }

    /**
     * Kills a background task
     * 
     * @param taskId - The task identifier
     * @param signal - Signal to send (default: SIGTERM)
     * @returns True if the task was killed successfully
     */
    async killTask(taskId: string, signal: string = 'SIGTERM'): Promise<boolean> {
        const task = this.tasks.get(taskId);
        if (!task) {
            throw new Error(`Task ${taskId} not found`);
        }

        if (task.status !== 'running') {
            logger.warn(`Task ${taskId} is not running (status: ${task.status})`);
            return false;
        }

        try {
            // Send the kill signal
            const result = await this.vagrant.executeCommand(
                task.vmName,
                `kill -${signal} ${task.pid} 2>/dev/null && echo "KILLED" || echo "FAILED"`,
                task.credentials
            );

            const killed = result.stdout.trim() === 'KILLED';

            if (killed) {
                // Wait a moment and check status
                await new Promise(resolve => setTimeout(resolve, 500));
                await this.updateTaskStatus(taskId);
                logger.info(`Task ${taskId} killed with signal ${signal}`);
            } else {
                logger.warn(`Failed to kill task ${taskId} with signal ${signal}`);
            }

            return killed;
        } catch (error) {
            logger.error(`Error killing task ${taskId}`, error);
            return false;
        }
    }

    /**
     * Removes a task from the registry
     * Note: This does NOT kill the task, only removes tracking
     * 
     * @param taskId - The task identifier
     * @returns True if the task was removed
     */
    removeTask(taskId: string): boolean {
        const task = this.tasks.get(taskId);
        if (!task) {
            return false;
        }

        // Remove from VM index
        const vmTasks = this.tasksByVM.get(task.vmName);
        if (vmTasks) {
            vmTasks.delete(taskId);
            if (vmTasks.size === 0) {
                this.tasksByVM.delete(task.vmName);
            }
        }

        // Remove from main registry
        this.tasks.delete(taskId);

        logger.info(`Task ${taskId} removed from registry`);
        return true;
    }

    /**
     * Cleans up log files for a completed task
     * 
     * @param taskId - The task identifier
     */
    async cleanupTaskFiles(taskId: string): Promise<void> {
        const task = this.tasks.get(taskId);
        if (!task) {
            throw new Error(`Task ${taskId} not found`);
        }

        try {
            await this.vagrant.executeCommand(
                task.vmName,
                `rm -f "${task.logFile}" "${task.stderrFile}"`,
                task.credentials
            );
            logger.info(`Cleaned up log files for task ${taskId}`);
        } catch (error) {
            logger.error(`Failed to cleanup files for task ${taskId}`, error);
        }
    }

    /**
     * Gets a summary of all tasks for a VM suitable for dashboard display
     * 
     * @param vmName - Name of the VM
     * @returns Summary object with task counts and recent tasks
     */
    getVMTaskSummary(vmName: string): {
        total: number;
        running: number;
        completed: number;
        failed: number;
        recentTasks: TaskInfo[];
    } {
        const tasks = this.getTasksByVM(vmName);

        return {
            total: tasks.length,
            running: tasks.filter(t => t.status === 'running').length,
            completed: tasks.filter(t => t.status === 'completed').length,
            failed: tasks.filter(t => t.status === 'failed').length,
            recentTasks: tasks
                .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
                .slice(0, 5)
        };
    }
}

export { BackgroundTaskManager as default };
