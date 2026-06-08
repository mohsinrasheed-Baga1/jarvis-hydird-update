# 🛠️ JARVIS Hybrid - Developer Guide

**Version:** 2.0.0 | **Platform:** Windows/Linux/macOS | **Last Updated:** June 5, 2026

---

## Architecture Overview

JARVIS Hybrid consists of three main components:

```
┌─────────────────────────────────────────────────────────────┐
│                    JARVIS.exe (Electron)                     │
│  ├── React UI (localhost UI or bundled)                     │
│  ├── Electron Main Process                                  │
│  │   ├── Cloud Backend Launcher (Node.js subprocess)       │
│  │   ├── Python Agent Launcher (subprocess)                 │
│  │   └── IPC Bridge                                         │
│  └── System Tray & Auto-Updater                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                 Cloud Backend (Next.js)                      │
│  ├── LLM Router (Groq/Gemini/OpenAI/ZAI)                    │
│  ├── Agent Core (Task Classification)                       │
│  ├── Sub-Agents (Browser, Code, Freelance, WhatsApp)       │
│  ├── Memory System                                          │
│  └── Task Queue                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│               Python Desktop Agent                           │
│  ├── Windows Agent (Screenshots, Apps, System)             │
│  ├── File Agent (Read, Write, Download)                     │
│  ├── Voice Engine (TTS/STT)                                 │
│  └── Cloud Connector (Task Polling)                         │
└─────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Frontend (Desktop App)
- **Electron 34** — Desktop wrapper
- **React 19** — UI framework
- **TypeScript** — Type safety
- **Tailwind CSS** — Styling
- **Vite 6** — Build tool

### Backend (Cloud)
- **Next.js 16** — API framework
- **Groq SDK** — LLM integration
- **Google Generative AI** — Gemini
- **Zod** — Validation

### Desktop Agent
- **Python 3.11+** — Core language
- **PyAutoGUI** — Mouse/keyboard automation
- **Pillow** — Screenshots
- **CustomTkinter** — GUI (optional)
- **Piper/Kokoro** — Voice TTS
- **faster-whisper** — Voice STT

---

## Project Structure

```
JARVIS-HYBRID/
├── desktop-app/                  # Electron + React Desktop App
│   ├── electron/
│   │   ├── main.js               # Electron main process
│   │   └── preload.js            # IPC bridge
│   ├── src/
│   │   ├── pages/                # Page components
│   │   │   ├── ChatPage.tsx
│   │   │   ├── SettingsPage.tsx
│   │   │   ├── VoicePage.tsx
│   │   │   ├── FilesPage.tsx
│   │   │   ├── MemoryPage.tsx
│   │   │   ├── AutomationPage.tsx
│   │   │   └── StatusPage.tsx
│   │   ├── components/           # UI components
│   │   ├── services/             # API clients
│   │   ├── App.tsx               # Main app
│   │   └── main.tsx              # Entry point
│   ├── assets/                   # Icons, images
│   ├── build/                    # Build config
│   └── package.json
│
├── app/                          # Next.js Cloud Backend
│   ├── api/
│   │   ├── chat/route.ts         # Main chat endpoint
│   │   ├── agent/route.ts        # Task queue
│   │   ├── memory/route.ts       # Memory CRUD
│   │   ├── health/route.ts       # Health check
│   │   ├── voice/route.ts        # Voice proxy
│   │   └── ...
│   ├── page.tsx                  # Web UI
│   ├── layout.tsx
│   └── globals.css
│
├── lib/                          # Shared library
│   ├── agent-core.ts             # Main orchestrator
│   ├── llm-router.ts             # Multi-provider LLM
│   ├── memory.ts                 # Conversation memory
│   ├── protocol.ts               # Shared types
│   └── sub-agents/               # Specialized agents
│
├── desktop/                      # Python Desktop Agent
│   └── jarvis/
│       ├── main.py               # Entry point
│       ├── connector.py          # Cloud connection
│       ├── config.json           # Configuration
│       ├── local_agents/
│       │   ├── windows_agent.py
│       │   ├── file_agent.py
│       │   └── ...
│       └── voice/
│           └── voice_engine.py
│
├── build/                        # Build scripts
├── INSTALL.md                    # Installation guide
├── USER_GUIDE.md                 # User documentation
└── README.md                     # Project overview
```

---

## Development Setup

### Prerequisites

- **Node.js 18+** — [Download](https://nodejs.org)
- **Python 3.11+** — [Download](https://python.org)
- **Git** — [Download](https://git-scm.com)
- **VS Code** — [Download](https://code.visualstudio.com)

### Clone & Setup

```bash
# Clone repository
git clone https://github.com/mohsinrasheed-Baga1/JARVIS-HYBRID.git
cd JARVIS-HYBRID

