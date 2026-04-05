import { randomUUID } from "crypto";
import { redactSecrets } from "@virtualbox-mcp/shared-utils";
import { VagrantClient } from "@virtualbox-mcp/vagrant-client";
import { mapGuestError, type GuestErrorCode } from "./error-mapper.js";
import { utcNow } from "./json-utils.js";
import { normalizeVmState } from "./vm-state.js";
import { buildWindowsCommandLine, normalizeWindowsPath, quoteWindowsArg } from "./windows-command-builder.js";

export type GuestOsFamily = "windows" | "linux" | "unknown";
export type ShellMode = "windows" | "linux" | "none" | "auto";

export interface CommandResult {
    ok: boolean;
    exit_code: number;
    stdout: string;
    stderr: string;
    started_utc: string;
    finished_utc: string;
    duration_ms: number;
    vm_state: string;
    guest_os_family: GuestOsFamily;
    correlation_id: string;
    fallback_used?: boolean;
    fallback_method?: "console_injection";
    output_capture?: "none" | "partial" | "full";
    warning?: string;
    confidence?: "high" | "medium" | "low";
    effective_working_dir?: string;
    resolved_program?: string;
    resolved_args?: string[];
    shell_strategy?: "windows_cmd" | "windows_powershell" | "direct";
    path_normalization_applied?: boolean;
    warnings?: string[];
    debug_trace?: Record<string, any>;
    error_code?: GuestErrorCode;
}

export interface ExecGuestInput {
    vm_name: string;
    username?: string;
    password?: string;
    program?: string;
    args?: string[];
    working_dir?: string;
    env?: Record<string, string>;
    timeout_ms?: number;
    run_as_admin?: boolean;
    capture_output?: boolean;
    shell_mode?: ShellMode;
    command?: string;
    allow_fallback?: boolean;
    strict_paths?: boolean;
    allow_workdir_fallback?: boolean;
}

export function resolveProgramStrategy(osFamily: GuestOsFamily, shellMode: ShellMode, input: ExecGuestInput): { program: string; args: string[] } {
    if (shellMode === "none") {
        return { program: input.program || "", args: input.args || [] };
    }
    if (shellMode === "windows" || (shellMode === "auto" && osFamily === "windows")) {
        if (input.program && input.program.toLowerCase().includes("powershell")) {
            return { program: input.program, args: input.args || [] };
        }
        if (input.program) return { program: input.program, args: input.args || [] };
        return { program: "cmd.exe", args: ["/c", input.command || "echo"] };
    }
    if (shellMode === "linux" || (shellMode === "auto" && osFamily === "linux")) {
        if (input.program) return { program: input.program, args: input.args || [] };
        return { program: "/bin/sh", args: ["-lc", input.command || "true"] };
    }
    return { program: input.program || "", args: input.args || [] };
}

export class GuestExecutionEngine {
    constructor(private readonly vagrant: VagrantClient) { }

