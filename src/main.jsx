import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import App from './App.jsx'
import Welcome from './components/Welcome'
import Home from './components/Home.jsx' 
import Jarvis from './components/Jarvis.jsx'
import NotFound from './components/NotFound.jsx'
//  routes
const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    errorElement: <NotFound />,
    children: [
      {
        path: "/",
        element: <Welcome />,
      },
      {
        path: "/home",
        element: <Home />,
      },
      {
        path: "/jarvis",
        element: <Jarvis />, 
      },
      {
        path: "/jarvis/:assistantType",
        element: <Jarvis />,
      },
    ],
  },
])


ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)