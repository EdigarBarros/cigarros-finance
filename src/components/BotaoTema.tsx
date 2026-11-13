import { Icone } from './Icone'
import { definirTema, useTema } from '../lib/tema'
import { tx } from '../lib/textos'

/**
 * Troca entre tema claro e escuro nas telas sem a barra do painel (apresentação, entrar/criar conta, páginas legais).
 * Fica preso no canto de cima, ao lado do botão de idioma; no painel, o mesmo botão fica na barra.
 */
export function BotaoTema() {
  const { tema } = useTema()
  const rotulo = tema === 'escuro' ? tx('Usar tema claro') : tx('Usar tema escuro')
  return (
    <button className="tema-flutuante" onClick={(e) => definirTema(tema === 'escuro' ? 'claro' : 'escuro', { x: e.clientX, y: e.clientY })}
      aria-label={rotulo} title={rotulo}>
      <Icone nome={tema === 'escuro' ? 'sol' : 'lua'} tamanho={18} />
    </button>
  )
}
