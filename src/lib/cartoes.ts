/**
 * Cartão de crédito: em que fatura cai cada compra, divisão em parcelas e situação de cada cartão.
 *
 * Modelo: cada parcela é uma saída (lançamento) com `data` no dia do vencimento da fatura em que cai.
 * Uma fatura é identificada pelo mês e ano do vencimento. Tudo aqui é puro (sem tela nem banco).
 */
import { semAcento } from './busca'
import { fmtValor, MESES_NOME, noMeioDaFrase } from './format'
import type { EfeitoDatado } from './guardado'
import type { CartaoCredito, FaturaPaga, FaturaParcial, Lancamento } from './types'
import { tx } from './textos'

export type DiasCartao = Pick<CartaoCredito, 'dia_fechamento' | 'dia_vencimento'>
export interface MesFatura { ano: number; mes: number }

const dois = (n: number) => String(n).padStart(2, '0')
const iso = (ano: number, mes: number, dia: number) => `${ano}-${dois(mes)}-${dois(dia)}`
const partes = (data: string) => data.split('-').map(Number) as [number, number, number]
const centavos = (n: number) => Math.round(n * 100) / 100
const soma = (xs: number[]) => centavos(xs.reduce((a, b) => a + b, 0))

/** Número que cresce de mês em mês (para comparar e somar meses). */
export const chaveMes = (ano: number, mes: number) => ano * 12 + mes - 1
export const doMesChave = (k: number): MesFatura => ({ ano: Math.floor(k / 12), mes: (k % 12) + 1 })
export const somaMeses = (m: MesFatura, n: number): MesFatura => doMesChave(chaveMes(m.ano, m.mes) + n)

export const diasNoMes = (ano: number, mes: number) => new Date(Date.UTC(ano, mes, 0)).getUTCDate()
/** Dia 31 em mês de 30 dias (ou fevereiro) vira o último dia do mês. */
const diaNoMes = (dia: number, ano: number, mes: number) => Math.min(dia, diasNoMes(ano, mes))

/** Hoje como "2026-10-27", pela data local (não a UTC, que vira o dia mais cedo à noite). */
export const hojeLocal = (d = new Date()) => iso(d.getFullYear(), d.getMonth() + 1, d.getDate())

const diasEntre = (de: string, ate: string) => {
  const [a1, m1, d1] = partes(de)
  const [a2, m2, d2] = partes(ate)
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86400000)
}

/**
 * Quando a fatura que vence em (ano, mês) fecha e vence.
 * Vence no mês seguinte ao fechamento quando o dia do vencimento é menor ou igual ao do fechamento
 * (fecha dia 25, vence dia 5: a fatura que vence em novembro fechou em outubro).
 */
export function datasDaFatura(c: DiasCartao, ano: number, mes: number) {
  const fecha = c.dia_vencimento <= c.dia_fechamento ? somaMeses({ ano, mes }, -1) : { ano, mes }
  return {
    fechamento: iso(fecha.ano, fecha.mes, diaNoMes(c.dia_fechamento, fecha.ano, fecha.mes)),
    vencimento: iso(ano, mes, diaNoMes(c.dia_vencimento, ano, mes)),
  }
}

/**
 * Em que fatura cai uma compra feita nesta data. Compra até o dia do fechamento entra na fatura que fecha
 * neste mês; depois dele, na do mês seguinte. Devolve o mês do vencimento (que identifica a fatura).
 */
export function faturaDaCompra(data: string, c: DiasCartao) {
  const [ano, mes, dia] = partes(data)
  const fecha = dia <= diaNoMes(c.dia_fechamento, ano, mes) ? { ano, mes } : somaMeses({ ano, mes }, 1)
  const venc = c.dia_vencimento <= c.dia_fechamento ? somaMeses(fecha, 1) : fecha
  return { ano: venc.ano, mes: venc.mes, ...datasDaFatura(c, venc.ano, venc.mes) }
}

