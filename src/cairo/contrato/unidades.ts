/**
 * Unidades do Cairo: dinheiro, moeda, data e taxa. Contrato 1.x (docs/cairo/contrato.md).
 *
 * Regras que valem em todo o núcleo:
 *  - Dinheiro é inteiro de centavos (`Centavos`), nunca número com vírgula. Somar moedas diferentes é erro.
 *  - Data é civil (`DiaISO`, AAAA-MM-DD), sem fuso e sem `Date`: as contas são feitas com o número do dia.
 *  - Taxa é fração com período e regime (`Taxa`): 0,025 ao mês composta. Percentual só existe na fronteira (contrato/validar.ts).
 *
 * Puro: sem React, sem banco, sem relógio.
 */

export type Centavos = number & { readonly __u: 'centavos' }
export type Moeda = string & { readonly __u: 'ISO4217' }
export type DiaISO = string & { readonly __u: 'AAAA-MM-DD' }
/** Mês civil "AAAA-MM". */
export type MesISO = string & { readonly __u: 'AAAA-MM' }

export interface Valor { centavos: Centavos; moeda: Moeda }

/** Quanto vale 1 de `de` em `para`, num dia, e de onde veio. */
export interface Cotacao { de: Moeda; para: Moeda; fator: number; dia: DiaISO | null; fonte: 'informada' | 'mercado' | 'combinada' }

export type Periodo = 'dia' | 'mes' | 'ano'
/** 0,025 = 2,5% por período. Simples: proporcional ao tempo; composta: juros sobre juros. */
export interface Taxa { fracao: number; periodo: Periodo; regime: 'simples' | 'composta' }

export class ErroDeUnidade extends Error {}

// ---------- dinheiro ----------

export const ehCentavos = (n: unknown): n is Centavos => typeof n === 'number' && Number.isSafeInteger(n)

/** Centavos de um valor em reais (ou na unidade da moeda). Arredonda meio centavo para longe do zero. */
export function centavosDe(reais: number): Centavos {
  if (!Number.isFinite(reais)) throw new ErroDeUnidade(`valor não finito: ${reais}`)
  const c = Math.sign(reais) * Math.round(Math.abs(reais) * 100)
  if (!Number.isSafeInteger(c)) throw new ErroDeUnidade(`valor grande demais: ${reais}`)
  return (c === 0 ? 0 : c) as Centavos
}

export const emReais = (c: Centavos) => c / 100
export const zero = (moeda: Moeda): Valor => ({ centavos: 0 as Centavos, moeda })
export const valor = (centavos: number, moeda: Moeda): Valor => {
  if (!Number.isSafeInteger(centavos)) throw new ErroDeUnidade(`centavos não inteiros: ${centavos}`)
  return { centavos: centavos as Centavos, moeda }
}

export function somar(a: Valor, b: Valor): Valor {
  if (a.moeda !== b.moeda) throw new ErroDeUnidade(`somar ${a.moeda} com ${b.moeda}: converta antes`)
  return valor(a.centavos + b.centavos, a.moeda)
}
export const subtrair = (a: Valor, b: Valor): Valor => somar(a, { ...b, centavos: -b.centavos as Centavos })
export function somarTodos(xs: Valor[], moeda: Moeda): Valor {
  return xs.reduce((s, x) => somar(s, x), zero(moeda))
}
/** Multiplica e arredonda uma vez, no fim. */
export const multiplicar = (v: Valor, f: number): Valor => ({ centavos: centavosDe((v.centavos * f) / 100), moeda: v.moeda })

export function converter(v: Valor, c: Cotacao): Valor {
  if (v.moeda === c.para) return v
  if (v.moeda !== c.de) throw new ErroDeUnidade(`cotação de ${c.de} usada em ${v.moeda}`)
  return { centavos: centavosDe((v.centavos * c.fator) / 100), moeda: c.para }
}

const RE_MOEDA = /^[A-Z]{3}$/
export const ehMoeda = (s: unknown): s is Moeda => typeof s === 'string' && RE_MOEDA.test(s)

// ---------- datas (algoritmo dos dias civis de Howard Hinnant: sem Date, sem fuso) ----------

const RE_DIA = /^(\d{4})-(\d{2})-(\d{2})$/

/** Número do dia (dias desde 1970-01-01) de uma data civil válida. */
export function numeroDoDia(ano: number, mes: number, dia: number): number {
  const y = mes <= 2 ? ano - 1 : ano
  const era = Math.floor(y / 400)
  const yoe = y - era * 400
  const mp = (mes + 9) % 12
  const doy = Math.floor((153 * mp + 2) / 5) + dia - 1
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy
  return era * 146097 + doe - 719468
}

