/**
 * Previsões com faixa, tiradas dos mesmos cenários que o planejador usa (um número só não diz o quanto pode errar).
 *
 * As faixas ainda NÃO estão calibradas com dados reais: `calibracao.cobertura80` fica null até o registro de previsões
 * medir. A régua (src/cairo/regua) mede nas personas sintéticas e no app de demonstração.
 */
import { REGRAS } from '../contrato/politicas'
import type { Distribuicao, Estimativa, GeradorDeCenarios, Mundo } from '../contrato/tipos'
import { mesDe, type Centavos, type DiaISO } from '../contrato/unidades'
import { sementeDe } from '../aprendizado/aleatorio'

export const PREVISAO_VERSAO = '1.0.0'

const quantil = (xs: number[], q: number) => {
  const s = [...xs].sort((a, b) => a - b)
  if (!s.length) return 0
  const i = (s.length - 1) * q
  const lo = Math.floor(i)
  return s[lo] + (s[Math.min(s.length - 1, lo + 1)] - s[lo]) * (i - lo)
}

export function distribuicaoDe(xs: number[]): Distribuicao<Centavos> {
  const q = (x: number) => Math.round(quantil(xs, x)) as Centavos
  return {
    quantis: { p05: q(0.05), p10: q(0.1), p25: q(0.25), p50: q(0.5), p75: q(0.75), p90: q(0.9), p95: q(0.95) },
    calibracao: { versao: 'sem-calibracao', cobertura80: null },
  }
}

/** O gasto do dia a dia num período, em cada mundo. */
export const diaADiaEntre = (m: Mundo, de: DiaISO, ate: DiaISO) =>
  m.fluxos.filter((f) => f.natureza === 'dia_a_dia' && f.dia > de && f.dia <= ate).reduce((s, f) => s + f.valor.centavos, 0)

export interface Previsoes {
  /** O gasto do dia a dia de amanhã até o fim deste mês. */
  diaADiaRestoDoMes: Estimativa<Centavos> | null
  /** O gasto do dia a dia do mês que vem inteiro. */
  diaADiaMesQueVem: Estimativa<Centavos> | null
  cenarios: number
}

export function prever(g: GeradorDeCenarios, fimDoMes: DiaISO, nEf: number, pesoDoHistorico: number, comDiaADia: boolean): Previsoes {
  const n = REGRAS.cenariosDaPrevisao.valor
  if (!comDiaADia) return { diaADiaRestoDoMes: null, diaADiaMesQueVem: null, cenarios: 0 }
  const mundos = g.gerar(n, sementeDe(`previsao:${g.horizonte.hoje}`))
  const est = (xs: number[]): Estimativa<Centavos> => ({
    tipo: 'estimativa', dist: distribuicaoDe(xs), prov: { refs: [], conhecidoEm: g.horizonte.hoje, atualizadoEm: null },
    metodo: 'reamostragem-de-dias', nEf, pesoDoHistorico,
  })
  const hoje = g.horizonte.hoje
  const resto = mundos.map((m) => diaADiaEntre(m, hoje, fimDoMes))
  const proximo = mundos.map((m) => diaADiaEntre(m, fimDoMes, g.horizonte.ate))
  const temProximo = mesDe(g.horizonte.ate) !== mesDe(fimDoMes)
  return { diaADiaRestoDoMes: est(resto), diaADiaMesQueVem: temProximo ? est(proximo) : null, cenarios: n }
}
