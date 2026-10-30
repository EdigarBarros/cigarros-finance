import { tx } from './textos'
/** O que dá para apagar em "Zerar dados". `tudo` deixa a conta como nova (inclui bancos, categorias e preferências). */
export type ParteZerar = 'tudo' | 'entradas' | 'saidas' | 'dividas' | 'cartoes' | 'contas' | 'metas' | 'guardado'
export type EscolhaZerar = Partial<Record<ParteZerar, boolean>>

export const PARTES_ZERAR: { id: ParteZerar; nome: string; texto: string }[] = [
  { id: 'tudo', nome: tx('Tudo, como conta nova'), texto: tx('Apaga tudo, inclusive bancos, categorias e preferências. As perguntas iniciais aparecem de novo.') },
  { id: 'entradas', nome: tx('Entradas'), texto: tx('Todos os lançamentos de entrada (salário, renda extra…).') },
  { id: 'saidas', nome: tx('Saídas'), texto: tx('Todos os lançamentos de saída, inclusive pagamentos de dívidas e compras no cartão.') },
  { id: 'dividas', nome: tx('Dívidas'), texto: tx('As dívidas e seus saldos. Os pagamentos lançados ficam, só sem vínculo com a dívida.') },
  { id: 'cartoes', nome: tx('Cartões'), texto: tx('Os cartões e as faturas pagas. As compras ficam como saídas comuns.') },
  { id: 'contas', nome: tx('Contas fixas'), texto: tx('As contas que se repetem todo mês. Os lançamentos já feitos ficam.') },
  { id: 'metas', nome: tx('Metas'), texto: tx('As metas e o histórico de dinheiro guardado nelas.') },
  { id: 'guardado', nome: tx('Dinheiro guardado'), texto: tx('Saldos por banco, investimentos e moedas de cada mês.') },
]
