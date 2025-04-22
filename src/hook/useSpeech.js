// src/hooks/useSpeech.js
import { useState, useEffect } from 'react';

const useSpeech = () => {
  const [voices, setVoices] = useState([]);

  // Charge les voix disponibles
  useEffect(() => {
    const updateVoices = () => {
      setVoices(window.speechSynthesis.getVoices());
    };

    updateVoices();
    window.speechSynthesis.onvoiceschanged = updateVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  const speak = (text) => {
    // Vérifie que l'API est disponible et qu'il y a des voix chargées
    if (!window.speechSynthesis || voices.length === 0) {
      console.warn('Synthèse vocale non disponible');
      return;
    }

    // Crée une nouvelle instance à chaque fois
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    utterance.rate = 1.0;

    // Trouve une voix française
    const frenchVoice = voices.find(voice => 
      voice.lang.includes('fr') || voice.lang.includes('FR')
    );

    if (frenchVoice) {
      utterance.voice = frenchVoice;
    }

    // Annule toute élocution en cours
    window.speechSynthesis.cancel();
    
    // Parle
    window.speechSynthesis.speak(utterance);
  };

  return { speak };
};

export default useSpeech;