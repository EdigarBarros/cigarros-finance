/**
 * Consultor financeiro: a análise completa do dinheiro da pessoa, refeita a cada mudança (lançamento, compra no cartão,
 * dívida, meta, saldo de banco). Onde o conselheiro (lib/conselheiro.ts) dá avisos curtos, aqui o app faz o trabalho de
 * quem entende de finanças: analisa, compara, revisa e planeja.
 *
 *  - Analisa: nota de 0 a 100 por pilares (sobra, reserva, dívidas, cartão, controle dos gastos, metas) e a fase em que a
 *    pessoa está na escada da educação financeira (sair do vermelho → colchão → dívidas caras → reserva completa → crescer).
 *  - Compara: o mês atual com a média e com o mesmo ponto dos outros meses, previsão de fechamento, quanto dá para gastar
 *    por dia, tendência de 12 meses, categorias que subiram e caíram.
 *  - Revisa: regra 50/30/20, contas que se repetem e assinaturas (custo no ano), gastos formiga, juros e multas pagos,
 *    renda que varia, gastos sem categoria.
 *  - Planeja: para onde mandar a sobra conforme a fase, orçamento por categoria, plano das dívidas (avalanche × bola de neve,
 *    com a economia de juros), reserva de emergência, se as metas cabem, patrimônio em 12 meses e um plano de ação em ordem.
 *
 * É um motor PURO, como o conselheiro: sem React, sem banco, sem relógio escondido (a data entra por `hoje`). Os mesmos dados
 * dão sempre a mesma análise. Fala de comportamento (gastar, dever, guardar), nunca de produto de investimento.
 *
 * Os limites são referências comuns de educação financeira (regra do dedão), não regra rígida.
 */
import { caixaDoBanco, mesEfetivo } from './calc'
import { chaveMes, doMesChave, faturaDoMes, faturasAtrasadas, garantidoDo, hojeLocal, limiteDoCartao } from './cartoes'
import {
  CARTAO_ATENCAO, JUROS_ALTOS_MES, MESES_DA_ANALISE, MESES_NA_MEDIA, MIN_MESES_COM_DADOS, PARCELAS_ATENCAO, type Destino,
} from './conselheiro'
import { situacoesDoMes as situacoesDasContas } from './contasFixas'
import { atrasadoHoje, aumentaDivida, calendarioDe, jurosAoAno, jurosQuePesam, meDevem, projecaoMensal, situacaoDividas, type SituacaoDivida } from './dividas'
import { fmtDataCurta, fmtMesAno, fmtMoeda, fmtPct, fmtTaxa, fmtTaxaAno, fmtValor, LOCAL_DAS_DATAS, MESES_NOME, noMeioDaFrase } from './format'
import { situacaoMeta } from './metas'
import { ehGuardado } from './guardado'
import { mudaDeBolso } from './mudaDeBolso'
import { fraseDoResultado, licaoDe, type MemoriaConsultor, type Objetivo } from './memoria'
import { converter, totalConvertido, type Taxas } from './moedas'
import { visao } from './perfil'
import { planejar, type Plano } from './planejador'
import { tx } from './textos'
import type {
  CartaoCredito, Categoria, ContaFixa, Divida, FaturaPaga, Lancamento, Mes, Meta, MovimentoMeta, Pagamento, Perfil, SaldoDivida,
} from './types'
import { TIPOS_CAIXA } from './types'

// ---------- limites ----------

/** Sobra ideal: 20% do que entra (a parte "futuro" da regra 50/30/20). */
export const SOBRA_IDEAL = 0.2
/** Regra 50/30/20: necessidades (contas da casa, mercado, transporte, saúde e parcelas) até 50% do que entra… */
export const NECESSIDADES_IDEAL = 0.5
/** …e estilo de vida (lazer, compras, assinaturas, restaurantes) até 30%. */
export const ESTILO_IDEAL = 0.3
/** Dívida cara: juros a partir de 3% ao mês (cerca de 43% ao ano). Quitar vem antes de completar a reserva. */
export const JUROS_CARO_MES = 3
/** Acima disso por mês, adiantar a dívida costuma render mais do que deixar o dinheiro guardado com segurança. */
export const JUROS_MODERADO_MES = 1
/** O colchão: 1 mês de gastos guardado, para um imprevisto não virar dívida nova. */
export const COLCHAO_MESES = 1
/** Reserva completa para quem tem renda estável… */
export const RESERVA_RENDA_ESTAVEL = 6
/** …e para quem tem renda que varia (autônomo, comissão, freela). */
export const RESERVA_RENDA_VARIAVEL = 12
/** A renda "varia" quando o desvio padrão passa desta fração da média (coeficiente de variação). */
export const RENDA_VARIA_ACIMA = 0.25
/** Uso do limite do cartão até esta fração é saudável. */
export const LIMITE_SAUDAVEL = 0.3
/** Um gasto se repete quando aparece em pelo menos tantos dos últimos 6 meses fechados (2 se houver poucos meses). */
export const RECORRENTE_MESES = 3
/** Gasto formiga: compra pequena (até esta fração do que entra por mês) que se repete muitas vezes. */
export const FORMIGA_VALOR = 0.015
/** E se repete pelo menos tantas vezes por mês. */
export const FORMIGA_VEZES = 4
/** Categoria que "subiu": pelo menos 20% acima dos meses anteriores e pesando 5% do gasto do mês. */
export const SUBIU_ACIMA = 0.2
export const SUBIU_RELEVANTE = 0.05

/** Quanto cada objetivo sobe (ou desce) cada passo do plano, pelo começo do id da ação. */
const PESO_DO_OBJETIVO: Record<Objetivo, Record<string, number>> = {
  dividas: { 'adiantar-divida': 25, 'quitar-com-reserva': 12, 'juros-altos': 5, 'sem-novas-parcelas': 18, cartao: 12, 'informe-juros': 30, metas: -15, crescer: -30 },
  'fechar-mes': { vermelho: 5, corte: 20, formiga: 18, assinaturas: 15, plano: 5, aperto: 5, metas: -20, crescer: -30, 'pode-gastar': -40 },
  guardar: { reserva: 25, colchao: 10, corte: 15, formiga: 12, assinaturas: 12, metas: 15, 'dinheiro-parado': 20 },
  controle: { categorizar: 40, subiu: 20, formiga: 20, assinaturas: 20, 'juros-pagos': 10, 'atualizar-saldos': 25 },
  tranquilo: { 'pode-gastar': 35, corte: -15, formiga: -25, assinaturas: -10 },
  crescer: { crescer: 40, 'dinheiro-parado': 35, metas: 15, reserva: 5 },
}

/** Dinheiro parado que vale um aviso: pelo menos 5% da renda (ou R$ 500 sem renda conhecida). */
const minimoParado = (renda: number) => (renda > 0 ? renda * 0.05 : 500)

/** Pesos de cada pilar na nota (os que não se aplicam saem e os outros são reponderados). */
const PESOS = { sobra: 25, reserva: 20, dividas: 20, controle: 15, cartao: 10, metas: 10 } as const

// ---------- tipos ----------

export type Fase = 'vermelho' | 'colchao' | 'dividas' | 'reserva' | 'crescer'
export const FASES: Fase[] = ['vermelho', 'colchao', 'dividas', 'reserva', 'crescer']
export type Tom = 'bom' | 'medio' | 'ruim'
export type Grupo = 'essencial' | 'estilo' | 'dividas' | 'outros'
export type IdPilar = keyof typeof PESOS

export interface Pilar {
  id: IdPilar
  nome: string
  /** 0 a 100. */
  nota: number
  tom: Tom
  /** O número que resume o pilar, já formatado ("12%", "1,5 mês"). */
  valor: string
  /** A referência de educação financeira com que ele se compara. */
  referencia: string
  /** Uma frase com o que o número quer dizer. */
  frase: string
  destino: Destino
}

export interface InfoFase {
  id: Fase
  nome: string
  descricao: string
}

export interface MesDaSerie {
  ano: number
  mes: number
  entradas: number
  saidas: number
  sobra: number
  /** Teve entradas e saídas lançadas (conta nas médias). */
  comDados: boolean
  /** O mês atual, ainda andando. */
  atual: boolean
  /** Quanto saiu em cada categoria (pelo id; '' = sem categoria). */
  porCategoria: Record<string, number>
}

export interface PrevisaoMes {
  dia: number
  diasNoMes: number
  entrouAteAgora: number
  saiuAteAgora: number
  /** O que ainda deve entrar: contas a receber, entradas que se repetem e já lançadas para depois de hoje. */
  aReceber: number
  /** Contas do mês, parcelas de dívidas, faturas e gastos que se repetem que ainda vão sair. */
  aPagar: number
  /** Gasto do dia a dia que ainda deve sair, pelo ritmo do mês misturado com o de costume. */
  diaADiaPrevisto: number
  /** A renda ainda não lançada foi completada com a média (o salário ainda não caiu). */
  rendaPelaMedia: boolean
  entradasPrevistas: number
  saidasPrevistas: number
  resultadoPrevisto: number
  /** Quanto o mês deve guardar pelo plano. */
  sobraAlvo: number
  /** Quanto dá para gastar por dia no dia a dia (de hoje até o fim do mês) e ainda guardar `sobraAlvo`. */
  porDia: number
  /** Até este dia, nos outros meses, saía em média (null sem histórico). */
  ateHojeNormal: number | null
  /** Resultado previsto menos a sobra média dos meses fechados (null sem histórico). */
  contraMedia: number | null
  /** Renda que não se repete (freela, venda, bico), em média por mês nos meses fechados: fica fora da previsão, por cautela. */
  rendaExtraMedia: number
  /** Categorias que já passaram da média neste mês. */
  acimaDoNormal: { id: string; nome: string; icone: string; atual: number; media: number }[]
}

export interface CategoriaAnalise {
  id: string
  nome: string
  icone: string
  cor: string
  grupo: Grupo
  /** Média por mês nos últimos meses fechados (até 3). */
  media: number
  /** Média dos meses antes desses (até 9), para ver o que subiu. null sem base. */
  antes: number | null
  /** Variação da média contra `antes` (0,25 = 25% a mais). */
  variacao: number | null
  /** O que já saiu no mês atual. */
  atual: number
  /** Teto sugerido para o mês que vem. */
  sugestao: number
  /** Parte da média que é parcela de compra no cartão (já assumida: não dá para cortar agora). */
  parcelado: number
  /** O mesmo, nos meses de `antes`. */
  parceladoAntes: number | null
  /** As compras parceladas que mais pesam na categoria e quando acabam. */
  parcelas: { descricao: string; valor: number; termina: { ano: number; mes: number } }[]
}

export interface Regra503020 {
  renda: number
  /** Frações do que entra. */
  essencial: number
  parcelas: number
  estilo: number
  outros: number
  sobra: number
}

export interface Recorrente {
  descricao: string
  valor: number
  meses: number
  assinatura: boolean
}

export interface Formiga {
  descricao: string
  vezesPorMes: number
  ticket: number
  porMes: number
  porAno: number
}

export type IdEstrategia = 'parcelas' | 'avalanche' | 'bola-de-neve'

export interface Estrategia {
  id: IdEstrategia
  /** Meses até ficar sem dívidas (null: com dívida sem parcela, só pagando as parcelas, nunca acaba). */
  meses: number | null
  fim: { ano: number; mes: number } | null
  totalPago: number
  /** Quanto custa a menos que só pagar as parcelas (null quando só pagar as parcelas nunca acaba). */
  economia: number | null
}

export interface DividaNoPlano {
  id: string
  nome: string
  restante: number
  parcela: number | null
  juros: number | null
  /** Quanto quitaria tudo hoje, com o desconto dos juros das parcelas que faltam. */
  quitarHoje: number
  /** Quando acaba seguindo a estratégia recomendada. */
  quitaEm: { ano: number; mes: number } | null
  /** Quando acaba só pagando as parcelas. */
  quitaSemExtra: { ano: number; mes: number } | null
}

export interface PlanoDividas {
  total: number
  parcelasMes: number
  /** Juros que as dívidas cobram por mês hoje (aproximado). */
  jurosPorMes: number
  /** Juros que ainda estão embutidos nas parcelas que faltam (o que se economiza quitando tudo hoje). */
  jurosEmbutidos: number
  /** Dinheiro a mais por mês usado nas estratégias. */
  extra: number
  /** `extra` é um exemplo (a sobra ainda não tem espaço para as dívidas). */
  extraExemplo: boolean
  estrategias: Estrategia[]
  recomendada: 'avalanche' | 'bola-de-neve'
  /** Por que a recomendada, em uma frase. */
  porque: string
  /** Na ordem de pagamento da recomendada. */
  ordem: DividaNoPlano[]
  semJuros: number
  /** Há dívida com juros de pelo menos `JUROS_CARO_MES`. */
  temCara: boolean
}

export interface PlanoReserva {
  tem: number
  /** Gasto médio por mês, a base do cálculo. */
  base: number
  meses: number
  colchao: number
  alvoMeses: number
  alvo: number
  falta: number
  porMes: number
  chegaEm: { ano: number; mes: number } | null
  rendaVaria: boolean
  /** De onde veio o "tem": bancos e investimentos, ou a meta de reserva. */
  fonte: 'bancos' | 'meta'
}

export interface Alocacao {
  sobra: number
  reserva: number
  dividas: number
  metas: number
  livre: number
}

export interface MetaNoPlano {
  id: string
  nome: string
  icone: string
  moeda: string
  falta: number
  alvo: number
  guardado: number
  /** Na moeda da meta. */
  porMes: number | null
  ritmo: number
  prazo: { ano: number; mes: number } | null
  noRitmo: boolean
  /** Quando chega no ritmo de hoje. */
  previsao: { ano: number; mes: number } | null
}

export interface PlanoMetas {
  /** Quanto as metas com prazo pedem por mês, na moeda principal. */
  necessario: number
  disponivel: number
  cabe: boolean
  metas: MetaNoPlano[]
}

export interface Patrimonio {
  hoje: number
  ativos: number
  dividas: number
  serie: { ano: number; mes: number; valor: number }[]
  /** Hoje contra o primeiro mês da série (null com 1 mês só). */
  variacao: number | null
  desde: { ano: number; mes: number } | null
  /** Daqui a 12 meses, se a sobra continuar igual (as parcelas pagas também viram patrimônio). */
  em12: number
  /** Daqui a 12 meses, seguindo o orçamento sugerido. */
  em12NoPlano: number
}

export interface InfoCartao {
  usado: number
  limite: number | null
  uso: number | null
  /** Parcelas já marcadas nas próximas 6 faturas. */
  proximas: { ano: number; mes: number; valor: number }[]
  pesoProximo: number | null
  /** Gasto médio por mês no cartão nos meses fechados. */
  porMes: number
  /** Fração das saídas que passa pelo cartão. */
  fracaoDasSaidas: number
  atrasadas: number
  valorAtrasado: number
}

/** Algo que entra ou sai num dia certo: conta do mês, parcela, fatura, salário, o que se repete todo mês. */
export interface Evento {
  data: string
  tipo: 'entrada' | 'saida'
  descricao: string
  valor: number
  origem: 'lancamento' | 'conta' | 'parcela' | 'cartao' | 'recorrente'
  /** Venceu antes de hoje e ainda não foi paga (aparece no dia de hoje). */
  atrasada?: boolean
  /** O vencimento de verdade (a atrasada aparece hoje em `data`, mas o atraso conta daqui). */
  vence?: string
  /** Juros da dívida em % ao mês, quando a pessoa informou (parcelas). */
  jurosMes?: number | null
}

export interface DiaDaAgenda {
  data: string
  entradas: Evento[]
  saidas: Evento[]
  /** Quanto deve ter na conta no fim do dia (com saldo conhecido) ou quanto o dinheiro andou desde hoje (sem ele). */
  saldo: number
}

/** Um detalhe que pouca gente percebe, tirado da agenda do dinheiro. */
export interface Percepcao {
  id: string
  icone: string
  tom: Tom
  titulo: string
  porque: string
  /** O dia de que ela fala (marcado no calendário do mês). */
  data?: string
}

/**
 * A agenda do dinheiro: dia a dia, de hoje até o fim do mês que vem, o que entra e o que sai, e o que isso revela
 * (dinheiro que já chega com dono, conta que vence antes de o dinheiro entrar, vencimentos amontoados…).
 */
export interface Agenda {
  dias: DiaDaAgenda[]
  /** O que está na conta corrente hoje (null quando a pessoa não informa o saldo dos bancos). */
  saldoInicial: number | null
  /** Gasto do dia a dia por dia, descontado do saldo entre um evento e outro (só com saldo conhecido). */
  ritmoDia: number
  proximaEntrada: { data: string; valor: number; descricao: string } | null
  /** O dia em que a conta fica mais baixa. */
  menorSaldo: { data: string; valor: number } | null
  percepcoes: Percepcao[]
  /** O mês atual dia a dia: o que entrou e saiu (até hoje) e o que vai entrar e sair (daqui em diante). */
  calendario: { ano: number; mes: number; hoje: number; dias: { dia: number; entra: number; sai: number }[] }
}

export type Urgencia = 'urgente' | 'importante' | 'sugestao'

export interface Acao {
  /** Estável, para comparar uma análise com a outra. */
  id: string
  urgencia: Urgencia
  prioridade: number
  icone: string
  titulo: string
  porque: string
  /** O ganho em dinheiro, quando dá para dizer ("+ R$ 300 por mês"). */
  impacto?: string
  /** Quanto o passo pede, em dinheiro (o corte, o valor por mês): é o que a memória confere depois (lib/memoria.ts). */
  pedido?: number
  destino: Destino
  botao: string
}

/**
 * Como a pessoa lida com o dinheiro, lido dos números (lib/jeito.ts mostra; aqui muda o que o consultor diz).
 * Mais de um pode valer ao mesmo tempo.
 */
export interface JeitoFinanceiro {
  /** Guarda muito e gasta pouco com ela mesma, com a reserva em dia: precisa de permissão, não de corte. */
  poupador: boolean
  /** Tem parcelas, mas baratas e dentro do limite, sem atraso: usa crédito com controle. */
  credito: boolean
  /** Quase tudo o que entra vai para o essencial e as parcelas: guardar 20% não é a conversa agora. */
  apertado: boolean
  /** Fecha no azul, sem atraso nem dívida cara e sem sustos: precisa de pouco aviso. */
  estavel: boolean
  /** Lança quase tudo, com data e categoria: quer ver os números, não o básico. */
  minucioso: boolean
}

/** O que o consultor aprendeu com a pessoa e o que está acompanhando (lib/memoria.ts). */
export interface Aprendizado {
  objetivo: Objetivo | null
  /** Onde a pessoa está em relação ao objetivo, em uma frase. */
  frase: string | null
  /** Passos que deram certo (os mais recentes primeiro). */
  vitorias: string[]
  /** Passos que não deram certo e como o consultor mudou o jeito. */
  ajustes: string[]
  /** Passos em acompanhamento e o mês em que vão ser conferidos. */
  acompanhando: { titulo: string; ano: number; mes: number }[]
}

