"""
JARVIS Hybrid - Desktop Voice Engine
Offline voice using Piper TTS (Urdu) and Kokoro ONNX (English)
Falls back to system TTS if models not available
"""

import os
import threading
import queue
import re
from typing import Optional

# Conditional imports
try:
    from piper import PiperVoice
    HAS_PIPER = True
except ImportError:
    HAS_PIPER = False

try:
    from kokoro_onnx import Kokoro
    HAS_KOKORO = True
except ImportError:
    HAS_KOKORO = False

try:
    import sounddevice as sd
    HAS_SOUNDDEVICE = True
except ImportError:
    HAS_SOUNDDEVICE = False

try:
    import numpy as np
    HAS_NUMPY = True
except ImportError:
    HAS_NUMPY = False


class VoiceEngine:
    """3-thread streaming TTS pipeline with emotion support"""

    def __init__(self, config: dict = None):
        self.config = config or {}
        self.piper_voice: Optional[object] = None
        self.kokoro_engine: Optional[object] = None
        self.audio_queue = queue.Queue()
        self.running = False

        # Emotion voice parameters
        self.emotion_params = {
            "happy": {"speed": 1.1, "pitch": 1.2},
            "encouraging": {"speed": 1.0, "pitch": 1.1},
            "serious": {"speed": 0.9, "pitch": 0.9},
            "sympathetic": {"speed": 0.85, "pitch": 0.95},
            "surprised": {"speed": 1.15, "pitch": 1.15},
            "normal": {"speed": 1.0, "pitch": 1.0},
        }

    def initialize(self):
        """Initialize TTS engines"""
        self._load_piper()
        self._load_kokoro()
        self.running = True

        # Start audio player thread
        player_thread = threading.Thread(target=self._audio_player, daemon=True)
        player_thread.start()

    def _load_piper(self):
        """Load Piper TTS for Urdu"""
        if not HAS_PIPER:
            print("[Voice] Piper TTS not available")
            return

        model_path = self.config.get("piper_model_path", "")
        if model_path and os.path.exists(model_path):
            try:
                self.piper_voice = PiperVoice.load(model_path)
                print("[Voice] Piper TTS (Urdu) loaded!")
            except Exception as e:
                print(f"[Voice] Piper load failed: {e}")

    def _load_kokoro(self):
        """Load Kokoro ONNX for English"""
        if not HAS_KOKORO:
            print("[Voice] Kokoro ONNX not available")
            return

        model_path = self.config.get("kokoro_model_path", "")
        if model_path and os.path.exists(model_path):
            try:
                self.kokoro_engine = Kokoro(model_path)
                print("[Voice] Kokoro ONNX (English) loaded!")
            except Exception as e:
                print(f"[Voice] Kokoro load failed: {e}")

    def speak(self, text: str, emotion: str = "normal", lang: str = "auto"):
        """Convert text to speech and play"""
        if not text.strip():
            return

        # Detect language if auto
        if lang == "auto":
            urdu_chars = re.findall(r'[\u0600-\u06FF]', text)
            lang = "ur" if len(urdu_chars) > len(text) * 0.3 else "en"

        # Split into sentences for streaming
        sentences = self._split_sentences(text, lang)

        # Queue sentences for TTS
        for sentence in sentences:
            self.audio_queue.put({
                "text": sentence,
                "lang": lang,
                "emotion": emotion,
            })

    def _split_sentences(self, text: str, lang: str) -> list:
        """Split text into sentences for streaming TTS"""
        if lang == "ur":
            # Urdu sentence endings
            sentences = re.split(r'[۔!\?؟\n]+', text)
        else:
            sentences = re.split(r'[.!?\n]+', text)

        return [s.strip() for s in sentences if s.strip()]

    def _audio_player(self):
        """Audio player thread - plays TTS audio in order"""
        while self.running:
            try:
                item = self.audio_queue.get(timeout=1)
                self._synthesize_and_play(item)
            except queue.Empty:
                continue

    def _synthesize_and_play(self, item: dict):
        """Synthesize speech and play audio"""
        text = item["text"]
        lang = item["lang"]
        emotion = item.get("emotion", "normal")
        params = self.emotion_params.get(emotion, self.emotion_params["normal"])

        # Try Kokoro for English
        if lang == "en" and self.kokoro_engine:
            try:
                audio = self.kokoro_engine.create(text, speed=params["speed"])
                self._play_audio(audio)
                return
            except Exception as e:
                print(f"[Voice] Kokoro synthesis failed: {e}")

        # Try Piper for Urdu
        if lang == "ur" and self.piper_voice:
            try:
                audio = self.piper_voice.synthesize(text)
                self._play_audio(audio)
                return
            except Exception as e:
                print(f"[Voice] Piper synthesis failed: {e}")

        # Fallback: try Piper for any language
        if self.piper_voice:
            try:
                audio = self.piper_voice.synthesize(text)
                self._play_audio(audio)
                return
            except Exception:
                pass

        # Final fallback: system TTS
        self._system_tts(text, lang)

    def _play_audio(self, audio_data):
        """Play audio using sounddevice"""
        if not HAS_SOUNDDEVICE or not HAS_NUMPY:
            return

        try:
            if isinstance(audio_data, bytes):
                import io
                import wave
                with wave.open(io.BytesIO(audio_data), "rb") as wf:
                    audio_array = np.frombuffer(wf.readframes(wf.getnframes()), dtype=np.int16)
                    sample_rate = wf.getframerate()
            else:
                audio_array = np.array(audio_data, dtype=np.float32)
                sample_rate = 22050

            sd.play(audio_array, sample_rate)
            sd.wait()
        except Exception as e:
            print(f"[Voice] Audio playback failed: {e}")

    def _system_tts(self, text: str, lang: str):
        """Fallback system TTS"""
        import subprocess
        import sys

        try:
            if sys.platform == "win32":
                # Windows SAPI
                subprocess.run(
                    ["powershell", "-c",
                     f'Add-Type -AssemblyName System.Speech; '
                     f'$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer; '
                     f'$synth.Speak("{text}")'],
                    timeout=30,
                )
            elif sys.platform == "darwin":
                subprocess.run(["say", text], timeout=30)
            else:
                subprocess.run(["espeak", text], timeout=30)
        except Exception as e:
            print(f"[Voice] System TTS failed: {e}")

    def stop(self):
        """Stop the voice engine"""
        self.running = False
        if HAS_SOUNDDEVICE:
            sd.stop()


