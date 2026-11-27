/**
 * Cairo, parte de dados: dos registros do app até fatos com qualidade, parâmetros aprendidos da pessoa, condições de custo,
 * previsões com faixa e cenários. A parte de decisão (Claude 2) consome `LeituraDoCairo`.
 *
 * Contrato: docs/cairo/contrato.md. Puro: sem React, sem banco, sem relógio, sem texto (só códigos em `Motivo`).
 * `scripts/cairo/testar.mjs` confere que este arquivo carrega no Node sem navegador.
 */
import { CONTRATO_VERSAO, type CondicaoDeCusto, type Fluxo, type GeradorDeCenarios, type Motivo, type QualidadeDosDados } from './contrato/tipos'
import { REGRAS } from './contrato/politicas'
import { diasNoMes, diaIso, lerDia, numero, type DiaISO } from './contrato/unidades'
import type { EntradaCairo } from './entrada'
import { lancadosDepois, montarHistorico, type Historico } from './fatos/historico'
import { conferirContagem, type Contagem } from './fatos/contagem'
import { aprenderDiaADia, type ModeloDiaADia } from './aprendizado/diaADia'
import { aprenderEntradas, type FonteDeRenda } from './aprendizado/entradas'
import { aprenderPontualidade, type Pontualidade } from './aprendizado/pontualidade'
import { condicoesDeCusto } from './custos/condicoes'
import { criarGerador } from './cenarios/gerador'
import { prever, type Previsoes } from './previsao/previsao'

export const CAIRO_DADOS_VERSAO = '1.0.0'

export interface LeituraDoCairo {
  versao: { contrato: string; dados: string }
  hoje: DiaISO
  qualidade: QualidadeDosDados
  contagem: Contagem
  aprendizado: {
    diaADia: Omit<ModeloDiaADia, 'sortear' | 'dias'> | null
    entradas: Omit<FonteDeRenda, 'sortear'>[]
    pontualidade: Pontualidade[]
  }
  condicoes: CondicaoDeCusto[]
  /** Os futuros possíveis até o fim do horizonte (fim do mês que vem). Gera sob demanda. */
  cenarios: GeradorDeCenarios & { esperados: Fluxo[] }
  /** As faixas do gasto do dia a dia (400 cenários). Calculadas na primeira chamada e guardadas. */
  previsoes: () => Previsoes
  avisos: Motivo[]
}

function qualidadeDe(h: Historico, e: EntradaCairo): QualidadeDosDados {
  const avisos: Motivo[] = []
  // o saldo da conta corrente é "do mês": vale com certeza até o fim daquele mês, no máximo
  let saldo: QualidadeDosDados['saldo'] = { informado: false, validoAte: null, idadeMaximaDias: null }
  if (e.saldoContaCorrente) {
    const m = e.saldoContaCorrente.mes
    const a = Number(m.slice(0, 4)); const me = Number(m.slice(5, 7))
    if (a && me >= 1 && me <= 12) {
      const fim = diaIso(a, me, diasNoMes(a, me))
      const inicio = diaIso(a, me, 1)
      const idade = Math.max(0, numero(h.hoje) - numero(inicio))
      saldo = { informado: true, validoAte: fim, idadeMaximaDias: idade }
      if (fim < h.hoje) avisos.push({ codigo: 'saldo.de-mes-passado', params: { mes: m }, refs: [], regras: [] })
    }
  }
  const tol = REGRAS.lancadoDepoisDias
  const depois = lancadosDepois(h.lancs, tol.valor)
  if (depois.fracao > 0.2) avisos.push({ codigo: 'dados.muitos-lancados-depois', params: { fracao: Math.round(depois.fracao * 100), dias: depois.medianaDias }, refs: [], regras: [tol.id] })
  return {
    meses: h.qualidade, lancadosDepois: depois, semDataDeCriacao: h.lancs.filter((l) => l.semCriacao).length, saldo,
    avisos: [...avisos, ...h.qualidade.flatMap((q) => (q.gastos === 'parcial' ? [{ codigo: 'mes.parcial', params: { mes: q.mes }, refs: [], regras: [REGRAS.mesParcialFracao.id] }] : []))],
  }
}

/** A leitura completa. `e.hoje` é obrigatório: o Cairo não tem relógio. */
export function lerCairo(e: EntradaCairo): LeituraDoCairo {
  const h = montarHistorico(e)
  const qualidade = qualidadeDe(h, e)
  const contagem = conferirContagem(h.lancs, e.faturasPagas, e.compromissos, e.contasFixas)
  const diaADia = aprenderDiaADia(h)
  const fontes = aprenderEntradas(h, e.contasFixas)
  const pontualidade = aprenderPontualidade(e.dividas, e.promessas)
  const custos = condicoesDeCusto(e.dividas, e.conferencias, e.faturasPagas, e.jurosAprendidos, h.moeda)
  const ate = lerDia(e.horizonteAte) ?? h.hoje
  const cenarios = criarGerador({
    horizonte: { hoje: h.hoje, ate: ate < h.hoje ? h.hoje : ate }, moeda: h.moeda, compromissos: e.compromissos, contas: e.contasFixas,
    aReceber: e.aReceber, fontes, pontualidade, diaADia,
  })
  const a = Number(h.hoje.slice(0, 4)); const m = Number(h.hoje.slice(5, 7))
  let previstas: Previsoes | null = null
  const previsoes = () => (previstas ??= prever(cenarios, diaIso(a, m, diasNoMes(a, m)), diaADia?.nEf ?? 0, diaADia?.mediaDiaria.pesoDoHistorico ?? 0, Boolean(diaADia)))
  const semFuncao = <T extends object>(x: T, ...fora: (keyof T)[]) => Object.fromEntries(Object.entries(x).filter(([k]) => !fora.includes(k as keyof T)))
  return {
    versao: { contrato: CONTRATO_VERSAO, dados: CAIRO_DADOS_VERSAO },
    hoje: h.hoje,
    qualidade,
    contagem,
    aprendizado: {
      diaADia: diaADia ? (semFuncao(diaADia, 'sortear', 'dias') as LeituraDoCairo['aprendizado']['diaADia']) : null,
      entradas: fontes.map((f) => semFuncao(f, 'sortear') as Omit<FonteDeRenda, 'sortear'>),
      pontualidade,
    },
    condicoes: custos.condicoes,
    cenarios,
    previsoes,
    avisos: [...h.avisos, ...custos.avisos, ...qualidade.avisos, ...diaADia?.motivos ?? []],
  }
}

export type { EntradaCairo } from './entrada'
export * from './contrato/tipos'
export * from './contrato/unidades'
export { REGRAS } from './contrato/politicas'
export { revelar, trocarFuturo } from './cenarios/gerador'
export { qualidadeDosMeses, mesEntraNoFluxo, type ResumoDoMes } from './qualidade/meses'
export { classeDoLancamento, contaComoFluxo, type ClasseDoLancamento } from './fatos/movimentos'
export { contaValeNoMes } from './fatos/historico'
