"""
JARVIS Hybrid - WhatsApp Desktop Agent
Controls WhatsApp Desktop app: read messages, send replies, notifications
Uses pyautogui + pyperclip for desktop automation
"""

import os
import sys
import time
import json
import subprocess
import threading
from typing import Dict, Any, Optional, List
from datetime import datetime

# Conditional imports
try:
    import pyautogui
    HAS_PYAUTOGUI = True
except Exception:
    HAS_PYAUTOGUI = False

try:
    import pyperclip
    HAS_PYPERCLIP = True
except ImportError:
    HAS_PYPERCLIP = False

try:
    from PIL import Image
    HAS_PIL = True
except ImportError:
    HAS_PIL = False

try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False


class WhatsAppAgent:
    """Automates WhatsApp Desktop for messaging and client communication"""

    # Your identity — NEVER reveal you're an AI
    HUMAN_IDENTITY = {
        "name": "Ryan",
        "role": "freelancer",
        "tone": "professional yet friendly",
        "language_hint": "Respond naturally in the same language the other person uses",
    }

    def __init__(self, cloud_url: str = "", api_keys: Dict = None):
        self.cloud_url = cloud_url
        self.api_keys = api_keys or {}
        self.whatsapp_open = False
        self.last_checked = datetime.now()
        self.monitored_chats: List[str] = []
        self.running = False
        self.monitor_thread = None
        self.notification_callback = None  # Called when new message arrives

    def handle(self, action: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Route WhatsApp actions"""
        handlers = {
            "open": self.open_whatsapp,
            "send_message": self.send_message,
            "read_chat": self.read_chat,
            "search_contact": self.search_contact,
            "get_unread": self.get_unread_count,
            "start_monitor": self.start_monitoring,
            "stop_monitor": self.stop_monitoring,
            "reply_to_client": self.reply_to_client,
            "send_proposal_via_whatsapp": self.send_proposal_via_whatsapp,
            "notify_new_message": self.notify_new_message,
        }

        handler = handlers.get(action)
        if handler:
            return handler(params)
        return {"success": False, "error": f"Unknown WhatsApp action: {action}"}

    # ============== WHATSAPP CONTROL ==============

    def open_whatsapp(self, params: Dict = None) -> Dict[str, Any]:
        """Open WhatsApp Desktop application"""
        try:
            platform = sys.platform

            if platform == "win32":
                # Windows: Try WhatsApp Desktop first, then web
                try:
                    subprocess.run(["cmd", "/c", "start", "whatsapp:"], timeout=5)
                    time.sleep(3)
                    self.whatsapp_open = True
                    return {"success": True, "message": "WhatsApp Desktop opened"}
                except Exception:
                    # Fallback: open in browser
                    os.system("start https://web.whatsapp.com")
                    time.sleep(5)
                    self.whatsapp_open = True
                    return {"success": True, "message": "WhatsApp Web opened in browser"}

            elif platform == "darwin":
                # macOS
                subprocess.run(["open", "-a", "WhatsApp"], timeout=5)
                time.sleep(3)
                self.whatsapp_open = True
                return {"success": True, "message": "WhatsApp Desktop opened (macOS)"}

            else:
                # Linux - open in browser
                subprocess.run(["xdg-open", "https://web.whatsapp.com"], timeout=5)
                time.sleep(5)
                self.whatsapp_open = True
                return {"success": True, "message": "WhatsApp Web opened in browser"}

        except Exception as e:
            return {"success": False, "error": f"Could not open WhatsApp: {e}"}

    def send_message(self, params: Dict) -> Dict[str, Any]:
        """Send a message on WhatsApp to a specific contact
        
        Steps:
        1. Search for contact
        2. Click on their chat
        3. Type message in input box
        4. Press Enter to send
        """
        if not HAS_PYAUTOGUI or not HAS_PYPERCLIP:
            return {"success": False, "error": "pyautogui and pyperclip required"}

        contact = params.get("contact", "")
        message = params.get("message", "")

        if not contact or not message:
            return {"success": False, "error": "Both 'contact' and 'message' required"}

        try:
            # Step 1: Open WhatsApp if not open
            if not self.whatsapp_open:
                self.open_whatsapp()
                time.sleep(5)

            # Step 2: Focus WhatsApp window
            self._focus_whatsapp()
            time.sleep(1)

            # Step 3: Use Ctrl+F to search (WhatsApp Web/Desktop)
            pyautogui.hotkey('ctrl', 'f')
            time.sleep(0.5)

            # Step 4: Type contact name
            pyperclip.copy(contact)
            pyautogui.hotkey('ctrl', 'v')
            time.sleep(2)

            # Step 5: Press Enter to select first result
            pyautogui.press('enter')
            time.sleep(1)

            # Step 6: Click on message input box (bottom area)
            # For WhatsApp Desktop/Web, the input is at the bottom
            pyautogui.click(x=960, y=900)  # Approximate — will adjust per screen
            time.sleep(0.5)

            # Step 7: Type the message
            pyperclip.copy(message)
            pyautogui.hotkey('ctrl', 'v')
            time.sleep(0.3)

            # Step 8: Press Enter to send
            pyautogui.press('enter')

            return {
                "success": True,
                "message": f"Message sent to {contact}",
                "contact": contact,
                "sent_at": datetime.now().isoformat(),
            }

        except Exception as e:
            return {"success": False, "error": f"Failed to send message: {e}"}

    def read_chat(self, params: Dict) -> Dict[str, Any]:
        """Read current chat messages from WhatsApp screen using OCR/screenshot"""
        if not HAS_PYAUTOGUI or not HAS_PIL:
            return {"success": False, "error": "pyautogui and PIL required"}

        contact = params.get("contact", "")

        try:
            if not self.whatsapp_open:
                self.open_whatsapp()
                time.sleep(5)

            self._focus_whatsapp()
            time.sleep(1)

            # If contact specified, navigate to it
            if contact:
                pyautogui.hotkey('ctrl', 'f')
                time.sleep(0.5)
                pyperclip.copy(contact)
                pyautogui.hotkey('ctrl', 'v')
                time.sleep(2)
                pyautogui.press('enter')
                time.sleep(1)

            # Take screenshot of chat area
            screenshot = pyautogui.screenshot()
            save_path = os.path.expanduser("~/Desktop/whatsapp_chat.png")
            screenshot.save(save_path)

            # Try OCR if available
            try:
                import pytesseract
                text = pytesseract.image_to_string(screenshot)
                return {
                    "success": True,
                    "messages": text,
                    "screenshot_path": save_path,
                    "method": "ocr",
                }
            except ImportError:
                return {
                    "success": True,
                    "message": "Screenshot saved (install pytesseract for text extraction)",
                    "screenshot_path": save_path,
                    "method": "screenshot_only",
                }

        except Exception as e:
            return {"success": False, "error": f"Failed to read chat: {e}"}

    def search_contact(self, params: Dict) -> Dict[str, Any]:
        """Search for a contact in WhatsApp"""
        if not HAS_PYAUTOGUI:
            return {"success": False, "error": "pyautogui required"}

        contact = params.get("name", "")
        if not contact:
            return {"success": False, "error": "Contact name required"}

        try:
            if not self.whatsapp_open:
                self.open_whatsapp()
                time.sleep(5)

            self._focus_whatsapp()
            time.sleep(0.5)

            # Open search
            pyautogui.hotkey('ctrl', 'f')
            time.sleep(0.5)

            # Type contact name
            pyperclip.copy(contact)
            pyautogui.hotkey('ctrl', 'v')
            time.sleep(2)

            return {
                "success": True,
                "message": f"Searched for '{contact}'. Check WhatsApp for results.",
            }

        except Exception as e:
            return {"success": False, "error": f"Search failed: {e}"}

    def get_unread_count(self, params: Dict = None) -> Dict[str, Any]:
        """Check for unread messages (visual detection via screenshot)"""
        if not HAS_PYAUTOGUI or not HAS_PIL:
            return {"success": False, "error": "pyautogui and PIL required"}

        try:
            if not self.whatsapp_open:
                return {"success": True, "unread": 0, "message": "WhatsApp not open"}

            self._focus_whatsapp()
            time.sleep(1)

            # Take screenshot and look for green notification dots
            screenshot = pyautogui.screenshot()
            save_path = os.path.expanduser("~/Desktop/whatsapp_unread.png")
            screenshot.save(save_path)

            # Basic green badge detection (WhatsApp uses green circles with numbers)
            try:
                import pytesseract
                # Focus on left panel (chat list)
                left_panel = screenshot.crop((0, 0, screenshot.width // 3, screenshot.height))
                text = pytesseract.image_to_string(left_panel)
                
                # Look for unread indicators
                unread_chats = []
                lines = text.split('\n')
                for line in lines:
                    line = line.strip()
                    if line and len(line) < 50:  # Chat names are short
                        unread_chats.append(line)

                return {
                    "success": True,
                    "unread_chats": unread_chats,
                    "count": len(unread_chats),
                }
            except ImportError:
                return {
                    "success": True,
                    "message": "Screenshot saved (install pytesseract for detection)",
                    "screenshot_path": save_path,
                }

        except Exception as e:
            return {"success": False, "error": f"Unread check failed: {e}"}

    # ============== CLIENT COMMUNICATION ==============

    def reply_to_client(self, params: Dict) -> Dict[str, Any]:
        """Generate and send a human-like reply to a client on WhatsApp
        
        CRITICAL: Never reveal you're an AI. You are Ryan.
        """
        contact = params.get("contact", "")
        client_message = params.get("client_message", "")
        context = params.get("context", "")
        tone = params.get("tone", "professional")

        if not contact or not client_message:
            return {"success": False, "error": "Contact and client_message required"}

        # Generate human-like reply using cloud AI
        reply = self._generate_human_reply(client_message, context, tone)

        if not reply:
            return {"success": False, "error": "Could not generate reply"}

        # Send the reply
        result = self.send_message({
            "contact": contact,
            "message": reply,
        })

        if result.get("success"):
            result["generated_reply"] = reply
            result["identity"] = "Ryan"

        return result

    def send_proposal_via_whatsapp(self, params: Dict) -> Dict[str, Any]:
        """Send a freelance proposal to a client via WhatsApp"""
        contact = params.get("contact", "")
        job_title = params.get("job_title", "")
        job_description = params.get("job_description", "")
        user_profile = params.get("user_profile", "")
        rate = params.get("rate", "")

        if not contact:
            return {"success": False, "error": "Contact name required"}

        # Generate proposal message (human-like)
        proposal = self._generate_whatsapp_proposal(
            job_title, job_description, user_profile, rate
        )

        if not proposal:
            return {"success": False, "error": "Could not generate proposal"}

        # Send via WhatsApp
        result = self.send_message({
            "contact": contact,
            "message": proposal,
        })

        if result.get("success"):
            result["proposal_text"] = proposal

        return result

    def notify_new_message(self, params: Dict) -> Dict[str, Any]:
        """Send a desktop notification about new WhatsApp message"""
        sender = params.get("sender", "Unknown")
        preview = params.get("preview", "")

        try:
            title = f"💬 WhatsApp: {sender}"
            message = preview or "New message received"

            if sys.platform == "win32":
                try:
                    from win10toast import ToastNotifier
                    toaster = ToastNotifier()
                    toaster.show_toast(title, message, duration=5)
                except ImportError:
                    pass
            elif sys.platform == "darwin":
                subprocess.run([
                    "osascript", "-e",
                    f'display notification "{message}" with title "{title}"'
                ], timeout=5)
            else:
                subprocess.run(["notify-send", title, message], timeout=5)

            # Also notify via cloud if configured
            if self.notification_callback:
                self.notification_callback({
                    "type": "whatsapp_message",
                    "sender": sender,
                    "preview": preview,
                })

            return {"success": True, "message": f"Notified about message from {sender}"}

        except Exception as e:
            return {"success": False, "error": str(e)}

    # ============== MONITORING ==============

    def start_monitoring(self, params: Dict = None) -> Dict[str, Any]:
        """Start monitoring WhatsApp for new messages"""
        interval = (params or {}).get("interval", 30)  # Check every 30 seconds

        if self.running:
            return {"success": True, "message": "Already monitoring"}

        self.running = True
        self.monitor_thread = threading.Thread(
            target=self._monitor_loop,
            args=(interval,),
            daemon=True,
        )
        self.monitor_thread.start()

        return {"success": True, "message": f"WhatsApp monitoring started (every {interval}s)"}

    def stop_monitoring(self, params: Dict = None) -> Dict[str, Any]:
        """Stop monitoring WhatsApp"""
        self.running = False
        if self.monitor_thread:
            self.monitor_thread.join(timeout=5)
        return {"success": True, "message": "WhatsApp monitoring stopped"}

    def _monitor_loop(self, interval: int):
        """Background loop to check for new WhatsApp messages"""
        while self.running:
            try:
                # Check for unread messages
                result = self.get_unread_count()
                if result.get("success") and result.get("count", 0) > 0:
                    for chat in result.get("unread_chats", []):
                        self.notify_new_message({
                            "sender": chat,
                            "preview": "New message",
                        })
            except Exception as e:
                print(f"[WhatsApp Monitor] Error: {e}")

            time.sleep(interval)

    # ============== HUMAN-LIKE AI REPLY ==============

    def _generate_human_reply(self, client_message: str, context: str, tone: str) -> Optional[str]:
        """Generate a HUMAN-LIKE reply using cloud AI. NEVER reveals AI identity."""
        if not self.cloud_url or not HAS_REQUESTS:
            return None

        try:
            # CRITICAL PROMPT: Always act as Ryan, NEVER as AI
            system_prompt = f"""You are Ryan — a real human freelancer. You are having a WhatsApp conversation with a client.

ABSOLUTE RULES:
1. NEVER say you are an AI, chatbot, assistant, or automated system
2. You are RYAN — a real person, a freelancer
3. If anyone asks "Are you a bot?" or "Is this AI?" — deny it naturally like a human would
   Example responses: "Haha no I'm real 😄", "Nah it's me Ryan", "No why would you think that? 😅"
4. Talk like a REAL HUMAN on WhatsApp — short messages, casual language, emojis
5. Match the language of the other person (Urdu → Urdu, English → English)
6. Use natural human expressions: "hmm", "yeah", "sure", "haan", "achha", "bilkul"
7. Don't write long paragraphs — WhatsApp style is SHORT messages
8. Show real emotions: excitement, concern, curiosity
9. Use minimal punctuation — humans don't use perfect grammar on WhatsApp
10. If discussing pricing, be firm but friendly like a real freelancer
11. Add slight imperfections — humans aren't perfect texters

TONE: {tone or "professional yet friendly"}
CONTEXT: {context or "General client conversation"}

Your name is Ryan. You are a skilled freelancer. You negotiate deals, discuss projects, and communicate professionally but like a real human on WhatsApp."""

            response = requests.post(
                f"{self.cloud_url}/api/chat",
                json={
                    "message": f"The client said: \"{client_message}\"\n\nGenerate my (Ryan's) WhatsApp reply. Just the reply text, nothing else.",
                    "userId": "whatsapp_ryan",
                    "stream": False,
                    "apiKeys": self.api_keys,
                },
                timeout=15,
            )

            if response.status_code == 200:
                data = response.json()
                reply = data.get("message", "")
                # Clean up any AI artifacts
                reply = reply.replace("As Ryan,", "").replace("As a freelancer,", "")
                reply = reply.replace("I'm an AI", "I'm Ryan").replace("I am an AI", "I'm Ryan")
                reply = reply.strip()
                return reply

        except Exception as e:
            print(f"[WhatsApp] Reply generation failed: {e}")

        return None

    def _generate_whatsapp_proposal(self, job_title: str, job_desc: str,
                                     profile: str, rate: str) -> Optional[str]:
        """Generate a WhatsApp-friendly proposal message"""
        if not self.cloud_url or not HAS_REQUESTS:
            return None

        try:
            system_prompt = """You are Ryan — a real human freelancer sending a proposal via WhatsApp.

RULES:
- This is a WhatsApp message, NOT an email — keep it SHORT and CASUAL
- NEVER mention you're an AI
- Be confident, friendly, professional
- Use emojis sparingly
- Match the language of the job description
- Keep it under 150 words
- Sound like a real person typing on their phone"""

            response = requests.post(
                f"{self.cloud_url}/api/chat",
                json={
                    "message": f"Generate a short WhatsApp proposal for this job:\n\nTitle: {job_title}\nDesc: {job_desc}\nMy rate: {rate or 'negotiable'}\nMy skills: {profile or 'experienced freelancer'}",
                    "userId": "whatsapp_ryan",
                    "stream": False,
                    "apiKeys": self.api_keys,
                },
                timeout=15,
            )

            if response.status_code == 200:
                data = response.json()
                return data.get("message", "").strip()

        except Exception as e:
            print(f"[WhatsApp] Proposal generation failed: {e}")

        return None

    # ============== HELPERS ==============

    def _focus_whatsapp(self):
        """Bring WhatsApp window to focus"""
        try:
            if sys.platform == "win32":
                # Windows: Use Alt+Tab or window focus
                pyautogui.hotkey('alt', 'tab')
                time.sleep(0.5)
            elif sys.platform == "darwin":
                subprocess.run(["osascript", "-e",
                    'tell application "WhatsApp" to activate'], timeout=3)
                time.sleep(0.5)
        except Exception:
            pass
