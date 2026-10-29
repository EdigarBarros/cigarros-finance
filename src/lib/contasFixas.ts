/**
 * Contas fixas: o que se repete todo mês (aluguel, luz, internet, salário…).
 * Aqui só há cálculo: dado as contas e os lançamentos do ano, diz o que venceu, o que vence e o que já foi pago.
 */
import { fmtDataCurta, fmtMoeda, fmtValor, moedaAtual } from './format'
import type { Taxas } from './moedas'
import type { ContaFixa, Lancamento } from './types'

export type EstadoConta = 'paga' | 'atrasada' | 'vence_hoje' | 'a_vencer' | 'fora'

export interface SituacaoConta {
  conta: ContaFixa
  estado: EstadoConta
  /** Dia em que vence neste mês (dia 31 em mês de 30 dias vira 30). */
  dia: number
  /** AAAA-MM-DD do vencimento neste mês. */
  vencimento: string
  /** Só em a_vencer (e 0 em vence_hoje): dias até o vencimento. */
  diasRestantes: number | null
  /** Só em atrasada: dias desde o vencimento. */
  diasAtraso: number | null
  /** O lançamento da baixa ("Paguei" / "Recebi"), se já foi dada. */
  baixa: Lancamento | null
  /** Valor pago, se paga; senão, o valor de costume da conta. Sempre na moeda principal (é o que entra nos totais). */
  valor: number
  /** Moeda da conta quando não é a principal. */
  moeda: string | null
  /** Quanto 1 unidade da moeda da conta vale na principal (1 se a conta é na principal). */
  taxa: number
  /** O mesmo valor na moeda da conta (o que a pessoa lançou ou combinou). */
  valorNativo: number
}

const dois = (n: number) => String(n).padStart(2, '0')
const centavos = (n: number) => Math.round(n * 100) / 100
const chaveMes = (ano: number, mes: number) => ano * 12 + mes - 1
const chaveIso = (iso: string) => chaveMes(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)))
const diasNoMes = (ano: number, mes: number) => new Date(ano, mes, 0).getDate()
const diasEntre = (de: string, ate: string) =>
  Math.round((Date.UTC(+ate.slice(0, 4), +ate.slice(5, 7) - 1, +ate.slice(8, 10)) - Date.UTC(+de.slice(0, 4), +de.slice(5, 7) - 1, +de.slice(8, 10))) / 86400000)

/** Hoje no relógio da pessoa (não em UTC, para a virada do dia valer à meia-noite daqui). */
export const hojeLocal = (d = new Date()) => `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`

/** Dia do vencimento em um mês: dia 31 em mês curto vale o último dia do mês. */
export const diaNoMes = (dia: number, ano: number, mes: number) => Math.min(dia, diasNoMes(ano, mes))

/** A conta vale neste mês? (ativa, já começou e ainda não acabou) */
export function valeNoMes(c: ContaFixa, ano: number, mes: number) {
  const k = chaveMes(ano, mes)
  return c.ativa && chaveIso(c.inicio) <= k && (!c.fim || k <= chaveIso(c.fim))
}

/** Situação de uma conta num mês, com a data de hoje como referência. */
/** A moeda da conta, ou null quando é a principal. */
export const moedaDaConta = (c: Pick<ContaFixa, 'moeda'>) => (c.moeda && c.moeda !== moedaAtual() ? c.moeda : null)

export function situacaoDaConta(c: ContaFixa, lancs: Lancamento[], ano: number, mes: number, hoje = hojeLocal(), taxas: Taxas = {}): SituacaoConta {
  const dia = diaNoMes(c.dia, ano, mes)
  const vencimento = `${ano}-${dois(mes)}-${dois(dia)}`
  const baixa = lancs.find((l) => l.conta_fixa_id === c.id && l.ano === ano && l.mes === mes) ?? null
  const moeda = moedaDaConta(c)
  const taxa = moeda ? taxas[moeda] ?? 1 : 1
  // o valor de costume numa moeda de fora entra nos totais convertido pela cotação do dia
  const estimado = moeda ? centavos(c.valor * taxa) : c.valor
  const base = { conta: c, dia, vencimento, baixa, valor: estimado, moeda, taxa, valorNativo: c.valor, diasRestantes: null, diasAtraso: null }
  // Uma baixa já dada vale mesmo que a conta tenha sido pausada ou mudado de datas depois.
  if (baixa) {
    const nativo = !moeda ? baixa.valor : baixa.moeda_original === moeda && baixa.valor_original ? baixa.valor_original : centavos(baixa.valor / taxa)
    return { ...base, estado: 'paga', valor: baixa.valor, valorNativo: nativo }
  }
  if (!valeNoMes(c, ano, mes)) return { ...base, estado: 'fora' }
  if (vencimento < hoje) return { ...base, estado: 'atrasada', diasAtraso: diasEntre(vencimento, hoje) }
  if (vencimento === hoje) return { ...base, estado: 'vence_hoje', diasRestantes: 0 }
  return { ...base, estado: 'a_vencer', diasRestantes: diasEntre(hoje, vencimento) }
}

