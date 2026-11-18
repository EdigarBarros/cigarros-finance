import { semMovimento } from './tema'

/**
 * O "pulinho 3D" dos cartões no computador: com o mouse em cima, o cartão sobe um pouco, cresce um tico e inclina para
 * o lado do mouse, como uma peça que flutua; ao sair, volta para o lugar.
 *
 * Por que não é uma transição de CSS: a transição recomeça do zero (com velocidade zero) toda vez que o mouse entra ou
 * sai, e passar o mouse rápido por vários cartões dá trancos. Aqui cada cartão é uma mola de verdade (como o `quickTo`
 * do GSAP nos sites de referência): ele persegue o alvo com a velocidade que já tinha, então entrar, sair e mexer o
 * mouse no meio do caminho emendam sem quebra. A mola é um pouco abaixo do amortecimento crítico: um assentamento calmo,
 * com um quase nada de balanço no fim.
 *
 * Só mexe em `transform` (a placa de vídeo faz o resto, sem redesenhar a página) e, parado, tira o estilo de vez (o texto
 * volta a ficar nítido). Só com mouse; toque e "animações reduzidas" ficam de fora.
 *
 * `seletor`: os elementos que flutuam (procurados a partir do alvo do evento). Um pode estar dentro do outro (a faixa do
 * topo e os botões dela): com o mouse no botão, os dois flutuam, cada um com a sua mola. Cada elemento pode dizer quanto
 * inclina (`data-3d="<graus>"`, padrão 3), quanto sobe (`data-sobe="<px>"`, padrão 6) e quanto cresce
 * (`data-cresce="<fração>"`, padrão 0,012). Devolve a função que desliga.
 */
