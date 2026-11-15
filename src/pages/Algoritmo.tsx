import { useEffect, useRef, useState } from 'react'
import { Icone } from '../components/Icone'
import { MESES_NOME } from '../lib/format'
import { semMovimento } from '../lib/tema'
import { tx } from '../lib/textos'
import { ANO } from './apresentacaoCena'
import { alturaIdeal, desenharTela, type TelaPronta } from './algoritmoTela'
import { ajustarConsultor, carregarConsultor, desenharConsultor, idiomaDasFotos, mergulho, Z_REDE, type ConsultorReal } from './algoritmoConsultor'
import { desenharDocs, desenharLancamento, LIDAS_PDF, LIDAS_PLANILHA, type DocPronto, type LinhaLida } from './algoritmoDocs'
import './algoritmo.css'

/**
 * "O motor do OpusCash": começa na tela do Consultor, a câmera entra nela e chega no que roda lá no fundo, uma rede
 * neural em 3D (camadas de nós ligados por fios, com o sinal passando da entrada para a saída), presa na tela
 * enquanto a pessoa rola:
 *   0. por trás do Consultor: a tela de verdade do Consultor (fotos do app, algoritmoConsultor.ts) vira um espaço com
 *      profundidade, a câmera avança por dentro dela e chega na rede, que já estava rodando atrás;
 *   1. lê o extrato e a planilha: uma luz passa por um PDF do banco e por uma planilha, e cada linha sai como um
 *      lançamento limpo que entra pela primeira camada da rede (algoritmoDocs.ts);
 *   2. o motor calcula: o sinal corre mais rápido e mais nós acendem;
 *   3. compara: a rede se desmancha e os fragmentos se arrumam num gráfico 3D dos meses (entrou × saiu, com a média);
 *   4. responde: os fragmentos pousam nos traços da tela do Consultor (as letras, o círculo da nota, as barras) e ela
 *      acende de cima para baixo no lugar deles (algoritmoTela.ts). Termina onde começou.
 *
 * A rede é desenhada em linhas e nós; por cima dela correm os fragmentos (a poeira de dados: uns em volta dos nós, a
 * maioria andando pelos fios). Cada fragmento tem um lugar em cada forma; o desenho mistura as formas conforme o
 * scroll, com um atraso por fragmento (a mudança passa como uma onda) e um redemoinho no meio do caminho. Tudo num
 * <canvas> somando luz.
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

// ─── a rede: camadas de nós em grade (largura × altura), da entrada (esquerda) à saída (um nó só, a resposta) ───
const CAMADAS: [number, number][] = [[3, 4], [4, 5], [4, 6], [4, 6], [4, 5], [3, 3], [1, 1]]
const LARGO_REDE = 680, PASSO_Y = 60, PASSO_Z = 46
/** De quantas em quantas camadas vem uma onda de sinal. */
const ESPACO = 4
interface No { x: number; y: number; z: number; camada: number }
const REDE = (() => {
  const nos: No[] = [], elos: { a: number; b: number }[] = [], inicio: number[] = []
  CAMADAS.forEach(([nz, ny], c) => {
    inicio.push(nos.length)
    const x = (c / (CAMADAS.length - 1) - 0.5) * LARGO_REDE
    for (let j = 0; j < ny; j++) for (let k = 0; k < nz; k++) nos.push({ x, y: (j - (ny - 1) / 2) * PASSO_Y, z: (k - (nz - 1) / 2) * PASSO_Z, camada: c })
  })
  inicio.push(nos.length)
  // cada nó se liga aos 4 mais próximos da camada seguinte; nenhum nó fica sem fio chegando
  for (let c = 0; c < CAMADAS.length - 1; c++) {
    const prox = Array.from({ length: inicio[c + 2] - inicio[c + 1] }, (_, i) => inicio[c + 1] + i)
    const longe = (a: number, b: number) => Math.hypot(nos[a].y - nos[b].y, nos[a].z - nos[b].z)
    const tem = new Set<number>(), feitos = new Set<string>()
    const ligar = (a: number, b: number) => { if (!feitos.has(`${a}-${b}`)) { feitos.add(`${a}-${b}`); tem.add(b); elos.push({ a, b }) } }
    for (let a = inicio[c]; a < inicio[c + 1]; a++) {
      [...prox].sort((m, n) => longe(a, m) - longe(a, n)).slice(0, 4).forEach((b) => ligar(a, b))
    }
    for (const b of prox) if (!tem.has(b)) {
      let perto = inicio[c]
      for (let a = inicio[c]; a < inicio[c + 1]; a++) if (longe(a, b) < longe(perto, b)) perto = a
      ligar(perto, b)
    }
  }
  return { nos, elos, inicio, entrada: inicio[1] }
})()
/** A força com que o nó dispara na onda k (0 = fica quieto). Sempre a mesma para o mesmo nó e a mesma onda. */
function forca(no: number, k: number, limiar: number) {
  if (REDE.nos[no].camada === CAMADAS.length - 1) return 1
  const h = Math.sin(no * 127.1 + k * 311.7) * 43758.5453, u = h - Math.floor(h)
  return u < limiar ? 0 : 0.35 + 0.65 * ((u - limiar) / (1 - limiar))
}
const BASE_GRAF = 170, ALTO_GRAF = 330, LARGO_GRAF = 640

