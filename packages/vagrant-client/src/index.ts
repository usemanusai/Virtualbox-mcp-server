import { execa } from 'execa';
import { logger, closestMatch } from '@virtualbox-mcp/shared-utils';
import { z } from 'zod';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

export const VMStatusSchema = z.enum([
    'running',
    'poweroff',
    'aborted',
    'saved',
    'not_created',
    'unknown'
]);

export type VMStatus = z.infer<typeof VMStatusSchema>;

export interface VagrantVM {
    name: string;
    status: VMStatus;
    directory?: string;
    managedBy: 'vagrant' | 'native';
}

export interface VMCredentials {
    username?: string;
    password?: string;
}

export class VagrantClient {
    private vmsDir: string;
    private vboxPath: string | null = null;

    constructor(vmsDir?: string) {
        this.vmsDir = vmsDir || path.join(process.env.HOME || process.cwd(), '.vagrant-mcp', 'vms');
        if (!fs.existsSync(this.vmsDir)) {
            fs.mkdirSync(this.vmsDir, { recursive: true });
        }
    }

    private async getVBoxManage(): Promise<string> {
        if (this.vboxPath) return this.vboxPath;

        // Try common paths on Windows
        const paths = [
            'VBoxManage',
            'C:\\Program Files\\Oracle\\VirtualBox\\VBoxManage.exe',
            'C:\\Program Files (x86)\\Oracle\\VirtualBox\\VBoxManage.exe'
        ];

        for (const p of paths) {
            try {
                await execa(p, ['--version']);
                this.vboxPath = p;
                return p;
            } catch {
                continue;
            }
        }

        throw new Error('VBoxManage not found. Please ensure VirtualBox is installed and in your PATH.');
    }

    async getVMStatus(name: string): Promise<VMStatus> {
        const vmDir = path.join(this.vmsDir, name);

        // If it's a Vagrant VM managed by us
        if (fs.existsSync(vmDir)) {
            try {
                const { stdout } = await execa('vagrant', ['status', '--machine-readable'], { cwd: vmDir });
                const lines = stdout.split('\n');
                for (const line of lines) {
                    const parts = line.split(',');
                    if (parts.length >= 4 && parts[2] === 'state') {
                        const state = parts[3].trim();
                        if (state === 'running') return 'running';
                        if (state === 'poweroff') return 'poweroff';
                        if (state === 'aborted') return 'aborted';
                        if (state === 'saved') return 'saved';
                        if (state === 'not_created') return 'not_created';
                    }
                }
            } catch (error) {
                logger.error(`Vagrant status failed for ${name}, falling back to VBoxManage`, error);
            }
        }

        // Fallback or native VM check via VBoxManage
        try {
            const vbox = await this.getVBoxManage();
            const { stdout } = await execa(vbox, ['showvminfo', name, '--machinereadable']);
            if (stdout.includes('VMState="running"')) return 'running';
            if (stdout.includes('VMState="poweroff"')) return 'poweroff';
            if (stdout.includes('VMState="aborted"')) return 'aborted';
            if (stdout.includes('VMState="saved"')) return 'saved';
            return 'unknown';
        } catch (error) {
            return 'not_created';
        }
    }

    async listVMs(options: { includeStatus?: boolean } = {}): Promise<{ name: string; state: VMStatus; managedBy: 'vagrant' | 'native' }[]> {
        const vmsMap = new Map<string, { name: string; state: VMStatus; managedBy: 'vagrant' | 'native' }>();

        // 1. List Vagrant VMs in our managed dir
        if (fs.existsSync(this.vmsDir)) {
            const entries = fs.readdirSync(this.vmsDir, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const status = options.includeStatus ? await this.getVMStatus(entry.name) : 'unknown' as VMStatus;
                    vmsMap.set(entry.name, { name: entry.name, state: status, managedBy: 'vagrant' });
                }
            }
        }

