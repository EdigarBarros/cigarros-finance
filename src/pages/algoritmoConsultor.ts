/**
 * A abertura do "motor do OpusCash" (Algoritmo.tsx): a tela do Consultor de verdade, como a pessoa vê no painel, que
 * vira um espaço com profundidade: a câmera entra nela e chega no motor, que roda lá no fundo.
 *
 * As fotos saem do app de demonstração (scripts/motor/capturar-consultor.cjs): só o fundo (c), os
 * blocos sozinhos (b: cartões, barra lateral, botões, transparentes em volta) e as peças de dentro deles sozinhas (p:
 * textos, gráficos, ícones), e onde fica cada bloco e cada peça. Cada bloco e cada peça vira um recorte próprio, só
 * com o desenho dele (as quinas redondas, a sombra), sem nenhum retângulo em volta. Desenhados uns sobre os outros
 * dão a tela inteira; separados, cada um fica numa profundidade:
 *   1. a tela abre: as peças ficam na frente, os cartões, a barra lateral e o topo no meio, o fundo lá atrás, e cada
 *      cartão faz sombra no fundo;
 *   2. a câmera avança pelo meio: cada peça cresce, passa por ela e some;
 *   3. depois do fundo, a câmera chega na rede.
 * A tela não tem moldura: as beiradas se apagam aos poucos e ela se mistura com a página (o fundo dela bem devagar;
 * os cartões só na beirada, e mais embaixo, onde a foto corta a tela).
 */
interface Mapa { w: number; h: number; n1: [number, number, number, number, number][]; n2: [number, number, number, number, number][] }

const FOTOS = import.meta.glob('./motor/*.jpg', { query: '?url', import: 'default' }) as Record<string, () => Promise<string>>
const CAMADAS = import.meta.glob('./motor/*.webp', { query: '?url', import: 'default' }) as Record<string, () => Promise<string>>
const MAPAS = import.meta.glob('./motor/*.json', { import: 'default' }) as Record<string, () => Promise<Mapa>>

/**
 * Um bloco ou uma peça: o recorte (x, y, w, h, em px da foto, já com uma folga em volta para a sombra e o brilho dele)
 * e a que profundidade ele fica dentro da tela (0 é o vidro; 1 é o fundo).
 */
interface Pedaco { x: number; y: number; w: number; h: number; z: number; img: HTMLCanvasElement | null; sombra: HTMLCanvasElement | null }
export interface ConsultorReal {
  c: HTMLImageElement; b: HTMLImageElement; p: HTMLImageElement
  // a tela inteira (montada com as camadas) e o fundo, já no tamanho em que aparecem e com as beiradas apagadas: k
  // pixels por px da foto
  ia: CanvasImageSource; ic: CanvasImageSource
  w: number; h: number; k: number
  /** pixels das fotos por px da foto (a densidade em que elas foram tiradas) */
  kn: number
  /** de quem é cada ponto da foto (o índice do bloco ou da peça mais perto; -1 é de ninguém) */
  donoB: Int16Array; donoP: Int16Array
  /** na ordem da foto (é a ordem de `donoB` e `donoP`) */
  blocos: Pedaco[]; pecas: Pedaco[]
  /** os mesmos, do mais fundo para o mais perto (a ordem de desenhar) */
  fundoB: Pedaco[]; fundoP: Pedaco[]
}

/** A que profundidade a rede fica, atrás do fundo da tela (que fica em 1). */
export const Z_REDE = 1.7
/** A folga em volta de cada recorte (px da foto): a sombra dos cartões e o brilho dos botões vêm junto. */
const FOLGA_BLOCO = 14, FOLGA_PECA = 5
/** O espaço que a sombra de um cartão ocupa além dele (px da foto) e para onde a luz a empurra a cada unidade de fundo. */
const SOMBRA = 26, LUZ_X = 70, LUZ_Y = 110

/**
 * O mergulho, de 0 (a tela inteira, de frente) a 1 (a câmera chegou na rede):
 *   abre: o quanto as camadas da tela já se afastaram em profundidade (a tela vira um espaço);
 *   cam: onde a câmera está (0 no vidro, Z_REDE na rede);
 *   lado: a câmera olha um pouco de lado enquanto a tela abre, para a profundidade aparecer, e volta.
 */
export function mergulho(desm: number) {
  return { abre: suave(0, 0.36, desm), cam: Z_REDE * suave(0.1, 1, desm), lado: Math.sin(Math.PI * limitar(desm / 0.55)) * 0.12 }
}

function sorteio(semente: number) {
  let s = semente
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296 }
}
const limitar = (n: number, a = 0, b = 1) => Math.min(b, Math.max(a, n))
const suave = (a: number, b: number, x: number) => { const t = limitar((x - a) / (b - a)); return t * t * (3 - 2 * t) }

