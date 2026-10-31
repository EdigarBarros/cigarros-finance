/**
 * Símbolos de verdade dos bancos (src/assets/bancos, já limpos por scripts/logos/limpar.py: só formas e cores).
 * O arquivo tem o nome do banco como em estiloBanco (o primeiro apelido, com hífens). Banco sem arquivo continua
 * com o selo de letras.
 */
const ARQUIVOS = import.meta.glob('../assets/bancos/*.svg', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

/**
 * Como o símbolo entra no selo: 'branco' pinta o símbolo de branco sobre a cor da marca (como o ícone do app);
 * 'cores' mantém as cores originais sobre `fundo`; 'icone' é o arquivo que já é o ícone quadrado inteiro.
 * `margem`: folga em volta do símbolo, de 0 a 12 (o selo tem 24).
 */
export interface ModoLogo { modo: 'branco' | 'cores' | 'icone'; fundo?: [string, string]; margem?: number }

const BRANCO_PURO: [string, string] = ['#ffffff', '#eef1f6']

const MODOS: Record<string, ModoLogo> = {
  nubank: { modo: 'branco', margem: 5.2 },
  itau: { modo: 'icone' },
  bradesco: { modo: 'branco', margem: 4.6 },
  'banco-do-brasil': { modo: 'cores', margem: 5 },
  caixa: { modo: 'cores', fundo: BRANCO_PURO, margem: 4.4 },
  santander: { modo: 'branco', margem: 4.8 },
  inter: { modo: 'branco', margem: 5.2 },
  'c6-bank': { modo: 'branco', margem: 4.6 },
  picpay: { modo: 'branco', margem: 4.6 },
  pagbank: { modo: 'cores', fundo: BRANCO_PURO, margem: 4.2 },
  bv: { modo: 'branco', margem: 4.6 },
  'mercado-pago': { modo: 'branco', margem: 3.6 },
  'will-bank': { modo: 'cores', margem: 5 },
}

export interface LogoBanco extends ModoLogo { viewBox: string; corpo: string }

const LOGOS = new Map<string, LogoBanco>()
for (const [caminho, svg] of Object.entries(ARQUIVOS)) {
  const chave = caminho.split('/').pop()!.replace(/\.svg$/, '')
  const viewBox = /viewBox="([^"]+)"/.exec(svg)?.[1]
  const corpo = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')
  if (viewBox) LOGOS.set(chave, { ...(MODOS[chave] ?? { modo: 'branco' }), viewBox, corpo })
}

/** O símbolo do banco cujo primeiro apelido em estiloBanco é `apelido` ("banco do brasil"). */
export const logoDoBanco = (apelido: string) => LOGOS.get(apelido.replace(/\s+/g, '-'))
