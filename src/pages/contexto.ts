import type { Sugestao } from '../lib/adaptacao'
import type { MesEfetivo, Resumo } from '../lib/calc'
import type { SituacaoCartao } from '../lib/cartoes'
import type { SituacaoConta } from '../lib/contasFixas'
import type { SituacaoDivida } from '../lib/dividas'
import type { Taxas } from '../lib/moedas'
import type { Visao } from '../lib/perfil'
import type { DadosCartoes } from '../lib/useCartoes'
import type { ContasFixas } from '../lib/useContasFixas'
import type { Dados } from '../lib/useDados'
import type { Categoria, Lancamento, Modulo, Perfil, Tipo } from '../lib/types'

export type Pagina = 'inicio' | 'lancamentos' | 'contas' | 'cartoes' | 'dividas' | 'metas' | 'patrimonio' | 'ano'

/** Tudo que as páginas precisam do mês aberto. */
export interface Ctx {
  ano: number
  mes: number
  d: Dados
  /** Cartões de crédito e suas faturas pagas (só carrega com o módulo ligado). */
  cartoes: DadosCartoes
  /** Fatura, limite e parcelas de cada cartão ativo no mês aberto (vazio sem o módulo). */
  faturas: SituacaoCartao[]
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
  categorias: Categoria[]
  /** Categoria de um lançamento (undefined = sem categoria). */
  categoriaDe: (l: Lancamento) => Categoria | undefined
  gerenciarCategorias: () => void
  personalizar: () => void
  irPara: (p: Pagina) => void
  /** Abre a escolha de arquivo da planilha. */
  importar: () => void
  /** Conta sem nenhum dado ainda (primeiro acesso). */
  contaNova: boolean
  irParaMes: (mes: number) => void
  novoLancamento: (tipo?: Tipo) => void
  editarLancamento: (l: Lancamento) => void
  /** Abre o formulário de saída já no cartão escolhido. */
  novaCompraNoCartao: (cartaoId: string) => void
  /** Banco aberto na tela Bancos ('sem' = lançamentos sem banco). */
  bancoAberto: string | null
  abrirBanco: (id: string | null) => void
  /** Abre o formulário de saída já ligado à dívida, com o valor da parcela. */
  pagarDivida: (s: SituacaoDivida) => void
  /** Contas fixas (aluguel, luz, salário…) e a situação de cada uma no mês aberto. */
  contas: ContasFixas
  situacoesContas: SituacaoConta[]
  /** "Paguei" / "Recebi": cria o lançamento da conta neste mês (valor e data podem ser trocados). */
  pagarConta: (s: SituacaoConta, mudancas?: { valor?: number; data?: string }) => void
  /** Apaga o lançamento da baixa, e a conta volta a ficar em aberto. */
  desfazerBaixa: (s: SituacaoConta) => void
}