# Run setup script (Windows)
setup_windows.bat

# Or manually:
python -m venv .venv
.venv\Scripts\activate
pip install -r desktop/requirements.txt
npm install
```

### Development Commands

```bash
# Start everything
run_all_dev.bat

# Or start separately:
run_cloud.bat      # Terminal 1: Cloud backend
run_desktop.bat    # Terminal 2: Python agent
cd desktop-app && npm run dev  # Terminal 3: Electron app
```

---

## API Reference

### Chat Endpoint

**POST `/api/chat`**

Request:
```json
{
  "message": "Take a screenshot",
  "userId": "user123",
  "stream": false,
  "activeProvider": "groq",
  "apiKeys": {
    "groq": "gsk_..."
  }
}
```

Response:
```json
{
  "success": true,
  "message": "اسکرین شاٹ لی گئی...",
  "emotion": "happy",
  "requiresLocalAction": true,
  "localAction": {
    "type": "windows",
    "action": "screenshot",
    "params": {}
  }
}
```

### Task Queue

**GET `/api/agent?userId=X&action=pending_tasks`**

Response:
```json
{
  "success": true,
  "tasks": [
    {
      "taskId": "local_123",
      "type": "windows",
      "action": "screenshot",
      "params": {}
    }
  ]
}
```

**PUT `/api/agent`**

Request:
```json
{
  "taskId": "local_123",
  "userId": "user123",
  "success": true,
  "result": {
    "path": "C:/Users/Desktop/screenshot.png"
  }
}
```

### Memory

**GET `/api/memory?userId=X&action=history&limit=50`**

**POST `/api/memory`**
```json
{
  "userId": "user123",
  "action": "save",
  "message": "User prefers Urdu",
  "role": "system"
}
```

---

## Sub-Agents

### Creating a New Sub-Agent

1. Create file in `lib/sub-agents/my-agent.ts`:

```typescript
import { BaseAgent } from './base-agent';

export class MyAgent extends BaseAgent {
  constructor() {
    super('my-agent', 'Custom agent description');
  }

  async handle(action: string, params: Record<string, any>): Promise<AgentResponse> {
    switch (action) {
      case 'custom-action':
        return this.success('Action completed', 'happy', { result: 'data' });
      default:
        return this.error('Unknown action');
    }
  }
}
```

2. Register in `lib/agent-core.ts`:

```typescript
import { MyAgent } from './sub-agents/my-agent';

const myAgent = new MyAgent();
```

3. Add to routing logic:

```typescript
if (classification.agent === 'my-agent') {
  return myAgent.handle(classification.action, classification.params);
}
```

---

## Desktop Agent Development

### Adding New Automation Actions

Edit `desktop/jarvis/local_agents/windows_agent.py`:

```python
def handle(self, action: str, params: Dict[str, Any]) -> Dict[str, Any]:
    handlers = {
        # ... existing handlers
        "my_action": self.my_new_action,
    }

