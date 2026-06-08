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
