/**
 * A abertura do "motor do OpusCash" (Algoritmo.tsx): a tela do Consultor de verdade, como a pessoa vê no painel, que
 * se desmonta peça por peça e mostra o motor atrás dela.
 *
 * As fotos saem do app de demonstração (scripts/motor/capturar-consultor.cjs): a foto inteira (a), só os blocos sem o
 * conteúdo (b), só o fundo (c) e onde fica cada bloco e cada peça. Desenhados uns sobre os outros dão a foto inteira;
 * separados, cada um voa para um lado:
 *   1. as peças de dentro (textos, gráficos, botões) se soltam dos cartões, acendem na borda e voam para perto de quem olha;
 *   2. os cartões, a barra lateral e o topo saem logo atrás;
 *   3. o fundo se apaga do meio para fora, e o que fica é a esfera.
 */
interface Mapa { w: number; h: number; n1: [number, number, number, number, number][]; n2: [number, number, number, number, number][] }

const FOTOS = import.meta.glob('./motor/*.jpg', { query: '?url', import: 'default' }) as Record<string, () => Promise<string>>
const MAPAS = import.meta.glob('./motor/*.json', { import: 'default' }) as Record<string, () => Promise<Mapa>>

interface Pedaco { x: number; y: number; w: number; h: number; dx: number; dy: number; giro: number; atraso: number; voo: number }
export interface ConsultorReal {
  a: HTMLImageElement; b: HTMLImageElement; c: HTMLImageElement
  // as fotos já no tamanho em que aparecem (reduzir a foto grande a cada quadro pesa): k pixels por px da foto
  ia: CanvasImageSource; ib: CanvasImageSource; ic: CanvasImageSource
  w: number; h: number; k: number
  blocos: Pedaco[]; pecas: Pedaco[]; fundo: Pedaco[]
}

function sorteio(semente: number) {
  let s = semente
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296 }
}
const limitar = (n: number, a = 0, b = 1) => Math.min(b, Math.max(a, n))
const suave = (a: number, b: number, x: number) => { const t = limitar((x - a) / (b - a)); return t * t * (3 - 2 * t) }

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

export async function carregarConsultor(aparelho: 'pc' | 'cel', idioma: string): Promise<ConsultorReal> {
  const base = `./motor/consultor-${aparelho}-${idioma}`
  const [mapa, a, b, c] = await Promise.all([
    MAPAS[`${base}.json`](),
    ...(['a', 'b', 'c'] as const).map((l) => FOTOS[`${base}-${l}.jpg`]().then(imagem)),
  ])
  const r = sorteio(5)
  const { w, h } = mapa
  // para onde cada coisa voa: para fora, a partir do centro da tela (ou do bloco), com um pouco de sorte
  const pedaco = (x: number, y: number, pw: number, ph: number, ox: number, oy: number, atraso: number, voo: number): Pedaco => {
    let dx = (x + pw / 2 - ox) / w + (r() - 0.5) * 0.5, dy = (y + ph / 2 - oy) / h + (r() - 0.5) * 0.5
    const d = Math.hypot(dx, dy) || 1
    dx /= d; dy /= d
    return { x, y, w: pw, h: ph, dx, dy, giro: (r() - 0.5) * 1.4, atraso, voo }
  }
  const dist = (x: number, y: number, pw: number, ph: number) => Math.min(1, Math.hypot((x + pw / 2 - w / 2) / (w / 2), (y + ph / 2 - h / 2) / (h / 2)) / 1.2)
  const blocos = mapa.n1.map(([x, y, pw, ph]) => pedaco(x, y, pw, ph, w / 2, h / 2, 0.2 + dist(x, y, pw, ph) * 0.18 + r() * 0.12, 0.5 + r() * 0.3))
  // as peças voam a partir do meio do bloco delas (o gráfico sai do cartão para fora); só as que cabem no bloco
  const pecas: Pedaco[] = []
  for (const [x, y, pw, ph, pai] of mapa.n2) {
    const [bx, by, bw, bh] = mapa.n1[pai]
    if (x < bx - 4 || y < by - 4 || x + pw > bx + bw + 4 || y + ph > by + bh + 4) continue
    const p = pedaco(x, y, pw, ph, bx + bw / 2, by + bh / 2, Math.max(0.02, blocos[pai].atraso - 0.16 - r() * 0.12), 0.6 + r() * 0.5)
    pecas.push(p)
  }
  // o fundo em placas, que se apagam do meio para fora
  const col = aparelho === 'pc' ? 8 : 4, lin = aparelho === 'pc' ? 5 : 8, fundo: Pedaco[] = []
  for (let l = 0; l < lin; l++) for (let c2 = 0; c2 < col; c2++) {
    const x = (c2 * w) / col, y = (l * h) / lin, pw = w / col, ph = h / lin
    fundo.push(pedaco(x, y, pw, ph, w / 2, h / 2, 0.3 + dist(x, y, pw, ph) * 0.35 + r() * 0.08, 0.2))
  }
  return { a, b, c, ia: a, ib: b, ic: c, w, h, k: a.naturalWidth / w, blocos, pecas, fundo }
}

