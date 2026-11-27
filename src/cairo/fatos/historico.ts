/**
 * Os lançamentos validados e classificados: centavos, data civil, o que cada um é (renda, gasto, transferência…), se é gasto
 * do dia a dia e quando o app ficou sabendo dele. É a base da qualidade, do aprendizado e da régua.
 *
 * `conhecidoAte`: para a régua refazer o passado, só entra o que o app já sabia naquele dia (criado até ele). Sem
 * `created_at`, vale a data do próprio lançamento (é otimista, e a ficha de vazamento conta quantos são assim).
 */
import type { EntradaCairo, LancBruto } from '../entrada'
import type { Motivo, QualidadeDoMes } from '../contrato/tipos'
import { lerDiaValido, lerMoeda, lerValor } from '../contrato/validar'
import {
  chaveDoMes, diasEntre, lerDia, mesDe, mesIso, numero, type Centavos, type DiaISO, type MesISO, type Moeda,
} from '../contrato/unidades'
import { classeDoLancamento, type ClasseDoLancamento } from './movimentos'
import { declaracoesDosMeses, qualidadeDosMeses, type ResumoDoMes } from '../qualidade/meses'
import { recorrencias } from './recorrencias'

/** 12 meses fechados e o atual, como a análise do app. */
export const MESES_DA_JANELA = 12

export interface LancNormal {
  id: string
  dia: DiaISO | null
  mes: MesISO
  chave: number
  tipo: 'entrada' | 'saida'
  valor: Centavos
  classe: ClasseDoLancamento
  /** Gasto do dia a dia: não é conta do mês, cartão, dívida nem algo que se repete todo mês. */
  diaADia: boolean
  chaveDescricao: string
  contaFixa: string | null
  divida: string | null
  cartao: boolean
  descricao: string
  /** O dia em que o app soube (created_at) ou, sem ele, a data do lançamento. */
  conhecidoEm: DiaISO | null
  semCriacao: boolean
}

export interface Historico {
  hoje: DiaISO
  moeda: Moeda
  atual: number
  /** Chaves dos meses fechados da janela, do mais antigo ao mais novo. */
  fechados: number[]
  lancs: LancNormal[]
  resumos: ResumoDoMes[]
  qualidade: QualidadeDoMes[]
  avisos: Motivo[]
}

const normal = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
/** A mesma chave de descrição da análise do app ("Netflix 3/12" e "NETFLIX" são a mesma coisa). */
export const chaveDescricao = (s: string) => normal(s).replace(/\d+\s*\/\s*\d+/g, ' ').replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim()

/** A conta fixa vale no mês (pelo início, fim e se está ativa)? */
export function contaValeNoMes(c: { inicio: string; fim: string | null; ativa: boolean }, m: MesISO) {
  return c.ativa && c.inicio.slice(0, 7) <= m && (!c.fim || c.fim.slice(0, 7) >= m)
}

