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

    async destroyVM(name: string): Promise<void> {
        const vmDir = path.join(this.vmsDir, name);
        if (fs.existsSync(vmDir)) {
            await execa('vagrant', ['destroy', '-f'], { cwd: vmDir });
        }
    }
}