/** Divide o valor em N partes em centavos, sem perder nem sobrar nenhum: a diferença vai na primeira parcela. */
export function dividirEmParcelas(valor: number, n: number): number[] {
  const total = Math.round(valor * 100)
  const base = Math.floor(total / n)
  const resto = total - base * n
  return Array.from({ length: n }, (_, i) => (i === 0 ? base + resto : base) / 100)
}

export interface ParcelaGerada {
  parcela: number
  parcelas: number
  /** Mês e ano do vencimento da fatura em que cai. */
  ano: number
  mes: number
  /** Dia do vencimento daquela fatura. */
  data: string
  valor: number
}

/** As N parcelas de uma compra: a primeira na fatura que a compra cai e as outras uma por mês. */
export function gerarParcelas(valor: number, n: number, dataCompra: string, c: DiasCartao): ParcelaGerada[] {
  const primeira = faturaDaCompra(dataCompra, c)
  return dividirEmParcelas(valor, n).map((v, i) => {
    const m = somaMeses(primeira, i)
    return { parcela: i + 1, parcelas: n, ano: m.ano, mes: m.mes, data: iso(m.ano, m.mes, diaNoMes(c.dia_vencimento, m.ano, m.mes)), valor: v }
  })
}

// ---------- situação de cada cartão ----------

/**
 * futura: ainda não abriu · aberta: recebendo compras · fechada: esperando o vencimento · atrasada: venceu sem ser
 * marcada como paga · renegociada: virou uma dívida em parcelas com o banco
 */
export type StatusFatura = 'futura' | 'aberta' | 'fechada' | 'paga' | 'atrasada' | 'renegociada'

export const ROTULO_STATUS: Record<StatusFatura, string> = {
  futura: tx('Ainda não abriu'), aberta: tx('Aberta'), fechada: tx('Fechada'), paga: tx('Paga'), atrasada: tx('Venceu'), renegociada: tx('Renegociada'),
}

/** Fatura resolvida por renegociação (sem a migração 9 toda fatura marcada é paga). */
export const renegociada = (p: Pick<FaturaPaga, 'tipo'> | null | undefined) => p?.tipo === 'renegociada'
/** Paga depois do dia do vencimento. */
export const pagaComAtraso = (p: Pick<FaturaPaga, 'pago_em' | 'tipo'> | null | undefined, vencimento: string) =>
  Boolean(p && !renegociada(p) && p.pago_em > vencimento)

const chaveFatura = (cartao_id: string, ano: number, mes: number) => `${cartao_id}|${ano}|${mes}`
/** Compra que outra pessoa paga (a assinatura da mãe no seu cartão): está na fatura, mas o gasto não é seu. */
export const ehDeOutraPessoa = (l: Pick<Lancamento, 'pago_por'>) => Boolean(l.pago_por?.trim())

/**
 * Compras de faturas renegociadas não contam nas saídas: a fatura virou uma dívida, e o que sai do bolso passa a ser
 * cada parcela paga dela (senão o mesmo gasto contaria duas vezes). Compra que outra pessoa paga também não: o dinheiro
 * dela cobre a compra, e nem o gasto nem o que ela te passa são seus. Devolve o teste para filtrar os lançamentos.
 */
export function contaNasSaidas(pagas: FaturaPaga[]) {
  const fora = new Set(pagas.filter(renegociada).map((p) => chaveFatura(p.cartao_id, p.ano, p.mes)))
  return (l: Lancamento) => !ehDeOutraPessoa(l) && (!fora.size || !l.cartao_id || !fora.has(chaveFatura(l.cartao_id, l.ano, l.mes)))
}

export interface Fatura {
  ano: number
  mes: number
  valor: number
  fechamento: string
  vencimento: string
  status: StatusFatura
  paga: FaturaPaga | null
  /** Parcelas que compõem a fatura, da compra mais antiga para a mais nova. */
  compras: Lancamento[]
  /** Pagamentos de parte da fatura (migração 38), do mais antigo para o mais novo. */
  parciais: FaturaParcial[]
  /** Soma dos pagamentos de parte. */
  pagoEmParte: number
  /** Quanto ainda falta pagar: o valor menos o que já foi pago em parte (0 quando paga ou renegociada). */
  falta: number
  /** Compras que estavam nesta fatura e foram puladas para uma seguinte ("pula compra" do banco). */
  puladas: Lancamento[]
  /** Parte da fatura que outras pessoas pagam, por pessoa (a maior primeiro). Está no valor, mas não é gasto seu. */
  deOutros: { nome: string; valor: number }[]
}

