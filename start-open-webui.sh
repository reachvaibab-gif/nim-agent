#!/bin/bash
# ============================================================
# Open WebUI — NIM Agent Launcher
# ============================================================
# Pre-configured to connect to NVIDIA NIM OpenAI-compatible API.
# First run: set your API key below OR export it before running:
#   export NIM_API_KEY="nvapi-xxxxxxxxxxxx"
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VENV="$SCRIPT_DIR/open-webui-env"

if [ ! -f "$VENV/bin/open-webui" ]; then
  echo "[!] open-webui not found in venv. Run: python3.11 -m venv open-webui-env && open-webui-env/bin/pip install open-webui"
  exit 1
fi

# ── NIM API key ──────────────────────────────────────────────
# Prefer env var; fall back to the value below (edit it once)
NIM_KEY="${NIM_API_KEY:-YOUR_NVAPI_KEY_HERE}"

if [ "$NIM_KEY" = "YOUR_NVAPI_KEY_HERE" ]; then
  echo ""
  echo "  ⚠️  Set your NIM API key first:"
  echo "     export NIM_API_KEY='nvapi-xxxxxxxxx'"
  echo "     ./start-open-webui.sh"
  echo ""
  exit 1
fi

# ── Configuration ─────────────────────────────────────────────
export OPENAI_API_BASE_URL="https://integrate.api.nvidia.com/v1"
export OPENAI_API_KEY="$NIM_KEY"

# Data directory (chat history, users, settings)
export DATA_DIR="$SCRIPT_DIR/open-webui-data"
mkdir -p "$DATA_DIR"

# Disable Ollama so Open WebUI only shows NIM models
export ENABLE_OLLAMA_API="false"

# Port (change if 8080 is taken)
PORT="${OWUI_PORT:-8080}"

echo "────────────────────────────────────────────────────────"
echo "  Open WebUI  →  http://localhost:$PORT"
echo "  Backend     →  NVIDIA NIM  (integrate.api.nvidia.com)"
echo "────────────────────────────────────────────────────────"
echo ""

"$VENV/bin/open-webui" serve --port "$PORT"
