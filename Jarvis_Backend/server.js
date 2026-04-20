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
const GEMINI_TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || "gemini-3-flash-preview";
const GEMINI_TTS_MODEL = process.env.GEMINI_TTS_MODEL || "gemini-3.1-flash-tts-preview";
const MAX_HISTORY_MESSAGES = 20;
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;
const MAX_INLINE_AUDIO_BYTES = 18 * 1024 * 1024;

const app = express();

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
    provider: "gemini",
    textModel: GEMINI_TEXT_MODEL,
    ttsModel: GEMINI_TTS_MODEL
  });
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const sessions = new Map();

const ASSISTANT_CONFIGS = {
  coach: {
    label: "coach",
    voiceName: "Fenrir",
    speakingStyle:
      "Speak with energy, warmth, confidence, and motivating rhythm. Sound like a supportive performance coach.",
    instruction: `
You are Jarvis in coach mode.
Your role is to energize, encourage, and help the user move forward with practical advice.
Sound motivating, direct, and supportive without being harsh.
Keep spoken answers concise and natural for voice conversation.
`
  },
  psychologue: {
    label: "psychologue",
    voiceName: "Sulafat",
    speakingStyle:
      "Speak gently, calmly, with empathy and steady pacing. Sound deeply present and reassuring.",
    instruction: `
You are Jarvis in psychologue mode.
You are not a licensed mental health professional.
If the user seeks emotional support, listen carefully, validate feelings, and respond with empathy.
If there are signs of crisis, self-harm, or danger, encourage immediate help from trusted people or emergency services.
Do not claim to diagnose or replace therapy.
Keep the tone warm, calming, and human.
`
  },
  pote: {
    label: "pote",
    voiceName: "Achird",
    speakingStyle:
      "Speak casually, naturally, and warmly like a close friend. Sound relaxed and friendly.",
    instruction: `
You are Jarvis in pote mode.
Speak like a close friend: casual, warm, playful, and natural.
Be supportive and easy to talk to.
Avoid sounding robotic or overly formal.
Keep answers compact and conversational.
`
  },
  traducteur: {
    label: "traducteur",
    voiceName: "Iapetus",
    speakingStyle:
      "Speak clearly, professionally, and at a measured pace with excellent articulation.",
    instruction: `
You are Jarvis in traducteur mode.
Help with translation, reformulation, and language understanding.
Be precise, clear, and natural.
When the user is not asking for translation, still respond helpfully and conversationally.
`
  },
  medecin: {
    label: "medecin",
    voiceName: "Charon",
    speakingStyle:
      "Speak calmly, clearly, and reassuringly, with careful and measured delivery.",
    instruction: `
You are Jarvis in medecin mode.
You are not a real doctor and must not claim to diagnose, prescribe, or replace medical care.
You can provide general health information, suggest caution, and encourage professional care when appropriate.
If symptoms sound urgent or dangerous, advise the user to contact emergency services or a clinician immediately.
Keep the tone calm, clear, and reassuring.
`
  },
  prof: {
    label: "prof",
    voiceName: "Sadaltager",
    speakingStyle:
      "Speak clearly, confidently, and in an engaging teaching style with smooth pacing.",
    instruction: `
You are Jarvis in prof mode.
Teach clearly and patiently.
Break down ideas simply, but keep the spoken answer short enough for audio conversation unless the user asks for a deep explanation.
Be encouraging and easy to follow.
`
  }
};

function getAssistantConfig(assistantType) {
  return ASSISTANT_CONFIGS[assistantType] || {
    label: "assistant",
    voiceName: "Kore",
    speakingStyle:
      "Speak naturally, warmly, and clearly like a polished conversational AI assistant.",
    instruction: `
You are Jarvis, a helpful voice assistant.
Keep answers concise, natural, and easy to listen to.
`
  };
}

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

