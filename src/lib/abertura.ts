import { useEffect, useSyncExternalStore } from 'react'

/**
 * Tela de abertura (components/Abertura.tsx): uma camada só, por cima de tudo, que entra quando alguma parte do app está
 * carregando e sai com animação quando todas terminam. Cada tela de carregamento "segura" a abertura enquanto está na tela;
 * como elas se sucedem (sessão → assinatura → painel → dados), a camada não pisca entre uma e outra.
 */
let seguras = 0
const ouvintes = new Set<() => void>()
const avisar = () => ouvintes.forEach((f) => f())

export function segurarAbertura() {
  seguras += 1
  avisar()
  let solto = false
  return () => {
    if (solto) return
    solto = true
    seguras -= 1
    avisar()
  }
}

/** Enquanto o componente estiver na tela, a abertura fica. */
export function useSegurarAbertura(ligado = true) {
  useEffect(() => (ligado ? segurarAbertura() : undefined), [ligado])
}

export function useAberturaSegura() {
  return useSyncExternalStore((f) => { ouvintes.add(f); return () => ouvintes.delete(f) }, () => seguras > 0)
}

/** Há uma sessão guardada neste aparelho (quem vai cair no painel). Quem só visita a página inicial não vê a abertura. */
export function temSessaoSalva() {
  try { return Object.keys(localStorage).some((k) => /^sb-.+-auth-token$/.test(k)) } catch { return false }
}
