import { useEffect, useRef, useState } from 'react'
import { Icone } from '../components/Icone'
import { MESES_NOME } from '../lib/format'
import { semMovimento } from '../lib/tema'
import { tx } from '../lib/textos'
import { ANO } from './apresentacaoCena'
import { alturaIdeal, desenharTela, type TelaPronta } from './algoritmoTela'
import { desenharDocs, desenharLancamento, LIDAS_PDF, LIDAS_PLANILHA, type DocPronto, type LinhaLida } from './algoritmoDocs'
import './algoritmo.css'

/**
 * "O motor do OpusCash": começa na tela do Consultor, que se desmonta em pedaços e mostra o que estava rodando atrás
 * dela, uma esfera holográfica feita de fragmentos dourados (pedacinhos de circuito, blocos e traços que piscam),
 * presa na tela enquanto a pessoa rola:
 *   0. por trás do Consultor: a tela se desmonta e revela a esfera, que já estava girando atrás;
 *   1. lê o extrato e a planilha: uma luz passa por um PDF do banco e por uma planilha, e cada linha sai como um
 *      lançamento limpo que entra na esfera (algoritmoDocs.ts);
 *   2. o motor calcula: a esfera gira, se deforma em ondas e acelera;
 *   3. compara: ela se desmancha e os fragmentos se arrumam num gráfico 3D dos meses (entrou × saiu, com a média);
 *   4. responde: os fragmentos pousam nos traços da tela do Consultor (as letras, o círculo da nota, as barras) e ela
 *      acende de cima para baixo no lugar deles (algoritmoTela.ts). Termina onde começou.
 *
 * Cada fragmento tem um lugar em cada forma; o desenho mistura as formas conforme o scroll, com um atraso por fragmento
 * (a mudança passa como uma onda) e um redemoinho no meio do caminho. Tudo num <canvas> somando luz.
 *
 * É uma imagem do que o motor faz, não um retrato técnico dele: o Consultor (lib/analise.ts) é feito de regras de
 * finanças, então os textos falam em cruzar e comparar, nunca em "inteligência artificial".
 */
const CENAS = [
  { titulo: tx('Por trás de cada conselho'), texto: tx('A tela do Consultor é só a ponta. Por baixo dela, um motor trabalha o tempo todo com os seus números.') },
  { titulo: tx('Lê seu extrato e sua planilha'), texto: tx('Mande o PDF do banco ou a planilha: o motor acha a data, o valor e o nome de cada linha, tira os códigos do banco e vira lançamento.') },
  { titulo: tx('A rede cruza tudo'), texto: tx('Cada número é ligado aos outros: o gasto de hoje com o mês, o mês com o ano, a dívida com o que sobra.') },
  { titulo: tx('Compara cada detalhe'), texto: tx('Seu mês com a sua média, os juros com a reserva, o ritmo de cada meta com o prazo dela.') },
  { titulo: tx('E diz o que fazer'), texto: tx('Uma nota para o seu dinheiro e um plano de ação na ordem certa, refeito a cada lançamento.') },
] as const

// ─── o gráfico da cena 3: os meses do Resumo do ano (entrou e saiu) e a média do que saiu ───
const MESES = ANO.entrou.length
const MEDIA_SAIU = ANO.saiu.reduce((a, b) => a + b, 0) / MESES
const TETO = Math.max(...ANO.entrou, ...ANO.saiu)
/** As etiquetas da cena 3: em cima de qual mês (índice) e o que dizem. */
const COMPARA: { mes: number; x: string; y: string; r: string; bom?: boolean }[] = [
  { mes: 10, x: MESES_NOME[10], y: tx('sua média'), r: tx('8% menos'), bom: true },
  { mes: 0, x: MESES_NOME[0], y: tx('o ano'), r: tx('melhor mês') },
  { mes: 8, x: MESES_NOME[8], y: tx('sua média'), r: tx('saiu mais que entrou') },
]

type V3 = [number, number, number]
/** Sorteio sempre igual (a cena é a mesma a cada visita). */
function sorteio(semente: number) {
  let s = semente
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296 }
}
const limitar = (n: number, a = 0, b = 1) => Math.min(b, Math.max(a, n))
const suave = (a: number, b: number, x: number) => { const t = limitar((x - a) / (b - a)); return t * t * (3 - 2 * t) }
const mistura = (a: number, b: number, t: number) => a + (b - a) * t
const RAIO = 250
const BASE_GRAF = 170, ALTO_GRAF = 330, LARGO_GRAF = 640

interface Frag {
  esfera: V3 // na esfera: [teta, fi, raio]
  barra: V3 // lugar no gráfico
  tela: V3 // lugar na tela
  atraso: number // a mudança de forma passa como uma onda
  w: number; h: number // tamanho do pedacinho
  brilho: number // 0 a 4 (cinco tons)
  cat: number // no gráfico: 0 entrou, 1 saiu, 2 linha da média, 3 chão (fica dourado)
  fase: number
}

