import { idiomaAtual } from './idioma'
import { nativo, tx } from './textos'

/** Em português e maiúsculas: é como a planilha de importação escreve os meses (lib/planilha.ts). */
export const MESES = [
  'JANEIRO', 'FEVEREIRO', tx('MARÇO'), 'ABRIL', 'MAIO', 'JUNHO',
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
// nomes dos meses na língua da tela (inglês e espanhol têm tradução nossa; o resto passa pelo tradutor do Google a partir do português)
const idiomaDasDatas = nativo ? idiomaAtual() : 'pt'
/** Para toLocaleDateString: as datas por extenso saem na língua da tela. */
export const LOCAL_DAS_DATAS = idiomaDasDatas === 'pt' ? 'pt-BR' : idiomaDasDatas
const nomesDosMeses = (formato: 'long' | 'short') =>
  Array.from({ length: 12 }, (_, i) => {
    const nome = new Intl.DateTimeFormat(idiomaDasDatas, { month: formato, timeZone: 'UTC' }).format(Date.UTC(2026, i, 15)).replace('.', '')
    return nome[0].toUpperCase() + nome.slice(1)
  })
export const MESES_NOME = nomesDosMeses('long')
export const MESES_CURTO = MESES_NOME.map((m) => m.slice(0, 3))

export const fmtPct = (n: number) => pct.format(Number.isFinite(n) ? n : 0)

const MES_CURTO = MESES_CURTO.map((m) => (idiomaDasDatas === 'en' ? m : m.toLowerCase()))

/** "2026-10-02" -> "2 de out" (em inglês, "Oct 2") */
export function fmtDataCurta(iso: string | null) {
  if (!iso) return ''
  const [, m, d] = iso.split('-').map(Number)
  return tx('{0} de {1}', d, MES_CURTO[m - 1])
}

/** (2027, 3) -> "mar de 2027" (em inglês, "Mar 2027") */
export const fmtMesAno = (ano: number, mes: number) => tx('{1} de {0}', ano, MES_CURTO[mes - 1])

/**
 * Calcula uma conta simples (+ - * / e parênteses, números com ponto decimal) sem usar eval/Function, que a política de
 * segurança do site (CSP) bloqueia. Devolve null se a expressão for inválida.
 */
function calcular(expr: string): number | null {
  const fichas = expr.match(/\d*\.?\d+|[-+*/()]/g)
  if (!fichas || fichas.join('') !== expr.replace(/\s/g, '')) return null
  let i = 0
  const soma = (): number | null => {
    let v = produto()
    while (v !== null && (fichas[i] === '+' || fichas[i] === '-')) {
      const op = fichas[i++]
      const d = produto()
      if (d === null) return null
      v = op === '+' ? v + d : v - d
    }
    return v
  }
  const produto = (): number | null => {
    let v = unario()
    while (v !== null && (fichas[i] === '*' || fichas[i] === '/')) {
      const op = fichas[i++]
      const d = unario()
      if (d === null) return null
      v = op === '*' ? v * d : v / d
    }
    return v
  }
  const unario = (): number | null => {
    if (fichas[i] === '-') { i++; const v = unario(); return v === null ? null : -v }
    if (fichas[i] === '+') { i++; return unario() }
    if (fichas[i] === '(') {
      i++
      const v = soma()
      if (v === null || fichas[i++] !== ')') return null
      return v
    }
    const n = Number(fichas[i++])
    return Number.isFinite(n) ? n : null
  }
  const r = soma()
  return r !== null && i === fichas.length ? r : null
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
  const n = calcular(s)
  return n !== null && Number.isFinite(n) ? Math.round(n * 100) / 100 : null
}

/** Data padrão para um lançamento novo: hoje, se estiver no mês aberto; senão, dia 1. */
export function dataPadrao(ano: number, mes: number) {
  const hoje = new Date()
  const dia = hoje.getFullYear() === ano && hoje.getMonth() + 1 === mes ? hoje.getDate() : 1
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

/** "2026-10-02" -> "2 de outubro" */
export function fmtDataLonga(iso: string | null) {
  if (!iso) return tx('Sem data')
  const [, m, d] = iso.split('-').map(Number)
  return tx('{0} de {1}', d, idiomaDasDatas === 'en' ? MESES_NOME[m - 1] : MESES_NOME[m - 1].toLowerCase())
}

/** Valor para preencher um campo de edição: 1234.5 -> "1234,50". */
export const paraCampo = (n: number) => (n ? n.toFixed(2).replace('.', ',') : '')

/** Variação percentual entre dois meses (null quando não há base de comparação). */
export const variacao = (atual: number, anterior: number | undefined) =>
  anterior === undefined || anterior === 0 ? null : (atual - anterior) / Math.abs(anterior)
