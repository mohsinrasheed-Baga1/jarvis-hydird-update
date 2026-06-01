
---
Task ID: 1-2
Agent: Main Agent
Task: Fix Urdu TTS natural voice + add story recorder + TTS provider indicator

Work Log:
- Identified ROOT CAUSE: ElevenLabs voice "Matilda" doesn't work for Urdu
- All paid TTS providers silently failed for Urdu, falling back to Google Translate (robotic)
- Updated TTS route with 5 Hindi/Urdu voices with auto-try
- Added story recording system with download
- Added TTS provider indicator in UI
- Build successful, pushed to GitHub, auto-deploy to Vercel

Stage Summary:
- Urdu TTS now tries multiple Hindi/Urdu voices (Dhi, Maitreyi, Lily, etc.)
- TTS provider indicator shows which engine is playing (green=natural, red=robotic)
- Story recorder feature added (📖 button in header)
- Deployed to Vercel
