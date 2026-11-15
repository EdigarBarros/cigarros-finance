import { tx } from '../lib/textos'

/**
 * A cena da leitura do "motor do OpusCash" (Algoritmo.tsx): um extrato em PDF e uma planilha, desenhados no <canvas>
 * da animação. Uma linha de luz passa por eles; o texto de cada linha lida sai do documento já limpo (o nome sem os
 * códigos do banco e o valor), entra por um fio da rede e se desfaz em cubinhos de dados, na cor do que ele é:
 * verde o que entrou, vermelho o que saiu, amarelo as dívidas. É o que lib/extrato.ts e lib/planilha.ts fazem.
 *
 * As linhas do arquivo ficam em português de propósito: é como o banco escreve.
 */
export type Tipo = 'entrada' | 'saida' | 'divida'
export interface LinhaLida {
  data: string
  bruto: string // como veio no arquivo
  nome: string // como vira lançamento
  valor: string
  tipo: Tipo
}

export const LIDAS_PDF: LinhaLida[] = [
  { data: '02/11', bruto: 'COMPRA CARTAO DEB SUPERMERC BOM PRECO 0211', nome: 'Supermercado Bom Preço', valor: '334,00', tipo: 'saida' }, // sem-tx
  { data: '03/11', bruto: 'TED RECEBIDA 033 0001 SALARIO EMPRESA LTDA', nome: tx('Salário'), valor: '5.200,00', tipo: 'entrada' }, // sem-tx
  { data: '05/11', bruto: 'PIX ENVIADO 123.456.789-00 MARIA SOUZA', nome: 'Maria Souza', valor: '120,00', tipo: 'saida' }, // sem-tx
  { data: '08/11', bruto: 'PARC EMPRESTIMO PESSOAL 08/24 CONTR 5521', nome: tx('Empréstimo pessoal'), valor: '612,30', tipo: 'divida' }, // sem-tx
  { data: '10/11', bruto: 'PAG BOLETO 34191.79001 01043 ENERGIA', nome: tx('Conta de luz'), valor: '187,40', tipo: 'saida' }, // sem-tx
]
export const LIDAS_PLANILHA: LinhaLida[] = [
  { data: '01/11', bruto: 'Aluguel', nome: tx('Aluguel'), valor: '1.800,00', tipo: 'saida' }, // sem-tx
  { data: '04/11', bruto: 'Internet', nome: tx('Internet'), valor: '119,90', tipo: 'saida' }, // sem-tx
  { data: '07/11', bruto: 'Parcela carro 14/48', nome: tx('Financiamento do carro'), valor: '890,00', tipo: 'divida' }, // sem-tx
  { data: '12/11', bruto: 'Freela design', nome: tx('Freela de design'), valor: '850,00', tipo: 'entrada' }, // sem-tx
  { data: '15/11', bruto: 'Cinema', nome: tx('Cinema'), valor: '64,00', tipo: 'saida' }, // sem-tx
]
/** Todas as linhas, na ordem em que são lidas (o PDF e depois a planilha). */
export const LIDAS = [...LIDAS_PDF, ...LIDAS_PLANILHA]

/** As cores de cada tipo (as do gráfico do app): na tela escura e no papel branco. */
export const COR_TIPO: Record<Tipo, [number, number, number]> = { entrada: [46, 214, 128], saida: [255, 92, 108], divida: [255, 214, 10] }
const COR_PAPEL: Record<Tipo, string> = { entrada: '#16884f', saida: '#c8333f', divida: '#b88a00' }
const SINAL: Record<Tipo, string> = { entrada: '+', saida: '−', divida: '−' }

export interface DocPronto {
  img: HTMLCanvasElement
  w: number; h: number; m: number; q: number
  linhas: number[] // o meio de cada linha, a partir do topo (px)
  topoLinhas: number; fimLinhas: number
}

interface Fontes { texto: string; titulo: string; numeros: string }

/** A largura em que os documentos são desenhados; maiores ou menores, tudo cresce junto. */
const LARGO = 320

function cortar(g: CanvasRenderingContext2D, texto: string, x: number, y: number, max: number) {
  g.save(); g.beginPath(); g.rect(x, y - 12, max, 24); g.clip(); g.fillText(texto, x, y); g.restore()
}

/** Uma folha branca de w × h px (desenhada em unidades de LARGO de largura), com margem m para a sombra. */
function folha(w: number, h: number, q: number, m: number) {
  const img = document.createElement('canvas')
  img.width = Math.ceil((w + m * 2) * q); img.height = Math.ceil((h + m * 2) * q)
  const g = img.getContext('2d')!
  g.scale(q, q); g.translate(m, m)
  g.beginPath(); g.roundRect(0, 0, w, h, 12)
  g.save(); g.shadowColor = 'rgba(150,175,220,0.22)'; g.shadowBlur = 40; g.fillStyle = '#fbfcfe'; g.fill(); g.restore()
  const s = w / LARGO
  g.scale(s, s)
  g.textBaseline = 'middle'
  return { g, s, hd: h / s }
}

