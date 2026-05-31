"""
JARVIS Hybrid - Desktop Local Agents
Local-only agents that need direct system access
"""

from .windows_agent import LocalWindowsAgent
from .file_agent import LocalFileAgent
from .upload_agent import LocalUploadAgent

__all__ = ["LocalWindowsAgent", "LocalFileAgent", "LocalUploadAgent"]
