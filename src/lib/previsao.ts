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

/** De onde vem um valor que ainda vai entrar ou sair no mês. */
export type OrigemPrevista = 'lancamento' | 'fatura' | 'conta' | 'parcela'

/** Uma linha do que ainda vem no mês (o "Entender previsão" mostra a lista; a soma é o vaiEntrar / vaiSair). */
export interface ItemPrevisto {
  origem: OrigemPrevista
  tipo: 'entrada' | 'saida'
  descricao: string
  valor: number
  /** AAAA-MM-DD do vencimento (ou da data do lançamento); null num lançamento sem data. */
  data: string | null
  /** Já devia ter acontecido (venceu antes de hoje) e continua em aberto. */
  atrasado: boolean
  /** Compra no cartão: o cartão (as compras da mesma fatura aparecem juntas). */
  cartaoId?: string
}

/** O mês dia a dia: o que já aconteceu e o que ainda vem, em cada dia (para o gráfico do mês na Início). */
export interface DiaADia {
  /** Dias do mês. */
  dias: number
  /** Dia de hoje dentro do mês: 0 se o mês ainda não começou, `dias` se já acabou. */
  hoje: number
  /** Por dia (índice 0 = dia 1): o que já entrou e já saiu. */
  entrouDia: number[]
  saiuDia: number[]
  /** Por dia: o que ainda vai entrar e sair. O que já devia ter acontecido e não aconteceu cai no dia de hoje. */
  vaiEntrarDia: number[]
  vaiSairDia: number[]
  /** Totais do que já aconteceu e do que ainda vem. */
  entrou: number
  saiu: number
  vaiEntrar: number
  vaiSair: number
  /** Cada coisa que ainda vem, com nome e valor (soma = vaiEntrar + vaiSair). */
  pendentes: ItemPrevisto[]
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
  const zeros = () => Array<number>(dias).fill(0)
  const entrouDia = zeros(), saiuDia = zeros(), vaiEntrarDia = zeros(), vaiSairDia = zeros()
  let entrou = 0, saiu = 0, vaiEntrar = 0, vaiSair = 0
  const pendentes: ItemPrevisto[] = []
  // o que ainda vem e já devia ter acontecido fica no dia de hoje (ou no dia 1, se o mês ainda não começou)
  const diaDoQueVem = (d: number) => Math.min(dias, Math.max(d, diaHoje, 1)) - 1
  const diaDe = (data: string | null) => (data && data.slice(0, 7) === `${ano}-${String(mes).padStart(2, '0')}` ? +data.slice(8, 10) : 1)
  for (const l of lancs) {
    if (l.ano !== ano || l.mes !== mes) continue
    const sinal = l.tipo === 'entrada' ? 1 : -1
    const dia = diaDe(l.data)
    const jaFoi = !faturaEmAberto(l, pagas, comFaturas, agora) && (!l.data || l.data <= iso)
    if (jaFoi) {
      if (sinal > 0) { entrou += l.valor; entrouDia[dia - 1] += l.valor } else { saiu += l.valor; saiuDia[dia - 1] += l.valor }
    } else {
      const d = diaDoQueVem(dia)
      if (sinal > 0) { vaiEntrar += l.valor; vaiEntrarDia[d] += l.valor } else { vaiSair += l.valor; vaiSairDia[d] += l.valor }
      const naFatura = faturaEmAberto(l, pagas, comFaturas, agora)
      pendentes.push({
        origem: naFatura ? 'fatura' : 'lancamento', tipo: l.tipo, descricao: l.descricao, valor: l.valor, data: l.data,
        atrasado: Boolean(l.data && l.data < iso), cartaoId: naFatura ? l.cartao_id ?? undefined : undefined,
      })
    }
  }
  for (const s of situacoesDoMes(contas, lancsBaixas, ano, mes, iso, taxas)) {
    if (s.estado === 'paga') continue
    const sinal = s.conta.tipo === 'entrada' ? 1 : -1
    const d = diaDoQueVem(s.dia)
    if (sinal > 0) { vaiEntrar += s.valor; vaiEntrarDia[d] += s.valor } else { vaiSair += s.valor; vaiSairDia[d] += s.valor }
    pendentes.push({ origem: 'conta', tipo: s.conta.tipo, descricao: s.conta.descricao, valor: s.valor, data: s.vencimento, atrasado: s.estado === 'atrasada' })
  }
  return {
    dias, hoje: diaHoje,
    entrouDia: entrouDia.map(centavos), saiuDia: saiuDia.map(centavos), vaiEntrarDia: vaiEntrarDia.map(centavos), vaiSairDia: vaiSairDia.map(centavos),
    entrou: centavos(entrou), saiu: centavos(saiu), vaiEntrar: centavos(vaiEntrar), vaiSair: centavos(vaiSair),
    pendentes,
  }
}

