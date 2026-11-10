/**
 * Planejamento dos investimentos: projeções com hipóteses explícitas. Nada aqui é previsão nem promessa: cada número diz
 * "se render X% ao ano e você aportar Y por mês", e os três cenários (pessimista, base e otimista) são suposições que a
 * pessoa pode trocar. Puro e determinístico.
 */
import type { PontoDaLinha } from './carteira'
import { somarMeses } from './indices'
import type { Plano } from './tipos'

/** Taxa ao mês equivalente a uma taxa ao ano (%): 12% ao ano ≈ 0,949% ao mês. */
export const taxaAoMes = (aoAno: number) => Math.pow(1 + aoAno / 100, 1 / 12) - 1

/** Quanto haverá daqui a `meses` meses, partindo de `inicial`, aportando `aporte` no fim de cada mês e rendendo `aoAno`% ao ano. */
export function valorFuturo(inicial: number, aporte: number, aoAno: number, meses: number): number {
  const i = taxaAoMes(aoAno)
  if (Math.abs(i) < 1e-12) return inicial + aporte * meses
  const f = Math.pow(1 + i, meses)
  return inicial * f + aporte * ((f - 1) / i)
}

/** Em quantos meses se chega a `alvo` (0 se já chegou; null se não chega em 100 anos nesse ritmo). */
export function mesesAte(alvo: number, inicial: number, aporte: number, aoAno: number): number | null {
  if (inicial >= alvo) return 0
  const i = taxaAoMes(aoAno)
  let v = inicial
  for (let m = 1; m <= 1200; m++) {
    v = v * (1 + i) + aporte
    if (v >= alvo) return m
  }
  return null
}

/** Quanto aportar por mês para chegar a `alvo` em `meses` meses (0 se o que já tem chega lá sozinho). */
export function aporteNecessario(alvo: number, inicial: number, aoAno: number, meses: number): number {
  if (meses <= 0) return Math.max(0, alvo - inicial)
  const i = taxaAoMes(aoAno)
  const f = Math.pow(1 + i, meses)
  const falta = alvo - inicial * f
  if (falta <= 0) return 0
  return Math.abs(i) < 1e-12 ? falta / meses : falta / ((f - 1) / i)
}

/** Meses de `de` (AAAA-MM-DD) até o fim do mês `ate` (AAAA-MM). */
export const mesesEntre = (de: string, ate: string) => (Number(ate.slice(0, 4)) - Number(de.slice(0, 4))) * 12 + Number(ate.slice(5, 7)) - Number(de.slice(5, 7))

export type NomeDoCenario = 'pessimista' | 'base' | 'otimista'
export interface Cenario {
  nome: NomeDoCenario
  /** A hipótese: % ao ano. */
  aoAno: number
  /** O valor em cada mês, do mês de hoje (índice 0) até o horizonte. */
  pontos: number[]
  /** Em que mês (AAAA-MM) chega à meta, nesse cenário (null: não chega no horizonte de 100 anos, ou não há meta). */
  chegaEm: string | null
  /** Quanto haverá no prazo da meta. */
  noPrazo: number | null
}

export interface Projecao {
  /** 'AAAA-MM' de cada ponto. */
  meses: string[]
  cenarios: Cenario[]
  /** O aporte usado na conta (o planejado; sem plano, a média do que a pessoa vem aportando). */
  aporte: number
  /** De onde veio o aporte usado. */
  origemDoAporte: 'plano' | 'media' | 'nenhum'
  /** Para chegar à meta no prazo, no cenário base: quanto aportar por mês (null sem meta com prazo). */
  aporteParaAMeta: number | null
}

/**
 * Projeta a carteira nos três cenários. O horizonte vai até o prazo da meta (ou até ela ser alcançada no cenário base),
 * no mínimo 12 e no máximo 480 meses.
 */
