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
  /** Contas fixas de saída que valiam no mês e quantas delas tiveram baixa: sinal de que o mês foi lançado com cuidado. */
  contasFixasSaida?: number
  contasFixasBaixadas?: number
  /** O que a pessoa disse do mês. */
  declarado?: 'completo' | 'incompleto'
}

const mediana = (xs: number[]) => {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

const m = (codigo: string, params: Record<string, number | string>, regras: string[]): Motivo => ({ codigo, params, refs: [], regras })

/**
 * A qualidade de cada mês, comparando cada um com os OUTROS meses da mesma lista (em ordem, do mais antigo ao mais novo).
 *
 * Mês com poucas saídas (menos de 35% do típico): pode ser lançamento que faltou ou gasto que caiu de verdade.
 *  - a pessoa disse: vale o que ela disse;
 *  - nível novo (dados.nivel-novo.meses): faz parte de meses baixos seguidos até o mais recente (ou de 3 seguidos): conta,
 *    com `incerto: 'nivel_novo'`. Quem cortou gastos não perde a nota;
 *  - contas em dia: as contas fixas de saída do mês têm todas baixa: conta, com `incerto: 'contas_em_dia'`;
 *  - senão (mês baixo isolado entre meses normais): fica fora das médias.
 * Nos meses recentes, em qualquer desses casos sem resposta da pessoa, vai `pergunta`.
 */
export function qualidadeDosMeses(meses: ResumoDoMes[]): QualidadeDoMes[] {
  const fracao = REGRAS.mesParcialFracao
  const minimo = REGRAS.mesParcialMinimoTipico
  const comRenda = REGRAS.rendaZeroMesesComRenda
  const nivel = REGRAS.nivelNovoMeses
  const recentes = REGRAS.perguntarMesesRecentes
  const tipicos = meses.map((x) => mediana(meses.filter((o) => o.chave !== x.chave && o.nSaidas > 0).map((o) => o.nSaidas)))
  const baixo = meses.map((x, i) => x.nSaidas > 0 && tipicos[i] >= minimo.valor && x.nSaidas < tipicos[i] * fracao.valor)
  // as sequências de meses baixos seguidos (o mês sem nada lançado interrompe)
  const sequencia = meses.map(() => ({ tamanho: 0, chegaAoFim: false }))
  for (let i = 0; i < meses.length;) {
    if (!baixo[i]) { i++; continue }
    let j = i
    while (j + 1 < meses.length && baixo[j + 1]) j++
    for (let k = i; k <= j; k++) sequencia[k] = { tamanho: j - i + 1, chegaAoFim: j === meses.length - 1 }
    i = j + 1
  }
  return meses.map((x, i) => {
    const tipico = tipicos[i]
    const outros = meses.filter((o) => o.chave !== x.chave)
    const motivos: Motivo[] = []
    const recente = i >= meses.length - recentes.valor
    const q: QualidadeDoMes = { mes: x.mes, gastos: 'conta', renda: 'conta', motivos }
    if (x.declarado) q.declarado = x.declarado
    const vazio = x.nEntradas + x.nSaidas === 0

    if (vazio) q.gastos = 'sem_registros'
    else if (x.declarado === 'completo') { q.gastos = 'conta'; motivos.push(m('mes.confirmado-completo', {}, [])) }
    else if (x.declarado === 'incompleto') { q.gastos = 'parcial'; motivos.push(m('mes.confirmado-incompleto', {}, [])) }
    else if (x.nSaidas === 0) {
      q.gastos = 'parcial'
      motivos.push(m('mes.sem-saidas', { entradas: x.nEntradas }, []))
      if (recente) q.pergunta = { motivo: 'poucas_saidas', saidas: 0, tipico }
    } else if (baixo[i]) {
      const s = sequencia[i]
      const contasEmDia = (x.contasFixasSaida ?? 0) > 0 && (x.contasFixasBaixadas ?? 0) >= (x.contasFixasSaida ?? 0)
      if ((s.chegaAoFim && s.tamanho >= nivel.valor) || s.tamanho >= 3) {
        q.gastos = 'conta'; q.incerto = 'nivel_novo'
        motivos.push(m('mes.nivel-novo', { saidas: x.nSaidas, tipico, meses: s.tamanho }, [fracao.id, nivel.id]))
      } else if (contasEmDia) {
        q.gastos = 'conta'; q.incerto = 'contas_em_dia'
        motivos.push(m('mes.poucas-saidas-contas-em-dia', { saidas: x.nSaidas, tipico, contas: x.contasFixasSaida ?? 0 }, [fracao.id]))
      } else {
        q.gastos = 'parcial'
        motivos.push(m('mes.poucas-saidas', { saidas: x.nSaidas, tipico }, [fracao.id, minimo.id]))
      }
      if (recente) q.pergunta = { motivo: 'poucas_saidas', saidas: x.nSaidas, tipico }
    }

    if (vazio) q.renda = 'sem_registros'
    else if (x.nEntradas > 0) q.renda = 'conta'
    else {
      const mesesComRenda = outros.filter((o) => o.nEntradas > 0).length
      // "está tudo lançado" vale também para a renda: sem entrada, foi mês sem renda
      if (x.declarado === 'completo' || (q.gastos === 'conta' && mesesComRenda >= comRenda.valor && !x.esperavaEntradaFixa)) {
        q.renda = 'zero_real'
        motivos.push(m('mes.renda-zero', { mesesComRenda }, [comRenda.id]))
      } else {
        q.renda = 'nao_registrada'
        motivos.push(m(x.esperavaEntradaFixa ? 'mes.entrada-fixa-sem-baixa' : 'mes.renda-incerta', { mesesComRenda }, [comRenda.id]))
        if (recente && !x.declarado && x.esperavaEntradaFixa && q.gastos === 'conta' && !q.pergunta) q.pergunta = { motivo: 'renda_nao_registrada', saidas: x.nSaidas, tipico }
      }
    }
    return q
  })
}

/** O mês entra nas médias de renda, gasto e sobra (as três juntas, para a sobra ser de meses comparáveis)? */
export const mesEntraNoFluxo = (q: Pick<QualidadeDoMes, 'gastos' | 'renda'>) =>
  q.gastos === 'conta' && (q.renda === 'conta' || q.renda === 'zero_real')

// ---------- o que a pessoa disse de cada mês ----------

/** As marcas guardadas no perfil (`perfil.dispensadas`, sem migração): "mes-completo:2026-09" e "mes-incompleto:2026-09". */
export const marcaDoMes = (mes: string, declarado: 'completo' | 'incompleto') => `mes-${declarado}:${mes}`
const RE_MARCA = /^mes-(completo|incompleto):(\d{4}-\d{2})$/

/** O que a pessoa disse de cada mês, pelas marcas. Se houver as duas para o mesmo mês, vale a última da lista. */
export function declaracoesDosMeses(marcas: readonly string[]): Map<string, 'completo' | 'incompleto'> {
  const out = new Map<string, 'completo' | 'incompleto'>()
  for (const x of marcas) {
    const r = RE_MARCA.exec(x)
    if (r) out.set(r[2], r[1] as 'completo' | 'incompleto')
  }
  return out
}

/** As marcas depois de a pessoa responder sobre um mês: tira a resposta anterior do mesmo mês e põe a nova. */
export function declararMes(marcas: readonly string[], mes: string, declarado: 'completo' | 'incompleto' | null): string[] {
  const sem = marcas.filter((x) => x !== marcaDoMes(mes, 'completo') && x !== marcaDoMes(mes, 'incompleto'))
  return declarado ? [...sem, marcaDoMes(mes, declarado)] : sem
}
