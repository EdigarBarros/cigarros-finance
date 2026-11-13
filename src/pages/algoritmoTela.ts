import { tx } from '../lib/textos'

/**
 * A tela do Consultor do fim do "motor do OpusCash" (Algoritmo.tsx), desenhada no próprio <canvas> da animação.
 * Não é uma camada por cima: os fragmentos pousam nos traços dela (letras, o círculo da nota, as barras, a moldura) e
 * depois ela acende de cima para baixo no lugar deles.
 *
 * desenharTela(w, h) devolve a imagem pronta (com uma margem para o brilho) e os pontos dos traços, sorteados a partir
 * de uma máscara: só o que é traço (texto, linhas, barras), sem os fundos.
 */
export const PILARES = [
  { nome: tx('Sobra'), v: 0.78, c: '#9df5c9' }, { nome: tx('Reserva'), v: 0.52, c: '#7cc8ff' },
  { nome: tx('Dívidas'), v: 0.44, c: '#ffc46b' }, { nome: tx('Cartão'), v: 0.81, c: '#d7a6ff' },
  { nome: tx('Gastos'), v: 0.67, c: '#ff9a8a' }, { nome: tx('Metas'), v: 0.71, c: '#9df5c9' },
]
export const PLANO = [
  { t: tx('Adiante o Empréstimo pessoal'), d: tx('a dívida mais cara') },
  { t: tx('Vai sobrar R$ 1.937'), d: tx('previsão para o dia 31') },
  { t: tx('Cancele 3 assinaturas'), d: tx('R$ 418 a mais no ano') },
]
const NOTA = 72

const TINTA = '#fff2dc', TINTA2 = 'rgba(255,236,210,0.72)', APAGADO = 'rgba(255,225,180,0.6)', OURO = '#ffc46b', VERDE = '#9df5c9'

export interface TelaPronta {
  img: HTMLCanvasElement // a tela já desenhada, com margem m em volta (px de CSS × q)
  w: number; h: number; m: number; q: number
  pontos: Float32Array // x, y, x, y... a partir do centro da tela (px de CSS)
}

interface Fontes { texto: string; titulo: string; numeros: string }

function retangulo(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath()
  g.roundRect(x, y, w, h, r)
}

/** Escreve sem passar da largura: diminui a letra até caber (as traduções podem ser mais compridas). */
function escrever(g: CanvasRenderingContext2D, texto: string, x: number, y: number, max: number, peso: number, tam: number, familia: string) {
  let t = tam
  g.font = `${peso} ${t}px ${familia}`
  while (t > 8 && g.measureText(texto).width > max) { t -= 0.5; g.font = `${peso} ${t}px ${familia}` }
  g.fillText(texto, x, y)
}

/**
 * Desenha a tela em w × h px. Com mascara, só os traços, em branco e um pouco mais grossos (de onde saem os pontos
 * dos fragmentos); sem, a tela de verdade.
 */
