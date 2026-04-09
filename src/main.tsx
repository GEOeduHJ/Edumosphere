import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './styles/global.css'
import 'leaflet/dist/leaflet.css'
// leaflet.pm (polygon coordinate editing) removed — using style/label editing instead

// Clear persisted map selections on each full page load so the app
// always starts in a clean state (user requested behavior).
try {
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.removeItem('selected_countries')
    localStorage.removeItem('country_styles')
  }
} catch (e) {
  // ignore
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
