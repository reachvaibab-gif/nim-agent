#!/bin/bash
# NIM-Agent Surgical Installer v2.0
set -e

echo "----------------------------------------"
echo "   NIM-AGENT: SURGICAL INSTALLER      "
echo "----------------------------------------"

# 1. Dependency Check
if ! command -v npm &> /dev/null; then
    echo "[!] Error: npm is not installed. Please install Node.js first."
    exit 1
fi

# 2. Base Engine Installation
if ! command -v openclaude &> /dev/null; then
    echo "[*] Installing OpenClaude engine..."
    sudo npm install -g @gitlawb/openclaude
fi

# 3. Patch Identification
TARGET="/usr/local/lib/node_modules/@gitlawb/openclaude/dist/cli.mjs"
if [ ! -f "$TARGET" ]; then
    echo "[!] Error: OpenClaude installation not found at $TARGET"
    exit 1
fi

# 4. Apply Logic & UI Patch
echo "[*] Injecting NIM logic and recommended labels..."
sudo python3 - << 'EOF'
import os
TARGET = "/usr/local/lib/node_modules/@gitlawb/openclaude/dist/cli.mjs"

with open(TARGET, 'r') as f:
    content = f.read()

# Prepend NIM environment defaults
env_override = '\nprocess.env.CLAUDE_CODE_USE_OPENAI = "1";\nprocess.env.OPENAI_BASE_URL = "https://integrate.api.nvidia.com/v1";\n'
if "CLAUDE_CODE_USE_OPENAI" not in content:
    content = env_override + content

# Inject UI recommendations
content = content.replace('label: "Qwen 3 Coder 480B"', 'label: "Qwen 3 Coder 480B (Recommended)"')
content = content.replace('label: "Llama 3.1 405B"', 'label: "Llama 3.1 405B (Recommended)"')
content = content.replace('description: "NVIDIA NIM endpoint"', 'description: "NVIDIA NIM (Free keys at build.nvidia.com)"')
content = content.replace('label: "API Key"', 'label: "API Key (Get free at build.nvidia.com)"')

with open("/tmp/nim_patch.mjs", 'w') as f:
    f.write(content)
EOF

sudo cp /tmp/nim_patch.mjs "$TARGET"
rm /tmp/nim_patch.mjs

echo "----------------------------------------"
echo "[+] SUCCESS: NIM-Agent is now deployed."
echo "[>] Run it now: openclaude"
echo "----------------------------------------"
