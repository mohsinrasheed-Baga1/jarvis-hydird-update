# 📦 JARVIS Hybrid - Installation Guide

**Version:** 2.0.0 | **Platform:** Windows 10/11 | **Last Updated:** June 5, 2026

---

## Quick Install (Recommended)

### Download Installer

1. Go to [GitHub Releases](https://github.com/mohsinrasheed-Baga1/JARVIS-HYBRID/releases)
2. Download `JARVIS-Hybrid-Setup-2.0.0-x64.exe`
3. Run the installer
4. Follow the installation wizard
5. Launch JARVIS Hybrid from Desktop shortcut

**That's it!** JARVIS will automatically start all required services.

---

## System Requirements

### Minimum Requirements
- **OS:** Windows 10 (64-bit) or Windows 11
- **RAM:** 4 GB
- **Storage:** 2 GB free space
- **Internet:** Required for AI features

### Recommended Requirements
- **OS:** Windows 11 (64-bit)
- **RAM:** 8 GB or more
- **Storage:** 5 GB free space
- **Internet:** Broadband connection

### Prerequisites (Auto-installed)
- **Python 3.11+** — Auto-installed if missing
- **Node.js 18+** — Auto-installed if missing

---

## Installation Methods

### Method 1: Windows Installer (Recommended)

```powershell
# Download and run
JARVIS-Hybrid-Setup-2.0.0-x64.exe
```

**Features:**
- One-click installation
- Auto-installs dependencies
- Desktop shortcut
- Start menu entry
- Uninstaller included

### Method 2: Portable EXE

1. Download `JARVIS-Hybrid-Portable-2.0.0.exe`
2. Place anywhere on your computer
3. Double-click to run

**Features:**
- No installation needed
- Run from USB drive
- Settings stored in app folder

### Method 3: Development Setup

For developers who want to modify the code:

```bash
# Clone repository
git clone https://github.com/mohsinrasheed-Baga1/JARVIS-HYBRID.git
cd JARVIS-HYBRID

# Run setup script
setup_windows.bat

# Start development
run_all_dev.bat
```

---

## First-Time Setup

### 1. Launch JARVIS

Double-click the JARVIS Hybrid icon on your desktop or start menu.

### 2. Add API Keys

1. Click the **⚙️ Settings** icon (bottom-left sidebar)
2. Enter at least one API key:
   - **Groq** (Free) — [Get key](https://console.groq.com)
   - **Gemini** (Free) — [Get key](https://aistudio.google.com/apikey)
   - **OpenAI** — [Get key](https://platform.openai.com/api-keys)
   - **ZAI** (Free) — [Get key](https://open.bigmodel.cn)
3. Click **💾 Save**

### 3. Test

Type a message in the chat:
```
Hello JARVIS, how are you?
```

You should receive a response in Urdu/English.

---

## Directory Structure

After installation, JARVIS creates these folders:

```
C:\Users\<User>\AppData\Local\Programs\JARVIS Hybrid\
├── JARVIS Hybrid.exe          # Main executable
├── resources\
│   ├── app.asar               # Bundled application
│   ├── desktop\               # Python agent files
│   └── .venv\                 # Python virtual environment (if included)
└── uninstall.exe              # Uninstaller

C:\Users\<User>\AppData\Roaming\JARVIS Hybrid\
├── logs\                      # Application logs
│   └── jarvis-main.log
└── config\                    # User configuration
```

---

## Configuration

### API Keys Storage

API keys are stored securely in:
- **Windows:** `%APPDATA%\JARVIS Hybrid\config\api_keys.json`
- **Encrypted:** Yes (Windows DPAPI)

### User Preferences

Stored in browser localStorage and synced with the cloud backend.

### Voice Settings

Configure in Settings → Voice:
- Language: Urdu, English, or Mixed
- Wake Word: Customizable (default: "Hey JARVIS")
- Continuous Listening: On/Off

---

## Troubleshooting

### JARVIS Won't Start

**Symptom:** Application doesn't open or closes immediately.

**Solutions:**
1. Check logs: `%APPDATA%\JARVIS Hybrid\logs\jarvis-main.log`
2. Run as Administrator
3. Verify antivirus isn't blocking the app
4. Reinstall JARVIS

### API Key Not Working

**Symptom:** "No API key configured" error.

**Solutions:**
1. Go to Settings → API Keys
2. Verify key format:
   - Groq: starts with `gsk_`
   - Gemini: starts with `AIza`
   - OpenAI: starts with `sk-`
3. Click "Test" button
4. Save and retry

### Cloud Backend Offline

**Symptom:** "Cannot reach cloud" message.

**Solutions:**
1. Check internet connection
2. Verify firewall allows port 3000
3. Check if another app is using port 3000:
   ```cmd
   netstat -ano | findstr :3000
   ```
4. Restart JARVIS

### Python Agent Not Responding

**Symptom:** Desktop automation not working.

**Solutions:**
1. Check if Python 3.11+ is installed
2. Verify `desktop/requirements.txt` packages installed
3. Run manually:
   ```cmd
   cd "%LOCALAPPDATA%\Programs\JARVIS Hybrid\resources\desktop"
   python -m jarvis.main --no-voice
   ```

### Voice Not Working

**Symptom:** Microphone or speaker not working.

**Solutions:**
1. Check Windows microphone permissions
2. Verify speakers are working
3. Disable --no-voice flag (in Settings → Voice)
4. Install voice packages:
   ```cmd
   pip install piper-tts kokoro-onnx faster-whisper sounddevice
   ```

---

## Uninstallation

### Method 1: Use Uninstaller

1. Go to **Settings → Apps → Installed Apps**
2. Find "JARVIS Hybrid"
3. Click **Uninstall**
4. Follow prompts

### Method 2: Manual Uninstall

```cmd
# Run uninstaller
"%LOCALAPPDATA%\Programs\JARVIS Hybrid\uninstall.exe"

# Remove remaining files (optional)
rmdir /s /q "%APPDATA%\JARVIS Hybrid"
rmdir /s /q "%LOCALAPPDATA%\JARVIS Hybrid"
```

---

## Updating

### Automatic Updates

JARVIS checks for updates automatically every 30 minutes.

When an update is available:
1. Notification appears in the app
2. Click "Restart to Update"
3. JARVIS downloads and installs the update
4. Restarts automatically

### Manual Update Check

1. Open JARVIS
2. Press `Ctrl+Shift+U` or click tray icon → "Check Updates"

---

## Advanced Options

### Command-Line Arguments

Run JARVIS with specific options:

```cmd
JARVIS Hybrid.exe [options]

Options:
  --no-cloud        Disable cloud backend
  --no-python       Disable Python agent
  --remote          Use remote cloud (Vercel) instead of local
  --debug           Enable debug logging
  --help            Show help
```

### Portable Mode

For USB drives or custom locations:

```cmd
# Create portable config file
echo {"portable": true} > JARVIS-Hybrid-Portable.exe.portable
```

---

## Security & Privacy

### Data Storage
- **API Keys:** Encrypted locally with Windows DPAPI
- **Chat History:** Stored in browser localStorage
- **Voice Recordings:** Not stored permanently

### Network Connections
- **Cloud Backend:** `http://localhost:3000` (local)
- **LLM APIs:** Direct to provider (Groq, Gemini, OpenAI, ZAI)
- **No telemetry:** JARVIS doesn't send usage data

### Firewall Rules

If your firewall prompts, allow:
- `JARVIS Hybrid.exe` — Main application
- `python.exe` — Python agent
- `node.exe` — Cloud backend

---

## Support

### Getting Help

1. **Documentation:** Read `USER_GUIDE.md`
2. **Logs:** Check `%APPDATA%\JARVIS Hybrid\logs\`
3. **GitHub Issues:** [Report a bug](https://github.com/mohsinrasheed-Baga1/JARVIS-HYBRID/issues)

### Reporting Bugs

Include in your report:
- JARVIS version (`v2.0.0`)
- Windows version
- Error message
- Log file contents
- Steps to reproduce

---

## Next Steps

After installation, read:
- **[USER_GUIDE.md](USER_GUIDE.md)** — Complete feature guide
- **[DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md)** — Modifying JARVIS

---

**Installation complete!** 🎉

Start chatting with JARVIS: "Hello! کیا حال ہے؟"
