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
