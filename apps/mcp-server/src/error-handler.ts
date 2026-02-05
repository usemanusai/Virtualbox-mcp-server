import { logger } from "@virtualbox-mcp/shared-utils";

export interface ToolErrorResponse {
    content: { type: "text"; text: string }[];
    isError: true;
}

/**
 * Centrally handles errors from MCP tools, providing user-friendly messages
 * and suppressing internal stack traces unless necessary.
 */
export function handleToolError(toolName: string, error: any): ToolErrorResponse {
    let message = error.message || "An unknown error occurred";
    let code = "INTERNAL_ERROR";
    let suggestion = "";

    // 1. TIMEOUTS
    if (error.timedOut || error.code === 'ETIMEDOUT' || (error.stderr && error.stderr.includes('timed out'))) {
        code = "OPERATION_TIMEOUT";
        message = "The operation timed out. The VM might be slow, unresponsive, or waiting for input.";
        suggestion = "Try increasing the timeout, or check if a process is hanging inside the VM.";
    }

    // 2. VAGRANT ERRORS
    else if (message.includes("Vagrant") || (error.stderr && error.stderr.includes("Vagrant"))) {
        code = "VAGRANT_ERROR";

        if (message.includes("is not created")) {
            message = "The requested VM does not exist or is not created.";
            suggestion = "Use 'list_vms' to see available VMs, or 'create_dev_vm' to create one.";
        } else if (message.includes("running")) {
            // "VM is already running" or similar
            // Keep generic if unclear
        } else if (error.stderr) {
            // Use stderr line if available as it often has the real error
            message = `Vagrant failed: ${error.stderr.split('\n').pop()?.trim() || message}`;
        }
    }

    // 3. VM CONNECTION ERRORS
    else if (message.includes("SSH") || message.includes("connection refused") || (error.stderr && error.stderr.includes("Connection refused"))) {
        code = "CONNECTION_FAILED";
        message = "Failed to connect to the VM via SSH.";
        suggestion = "Ensure the VM is running ('get_vm_status'). If it is, try 'vagrant reload'.";
    }

    // 4. FILE NOT FOUND (Common)
    else if (message.includes("no such file") || message.includes("ENOENT")) {
        code = "FILE_NOT_FOUND";
        message = "The specified file or directory was not found.";
    }

    // Log the full error internally for debugging
    logger.error(`[${code}] Tool '${toolName}' failed:`, error);

    // Construct user-facing output
    const outputText = `Error [${code}]: ${message}${suggestion ? `\n\nTip: ${suggestion}` : ''}\n\n(Original Error: ${error.message || String(error)})`;

    return {
        content: [{ type: "text", text: outputText }],
        isError: true,
    };
}
