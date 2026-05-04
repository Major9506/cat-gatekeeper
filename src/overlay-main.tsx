import React from 'react'
import ReactDOM from 'react-dom/client'
import { OverlayApp } from './OverlayApp'
import './overlay.css'
import './i18n'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <OverlayApp />
  </React.StrictMode>,
)
