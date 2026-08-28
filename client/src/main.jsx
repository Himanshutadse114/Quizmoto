import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import BrandRuntime from './components/BrandRuntime.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrandRuntime />
    <App />
  </StrictMode>,
)
