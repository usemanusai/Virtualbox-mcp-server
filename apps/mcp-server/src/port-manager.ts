import { execa } from 'execa';
import { logger } from '@virtualbox-mcp/shared-utils';

export async function ensurePortFree(port: number) {
    const platform = process.platform;

    try {
        if (platform === 'win32') {
            const { stdout } = await execa('netstat', ['-ano']);
            const lines = stdout.split('\n');
            const portLine = lines.find(line => line.includes(`:${port}`));

            if (portLine) {
                const parts = portLine.trim().split(/\s+/);
                const pid = parts[parts.length - 1]; // PID is the last column
                if (pid) {
                    logger.warn(`Port ${port} is in use by PID ${pid}. Killing it...`);
                    await execa('taskkill', ['/F', '/PID', pid]);
                }
            }
        } else {
            // Linux/macOS
            try {
                const { stdout } = await execa('lsof', ['-i', `:${port}`, '-t']);
                if (stdout) {
                    const pids = stdout.split('\n').filter(Boolean);
                    for (const pid of pids) {
                        logger.warn(`Port ${port} is in use by PID ${pid}. Killing it...`);
                        await execa('kill', ['-9', pid]);
                    }
                }
            } catch (e: any) {
                // lsof returns exit code 1 if no process found, which is fine
                if (e.exitCode !== 1) throw e;
            }
        }
    } catch (error) {
        logger.error(`Failed to ensure port ${port} is free`, error);
        // Don't crash, just log. Setup might fail later if port is actually blocked.
    }
}
