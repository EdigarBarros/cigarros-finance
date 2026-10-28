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

// ---------- animações ----------
// O app tem a própria escolha de animações: o "reduzir movimento" do sistema (que no Windows vem desligando
// os efeitos de animação) não tira as animações sozinho. Quem prefere menos movimento escolhe em Configurações.
export type Movimento = 'completo' | 'reduzido'
const CHAVE_MOVIMENTO = 'opuscash-movimento'
let movimento: Movimento = (() => {
  try {
    return localStorage.getItem(CHAVE_MOVIMENTO) === 'reduzido' ? 'reduzido' : 'completo'
  } catch {
    return 'completo'
  }
})()
const ouvintesMovimento = new Set<() => void>()
const aplicarMovimento = () => {
  document.documentElement.dataset.movimento = movimento
  ouvintesMovimento.forEach((f) => f())
}
aplicarMovimento()

/** true quando a pessoa escolheu animações reduzidas. */
export const semMovimento = () => movimento === 'reduzido'
export function useMovimento() {
  return useSyncExternalStore((f) => { ouvintesMovimento.add(f); return () => ouvintesMovimento.delete(f) }, () => movimento)
}
export function definirMovimento(m: Movimento) {
  movimento = m
  try { localStorage.setItem(CHAVE_MOVIMENTO, m) } catch { /* vale só nesta visita */ }
  aplicarMovimento()
}

/**
 * Contorno de uma mancha de tinta: um círculo com a borda ondulada que muda de forma enquanto cresce
 * (como a troca de tema do vídeo de referência). Sempre com o mesmo número de pontos, para o navegador
 * conseguir animar de um quadro para o outro.
 */
function mancha(cx: number, cy: number, r: number, fase: number, pontos = 72) {
  const ps: string[] = []
  for (let i = 0; i < pontos; i++) {
    const a = (i / pontos) * Math.PI * 2
    const k = 1 + 0.15 * Math.sin(3 * a + fase) + 0.08 * Math.sin(5 * a - fase * 1.7) + 0.05 * Math.sin(2 * a + fase * 0.6)
    ps.push(`${(cx + Math.cos(a) * r * k).toFixed(1)}px ${(cy + Math.sin(a) * r * k).toFixed(1)}px`)
  }
  return `polygon(${ps.join(', ')})`
}

/** Quadros da mancha saindo de `origem` até cobrir a tela inteira. */
function quadrosDaMancha(origem: { x: number; y: number }) {
  // a borda pode entrar até 28% para dentro: o raio final compensa para não sobrar canto descoberto
  const longe = Math.hypot(Math.max(origem.x, innerWidth - origem.x), Math.max(origem.y, innerHeight - origem.y))
  const final = (longe / 0.72) * 1.04
  const n = 18
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n
    const cresce = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
    return mancha(origem.x, origem.y, Math.max(1, final * cresce), t * 3.2)
  })
}
const DURACAO_TINTA = 950

/**
 * Troca o tema. Com `origem` (o ponto do clique), o tema novo se espalha como uma mancha de tinta a partir dali.
 * Com View Transitions, a página nova aparece por dentro da mancha; nos navegadores sem, uma camada da cor do
 * tema novo se espalha, o tema troca por baixo dela e ela some.
 */
export function definirTema(p: PreferenciaTema, origem?: { x: number; y: number }) {
  try {
    if (p === 'sistema') localStorage.removeItem(CHAVE)
    else localStorage.setItem(CHAVE, p)
  } catch { /* navegação privada: vale só nesta visita */ }
  const mudar = () => { preferencia = p; aplicar() }
  if (!origem || semMovimento() || resolver(p) === estado.tema) return mudar()
  const raiz = document.documentElement
  const quadros = quadrosDaMancha(origem)
  const doc = document as Document & { startViewTransition?: (f: () => void) => { ready: Promise<void>; finished: Promise<void> } }
  if (doc.startViewTransition) {
    raiz.classList.add('trocando-tema')
    const t = doc.startViewTransition(mudar)
    t.ready.then(() => {
      raiz.animate({ clipPath: quadros }, { duration: DURACAO_TINTA, easing: 'linear', pseudoElement: '::view-transition-new(root)' })
    }).catch(() => {})
    t.finished.finally(() => raiz.classList.remove('trocando-tema'))
    return
  }
  const tinta = document.createElement('div')
  tinta.className = 'tinta'
  tinta.style.background = resolver(p) === 'escuro' ? '#070b14' : '#f3f5fa'
  document.body.appendChild(tinta)
  tinta.animate({ clipPath: quadros }, { duration: DURACAO_TINTA, easing: 'linear', fill: 'forwards' }).finished.then(() => {
    mudar()
    return tinta.animate({ opacity: [1, 0] }, { duration: 280, fill: 'forwards' }).finished
  }).finally(() => tinta.remove())
}

/** Cores que o Chart.js precisa em JS (o canvas não lê variáveis CSS). */
export const coresDoGrafico = (t: Tema) => t === 'escuro'
  ? { texto: 'rgba(214, 222, 240, .62)', textoForte: '#f2f5fb', grade: 'rgba(148, 163, 196, .1)', eixo: 'rgba(148, 163, 196, .22)', tooltip: 'rgba(16, 22, 38, .96)', tooltipBorda: 'rgba(148, 163, 196, .18)', fundo: '#0f1526' }
  : { texto: 'rgba(40, 52, 82, .62)', textoForte: '#121a2e', grade: 'rgba(30, 45, 80, .08)', eixo: 'rgba(30, 45, 80, .16)', tooltip: 'rgba(255, 255, 255, .98)', tooltipBorda: 'rgba(30, 45, 80, .12)', fundo: '#ffffff' }
