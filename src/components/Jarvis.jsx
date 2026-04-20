import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";

const WS_URL =
  import.meta.env.VITE_BACKEND_WS_URL ||
  `${window.location.protocol === "https:" ? "wss" : "ws"}://localhost:3000`;

const SESSION_STORAGE_PREFIX = "jarvis-session";
const INPUT_SAMPLE_RATE = 16000;

function downsampleTo16k(inputData, inputSampleRate) {
  if (inputSampleRate === INPUT_SAMPLE_RATE) {
    return float32ToInt16(inputData);
  }

  const sampleRateRatio = inputSampleRate / INPUT_SAMPLE_RATE;
  const newLength = Math.round(inputData.length / sampleRateRatio);
  const result = new Int16Array(newLength);
  let offsetResult = 0;
  let offsetBuffer = 0;

  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
    let accum = 0;
    let count = 0;

    for (let index = offsetBuffer; index < nextOffsetBuffer && index < inputData.length; index += 1) {
      accum += inputData[index];
      count += 1;
    }

    const sample = count > 0 ? accum / count : 0;
    result[offsetResult] = clampToInt16(sample);
    offsetResult += 1;
    offsetBuffer = nextOffsetBuffer;
  }

  return result;
}

function float32ToInt16(float32Array) {
  const result = new Int16Array(float32Array.length);

  for (let index = 0; index < float32Array.length; index += 1) {
    result[index] = clampToInt16(float32Array[index]);
  }

  return result;
}

function clampToInt16(sample) {
  const clamped = Math.max(-1, Math.min(1, sample));
  return clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
}

function pcmBase64ToFloat32(base64Audio) {
  const byteCharacters = atob(base64Audio);
  const byteArray = new Uint8Array(byteCharacters.length);

  for (let index = 0; index < byteCharacters.length; index += 1) {
    byteArray[index] = byteCharacters.charCodeAt(index);
  }

  const pcmView = new DataView(byteArray.buffer);
  const float32 = new Float32Array(byteArray.byteLength / 2);

  for (let index = 0; index < float32.length; index += 1) {
    float32[index] = pcmView.getInt16(index * 2, true) / 0x8000;
  }

  return float32;
}

function getSampleRateFromMimeType(mimeType) {
  const match = mimeType?.match(/rate=(\d+)/);
  return match ? Number(match[1]) : 24000;
}

