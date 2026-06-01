"""
JARVIS Hybrid - Auto-Update System
Automatically checks GitHub for updates and pulls them
Keeps the desktop software in sync with the cloud
"""

import os
import sys
import json
import time
import hashlib
import shutil
import subprocess
import threading
from typing import Dict, Any, Optional
from datetime import datetime


class AutoUpdater:
    """Handles automatic updates from GitHub repository"""

    def __init__(self, repo_path: str = "", github_repo: str = "mohsinrasheed-Baga1/JARVIS-HYBRID"):
        self.repo_path = repo_path or os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        self.github_repo = github_repo
        self.current_version = self._get_current_version()
        self.last_check = None
        self.running = False
        self.check_thread = None
        self.update_callback = None

    def handle(self, action: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Route update actions"""
        handlers = {
            "check": self.check_for_updates,
            "update": self.perform_update,
            "get_version": self.get_version_info,
            "start_auto_check": self.start_auto_check,
            "stop_auto_check": self.stop_auto_check,
            "rollback": self.rollback,
        }

        handler = handlers.get(action)
        if handler:
            return handler(params)
        return {"success": False, "error": f"Unknown update action: {action}"}

    # ============== VERSION MANAGEMENT ==============

    def _get_current_version(self) -> str:
        """Get current version from version file or git commit"""
        version_file = os.path.join(self.repo_path, "VERSION")
        if os.path.exists(version_file):
            with open(version_file, "r") as f:
                return f.read().strip()

        # Try git commit hash
        try:
            result = subprocess.run(
                ["git", "rev-parse", "--short", "HEAD"],
                cwd=self.repo_path,
                capture_output=True,
                text=True,
                timeout=5,
            )
            if result.returncode == 0:
                return result.stdout.strip()
        except Exception:
            pass

        return "0.0.1-dev"

    def get_version_info(self, params: Dict = None) -> Dict[str, Any]:
        """Get current version information"""
        return {
            "success": True,
            "version": self.current_version,
            "repo_path": self.repo_path,
            "last_check": self.last_check,
            "github_repo": self.github_repo,
        }

    # ============== CHECK FOR UPDATES ==============

    def check_for_updates(self, params: Dict = None) -> Dict[str, Any]:
        """Check GitHub for new commits/updates"""
        self.last_check = datetime.now().isoformat()

        try:
            # Method 1: git fetch (if repo is cloned)
            result = subprocess.run(
                ["git", "fetch", "origin"],
                cwd=self.repo_path,
                capture_output=True,
                text=True,
                timeout=30,
            )

            if result.returncode == 0:
                # Check if local is behind remote
                result = subprocess.run(
                    ["git", "log", "HEAD..origin/main", "--oneline"],
                    cwd=self.repo_path,
                    capture_output=True,
                    text=True,
                    timeout=10,
                )

                new_commits = result.stdout.strip().split('\n') if result.stdout.strip() else []
                
                if new_commits and new_commits[0]:
                    return {
                        "success": True,
                        "update_available": True,
                        "new_commits": len(new_commits),
                        "commits": new_commits[:10],
                        "message": f"🆕 {len(new_commits)} new updates available!",
                    }
                else:
                    return {
                        "success": True,
                        "update_available": False,
                        "message": "✅ Software is up to date!",
                    }

            # Method 2: Check GitHub API (if git fetch fails)
            return self._check_github_api()

        except Exception as e:
            return {
                "success": False,
                "error": f"Update check failed: {e}",
                "fallback": self._check_github_api(),
            }

    def _check_github_api(self) -> Dict[str, Any]:
        """Check GitHub API for recent commits"""
        try:
            import requests
            response = requests.get(
                f"https://api.github.com/repos/{self.github_repo}/commits?per_page=5",
                timeout=10,
            )

            if response.status_code == 200:
                commits = response.json()
                latest = commits[0] if commits else None

                if latest:
                    remote_hash = latest["sha"][:7]
                    
                    if remote_hash != self.current_version:
                        return {
                            "success": True,
                            "update_available": True,
                            "latest_commit": remote_hash,
                            "message": f"🆕 Update available: {remote_hash}",
                            "commit_message": latest["commit"]["message"],
                        }
                    else:
                        return {
                            "success": True,
                            "update_available": False,
                            "message": "✅ Software is up to date!",
                        }

        except Exception as e:
            return {"success": False, "error": f"GitHub API check failed: {e}"}

        return {"success": False, "error": "Could not check for updates"}

    # ============== PERFORM UPDATE ==============

    def perform_update(self, params: Dict = None) -> Dict[str, Any]:
        """Pull latest changes from GitHub and restart"""
        auto_restart = (params or {}).get("auto_restart", True)

        try:
            # Step 1: Backup current version
            backup_result = self._create_backup()

            # Step 2: Git pull
            result = subprocess.run(
                ["git", "pull", "origin", "main"],
                cwd=self.repo_path,
                capture_output=True,
                text=True,
                timeout=60,
            )

            if result.returncode != 0:
                # Try harder: stash and pull
                subprocess.run(["git", "stash"], cwd=self.repo_path, timeout=10)
                result = subprocess.run(
                    ["git", "pull", "origin", "main"],
                    cwd=self.repo_path,
                    capture_output=True,
                    text=True,
                    timeout=60,
                )

            if result.returncode == 0:
                # Step 3: Install new dependencies
                self._install_dependencies()

                # Step 4: Update version
                old_version = self.current_version
                self.current_version = self._get_current_version()

                update_info = {
                    "success": True,
                    "message": "✅ Software updated successfully!",
                    "old_version": old_version,
                    "new_version": self.current_version,
                    "git_output": result.stdout,
                    "backup": backup_result.get("path", ""),
                    "updated_at": datetime.now().isoformat(),
                }

                # Step 5: Notify
                if self.update_callback:
                    self.update_callback(update_info)

                # Step 6: Restart if requested
                if auto_restart:
                    self._schedule_restart()

                return update_info
            else:
                return {
                    "success": False,
                    "error": f"Git pull failed: {result.stderr}",
                    "backup": backup_result.get("path", ""),
                }

        except Exception as e:
            return {"success": False, "error": f"Update failed: {e}"}

    def _install_dependencies(self):
        """Install/update Python and Node dependencies"""
        # Python dependencies
        requirements_path = os.path.join(self.repo_path, "desktop", "requirements.txt")
        if os.path.exists(requirements_path):
            try:
                subprocess.run(
                    [sys.executable, "-m", "pip", "install", "-r", requirements_path, "--quiet"],
                    timeout=120,
                )
            except Exception as e:
                print(f"[Updater] pip install failed: {e}")

        # Node dependencies (for cloud)
        package_json = os.path.join(self.repo_path, "package.json")
        if os.path.exists(package_json):
            try:
                subprocess.run(
                    ["npm", "install"],
                    cwd=self.repo_path,
                    timeout=120,
                )
            except Exception as e:
                print(f"[Updater] npm install failed: {e}")

    def _create_backup(self) -> Dict[str, Any]:
        """Create a backup of current version before updating"""
        try:
            backup_dir = os.path.join(
                os.path.expanduser("~"),
                ".jarvis_backups",
                datetime.now().strftime("%Y%m%d_%H%M%S"),
            )
            os.makedirs(backup_dir, exist_ok=True)

            # Copy key files
            key_dirs = ["desktop/jarvis", "lib"]
            for d in key_dirs:
                src = os.path.join(self.repo_path, d)
                dst = os.path.join(backup_dir, d)
                if os.path.exists(src):
                    shutil.copytree(src, dst, dirs_exist_ok=True)

            return {"success": True, "path": backup_dir}

        except Exception as e:
            return {"success": False, "error": str(e)}

    def _schedule_restart(self):
        """Schedule a restart of the application"""
        # Give time for response to be sent
        def restart():
            time.sleep(3)
            os.execv(sys.executable, [sys.executable] + sys.argv)

        threading.Thread(target=restart, daemon=True).start()

    # ============== ROLLBACK ==============

    def rollback(self, params: Dict = None) -> Dict[str, Any]:
        """Rollback to previous version"""
        try:
            result = subprocess.run(
                ["git", "reset", "--hard", "HEAD~1"],
                cwd=self.repo_path,
                capture_output=True,
                text=True,
                timeout=15,
            )

            if result.returncode == 0:
                self.current_version = self._get_current_version()
                return {
                    "success": True,
                    "message": " Rolled back to previous version",
                    "current_version": self.current_version,
                }
            else:
                return {"success": False, "error": result.stderr}

        except Exception as e:
            return {"success": False, "error": f"Rollback failed: {e}"}

    # ============== AUTO CHECK ==============

    def start_auto_check(self, params: Dict = None) -> Dict[str, Any]:
        """Start automatically checking for updates"""
        interval = (params or {}).get("interval", 30)  # Default: check every 30 minutes

        if self.running:
            return {"success": True, "message": "Auto-check already running"}

        self.running = True
        self.check_thread = threading.Thread(
            target=self._auto_check_loop,
            args=(interval,),
            daemon=True,
        )
        self.check_thread.start()

        return {
            "success": True,
            "message": f"Auto-update check started (every {interval} min)",
        }

    def stop_auto_check(self, params: Dict = None) -> Dict[str, Any]:
        """Stop automatic update checking"""
        self.running = False
        if self.check_thread:
            self.check_thread.join(timeout=5)
        return {"success": True, "message": "Auto-update check stopped"}

    def _auto_check_loop(self, interval: int):
        """Background loop for checking updates"""
        while self.running:
            try:
                result = self.check_for_updates()
                if result.get("update_available"):
                    # Auto-update!
                    print(f"[Updater] New updates found! Auto-updating...")
                    update_result = self.perform_update({"auto_restart": False})
                    if update_result.get("success"):
                        print(f"[Updater] ✅ Updated to {update_result.get('new_version')}")
                        if self.update_callback:
                            self.update_callback(update_result)
                    else:
                        print(f"[Updater] ❌ Update failed: {update_result.get('error')}")
            except Exception as e:
                print(f"[Updater] Auto-check error: {e}")

            time.sleep(interval * 60)

    # ============== DESKTOP NOTIFICATION ==============

    def send_update_notification(self, message: str):
        """Send desktop notification about update"""
        try:
            if sys.platform == "win32":
                from win10toast import ToastNotifier
                ToastNotifier().show_toast("JARVIS Update", message, duration=5)
            elif sys.platform == "darwin":
                subprocess.run([
                    "osascript", "-e",
                    f'display notification "{message}" with title "JARVIS Update"'
                ], timeout=5)
            else:
                subprocess.run(["notify-send", "JARVIS Update", message], timeout=5)
        except Exception:
            print(f"[Updater] {message}")