/** As contas que valem no mês (ou já foram pagas nele), por dia de vencimento. Quem está "fora" não entra. */
export function situacoesDoMes(contas: ContaFixa[], lancs: Lancamento[], ano: number, mes: number, hoje = hojeLocal(), taxas: Taxas = {}): SituacaoConta[] {
  return contas
    .map((c) => situacaoDaConta(c, lancs, ano, mes, hoje, taxas))
    .filter((s) => s.estado !== 'fora')
    .sort((a, b) => a.dia - b.dia || a.conta.descricao.localeCompare(b.conta.descricao))
}

export interface TotaisContas {
  /** Saídas que ainda não foram pagas no mês (atrasadas e a vencer). */
  faltaPagar: number
  jaPago: number
  /** Parte do que falta pagar que já venceu. */
  atrasado: number
  /** Entradas fixas que ainda não caíram. */
  aReceber: number
  jaRecebido: number
  qtdAtrasadas: number
  temEntradas: boolean
}

const soma = (xs: SituacaoConta[]) => centavos(xs.reduce((a, s) => a + s.valor, 0))

export function totaisDoMes(sits: SituacaoConta[]): TotaisContas {
  const saidas = sits.filter((s) => s.conta.tipo === 'saida')
  const entradas = sits.filter((s) => s.conta.tipo === 'entrada')
  const atrasadas = saidas.filter((s) => s.estado === 'atrasada')
  return {
    faltaPagar: soma(saidas.filter((s) => s.estado !== 'paga')),
    jaPago: soma(saidas.filter((s) => s.estado === 'paga')),
    atrasado: soma(atrasadas),
    aReceber: soma(entradas.filter((s) => s.estado !== 'paga')),
    jaRecebido: soma(entradas.filter((s) => s.estado === 'paga')),
    qtdAtrasadas: atrasadas.length,
    temEntradas: entradas.length > 0,
  }
}

/** Quanto ainda falta pagar no mês (para um indicador da visão geral). */
export const faltaPagarNoMes = (sits: SituacaoConta[]) => totaisDoMes(sits).faltaPagar

/** Dias à frente que ainda contam como "esta semana". */
export const DIAS_DA_SEMANA = 7

export interface GruposContas {
  atrasadas: SituacaoConta[]
  estaSemana: SituacaoConta[]
  maisAFrente: SituacaoConta[]
  pagas: SituacaoConta[]
}

export function agruparContas(sits: SituacaoConta[]): GruposContas {
  const por = (f: (s: SituacaoConta) => boolean) => sits.filter(f)
  return {
    atrasadas: por((s) => s.estado === 'atrasada').sort((a, b) => a.vencimento.localeCompare(b.vencimento)),
    estaSemana: por((s) => s.estado === 'vence_hoje' || (s.estado === 'a_vencer' && s.diasRestantes! <= DIAS_DA_SEMANA)),
    maisAFrente: por((s) => s.estado === 'a_vencer' && s.diasRestantes! > DIAS_DA_SEMANA),
    pagas: por((s) => s.estado === 'paga').sort((a, b) => (a.baixa?.data ?? '').localeCompare(b.baixa?.data ?? '')),
  }
}

/** O que ainda precisa de atenção, na ordem em que a pessoa deve olhar: atrasadas e depois as próximas a vencer. */
export function pendentes(sits: SituacaoConta[]) {
  const g = agruparContas(sits)
  return {
    atrasadas: g.atrasadas,
    proximas: [...g.estaSemana, ...g.maisAFrente].sort((a, b) => a.vencimento.localeCompare(b.vencimento) || a.conta.descricao.localeCompare(b.conta.descricao)),
  }
}

/** Meses anteriores ao aberto (no mesmo ano) que ficaram com conta sem baixa. */
export function mesesComAtraso(contas: ContaFixa[], lancs: Lancamento[], ano: number, ate: number, hoje = hojeLocal(), taxas: Taxas = {}) {
  const achados: { mes: number; qtd: number }[] = []
  for (let m = 1; m < ate; m++) {
    const qtd = situacoesDoMes(contas, lancs, ano, m, hoje, taxas).filter((s) => s.estado === 'atrasada' && s.conta.tipo === 'saida').length
    if (qtd) achados.push({ mes: m, qtd })
  }
  return achados
}

/** Data da baixa: hoje, se o mês é o atual; nos outros meses, o dia do vencimento (a baixa fica dentro do mês da conta). */
export function dataDaBaixa(c: ContaFixa, ano: number, mes: number, hoje = hojeLocal()) {
  return chaveIso(hoje) === chaveMes(ano, mes) ? hoje : `${ano}-${dois(mes)}-${dois(diaNoMes(c.dia, ano, mes))}`
}

