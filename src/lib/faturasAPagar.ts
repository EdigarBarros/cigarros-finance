import { situacoesDoMes, type Fatura } from './cartoes'
import type { CartaoCredito, FaturaPaga, FaturaParcial, Lancamento } from './types'
import { tx } from './textos'

/** Uma fatura de cartão que ainda tem o que pagar: aparece em Dívidas, no "Isso paga…" das saídas e no Planejamento. */
export interface FaturaAPagar { cartao: CartaoCredito; f: Fatura; chave: string }

export const chaveDaFatura = (cartaoId: string, ano: number, mes: number) => `${cartaoId}|${ano}-${String(mes).padStart(2, '0')}`

/**
 * As faturas a pagar de hoje, em todos os cartões ativos: as atrasadas e a do mês; com a do mês já paga (ou vazia), a
 * próxima, a que está correndo, que dá para pagar adiantado. Paga, renegociada ou sem nada faltando fica de fora. Contada pelo mesmo cálculo da tela Cartões
 * (pagamentos de parte descontados), então as telas sempre batem.
 */
export function faturasAPagar(
  cartoes: CartaoCredito[], compras: Lancamento[], pagas: FaturaPaga[], parciais: FaturaParcial[], hoje: string,
): FaturaAPagar[] {
  const [ano, mes] = hoje.split('-').map(Number)
  const lista: FaturaAPagar[] = []
  const aberta = (f: Fatura) => !f.paga && f.falta >= 0.01
  for (const s of situacoesDoMes(cartoes, compras, pagas, ano, mes, hoje, undefined, parciais)) {
    const doCartao = [...s.atrasadas, aberta(s) ? s : s.proximas[0]].filter((f): f is Fatura => Boolean(f) && aberta(f))
    for (const f of doCartao) {
      const chave = chaveDaFatura(s.cartao.id, f.ano, f.mes)
      if (!lista.some((x) => x.chave === chave)) lista.push({ cartao: s.cartao, f, chave })
    }
  }
  return lista.sort((a, b) => a.f.vencimento.localeCompare(b.f.vencimento) || a.cartao.nome.localeCompare(b.cartao.nome))
}

/** A fatura de uma conta do Planejamento (a agenda chama de "Fatura do <cartão>", no vencimento): a chave dela, ou null. */
export function faturaDoDestino(lista: FaturaAPagar[], d: { nome: string; vence: string | null; origem?: string }): string | null {
  if (d.origem !== 'cartao' || !d.vence) return null
  return lista.find((x) => x.f.vencimento === d.vence && tx('Fatura do {0}', x.cartao.nome) === d.nome)?.chave ?? null
}