/** Um grupo da composição: as contas do mês, a fatura de um cartão, as parcelas de dívida ou os lançamentos com data à frente. */
export interface GrupoPrevisto {
  chave: string
  origem: OrigemPrevista
  cartaoId?: string
  itens: ItemPrevisto[]
  total: number
}

export interface ComposicaoDaPrevisao {
  /** O ponto de partida: o que já entrou menos o que já saiu no mês (não é o saldo do banco). */
  referencia: number
  entrou: number
  saiu: number
  receber: GrupoPrevisto[]
  pagar: GrupoPrevisto[]
  totalReceber: number
  totalPagar: number
  /** referencia + totalReceber − totalPagar */
  resultado: number
  /** Do que ainda vai entrar, quanto já devia ter entrado (a previsão conta com ele). */
  receberAtrasado: number
  /** Do que ainda vai sair, quanto já venceu. */
  pagarAtrasado: number
}

const ORDEM_DAS_ORIGENS: OrigemPrevista[] = ['conta', 'fatura', 'parcela', 'lancamento']

/**
 * Como o app chega no "Deve sobrar / Pode faltar": parte do que já entrou menos o que já saiu, soma o que ainda vai entrar e
 * tira o que ainda vai sair. Cada valor aparece uma vez só: o que já aconteceu está em `entrou`/`saiu`; o que ainda vem está
 * em `pendentes` (conta paga não fica pendente; compra no cartão fica na fatura até ela ser paga).
 */
export function comporPrevisao(dd: Pick<DiaADia, 'entrou' | 'saiu' | 'pendentes'>): ComposicaoDaPrevisao {
  const agrupar = (tipo: 'entrada' | 'saida') => {
    const grupos = new Map<string, GrupoPrevisto>()
    for (const i of dd.pendentes) {
      if (i.tipo !== tipo) continue
      const chave = i.origem === 'fatura' ? `fatura:${i.cartaoId ?? ''}` : i.origem
      const g = grupos.get(chave) ?? grupos.set(chave, { chave, origem: i.origem, cartaoId: i.cartaoId, itens: [], total: 0 }).get(chave)!
      g.itens.push(i)
      g.total += i.valor
    }
    return [...grupos.values()]
      .map((g) => ({ ...g, total: centavos(g.total), itens: [...g.itens].sort((a, b) => (a.data ?? '').localeCompare(b.data ?? '') || b.valor - a.valor) }))
      .sort((a, b) => ORDEM_DAS_ORIGENS.indexOf(a.origem) - ORDEM_DAS_ORIGENS.indexOf(b.origem) || b.total - a.total)
  }
  const receber = agrupar('entrada')
  const pagar = agrupar('saida')
  const totalReceber = soma(receber.map((g) => g.total))
  const totalPagar = soma(pagar.map((g) => g.total))
  const referencia = centavos(dd.entrou - dd.saiu)
  return {
    referencia, entrou: dd.entrou, saiu: dd.saiu, receber, pagar, totalReceber, totalPagar,
    resultado: centavos(referencia + totalReceber - totalPagar),
    receberAtrasado: soma(dd.pendentes.filter((i) => i.tipo === 'entrada' && i.atrasado).map((i) => i.valor)),
    pagarAtrasado: soma(dd.pendentes.filter((i) => i.tipo === 'saida' && i.atrasado).map((i) => i.valor)),
  }
}
