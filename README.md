# 🚀 NIM-Agent: NVIDIA-Powered Claude Code

NIM-Agent is a high-performance distribution of **Claude Code** (via OpenClaude) that replaces the default Anthropic backend with **NVIDIA NIM**. This allows you to use state-of-the-art coding models for free or at a fraction of the cost.

---

## 🛠️ Complete Setup Guide

### Step 1: Install the NIM-Agent Engine
Run this command in your terminal. It will install the core engine and apply the surgical patch to hardcode the NVIDIA infrastructure.

```bash
curl -sSL https://raw.githubusercontent.com/reachvaibab-gif/nim-agent/main/setup-nim.sh | bash
```

### Step 2: Obtain your NVIDIA NIM API Key
1. Go to the [NVIDIA Build Portal](https://build.nvidia.com).
2. Sign in or create a free account (New accounts get **1,000 free credits**).
3. Search for **"Qwen 3 Coder 480B"** (Recommended for Coding) or **"Llama 3.1 405B"** (Recommended for Agentic Tasks).
4. Click the **"Get API Key"** button.
5. Copy the key (it starts with `nvapi-`).

### Step 3: Launch & Authenticate
Launch the CLI by typing:
```bash
openclaude
```
When prompted for the **API Key**, paste your `nvapi-` key. The system is already hardcoded to route your requests through NVIDIA's high-speed integration endpoints.

---

## ✨ Features & Optimizations
- **Hardcoded NIM Backend**: No need to manually set `OPENAI_BASE_URL`.
- **Recommended Labels**: The UI highlights the best models for the task.
- **Zero-Config Deployment**: Works out of the box after the initial patch.

---
*Developed by reachvaibab-gif. This is an independent project and is not affiliated with Anthropic or NVIDIA.*
