// JARVIS Hybrid - Auto-Update API
// Checks GitHub releases for new versions

import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const repo = url.searchParams.get("repo") || "";
    const githubToken = url.searchParams.get("token") || "";

    // Read current version
    let currentVersion = "2.0.0";
    try {
      const versionPath = path.join(process.cwd(), "VERSION");
      const vContent = await fs.readFile(versionPath, "utf-8");
      currentVersion = vContent.trim();
    } catch {
      // Use default version
    }

    if (!repo) {
      return NextResponse.json({
        hasUpdate: false,
        currentVersion,
        latestVersion: currentVersion,
        downloadUrl: "",
        releaseNotes: "",
        lastChecked: Date.now(),
        status: "up-to-date" as const,
      });
    }

    // Fetch latest release from GitHub
    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "JARVIS-HYBRID",
    };

    if (githubToken) {
      headers["Authorization"] = `token ${githubToken}`;
    }

    const releaseRes = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
      headers,
    });

    if (!releaseRes.ok) {
      const errMsg = await releaseRes.text().catch(() => "Unknown error");
      return NextResponse.json({
        hasUpdate: false,
        currentVersion,
        latestVersion: currentVersion,
        downloadUrl: "",
        releaseNotes: `Error checking: ${errMsg.substring(0, 200)}`,
        lastChecked: Date.now(),
        status: "error" as const,
      });
    }

    const release = await releaseRes.json();
    const latestVersion = (release.tag_name || "").replace(/^v/, "");
    const downloadUrl = release.html_url || "";
    const releaseNotes = release.body || "No release notes available.";

    // Compare versions
    const hasUpdate = compareVersions(latestVersion, currentVersion) > 0;

    return NextResponse.json({
      hasUpdate,
      currentVersion,
      latestVersion: latestVersion || currentVersion,
      downloadUrl,
      releaseNotes,
      lastChecked: Date.now(),
      status: hasUpdate ? "update-available" as const : "up-to-date" as const,
    });
  } catch (error) {
    return NextResponse.json({
      hasUpdate: false,
      currentVersion: "2.0.0",
      latestVersion: "2.0.0",
      downloadUrl: "",
      releaseNotes: `Error: ${error instanceof Error ? error.message : "Unknown"}`,
      lastChecked: Date.now(),
      status: "error" as const,
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { repo, token } = body as { repo?: string; token?: string };

    if (!repo) {
      return NextResponse.json({ success: false, message: "No repository specified" }, { status: 400 });
    }

    // In a real desktop app, this would download and apply the update
    // Here we just report the status
    return NextResponse.json({
      success: true,
      message: "Update check initiated. In desktop mode, files would be downloaded automatically.",
      repo,
      status: "downloading" as const,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
}

function compareVersions(a: string, b: string): number {
  const partsA = a.split(".").map(Number);
  const partsB = b.split(".").map(Number);
  const maxLen = Math.max(partsA.length, partsB.length);

  for (let i = 0; i < maxLen; i++) {
    const numA = partsA[i] || 0;
    const numB = partsB[i] || 0;
    if (numA > numB) return 1;
    if (numA < numB) return -1;
  }
  return 0;
}
