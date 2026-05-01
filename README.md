# ⚡ NIM-Agent

**High-performance Claude Code distribution powered by NVIDIA NIM.**

NIM-Agent is a surgically-patched version of the Claude Code CLI (via OpenClaude) that redirects all inference traffic through **NVIDIA's integration endpoints**. This enables the use of 400B+ parameter models (Qwen, Llama 3.1) with ultra-low latency and zero configuration.

---

## 🚀 Rapid Deployment

### 1. Install & Patch
Execute this command to install the base engine and inject the NIM-backend overrides.
```bash
curl -sSL https://raw.githubusercontent.com/reachvaibab-gif/nim-agent/main/setup-nim.sh | bash
```

### 2. Key Provisioning
*   **Source**: [build.nvidia.com](https://build.nvidia.com)
*   **Account**: Sign up for a free developer account (1,000 free credits included).
*   **Model**: Search for `Qwen 2.5 Coder 32B` or `Llama 3.1 405B`.
*   **Extraction**: Click "Get API Key" and copy the token (starts with `nvapi-`).

### 3. Execution
Launch the agent:
```bash
openclaude
```
When prompted for the **API Key**, paste your `nvapi-` token. The system is pre-configured to handle the routing automatically.

---

## 🛠️ Technical Specifications

### What the Patch Does:
- **Kernel Override**: Injects `process.env.OPENAI_BASE_URL` directly into the bundled binary.
- **Provider Priority**: Reorders the selection menu to default to **NVIDIA NIM**.
- **Model Tagging**: Adds `(Recommended)` labels to high-performance coding models.
- **Transport Hardening**: Enforces OpenAI-compatible protocol headers for NIM integration.

### Recommended Models:
- `nvidia/qwen-2.5-coder-32b` — **Best for complex logic and refactoring.**
- `meta/llama-3.1-405b` — **Best for high-level agentic planning.**

---
*Maintained by reachvaibab-gif. Zero dependencies beyond Node.js.*
