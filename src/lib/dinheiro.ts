import { tx } from './textos'

/** Quantas casas decimais a moeda usa (2 para real e dólar, 0 para iene e peso chileno). */
const casas = new Map<string, number>()
export function casasDaMoeda(moeda: string): number {
  let n = casas.get(moeda)
  if (n === undefined) {
    try { n = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: moeda }).resolvedOptions().maximumFractionDigits ?? 2 } catch { n = 2 }
    casas.set(moeda, n)
  }
  return n
}

/**
 * Máscara de dinheiro, como na tela do Pix: só os dígitos contam e entram pela direita. Digitar 1 mostra 0,01; 15 mostra 0,15;
 * 1500 mostra 15,00; 123456 mostra 1.234,56. Contas começando com "=" (ex.: =105,53-60,02) passam sem mudar.
 */
export function mascarar(texto: string, decimais = 2): string {
  if (/[=+*/()a-zA-Z]/.test(texto)) return texto
  // 10 dígitos inteiros: o banco guarda valores de até 9.999.999.999,99 (numeric(12,2)); mais que isso dá "numeric field overflow"
  const digitos = texto.replace(/\D/g, '').replace(/^0+/, '').slice(0, 10 + decimais)
  if (!digitos) return ''
  const cheio = digitos.padStart(decimais + 1, '0')
  const inteiro = cheio.slice(0, cheio.length - decimais).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return decimais ? `${inteiro},${cheio.slice(-decimais)}` : inteiro
}

/** Número no jeito que o campo mascarado mostra (para preencher o campo ao editar um valor que já existe). */
export function paraCampoMoeda(n: number, moeda: string): string {
  if (!n) return ''
  const d = casasDaMoeda(moeda)
  return mascarar(String(Math.round(n * 10 ** d)), d)
}

/**
 * Cotação digitada ("1.250,5", "287,7", "0,0035") como número, sem arredondar para 2 casas: o peso argentino vale uns
 * 0,0035 reais, e arredondar zeraria a conta. null se não for um número maior que zero.
 */
export function parseTaxa(texto: string): number | null {
  let s = texto.trim().replace(/[^\d.,]/g, '')
  if (!s) return null
  s = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s
  const n = Number(s)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** Cotação no jeito de mostrar: 5,3476 · 287,70 · 0,003476 (poucas casas quando é grande, as significativas quando é pequena). */
export function fmtTaxa(n: number): string {
  const t = n >= 100 ? n.toFixed(2) : n >= 1 ? String(Number(n.toFixed(4))) : String(Number(n.toPrecision(4)))
  return t.replace('.', ',')
}

/** Maior valor que o banco guarda em lançamentos, dívidas e contas (numeric(12,2)). Metas e limites aceitam mais, mas 10 bilhões é teto de sobra. */
export const VALOR_MAX = 9_999_999_999.99
export const valorGrandeDemais = (n: number) => n > VALOR_MAX
export const erroValorGrande = () => tx('Esse valor é grande demais. Use menos de 10 bilhões.')

/** Ano mais antigo e mais distante que fazem sentido numa data digitada (0001-01-01 ou 275760-09-13 sairiam do painel). */
export const ANO_MIN = 1990
export const anoMax = () => new Date().getFullYear() + 10
/** Data no formato AAAA-MM-DD, existente e dentro do intervalo acima. */
export function dataPlausivel(iso: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return false
  const [a, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])]
  if (a < ANO_MIN || a > anoMax() || mes < 1 || mes > 12) return false
  return dia >= 1 && dia <= new Date(a, mes, 0).getDate()
}
export const erroDataFora = () => tx('Use uma data entre {0} e {1}.', ANO_MIN, anoMax())
