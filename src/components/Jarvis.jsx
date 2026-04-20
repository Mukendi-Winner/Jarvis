import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";

const WS_URL =
  import.meta.env.VITE_BACKEND_WS_URL ||
  `${window.location.protocol === "https:" ? "wss" : "ws"}://localhost:3000`;

const SESSION_STORAGE_PREFIX = "jarvis-session";

function useRecorder({ assistantType, onMessage }) {
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState("connecting");
  const [isConnected, setIsConnected] = useState(false);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const wsRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const currentAssistantRef = useRef(assistantType);
  const onMessageRef = useRef(onMessage);
  const pendingStopRef = useRef(null);
  const stopFallbackTimeoutRef = useRef(null);

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

      if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
        setStatus("error");
        setIsConnected(false);
        onMessageRef.current({
          type: "error",
          error: "Connexion au serveur impossible. Verifiez le backend."
        });
        return;
      }

      const socket = new WebSocket(WS_URL);
      wsRef.current = socket;

      socket.onopen = () => {
        console.log("[Jarvis] WebSocket connected");
        reconnectAttemptsRef.current = 0;
        setIsConnected(true);
        setStatus("idle");

        const storageKey = `${SESSION_STORAGE_PREFIX}:${currentAssistantRef.current}`;
        const existingSessionId = localStorage.getItem(storageKey);

        socket.send(
          JSON.stringify({
            type: "session:init",
            sessionId: existingSessionId,
            assistantType: currentAssistantRef.current,
            mimeType: "audio/webm"
          })
        );
      };

      socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log("[Jarvis] WebSocket message:", data);

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
        console.error("[Jarvis] WebSocket error");
        setIsConnected(false);
      };

      socket.onclose = () => {
        console.warn("[Jarvis] WebSocket closed");
        setIsConnected(false);
        if (cancelled) {
          return;
        }
        reconnectAttemptsRef.current += 1;
        setStatus("connecting");
        setTimeout(connect, 1500 * reconnectAttemptsRef.current);
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;

    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";

    const recorder = new MediaRecorder(stream, { mimeType });
    mediaRecorderRef.current = recorder;
    pendingStopRef.current = null;
    console.log("[Jarvis] Starting recorder with mime type:", mimeType);

    recorder.ondataavailable = async (event) => {
      console.log("[Jarvis] ondataavailable size:", event.data.size);
      if (event.data.size === 0 || wsRef.current?.readyState !== WebSocket.OPEN) {
        return;
      }

      const arrayBuffer = await event.data.arrayBuffer();
      wsRef.current.send(new Uint8Array(arrayBuffer));
      console.log("[Jarvis] Audio chunk sent:", arrayBuffer.byteLength, "bytes");

      if (pendingStopRef.current) {
        if (stopFallbackTimeoutRef.current) {
          clearTimeout(stopFallbackTimeoutRef.current);
          stopFallbackTimeoutRef.current = null;
        }

        wsRef.current.send(
          JSON.stringify({
            type: "recording_stopped",
            assistantType: pendingStopRef.current.assistantType,
            mimeType: pendingStopRef.current.mimeType
          })
        );
        console.log("[Jarvis] recording_stopped sent after final chunk");
        pendingStopRef.current = null;
      }
    };

    recorder.onstop = () => {
      console.log("[Jarvis] Recorder stopped");
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;

      if (pendingStopRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
        stopFallbackTimeoutRef.current = window.setTimeout(() => {
          if (!pendingStopRef.current || wsRef.current?.readyState !== WebSocket.OPEN) {
            return;
          }

          wsRef.current.send(
            JSON.stringify({
              type: "recording_stopped",
              assistantType: pendingStopRef.current.assistantType,
              mimeType: pendingStopRef.current.mimeType
            })
          );
          console.log("[Jarvis] recording_stopped sent by fallback");
          pendingStopRef.current = null;
          stopFallbackTimeoutRef.current = null;
        }, 150);
      }
    };

    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      throw new Error("La connexion WebSocket n'est pas prete.");
    }

    wsRef.current.send(
      JSON.stringify({
        type: "recording_started",
        assistantType: currentAssistantRef.current,
        mimeType
      })
    );
    console.log("[Jarvis] recording_started sent");

    recorder.start(250);
    setIsRecording(true);
  };

  const stopRecording = () => {
    if (!mediaRecorderRef.current) {
      return;
    }

    pendingStopRef.current = {
      assistantType: currentAssistantRef.current,
      mimeType: mediaRecorderRef.current.mimeType || "audio/webm"
    };
    console.log("[Jarvis] stop requested");

    if (mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.requestData();
    }

    mediaRecorderRef.current.stop();
    mediaRecorderRef.current = null;
    setIsRecording(false);
  };

  const resetConversation = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "session:reset" }));
    }
  };

  useEffect(() => {
    return () => {
      if (stopFallbackTimeoutRef.current) {
        clearTimeout(stopFallbackTimeoutRef.current);
      }
      if (mediaRecorderRef.current?.state !== "inactive") {
        mediaRecorderRef.current?.stop();
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return {
    isConnected,
    isRecording,
    status,
    startRecording,
    stopRecording,
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
  const analyserRef = useRef(null);
  const meterContextRef = useRef(null);
  const meterStreamRef = useRef(null);
  const playbackAudioRef = useRef(null);
  const playbackUrlRef = useRef(null);
  const playbackContextRef = useRef(null);
  const playbackSourceRef = useRef(null);

  const userName = localStorage.getItem("userName") || "";

  const handleMessage = (data) => {
    if (data.type === "status") {
      setServerStatus(data.status);
      if (data.status === "idle") {
        setAudioError(null);
      }
      return;
    }

    if (data.type === "response_audio" && data.audio) {
      playResponseAudio(data.audio, data.mimeType || "audio/wav");
      return;
    }

    if (data.type === "error") {
      setAudioError(data.error || "Une erreur est survenue.");
      setServerStatus("idle");
    }
  };

  const { isRecording, status, isConnected, startRecording, stopRecording, resetConversation } =
    useRecorder({
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

  const stopMeter = async () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    meterStreamRef.current?.getTracks().forEach((track) => track.stop());
    meterStreamRef.current = null;

    if (meterContextRef.current) {
      await meterContextRef.current.close();
      meterContextRef.current = null;
    }

    analyserRef.current = null;
    setScale(1);
  };

  const startMeter = async () => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 64;

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const source = audioContext.createMediaStreamSource(stream);

    source.connect(analyser);

    meterContextRef.current = audioContext;
    analyserRef.current = analyser;
    meterStreamRef.current = stream;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const animate = () => {
      analyser.getByteFrequencyData(dataArray);
      const volume = Math.max(...dataArray) / 255;
      setScale(1 + volume * 0.8);
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();
  };

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

    return playbackContextRef.current;
  };

  const playResponseAudio = async (base64Audio, mimeType) => {
    console.log("[Jarvis] Attempting response playback with mime type:", mimeType);

    if (playbackSourceRef.current) {
      playbackSourceRef.current.stop();
      playbackSourceRef.current = null;
    }

    if (playbackAudioRef.current) {
      playbackAudioRef.current.pause();
      playbackAudioRef.current = null;
    }

    if (playbackUrlRef.current) {
      URL.revokeObjectURL(playbackUrlRef.current);
      playbackUrlRef.current = null;
    }

    const byteCharacters = atob(base64Audio);
    const byteArray = new Uint8Array(byteCharacters.length);

    for (let i = 0; i < byteCharacters.length; i += 1) {
      byteArray[i] = byteCharacters.charCodeAt(i);
    }

    try {
      const playbackContext = await ensurePlaybackContext();

      if (playbackContext) {
        const decodedBuffer = await playbackContext.decodeAudioData(byteArray.buffer.slice(0));
        const source = playbackContext.createBufferSource();
        source.buffer = decodedBuffer;
        source.connect(playbackContext.destination);
        source.onended = () => {
          setIsPlaying(false);
          setServerStatus("idle");
          if (playbackSourceRef.current === source) {
            playbackSourceRef.current = null;
          }
        };

        playbackSourceRef.current = source;
        setIsPlaying(true);
        source.start(0);
        console.log("[Jarvis] Playback started through AudioContext");
        return;
      }
    } catch (error) {
      console.warn("[Jarvis] AudioContext playback failed, falling back to HTMLAudio:", error);
    }

    const blob = new Blob([byteArray], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);

    playbackUrlRef.current = url;
    playbackAudioRef.current = audio;

    audio.onplay = () => setIsPlaying(true);
    audio.onended = () => {
      setIsPlaying(false);
      setServerStatus("idle");
      URL.revokeObjectURL(url);
      if (playbackUrlRef.current === url) {
        playbackUrlRef.current = null;
      }
    };
    audio.onerror = () => {
      console.error("[Jarvis] HTMLAudio playback failed");
      setIsPlaying(false);
      setAudioError("Lecture audio impossible sur cet appareil.");
    };

    try {
      await audio.play();
      console.log("[Jarvis] Playback started through HTMLAudio fallback");
    } catch (error) {
      console.error("[Jarvis] HTMLAudio play() rejected:", error);
      setAudioError("La lecture audio est bloquee sur ce telephone.");
      setIsPlaying(false);
      setServerStatus("idle");
    }
  };

  const toggleRecording = async () => {
    if (isRecording) {
      stopRecording();
      await stopMeter();
      return;
    }

    try {
      setAudioError(null);

      if (!isConnected) {
        setAudioError("Connexion au serveur en attente.");
        return;
      }

      if (playbackAudioRef.current) {
        playbackAudioRef.current.pause();
        playbackAudioRef.current.currentTime = 0;
        setIsPlaying(false);
      }

      await ensurePlaybackContext();
      await startRecording();
      await startMeter();
    } catch {
      setAudioError("Impossible de lancer le micro. Verifiez les permissions.");
      await stopMeter();
    }
  };

  useEffect(() => {
    return () => {
      stopMeter();
      if (playbackSourceRef.current) {
        playbackSourceRef.current.stop();
      }
      if (playbackAudioRef.current) {
        playbackAudioRef.current.pause();
      }
      if (playbackUrlRef.current) {
        URL.revokeObjectURL(playbackUrlRef.current);
      }
      if (playbackContextRef.current && playbackContextRef.current.state !== "closed") {
        playbackContextRef.current.close();
      }
    };
  }, []);

  const isBusy = isRecording || serverStatus === "processing" || serverStatus === "speaking";

  const buttonLabel = (() => {
    if (isRecording) {
      return "Appuyez pour arreter";
    }
    if (!isConnected) {
      return "Connexion au serveur...";
    }
    if (serverStatus === "processing") {
      return "Jarvis reflechit...";
    }
    if (serverStatus === "speaking") {
      return "Jarvis vous repond...";
    }
    return "Parler a Jarvis";
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

      <button
        onClick={resetConversation}
        disabled={!isConnected || isBusy}
        className="mt-4 border border-white/20 rounded-full px-6 py-2 text-sm text-white/80 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Reinitialiser la conversation
      </button>

      {isPlaying && <div className="mt-4 text-green-400 text-center">Lecture de la reponse...</div>}

      {audioError && <div className="mt-4 text-red-400 text-center">{audioError}</div>}
    </div>
  );
}

export default Jarvis;
