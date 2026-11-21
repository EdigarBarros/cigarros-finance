/**
 * O histórico das conferências com o banco (migração 37). Puro: recebe as linhas e devolve o que as telas e o conselheiro
 * mostram. Cada linha diz o que o app mostrava (`antes`) e o que o banco mostrou (`depois`); a diferença é o que a dívida
 * subiu ou caiu "por fora" (juros, desconto, acordo, estorno).
 */
import type { ConferenciaDivida } from './types'

export interface MudancaConferida {
  conferencia: ConferenciaDivida
  /** depois − antes, em centavos (negativo: a dívida caiu). */
  diferenca: number
  /** A diferença em % do que o app mostrava (0 se o app mostrava zero). */
  percentual: number
  sentido: 'caiu' | 'subiu' | 'igual'
}

const centavos = (n: number) => Math.round(n * 100) / 100

export function mudancaDe(c: ConferenciaDivida): MudancaConferida {
  const diferenca = centavos(c.depois - c.antes)
  const percentual = c.antes > 0 ? Math.round((diferenca / c.antes) * 1000) / 10 : 0
  return { conferencia: c, diferenca, percentual, sentido: Math.abs(diferenca) < 0.005 ? 'igual' : diferenca < 0 ? 'caiu' : 'subiu' }
}

/** As conferências de uma dívida, da mais nova para a mais antiga. */
export function historicoDaDivida(todas: ConferenciaDivida[], dividaId: string): MudancaConferida[] {
  return todas
    .filter((c) => c.divida_id === dividaId)
    .sort((a, b) => b.data.localeCompare(a.data) || b.created_at.localeCompare(a.created_at))
    .map(mudancaDe)
}
