/**
 * Sorteio com semente (mulberry32): a mesma semente dá a mesma sequência em qualquer aparelho e no servidor. Usado pelos
 * cenários e pelas faixas das previsões, para uma decisão poder ser refeita com os mesmos sorteios.
 */
export type Sorteio = () => number

export function sorteio(semente: number): Sorteio {
  let a = semente >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Semente estável de um texto (FNV-1a de 32 bits): "hoje + usuário" vira sempre o mesmo número. */
export function sementeDe(texto: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Sorteia um índice com pesos (soma dos pesos > 0). */
export function escolherComPeso(pesos: number[], r: Sorteio): number {
  const total = pesos.reduce((a, b) => a + b, 0)
  let alvo = r() * total
  for (let i = 0; i < pesos.length; i++) {
    alvo -= pesos[i]
    if (alvo < 0) return i
  }
  return pesos.length - 1
}
