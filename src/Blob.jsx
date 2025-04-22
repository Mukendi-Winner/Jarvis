import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import useSpeech from './hook/useSpeech';
import useSpeechRecognition from './hook/useSpeechRecognition';

export default function Blob() {
  // Configuration vocale
  const { transcript, isListening, startListening, stopListening } = useSpeechRecognition();
  const { speak } = useSpeech();
  const [hasGreeted, setHasGreeted] = useState(false);

  // Message d'accueil UNE SEULE FOIS
  useEffect(() => {
    if (!hasGreeted) {
      const timer = setTimeout(() => {
        speak("Bonjour, je suis jarvis");
        setHasGreeted(true);
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [speak, hasGreeted]);

  // Réponses aux commandes (seulement quand on lui parle)
  useEffect(() => {
    if (!transcript || !hasGreeted) return;

    const command = transcript.toLowerCase();
    
    if (command.includes('bonjour')) {
      speak("Bonjour à vous !");
    } else if (command.includes('comment ça va')) {
      speak("Je vais bien, merci !");
    } else if (command.includes('stop')) {
      stopListening();
    }
  }, [transcript, speak, stopListening, hasGreeted]);

  // Génération des formes aléatoires (identique à avant)
  const generateBlobPath = () => {
    const center = { x: 300, y: 300 };
    const radius = 150;
    const points = 12;
    let path = '';

    for (let i = 0; i <= points; i++) {
      const angle = (i / points) * Math.PI * 2;
      const variation = radius * (0.92 + Math.random() * 0.16);
      const x = center.x + Math.cos(angle) * variation;
      const y = center.y + Math.sin(angle) * variation;

      if (i === 0) path += `M${x},${y}`;
      else path += `L${x},${y}`;
    }

    return path + 'Z';
  };

  // Animation des formes (identique)
  const [paths, setPaths] = useState([]);
  useEffect(() => {
    const initialPaths = Array.from({ length: 4 }, generateBlobPath);
    setPaths(initialPaths);

    const interval = setInterval(() => {
      setPaths(prev => {
        const newPaths = [...prev];
        const randomIndex = Math.floor(Math.random() * 4);
        newPaths[randomIndex] = generateBlobPath();
        return newPaths;
      });
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black">
      {/* Blob géant avec animations */}
      <div className="w-[140vmin] h-[140vmin] relative">
        <motion.svg
          viewBox="0 0 600 600"
          className="absolute w-full h-full"
        >
          <defs>
            <radialGradient id="blobGradient" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#7C3AED" />
              <stop offset="60%" stopColor="#5B21B6" />
              <stop offset="100%" stopColor="#1E1B4B" />
            </radialGradient>
            <filter id="goo">
              <feGaussianBlur in="SourceGraphic" stdDeviation="12" />
              <feColorMatrix values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 18 -7" />
            </filter>
          </defs>

          {paths.length > 0 && (
            <motion.path
              fill="url(#blobGradient)"
              filter="url(#goo)"
              initial={{ d: paths[0] }}
              animate={{ d: paths }}
              transition={{
                duration: 6,
                ease: "easeInOut",
                repeat: Infinity,
                repeatType: "mirror"
              }}
            />
          )}
        </motion.svg>
      </div>

      {/* Bouton de contrôle vocal */}
      <button
        onClick={isListening ? stopListening : startListening}
        className={`fixed bottom-10 z-50 px-6 py-3 rounded-full text-lg font-bold shadow-lg transition-all ${
          isListening 
            ? 'bg-red-500 hover:bg-red-600 text-white' 
            : 'bg-purple-600 hover:bg-purple-700 text-white'
        }`}
      >
        {isListening ? '🛑 Arrêter' : '🎤 Parler à jarvis'}
      </button>
    </div>
  );
}