/** As beiradas: a quanto de cada borda (px da foto: esquerda, direita, cima, baixo) a camada já está inteira. */
type Beiradas = [number, number, number, number]
/** Os cartões e as peças: só a beirada, e mais embaixo, onde a foto corta a tela no meio dos cartões. */
const beiradas = (t: { w: number; h: number }): Beiradas => {
  const f = Math.max(10, 0.025 * Math.min(t.w, t.h))
  return [f, f, f, 0.08 * t.h]
}
/** O fundo da tela se apaga bem devagar: ele vira a página. */
const beiradasFundo = (t: { w: number; h: number }): Beiradas => {
  const f = 0.12 * Math.min(t.w, t.h)
  return [f, f, f, Math.max(f, 0.12 * t.h)]
}
/** Como a camada se apaga até lá (a mesma rampa nos degradês de `esfumado` e ponto a ponto em `recortar`). */
const RAMPA: [number, number][] = [[0, 0], [0.3, 0.18], [0.6, 0.62], [1, 1]]
function rampa(d: number, f: number) {
  const u = d / f
  if (u >= 1) return 1
  if (u <= 0) return 0
  for (let i = 1; i < RAMPA.length; i++) {
    const [u1, a1] = RAMPA[i]
    if (u <= u1) { const [u0, a0] = RAMPA[i - 1]; return a0 + ((u - u0) / (u1 - u0)) * (a1 - a0) }
  }
  return 1
}

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

/**
 * Divide a foto entre os recortes: cada ponto fica com o recorte mais perto dele (dentro de um, é dele; na folga entre
 * dois, de quem estiver mais perto). Assim nenhum pedaço de desenho aparece duas vezes nem é cortado reto.
 */
function dividir(w: number, h: number, caixas: [number, number, number, number][], folga: number) {
  const W = Math.ceil(w), H = Math.ceil(h)
  const dono = new Int16Array(W * H).fill(-1), dist = new Float32Array(W * H).fill(Infinity), area = new Float32Array(caixas.length)
  caixas.forEach(([x, y, cw, ch], i) => {
    area[i] = cw * ch
    const x0 = Math.max(0, Math.floor(x - folga)), x1 = Math.min(W, Math.ceil(x + cw + folga))
    const y0 = Math.max(0, Math.floor(y - folga)), y1 = Math.min(H, Math.ceil(y + ch + folga))
    for (let py = y0; py < y1; py++) {
      const cy = py + 0.5, dy = cy < y ? y - cy : cy > y + ch ? cy - y - ch : 0
      for (let px = x0; px < x1; px++) {
        const cx = px + 0.5, dx = cx < x ? x - cx : cx > x + cw ? cx - x - cw : 0
        const d = Math.max(dx, dy), j = py * W + px
        if (d > folga) continue
        // um recorte dentro do outro: o ponto fica com o menor
        if (d < dist[j] || (d === dist[j] && dono[j] >= 0 && area[i] < area[dono[j]])) { dist[j] = d; dono[j] = i }
      }
    }
  })
  return dono
}

export async function carregarConsultor(aparelho: 'pc' | 'cel', idioma: string): Promise<ConsultorReal> {
  const base = `./motor/consultor-${aparelho}-${idioma}`
  const [mapa, c, b, p] = await Promise.all([
    MAPAS[`${base}.json`](),
    FOTOS[`${base}-c.jpg`]().then(imagem),
    CAMADAS[`${base}-b.webp`]().then(imagem), CAMADAS[`${base}-p.webp`]().then(imagem),
  ])
  const r = sorteio(5)
  const { w, h } = mapa
  const caixa = (x: number, y: number, cw: number, ch: number, folga: number, z: number): Pedaco => {
    const x0 = Math.max(0, x - folga), y0 = Math.max(0, y - folga)
    return { x: x0, y: y0, w: Math.min(w, x + cw + folga) - x0, h: Math.min(h, y + ch + folga) - y0, z, img: null, sombra: null }
  }
  // de trás para a frente: os cartões, a barra e o topo no meio do caminho; o que está dentro de cada um (textos,
  // gráficos, botões) logo na frente dele; o fundo fica em 1. O que está solto na página (o título e a frase embaixo
  // dele, os botões do topo) fica todo na mesma profundidade, para as linhas não se cruzarem
  const zs = mapa.n1.map(([, , , , solto]) => (solto ? 0.6 : 0.52 + r() * 0.3))
  const blocos = mapa.n1.map(([x, y, pw, ph], i) => caixa(x, y, pw, ph, FOLGA_BLOCO, zs[i]))
  const pecas = mapa.n2.map(([x, y, pw, ph, pai]) => caixa(x, y, pw, ph, FOLGA_PECA, zs[pai] - 0.16 - r() * 0.03))
  const t: ConsultorReal = {
    c, b, p, ia: c, ic: c, w, h, k: 0, kn: c.naturalWidth / w,
    donoB: dividir(w, h, mapa.n1.map(([x, y, pw, ph]) => [x, y, pw, ph]), FOLGA_BLOCO),
    donoP: dividir(w, h, mapa.n2.map(([x, y, pw, ph]) => [x, y, pw, ph]), FOLGA_PECA),
    blocos, pecas,
    fundoB: [...blocos].sort((m, n) => n.z - m.z), fundoP: [...pecas].sort((m, n) => n.z - m.z),
  }
  return t
}