/** Compra parcelada que ainda tem parcelas pela frente. */
export interface CompraParcelada {
  compra_id: string
  descricao: string
  categoria_id: string | null
  /** Parcela do mês aberto (ou a próxima, se este mês não tiver). */
  atual: number
  parcelas: number
  valorParcela: number
  /** Parcelas daqui em diante, contando a atual. */
  restantes: number
  valorRestante: number
  termina: MesFatura
}

export interface SituacaoCartao extends Fatura {
  cartao: CartaoCredito
  /** Dias até o vencimento (negativo = já venceu). */
  diasParaVencer: number
  /** Soma das parcelas ainda não pagas, do mês atual em diante. */
  limiteUsado: number
  /** null quando o cartão não tem limite informado. */
  limiteDisponivel: number | null
  /** Limite do banco mais o garantido (null sem limite). */
  limiteTotal: number | null
  /** Parte do limite que vem da caixinha (limite garantido). */
  garantido: number
  /** Faturas de meses anteriores que venceram e não foram pagas nem renegociadas. */
  atrasadas: Fatura[]
  /** As 6 faturas seguintes. */
  proximas: Fatura[]
  parceladas: CompraParcelada[]
}

/** Compra no cartão de crédito (cada parcela é uma saída com `cartao_id`): fica na tela Cartões, não em Lançamentos. */
export const ehCompraNoCartao = (l: Pick<Lancamento, 'cartao_id' | 'tipo'>) => Boolean(l.cartao_id) && l.tipo === 'saida'
/** Uma compra pode ter várias parcelas (uma saída cada): a chave junta as parcelas da mesma compra. */
export const chaveDaCompra = (l: Pick<Lancamento, 'id' | 'compra_id'>) => l.compra_id ?? l.id
/**
 * Se a busca do topo acha esta compra no cartão. Usada pelas telas Lançamentos (a faixa que avisa) e Cartões (os resultados),
 * para as duas contarem as mesmas compras. A data buscada é o dia da compra, não o vencimento da fatura.
 */
export function casaCompraNoCartao(
  casa: (l: Lancamento, texto: string) => boolean, l: Lancamento, categoria?: string, cartao?: string,
) {
  const texto = semAcento([
    l.descricao, categoria, cartao ? `cartao ${cartao}` : 'cartao', 'credito', tx('saida saidas gasto'), (l.parcelas ?? 1) > 1 ? tx('parcela parcelado') : '',
  ].filter(Boolean).join(' '))
  return casa({ ...l, data: l.data_compra ?? l.data }, texto)
}
const doCartao = (c: CartaoCredito, lancs: Lancamento[]) => lancs.filter((l) => l.cartao_id === c.id && l.tipo === 'saida')
const dataDaCompra = (l: Lancamento) => l.data_compra ?? l.data ?? ''

function statusDaFatura(falta: number, paga: FaturaPaga | null, fechAnterior: string, fech: string, venc: string, hoje: string): StatusFatura {
  if (paga) return renegociada(paga) ? 'renegociada' : 'paga'
  if (hoje <= fechAnterior) return 'futura'
  if (hoje <= fech) return 'aberta'
  // fatura vazia (ou já coberta pelos pagamentos de parte) que venceu não está "atrasada": não há nada a pagar
  return hoje <= venc || falta <= 0 ? 'fechada' : 'atrasada'
}

/** Os pagamentos de parte de uma fatura, do mais antigo para o mais novo. */
export const parciaisDaFatura = (parciais: FaturaParcial[], cartao_id: string, ano: number, mes: number) =>
  parciais.filter((p) => p.cartao_id === cartao_id && p.ano === ano && p.mes === mes).sort((a, b) => a.pago_em.localeCompare(b.pago_em))

