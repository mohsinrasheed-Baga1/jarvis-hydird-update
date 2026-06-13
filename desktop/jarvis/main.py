"""
JARVIS Hybrid - Desktop Agent (Enhanced)
Full desktop automation: WhatsApp, Job Search, Desktop Control, Auto-Update

Features:
- WhatsApp automation (read, reply, monitor)
- Job search across multiple platforms
- Desktop control (apps, files, screenshots)
- Auto-update from GitHub
- Human-like AI communication (Ryan identity)
- Desktop notifications
- Dashboard UI
"""

import os
import sys
import json
import time
import argparse
import threading
from datetime import datetime
import requests

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from jarvis.connector import DesktopConnector
from jarvis.local_agents import LocalWindowsAgent, LocalFileAgent, LocalUploadAgent
from jarvis.local_agents.whatsapp_agent import WhatsAppAgent
from jarvis.local_agents.job_search_agent import JobSearchAgent
from jarvis.local_agents.auto_update import AutoUpdater
from jarvis.voice.voice_engine import VoiceEngine, STTEngine

# ============== IDENTITY ==============
# CRITICAL: When communicating with clients, you are RYAN, NOT an AI
HUMAN_NAME = "Ryan"
IDENTITY_PROMPT = """You are a real human named Ryan. You are NOT an AI, chatbot, or automated system.
If anyone asks, you are Ryan — a skilled freelancer who works remotely.
You speak naturally with human emotions, imperfections, and personality.
You use casual language, emojis sparingly, and match the other person's tone."""


