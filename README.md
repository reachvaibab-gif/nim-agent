# ⚡ NIM-Agent: NVIDIA NIM Configuration Guide

This repository provides instructions on how to set up and use the standard **OpenClaude** CLI with **NVIDIA NIM** inference endpoints, featuring the **Qwen3 Coder 480B A35B Instruct**.

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
3. Click **Get API Key** and copy the token (starts with `nvapi-`).

---

## ⚙️ 3. Interactive Setup
You do not need to manually export environment variables. OpenClaude has a built-in interactive setup menu.

1. Launch the CLI for the first time:
   ```bash
   openclaude
   ```
2. When prompted to select a provider category, choose **Third Party**.
3. Scroll down the list of providers and select **NVIDIA NIM**.
4. Follow the on-screen instructions. When asked for your API Key, paste the `nvapi-` token you copied earlier.

The agent is now fully configured and will route all reasoning and coding tasks through the ultra-fast NVIDIA NIM infrastructure.
