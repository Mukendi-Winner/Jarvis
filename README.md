# Jarvis

Jarvis is a voice-first AI assistant with multiple conversation modes such as `pote`, `coach`, `psychologue`, `prof`, `medecin`, and `traducteur`.

## Architecture

- `src/` contains the Vite + React frontend.
- `Jarvis_Backend/` contains the Express + WebSocket backend.
- The frontend records the user's voice and sends audio to the backend.
- The backend sends that audio to Gemini for understanding and response generation.
- The backend then sends the Gemini reply to Gemini TTS and returns spoken audio to the frontend.
- The UI does not display the transcription or model text reply.

## Local setup

### Backend

1. Create [`Jarvis_Backend/.env`](./Jarvis_Backend/.env) from [`Jarvis_Backend/.env.example`](./Jarvis_Backend/.env.example).
2. Add your Gemini API key as `GEMINI_API_KEY`.
3. Start the backend:

```bash
cd Jarvis_Backend
npm start
```

### Frontend

1. Start the frontend:

```bash
npm run dev
```

2. The frontend expects the backend WebSocket at `ws://localhost:3000` by default.
3. For deployment, set `VITE_BACKEND_WS_URL` to your production WebSocket URL.

## Notes

- Conversation memory is kept in backend memory per session and trimmed to the last 20 messages.
- `psychologue` and `medecin` modes include guardrails so Jarvis stays supportive without pretending to be a licensed professional.
- The current implementation is optimized for a strong local demo and can later be upgraded to Gemini Live API for lower-latency streaming speech.