def main():
    parser = argparse.ArgumentParser(description="JARVIS Hybrid - Desktop Agent")
    parser.add_argument("--cloud-url", default="", help="JARVIS Cloud URL (Vercel)")
    parser.add_argument("--user-id", default="local_user", help="User ID")
    parser.add_argument("--no-voice", action="store_true", help="Disable voice (no TTS/STT)")
    parser.add_argument("--local-cli", action="store_true", help="Local CLI mode (no cloud connection)")
    parser.add_argument("--gui", action="store_true", help="Launch GUI dashboard")
    parser.add_argument("--background", action="store_true", help="Run connector/services without interactive CLI")
    parser.add_argument("--monitor-whatsapp", action="store_true", help="Auto-monitor WhatsApp")
    parser.add_argument("--auto-job-search", action="store_true", help="Auto-search for jobs")
    parser.add_argument("--auto-update", action="store_true", help="Enable auto-updates")
    args = parser.parse_args()

    # Default cloud URL for local dev
    if not args.cloud_url and not args.local_cli:
        args.cloud_url = "https://jarvis-hybrid.vercel.app"

    print()
    print("=" * 60)
    print("  🤖 JARVIS HYBRID — Desktop Agent v2.0")
    print("  ☁️ Cloud Brain + 🖥️ Desktop Hands + 💬 WhatsApp + 📝 Jobs")
    print("  Identity: Ryan (Human Freelancer)")
    print("=" * 60)
    print()

    # ====== LOAD API KEYS ======
    api_keys = load_api_keys()
    cloud_url = args.cloud_url

    # ====== INITIALIZE AGENTS ======
    print("[Init] Loading agents...")

    # Core agents
    windows_agent = LocalWindowsAgent()
    file_agent = LocalFileAgent()
    upload_agent = LocalUploadAgent()
    print("[Init] ✅ Core agents ready")

    # WhatsApp agent
    whatsapp_agent = WhatsAppAgent(
        cloud_url=cloud_url,
        api_keys=api_keys,
    )
    print("[Init] ✅ WhatsApp agent ready")

    # Job Search agent
    job_agent = JobSearchAgent(
        cloud_url=cloud_url,
        api_keys=api_keys,
    )
    print("[Init] ✅ Job Search agent ready")

    # Auto-Updater
    repo_path = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    updater = AutoUpdater(repo_path=repo_path)
    print("[Init] ✅ Auto-Updater ready")

    # Voice engines - graceful failure if --no-voice or packages missing
    voice_engine = None
    stt_engine = None
    if not args.no_voice:
        try:
            voice_engine = VoiceEngine()
            voice_engine.initialize()
            stt_engine = STTEngine()
            stt_engine.initialize()
            print("[Init] ✅ Voice engines ready (TTS/STT enabled)")
        except ImportError as e:
            print(f"[Init] ⚠️ Voice packages not available: {e}")
            print("[Init]    Tip: Run with --no-voice to skip voice, or install voice packages")
        except Exception as e:
            print(f"[Init] ⚠️ Voice initialization failed: {e}")
            print("[Init]    Continuing without voice support...")
    else:
        print("[Init] ℹ️ Voice disabled (--no-voice flag)")

    # ====== LOCAL CLI MODE (no cloud) ======
    if args.local_cli:
        print()
        print("[Local Mode] Running in offline mode (no cloud connection)")
        print("[Local Mode] You can test local desktop automation directly")
        print()
        _launch_local_cli(windows_agent, file_agent)
        return

    # ====== CONNECTOR ======
    connector = DesktopConnector(cloud_url, args.user_id)
    print(f"\n[Connect] Cloud: {cloud_url}")

    # Try to reach cloud
    try:
        response = requests.get(f"{cloud_url}/api/health", timeout=5)
        if response.status_code == 200:
            print("[Connect] ✅ Cloud is reachable")
        else:
            print(f"[Connect] ⚠️ Cloud returned status {response.status_code}")
    except requests.RequestException as e:
        print(f"[Connect] ⚠️ Cannot reach cloud: {e}")
        print("[Connect]    Desktop automation will work offline")

    connector.connect()

    # ====== AUTO-START SERVICES ======

    # WhatsApp monitoring
    if args.monitor_whatsapp:
        whatsapp_agent.open_whatsapp()
        whatsapp_agent.start_monitoring({"interval": 30})
        print("[Auto] 📱 WhatsApp monitoring started")

    # Job search
    if args.auto_job_search:
        skills = load_user_skills()
        if skills:
            job_agent.start_auto_search({
                "queries": skills,
                "interval": 60,
            })
            print(f"[Auto] 🔍 Auto job search started ({len(skills)} skills)")

    # Auto-update
    if args.auto_update:
        updater.start_auto_check({"interval": 30})
        print("[Auto] 🔄 Auto-update check started")

    # ====== NOTIFICATION CALLBACK ======
    def on_notification(data):
        """Handle notifications from agents"""
        ntype = data.get("type", "")

        if ntype == "whatsapp_message":
            sender = data.get("sender", "Unknown")
            preview = data.get("preview", "")
            windows_agent.send_notification({
                "title": f"💬 WhatsApp: {sender}",
                "message": preview or "New message",
            })
            if voice_engine:
                try:
                    voice_engine.speak(f"{sender} نے واٹس ایپ پر پیغام بھیجا", emotion="normal")
                except:
                    pass

        elif ntype == "new_jobs":
            count = data.get("count", 0)
            query = data.get("query", "")
            windows_agent.send_notification({
                "title": "📝 New Jobs Found!",
                "message": f"{count} jobs for '{query}'",
            })
            if voice_engine:
                try:
                    voice_engine.speak(f"{count} نئی جابز ملی ہیں", emotion="happy")
                except:
                    pass

    whatsapp_agent.notification_callback = on_notification
    job_agent.notification_callback = on_notification
    updater.update_callback = lambda info: on_notification({
        "type": "update",
        **info,
    })

    if args.background:
        print("[Background] Running desktop automation agent. Press Ctrl+C to stop.")
        try:
            while True:
                time.sleep(3600)
        except KeyboardInterrupt:
            connector.disconnect()
            print("[Background] Stopped")
        return

    # ====== LAUNCH ======
    if args.gui:
        try:
            import customtkinter as ctk
            _launch_dashboard(
                connector, voice_engine, stt_engine,
                windows_agent, file_agent,
                whatsapp_agent, job_agent, updater
            )
            return
        except ImportError:
            print("[GUI] CustomTkinter not available, using CLI")

    _launch_cli(
        connector, voice_engine, stt_engine,
        windows_agent, file_agent,
        whatsapp_agent, job_agent, updater
    )


# ============== SAFETY HELPERS ==============

