/**
 * A régua: o Cairo melhora a previsão de verdade, ou só parece? Refaz o passado com o que o app SABIA em cada data (o
 * lançamento só entra depois do `created_at`) e compara com o que aconteceu.
 *
 * O que se prevê hoje: o gasto do dia a dia do resto do mês, a partir de um dia de corte. Contra duas referências simples:
 *  - 'media-mensal': a média mensal do dia a dia dos 3 últimos meses fechados ÷ 30,4 × dias que faltam (o que o motor
 *    antigo usa no `ritmoDia`);
 *  - 'ritmo-do-mes': o que já saiu no mês ÷ dias passados × dias que faltam.
 * Métricas: erro absoluto da mediana, perda por quantil (p10 e p90: pune mais o erro do lado caro), cobertura da faixa de
 * 80% e largura dela.
 *
 * LIMITES (vão na ficha de vazamento de cada rodada): sem histórico de edições, um valor corrigido depois aparece corrigido
 * no passado; o apagado some. Por isso a régua dá comparação RELATIVA entre métodos nos mesmos dados, não erro absoluto
 * garantido. O teste de sensibilidade apaga 5% dos lançamentos e confere se a ordem entre os métodos se mantém.
 */
import { REGRAS } from '../contrato/politicas'
import { diasEntre, diasNoMes, diaIso, type DiaISO } from '../contrato/unidades'
import type { EntradaCairo } from '../entrada'
import { lancadosDepois, montarHistorico, type Historico } from '../fatos/historico'
import { aprenderDiaADia } from '../aprendizado/diaADia'
import { aprenderEntradas } from '../aprendizado/entradas'
import { criarGerador } from '../cenarios/gerador'
import { diaADiaEntre } from '../previsao/previsao'
import { sementeDe, sorteio } from '../aprendizado/aleatorio'

export const REGUA_VERSAO = '1.0.0'

export interface Ponto { corte: DiaISO; real: number; previsto: Record<string, number>; p10: number | null; p90: number | null }

export interface Resultado {
  pontos: Ponto[]
  metodos: Record<string, { erroMedio: number; erroRelativo: number; pinball10?: number; pinball90?: number }>
  cobertura80: number | null
  larguraRelativa: number | null
  ficha: { lancadosDepoisFracao: number; semCriacao: number; semHistoricoDeEdicoes: true; ordemEstavel: boolean | null; aviso: string }
}

const fimDoMes = (d: DiaISO) => diaIso(Number(d.slice(0, 4)), Number(d.slice(5, 7)), diasNoMes(Number(d.slice(0, 4)), Number(d.slice(5, 7))))
const pinball = (real: number, q: number, tau: number) => (real >= q ? tau * (real - q) : (1 - tau) * (q - real))

/** O dia a dia de verdade de (corte, fim do mês], pela leitura de hoje (o que se sabe agora). */
function realEntre(h: Historico, corte: DiaISO, ate: DiaISO) {
  return h.lancs.filter((l) => l.diaADia && l.dia && l.dia > corte && l.dia <= ate).reduce((s, l) => s + l.valor, 0)
}

function preverEm(e: EntradaCairo, corte: DiaISO, n: number) {
  const h = montarHistorico({ ...e, hoje: corte }, corte)
  const ate = fimDoMes(corte)
  const restantes = diasEntre(corte, ate)
  const mesCorte = Number(corte.slice(0, 4)) * 12 + Number(corte.slice(5, 7))
  // referência 1: média mensal dos 3 últimos fechados com gastos bem registrados
  const fechadosOk = h.fechados.filter((_, i) => h.qualidade[i].gastos === 'conta').slice(-3)
  const mensal = fechadosOk.length
    ? fechadosOk.map((k) => h.lancs.filter((l) => l.chave === k && l.diaADia).reduce((s, l) => s + l.valor, 0)).reduce((a, b) => a + b, 0) / fechadosOk.length
    : null
  // referência 2: o ritmo do próprio mês
  const passados = Number(corte.slice(8, 10))
  const noMes = h.lancs.filter((l) => l.chave === mesCorte && l.diaADia && l.dia && l.dia <= corte).reduce((s, l) => s + l.valor, 0)
  const m = aprenderDiaADia(h)
  let p10: number | null = null; let p50: number | null = null; let p90: number | null = null
  if (m) {
    const g = criarGerador({ horizonte: { hoje: corte, ate }, moeda: h.moeda, compromissos: [], contas: [], aReceber: [], fontes: aprenderEntradas(h, e.contasFixas), pontualidade: [], diaADia: m })
    const xs = g.gerar(n, sementeDe(`regua:${corte}`)).map((w) => diaADiaEntre(w, corte, ate)).sort((a, b) => a - b)
    const q = (t: number) => xs[Math.min(xs.length - 1, Math.floor(t * (xs.length - 1)))]
    p10 = q(0.1); p50 = q(0.5); p90 = q(0.9)
  }
  return {
    restantes,
    previsto: {
      ...(mensal !== null ? { 'media-mensal': (mensal / 30.4) * restantes } : {}),
      ...(passados > 0 ? { 'ritmo-do-mes': (noMes / passados) * restantes } : {}),
      ...(p50 !== null ? { cairo: p50 } : {}),
    } as Record<string, number>,
    p10, p90,
  }
}

