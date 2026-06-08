# 📖 JARVIS Hybrid - User Guide

**Version:** 2.0.0 | **Platform:** Windows 10/11 | **Last Updated:** June 5, 2026

---

## Welcome to JARVIS

JARVIS Hybrid is your personal AI assistant that runs entirely on your computer. It can:
- 💬 Chat with you in Urdu and English
- 🤖 Automate desktop tasks (screenshots, file operations, app control)
- 🎤 Listen and respond via voice
- 📁 Process files (images, PDFs, text)
- 🧠 Remember your preferences
- 🌐 Search the web

---

## Quick Start

### 1. Launch JARVIS

Double-click the **JARVIS Hybrid** icon on your desktop.

Wait a few seconds for the startup to complete. You'll see:
- Sidebar on the left with navigation icons
- Main chat area on the right

### 2. Add Your API Key

Before chatting, add at least one API key:

1. Click **⚙️ Settings** (bottom-left sidebar)
2. Enter your API key (Groq is free and recommended)
3. Click **💾 Save**

**Get free API keys:**
- **Groq:** [console.groq.com](https://console.groq.com) — Free
- **Gemini:** [aistudio.google.com](https://aistudio.google.com/apikey) — Free

### 3. Start Chatting

Type a message in the input box and press **Enter** or click **📤 Send**.

```
Example: "Hello! What can you do?"
```

JARVIS will respond in your language (Urdu or English).

---

## Interface Overview

### Sidebar Navigation

| Icon | Page | Description |
|------|------|-------------|
| 💬 | Chat | Main conversation interface |
| 🎤 | Voice | Voice settings and microphone |
| 📁 | Files | Upload files to attach to messages |
| 💾 | Memory | View/edit remembered information |
| 🤖 | Automation | Running tasks and logs |
| 📊 | Status | System health and connectivity |
| ⚙️ | Settings | API keys, preferences, voice settings |

### Chat Interface

- **Top Bar:** Model selector + new chat button
- **Main Area:** Conversation history
- **Bottom:** Message input + send button

---

## Chat Features

### Basic Chat

Type any message and press Enter:
```
What's the weather like today?
```

JARVIS will respond naturally in your preferred language.

### Switching Models

Click the **model dropdown** in the top bar:
- **Groq (Llama 3.3)** — Fast, free
- **Google Gemini** — Smart, free
- **OpenAI GPT-4** — Most capable, paid
- **ZAI GLM-4** — Chinese language, free

### New Conversation

Click **➕ New** button to start fresh.

### Code Blocks

When JARVIS shows code, you'll see:
- Syntax highlighting
- Language label
- **📋 Copy** button

Click **Copy** to copy code to clipboard.

---

## Voice Assistant

### Enable Voice

1. Go to **🎤 Voice** page
2. Toggle **🎙️ Voice** to **ON**
3. Select language (Urdu, English, or Mixed)

### Push-to-Talk

1. Click the **microphone button** (red when active)
2. Speak your message
3. Release or click again to stop

### Wake Word

Enable **"Hey JARVIS"** wake word for hands-free activation:

1. Go to **Voice → Settings**
2. Toggle **Wake Word** to **ON**
3. Say "Hey JARVIS" to activate

### Voice Commands

```
"Take a screenshot"
"Open notepad"
"Search YouTube for relaxing music"
"What time is it?"
```

---

## File Upload

### Supported Formats
- **Images:** PNG, JPG, GIF
- **Documents:** PDF, TXT, MD
- **Max Size:** 50 MB per file

### Upload Methods

**Drag & Drop:**
1. Drag files from Explorer
2. Drop onto the upload area
3. Files appear in the list

**File Picker:**
1. Click **📁 Select Files**
2. Choose files from your computer
3. Click **Open**

### Remove Files

Click the **✕** button next to any file to remove it.

---

## Memory System

JARVIS remembers important information across conversations.

### View Memories

1. Go to **💾 Memory** page
2. See all stored facts and preferences

### Search Memories

Use the search box to find specific information.

### Delete Memory

Click the **✕** button on any memory card.

### Export Memories

Click **💾 Download** to save memories as JSON.

---

## Desktop Automation

### View Running Tasks

Go to **🤖 Automation** page to see:
- Currently running tasks
- Task history
- Status (running ✅, completed ✅, failed ❌)

### Stop a Task

Click **⏹️ Stop** next to any running task.

### Quick Actions

Click any quick action button:
- 📸 **Screenshot** — Capture screen
- 🌐 **Google Search** — Open search
- 📁 **Open File** — File picker
- 📝 **Notepad** — Open Notepad

### View Logs

Scroll down to see activity logs with timestamps.

---

## Status Dashboard

Monitor JARVIS health at **📊 Status**:

### System Metrics
- **CPU Usage** — Real-time percentage
- **RAM Usage** — Memory consumption

### Connection Status
- **Internet** — Online/offline
- **Cloud Server** — Connected/disconnected
- **Desktop Agent** — Running/stopped

### API Status
- Check which LLM providers are configured

---

## Settings

### API Keys

Add or update API keys:
1. Enter key in the input field
2. Click **🧪 Test** to verify
3. Click **💾 Save**

Keys are encrypted and stored locally.

### Display

- **Dark Mode** — On by default
- **Language** — Urdu, English, or Mixed

### Voice

- **Voice Enabled** — Toggle on/off
- **Language** — Voice input/output language
- **Wake Word** — Custom activation phrase

### System

- **Auto-Start** — Launch JARVIS when Windows starts

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Enter` | Send message |
| `Shift+Enter` | New line in message |
| `Ctrl+Shift+R` | Hard refresh |
| `Ctrl+Shift+D` | Toggle DevTools |
| `Ctrl+Shift+U` | Check for updates |

---

## Tips & Tricks

### Better Conversations

- **Be specific:** "Take a screenshot and save to Desktop" works better than "screenshot"
- **Mix languages:** JARVIS understands Urdu/English mix
- **Use context:** JARVIS remembers recent messages

### Desktop Commands

Try these in chat:
```
"Take a screenshot"
"Open YouTube and search for cooking tutorials"
"What's my system info?"
"Create a file on Desktop called notes.txt"
```

### Voice Tips

- Speak clearly and at normal pace
- Minimize background noise
- Use push-to-talk in noisy environments

### Performance

- Close unused apps to free RAM
- Use Groq for fastest responses
- Disable voice if not needed

---

## Troubleshooting

### JARVIS Not Responding

1. Check **📊 Status** page
2. Verify internet connection
3. Restart JARVIS

### Voice Not Working

1. Check microphone permissions in Windows
2. Test speakers with other apps
3. Disable and re-enable voice in Settings

### File Upload Fails

1. Check file size (max 50 MB)
2. Verify file format is supported
3. Check available disk space

### Automation Not Working

1. Go to **Automation** page
2. Check if task shows error
3. View logs for details

---

## Privacy & Security

### What's Stored Locally
- API keys (encrypted)
- Chat history in browser storage
- Voice recordings (temporary only)

### What's Sent to Cloud
- Your messages to LLM providers
- No usage tracking or telemetry

### Stay Safe
- Never share API keys
- Review memories periodically
- Use strong passwords for cloud accounts

---

## Need Help?

1. **Check Logs:** Automation → Logs
2. **Status Page:** Check all connections
3. **Restart:** Close and reopen JARVIS
4. **Reinstall:** Download latest version

---

## Keyboard Reference

### Navigation
| Key | Action |
|-----|--------|
| `Tab` | Next element |
| `Shift+Tab` | Previous element |

### Chat
| Key | Action |
|-----|--------|
| `Enter` | Send message |
| `Shift+Enter` | New line |

### App
| Key | Action |
|-----|--------|
| `Ctrl+Shift+R` | Hard refresh |
| `Ctrl+Shift+U` | Check updates |
| `Esc` | Close dialogs |

---

## Updates

JARVIS checks for updates automatically every 30 minutes.

When an update is available:
- You'll see a notification
- Click **Restart** to install
- Updates download in background

---

**Enjoy JARVIS!** 🎉

Questions? Check `INSTALL.md` or report issues on GitHub.
