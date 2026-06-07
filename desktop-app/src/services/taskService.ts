import { apiClient } from './apiClient';

export interface AutomationTask {
  id: string;
  action: string;
  status: 'running' | 'completed' | 'failed';
  progress?: number;
  startTime: number;
  endTime?: number;
  result?: any;
  error?: string;
}

class TaskService {
  private tasks: Map<string, AutomationTask> = new Map();
  private pollInterval: NodeJS.Timeout | null = null;
  private listeners: Set<(tasks: AutomationTask[]) => void> = new Set();

  /**
   * Start polling for pending tasks from cloud
   */
  startPolling(userId: string, pollInterval: number = 2000): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }

    this.pollInterval = setInterval(async () => {
      try {
        const response = await apiClient.getPendingTasks(userId);
        if (response.tasks && Array.isArray(response.tasks)) {
          // Process each pending task
          for (const task of response.tasks) {
            await this.executeTask(task, userId);
          }
        }
      } catch (error) {
        console.error('Error polling tasks:', error);
      }
    }, pollInterval);
  }

  /**
   * Stop polling for tasks
   */
  stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  /**
   * Execute a task and report result back to cloud
   */
  private async executeTask(task: any, userId: string): Promise<void> {
    const taskId = task.taskId || task.id;
    const automationTask: AutomationTask = {
      id: taskId,
      action: task.action || `${task.type}/${task.action}`,
      status: 'running',
      startTime: Date.now(),
    };

    this.tasks.set(taskId, automationTask);
    this.notifyListeners();

    try {
      // In production, this would delegate to local agents (Windows, File, Upload, etc.)
      // For now, simulate execution
      await new Promise(resolve => setTimeout(resolve, 1000));

      automationTask.status = 'completed';
      automationTask.endTime = Date.now();
      automationTask.result = { success: true, message: 'ٹاسک مکمل ہو گیا' };

      // Report result back to cloud
      await apiClient.reportTaskResult(taskId, userId, true, automationTask.result);
    } catch (error) {
      automationTask.status = 'failed';
      automationTask.endTime = Date.now();
      automationTask.error = error instanceof Error ? error.message : 'نامعلوم خرابی';

      // Report failure
      await apiClient.reportTaskResult(taskId, userId, false, undefined, automationTask.error);
    }

    this.notifyListeners();
  }

  /**
   * Get all tasks
   */
  getTasks(): AutomationTask[] {
    return Array.from(this.tasks.values()).sort((a, b) => b.startTime - a.startTime);
  }

  /**
   * Get task by ID
   */
  getTask(taskId: string): AutomationTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Stop a running task
   */
  stopTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task && task.status === 'running') {
      task.status = 'failed';
      task.endTime = Date.now();
      task.error = 'صارف نے منسوخ کیا';
      this.notifyListeners();
    }
  }

  /**
   * Clear completed tasks
   */
  clearCompleted(): void {
    const now = Date.now();
    for (const [key, task] of this.tasks.entries()) {
      if (task.status !== 'running') {
        this.tasks.delete(key);
      }
    }
    this.notifyListeners();
  }

  /**
   * Subscribe to task changes
   */
  subscribe(listener: (tasks: AutomationTask[]) => void): () => void {
    this.listeners.add(listener);
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of task changes
   */
  private notifyListeners(): void {
    const tasks = this.getTasks();
    this.listeners.forEach(listener => listener(tasks));
  }

  /**
   * Get task statistics
   */
  getStats(): { running: number; completed: number; failed: number } {
    let running = 0;
    let completed = 0;
    let failed = 0;

    for (const task of this.tasks.values()) {
      if (task.status === 'running') running++;
      else if (task.status === 'completed') completed++;
      else if (task.status === 'failed') failed++;
    }

    return { running, completed, failed };
  }

  /**
   * Clear all tasks (for reset)
   */
  clearAll(): void {
    this.tasks.clear();
    this.notifyListeners();
  }
}

export const taskService = new TaskService();
