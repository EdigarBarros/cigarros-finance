/**
 * O juro de verdade, aprendido com as conferências com o banco (migrações 37 e 44). Puro: sem React, sem banco, a data entra
 * por `hoje`.
 *
 * Cada "Conferi com o banco" é uma pista. O app sabia quanto mostrava (`antes`, já com os juros que ele estimou) e o banco
 * mostrou outro número (`depois`). Como depois de cada conferência o valor do banco vira o valor da dívida, o que o banco
 * cobrou de juros num intervalo é:
 *
 *     juros de verdade = depois − antes + juros que o app tinha estimado
 *
 * Com o tamanho do que estava crescendo (`base_juros`) e há quantos dias (`dias_juros`), sai quanto a dívida cresce por dia.
 * Duas formas de crescer são testadas e fica a que explica melhor os números (a mais constante entre as conferências):
 *  - um percentual por dia sobre o que está atrasado (o jeito de quase todo banco);
 *  - um valor fixo por dia (R$ 20 por dia).
 *
 * "Bateu" (o banco mostrou o mesmo que o app) também é pista: confirma a regra e aumenta a confiança.
 * O valor "para quitar hoje" (com desconto) não ensina juros: ele só mostra quanto o banco abate para quitar.
 */
import type { Calendario, SituacaoDivida } from './dividas'
import { diasEntre, temJurosDeAtraso } from './jurosAtraso'
import type { ConferenciaDivida, Divida } from './types'

/** O IOF diário das operações de crédito de pessoa física (regra do governo): 0,0082% ao dia. */
export const IOF_DIA = 0.000082

export interface AmostraDeJuros {
  data: string
  dias: number
  base: number
  /** O que o banco cobrou de juros no intervalo (na moeda principal). */
  juros: number
}

export interface JurosAprendido {
  /** Quantas conferências serviram para aprender. */
  amostras: number
  /** Como a dívida cresce pelas conferências: percentual por dia sobre o atrasado, ou valor fixo por dia. */
  modelo: 'pct' | 'reais'
  /** Percentual por dia (0,007 = 0,7% ao dia), no modelo 'pct'. */
  taxaDia: number
  /** Valor fixo por dia (moeda principal), no modelo 'reais'. */
  reaisDia: number
  /** Quanto a dívida cresce por dia hoje, pelo que foi aprendido (moeda principal). */
  porDiaHoje: number
  /** Quanto cresce por dia pela regra que a pessoa informou (0 sem regra). */
  porDiaInformado: number
  /** A regra informada não bate com o banco: para mais (o banco cobra mais) ou para menos. */
  diverge: 'mais' | 'menos' | null
  /** Erro médio da estimativa do app nas últimas conferências (0,03 = 3%); null sem conferência comparável. */
  erroMedio: number | null
  confianca: 'alta' | 'media' | 'baixa'
  /** A regra para gravar na dívida (na moeda dela) se a pessoa aceitar; null quando a regra atual já bate. */
  sugestao: Partial<Pick<Divida, 'atraso_juros_mes' | 'atraso_periodo' | 'atraso_tipo' | 'atraso_reais_dia'>> | null
  /** Do que cresce por dia, quanto pode ser IOF (moeda principal; 0 no modelo de valor fixo). */
  iofDia: number
  /** Equivalente em % ao mês (30 dias), para comparar com as outras dívidas. */
  taxaMes: number
  /** A última conferência que entrou na conta. */
  ultima: string
}

/** Quanto o banco abate para quitar hoje, pela última conferência "para quitar". */
export interface DescontoParaQuitar {
  data: string
  /** O que o app mostrava (o total). */
  total: number
  /** O que o banco pede para quitar. */
  quitar: number
  desconto: number
}

