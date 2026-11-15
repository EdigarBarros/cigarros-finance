import { useEffect, useRef, useState } from 'react'
import { Icone } from '../components/Icone'
import { MESES_NOME } from '../lib/format'
import { semMovimento } from '../lib/tema'
import { tx } from '../lib/textos'
import { ANO } from './apresentacaoCena'
import { alturaIdeal, desenharTela, type TelaPronta } from './algoritmoTela'
import { ajustarConsultor, carregarConsultor, desenharConsultor, idiomaDasFotos, mergulho, Z_REDE, type ConsultorReal } from './algoritmoConsultor'
import { COR_TIPO, desenharDocs, LIDAS, LIDAS_PDF, type DocPronto, type TextoLido } from './algoritmoDocs'
import './algoritmo.css'

/**
 * "O motor do OpusCash": começa na tela do Consultor, a câmera entra nela e chega no que roda lá no fundo, uma rede
 * neural em 3D (camadas de nós ligados por fios, com o sinal passando da entrada para a saída), presa na tela
 * enquanto a pessoa rola:
 *   0. por trás do Consultor: a tela de verdade do Consultor (fotos do app, algoritmoConsultor.ts) vira um espaço com
 *      profundidade, a câmera avança por dentro dela e chega na rede, que já estava rodando atrás;
 *   1. lê o extrato e a planilha: uma luz passa por um PDF do banco e por uma planilha; o texto de cada linha sai do
 *      documento já limpo, entra num fio da rede, corre por ele e se desfaz em cubinhos de dados na cor do que é:
 *      verde o que entrou, vermelho o que saiu, amarelo as dívidas (algoritmoDocs.ts);
 *   2. o motor calcula: o sinal corre mais rápido, mais nós acendem e os cubinhos coloridos andam pelos fios;
 *   3. compara: cada cubinho sai da rede e vai para a sua coluna (os verdes nas entradas, os vermelhos nas saídas, os
 *      amarelos nas dívidas), as colunas crescem de baixo para cima e o gráfico se firma de uma vez, da esquerda para
 *      a direita, com uma linha de luz; antes da próxima cena ele volta a ser cubinhos do mesmo jeito;
 *   4. responde: os cubinhos pousam nos traços da tela do Consultor (as letras, o círculo da nota, as barras) e ela
 *      acende de cima para baixo no lugar deles (algoritmoTela.ts). Termina onde começou.
 *
 * A rede é desenhada em fios e nós; por cima dela correm os cubinhos (a poeira dourada desde o começo e os coloridos,
 * que nascem das linhas lidas). Cada cubinho tem um lugar em cada forma; o desenho mistura as formas conforme o
 * scroll, com um atraso por cubinho (a mudança passa como uma onda). Tudo num <canvas> somando luz.
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

// ─── o gráfico da cena 3: os meses do Resumo do ano (entrou, saiu e as dívidas) e a média do que saiu ───
const MESES = ANO.entrou.length
const MEDIA_SAIU = ANO.saiu.reduce((a, b) => a + b, 0) / MESES
/** As séries, na ordem das categorias dos cubinhos: 0 entrou, 1 saiu, 2 dívidas. */
const SERIES = [ANO.entrou, ANO.saiu, ANO.divida]
const TIPOS = ['entrada', 'saida', 'divida'] as const
const TETO = Math.max(...SERIES.flat())
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
/**
 * Cada coluna é uma pilha de quadradinhos: CUBO de lado, dois por camada (a largura da coluna é 2 × CUBO), com tantas
 * camadas quanto cabem na altura do valor. O gráfico firme tem exatamente o tamanho das pilhas.
 */
const CUBO = 7.5, LARGO_BARRA = CUBO * 2, PASSO_BARRA = 18
/** O meio de cada coluna (mês m, série k). */
const xColuna = (m: number, k: number) => (m / (MESES - 1) - 0.5) * LARGO_GRAF + (k - 1) * PASSO_BARRA
/** Quantas camadas de quadradinhos tem a coluna do mês m na série k. */
const camadas = (m: number, k: number) => Math.max(1, Math.round(((SERIES[k][m] / TETO) * ALTO_GRAF) / CUBO))
/** Cada lugar das pilhas: x, y (o meio do quadradinho), a série e a camada. Os cubinhos coloridos são exatamente estes. */
const LUGARES = (() => {
  const l: { x: number; y: number; cat: number; camada: number }[] = []
  for (let m = 0; m < MESES; m++) {
    for (let k = 0; k < SERIES.length; k++) {
      const x = xColuna(m, k)
      for (let j = 0; j < camadas(m, k); j++) {
        for (const q of [-0.5, 0.5]) l.push({ x: x + q * CUBO, y: BASE_GRAF - (j + 0.5) * CUBO, cat: k, camada: j })
      }
    }
  }
  return l
})()

