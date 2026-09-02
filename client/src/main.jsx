import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './services/scormApiCache.js'
import './services/campaignAdminReadRedirect.js'
import App from './App.jsx'
import CampaignManagementDock from './components/CampaignManagementDock.jsx'
import PlatformDataBootstrap from './components/PlatformDataBootstrap.jsx'
import './campaignDividerFix.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <PlatformDataBootstrap />
    <CampaignManagementDock />
  </StrictMode>,
)