function pintar(g: CanvasRenderingContext2D, w: number, h: number, f: Fontes, mascara: boolean) {
  const em = (cor: string) => (mascara ? '#fff' : cor)
  const deitada = w >= 520
  const pad = deitada ? 24 : 16
  g.textBaseline = 'middle'
  g.textAlign = 'left'

  // o vidro e a moldura
  if (!mascara) {
    retangulo(g, 0, 0, w, h, deitada ? 22 : 18)
    const fundo = g.createLinearGradient(0, 0, w * 0.6, h)
    fundo.addColorStop(0, 'rgba(44,26,7,0.9)'); fundo.addColorStop(1, 'rgba(14,9,3,0.94)')
    g.fillStyle = fundo
    g.save(); g.shadowColor = 'rgba(255,160,40,0.55)'; g.shadowBlur = 40; g.fill(); g.restore()
    // luz por dentro, vinda das bordas
    const dentro = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.7)
    dentro.addColorStop(0, 'rgba(255,170,60,0)'); dentro.addColorStop(1, 'rgba(255,170,60,0.12)')
    g.fillStyle = dentro; g.fill()
  }
  retangulo(g, 0.75, 0.75, w - 1.5, h - 1.5, deitada ? 22 : 18)
  g.strokeStyle = em('rgba(255,200,110,0.7)'); g.lineWidth = mascara ? 3 : 1.5; g.stroke()

  // o cabeçalho: o ícone, "Consultor" e "Análise pronta"
  const ic = deitada ? 34 : 30, yc = pad + ic / 2
  retangulo(g, pad, pad, ic, ic, 10)
  if (!mascara) { g.fillStyle = 'rgba(255,170,60,0.14)'; g.fill() }
  g.strokeStyle = em('rgba(255,190,90,0.4)'); g.lineWidth = mascara ? 2 : 1; g.stroke()
  // a bússola
  g.beginPath(); g.arc(pad + ic / 2, yc, ic * 0.27, 0, Math.PI * 2)
  g.strokeStyle = em(OURO); g.lineWidth = 1.6; g.stroke()
  g.beginPath(); g.moveTo(pad + ic / 2 + ic * 0.13, yc - ic * 0.13); g.lineTo(pad + ic / 2 - 2, yc - 2); g.lineTo(pad + ic / 2 - ic * 0.13, yc + ic * 0.13); g.lineTo(pad + ic / 2 + 2, yc + 2); g.closePath()
  g.fillStyle = em(OURO); g.fill()

  g.fillStyle = em(TINTA)
  escrever(g, tx('Consultor'), pad + ic + 11, yc + 1, w * 0.4, 700, deitada ? 20 : 17, f.titulo)
  g.textAlign = 'right'
  g.fillStyle = em(VERDE)
  escrever(g, tx('Análise pronta'), w - pad, yc + 1, w * 0.36, 700, deitada ? 12.5 : 11.5, f.texto)
  const larguraPronta = g.measureText(tx('Análise pronta')).width
  g.textAlign = 'left'
  g.beginPath(); g.arc(w - pad - larguraPronta - 10, yc + 1, 4, 0, Math.PI * 2)
  if (!mascara) { g.save(); g.shadowColor = VERDE; g.shadowBlur = 10; g.fill(); g.restore() } else g.fill()

  const linha = pad + ic + 12
  g.fillStyle = em('rgba(255,190,90,0.32)')
  g.fillRect(pad, linha, w - pad * 2, mascara ? 2 : 1)

  // a nota (o círculo) e os pilares
  const topo = linha + (deitada ? 22 : 16)
  let d: number, nx: number, ny: number, x0: number, yPil: number, altPil: number, colunas: number
  if (deitada) {
    d = Math.min(150, (h - topo - pad) * 0.62)
    nx = pad + d / 2 + 6; ny = topo + 14 + d / 2
    x0 = pad + d + 40; yPil = topo; altPil = 3 * 23; colunas = 2
  } else {
    d = Math.min(104, w * 0.3)
    nx = pad + d / 2; ny = topo + d / 2
    x0 = pad + d + 20; yPil = topo + 2; altPil = d - 4; colunas = 1
  }
  const espessura = deitada ? 9 : 7, raio = d / 2 - espessura / 2
  g.lineCap = 'round'
  g.beginPath(); g.arc(nx, ny, raio, 0, Math.PI * 2)
  g.strokeStyle = em('rgba(255,190,90,0.18)'); g.lineWidth = espessura; g.stroke()
  g.beginPath(); g.arc(nx, ny, raio, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (NOTA / 100))
  g.strokeStyle = em(OURO)
  if (!mascara) { g.save(); g.shadowColor = 'rgba(255,170,60,0.9)'; g.shadowBlur = 12; g.stroke(); g.restore() } else g.stroke()
  g.textAlign = 'center'
  g.fillStyle = em(TINTA)
  g.font = `800 ${Math.round(d * 0.3)}px ${f.numeros}`
  if (!mascara) { g.save(); g.shadowColor = 'rgba(255,170,60,0.7)'; g.shadowBlur = 18; g.fillText(String(NOTA), nx, ny - d * 0.04); g.restore() } else g.fillText(String(NOTA), nx, ny - d * 0.04)
  g.fillStyle = em(VERDE)
  g.font = `700 ${deitada ? 13 : 11.5}px ${f.texto}`
  g.fillText(tx('Boa'), nx, ny + d * 0.2)
  g.textAlign = 'left'

  const x1 = w - pad, vao = deitada ? 22 : 0
  const largCol = (x1 - x0 - vao * (colunas - 1)) / colunas
  const linhas = PILARES.length / colunas, passo = altPil / linhas
  const largNome = deitada ? 62 : 56
  PILARES.forEach((p, i) => {
    const col = i % colunas, lin = Math.floor(i / colunas)
    const px = x0 + col * (largCol + vao), py = yPil + passo * (lin + 0.5)
    g.fillStyle = em(TINTA2)
    escrever(g, p.nome, px, py, largNome - 6, 500, deitada ? 12 : 11, f.texto)
    const bx = px + largNome, bw = largCol - largNome, bh = deitada ? 6 : 5
    retangulo(g, bx, py - bh / 2, bw, bh, bh / 2)
    if (!mascara) { g.fillStyle = 'rgba(255,190,90,0.14)'; g.fill() }
    retangulo(g, bx, py - bh / 2, bw * p.v, bh, bh / 2)
    g.fillStyle = em(p.c)
    if (!mascara) { g.save(); g.shadowColor = p.c; g.shadowBlur = 8; g.fill(); g.restore() } else g.fill()
  })

  // o plano de ação
  const xp = deitada ? x0 : pad, wp = x1 - xp
  let yp = deitada ? yPil + altPil + 18 : topo + d + 22
  g.fillStyle = em(TINTA2)
  escrever(g, tx('Plano de ação'), xp, yp, wp, 700, deitada ? 13 : 12, f.texto)
  yp += 16
  const sobra = h - pad - yp, vaoC = deitada ? 8 : 7
  const altC = Math.min(deitada ? 56 : 50, (sobra - vaoC * 2) / 3)
  PLANO.forEach((item, i) => {
    const y = yp + i * (altC + vaoC)
    retangulo(g, xp, y, wp, altC, 12)
    if (!mascara) { g.fillStyle = 'rgba(255,170,60,0.07)'; g.fill() }
    g.strokeStyle = em('rgba(255,190,90,0.24)'); g.lineWidth = mascara ? 2 : 1; g.stroke()
    const nq = 24, nxq = xp + 11, nyq = y + altC / 2 - nq / 2
    retangulo(g, nxq, nyq, nq, nq, 8)
    if (mascara) { g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke() } else {
      const ouro = g.createLinearGradient(nxq, nyq, nxq + nq, nyq + nq)
      ouro.addColorStop(0, '#ffe2a6'); ouro.addColorStop(1, '#ffb04a')
      g.fillStyle = ouro; g.fill()
      g.fillStyle = '#1d1205'; g.textAlign = 'center'
      g.font = `800 12.5px ${f.texto}`; g.fillText(String(i + 1), nxq + nq / 2, nyq + nq / 2 + 0.5)
      g.textAlign = 'left'
    }
    const xt = nxq + nq + 11, wt = xp + wp - xt - 10
    g.fillStyle = em(TINTA)
    escrever(g, item.t, xt, y + altC / 2 - 7, wt, 700, deitada ? 13.5 : 12.5, f.texto)
    g.fillStyle = em(APAGADO)
    escrever(g, item.d, xt, y + altC / 2 + 9, wt, 500, deitada ? 11.5 : 10.5, f.texto)
  })
}

