/**
 * Mudança de comportamento: o nível de uma série mensal mudou de verdade, ou é a variação normal da pessoa?
 *
 * O ponto de corte é o que deixa cada lado mais parecido por dentro (menor soma dos quadrados, com pelo menos 2 meses de cada
 * lado). A força é a diferença entre os níveis em erros do nível médio (com o desvio robusto dos resíduos). Só vira
 * "mudança" acima do limiar (regra aprendizado.quebra.limiar), que é ponto de partida a calibrar, não garantia.
 *
 * Depois de uma mudança, o que veio antes não é apagado: pesa menos (aprendizado.peso-antes-da-quebra).
 */
import { REGRAS } from '../contrato/politicas'

export interface Quebra {
  /** Índice do primeiro ponto do nível novo. */
  inicio: number
  antes: number
  depois: number
  /** Quantos erros do nível separam antes e depois. */
  forca: number
}

const media = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
const mediana = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export function detectarQuebra(serie: number[], limiar: number = REGRAS.quebraLimiar.valor): Quebra | null {
  const n = serie.length
  if (n < 4) return null
  // o ponto de corte: o que deixa os dois lados mais parecidos por dentro (menor soma dos quadrados dos resíduos)
  let corte = -1
  let menor = Infinity
  for (let c = 2; c <= n - 2; c++) {
    const a = serie.slice(0, c); const b = serie.slice(c)
    const ma = media(a); const mb = media(b)
    const sse = a.reduce((s, x) => s + (x - ma) ** 2, 0) + b.reduce((s, x) => s + (x - mb) ** 2, 0)
    if (sse < menor) { menor = sse; corte = c }
  }
  if (corte < 0) return null
  const a = serie.slice(0, corte); const b = serie.slice(corte)
  const ma = media(a); const mb = media(b)
  // a força, com o desvio robusto (1,4826 × mediana dos desvios absolutos): um mês fora da curva não inventa mudança
  const s = 1.4826 * mediana([...a.map((x) => Math.abs(x - ma)), ...b.map((x) => Math.abs(x - mb))])
  const piso = Math.max(s, Math.abs(media(serie)) * 0.02, 1)
  const forca = Math.abs(mb - ma) / (piso * Math.sqrt(1 / a.length + 1 / b.length))
  return forca >= limiar ? { inicio: corte, antes: ma, depois: mb, forca } : null
}
