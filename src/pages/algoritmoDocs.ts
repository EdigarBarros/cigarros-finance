import { tx } from '../lib/textos'

/**
 * A cena da leitura do "motor do OpusCash" (Algoritmo.tsx): um extrato em PDF e uma planilha, desenhados no <canvas>
 * da animação. Uma linha de luz passa por eles e cada linha lida sai como um lançamento limpo (data, nome sem os
 * códigos do banco, valor, entrou ou saiu e como foi pago), que é o que lib/extrato.ts e lib/planilha.ts fazem.
 *
 * As linhas do arquivo ficam em português de propósito: é como o banco escreve.
 */
export interface LinhaLida {
  data: string
  bruto: string // como veio no arquivo
  nome: string // como vira lançamento
  valor: string
  entrou: boolean
  forma?: string
}

export const LIDAS_PDF: LinhaLida[] = [
  { data: '02/11', bruto: 'COMPRA CARTAO DEB SUPERMERC BOM PRECO 0211', nome: 'Supermercado Bom Preço', valor: '334,00', entrou: false, forma: tx('Débito') }, // sem-tx
  { data: '03/11', bruto: 'TED RECEBIDA 033 0001 SALARIO EMPRESA LTDA', nome: tx('Salário'), valor: '5.200,00', entrou: true, forma: tx('Transferência') }, // sem-tx
  { data: '05/11', bruto: 'PIX ENVIADO 123.456.789-00 MARIA SOUZA', nome: 'Maria Souza', valor: '120,00', entrou: false, forma: 'Pix' }, // sem-tx
  { data: '08/11', bruto: 'PAG BOLETO 34191.79001 01043 ENERGIA', nome: tx('Conta de luz'), valor: '187,40', entrou: false, forma: tx('Boleto') }, // sem-tx
  { data: '10/11', bruto: 'COMPRA DEB FARMACIA CENTRAL 10/11 14:32', nome: 'Farmácia Central', valor: '58,40', entrou: false, forma: tx('Débito') }, // sem-tx
]
export const LIDAS_PLANILHA: LinhaLida[] = [
  { data: '01/11', bruto: 'Aluguel', nome: tx('Aluguel'), valor: '1.800,00', entrou: false }, // sem-tx
  { data: '04/11', bruto: 'Internet', nome: tx('Internet'), valor: '119,90', entrou: false }, // sem-tx
  { data: '07/11', bruto: 'Academia', nome: tx('Academia'), valor: '99,90', entrou: false }, // sem-tx
  { data: '12/11', bruto: 'Freela design', nome: tx('Freela de design'), valor: '850,00', entrou: true }, // sem-tx
  { data: '15/11', bruto: 'Cinema', nome: tx('Cinema'), valor: '64,00', entrou: false }, // sem-tx
]

export interface DocPronto {
  img: HTMLCanvasElement
  w: number; h: number; m: number; q: number
  linhas: number[] // o meio de cada linha, a partir do topo (px)
  topoLinhas: number; fimLinhas: number
}

interface Fontes { texto: string; titulo: string; numeros: string }

function cortar(g: CanvasRenderingContext2D, texto: string, x: number, y: number, max: number) {
  g.save(); g.beginPath(); g.rect(x, y - 10, max, 20); g.clip(); g.fillText(texto, x, y); g.restore()
}

function folha(w: number, h: number, q: number, m: number) {
  const img = document.createElement('canvas')
  img.width = Math.ceil((w + m * 2) * q); img.height = Math.ceil((h + m * 2) * q)
  const g = img.getContext('2d')!
  g.scale(q, q); g.translate(m, m)
  g.beginPath(); g.roundRect(0, 0, w, h, 10)
  g.fillStyle = '#f7f1e6'
  g.save(); g.shadowColor = 'rgba(255,160,40,0.5)'; g.shadowBlur = 34; g.fill(); g.restore()
  g.textBaseline = 'middle'
  return g
}

function selo(g: CanvasRenderingContext2D, x: number, y: number, texto: string, cor: string, f: Fontes) {
  g.font = `800 9.5px ${f.texto}`
  const lw = g.measureText(texto).width + 12
  g.beginPath(); g.roundRect(x, y - 9, lw, 18, 5); g.fillStyle = cor; g.fill()
  g.fillStyle = '#fff'; g.fillText(texto, x + 6, y + 0.5)
  return lw
}

