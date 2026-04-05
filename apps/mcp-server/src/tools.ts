import { z } from "zod";

export const CreateVMSchema = z.object({
    name: z.string(),
    box: z.string().optional(),
    gui_mode: z.boolean().optional(),
});

export const GetVMStatusSchema = z.object({
    name: z.string(),
});

export const ResizeVMResourcesSchema = z.object({
    vm_name: z.string(),
    cpu: z.number().optional(),
    memory: z.number().optional(),
    gui_mode: z.boolean().optional(),
});

export const TOOLS = [
    {
        name: "create_vm",
        description: "Create a new Vagrant VM",
        inputSchema: {
            type: "object",
            properties: {
                name: { type: "string" },
                box: { type: "string" },
                gui_mode: { type: "boolean", description: "Enable GUI mode for the VM" },
            },
            required: ["name"],
        },
    },
    {
        name: "get_vm_status",
        description: "Get the status of a specific Vagrant VM",
        inputSchema: {
            type: "object",
            properties: {
                name: { type: "string" },
            },
            required: ["name"],
        },
    },
    {
        name: "list_vms",
        description: "List all managed VMs and their statuses",
        inputSchema: {
            type: "object",
            properties: {},
        },
    },
    {
        name: "destroy_vm",
        description: "Destroy a Vagrant VM (force)",
        inputSchema: {
            type: "object",
            properties: {
                name: { type: "string" },
            },
            required: ["name"],
        },
    },
    {
        name: "exec_command",
        description: "Execute a shell command inside a VM",
        inputSchema: {
            type: "object",
            properties: {
                vm_name: { type: "string" },
                command: { type: "string" },
                timeout: { type: "number", description: "Timeout in milliseconds (default: 60000)" },
                username: { type: "string" },
                password: { type: "string" },
                use_console_injection: { type: "boolean", description: "Type command into console (blind execution) if standard methods fail." }
            },
            required: ["vm_name", "command"],
        },
    },
    {
        name: "exec_guest_command",
        description: "Execute a guest program (compat mode). Routes to v2 execution engine unless MCP_STRICT_EXEC_V2=0.",
        inputSchema: {
            type: "object",
            properties: {
                vm_name: { type: "string" },
                username: { type: "string" },
                password: { type: "string" },
                program: { type: "string" },
                args: { type: "array", items: { type: "string" } },
                working_dir: { type: "string" },
                env: { type: "object", additionalProperties: { type: "string" } },
                timeout_ms: { type: "number" },
                run_as_admin: { type: "boolean" },
                capture_output: { type: "boolean" },
                strict_paths: { type: "boolean" },
                allow_workdir_fallback: { type: "boolean" },
                shell_mode: { type: "string", enum: ["windows", "linux", "none", "auto"] }
            },
            required: ["vm_name"]
        }
    },
    {
        name: "exec_guest_command_v2",
        description: "Strict, deterministic guest execution for forensic workflows with explicit path/workdir semantics.",
        inputSchema: {
            type: "object",
            properties: {
                vm_name: { type: "string" },
                username: { type: "string" },
                password: { type: "string" },
                program: { type: "string" },
                args: { type: "array", items: { type: "string" } },
                working_dir: { type: "string" },
                env: { type: "object", additionalProperties: { type: "string" } },
                timeout_ms: { type: "number" },
                run_as_admin: { type: "boolean" },
                capture_output: { type: "boolean" },
                strict_paths: { type: "boolean", default: true },
                allow_workdir_fallback: { type: "boolean", default: false },
                shell_mode: { type: "string", enum: ["windows", "linux", "none", "auto"] }
            },
            required: ["vm_name"]
        }
    },
    {
        name: "resolve_guest_path",
        description: "Resolve and validate a guest path with normalized output before execution.",
        inputSchema: {
            type: "object",
            properties: {
                vm_name: { type: "string" },
                path: { type: "string" },
                username: { type: "string" },
                password: { type: "string" }
            },
            required: ["vm_name", "path"]
        }
    },
    {
        name: "test_guest_auth",
        description: "Diagnose guest authentication and guest control readiness with strict error codes.",
        inputSchema: {
            type: "object",
            properties: {
                vm_name: { type: "string" },
                username: { type: "string" },
                password: { type: "string" },
                timeout_ms: { type: "number" }
            },
            required: ["vm_name", "username", "password"]
        }
    },
    {
        name: "validate_guest_session",
        description: "Validate guest auth/session readiness with structured diagnostics.",
        inputSchema: {
            type: "object",
            properties: {
                vm_name: { type: "string" },
                username: { type: "string" },
                password: { type: "string" },
                timeout_ms: { type: "number", default: 30000 }
            },
            required: ["vm_name", "username", "password"]
        }
    },
    {
        name: "exec_command_v3",
        description: "Unified deterministic guest execution with timeout phases and fallback mode.",
        inputSchema: {
            type: "object",
            properties: {
                vm_name: { type: "string" },
                username: { type: "string" },
                password: { type: "string" },
                shell: { type: "string", enum: ["cmd", "powershell", "none"], default: "none" },
                program: { type: "string" },
                args: { type: "array", items: { type: "string" } },
                command: { type: "string" },
                working_dir: { type: "string" },
                env: { type: "object", additionalProperties: { type: "string" } },
                capture_output: { type: "boolean", default: true },
                timeout_ms: { type: "number", default: 120000 },
                fallback_mode: { type: "string", enum: ["none", "console_injection", "auto"], default: "none" },
                max_output_bytes: { type: "number", default: 1048576 }
            },
            required: ["vm_name"]
        }
    },
    {
        name: "cancel_exec",
        description: "Cancel a running exec_command_v3 operation by operation_id.",
        inputSchema: {
            type: "object",
            properties: {
                operation_id: { type: "string" }
            },
            required: ["operation_id"]
        }
    },
    {
        name: "probe_path",
        description: "Probe guest path existence/readability/writability in one call.",
        inputSchema: {
            type: "object",
            properties: {
                vm_name: { type: "string" },
                username: { type: "string" },
                password: { type: "string" },
                path: { type: "string" }
            },
            required: ["vm_name", "path", "username", "password"]
        }
    },
    {
        name: "list_shared_folders",
        description: "List VM shared folders with host paths and guest mount candidates.",
        inputSchema: {
            type: "object",
            properties: {
                vm_name: { type: "string" }
            },
            required: ["vm_name"]
        }
    },
    {
        name: "list_guest_users",
        description: "List guest users and lock/enabled/password-required status.",
        inputSchema: {
            type: "object",
            properties: {
                vm_name: { type: "string" },
                username: { type: "string" },
                password: { type: "string" },
                timeout_ms: { type: "number", default: 30000 }
            },
            required: ["vm_name"]
        }
    },
    {
        name: "guest_health_check",
        description: "Health check endpoint for guest tools, vboxservice/winlogon and session smoke test.",
        inputSchema: {
            type: "object",
            properties: {
                vm_name: { type: "string" },
                username: { type: "string" },
                password: { type: "string" },
                timeout_ms: { type: "number", default: 15000 }
            },
            required: ["vm_name"]
        }
    },
    {
        name: "normalize_path",
        description: "Normalize and validate guest paths (Windows-safe).",
        inputSchema: {
            type: "object",
            properties: {
                vm_name: { type: "string" },
                input_path: { type: "string" },
                resolve_mode: { type: "string", enum: ["strict", "best_effort"], default: "strict" },
                allow_8dot3_fallback: { type: "boolean", default: true },
                username: { type: "string" },
                password: { type: "string" },
                request_id: { type: "string" },
                timeout_ms: { type: "number" },
                dry_run: { type: "boolean" }
            },
            required: ["vm_name", "input_path"]
        }
    },
    {
        name: "build_command",
        description: "Build safe shell command with quoting/escaping strategy.",
        inputSchema: {
            type: "object",
            properties: {
                shell: { type: "string", enum: ["cmd", "powershell", "bash"] },
                program: { type: "string" },
                args: { type: "array", items: { type: "string" } },
                cwd: { type: "string" },
                request_id: { type: "string" },
                timeout_ms: { type: "number" },
                dry_run: { type: "boolean" }
            },
            required: ["shell", "program"]
        }
    },
    {
        name: "preflight_check",
        description: "Run execution preflight checks before command execution.",
        inputSchema: {
            type: "object",
            properties: {
                vm_name: { type: "string" },
                username: { type: "string" },
                password: { type: "string" },
                checks: { type: "array", items: { type: "string" } },
                request_id: { type: "string" },
                timeout_ms: { type: "number" },
                dry_run: { type: "boolean" }
            },
            required: ["vm_name", "checks"]
        }
    },
    {
        name: "exec_deterministic",
        description: "Execute command with deterministic context for forensics workflows.",
        inputSchema: {
            type: "object",
            properties: {
                vm_name: { type: "string" },
                username: { type: "string" },
                password: { type: "string" },
                program: { type: "string" },
                args: { type: "array", items: { type: "string" } },
                cwd: { type: "string" },
                deterministic_context: {
                    type: "object",
                    properties: {
                        fixed_utc: { type: "string" },
                        tz: { type: "string" },
                        random_seed: { type: "number" },
                        locale: { type: "string" }
                    }
                },
                request_id: { type: "string" },
                timeout_ms: { type: "number" },
                dry_run: { type: "boolean" }
            },
            required: ["vm_name", "program"]
        }
    },
    {
        name: "exec_resilient",
        description: "Execute with retry/session resilience and idempotency key.",
        inputSchema: {
            type: "object",
            properties: {
                vm_name: { type: "string" },
                username: { type: "string" },
                password: { type: "string" },
                program: { type: "string" },
                args: { type: "array", items: { type: "string" } },
                retry_policy: {
                    type: "object",
                    properties: {
                        max_attempts: { type: "number", default: 3 },
                        backoff_ms: { type: "number", default: 500 },
                        retry_on: { type: "array", items: { type: "string" } }
                    }
                },
                idempotency_key: { type: "string" },
                request_id: { type: "string" },
                timeout_ms: { type: "number" },
                dry_run: { type: "boolean" }
            },
            required: ["vm_name", "program", "idempotency_key"]
        }
    },
    {
        name: "get_execution_trace",
        description: "Return forensic execution trace bundle for operation_id.",
        inputSchema: {
            type: "object",
            properties: {
                operation_id: { type: "string" },
                request_id: { type: "string" },
                timeout_ms: { type: "number" },
                dry_run: { type: "boolean" }
            },
            required: ["operation_id"]
        }
    },
    {
        name: "register_artifacts",
        description: "Register generated artifacts with hashes/metadata.",
        inputSchema: {
            type: "object",
            properties: {
                vm_name: { type: "string" },
                username: { type: "string" },
                password: { type: "string" },
                operation_id: { type: "string" },
                artifacts: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            path: { type: "string" },
                            type: { type: "string" }
                        },
                        required: ["path", "type"]
                    }
                },
                request_id: { type: "string" },
                timeout_ms: { type: "number" },
                dry_run: { type: "boolean" }
            },
            required: ["vm_name", "operation_id", "artifacts"]
        }
    },
    {
        name: "set_network_profile",
        description: "Apply or verify network profile controls for the VM.",
        inputSchema: {
            type: "object",
            properties: {
                vm_name: { type: "string" },
                profile: { type: "string" },
                dns_servers: { type: "array", items: { type: "string" } },
                verify: { type: "boolean", default: true },
                request_id: { type: "string" },
                timeout_ms: { type: "number" },
                dry_run: { type: "boolean" }
            },
            required: ["vm_name", "profile"]
        }
    },
    {
        name: "run_workflow",
        description: "Run reusable end-to-end forensic workflow.",
        inputSchema: {
            type: "object",
            properties: {
                vm_name: { type: "string" },
                username: { type: "string" },
                password: { type: "string" },
                workflow_id: { type: "string" },
                inputs: { type: "object", additionalProperties: true },
                request_id: { type: "string" },
                timeout_ms: { type: "number" },
                dry_run: { type: "boolean" }
            },
            required: ["vm_name", "workflow_id", "inputs"]
        }
    },
    {
        name: "ensure_vm_running",
        description: "Non-destructive start/resume API that ensures VM reaches running state.",
        inputSchema: {
            type: "object",
            properties: {
                vm_name: { type: "string" },
                display_mode: { type: "string", enum: ["headless", "gui", "unchanged"] },
                timeout_ms: { type: "number" }
            },
            required: ["vm_name"]
        }
    },
    {
        name: "guest_file_exists",
        description: "Checks whether a file path exists inside the guest.",
        inputSchema: {
            type: "object",
            properties: {
                vm_name: { type: "string" },
                username: { type: "string" },
                password: { type: "string" },
                path: { type: "string" }
            },
            required: ["vm_name", "path", "username", "password"]
        }
    },
    {
        name: "guest_list_dir",
        description: "Lists directory entries from the guest path.",
        inputSchema: {
            type: "object",
            properties: {
                vm_name: { type: "string" },
                username: { type: "string" },
                password: { type: "string" },
                path: { type: "string" }
            },
            required: ["vm_name", "path", "username", "password"]
        }
    },
    {
        name: "guest_read_file",
        description: "Reads a text file from guest and returns content.",
        inputSchema: {
            type: "object",
            properties: {
                vm_name: { type: "string" },
                username: { type: "string" },
                password: { type: "string" },
                path: { type: "string" }
            },
            required: ["vm_name", "path", "username", "password"]
        }
    },
    {
        name: "guest_write_file",
        description: "Writes text content to a guest file path.",
        inputSchema: {
            type: "object",
            properties: {
                vm_name: { type: "string" },
                username: { type: "string" },
                password: { type: "string" },
                path: { type: "string" },
                content: { type: "string" }
            },
            required: ["vm_name", "path", "content", "username", "password"]
        }
    },
    {
        name: "guest_hash_file",
        description: "Computes SHA-256 hash of a guest file.",
        inputSchema: {
            type: "object",
            properties: {
                vm_name: { type: "string" },
                username: { type: "string" },
                password: { type: "string" },
                path: { type: "string" }
            },
            required: ["vm_name", "path", "username", "password"]
        }
    },
    {
        name: "get_vm_network_info",
        description: "Returns guest IPs, adapters, and forwarded ports for a VM.",
        inputSchema: {
            type: "object",
            properties: {
                vm_name: { type: "string" }
            },
            required: ["vm_name"]
        }
    },
    {
        name: "get_guest_tools_health",
        description: "Returns guest additions and guest control readiness health.",
        inputSchema: {
            type: "object",
            properties: {
                vm_name: { type: "string" }
            },
            required: ["vm_name"]
        }
    },
    {
        name: "upload_file",
        description: "Upload a file from host to VM",
        inputSchema: {
            type: "object",
            properties: {
                vm_name: { type: "string" },
                source: { type: "string" },
                destination: { type: "string" },
                username: { type: "string" },
                password: { type: "string" },
            },
            required: ["vm_name", "source", "destination"],
        },
    },
    {
        name: "search_files",
        description: "Search for files inside the VM (using grep)",
        inputSchema: {
            type: "object",
            properties: {
                vm_name: { type: "string" },
                query: { type: "string" },
                path: { type: "string", description: "Path to search in (default: /vagrant)" },
                username: { type: "string" },
                password: { type: "string" },
            },
            required: ["vm_name", "query"],
        },
    },
    {
        name: "configure_sync",
        description: "Configure file synchronization and watchers",
        inputSchema: {
            type: "object",
            properties: {
                vm_name: { type: "string" },
                host_path: { type: "string" },
                guest_path: { type: "string" },
                direction: { type: "string", enum: ["bidirectional", "to_vm", "from_vm"] },
                exclude_patterns: { type: "array", items: { type: "string" } },
                username: { type: "string" },
                password: { type: "string" },
            },
            required: ["vm_name", "host_path", "guest_path", "direction"],
        },
    },
    {
        name: "sync_status",
        description: "Get the current alignment status of the sync engine",
        inputSchema: {
            type: "object",
            properties: {
                vm_name: { type: "string" },
            },
            required: ["vm_name"],
        },
    },
    {
        name: "resolve_conflict",
        description: "Resolve a file sync conflict",
        inputSchema: {
            type: "object",
            properties: {
                vm_name: { type: "string" },
                file_path: { type: "string" },
                resolution: { type: "string", enum: ["use_host", "use_vm"] },
            },
            required: ["vm_name", "file_path", "resolution"],
        },
    },
    {
        name: "create_dev_vm",
        description: "Create and configure a development VM with Vagrant (advanced)",
        inputSchema: {
            type: "object",
            properties: {
                name: { type: "string" },
                project_path: { type: "string" },
                cpu: { type: "number", default: 2 },
                memory: { type: "number", default: 2048 },
                box: { type: "string", default: "ubuntu/focal64" },
                sync_type: { type: "string", default: "rsync" },
                ports: { type: "array", items: { type: "object", properties: { guest: { type: "number" }, host: { type: "number" } } } },
                exclude_patterns: { type: "array", items: { type: "string" } },
                gui_mode: { type: "boolean" },
            },
            required: ["name", "project_path"],
        },
    },
    {
        name: "ensure_dev_vm",
        description: "Ensure development VM is running, create if it doesn't exist",
        inputSchema: {
            type: "object",
            properties: {
                name: { type: "string" },
                project_path: { type: "string" },
            },
            required: ["name"],
        },
    },
    {
        name: "exec_with_sync",
        description: "Execute a command in the VM with file synchronization before and after",
        inputSchema: {
            type: "object",
            properties: {
                vm_name: { type: "string" },
                command: { type: "string" },
                sync_before: { type: "boolean", default: true },
                sync_after: { type: "boolean", default: true },
                username: { type: "string" },
                password: { type: "string" }
            },
            required: ["vm_name", "command"]
        }
    },
    {
        name: "run_background_task",
        description: "Run a command in the VM as a background task",
        inputSchema: {
            type: "object",
            properties: {
                vm_name: { type: "string" },
                command: { type: "string" },
                username: { type: "string" },
                password: { type: "string" }
            },
            required: ["vm_name", "command"]
        }
    },
    {
        name: "setup_dev_environment",
        description: "Install language runtimes, tools, and dependencies in the VM",
        inputSchema: {
            type: "object",
            properties: {
                vm_name: { type: "string" },
                runtimes: { type: "array", items: { type: "string" } }
            },
            required: ["vm_name", "runtimes"]
        }
    },
    {
        name: "install_dev_tools",
        description: "Install specific development tools in the VM",
        inputSchema: {
            type: "object",
            properties: {
                vm_name: { type: "string" },
                tools: { type: "array", items: { type: "string" } }
            },
            required: ["vm_name", "tools"]
        }
    },
    {
        name: "configure_shell",
        description: "Configure shell environment in the VM",
        inputSchema: {
            type: "object",
            properties: {
                vm_name: { type: "string" },
                secrets: { type: "object", additionalProperties: { type: "string" } }
            },
            required: ["vm_name"]
        }
    },
    {
        name: "sync_to_vm",
        description: "Sync files from host to VM",
        inputSchema: {
            type: "object",
            properties: {
                vm_name: { type: "string" }
            },
            required: ["vm_name"]
        }
    },
    {
        name: "sync_from_vm",
        description: "Sync files from VM to host",
        inputSchema: {
            type: "object",
            properties: {
                vm_name: { type: "string" }
            },
            required: ["vm_name"]
        }
    },
    {
        name: "tail_vm_log",
        description: "Reads the last N lines of a specific file inside the VM (e.g., /var/log/syslog, /var/log/nginx/error.log). Essential for debugging service failures.",
        inputSchema: {
            type: "object",
            properties: {
                vm_name: { type: "string" },
                path: { type: "string" },
                lines: { type: "number", default: 50 },
                username: { type: "string" },
                password: { type: "string" },
            },
            required: ["vm_name", "path"],
        },
    },
    {
        name: "get_task_output",
        description: "Retrieves the stdout and stderr buffers of a specific background task started via run_background_task. Essential for monitoring long-running jobs.",
        inputSchema: {
            type: "object",
            properties: {
                vm_name: { type: "string" },
                task_id: { type: "string" },
                username: { type: "string" },
                password: { type: "string" }
            },
            required: ["vm_name", "task_id"]
        }
    },
    {
        name: "get_background_task_status",
        description: "Returns current status/exit_code metadata for a background task.",
        inputSchema: {
            type: "object",
            properties: {
                vm_name: { type: "string" },
                task_id: { type: "string" }
            },
            required: ["vm_name", "task_id"]
        }
    },
    {
        name: "cancel_background_task",
        description: "Cancels a background task started with run_background_task.",
        inputSchema: {
            type: "object",
            properties: {
                vm_name: { type: "string" },
                task_id: { type: "string" },
                signal: { type: "string", default: "SIGTERM" }
            },
            required: ["vm_name", "task_id"]
        }
    },
    {
        name: "grep_log_stream",
        description: "Searches within a log file for a specific pattern. Locates events within active log streams.",
        inputSchema: {
            type: "object",
            properties: {
                vm_name: { type: "string" },
                path: { type: "string" },
                pattern: { type: "string" },
                limit: { type: "number", default: 100 },
                username: { type: "string" },
                password: { type: "string" }
            },
            required: ["vm_name", "path", "pattern"]
        }
    },
    {
        name: "snapshot_save",
        description: "Creates a lightweight Vagrant snapshot. Use before risky operations to enable rollback if something breaks.",
        inputSchema: {
            type: "object",
            properties: {
                vm_name: { type: "string" },
                snapshot_name: { type: "string" },
            },
            required: ["vm_name", "snapshot_name"],
        },
    },
    {
        name: "snapshot_restore",
        description: "Reverts the VM to a specific named snapshot. Enables rapid recovery without destroying and rebuilding the VM.",
        inputSchema: {
            type: "object",
            properties: {
                vm_name: { type: "string" },
                snapshot_name: { type: "string" },
            },
            required: ["vm_name", "snapshot_name"],
        },
    },
    {
        name: "snapshot_list",
        description: "Lists all available snapshots for a VM.",
        inputSchema: {
            type: "object",
            properties: {
                vm_name: { type: "string" },
            },
            required: ["vm_name"],
        },
    },
    {
        name: "snapshot_delete",
        description: "Deletes a specific snapshot from a VM.",
        inputSchema: {
            type: "object",
            properties: {
                vm_name: { type: "string" },
                snapshot_name: { type: "string" },
            },
            required: ["vm_name", "snapshot_name"],
        },
    },
    {
        name: "list_processes",
        description: "Returns a structured list of running processes in the VM (like ps aux). Use to verify service health and resource usage.",
        inputSchema: {
            type: "object",
            properties: {
                vm_name: { type: "string" },
                filter: { type: "string" },
                username: { type: "string" },
                password: { type: "string" },
            },
            required: ["vm_name"],
        },
    },
    {
        name: "kill_process",
        description: "Sends a signal (SIGTERM/SIGKILL) to a specific process in the VM. Required to stop runaway tasks or stuck servers.",
        inputSchema: {
            type: "object",
            properties: {
                vm_name: { type: "string" },
                pid: { type: "number" },
                signal: { type: "string", default: "SIGTERM" },
                username: { type: "string" },
                password: { type: "string" },
            },
            required: ["vm_name", "pid"],
        },
    },
    {
        name: "check_vm_port",
        description: "Verifies if a port is listening in the VM and optionally accessible from the host. Differentiates 'App failed' from 'Port forwarding failed'.",
        inputSchema: {
            type: "object",
            properties: {
                vm_name: { type: "string" },
                guest_port: { type: "number" },
                host_port: { type: "number" },
                username: { type: "string" },
                password: { type: "string" },
            },
            required: ["vm_name", "guest_port"],
        },
    },
    {
        name: "get_vm_dashboard",
        description: "Returns a comprehensive dashboard with VM status, resource usage (CPU/RAM/Disk), active background tasks, and recent logs.",
        inputSchema: {
            type: "object",
            properties: {
                vm_name: { type: "string" },
                username: { type: "string" },
                password: { type: "string" },
            },
            required: ["vm_name"],
        },
    },
    {
        name: "start_download",
        description: "Starts a tracked file download operation. Returns an operation_id that MUST be used with `wait_for_operation`.",
        inputSchema: {
            type: "object",
            properties: {
                vm_name: { type: "string" },
                url: { type: "string" },
                destination: { type: "string" },
                username: { type: "string" },
                password: { type: "string" }
            },
            required: ["vm_name", "url", "destination"]
        }
    },
    {
        name: "get_operation_progress",
        description: "Gets real-time progress of a specific operation (bytes downloaded, percentage, ETA).",
        inputSchema: {
            type: "object",
            properties: {
                operation_id: { type: "string" }
            },
            required: ["operation_id"]
        }
    },
    {
        name: "wait_for_operation",
        description: "Blocks execution until an operation completes OR times out. CRITICAL: Use this after starting any long-running task.",
        inputSchema: {
            type: "object",
            properties: {
                operation_id: { type: "string" },
                timeout_seconds: { type: "number", default: 600 }
            },
            required: ["operation_id"]
        }
    },
    {
        name: "cancel_operation",
        description: "Cancels a running operation.",
        inputSchema: {
            type: "object",
            properties: {
                operation_id: { type: "string" }
            },
            required: ["operation_id"]
        }
    },
    {
        name: "list_active_operations",
        description: "Lists all currently running operations.",
        inputSchema: {
            type: "object",
            properties: {
                vm_name: { type: "string" }
            }
        }
    },
    {
        name: "scan_system_health",
        description: "Checks system health (disk space, memory) and identifies potential 'Zombie' VMs. Can optionally perform a security scan on a specific VM.",
        inputSchema: {
            type: "object",
            properties: {
                vm_name: { type: "string" },
                security_scan: { type: "boolean", default: false },
            },
        },
    },
    {
        name: "cleanup_zombies",
        description: "Safely cleans up identified Zombie VMs. REQUIRES explicit list of VM names to avoid accidents.",
        inputSchema: {
            type: "object",
            properties: {
                vm_names: { type: "array", items: { type: "string" } },
                dry_run: { type: "boolean", default: true }
            },
            required: ["vm_names"]
        }
    },
    {
        name: "sequentialthinking",
        description: "A detailed tool for dynamic and reflective problem-solving. MUST be used between steps to analyze state. Features: checks resources before VM actions, verifies hypotheses, allows branching/backtracking. Accepts both camelCase and snake_case keys.",
        inputSchema: {
            type: "object",
            properties: {
                thought: { type: "string", description: "Analytical content, resource checks, and hypothesis." },
                thoughtNumber: { type: "number" },
                totalThoughts: { type: "number" },
                nextThoughtNeeded: { type: "boolean" },
                isRevision: { type: "boolean" },
                revisesThought: { type: "number" },
                branchFromThought: { type: "number" },
                branchId: { type: "string" },
                needsMoreThoughts: { type: "boolean" },

                // Backward-compatible aliases
                next_thought_needed: { type: "boolean" },
                thought_number: { type: "number" },
                total_thoughts: { type: "number" },
                is_revision: { type: "boolean" },
                revises_thought: { type: "number" },
                branch_from_thought: { type: "number" },
                branch_id: { type: "string" },
                needs_more_thoughts: { type: "boolean" }
            },
            required: ["thought"]
        }
    },


    {
        name: "set_display_mode",
        description: "Controls Headless vs GUI state of a VM.",
        inputSchema: {
            type: "object",
            properties: {
                vm_name: { type: "string" },
                mode: { type: "string", enum: ["headless", "gui"] }
            },
            required: ["vm_name", "mode"]
        }
    },
    {
        name: "atomic_transaction_exec",
        description: "Executes a command with auto-snapshot safety. Reverts on failure if rollback_on_fail is true.",
        inputSchema: {
            type: "object",
            properties: {
                vm_name: { type: "string" },
                command: { type: "string" },
                rollback_on_fail: { type: "boolean", default: true },
                username: { type: "string" },
                password: { type: "string" },
            },
            required: ["vm_name", "command"]
        }
    },
    {
        name: "sentinel_await",
        description: "Wait until a specific condition is met in the VM (port, file, log, or service).",
        inputSchema: {
            type: "object",
            properties: {
                vm_name: { type: "string" },
                condition_type: { type: "string", enum: ["port", "file", "service"] },
                target: { type: "string" },
                timeout: { type: "number", default: 300000 }
            },
            required: ["vm_name", "condition_type", "target"]
        }
    },
    {
        name: "forensic_blackbox_capture",
        description: "Aggregates a diagnostic bundle (logs, processes, system state) for failure analysis.",
        inputSchema: {
            type: "object",
            properties: {
                vm_name: { type: "string" },
                username: { type: "string" },
                password: { type: "string" },
            },
            required: ["vm_name"]
        }
    },
    {
        name: "resize_vm_resources",
        description: "Modifies VM CPU/RAM/GUI settings. Triggers a reboot if the VM is running.",
        inputSchema: {
            type: "object",
            properties: {
                vm_name: { type: "string" },
                cpu: { type: "number" },
                memory: { type: "number" },
                gui_mode: { type: "boolean" },
            },
            required: ["vm_name"]
        },
    },
    {
        name: "package_box",
        description: "Exports the VM to a portable .box file using `vagrant package`.",
        inputSchema: {
            type: "object",
            properties: {
                vm_name: { type: "string" },
                output_file: { type: "string" }
            },
            required: ["vm_name"]
        }
    },
    {
        name: "inject_secrets",
        description: "Securely injects environment variables into the VM's .profile. Parameters are redacted from MCP logs.",
        inputSchema: {
            type: "object",
            properties: {
                vm_name: { type: "string" },
                secrets: { type: "object", additionalProperties: { type: "string" } },
                username: { type: "string" },
                password: { type: "string" },
            },
            required: ["vm_name", "secrets"]
        }
    },
    {
        name: "audit_security",
        description: "Scans the VM for common security issues (open ports, weak ssh config).",
        inputSchema: {
            type: "object",
            properties: {
                vm_name: { type: "string" },
                username: { type: "string" },
                password: { type: "string" },
            },
            required: ["vm_name"]
        }
    }
];