interface Frag {
  no: number // na rede: em volta de qual nó (-1 = anda por um fio)
  elo: number; t0: number; vel: number // qual fio, onde começa nele e a que passo anda
  des: V3 // o quanto fica fora do nó ou do fio
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
    // rede: um terço em volta dos nós (uma casquinha em cada um), o resto andando pelos fios
    let no = -1, elo = 0, des: V3
    if (r() < 0.22) {
      no = Math.floor(r() * REDE.nos.length)
      const a = r() * Math.PI * 2, b = Math.acos(1 - 2 * r()), raio = 7 + r() * 5
      des = [Math.sin(b) * Math.cos(a) * raio, Math.cos(b) * raio, Math.sin(b) * Math.sin(a) * raio]
    } else {
      elo = Math.floor(r() * REDE.elos.length)
      des = [(r() - 0.5) * 2.4, (r() - 0.5) * 2.4, (r() - 0.5) * 2.4]
    }
    const t0 = r(), vel = 0.05 + r() * 0.12
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
      // a maioria são traços e pontos; uns 12% são placas maiores (os pacotes de dados)
      no, elo, t0, vel, des, barra, tela, atraso: r() * 0.35,
      ...(r() < 0.12 ? { w: 6 + r() * 9, h: 2 + r() * 2.5 } : { w: 1 + r() * 4.5, h: 1 + r() * 1.4 }),
      brilho: Math.min(4, Math.floor(Math.pow(r(), 1.15) * 5)), fase: r() * 10, cat,
    })
  }
  return fr
}

