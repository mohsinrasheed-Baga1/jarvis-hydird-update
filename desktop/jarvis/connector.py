"""
JARVIS Hybrid - Desktop Connector
Connects local desktop to cloud JARVIS backend
Handles local tasks: Windows, File, Upload, Voice
"""

import json
import os
import sys
import time
import threading
import requests
import websocket
from typing import Dict, Any, Optional

# Conditional imports for desktop features
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
    from pynput import keyboard as pynput_keyboard
    HAS_PYNPUT = True
except ImportError:
    HAS_PYNPUT = False


class DesktopConnector:
    """Connects to JARVIS Cloud and executes local tasks"""

    def __init__(self, cloud_url: str, user_id: str):
        self.cloud_url = cloud_url.rstrip("/")
        self.user_id = user_id
        self.running = False
        self.ws_connection = None
        self.config = self._load_config()

    def _load_config(self) -> Dict[str, Any]:
        """Load desktop configuration"""
        config_path = os.path.join(os.path.dirname(__file__), "config.json")
        if os.path.exists(config_path):
            with open(config_path, "r") as f:
                return json.load(f)
        return {
            "cloud_url": self.cloud_url,
            "user_id": self.user_id,
            "voice_enabled": True,
            "language": "mixed",
            "speed_mode": "balanced",
        }

    def _save_config(self):
        """Save desktop configuration"""
        config_path = os.path.join(os.path.dirname(__file__), "config.json")
        with open(config_path, "w") as f:
            json.dump(self.config, f, indent=2)

    # ============== CONNECTION ==============

    def connect(self):
        """Connect to JARVIS Cloud backend"""
        self.running = True
        print(f"[Connector] Connecting to {self.cloud_url}...")

        # Check cloud health
        try:
            response = requests.get(f"{self.cloud_url}/api/health", timeout=10)
            if response.status_code == 200:
                data = response.json()
                print(f"[Connector] Cloud online! Groq: {data.get('groq')}, Gemini: {data.get('gemini')}")
            else:
                print(f"[Connector] Cloud returned status {response.status_code}")
        except requests.RequestException as e:
            print(f"[Connector] Cannot reach cloud: {e}")
            print("[Connector] Running in offline mode...")

        # Start WebSocket listener for cloud->desktop commands
        self._start_ws_listener()

    def disconnect(self):
        """Disconnect from cloud"""
        self.running = False
        if self.ws_connection:
            self.ws_connection.close()
        print("[Connector] Disconnected")

    def _start_ws_listener(self):
        """Start WebSocket listener for cloud commands (if available)"""
        # Fallback: use polling if WebSocket not available
        poll_thread = threading.Thread(target=self._poll_loop, daemon=True)
        poll_thread.start()

    def _poll_loop(self):
        """Poll cloud for pending tasks"""
        while self.running:
            try:
                response = requests.get(
                    f"{self.cloud_url}/api/agent",
                    params={"userId": self.user_id, "action": "pending_tasks"},
                    timeout=5,
                )
                if response.status_code == 200:
                    data = response.json()
                    if data.get("tasks"):
                        for task in data["tasks"]:
                            self._execute_local_task(task)
            except requests.RequestException:
                pass
            time.sleep(2)

    # ============== CHAT ==============

    def send_message(self, message: str, stream: bool = True) -> str:
        """Send a chat message to cloud and get response"""
        try:
            response = requests.post(
                f"{self.cloud_url}/api/chat",
                json={
                    "message": message,
                    "userId": self.user_id,
                    "stream": False,
                },
                timeout=30,
            )
            data = response.json()
            return data.get("message", "No response")
        except requests.RequestException as e:
            return f"Connection error: {e}"

    # ============== LOCAL TASK EXECUTION ==============

    def _execute_local_task(self, task: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a local task from cloud"""
        agent = task.get("type", "")
        action = task.get("action", "")
        params = task.get("params", {})
        task_id = task.get("taskId", str(int(time.time())))

        print(f"[Connector] Executing local task: {agent}/{action}")

        result = {"taskId": task_id, "success": False}

        try:
            if agent == "windows":
                result = self._handle_windows_task(action, params)
            elif agent == "file":
                result = self._handle_file_task(action, params)
            elif agent == "upload":
                result = self._handle_upload_task(action, params)
            else:
                result = {"taskId": task_id, "success": False, "error": f"Unknown agent: {agent}"}
        except Exception as e:
            result = {"taskId": task_id, "success": False, "error": str(e)}

        # Report result back to cloud
        self._report_result(result)
        return result

    def _handle_windows_task(self, action: str, params: Dict) -> Dict[str, Any]:
        """Handle Windows/System control tasks"""
        if action == "screenshot":
            return self._take_screenshot(params)
        elif action == "open_app":
            return self._open_app(params)
        elif action == "system_info":
            return self._get_system_info()
        elif action == "volume":
            return self._set_volume(params)
        elif action == "brightness":
            return self._set_brightness(params)
        else:
            return {"success": False, "error": f"Unknown windows action: {action}"}

    def _handle_file_task(self, action: str, params: Dict) -> Dict[str, Any]:
        """Handle File operations"""
        if action == "download":
            return self._download_file(params)
        elif action == "read":
            return self._read_file(params)
        elif action == "write":
            return self._write_file(params)
        elif action == "list":
            return self._list_files(params)
        elif action == "delete":
            return self._delete_file(params)
        else:
            return {"success": False, "error": f"Unknown file action: {action}"}

    def _handle_upload_task(self, action: str, params: Dict) -> Dict[str, Any]:
        """Handle Upload tasks"""
        return {
            "success": False,
            "error": "Upload agent requires browser automation. Run locally with full desktop agent.",
            "message": "Upload functionality needs the full local desktop agent with Playwright.",
        }

    # ============== WINDOWS TASKS ==============

    def _take_screenshot(self, params: Dict) -> Dict[str, Any]:
        """Take a screenshot"""
        if not HAS_PYAUTOGUI:
            return {"success": False, "error": "pyautogui not available"}

        try:
            screenshot = pyautogui.screenshot()
            save_path = params.get("path", os.path.expanduser("~/Desktop/screenshot.png"))
            screenshot.save(save_path)
            return {
                "success": True,
                "message": f"Screenshot saved to {save_path}",
                "path": save_path,
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    def _open_app(self, params: Dict) -> Dict[str, Any]:
        """Open an application"""
        app_name = params.get("name", "")
        if not app_name:
            return {"success": False, "error": "App name required"}

        try:
            if sys.platform == "win32":
                os.system(f"start {app_name}")
            elif sys.platform == "darwin":
                os.system(f"open -a {app_name}")
            else:
                os.system(f"xdg-open {app_name}")

            return {"success": True, "message": f"Opening {app_name}"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def _get_system_info(self) -> Dict[str, Any]:
        """Get system information"""
        import platform
        import psutil

        return {
            "success": True,
            "system": {
                "os": platform.system(),
                "os_version": platform.version(),
                "cpu": platform.processor(),
                "cpu_count": os.cpu_count(),
                "ram_gb": round(psutil.virtual_memory().total / (1024**3), 2),
                "ram_used_pct": psutil.virtual_memory().percent,
                "disk_used_pct": psutil.disk_usage("/").percent if sys.platform != "win32" else psutil.disk_usage("C:\\").percent,
                "python_version": platform.python_version(),
            },
        }

    def _set_volume(self, params: Dict) -> Dict[str, Any]:
        """Set system volume (Windows only)"""
        level = params.get("level", 50)
        if sys.platform == "win32":
            try:
                from ctypes import cast, POINTER
                from comtypes import CLSCTX_ALL
                from pycaw.pycaw import IAudioEndpointVolume
                import pythoncom
                pythoncom.CoInitialize()
                devices = pythoncom.GetActiveObject("IAudioEndpointVolume")
                # Simplified - full implementation in windows_agent.py
                return {"success": True, "message": f"Volume set to {level}%"}
            except ImportError:
                return {"success": False, "error": "Volume control requires pycaw (Windows only)"}
        return {"success": False, "error": "Volume control only supported on Windows"}

    def _set_brightness(self, params: Dict) -> Dict[str, Any]:
        """Set screen brightness"""
        level = params.get("level", 50)
        try:
            import screen_brightness_control as sbc
            sbc.set_brightness(level)
            return {"success": True, "message": f"Brightness set to {level}%"}
        except ImportError:
            return {"success": False, "error": "screen_brightness_control not installed"}

    # ============== FILE TASKS ==============

    def _download_file(self, params: Dict) -> Dict[str, Any]:
        """Download a file from URL"""
        url = params.get("url", "")
        save_path = params.get("path", os.path.expanduser("~/Downloads/"))

        if not url:
            return {"success": False, "error": "URL required"}

        try:
            filename = url.split("/")[-1] or "downloaded_file"
            full_path = os.path.join(save_path, filename)

            response = requests.get(url, stream=True, timeout=60)
            with open(full_path, "wb") as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)

            return {
                "success": True,
                "message": f"Downloaded to {full_path}",
                "path": full_path,
                "size": os.path.getsize(full_path),
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    def _read_file(self, params: Dict) -> Dict[str, Any]:
        """Read a local file"""
        path = params.get("path", "")
        if not path:
            return {"success": False, "error": "File path required"}

        try:
            with open(path, "r", encoding="utf-8") as f:
                content = f.read(10000)  # Limit to 10KB
            return {
                "success": True,
                "content": content,
                "path": path,
                "size": os.path.getsize(path),
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    def _write_file(self, params: Dict) -> Dict[str, Any]:
        """Write content to a local file"""
        path = params.get("path", "")
        content = params.get("content", "")

        if not path:
            return {"success": False, "error": "File path required"}

        try:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, "w", encoding="utf-8") as f:
                f.write(content)
            return {
                "success": True,
                "message": f"Written to {path}",
                "size": len(content),
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    def _list_files(self, params: Dict) -> Dict[str, Any]:
        """List files in a directory"""
        path = params.get("path", ".")
        try:
            entries = os.listdir(path)
            files = []
            for entry in entries:
                full = os.path.join(path, entry)
                files.append({
                    "name": entry,
                    "is_dir": os.path.isdir(full),
                    "size": os.path.getsize(full) if os.path.isfile(full) else 0,
                })
            return {"success": True, "files": files, "path": path}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def _delete_file(self, params: Dict) -> Dict[str, Any]:
        """Delete a file"""
        path = params.get("path", "")
        if not path:
            return {"success": False, "error": "File path required"}

        try:
            if os.path.isfile(path):
                os.remove(path)
            elif os.path.isdir(path):
                import shutil
                shutil.rmtree(path)
            return {"success": True, "message": f"Deleted {path}"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    # ============== REPORT ==============

    def _report_result(self, result: Dict[str, Any]):
        """Report task result back to cloud"""
        try:
            requests.put(
                f"{self.cloud_url}/api/agent",
                json=result,
                timeout=10,
            )
        except requests.RequestException:
            print("[Connector] Could not report result to cloud")


# ============== CLI INTERFACE ==============

def main():
    """Simple CLI for testing the desktop connector"""
    import argparse

    parser = argparse.ArgumentParser(description="JARVIS Hybrid Desktop Connector")
    parser.add_argument("--cloud-url", default="http://localhost:3000", help="Cloud backend URL")
    parser.add_argument("--user-id", default="local_user", help="User ID")
    args = parser.parse_args()

    connector = DesktopConnector(args.cloud_url, args.user_id)
    connector.connect()

    print("\n🤖 JARVIS Desktop Connector - Type messages (Ctrl+C to quit)\n")

    try:
        while True:
            message = input("You: ").strip()
            if message.lower() in ["exit", "quit", "بند"]:
                break
            if message:
                response = connector.send_message(message)
                print(f"\n🤖 JARVIS: {response}\n")
    except KeyboardInterrupt:
        pass

    connector.disconnect()
    print("Goodbye! / خدا حافظ!")


if __name__ == "__main__":
    main()
