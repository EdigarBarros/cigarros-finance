/**
 * Quais meses podem entrar nas médias, e como. Mês sem registro não é mês sem renda; mês com poucas saídas lançadas não é
 * mês econômico. Antes, só contavam os meses com entradas E saídas: o mês de desemprego sumia da média e a renda saía
 * inflada, justamente para quem mais precisava de cuidado.
 *
 * Sem a pessoa dizer "esse mês está completo" (fica para uma migração), o Cairo infere pelo costume dela:
 *  - gastos 'parcial' quando o mês tem bem menos saídas que o mês típico DELA (regra dados.mes-parcial.*);
 *  - renda 'zero_real' quando o mês de gastos está bem registrado, a pessoa costuma lançar o que recebe e nenhuma conta
 *    fixa de entrada daquele mês ficou sem baixa; senão 'nao_registrada' (não dá para saber).
 *
 * Puro: usado pelo Cairo e pelo Consultor antigo (lib/analise.ts, lib/conselheiro.ts), com os mesmos números.
 */
import type { Motivo, QualidadeDoMes } from '../contrato/tipos'
import { REGRAS } from '../contrato/politicas'
import type { MesISO } from '../contrato/unidades'

export interface ResumoDoMes {
  /** Identifica o mês na lista (qualquer numeração crescente: o app e o Cairo numeram diferente). */
  chave: number
  /** O mês civil. */
  mes: MesISO
  /** Quantas entradas e saídas que contam como renda e gasto (sem empréstimo, devolução e transferência entre bolsos). */
  nEntradas: number
  nSaidas: number
  /** Há conta fixa de entrada ativa nesse mês (salário, pensão)? Se houver e não entrou nada, pode ter faltado lançar. */
  esperavaEntradaFixa: boolean
}

const mediana = (xs: number[]) => {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

const m = (codigo: string, params: Record<string, number | string>, regras: string[]): Motivo => ({ codigo, params, refs: [], regras })

/** A qualidade de cada mês, comparando cada um com os OUTROS meses da mesma lista. */
export function qualidadeDosMeses(meses: ResumoDoMes[]): QualidadeDoMes[] {
  const fracao = REGRAS.mesParcialFracao
  const minimo = REGRAS.mesParcialMinimoTipico
  const comRenda = REGRAS.rendaZeroMesesComRenda
  return meses.map((x) => {
    const outros = meses.filter((o) => o.chave !== x.chave)
    const tipico = mediana(outros.filter((o) => o.nSaidas > 0).map((o) => o.nSaidas))
    const motivos: Motivo[] = []
    let gastos: QualidadeDoMes['gastos']
    if (x.nEntradas + x.nSaidas === 0) gastos = 'sem_registros'
    else if (x.nSaidas === 0) {
      gastos = 'parcial'
      motivos.push(m('mes.sem-saidas', { entradas: x.nEntradas }, []))
    } else if (tipico >= minimo.valor && x.nSaidas < tipico * fracao.valor) {
      gastos = 'parcial'
      motivos.push(m('mes.poucas-saidas', { saidas: x.nSaidas, tipico }, [fracao.id, minimo.id]))
    } else gastos = 'conta'

    let renda: QualidadeDoMes['renda']
    if (x.nEntradas + x.nSaidas === 0) renda = 'sem_registros'
    else if (x.nEntradas > 0) renda = 'conta'
    else {
      const mesesComRenda = outros.filter((o) => o.nEntradas > 0).length
      if (gastos === 'conta' && mesesComRenda >= comRenda.valor && !x.esperavaEntradaFixa) {
        renda = 'zero_real'
        motivos.push(m('mes.renda-zero', { mesesComRenda }, [comRenda.id]))
      } else {
        renda = 'nao_registrada'
        motivos.push(m(x.esperavaEntradaFixa ? 'mes.entrada-fixa-sem-baixa' : 'mes.renda-incerta', { mesesComRenda }, [comRenda.id]))
      }
    }
    return { mes: x.mes, gastos, renda, motivos }
  })
}

/** O mês entra nas médias de renda, gasto e sobra (as três juntas, para a sobra ser de meses comparáveis)? */
export const mesEntraNoFluxo = (q: Pick<QualidadeDoMes, 'gastos' | 'renda'>) =>
  q.gastos === 'conta' && (q.renda === 'conta' || q.renda === 'zero_real')
