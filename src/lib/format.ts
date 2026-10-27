export const MESES = [
  'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
  'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO',
]

const formatos = new Map<string, Intl.NumberFormat>()
const formato = (moeda: string) => {
  let f = formatos.get(moeda)
  if (!f) {
    f = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: moeda })
    formatos.set(moeda, f)
  }
  return f
}

let moedaPrincipal = 'BRL'
/** Moeda principal da pessoa: todos os totais da tela aparecem nela. */
export const definirMoedaPrincipal = (moeda: string) => { moedaPrincipal = moeda }
export const moedaAtual = () => moedaPrincipal

const pct = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 0 })

/** Valor na moeda principal. */
export const fmtValor = (n: number) => formato(moedaPrincipal).format(n || 0)
export const fmtMoeda = (n: number, moeda: string) => formato(moeda).format(n || 0)
/** "R$", "US$", "€"… */
export const simbolo = (moeda = moedaPrincipal) =>
  formato(moeda).formatToParts(0).find((p) => p.type === 'currency')?.value ?? moeda
export const MESES_NOME = MESES.map((m) => m[0] + m.slice(1).toLowerCase())
export const MESES_CURTO = MESES_NOME.map((m) => m.slice(0, 3))

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
  let s = texto.trim().replace(/R\$|US\$|\$|€|£|¥|\s/g, '')
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

/** "2026-10-02" -> "2 de outubro" */
export function fmtDataLonga(iso: string | null) {
  if (!iso) return 'Sem data'
  const [, m, d] = iso.split('-').map(Number)
  return `${d} de ${MESES_NOME[m - 1].toLowerCase()}`
}

/** Valor para preencher um campo de edição: 1234.5 -> "1234,50". */
export const paraCampo = (n: number) => (n ? n.toFixed(2).replace('.', ',') : '')

/** Variação percentual entre dois meses (null quando não há base de comparação). */
export const variacao = (atual: number, anterior: number | undefined) =>
  anterior === undefined || anterior === 0 ? null : (atual - anterior) / Math.abs(anterior)
