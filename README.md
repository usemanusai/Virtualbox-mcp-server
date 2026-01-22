# Virtualbox MCP Server

Multi-purpose MCP server to manage Virtualbox/Vagrant VMs (Monorepo/NPM).

## Architecture

This project is a **Turborepo** monorepo containing:

-   `apps/mcp-server`: The main MCP server application.
-   `packages/vagrant-client`: A TypeScript wrapper for the Vagrant CLI.
-   `packages/shared-utils`: Common logging and utilities.

```mermaid
graph TD
    Client[MCP Client] <-->|JSON-RPC (stdio)| Server[MCP Server App]
    Server -->|Uses| VClient[Vagrant Client Pkg]
    VClient -->|Executes| VagrantCLI[Vagrant Binary]
    VagrantCLI -->|Manages| VBox[VirtualBox VMs]
    
    subgraph Monorepo
        Server
        VClient
        Shared[Shared Utils]
        Server -.-> Shared
        VClient -.-> Shared
    end
```

## Features

-   **Always-On Port Management**: Automatically kills processes on port 3002 before starting.
-   **Robust MCP Protocol**: Implements JSON-RPC over stdio using the official `@modelcontextprotocol/sdk`.
-   **Cross-Platform**: Designed for Windows (with CRLF handling) and POSIX.
-   **TypeScript**: Fully typed with Zod schema validation.

## Prerequisites

-   Node.js 18+
-   Vagrant installed and in PATH
-   VirtualBox installed

## Setup

```bash
npm install
npm run build
```

## Usage

Run the server directly:

```bash
npm start
```

Or configure your MCP client (e.g., Claude Desktop, Cursor) to run:

```json
{
  "mcpServers": {
    "vagrant": {
      "command": "node",
      "args": ["/path/to/Virtualbox-mcp-server/apps/mcp-server/dist/index.js"]
    }
  }
}
```

## Publishing

To publish to NPM:

1.  Build all packages: `npm run build`
2.  Publish: `npm publish` (Ensure you are logged in)

Target package names:
-   `jaegis-npm-mcp` (Main server)
