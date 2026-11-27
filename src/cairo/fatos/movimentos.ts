/**
 * O que cada lançamento é para as contas do Cairo: renda, gasto, dinheiro emprestado, devolução, transferência entre bolsos
 * seus ou compra que outra pessoa paga. A mesma regra vale para o Consultor antigo (lib/analise.ts e lib/conselheiro.ts
 * chamam `entraNasContas`), para os dois nunca discordarem.
 *
 * Regra de contagem única: o dinheiro que só muda de lugar (empréstimo recebido, dinheiro emprestado a alguém, a devolução
 * dele, a caixinha) não é renda nem gasto. Antes, emprestar ficava fora dos gastos, mas receber de volta contava como
 * renda: a sobra subia sem a pessoa ganhar nada.
 */
import { mudaDeBolso } from './mudaDeBolso'

export type ClasseDoLancamento =
  | 'renda'
  | 'gasto'
  /** Entrada ligada a uma dívida sua: o banco ou alguém te emprestou. */
  | 'credito_recebido'
  /** Saída ligada a um "me devem": você emprestou. */
  | 'emprestimo_concedido'
  /** Entrada ligada a um "me devem": voltou o que você emprestou. */
  | 'devolucao_recebida'
  | 'transferencia_propria'
  /** Compra no seu cartão que outra pessoa paga. */
  | 'pago_por_outro'

export interface LancParaClasse {
  tipo: 'entrada' | 'saida'
  descricao: string
  cartao_id?: string | null
  divida_id?: string | null
  guardado_banco_id?: string | null
  pago_por?: string | null
}

export type SentidoDaDivida = (id: string) => 'devo' | 'me_devem' | undefined

export function classeDoLancamento(l: LancParaClasse, nomeDaCategoria: string, sentido: SentidoDaDivida): ClasseDoLancamento {
  if (l.tipo === 'saida' && l.guardado_banco_id) return 'transferencia_propria'
  if (l.pago_por && l.pago_por.trim()) return 'pago_por_outro'
  if (l.divida_id) {
    const s = sentido(l.divida_id)
    if (s === 'devo' && l.tipo === 'entrada') return 'credito_recebido'
    if (s === 'me_devem') return l.tipo === 'saida' ? 'emprestimo_concedido' : 'devolucao_recebida'
    if (s === 'devo') return 'gasto'
  }
  if (!l.cartao_id && !l.divida_id && mudaDeBolso(l.descricao, nomeDaCategoria)) return 'transferencia_propria'
  return l.tipo === 'entrada' ? 'renda' : 'gasto'
}

/** Entra nas somas de renda e gasto do mês? */
export const contaComoFluxo = (c: ClasseDoLancamento) => c === 'renda' || c === 'gasto'
