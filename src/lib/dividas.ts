import { fmtMoeda, fmtValor, moedaAtual } from './format'
import type { Taxas } from './moedas'
import type { Divida, Pagamento, ParteDivida, PromessaDivida, SaldoDivida } from './types'
import { tx } from './textos'
import { jurosDoAtraso, type JurosDoAtraso } from './jurosAtraso'

const pad = (n: number) => String(n).padStart(2, '0')
/** Hoje (AAAA-MM-DD) no fuso do aparelho. */
const hojeDoAparelho = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
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
  /**
   * Dívida em outra moeda sem cotação (nem do dia, nem em cache): os valores ficam na moeda da dívida (taxa 1 só para os
   * números não serem inventados) e não valem como moeda principal. Fica de fora dos totais convertidos.
   */
  semCotacao: boolean
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
  /** Quando a dívida começou: a data do saldo mais antigo (null se não há saldo). */
  inicioEm: string | null
  /** Mudanças de saldo sem lançamento (juros, acordo, desconto, quitação), com a diferença que cada uma fez. */
  ajustes: { data: string; valor: number }[]
  /** Soma dos ajustes que caem no mês. */
  ajusteNoMes: number
  /** Valor com que a dívida nasceu, se ela nasceu neste mês (senão 0). */
  novaNoMes: number
  totalPago: number
  /** Meses que faltam pagando a parcela (null sem parcela definida). */
  mesesRestantes: number | null
  /** [ano, mes] previsto para quitar. */
  quitacao: [number, number] | null
  quitadaNoMes: boolean
  /**
   * Juros de atraso estimados até hoje (migração 22), só no mês que contém hoje (nos outros, 0). Não entram em `restante`
   * (que é o valor registrado, e que o pagamento cobre parcela por parcela): somam em `restanteHoje`.
   */
  jurosAtraso: number
  /** Quanto falta pagar hoje: `restante` + os juros de atraso estimados. É o "quanto deve agora". */
  restanteHoje: number
  /** O detalhe dos juros de atraso (por parcela, por parte, por dia); null quando não há. */
  atraso: JurosDoAtraso | null
}

/** Entrada numa dívida sua (empréstimo recebido) ou saída em "me devem" (empréstimo feito): a dívida cresce em vez de diminuir. */
export const aumentaDivida = (tipo: Pagamento['tipo'], d: Pick<Divida, 'sentido'>) => (tipo === 'entrada') === ((d.sentido ?? 'devo') === 'devo') && tipo !== undefined

/** Quando a dívida começou: a data do saldo mais antigo dela. */
export function inicioDaDivida(saldos: SaldoDivida[], dividaId: string): string | null {
  let achado: string | null = null
  for (const s of saldos) if (s.divida_id === dividaId && (achado === null || s.data < achado)) achado = s.data
  return achado
}

/** Dia do saldo informado mais recente da dívida. */
export function saldoMaisRecenteDaDivida(saldos: SaldoDivida[], dividaId: string): string | null {
  let achado: string | null = null
  for (const s of saldos) if (s.divida_id === dividaId && (achado === null || s.data > achado)) achado = s.data
  return achado
}

/** Saldo devedor numa data: último saldo informado até ela, menos os pagamentos (e mais os aumentos, que valem negativo) feitos depois dele. */
export function saldoEm(divida: Divida, saldos: SaldoDivida[], pagamentos: Pagamento[], ate: string): number | null {
  const marcos = saldos.filter((s) => s.divida_id === divida.id && s.data <= ate).sort((a, b) => a.data.localeCompare(b.data))
  const marco = marcos[marcos.length - 1]
  if (!marco) return null
  // No saldo mais antigo (o dia em que a dívida começou), o pagamento do próprio dia conta: a dívida começou e foi paga nesse dia.
  // Nos ajustes de saldo, o do dia já está incluído no valor informado.
  const primeiraData = saldos.reduce((m, s) => (s.divida_id === divida.id && (m === null || s.data < m) ? s.data : m), null as string | null)
  const origem = marco.data === primeiraData
  const pagoDepois = pagamentos
    .filter((p) => p.divida_id === divida.id && p.data && (origem ? p.data >= marco.data : p.data > marco.data) && p.data <= ate)
    .reduce((a, p) => a + p.valor, 0)
  return Math.max(0, Math.round((marco.saldo - pagoDepois) * 100) / 100)
}

