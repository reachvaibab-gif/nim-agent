# NIM-Agent (NVIDIA NIM Claude Code Patch)

NIM-Agent is an optimized distribution of Claude Code (via OpenClaude) engineered to prioritize **NVIDIA NIM** as the primary backend. It enables free-tier coding agent capabilities using flagship models like Qwen 3 Coder.

## 🚀 One-Line Installation

Run the following command to install OpenClaude and apply the NIM surgical patch:

```bash
curl -sSL https://reachvaibab-gif.github.io/nim-agent/setup-nim.sh | bash
```

## ✨ Features
- **NIM-First Onboarding**: The setup flow defaults to NVIDIA NIM infrastructure.
- **Agentic Model Tagging**: Built-in `(Recommended)` labels for Qwen 3 Coder (480B) and Llama 3.1 (405B).
- **Embedded Instructions**: Guidance on how to obtain your free `nvapi-` key is built directly into the CLI prompts.

## 🔑 How to get your API Key
1. Go to [build.nvidia.com](https://build.nvidia.com).
2. Login/Register for a free account (includes 1,000 free credits).
3. Select **Qwen 3 Coder 480B** (or your preferred model).
4. Click **Get API Key**.
5. Copy the key and paste it when prompted by the CLI.

---
*Disclaimer: This is an independent patch and is not affiliated with Anthropic or NVIDIA.*
