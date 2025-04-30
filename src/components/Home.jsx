import { Link } from 'react-router-dom';

function Home() {
  const assistants = [
    { name: 'Traducteur', emoji: '🌐', type: 'traducteur' },
    { name: 'Medecin', emoji: '⚕️', type: 'medecin' },
    { name: 'Psychologue', emoji: '🧠', type: 'psychologue' },
    { name: 'Pote', emoji: '👋', type: 'pote' },
    { name: 'Coach', emoji: '💪', type: 'coach' },
    { name: 'Prof', emoji: '📚', type: 'prof' }
  ];

  return (
    <div 
      className="min-h-screen flex flex-col items-center justify-center text-white p-6"
      style={{
        background: 'linear-gradient(31deg, rgba(4, 12, 17, 1) 6%, rgba(10, 5, 48, 1) 15%, rgba(0,0,0,1) 100%, rgba(28, 28, 28, 1) 78%, rgba(6, 6, 36, 1) 48%, rgba(4, 28, 7, 1) 90%, rgba(12, 12, 60, 1) 38%, rgba(54,4,62,1) 82%)',
        boxShadow: 'inset 0 0 50px rgba(0,0,0,0.7)'
      }}
    >
      <h1 className="text-4xl font-bold mb-12 text-center">Choisis ton assistant</h1>
      
      <div className="grid grid-cols-2 gap-6 w-full max-w-md">
        {assistants.map((assistant, index) => (
          <Link 
            to={`/jarvis/${assistant.type}`}
            key={index}
            className="flex flex-col items-center justify-center p-6 rounded-xl bg-white bg-opacity-10 backdrop-blur-sm border border-white border-opacity-20 hover:bg-opacity-20 transition-all cursor-pointer"
          >
            <span className="text-4xl mb-2">{assistant.emoji}</span>
            <span className="text-xl">{assistant.name}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
export default Home