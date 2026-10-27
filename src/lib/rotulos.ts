import { COR_CATEGORIA } from './charts'
import type { Categoria, TipoCaixa } from './types'

export const CATEGORIAS: { id: Categoria; nome: string; cor: string }[] = [
  { id: 'alimentacao', nome: 'Alimentação', cor: COR_CATEGORIA.alimentacao },
  { id: 'transporte', nome: 'Transporte', cor: COR_CATEGORIA.transporte },
  { id: 'divida', nome: 'Dívidas', cor: COR_CATEGORIA.divida },
  { id: 'outros', nome: 'Outros', cor: COR_CATEGORIA.outros },
]
export const NOME_CATEGORIA = Object.fromEntries(CATEGORIAS.map((c) => [c.id, c.nome])) as Record<Categoria, string>

export const NOME_TIPO_CAIXA: Record<TipoCaixa, string> = {
  cc: 'Conta corrente',
  caixinha: 'Caixinha',
  reserva: 'Reserva de emergência',
}

/** Bancos conhecidos e suas cores, para sugerir ao cadastrar e reconhecer "(Next)" nas descrições. */
export const BANCOS_CONHECIDOS: { nome: string; cor: string; apelidos?: string[] }[] = [
  { nome: 'Nubank', cor: '#9b4dde', apelidos: ['nu'] },
  { nome: 'Itaú', cor: '#ec7000', apelidos: ['itau'] },
  { nome: 'Inter', cor: '#ff7a00' },
  { nome: 'Next', cor: '#00d26a' },
  { nome: 'PicPay', cor: '#21c25e' },
  { nome: 'Mercado Pago', cor: '#00b1ea' },
  { nome: 'C6 Bank', cor: '#c8c8c8', apelidos: ['c6'] },
  { nome: 'Bradesco', cor: '#cc092f' },
  { nome: 'Santander', cor: '#ec0000' },
  { nome: 'Caixa', cor: '#1c60ab', apelidos: ['caixa economica'] },
  { nome: 'Banco do Brasil', cor: '#f8d117', apelidos: ['bb'] },
  { nome: 'PagBank', cor: '#00a868', apelidos: ['pagseguro'] },
  { nome: 'Dinheiro', cor: '#92d050', apelidos: ['especie', 'dinheiro vivo'] },
]

/** Cores para bancos que não estão na lista acima. */
export const CORES_LIVRES = ['#4c8dff', '#e040e0', '#00b0f0', '#ffc000', '#ff6b6b', '#2dd4bf', '#a78bfa', '#f97316']

const normal = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

export function bancoConhecido(nome: string) {
  const n = normal(nome)
  return BANCOS_CONHECIDOS.find((b) => normal(b.nome) === n || b.apelidos?.some((a) => normal(a) === n))
}

/** "Comércio de alimentos (Next)" -> "Next". Só reconhece bancos de verdade, não "(mãe)" ou "(irmã)". */
export function bancoNaDescricao(descricao: string, cadastrados: { nome: string }[] = []): string | undefined {
  for (const m of descricao.matchAll(/\(([^)]+)\)/g)) {
    const dentro = normal(m[1])
    const meu = cadastrados.find((b) => normal(b.nome) === dentro)
    if (meu) return meu.nome
    const conhecido = bancoConhecido(dentro)
    if (conhecido) return conhecido.nome
  }
  return undefined
}

export const mesmoNome = (a: string, b: string) => normal(a) === normal(b)
