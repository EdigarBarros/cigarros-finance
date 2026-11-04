/**
 * O que já aconteceu e o que ainda vem, mês a mês, para os gráficos de fluxo.
 *
 * Já aconteceu: lançamentos de verdade (o que entrou, o que foi pago). Compra no cartão só conta quando a fatura foi paga.
 * Vem aí: a fatura do cartão ainda em aberto e as contas fixas (saída ou recebimento) sem a baixa "Paguei" / "Recebi".
 */
import { hojeLocal, situacoesDoMes } from './contasFixas'
import type { Taxas } from './moedas'
import type { ContaFixa, FaturaPaga, Lancamento } from './types'

export interface PrevisaoMes {
  /** Já entrou (lançamentos de entrada e recebimentos dados). */
  entrou: number
  /** Já saiu (lançamentos de saída, contas pagas e compras de faturas pagas). */
  saiu: number
  /** Ainda vai entrar: contas fixas de recebimento sem a baixa. */
  vaiEntrar: number
  /** Ainda vai sair: fatura de cartão em aberto e contas fixas sem a baixa. */
  vaiSair: number
  /** O mês é depois do mês de hoje. */
  futuro: boolean
}

const centavos = (n: number) => Math.round(n * 100) / 100
const soma = (xs: number[]) => centavos(xs.reduce((a, n) => a + n, 0))
const chaveFatura = (cartao: string, ano: number, mes: number) => `${cartao}|${ano}|${mes}`

/**
 * Compra no cartão cuja fatura ainda não foi paga (só vale com o módulo de cartões ligado). Só conta como "ainda vem" a fatura
 * do mês de hoje em diante: de meses que já passaram o gasto continua valendo como saída, mesmo que a pessoa nunca tenha
 * marcado a fatura como paga (senão o histórico de quem não usa o botão sumiria).
 */
export const faturaEmAberto = (l: Lancamento, pagas: Set<string>, comFaturas: boolean, agora: number) =>
  comFaturas && l.tipo === 'saida' && Boolean(l.cartao_id) && l.ano * 12 + l.mes >= agora && !pagas.has(chaveFatura(l.cartao_id!, l.ano, l.mes))

export function previsaoDoAno({ lancs, lancsBaixas = lancs, faturasPagas, comFaturas, contas, ano, taxas, hoje = new Date() }: {
  /** Lançamentos do ano (já sem as compras de fatura renegociada). */
  lancs: Lancamento[]
  /** Onde procurar a baixa ("Paguei" / "Recebi") das contas fixas: todos os lançamentos, como no resto do app. */
  lancsBaixas?: Lancamento[]
  faturasPagas: FaturaPaga[]
  comFaturas: boolean
  contas: ContaFixa[]
  ano: number
  taxas: Taxas
  hoje?: Date
}): PrevisaoMes[] {
  const pagas = new Set(faturasPagas.map((p) => chaveFatura(p.cartao_id, p.ano, p.mes)))
  const iso = hojeLocal(hoje)
  const agora = hoje.getFullYear() * 12 + hoje.getMonth() + 1
  return Array.from({ length: 12 }, (_, i) => {
    const mes = i + 1
    const doMes = lancs.filter((l) => l.ano === ano && l.mes === mes)
    const emAberto = doMes.filter((l) => faturaEmAberto(l, pagas, comFaturas, agora))
    const feitas = doMes.filter((l) => !emAberto.includes(l))
    const sits = situacoesDoMes(contas, lancsBaixas, ano, mes, iso, taxas).filter((s) => s.estado !== 'paga')
    return {
      entrou: soma(feitas.filter((l) => l.tipo === 'entrada').map((l) => l.valor)),
      saiu: soma(feitas.filter((l) => l.tipo === 'saida').map((l) => l.valor)),
      vaiEntrar: soma(sits.filter((s) => s.conta.tipo === 'entrada').map((s) => s.valor)),
      vaiSair: soma([...emAberto.map((l) => l.valor), ...sits.filter((s) => s.conta.tipo === 'saida').map((s) => s.valor)]),
      futuro: ano * 12 + mes > agora,
    }
  })
}

export const temPrevisao = (p: PrevisaoMes | undefined) => Boolean(p && (p.vaiEntrar > 0 || p.vaiSair > 0))
