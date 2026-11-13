import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { BancoIcone } from '../components/BancoIcone'
import { Icone } from '../components/Icone'
import { MESES_CURTO } from '../lib/format'
import { semMovimento } from '../lib/tema'
import { tx } from '../lib/textos'
import { ANO } from './apresentacaoCena'
import './fundo-opus.css'

/**
 * Fundo da página inicial: pedaços do próprio OpusCash (gráfico do ano, pote de meta, cartões, conta do mês, lançamento,
 * dívida, dinheiro guardado, invest, consultor, configurações) flutuando em 3D atrás do texto.
 *
 * Quando a seção aparece, as peças saem do meio dela e são lançadas para o fundo, cada uma até o seu lugar, e ficam
 * vagando devagar. O mouse empurra o fundo de leve (as peças mais perto mexem mais). Tudo é animação de CSS em
 * transform: o navegador move as camadas prontas, sem redesenhar. Fora da tela as animações param.
 *
 * Camadas de cada peça: .fo-lugar (posição e o empurrão do mouse) > .fo-entra (o lançamento) > .fo-vaga (o passeio)
 * > .fo-peca (o desenho, com a inclinação e a profundidade).
 */

const R = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)

/** Mini Resumo do ano: as barras e a linha da dívida do gráfico da apresentação. */
function PGrafico() {
  const W = 210, H = 92, max = 10000
  const x = (i: number) => 8 + (i * (W - 16)) / 10
  const y = (v: number) => H - 4 - (v / max) * (H - 10)
  const pts = ANO.divida.map((v, i) => [x(i), y(v * 2.2)] as const)
  const linha = pts.map(([px, py], i) => (i === 0 ? `M${px} ${py}` : `L${px.toFixed(1)} ${py.toFixed(1)}`)).join(' ')
  return (
    <div className="fo-card fo-grafico">
      <header><Icone nome="ano" tamanho={13} /> {tx('Resumo do ano')}</header>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
        {ANO.entrou.map((v, i) => (
          <g key={i}>
            <rect x={x(i) - 6} y={y(v)} width="5.5" height={H - 4 - y(v)} rx="2" className="e" />
            <rect x={x(i) + 0.5} y={y(ANO.saiu[i])} width="5.5" height={H - 4 - y(ANO.saiu[i])} rx="2" className="s" />
          </g>
        ))}
        <path d={linha} className="divida" />
      </svg>
    </div>
  )
}

/** Pote de meta enchendo (o mesmo desenho da tela Metas). */
function PPote({ c, v, nome }: { c: string; v: number; nome: string }) {
  return (
    <div className="fo-card fo-pote" style={{ '--c': c } as CSSProperties}>
      <div className="tm-pote" style={{ '--c': c, '--v': v, '--i': 0 } as CSSProperties}>
        <i className="tm-tampa" />
        <div className="tm-vidro">
          <div className="tm-agua">
            <svg className="tm-onda" viewBox="0 0 200 20" preserveAspectRatio="none" aria-hidden="true"><path d="M0 10 Q25 2 50 10 T100 10 T150 10 T200 10 V20 H0 Z" /></svg>
          </div>
          <span className="tm-selo"><Icone nome="meta" tamanho={14} /></span>
          <i className="tm-reflexo" />
        </div>
      </div>
      <span><b>{Math.round(v * 100)}%</b><small>{nome}</small></span>
    </div>
  )
}

/** Cartão de crédito (o plástico da tela Cartões). */
function PCartao({ banco, c1, c2, valor }: { banco: string; c1: string; c2: string; valor: number }) {
  return (
    <div className="fo-plastico" style={{ '--c1': c1, '--c2': c2 } as CSSProperties}>
      <span className="fo-plastico-nome"><BancoIcone nome={banco} tamanho={22} /><b translate="no">{banco}</b></span>
      <span className="fo-plastico-meio"><i className="tc-chip" /><span><small>{tx('fatura de outubro')}</small><b>{R(valor)}</b></span></span>
      <span className="fo-plastico-rodape"><b>{tx('CRÉDITO')}</b></span>
    </div>
  )
}

/** Conta do mês já paga. */
function PConta() {
  return (
    <div className="fo-card fo-linha" style={{ '--c': 'var(--divida)' } as CSSProperties}>
      <span className="fo-dia">05<small>{MESES_CURTO[10].toLowerCase()}</small></span>
      <span className="fo-texto"><b>{tx('Aluguel')}</b><small>{tx('Contas do mês')}</small></span>
      <b className="fo-valor">{R(1800)}</b>
      <i className="fo-ok"><Icone nome="check" tamanho={13} /></i>
    </div>
  )
}

