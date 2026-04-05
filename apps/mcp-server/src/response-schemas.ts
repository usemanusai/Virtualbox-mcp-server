import { z } from "zod";

export const ExecGuestResponseSchema = z.object({
    ok: z.boolean(),
    exit_code: z.number(),
    stdout: z.string(),
    stderr: z.string(),
    started_utc: z.string(),
    finished_utc: z.string(),
    duration_ms: z.number(),
    vm_state: z.string(),
    guest_os_family: z.string(),
    correlation_id: z.string(),
    fallback_used: z.boolean().optional(),
    fallback_method: z.string().optional(),
    output_capture: z.string().optional(),
    warning: z.string().optional(),
    confidence: z.enum(["high", "medium", "low"]).optional(),
    effective_working_dir: z.string().optional(),
    resolved_program: z.string().optional(),
    resolved_args: z.array(z.string()).optional(),
    shell_strategy: z.enum(["windows_cmd", "windows_powershell", "direct"]).optional(),
    path_normalization_applied: z.boolean().optional(),
    warnings: z.array(z.string()).optional(),
    debug_trace: z.record(z.any()).optional(),
    error_code: z.string().optional(),
    timestamp_utc: z.string().optional()
});

export const VmStatusResponseSchema = z.object({
    name: z.string(),
    state: z.enum(["powered_off", "saved", "running", "paused", "unknown"]),
    observed_at_utc: z.string().optional(),
    timestamp_utc: z.string().optional()
});

export function validateResponse<T>(schema: z.ZodSchema<T>, payload: unknown): T {
    return schema.parse(payload);
}