def my_new_action(self, params: Dict) -> Dict[str, Any]:
    """My new automation action"""
    try:
        # Implementation
        return {"success": True, "message": "Action completed"}
    except Exception as e:
        return {"success": False, "error": str(e)}
```

### Task Flow

```
User Message → Cloud Backend → Task Classification
                                    ↓
                        Queue Local Action (POST /api/agent)
                                    ↓
                        Desktop Polls (GET /api/agent)
                                    ↓
                        Execute Locally (Python)
                                    ↓
                        Report Result (PUT /api/agent)
```

---

## Building & Packaging

### Build for Windows

```bash
# In desktop-app directory
npm run build:win
```

Output: `desktop-app/release/JARVIS-Hybrid-Setup-2.0.0-x64.exe`

### Build Portable EXE

```bash
npm run build:win-portable
```

Output: `desktop-app/release/JARVIS-Hybrid-Portable-2.0.0.exe`

### Build for All Platforms

```bash
npm run build:all
```

---

## Configuration

### Environment Variables

Create `.env.local` in project root:

```env
# API Keys (optional - users provide their own)
GROQ_API_KEY=
GEMINI_API_KEY=
OPENAI_API_KEY=
ZAI_API_KEY=

# Cloud URL
NEXT_PUBLIC_CLOUD_URL=http://localhost:3000
```

### Desktop Config

Edit `desktop/jarvis/config.json`:

```json
{
  "cloud_url": "http://localhost:3000",
  "user_id": "local_user",
  "voice_enabled": false,
  "language": "mixed",
  "api_keys": {
    "groq": "",
    "gemini": "",
    "openai": "",
    "zai": ""
  }
}
```

---

## Testing

### Unit Tests

```bash
# Backend tests
npm test

# Python tests
cd desktop
python -m pytest
```

### Manual Testing

1. Start services: `run_all_dev.bat`
2. Open `http://localhost:3000`
3. Test chat, voice, automation features
4. Check logs: `%APPDATA%/JARVIS Hybrid/logs/`

### E2E Testing

```bash
# Build and test
npm run build:win
# Run the built executable
./desktop-app/release/JARVIS-Hybrid-Setup-2.0.0-x64.exe
```

---

## Debugging

### Enable Debug Mode

```bash
# Start with debug logging
JARVIS Hybrid.exe --debug
```

### View Logs

- **Electron:** `%APPDATA%/JARVIS Hybrid/logs/jarvis-main.log`
- **Python:** Console output or log file
- **Next.js:** Terminal output

### DevTools

Press `Ctrl+Shift+D` in the app to toggle DevTools.

---

## Contributing

### Pull Request Process

1. Fork the repository
2. Create feature branch: `git checkout -b feature/my-feature`
3. Make changes with tests
4. Run tests: `npm test && python -m pytest desktop/`
5. Commit: `git commit -m "Add my feature"`
6. Push: `git push origin feature/my-feature`
7. Open Pull Request

### Code Style

- **TypeScript:** Use Prettier with default settings
- **Python:** Follow PEP 8
- **Comments:** Document complex logic
- **Tests:** Required for new features

---

## Known Limitations

1. **Voice on Windows:** May require additional setup
2. **Port 3000:** Must be available for local cloud
3. **Python PATH:** Must be in system PATH or specify in config
4. **Antivirus:** May flag Electron app as suspicious

---

## Future Improvements

- [ ] WebSocket for real-time updates
- [ ] Persistent memory (database)
- [ ] Multi-language UI
- [ ] Plugin system for extensions
- [ ] macOS and Linux support
- [ ] Offline mode without cloud

---

## Support

- **GitHub Issues:** [Report bugs](https://github.com/mohsinrasheed-Baga1/JARVIS-HYBRID/issues)
- **Discussions:** [Ask questions](https://github.com/mohsinrasheed-Baga1/JARVIS-HYBRID/discussions)

---

**Happy coding!** 🚀
