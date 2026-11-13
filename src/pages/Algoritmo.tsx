import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Icone } from '../components/Icone'
import { MESES_NOME } from '../lib/format'
import { semMovimento } from '../lib/tema'
import { tx } from '../lib/textos'
import { ANO } from './apresentacaoCena'
import './algoritmo.css'

/**
 * "O motor do OpusCash": uma esfera holográfica feita de fragmentos dourados (pedacinhos de circuito, blocos e traços
 * que piscam), presa na tela enquanto a pessoa rola. É uma transformação só, do começo ao fim:
 *   1. os dados entram: fragmentos soltos chegam de todo lado e se juntam até formar a esfera;
 *   2. o motor calcula: a esfera gira, se deforma em ondas e acelera;
 *   3. compara: ela se desmancha e os fragmentos se arrumam num gráfico 3D dos meses (entrou × saiu, com a média);
 *   4. responde: os fragmentos viram a própria tela do Consultor, com a nota e o plano de ação.
 *
 * Cada fragmento tem um lugar em cada forma; o desenho mistura as formas conforme o scroll, com um atraso por fragmento
 * (a mudança passa como uma onda) e um redemoinho no meio do caminho. Tudo num <canvas> somando luz.
 *
 * É uma imagem do que o motor faz, não um retrato técnico dele: o Consultor (lib/analise.ts) é feito de regras de
 * finanças, então os textos falam em cruzar e comparar, nunca em "inteligência artificial".
 */
const CENAS = [
  { titulo: tx('Seus dados entram'), texto: tx('Lançamentos, cartões, dívidas, metas, saldos e o extrato do banco: tudo vira informação para o motor.') },
  { titulo: tx('A rede cruza tudo'), texto: tx('Cada número é ligado aos outros: o gasto de hoje com o mês, o mês com o ano, a dívida com o que sobra.') },
  { titulo: tx('Compara cada detalhe'), texto: tx('Seu mês com a sua média, os juros com a reserva, o ritmo de cada meta com o prazo dela.') },
  { titulo: tx('E diz o que fazer'), texto: tx('Uma nota para o seu dinheiro e um plano de ação na ordem certa, refeito a cada lançamento.') },
] as const

/** Os dados que entram, cada um vindo de um lado até a esfera. */
const ENTRADAS = [
  { icone: 'lista', rotulo: tx('Mercado'), valor: '− R$ 334,00' },
  { icone: 'cartao', rotulo: tx('Fatura Nubank'), valor: 'R$ 960,00' },
  { icone: 'divida', rotulo: tx('Empréstimo'), valor: tx('4,2% ao mês') },
  { icone: 'meta', rotulo: tx('Viagem ao Japão'), valor: '32%' },
  { icone: 'carteira', rotulo: tx('Saldo guardado'), valor: 'R$ 25.290,00' },
  { icone: 'relatorio', rotulo: tx('extrato.pdf'), valor: tx('42 linhas') },
]

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

/** A tela do fim (cena 4): a mesma caixa onde os fragmentos se juntam (px de desenho). */
const TELA = { w: 620, h: 400 }
/**
 * O molde da tela para os fragmentos (px de desenho, a partir do centro; oy desloca tudo em y): a moldura, a linha
 * embaixo do cabeçalho, o círculo da nota e as linhas (pilares e plano). No computador é fixo; no celular sai das
 * medidas da tela de verdade, que lá se ajusta ao espaço que sobra.
 */
