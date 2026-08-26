import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { applyTheme, applyCustomPalette, buildCustomPalette, CUSTOM_THEME_ID } from './data/themes'

// Apply the saved theme before first paint to avoid a flash of the default one.
try {
  const raw = localStorage.getItem('greenfinance:v1')
  const settings = raw ? JSON.parse(raw)?.settings : undefined
  applyTheme(settings?.theme)
  if (settings?.theme === CUSTOM_THEME_ID && settings?.customPalette) {
    applyCustomPalette(buildCustomPalette(settings.customPalette))
  }
} catch {
  // ignore — App will apply the default theme once mounted
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
