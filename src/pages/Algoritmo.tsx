import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Icone } from '../components/Icone'
import { MESES_NOME } from '../lib/format'
import { semMovimento } from '../lib/tema'
import { tx } from '../lib/textos'
import { ANO } from './apresentacaoCena'
import { alturaIdeal, desenharTela, type TelaPronta } from './algoritmoTela'
import { ATRAVESSA, carregarConsultor, COR_PAINEL, desenharConsultor, idiomaDasFotos, type ConsultorReal } from './algoritmoConsultor'
import { montarCamadas, type Camada } from './algoritmoCamadas'
import { COR_TIPO, desenharDocs, LIDAS, LIDAS_PDF, type DocPronto, type TextoLido } from './algoritmoDocs'
import { aoPedirConsultor, publicarPassagem } from './passagem'
import './algoritmo.css'

/**
 * "O motor do OpusCash": começa na tela do Consultor, a câmera entra nela e chega no que roda lá no fundo, uma rede
 * neural em 3D (camadas de nós ligados por fios, com o sinal passando da entrada para a saída), presa na tela
 * enquanto a pessoa rola:
 *   0. por trás do Consultor: a tela de verdade do Consultor (fotos do app, algoritmoConsultor.ts), inteira; a câmera
 *      vira para a fresta entre dois cartões, que escurece conforme ela chega, e atravessa. Do outro lado ela está
 *      dentro de um fio de dados (um túnel de anéis de quadradinhos), com as linhas do extrato vindo pelas paredes e
 *      se desfazendo em cubinhos; depois sai do túnel e se afasta: a rede inteira, presa nas costas da tela do
 *      Consultor por uma teia de fios;
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
// ─── a sala: o servidor onde a rede roda. Um corredor largo, com uma fileira de racks de cada lado sumindo no fundo,
// chão com grade e o reflexo da rede, e duas faixas de luz no teto. Não gira com a rede: ela flutua dentro dele ───
const CHAO = 270, TETO_SALA = -560, LADO_SALA = 1250, LONGE = 4600
/** Os racks de um lado (z de onde começa cada um, de frente para o corredor), em grupos de 6 com um vão entre eles. */
const RACKS = Array.from({ length: 44 }, (_, i) => -420 + i * 86 + Math.floor(i / 6) * 130).filter((z) => z < LONGE - 200)
const RACK_LARGO = 74, GAVETAS = 14
/** A névoa: de 1 (perto) a 0 (no fundo do corredor). */
const nevoa = (z: number) => 1 - suave(700, LONGE, z)

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
  // de lado e um pouco de cima: as costas da tela, atrás da rede, aparecem em perspectiva
  { yaw: 0.45, pitch: 0.12, zoom: 0.75 },
  { yaw: -0.14, pitch: 0.18, zoom: 0.62 },
  { yaw: -0.22, pitch: 0.3, zoom: 1.05 },
  { yaw: 0.26, pitch: 0.12, zoom: 1.0 },
  { yaw: 0, pitch: 0, zoom: 1.08 },
]
const ZOOM_TELA = CAM[CAM.length - 1].zoom
/** Na cena 0, quando a câmera sai de dentro do fio do túnel (antes disso ela anda nele; ATRAVESSA é a fresta). */
const SAI = 0.83
/**
 * A abertura (a fresta, o túnel e a saída) tem mais coisa que as outras cenas: ela fica com ABERTURA da rolagem (as
 * outras dividem o resto). O desenho trabalha com o andamento "por cena" (cada uma 1/5); estas duas funções convertem.
 */
const ABERTURA = 0.5
const porCena = (r: number) => (r < ABERTURA ? (r / ABERTURA) * 0.2 : 0.2 + ((r - ABERTURA) / (1 - ABERTURA)) * 0.8)
const daRolagem = (v: number) => (v < 0.2 ? (v / 0.2) * ABERTURA : ABERTURA + ((v - 0.2) / 0.8) * (1 - ABERTURA))

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
/** As cores de cada tipo no claro: mais fortes, para se lerem no fundo branco (o amarelo vira âmbar). */
const CORES_GRAF_CLARO: [number, number, number][] = [[16, 160, 95], [226, 54, 54], [196, 146, 0]]
/**
 * O claro é o escuro invertido: papel creme no lugar do preto, nanquim (preto quente) no lugar da luz dourada para o
 * desenho, e uma cor só de destaque, o laranja, onde no escuro a luz é mais forte (sinais, nós acesos, LEDs). Verde,
 * vermelho e mostarda só nos dados (entrou, saiu, dívida), como no escuro.
 */
