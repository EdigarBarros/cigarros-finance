import type { Divida, Pagamento, SaldoDivida } from './types'

const pad = (n: number) => String(n).padStart(2, '0')
export const fimDoMes = (ano: number, mes: number) => `${ano}-${pad(mes)}-${pad(new Date(ano, mes, 0).getDate())}`
export const inicioDoMes = (ano: number, mes: number) => `${ano}-${pad(mes)}-01`
const mesAnterior = (ano: number, mes: number): [number, number] => (mes === 1 ? [ano - 1, 12] : [ano, mes - 1])

export interface SituacaoDivida {
  divida: Divida
  /** Saldo devedor no fim do mês. */
  restante: number
  /** Saldo no fim do mês anterior (null se a dívida ainda não existia). */
  restanteAntes: number | null
  /** Maior saldo já registrado, base para o progresso. */
  saldoInicial: number
  pagoNoMes: number
  pagamentosNoMes: number
  totalPago: number
  /** Meses que faltam pagando a parcela (null sem parcela definida). */
  mesesRestantes: number | null
  /** [ano, mes] previsto para quitar. */
  quitacao: [number, number] | null
  quitadaNoMes: boolean
}

/** Saldo devedor numa data: último saldo informado até ela, menos os pagamentos feitos depois dele. */
export function saldoEm(divida: Divida, saldos: SaldoDivida[], pagamentos: Pagamento[], ate: string): number | null {
  const marcos = saldos.filter((s) => s.divida_id === divida.id && s.data <= ate).sort((a, b) => a.data.localeCompare(b.data))
  const marco = marcos[marcos.length - 1]
  if (!marco) return null
  const pagoDepois = pagamentos
    .filter((p) => p.divida_id === divida.id && p.data && p.data > marco.data && p.data <= ate)
    .reduce((a, p) => a + p.valor, 0)
  return Math.max(0, Math.round((marco.saldo - pagoDepois) * 100) / 100)
}

/** Dívidas que aparecem no mês: as que existiam e não estavam quitadas antes dele. */
export function situacaoDividas(
  dividas: Divida[], saldos: SaldoDivida[], pagamentos: Pagamento[], ano: number, mes: number,
): SituacaoDivida[] {
  const fim = fimDoMes(ano, mes)
  const ini = inicioDoMes(ano, mes)
  const fimAntes = fimDoMes(...mesAnterior(ano, mes))
  const lista: SituacaoDivida[] = []
  for (const d of dividas) {
    const restante = saldoEm(d, saldos, pagamentos, fim)
    if (restante === null) continue
    const restanteAntes = saldoEm(d, saldos, pagamentos, fimAntes)
    // Criada e quitada no mesmo mês: sem saldo antes, mas teve saldo positivo neste mês.
    const devendoNoMes = restanteAntes === null
      ? saldos.some((s) => s.divida_id === d.id && s.data >= ini && s.data <= fim && s.saldo > 0)
      : restanteAntes > 0
    if (restante <= 0 && !devendoNoMes) continue
    const doMes = pagamentos.filter((p) => p.divida_id === d.id && p.data && p.data >= ini && p.data <= fim)
    const parcela = d.valor_parcela ?? 0
    const mesesRestantes = parcela > 0 && restante > 0 ? Math.ceil(restante / parcela - 0.001) : null
    let quitacao: [number, number] | null = null
    if (mesesRestantes !== null) {
      const t = ano * 12 + (mes - 1) + mesesRestantes
      quitacao = [Math.floor(t / 12), (t % 12) + 1]
    }
    const saldoInicial = Math.max(restante, ...saldos.filter((s) => s.divida_id === d.id && s.data <= fim).map((s) => s.saldo))
    lista.push({
      divida: d,
      restante,
      restanteAntes,
      saldoInicial,
      pagoNoMes: doMes.reduce((a, p) => a + p.valor, 0),
      pagamentosNoMes: doMes.length,
      totalPago: pagamentos.filter((p) => p.divida_id === d.id && p.data && p.data <= fim).reduce((a, p) => a + p.valor, 0),
      mesesRestantes,
      quitacao,
      quitadaNoMes: restante <= 0,
    })
  }
  return lista.sort((a, b) => b.restante - a.restante)
}

/** Acha a dívida citada na descrição de uma saída ("Notebook – parcela" -> dívida "Notebook (Eduardo)"). */
export function dividaPelaDescricao(descricao: string, dividas: Divida[]): Divida | undefined {
  const texto = normalizar(descricao)
  if (!texto) return undefined
  return dividas.find((d) => {
    const palavras = normalizar(d.descricao).split(' ').filter((p) => p.length >= 4)
    return palavras.length > 0 && palavras.some((p) => texto.includes(p))
  })
}

const normalizar = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

export interface Parcelas {
  /** Quantas parcelas a dívida tem ao todo (estimado pelo maior saldo registrado). */
  total: number
  pagas: number
  faltam: number
  /** A próxima a pagar (1 a total). */
  proxima: number
}

/**
 * "Parcela 4 de 12": tirado do valor da parcela e dos saldos, sem precisar guardar o número de parcelas.
 * null quando a dívida não tem parcela definida.
 */
export function parcelasDe(s: SituacaoDivida): Parcelas | null {
  const p = s.divida.valor_parcela
  if (!p || p <= 0) return null
  const faltam = s.restante > 0 ? Math.ceil(s.restante / p - 0.001) : 0
  const total = Math.max(faltam, Math.round(s.saldoInicial / p))
  const pagas = total - faltam
  return { total, pagas, faltam, proxima: Math.min(total, pagas + 1) }
}

/** Data (dia 1) de n meses antes de uma data ISO, para registrar o saldo de quando a dívida começou. */
export function mesesAntes(iso: string, n: number) {
  const [a, m] = iso.split('-').map(Number)
  const t = a * 12 + (m - 1) - n
  return inicioDoMes(Math.floor(t / 12), (t % 12) + 1)
}
