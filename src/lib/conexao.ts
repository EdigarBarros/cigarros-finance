import { useSyncExternalStore } from 'react'
import { noAppNativo } from './appAndroid'

/**
 * Se o aparelho está sem internet. No navegador, navigator.onLine e os eventos online/offline. No app Android, o plugin de
 * rede do Capacitor, que pergunta ao próprio Android (a página do app nem sempre fica sabendo sozinha que a rede caiu).
 * Quem usa: a tela de sem internet (components/SemInternet.tsx), a faixa do painel e a assinatura, que tenta de novo na
 * hora em que a conexão volta (lib/assinatura.ts).
 */
let semInternet = typeof navigator !== 'undefined' && navigator.onLine === false
const ouvintes = new Set<(semInternet: boolean) => void>()

function mudar(agora: boolean) {
  if (agora === semInternet) return
  semInternet = agora
  ouvintes.forEach((f) => f(agora))
}

addEventListener('online', () => mudar(false))
addEventListener('offline', () => mudar(true))
if (noAppNativo) {
  void import('@capacitor/network')
    .then(async ({ Network }) => {
      await Network.addListener('networkStatusChange', (s) => mudar(!s.connected))
      mudar(!(await Network.getStatus()).connected)
    })
    .catch(() => { /* sem o plugin, vale o navigator.onLine */ })
}

export const estaSemInternet = () => semInternet

/** Avisa a cada troca (true = caiu, false = voltou). Devolve a função que para de avisar. */
export function aoMudarConexao(f: (semInternet: boolean) => void) {
  ouvintes.add(f)
  return () => { ouvintes.delete(f) }
}

export const useSemInternet = () => useSyncExternalStore(aoMudarConexao, estaSemInternet)
