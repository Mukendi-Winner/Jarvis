import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import Welcome from './components/Welcome'
function App() {
  return (
    <>
    <div className="min-h-screen bg-futuristic">
      <Welcome />
    </div>
    </>
  )
}

export default App;
