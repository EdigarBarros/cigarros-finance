/**
 * A abertura do "motor do OpusCash" (Algoritmo.tsx): a tela do Consultor de verdade, como a pessoa vê no painel. A
 * câmera vira para a fresta entre o cartão do destaque ("Quando cada dívida acaba") e o do perfil ("Com dívidas
 * pesando"), chega perto dela e atravessa; o motor fica do outro lado. A tela não muda: nada fica transparente, o
 * fundo continua da cor dele, e só a fresta é aberta.
 *
 * As fotos saem do app de demonstração (scripts/motor/capturar-consultor.cjs): só o fundo (c), os blocos sozinhos (b:
 * cartões, barra lateral, botões, transparentes em volta), as peças de dentro deles (p: textos, gráficos, ícones) e,
 * no mapa, onde fica a fresta. Juntas, com a fresta tirada do fundo, dão a tela; as beiradas se apagam aos poucos e ela
 * se mistura com a página (o fundo bem devagar; os cartões só na beirada, e mais embaixo, onde a foto corta a tela).
 *
 * Perto da fresta a foto ficaria borrada (a câmera chega a aumentar a tela umas cem vezes). Ali entra uma faixa de um
 * ponto de largura tirada da foto em volta da fresta (a borda de baixo de um cartão, a fresta, a borda de cima do outro),
 * esticada sem suavizar: as bordas ficam nítidas até a câmera passar.
 */
interface Mapa { w: number; h: number; fresta?: [number, number, number, number] | null }

const FOTOS = import.meta.glob('./motor/*.jpg', { query: '?url', import: 'default' }) as Record<string, () => Promise<string>>
const CAMADAS = import.meta.glob('./motor/*.webp', { query: '?url', import: 'default' }) as Record<string, () => Promise<string>>
const MAPAS = import.meta.glob('./motor/*.json', { import: 'default' }) as Record<string, () => Promise<Mapa>>

export interface ConsultorReal {
  w: number; h: number
  /** a tela inteira, na densidade da foto (q pixels por px da foto), com as beiradas apagadas e a fresta aberta */
  ia: HTMLCanvasElement; q: number
  /** a fresta (px da foto): x, y, largura e altura; e o meio dela, para onde a câmera vai */
  fr: [number, number, number, number]; fx: number; fy: number
  /** a faixa nítida em volta da fresta (1 ponto de largura) e de onde até onde ela vai na foto (y, altura) */
  tira: HTMLCanvasElement | null; tiraY: number; tiraH: number
}

/** A que profundidade a rede fica, atrás da tela (que fica em 0; a câmera começa em 0 e atravessa a fresta em 1). */
export const Z_REDE = 1.7
/** Em que ponto do mergulho a câmera atravessa a fresta. */
export const ATRAVESSA = 0.62
/** A cor do fundo do painel (a da foto), para a cena ficar dela enquanto a câmera chega. */
export const COR_PAINEL = 'rgb(7,11,20)'

/**
 * O mergulho, de 0 (a tela inteira, de frente) a 1 (a câmera chegou na rede). E é o quanto a tela precisa crescer para
 * a fresta ocupar a cena inteira. Até ATRAVESSA a tela cresce num ritmo que acelera (o tamanho sobe por potência de E:
 * a mesma sensação de velocidade do começo ao fim); depois a câmera segue até a rede.
 *   cam: onde a câmera está (0 na tela, 1 na fresta, Z_REDE na rede);
 *   e: quantas vezes a tela está maior (0 depois que a câmera passou dela).
 */
export function mergulho(desm: number, E: number) {
  if (desm <= ATRAVESSA) {
    const u = desm / ATRAVESSA, e = Math.pow(E, Math.pow(u, 1.35))
    return { cam: 1 - 1 / e, e }
  }
  return { cam: mistura(1 - 1 / E, Z_REDE, suave(ATRAVESSA, 1, desm)), e: 0 }
}

const limitar = (n: number, a = 0, b = 1) => Math.min(b, Math.max(a, n))
const suave = (a: number, b: number, x: number) => { const t = limitar((x - a) / (b - a)); return t * t * (3 - 2 * t) }
const mistura = (a: number, b: number, t: number) => a + (b - a) * t

/** As beiradas: a quanto de cada borda (px da foto: esquerda, direita, cima, baixo) a camada já está inteira. */
type Beiradas = [number, number, number, number]
/** Os cartões e as peças: só a beirada, e mais embaixo, onde a foto corta a tela no meio dos cartões. */
const beiradas = (w: number, h: number): Beiradas => {
  const f = Math.max(10, 0.025 * Math.min(w, h))
  return [f, f, f, 0.08 * h]
}
/** O fundo da tela se apaga bem devagar: ele vira a página. */
const beiradasFundo = (w: number, h: number): Beiradas => {
  const f = 0.12 * Math.min(w, h)
  return [f, f, f, Math.max(f, 0.12 * h)]
}
/** Como a camada se apaga até lá. */
const RAMPA: [number, number][] = [[0, 0], [0.3, 0.18], [0.6, 0.62], [1, 1]]

function imagem(url: string) {
  return new Promise<HTMLImageElement>((ok, erro) => {
    const i = new Image()
    i.decoding = 'async'
    i.onload = () => ok(i); i.onerror = erro
    i.src = url
  })
}

/** O idioma da página (pt, en ou es; os do tradutor do Google ficam com o português). */
export function idiomaDasFotos() {
  const l = document.documentElement.lang.toLowerCase()
  return l.startsWith('en') ? 'en' : l.startsWith('es') ? 'es' : 'pt'
}

