export type Tipo = 'entrada' | 'saida'
export type Categoria = 'transporte' | 'divida' | 'alimentacao' | 'outros'

export interface Lancamento {
  id: string
  ano: number
  mes: number
  tipo: Tipo
  descricao: string
  valor: number
  data: string | null
  categoria: Categoria
  /** Banco do lançamento (opcional). */
  banco_id?: string | null
  /** Quando a saída é pagamento de uma dívida. */
  divida_id?: string | null
  created_at?: string
}

/** Uma dívida existe ao longo dos meses; o saldo vem de divida_saldos e dos pagamentos. */
export interface Divida {
  id: string
  descricao: string
  valor_parcela: number | null
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
  valor: number
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
  usd: number
  meta_usd: number
  caixa: Caixa
}

export const TIPOS_CAIXA: TipoCaixa[] = ['cc', 'caixinha', 'reserva']
