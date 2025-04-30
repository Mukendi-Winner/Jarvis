import { Link } from 'react-router-dom';

function NotFound() {
  return (
    <div 
      className="h-screen flex flex-col items-center justify-center text-white p-6"
      style={{
        background: 'linear-gradient(31deg, rgba(4, 12, 17, 1) 6%, rgba(10, 5, 48, 1) 15%, rgba(12, 62, 4, 1) 100%, rgba(28, 28, 28, 1) 78%, rgba(6, 6, 36, 1) 48%, rgba(4, 28, 7, 1) 90%, rgba(12, 12, 60, 1) 38%, rgba(16, 64, 44, 1) 82%)',
        boxShadow: 'inset 0 0 50px rgba(0,0,0,0.7)'
      }}
    >
      
      <div className="mb-12">
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

      {/* Message d'erreur */}
      <h1 className="text-5xl font-bold mb-6 text-center">404</h1>
      <h2 className="text-2xl font-medium mb-8 text-center">Page non trouvée</h2>
      <p className="text-lg mb-10 text-center max-w-md">
        Oups ! La page que vous cherchez semble introuvable.
      </p>

      {/* Bouton de retour */}
      <Link 
        to="/" 
        className="border border-[#0A9396] text-[#0A9396] rounded-full px-8 py-3 text-lg hover:bg-[#0A9396] hover:text-black transition-colors"
      >
        Retour à l'accueil
      </Link>
    </div>
  );
}

export default NotFound;