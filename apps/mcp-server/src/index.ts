import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { logger, setLogLevel } from "@virtualbox-mcp/shared-utils";
import { VagrantClient } from "@virtualbox-mcp/vagrant-client";
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
                    const searchPath = path || "/vagrant"; // Default to synced folder
                    // Use executeCommand to run grep
                    // -r: recursive, -n: line number, -I: ignore binary
                    const cmd = `grep -rnI "${query}" "${searchPath}"`;
                    const result = await this.vagrant.executeCommand(vm_name, cmd);
                    return {
                        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                    };
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
}

// Start the server
const server = new McpServer();
server.start().catch((err) => {
    logger.error("Server failed to start", err);
    process.exit(1);
});
