import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Icone } from '../components/Icone'
import { MESES_NOME } from '../lib/format'
import { semMovimento } from '../lib/tema'
import { tx } from '../lib/textos'
import './algoritmo.css'

/**
 * "O motor do OpusCash": uma rede neural em 3D, presa na tela enquanto a pessoa rola, que mostra o motor do app
 * trabalhando em quatro passos: os dados entram, a rede cruza tudo, compara cada detalhe e diz o que fazer.
 *
 * A rede (neurônios em camadas, ligações, sinais correndo pelos fios) é desenhada num <canvas> com projeção 3D feita à
 * mão: centenas de linhas em HTML/3D pesariam demais. Os cartões por cima (dados entrando, comparações, respostas) são
 * HTML posicionados a cada quadro no ponto da tela onde está o neurônio deles.
 *
 * É uma imagem do que o motor faz, não um retrato técnico dele: o Consultor (lib/analise.ts) é feito de regras de
 * finanças, então os textos falam em algoritmo, cruzar e comparar, nunca em "inteligência artificial".
 */
const CENAS = [
  { titulo: tx('Seus dados entram'), texto: tx('Lançamentos, cartões, dívidas, metas, saldos e o extrato do banco: tudo vira informação para o motor.') },
  { titulo: tx('A rede cruza tudo'), texto: tx('Cada número é ligado aos outros: o gasto de hoje com o mês, o mês com o ano, a dívida com o que sobra.') },
  { titulo: tx('Compara cada detalhe'), texto: tx('Seu mês com a sua média, os juros com a reserva, o ritmo de cada meta com o prazo dela.') },
  { titulo: tx('E diz o que fazer'), texto: tx('Uma nota para o seu dinheiro e um plano de ação na ordem certa, refeito a cada lançamento.') },
] as const

/** Os dados que entram, um por neurônio de entrada. */
const ENTRADAS = [
  { icone: 'lista', rotulo: tx('Mercado'), valor: '− R$ 334,00', c: '#f07a12' },
  { icone: 'cartao', rotulo: tx('Fatura Nubank'), valor: 'R$ 960,00', c: '#a855f7' },
  { icone: 'divida', rotulo: tx('Empréstimo'), valor: tx('4,2% ao mês'), c: '#ffc000' },
  { icone: 'meta', rotulo: tx('Viagem ao Japão'), valor: '32%', c: '#38bdf8' },
  { icone: 'carteira', rotulo: tx('Saldo guardado'), valor: 'R$ 25.290,00', c: '#22b8f0' },
  { icone: 'relatorio', rotulo: tx('extrato.pdf'), valor: tx('42 linhas'), c: '#ef4a6a' },
]
/** As comparações: dois neurônios do meio (camada, índice) e o que sai de comparar um com o outro. */
const COMPARA: { a: [number, number]; b: [number, number]; x: string; y: string; r: string; bom?: boolean }[] = [
  { a: [1, 4], b: [2, 0], x: MESES_NOME[9], y: tx('sua média'), r: tx('8% menos'), bom: true },
  { a: [2, 5], b: [3, 4], x: tx('Juros 4,2%'), y: tx('reserva 0,8%'), r: tx('adiante a dívida') },
  { a: [1, 10], b: [2, 7], x: tx('Ritmo da meta'), y: tx('prazo'), r: tx('2 meses atrás') },
  { a: [2, 11], b: [3, 8], x: tx('Assinaturas'), y: tx('uso'), r: tx('3 paradas') },
]
/** O que sai: um cartão por neurônio de saída. */
const SAIDAS = [
  { icone: 'estrela', t: tx('Nota 72 · Boa'), d: tx('6 pilares analisados'), c: '#1fd1a0' },
  { icone: 'divida', t: tx('Adiante o Empréstimo pessoal'), d: tx('a dívida mais cara'), c: '#ffc000' },
  { icone: 'ano', t: tx('Vai sobrar R$ 1.937'), d: tx('previsão para o dia 31'), c: '#22b8f0' },
  { icone: 'calendario', t: tx('Cancele 3 assinaturas'), d: tx('R$ 418 a mais no ano'), c: '#a855f7' },
]

