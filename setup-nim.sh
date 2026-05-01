#!/bin/bash
# NIM-Agent Ultra-Surgical Installer v2.1
set -e

echo "--------------------------------------------------"
echo "   NIM-AGENT: FULL STACK SURGICAL INSTALLER      "
echo "--------------------------------------------------"

# 1. Platform Detection & Tool Check
echo "[*] Verifying environment dependencies..."
if ! command -v npm &> /dev/null; then
    echo "[!] Fatal: Node.js/npm not detected. Please install Node.js from https://nodejs.org/"
    exit 1
fi

# 2. OpenClaude Core Deployment (Atomic)
if ! command -v openclaude &> /dev/null; then
    echo "[*] OpenClaude not detected. Initiating global deployment..."
    # Attempt install with sudo if required by permission model
    sudo npm install -g @gitlawb/openclaude || {
        echo "[!] Sudo failed. Attempting standard install..."
        npm install -g @gitlawb/openclaude
    }
else
    echo "[+] Core engine detected. Checking for updates..."
    sudo npm update -g @gitlawb/openclaude 2>/dev/null || true
fi

# 3. Patch Target Identification
# We check common global node_modules paths
PATHS=(
    "/usr/local/lib/node_modules/@gitlawb/openclaude/dist/cli.mjs"
    "/opt/homebrew/lib/node_modules/@gitlawb/openclaude/dist/cli.mjs"
    "$(npm root -g)/@gitlawb/openclaude/dist/cli.mjs"
)

TARGET=""
for p in "${PATHS[@]}"; do
    if [ -f "$p" ]; then
        TARGET="$p"
        break
    fi
done

if [ -z "$TARGET" ]; then
    echo "[!] Error: Deployment path not found. Installation may have failed."
    exit 1
fi

echo "[+] Target identified at: $TARGET"

# 4. Neural Backend Overdrive Patch
echo "[*] Injecting NIM kernel overrides and recommended labels..."
sudo python3 - << PYEOF
import os
TARGET = "$TARGET"

with open(TARGET, 'r') as f:
    content = f.read()

# Core NIM Infrastructure Redirection
env_overrides = [
    'process.env.CLAUDE_CODE_USE_OPENAI = "1";',
    'process.env.OPENAI_BASE_URL = "https://integrate.api.nvidia.com/v1";',
    'process.env.OPENAI_MODEL = "nvidia/qwen-2.5-coder-32b";' # Hardcoded default for zero-config
]
header = "\\n" + "\\n".join(env_overrides) + "\\n"

if "CLAUDE_CODE_USE_OPENAI" not in content:
    content = header + content

# UI Enhancement Layer
content = content.replace('label: "Qwen 3 Coder 480B"', 'label: "Qwen 3 Coder 480B (Recommended)"')
content = content.replace('label: "Llama 3.1 405B"', 'label: "Llama 3.1 405B (Recommended)"')
content = content.replace('description: "NVIDIA NIM endpoint"', 'description: "NVIDIA NIM (Free keys at build.nvidia.com)"')
content = content.replace('label: "API Key"', 'label: "API Key (Get free at build.nvidia.com)"')

with open("/tmp/nim_patch.mjs", 'w') as f:
    f.write(content)
PYEOF

sudo cp /tmp/nim_patch.mjs "$TARGET"
rm /tmp/nim_patch.mjs

echo "--------------------------------------------------"
echo "[+] SUCCESS: NIM-Agent stack fully deployed."
echo "[>] Execute with: openclaude"
echo "--------------------------------------------------"