/**
 * A fatura de um cartão num mês. `lancs` pode ter lançamentos de qualquer cartão e até os sem cartão; `parciais`, os
 * pagamentos de parte de qualquer fatura.
 */
export function faturaDoMes(
  c: CartaoCredito, lancs: Lancamento[], pagas: FaturaPaga[], ano: number, mes: number, hoje = hojeLocal(), parciais: FaturaParcial[] = [],
): Fatura {
  const doC = doCartao(c, lancs)
  const compras = doC
    .filter((l) => l.ano === ano && l.mes === mes)
    .sort((a, b) => dataDaCompra(a).localeCompare(dataDaCompra(b)) || (a.parcela ?? 0) - (b.parcela ?? 0))
  const valor = soma(compras.map((l) => l.valor))
  const { fechamento, vencimento } = datasDaFatura(c, ano, mes)
  const anterior = somaMeses({ ano, mes }, -1)
  const paga = pagas.find((p) => p.cartao_id === c.id && p.ano === ano && p.mes === mes) ?? null
  const destas = parciaisDaFatura(parciais, c.id, ano, mes)
  const pagoEmParte = soma(destas.map((p) => p.valor))
  const falta = paga ? 0 : centavos(Math.max(0, valor - pagoEmParte))
  const puladas = doC.filter((l) => l.pulada_de && mesDaData(l.pulada_de, ano, mes) && !(l.ano === ano && l.mes === mes))
  const porPessoa = new Map<string, number>()
  for (const l of compras) if (ehDeOutraPessoa(l)) porPessoa.set(l.pago_por!.trim(), (porPessoa.get(l.pago_por!.trim()) ?? 0) + l.valor)
  const deOutros = [...porPessoa].map(([nome, v]) => ({ nome, valor: centavos(v) })).sort((a, b) => b.valor - a.valor)
  return {
    ano, mes, valor, fechamento, vencimento, paga, compras, parciais: destas, pagoEmParte, falta, puladas, deOutros,
    status: statusDaFatura(falta, paga, datasDaFatura(c, anterior.ano, anterior.mes).fechamento, fechamento, vencimento, hoje),
  }
}

// ---------- pular uma compra para a próxima fatura ----------

/** A data (AAAA-MM-DD) cai no mês e ano dados. */
const mesDaData = (data: string, ano: number, mes: number) => {
  const [a, m] = partes(data)
  return a === ano && m === mes
}

/**
 * Pular a parcela para a fatura seguinte ("pula compra" do PicPay e de outros bancos): vai para o mês seguinte, no dia do
 * vencimento daquela fatura. `pulada_de` guarda onde ela estava da primeira vez, para desfazer de uma vez só.
 */
export function pularParcela(l: Pick<Lancamento, 'ano' | 'mes' | 'data' | 'pulada_de'>, c: DiasCartao) {
  const prox = somaMeses({ ano: l.ano, mes: l.mes }, 1)
  return {
    ano: prox.ano, mes: prox.mes, data: datasDaFatura(c, prox.ano, prox.mes).vencimento,
    pulada_de: l.pulada_de ?? datasDaFatura(c, l.ano, l.mes).vencimento,
  }
}

/** Desfaz o pulo: a parcela volta para a fatura em que estava antes (null se ela não foi pulada). */
export function voltarParcela(l: Pick<Lancamento, 'pulada_de'>) {
  if (!l.pulada_de) return null
  const [ano, mes] = partes(l.pulada_de)
  return { ano, mes, data: l.pulada_de, pulada_de: null }
}

// ---------- pagar com o cofrinho (a caixinha do banco) ----------

type PagamentoDaCaixinha = Pick<FaturaParcial, 'valor' | 'pago_em' | 'banco_id'> & Partial<Pick<FaturaParcial, 'da_caixinha' | 'saldo_mexido'>>

/**
 * O que um pagamento feito com o cofrinho faz em Dinheiro guardado: tira o valor da caixinha do banco, no mês do pagamento
 * (`sinal` -1 desfaz, devolvendo). Vazio quando o dinheiro não saiu da caixinha ou o app não mexeu no saldo (`saldo_mexido`).
 * Com o limite garantido ligado à caixinha, o limite do cartão diminui junto, como no banco.
 */