    async execute(input: ExecGuestInput): Promise<CommandResult> {
        const correlationId = randomUUID();
        const started = utcNow();
        const startMs = Date.now();
        const vmState = normalizeVmState(await this.vagrant.getVMStatus(input.vm_name));
        const osFamily = await this.vagrant.getGuestOSFamily(input.vm_name);
        const warnings: string[] = [];
        const debugTrace: Record<string, any> = {};
        const strictPaths = input.strict_paths !== false;
        const allowWorkdirFallback = input.allow_workdir_fallback === true;

        if (vmState !== "running") {
            const finished = utcNow();
            return {
                ok: false,
                exit_code: 1,
                stdout: "",
                stderr: `VM '${input.vm_name}' is in state '${vmState}' (must be 'running')`,
                started_utc: started,
                finished_utc: finished,
                duration_ms: Date.now() - startMs,
                vm_state: vmState,
                guest_os_family: osFamily,
                correlation_id: correlationId,
                warnings: [],
                error_code: "VM_NOT_RUNNING"
            };
        }

        const shellMode = input.shell_mode ?? "auto";
        const resolved = resolveProgramStrategy(osFamily, shellMode, input);
        let resolvedProgram = resolved.program;
        let resolvedArgs = [...resolved.args];
        let shellStrategy: "windows_cmd" | "windows_powershell" | "direct" = "direct";
        let pathNormalizationApplied = false;
        let effectiveWorkingDir = input.working_dir;

        if (osFamily === "windows") {
            const pathValidation = await this.validateWorkingDirWindows(
                input.vm_name,
                input.username,
                input.password,
                input.working_dir
            );
            if (input.working_dir && !pathValidation.exists) {
                if (!allowWorkdirFallback) {
                    return this.buildFailureResult({
                        correlationId,
                        started,
                        startMs,
                        vmState,
                        osFamily,
                        resolvedProgram,
                        resolvedArgs,
                        shellStrategy,
                        pathNormalizationApplied,
                        effectiveWorkingDir: pathValidation.normalized || input.working_dir,
                        warnings,
                        errorCode: "WORKDIR_NOT_FOUND",
                        stderr: `Working directory not found: ${input.working_dir}`,
                        extra: {
                            attempted_working_dir: input.working_dir,
                            normalized_working_dir: pathValidation.normalized || input.working_dir
                        }
                    });
                }
                warnings.push("working_dir not found; fallback allowed by caller.");
                effectiveWorkingDir = undefined;
            } else if (pathValidation.normalized) {
                effectiveWorkingDir = pathValidation.normalized;
                pathNormalizationApplied = pathValidation.changed;
            }
        }

        if (osFamily === "windows") {
            if (resolvedProgram.toLowerCase().includes("powershell")) {
                shellStrategy = "windows_powershell";
            } else if (resolvedProgram.toLowerCase().includes("cmd.exe") || input.command) {
                shellStrategy = "windows_cmd";
            }
        }

        // Enforce working directory on Windows by wrapping in cmd when needed.
        if (osFamily === "windows" && effectiveWorkingDir) {
            const mustWrap = shellStrategy !== "windows_cmd";
            if (mustWrap || strictPaths) {
                const builder = buildWindowsCommandLine(resolvedProgram, resolvedArgs, effectiveWorkingDir);
                resolvedProgram = "cmd.exe";
                resolvedArgs = ["/d", "/s", "/c", builder.commandLine];
                shellStrategy = "windows_cmd";
                pathNormalizationApplied = pathNormalizationApplied || builder.pathNormalizationApplied;
                warnings.push(...builder.warnings);
                debugTrace.argv_trace = builder.argvTrace;
            }
        } else if (osFamily === "windows" && strictPaths) {
            const builder = buildWindowsCommandLine(resolvedProgram, resolvedArgs);
            resolvedProgram = "cmd.exe";
            resolvedArgs = ["/d", "/s", "/c", builder.commandLine];
            shellStrategy = "windows_cmd";
            pathNormalizationApplied = builder.pathNormalizationApplied;
            warnings.push(...builder.warnings);
            debugTrace.argv_trace = builder.argvTrace;
        }

        if (osFamily === "windows" && strictPaths && this.hasLikelyUnescapedPathError(resolvedArgs)) {
            warnings.push("Command contains windows path tokens that may require explicit quoting.");
        }

        warnings.sort();

        try {
            const result = await this.vagrant.executeGuestProgram(input.vm_name, resolvedProgram, resolvedArgs, {
                username: input.username,
                password: input.password,
                timeout: input.timeout_ms,
                env: input.env,
                workingDir: effectiveWorkingDir,
                captureOutput: input.capture_output !== false,
                runAsAdmin: !!input.run_as_admin
            });

            const response: CommandResult = {
                ok: result.exitCode === 0,
                exit_code: result.exitCode,
                stdout: result.stdout || "",
                stderr: result.stderr || "",
                started_utc: started,
                finished_utc: utcNow(),
                duration_ms: Date.now() - startMs,
                vm_state: vmState,
                guest_os_family: osFamily,
                correlation_id: correlationId,
                effective_working_dir: effectiveWorkingDir,
                resolved_program: resolvedProgram,
                resolved_args: resolvedArgs,
                shell_strategy: shellStrategy,
                path_normalization_applied: pathNormalizationApplied,
                warnings
            };

            if (process.env.MCP_EXEC_DEBUG === "1") {
                response.debug_trace = redactSecrets({
                    correlation_id: correlationId,
                    shell_mode: shellMode,
                    shell_strategy: shellStrategy,
                    resolved_program: resolvedProgram,
                    resolved_args: resolvedArgs,
                    path_normalization_applied: pathNormalizationApplied,
                    warnings
                });
            }

            return response;
        } catch (error: any) {
            if (input.allow_fallback) {
                await this.vagrant.sendKeystrokes(input.vm_name, `${resolvedProgram} ${resolvedArgs.join(" ")}<Enter>`);
                return {
                    ok: false,
                    exit_code: 1,
                    stdout: "",
                    stderr: "Primary guest execution failed; command injected via console.",
                    started_utc: started,
                    finished_utc: utcNow(),
                    duration_ms: Date.now() - startMs,
                    vm_state: vmState,
                    guest_os_family: osFamily,
                    correlation_id: correlationId,
                    fallback_used: true,
                    fallback_method: "console_injection",
                    output_capture: "none",
                    warning: "Console injection cannot guarantee deterministic stdout/stderr.",
                    confidence: "low",
                    effective_working_dir: effectiveWorkingDir,
                    resolved_program: resolvedProgram,
                    resolved_args: resolvedArgs,
                    shell_strategy: shellStrategy,
                    path_normalization_applied: pathNormalizationApplied,
                    warnings,
                    error_code: mapGuestError(error),
                    debug_trace: process.env.MCP_EXEC_DEBUG === "1"
                        ? redactSecrets({
                            correlation_id: correlationId,
                            fallback: "console_injection",
                            shell_strategy: shellStrategy,
                            resolved_program: resolvedProgram,
                            resolved_args: resolvedArgs
                        })
                        : undefined
                };
            }
            return this.buildFailureResult({
                correlationId,
                started,
                startMs,
                vmState,
                osFamily,
                resolvedProgram,
                resolvedArgs,
                shellStrategy,
                pathNormalizationApplied,
                effectiveWorkingDir,
                warnings,
                errorCode: mapGuestError(error),
                stdout: error?.stdout || "",
                stderr: error?.stderr || error?.message || "Execution failed."
            });
        }
    }

