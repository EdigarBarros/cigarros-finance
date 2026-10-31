import { fmtMoeda, fmtValor, moedaAtual } from './format'
import type { Taxas } from './moedas'
import type { Divida, Pagamento, SaldoDivida } from './types'

const pad = (n: number) => String(n).padStart(2, '0')
export const fimDoMes = (ano: number, mes: number) => `${ano}-${pad(mes)}-${pad(new Date(ano, mes, 0).getDate())}`
export const inicioDoMes = (ano: number, mes: number) => `${ano}-${pad(mes)}-01`
const mesAnterior = (ano: number, mes: number): [number, number] => (mes === 1 ? [ano - 1, 12] : [ano, mes - 1])

export interface SituacaoDivida {
  /**
   * A dívida já no referencial da moeda principal: parcela convertida pela cotação do dia. Todos os valores desta situação
   * (restante, parcela, pago…) estão na moeda principal, então somam com o resto do painel.
   */
  divida: Divida
  /** A dívida como foi cadastrada (parcela e saldos na moeda dela), para editar e para mostrar o valor original. */
  original: Divida
  /** Moeda da dívida quando não é a principal. */
  moeda: string | null
  /** Quanto 1 unidade da moeda da dívida vale na principal (1 se a dívida é na principal). */
  taxa: number
  /** Saldo devedor no fim do mês. */
  restante: number
  /** Saldo no fim do mês anterior (null se a dívida ainda não existia). */
  restanteAntes: number | null
  /** Maior saldo já registrado, base para o progresso. */
  saldoInicial: number
  pagoNoMes: number
  pagamentosNoMes: number
  /** Quanto a dívida aumentou no mês (dinheiro emprestado a mais). */
  aumentoNoMes: number
  totalPago: number
  /** Meses que faltam pagando a parcela (null sem parcela definida). */
  mesesRestantes: number | null
  /** [ano, mes] previsto para quitar. */
  quitacao: [number, number] | null
  quitadaNoMes: boolean
}

/** Entrada numa dívida sua (empréstimo recebido) ou saída em "me devem" (empréstimo feito): a dívida cresce em vez de diminuir. */
export const aumentaDivida = (tipo: Pagamento['tipo'], d: Pick<Divida, 'sentido'>) => (tipo === 'entrada') === ((d.sentido ?? 'devo') === 'devo') && tipo !== undefined

/** Saldo devedor numa data: último saldo informado até ela, menos os pagamentos (e mais os aumentos, que valem negativo) feitos depois dele. */
export function saldoEm(divida: Divida, saldos: SaldoDivida[], pagamentos: Pagamento[], ate: string): number | null {
  const marcos = saldos.filter((s) => s.divida_id === divida.id && s.data <= ate).sort((a, b) => a.data.localeCompare(b.data))
  const marco = marcos[marcos.length - 1]
  if (!marco) return null
  const pagoDepois = pagamentos
    .filter((p) => p.divida_id === divida.id && p.data && p.data > marco.data && p.data <= ate)
    .reduce((a, p) => a + p.valor, 0)
  return Math.max(0, Math.round((marco.saldo - pagoDepois) * 100) / 100)
}

const centavosDe = (n: number) => Math.round(n * 100) / 100
/** A moeda da dívida, ou null quando é a principal. */
export const moedaDaDivida = (d: Pick<Divida, 'moeda'>) => (d.moeda && d.moeda !== moedaAtual() ? d.moeda : null)

/** Um valor (na moeda principal) desta dívida, no jeito dela: "US$ 5,00" numa dívida em dólar, "R$ 26,75" numa em real. */
export const fmtDiv = (s: Pick<SituacaoDivida, 'moeda' | 'taxa'>, valor: number) => (s.moeda ? fmtMoeda(centavosDe(valor / s.taxa), s.moeda) : fmtValor(valor))
/** "≈ R$ 26,75" para dívida em outra moeda (vazio quando é na principal). */
export const aproxDiv = (s: Pick<SituacaoDivida, 'moeda' | 'taxa'>, valor: number) => (s.moeda ? `≈ ${fmtValor(valor)}` : '')
/** O valor na moeda da dívida, como número (para preencher campos). */
export const nativoDiv = (s: Pick<SituacaoDivida, 'moeda' | 'taxa'>, valor: number) => (s.moeda ? centavosDe(valor / s.taxa) : valor)

