import { adicionarConta, trocarPara, type ContaSalva } from './contas'
import { tx } from './textos'

/* O que o menu da conta (components/Contas.tsx) e a tela de escolher (components/EscolherConta.tsx) mostram de cada conta, e
   como abrir uma. */

export const nomeDe = (c: ContaSalva) => c.nome?.trim() || c.email.split('@')[0]
export const iniciaisDe = (c: ContaSalva) => nomeDe(c).split(/\s+/).slice(0, 2).map((x) => x[0]?.toUpperCase() ?? '').join('')

/** Abre a conta; se a sessão dela venceu, leva ao login com o e-mail já preenchido. */
export async function abrir(c: ContaSalva, aoErro: (m: string) => void) {
  if (c.precisaEntrar) { adicionarConta(c.email); return }
  const r = await trocarPara(c.id)
  if (r === 'precisa-entrar') adicionarConta(c.email)
  else if (r === 'sem-internet') aoErro(tx('Sem internet. Confira sua conexão e tente de novo.'))
}
