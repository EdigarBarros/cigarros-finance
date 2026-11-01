import type { Lancamento, Tipo } from './types'
import { tx } from './textos'

/** Como o dinheiro se moveu. 'credito' não é gravado: é uma compra com `cartao_id`. */
export type FormaPagamento = 'pix' | 'debito' | 'credito' | 'dinheiro' | 'boleto' | 'transferencia'
/** As que ficam na coluna `forma` (migração 11). */
export type FormaGravada = Exclude<FormaPagamento, 'credito'>

/** `id` é o que fica gravado; `nome` é só o rótulo e sai no idioma da pessoa (o idioma é lido uma vez ao abrir, então tx aqui no módulo vale). */
export const FORMAS: { id: FormaPagamento; nome: string; icone: string; cor: string; tipos: Tipo[] }[] = [
  { id: 'pix', nome: 'Pix', icone: 'enviar', cor: '#2bb5a0', tipos: ['saida', 'entrada'] },
  { id: 'debito', nome: tx('Débito'), icone: 'cartao', cor: '#4a8dff', tipos: ['saida'] },
  { id: 'credito', nome: tx('Crédito'), icone: 'cartao', cor: '#9d6bff', tipos: ['saida'] },
  { id: 'dinheiro', nome: tx('Dinheiro'), icone: 'carteira', cor: '#6bbf59', tipos: ['saida', 'entrada'] },
  { id: 'boleto', nome: tx('Boleto'), icone: 'relatorio', cor: '#e0a030', tipos: ['saida'] },
  { id: 'transferencia', nome: tx('Transferência'), icone: 'acordo', cor: '#7a8cff', tipos: ['saida', 'entrada'] },
]

export const formasDoTipo = (t: Tipo) => FORMAS.filter((f) => f.tipos.includes(t))
export const infoForma = (id: FormaPagamento) => FORMAS.find((f) => f.id === id)!

/** Forma do lançamento: a gravada ou, numa compra no cartão, crédito. */
export const formaDe = (l: Pick<Lancamento, 'forma' | 'cartao_id'>): FormaPagamento | null =>
  l.cartao_id ? 'credito' : l.forma ?? null

/** Pix, TED, boleto… escritos na descrição (ou no extrato do banco) já dizem como foi. */
export function formaPelaDescricao(texto: string, tipo: Tipo): FormaGravada | null {
  const t = texto.toLowerCase()
  if (/\bpix\b/.test(t)) return 'pix'
  if (/\b(ted|doc|transf(er[eê]ncia)?)\b/.test(t)) return 'transferencia'
  if (/\bboleto\b/.test(t) && tipo === 'saida') return 'boleto'
  if (/\bd[eé]bito\b/.test(t) && tipo === 'saida') return 'debito'
  return null
}
