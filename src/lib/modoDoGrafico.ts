import { useState } from 'react'

/** O que os gráficos de fluxo mostram: só o que já aconteceu, ou também o que ainda vem (fatura aberta, contas e recebimentos). */
export type ModoDoGrafico = 'feito' | 'previsto'

const CHAVE = 'opuscash.modoDoGrafico'

const lerModo = (): ModoDoGrafico => {
  try { return localStorage.getItem(CHAVE) === 'previsto' ? 'previsto' : 'feito' } catch { return 'feito' }
}

/** A escolha vale para os dois gráficos (Início e Resumo do ano) e fica guardada neste aparelho. */
export function useModoDoGrafico(): [ModoDoGrafico, (m: ModoDoGrafico) => void] {
  const [modo, setModo] = useState<ModoDoGrafico>(lerModo)
  return [modo, (m) => {
    setModo(m)
    try { localStorage.setItem(CHAVE, m) } catch { /* sem armazenamento: vale só até recarregar */ }
  }]
}
