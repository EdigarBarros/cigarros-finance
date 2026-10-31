/**
 * Apoio da tela "Saúde do seu dinheiro" (components/BlocoConselhos.tsx): duas perguntas que o motor
 * (lib/conselheiro.ts) não responde quando devolve uma lista vazia.
 *  - Faltam dados? (poucos meses fechados com entradas e saídas: o motor fica calado porque não tem base)
 *  - Quantos avisos a pessoa dispensou neste mês? (a lista vazia pode ser "tudo em ordem" ou "você escondeu tudo")
 * Usa as mesmas constantes e o mesmo critério do motor (empréstimo não conta como entrada nem como saída).
 */
import { chaveMes } from './cartoes'
import { MESES_NA_MEDIA, MIN_MESES_COM_DADOS } from './conselheiro'
import { aumentaDivida } from './dividas'
import type { Divida, Lancamento } from './types'

/** true quando não há meses fechados suficientes com entradas E saídas lançadas para o conselheiro opinar. */
export function faltamDadosParaConselhos(lancs: Lancamento[], dividas: Divida[], hoje = new Date()): boolean {
  const atual = chaveMes(hoje.getFullYear(), hoje.getMonth() + 1)
  const dividaPorId = new Map(dividas.map((d) => [d.id, d]))
  const meses = new Map<number, { entrou: boolean; saiu: boolean }>()
  for (const l of lancs) {
    const k = chaveMes(l.ano, l.mes)
    if (k >= atual || k < atual - MESES_NA_MEDIA || !(l.valor > 0)) continue
    const d = l.divida_id ? dividaPorId.get(l.divida_id) : undefined
    if (d && aumentaDivida(l.tipo, d)) continue
    const m = meses.get(k) ?? { entrou: false, saiu: false }
    if (l.tipo === 'entrada') m.entrou = true
    else m.saiu = true
    meses.set(k, m)
  }
  return [...meses.values()].filter((m) => m.entrou && m.saiu).length < MIN_MESES_COM_DADOS
}

/** Quantos avisos a pessoa mandou esconder "por este mês" (marcas `id@AAAA-MM` de `perfil.dispensadas`). */
export function avisosDispensadosNoMes(dispensadas: string[], hoje = new Date()): number {
  const marca = `@${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
  return dispensadas.filter((x) => x.endsWith(marca)).length
}