/**
 * O lançamento que "Paguei" / "Recebi" cria. O valor (na moeda da conta) e a data podem ser trocados (a conta de luz muda).
 * Conta em outra moeda: o lançamento guarda o valor original e a conversão pela cotação (a do dia ou a que a pessoa informou).
 */
export function lancamentoDaBaixa(
  c: ContaFixa, ano: number, mes: number, mudancas: { valor?: number; data?: string; cotacao?: number } = {}, taxas: Taxas = {},
): Omit<Lancamento, 'id'> {
  const moeda = moedaDaConta(c)
  const nativo = mudancas.valor ?? c.valor
  const base = {
    ano, mes, tipo: c.tipo, descricao: c.descricao,
    data: mudancas.data ?? dataDaBaixa(c, ano, mes),
    categoria_id: c.categoria_id, banco_id: c.banco_id, conta_fixa_id: c.id,
  }
  if (!moeda) return { ...base, valor: nativo }
  const taxa = mudancas.cotacao ?? taxas[moeda] ?? 1
  return { ...base, valor: centavos(nativo * taxa), valor_original: nativo, moeda_original: moeda }
}

/** O valor da conta no jeito que a pessoa combinou (na moeda dela), para mostrar nas telas. */
export const fmtConta = (s: SituacaoConta) => (s.moeda ? fmtMoeda(s.valorNativo, s.moeda) : fmtValor(s.valor))
/** "≈ R$ 267,50" quando a conta é em outra moeda (para somar de cabeça com o resto); vazio quando é na principal. */
export const aproxConta = (s: SituacaoConta) => (s.moeda ? `≈ ${fmtValor(s.valor)}` : '')

const normal = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim()

/**
 * Lançamento do mês que parece ser o pagamento desta conta, mas não está ligado a ela
 * (a pessoa lançou "Aluguel" à mão antes de cadastrar a conta fixa): evita lançar duas vezes.
 */
export function lancamentoParecido(c: ContaFixa, lancs: Lancamento[], ano: number, mes: number) {
  const nome = normal(c.descricao)
  return nome ? lancs.find((l) => !l.conta_fixa_id && l.ano === ano && l.mes === mes && l.tipo === c.tipo && normal(l.descricao) === nome) : undefined
}

export interface Repeticao {
  /** Como a pessoa escreveu da última vez. */
  descricao: string
  /** Valor da última vez. */
  valor: number
  /** Em quantos meses diferentes apareceu. */
  meses: number
}

/**
 * Saídas que parecem conta fixa: a mesma descrição, uma vez por mês, em 2 meses ou mais e com valores parecidos
 * (até 25% de diferença). "iFood" não entra: aparece várias vezes no mesmo mês.
 */
export function saidasQueSeRepetem(lancs: Lancamento[]): Repeticao[] {
  const grupos = new Map<string, Lancamento[]>()
  for (const l of lancs) {
    if (l.tipo !== 'saida' || l.conta_fixa_id || l.valor <= 0) continue
    const chave = normal(l.descricao)
    if (chave.length < 3) continue
    grupos.set(chave, [...(grupos.get(chave) ?? []), l])
  }
  const achados: Repeticao[] = []
  for (const ls of grupos.values()) {
    const meses = new Set(ls.map((l) => chaveMes(l.ano, l.mes)))
    if (meses.size < 2 || meses.size !== ls.length) continue
    const valores = ls.map((l) => l.valor)
    const maior = Math.max(...valores)
    if ((maior - Math.min(...valores)) / maior > 0.25) continue
    const ultimo = [...ls].sort((a, b) => chaveMes(b.ano, b.mes) - chaveMes(a.ano, a.mes))[0]
    achados.push({ descricao: ultimo.descricao.trim(), valor: ultimo.valor, meses: meses.size })
  }
  return achados.sort((a, b) => b.meses - a.meses || b.valor - a.valor)
}

/** Primeiro dia do mês, como a conta guarda "a partir de" e "até". */
export const inicioDoMes = (ano: number, mes: number) => `${ano}-${dois(mes)}-01`

/** Em palavras simples: "vence em 3 dias", "venceu ontem", "pago em 5-out". */
export function fraseDaSituacao(s: SituacaoConta) {
  const entrada = s.conta.tipo === 'entrada'
  const verbo = entrada ? 'cai' : 'vence'
  const verboPassado = entrada ? 'era para cair' : 'venceu'
  switch (s.estado) {
    case 'paga': return `${entrada ? 'recebido' : 'pago'} em ${fmtDataCurta(s.baixa?.data ?? s.vencimento)}`
    case 'atrasada': {
      const n = s.diasAtraso ?? 0
      return n === 1 ? `${verboPassado} ontem` : n <= 30 ? `${verboPassado} há ${n} dias` : `${verboPassado} em ${fmtDataCurta(s.vencimento)}`
    }
    case 'vence_hoje': return `${verbo} hoje`
    case 'a_vencer': {
      const n = s.diasRestantes ?? 0
      return n === 1 ? `${verbo} amanhã` : `${verbo} em ${n} dias`
    }
    default: return ''
  }
}