/** Um lançamento (o cartãozinho da tela Lançamentos). */
function PLancamento() {
  return (
    <div className="fo-card fo-lanc" style={{ '--c': '#f07a12' } as CSSProperties}>
      <small>{tx('Alimentação')}</small>
      <b>{tx('Mercado')}</b>
      <strong>− {R(334)}</strong>
      <span className="fo-tags"><i>{tx('Pix')}</i><i>{tx('Débito')}</i></span>
    </div>
  )
}

/** Uma dívida com o quanto já foi pago. */
function PDivida() {
  return (
    <div className="fo-card fo-divida">
      <header><Icone nome="divida" tamanho={13} /> {tx('Financiamento do carro')}</header>
      <div className="fo-divida-meio">
        <span className="fo-aro" style={{ '--v': 0.38, '--c': 'var(--caixa)' } as CSSProperties}><b>38%</b></span>
        <span><small>{tx('falta pagar')}</small><b>{R(48750)}</b></span>
      </div>
      <span className="fo-trilho">{Array.from({ length: 12 }, (_, i) => <i key={i} className={i < 5 ? 'ja' : ''} />)}</span>
    </div>
  )
}

/** Dinheiro guardado em cada banco. */
function PGuardado() {
  return (
    <div className="fo-card fo-guardado">
      <header><Icone nome="carteira" tamanho={13} /> {tx('Dinheiro guardado')}</header>
      <strong>{R(25290)}</strong>
      <span className="fo-banco"><BancoIcone nome="Nubank" tamanho={18} /><span translate="no">Nubank</span><b>{R(15800)}</b></span>
      <span className="fo-banco"><BancoIcone nome="Itaú" tamanho={18} /><span translate="no">Itaú</span><b>{R(9490)}</b></span>
    </div>
  )
}

/** Invest: a carteira subindo. */
function PInvest() {
  return (
    <div className="fo-card fo-invest">
      <header><Icone nome="investir" tamanho={13} /> {tx('Invest')}<span className="fo-sobe">+12,4%</span></header>
      <svg width="170" height="56" viewBox="0 0 170 56" aria-hidden="true">
        <defs><linearGradient id="fo-invest-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#c45cf0" stopOpacity=".35" /><stop offset="1" stopColor="#c45cf0" stopOpacity="0" /></linearGradient></defs>
        <path d="M0 48 C20 44 28 46 40 38 S62 30 74 32 S98 20 112 22 S140 10 170 6 V56 H0 Z" fill="url(#fo-invest-g)" />
        <path d="M0 48 C20 44 28 46 40 38 S62 30 74 32 S98 20 112 22 S140 10 170 6" className="linha" />
      </svg>
    </div>
  )
}

/** Consultor: a dica do que fazer primeiro. */
function PConsultor() {
  return (
    <div className="fo-card fo-consultor">
      <i className="fo-icone"><Icone nome="bussola" tamanho={16} /></i>
      <span><b>{tx('Consultor')}</b><small>{tx('Adiante primeiro a dívida mais cara.')}</small></span>
    </div>
  )
}

/** Configurações: interruptores. */
function PConfig() {
  return (
    <div className="fo-card fo-config">
      <header><Icone nome="engrenagem" tamanho={13} /> {tx('Configurações')}</header>
      <span className="fo-chave"><span>{tx('Tema escuro')}</span><i className="liga" /></span>
      <span className="fo-chave"><span>{tx('Animações')}</span><i className="liga" /></span>
    </div>
  )
}

/** Aro de meta. */
function PAro() {
  return (
    <div className="fo-card fo-aro-card">
      <span className="fo-aro grande" style={{ '--v': 0.72, '--c': 'var(--entrada)' } as CSSProperties}><b>72%</b></span>
      <small>{tx('Reserva de emergência')}</small>
    </div>
  )
}

/** Calendário dia a dia, mais forte onde saiu mais. */
function PCalendario() {
  const niveis = [0, 1, 0, 2, 4, 0, 1, 2, 1, 4, 1, 0, 1, 2, 3, 0, 2, 0, 1, 0, 0]
  return (
    <div className="fo-card fo-cal">
      <header><Icone nome="calendario" tamanho={13} /> {tx('Dia a dia')}</header>
      <div>{niveis.map((n, i) => <i key={i} className={`n${n}`} />)}</div>
    </div>
  )
}

