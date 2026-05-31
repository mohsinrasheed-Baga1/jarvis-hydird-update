# 🤖 JARVIS HYBRID

**AI Agent System — Cloud Brain + Desktop Hands**

A hybrid AI assistant that runs its brain on the cloud (Vercel) and controls your desktop locally. Best of both worlds: accessible from anywhere, with full system control when at your computer.

## 🏗️ Architecture

```
☁️ CLOUD (Vercel - Next.js)
├── LLM Router (Groq/Gemini)
├── Agent Core (Task Classification)
├── Sub-Agents (Browser, Product Hunter, Code)
├── Memory System
└── Web Chat UI

💻 DESKTOP (Python)
├── Cloud Connector
├── Windows Agent (Screenshot, Apps, System)
├── File Agent (Download, Read, Write, Organize)
├── Upload Agent (Redbubble, Amazon)
├── Voice Engine (Piper TTS, Whisper STT)
└── CustomTkinter GUI
```

## 🚀 Quick Start

### Cloud Deployment (Vercel)

1. **Fork/Clone this repo**
2. **Set Environment Variables on Vercel:**
   - `GROQ_API_KEY` — Get from [console.groq.com](https://console.groq.com)
   - `GEMINI_API_KEY` — Get from [makersuite.google.com](https://makersuite.google.com)
3. **Deploy to Vercel** — Import the repo and deploy

### Desktop Agent

```bash
cd desktop
pip install -r requirements.txt
python -m jarvis.main --cloud-url https://your-jarvis.vercel.app --gui
```

## 🌐 Features

### Cloud Features (Works from any browser)
- 💬 Real-time streaming chat
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
| LLM (Primary) | Groq (llama-3.3-70b-versatile) |
| LLM (Fallback) | Google Gemini 1.5 Flash |
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
│   │   ├── page.tsx                  # Web chat UI
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── lib/
│   │   ├── llm-router.ts            # Groq/Gemini dual router
│   │   ├── agent-core.ts            # Task classification & routing
│   │   ├── memory.ts                # In-memory + Vercel KV
│   │   └── sub-agents/
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
│
└── shared/                   # 🔗 Shared protocol types
    └── protocol.ts
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
