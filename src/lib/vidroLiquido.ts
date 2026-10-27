import { useEffect, type RefObject } from 'react'

/**
 * Refração "Liquid Glass": um mapa de deslocamento (feDisplacementMap) faz o que está atrás do vidro
 * entortar perto das bordas, como numa lente grossa. O mapa é gerado para o tamanho e o arredondamento
 * exatos de cada elemento.
 *
 * Só o Chromium aplica filtros SVG em backdrop-filter. Nos outros navegadores nada muda: o vidro
 * continua com o desfoque normal do CSS.
 */
export const refracaoSuportada = (() => {
  if (typeof navigator === 'undefined') return false
  const marcas = (navigator as Navigator & { userAgentData?: { brands?: { brand: string }[] } }).userAgentData?.brands
  return Boolean(marcas?.some((m) => /Chromium/i.test(m.brand)))
})()

let svg: SVGSVGElement | null = null
let contador = 0

function containerSvg() {
  if (svg) return svg
  svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('aria-hidden', 'true')
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none'
  document.body.appendChild(svg)
  return svg
}

/**
 * Mapa de lente para um retângulo arredondado: dentro da faixa da borda (bezel), cada pixel aponta
 * para fora, mais forte quanto mais perto da borda, e o conteúdo de fora "dobra" para dentro.
 * Canal R = deslocamento em x, G = em y (128 = parado).
 */
function mapaDeLente(w: number, h: number, raio: number, bezel: number) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(w, h)
  const r = Math.min(raio, w / 2, h / 2)
  const hx = w / 2 - r
  const hy = h / 2 - r
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const px = x + 0.5 - w / 2
      const py = y + 0.5 - h / 2
      const qx = Math.abs(px) - hx
      const qy = Math.abs(py) - hy
      // distância (positiva) até a borda do retângulo arredondado e a direção da normal
      let dist: number
      let nx: number
      let ny: number
      if (qx > 0 && qy > 0) {
        const l = Math.hypot(qx, qy) || 1
        dist = r - l
        nx = (qx / l) * Math.sign(px)
        ny = (qy / l) * Math.sign(py)
      } else if (qx > qy) {
        dist = r - qx
        nx = Math.sign(px)
        ny = 0
      } else {
        dist = r - qy
        nx = 0
        ny = Math.sign(py)
      }
      const t = Math.max(0, Math.min(1, 1 - dist / bezel))
      // perfil convexo: quase nada no meio, forte na borda
      const m = t * t * (3 - 2 * t) * t
      const i = (y * w + x) * 4
      img.data[i] = 128 + nx * m * 127
      img.data[i + 1] = 128 + ny * m * 127
      img.data[i + 2] = 128
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return canvas.toDataURL()
}

interface Opcoes {
  /** Força da refração em px. */
  escala?: number
  /** Largura da faixa de borda que refrata, em px. */
  bezel?: number
  /** Desfoque aplicado junto (o mesmo do vidro normal). */
  desfoque?: number
  /** false enquanto o elemento ainda não está na tela (ex.: o painel atrás de outra tela). */
  ativo?: boolean
}

/** Aplica a refração líquida ao elemento enquanto ele estiver na tela. */
export function useVidroLiquido(ref: RefObject<HTMLElement | null>, { escala = 34, bezel = 18, desfoque = 14, ativo = true }: Opcoes = {}) {
  useEffect(() => {
    const el = ref.current
    if (!el || !refracaoSuportada || !ativo) return
    const id = `vidro-liquido-${++contador}`
    const ns = 'http://www.w3.org/2000/svg'
    const filtro = document.createElementNS(ns, 'filter')
    filtro.setAttribute('id', id)
    filtro.setAttribute('x', '0')
    filtro.setAttribute('y', '0')
    filtro.setAttribute('width', '100%')
    filtro.setAttribute('height', '100%')
    filtro.setAttribute('color-interpolation-filters', 'sRGB')
    const imagem = document.createElementNS(ns, 'feImage')
    imagem.setAttribute('result', 'mapa')
    imagem.setAttribute('preserveAspectRatio', 'none')
    const desloca = document.createElementNS(ns, 'feDisplacementMap')
    desloca.setAttribute('in', 'SourceGraphic')
    desloca.setAttribute('in2', 'mapa')
    desloca.setAttribute('scale', String(escala))
    desloca.setAttribute('xChannelSelector', 'R')
    desloca.setAttribute('yChannelSelector', 'G')
    filtro.append(imagem, desloca)
    containerSvg().appendChild(filtro)

    let ultimo = ''
    const atualizar = () => {
      const w = Math.round(el.offsetWidth)
      const h = Math.round(el.offsetHeight)
      if (!w || !h) return
      const raio = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0
      const chave = `${w}x${h}x${raio}`
      if (chave === ultimo) return
      ultimo = chave
      imagem.setAttribute('width', String(w))
      imagem.setAttribute('height', String(h))
      imagem.setAttribute('href', mapaDeLente(w, h, raio, Math.min(bezel, h / 2, w / 2)))
      el.style.backdropFilter = `url(#${id}) blur(${desfoque}px) saturate(180%)`
    }
    let quadro = 0
    const observador = new ResizeObserver(() => {
      cancelAnimationFrame(quadro)
      quadro = requestAnimationFrame(atualizar)
    })
    observador.observe(el)
    atualizar()
    el.classList.add('liquido')

    return () => {
      observador.disconnect()
      cancelAnimationFrame(quadro)
      filtro.remove()
      el.style.backdropFilter = ''
      el.classList.remove('liquido')
    }
  }, [ref, escala, bezel, desfoque, ativo])
}
