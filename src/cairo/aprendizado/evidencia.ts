/**
 * A espinha do aprendizado individual: cada parâmetro parte de uma referência explícita e vai pesando o histórico da pessoa
 * conforme a evidência cresce. Peso do histórico = n / (n + k), em que n é a massa das observações (cada uma com peso de
 * qualidade × atualidade × mudança de comportamento, de 0 a 1) e k é a força da referência.
 *
 * Com 2 observações a referência ainda manda; com 20, manda a pessoa. Nenhum mínimo fixo decide "sabe" ou "não sabe": o
 * peso cresce aos poucos e vai junto no resultado (`pesoDoHistorico`, `nEf`).
 */
import { REGRAS } from '../contrato/politicas'

export interface Obs { valor: number; peso: number }

/** Peso pela idade: meia-vida em dias (a observação de 180 dias atrás vale metade). */
export const pesoPorIdade = (diasAtras: number, meiaVida: number = REGRAS.meiaVidaDias.valor) =>
  Math.pow(0.5, Math.max(0, diasAtras) / meiaVida)

/** Tamanho efetivo da amostra (Kish): 10 observações de peso igual valem 10; uma dominando as outras vale perto de 1. */
export function nEfetivo(obs: Obs[]): number {
  const s = obs.reduce((a, o) => a + o.peso, 0)
  const s2 = obs.reduce((a, o) => a + o.peso * o.peso, 0)
  return s2 > 0 ? (s * s) / s2 : 0
}

export const massa = (obs: Obs[]) => obs.reduce((a, o) => a + o.peso, 0)

export function mediaPonderada(obs: Obs[]): number | null {
  const s = massa(obs)
  return s > 0 ? obs.reduce((a, o) => a + o.valor * o.peso, 0) / s : null
}

/** O peso do histórico contra a referência. */
export const pesoDoHistorico = (n: number, k: number = REGRAS.forcaDaReferencia.valor) => (n > 0 ? n / (n + k) : 0)

export interface Suavizado { valor: number; nEf: number; pesoDoHistorico: number }

/** Média do histórico puxada para a referência na medida da evidência. */
export function suavizar(obs: Obs[], referencia: number, k: number = REGRAS.forcaDaReferencia.valor): Suavizado {
  const m = mediaPonderada(obs)
  const p = pesoDoHistorico(massa(obs), k)
  return { valor: m === null ? referencia : p * m + (1 - p) * referencia, nEf: nEfetivo(obs), pesoDoHistorico: p }
}

/** Quantil com pesos (interpolação pela massa acumulada). */
export function quantilPonderado(obs: Obs[], q: number): number | null {
  const xs = obs.filter((o) => o.peso > 0).sort((a, b) => a.valor - b.valor)
  if (!xs.length) return null
  const total = massa(xs)
  const alvo = q * total
  let acc = 0
  for (const o of xs) {
    acc += o.peso
    if (acc >= alvo - 1e-12) return o.valor
  }
  return xs[xs.length - 1].valor
}

/**
 * Proporção com referência (Beta): `sucessos` de `n`, puxada para `media` com a força `forca`. Devolve a média posterior e
 * um intervalo aproximado de 80% (normal sobre a Beta), que alarga com pouca evidência.
 */
export function proporcao(sucessos: number, n: number, media: number, forca: number) {
  const a = media * forca + sucessos
  const b = (1 - media) * forca + (n - sucessos)
  const p = a / (a + b)
  const dp = Math.sqrt((a * b) / ((a + b) ** 2 * (a + b + 1)))
  return { p, p10: Math.max(0, p - 1.2816 * dp), p90: Math.min(1, p + 1.2816 * dp), n, pesoDoHistorico: n / (n + forca) }
}
