import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import type { Humor } from '../lib/kairo'
import { tx } from '../lib/textos'
import './kairo.css'

/*
 * O Kairo: o consultor financeiro do OpusCash em pessoa. Uma bolinha macia, de vidro fosco, nas cores da marca (índigo,
 * azul e verde-água, mais clara embaixo e com um halo em volta) e dois olhinhos finos no meio. Sem boca e sem corpo: ele
 * fala pelos olhos e pelo jeito de se mexer.
 *
 * Os olhos são o rosto todo. Cada olho tem um jeito (kairo.css): aberto (o tracinho em pé), feliz (o arquinho ^),
 * fechado (o tracinho deitado) e ponto (a bolinha de quem está lendo ou se espantou). As caretas são combinações:
 *   calmo ıı · feliz ^^ · piscadela ^ı · fechado –– · surpreso •• · preocupado (olhos baixos e inclinados) ·
 *   pensando (pontos, olhando de um lado para o outro) · comemorando (^^ e pulinhos).
 * Tudo muda com transição, então a cara troca de expressão aos poucos, como no vídeo de referência.
 *
 * `vivo` liga o "diretor": de tempos em tempos ele pisca, olha para os lados e faz uma careta que combina com o humor
 * (ver `useVida`). Com "Animações reduzidas" (html[data-movimento=reduzido]) ele fica parado, com a cara do humor.
 */
export type Careta = Humor | 'piscadela' | 'surpreso' | 'fechado'
type JeitoDoOlho = 'aberto' | 'feliz' | 'fechado' | 'ponto'

const OLHOS: Record<Careta, [JeitoDoOlho, JeitoDoOlho]> = {
  calmo: ['aberto', 'aberto'],
  feliz: ['feliz', 'feliz'],
  comemorando: ['feliz', 'feliz'],
  piscadela: ['feliz', 'aberto'],
  fechado: ['fechado', 'fechado'],
  surpreso: ['ponto', 'ponto'],
  pensando: ['ponto', 'ponto'],
  preocupado: ['aberto', 'aberto'],
}

