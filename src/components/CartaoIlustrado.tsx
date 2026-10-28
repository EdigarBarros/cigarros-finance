import { useRef, type ReactNode } from 'react'
import { semMovimento } from '../lib/tema'
import { corSobre } from '../lib/estiloBanco'
import { BancoIcone } from './BancoIcone'

/** Desenhos de fundo do plástico; cada cartão fica com um, escolhido pelo nome (sempre o mesmo para o mesmo cartão). */
const PADROES = [
  // ondas
  <g key="o" fill="none" stroke="currentColor" strokeWidth="1.2">
    {[0, 1, 2, 3, 4, 5].map((i) => <path key={i} d={`M-10 ${70 + i * 14} C 60 ${30 + i * 14}, 120 ${120 + i * 14}, 330 ${40 + i * 14}`} />)}
  </g>,
  // círculos concêntricos no canto
  <g key="c" fill="none" stroke="currentColor" strokeWidth="1.2">
    {[30, 55, 80, 105, 130, 155].map((r) => <circle key={r} cx="300" cy="10" r={r} />)}
  </g>,
  // faixas diagonais
  <g key="f" fill="currentColor">
    {[0, 1, 2].map((i) => <path key={i} d={`M${150 + i * 48} 0h26L${110 + i * 48} 200h-26z`} opacity={0.5 + i * 0.2} />)}
  </g>,
  // malha de pontos
  <g key="p" fill="currentColor">
    {Array.from({ length: 60 }, (_, i) => <circle key={i} cx={170 + (i % 10) * 15} cy={10 + Math.floor(i / 10) * 15} r={1.6} />)}
  </g>,
]

const hash = (s: string) => [...s].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7)

/** Chip dourado do cartão. */
export function Chip({ largura = 38 }: { largura?: number }) {
  return (
    <svg className="cc-chip" width={largura} height={largura * 0.76} viewBox="0 0 38 29" aria-hidden="true">
      <defs>
        <linearGradient id="cc-ouro" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fbe7a6" />
          <stop offset=".5" stopColor="#d6ad4f" />
          <stop offset="1" stopColor="#f2d589" />
        </linearGradient>
      </defs>
      <rect x=".5" y=".5" width="37" height="28" rx="6" fill="url(#cc-ouro)" stroke="rgba(120,85,20,.45)" />
      <path d="M13 .5v28M25 .5v28M.5 10h12.5M25 10h12.5M.5 19h12.5M25 19h12.5M13 14.5h12" stroke="rgba(120,85,20,.5)" fill="none" />
    </svg>
  )
}

/** Símbolo de pagamento por aproximação. */
const Aproximacao = () => (
  <svg className="cc-aprox" width="18" height="22" viewBox="0 0 18 22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <path d="M2 8.5c1.2 1.5 1.2 3.5 0 5M6 6c2.4 3 2.4 7 0 10M10 3.5c3.6 4.5 3.6 10.5 0 15M14 1c4.8 6 4.8 14 0 20" />
  </svg>
)

/**
 * Cartão de crédito desenhado: plástico na cor do cartão, desenho de fundo, chip, aproximação, selo do banco e um
 * brilho que acompanha o ponteiro, com o cartão inclinando de leve em 3D. `conteudo` vai no meio (ex.: a fatura).
 */
export function CartaoIlustrado({ nome, cor, banco, conteudo, rodape, ativo, compacto, aoClicar }: {
  nome: string
  cor: string
  /** Nome do banco ligado ao cartão (ajuda a achar o selo quando o nome do cartão não diz). */
  banco?: string
  conteudo?: ReactNode
  rodape?: ReactNode
  ativo?: boolean
  compacto?: boolean
  aoClicar?: () => void
}) {
  const ref = useRef<HTMLElement>(null)
  const padrao = PADROES[hash(nome) % PADROES.length]
  const texto = corSobre(cor)

  const mover = (e: React.PointerEvent) => {
    const el = ref.current
    if (!el || e.pointerType === 'touch' || semMovimento()) return
    const r = el.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width
    const y = (e.clientY - r.top) / r.height
    el.style.setProperty('--ry', `${(x - 0.5) * 14}deg`)
    el.style.setProperty('--rx', `${(0.5 - y) * 10}deg`)
    el.style.setProperty('--mx', `${x * 100}%`)
    el.style.setProperty('--my', `${y * 100}%`)
  }
  const soltar = () => {
    const el = ref.current
    if (!el) return
    for (const p of ['--rx', '--ry', '--mx', '--my']) el.style.removeProperty(p)
  }

  const corpo = (
    <>
      <svg className="cc-padrao" viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">{padrao}</svg>
      <span className="cc-brilho" aria-hidden="true" />
      <span className="cc-plastico-topo">
        <BancoIcone nome={nome} reserva={banco} cor={cor} tamanho={compacto ? 24 : 30} />
        <strong>{nome}</strong>
        <Aproximacao />
      </span>
      <span className="cc-plastico-meio">
        <Chip largura={compacto ? 30 : 38} />
        {conteudo}
      </span>
      <span className="cc-plastico-pe">
        <span className="cc-plastico-rodape">{rodape}</span>
        <span className="cc-tipo">crédito</span>
      </span>
    </>
  )
  const props = {
    className: `cc-plastico ${ativo ? 'ativo' : ''} ${compacto ? 'compacto' : ''}`,
    style: { '--c': cor, '--cc-texto': texto } as React.CSSProperties,
    onPointerMove: mover,
    onPointerLeave: soltar,
  }
  return aoClicar
    ? <button type="button" ref={ref as React.RefObject<HTMLButtonElement>} {...props} onClick={aoClicar} aria-pressed={ativo}>{corpo}</button>
    : <div ref={ref as React.RefObject<HTMLDivElement>} {...props}>{corpo}</div>
}
