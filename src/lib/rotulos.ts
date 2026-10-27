import { COR, COR_CATEGORIA } from './charts'
import type { Banco, Categoria, Conta, TipoCaixa } from './types'

export const CATEGORIAS: { id: Categoria; nome: string; cor: string }[] = [
  { id: 'alimentacao', nome: 'Alimentação', cor: COR_CATEGORIA.alimentacao },
  { id: 'transporte', nome: 'Transporte', cor: COR_CATEGORIA.transporte },
  { id: 'divida', nome: 'Dívidas', cor: COR_CATEGORIA.divida },
  { id: 'outros', nome: 'Outros', cor: COR_CATEGORIA.outros },
]
export const NOME_CATEGORIA = Object.fromEntries(CATEGORIAS.map((c) => [c.id, c.nome])) as Record<Categoria, string>

export const CONTAS: { id: Conta; nome: string; cor: string }[] = [
  { id: 'principal', nome: 'Principal', cor: COR.principal },
  { id: 'nubank', nome: 'Nubank', cor: COR.nubank },
  { id: 'inter', nome: 'Inter', cor: COR.inter },
]
export const NOME_CONTA = Object.fromEntries(CONTAS.map((c) => [c.id, c.nome])) as Record<Conta, string>

export const NOME_BANCO: Record<Banco, string> = { nubank: 'Nubank', inter: 'Inter', itau: 'Itaú' }
export const COR_BANCO: Record<Banco, string> = { nubank: COR.nubank, inter: COR.inter, itau: COR.itau }
export const NOME_TIPO_CAIXA: Record<TipoCaixa, string> = {
  cc: 'Conta corrente',
  caixinha: 'Caixinha',
  reserva: 'Reserva de emergência',
}