def _confirm_destructive_action(action_name: str) -> bool:
    """Ask user to confirm a destructive action"""
    print()
    print(f"⚠️  WARNING: This will {action_name}")
    print("   This action cannot be undone!")
    response = input("   Type 'YES' to confirm, or press Enter to cancel: ").strip().upper()
    return response == "YES"


# ============== LOCAL CLI INTERFACE ==============

def _launch_local_cli(windows_agent, file_agent):
    """Local CLI mode - test desktop automation without cloud"""
    print("🤖 JARVIS Local Mode - Test Desktop Automation")
    print("   No cloud connection required")
    print()
    print("Available local actions:")
    print("   📸 !screenshot [path]        - Take screenshot")
    print("   💻 !system                   - Get system info")
    print("   📱 !open <app>               - Open application")
    print("   🌐 !url <url>                - Open URL")
    print("   🔍 !google <query>           - Google search")
    print("   📺 !youtube <query>          - YouTube search")
    print("   ⌨️  !type <text>              - Type text")
    print("   🎮 !hotkey <keys>            - Press hotkey (e.g., ctrl+c)")
    print("   🖱️  !click <x> <y>            - Click at coordinates")
    print("   🔑 !press <key>              - Press single key")
    print("   📋 !clip read                - Read clipboard")
    print("   📋 !clip write <text>        - Write to clipboard")
    print("   🔔 !notify <title> <msg>     - Send notification")
    print("   ❓ !help                     - Show this help")
    print()

    while True:
        try:
            user_input = input("local> ").strip()
            if not user_input:
                continue

            if user_input.lower() in ["exit", "quit", "بند"]:
                print("Goodbye! / خدا حافظ!")
                break

            parts = user_input.split(maxsplit=1)
            cmd = parts[0].lower()
            arg = parts[1] if len(parts) > 1 else ""

            # ============== LOCAL COMMANDS ==============
            if cmd == "!screenshot":
                path = arg or os.path.expanduser("~/Desktop/screenshot.png")
                result = windows_agent.screenshot({"path": path})
                print(f"📸 {result.get('message', result.get('error', ''))}")

            elif cmd == "!system":
                result = windows_agent.system_info()
                if result.get("success"):
                    info = result.get("data", {})
                    print("💻 System Info:")
                    for key, val in info.items():
                        print(f"   {key}: {val}")

            elif cmd == "!open":
                if not arg:
                    print("❌ Usage: !open <app_name>")
                    continue
                result = windows_agent.open_app({"name": arg})
                print(f"📱 {result.get('message', result.get('error', ''))}")

            elif cmd == "!url":
                if not arg:
                    print("❌ Usage: !url <url>")
                    continue
                result = windows_agent.open_url({"url": arg})
                print(f"🌐 {result.get('message', result.get('error', ''))}")

            elif cmd == "!google":
                if not arg:
                    print("❌ Usage: !google <query>")
                    continue
                result = windows_agent.google_search({"query": arg})
                print(f"🔍 {result.get('message', result.get('error', ''))}")

            elif cmd == "!youtube":
                if not arg:
                    print("❌ Usage: !youtube <query>")
                    continue
                result = windows_agent.youtube_search({"query": arg})
                print(f"📺 {result.get('message', result.get('error', ''))}")

            elif cmd == "!type":
                if not arg:
                    print("❌ Usage: !type <text>")
                    continue
                result = windows_agent.type_text({"text": arg})
                print(f"⌨️ {result.get('message', result.get('error', ''))}")

            elif cmd == "!hotkey":
                if not arg:
                    print("❌ Usage: !hotkey <keys> (e.g., ctrl+c)")
                    continue
                result = windows_agent.hotkey({"keys": arg})
                print(f"🎮 {result.get('message', result.get('error', ''))}")

            elif cmd == "!click":
                coords = arg.split()
                if len(coords) != 2:
                    print("❌ Usage: !click <x> <y>")
                    continue
                try:
                    result = windows_agent.click({"x": int(coords[0]), "y": int(coords[1])})
                    print(f"🖱️ {result.get('message', result.get('error', ''))}")
                except ValueError:
                    print("❌ Coordinates must be numbers")

            elif cmd == "!press":
                if not arg:
                    print("❌ Usage: !press <key>")
                    continue
                result = windows_agent.press({"key": arg})
                print(f"🔑 {result.get('message', result.get('error', ''))}")

            elif cmd == "!clip":
                subparts = arg.split(maxsplit=1)
                if not subparts:
                    print("❌ Usage: !clip read  or  !clip write <text>")
                    continue

                if subparts[0] == "read":
                    result = windows_agent.clipboard_read()
                    if result.get("success"):
                        print(f"📋 {result.get('data', {}).get('content', '')}")
                    else:
                        print(f"❌ {result.get('error', '')}")

                elif subparts[0] == "write":
                    text = subparts[1] if len(subparts) > 1 else ""
                    if not text:
                        print("❌ Usage: !clip write <text>")
                        continue
                    result = windows_agent.clipboard_write({"content": text})
                    print(f"📋 {result.get('message', result.get('error', ''))}")

            elif cmd == "!notify":
                parts_notify = arg.split(maxsplit=1)
                if len(parts_notify) < 2:
                    print("❌ Usage: !notify <title> <message>")
                    continue
                result = windows_agent.send_notification({
                    "title": parts_notify[0],
                    "message": parts_notify[1],
                })
                print(f"🔔 {result.get('message', result.get('error', ''))}")

            elif cmd == "!help":
                print("""
📋 JARVIS Local Commands:
  📸 !screenshot [path]    — Take screenshot
  💻 !system               — Get system info
  📱 !open <app>           — Open application
  🌐 !url <url>            — Open URL
  🔍 !google <query>       — Google search
  📺 !youtube <query>      — YouTube search
  ⌨️  !type <text>          — Type text
  🎮 !hotkey <keys>        — Press hotkey (ctrl+c, alt+tab, etc)
  🖱️  !click <x> <y>        — Click at coordinates
  🔑 !press <key>          — Press single key
  📋 !clip read            — Read clipboard
  📋 !clip write <text>    — Write to clipboard
  🔔 !notify <title> <msg> — Send notification
  ❓ !help                  — This help
""")

            else:
                print(f"❌ Unknown command: {cmd}. Type !help for list.")

        except KeyboardInterrupt:
            print("\n\nGoodbye! / خدا حافظ!")
            break
        except Exception as e:
            print(f"❌ Error: {e}")