/** Dívidas que aparecem no mês: as que existiam e não estavam quitadas antes dele. `taxas` converte as dívidas em outra moeda. */
export function situacaoDividas(
  dividas: Divida[], saldos: SaldoDivida[], pagamentos: Pagamento[], ano: number, mes: number, taxas: Taxas = {},
): SituacaoDivida[] {
  const fim = fimDoMes(ano, mes)
  const ini = inicioDoMes(ano, mes)
  const fimAntes = fimDoMes(...mesAnterior(ano, mes))
  const lista: SituacaoDivida[] = []
  for (const original of dividas) {
    // Dívida em outra moeda: parcela, saldos e pagamentos passam para a moeda principal pela cotação do dia, e tudo abaixo
    // (restante, parcelas, calendário) é calculado numa unidade só. Pagamento lançado nessa moeda vale o valor original.
    const moeda = moedaDaDivida(original)
    const taxa = moeda ? taxas[moeda] ?? 1 : 1
    const d: Divida = moeda ? { ...original, valor_parcela: original.valor_parcela == null ? null : centavosDe(original.valor_parcela * taxa) } : original
    const saldosD = moeda ? saldos.filter((x) => x.divida_id === d.id).map((x) => ({ ...x, saldo: centavosDe(x.saldo * taxa) })) : saldos
    // Valor positivo abate a dívida; negativo (empréstimo a mais) aumenta.
    const pagamentosD = pagamentos.filter((x) => x.divida_id === d.id).map((x) => {
      const v = moeda && x.moeda_original === moeda && x.valor_original ? centavosDe(x.valor_original * taxa) : x.valor
      return { ...x, valor: aumentaDivida(x.tipo, d) ? -v : v }
    })
    const restante = saldoEm(d, saldosD, pagamentosD, fim)
    if (restante === null) continue
    const restanteAntes = saldoEm(d, saldosD, pagamentosD, fimAntes)
    // Criada e quitada no mesmo mês: sem saldo antes, mas teve saldo positivo neste mês.
    const devendoNoMes = restanteAntes === null
      ? saldosD.some((s) => s.divida_id === d.id && s.data >= ini && s.data <= fim && s.saldo > 0)
      : restanteAntes > 0
    if (restante <= 0 && !devendoNoMes) continue
    const doMes = pagamentosD.filter((p) => p.divida_id === d.id && p.data && p.data >= ini && p.data <= fim)
    const parcela = d.valor_parcela ?? 0
    const mesesRestantes = parcela > 0 && restante > 0 ? Math.ceil(restante / parcela - 0.001) : null
    let quitacao: [number, number] | null = null
    if (mesesRestantes !== null) {
      const t = ano * 12 + (mes - 1) + mesesRestantes
      quitacao = [Math.floor(t / 12), (t % 12) + 1]
    }
    // Base do progresso: o maior saldo informado, mais o que foi emprestado a mais depois dele.
    const aumentos = pagamentosD.filter((p) => p.valor < 0 && p.data && p.data <= fim)
    const saldoInicial = Math.max(restante, ...saldosD.filter((s) => s.divida_id === d.id && s.data <= fim)
      .map((s) => s.saldo + aumentos.filter((a) => a.data! > s.data).reduce((t, a) => t - a.valor, 0)))
    lista.push({
      divida: d, original, moeda, taxa,
      restante,
      restanteAntes,
      saldoInicial,
      pagoNoMes: doMes.reduce((a, p) => a + Math.max(0, p.valor), 0),
      pagamentosNoMes: doMes.filter((p) => p.valor > 0).length,
      aumentoNoMes: doMes.reduce((a, p) => a + Math.max(0, -p.valor), 0),
      totalPago: pagamentosD.filter((p) => p.data && p.data <= fim).reduce((a, p) => a + Math.max(0, p.valor), 0),
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

/** Lado que a página Dívidas abre na próxima vez (a linha "A receber" da Início pede "me devem"). */
let ladoPedido: 'devo' | 'me_devem' = 'devo'
export const pedirLadoDividas = (l: 'devo' | 'me_devem') => { ladoPedido = l }
export const tomarLadoDividas = () => {
  const l = ladoPedido
  ladoPedido = 'devo'
  return l
}

// ---------- calendário de parcelas ----------

export const sentidoDe = (d: Divida) => d.sentido ?? 'devo'
export const meDevem = (d: Divida) => sentidoDe(d) === 'me_devem'
/** O lançamento é dinheiro emprestado a mais (e não pagamento nem recebimento)? */
export const ehEmprestimo = (l: { tipo: Pagamento['tipo']; divida_id?: string | null }, dividas: Divida[]) => {
  const d = l.divida_id ? dividas.find((x) => x.id === l.divida_id) : undefined
  return Boolean(d && aumentaDivida(l.tipo, d))
}

/** paga · parcial (pagou parte e ainda não venceu) · atrasada (venceu sem pagar tudo) · vence_hoje · a_vencer */
export type EstadoParcela = 'paga' | 'parcial' | 'atrasada' | 'vence_hoje' | 'a_vencer'

export interface ParcelaDivida {
  /** 1 a N. */
  n: number
  vencimento: string
  valor: number
  /** Quanto dela já foi pago (o que foi pago vai cobrindo as parcelas da mais antiga para a mais nova). */
  pago: number
  falta: number
  estado: EstadoParcela
}

export interface Calendario {
  parcelas: ParcelaDivida[]
  /** Vencidas sem pagar tudo (inclui as pagas pela metade que já venceram). */
  atrasadas: ParcelaDivida[]
  emAtraso: number
  /** A primeira que ainda tem algo a pagar. */
  proxima: ParcelaDivida | null
  /** Valor sugerido no botão: o que está atrasado (e vence hoje) ou, sem atraso, o que falta da próxima. */
  sugerido: number
}

const doisDig = (n: number) => String(n).padStart(2, '0')
const centavos = (n: number) => Math.round(n * 100) / 100
/** Mesmo dia, n meses depois (dia 31 em mês curto vira o último dia). */
export function somaMesesData(iso: string, n: number) {
  const [a, m, d] = iso.split('-').map(Number)
  const t = a * 12 + (m - 1) + n
  const ano = Math.floor(t / 12)
  const mes = (t % 12) + 1
  return `${ano}-${doisDig(mes)}-${doisDig(Math.min(d, new Date(ano, mes, 0).getDate()))}`
}

/** Quantas parcelas a dívida tem ao todo: a informada ou a que sai do valor e da parcela. */
export function totalDeParcelas(s: SituacaoDivida) {
  const vp = s.divida.valor_parcela
  if (!vp || vp <= 0) return 1
  return s.divida.total_parcelas ?? Math.max(1, Math.round(s.saldoInicial / vp))
}

/**
 * As parcelas com vencimento e situação, a partir de `inicio` (vencimento da 1ª). O total pago até agora
 * (maior saldo − o que falta) cobre as parcelas em ordem: pagar metade deixa a parcela "parcial"; pagar uma e
 * pular a outra deixa a outra "atrasada" quando vencer; pagar a mais adianta as próximas. Sem parcela fixa, é uma
 * parcela só, com a data combinada. Sem `inicio`, não há calendário (null).
 * `ref` é o dia de hoje (ou o fim do mês aberto, ao olhar um mês que já passou).
 */
export function calendarioDe(s: SituacaoDivida, ref: string): Calendario | null {
  const d = s.divida
  if (!d.inicio || s.saldoInicial <= 0) return null
  const vp = d.valor_parcela && d.valor_parcela > 0 ? d.valor_parcela : s.saldoInicial
  const n = d.valor_parcela ? totalDeParcelas(s) : 1
  let pago = centavos(Math.max(0, s.saldoInicial - s.restante))
  const parcelas: ParcelaDivida[] = []
  for (let i = 0; i < n; i++) {
    // a última leva a diferença (juros, centavos) para o total bater com o maior saldo
    const valor = i === n - 1 ? centavos(Math.max(vp, s.saldoInicial - vp * (n - 1))) : vp
    const cobre = centavos(Math.min(valor, pago))
    pago = centavos(pago - cobre)
    const vencimento = somaMesesData(d.inicio, i)
    const falta = centavos(valor - cobre)
    const estado: EstadoParcela = falta <= 0.004 ? 'paga'
      : vencimento < ref ? 'atrasada'
        : vencimento === ref ? 'vence_hoje'
          : cobre > 0 ? 'parcial' : 'a_vencer'
    parcelas.push({ n: i + 1, vencimento, valor, pago: cobre, falta, estado })
  }
  // dívida quitada antes do fim (acordo, desconto): nada fica para trás
  if (s.restante <= 0) for (const p of parcelas) if (p.estado !== 'paga') Object.assign(p, { estado: 'paga', pago: p.valor, falta: 0 })
  const atrasadas = parcelas.filter((p) => p.estado === 'atrasada')
  const emAtraso = centavos(atrasadas.reduce((a, p) => a + p.falta, 0))
  const proxima = parcelas.find((p) => p.falta > 0) ?? null
  const hoje = parcelas.filter((p) => p.estado === 'vence_hoje').reduce((a, p) => a + p.falta, 0)
  const sugerido = centavos(emAtraso + hoje > 0 ? emAtraso + hoje : proxima?.falta ?? 0)
  return { parcelas, atrasadas, emAtraso, proxima, sugerido: Math.min(sugerido, s.restante) }
}

/**
 * `inicio` a partir do vencimento da próxima parcela em aberto: volta tantos meses quantas parcelas já foram pagas.
 * É o que a pessoa sabe responder ("a próxima vence dia 10/11").
 */
export const inicioPelaProxima = (proxima: string, jaPagas: number) => somaMesesData(proxima, -Math.max(0, jaPagas))

/**
 * Quanto sai (ou entra) por mês nos próximos `meses`, a partir do mês de `ref`: o que falta de cada parcela no mês em
 * que vence (atrasadas contam no primeiro mês). Dívida parcelada sem calendário entra com a parcela a partir do mês
 * seguinte até cobrir o que falta.
 */
export function projecaoMensal(itens: SituacaoDivida[], ref: string, meses = 12) {
  const [a, m] = ref.split('-').map(Number)
  const base = a * 12 + (m - 1)
  const valores = Array.from({ length: meses }, () => 0)
  for (const s of itens) {
    if (s.restante <= 0) continue
    const cal = calendarioDe(s, ref)
    if (cal) {
      for (const p of cal.parcelas) {
        if (p.falta <= 0) continue
        const [pa, pm] = p.vencimento.split('-').map(Number)
        const i = Math.max(0, pa * 12 + (pm - 1) - base)
        if (i < meses) valores[i] += p.falta
      }
    } else if (s.divida.valor_parcela) {
      let resta = s.restante
      for (let i = 1; i < meses && resta > 0; i++) {
        const v = Math.min(resta, s.divida.valor_parcela)
        valores[i] += v
        resta -= v
      }
    }
  }
  return valores.map((v, i) => ({ ano: Math.floor((base + i) / 12), mes: ((base + i) % 12) + 1, valor: centavos(v) }))
}