export interface Analise {
  /** O mês de hoje (o "mês atual" da análise). */
  hoje: { ano: number; mes: number }
  /** Tem pelo menos 2 dos 3 últimos meses fechados com entradas e saídas: dá para falar de sobra, média e nota. */
  temFluxo: boolean
  /** Meses fechados com entradas e saídas nos últimos 12. */
  mesesAnalisados: number
  nota: number | null
  rotulo: string
  tom: Tom
  /** O resumo do consultor, em frases. */
  resumo: string[]
  fase: Fase
  fases: InfoFase[]
  porqueFase: string
  proximoPasso: string
  pilares: Pilar[]
  /** Média dos últimos meses fechados. */
  renda: number
  gastos: number
  sobra: number
  sobraFracao: number
  /** Quanto, por mês, foi passado para a caixinha, poupança ou investimentos (já está na sobra, não nos gastos). */
  guardando: number
  /** Sobra que o plano pede para os próximos meses (fração do que entra). */
  sobraAlvo: number
  rendaVaria: boolean
  /** Coeficiente de variação da renda (null com menos de 3 meses). */
  variacaoRenda: number | null
  /** De onde vem a renda: a maior fonte e quanto ela pesa. */
  principalFonte: { nome: string; fracao: number } | null
  /** Tendência por mês (0,02 = sobe 2% ao mês), com pelo menos 4 meses. */
  tendenciaGastos: number | null
  tendenciaRenda: number | null
  serie: MesDaSerie[]
  mes: PrevisaoMes | null
  categorias: CategoriaAnalise[]
  subiram: CategoriaAnalise[]
  cairam: CategoriaAnalise[]
  regra: Regra503020 | null
  recorrentes: Recorrente[]
  assinaturasPorMes: number
  recorrentesPorMes: number
  formigas: Formiga[]
  jurosPagos: number
  semCategoria: number
  cartao: InfoCartao | null
  dividas: PlanoDividas | null
  reserva: PlanoReserva | null
  alocacao: Alocacao | null
  metas: PlanoMetas | null
  patrimonio: Patrimonio | null
  agenda: Agenda | null
  /** O plano de pagamentos: de qual dinheiro sai cada conta, em que dia, e quanto custa o atraso (lib/planejador.ts). */
  plano: Plano | null
  /** Quanto cortar por mês para chegar na sobra-alvo (0 se já chega). */
  corte: number
  /** O que está atrasado hoje (parcelas, contas do mês e faturas). */
  atrasoTotal: number
  /** Quanto dá para gastar a mais por mês sem culpa (só para quem guarda muito; 0 no resto). */
  podeGastar: number
  /** Lançamentos por mês, em média, nos meses fechados recentes. */
  lancamentosPorMes: number
  jeito: JeitoFinanceiro
  aprendizado: Aprendizado
  acoes: Acao[]
}

export interface EntradaAnalise {
  hoje?: Date
  /** Lançamentos dos 12 meses fechados e do atual (veja `mesesDaAnalise`), já sem as compras de fatura renegociada. */
  lancs: Lancamento[]
  /** Compras no cartão de todos os anos (vazio sem o módulo). */
  compras: Lancamento[]
  cartoes: CartaoCredito[]
  faturasPagas: FaturaPaga[]
  contas: ContaFixa[]
  categorias: Categoria[]
  /** id da categoria do lançamento ('' = sem categoria). */
  categoriaDe: (l: Lancamento) => string
  dividas: Divida[]
  saldos: SaldoDivida[]
  pagamentos: Pagamento[]
  taxas: Taxas
  meses: Mes[]
  metas: Meta[]
  movimentosMeta: MovimentoMeta[]
  perfil: Perfil
  /** Migração 19 pendente: não há como informar os juros, e o plano não pede. */
  dividasSemJuros?: boolean
  /** O que o consultor já aprendeu com a pessoa: o objetivo e os passos conferidos (lib/memoria.ts). */
  memoria?: MemoriaConsultor
}

// ---------- apoio ----------

const centavos = (n: number) => Math.round(n * 100) / 100
const soma = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
const media = (xs: number[]) => (xs.length ? soma(xs) / xs.length : 0)
const mediana = (xs: number[]) => {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
const desvio = (xs: number[]) => {
  const m = media(xs)
  return Math.sqrt(media(xs.map((x) => (x - m) ** 2)))
}
const limitar = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))
const pct = (f: number) => Math.round(f * 100)
const decimal = new Intl.NumberFormat(LOCAL_DAS_DATAS, { maximumFractionDigits: 1 })
/** "1,5 mês", "3 meses": arredonda para baixo (quem tem 0,96 mês não tem 1 mês). */
export function fmtMeses(n: number) {
  const x = Math.floor(Math.max(0, n) * 10) / 10
  return x === 1 ? tx('1 mês') : x < 1 ? tx('{0} mês', decimal.format(x)) : tx('{0} meses', decimal.format(x))
}
const mesAno = (m: { ano: number; mes: number } | null) => (m ? fmtMesAno(m.ano, m.mes) : '')
const normal = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
/** Descrição sem números, parcelas ("3/10") e pontuação: "Netflix.com 12/05" e "NETFLIX" viram a mesma coisa. */
const chaveDescricao = (s: string) => normal(s).replace(/\d+\s*\/\s*\d+/g, ' ').replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim()
const diaDe = (iso: string | null | undefined) => (iso ? Number(iso.slice(8, 10)) : 0)
const dois = (n: number) => String(n).padStart(2, '0')
/** Dia `d` do mês (31 em mês de 30 vira 30). */
const isoDoDia = (a: number, m: number, d: number) => `${a}-${dois(m)}-${dois(Math.min(d, new Date(a, m, 0).getDate()))}`
const utc = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)))
const diasEntre = (de: string, ate: string) => Math.round((utc(ate) - utc(de)) / 86400000)
const maisDias = (iso: string, n: number) => {
  const d = new Date(utc(iso) + n * 86400000)
  return `${d.getUTCFullYear()}-${dois(d.getUTCMonth() + 1)}-${dois(d.getUTCDate())}`
}
/** "Aluguel", "Aluguel e Luz", "Aluguel, Luz e mais 2": frases inteiras, para cada idioma ter a sua. */
const listaDeNomes = (nomes: string[]) => (nomes.length <= 1 ? nomes[0] ?? ''
  : nomes.length === 2 ? tx('{0} e {1}', nomes[0], nomes[1])
    : nomes.length === 3 ? tx('{0}, {1} e {2}', nomes[0], nomes[1], nomes[2])
      : tx('{0}, {1} e mais {2}', nomes[0], nomes[1], nomes.length - 2))

/** Inclinação da reta (mínimos quadrados) em fração da média por mês: 0,03 = sobe 3% ao mês. */
function inclinacao(pontos: { x: number; y: number }[]): number | null {
  if (pontos.length < 4) return null
  const mx = media(pontos.map((p) => p.x))
  const my = media(pontos.map((p) => p.y))
  if (my <= 0) return null
  const den = soma(pontos.map((p) => (p.x - mx) ** 2))
  return den ? soma(pontos.map((p) => (p.x - mx) * (p.y - my))) / den / my : null
}

/** Um valor "redondo" de dizer: 37 → 40, 432 → 450, 1.234 → 1.300. */
export function redondo(n: number) {
  if (n <= 0) return 0
  const passo = n < 100 ? 10 : n < 1000 ? 50 : n < 10000 ? 100 : 500
  return Math.ceil(n / passo - 1e-9) * passo
}

// Grupos da regra 50/30/20 pelo nome da categoria (as categorias são da pessoa: vale o nome em português, inglês ou espanhol).
const RE_DIVIDA = /divida|parcela|emprestimo|financiamento|consignado|\bdebt|\bloan|deuda|prestamo|cuota/
const RE_ESTILO = /lazer|assinatura|compra|cuidado|beleza|estetica|restaurante|delivery|ifood|viage|presente|roupa|vestu|entretenimento|diversao|hobby|\bbar\b|festa|streaming|shopping|leisure|subscription|entertainment|travel|gift|cloth|beauty|personal|ocio|suscripc|viaje|regalo|ropa|belleza/
const RE_ESSENCIAL = /moradia|aluguel|condominio|\bcasa\b|\bluz\b|energia|\bagua\b|\bgas\b|internet|telefon|celular|aliment|mercado|feira|transporte|combustivel|gasolina|onibus|saude|farmacia|remedio|medic|educa|escola|faculdade|curso|imposto|taxa|tributo|seguro|\bpets?\b|creche|housing|\brent\b|utilit|grocer|\bfood|transport|health|tax|insurance|vivienda|alquiler|comida|salud|impuesto|servicio/
const RE_ASSINATURA = /assinatura|netflix|spotify|prime video|amazon prime|disney|hbo|\bmax\b|youtube|deezer|globoplay|paramount|apple|icloud|google one|chatgpt|openai|academia|smartfit|gympass|wellhub|streaming|subscription|suscripc/
const RE_JUROS = /\bjuros\b|\bmulta\b|\bmora\b|\biof\b|encargo|tarifa|anuidade|cheque especial|rotativo|\binterest\b|late fee|recargo|interes/

function grupoDa(c: Categoria | undefined): Grupo {
  if (!c) return 'outros'
  if (c.papel === 'divida') return 'dividas'
  const n = normal(c.nome)
  if (RE_DIVIDA.test(n)) return 'dividas'
  if (RE_ESTILO.test(n)) return 'estilo'
  if (RE_ESSENCIAL.test(n)) return 'essencial'
  return 'outros'
}

const tomDa = (nota: number): Tom => (nota >= 70 ? 'bom' : nota >= 45 ? 'medio' : 'ruim')

export function rotuloDaNota(nota: number) {
  return nota >= 85 ? tx('Excelente') : nota >= 70 ? tx('Boa') : nota >= 55 ? tx('Razoável') : nota >= 40 ? tx('Frágil') : tx('Precisa de cuidado')
}

export function infoFases(alvoReserva = RESERVA_RENDA_ESTAVEL): InfoFase[] {
  return [
    { id: 'vermelho', nome: tx('Sair do vermelho'), descricao: tx('Fazer entrar mais do que sai, todo mês.') },
    { id: 'colchao', nome: tx('Colchão de segurança'), descricao: tx('Ter 1 mês de gastos guardado para imprevistos.') },
    { id: 'dividas', nome: tx('Quitar dívidas caras'), descricao: tx('Livrar-se das dívidas que cobram {0}% ao mês ou mais.', JUROS_CARO_MES) },
    { id: 'reserva', nome: tx('Reserva completa'), descricao: tx('Juntar {0} meses de gastos para imprevistos.', alvoReserva) },
    { id: 'crescer', nome: tx('Fazer o dinheiro crescer'), descricao: tx('Metas, futuro e o que você constrói.') },
  ]
}

// ---------- dívidas: simulação das estratégias ----------

interface DividaSim {
  id: string
  nome: string
  /**
   * Quanto falta pagar em cada mês, a partir do atual ([0] = este mês, [1] = o que vem…), tirado do calendário de parcelas
   * da dívida (o mesmo da tela Dívidas). Vazia = dívida sem parcela fixa ("aberta"): cresce com os juros e só diminui com
   * dinheiro a mais.
   */
  agenda: number[]
  /** Saldo da dívida aberta. */
  aberto: number
  /** A parcela de costume: o que fica livre por mês quando a dívida acaba. */
  parcela: number
  /** % ao mês (null = não informado: conta como sem juros). */
  juros: number | null
}

/** As parcelas que faltam, mês a mês, pelo calendário da dívida (ou, sem ele, uma parcela por mês a partir do que vem). */
function agendaDa(s: SituacaoDivida, hojeIso: string, atual: number): number[] {
  const p = s.divida.valor_parcela
  if (!p || p <= 0) return []
  const agenda: number[] = []
  const cal = calendarioDe(s, hojeIso)
  if (cal) {
    for (const x of cal.parcelas) if (x.falta > 0) {
      const k = Math.max(0, chaveMes(Number(x.vencimento.slice(0, 4)), Number(x.vencimento.slice(5, 7))) - atual)
      // a atrasada já leva os juros de atraso estimados
      agenda[k] = (agenda[k] ?? 0) + x.falta + (s.atraso?.porParcela.get(x.n) ?? 0)
    }
  } else {
    let resta = s.restanteHoje
    for (let k = 1; resta > 0.005 && k <= LIMITE_SIMULACAO; k++) {
      agenda[k] = Math.min(p, resta)
      resta -= agenda[k]
    }
  }
  return Array.from(agenda, (x) => x ?? 0)
}

const saldoSim = (d: Pick<DividaSim, 'agenda' | 'aberto'>) => (d.agenda.length ? soma(d.agenda) : d.aberto)

/**
 * Antecipa parcelas do fim de uma dívida parcelada com `dinheiro`, no mês `t`: a parcela de daqui a k meses vale hoje
 * parcela ÷ (1 + juros)^k. É o desconto dos juros que a lei garante a quem adianta. Devolve o que sobrou do dinheiro.
 */
function antecipar(d: Pick<DividaSim, 'agenda' | 'juros'>, dinheiro: number, t: number, pagar: (v: number) => void) {
  const i = (d.juros ?? 0) / 100
  let resta = dinheiro
  for (let s = d.agenda.length - 1; s > t && resta > 0.005; s--) {
    const v = d.agenda[s]
    if (!(v > 0)) continue
    const custo = v / Math.pow(1 + i, s - t)
    if (resta >= custo) {
      d.agenda[s] = 0
      pagar(custo)
      resta -= custo
    } else {
      d.agenda[s] = v * (1 - resta / custo)
      pagar(resta)
      resta = 0
    }
  }
  return resta
}

const LIMITE_SIMULACAO = 600

/**
 * Mês a mês, a partir do atual: as dívidas abertas crescem com os juros, as parceladas pagam a parcela do mês e (nas
 * estratégias) o dinheiro a mais vai para a dívida da vez. Quando uma dívida acaba, a parcela dela passa a reforçar a
 * próxima (o efeito bola de neve). `meses` é o mês (0 = o atual) em que a última acaba; null = nunca acaba.
 */
function simular(dividas: DividaSim[], extra: number, estrategia: IdEstrategia) {
  const ds = dividas.map((d) => ({ ...d, agenda: [...d.agenda], fim: null as number | null }))
  const comExtra = estrategia !== 'parcelas'
  const ordem = (a: (typeof ds)[number], b: (typeof ds)[number]) => (estrategia === 'avalanche'
    ? (b.juros ?? -1) - (a.juros ?? -1) || saldoSim(a) - saldoSim(b)
    : saldoSim(a) - saldoSim(b) || (b.juros ?? -1) - (a.juros ?? -1)) || a.id.localeCompare(b.id)
  let total = 0
  let liberado = 0
  const pagar = (v: number) => { total += v }
  const fins = () => new Map(ds.map((d) => [d.id, d.fim]))
  for (let t = 0; t < LIMITE_SIMULACAO; t++) {
    const vivas = ds.filter((d) => saldoSim(d) > 0.005)
    // só pagando as parcelas, a dívida sem parcela nunca acaba
    if (!comExtra && vivas.length && vivas.every((d) => !d.agenda.length)) break
    for (const d of vivas) if (!d.agenda.length && d.juros && t > 0) d.aberto *= 1 + d.juros / 100
    for (const d of vivas) if (d.agenda[t]) {
      total += d.agenda[t]
      d.agenda[t] = 0
    }
    if (comExtra) {
      let resta = extra + liberado
      for (const d of ds.filter((x) => saldoSim(x) > 0.005).sort(ordem)) {
        if (resta <= 0.005) break
        if (!d.agenda.length) {
          const p = Math.min(resta, d.aberto)
          d.aberto -= p
          total += p
          resta -= p
        } else resta = antecipar(d, resta, t, pagar)
      }
    }
    for (const d of ds) if (d.fim === null && saldoSim(d) <= 0.005) {
      d.fim = t
      d.aberto = 0
      if (comExtra) liberado += d.parcela
    }
    if (ds.every((d) => d.fim !== null)) return { meses: t, total: centavos(total), fins: fins() }
  }
  return { meses: null, total: centavos(total), fins: fins() }
}

/** Quanto a dívida vale hoje (o que quitaria tudo agora, com o desconto dos juros das parcelas que faltam). */
function valorHoje(d: DividaSim) {
  if (!d.agenda.length) return d.aberto
  const i = (d.juros ?? 0) / 100
  return soma(d.agenda.map((v, s) => v / Math.pow(1 + i, s)))
}

function planoDasDividas(abertas: SituacaoDivida[], extraPlano: number, renda: number, atual: number, hojeIso: string): PlanoDividas | null {
  const ds: DividaSim[] = abertas.map((s) => {
    const agenda = agendaDa(s, hojeIso, atual)
    const parcela = s.divida.valor_parcela && s.divida.valor_parcela > 0 ? s.divida.valor_parcela : 0
    return {
      id: s.divida.id, nome: s.divida.descricao, agenda, aberto: agenda.length ? 0 : s.restanteHoje, parcela,
      // atrasada com regra de atraso: pesa o juro do atraso (é o que ela está cobrando agora)
      juros: jurosQuePesam(s),
    }
  })
  if (!ds.length) return null
  const total = centavos(soma(abertas.map((s) => s.restanteHoje)))
  const parcelasMes = centavos(soma(ds.map((d) => Math.min(d.parcela, saldoSim(d)))))
  const jurosPorMes = centavos(soma(ds.map((d) => (d.juros ? valorHoje(d) * (d.juros / 100) : 0))))
  const jurosEmbutidos = centavos(soma(ds.filter((d) => d.agenda.length).map((d) => saldoSim(d) - valorHoje(d))))
  // sem espaço na sobra para as dívidas: mostra o que aconteceria com um valor pequeno a mais por mês
  const extraExemplo = extraPlano < 1
  const extra = extraExemplo ? Math.max(redondo(renda * 0.05), redondo(parcelasMes * 0.1), 50) : extraPlano
  const quando = (m: number | null | undefined) => (m === null || m === undefined ? null : doMesChave(atual + m))
  const base = simular(ds, 0, 'parcelas')
  const avalanche = simular(ds, extra, 'avalanche')
  const bola = simular(ds, extra, 'bola-de-neve')
  const estrategia = (id: IdEstrategia, r: ReturnType<typeof simular>): Estrategia => ({
    id, meses: r.meses === null ? null : r.meses + 1, fim: quando(r.meses), totalPago: r.total,
    economia: base.meses === null || r.meses === null ? null : centavos(Math.max(0, base.total - r.total)),
  })
  // Avalanche (juros mais altos primeiro) economiza mais; a bola de neve (menor saldo primeiro) dá vitórias rápidas.
  // Se a diferença for pequena, a motivação vale mais.
  const comparavel = bola.meses !== null && avalanche.meses !== null
  const diferenca = comparavel ? bola.total - avalanche.total : 0
  const comJuros = ds.filter((d) => d.juros !== null).length
  const primeiraDe = (r: ReturnType<typeof simular>) => [...ds].sort((a, b) => (r.fins.get(a.id) ?? Infinity) - (r.fins.get(b.id) ?? Infinity))[0]?.id
  const mesmaOrdem = comparavel && primeiraDe(avalanche) === primeiraDe(bola) && Math.abs(diferenca) < 1
  const pequena = comparavel && !mesmaOrdem && diferenca <= Math.max(1, total * 0.01)
  const recomendada = comJuros >= 1 && !pequena ? 'avalanche' : 'bola-de-neve'
  const escolhida = recomendada === 'avalanche' ? avalanche : bola
  const porque = ds.length === 1 ? tx('Com uma dívida só, todo dinheiro a mais vai para ela.')
    : mesmaOrdem && comJuros >= 1 ? tx('A dívida de juros mais altos é também a que acaba primeiro: comece por ela.')
      : recomendada === 'avalanche'
        ? comparavel
          ? tx('Pagar primeiro a dívida de juros mais altos economiza {0} a mais do que começar pela menor.', fmtValor(centavos(diferenca)))
          : tx('Pagar primeiro a dívida de juros mais altos é o que mais economiza.')
        : comJuros === 0 ? tx('Sem os juros de cada dívida, começar pela menor dá vitórias rápidas. Informe os juros para o app comparar o custo.')
          : tx('A diferença entre as estratégias é pequena, então começar pela menor dívida dá vitórias rápidas e ajuda a manter o ritmo.')
  const ordem = [...ds]
    .sort((a, b) => (escolhida.fins.get(a.id) ?? Infinity) - (escolhida.fins.get(b.id) ?? Infinity) || a.id.localeCompare(b.id))
    .map((d): DividaNoPlano => ({
      id: d.id, nome: d.nome, restante: centavos(saldoSim(d)), parcela: d.parcela || null, juros: d.juros, quitarHoje: centavos(valorHoje(d)),
      quitaEm: quando(escolhida.fins.get(d.id)),
      quitaSemExtra: quando(base.fins.get(d.id)),
    }))
  return {
    total, parcelasMes, jurosPorMes, jurosEmbutidos, extra, extraExemplo, recomendada, porque, ordem,
    estrategias: [estrategia('parcelas', base), estrategia('avalanche', avalanche), estrategia('bola-de-neve', bola)],
    semJuros: ds.filter((d) => d.juros === null).length,
    temCara: ds.some((d) => (d.juros ?? 0) >= JUROS_CARO_MES),
  }
}

