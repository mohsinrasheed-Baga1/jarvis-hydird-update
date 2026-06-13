import { useEffect, useRef, useState } from 'react';
import { apiClient } from '../services/apiClient';
import { storageService } from '../services/storageService';

interface MessageInputProps {
  onSendMessage: (message: string, file?: File | null) => void;
  isLoading: boolean;
  voiceRepliesEnabled: boolean;
  onVoiceRepliesChange: (enabled: boolean) => void;
  speechStatus?: string;
  automationStatus?: string;
}

function AttachmentIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21.4 11.6 12 21a6 6 0 0 1-8.5-8.5l9.9-9.9a4 4 0 0 1 5.7 5.7l-9.9 9.9a2 2 0 0 1-2.8-2.8l9.4-9.4" />
    </svg>
  );
}

function HeadphonesIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 14a9 9 0 0 1 18 0" />
      <path d="M5 14h3v6H5a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2Z" />
      <path d="M19 14h-3v6h3a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2Z" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <path d="M12 19v3" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}

export default function MessageInput({
  onSendMessage,
  isLoading,
  voiceRepliesEnabled,
  onVoiceRepliesChange,
  speechStatus = '',
  automationStatus = '',
}: MessageInputProps) {
  const [input, setInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState('');
  const [micState, setMicState] = useState<'ready' | 'listening' | 'processing' | 'error'>('ready');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const inputRef = useRef('');
  const selectedFileRef = useRef<File | null>(null);
  const manualListeningRef = useRef(false);
  const pendingRestartRef = useRef(false);
  const restartTimerRef = useRef<number | null>(null);
  const autoSendTimerRef = useRef<number | null>(null);
  const silenceTimerRef = useRef<number | null>(null);
  const analyserFrameRef = useRef<number | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const heardSpeechRef = useRef(false);
  const isLoadingRef = useRef(isLoading);
  const speechBusyRef = useRef(false);

  useEffect(() => {
    inputRef.current = input;
  }, [input]);

  useEffect(() => {
    selectedFileRef.current = selectedFile;
  }, [selectedFile]);

  useEffect(() => {
    isLoadingRef.current = isLoading;
    if (!isLoading && !speechBusyRef.current && manualListeningRef.current && pendingRestartRef.current) {
      pendingRestartRef.current = false;
      scheduleRecognitionRestart();
    }
  }, [isLoading]);

  useEffect(() => {
    const busy = /speaking|creating natural voice/i.test(speechStatus);
    speechBusyRef.current = busy;
    if (busy && manualListeningRef.current) {
      pendingRestartRef.current = true;
      stopActiveListening(false);
      return;
    }
    if (!busy && !isLoadingRef.current && manualListeningRef.current && pendingRestartRef.current) {
      pendingRestartRef.current = false;
      scheduleRecognitionRestart();
    }
  }, [speechStatus]);

  const resizeTextarea = () => {
    window.requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 150) + 'px';
      }
    });
  };

  const resetTextarea = () => {
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const clearTimer = (timerRef: React.MutableRefObject<number | null>) => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const showVoiceStatus = (message: string) => {
    setVoiceStatus(message);
    setMicState(message.toLowerCase().includes('denied') || message.toLowerCase().includes('unavailable') ? 'error' : 'ready');
    window.setTimeout(() => setVoiceStatus(''), 4500);
  };

  const handleSend = (messageOverride?: string) => {
    const message = (messageOverride ?? inputRef.current).trim();
    const file = selectedFileRef.current;
    if (isLoadingRef.current || (!message && !file)) return;
    isLoadingRef.current = true;
    onSendMessage(message, file);
    setInput('');
    inputRef.current = '';
    setSelectedFile(null);
    selectedFileRef.current = null;
    if (fileInputRef.current) fileInputRef.current.value = '';
    resetTextarea();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    inputRef.current = e.target.value;
    resizeTextarea();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
    selectedFileRef.current = file;
  };

  const stopMediaStream = () => {
    mediaStreamRef.current?.getTracks().forEach(track => track.stop());
    mediaStreamRef.current = null;
  };

  const stopAnalyser = () => {
    if (analyserFrameRef.current) {
      window.cancelAnimationFrame(analyserFrameRef.current);
      analyserFrameRef.current = null;
    }
    clearTimer(silenceTimerRef);
  };

  const scheduleVoiceSend = (text: string) => {
    clearTimer(autoSendTimerRef);
    const clean = text.trim();
    if (!clean || selectedFileRef.current) return;
    autoSendTimerRef.current = window.setTimeout(() => {
      if (!manualListeningRef.current || isLoadingRef.current) return;
      handleSend(clean);
      pendingRestartRef.current = true;
      stopActiveListening(false);
    }, 900);
  };

  const finishRecordedInput = async () => {
    stopAnalyser();
    const audio = new Blob(audioChunksRef.current, { type: 'audio/webm' });
    audioChunksRef.current = [];
    stopMediaStream();
    recorderRef.current = null;
    setIsListening(manualListeningRef.current && !isLoadingRef.current);
    setMicState('processing');

    if (audio.size < 500) {
      showVoiceStatus('No voice detected');
      return;
    }

    try {
      setVoiceStatus('Transcribing...');
      const prefs = storageService.getPreferences();
      const apiKeys = storageService.getApiKeys();
      const lang = prefs.language === 'en' ? 'en' : 'ur';
      const electronAPI = (window as any).electronAPI;

      // In Electron: Use IPC-based transcription (bypasses need for backend server)
      // This calls the main process which directly hits Groq/OpenAI Whisper APIs
      if (electronAPI?.transcribeAudioBase64) {
        try {
          const reader = new FileReader();
          const base64Result = await new Promise<string>((resolve, reject) => {
            reader.onload = () => {
              const base64 = (reader.result as string).split(',')[1];
              resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(audio);
          });

          const result = await electronAPI.transcribeAudioBase64(base64Result, lang, apiKeys);
          if (result.success && result.text) {
            setInput(result.text);
            inputRef.current = result.text;
            resizeTextarea();
            setVoiceStatus('Voice captured');
            setMicState('ready');
            if (manualListeningRef.current && !selectedFileRef.current) scheduleVoiceSend(result.text);
            window.setTimeout(() => setVoiceStatus(''), 2500);
            return;
          }
          // IPC transcription failed, show error
          showVoiceStatus(result.error || 'Voice recognition failed. Check Groq/OpenAI API key in Settings.');
          return;
        } catch (ipcErr) {
          console.warn('IPC transcription failed, trying backend:', ipcErr);
          // Fall through to backend API
        }
      }

      // Fallback: Use backend API transcription (requires Next.js backend running)
      const result = await apiClient.transcribeAudio(audio, apiKeys, prefs.language);
      if (result.text) {
        setInput(result.text);
        inputRef.current = result.text;
        resizeTextarea();
        setVoiceStatus('Voice captured');
        setMicState('ready');
        if (manualListeningRef.current && !selectedFileRef.current) scheduleVoiceSend(result.text);
        window.setTimeout(() => setVoiceStatus(''), 2500);
      } else {
        showVoiceStatus('No speech recognized');
      }
    } catch {
      showVoiceStatus('Voice transcription needs a Groq or OpenAI key in Settings');
    }
  };

  const startSilenceMonitor = (stream: MediaStream, recorder: MediaRecorder) => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const audioContext = new AudioContextClass();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      const data = new Uint8Array(analyser.fftSize);
      source.connect(analyser);
      heardSpeechRef.current = false;

      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let total = 0;
        for (const value of data) total += Math.abs(value - 128);
        const level = total / data.length;
        const speaking = level > 5;

        if (speaking) {
          heardSpeechRef.current = true;
          clearTimer(silenceTimerRef);
        } else if (heardSpeechRef.current && !silenceTimerRef.current) {
          silenceTimerRef.current = window.setTimeout(() => {
            if (recorder.state === 'recording') recorder.stop();
            audioContext.close().catch(() => undefined);
          }, 1300);
        }

        if (recorder.state === 'recording') {
          analyserFrameRef.current = window.requestAnimationFrame(tick);
        }
      };

      tick();
    } catch {
      window.setTimeout(() => {
        if (recorder.state === 'recording') recorder.stop();
      }, 12000);
    }
  };

  const startRecordedFallback = async (keepManual: boolean = true) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaStreamRef.current = stream;
      recorderRef.current = recorder;
      audioChunksRef.current = [];
      recorder.ondataavailable = event => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        finishRecordedInput();
      };
      recorder.start();
      manualListeningRef.current = keepManual;
      setIsListening(true);
      setMicState('listening');
      setVoiceStatus('Listening...');
      startSilenceMonitor(stream, recorder);
      window.setTimeout(() => {
        if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
      }, 30000);
    } catch {
      showVoiceStatus('Microphone permission denied');
    }
  };

  const stopActiveListening = (manualStop: boolean = true) => {
    if (manualStop) {
      manualListeningRef.current = false;
      pendingRestartRef.current = false;
      clearTimer(autoSendTimerRef);
    }
    clearTimer(restartTimerRef);
    recognitionRef.current?.stop?.();
    recognitionRef.current = null;
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
      return;
    }
    stopAnalyser();
    stopMediaStream();
    setIsListening(false);
    setMicState('ready');
  };

  const scheduleRecognitionRestart = () => {
    if (!manualListeningRef.current || isLoadingRef.current || speechBusyRef.current) {
      pendingRestartRef.current = true;
      return;
    }
    clearTimer(restartTimerRef);
    restartTimerRef.current = window.setTimeout(() => {
      startWebSpeechListening();
    }, 250);
  };

  const startWebSpeechListening = async () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      await startRecordedFallback(true);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      const prefs = storageService.getPreferences();
      recognition.lang = prefs.language === 'en' ? 'en-US' : 'ur-PK';
      recognition.interimResults = true;
      recognition.continuous = true;
      recognition.maxAlternatives = 3;
      recognitionRef.current = recognition;
      setIsListening(true);
      setMicState('listening');
      setVoiceStatus('Listening...');

      recognition.onresult = (event: any) => {
        const parts = Array.from(event.results).map((result: any) => result[0]?.transcript || '');
        const transcript = parts.join(' ').trim();
        const latest = event.results[event.results.length - 1];
        if (transcript) {
          setInput(transcript);
          inputRef.current = transcript;
          resizeTextarea();
        }
        if (latest?.isFinal && transcript) scheduleVoiceSend(transcript);
      };
      recognition.onerror = async (event: any) => {
        recognitionRef.current = null;
        if (!manualListeningRef.current) return;
        if (event?.error === 'no-speech' || event?.error === 'aborted') {
          scheduleRecognitionRestart();
          return;
        }
        setMicState('processing');
        await startRecordedFallback(true);
      };
      recognition.onend = () => {
        recognitionRef.current = null;
        if (manualListeningRef.current) {
          scheduleRecognitionRestart();
        } else {
          setIsListening(false);
          setMicState('ready');
          window.setTimeout(() => setVoiceStatus(''), 2500);
        }
      };
      recognition.start();
    } catch {
      await startRecordedFallback(true);
    }
  };

  const toggleMic = async () => {
    if (manualListeningRef.current || isListening) {
      stopActiveListening(true);
      return;
    }

    manualListeningRef.current = true;
    if (isLoadingRef.current) {
      pendingRestartRef.current = true;
      setIsListening(true);
      setMicState('listening');
      setVoiceStatus('Listening after reply...');
      return;
    }

    const electronAPI = (window as any).electronAPI;
    const isElectron = !!electronAPI;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    // In Electron: Always use MediaRecorder in renderer + IPC transcription
    // This is the most reliable path because:
    // 1. navigator.mediaDevices.getUserMedia works in renderer context (not preload)
    // 2. MediaRecorder works in renderer context
    // 3. IPC transcription calls Groq/OpenAI directly from main process (no backend needed)
    if (isElectron) {
      await startRecordedFallback(true);
      return;
    }

    // In browser: Try Web Speech API first, then MediaRecorder fallback
    if (!SpeechRecognition) {
      await startRecordedFallback(true);
      return;
    }

    await startWebSpeechListening();
  };

  useEffect(() => () => stopActiveListening(true), []);

  const micLabel = micState === 'listening' ? 'Listening' : micState === 'processing' ? 'Processing' : micState === 'error' ? 'Voice unavailable' : 'Mic Ready';
  const status = isListening ? 'Listening...' : speechStatus || voiceStatus || micLabel;

  return (
    <div className="space-y-2">
      {(selectedFile || status) && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs">
          {selectedFile && (
            <div className="flex max-w-full items-center gap-2 rounded-full border border-purple-400/25 bg-purple-500/10 px-3 py-1.5 text-purple-100">
              <span className="max-w-[320px] truncate">{selectedFile.name}</span>
              <button
                type="button"
                onClick={() => {
                  setSelectedFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="rounded-full px-1 text-purple-200 hover:bg-purple-400/20 hover:text-white"
                aria-label="Remove selected file"
              >
                x
              </button>
            </div>
          )}
          {status && (
            <div className="flex flex-wrap gap-2">
              <div className="rounded-full border border-purple-400/20 bg-slate-950/90 px-3 py-1.5 text-slate-300">
                {status}
              </div>
              {automationStatus && (
                <div className="rounded-full border border-cyan-400/20 bg-slate-950/90 px-3 py-1.5 text-slate-300">
                  {automationStatus}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex min-h-[58px] items-end gap-1 rounded-[26px] border border-purple-400/60 bg-[#080811]/95 p-1.5 shadow-[0_0_0_1px_rgba(168,85,247,0.08),0_0_34px_rgba(168,85,247,0.22)]">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileChange}
        />
        <div className="flex items-center gap-0.5 pb-0.5">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="flex h-10 w-10 items-center justify-center rounded-full text-slate-300 transition hover:bg-slate-800 hover:text-white disabled:opacity-40"
            title="Attach file"
          >
            <AttachmentIcon />
          </button>
          <button
            type="button"
            onClick={() => onVoiceRepliesChange(!voiceRepliesEnabled)}
            disabled={isLoading}
            className={`flex h-10 w-10 items-center justify-center rounded-full transition disabled:opacity-40 ${
              voiceRepliesEnabled
                ? 'bg-purple-500/20 text-purple-100 ring-1 ring-purple-300/45'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
            title="Spoken replies"
          >
            <HeadphonesIcon />
          </button>
          <button
            type="button"
            onClick={toggleMic}
            className={`flex h-10 w-10 items-center justify-center rounded-full transition disabled:opacity-40 ${
              isListening
                ? 'bg-red-500/15 text-red-200 ring-1 ring-red-400/50'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
            title="Voice input"
          >
            <MicIcon />
          </button>
        </div>

        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="اپنا پیغام لکھیں... / Type your message..."
          disabled={isLoading}
          className="min-h-[44px] flex-1 resize-none bg-transparent px-2 py-2.5 text-[15px] leading-6 text-white placeholder-slate-500 outline-none disabled:cursor-not-allowed disabled:opacity-60"
          rows={1}
        />

        <button
          type="button"
          onClick={() => handleSend()}
          disabled={isLoading || (!input.trim() && !selectedFile)}
          className="mb-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-purple-600 text-white shadow-lg shadow-purple-600/25 transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500 disabled:shadow-none"
          title="Send message"
        >
          <SendIcon />
        </button>
      </div>
    </div>
  );
}