function useLiveVoice({ assistantType, onMessage }) {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState("connecting");
  const wsRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const currentAssistantRef = useRef(assistantType);
  const onMessageRef = useRef(onMessage);
  const captureStreamRef = useRef(null);
  const captureContextRef = useRef(null);
  const captureProcessorRef = useRef(null);
  const captureAnalyserRef = useRef(null);
  const captureSourceRef = useRef(null);
  const captureSilenceRef = useRef(null);
  const playbackContextRef = useRef(null);
  const playbackCursorRef = useRef(0);
  const queuedPlaybackRef = useRef(0);

  useEffect(() => {
    currentAssistantRef.current = assistantType;
  }, [assistantType]);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    let cancelled = false;

    const connect = () => {
      if (cancelled) {
        return;
      }

      const socket = new WebSocket(WS_URL);
      socket.binaryType = "arraybuffer";
      wsRef.current = socket;

      socket.onopen = () => {
        reconnectAttemptsRef.current = 0;
        setIsConnected(true);
        setStatus("idle");

        const storageKey = `${SESSION_STORAGE_PREFIX}:${currentAssistantRef.current}`;
        const existingSessionId = localStorage.getItem(storageKey);

        socket.send(
          JSON.stringify({
            type: "session:init",
            sessionId: existingSessionId,
            assistantType: currentAssistantRef.current
          })
        );
      };

      socket.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === "session:ready" && data.sessionId) {
          localStorage.setItem(
            `${SESSION_STORAGE_PREFIX}:${data.assistantType || currentAssistantRef.current}`,
            data.sessionId
          );
        }

        if (data.type === "status" && data.status) {
          setStatus(data.status);
        }

        onMessageRef.current(data);
      };

      socket.onerror = () => {
        setIsConnected(false);
      };

      socket.onclose = () => {
        setIsConnected(false);
        if (cancelled) {
          return;
        }

        reconnectAttemptsRef.current += 1;
        setStatus("connecting");
        setTimeout(connect, Math.min(1000 * reconnectAttemptsRef.current, 5000));
      };
    };

    connect();

    return () => {
      cancelled = true;
      wsRef.current?.close();
    };
  }, []);

  const ensurePlaybackContext = async () => {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) {
      return null;
    }

    if (!playbackContextRef.current) {
      playbackContextRef.current = new AudioContextClass();
    }

    if (playbackContextRef.current.state === "suspended") {
      await playbackContextRef.current.resume();
    }

    if (playbackCursorRef.current < playbackContextRef.current.currentTime) {
      playbackCursorRef.current = playbackContextRef.current.currentTime;
    }

    return playbackContextRef.current;
  };

  const enqueueResponseAudio = async (base64Audio, mimeType) => {
    const playbackContext = await ensurePlaybackContext();

    if (!playbackContext) {
      throw new Error("AudioContext non disponible.");
    }

    const sampleRate = getSampleRateFromMimeType(mimeType);
    const samples = pcmBase64ToFloat32(base64Audio);
    const audioBuffer = playbackContext.createBuffer(1, samples.length, sampleRate);
    audioBuffer.getChannelData(0).set(samples);

    const source = playbackContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(playbackContext.destination);

    const startAt = Math.max(playbackContext.currentTime + 0.05, playbackCursorRef.current);
    playbackCursorRef.current = startAt + audioBuffer.duration;
    queuedPlaybackRef.current += 1;

    source.onended = () => {
      queuedPlaybackRef.current = Math.max(0, queuedPlaybackRef.current - 1);

      if (queuedPlaybackRef.current === 0 && playbackContextRef.current) {
        playbackCursorRef.current = playbackContextRef.current.currentTime;
      }
    };

    source.start(startAt);
  };

  const startRecording = async () => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      throw new Error("La connexion WebSocket n'est pas prete.");
    }

    await ensurePlaybackContext();

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true
      }
    });

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const captureContext = new AudioContextClass();
    const source = captureContext.createMediaStreamSource(stream);
    const analyser = captureContext.createAnalyser();
    analyser.fftSize = 64;

    const processor = captureContext.createScriptProcessor(4096, 1, 1);
    const silenceGain = captureContext.createGain();
    silenceGain.gain.value = 0;

    processor.onaudioprocess = (event) => {
      if (wsRef.current?.readyState !== WebSocket.OPEN) {
        return;
      }

      const inputData = event.inputBuffer.getChannelData(0);
      const pcm16 = downsampleTo16k(inputData, captureContext.sampleRate);
      wsRef.current.send(pcm16.buffer);
    };

    source.connect(analyser);
    analyser.connect(processor);
    processor.connect(silenceGain);
    silenceGain.connect(captureContext.destination);

    captureStreamRef.current = stream;
    captureContextRef.current = captureContext;
    captureSourceRef.current = source;
    captureAnalyserRef.current = analyser;
    captureProcessorRef.current = processor;
    captureSilenceRef.current = silenceGain;

    wsRef.current.send(
      JSON.stringify({
        type: "recording_started",
        assistantType: currentAssistantRef.current
      })
    );

    setIsRecording(true);
  };

  const stopRecording = async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "recording_stopped",
          assistantType: currentAssistantRef.current
        })
      );
    }

    captureProcessorRef.current?.disconnect();
    captureSilenceRef.current?.disconnect();
    captureSourceRef.current?.disconnect();
    captureStreamRef.current?.getTracks().forEach((track) => track.stop());

    if (captureContextRef.current && captureContextRef.current.state !== "closed") {
      await captureContextRef.current.close();
    }

    captureStreamRef.current = null;
    captureContextRef.current = null;
    captureSourceRef.current = null;
    captureAnalyserRef.current = null;
    captureProcessorRef.current = null;
    captureSilenceRef.current = null;

    setIsRecording(false);
  };

  const resetConversation = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "session:reset" }));
    }
  };

  useEffect(() => {
    return () => {
      captureProcessorRef.current?.disconnect();
      captureSilenceRef.current?.disconnect();
      captureSourceRef.current?.disconnect();
      captureStreamRef.current?.getTracks().forEach((track) => track.stop());

      if (captureContextRef.current && captureContextRef.current.state !== "closed") {
        captureContextRef.current.close();
      }

      if (playbackContextRef.current && playbackContextRef.current.state !== "closed") {
        playbackContextRef.current.close();
      }
    };
  }, []);

  return {
    isConnected,
    isRecording,
    status,
    analyserRef: captureAnalyserRef,
    startRecording,
    stopRecording,
    enqueueResponseAudio,
    resetConversation
  };
}

