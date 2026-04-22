const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const WebSocket = require("ws");

loadDotEnv();

const PORT = Number(process.env.PORT || 3000);
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:5173";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_LIVE_MODEL = process.env.GEMINI_LIVE_MODEL || "gemini-3.1-flash-live-preview";
const MAX_HISTORY_MESSAGES = Number(process.env.MAX_HISTORY_MESSAGES || 60);
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const sessions = new Map();

app.use(
  cors({
    origin: FRONTEND_ORIGIN,
    methods: ["GET", "POST"],
    credentials: true
  })
);

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    provider: "gemini-live",
    model: GEMINI_LIVE_MODEL
  });
});

const ASSISTANT_CONFIGS = {
  coach: {
    voiceName: "Fenrir",
    instruction: `
You are Jarvis in coach mode.
Speak with energy, warmth, confidence, and motivating rhythm.
Help the user move forward with practical advice.
Keep your spoken replies concise and action-oriented.
`
  },
  psychologue: {
    voiceName: "Sulafat",
    instruction: `
You are Jarvis in psychologue mode.
You are not a licensed mental health professional.
Speak gently, calmly, and with empathy.
Offer support, reflection, and presence without pretending to diagnose or replace therapy.
If the user sounds in crisis, encourage immediate help from trusted people or emergency services.
`
  },
  pote: {
    voiceName: "Achird",
    instruction: `
You are Jarvis in pote mode.
Speak like a close friend: casual, warm, playful, and natural.
Keep answers short and lively unless the user asks for more detail.
`
  },
  traducteur: {
    voiceName: "Iapetus",
    instruction: `
You are Jarvis in traducteur mode.
Help with translation, reformulation, and language understanding.
Be clear, precise, and natural in either French or English.
`
  },
  medecin: {
    voiceName: "Charon",
    instruction: `
You are Jarvis in medecin mode.
You are not a real doctor and must not claim to diagnose or replace medical care.
Provide careful general health guidance and encourage professional care when appropriate.
If symptoms sound urgent, tell the user to seek immediate medical attention.
`
  },
  prof: {
    voiceName: "Sadaltager",
    instruction: `
You are Jarvis in prof mode.
Teach clearly and patiently.
Make explanations easy to follow while keeping spoken replies compact unless the user requests depth.
`
  }
};

