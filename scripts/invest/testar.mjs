/**
 * Testes do OpusCash Invest (src/lib/invest): os cenários financeiros de `casos.ts`, um por um.
 *   node scripts/invest/testar.mjs            → roda todos e mostra só o que falhou
 *   node scripts/invest/testar.mjs aporte     → roda só os casos com "aporte" no nome
 * Precisa do `npm install` (usa o rolldown que vem com o vite). Nada aqui vai para o site.
 */
import { rolldown } from 'rolldown'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const aqui = dirname(fileURLToPath(import.meta.url))
// o motor importa módulos que olham o navegador ao carregar (idioma, Supabase): aqui eles ganham um navegador de mentira
const navegadorFalso = `globalThis.document={cookie:'',documentElement:{lang:'pt'},addEventListener(){},querySelector(){return null}};
globalThis.localStorage={getItem(){return null},setItem(){},removeItem(){}};
Object.defineProperty(globalThis,'navigator',{value:{language:'pt-BR',languages:['pt-BR'],onLine:true},configurable:true});
globalThis.location={hash:'',search:'',hostname:'localhost',href:'http://localhost/',origin:'http://localhost'};
globalThis.window=globalThis;globalThis.addEventListener=()=>{};`
const pasta = mkdtempSync(join(tmpdir(), 'invest-'))
try {
  const pacote = await rolldown({
    input: join(aqui, 'casos.ts'), platform: 'node', logLevel: 'warn',
    transform: { define: { 'import.meta.env.VITE_SUPABASE_URL': '"https://teste.supabase.co"', 'import.meta.env.VITE_SUPABASE_ANON_KEY': '"anon"' } },
  })
  await pacote.write({ dir: pasta, entryFileNames: 'casos.mjs', format: 'esm', banner: navegadorFalso })
  const { rodar } = await import(pathToFileURL(join(pasta, 'casos.mjs')).href)
  const falhas = await rodar(process.argv[2])
  process.exitCode = falhas ? 1 : 0
} finally {
  rmSync(pasta, { recursive: true, force: true })
}
// o cliente do Supabase deixa um relógio ligado: sem isto o node não termina
process.exit(process.exitCode ?? 0)