function Jarvis() {
  const { assistantType = "default" } = useParams();
  const [fullText, setFullText] = useState("");
  const [index, setIndex] = useState(0);
  const [scale, setScale] = useState(1);
  const [audioError, setAudioError] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [serverStatus, setServerStatus] = useState("connecting");
  const animationRef = useRef(null);

  const userName = localStorage.getItem("userName") || "";

  const handleMessage = async (data) => {
    if (data.type === "status") {
      setServerStatus(data.status);
      if (data.status !== "speaking") {
        setIsPlaying(false);
      }
      return;
    }

    if (data.type === "response_audio_chunk" && data.audio) {
      try {
        setAudioError(null);
        setIsPlaying(true);
        await enqueueResponseAudio(data.audio, data.mimeType || "audio/pcm;rate=24000");
      } catch {
        setIsPlaying(false);
        setAudioError("Lecture audio impossible.");
      }
      return;
    }

    if (data.type === "error") {
      setAudioError(data.error || "Une erreur est survenue.");
      setServerStatus("idle");
      setIsPlaying(false);
    }
  };

  const {
    isRecording,
    status,
    isConnected,
    analyserRef,
    startRecording,
    stopRecording,
    enqueueResponseAudio,
    resetConversation
  } = useLiveVoice({
    assistantType,
    onMessage: handleMessage
  });

  useEffect(() => {
    setServerStatus(status);
  }, [status]);

  useEffect(() => {
    const assistantTexts = {
      coach: `${userName ? `${userName}, ` : ""}Je suis votre coach\nPret pour votre seance ?\nQuel objectif voulez-vous attaquer ?`,
      psychologue: `${userName ? `${userName}, ` : ""}Je suis la pour vous ecouter\nParlez-moi librement\nOn avance ensemble, a votre rythme`,
      pote: `Salut ${userName || "mon pote"} !\nQuoi de neuf aujourd'hui ?\nOn parle de ce que tu veux`,
      traducteur: `${userName ? `Bonjour ${userName}, ` : ""}je suis votre traducteur\nJe peux vous aider en francais ou en anglais`,
      medecin: `Dr. Jarvis\nExpliquez-moi ce que vous ressentez\nJe vous repondrai avec prudence`,
      prof: `${userName ? `${userName}, ` : ""}Professeur a votre service\nQuel sujet voulez-vous comprendre ?`
    };

    setFullText(assistantTexts[assistantType] || "Bonjour, comment puis-je vous aider ?");
    setIndex(0);
  }, [assistantType, userName]);

  useEffect(() => {
    if (index >= fullText.length) {
      return undefined;
    }

    const timeout = setTimeout(() => {
      setIndex((current) => current + 1);
    }, 40);

    return () => clearTimeout(timeout);
  }, [index, fullText]);

  useEffect(() => {
    const updateScale = () => {
      const analyser = analyserRef.current;

      if (!analyser) {
        setScale(1);
        animationRef.current = requestAnimationFrame(updateScale);
        return;
      }

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(dataArray);
      const volume = Math.max(...dataArray) / 255;
      setScale(1 + volume * 0.8);
      animationRef.current = requestAnimationFrame(updateScale);
    };

    animationRef.current = requestAnimationFrame(updateScale);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [analyserRef]);

  const toggleRecording = async () => {
    try {
      setAudioError(null);

      if (!isConnected) {
        setAudioError("Connexion au serveur en attente.");
        return;
      }

      if (isRecording) {
        await stopRecording();
        return;
      }

      await startRecording();
    } catch {
      setAudioError("Impossible d'utiliser le micro ou l'audio en direct.");
    }
  };

  const isBusy = isRecording || serverStatus === "processing" || serverStatus === "speaking";

  const buttonLabel = isRecording ? "Arreter" : "Parler a Jarvis";

  const liveStatusLabel = (() => {
    if (!isConnected) {
      return "Connexion en cours...";
    }
    if (isRecording) {
      return "Jarvis vous ecoute";
    }
    if (serverStatus === "processing" || serverStatus === "speaking" || isPlaying) {
      return "Conversation en cours";
    }
    return null;
  })();

  return (
    <div
      className="h-screen flex flex-col justify-start pt-16 items-center text-white px-6 overflow-hidden"
      style={{
        background:
          "linear-gradient(31deg, rgba(4, 12, 17, 1) 6%, rgba(10, 5, 48, 1) 15%, rgba(12, 62, 4, 1) 100%, rgba(28, 28, 28, 1) 78%, rgba(6, 6, 36, 1) 48%, rgba(4, 28, 7, 1) 90%, rgba(12, 12, 60, 1) 38%, rgba(16, 64, 44, 1) 82%)",
        boxShadow: "inset 0 0 50px rgba(0,0,0,0.7)"
      }}
    >
      <div className="text-3xl font-medium text-center mb-12 min-h-[8rem] leading-relaxed whitespace-pre-line">
        {fullText.substring(0, index)}
        <span className="animate-pulse">|</span>
      </div>

      <div className="mb-12">
        <div
          className="relative mx-auto transition-transform duration-100"
          style={{
            width: "160px",
            height: "160px",
            transform: `scale(${scale})`
          }}
        >
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#005F73] to-[#0A9396] p-0.5 animate-pulse overflow-hidden">
            <div className="absolute inset-0 rounded-full overflow-hidden">
              <video
                autoPlay
                loop
                muted
                playsInline
                className="absolute inset-0 w-full h-full object-cover"
              >
                <source src="/jarvis.mp4" type="video/mp4" />
              </video>
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={toggleRecording}
        disabled={!isConnected || serverStatus === "processing"}
        className={`mt-6 border rounded-full px-8 py-3 text-lg transition-colors ${
          isRecording
            ? "bg-red-600 border-red-600 text-white"
            : !isConnected || serverStatus === "processing"
              ? "bg-gray-600 border-gray-600 text-white cursor-not-allowed"
              : "border-[#0A9396] text-[#0A9396] hover:bg-[#0A9396] hover:text-black"
        }`}
      >
        {isRecording ? (
          <span className="flex items-center">
            <span className="animate-pulse mr-2">●</span>
            {buttonLabel}
          </span>
        ) : (
          buttonLabel
        )}
      </button>

      {liveStatusLabel && (
        <div className="mt-4 text-sm tracking-[0.18em] uppercase text-white/65 text-center">
          {liveStatusLabel}
        </div>
      )}

      <button
        onClick={resetConversation}
        disabled={!isConnected || isBusy}
        className="mt-4 border border-white/20 rounded-full px-6 py-2 text-sm text-white/80 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Reinitialiser la conversation
      </button>

      {audioError && <div className="mt-4 text-red-400 text-center">{audioError}</div>}
    </div>
  );
}

export default Jarvis;
