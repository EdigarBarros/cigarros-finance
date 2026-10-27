import type { Sugestao } from '../lib/adaptacao'
import type { MesEfetivo, Resumo } from '../lib/calc'
import type { SituacaoDivida } from '../lib/dividas'
import type { Taxas } from '../lib/moedas'
import type { Visao } from '../lib/perfil'
import type { Dados } from '../lib/useDados'
import type { Lancamento, Modulo, Perfil, Tipo } from '../lib/types'

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
  perfil: Perfil
  /** O que aparece na tela, conforme o perfil. */
  v: Visao
  /** Cotação do dia das outras moedas, na moeda principal. */
  taxas: Taxas
  /** Sugestão do momento, tirada do uso ("Começou a investir?"). */
  sugestao: Sugestao | null
  aceitarSugestao: (s: Sugestao) => void
  recusarSugestao: (s: Sugestao) => void
  ligarModulo: (m: Modulo) => void
  personalizar: () => void
  irPara: (p: Pagina) => void
  /** Abre a escolha de arquivo da planilha. */
  importar: () => void
  /** Conta sem nenhum dado ainda (primeiro acesso). */
  contaNova: boolean
  irParaMes: (mes: number) => void
  novoLancamento: (tipo?: Tipo) => void
  editarLancamento: (l: Lancamento) => void
  /** Banco aberto na tela Bancos ('sem' = lançamentos sem banco). */
  bancoAberto: string | null
  abrirBanco: (id: string | null) => void
  /** Abre o formulário de saída já ligado à dívida, com o valor da parcela. */
  pagarDivida: (s: SituacaoDivida) => void
}
