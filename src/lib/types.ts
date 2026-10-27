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
  created_at?: string
}

export interface Divida {
  id: string
  ano: number
  mes: number
  descricao: string
  valor_mensal: number
  parcelas: number
  pagas: number
  ordem: number
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
