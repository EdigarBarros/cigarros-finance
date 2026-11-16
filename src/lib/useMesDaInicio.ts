import { useMemo } from 'react'
import { converter } from './moedas'
import { parcelasDoMes, type SituacaoDivida } from './dividas'
import { MESES_NOME, noMeioDaFrase } from './format'
import { situacaoMeta } from './metas'
import { tarefasDoMes } from './paraFazer'
import { comporPrevisao, type DiaADia, type ItemPrevisto } from './previsao'
import { situacaoDoMes, type Momento } from './situacaoDoMes'
import { compararGastos, pilulaDeGastos } from './comparacao'
import { tx } from './textos'
import { useHoje } from './useHoje'
import type { Ctx } from '../pages/contexto'

/**
 * O mês dia a dia com as parcelas de dívida que ainda vencem nele: todas as Inícios (computador e celular) preveem o fim do
 * mês com a mesma conta. As parcelas entram uma por uma (com nome) na lista do que ainda vem, e o "Entender previsão" mostra
 * a mesma conta.
 */
export function comParcelasDoMes(dd: DiaADia, { situacao, ano, mes, diaRef }: { situacao: SituacaoDivida[]; ano: number; mes: number; diaRef: string }): DiaADia {
  const parcelas = parcelasDoMes({ situacao, ano, mes, dias: dd.dias, hoje: dd.hoje, diaRef, soDoMes: dd.hoje === 0 })
  if (!parcelas.length) return dd
  const porDia = Array<number>(dd.dias).fill(0)
  for (const p of parcelas) porDia[p.dia - 1] += p.valor
  const total = parcelas.reduce((t, p) => t + p.valor, 0)
  const itens: ItemPrevisto[] = parcelas.map((p) => ({
    origem: 'parcela', tipo: 'saida', descricao: tx('{0}, parcela {1}', p.divida.divida.descricao, p.n), valor: p.valor, data: p.vencimento, atrasado: p.atrasada,
  }))
  return {
    ...dd, vaiSair: Math.round((dd.vaiSair + total) * 100) / 100,
    vaiSairDia: dd.vaiSairDia.map((n, i) => Math.round((n + porDia[i]) * 100) / 100), pendentes: [...dd.pendentes, ...itens],
  }
}

/**
 * Os números do mês aberto que as Inícios mostram (as do computador e a do celular): o mês dia a dia com as parcelas, o que
 * fazer, a previsão, o estado do mês e a comparação com o mês anterior. Só conta; nada aqui desenha.
 */
