# 🤖 JARVIS HYBRID

**AI Agent System — Cloud Brain + Desktop Hands**

A hybrid AI assistant that runs its brain on the cloud (Vercel) and controls your desktop locally. Best of both worlds: accessible from anywhere, with full system control when at your computer.

## 🏗️ Architecture

```
☁️ CLOUD (Vercel - Next.js)
├── LLM Router (Groq/Gemini/OpenAI/ZAI)
├── Agent Core (Task Classification)
├── Sub-Agents (Browser, Product Hunter, Code)
├── Memory System
└── Web Chat UI + Settings

💻 DESKTOP (Python)
├── Cloud Connector
├── Windows Agent (Screenshot, Apps, System)
├── File Agent (Download, Read, Write, Organize)
├── Upload Agent (Redbubble, Amazon)
├── Voice Engine (Piper TTS, Whisper STT)
└── CustomTkinter GUI
```

## 🖥️ Local Windows Development (Quick Start)

Perfect for testing and development on Windows. Run both cloud and desktop agents locally.

### Prerequisites
- Windows 10 or 11
- Python 3.11+ ([python.org](https://www.python.org/downloads/))
- Node.js 18+ ([nodejs.org](https://nodejs.org/))
- VS Code ([code.visualstudio.com](https://code.visualstudio.com/))

### Setup (One-Time)

1. **Open VS Code** terminal at the project root
2. **Run setup script:**
   ```bash
   setup_windows.bat
   ```
   This will:
   - Create Python virtual environment
   - Install Python dependencies
   - Install Node.js packages
   - Optionally install Playwright browsers

### Running Locally

**Open TWO terminal windows in VS Code:**

**Terminal 1 - Cloud Backend (Next.js):**
```bash
run_cloud.bat
```
Cloud will start at `http://localhost:3000`

**Terminal 2 - Desktop Agent (Python):**
```bash
run_desktop.bat
```
Agent connects to local cloud backend

### Testing Desktop Automation

In the desktop agent terminal, try these commands:

```
take screenshot
open notepad
open https://youtube.com
google search python tutorials
type_text Hello World
click 500 500
system info
!help
```

### Or Start Everything at Once

```bash
run_all_dev.bat
```

This launches cloud and desktop in separate windows.

---

## ☁️ Vercel Deployment (Production)

### Step 1: Import Repo
1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your fork of `JARVIS-HYBRID`

### Step 2: Root Directory (CRITICAL!)
- **Root Directory:** Leave empty (Next.js app is at repository root)
- The Next.js app is NOT in a `cloud/` subfolder

### Step 3: Deploy
1. Click **"Deploy"**
2. Wait for build to complete (~30 seconds)

### Step 4: Add API Keys
1. Open your deployed app URL
2. Click **⚙️ Settings** in top-right
3. Add at least one API key:
   - 🆓 **Groq** — [console.groq.com](https://console.groq.com)
   - 🆓 **Gemini** — [aistudio.google.com](https://aistudio.google.com/apikey)
   - 💰 **OpenAI** — [platform.openai.com](https://platform.openai.com/api-keys)
   - 🆓 **ZAI** — [open.bigmodel.cn](https://open.bigmodel.cn)
4. Click **💾 Save & Close**

> **Note:** API keys are stored in browser localStorage. They are never sent to our servers except to make LLM API calls on your behalf.

### Connect Desktop Agent to Cloud

```bash
cd desktop
python -m jarvis.main --cloud-url https://your-deployed-app.vercel.app --gui
```

## 🌐 Features

### Cloud Features (Works from any browser)
- 💬 Real-time streaming chat with 4 LLM providers
- ⚙️ Settings panel to manage API keys from browser
- 🔄 Auto-fallback between providers if one fails
- 🔍 Web search & research
- 🔥 Product trend analysis & SEO
- 💻 Code writing, debugging & review
- 🗣️ Browser-based voice (TTS/STT)
- 📊 Conversation memory & stats

### Desktop Features (Requires local agent)
- 📸 Screenshots & screen control
- 📁 File operations (download, read, write, organize)
- ⬆️ Upload to Redbubble, Amazon
- 🎤 Offline voice (Piper TTS Urdu, Kokoro English)
- 🖥️ System control (volume, brightness, apps)
- 📋 Clipboard read/write

## 🛠️ Tech Stack

| Component | Technology |
|-----------|-----------|
| Cloud Framework | Next.js 16 |
| LLM Provider 1 | Groq (llama-3.3-70b-versatile) 🆓 |
| LLM Provider 2 | Google Gemini 1.5 Flash 🆓 |
| LLM Provider 3 | OpenAI (GPT-4o Mini) 💰 |
| LLM Provider 4 | ZAI (GLM-4 Flash) 🆓 |
| Desktop Language | Python 3.11+ |
| Desktop GUI | CustomTkinter |
| TTS (Urdu) | Piper ONNX |
| TTS (English) | Kokoro ONNX |
| STT | faster-whisper |
| Deployment | Vercel |

## 📁 Project Structure

```
JARVIS-HYBRID/
├── cloud/                    # ☁️ Vercel Deployment
│   ├── app/
│   │   ├── api/
│   │   │   ├── chat/route.ts         # Main chat endpoint
│   │   │   ├── agent/route.ts        # Agent interaction
│   │   │   ├── memory/route.ts       # Memory CRUD
│   │   │   ├── voice/route.ts        # Voice proxy
│   │   │   └── health/route.ts       # Health check
│   │   ├── page.tsx                  # Web chat UI + Settings
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── lib/
│   │   ├── llm-router.ts            # 4-provider router with auto-fallback
│   │   ├── agent-core.ts            # Task classification & routing
│   │   ├── protocol.ts              # Shared types & constants
│   │   ├── memory.ts                # In-memory + Vercel KV
│   │   └── sub-agents/
│   │       ├── base-agent.ts        # Base agent class
│   │       ├── browser-agent.ts     # Web search
│   │       ├── product-hunter.ts    # Product research
│   │       └── code-agent.ts        # Code operations
│   └── package.json
│
├── desktop/                  # 💻 Local Desktop Agent
│   └── jarvis/
│       ├── connector.py              # Cloud connection
│       ├── main.py                   # Entry point
│       ├── config.json               # Configuration
│       ├── local_agents/
│       │   ├── windows_agent.py      # OS control
│       │   ├── file_agent.py         # File operations
│       │   └── upload_agent.py       # Upload automation
│       └── voice/
│           └── voice_engine.py       # Offline TTS/STT
```

## 🗣️ Bilingual Support

JARVIS speaks both **Urdu** and **English** naturally:

- **Urdu input** → Urdu response
- **English input** → English response
- **Mixed input** → Mixed response
- **Emotion detection** in both languages

## 🎭 Emotion Engine

6 emotion profiles that affect response style and voice:

| Emotion | Trigger Words | Voice Effect |
|---------|--------------|-------------|
| 😊 Happy | شکریہ, thanks, great | Faster, higher pitch |
| 💪 Encouraging | مدد, help, can't | Warm, supportive |
| ⚡ Serious | خطرہ, delete, danger | Slower, lower pitch |
| 💙 Sympathetic | اداس, sad, worried | Gentle, soft |
| 😲 Surprised | ارے, wow, really | Faster, excited |
| 🤖 Normal | Default | Balanced |

## 📄 License

MIT