// ─── o caminho de cada linha lida pela rede: de um nó da entrada, de fio em fio, até a saída ───
// cada linha entra pelo nó da entrada que está na mesma altura dela no documento (a de cima no de cima): a esteira
// sai do papel quase reta
const CAMINHOS = LIDAS.map((_, r) => {
  const [nz, ny] = CAMADAS[0], i = r < LIDAS_PDF.length ? r : r - LIDAS_PDF.length, qtd = r < LIDAS_PDF.length ? LIDAS_PDF.length : LIDAS.length - LIDAS_PDF.length
  let no = Math.round((i / (qtd - 1)) * (ny - 1)) * nz + (i % nz)
  const c = [no]
  for (let k = 0; k < CAMADAS.length - 1; k++) {
    const saem = REDE.elos.filter((e) => e.a === no)
    no = saem[(r * 3 + k) % saem.length].b
    c.push(no)
  }
  return c
})
/** Por quantos fios o texto passa enquanto se desfaz. */
const TRECHOS = 3
/** Quando a luz chega em cada linha (no andamento da leitura, 0 a 1) e quanto dura a viagem do texto dela. */
const INICIO_LINHA = LIDAS.map((_, r) => (r < LIDAS_PDF.length ? 0.06 + r * 0.065 : 0.5 + (r - LIDAS_PDF.length) * 0.065))
const DUR_LINHA = 0.3

interface Frag {
  no: number // na rede: em volta de qual nó (-1 = anda por um fio)
  elo: number; t0: number; vel: number // qual fio, onde começa nele e a que passo anda
  des: V3 // o quanto fica fora do nó ou do fio
  barra: V3 // lugar no gráfico
  tela: V3 // lugar na tela
  atraso: number // a ida para o gráfico passa como uma onda (de baixo para cima em cada coluna)
  atrasoTela: number // a ida para a tela também
  w: number; h: number // tamanho do cubinho
  brilho: number // 0 a 4 (cinco tons)
  cat: number // 0 entrou (verde), 1 saiu (vermelho), 2 dívida (amarelo), 3 poeira dourada (a média e o chão do gráfico)
  linha: number // de qual linha lida ele nasce (-1: a poeira dourada, que está na rede desde o começo)
  pt: number // de que ponto das letras dela
  fase: number
}

/** Os cubinhos e o lugar de cada um em cada forma. */
function montar(N: number, pontos: Float32Array, k4: number, oy: number) {
  const r = sorteio(31)
  const fr: Frag[] = []
  // gráfico: os primeiros cubinhos são os quadradinhos das pilhas (coloridos); o resto, dourado, fica na média e no chão
  const yMedia = BASE_GRAF - (MEDIA_SAIU / TETO) * ALTO_GRAF
  // as linhas lidas de cada tipo (os cubinhos de uma cor nascem das linhas daquela cor, em rodízio)
  const porTipo = TIPOS.map((t) => LIDAS.flatMap((l, i) => (l.tipo === t ? [i] : [])))
  const vez = [0, 0, 0]
  for (let i = 0; i < N; i++) {
    // rede: uns em volta dos nós (uma casquinha em cada um), o resto andando pelos fios
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
    let barra: V3, cat = 3, atraso = r() * 0.3, linha = -1
    if (i < LUGARES.length) {
      // na frente da coluna firme (é ali que eles aparecem quando ela se desfaz)
      const lugar = LUGARES[i]
      barra = [lugar.x, lugar.y, -LARGO_BARRA / 2 + 0.6]
      cat = lugar.cat
      // as pilhas sobem de baixo para cima, camada por camada
      atraso = 0.32 * ((lugar.camada * CUBO) / ALTO_GRAF) + 0.03 * r()
      const lista = porTipo[cat]
      linha = lista[vez[cat]++ % lista.length]
    } else if (r() < 0.4) {
      barra = [(r() - 0.5) * (LARGO_GRAF + 60), yMedia + (r() - 0.5) * 2.5, -LARGO_BARRA]
    } else {
      barra = [(r() - 0.5) * (LARGO_GRAF + 70), BASE_GRAF + 4 + r() * 3, (r() - 0.5) * 90]
    }
    // tela: um ponto dos traços da tela do Consultor (sorteados em algoritmoTela.ts), em px de desenho
    const tela: V3 = [pontos[i * 2] / k4, pontos[i * 2 + 1] / k4 + oy, 0]
    // cubinhos: a maioria pequena; uns 12% maiores (os pacotes de dados)
    const lado = r() < 0.12 ? 3.4 + r() * 2.6 : 1.3 + r() * 2.2
    fr.push({
      no, elo, t0, vel, des, barra, tela, atraso, atrasoTela: r() * 0.35, w: lado, h: lado,
      brilho: Math.min(4, Math.floor(Math.pow(r(), 1.15) * 5)), fase: r() * 10, cat, linha, pt: Math.floor(r() * 700),
    })
  }
  return fr
}

