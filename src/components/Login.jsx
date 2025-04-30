import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

function Login() {
  const [name, setName] = useState('')
  const navigate = useNavigate()

  const handleSubmit = (e) => {
    e.preventDefault()
    if (name.trim()) {
      localStorage.setItem('userName', name.trim())
      navigate('/welcome')
    }
  }

  return (
    <div 
      className="h-screen flex flex-col items-center justify-center text-white p-6"
      style={{
        background: 'linear-gradient(31deg, rgba(4, 12, 17, 1) 6%, rgba(10, 5, 48, 1) 15%, rgba(12, 62, 4, 1) 100%, rgba(28, 28, 28, 1) 78%, rgba(6, 6, 36, 1) 48%, rgba(4, 28, 7, 1) 90%, rgba(12, 12, 60, 1) 38%, rgba(16, 64, 44, 1) 82%)',
        boxShadow: 'inset 0 0 50px rgba(0,0,0,0.7)'
      }}
    >
      <div className="w-full max-w-md">
        {/* Animation vidéo */}
        <div className="mb-12 mx-auto w-32 h-32">
          <div className="relative w-full h-full">
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

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-xl font-medium mb-2">
              Quel est votre prénom ?
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 bg-black bg-opacity-30 border border-[#0A9396] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0A9396]"
              placeholder="Entrez votre prénom"
              required
              autoFocus
            />
          </div>
          <button
            type="submit"
            className="w-full border border-[#0A9396] text-[#0A9396] rounded-full px-6 py-3 text-lg hover:bg-[#0A9396] hover:text-black transition-colors"
          >
            Continuer
          </button>
        </form>
      </div>
    </div>
  )
}

export default Login