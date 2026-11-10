import type { ReactNode } from 'react'
import type { SaldoCorrido } from '../lib/saldoCorrido'
import type { Sugestao } from '../lib/adaptacao'
import type { MesEfetivo, Resumo } from '../lib/calc'
import type { SituacaoCartao } from '../lib/cartoes'
import type { Analise, Reanalise } from '../lib/analise'
import type { MemoriaConsultor, Objetivo } from '../lib/memoria'
import type { Gosto } from '../lib/gosto'
import type { Conselho } from '../lib/conselheiro'
import type { MemoriaConta, SituacaoConta, SugestaoVinculo } from '../lib/contasFixas'
import type { SituacaoDivida } from '../lib/dividas'
import type { Taxas } from '../lib/moedas'
import type { DiaADia, PrevisaoMes } from '../lib/previsao'
import type { Visao } from '../lib/perfil'
import type { DadosCartoes } from '../lib/useCartoes'
import type { ContasFixas } from '../lib/useContasFixas'
import type { Dados } from '../lib/useDados'
import type { Categoria, Lancamento, Modulo, Perfil, Tipo } from '../lib/types'

export type Pagina = 'inicio' | 'lancamentos' | 'analise' | 'contas' | 'cartoes' | 'dividas' | 'metas' | 'patrimonio' | 'ano'

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
  /** Todos os lançamentos do ano aberto (a busca procura no ano inteiro). */
  lancsAno: Lancamento[]
  /** Os mesmos, mais as saídas que são dinheiro indo para o seu dinheiro guardado (para a lista; elas não entram nas somas). */
  lancsMesComGuardados: Lancamento[]
  lancsAnoComGuardados: Lancamento[]
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
  /** Por mês do ano: o que já aconteceu e o que ainda vem (gráficos de fluxo). */
  previsto: PrevisaoMes[]
  /** O mês aberto dia a dia: o que já aconteceu até hoje e o que ainda vem (gráfico do mês na Início). */
  diaADia: DiaADia
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
  /** Conselhos do conselheiro financeiro (lib/conselheiro.ts), do mais para o menos importante, já sem os dispensados. */
  conselhos: Conselho[]
  /** "Agora não": esconde o conselho até o mês que vem. */
  dispensarConselho: (id: string) => void
  /** Poucos meses fechados com entradas e saídas: o conselheiro não tem base para opinar (a lista vem vazia). */
  conselhosSemDados: boolean
  /** Quantos conselhos a pessoa escondeu até o mês que vem. */
  conselhosDispensados: number
  /** A análise completa do consultor (lib/analise.ts), refeita a cada mudança nos dados. */
  analise: Analise
  /** O saldo que passa de um mês para o outro (lib/saldoCorrido.ts): o de cada mês do ano aberto e o ponto de partida. */
  saldoCorrido: SaldoCorrido
  /** O que o consultor aprendeu com a pessoa: o objetivo e os passos acompanhados (lib/memoria.ts). */
  memoria: MemoriaConsultor
  /** O que a tela do Consultor aprendeu com o uso (lib/gosto.ts): desenhos e assuntos preferidos, favoritos e escondidos. */
  gosto: Gosto
  salvarGosto: (g: Gosto) => void
  /** Escolhe (ou tira, com null) o objetivo que guia o consultor. */
  escolherObjetivo: (o: Objetivo | null) => void
  /** O que a última mudança nos dados fez com a análise (null até a primeira mudança desta visita). */
  reanalise: Reanalise | null
  /** Para guardar no navegador o retrato da última visita à aba Consultor. */
  idUsuario: string
  /** O aviso "Analisei a mudança" está ligado. */
  avisosDaAnalise: boolean
  mudarAvisosDaAnalise: (ligado: boolean) => void
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
  /** Cartão a mostrar ao abrir a tela Cartões (depois de lançar uma compra nele); null = o primeiro. */
  cartaoAberto: string | null
  /** Compra no cartão recém-lançada (id da compra): a tela Cartões rola até ela e a destaca. */
  compraDestacada: string | null
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
