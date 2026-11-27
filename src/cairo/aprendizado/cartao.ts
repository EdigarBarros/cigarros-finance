/**
 * As compras que a pessoa ainda vai fazer no cartão (pedido 9 de docs/cairo/coordenacao.md). Sem isto, a próxima fatura nos
 * cenários era só o que já estava lançado nela, e o caixa do mês que vem parecia mais folgado do que é.
 *
 * Aprende pelo dia da compra (`data_compra`) dos últimos 12 meses: cada dia é uma observação, com as compras que começaram
 * nele (valor da parcela, quantas parcelas e o cartão), inclusive os dias sem compra. Peso pela idade (meia-vida) e, como
 * no dia a dia, o mesmo dia da semana pesa mais, emprestando dos outros quando há poucos dias dele.
 *
 * Sem contagem dupla: só entram compras a partir de AMANHÃ (as de até hoje já estão na fatura da agenda). Compra que outra
 * pessoa paga (`pago_por`) fica fora.
 */
import { REGRAS } from '../contrato/politicas'
import { diaDaSemana, lerDia, numero, doNumero, type DiaISO } from '../contrato/unidades'
import type { CompraNoCartaoBruta } from '../entrada'
import type { Sorteio } from './aleatorio'
import { massa, nEfetivo, pesoPorIdade, type Obs } from './evidencia'

export interface CompraDoDia { cartao: string; parcela: number; parcelas: number }
export interface DiaDeCartao { dia: DiaISO; compras: CompraDoDia[]; peso: number; semana: number }

export interface ModeloDoCartao {
  /** Média por dia do que entra em faturas por compras novas (centavos, soma das parcelas). */
  mediaDiaria: number
  /** Média por dia da parcela k (0 = a primeira) de compras novas, por cartão: o que vai a cada fatura seguinte. */
  mediaPorParcela: Map<string, number[]>
  nEf: number
  dias: number
  sortear(dia: DiaISO, r: Sorteio): CompraDoDia[]
}

export function aprenderCartao(compras: CompraNoCartaoBruta[], hoje: DiaISO): ModeloDoCartao | null {
  const hojeN = numero(hoje)
  const inicio = hojeN - 365
  const porDia = new Map<number, CompraDoDia[]>()
  let primeiro = Infinity
  for (const c of compras) {
    if (c.pago_por && c.pago_por.trim()) continue
    // a compra começa na parcela 1 (sem parcela informada: à vista)
    if ((c.parcela ?? 1) !== 1) continue
    const d = lerDia(c.data_compra ?? '')
    if (!d) continue
    const n = numero(d)
    if (n < inicio || n >= hojeN || !(c.valor > 0)) continue
    primeiro = Math.min(primeiro, n)
    const lista = porDia.get(n) ?? []
    lista.push({ cartao: c.cartao_id, parcela: Math.round(c.valor * 100), parcelas: Math.max(1, c.parcelas ?? 1) })
    porDia.set(n, lista)
  }
  if (!Number.isFinite(primeiro)) return null
  const dias: DiaDeCartao[] = []
  for (let n = primeiro; n < hojeN; n++) {
    const d = doNumero(n)
    dias.push({ dia: d, compras: porDia.get(n) ?? [], peso: pesoPorIdade(hojeN - n), semana: diaDaSemana(d) })
  }
  const obs: Obs[] = dias.map((d) => ({ valor: d.compras.reduce((s, c) => s + c.parcela, 0), peso: d.peso }))
  if (massa(obs) < REGRAS.diaADiaMinimoDias.valor) return null
  const total = massa(obs)
  const mediaDiaria = obs.reduce((s, o) => s + o.valor * o.peso, 0) / total
  const mediaPorParcela = new Map<string, number[]>()
  for (const d of dias) for (const c of d.compras) {
    const v = mediaPorParcela.get(c.cartao) ?? []
    for (let k = 0; k < c.parcelas; k++) v[k] = (v[k] ?? 0) + (c.parcela * d.peso) / total
    mediaPorParcela.set(c.cartao, v)
  }
  for (const [k, v] of mediaPorParcela) mediaPorParcela.set(k, Array.from(v, (x) => x ?? 0))
  const k = REGRAS.forcaDaReferencia.valor
  const porSemana = Array.from({ length: 7 }, (_, s) => massa(obs.filter((_, i) => dias[i].semana === s)))
  const lambda = porSemana.map((m) => k / (k + m))
  const acumulados = Array.from({ length: 7 }, (_, s) => {
    let acc = 0
    return dias.map((x) => (acc += x.peso * (x.semana === s ? 1 : lambda[s])))
  })
  return {
    mediaDiaria, mediaPorParcela, nEf: nEfetivo(obs), dias: dias.length,
    sortear(dia: DiaISO, r: Sorteio) {
      const acc = acumulados[diaDaSemana(dia)]
      const alvo = r() * acc[acc.length - 1]
      let lo = 0; let hi = acc.length - 1
      while (lo < hi) { const m = (lo + hi) >> 1; if (acc[m] > alvo) hi = m; else lo = m + 1 }
      return dias[lo].compras
    },
  }
}
