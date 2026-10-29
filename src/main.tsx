import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { LimiteDeErro } from './components/LimiteDeErro'
import { iniciarRegistroDeErros } from './lib/erros'
import './lib/charts'
import { iniciarIma } from './lib/ima'
import './index.css'

iniciarIma()
iniciarRegistroDeErros()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LimiteDeErro>
      <App />
    </LimiteDeErro>
  </StrictMode>,
)