function getOrCreateSession(sessionId, assistantType) {
  const safeSessionId = sessionId || crypto.randomUUID();
  const existing = sessions.get(safeSessionId);

  if (existing) {
    existing.lastSeenAt = Date.now();
    if (assistantType && existing.assistantType !== assistantType) {
      existing.assistantType = assistantType;
      existing.history = [];
    }
    return { sessionId: safeSessionId, session: existing };
  }

  const created = {
    assistantType: assistantType || "default",
    history: [],
    lastSeenAt: Date.now()
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

function pushHistoryMessage(session, role, text) {
  if (!text) {
    return;
  }

  session.history.push({
    role,
    text,
    createdAt: Date.now()
  });

  if (session.history.length > MAX_HISTORY_MESSAGES) {
    session.history.splice(0, session.history.length - MAX_HISTORY_MESSAGES);
  }
}

function buildSystemInstruction(assistantType) {
  const assistant = getAssistantConfig(assistantType);

  return `
You are Jarvis, a real-time voice assistant.
Reply in the same language the user speaks unless they ask you to switch.
The user may speak French or English.
The user never sees the transcription, so answer as if this is a natural spoken conversation.
Keep most replies between 1 and 4 short paragraphs or a few sentences for low-latency speech.
Do not mention hidden internal steps like transcription or TTS.
If you are unsure, ask one concise follow-up question.

${assistant.instruction.trim()}
`.trim();
}

function buildContents(history, audioBase64, mimeType) {
  const contents = history.map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.text }]
  }));

  contents.push({
    role: "user",
    parts: [
      {
        text: [
          "Listen to the user's latest audio message and answer naturally.",
          "Infer the language from the audio and respond in that language unless the user asks otherwise.",
          "Return your output using exactly these XML tags and nothing outside them:",
          "<assistant_reply>your spoken reply</assistant_reply>",
          "<user_memory>a concise summary of what the user just said</user_memory>"
        ].join(" ")
      },
      {
        inlineData: {
          mimeType,
          data: audioBase64
        }
      }
    ]
  });

  return contents;
}

async function callGeminiGenerateContent({ systemInstruction, contents }) {
  if (!GEMINI_API_KEY) {
    throw new Error("Missing GEMINI_API_KEY on the backend.");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TEXT_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemInstruction }]
        },
        contents,
        generationConfig: {
          temperature: 0.7,
          topP: 0.9,
          maxOutputTokens: 768
        }
      })
    }
  );

  const payload = await response.json();

  if (!response.ok) {
    const errorMessage =
      payload?.error?.message || `Gemini text request failed with status ${response.status}`;
    throw new Error(errorMessage);
  }

  const candidate = payload?.candidates?.[0];
  const parts = candidate?.content?.parts || [];
  const rawText = parts
    .map((part) => part.text)
    .filter(Boolean)
    .join("\n")
    .trim();

  if (!rawText) {
    throw new Error("Gemini returned an empty text response.");
  }

  const assistantReply =
    rawText.match(/<assistant_reply>([\s\S]*?)<\/assistant_reply>/i)?.[1]?.trim() || rawText;
  const userMemory =
    rawText.match(/<user_memory>([\s\S]*?)<\/user_memory>/i)?.[1]?.trim() ||
    "User sent a voice message.";

  return {
    assistantReply,
    userMemory
  };
}

async function callGeminiTTS({ text, assistantType }) {
  if (!GEMINI_API_KEY) {
    throw new Error("Missing GEMINI_API_KEY on the backend.");
  }

  const assistant = getAssistantConfig(assistantType);
  const ttsPrompt = [
    "Speak the following response exactly as written.",
    "Do not add or remove words.",
    assistant.speakingStyle,
    "Keep the language and pronunciation aligned with the text.",
    "",
    text
  ].join("\n");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TTS_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: ttsPrompt }]
          }
        ],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: assistant.voiceName
              }
            }
          }
        }
      })
    }
  );

  const payload = await response.json();

  if (!response.ok) {
    const errorMessage =
      payload?.error?.message || `Gemini TTS request failed with status ${response.status}`;
    throw new Error(errorMessage);
  }

  const base64Pcm = payload?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

  if (!base64Pcm) {
    throw new Error("Gemini TTS returned no audio.");
  }

  return pcmBase64ToWavBase64(base64Pcm, 24000);
}

function pcmBase64ToWavBase64(base64Pcm, sampleRate) {
  const pcmBuffer = Buffer.from(base64Pcm, "base64");
  const wavBuffer = pcm16ToWav(pcmBuffer, sampleRate);
  return wavBuffer.toString("base64");
}

function pcm16ToWav(pcmBuffer, sampleRate) {
  const bytesPerSample = 2;
  const channels = 1;
  const byteRate = sampleRate * channels * bytesPerSample;
  const blockAlign = channels * bytesPerSample;
  const wavBuffer = Buffer.alloc(44 + pcmBuffer.length);

  wavBuffer.write("RIFF", 0);
  wavBuffer.writeUInt32LE(36 + pcmBuffer.length, 4);
  wavBuffer.write("WAVE", 8);
  wavBuffer.write("fmt ", 12);
  wavBuffer.writeUInt32LE(16, 16);
  wavBuffer.writeUInt16LE(1, 20);
  wavBuffer.writeUInt16LE(channels, 22);
  wavBuffer.writeUInt32LE(sampleRate, 24);
  wavBuffer.writeUInt32LE(byteRate, 28);
  wavBuffer.writeUInt16LE(blockAlign, 32);
  wavBuffer.writeUInt16LE(16, 34);
  wavBuffer.write("data", 36);
  wavBuffer.writeUInt32LE(pcmBuffer.length, 40);
  pcmBuffer.copy(wavBuffer, 44);

  return wavBuffer;
}

