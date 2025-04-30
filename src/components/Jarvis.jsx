import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
const userName = localStorage.getItem('userName') || ''
function Jarvis() {
  const { assistantType } = useParams();
  const [fullText, setFullText] = useState("");
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const assistantTexts = {
      coach: "Coach, comment je dois\ngerer mon alimentation\npour perdre du poids",
      psychologue: "Psychologue, j'ai besoin\nde parler de mon stress\net de mon anxiété",
      pote: "Hey mon pote, ça fait\nlongtemps qu'on s'est pas vus\nTu veux qu'on sorte ce soir?",
      traducteur: "Traducteur, j'ai besoin\nd'aide pour comprendre\ncet article en anglais",
      medecin: "Docteur, je ressens\nune douleur étrange\ndans le bas du dos",
      prof: "Professeur, je n'arrive pas\nà comprendre ce théorème\npouvez-vous m'expliquer?"
    };

    setFullText(assistantTexts[assistantType] || "Bonjour, comment puis-je vous aider?");
    setIndex(0);
  }, [assistantType]);

  useEffect(() => {
    if (index < fullText.length) {
      const timeout = setTimeout(() => {
        setIndex(index + 1);
      }, 50);
      return () => clearTimeout(timeout);
    }
  }, [index, fullText.length]);

  const displayedText = fullText.substring(0, index);
  
  return (
    <div 
      className="h-screen flex flex-col justify-start pt-16 items-center text-white px-6 overflow-hidden"
      style={{
        background: 'linear-gradient(31deg, rgba(4, 12, 17, 1) 6%, rgba(10, 5, 48, 1) 15%, rgba(12, 62, 4, 1) 100%, rgba(28, 28, 28, 1) 78%, rgba(6, 6, 36, 1) 48%, rgba(4, 28, 7, 1) 90%, rgba(12, 12, 60, 1) 38%, rgba(16, 64, 44, 1) 82%)',
        boxShadow: 'inset 0 0 50px rgba(0,0,0,0.7)'
      }}
    >
      <h2 className="text-2xl font-light mb-8 self-start">{userName}</h2>
      
      <div className="text-3xl font-medium text-center mb-12 min-h-[8rem] leading-relaxed whitespace-pre-line">
        {displayedText}
        <span className="animate-pulse">|</span>
      </div>

      {/* Partie vidéo corrigée - identique à Welcome */}
      <div className="mb-24 sm:mb-32 md:mb-24">
        <div className="relative w-32 h-32 md:w-40 md:h-40">
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
    </div>
  );
}

export default Jarvis;