import { useCallback, useEffect, useState } from 'react'
import { listarPedidos, temRespostaNova } from './suporte'

/** Quantos pedidos têm resposta nova (para o aviso no botão de suporte). Confere a cada 2 minutos e ao voltar ao app. */
export function useRespostasNovas() {
  const [n, setN] = useState(0)
  const conferir = useCallback(() => {
    listarPedidos().then((p) => setN(p.filter(temRespostaNova).length), () => {})
  }, [])
  useEffect(() => {
    conferir()
    const t = window.setInterval(() => { if (document.visibilityState === 'visible') conferir() }, 120_000)
    const voltou = () => { if (document.visibilityState === 'visible') conferir() }
    document.addEventListener('visibilitychange', voltou)
    return () => { window.clearInterval(t); document.removeEventListener('visibilitychange', voltou) }
  }, [conferir])
  return [n, conferir] as const
}