export function Kairo({ humor = 'calmo', careta, tamanho = 40, vivo, flutua, segue, sombra, rotulo, className = '' }: {
  humor?: Humor
  /** Uma careta forçada por quem usa (o Kairo solto sorri quando o ponteiro passa, por exemplo). Vale sobre o humor. */
  careta?: Careta | null
  tamanho?: number
  /** Pisca, olha em volta e faz caretas sozinho. */
  vivo?: boolean
  /** Sobe e desce devagar, como se boiasse. */
  flutua?: boolean
  /** Os olhos seguem o ponteiro (onde ele aparece grande ou solto na tela). */
  segue?: boolean
  /** A sombra embaixo (quando ele está "no ar"). */
  sombra?: boolean
  /** Sem rótulo, o desenho é decorativo (o texto ao lado já diz quem fala). */
  rotulo?: string
  className?: string
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  const raiz = useRef<HTMLSpanElement>(null)
  useOlharQueSegue(raiz, !!segue)
  const vida = useVida(humor, !!vivo)
  const cara: Careta = careta ?? vida.careta ?? humor
  const [esq, dir] = vida.piscando && cara !== 'feliz' && cara !== 'comemorando' ? ['fechado', 'fechado'] as const : OLHOS[cara]
  const g = (n: string) => `k${id}${n}`
  const estilo = { '--k': `${tamanho}px`, '--ox': `${vida.olhar[0]}px`, '--oy': `${vida.olhar[1]}px` } as CSSProperties
  return (
    <span ref={raiz} className={`kairo k-${humor} c-${cara} ${flutua ? 'flutua' : ''} ${sombra ? 'com-sombra' : ''} ${className}`}
      style={estilo} role={rotulo ? 'img' : undefined} aria-label={rotulo} aria-hidden={rotulo ? undefined : true}>
      <span className="k-mola">
        <svg viewBox="0 0 100 100" className="k-corpo">
          <defs>
            <linearGradient id={g('base')} x1="0.1" y1="0.92" x2="0.9" y2="0.08">
              <stop offset="0" stopColor="#6c3cf3" />
              <stop offset="0.34" stopColor="#2a45e3" />
              <stop offset="0.66" stopColor="#1468e6" />
              <stop offset="1" stopColor="#2ce39c" />
            </linearGradient>
            {/* embaixo ele "acende": a luz que atravessa o vidro */}
            <radialGradient id={g('baixo')} cx="0.5" cy="1.08" r="0.62">
              <stop offset="0" stopColor="#5ff6ff" stopOpacity="1" />
              <stop offset="0.55" stopColor="#3fd6ff" stopOpacity="0.55" />
              <stop offset="1" stopColor="#3fd6ff" stopOpacity="0" />
            </radialGradient>
            <radialGradient id={g('verde')} cx="0.9" cy="0.2" r="0.55">
              <stop offset="0" stopColor="#50f5ad" stopOpacity="0.75" />
              <stop offset="1" stopColor="#50f5ad" stopOpacity="0" />
            </radialGradient>
            <radialGradient id={g('miolo')} cx="0.46" cy="0.42" r="0.5">
              <stop offset="0" stopColor="#1b2fc4" stopOpacity="0.55" />
              <stop offset="1" stopColor="#1b2fc4" stopOpacity="0" />
            </radialGradient>
            {/* a borda macia, mais clara, de vidro fosco */}
            <radialGradient id={g('borda')} cx="0.5" cy="0.5" r="0.5">
              <stop offset="0.78" stopColor="#ffffff" stopOpacity="0" />
              <stop offset="0.96" stopColor="#d9e4ff" stopOpacity="0.32" />
              <stop offset="1" stopColor="#ffffff" stopOpacity="0.45" />
            </radialGradient>
            <radialGradient id={g('brilho')} cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0.5" />
              <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="50" cy="50" r="47" fill={`url(#${g('base')})`} />
          <circle cx="50" cy="50" r="47" fill={`url(#${g('miolo')})`} />
          <circle cx="50" cy="50" r="47" fill={`url(#${g('verde')})`} />
          <circle cx="50" cy="50" r="47" fill={`url(#${g('baixo')})`} />
          <circle cx="50" cy="50" r="47" fill={`url(#${g('borda')})`} />
          <ellipse cx="40" cy="22" rx="26" ry="13" transform="rotate(-18 40 22)" fill={`url(#${g('brilho')})`} />
          <g className="k-olhos">
            <Olho jeito={esq} x={40} lado="esq" />
            <Olho jeito={dir} x={60} lado="dir" />
          </g>
        </svg>
      </span>
    </span>
  )
}

/** Um olho: o tracinho (aberto, fechado, ponto, por escala) e o arquinho (feliz), que trocam com transição. */
function Olho({ jeito, x, lado }: { jeito: JeitoDoOlho; x: number; lado: 'esq' | 'dir' }) {
  return (
    <g className={`k-olho k-${lado}`} data-jeito={jeito}>
      <rect className="k-traco" x={x - 3.4} y={41.5} width={6.8} height={19} rx={3.4} />
      <path className="k-arco" d={`M${x - 6} ${53} Q${x} ${43.5} ${x + 6} ${53}`} />
    </g>
  )
}

/**
 * O diretor: o que faz o Kairo parecer vivo. Pisca a cada poucos segundos (às vezes duas vezes seguidas), olha para um
 * lado e para o outro e, de vez em quando, faz uma careta que combina com o humor (feliz pisca o olho; calmo se espanta,
 * sorri ou pisca; preocupado se espanta; pensando procura com os olhos).
 */
function useVida(humor: Humor, ligado: boolean) {
  const [estado, setEstado] = useState<{ piscando: boolean; olhar: [number, number]; careta: Careta | null }>({ piscando: false, olhar: [0, 0], careta: null })
  useEffect(() => {
    if (!ligado) return
    let vivo = true
    const timers: number[] = []
    const depois = (ms: number, f: () => void) => { timers.push(window.setTimeout(() => vivo && f(), ms)) }
    const mudar = (p: Partial<typeof estado>) => setEstado((e) => ({ ...e, ...p }))
    const parado = () => document.documentElement.dataset.movimento === 'reduzido' || document.hidden
    const sorteia = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]
    const OLHARES: [number, number][] = [[-8, 0], [8, 0], [-6, -4], [6, -4], [0, 3], [-4, 2]]
    const proximo = () => depois(humor === 'pensando' ? 900 + Math.random() * 900 : 1500 + Math.random() * 2600, passo)
    const passo = () => {
      if (parado()) { mudar({ piscando: false, olhar: [0, 0], careta: null }); return proximo() }
      const r = Math.random()
      if (humor === 'pensando') {
        mudar({ olhar: sorteia(OLHARES) })
        if (r < 0.25) { mudar({ piscando: true }); depois(130, () => mudar({ piscando: false })) }
        return proximo()
      }
      if (r < 0.45) {
        // piscar (às vezes duas vezes)
        mudar({ piscando: true })
        depois(120, () => mudar({ piscando: false }))
        if (Math.random() < 0.3) { depois(260, () => mudar({ piscando: true })); depois(380, () => mudar({ piscando: false })) }
      } else if (r < 0.8) {
        // olhar em volta e voltar
        mudar({ olhar: sorteia(OLHARES) })
        depois(700 + Math.random() * 900, () => mudar({ olhar: Math.random() < 0.4 ? sorteia(OLHARES) : [0, 0] }))
        depois(1900, () => mudar({ olhar: [0, 0] }))
      } else {
        // uma careta rápida
        const caretas: Careta[] = humor === 'feliz' || humor === 'comemorando' ? ['piscadela', 'fechado']
          : humor === 'preocupado' ? ['surpreso', 'fechado'] : ['piscadela', 'surpreso', 'feliz']
        mudar({ careta: sorteia(caretas) })
        depois(900 + Math.random() * 600, () => mudar({ careta: null }))
      }
      proximo()
    }
    proximo()
    return () => { vivo = false; timers.forEach((t) => window.clearTimeout(t)) }
  }, [humor, ligado])
  return ligado ? estado : { piscando: false, olhar: [0, 0] as [number, number], careta: null }
}

