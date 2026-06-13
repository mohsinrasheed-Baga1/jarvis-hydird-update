"""
JARVIS Hybrid - Local Windows Agent
Handles OS-level operations that require direct system access
"""

import os
import sys
import platform
import subprocess
import webbrowser
from typing import Dict, Any

# Conditional imports
try:
    import pyautogui
    HAS_PYAUTOGUI = True
except Exception:
    HAS_PYAUTOGUI = False

try:
    import psutil
    HAS_PSUTIL = True
except ImportError:
    HAS_PSUTIL = False

try:
    import pyperclip
    HAS_PYPERCLIP = True
except ImportError:
    HAS_PYPERCLIP = False

try:
    from pynput import keyboard as pynput_keyboard
    HAS_PYNPUT = True
except ImportError:
    HAS_PYNPUT = False


class LocalWindowsAgent:
    """Local Windows/System control agent"""

    def __init__(self):
        self.platform = platform.system()  # Returns "Windows", "Darwin", "Linux"
        self.is_windows = sys.platform == "win32"

    def handle(self, action: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Route action to appropriate handler"""
        handlers = {
            "screenshot": self.screenshot,
            "open_app": self.open_app,
            "open_url": self.open_url,
            "google_search": self.google_search,
            "youtube_search": self.youtube_search,
            "type_text": self.type_text,
            "hotkey": self.hotkey,
            "click": self.click,
            "press": self.press,
            "system_info": self.system_info,
            "volume": self.set_volume,
            "set_volume": self.set_volume,
            "volume_up": self.volume_up,
            "volume_down": self.volume_down,
            "mute_toggle": self.mute_toggle,
            "brightness": self.set_brightness,
            "lock_screen": self.lock_screen,
            "shutdown": self.shutdown,
            "clipboard_read": self.clipboard_read,
            "clipboard_write": self.clipboard_write,
            "key_press": self.key_press,
            "notify": self.send_notification,
        }

        handler = handlers.get(action)
        if handler:
            try:
                return handler(params)
            except Exception as e:
                return {"success": False, "error": str(e), "action": action}
        return {"success": False, "error": f"Unknown action: {action}"}

    def screenshot(self, params: Dict = None) -> Dict[str, Any]:
        """Take a screenshot"""
        if not HAS_PYAUTOGUI:
            return {"success": False, "error": "pyautogui not available"}

        try:
            save_path = (params or {}).get("path", os.path.expanduser("~/Desktop/screenshot.png"))
            os.makedirs(os.path.dirname(save_path), exist_ok=True)
            ss = pyautogui.screenshot()
            ss.save(save_path)
            return {
                "success": True,
                "message": f"Screenshot saved: {save_path}",
                "path": save_path,
                "data": {"path": save_path},
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    def open_app(self, params: Dict) -> Dict[str, Any]:
        """Open an application safely"""
        app = params.get("name", "").strip()
        if not app:
            return {"success": False, "error": "App name required"}

        try:
            if self.is_windows:
                # Use os.startfile on Windows for better app launching
                try:
                    os.startfile(app)
                except OSError:
                    # If startfile fails, try through shell/subprocess
                    subprocess.Popen(app, shell=True)
            elif self.platform == "Darwin":
                subprocess.Popen(["open", "-a", app])
            else:
                subprocess.Popen(["xdg-open", app])

            return {"success": True, "message": f"Opened {app}"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def open_url(self, params: Dict) -> Dict[str, Any]:
        """Open a URL in default browser"""
        url = params.get("url", "").strip()
        if not url:
            return {"success": False, "error": "URL required"}

        try:
            webbrowser.open(url)
            return {"success": True, "message": f"Opened URL: {url}"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def google_search(self, params: Dict) -> Dict[str, Any]:
        """Open Google search"""
        query = params.get("query", "").strip()
        if not query:
            return {"success": False, "error": "Search query required"}

        try:
            url = f"https://www.google.com/search?q={query}"
            webbrowser.open(url)
            return {"success": True, "message": f"Google search: {query}"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def youtube_search(self, params: Dict) -> Dict[str, Any]:
        """Open YouTube search"""
        query = params.get("query", "").strip()
        if not query:
            return {"success": False, "error": "Search query required"}

        try:
            url = f"https://www.youtube.com/results?search_query={query}"
            webbrowser.open(url)
            return {"success": True, "message": f"YouTube search: {query}"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def type_text(self, params: Dict) -> Dict[str, Any]:
        """Type text using keyboard"""
        if not HAS_PYAUTOGUI:
            return {"success": False, "error": "pyautogui not available"}

        text = params.get("text", "")
        if not text:
            return {"success": False, "error": "Text required"}

        try:
            # Add small delay to ensure focus
            import time
            time.sleep(0.1)
            pyautogui.typewrite(text, interval=0.05)
            return {"success": True, "message": f"Typed {len(text)} characters"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def hotkey(self, params: Dict) -> Dict[str, Any]:
        """Press hotkey combination (e.g., Ctrl+C)"""
        if not HAS_PYAUTOGUI:
            return {"success": False, "error": "pyautogui not available"}

        keys = params.get("keys", "")
        if not keys:
            return {"success": False, "error": "Keys required (e.g., 'ctrl+c')"}

        try:
            # Split by + and press
            key_list = keys.lower().split("+")
            pyautogui.hotkey(*key_list)
            return {"success": True, "message": f"Pressed: {keys}"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def click(self, params: Dict) -> Dict[str, Any]:
        """Click at coordinates"""
        if not HAS_PYAUTOGUI:
            return {"success": False, "error": "pyautogui not available"}

        x = params.get("x")
        y = params.get("y")
        if x is None or y is None:
            return {"success": False, "error": "x and y coordinates required"}

        try:
            pyautogui.click(x, y)
            return {"success": True, "message": f"Clicked at ({x}, {y})"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def press(self, params: Dict) -> Dict[str, Any]:
        """Press a single key"""
        if not HAS_PYAUTOGUI:
            return {"success": False, "error": "pyautogui not available"}

        key = params.get("key", "").lower()
        if not key:
            return {"success": False, "error": "Key required"}

        try:
            pyautogui.press(key)
            return {"success": True, "message": f"Pressed key: {key}"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def system_info(self, params: Dict = None) -> Dict[str, Any]:
        """Get system information"""
        info = {
            "os": self.platform,
            "os_version": platform.version(),
            "architecture": platform.architecture()[0],
            "processor": platform.processor(),
            "cpu_count": os.cpu_count(),
            "python_version": platform.python_version(),
            "is_windows": self.is_windows,
        }

        if HAS_PSUTIL:
            mem = psutil.virtual_memory()
            info.update({
                "ram_total_gb": round(mem.total / (1024**3), 2),
                "ram_used_pct": mem.percent,
                "ram_available_gb": round(mem.available / (1024**3), 2),
                "cpu_usage_pct": psutil.cpu_percent(interval=1),
                "boot_time": psutil.boot_time(),
            })

            # Battery info
            battery = psutil.sensors_battery()
            if battery:
                info["battery_pct"] = battery.percent
                info["battery_plugged"] = battery.power_plugged

        return {"success": True, "message": "System info retrieved", "data": info}

    def set_volume(self, params: Dict) -> Dict[str, Any]:
        """Set system volume"""
        level = params.get("level", 50)
        level = max(0, min(100, int(level)))

        if self.is_windows:
            try:
                subprocess.run(
                    ["powershell", "-c",
                     f"$wshShell = new-object -com wscript.shell; "
                     f"1..50 | % {{$wshShell.SendKeys([char]174)}}; "
                     f"1..{level // 2} | % {{$wshShell.SendKeys([char]175)}}"],
                    timeout=10,
                    capture_output=True,
                )
                return {"success": True, "message": f"Volume adjusted to ~{level}%"}
            except Exception as e:
                return {"success": False, "error": str(e)}
        elif self.platform == "Linux":
            try:
                subprocess.run(["amixer", "set", "Master", f"{level}%"], timeout=5)
                return {"success": True, "message": f"Volume set to {level}%"}
            except Exception as e:
                return {"success": False, "error": str(e)}

        return {"success": False, "error": "Volume control not supported on this platform"}

    def _send_windows_volume_key(self, key_code: int, count: int = 1, label: str = "Volume changed") -> Dict[str, Any]:
        if not self.is_windows:
            return {"success": False, "error": "Volume key control only supported on Windows"}
        count = max(1, min(20, int(count or 1)))
        try:
            subprocess.run(
                [
                    "powershell",
                    "-NoProfile",
                    "-ExecutionPolicy",
                    "Bypass",
                    "-Command",
                    f"$wsh = New-Object -ComObject WScript.Shell; 1..{count} | % {{ $wsh.SendKeys([char]{key_code}); Start-Sleep -Milliseconds 35 }}",
                ],
                timeout=10,
                capture_output=True,
            )
            return {"success": True, "message": label}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def volume_up(self, params: Dict = None) -> Dict[str, Any]:
        return self._send_windows_volume_key(175, (params or {}).get("steps", 5), "Volume increased")

    def volume_down(self, params: Dict = None) -> Dict[str, Any]:
        return self._send_windows_volume_key(174, (params or {}).get("steps", 5), "Volume decreased")

    def mute_toggle(self, params: Dict = None) -> Dict[str, Any]:
        return self._send_windows_volume_key(173, 1, "Mute toggled")

    def set_brightness(self, params: Dict) -> Dict[str, Any]:
        """Set screen brightness"""
        level = params.get("level", 50)
        try:
            import screen_brightness_control as sbc
            sbc.set_brightness(level)
            return {"success": True, "message": f"Brightness set to {level}%"}
        except ImportError:
            return {"success": False, "error": "Install: pip install screen_brightness_control"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def lock_screen(self, params: Dict = None) -> Dict[str, Any]:
        """Lock the screen"""
        try:
            if self.is_windows:
                subprocess.run(["rundll32.exe", "user32.dll,LockWorkStation"], timeout=5)
            elif self.platform == "Darwin":
                subprocess.run(["pmset", "displaysleepnow"], timeout=5)
            else:
                subprocess.run(["xdg-screensaver", "lock"], timeout=5)
            return {"success": True, "message": "Screen locked"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def shutdown(self, params: Dict) -> Dict[str, Any]:
        """Shutdown or restart system - REQUIRES CONFIRMATION"""
        action = params.get("action", "shutdown")
        delay = params.get("delay", 60)
        confirmed = params.get("confirmed", False)

        if not confirmed:
            return {
                "success": False,
                "error": "Destructive action requires confirmation",
                "message": f"Cannot {action} without explicit confirmation. Set confirmed=true to proceed.",
                "requiresConfirmation": True,
            }

        try:
            if action == "restart":
                if self.is_windows:
                    subprocess.run(["shutdown", "/r", "/t", str(delay)], timeout=5)
                else:
                    subprocess.run(["shutdown", "-r", "+1"], timeout=5)
                return {"success": True, "message": f"Restarting in {delay} seconds"}
            else:
                if self.is_windows:
                    subprocess.run(["shutdown", "/s", "/t", str(delay)], timeout=5)
                else:
                    subprocess.run(["shutdown", "-h", "+1"], timeout=5)
                return {"success": True, "message": f"Shutting down in {delay} seconds"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def clipboard_read(self, params: Dict = None) -> Dict[str, Any]:
        """Read clipboard content"""
        if not HAS_PYPERCLIP:
            return {"success": False, "error": "pyperclip not available"}

        try:
            content = pyperclip.paste()
            return {"success": True, "message": "Clipboard read", "data": {"content": content}}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def clipboard_write(self, params: Dict) -> Dict[str, Any]:
        """Write to clipboard"""
        if not HAS_PYPERCLIP:
            return {"success": False, "error": "pyperclip not available"}

        content = params.get("content", "")
        try:
            pyperclip.copy(content)
            return {"success": True, "message": "Copied to clipboard"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def key_press(self, params: Dict) -> Dict[str, Any]:
        """Press keyboard keys"""
        if not HAS_PYAUTOGUI:
            return {"success": False, "error": "pyautogui not available"}

        keys = params.get("keys", "")
        if not keys:
            return {"success": False, "error": "Keys required"}

        try:
            pyautogui.hotkey(*keys.split("+"))
            return {"success": True, "message": f"Pressed: {keys}"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def send_notification(self, params: Dict) -> Dict[str, Any]:
        """Send desktop notification"""
        title = params.get("title", "JARVIS")
        message = params.get("message", "")

        try:
            if self.is_windows:
                try:
                    from win10toast import ToastNotifier
                    toaster = ToastNotifier()
                    toaster.show_toast(title, message, duration=5)
                except ImportError:
                    # Fallback: use PowerShell notification
                    subprocess.run(
                        ["powershell", "-c",
                         f'[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null\n'
                         f'$APP_ID = "JARVIS"\n'
                         f'[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($APP_ID).Show([Windows.UI.Notifications.ToastNotification]::new([xml] "<toast><visual><binding template=\"ToastText02\"><text id=\"1\">{title}</text><text id=\"2\">{message}</text></binding></visual></toast>"))'],
                        timeout=5,
                        capture_output=True,
                    )
            elif self.platform == "Darwin":
                subprocess.run([
                    "osascript", "-e",
                    f'display notification "{message}" with title "{title}"'
                ], timeout=5)
            else:
                subprocess.run(["notify-send", title, message], timeout=5)

            return {"success": True, "message": "Notification sent"}
        except Exception as e:
            return {"success": False, "error": str(e)}