    async resolveGuestPath(input: {
        vm_name: string;
        path: string;
        username?: string;
        password?: string;
    }): Promise<{
        ok: boolean;
        original: string;
        normalized: string;
        exists: boolean;
        is_dir: boolean;
        is_file: boolean;
    }> {
        const osFamily = await this.vagrant.getGuestOSFamily(input.vm_name);
        if (osFamily === "windows") {
            const norm = normalizeWindowsPath(input.path);
            const ps = `$p='${norm.normalized.replace(/'/g, "''")}'; if (Test-Path -LiteralPath $p) { $i=Get-Item -LiteralPath $p; Write-Output "1|$($i.PSIsContainer)|$($i -is [System.IO.FileInfo])" } else { Write-Output "0|false|false" }`;
            const res = await this.vagrant.executeGuestProgram(input.vm_name, "powershell.exe", ["-NoProfile", "-Command", ps], {
                username: input.username,
                password: input.password,
                captureOutput: true
            });
            const [exists, isDir, isFile] = (res.stdout || "0|false|false").trim().split("|");
            return {
                ok: res.exitCode === 0,
                original: input.path,
                normalized: norm.normalized,
                exists: exists === "1",
                is_dir: `${isDir}`.toLowerCase() === "true",
                is_file: `${isFile}`.toLowerCase() === "true"
            };
        }

        const escaped = input.path.replace(/'/g, "'\\''");
        const cmd = `[ -e '${escaped}' ] && { [ -d '${escaped}' ] && echo "1|true|false" || echo "1|false|true"; } || echo "0|false|false"`;
        const res = await this.vagrant.executeGuestProgram(input.vm_name, "/bin/sh", ["-lc", cmd], {
            username: input.username,
            password: input.password,
            captureOutput: true
        });
        const [exists, isDir, isFile] = (res.stdout || "0|false|false").trim().split("|");
        return {
            ok: res.exitCode === 0,
            original: input.path,
            normalized: input.path,
            exists: exists === "1",
            is_dir: `${isDir}`.toLowerCase() === "true",
            is_file: `${isFile}`.toLowerCase() === "true"
        };
    }

    private async validateWorkingDirWindows(
        vmName: string,
        username: string | undefined,
        password: string | undefined,
        workingDir: string | undefined
    ): Promise<{ exists: boolean; normalized?: string; changed: boolean }> {
        if (!workingDir) return { exists: true, changed: false };
        const normalized = normalizeWindowsPath(workingDir);
        const ps = `$p='${normalized.normalized.replace(/'/g, "''")}'; if (Test-Path -LiteralPath $p -PathType Container) { $r=(Resolve-Path -LiteralPath $p).Path; Write-Output "1|$r" } else { Write-Output "0|$p" }`;
        const result = await this.vagrant.executeGuestProgram(vmName, "powershell.exe", ["-NoProfile", "-Command", ps], {
            username,
            password,
            captureOutput: true
        });
        const out = (result.stdout || "").trim();
        const [exists, resolved] = out.split("|");
        return {
            exists: exists === "1",
            normalized: resolved || normalized.normalized,
            changed: normalized.changed
        };
    }

    private hasLikelyUnescapedPathError(args: string[]): boolean {
        return args.some(a => /[A-Za-z]:\\[^"]+\s+[^"]+/.test(a));
    }

    private buildFailureResult(params: {
        correlationId: string;
        started: string;
        startMs: number;
        vmState: string;
        osFamily: GuestOsFamily;
        resolvedProgram: string;
        resolvedArgs: string[];
        shellStrategy: "windows_cmd" | "windows_powershell" | "direct";
        pathNormalizationApplied: boolean;
        effectiveWorkingDir?: string;
        warnings: string[];
        errorCode: GuestErrorCode;
        stderr: string;
        stdout?: string;
        extra?: Record<string, any>;
    }): CommandResult {
        const result: CommandResult = {
            ok: false,
            exit_code: 1,
            stdout: params.stdout || "",
            stderr: params.stderr,
            started_utc: params.started,
            finished_utc: utcNow(),
            duration_ms: Date.now() - params.startMs,
            vm_state: params.vmState,
            guest_os_family: params.osFamily,
            correlation_id: params.correlationId,
            effective_working_dir: params.effectiveWorkingDir,
            resolved_program: params.resolvedProgram,
            resolved_args: params.resolvedArgs,
            shell_strategy: params.shellStrategy,
            path_normalization_applied: params.pathNormalizationApplied,
            warnings: params.warnings.sort(),
            error_code: params.errorCode
        };
        if (process.env.MCP_EXEC_DEBUG === "1") {
            result.debug_trace = redactSecrets({
                correlation_id: params.correlationId,
                shell_strategy: params.shellStrategy,
                resolved_program: params.resolvedProgram,
                resolved_args: params.resolvedArgs,
                effective_working_dir: params.effectiveWorkingDir,
                ...params.extra
            });
        }
        return result;
    }

}