export function efeitoNaCaixinha(p: PagamentoDaCaixinha | null | undefined, sinal: 1 | -1 = 1): EfeitoDatado[] {
  if (!p?.da_caixinha || !p.saldo_mexido || !p.banco_id || !(p.valor > 0)) return []
  const [ano, mes] = partes(p.pago_em)
  return [{ ano, mes, efeitos: [{ banco: p.banco_id, tipo: 'caixinha', delta: centavos(-p.valor * sinal) }] }]
}

/** Taxa que o banco cobrou para pular: uma compra à vista no cartão, na fatura seguinte à de `de`. */
export function taxaParaPular(c: CartaoCredito, de: MesFatura, valor: number, hoje = hojeLocal()): Omit<Lancamento, 'id'> {
  const prox = somaMeses(de, 1)
  return {
    ano: prox.ano, mes: prox.mes, tipo: 'saida', valor: centavos(valor),
    descricao: tx('Taxa para pular compra – fatura de {0}', nomeDaFatura(de.ano, de.mes)),
    data: datasDaFatura(c, prox.ano, prox.mes).vencimento, data_compra: hoje,
    cartao_id: c.id, parcela: 1, parcelas: 1, banco_id: null, divida_id: null,
  }
}

/** Limite garantido do cartão: o valor fixo ou, com `garantia_caixinha`, o que veio de `caixinha` (a caixinha do banco). */
export const garantidoDo = (c: CartaoCredito, caixinha?: number) =>
  centavos(Math.max(0, c.garantia_caixinha ? caixinha ?? 0 : c.limite_garantido ?? 0))

/**
 * Limite usado e disponível: o que ainda falta pagar, das faturas do mês atual em diante e das anteriores ainda não pagas,
 * fechadas ou vencidas (o banco só devolve o limite quando a fatura é paga; sem elas, o "livre" aparecia maior que o real). O limite
 * total é o do banco mais o garantido (dinheiro na caixinha que vira limite); sem nenhum dos dois, não há limite.
 */
export function limiteDoCartao(
  c: CartaoCredito, lancs: Lancamento[], pagas: FaturaPaga[], hoje = hojeLocal(), garantido = garantidoDo(c), parciais: FaturaParcial[] = [],
) {
  const [ha, hm] = partes(hoje)
  const agora = chaveMes(ha, hm)
  const naoPaga = (ano: number, mes: number) => !pagas.some((p) => p.cartao_id === c.id && p.ano === ano && p.mes === mes)
  const daqui = soma(
    doCartao(c, lancs)
      .filter((l) => chaveMes(l.ano, l.mes) >= agora && naoPaga(l.ano, l.mes))
      .map((l) => l.valor),
  )
  // o que já foi pago em parte das faturas daqui em diante devolve o limite (como no banco)
  const pagoDaqui = soma(parciais.filter((p) => p.cartao_id === c.id && chaveMes(p.ano, p.mes) >= agora && naoPaga(p.ano, p.mes)).map((p) => p.valor))
  // de meses anteriores: a fatura fechada que ainda vai vencer e a que venceu sem pagar (as mesmas do "Em atraso")
  const anteriores = new Set(doCartao(c, lancs).map((l) => chaveMes(l.ano, l.mes)).filter((k) => k < agora && k >= agora - 12))
  const naoPagas = [...anteriores].map(doMesChave).map((m) => faturaDoMes(c, lancs, pagas, m.ano, m.mes, hoje, parciais))
    .filter((f) => f.status === 'fechada' || f.status === 'atrasada')
  const usado = centavos(Math.max(0, daqui - pagoDaqui) + soma(naoPagas.map((f) => f.falta)))
  const total = c.limite == null && !garantido ? null : centavos((c.limite ?? 0) + garantido)
  return { usado, total, garantido, disponivel: total == null ? null : centavos(total - usado) }
}