// ---------- recorrências e gastos formiga ----------

interface Grupo3 { chave: string; ls: Lancamento[] }

function agrupar(ls: Lancamento[]): Grupo3[] {
  const m = new Map<string, Lancamento[]>()
  for (const l of ls) {
    const k = chaveDescricao(l.descricao)
    if (k.length < 3) continue
    m.set(k, [...(m.get(k) ?? []), l])
  }
  return [...m].map(([chave, ls]) => ({ chave, ls }))
}

/**
 * O que se repete todo mês (uma vez por mês, valor parecido): aluguel, assinaturas, salário. `tipo` escolhe saídas ou
 * entradas. Olha os 6 meses fechados; vale a partir de 3 meses (2, se a pessoa tem poucos meses lançados).
 */
/** "Plano de internet" é a conta "Internet": todas as palavras do nome mais curto estão no mais comprido. */
function mesmoNome(a: string, b: string) {
  const [curto, longo] = a.length <= b.length ? [a, b] : [b, a]
  const palavras = new Set(longo.split(' '))
  return curto.length >= 3 && curto.split(' ').every((p) => palavras.has(p))
}

/**
 * Uma recorrência encontrada. `partes` são as vezes em que ela cai no mês, em ordem de dia: uma só para o aluguel, duas
 * para o salário pago em adiantamento e salário (dia 5 e dia 20). `valor` é o total do mês.
 */
interface Achado extends Recorrente {
  chave: string
  partes: { dia: number; valor: number }[]
  contaFixa: boolean
  noCartao: boolean
}

/**
 * A mesma conta cadastrada em dois lugares (como dívida e como conta do mês): vence no mesmo mês, com valor até 5%
 * diferente, e no mesmo dia ou com o mesmo nome. Conta uma vez só, na previsão e na agenda.
 */
function mesmoCompromisso(a: { descricao: string; valor: number; vencimento: string }, b: { descricao: string; valor: number; vencimento: string }) {
  return a.vencimento.slice(0, 7) === b.vencimento.slice(0, 7) && Math.abs(a.valor - b.valor) <= a.valor * 0.05
    && (a.vencimento === b.vencimento || mesmoNome(chaveDescricao(a.descricao), chaveDescricao(b.descricao)))
}

function recorrencias(
  lancs: Lancamento[], atual: number, tipo: 'entrada' | 'saida', nomeCat: (l: Lancamento) => string, contas: ContaFixa[],
): Achado[] {
  const nomesDasContas = contas.filter((c) => c.ativa && c.tipo === tipo).map((c) => chaveDescricao(c.descricao))
  const janela = lancs.filter((l) => l.tipo === tipo && l.valor > 0 && !l.divida_id && (l.parcelas ?? 1) <= 1
    && chaveMes(l.ano, l.mes) >= atual - 6 && chaveMes(l.ano, l.mes) < atual)
  const mesesComAlgo = new Set(janela.map((l) => chaveMes(l.ano, l.mes))).size
  const minimo = mesesComAlgo >= 4 ? RECORRENTE_MESES : 2
  // Entrada pode cair duas vezes no mês (adiantamento e salário); saída que cai duas vezes é do dia a dia (o mercado).
  const maxVezes = tipo === 'entrada' ? 2 : 1
  const achados: Achado[] = []
  for (const { chave, ls } of agrupar(janela)) {
    const porMes = new Map<number, Lancamento[]>()
    for (const l of ls) porMes.set(chaveMes(l.ano, l.mes), [...(porMes.get(chaveMes(l.ano, l.mes)) ?? []), l])
    const vezes = Math.max(...[...porMes.values()].map((x) => x.length))
    if (porMes.size < minimo || vezes > maxVezes) continue
    // todo mês, e ainda de pé: o bimestral (3 vezes em 5 meses) e o que parou há meses não contam
    const chaves = [...porMes.keys()]
    if (porMes.size < 0.75 * (Math.max(...chaves) - Math.min(...chaves) + 1) || Math.max(...chaves) < atual - 2) continue
    // o valor parecido vale para o total do mês (com duas partes, as duas somadas)
    const totais = [...porMes.values()].map((x) => soma(x.map((l) => l.valor)))
    const maior = Math.max(...totais)
    if ((maior - Math.min(...totais)) / maior > 0.35) continue
    const completos = [...porMes].filter(([, x]) => x.length === vezes).sort((a, b) => b[0] - a[0])
    // com duas partes, cada uma precisa aparecer na maioria dos meses (senão é coincidência, não um salário dividido)
    if (vezes > 1 && completos.length < Math.max(2, porMes.size * 0.6)) continue
    const ultimo = [...ls].sort((a, b) => chaveMes(b.ano, b.mes) - chaveMes(a.ano, a.mes))[0]
    const emOrdem = completos.map(([, x]) => [...x].sort((a, b) => diaDe(a.data) - diaDe(b.data)))
    const partes = vezes === 1
      ? [{ dia: Math.round(mediana(ls.map((l) => diaDe(l.data)).filter(Boolean))) || 0, valor: ultimo.valor }]
      : Array.from({ length: vezes }, (_, i) => ({
        dia: Math.round(mediana(emOrdem.map((x) => diaDe(x[i].data)).filter(Boolean))) || 0,
        valor: emOrdem[0][i].valor,
      }))
    achados.push({
      chave, descricao: ultimo.descricao.trim(), valor: centavos(soma(partes.map((p) => p.valor))), meses: porMes.size, partes,
      assinatura: tipo === 'saida' && (RE_ASSINATURA.test(normal(ultimo.descricao)) || RE_ASSINATURA.test(normal(nomeCat(ultimo)))),
      contaFixa: ls.some((l) => l.conta_fixa_id) || nomesDasContas.some((n) => mesmoNome(n, chave)), noCartao: ls.some((l) => l.cartao_id),
    })
  }
  return achados.sort((a, b) => b.valor - a.valor)
}

/** O que ainda falta de uma recorrência num mês: as partes que não vieram (o adiantamento caiu, falta o salário). */
function faltaDa(r: Achado, tipo: 'entrada' | 'saida', lancsDoMes: Lancamento[]) {
  const vieram = lancsDoMes.filter((l) => l.tipo === tipo && chaveDescricao(l.descricao) === r.chave).length
  return r.partes.slice(Math.min(vieram, r.partes.length))
}

/** Compras pequenas que se repetem muitas vezes no mês ("gastos formiga"), nos 3 meses fechados. */
function gastosFormiga(lancs: Lancamento[], atual: number, renda: number, gastoMedio: number): Formiga[] {
  const teto = renda > 0 ? renda * FORMIGA_VALOR : gastoMedio * 0.02
  if (teto <= 0) return []
  const janela = lancs.filter((l) => l.tipo === 'saida' && l.valor > 0 && l.valor <= teto && !l.divida_id && !l.conta_fixa_id
    && (l.parcelas ?? 1) <= 1 && chaveMes(l.ano, l.mes) >= atual - MESES_NA_MEDIA && chaveMes(l.ano, l.mes) < atual)
  const meses = Math.max(1, new Set(janela.map((l) => chaveMes(l.ano, l.mes))).size)
  return agrupar(janela)
    .map(({ ls }) => {
      const total = soma(ls.map((l) => l.valor))
      const porMes = centavos(total / meses)
      return { descricao: ls[ls.length - 1].descricao.trim(), vezesPorMes: ls.length / meses, ticket: centavos(total / ls.length), porMes, porAno: centavos(porMes * 12) }
    })
    .filter((f) => f.vezesPorMes >= FORMIGA_VEZES && f.porMes >= (renda > 0 ? renda : gastoMedio) * 0.015)
    .sort((a, b) => b.porMes - a.porMes)
    .slice(0, 3)
}

// ---------- o motor ----------