/** Prepara as fotos com k pixels por px da foto (a escala na página vezes a densidade da tela). */
export function ajustarConsultor(t: ConsultorReal, k: number) {
  k = Math.min(k, t.a.naturalWidth / t.w)
  if (Math.abs(k - t.k) < 0.01 && t.ia !== t.a) return
  const reduzir = (img: HTMLImageElement) => {
    const c = document.createElement('canvas')
    c.width = Math.round(t.w * k); c.height = Math.round(t.h * k)
    const g = c.getContext('2d')!
    g.imageSmoothingQuality = 'high'
    g.drawImage(img, 0, 0, c.width, c.height)
    return c
  }
  t.ia = reduzir(t.a); t.ib = reduzir(t.b); t.ic = reduzir(t.c); t.k = k
}

/**
 * Desenha a tela em (x0, y0) com escala s (px da tela da página por px da foto). desm vai de 0 (inteira) a 1 (só o
 * motor). W e H: o tamanho da área de desenho, para o tamanho do voo.
 */
export function desenharConsultor(g: CanvasRenderingContext2D, t: ConsultorReal, x0: number, y0: number, s: number, desm: number, W: number, H: number, raio: number) {
  const { k } = t
  g.globalCompositeOperation = 'source-over'
  if (desm <= 0) {
    g.save()
    g.beginPath(); g.roundRect(x0, y0, t.w * s, t.h * s, raio); g.clip()
    g.drawImage(t.ia, x0, y0, t.w * s, t.h * s)
    g.restore()
    return
  }
  const bordas: [number, number, number, number, number, number, number][] = []
  const peca = (img: CanvasImageSource, p: Pedaco, fim: number, brilho: boolean) => {
    const u = suave(p.atraso, p.atraso + fim, desm)
    // antes de voar, a peça se solta: sobe um pouco e a borda acende
    const solta = brilho ? suave(Math.max(0, p.atraso - 0.12), p.atraso, desm) * (1 - u) : 0
    const a = 1 - suave(0.25, 0.75, u)
    if (a <= 0.01) return
    const voo = u * u * p.voo
    const cx = x0 + (p.x + p.w / 2) * s + p.dx * voo * W * 0.6
    const cy = y0 + (p.y + p.h / 2) * s + p.dy * voo * H * 0.6 - solta * 6
    const e = 1 + 0.65 * u * p.voo + 0.04 * solta
    g.save()
    g.globalAlpha = a
    g.translate(cx, cy); g.rotate(p.giro * u); g.scale(e, e)
    g.drawImage(img, p.x * k, p.y * k, p.w * k, p.h * k, (-p.w * s) / 2, (-p.h * s) / 2, p.w * s, p.h * s)
    g.restore()
    const luz = Math.max(solta, Math.min(1, u * 4) * (1 - u)) * a
    if (brilho && luz > 0.02) bordas.push([cx, cy, p.giro * u, e, p.w * s, p.h * s, luz])
  }
  // o fundo, preso no recorte da tela
  g.save()
  g.beginPath(); g.roundRect(x0, y0, t.w * s, t.h * s, raio); g.clip()
  for (const p of t.fundo) {
    const u = suave(p.atraso, p.atraso + 0.3, desm)
    if (u >= 1) continue
    g.globalAlpha = 1 - u
    const e = 1 - 0.08 * u
    const cx = x0 + (p.x + p.w / 2) * s, cy = y0 + (p.y + p.h / 2) * s
    // +0.5 de sobra: as placas não deixam fresta entre elas
    g.drawImage(t.ic, p.x * k, p.y * k, p.w * k, p.h * k, cx - (p.w * s * e) / 2 - 0.5, cy - (p.h * s * e) / 2 - 0.5, p.w * s * e + 1, p.h * s * e + 1)
  }
  g.restore()
  g.globalAlpha = 1
  for (const p of t.blocos) peca(t.ib, p, 0.5, true)
  for (const p of t.pecas) peca(t.ia, p, 0.45, true)
  // as bordas que acendem quando as peças se soltam
  g.globalCompositeOperation = 'lighter'
  g.strokeStyle = 'rgba(255,205,120,0.9)'; g.lineWidth = 1.2
  for (const [cx, cy, gi, e, w, h, a] of bordas) {
    g.save(); g.globalAlpha = a; g.translate(cx, cy); g.rotate(gi); g.scale(e, e)
    g.strokeRect(-w / 2, -h / 2, w, h)
    g.restore()
  }
  g.globalAlpha = 1
}