/** Compras parceladas que ainda têm parcelas a partir do mês de referência. */
export function comprasParceladas(c: CartaoCredito, lancs: Lancamento[], ano: number, mes: number): CompraParcelada[] {
  const ref = chaveMes(ano, mes)
  const grupos = new Map<string, Lancamento[]>()
  for (const l of doCartao(c, lancs)) {
    if (l.compra_id && (l.parcelas ?? 1) > 1) grupos.set(l.compra_id, [...(grupos.get(l.compra_id) ?? []), l])
  }
  const lista: CompraParcelada[] = []
  for (const [compra_id, ps] of grupos) {
    const daqui = ps.filter((l) => chaveMes(l.ano, l.mes) >= ref).sort((a, b) => chaveMes(a.ano, a.mes) - chaveMes(b.ano, b.mes))
    if (!daqui.length) continue
    const ultima = daqui[daqui.length - 1]
    lista.push({
      compra_id,
      descricao: daqui[0].descricao,
      categoria_id: daqui[0].categoria_id ?? null,
      atual: daqui[0].parcela ?? 1,
      parcelas: daqui[0].parcelas ?? ps.length,
      valorParcela: daqui[0].valor,
      restantes: daqui.length,
      valorRestante: soma(daqui.map((l) => l.valor)),
      termina: { ano: ultima.ano, mes: ultima.mes },
    })
  }
  // as que acabam antes aparecem primeiro
  return lista.sort((a, b) => chaveMes(a.termina.ano, a.termina.mes) - chaveMes(b.termina.ano, b.termina.mes) || a.descricao.localeCompare(b.descricao))
}

/** Tudo sobre um cartão no mês: a fatura, o limite, as próximas faturas e as compras parceladas. */
export function situacaoCartao(
  c: CartaoCredito, lancs: Lancamento[], pagas: FaturaPaga[], ano: number, mes: number, hoje = hojeLocal(), garantido = garantidoDo(c),
  parciais: FaturaParcial[] = [],
): SituacaoCartao {
  const f = faturaDoMes(c, lancs, pagas, ano, mes, hoje, parciais)
  const limite = limiteDoCartao(c, lancs, pagas, hoje, garantido, parciais)
  return {
    ...f,
    cartao: c,
    diasParaVencer: diasEntre(hoje, f.vencimento),
    limiteUsado: limite.usado,
    limiteDisponivel: limite.disponivel,
    limiteTotal: limite.total,
    garantido: limite.garantido,
    atrasadas: faturasAtrasadas(c, lancs, pagas, ano, mes, hoje, parciais),
    proximas: [1, 2, 3, 4, 5, 6].map((i) => {
      const m = somaMeses({ ano, mes }, i)
      return faturaDoMes(c, lancs, pagas, m.ano, m.mes, hoje, parciais)
    }),
    parceladas: comprasParceladas(c, lancs, ano, mes),
  }
}

/**
 * Faturas dos 12 meses antes do de referência que venceram com valor e ficaram sem pagar (as mais antigas primeiro).
 * Mais para trás que isso fica de fora: é quase sempre fatura paga que só não foi marcada.
 */
export function faturasAtrasadas(
  c: CartaoCredito, lancs: Lancamento[], pagas: FaturaPaga[], ano: number, mes: number, hoje = hojeLocal(), parciais: FaturaParcial[] = [],
): Fatura[] {
  const ref = chaveMes(ano, mes)
  const meses = new Set(doCartao(c, lancs).map((l) => chaveMes(l.ano, l.mes)).filter((k) => k < ref && k >= ref - 12))
  return [...meses].sort((a, b) => a - b)
    .map((k) => doMesChave(k))
    .map((m) => faturaDoMes(c, lancs, pagas, m.ano, m.mes, hoje, parciais))
    .filter((f) => f.status === 'atrasada')
}

/**
 * Situação de cada cartão ativo no mês. `garantidoDe` dá o limite garantido de cada cartão quando ele vem da caixinha
 * do banco (sem ela, vale o valor fixo do cartão).
 */
