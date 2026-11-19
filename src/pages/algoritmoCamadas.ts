import { fmtMesAno } from '../lib/format'
import { tx } from '../lib/textos'
import { LIDAS_PDF, SINAL, type Tipo } from './algoritmoDocs'

/**
 * As camadas do túnel do "motor do OpusCash" (Algoritmo.tsx): o que está por trás de cada conselho, na ordem em que a
 * câmera passa por elas entre a tela do Consultor e a rede:
 *   0. os lançamentos do mês (as mesmas linhas que a cena seguinte lê do extrato);
 *   1. as dívidas, com o quanto já foi pago e quando acabam (as do destaque da tela do Consultor);
 *   2. as contas que o motor faz com isso (as do perfil da tela: parcelas, o que guarda, o que sobra).
 *
 * Cada camada é feita só de quadradinhos: o desenho dela (textos, barras, contornos) é feito uma vez num quadriculado
 * pequeno, e cada casa pintada vira um quadradinho, do tamanho da tinta que tem nela (letra cheia, quadradinho cheio;
 * beirada da letra, quadradinho menor). Quem os tira dos fios do túnel, junta e solta de novo é o Algoritmo.tsx.
 */
export interface Camada {
  /** quantos quadradinhos */
  n: number
  /** largura e altura do quadriculado, em casas */
  w: number; h: number
  /** onde fica cada um, em casas, a partir do meio da camada */
  u: Float32Array; v: Float32Array
  /** o lado de cada um (0 a 1 da casa) */
  lado: Float32Array
  /** a cor: 0 texto, 1 traço fraco, 2 destaque, 3 entrada, 4 saída, 5 dívida */
  cor: Uint8Array
  /** de qual fio da beirada do túnel ele sai (0 a 17), um pouco mais à frente ou atrás nele (0 a 1) */
  fio: Uint8Array; df: Float32Array
  /** a vez dele (0 a 1): a camada se escreve da esquerda para a direita */
  vez: Float32Array
}
export const TEXTO = 0, FRACO = 1, DESTAQUE = 2
const COR_DO_TIPO: Record<Tipo, number> = { entrada: 3, saida: 4, divida: 5 }

interface Fontes { texto: string; titulo: string; numeros: string }
type G = CanvasRenderingContext2D

function sorteio(semente: number) {
  let s = semente
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296 }
}
/** A tinta de cada cor: o número da cor vai no vermelho (o desenho é lido de volta casa por casa). */
const tinta = (cor: number) => `rgb(${20 + 40 * cor},0,0)`

function escrever(g: G, texto: string, x: number, y: number, fonte: string, cor: number, lado: CanvasTextAlign = 'left') {
  g.font = fonte; g.fillStyle = tinta(cor); g.textAlign = lado
  g.fillText(texto, x, y)
}
/** Quebra o texto em linhas que caibam na largura (a fonte já escolhida no g). */
function quebrar(g: G, texto: string, largura: number) {
  const linhas: string[] = []
  let atual = ''
  for (const palavra of texto.split(' ')) {
    const tentativa = atual ? `${atual} ${palavra}` : palavra
    if (atual && g.measureText(tentativa).width > largura) { linhas.push(atual); atual = palavra } else atual = tentativa
  }
  if (atual) linhas.push(atual)
  return linhas
}
/** A maior fonte (entre max e min px) em que o texto cabe na largura. */
function fonteQueCabe(g: G, texto: string, largura: number, peso: number, max: number, min: number, familia: string) {
  for (let t = max; t > min; t -= 0.5) { g.font = `${peso} ${t}px ${familia}`; if (g.measureText(texto).width <= largura) return g.font }
  return `${peso} ${min}px ${familia}`
}
function titulo(g: G, texto: string, W: number, f: Fontes) {
  escrever(g, texto.toUpperCase(), 3, 10, tx('800 9px {0}', f.titulo), DESTAQUE)
  g.fillStyle = tinta(FRACO); g.fillRect(3, 15, W - 6, 1)
}
/** Uma barra de progresso: a parte paga na cor, o resto fraco. */
function barra(g: G, x: number, y: number, w: number, pago: number, cor: number) {
  g.fillStyle = tinta(FRACO); g.fillRect(x, y, w, 7)
  g.fillStyle = tinta(cor); g.fillRect(x, y, Math.round(w * pago), 7)
}

const DIVIDAS = [
  { nome: () => tx('Empréstimo pessoal'), fim: () => fmtMesAno(2027, 6), pago: 0.62 },
  { nome: () => tx('Financiamento do carro'), fim: () => fmtMesAno(2028, 10), pago: 0.29 },
]
const CONTAS = [
  { n: '42%', t: () => tx('do que entra vai para parcelas'), cor: 4 }, // sem-tx
  { n: '8%', t: () => tx('do que entra fica guardado'), cor: 5 }, // sem-tx
  { n: 'R$ 1.937', t: () => tx('devem sobrar neste mês'), cor: 3 }, // sem-tx
]

