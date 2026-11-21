import { useMemo } from 'react'
import { importante, type Achado } from '../../lib/achados'
import { desempenho, pontoEm, type PontoDaLinha } from '../../lib/invest/carteira'
import { descobertas } from '../../lib/invest/descobertas'
import { diasEntre, somarDias, somarMeses } from '../../lib/invest/indices'
import { legadoDigitado } from '../../lib/invest/saldos'
import { fmtDataCurta, MESES_CURTO } from '../../lib/format'
import type { Ctx } from '../contexto'

/** Quanto uma descoberta que a pessoa já viu vários dias sem mudar desce (por dia a mais, até o teto). */
const CANSA = 3
const CANSA_NO_MAXIMO = 15

/**
 * As descobertas do Invest para esta pessoa, hoje (lib/invest/descobertas.ts), com o orçamento do Consultor quando há dados.
 * Para não repetir sem parar o que continua igual, a descoberta que a pessoa já viu em vários dias sem mudança perde um
 * pouco de força (a lembrança vem do gosto: `n` = em quantos dias ela viu a mesma versão). O que é importante nunca desce.
 */
export function useDescobertas(c: Ctx): Achado[] {
  const inv = c.invest
  const a = c.analise
  const { plano, importacoes, gosto } = inv.d
  const orcamento = useMemo(() => (a.renda > 0 && a.gastos > 0 ? { renda: a.renda, gastos: a.gastos, sobra: a.sobra } : null), [a.renda, a.gastos, a.sobra])
  const legado = useMemo(() => legadoDigitado(c.d.meses), [c.d.meses])
  return useMemo(() => {
    const lista = descobertas({ c: inv.c, linha: inv.linha, antes: inv.antes, plano, indices: inv.indices, importacoes, legado, orcamento })
    for (const x of lista) {
      const vista = gosto.achados[x.id]?.n ?? 0
      if (vista > 1 && !importante(x)) x.forca -= Math.min(CANSA_NO_MAXIMO, (vista - 1) * CANSA)
    }
    return lista.sort((x, y) => y.forca - x.forca)
    // o gosto usado é o da abertura da tela: os cartões não trocam de lugar enquanto a pessoa lê
  }, [inv.c, inv.linha, inv.antes, inv.indices, plano, importacoes, legado, orcamento]) // eslint-disable-line react-hooks/exhaustive-deps
}

export type Periodo = '1m' | '3m' | '6m' | '12m' | 'tudo'

const MESES_DO_PERIODO: Record<Exclude<Periodo, 'tudo'>, number> = { '1m': 1, '3m': 3, '6m': 6, '12m': 12 }

/** O dia em que o período começa (null = desde a primeira operação). */
export function inicioDoPeriodo(periodo: Periodo, hoje: string, primeira: string | null): string | null {
  if (periodo === 'tudo' || !primeira) return null
  const de = somarMeses(hoje, -MESES_DO_PERIODO[periodo])
  return primeira < de ? de : null
}

/** Um ponto do gráfico do valor: quanto valia, quanto tinha sido aportado e o ganho e a rentabilidade desde o início do período. */
export interface PontoDoValor { valor: number | null; aportado: number | null; ganho: number | null; rentabilidade: number | null }

/**
 * A linha do tempo pronta para o gráfico do valor (GraficoDoValor): pontos igualmente espaçados e, em cada um, o ganho e a
 * rentabilidade desde o começo do período, nas mesmas contas de `desempenho` (aporte não é ganho; provento é). Assim, ao
 * passar o dedo, o topo do gráfico diz quanto a carteira tinha ganhado até aquele dia.
 */
export function serieDoValor(linha: PontoDaLinha[], de: string | null, hoje: string, quantos = 96): { rotulos: string[]; pontos: PontoDoValor[] } {
  const { rotulos, pontos } = amostrar(linha, de, hoje, quantos)
  if (!pontos.length) return { rotulos, pontos: [] }
  // somas acumuladas de aportes e rendas, para o ganho de cada ponto sair sem refazer a linha inteira
  const posicao = new Map<PontoDaLinha, number>()
  const aportes: number[] = []
  const rendas: number[] = []
  linha.forEach((p, i) => {
    posicao.set(p, i)
    aportes.push((aportes[i - 1] ?? 0) + p.aporte)
    rendas.push((rendas[i - 1] ?? 0) + p.renda)
  })
  const base = de ? pontoEm(linha, de) : null
  const b = base ? posicao.get(base)! : -1
  const inicio = base?.valor ?? 0
  const indiceBase = base ? base.indice : 1
  const primeiroComValor = linha.find((p) => p.valor > 0.005)?.data ?? null
  return {
    rotulos,
    pontos: pontos.map((p) => {
      if (!p) return { valor: null, aportado: null, ganho: null, rentabilidade: null }
      const i = posicao.get(p)!
      const fluxo = i > b ? (aportes[i] - (aportes[b] ?? 0)) : 0
      const renda = i > b ? (rendas[i] - (rendas[b] ?? 0)) : 0
      return {
        valor: p.valor,
        aportado: p.aportado,
        ganho: p.valor - inicio - fluxo + renda,
        rentabilidade: primeiroComValor !== null && primeiroComValor < p.data && indiceBase > 0 ? p.indice / indiceBase - 1 : null,
      }
    }),
  }
}

/** A linha do tempo em pontos igualmente espaçados (para o eixo do gráfico andar no ritmo do calendário). */
export function amostrar(linha: PontoDaLinha[], de: string | null, hoje: string, quantos = 48): { rotulos: string[]; pontos: (PontoDaLinha | null)[] } {
  if (!linha.length) return { rotulos: [], pontos: [] }
  const inicio = de ?? linha[0].data
  const dias = Math.max(1, diasEntre(inicio, hoje))
  const n = Math.max(2, Math.min(quantos, dias + 1))
  const datas = Array.from({ length: n }, (_, i) => (i === n - 1 ? hoje : somarDias(inicio, Math.round((i * dias) / (n - 1)))))
  const curto = dias <= 92
  return {
    rotulos: datas.map((d) => (curto ? fmtDataCurta(d) : `${MESES_CURTO[Number(d.slice(5, 7)) - 1].slice(0, 3)}/${d.slice(2, 4)}`)),
    pontos: datas.map((d) => pontoEm(linha, d)),
  }
}

export { desempenho }
