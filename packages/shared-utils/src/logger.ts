/**
 * MCP-compatible logger that writes ALL output to stderr.
 * This is critical because stdout is reserved for JSON-RPC communication
 * in the MCP stdio transport.
 * 
 * Replaced winston with direct console.error to guarantee stderr usage.
 */
export const logger = {
    info: (message: string, meta?: any) => log('info', message, meta),
    error: (message: string, meta?: any) => log('error', message, meta),
    warn: (message: string, meta?: any) => log('warn', message, meta),
    debug: (message: string, meta?: any) => log('debug', message, meta),
    level: process.env.LOG_LEVEL || 'error'
};

const levels: Record<string, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
};

function log(level: string, message: string, meta?: any) {
    const currentLevelScore = levels[logger.level] ?? 3; // Default to error
    const messageLevelScore = levels[level] ?? 1;

    if (messageLevelScore < currentLevelScore) return;

    const timestamp = new Date().toISOString();
    const logData = {
        level,
        message,
        timestamp,
        ...meta
    };

    // Explicitly write to stderr to avoid corrupting stdout
    process.stderr.write(JSON.stringify(logData) + '\n');
}

export const setLogLevel = (level: string) => {
    logger.level = level;
};