const centavos = (n: number) => Math.round(n * 100) / 100
const media = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
const mediana = (xs: number[]) => {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
/** Coeficiente de variação: quanto os valores mudam de uma conferência para outra (0 = sempre igual). */
const variacao = (xs: number[]) => {
  if (xs.length < 2) return 0
  const m = media(xs)
  if (m <= 0) return Infinity
  return Math.sqrt(media(xs.map((x) => (x - m) ** 2))) / m
}

const ordenadas = (cs: ConferenciaDivida[]) =>
  [...cs].sort((a, b) => a.data.localeCompare(b.data) || a.created_at.localeCompare(b.created_at))

/** O que está crescendo hoje: o que falta das parcelas atrasadas (ou o saldo inteiro, na regra do cartão). */
export function baseDoAtraso(s: SituacaoDivida, cal: Calendario | null): number {
  if (s.divida.atraso_base === 'saldo') return s.restante
  const atrasado = (cal?.atrasadas ?? []).reduce((a, p) => a + Math.max(0, p.falta), 0)
  return atrasado > 0 ? atrasado : 0
}

/**
 * Para gravar com a conferência (migração 44): os juros que o app estimou sem a multa, o que estava crescendo e há quantos
 * dias. É o que permite aprender depois.
 */
export function pistaDaConferencia(s: SituacaoDivida, cal: Calendario | null, data: string) {
  const d = s.divida
  const conf = d.conferido_em ?? null
  const atrasadas = (cal?.atrasadas ?? []).filter((p) => p.falta > 0)
  // a multa que o app pôs (uma vez, nas parcelas que venceram depois da última conferência) não é juro por dia
  const multa = temJurosDeAtraso(d) && d.atraso_base !== 'saldo'
    ? atrasadas.filter((p) => !conf || p.vencimento >= conf).reduce((a, p) => a + p.falta * (Math.max(0, d.atraso_multa ?? 2) / 100), 0)
    : 0
  const juros = Math.max(0, centavos(s.jurosAtraso - multa))
  const primeira = atrasadas[0]?.vencimento ?? null
  const desde = primeira && conf ? (conf > primeira ? conf : primeira) : primeira ?? conf
  const dias = desde && desde < data ? diasEntre(desde, data) : null
  return { juros_estimado: juros, base_juros: centavos(baseDoAtraso(s, cal)), dias_juros: dias }
}

/** A conferência "para quitar hoje" mais recente, com o desconto que o banco dá. */
export function descontoParaQuitar(cs: ConferenciaDivida[]): DescontoParaQuitar | null {
  const q = ordenadas(cs).filter((c) => c.qual_valor === 'quitar').pop()
  if (!q || q.depois >= q.antes) return null
  return { data: q.data, total: q.antes, quitar: q.depois, desconto: centavos(q.antes - q.depois) }
}

/** As pistas de juros de uma dívida: uma por intervalo entre conferências em que dá para dizer o que o banco cobrou. */
export function amostrasDeJuros(divida: Divida, cs: ConferenciaDivida[]): AmostraDeJuros[] {
  const lista = ordenadas(cs.filter((c) => c.divida_id === divida.id && c.qual_valor !== 'quitar'))
  const semRegra = !temJurosDeAtraso(divida)
  const out: AmostraDeJuros[] = []
  for (let i = 0; i < lista.length; i++) {
    const c = lista[i]
    // conferências antigas (antes da migração 44) não guardam o que o app tinha estimado: só servem se o app não estimava nada
    const estimado = typeof c.juros_estimado === 'number' ? c.juros_estimado : semRegra ? 0 : null
    if (estimado === null) continue
    const anterior = i > 0 ? lista[i - 1] : null
    const dias = typeof c.dias_juros === 'number' && c.dias_juros > 0 ? c.dias_juros : anterior ? diasEntre(anterior.data, c.data) : 0
    if (!(dias >= 1)) continue
    const juros = centavos(c.depois - c.antes + estimado)
    // caiu: pagamento que não foi lançado, desconto ou acordo. Não é juro: fica de fora
    if (juros < -0.005) continue
    const base = typeof c.base_juros === 'number' && c.base_juros > 0 ? c.base_juros : Math.max(0, c.antes - estimado)
    if (base <= 0) continue
    out.push({ data: c.data, dias, base, juros: Math.max(0, juros) })
  }
  return out
}

/**
 * O que as conferências ensinaram sobre os juros desta dívida, ou null sem pista suficiente. `s` e `cal` são a situação e o
 * calendário de hoje.
 */
export function aprenderJuros(s: SituacaoDivida, cal: Calendario | null, cs: ConferenciaDivida[]): JurosAprendido | null {
  const d = s.divida
  if ((d.sentido ?? 'devo') !== 'devo' || s.restante <= 0 || s.semCotacao) return null
  let amostras = amostrasDeJuros(d, cs)
  if (!amostras.length) return null
  // uma conferência muito fora (uma compra nova que não foi lançada, por exemplo) não pode ensinar o resto
  if (amostras.length >= 3) {
    const m = mediana(amostras.map((a) => a.juros / (a.base * a.dias)))
    if (m > 0) amostras = amostras.filter((a) => a.juros / (a.base * a.dias) <= m * 3)
  }
  const pcts = amostras.map((a) => a.juros / (a.base * a.dias))
  const reais = amostras.map((a) => a.juros / a.dias)
  const informouReais = (d.atraso_reais_dia ?? 0) > 0
  const modelo: 'pct' | 'reais' = amostras.length >= 2
    ? (variacao(reais) < variacao(pcts) * 0.8 ? 'reais' : 'pct')
    : informouReais ? 'reais' : 'pct'
  // os intervalos mais longos pesam mais (um dia só pode ser arredondamento)
  const peso = amostras.map((a) => a.dias)
  const somaPeso = peso.reduce((a, b) => a + b, 0) || 1
  const taxaDia = modelo === 'pct' ? amostras.reduce((acc, _a, i) => acc + pcts[i] * peso[i], 0) / somaPeso : 0
  const reaisDia = modelo === 'reais' ? amostras.reduce((acc, _a, i) => acc + reais[i] * peso[i], 0) / somaPeso : 0

  const base = baseDoAtraso(s, cal) || amostras[amostras.length - 1].base
  const porDiaHoje = centavos(modelo === 'pct' ? taxaDia * base : reaisDia)
  const porDiaInformado = s.atraso?.diario ?? 0
  const temRegra = temJurosDeAtraso(d)

  // a regra informada bate? Uma diferença de até 15% (ou de centavos) é arredondamento do banco
  const dif = porDiaHoje - porDiaInformado
  const relativa = porDiaInformado > 0 ? Math.abs(dif) / porDiaInformado : porDiaHoje > 0 ? Infinity : 0
  const diverge = porDiaHoje <= 0 && porDiaInformado <= 0 ? null
    : relativa > 0.15 && Math.abs(dif) >= 0.05 ? (dif > 0 ? 'mais' : 'menos') : null

  // o erro do app nas últimas conferências comparáveis: o quanto ele errou o que o banco ia mostrar
  const comparaveis = ordenadas(cs.filter((c) => c.divida_id === d.id && c.qual_valor !== 'quitar' && c.origem === 'conferir' && c.depois > 0)).slice(-5)
  const erroMedio = comparaveis.length ? media(comparaveis.map((c) => Math.abs(c.depois - c.antes) / c.depois)) : null

  const varModelo = modelo === 'pct' ? variacao(pcts) : variacao(reais)
  const confianca: JurosAprendido['confianca'] = amostras.length >= 3 && varModelo <= 0.25 ? 'alta' : amostras.length >= 2 && varModelo <= 0.5 ? 'media' : 'baixa'

  // a regra a gravar, na moeda da dívida (a taxa não tem moeda; o valor por dia tem)
  const sugestao: JurosAprendido['sugestao'] = (diverge || (!temRegra && porDiaHoje > 0))
    ? modelo === 'pct'
      ? { atraso_juros_mes: Math.round(taxaDia * 100 * 10000) / 10000, atraso_periodo: 'dia', atraso_tipo: 'simples', atraso_reais_dia: null }
      : { atraso_juros_mes: 0, atraso_periodo: 'dia', atraso_reais_dia: centavos(reaisDia / (s.taxa || 1)) }
    : null

  const taxaMes = modelo === 'pct' ? taxaDia * 30 * 100 : base > 0 ? ((reaisDia * 30) / base) * 100 : 0
  return {
    amostras: amostras.length, modelo, taxaDia, reaisDia: centavos(reaisDia), porDiaHoje, porDiaInformado,
    diverge: temRegra ? diverge : porDiaHoje > 0 ? 'mais' : null,
    erroMedio, confianca, sugestao,
    iofDia: modelo === 'pct' ? centavos(Math.min(porDiaHoje, IOF_DIA * base)) : 0,
    taxaMes: Math.round(taxaMes * 100) / 100,
    ultima: amostras[amostras.length - 1].data,
  }
}
