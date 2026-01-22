import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { logger, setLogLevel } from "@virtualbox-mcp/shared-utils";
import { VagrantClient } from "@virtualbox-mcp/vagrant-client";
import { SyncManager } from "@virtualbox-mcp/sync-engine";
import { ensurePortFree } from "./port-manager.js";

const PORT = 3002;

// Tool Schemas
const CreateVMSchema = z.object({
    name: z.string(),
    box: z.string().optional(),
});

const GetVMStatusSchema = z.object({
    name: z.string(),
});

// Main Server Class
export class McpServer {
    private server: Server;
    private vagrant: VagrantClient;
    private syncManager: SyncManager;

    constructor() {
        this.server = new Server(
            {
                name: "virtualbox-mcp-server",
                version: "0.1.0",
            },
            {
                capabilities: {
                    tools: {},
                },
            }
        );

        this.vagrant = new VagrantClient();
        this.syncManager = new SyncManager(this.vagrant);
        this.setupHandlers();
    }

    private setupHandlers() {
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            return {
                tools: [
                    {
                        name: "create_vm",
                        description: "Create a new Vagrant VM",
                        inputSchema: {
                            type: "object",
                            properties: {
                                name: { type: "string" },
                                box: { type: "string" },
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
                    // === NEW TOOLS FOR 100% PARITY ===
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
                                working_dir: { type: "string", default: "/home/vagrant" },
                                sync_before: { type: "boolean", default: true },
                                sync_after: { type: "boolean", default: true },
                            },
                            required: ["vm_name", "command"],
                        },
                    },
                    {
                        name: "run_background_task",
                        description: "Run a command in the VM as a background task",
                        inputSchema: {
                            type: "object",
                            properties: {
                                vm_name: { type: "string" },
                                command: { type: "string" },
                                working_dir: { type: "string", default: "/home/vagrant" },
                                sync_before: { type: "boolean", default: true },
                            },
                            required: ["vm_name", "command"],
                        },
                    },
                    {
                        name: "setup_dev_environment",
                        description: "Install language runtimes, tools, and dependencies in the VM",
                        inputSchema: {
                            type: "object",
                            properties: {
                                vm_name: { type: "string" },
                                runtimes: { type: "array", items: { type: "string" }, description: "e.g., ['node', 'python', 'go']" },
                                tools: { type: "array", items: { type: "string" } },
                            },
                            required: ["vm_name", "runtimes"],
                        },
                    },
                    {
                        name: "install_dev_tools",
                        description: "Install specific development tools in the VM",
                        inputSchema: {
                            type: "object",
                            properties: {
                                vm_name: { type: "string" },
                                tools: { type: "array", items: { type: "string" }, description: "e.g., ['git', 'docker', 'nginx']" },
                            },
                            required: ["vm_name", "tools"],
                        },
                    },
                    {
                        name: "configure_shell",
                        description: "Configure shell environment in the VM",
                        inputSchema: {
                            type: "object",
                            properties: {
                                vm_name: { type: "string" },
                                shell_type: { type: "string", default: "bash" },
                                aliases: { type: "array", items: { type: "string" } },
                                env_vars: { type: "array", items: { type: "string" } },
                            },
                            required: ["vm_name"],
                        },
                    },
                    {
                        name: "sync_to_vm",
                        description: "Sync files from host to VM",
                        inputSchema: {
                            type: "object",
                            properties: {
                                vm_name: { type: "string" },
                            },
                            required: ["vm_name"],
                        },
                    },
                    {
                        name: "sync_from_vm",
                        description: "Sync files from VM to host",
                        inputSchema: {
                            type: "object",
                            properties: {
                                vm_name: { type: "string" },
                            },
                            required: ["vm_name"],
                        },
                    },
                ],
            };
        });

        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;

            try {
                if (name === "create_vm") {
                    const { name: vmName, box } = CreateVMSchema.parse(args);
                    await this.vagrant.createVM(vmName, box);
                    return {
                        content: [{ type: "text", text: `VM ${vmName} creation initiated.` }],
                    };
                }

                if (name === "get_vm_status") {
                    const { name: vmName } = GetVMStatusSchema.parse(args);
                    const status = await this.vagrant.getVMStatus(vmName);
                    return {
                        content: [{ type: "text", text: JSON.stringify({ name: vmName, state: status }) }],
                    };
                }

                if (name === "list_vms") {
                    const vms = await this.vagrant.listVMs();
                    return {
                        content: [{ type: "text", text: JSON.stringify(vms, null, 2) }],
                    };
                }

                if (name === "destroy_vm") {
                    const schema = z.object({ name: z.string() });
                    const { name: vmName } = schema.parse(args);
                    await this.vagrant.destroyVM(vmName);
                    return {
                        content: [{ type: "text", text: `VM ${vmName} destroyed.` }],
                    };
                }

                if (name === "exec_command") {
                    const schema = z.object({ vm_name: z.string(), command: z.string() });
                    const { vm_name, command } = schema.parse(args);
                    const result = await this.vagrant.executeCommand(vm_name, command);
                    return {
                        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                    };
                }

                if (name === "upload_file") {
                    const schema = z.object({ vm_name: z.string(), source: z.string(), destination: z.string() });
                    const { vm_name, source, destination } = schema.parse(args);
                    await this.vagrant.uploadFile(vm_name, source, destination);
                    return {
                        content: [{ type: "text", text: `File uploaded to ${destination} on ${vm_name}` }],
                    };
                }

                if (name === "search_files") {
                    const schema = z.object({ vm_name: z.string(), query: z.string(), path: z.string().optional() });
                    const { vm_name, query, path } = schema.parse(args);
                    const searchPath = path || "/vagrant";
                    const cmd = `grep -rnI "${query}" "${searchPath}"`;
                    const result = await this.vagrant.executeCommand(vm_name, cmd);
                    return {
                        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                    };
                }

                if (name === "configure_sync") {
                    const schema = z.object({
                        vm_name: z.string(),
                        host_path: z.string(),
                        guest_path: z.string(),
                        direction: z.enum(["bidirectional", "to_vm", "from_vm"]),
                        exclude_patterns: z.array(z.string()).optional()
                    });
                    const config = schema.parse(args);
                    await this.syncManager.configureSync({
                        vmName: config.vm_name,
                        hostPath: config.host_path,
                        guestPath: config.guest_path,
                        direction: config.direction,
                        excludePatterns: config.exclude_patterns
                    });
                    return {
                        content: [{ type: "text", text: `Sync configured for ${config.vm_name}` }],
                    };
                }

                if (name === "sync_status") {
                    const schema = z.object({ vm_name: z.string() });
                    const { vm_name } = schema.parse(args);
                    const status = await this.syncManager.getSyncStatus(vm_name);
                    return {
                        content: [{ type: "text", text: JSON.stringify(status || { status: 'unknown' }, null, 2) }],
                    };
                }

                if (name === "resolve_conflict") {
                    const schema = z.object({
                        vm_name: z.string(),
                        file_path: z.string(),
                        resolution: z.enum(["use_host", "use_vm"])
                    });
                    const { vm_name, file_path, resolution } = schema.parse(args);
                    await this.syncManager.resolveConflict(vm_name, file_path, resolution);
                    return {
                        content: [{ type: "text", text: `Conflict resolved using ${resolution}` }],
                    };
                }

                // === HANDLERS FOR NEW TOOLS ===

                if (name === "create_dev_vm") {
                    const schema = z.object({
                        name: z.string(),
                        project_path: z.string(),
                        cpu: z.number().optional(),
                        memory: z.number().optional(),
                        box: z.string().optional(),
                        sync_type: z.string().optional(),
                        ports: z.array(z.object({ guest: z.number(), host: z.number() })).optional(),
                        exclude_patterns: z.array(z.string()).optional(),
                    });
                    const params = schema.parse(args);
                    await this.vagrant.createVMAdvanced(params.name, params.project_path, {
                        box: params.box,
                        cpu: params.cpu,
                        memory: params.memory,
                        ports: params.ports,
                        syncType: params.sync_type,
                        excludePatterns: params.exclude_patterns,
                    });
                    return {
                        content: [{ type: "text", text: JSON.stringify({ name: params.name, project_path: params.project_path, status: "created" }) }],
                    };
                }

                if (name === "ensure_dev_vm") {
                    const schema = z.object({
                        name: z.string(),
                        project_path: z.string().optional(),
                    });
                    const params = schema.parse(args);
                    const status = await this.vagrant.getVMStatus(params.name);
                    if (status === "not_created") {
                        if (!params.project_path) {
                            return { content: [{ type: "text", text: "Error: VM doesn't exist. Missing required parameter for creation: project_path" }], isError: true };
                        }
                        await this.vagrant.createVMAdvanced(params.name, params.project_path, {});
                        return { content: [{ type: "text", text: `VM '${params.name}' created and started` }] };
                    }
                    if (status !== "running") {
                        await this.vagrant.startVM(params.name);
                        return { content: [{ type: "text", text: `VM '${params.name}' started` }] };
                    }
                    return { content: [{ type: "text", text: `VM '${params.name}' is already running` }] };
                }

                if (name === "exec_with_sync") {
                    const schema = z.object({
                        vm_name: z.string(),
                        command: z.string(),
                        working_dir: z.string().optional(),
                        sync_before: z.boolean().optional(),
                        sync_after: z.boolean().optional(),
                    });
                    const params = schema.parse(args);
                    const workingDir = params.working_dir || "/home/vagrant";
                    const syncBefore = params.sync_before !== false;
                    const syncAfter = params.sync_after !== false;

                    if (syncBefore) {
                        await this.syncManager.syncToVMFull(params.vm_name);
                    }
                    const result = await this.vagrant.executeCommand(params.vm_name, `cd ${workingDir} && ${params.command}`);
                    if (syncAfter) {
                        await this.syncManager.syncFromVMFull(params.vm_name);
                    }
                    return { content: [{ type: "text", text: JSON.stringify({ ...result, sync_before: syncBefore, sync_after: syncAfter }) }] };
                }

                if (name === "run_background_task") {
                    const schema = z.object({
                        vm_name: z.string(),
                        command: z.string(),
                        working_dir: z.string().optional(),
                        sync_before: z.boolean().optional(),
                    });
                    const params = schema.parse(args);
                    const workingDir = params.working_dir || "/home/vagrant";
                    const syncBefore = params.sync_before !== false;

                    if (syncBefore) {
                        await this.syncManager.syncToVMFull(params.vm_name);
                    }
                    const bgCommand = `cd ${workingDir} && nohup ${params.command} > /tmp/bg_${params.vm_name}.log 2>&1 &`;
                    const result = await this.vagrant.executeCommand(params.vm_name, bgCommand);
                    return { content: [{ type: "text", text: JSON.stringify({ status: "started", log_file: `/tmp/bg_${params.vm_name}.log`, exit_code: result.exitCode }) }] };
                }

                if (name === "setup_dev_environment") {
                    const schema = z.object({
                        vm_name: z.string(),
                        runtimes: z.array(z.string()),
                        tools: z.array(z.string()).optional(),
                    });
                    const params = schema.parse(args);
                    const results: Record<string, { success: boolean; output: string }> = {};

                    for (const runtime of params.runtimes) {
                        const cmd = this.getInstallRuntimeCommand(runtime);
                        if (!cmd) {
                            results[runtime] = { success: false, output: `Unsupported runtime: ${runtime}` };
                            continue;
                        }
                        const res = await this.vagrant.executeCommand(params.vm_name, cmd);
                        results[runtime] = { success: res.exitCode === 0, output: res.stdout || res.stderr };
                    }

                    if (params.tools) {
                        for (const tool of params.tools) {
                            const cmd = this.getInstallToolCommand(tool);
                            const res = await this.vagrant.executeCommand(params.vm_name, cmd);
                            results[tool] = { success: res.exitCode === 0, output: res.stdout || res.stderr };
                        }
                    }

                    return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
                }

                if (name === "install_dev_tools") {
                    const schema = z.object({
                        vm_name: z.string(),
                        tools: z.array(z.string()),
                    });
                    const params = schema.parse(args);
                    const results: Record<string, { success: boolean; output: string }> = {};

                    for (const tool of params.tools) {
                        const cmd = this.getInstallToolCommand(tool);
                        const res = await this.vagrant.executeCommand(params.vm_name, cmd);
                        results[tool] = { success: res.exitCode === 0, output: res.stdout || res.stderr };
                    }

                    return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
                }

                if (name === "configure_shell") {
                    const schema = z.object({
                        vm_name: z.string(),
                        shell_type: z.string().optional(),
                        aliases: z.array(z.string()).optional(),
                        env_vars: z.array(z.string()).optional(),
                    });
                    const params = schema.parse(args);
                    const shellType = params.shell_type || "bash";
                    const rcFile = shellType === "zsh" ? "/home/vagrant/.zshrc" : "/home/vagrant/.bashrc";

                    let config = "\n# Configured by vagrant-mcp-server\n";
                    if (params.aliases && params.aliases.length > 0) {
                        config += "\n# Aliases\n";
                        for (const alias of params.aliases) {
                            config += `alias ${alias}\n`;
                        }
                    }
                    if (params.env_vars && params.env_vars.length > 0) {
                        config += "\n# Environment Variables\n";
                        for (const envVar of params.env_vars) {
                            config += `export ${envVar}\n`;
                        }
                    }

                    const appendCmd = `echo '${config}' >> ${rcFile}`;
                    const res = await this.vagrant.executeCommand(params.vm_name, appendCmd);
                    return { content: [{ type: "text", text: JSON.stringify({ vm_name: params.vm_name, shell_type: shellType, exit_code: res.exitCode }) }] };
                }

                if (name === "sync_to_vm") {
                    const schema = z.object({ vm_name: z.string() });
                    const { vm_name } = schema.parse(args);
                    const result = await this.syncManager.syncToVMFull(vm_name);
                    return { content: [{ type: "text", text: JSON.stringify(result) }] };
                }

                if (name === "sync_from_vm") {
                    const schema = z.object({ vm_name: z.string() });
                    const { vm_name } = schema.parse(args);
                    const result = await this.syncManager.syncFromVMFull(vm_name);
                    return { content: [{ type: "text", text: JSON.stringify(result) }] };
                }

                throw new Error(`Unknown tool: ${name}`);
            } catch (error: any) {
                logger.error(`Error executing tool ${name}`, error);
                return {
                    content: [{ type: "text", text: `Error: ${error.message}` }],
                    isError: true,
                };
            }
        });
    }

    async start() {
        setLogLevel(process.env.LOG_LEVEL || "info");

        // Ensure port 3002 is free (per strict instruction)
        await ensurePortFree(PORT);

        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        logger.info("Virtualbox MCP Server running on stdio");
    }

    /**
     * Returns the shell command to install a language runtime.
     * Mirrors the Go server's installRuntime function.
     */
    private getInstallRuntimeCommand(runtime: string): string | null {
        switch (runtime) {
            case "node":
                return "curl -sL https://deb.nodesource.com/setup_16.x | sudo -E bash - && sudo apt-get install -y nodejs";
            case "python":
                return "sudo apt-get update && sudo apt-get install -y python3 python3-pip python3-venv";
            case "go":
                return "sudo apt-get update && sudo apt-get install -y golang";
            case "ruby":
                return "sudo apt-get update && sudo apt-get install -y ruby-full";
            case "php":
                return "sudo apt-get update && sudo apt-get install -y php php-cli php-fpm php-json php-common php-mysql php-zip php-gd php-mbstring php-curl php-xml php-pear php-bcmath";
            case "java":
                return "sudo apt-get update && sudo apt-get install -y default-jdk";
            default:
                return null;
        }
    }

    /**
     * Returns the shell command to install a development tool.
     * Mirrors the Go server's installTool function.
     */
    private getInstallToolCommand(tool: string): string {
        switch (tool) {
            case "git":
                return "sudo apt-get update && sudo apt-get install -y git";
            case "docker":
                return "curl -fsSL https://get.docker.com -o get-docker.sh && sudo sh get-docker.sh";
            case "docker-compose":
                return 'sudo curl -L "https://github.com/docker/compose/releases/download/1.29.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose && sudo chmod +x /usr/local/bin/docker-compose';
            case "nginx":
                return "sudo apt-get update && sudo apt-get install -y nginx";
            case "postgresql":
                return "sudo apt-get update && sudo apt-get install -y postgresql postgresql-contrib";
            case "mysql":
                return "sudo apt-get update && sudo apt-get install -y mysql-server";
            case "mongodb":
                return "sudo apt-get update && sudo apt-get install -y mongodb";
            case "redis":
                return "sudo apt-get update && sudo apt-get install -y redis-server";
            default:
                // Try to install as a generic package
                return `sudo apt-get update && sudo apt-get install -y ${tool}`;
        }
    }
}

// Start the server
const server = new McpServer();
server.start().catch((err) => {
    logger.error("Server failed to start", err);
    process.exit(1);
});
