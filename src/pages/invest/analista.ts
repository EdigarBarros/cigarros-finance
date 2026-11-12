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

export type Periodo = '6m' | '12m' | 'tudo'

/** O dia em que o período começa (null = desde a primeira operação). */
export function inicioDoPeriodo(periodo: Periodo, hoje: string, primeira: string | null): string | null {
  if (periodo === 'tudo' || !primeira) return null
  const de = somarMeses(hoje, periodo === '6m' ? -6 : -12)
  return primeira < de ? de : null
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