const centavosDe = (n: number) => Math.round(n * 100) / 100
/** A moeda da dívida, ou null quando é a principal. */
export const moedaDaDivida = (d: Pick<Divida, 'moeda'>) => (d.moeda && d.moeda !== moedaAtual() ? d.moeda : null)

/** Um valor (na moeda principal) desta dívida, no jeito dela: "US$ 5,00" numa dívida em dólar, "R$ 26,75" numa em real. */
export const fmtDiv = (s: Pick<SituacaoDivida, 'moeda' | 'taxa'>, valor: number) => (s.moeda ? fmtMoeda(centavosDe(valor / s.taxa), s.moeda) : fmtValor(valor))
/** "≈ R$ 26,75" para dívida em outra moeda (vazio quando é na principal). */
export const aproxDiv = (s: Pick<SituacaoDivida, 'moeda' | 'taxa'> & { semCotacao?: boolean }, valor: number) =>
  (s.moeda ? (s.semCotacao ? tx('sem cotação') : `≈ ${fmtValor(valor)}`) : '')
/** O valor na moeda da dívida, como número (para preencher campos). */
export const nativoDiv = (s: Pick<SituacaoDivida, 'moeda' | 'taxa'>, valor: number) => (s.moeda ? centavosDe(valor / s.taxa) : valor)

/**
 * Dívidas que aparecem no mês: as que existiam e não estavam quitadas antes dele. `taxas` converte as dívidas em outra moeda.
 * `hoje` (AAAA-MM-DD): no mês que o contém, cada dívida atrasada ganha os juros de atraso estimados até ele.
 */
