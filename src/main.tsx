import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import './i18n'

// This is the main entry point, but the app primarily runs via settings and overlay windows
// This can be a simple landing page or redirect to settings
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <div className="settings-container">
      <div className="header">
        <h1>Cat Gatekeeper</h1>
        <p className="subtitle">Your feline break reminder</p>
      </div>
      <p style={{ textAlign: 'center', color: '#888', marginTop: '20px' }}>
        The app is running in the system tray. Click the tray icon to access settings.
      </p>
    </div>
  </React.StrictMode>,
)
