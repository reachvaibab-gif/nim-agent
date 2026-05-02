<div align="center">
  <h1>⚡ NIM-Agent</h1>
  <p><b>High-Performance OpenClaude Configuration for NVIDIA NIM</b></p>
  
  <p>
    <a href="https://build.nvidia.com/qwen/qwen3-coder-480b-a35b-instruct"><img src="https://img.shields.io/badge/Model-Qwen3_Coder_480B_A35B_Construct-76b900?style=for-the-badge&logo=nvidia" alt="Model"></a>
    <img src="https://img.shields.io/badge/Infrastructure-NVIDIA_NIM-black?style=for-the-badge" alt="NIM">
  </p>
</div>

<br/>

> **Overview:** NIM-Agent provides the exact protocol required to run the standard **OpenClaude** CLI backed by **NVIDIA NIM** inference endpoints. By routing through NVIDIA, you unlock ultra-low latency inference for flagship models.

<br/>

## 🚀 Deployment Protocol

<details open>
<summary><b>Step 1: Install OpenClaude Core</b></summary>
<br/>

Install the vanilla OpenClaude engine globally. This requires Node.js to be installed on your system.

```bash
sudo npm install -g @gitlawb/openclaude
```
</details>

<details open>
<summary><b>Step 2: Provision Neural Keys</b></summary>
<br/>

1. Navigate to the official [Qwen3 Coder 480B A35B Instruct Portal](https://build.nvidia.com/qwen/qwen3-coder-480b-a35b-instruct).
2. Authenticate to receive your complimentary developer credits.
3. Select **Get API Key** and copy the generated token (`nvapi-...`).
</details>

<details open>
<summary><b>Step 3: Interactive Configuration</b></summary>
<br/>

OpenClaude features an intelligent initialization wizard. Follow these exact steps to lock in the NVIDIA infrastructure:

1. **Initialize the Agent:**
   ```bash
   openclaude
   ```
2. **Select Provider Category:** When the interface presents the category selection, navigate to and select **`Third Party`**.
3. **Target Infrastructure:** Scroll through the available third-party providers and select **`NVIDIA NIM`**.
4. **Authenticate:** Paste the `nvapi-` token you generated in Step 2 when prompted for the API Key.

*The system is now fully operational and routing through the NVIDIA kernel.*
</details>

<br/>

<div align="center">
  <sub>Built for precision. Architected by <a href="https://github.com/reachvaibab-gif">reachvaibab-gif</a>.</sub>
</div>
