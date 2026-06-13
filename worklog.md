---
Task ID: 1
Agent: Main Agent
Task: Fix mic/voice input and ElevenLabs TTS in Electron desktop app

Work Log:
- Cloned repo from GitHub and analyzed full codebase architecture
- Identified root cause: preload.js `recordAndTranscribe` uses `navigator.mediaDevices.getUserMedia` in Electron's isolated preload context, which is unreliable with contextIsolation=true
- Identified TTS issue: when IPC TTS fails, code falls back to speechSynthesis (robotic voice) instead of trying backend API properly
- Identified update issue: Electron loads dist/ which isn't rebuilt after git pull

Fixes Applied:
1. **preload.js**: Rewrote `recordAndTranscribe` to use renderer-based MediaRecorder then IPC transcription. Kept IPC helpers (`transcribeAudioBase64`, `generateTTS`) which work reliably.
2. **MessageInput.tsx**: Changed `toggleMic()` to always use `startRecordedFallback()` in Electron (renderer-based recording). Updated `finishRecordedInput()` to try IPC transcription first, then backend API.
3. **ChatPage.tsx**: Improved TTS fallback chain - IPC TTS → backend API TTS → speechSynthesis. Added `tryBackendTTS()` helper.
4. **VoicePage.tsx**: Rewrote to use renderer-based recording + IPC transcription instead of broken preload approach.
5. **main.js**: Added `rebuildViteIfNeeded()` auto-rebuild on startup. Improved `loadWebApp()` to prefer dist/ with fallback chain.
6. **START_JARVIS.bat**: Added better logging for Vite build process.

Stage Summary:
- All 6 files committed locally but CANNOT push to GitHub without authentication token
- User needs to either: (a) provide GitHub token, or (b) pull these changes manually
- Key architecture fix: Recording happens in RENDERER context (reliable), transcription happens via IPC to MAIN process (reliable)

---
Task ID: 2
Agent: Main Agent
Task: v3.0.5 - Fix Piper download, TTS, STT + Terminal + Mouse/Keyboard + Screen Analysis + Multi API Keys + UI Redesign

Work Log:
- Analyzed full codebase: main.js (2400+ lines), preload.js, App.tsx, ChatPage.tsx, MessageInput.tsx, SettingsPage.tsx
- Fixed downloadFile() function: atomic writes with temp files, response timeout (60s), proper redirect handling (10 max), relative URL support, progress reporting, double-resolve prevention
- Fixed Piper download progress: Real-time percentage reporting during model download (0-80%) and config download (80-100%) with MB/KB detail
- Fixed TTS pipeline: Made Edge-TTS the PRIMARY provider (free, no API key, best Urdu), improved Python detection (python/python3/py), auto-install edge-tts with --user flag
- Fixed STT: Changed from whisper-large-v3-turbo to whisper-large-v3 for better Urdu accuracy, added Urdu context prompt
- Added Terminal IPC handlers: terminal-execute, terminal-create-session, terminal-write, terminal-kill, terminal-output streaming
- Added Mouse/Keyboard control: mouse-move, mouse-click, keyboard-type, keyboard-press, keyboard-hotkey (Windows PowerShell)
- Added Screen Analysis: screen-capture + screen-analyze with Groq/OpenAI Vision API
- Added play-youtube-auto: Opens YouTube search + auto-clicks first result via keyboard simulation
- Added Multiple API Keys: loadMultiKeys/saveMultiKeys with jarvis-api-keys.json, add/remove/get-active-key with round-robin rotation
- Created TerminalPage.tsx: Full terminal UI with command history, quick commands, output coloring
- Redesigned App.tsx: Merged Dashboard/Chat/Files/Automation into single page with tabs, Settings as separate overlay, modern header with gradient tabs
- Updated SettingsPage.tsx: Added Multiple API Keys manager section, updated version to v3.0.5
- Updated preload.js: Added all new IPC bridges (terminal, mouse, keyboard, screen, multi-keys)
- Bumped version to 3.0.5 across package.json, main.js, VERSION file
- Committed and pushed v3.0.5 tag to trigger GitHub Actions release

Stage Summary:
- v3.0.5 pushed to GitHub with tag, release should build automatically
- All critical voice issues fixed (Piper download, TTS pipeline, STT accuracy)
- 5 new major features added (Terminal, Mouse/Keyboard, Screen Analysis, Multi API Keys, YouTube auto-play)
- UI completely redesigned (single-page with tabs + Settings overlay)
