/**
 * MCP-Safe Logger
 * 
 * CRITICAL: All logging MUST go to stderr, not stdout.
 * The MCP protocol uses stdio transport, meaning stdout is reserved for JSON-RPC messages.
 * Any non-JSON output to stdout will corrupt the protocol stream and crash the client.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
};

// Default to 'info', can be overridden by LOG_LEVEL env var
const currentLogLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';

function shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[currentLogLevel];
}

function formatMessage(level: LogLevel, message: string, ...args: any[]): string {
    const timestamp = new Date().toISOString();
    const argsStr = args.length > 0 ? ' ' + args.map(a => JSON.stringify(a)).join(' ') : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${argsStr}`;
}

export const logger = {
    debug: (message: string, ...args: any[]) => {
        if (shouldLog('debug')) {
            console.error(formatMessage('debug', message, ...args));
        }
    },
    info: (message: string, ...args: any[]) => {
        if (shouldLog('info')) {
            console.error(formatMessage('info', message, ...args));
        }
    },
    warn: (message: string, ...args: any[]) => {
        if (shouldLog('warn')) {
            console.error(formatMessage('warn', message, ...args));
        }
    },
    error: (message: string, ...args: any[]) => {
        if (shouldLog('error')) {
            console.error(formatMessage('error', message, ...args));
        }
    }
};
