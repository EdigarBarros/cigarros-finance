import { ehGuardado } from './guardado'
import { contaNasSaidas } from './cartoes'
import type { PrevisaoMes } from './previsao'
import type { FaturaPaga, Lancamento, SaldoInicial } from './types'

/**
 * O saldo que passa de um mês para o outro. A pessoa diz uma vez quanto tinha no começo de um mês (`SaldoInicial`); daí em
 * diante cada mês começa com o saldo do fim do anterior e soma o que sobrou (ou tira o que faltou). É só uma conta: não vira
 * lançamento (o "Entrou" do primeiro mês continua sendo só o que entrou) e não mexe no saldo dos bancos.
 *
 * O que conta em cada mês é o mesmo "Sobrou/Faltou" do quadro do mês: o que já entrou menos o que já saiu, sem o dinheiro que
 * só foi guardado e sem as compras de fatura renegociada. No mês de hoje e nos seguintes, o que ainda vem (contas do mês sem
 * baixa, fatura em aberto) entra só no "vai ficar". Contas de meses que já passaram e não foram pagas não contam: não aconteceram.
 */
export interface SaldoDoMes {
  /** Com quanto o mês começou (o saldo do fim do anterior; no primeiro, o que a pessoa informou). */
  inicio: number
  /** O primeiro mês da conta: o "início" é o que a pessoa informou, não veio de outro mês. */
  primeiro: boolean
  /** Início + o que já aconteceu no mês (no mês de hoje, o saldo até agora). */
  fim: number
  /** Início + o que já aconteceu + o que ainda vem. Só no mês de hoje e nos seguintes; nos que passaram é null. */
  fimPrevisto: number | null
  /** O mês já acabou, é o de hoje ou ainda vai chegar. */
  quando: 'passado' | 'hoje' | 'futuro'
}

const centavos = (n: number) => Math.round(n * 100) / 100
export const chaveDoMes = (ano: number, mes: number) => ano * 12 + mes
/** "2026-03" → chave do mês (null se não for um mês válido). */
export function chaveDoTexto(texto: string): number | null {
  const m = /^(\d{4})-(\d{2})$/.exec(texto)
  if (!m || +m[2] < 1 || +m[2] > 12) return null
  return chaveDoMes(+m[1], +m[2])
}

/** Normaliza o que veio do banco ou do aparelho (qualquer coisa estranha vira null). */
export function normSaldoInicial(x: unknown): SaldoInicial | null {
  if (!x || typeof x !== 'object') return null
  const { valor, mes } = x as { valor?: unknown; mes?: unknown }
  const v = Number(valor)
  if (!Number.isFinite(v) || typeof mes !== 'string' || chaveDoTexto(mes) === null) return null
  return { valor: centavos(v), mes }
}

/**
 * Quanto sobrou (positivo) ou faltou (negativo) em cada mês de anos que não estão abertos na tela, pelos lançamentos.
 * Chave: `chaveDoMes(ano, mes)`. Mesma regra do quadro do mês para meses que já passaram.
 */
export function sobrasPorMes(lancs: Pick<Lancamento, 'ano' | 'mes' | 'tipo' | 'valor' | 'cartao_id' | 'guardado_banco_id'>[], faturasPagas: FaturaPaga[]): Map<number, number> {
  const conta = contaNasSaidas(faturasPagas)
  const r = new Map<number, number>()
  for (const l of lancs) {
    if (ehGuardado(l) || !conta(l as Lancamento)) continue
    const k = chaveDoMes(l.ano, l.mes)
    r.set(k, centavos((r.get(k) ?? 0) + (l.tipo === 'entrada' ? l.valor : -l.valor)))
  }
  return r
}

/**
 * O saldo de cada mês do ano aberto (null antes do mês de partida). `antes` são as sobras dos meses de anos anteriores ao
 * aberto (de `sobrasPorMes`); `previsto` é o que já aconteceu e o que ainda vem em cada mês do ano aberto (`previsaoDoAno`).
 */
export function saldosDoAno({ inicial, ano, previsto, antes, hoje = new Date() }: {
  inicial: SaldoInicial | null
  ano: number
  previsto: PrevisaoMes[]
  antes: Map<number, number>
  hoje?: Date
}): (SaldoDoMes | null)[] {
  const partida = inicial ? chaveDoTexto(inicial.mes) : null
  if (!inicial || partida === null) return Array(12).fill(null)
  const agora = chaveDoMes(hoje.getFullYear(), hoje.getMonth() + 1)
  // o que sobrou de janeiro do ano da partida até dezembro do ano anterior ao aberto
  let saldo = inicial.valor
  for (const [k, v] of antes) if (k >= partida && k < chaveDoMes(ano, 1)) saldo += v
  saldo = centavos(saldo)
  return previsto.map((p, i) => {
    const k = chaveDoMes(ano, i + 1)
    if (k < partida) return null
    const inicio = saldo
    const aconteceu = p.entrou - p.saiu
    const vem = p.vaiEntrar - p.vaiSair
    const quando = k < agora ? 'passado' : k === agora ? 'hoje' : 'futuro'
    const fim = centavos(inicio + aconteceu)
    const fimPrevisto = quando === 'passado' ? null : centavos(fim + vem)
    // o mês seguinte começa com o que este fechou (no de hoje e nos que vêm, com o que se espera que feche)
    saldo = fimPrevisto ?? fim
    return { inicio, primeiro: k === partida, fim, fimPrevisto, quando }
  })
}

/** O que as telas recebem: o saldo de cada mês do ano aberto, o ponto de partida e como trocá-lo (null tira). */
export interface SaldoCorrido {
  porMes: (SaldoDoMes | null)[]
  inicial: SaldoInicial | null
  salvar: (novo: SaldoInicial | null) => void
}
