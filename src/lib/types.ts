export type Tipo = 'entrada' | 'saida'
export type Conta = 'principal' | 'nubank' | 'inter'
export type Categoria = 'transporte' | 'divida' | 'alimentacao' | 'outros'

export interface Lancamento {
  id: string
  ano: number
  mes: number
  tipo: Tipo
  descricao: string
  valor: number
  data: string | null
  conta: Conta
  categoria: Categoria
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

export type Banco = 'nubank' | 'inter' | 'itau'
export type TipoCaixa = 'cc' | 'caixinha' | 'reserva'
export type Caixa = Partial<Record<Banco, Partial<Record<TipoCaixa, number>>>>

export interface Mes {
  ano: number
  mes: number
  investimentos: number
  usd: number
  meta_usd: number
  caixa: Caixa
}

export const BANCOS: Banco[] = ['nubank', 'inter', 'itau']
export const TIPOS_CAIXA: TipoCaixa[] = ['cc', 'caixinha', 'reserva']
