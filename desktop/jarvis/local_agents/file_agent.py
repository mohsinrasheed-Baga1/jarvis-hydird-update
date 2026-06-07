"""
JARVIS Hybrid - Local File Agent
Handles file operations that require local filesystem access
"""

import os
import json
import shutil
from typing import Dict, Any, List


class LocalFileAgent:
    """Local file operations agent"""

    def __init__(self):
        self.download_dir = os.path.expanduser("~/Downloads")
        self.desktop_dir = os.path.expanduser("~/Desktop")

    def handle(self, action: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Route action to handler"""
        handlers = {
            "download": self.download,
            "read": self.read_file,
            "write": self.write_file,
            "list": self.list_directory,
            "delete": self.delete,
            "move": self.move,
            "copy": self.copy,
            "mkdir": self.make_directory,
            "search": self.search_files,
            "info": self.file_info,
            "organize": self.organize_downloads,
        }

        handler = handlers.get(action)
        if handler:
            return handler(params)
        return {"success": False, "error": f"Unknown action: {action}"}

    def download(self, params: Dict) -> Dict[str, Any]:
        """Download a file from URL"""
        import requests as req

        url = params.get("url", "")
        save_dir = params.get("directory", self.download_dir)
        filename = params.get("filename", "")

        if not url:
            return {"success": False, "error": "URL required"}

        if not filename:
            filename = url.split("/")[-1] or "downloaded_file"

        save_path = os.path.join(save_dir, filename)

        try:
            os.makedirs(save_dir, exist_ok=True)
            response = req.get(url, stream=True, timeout=120)
            total_size = int(response.headers.get("content-length", 0))

            with open(save_path, "wb") as f:
                downloaded = 0
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
                    downloaded += len(chunk)

            return {
                "success": True,
                "message": f"Downloaded to {save_path}",
                "path": save_path,
                "size": os.path.getsize(save_path),
                "total_size": total_size,
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    def read_file(self, params: Dict) -> Dict[str, Any]:
        """Read a file's content"""
        path = params.get("path", "")
        encoding = params.get("encoding", "utf-8")
        max_size = params.get("max_size", 50000)  # 50KB max

        if not path:
            return {"success": False, "error": "File path required"}

        if not os.path.exists(path):
            return {"success": False, "error": f"File not found: {path}"}

        try:
            size = os.path.getsize(path)
            if size > max_size:
                with open(path, "r", encoding=encoding) as f:
                    content = f.read(max_size) + "\n... (truncated)"
            else:
                with open(path, "r", encoding=encoding) as f:
                    content = f.read()

            return {
                "success": True,
                "content": content,
                "path": path,
                "size": size,
            }
        except UnicodeDecodeError:
            return {"success": False, "error": "Cannot read binary file as text"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def write_file(self, params: Dict) -> Dict[str, Any]:
        """Write content to a file"""
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
                "path": path,
                "size": len(content.encode("utf-8")),
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    def list_directory(self, params: Dict) -> Dict[str, Any]:
        """List files in a directory"""
        path = params.get("path", ".")
        show_hidden = params.get("show_hidden", False)

        if not os.path.exists(path):
            return {"success": False, "error": f"Directory not found: {path}"}

        try:
            entries = []
            for entry in os.listdir(path):
                if not show_hidden and entry.startswith("."):
                    continue
                full = os.path.join(path, entry)
                try:
                    stat = os.stat(full)
                    entries.append({
                        "name": entry,
                        "is_dir": os.path.isdir(full),
                        "size": stat.st_size if os.path.isfile(full) else 0,
                        "modified": stat.st_mtime,
                    })
                except (PermissionError, OSError):
                    entries.append({"name": entry, "is_dir": False, "size": 0})

            # Sort: directories first, then by name
            entries.sort(key=lambda x: (not x["is_dir"], x["name"].lower()))

            return {
                "success": True,
                "files": entries,
                "path": os.path.abspath(path),
                "count": len(entries),
            }
        except PermissionError:
            return {"success": False, "error": "Permission denied"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def delete(self, params: Dict) -> Dict[str, Any]:
        """Delete a file or directory"""
        path = params.get("path", "")
        if not path:
            return {"success": False, "error": "Path required"}

        # Safety check
        protected = ["/", "/home", "/usr", "/etc", "/var", "/sys", "/proc",
                     "C:\\", "C:\\Windows", "C:\\Program Files"]
        if os.path.abspath(path) in protected:
            return {"success": False, "error": "Cannot delete protected directory"}

        try:
            if os.path.isfile(path):
                os.remove(path)
            elif os.path.isdir(path):
                shutil.rmtree(path)
            return {"success": True, "message": f"Deleted: {path}"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def move(self, params: Dict) -> Dict[str, Any]:
        """Move a file"""
        src = params.get("source", "")
        dst = params.get("destination", "")

        if not src or not dst:
            return {"success": False, "error": "Source and destination required"}

        try:
            shutil.move(src, dst)
            return {"success": True, "message": f"Moved {src} -> {dst}"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def copy(self, params: Dict) -> Dict[str, Any]:
        """Copy a file"""
        src = params.get("source", "")
        dst = params.get("destination", "")

        if not src or not dst:
            return {"success": False, "error": "Source and destination required"}

        try:
            shutil.copy2(src, dst)
            return {"success": True, "message": f"Copied {src} -> {dst}"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def make_directory(self, params: Dict) -> Dict[str, Any]:
        """Create a directory"""
        path = params.get("path", "")
        if not path:
            return {"success": False, "error": "Path required"}

        try:
            os.makedirs(path, exist_ok=True)
            return {"success": True, "message": f"Created directory: {path}"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def search_files(self, params: Dict) -> Dict[str, Any]:
        """Search for files by name pattern"""
        directory = params.get("directory", ".")
        pattern = params.get("pattern", "").lower()
        max_results = params.get("max_results", 50)

        if not pattern:
            return {"success": False, "error": "Search pattern required"}

        results: List[Dict[str, Any]] = []

        try:
            for root, dirs, files in os.walk(directory):
                for name in files + dirs:
                    if pattern in name.lower():
                        full = os.path.join(root, name)
                        results.append({
                            "name": name,
                            "path": full,
                            "is_dir": os.path.isdir(full),
                        })
                        if len(results) >= max_results:
                            break
                if len(results) >= max_results:
                    break

            return {
                "success": True,
                "results": results,
                "count": len(results),
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    def file_info(self, params: Dict) -> Dict[str, Any]:
        """Get detailed file information"""
        path = params.get("path", "")

        if not path or not os.path.exists(path):
            return {"success": False, "error": f"File not found: {path}"}

        try:
            stat = os.stat(path)
            return {
                "success": True,
                "info": {
                    "path": os.path.abspath(path),
                    "name": os.path.basename(path),
                    "size": stat.st_size,
                    "is_dir": os.path.isdir(path),
                    "extension": os.path.splitext(path)[1],
                    "modified": stat.st_mtime,
                    "created": stat.st_ctime,
                    "permissions": oct(stat.st_mode)[-3:],
                },
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    def organize_downloads(self, params: Dict) -> Dict[str, Any]:
        """Organize downloads folder by file type"""
        target_dir = params.get("directory", self.download_dir)

        if not os.path.exists(target_dir):
            return {"success": False, "error": f"Directory not found: {target_dir}"}

        # File type categories
        categories = {
            "Images": [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".svg", ".webp"],
            "Documents": [".pdf", ".doc", ".docx", ".txt", ".xlsx", ".pptx", ".odt"],
            "Videos": [".mp4", ".avi", ".mkv", ".mov", ".wmv", ".flv"],
            "Audio": [".mp3", ".wav", ".flac", ".aac", ".ogg", ".m4a"],
            "Archives": [".zip", ".rar", ".7z", ".tar", ".gz"],
            "Code": [".py", ".js", ".ts", ".html", ".css", ".java", ".cpp"],
            "Executables": [".exe", ".msi", ".dmg", ".deb", ".app"],
        }

        moved = 0
        try:
            for filename in os.listdir(target_dir):
                filepath = os.path.join(target_dir, filename)
                if os.path.isfile(filepath):
                    ext = os.path.splitext(filename)[1].lower()
                    for category, extensions in categories.items():
                        if ext in extensions:
                            cat_dir = os.path.join(target_dir, category)
                            os.makedirs(cat_dir, exist_ok=True)
                            shutil.move(filepath, os.path.join(cat_dir, filename))
                            moved += 1
                            break

            return {
                "success": True,
                "message": f"Organized {moved} files",
                "moved_count": moved,
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