# ============== CLI INTERFACE ==============

def _launch_cli(connector, voice_engine, stt_engine,
                windows_agent, file_agent,
                whatsapp_agent, job_agent, updater):
    """Enhanced CLI with all agent commands"""
    print("\n🤖 JARVIS Ready! Commands:")
    print("   📱 !whatsapp open|send|read|monitor")
    print("   📝 !job search <query>|report|auto")
    print("   💻 !screenshot|system|apps")
    print("   🔄 !update check|update|version")
    print("   🎤 !voice on|off")
    print("   ❓ !help")
    print()

    voice_enabled = True

    while True:
        try:
            user_input = input("\n👤 You: ").strip()
            if not user_input:
                continue

            # ============== COMMANDS ==============
            if user_input.startswith("!"):
                cmd = user_input[1:].strip().lower()
                parts = cmd.split(maxsplit=1)
                action = parts[0]
                arg = parts[1] if len(parts) > 1 else ""

                # === WHATSAPP ===
                if action == "whatsapp":
                    if arg == "open":
                        result = whatsapp_agent.open_whatsapp()
                        print(f"📱 {result.get('message', result.get('error', ''))}")

                    elif arg.startswith("send"):
                        print("📱 Contact name: ", end="", flush=True)
                        contact = input().strip()
                        print("📱 Message: ", end="", flush=True)
                        message = input().strip()
                        result = whatsapp_agent.send_message({
                            "contact": contact,
                            "message": message,
                        })
                        print(f"📱 {result.get('message', result.get('error', ''))}")

                    elif arg == "read":
                        print("📱 Contact (or press Enter for current chat): ", end="", flush=True)
                        contact = input().strip()
                        result = whatsapp_agent.read_chat({"contact": contact})
                        if result.get("messages"):
                            print(f"📱 Messages:\n{result['messages']}")
                        else:
                            print(f"📱 {result.get('message', 'Could not read chat')}")

                    elif arg == "monitor":
                        result = whatsapp_agent.start_monitoring({"interval": 30})
                        print(f"📱 {result.get('message', '')}")

                    elif arg.startswith("reply"):
                        print("📱 Contact: ", end="", flush=True)
                        contact = input().strip()
                        print("📱 Client said: ", end="", flush=True)
                        client_msg = input().strip()
                        result = whatsapp_agent.reply_to_client({
                            "contact": contact,
                            "client_message": client_msg,
                            "tone": "professional",
                        })
                        if result.get("success"):
                            print(f"📱 Reply sent: {result.get('generated_reply', '')}")
                        else:
                            print(f"📱 ❌ {result.get('error', '')}")

                    else:
                        print("📱 Usage: !whatsapp open|send|read|monitor|reply")

                # === JOB SEARCH ===
                elif action == "job":
                    if arg.startswith("search"):
                        query = arg.replace("search", "").strip()
                        if not query:
                            print("📝 Query: ", end="", flush=True)
                            query = input().strip()
                        print(f"📝 Searching for: {query}...")
                        result = job_agent.search_all_platforms({"query": query})
                        if result.get("success"):
                            print(f"📝 Found {result.get('total_jobs', 0)} jobs!")
                            for i, job in enumerate(result.get("jobs", [])[:10], 1):
                                print(f"\n  {i}. {job.get('title', 'Untitled')}")
                                print(f"     💰 {job.get('budget', 'N/A')} | 🏢 {job.get('platform', 'Unknown')}")
                        else:
                            print(f"📝 ❌ {result.get('error', 'Search failed')}")

                    elif arg == "report":
                        result = job_agent.daily_job_report()
                        print(result.get("report", "No report"))

                    elif arg == "auto":
                        skills = load_user_skills()
                        if skills:
                            result = job_agent.start_auto_search({
                                "queries": skills,
                                "interval": 60,
                            })
                            print(f"📝 {result.get('message', '')}")
                        else:
                            print("📝 No skills configured. Edit config.json")

                    else:
                        print("📝 Usage: !job search <query>|report|auto")

                # === UPDATE ===
                elif action == "update":
                    if arg == "check":
                        result = updater.check_for_updates()
                        print(f"🔄 {result.get('message', '')}")
                        if result.get("update_available"):
                            print(f"   Commits: {result.get('new_commits', 0)}")

                    elif arg == "update" or arg == "now":
                        if _confirm_destructive_action("restart the application to install updates"):
                            print("🔄 Updating...")
                            result = updater.perform_update({"auto_restart": True})
                            print(f"🔄 {result.get('message', result.get('error', ''))}")
                        else:
                            print("🔄 Update cancelled")

                    elif arg == "version":
                        result = updater.get_version_info()
                        print(f"🔄 Version: {result.get('version', 'unknown')}")

                    else:
                        print("🔄 Usage: !update check|update|version")

                # === SYSTEM ===
                elif action == "screenshot":
                    result = windows_agent.screenshot()
                    print(f"📸 {result}")

                elif action == "system":
                    result = windows_agent.system_info()
                    print(f"💻 {json.dumps(result, indent=2)}")

                elif action == "voice":
                    if arg == "on":
                        voice_enabled = True
                        print("🎤 Voice enabled")
                    elif arg == "off":
                        voice_enabled = False
                        print("🔇 Voice disabled")
                    else:
                        print("🎤 Usage: !voice on|off")

                elif action == "help":
                    print("""
📋 JARVIS Commands:
  📱 !whatsapp open       — Open WhatsApp Desktop
  📱 !whatsapp send       — Send message to contact
  📱 !whatsapp read       — Read current chat
  📱 !whatsapp monitor    — Auto-monitor for new messages
  📱 !whatsapp reply      — AI-powered reply to client (as Ryan)
  📝 !job search <query>  — Search all platforms for jobs
  📝 !job report          — Daily job report
  📝 !job auto            — Start automatic job searching
  💻 !screenshot           — Take screenshot
  💻 !system               — System info
  🔄 !update check         — Check for software updates
  🔄 !update update        — Install updates & restart
  🎤 !voice on|off         — Toggle voice output
  ❓ !help                  — This help
""")

                else:
                    print(f"❓ Unknown command: !{action}. Type !help for list.")

            # ============== CHAT WITH JARVIS ==============
            else:
                print("🤖 JARVIS: ", end="", flush=True)
                response = connector.send_message(user_input)
                print(response)

                if voice_enabled and voice_engine:
                    voice_engine.speak(response, emotion="normal")

        except KeyboardInterrupt:
            print("\n\n👋 Goodbye! / خدا حافظ!")
            break
        except EOFError:
            break
        except Exception as e:
            print(f"❌ Error: {e}")