const NANQUIM = '30,24,18', LARANJA: [number, number, number] = [222, 98, 10]
/** A poeira de dados no claro: nanquim, do cinza ao preto cheio. */
const TONS_CLARO = [0.3, 0.48, 0.66, 0.84, 1].map((a) => `rgba(${NANQUIM},${a})`)
/** A cor dos sinais no claro: só o laranja (no escuro, a luz dourada). */
const SINAIS_CLARO: [number, number, number][] = [LARANJA]
/** A PALETA do claro: do tom da poeira (nanquim) até a cor do tipo, sem clarear para o branco. */
const PALETA_CLARO = CORES_GRAF_CLARO.map((c) => TONS_CLARO.map((tom) => {
  const [r, g, b, a] = tom.slice(5, -1).split(',').map(Number)
  return Array.from({ length: PASSOS }, (_, k) => {
    const t = k / (PASSOS - 1)
    return `rgba(${Math.round(r + (c[0] - r) * t)},${Math.round(g + (c[1] - g) * t)},${Math.round(b + (c[2] - b) * t)},${Math.max(a, 0.6 + 0.4 * t)})`
  })
}))
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
    // o tema: muda as cores do desenho (P, abaixo), as fotos da tela do Consultor, os documentos e a tela final
    let claro = document.documentElement.dataset.tema === 'claro'
    const comparas = [...sticky.querySelectorAll<HTMLElement>('.ag-compara')]
    const contador = sticky.querySelector<HTMLElement>('[data-relacoes]')
    /**
     * As cores do desenho em cada tema. No escuro, luz dourada somada (composição 'lighter') sobre o preto; no claro,
     * cores por cima do fundo claro ('source-over'): o azul e o verde-água da marca na rede, e as cores de cada tipo
     * mais fortes. Trocou o tema, troca a paleta (e o que já foi desenhado com ela é refeito).
     */
    const paleta = (c: boolean) => c ? {
      luz: 'source-over' as GlobalCompositeOperation, tons: TONS_CLARO, cubos: PALETA_CLARO, tipos: CORES_GRAF_CLARO,
      halo: brilho(256, [[0, 'rgba(222,98,10,0.12)'], [0.35, 'rgba(222,98,10,0.05)'], [1, 'rgba(222,98,10,0)']]),
      ponto: brilho(48, [[0, `rgba(${NANQUIM},0.45)`], [0.3, `rgba(${NANQUIM},0.12)`], [1, `rgba(${NANQUIM},0)`]]),
      // o brilho e as cores do sinal (na ponta do sinal e em volta do nó aceso)
      pontos: SINAIS_CLARO.map(([r, g, b]) => brilho(48, [[0, `rgba(${r},${g},${b},0.95)`], [0.25, `rgba(${r},${g},${b},0.5)`], [0.6, `rgba(${r},${g},${b},0.12)`], [1, `rgba(${r},${g},${b},0)`]])),
      sinais: SINAIS_CLARO.map(([r, g, b]) => [`rgba(${r},${g},${b},0.2)`, `rgb(${r},${g},${b})`]),
      fioFundo: `rgba(${NANQUIM},0.3)`, fioFrente: `rgba(${NANQUIM},0.78)`, vivoBrilho: '', vivo: '',
      anel: `rgba(${NANQUIM},0.9)`, cheio: `rgba(${NANQUIM},1)`, miolo: `rgba(${NANQUIM},0.88)`, dado: `rgba(${NANQUIM},1)`, noFundo: 'rgba(251,247,239,0.97)',
      tunel: [0.14, 0.3, 0.55, 0.8].map((a) => `rgba(${NANQUIM},${a})`),
      camada: [`rgb(${NANQUIM})`, `rgba(${NANQUIM},0.2)`, 'rgb(196,80,8)', 'rgb(16,150,90)', 'rgb(220,48,48)', 'rgb(190,140,0)'],
      tunelQuad: ['', ...[0.5, 0.68, 0.84, 1].map((a) => `rgba(${NANQUIM},${a})`)],
      chao: `rgba(${NANQUIM},0.04)`, chaoBorda: `rgba(${NANQUIM},0.16)`, chaoMes: `rgba(${NANQUIM},0.06)`, media: 'rgba(222,98,10,0.95)',
      mes: `rgba(${NANQUIM},0.6)`, legenda: `rgba(${NANQUIM},0.82)`, varre: ['rgba(222,98,10,0.3)', 'rgba(222,98,10,0)', 'rgba(222,98,10,0.95)'],
      nomeTexto: `rgb(${NANQUIM})`, fresta: 'rgb(246,240,228)', brilhoFresta: '222,98,10',
      telaRastro: ['rgba(222,98,10,0)', 'rgba(222,98,10,0.2)'], telaLinha: ['rgba(222,98,10,0)', 'rgba(222,98,10,0.9)'], reflexo: 'rgba(255,255,255,0.4)',
      sala: { face: 'rgba(252,248,240,0.8)', borda: `rgba(${NANQUIM},0.16)`, led: `rgba(${NANQUIM},0.26)`, aceso: ['rgba(222,98,10,0.85)', 'rgba(222,98,10,1)'], chao: `rgba(${NANQUIM},0.08)`, teto: `rgba(${NANQUIM},0.16)`, espelho: 0.2 },
    } : {
      luz: 'lighter' as GlobalCompositeOperation, tons: TONS, cubos: PALETA, tipos: CORES_GRAF,
      halo: brilho(256, [[0, 'rgba(255,200,110,0.55)'], [0.25, 'rgba(255,150,40,0.22)'], [0.6, 'rgba(255,120,20,0.06)'], [1, 'rgba(255,100,10,0)']]),
      ponto: brilho(48, [[0, 'rgba(255,248,225,1)'], [0.2, 'rgba(255,200,90,0.9)'], [0.55, 'rgba(255,150,40,0.22)'], [1, 'rgba(255,130,20,0)']]),
      pontos: [] as HTMLCanvasElement[], sinais: [] as string[][],
      fioFundo: 'rgba(255,170,70,0.13)', fioFrente: 'rgba(255,190,100,0.3)', vivoBrilho: 'rgba(255,170,60,0.2)', vivo: 'rgba(255,232,180,0.9)',
      anel: 'rgba(255,205,130,0.6)', cheio: 'rgba(255,246,224,1)', miolo: 'rgba(255,190,100,0.75)', dado: 'rgba(255,246,224,1)', noFundo: '',
      camada: ['rgba(255,247,230,1)', 'rgba(255,185,95,0.34)', 'rgba(255,196,107,1)', 'rgb(46,214,128)', 'rgb(255,92,108)', 'rgb(255,214,10)'],
      tunelQuad: TONS,
      tunel: ['rgba(255,140,40,0.1)', 'rgba(255,165,65,0.22)', 'rgba(255,190,105,0.42)', 'rgba(255,224,165,0.62)'],
      chao: 'rgba(255,255,255,0.035)', chaoBorda: 'rgba(255,255,255,0.12)', chaoMes: 'rgba(255,255,255,0.05)', media: 'rgba(255,205,130,0.9)',
      mes: 'rgba(232,238,255,0.62)', legenda: 'rgba(240,244,255,0.82)', varre: ['rgba(255,240,210,0.5)', 'rgba(255,240,210,0)', 'rgba(255,245,225,0.95)'],
      nomeTexto: '#f4f7ff', fresta: 'rgb(3,4,8)', brilhoFresta: '255,190,100',
      telaRastro: ['rgba(255,170,60,0)', 'rgba(255,190,90,0.38)'], telaLinha: ['rgba(255,200,110,0)', 'rgba(255,220,150,0.95)'], reflexo: 'rgba(255,220,160,0.07)',
      sala: { face: 'rgba(255,190,120,0.035)', borda: 'rgba(255,175,90,0.13)', led: 'rgba(255,165,70,0.3)', aceso: ['rgba(255,190,90,0.6)', 'rgba(255,240,205,1)'], chao: 'rgba(255,170,80,0.09)', teto: 'rgba(255,200,120,0.22)', espelho: 0.2 },
    }
    let P = paleta(claro)

    let W = 0, H = 0, dpr = 1, cx = 0, cy = 0, esc = 1, celular = false, reduzir = false
    let fr: Frag[] = [], chaveTela = ''
    const saidaFio = new Float32Array(REDE.elos.length), saidaNo = new Float32Array(REDE.nos.length)
    // a tela do Consultor (cena 4): desenhada em px de CSS, centrada em (cx, yTela). No computador fica no lugar da
    // rede; no celular, entre o texto e os selos
    let tela: TelaPronta | null = null, yTela = 0
    // as camadas do túnel (algoritmoCamadas.ts) e o espaço que elas têm na cena
    let fatias: Camada[] = [], chaveCamadas = '', areaW = 0, areaH = 0
    // a abertura: a foto do Consultor de verdade (carrega quando a seção chega perto), em (realX, realY) com escala realS
    // realE: o quanto a tela precisa crescer para a fresta ocupar a cena inteira (com o meio dela no meio da rede)
    let real: ConsultorReal | null = null, chaveReal = '', realX = 0, realY = 0, realS = 1, realE = 100
    const pedirReal = () => {
      const chave = `${celular ? 'cel' : 'pc'}-${idiomaDasFotos()}-${claro}`
      if (chave === chaveReal) return
      chaveReal = chave
      carregarConsultor(celular ? 'cel' : 'pc', idiomaDasFotos(), claro).then((r) => { if (chaveReal === chave) { real = r; medir(); desenhar(atual, performance.now()) } }).catch(() => { chaveReal = '' })
    }
    let perto = false
    // a leitura (cena 1): o documento fica em (docX, docY) e a rede anda (desX, desY) para dar lugar a ele
    // desX0: na cena 0 a rede fica um pouco à direita, para caber a tela presa na ponta da entrada dela
    let docs: { pdf: DocPronto; planilha: DocPronto; textos: TextoLido[] } | null = null, docX = 0, docY = 0, desX = 0, desY = 0, desX0 = 0, chaveDocs = ''
    const texto = sticky.querySelector<HTMLElement>('.ag-texto')!, selos = sticky.querySelector<HTMLElement>('.ag-selos')!
    const estilo = getComputedStyle(document.documentElement)
    const fonte = (v: string, padrao: string) => estilo.getPropertyValue(v).trim() || padrao
    const fontes = () => ({ texto: fonte('--fonte', tx('Inter, sans-serif')), titulo: fonte('--fonte-titulo', tx('Inter, sans-serif')), numeros: fonte('--fonte-numeros', tx('Inter, sans-serif')) })
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
        tela = desenharTela(tw, th, q, N, letras, sorteio(7), claro)
        fr = montar(N, tela.pontos, k4, (yTela - cy) / k4)
        // quando cada fio e cada nó saem da rede: junto com o primeiro cubinho dele que vai para o gráfico (a rede é
        // feita dos cubinhos; não fica nada para trás)
        saidaFio.fill(9); saidaNo.fill(9)
        for (const f of fr) {
          if (f.no >= 0) saidaNo[f.no] = Math.min(saidaNo[f.no], f.atraso)
          else saidaFio[f.elo] = Math.min(saidaFio[f.elo], f.atraso)
        }
        REDE.elos.forEach(({ a, b }, e) => {
          if (saidaFio[e] > 1) saidaFio[e] = 0.15
          saidaNo[a] = Math.min(saidaNo[a], saidaFio[e]); saidaNo[b] = Math.min(saidaNo[b], saidaFio[e])
        })
      }
      if (perto) pedirReal()
      if (real) {
        if (celular) {
          const topo = texto.getBoundingClientRect().bottom - sticky.getBoundingClientRect().top + 16, fundo = H - 20
          realS = Math.min((fundo - topo) / real.h, (W * 0.78) / real.w)
          realX = (W - real.w * realS) / 2; realY = (topo + fundo) / 2 - (real.h * realS) / 2
        } else {
          const esq = Math.min(460, W * 0.36), aw = W - esq - 40
          realS = Math.min(aw / real.w, (H * 0.8) / real.h)
          realX = esq + 20 + (aw - real.w * realS) / 2; realY = (H - real.h * realS) / 2
        }
        realE = Math.max(20, (1.3 * 2 * Math.max(cy, H - cy)) / (real.fr[3] * realS))
        // o carrossel termina com a câmera parada nesta mesma tela, neste mesmo lugar (passagem.ts)
        publicarPassagem({ real, x: realX, y: realY, s: realS })
      }
      let dw: number, dh: number
      if (celular) {
        const topo = texto.getBoundingClientRect().bottom - sticky.getBoundingClientRect().top + 10
        dw = Math.min(W - 36, 380); dh = Math.min(dw * 0.66, H * 0.3)
        docX = W / 2; docY = topo + dh / 2
        desX = 0; desY = (docY + dh / 2 + H - 24) / 2 - cy; desX0 = W * 0.26
      } else {
        const esq = Math.min(460, W * 0.36), aw = W - esq - 40
        dw = Math.min(380, aw * 0.4); dh = Math.min(dw * 0.95, H * 0.62)
        docX = esq + 20 + dw / 2; docY = cy
        // a rede vai para a direita: entre o documento e a entrada dela fica o espaço da esteira
        desX = docX + dw / 2 + 170 + 300 * esc * CAM[1].zoom - cx; desY = 0; desX0 = aw * 0.3
      }
      dw = Math.round(dw); dh = Math.round(dh)
      const chaveD = `${dw}|${dh}|${document.documentElement.lang}|${claro}`
      areaW = celular ? W - 22 : (W - Math.min(460, W * 0.36) - 40) * 0.9; areaH = celular ? H * 0.8 : H * 0.7
      const chaveC = `${celular}|${document.documentElement.lang}|${letras.texto}`
      if (chaveC !== chaveCamadas) { chaveCamadas = chaveC; fatias = montarCamadas(celular, letras) }
      if (chaveD !== chaveDocs) {
        chaveDocs = chaveD
        docs = desenharDocs(dw, dh, Math.min(window.devicePixelRatio || 1, 2), letras, claro)
      }
    }

    let yaw = 0, pitch = 0, zoom = 1, offX = 0, offY = 0
    const F = 1150
    // a câmera livre da cena 0 (do túnel até a vista de fora): onde ela está, para onde olha (direita, baixo e frente)
    // e o foco (px por unidade a uma unidade de distância). Fora dela, a câmera gira em volta do meio, a F de distância
    let livre = false
    const cam = { x: 0, y: 0, z: 0, r: [1, 0, 0], u: [0, 1, 0], f: [0, 0, 1], foco: 1 }
    /** As direções da câmera girada (yaw em volta do eixo de cima, pitch para baixo): as mesmas do proj normal. */
    const base = (th: number, ph: number) => {
      const ct = Math.cos(th), st = Math.sin(th), cp = Math.cos(ph), sp = Math.sin(ph)
      return { r: [ct, 0, st], u: [sp * st, cp, -sp * ct], f: [-cp * st, sp, cp * ct] }
    }
    // o fio do túnel: da fresta (nas costas da tela) até um nó da entrada (no), direção (dx, dy, dz), comprimento L e
    // onde a câmera está nele (sCam)
    const tubo = { Sx: 0, Sy: 0, Sz: 0, dx: 0, dy: 0, dz: 1, L: 1, sCam: 0, no: 0 }
    const proj = (x: number, y: number, z: number) => {
      if (livre) {
        const vx = x - cam.x, vy = y - cam.y, vz = z - cam.z
        const zc = vx * cam.f[0] + vy * cam.f[1] + vz * cam.f[2]
        if (zc < 3) return { x: -1e5, y: -1e5, s: 0 }
        const k = cam.foco / zc
        return { x: cx + offX + (vx * cam.r[0] + vy * cam.r[1] + vz * cam.r[2]) * k, y: cy + offY + (vx * cam.u[0] + vy * cam.u[1] + vz * cam.u[2]) * k, s: k / (esc * zoom) }
      }
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
      ctx.fillStyle = P.chao; ctx.fill()
      ctx.strokeStyle = P.chaoBorda; ctx.lineWidth = 1; ctx.stroke()
      ctx.beginPath()
      for (let m = 0; m < MESES; m++) {
        const x = xColuna(m, 1), A = proj(x, y0 + 1, -46), B = proj(x, y0 + 1, 46)
        ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y)
      }
      ctx.strokeStyle = P.chaoMes; ctx.stroke()
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
        const [cr, cg, cb] = P.tipos[k]
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
      ctx.setLineDash([6, 5]); ctx.strokeStyle = P.media; ctx.lineWidth = 1.4
      ctx.beginPath(); ctx.moveTo(M0.x, M0.y); ctx.lineTo(M1.x, M1.y); ctx.stroke()
      ctx.setLineDash([])
      // os meses, embaixo de cada grupo
      ctx.font = tx('600 {0}px {1}', celular ? 9.5 : 11, letras.texto); ctx.textAlign = 'center'; ctx.textBaseline = 'top'
      ctx.fillStyle = P.mes
      let baixo = 0
      for (let m = 0; m < MESES; m++) {
        if (celular && m % 2) continue
        const P = proj(xColuna(m, 1), y0 + 12, -46)
        ctx.fillText(MESES_NOME[m].slice(0, 3), P.x, P.y)
        baixo = Math.max(baixo, P.y)
      }
      // a legenda, embaixo do mês mais baixo, no meio
      const Lg = { x: proj(0, y0 + 12, -46).x, y: baixo + (celular ? 26 : 32) }
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.font = tx('600 {0}px {1}', celular ? 10.5 : 12, letras.texto)
      let lx = Lg.x - legenda.reduce((t, l) => t + 31 + ctx.measureText(l).width, -16) / 2
      legenda.forEach((t, k) => {
        const [cr, cg, cb] = P.tipos[k]
        ctx.fillStyle = `rgb(${cr},${cg},${cb})`; ctx.beginPath(); ctx.roundRect(lx, Lg.y - 5, 10, 10, 2.5); ctx.fill()
        ctx.fillStyle = P.legenda; ctx.fillText(t, lx + 15, Lg.y)
        lx += 15 + ctx.measureText(t).width + 16
      })
      // a linha de luz que firma (e depois desfaz) o gráfico: um plano fino de pé, do chão até acima da coluna mais alta
      ctx.globalCompositeOperation = P.luz
      for (const [xl, f] of [[xFaz, fazendo], [xDesfaz, desfazendo]]) {
        if (f <= 0 || f >= 1) continue
        const A = proj(xl, y0 + 4, -50), B = proj(xl, y0 - ALTO_GRAF - 16, -50), C = proj(xl, y0 - ALTO_GRAF - 16, 50), D = proj(xl, y0 + 4, 50)
        const plano = ctx.createLinearGradient(A.x, A.y, B.x, B.y)
        plano.addColorStop(0, P.varre[0]); plano.addColorStop(1, P.varre[1])
        ctx.globalAlpha = Math.sin(Math.PI * f)
        ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.lineTo(C.x, C.y); ctx.lineTo(D.x, D.y); ctx.closePath()
        ctx.fillStyle = plano; ctx.fill()
        ctx.strokeStyle = P.varre[2]; ctx.lineWidth = 1.6
        ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke()
      }
      ctx.restore()
    }

    /**
     * A tela do Consultor no espaço da rede (antes de girar com ela): em pé, longe da entrada e mais para o fundo (o fio
     * até a rede fica comprido, e de fora tudo cabe na cena), virada de costas para a rede (o fio sai reto das costas
     * dela). Do tamanho da altura da rede, na proporção da foto. C é o meio, D a direção de onde ela está para a
     * entrada da rede (as costas olham para lá), R a direita de quem olha a tela de frente.
     */
    const TELA_C = [-820, 0, 720] as const
    const TELA_D = (() => { const dx = -340 - TELA_C[0], dz = -TELA_C[2], n = Math.hypot(dx, dz); return [dx / n, 0, dz / n] as const })()
    const TELA_R = [TELA_D[2], 0, -TELA_D[0]] as const
    /** Um ponto da tela: u da esquerda (-1/2) à direita (+1/2), v de cima a baixo, atras px para trás (para a rede). */
    const naTela = (Wp: number, Hp: number, u: number, v: number, atras = 0): [number, number, number] =>
      [TELA_C[0] + TELA_R[0] * u * Wp + TELA_D[0] * atras, v * Hp, TELA_C[2] + TELA_R[2] * u * Wp + TELA_D[2] * atras]
    const tamTela = (t: ConsultorReal) => { const h = 360; return [Math.min(720, (h * t.w) / t.h), h] as const }
    // a tela em miniatura (desenhar a foto inteira em perspectiva a cada quadro pesa)
    let mini: HTMLCanvasElement | null = null, miniDe: ConsultorReal | null = null
    const miniatura = (t: ConsultorReal) => {
      if (miniDe !== t) {
        const c = document.createElement('canvas'), k = Math.min(1, 560 / t.ia.width)
        c.width = Math.round(t.ia.width * k); c.height = Math.round(t.ia.height * k)
        const g = c.getContext('2d')!
        g.imageSmoothingQuality = 'high'; g.drawImage(t.ia, 0, 0, c.width, c.height)
        mini = c; miniDe = t
      }
      return mini!
    }

    /**
     * A teia: os fios que saem das costas da tela do Consultor e entram nos nós das duas primeiras camadas da rede (um
     * deles sai da fresta). O túnel é o meio desse feixe: por dentro, os mesmos fios são as paredes (espalhados perto da
     * tela, fechando-se perto da rede); por fora, eles ligam a tela à rede. Cada fio vai de (ax, ay, az) até o nó no,
     * já girado com a rede. Refeita a cada quadro (a rede gira).
     */
    const fiosTeia: { ax: number; ay: number; az: number; no: number }[] = []
    const montarTeia = (t: ConsultorReal, ca: number, sa: number) => {
      const [Wp, Hp] = tamTela(t)
      const gira = ([x, y, z]: [number, number, number]) => ({ ax: x * ca + z * sa, ay: y, az: -x * sa + z * ca })
      const [nz, ny] = CAMADAS[0]
      // cada ponto da tela vai para o nó da entrada na mesma posição (o de cima no de cima, o da esquerda no da
      // esquerda): os fios não se cruzam e formam um funil. O lado (esquerda da tela = qual lado da camada) é o que
      // deixa os fios mais curtos
      const pontos: { A: { ax: number; ay: number; az: number }; u: number; v: number }[] = []
      for (let j = 0; j < 5; j++) for (let i = 0; i < 6; i++) {
        const u = -0.5 + (i + 0.5) / 6, v = -0.5 + (j + 0.5) / 5
        pontos.push({ A: gira(naTela(Wp * 0.88, Hp * 0.84, u, v, 2)), u, v })
      }
      const alvo = (u: number, v: number, lado: number) => {
        const jy = Math.round((v + 0.5) * (ny - 1)), kz = Math.round((lado * u + 0.5) * (nz - 1))
        return REDE.inicio[0] + jy * nz + Math.max(0, Math.min(nz - 1, kz))
      }
      let melhor = 1, menor = Infinity
      for (const lado of [1, -1]) {
        let soma = 0
        for (const { A, u, v } of pontos) { const b = alvo(u, v, lado); soma += Math.hypot(rx[b] - A.ax, ry[b] - A.ay, rz[b] - A.az) }
        if (soma < menor) { menor = soma; melhor = lado }
      }
      fiosTeia.length = 0
      for (const { A, u, v } of pontos) fiosTeia.push({ ...A, no: alvo(u, v, melhor) })
      fiosTeia.push({ ...gira(naTela(Wp, Hp, t.fx / t.w - 0.5, t.fy / t.h - 0.5, 2)), no: tubo.no })
    }
    /** O ponto do fio k a uma fração f do caminho (0 na tela, 1 no nó). */
    const noFio = (k: number, f: number) => {
      const c = fiosTeia[k], b = c.no
      return proj(mistura(c.ax, rx[b], f), mistura(c.ay, ry[b], f), mistura(c.az, rz[b], f))
    }
    const compFio = (k: number) => { const c = fiosTeia[k], b = c.no; return Math.hypot(rx[b] - c.ax, ry[b] - c.ay, rz[b] - c.az) }

    /**
     * A sala do servidor, atrás de tudo. Os racks são placas de frente para o corredor, cada uma com colunas de LEDs
     * (os mesmos quadradinhos da rede), quase todos apagados. Quando o sinal chega na saída da rede, uma onda de luz
     * corre pelos racks, de perto da rede até o fundo do corredor: a resposta se espalhando pelo servidor. No chão, a
     * grade e o reflexo da rede.
     */
    const desenharSala = (a: number, s: number, refl: number) => {
      ctx.globalCompositeOperation = P.luz
      const S = P.sala
      // o chão: as linhas ao longo do corredor e as de través, mais fracas quanto mais longe (em faixas de profundidade)
      const faixas = 10, chao = Array.from({ length: faixas }, () => new Path2D())
      const zDe = (b: number) => -700 + (b / faixas) * (LONGE + 700)
      const reta = (path: Path2D, A: { x: number; y: number; s: number }, B: { x: number; y: number; s: number }) => {
        if (A.s && B.s) { path.moveTo(A.x, A.y); path.lineTo(B.x, B.y) }
      }
      for (let b = 0; b < faixas; b++) {
        const z0 = zDe(b), z1 = zDe(b + 1)
        for (let x = -LADO_SALA; x <= LADO_SALA; x += 125) reta(chao[b], proj(x, CHAO, z0), proj(x, CHAO, z1))
        for (let z = Math.ceil(z0 / 125) * 125; z < z1; z += 125) reta(chao[b], proj(-LADO_SALA, CHAO, z), proj(LADO_SALA, CHAO, z))
      }
      ctx.lineWidth = 1; ctx.strokeStyle = S.chao
      chao.forEach((path, b) => { ctx.globalAlpha = a * nevoa(zDe(b + 0.5)); ctx.stroke(path) })
      // o teto: duas faixas de luz ao longo do corredor
      const teto = new Path2D()
      for (const x of [-LADO_SALA * 0.45, LADO_SALA * 0.45]) for (let b = 0; b < faixas; b++) reta(teto, proj(x, TETO_SALA, zDe(b)), proj(x, TETO_SALA, zDe(b + 1)))
      ctx.globalAlpha = a * 0.8; ctx.strokeStyle = S.teto; ctx.lineWidth = 1.4; ctx.stroke(teto)

      // uma luz fraca no fim do corredor: dá o fundo para onde tudo foge
      const fim = proj(0, (CHAO + TETO_SALA) / 2, LONGE)
      if (fim.s) { const t2 = 1100 * esc * zoom; ctx.globalAlpha = a * 0.35; ctx.drawImage(P.halo, fim.x - t2 / 2, fim.y - t2 / 2, t2, t2) }
      // a onda que corre pelos racks cada vez que o sinal chega na saída da rede
      const fSaida = (pulso - (CAMADAS.length - 1)) / ESPACO, zOnda = (fSaida - Math.floor(fSaida)) * (LONGE + 900) - 500
      const pisca = Math.floor(s * 2.5)
      const faces = new Path2D(), gavetas = new Path2D(), apagados: number[] = [], acesos: number[] = []
      for (const lado of [-1, 1]) {
        const x = lado * LADO_SALA
        for (let r = 0; r < RACKS.length; r++) {
          const z0 = RACKS[r], z1 = z0 + RACK_LARGO, f = nevoa(z0)
          if (f < 0.03) continue
          const A = proj(x, TETO_SALA + 60, z0), B = proj(x, TETO_SALA + 60, z1), C = proj(x, CHAO, z1), D = proj(x, CHAO, z0)
          if (!A.s || !B.s || !C.s || !D.s) continue
          if (Math.max(A.x, B.x, C.x, D.x) < 0 || Math.min(A.x, B.x, C.x, D.x) > W) continue
          faces.moveTo(A.x, A.y); faces.lineTo(B.x, B.y); faces.lineTo(C.x, C.y); faces.lineTo(D.x, D.y); faces.closePath()
          // longe, as gavetas ficam pequenas demais: o rack fica só a placa
          const alto = Math.abs(D.y - A.y)
          if (alto < 36) continue
          const onda = Math.max(0, 1 - Math.abs(z0 - zOnda) / 260)
          // as gavetas (cada servidor do rack): uma linha de través e dois LEDs na ponta de dentro
          for (let l = 0; l < GAVETAS; l++) {
            const v0 = l / GAVETAS, y0 = mistura(TETO_SALA + 60, CHAO, v0)
            if (l) { const E = proj(x, y0, z0 + 4), G = proj(x, y0, z1 - 4); if (E.s && G.s) { gavetas.moveTo(E.x, E.y); gavetas.lineTo(G.x, G.y) } }
            const yl = mistura(TETO_SALA + 60, CHAO, v0 + 0.5 / GAVETAS)
            for (let c = 0; c < 2; c++) {
              const P2 = proj(x, yl, z0 + 9 + c * 8)
              if (!P2.s) continue
              const lado2 = Math.max(1.2, Math.min(6, 3 * P2.s * esc * zoom))
              // alguns piscam sozinhos; na passagem da onda, o rack acende de cima para baixo
              const k = r * 97 + l * 7 + c * 3 + (lado > 0 ? 5000 : 0), h = Math.sin(k * 12.9898 + pisca * 78.233) * 43758.5453
              const solto = h - Math.floor(h) < 0.06
              const lista = onda * (1 - 0.5 * v0) > 0.35 || solto ? acesos : apagados
              lista.push(P2.x, P2.y, lado2, f * (solto && onda < 0.35 ? 0.75 : 1))
            }
          }
        }
      }
      ctx.globalAlpha = a; ctx.fillStyle = S.face; ctx.fill(faces)
      ctx.strokeStyle = S.borda; ctx.lineWidth = 1; ctx.stroke(faces); ctx.stroke(gavetas)
      const pontos = (lista: number[], cor: string, k: number) => {
        ctx.fillStyle = cor
        for (let i = 0; i < lista.length; i += 4) {
          ctx.globalAlpha = a * lista[i + 3] * k
          const l = lista[i + 2]
          ctx.fillRect(lista[i] - l / 2, lista[i + 1] - l / 2, l, l)
        }
      }
      pontos(apagados, S.led, 1)
      pontos(acesos, S.aceso[0], 1)

      // o reflexo da rede no chão: cada nó espelhado, apagado e borrado
      if (refl > 0.01) {
        for (let i = 0; i < NN; i++) {
          const Q = proj(rx[i], 2 * CHAO - ry[i], rz[i])
          if (!Q.s) continue
          const tam = Math.min(60, (14 + 30 * aceso[i]) * Q.s * esc * zoom)
          ctx.globalAlpha = a * refl * S.espelho * (0.4 + 0.6 * aceso[i])
          ctx.drawImage(P.ponto, Q.x - tam / 2, Q.y - tam / 2, tam, tam)
        }
      }
      ctx.globalAlpha = 1
    }

    /** O ponto do fio k no espaço, a uma fração f do caminho. */
    const noFio3 = (k: number, f: number): V3 => { const c = fiosTeia[k], b = c.no; return [mistura(c.ax, rx[b], f), mistura(c.ay, ry[b], f), mistura(c.az, rz[b], f)] }
    /** Os fios da beirada do feixe, em volta: por eles passam as costelas do túnel. */
    const BEIRADA = [0, 1, 2, 3, 4, 5, 11, 17, 23, 29, 28, 27, 26, 25, 24, 18, 12, 6]
    const NA_BEIRADA = Array.from({ length: 31 }, (_, k) => BEIRADA.includes(k))
    /** A poeira parada no ar dentro do túnel: cada grão fica entre dois fios, num ponto do caminho. */
    const POEIRA = (() => { const r = sorteio(23); return Array.from({ length: 150 }, () => ({ a: Math.floor(r() * 30), b: Math.floor(r() * 30), w: r(), f: r() })) })()

    /**
     * Desenha a teia: cada fio é uma linha (mais fina e mais fraca quanto mais longe, como numa névoa) com uma fileira
     * de quadradinhos em cima (a cada 10 unidades, em perspectiva), como os fios da rede, e sinais correndo da tela para
     * a rede. cresce vai de 0 (os fios ainda presos na tela) a 1. dentro (0 a 1) é o quanto a câmera está no túnel: lá
     * aparecem a luz do fim, as costelas em volta do feixe, a poeira no ar e mais sinais.
     */
    const desenharTeia = (a: number, cresce: number, s: number, dentro: number) => {
      ctx.globalCompositeOperation = P.luz
      // por dentro o túnel fica mais apagado: ele é o cenário, e as camadas é que têm de se ler
      const fc = tubo.sCam / tubo.L, calma = 1 - 0.7 * dentro
      // a luz no fim do túnel: é para onde os fios vão (o meio da entrada da rede)
      if (dentro > 0.01) {
        const fim = proj(tubo.Sx + tubo.dx * tubo.L, tubo.Sy + tubo.dy * tubo.L, tubo.Sz + tubo.dz * tubo.L)
        if (fim.s) {
          const tam = (260 + 560 * fc) * (celular ? 0.8 : 1)
          ctx.globalAlpha = a * dentro * 0.5
          ctx.drawImage(P.halo, fim.x - tam / 2, fim.y - tam / 2, tam, tam)
        }
      }
      // os sinais que correm nos fios: no claro, cada fio na sua cor (como na rede); no escuro, todos dourados
      const nCores = Math.max(1, P.sinais.length)
      const faixas = [new Path2D(), new Path2D(), new Path2D(), new Path2D()], rastros = Array.from({ length: nCores }, () => new Path2D())
      const dados: [number, number, number, number][] = [], quads: [number, number, number, number][] = []
      const nivel = (px: number) => px < 0.5 ? 0 : px < 1.1 ? 1 : px < 2.6 ? 2 : 3
      const sinais = dentro > 0.3 ? 3 : 1
      const miolo = new Path2D()
      fiosTeia.forEach((c, k) => {
        if (!ns[c.no] && !livre) return
        // por dentro, os fios do miolo do feixe (os que não são da beirada) ficam só um risco fino: são as paredes que
        // fazem o túnel, e o meio fica livre para as linhas lidas
        const deDentro = dentro > 0.01 && !NA_BEIRADA[k]
        // longe (pequeno na tela) os quadradinhos ficam mais espaçados: o espaço na tela é o mesmo e desenha menos
        const meio = noFio(k, 0.5), pxMeio = meio.s ? meio.s * esc * zoom : 1
        const L = compFio(k), passos = Math.max(2, Math.floor((L * cresce) / (pxMeio < 0.9 ? 18 : 10)))
        let antes = noFio(k, 0)
        for (let q = 1; q <= passos; q++) {
          const f = (q / passos) * cresce, P = noFio(k, f)
          const px = P.s * esc * zoom
          if (antes.s && P.s) { const fx = deDentro ? miolo : faixas[nivel(px)]; fx.moveTo(antes.x, antes.y); fx.lineTo(P.x, P.y) }
          antes = P
          if (!P.s || px > 12) continue
          // dentro do túnel os de longe somem na névoa (senão todos se juntam num borrão no ponto de fuga)
          const n = mistura(Math.min(1, px * 1.6), deDentro ? 0 : limitar(px * 0.85 - 0.25), dentro)
          if (n > 0.02) quads.push([P.x, P.y, Math.max(1.1, Math.min(9, 1.8 * px)), n])
        }
        for (let m = 0; m < (deDentro ? 0 : sinais); m++) {
          const u = ((s * 0.22 + k * 0.137 + m / sinais) % 1) * cresce, D = noFio(k, u), E = noFio(k, Math.max(0, u - 0.03))
          if (!D.s) continue
          const cor = (k * 7 + 3) % nCores
          if (E.s) { rastros[cor].moveTo(E.x, E.y); rastros[cor].lineTo(D.x, D.y) }
          dados.push([D.x, D.y, Math.max(3.2, Math.min(8, 2.2 * D.s * esc * zoom)), cor])
        }
      })
      ctx.lineCap = 'round'
      ctx.globalAlpha = a * mistura(1, 0.5, dentro); ctx.strokeStyle = P.tunel[1]; ctx.lineWidth = 0.8; ctx.stroke(miolo)
      faixas.forEach((fx, i) => { ctx.globalAlpha = a * calma; ctx.strokeStyle = P.tunel[i]; ctx.lineWidth = [0.7, 1, 1.5, 2.2][i]; ctx.stroke(fx) })
      if (dentro > 0.01) {
        // as costelas: de trecho em trecho, uma volta pela beirada do feixe (o túnel ganha parede)
        ctx.lineWidth = 1.2
        for (let r = 1; r <= 30; r++) {
          const f = r / 31
          if (f < fc + 0.01) continue
          const volta = new Path2D()
          let ok = true, px = 0
          BEIRADA.forEach((k, i) => { const P = noFio(k, f); if (!P.s) ok = false; px = P.s * esc * zoom; if (i) volta.lineTo(P.x, P.y); else volta.moveTo(P.x, P.y) })
          if (!ok) continue
          volta.closePath()
          ctx.globalAlpha = a * dentro * 0.5 * (1 - suave(6, 12, px))
          ctx.strokeStyle = P.tunel[nivel(px)]; ctx.stroke(volta)
        }
        // a poeira: grãos parados no ar, que passam pela câmera
        POEIRA.forEach((g, i) => {
          const f = (g.f + s * 0.006) % 1, A = noFio3(g.a, f), B = noFio3(g.b, f)
          const Q = proj(mistura(A[0], B[0], g.w), mistura(A[1], B[1], g.w), mistura(A[2], B[2], g.w))
          if (!Q.s) return
          const px = Q.s * esc * zoom, lado = Math.max(1, Math.min(6, 1.3 * px))
          ctx.globalAlpha = a * dentro * 0.75 * limitar(px * 0.8 - 0.1) * (1 - suave(5, 11, px))
          ctx.fillStyle = P.tons[1 + (i % 3)]
          ctx.fillRect(Q.x - lado / 2, Q.y - lado / 2, lado, lado)
        })
      }
      for (let nv = 1; nv <= 4; nv++) {
        ctx.fillStyle = dentro > 0.5 ? P.tunelQuad[nv] : P.tons[nv]
        for (const [x, y, lado, n] of quads) {
          if (Math.min(4, Math.max(1, Math.ceil(n * 4))) !== nv) continue
          ctx.globalAlpha = a * calma * mistura(0.45 + 0.55 * n, n, dentro)
          ctx.fillRect(x - lado / 2, y - lado / 2, lado, lado)
        }
      }
      ctx.globalAlpha = a * 0.85 * calma; ctx.lineWidth = 1.6
      rastros.forEach((r, c) => { ctx.strokeStyle = P.sinais[c]?.[1] ?? P.vivo; ctx.stroke(r) })
      ctx.globalAlpha = a * calma
      for (const [x, y, lado, c] of dados) { ctx.fillStyle = P.sinais[c]?.[1] ?? P.dado; ctx.fillRect(x - lado / 2, y - lado / 2, lado, lado) }
      ctx.lineCap = 'butt'
      ctx.globalAlpha = 1
    }

    /**
     * Dentro do túnel, as camadas do que está por trás do conselho (algoritmoCamadas.ts), uma de cada vez, de frente
     * para a câmera e no meio do feixe. Cada uma é feita de quadradinhos que saem dos fios da beirada, logo à frente da
     * câmera, voam para o lugar deles (a camada se escreve da esquerda para a direita), ficam enquanto a câmera chega
     * perto e, antes de ela passar, se soltam de volta para os fios e correm por eles até a rede. tau é o andamento do
     * túnel (0 na fresta, 1 na saída); a é o quanto a cena de dentro está presente.
     */
    const FATIAS = [[0.03, 0.35], [0.35, 0.67], [0.67, 0.98]]
    const desenharCamadas = (a: number, tau: number) => {
      const fc = tubo.sCam / tubo.L, mx = cx + offX, my = cy + offY
      ctx.globalCompositeOperation = P.luz
      fatias.forEach((c, k) => {
        const x = (tau - FATIAS[k][0]) / (FATIAS[k][1] - FATIAS[k][0])
        if (x <= 0 || x >= 1.5) return
        // a câmera chega perto: a camada cresce devagar enquanto está montada
        const e = Math.min(areaW / c.w, areaH / c.h) * (0.74 + 0.24 * Math.min(1, x))
        let cor = -1, alfa = -1
        for (let i = 0; i < c.n; i++) {
          const vez = c.vez[i], junta = suave(vez * 0.27, vez * 0.27 + 0.13, x)
          if (junta <= 0) continue
          const sai = 0.82 + vez * 0.08, solta = suave(sai, sai + 0.1, x)
          let X = mx + c.u[i] * e, Y = my + c.v[i] * e, lado = c.lado[i] * e, al = a
          if (junta < 1) {
            // saindo do fio: nasce nele, do tamanho dos quadradinhos da parede, e voa para a casa dele
            const Q = noFio(BEIRADA[c.fio[i]], Math.min(0.97, fc + 0.05 + c.df[i] * 0.12))
            if (!Q.s) continue
            X = mistura(Q.x, X, junta); Y = mistura(Q.y, Y, junta)
            lado = mistura(Math.max(1.2, Math.min(7, 1.8 * Q.s * esc * zoom)), lado, junta)
            al *= Math.min(1, junta * 8)
          } else if (solta > 0) {
            // de volta para o fio, e por ele até o nó da entrada da rede (some ao chegar)
            const f = mistura(Math.min(0.9, fc + 0.08 + c.df[i] * 0.1), 1, limitar((x - sai) / 0.55))
            const Q = noFio(BEIRADA[c.fio[i]], f)
            if (!Q.s) continue
            X = mistura(X, Q.x, solta); Y = mistura(Y, Q.y, solta)
            lado = mistura(lado, Math.max(1.2, Math.min(7, 1.8 * Q.s * esc * zoom)), solta)
            al *= 1 - suave(0.86, 1, f)
          }
          if (al <= 0.01) continue
          if (c.cor[i] !== cor) { cor = c.cor[i]; ctx.fillStyle = P.camada[cor] }
          if (al !== alfa) { alfa = al; ctx.globalAlpha = al }
          ctx.fillRect(X - lado / 2, Y - lado / 2, lado, lado)
        }
      })
      ctx.globalAlpha = 1
    }

    /** A tela do Consultor presa nas pontas da teia: de frente, inteira; por trás, vista pelo vidro (espelhada e suave). */
    const desenharTelaNaRede = (t: ConsultorReal, a: number, ca: number, sa: number) => {
      const [Wp, Hp] = tamTela(t)
      const gira = ([x, y, z]: [number, number, number]) => proj(x * ca + z * sa, y, -x * sa + z * ca)
      const TL = gira(naTela(Wp, Hp, -0.5, -0.5)), TR = gira(naTela(Wp, Hp, 0.5, -0.5)), BR = gira(naTela(Wp, Hp, 0.5, 0.5)), BL = gira(naTela(Wp, Hp, -0.5, 0.5))
      if (!TL.s || !TR.s || !BR.s || !BL.s) return false
      const deFrente = (TR.x - TL.x) * (BL.y - TL.y) - (TR.y - TL.y) * (BL.x - TL.x) > 0
      ctx.globalCompositeOperation = 'source-over'
      ctx.globalAlpha = a
      ctx.beginPath(); ctx.moveTo(TL.x, TL.y); ctx.lineTo(TR.x, TR.y); ctx.lineTo(BR.x, BR.y); ctx.lineTo(BL.x, BL.y); ctx.closePath()
      ctx.fillStyle = t.corFundo; ctx.fill()
      const m = miniatura(t)  // a tela como é (o estúdio não é invertido)
      ctx.setTransform(dpr * (TR.x - TL.x) / m.width, dpr * (TR.y - TL.y) / m.width, dpr * (BL.x - TL.x) / m.height, dpr * (BL.y - TL.y) / m.height, dpr * TL.x, dpr * TL.y)
      ctx.globalAlpha = a * (deFrente ? 1 : 0.42)
      ctx.drawImage(m, 0, 0)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.globalAlpha = a
      ctx.strokeStyle = 'rgba(170,200,255,0.3)'; ctx.lineWidth = 1.2; ctx.stroke()
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = P.luz
      return deFrente
    }

    const desenhar = (rolagem: number, tempo: number) => {
      const p = porCena(rolagem)
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
      // no celular, na cena 0, a câmera fica mais longe: a tela presa na ponta da rede tem que caber ao lado dela
      if (celular) zoom *= 1 - 0.42 * pres[0]
      offX = desX * pres[1] + desX0 * pres[0]; offY = desY * pres[1]
      // cena 0 (desm): a câmera vira para a fresta entre os dois cartões, chega perto e atravessa; anda dentro do túnel;
      // sai dele e se afasta. A rede só aparece nessa última parte (oculto vai a 0), vinda de perto (zoom maior) para o
      // tamanho dela
      // a abertura em três trechos da rolagem: até a fresta (ATRAVESSA), o túnel, que fica com a maior parte (são três
      // camadas para ler), e a saída (de SAI em diante)
      const rol = limitar((p - 0.02) / 0.165)
      const desm = !real ? 1 : rol < 0.186 ? (rol / 0.186) * ATRAVESSA : rol < 0.894 ? ATRAVESSA + ((rol - 0.186) / 0.708) * (SAI - ATRAVESSA) : SAI + ((rol - 0.894) / 0.106) * (1 - SAI)
      // dentro: o quanto a câmera está no túnel. Lá, a rede já aparece no fim dele, ainda apagada (é para onde se vai)
      const dentro = real ? suave(ATRAVESSA, ATRAVESSA + 0.04, desm) * (1 - suave(SAI, SAI + 0.12, desm)) : 0
      const oculto = real ? 1 - Math.max(suave(SAI + 0.02, 0.96, desm), 0.4 * suave(SAI - 0.2, SAI, desm)) : 0
      // no celular, do mergulho até a saída do túnel a cena ocupa a tela inteira: o texto some e o ponto de fuga vai
      // para o meio dela
      const imerso = real && celular ? suave(0.04, 0.14, desm) * (1 - suave(0.9, 1, desm)) : 0
      offY += (H * 0.5 - cy) * imerso
      // o ponto de fuga fica no meio da área da cena enquanto a câmera está lá dentro (as camadas ficam
      // nele); fora, a rede volta para a direita, onde cabe a tela presa na ponta dela
      if (real) offX -= desX0 * pres[0] * suave(0, ATRAVESSA * 0.5, desm) * (1 - suave(SAI, 1, desm))
      por('imerso', imerso.toFixed(3), () => sticky.style.setProperty('--imerso', imerso.toFixed(3)))
      // o ponto da cena onde fica o meio da fresta: começa onde ele está na tela e vai para o meio da rede
      let alvoX = cx, alvoY = cy
      if (real && desm < 1) {
        const vira = suave(0.04, 0.9, desm / ATRAVESSA)
        alvoX = mistura(realX + real.fx * realS, cx + offX, vira); alvoY = mistura(realY + real.fy * realS, cy + offY, vira)
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
      const g0 = limitar((p - 0.58) / 0.12), v0 = limitar((p - 0.8) / 0.1), raioK = 1
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
      // enquanto a câmera chega na fresta, a cena fica da cor do painel; depois de atravessar, escurece aos poucos
      const azul = real ? suave(0.03, 0.22, desm) * (1 - suave(ATRAVESSA - 0.03, ATRAVESSA, desm)) : 0
      if (azul > 0.005) { ctx.globalAlpha = azul; ctx.fillStyle = real?.corFundo ?? COR_PAINEL; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1 }
      ctx.globalCompositeOperation = P.luz

      // névoa de luz atrás (mais forte com a rede inteira)
      const centro = proj(0, 0, 0)
      const redeCheia = (1 - suave(0.58, 0.68, p)) * (1 - oculto)
      const th = (720 + 160 * calc) * esc * zoom
      ctx.globalAlpha = Math.min(1, 0.2 + 0.3 * redeCheia + 0.3 * pres[n - 1] + 0.3 * pres[0] + 0.3 * chegada * pres[1]) * (1 - oculto)
      ctx.drawImage(P.halo, centro.x - th / 2, centro.y - th / 2, th, th)
      ctx.globalAlpha = 1

      // a rede: onde está cada nó e o quanto está aceso (a onda de sinal passa da entrada para a saída)
      const ang = -0.5 + 0.22 * Math.sin(giro * 0.5), ca = Math.cos(ang), sa = Math.sin(ang)
      // cena 0, do outro lado da fresta: a câmera livre anda dentro do fio que liga a fresta à rede (até SAI) e depois
      // sai dele, dando a volta por fora até a câmera de sempre (em desm = 1 as duas são a mesma)
      livre = false
      if (real && desm > ATRAVESSA && desm < 1) {
        // a fresta na tela (que fica na ponta da entrada, girando com a rede) e o nó da entrada mais perto dela
        const [Wp, Hp] = tamTela(real)
        const [fx0, fy, fz0] = naTela(Wp, Hp, real.fx / real.w - 0.5, real.fy / real.h - 0.5)
        const Sx = fx0 * ca + fz0 * sa, Sy = fy, Sz = -fx0 * sa + fz0 * ca
        let no = 0, melhor = Infinity
        for (let i = 0; i < REDE.entrada; i++) { const d = Math.abs(REDE.nos[i].y - fy) + Math.abs(REDE.nos[i].z) * 0.5; if (d < melhor) { melhor = d; no = i } }
        // a câmera vai pelo meio do feixe: da fresta para o meio da camada de entrada
        let Nx = 0, Ny = 0, Nz = 0
        for (let i = 0; i < REDE.entrada; i++) { const N = REDE.nos[i]; Nx += N.x * ca + N.z * sa; Ny += N.y; Nz += -N.x * sa + N.z * ca }
        Nx /= REDE.entrada; Ny /= REDE.entrada; Nz /= REDE.entrada
        let dx = Nx - Sx, dy = Ny - Sy, dz = Nz - Sz
        const L = Math.hypot(dx, dy, dz); dx /= L; dy /= L; dz /= L
        const tau = limitar((desm - ATRAVESSA) / (SAI - ATRAVESSA)), w = suave(SAI, 1, desm), sCam = 0.6 * L * tau
        Object.assign(tubo, { Sx, Sy, Sz, dx, dy, dz, L, sCam, no })
        // dentro do fio: olhando ao longo dele; fora: girando até o yaw e o pitch de sempre, afastando até F do meio
        const thT = Math.atan2(-dx, dz), phT = Math.asin(dy), DT = 30
        let dth = yaw - thT
        dth = ((dth + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI
        // saindo: primeiro recua (para longe da rede, ao longo do fio), depois vira e o alvo vai para o meio da rede
        const wGiro = suave(0.15, 1, w), wAlvo = suave(0.35, 1, w)
        const th = thT + dth * wGiro, ph = mistura(phT, pitch, wGiro), D = DT * Math.pow(F / DT, Math.pow(w, 0.6))
        // logo depois da fresta a câmera vai para o eixo do funil (o meio da tela → o meio da entrada): as paredes ficam
        // à mesma distância em volta dela
        const [mx0, my, mz0] = naTela(Wp, Hp, 0, 0), eixo = suave(0, 0.3, tau) * (1 - sCam / L) * (1 - w)
        const ex = (mx0 * ca + mz0 * sa - Sx) * eixo, ey = (my - Sy) * eixo, ez = (-mx0 * sa + mz0 * ca - Sz) * eixo
        const Tx = mistura(Sx + ex + dx * (sCam + 6 + DT), 0, wAlvo), Ty = mistura(Sy + ey + dy * (sCam + 6 + DT), 0, wAlvo), Tz = mistura(Sz + ez + dz * (sCam + 6 + DT), 0, wAlvo)
        const b = base(th, ph)
        Object.assign(cam, { x: Tx - D * b.f[0], y: Ty - D * b.f[1], z: Tz - D * b.f[2], r: b.r, u: b.u, f: b.f, foco: F * esc * mistura(1, zoom, wGiro) })
        livre = true
      }
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

      // a sala do servidor: aparece quando a câmera sai do túnel (antes, ela está na tela do Consultor e dentro do fio) e
      // fica mais apagada na tela final, que precisa ser lida
      const salaA = (real ? suave(SAI, SAI + 0.12, desm) : 1) * (1 - 0.55 * pres[n - 1])
      if (salaA > 0.01) desenharSala(salaA, s, (1 - suave(0.58, 0.68, p)) * (1 - oculto))

      // a tela presa na ponta da entrada da rede, com os fios saindo de trás dela (aparece quando a câmera sai do túnel;
      // some quando o documento chega)
      // a teia (o túnel por dentro, os fios da tela até a rede por fora) e a tela presa nela; somem quando o documento
      // chega. A tela só aparece quando a câmera sai (antes ela fica atrás da câmera)
      const teiaA = real ? suave(ATRAVESSA, ATRAVESSA + 0.05, desm) * (1 - suave(0.19, 0.235, p)) : 0
      if (real && teiaA > 0.01) {
        montarTeia(real, ca, sa)
        const telaA = suave(SAI, SAI + 0.1, desm) * (1 - suave(0.19, 0.235, p))
        // vista por trás, os fios ficam por cima da tela (presos nela); de frente, saem de trás dela
        const deFrente = telaA > 0.01 && desenharTelaNaRede(real, telaA, ca, sa)
        if (deFrente) { desenharTeia(teiaA, 1, s, dentro); desenharTelaNaRede(real, telaA, ca, sa) } else desenharTeia(teiaA, 1, s, dentro)
      }

      if (g0 < 0.6) {
        // o quanto o fio (ou o nó) ainda está na rede: some junto com os cubinhos dele quando eles vão para o gráfico
        const apagada = 1 - oculto
        const fica = (at: number) => (1 - suave(at, at + 0.1, g0)) * apagada
        // os fios, feitos de quadradinhos em fila (tracejado de pontas retas), em seis níveis de presença; os de trás
        // mais fracos; e, mais fortes, os trechos que estão levando sinal agora
        // no claro cada fio leva a cor do seu sinal (P.sinais); no escuro todos são da mesma luz dourada
        const nCores = Math.max(1, P.sinais.length), corDoFio = (e: number) => (e * 7 + 3) % nCores
        const fios = Array.from({ length: 12 }, () => new Path2D()), vivos = Array.from({ length: 6 * nCores }, () => new Path2D())
        const pontas: [number, number, number, number, number][] = []
        REDE.elos.forEach(({ a, b }, e) => {
          const fa = fica(saidaFio[e]), q = Math.round(fa * 5)
          if (!q || !ns[a] || !ns[b]) return
          const f = fios[(rz[a] + rz[b] > 0 ? 0 : 6) + q]
          f.moveTo(nx[a], ny[a]); f.lineTo(nx[b], ny[b])
          const fase = (pulso - REDE.nos[a].camada) / ESPACO, k = Math.floor(fase), u = (fase - k) * ESPACO
          if (u >= 1.25) return
          const v = forca(a, k, limiar) * forca(b, k, limiar)
          if (!v) return
          // o trecho aceso é um rastro curto atrás da ponta do sinal
          const t1 = Math.min(1, u), t0 = Math.max(0, u - 0.45)
          const vv = vivos[corDoFio(e) * 6 + q]
          vv.moveTo(mistura(nx[a], nx[b], t0), mistura(ny[a], ny[b], t0)); vv.lineTo(mistura(nx[a], nx[b], t1), mistura(ny[a], ny[b], t1))
          if (u < 1) pontas.push([mistura(nx[a], nx[b], u), mistura(ny[a], ny[b], u), mistura(ns[a], ns[b], u), v * fa, corDoFio(e)])
        })
        ctx.lineCap = 'butt'
        ctx.setLineDash([2.2, 3.2]); ctx.lineWidth = 1.7
        for (let q = 1; q <= 5; q++) {
          ctx.globalAlpha = q / 5
          ctx.strokeStyle = P.fioFundo; ctx.stroke(fios[q])
          ctx.strokeStyle = P.fioFrente; ctx.stroke(fios[6 + q])
        }
        ctx.setLineDash([2.6, 2.2])
        for (let c = 0; c < nCores; c++) for (let q = 1; q <= 5; q++) {
          const [brilhoCor, cor] = P.sinais[c] ?? [P.vivoBrilho, P.vivo]
          ctx.globalAlpha = q / 5
          ctx.strokeStyle = brilhoCor; ctx.lineWidth = 3.4; ctx.stroke(vivos[c * 6 + q])
          ctx.strokeStyle = cor; ctx.lineWidth = 1.9; ctx.stroke(vivos[c * 6 + q])
        }
        ctx.setLineDash([])
        for (const [x, y, k, v, c] of pontas) {
          const tam = (9 + 9 * v) * k
          ctx.globalAlpha = 0.5 + 0.5 * v
          ctx.drawImage(P.pontos[c] ?? P.ponto, x - tam / 2, y - tam / 2, tam, tam)
        }
        // os nós: um halo que cresce com o sinal, um quadradinho de contorno e o miolo (também quadrado)
        ctx.lineWidth = 1.1
        for (let i = 0; i < NN; i++) {
          const fn = fica(saidaNo[i])
          if (fn <= 0.01 || !ns[i]) continue
          const saida = REDE.nos[i].camada === CAMADAS.length - 1, a = aceso[i], k = ns[i] * (saida ? 2.4 : 1)
          const tam = Math.min(140, (16 + 50 * a) * k)
          // no claro o nó aceso brilha e enche na cor dele (uma das cores dos sinais)
          const cn = P.sinais.length ? (i * 5 + 1) % P.sinais.length : -1
          ctx.globalAlpha = fn * (cn >= 0 ? a : 0.25 + 0.75 * a)
          ctx.drawImage(cn >= 0 ? P.pontos[cn] : P.ponto, nx[i] - tam / 2, ny[i] - tam / 2, tam, tam)
          ctx.globalAlpha = fn
          const lc = 5 * k, rm = (1.8 + 2.4 * a) * k
          if (P.noFundo) { ctx.fillStyle = P.noFundo; ctx.fillRect(nx[i] - lc, ny[i] - lc, lc * 2, lc * 2) }
          ctx.strokeStyle = P.anel; ctx.strokeRect(nx[i] - lc, ny[i] - lc, lc * 2, lc * 2)
          ctx.fillStyle = a > 0.45 ? (cn >= 0 ? P.sinais[cn][1] : P.cheio) : P.miolo; ctx.fillRect(nx[i] - rm, ny[i] - rm, rm * 2, rm * 2)
        }
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
        xs[i] = P.x; ys[i] = P.y; ss[i] = P.s; esconde[i] = P.s ? 0 : 1
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
      ctx.globalAlpha = 1 - oculto
      grupos.forEach((idx, chave) => {
        if (chave[0] === 'd') ctx.fillStyle = P.tons[Number(chave.slice(1))]
        else { const [c, tom, passo] = chave.split('.').map(Number); ctx.fillStyle = P.cubos[c][tom][passo] }
        for (const i of idx) {
          // pousados na tela, ficam menores (viram os traços das letras)
          const lado = Math.min(24, ss[i] * esc * zoom * ts[i])
          ctx.fillRect(xs[i] - lado / 2, ys[i] - lado / 2, lado + 0.4, lado + 0.4)
        }
      })
      // pontos mais quentes com brilho (um a cada 14 cubinhos)
      ctx.globalAlpha = 0.6 * (1 - oculto)
      for (let i = 0; i < N; i += 14) {
        if (esconde[i] || (acende > 0 && vs[i] > 0.98 && ys[i] < yLuz - 3)) continue
        if (gs[i] > 0.9 && vs[i] < 0.1 && fr[i].cat < 3) continue
        const tam = Math.min(90, (10 + 8 * Math.sin(s * 2 + fr[i].fase)) * ss[i] * esc * ms[i])
        ctx.drawImage(P.ponto, xs[i] - tam / 2, ys[i] - tam / 2, tam, tam)
      }
      ctx.globalAlpha = 1

      // cena 0: a tela do Consultor de verdade e, rolando, a câmera entrando nela
      if (real && desm < 1 && pres[0] > 0) {
        // sem moldura: a tela fica no plano da página, com as beiradas se apagando nela
        desenharConsultor(ctx, real, alvoX, alvoY, realS, desm, realE, W, H, P.fresta, P.brilhoFresta)
        ctx.globalAlpha = 1
        ctx.globalCompositeOperation = P.luz
      }
      // do outro lado da fresta: o túnel
      // o fio do túnel: por dentro, e visto de fora enquanto a câmera sai (os anéis somem e ele fica um fio da teia)
      // dentro do túnel, as camadas do que está por trás do conselho, feitas dos quadradinhos dos fios
      const camadasA = livre ? suave(ATRAVESSA, ATRAVESSA + 0.03, desm) * (1 - suave(SAI + 0.1, SAI + 0.16, desm)) : 0
      if (camadasA > 0.01) desenharCamadas(camadasA, (desm - ATRAVESSA) / (SAI - ATRAVESSA))

      // cena 1: o documento (o PDF, que gira e vira a planilha), a luz que lê as linhas e o texto de cada uma, que sai
      // dele, corre por um fio da rede e se desfaz em cubinhos
      if (docs) {
        // as esteiras: o trilho na cor da linha, do papel até a rede, e mais forte o trecho que o texto (ou os cubinhos
        // dele) já andou
        const vez = Math.max(pres[1], pres[2])
        ctx.globalCompositeOperation = P.luz
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
            ctx.globalCompositeOperation = P.luz
            ctx.globalAlpha = a * 0.5; ctx.fillStyle = 'rgba(120,210,255,0.6)'; ctx.fillRect(-doc.w / 2 - 12, yb - 5, doc.w + 24, 10)
          }
          ctx.restore()
        }
        ctx.globalAlpha = 1
        ctx.globalCompositeOperation = P.luz
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
        ctx.globalCompositeOperation = P.luz
        if (acende < 1) {
          const y0 = Math.max(tly, yLuz - 70), y1 = Math.min(tly + th, yLuz)
          if (y1 > y0) {
            const rastro = ctx.createLinearGradient(0, yLuz - 70, 0, yLuz)
            rastro.addColorStop(0, P.telaRastro[0]); rastro.addColorStop(1, P.telaRastro[1])
            ctx.fillStyle = rastro; ctx.fillRect(tlx, y0, tw, y1 - y0)
          }
          if (yLuz > tly - 10 && yLuz < tly + th + 10) {
            const lado = ctx.createLinearGradient(tlx - 40, 0, tlx + tw + 40, 0)
            lado.addColorStop(0, P.telaLinha[0]); lado.addColorStop(0.15, P.telaLinha[1])
            lado.addColorStop(0.85, P.telaLinha[1]); lado.addColorStop(1, P.telaLinha[0])
            ctx.fillStyle = lado; ctx.fillRect(tlx - 40, yLuz - 1.5, tw + 80, 3)
            ctx.globalAlpha = 0.5; ctx.fillRect(tlx - 40, yLuz - 6, tw + 80, 12); ctx.globalAlpha = 1
          }
        } else if (!reduzir) {
          // pronta: de tempos em tempos um reflexo atravessa o vidro
          const ciclo = (s % 5.5) / 1.6
          if (ciclo < 1) {
            const x = tlx - tw * 0.4 + ciclo * tw * 1.8
            const reflexo = ctx.createLinearGradient(x - 120, tly, x + 120, tly + th)
            reflexo.addColorStop(0, 'rgba(255,255,255,0)'); reflexo.addColorStop(0.5, P.reflexo); reflexo.addColorStop(1, 'rgba(255,255,255,0)')
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
    const chegando = new IntersectionObserver(([e]) => { if (e.isIntersecting && !perto) { perto = true; pedirReal() } }, { rootMargin: tx('1500px 0px') })
    chegando.observe(secao)
    // o carrossel pede a foto antes: a sexta face dele é esta tela
    const soltarPedido = aoPedirConsultor(() => { if (!perto) { perto = true; pedirReal() } })
    // trocou o tema: as fotos, os documentos e as cores compensadas são refeitos
    const tema = new MutationObserver(() => {
      const agora = document.documentElement.dataset.tema === 'claro'
      if (agora === claro) return
      claro = agora; P = paleta(claro); chaveDocs = ''; chaveTela = ''; chaveReal = ''; real = null
      medir(); pedirReal(); desenhar(atual, performance.now())
    })
    tema.observe(document.documentElement, { attributes: true, attributeFilter: ['data-tema'] })
    const obs = new IntersectionObserver(([e]) => {
      visivel = e.isIntersecting
      sticky.classList.toggle('ag-parado', !visivel)
      if (visivel && !quadro) { lerScroll(); antes = 0; antesGiro = 0; quadro = requestAnimationFrame(laco) }
    })
    obs.observe(secao)
    const aoScroll = () => { lerScroll(); vigiarEntrada() }
    const aoRedim = () => { medir(); lerScroll(); desenhar(atual, performance.now()) }
    medir(); lerScroll(); atual = alvo; desenhar(atual, performance.now())
    document.fonts?.ready.then(() => { medir(); desenhar(atual, performance.now()) })
    // o texto surge quando aparece de verdade (antes ele já nascia pronto, sem entrada): o selo desliza, as palavras do
    // título sobem uma a uma, o parágrafo e os pontinhos. "A seção entrou na tela" não basta: o carrossel de cima fica POR
    // CIMA desta seção durante quase uma tela de rolagem (a animação aconteceria escondida), e no celular o texto se apaga
    // enquanto a câmera mergulha. Então, a cada rolagem, olha se o texto está aceso, na tela e por cima de tudo (o que está
    // no ponto do selo é o próprio texto).
    // Toda vez que ele sai de vista (rolou para fora, o carrossel o cobriu de novo ou ele se apagou), volta a ficar pronto
    // para surgir: subir e descer de novo repete a entrada. Para não piscar na beira, sair pede mais que entrar (só conta
    // como apagado abaixo de 5% e como fora quando o selo saiu inteiro da tela). Com animações reduzidas, fica sempre pronto.
    const rotulo = texto.querySelector<HTMLElement>('.ag-rotulo')!
    let surgiu = false
    const vigiarEntrada = () => {
      if (semMovimento()) { if (!surgiu) { surgiu = true; texto.classList.add('surgiu') } return }
      const b = rotulo.getBoundingClientRect()
      const naTela = b.bottom > 0 && b.top < window.innerHeight
      const opacidade = Number(getComputedStyle(texto).opacity)
      const no = naTela ? document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2) : null
      const porCima = Boolean(no && texto.contains(no))
      if (!surgiu && naTela && porCima && opacidade >= 0.5) { surgiu = true; texto.classList.add('surgiu') }
      else if (surgiu && (!naTela || !porCima || opacidade < 0.05)) { surgiu = false; texto.classList.remove('surgiu') }
    }
    vigiarEntrada()
    // o texto e os selos mudam de altura (fontes, idioma, quebra de linha): a tela do celular se mede de novo
    const tamanhos = new ResizeObserver(() => { medir(); desenhar(atual, performance.now()) })
    tamanhos.observe(texto); tamanhos.observe(selos)
    window.addEventListener('scroll', aoScroll, { passive: true })
    window.addEventListener('resize', aoRedim)
    return () => {
      obs.disconnect(); chegando.disconnect(); tamanhos.disconnect(); tema.disconnect(); soltarPedido()
      window.removeEventListener('scroll', aoScroll); window.removeEventListener('resize', aoRedim)
      if (quadro) cancelAnimationFrame(quadro)
    }
  }, [])

  const irPara = (i: number) => {
    const el = secaoRef.current
    if (!el) return
    const topo = el.getBoundingClientRect().top + window.scrollY, total = el.offsetHeight - window.innerHeight
    window.scrollTo({ top: topo + total * daRolagem((i + 0.6) / CENAS.length), behavior: 'smooth' })
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
                {/* cada palavra sobe sozinha quando a cena entra (algoritmo.css, .ag-palavra) */}
                <h2>{c.titulo.split(' ').map((p, k) => (
                  <span key={k}>{k > 0 && ' '}<span className="ag-palavra" style={{ '--p': k } as CSSProperties}>{p}</span></span>
                ))}</h2>
                <p>{c.texto}</p>
              </div>
            ))}
          </div>
          <div className="ag-trilho" role="tablist" aria-label={tx('Partes do motor do OpusCash')}>
            {CENAS.map((c, i) => (
              <button key={c.titulo} role="tab" aria-selected={cena === i} aria-label={c.titulo} className={cena === i ? 'ativo' : ''} onClick={() => irPara(i)}
                style={{ '--p': i } as CSSProperties} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