const PECAS = {
  grafico: () => <PGrafico />,
  pote: () => <PPote c="#38bdf8" v={0.72} nome={tx('Viagem ao Japão')} />,
  pote2: () => <PPote c="#a855f7" v={0.87} nome={tx('Notebook novo')} />,
  nubank: () => <PCartao banco="Nubank" c1="#a136f5" c2="#5b0aa6" valor={960} />,
  itau: () => <PCartao banco="Itaú" c1="#f28a1c" c2="#a4480a" valor={1230} />,
  conta: () => <PConta />,
  lanc: () => <PLancamento />,
  divida: () => <PDivida />,
  guardado: () => <PGuardado />,
  invest: () => <PInvest />,
  consultor: () => <PConsultor />,
  config: () => <PConfig />,
  aro: () => <PAro />,
  cal: () => <PCalendario />,
} satisfies Record<string, () => ReactNode>

/**
 * Uma peça no fundo: onde fica (x, y em % da seção), profundidade (z, em px: negativo é mais longe), tamanho (s),
 * inclinação (rx, ry, rz em graus) e o passeio (t: segundos de uma ida; ax, ay: quanto anda; ar: quanto gira).
 * `celular: false` some na tela estreita (lá cabe menos); `xm`/`ym`: o lugar na tela estreita, quando é outro.
 */
interface Peca {
  p: keyof typeof PECAS; x: number; y: number; z: number; s?: number
  rx?: number; ry?: number; rz?: number; t?: number; ax?: number; ay?: number; ar?: number; celular?: boolean; xm?: number; ym?: number
}

const PECAS_TOPO: Peca[] = [
  { p: 'grafico', x: 15, y: 22, z: -180, ry: 24, rx: 8, rz: -4, t: 17, ax: 26, ay: -18, ar: 3, xm: 22, ym: 12 },
  { p: 'nubank', x: 85, y: 22, z: -60, ry: -26, rx: 10, rz: 8, t: 14, ax: -22, ay: 20, ar: -4, xm: 78, ym: 13 },
  { p: 'pote', x: 7, y: 60, z: -40, ry: 18, rz: 6, t: 15, ax: 18, ay: 22, ar: 4, celular: false },
  { p: 'conta', x: 88, y: 56, z: -120, ry: -22, rz: -3, t: 18, ax: -20, ay: -16, ar: -3, xm: 76, ym: 95 },
  { p: 'lanc', x: 22, y: 84, z: -90, ry: 20, rx: -8, rz: 5, t: 16, ax: 24, ay: -14, ar: 3, xm: 22, ym: 94 },
  { p: 'guardado', x: 79, y: 84, z: -160, ry: -18, rx: -6, rz: -4, t: 19, ax: -18, ay: -20, ar: -3, celular: false },
  { p: 'divida', x: 30, y: 9, z: -420, ry: 14, rz: 3, t: 21, ax: 20, ay: 12, ar: 2, celular: false },
  { p: 'invest', x: 70, y: 9, z: -380, ry: -14, rz: -3, t: 20, ax: -22, ay: 14, ar: -2, celular: false },
  { p: 'consultor', x: 96, y: 38, z: -300, ry: -30, rz: 2, t: 22, ax: -14, ay: 18, ar: 2, celular: false },
  { p: 'config', x: 4, y: 36, z: -340, ry: 30, rz: -3, t: 23, ax: 16, ay: -16, ar: -2, celular: false },
  { p: 'itau', x: 63, y: 95, z: -480, ry: -10, rx: -14, rz: -10, t: 24, ax: -14, ay: -10, ar: 4, celular: false },
  { p: 'aro', x: 40, y: 95, z: -520, ry: 10, rx: -12, t: 22, ax: 14, ay: -12, ar: -3, celular: false },
]

const PECAS_FUNDADORES: Peca[] = [
  { p: 'cal', x: 7, y: 20, z: -260, ry: 26, rz: -4, t: 20, ax: 18, ay: 16, ar: 3, celular: false },
  { p: 'invest', x: 93, y: 16, z: -300, ry: -24, rz: 4, t: 22, ax: -18, ay: 14, ar: -3, celular: false },
  { p: 'pote2', x: 5, y: 74, z: -200, ry: 22, rz: 5, t: 18, ax: 16, ay: -18, ar: 3, celular: false },
  { p: 'divida', x: 94, y: 70, z: -240, ry: -22, rz: -4, t: 21, ax: -16, ay: -16, ar: -3, celular: false },
  { p: 'consultor', x: 50, y: 97, z: -520, rx: -16, t: 24, ax: 16, ay: -8, ar: 2, celular: false },
]