# ============== DASHBOARD GUI ==============

def _launch_dashboard(connector, voice_engine, stt_engine,
                      windows_agent, file_agent,
                      whatsapp_agent, job_agent, updater):
    """Launch CustomTkinter Dashboard with all agent panels"""
    import customtkinter as ctk

    ctk.set_appearance_mode("dark")
    ctk.set_default_color_theme("blue")

    app = ctk.CTk()
    app.title("JARVIS Hybrid — Desktop Agent")
    app.geometry("1100x750")

    # ====== LAYOUT ======
    # Sidebar with agent buttons
    sidebar = ctk.CTkFrame(app, width=200)
    sidebar.pack(side="left", fill="y", padx=5, pady=5)
    sidebar.pack_propagate(False)

    # Main content area
    content = ctk.CTkFrame(app)
    content.pack(side="right", fill="both", expand=True, padx=5, pady=5)

    # ====== SIDEBAR BUTTONS ======
    ctk.CTkLabel(sidebar, text="🤖 JARVIS", font=("", 20, "bold")).pack(pady=15)
    ctk.CTkLabel(sidebar, text="Identity: Ryan", font=("", 11)).pack()

    def show_chat():
        for w in content.winfo_children():
            w.destroy()
        _build_chat_panel(content, connector, voice_engine, stt_engine)

    def show_whatsapp():
        for w in content.winfo_children():
            w.destroy()
        _build_whatsapp_panel(content, whatsapp_agent, connector)

    def show_jobs():
        for w in content.winfo_children():
            w.destroy()
        _build_jobs_panel(content, job_agent, connector)

    def show_update():
        for w in content.winfo_children():
            w.destroy()
        _build_update_panel(content, updater)

    ctk.CTkButton(sidebar, text="💬 Chat", command=show_chat, height=40).pack(fill="x", padx=10, pady=3)
    ctk.CTkButton(sidebar, text="📱 WhatsApp", command=show_whatsapp, height=40).pack(fill="x", padx=10, pady=3)
    ctk.CTkButton(sidebar, text="📝 Jobs", command=show_jobs, height=40).pack(fill="x", padx=10, pady=3)
    ctk.CTkButton(sidebar, text="🔄 Updates", command=show_update, height=40).pack(fill="x", padx=10, pady=3)

    # Status
    ctk.CTkLabel(sidebar, text="").pack(expand=True)
    status_label = ctk.CTkLabel(sidebar, text="🟢 Online", font=("", 11))
    status_label.pack(pady=5)

    version_label = ctk.CTkLabel(sidebar, text=f"v{updater.current_version}", font=("", 10))
    version_label.pack(pady=2)

    # Show chat by default
    show_chat()

    app.mainloop()