export function ligarMola3d(raiz: HTMLElement, seletor: string): () => void {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return () => {}

  /** Rigidez e atrito da mola: ζ = 18 / (2·√120) ≈ 0,82 → sobe em ~0,35 s e assenta em ~0,7 s, sem tranco. */
  const RIGIDEZ = 120
  const ATRITO = 18

  type Canal = { x: number; v: number; alvo: number }
  /** `base`: onde o cartão fica parado (medido sem a transformação, com a rolagem da hora). Decidir "o mouse está em
   *  cima?" pela posição transformada faria o cartão tremer: ele sobe, a borda foge do mouse, ele desce, o mouse volta… */
  interface Estado { y: Canal; s: Canal; rx: Canal; ry: Canal; base: DOMRect; rolagem: number; sobe: number; cresce: number }
  const estados = new Map<HTMLElement, Estado>()
  const canal = (): Canal => ({ x: 0, v: 0, alvo: 0 })
  let quadro = 0
  let antes = 0

  const estado = (el: HTMLElement) => {
    let e = estados.get(el)
    if (!e) {
      const t = el.style.transform
      el.style.transform = ''
      const base = el.getBoundingClientRect()
      el.style.transform = t
      e = {
        y: canal(), s: canal(), rx: canal(), ry: canal(), base, rolagem: window.scrollY,
        sobe: Number(el.dataset.sobe ?? 6), cresce: Number(el.dataset.cresce ?? 0.012),
      }
      estados.set(el, e)
    }
    return e
  }
  /** O retângulo de repouso, na posição de agora da tela (a página pode ter rolado desde a medida). */
  const repouso = (e: Estado) => {
    const d = window.scrollY - e.rolagem
    return { left: e.base.left, right: e.base.right, top: e.base.top - d, bottom: e.base.bottom - d, width: e.base.width, height: e.base.height }
  }
  const dentro = (el: HTMLElement, x: number, y: number) => {
    const e = estados.get(el)
    if (!e) return false
    const b = repouso(e)
    return x >= b.left && x <= b.right && y >= b.top && y <= b.bottom
  }

  const passo = (agora: number) => {
    // passos pequenos e fixos: a mola não "explode" se um quadro atrasar
    const dt = Math.min(0.05, (agora - (antes || agora)) / 1000)
    antes = agora
    const n = Math.max(1, Math.ceil(dt / (1 / 120)))
    const h = dt / n
    let algumMexendo = false
    for (const [el, e] of estados) {
      let mexendo = false
      for (const c of [e.y, e.s, e.rx, e.ry]) {
        for (let i = 0; i < n; i++) {
          const a = -RIGIDEZ * (c.x - c.alvo) - ATRITO * c.v
          c.v += a * h
          c.x += c.v * h
        }
        if (Math.abs(c.x - c.alvo) > 0.002 || Math.abs(c.v) > 0.002) mexendo = true
        else { c.x = c.alvo; c.v = 0 }
      }
      const parado = !mexendo && e.y.alvo === 0 && e.rx.alvo === 0 && e.ry.alvo === 0 && e.s.alvo === 0
      if (parado) {
        el.style.transform = ''
        estados.delete(el)
        continue
      }
      algumMexendo = algumMexendo || mexendo
      el.style.transform =
        `perspective(1100px) translate3d(0, ${(-e.y.x * e.sobe).toFixed(2)}px, 0) rotateX(${e.rx.x.toFixed(3)}deg) rotateY(${e.ry.x.toFixed(3)}deg) scale(${(1 + e.s.x * e.cresce).toFixed(4)})`
    }
    quadro = estados.size && algumMexendo ? requestAnimationFrame(passo) : 0
    if (!quadro) antes = 0
  }
  const andar = () => { if (!quadro) { antes = 0; quadro = requestAnimationFrame(passo) } }

  /** Para onde o cartão inclina: o lado do mouse desce um pouco, como uma placa apoiada no meio. */
  const mirar = (el: HTMLElement, x: number, y: number) => {
    const e = estado(el)
    const b = repouso(e)
    const graus = Number(el.dataset['3d'] ?? 3)
    const px = Math.max(0, Math.min(1, (x - b.left) / b.width)) - 0.5
    const py = Math.max(0, Math.min(1, (y - b.top) / b.height)) - 0.5
    e.y.alvo = 1
    e.s.alvo = 1
    e.rx.alvo = -py * 2 * graus
    e.ry.alvo = px * 2 * graus
    el.dataset.flutua = ''
    andar()
  }
  const soltar = (el: HTMLElement) => {
    const e = estados.get(el)
    delete el.dataset.flutua
    if (!e) return
    e.y.alvo = e.s.alvo = e.rx.alvo = e.ry.alvo = 0
    andar()
  }

  /** Os que estão flutuando agora (o de fora e os de dentro dele, como a faixa e um botão dela). */
  let atuais = new Set<HTMLElement>()
  const aoMover = (ev: PointerEvent) => {
    if (ev.pointerType !== 'mouse' || semMovimento()) return
    const novos = new Set<HTMLElement>()
    // o elemento debaixo do mouse e os que o contêm
    for (let el = (ev.target as Element | null)?.closest<HTMLElement>(seletor) ?? null; el; el = el.parentElement?.closest<HTMLElement>(seletor) ?? null) novos.add(el)
    // ainda dentro do lugar de repouso: continua flutuando (mesmo que, levantado, tenha saído de baixo do mouse)
    for (const el of atuais) if (!novos.has(el) && dentro(el, ev.clientX, ev.clientY)) novos.add(el)
    for (const el of atuais) if (!novos.has(el)) soltar(el)
    atuais = novos
    for (const el of novos) mirar(el, ev.clientX, ev.clientY)
  }
  const aoSair = () => { for (const el of atuais) soltar(el); atuais = new Set() }

  raiz.addEventListener('pointermove', aoMover)
  raiz.addEventListener('pointerleave', aoSair)
  return () => {
    raiz.removeEventListener('pointermove', aoMover)
    raiz.removeEventListener('pointerleave', aoSair)
    if (quadro) cancelAnimationFrame(quadro)
    for (const el of estados.keys()) { el.style.transform = ''; delete el.dataset.flutua }
    estados.clear()
  }
}