export function analisar(e: EntradaAnalise): Analise {
  const hoje = e.hoje ?? new Date()
  const hojeIso = hojeLocal(hoje)
  const v = visao(e.perfil)
  const ano = hoje.getFullYear()
  const mes = hoje.getMonth() + 1
  const atual = chaveMes(ano, mes)
  const fechados = Array.from({ length: MESES_DA_ANALISE }, (_, i) => atual - MESES_DA_ANALISE + i)
  const catPorId = new Map(e.categorias.map((c) => [c.id, c]))
  const nomeCat = (l: Lancamento) => catPorId.get(e.categoriaDe(l))?.nome ?? ''
  const dividaPorId = new Map(e.dividas.map((d) => [d.id, d]))
  const ehEmprestimo = (l: Lancamento) => {
    const d = l.divida_id ? dividaPorId.get(l.divida_id) : undefined
    return Boolean(d && aumentaDivida(l.tipo, d))
  }
  /** Passar dinheiro para a caixinha, a poupança, um investimento ou outra conta sua (e o resgate): não é renda nem gasto. */
  // marcada pela pessoa ("Foi guardar dinheiro?") ou reconhecida pela descrição
  const ehDeBolso = (l: Lancamento) => ehGuardado(l) || (!l.cartao_id && !l.divida_id && mudaDeBolso(l.descricao, nomeCat(l)))
  const daJanela = e.lancs.filter((l) => {
    const k = chaveMes(l.ano, l.mes)
    return k >= atual - MESES_DA_ANALISE && k <= atual && l.valor > 0 && !ehEmprestimo(l)
  })
  const naJanela = daJanela.filter((l) => !ehDeBolso(l))
  /** Quanto foi guardado (passado para a caixinha, poupança, investimento) menos o resgatado, por mês. */
  const guardadoNoMes = new Map<number, number>()
  for (const l of daJanela) if (ehDeBolso(l)) {
    const k = chaveMes(l.ano, l.mes)
    guardadoNoMes.set(k, (guardadoNoMes.get(k) ?? 0) + (l.tipo === 'saida' ? l.valor : -l.valor))
  }

  // ----- recorrências (o que se repete todo mês): serve para a revisão e para prever o resto do mês -----
  const contasAtivas = v.contas ? e.contas : []
  const recSaidas = recorrencias(naJanela, atual, 'saida', nomeCat, contasAtivas)
  const recEntradas = recorrencias(naJanela, atual, 'entrada', nomeCat, contasAtivas)
  const chavesRecorrentes = new Set(recSaidas.map((r) => r.chave))
  /** Gasto do dia a dia: o que não é conta do mês, cartão, dívida nem algo que se repete todo mês. */
  const ehDiaADia = (l: Lancamento) => l.tipo === 'saida' && !l.conta_fixa_id && !l.cartao_id && !l.divida_id && !chavesRecorrentes.has(chaveDescricao(l.descricao))

  // ----- série mês a mês -----
  interface Bruto {
    entradas: number; saidas: number; porCategoria: Map<string, number>; parcelado: Map<string, number>; porFonte: Map<string, number>
    cartao: number; ateDia: number; rendaExtra: number
  }
  const novo = (): Bruto => ({ entradas: 0, saidas: 0, porCategoria: new Map(), parcelado: new Map(), porFonte: new Map(), cartao: 0, ateDia: 0, rendaExtra: 0 })
  const chavesEntradasFixas = new Set(recEntradas.map((r) => r.chave))
  const brutos = new Map<number, Bruto>([...fechados, atual].map((k) => [k, novo()]))
  const diaHoje = hoje.getDate()
  for (const l of naJanela) {
    const b = brutos.get(chaveMes(l.ano, l.mes))!
    const k = e.categoriaDe(l)
    if (l.tipo === 'entrada') {
      b.entradas += l.valor
      b.porFonte.set(k, (b.porFonte.get(k) ?? 0) + l.valor)
      if (!l.conta_fixa_id && !chavesEntradasFixas.has(chaveDescricao(l.descricao))) b.rendaExtra += l.valor
    } else {
      b.saidas += l.valor
      b.porCategoria.set(k, (b.porCategoria.get(k) ?? 0) + l.valor)
      if (l.cartao_id && (l.parcelas ?? 1) > 1) b.parcelado.set(k, (b.parcelado.get(k) ?? 0) + l.valor)
      if (l.cartao_id) b.cartao += l.valor
      // Até este dia do mês. O lançamento sem data entra pela parte do mês que já passou: no mês atual ele conta inteiro
      // (já aconteceu), e sem o rateio os outros meses pareceriam mais leves e o "gastando mais rápido" seria falso.
      if (!l.data) b.ateDia += l.valor * Math.min(1, diaHoje / new Date(l.ano, l.mes, 0).getDate())
      else if (diaDe(l.data) <= diaHoje) b.ateDia += l.valor
    }
  }
  const serie: MesDaSerie[] = [...fechados, atual].map((k) => {
    const b = brutos.get(k)!
    const { ano: a, mes: m } = doMesChave(k)
    return {
      ano: a, mes: m, entradas: centavos(b.entradas), saidas: centavos(b.saidas), sobra: centavos(b.entradas - b.saidas),
      comDados: k !== atual && b.entradas > 0 && b.saidas > 0, atual: k === atual,
      porCategoria: Object.fromEntries([...b.porCategoria].map(([id, x]) => [id, centavos(x)])),
    }
  })
  const chavesComDados = fechados.filter((k) => { const b = brutos.get(k)!; return b.entradas > 0 && b.saidas > 0 })
  // O mesmo critério do conselheiro: os últimos 3 meses fechados, com entradas e saídas.
  const recentes = chavesComDados.filter((k) => k >= atual - MESES_NA_MEDIA)
  const temFluxo = recentes.length >= MIN_MESES_COM_DADOS
  const rec = recentes.map((k) => brutos.get(k)!)
  const renda = temFluxo ? centavos(media(rec.map((b) => b.entradas))) : 0
  const gastos = temFluxo ? centavos(media(rec.map((b) => b.saidas))) : 0
  const sobra = centavos(renda - gastos)
  const sobraFracao = renda > 0 ? sobra / renda : 0
  const guardando = temFluxo ? centavos(media(recentes.map((k) => guardadoNoMes.get(k) ?? 0))) : 0
  const todos = chavesComDados.map((k) => brutos.get(k)!)
  const variacaoRenda = todos.length >= 3 ? desvio(todos.map((b) => b.entradas)) / media(todos.map((b) => b.entradas)) : null
  const rendaVaria = (variacaoRenda ?? 0) > RENDA_VARIA_ACIMA
  const tendenciaGastos = inclinacao(chavesComDados.map((k) => ({ x: k, y: brutos.get(k)!.saidas })))
  const tendenciaRenda = inclinacao(chavesComDados.map((k) => ({ x: k, y: brutos.get(k)!.entradas })))
  const variacaoGastos = todos.length >= 3 ? desvio(todos.map((b) => b.saidas)) / media(todos.map((b) => b.saidas)) : null

  // de onde vem a renda
  const fontes = new Map<string, number>()
  for (const b of rec) for (const [k, x] of b.porFonte) fontes.set(k, (fontes.get(k) ?? 0) + x)
  const totalFontes = soma([...fontes.values()])
  const maiorFonte = [...fontes].sort((a, b) => b[1] - a[1])[0]
  const principalFonte = maiorFonte && totalFontes > 0
    ? { nome: catPorId.get(maiorFonte[0])?.nome ?? tx('Sem categoria'), fracao: maiorFonte[1] / totalFontes }
    : null

  // ----- categorias -----
  const idsCategorias = new Set<string>()
  for (const k of chavesComDados) for (const id of brutos.get(k)!.porCategoria.keys()) idsCategorias.add(id)
  for (const id of brutos.get(atual)!.porCategoria.keys()) idsCategorias.add(id)
  const anteriores = chavesComDados.filter((k) => k < atual - MESES_NA_MEDIA)
  // compras parceladas que ainda têm parcelas daqui em diante, por categoria (para dizer o que pesa e quando acaba)
  const fimDaCompra = new Map<string, number>()
  for (const l of e.compras) if (l.compra_id && (l.parcelas ?? 1) > 1) fimDaCompra.set(l.compra_id, Math.max(fimDaCompra.get(l.compra_id) ?? 0, chaveMes(l.ano, l.mes)))
  const parcelasPorCategoria = new Map<string, Map<string, { descricao: string; valor: number; termina: number }>>()
  for (const l of e.compras) {
    const k = chaveMes(l.ano, l.mes)
    if (!l.compra_id || (l.parcelas ?? 1) <= 1 || (k !== atual && k !== atual + 1)) continue
    const termina = fimDaCompra.get(l.compra_id)!
    const cat = e.categoriaDe(l)
    const m = parcelasPorCategoria.get(cat) ?? new Map<string, { descricao: string; valor: number; termina: number }>()
    m.set(l.compra_id, { descricao: l.descricao, valor: l.valor, termina })
    parcelasPorCategoria.set(cat, m)
  }
  const categorias: CategoriaAnalise[] = [...idsCategorias].map((id) => {
    const c = catPorId.get(id)
    const mediaRec = rec.length ? media(rec.map((b) => b.porCategoria.get(id) ?? 0)) : 0
    const antes = anteriores.length >= 2 ? media(anteriores.map((k) => brutos.get(k)!.porCategoria.get(id) ?? 0)) : null
    const parcelado = rec.length ? media(rec.map((b) => b.parcelado.get(id) ?? 0)) : 0
    return {
      id, nome: c?.nome ?? tx('Sem categoria'), icone: c?.icone ?? '·', cor: c?.cor ?? '#55555f', grupo: grupoDa(c),
      media: centavos(mediaRec), antes: antes === null ? null : centavos(antes),
      variacao: antes && antes > 0 ? (mediaRec - antes) / antes : null,
      atual: centavos(brutos.get(atual)!.porCategoria.get(id) ?? 0), sugestao: centavos(mediaRec),
      parcelado: centavos(parcelado),
      parceladoAntes: anteriores.length >= 2 ? centavos(media(anteriores.map((k) => brutos.get(k)!.parcelado.get(id) ?? 0))) : null,
      parcelas: [...(parcelasPorCategoria.get(id)?.values() ?? [])].sort((a, b) => b.valor - a.valor).slice(0, 2)
        .map((x) => ({ descricao: x.descricao, valor: x.valor, termina: doMesChave(x.termina) })),
    }
  }).filter((c) => c.media > 0 || c.atual > 0).sort((a, b) => b.media - a.media || b.atual - a.atual)
  const relevante = gastos * SUBIU_RELEVANTE
  const subiram = categorias
    .filter((c) => c.grupo !== 'dividas' && c.antes !== null && c.variacao !== null && c.variacao >= SUBIU_ACIMA && c.media - c.antes >= relevante)
    .sort((a, b) => (b.media - b.antes!) - (a.media - a.antes!)).slice(0, 3)
  const cairam = categorias
    .filter((c) => c.antes !== null && c.variacao !== null && c.variacao <= -SUBIU_ACIMA && c.antes - c.media >= relevante)
    .sort((a, b) => (b.antes! - b.media) - (a.antes! - a.media)).slice(0, 3)
  const semCategoria = gastos > 0 ? (categorias.find((c) => c.id === '')?.media ?? 0) / gastos : 0

  // ----- regra 50/30/20 -----
  const porGrupo = (g: Grupo) => soma(categorias.filter((c) => c.grupo === g).map((c) => c.media))
  const regra: Regra503020 | null = temFluxo && renda > 0 ? {
    renda, essencial: porGrupo('essencial') / renda, parcelas: porGrupo('dividas') / renda, estilo: porGrupo('estilo') / renda,
    outros: porGrupo('outros') / renda, sobra: Math.max(0, sobraFracao),
  } : null

  // ----- revisão: recorrentes, assinaturas, formigas, juros pagos -----
  const recorrentes: Recorrente[] = recSaidas.map(({ descricao, valor, meses, assinatura }) => ({ descricao, valor, meses, assinatura }))
  const assinaturasPorMes = centavos(soma(recorrentes.filter((r) => r.assinatura).map((r) => r.valor)))
  const recorrentesPorMes = centavos(soma(recorrentes.map((r) => r.valor)))
  const formigas = temFluxo ? gastosFormiga(naJanela, atual, renda, gastos) : []
  const lancsDeJurosDeFatura = new Set(e.faturasPagas.map((f) => f.juros_lanc_id).filter(Boolean))
  const jurosDeFatura = soma(e.faturasPagas.filter((f) => chaveMes(f.ano, f.mes) >= atual - MESES_DA_ANALISE).map((f) => f.juros ?? 0))
  const jurosLancados = soma(naJanela.filter((l) => l.tipo === 'saida' && !lancsDeJurosDeFatura.has(l.id) && RE_JUROS.test(normal(l.descricao))).map((l) => l.valor))
  const jurosPagos = centavos(jurosDeFatura + jurosLancados)

  // ----- dívidas -----
  const devo = e.dividas.filter((d) => !meDevem(d))
  const dividasHoje = v.dividas ? situacaoDividas(devo, e.saldos, e.pagamentos, ano, mes, e.taxas, hojeIso) : []
  const abertas = dividasHoje.filter((s) => s.restante > 0 && !s.semCotacao)
  // quanto se deve agora: com os juros de atraso estimados
  const dividaTotal = centavos(soma(abertas.map((s) => s.restanteHoje)))
  const parcelasMes = centavos(soma(abertas.map((s) => Math.min(s.divida.valor_parcela ?? 0, s.restante))))
  const atrasoDividas = centavos(soma(abertas.map((s) => atrasadoHoje(s, calendarioDe(s, hojeIso)))))
  const jurosMax = Math.max(0, ...abertas.map((s) => s.divida.juros_mes ?? 0))
  const maisCara = [...abertas].filter((s) => typeof s.divida.juros_mes === 'number').sort((a, b) => b.divida.juros_mes! - a.divida.juros_mes!)[0]
  const temCara = jurosMax >= JUROS_CARO_MES
  const temModerada = abertas.some((s) => (s.divida.juros_mes ?? 0) >= JUROS_MODERADO_MES)
  // há 3 meses, as mesmas dívidas
  const tresAtras = doMesChave(atual - 3)
  const antesDividas = v.dividas ? situacaoDividas(devo, e.saldos, e.pagamentos, tresAtras.ano, tresAtras.mes, e.taxas, hojeIso).filter((s) => s.restante > 0 && !s.semCotacao) : []
  const totalAntes = soma(antesDividas.map((s) => s.restante))
  const restanteHoje = new Map(abertas.map((s) => [s.divida.id, s.restanteHoje]))
  const dividaCresceu = totalAntes > 0 && soma(antesDividas.map((s) => restanteHoje.get(s.divida.id) ?? 0)) > totalAntes * 1.02

  // ----- sobra-alvo: quanto o plano pede para guardar -----
  /** Quase tudo o que entra vai para o essencial e as parcelas: a conversa é fechar o mês, não guardar 20%. */
  const apertado = temFluxo && renda > 0 && sobraFracao < 0.05 && regra !== null && regra.essencial + regra.parcelas >= 0.7
  const sobraAlvo = !temFluxo ? SOBRA_IDEAL : sobraFracao < 0 || apertado ? 0.05 : sobraFracao < 0.1 ? 0.1 : sobraFracao < SOBRA_IDEAL ? SOBRA_IDEAL : Math.min(sobraFracao, 0.3)

  // ----- previsão do mês atual -----
  let previsao: PrevisaoMes | null = null
  /** O gasto do dia a dia lançado hoje. */
  let gastoDeHojeNoDiaADia = 0
  /** O que ainda vai sair da conta até o fim do mês, descontado o que ainda entra (0 se o que entra cobre tudo). */
  let comprometidoNoMes = 0
  {
    const doMes = naJanela.filter((l) => l.ano === ano && l.mes === mes)
    const ate = (l: Lancamento) => !l.data || l.data <= hojeIso
    const entrouAteAgora = centavos(soma(doMes.filter((l) => l.tipo === 'entrada' && ate(l)).map((l) => l.valor)))
    const saiuAteAgora = centavos(soma(doMes.filter((l) => l.tipo === 'saida' && ate(l)).map((l) => l.valor)))
    const entradasDepois = soma(doMes.filter((l) => l.tipo === 'entrada' && !ate(l)).map((l) => l.valor))
    const saidasDepois = soma(doMes.filter((l) => l.tipo === 'saida' && !ate(l)).map((l) => l.valor))
    const fim = `${hojeIso.slice(0, 7)}-31`
    // Parcelas das dívidas até o fim do mês, inclusive as atrasadas de meses anteriores (com os juros de atraso): vão ter
    // de sair deste dinheiro, como na agenda.
    const parcelasDoMes = abertas.flatMap((s) => (calendarioDe(s, hojeIso)?.parcelas ?? [])
      .filter((p) => p.vencimento <= fim && p.falta > 0)
      .map((p) => ({ descricao: s.divida.descricao, vencimento: p.vencimento, valor: p.falta + (s.atraso?.porParcela.get(p.n) ?? 0) })))
    const parcelasPendentes = soma(parcelasDoMes.map((p) => p.valor))
    const sits = v.contas ? situacoesDasContas(e.contas, e.lancs, ano, mes, hojeIso, e.taxas) : []
    const abertasDoMes = sits.filter((s) => s.estado !== 'paga' && s.estado !== 'fora' && !s.semCotacao)
    // a parcela cadastrada também como conta do mês sai uma vez só
    const contasPagar = soma(abertasDoMes.filter((s) => s.conta.tipo === 'saida'
      && !parcelasDoMes.some((p) => mesmoCompromisso({ descricao: s.conta.descricao, valor: s.valor, vencimento: s.vencimento }, p))).map((s) => s.valor))
    const contasReceber = soma(abertasDoMes.filter((s) => s.conta.tipo === 'entrada').map((s) => s.valor))
    // o que se repete e ainda não veio (com o salário em duas partes, só a parte que falta)
    const faltaRecorrente = (lista: Achado[], tipo: 'entrada' | 'saida') => soma(lista
      .filter((r) => !r.contaFixa && !r.noCartao).flatMap((r) => faltaDa(r, tipo, doMes)).map((p) => p.valor))
    const recorrentesPagar = faltaRecorrente(recSaidas, 'saida')
    const recorrentesReceber = faltaRecorrente(recEntradas, 'entrada')
    const diasNoMes = new Date(ano, mes, 0).getDate()
    const diaADiaAgora = soma(doMes.filter((l) => ate(l) && ehDiaADia(l)).map((l) => l.valor))
    const diaADiaNormal = rec.length
      ? media(recentes.map((k) => soma(naJanela.filter((l) => chaveMes(l.ano, l.mes) === k && ehDiaADia(l)).map((l) => l.valor)))) / 30.4
      : null
    // Duas leituras do resto do mês: pelo ritmo deste mês (B) e pelo costume, descontando o que já saiu (A: quem fez a
    // compra grande do mercado no dia 3 não vai repetir todo dia). No começo do mês pesa o costume; no fim, o ritmo.
    const diasRestantes = diasNoMes - diaHoje
    const peloRitmo = (diaADiaAgora / diaHoje) * diasRestantes
    const peloCostume = diaADiaNormal === null ? peloRitmo
      : Math.max(diaADiaNormal * diasRestantes * 0.3, diaADiaNormal * diasNoMes - diaADiaAgora)
    const peso = diaHoje / diasNoMes
    const diaADiaPrevisto = centavos(peso * peloRitmo + (1 - peso) * peloCostume)
    const aPagar = centavos(saidasDepois + contasPagar + parcelasPendentes + recorrentesPagar)
    const aReceberConhecido = entradasDepois + contasReceber + recorrentesReceber
    // O salário ainda não caiu e não está em lugar nenhum? Conta a média, avisando.
    const rendaPelaMedia = temFluxo && entrouAteAgora + aReceberConhecido < renda * 0.5
    const aReceber = centavos(rendaPelaMedia ? Math.max(0, renda - entrouAteAgora) : aReceberConhecido)
    const entradasPrevistas = centavos(entrouAteAgora + aReceber)
    const saidasPrevistas = centavos(saiuAteAgora + aPagar + diaADiaPrevisto)
    const resultadoPrevisto = centavos(entradasPrevistas - saidasPrevistas)
    const sobraAlvoMes = centavos(Math.max(0, sobraAlvo * entradasPrevistas))
    // O que já foi para a caixinha/poupança neste mês conta para a sobra-alvo (e já não está na conta para gastar).
    const guardadoAteHoje = soma(daJanela.filter((l) => l.ano === ano && l.mes === mes && ate(l) && ehDeBolso(l)).map((l) => (l.tipo === 'saida' ? l.valor : -l.valor)))
    // Por dia a partir de hoje, contando hoje: o gasto do dia a dia de hoje fica de fora aqui porque o "quanto dá hoje"
    // (planejador) desconta ele depois; sem isso, o que a pessoa gasta hoje era descontado duas vezes.
    gastoDeHojeNoDiaADia = centavos(soma(doMes.filter((l) => l.data === hojeIso && ehDiaADia(l)).map((l) => l.valor)))
    const porDia = centavos((entradasPrevistas - Math.max(sobraAlvoMes, guardadoAteHoje) - (saiuAteAgora - gastoDeHojeNoDiaADia) - aPagar) / (diasNoMes - diaHoje + 1))
    comprometidoNoMes = centavos(Math.max(0, aPagar + diaADiaPrevisto - aReceber))
    const ateHojeNormal = rec.length ? centavos(media(rec.map((b) => b.ateDia))) : null
    const acimaDoNormal = categorias
      .filter((c) => c.grupo !== 'dividas' && c.media > 0 && c.atual > c.media * 1.05 && c.atual - c.media >= gastos * 0.02)
      .sort((a, b) => (b.atual - b.media) - (a.atual - a.media)).slice(0, 3)
      .map(({ id, nome, icone, atual: at, media: me }) => ({ id, nome, icone, atual: at, media: me }))
    if (doMes.length || temFluxo) {
      previsao = {
        dia: diaHoje, diasNoMes, entrouAteAgora, saiuAteAgora, aReceber, aPagar, diaADiaPrevisto, rendaPelaMedia,
        entradasPrevistas, saidasPrevistas, resultadoPrevisto, sobraAlvo: sobraAlvoMes, porDia, ateHojeNormal,
        contraMedia: temFluxo ? centavos(resultadoPrevisto - sobra) : null, acimaDoNormal,
        rendaExtraMedia: rendaPelaMedia || !rec.length ? 0 : centavos(media(rec.map((b) => b.rendaExtra))),
      }
    }
  }

  // ----- reserva -----
  const ef = mesEfetivo(e.meses, ano, mes, hoje)
  const preencheuBancos = Object.values(ef.caixa).some((b) => TIPOS_CAIXA.some((t) => typeof b?.[t] === 'number'))
  const investido = v.investimentos ? Math.max(0, ef.investimentos || 0) : 0
  // A conta corrente guarda também o dinheiro das contas que ainda vencem no mês: só o que sobra depois delas é reserva
  // (no dia em que o salário cai, a conta cheia não é 1 mês a mais de reserva). Caixinha, reserva e investido contam inteiros.
  const naConta = soma(Object.values(ef.caixa).map((b) => b?.cc ?? 0))
  const foraDaConta = soma(Object.keys(ef.caixa).map((id) => caixaDoBanco(ef.caixa, id))) - naConta
  const guardadoBancos = centavos(Math.max(0, foraDaConta + investido + Math.min(naConta, Math.max(0, naConta - comprometidoNoMes))))
  const naPrincipal = (valor: number, moeda: string) => (moeda === e.perfil.moeda ? valor : converter(valor, moeda, e.taxas) ?? 0)
  const metaReserva = v.metas ? e.metas.find((m) => /reserva|emergenc|emergency|imprevist/.test(normal(m.nome))) : undefined
  const guardadoMeta = metaReserva ? naPrincipal(situacaoMeta(metaReserva, e.movimentosMeta, hojeIso).guardado, metaReserva.moeda) : 0
  const conheceReserva = (v.bancos && preencheuBancos) || investido > 0 || guardadoMeta > 0
  const tem = (v.bancos && preencheuBancos) || investido > 0 ? guardadoBancos : guardadoMeta
  const alvoMeses = rendaVaria ? RESERVA_RENDA_VARIAVEL : RESERVA_RENDA_ESTAVEL
  const mesesReserva = gastos > 0 ? tem / gastos : 0

  // ----- fase -----
  const fase: Fase = temFluxo && sobra < 0 ? 'vermelho'
    : conheceReserva && gastos > 0 && mesesReserva < COLCHAO_MESES ? 'colchao'
      : temCara ? 'dividas'
        : !conheceReserva || (gastos > 0 && mesesReserva < alvoMeses) ? 'reserva'
          : 'crescer'

  // ----- metas -----
  const metasAtivas = v.metas ? e.metas.map((m) => ({ m, s: situacaoMeta(m, e.movimentosMeta, hojeIso) })).filter(({ s }) => !s.batida) : []
  const ritmoFechado = (movs: MovimentoMeta[]) => {
    const chaves = movs.map((x) => chaveMes(Number(x.data.slice(0, 4)), Number(x.data.slice(5, 7))))
    if (!chaves.length) return 0
    const janela = Math.min(MESES_NA_MEDIA, atual - Math.min(...chaves))
    if (janela <= 0) return 0
    return Math.max(0, soma(movs.filter((_, i) => atual - chaves[i] >= 1 && atual - chaves[i] <= janela).map((x) => x.valor)) / janela)
  }
  const metasNoPlano: MetaNoPlano[] = metasAtivas.map(({ m, s }) => {
    const ritmo = Math.max(ritmoFechado(s.movimentos), s.ritmo ?? 0)
    const prazo = m.prazo ? { ano: Number(m.prazo.slice(0, 4)), mes: Number(m.prazo.slice(5, 7)) } : null
    const previsao = ritmo > 0 ? doMesChave(atual + Math.ceil(s.falta / ritmo - 1e-9)) : null
    return {
      id: m.id, nome: m.nome, icone: m.icone, moeda: m.moeda, falta: s.falta, alvo: m.alvo, guardado: s.guardado, porMes: s.porMesNoPrazo, ritmo: centavos(ritmo), prazo, previsao,
      noRitmo: s.porMesNoPrazo === null ? ritmo > 0 : !s.atrasada && ritmo >= s.porMesNoPrazo * 0.9,
    }
  })
  const necessarioMetas = centavos(soma(metasNoPlano.map((m) => naPrincipal(m.porMes ?? 0, m.moeda))))

  // ----- para onde mandar a sobra (conforme a fase) -----
  let alocacao: Alocacao | null = null
  if (temFluxo && sobra > 0) {
    const temMetas = metasNoPlano.length > 0
    const partes: Partial<Record<'reserva' | 'dividas' | 'metas', number>> =
      fase === 'colchao' ? (temCara ? { reserva: 0.6, dividas: 0.4 } : temMetas ? { reserva: 0.8, metas: 0.2 } : { reserva: 1 })
        : fase === 'dividas' ? { dividas: 0.8, reserva: 0.2 }
          : fase === 'reserva' ? (temMetas ? { reserva: 0.7, metas: 0.3 } : temModerada ? { reserva: 0.7, dividas: 0.3 } : { reserva: 1 })
            : fase === 'crescer' ? (temMetas ? { metas: necessarioMetas > 0 ? Math.min(1, necessarioMetas / sobra) : 0.5 } : temModerada ? { dividas: 0.5 } : {})
              : {}
    // valores de dizer (múltiplos de 10), o resto fica livre
    const parte = (k: 'reserva' | 'dividas' | 'metas') => (sobra >= 200 ? Math.floor((sobra * (partes[k] ?? 0)) / 10) * 10 : centavos(sobra * (partes[k] ?? 0)))
    const reserva = parte('reserva')
    const dividas = abertas.length ? parte('dividas') : 0
    const metas = parte('metas')
    alocacao = { sobra, reserva, dividas, metas, livre: centavos(Math.max(0, sobra - reserva - dividas - metas)) }
  }

  // ----- plano das dívidas -----
  const dividas = abertas.length ? planoDasDividas(abertas, alocacao?.dividas ?? 0, renda, atual, hojeIso) : null

  // ----- plano da reserva -----
  let reserva: PlanoReserva | null = null
  if (conheceReserva && gastos > 0) {
    const alvo = centavos(alvoMeses * gastos)
    const falta = centavos(Math.max(0, alvo - tem))
    const porMes = alocacao?.reserva ?? 0
    reserva = {
      tem, base: gastos, meses: mesesReserva, colchao: centavos(COLCHAO_MESES * gastos), alvoMeses, alvo, falta, porMes, rendaVaria,
      chegaEm: falta > 0 && porMes > 0 ? doMesChave(atual + Math.ceil(falta / porMes - 1e-9)) : null,
      fonte: (v.bancos && preencheuBancos) || investido > 0 ? 'bancos' : 'meta',
    }
  }

  // ----- plano das metas -----
  const disponivelMetas = alocacao ? centavos(alocacao.metas + (fase === 'crescer' ? alocacao.livre : 0)) : 0
  const metas: PlanoMetas | null = metasNoPlano.length
    ? { necessario: necessarioMetas, disponivel: disponivelMetas, cabe: necessarioMetas <= disponivelMetas + 0.5, metas: metasNoPlano }
    : null

  // ----- orçamento: quanto cortar para chegar na sobra-alvo -----
  const corte = temFluxo ? centavos(Math.max(0, sobraAlvo * renda - sobra)) : 0
  if (corte > 0) {
    // corta primeiro o estilo de vida (até 35%), depois o que não tem grupo (até 25%) e, se ainda faltar, um pouco do essencial (8%)
    let falta = corte
    for (const [grupo, teto] of [['estilo', 0.35], ['outros', 0.25], ['essencial', 0.08]] as const) {
      const cortavel = (c: CategoriaAnalise) => Math.max(0, c.media - c.parcelado)
      const doGrupo = categorias.filter((c) => c.grupo === grupo && cortavel(c) > 0)
      const base = soma(doGrupo.map(cortavel))
      if (falta <= 0 || base <= 0) continue
      const fracao = Math.min(teto, falta / base)
      for (const c of doGrupo) c.sugestao = centavos(Math.max(0, c.media - cortavel(c) * fracao))
      falta -= base * fracao
    }
  }

  // ----- patrimônio -----
  let patrimonio: Patrimonio | null = null
  const temAtivos = e.meses.some((m) => Object.values(m.caixa ?? {}).some((b) => TIPOS_CAIXA.some((t) => typeof b?.[t] === 'number')) || (v.investimentos && m.investimentos > 0))
  if (temAtivos && (v.bancos || v.investimentos || v.moedas)) {
    const pontos = [...fechados, atual].map((k) => {
      const { ano: a, mes: m } = doMesChave(k)
      const efk = mesEfetivo(e.meses, a, m, hoje)
      const ativos = soma(Object.keys(efk.caixa).map((id) => caixaDoBanco(efk.caixa, id))) + (v.investimentos ? efk.investimentos || 0 : 0) + (v.moedas ? totalConvertido(efk.moedas, e.taxas) : 0)
      const passivo = v.dividas ? soma(situacaoDividas(devo, e.saldos, e.pagamentos, a, m, e.taxas, hojeIso).filter((s) => !s.semCotacao).map((s) => Math.max(0, s.restanteHoje))) : 0
      const informado = Object.values(efk.caixa).some((b) => TIPOS_CAIXA.some((t) => typeof b?.[t] === 'number')) || efk.investimentos > 0
      return { ano: a, mes: m, valor: centavos(ativos - passivo), ativos, passivo, informado }
    }).filter((p) => p.informado)
    const ultimo = pontos[pontos.length - 1]
    if (ultimo) {
      const parcelas12 = v.dividas ? soma(projecaoMensal(abertas, hojeIso, 12).map((p) => p.valor)) : 0
      const hojeValor = ultimo.valor
      patrimonio = {
        hoje: hojeValor, ativos: centavos(ultimo.ativos), dividas: centavos(ultimo.passivo),
        serie: pontos.map(({ ano: a, mes: m, valor }) => ({ ano: a, mes: m, valor })),
        variacao: pontos.length > 1 ? centavos(hojeValor - pontos[0].valor) : null,
        desde: pontos.length > 1 ? { ano: pontos[0].ano, mes: pontos[0].mes } : null,
        em12: centavos(hojeValor + (temFluxo ? sobra * 12 : 0) + parcelas12),
        em12NoPlano: centavos(hojeValor + (temFluxo ? (sobra + corte) * 12 : 0) + parcelas12),
      }
    }
  }

  // ----- cartão -----
  let cartao: InfoCartao | null = null
  const ativos = v.cartoes ? e.cartoes.filter((c) => c.ativo) : []
  if (ativos.length) {
    let usado = 0
    let limite = 0
    let algumLimite = false
    let atrasadas = 0
    let valorAtrasado = 0
    for (const c of ativos) {
      const l = limiteDoCartao(c, e.compras, e.faturasPagas, hojeIso, garantidoDo(c, c.banco_id ? ef.caixa[c.banco_id]?.caixinha : 0))
      usado += l.usado
      if (l.total !== null) { limite += l.total; algumLimite = true }
      const vencidas = [...faturasAtrasadas(c, e.compras, e.faturasPagas, ano, mes, hojeIso), faturaDoMes(c, e.compras, e.faturasPagas, ano, mes, hojeIso)]
        .filter((f) => f.status === 'atrasada')
      atrasadas += vencidas.length
      valorAtrasado += soma(vencidas.map((f) => f.valor))
    }
    const deCartao = new Set(ativos.map((c) => c.id))
    // As próximas faturas a vencer: a deste mês entra quando ainda tem fatura por vencer nele (cartão que vence dia 27,
    // hoje dia 18); a que já venceu ou foi paga, não.
    const aVencer = (l: Lancamento) => Boolean(l.cartao_id && deCartao.has(l.cartao_id) && l.valor > 0 && (!l.data || l.data > hojeIso)
      && !e.faturasPagas.some((f) => f.cartao_id === l.cartao_id && f.ano === l.ano && f.mes === l.mes))
    const meses7 = [0, 1, 2, 3, 4, 5, 6].map((i) => {
      const k = doMesChave(atual + i)
      return { ...k, valor: centavos(soma(e.compras.filter((l) => l.ano === k.ano && l.mes === k.mes && aVencer(l)).map((l) => l.valor))) }
    })
    const proximas = meses7[0].valor > 0 ? meses7.slice(0, 6) : meses7.slice(1)
    const porMes = rec.length ? centavos(media(rec.map((b) => b.cartao))) : 0
    cartao = {
      usado: centavos(usado), limite: algumLimite ? centavos(limite) : null, uso: algumLimite && limite > 0 ? usado / limite : null,
      proximas, pesoProximo: renda > 0 ? proximas[0].valor / renda : null, porMes,
      fracaoDasSaidas: gastos > 0 ? porMes / gastos : 0, atrasadas, valorAtrasado: centavos(valorAtrasado),
    }
  }

  // ----- agenda do dinheiro: dia a dia, de hoje até o fim do mês que vem -----
  // Junta o que tem data certa (contas do mês, parcelas, faturas, lançamentos marcados para depois e o que se repete todo
  // mês) e procura o que pouca gente percebe: o dinheiro que já chega com dono (a parcela marcada para o dia do salário),
  // a conta que vence antes de o dinheiro entrar, os vencimentos amontoados, a parcela que está acabando e o mês que vem
  // mais pesado que este.
  let agenda: Agenda | null = null
  let plano: Plano | null = null
  {
    const prox = doMesChave(atual + 1)
    const fimJanela = isoDoDia(prox.ano, prox.mes, 31)
    const noDia = (data: string) => (data < hojeIso ? hojeIso : data)
    const eventos: Evento[] = []
    // lançamentos já marcados para depois de hoje (o cartão entra como fatura, mais abaixo)
    for (const l of e.lancs) {
      if (!l.data || l.data <= hojeIso || l.data > fimJanela || l.cartao_id || !(l.valor > 0) || ehEmprestimo(l)) continue
      eventos.push({ data: l.data, tipo: l.tipo, descricao: l.descricao.trim(), valor: l.valor, origem: 'lancamento' })
    }
    // faturas: as parcelas de cada cartão somadas no vencimento (fatura já paga fica de fora)
    const faturas = new Map<string, Evento>()
    for (const l of e.compras) {
      if (!l.cartao_id || !l.data || l.data <= hojeIso || l.data > fimJanela || !(l.valor > 0)) continue
      if (e.faturasPagas.some((f) => f.cartao_id === l.cartao_id && f.ano === l.ano && f.mes === l.mes)) continue
      const chave = `${l.cartao_id}|${l.data}`
      const nome = e.cartoes.find((c) => c.id === l.cartao_id)?.nome
      const f = faturas.get(chave) ?? { data: l.data, tipo: 'saida' as const, descricao: nome ? tx('Fatura do {0}', nome) : tx('Fatura do cartão'), valor: 0, origem: 'cartao' as const }
      f.valor = centavos(f.valor + l.valor)
      faturas.set(chave, f)
    }
    eventos.push(...faturas.values())
    // contas do mês (este e o próximo) ainda em aberto; as atrasadas entram hoje
    const contasDoMes = (m: { ano: number; mes: number }) => (v.contas ? situacoesDasContas(e.contas, e.lancs, m.ano, m.mes, hojeIso, e.taxas) : [])
    const sitsAtual = contasDoMes({ ano, mes })
    const sitsProx = contasDoMes(prox)
    for (const sc of [...sitsAtual, ...sitsProx]) {
      if (sc.estado === 'paga' || sc.estado === 'fora' || sc.semCotacao || !(sc.valor > 0) || sc.vencimento > fimJanela) continue
      eventos.push({ data: noDia(sc.vencimento), vence: sc.vencimento, tipo: sc.conta.tipo, descricao: sc.conta.descricao, valor: sc.valor, origem: 'conta', atrasada: sc.vencimento < hojeIso })
    }
    // parcelas das dívidas, pelo calendário de cada uma
    const calendarios = abertas.map((sd) => ({ sd, cal: calendarioDe(sd, hojeIso) }))
    for (const { sd, cal } of calendarios) for (const pc of cal?.parcelas ?? []) {
      if (pc.falta <= 0 || pc.vencimento > fimJanela) continue
      eventos.push({
        data: noDia(pc.vencimento), vence: pc.vencimento, tipo: 'saida', descricao: sd.divida.descricao,
        valor: centavos(pc.falta + (sd.atraso?.porParcela.get(pc.n) ?? 0)), origem: 'parcela',
        // atrasada: o custo de esperar é o juro do atraso, quando a dívida tem essa regra
        atrasada: pc.vencimento < hojeIso, jurosMes: pc.vencimento < hojeIso ? jurosQuePesam(sd) : sd.divida.juros_mes ?? null,
      })
    }
    // o que se repete todo mês e ainda não veio (este mês, se o dia não passou faz tempo) ou virá (o mês que vem)
    // (o salário em duas partes vira dois eventos, cada um no seu dia; se o adiantamento já caiu, só o salário)
    const doMesDe = (m: { ano: number; mes: number }) => e.lancs.filter((l) => l.ano === m.ano && l.mes === m.mes)
    for (const [lista, tipo] of [[recSaidas, 'saida'], [recEntradas, 'entrada']] as const) {
      for (const r of lista) {
        if (r.contaFixa || r.noCartao) continue
        for (const p of faltaDa(r, tipo, doMesDe({ ano, mes }))) {
          if (p.dia && p.dia >= diaHoje - 5) eventos.push({ data: noDia(isoDoDia(ano, mes, p.dia)), tipo, descricao: r.descricao, valor: p.valor, origem: 'recorrente' })
        }
        for (const p of faltaDa(r, tipo, doMesDe(prox))) {
          if (p.dia) eventos.push({ data: isoDoDia(prox.ano, prox.mes, p.dia), tipo, descricao: r.descricao, valor: p.valor, origem: 'recorrente' })
        }
      }
    }
    // a mesma parcela cadastrada como conta do mês e como dívida conta uma vez só
    const vencimentoDe = (ev: Evento) => ({ descricao: ev.descricao, valor: ev.valor, vencimento: ev.vence ?? ev.data })
    const unicos = eventos.filter((ev) => ev.origem !== 'conta' || ev.tipo !== 'saida'
      || !eventos.some((o) => o.origem === 'parcela' && mesmoCompromisso(vencimentoDe(ev), vencimentoDe(o))))
    unicos.sort((a, b) => a.data.localeCompare(b.data) || (a.tipo === b.tipo ? b.valor - a.valor : a.tipo === 'entrada' ? -1 : 1))

    // saldo dia a dia: com o saldo da conta corrente, conta também o gasto do dia a dia entre um dia e outro
    const ccInformado = v.bancos && Object.values(ef.caixa).some((b) => typeof b?.cc === 'number')
    const saldoInicial = ccInformado ? centavos(soma(Object.values(ef.caixa).map((b) => b?.cc ?? 0))) : null
    const ritmoDia = saldoInicial !== null && rec.length
      ? centavos(media(recentes.map((k) => soma(naJanela.filter((l) => chaveMes(l.ano, l.mes) === k && ehDiaADia(l)).map((l) => l.valor)))) / 30.4)
      : 0
    const porData = new Map<string, Evento[]>()
    for (const ev of unicos) porData.set(ev.data, [...(porData.get(ev.data) ?? []), ev])
    let saldoCorrente = saldoInicial ?? 0
    let cursor = hojeIso
    const dias: DiaDaAgenda[] = [...porData].map(([data, evs]) => {
      saldoCorrente -= ritmoDia * diasEntre(cursor, data)
      cursor = data
      const entradas = evs.filter((x) => x.tipo === 'entrada')
      const saidas = evs.filter((x) => x.tipo === 'saida')
      saldoCorrente += soma(entradas.map((x) => x.valor)) - soma(saidas.map((x) => x.valor))
      return { data, entradas, saidas, saldo: centavos(saldoCorrente) }
    })
    const totalDe = (xs: Evento[]) => centavos(soma(xs.map((x) => x.valor)))
    const nomesDe = (xs: Evento[]) => listaDeNomes([...xs].sort((a, b) => b.valor - a.valor).map((x) => x.descricao))
    const data = (iso: string) => fmtDataCurta(iso)
    const percepcoes: (Percepcao & { peso: number })[] = []
    const minimoRelevante = Math.max(1, (renda || gastos) * 0.02)

    // 1. Aperto: conta que vence antes de o dinheiro entrar
    const primeiroNegativo = dias.find((d) => d.saldo < -0.5 && d.saidas.length)
    if (primeiroNegativo) {
      const depois = dias.find((d) => d.data > primeiroNegativo.data && d.entradas.length)
      const falta = centavos(-Math.min(...dias.filter((d) => d.data >= primeiroNegativo.data && (!depois || d.data < depois.data)).map((d) => d.saldo)))
      const quais = nomesDe(primeiroNegativo.saidas)
      if (falta >= minimoRelevante) {
        const dia = data(primeiroNegativo.data)
        const varias = primeiroNegativo.saidas.length > 1
        const ate = depois ? data(depois.data) : ''
        const v1 = fmtValor(falta)
        const texto = saldoInicial !== null
          ? depois
            ? varias
              ? tx('Em {0} vencem {1}, mas o próximo dinheiro só entra em {2}. Pelo saldo de hoje e pelo seu gasto do dia a dia, faltam cerca de {3} até lá.', dia, quais, ate, v1)
              : tx('Em {0} vence {1}, mas o próximo dinheiro só entra em {2}. Pelo saldo de hoje e pelo seu gasto do dia a dia, faltam cerca de {3} até lá.', dia, quais, ate, v1)
            : varias
              ? tx('Em {0} vencem {1}, e não há dinheiro previsto para entrar até lá. Pelo saldo de hoje e pelo seu gasto do dia a dia, faltam cerca de {2}.', dia, quais, v1)
              : tx('Em {0} vence {1}, e não há dinheiro previsto para entrar até lá. Pelo saldo de hoje e pelo seu gasto do dia a dia, faltam cerca de {2}.', dia, quais, v1)
          : depois
            ? varias
              ? tx('Em {0} vencem {1}, mas o próximo dinheiro só entra em {2}. Para não atrasar, é preciso ter {3} na conta até lá.', dia, quais, ate, v1)
              : tx('Em {0} vence {1}, mas o próximo dinheiro só entra em {2}. Para não atrasar, é preciso ter {3} na conta até lá.', dia, quais, ate, v1)
            : varias
              ? tx('Em {0} vencem {1}, e não há dinheiro previsto para entrar até lá. Para não atrasar, é preciso ter {2} na conta.', dia, quais, v1)
              : tx('Em {0} vence {1}, e não há dinheiro previsto para entrar até lá. Para não atrasar, é preciso ter {2} na conta.', dia, quais, v1)
        percepcoes.push({
          id: 'aperto', peso: 100, icone: 'relogio', tom: 'ruim', porque: texto, data: primeiroNegativo.data,
          titulo: saldoInicial !== null ? tx('Em {0}, a conta pode ficar no vermelho.', data(primeiroNegativo.data)) : tx('Tem conta vencendo antes de o dinheiro entrar.'),
        })
      }
    }

    // 2. Dinheiro que já chega com dono: as saídas do mesmo dia e dos dias seguintes, até a próxima entrada grande
    const limiar = Math.max(1, renda * 0.1)
    const grandes = dias.filter((d) => totalDe(d.entradas) >= limiar)
    const casamentos = grandes.map((d, i) => {
      const proxima = grandes[i + 1]?.data
      const ate = [maisDias(d.data, 7), proxima ? maisDias(proxima, -1) : fimJanela].sort()[0]
      const depoisDele = dias.filter((x) => x.data > d.data && x.data <= ate).flatMap((x) => x.saidas)
      const entra = totalDe(d.entradas)
      const mesmoDia = totalDe(d.saidas)
      const total = centavos(mesmoDia + totalDe(depoisDele))
      return { d, ate, entra, mesmoDia, total, depoisDele, fracao: entra > 0 ? total / entra : 0 }
    })
    const comDono = casamentos.find((c) => c.d.saidas.length >= 2 || (c.mesmoDia >= c.entra * 0.25 && c.mesmoDia >= minimoRelevante))
    if (comDono) {
      const c = comDono
      percepcoes.push({
        id: `com-dono:${c.d.data}`, peso: 90, icone: 'acordo', tom: 'medio', data: c.d.data,
        titulo: tx('O dinheiro de {0} já chega com dono.', data(c.d.data)),
        porque: `${c.d.saidas.length === 1
          ? tx('{0} ({1}) cai no mesmo dia em que vence {2} ({3}). Desse dinheiro, sobram {4} para o resto.',
            nomesDe(c.d.entradas), fmtValor(c.entra), nomesDe(c.d.saidas), fmtValor(c.mesmoDia), fmtValor(centavos(c.entra - c.mesmoDia)))
          : tx('{0} ({1}) cai no mesmo dia em que vencem {2}: {3} no total. Desse dinheiro, sobram {4} para o resto.',
            nomesDe(c.d.entradas), fmtValor(c.entra), nomesDe(c.d.saidas), fmtValor(c.mesmoDia), fmtValor(centavos(c.entra - c.mesmoDia)))} ${
          tx('Se foi de propósito, boa ideia: o dinheiro entra e já sai para onde deve. Mas, se ele atrasar um dia, tudo atrasa junto, com multa. Ter esse valor na conta um dia antes, ou passar os vencimentos para 2 ou 3 dias depois, tira esse risco.')}`,
      })
    }
    const comprometido = casamentos.find((c) => c.fracao >= 0.7 && c.total >= minimoRelevante && c !== comDono)
    if (comprometido) {
      const c = comprometido
      percepcoes.push({
        id: `comprometido:${c.d.data}`, data: c.d.data, peso: 80, icone: 'carteira', tom: c.fracao >= 1 ? 'ruim' : 'medio',
        titulo: c.fracao >= 1 ? tx('O dinheiro de {0} não cobre o que vence logo depois.', data(c.d.data)) : tx('{0}% do dinheiro de {1} já tem destino.', pct(c.fracao), data(c.d.data)),
        porque: tx('Entram {0} e, até {1}, saem {2} em contas, parcelas e faturas. Sobram {3} para o dia a dia até o próximo dinheiro.',
          fmtValor(c.entra), data(c.ate), fmtValor(c.total), fmtValor(Math.max(0, centavos(c.entra - c.total)))),
      })
    }

    // 3. O mês que vem mais pesado (ou mais leve) que este: faturas, parcelas e contas já marcadas
    const marcadoNoMes = (m: { ano: number; mes: number }, sits: typeof sitsAtual) => centavos(
      soma(e.compras.filter((l) => l.cartao_id && l.ano === m.ano && l.mes === m.mes && l.valor > 0).map((l) => l.valor))
      + soma(calendarios.flatMap(({ cal }) => (cal?.parcelas ?? []).filter((pc) => pc.vencimento.slice(0, 7) === `${m.ano}-${dois(m.mes)}`).map((pc) => pc.valor)))
      + soma(sits.filter((sc) => sc.conta.tipo === 'saida' && sc.estado !== 'fora').map((sc) => sc.valor)))
    const esteMes = marcadoNoMes({ ano, mes }, sitsAtual)
    const proxMes = marcadoNoMes(prox, sitsProx)
    const nomeProx = noMeioDaFrase(MESES_NOME[prox.mes - 1])
    const nomeAtual = noMeioDaFrase(MESES_NOME[mes - 1])
    if (esteMes > 0 && proxMes - esteMes >= Math.max(minimoRelevante * 2.5, esteMes * 0.15)) {
      percepcoes.push({
        id: 'mes-que-vem-pesado', peso: 70, icone: 'sobe', tom: 'medio',
        titulo: tx('{0} já começa {1} mais pesado que {2}.', MESES_NOME[prox.mes - 1], fmtValor(centavos(proxMes - esteMes)), nomeAtual),
        porque: tx('Entre faturas, parcelas e contas, já estão marcados {0} para {1}, contra {2} neste mês. Segure compras novas agora para não chegar apertado.', fmtValor(proxMes), nomeProx, fmtValor(esteMes)),
      })
    } else if (esteMes > 0 && esteMes - proxMes >= Math.max(minimoRelevante * 2.5, esteMes * 0.15)) {
      percepcoes.push({
        id: 'mes-que-vem-leve', peso: 40, icone: 'desce', tom: 'bom',
        titulo: tx('{0} vem {1} mais leve.', MESES_NOME[prox.mes - 1], fmtValor(centavos(esteMes - proxMes))),
        porque: tx('Já estão marcados {0} para {1}, contra {2} neste mês. Decida antes para onde vai essa diferença, senão ela some no dia a dia.', fmtValor(proxMes), nomeProx, fmtValor(esteMes)),
      })
    }

    // 4. Vencimentos amontoados: a semana que leva a maior parte das contas dos próximos 30 dias
    const em30 = dias.filter((d) => d.data <= maisDias(hojeIso, 30))
    const saidas30 = totalDe(em30.flatMap((d) => d.saidas))
    let melhor: { de: string; ate: string; total: number; qtd: number; entra: number } | null = null
    for (const d of em30) {
      const fim = maisDias(d.data, 6)
      const semana = em30.filter((x) => x.data >= d.data && x.data <= fim)
      const total = totalDe(semana.flatMap((x) => x.saidas))
      if (!melhor || total > melhor.total) melhor = { de: d.data, ate: [...semana].reverse().find((x) => x.saidas.length)?.data ?? d.data, total, qtd: semana.flatMap((x) => x.saidas).length, entra: totalDe(semana.flatMap((x) => x.entradas)) }
    }
    if (melhor && saidas30 > 0 && melhor.total / saidas30 >= 0.6 && melhor.qtd >= 3 && melhor.de !== melhor.ate) {
      percepcoes.push({
        id: 'amontoadas', data: melhor.de, peso: 55, icone: 'calendario', tom: melhor.entra >= melhor.total ? 'bom' : 'medio',
        titulo: tx('{0}% das contas dos próximos 30 dias vencem entre {1} e {2}.', pct(melhor.total / saidas30), data(melhor.de), data(melhor.ate)),
        porque: melhor.entra >= melhor.total
          ? tx('O dinheiro que entra nesses dias cobre tudo: bom sinal, desde que ele caia antes dos vencimentos.')
          : tx('Nesses dias saem {0} e entram {1}. Separe o dinheiro antes, ou peça para mudar alguns vencimentos de data.', fmtValor(melhor.total), fmtValor(melhor.entra)),
      })
    }

    // 5. A parcela que está acabando: dinheiro que volta a ser seu
    const acabando: { descricao: string; valor: number; fim: number }[] = []
    for (const { sd, cal } of calendarios) {
      const ultima = cal?.parcelas.filter((pc) => pc.falta > 0).pop()
      if (ultima && sd.divida.valor_parcela) acabando.push({ descricao: sd.divida.descricao, valor: sd.divida.valor_parcela, fim: chaveMes(Number(ultima.vencimento.slice(0, 4)), Number(ultima.vencimento.slice(5, 7))) })
    }
    const ultimaDaCompra = new Map<string, Lancamento>()
    for (const l of e.compras) if (l.compra_id && (l.parcelas ?? 1) > 1) {
      const u = ultimaDaCompra.get(l.compra_id)
      if (!u || chaveMes(l.ano, l.mes) > chaveMes(u.ano, u.mes)) ultimaDaCompra.set(l.compra_id, l)
    }
    for (const l of ultimaDaCompra.values()) acabando.push({ descricao: l.descricao, valor: l.valor, fim: chaveMes(l.ano, l.mes) })
    const logo = acabando.filter((x) => x.fim >= atual && x.fim <= atual + 3 && x.valor >= minimoRelevante).sort((a, b) => a.fim - b.fim || b.valor - a.valor)
    if (logo.length) {
      const fim = logo[0].fim
      const doMesmo = logo.filter((x) => x.fim === fim)
      const valor = centavos(soma(doMesmo.map((x) => x.valor)))
      percepcoes.push({
        id: `acabando:${fim}`, peso: 50, icone: 'check', tom: 'bom',
        titulo: tx('Em {0} vence a última parcela de {1}.', mesAno(doMesChave(fim)), listaDeNomes(doMesmo.map((x) => x.descricao))),
        porque: tx('Depois disso, {0} por mês voltam a ser seus. Decida desde já para onde vão (reserva, dívida da vez ou meta): dinheiro sem destino some no dia a dia.', fmtValor(valor)),
      })
    }

    const diasNoMesAtual = new Date(ano, mes, 0).getDate()
    const cal = Array.from({ length: diasNoMesAtual }, (_, i) => ({ dia: i + 1, entra: 0, sai: 0 }))
    for (const l of naJanela) {
      if (l.ano !== ano || l.mes !== mes || !l.data || l.data > hojeIso) continue
      const c = cal[diaDe(l.data) - 1]
      if (!c) continue
      if (l.tipo === 'entrada') c.entra += l.valor
      else c.sai += l.valor
    }
    for (const ev of unicos) {
      if (ev.data.slice(0, 7) !== hojeIso.slice(0, 7)) continue
      const c = cal[diaDe(ev.data) - 1]
      if (ev.tipo === 'entrada') c.entra += ev.valor
      else c.sai += ev.valor
    }
    const calendario = { ano, mes, hoje: diaHoje, dias: cal.map((c) => ({ dia: c.dia, entra: centavos(c.entra), sai: centavos(c.sai) })) }
    const entradaFutura = dias.find((d) => d.entradas.length)
    const menor = dias.length ? dias.reduce((m, d) => (d.saldo < m.saldo ? d : m)) : null
    // o planejador: de qual dinheiro sai cada conta e em que dia pagar
    plano = planejar({
      hoje: hojeIso, fim: fimJanela, saldoInicial, ritmoDia, porDiaDoMes: previsao?.porDia ?? null,
      gastouHoje: gastoDeHojeNoDiaADia,
      entradas: dias.filter((d) => d.entradas.length).map((d) => ({ data: d.data, valor: totalDe(d.entradas), descricao: nomesDe(d.entradas) })),
      compromissos: unicos.filter((ev) => ev.tipo === 'saida').map((ev) => ({
        descricao: ev.descricao, valor: ev.valor, vence: ev.vence ?? ev.data, origem: ev.origem, jurosMes: ev.jurosMes ?? null,
      })),
      abertas: abertas.filter((sd) => !(sd.divida.valor_parcela && sd.divida.valor_parcela > 0) && (sd.divida.juros_mes ?? 0) > 0)
        .map((sd) => ({ nome: sd.divida.descricao, saldo: sd.restanteHoje, juros: sd.divida.juros_mes! })),
    })
    if (unicos.length || saldoInicial !== null || calendario.dias.some((c) => c.entra || c.sai)) {
      agenda = {
        dias, saldoInicial, ritmoDia, calendario,
        proximaEntrada: entradaFutura ? { data: entradaFutura.data, valor: totalDe(entradaFutura.entradas), descricao: nomesDe(entradaFutura.entradas) } : null,
        menorSaldo: menor ? { data: menor.data, valor: menor.saldo } : null,
        percepcoes: percepcoes.sort((a, b) => b.peso - a.peso).map(({ peso: _p, ...x }) => x),
      }
    }
  }

  // ----- pilares -----
  const pilares: Pilar[] = []
  if (temFluxo) {
    const nota = sobraFracao < 0 ? Math.max(0, 20 + sobraFracao * 100)
      : sobraFracao < SOBRA_IDEAL ? 20 + (sobraFracao / SOBRA_IDEAL) * 65
        : 85 + Math.min(15, ((sobraFracao - SOBRA_IDEAL) / 0.1) * 15)
    pilares.push({
      id: 'sobra', nome: tx('Sobra do mês'), nota, tom: tomDa(nota), valor: fmtPct(sobraFracao), destino: 'lancamentos',
      referencia: tx('Ideal: guardar 20% ou mais do que entra'),
      frase: sobra < 0 ? tx('Sai {0} a mais do que entra, por mês.', fmtValor(-sobra))
        : sobraFracao < 0.1 ? tx('Sobram {0} por mês: pouco espaço para imprevistos.', fmtValor(sobra))
          : sobraFracao < SOBRA_IDEAL ? tx('Sobram {0} por mês. Falta pouco para os 20%.', fmtValor(sobra))
            : tx('Sobram {0} por mês. Muito bem.', fmtValor(sobra)),
    })
  }
  if (reserva) {
    const nota = 100 * Math.pow(Math.min(1, reserva.meses / reserva.alvoMeses), 0.6)
    pilares.push({
      id: 'reserva', nome: tx('Reserva para imprevistos'), nota, tom: tomDa(nota), valor: fmtMeses(reserva.meses), destino: 'patrimonio',
      referencia: rendaVaria ? tx('Ideal para renda que varia: {0} meses de gastos', alvoMeses) : tx('Ideal: {0} meses de gastos', alvoMeses),
      frase: reserva.tem <= 0 ? tx('Você ainda não tem dinheiro guardado para imprevistos.')
        : reserva.meses < COLCHAO_MESES ? tx('Um imprevisto maior que {0} já vira dívida.', fmtValor(reserva.tem))
          : reserva.falta > 0 ? tx('Faltam {0} para completar a reserva.', fmtValor(reserva.falta))
            : tx('Sua reserva está completa.'),
    })
  }
  if (v.dividas) {
    const peso = renda > 0 ? parcelasMes / renda : null
    let nota = !abertas.length ? 100
      : peso === null ? 70
        : peso <= 0.1 ? 100 : peso <= 0.3 ? 100 - ((peso - 0.1) / 0.2) * 35 : peso <= 0.5 ? 65 - ((peso - 0.3) / 0.2) * 40 : Math.max(0, 25 - (peso - 0.5) * 100)
    if (jurosMax >= JUROS_ALTOS_MES) nota = Math.min(nota, 35)
    else if (jurosMax >= JUROS_CARO_MES) nota = Math.min(nota, 60)
    if (dividaCresceu) nota -= 15
    if (atrasoDividas > 0) nota -= 20
    nota = limitar(nota, 0, 100)
    const fimDividas = dividas?.estrategias[0].fim
    pilares.push({
      id: 'dividas', nome: tx('Dívidas'), nota, tom: tomDa(nota), destino: 'dividas',
      valor: !abertas.length ? tx('Nenhuma') : peso !== null && parcelasMes > 0 ? fmtPct(peso) : fmtValor(dividaTotal),
      referencia: tx('Parcelas: ideal abaixo de {0}% do que entra', pct(PARCELAS_ATENCAO)),
      frase: !abertas.length ? tx('Você não tem dívidas.')
        : atrasoDividas > 0 ? tx('Há {0} em parcelas atrasadas.', fmtValor(atrasoDividas))
          : jurosMax >= JUROS_CARO_MES && maisCara ? tx('{0} cobra {1}% ao mês: é a primeira a quitar.', maisCara.divida.descricao, fmtTaxa(jurosMax))
            : peso !== null && peso > PARCELAS_ATENCAO ? tx('As parcelas levam {0}% do que você recebe.', pct(peso))
              : dividaCresceu ? tx('O total das dívidas cresceu nos últimos 3 meses.')
                : fimDividas ? tx('As parcelas cabem no orçamento. Sem dívidas em {0}.', mesAno(fimDividas))
                  : tx('As parcelas cabem no orçamento.'),
    })
  }
  if (cartao) {
    const u = cartao.uso
    let nota = u === null ? 85 : u <= LIMITE_SAUDAVEL ? 100 : u <= 0.6 ? 100 - ((u - LIMITE_SAUDAVEL) / 0.3) * 35 : u <= 0.9 ? 65 - ((u - 0.6) / 0.3) * 35 : 15
    if (cartao.pesoProximo !== null && cartao.pesoProximo > 0.5) nota -= 35
    else if (cartao.pesoProximo !== null && cartao.pesoProximo > CARTAO_ATENCAO) nota -= 20
    if (jurosDeFatura > 0) nota -= 15
    if (cartao.atrasadas > 0) nota = Math.min(nota - 25, 40)
    nota = limitar(nota, 0, 100)
    pilares.push({
      id: 'cartao', nome: tx('Cartão de crédito'), nota, tom: tomDa(nota), destino: 'cartoes',
      valor: u !== null ? fmtPct(u) : fmtValor(cartao.proximas[0].valor),
      referencia: u !== null ? tx('Ideal: usar até {0}% do limite', pct(LIMITE_SAUDAVEL)) : tx('Parcelas já marcadas na próxima fatura'),
      frase: cartao.atrasadas > 0 ? tx('Há fatura vencida sem pagar: {0}.', fmtValor(cartao.valorAtrasado))
        : jurosDeFatura > 0 ? tx('Você pagou {0} de juros no cartão em 12 meses.', fmtValor(centavos(jurosDeFatura)))
          : cartao.pesoProximo !== null && cartao.pesoProximo > CARTAO_ATENCAO ? tx('A próxima fatura já tem {0} em parcelas, {1}% do que você recebe.', fmtValor(cartao.proximas[0].valor), pct(cartao.pesoProximo))
            : u !== null && u > 0.6 ? tx('Você já usa {0}% do limite.', pct(u))
              : tx('O cartão está sob controle.'),
    })
  }
  if (temFluxo) {
    let nota = 100
    const t = tendenciaGastos ?? 0
    nota -= Math.min(35, Math.max(0, t * 100 - 1) * 8)
    nota -= Math.min(25, Math.max(0, (variacaoGastos ?? 0) - 0.15) * 100)
    nota -= Math.min(20, Math.max(0, semCategoria - 0.1) * 100)
    const ritmoAlto = previsao !== null && previsao.ateHojeNormal !== null && previsao.saiuAteAgora > previsao.ateHojeNormal * 1.25 && diaHoje >= 7
    if (ritmoAlto) nota -= 10
    nota = limitar(nota, 0, 100)
    pilares.push({
      id: 'controle', nome: tx('Controle dos gastos'), nota, tom: tomDa(nota), destino: 'lancamentos',
      valor: tendenciaGastos === null ? tx('Estável') : tendenciaGastos > 0.01 ? tx('Subindo') : tendenciaGastos < -0.01 ? tx('Caindo') : tx('Estável'),
      referencia: tx('Gastos estáveis, todos com categoria'),
      frase: t > 0.02 ? tx('Seus gastos sobem cerca de {0}% ao mês nos últimos {1} meses.', decimal.format(t * 100), chavesComDados.length)
        : (variacaoGastos ?? 0) > 0.3 ? tx('Seus gastos mudam muito de um mês para o outro.')
          : semCategoria > 0.1 ? tx('{0}% dos gastos estão sem categoria.', pct(semCategoria))
            : ritmoAlto ? tx('Neste mês, você está gastando mais rápido que o normal.')
              : t < -0.01 ? tx('Seus gastos estão caindo. Muito bem.')
                : tx('Seus gastos estão estáveis e organizados.'),
    })
  }
  if (metas) {
    const comPrazo = metas.metas.filter((m) => m.porMes !== null)
    const razoes = metas.metas.map((m) => (m.porMes ? Math.min(1, m.ritmo / m.porMes) : m.ritmo > 0 ? 1 : 0.4))
    const nota = 100 * media(razoes)
    const atrasada = comPrazo.filter((m) => !m.noRitmo).sort((a, b) => (b.porMes! - b.ritmo) - (a.porMes! - a.ritmo))[0]
    const noRitmo = metas.metas.filter((m) => m.noRitmo).length
    pilares.push({
      id: 'metas', nome: tx('Metas'), nota, tom: tomDa(nota), destino: 'metas',
      valor: tx('{0} de {1}', noRitmo, metas.metas.length),
      referencia: tx('Metas no ritmo para chegar no prazo'),
      frase: atrasada ? tx('“{0}” pede {1} por mês e recebe {2}.', atrasada.nome, fmtMoeda(atrasada.porMes!, atrasada.moeda), fmtMoeda(atrasada.ritmo, atrasada.moeda))
        : noRitmo === metas.metas.length ? tx('Todas as metas estão no ritmo.')
          : tx('Guarde um pouco todo mês nas metas paradas.'),
    })
  }

  const somaPesos = soma(pilares.map((p) => PESOS[p.id]))
  const nota = temFluxo && somaPesos > 0 ? Math.round(soma(pilares.map((p) => p.nota * PESOS[p.id])) / somaPesos) : null
  for (const p of pilares) {
    p.nota = Math.round(p.nota)
    p.tom = tomDa(p.nota)
  }

  // ----- plano de ação -----
  const acoes: Acao[] = []
  const nova = (a: Acao) => acoes.push(a)
  const cortavel = (c: CategoriaAnalise) => centavos(Math.max(0, c.media - c.parcelado))
  const estilo = categorias.filter((c) => (c.grupo === 'estilo' || c.grupo === 'outros') && cortavel(c) > 0)

  // atrasos: parcelas, contas do mês e faturas vencidas
  const contasAtrasadas = v.contas ? situacoesDasContas(e.contas, e.lancs, ano, mes, hojeIso, e.taxas).filter((s) => s.conta.tipo === 'saida' && s.estado === 'atrasada') : []
  const atrasoContas = soma(contasAtrasadas.map((s) => s.valor))
  const atrasoCartao = cartao?.valorAtrasado ?? 0
  const totalAtraso = centavos(atrasoDividas + atrasoContas + atrasoCartao)

  // ----- o jeito da pessoa e o que o consultor aprendeu com ela -----
  const memoria = e.memoria
  const objetivo = memoria?.objetivo ?? null
  /** Da última vez este passo não deu certo: agora ele pede a metade, que costuma pegar melhor. */
  const menor = (id: string) => licaoDe(memoria, id).falhas === 1
  const lancamentosPorMes = rec.length ? Math.round(media(recentes.map((k) => naJanela.filter((l) => chaveMes(l.ano, l.mes) === k).length))) : 0
  const parceladoNoCartao = soma(categorias.map((c) => c.parcelado))
  const pesoDasParcelas = renda > 0 ? (parcelasMes + parceladoNoCartao) / renda : 0
  const reservaCompleta = reserva !== null && reserva.falta <= 0
  const jeito: JeitoFinanceiro = {
    poupador: temFluxo && renda > 0 && sobraFracao >= 0.3 && (regra?.estilo ?? 1) < 0.12 && totalAtraso === 0 && !temCara
      && (reservaCompleta || (!conheceReserva && sobraFracao >= 0.35)),
    credito: temFluxo && renda > 0 && pesoDasParcelas >= 0.05 && pesoDasParcelas <= PARCELAS_ATENCAO && !temCara && totalAtraso === 0 && sobra >= 0,
    apertado,
    estavel: temFluxo && sobraFracao >= 0.05 && totalAtraso === 0 && !temCara && !rendaVaria && (tendenciaGastos ?? 0) <= 0.02,
    minucioso: temFluxo && lancamentosPorMes >= 30 && semCategoria < 0.05,
  }
  // Quem guarda muito pode gastar o que passa de 25% do que entra (e do que as metas pedem) sem mexer no futuro.
  const podeGastar = jeito.poupador ? Math.max(0, Math.floor((sobra - Math.max(renda * 0.25, necessarioMetas)) / 10) * 10) : 0
  if (totalAtraso > 0) {
    const maior = Math.max(atrasoDividas, atrasoContas, atrasoCartao)
    nova({
      id: 'atrasos', urgencia: 'urgente', prioridade: 100, icone: 'relogio',
      destino: maior === atrasoCartao ? 'cartoes' : maior === atrasoContas ? 'contas' : 'dividas',
      botao: maior === atrasoCartao ? tx('Ver cartões') : maior === atrasoContas ? tx('Ver contas') : tx('Ver dívidas'),
      titulo: tx('Coloque em dia o que está atrasado: {0}.', fmtValor(totalAtraso)),
      porque: tx('Conta atrasada cobra multa e juros todo dia, e é o dinheiro mais caro que existe. Antes de qualquer outro passo, pague o que venceu.'),
    })
  }
  // O planejador diz o que fazer com cada conta que não cabe no dia: isso vale mais que o aviso genérico de aperto.
  const doPlano = plano?.dicas ?? []
  for (const d of doPlano) {
    const divida = d.id.startsWith('adiantar-aberta:')
    nova({
      id: `plano:${d.id}`, urgencia: d.tom === 'ruim' ? 'urgente' : d.tom === 'medio' ? 'importante' : 'sugestao',
      prioridade: d.tom === 'ruim' ? 98 : d.tom === 'medio' ? 96 : 70, icone: d.icone,
      destino: divida ? 'dividas' : v.contas ? 'contas' : 'lancamentos',
      botao: divida ? tx('Ver dívidas') : v.contas ? tx('Ver contas') : tx('Ver lançamentos'), titulo: d.titulo, porque: d.porque,
    })
  }
  const aperto = doPlano.some((d) => d.tom !== 'bom') ? undefined : agenda?.percepcoes.find((x) => x.id === 'aperto')
  if (aperto) {
    nova({
      id: 'aperto', urgencia: 'urgente', prioridade: 97, icone: 'relogio', destino: v.contas ? 'contas' : 'lancamentos',
      botao: v.contas ? tx('Ver contas') : tx('Ver lançamentos'), titulo: aperto.titulo, porque: aperto.porque,
    })
  }
  if (fase === 'vermelho') {
    const top = [...estilo].sort((a, b) => cortavel(b) - cortavel(a)).slice(0, 2)
    nova({
      id: 'vermelho', urgencia: 'urgente', prioridade: 95, icone: 'desce', destino: 'lancamentos', botao: tx('Ver gastos'),
      titulo: tx('Feche o buraco de {0} por mês.', fmtValor(-sobra)),
      porque: top.length === 2
        ? tx('Nos últimos meses saiu mais do que entrou. Onde mais dá para cortar: {0} ({1} por mês) e {2} ({3} por mês).', top[0].nome, fmtValor(cortavel(top[0])), top[1].nome, fmtValor(cortavel(top[1])))
        : tx('Nos últimos meses saiu mais do que entrou. Corte primeiro o que não é essencial (lazer, compras, assinaturas) até o mês fechar no azul.'),
      impacto: tx('Meta: guardar {0} por mês', fmtValor(redondo(renda * 0.05))), pedido: centavos(-sobra),
    })
  }
  // Reserva gorda e dívida cara ao mesmo tempo: o dinheiro guardado rende menos do que a dívida cobra. Quitar com parte dele,
  // deixando pelo menos 3 meses de gastos guardados, é o conselho de quem entende de juros.
  const cara = dividas?.ordem.filter((d) => (d.juros ?? 0) >= JUROS_CARO_MES).sort((a, b) => b.juros! - a.juros!)[0]
  const usaReserva = Boolean(cara && reserva && reserva.fonte === 'bancos' && gastos > 0 && reserva.tem - cara.quitarHoje >= 3 * gastos)
  if (maisCara && jurosMax >= JUROS_ALTOS_MES && !(usaReserva && cara?.id === maisCara.divida.id)) {
    const j = maisCara.divida.juros_mes!
    nova({
      id: `juros-altos:${maisCara.divida.id}`, urgencia: 'urgente', prioridade: 92, icone: 'divida', destino: 'dividas', botao: tx('Ver dívidas'),
      titulo: tx('Troque ou renegocie {0}.', maisCara.divida.descricao),
      porque: tx('Essa dívida cobra {0}% ao mês, cerca de {1}% ao ano: em 12 meses, cada {2} devidos viram {3}. Peça uma taxa menor ou troque por um empréstimo mais barato para quitá-la.',
        fmtTaxa(j), fmtTaxaAno(jurosAoAno(j)), fmtValor(1000), fmtValor(centavos(1000 * Math.pow(1 + j / 100, 12)))),
    })
  }
  if (fase === 'colchao' && reserva) {
    const porMes = menor('colchao') ? centavos(reserva.porMes / 2) : reserva.porMes
    const falta = Math.max(0, reserva.colchao - reserva.tem)
    const chega = porMes > 0 ? doMesChave(atual + Math.ceil(falta / porMes - 1e-9)) : null
    nova({
      id: 'colchao', urgencia: 'importante', prioridade: 85, icone: 'escudo', destino: v.metas ? 'metas' : 'patrimonio', botao: v.metas ? tx('Ver metas') : tx('Ver o guardado'),
      titulo: tx('Junte um colchão de {0}.', fmtValor(redondo(reserva.colchao))),
      porque: chega
        ? tx('É 1 mês dos seus gastos. Hoje você tem {0}. Guardando {1} por mês, chega em {2}. Com ele, um imprevisto não vira dívida.', fmtValor(reserva.tem), fmtValor(porMes), mesAno(chega))
        : tx('É 1 mês dos seus gastos. Hoje você tem {0}. Com ele, um imprevisto não vira dívida.', fmtValor(reserva.tem)),
      impacto: porMes > 0 ? tx('{0} por mês', fmtValor(porMes)) : undefined, pedido: porMes,
    })
  }
  if (cara && reserva && usaReserva) {
    const fica = fmtMeses((reserva.tem - cara.quitarHoje) / gastos)
    const economia = centavos(cara.restante - cara.quitarHoje)
    const jurosDoMes = centavos(cara.quitarHoje * (cara.juros! / 100))
    nova({
      id: `quitar-com-reserva:${cara.id}`, urgencia: 'importante', prioridade: 84, icone: 'cofre', destino: 'dividas', botao: tx('Ver dívidas'),
      titulo: tx('Use {0} do guardado para quitar {1}.', fmtValor(cara.quitarHoje), cara.nome),
      porque: cara.parcela
        ? tx('Essa dívida cobra {0}% ao mês, mais do que qualquer aplicação segura rende. Quitando hoje (pedindo o desconto dos juros das parcelas que faltam), você deixa de pagar {1} e libera {2} por mês. Ainda ficam {3} de reserva; reponha com a parcela liberada.',
          fmtTaxa(cara.juros!), fmtValor(economia), fmtValor(cara.parcela), fica)
        : tx('Essa dívida cobra {0}% ao mês, mais do que qualquer aplicação segura rende: só de juros, são cerca de {1} por mês. Quitando hoje, esse custo some, e ainda ficam {2} de reserva.',
          fmtTaxa(cara.juros!), fmtValor(jurosDoMes), fica),
      impacto: cara.parcela ? tx('{0} a menos de juros', fmtValor(economia)) : tx('{0} por mês a menos de juros', fmtValor(jurosDoMes)),
    })
  }
  if (dividas && !usaReserva && (fase === 'dividas' || (fase === 'colchao' && dividas.temCara) || (alocacao?.dividas ?? 0) > 0)) {
    const alvo = dividas.ordem[0]
    const recom = dividas.estrategias.find((x) => x.id === dividas.recomendada)!
    const base = dividas.estrategias[0]
    const ganho = recom.economia !== null && recom.economia > 0 && base.fim && recom.fim
      ? dividas.extraExemplo
        ? tx('Com {0} a mais por mês, você fica sem dívidas em {1} (e não em {2}) e deixa de pagar cerca de {3} em juros.', fmtValor(dividas.extra), mesAno(recom.fim), mesAno(base.fim), fmtValor(recom.economia))
        : tx('Assim você fica sem dívidas em {0} (e não em {1}) e deixa de pagar cerca de {2} em juros.', mesAno(recom.fim), mesAno(base.fim), fmtValor(recom.economia))
      : recom.fim ? tx('Assim você fica sem dívidas em {0}.', mesAno(recom.fim)) : ''
    nova({
      id: 'adiantar-divida', urgencia: 'importante', prioridade: dividas.temCara ? 82 : 66, icone: 'divida', destino: 'dividas', botao: tx('Ver dívidas'),
      titulo: dividas.extraExemplo ? tx('Quando sobrar, adiante primeiro {0}.', alvo.nome) : tx('Adiante {0} com {1} por mês.', alvo.nome, fmtValor(dividas.extra)),
      porque: `${alvo.juros !== null ? tx('É a primeira da fila: cobra {0}% ao mês.', fmtTaxa(alvo.juros)) : tx('É a primeira da fila.')} ${ganho}`.trim(),
      impacto: recom.economia ? tx('{0} a menos de juros', fmtValor(recom.economia)) : undefined,
    })
  }
  if (corte > 0 && fase !== 'vermelho') {
    const cortes = categorias.filter((c) => c.media - c.sugestao >= 1).sort((a, b) => (b.media - b.sugestao) - (a.media - a.sugestao)).slice(0, 2)
    const passo = menor('corte') ? redondo(corte / 2) : redondo(corte)
    nova({
      id: 'corte', urgencia: 'importante', prioridade: 70, icone: 'carteira', destino: 'lancamentos', botao: tx('Ver gastos'), pedido: passo,
      titulo: menor('corte') ? tx('Comece cortando {0} por mês.', fmtValor(passo)) : tx('Corte {0} por mês para guardar {1}% do que entra.', fmtValor(passo), pct(sobraAlvo)),
      porque: menor('corte')
        ? tx('Da última vez, o corte inteiro ({0}) não coube na sua rotina. Metade já faz diferença: depois que virar costume, dá para ir até {1}% do que entra.', fmtValor(redondo(corte)), pct(sobraAlvo))
        : cortes.length === 2
        ? tx('Hoje sobram {0}%. Tirando {1} de {2} e {3} de {4}, você chega lá.', Math.max(0, pct(sobraFracao)), fmtValor(redondo(cortes[0].media - cortes[0].sugestao)), cortes[0].nome, fmtValor(redondo(cortes[1].media - cortes[1].sugestao)), cortes[1].nome)
        : tx('Hoje sobram {0}%. O orçamento sugerido mais abaixo mostra quanto tirar de cada categoria.', Math.max(0, pct(sobraFracao))),
      impacto: tx('{0} por ano', fmtValor(passo * 12)),
    })
  }
  if (temFluxo && renda > 0 && parcelasMes / renda > PARCELAS_ATENCAO && dividas) {
    const primeira = dividas.ordem.map((d) => ({ d, fim: d.quitaSemExtra })).filter((x) => x.fim).sort((a, b) => chaveMes(a.fim!.ano, a.fim!.mes) - chaveMes(b.fim!.ano, b.fim!.mes))[0]
    nova({
      id: 'sem-novas-parcelas', urgencia: 'importante', prioridade: 72, icone: 'acordo', destino: 'dividas', botao: tx('Ver dívidas'),
      titulo: tx('Não faça novas parcelas por enquanto.'),
      porque: primeira && primeira.d.parcela
        ? tx('As parcelas levam {0}% do que você recebe (o ideal é até {1}%). Em {2} acaba {3}, e o peso cai para {4}%.', pct(parcelasMes / renda), pct(PARCELAS_ATENCAO), mesAno(primeira.fim), primeira.d.nome, pct(Math.max(0, parcelasMes - primeira.d.parcela) / renda))
        : tx('As parcelas levam {0}% do que você recebe (o ideal é até {1}%).', pct(parcelasMes / renda), pct(PARCELAS_ATENCAO)),
    })
  }
  if (cartao && ((cartao.pesoProximo ?? 0) > CARTAO_ATENCAO || (cartao.uso ?? 0) > 0.6)) {
    const comprometido = soma(cartao.proximas.map((p) => p.valor))
    nova({
      id: 'cartao', urgencia: 'importante', prioridade: 65, icone: 'cartao', destino: 'cartoes', botao: tx('Ver cartões'),
      titulo: tx('Dê um tempo nas compras parceladas no cartão.'),
      porque: cartao.uso !== null
        ? tx('As próximas 6 faturas já têm {0} em parcelas, e você usa {1}% do limite (o saudável é até {2}%).', fmtValor(comprometido), pct(cartao.uso), pct(LIMITE_SAUDAVEL))
        : tx('As próximas 6 faturas já têm {0} em parcelas.', fmtValor(comprometido)),
    })
  }
  if (jurosPagos > 0) {
    nova({
      id: 'juros-pagos', urgencia: 'importante', prioridade: 60, icone: 'historico', destino: cartao && jurosDeFatura > 0 ? 'cartoes' : 'lancamentos',
      botao: cartao && jurosDeFatura > 0 ? tx('Ver cartões') : tx('Ver lançamentos'),
      titulo: tx('Você pagou {0} em juros, multas e tarifas em 12 meses.', fmtValor(jurosPagos)),
      porque: tx('É dinheiro que não volta nem compra nada. Pagar a fatura inteira e as contas no dia zera esse custo, e tarifa de banco quase sempre dá para cancelar.'),
      impacto: tx('{0} por mês de volta', fmtValor(centavos(jurosPagos / 12))),
    })
  }
  if (fase === 'reserva' && reserva && reserva.falta > 0) {
    // não deu da última vez: começa com metade, e a data de chegada acompanha
    const porMes = menor('reserva') ? centavos(reserva.porMes / 2) : reserva.porMes
    const chegaEm = porMes > 0 ? doMesChave(atual + Math.ceil(reserva.falta / porMes - 1e-9)) : null
    nova({
      id: 'reserva', urgencia: 'importante', prioridade: 62, icone: 'escudo', destino: v.metas ? 'metas' : 'patrimonio', botao: v.metas ? tx('Ver metas') : tx('Ver o guardado'),
      titulo: tx('Complete a reserva: faltam {0}.', fmtValor(reserva.falta)),
      porque: `${rendaVaria
        ? tx('Como a sua renda varia de um mês para o outro, o ideal são {0} meses de gastos ({1}).', alvoMeses, fmtValor(reserva.alvo))
        : tx('O ideal são {0} meses de gastos ({1}).', alvoMeses, fmtValor(reserva.alvo))} ${chegaEm
        ? tx('Guardando {0} por mês, você chega lá em {1}.', fmtValor(porMes), mesAno(chegaEm))
        : tx('Deixe esse dinheiro onde dá para tirar no mesmo dia.')}`,
      impacto: porMes > 0 ? tx('{0} por mês', fmtValor(porMes)) : undefined, pedido: porMes,
    })
  }
  if (!conheceReserva && temFluxo) {
    nova({
      id: 'informar-guardado', urgencia: 'sugestao', prioridade: 45, icone: 'carteira', destino: v.bancos || v.investimentos ? 'patrimonio' : 'metas',
      botao: v.bancos || v.investimentos ? tx('Informar o guardado') : tx('Criar a reserva'),
      titulo: tx('Conte quanto você tem guardado.'),
      porque: tx('Sem isso, não dá para saber quantos meses a sua reserva aguenta. Informe o saldo dos bancos ou crie uma meta “Reserva de emergência”.'),
    })
  }
  if (subiram[0]) {
    const c = subiram[0]
    const diferenca = centavos(c.media - c.antes!)
    const dasParcelas = c.parcelado - (c.parceladoAntes ?? 0)
    if (dasParcelas >= diferenca * 0.5 && c.parcelas.length) {
      const [p1, p2] = c.parcelas
      const termina = c.parcelas.reduce((m, x) => (chaveMes(x.termina.ano, x.termina.mes) > chaveMes(m.ano, m.mes) ? x.termina : m), p1.termina)
      nova({
        id: `subiu:${c.id}`, urgencia: 'sugestao', prioridade: 55, icone: 'cartao', destino: v.cartoes ? 'cartoes' : 'lancamentos',
        botao: v.cartoes ? tx('Ver cartões') : tx('Ver lançamentos'),
        titulo: tx('{0} subiu por causa de compras parceladas.', c.nome),
        porque: tx('Passou de {0} para {1} por mês, e {2} disso são parcelas de {3}, que vão até {4}. Até lá, evite parcelar mais nessa categoria.',
          fmtValor(c.antes!), fmtValor(c.media), fmtValor(centavos(dasParcelas)), p2 ? tx('{0} e {1}', p1.descricao, p2.descricao) : p1.descricao, mesAno(termina)),
      })
    } else nova({
      id: `subiu:${c.id}`, urgencia: 'sugestao', prioridade: 55, icone: 'sobe', destino: 'lancamentos', botao: tx('Ver lançamentos'),
      titulo: tx('{0} subiu {1}% nos últimos 3 meses.', c.nome, pct(c.variacao!)),
      porque: menor(`subiu:${c.id}`)
        ? tx('Passou de {0} para {1} por mês. Voltar ao que era não coube da última vez; tente voltar só a metade: {2} a menos por mês.', fmtValor(c.antes!), fmtValor(c.media), fmtValor(centavos(diferenca / 2)))
        : tx('Passou de {0} para {1} por mês. Voltando ao que era, sobram {2} por mês, {3} por ano.', fmtValor(c.antes!), fmtValor(c.media), fmtValor(diferenca), fmtValor(centavos(diferenca * 12))),
      impacto: tx('{0} por ano', fmtValor(centavos(diferenca * (menor(`subiu:${c.id}`) ? 6 : 12)))),
      pedido: menor(`subiu:${c.id}`) ? centavos(diferenca / 2) : diferenca,
    })
  }
  const assinaturas = recorrentes.filter((r) => r.assinatura)
  if (assinaturas.length >= 2) {
    nova({
      id: 'assinaturas', urgencia: 'sugestao', prioridade: 50, icone: 'calendario', destino: 'lancamentos', botao: tx('Ver lançamentos'),
      titulo: tx('Revise suas {0} assinaturas.', assinaturas.length),
      porque: tx('Somam {0} por mês, {1} por ano. Cancele as que você não usou no último mês; dá para assinar de novo quando quiser.', fmtValor(assinaturasPorMes), fmtValor(centavos(assinaturasPorMes * 12))),
      impacto: tx('{0} por ano', fmtValor(centavos(assinaturasPorMes * 12))),
    })
  }
  if (formigas[0]) {
    const f = formigas[0]
    nova({
      id: `formiga:${chaveDescricao(f.descricao)}`, urgencia: 'sugestao', prioridade: 48, icone: 'lista', destino: 'lancamentos', botao: tx('Ver lançamentos'),
      titulo: tx('{0}: {1} vezes por mês.', f.descricao, Math.round(f.vezesPorMes)),
      porque: tx('Parece pouco ({0} em média), mas soma {1} por mês e {2} por ano. Cortar metade já faz diferença.', fmtValor(f.ticket), fmtValor(f.porMes), fmtValor(f.porAno)),
      impacto: tx('{0} por ano', fmtValor(centavos(f.porAno / 2))),
    })
  }
  if (temFluxo && metas && !metas.cabe && metas.necessario > 0) {
    const maior = [...metas.metas].filter((m) => m.porMes).sort((a, b) => naPrincipal(b.porMes!, b.moeda) - naPrincipal(a.porMes!, a.moeda))[0]
    nova({
      id: 'metas', urgencia: 'sugestao', prioridade: 58, icone: 'meta', destino: 'metas', botao: tx('Ver metas'),
      titulo: tx('Suas metas pedem {0} por mês.', fmtValor(metas.necessario)),
      porque: metas.disponivel > 0
        ? tx('Pelo plano, sobram {0} por mês para elas. Para caber, estique o prazo de “{1}” ou aumente a sobra.', fmtValor(metas.disponivel), maior?.nome ?? '')
        : tx('Hoje a sobra vai antes para a segurança (reserva e dívidas). Estique o prazo de “{0}” para ele caber depois.', maior?.nome ?? ''),
    })
  }
  if (fase === 'crescer' && alocacao && !apertado) {
    nova({
      id: 'crescer', urgencia: 'sugestao', prioridade: 40, icone: 'investir', destino: v.metas ? 'metas' : 'patrimonio', botao: v.metas ? tx('Ver metas') : tx('Ver o guardado'),
      titulo: tx('Faça a sobra trabalhar por você.'),
      porque: tx('Reserva completa e nenhuma dívida cara: os {0} que sobram por mês podem ir para objetivos de longo prazo, como aposentadoria ou a casa própria. Em 10 anos, são {1} só do que você guardar.', fmtValor(sobra), fmtValor(centavos(sobra * 120))),
    })
  }
  if (!e.dividasSemJuros && dividas && dividas.semJuros > 0) {
    nova({
      id: 'informe-juros', urgencia: 'sugestao', prioridade: 25, icone: 'divida', destino: 'dividas', botao: tx('Informar os juros'),
      titulo: dividas.semJuros === 1 ? tx('Informe os juros de 1 dívida.') : tx('Informe os juros de {0} dívidas.', dividas.semJuros),
      porque: tx('Com os juros, o plano mostra qual dívida pagar primeiro e quanto você economiza adiantando.'),
    })
  }
  if (temFluxo && semCategoria > 0.1) {
    nova({
      id: 'categorizar', urgencia: 'sugestao', prioridade: 24, icone: 'lista', destino: 'lancamentos', botao: tx('Ver lançamentos'),
      titulo: tx('Dê categoria aos gastos que estão sem.'),
      porque: tx('{0}% do que sai está sem categoria. Com categoria, a análise mostra onde dá para economizar.', pct(semCategoria)),
    })
  }
  if (v.bancos && preencheuBancos && ef.herdadoDe && atual - chaveMes(ef.herdadoDe[0], ef.herdadoDe[1]) >= 2) {
    nova({
      id: 'atualizar-saldos', urgencia: 'sugestao', prioridade: 22, icone: 'carteira', destino: 'patrimonio', botao: tx('Atualizar saldos'),
      titulo: tx('Atualize quanto você tem nos bancos.'),
      porque: tx('O último saldo informado é de {0}. Com o saldo de hoje, a reserva e o quanto é seu ficam certos.', mesAno({ ano: ef.herdadoDe[0], mes: ef.herdadoDe[1] })),
    })
  }
  // Quem guarda muito e tem medo de gastar precisa de permissão, não de mais um corte.
  if (podeGastar >= Math.max(50, renda * 0.03)) {
    nova({
      id: 'pode-gastar', urgencia: 'sugestao', prioridade: 52, icone: 'estrela', destino: 'lancamentos', botao: tx('Ver lançamentos'), pedido: podeGastar,
      titulo: tx('Você pode gastar {0} a mais por mês, sem culpa.', fmtValor(podeGastar)),
      porque: tx('Você guarda {0}% do que entra e a sua base está em dia. Mesmo gastando {1} a mais com você, ainda guarda {2}% por mês. Dinheiro também é para viver.',
        pct(sobraFracao), fmtValor(podeGastar), pct((sobra - podeGastar) / renda)),
    })
  }
  // Dinheiro parado na conta corrente além de 2 meses de gastos (o das contas do mês fica de fora).
  const paradoNaConta = centavos(naConta - comprometidoNoMes - gastos)
  if (v.bancos && gastos > 0 && naConta - comprometidoNoMes > 2 * gastos && paradoNaConta >= minimoParado(renda)) {
    nova({
      id: 'dinheiro-parado', urgencia: 'sugestao', prioridade: 42, icone: 'cofre', destino: 'patrimonio', botao: tx('Ver o guardado'),
      titulo: tx('{0} estão parados na conta corrente.', fmtValor(redondo(paradoNaConta))),
      porque: tx('Na conta corrente você tem mais de 2 meses dos seus gastos. Ali o dinheiro costuma não render e perde para a inflação. Deixando 1 mês de gastos na conta, o resto pode ir para um lugar que renda e que dê para tirar no mesmo dia.'),
    })
  }
  // Quem usa crédito com controle não leva sermão: leva o limite seguro.
  if (jeito.credito && renda > 0 && objetivo !== 'dividas') {
    const cabe = Math.max(0, Math.floor((renda * PARCELAS_ATENCAO - parcelasMes - parceladoNoCartao) / 10) * 10)
    nova({
      id: 'limite-parcelas', urgencia: 'sugestao', prioridade: 30, icone: 'acordo', destino: v.dividas ? 'dividas' : 'cartoes', botao: v.dividas ? tx('Ver dívidas') : tx('Ver cartões'),
      titulo: tx('Você usa crédito com controle.'),
      porque: cabe > 0
        ? tx('As parcelas levam {0}% do que entra e nenhuma é cara. O limite seguro é {1}%: dá para assumir até {2} a mais por mês em parcelas sem apertar. Passando disso, o crédito começa a mandar no seu mês.', pct(pesoDasParcelas), pct(PARCELAS_ATENCAO), fmtValor(cabe))
        : tx('As parcelas levam {0}% do que entra e nenhuma é cara, mas você já está no limite seguro de {1}%. Espere uma acabar antes de assumir outra.', pct(pesoDasParcelas), pct(PARCELAS_ATENCAO)),
    })
  }

  // O que a memória ensina: o passo que falhou duas vezes sai do caminho; o que deu certo é lembrado.
  for (const x of acoes) {
    const l = licaoDe(memoria, x.id)
    if (l.falhas >= 2 && x.urgencia !== 'urgente') {
      x.urgencia = 'sugestao'
      x.prioridade -= 25
      x.porque = `${x.porque} ${tx('Já sugeri isso {0} vezes e não encaixou na sua rotina. Fica aqui, mas sem insistir.', l.falhas)}`
    } else if (l.falhas === 0 && l.ultimo?.resultado === 'funcionou') {
      x.porque = `${tx('Da última vez deu certo.')} ${x.porque}`
    }
  }
  // O objetivo da pessoa sobe o que a aproxima dele (o urgente, como o atraso, continua na frente de tudo).
  const pesos = objetivo ? PESO_DO_OBJETIVO[objetivo] : {}
  for (const x of acoes) {
    const b = pesos[x.id.split(':')[0]]
    if (!b) continue
    x.prioridade = x.urgencia === 'urgente' ? x.prioridade + Math.max(0, b) / 10 : Math.min(94, x.prioridade + b)
  }
  acoes.sort((a, b) => b.prioridade - a.prioridade || a.id.localeCompare(b.id))

  // ----- fase: por que e o próximo passo -----
  const fases = infoFases(alvoMeses)
  const porqueFase = !temFluxo && (fase === 'reserva' || fase === 'crescer')
    ? tx('Ainda faltam meses lançados para saber se o seu mês fecha no azul. Com 2 meses completos, a fase fica certa.')
    : fase === 'vermelho' ? tx('Nos últimos meses saiu mais do que entrou. Enquanto isso acontecer, o resto não se sustenta.')
    : fase === 'colchao' ? tx('O que você tem guardado não cobre 1 mês de gastos: qualquer imprevisto vira dívida.')
      : fase === 'dividas' ? tx('{0} cobra {1}% ao mês. Nenhum investimento seguro rende isso, então quitar vem primeiro.', maisCara?.divida.descricao ?? '', fmtTaxa(jurosMax))
        : fase === 'reserva' ? (conheceReserva ? tx('O mês fecha no azul e você tem um colchão. Agora é completar {0} meses de gastos guardados.', alvoMeses) : tx('O mês fecha no azul. Informe quanto você tem guardado para o app saber se a sua reserva já está completa.'))
          : tx('Mês no azul, reserva completa e nenhuma dívida cara. A base está pronta para o dinheiro crescer.')
  const proximoPasso = fase === 'vermelho' ? tx('Próximo passo: fechar o mês com sobra.')
    : fase === 'colchao' ? tx('Próximo passo: guardar {0}.', fmtValor(redondo(gastos)))
      : fase === 'dividas' ? tx('Próximo passo: quitar as dívidas acima de {0}% ao mês.', JUROS_CARO_MES)
        : fase === 'reserva' ? (reserva ? tx('Próximo passo: chegar a {0} guardados.', fmtValor(reserva.alvo)) : tx('Próximo passo: informar o seu dinheiro guardado.'))
          : tx('Próximo passo: definir metas de longo prazo e mantê-las.')

  // ----- resumo do consultor -----
  const resumo: string[] = []
  if (temFluxo) {
    resumo.push(`${tx('Nos últimos {0} meses fechados, entraram em média {1} por mês e saíram {2}.', recentes.length, fmtValor(renda), fmtValor(gastos))} ${sobra < 0
      ? tx('Faltaram {0} por mês.', fmtValor(-sobra))
      // no aperto, cobrar 20% não ajuda: o passo é fechar o mês sem faltar
      : jeito.apertado ? tx('Sobraram {0} por mês ({1}%). Com o orçamento tão justo, o primeiro passo é fechar o mês sem faltar; guardar vem depois.', fmtValor(sobra), pct(sobraFracao))
      : sobraFracao < SOBRA_IDEAL ? tx('Sobraram {0} por mês ({1}%); o recomendado é guardar pelo menos 20%.', fmtValor(sobra), pct(sobraFracao))
        : tx('Sobraram {0} por mês ({1}%), acima dos 20% recomendados.', fmtValor(sobra), pct(sobraFracao))}${guardando >= 1
      ? ` ${tx('Os {0} por mês que você passou para a caixinha, a poupança ou investimentos não entram nos gastos: dinheiro guardado não é gasto.', fmtValor(guardando))}`
      : ''}`)
    const ordenados = [...pilares].sort((a, b) => a.nota - b.nota)
    const pior = ordenados[0]
    const melhor = ordenados[ordenados.length - 1]
    if (pior && pior.nota < 70) resumo.push(tx('O ponto que mais pede atenção é “{0}”: {1}', pior.nome, pior.frase))
    if (melhor && melhor.nota >= 70 && melhor !== pior) resumo.push(tx('Seu ponto forte é “{0}” ({1}).', melhor.nome, melhor.valor))
    if (tendenciaGastos !== null && tendenciaRenda !== null && tendenciaGastos - tendenciaRenda > 0.015) {
      resumo.push(tx('Atenção ao rumo: nos últimos {0} meses, os gastos crescem mais rápido que a renda.', chavesComDados.length))
    }
    if (jeito.estavel && !jeito.poupador && fase !== 'vermelho' && fase !== 'colchao') {
      resumo.push(tx('Suas contas estão em ordem: vou falar pouco e avisar quando algo fugir do normal.'))
    }
  } else {
    resumo.push(tx('Para a análise completa, lance as entradas e as saídas de pelo menos 2 dos últimos 3 meses. Enquanto isso, olho o que já dá: dívidas, cartão, metas e o mês atual.'))
  }

  // ----- o objetivo da pessoa e o que o consultor aprendeu -----
  const fimSemDividas = dividas?.estrategias.find((x) => x.id === dividas.recomendada)?.fim ?? null
  const fraseObjetivo = objetivo === null ? null
    : objetivo === 'dividas'
      ? !dividas ? tx('Seu objetivo é sair das dívidas, e hoje você não tem nenhuma aberta. Objetivo cumprido.')
        : fimSemDividas ? tx('Seu objetivo é sair das dívidas: faltam {0}, e seguindo o plano você fica livre delas em {1}.', fmtValor(dividas.total), mesAno(fimSemDividas))
          : tx('Seu objetivo é sair das dívidas: faltam {0}.', fmtValor(dividas.total))
    : objetivo === 'fechar-mes'
      ? !previsao ? tx('Seu objetivo é fechar o mês sem aperto. Lance o que entra e o que sai neste mês para eu prever como ele fecha.')
        : previsao.resultadoPrevisto >= 0 ? tx('Seu objetivo é fechar o mês sem aperto: pela previsão, {0} fecha com {1} de sobra.', nomeDoMes(mes), fmtValor(previsao.resultadoPrevisto))
          : tx('Seu objetivo é fechar o mês sem aperto: pela previsão, em {0} podem faltar {1}. O plano abaixo começa por aí.', nomeDoMes(mes), fmtValor(-previsao.resultadoPrevisto))
    : objetivo === 'guardar'
      ? reserva ? tx('Seu objetivo é juntar dinheiro: você tem {0} guardados, {1} dos seus gastos.', fmtValor(reserva.tem), fmtMeses(reserva.meses))
        : tx('Seu objetivo é juntar dinheiro. Informe quanto você já tem guardado para eu acompanhar o quanto ele cresce.')
    : objetivo === 'controle'
      ? temFluxo ? tx('Seu objetivo é saber para onde vai o dinheiro: você lança cerca de {0} coisas por mês, e {1}% dos gastos têm categoria.', lancamentosPorMes, pct(1 - semCategoria))
        : tx('Seu objetivo é saber para onde vai o dinheiro. Lance tudo o que entra e sai por 2 meses e eu mostro o caminho de cada real.')
    : objetivo === 'tranquilo'
      ? podeGastar > 0 ? tx('Seu objetivo é gastar sem culpa: dá para gastar {0} a mais por mês sem mexer no que você guarda.', fmtValor(podeGastar))
        : tx('Seu objetivo é gastar sem culpa. Hoje ainda não sobra folga para isso; seguindo o plano abaixo, ela aparece.')
    : patrimonio && fase === 'crescer' ? tx('Seu objetivo é fazer o dinheiro render: no ritmo de hoje, o que é seu chega a {0} em 12 meses.', fmtValor(patrimonio.em12))
      : tx('Seu objetivo é fazer o dinheiro render. Antes de investir, a base precisa estar pronta: veja em que degrau você está.')
  if (fraseObjetivo) resumo.splice(Math.min(1, resumo.length), 0, fraseObjetivo)
  if (acoes[0]) resumo.push(tx('Primeiro passo: {0}', acoes[0].titulo))

  const conferidos = (memoria?.acompanhados ?? []).filter((x) => x.resultado).reverse()
  const aprendizado: Aprendizado = {
    objetivo, frase: fraseObjetivo,
    vitorias: conferidos.filter((x) => x.resultado === 'funcionou').slice(0, 3).map(fraseDoResultado),
    ajustes: conferidos.filter((x) => x.resultado === 'nao').slice(0, 3).map(fraseDoResultado),
    acompanhando: (memoria?.acompanhados ?? []).filter((x) => !x.resultado).slice(-4).reverse()
      .map((x) => ({ titulo: x.titulo, ...doMesChave(x.avaliar) })),
  }

  return {
    hoje: { ano, mes }, temFluxo, mesesAnalisados: chavesComDados.length, nota, rotulo: nota === null ? tx('Sem nota ainda') : rotuloDaNota(nota),
    tom: nota === null ? 'medio' : tomDa(nota), resumo, fase, fases, porqueFase, proximoPasso, pilares,
    renda, gastos, sobra, sobraFracao, guardando, sobraAlvo, rendaVaria, variacaoRenda, principalFonte, tendenciaGastos, tendenciaRenda,
    serie, mes: previsao, categorias, subiram, cairam, regra, recorrentes, assinaturasPorMes, recorrentesPorMes, formigas,
    jurosPagos, semCategoria, cartao, dividas, reserva, alocacao, metas, patrimonio, agenda, plano, corte, acoes,
    atrasoTotal: totalAtraso, podeGastar, lancamentosPorMes, jeito, aprendizado,
  }
}

