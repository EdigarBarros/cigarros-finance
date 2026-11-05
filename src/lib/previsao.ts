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

/** O mês dia a dia: o que já aconteceu e o que ainda vem, em cada dia (para o gráfico do mês na Início). */
export interface DiaADia {
  /** Dias do mês. */
  dias: number
  /** Dia de hoje dentro do mês: 0 se o mês ainda não começou, `dias` se já acabou. */
  hoje: number
  /** Saldo do dia (entrou menos saiu) do que já aconteceu, por dia (índice 0 = dia 1). */
  aconteceu: number[]
  /** Saldo do dia do que ainda vem, por dia. O que já devia ter acontecido e não aconteceu cai no dia de hoje. */
  vem: number[]
  /** Totais do que já aconteceu e do que ainda vem. */
  entrou: number
  saiu: number
  vaiEntrar: number
  vaiSair: number
}

/**
 * Separa o mês pelo dia: lançamento com data depois de hoje (parcela de cartão, conta lançada antes de vencer) ainda não
 * aconteceu, mesmo já estando lançado. Assim o "sobrou até hoje" não conta, no dia 4, as contas do dia 20.
 * Mesma regra de `previsaoDoAno` para fatura em aberto e contas fixas sem a baixa.
 */
export function diaADiaDoMes({ lancs, lancsBaixas = lancs, faturasPagas, comFaturas, contas, ano, mes, taxas, hoje = new Date() }: {
  lancs: Lancamento[]
  lancsBaixas?: Lancamento[]
  faturasPagas: FaturaPaga[]
  comFaturas: boolean
  contas: ContaFixa[]
  ano: number
  mes: number
  taxas: Taxas
  hoje?: Date
}): DiaADia {
  const pagas = new Set(faturasPagas.map((p) => chaveFatura(p.cartao_id, p.ano, p.mes)))
  const iso = hojeLocal(hoje)
  const agora = hoje.getFullYear() * 12 + hoje.getMonth() + 1
  const dias = new Date(ano, mes, 0).getDate()
  const este = ano * 12 + mes
  const diaHoje = este < agora ? dias : este > agora ? 0 : hoje.getDate()
  const aconteceu = Array<number>(dias).fill(0)
  const vem = Array<number>(dias).fill(0)
  let entrou = 0, saiu = 0, vaiEntrar = 0, vaiSair = 0
  // o que ainda vem e já devia ter acontecido fica no dia de hoje (ou no dia 1, se o mês ainda não começou)
  const diaDoQueVem = (d: number) => Math.min(dias, Math.max(d, diaHoje, 1)) - 1
  const diaDe = (data: string | null) => (data && data.slice(0, 7) === `${ano}-${String(mes).padStart(2, '0')}` ? +data.slice(8, 10) : 1)
  for (const l of lancs) {
    if (l.ano !== ano || l.mes !== mes) continue
    const sinal = l.tipo === 'entrada' ? 1 : -1
    const dia = diaDe(l.data)
    const jaFoi = !faturaEmAberto(l, pagas, comFaturas, agora) && (!l.data || l.data <= iso)
    if (jaFoi) {
      aconteceu[dia - 1] += sinal * l.valor
      if (sinal > 0) entrou += l.valor; else saiu += l.valor
    } else {
      vem[diaDoQueVem(dia)] += sinal * l.valor
      if (sinal > 0) vaiEntrar += l.valor; else vaiSair += l.valor
    }
  }
  for (const s of situacoesDoMes(contas, lancsBaixas, ano, mes, iso, taxas)) {
    if (s.estado === 'paga') continue
    const sinal = s.conta.tipo === 'entrada' ? 1 : -1
    vem[diaDoQueVem(s.dia)] += sinal * s.valor
    if (sinal > 0) vaiEntrar += s.valor; else vaiSair += s.valor
  }
  return {
    dias, hoje: diaHoje, aconteceu: aconteceu.map(centavos), vem: vem.map(centavos),
    entrou: centavos(entrou), saiu: centavos(saiu), vaiEntrar: centavos(vaiEntrar), vaiSair: centavos(vaiSair),
  }
}
