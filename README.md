<div align="center">

<img src="https://readme-typing-svg.demolab.com?font=JetBrains+Mono&weight=800&size=32&pause=1000&color=76B900&center=true&vCenter=true&width=700&lines=NIM-Agent;Qwen3+Coder+480B+via+NVIDIA+NIM;480B+Parameters.+Free+Tier.+Zero+Config." alt="Typing Banner" />

<br/>

[![Model](https://img.shields.io/badge/Qwen3_Coder_480B_A35B_Instruct-76b900?style=flat-square&logo=nvidia&logoColor=white)](https://build.nvidia.com/qwen/qwen3-coder-480b-a35b-instruct)
[![Engine](https://img.shields.io/badge/OpenClaude-CLI-white?style=flat-square)](https://www.npmjs.com/package/@gitlawb/openclaude)
[![Node](https://img.shields.io/badge/Node.js-v20%2B-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)

</div>

---

NIM-Agent is a configuration guide for running **OpenClaude** — a Claude Code CLI — backed by **NVIDIA NIM** inference. This gives you access to a 480B parameter coding model for free, directly in your terminal.

---

## Prerequisites

OpenClaude requires **Node.js v20 or higher**. Install it before proceeding.

**macOS** (via Homebrew):

First, install Homebrew if you don't have it:
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Then install Node.js:
```bash
brew install node
```

**macOS/Linux** (via official installer):
```bash
# Download and run the installer from https://nodejs.org
# Or use nvm (Node Version Manager):
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
nvm install 20
nvm use 20
```

**Windows:**
Download the LTS installer from [nodejs.org](https://nodejs.org) and run it.

Verify your install:
```bash
node --version   # should show v20.x.x or higher
npm --version    # should show 10.x.x or higher
```

---

## Setup

### 1. Install OpenClaude

```bash
sudo npm install -g @gitlawb/openclaude
```

### 2. Get your NVIDIA NIM API Key

1. Open **[build.nvidia.com/qwen/qwen3-coder-480b-a35b-instruct](https://build.nvidia.com/qwen/qwen3-coder-480b-a35b-instruct)**
2. Sign up for a free developer account
3. Click **Get API Key** and copy the token (starts with `nvapi-`)

### 3. Configure via the Setup Wizard

Run the agent for the first time:

```bash
openclaude
```

Navigate the setup wizard as follows:

```
Provider Type  →  Third Party
Provider       →  NVIDIA NIM
API Key        →  nvapi-xxxxxxxxxxxxxxxx   ← paste here
```

That's it. The agent is now fully wired to NVIDIA infrastructure.

---

## Model

| | |
|---|---|
| **Name** | Qwen3 Coder 480B A35B Instruct |
| **Endpoint** | `https://integrate.api.nvidia.com/v1` |
| **Best for** | Code generation, debugging, agentic tasks |
| **Cost** | Free |

---

<div align="center">
<sub>By <a href="https://github.com/reachvaibab-gif">reachvaibab-gif</a> · Powered by <a href="https://build.nvidia.com">NVIDIA NIM</a></sub>
</div>
