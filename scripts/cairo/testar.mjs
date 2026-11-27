/**
 * Testes do Cairo (src/cairo), parte de dados.
 *   node scripts/cairo/testar.mjs            → pureza do núcleo e todos os casos (personas sintéticas)
 *   node scripts/cairo/testar.mjs cenarios   → só os casos com "cenarios" no nome
 *   node scripts/cairo/testar.mjs --regua    → a régua: o Cairo contra as referências simples, com a ficha de vazamento
 *
 * 1. Pureza: empacota só src/cairo/index.ts e importa num Node SEM navegador falso e SEM as variáveis do Vite. Se alguém
 *    puser React, Supabase, DOM ou src/lib no núcleo, falha aqui.
 * 2. Casos: scripts/cairo/casos.ts.
 * Precisa do `npm install` (usa o rolldown que vem com o vite). Nada aqui vai para o site.
 */
import { rolldown } from 'rolldown'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'

const aqui = dirname(fileURLToPath(import.meta.url))
const base = join(aqui, '../../node_modules/.cache')
mkdirSync(base, { recursive: true })
const pasta = mkdtempSync(join(base, 'cairo-'))

const empacotar = async (entrada, saida) => {
  const pacote = await rolldown({ input: entrada, platform: 'node', logLevel: 'warn' })
  await pacote.write({ dir: pasta, entryFileNames: saida, format: 'esm', codeSplitting: false })
  return join(pasta, saida)
}

let falhou = false
try {
  // 1. pureza, num processo separado e limpo
  const nucleo = await empacotar(join(aqui, '../../src/cairo/index.ts'), 'nucleo.mjs')
  try {
    const saida = execFileSync(process.execPath, ['--input-type=module', '-e',
      `const c = await import(${JSON.stringify(pathToFileURL(nucleo).href)}); ` +
      `if (typeof c.lerCairo !== 'function') throw new Error('sem lerCairo'); ` +
      `for (const g of ['document', 'window', 'localStorage', 'navigator']) if (g in globalThis && g !== 'navigator') throw new Error('o núcleo criou ' + g); ` +
      `console.log('ok')`], { encoding: 'utf8' })
    console.log(`pureza: o núcleo carrega no Node sem navegador (${saida.trim()})`)
  } catch (e) {
    falhou = true
    console.error('FALHOU pureza: o núcleo não carrega fora do navegador\n', e.stderr || e.message)
  }
  // 2. casos
  const casos = await empacotar(join(aqui, 'casos.ts'), 'casos.mjs')
  const m = await import(pathToFileURL(casos).href)
  const falhas = process.argv[2] === '--regua' ? await m.regua() : await m.rodar(process.argv[2])
  if (falhas) falhou = true
} finally {
  rmSync(pasta, { recursive: true, force: true })
}
process.exit(falhou ? 1 : 0)
