/**
 * A abertura do "motor do OpusCash" (Algoritmo.tsx): a tela do Consultor de verdade, como a pessoa vê no painel, que
 * vira um espaço com profundidade: a câmera entra nela e chega no motor, que roda lá no fundo.
 *
 * As fotos saem do app de demonstração (scripts/motor/capturar-consultor.cjs): a foto inteira (a), só os blocos sem o
 * conteúdo (b), só o fundo (c) e onde fica cada bloco e cada peça. Desenhados uns sobre os outros dão a foto inteira;
 * separados, cada um fica numa profundidade:
 *   1. a tela abre: as peças de dentro (textos, gráficos, botões) ficam na frente, os cartões, a barra lateral e o
 *      topo no meio, o fundo lá atrás, e as bordas acendem;
 *   2. a câmera avança pelo meio: cada peça cresce, passa por ela e some;
 *   3. depois do fundo, o corredor continua até a rede.
 */
interface Mapa { w: number; h: number; n1: [number, number, number, number, number][]; n2: [number, number, number, number, number][] }

const FOTOS = import.meta.glob('./motor/*.jpg', { query: '?url', import: 'default' }) as Record<string, () => Promise<string>>
const MAPAS = import.meta.glob('./motor/*.json', { import: 'default' }) as Record<string, () => Promise<Mapa>>

/** Um pedaço da foto e a que profundidade ele fica dentro da tela (0 é o vidro; 1 é o fundo). */
interface Pedaco { x: number; y: number; w: number; h: number; z: number }
export interface ConsultorReal {
  a: HTMLImageElement; b: HTMLImageElement; c: HTMLImageElement
  // as fotos já no tamanho em que aparecem (reduzir a foto grande a cada quadro pesa): k pixels por px da foto
  ia: CanvasImageSource; ib: CanvasImageSource; ic: CanvasImageSource
  w: number; h: number; k: number
  blocos: Pedaco[]; pecas: Pedaco[]
}

/** A que profundidade a rede fica, atrás do fundo da tela (que fica em 1). */
export const Z_REDE = 1.7
/** As molduras do corredor: o vidro da tela, o meio, o fundo e mais uma, já no caminho da rede. */
const MOLDURAS = [0, 0.5, 1, 1.35]

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
  // de trás para a frente: os cartões, a barra e o topo no meio do caminho; o que está dentro de cada um (textos,
  // gráficos, botões) logo na frente dele; o fundo fica em 1
  const blocos: Pedaco[] = mapa.n1.map(([x, y, pw, ph]) => ({ x, y, w: pw, h: ph, z: 0.52 + r() * 0.3 }))
  const pecas: Pedaco[] = []
  for (const [x, y, pw, ph, pai] of mapa.n2) {
    const [bx, by, bw, bh] = mapa.n1[pai]
    if (x < bx - 4 || y < by - 4 || x + pw > bx + bw + 4 || y + ph > by + bh + 4) continue
    pecas.push({ x, y, w: pw, h: ph, z: blocos[pai].z - 0.16 - r() * 0.03 })
  }
  // o que está mais fundo é desenhado primeiro
  const ordem = (p: Pedaco[]) => p.sort((m, n) => n.z - m.z)
  return { a, b, c, ia: a, ib: b, ic: c, w, h, k: a.naturalWidth / w, blocos: ordem(blocos), pecas: ordem(pecas) }
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
 * Desenha a tela em (x0, y0) com escala s (px da tela da página por px da foto). desm vai de 0 (inteira) a 1 (a
 * câmera já passou por tudo e chegou na rede). Tudo cresce a partir do meio da tela, que é para onde a câmera vai.
 */