/** Câmera em cada cena: giro e inclinação (rad), aproximação. Na primeira e na última fica de frente: a tela encaixa na tela. */
const CAM = [
  { yaw: 0, pitch: 0, zoom: 1.08 },
  { yaw: -0.14, pitch: 0.18, zoom: 0.8 },
  { yaw: -0.22, pitch: 0.3, zoom: 1.05 },
  { yaw: 0.26, pitch: 0.12, zoom: 1.0 },
  { yaw: 0, pitch: 0, zoom: 1.08 },
]
const ZOOM_TELA = CAM[CAM.length - 1].zoom

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

    let W = 0, H = 0, dpr = 1, cx = 0, cy = 0, esc = 1, celular = false, reduzir = false
    let fr: Frag[] = [], chaveTela = ''
    // a tela do Consultor (cena 4): desenhada em px de CSS, centrada em (cx, yTela). No computador fica no lugar da
    // rede; no celular, entre o texto e os selos
    let tela: TelaPronta | null = null, yTela = 0
    // a abertura: a foto do Consultor de verdade (carrega quando a seção chega perto), em (realX, realY) com escala realS
    let real: ConsultorReal | null = null, chaveReal = '', realX = 0, realY = 0, realS = 1
    const pedirReal = () => {
      const chave = `${celular ? 'cel' : 'pc'}-${idiomaDasFotos()}`
      if (chave === chaveReal) return
      chaveReal = chave
      carregarConsultor(celular ? 'cel' : 'pc', idiomaDasFotos()).then((r) => { if (chaveReal === chave) { real = r; medir(); desenhar(atual, performance.now()) } }).catch(() => { chaveReal = '' })
    }
    let perto = false
    // a leitura (cena 1): o documento fica em (docX, docY) e a rede anda (desX, desY) para dar lugar a ele
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
      }
      if (perto) pedirReal()
      if (real) {
        if (celular) {
          const topo = texto.getBoundingClientRect().bottom - sticky.getBoundingClientRect().top + 16, fundo = H - 20
          realS = Math.min((fundo - topo) / real.h, (W * 0.78) / real.w)
          realX = (W - real.w * realS) / 2; realY = (topo + fundo) / 2 - (real.h * realS) / 2
          ajustarConsultor(real, realS * dpr)
        } else {
          const esq = Math.min(460, W * 0.36), aw = W - esq - 40
          realS = Math.min(aw / real.w, (H * 0.8) / real.h)
          realX = esq + 20 + (aw - real.w * realS) / 2; realY = (H - real.h * realS) / 2
        }
        ajustarConsultor(real, realS * dpr)
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
    let cenaAtual = -1, giro = 0, antesGiro = 0, pulso = 2.6, fluxo = 0
    // a rede a cada quadro: cada nó no espaço (já girado), na tela e o quanto está aceso
    const NN = REDE.nos.length
    const rx = new Float32Array(NN), ry = new Float32Array(NN), rz = new Float32Array(NN)
    const nx = new Float32Array(NN), ny = new Float32Array(NN), ns = new Float32Array(NN), aceso = new Float32Array(NN)
    const xs = new Float32Array(2000), ys = new Float32Array(2000), ss = new Float32Array(2000), vs = new Float32Array(2000), ms = new Float32Array(2000)

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
      // na leitura a rede chega para o lado e o documento fica no lugar dela
      offX = desX * pres[1]; offY = desY * pres[1]
      // cena 0: a câmera entra na tela (desm) e a rede, lá no fundo e apagada, chega perto e acende (oculto vai a 0)
      const desm = real ? suave(0.02, 0.185, p) : 1, oculto = 1 - suave(0.12, 0.7, desm)
      const mg = mergulho(desm)
      // enquanto a câmera não chega, a rede fica no meio da tela do Consultor (é para lá que ela vai)
      if (real && desm < 1) {
        const falta = 1 - suave(0.55, 1, desm), rw = real.w * realS
        offX += (realX + rw / 2 - cx) * falta - mg.lado * Z_REDE * rw / (1 + Z_REDE - mg.cam)
        offY += (realY + (real.h * realS) / 2 - cy) * falta
      }
      const u1 = limitar((p - 0.2) / 0.2) // o andamento da leitura
      // a rede balança de um lado para o outro; calculando (cena 2), o sinal corre mais rápido e mais nós disparam
      const dt = antesGiro ? Math.min(0.05, (tempo - antesGiro) / 1000) : 0
      antesGiro = tempo
      const calc = pres[2]
      if (!reduzir) {
        giro += dt * (0.25 + 0.5 * calc + 0.2 * pres[1])
        pulso += dt * (1.5 + 2.4 * calc + 0.6 * pres[1])
        fluxo += dt * (1 + 2.2 * calc + 0.8 * pres[1])
      }
      const limiar = 0.42 - 0.22 * calc

      // as formas ao longo do scroll: rede → gráfico → tela. Cada fragmento muda com um atraso
      const g0 = limitar((p - 0.576) / 0.144), v0 = limitar((p - 0.776) / 0.128), raioK = 1 / (1 + Z_REDE - mg.cam)
      const forma = (fx: Frag, i: number): V3 => {
        let ex: number, ey: number, ez: number
        if (fx.no >= 0) { ex = rx[fx.no]; ey = ry[fx.no]; ez = rz[fx.no] }
        else {
          const e = REDE.elos[fx.elo], u = fx.t0 + fluxo * fx.vel, k = u - Math.floor(u)
          ex = mistura(rx[e.a], rx[e.b], k); ey = mistura(ry[e.a], ry[e.b], k); ez = mistura(rz[e.a], rz[e.b], k)
        }
        ex += fx.des[0] * raioK; ey += fx.des[1] * raioK; ez += fx.des[2] * raioK
        const g = suave(fx.atraso, fx.atraso + 0.55, g0)
        const v = suave(fx.atraso, fx.atraso + 0.55, v0)
        vs[i] = v
        // na rede os fragmentos são poeira fina; viram peça inteira quando saem para o gráfico
        ms[i] = 0.42 + 0.58 * Math.max(g, v)
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

      // névoa de luz atrás (mais forte com a rede inteira)
      const centro = proj(0, 0, 0)
      const redeCheia = (1 - suave(0.576, 0.68, p)) * (1 - 0.8 * oculto)
      // a leitura: onde está a luz em cada documento e os lançamentos no ar; cada um que chega acende a entrada da rede
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
      ctx.globalAlpha = Math.min(1, 0.2 + 0.3 * redeCheia + 0.3 * pres[n - 1] + 0.3 * pres[0] + 0.3 * chegada)
      ctx.drawImage(sprHalo, centro.x - th / 2, centro.y - th / 2, th, th)
      ctx.globalAlpha = 1

      // a rede: onde está cada nó e o quanto está aceso (a onda de sinal passa da entrada para a saída)
      const ang = -0.5 + 0.22 * Math.sin(giro * 0.5), ca = Math.cos(ang), sa = Math.sin(ang)
      for (let i = 0; i < NN; i++) {
        const no = REDE.nos[i]
        rx[i] = (no.x * ca + no.z * sa) * raioK; ry[i] = no.y * raioK; rz[i] = (-no.x * sa + no.z * ca) * raioK
        const P = proj(rx[i], ry[i], rz[i])
        nx[i] = P.x; ny[i] = P.y; ns[i] = P.s * esc * zoom * raioK
        const fase = (pulso - no.camada) / ESPACO, k = Math.floor(fase)
        aceso[i] = forca(i, k, limiar) * Math.exp(-(fase - k) * ESPACO * 1.15)
        if (no.camada === 0) aceso[i] = Math.max(aceso[i], chegada)
      }
      if (redeCheia > 0.02) {
        // os fios: todos bem fracos (os de trás mais ainda) e, mais fortes, os que estão levando sinal agora
        const fios = [new Path2D(), new Path2D()], vivos = new Path2D(), pontas: [number, number, number, number][] = []
        for (const { a, b } of REDE.elos) {
          const f = fios[rz[a] + rz[b] > 0 ? 0 : 1]
          f.moveTo(nx[a], ny[a]); f.lineTo(nx[b], ny[b])
          const fase = (pulso - REDE.nos[a].camada) / ESPACO, k = Math.floor(fase), u = (fase - k) * ESPACO
          if (u >= 1.25) continue
          const v = forca(a, k, limiar) * forca(b, k, limiar)
          if (!v) continue
          // o trecho aceso é um rastro curto atrás da ponta do sinal
          const t1 = Math.min(1, u), t0 = Math.max(0, u - 0.45)
          vivos.moveTo(mistura(nx[a], nx[b], t0), mistura(ny[a], ny[b], t0)); vivos.lineTo(mistura(nx[a], nx[b], t1), mistura(ny[a], ny[b], t1))
          if (u < 1) pontas.push([mistura(nx[a], nx[b], u), mistura(ny[a], ny[b], u), mistura(ns[a], ns[b], u), v])
        }
        ctx.lineWidth = 1
        ctx.strokeStyle = `rgba(255,170,70,${(0.07 * redeCheia).toFixed(3)})`; ctx.stroke(fios[0])
        ctx.strokeStyle = `rgba(255,185,90,${(0.16 * redeCheia).toFixed(3)})`; ctx.stroke(fios[1])
        ctx.strokeStyle = `rgba(255,170,60,${(0.16 * redeCheia).toFixed(3)})`; ctx.lineWidth = 3; ctx.stroke(vivos)
        ctx.strokeStyle = `rgba(255,232,180,${(0.85 * redeCheia).toFixed(3)})`; ctx.lineWidth = 1.1; ctx.stroke(vivos)
        for (const [x, y, k, v] of pontas) {
          const tam = (9 + 9 * v) * k
          ctx.globalAlpha = redeCheia * (0.5 + 0.5 * v)
          ctx.drawImage(sprPonto, x - tam / 2, y - tam / 2, tam, tam)
        }
        // cada camada num quadro fino, com as quinas marcadas (as fatias da rede)
        const quadros = new Path2D(), quinas = new Path2D()
        CAMADAS.forEach(([nz, nyy], c) => {
          if (nz < 2) return
          const x = REDE.nos[REDE.inicio[c]].x, my = ((nyy - 1) / 2) * PASSO_Y + 26, mz = ((nz - 1) / 2) * PASSO_Z + 22
          const q = [[-my, -mz], [-my, mz], [my, mz], [my, -mz]].map(([y, z]) => proj((x * ca + z * sa) * raioK, y * raioK, (-x * sa + z * ca) * raioK))
          q.forEach((P, i) => {
            const A = q[(i + 3) % 4], B = q[(i + 1) % 4]
            if (i === 0) quadros.moveTo(P.x, P.y); else quadros.lineTo(P.x, P.y)
            quinas.moveTo(mistura(P.x, A.x, 0.14), mistura(P.y, A.y, 0.14)); quinas.lineTo(P.x, P.y); quinas.lineTo(mistura(P.x, B.x, 0.14), mistura(P.y, B.y, 0.14))
          })
          quadros.closePath()
        })
        ctx.globalAlpha = redeCheia
        ctx.lineWidth = 1
        ctx.strokeStyle = 'rgba(255,190,100,0.1)'; ctx.stroke(quadros)
        ctx.strokeStyle = 'rgba(255,205,130,0.5)'; ctx.stroke(quinas)
        // os nós: um halo que cresce com o sinal, um anel fino e o miolo
        const aneis = new Path2D(), miolos = new Path2D(), cheios = new Path2D()
        for (let i = 0; i < NN; i++) {
          const saida = REDE.nos[i].camada === CAMADAS.length - 1, a = aceso[i], k = ns[i] * (saida ? 2.4 : 1)
          const tam = (16 + 50 * a) * k
          ctx.globalAlpha = redeCheia * (0.25 + 0.75 * a)
          ctx.drawImage(sprPonto, nx[i] - tam / 2, ny[i] - tam / 2, tam, tam)
          aneis.moveTo(nx[i] + 6 * k, ny[i]); aneis.arc(nx[i], ny[i], 6 * k, 0, Math.PI * 2)
          const m = a > 0.45 ? cheios : miolos, rm = (2 + 2.6 * a) * k
          m.moveTo(nx[i] + rm, ny[i]); m.arc(nx[i], ny[i], rm, 0, Math.PI * 2)
        }
        ctx.globalAlpha = redeCheia
        ctx.strokeStyle = 'rgba(255,205,130,0.75)'; ctx.lineWidth = 1.1; ctx.stroke(aneis)
        ctx.fillStyle = 'rgba(255,190,100,0.75)'; ctx.fill(miolos)
        ctx.fillStyle = 'rgba(255,246,224,1)'; ctx.fill(cheios)
        ctx.globalAlpha = 1
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
        // alguns piscam: sobem de tom de tempos em tempos
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
          const fx = fr[i], k = ss[i] * esc * zoom * (1 - 0.35 * vs[i]) * ms[i]
          ctx.fillRect(xs[i] - (fx.w * k) / 2, ys[i] - (fx.h * k) / 2, fx.w * k + 0.6, fx.h * k + 0.6)
        }
      })
      // pontos mais quentes com brilho (um a cada 14 fragmentos)
      ctx.globalAlpha = 0.6 * (1 - 0.85 * oculto)
      for (let i = 0; i < N; i += 14) {
        if (acende > 0 && vs[i] > 0.98 && ys[i] < yLuz - 3) continue
        const tam = (10 + 8 * Math.sin(s * 2 + fr[i].fase)) * ss[i] * esc * ms[i]
        ctx.drawImage(sprPonto, xs[i] - tam / 2, ys[i] - tam / 2, tam, tam)
      }
      ctx.globalAlpha = 1

      // cena 0: a tela do Consultor de verdade e, rolando, a câmera entrando nela
      if (real && desm < 1 && pres[0] > 0) {
        const rw = real.w * realS, rh = real.h * realS, raio = celular ? 26 * realS * 1.6 : 12
        // a moldura dourada em volta da tela (some quando ela começa a abrir)
        const moldura = 1 - suave(0, 0.15, desm)
        if (moldura > 0) {
          ctx.globalCompositeOperation = 'lighter'
          ctx.globalAlpha = 0.55 * moldura
          ctx.drawImage(sprHalo, realX - rw * 0.2, realY - rh * 0.25, rw * 1.4, rh * 1.5)
          ctx.globalAlpha = 1
        }
        desenharConsultor(ctx, real, realX, realY, realS, desm, raio)
        if (moldura > 0) {
          ctx.globalCompositeOperation = 'lighter'
          ctx.strokeStyle = `rgba(255,200,110,${(0.6 * moldura).toFixed(3)})`; ctx.lineWidth = 1.5
          ctx.beginPath(); ctx.roundRect(realX - 0.75, realY - 0.75, rw + 1.5, rh + 1.5, raio); ctx.stroke()
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
        // cada linha lida vira um lançamento que voa até um nó da entrada da rede, com um rastro de faíscas
        for (const { l, doc: dl, i, c } of lidos) {
          const alvo = (i * 5 + (dl === docs.pdf ? 0 : 3)) % REDE.entrada, ax = nx[alvo], ay = ny[alvo]
          const ry = docY + (dl.linhas[i] - dl.h / 2) * e
          const sx = celular ? docX : docX + dl.w * 0.32, sy = ry
          const kx = celular ? docX + (i % 2 ? 80 : -80) : (sx + ax) / 2, ky = celular ? (sy + ay) / 2 : Math.min(sy, ay) - 80
          const ponto = (t: number) => [(1 - t) * (1 - t) * sx + 2 * (1 - t) * t * kx + t * t * ax, (1 - t) * (1 - t) * sy + 2 * (1 - t) * t * ky + t * t * ay]
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
    const chegando = new IntersectionObserver(([e]) => { if (e.isIntersecting && !perto) { perto = true; pedirReal() } }, { rootMargin: '1500px 0px' })
    chegando.observe(secao)
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
      obs.disconnect(); chegando.disconnect(); tamanhos.disconnect()
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