/** Cortes: dias 5, 15 e 25 dos últimos `meses` meses fechados bem registrados. */
export function cortesPadrao(h: Historico, meses = 6): DiaISO[] {
  const ok = h.fechados.filter((_, i) => h.qualidade[i].gastos === 'conta').slice(-meses)
  return ok.flatMap((k) => {
    const a = Math.floor((k - 1) / 12); const m = ((k - 1) % 12) + 1
    return [5, 15, 25].map((d) => diaIso(a, m, d))
  })
}

function resumir(pontos: Ponto[]): Pick<Resultado, 'metodos' | 'cobertura80' | 'larguraRelativa'> {
  const metodos: Resultado['metodos'] = {}
  const nomes = [...new Set(pontos.flatMap((p) => Object.keys(p.previsto)))]
  const comTodos = pontos.filter((p) => nomes.every((n) => n in p.previsto))
  const mediaReal = comTodos.reduce((s, p) => s + p.real, 0) / Math.max(1, comTodos.length)
  for (const n of nomes) {
    const erros = comTodos.map((p) => Math.abs(p.previsto[n] - p.real))
    const erroMedio = erros.reduce((a, b) => a + b, 0) / Math.max(1, erros.length)
    metodos[n] = { erroMedio, erroRelativo: mediaReal > 0 ? erroMedio / mediaReal : 0 }
  }
  const comFaixa = comTodos.filter((p) => p.p10 !== null && p.p90 !== null)
  if (metodos.cairo && comFaixa.length) {
    metodos.cairo.pinball10 = comFaixa.reduce((s, p) => s + pinball(p.real, p.p10!, 0.1), 0) / comFaixa.length
    metodos.cairo.pinball90 = comFaixa.reduce((s, p) => s + pinball(p.real, p.p90!, 0.9), 0) / comFaixa.length
  }
  return {
    metodos,
    cobertura80: comFaixa.length ? comFaixa.filter((p) => p.real >= p.p10! && p.real <= p.p90!).length / comFaixa.length : null,
    larguraRelativa: comFaixa.length && mediaReal > 0 ? comFaixa.reduce((s, p) => s + (p.p90! - p.p10!), 0) / comFaixa.length / mediaReal : null,
  }
}

const melhor = (r: Pick<Resultado, 'metodos'>) => Object.entries(r.metodos).sort((a, b) => a[1].erroMedio - b[1].erroMedio)[0]?.[0] ?? null

export function avaliarDiaADia(e: EntradaCairo, cortes?: DiaISO[], cenarios = 200): Resultado {
  const agora = montarHistorico(e)
  const lista = cortes ?? cortesPadrao(agora)
  const rodar = (entrada: EntradaCairo) => {
    const h = montarHistorico(entrada)
    return lista.map((c) => {
      const p = preverEm(entrada, c, cenarios)
      return { corte: c, real: realEntre(h, c, fimDoMes(c)), previsto: p.previsto, p10: p.p10, p90: p.p90 }
    })
  }
  const pontos = rodar(e)
  const r = resumir(pontos)
  // sensibilidade: apaga 5% dos lançamentos (como se tivessem sido excluídos) e confere se o melhor método continua o mesmo
  const s = sorteio(sementeDe('sensibilidade'))
  const perturbada = { ...e, lancamentos: e.lancamentos.filter(() => s() >= 0.05) }
  const rp = resumir(rodar(perturbada))
  const ordemEstavel = melhor(r) === null ? null : melhor(r) === melhor(rp)
  const dep = lancadosDepois(agora.lancs, REGRAS.lancadoDepoisDias.valor)
  return {
    pontos, ...r,
    ficha: {
      lancadosDepoisFracao: dep.fracao,
      semCriacao: agora.lancs.filter((l) => l.semCriacao).length,
      semHistoricoDeEdicoes: true,
      ordemEstavel,
      aviso: ordemEstavel === false
        ? 'inconclusivo: apagar 5% dos lançamentos troca o melhor método'
        : 'comparação relativa: valores corrigidos depois e registros apagados não são vistos no passado',
    },
  }
}
