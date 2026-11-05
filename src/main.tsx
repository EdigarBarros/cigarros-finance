import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { LimiteDeErro } from './components/LimiteDeErro'
import { iniciarAtualizacao } from './lib/atualizacao'
import { iniciarIdioma } from './lib/idioma'
import { nativo, tx } from './lib/textos'
import { iniciarRegistroDeErros } from './lib/erros'
import { iniciarIma } from './lib/ima'
import './index.css'

iniciarIma()
iniciarRegistroDeErros()
iniciarAtualizacao()
iniciarIdioma()
if (nativo) document.title = tx('OpusCash: seu dinheiro organizado')
// Página de "sem internet" para o app instalado (Play Store e tela de início). Veja public/sw.js.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  addEventListener('load', () => void navigator.serviceWorker.register('/sw.js').catch(() => { /* sem service worker o app funciona igual */ }))
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LimiteDeErro>
      <App />
    </LimiteDeErro>
  </StrictMode>,
)
