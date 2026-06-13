// JARVIS Hybrid - Agent API Route
// Direct agent interaction endpoint (for desktop connector)
// Supports: POST (cloud→desktop tasks), PUT (result reporting), GET (poll pending tasks)

import { NextRequest, NextResponse } from "next/server";
import { AgentCore } from "@/lib/agent-core";

// In-memory task queue: userId -> tasks[]
const taskQueues = new Map<string, LocalTask[]>();

interface LocalTask {
  taskId: string;
  type: "windows" | "file" | "upload" | "browser" | "search";
  action: string;
  params: Record<string, unknown>;
  createdAt: number;
  status: "pending" | "executing" | "completed" | "failed";
}

interface TaskResult {
  taskId: string;
  success: boolean;
  result?: Record<string, unknown>;
  error?: string;
  executedAt?: number;
}

// Store recent results: taskId -> result
const completedTasks = new Map<string, TaskResult>();

/**
 * GET /api/agent?userId=...&action=pending_tasks
 * Desktop connector polls for pending local tasks
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const action = searchParams.get("action");

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    if (action === "pending_tasks") {
      const queue = taskQueues.get(userId) || [];
      const pending = queue.filter((t) => t.status === "pending");

      return NextResponse.json({
        success: true,
        tasks: pending,
        count: pending.length,
      });
    }

    if (action === "task_result") {
      const taskId = searchParams.get("taskId");
      if (!taskId) {
        return NextResponse.json({ error: "taskId is required" }, { status: 400 });
      }
      const result = completedTasks.get(taskId);
      return NextResponse.json({
        success: true,
        completed: Boolean(result),
        result: result || null,
      });
    }

    return NextResponse.json(
      { error: "Unknown action" },
      { status: 400 }
    );
  } catch (error) {
    console.error("[Agent API GET] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/agent
 * Cloud routes action requiring local execution to desktop task queue
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agent, action, params, userId, apiKeys, localAction } = body as {
      agent?: string;
      action?: string;
      params?: Record<string, unknown>;
      userId: string;
      apiKeys?: Record<string, string>;
      localAction?: { type: string; action: string; params: Record<string, unknown> };
    };

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    // If this is a local action request, queue it for desktop agent
    if (localAction) {
      const taskId = `local_${userId}_${Date.now()}`;
      const task: LocalTask = {
        taskId,
        type: localAction.type as LocalTask["type"],
        action: localAction.action,
        params: localAction.params || {},
        createdAt: Date.now(),
        status: "pending",
      };

      if (!taskQueues.has(userId)) {
        taskQueues.set(userId, []);
      }
      taskQueues.get(userId)!.push(task);

      console.log(`[Agent API] Queued local task: ${taskId}`, task);

      return NextResponse.json({
        success: true,
        message: "Local task queued",
        taskId,
      });
    }

    // Otherwise, process as cloud agent call
    if (!agent || !action) {
      return NextResponse.json(
        { error: "agent and action are required for cloud calls" },
        { status: 400 }
      );
    }

    const agentCore = new AgentCore();
    const keys = {
      groq: apiKeys?.groq || process.env.GROQ_API_KEY || "",
      gemini: apiKeys?.gemini || process.env.GEMINI_API_KEY || "",
      openai: apiKeys?.openai || process.env.OPENAI_API_KEY || "",
      zai: apiKeys?.zai || process.env.ZAI_API_KEY || "",
    };

    const response = await agentCore.processMessage(
      userId,
      `[Direct Agent Call] ${agent}: ${action} - ${JSON.stringify(params)}`,
      keys
    );

    return NextResponse.json(response);
  } catch (error) {
    console.error("[Agent API POST] Error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Agent error occurred",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/agent
 * Desktop connector reports task result
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskId, userId, success, result, error } = body as {
      taskId: string;
      userId?: string;
      success: boolean;
      result?: Record<string, unknown>;
      error?: string;
    };

    if (!taskId) {
      return NextResponse.json(
        { error: "taskId is required" },
        { status: 400 }
      );
    }

    const taskResult: TaskResult = {
      taskId,
      success,
      result,
      error,
      executedAt: Date.now(),
    };

    // Store result
    completedTasks.set(taskId, taskResult);

    // Mark task as completed in queue if userId provided
    if (userId) {
      const queue = taskQueues.get(userId);
      if (queue) {
        const task = queue.find((t) => t.taskId === taskId);
        if (task) {
          task.status = success ? "completed" : "failed";
        }
      }
    }

    console.log(`[Agent API] Task result received: ${taskId}`, {
      success,
      error,
    });

    return NextResponse.json({
      success: true,
      message: "Task result received and stored",
    });
  } catch (err) {
    console.error("[Agent API PUT] Error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