/** Uma foto inteira no tamanho k, com as beiradas apagadas (degradês nas quatro bordas). */
function esfumado(t: ConsultorReal, img: HTMLImageElement, k: number, [fe, fd, fc, fb]: Beiradas) {
  const c = document.createElement('canvas')
  const cw = (c.width = Math.round(t.w * k)), ch = (c.height = Math.round(t.h * k))
  const g = c.getContext('2d')!
  g.imageSmoothingQuality = 'high'
  g.drawImage(img, 0, 0, cw, ch)
  g.globalCompositeOperation = 'destination-in'
  for (const [gw, gh, tam, f0, f1] of [[cw, 0, cw, fe * k, fd * k], [0, ch, ch, fc * k, fb * k]]) {
    const gr = g.createLinearGradient(0, 0, gw, gh)
    for (const [u, a] of RAMPA) {
      gr.addColorStop(Math.min(0.5, (u * f0) / tam), `rgba(0,0,0,${a})`)
      gr.addColorStop(Math.max(0.5, 1 - (u * f1) / tam), `rgba(0,0,0,${a})`)
    }
    g.fillStyle = gr; g.fillRect(0, 0, cw, ch)
  }
  return c
}

/** Recorta cada bloco ou peça da camada, na densidade q, só com os pontos que são dele e as beiradas apagadas. */
function recortar(t: ConsultorReal, img: HTMLImageElement, lista: Pedaco[], dono: Int16Array, q: number, sombra: boolean) {
  const W = Math.ceil(t.w), H = Math.ceil(t.h), [fe, fd, fc, fb] = beiradas(t)
  lista.forEach((p, i) => {
    const cw = Math.max(1, Math.round(p.w * q)), ch = Math.max(1, Math.round(p.h * q))
    const c = document.createElement('canvas')
    c.width = cw; c.height = ch
    const g = c.getContext('2d', { willReadFrequently: true })!
    g.imageSmoothingQuality = 'high'
    g.drawImage(img, p.x * t.kn, p.y * t.kn, p.w * t.kn, p.h * t.kn, 0, 0, cw, ch)
    const d = g.getImageData(0, 0, cw, ch), D = d.data
    let algo = false
    for (let yy = 0; yy < ch; yy++) {
      const fy = p.y + (yy + 0.5) / q, py = Math.min(H - 1, Math.floor(fy)), ay = rampa(fy, fc) * rampa(t.h - fy, fb)
      for (let xx = 0; xx < cw; xx++) {
        const j = (yy * cw + xx) * 4
        if (!D[j + 3]) continue
        const fx = p.x + (xx + 0.5) / q
        const m = dono[py * W + Math.min(W - 1, Math.floor(fx))] === i ? ay * rampa(fx, fe) * rampa(t.w - fx, fd) : 0
        if (m < 1) D[j + 3] = Math.round(D[j + 3] * m)
        if (D[j + 3]) algo = true
      }
    }
    if (!algo) { p.img = p.sombra = null; return }
    g.putImageData(d, 0, 0)
    p.img = c
    if (!sombra) return
    // a sombra do cartão: o desenho dele em preto e desfocado, numa densidade menor (desfocada não perde nada)
    const qs = q * 0.5, s = document.createElement('canvas')
    s.width = Math.round((p.w + 2 * SOMBRA) * qs); s.height = Math.round((p.h + 2 * SOMBRA) * qs)
    const gs = s.getContext('2d')!
    const longe = s.width + 40
    gs.shadowColor = 'rgba(0,0,0,1)'; gs.shadowBlur = 16 * qs; gs.shadowOffsetX = longe
    gs.drawImage(c, SOMBRA * qs - longe, SOMBRA * qs, p.w * qs, p.h * qs)
    p.sombra = s
  })
}

