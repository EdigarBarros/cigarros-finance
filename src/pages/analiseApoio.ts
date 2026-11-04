import { useEffect, useRef, useState } from 'react'
import type { Tom } from '../lib/analise'
export { fmtCurto } from '../lib/visuais'

/** Apoio dos gráficos do consultor (pages/AnaliseGraficos.tsx): cor de cada tom, valor curto e o gatilho da animação. */

export const COR_DO_TOM: Record<Tom, string> = { bom: 'var(--entrada)', medio: 'var(--divida)', ruim: 'var(--saida)' }

/** true quando o elemento entra na tela (uma vez só): é a deixa para a animação começar. */
export function useEmVista<T extends Element>() {
  const ref = useRef<T>(null)
  const [vivo, setVivo] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      queueMicrotask(() => setVivo(true))
      return
    }
    const o = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        setVivo(true)
        o.disconnect()
      }
    }, { threshold: 0.2 })
    o.observe(el)
    return () => o.disconnect()
  }, [])
  return [ref, vivo] as const
}

export interface PreferenciasVisuais {
  favoritos: string[]
  escondidos: string[]
  /** Quantas vezes a pessoa mexeu em cada gráfico. */
  toques: Record<string, number>
}

const VAZIAS: PreferenciasVisuais = { favoritos: [], escondidos: [], toques: {} }

/**
 * O que cada pessoa prefere ver no consultor (guardado no navegador dela): favoritos vão para o topo, escondidos saem e os
 * gráficos em que ela mais mexe sobem sozinhos. É o que faz a tela de cada um ficar diferente com o uso.
 */
export function usePreferenciasVisuais(id: string) {
  const chave = `opuscash:graficos:${id}`
  const [p, setP] = useState<PreferenciasVisuais>(() => {
    try { return { ...VAZIAS, ...(JSON.parse(localStorage.getItem(chave) ?? 'null') as Partial<PreferenciasVisuais> | null) } } catch { return VAZIAS }
  })
  useEffect(() => {
    try { localStorage.setItem(chave, JSON.stringify(p)) } catch { /* sem armazenamento: vale só nesta visita */ }
  }, [chave, p])
  const alternar = (lista: 'favoritos' | 'escondidos', vid: string) =>
    setP((x) => ({ ...x, [lista]: x[lista].includes(vid) ? x[lista].filter((y) => y !== vid) : [...x[lista], vid] }))
  return {
    ...p,
    favoritar: (vid: string) => alternar('favoritos', vid),
    esconder: (vid: string) => setP((x) => ({ ...x, escondidos: [...new Set([...x.escondidos, vid])], favoritos: x.favoritos.filter((y) => y !== vid) })),
    mostrarTodos: () => setP((x) => ({ ...x, escondidos: [] })),
    tocar: (vid: string) => setP((x) => ({ ...x, toques: { ...x.toques, [vid]: Math.min(50, (x.toques[vid] ?? 0) + 1) } })),
    /** Quanto o uso puxa o gráfico para cima: favorito vai ao topo; cada toque vale um pouco, até um teto. */
    peso: (vid: string) => (p.favoritos.includes(vid) ? 1000 : 0) + Math.min(15, (p.toques[vid] ?? 0) * 2),
  }
}
