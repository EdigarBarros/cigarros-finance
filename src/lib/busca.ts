import { MESES_NOME } from './format'
import type { Lancamento } from './types'

/** Minúsculas e sem acento: "João" e "joao" são a mesma palavra. */
export const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// nomes dos meses, na língua da tela e em português (a pessoa pode digitar de qualquer um dos dois)
const NOMES_DOS_MESES = (() => {
  const pt = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
  return pt.map((nome, i) => new Set([nome, semAcento(MESES_NOME[i])]))
})()
const mesPeloNome = (t: string) => {
  const i = NOMES_DOS_MESES.findIndex((nomes) => nomes.has(t))
  if (i >= 0) return i + 1
  // abreviação só com o ano ("out/2025"): sozinha ela confundiria com palavras da descrição
  return 0
}
const mesPelaAbreviacao = (t: string) => {
  if (t.length < 3) return 0
  const i = NOMES_DOS_MESES.findIndex((nomes) => [...nomes].some((n) => n.startsWith(t)))
  return i + 1
}

const doisAnos = (a: number) => (a < 100 ? 2000 + a : a)

/** "1.234,56", "1234,56", "1234.56", "R$ 150", "150": o número que a pessoa quis dizer, ou null. */
export function numeroDigitado(termo: string): { valor: number; inteiro: boolean } | null {
  const t = termo.replace(/^r\$/, '').replace(/^-/, '')
  if (!/^\d[\d.,]*$/.test(t)) return null
  let n: string
  let inteiro = false
  if (t.includes(',')) {
    // vírgula decimal; os pontos são separador de milhar
    if (!/^\d{1,3}(\.\d{3})*,\d{1,2}$|^\d+,\d{1,2}$/.test(t)) return null
    n = t.replace(/\./g, '').replace(',', '.')
  } else if (/^\d{1,3}(\.\d{3})+$/.test(t)) {
    n = t.replace(/\./g, '')
    inteiro = true
  } else if (/^\d+\.\d{1,2}$/.test(t)) {
    n = t
  } else if (/^\d+$/.test(t)) {
    n = t
    inteiro = true
  } else return null
  const valor = Number(n)
  return Number.isFinite(valor) ? { valor, inteiro } : null
}

/** O termo bate com o dia, mês e/ou ano de uma data ISO (aaaa-mm-dd)? null quando o termo não parece data. */
function bateComData(termo: string, data: string | null, hoje: string, ontem: string): boolean | null {
  let m: RegExpMatchArray | null
  if (termo === 'hoje') return data === hoje
  if (termo === 'ontem') return data === ontem
  const [a, mes, dia] = data ? data.split('-').map(Number) : [0, 0, 0]
  if ((m = termo.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) return data !== null && a === +m[1] && mes === +m[2] && dia === +m[3]
  if ((m = termo.match(/^(\d{4})-(\d{1,2})$/))) return data !== null && a === +m[1] && mes === +m[2]
  // 25/10, 25/10/2025, 25-10-25, 25.10
  if ((m = termo.match(/^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2}|\d{4}))?$/))) {
    if (!data) return false
    if (+m[1] > 31 || +m[2] > 12 || +m[1] < 1 || +m[2] < 1) return null
    return dia === +m[1] && mes === +m[2] && (!m[3] || a === doisAnos(+m[3]))
  }
  // 10/2025
  if ((m = termo.match(/^(\d{1,2})[/.-](\d{4})$/))) return data !== null && mes === +m[1] && a === +m[2]
  // out/2025, outubro/25
  if ((m = termo.match(/^([a-z]{3,9})[/.-](\d{2}|\d{4})$/))) {
    const nome = mesPeloNome(m[1]) || mesPelaAbreviacao(m[1])
    return nome ? data !== null && mes === nome && a === doisAnos(+m[2]) : null
  }
  // nome do mês por inteiro: "outubro"
  const nomeMes = mesPeloNome(termo)
  if (nomeMes) return data !== null && mes === nomeMes
  // ano sozinho: "2025"
  if (/^(19|20)\d{2}$/.test(termo)) return data !== null && a === +termo
  return null
}

/**
 * Busca da página Lançamentos. Cada palavra digitada precisa aparecer (todas juntas), e uma palavra serve se bater com:
 * o texto do lançamento (descrição, categoria, banco, cartão, forma, dívida, tipo), o valor ("150", "1.234,56", "R$ 80")
 * ou a data ("25/10", "25/10/2025", "outubro", "out/2025", "2025", "hoje", "ontem").
 * `texto` é o que o lançamento diz, já sem acento e em minúsculas (a página monta).
 */
export function criarBusca(consulta: string, hoje: string, ontem: string): ((l: Lancamento, texto: string) => boolean) | null {
  const termos = semAcento(consulta).split(/\s+/).map((t) => t.trim()).filter((t) => t && t !== 'r$')
  if (!termos.length) return null
  return (l, texto) => termos.every((t) => {
    if (texto.includes(t)) return true
    const n = numeroDigitado(t)
    if (n) {
      const valores = [l.valor, l.valor_original ?? 0].filter((v) => v > 0)
      // "150" acha 150,00 e também 150,40; "150,40" só o valor exato
      if (valores.some((v) => (n.inteiro ? Math.floor(v + 0.005) === n.valor || Math.abs(v - n.valor) < 0.005 : Math.abs(v - n.valor) < 0.005))) return true
    }
    return bateComData(t, l.data, hoje, ontem) === true
  })
}