/** Os fragmentos e o lugar de cada um em cada forma. */
function montar(N: number, pontos: Float32Array, k4: number, oy: number) {
  const r = sorteio(31)
  const fr: Frag[] = []
  // gráfico: colunas de fragmentos, uma por mês e por série (entrou na frente, saiu atrás), mais a linha da média
  const colunas: { x: number; z: number; alto: number }[] = []
  for (let m = 0; m < MESES; m++) {
    const x = (m / (MESES - 1) - 0.5) * LARGO_GRAF
    // lado a lado e quase no mesmo plano: com a câmera de lado, uma atrás da outra misturaria o verde e o vermelho
    colunas.push({ x: x - 13, z: 6, alto: (ANO.entrou[m] / TETO) * ALTO_GRAF })
    colunas.push({ x: x + 13, z: -6, alto: (ANO.saiu[m] / TETO) * ALTO_GRAF })
  }
  const somaAlto = colunas.reduce((a, c) => a + c.alto, 0)
  const yMedia = BASE_GRAF - (MEDIA_SAIU / TETO) * ALTO_GRAF
  for (let i = 0; i < N; i++) {
    // esfera com estrutura, como um holograma: faixas de latitude, meridianos, o resto espalhado na casca e um
    // pouco numa casca de dentro
    const k = i + 0.5
    let fi = Math.acos(1 - (2 * k) / N), teta = Math.PI * (1 + Math.sqrt(5)) * k, raio = RAIO * (0.97 + r() * 0.06)
    const tipo = r()
    if (tipo < 0.42) { fi = ((Math.floor(r() * 13) + 1) / 14) * Math.PI + (r() - 0.5) * 0.03; teta = r() * Math.PI * 2 }
    else if (tipo < 0.6) { teta = (Math.floor(r() * 7) / 7) * Math.PI * 2 + (r() - 0.5) * 0.02; fi = r() * Math.PI }
    else if (tipo < 0.82) { raio = RAIO * (0.94 + r() * 0.12) }
    else { raio = RAIO * (0.42 + r() * 0.4) }
    // gráfico: 82% nas colunas (proporcional à altura), o resto na linha da média e no chão
    let barra: V3, cat = 3
    const q = r()
    if (q < 0.82) {
      let alvo = r() * somaAlto, c = 0
      while (c < colunas.length - 1 && alvo > colunas[c].alto) { alvo -= colunas[c].alto; c++ }
      const col = colunas[c]
      barra = [col.x + (r() - 0.5) * 16, BASE_GRAF - r() * col.alto, col.z + (r() - 0.5) * 8]
      cat = c % 2 // as colunas vêm em pares: entrou, saiu
    } else if (q < 0.93) {
      barra = [(r() - 0.5) * (LARGO_GRAF + 50), yMedia + (r() - 0.5) * 3, 0]
      cat = 2
    } else {
      barra = [(r() - 0.5) * (LARGO_GRAF + 60), BASE_GRAF + 6 + r() * 4, (r() - 0.5) * 120]
    }
    // tela: um ponto dos traços da tela do Consultor (sorteados em algoritmoTela.ts), em px de desenho
    const tela: V3 = [pontos[i * 2] / k4, pontos[i * 2 + 1] / k4 + oy, 0]
    fr.push({
      // a maioria são traços e pontos; uns 12% são placas maiores (os blocos de dados do holograma)
      esfera: [teta, fi, raio], barra, tela, atraso: r() * 0.35,
      ...(r() < 0.12 ? { w: 6 + r() * 9, h: 2 + r() * 2.5 } : { w: 1 + r() * 4.5, h: 1 + r() * 1.4 }),
      brilho: Math.min(4, Math.floor(Math.pow(r(), 1.15) * 5)), fase: r() * 10, cat,
    })
  }
  return fr
}

/** Câmera em cada cena: giro e inclinação (rad), aproximação. Na primeira e na última fica de frente: a tela encaixa na tela. */
const CAM = [
  { yaw: 0, pitch: 0, zoom: 1.08 },
  { yaw: -0.3, pitch: 0.18, zoom: 0.8 },
  { yaw: 0.35, pitch: 0.3, zoom: 1.05 },
  { yaw: 0.26, pitch: 0.12, zoom: 1.0 },
  { yaw: 0, pitch: 0, zoom: 1.08 },
]
const ZOOM_TELA = CAM[CAM.length - 1].zoom

/** Um pedaço da tela do Consultor quando ela se desmonta (cena 0): o recorte, para onde voa e quando. */
interface Peca { x: number; y: number; w: number; h: number; dx: number; dy: number; giro: number; atraso: number }
function pecas(w: number, h: number, colunas: number) {
  const r = sorteio(11), linhas = Math.max(4, Math.round((colunas * h) / w)), pw = w / colunas, ph = h / linhas
  const lista: Peca[] = []
  for (let l = 0; l < linhas; l++) for (let c = 0; c < colunas; c++) {
    const x = c * pw, y = l * ph
    const nx = (x + pw / 2 - w / 2) / (w / 2), ny = (y + ph / 2 - h / 2) / (h / 2)
    // as do meio saem primeiro (abrem o buraco por onde o motor aparece) e voam para fora, na direção em que estão
    let dx = nx + (r() - 0.5) * 0.7, dy = ny + (r() - 0.5) * 0.7
    const d = Math.hypot(dx, dy) || 1
    dx /= d; dy /= d
    lista.push({ x, y, w: pw, h: ph, dx, dy, giro: (r() - 0.5) * 1.8, atraso: Math.min(1, Math.hypot(nx, ny) / 1.41) * 0.38 + r() * 0.17 })
  }
  return lista
}

/** Brilho redondo pronto (desenhado uma vez e carimbado): bem mais barato que desfoque a cada quadro. */
function brilho(tam: number, paradas: [number, string][]) {
  const c = document.createElement('canvas')
  c.width = c.height = tam
  const g = c.getContext('2d')!
  const rad = g.createRadialGradient(tam / 2, tam / 2, 0, tam / 2, tam / 2, tam / 2)
  paradas.forEach(([o, cor]) => rad.addColorStop(o, cor))
  g.fillStyle = rad
  g.fillRect(0, 0, tam, tam)
  return c
}
const TONS = ['rgba(180,85,10,0.6)', 'rgba(235,130,30,0.8)', 'rgba(255,170,50,0.9)', 'rgba(255,210,120,0.97)', 'rgba(255,248,222,1)']
/**
 * Cores do gráfico (as do app): entrou verde, saiu vermelho, a média azul-clara. Cada uma nos mesmos cinco tons do
 * dourado. A troca de cor tem PASSOS degraus entre o dourado e a cor, e cada fragmento anda neles na sua vez.
 */