/** Câmera em cada cena: giro e inclinação (rad), aproximação. Na primeira e na última fica de frente: a tela encaixa na tela. */
const CAM = [
  { yaw: 0, pitch: 0, zoom: 1.08 },
  { yaw: -0.14, pitch: 0.18, zoom: 0.62 },
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
 * As cores dos cubinhos (as do gráfico do app): entrou verde, saiu vermelho, dívida amarelo. Cada uma nos mesmos cinco
 * tons do dourado. Na ida para a tela final eles voltam ao dourado em PASSOS degraus.
 */
const PASSOS = 6
const CORES_GRAF: [number, number, number][] = TIPOS.map((t) => COR_TIPO[t])
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
    let docs: { pdf: DocPronto; planilha: DocPronto; textos: TextoLido[] } | null = null, docX = 0, docY = 0, desX = 0, desY = 0, chaveDocs = ''
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
      // todos os quadradinhos das pilhas e mais a poeira dourada (menos no celular: desenha menos)
      const N = LUGARES.length + (celular ? 380 : 650)
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
        dw = Math.min(W - 36, 380); dh = Math.min(dw * 0.66, H * 0.3)
        docX = W / 2; docY = topo + dh / 2
        desX = 0; desY = (docY + dh / 2 + H - 24) / 2 - cy
      } else {
        const esq = Math.min(460, W * 0.36), aw = W - esq - 40
        dw = Math.min(380, aw * 0.4); dh = Math.min(dw * 0.95, H * 0.62)
        docX = esq + 20 + dw / 2; docY = cy
        // a rede vai para a direita: entre o documento e a entrada dela fica o espaço da esteira
        desX = docX + dw / 2 + 170 + 300 * esc * CAM[1].zoom - cx; desY = 0
      }
      dw = Math.round(dw); dh = Math.round(dh)
      const chaveD = `${dw}|${dh}|${document.documentElement.lang}`
      if (chaveD !== chaveDocs) {
        chaveDocs = chaveD
        docs = desenharDocs(dw, dh, Math.min(window.devicePixelRatio || 1, 2), letras)
      }
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
    const xs = new Float32Array(2600), ys = new Float32Array(2600), ss = new Float32Array(2600), vs = new Float32Array(2600), ms = new Float32Array(2600)
    const gs = new Float32Array(2600), ts = new Float32Array(2600), esconde = new Uint8Array(2600)
    // cada linha lida: onde ela está na viagem (linhaT) e a esteira dela, refeita a cada quadro: os pontos do caminho na
    // tela (do papel até a saída da rede, de fio em fio) e quanto já se andou até cada um (px). sCauda é onde está o
    // começo do texto na esteira, sCorte onde as letras se desfazem em cubinhos e eK o tamanho das letras
    const NL = LIDAS.length, MAXP = 32
    const linhaT = new Float32Array(NL), ativo = new Uint8Array(NL)
    const eX = new Float32Array(NL * MAXP), eY = new Float32Array(NL * MAXP), eS = new Float32Array(NL * MAXP), eN = new Uint8Array(NL)
    const sCauda = new Float32Array(NL), sCorte = new Float32Array(NL), sRede = new Float32Array(NL), eK = new Float32Array(NL)
    /** Onde as curvas do papel até a rede terminam: o nó da entrada é o ponto PONTO_REDE da esteira. */
    const PONTO_REDE = 18
    let ex = 0, ey = 0, ea = 0
    /** O ponto da esteira r a s px do começo, em (ex, ey), e a direção dela ali (ea). */
    const naEsteira = (r: number, s: number) => {
      const o = r * MAXP, n = eN[r]
      let j = 1
      while (j < n - 1 && eS[o + j] < s) j++
      const s0 = eS[o + j - 1], s1 = eS[o + j], f = s1 > s0 ? limitar((s - s0) / (s1 - s0)) : 0
      const x0 = eX[o + j - 1], y0 = eY[o + j - 1], x1 = eX[o + j], y1 = eY[o + j]
      ex = mistura(x0, x1, f); ey = mistura(y0, y1, f); ea = Math.atan2(y1 - y0, x1 - x0)
    }
    /** Traça a esteira r de s0 a s1 (para o ctx.stroke). */
    const tracar = (r: number, s0: number, s1: number) => {
      const o = r * MAXP, n = eN[r]
      naEsteira(r, s0); ctx.beginPath(); ctx.moveTo(ex, ey)
      for (let j = 0; j < n; j++) if (eS[o + j] > s0 && eS[o + j] < s1) ctx.lineTo(eX[o + j], eY[o + j])
      naEsteira(r, s1); ctx.lineTo(ex, ey)
    }

    /**
     * O gráfico firme da cena 3: cada coluna uma caixa 3D (o topo mais claro, a frente na cor, os lados mais escuros),
     * o chão, os meses, a linha da média e a legenda. solido(x) diz o quanto a coluna em x já está firme (a linha de luz
     * passa da esquerda para a direita para firmar e de novo para desfazer).
     */
    const legenda = [tx('Entradas'), tx('Saídas'), tx('Dívidas')]
    const desenharGrafico = (solido: (x: number) => number, fazendo: number, desfazendo: number, xFaz: number, xDesfaz: number) => {
      const geral = suave(0, 0.35, fazendo) * (1 - suave(0.65, 1, desfazendo))
      ctx.save()
      ctx.globalCompositeOperation = 'source-over'
      const L = LARGO_GRAF / 2 + 44, y0 = BASE_GRAF
      // o chão: um plano bem leve, com uma linha por mês
      const chao = [[-L, -46], [L, -46], [L, 46], [-L, 46]].map(([x, z]) => proj(x, y0 + 1, z))
      ctx.globalAlpha = geral
      ctx.beginPath(); chao.forEach((P, i) => (i ? ctx.lineTo(P.x, P.y) : ctx.moveTo(P.x, P.y))); ctx.closePath()
      ctx.fillStyle = 'rgba(255,255,255,0.035)'; ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1; ctx.stroke()
      ctx.beginPath()
      for (let m = 0; m < MESES; m++) {
        const x = xColuna(m, 1), A = proj(x, y0 + 1, -46), B = proj(x, y0 + 1, 46)
        ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y)
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.stroke()
      // as colunas, da mais longe para a mais perto; em cada uma, as faces de trás antes das da frente
      const caixas: { c: { x: number; y: number; s: number }[]; a: number; k: number; s: number }[] = []
      for (let m = 0; m < MESES; m++) {
        for (let k = 0; k < SERIES.length; k++) {
          const x = xColuna(m, k), a = solido(x)
          if (a <= 0.01) continue
          const alto = camadas(m, k) * CUBO, x0 = x - LARGO_BARRA / 2, x1 = x + LARGO_BARRA / 2, y1 = y0 - alto, z0 = -LARGO_BARRA / 2, z1 = LARGO_BARRA / 2
          const c = ([[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]] as V3[]).map(([px, py, pz]) => proj(px, py, pz))
          caixas.push({ c, a, k, s: proj(x, y0 - alto / 2, 0).s })
        }
      }
      caixas.sort((m, n) => m.s - n.s)
      // as faces: frente, trás, esquerda, direita, topo, base; e o quanto cada uma recebe de luz (vem de cima)
      const FACES: [number[], number][] = [[[0, 1, 2, 3], 1], [[5, 4, 7, 6], 0.7], [[4, 0, 3, 7], 0.62], [[1, 5, 6, 2], 0.62], [[3, 2, 6, 7], 1.35], [[4, 5, 1, 0], 0.4]]
      for (const { c, a, k } of caixas) {
        const [cr, cg, cb] = CORES_GRAF[k]
        const faces = FACES.map(([v, luz]) => ({ v, luz, s: v.reduce((t, i) => t + c[i].s, 0) })).sort((m, n) => m.s - n.s)
        for (const { v, luz } of faces) {
          const tom = (q: number) => Math.round(luz > 1 ? q + (255 - q) * (luz - 1) : q * luz)
          ctx.beginPath(); v.forEach((i, j) => (j ? ctx.lineTo(c[i].x, c[i].y) : ctx.moveTo(c[i].x, c[i].y))); ctx.closePath()
          ctx.globalAlpha = a * 0.94
          ctx.fillStyle = `rgb(${tom(cr)},${tom(cg)},${tom(cb)})`; ctx.fill()
        }
        // a quina de cima pega a luz
        ctx.globalAlpha = a * 0.7
        ctx.beginPath(); [3, 2, 6, 7].forEach((i, j) => (j ? ctx.lineTo(c[i].x, c[i].y) : ctx.moveTo(c[i].x, c[i].y))); ctx.closePath()
        ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 1; ctx.stroke()
      }
      // a média do que saiu: tracejada, na frente das colunas
      const yMedia = y0 - (MEDIA_SAIU / TETO) * ALTO_GRAF
      const M0 = proj(-L + 10, yMedia, -LARGO_BARRA), M1 = proj(L - 10, yMedia, -LARGO_BARRA)
      ctx.globalAlpha = geral
      ctx.setLineDash([6, 5]); ctx.strokeStyle = 'rgba(255,205,130,0.9)'; ctx.lineWidth = 1.4
      ctx.beginPath(); ctx.moveTo(M0.x, M0.y); ctx.lineTo(M1.x, M1.y); ctx.stroke()
      ctx.setLineDash([])
      // os meses, embaixo de cada grupo
      ctx.font = `600 ${celular ? 9.5 : 11}px ${letras.texto}`; ctx.textAlign = 'center'; ctx.textBaseline = 'top'
      ctx.fillStyle = 'rgba(232,238,255,0.62)'
      let baixo = 0
      for (let m = 0; m < MESES; m++) {
        if (celular && m % 2) continue
        const P = proj(xColuna(m, 1), y0 + 12, -46)
        ctx.fillText(MESES_NOME[m].slice(0, 3), P.x, P.y)
        baixo = Math.max(baixo, P.y)
      }
      // a legenda, embaixo do mês mais baixo, no meio
      const Lg = { x: proj(0, y0 + 12, -46).x, y: baixo + (celular ? 26 : 32) }
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.font = `600 ${celular ? 10.5 : 12}px ${letras.texto}`
      let lx = Lg.x - legenda.reduce((t, l) => t + 31 + ctx.measureText(l).width, -16) / 2
      legenda.forEach((t, k) => {
        const [cr, cg, cb] = CORES_GRAF[k]
        ctx.fillStyle = `rgb(${cr},${cg},${cb})`; ctx.beginPath(); ctx.roundRect(lx, Lg.y - 5, 10, 10, 2.5); ctx.fill()
        ctx.fillStyle = 'rgba(240,244,255,0.82)'; ctx.fillText(t, lx + 15, Lg.y)
        lx += 15 + ctx.measureText(t).width + 16
      })
      // a linha de luz que firma (e depois desfaz) o gráfico: um plano fino de pé, do chão até acima da coluna mais alta
      ctx.globalCompositeOperation = 'lighter'
      for (const [xl, f] of [[xFaz, fazendo], [xDesfaz, desfazendo]]) {
        if (f <= 0 || f >= 1) continue
        const A = proj(xl, y0 + 4, -50), B = proj(xl, y0 - ALTO_GRAF - 16, -50), C = proj(xl, y0 - ALTO_GRAF - 16, 50), D = proj(xl, y0 + 4, 50)
        const plano = ctx.createLinearGradient(A.x, A.y, B.x, B.y)
        plano.addColorStop(0, 'rgba(255,240,210,0.5)'); plano.addColorStop(1, 'rgba(255,240,210,0)')
        ctx.globalAlpha = Math.sin(Math.PI * f)
        ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.lineTo(C.x, C.y); ctx.lineTo(D.x, D.y); ctx.closePath()
        ctx.fillStyle = plano; ctx.fill()
        ctx.strokeStyle = 'rgba(255,245,225,0.95)'; ctx.lineWidth = 1.6
        ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke()
      }
      ctx.restore()
    }

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

      // cada linha lida: de 0 (a luz chega nela) a 1 (o texto já se desfez num fio da rede); depois disso continua
      // contando (os cubinhos dela ainda vão para o lugar deles na rede)
      let chegada = 0
      for (let r = 0; r < NL; r++) {
        linhaT[r] = ((p - 0.2) / 0.2 - INICIO_LINHA[r]) / DUR_LINHA
        chegada += Math.max(0, 1 - Math.abs(linhaT[r] - 0.45) / 0.08)
      }
      chegada = Math.min(1, chegada)
      // o documento: chega, gira do PDF para a planilha e sai
      const vira = limitar((u1 - 0.42) / 0.08)
      const chegaDoc = suave(0, 0.08, u1), saiDoc = suave(0.9, 0.99, u1)
      const docE = mistura(0.92, 1, chegaDoc) * (1 - 0.12 * saiDoc)

      // as formas ao longo do scroll: rede → gráfico → tela. Cada cubinho muda com um atraso
      const g0 = limitar((p - 0.58) / 0.12), v0 = limitar((p - 0.8) / 0.1), raioK = 1 / (1 + Z_REDE - mg.cam)
      const forma = (fx: Frag, i: number): V3 => {
        let ex: number, ey: number, ez: number
        if (fx.no >= 0) { ex = rx[fx.no]; ey = ry[fx.no]; ez = rz[fx.no] }
        else {
          const e = REDE.elos[fx.elo], u = fx.t0 + fluxo * fx.vel, k = u - Math.floor(u)
          ex = mistura(rx[e.a], rx[e.b], k); ey = mistura(ry[e.a], ry[e.b], k); ez = mistura(rz[e.a], rz[e.b], k)
        }
        ex += fx.des[0] * raioK; ey += fx.des[1] * raioK; ez += fx.des[2] * raioK
        const g = suave(fx.atraso, fx.atraso + 0.55, g0)
        const v = suave(fx.atrasoTela, fx.atrasoTela + 0.55, v0)
        gs[i] = g; vs[i] = v
        // o tamanho: na rede, poeira (os coloridos um pouco maiores); no gráfico os coloridos são os quadradinhos das
        // pilhas, encaixados um no outro; na tela, traços finos
        const naRede = fx.w * (fx.cat < 3 ? 0.95 : 0.42), noGraf = fx.cat < 3 ? CUBO - 1 : fx.w
        ts[i] = mistura(mistura(naRede, noGraf, g), fx.w * 0.65, v)
        ms[i] = ts[i] / fx.w
        let x = mistura(ex, fx.barra[0], g), y = mistura(ey, fx.barra[1], g), z = mistura(ez, fx.barra[2], g)
        // para o gráfico, um arco por cima: cada cubinho sobe da rede e desce na sua coluna
        y -= Math.sin(Math.PI * g) * 70
        x = mistura(x, fx.tela[0], v); y = mistura(y, fx.tela[1], v); z = mistura(z, fx.tela[2], v)
        // para a tela, uma curva leve
        if (v > 0 && v < 1) {
          const meio = Math.sin(Math.PI * v), a = fx.fase + s * 0.8
          x += Math.cos(a) * 40 * meio; y += Math.sin(a * 1.3) * 30 * meio; z += Math.sin(a) * 40 * meio
        }
        return [x, y, z]
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, H)
      ctx.globalCompositeOperation = 'lighter'

      // névoa de luz atrás (mais forte com a rede inteira)
      const centro = proj(0, 0, 0)
      const redeCheia = (1 - suave(0.58, 0.68, p)) * (1 - 0.8 * oculto)
      const th = (720 + 160 * calc) * esc * zoom
      ctx.globalAlpha = Math.min(1, 0.2 + 0.3 * redeCheia + 0.3 * pres[n - 1] + 0.3 * pres[0] + 0.3 * chegada * pres[1])
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
      }

      // a esteira de cada linha lida: sai de baixo do papel (pela borda direita; no celular, pela de baixo), faz a curva
      // até um nó da entrada e segue de fio em fio. O texto anda deitado nela e se desfaz no meio do primeiro fio
      for (let r = 0; r < NL; r++) {
        ativo[r] = 0
        const tr = linhaT[r]
        if (!docs || tr <= 0 || tr > 1.6) continue
        const pdf = r < LIDAS_PDF.length, dl = pdf ? docs.pdf : docs.planilha, i = pdf ? r : r - LIDAS_PDF.length
        const T = docs.textos[r], k = celular ? 0.8 : 1, wk = T.w * k
        const o = r * MAXP, cam = CAMINHOS[r], ax = nx[cam[0]], ay = ny[cam[0]]
        let n = 0
        const ponto = (x: number, y: number) => {
          eX[o + n] = x; eY[o + n] = y
          eS[o + n] = n ? eS[o + n - 1] + Math.hypot(x - eX[o + n - 1], y - eY[o + n - 1]) : 0
          n++
        }
        // o começo fica embaixo do papel (o texto inteiro escondido nele), depois a borda e um trecho reto para fora
        let bx: number, by: number, c1x: number, c1y: number
        if (celular) {
          const x0 = docX - (dl.w / 2) * docE + 30 + (i % 3) * 24, yb = docY + (dl.h / 2) * docE
          ponto(x0, yb - wk - 20); ponto(x0, yb - 4); ponto(x0, yb + 18)
          bx = x0; by = yb + 18; c1x = x0; c1y = yb + 80
        } else {
          const xr = docX + (dl.w / 2) * docE, y = docY + (dl.linhas[i] - dl.h / 2) * docE
          ponto(xr - wk - 20, y); ponto(xr - 4, y); ponto(xr + 30, y)
          bx = xr + 30; by = y; c1x = bx + Math.max(40, (ax - bx) * 0.5); c1y = y
        }
        // a curva até o nó da entrada, suave (chega nele na direção dos fios)
        const c2x = ax - Math.max(40, (ax - bx) * 0.5), c2y = ay
        for (let q = 1; q <= PONTO_REDE - 2; q++) {
          const u = q / (PONTO_REDE - 2), a = 1 - u
          ponto(a * a * a * bx + 3 * a * a * u * c1x + 3 * a * u * u * c2x + u * u * u * ax, a * a * a * by + 3 * a * a * u * c1y + 3 * a * u * u * c2y + u * u * u * ay)
        }
        for (let q = 1; q < cam.length; q++) ponto(nx[cam[q]], ny[cam[q]])
        eN[r] = n; eK[r] = k
        sRede[r] = eS[o + PONTO_REDE]
        sCorte[r] = mistura(eS[o + PONTO_REDE], eS[o + PONTO_REDE + 1], 0.5)
        // a esteira começa devagar e depois anda sempre igual; o fim do texto passa do ponto do corte perto de tr = 0,95
        const u = tr / 0.95, f = u < 0.2 ? (u * u) / 0.4 : u - 0.1
        sCauda[r] = (f / 0.9) * sCorte[r]
        // os nós acendem quando a frente do texto (ou dos cubinhos dele) passa
        const frente = sCauda[r] + wk
        for (let q = 0; q <= TRECHOS; q++) aceso[cam[q]] = Math.max(aceso[cam[q]], 1 - Math.abs(frente - eS[o + PONTO_REDE + q]) / 50)
        ativo[r] = 1
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
        ctx.strokeStyle = 'rgba(255,205,130,0.6)'; ctx.lineWidth = 1.1; ctx.stroke(aneis)
        ctx.fillStyle = 'rgba(255,190,100,0.75)'; ctx.fill(miolos)
        ctx.fillStyle = 'rgba(255,246,224,1)'; ctx.fill(cheios)
        ctx.globalAlpha = 1
      }

      // a tela acende de cima para baixo depois que os cubinhos pousam: acima da linha de luz já é a tela; os
      // cubinhos que ficaram para trás dela somem, os que estão logo abaixo da linha brilham mais
      const kT = zoom / ZOOM_TELA
      const tlx = cx - (tela ? tela.w : 0) * kT / 2, tly = yTela + (centro.y - cy - offY) - (tela ? tela.h : 0) * kT / 2
      const acende = suave(0.908, 0.968, p)
      const yLuz = tela ? tly - 30 + acende * (tela.h * kT + 60) : -1e9

      // o gráfico firme: depois que os cubinhos pousam, uma linha de luz passa da esquerda para a direita e as colunas
      // ficam sólidas no lugar deles; antes da tela final ela passa de novo e as colunas voltam a ser cubinhos
      const fazendo = limitar((p - 0.69) / 0.05), desfazendo = limitar((p - 0.772) / 0.026)
      const ida = -LARGO_GRAF / 2 - 70, volta = LARGO_GRAF / 2 + 70
      const xFaz = mistura(ida, volta, fazendo), xDesfaz = mistura(ida, volta, desfazendo)
      const solido = (x: number) => suave(x - 22, x + 22, xFaz) * (1 - suave(x - 22, x + 22, xDesfaz))
      if (fazendo > 0 && desfazendo < 1) desenharGrafico(solido, fazendo, desfazendo, xFaz, xDesfaz)

      // os cubinhos: projeta todos, depois pinta por tom (menos trocas de cor)
      const N = fr.length, textos = docs?.textos
      for (let i = 0; i < N; i++) {
        const fx = fr[i]
        const [x, y, z] = forma(fx, i)
        const P = proj(x, y, z)
        xs[i] = P.x; ys[i] = P.y; ss[i] = P.s; esconde[i] = 0
        // os que nascem de uma linha lida: só existem depois que a letra deles passa pelo ponto do corte; dali seguem
        // pela esteira e, aos poucos, vão para o lugar deles na rede
        if (fx.linha >= 0 && textos) {
          const r = fx.linha
          if (linhaT[r] <= 0) { esconde[i] = 1; continue }
          if (!ativo[r]) continue
          const T = textos[r], k = eK[r], lx = T.pontos[fx.pt * 2], ly = T.pontos[fx.pt * 2 + 1]
          const sp = sCauda[r] + (lx + T.w / 2) * k, d = sp - sCorte[r]
          if (d < 0) { esconde[i] = 1; continue }
          const kh = suave(0, 260, d)
          if (kh < 1) {
            naEsteira(r, sp)
            const alt = (T.h / 2 - ly) * k, solta = suave(0, 80, d) * 12
            const bx = ex + Math.sin(ea) * alt + Math.cos(fx.fase * 7) * solta, by = ey - Math.cos(ea) * alt + Math.sin(fx.fase * 5) * solta
            xs[i] = mistura(bx, xs[i], kh); ys[i] = mistura(by, ys[i], kh); ss[i] = mistura(1.1, ss[i], kh)
          }
        }
      }
      const pisca = Math.floor(s * 7)
      // na ida para a tela final, os coloridos voltam ao dourado
      const fimTela = suave(0.8, 0.86, p)
      const passoCor = Math.round((1 - fimTela) * (PASSOS - 1))
      const varrendo = (fazendo > 0 && fazendo < 1) || (desfazendo > 0 && desfazendo < 1)
      const grupos = new Map<string, number[]>()
      for (let i = 0; i < N; i++) {
        if (esconde[i]) continue
        const fx = fr[i]
        // alguns piscam: sobem de tom de tempos em tempos
        let tom = reduzir ? fx.brilho : Math.min(4, fx.brilho + ((i * 7 + pisca) % 11 === 0 ? 2 : 0))
        // os coloridos nunca no tom mais apagado: a cor tem que aparecer no meio da poeira dourada
        if (fx.cat < 3) tom = Math.max(2, tom)
        // no gráfico firme, os cubinhos que viraram coluna somem; os que estão na linha de luz brilham
        if (gs[i] > 0.995 && vs[i] < 0.005) {
          if (solido(fx.barra[0]) > 0.5) continue
          // empilhados, todos no mesmo tom (a pilha fica lisa)
          if (fx.cat < 3) tom = 3
          if (varrendo && (Math.abs(fx.barra[0] - xFaz) < 30 || Math.abs(fx.barra[0] - xDesfaz) < 30)) tom = 4
        }
        if (acende > 0 && vs[i] > 0.98) {
          if (ys[i] < yLuz - 3) continue
          if (ys[i] < yLuz + 34) tom = 4
        }
        const chave = fx.cat < 3 && passoCor > 0 ? `${fx.cat}.${tom}.${passoCor}` : `d${tom}`
        let g = grupos.get(chave)
        if (!g) { g = []; grupos.set(chave, g) }
        g.push(i)
      }
      // escondidos atrás da tela no começo, os cubinhos ficam apagados
      ctx.globalAlpha = 1 - 0.85 * oculto
      grupos.forEach((idx, chave) => {
        if (chave[0] === 'd') ctx.fillStyle = TONS[Number(chave.slice(1))]
        else { const [c, tom, passo] = chave.split('.').map(Number); ctx.fillStyle = PALETA[c][tom][passo] }
        for (const i of idx) {
          // pousados na tela, ficam menores (viram os traços das letras)
          const lado = ss[i] * esc * zoom * ts[i]
          ctx.fillRect(xs[i] - lado / 2, ys[i] - lado / 2, lado + 0.4, lado + 0.4)
        }
      })
      // pontos mais quentes com brilho (um a cada 14 cubinhos)
      ctx.globalAlpha = 0.6 * (1 - 0.85 * oculto)
      for (let i = 0; i < N; i += 14) {
        if (esconde[i] || (acende > 0 && vs[i] > 0.98 && ys[i] < yLuz - 3)) continue
        if (gs[i] > 0.9 && vs[i] < 0.1 && fr[i].cat < 3) continue
        const tam = (10 + 8 * Math.sin(s * 2 + fr[i].fase)) * ss[i] * esc * ms[i]
        ctx.drawImage(sprPonto, xs[i] - tam / 2, ys[i] - tam / 2, tam, tam)
      }
      ctx.globalAlpha = 1

      // cena 0: a tela do Consultor de verdade e, rolando, a câmera entrando nela
      if (real && desm < 1 && pres[0] > 0) {
        // sem moldura: a tela fica no plano da página, com as beiradas se apagando nela
        desenharConsultor(ctx, real, realX, realY, realS, desm)
        ctx.globalAlpha = 1
        ctx.globalCompositeOperation = 'lighter'
      }

      // cena 1: o documento (o PDF, que gira e vira a planilha), a luz que lê as linhas e o texto de cada uma, que sai
      // dele, corre por um fio da rede e se desfaz em cubinhos
      if (docs) {
        // as esteiras: o trilho na cor da linha, do papel até a rede, e mais forte o trecho que o texto (ou os cubinhos
        // dele) já andou
        const vez = Math.max(pres[1], pres[2])
        ctx.globalCompositeOperation = 'lighter'
        for (let r = 0; r < NL; r++) {
          if (!ativo[r]) continue
          const tr = linhaT[r], o = r * MAXP, [cr, cg, cb] = docs.textos[r].cor
          const a = vez * suave(0, 0.05, tr) * (1 - suave(1, 1.4, tr))
          if (a <= 0.01) continue
          ctx.globalAlpha = a
          tracar(r, eS[o + 1], sRede[r]); ctx.strokeStyle = `rgba(${cr},${cg},${cb},0.22)`; ctx.lineWidth = 1; ctx.stroke()
          tracar(r, eS[o + 1], Math.min(eS[o + eN[r] - 1], sCauda[r] + docs.textos[r].w * eK[r] + 24))
          ctx.strokeStyle = `rgba(${cr},${cg},${cb},0.2)`; ctx.lineWidth = 5; ctx.stroke()
          ctx.strokeStyle = `rgba(${cr},${cg},${cb},0.9)`; ctx.lineWidth = 1.4; ctx.stroke()
        }
        // o texto, deitado na esteira: cada letra no ponto onde está e virada na direção do trilho; no ponto do corte
        // ela se apaga (ali nascem os cubinhos dela)
        ctx.globalCompositeOperation = 'source-over'
        ctx.textBaseline = 'middle'; ctx.textAlign = 'left'
        for (let r = 0; r < NL; r++) {
          if (!ativo[r] || sCauda[r] >= sCorte[r] + 10) continue
          const T = docs.textos[r], k = eK[r], al = vez * suave(0, 0.03, linhaT[r]), [cr, cg, cb] = T.cor, borda = eS[r * MAXP + 1]
          ctx.shadowColor = `rgba(${cr},${cg},${cb},0.6)`; ctx.shadowBlur = 7 * dpr
          let fonte = ''
          for (const gl of T.glifos) {
            const sg = sCauda[r] + (gl.x + gl.w / 2) * k
            // cada letra só aparece quando passa pela borda do papel (antes disso está embaixo dele)
            const a = al * suave(borda - 4, borda + 2, sg) * (1 - suave(sCorte[r] - 3, sCorte[r] + 9, sg))
            if (a <= 0.01) continue
            naEsteira(r, sg)
            const c = Math.cos(ea), sn = Math.sin(ea), alt = (T.h / 2) * k
            ctx.setTransform(dpr * c * k, dpr * sn * k, -dpr * sn * k, dpr * c * k, dpr * (ex + sn * alt), dpr * (ey - c * alt))
            ctx.globalAlpha = a
            if (gl.fonte !== fonte) { fonte = gl.fonte; ctx.font = fonte }
            ctx.fillStyle = gl.cor
            ctx.fillText(gl.c, -gl.w / 2, 0)
          }
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        }
        ctx.shadowBlur = 0
        ctx.globalAlpha = 1

        const doc = vira < 0.5 ? docs.pdf : docs.planilha
        const ini = vira < 0.5 ? 0 : LIDAS_PDF.length, qtd = vira < 0.5 ? LIDAS_PDF.length : LIDAS.length - LIDAS_PDF.length
        const a = pres[1] * chegaDoc * (1 - saiDoc)
        const largura = Math.abs(Math.cos(Math.PI * vira))
        if (a > 0.01) {
          ctx.save()
          ctx.translate(docX, docY); ctx.scale(docE * Math.max(0.02, largura), docE)
          ctx.globalAlpha = a
          ctx.globalCompositeOperation = 'source-over'
          ctx.drawImage(doc.img, -doc.w / 2 - doc.m, -doc.h / 2 - doc.m, doc.w + doc.m * 2, doc.h + doc.m * 2)
          // as linhas já lidas ficam marcadas na cor do que são
          const passo = (doc.fimLinhas - doc.topoLinhas) / qtd
          for (let i = 0; i < qtd; i++) {
            const lida = limitar(linhaT[ini + i] * 10)
            if (lida <= 0) continue
            const [cr, cg, cb] = docs.textos[ini + i].cor
            ctx.fillStyle = `rgba(${cr},${cg},${cb},${(0.13 * lida).toFixed(3)})`
            ctx.fillRect(-doc.w / 2 + 8, doc.linhas[i] - doc.h / 2 - passo / 2 + 1, doc.w - 16, passo - 2)
          }
          // a luz que lê: passa por cada linha na hora em que ela é lida
          const b = ((u1 - INICIO_LINHA[ini]) / 0.065 + 0.5) / qtd
          if (b > 0 && b < 1) {
            const yb = doc.topoLinhas + b * (doc.fimLinhas - doc.topoLinhas) - doc.h / 2
            const rastro = ctx.createLinearGradient(0, yb - 36, 0, yb)
            rastro.addColorStop(0, 'rgba(60,200,255,0)'); rastro.addColorStop(1, 'rgba(60,200,255,0.16)')
            ctx.fillStyle = rastro; ctx.fillRect(-doc.w / 2, yb - 36, doc.w, 36)
            ctx.fillStyle = 'rgba(40,170,240,0.95)'; ctx.fillRect(-doc.w / 2 - 12, yb - 1, doc.w + 24, 2)
            ctx.globalCompositeOperation = 'lighter'
            ctx.globalAlpha = a * 0.5; ctx.fillStyle = 'rgba(120,210,255,0.6)'; ctx.fillRect(-doc.w / 2 - 12, yb - 5, doc.w + 24, 10)
          }
          ctx.restore()
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
        const x = xColuna(c.mes, 1), alto = (Math.max(...SERIES.map((v) => v[c.mes])) / TETO) * ALTO_GRAF
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