// ---------- o que mudou de uma análise para a outra ----------

/** O essencial de uma análise, para comparar com a próxima (cabe no navegador). */
export interface Retrato {
  em: string
  nota: number | null
  fase: Fase
  resultadoMes: number | null
  porDia: number | null
  reservaMeses: number | null
  dividas: number
  semDividasEm: number | null
  acoes: { id: string; titulo: string }[]
  /** O dia planejado para cada pagamento (`descrição|vencimento` → dia, ou null sem dinheiro). Falta em retratos antigos. */
  pagamentos?: Record<string, string | null>
}

export function retratoDe(a: Analise, hoje = new Date()): Retrato {
  const fim = a.dividas?.estrategias.find((x) => x.id === a.dividas!.recomendada)?.fim
  return {
    em: hoje.toISOString(), nota: a.nota, fase: a.fase,
    resultadoMes: a.mes?.resultadoPrevisto ?? null, porDia: a.mes?.porDia ?? null,
    reservaMeses: a.reserva ? Math.floor(a.reserva.meses * 10) / 10 : null,
    dividas: a.dividas?.total ?? 0, semDividasEm: fim ? chaveMes(fim.ano, fim.mes) : null,
    acoes: a.acoes.map(({ id, titulo }) => ({ id, titulo })),
    pagamentos: a.plano ? Object.fromEntries([...a.plano.pagamentos, ...a.plano.semDinheiro].map((p) => [`${p.descricao}|${p.vence}`, p.pagarEm])) : undefined,
  }
}

