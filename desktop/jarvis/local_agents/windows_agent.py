"""
JARVIS Hybrid - Local Windows Agent
Handles OS-level operations that require direct system access
"""

import os
import sys
import platform
import subprocess
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


class LocalWindowsAgent:
    """Local Windows/System control agent"""

    def __init__(self):
        self.platform = platform.system()

    def handle(self, action: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Route action to appropriate handler"""
        handlers = {
            "screenshot": self.screenshot,
            "open_app": self.open_app,
            "system_info": self.system_info,
            "volume": self.set_volume,
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
            return handler(params)
        return {"success": False, "error": f"Unknown action: {action}"}

    def screenshot(self, params: Dict = None) -> Dict[str, Any]:
        """Take a screenshot"""
        if not HAS_PYAUTOGUI:
            return {"success": False, "error": "pyautogui not available"}

        try:
            save_path = (params or {}).get("path", os.path.expanduser("~/Desktop/screenshot.png"))
            ss = pyautogui.screenshot()
            ss.save(save_path)
            return {"success": True, "message": f"Screenshot saved: {save_path}", "path": save_path}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def open_app(self, params: Dict) -> Dict[str, Any]:
        """Open an application"""
        app = params.get("name", "")
        if not app:
            return {"success": False, "error": "App name required"}

        try:
            if self.platform == "win32":
                os.system(f"start {app}")
            elif self.platform == "darwin":
                os.system(f"open -a '{app}'")
            else:
                subprocess.Popen(["xdg-open", app])
            return {"success": True, "message": f"Opened {app}"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def system_info(self, params: Dict = None) -> Dict[str, Any]:
        """Get system information"""
        info = {
            "os": platform.system(),
            "os_version": platform.version(),
            "architecture": platform.architecture()[0],
            "processor": platform.processor(),
            "cpu_count": os.cpu_count(),
            "python_version": platform.python_version(),
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

        return {"success": True, "system": info}

    def set_volume(self, params: Dict) -> Dict[str, Any]:
        """Set system volume"""
        level = params.get("level", 50)

        if self.platform == "win32":
            try:
                import ctypes
                # Windows volume control via nircmd or PowerShell
                subprocess.run(
                    ["powershell", "-c",
                     f"$wshShell = new-object -com wscript.shell; "
                     f"1..50 | % {{$wshShell.SendKeys([char]174)}}; "
                     f"1..{level // 2} | % {{$wshShell.SendKeys([char]175)}}"],
                    timeout=10
                )
                return {"success": True, "message": f"Volume adjusted to ~{level}%"}
            except Exception as e:
                return {"success": False, "error": str(e)}
        elif self.platform == "linux":
            try:
                subprocess.run(["amixer", "set", "Master", f"{level}%"], timeout=5)
                return {"success": True, "message": f"Volume set to {level}%"}
            except Exception as e:
                return {"success": False, "error": str(e)}

        return {"success": False, "error": "Volume control not supported on this platform"}

    def set_brightness(self, params: Dict) -> Dict[str, Any]:
        """Set screen brightness"""
        level = params.get("level", 50)
        try:
            import screen_brightness_control as sbc
            sbc.set_brightness(level)
            return {"success": True, "message": f"Brightness set to {level}%"}
        except ImportError:
            return {"success": False, "error": "Install: pip install screen_brightness_control"}

    def lock_screen(self, params: Dict = None) -> Dict[str, Any]:
        """Lock the screen"""
        try:
            if self.platform == "win32":
                subprocess.run(["rundll32.exe", "user32.dll,LockWorkStation"], timeout=5)
            elif self.platform == "darwin":
                subprocess.run(["pmset", "displaysleepnow"], timeout=5)
            else:
                subprocess.run(["xdg-screensaver", "lock"], timeout=5)
            return {"success": True, "message": "Screen locked"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def shutdown(self, params: Dict) -> Dict[str, Any]:
        """Shutdown or restart system"""
        action = params.get("action", "shutdown")
        delay = params.get("delay", 60)

        try:
            if action == "restart":
                if self.platform == "win32":
                    subprocess.run(["shutdown", "/r", "/t", str(delay)], timeout=5)
                else:
                    subprocess.run(["shutdown", "-r", "+1"], timeout=5)
                return {"success": True, "message": f"Restarting in {delay} seconds"}
            else:
                if self.platform == "win32":
                    subprocess.run(["shutdown", "/s", "/t", str(delay)], timeout=5)
                else:
                    subprocess.run(["shutdown", "-h", "+1"], timeout=5)
                return {"success": True, "message": f"Shutting down in {delay} seconds"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def clipboard_read(self, params: Dict = None) -> Dict[str, Any]:
        """Read clipboard content"""
        try:
            import pyperclip
            content = pyperclip.paste()
            return {"success": True, "content": content}
        except ImportError:
            return {"success": False, "error": "Install: pip install pyperclip"}

    def clipboard_write(self, params: Dict) -> Dict[str, Any]:
        """Write to clipboard"""
        content = params.get("content", "")
        try:
            import pyperclip
            pyperclip.copy(content)
            return {"success": True, "message": "Copied to clipboard"}
        except ImportError:
            return {"success": False, "error": "Install: pip install pyperclip"}

    def key_press(self, params: Dict) -> Dict[str, Any]:
        """Press keyboard keys"""
        keys = params.get("keys", "")
        if not HAS_PYAUTOGUI:
            return {"success": False, "error": "pyautogui not available"}

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
            if self.platform == "win32":
                from win10toast import ToastNotifier
                toaster = ToastNotifier()
                toaster.show_toast(title, message, duration=5)
            elif self.platform == "darwin":
                subprocess.run(["osascript", "-e",
                    f'display notification "{message}" with title "{title}"'], timeout=5)
            else:
                subprocess.run(["notify-send", title, message], timeout=5)

            return {"success": True, "message": "Notification sent"}
        except Exception as e:
            return {"success": False, "error": str(e)}