function selo(g: CanvasRenderingContext2D, x: number, y: number, texto: string, cor: string, f: Fontes) {
  g.font = `800 10px ${f.texto}`
  const lw = g.measureText(texto).width + 14
  g.beginPath(); g.roundRect(x, y - 10, lw, 20, 5); g.fillStyle = cor; g.fill()
  g.fillStyle = '#fff'; g.fillText(texto, x + 7, y + 0.5)
  return lw
}

/** O extrato do banco em PDF: o cabeçalho, as linhas como o banco escreve e o saldo. */
function desenharPdf(w: number, h: number, q: number, f: Fontes): DocPronto {
  const m = 44, { g, s, hd } = folha(w, h, q, m), W = LARGO
  const pad = 16
  const lx = selo(g, pad, pad + 11, 'PDF', '#e0473e', f)
  g.fillStyle = '#1d2330'; g.font = `700 13px ${f.texto}`
  cortar(g, 'extrato_novembro.pdf', pad + lx + 9, pad + 11, W - pad * 2 - lx - 9) // sem-tx
  g.fillStyle = '#7a8394'; g.font = `500 10.5px ${f.texto}`
  cortar(g, tx('Extrato da conta corrente'), pad, pad + 34, W - pad * 2)
  const topoLinhas = pad + 52
  g.fillStyle = 'rgba(29,35,48,0.14)'; g.fillRect(pad, topoLinhas - 4, W - pad * 2, 1)
  const fimLinhas = hd - 38, passo = (fimLinhas - topoLinhas) / LIDAS_PDF.length
  const linhas: number[] = []
  LIDAS_PDF.forEach((l, i) => {
    const y = topoLinhas + passo * (i + 0.5)
    linhas.push(y * s)
    g.fillStyle = '#7a8394'; g.font = `600 9.5px ${f.numeros}`
    g.fillText(l.data, pad, y)
    g.fillStyle = '#2c3342'; g.font = `500 10px ui-monospace, Consolas, monospace`
    cortar(g, l.bruto, pad + 36, y, W - pad * 2 - 36 - 64)
    g.textAlign = 'right'; g.font = `700 10.5px ${f.numeros}`
    g.fillStyle = COR_PAPEL[l.tipo]
    g.fillText(`${l.tipo === 'entrada' ? '' : '-'}${l.valor}`, W - pad, y)
    g.textAlign = 'left'
    if (i < LIDAS_PDF.length - 1) { g.fillStyle = 'rgba(29,35,48,0.07)'; g.fillRect(pad, y + passo / 2, W - pad * 2, 1) }
  })
  g.fillStyle = 'rgba(29,35,48,0.14)'; g.fillRect(pad, fimLinhas + 2, W - pad * 2, 1)
  g.fillStyle = '#7a8394'; g.font = `600 10px ${f.texto}`
  g.fillText(tx('Saldo do dia'), pad, hd - 19)
  g.textAlign = 'right'; g.fillStyle = '#1d2330'; g.font = `800 11.5px ${f.numeros}`
  g.fillText('4.380,20', W - pad, hd - 19) // sem-tx
  g.textAlign = 'left'
  return { img: g.canvas, w, h, m, q, linhas, topoLinhas: topoLinhas * s, fimLinhas: fimLinhas * s }
}

