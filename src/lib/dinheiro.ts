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
  const digitos = texto.replace(/\D/g, '').replace(/^0+/, '')
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
