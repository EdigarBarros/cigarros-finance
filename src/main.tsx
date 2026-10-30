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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LimiteDeErro>
      <App />
    </LimiteDeErro>
  </StrictMode>,
)
