import { apiClient, type ApiKeys } from './apiClient';

export interface VoiceConfig {
  language: 'ur' | 'en' | 'mixed';
  wakeWord: string;
  continuousListening: boolean;
}

export interface TranscriptionResult {
  text: string;
  confidence: number;
  language: string;
  isFinal: boolean;
}

class VoiceService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private isListening = false;

  async startListening(_config: VoiceConfig): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(stream);
      this.audioChunks = [];
      this.isListening = true;

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) this.audioChunks.push(event.data);
      };

      this.mediaRecorder.start();
    } catch (error) {
      console.error('Failed to start listening:', error);
      throw new Error('Microphone permission denied or no microphone found');
    }
  }

  stopListening(): Blob | null {
    if (this.mediaRecorder && this.isListening) {
      this.mediaRecorder.stop();
      this.isListening = false;
      this.mediaRecorder.stream.getTracks().forEach(track => track.stop());

      const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
      this.audioChunks = [];
      return audioBlob;
    }
    return null;
  }

  async transcribeAudio(audioBlob: Blob, apiKeys: ApiKeys = {}, language: string = 'ur'): Promise<TranscriptionResult> {
    const result = await apiClient.transcribeAudio(audioBlob, apiKeys, language);
    return {
      text: result.text,
      confidence: 0.95,
      language: result.language || language,
      isFinal: true,
    };
  }

  async speak(text: string, language: string = 'ur', apiKeys: ApiKeys = {}, emotion: string = 'normal'): Promise<void> {
    try {
      const audioBlob = await apiClient.textToSpeech(text, apiKeys, language, emotion);
      const url = URL.createObjectURL(audioBlob);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      audio.onerror = () => URL.revokeObjectURL(url);
      await audio.play();
    } catch (error) {
      console.warn('Natural speech failed, using browser voice:', error);
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language === 'ur' ? 'ur-PK' : 'en-US';
      utterance.rate = 0.95;
      utterance.pitch = 1;

      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);

      await new Promise<void>((resolve, reject) => {
        utterance.onend = () => resolve();
        utterance.onerror = (event) => reject(event.error);
      });
    }
  }

  isCurrentlyListening(): boolean {
    return this.isListening;
  }

  cleanup(): void {
    if (this.mediaRecorder) {
      this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
      this.mediaRecorder = null;
    }
    this.audioChunks = [];
    this.isListening = false;
  }
}

export const voiceService = new VoiceService();