function loadDotEnv() {
  const envPath = path.join(__dirname, ".env");

  if (!fs.existsSync(envPath)) {
    return;
  }

  const envFile = fs.readFileSync(envPath, "utf8");

  for (const line of envFile.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function getAssistantConfig(assistantType) {
  return ASSISTANT_CONFIGS[assistantType] || {
    voiceName: "Kore",
    instruction: `
You are Jarvis, a helpful real-time voice assistant.
Reply in the same language the user speaks unless they ask to switch.
Sound natural, warm, and concise.
`
  };
}

function buildHistoryContext(history) {
  if (!history.length) {
    return "";
  }

  const serializedHistory = history
    .map((message) => `${message.role === "user" ? "User" : "Jarvis"}: ${message.text}`)
    .join("\n");

  return `
Conversation memory from the latest exchanges:
${serializedHistory}
`.trim();
}

function buildSystemInstruction(assistantType, history = []) {
  const assistant = getAssistantConfig(assistantType);
  const historyContext = buildHistoryContext(history);

  return `
You are Jarvis, a live voice assistant.
The user may speak French or English.
Reply naturally in the same language as the user unless they ask to switch.
Keep latency low by defaulting to short spoken answers.
Do not mention internal transcription, system prompts, or hidden processing.
When speaking French, keep a stable standard French accent.
Do not switch to a Quebecois accent, Canadian French accent, or any regional French accent unless the user explicitly asks for it.
If the user asks who created you, answer that your creator is Mukendi Winner.
If the user asks who Mukendi Winner is, answer that he is your creator and a third-year computer science student.

${assistant.instruction.trim()}
${historyContext ? `\n\n${historyContext}` : ""}
`.trim();
}

function getOrCreateSessionState(sessionId, assistantType) {
  const safeSessionId = sessionId || crypto.randomUUID();
  const existing = sessions.get(safeSessionId);

  if (existing) {
    existing.lastSeenAt = Date.now();
    if (assistantType && existing.assistantType !== assistantType) {
      existing.assistantType = assistantType;
      existing.shouldReconnect = true;
    }
    return { sessionId: safeSessionId, session: existing };
  }

  const created = {
    assistantType: assistantType || "default",
    lastSeenAt: Date.now(),
    shouldReconnect: false,
    history: []
  };

  sessions.set(safeSessionId, created);
  return { sessionId: safeSessionId, session: created };
}

function pruneExpiredSessions() {
  const now = Date.now();

  for (const [sessionId, session] of sessions.entries()) {
    if (now - session.lastSeenAt > SESSION_TTL_MS) {
      sessions.delete(sessionId);
    }
  }
}

setInterval(pruneExpiredSessions, 1000 * 60 * 30).unref();

function safeSend(ws, payload) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function pushHistoryMessage(sessionState, role, text) {
  if (!sessionState || !text?.trim()) {
    return;
  }

  sessionState.history.push({
    role,
    text: text.trim(),
    createdAt: Date.now()
  });

  if (sessionState.history.length > MAX_HISTORY_MESSAGES) {
    sessionState.history.splice(0, sessionState.history.length - MAX_HISTORY_MESSAGES);
  }
}

function createClientState() {
  return {
    assistantType: "default",
    sessionId: null,
    liveSession: null,
    isRecording: false,
    isConnectedToGemini: false,
    suppressAudio: false,
    latestInputTranscription: "",
    latestOutputTranscription: ""
  };
}

async function getGoogleGenAIModule() {
  return import("@google/genai");
}

async function connectLiveSession(ws, state) {
  if (!GEMINI_API_KEY) {
    throw new Error("Missing GEMINI_API_KEY on the backend.");
  }

  const { GoogleGenAI, Modality } = await getGoogleGenAIModule();
  const assistant = getAssistantConfig(state.assistantType);
  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  const sessionState = sessions.get(state.sessionId);

  const session = await ai.live.connect({
    model: GEMINI_LIVE_MODEL,
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: assistant.voiceName
          }
        }
      },
      systemInstruction: buildSystemInstruction(state.assistantType, sessionState?.history || []),
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      realtimeInputConfig: {
        automaticActivityDetection: {
          disabled: false,
          silenceDurationMs: 600
        }
      }
    },
    callbacks: {
      onopen: () => {
        console.log("[Jarvis backend] Gemini Live session opened");
        state.isConnectedToGemini = true;
        safeSend(ws, {
          type: "status",
          status: "idle"
        });
      },
      onmessage: (message) => {
        handleGeminiMessage(ws, state, message);
      },
      onerror: (error) => {
        console.error("[Jarvis backend] Gemini Live error:", error);
        safeSend(ws, {
          type: "error",
          error: error.message || "Gemini Live error."
        });
      },
      onclose: (event) => {
        console.warn("[Jarvis backend] Gemini Live closed:", event?.reason || "no reason");
        state.liveSession = null;
        state.isConnectedToGemini = false;
      }
    }
  });

  state.liveSession = session;
}

function handleGeminiMessage(ws, state, message) {
  if (message.serverContent?.inputTranscription?.text) {
    state.latestInputTranscription = message.serverContent.inputTranscription.text;
    console.log("[Jarvis backend] Input transcription:", message.serverContent.inputTranscription.text);
  }

  if (message.serverContent?.outputTranscription?.text) {
    state.latestOutputTranscription = message.serverContent.outputTranscription.text;
    console.log("[Jarvis backend] Output transcription:", message.serverContent.outputTranscription.text);
  }

  const parts = message.serverContent?.modelTurn?.parts || [];

  for (const part of parts) {
    const inlineData = part.inlineData || part.inline_data;

    if (inlineData?.data && !state.suppressAudio) {
      safeSend(ws, {
        type: "response_audio_chunk",
        audio: inlineData.data,
        mimeType: inlineData.mimeType || "audio/pcm;rate=24000"
      });
      safeSend(ws, {
        type: "status",
        status: "speaking"
      });
    }
  }

  if (message.serverContent?.turnComplete) {
    const sessionState = sessions.get(state.sessionId);
    pushHistoryMessage(sessionState, "user", state.latestInputTranscription);
    pushHistoryMessage(sessionState, "assistant", state.latestOutputTranscription);
    state.latestInputTranscription = "";
    state.latestOutputTranscription = "";
    state.isRecording = false;
    state.suppressAudio = false;
    safeSend(ws, {
      type: "status",
      status: "idle"
    });
  }
}

