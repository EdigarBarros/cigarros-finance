/**
 * A ponte entre a carteira e o resto do OpusCash, para o mesmo dinheiro nunca contar duas vezes.
 *
 * 1. **O valor investido do patrimônio sai da carteira.** Antes do Invest, a pessoa digitava um número por mês
 *    (meses.investimentos). Ele continua guardado e vale como histórico não detalhado até o mês anterior ao da primeira
 *    operação. Dali em diante, `mesesComCarteira` põe no lugar o valor da carteira no fim de cada mês (ou soma os dois, se
 *    a pessoa disse que o número antigo é de outros investimentos que ela não cadastrou). Nada é gravado em `meses`: é só
 *    o que o painel, o Consultor e o Dinheiro guardado leem.
 * 2. **Aplicar não cria dinheiro.** Uma operação pode dizer de que conta o dinheiro saiu (ou para qual voltou). Com
 *    `mexe_saldo`, o saldo dessa conta em Dinheiro guardado anda no sentido contrário (`efeitosDaOperacao`): R$ 1.000 da
 *    conta da corretora para um CDB tira 1.000 da conta e põe 1.000 na carteira, e o patrimônio fica igual. Provento
 *    recebido aumenta a conta: é dinheiro novo, e é só aí que o patrimônio cresce.
 *
 * Puro, como o motor.
 */
import type { EfeitoDatado } from '../guardado'
import type { Mes } from '../types'
import type { Operacao } from './tipos'

/** Quanto dinheiro a operação pôs na conta (positivo) ou tirou dela (negativo), na moeda do ativo. */
export function dinheiroNaConta(op: Pick<Operacao, 'tipo' | 'valor' | 'custos' | 'impostos'>): number {
  const liquido = op.valor - op.custos - op.impostos
  switch (op.tipo) {
    case 'compra': return -(op.valor + op.custos)
    case 'venda': case 'vencimento': case 'provento': case 'juros': return liquido
    case 'amortizacao': return op.valor
    case 'taxa': case 'imposto': return -op.valor
    default: return 0
  }
}

/**
 * O que a operação faz no saldo da conta ligada a ela, no mês da data da operação. Vazio quando a pessoa não ligou conta,
 * quando o app não mexeu no saldo (`mexe_saldo` falso) ou quando a operação não move dinheiro. `cotacao`: quanto vale 1 da
 * moeda do ativo na principal (os saldos dos bancos ficam na moeda principal).
 */
export function efeitosDaOperacao(op: Pick<Operacao, 'tipo' | 'valor' | 'custos' | 'impostos' | 'banco_id' | 'mexe_saldo' | 'data' | 'cotacao'>, sinal: 1 | -1 = 1, cotacaoHoje = 1): EfeitoDatado[] {
  if (!op.banco_id || !op.mexe_saldo) return []
  const delta = Math.round(dinheiroNaConta(op) * (op.cotacao ?? cotacaoHoje) * 100) / 100
  if (!delta) return []
  return [{ ano: Number(op.data.slice(0, 4)), mes: Number(op.data.slice(5, 7)), efeitos: [{ banco: op.banco_id, tipo: 'cc', delta: delta * sinal }] }]
}

/**
 * Os meses como o painel deve ler: do mês da primeira operação até o mês de hoje, `investimentos` é o valor da carteira no
 * fim do mês (mais o número antigo, se `legado` for 'somar'). Os meses de antes ficam como estavam.
 * @param valores 'AAAA-MM' → valor da carteira no fim do mês (lib/invest/carteira.ts, `valorPorMes`)
 */
export function mesesComCarteira(meses: Mes[], valores: Map<string, number>, legado: 'substituir' | 'somar'): Mes[] {
  if (!valores.size) return meses
  const chave = (ano: number, mes: number) => `${ano}-${String(mes).padStart(2, '0')}`
  const porChave = new Map(meses.map((m) => [chave(m.ano, m.mes), m]))
  // o número digitado que valeria em cada mês (ele passa de um mês para o outro até ser trocado)
  const emOrdem = [...meses].sort((a, b) => a.ano * 12 + a.mes - (b.ano * 12 + b.mes))
  const digitadoAte = (k: string) => {
    let v = 0
    for (const m of emOrdem) {
      if (chave(m.ano, m.mes) > k) break
      if (m.investimentos > 0) v = m.investimentos
    }
    return v
  }
  const novos: Mes[] = meses.filter((m) => !valores.has(chave(m.ano, m.mes)))
  for (const [k, valor] of valores) {
    const base = porChave.get(k) ?? { ano: Number(k.slice(0, 4)), mes: Number(k.slice(5, 7)), investimentos: 0, moedas: {}, meta_usd: 0, caixa: {} }
    const total = Math.round((valor + (legado === 'somar' ? digitadoAte(k) : 0)) * 100) / 100
    novos.push({ ...base, investimentos: total, investimentosDaCarteira: true })
  }
  return novos
}

/** O último número de investimentos digitado à mão antes do Invest (0 se nunca houve): o "saldo histórico não detalhado". */
export function legadoDigitado(meses: Mes[]): { valor: number; ano: number; mes: number } | null {
  const ultimo = [...meses].filter((m) => m.investimentos > 0 && !m.investimentosDaCarteira).sort((a, b) => b.ano * 12 + b.mes - (a.ano * 12 + a.mes))[0]
  return ultimo ? { valor: ultimo.investimentos, ano: ultimo.ano, mes: ultimo.mes } : null
}
