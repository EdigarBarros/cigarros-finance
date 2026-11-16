/**
 * A moldura do painel no celular (até 860 px): o topo (foto, busca, mês e olho), o fundo colorido da página e a barra de
 * abas flutuante. Quem decide o que entra em cada uma é o Painel (components/Painel.tsx); aqui só se desenha.
 */
import { useEffect, useRef, useState } from 'react'
import { Icone } from '../components/Icone'
import { tx } from '../lib/textos'
import { estiloLente, useLente } from '../lib/useLente'
import { TONS, type Tom } from './tom'
import './movel.css'

/** O degradê do topo: uma camada por tom, e a troca é só de opacidade (degradê não tem transição). */
export function FundoMovel({ tom, cor }: { tom: Tom | null; cor?: string | null }) {
  return (
    <div className={`movel-fundo ${tom ? 'ligado' : ''}`} aria-hidden="true" style={cor ? ({ '--tom-cor': cor } as React.CSSProperties) : undefined}>
      {TONS.map((t) => <i key={t} data-t={t} className={t === tom ? 'ativo' : ''} />)}
    </div>
  )
}

/** A página já rolou um pouco: o topo ganha o vidro fosco para continuar legível sobre o conteúdo. */
function useRolou() {
  const [rolou, setRolou] = useState(() => window.scrollY > 8)
  useEffect(() => {
    const aoRolar = () => setRolou(window.scrollY > 8)
    window.addEventListener('scroll', aoRolar, { passive: true })
    return () => window.removeEventListener('scroll', aoRolar)
  }, [])
  return rolou
}

export function TopoMovel({ sobreCor, foto, iniciais, avisoConta, aoConta, busca, aoBuscar, mes, aoMes, ocultos, aoOcultar, sino }: {
  /** Há um degradê atrás (a Início): ícones e textos brancos até a página rolar. */
  sobreCor: boolean
  foto: string | null; iniciais: string; avisoConta: boolean; aoConta: () => void
  busca: string; aoBuscar: (q: string) => void
  mes: string; aoMes: () => void
  ocultos: boolean; aoOcultar: () => void
  sino?: { rotulo: string; ponto: boolean; atraso: boolean; acao: () => void }
}) {
  const rolou = useRolou()
  return (
    <header className={`topo-movel ${sobreCor && !rolou ? 'sobre-cor' : ''} ${rolou ? 'rolou' : ''}`}>
      <button className="topo-movel-avatar" data-tour="menu-conta" onClick={aoConta} aria-label={tx('Sua conta')}>
        <span className="avatar" aria-hidden="true">{foto ? <img src={foto} alt="" /> : iniciais || '?'}</span>
        {avisoConta && <span className="sino-ponto" />}
      </button>
      <label className="topo-movel-busca">
        <Icone nome="busca" tamanho={18} />
        <input type="search" placeholder={tx('Buscar')} value={busca} onChange={(e) => aoBuscar(e.target.value)} aria-label={tx('Buscar lançamentos')} />
      </label>
      <button className="topo-movel-mes" onClick={aoMes} aria-label={tx('Escolher mês: {0}', mes)}>
        <Icone nome="calendario" tamanho={16} />{mes}
      </button>
      <button className="topo-movel-redondo" onClick={aoOcultar} aria-pressed={ocultos}
        aria-label={ocultos ? tx('Mostrar valores') : tx('Ocultar valores')}>
        <Icone nome={ocultos ? 'olho-fechado' : 'olho'} tamanho={20} />
      </button>
      {sino && (
        <button className="topo-movel-redondo" onClick={sino.acao} aria-label={sino.rotulo}>
          <Icone nome="sino" tamanho={20} />
          {sino.ponto && <span className={`sino-ponto ${sino.atraso ? 'atraso' : ''}`} />}
        </button>
      )}
    </header>
  )
}

export interface Aba { id: string; nome: string; icone: string; ativo: boolean; acao: () => void; tour?: string; aberta?: boolean }

/** As quatro abas fixas, na pílula de vidro. Rolando para baixo, ela encolhe (some o nome) para mostrar mais da tela. */
export function BarraDeAbasMovel({ abas, encolhida }: { abas: Aba[]; encolhida: boolean }) {
  const ref = useRef<HTMLElement>(null)
  const lente = useLente(ref, 'button.ativo', `${abas.map((a) => `${a.id}${a.ativo}`).join()}|${encolhida}`)
  return (
    <nav className={`abas-movel abas-movel-nova ${encolhida ? 'encolhida' : ''}`} ref={ref} aria-label={tx('Páginas')}>
      {lente && <span className="lente" aria-hidden="true" style={estiloLente(lente)} />}
      {abas.map((a) => (
        <button key={a.id} data-tour={a.tour} className={a.ativo ? 'ativo' : ''} onClick={a.acao}
          aria-current={a.ativo && a.aberta === undefined ? 'page' : undefined} aria-expanded={a.aberta} aria-label={a.nome}>
          <Icone nome={a.icone} /> <span>{a.nome}</span>
        </button>
      ))}
    </nav>
  )
}

/** Lista de botões dentro de uma folha (menu da conta, "Mais"): cada linha com ícone e nome; tocar fecha a folha. */
export function ListaDaFolha({ children, aoEscolher }: { children: React.ReactNode; aoEscolher: () => void }) {
  return <div className="lista-folha" onClick={(e) => (e.target as HTMLElement).closest('button') && aoEscolher()}>{children}</div>
}
