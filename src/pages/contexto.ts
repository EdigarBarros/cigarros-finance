import type { Resumo } from '../lib/calc'
import type { Dados } from '../lib/useDados'
import type { Divida, Lancamento, Mes, Tipo } from '../lib/types'

export type Pagina = 'inicio' | 'lancamentos' | 'dividas' | 'patrimonio' | 'ano'

/** Tudo que as páginas precisam do mês aberto. */
export interface Ctx {
  ano: number
  mes: number
  d: Dados
  lancsMes: Lancamento[]
  dividasMes: Divida[]
  metaMes?: Mes
  r: Resumo
  /** Resumo do mês anterior (só dentro do mesmo ano) para comparar. */
  anterior: Resumo | null
  porMes: (Resumo | null)[]
  irPara: (p: Pagina) => void
  irParaMes: (mes: number) => void
  novoLancamento: (tipo?: Tipo) => void
  editarLancamento: (l: Lancamento) => void
  copiarMesAnterior: () => void
}
