import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";

// Solution alternative sans mic-recorder-to-mp3
const useRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [blob, setBlob] = useState(null);
  const mediaRecorder = useRef(null);
  const audioChunks = useRef([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream);
      audioChunks.current = [];
      
      mediaRecorder.current.ondataavailable = (e) => {
        audioChunks.current.push(e.data);
      };
      
      mediaRecorder.current.onstop = () => {
        const audioBlob = new Blob(audioChunks.current, { type: 'audio/mpeg' });
        setBlob(audioBlob);
      };
      
      mediaRecorder.current.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Erreur d'enregistrement:", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current) {
      mediaRecorder.current.stop();
      setIsRecording(false);
      mediaRecorder.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  return { isRecording, blob, startRecording, stopRecording };
};

function Jarvis() {
  const { assistantType } = useParams();
  const [fullText, setFullText] = useState("");
  const [index, setIndex] = useState(0);
  const [scale, setScale] = useState(1);
  const [audioError, setAudioError] = useState(null);
  const animationRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  
  const { 
    isRecording, 
    blob,
    startRecording, 
    stopRecording 
  } = useRecorder();

  const userName = localStorage.getItem('userName') || '';

  // Messages des assistants
  useEffect(() => {
    const assistantTexts = {
      coach: `${userName ? `${userName}, ` : ''}Je suis votre coach\nPrêt pour votre séance ?\nQuel exercice souhaitez-vous faire ?`,
      psychologue: `${userName ? `${userName}, ` : ''}Je suis là pour vous écouter\nParlez-moi de ce qui vous tracasse\nVotre bien-être est important`,
      pote: `Salut ${userName || 'mon pote'} !\nQuoi de neuf aujourd'hui ?\nOn fait une activité ensemble ?`,
      traducteur: `${userName ? `${userName}, ` : ''}Traducteur professionnel\nQuelle langue voulez-vous traduire ?\nJe peux vous aider`,
      medecin: `${userName ? `Dr. ${userName}` : 'Docteur'}\nDécrivez vos symptômes\navec le plus de détails possible`,
      prof: `${userName ? `${userName}, ` : ''}Professeur à votre service\nQuel sujet vous pose problème ?\nJe peux vous expliquer`
    };

    setFullText(assistantTexts[assistantType] || "Bonjour, comment puis-je vous aider ?");
    setIndex(0);
  }, [assistantType, userName]);

  // Animation du texte
  useEffect(() => {
    if (index < fullText.length) {
      const timeout = setTimeout(() => {
        setIndex(index + 1);
      }, 50);
      return () => clearTimeout(timeout);
    }
  }, [index, fullText.length]);

  // Configuration audio
  const setupAudioAnalyzer = async () => {
    try {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 64;
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      
      analyzeAudio();
    } catch (err) {
      console.error("Erreur configuration audio:", err);
      setAudioError("Accès au microphone refusé. Autorisez l'accès dans les paramètres.");
    }
  };

  // Analyse du volume
  const analyzeAudio = () => {
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    
    const updateScale = () => {
      analyserRef.current.getByteFrequencyData(dataArray);
      const volume = Math.max(...dataArray) / 255;
      const newScale = 1 + (volume * 0.8);
      setScale(newScale);
      animationRef.current = requestAnimationFrame(updateScale);
    };
    
    updateScale();
  };

  // Sauvegarder l'enregistrement
  useEffect(() => {
    if (blob) {
      const audioUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = audioUrl;
      a.download = `jarvis-recording-${Date.now()}.mp3`;
      a.click();
    }
  }, [blob]);

  // Démarrer/arrêter l'enregistrement
  const toggleRecording = async () => {
    if (isRecording) {
      stopRecording();
      cancelAnimationFrame(animationRef.current);
      if (audioContextRef.current) {
        await audioContextRef.current.close();
      }
    } else {
      try {
        await startRecording();
        await setupAudioAnalyzer();
        setAudioError(null);
      } catch (err) {
        console.error("Échec démarrage enregistrement:", err);
        setAudioError("Échec de l'enregistrement. Réessayez.");
      }
    }
  };

  return (
    <div className="h-screen flex flex-col justify-start pt-16 items-center text-white px-6 overflow-hidden"
      style={{
        background: 'linear-gradient(31deg, rgba(4, 12, 17, 1) 6%, rgba(10, 5, 48, 1) 15%, rgba(12, 62, 4, 1) 100%, rgba(28, 28, 28, 1) 78%, rgba(6, 6, 36, 1) 48%, rgba(4, 28, 7, 1) 90%, rgba(12, 12, 60, 1) 38%, rgba(16, 64, 44, 1) 82%)',
        boxShadow: 'inset 0 0 50px rgba(0,0,0,0.7)'
      }}>

      {userName && (
        <h2 className="text-2xl font-light mb-8 self-start">Bonjour {userName}</h2>
      )}

      <div className="text-3xl font-medium text-center mb-12 min-h-[8rem] leading-relaxed whitespace-pre-line">
        {fullText.substring(0, index)}
        <span className="animate-pulse">|</span>
      </div>

      <div className="mb-12">
        <div className="relative mx-auto transition-transform duration-100"
          style={{ 
            width: '160px', 
            height: '160px',
            transform: `scale(${scale})`
          }}>
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
        className={`mt-6 border rounded-full px-8 py-3 text-lg transition-colors ${
          isRecording 
            ? 'bg-red-600 border-red-600 text-white' 
            : 'border-[#0A9396] text-[#0A9396] hover:bg-[#0A9396] hover:text-black'
        }`}
      >
        {isRecording ? (
          <span className="flex items-center">
            <span className="animate-pulse mr-2">●</span>
            Enregistrement en cours...
          </span>
        ) : (
          '🎤 Parler à Jarvis'
        )}
      </button>

      {audioError && (
        <div className="mt-4 text-red-400 text-center">
          {audioError}
        </div>
      )}
    </div>
  );
}

export default Jarvis;