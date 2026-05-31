"""
JARVIS Hybrid - Desktop Main Entry Point
Run this on your local machine to connect to JARVIS Cloud
"""

import os
import sys
import json
import argparse

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from jarvis.connector import DesktopConnector
from jarvis.local_agents import LocalWindowsAgent, LocalFileAgent, LocalUploadAgent
from jarvis.voice.voice_engine import VoiceEngine, STTEngine


def main():
    parser = argparse.ArgumentParser(description="JARVIS Hybrid - Desktop Agent")
    parser.add_argument(
        "--cloud-url",
        default="https://your-jarvis.vercel.app",
        help="JARVIS Cloud URL (Vercel deployment)",
    )
    parser.add_argument(
        "--user-id",
        default="local_user",
        help="Your user ID",
    )
    parser.add_argument(
        "--no-voice",
        action="store_true",
        help="Disable voice engine",
    )
    parser.add_argument(
        "--gui",
        action="store_true",
        help="Launch with GUI (requires CustomTkinter)",
    )
    args = parser.parse_args()

    print("=" * 60)
    print("  🤖 JARVIS HYBRID - Desktop Agent")
    print("  Cloud Brain + Desktop Hands")
    print("=" * 60)
    print()

    # Initialize agents
    print("[Init] Loading local agents...")
    windows_agent = LocalWindowsAgent()
    file_agent = LocalFileAgent()
    upload_agent = LocalUploadAgent()
    print("[Init] ✅ Local agents ready")

    # Initialize voice
    voice_engine = None
    stt_engine = None
    if not args.no_voice:
        print("[Init] Loading voice engines...")
        voice_engine = VoiceEngine()
        voice_engine.initialize()

        stt_engine = STTEngine()
        stt_engine.initialize()
        print("[Init] ✅ Voice engines ready")

    # Connect to cloud
    print(f"\n[Connect] Connecting to cloud: {args.cloud_url}")
    connector = DesktopConnector(args.cloud_url, args.user_id)

    # Try GUI first
    if args.gui:
        try:
            import customtkinter as ctk
            _launch_gui(connector, voice_engine, stt_engine, windows_agent, file_agent)
            return
        except ImportError:
            print("[GUI] CustomTkinter not available, using CLI mode")

    # CLI mode
    _launch_cli(connector, voice_engine, stt_engine, windows_agent, file_agent)


def _launch_cli(connector, voice_engine, stt_engine, windows_agent, file_agent):
    """Launch CLI chat interface"""
    print("\n🤖 JARVIS Ready! Type your message (Ctrl+C to quit)")
    print("   Commands: !voice <on/off>, !screenshot, !system, !help")
    print()

    voice_enabled = True

    while True:
        try:
            # Get user input
            user_input = input("\n👤 You: ").strip()

            if not user_input:
                continue

            # Local commands
            if user_input.startswith("!"):
                cmd = user_input[1:].strip().lower()

                if cmd == "help":
                    print("\n📋 Commands:")
                    print("  !voice on/off  - Toggle voice")
                    print("  !screenshot    - Take screenshot")
                    print("  !system        - System info")
                    print("  !files <path>  - List files")
                    print("  !help          - This help")
                    continue

                elif cmd == "voice on":
                    voice_enabled = True
                    print("🎤 Voice enabled")
                    continue
                elif cmd == "voice off":
                    voice_enabled = False
                    print("🔇 Voice disabled")
                    continue

                elif cmd == "screenshot":
                    result = windows_agent.screenshot()
                    print(f"📸 {result}")
                    continue

                elif cmd == "system":
                    result = windows_agent.system_info()
                    print(f"💻 {json.dumps(result, indent=2)}")
                    continue

                elif cmd.startswith("files"):
                    path = cmd.replace("files", "").strip() or "."
                    result = file_agent.list_directory({"path": path})
                    if result.get("success"):
                        for f in result["files"]:
                            icon = "📁" if f["is_dir"] else "📄"
                            print(f"  {icon} {f['name']}")
                    continue

            # Send to cloud
            print("🤖 JARVIS: ", end="", flush=True)
            response = connector.send_message(user_input)
            print(response)

            # Voice output
            if voice_enabled and voice_engine:
                voice_engine.speak(response, emotion="normal")

        except KeyboardInterrupt:
            print("\n\n👋 Goodbye! / خدا حافظ!")
            break
        except EOFError:
            break
        except Exception as e:
            print(f"❌ Error: {e}")


def _launch_gui(connector, voice_engine, stt_engine, windows_agent, file_agent):
    """Launch CustomTkinter GUI"""
    import customtkinter as ctk

    ctk.set_appearance_mode("dark")
    ctk.set_default_color_theme("blue")

    app = ctk.CTk()
    app.title("JARVIS Hybrid - Desktop Agent")
    app.geometry("900x700")

    # Chat display
    chat_frame = ctk.CTkScrollableFrame(app)
    chat_frame.pack(fill="both", expand=True, padx=10, pady=10)

    # Input area
    input_frame = ctk.CTkFrame(app)
    input_frame.pack(fill="x", padx=10, pady=(0, 10))

    entry = ctk.CTkEntry(input_frame, height=40, placeholder_text="Type your message...")
    entry.pack(side="left", fill="x", expand=True, padx=(0, 10))

    def send_message():
        msg = entry.get().strip()
        if not msg:
            return
        entry.delete(0, "end")

        # Add user message
        user_label = ctk.CTkLabel(chat_frame, text=f"👤 You: {msg}", wraplength=700, justify="left")
        user_label.pack(anchor="e", pady=2)

        # Get response from cloud
        response = connector.send_message(msg)

        # Add assistant message
        ai_label = ctk.CTkLabel(chat_frame, text=f"🤖 JARVIS: {response}", wraplength=700, justify="left")
        ai_label.pack(anchor="w", pady=2)

        # Voice
        if voice_engine:
            voice_engine.speak(response, emotion="normal")

    send_btn = ctk.CTkButton(input_frame, text="Send", command=send_message, width=80)
    send_btn.pack(side="right")

    entry.bind("<Return>", lambda e: send_message())

    # Status bar
    status = ctk.CTkLabel(app, text="🟢 Connected to JARVIS Cloud", height=25)
    status.pack(fill="x", padx=10, pady=(0, 5))

    app.mainloop()


if __name__ == "__main__":
    main()
