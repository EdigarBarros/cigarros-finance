import type { Calendario, SituacaoDivida } from './dividas'
import type { Divida } from './types'
import { fmtDataCurta, fmtTaxa } from './format'
import { tx } from './textos'

/**
 * Juros de atraso estimados (migração 22): quanto uma dívida atrasada cresceu desde o dia em que os valores foram
 * conferidos com o banco (`conferido_em`), pela regra do credor. É uma estimativa: o valor registrado (`restante`) não
 * muda; o app mostra `restante + total` como "falta pagar hoje" até a pessoa conferir de novo ou pagar.
 */
export interface JurosDoAtraso {
  /** Acréscimo estimado até hoje. */
  total: number
  /** Acréscimo de cada parcela atrasada, por `ParcelaDivida.n`. */
  porParcela: Map<number, number>
  /** Acréscimo de cada parte (dívida com partes), por `ParteDivida.id`. */
  porParte: Map<string, number>
  /** De quando os juros contam (o dia da conferência); null quando contam desde cada vencimento. */
  desde: string | null
  /** Quanto a dívida cresce por dia, hoje. */
  diario: number
}

const centavos = (n: number) => Math.round(n * 100) / 100
const diaDe = (iso: string) => {
  const [a, m, d] = iso.split('-').map(Number)
  return Date.UTC(a, m - 1, d) / 86400000
}
/** Dias corridos de `a` até `b` (b depois de a dá positivo). */
export const diasEntre = (a: string, b: string) => Math.round(diaDe(b) - diaDe(a))

/** A dívida tem regra de juros de atraso? Só em dívida que você deve, com a taxa (ou a multa) informada. */
export const temJurosDeAtraso = (d: Pick<Divida, 'sentido' | 'atraso_juros_mes' | 'atraso_multa'>) =>
  (d.sentido ?? 'devo') === 'devo' && typeof d.atraso_juros_mes === 'number' && d.atraso_juros_mes >= 0
  && (d.atraso_juros_mes > 0 || (d.atraso_multa ?? 0) > 0)

const vazio = (desde: string | null): JurosDoAtraso => ({ total: 0, porParcela: new Map(), porParte: new Map(), desde, diario: 0 })

/**
 * Quanto a dívida cresceu com o atraso até `hoje` (AAAA-MM-DD). `cal` é o calendário da dívida em `hoje`
 * (`calendarioDe(s, hoje)`): só parcela atrasada e com algo faltando cresce, e o que já foi pago cobre as parcelas da
 * mais antiga para a mais nova (como no resto do app).
 *
 * - Cada parcela conta a partir do vencimento, ou do dia da conferência se ele vier depois.
 * - A multa entra uma vez, na parcela que venceu no dia da conferência ou depois (as anteriores já trazem a multa no valor).
 * - Simples: `base × taxa/30 × dias`, com base = valor original da parcela (`valor_original` da parte) proporcional ao que falta.
 * - Composto: `falta × ((1 + taxa)^(dias/30) − 1)`.
 * - Base 'saldo' (cartão): o saldo inteiro cresce desde a primeira parcela atrasada (ou desde a conferência).
 */
export function jurosDoAtraso(s: SituacaoDivida, cal: Calendario | null, hoje: string): JurosDoAtraso {
  const d = s.divida
  const conf = d.conferido_em ?? null
  if (!temJurosDeAtraso(d) || s.restante <= 0 || s.semCotacao) return vazio(conf)
  const taxa = (d.atraso_juros_mes ?? 0) / 100
  const multa = Math.max(0, d.atraso_multa ?? 2) / 100
  const composto = d.atraso_tipo === 'composto'
  const fator = (dias: number) => (composto ? Math.pow(1 + taxa, dias / 30) - 1 : (taxa / 30) * dias)
  /** Juros (e multa) de um valor atrasado desde `venc`, e quanto ele cresce por dia hoje. */
  const crescimento = (base: number, venc: string, semMulta = false) => {
    if (base <= 0 || venc >= hoje) return { valor: 0, diario: 0 }
    const inicio = conf && conf > venc ? conf : venc
    const dias = Math.max(0, diasEntre(inicio, hoje))
    const comMulta = !semMulta && (!conf || venc >= conf)
    return {
      valor: base * fator(dias) + (comMulta ? base * multa : 0),
      diario: base * (fator(dias + 1) - fator(dias)),
    }
  }

  const r = vazio(conf)
  let diario = 0

  if (d.atraso_base === 'saldo') {
    // o saldo inteiro cresce: desde a primeira parcela atrasada; sem calendário, desde a conferência (sem multa: já veio no valor)
    const primeira = cal ? cal.atrasadas[0]?.vencimento : conf
    if (!primeira) return r
    const c = crescimento(s.restante, primeira, !cal)
    r.total = centavos(c.valor)
    diario = c.diario
    // repartido entre as parcelas e as partes atrasadas pelo que falta de cada uma (para mostrar e para gravar ao conferir)
    const atrasadas = cal?.atrasadas ?? []
    const soma = atrasadas.reduce((a, p) => a + p.falta, 0)
    for (const p of atrasadas) {
      const parte = soma > 0 ? (r.total * p.falta) / soma : 0
      r.porParcela.set(p.n, centavos(parte))
      const somaPartes = p.partes?.reduce((a, x) => a + x.valor, 0) ?? 0
      for (const x of p.partes ?? []) r.porParte.set(x.id, centavos(somaPartes > 0 ? (parte * x.valor) / somaPartes : 0))
    }
    r.diario = centavos(diario)
    return r
  }

  // cada parcela atrasada cresce sobre o que falta dela
  for (const p of cal?.atrasadas ?? []) {
    if (p.falta <= 0 || p.valor <= 0) continue
    const fracao = p.falta / p.valor
    let daParcela = 0
    if (p.partes?.length) {
      for (const x of p.partes) {
        const base = (composto ? x.valor : x.valor_original ?? x.valor) * fracao
        const c = crescimento(base, p.vencimento)
        r.porParte.set(x.id, centavos(c.valor))
        daParcela += c.valor
        diario += c.diario
      }
    } else {
      const c = crescimento(p.falta, p.vencimento)
      daParcela = c.valor
      diario += c.diario
    }
    const arred = centavos(daParcela)
    if (arred > 0) r.porParcela.set(p.n, arred)
    r.total = centavos(r.total + arred)
  }
  r.diario = centavos(diario)
  return r
}

/** "No atraso: 17,5% ao mês sobre cada parcela atrasada · multa de 2% · conferido em 04/11"; null sem regra. */
export function regraDoAtraso(d: Divida): string | null {
  if (!temJurosDeAtraso(d)) return null
  const t = fmtTaxa(d.atraso_juros_mes ?? 0)
  const composto = d.atraso_tipo === 'composto'
  const regra = d.atraso_base === 'saldo'
    ? (composto ? tx('No atraso: {0}% ao mês, juros sobre juros, sobre o saldo inteiro', t) : tx('No atraso: {0}% ao mês sobre o saldo inteiro', t))
    : (composto ? tx('No atraso: {0}% ao mês, juros sobre juros, em cada parcela atrasada', t) : tx('No atraso: {0}% ao mês sobre cada parcela atrasada', t))
  const multa = (d.atraso_multa ?? 0) > 0 ? tx('multa de {0}%', fmtTaxa(d.atraso_multa!)) : null
  const conf = d.conferido_em ? tx('conferido em {0}', fmtDataCurta(d.conferido_em)) : null
  return [regra, multa, conf].filter(Boolean).join(' · ')
}
