const FALLBACK_BACKEND_URL = 'http://127.0.0.1:3000';

export interface ApiKeys {
  groq?: string;
  gemini?: string;
  openai?: string;
  elevenlabs?: string;
  sarvam?: string;
}

export interface ChatMessage {
  message: string;
  userId: string;
  stream: boolean;
  activeProvider: 'groq' | 'gemini' | 'openai';
  apiKeys: ApiKeys;
  file?: { name: string; type: string; dataUrl: string } | null;
}

export interface ChatResponse {
  success: boolean;
  message: string;
  emotion?: string;
  requiresLocalAction?: boolean;
  localAction?: any;
  error?: string;
}

export interface HealthResponse {
  status: string;
  version: string;
  uptime: number;
  providers?: {
    groq?: boolean;
    gemini?: boolean;
    openai?: boolean;
    zai?: boolean;
  };
}

export interface BackendState {
  connected: boolean;
  label: string;
  version?: string;
  error?: string;
  backendUrl?: string;
}

class ApiClient {
  private backendUrl: string | null = null;

  private async getBackendUrl(): Promise<string> {
    if (this.backendUrl) return this.backendUrl;
    try {
      const electronUrl = await (window as any).electronAPI?.getAppUrl?.();
      this.backendUrl = electronUrl || FALLBACK_BACKEND_URL;
    } catch {
      this.backendUrl = FALLBACK_BACKEND_URL;
    }
    return this.backendUrl || FALLBACK_BACKEND_URL;
  }

  private async getApiBase(): Promise<string> {
    return `${await this.getBackendUrl()}/api`;
  }

  async getBackendState(): Promise<BackendState> {
    try {
      const electronStatus = await (window as any).electronAPI?.getStatus?.();
      const health = await this.getHealth();
      return {
        connected: health.status === 'online',
        label: health.status === 'online' ? `Local backend v${health.version}` : 'Backend unavailable',
        version: health.version,
        backendUrl: await this.getBackendUrl(),
        error: electronStatus?.cloudError || undefined,
      };
    } catch (error) {
      let electronStatus: any = null;
      try { electronStatus = await (window as any).electronAPI?.getStatus?.(); } catch {}
      const message = electronStatus?.cloudError ||
        (error instanceof Error ? error.message : 'Backend health check failed');
      return {
        connected: false,
        label: message,
        error: message,
        backendUrl: electronStatus?.backendUrl || await this.getBackendUrl(),
      };
    }
  }

  async waitForBackend(maxAttempts: number = 20, delayMs: number = 500): Promise<void> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const state = await this.getBackendState();
      if (state.connected) return;
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    const state = await this.getBackendState();
    throw new Error(state.error || state.label || 'Local backend is offline. Electron may still be starting it.');
  }

  async sendMessage(payload: ChatMessage): Promise<ChatResponse> {
    try {
      await this.waitForBackend();
      const response = await fetch(`${await this.getApiBase()}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error(`API error: ${response.status}`);

      return await response.json();
    } catch (error) {
      console.error('Chat API error:', error);
      throw error;
    }
  }

  async getHealth(): Promise<HealthResponse> {
    try {
      const response = await fetch(`${await this.getApiBase()}/health`);
      if (!response.ok) throw new Error('Health check failed');
      return await response.json();
    } catch (error) {
      console.error('Health check error:', error);
      throw error;
    }
  }

  async getMemory(userId: string, action: string = 'history', limit: number = 50) {
    try {
      const response = await fetch(`${await this.getApiBase()}/memory?userId=${userId}&action=${action}&limit=${limit}`);
      if (!response.ok) throw new Error('Memory fetch failed');
      return await response.json();
    } catch (error) {
      console.error('Memory API error:', error);
      throw error;
    }
  }

  async saveMemory(userId: string, message: string, role: string, emotion?: string) {
    try {
      const response = await fetch(`${await this.getApiBase()}/memory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          action: 'save',
          message,
          role,
          emotion,
        }),
      });

      if (!response.ok) throw new Error('Memory save failed');
      return await response.json();
    } catch (error) {
      console.error('Memory save error:', error);
      throw error;
    }
  }

  async uploadFile(
    userId: string,
    file: File,
    apiKeys: ApiKeys,
    message: string = 'Please analyze this file.',
    activeProvider: 'groq' | 'gemini' | 'openai' = 'groq',
  ) {
    try {
      await this.waitForBackend();
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', userId);
      formData.append('apiKeys', JSON.stringify(apiKeys));
      formData.append('message', message);
      formData.append('activeProvider', activeProvider);

      const response = await fetch(`${await this.getApiBase()}/chat`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('File upload failed');
      return await response.json();
    } catch (error) {
      console.error('File upload error:', error);
      throw error;
    }
  }

  async getPendingTasks(userId: string) {
    try {
      const response = await fetch(
        `${await this.getApiBase()}/agent?userId=${userId}&action=pending_tasks`
      );
      if (!response.ok) throw new Error('Task fetch failed');
      return await response.json();
    } catch (error) {
      console.error('Task fetch error:', error);
      throw error;
    }
  }

  async reportTaskResult(taskId: string, userId: string, success: boolean, result?: any, error?: string) {
    try {
      const response = await fetch(`${await this.getApiBase()}/agent`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId,
          userId,
          success,
          result,
          error,
        }),
      });

      if (!response.ok) throw new Error('Task report failed');
      return await response.json();
    } catch (error) {
      console.error('Task report error:', error);
      throw error;
    }
  }

  async queueLocalAction(userId: string, localAction: any) {
    const response = await fetch(`${await this.getApiBase()}/agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, localAction }),
    });
    if (!response.ok) throw new Error(`Could not queue local action: ${response.status}`);
    return response.json();
  }

  async getTaskResult(userId: string, taskId: string) {
    const response = await fetch(
      `${await this.getApiBase()}/agent?userId=${encodeURIComponent(userId)}&action=task_result&taskId=${encodeURIComponent(taskId)}`
    );
    if (!response.ok) throw new Error(`Could not fetch task result: ${response.status}`);
    return response.json();
  }

  async textToSpeech(text: string, apiKeys: ApiKeys, lang: string = 'ur', emotion: string = 'normal'): Promise<Blob> {
    await this.waitForBackend();
    const response = await fetch(`${await this.getApiBase()}/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        lang,
        emotion,
        elevenlabsKey: apiKeys.elevenlabs,
        sarvamKey: apiKeys.sarvam,
        openaiKey: apiKeys.openai,
      }),
    });

    if (!response.ok) {
      const message = await response.text().catch(() => '');
      throw new Error(message || `TTS failed: ${response.status}`);
    }

    return response.blob();
  }

  async transcribeAudio(audio: Blob, apiKeys: ApiKeys, language: string = 'ur'): Promise<{ text: string; language?: string }> {
    await this.waitForBackend();
    const formData = new FormData();
    formData.append('action', 'stt');
    formData.append('language', language);
    formData.append('apiKeys', JSON.stringify(apiKeys));
    formData.append('audio', audio, 'voice.webm');

    const response = await fetch(`${await this.getApiBase()}/voice`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const message = await response.text().catch(() => '');
      throw new Error(message || `Transcription failed: ${response.status}`);
    }

    return response.json();
  }
}

export const apiClient = new ApiClient();
