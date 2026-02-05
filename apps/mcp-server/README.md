# 🖥️ VirtualBox MCP Server

<div align="center">

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue?logo=typescript)](https://www.typescriptlang.org/)
[![MCP SDK](https://img.shields.io/badge/MCP_SDK-0.6.0-green)](https://modelcontextprotocol.io/)
[![NPM Version](https://img.shields.io/npm/v/@use.manus.ai/virtualbox-mcp-server)](https://www.npmjs.com/package/@use.manus.ai/virtualbox-mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Turborepo](https://img.shields.io/badge/Turborepo-Monorepo-blueviolet)](https://turbo.build/)

**A powerful Model Context Protocol (MCP) server for managing VirtualBox VMs via Vagrant.**

AI agents can now provision, manage, and debug virtual development environments with full observability.

[Features](#-features) • [Quick Start](#-quick-start) • [Tools](#-all-46-tools) • [Workflows](#-architectural-workflows) • [Examples](#-example-prompts) • [Configuration](#%EF%B8%8F-mcp-configuration)

</div>

---

## ✨ Features

- **46 MCP Tools** for complete VM lifecycle management
- **Real-time Observability** with logs, dashboards, and progress tracking
- **Snapshot Management** for safe rollback and recovery
- **Process Control** with kill/list capabilities
- **File Synchronization** with conflict resolution
- **Async Operations** with progress tracking and cancellation
- **System Guardrails** for zombie VM detection and cleanup
- **Sequential Thinking** for AI problem-solving

---

## 📦 Architecture

```
Virtualbox-mcp-server/          # Turborepo Monorepo
├── apps/
│   └── mcp-server/             # Main MCP server (46 tools)
│       └── src/
│           ├── index.ts        # Tool definitions & handlers
│           ├── error-handler.ts
│           ├── port-manager.ts
│           └── sequential-thinking.ts
├── packages/
│   ├── vagrant-client/         # Vagrant CLI wrapper
│   ├── sync-engine/            # Chokidar + file sync
│   └── shared-utils/           # Logger utilities
├── turbo.json
└── package.json
```



---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+
- **VirtualBox** 6.x or 7.x
- **Vagrant** 2.3+

### Installation

```bash
# Install via NPM (Recommended)
npm install -g @use.manus.ai/virtualbox-mcp-server

# Or Clone and Build from Source
git clone https://github.com/usemanusai/Virtualbox-mcp-server.git
cd Virtualbox-mcp-server

# Install dependencies
npm install

# Build all packages
npm run build
```

### Running the Server

```bash
# Run the installed server
virtualbox-mcp-server

# Or run from source
node apps/mcp-server/dist/index.js
```

---

## 🛠️ All 46 Tools

### VM Lifecycle (9 tools)

| Tool | Description |
|------|-------------|
| `create_vm` | Create a new Vagrant VM |
| `create_dev_vm` | Create VM with full config (CPU, memory, ports, sync) |
| `ensure_dev_vm` | Start or create VM if not exists |
| `get_vm_status` | Get VM state |
| `list_vms` | List all VMs |
| `destroy_vm` | Destroy VM (force) |
| `resize_vm_resources` | Modify CPU/RAM/GUI settings |
| `package_box` | Export VM as a .box file |
| `set_display_mode` | Toggle Headless/GUI mode |

### Execution (4 tools)

| Tool | Description |
|------|-------------|
| `exec_command` | Execute command in VM (with timeout) |
| `exec_with_sync` | Execute with rsync before/after |
| `run_background_task` | Run nohup background task |
| `atomic_transaction_exec` | Execute with auto-rollback on failure |

### Environment Setup (4 tools)

| Tool | Description |
|------|-------------|
| `setup_dev_environment` | Install runtimes (node, python, go, etc.) |
| `install_dev_tools` | Install tools (git, docker, nginx, etc.) |
| `configure_shell` | Configure aliases and env vars |
| `inject_secrets` | Securely inject environment variables |

### File Operations (7 tools)

| Tool | Description |
|------|-------------|
| `upload_file` | Upload file to VM |
| `search_files` | Grep search in VM |
| `configure_sync` | Configure file watcher |
| `sync_to_vm` | Rsync host→VM |
| `sync_from_vm` | Rsync VM→host |
| `sync_status` | Get sync state |
| `resolve_conflict` | Resolve sync conflicts |

### 👁️ Observability (3 tools)

| Tool | Description |
|------|-------------|
| `tail_vm_log` | Read last N lines of a log file (e.g., `/var/log/syslog`) |
| `get_task_output` | Get stdout/stderr of background tasks |
| `grep_log_stream` | Search for patterns in log files |

### 📸 Snapshots (4 tools)

| Tool | Description |
|------|-------------|
| `snapshot_save` | Create named snapshot before risky operations |
| `snapshot_restore` | Revert to a specific snapshot |
| `snapshot_list` | List all available snapshots |
| `snapshot_delete` | Delete a specific snapshot |

### ⚙️ Process Control (2 tools)

| Tool | Description |
|------|-------------|
| `list_processes` | Return structured list of running processes (`ps aux`) |
| `kill_process` | Send SIGTERM/SIGKILL to a process |

### 🌐 Network (1 tool)

| Tool | Description |
|------|-------------|
| `check_vm_port` | Verify if port is listening in VM & accessible from host |

### 📊 Dashboard (1 tool)

| Tool | Description |
|------|-------------|
| `get_vm_dashboard` | Comprehensive dashboard: CPU, RAM, Disk, tasks, logs |

### ⏳ Progress Awareness (6 tools)

| Tool | Description |
|------|-------------|
| `start_download` | Start tracked download, returns operation_id |
| `get_operation_progress` | Get real-time progress (bytes, %, ETA) |
| `wait_for_operation` | Block until operation completes or times out |
| `cancel_operation` | Cancel a running operation |
| `list_active_operations` | List all active operations |
| `sentinel_await` | Wait for file, port, or service condition |

### 🛡️ Guardrails & Security (4 tools)

| Tool | Description |
|------|-------------|
| `scan_system_health` | Check disk/memory, identify Zombie VMs |
| `cleanup_zombies` | Safely destroy orphaned VMs (with dry-run option) |
| `audit_security` | Scan for open ports and weak configs |
| `forensic_blackbox_capture` | Capture process & network state |

### 🧠 AI Reasoning (1 tool)

| Tool | Description |
|------|-------------|
| `sequentialthinking` | Dynamic problem-solving with reflection & branching |

---

## 🔄 Architectural Workflows

### 🟢 Easy Workflows

#### 1. The "Daily Standup" (Environment Prep)

Quickly bring a dev environment online and ensure it's ready:

**Workflow:** `ensure_dev_vm` → `sync_to_vm` → `install_dev_tools` → `get_vm_dashboard`

1. **`ensure_dev_vm`** — Boot or create the VM automatically
2. **`sync_to_vm`** — Push local code changes to VM
3. **`install_dev_tools`** — Verify tools are present
4. **`get_vm_dashboard`** — Confirm VM is healthy

#### 2. The "Dataset Fetch" (Async Download)

Download large files without blocking:

**Workflow:** `start_download` → `wait_for_operation` → `search_files`

1. **`start_download`** — Initiate download, get `operation_id`
2. **`wait_for_operation`** — Block until download completes
3. **`search_files`** — Verify file exists at expected path

#### 3. The "Service Pulse" (Basic Debugging)

Quickly diagnose why `localhost:8080` isn't loading:

**Workflow:** `list_vms` → `check_vm_port` → `tail_vm_log`

1. **`list_vms`** — Identify which VM handles the service
2. **`check_vm_port`** — Check if app is listening (vs. port forwarding issue)
3. **`tail_vm_log`** — Pull last 50 lines of error log

---

### 🔴 Advanced Workflows

#### 4. The "Safety First" Update (Transactional Rollback)

Apply risky updates with a safety net:

**Workflow:** `snapshot_save` → `start_download` → `check_vm_port` → (rollback or delete snapshot)

1. **`snapshot_save`** — Create checkpoint "pre-update-v2"
2. **`start_download`** — Download new binary/patch
3. **`wait_for_operation`** — Block until complete
4. **`exec_command`** — Run installation script
5. **`check_vm_port`** — Verify service is back online
   - **IF FAILED:** `snapshot_restore` to rollback
   - **IF SUCCESS:** `snapshot_delete` to clean up

#### 5. The "Resource Reclamation" (System Hygiene)

Identify and clean up orphaned Zombie VMs:

**Workflow:** `scan_system_health` → `sequentialthinking` → `cleanup_zombies` → `get_vm_dashboard`

1. **`scan_system_health`** — Identify Zombie VMs consuming resources
2. **`sequentialthinking`** — Analyze which are safe to delete
3. **`cleanup_zombies`** — Safely terminate with `dry_run` first
4. **`get_vm_dashboard`** — Confirm resources are freed

#### 6. The "Deep Fix" Loop (Intelligent Debugging)

Autonomous diagnosis and repair of stuck processes:

**Workflow:** `get_vm_dashboard` → `list_processes` → `grep_log_stream` → `sequentialthinking` → `kill_process` → `exec_with_sync`

1. **`get_vm_dashboard`** — Detect CPU spike or stuck task
2. **`list_processes`** — Find the specific PID causing issues
3. **`grep_log_stream`** — Search logs for error signature
4. **`sequentialthinking`** — Formulate hypothesis
5. **`kill_process`** — Send SIGTERM to stuck process
6. **`exec_with_sync`** — Upload patched config and restart

---

## 💬 Example Prompts

Here are 30 natural language prompts with their corresponding tool calls:

<details>
<summary><strong>VM Lifecycle Examples</strong></summary>

### 1. Provision a New Database Server
> "I need a fresh Redis server. Create a VM named 'redis-cache' using the 'hashicorp/bionic64' box."

```json
{
  "name": "create_vm",
  "arguments": {
    "name": "redis-cache",
    "box": "hashicorp/bionic64"
  }
}
```

### 2. Status Check
> "Is the 'frontend-react' VM currently running?"

```json
{
  "name": "get_vm_status",
  "arguments": {
    "name": "frontend-react"
  }
}
```

### 3. Inventory Overview
> "Show me a list of all the virtual machines we are currently managing."

```json
{
  "name": "list_vms",
  "arguments": {}
}
```

### 4. Force Termination
> "The 'experiment-01' VM is completely unresponsive. Destroy it immediately."

```json
{
  "name": "destroy_vm",
  "arguments": {
    "name": "experiment-01"
  }
}
```

### 5. Idempotent Environment Check
> "Ensure the 'integration-test' VM is running. If it's not there, create it."

```json
{
  "name": "ensure_dev_vm",
  "arguments": {
    "name": "integration-test"
  }
}
```

</details>

<details>
<summary><strong>Execution Examples</strong></summary>

### 6. Install Dependencies
> "Run `pip install -r requirements.txt` inside the 'api-server' VM."

```json
{
  "name": "exec_command",
  "arguments": {
    "vm_name": "api-server",
    "command": "pip install -r requirements.txt"
  }
}
```

### 7. Build and Sync
> "Sync the latest changes to 'builder' and then run `make build` immediately."

```json
{
  "name": "exec_with_sync",
  "arguments": {
    "vm_name": "builder",
    "command": "make build"
  }
}
```

### 8. Long-Running Job
> "Start the data ingestion script (`python ingest.py`) on 'data-lake' in the background."

```json
{
  "name": "run_background_task",
  "arguments": {
    "vm_name": "data-lake",
    "command": "python ingest.py"
  }
}
```

</details>

<details>
<summary><strong>File Operations Examples</strong></summary>

### 9. Deploy Configuration
> "Upload my local `.env.production` file to `/app/.env` on the 'worker-node' VM."

```json
{
  "name": "upload_file",
  "arguments": {
    "vm_name": "worker-node",
    "source": ".env.production",
    "destination": "/app/.env"
  }
}
```

### 10. Locate Error Logs
> "Search for any files named `error.log` inside the `/var/log` directory."

```json
{
  "name": "search_files",
  "arguments": {
    "vm_name": "monitor",
    "query": "error.log",
    "path": "/var/log"
  }
}
```

### 11. Setup File Watcher
> "Configure a file sync. Map my local `./src` folder to `/usr/src/app` on 'dev-main'."

```json
{
  "name": "configure_sync",
  "arguments": {
    "vm_name": "dev-main",
    "host_path": "./src",
    "guest_path": "/usr/src/app",
    "direction": "bidirectional"
  }
}
```

### 12. Conflict Resolution
> "There's a sync conflict on README.md. Use my local version."

```json
{
  "name": "resolve_conflict",
  "arguments": {
    "vm_name": "docs-site",
    "file_path": "README.md",
    "resolution": "use_host"
  }
}
```

</details>

<details>
<summary><strong>Observability Examples</strong></summary>

### 13. Live Debugging
> "Show me the last 50 lines of the nginx error log on the 'proxy' VM."

```json
{
  "name": "tail_vm_log",
  "arguments": {
    "vm_name": "proxy",
    "path": "/var/log/nginx/error.log",
    "lines": 50
  }
}
```

### 14. Monitor Background Task
> "What is the output so far for task `task_12345`?"

```json
{
  "name": "get_task_output",
  "arguments": {
    "vm_name": "data-lake",
    "task_id": "task_12345"
  }
}
```

### 15. Search Logs
> "Search the syslog on 'auth-service' for any 'segfault' errors."

```json
{
  "name": "grep_log_stream",
  "arguments": {
    "vm_name": "auth-service",
    "path": "/var/log/syslog",
    "pattern": "segfault"
  }
}
```

</details>

<details>
<summary><strong>Snapshot Examples</strong></summary>

### 16. Pre-Update Backup
> "I'm about to upgrade the database. Save a snapshot called 'before-v14-upgrade'."

```json
{
  "name": "snapshot_save",
  "arguments": {
    "vm_name": "postgres-primary",
    "snapshot_name": "before-v14-upgrade"
  }
}
```

### 17. Disaster Recovery
> "The upgrade failed! Restore to the 'before-v14-upgrade' snapshot."

```json
{
  "name": "snapshot_restore",
  "arguments": {
    "vm_name": "postgres-primary",
    "snapshot_name": "before-v14-upgrade"
  }
}
```

### 18. List Snapshots
> "What snapshots are available for the 'kafka-broker' VM?"

```json
{
  "name": "snapshot_list",
  "arguments": {
    "vm_name": "kafka-broker"
  }
}
```

</details>

<details>
<summary><strong>Process Control Examples</strong></summary>

### 19. Investigate High Load
> "The 'ml-trainer' VM is slow. List the running processes."

```json
{
  "name": "list_processes",
  "arguments": {
    "vm_name": "ml-trainer"
  }
}
```

### 20. Kill Stuck Process
> "Process ID 9982 is stuck on 'worker-01'. Kill it."

```json
{
  "name": "kill_process",
  "arguments": {
    "vm_name": "worker-01",
    "pid": 9982,
    "signal": "SIGKILL"
  }
}
```

</details>

<details>
<summary><strong>Network & Dashboard Examples</strong></summary>

### 21. Check Service Availability
> "Is port 8080 open and listening on the 'jenkins' VM?"

```json
{
  "name": "check_vm_port",
  "arguments": {
    "vm_name": "jenkins",
    "guest_port": 8080
  }
}
```

### 22. System Health Dashboard
> "Get me a full dashboard with CPU, RAM, and disk usage."

```json
{
  "name": "get_vm_dashboard",
  "arguments": {
    "vm_name": "production-replica"
  }
}
```

</details>

<details>
<summary><strong>Progress & Download Examples</strong></summary>

### 23. Initiate Large Download
> "Download the 10GB dataset from example.com to `/data/` on the 'ai-model' VM."

```json
{
  "name": "start_download",
  "arguments": {
    "vm_name": "ai-model",
    "url": "http://example.com/data.tar.gz",
    "destination": "/data/data.tar.gz"
  }
}
```

### 24. Blocking Wait
> "Wait for the download operation `op_5592` to finish."

```json
{
  "name": "wait_for_operation",
  "arguments": {
    "operation_id": "op_5592",
    "timeout_seconds": 600
  }
}
```

</details>

<details>
<summary><strong>System Maintenance Examples</strong></summary>

### 25. Detect Zombie VMs
> "Scan the system to see if we have any orphaned Zombie VMs."

```json
{
  "name": "scan_system_health",
  "arguments": {}
}
```

### 26. Clean Zombies (Dry Run)
> "Check what would happen if we cleaned up 'zombie-1' and 'old-test'."

```json
{
  "name": "cleanup_zombies",
  "arguments": {
    "vm_names": ["zombie-1", "old-test"],
    "dry_run": true
  }
}
```

</details>

---

## ⚙️ MCP Configuration

### Claude Desktop / Cline / Cursor

Add to your `claude_desktop_config.json` or `mcp_config.json`:

```json
{
  "mcpServers": {
    "vagrant-mcp": {
      "command": "node",
      "args": ["C:\\path\\to\\Virtualbox-mcp-server\\apps\\mcp-server\\dist\\index.js"],
      "env": {
        "LOG_LEVEL": "info",
        "PATH": "C:\\Program Files (x86)\\Vagrant\\bin;C:\\Program Files\\Oracle\\VirtualBox;%PATH%"
      }
    }
  }
}
```

### 🔥 Top 5 MCP Configuration Examples

#### 1. Development Environment (Node.js + Docker)

```json
{
  "mcpServers": {
    "vagrant-mcp": {
      "command": "node",
      "args": ["/home/user/Virtualbox-mcp-server/apps/mcp-server/dist/index.js"],
      "env": {
        "LOG_LEVEL": "debug",
        "VAGRANT_HOME": "/home/user/.vagrant.d",
        "VM_DEFAULT_BOX": "ubuntu/jammy64",
        "VM_DEFAULT_MEMORY": "4096",
        "VM_DEFAULT_CPU": "4"
      }
    }
  }
}
```

#### 2. CI/CD Pipeline (Jenkins/GitHub Actions)

```json
{
  "mcpServers": {
    "vagrant-mcp": {
      "command": "node",
      "args": ["/opt/mcp/vagrant-mcp-server/dist/index.js"],
      "env": {
        "LOG_LEVEL": "warn",
        "VAGRANT_HOME": "/var/lib/jenkins/.vagrant.d",
        "VM_AUTO_DESTROY": "true",
        "VM_SNAPSHOT_BEFORE_TEST": "true"
      }
    }
  }
}
```

#### 3. Windows Workstation

```json
{
  "mcpServers": {
    "vagrant-mcp": {
      "command": "node.exe",
      "args": ["C:\\Users\\Developer\\mcp\\Virtualbox-mcp-server\\apps\\mcp-server\\dist\\index.js"],
      "env": {
        "LOG_LEVEL": "info",
        "PATH": "C:\\Program Files (x86)\\Vagrant\\bin;C:\\Program Files\\Oracle\\VirtualBox;C:\\Windows\\System32",
        "VAGRANT_HOME": "C:\\Users\\Developer\\.vagrant.d"
      }
    }
  }
}
```

#### 4. macOS with Homebrew

```json
{
  "mcpServers": {
    "vagrant-mcp": {
      "command": "/opt/homebrew/bin/node",
      "args": ["/Users/dev/Projects/Virtualbox-mcp-server/apps/mcp-server/dist/index.js"],
      "env": {
        "LOG_LEVEL": "info",
        "PATH": "/opt/homebrew/bin:/usr/local/bin:/usr/bin",
        "VAGRANT_HOME": "/Users/dev/.vagrant.d"
      }
    }
  }
}
```

#### 5. Production/Enterprise (Restricted Environment)

```json
{
  "mcpServers": {
    "vagrant-mcp": {
      "command": "node",
      "args": ["/srv/mcp/vagrant-server/dist/index.js"],
      "env": {
        "LOG_LEVEL": "error",
        "VAGRANT_HOME": "/srv/vagrant",
        "VM_MAX_COUNT": "10",
        "VM_ALLOWED_BOXES": "company/base-ubuntu,company/base-centos",
        "VM_REQUIRE_SNAPSHOT": "true",
        "GUARDRAILS_STRICT": "true"
      }
    }
  }
}
```

---

## 🧪 Development

```bash
# Watch mode (rebuild on changes)
npm run dev

# Lint
npm run lint

# Format
npm run format
```

---

## 📝 License

MIT © [usemanusai](https://github.com/usemanusai)

---

<div align="center">

**Made with ❤️ for AI-powered infrastructure management**

[⬆ Back to Top](#%EF%B8%8F-virtualbox-mcp-server)

</div>
