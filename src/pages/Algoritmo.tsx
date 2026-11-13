import { useEffect, useRef, useState } from 'react'
import { Icone } from '../components/Icone'
import { MESES_NOME } from '../lib/format'
import { semMovimento } from '../lib/tema'
import { tx } from '../lib/textos'
import './algoritmo.css'

/**
 * "O motor do OpusCash": um núcleo holográfico dourado, presa na tela enquanto a pessoa rola. Anéis girando em planos
 * diferentes, raios de luz convergindo para o centro, trilhas de circuito, faíscas e partículas desfocadas em
 * profundidade. Quatro passos: os dados entram pelos raios, o núcleo cruza tudo, compara cada detalhe e diz o que fazer.
 *
 * Tudo é desenhado num <canvas> com projeção 3D feita à mão (centenas de linhas e partículas em HTML pesariam demais),
 * somando luz sobre um fundo escuro. Os cartões por cima são HTML postos a cada quadro no ponto certo da tela.
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

/** Os dados que entram, cada um descendo por um raio até o núcleo. */
const ENTRADAS = [
  { icone: 'lista', rotulo: tx('Mercado'), valor: '− R$ 334,00' },
  { icone: 'cartao', rotulo: tx('Fatura Nubank'), valor: 'R$ 960,00' },
  { icone: 'divida', rotulo: tx('Empréstimo'), valor: tx('4,2% ao mês') },
  { icone: 'meta', rotulo: tx('Viagem ao Japão'), valor: '32%' },
  { icone: 'carteira', rotulo: tx('Saldo guardado'), valor: 'R$ 25.290,00' },
  { icone: 'relatorio', rotulo: tx('extrato.pdf'), valor: tx('42 linhas') },
]
/** As comparações: dois pontos do anel do meio (ângulo em graus) e o que sai de comparar um com o outro. */
const COMPARA: { a: number; b: number; x: string; y: string; r: string; bom?: boolean }[] = [
  { a: 200, b: 300, x: MESES_NOME[9], y: tx('sua média'), r: tx('8% menos'), bom: true },
  { a: 330, b: 60, x: tx('Juros 4,2%'), y: tx('reserva 0,8%'), r: tx('adiante a dívida') },
  { a: 40, b: 150, x: tx('Ritmo da meta'), y: tx('prazo'), r: tx('2 meses atrás') },
  { a: 110, b: 230, x: tx('Assinaturas'), y: tx('uso'), r: tx('3 paradas') },
]
/** O que sai do núcleo: as respostas. */
const SAIDAS = [
  { icone: 'estrela', t: tx('Nota 72 · Boa'), d: tx('6 pilares analisados') },
  { icone: 'divida', t: tx('Adiante o Empréstimo pessoal'), d: tx('a dívida mais cara') },
  { icone: 'ano', t: tx('Vai sobrar R$ 1.937'), d: tx('previsão para o dia 31') },
  { icone: 'calendario', t: tx('Cancele 3 assinaturas'), d: tx('R$ 418 a mais no ano') },
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
const RAD = Math.PI / 180

/** Gira o vetor em volta de x e depois de y (os anéis inclinados). */
function girar([x, y, z]: V3, ax: number, ay: number): V3 {
  const cx = Math.cos(ax), sx = Math.sin(ax), cy = Math.cos(ay), sy = Math.sin(ay)
  const y1 = y * cx - z * sx, z1 = y * sx + z * cx
  return [x * cy + z1 * sy, y1, -x * sy + z1 * cy]
}

/** Os anéis: raio, inclinação (graus), velocidade (voltas por minuto) e o desenho do traço. */
const ANEIS = [
  { r: 120, ix: 72, iy: 8, vel: 14, tipo: 'cheio' as const, peso: 1.6 },
  { r: 170, ix: 18, iy: -30, vel: -9, tipo: 'mostrador' as const, peso: 1 },
  { r: 240, ix: 64, iy: -18, vel: 6, tipo: 'tracos' as const, peso: 1.2 },
  { r: 300, ix: -14, iy: 40, vel: -4, tipo: 'arcos' as const, peso: 1 },
  { r: 380, ix: 10, iy: 6, vel: 3, tipo: 'mostrador' as const, peso: 1.1 },
  { r: 470, ix: 30, iy: -50, vel: -2, tipo: 'arcos' as const, peso: 0.8 },
]
/** O anel das comparações (o quarto, quase de frente: as etiquetas não se encavalam). */
const ANEL_COMPARA = 3

function montarCena() {
  const r = sorteio(23)
  // raios: de longe até perto do núcleo. Os 6 primeiros levam os dados da cena 1: chegam pela direita, um em cima do
  // outro (a esquerda é do texto); os outros se espalham em volta
  const raios: { de: V3; ate: V3 }[] = []
  for (let i = 0; i < 6; i++) {
    const ang = (-50 + i * 20) * RAD, dist = 820
    const d: V3 = [Math.cos(ang), Math.sin(ang), -0.25]
    raios.push({ de: [d[0] * dist, d[1] * dist, d[2] * dist], ate: [d[0] * 60, d[1] * 60, d[2] * 60] })
  }
  for (let i = 6; i < 26; i++) {
    const ang = (i / 26) * Math.PI * 2 + r() * 0.2, el = (r() - 0.5) * 1.1, dist = 760 + r() * 520
    const d: V3 = [Math.cos(ang) * Math.cos(el), Math.sin(el) * 0.9, Math.sin(ang) * Math.cos(el)]
    const perto = 46 + r() * 30
    raios.push({ de: [d[0] * dist, d[1] * dist, d[2] * dist], ate: [d[0] * perto, d[1] * perto, d[2] * perto] })
  }
  // trilhas de circuito: degraus em ângulo reto e a 45 graus, no plano de um anel de fora
  const trilhas: V3[][] = []
  for (let i = 0; i < 18; i++) {
    let ang = r() * Math.PI * 2, raio = 330 + r() * 160
    const pts: V3[] = []
    const plano = i % 2 ? ANEIS[3] : ANEIS[5]
    for (let k = 0; k < 6; k++) {
      pts.push(girar([Math.cos(ang) * raio, Math.sin(ang) * raio, 0], plano.ix * RAD, plano.iy * RAD))
      if (k % 2) raio += (r() - 0.3) * 60
      else ang += (r() - 0.5) * 0.35
    }
    trilhas.push(pts)
  }
  // partículas: muitas, em volta e na frente; as perto da câmera ficam grandes e desfocadas
  const pontos: { p: V3; tam: number; fase: number; vel: number }[] = []
  for (let i = 0; i < 170; i++) {
    const ang = r() * Math.PI * 2, raio = 60 + Math.pow(r(), 0.7) * 820
    pontos.push({ p: [Math.cos(ang) * raio, (r() - 0.5) * 760, Math.sin(ang) * raio * 0.9 + (r() < 0.12 ? -500 : 0)], tam: 0.5 + r() * 1.6, fase: r() * 6.3, vel: 0.3 + r() * 0.9 })
  }
  // faíscas: pedacinhos retos (como os da imagem de circuito) que piscam em volta dos anéis
  const faiscas: { p: V3; q: V3; fase: number }[] = []
  for (let i = 0; i < 44; i++) {
    const anel = ANEIS[1 + (i % 5)], ang = r() * Math.PI * 2, rr = anel.r + (r() - 0.5) * 40, len = 10 + r() * 34
    const a = girar([Math.cos(ang) * rr, Math.sin(ang) * rr, 0], anel.ix * RAD, anel.iy * RAD)
    const b = girar([Math.cos(ang + len / rr) * rr, Math.sin(ang + len / rr) * rr, (r() - 0.5) * 20], anel.ix * RAD, anel.iy * RAD)
    faiscas.push({ p: a, q: b, fase: r() * 10 })
  }
  return { raios, trilhas, pontos, faiscas }
}

/** Câmera em cada cena: giro e inclinação (rad), aproximação e quanto os anéis aceleram. */
const CAM = [
  { yaw: -0.25, pitch: 0.12, zoom: 0.92, giro: 1 },
  { yaw: 0.3, pitch: 0.28, zoom: 1.06, giro: 3.2 },
  { yaw: 0.1, pitch: -0.06, zoom: 1.0, giro: 1.4 },
  { yaw: -0.08, pitch: 0.1, zoom: 1.32, giro: 2 },
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

export function Algoritmo() {
  const secaoRef = useRef<HTMLElement>(null)
  const stickyRef = useRef<HTMLDivElement>(null)
  const telaRef = useRef<HTMLCanvasElement>(null)
  const [cena, setCena] = useState(0)

  useEffect(() => {
    const secao = secaoRef.current, sticky = stickyRef.current, tela = telaRef.current
    if (!secao || !sticky || !tela) return
    const ctx = tela.getContext('2d')
    if (!ctx) return
    const { raios, trilhas, pontos, faiscas } = montarCena()
    const n = CENAS.length
    const entradas = [...sticky.querySelectorAll<HTMLElement>('.ag-entrada')]
    const comparas = [...sticky.querySelectorAll<HTMLElement>('.ag-compara')]
    const saidas = [...sticky.querySelectorAll<HTMLElement>('.ag-saida')]
    const contador = sticky.querySelector<HTMLElement>('[data-relacoes]')

    // os carimbos de luz: ponto quente, bokeh (disco desfocado de borda clara) e o clarão do núcleo
    const sprPonto = brilho(48, [[0, 'rgba(255,248,225,1)'], [0.2, 'rgba(255,200,90,0.9)'], [0.55, 'rgba(255,150,40,0.22)'], [1, 'rgba(255,130,20,0)']])
    const sprBokeh = brilho(96, [[0, 'rgba(255,170,50,0.2)'], [0.7, 'rgba(255,165,45,0.24)'], [0.86, 'rgba(255,195,90,0.32)'], [1, 'rgba(255,140,30,0)']])
    const sprClarao = brilho(256, [[0, 'rgba(255,236,190,0.95)'], [0.12, 'rgba(255,190,80,0.6)'], [0.4, 'rgba(255,140,30,0.16)'], [1, 'rgba(255,110,10,0)']])

    let W = 0, H = 0, dpr = 1, cx = 0, cy = 0, esc = 1, celular = false, reduzir = false
    const medir = () => {
      reduzir = semMovimento()
      W = sticky.clientWidth; H = sticky.clientHeight; celular = W <= 900
      dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      tela.width = Math.round(W * dpr); tela.height = Math.round(H * dpr)
      tela.style.width = `${W}px`; tela.style.height = `${H}px`
      if (celular) {
        const topo = Math.min(270, H * 0.33), ah = H - topo
        cx = W / 2; cy = topo + ah * 0.4; esc = Math.min(W / 760, ah / 900)
      } else {
        const esq = Math.min(460, W * 0.36), aw = W - esq - 250
        cx = esq + aw / 2 + 20; cy = H * 0.5; esc = Math.min(aw / 900, H / 1000)
      }
    }

    // projeção: gira em volta de y (giro), depois de x (inclinação), e põe em perspectiva
    let yaw = 0, pitch = 0, zoom = 1
    const F = 1100
    const proj = ([x, y, z]: V3) => {
      const cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch)
      const X = x * cyw + z * syw
      let Z = -x * syw + z * cyw
      const Y = y * cp - Z * sp
      Z = y * sp + Z * cp
      const s = F / Math.max(120, F + Z)
      return { x: cx + X * s * esc * zoom, y: cy + Y * s * esc * zoom, s }
    }
    /** Ponto num anel, no ângulo dado (graus), já girando com o tempo. */
    const noAnel = (k: number, graus: number, giroAnel: number) => {
      const a = ANEIS[k]
      const ang = graus * RAD + giroAnel
      return girar([Math.cos(ang) * a.r, Math.sin(ang) * a.r, 0], a.ix * RAD, a.iy * RAD)
    }
    /** Traço com brilho: uma passada larga e fraca e uma fina e forte (sem desfoque, que pesa). */
    const tracar = (alfa: number, larg: number, desenhar: () => void) => {
      ctx.strokeStyle = `rgba(255,150,40,${(alfa * 0.22).toFixed(3)})`; ctx.lineWidth = larg * 4.5
      ctx.beginPath(); desenhar(); ctx.stroke()
      ctx.strokeStyle = `rgba(255,205,110,${alfa.toFixed(3)})`; ctx.lineWidth = larg
      ctx.beginPath(); desenhar(); ctx.stroke()
    }

    const ultimo = new Map<string, string>()
    const por = (k: string, v: string, f: () => void) => { if (ultimo.get(k) !== v) { ultimo.set(k, v); f() } }
    let cenaAtual = -1, giroAcum = 0, antesGiro = 0

    const desenhar = (p: number, tempo: number) => {
      const pres: number[] = [], and: number[] = []
      for (let i = 0; i < n; i++) {
        const a = i / n, b = (i + 1) / n
        pres.push((i === 0 ? 1 : suave(a - 0.04, a + 0.04, p)) * (i === n - 1 ? 1 : 1 - suave(b - 0.04, b + 0.04, p)))
        and.push(limitar(((p - a) / (b - a)) * 1.15))
      }
      const fpos = limitar(p * n - 0.5, 0, n - 1), i0 = Math.floor(fpos), i1 = Math.min(n - 1, i0 + 1), f = suave(0, 1, fpos - i0)
      const t = reduzir ? 0 : tempo
      yaw = mistura(CAM[i0].yaw, CAM[i1].yaw, f) + Math.sin(t * 0.00023) * 0.12
      pitch = mistura(CAM[i0].pitch, CAM[i1].pitch, f) + Math.cos(t * 0.00017) * 0.06
      zoom = mistura(CAM[i0].zoom, CAM[i1].zoom, f)
      // os anéis giram; na cena 2 aceleram (o giro acumula, para a mudança de ritmo não dar pulo)
      const dt = antesGiro ? Math.min(0.05, (tempo - antesGiro) / 1000) : 0
      antesGiro = tempo
      if (!reduzir) giroAcum += dt * mistura(CAM[i0].giro, CAM[i1].giro, f)
      const giroDe = (k: number) => giroAcum * ANEIS[k].vel * (Math.PI * 2 / 60)
      const forca = 0.92 + 0.45 * pres[1] + 0.35 * pres[3] // quanto o núcleo está "trabalhando"
      const s = t / 1000

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, H)
      ctx.globalCompositeOperation = 'lighter'
      ctx.lineCap = 'round'
      const centro = proj([0, 0, 0])

      // 1. clarão de fundo do núcleo
      const tc = (520 + 160 * pres[3]) * esc * zoom * (1 + Math.sin(s * 1.7) * 0.03)
      ctx.globalAlpha = 0.55 + 0.25 * pres[3]
      ctx.drawImage(sprClarao, centro.x - tc / 2, centro.y - tc / 2, tc, tc)
      ctx.globalAlpha = 1

      // 2. partículas do fundo (as da frente ficam para o fim)
      const desenharPontos = (frente: boolean) => {
        for (const pt of pontos) {
          const P = proj([pt.p[0] + Math.sin(s * 0.2 * pt.vel + pt.fase) * 18, pt.p[1] + Math.cos(s * 0.17 * pt.vel + pt.fase) * 14, pt.p[2]])
          if ((P.s > 1.25) !== frente) continue
          const pisca = 0.55 + 0.45 * Math.sin(s * pt.vel * 2 + pt.fase)
          if (P.s > 1.25) {
            // perto da câmera: bokeh grande, quase transparente
            const tam = pt.tam * 46 * P.s * esc
            ctx.globalAlpha = 0.32 * pisca
            ctx.drawImage(sprBokeh, P.x - tam / 2, P.y - tam / 2, tam, tam)
          } else {
            const tam = (pt.tam * 9 + 3) * P.s * esc * (0.7 + 0.3 * pisca)
            ctx.globalAlpha = 0.35 + 0.55 * pisca * P.s
            ctx.drawImage(sprPonto, P.x - tam / 2, P.y - tam / 2, tam, tam)
          }
        }
        ctx.globalAlpha = 1
      }
      desenharPontos(false)

      // 3. raios convergindo para o núcleo, com luz descendo por eles
      raios.forEach((r, i) => {
        const A = proj(r.de), B = proj(r.ate)
        const alfa = (i < 6 ? 0.34 : 0.2) * forca
        tracar(alfa, 0.8, () => { ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y) })
        const q = ((s * 0.28 + i * 0.137) % 1)
        const x = mistura(A.x, B.x, q), y = mistura(A.y, B.y, q), tam = 18 * mistura(A.s, B.s, q) * esc
        ctx.globalAlpha = 0.9 * forca * Math.sin(q * Math.PI)
        ctx.drawImage(sprPonto, x - tam / 2, y - tam / 2, tam, tam)
        ctx.globalAlpha = 1
      })

      // 4. trilhas de circuito com um pulso correndo
      trilhas.forEach((tr, i) => {
        const P = tr.map(proj)
        tracar(0.28 * forca, 0.9, () => { ctx.moveTo(P[0].x, P[0].y); for (let k = 1; k < P.length; k++) ctx.lineTo(P[k].x, P[k].y) })
        const q = ((s * 0.35 + i * 0.21) % 1) * (P.length - 1), k = Math.floor(q), u = q - k
        const x = mistura(P[k].x, P[k + 1].x, u), y = mistura(P[k].y, P[k + 1].y, u), tam = 14 * P[k].s * esc
        ctx.globalAlpha = 0.85 * forca
        ctx.drawImage(sprPonto, x - tam / 2, y - tam / 2, tam, tam)
        ctx.globalAlpha = 1
      })

      // 5. anéis: cheio, mostrador (dois fios com riscos), traços e arcos
      ANEIS.forEach((a, k) => {
        const g = giroDe(k), N = a.r > 300 ? 150 : 110
        const pts: { x: number; y: number; s: number }[] = []
        for (let j = 0; j <= N; j++) pts.push(proj(girar([Math.cos(j / N * 6.2832 + g) * a.r, Math.sin(j / N * 6.2832 + g) * a.r, 0], a.ix * RAD, a.iy * RAD)))
        const alfa = (k === 0 ? 0.85 : 0.5) * forca * a.peso
        if (a.tipo === 'cheio') {
          tracar(alfa, 2.2, () => { ctx.moveTo(pts[0].x, pts[0].y); for (const P of pts) ctx.lineTo(P.x, P.y) })
        } else if (a.tipo === 'arcos') {
          tracar(alfa * 0.8, 1.2, () => { for (let j = 0; j < N; j++) { if ((j % 25) < 17) { ctx.moveTo(pts[j].x, pts[j].y); ctx.lineTo(pts[j + 1].x, pts[j + 1].y) } } })
        } else if (a.tipo === 'tracos') {
          tracar(alfa, 1.4, () => { for (let j = 0; j < N; j += 2) { ctx.moveTo(pts[j].x, pts[j].y); ctx.lineTo(pts[j + 1].x, pts[j + 1].y) } })
        } else {
          // mostrador: o fio de dentro e riscos que saem dele, mais longos a cada 10
          const fora = (j: number, extra: number) => proj(girar([Math.cos(j / N * 6.2832 + g) * (a.r + extra), Math.sin(j / N * 6.2832 + g) * (a.r + extra), 0], a.ix * RAD, a.iy * RAD))
          tracar(alfa * 0.9, 1, () => { ctx.moveTo(pts[0].x, pts[0].y); for (const P of pts) ctx.lineTo(P.x, P.y) })
          tracar(alfa * 0.7, 0.9, () => { for (let j = 0; j < N; j += 2) { const Q = fora(j, j % 10 ? 9 : 20); ctx.moveTo(pts[j].x, pts[j].y); ctx.lineTo(Q.x, Q.y) } })
        }
      })

      // 6. faíscas: pedaços que acendem e apagam
      for (const fa of faiscas) {
        const liga = Math.sin(s * 2.2 + fa.fase) > 0.35
        if (!liga && !reduzir) continue
        const A = proj(fa.p), B = proj(fa.q)
        tracar(0.75 * forca, 1.3, () => { ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y) })
      }

      // 7. o núcleo: um túnel de frente para quem olha, com os anéis correndo para dentro, e o centro aceso
      const R0 = (150 + 40 * pres[3]) * esc * zoom, fase = reduzir ? 0 : (s * 0.55) % 1
      for (let j = 0; j < 11; j++) {
        const u = 1 - (j + fase) / 11, r = R0 * Math.pow(u, 1.7)
        if (r < 4) continue
        const alfa = Math.sin(u * Math.PI) * (j % 3 === 0 ? 1 : 0.6) * forca
        tracar(alfa * 0.9, j % 3 === 0 ? 2 : 1.1, () => { ctx.ellipse(centro.x, centro.y, r, r * 0.94, 0, 0, Math.PI * 2) })
      }
      const tn = (90 + 60 * pres[3] + Math.sin(s * 3) * 6) * esc * zoom
      ctx.drawImage(sprPonto, centro.x - tn / 2, centro.y - tn / 2, tn, tn)

      // 8. comparações: cordas acesas cruzando o anel do meio
      const fc = COMPARA.map((_, i) => pres[2] * limitar(and[2] * 2.2 - i * 0.32 - 0.1))
      const pares = COMPARA.map((c) => [proj(noAnel(ANEL_COMPARA, c.a, giroDe(ANEL_COMPARA))), proj(noAnel(ANEL_COMPARA, c.b, giroDe(ANEL_COMPARA)))])
      pares.forEach(([A, B], i) => {
        if (fc[i] < 0.01) return
        ctx.setLineDash([7, 7]); ctx.lineDashOffset = -t * 0.04
        tracar(fc[i], 1.8, () => { ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y) })
        ctx.setLineDash([])
        for (const P of [A, B]) { const tam = 40 * esc * fc[i]; ctx.drawImage(sprPonto, P.x - tam / 2, P.y - tam / 2, tam, tam) }
      })

      // 9. respostas: feixes do núcleo até cada cartão
      const fs = SAIDAS.map((_, i) => pres[3] * limitar(and[3] * 2.4 - i * 0.25))
      const lugarSaida = (i: number) => celular
        ? { x: cx + (i % 2 ? 5 : -5), y: cy + 150 * esc + Math.floor(i / 2) * 60 }
        : { x: Math.min(W - 260, centro.x + 330 * esc * zoom), y: cy + (i - 1.5) * 76 }
      if (!celular) SAIDAS.forEach((_, i) => {
        if (fs[i] < 0.01) return
        const L = lugarSaida(i)
        tracar(0.6 * fs[i], 1.2, () => { ctx.moveTo(centro.x, centro.y); ctx.lineTo(mistura(centro.x, L.x, fs[i]), mistura(centro.y, L.y, fs[i])) })
      })

      // 10. partículas da frente (bokeh grande), por cima de tudo
      desenharPontos(true)
      ctx.globalCompositeOperation = 'source-over'

      // ─── cartões por cima ───
      // cena 1: cada dado desce por um raio até o núcleo e é engolido
      const chegou = ENTRADAS.map((_, i) => limitar(and[0] * 2.1 - i * 0.22 + 0.05))
      entradas.forEach((el, i) => {
        const fi = chegou[i], r = raios[i]
        // no celular o caminho começa mais perto: de longe, o cartão sairia pela borda da tela
        const k = celular ? 0.4 : 0.8
        const pr: V3 = [mistura(r.de[0] * k, r.ate[0], fi), mistura(r.de[1] * k, r.ate[1], fi), mistura(r.de[2] * k, r.ate[2], fi)]
        const P = proj(pr)
        const o = pres[0] * suave(0, 0.2, fi) * (1 - suave(0.75, 1, fi))
        por(`e${i}`, `${P.x.toFixed(1)},${P.y.toFixed(1)},${o.toFixed(3)}`, () => {
          el.style.transform = `translate3d(${P.x.toFixed(1)}px, ${P.y.toFixed(1)}px, 0) translate(${celular ? '-80%' : '-50%'}, -50%) scale(${(Math.min(1.15, P.s) * (1 - suave(0.6, 1, fi) * 0.7)).toFixed(3)})`
          el.style.opacity = o.toFixed(3)
          el.style.visibility = o < 0.01 ? 'hidden' : 'visible'
        })
      })
      // cena 3: a etiqueta de cada comparação em cima do meio da corda
      pares.forEach(([A, B], i) => {
        const el = comparas[i], x = (A.x + B.x) / 2, y = (A.y + B.y) / 2
        por(`c${i}`, `${x.toFixed(1)},${y.toFixed(1)},${fc[i].toFixed(3)}`, () => {
          el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -120%) scale(${(0.85 + 0.15 * fc[i]).toFixed(3)})`
          el.style.opacity = fc[i].toFixed(3)
          el.style.visibility = fc[i] < 0.01 ? 'hidden' : 'visible'
        })
      })
      // cena 4: as respostas saem do núcleo
      saidas.forEach((el, i) => {
        const L = lugarSaida(i), v = fs[i]
        const x = celular ? L.x : mistura(centro.x, L.x, suave(0, 1, v)), y = celular ? L.y : mistura(centro.y, L.y, suave(0, 1, v))
        por(`s${i}`, `${x.toFixed(1)},${y.toFixed(1)},${v.toFixed(3)}`, () => {
          el.style.transform = celular
            ? `translate3d(${x.toFixed(1)}px, ${(y + (1 - v) * 20).toFixed(1)}px, 0) translate(${i % 2 ? '0' : '-100%'}, 0)`
            : `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(0, -50%) scale(${(0.6 + 0.4 * v).toFixed(3)})`
          el.style.opacity = v.toFixed(3)
          el.style.visibility = v < 0.01 ? 'hidden' : 'visible'
        })
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
      atual = reduzir ? alvo : atual + (alvo - atual) * (1 - Math.exp(-dt * 6))
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
    window.addEventListener('scroll', aoScroll, { passive: true })
    window.addEventListener('resize', aoRedim)
    return () => {
      obs.disconnect()
      window.removeEventListener('scroll', aoScroll); window.removeEventListener('resize', aoRedim)
      if (quadro) cancelAnimationFrame(quadro)
    }
  }, [])

  const irPara = (i: number) => {
    const el = secaoRef.current
    if (!el) return
    const topo = el.getBoundingClientRect().top + window.scrollY, total = el.offsetHeight - window.innerHeight
    window.scrollTo({ top: topo + total * ((i + 0.55) / CENAS.length), behavior: 'smooth' })
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
          {SAIDAS.map((s) => (
            <span key={s.t} className="ag-saida">
              <i><Icone nome={s.icone} tamanho={15} /></i><span><b>{s.t}</b><small>{s.d}</small></span>
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
