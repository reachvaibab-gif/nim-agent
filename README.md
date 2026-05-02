# ⚡ NIM-Agent: NVIDIA NIM Configuration Guide

This repository provides instructions on how to use the standard **OpenClaude** CLI with **NVIDIA NIM** inference endpoints, defaulting to the **Qwen3 Coder 480B A35B Instruct**.

---

## 🚀 1. Install OpenClaude
Install the vanilla OpenClaude CLI globally on your system:

```bash
sudo npm install -g @gitlawb/openclaude
```

---

## 🔑 2. Get your NVIDIA NIM Key
1. Go to the [Qwen3 Coder 480B A35B Instruct Page](https://build.nvidia.com/qwen/qwen3-coder-480b-a35b-instruct).
2. Create a free account or sign in.
3. Click **Get API Key** and copy the `nvapi-` token.

---

## ⚙️ 3. Configure for NVIDIA NIM
Add these exports to your shell profile (`~/.zshrc` or `~/.bashrc`) to lock in the **Qwen3 Coder 480B A35B Instruct** default.

```bash
export CLAUDE_CODE_USE_OPENAI=1
export OPENAI_BASE_URL="https://integrate.api.nvidia.com/v1"
export OPENAI_API_KEY="your-nvapi-key-here"
export OPENAI_MODEL="qwen/qwen3-coder-480b-a35b-instruct"
```

---

## 🏎️ 4. Launch
Once configured, simply run:
```bash
openclaude
```
The agent will now use the **Qwen3 Coder 480B A35B Instruct** for all coding and reasoning tasks via NVIDIA NIM.