// ─── a rede: camadas ao longo de x. Entrada e saída são colunas (os cartões encostam nelas); as do meio são grades
//     em y/z, e por isso a rede mostra profundidade quando a câmera gira ───
/** Cada camada: quantas linhas (y) e quantas colunas de profundidade (z). */
const CAMADAS: [number, number][] = [[6, 1], [4, 3], [4, 3], [3, 3], [4, 1]]
const XS = [-390, -195, 0, 195, 390]
interface No { x: number; y: number; z: number; camada: number; i: number }
interface Liga { a: number; b: number; camada: number; cruza?: boolean }
/** Sorteio sempre igual (a rede é a mesma a cada visita). */
function sorteio(semente: number) {
  let s = semente
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296 }
}
function montarRede() {
  const nos: No[] = [], ini: number[] = [], tam: number[] = []
  const r = sorteio(11)
  CAMADAS.forEach(([linhas, cols], c) => {
    ini.push(nos.length)
    const alto = c === 0 ? 440 : c === CAMADAS.length - 1 ? 330 : 360, fundo = 230
    let i = 0
    for (let k = 0; k < cols; k++) for (let j = 0; j < linhas; j++) {
      const y = (linhas === 1 ? 0 : j / (linhas - 1) - 0.5) * alto + (cols > 1 ? (k - 1) * 22 : 0)
      const z = (cols === 1 ? 0 : k / (cols - 1) - 0.5) * fundo
      // um leve desalinho: rede de verdade não é grade de planilha
      nos.push({ x: XS[c] + (cols > 1 ? (r() - 0.5) * 30 : 0), y: y + (cols > 1 ? (r() - 0.5) * 24 : 0), z, camada: c, i: i++ })
    }
    tam.push(linhas * cols)
  })
  const ligas: Liga[] = []
  for (let c = 0; c < CAMADAS.length - 1; c++) {
    const chance = c === 0 ? 0.55 : c === CAMADAS.length - 2 ? 0.8 : 0.36
    for (let i = 0; i < tam[c]; i++) for (let j = 0; j < tam[c + 1]; j++) {
      if (r() < chance) ligas.push({ a: ini[c] + i, b: ini[c + 1] + j, camada: c })
    }
  }
  // ligações que pulam uma camada: os dados "cruzando"
  for (let k = 0; k < 16; k++) {
    const c = k % 3, i = Math.floor(r() * tam[c]), j = Math.floor(r() * tam[c + 2])
    ligas.push({ a: ini[c] + i, b: ini[c + 2] + j, camada: c, cruza: true })
  }
  return { nos, ligas, ini }
}

const limitar = (n: number, a = 0, b = 1) => Math.min(b, Math.max(a, n))
const suave = (a: number, b: number, x: number) => { const t = limitar((x - a) / (b - a)); return t * t * (3 - 2 * t) }
const mistura = (a: number, b: number, t: number) => a + (b - a) * t

/** Câmera em cada cena: giro (rad), inclinação (rad), zoom. */
/** dx: quanto a rede anda para a direita (px de desenho); na cena 1, para os cartões de dados caberem à esquerda dela. */
const CAM = [
  { yaw: -0.36, pitch: 0.14, zoom: 0.9, dx: 150 },
  { yaw: 0.5, pitch: 0.26, zoom: 1.02, dx: 0 },
  { yaw: 0.22, pitch: 0.08, zoom: 1.1, dx: 0 },
  { yaw: -0.18, pitch: 0.14, zoom: 0.98, dx: 0 },
]

