<!-- HEADER -->
<div align="center">

<!-- Animated Typing Banner -->
<img src="https://readme-typing-svg.demolab.com?font=JetBrains+Mono&weight=900&size=40&pause=1000&color=76B900&center=true&vCenter=true&width=800&height=80&lines=%E2%9A%A1+NIM-AGENT;NVIDIA+NIM+%C3%97+Claude+Code;480B+Parameters.+Zero+Config.;The+Future+of+Agentic+AI." alt="Typing SVG" />

<!-- Wave Separator -->
<img src="https://capsule-render.vercel.app/api?type=waving&color=0:000000,100:76B900&height=80&section=header&reversal=false" width="100%" />

<!-- Core Badges -->
<a href="https://build.nvidia.com/qwen/qwen3-coder-480b-a35b-instruct">
  <img src="https://img.shields.io/badge/MODEL-Qwen3_Coder_480B_A35B_Instruct-76b900?style=for-the-badge&logo=nvidia&logoColor=white" alt="Model"/>
</a>
<a href="https://www.npmjs.com/package/@gitlawb/openclaude">
  <img src="https://img.shields.io/badge/ENGINE-OpenClaude-black?style=for-the-badge&logo=anthropic&logoColor=white" alt="Engine"/>
</a>
<a href="https://integrate.api.nvidia.com/v1">
  <img src="https://img.shields.io/badge/BACKEND-integrate.api.nvidia.com%2Fv1-76b900?style=for-the-badge" alt="API"/>
</a>

<br/><br/>

<!-- Stat Pills -->
<img src="https://img.shields.io/badge/Parameters-480_Billion-blueviolet?style=flat-square" />
<img src="https://img.shields.io/badge/Architecture-A35B_Instruct-blue?style=flat-square" />
<img src="https://img.shields.io/badge/Free_Credits-1%2C000-green?style=flat-square" />
<img src="https://img.shields.io/badge/Config-Zero-orange?style=flat-square" />
<img src="https://img.shields.io/badge/Latency-Ultra_Low-red?style=flat-square" />

</div>

<br/>

<!-- ABOUT -->
<img align="left" width="80" height="80" src="https://skillicons.dev/icons?i=ai" />

### **NIM-Agent** is a precision-configured deployment of the OpenClaude terminal agent, hardwired to NVIDIA NIM inference infrastructure. Run a 480-billion parameter coding oracle directly in your terminal. No hacks. No patches. Pure integration.

<br clear="left"/>

---

## 📡 Deployment Matrix

<div align="center">

| Step | Action | Status |
|:----:|:-------|:------:|
| `01` | Install OpenClaude Core | ![req](https://img.shields.io/badge/REQUIRED-red?style=flat-square) |
| `02` | Provision NVIDIA NIM Key | ![req](https://img.shields.io/badge/REQUIRED-red?style=flat-square) |
| `03` | Run Interactive Setup Wizard | ![easy](https://img.shields.io/badge/2_MINUTES-76b900?style=flat-square) |

</div>

---

## ⚙️ Protocol

<details open>
<summary><b>[ 01 ] — Install OpenClaude Core Engine</b></summary>
<br/>

Install the base CLI engine globally. Requires **Node.js** (v18+).

```bash
sudo npm install -g @gitlawb/openclaude
```

> ✅ **Verify:** Run `openclaude --version` to confirm successful deployment.

</details>

---

<details open>
<summary><b>[ 02 ] — Provision Your NVIDIA NIM Key</b></summary>
<br/>

Navigate to the **[Qwen3 Coder 480B A35B Instruct](https://build.nvidia.com/qwen/qwen3-coder-480b-a35b-instruct)** endpoint page.

1. Sign up for a **free NVIDIA developer account** — you receive `1,000` free inference credits instantly.
2. Click the **`Get API Key`** button on the model page.
3. Copy the generated token — it begins with **`nvapi-`**.

> 🔑 **Keep your key safe.** You only need to enter it once during the setup wizard.

</details>

---

<details open>
<summary><b>[ 03 ] — Run the Interactive Setup Wizard</b></summary>
<br/>

Fire up the agent. The first-launch wizard will guide you through configuration.

```bash
openclaude
```

Follow these exact navigation steps inside the wizard:

```
┌─────────────────────────────────────────────────────────────┐
│                 OPENCLAUDE SETUP WIZARD                     │
│─────────────────────────────────────────────────────────────│
│                                                             │
│  Select provider type:                                      │
│                                                             │
│    ○  Anthropic (Default)                                   │
│    ○  Anthropic Supported                                   │
│  ● ►  Third Party          <-- SELECT THIS                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────┐
│                 SELECT PROVIDER                             │
│─────────────────────────────────────────────────────────────│
│                                                             │
│    ○  OpenAI                                                │
│    ○  Azure OpenAI                                          │
│    ○  Groq                                                  │
│    ○  Together AI                                           │
│  ● ►  NVIDIA NIM           <-- SELECT THIS                  │
│    ○  ...                                                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────┐
│  API Key › [ paste your nvapi-... token here ]              │
└─────────────────────────────────────────────────────────────┘
```

> ⚡ **Done.** The agent is now fully live on NVIDIA infrastructure.

</details>

---

## 🧠 Model Specifications

<div align="center">

| Property | Value |
|:---------|------:|
| **Model** | Qwen3 Coder 480B A35B Instruct |
| **Provider** | NVIDIA NIM |
| **Endpoint** | `https://integrate.api.nvidia.com/v1` |
| **Parameters** | 480,000,000,000 |
| **Architecture** | Mixture of Experts (A35B active) |
| **Optimized For** | Code generation, debugging, agentic tasks |

</div>

---

<!-- FOOTER -->
<img src="https://capsule-render.vercel.app/api?type=waving&color=0:76B900,100:000000&height=80&section=footer" width="100%" />

<div align="center">
  <sub>Architected by <a href="https://github.com/reachvaibab-gif">reachvaibab-gif</a> · Powered by <a href="https://build.nvidia.com">NVIDIA NIM</a></sub>
</div>