/** Prepara as fotos com k pixels por px da foto (a escala na página vezes a densidade da tela). */
export function ajustarConsultor(t: ConsultorReal, k: number) {
  k = Math.min(k, t.kn)
  if (Math.abs(k - t.k) < 0.01) return
  t.k = k
  t.ic = esfumado(t, t.c, k, beiradasFundo(t))
  // os recortes chegam a ficar perto da câmera (maiores que na foto): mais densos que a tela, até o da foto
  const q = Math.min(t.kn, k * 2)
  recortar(t, t.b, t.blocos, t.donoB, q, true)
  recortar(t, t.p, t.pecas, t.donoP, q, false)
  // a tela parada, de frente: o fundo, os cartões e as peças no lugar deles (as mesmas camadas do mergulho, então
  // não há salto quando a tela começa a abrir)
  const ia = document.createElement('canvas')
  ia.width = Math.round(t.w * k); ia.height = Math.round(t.h * k)
  const g = ia.getContext('2d')!
  g.imageSmoothingQuality = 'high'
  g.drawImage(t.ic, 0, 0, ia.width, ia.height)
  for (const p of [...t.blocos, ...t.pecas]) if (p.img) g.drawImage(p.img, p.x * k, p.y * k, p.w * k, p.h * k)
  t.ia = ia
}

/**
 * Desenha a tela em (x0, y0) com escala s (px da tela da página por px da foto). desm vai de 0 (inteira) a 1 (a
 * câmera já passou por tudo e chegou na rede). Tudo cresce a partir do meio da tela, que é para onde a câmera vai.
 */
export function desenharConsultor(g: CanvasRenderingContext2D, t: ConsultorReal, x0: number, y0: number, s: number, desm: number) {
  const rw = t.w * s, rh = t.h * s, vx = x0 + rw / 2, vy = y0 + rh / 2
  g.globalCompositeOperation = 'source-over'
  g.globalAlpha = 1
  if (desm <= 0) { g.drawImage(t.ia, x0, y0, rw, rh); return }
  const { abre, cam, lado } = mergulho(desm)
  /** O tamanho de quem está na profundidade z (1 = no vidro, antes de a câmera andar); 0 se já ficou para trás. */
  const escala = (z: number) => { const d = 1 + z - cam; return d > 0.14 ? 1 / d : 0 }
  /** Perto da câmera a peça some (passou por ela). */
  const perto = (e: number) => 1 - suave(1.5, 2.9, e)
  const desvio = (z: number, e: number) => -lado * z * rw * e
  const fora = (px: number, py: number, pw: number, ph: number) => px > g.canvas.width || py > g.canvas.height || px + pw < 0 || py + ph < 0

  // o fundo da tela: escurece conforme a tela abre (a rede aparece através dele) e some quando a câmera chega
  const zf = abre, ef = escala(zf)
  if (ef > 0) {
    const a = (1 - 0.8 * abre) * perto(ef)
    if (a > 0.01) {
      g.globalAlpha = a
      g.drawImage(t.ic, vx - (rw / 2) * ef + desvio(zf, ef), vy - (rh / 2) * ef, rw * ef, rh * ef)
    }
    // a sombra de cada cartão no fundo: quanto mais longe dele o cartão está, mais ela anda (a luz vem de cima, à
    // esquerda), cresce e clareia
    const as = 0.55 * suave(0, 0.6, abre) * perto(ef)
    if (as > 0.01) {
      for (const p of t.blocos) {
        if (!p.sombra) continue
        const dz = zf - p.z * abre
        const sx = p.x - SOMBRA + LUZ_X * dz, sy = p.y - SOMBRA + LUZ_Y * dz
        const px = vx + (x0 + sx * s - vx) * ef + desvio(zf, ef), py = vy + (y0 + sy * s - vy) * ef
        const pw = (p.w + 2 * SOMBRA) * s * ef, ph = (p.h + 2 * SOMBRA) * s * ef
        if (fora(px, py, pw, ph)) continue
        g.globalAlpha = as * (1 - 0.5 * limitar(dz / 0.5))
        g.drawImage(p.sombra, px, py, pw, ph)
      }
    }
  }
  const camada = (lista: Pedaco[], opaco: number) => {
    for (const p of lista) {
      if (!p.img) continue
      const z = p.z * abre, e = escala(z)
      if (!e) continue
      const a = perto(e)
      if (a <= 0.01) continue
      const px = vx + (x0 + p.x * s - vx) * e + desvio(z, e), py = vy + (y0 + p.y * s - vy) * e
      const pw = p.w * s * e, ph = p.h * s * e
      if (fora(px, py, pw, ph)) continue
      g.globalAlpha = a * (1 - (1 - opaco) * abre)
      g.drawImage(p.img, px, py, pw, ph)
    }
  }
  // os cartões ficam um pouco transparentes (a rede aparece através deles); o que está dentro, inteiro
  camada(t.fundoB, 0.78)
  camada(t.fundoP, 1)
  g.globalAlpha = 1
}