/** Os olhos acompanham o ponteiro, de leve. Um quadro por vez, nada com movimento reduzido. */
function useOlharQueSegue(raiz: React.RefObject<HTMLSpanElement | null>, ligado: boolean) {
  useEffect(() => {
    const el = raiz.current
    if (!ligado || !el || !window.matchMedia('(pointer: fine)').matches) return
    let quadro = 0
    let volta = 0
    const mover = (e: PointerEvent) => {
      if (quadro || document.documentElement.dataset.movimento === 'reduzido') return
      quadro = requestAnimationFrame(() => {
        quadro = 0
        const r = el.getBoundingClientRect()
        const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2)
        const d = Math.hypot(dx, dy) || 1
        const f = Math.min(1, d / 220)
        el.style.setProperty('--px', `${((dx / d) * 7 * f).toFixed(2)}px`)
        el.style.setProperty('--py', `${((dy / d) * 5 * f).toFixed(2)}px`)
        // parado um tempo, o olhar volta para a frente
        window.clearTimeout(volta)
        volta = window.setTimeout(() => { el.style.setProperty('--px', '0px'); el.style.setProperty('--py', '0px') }, 2200)
      })
    }
    window.addEventListener('pointermove', mover, { passive: true })
    return () => { window.removeEventListener('pointermove', mover); cancelAnimationFrame(quadro); window.clearTimeout(volta) }
  }, [raiz, ligado])
}

/** O nome com a marca: "Kairo", com o pingo do i virando uma bolinha, e "seu consultor financeiro" embaixo. */
export function KairoMarca({ sub = true }: { sub?: boolean }) {
  return (
    <span className="kairo-marca">
      <span className="kairo-nome" aria-label="Kairo">Ka<span className="kairo-i">ı<i aria-hidden="true" /></span>ro</span>
      {sub && <small>{tx('Seu consultor financeiro')}</small>}
    </span>
  )
}
