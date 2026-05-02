#!/bin/bash
# OpenClaude Standard Installer
set -e

echo "--- OpenClaude Installation ---"
if ! command -v npm &> /dev/null; then
    echo "Error: npm not found."
    exit 1
fi

echo "[*] Installing @gitlawb/openclaude globally..."
sudo npm install -g @gitlawb/openclaude

echo "[+] Installation complete. Type 'openclaude' to start."
echo "[*] See README.md for NVIDIA NIM configuration instructions."
