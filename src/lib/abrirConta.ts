import type { CSSProperties } from 'react'
import { adicionarConta, pedeSenha, trocarPara, type ContaSalva } from './contas'
import { tx } from './textos'

/* O que o menu da conta (components/Contas.tsx) e a tela de escolher (components/EscolherConta.tsx) mostram de cada conta, e
   como abrir uma. */

export const nomeDe = (c: ContaSalva) => c.nome?.trim() || c.email.split('@')[0]
export const iniciaisDe = (c: ContaSalva) => nomeDe(c).split(/\s+/).slice(0, 2).map((x) => x[0]?.toUpperCase() ?? '').join('')

/** Abre a conta; se a sessão dela venceu, leva ao login com o e-mail já preenchido. */
export async function abrir(c: ContaSalva, aoErro: (m: string) => void) {
  if (pedeSenha(c)) { adicionarConta(c.email); return }
  const r = await trocarPara(c.id)
  if (r === 'precisa-entrar') adicionarConta(c.email)
  else if (r === 'sem-internet') aoErro(tx('Sem internet. Confira sua conexão e tente de novo.'))
}

/** Cores da foto de quem não tem foto: sempre as mesmas para a mesma conta (tela de perfis e tela de senha). */
const CORES: [string, string][] = [
  ['#1f8ef1', '#3d4be0'], ['#14c9a0', '#0b7d66'], ['#ff6b81', '#b8304a'], ['#ffb547', '#d9740b'], ['#8b7cf6', '#5340d6'],
]
export function coresDe(id: string) {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  const [c1, c2] = CORES[h % CORES.length]
  return { '--c1': c1, '--c2': c2 } as CSSProperties
}