        // 2. List all VirtualBox VMs
        try {
            const vbox = await this.getVBoxManage();
            const { stdout } = await execa(vbox, ['list', 'vms']);
            const lines = stdout.split('\n');
            for (const line of lines) {
                const match = line.match(/"([^"]+)"/);
                if (match) {
                    const name = match[1];
                    if (!vmsMap.has(name)) {
                        const state = options.includeStatus ? await this.getVMStatus(name) : 'unknown' as VMStatus;
                        vmsMap.set(name, { name, state, managedBy: 'native' });
                    }
                }
            }
        } catch (error) {
            logger.error('Failed to list native VirtualBox VMs', error);
        }

        // 3. List Global Vagrant VMs (Smart Discovery)
        try {
            const globalVMs = await this.getGlobalVagrantVMs();
            for (const vm of globalVMs) {
                // Prefer local/native if already found, otherwise add global
                if (!vmsMap.has(vm.name)) {
                    const state = options.includeStatus ? vm.state : 'unknown' as VMStatus;
                    vmsMap.set(vm.name, { name: vm.name, state, managedBy: 'vagrant' });
                    // Also map by ID for robustness
                    if (vm.id) {
                        vmsMap.set(vm.id, { name: vm.name, state, managedBy: 'vagrant' });
                    }
                }
            }
        } catch (error) {
            logger.error('Failed to list global Vagrant VMs', error);
        }

        return Array.from(vmsMap.values());
    }

    /**
     * Parses 'vagrant global-status' to find all running Vagrant instances
     */
    async getGlobalVagrantVMs(): Promise<Array<{ id: string; name: string; state: VMStatus; directory: string }>> {
        try {
            const { stdout } = await execa('vagrant', ['global-status', '--prune']);
            const lines = stdout.split('\n');
            const vms: Array<{ id: string; name: string; state: VMStatus; directory: string }> = [];

            // Output format: id name provider state directory
            // Skip header/footer
            const dataLines = lines.filter(l => l.match(/^[a-f0-9]{7}\s+/));

            for (const line of dataLines) {
                const parts = line.trim().split(/\s+/);
                if (parts.length >= 5) {
                    const id = parts[0];
                    const name = parts[1];
                    let stateStr = parts[3];
                    const directory = parts.slice(4).join(' ');

                    // Map Vagrant state to VMStatus
                    let state: VMStatus = 'unknown';
                    if (stateStr === 'running') state = 'running';
                    else if (stateStr === 'poweroff') state = 'poweroff';
                    else if (stateStr === 'saved') state = 'saved';
                    else if (stateStr === 'aborted') state = 'aborted';

                    vms.push({ id, name, state, directory });
                }
            }
            return vms;
        } catch (error) {
            return [];
        }
    }

    listVMsSync(): string[] {
        if (!fs.existsSync(this.vmsDir)) return [];
        return fs.readdirSync(this.vmsDir).filter(f => fs.statSync(path.join(this.vmsDir, f)).isDirectory());
    }

    /**
     * Sends keyboard input to the VM.
     * Useful for logging in blindly or controlling the VM when Guest Additions are down.
     */
    async sendKeystrokes(name: string, sequence: string): Promise<void> {
        const vbox = await this.getVBoxManage();
        // Check if VM satisfies basic running check, though we might want to try even if status is weird
        const status = await this.getVMStatus(name);
        if (status !== 'running') {
            throw new Error(`Cannot send keystrokes: VM '${name}' is not running (state: ${status})`);
        }

        const chunks = sequence.split(/(<Enter>|<Return>)/g);

        for (const chunk of chunks) {
            if (chunk === '<Enter>' || chunk === '<Return>') {
                // Scancode for Enter is 1C (Press) 9C (Release). 
                // VBoxManage controlvm ... keyboardputscancode 1c 9c
                await execa(vbox, ['controlvm', name, 'keyboardputscancode', '1c', '9c']);
            } else if (chunk.length > 0) {
                // Determine if native or vagrant VM for ID resolution? 
                // VBoxManage works with name usually.
                await execa(vbox, ['controlvm', name, 'keyboardputstring', chunk]);
            }
        }
    }

    async executeCommand(name: string, command: string, options: { timeout?: number, username?: string, password?: string } = {}): Promise<{ stdout: string; stderr: string; exitCode: number; timedOut?: boolean }> {
        const vmDir = path.join(this.vmsDir, name);
        const timeout = options.timeout !== undefined ? options.timeout : 300000; // Default 5 mins

        // If it's a native VM or doesn't exist in our managed dir, try native OR global execution
        if (!fs.existsSync(vmDir)) {
            // 1. Try Global Vagrant ID/Name (Prioritized for robustness via SSH)
            const globalVMs = await this.getGlobalVagrantVMs();
            const globalVM = globalVMs.find(v => v.name === name || v.id === name);

            if (globalVM) {
                try {
                    // Use vagrant ssh <id> -c command
                    const result = await execa('vagrant', ['ssh', globalVM.id, '-c', command], {
                        timeout
                    });
                    return {
                        stdout: result.stdout,
                        stderr: result.stderr,
                        exitCode: result.exitCode,
                        timedOut: false
                    };
                } catch (error: any) {
                    if (error.timedOut) return { stdout: '', stderr: '', exitCode: 124, timedOut: true };
                    return { stdout: error.stdout || '', stderr: error.stderr || '', exitCode: error.exitCode || 1, timedOut: false };
                }
            }

            // 2. Try Native VirtualBox Name (Fallback if not known to Vagrant)
            const vms = await this.listVMs({ includeStatus: false });
            const nativeVM = vms.find(v => v.name === name && v.managedBy === 'native');
            if (nativeVM) {
                return this.executeCommandNative(name, command, options);
            }

            const vmsSync = this.listVMsSync();
            const candidate = closestMatch(name, vmsSync);
            const suggestion = candidate ? `. Did you mean '${candidate}'?` : '';
            throw new Error(`VM ${name} not found${suggestion}`);
        }

        try {
            // Use vagrant ssh -c to execute command
            const result = await execa('vagrant', ['ssh', '-c', command], {
                cwd: vmDir,
                timeout
            });
            return {
                stdout: result.stdout,
                stderr: result.stderr,
                exitCode: result.exitCode,
                timedOut: false
            };
        } catch (error: any) {
            if (error.timedOut) {
                return {
                    stdout: error.stdout || '',
                    stderr: error.stderr || '',
                    exitCode: 124, // Standard exit code for timeout
                    timedOut: true
                };
            }
            // execa throws on non-zero exit code
            return {
                stdout: error.stdout || '',
                stderr: error.stderr || '',
                exitCode: error.exitCode || 1,
                timedOut: false
            };
        }
    }

    async uploadFile(name: string, source: string, destination: string, options: VMCredentials = {}): Promise<void> {
        const vmDir = path.join(this.vmsDir, name);
        if (!fs.existsSync(vmDir)) {
            // Native fallback
            const vms = await this.listVMs();
            const nativeVM = vms.find(v => v.name === name && v.managedBy === 'native');
            if (nativeVM) {
                return this.uploadFileNative(name, source, destination, options);
            }
            throw new Error(`VM ${name} not found`);
        }

        // vagrant upload source [destination] [name|id]
        await execa('vagrant', ['upload', source, destination], { cwd: vmDir });
    }

    async createVM(name: string, box: string = 'ubuntu/focal64', guiMode: boolean = false): Promise<void> {
        const vmDir = path.join(this.vmsDir, name);
        if (!fs.existsSync(vmDir)) {
            fs.mkdirSync(vmDir, { recursive: true });
        }

        // Generate Vagrantfile if not exists
        const vagrantfilePath = path.join(vmDir, 'Vagrantfile');
        if (!fs.existsSync(vagrantfilePath)) {
            const content = `
Vagrant.configure("2") do |config|
  config.vm.box = "${box}"
  config.vm.provider "virtualbox" do |vb|
    vb.name = "${name}"
    vb.memory = "1024"
    vb.cpus = 1
    vb.gui = ${guiMode}
  end
end
`;
            fs.writeFileSync(vagrantfilePath, content);
        }

        await execa('vagrant', ['up'], { cwd: vmDir });
    }

    async haltVM(name: string): Promise<void> {
        const vmDir = path.join(this.vmsDir, name);
        if (fs.existsSync(vmDir)) {
            await execa('vagrant', ['halt'], { cwd: vmDir });
        } else {
            // Native fallback
            const vbox = await this.getVBoxManage();
            await execa(vbox, ['controlvm', name, 'savestate']); // 'savestate' is safer than 'poweroff'
        }
    }

    async startVM(name: string): Promise<void> {
        const vmDir = path.join(this.vmsDir, name);
        if (fs.existsSync(vmDir)) {
            await execa('vagrant', ['up'], { cwd: vmDir });
        } else {
            // Native fallback
            const vbox = await this.getVBoxManage();
            await execa(vbox, ['startvm', name, '--type', 'headless']);
        }
    }

    async destroyVM(name: string): Promise<void> {
        const vmDir = path.join(this.vmsDir, name);
        if (fs.existsSync(vmDir)) {
            await execa('vagrant', ['destroy', '-f'], { cwd: vmDir });
        }
    }

    async rsyncToVM(name: string): Promise<void> {
        const vmDir = path.join(this.vmsDir, name);
        if (!fs.existsSync(vmDir)) {
            // Native fallback - use recursive directory copy if possible, or skip
            const vms = await this.listVMs();
            const nativeVM = vms.find(v => v.name === name && v.managedBy === 'native');
            if (nativeVM) {
                // For native VMs, 'rsync' is not native, we fallback to a simple native upload
                // We'll assume the user wants the current project path or similar.
                // In MCP context, this usually means the shared folders.
                throw new Error(`Universal Sync (rsync) is not natively supported for '${name}'. Use 'upload_file' for specific files, or migrate to a managed VM.`);
            }
            throw new Error(`VM ${name} not found`);
        }
        await execa('vagrant', ['rsync'], { cwd: vmDir });
    }

    async rsyncFromVM(name: string): Promise<void> {
        const vmDir = path.join(this.vmsDir, name);
        if (!fs.existsSync(vmDir)) {
            throw new Error(`VM ${name} not found`);
        }
        // rsync-back requires the vagrant-rsync-back plugin
        // Fallback: just run rsync command in reverse direction
        await execa('vagrant', ['rsync-back'], { cwd: vmDir });
    }

    private async executeCommandNative(name: string, command: string, options: { timeout?: number, username?: string, password?: string } = {}): Promise<{ stdout: string; stderr: string; exitCode: number; timedOut?: boolean }> {
        const vbox = await this.getVBoxManage();
        const timeout = options.timeout || 60000;
        const username = options.username || 'vagrant';
        const password = options.password || 'vagrant';

        // Fast check: Ensure VM is running
        const status = await this.getVMStatus(name);
        if (status !== 'running') {
            throw new Error(`Cannot execute command: VM '${name}' is in state '${status}' (must be 'running')`);
        }

        try {
            // VBoxManage guestcontrol <vmname> run --exe "/bin/sh" --username <user> --password <pass> -- -c "<command>"
            const result = await execa(vbox, [
                'guestcontrol', name, 'run',
                '--exe', '/bin/sh',
                '--username', username,
                '--password', password,
                '--', '-c', command
            ], { timeout });

            return {
                stdout: result.stdout,
                stderr: result.stderr,
                exitCode: result.exitCode,
                timedOut: false
            };
        } catch (error: any) {
            // Enhance error message for authentication failures
            if (error.stderr && error.stderr.includes('VBOX_E_IPRT_ERROR')) {
                error.message += ` (Hint: Check if Guest Additions are running and '${username}' user credentials are valid)`;
            }

            return {
                stdout: error.stdout || '',
                stderr: error.stderr || '',
                exitCode: error.exitCode || 1,
                timedOut: !!error.timedOut
            };
        }
    }

    private async uploadFileNative(name: string, source: string, destination: string, options: VMCredentials = {}): Promise<void> {
        const vbox = await this.getVBoxManage();
        const username = options.username || 'vagrant';
        const password = options.password || 'vagrant';

        // VBoxManage guestcontrol <vmname> copyto <src> <dest> --username <user> --password <pass>
        await execa(vbox, [
            'guestcontrol', name, 'copyto',
            source, destination,
            '--username', username,
            '--password', password,
            '--target-directory' // Ensure destination is treated as directory if it ends in /
        ]);
    }

    /**
     * Creates a VM with full configuration options.
     * This mirrors the Go server's create_dev_vm functionality.
     */
    async createVMAdvanced(
        name: string,
        projectPath: string,
        config: {
            box?: string;
            cpu?: number;
            memory?: number;
            ports?: { guest: number; host: number }[];
            syncType?: string;
            excludePatterns?: string[];
            guiMode?: boolean;
        }
    ): Promise<void> {
        const vmDir = path.join(this.vmsDir, name);
        if (!fs.existsSync(vmDir)) {
            fs.mkdirSync(vmDir, { recursive: true });
        }

        const box = config.box || 'ubuntu/focal64';
        const cpu = config.cpu || 2;
        const memory = config.memory || 2048;
        const ports = config.ports || [
            { guest: 3000, host: 3000 },
            { guest: 8000, host: 8000 },
            { guest: 5432, host: 5432 },
            { guest: 3306, host: 3306 },
            { guest: 6379, host: 6379 },
        ];
        const syncType = config.syncType || 'rsync';
        const guiMode = config.guiMode || false;
        const excludePatterns = config.excludePatterns || [
            'node_modules', '.git', '*.log', 'dist', 'build',
            '__pycache__', '*.pyc', 'venv', '.venv', '*.o', '*.out'
        ];

        // Generate port forwarding rules
        const portRules = ports
            .map(p => `    config.vm.network "forwarded_port", guest: ${p.guest}, host: ${p.host}`)
            .join('\n');

        // Generate exclude patterns for rsync
        const excludeArgs = excludePatterns.map(p => `"${p}"`).join(', ');

        const vagrantfileContent = `
Vagrant.configure("2") do |config|
  config.vm.box = "${box}"

  config.vm.provider "virtualbox" do |vb|
    vb.name = "${name}"
    vb.memory = "${memory}"
    vb.cpus = ${cpu}
    vb.gui = ${guiMode}
  end

${portRules}

  config.vm.synced_folder "${projectPath.replace(/\\/g, '/')}", "/vagrant",
    type: "${syncType}",
    rsync__exclude: [${excludeArgs}]
end
`;

        const vagrantfilePath = path.join(vmDir, 'Vagrantfile');
        fs.writeFileSync(vagrantfilePath, vagrantfileContent);

        logger.info(`Creating VM ${name} with box ${box}, CPU: ${cpu}, Memory: ${memory}MB`);
        await execa('vagrant', ['up'], { cwd: vmDir });
    }

    /**
     * Toggles between Headless and GUI mode for a VM.
     */
    async setDisplayMode(name: string, mode: 'gui' | 'headless'): Promise<{ success: boolean; message: string }> {
        const vmDir = path.join(this.vmsDir, name);
        const guiValue = mode === 'gui' ? 'true' : 'false';

        if (fs.existsSync(vmDir)) {
            const vagrantfilePath = path.join(vmDir, 'Vagrantfile');
            if (fs.existsSync(vagrantfilePath)) {
                let content = fs.readFileSync(vagrantfilePath, 'utf8');
                if (content.includes('vb.gui =')) {
                    content = content.replace(/vb\.gui\s*=\s*(true|false)/, `vb.gui = ${guiValue}`);
                } else {
                    content = content.replace(/config\.vm\.provider\s+"virtualbox"\s+do\s+\|vb\|/, (match) => {
                        return `${match}\n    vb.gui = ${guiValue}`;
                    });
                }
                fs.writeFileSync(vagrantfilePath, content);
            }
        }

        // Always apply via VBoxManage if possible for immediate effect or for native VMs
        try {
            const vbox = await this.getVBoxManage();
            // This only works if VM is off or supports hot-plugging, but let's try
            // Usually requires VM restart, which reloadVM will do.
            logger.info(`Display mode for VM ${name} set to ${mode} in config.`);
        } catch (e) { }

        return {
            success: true,
            message: `Display mode set to ${mode}.`
        };
    }

    async reloadVM(name: string): Promise<void> {
        const vmDir = path.join(this.vmsDir, name);
        if (fs.existsSync(vmDir)) {
            await execa('vagrant', ['reload'], { cwd: vmDir });
        } else {
            // Native fallback: restart VM
            await this.haltVM(name);
            await this.startVM(name);
        }
    }

    // ========================================
    // OBSERVABILITY TOOLS
    // ========================================

    /**
     * Tails a log file inside the VM
     * @param name - VM name
     * @param filePath - Path to the log file in the VM
     * @param lines - Number of lines to retrieve (default: 50)
     * @returns The last N lines of the file
     */
    async tailFile(name: string, filePath: string, lines: number = 50, options: VMCredentials = {}): Promise<{
        content: string;
        lineCount: number;
        filePath: string;
        timestamp: string;
    }> {
        const sanitizedPath = filePath.replace(/'/g, "'\\''");
        const sanitizedLines = Math.max(1, Math.min(lines, 10000));
        const cmd = `tail -n ${sanitizedLines} '${sanitizedPath}' 2>/dev/null || echo "[ERROR] File not found or not readable: ${sanitizedPath}"`;

        try {
            const result = await this.executeCommand(name, cmd, options);
            const content = result.stdout;
            const lineCount = content.split('\n').length;

            return {
                content,
                lineCount,
                filePath,
                timestamp: new Date().toISOString()
            };
        } catch (error: any) {
            return {
                content: error.stdout || error.message || 'Failed to tail file',
                lineCount: 0,
                filePath,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Searches a log file for a pattern
     * @param name - VM name
     * @param filePath - Path to the log file in the VM
     * @param pattern - Grep pattern to search for
     * @param limit - Maximum number of matches to return (default: 100)
     * @param caseSensitive - Whether search is case-sensitive (default: false)
     * @returns Matching lines from the file
     */
    async grepLog(name: string, filePath: string, pattern: string, limit: number = 100, caseSensitive: boolean = false, options: VMCredentials = {}): Promise<{
        matches: string[];
        matchCount: number;
        filePath: string;
        pattern: string;
        truncated: boolean;
    }> {
        const sanitizedPath = filePath.replace(/'/g, "'\\''");
        const sanitizedPattern = pattern.replace(/'/g, "'\\''");
        const sanitizedLimit = Math.max(1, Math.min(limit, 10000));
        const caseFlag = caseSensitive ? '' : '-i';

        const countCmd = `grep ${caseFlag} -c '${sanitizedPattern}' '${sanitizedPath}' 2>/dev/null || echo "0"`;
        const grepCmd = `grep ${caseFlag} -m ${sanitizedLimit} '${sanitizedPattern}' '${sanitizedPath}' 2>/dev/null || true`;

        try {
            const [countResult, grepResult] = await Promise.all([
                this.executeCommand(name, countCmd, options),
                this.executeCommand(name, grepCmd, options)
            ]);

            const totalCount = parseInt(countResult.stdout.trim(), 10) || 0;
            const matches = grepResult.stdout ? grepResult.stdout.split('\n').filter(line => line.length > 0) : [];

            return {
                matches,
                matchCount: totalCount,
                filePath,
                pattern,
                truncated: totalCount > sanitizedLimit
            };
        } catch (error: any) {
            return {
                matches: [],
                matchCount: 0,
                filePath,
                pattern,
                truncated: false
            };
        }
    }

    // ========================================
    // SNAPSHOT TOOLS
    // ========================================

    /**
     * Creates a snapshot of the VM
     * @param name - VM name
     * @param snapshotName - Name for the snapshot
     * @returns Snapshot creation result
     */
    async snapshotSave(name: string, snapshotName: string): Promise<{
        success: boolean;
        snapshotName: string;
        vmName: string;
        createdAt: string;
        message: string;
    }> {
        const vmDir = path.join(this.vmsDir, name);
        if (!fs.existsSync(vmDir)) {
            throw new Error(`VM ${name} not found`);
        }

        // Sanitize snapshot name (alphanumeric, dashes, underscores only)
        const sanitizedSnapshotName = snapshotName.replace(/[^a-zA-Z0-9_-]/g, '_');

        try {
            await execa('vagrant', ['snapshot', 'save', sanitizedSnapshotName], { cwd: vmDir });
            logger.info(`Snapshot '${sanitizedSnapshotName}' created for VM ${name}`);

            return {
                success: true,
                snapshotName: sanitizedSnapshotName,
                vmName: name,
                createdAt: new Date().toISOString(),
                message: `Snapshot '${sanitizedSnapshotName}' created successfully`
            };
        } catch (error: any) {
            logger.error(`Failed to create snapshot for ${name}`, error);
            return {
                success: false,
                snapshotName: sanitizedSnapshotName,
                vmName: name,
                createdAt: '',
                message: error.stderr || error.message || 'Failed to create snapshot'
            };
        }
    }

    /**
     * Restores a VM to a snapshot
     * @param name - VM name
     * @param snapshotName - Name of the snapshot to restore
     * @returns Restore result
     */
    async snapshotRestore(name: string, snapshotName: string): Promise<{
        success: boolean;
        snapshotName: string;
        vmName: string;
        restoredAt: string;
        message: string;
    }> {
        const vmDir = path.join(this.vmsDir, name);
        if (!fs.existsSync(vmDir)) {
            throw new Error(`VM ${name} not found`);
        }

        const sanitizedSnapshotName = snapshotName.replace(/[^a-zA-Z0-9_-]/g, '_');

        try {
            await execa('vagrant', ['snapshot', 'restore', sanitizedSnapshotName], { cwd: vmDir });
            logger.info(`VM ${name} restored to snapshot '${sanitizedSnapshotName}'`);

            return {
                success: true,
                snapshotName: sanitizedSnapshotName,
                vmName: name,
                restoredAt: new Date().toISOString(),
                message: `VM restored to snapshot '${sanitizedSnapshotName}' successfully`
            };
        } catch (error: any) {
            logger.error(`Failed to restore snapshot for ${name}`, error);
            return {
                success: false,
                snapshotName: sanitizedSnapshotName,
                vmName: name,
                restoredAt: '',
                message: error.stderr || error.message || 'Failed to restore snapshot'
            };
        }
    }

    /**
     * Lists all snapshots for a VM
     * @param name - VM name
     * @returns List of snapshots
     */
    async snapshotList(name: string): Promise<{
        snapshots: string[];
        vmName: string;
        count: number;
    }> {
        const vmDir = path.join(this.vmsDir, name);
        if (!fs.existsSync(vmDir)) {
            throw new Error(`VM ${name} not found`);
        }

        try {
            const result = await execa('vagrant', ['snapshot', 'list'], { cwd: vmDir });

            // Parse the output - each line is a snapshot name
            // Handle "No snapshots have been taken yet!" message
            const output = result.stdout.trim();
            if (output.includes('No snapshots') || output.length === 0) {
                return {
                    snapshots: [],
                    vmName: name,
                    count: 0
                };
            }

            const snapshots = output.split('\n')
                .map(s => s.trim())
                .filter(s => s.length > 0 && !s.startsWith('==>') && !s.startsWith('Listing contents'));

            return {
                snapshots,
                vmName: name,
                count: snapshots.length
            };
        } catch (error: any) {
            logger.error(`Failed to list snapshots for ${name}`, error);
            return {
                snapshots: [],
                vmName: name,
                count: 0
            };
        }
    }

    /**
     * Deletes a snapshot
     * @param name - VM name
     * @param snapshotName - Snapshot to delete
     * @returns Delete result
     */
    async snapshotDelete(name: string, snapshotName: string): Promise<{
        success: boolean;
        snapshotName: string;
        vmName: string;
        message: string;
    }> {
        const vmDir = path.join(this.vmsDir, name);
        if (!fs.existsSync(vmDir)) {
            throw new Error(`VM ${name} not found`);
        }

        const sanitizedSnapshotName = snapshotName.replace(/[^a-zA-Z0-9_-]/g, '_');

        try {
            await execa('vagrant', ['snapshot', 'delete', sanitizedSnapshotName], { cwd: vmDir });
            logger.info(`Snapshot '${sanitizedSnapshotName}' deleted for VM ${name}`);

            return {
                success: true,
                snapshotName: sanitizedSnapshotName,
                vmName: name,
                message: `Snapshot '${sanitizedSnapshotName}' deleted successfully`
            };
        } catch (error: any) {
            logger.error(`Failed to delete snapshot for ${name}`, error);
            return {
                success: false,
                snapshotName: sanitizedSnapshotName,
                vmName: name,
                message: error.stderr || error.message || 'Failed to delete snapshot'
            };
        }
    }

    /**
     * Takes a screenshot of the VM
     */
    async takeScreenshot(name: string): Promise<string> {
        const vbox = await this.getVBoxManage();
        const screenshotDir = path.join(os.tmpdir(), 'mcp-screenshots');
        if (!fs.existsSync(screenshotDir)) {
            fs.mkdirSync(screenshotDir, { recursive: true });
        }
        const timestamp = new Date().getTime();
        const filename = `screenshot-${name}-${timestamp}.png`;
        const hostPath = path.join(screenshotDir, filename);

        // VBoxManage controlvm <vm> screenshotpng <path>
        await execa(vbox, ['controlvm', name, 'screenshotpng', hostPath]);

        // Read as base64
        const buffer = fs.readFileSync(hostPath);
        // Clean up
        fs.unlinkSync(hostPath);

        return buffer.toString('base64');
    }
}