/** A altura em que tudo cabe sem sobrar espaço (a mesma conta do pintar). */
export function alturaIdeal(w: number) {
  return w >= 520 ? 24 + 34 + 12 + 22 + 3 * 23 + 18 + 16 + 3 * 56 + 2 * 8 + 24 : 16 + 30 + 12 + 16 + Math.min(104, w * 0.3) + 22 + 16 + 3 * 50 + 2 * 7 + 16
}

/** A tela em w × h px de CSS, desenhada com q pixels por px, e N pontos sorteados nos traços. */
export function desenharTela(w: number, h: number, q: number, N: number, fontes: Fontes, sorteio: () => number): TelaPronta {
  const m = 48
  const img = document.createElement('canvas')
  img.width = Math.ceil((w + m * 2) * q); img.height = Math.ceil((h + m * 2) * q)
  const g = img.getContext('2d')!
  g.scale(q, q); g.translate(m, m)
  pintar(g, w, h, fontes, false)

  // a máscara em meia resolução: cada pixel aceso é um lugar possível para um fragmento
  const qm = 0.5
  const mc = document.createElement('canvas')
  mc.width = Math.ceil(w * qm); mc.height = Math.ceil(h * qm)
  const gm = mc.getContext('2d', { willReadFrequently: true })!
  gm.scale(qm, qm)
  pintar(gm, w, h, fontes, true)
  const dados = gm.getImageData(0, 0, mc.width, mc.height).data
  const acesos: number[] = []
  for (let i = 0, k = 3; k < dados.length; i++, k += 4) if (dados[k] > 110) acesos.push(i)
  const pontos = new Float32Array(N * 2)
  for (let i = 0; i < N; i++) {
    const idx = acesos.length ? acesos[Math.floor(sorteio() * acesos.length)] : 0
    pontos[i * 2] = ((idx % mc.width) + sorteio()) / qm - w / 2
    pontos[i * 2 + 1] = (Math.floor(idx / mc.width) + sorteio()) / qm - h / 2
  }
  return { img, w, h, m, q, pontos }
}
