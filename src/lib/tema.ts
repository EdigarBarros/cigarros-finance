import { useSyncExternalStore } from 'react'

/** O que a pessoa escolheu. 'sistema' segue o claro/escuro do aparelho. */
export type PreferenciaTema = 'sistema' | 'claro' | 'escuro'
export type Tema = 'claro' | 'escuro'

const CHAVE = 'opuscash-tema'
const escuroNoSistema = window.matchMedia('(prefers-color-scheme: dark)')

const lerPreferencia = (): PreferenciaTema => {
  try {
    const t = localStorage.getItem(CHAVE)
    return t === 'claro' || t === 'escuro' ? t : 'sistema'
  } catch {
    return 'sistema'
  }
}

let preferencia = lerPreferencia()
const resolver = (p: PreferenciaTema): Tema => (p === 'sistema' ? (escuroNoSistema.matches ? 'escuro' : 'claro') : p)
let estado = { preferencia, tema: resolver(preferencia) }
const ouvintes = new Set<() => void>()

/** Grava o tema no <html> (o CSS lê data-tema) e na cor da barra do navegador. */
function aplicar() {
  const tema = resolver(preferencia)
  estado = { preferencia, tema }
  document.documentElement.dataset.tema = tema
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', tema === 'escuro' ? '#090d18' : '#f4f6fb')
  ouvintes.forEach((f) => f())
}

aplicar()
escuroNoSistema.addEventListener('change', () => preferencia === 'sistema' && aplicar())

const assinar = (f: () => void) => {
  ouvintes.add(f)
  return () => ouvintes.delete(f)
}

export function useTema() {
  return useSyncExternalStore(assinar, () => estado)
}

/**
 * Troca o tema. Com `origem` (o ponto do clique), o tema novo se espalha num círculo a partir dali,
 * onde o navegador tem View Transitions; nos outros a troca é direta.
 */
export function definirTema(p: PreferenciaTema, origem?: { x: number; y: number }) {
  try {
    if (p === 'sistema') localStorage.removeItem(CHAVE)
    else localStorage.setItem(CHAVE, p)
  } catch { /* navegação privada: vale só nesta visita */ }
  const mudar = () => { preferencia = p; aplicar() }
  const doc = document as Document & { startViewTransition?: (f: () => void) => { ready: Promise<void> } }
  const semMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!origem || !doc.startViewTransition || semMovimento || resolver(p) === estado.tema) return mudar()
  const raio = Math.hypot(Math.max(origem.x, innerWidth - origem.x), Math.max(origem.y, innerHeight - origem.y))
  document.documentElement.classList.add('trocando-tema')
  const t = doc.startViewTransition(mudar)
  t.ready.then(() => {
    document.documentElement.animate(
      { clipPath: [`circle(0px at ${origem.x}px ${origem.y}px)`, `circle(${raio}px at ${origem.x}px ${origem.y}px)`] },
      { duration: 700, easing: 'cubic-bezier(.65, 0, .35, 1)', pseudoElement: '::view-transition-new(root)' },
    ).finished.finally(() => document.documentElement.classList.remove('trocando-tema'))
  }).catch(() => document.documentElement.classList.remove('trocando-tema'))
}

/** Cores que o Chart.js precisa em JS (o canvas não lê variáveis CSS). */
export const coresDoGrafico = (t: Tema) => t === 'escuro'
  ? { texto: 'rgba(214, 222, 240, .62)', textoForte: '#f2f5fb', grade: 'rgba(148, 163, 196, .1)', eixo: 'rgba(148, 163, 196, .22)', tooltip: 'rgba(16, 22, 38, .96)', tooltipBorda: 'rgba(148, 163, 196, .18)', fundo: '#0f1526' }
  : { texto: 'rgba(40, 52, 82, .62)', textoForte: '#121a2e', grade: 'rgba(30, 45, 80, .08)', eixo: 'rgba(30, 45, 80, .16)', tooltip: 'rgba(255, 255, 255, .98)', tooltipBorda: 'rgba(30, 45, 80, .12)', fundo: '#ffffff' }