/** O extrato do banco em PDF: o cabeçalho, as linhas como o banco escreve e o saldo. */
function desenharPdf(w: number, h: number, q: number, f: Fontes): DocPronto {
  const m = 40, g = folha(w, h, q, m)
  const pad = 14
  const lx = selo(g, pad, pad + 10, 'PDF', '#e0473e', f)
  g.fillStyle = '#2a2117'; g.font = `700 12px ${f.texto}`
  cortar(g, 'extrato_novembro.pdf', pad + lx + 8, pad + 10, w - pad * 2 - lx - 8) // sem-tx
  g.fillStyle = '#8a7a66'; g.font = `500 9.5px ${f.texto}`
  cortar(g, tx('Extrato da conta corrente'), pad, pad + 30, w - pad * 2)
  const topoLinhas = pad + 46
  g.fillStyle = 'rgba(42,33,23,0.15)'; g.fillRect(pad, topoLinhas - 4, w - pad * 2, 1)
  const fimLinhas = h - 34, passo = (fimLinhas - topoLinhas) / LIDAS_PDF.length
  const linhas: number[] = []
  LIDAS_PDF.forEach((l, i) => {
    const y = topoLinhas + passo * (i + 0.5)
    linhas.push(y)
    g.fillStyle = '#8a7a66'; g.font = `600 8.5px ${f.numeros}`
    g.fillText(l.data, pad, y)
    g.fillStyle = '#3b3025'; g.font = `500 9.5px ui-monospace, Consolas, monospace`
    cortar(g, l.bruto, pad + 32, y, w - pad * 2 - 32 - 58)
    g.textAlign = 'right'; g.font = `700 9px ${f.numeros}`
    g.fillStyle = l.entrou ? '#1d8a55' : '#b23a3a'
    g.fillText(`${l.entrou ? '' : '-'}${l.valor}`, w - pad, y)
    g.textAlign = 'left'
    if (i < LIDAS_PDF.length - 1) { g.fillStyle = 'rgba(42,33,23,0.07)'; g.fillRect(pad, y + passo / 2, w - pad * 2, 1) }
  })
  g.fillStyle = 'rgba(42,33,23,0.15)'; g.fillRect(pad, fimLinhas + 2, w - pad * 2, 1)
  g.fillStyle = '#8a7a66'; g.font = `600 9px ${f.texto}`
  g.fillText(tx('Saldo do dia'), pad, h - 17)
  g.textAlign = 'right'; g.fillStyle = '#2a2117'; g.font = `800 10px ${f.numeros}`
  g.fillText('4.380,20', w - pad, h - 17) // sem-tx
  g.textAlign = 'left'
  return { img: g.canvas, w, h, m, q, linhas, topoLinhas, fimLinhas }
}