# ============== STT ENGINE ==============

class STTEngine:
    """Speech-to-Text using faster-whisper (offline)"""

    def __init__(self, config: dict = None):
        self.config = config or {}
        self.model = None

    def initialize(self):
        """Load Whisper model"""
        try:
            from faster_whisper import WhisperModel
            model_size = self.config.get("whisper_model", "base")
            self.model = WhisperModel(model_size, device="cpu", compute_type="int8")
            print(f"[STT] Whisper {model_size} model loaded!")
        except ImportError:
            print("[STT] faster-whisper not available. Install: pip install faster-whisper")
        except Exception as e:
            print(f"[STT] Whisper load failed: {e}")

    def transcribe(self, audio_path: str, language: str = None) -> dict:
        """Transcribe audio file to text"""
        if not self.model:
            return {"success": False, "error": "Whisper model not loaded"}

        try:
            segments, info = self.model.transcribe(
                audio_path,
                language=language,
                vad_filter=True,
            )

            text = " ".join(segment.text for segment in segments)
            return {
                "success": True,
                "text": text.strip(),
                "language": info.language,
                "probability": info.language_probability,
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    def listen(self, duration: int = 5, language: str = None) -> dict:
        """Record from microphone and transcribe"""
        if not HAS_SOUNDDEVICE or not HAS_NUMPY:
            return {"success": False, "error": "sounddevice/numpy not available"}

        try:
            import tempfile
            import wave

            # Record audio
            sample_rate = 16000
            recording = sd.rec(
                int(duration * sample_rate),
                samplerate=sample_rate,
                channels=1,
                dtype="int16",
            )
            sd.wait()

            # Save to temp WAV
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
                with wave.open(f.name, "wb") as wf:
                    wf.setnchannels(1)
                    wf.setsampwidth(2)
                    wf.setframerate(sample_rate)
                    wf.writeframes(recording.tobytes())

                return self.transcribe(f.name, language)
        except Exception as e:
            return {"success": False, "error": str(e)}
