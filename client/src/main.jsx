import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './services/scormApiCache.js'
import './services/campaignAdminReadRedirect.js'
import './services/courseTemplateOverrides.js'
import App from './App.jsx'
import PlatformDataBootstrap from './components/PlatformDataBootstrap.jsx'
import './lmsgenLightFinal.css'
import './pages/Scorm/courseAuthorV7.css'
import './pages/Scorm/courseAuthorV7ThemeFix.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <PlatformDataBootstrap />
  </StrictMode>,
)
