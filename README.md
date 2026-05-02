# NIM-Agent

> **NVIDIA NIM × Open WebUI** — The easiest way to run a feature-complete AI chat interface on top of free NVIDIA NIM models (Qwen3 Coder 480B, Llama 3.1 405B, Nemotron 253B and more).

---

## 🚀 Quick Start (Open WebUI — Recommended)

### 1. Get a free NIM API key
1. Go to [build.nvidia.com](https://build.nvidia.com)
2. Log in / register (includes **1,000 free credits**)
3. Open any model → **Get API Key**
4. Copy your `nvapi-...` key

### 2. Install Open WebUI (one-time)

```bash
cd nim-agent
python3.11 -m venv open-webui-env
open-webui-env/bin/pip install open-webui
```

### 3. Launch

```bash
export NIM_API_KEY="nvapi-xxxxxxxxxxxxxxxxxxxx"
./start-open-webui.sh
```

Then open **http://localhost:8080** in your browser.

On first launch, Open WebUI will ask you to create an **admin account** (local, stored in `open-webui-data/`). After signing in:

1. **Admin Settings → Connections → OpenAI** — confirm the connection to `https://integrate.api.nvidia.com/v1` is verified ✅
2. Select your model in the top model picker and start chatting.

---

## ✨ What you get

| Feature | Detail |
|---|---|
| Multi-model selector | Switch between Qwen3, Llama, Nemotron, Mistral in one click |
| Full chat history | Persistent, searchable conversation history |
| File uploads | PDFs, images, code files — all supported |
| Artifacts / Code preview | Syntax-highlighted code with copy/download |
| Web search | Built-in tool use (enable in settings) |
| Image generation | Connect an image model endpoint |
| RAG / Knowledge base | Upload documents as knowledge sources |
| Admin panel | User management, rate limits, API keys |
| Themes | Dark/light, custom CSS |

---

## 🌐 Custom Web UI (GitHub Pages — Legacy)

The hand-built UI in `docs/` is still live at your GitHub Pages domain with its Cloudflare Worker backend. It's now the lightweight fallback; Open WebUI is the primary interface.

To use the Cloudflare Worker as the backend instead of the direct NIM API:

```bash
export OPENAI_API_BASE_URL="https://nim-proxy.jookkk4.workers.dev/v1"
export OPENAI_API_KEY="your-nim-chat-user-password"
```

---

## 🔑 Environment variables

| Variable | Description |
|---|---|
| `NIM_API_KEY` | Your `nvapi-...` key from build.nvidia.com |
| `OWUI_PORT` | Port to serve on (default `8080`) |

---

*Open WebUI is an independent open-source project — [github.com/open-webui/open-webui](https://github.com/open-webui/open-webui)*
