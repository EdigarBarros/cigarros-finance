/**
 * A moldura do painel no celular (até 860 px): o topo (foto, busca, mês e olho), o fundo colorido da página e a barra de
 * abas flutuante. Quem decide o que entra em cada uma é o Painel (components/Painel.tsx); aqui só se desenha.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
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

/**
 * A faixa de cima do celular na cor do topo da tela aberta: a barra de status do Android (theme-color) e, no app da tela de
 * início do iPhone, a faixa do relógio e da ilha (`--faixa-topo`, pintada em index.css). Sem topo colorido, o grafite do fundo
 * no tema escuro. Ao sair (ou no computador), volta tudo como o tema deixou.
 */
export function useCorDaBarraDoCelular(celular: boolean, escuro: boolean, corTopo: string | null) {
  const cor = celular ? corTopo ?? (escuro ? '#0e0f11' : null) : null
  useEffect(() => {
    if (!cor) return
    const meta = document.querySelector('meta[name="theme-color"]')
    const antes = meta?.getAttribute('content')
    meta?.setAttribute('content', cor)
    document.documentElement.style.setProperty('--faixa-topo', cor)
    return () => {
      if (meta && antes) meta.setAttribute('content', antes)
      document.documentElement.style.removeProperty('--faixa-topo')
    }
  }, [cor])
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

export function TopoMovel({ sobreCor, foto, iniciais, avisoConta, aoConta, busca, aoBuscar, mes, aoMes, ocultos, aoOcultar }: {
  /** Há um degradê atrás (a Início): ícones e textos brancos até a página rolar. */
  sobreCor: boolean
  foto: string | null; iniciais: string; avisoConta: boolean; aoConta: () => void
  busca: string; aoBuscar: (q: string) => void
  mes: string; aoMes: () => void
  ocultos: boolean; aoOcultar: () => void
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
    </header>
  )
}

export interface Aba { id: string; nome: string; icone: string; ativo: boolean; acao: () => void; tour?: string; aberta?: boolean }

/** Quanto tempo segurando a barra até a lente "soltar" e passar a seguir o dedo. */
const SEGURAR_MS = 220
/** Arrastar de lado mais que isto já pega a lente, sem esperar. */
const ARRASTE_PX = 10

/**
 * As quatro abas fixas, na pílula de vidro. Rolando para baixo, ela encolhe (some o nome) para mostrar mais da tela.
 * Segurando a barra (ou arrastando de lado), a lente cresce, vira uma gota de vidro e segue o dedo pelas abas, aumentando a
 * que está embaixo; ao soltar, abre essa aba. Os movimentos da lente vão direto no estilo (sem redesenhar a barra a cada
 * quadro); o React só redesenha quando muda a aba embaixo do dedo.
 */
export function BarraDeAbasMovel({ abas, encolhida }: { abas: Aba[]; encolhida: boolean }) {
  const ref = useRef<HTMLElement>(null)
  const refLente = useRef<HTMLSpanElement>(null)
  const [sob, setSob] = useState<number | null>(null)
  const gesto = useRef<{ id: number; x: number; y: number; timer: number; ativo: boolean; indice: number } | null>(null)
  const engolirClique = useRef(false)
  const ultimoX = useRef(0)
  // a aba tocada acende na hora, só aqui na barra; a tela troca logo depois (numa transição, no Painel). Quando o Painel
  // confirma (ou outra coisa muda as abas), vale de novo o que ele diz.
  const [pedida, setPedida] = useState<string | null>(null)
  const chave = abas.map((a) => `${a.id}${a.ativo}`).join()
  const [chaveVista, setChaveVista] = useState(chave)
  if (chave !== chaveVista) { setChaveVista(chave); setPedida(null) }
  const ativa = (a: Aba) => (pedida ? a.aberta === undefined && a.id === pedida : a.ativo)
  const abrir = (a: Aba) => { if (a.aberta === undefined && !a.ativo) setPedida(a.id); a.acao() }
  const lente = useLente(ref, 'button.ativo', `${abas.map((a) => `${a.id}${ativa(a)}`).join()}|${encolhida}`)

  const botoes = () => [...(ref.current?.querySelectorAll<HTMLButtonElement>(':scope > button') ?? [])]
  /** A aba embaixo do dedo (a mais perto, se o dedo passou da ponta). */
  const indiceEm = (x: number) => {
    let melhor = 0, dist = Infinity
    botoes().forEach((b, i) => {
      const r = b.getBoundingClientRect()
      const d = x < r.left ? r.left - x : x > r.right ? x - r.right : 0
      if (d < dist) { dist = d; melhor = i }
    })
    return melhor
  }
  /** Leva a lente para o dedo: centrada nele, sem passar das pontas da barra. */
  const moverLente = (x: number) => {
    const nav = ref.current, el = refLente.current, b = botoes()[0]
    if (!nav || !el || !b) return
    const r = nav.getBoundingClientRect()
    const w = b.offsetWidth, h = b.offsetHeight
    const minimo = b.offsetLeft, maximo = nav.clientWidth - b.offsetLeft - w
    const esq = Math.min(maximo, Math.max(minimo, x - r.left - nav.clientLeft - w / 2))
    el.style.width = `${w}px`
    el.style.height = `${h}px`
    el.style.transform = `translate(${esq}px, ${b.offsetTop}px)`
  }
  const comecar = (x: number) => {
    const g = gesto.current
    if (!g || g.ativo) return
    g.ativo = true
    try { ref.current?.setPointerCapture(g.id) } catch { /* o dedo já saiu */ }
    g.indice = indiceEm(x)
    setSob(g.indice)
    navigator.vibrate?.(8)
  }
  const abrirAba = abrir
  const terminar = (abrir: boolean) => {
    const g = gesto.current
    if (!g) return
    window.clearTimeout(g.timer)
    gesto.current = null
    if (!g.ativo) return
    engolirClique.current = true
    window.setTimeout(() => { engolirClique.current = false }, 400)
    setSob(null)
    const alvo = abas[g.indice]
    if (abrir && alvo) abrirAba(alvo)
  }

  const arrastando = sob !== null
  // ao pegar a lente, o React tira o estilo dela (que segue a aba ativa); aqui ela vai para o dedo
  useLayoutEffect(() => { if (arrastando) moverLente(ultimoX.current) }, [arrastando]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <nav className={`abas-movel abas-movel-nova ${encolhida ? 'encolhida' : ''} ${arrastando ? 'arrastando' : ''}`} ref={ref} aria-label={tx('Páginas')}
      onPointerDown={(e) => {
        if (e.button !== 0 || gesto.current) return
        ultimoX.current = e.clientX
        gesto.current = { id: e.pointerId, x: e.clientX, y: e.clientY, ativo: false, indice: 0, timer: window.setTimeout(() => comecar(ultimoX.current), SEGURAR_MS) }
      }}
      onPointerMove={(e) => {
        const g = gesto.current
        if (!g || e.pointerId !== g.id) return
        ultimoX.current = e.clientX
        if (!g.ativo) {
          const dx = Math.abs(e.clientX - g.x), dy = Math.abs(e.clientY - g.y)
          if (dx > ARRASTE_PX && dx > dy) { window.clearTimeout(g.timer); comecar(e.clientX) }
          else if (dy > ARRASTE_PX) terminar(false) // o dedo subiu ou desceu: não é para pegar a lente
          return
        }
        moverLente(e.clientX)
        const i = indiceEm(e.clientX)
        if (i !== g.indice) { g.indice = i; setSob(i); navigator.vibrate?.(6) }
      }}
      onPointerUp={(e) => { if (gesto.current?.id === e.pointerId) terminar(true) }}
      onPointerCancel={() => terminar(false)}
      onClickCapture={(e) => { if (engolirClique.current) { e.preventDefault(); e.stopPropagation(); engolirClique.current = false } }}
      onContextMenu={(e) => e.preventDefault()}>
      {lente && <span ref={refLente} className="lente" aria-hidden="true" style={arrastando ? undefined : estiloLente(lente)} />}
      {abas.map((a, i) => (
        <button key={a.id} data-tour={a.tour} className={`${ativa(a) ? 'ativo' : ''} ${sob === i ? 'sob-lente' : ''}`} onClick={() => abrir(a)}
          aria-current={ativa(a) && a.aberta === undefined ? 'page' : undefined} aria-expanded={a.aberta} aria-label={a.nome}>
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
