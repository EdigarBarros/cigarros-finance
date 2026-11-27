/**
 * A taxa que os pagamentos embutem: dados o dinheiro que entrou e os pagamentos (cada um com a data), a taxa ao mês que faz
 * tudo valer zero na mesma data (a TIR com datas). Puro.
 *
 * Ela descreve só os fluxos informados. Não é o CET (custo efetivo total) quando faltam componentes: IOF cobrado à parte,
 * tarifas, seguro, a data exata em que o dinheiro caiu. E não é necessariamente a taxa do contrato: um pagamento atrasado
 * com multa sobe a taxa dos fluxos sem mudar o contrato. Por isso ela nunca vira, sozinha, desconto de antecipação
 * (lib/decisoes/custos.ts decide isso pela taxa do contrato).
 */
import { diasEntre } from './custos'

export interface Fluxo {
  data: string
  /** Positivo: dinheiro que a pessoa recebeu. Negativo: o que ela pagou. */
  valor: number
}

export type ComponenteDoCET = 'iof' | 'tarifas' | 'seguro' | 'data-do-recebimento' | 'pagamentos-futuros'

export interface TaxaDosFluxos {
  /** % ao mês (30 dias), juros compostos. */
  mes: number
  /** % ao ano equivalente. */
  ano: number
  fluxos: number
  /** O que falta para essa taxa ser o CET: o app só diz "taxa dos fluxos". */
  faltaParaCET: ComponenteDoCET[]
  /** Teste de sanidade: o valor presente dos fluxos à taxa achada (perto de zero). */
  residuo: number
}

/** Valor dos fluxos na data do primeiro, a `i` ao mês (fração: 0,03 = 3%). */
export function valorNaData(fluxos: Fluxo[], i: number, base = fluxos[0]?.data) {
  if (!base) return 0
  return fluxos.reduce((s, f) => s + f.valor / Math.pow(1 + i, diasEntre(base, f.data) / 30), 0)
}

/**
 * A taxa ao mês que zera os fluxos, por bisseção (só converge com pelo menos uma entrada e uma saída). null quando não há
 * taxa que explique os números (pagou menos do que recebeu: taxa negativa não é custo; ou um sinal só).
 */
export function taxaDosFluxos(fluxos: Fluxo[], opcoes: { faltaParaCET?: ComponenteDoCET[] } = {}): TaxaDosFluxos | null {
  const fs = fluxos.filter((f) => Math.abs(f.valor) > 0.004).sort((a, b) => a.data.localeCompare(b.data))
  if (fs.length < 2 || !fs.some((f) => f.valor > 0) || !fs.some((f) => f.valor < 0)) return null
  const recebido = fs.filter((f) => f.valor > 0).reduce((s, f) => s + f.valor, 0)
  const pago = -fs.filter((f) => f.valor < 0).reduce((s, f) => s + f.valor, 0)
  if (pago < recebido - 0.004) return null
  const v = (i: number) => valorNaData(fs, i)
  // recebe antes e paga depois: com taxa 0, v = recebido − pago ≤ 0; quanto maior a taxa, menos pesam os pagamentos (v sobe)
  let lo = 0, hi = 1
  if (v(lo) > 0.004) return null
  while (v(hi) < 0 && hi < 1000) hi *= 2
  if (v(hi) < 0) return null
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2
    if (v(mid) < 0) lo = mid
    else hi = mid
  }
  const i = (lo + hi) / 2
  return {
    mes: Math.round(i * 1e6) / 1e4, ano: Math.round((Math.pow(1 + i, 12) - 1) * 1e6) / 1e4, fluxos: fs.length,
    faltaParaCET: opcoes.faltaParaCET ?? ['iof', 'tarifas', 'seguro'], residuo: Math.round(v(i) * 100) / 100,
  }
}
