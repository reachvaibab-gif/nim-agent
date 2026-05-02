# ⚡ NIM-Agent: NVIDIA NIM Configuration Guide

This repository provides instructions on how to use the standard **OpenClaude** CLI with **NVIDIA NIM** inference endpoints, defaulting to the **Qwen 2.5 Coder** (A35B Construct).

---

## 🚀 1. Install OpenClaude
Install the vanilla OpenClaude CLI globally on your system:

```bash
sudo npm install -g @gitlawb/openclaude
```

---

## 🔑 2. Get your NVIDIA NIM Key
1. Go to [build.nvidia.com](https://build.nvidia.com).
2. Create a free account (includes 1,000 free credits).
3. Search for **"Qwen 2.5 Coder 32B"** (The A35B Construct).
4. Click **Get API Key** and copy the `nvapi-` token.

---

## ⚙️ 3. Configure for NVIDIA NIM
Add these exports to your shell profile (`~/.zshrc` or `~/.bashrc`) to lock in the **Qwen 2.5 Coder** default.

```bash
export CLAUDE_CODE_USE_OPENAI=1
export OPENAI_BASE_URL="https://integrate.api.nvidia.com/v1"
export OPENAI_API_KEY="your-nvapi-key-here"
export OPENAI_MODEL="nvidia/qwen-2.5-coder-32b"
```

---

## 🏎️ 4. Launch
Once configured, simply run:
```bash
openclaude
```
The agent will now use the **Qwen 2.5 Coder (A35B Construct)** for all coding and reasoning tasks via NVIDIA NIM.
