import type { ReactNode } from 'react'
import type { Sugestao } from '../lib/adaptacao'
import type { MesEfetivo, Resumo } from '../lib/calc'
import type { SituacaoCartao } from '../lib/cartoes'
import type { MemoriaConta, SituacaoConta, SugestaoVinculo } from '../lib/contasFixas'
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
  /** Texto da busca do topo (filtra a página Lançamentos). */
  busca: string
  setBusca: (q: string) => void
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
  /** Dinheiro que te devem (dívidas com sentido 'me_devem') como está neste mês. Fica fora de `r.divida`. */
  aReceber: SituacaoDivida[]
  /** Dia para dizer o que está atrasado: hoje, ou o fim do mês aberto quando ele já passou. */
  diaRef: string
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
  /** Esconde de vez um convite ou dica avulsa (guardado no perfil, junto com as sugestões recusadas). */
  dispensar: (id: string) => void
  ligarModulo: (m: Modulo) => void
  categorias: Categoria[]
  /** Categoria de um lançamento (undefined = sem categoria). */
  categoriaDe: (l: Lancamento) => Categoria | undefined
  gerenciarCategorias: () => void
  personalizar: () => void
  irPara: (p: Pagina) => void
  /** Abre a escolha de arquivo da planilha. */
  importar: () => void
  /** Importar extrato do banco (PDF, CSV, Excel, Word, OFX) e organizar os nomes dos lançamentos. */
  importarExtrato: () => void
  organizarNomes: () => void
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
  /** Abre o lançamento já ligado à dívida: saída para pagar, entrada para receber; `valor` troca o sugerido. */
  pagarDivida: (s: SituacaoDivida, valor?: number) => void
  /** Contas fixas (aluguel, luz, salário…) e a situação de cada uma no mês aberto. */
  contas: ContasFixas
  situacoesContas: SituacaoConta[]
  /** "Paguei" / "Recebi": cria o lançamento da conta neste mês (valor e data podem ser trocados). */
  pagarConta: (s: SituacaoConta, mudancas?: { valor?: number; data?: string }) => void
  /** Apaga o lançamento da baixa, e a conta volta a ficar em aberto. */
  desfazerBaixa: (s: SituacaoConta) => void
  /** Como cada conta aparece nos lançamentos (nomes e valores já ligados a ela), pelo id da conta. */
  memoriaContas: Map<string, MemoriaConta>
  /** Lançamento do mês aberto que parece ser desta conta ainda sem baixa ("Pix de João" → Pensão). */
  sugestaoDaConta: (contaId: string) => SugestaoVinculo | undefined
  /** Liga um lançamento que já existe à conta: vira a baixa dela no mês (sem lançar de novo). Depois pergunta pelos parecidos. */
  ligarAConta: (lancId: string, contaId: string) => void
  /** "Não é dessa conta": o app não sugere mais esse lançamento para ela. */
  recusarVinculo: (lancId: string, contaId: string) => void
  /**
   * Indicadores de outros módulos ("Falta pagar no mês", "Fatura do cartão"): um ou mais `<Kpi>`,
   * logo depois de Saiu, em todos os jeitos de ver.
   */
  kpisExtras?: ReactNode
  /**
   * Blocos de outros módulos. Cada um é um único elemento raiz (`Bloco`, `<section className="bloco">` ou `Cartao`).
   * Ficam na zona "O que fazer", antes das dívidas: primeiro `contas`, depois `cartoes`.
   */
  blocos?: { contas?: ReactNode; cartoes?: ReactNode }
}
