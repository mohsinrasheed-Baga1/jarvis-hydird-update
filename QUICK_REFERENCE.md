# 🚀 JARVIS Hybrid - Quick Reference Card

**Print this or bookmark it!**

---

## ⚡ Quick Commands

### First Time Only
```bash
setup_windows.bat
```

### Every Development Session
```bash
# Terminal 1
run_cloud.bat

# Terminal 2 (new terminal)
run_desktop.bat
```

### Or Both At Once
```bash
run_all_dev.bat
```

---

## 🌐 Access Points

| Service | URL | Purpose |
|---------|-----|---------|
| Web UI | http://localhost:3000 | Chat, Settings, API keys |
| API Health | http://localhost:3000/api/health | Check status |
| Desktop CLI | Terminal | Direct automation testing |

---

## 💻 Desktop Agent Commands

### System
```
!screenshot              Take a screenshot
!system                 Show system info
!notify "Title" "Msg"   Send notification
!help                   Show all commands
```

### Browser & Search
```
!open https://google.com        Open URL
!google machine learning        Google search
!youtube meditation            YouTube search
```

### Keyboard & Mouse
```
!type Hello World              Type text
!hotkey ctrl+c                 Press Ctrl+C
!hotkey alt+tab                Switch windows
!click 500 500                 Click at (500, 500)
!press enter                   Press Enter key
```

### Clipboard
```
!clip read                 Read clipboard
!clip write Hello          Copy text to clipboard
```

### Applications
```
!open notepad              Open Notepad
!open "Program Files\..."  Open any app
```

### Special
```
exit                       Exit CLI
quit                       Exit CLI
بند                        Exit CLI (Urdu)
```

---

## 🤖 Chat with JARVIS (Web UI)

After adding API key in Settings:

```
take a screenshot
open notepad and type hello world
search google for python tutorials
what's my system information
write a file on desktop with content hello
```

---

## 🛠️ Troubleshooting

**Python error? Install basics:**
```bash
pip install -r desktop/requirements-minimal.txt
```

**Voice giving issues? Disable it:**
```bash
python -m jarvis.main --local-cli --no-voice
```

**Port 3000 in use?**
```bash
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

**Start over?**
```bash
rm -r .venv
rm -r node_modules
setup_windows.bat
```

---

## 📊 Status Check

**Cloud working?**
```bash
curl http://localhost:3000/api/health
```

**Python syntax OK?**
```bash
python -m compileall desktop/jarvis
```

**Build OK?**
```bash
npm run build
```

---

## 📁 Important Folders

```
.venv/                    Python virtual environment
node_modules/             JavaScript packages
desktop/jarvis/           Desktop agent code
app/                       Next.js cloud app
.env                       Environment variables
```

---

## 🔑 API Keys Needed

Add at least ONE in Settings (http://localhost:3000):

| Provider | Link | Status |
|----------|------|--------|
| Groq | https://console.groq.com | Free ✅ |
| Gemini | https://aistudio.google.com/apikey | Free ✅ |
| OpenAI | https://platform.openai.com/api-keys | Paid 💰 |
| ZAI | https://open.bigmodel.cn | Free ✅ |

---

## 📝 File Structure

```
JARVIS-HYBRID/
├── setup_windows.bat          ← One-time setup
├── run_cloud.bat              ← Start cloud
├── run_desktop.bat            ← Start desktop
├── run_all_dev.bat            ← Start both
├── app/                        ← Next.js web app
├── desktop/
│   ├── jarvis/main.py         ← Desktop entry point
│   ├── jarvis/connector.py    ← Cloud connection
│   └── jarvis/local_agents/   ← Automation modules
├── lib/                        ← Shared code
├── README.md                   ← Main docs
├── WINDOWS_SETUP_GUIDE.md     ← Detailed Windows guide
└── COMPLETION_REPORT.md       ← What was changed
```

---

## 🎯 Development Workflow

1. **Make code changes** in VS Code
2. **Changes auto-reload:**
   - Python: Manual restart needed
   - Next.js: Auto-refreshes
3. **Test locally** before pushing
4. **Push to GitHub** when ready
5. **Vercel auto-deploys** production

---

## 🚀 Deploy to Production

```bash
git add .
git commit -m "Feature: description"
git push origin main
# Vercel auto-deploys!
```

Then connect desktop agent:
```bash
python -m jarvis.main --cloud-url https://your-app.vercel.app --gui
```

---

## ⏱️ Startup Times

| Component | Time |
|-----------|------|
| Cloud (cold) | ~15s |
| Cloud (warm) | ~5s |
| Desktop (cold) | ~8s |
| Desktop (warm) | ~2s |
| Both together | ~20s |

---

## 📞 Quick Fixes Checklist

- [ ] Both terminals running?
- [ ] Port 3000 not blocked?
- [ ] API key added in Settings?
- [ ] Using --no-voice if voice fails?
- [ ] Python 3.11+ installed?
- [ ] Node 18+ installed?
- [ ] Setup script completed?

---

**Version:** 2.0 | **Status:** ✅ Ready  
**Identity:** Ryan (Human Freelancer) 👤  
**Last Updated:** June 5, 2026

🎉 You're all set! Type `!help` in desktop CLI to see all commands.
