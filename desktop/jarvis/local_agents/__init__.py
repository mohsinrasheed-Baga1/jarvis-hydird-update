"""
JARVIS Hybrid - Desktop Local Agents
Local-only agents that need direct system access
"""

from .windows_agent import LocalWindowsAgent
from .file_agent import LocalFileAgent
from .upload_agent import LocalUploadAgent
from .whatsapp_agent import WhatsAppAgent
from .job_search_agent import JobSearchAgent
from .auto_update import AutoUpdater

__all__ = [
    "LocalWindowsAgent",
    "LocalFileAgent",
    "LocalUploadAgent",
    "WhatsAppAgent",
    "JobSearchAgent",
    "AutoUpdater",
]