def _build_chat_panel(parent, connector, voice_engine, stt_engine):
    """Build chat panel"""
    import customtkinter as ctk

    ctk.CTkLabel(parent, text="💬 Chat with JARVIS", font=("", 16, "bold")).pack(pady=10)

    # Chat display
    chat = ctk.CTkScrollableFrame(parent)
    chat.pack(fill="both", expand=True, padx=10, pady=5)

    # Input
    input_frame = ctk.CTkFrame(parent)
    input_frame.pack(fill="x", padx=10, pady=5)

    entry = ctk.CTkEntry(input_frame, height=40, placeholder_text="Type your message...")
    entry.pack(side="left", fill="x", expand=True, padx=(0, 5))

    def send():
        msg = entry.get().strip()
        if not msg:
            return
        entry.delete(0, "end")

        ctk.CTkLabel(chat, text=f"👤 You: {msg}", wraplength=600, justify="left").pack(anchor="e", pady=2)
        response = connector.send_message(msg)
        ctk.CTkLabel(chat, text=f"🤖 JARVIS: {response}", wraplength=600, justify="left").pack(anchor="w", pady=2)

        if voice_engine:
            voice_engine.speak(response, emotion="normal")

    ctk.CTkButton(input_frame, text="Send", command=send, width=80).pack(side="right")
    entry.bind("<Return>", lambda e: send())


