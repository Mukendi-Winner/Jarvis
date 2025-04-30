import { useEffect } from 'react'
import { useNavigate, Outlet } from 'react-router-dom'

function App() {
  const navigate = useNavigate()

  useEffect(() => {
    if (!localStorage.getItem('userName')) {  // Parenthèse fermante ajoutée ici
      navigate('/')
    }
  }, [navigate])

  return (
    <div className="app">
      <Outlet />
    </div>
  )
}

export default App