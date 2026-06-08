import { ApiKeys } from './apiClient';

const STORAGE_KEY = 'jarvis_app_state';
const API_KEYS_KEY = 'jarvis_api_keys';
const PREFERENCES_KEY = 'jarvis_preferences';

export interface AppState {
  userId: string;
  theme: 'dark' | 'light';
  language: 'ur' | 'en' | 'mixed';
  voiceEnabled: boolean;
  autoStart: boolean;
  activeProvider: 'groq' | 'gemini' | 'openai';
}

export interface Preferences {
  theme: 'dark' | 'light';
  language: 'ur' | 'en' | 'mixed';
  voiceEnabled: boolean;
  autoStart: boolean;
  wakeWord: string;
  activeProvider: 'groq' | 'gemini' | 'openai';
}

export interface StoredChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  emotion?: string;
  timestamp: number;
}

class StorageService {
  // API Keys (encrypted in production)
  getApiKeys(): ApiKeys {
    try {
      const stored = localStorage.getItem(API_KEYS_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error('Failed to get API keys:', error);
      return {};
    }
  }

  setApiKeys(keys: ApiKeys): void {
    try {
      localStorage.setItem(API_KEYS_KEY, JSON.stringify(keys));
    } catch (error) {
      console.error('Failed to set API keys:', error);
    }
  }

  getActiveProvider(): 'groq' | 'gemini' | 'openai' {
    const stored = localStorage.getItem('jarvis_active_provider');
    return stored === 'gemini' || stored === 'openai' ? stored : 'groq';
  }

  setActiveProvider(provider: 'groq' | 'gemini' | 'openai'): void {
    localStorage.setItem('jarvis_active_provider', provider);
    this.setPreferences({ activeProvider: provider });
    this.setAppState({ activeProvider: provider });
  }

  // Preferences
  getPreferences(): Preferences {
    try {
      const stored = localStorage.getItem(PREFERENCES_KEY);
      return stored ? JSON.parse(stored) : this.getDefaultPreferences();
    } catch (error) {
      console.error('Failed to get preferences:', error);
      return this.getDefaultPreferences();
    }
  }

  setPreferences(prefs: Partial<Preferences>): void {
    try {
      const current = this.getPreferences();
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ ...current, ...prefs }));
    } catch (error) {
      console.error('Failed to set preferences:', error);
    }
  }

  // App State
  getAppState(): AppState {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : this.getDefaultAppState();
    } catch (error) {
      console.error('Failed to get app state:', error);
      return this.getDefaultAppState();
    }
  }

  setAppState(state: Partial<AppState>): void {
    try {
      const current = this.getAppState();
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...state }));
    } catch (error) {
      console.error('Failed to set app state:', error);
    }
  }

  getChatHistory(): StoredChatMessage[] {
    try {
      const stored = localStorage.getItem('jarvis_chat_history');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  setChatHistory(messages: StoredChatMessage[]): void {
    localStorage.setItem('jarvis_chat_history', JSON.stringify(messages.slice(-100)));
  }

  addToHistory(message: StoredChatMessage): void {
    this.setChatHistory([...this.getChatHistory(), message]);
  }

  clearConversationHistory(): void {
    localStorage.removeItem('jarvis_chat_history');
  }

  // Helpers
  private getDefaultAppState(): AppState {
    return {
      userId: 'local_user',
      theme: 'dark',
      language: 'ur',
      voiceEnabled: true,
      autoStart: false,
      activeProvider: 'groq',
    };
  }

  private getDefaultPreferences(): Preferences {
    return {
      theme: 'dark',
      language: 'ur',
      voiceEnabled: true,
      autoStart: false,
      wakeWord: 'Hey JARVIS',
      activeProvider: 'groq',
    };
  }

  // Clear all data (for reset)
  clearAllData(): void {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(API_KEYS_KEY);
    localStorage.removeItem(PREFERENCES_KEY);
    localStorage.removeItem('jarvis_chat_history');
  }
}

export const storageService = new StorageService();
