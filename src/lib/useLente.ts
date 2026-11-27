import { createElement, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'

export interface Lente {
  x: number; y: number; w: number; h: number
  /** Para onde andou desde a última medida (-1, 0 ou 1): decide qual borda vai na frente. */
  dx: number; dy: number
}

/*
 * Lente elástica, como nos painéis de referência do dono: a borda que vai na frente corre (0,36 s, saída forte) e a de trás
 * alcança depois (0,55 s, começa e termina devagar), então a lente estica no caminho e encolhe ao chegar. As quatro bordas
 * são propriedades CSS registradas (@property), que o navegador anima. Sem esse recurso (navegador antigo), a lente anda
 * como antes, inteira.
 */
const FRENTE = '.36s cubic-bezier(.215, .61, .355, 1)'
const TRAS = '.55s cubic-bezier(.645, .045, .355, 1)'
const BORDAS = ['--lente-x0', '--lente-x1', '--lente-y0', '--lente-y1'] as const

const elastica = (() => {
  try {
    const css = (globalThis as { CSS?: { registerProperty?: (d: object) => void } }).CSS
    if (!css?.registerProperty) return false
    for (const name of BORDAS) {
      try { css.registerProperty({ name, syntax: '<length>', inherits: false, initialValue: '0px' }) } catch { /* já registrada */ }
    }
    return true
  } catch { return false }
})()

/**
 * Mede o item ativo dentro de um grupo (abas, menu, segmentado) para uma "lente" de vidro
 * deslizar até ele com mola, em vez de o destaque pular de um item para o outro.
 */
export function useLente(ref: RefObject<HTMLElement | null>, seletor: string, chave: unknown, alvos?: string): Lente | null {
  const [lente, setLente] = useState<Lente | null>(null)
  const antes = useRef<Lente | null>(null)
  const ir = (el: HTMLElement | null) => {
    if (!el) { setLente(null); return }
    const a = antes.current
    const x = el.offsetLeft, y = el.offsetTop, w = el.offsetWidth, h = el.offsetHeight
    if (a && a.x === x && a.y === y && a.w === w && a.h === h) return
    const nova = { x, y, w, h, dx: a ? Math.sign(x - a.x) : 0, dy: a ? Math.sign(y - a.y) : 0 }
    antes.current = nova
    setLente(nova)
  }
  // Resposta na hora (`alvos`): ao apertar um dos botões, a lente já sai para ele, antes de a tela nova ser desenhada. Se o
  // clique não acontece (o ponteiro saiu do botão), ela volta para o ativo de verdade.
  useEffect(() => {
    const caixa = ref.current
    if (!caixa || !alvos) return
    let volta = 0
    const apertou = (e: PointerEvent) => {
      if (e.button !== 0) return
      const el = (e.target as Element | null)?.closest<HTMLElement>(alvos)
      if (!el || !caixa.contains(el)) return
      ir(el)
      window.clearTimeout(volta)
      volta = window.setTimeout(() => ir(caixa.querySelector<HTMLElement>(seletor)), 900)
    }
    caixa.addEventListener('pointerdown', apertou)
    return () => { caixa.removeEventListener('pointerdown', apertou); window.clearTimeout(volta) }
  }, [ref, seletor, alvos]) // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const caixa = ref.current
    if (!caixa) return
    const medir = () => ir(caixa.querySelector<HTMLElement>(seletor))
    medir()
    let quadro = 0
    const ro = new ResizeObserver(() => { cancelAnimationFrame(quadro); quadro = requestAnimationFrame(medir) })
    ro.observe(caixa)
    return () => { cancelAnimationFrame(quadro); ro.disconnect() }
  }, [ref, seletor, chave])
  return lente
}

export const estiloLente = (l: Lente): CSSProperties => {
  if (!elastica) return { transform: `translate(${l.x}px, ${l.y}px)`, width: l.w, height: l.h }
  // indo para a direita, a borda direita vai na frente; para baixo, a de baixo; parado no eixo, as duas juntas
  const tx0 = l.dx > 0 ? TRAS : FRENTE, tx1 = l.dx < 0 ? TRAS : FRENTE
  const ty0 = l.dy > 0 ? TRAS : FRENTE, ty1 = l.dy < 0 ? TRAS : FRENTE
  return {
    '--lente-x0': `${l.x}px`, '--lente-x1': `${l.x + l.w}px`, '--lente-y0': `${l.y}px`, '--lente-y1': `${l.y + l.h}px`,
    transform: 'translate(var(--lente-x0), var(--lente-y0))',
    width: 'calc(var(--lente-x1) - var(--lente-x0))',
    height: 'calc(var(--lente-y1) - var(--lente-y0))',
    transition: `--lente-x0 ${tx0}, --lente-x1 ${tx1}, --lente-y0 ${ty0}, --lente-y1 ${ty1}, background-color .2s, box-shadow .2s, opacity .2s`,
  } as CSSProperties
}

/** Posição da lente durante um arraste (o dedo leva a lente): grava as bordas, para ela sair dali com a animação ao soltar. */
export function porLente(el: HTMLElement, x: number, y: number, w: number, h: number) {
  el.style.transform = `translate(${x}px, ${y}px)`
  el.style.width = `${w}px`
  el.style.height = `${h}px`
  if (!elastica) return
  el.style.setProperty('--lente-x0', `${x}px`); el.style.setProperty('--lente-x1', `${x + w}px`)
  el.style.setProperty('--lente-y0', `${y}px`); el.style.setProperty('--lente-y1', `${y + h}px`)
}

/**
 * A lente como componente à parte: medir e mover a lente redesenha só ela, não a tela inteira que a contém (no painel,
 * isso fazia o clique no menu esperar o painel todo ser redesenhado antes de a lente sair do lugar).
 */
export function LenteDe({ caixa, seletor, chave, className, alvos }: {
  caixa: RefObject<HTMLElement | null>; seletor: string; chave: unknown; className: string
  /** Botões que levam a lente na hora em que são apertados (os que mudam o item ativo). */
  alvos?: string
}) {
  const l = useLente(caixa, seletor, chave, alvos)
  return l ? createElement('span', { className, 'aria-hidden': true, style: estiloLente(l) }) : null
}