def _build_whatsapp_panel(parent, whatsapp_agent, connector):
    """Build WhatsApp panel"""
    import customtkinter as ctk

    ctk.CTkLabel(parent, text="📱 WhatsApp Automation", font=("", 16, "bold")).pack(pady=10)
    ctk.CTkLabel(parent, text="Identity: Ryan — Never reveals AI", text_color="green").pack()

    # Quick actions
    actions = ctk.CTkFrame(parent)
    actions.pack(fill="x", padx=10, pady=10)

    def open_wa():
        result = whatsapp_agent.open_whatsapp()
        status.configure(text=result.get("message", "Failed"))

    def monitor_wa():
        result = whatsapp_agent.start_monitoring({"interval": 30})
        status.configure(text=result.get("message", ""))

    ctk.CTkButton(actions, text="📱 Open WhatsApp", command=open_wa).pack(side="left", padx=5)
    ctk.CTkButton(actions, text="👁️ Start Monitoring", command=monitor_wa).pack(side="left", padx=5)

    # Send message
    send_frame = ctk.CTkFrame(parent)
    send_frame.pack(fill="x", padx=10, pady=5)

    ctk.CTkLabel(send_frame, text="Contact:").grid(row=0, column=0, padx=5)
    contact_entry = ctk.CTkEntry(send_frame, width=200, placeholder_text="Contact name")
    contact_entry.grid(row=0, column=1, padx=5)

    ctk.CTkLabel(send_frame, text="Message:").grid(row=1, column=0, padx=5)
    msg_entry = ctk.CTkEntry(send_frame, width=400, placeholder_text="Type message...")
    msg_entry.grid(row=1, column=1, padx=5, pady=5)

    def send_wa():
        contact = contact_entry.get().strip()
        msg = msg_entry.get().strip()
        if not contact or not msg:
            return
        result = whatsapp_agent.send_message({"contact": contact, "message": msg})
        status.configure(text=result.get("message", result.get("error", "")))

    ctk.CTkButton(send_frame, text="Send", command=send_wa).grid(row=1, column=2, padx=5)

    # AI Reply section
    reply_frame = ctk.CTkFrame(parent)
    reply_frame.pack(fill="x", padx=10, pady=5)

    ctk.CTkLabel(reply_frame, text="🤖 AI Auto-Reply (as Ryan):").pack(anchor="w", padx=5)
    ctk.CTkLabel(reply_frame, text="Client message:").pack(anchor="w", padx=5)
    client_msg = ctk.CTkEntry(reply_frame, width=400, placeholder_text="What did the client say?")
    client_msg.pack(padx=5, pady=2)

    def ai_reply():
        contact = contact_entry.get().strip()
        msg = client_msg.get().strip()
        if not contact or not msg:
            return
        result = whatsapp_agent.reply_to_client({
            "contact": contact,
            "client_message": msg,
            "tone": "professional",
        })
        if result.get("success"):
            status.configure(text=f"Reply sent: {result.get('generated_reply', '')[:100]}")
        else:
            status.configure(text=f"Error: {result.get('error', '')}")

    ctk.CTkButton(reply_frame, text="💬 AI Reply", command=ai_reply).pack(pady=5)

    # Status
    status = ctk.CTkLabel(parent, text="Ready", font=("", 12))
    status.pack(pady=10)


