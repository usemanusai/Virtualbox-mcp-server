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
        description: "A detailed tool for dynamic and reflective problem-solving. MUST be used between steps to analyze state. Features: Checks resources (RAM/Disk) before VM creation, verifies hypothesis, allows branching/backtracking. \n\nParameters:\n- thought: The current thinking step. MUST include technical checks (e.g., 'Checking if host has 4GB RAM free before starting VM').\n- next_thought_needed: True if planning is incomplete.\n- thought_number: Sequence ID.\n- total_thoughts: Est. remaining steps.\n- is_revision: Boolean.\n- revises_thought: ID of thought being fixed.\n- branch_from_thought: ID of branch point.\n- branch_id: Branch identifier.\n- needs_more_thoughts: If scope expands.",
        inputSchema: {
            type: "object",
            properties: {
                thought: { type: "string", description: "Analytical content, resource checks, and hypothesis." },
                next_thought_needed: { type: "boolean" },
                thought_number: { type: "number" },
                totalThoughts: { type: "number" },
                is_revision: { type: "boolean" },
                revises_thought: { type: "number" },
                branch_from_thought: { type: "number" },
                branch_id: { type: "string" },
                needs_more_thoughts: { type: "boolean" }
            },
            required: ["thought", "next_thought_needed", "thought_number", "totalThoughts"]
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