export interface Mudanca {
  texto: string
  tom: 'bom' | 'ruim' | 'neutro'
}

/** A última vez que uma mudança nos dados mexeu na análise (guardada pelo Painel enquanto a aba está aberta). */
export interface Reanalise {
  em: Date
  mudancas: Mudanca[]
  nota: number | null
  notaAntes: number | null
}

/** O que mudou de `antes` para `depois`, do mais para o menos importante. */
export function compararRetratos(antes: Retrato, depois: Retrato): Mudanca[] {
  const lista: Mudanca[] = []
  // O plano de pagamentos mudou de dia: é o que a pessoa mais quer saber depois de lançar uma entrada nova.
  if (antes.pagamentos && depois.pagamentos) {
    for (const [chave, dia] of Object.entries(depois.pagamentos)) {
      if (!(chave in antes.pagamentos)) continue
      const era = antes.pagamentos[chave]
      if (era === dia) continue
      const nome = chave.slice(0, chave.lastIndexOf('|'))
      if (dia && (!era || dia < era)) {
        lista.push({ texto: era ? tx('Agora dá para pagar {0} em {1} (antes, {2}).', nome, fmtDataCurta(dia), fmtDataCurta(era)) : tx('Agora dá para pagar {0} em {1}.', nome, fmtDataCurta(dia)), tom: 'bom' })
      } else {
        lista.push({ texto: dia ? tx('{0} passou para {1} (antes, {2}).', nome, fmtDataCurta(dia), fmtDataCurta(era!)) : tx('{0} ficou sem dinheiro até o fim do mês que vem.', nome), tom: 'ruim' })
      }
    }
  }
  const fases = infoFases()
  const nomeFase = (f: Fase) => fases.find((x) => x.id === f)?.nome ?? f
  if (antes.nota !== null && depois.nota !== null && antes.nota !== depois.nota) {
    lista.push({ texto: tx('Sua nota foi de {0} para {1}.', antes.nota, depois.nota), tom: depois.nota > antes.nota ? 'bom' : 'ruim' })
  }
  if (antes.fase !== depois.fase) {
    const avancou = FASES.indexOf(depois.fase) > FASES.indexOf(antes.fase)
    lista.push({ texto: avancou ? tx('Você avançou para a fase “{0}”.', nomeFase(depois.fase)) : tx('Você voltou para a fase “{0}”.', nomeFase(depois.fase)), tom: avancou ? 'bom' : 'ruim' })
  }
  if (antes.resultadoMes !== null && depois.resultadoMes !== null && Math.abs(depois.resultadoMes - antes.resultadoMes) >= 0.01) {
    lista.push({
      texto: tx('A previsão do mês foi de {0} para {1}.', fmtValor(antes.resultadoMes), fmtValor(depois.resultadoMes)),
      tom: depois.resultadoMes > antes.resultadoMes ? 'bom' : 'ruim',
    })
  }
  if (Math.abs(depois.dividas - antes.dividas) >= 0.01) {
    lista.push({ texto: tx('Suas dívidas foram de {0} para {1}.', fmtValor(antes.dividas), fmtValor(depois.dividas)), tom: depois.dividas < antes.dividas ? 'bom' : 'ruim' })
  }
  if (antes.semDividasEm !== null && depois.semDividasEm !== null && antes.semDividasEm !== depois.semDividasEm) {
    const a = doMesChave(antes.semDividasEm)
    const d = doMesChave(depois.semDividasEm)
    lista.push({ texto: tx('Sem dívidas em {0} (antes, {1}).', mesAno(d), mesAno(a)), tom: depois.semDividasEm < antes.semDividasEm ? 'bom' : 'ruim' })
  }
  if (antes.reservaMeses !== null && depois.reservaMeses !== null && antes.reservaMeses !== depois.reservaMeses) {
    lista.push({ texto: tx('Sua reserva foi de {0} para {1} de gastos.', fmtMeses(antes.reservaMeses), fmtMeses(depois.reservaMeses)), tom: depois.reservaMeses > antes.reservaMeses ? 'bom' : 'ruim' })
  }
  const idsAntes = new Set(antes.acoes.map((x) => x.id))
  const idsDepois = new Set(depois.acoes.map((x) => x.id))
  for (const x of depois.acoes) if (!idsAntes.has(x.id)) lista.push({ texto: tx('Entrou no plano: {0}', x.titulo), tom: 'neutro' })
  for (const x of antes.acoes) if (!idsDepois.has(x.id)) lista.push({ texto: tx('Saiu do plano: {0}', x.titulo), tom: 'bom' })
  const porDiaAntes = Math.max(0, antes.porDia ?? 0)
  const porDiaDepois = Math.max(0, depois.porDia ?? 0)
  if (antes.porDia !== null && depois.porDia !== null && Math.abs(porDiaDepois - porDiaAntes) >= 0.01) {
    lista.push({ texto: tx('Dá para gastar {0} por dia até o fim do mês (antes, {1}).', fmtValor(porDiaDepois), fmtValor(porDiaAntes)), tom: porDiaDepois > porDiaAntes ? 'bom' : 'ruim' })
  }
  return lista
}

/** O mês por extenso no meio da frase ("em novembro"), para os textos da página. */
export const nomeDoMes = (m: number) => noMeioDaFrase(MESES_NOME[m - 1])
