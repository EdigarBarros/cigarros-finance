import type { MesEfetivo, Resumo } from '../lib/calc'
import type { SituacaoDivida } from '../lib/dividas'
import type { Dados } from '../lib/useDados'
import type { Lancamento, Tipo } from '../lib/types'

export type Pagina = 'inicio' | 'lancamentos' | 'dividas' | 'patrimonio' | 'ano'

/** Tudo que as páginas precisam do mês aberto. */
export interface Ctx {
  ano: number
  mes: number
  d: Dados
  lancsMes: Lancamento[]
  /** Dívidas como estão neste mês (saldo calculado com os pagamentos). */
  situacao: SituacaoDivida[]
  /** Valores do mês, com caixa/US$ herdados do último mês informado. */
  mesEf: MesEfetivo
  r: Resumo
  /** Resumo do mês anterior (só dentro do mesmo ano) para comparar. */
  anterior: Resumo | null
  porMes: (Resumo | null)[]
  mobile: boolean
  irPara: (p: Pagina) => void
  irParaMes: (mes: number) => void
  novoLancamento: (tipo?: Tipo) => void
  editarLancamento: (l: Lancamento) => void
  /** Abre o formulário de saída já ligado à dívida, com o valor da parcela. */
  pagarDivida: (s: SituacaoDivida) => void
}