/** Brilho redondo pronto (desenhado uma vez e carimbado): bem mais barato que desfoque a cada quadro. */
function brilho(cor: [number, number, number], tam = 64) {
  const c = document.createElement('canvas')
  c.width = c.height = tam
  const g = c.getContext('2d')!
  const [r, gr, b] = cor
  const rad = g.createRadialGradient(tam / 2, tam / 2, 0, tam / 2, tam / 2, tam / 2)
  rad.addColorStop(0, 'rgba(255,255,255,1)')
  rad.addColorStop(0.18, `rgba(${r},${gr},${b},0.95)`)
  rad.addColorStop(0.5, `rgba(${r},${gr},${b},0.25)`)
  rad.addColorStop(1, `rgba(${r},${gr},${b},0)`)
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
    const { nos, ligas, ini } = montarRede()
    const n = CENAS.length, L = CAMADAS.length
    const entradas = [...sticky.querySelectorAll<HTMLElement>('.ag-entrada')]
    const comparas = [...sticky.querySelectorAll<HTMLElement>('.ag-compara')]
    const saidas = [...sticky.querySelectorAll<HTMLElement>('.ag-saida')]
    const contador = sticky.querySelector<HTMLElement>('[data-relacoes]')

    let W = 0, H = 0, dpr = 1, cx = 0, cy = 0, esc = 1, celular = false, reduzir = false, claro = false
    let sprA = brilho([31, 209, 160]), sprB = brilho([110, 124, 255]), sprW = brilho([180, 255, 235], 32)
    const cores = () => {
      claro = document.documentElement.dataset.tema === 'claro'
      sprA = brilho(claro ? [13, 159, 128] : [31, 209, 160])
      sprB = brilho(claro ? [61, 75, 224] : [110, 124, 255])
      sprW = brilho(claro ? [13, 159, 128] : [180, 255, 235], 32)
    }
    const medir = () => {
      reduzir = semMovimento()
      W = sticky.clientWidth; H = sticky.clientHeight; celular = W <= 900
      dpr = Math.min(window.devicePixelRatio || 1, 1.75)
      tela.width = Math.round(W * dpr); tela.height = Math.round(H * dpr)
      tela.style.width = `${W}px`; tela.style.height = `${H}px`
      // a área da rede: à direita do texto no computador (com folga para os cartões de resposta), embaixo no celular
      if (celular) {
        const topo = Math.min(270, H * 0.33), ah = H - topo - 20
        cx = W / 2; cy = topo + ah * 0.4; esc = Math.min((W * 0.92) / 860, (ah * 0.62) / 560)
      } else {
        const esq = Math.min(460, W * 0.36), aw = W - esq - 270
        cx = esq + aw / 2 + 10; cy = H * 0.5; esc = Math.min(aw / 860, (H * 0.78) / 560)
      }
      cores()
    }

    // projeção: gira em volta do eixo y (giro), depois do x (inclinação), e põe em perspectiva
    let yaw = 0, pitch = 0, zoom = 1, dx = 0
    const F = 1500
    const proj = (x: number, y: number, z: number) => {
      const cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch)
      const X = x * cyw + z * syw
      let Z = -x * syw + z * cyw
      const Y = y * cp - Z * sp
      Z = y * sp + Z * cp
      const s = F / (F + Z)
      return { x: cx + (X * s * zoom + dx) * esc, y: cy + Y * s * esc * zoom, s, z: Z }
    }

    const ultimo = new Map<string, string>()
    const por = (k: string, v: string, f: () => void) => { if (ultimo.get(k) !== v) { ultimo.set(k, v); f() } }
    let cenaAtual = -1
    const pos: ReturnType<typeof proj>[] = new Array(nos.length)
    const atv = new Float32Array(nos.length)

    const desenhar = (p: number, tempo: number) => {
      // presença de cada cena (0 a 1) e o andamento dela
      const pres: number[] = [], and: number[] = []
      for (let i = 0; i < n; i++) {
        const a = i / n, b = (i + 1) / n
        pres.push((i === 0 ? 1 : suave(a - 0.04, a + 0.04, p)) * (i === n - 1 ? 1 : 1 - suave(b - 0.04, b + 0.04, p)))
        and.push(limitar(((p - a) / (b - a)) * 1.15))
      }
      // câmera: mistura das cenas, com um balanço leve que nunca para
      const fpos = limitar(p * n - 0.5, 0, n - 1), i0 = Math.floor(fpos), i1 = Math.min(n - 1, i0 + 1), f = suave(0, 1, fpos - i0)
      const t = reduzir ? 0 : tempo
      yaw = mistura(CAM[i0].yaw, CAM[i1].yaw, f) + Math.sin(t * 0.00028) * 0.09
      pitch = mistura(CAM[i0].pitch, CAM[i1].pitch, f) + Math.cos(t * 0.00021) * 0.04
      zoom = mistura(CAM[i0].zoom, CAM[i1].zoom, f)
      dx = mistura(CAM[i0].dx, CAM[i1].dx, f) * (celular ? 0 : 1)

      // ativação: (1) a onda que passa sozinha de tempos em tempos; (2) a onda da cena 2, levada pelo scroll;
      // (3) entradas acesas quando o dado chega; (4) as comparações e as saídas
      const ondaSozinha = reduzir ? -9 : ((t / 1000) % 3.4) / 3.4 * (L + 1.2) - 0.6
      const ondaScroll = and[1] * (L + 0.6) - 0.3
      const chegou = ENTRADAS.map((_, i) => limitar(and[0] * 1.6 - i * 0.12 + 0.05))
      nos.forEach((no, k) => {
        const c = no.camada
        let a = 0.12 + 0.5 * Math.exp(-((c - ondaSozinha) ** 2) / 0.35)
        a = Math.max(a, pres[1] * Math.exp(-((c - ondaScroll) ** 2) / 0.25))
        if (c === 0) a = Math.max(a, (chegou[no.i] ?? 0) * pres[0] + 0.35 * (1 - pres[0]))
        if (c === L - 1) a = Math.max(a, pres[3] * limitar(and[3] * 2.4 - no.i * 0.25))
        atv[k] = Math.min(1, a)
        pos[k] = proj(no.x, no.y, no.z)
      })
      // comparações: os dois neurônios de cada par acendem
      const fc = COMPARA.map((_, i) => pres[2] * limitar(and[2] * 2.2 - i * 0.32 - 0.1))
      COMPARA.forEach((cp, i) => {
        const ka = ini[cp.a[0]] + cp.a[1], kb = ini[cp.b[0]] + cp.b[1]
        atv[ka] = Math.max(atv[ka], fc[i]); atv[kb] = Math.max(atv[kb], fc[i])
      })

      // ─── desenho ───
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, H)
      // no escuro a luz soma (brilha); no claro, a tinta pinta por cima
      ctx.globalCompositeOperation = claro ? 'source-over' : 'lighter'
      ctx.lineCap = 'round'
      // ligações: mais fortes quando as duas pontas estão acesas, mais apagadas quando ficam lá atrás
      for (const l of ligas) {
        const A = pos[l.a], B = pos[l.b]
        const acesa = (atv[l.a] + atv[l.b]) / 2
        const fundo = limitar(0.55 + (A.s + B.s - 2) * 1.6, 0.25, 1)
        const alfa = (l.cruza ? 0.06 + 0.4 * acesa * pres[1] : 0.07 + 0.42 * acesa) * fundo * (claro ? 1.3 : 1)
        if (alfa < 0.01) continue
        ctx.strokeStyle = l.camada % 2
          ? (claro ? `rgba(61,75,224,${alfa})` : `rgba(110,124,255,${alfa})`)
          : (claro ? `rgba(13,159,128,${alfa})` : `rgba(31,209,160,${alfa})`)
        ctx.lineWidth = (l.cruza ? 1 : 0.9 + acesa * 1.4) * ((A.s + B.s) / 2)
        ctx.beginPath()
        if (l.cruza) {
          // as que cruzam uma camada fazem uma curva por cima
          ctx.moveTo(A.x, A.y); ctx.quadraticCurveTo((A.x + B.x) / 2, Math.min(A.y, B.y) - 70 * esc, B.x, B.y)
        } else { ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y) }
        ctx.stroke()
      }
      // comparações: o par ligado por um fio forte, tracejado e andando
      COMPARA.forEach((cp, i) => {
        if (fc[i] < 0.01) return
        const A = pos[ini[cp.a[0]] + cp.a[1]], B = pos[ini[cp.b[0]] + cp.b[1]]
        ctx.strokeStyle = claro ? `rgba(13,159,128,${0.85 * fc[i]})` : `rgba(160,255,230,${0.9 * fc[i]})`
        ctx.lineWidth = 2.2
        ctx.setLineDash([6, 6]); ctx.lineDashOffset = -t * 0.03
        ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke()
        ctx.setLineDash([])
      })
      // sinais correndo pelos fios: onde a onda está passando, um ponto de luz vai da camada c para a c+1
      const ondas: [number, number][] = [[ondaSozinha, 0.75], [ondaScroll, pres[1]]]
      for (let k = 0; k < ligas.length; k++) {
        const l = ligas[k]
        if (l.cruza) continue
        for (const [onda, forca] of ondas) {
          const q = onda - l.camada
          if (forca < 0.02 || q <= 0 || q >= 1 || (forca < 0.9 && k % 2)) continue
          const A = pos[l.a], B = pos[l.b]
          const x = mistura(A.x, B.x, q), y = mistura(A.y, B.y, q), s = mistura(A.s, B.s, q)
          const tam = 14 * s * esc * forca + 4
          ctx.globalAlpha = 0.9 * forca
          ctx.drawImage(sprW, x - tam / 2, y - tam / 2, tam, tam)
        }
      }
      ctx.globalAlpha = 1
      // neurônios: brilho carimbado, maior e mais forte quando acesos; os de trás primeiro e menores
      const ordem = nos.map((_, k) => k).sort((a, b) => pos[b].z - pos[a].z)
      for (const k of ordem) {
        const P = pos[k], a = atv[k]
        const tam = (30 + 46 * a) * P.s * esc
        ctx.globalAlpha = limitar(0.45 + 0.55 * a) * limitar(0.55 + (P.s - 1) * 2.4, 0.4, 1)
        ctx.drawImage(nos[k].camada % 2 ? sprB : sprA, P.x - tam / 2, P.y - tam / 2, tam, tam)
        ctx.globalAlpha = 1
        ctx.fillStyle = claro ? (a > 0.5 ? '#0d9f80' : '#7fcfbd') : (a > 0.5 ? '#ffffff' : '#9fe8d2')
        ctx.beginPath(); ctx.arc(P.x, P.y, (3 + 3.2 * a) * P.s * esc, 0, Math.PI * 2); ctx.fill()
      }
      ctx.globalCompositeOperation = 'source-over'

      // ─── cartões por cima ───
      // cena 1: cada dado vem da esquerda (no celular, de baixo) e é engolido pelo neurônio de entrada
      // (o cartão chega até encostar no neurônio, fica um instante e é puxado para dentro dele, encolhendo)
      entradas.forEach((el, i) => {
        const P = pos[ini[0] + i], fi = chegou[i]
        const vem = suave(0, 0.35, fi), entra = suave(0.62, 1, fi)
        // no celular não cabe nada à esquerda da rede: os cartões surgem numa grade embaixo dela e sobem voando
        const gx = cx + (i % 2 ? 1 : -1) * Math.min(96, W * 0.24), gy = cy + 205 * esc + 24 + Math.floor(i / 2) * 46
        const x = celular ? mistura(gx, P.x, entra) : P.x - 16 - (1 - vem) * 70 + entra * 16
        const y = celular ? mistura(gy + (1 - vem) * 24, P.y, entra) : P.y
        const o = pres[0] * vem * (1 - entra)
        por(`e${i}`, `${x.toFixed(1)},${y.toFixed(1)},${o.toFixed(3)}`, () => {
          el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(${celular ? '-50%' : '-100%'}, -50%) scale(${(1 - entra * 0.75).toFixed(3)})`
          el.style.opacity = o.toFixed(3)
          el.style.visibility = o < 0.01 ? 'hidden' : 'visible'
        })
      })
      // cena 3: a etiqueta de cada comparação fica em cima do meio do par
      COMPARA.forEach((cp, i) => {
        const el = comparas[i], A = pos[ini[cp.a[0]] + cp.a[1]], B = pos[ini[cp.b[0]] + cp.b[1]]
        const x = (A.x + B.x) / 2, y = (A.y + B.y) / 2
        por(`c${i}`, `${x.toFixed(1)},${y.toFixed(1)},${fc[i].toFixed(3)}`, () => {
          el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -125%) scale(${(0.85 + 0.15 * fc[i]).toFixed(3)})`
          el.style.opacity = fc[i].toFixed(3)
          el.style.visibility = fc[i] < 0.01 ? 'hidden' : 'visible'
        })
      })
      // cena 4: as respostas saem dos neurônios de saída (no celular, numa grade embaixo da rede)
      SAIDAS.forEach((_, i) => {
        const el = saidas[i], P = pos[ini[L - 1] + i]
        const fs = pres[3] * limitar(and[3] * 2.4 - i * 0.25)
        const x = celular ? cx + (i % 2 ? 5 : -5) : P.x + 26, y = celular ? cy + 200 * esc + 18 + Math.floor(i / 2) * 62 : P.y
        por(`s${i}`, `${x.toFixed(1)},${y.toFixed(1)},${fs.toFixed(3)}`, () => {
          el.style.transform = celular
            ? `translate3d(${x.toFixed(1)}px, ${(y + (1 - fs) * 20).toFixed(1)}px, 0) translate(${i % 2 ? '0' : '-100%'}, 0)`
            : `translate3d(${(x + (1 - fs) * -30).toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(0, -50%)`
          el.style.opacity = fs.toFixed(3)
          el.style.visibility = fs < 0.01 ? 'hidden' : 'visible'
        })
      })
      // presença das cenas para o CSS (o painel de contagem e os selos do fim)
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
      if (visivel && !quadro) { lerScroll(); antes = 0; quadro = requestAnimationFrame(laco) }
    })
    obs.observe(secao)
    // troca de tema: as cores do desenho vêm dele
    const tema = new MutationObserver(() => { cores(); desenhar(atual, performance.now()) })
    tema.observe(document.documentElement, { attributes: true, attributeFilter: ['data-tema'] })
    const aoScroll = () => lerScroll()
    const aoRedim = () => { medir(); lerScroll(); desenhar(atual, performance.now()) }
    medir(); lerScroll(); atual = alvo; desenhar(atual, performance.now())
    window.addEventListener('scroll', aoScroll, { passive: true })
    window.addEventListener('resize', aoRedim)
    return () => {
      obs.disconnect(); tema.disconnect()
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
        <div className="ag-luz" aria-hidden="true" />
        <canvas className="ag-rede" ref={telaRef} aria-hidden="true" />

        <div className="ag-sobre" aria-hidden="true">
          {ENTRADAS.map((e) => (
            <span key={e.rotulo} className="ag-entrada" style={{ '--c': e.c } as CSSProperties}>
              <i><Icone nome={e.icone} tamanho={14} /></i><span><small>{e.rotulo}</small><b>{e.valor}</b></span>
            </span>
          ))}
          {COMPARA.map((c) => (
            <span key={c.x} className={`ag-compara ${c.bom ? 'bom' : ''}`}>
              <span><small>{c.x}</small><em>×</em><small>{c.y}</small></span><b>{c.r}</b>
            </span>
          ))}
          {SAIDAS.map((s) => (
            <span key={s.t} className="ag-saida" style={{ '--c': s.c } as CSSProperties}>
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