/** A planilha: as letras das colunas, o cabeçalho e uma linha por lançamento, com a grade. */
function desenharPlanilha(w: number, h: number, q: number, f: Fontes): DocPronto {
  const m = 40, g = folha(w, h, q, m)
  const pad = 14
  const lx = selo(g, pad, pad + 10, 'XLSX', '#1f8f4e', f)
  g.fillStyle = '#2a2117'; g.font = `700 12px ${f.texto}`
  cortar(g, 'gastos_novembro.xlsx', pad + lx + 8, pad + 10, w - pad * 2 - lx - 8) // sem-tx
  const x0 = pad, x1 = w - pad, gx = [x0, x0 + 18, x0 + 58, x1 - 62, x1]
  const yLetras = pad + 30
  const topoLinhas = yLetras + 26, fimLinhas = h - 14
  const passo = (fimLinhas - topoLinhas) / LIDAS_PLANILHA.length
  // a faixa das letras e o cabeçalho
  g.fillStyle = '#e9e2d5'; g.fillRect(x0, yLetras - 8, x1 - x0, 16)
  g.fillStyle = '#dff1e5'; g.fillRect(x0 + 18, yLetras + 8, x1 - x0 - 18, topoLinhas - yLetras - 8)
  g.fillStyle = '#e9e2d5'; g.fillRect(x0, yLetras + 8, 18, fimLinhas - yLetras - 8)
  g.fillStyle = '#8a7a66'; g.font = `700 8px ${f.texto}`; g.textAlign = 'center'
  ;['A', 'B', 'C'].forEach((c, i) => g.fillText(c, (gx[i + 1] + gx[i + 2]) / 2, yLetras)) // sem-tx
  g.textAlign = 'left'; g.fillStyle = '#1f6b3d'; g.font = `800 8.5px ${f.texto}`
  const yCab = (yLetras + 8 + topoLinhas) / 2
  cortar(g, tx('Data'), gx[1] + 5, yCab, gx[2] - gx[1] - 8)
  cortar(g, tx('Descrição'), gx[2] + 5, yCab, gx[3] - gx[2] - 8)
  cortar(g, tx('Valor'), gx[3] + 5, yCab, gx[4] - gx[3] - 8)
  const linhas: number[] = []
  LIDAS_PLANILHA.forEach((l, i) => {
    const y = topoLinhas + passo * (i + 0.5)
    linhas.push(y)
    g.fillStyle = '#8a7a66'; g.font = `600 8px ${f.numeros}`; g.textAlign = 'center'
    g.fillText(String(i + 2), (gx[0] + gx[1]) / 2, y)
    g.textAlign = 'left'; g.fillStyle = '#3b3025'; g.font = `500 8.5px ${f.numeros}`
    g.fillText(l.data, gx[1] + 5, y)
    g.font = `500 9px ${f.texto}`
    cortar(g, l.bruto, gx[2] + 5, y, gx[3] - gx[2] - 8)
    g.textAlign = 'right'; g.font = `600 9px ${f.numeros}`
    g.fillStyle = l.entrou ? '#1d8a55' : '#3b3025'
    g.fillText(`${l.entrou ? '' : '-'}${l.valor}`, gx[4] - 5, y)
    g.textAlign = 'left'
  })
  // a grade
  g.strokeStyle = 'rgba(42,33,23,0.14)'; g.lineWidth = 1
  g.beginPath()
  for (const x of gx) { g.moveTo(x + 0.5, yLetras - 8); g.lineTo(x + 0.5, fimLinhas) }
  for (let i = 0; i <= LIDAS_PLANILHA.length; i++) { const y = topoLinhas + passo * i + 0.5; g.moveTo(x0, y); g.lineTo(x1, y) }
  g.moveTo(x0, yLetras + 8.5); g.lineTo(x1, yLetras + 8.5)
  g.stroke()
  return { img: g.canvas, w, h, m, q, linhas, topoLinhas, fimLinhas }
}

export function desenharDocs(w: number, h: number, q: number, f: Fontes) {
  return { pdf: desenharPdf(w, h, q, f), planilha: desenharPlanilha(w, h, q, f) }
}

/** O lançamento que sai de uma linha lida: um cartão de vidro dourado, desenhado a cada quadro (são poucos). */
export function desenharLancamento(g: CanvasRenderingContext2D, l: LinhaLida, x: number, y: number, esc: number, alfa: number, f: Fontes) {
  const w = 248, h = 48
  g.save()
  g.globalAlpha = alfa
  g.translate(x, y); g.scale(esc, esc)
  g.beginPath(); g.roundRect(-w / 2, -h / 2, w, h, 13)
  g.fillStyle = 'rgba(28,17,6,0.9)'; g.fill()
  g.strokeStyle = 'rgba(255,190,90,0.55)'; g.lineWidth = 1; g.stroke()
  const cor = l.entrou ? '#5fe0a0' : '#ff8a8a'
  // a seta de entrou ou saiu
  g.beginPath(); g.arc(-w / 2 + 22, 0, 13, 0, Math.PI * 2)
  g.fillStyle = l.entrou ? 'rgba(95,224,160,0.16)' : 'rgba(255,120,120,0.16)'; g.fill()
  g.strokeStyle = cor; g.lineWidth = 1.8; g.lineCap = 'round'; g.lineJoin = 'round'
  const d = l.entrou ? 1 : -1
  g.beginPath(); g.moveTo(-w / 2 + 22, 5 * d); g.lineTo(-w / 2 + 22, -5 * d)
  g.moveTo(-w / 2 + 18, -1 * d); g.lineTo(-w / 2 + 22, -5 * d); g.lineTo(-w / 2 + 26, -1 * d); g.stroke()
  g.textBaseline = 'middle'
  const xt = -w / 2 + 42
  g.fillStyle = '#fff2dc'; g.font = `700 12px ${f.texto}`
  cortar(g, l.nome, xt, -7, w - 42 - 100)
  g.fillStyle = 'rgba(255,225,180,0.62)'; g.font = `500 10px ${f.texto}`
  cortar(g, l.forma ? `${l.data} · ${l.forma}` : l.data, xt, 9, w - 42 - 100)
  g.textAlign = 'right'; g.fillStyle = cor; g.font = `800 12px ${f.numeros}`
  g.fillText(`${l.entrou ? '+' : '−'} R$ ${l.valor}`, w / 2 - 11, 0) // sem-tx
  g.restore()
}