export function civilDoNumero(n: number): { ano: number; mes: number; dia: number } {
  const z = n + 719468
  const era = Math.floor(z / 146097)
  const doe = z - era * 146097
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365)
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100))
  const mp = Math.floor((5 * doy + 2) / 153)
  const dia = doy - Math.floor((153 * mp + 2) / 5) + 1
  const mes = mp < 10 ? mp + 3 : mp - 9
  return { ano: yoe + era * 400 + (mes <= 2 ? 1 : 0), mes, dia }
}

export const diasNoMes = (ano: number, mes: number) => numeroDoDia(mes === 12 ? ano + 1 : ano, mes === 12 ? 1 : mes + 1, 1) - numeroDoDia(ano, mes, 1)

const dois = (n: number) => String(n).padStart(2, '0')
export const diaIso = (ano: number, mes: number, dia: number): DiaISO => `${String(ano).padStart(4, '0')}-${dois(mes)}-${dois(dia)}` as DiaISO

/** A data civil, se o texto for uma (30/02 não é). */
export function lerDia(s: unknown): DiaISO | null {
  if (typeof s !== 'string') return null
  const m = RE_DIA.exec(s.slice(0, 10))
  if (!m) return null
  const a = Number(m[1]); const me = Number(m[2]); const d = Number(m[3])
  if (me < 1 || me > 12 || d < 1 || d > diasNoMes(a, me)) return null
  return s.slice(0, 10) as DiaISO
}

export function numero(d: DiaISO): number {
  return numeroDoDia(Number(d.slice(0, 4)), Number(d.slice(5, 7)), Number(d.slice(8, 10)))
}
export function doNumero(n: number): DiaISO {
  const c = civilDoNumero(n)
  return diaIso(c.ano, c.mes, c.dia)
}
export const diasEntre = (de: DiaISO, ate: DiaISO) => numero(ate) - numero(de)
export const somarDias = (d: DiaISO, n: number) => doNumero(numero(d) + n)
/** 0 = domingo … 6 = sábado (1970-01-01 foi uma quinta). */
export const diaDaSemana = (d: DiaISO) => ((numero(d) + 4) % 7 + 7) % 7
export const mesDe = (d: DiaISO): MesISO => d.slice(0, 7) as MesISO
export const mesIso = (ano: number, mes: number): MesISO => `${ano}-${dois(mes)}` as MesISO
/** Número do mês no Cairo: ano × 12 + mês. ATENÇÃO: o `chaveMes` do app é ano × 12 + mês − 1 (não misture os dois). */
export const chaveDoMes = (m: MesISO) => Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7))
export const mesDaChave = (k: number): MesISO => mesIso(Math.floor((k - 1) / 12), ((k - 1) % 12) + 1)
/** O dia `d` do mês, ou o último dia se o mês for mais curto (o dia 31 de fevereiro é o 28 ou 29). */
export function noDiaDoMes(m: MesISO, d: number): DiaISO {
  const a = Number(m.slice(0, 4)); const me = Number(m.slice(5, 7))
  return diaIso(a, me, Math.min(Math.max(1, d), diasNoMes(a, me)))
}
export const menorDia = (a: DiaISO, b: DiaISO) => (a < b ? a : b)
export const maiorDia = (a: DiaISO, b: DiaISO) => (a > b ? a : b)

// ---------- taxas ----------

/** Tamanho de cada período em meses: o mês comercial tem 30 dias e o ano, 12 meses. */
const EM_MESES: Record<Periodo, number> = { dia: 1 / 30, mes: 1, ano: 12 }

/** A mesma taxa em outro período, respeitando o regime (30 × a diária só vale nos juros simples). */
export function converterTaxa(t: Taxa, periodo: Periodo): Taxa {
  if (t.periodo === periodo) return t
  const r = EM_MESES[t.periodo] / EM_MESES[periodo]
  const fracao = t.regime === 'simples' ? t.fracao / r : Math.pow(1 + t.fracao, 1 / r) - 1
  return { fracao, periodo, regime: t.regime }
}

/** Quanto um valor cresce em `dias` com a taxa (fator: 1,05 = cresceu 5%). */
export function fatorEmDias(t: Taxa, dias: number): number {
  const porDia = converterTaxa(t, 'dia').fracao
  return t.regime === 'simples' ? 1 + porDia * dias : Math.pow(1 + porDia, dias)
}