export function situacaoDividas(
  dividas: Divida[], saldos: SaldoDivida[], pagamentos: Pagamento[], ano: number, mes: number, taxas: Taxas = {}, hoje: string = hojeDoAparelho(),
): SituacaoDivida[] {
  const fim = fimDoMes(ano, mes)
  const ini = inicioDoMes(ano, mes)
  const fimAntes = fimDoMes(...mesAnterior(ano, mes))
  const lista: SituacaoDivida[] = []
  for (const original of dividas) {
    // Dívida em outra moeda: parcela, saldos e pagamentos passam para a moeda principal pela cotação do dia, e tudo abaixo
    // (restante, parcelas, calendário) é calculado numa unidade só. Pagamento lançado nessa moeda vale o valor original.
    const moeda = moedaDaDivida(original)
    // Sem cotação da moeda: não converte (taxa 1 deixa os números na moeda da dívida) e marca `semCotacao`.
    const semCotacao = moeda !== null && !taxas[moeda]
    const taxa = moeda ? taxas[moeda] || 1 : 1
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
        // empréstimo recebido neste mesmo mês (a dívida nasceu zerada e cresceu com a entrada)
        || pagamentosD.some((x) => x.valor < 0 && x.data && x.data >= ini && x.data <= fim)
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
    // Ajustes: cada saldo informado depois do primeiro vale quanto era esperado (saldo anterior menos pagamentos) mais a diferença.
    const marcos = saldosD.filter((x) => x.divida_id === d.id).sort((a, b) => a.data.localeCompare(b.data) || a.id.localeCompare(b.id))
    const ajustes: { data: string; valor: number }[] = []
    marcos.forEach((m, i) => {
      if (i === 0) return
      const esperado = saldoEm(d, marcos.slice(0, i), pagamentosD, m.data) ?? 0
      const dif = centavosDe(m.saldo - esperado)
      if (Math.abs(dif) >= 0.005) ajustes.push({ data: m.data, valor: dif })
    })
    const sit: SituacaoDivida = {
      divida: d, original, moeda, taxa, semCotacao,
      inicioEm: marcos[0]?.data ?? null,
      ajustes,
      ajusteNoMes: centavosDe(ajustes.filter((a) => a.data >= ini && a.data <= fim).reduce((t, a) => t + a.valor, 0)),
      novaNoMes: marcos[0] && marcos[0].data >= ini && marcos[0].data <= fim ? marcos[0].saldo : 0,
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
      jurosAtraso: 0,
      restanteHoje: restante,
      atraso: null,
    }
    // juros de atraso: só no mês de hoje (meses que passaram ficam como foram registrados)
    if (hoje >= ini && hoje <= fim && restante > 0) {
      const j = jurosDoAtraso(sit, calendarioDe(sit, hoje), hoje)
      if (j.total > 0 || j.diario > 0) Object.assign(sit, { jurosAtraso: j.total, restanteHoje: centavosDe(restante + j.total), atraso: j })
    }
    lista.push(sit)
  }
  return lista.sort((a, b) => b.restanteHoje - a.restanteHoje)
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
  const total = Math.max(faltam, parcelasDoSaldo(s.saldoInicial, p))
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

/** Juros de um mês viram quanto no ano (juros compostos): 2,5% ao mês dão cerca de 34,5% ao ano. */
export const jurosAoAno = (jurosMes: number) => (Math.pow(1 + jurosMes / 100, 12) - 1) * 100
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
  /** Dívida com partes: as partes que vencem neste dia (a parcela é a soma delas). */
  partes?: ParteDivida[]
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

/** Quantas parcelas cabem num saldo: a última pode ser menor que as outras (o que sobra). */
const parcelasDoSaldo = (saldo: number, parcela: number) => Math.max(1, Math.ceil(saldo / parcela - 0.001))

/** Quantas parcelas a dívida tem ao todo: a informada ou a que sai do valor e da parcela. */
export function totalDeParcelas(s: SituacaoDivida) {
  const vp = s.divida.valor_parcela
  if (!vp || vp <= 0) return 1
  return s.divida.total_parcelas ?? parcelasDoSaldo(s.saldoInicial, vp)
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
  if (d.partes?.length) return calendarioDasPartes(s, d.partes, ref)
  if (!d.inicio || s.saldoInicial <= 0) return null
  const vp = d.valor_parcela && d.valor_parcela > 0 ? d.valor_parcela : s.saldoInicial
  const n = d.valor_parcela ? totalDeParcelas(s) : 1
  let pago = centavos(Math.max(0, s.saldoInicial - s.restante))
  const parcelas: ParcelaDivida[] = []
  for (let i = 0; i < n; i++) {
    // A última leva a diferença para o total bater com o maior saldo. Com o número de parcelas informado, ela absorve juros e
    // centavos (pode ser maior que as outras); sem ele, é só o que sobra do saldo (pode ser menor), e as parcelas somam o saldo.
    const resto = s.saldoInicial - vp * (n - 1)
    const valor = i === n - 1 ? centavos(d.total_parcelas != null ? Math.max(vp, resto) : resto) : vp
    const cobre = centavos(Math.min(valor, pago))
    pago = centavos(pago - cobre)
    const vencimento = somaMesesData(d.inicio, i)
    const falta = centavos(valor - cobre)
    parcelas.push({ n: i + 1, vencimento, valor, pago: cobre, falta, estado: estadoDaParcela(falta, cobre, vencimento, ref) })
  }
  return fecharCalendario(parcelas, s.restante)
}

/** Estado de uma parcela pelo que falta dela e pelo vencimento. */
const estadoDaParcela = (falta: number, cobre: number, vencimento: string, ref: string): EstadoParcela =>
  falta <= 0.004 ? 'paga' : vencimento < ref ? 'atrasada' : vencimento === ref ? 'vence_hoje' : cobre > 0 ? 'parcial' : 'a_vencer'

/** Fecha o calendário: atrasadas, a próxima e o valor sugerido no botão de pagar. */
function fecharCalendario(parcelas: ParcelaDivida[], restante: number): Calendario {
  // dívida quitada antes do fim (acordo, desconto): nada fica para trás
  if (restante <= 0) for (const p of parcelas) if (p.estado !== 'paga') Object.assign(p, { estado: 'paga', pago: p.valor, falta: 0 })
  const atrasadas = parcelas.filter((p) => p.estado === 'atrasada')
  const emAtraso = centavos(atrasadas.reduce((a, p) => a + p.falta, 0))
  const proxima = parcelas.find((p) => p.falta > 0) ?? null
  const hoje = parcelas.filter((p) => p.estado === 'vence_hoje').reduce((a, p) => a + p.falta, 0)
  const sugerido = centavos(emAtraso + hoje > 0 ? emAtraso + hoje : proxima?.falta ?? 0)
  return { parcelas, atrasadas, emAtraso, proxima, sugerido: Math.min(sugerido, restante) }
}

/**
 * Valor sugerido no botão de pagar: o do calendário (atrasado + o que vence hoje, ou a próxima) ou a parcela, mais os juros
 * de atraso estimados quando há parcela atrasada. 0 = sem valor certo (a pessoa digita).
 */
export function sugeridoParaPagar(s: SituacaoDivida, cal: Calendario | null) {
  const base = cal?.sugerido || (s.divida.valor_parcela ? Math.min(s.divida.valor_parcela, s.restante) : 0)
  if (!base || !s.jurosAtraso || !cal?.atrasadas.length) return base
  return Math.min(centavos(base + s.jurosAtraso), s.restanteHoje)
}

/**
 * Juros que pesam nessa dívida agora (% ao mês): atrasada e com regra de atraso, o do atraso; senão o do contrato.
 * null = não informado.
 */
export function jurosQuePesam(s: SituacaoDivida): number | null {
  const a = s.divida.atraso_juros_mes
  if (s.atraso && typeof a === 'number' && a >= 0) return a
  const j = s.divida.juros_mes
  return typeof j === 'number' && j >= 0 ? j : null
}

/** Quanto do atraso é juros estimado: o atrasado registrado + os juros (0 sem atraso). */
export const atrasadoHoje = (s: SituacaoDivida, cal: Calendario | null) => (cal?.emAtraso ? centavos(cal.emAtraso + s.jurosAtraso) : 0)

/**
 * Calendário de uma dívida com partes (mini-dívidas): uma parcela por dia de vencimento, que soma as partes daquele dia.
 * O que já foi pago (soma das partes − o que falta) cobre os dias do mais antigo para o mais novo, como nas outras dívidas.
 * Se o saldo passou da soma das partes (juros e multa lançados como ajuste), nada conta como pago e o excesso fica no saldo.
 */
function calendarioDasPartes(s: SituacaoDivida, partes: ParteDivida[], ref: string): Calendario {
  const porDia = new Map<string, ParteDivida[]>()
  for (const p of [...partes].sort((a, b) => a.vencimento.localeCompare(b.vencimento) || a.nome.localeCompare(b.nome))) {
    porDia.set(p.vencimento, [...(porDia.get(p.vencimento) ?? []), p])
  }
  const total = centavos(partes.reduce((a, p) => a + p.valor, 0))
  let pago = centavos(Math.max(0, total - s.restante))
  const parcelas: ParcelaDivida[] = [...porDia].map(([vencimento, doDia], i) => {
    const valor = centavos(doDia.reduce((a, p) => a + p.valor, 0))
    const cobre = centavos(Math.min(valor, pago))
    pago = centavos(pago - cobre)
    const falta = centavos(valor - cobre)
    return { n: i + 1, vencimento, valor, pago: cobre, falta, estado: estadoDaParcela(falta, cobre, vencimento, ref), partes: doDia }
  })
  return fecharCalendario(parcelas, s.restante)
}

/** Uma parte da dívida com todas as parcelas dela: "Microfone · 5 parcelas · R$ 331,68". */
export interface GrupoDeParte {
  nome: string
  parcelas: ParteDivida[]
  total: number
  /** "de 6" quando as parcelas dizem o total; null quando não dizem. */
  de: number | null
  primeira: string
  ultima: string
  /** Quando a parte começou (a mais antiga das parcelas), se foi dito. */
  inicio: string | null
}

/** As partes agrupadas pelo nome (cada grupo em ordem de vencimento), da que vence primeiro para a última. */
export function gruposDasPartes(partes: ParteDivida[]): GrupoDeParte[] {
  const grupos = new Map<string, ParteDivida[]>()
  for (const p of partes) {
    const chave = p.nome.trim().toLowerCase()
    grupos.set(chave, [...(grupos.get(chave) ?? []), p])
  }
  return [...grupos.values()].map((ps) => {
    const parcelas = [...ps].sort((a, b) => a.vencimento.localeCompare(b.vencimento) || (a.parcela ?? 0) - (b.parcela ?? 0))
    return {
      nome: parcelas[0].nome,
      parcelas,
      total: centavos(parcelas.reduce((a, p) => a + p.valor, 0)),
      de: parcelas.reduce<number | null>((m, p) => (p.parcelas ? Math.max(m ?? 0, p.parcelas) : m), null),
      primeira: parcelas[0].vencimento,
      ultima: parcelas[parcelas.length - 1].vencimento,
      inicio: parcelas.reduce<string | null>((m, p) => (p.inicio && (!m || p.inicio < m) ? p.inicio : m), null),
    }
  }).sort((a, b) => a.primeira.localeCompare(b.primeira) || a.nome.localeCompare(b.nome))
}

/**
 * As parcelas de uma parte nova, a partir do que a pessoa sabe: o valor, o vencimento da primeira que falta e "da parcela
 * 2 até a 6". Sem parcelamento (até vazio), é uma linha só. Cada parcela vence no mesmo dia dos meses seguintes.
 */
export function gerarParcelasDaParte(p: { nome: string; valor: number; vencimento: string; da?: number | null; ate?: number | null; inicio?: string | null }) {
  const da = p.da && p.da > 0 ? Math.floor(p.da) : 1
  const ate = p.ate && p.ate >= da ? Math.floor(p.ate) : null
  // quando começou só vai quando foi dito (sem a migração 26 o campo nem existe)
  const inicio = p.inicio ? { inicio: p.inicio } : {}
  if (!ate) return [{ nome: p.nome.trim(), valor: centavos(p.valor), vencimento: p.vencimento, parcela: null, parcelas: null, ...inicio }]
  return Array.from({ length: ate - da + 1 }, (_, i) => ({
    nome: p.nome.trim(), valor: centavos(p.valor), vencimento: somaMesesData(p.vencimento, i), parcela: da + i, parcelas: ate, ...inicio,
  }))
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

/**
 * Quanto se deve ao fim de cada dia do mês (gráfico do mês na Início). Até hoje: o saldo do mês com os pagamentos de
 * depois daquele dia devolvidos. Depois de hoje: o saldo de hoje menos as parcelas que vencem até aquele dia (as atrasadas
 * entram no dia seguinte a hoje). Dívida sem cotação fica de fora, como nos totais.
 */
export function dividaDiaADia({ situacao, pagamentos, ano, mes, dias, hoje, diaRef }: {
  situacao: SituacaoDivida[]; pagamentos: Pagamento[]; ano: number; mes: number
  /** Dias do mês e o dia de hoje dentro dele (0: o mês ainda não começou; `dias`: já acabou). */
  dias: number; hoje: number; diaRef: string
}): number[] {
  const devo = situacao.filter((s) => !s.semCotacao)
  const ids = new Set(devo.map((s) => s.divida.id))
  const prefixo = `${ano}-${String(mes).padStart(2, '0')}`
  const fimDoMesDivida = devo.reduce((t, s) => t + s.restante, 0)
  // quanto cada dia mexeu na dívida (pagamento diminui; dinheiro emprestado a mais aumenta)
  const mexeu = Array<number>(dias + 1).fill(0)
  for (const p of pagamentos) {
    if (!ids.has(p.divida_id) || !p.data?.startsWith(prefixo)) continue
    mexeu[+p.data.slice(8, 10)] += p.tipo === 'entrada' ? p.valor : -p.valor
  }
  const saldo = Array<number>(dias).fill(0)
  let depois = 0
  for (let d = dias; d >= 1; d--) { saldo[d - 1] = fimDoMesDivida - depois; depois += mexeu[d] }
  if (hoje >= dias) return saldo.map(centavosDe)
  // daqui para a frente: as parcelas que ainda faltam pagar, no dia em que vencem (as atrasadas, amanhã)
  const vence = parcelasPorDia({ situacao: devo, ano, mes, dias, hoje, diaRef, atrasadasEm: hoje + 1 })
  const base = hoje > 0 ? saldo[hoje - 1] : fimDoMesDivida - depois
  let pago = 0
  for (let d = hoje + 1; d <= dias; d++) { pago += vence[d - 1]; saldo[d - 1] = Math.max(0, base - pago) }
  return saldo.map(centavosDe)
}

/**
 * O que falta pagar das parcelas de dívida em cada dia do mês (índice 0 = dia 1), como no "Para fazer": a parcela no dia em
 * que vence e a atrasada (de qualquer mês) no dia `atrasadasEm` (com `soDoMes`, sem as atrasadas). Dívida sem cotação
 * fica de fora.
 */
export function parcelasPorDia({ situacao, ano, mes, dias, hoje, diaRef, atrasadasEm = Math.max(hoje, 1), soDoMes = false }: {
  situacao: SituacaoDivida[]; ano: number; mes: number; dias: number; hoje: number; diaRef: string; atrasadasEm?: number
  /**
   * Só as parcelas que vencem neste mês, sem as atrasadas. Para o dinheiro de um mês que ainda não começou: a atrasada já
   * sai no mês de hoje, e contar de novo punha em dezembro as parcelas de novembro uma segunda vez ("2 parcelas" de cada
   * dívida). O saldo da dívida dia a dia continua descontando a atrasada antes do mês começar.
   */
  soDoMes?: boolean
}): number[] {
  const prefixo = `${ano}-${String(mes).padStart(2, '0')}`
  const vence = Array<number>(dias).fill(0)
  if (hoje >= dias) return vence
  for (const s of situacao) {
    if (s.semCotacao || s.restante <= 0) continue
    for (const p of calendarioDe(s, diaRef)?.parcelas ?? []) {
      if (p.falta <= 0 || p.vencimento > `${prefixo}-31`) continue
      const dia = p.vencimento.startsWith(prefixo) ? +p.vencimento.slice(8, 10) : 0
      // `soDoMes`: só as que vencem neste mês (a atrasada já entrou no dinheiro do mês de hoje)
      if (!dia && soDoMes) continue
      // parcela atrasada leva os juros de atraso estimados, como no "Para fazer"
      vence[Math.min(dias, Math.max(dia > hoje ? dia : atrasadasEm, 1)) - 1] += p.falta + (s.atraso?.porParcela.get(p.n) ?? 0)
    }
  }
  return vence.map(centavosDe)
}

// ---------- promessas de pagamento (migração 25) ----------

export type EstadoPromessa = 'aguardando' | 'hoje' | 'cumprida' | 'em_parte' | 'pagou_depois' | 'nao_cumprida' | 'trocada'

export interface SituacaoPromessa {
  promessa: PromessaDivida
  /** 1 a N, na ordem em que foram feitas. */
  n: number
  estado: EstadoPromessa
  /** O valor prometido na moeda principal (null = o que estiver atrasado). */
  valor: number | null
  /** Quanto entrou (ou foi pago) entre a promessa anterior e o dia prometido. */
  pagoAte: number
}

export interface Promessas {
  lista: SituacaoPromessa[]
  /** A promessa que vale agora: a mais nova, se o dia dela ainda não passou e a dívida não acabou. */
  ativa: SituacaoPromessa | null
  /** Quantas já passaram sem ser cumpridas (nem em parte). */
  quebradas: number
}

/** Dia (AAAA-MM-DD) n dias antes. */
const diasAntes = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() - n)
  return `${d.getFullYear()}-${doisDig(d.getMonth() + 1)}-${doisDig(d.getDate())}`
}

