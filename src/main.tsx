import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './lib/charts'
import { iniciarBrilho } from './lib/brilho'
import './index.css'

iniciarBrilho()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
