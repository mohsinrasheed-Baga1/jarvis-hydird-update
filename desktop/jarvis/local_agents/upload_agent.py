"""
JARVIS Hybrid - Local Upload Agent
Handles uploading to platforms (Redbubble, etc.)
Requires browser automation via Playwright
"""

import os
from typing import Dict, Any


class LocalUploadAgent:
    """Local upload agent for e-commerce platforms"""

    def __init__(self):
        self.upload_dir = os.path.expanduser("~/JarvisUploads")
        os.makedirs(self.upload_dir, exist_ok=True)

    def handle(self, action: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Route action to handler"""
        handlers = {
            "redbubble": self.upload_redbubble,
            "prepare": self.prepare_upload,
            "status": self.upload_status,
        }

        handler = handlers.get(action)
        if handler:
            return handler(params)
        return {"success": False, "error": f"Unknown action: {action}"}

    def prepare_upload(self, params: Dict) -> Dict[str, Any]:
        """Prepare files and metadata for upload"""
        title = params.get("title", "Untitled Design")
        description = params.get("description", "")
        tags = params.get("tags", [])
        image_path = params.get("image_path", "")

        if not image_path or not os.path.exists(image_path):
            return {"success": False, "error": "Valid image path required"}

        # Save upload metadata
        metadata = {
            "title": title,
            "description": description,
            "tags": tags if isinstance(tags, list) else tags.split(","),
            "image_path": os.path.abspath(image_path),
            "status": "prepared",
        }

        meta_path = os.path.join(self.upload_dir, f"{title.replace(' ', '_')}_meta.json")
        import json
        with open(meta_path, "w") as f:
            json.dump(metadata, f, indent=2, ensure_ascii=False)

        return {
            "success": True,
            "message": f"Upload prepared: {title}",
            "metadata_path": meta_path,
            "metadata": metadata,
        }

    def upload_redbubble(self, params: Dict) -> Dict[str, Any]:
        """Upload design to Redbubble (requires Playwright)"""
        try:
            from playwright.sync_api import sync_playwright

            image_path = params.get("image_path", "")
            title = params.get("title", "Untitled")
            description = params.get("description", "")
            tags = params.get("tags", [])

            if not image_path or not os.path.exists(image_path):
                return {"success": False, "error": "Valid image path required"}

            # This would contain full Redbubble automation
            # For now, return a prepared status
            return {
                "success": False,
                "error": "Redbubble upload requires manual Playwright setup",
                "message": "First prepare your upload, then use the GUI to automate the upload process",
            }

        except ImportError:
            return {
                "success": False,
                "error": "Playwright not installed. Run: pip install playwright && playwright install",
            }

    def upload_status(self, params: Dict) -> Dict[str, Any]:
        """Check upload queue status"""
        import json

        uploads = []
        for filename in os.listdir(self.upload_dir):
            if filename.endswith("_meta.json"):
                with open(os.path.join(self.upload_dir, filename), "r") as f:
                    uploads.append(json.load(f))

        return {
            "success": True,
            "uploads": uploads,
            "count": len(uploads),
        }
