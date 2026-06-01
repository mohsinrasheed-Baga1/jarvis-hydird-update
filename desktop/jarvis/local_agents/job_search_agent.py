"""
JARVIS Hybrid - Job Search Agent
Searches for freelance jobs on multiple platforms
Uses web scraping and search to find matching opportunities
"""

import os
import re
import json
import time
import threading
from typing import Dict, Any, Optional, List
from datetime import datetime

try:
    import requests
    from bs4 import BeautifulSoup
    HAS_SCRAPING = True
except ImportError:
    HAS_SCRAPING = False

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


class JobSearchAgent:
    """Searches for freelance jobs across multiple platforms"""

    # Job platforms to search
    PLATFORMS = {
        "upwork": {
            "name": "Upwork",
            "search_url": "https://www.upwork.com/nx/search/jobs/?q={query}&sort=recency",
            "type": "web_scrape",
        },
        "freelancer": {
            "name": "Freelancer",
            "search_url": "https://www.freelancer.com/jobs/?keyword={query}",
            "type": "web_scrape",
        },
        "fiverr": {
            "name": "Fiverr",
            "search_url": "https://www.fiverr.com/search/gigs?query={query}",
            "type": "web_scrape",
        },
        "indeed": {
            "name": "Indeed",
            "search_url": "https://www.indeed.com/jobs?q={query}",
            "type": "web_scrape",
        },
        "google": {
            "name": "Google",
            "search_url": "https://www.google.com/search?q={query}+freelance+job+remote",
            "type": "google_search",
        },
    }

    def __init__(self, cloud_url: str = "", api_keys: Dict = None):
        self.cloud_url = cloud_url
        self.api_keys = api_keys or {}
        self.running = False
        self.search_thread = None
        self.found_jobs: List[Dict] = []
        self.notification_callback = None

    def handle(self, action: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Route job search actions"""
        handlers = {
            "search_all": self.search_all_platforms,
            "search_platform": self.search_single_platform,
            "google_search": self.google_job_search,
            "get_found_jobs": self.get_found_jobs,
            "start_auto_search": self.start_auto_search,
            "stop_auto_search": self.stop_auto_search,
            "open_job_in_browser": self.open_job_in_browser,
            "apply_to_job": self.apply_to_job,
            "generate_cover": self.generate_cover_letter,
            "daily_job_report": self.daily_job_report,
        }

        handler = handlers.get(action)
        if handler:
            return handler(params)
        return {"success": False, "error": f"Unknown job search action: {action}"}

    # ============== SEARCH ==============

    def search_all_platforms(self, params: Dict) -> Dict[str, Any]:
        """Search for jobs across ALL platforms"""
        query = params.get("query", "")
        skills = params.get("skills", [])
        platforms = params.get("platforms", list(self.PLATFORMS.keys()))

        if not query and not skills:
            return {"success": False, "error": "Query or skills required"}

        # Build search query
        if not query:
            query = " ".join(skills)

        all_results = []
        errors = []

        for platform_key in platforms:
            if platform_key not in self.PLATFORMS:
                continue

            platform = self.PLATFORMS[platform_key]
            try:
                if platform["type"] == "google_search":
                    result = self._google_search(query)
                else:
                    result = self._scrape_platform(platform_key, query)

                if result.get("success"):
                    all_results.extend(result.get("jobs", []))
                else:
                    errors.append(f"{platform['name']}: {result.get('error', 'Failed')}")
            except Exception as e:
                errors.append(f"{platform['name']}: {str(e)}")

        # Sort by date (newest first)
        all_results.sort(key=lambda x: x.get("found_at", ""), reverse=True)

        # Store results
        self.found_jobs.extend(all_results)

        return {
            "success": True,
            "total_jobs": len(all_results),
            "jobs": all_results[:20],  # Return top 20
            "errors": errors,
            "query": query,
            "searched_at": datetime.now().isoformat(),
        }

    def search_single_platform(self, params: Dict) -> Dict[str, Any]:
        """Search a specific platform"""
        platform = params.get("platform", "")
        query = params.get("query", "")

        if platform not in self.PLATFORMS:
            return {"success": False, "error": f"Unknown platform: {platform}"}

        if not query:
            return {"success": False, "error": "Search query required"}

        return self._scrape_platform(platform, query)

    def google_job_search(self, params: Dict) -> Dict[str, Any]:
        """Search Google for freelance jobs"""
        query = params.get("query", "")
        if not query:
            return {"success": False, "error": "Query required"}

        return self._google_search(query)

    def _google_search(self, query: str) -> Dict[str, Any]:
        """Search Google for jobs using cloud AI (since we can't directly scrape Google)"""
        if not self.cloud_url:
            # Fallback: open Google in browser
            self._open_google_in_browser(query)
            return {
                "success": True,
                "message": "Google search opened in browser",
                "method": "browser_redirect",
            }

        try:
            # Use cloud AI to search (with web search capability)
            response = requests.post(
                f"{self.cloud_url}/api/chat",
                json={
                    "message": f"Search for current freelance jobs matching: {query}\n\nFind real job postings from Upwork, Freelancer, Fiverr, and other platforms. List each job with: title, platform, budget/rate, brief description, and link if possible.",
                    "userId": "job_search",
                    "stream": False,
                    "apiKeys": self.api_keys,
                },
                timeout=30,
            )

            if response.status_code == 200:
                data = response.json()
                jobs = self._parse_ai_job_results(data.get("message", ""), query)

                return {
                    "success": True,
                    "jobs": jobs,
                    "total": len(jobs),
                    "query": query,
                    "method": "ai_search",
                }

        except Exception as e:
            return {"success": False, "error": f"Search failed: {e}"}

        return {"success": False, "error": "Search failed"}

    def _scrape_platform(self, platform_key: str, query: str) -> Dict[str, Any]:
        """Scrape a specific platform for jobs"""
        platform = self.PLATFORMS[platform_key]
        url = platform["search_url"].format(query=requests.utils.quote(query))

        try:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.5",
            }

            response = requests.get(url, headers=headers, timeout=15)

            if response.status_code == 200 and HAS_SCRAPING:
                soup = BeautifulSoup(response.text, "html.parser")
                jobs = self._extract_jobs(soup, platform_key, query)

                return {
                    "success": True,
                    "platform": platform["name"],
                    "jobs": jobs,
                    "total": len(jobs),
                }
            else:
                # Fallback: Open in browser
                self._open_url_in_browser(url)
                return {
                    "success": True,
                    "message": f"Opened {platform['name']} search in browser (scraping blocked)",
                    "method": "browser_redirect",
                    "url": url,
                }

        except Exception as e:
            # Fallback: Open in browser
            self._open_url_in_browser(url)
            return {
                "success": True,
                "message": f"Opened {platform['name']} search in browser",
                "method": "browser_redirect",
                "url": url,
            }

    def _extract_jobs(self, soup, platform_key: str, query: str) -> List[Dict]:
        """Extract job listings from HTML soup"""
        jobs = []

        if platform_key == "upwork":
            # Upwork job cards
            cards = soup.find_all(["article", "div"], class_=re.compile(r"job-tile|air3-card"))
            for card in cards[:10]:
                title_elem = card.find(["h2", "h3", "a"], class_=re.compile(r"job-title|heading"))
                title = title_elem.get_text(strip=True) if title_elem else "Untitled Job"
                
                desc_elem = card.find(["p", "div"], class_=re.compile(r"description|text-body"))
                description = desc_elem.get_text(strip=True)[:200] if desc_elem else ""

                budget_elem = card.find(["span", "div"], class_=re.compile(r"budget|amount"))
                budget = budget_elem.get_text(strip=True) if budget_elem else "Not specified"

                jobs.append({
                    "title": title,
                    "description": description,
                    "budget": budget,
                    "platform": "Upwork",
                    "query": query,
                    "found_at": datetime.now().isoformat(),
                })

        elif platform_key == "freelancer":
            cards = soup.find_all(["div"], class_=re.compile(r"project|job-card"))
            for card in cards[:10]:
                title_elem = card.find(["a", "h2"], class_=re.compile(r"title|project"))
                title = title_elem.get_text(strip=True) if title_elem else "Untitled Job"

                jobs.append({
                    "title": title,
                    "platform": "Freelancer",
                    "query": query,
                    "found_at": datetime.now().isoformat(),
                })

        # If no jobs extracted via HTML, return empty (will fall back to browser)
        return jobs

    def _parse_ai_job_results(self, ai_response: str, query: str) -> List[Dict]:
        """Parse AI-generated job search results into structured data"""
        jobs = []
        
        # Try to parse as structured data
        lines = ai_response.split('\n')
        current_job = {}

        for line in lines:
            line = line.strip()
            if not line:
                if current_job.get("title"):
                    current_job["query"] = query
                    current_job["found_at"] = datetime.now().isoformat()
                    jobs.append(current_job)
                    current_job = {}
                continue

            # Detect job title lines
            if re.match(r'^\d+[\.\)]\s', line) or line.startswith('**') or line.startswith('#'):
                if current_job.get("title"):
                    current_job["query"] = query
                    current_job["found_at"] = datetime.now().isoformat()
                    jobs.append(current_job)
                
                current_job = {
                    "title": re.sub(r'^\d+[\.\)]\s|\*|#', '', line).strip(),
                    "platform": "Various",
                }
            elif "budget" in line.lower() or "rate" in line.lower() or "$" in line:
                current_job["budget"] = line
            elif "platform" in line.lower() or "upwork" in line.lower() or "fiverr" in line.lower():
                current_job["platform"] = line
            elif "desc" in line.lower() or "about" in line.lower():
                current_job["description"] = line
            elif "link" in line.lower() or "http" in line:
                current_job["link"] = line
            else:
                if not current_job.get("description"):
                    current_job["description"] = line
                else:
                    current_job["description"] += " " + line

        # Don't forget last job
        if current_job.get("title"):
            current_job["query"] = query
            current_job["found_at"] = datetime.now().isoformat()
            jobs.append(current_job)

        return jobs

    # ============== AUTO SEARCH ==============

    def start_auto_search(self, params: Dict) -> Dict[str, Any]:
        """Start automatic job searching on a schedule"""
        queries = params.get("queries", [])
        interval_minutes = params.get("interval", 60)  # Default: every hour

        if not queries:
            return {"success": False, "error": "Search queries required"}

        if self.running:
            return {"success": True, "message": "Auto-search already running"}

        self.running = True
        self.search_thread = threading.Thread(
            target=self._auto_search_loop,
            args=(queries, interval_minutes),
            daemon=True,
        )
        self.search_thread.start()

        return {
            "success": True,
            "message": f"Auto-search started (every {interval_minutes} min)",
            "queries": queries,
        }

    def stop_auto_search(self, params: Dict = None) -> Dict[str, Any]:
        """Stop automatic job searching"""
        self.running = False
        if self.search_thread:
            self.search_thread.join(timeout=5)
        return {"success": True, "message": "Auto-search stopped"}

    def _auto_search_loop(self, queries: List[str], interval: int):
        """Background loop for automatic job searching"""
        while self.running:
            for query in queries:
                if not self.running:
                    break
                try:
                    result = self.search_all_platforms({"query": query})
                    if result.get("success") and result.get("total_jobs", 0) > 0:
                        # Notify about new jobs
                        if self.notification_callback:
                            self.notification_callback({
                                "type": "new_jobs",
                                "query": query,
                                "count": result["total_jobs"],
                                "jobs": result["jobs"][:5],
                            })
                except Exception as e:
                    print(f"[JobSearch] Error searching '{query}': {e}")

            # Wait for next interval
            time.sleep(interval * 60)

    # ============== JOB ACTIONS ==============

    def get_found_jobs(self, params: Dict = None) -> Dict[str, Any]:
        """Get all found jobs"""
        limit = (params or {}).get("limit", 50)
        return {
            "success": True,
            "total": len(self.found_jobs),
            "jobs": self.found_jobs[-limit:],
        }

    def open_job_in_browser(self, params: Dict) -> Dict[str, Any]:
        """Open a job listing in the browser"""
        url = params.get("url", "")
        if not url:
            return {"success": False, "error": "URL required"}

        try:
            import webbrowser
            webbrowser.open(url)
            return {"success": True, "message": f"Opened {url} in browser"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def apply_to_job(self, params: Dict) -> Dict[str, Any]:
        """Apply to a job (opens browser and helps fill application)"""
        url = params.get("url", "")
        proposal = params.get("proposal", "")

        try:
            import webbrowser
            webbrowser.open(url)

            # If proposal generated, copy to clipboard for easy paste
            if proposal and HAS_PYPERCLIP:
                pyperclip.copy(proposal)
                return {
                    "success": True,
                    "message": "Job opened in browser. Proposal copied to clipboard — just paste it!",
                }

            return {
                "success": True,
                "message": "Job opened in browser. Ready to apply!",
            }

        except Exception as e:
            return {"success": False, "error": str(e)}

    def generate_cover_letter(self, params: Dict) -> Dict[str, Any]:
        """Generate a cover letter for a job"""
        job_title = params.get("job_title", "")
        job_description = params.get("job_description", "")
        user_profile = params.get("user_profile", "")

        if not self.cloud_url:
            return {"success": False, "error": "Cloud URL required for AI generation"}

        try:
            response = requests.post(
                f"{self.cloud_url}/api/chat",
                json={
                    "message": f"Generate a professional cover letter for this job:\n\nTitle: {job_title}\nDescription: {job_description}\n\nMy Profile: {user_profile or 'Experienced freelancer'}",
                    "userId": "job_search",
                    "stream": False,
                    "apiKeys": self.api_keys,
                },
                timeout=20,
            )

            if response.status_code == 200:
                data = response.json()
                return {
                    "success": True,
                    "cover_letter": data.get("message", ""),
                    "job_title": job_title,
                }

        except Exception as e:
            return {"success": False, "error": str(e)}

        return {"success": False, "error": "Generation failed"}

    def daily_job_report(self, params: Dict) -> Dict[str, Any]:
        """Generate a daily report of found jobs"""
        if not self.found_jobs:
            return {
                "success": True,
                "message": "No jobs found yet. Run a search first!",
                "total": 0,
            }

        # Group by platform
        by_platform = {}
        for job in self.found_jobs:
            platform = job.get("platform", "Unknown")
            if platform not in by_platform:
                by_platform[platform] = []
            by_platform[platform].append(job)

        # Group by query
        by_query = {}
        for job in self.found_jobs:
            query = job.get("query", "Unknown")
            if query not in by_query:
                by_query[query] = []
            by_query[query].append(job)

        report = f"📋 **Daily Job Report — {datetime.now().strftime('%B %d, %Y')}**\n\n"
        report += f"**Total Jobs Found:** {len(self.found_jobs)}\n\n"

        for platform, jobs in by_platform.items():
            report += f"**{platform}:** {len(jobs)} jobs\n"

        report += "\n**Top Opportunities:**\n"
        for i, job in enumerate(self.found_jobs[:10], 1):
            budget = job.get("budget", "N/A")
            report += f"\n{i}. **{job.get('title', 'Untitled')}**\n   💰 {budget} | 🏢 {job.get('platform', 'Unknown')}"

        return {
            "success": True,
            "report": report,
            "total": len(self.found_jobs),
            "by_platform": {k: len(v) for k, v in by_platform.items()},
        }

    # ============== HELPERS ==============

    def _open_url_in_browser(self, url: str):
        """Open URL in default browser"""
        try:
            import webbrowser
            webbrowser.open(url)
        except Exception:
            if HAS_PYAUTOGUI:
                # Fallback: use keyboard shortcut
                pyautogui.hotkey('ctrl', 'l')  # Focus browser address bar
                time.sleep(0.3)
                pyperclip.copy(url)
                pyautogui.hotkey('ctrl', 'v')
                pyautogui.press('enter')

    def _open_google_in_browser(self, query: str):
        """Open Google search in browser"""
        url = f"https://www.google.com/search?q={requests.utils.quote(query)}+freelance+job+remote"
        self._open_url_in_browser(url)
