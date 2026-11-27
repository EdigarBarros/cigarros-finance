/**
 * A fronteira do Cairo: o que chega do banco (reais com vírgula, juros em percentual, data em texto) vira tipo do contrato
 * ou vira um erro com motivo. Depois daqui o núcleo confia nos tipos e não revalida.
 *
 * Dado ruim da pessoa nunca quebra o núcleo: vira `Desconhecido` com motivo. Invariante violada lá dentro é defeito nosso
 * e lança `ErroDeUnidade`.
 */
import type { Motivo } from './tipos'
import {
  centavosDe, converterTaxa, ehMoeda, lerDia, type DiaISO, type Moeda, type Periodo, type Taxa, type Valor,
} from './unidades'

export type Validado<T> = { ok: true; valor: T; avisos: Motivo[] } | { ok: false; erros: Motivo[] }

const motivo = (codigo: string, params: Record<string, number | string> = {}, refs: string[] = []): Motivo => ({ codigo, params, refs, regras: [] })
const ok = <T>(valor: T, avisos: Motivo[] = []): Validado<T> => ({ ok: true, valor, avisos })
const erro = <T>(codigo: string, params: Record<string, number | string> = {}, refs: string[] = []): Validado<T> => ({ ok: false, erros: [motivo(codigo, params, refs)] })

/** Juro de CONTRATO acima de 100% ao mês não é de verdade: é erro de digitação ou percentual lido como fração (2,5 → 250). */
const TETO_MENSAL = 1
/** Acima de 25% ao mês é possível (rotativo, agiota), mas pede confirmação. */
const ALTA_MENSAL = 0.25

export function lerMoeda(s: unknown, ref = ''): Validado<Moeda> {
  const m = typeof s === 'string' ? s.trim().toUpperCase() : s
  return ehMoeda(m) ? ok(m) : erro('moeda.invalida', { valor: String(s) }, ref ? [ref] : [])
}

/** Reais (como o banco guarda) para centavos. Fração de centavo além do arredondamento vira aviso. */
export function lerValor(reais: unknown, moeda: Moeda, ref = ''): Validado<Valor> {
  const refs = ref ? [ref] : []
  if (typeof reais !== 'number' || !Number.isFinite(reais)) return erro('valor.invalido', { valor: String(reais) }, refs)
  const c = centavosDe(reais)
  const sobra = Math.abs(reais * 100 - c)
  const avisos = sobra > 0.01 + 1e-9 ? [motivo('valor.fracao-de-centavo', { valor: reais }, refs)] : []
  return ok({ centavos: c, moeda }, avisos)
}

export function lerDiaValido(s: unknown, ref = ''): Validado<DiaISO> {
  const d = lerDia(s)
  if (!d) return erro('data.invalida', { valor: String(s) }, ref ? [ref] : [])
  const ano = Number(d.slice(0, 4))
  if (ano < 1990 || ano > 2100) return erro('data.fora-da-faixa', { valor: d }, ref ? [ref] : [])
  return ok(d)
}

/**
 * Juros em PERCENTUAL (como o app guarda: 2,5 = 2,5%) para `Taxa`. A conversão acontece só aqui. O teto pega a troca de
 * unidade; taxa alta mas possível passa com aviso.
 */
export function lerTaxaPercentual(pct: unknown, periodo: Periodo, regime: Taxa['regime'], ref = '', teto = TETO_MENSAL): Validado<Taxa> {
  if (typeof pct !== 'number' || !Number.isFinite(pct)) return erro('taxa.invalida', { valor: String(pct) }, ref ? [ref] : [])
  return conferirTaxa({ fracao: pct / 100, periodo, regime }, pct, ref, teto)
}

/** Juros já em FRAÇÃO (como o aprendizado de juros calcula: 0,007 = 0,7% ao dia). */
export function lerTaxaFracao(fracao: unknown, periodo: Periodo, regime: Taxa['regime'], ref = '', teto = TETO_MENSAL): Validado<Taxa> {
  if (typeof fracao !== 'number' || !Number.isFinite(fracao)) return erro('taxa.invalida', { valor: String(fracao) }, ref ? [ref] : [])
  return conferirTaxa({ fracao, periodo, regime }, fracao * 100, ref, teto)
}

/**
 * Teto para regra de ATRASO: multa de atraso cobrada por dia existe ("5% ao dia" = 150% ao mês). Acima disto (1.000% ao mês)
 * é erro de digitação; abaixo, passa com aviso.
 */
export const TETO_ATRASO_MENSAL = 10

/** O teto pega a troca de unidade; taxa alta mas possível passa com aviso. `pct`: como a pessoa veria (para o motivo). */
function conferirTaxa(t: Taxa, pct: number, ref: string, teto: number): Validado<Taxa> {
  const refs = ref ? [ref] : []
  if (t.fracao < 0) return erro('taxa.negativa', { valor: pct }, refs)
  const mensal = converterTaxa(t, 'mes').fracao
  if (mensal > teto) return erro('taxa.implausivel', { valor: pct, periodo: t.periodo, mensal: Math.round(mensal * 10000) / 100 }, refs)
  return ok(t, mensal > ALTA_MENSAL ? [motivo('taxa.alta-confirmar', { valor: pct, periodo: t.periodo }, refs)] : [])
}

/** Junta os avisos e erros de várias leituras: quem chama decide o que fazer com cada item. */
export function juntar(vs: Validado<unknown>[]): Motivo[] {
  return vs.flatMap((v) => (v.ok ? v.avisos : v.erros))
}
