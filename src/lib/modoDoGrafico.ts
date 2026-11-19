import { useState } from 'react'
import { gravarNaConta, lerDaConta } from './contas'

/** O que os gráficos de fluxo mostram: só o que já aconteceu, ou também o que ainda vem (fatura aberta, contas e recebimentos). */
export type ModoDoGrafico = 'feito' | 'previsto'

const CHAVE = 'opuscash.modoDoGrafico'

const lerModo = (): ModoDoGrafico => {
  return lerDaConta(CHAVE) === 'previsto' ? 'previsto' : 'feito'
}

/** A escolha vale para os dois gráficos (Início e Resumo do ano) e fica guardada neste aparelho. */
export function useModoDoGrafico(): [ModoDoGrafico, (m: ModoDoGrafico) => void] {
  const [modo, setModo] = useState<ModoDoGrafico>(lerModo)
  return [modo, (m) => {
    setModo(m)
    gravarNaConta(CHAVE, m)
  }]
}
