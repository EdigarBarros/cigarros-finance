/**
 * O que o Cairo recebe do app: os registros como estão no banco, ainda sem validar (reais com vírgula, juros em percentual,
 * datas em texto). `src/lib/cairo.ts` monta isto a partir do estado do app; `contrato/validar.ts` e `fatos/` convertem.
 *
 * O Cairo não importa nada de `src/lib`: estes tipos repetem só os campos que ele usa.
 */

export interface LancBruto {
  id: string
  ano: number
  mes: number
  tipo: 'entrada' | 'saida'
  descricao: string
  /** Na moeda principal, em reais (como no banco). */
  valor: number
  data: string | null
  categoria: string
  categoriaNome: string
  cartao_id?: string | null
  parcelas?: number | null
  data_compra?: string | null
  conta_fixa_id?: string | null
  divida_id?: string | null
  guardado_banco_id?: string | null
  pago_por?: string | null
  created_at?: string | null
}

export interface ContaFixaBruta {
  id: string
  tipo: 'entrada' | 'saida'
  descricao: string
  valor: number
  /** 1 a 31. */
  dia: number
  /** Primeiro dia do primeiro mês (AAAA-MM-01). */
  inicio: string
  fim: string | null
  ativa: boolean
  moeda?: string | null
}

export interface DividaBruta {
  id: string
  descricao: string
  sentido?: 'devo' | 'me_devem'
  pessoa?: string | null
  valor_parcela: number | null
  total_parcelas?: number | null
  inicio?: string | null
  moeda?: string | null
  /** Percentual ao mês (2,5 = 2,5%). */
  juros_mes?: number | null
  atraso_juros_mes?: number | null
  atraso_tipo?: 'simples' | 'composto' | null
  atraso_multa?: number | null
  atraso_base?: 'parcela' | 'saldo' | null
  atraso_periodo?: 'mes' | 'dia' | null
  atraso_reais_dia?: number | null
  valor_recebido?: number | null
  em_espera?: boolean | null
  /** Quando há partes, o vencimento e o valor de cada parcela delas (para os fatos do contrato). */
  partes?: { vencimento: string; valor: number; inicio?: string | null }[]
}

export interface ConferenciaBruta {
  id: string
  divida_id: string
  data: string
  antes: number
  depois: number
  origem: 'conferir' | 'pagar'
  qual_valor?: 'total' | 'quitar' | null
  created_at?: string | null
}

export interface FaturaPagaBruta {
  id: string
  cartao_id: string
  ano: number
  mes: number
  valor: number
  pago_em: string
  juros?: number | null
  tipo?: 'paga' | 'renegociada' | null
}

/** Um compromisso da agenda do app (lib/analise.ts), de hoje até o fim do horizonte. */
export interface CompromissoBruto {
  data: string
  vence?: string | null
  tipo: 'entrada' | 'saida'
  descricao: string
  valor: number
  origem: 'lancamento' | 'conta' | 'parcela' | 'cartao' | 'recorrente'
  atrasada?: boolean
  grupo?: string
}

/** Uma promessa de pagamento já avaliada pelo app (lib/dividas.ts → promessasDe). */
export interface PromessaBruta {
  divida_id: string
  data: string
  /** Só 'cumprida' é pagar no combinado; em parte, depois do dia, não cumprida e trocada não são. */
  estado: 'cumprida' | 'em_parte' | 'pagou_depois' | 'nao_cumprida' | 'trocada' | 'aguardando' | 'hoje'
  created_at?: string | null
}

/** Parcela de "me devem" que deve cair no horizonte (lib/dividas.ts → aReceberPrevisto). Sem dia combinado, não vem. */
export interface AReceberBruto { divida_id: string; data: string; valor: number; descricao: string }

/** O que o app aprendeu das conferências (lib/jurosAprendido.ts), para o Cairo dar tipo e unidade. */
export interface JurosAprendidoBruto {
  divida_id: string
  amostras: number
  modelo: 'pct' | 'reais'
  /** Fração por dia (0,007 = 0,7% ao dia). */
  taxaDia: number
  reaisDia: number
  confianca: 'alta' | 'media' | 'baixa'
}

export interface EntradaCairo {
  /** O dia de hoje no fuso da pessoa (AAAA-MM-DD). Obrigatório: o Cairo não tem relógio. */
  hoje: string
  /** Moeda principal (ISO 4217). */
  moeda: string
  /** Até quando vale a agenda (o fim do mês que vem). */
  horizonteAte: string
  /** Lançamentos da janela da análise (12 meses fechados e o atual), na moeda principal. */
  lancamentos: LancBruto[]
  contasFixas: ContaFixaBruta[]
  dividas: DividaBruta[]
  conferencias: ConferenciaBruta[]
  faturasPagas: FaturaPagaBruta[]
  /** O saldo da conta corrente somado dos bancos e o mês a que ele se refere (AAAA-MM); null quando não informado. */
  saldoContaCorrente: { valor: number; mes: string } | null
  compromissos: CompromissoBruto[]
  promessas: PromessaBruta[]
  aReceber: AReceberBruto[]
  jurosAprendidos: JurosAprendidoBruto[]
}