const PECAS_PRECO: Peca[] = [
  // nos cantos e nas faixas de cima e de baixo: o meio da seção é do texto e do plano. Pouca profundidade, porque a
  // perspectiva puxa para o meio o que fica longe
  { p: 'itau', x: 1, y: 1, z: -140, ry: 26, rz: 8, t: 19, ax: 14, ay: 10, ar: 4, xm: 6, ym: 0 },
  { p: 'grafico', x: 47, y: 0, z: -360, rx: 14, t: 23, ax: 16, ay: 6, ar: 2, celular: false },
  { p: 'guardado', x: 99, y: 2, z: -180, ry: -24, rz: -3, t: 22, ax: -12, ay: 10, ar: -3, celular: false },
  { p: 'conta', x: 2, y: 99, z: -150, ry: 22, rz: 3, t: 20, ax: 12, ay: -8, ar: -2, celular: false },
  { p: 'aro', x: 52, y: 100, z: -340, rx: -14, t: 17, ax: 12, ay: -6, ar: 3, celular: false },
  { p: 'lanc', x: 98, y: 99, z: -170, rx: -12, ry: -16, rz: -4, t: 21, ax: -12, ay: -8, ar: -3, xm: 92, ym: 100 },
]

const ONDE = { topo: PECAS_TOPO, fundadores: PECAS_FUNDADORES, preco: PECAS_PRECO }

/**
 * O fundo de uma seção (`onde`): as peças são lançadas do meio dela quando ela aparece e ficam vagando.
 * `mouse`: o fundo acompanha o ponteiro de leve.
 */
export function FundoOpus({ onde, mouse = false }: { onde: keyof typeof ONDE; mouse?: boolean }) {
  const pecas = ONDE[onde]
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    // lança quando a seção aparece, com a página já carregada (no meio do carregamento a animação passaria
    // engasgada ou sem ninguém ver); fora da tela, o passeio para (não gasta nada)
    let espera = 0
    const soltar = () => {
      if (el.classList.contains('fo-solto') || espera) return
      if (document.readyState === 'complete') { el.classList.add('fo-solto'); return }
      const ja = () => { clearTimeout(espera); el.classList.add('fo-solto') }
      window.addEventListener('load', ja, { once: true })
      espera = window.setTimeout(ja, 2500)
    }
    const obs = new IntersectionObserver(([e]) => {
      el.classList.toggle('fo-parado', !e.isIntersecting)
      if (e.isIntersecting) soltar()
    }, { threshold: 0.12 })
    obs.observe(el)
    if (!mouse || !window.matchMedia('(pointer: fine)').matches) return () => { obs.disconnect(); clearTimeout(espera) }
    // o mouse empurra o fundo de leve: uma escrita por quadro, no máximo
    let quadro = 0, mx = 0, my = 0
    const mover = (e: PointerEvent) => {
      if (semMovimento()) return
      mx = e.clientX / window.innerWidth - 0.5
      my = e.clientY / window.innerHeight - 0.5
      if (!quadro) quadro = requestAnimationFrame(() => {
        quadro = 0
        el.style.setProperty('--mx', mx.toFixed(3))
        el.style.setProperty('--my', my.toFixed(3))
      })
    }
    window.addEventListener('pointermove', mover, { passive: true })
    return () => { obs.disconnect(); clearTimeout(espera); window.removeEventListener('pointermove', mover); if (quadro) cancelAnimationFrame(quadro) }
  }, [mouse])

  return (
    <div className="fo" ref={ref} aria-hidden="true">
      {pecas.map((q, i) => {
        const Desenho = PECAS[q.p]
        // perto (z perto de 0) fica mais nítido e forte; longe, mais apagado e desfocado
        const longe = Math.min(1, Math.max(0, -q.z / 520))
        const estilo = {
          '--x': q.x, '--y': q.y, '--xm': q.xm ?? q.x, '--ym': q.ym ?? q.y, '--z': `${q.z}px`, '--s': q.s ?? 1,
          '--rx': `${q.rx ?? 0}deg`, '--ry': `${q.ry ?? 0}deg`, '--rz': `${q.rz ?? 0}deg`,
          '--t': `${q.t ?? 18}s`, '--ax': `${q.ax ?? 16}px`, '--ay': `${q.ay ?? 16}px`, '--ar': `${q.ar ?? 3}deg`,
          '--p': (1 - longe * 0.7).toFixed(2), '--o': (0.85 - longe * 0.4).toFixed(2),
          '--i': i,
        } as CSSProperties
        return (
          <div key={i} className={`fo-lugar ${q.celular === false ? 'fo-so-largo' : ''}`} style={estilo}>
            <div className="fo-entra"><div className="fo-vaga"><div className="fo-peca"><Desenho /></div></div></div>
          </div>
        )
      })}
    </div>
  )
}