interface Molde { w: number; h: number; oy: number; nota: [number, number, number]; faixa: number; linhas: { y: number; x0: number; x1: number }[] }
const MOLDE_PC: Molde = {
  w: TELA.w, h: TELA.h, oy: 0, nota: [-TELA.w / 2 + 84, -50, 56], faixa: -TELA.h / 2 + 50,
  linhas: Array.from({ length: 6 }, (_, i) => ({ y: -TELA.h / 2 + 96 + i * 46, x0: -TELA.w / 2 + 230, x1: -TELA.w / 2 + 590 })),
}
const PILARES = [
  { nome: tx('Sobra'), v: 0.78, c: '#9df5c9' }, { nome: tx('Reserva'), v: 0.52, c: '#7cc8ff' },
  { nome: tx('Dívidas'), v: 0.44, c: '#ffc46b' }, { nome: tx('Cartão'), v: 0.81, c: '#d7a6ff' },
  { nome: tx('Gastos'), v: 0.67, c: '#ff9a8a' }, { nome: tx('Metas'), v: 0.71, c: '#9df5c9' },
]
const PLANO = [
  { t: tx('Adiante o Empréstimo pessoal'), d: tx('a dívida mais cara') },
  { t: tx('Vai sobrar R$ 1.937'), d: tx('previsão para o dia 31') },
  { t: tx('Cancele 3 assinaturas'), d: tx('R$ 418 a mais no ano') },
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
  solto: V3 // de onde vem (cena 1)
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
function montar(N: number, M: Molde) {
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
    // solto: longe, em volta (de onde os dados chegam)
    const ang = r() * Math.PI * 2, longe = 700 + r() * 600
    const solto: V3 = [Math.cos(ang) * longe, (r() - 0.5) * 900, Math.sin(ang) * longe * 0.6]
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
    // tela: a moldura, a faixa do topo, o círculo da nota à esquerda e as linhas do plano à direita
    let tela: V3
    const t = r(), W = M.w / 2, H = M.h / 2
    if (t < 0.34) {
      const p = r() * 2 * (M.w + M.h)
      tela = p < M.w ? [p - W, -H, 0] : p < M.w + M.h ? [W, p - M.w - H, 0] : p < 2 * M.w + M.h ? [W - (p - M.w - M.h), H, 0] : [-W, H - (p - 2 * M.w - M.h), 0]
    } else if (t < 0.46) {
      tela = [-W + 20 + r() * (M.w - 40), M.faixa + (r() - 0.5) * 2, 0]
    } else if (t < 0.66) {
      // o círculo da nota, no mesmo lugar e tamanho do círculo da tela de verdade, que aparece por cima
      const a = r() * Math.PI * 2, [nx, ny, nr] = M.nota
      tela = [nx + Math.cos(a) * nr, ny + Math.sin(a) * nr, 0]
    } else {
      const l = M.linhas[Math.floor(r() * M.linhas.length)]
      tela = [l.x0 + r() * (l.x1 - l.x0), l.y + (r() - 0.5) * 2, 0]
    }
    tela[1] += M.oy
    fr.push({
      // a maioria são traços e pontos; uns 12% são placas maiores (os blocos de dados do holograma)
      solto, esfera: [teta, fi, raio], barra, tela, atraso: r() * 0.35,
      ...(r() < 0.12 ? { w: 6 + r() * 9, h: 2 + r() * 2.5 } : { w: 1 + r() * 4.5, h: 1 + r() * 1.4 }),
      brilho: Math.min(4, Math.floor(Math.pow(r(), 1.15) * 5)), fase: r() * 10, cat,
    })
  }
  return fr
}