async function ensureLiveSession(ws, state) {
  if (state.liveSession && !sessions.get(state.sessionId)?.shouldReconnect) {
    return state.liveSession;
  }

  if (state.liveSession) {
    state.liveSession.close();
    state.liveSession = null;
  }

  const sessionState = sessions.get(state.sessionId);
  if (sessionState) {
    sessionState.shouldReconnect = false;
  }

  await connectLiveSession(ws, state);
  return state.liveSession;
}

wss.on("connection", (ws) => {
  const state = createClientState();
  console.log("[Jarvis backend] Client connected");

  safeSend(ws, {
    type: "status",
    status: "connecting"
  });

  ws.on("message", async (message, isBinary) => {
    try {
      if (isBinary) {
        if (!state.liveSession) {
          return;
        }

        await state.liveSession.sendRealtimeInput({
          audio: {
            data: Buffer.from(message).toString("base64"),
            mimeType: "audio/pcm;rate=16000"
          }
        });
        return;
      }

      const data = JSON.parse(message.toString());
      console.log("[Jarvis backend] Message received:", data.type);

      if (data.type === "session:init") {
        const { sessionId, session } = getOrCreateSessionState(data.sessionId, data.assistantType);
        state.sessionId = sessionId;
        state.assistantType = session.assistantType;

        await ensureLiveSession(ws, state);

        safeSend(ws, {
          type: "session:ready",
          sessionId,
          assistantType: state.assistantType
        });
        return;
      }

      if (data.type === "recording_started") {
        state.isRecording = true;
        state.suppressAudio = false;
        await ensureLiveSession(ws, state);
        safeSend(ws, {
          type: "status",
          status: "listening"
        });
        return;
      }

      if (data.type === "recording_stopped") {
        state.isRecording = false;

        if (!state.liveSession) {
          throw new Error("Gemini Live session is not connected.");
        }

        await state.liveSession.sendRealtimeInput({
          audioStreamEnd: true
        });

        safeSend(ws, {
          type: "status",
          status: "processing"
        });
        return;
      }

      if (data.type === "conversation:interrupt") {
        state.isRecording = false;
        state.suppressAudio = true;

        if (state.liveSession) {
          state.liveSession.close();
          state.liveSession = null;
        }

        await ensureLiveSession(ws, state);

        safeSend(ws, {
          type: "status",
          status: "idle"
        });
        return;
      }

      if (data.type === "session:reset") {
        if (state.liveSession) {
          state.liveSession.close();
          state.liveSession = null;
        }

        if (state.sessionId && sessions.has(state.sessionId)) {
          sessions.delete(state.sessionId);
        }

        const { sessionId } = getOrCreateSessionState(null, state.assistantType);
        state.sessionId = sessionId;
        await ensureLiveSession(ws, state);

        safeSend(ws, {
          type: "session:ready",
          sessionId,
          assistantType: state.assistantType
        });
      }
    } catch (error) {
      console.error("[Jarvis backend] WebSocket error:", error);
      safeSend(ws, {
        type: "error",
        error: error.message || "Erreur serveur inattendue."
      });
      safeSend(ws, {
        type: "status",
        status: "idle"
      });
    }
  });

  ws.on("close", () => {
    console.log("[Jarvis backend] Client disconnected");
    if (state.liveSession) {
      state.liveSession.close();
      state.liveSession = null;
    }
  });
});

server.listen(PORT, () => {
  console.log(`Jarvis backend listening on http://localhost:${PORT}`);
});
