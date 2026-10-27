import { useEffect, useState } from 'react'

const consulta = '(max-width: 860px)'

/** true em telas de celular (mesmo ponto de quebra do CSS). */
export function useMobile() {
  const [mobile, setMobile] = useState(() => window.matchMedia(consulta).matches)
  useEffect(() => {
    const mq = window.matchMedia(consulta)
    const aoMudar = () => setMobile(mq.matches)
    mq.addEventListener('change', aoMudar)
    return () => mq.removeEventListener('change', aoMudar)
  }, [])
  return mobile
}
