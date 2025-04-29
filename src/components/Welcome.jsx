import { useEffect, useState } from "react";

function Welcome() {
  const fullText = "Bonjour ariel, je suis ton assistant vocal";
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (index < fullText.length) {
      const timeout = setTimeout(() => {
        setIndex(index + 1);
      }, 150);
      return () => clearTimeout(timeout);
    }
  }, [index]);

  const displayedText = fullText.substring(0, index);
   
  return (
    <div 
      className="h-screen flex flex-col justify-start pt-16 md:pt-24 items-center text-white px-4 overflow-hidden"
      style={{
        background: 'linear-gradient(31deg, rgba(4, 12, 17, 1) 6%, rgba(10, 5, 48, 1) 15%, rgba(12, 62, 4, 1) 100%, rgba(28, 28, 28, 1) 78%, rgba(6, 6, 36, 1) 48%, rgba(4, 28, 7, 1) 90%, rgba(12, 12, 60, 1) 38%, rgba(16, 64, 44, 1) 82%)',
        boxShadow: 'inset 0 0 50px rgba(0,0,0,0.7)'
      }}
    >
      {/* Texte avec animation de frappe */}
      <h1 className="text-2xl md:text-4xl font-bold text-center mb-10 md:mb-16 min-h-[4rem] md:min-h-[6rem] leading-tight tracking-wide">
        {displayedText}
        <span className="animate-pulse">|</span>
      </h1>

      {/* Cercle avec animation vidéo - Version sans bordure noire */}
      <div className="mb-10 md:mb-14">
        <div className="relative w-32 h-32 md:w-40 md:h-40">
          {/* Gradient externe animé */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#005F73] to-[#0A9396] p-0.5 animate-pulse overflow-hidden">
            {/* Conteneur vidéo qui remplit tout l'espace */}
            <div className="absolute inset-0 rounded-full overflow-hidden">
              <video 
                autoPlay 
                loop 
                muted 
                playsInline
                className="absolute inset-0 w-full h-full object-cover"
              >
                <source src="jarvis.mp4" type="video/mp4" />
              </video>
            </div>
          </div>
        </div>
      </div>

      {/* Bouton Get Started */}
      <button className="mt-8 md:mt-12 border border-[#0A9396] text-[#0A9396] rounded-full px-8 py-2 md:px-10 md:py-2.5 text-lg hover:bg-[#0A9396] hover:text-black transition-colors">
        Get started
      </button>
    </div>
  );
}

export default Welcome;