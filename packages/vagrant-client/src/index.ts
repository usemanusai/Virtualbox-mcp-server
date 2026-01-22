import { execa } from 'execa';
import { logger } from '@virtualbox-mcp/shared-utils';
import { z } from 'zod';
import * as path from 'path';
import * as fs from 'fs';

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
    directory: string;
}

export class VagrantClient {
    private vmsDir: string;

    constructor(vmsDir?: string) {
        this.vmsDir = vmsDir || path.join(process.env.HOME || process.cwd(), '.vagrant-mcp', 'vms');
        if (!fs.existsSync(this.vmsDir)) {
            fs.mkdirSync(this.vmsDir, { recursive: true });
        }
    }

    async getVMStatus(name: string): Promise<VMStatus> {
        const vmDir = path.join(this.vmsDir, name);
        if (!fs.existsSync(vmDir)) return 'not_created';

        try {
            const { stdout } = await execa('vagrant', ['status', '--machine-readable'], { cwd: vmDir });
            const lines = stdout.split('\n');
            for (const line of lines) {
                const parts = line.split(',');
                if (parts.length >= 4 && parts[2] === 'state') {
                    const state = parts[3].trim(); // Trim whitespace/CRLF
                    // Map vagrant state to VMStatus
                    if (state === 'running') return 'running';
                    if (state === 'poweroff') return 'poweroff';
                    if (state === 'aborted') return 'aborted';
                    if (state === 'saved') return 'saved';
                    if (state === 'not_created') return 'not_created';
                }
            }
            return 'unknown';
        } catch (error) {
            // If directory exists but vagrant fails, it might be effectively not_created or broken
            logger.error(`Failed to get status for ${name}`, error);
            return 'unknown';
        }
    }

    async listVMs(): Promise<{ name: string; state: VMStatus }[]> {
        if (!fs.existsSync(this.vmsDir)) return [];

        const vms: { name: string; state: VMStatus }[] = [];
        const entries = fs.readdirSync(this.vmsDir, { withFileTypes: true });

        for (const entry of entries) {
            if (entry.isDirectory()) {
                const status = await this.getVMStatus(entry.name);
                vms.push({ name: entry.name, state: status });
            }
        }
        return vms;
    }

    async executeCommand(name: string, command: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
        const vmDir = path.join(this.vmsDir, name);
        if (!fs.existsSync(vmDir)) {
            throw new Error(`VM ${name} not found`);
        }

        try {
            // Use vagrant ssh -c to execute command
            const result = await execa('vagrant', ['ssh', '-c', command], { cwd: vmDir });
            return {
                stdout: result.stdout,
                stderr: result.stderr,
                exitCode: result.exitCode
            };
        } catch (error: any) {
            // execa throws on non-zero exit code
            return {
                stdout: error.stdout || '',
                stderr: error.stderr || '',
                exitCode: error.exitCode || 1
            };
        }
    }

    async uploadFile(name: string, source: string, destination: string): Promise<void> {
        const vmDir = path.join(this.vmsDir, name);
        if (!fs.existsSync(vmDir)) {
            throw new Error(`VM ${name} not found`);
        }

        // vagrant upload source [destination] [name|id]
        await execa('vagrant', ['upload', source, destination], { cwd: vmDir });
    }

    async createVM(name: string, box: string = 'ubuntu/focal64'): Promise<void> {
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
        }
    }

    async startVM(name: string): Promise<void> {
        const vmDir = path.join(this.vmsDir, name);
        if (!fs.existsSync(vmDir)) {
            throw new Error(`VM ${name} not found`);
        }
        await execa('vagrant', ['up'], { cwd: vmDir });
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
}

