/** O que dá para apagar em "Zerar dados". `tudo` deixa a conta como nova (inclui bancos, categorias e preferências). */
export type ParteZerar = 'tudo' | 'entradas' | 'saidas' | 'dividas' | 'cartoes' | 'contas' | 'metas' | 'guardado'
export type EscolhaZerar = Partial<Record<ParteZerar, boolean>>

export const PARTES_ZERAR: { id: ParteZerar; nome: string; texto: string }[] = [
  { id: 'tudo', nome: 'Tudo, como conta nova', texto: 'Apaga tudo, inclusive bancos, categorias e preferências. As perguntas iniciais aparecem de novo.' },
  { id: 'entradas', nome: 'Entradas', texto: 'Todos os lançamentos de entrada (salário, renda extra…).' },
  { id: 'saidas', nome: 'Saídas', texto: 'Todos os lançamentos de saída, inclusive pagamentos de dívidas e compras no cartão.' },
  { id: 'dividas', nome: 'Dívidas', texto: 'As dívidas e seus saldos. Os pagamentos lançados ficam, só sem vínculo com a dívida.' },
  { id: 'cartoes', nome: 'Cartões', texto: 'Os cartões e as faturas pagas. As compras ficam como saídas comuns.' },
  { id: 'contas', nome: 'Contas fixas', texto: 'As contas que se repetem todo mês. Os lançamentos já feitos ficam.' },
  { id: 'metas', nome: 'Metas', texto: 'As metas e o histórico de dinheiro guardado nelas.' },
  { id: 'guardado', nome: 'Dinheiro guardado', texto: 'Saldos por banco, investimentos e moedas de cada mês.' },
]
