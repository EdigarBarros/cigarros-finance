/**
 * Reflexo de luz que acompanha o ponteiro sobre o vidro (como no visionOS/macOS): grava a posição
 * do mouse em --mx/--my no elemento sob ele, no máximo uma vez por quadro.
 */
const ALVOS = '.kpi, .banco-cartao, .cartao, .quadro, .bloco, .hero, .btn, .item-lanc, .quadro-linha, .banco-linha'

export function iniciarBrilho() {
  if (!window.matchMedia('(hover: hover)').matches) return
  let quadro = 0
  let ultimo: PointerEvent | null = null
  window.addEventListener(
    'pointermove',
    (e) => {
      ultimo = e
      if (quadro) return
      quadro = requestAnimationFrame(() => {
        quadro = 0
        const ev = ultimo
        if (!ev) return
        const el = (ev.target as Element | null)?.closest<HTMLElement>(ALVOS)
        if (!el) return
        const r = el.getBoundingClientRect()
        el.style.setProperty('--mx', `${ev.clientX - r.left}px`)
        el.style.setProperty('--my', `${ev.clientY - r.top}px`)
      })
    },
    { passive: true },
  )
}
