/**
 * Símbolos de verdade dos bancos (src/assets/bancos, já limpos por scripts/logos/limpar.py: só formas e cores).
 * O arquivo tem o nome do banco como em estiloBanco (o primeiro apelido, com hífens). Banco sem arquivo continua
 * com o selo de letras.
 */
const ARQUIVOS = import.meta.glob('../assets/bancos/*.svg', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

/**
 * Como o símbolo entra no selo: 'branco' pinta o símbolo de branco sobre a cor da marca (como o ícone do app);
 * 'cores' mantém as cores originais sobre `fundo`; 'icone' é o arquivo que já é o ícone quadrado inteiro.
 * `margem`: folga em volta do símbolo, de 0 a 12 (o selo tem 24). `trocar`: cores do arquivo que mudam para combinar
 * com o fundo (ex.: a parte azul do X da Caixa vira branca sobre o azul da marca). Nada de fundo branco: o selo fica
 * sempre na cor da marca, como os outros do app.
 */
export interface ModoLogo { modo: 'branco' | 'cores' | 'icone'; fundo?: [string, string]; margem?: number; trocar?: Record<string, string> }

const MODOS: Record<string, ModoLogo> = {
  nubank: { modo: 'branco', margem: 5.2 },
  itau: { modo: 'icone' },
  bradesco: { modo: 'branco', margem: 4.6 },
  'banco-do-brasil': { modo: 'cores', margem: 5 },
  caixa: { modo: 'cores', margem: 4.4, trocar: { '#0066b3': '#ffffff' } },
  santander: { modo: 'branco', margem: 4.8 },
  inter: { modo: 'branco', margem: 5.2 },
  'c6-bank': { modo: 'branco', margem: 4.6 },
  picpay: { modo: 'branco', margem: 4.6 },
  pagbank: { modo: 'cores', margem: 3.8, trocar: { '#000': '#0b3d2a' } },
  bv: { modo: 'branco', margem: 4.6 },
  'mercado-pago': { modo: 'branco', margem: 3.6 },
  'btg-pactual': { modo: 'branco', margem: 3.4 },
  neon: { modo: 'branco', margem: 5.4 },
  next: { modo: 'branco', margem: 5.6 },
  safra: { modo: 'cores', margem: 4, trocar: { '#000030': '#d9b46a' } },
  agibank: { modo: 'branco', margem: 4.4 },
  wise: { modo: 'cores', margem: 5, trocar: { '#00b9ff': '#163300' } },
  nomad: { modo: 'cores', margem: 4.6 },
  'will-bank': { modo: 'cores', margem: 5 },
}

export interface LogoBanco extends ModoLogo { viewBox: string; corpo: string }

const LOGOS = new Map<string, LogoBanco>()
for (const [caminho, svg] of Object.entries(ARQUIVOS)) {
  const chave = caminho.split('/').pop()!.replace(/\.svg$/, '')
  const viewBox = /viewBox="([^"]+)"/.exec(svg)?.[1]
  const modo = MODOS[chave] ?? { modo: 'branco' }
  let corpo = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')
  for (const [de, para] of Object.entries(modo.trocar ?? {})) corpo = corpo.replace(new RegExp(`fill="${de}"`, 'gi'), `fill="${para}"`)
  if (viewBox) LOGOS.set(chave, { ...modo, viewBox, corpo })
}

/** O símbolo do banco cujo primeiro apelido em estiloBanco é `apelido` ("banco do brasil"). */
export const logoDoBanco = (apelido: string) => LOGOS.get(apelido.replace(/\s+/g, '-'))
