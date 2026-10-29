export type Tipo = 'entrada' | 'saida'
/** As 4 categorias fixas de antes (coluna "categoria"), usadas só sem a migração 5. */
export type CategoriaAntiga = 'transporte' | 'divida' | 'alimentacao' | 'outros'

/** Categoria criada pela pessoa (ou das que toda conta ganha no começo). */
export interface Categoria {
  id: string
  tipo: Tipo
  nome: string
  icone: string
  cor: string
  /** 'divida': as saídas nela podem abater uma dívida. */
  papel: 'divida' | null
  ordem: number
}

export interface Lancamento {
  id: string
  ano: number
  mes: number
  tipo: Tipo
  descricao: string
  valor: number
  data: string | null
  categoria_id?: string | null
  /** Coluna antiga; só vale sem a migração 5. */
  categoria?: CategoriaAntiga
  /** Banco do lançamento (opcional). */
  banco_id?: string | null
  /** Quando a saída é pagamento de uma dívida. */
  divida_id?: string | null
  /** Quando o lançamento é a baixa ("Paguei" / "Recebi") de uma conta fixa do mês. */
  conta_fixa_id?: string | null
  /** Lançado em outra moeda: o valor original. `valor` fica sempre na moeda principal. */
  valor_original?: number | null
  moeda_original?: string | null
  /** Compra no cartão de crédito: cada parcela é uma saída, com `data` no vencimento da fatura em que cai. */
  cartao_id?: string | null
  /** Junta as parcelas da mesma compra. */
  compra_id?: string | null
  /** Número desta parcela (3 de `parcelas`). */
  parcela?: number | null
  parcelas?: number | null
  /** Dia em que a pessoa comprou. */
  data_compra?: string | null
  /** Pix, débito, dinheiro, boleto ou transferência (migração 11). Compra no cartão não usa: veja `formaDe`. */
  forma?: 'pix' | 'debito' | 'dinheiro' | 'boleto' | 'transferencia' | null
  created_at?: string
}

/** Uma dívida existe ao longo dos meses; o saldo vem de divida_saldos e dos pagamentos. */
export interface Divida {
  id: string
  descricao: string
  valor_parcela: number | null
  /** Campos da migração 10. 'me_devem': dinheiro que alguém deve a você (recebido com lançamentos de entrada). */
  sentido?: 'devo' | 'me_devem'
  /** Com quem: banco, loja, pessoa. */
  pessoa?: string | null
  /** Vencimento da 1ª parcela (as outras no mesmo dia dos meses seguintes); sem parcela fixa, a data combinada. */
  inicio?: string | null
  total_parcelas?: number | null
  /** Moeda em que a dívida foi feita (migração 14); null = a moeda principal. Parcela e saldos ficam nessa moeda. */
  moeda?: string | null
  obs?: string | null
}

/** "Em tal data, o saldo devedor era X" (informado por você ou vindo da planilha). */
export interface SaldoDivida {
  id: string
  divida_id: string
  data: string
  saldo: number
}

/** Saída ligada a uma dívida (de qualquer ano). */
export interface Pagamento {
  id: string
  divida_id: string
  data: string | null
  /** Na moeda principal. */
  valor: number
  /** Pago em outra moeda: o valor original (migração 4). */
  valor_original?: number | null
  moeda_original?: string | null
}

/** Banco cadastrado por você (Nubank, Itaú, Next, dinheiro vivo…). */
export interface Banco {
  id: string
  nome: string
  cor: string
  ordem: number
}

export type TipoCaixa = 'cc' | 'caixinha' | 'reserva'
/** Saldo guardado em cada banco no mês, pelo id do banco. */
export type Caixa = Record<string, Partial<Record<TipoCaixa, number>> | undefined>

export interface Mes {
  ano: number
  mes: number
  investimentos: number
  /** Saldo guardado em cada outra moeda, pelo código ({ USD: 1200, EUR: 300 }). */
  moedas: Record<string, number>
  meta_usd: number
  caixa: Caixa
}