export function desenharConsultor(g: CanvasRenderingContext2D, t: ConsultorReal, x0: number, y0: number, s: number, desm: number, raio: number) {
  const { k } = t
  const rw = t.w * s, rh = t.h * s, vx = x0 + rw / 2, vy = y0 + rh / 2
  g.globalCompositeOperation = 'source-over'
  if (desm <= 0) {
    g.save()
    g.beginPath(); g.roundRect(x0, y0, rw, rh, raio); g.clip()
    g.drawImage(t.ia, x0, y0, rw, rh)
    g.restore()
    return
  }
  const { abre, cam, lado } = mergulho(desm)
  /** O tamanho de quem está na profundidade z (1 = no vidro, antes de a câmera andar); 0 se já ficou para trás. */
  const escala = (z: number) => { const d = 1 + z - cam; return d > 0.14 ? 1 / d : 0 }
  /** Perto da câmera a peça some (passou por ela). */
  const perto = (e: number) => 1 - suave(1.5, 2.9, e)
  const desvio = (z: number, e: number) => -lado * z * rw * e

  // o fundo da tela: escurece menos conforme a tela abre (a rede aparece através dele) e some quando a câmera chega
  const zf = abre, ef = escala(zf)
  if (ef > 0) {
    const a = (1 - 0.8 * abre) * perto(ef)
    if (a > 0.01) {
      const fx = vx - (rw / 2) * ef + desvio(zf, ef), fy = vy - (rh / 2) * ef
      g.save()
      g.globalAlpha = a
      g.beginPath(); g.roundRect(fx, fy, rw * ef, rh * ef, raio * ef); g.clip()
      g.drawImage(t.ic, fx, fy, rw * ef, rh * ef)
      g.restore()
    }
  }
  const bordas: [number, number, number, number, number][] = []
  const camada = (img: CanvasImageSource, lista: Pedaco[], luz: number, opaco: number) => {
    for (const p of lista) {
      const z = p.z * abre, e = escala(z)
      if (!e) continue
      const a = perto(e)
      if (a <= 0.01) continue
      const px = vx + (x0 + p.x * s - vx) * e + desvio(z, e), py = vy + (y0 + p.y * s - vy) * e
      const pw = p.w * s * e, ph = p.h * s * e
      if (px > g.canvas.width || py > g.canvas.height || px + pw < 0 || py + ph < 0) continue
      g.globalAlpha = a * (1 - (1 - opaco) * abre)
      g.drawImage(img, p.x * k, p.y * k, p.w * k, p.h * k, px, py, pw, ph)
      if (luz) bordas.push([px, py, pw, ph, a * luz * abre])
    }
  }
  // os cartões ficam um pouco transparentes (a rede aparece através deles); o que está dentro, inteiro
  camada(t.ib, t.blocos, 0.5, 0.72)
  camada(t.ia, t.pecas, 0, 1)
  g.globalAlpha = 1

  // por cima, em luz: a borda de cada cartão solto e o corredor (as molduras e as quinas indo para o fundo)
  g.globalCompositeOperation = 'lighter'
  g.strokeStyle = 'rgba(255,205,120,1)'; g.lineWidth = 1
  for (const [px, py, pw, ph, a] of bordas) { g.globalAlpha = a; g.strokeRect(px, py, pw, ph) }
  const some = 1 - suave(0.82, 1, desm)
  let eFrente = 0, eFundo = 0
  MOLDURAS.forEach((z, i) => {
    const e = escala(z)
    if (!e) return
    if (!eFrente) eFrente = e
    eFundo = e
    const a = (i === 0 ? 0.75 : 0.5) * abre * some * perto(e * 0.7)
    if (a <= 0.01) return
    g.globalAlpha = a
    g.lineWidth = i === 0 ? 1.5 : 1
    g.beginPath(); g.roundRect(vx - (rw / 2) * e + desvio(z, e), vy - (rh / 2) * e, rw * e, rh * e, raio * e); g.stroke()
  })
  // as quinas: quatro linhas da frente até o fundo do corredor
  if (eFundo) {
    const zF = MOLDURAS[MOLDURAS.length - 1], eF = escala(zF)
    const eP = eFrente || 7, zP = 1 / eP - 1 + cam
    g.globalAlpha = 0.32 * abre * some
    g.lineWidth = 1
    g.beginPath()
    for (const [qx, qy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      g.moveTo(vx + (qx * rw / 2) * eP + desvio(zP, eP), vy + (qy * rh / 2) * eP)
      g.lineTo(vx + (qx * rw / 2) * eF + desvio(zF, eF), vy + (qy * rh / 2) * eF)
    }
    g.stroke()
  }
  g.globalAlpha = 1
}