export function projetar(plano: Plano, valorHoje: number, aporteMedio: number, hoje: string): Projecao {
  const aporte = plano.aporteMensal ?? (aporteMedio > 0 ? aporteMedio : 0)
  const origemDoAporte = plano.aporteMensal ? 'plano' : aporteMedio > 0 ? 'media' : 'nenhum'
  const alvo = plano.metaPatrimonio
  const ateOPrazo = plano.metaPrazo ? mesesEntre(hoje, plano.metaPrazo) : null
  const ateAMeta = alvo ? mesesAte(alvo, valorHoje, aporte, plano.cenarios.base) : null
  const horizonte = Math.min(480, Math.max(12, ateOPrazo ?? 0, ateAMeta !== null ? ateAMeta + 6 : 0, ateOPrazo === null && ateAMeta === null ? 120 : 0))
  const meses = Array.from({ length: horizonte + 1 }, (_, k) => somarMeses(`${hoje.slice(0, 7)}-01`, k).slice(0, 7))
  const cenarios = (['pessimista', 'base', 'otimista'] as const).map((nome): Cenario => {
    const aoAno = plano.cenarios[nome]
    const m = alvo ? mesesAte(alvo, valorHoje, aporte, aoAno) : null
    return {
      nome, aoAno,
      pontos: meses.map((_, k) => Math.round(valorFuturo(valorHoje, aporte, aoAno, k) * 100) / 100),
      chegaEm: m === null ? null : somarMeses(`${hoje.slice(0, 7)}-01`, m).slice(0, 7),
      noPrazo: ateOPrazo !== null && ateOPrazo >= 0 ? Math.round(valorFuturo(valorHoje, aporte, aoAno, ateOPrazo) * 100) / 100 : null,
    }
  })
  return {
    meses, cenarios, aporte, origemDoAporte,
    aporteParaAMeta: alvo && ateOPrazo !== null && ateOPrazo > 0 ? Math.round(aporteNecessario(alvo, valorHoje, plano.cenarios.base, ateOPrazo) * 100) / 100 : null,
  }
}

export interface AportesDoMes { mes: string; valor: number }

/** Quanto entrou na carteira (menos o que saiu) em cada um dos últimos `n` meses fechados e no atual, do mais antigo ao mais novo. */
export function aportesPorMes(linha: PontoDaLinha[], hoje: string, n = 12): AportesDoMes[] {
  const meses = Array.from({ length: n }, (_, k) => somarMeses(`${hoje.slice(0, 7)}-01`, k - n + 1).slice(0, 7))
  const soma = new Map(meses.map((m) => [m, 0]))
  for (const p of linha) {
    const m = p.data.slice(0, 7)
    if (soma.has(m)) soma.set(m, soma.get(m)! + p.aporte)
  }
  return meses.map((mes) => ({ mes, valor: Math.round(soma.get(mes)! * 100) / 100 }))
}

/**
 * Média do que a pessoa aportou por mês nos últimos meses fechados (até 6), contando só a partir do mês da primeira
 * operação. O mês da primeira operação fica de fora quando há outros: ele costuma trazer a posição inteira de uma vez
 * (quem cadastra a carteira que já tinha), e isso não é ritmo de aporte.
 */
export function aporteMedio(linha: PontoDaLinha[], hoje: string): number {
  if (!linha.length) return 0
  const primeiro = linha[0].data.slice(0, 7)
  const fechados = aportesPorMes(linha, hoje, 7).slice(0, 6).filter((m) => m.mes > primeiro)
  if (!fechados.length) return 0
  return Math.max(0, Math.round((fechados.reduce((a, m) => a + m.valor, 0) / fechados.length) * 100) / 100)
}

export interface RendaPassiva {
  /** Média mensal dos proventos e juros recebidos nos últimos 12 meses. */
  mediaMensal: number
  /** Recebido em 12 meses ÷ valor da carteira hoje (0,062 = 6,2% ao ano); null sem carteira ou sem proventos. */
  retornoEmProventos: number | null
  /** Quanto de patrimônio rende `rendaAlvo` por mês, mantendo esse retorno (null sem alvo ou sem retorno observado). */
  patrimonioParaOAlvo: number | null
  /** Quanto do alvo a média de hoje já cobre (0 a 1). */
  progresso: number | null
}

export function rendaPassiva(proventos12m: number, valorHoje: number, rendaAlvo: number | null): RendaPassiva {
  const mediaMensal = Math.round((proventos12m / 12) * 100) / 100
  const retorno = valorHoje > 0 && proventos12m > 0 ? proventos12m / valorHoje : null
  return {
    mediaMensal, retornoEmProventos: retorno,
    patrimonioParaOAlvo: rendaAlvo && retorno ? Math.round(((rendaAlvo * 12) / retorno) * 100) / 100 : null,
    progresso: rendaAlvo ? Math.min(1, mediaMensal / rendaAlvo) : null,
  }
}
