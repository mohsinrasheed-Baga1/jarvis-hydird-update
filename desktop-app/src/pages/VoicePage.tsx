import { useRef, useState } from 'react';
import { storageService } from '../services/storageService';
import { voiceService } from '../services/voiceService';

export default function VoicePage() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [status, setStatus] = useState('');
  const [language, setLanguage] = useState<'ur' | 'en' | 'mixed'>('ur');
  const recognitionRef = useRef<any>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const transcribeFallback = async () => {
    const audio = new Blob(chunksRef.current, { type: 'audio/webm' });
    chunksRef.current = [];
    recorderRef.current?.stream.getTracks().forEach(track => track.stop());
    recorderRef.current = null;
    setIsListening(false);
    if (audio.size < 500) {
      setStatus('No voice detected.');
      return;
    }
    try {
      setStatus('Transcribing...');
      const result = await voiceService.transcribeAudio(audio, storageService.getApiKeys(), language);
      setTranscript(result.text);
      setStatus(result.text ? 'Voice input captured.' : 'No speech recognized.');
    } catch {
      setStatus('Recorded transcription needs a Groq or OpenAI key in Settings.');
    }
  };

  const stopFallback = () => {
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
      return;
    }
    transcribeFallback();
  };

  const startListening = async () => {
    // In Electron, webkitSpeechRecognition doesn't work.
    // Always use MediaRecorder + cloud Whisper for reliable voice input.
    const isElectron = !!(window as any).electronAPI;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!isElectron && SpeechRecognition) {
      // Browser mode: use native SpeechRecognition API
      const recognition = new SpeechRecognition();
      recognition.lang = language === 'en' ? 'en-US' : 'ur-PK';
      recognition.interimResults = true;
      recognition.continuous = false;
      recognitionRef.current = recognition;
      setTranscript('');
      setStatus('Listening...');
      setIsListening(true);
      recognition.onresult = (event: any) => {
        const text = Array.from(event.results).map((result: any) => result[0]?.transcript || '').join(' ');
        setTranscript(text.trim());
      };
      recognition.onerror = () => setStatus('Speech recognition failed. Check microphone permission.');
      recognition.onend = () => setIsListening(false);
      recognition.start();
      return;
    }

    // Electron or fallback: use MediaRecorder + cloud Whisper API
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = event => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = transcribeFallback;
      recorder.start();
      setTranscript('');
      setStatus(isElectron ? 'Recording... (Cloud Whisper)' : 'Recording...');
      setIsListening(true);
      setTimeout(() => {
        if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
      }, 7000);
    } catch {
      setStatus('Microphone permission denied or no microphone found.');
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
      setIsListening(false);
      return;
    }
    stopFallback();
  };

  const speakTranscript = async () => {
    const text = transcript || 'Voice output is working.';
    setStatus('Creating natural voice...');
    try {
      await voiceService.speak(text, language === 'en' ? 'en' : 'ur', storageService.getApiKeys());
      setStatus('');
    } catch {
      setStatus('Voice output failed.');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-950 p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Voice</h1>
          <p className="text-slate-400">Use browser speech recognition when available, with microphone permission fallback.</p>
        </div>

        <section className="bg-slate-900 border border-slate-700 rounded-lg p-8 text-center space-y-4">
          <button
            onClick={isListening ? stopListening : startListening}
            className={`w-24 h-24 rounded-full mx-auto text-white font-bold ${
              isListening ? 'bg-red-600 animate-pulse' : 'bg-purple-600 hover:bg-purple-700'
            }`}
          >
            {isListening ? 'Stop' : 'Mic'}
          </button>
          <p className="text-slate-300">{isListening ? 'Listening...' : 'Ready'}</p>
          {status && <p className="text-sm text-slate-400">{status}</p>}
        </section>

        <section className="bg-slate-900 border border-slate-700 rounded-lg p-6 space-y-4">
          <label className="block text-sm font-medium text-slate-300">Language</label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as 'ur' | 'en' | 'mixed')}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
          >
            <option value="ur">Urdu</option>
            <option value="en">English</option>
            <option value="mixed">Mixed</option>
          </select>
          <button onClick={speakTranscript} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg">
            Test voice output
          </button>
        </section>

        {transcript && (
          <section className="bg-slate-900 border border-slate-700 rounded-lg p-6">
            <p className="text-slate-400 text-sm mb-2">Transcript</p>
            <p className="text-white">{transcript}</p>
          </section>
        )}
      </div>
    </div>
  );
}
