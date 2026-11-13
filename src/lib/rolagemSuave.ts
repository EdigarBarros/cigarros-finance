import { semMovimento } from './tema'

/**
 * Rolagem com inércia para a rodinha do mouse (usada na página de apresentação).
 *
 * No celular, o arrasto já tem inércia: a página desliza e vai freando, e a animação 3D acompanha quadro a quadro.
 * No computador, cada clique da rodinha pula ~100px de uma vez e para, e a animação anda aos trancos. Aqui cada clique
 * empurra um alvo e a página desliza até ele freando aos poucos; cliques seguidos se emendam num movimento só.
 *
 * Fica de fora (o navegador cuida, como antes): toque, touchpad (já manda movimentos pequenos e suaves), Ctrl + rodinha
 * (zoom), rolagem lateral, listas com rolagem própria (menu de idioma), teclado, barra de rolagem e quem pediu menos
 * movimento (no sistema ou nas Configurações do OpusCash).
 *
 * Devolve a função que desliga.
 */
export function ligarRolagemSuave(): () => void {
  if (!window.matchMedia('(pointer: fine)').matches) return () => {}

  /** Quanto maior, mais rápido chega ao alvo (por segundo). ~7: desliza por uns 0,4 s depois do último clique. */
  const FIRMEZA = 7
  let alvo = window.scrollY
  let atual = window.scrollY
  let quadro = 0
  let antes = 0
  /** A posição que esta rolagem pôs por último: um scroll diferente dela veio de outro lugar (teclado, barra…). */
  let posta = -1

  const maximo = () => document.documentElement.scrollHeight - window.innerHeight
  const parar = () => {
    if (quadro) cancelAnimationFrame(quadro)
    quadro = 0
    alvo = atual = window.scrollY
  }

  const passo = (agora: number) => {
    const dt = Math.min(0.05, (agora - (antes || agora)) / 1000)
    antes = agora
    atual += (alvo - atual) * (1 - Math.exp(-FIRMEZA * dt))
    if (Math.abs(alvo - atual) < 0.5) atual = alvo
    posta = Math.round(atual)
    window.scrollTo({ top: atual, behavior: 'instant' })
    quadro = atual === alvo ? 0 : requestAnimationFrame(passo)
  }

  /** Algum elemento entre o alvo do evento e a página rola sozinho nessa direção? Então ele recebe a rodinha. */
  const temRolagemPropria = (el: EventTarget | null, dy: number) => {
    for (let n = el instanceof Element ? el : null; n && n !== document.body; n = n.parentElement) {
      const oy = getComputedStyle(n).overflowY
      if ((oy === 'auto' || oy === 'scroll') && n.scrollHeight > n.clientHeight) {
        if (dy > 0 ? n.scrollTop + n.clientHeight < n.scrollHeight - 1 : n.scrollTop > 0) return true
      }
    }
    return false
  }

  const aoGirar = (e: WheelEvent) => {
    if (e.defaultPrevented || e.ctrlKey || semMovimento() || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return
    const dy = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaMode === 2 ? e.deltaY * window.innerHeight : e.deltaY
    // touchpad: movimentos pequenos e contínuos, que o navegador já desenha suaves
    if (e.deltaMode === 0 && Math.abs(dy) < 40) { if (quadro) parar(); return }
    if (temRolagemPropria(e.target, dy)) return
    e.preventDefault()
    if (!quadro) { alvo = atual = window.scrollY; antes = 0 }
    alvo = Math.max(0, Math.min(maximo(), alvo + dy))
    if (!quadro) quadro = requestAnimationFrame(passo)
  }

  // rolagem que não veio daqui (teclado, barra, link, scrollTo da página): para de deslizar e segue a página
  const aoRolar = () => {
    if (quadro && Math.abs(window.scrollY - posta) > 2) parar()
    else if (!quadro) alvo = atual = window.scrollY
  }

  window.addEventListener('wheel', aoGirar, { passive: false })
  window.addEventListener('scroll', aoRolar, { passive: true })
  return () => {
    window.removeEventListener('wheel', aoGirar)
    window.removeEventListener('scroll', aoRolar)
    if (quadro) cancelAnimationFrame(quadro)
  }
}
