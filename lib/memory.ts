// JARVIS Hybrid - Memory Manager (Cloud)
// Uses in-memory storage with JSON persistence for Vercel deployment

import { v4 as uuidv4 } from "uuid";
import type { MemoryEntry, UserPreferences } from "@/lib/protocol";

// In-memory store (resets on cold start - use Vercel KV for production)
const conversations: Map<string, MemoryEntry[]> = new Map();
const userPreferences: Map<string, UserPreferences> = new Map();
const errorPatterns: Map<string, { pattern: string; count: number; lastSeen: number }[]> = new Map();

export class MemoryManager {
  private maxHistoryPerUser = 100;

  async saveConversation(
    userId: string,
    role: string,
    content: string,
    emotion?: string,
    agent?: string
  ): Promise<void> {
    if (!conversations.has(userId)) {
      conversations.set(userId, []);
    }

    const history = conversations.get(userId)!;
    const entry: MemoryEntry = {
      id: uuidv4(),
      userId,
      role,
      content,
      emotion,
      agent,
      timestamp: Date.now(),
    };

    history.push(entry);

    // Trim old entries
    if (history.length > this.maxHistoryPerUser) {
      history.splice(0, history.length - this.maxHistoryPerUser);
    }
  }

  async getConversationHistory(
    userId: string,
    limit: number = 50
  ): Promise<MemoryEntry[]> {
    const history = conversations.get(userId) || [];
    return history.slice(-limit);
  }

  async searchConversations(
    userId: string,
    query: string,
    limit: number = 10
  ): Promise<MemoryEntry[]> {
    const history = conversations.get(userId) || [];
    const lowerQuery = query.toLowerCase();
    return history
      .filter(
        (entry) =>
          entry.content.toLowerCase().includes(lowerQuery) ||
          entry.agent?.toLowerCase().includes(lowerQuery)
      )
      .slice(-limit);
  }

  async getUserPreferences(userId: string): Promise<UserPreferences> {
    const prefs = userPreferences.get(userId);
    if (prefs) return prefs;

    // Default preferences
    const defaults: UserPreferences = {
      userId,
      language: "mixed",
      voiceEnabled: true,
      speedMode: "balanced",
      personality: "friendly",
      activeProvider: "groq",
    };

    userPreferences.set(userId, defaults);
    return defaults;
  }

  async updateUserPreferences(
    userId: string,
    updates: Partial<UserPreferences>
  ): Promise<UserPreferences> {
    const current = await this.getUserPreferences(userId);
    const updated = { ...current, ...updates };
    userPreferences.set(userId, updated);
    return updated;
  }

  async logError(
    userId: string,
    error: string,
    context?: string
  ): Promise<void> {
    if (!errorPatterns.has(userId)) {
      errorPatterns.set(userId, []);
    }

    const patterns = errorPatterns.get(userId)!;
    const existing = patterns.find((p) => p.pattern === error);

    if (existing) {
      existing.count++;
      existing.lastSeen = Date.now();
    } else {
      patterns.push({
        pattern: error,
        count: 1,
        lastSeen: Date.now(),
      });
    }
  }

  async getErrorPatterns(userId: string): Promise<Array<{ pattern: string; count: number; lastSeen: number }>> {
    return errorPatterns.get(userId) || [];
  }

  async clearHistory(userId: string): Promise<void> {
    conversations.delete(userId);
  }

  async getStats(userId: string): Promise<{
    totalMessages: number;
    agentUsage: Record<string, number>;
    emotionDistribution: Record<string, number>;
  }> {
    const history = conversations.get(userId) || [];
    const agentUsage: Record<string, number> = {};
    const emotionDistribution: Record<string, number> = {};

    for (const entry of history) {
      if (entry.agent) {
        agentUsage[entry.agent] = (agentUsage[entry.agent] || 0) + 1;
      }
      if (entry.emotion) {
        emotionDistribution[entry.emotion] = (emotionDistribution[entry.emotion] || 0) + 1;
      }
    }

    return {
      totalMessages: history.length,
      agentUsage,
      emotionDistribution,
    };
  }
}
