import { useEffect, type RefObject } from 'react'

/**
 * "Macia", a escolhida pelo dono entre quatro jeitos testados: começa e termina devagar (sem o tranco de quem arranca
 * rápido) e espera um instante antes de abrir, para o mouse que só passa de raspão não abrir nada.
 */
const DURACAO = 420
const CURVA = 'cubic-bezier(.65, 0, .35, 1)'
/** Espera antes de abrir do nada (ms). Trocar de um círculo aberto para o vizinho é na hora. */
const ESPERA_ABRIR = 90
/** Espera antes de fechar quando o mouse sai (ms): sair e voltar logo não fecha e reabre. */
const ESPERA_FECHAR = 40

/**
 * Barra de cima do computador (components/Painel.tsx): cada atalho `[data-elastico]` é um círculo que se estica ao passar o
 * mouse (ou com o foco do teclado) e mostra o nome, e os vizinhos abrem espaço.
 *
 * Para ficar liso, nada é animado no layout: o tamanho muda de uma vez (atributo `data-aberto`) e o que
 * se vê anda do lugar antigo para o novo só com `transform` (técnica FLIP) e com a largura do fundo (`::before`, absoluto, que
 * não empurra ninguém). Uma animação interrompida no meio continua de onde estava.
 */
export function useBarraElastica(ref: RefObject<HTMLElement | null>, ligada: boolean) {
  useEffect(() => {
    if (!ligada) return
    // a barra pode ainda não existir (tela carregando): tudo é procurado na hora, e os ouvintes ficam no documento
    const grupoAgora = () => ref.current?.querySelector<HTMLElement>('.barra-direita') ?? null
    const reduzido = matchMedia('(prefers-reduced-motion: reduce)')
    // o mês também anda quando a coluna da direita cresce (tela estreita)
    const todos = () => {
      const barra = ref.current
      return barra ? [...barra.querySelectorAll<HTMLElement>('.barra-direita [data-elastico], :scope > .seletor-mes')] : []
    }

    let sobMouse: HTMLElement | null = null
    let comFoco: HTMLElement | null = null
    let aberto: HTMLElement | null = null

    const trocar = (alvo: HTMLElement | null) => {
      if (alvo === aberto) return
      const lista = todos()
      // onde cada um aparece agora (com a animação que estiver no meio)
      const antes = new Map(lista.map((el) => [el, { x: el.getBoundingClientRect().left, w: parseFloat(getComputedStyle(el, '::before').width) || el.offsetWidth }]))
      for (const el of lista) el.getAnimations({ subtree: true }).forEach((a) => a.cancel())
      ref.current?.querySelectorAll('[data-saindo]').forEach((x) => x.removeAttribute('data-saindo'))

      const saindo = aberto
      saindo?.removeAttribute('data-aberto')
      alvo?.setAttribute('data-aberto', '')
      aberto = alvo
      if (reduzido.matches) return

      // o nome de quem fecha fica por cima, solto, enquanto some
      const rotuloQueSai = saindo?.querySelector<HTMLElement>(':scope > .pilula-rotulo')
      if (rotuloQueSai) {
        rotuloQueSai.setAttribute('data-saindo', '')
        rotuloQueSai.animate([{ opacity: 1 }, { opacity: 0 }], { duration: DURACAO * 0.6, easing: CURVA, fill: 'forwards' })
          .finished.then(() => rotuloQueSai.removeAttribute('data-saindo'), () => {})
      }
      for (const el of lista) {
        const a = antes.get(el)!
        const dx = a.x - el.getBoundingClientRect().left
        if (Math.abs(dx) > 0.5) el.animate([{ transform: `translateX(${dx}px)` }, { transform: 'translateX(0)' }], { duration: DURACAO, easing: CURVA })
        if (!el.hasAttribute('data-elastico')) continue
        const w = el.offsetWidth
        if (Math.abs(a.w - w) < 0.5) continue
        el.animate([{ width: `${a.w}px` }, { width: `${w}px` }], { duration: DURACAO, easing: CURVA, pseudoElement: '::before' })
        // o nome (o que entra e o que sai) não passa da borda do fundo enquanto ele estica ou encolhe
        el.animate([{ clipPath: `inset(-2px ${w - a.w}px -2px 0 round 999px)` }, { clipPath: 'inset(-2px 0px -2px 0 round 999px)' }], { duration: DURACAO, easing: CURVA })
      }
      // o nome de quem abre aparece depois que o fundo começou a crescer
      alvo?.querySelector<HTMLElement>(':scope > .pilula-rotulo')?.animate(
        [{ opacity: 0, transform: 'translateX(-6px)' }, { opacity: 0, transform: 'translateX(-4px)', offset: 0.4 }, { opacity: 1, transform: 'translateX(0)' }],
        { duration: DURACAO, easing: 'linear' },
      )
    }

    // o que fica aberto: o que está sob o mouse; senão, o que tem o foco do teclado; senão, o que tem o menu aberto
    let espera = 0
    const decidir = () => {
      // um círculo que saiu da tela (a barra foi refeita) não conta mais
      if (aberto && !aberto.isConnected) aberto = null
      const alvo = sobMouse ?? comFoco ?? grupoAgora()?.querySelector<HTMLElement>('[data-elastico][aria-expanded="true"]') ?? null
      window.clearTimeout(espera)
      const ms = !alvo && aberto ? ESPERA_FECHAR : alvo && !aberto && alvo === sobMouse ? ESPERA_ABRIR : 0
      if (ms && !reduzido.matches) espera = window.setTimeout(() => trocar(alvo), ms)
      else trocar(alvo)
    }
    const item = (t: EventTarget | null) => (t instanceof Element ? t.closest<HTMLElement>('.barra-direita [data-elastico]') : null)
    const noGrupo = (t: EventTarget | null) => t instanceof Element && Boolean(t.closest('.barra-direita'))

    const sobre = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      if (!noGrupo(e.target)) { if (sobMouse) { sobMouse = null; decidir() } return }
      const el = item(e.target)
      // entre dois círculos (no espaço vazio) continua aberto o último: nada pisca ao passar de um para o outro
      if (el && el !== sobMouse) { sobMouse = el; decidir() }
    }
    const saiuDaJanela = (e: PointerEvent) => { if (!e.relatedTarget && sobMouse) { sobMouse = null; decidir() } }
    const focou = (e: FocusEvent) => {
      const el = item(e.target)
      comFoco = el && (e.target as Element).matches(':focus-visible') ? el : null
      decidir()
    }
    const menus = new MutationObserver((mudancas) => { if (mudancas.some((m) => noGrupo(m.target))) decidir() })
    menus.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['aria-expanded'] })

    document.addEventListener('pointerover', sobre)
    document.addEventListener('pointerout', saiuDaJanela)
    document.addEventListener('focusin', focou)
    return () => {
      window.clearTimeout(espera)
      document.removeEventListener('pointerover', sobre)
      document.removeEventListener('pointerout', saiuDaJanela)
      document.removeEventListener('focusin', focou)
      menus.disconnect()
      aberto?.removeAttribute('data-aberto')
    }
  }, [ref, ligada])
}