/**
 * O que aconteceu com cada promessa, pelos pagamentos lançados: cumprida (pagou até o dia, o valor prometido ou, sem valor,
 * qualquer valor), em parte, pagou depois do dia, não cumprida ou trocada por uma promessa mais nova antes do dia chegar.
 * Cada promessa olha os pagamentos desde o dia da anterior (a primeira, desde uma semana antes do dia prometido ou de
 * quando foi anotada).
 */
export function promessasDe(s: Pick<SituacaoDivida, 'divida' | 'original' | 'taxa' | 'restante'>, pagamentos: Pagamento[], hoje: string): Promessas {
  const ps = s.divida.promessas ?? []
  if (!ps.length) return { lista: [], ativa: null, quebradas: 0 }
  const abatem = pagamentos
    .filter((p) => p.divida_id === s.divida.id && p.data && !aumentaDivida(p.tipo, s.original))
    .map((p) => ({ data: p.data!, valor: p.valor }))
  const soma = (de: string, ate: string) => centavos(abatem.filter((p) => p.data > de && p.data <= ate).reduce((t, p) => t + p.valor, 0))
  const lista: SituacaoPromessa[] = ps.map((promessa, i) => {
    const anterior = ps[i - 1]
    const proxima = ps[i + 1]
    const anotada = promessa.created_at.slice(0, 10)
    const de = anterior ? (anterior.data < promessa.data ? anterior.data : diasAntes(promessa.data, 1)) : diasAntes(anotada < promessa.data ? anotada : promessa.data, 7)
    const valor = promessa.valor == null ? null : centavos(promessa.valor * s.taxa)
    const pagoAte = soma(de, promessa.data)
    const alvo = valor ?? 0.01
    let estado: EstadoPromessa
    if (pagoAte >= alvo - 0.005) estado = 'cumprida'
    // trocada: uma promessa nova foi anotada antes do dia desta chegar
    else if (proxima && proxima.created_at.slice(0, 10) < promessa.data) estado = 'trocada'
    else if (promessa.data >= hoje) estado = promessa.data === hoje ? 'hoje' : 'aguardando'
    else if (pagoAte > 0) estado = 'em_parte'
    else estado = soma(promessa.data, proxima ? proxima.data : hoje) > 0 ? 'pagou_depois' : 'nao_cumprida'
    return { promessa, n: i + 1, estado, valor, pagoAte }
  })
  const ultima = lista[lista.length - 1]
  const ativa = s.restante > 0 && (ultima.estado === 'aguardando' || ultima.estado === 'hoje') ? ultima : null
  return { lista, ativa, quebradas: lista.filter((x) => x.estado === 'nao_cumprida').length }
}
