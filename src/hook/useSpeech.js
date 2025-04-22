const useSpeech = (text) => {
    const speak = () => {
      // Vérifie si l'API est disponible
      if (!window.speechSynthesis) {
        console.warn("Speech Synthesis API not supported");
        return;
      }
  
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "fr-FR";
      utterance.rate = 0.9; // Vitesse légèrement réduite
  
      // Attendre que les voix soient chargées
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        const frenchVoice = voices.find(voice => voice.lang === "fr-FR" || voice.lang === "fr");
        if (frenchVoice) {
          utterance.voice = frenchVoice;
        }
        window.speechSynthesis.speak(utterance);
      } else {
        window.speechSynthesis.onvoiceschanged = () => {
          const voices = window.speechSynthesis.getVoices();
          const frenchVoice = voices.find(voice => voice.lang === "fr-FR" || voice.lang === "fr");
          if (frenchVoice) {
            utterance.voice = frenchVoice;
          }
          window.speechSynthesis.speak(utterance);
        };
      }
    };
  
    return speak;
  };

export default useSpeech;