export const TIPOS_CAIXA: TipoCaixa[] = ['cc', 'caixinha', 'reserva']

/** Partes do painel que cada pessoa liga ou desliga conforme a vida dela. */
export type Modulo = 'dividas' | 'contas' | 'cartoes' | 'bancos' | 'investimentos' | 'moedas' | 'metas'
export type Detalhe = 'simples' | 'equilibrado' | 'detalhado'

/** Como o painel se adapta a cada pessoa: respostas das perguntas iniciais e ajustes feitos depois. */
export interface Perfil {
  nome: string
  /** Moeda principal: todos os totais aparecem nela. */
  moeda: string
  /** Outras moedas que a pessoa usa além da principal. */
  moedas: string[]
  detalhe: Detalhe
  modulos: Record<Modulo, boolean>
  /** Sugestões recusadas, para o app não insistir. */
  dispensadas: string[]
  /** null enquanto as perguntas iniciais não foram respondidas. */
  onboarding_em: string | null
  /** Foto (data URL pequena). Gravada à parte do resto do perfil: a coluna só existe com a migração 9. */
  foto?: string | null
}

/** Objetivo para juntar dinheiro (viagem, reserva de emergência, carro…), na moeda que a pessoa escolher. */
export interface Meta {
  id: string
  nome: string
  icone: string
  cor: string
  moeda: string
  alvo: number
  /** Opcional: com prazo, o app calcula quanto guardar por mês. */
  prazo: string | null
  ordem: number
  created_at?: string
}

/** Dinheiro guardado (positivo) ou retirado (negativo) de uma meta, na moeda dela. */
export interface MovimentoMeta {
  id: string
  meta_id: string
  data: string
  valor: number
  descricao: string
}

/** Conta que se repete todo mês: aluguel, luz, internet (saída) ou salário (entrada). */
export interface ContaFixa {
  id: string
  tipo: Tipo
  descricao: string
  /** Valor de costume; na baixa a pessoa pode trocar. */
  valor: number
  categoria_id: string | null
  banco_id: string | null
  /** Dia do vencimento ou do recebimento (1 a 31); em mês mais curto vale o último dia. */
  dia: number
  /** Moeda da conta (migração 14); null = a moeda principal. `valor` fica nessa moeda. */
  moeda?: string | null
  /** Cotação combinada (migração 15): quanto vale 1 da moeda da conta na principal. null = a cotação do dia. */
  cotacao?: number | null
  /** Primeiro mês em que vale (dia 1 do mês). */
  inicio: string
  /** Último mês em que vale (dia 1 do mês); null = continua. */
  fim: string | null
  ativa: boolean
  created_at?: string
}

/** Cartão de crédito. As compras entram na fatura do mês que vence depois do dia de fechamento. */
export interface CartaoCredito {
  id: string
  nome: string
  cor: string
  banco_id: string | null
  limite: number | null
  dia_fechamento: number
  dia_vencimento: number
  ativo: boolean
  /** Dinheiro numa caixinha do banco que vira limite extra (migração 9). */
  limite_garantido?: number
  /** O limite garantido é o valor da caixinha do banco do cartão (tela Patrimônio), não um valor fixo. */
  garantia_caixinha?: boolean
  created_at?: string
}

/**
 * Fatura resolvida (ano e mês do vencimento): paga, ou renegociada com o banco (virou uma dívida em parcelas,
 * e as compras dela deixam de contar nas saídas do mês).
 */
export interface FaturaPaga {
  id: string
  cartao_id: string
  ano: number
  mes: number
  valor: number
  pago_em: string
  banco_id: string | null
  /** Campos da migração 9. */
  tipo?: 'paga' | 'renegociada'
  /** Juros e multa pagos junto (viram uma saída à parte, `juros_lanc_id`). */
  juros?: number
  juros_lanc_id?: string | null
  /** Dívida criada na renegociação. */
  divida_id?: string | null
  obs?: string | null
}
