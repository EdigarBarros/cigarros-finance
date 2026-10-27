export const MESES = [
  'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
  'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO',
]

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const pct = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 0 })

export const fmtBRL = (n: number) => brl.format(n || 0)
export const fmtUSD = (n: number) => usd.format(n || 0)
export const fmtPct = (n: number) => pct.format(Number.isFinite(n) ? n : 0)

const MES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** "2026-10-02" -> "2-out", o mesmo formato da coluna DATA da planilha. */
export function fmtDataCurta(iso: string | null) {
  if (!iso) return ''
  const [, m, d] = iso.split('-').map(Number)
  return `${d}-${MES_CURTO[m - 1]}`
}

/**
 * Converte o que foi digitado em número. Aceita "1.234,56", "12,5", "R$ 10"
 * e, como na planilha, contas simples começando com "=" (ex.: "=105,53-60,02").
 */
export function parseNumero(texto: string): number | null {
  let s = texto.trim().replace(/R\$|US\$|\$|\s/g, '')
  if (!s) return null
  const conta = s.startsWith('=')
  if (conta) s = s.slice(1)
  // vírgula decimal brasileira: "1.234,56" -> "1234.56"
  s = s.replace(/(\d)\.(?=\d{3}(\D|$))/g, '$1').replace(/,/g, '.')
  if (!/^[\d.+\-*/() ]+$/.test(s)) return null
  if (!conta && !/^-?\d*\.?\d+$/.test(s)) return null
  try {
    const n = Function(`"use strict";return (${s})`)() as unknown
    return typeof n === 'number' && Number.isFinite(n) ? Math.round(n * 100) / 100 : null
  } catch {
    return null
  }
}

/** Data padrão para um lançamento novo: hoje, se estiver no mês aberto; senão, dia 1. */
export function dataPadrao(ano: number, mes: number) {
  const hoje = new Date()
  const dia = hoje.getFullYear() === ano && hoje.getMonth() + 1 === mes ? hoje.getDate() : 1
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}
