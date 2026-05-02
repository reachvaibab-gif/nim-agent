# ⚡ NIM-Agent: NVIDIA NIM Configuration Guide

This repository provides instructions on how to use the standard **OpenClaude** CLI with **NVIDIA NIM** inference endpoints.

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
3. Search for a model (e.g., **Qwen 2.5 Coder 32B**).
4. Click **Get API Key** and copy the `nvapi-` token.

---

## ⚙️ 3. Configure for NVIDIA NIM
To route OpenClaude traffic through NVIDIA, you must set the following environment variables in your terminal. 

### Option A: Temporary (Current Session)
Run these commands before launching the CLI:

```bash
export CLAUDE_CODE_USE_OPENAI=1
export OPENAI_BASE_URL="https://integrate.api.nvidia.com/v1"
export OPENAI_API_KEY="your-nvapi-key-here"
export OPENAI_MODEL="nvidia/qwen-2.5-coder-32b"
```

### Option B: Permanent (Recommended)
Add the exports to your shell profile (`~/.zshrc` or `~/.bashrc`):

```bash
echo 'export CLAUDE_CODE_USE_OPENAI=1' >> ~/.zshrc
echo 'export OPENAI_BASE_URL="https://integrate.api.nvidia.com/v1"' >> ~/.zshrc
echo 'export OPENAI_API_KEY="your-nvapi-key-here"' >> ~/.zshrc
echo 'export OPENAI_MODEL="nvidia/qwen-2.5-coder-32b"' >> ~/.zshrc
source ~/.zshrc
```

---

## 🏎️ 4. Launch
Once configured, simply run:
```bash
openclaude
```
The agent will now use NVIDIA NIM for all coding and reasoning tasks.