function lancamentos(g: G, W: number, cel: boolean, f: Fontes) {
  titulo(g, tx('Seus lançamentos'), W, f)
  LIDAS_PDF.forEach((l, i) => {
    const valor = `${SINAL[l.tipo]} R$ ${l.valor}` // sem-tx
    if (cel) {
      const y = 31 + i * 33
      escrever(g, l.nome, 3, y, fonteQueCabe(g, l.nome, W - 6, 600, 10.5, 8, f.texto), TEXTO)
      escrever(g, valor, 3, y + 14, tx('800 12px {0}', f.numeros), COR_DO_TIPO[l.tipo])
      g.fillStyle = tinta(FRACO); g.fillRect(3, y + 20, W - 6, 1)
    } else {
      const y = 32 + i * 18
      g.font = tx('800 11.5px {0}', f.numeros)
      const cabe = W - 6 - g.measureText(valor).width - 10
      escrever(g, l.nome, 3, y, fonteQueCabe(g, l.nome, cabe, 600, 11.5, 8.5, f.texto), TEXTO)
      escrever(g, valor, W - 3, y, tx('800 11.5px {0}', f.numeros), COR_DO_TIPO[l.tipo], 'right')
      g.fillStyle = tinta(FRACO); g.fillRect(3, y + 6, W - 6, 1)
    }
  })
}
function dividas(g: G, W: number, cel: boolean, f: Fontes) {
  titulo(g, tx('Suas dívidas'), W, f)
  DIVIDAS.forEach((d, i) => {
    const alto = cel ? 78 : 42, y0 = 22 + i * (alto + (cel ? 8 : 5))
    g.strokeStyle = tinta(FRACO); g.lineWidth = 1; g.strokeRect(1.5, y0 + 0.5, W - 3, alto)
    const fim = tx('acaba em {0}', d.fim()), pago = tx('{0}% pago', Math.round(d.pago * 100))
    if (cel) {
      g.font = tx('700 10.5px {0}', f.texto)
      const linhas = quebrar(g, d.nome(), W - 14)
      linhas.slice(0, 2).forEach((t, k) => escrever(g, t, 7, y0 + 14 + k * 12, tx('700 10.5px {0}', f.texto), TEXTO))
      escrever(g, fim, 7, y0 + 42, fonteQueCabe(g, fim, W - 14, 600, 9.5, 7.5, f.texto), 5)
      barra(g, 7, y0 + 50, W - 14, d.pago, 5)
      escrever(g, pago, 7, y0 + 70, tx('600 9px {0}', f.texto), TEXTO)
    } else {
      escrever(g, d.nome(), 8, y0 + 14, tx('700 11.5px {0}', f.texto), TEXTO)
      barra(g, 8, y0 + 20, W - 16, d.pago, 5)
      escrever(g, pago, 8, y0 + 38, tx('600 9px {0}', f.texto), TEXTO)
      escrever(g, fim, W - 8, y0 + 38, tx('600 9px {0}', f.texto), 5, 'right')
    }
  })
}
function contas(g: G, W: number, cel: boolean, f: Fontes) {
  titulo(g, tx('As contas do motor'), W, f)
  CONTAS.forEach((c, i) => {
    if (cel) {
      const y0 = 22 + i * 58
      escrever(g, c.n, 3, y0 + 24, tx('800 26px {0}', f.numeros), c.cor)
      g.font = tx('600 9.5px {0}', f.texto)
      quebrar(g, c.t(), W - 6).slice(0, 2).forEach((t, k) => escrever(g, t, 3, y0 + 37 + k * 11, tx('600 9.5px {0}', f.texto), TEXTO))
    } else {
      const y = 42 + i * 30, meio = 116
      escrever(g, c.n, meio - 4, y, tx('800 24px {0}', f.numeros), c.cor, 'right')
      g.font = tx('600 10.5px {0}', f.texto)
      const linhas = quebrar(g, c.t(), W - meio - 7).slice(0, 2)
      linhas.forEach((t, k) => escrever(g, t, meio + 4, y - (linhas.length > 1 ? 10 : 4) + k * 12, tx('600 10.5px {0}', f.texto), TEXTO))
    }
  })
}

/** As três camadas, no quadriculado do computador ou no do celular (em pé). */
export function montarCamadas(cel: boolean, f: Fontes): Camada[] {
  const W = cel ? 112 : 216, H = cel ? 196 : 116
  const r = sorteio(41)
  return [lancamentos, dividas, contas].map((desenho) => {
    const c = document.createElement('canvas')
    c.width = W; c.height = H
    const g = c.getContext('2d', { willReadFrequently: true })!
    g.textBaseline = 'alphabetic'
    desenho(g, W, cel, f)
    const px = g.getImageData(0, 0, W, H).data
    const casas: number[] = []
    for (let i = 0; i < W * H; i++) if (px[i * 4 + 3] >= 56) casas.push(i)
    const n = casas.length
    const cam: Camada = {
      n, w: W, h: H, u: new Float32Array(n), v: new Float32Array(n), lado: new Float32Array(n), cor: new Uint8Array(n),
      fio: new Uint8Array(n), df: new Float32Array(n), vez: new Float32Array(n),
    }
    // por cor (o desenho troca menos de tinta) e, dentro dela, na ordem do quadriculado
    casas.sort((a, b) => px[a * 4] - px[b * 4] || a - b)
    casas.forEach((i, k) => {
      const x = i % W, y = Math.floor(i / W), a = px[i * 4 + 3] / 255
      cam.u[k] = x + 0.5 - W / 2; cam.v[k] = y + 0.5 - H / 2
      cam.lado[k] = 0.9 * Math.max(0.42, Math.sqrt(a))
      // a tinta volta com a transparência misturada: o vermelho que saiu dividido por ela é o da cor
      cam.cor[k] = Math.max(0, Math.min(5, Math.round((px[i * 4] - 20) / 40)))
      cam.fio[k] = Math.floor(r() * 18); cam.df[k] = r()
      cam.vez[k] = 0.62 * (x / W) + 0.38 * r()
    })
    return cam
  })
}