def _build_jobs_panel(parent, job_agent, connector):
    """Build Job Search panel"""
    import customtkinter as ctk

    ctk.CTkLabel(parent, text="📝 Job Search", font=("", 16, "bold")).pack(pady=10)

    # Search
    search_frame = ctk.CTkFrame(parent)
    search_frame.pack(fill="x", padx=10, pady=5)

    search_entry = ctk.CTkEntry(search_frame, width=400, placeholder_text="Search jobs (e.g., Python developer, web scraping...)")
    search_entry.pack(side="left", padx=5, pady=5)

    result_text = ctk.CTkTextbox(parent, height=300)
    result_text.pack(fill="both", expand=True, padx=10, pady=5)

    def search():
        query = search_entry.get().strip()
        if not query:
            return
        result_text.delete("1.0", "end")
        result_text.insert("end", f"🔍 Searching for: {query}...\n\n")
        result = job_agent.search_all_platforms({"query": query})
        if result.get("success"):
            result_text.insert("end", f"Found {result.get('total_jobs', 0)} jobs!\n\n")
            for i, job in enumerate(result.get("jobs", [])[:15], 1):
                result_text.insert("end", f"{i}. {job.get('title', 'Untitled')}\n")
                result_text.insert("end", f"   💰 {job.get('budget', 'N/A')} | 🏢 {job.get('platform', 'Unknown')}\n\n")
        else:
            result_text.insert("end", f"❌ {result.get('error', 'Search failed')}")

    def auto_search():
        skills = load_user_skills()
        if skills:
            result = job_agent.start_auto_search({"queries": skills, "interval": 60})
            result_text.delete("1.0", "end")
            result_text.insert("end", result.get("message", "Started"))

    def report():
        result = job_agent.daily_job_report()
        result_text.delete("1.0", "end")
        result_text.insert("end", result.get("report", "No report"))

    ctk.CTkButton(search_frame, text="🔍 Search", command=search).pack(side="left", padx=5)
    ctk.CTkButton(search_frame, text="🤖 Auto Search", command=auto_search).pack(side="left", padx=5)
    ctk.CTkButton(search_frame, text="📊 Report", command=report).pack(side="left", padx=5)


def _build_update_panel(parent, updater):
    """Build Update panel"""
    import customtkinter as ctk

    ctk.CTkLabel(parent, text="🔄 Software Updates", font=("", 16, "bold")).pack(pady=10)

    version_info = updater.get_version_info()
    ctk.CTkLabel(parent, text=f"Current Version: {version_info.get('version', 'unknown')}", font=("", 14)).pack(pady=5)

    result_text = ctk.CTkTextbox(parent, height=200)
    result_text.pack(fill="both", expand=True, padx=10, pady=5)

    def check():
        result = updater.check_for_updates()
        result_text.delete("1.0", "end")
        result_text.insert("end", result.get("message", ""))
        if result.get("update_available"):
            result_text.insert("end", f"\n\nNew commits: {result.get('new_commits', 0)}")
            for commit in result.get("commits", [])[:5]:
                result_text.insert("end", f"\n  • {commit}")

    def update_now():
        result_text.delete("1.0", "end")
        result_text.insert("end", "🔄 Updating...\n")
        result = updater.perform_update({"auto_restart": True})
        result_text.insert("end", result.get("message", result.get("error", "")))

    def auto_update():
        updater.start_auto_check({"interval": 30})
        result_text.delete("1.0", "end")
        result_text.insert("end", "✅ Auto-update check enabled (every 30 min)")

    btn_frame = ctk.CTkFrame(parent)
    btn_frame.pack(fill="x", padx=10, pady=5)

    ctk.CTkButton(btn_frame, text="🔍 Check Updates", command=check).pack(side="left", padx=5)
    ctk.CTkButton(btn_frame, text="⬇️ Update Now", command=update_now).pack(side="left", padx=5)
    ctk.CTkButton(btn_frame, text="🔄 Auto-Update", command=auto_update).pack(side="left", padx=5)


# ============== HELPERS ==============

def load_api_keys() -> dict:
    """Load API keys from config"""
    config_path = os.path.join(os.path.dirname(__file__), "config.json")
    if os.path.exists(config_path):
        with open(config_path, "r") as f:
            config = json.load(f)
        return config.get("api_keys", {})
    return {}


def load_user_skills() -> list:
    """Load user skills for job search"""
    config_path = os.path.join(os.path.dirname(__file__), "config.json")
    if os.path.exists(config_path):
        with open(config_path, "r") as f:
            config = json.load(f)
        return config.get("skills", ["Python", "Web Development", "Data Entry"])
    return ["Python", "Web Development", "Data Entry"]


if __name__ == "__main__":
    main()
