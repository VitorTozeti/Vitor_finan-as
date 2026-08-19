import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { applyTheme } from './data/themes'

// Apply the saved theme before first paint to avoid a flash of the default one.
try {
  const raw = localStorage.getItem('greenfinance:v1')
  if (raw) applyTheme(JSON.parse(raw)?.settings?.theme)
} catch {
  // ignore — App will apply the default theme once mounted
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