/** Câmera em cada cena: giro e inclinação (rad), aproximação. Na última fica de frente: a tela encaixa na tela. */
const CAM = [
  { yaw: -0.3, pitch: 0.18, zoom: 0.95 },
  { yaw: 0.35, pitch: 0.3, zoom: 1.05 },
  { yaw: 0.26, pitch: 0.12, zoom: 1.0 },
  { yaw: 0, pitch: 0, zoom: 1.08 },
]

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
    const entradas = [...sticky.querySelectorAll<HTMLElement>('.ag-entrada')]
    const comparas = [...sticky.querySelectorAll<HTMLElement>('.ag-compara')]
    const painel = sticky.querySelector<HTMLElement>('.ag-tela')!
    const contador = sticky.querySelector<HTMLElement>('[data-relacoes]')
    const sprHalo = brilho(256, [[0, 'rgba(255,200,110,0.55)'], [0.25, 'rgba(255,150,40,0.22)'], [0.6, 'rgba(255,120,20,0.06)'], [1, 'rgba(255,100,10,0)']])
    const sprPonto = brilho(48, [[0, 'rgba(255,248,225,1)'], [0.2, 'rgba(255,200,90,0.9)'], [0.55, 'rgba(255,150,40,0.22)'], [1, 'rgba(255,130,20,0)']])
    const sprBokeh = brilho(96, [[0, 'rgba(255,170,50,0.18)'], [0.7, 'rgba(255,165,45,0.22)'], [0.86, 'rgba(255,195,90,0.3)'], [1, 'rgba(255,140,30,0)']])

    let W = 0, H = 0, dpr = 1, cx = 0, cy = 0, esc = 1, celular = false, reduzir = false
    let fr: Frag[] = [], molde = MOLDE_PC, chaveMolde = ''
    // no celular a tela de verdade tem largura fixa (LARG_CEL) e é escalada (escTela) para caber entre o texto e os
    // selos, com o centro em yTela
    const LARG_CEL = 340
    let escTela = 1, yTela = 0
    const texto = sticky.querySelector<HTMLElement>('.ag-texto')!, selos = sticky.querySelector<HTMLElement>('.ag-selos')!
    const moldeDoCelular = (): Molde => {
      painel.style.width = `${LARG_CEL}px`; painel.style.height = 'auto'
      const w0 = painel.offsetWidth, h0 = painel.offsetHeight
      const topo = texto.getBoundingClientRect().bottom - sticky.getBoundingClientRect().top + 14
      const fundo = H - selos.offsetHeight - 30
      escTela = Math.min((W - 24) / w0, (fundo - topo) / h0, 1.2)
      yTela = (topo + fundo) / 2
      const k4 = esc * CAM[3].zoom, d = escTela / k4
      const meio = (el: HTMLElement) => [(el.offsetLeft + el.offsetWidth / 2 - w0 / 2) * d, (el.offsetTop + el.offsetHeight / 2 - h0 / 2) * d] as const
      const nota = painel.querySelector<HTMLElement>('.ag-nota')!, cab = painel.querySelector<HTMLElement>('header')!
      const [nx, ny] = meio(nota)
      return {
        w: w0 * d, h: h0 * d, oy: (yTela - cy) / k4, nota: [nx, ny, (nota.offsetWidth / 2) * 0.92 * d],
        faixa: (cab.offsetTop + cab.offsetHeight - h0 / 2) * d,
        linhas: [...painel.querySelectorAll<HTMLElement>('.ag-pilares li, .ag-plano li')].map((el) => ({
          y: (el.offsetTop + el.offsetHeight / 2 - h0 / 2) * d, x0: (el.offsetLeft - w0 / 2) * d, x1: (el.offsetLeft + el.offsetWidth - w0 / 2) * d,
        })),
      }
    }
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
      molde = celular ? moldeDoCelular() : MOLDE_PC
      if (!celular) { painel.style.width = ''; painel.style.height = '' }
      const chave = `${N}|${molde.w.toFixed(0)}|${molde.h.toFixed(0)}|${molde.oy.toFixed(0)}`
      if (chave !== chaveMolde) { chaveMolde = chave; fr = montar(N, molde) }
    }

    let yaw = 0, pitch = 0, zoom = 1
    const F = 1150
    const proj = (x: number, y: number, z: number) => {
      const cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch)
      const X = x * cyw + z * syw
      let Z = -x * syw + z * cyw
      const Y = y * cp - Z * sp
      Z = y * sp + Z * cp
      const s = F / Math.max(150, F + Z)
      return { x: cx + X * s * esc * zoom, y: cy + Y * s * esc * zoom, s }
    }

    const ultimo = new Map<string, string>()
    const por = (k: string, v: string, f: () => void) => { if (ultimo.get(k) !== v) { ultimo.set(k, v); f() } }
    let cenaAtual = -1, giro = 0, antesGiro = 0
    const xs = new Float32Array(2000), ys = new Float32Array(2000), ss = new Float32Array(2000)

    const desenhar = (p: number, tempo: number) => {
      const pres: number[] = [], and: number[] = []
      for (let i = 0; i < n; i++) {
        const a = i / n, b = (i + 1) / n
        pres.push((i === 0 ? 1 : suave(a - 0.04, a + 0.04, p)) * (i === n - 1 ? 1 : 1 - suave(b - 0.04, b + 0.04, p)))
        and.push(limitar(((p - a) / (b - a)) * 1.15))
      }
      const fpos = limitar(p * n - 0.5, 0, n - 1), i0 = Math.floor(fpos), i1 = Math.min(n - 1, i0 + 1), f = suave(0, 1, fpos - i0)
      const t = reduzir ? 0 : tempo, s = t / 1000
      // a câmera balança menos na última cena: a tela precisa ficar de frente
      const bal = 1 - pres[3] * 0.92
      yaw = mistura(CAM[i0].yaw, CAM[i1].yaw, f) + Math.sin(t * 0.00023) * 0.1 * bal
      pitch = mistura(CAM[i0].pitch, CAM[i1].pitch, f) + Math.cos(t * 0.00017) * 0.05 * bal
      zoom = mistura(CAM[i0].zoom, CAM[i1].zoom, f)
      // a esfera gira; calculando (cena 2), gira mais rápido
      const dt = antesGiro ? Math.min(0.05, (tempo - antesGiro) / 1000) : 0
      antesGiro = tempo
      if (!reduzir) giro += dt * (0.25 + 0.9 * pres[1] + 0.2 * pres[0])
      const calc = pres[1] // o quanto a esfera está "calculando" (ondas na casca)

      // as quatro formas ao longo do scroll: solto → esfera → gráfico → tela. Cada fragmento muda com um atraso
      const e0 = and[0] * 1.05, g0 = limitar((p - 0.47) / 0.18), v0 = limitar((p - 0.72) / 0.16)
      const forma = (fx: Frag): V3 => {
        const [teta, fi, raio] = fx.esfera
        const onda = 1 + calc * 0.13 * Math.sin(3 * fi + s * 2.3) * Math.cos(2 * teta - s * 1.7)
        const tt = teta + giro
        const sf = Math.sin(fi) * raio * onda
        const ex = sf * Math.cos(tt), ey = Math.cos(fi) * raio * onda, ez = sf * Math.sin(tt)
        const e = suave(fx.atraso * 0.8, fx.atraso * 0.8 + 0.55, e0)
        const g = suave(fx.atraso, fx.atraso + 0.55, g0)
        const v = suave(fx.atraso, fx.atraso + 0.55, v0)
        let x = mistura(fx.solto[0], ex, e), y = mistura(fx.solto[1], ey, e), z = mistura(fx.solto[2], ez, e)
        x = mistura(x, fx.barra[0], g); y = mistura(y, fx.barra[1], g); z = mistura(z, fx.barra[2], g)
        x = mistura(x, fx.tela[0], v); y = mistura(y, fx.tela[1], v); z = mistura(z, fx.tela[2], v)
        // redemoinho no meio de cada viagem: o fragmento faz uma curva em vez de ir reto
        const meio = Math.sin(Math.PI * g) + Math.sin(Math.PI * v) + Math.sin(Math.PI * e) * 0.6
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
      const esferaCheia = suave(0.3, 0.9, and[0]) * (1 - suave(0.47, 0.6, p))
      const th = (720 + 160 * calc) * esc * zoom
      ctx.globalAlpha = 0.25 + 0.55 * esferaCheia + 0.3 * pres[3]
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

      // os fragmentos: projeta todos, depois pinta por tom (menos trocas de cor)
      const N = fr.length
      for (let i = 0; i < N; i++) {
        const [x, y, z] = forma(fr[i])
        const P = proj(x, y, z)
        xs[i] = P.x; ys[i] = P.y; ss[i] = P.s
      }
      const pisca = Math.floor(s * 7)
      // a cor do gráfico: depois que as colunas se formam, a cor varre o gráfico da esquerda para a direita (o mês de
      // janeiro troca primeiro) e volta ao dourado quando ele vira a tela
      const fimTela = suave(0.72, 0.8, p)
      const grupos = new Map<string, number[]>()
      for (let i = 0; i < N; i++) {
        const fx = fr[i]
        // alguns piscam (como no holograma): sobem de tom de tempos em tempos
        const tom = reduzir ? fx.brilho : Math.min(4, fx.brilho + ((i * 7 + pisca) % 11 === 0 ? 2 : 0))
        let chave = `d${tom}`
        if (fx.cat < 3) {
          const ini = 0.585 + (fx.barra[0] / LARGO_GRAF + 0.5) * 0.06 + fx.atraso * 0.03
          const c = suave(ini, ini + 0.035, p) * (1 - fimTela)
          const passo = Math.round(c * (PASSOS - 1))
          if (passo > 0) chave = `${fx.cat}.${tom}.${passo}`
        }
        let g = grupos.get(chave)
        if (!g) { g = []; grupos.set(chave, g) }
        g.push(i)
      }
      grupos.forEach((idx, chave) => {
        if (chave[0] === 'd') ctx.fillStyle = TONS[Number(chave.slice(1))]
        else { const [c, tom, passo] = chave.split('.').map(Number); ctx.fillStyle = PALETA[c][tom][passo] }
        for (const i of idx) {
          const fx = fr[i], k = ss[i] * esc * zoom
          ctx.fillRect(xs[i] - (fx.w * k) / 2, ys[i] - (fx.h * k) / 2, fx.w * k + 0.6, fx.h * k + 0.6)
        }
      })
      // pontos mais quentes com brilho (um a cada 14 fragmentos)
      ctx.globalAlpha = 0.6
      for (let i = 0; i < N; i += 14) {
        const tam = (10 + 8 * Math.sin(s * 2 + fr[i].fase)) * ss[i] * esc
        ctx.drawImage(sprPonto, xs[i] - tam / 2, ys[i] - tam / 2, tam, tam)
      }
      ctx.globalAlpha = 1

      // o centro da esfera: um anel de luz aceso
      if (esferaCheia > 0.02) {
        const tn = (110 + 20 * Math.sin(s * 3)) * esc * zoom
        ctx.globalAlpha = esferaCheia
        ctx.drawImage(sprPonto, centro.x - tn / 2, centro.y - tn / 2, tn, tn)
        ctx.strokeStyle = `rgba(255,220,150,${0.8 * esferaCheia})`; ctx.lineWidth = 2
        ctx.beginPath(); ctx.ellipse(centro.x, centro.y, 34 * esc * zoom, 30 * esc * zoom, 0, 0, Math.PI * 2); ctx.stroke()
        ctx.globalAlpha = 1
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
      // cena 1: os dados vêm de longe até a esfera e entram nela
      const chegou = ENTRADAS.map((_, i) => limitar(and[0] * 2.1 - i * 0.22 + 0.05))
      entradas.forEach((el, i) => {
        const fi = chegou[i], ang = (-50 + i * 20) * (Math.PI / 180)
        const d = mistura(celular ? 330 : 700, 40, fi)
        const P = proj(Math.cos(ang) * d, Math.sin(ang) * d, -80)
        const o = pres[0] * suave(0, 0.2, fi) * (1 - suave(0.75, 1, fi))
        por(`e${i}`, `${P.x.toFixed(1)},${P.y.toFixed(1)},${o.toFixed(3)}`, () => {
          el.style.transform = `translate3d(${P.x.toFixed(1)}px, ${P.y.toFixed(1)}px, 0) translate(${celular ? '-80%' : '-50%'}, -50%) scale(${(Math.min(1.1, P.s) * (1 - suave(0.6, 1, fi) * 0.7)).toFixed(3)})`
          el.style.opacity = o.toFixed(3)
          el.style.visibility = o < 0.01 ? 'hidden' : 'visible'
        })
      })
      // cena 3: etiquetas em cima das colunas dos meses
      const fc = COMPARA.map((_, i) => pres[2] * limitar(and[2] * 2.4 - 0.7 - i * 0.28))
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
      // cena 4: a tela de verdade aparece por cima da moldura de fragmentos, do mesmo tamanho
      const ft = suave(0.86, 0.95, p)
      // a tela tem o tamanho da moldura na tela (largura e altura de verdade, sem escalar as letras)
      const k = centro.s * esc * zoom
      por('tela', `${centro.x.toFixed(1)},${centro.y.toFixed(1)},${k.toFixed(4)},${ft.toFixed(3)},${escTela},${yTela}`, () => {
        if (celular) {
          // celular: largura fixa, altura do conteúdo, escalada para caber (não corta)
          painel.style.transform = `translate3d(${(W / 2).toFixed(1)}px, ${yTela.toFixed(1)}px, 0) translate(-50%, -50%) scale(${escTela.toFixed(4)})`
        } else {
          painel.style.width = `${(TELA.w * k).toFixed(1)}px`; painel.style.height = `${(TELA.h * k).toFixed(1)}px`
          painel.style.transform = `translate3d(${centro.x.toFixed(1)}px, ${centro.y.toFixed(1)}px, 0) translate(-50%, -50%)`
        }
        painel.style.opacity = ft.toFixed(3)
        painel.style.visibility = ft < 0.01 ? 'hidden' : 'visible'
        painel.style.setProperty('--f', ft.toFixed(3))
      })
      pres.forEach((v, i) => por(`p${i}`, v.toFixed(3), () => sticky.style.setProperty(`--p${i}`, v.toFixed(3))))
      const rel = Math.round(2418 * limitar(and[1] * 1.3))
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
          {ENTRADAS.map((e) => (
            <span key={e.rotulo} className="ag-entrada">
              <i><Icone nome={e.icone} tamanho={14} /></i><span><small>{e.rotulo}</small><b>{e.valor}</b></span>
            </span>
          ))}
          {COMPARA.map((c) => (
            <span key={c.r} className={`ag-compara ${c.bom ? 'bom' : ''}`}>
              <span><small>{c.x}</small><em>×</em><small>{c.y}</small></span><b>{c.r}</b>
            </span>
          ))}
          {/* a tela em que os fragmentos se transformam (cena 4) */}
          <div className="ag-tela">
            <header><i><Icone nome="bussola" tamanho={16} /></i><b>{tx('Consultor')}</b><span className="ag-pronta"><i />{tx('Análise pronta')}</span></header>
            <div className="ag-tela-meio">
              <div className="ag-nota">
                <svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="42" className="fundo" /><circle cx="50" cy="50" r="42" pathLength={1} className="cheio" /></svg>
                <b>72</b><small>{tx('Boa')}</small>
              </div>
              <div className="ag-tela-dir">
                <ul className="ag-pilares">
                  {PILARES.map((p, i) => <li key={p.nome} style={{ '--c': p.c, '--v': p.v, '--i': i } as CSSProperties}><span>{p.nome}</span><i><b /></i></li>)}
                </ul>
                <strong>{tx('Plano de ação')}</strong>
                <ol className="ag-plano">
                  {PLANO.map((p, i) => <li key={p.t} style={{ '--i': i } as CSSProperties}><span>{i + 1}</span><div><b>{p.t}</b><small>{p.d}</small></div></li>)}
                </ol>
              </div>
            </div>
          </div>
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