function safeSend(ws, payload) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function createClientState() {
  return {
    sessionId: null,
    assistantType: "default",
    mimeType: "audio/webm",
    audioChunks: [],
    isProcessing: false
  };
}

wss.on("connection", (ws) => {
  const state = createClientState();
  console.log("[Jarvis backend] Client connected");

  safeSend(ws, {
    type: "status",
    status: "connected"
  });

  ws.on("message", async (message, isBinary) => {
    try {
      if (isBinary) {
        console.log("[Jarvis backend] Audio chunk received:", message.length, "bytes");
        state.audioChunks.push(Buffer.from(message));
        return;
      }

      let data;

      try {
        data = JSON.parse(message.toString());
      } catch {
        if (Buffer.isBuffer(message) && message.length > 0) {
          console.log("[Jarvis backend] Non-JSON buffer treated as audio chunk:", message.length, "bytes");
          state.audioChunks.push(Buffer.from(message));
          return;
        }

        throw new Error("Message WebSocket invalide.");
      }

      console.log("[Jarvis backend] Message received:", data.type);

      if (data.type === "session:init") {
        const { sessionId, session } = getOrCreateSession(data.sessionId, data.assistantType);
        state.sessionId = sessionId;
        state.assistantType = session.assistantType;
        state.mimeType = data.mimeType || state.mimeType;

        safeSend(ws, {
          type: "session:ready",
          sessionId,
          assistantType: state.assistantType
        });
        return;
      }

      if (data.type === "recording_started") {
        console.log("[Jarvis backend] Recording started");
        state.audioChunks = [];
        state.mimeType = data.mimeType || state.mimeType;
        safeSend(ws, {
          type: "status",
          status: "listening"
        });
        return;
      }

      if (data.type === "recording_stopped") {
        console.log("[Jarvis backend] Recording stopped with", state.audioChunks.length, "chunks");
        if (state.isProcessing) {
          safeSend(ws, {
            type: "error",
            error: "Jarvis traite deja une demande."
          });
          return;
        }

        if (!state.sessionId) {
          const { sessionId } = getOrCreateSession(null, data.assistantType || state.assistantType);
          state.sessionId = sessionId;
        }

        state.assistantType = data.assistantType || state.assistantType;
        state.mimeType = data.mimeType || state.mimeType;

        const audioBuffer = Buffer.concat(state.audioChunks);
        state.audioChunks = [];
        console.log("[Jarvis backend] Audio buffer size:", audioBuffer.length, "bytes");

        if (!audioBuffer.length) {
          console.warn("[Jarvis backend] No audio received before stop");
          safeSend(ws, {
            type: "error",
            error: "Aucun audio n'a ete recu."
          });
          return;
        }

        if (audioBuffer.length > MAX_INLINE_AUDIO_BYTES) {
          safeSend(ws, {
            type: "error",
            error: "Le message audio est trop long. Essayez un message plus court."
          });
          return;
        }

        const { session } = getOrCreateSession(state.sessionId, state.assistantType);
        session.lastSeenAt = Date.now();
        state.isProcessing = true;

        safeSend(ws, {
          type: "status",
          status: "processing"
        });
        console.log("[Jarvis backend] Sending audio to Gemini text model");

        const audioBase64 = audioBuffer.toString("base64");
        const systemInstruction = buildSystemInstruction(state.assistantType);
        const contents = buildContents(session.history, audioBase64, state.mimeType);

        const responsePayload = await callGeminiGenerateContent({
          systemInstruction,
          contents
        });

        pushHistoryMessage(session, "user", responsePayload.userMemory);
        pushHistoryMessage(session, "assistant", responsePayload.assistantReply);

        safeSend(ws, {
          type: "status",
          status: "speaking"
        });
        console.log("[Jarvis backend] Sending text to Gemini TTS");

        const wavBase64 = await callGeminiTTS({
          text: responsePayload.assistantReply,
          assistantType: state.assistantType
        });

        safeSend(ws, {
          type: "response_audio",
          audio: wavBase64,
          mimeType: "audio/wav"
        });
        console.log("[Jarvis backend] Response audio sent to client");

        safeSend(ws, {
          type: "status",
          status: "idle"
        });

        state.isProcessing = false;
        return;
      }

      if (data.type === "session:reset") {
        if (state.sessionId && sessions.has(state.sessionId)) {
          sessions.get(state.sessionId).history = [];
          sessions.get(state.sessionId).lastSeenAt = Date.now();
        }

        safeSend(ws, {
          type: "status",
          status: "idle"
        });
      }
    } catch (error) {
      console.error("[Jarvis backend] WebSocket handling error:", error);
      state.isProcessing = false;
      state.audioChunks = [];

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
  });
});

server.listen(PORT, () => {
  console.log(`Jarvis backend listening on http://localhost:${PORT}`);
});
