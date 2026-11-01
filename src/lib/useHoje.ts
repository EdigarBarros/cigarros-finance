import { useEffect, useState } from 'react'

/**
 * A data de hoje, que muda sozinha: com a aba aberta desde ontem, "hoje" não fica parado. Atualiza na virada do dia e
 * quando a pessoa volta para a aba (o navegador pode segurar o relógio de uma aba escondida). Só troca o valor quando o
 * dia muda, então quem usa não redesenha à toa.
 */
export function useHoje(): Date {
  const [hoje, setHoje] = useState(() => new Date())
  const dia = hoje.toDateString()
  useEffect(() => {
    const atualizar = () => setHoje((h) => { const n = new Date(); return n.toDateString() === h.toDateString() ? h : n })
    const agora = new Date()
    const virada = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + 1).getTime() - agora.getTime() + 1000
    const t = window.setTimeout(atualizar, virada)
    const aoVoltar = () => { if (!document.hidden) atualizar() }
    document.addEventListener('visibilitychange', aoVoltar)
    window.addEventListener('focus', atualizar)
    return () => { window.clearTimeout(t); document.removeEventListener('visibilitychange', aoVoltar); window.removeEventListener('focus', atualizar) }
  }, [dia])
  return hoje
}