export const situacoesDoMes = (
  cartoes: CartaoCredito[], lancs: Lancamento[], pagas: FaturaPaga[], ano: number, mes: number, hoje = hojeLocal(),
  garantidoDe: (c: CartaoCredito) => number = (c) => garantidoDo(c), parciais: FaturaParcial[] = [],
) => cartoes.filter((c) => c.ativo).map((c) => situacaoCartao(c, lancs, pagas, ano, mes, hoje, garantidoDe(c), parciais))

/**
 * Para um indicador: quanto vence de fatura no mês, somando todos os cartões (paga ou não). Fatura renegociada fica
 * de fora: virou dívida e não vence mais como fatura (as compras dela também saíram das saídas do mês).
 */
export const totalFaturasDoMes = (situacoes: Pick<SituacaoCartao, 'valor' | 'status'>[]) =>
  soma(situacoes.filter((s) => s.status !== 'renegociada').map((s) => s.valor))
/** Quanto das faturas do mês ainda falta pagar (o que já foi pago em parte fica de fora). */
export const totalFaturasAPagar = (situacoes: Pick<SituacaoCartao, 'falta' | 'status'>[]) =>
  soma(situacoes.filter((s) => s.status !== 'paga' && s.status !== 'renegociada').map((s) => s.falta))

/** "vence hoje", "vence em 9 dias", "venceu há 3 dias"… */
export function quandoVence(s: Pick<SituacaoCartao, 'status' | 'diasParaVencer'>) {
  if (s.status === 'paga') return 'paga'
  if (s.status === 'renegociada') return 'renegociada'
  const d = s.diasParaVencer
  if (d === 0) return tx('vence hoje')
  if (d === 1) return tx('vence amanhã')
  if (d > 1) return tx('vence em {0} dias', d)
  return d === -1 ? tx('venceu ontem') : tx('venceu há {0} dias', -d)
}

/** "novembro" (ou "novembro/2027" quando não é o ano de referência). */
export const nomeDaFatura = (ano: number, mes: number, anoRef = ano) =>
  noMeioDaFrase(MESES_NOME[mes - 1]) + (ano === anoRef ? '' : `/${ano}`)

/** "12x de R$ 83,33 · primeira na fatura de novembro" — o que a pessoa vê antes de salvar a compra. */
export function textoParcelamento(ps: ParcelaGerada[], anoCompra: number) {
  if (!ps.length) return ''
  const primeira = tx('primeira na fatura de {0}', nomeDaFatura(ps[0].ano, ps[0].mes, anoCompra))
  if (ps.length === 1) return tx('{0} à vista no cartão · na fatura de {1}', fmtValor(ps[0].valor), nomeDaFatura(ps[0].ano, ps[0].mes, anoCompra))
  const resto = ps[1].valor
  // sobra de centavos: a primeira parcela leva a diferença
  const desigual = ps[0].valor !== resto
  return desigual
    ? tx('{0}x de {1} (a primeira, {2}) · {3}', ps.length, fmtValor(resto), fmtValor(ps[0].valor), primeira)
    : tx('{0}x de {1} · {2}', ps.length, fmtValor(resto), primeira)
}

/** Uma frase com a situação da fatura: "Fechada · vence em 9 dias", "Paga", "Venceu há 3 dias", "Faltam R$ 400 · vence amanhã". */
export function textoStatus(s: Pick<SituacaoCartao, 'status' | 'diasParaVencer' | 'valor'> & Partial<Pick<SituacaoCartao, 'pagoEmParte' | 'falta'>>) {
  if (s.status === 'paga') return tx('Paga')
  if (s.status === 'renegociada') return tx('Renegociada')
  if (s.valor === 0) return tx('Sem compras na fatura')
  const quando = quandoVence(s)
  // paga em parte: o que falta e quando vence ("Faltam R$ 400 · vence em 9 dias")
  if ((s.pagoEmParte ?? 0) > 0) return (s.falta ?? 0) > 0 ? tx('Faltam {0} · {1}', fmtValor(s.falta!), quando) : tx('Paga em parte, já coberta')
  return s.status === 'atrasada' ? quando[0].toUpperCase() + quando.slice(1) : `${ROTULO_STATUS[s.status]} · ${quando}`
}
