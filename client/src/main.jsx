import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import CampaignManagementDock from './components/CampaignManagementDock.jsx'
import './campaignDividerFix.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <CampaignManagementDock />
  </StrictMode>,
)