export function useMesDaInicio(c: Ctx) {
  const { v } = c
  // muda sozinho na virada do dia (a aba pode ficar aberta de um dia para o outro)
  const hoje = useHoje()
  const hojeIso = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`
  const nomeMes = noMeioDaFrase(MESES_NOME[c.mes - 1])
  // No mês de hoje os números contam só o que já aconteceu: parcela de cartão e conta com data mais para a frente ainda
  // não saíram do bolso (senão, no dia 4, o mês já aparece com as contas do dia 20 e um "faltou" que não aconteceu).
  const mesDeHoje = c.ano === hoje.getFullYear() && c.mes === hoje.getMonth() + 1
  const mesFuturo = c.ano * 12 + c.mes > hoje.getFullYear() * 12 + hoje.getMonth() + 1
  const momento: Momento = mesDeHoje ? 'atual' : mesFuturo ? 'futuro' : 'passado'
  const ddMes = useMemo(
    () => (v.dividas ? comParcelasDoMes(c.diaADia, { situacao: c.situacao, ano: c.ano, mes: c.mes, diaRef: c.diaRef }) : c.diaADia),
    [c.diaADia, c.situacao, c.ano, c.mes, c.diaRef, v.dividas],
  )
  // Contas, faturas e parcelas do mês numa lista só (a mesma em todos os jeitos): o que já venceu, o que vence logo e o resto.
  const tarefas = tarefasDoMes({
    ano: c.ano, mes: c.mes, contas: v.contas ? c.situacoesContas : [], faturas: v.cartoes ? c.faturas : [],
    dividas: v.dividas ? c.situacao.filter((s) => s.restante > 0) : [],
    diaRef: c.diaRef, aoPagarConta: c.pagarConta, aoPagarDivida: c.pagarDivida, aoVerCartoes: () => c.irPara('cartoes'),
  })
  // O estado do mês (favorável, atenção, crítico, sem dados), com os mesmos números em todos os jeitos: o "caminho certo"
  // não aparece mais quando a previsão do fim do mês está no vermelho (lib/situacaoDoMes.ts).
  const composicao = useMemo(() => comporPrevisao(ddMes), [ddMes])
  const atrasadasAPagar = tarefas.lista.filter((t) => t.estado === 'atrasada' && !t.entrada).length
  const situacao = situacaoDoMes({
    momento, entrou: ddMes.entrou, saiu: ddMes.saiu, vaiEntrar: ddMes.vaiEntrar, vaiSair: ddMes.vaiSair,
    atrasadas: atrasadasAPagar, receberAtrasado: composicao.receberAtrasado,
  })
  // Gastos contra o mesmo período do mês anterior. De outro ano, só há os últimos 12 meses fechados carregados.
  const idxAnterior = c.ano * 12 + c.mes - 1
  const comparavel = c.mes > 1 || idxAnterior >= hoje.getFullYear() * 12 + hoje.getMonth() + 1 - 12
  const comparacao = useMemo(
    () => (comparavel && !c.contaNova ? compararGastos({ lancs: c.lancsComparar, ano: c.ano, mes: c.mes, hoje: hojeIso, categoriaDe: (l) => c.categoriaDe(l)?.id }) : null),
    [comparavel, c.contaNova, c.lancsComparar, c.ano, c.mes, hojeIso, c.categoriaDe], // eslint-disable-line react-hooks/exhaustive-deps
  )
  // os gastos do mês até hoje por categoria, mesmo sem mês anterior carregado (o equilibrado mostra os principais)
  const gastosDoPeriodo = useMemo(
    () => (comparacao || c.contaNova ? null : compararGastos({ lancs: c.lancsComparar, ano: c.ano, mes: c.mes, hoje: hojeIso, categoriaDe: (l) => c.categoriaDe(l)?.id })),
    [comparacao, c.contaNova, c.lancsComparar, c.ano, c.mes, hojeIso, c.categoriaDe], // eslint-disable-line react-hooks/exhaustive-deps
  )
  // "gastando menos" com conta vencida sem baixa é elogio falso: a conta só não entrou nos gastos ainda
  const pilulaBruta = pilulaDeGastos(comparacao)
  const pilulaGastos = pilulaBruta && !(pilulaBruta.tom === 'bom' && atrasadasAPagar > 0 && momento === 'atual') ? pilulaBruta : null
  const situacaoMetas = c.d.metas.map((m) => situacaoMeta(m, c.d.movimentosMeta))
  // o mesmo número da tela Metas: tudo o que foi guardado sobre o total das metas (na moeda principal), não a média das metas
  const naPrincipal = (valor: number, moeda: string) => converter(valor, moeda, c.taxas) ?? 0
  const alvoDasMetas = situacaoMetas.reduce((t, s) => t + naPrincipal(s.meta.alvo, s.meta.moeda), 0)
  const progressoDasMetas = alvoDasMetas > 0 ? Math.min(1, situacaoMetas.reduce((t, s) => t + naPrincipal(s.guardado, s.meta.moeda), 0) / alvoDasMetas) : 0
  return {
    hoje, hojeIso, nomeMes, mesDeHoje, momento, ddMes, tarefas, composicao, situacao, comparacao, gastosDoPeriodo,
    atrasadasAPagar, pilulaGastos, situacaoMetas, progressoDasMetas,
  }
}

export type MesDaInicio = ReturnType<typeof useMesDaInicio>