/** A planilha: as letras das colunas, o cabeçalho e uma linha por lançamento, com a grade. */
function desenharPlanilha(w: number, h: number, q: number, f: Fontes): DocPronto {
  const m = 44, { g, s, hd } = folha(w, h, q, m), W = LARGO
  const pad = 16
  const lx = selo(g, pad, pad + 11, 'XLSX', '#1f8f4e', f)
  g.fillStyle = '#1d2330'; g.font = `700 13px ${f.texto}`
  cortar(g, 'gastos_novembro.xlsx', pad + lx + 9, pad + 11, W - pad * 2 - lx - 9) // sem-tx
  const x0 = pad, x1 = W - pad, gx = [x0, x0 + 20, x0 + 64, x1 - 70, x1]
  const yLetras = pad + 34
  const topoLinhas = yLetras + 28, fimLinhas = hd - 16
  const passo = (fimLinhas - topoLinhas) / LIDAS_PLANILHA.length
  // a faixa das letras e o cabeçalho
  g.fillStyle = '#eceff4'; g.fillRect(x0, yLetras - 9, x1 - x0, 18)
  g.fillStyle = '#e3f3e9'; g.fillRect(x0 + 20, yLetras + 9, x1 - x0 - 20, topoLinhas - yLetras - 9)
  g.fillStyle = '#eceff4'; g.fillRect(x0, yLetras + 9, 20, fimLinhas - yLetras - 9)
  g.fillStyle = '#7a8394'; g.font = `700 9px ${f.texto}`; g.textAlign = 'center'
  ;['A', 'B', 'C'].forEach((c, i) => g.fillText(c, (gx[i + 1] + gx[i + 2]) / 2, yLetras)) // sem-tx
  g.textAlign = 'left'; g.fillStyle = '#1f6b3d'; g.font = `800 9.5px ${f.texto}`
  const yCab = (yLetras + 9 + topoLinhas) / 2
  cortar(g, tx('Data'), gx[1] + 6, yCab, gx[2] - gx[1] - 9)
  cortar(g, tx('Descrição'), gx[2] + 6, yCab, gx[3] - gx[2] - 9)
  cortar(g, tx('Valor'), gx[3] + 6, yCab, gx[4] - gx[3] - 9)
  const linhas: number[] = []
  LIDAS_PLANILHA.forEach((l, i) => {
    const y = topoLinhas + passo * (i + 0.5)
    linhas.push(y * s)
    g.fillStyle = '#7a8394'; g.font = `600 9px ${f.numeros}`; g.textAlign = 'center'
    g.fillText(String(i + 2), (gx[0] + gx[1]) / 2, y)
    g.textAlign = 'left'; g.fillStyle = '#2c3342'; g.font = `500 9.5px ${f.numeros}`
    g.fillText(l.data, gx[1] + 6, y)
    g.font = `500 10px ${f.texto}`
    cortar(g, l.bruto, gx[2] + 6, y, gx[3] - gx[2] - 9)
    g.textAlign = 'right'; g.font = `700 10px ${f.numeros}`
    g.fillStyle = COR_PAPEL[l.tipo]
    g.fillText(`${l.tipo === 'entrada' ? '' : '-'}${l.valor}`, gx[4] - 6, y)
    g.textAlign = 'left'
  })
  // a grade
  g.strokeStyle = 'rgba(29,35,48,0.13)'; g.lineWidth = 1
  g.beginPath()
  for (const x of gx) { g.moveTo(x + 0.5, yLetras - 9); g.lineTo(x + 0.5, fimLinhas) }
  for (let i = 0; i <= LIDAS_PLANILHA.length; i++) { const y = topoLinhas + passo * i + 0.5; g.moveTo(x0, y); g.lineTo(x1, y) }
  g.moveTo(x0, yLetras + 9.5); g.lineTo(x1, yLetras + 9.5)
  g.stroke()
  return { img: g.canvas, w, h, m, q, linhas, topoLinhas: topoLinhas * s, fimLinhas: fimLinhas * s }
}

/** O texto que sai de uma linha lida: o nome limpo e o valor, na cor do tipo, e os pontos das letras. */
export interface TextoLido {
  img: HTMLCanvasElement
  w: number; h: number; m: number; q: number
  /** x, y, x, y... dos pontos das letras, a partir do meio do texto (px de CSS) */
  pontos: Float32Array
  /** a cor do tipo (r, g, b) */
  cor: [number, number, number]
}

export function desenharTextos(q: number, f: Fontes): TextoLido[] {
  return LIDAS.map((l, idx) => {
    const cor = COR_TIPO[l.tipo], css = `rgb(${cor.join(',')})`
    const medir = document.createElement('canvas').getContext('2d')!
    const fNome = `700 15px ${f.texto}`, fValor = `800 15px ${f.numeros}`
    const valor = `${SINAL[l.tipo]} R$ ${l.valor}` // sem-tx
    medir.font = fNome; const wn = medir.measureText(l.nome).width
    medir.font = fValor; const wv = medir.measureText(valor).width
    const w = Math.ceil(wn + 12 + wv), h = 22, m = 16
    const img = document.createElement('canvas')
    img.width = Math.ceil((w + m * 2) * q); img.height = Math.ceil((h + m * 2) * q)
    const g = img.getContext('2d', { willReadFrequently: true })!
    g.scale(q, q); g.translate(m, m)
    g.textBaseline = 'middle'
    const pintar = () => {
      g.font = fNome; g.fillStyle = '#f4f7ff'; g.fillText(l.nome, 0, h / 2)
      g.font = fValor; g.fillStyle = css; g.fillText(valor, wn + 12, h / 2)
    }
    // os pontos das letras: o desenho sem brilho, lido ponto a ponto
    pintar()
    const d = g.getImageData(0, 0, img.width, img.height).data, achados: number[] = []
    for (let i = 3; i < d.length; i += 4) if (d[i] > 140) achados.push((i - 3) / 4)
    const N = 700, pontos = new Float32Array(N * 2)
    let s = idx * 7919 + 1
    const r = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296 }
    for (let i = 0; i < N; i++) {
      const p = achados.length ? achados[Math.floor(r() * achados.length)] : 0
      pontos[i * 2] = (p % img.width) / q - m - w / 2
      pontos[i * 2 + 1] = Math.floor(p / img.width) / q - m - h / 2
    }
    // por cima, o mesmo texto com um brilho da cor dele
    g.clearRect(-m, -m, w + m * 2, h + m * 2)
    g.save(); g.shadowColor = `rgba(${cor.join(',')},0.7)`; g.shadowBlur = 12; pintar(); g.restore()
    pintar()
    return { img, w, h, m, q, pontos, cor }
  })
}

export function desenharDocs(w: number, h: number, q: number, f: Fontes) {
  return { pdf: desenharPdf(w, h, q, f), planilha: desenharPlanilha(w, h, q, f), textos: desenharTextos(q, f) }
}
