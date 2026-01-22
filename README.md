# Virtualbox MCP Server

A Model Context Protocol (MCP) server for managing VirtualBox VMs via Vagrant.

## ✨ Features

**19 MCP Tools** (100% Feature Parity with legacy Go server):

### VM Lifecycle
| Tool | Description |
|------|-------------|
| `create_vm` | Create a basic Vagrant VM |
| `create_dev_vm` | Create VM with full config (CPU, memory, ports, sync) |
| `ensure_dev_vm` | Start or create VM if not exists |
| `get_vm_status` | Get VM state |
| `list_vms` | List all VMs |
| `destroy_vm` | Destroy VM |

### Execution
| Tool | Description |
|------|-------------|
| `exec_command` | Execute command in VM |
| `exec_with_sync` | Execute with rsync before/after |
| `run_background_task` | Run nohup background task |

### Environment Setup
| Tool | Description |
|------|-------------|
| `setup_dev_environment` | Install runtimes (node, python, go, etc.) |
| `install_dev_tools` | Install tools (git, docker, nginx, etc.) |
| `configure_shell` | Configure aliases and env vars |

### File Operations
| Tool | Description |
|------|-------------|
| `upload_file` | Upload file to VM |
| `search_files` | Grep search in VM |
| `configure_sync` | Configure file watcher |
| `sync_to_vm` | Rsync host→VM |
| `sync_from_vm` | Rsync VM→host |
| `sync_status` | Get sync state |
| `resolve_conflict` | Resolve sync conflicts |

## 🚀 Quick Start

```bash
# Clone and build
git clone https://github.com/usemanusai/Virtualbox-mcp-server.git
cd Virtualbox-mcp-server
npm install
npm run build
```

## ⚙️ Configuration

Add to your `mcp_config.json`:

```json
{
  "mcpServers": {
    "vagrant-mcp": {
      "command": "node",
      "args": ["C:\\path\\to\\Virtualbox-mcp-server\\apps\\mcp-server\\dist\\index.js"],
      "env": {
        "LOG_LEVEL": "info",
        "PATH": "C:\\Program Files (x86)\\Vagrant\\bin;..."
      }
    }
  }
}
```

## 📦 Architecture

```
Virtualbox-mcp-server/
├── apps/mcp-server/        # Main MCP server (19 tools)
├── packages/
│   ├── vagrant-client/     # Vagrant CLI wrapper
│   ├── sync-engine/        # Chokidar + rsync
│   └── shared-utils/       # Logger
```

## License

MIT
