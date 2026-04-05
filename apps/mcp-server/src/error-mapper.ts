export type GuestErrorCode =
    | "VM_NOT_FOUND"
    | "VM_NOT_RUNNING"
    | "AUTH_FAILED"
    | "ACCOUNT_LOCKED"
    | "UAC_RESTRICTED"
    | "GUEST_ADDITIONS_NOT_READY"
    | "GUEST_CONTROL_UNAVAILABLE"
    | "GUESTCONTROL_UNAVAILABLE"
    | "PERMISSION_DENIED"
    | "WORKDIR_NOT_FOUND"
    | "INVALID_WORKDIR"
    | "PATH_SYNTAX_ERROR"
    | "ARG_QUOTING_ERROR"
    | "UNC_PATH_ERROR"
    | "SESSION_CREATE_FAILED"
    | "PROCESS_START_FAILED"
    | "PROCESS_TIMEOUT"
    | "SESSION_TIMEOUT"
    | "OUTPUT_LIMIT_REACHED"
    | "TIMEOUT"
    | "UNKNOWN_INTERNAL"
    | "INTERNAL_ERROR";

export function mapGuestError(error: any): GuestErrorCode {
    const msg = `${error?.message || ""} ${error?.stderr || ""}`.toLowerCase();
    if (msg.includes("account") && msg.includes("locked")) return "ACCOUNT_LOCKED";
    if (msg.includes("uac") || msg.includes("elevation required")) return "UAC_RESTRICTED";
    if (error?.timedOut || msg.includes("timed out")) return "PROCESS_TIMEOUT";
    if (msg.includes("working directory not found") || msg.includes("workdir_not_found")) return "WORKDIR_NOT_FOUND";
    if (msg.includes("invalid working directory") || msg.includes("invalid_workdir")) return "INVALID_WORKDIR";
    if (msg.includes("unc") && msg.includes("path")) return "UNC_PATH_ERROR";
    if (msg.includes("filename, directory name, or volume label syntax is incorrect")) return "PATH_SYNTAX_ERROR";
    if (msg.includes("invalid argument") && msg.includes("quote")) return "ARG_QUOTING_ERROR";
    if (msg.includes("not found")) return "VM_NOT_FOUND";
    if (msg.includes("must be 'running'") || msg.includes("not running")) return "VM_NOT_RUNNING";
    if (msg.includes("access denied") || msg.includes("permission denied")) return "PERMISSION_DENIED";
    if (msg.includes("logon failure") || msg.includes("invalid username") || msg.includes("invalid password") || msg.includes("authentication")) {
        return "AUTH_FAILED";
    }
    if (msg.includes("guest additions") || msg.includes("vbox_e_iprt_error")) return "GUEST_ADDITIONS_NOT_READY";
    if (msg.includes("guest control") || msg.includes("vbox_e_vm_error")) return "GUESTCONTROL_UNAVAILABLE";
    return "UNKNOWN_INTERNAL";
}
