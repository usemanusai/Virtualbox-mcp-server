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
                        description: "Get the status of a Vagrant VM",
                        inputSchema: {
                            type: "object",
                            properties: {
                                name: { type: "string" },
                            },
                            required: ["name"],
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