/** Apaga as beiradas do que já está desenhado em g (cw × ch px; q px por px da foto), com degradês nas quatro bordas. */
function esfumar(g: CanvasRenderingContext2D, cw: number, ch: number, q: number, [fe, fd, fc, fb]: Beiradas) {
  g.globalCompositeOperation = 'destination-in'
  for (const [gw, gh, tam, f0, f1] of [[cw, 0, cw, fe * q, fd * q], [0, ch, ch, fc * q, fb * q]]) {
    const gr = g.createLinearGradient(0, 0, gw, gh)
    for (const [u, a] of RAMPA) {
      gr.addColorStop(Math.min(0.5, (u * f0) / tam), `rgba(0,0,0,${a})`)
      gr.addColorStop(Math.max(0.5, 1 - (u * f1) / tam), `rgba(0,0,0,${a})`)
    }
    g.fillStyle = gr; g.fillRect(0, 0, cw, ch)
  }
  g.globalCompositeOperation = 'source-over'
}

function tela(cw: number, ch: number) {
  const c = document.createElement('canvas')
  c.width = cw; c.height = ch
  return { c, g: c.getContext('2d')! }
}

export async function carregarConsultor(aparelho: 'pc' | 'cel', idioma: string): Promise<ConsultorReal> {
  const base = `./motor/consultor-${aparelho}-${idioma}`
  const [mapa, c, b, p] = await Promise.all([
    MAPAS[`${base}.json`](),
    FOTOS[`${base}-c.jpg`]().then(imagem),
    CAMADAS[`${base}-b.webp`]().then(imagem), CAMADAS[`${base}-p.webp`]().then(imagem),
  ])
  const { w, h } = mapa, cw = c.naturalWidth, ch = c.naturalHeight, q = cw / w
  const fr: [number, number, number, number] = mapa.fresta ?? [w / 2 - 1, h / 2 - 1, 2, 2]
  // o fundo, com as beiradas bem apagadas e a fresta aberta
  const fundo = tela(cw, ch)
  fundo.g.drawImage(c, 0, 0)
  esfumar(fundo.g, cw, ch, q, beiradasFundo(w, h))
  if (mapa.fresta) fundo.g.clearRect(fr[0] * q, fr[1] * q, fr[2] * q, fr[3] * q)
  // os blocos e as peças, com só a beirada apagada
  const frente = tela(cw, ch)
  frente.g.drawImage(b, 0, 0); frente.g.drawImage(p, 0, 0)
  esfumar(frente.g, cw, ch, q, beiradas(w, h))
  const ia = tela(cw, ch)
  ia.g.drawImage(fundo.c, 0, 0); ia.g.drawImage(frente.c, 0, 0)
  // a faixa nítida: do meio da fresta, 10 px acima dela até 10 px abaixo
  let tira: HTMLCanvasElement | null = null
  const tiraY = fr[1] - 10, tiraH = fr[3] + 20
  if (mapa.fresta) {
    const t = tela(1, Math.max(1, Math.round(tiraH * q)))
    t.g.drawImage(ia.c, Math.round((fr[0] + fr[2] / 2) * q), Math.round(tiraY * q), 1, t.c.height, 0, 0, 1, t.c.height)
    tira = t.c
  }
  return { w, h, ia: ia.c, q, fr, fx: fr[0] + fr[2] / 2, fy: fr[1] + fr[3] / 2, tira, tiraY, tiraH }
}

/**
 * Desenha a tela com o meio da fresta em (ax, ay) e escala s (px da página por px da foto), já aumentada pelo
 * mergulho. vw × vh é o tamanho da cena (só a parte da foto que cabe nela é desenhada).
 */
export function desenharConsultor(g: CanvasRenderingContext2D, t: ConsultorReal, ax: number, ay: number, s: number, desm: number, E: number, vw: number, vh: number) {
  const { e } = mergulho(Math.max(0, desm), E)
  if (!e) return
  const k = s * e
  g.globalCompositeOperation = 'source-over'
  g.globalAlpha = 1
  // a parte da foto que aparece
  const x0 = Math.max(0, t.fx - ax / k), x1 = Math.min(t.w, t.fx + (vw - ax) / k)
  const y0 = Math.max(0, t.fy - ay / k), y1 = Math.min(t.h, t.fy + (vh - ay) / k)
  if (x1 > x0 && y1 > y0) {
    g.drawImage(t.ia, x0 * t.q, y0 * t.q, (x1 - x0) * t.q, (y1 - y0) * t.q, ax + (x0 - t.fx) * k, ay + (y0 - t.fy) * k, (x1 - x0) * k, (y1 - y0) * k)
  }
  // bem perto, a faixa em volta da fresta, nítida
  if (t.tira && e > 4) {
    const dx0 = Math.max(0, ax + (t.fr[0] - t.fx) * k), dx1 = Math.min(vw, ax + (t.fr[0] + t.fr[2] - t.fx) * k)
    if (dx1 > dx0) {
      g.globalAlpha = suave(4, 9, e)
      g.imageSmoothingEnabled = false
      g.drawImage(t.tira, 0, 0, 1, t.tira.height, dx0, ay + (t.tiraY - t.fy) * k, dx1 - dx0, t.tiraH * k)
      g.imageSmoothingEnabled = true
      g.globalAlpha = 1
    }
  }
}