const PASSOS = 6
const CORES_GRAF: [number, number, number][] = [[46, 214, 128], [255, 92, 108], [120, 196, 255]]
const DOURADO: [number, number, number, number][] = [[180, 85, 10, 0.6], [235, 130, 30, 0.8], [255, 170, 50, 0.9], [255, 210, 120, 0.97], [255, 248, 222, 1]]
/** PALETA[cat][tom][passo]: o fragmento da categoria cat, no tom, com passo/(PASSOS-1) da cor do gráfico. */
const PALETA = CORES_GRAF.map((c) => DOURADO.map(([r, g, b, a], tom) => {
  // tom 0 é a cor escura; tom 4 quase branco
  const luz = [0.55, 0.78, 1, 1, 1][tom], branco = [0, 0, 0, 0.35, 0.75][tom]
  const alvo = c.map((v) => Math.round(v * luz + (255 - v * luz) * branco))
  return Array.from({ length: PASSOS }, (_, k) => {
    const t = k / (PASSOS - 1)
    return `rgba(${Math.round(r + (alvo[0] - r) * t)},${Math.round(g + (alvo[1] - g) * t)},${Math.round(b + (alvo[2] - b) * t)},${a})`
  })
}))

export function Algoritmo() {
  const secaoRef = useRef<HTMLElement>(null)
  const stickyRef = useRef<HTMLDivElement>(null)
  const telaRef = useRef<HTMLCanvasElement>(null)
  const [cena, setCena] = useState(0)

  useEffect(() => {
    const secao = secaoRef.current, sticky = stickyRef.current, canvas = telaRef.current
    if (!secao || !sticky || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const n = CENAS.length
    const comparas = [...sticky.querySelectorAll<HTMLElement>('.ag-compara')]
    const contador = sticky.querySelector<HTMLElement>('[data-relacoes]')
    const sprHalo = brilho(256, [[0, 'rgba(255,200,110,0.55)'], [0.25, 'rgba(255,150,40,0.22)'], [0.6, 'rgba(255,120,20,0.06)'], [1, 'rgba(255,100,10,0)']])
    const sprPonto = brilho(48, [[0, 'rgba(255,248,225,1)'], [0.2, 'rgba(255,200,90,0.9)'], [0.55, 'rgba(255,150,40,0.22)'], [1, 'rgba(255,130,20,0)']])
    const sprBokeh = brilho(96, [[0, 'rgba(255,170,50,0.18)'], [0.7, 'rgba(255,165,45,0.22)'], [0.86, 'rgba(255,195,90,0.3)'], [1, 'rgba(255,140,30,0)']])

    let W = 0, H = 0, dpr = 1, cx = 0, cy = 0, esc = 1, celular = false, reduzir = false
    let fr: Frag[] = [], chaveTela = ''
    // a tela do Consultor (cena 4): desenhada em px de CSS, centrada em (cx, yTela). No computador fica no lugar da
    // esfera; no celular, entre o texto e os selos
    let tela: TelaPronta | null = null, yTela = 0, pedacos: Peca[] = []
    // a leitura (cena 1): o documento fica em (docX, docY) e a esfera anda (desX, desY) para dar lugar a ele
    let docs: { pdf: DocPronto; planilha: DocPronto } | null = null, docX = 0, docY = 0, desX = 0, desY = 0, chaveDocs = ''
    const texto = sticky.querySelector<HTMLElement>('.ag-texto')!, selos = sticky.querySelector<HTMLElement>('.ag-selos')!
    const estilo = getComputedStyle(document.documentElement)
    const fonte = (v: string, padrao: string) => estilo.getPropertyValue(v).trim() || padrao
    const fontes = () => ({ texto: fonte('--fonte', 'Inter, sans-serif'), titulo: fonte('--fonte-titulo', 'Inter, sans-serif'), numeros: fonte('--fonte-numeros', 'Inter, sans-serif') })
    let letras = fontes()
    const medir = () => {
      reduzir = semMovimento()
      W = sticky.clientWidth; H = sticky.clientHeight; celular = W <= 900
      dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr)
      canvas.style.width = `${W}px`; canvas.style.height = `${H}px`
      if (celular) {
        const topo = Math.min(270, H * 0.33), ah = H - topo
        cx = W / 2; cy = topo + ah * 0.43; esc = Math.min((W * 0.94) / 760, ah / 820)
      } else {
        const esq = Math.min(460, W * 0.36), aw = W - esq - 40
        cx = esq + aw / 2; cy = H * 0.5; esc = Math.min(aw / 860, (H * 0.86) / 700)
      }
      // menos fragmentos em tela pequena (desenha menos e fica igual de denso)
      const N = celular ? 1100 : 1700
      let tw: number, th: number
      if (celular) {
        const topo = texto.getBoundingClientRect().bottom - sticky.getBoundingClientRect().top + 14
        const fundo = H - selos.offsetHeight - 30
        tw = Math.min(W - 24, 420); th = Math.max(300, Math.min(fundo - topo, alturaIdeal(tw))); yTela = (topo + fundo) / 2
      } else {
        const esq = Math.min(460, W * 0.36), aw = W - esq - 40
        tw = Math.min(aw * 0.92, 700); th = Math.min(alturaIdeal(tw), H * 0.8); yTela = cy
      }
      tw = Math.round(tw); th = Math.round(th)
      const k4 = esc * ZOOM_TELA
      const chave = `${N}|${tw}|${th}|${yTela.toFixed(0)}|${k4.toFixed(4)}|${document.documentElement.lang}`
      if (chave !== chaveTela) {
        chaveTela = chave
        const q = Math.min(window.devicePixelRatio || 1, 2)
        letras = fontes()
        tela = desenharTela(tw, th, q, N, letras, sorteio(7))
        fr = montar(N, tela.pontos, k4, (yTela - cy) / k4)
        pedacos = pecas(tw, th, celular ? 6 : 10)
      }
      let dw: number, dh: number
      if (celular) {
        const topo = texto.getBoundingClientRect().bottom - sticky.getBoundingClientRect().top + 10
        dw = Math.min(W - 56, 290); dh = 196
        docX = W / 2; docY = topo + dh / 2
        desX = 0; desY = (docY + dh / 2 + H - 24) / 2 - cy
      } else {
        const esq = Math.min(460, W * 0.36), aw = W - esq - 40
        dw = Math.min(320, aw * 0.42); dh = dw * 1.2
        docX = Math.max(esq + 16 + dw / 2, esq + aw * 0.22); docY = cy
        desX = aw * 0.2; desY = 0
      }
      dw = Math.round(dw); dh = Math.round(dh)
      const chaveD = `${dw}|${dh}|${document.documentElement.lang}`
      if (chaveD !== chaveDocs) { chaveDocs = chaveD; docs = desenharDocs(dw, dh, Math.min(window.devicePixelRatio || 1, 2), letras) }
    }

    let yaw = 0, pitch = 0, zoom = 1, offX = 0, offY = 0
    const F = 1150
    const proj = (x: number, y: number, z: number) => {
      const cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch)
      const X = x * cyw + z * syw
      let Z = -x * syw + z * cyw
      const Y = y * cp - Z * sp
      Z = y * sp + Z * cp
      const s = F / Math.max(150, F + Z)
      return { x: cx + offX + X * s * esc * zoom, y: cy + offY + Y * s * esc * zoom, s }
    }

    const ultimo = new Map<string, string>()
    const por = (k: string, v: string, f: () => void) => { if (ultimo.get(k) !== v) { ultimo.set(k, v); f() } }
    let cenaAtual = -1, giro = 0, antesGiro = 0
    const xs = new Float32Array(2000), ys = new Float32Array(2000), ss = new Float32Array(2000), vs = new Float32Array(2000)

    const desenhar = (p: number, tempo: number) => {
      const pres: number[] = [], and: number[] = []
      for (let i = 0; i < n; i++) {
        const a = i / n, b = (i + 1) / n
        pres.push((i === 0 ? 1 : suave(a - 0.04, a + 0.04, p)) * (i === n - 1 ? 1 : 1 - suave(b - 0.04, b + 0.04, p)))
        and.push(limitar(((p - a) / (b - a)) * 1.15))
      }
      const fpos = limitar(p * n - 0.5, 0, n - 1), i0 = Math.floor(fpos), i1 = Math.min(n - 1, i0 + 1), f = suave(0, 1, fpos - i0)
      const t = reduzir ? 0 : tempo, s = t / 1000
      // a câmera para de balançar na primeira e na última cena: a tela fica de frente, no plano dela
      const bal = limitar(1 - pres[0] - pres[n - 1])
      yaw = mistura(CAM[i0].yaw, CAM[i1].yaw, f) + Math.sin(t * 0.00023) * 0.1 * bal
      pitch = mistura(CAM[i0].pitch, CAM[i1].pitch, f) + Math.cos(t * 0.00017) * 0.05 * bal
      zoom = mistura(CAM[i0].zoom, CAM[i1].zoom, f)
      // na leitura a esfera chega para o lado e o documento fica no lugar dela
      offX = desX * pres[1]; offY = desY * pres[1]
      // cena 0: a tela se desmonta (desm) e a esfera, escondida atrás dela, cresce e acende (oculto vai a 0)
      const desm = suave(0.03, 0.16, p), oculto = 1 - suave(0.05, 0.17, p)
      const u1 = limitar((p - 0.2) / 0.2) // o andamento da leitura
      // a esfera gira; calculando (cena 2), gira mais rápido
      const dt = antesGiro ? Math.min(0.05, (tempo - antesGiro) / 1000) : 0
      antesGiro = tempo
      if (!reduzir) giro += dt * (0.25 + 0.9 * pres[2] + 0.3 * pres[1])
      const calc = pres[2] // o quanto a esfera está "calculando" (ondas na casca)

      // as formas ao longo do scroll: esfera → gráfico → tela. Cada fragmento muda com um atraso
      const g0 = limitar((p - 0.576) / 0.144), v0 = limitar((p - 0.776) / 0.128), raioK = 1 - 0.42 * oculto
      const forma = (fx: Frag, i: number): V3 => {
        const [teta, fi, raio] = fx.esfera
        const onda = 1 + calc * 0.13 * Math.sin(3 * fi + s * 2.3) * Math.cos(2 * teta - s * 1.7)
        const tt = teta + giro
        const sf = Math.sin(fi) * raio * onda * raioK
        const ex = sf * Math.cos(tt), ey = Math.cos(fi) * raio * onda * raioK, ez = sf * Math.sin(tt)
        const g = suave(fx.atraso, fx.atraso + 0.55, g0)
        const v = suave(fx.atraso, fx.atraso + 0.55, v0)
        vs[i] = v
        let x = mistura(ex, fx.barra[0], g), y = mistura(ey, fx.barra[1], g), z = mistura(ez, fx.barra[2], g)
        x = mistura(x, fx.tela[0], v); y = mistura(y, fx.tela[1], v); z = mistura(z, fx.tela[2], v)
        // redemoinho no meio de cada viagem: o fragmento faz uma curva em vez de ir reto
        const meio = Math.sin(Math.PI * g) + Math.sin(Math.PI * v)
        if (meio > 0.01) {
          const a = fx.fase + s * 0.8
          x += Math.cos(a) * 90 * meio; y += Math.sin(a * 1.3) * 60 * meio; z += Math.sin(a) * 90 * meio
        }
        return [x, y, z]
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, H)
      ctx.globalCompositeOperation = 'lighter'

      // névoa de luz atrás (mais forte com a esfera inteira)
      const centro = proj(0, 0, 0)
      const esferaCheia = (1 - suave(0.576, 0.68, p)) * (1 - oculto)
      // a leitura: onde está a luz em cada documento e os lançamentos no ar; cada um que chega acende a esfera
      let chegada = 0, bPdf = 0, bPla = 0
      const lidos: { l: LinhaLida; doc: DocPronto; i: number; c: number }[] = []
      if (docs && pres[1] > 0.01) {
        const leitura = (doc: DocPronto, lista: LinhaLida[], ini: number, dur: number) => {
          const b = mistura(-0.05, 1.4, limitar((u1 - ini) / dur))
          lista.forEach((l, i) => {
            const t0 = (doc.linhas[i] - doc.topoLinhas) / (doc.fimLinhas - doc.topoLinhas)
            const c = limitar((b - t0) / 0.42)
            if (c > 0 && c < 1) lidos.push({ l, doc, i, c })
            chegada += Math.max(0, 1 - Math.abs(c - 0.97) / 0.06)
          })
          return b
        }
        bPdf = leitura(docs.pdf, LIDAS_PDF, 0.08, 0.36)
        bPla = leitura(docs.planilha, LIDAS_PLANILHA, 0.56, 0.33)
      }
      chegada = Math.min(1, chegada) * pres[1]
      const th = (720 + 160 * calc) * esc * zoom
      ctx.globalAlpha = Math.min(1, 0.25 + 0.55 * esferaCheia + 0.3 * pres[n - 1] + 0.3 * pres[0] + 0.5 * chegada)
      ctx.drawImage(sprHalo, centro.x - th / 2, centro.y - th / 2, th, th)
      ctx.globalAlpha = 1

      // anéis tracejados em volta da esfera (somem quando ela vira gráfico)
      if (esferaCheia > 0.02) {
        const anel = (r: number, ix: number, iy: number, rot: number, alfa: number, larg: number, arco = false) => {
          ctx.beginPath()
          for (let k = 0; k <= (arco ? 60 : 96); k++) {
            const a = (k / 96) * Math.PI * 2 + rot
            const X0 = Math.cos(a) * r, Y0 = Math.sin(a) * r
            const Y1 = Y0 * Math.cos(ix), Z1 = Y0 * Math.sin(ix)
            const X2 = X0 * Math.cos(iy) + Z1 * Math.sin(iy), Z2 = -X0 * Math.sin(iy) + Z1 * Math.cos(iy)
            const P = proj(X2, Y1, Z2)
            if (arco ? k === 0 : k % 8 === 0) ctx.moveTo(P.x, P.y); else if (arco || k % 8 < 5) ctx.lineTo(P.x, P.y)
          }
          // passada larga e fraca (o brilho) e passada fina e forte
          ctx.strokeStyle = `rgba(255,150,40,${alfa * 0.25})`; ctx.lineWidth = larg * 4; ctx.stroke()
          ctx.strokeStyle = `rgba(255,205,120,${alfa})`; ctx.lineWidth = larg; ctx.stroke()
        }
        anel(RAIO * 1.18, 1.25, 0.2, giro * 0.7, 0.55 * esferaCheia, 1.2)
        anel(RAIO * 1.32, 0.35, -0.6, -giro * 0.5, 0.4 * esferaCheia, 1.2)
        anel(RAIO * 0.42, 1.0, 0.4, giro * 1.6, 0.8 * esferaCheia, 1.4)
        // arcos de luz fortes passando por dentro da esfera (como os da imagem de referência)
        anel(RAIO * 0.78, 1.4, -0.3, giro * 1.1, 0.9 * esferaCheia, 3.2, true)
        anel(RAIO * 0.62, 0.6, 0.9, -giro * 1.3, 0.75 * esferaCheia, 2.4, true)
      }

      // a tela acende de cima para baixo depois que os fragmentos pousam: acima da linha de luz já é a tela; os
      // fragmentos que ficaram para trás dela somem, os que estão logo abaixo da linha brilham mais
      const kT = zoom / ZOOM_TELA
      const tlx = cx - (tela ? tela.w : 0) * kT / 2, tly = yTela + (centro.y - cy - offY) - (tela ? tela.h : 0) * kT / 2
      const acende = suave(0.908, 0.968, p)
      const yLuz = tela ? tly - 30 + acende * (tela.h * kT + 60) : -1e9

      // os fragmentos: projeta todos, depois pinta por tom (menos trocas de cor)
      const N = fr.length
      for (let i = 0; i < N; i++) {
        const [x, y, z] = forma(fr[i], i)
        const P = proj(x, y, z)
        xs[i] = P.x; ys[i] = P.y; ss[i] = P.s
      }
      const pisca = Math.floor(s * 7)
      // a cor do gráfico: depois que as colunas se formam, a cor varre o gráfico da esquerda para a direita (o mês de
      // janeiro troca primeiro) e volta ao dourado quando ele vira a tela
      const fimTela = suave(0.776, 0.84, p)
      const grupos = new Map<string, number[]>()
      for (let i = 0; i < N; i++) {
        const fx = fr[i]
        // alguns piscam (como no holograma): sobem de tom de tempos em tempos
        let tom = reduzir ? fx.brilho : Math.min(4, fx.brilho + ((i * 7 + pisca) % 11 === 0 ? 2 : 0))
        if (acende > 0 && vs[i] > 0.98) {
          if (ys[i] < yLuz - 3) continue
          if (ys[i] < yLuz + 34) tom = 4
        }
        let chave = `d${tom}`
        if (fx.cat < 3) {
          const ini = 0.668 + (fx.barra[0] / LARGO_GRAF + 0.5) * 0.048 + fx.atraso * 0.024
          const c = suave(ini, ini + 0.028, p) * (1 - fimTela)
          const passo = Math.round(c * (PASSOS - 1))
          if (passo > 0) chave = `${fx.cat}.${tom}.${passo}`
        }
        let g = grupos.get(chave)
        if (!g) { g = []; grupos.set(chave, g) }
        g.push(i)
      }
      // escondidos atrás da tela no começo, os fragmentos ficam apagados
      ctx.globalAlpha = 1 - 0.85 * oculto
      grupos.forEach((idx, chave) => {
        if (chave[0] === 'd') ctx.fillStyle = TONS[Number(chave.slice(1))]
        else { const [c, tom, passo] = chave.split('.').map(Number); ctx.fillStyle = PALETA[c][tom][passo] }
        for (const i of idx) {
          // pousados na tela, ficam menores (viram os traços das letras)
          const fx = fr[i], k = ss[i] * esc * zoom * (1 - 0.35 * vs[i])
          ctx.fillRect(xs[i] - (fx.w * k) / 2, ys[i] - (fx.h * k) / 2, fx.w * k + 0.6, fx.h * k + 0.6)
        }
      })
      // pontos mais quentes com brilho (um a cada 14 fragmentos)
      ctx.globalAlpha = 0.6 * (1 - 0.85 * oculto)
      for (let i = 0; i < N; i += 14) {
        if (acende > 0 && vs[i] > 0.98 && ys[i] < yLuz - 3) continue
        const tam = (10 + 8 * Math.sin(s * 2 + fr[i].fase)) * ss[i] * esc
        ctx.drawImage(sprPonto, xs[i] - tam / 2, ys[i] - tam / 2, tam, tam)
      }
      ctx.globalAlpha = 1

      // o centro da esfera: um anel de luz aceso
      if (esferaCheia > 0.02) {
        const tn = (110 + 20 * Math.sin(s * 3) + 120 * chegada) * esc * zoom
        ctx.globalAlpha = esferaCheia
        ctx.drawImage(sprPonto, centro.x - tn / 2, centro.y - tn / 2, tn, tn)
        ctx.strokeStyle = `rgba(255,220,150,${0.8 * esferaCheia})`; ctx.lineWidth = 2
        ctx.beginPath(); ctx.ellipse(centro.x, centro.y, 34 * esc * zoom, 30 * esc * zoom, 0, 0, Math.PI * 2); ctx.stroke()
        ctx.globalAlpha = 1
      }

      // cena 0: a tela inteira e, rolando, os pedaços dela voando para fora (e para perto de quem olha)
      if (tela && desm < 1 && pres[0] > 0) {
        const tw = tela.w * kT, th = tela.h * kT, m = tela.m * kT, k = tela.q
        ctx.globalCompositeOperation = 'source-over'
        if (desm <= 0) ctx.drawImage(tela.img, tlx - m, tly - m, tw + m * 2, th + m * 2)
        else {
          const bordas: [number, number, number, number, number, number, number][] = []
          for (const pc of pedacos) {
            const u = suave(pc.atraso, pc.atraso + 0.45, desm)
            const a = 1 - suave(0.25, 0.85, u)
            if (a <= 0.01) continue
            const voo = u * u
            const x = tlx + (pc.x + pc.w / 2) * kT + pc.dx * voo * W * 0.42
            const y = tly + (pc.y + pc.h / 2) * kT + pc.dy * voo * H * 0.42 - u * 30
            const e = 1 + 1.1 * u
            ctx.save()
            ctx.globalAlpha = a
            ctx.translate(x, y); ctx.rotate(pc.giro * u); ctx.scale(e, e)
            ctx.drawImage(tela.img, (pc.x + tela.m) * k, (pc.y + tela.m) * k, pc.w * k, pc.h * k, (-pc.w * kT) / 2, (-pc.h * kT) / 2, pc.w * kT, pc.h * kT)
            ctx.restore()
            if (u > 0) bordas.push([x, y, pc.giro * u, e, pc.w * kT, pc.h * kT, a * Math.min(1, u * 5) * (1 - u)])
          }
          // a quebra brilha nas bordas dos pedaços
          ctx.globalCompositeOperation = 'lighter'
          ctx.strokeStyle = 'rgba(255,200,110,0.55)'; ctx.lineWidth = 1
          for (const [x, y, gi, e, w, h, a] of bordas) {
            ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); ctx.rotate(gi); ctx.scale(e, e)
            ctx.strokeRect(-w / 2, -h / 2, w, h); ctx.restore()
          }
        }
        ctx.globalAlpha = 1
        ctx.globalCompositeOperation = 'lighter'
      }

      // cena 1: o documento (o PDF, que gira e vira a planilha), a luz que lê as linhas e os lançamentos que saem
      if (docs && pres[1] > 0.01) {
        const vira = limitar((u1 - 0.47) / 0.08)
        const doc = vira < 0.5 ? docs.pdf : docs.planilha
        const b = vira < 0.5 ? bPdf : bPla
        const chegaDoc = suave(0, 0.08, u1), saiDoc = suave(0.9, 0.99, u1)
        const a = pres[1] * chegaDoc * (1 - saiDoc)
        const e = mistura(0.9, 1, chegaDoc) * (1 - 0.12 * saiDoc), ex = Math.abs(Math.cos(Math.PI * vira))
        if (a > 0.01) {
          ctx.save()
          ctx.translate(docX, docY); ctx.scale(e * Math.max(0.02, ex), e)
          ctx.globalAlpha = a
          ctx.globalCompositeOperation = 'source-over'
          ctx.drawImage(doc.img, -doc.w / 2 - doc.m, -doc.h / 2 - doc.m, doc.w + doc.m * 2, doc.h + doc.m * 2)
          ctx.globalCompositeOperation = 'lighter'
          // as linhas já lidas ficam marcadas de dourado
          const passo = (doc.fimLinhas - doc.topoLinhas) / doc.linhas.length
          for (const ly of doc.linhas) {
            const lida = limitar((b - (ly - doc.topoLinhas) / (doc.fimLinhas - doc.topoLinhas)) * 8)
            if (lida > 0) { ctx.fillStyle = `rgba(255,170,60,${(0.2 * lida).toFixed(3)})`; ctx.fillRect(-doc.w / 2 + 8, ly - doc.h / 2 - passo / 2 + 1, doc.w - 16, passo - 2) }
          }
          if (b > 0 && b < 1) {
            const yb = doc.topoLinhas + b * (doc.fimLinhas - doc.topoLinhas) - doc.h / 2
            const rastro = ctx.createLinearGradient(0, yb - 40, 0, yb)
            rastro.addColorStop(0, 'rgba(255,170,60,0)'); rastro.addColorStop(1, 'rgba(255,180,70,0.35)')
            ctx.fillStyle = rastro; ctx.fillRect(-doc.w / 2, yb - 40, doc.w, 40)
            ctx.fillStyle = 'rgba(255,215,140,0.95)'; ctx.fillRect(-doc.w / 2 - 14, yb - 1, doc.w + 28, 2)
            ctx.globalAlpha = a * 0.45; ctx.fillRect(-doc.w / 2 - 14, yb - 5, doc.w + 28, 10)
          }
          ctx.restore()
        }
        // cada linha lida vira um lançamento que voa até a esfera, com um rastro de faíscas
        for (const { l, doc: dl, i, c } of lidos) {
          const ry = docY + (dl.linhas[i] - dl.h / 2) * e
          const sx = celular ? docX : docX + dl.w * 0.32, sy = ry
          const kx = celular ? docX + (i % 2 ? 80 : -80) : (sx + centro.x) / 2, ky = celular ? (sy + centro.y) / 2 : Math.min(sy, centro.y) - 80
          const ponto = (t: number) => [(1 - t) * (1 - t) * sx + 2 * (1 - t) * t * kx + t * t * centro.x, (1 - t) * (1 - t) * sy + 2 * (1 - t) * t * ky + t * t * centro.y]
          const tb = suave(0.12, 1, c)
          ctx.globalCompositeOperation = 'lighter'
          for (let k = 1; k <= 5; k++) {
            const t = tb - k * 0.035
            if (t <= 0) break
            const [x, y] = ponto(t), tam = (16 - k * 2) * (celular ? 0.8 : 1)
            ctx.globalAlpha = pres[1] * 0.7 * (1 - k / 6)
            ctx.drawImage(sprPonto, x - tam / 2, y - tam / 2, tam, tam)
          }
          ctx.globalAlpha = 1
          ctx.globalCompositeOperation = 'source-over'
          const [x, y] = ponto(tb)
          const tam = (celular ? 0.82 : 1) * (c < 0.12 ? mistura(0.7, 1, c / 0.12) : mistura(1, 0.1, suave(0.45, 1, c)))
          desenharLancamento(ctx, l, x, y, tam, pres[1] * suave(0, 0.06, c) * (1 - suave(0.86, 1, c)), letras)
        }
        ctx.globalAlpha = 1
        ctx.globalCompositeOperation = 'lighter'
      }

      // a tela do Consultor: a parte já acesa (acima da linha de luz), a linha e o rastro dourado logo acima dela
      if (tela && acende > 0) {
        const tw = tela.w * kT, th = tela.h * kT, m = tela.m * kT
        const corte = Math.min(yLuz, tly + th + m)
        ctx.globalCompositeOperation = 'source-over'
        ctx.save()
        ctx.beginPath(); ctx.rect(tlx - m, tly - m, tw + m * 2, corte - (tly - m)); ctx.clip()
        ctx.drawImage(tela.img, tlx - m, tly - m, tw + m * 2, th + m * 2)
        ctx.restore()
        ctx.globalCompositeOperation = 'lighter'
        if (acende < 1) {
          const y0 = Math.max(tly, yLuz - 70), y1 = Math.min(tly + th, yLuz)
          if (y1 > y0) {
            const rastro = ctx.createLinearGradient(0, yLuz - 70, 0, yLuz)
            rastro.addColorStop(0, 'rgba(255,170,60,0)'); rastro.addColorStop(1, 'rgba(255,190,90,0.38)')
            ctx.fillStyle = rastro; ctx.fillRect(tlx, y0, tw, y1 - y0)
          }
          if (yLuz > tly - 10 && yLuz < tly + th + 10) {
            const lado = ctx.createLinearGradient(tlx - 40, 0, tlx + tw + 40, 0)
            lado.addColorStop(0, 'rgba(255,200,110,0)'); lado.addColorStop(0.15, 'rgba(255,220,150,0.95)')
            lado.addColorStop(0.85, 'rgba(255,220,150,0.95)'); lado.addColorStop(1, 'rgba(255,200,110,0)')
            ctx.fillStyle = lado; ctx.fillRect(tlx - 40, yLuz - 1.5, tw + 80, 3)
            ctx.globalAlpha = 0.5; ctx.fillRect(tlx - 40, yLuz - 6, tw + 80, 12); ctx.globalAlpha = 1
          }
        } else if (!reduzir) {
          // pronta: de tempos em tempos um reflexo atravessa o vidro
          const ciclo = (s % 5.5) / 1.6
          if (ciclo < 1) {
            const x = tlx - tw * 0.4 + ciclo * tw * 1.8
            const reflexo = ctx.createLinearGradient(x - 120, tly, x + 120, tly + th)
            reflexo.addColorStop(0, 'rgba(255,220,160,0)'); reflexo.addColorStop(0.5, 'rgba(255,220,160,0.07)'); reflexo.addColorStop(1, 'rgba(255,220,160,0)')
            ctx.save(); ctx.beginPath(); ctx.roundRect(tlx, tly, tw, th, 20 * kT); ctx.clip()
            ctx.fillStyle = reflexo; ctx.fillRect(tlx, tly, tw, th); ctx.restore()
          }
        }
      }

      // bokeh por cima, poucos e grandes
      ctx.globalAlpha = 0.28
      for (let i = 0; i < 14; i++) {
        const a = i * 2.39 + s * 0.05, rr = (380 + (i % 4) * 120) * esc
        const x = cx + Math.cos(a) * rr * 1.3, y = cy + Math.sin(a * 1.2) * rr * 0.75, tam = (60 + (i % 5) * 26) * esc
        ctx.drawImage(sprBokeh, x - tam / 2, y - tam / 2, tam, tam)
      }
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'

      // ─── por cima ───
      // cena 3: etiquetas em cima das colunas dos meses
      const fc = COMPARA.map((_, i) => pres[3] * limitar(and[3] * 2.4 - 0.7 - i * 0.28))
      COMPARA.forEach((c, i) => {
        const x = (c.mes / (MESES - 1) - 0.5) * LARGO_GRAF, alto = (Math.max(ANO.entrou[c.mes], ANO.saiu[c.mes]) / TETO) * ALTO_GRAF
        const P0 = proj(x, BASE_GRAF - alto - 24, 0)
        // no celular, presas dentro da tela e em degraus (lado a lado não cabem)
        const P = celular ? { x: limitar(P0.x, 86, W - 86), y: Math.min(P0.y, cy - 60) - i * 52 } : P0
        por(`c${i}`, `${P.x.toFixed(1)},${P.y.toFixed(1)},${fc[i].toFixed(3)}`, () => {
          comparas[i].style.transform = `translate3d(${P.x.toFixed(1)}px, ${P.y.toFixed(1)}px, 0) translate(-50%, -100%) scale(${(0.85 + 0.15 * fc[i]).toFixed(3)})`
          comparas[i].style.opacity = fc[i].toFixed(3)
          comparas[i].style.visibility = fc[i] < 0.01 ? 'hidden' : 'visible'
        })
      })
      pres.forEach((v, i) => por(`p${i}`, v.toFixed(3), () => sticky.style.setProperty(`--p${i}`, v.toFixed(3))))
      const rel = Math.round(2418 * limitar(and[2] * 1.3))
      if (contador) por('rel', String(rel), () => { contador.textContent = rel.toLocaleString('pt-BR') })

      const qual = Math.min(n - 1, Math.floor(p * n))
      if (qual !== cenaAtual) { cenaAtual = qual; setCena(qual) }
    }

    let alvo = 0, atual = 0, quadro = 0, visivel = false, antes = 0
    const lerScroll = () => {
      const total = secao.offsetHeight - window.innerHeight
      alvo = total > 0 ? limitar(-secao.getBoundingClientRect().top / total) : 0
    }
    const laco = (agora: number) => {
      const dt = Math.min(0.05, (agora - (antes || agora)) / 1000); antes = agora
      atual = reduzir ? alvo : atual + (alvo - atual) * (1 - Math.exp(-dt * 5))
      if (Math.abs(alvo - atual) < 0.0002) atual = alvo
      desenhar(atual, agora)
      quadro = visivel ? requestAnimationFrame(laco) : 0
    }
    const obs = new IntersectionObserver(([e]) => {
      visivel = e.isIntersecting
      sticky.classList.toggle('ag-parado', !visivel)
      if (visivel && !quadro) { lerScroll(); antes = 0; antesGiro = 0; quadro = requestAnimationFrame(laco) }
    })
    obs.observe(secao)
    const aoScroll = () => lerScroll()
    const aoRedim = () => { medir(); lerScroll(); desenhar(atual, performance.now()) }
    medir(); lerScroll(); atual = alvo; desenhar(atual, performance.now())
    document.fonts?.ready.then(() => { medir(); desenhar(atual, performance.now()) })
    // o texto e os selos mudam de altura (fontes, idioma, quebra de linha): a tela do celular se mede de novo
    const tamanhos = new ResizeObserver(() => { medir(); desenhar(atual, performance.now()) })
    tamanhos.observe(texto); tamanhos.observe(selos)
    window.addEventListener('scroll', aoScroll, { passive: true })
    window.addEventListener('resize', aoRedim)
    return () => {
      obs.disconnect(); tamanhos.disconnect()
      window.removeEventListener('scroll', aoScroll); window.removeEventListener('resize', aoRedim)
      if (quadro) cancelAnimationFrame(quadro)
    }
  }, [])

  const irPara = (i: number) => {
    const el = secaoRef.current
    if (!el) return
    const topo = el.getBoundingClientRect().top + window.scrollY, total = el.offsetHeight - window.innerHeight
    window.scrollTo({ top: topo + total * ((i + 0.6) / CENAS.length), behavior: 'smooth' })
  }

  return (
    <section className="ag" ref={secaoRef} aria-labelledby="ag-titulo">
      <div className="ag-sticky" ref={stickyRef}>
        <canvas className="ag-rede" ref={telaRef} aria-hidden="true" />

        <div className="ag-sobre" aria-hidden="true">
          {COMPARA.map((c) => (
            <span key={c.r} className={`ag-compara ${c.bom ? 'bom' : ''}`}>
              <span><small>{c.x}</small><em>×</em><small>{c.y}</small></span><b>{c.r}</b>
            </span>
          ))}
          <div className="ag-hud">
            <span><i />{tx('Cruzando dados')}</span>
            <b data-relacoes>0</b><small>{tx('relações')}</small>
          </div>
          <div className="ag-selos">
            <span><Icone nome="trocar" tamanho={13} /> {tx('Refeito a cada lançamento')}</span>
            <span><Icone nome="escudo" tamanho={13} /> {tx('Dados criptografados')}</span>
            <span><Icone nome="relatorio" tamanho={13} /> {tx('Extrato lido no seu aparelho')}</span>
          </div>
        </div>

        <div className="ag-texto">
          <span className="ag-rotulo" id="ag-titulo"><i />{tx('O motor do OpusCash')}</span>
          <div className="ag-pilha" aria-live="polite">
            {CENAS.map((c, i) => (
              <div key={c.titulo} className={`ag-legenda ${cena === i ? 'ativa' : ''}`} aria-hidden={cena !== i}>
                <h2>{c.titulo}</h2>
                <p>{c.texto}</p>
              </div>
            ))}
          </div>
          <div className="ag-trilho" role="tablist" aria-label={tx('Partes do motor do OpusCash')}>
            {CENAS.map((c, i) => (
              <button key={c.titulo} role="tab" aria-selected={cena === i} aria-label={c.titulo} className={cena === i ? 'ativo' : ''} onClick={() => irPara(i)} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
