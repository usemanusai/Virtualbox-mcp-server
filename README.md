# Virtualbox MCP Server

Multi-purpose Model Context Protocol (MCP) server to manage Virtualbox/Vagrant VMs. Built as a TypeScript Monorepo.

[![npm version](https://img.shields.io/npm/v/virtualbox-mcp-server.svg)](https://www.npmjs.com/package/virtualbox-mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🏗️ Architecture

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
```

## 🚀 Features

-   **Always-On Port Management**: Automatically ensures port 3002 is free before starting.
-   **Robust MCP Protocol**: Full JSON-RPC support via stdio.
-   **Cross-Platform**: Optimized for Windows (CRLF handling) and POSIX systems.
-   **Type-Safe**: Built with TypeScript and Zod.

## 🛠️ Available Tools

The server exposes the following tools to the MCP client:

### 1. `create_vm`
Creates and starts a new Vagrant VM.

-   **Arguments**:
    -   `name` (string, required): logical name for the VM.
    -   `box` (string, optional): Vagrant box image to use (default: `ubuntu/focal64`).
-   **Example usage**:
    ```json
    {
      "name": "create_vm",
      "arguments": {
        "name": "dev-box-1",
        "box": "hashicorp/bionic64"
      }
    }
    ```

### 2. `get_vm_status`
Retrieves the current state of a specific VM.

-   **Arguments**:
    -   `name` (string, required): logical name of the VM.
-   **Returns**: JSON string containing `{ name: string, state: "running" | "poweroff" | "not_created" | ... }`.

## ⚙️ Configuration

### Prerequisities
1.  **Node.js**: v18 or higher.
2.  **Vagrant**: Installed and added to system PATH.
3.  **VirtualBox**: Installed.

### Installation
```bash
git clone https://github.com/usemanusai/Virtualbox-mcp-server.git
cd Virtualbox-mcp-server
npm install
npm run build
```

### Client Config (`mcp_config.json`)

Add the following to your MCP client configuration (e.g., in Claude Desktop or valid MCP config location):

**Windows**:
```json
{
  "mcpServers": {
    "vagrant-mcp": {
      "command": "node",
      "args": [
        "C:\\path\\to\\Virtualbox-mcp-server\\apps\\mcp-server\\dist\\index.js"
      ],
      "env": {
        "PATH": "C:\\Program Files (x86)\\Vagrant\\bin;C:\\Windows\\system32;C:\\Windows"
      }
    }
  }
}
```

**macOS/Linux**:
```json
{
  "mcpServers": {
    "vagrant-mcp": {
      "command": "node",
      "args": [
        "/path/to/Virtualbox-mcp-server/apps/mcp-server/dist/index.js"
      ],
      "env": {
        "PATH": "/usr/local/bin:/usr/bin:/bin"
      }
    }
  }
}
```

## 🐛 Troubleshooting

**"Vagrant executable not found"**
Ensure the directory containing `vagrant.exe` is explicitly added to the `env.PATH` in your config. On Windows, this is often `C:\Program Files (x86)\Vagrant\bin`.

**"Port 3002 already in use"**
The server includes an auto-kill script, but if permissions fail, manually kill the process:
-   Windows: `taskkill /F /IM node.exe` (Be careful!)
-   Linux: `lsof -ti:3002 | xargs kill -9`

## 📦 Publishing

To publish to NPM:
1.  `npm run build`
2.  `npm publish`
