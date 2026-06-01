// JARVIS Hybrid - Memory API Route
// CRUD operations for conversation history and preferences

import { NextRequest, NextResponse } from "next/server";
import { MemoryManager } from "@/lib/memory";

const memory = new MemoryManager();

// GET - Retrieve conversation history or preferences
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const action = searchParams.get("action") || "history";
    const limit = parseInt(searchParams.get("limit") || "50");
    const query = searchParams.get("query");

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    switch (action) {
      case "history": {
        const history = await memory.getConversationHistory(userId, limit);
        return NextResponse.json({ success: true, history });
      }
      case "search": {
        if (!query) {
          return NextResponse.json({ error: "query is required for search" }, { status: 400 });
        }
        const results = await memory.searchConversations(userId, query, limit);
        return NextResponse.json({ success: true, results });
      }
      case "preferences": {
        const prefs = await memory.getUserPreferences(userId);
        return NextResponse.json({ success: true, preferences: prefs });
      }
      case "stats": {
        const stats = await memory.getStats(userId);
        return NextResponse.json({ success: true, stats });
      }
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// POST - Save conversation or update preferences
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, userId } = body;

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    switch (action) {
      case "save": {
        await memory.saveConversation(
          userId,
          body.role,
          body.content,
          body.emotion,
          body.agent
        );
        return NextResponse.json({ success: true, message: "Saved" });
      }
      case "preferences": {
        const prefs = await memory.updateUserPreferences(userId, body.preferences);
        return NextResponse.json({ success: true, preferences: prefs });
      }
      case "clear": {
        await memory.clearHistory(userId);
        return NextResponse.json({ success: true, message: "History cleared" });
      }
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