export function montarHistorico(e: EntradaCairo, conhecidoAte?: DiaISO): Historico {
  const avisos: Motivo[] = []
  const hojeV = lerDiaValido(e.hoje, 'hoje')
  if (!hojeV.ok) throw new Error(`Cairo: hoje inválido (${e.hoje})`)
  const hoje = hojeV.valor
  const moedaV = lerMoeda(e.moeda, 'moeda')
  const moeda = (moedaV.ok ? moedaV.valor : 'BRL') as Moeda
  if (!moedaV.ok) avisos.push(...moedaV.erros)
  const atual = chaveDoMes(mesDe(hoje))
  const fechados = Array.from({ length: MESES_DA_JANELA }, (_, i) => atual - MESES_DA_JANELA + i)

  const sentido = new Map(e.dividas.map((d) => [d.id, d.sentido ?? 'devo'] as const))
  const lancs: LancNormal[] = []
  for (const l of e.lancamentos) {
    const n = normalizar(l, moeda, (id) => sentido.get(id), avisos)
    if (!n) continue
    if (n.chave < atual - MESES_DA_JANELA || n.chave > atual) continue
    if (conhecidoAte && ((n.conhecidoEm && n.conhecidoEm > conhecidoAte) || (n.dia && n.dia > conhecidoAte))) continue
    lancs.push(n)
  }

  // o que se repete todo mês (fatos/recorrencias.ts, os critérios da análise do app) não é dia a dia
  const repetem = new Set(recorrencias(lancs, atual, 'saida').map((r) => r.chave))
  for (const l of lancs) {
    l.diaADia = l.classe === 'gasto' && !l.contaFixa && !l.cartao && !l.divida && !repetem.has(l.chaveDescricao)
  }

  const declarados = declaracoesDosMeses(e.marcasDosMeses ?? [])
  const resumos: ResumoDoMes[] = fechados.map((k) => {
    const doMes = lancs.filter((l) => l.chave === k)
    const m = mesIso(Math.floor((k - 1) / 12), ((k - 1) % 12) + 1)
    return {
      chave: k, mes: m,
      nEntradas: doMes.filter((l) => l.classe === 'renda').length,
      nSaidas: doMes.filter((l) => l.classe === 'gasto').length,
      esperavaEntradaFixa: e.contasFixas.some((c) => c.tipo === 'entrada' && contaValeNoMes(c, m)),
      ...contasDoMes(e.contasFixas, doMes, m),
      ...(declarados.get(m) ? { declarado: declarados.get(m) } : {}),
    }
  })
  return { hoje, moeda, atual, fechados, lancs, resumos, qualidade: qualidadeDosMeses(resumos), avisos }
}

function normalizar(l: LancBruto, moeda: Moeda, sentido: (id: string) => 'devo' | 'me_devem' | undefined, avisos: Motivo[]): LancNormal | null {
  const v = lerValor(l.valor, moeda, `lancamentos:${l.id}`)
  if (!v.ok) { avisos.push(...v.erros); return null }
  if (v.avisos.length) avisos.push(...v.avisos)
  if (v.valor.centavos <= 0) return null
  const dia = l.data ? lerDia(l.data) : null
  if (l.data && !dia) avisos.push({ codigo: 'data.invalida', params: { valor: l.data }, refs: [`lancamentos:${l.id}`], regras: [] })
  const criado = l.created_at ? lerDia(l.created_at) : null
  return {
    id: l.id, dia, mes: mesIso(l.ano, l.mes), chave: l.ano * 12 + l.mes, tipo: l.tipo, valor: v.valor.centavos,
    classe: classeDoLancamento(l, l.categoriaNome, sentido),
    diaADia: false, chaveDescricao: chaveDescricao(l.descricao),
    contaFixa: l.conta_fixa_id ?? null, divida: l.divida_id ?? null, cartao: Boolean(l.cartao_id), descricao: l.descricao,
    conhecidoEm: criado ?? dia, semCriacao: !criado,
  }
}

/** Lançados depois da data deles: quantos, a fração e a mediana do atraso em dias. */
export function lancadosDepois(lancs: LancNormal[], toleranciaDias: number) {
  const comAmbos = lancs.filter((l) => l.dia && !l.semCriacao && l.conhecidoEm)
  const atrasos = comAmbos.map((l) => diasEntre(l.dia!, l.conhecidoEm!)).filter((d) => d > toleranciaDias).sort((a, b) => a - b)
  return {
    quantos: atrasos.length,
    fracao: comAmbos.length ? atrasos.length / comAmbos.length : 0,
    medianaDias: atrasos.length ? atrasos[Math.floor(atrasos.length / 2)] : 0,
  }
}

export const idadeEmDias = (de: DiaISO, hoje: DiaISO) => numero(hoje) - numero(de)

/** Quantas contas fixas de saída valiam no mês e quantas delas tiveram baixa (um lançamento ligado à conta). */
export function contasDoMes(contas: { id: string; tipo: 'entrada' | 'saida'; inicio: string; fim: string | null; ativa: boolean }[], doMes: { contaFixa?: string | null; conta_fixa_id?: string | null }[], m: MesISO) {
  const valem = contas.filter((c) => c.tipo === 'saida' && contaValeNoMes(c, m))
  const baixadas = new Set(doMes.map((l) => l.contaFixa ?? l.conta_fixa_id ?? null).filter(Boolean))
  return { contasFixasSaida: valem.length, contasFixasBaixadas: valem.filter((c) => baixadas.has(c.id)).length }
}
