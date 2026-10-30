import { useEffect, useRef, useState } from 'react'
import { semMovimento } from '../lib/tema'

const suave = (t: number) => 1 - Math.pow(1 - t, 4)

/**
 * Número que conta até o valor (como os saldos do vídeo de referência): na primeira vez parte do zero,
 * depois anda do valor anterior até o novo, ao trocar de mês ou lançar algo.
 */
export function Numero({ valor, formato, duracao = 1200 }: { valor: number; formato: (n: number) => string; duracao?: number }) {
  const [parado] = useState(semMovimento)
  const [mostrado, setMostrado] = useState(0)
  const atual = useRef(0)
  useEffect(() => {
    if (parado) return
    const de = atual.current
    const inicio = performance.now()
    let quadro = requestAnimationFrame(function passo(agora) {
      const t = Math.min(1, (agora - inicio) / duracao)
      const v = de + (valor - de) * suave(t)
      atual.current = v
      setMostrado(v)
      if (t < 1) quadro = requestAnimationFrame(passo)
    })
    return () => cancelAnimationFrame(quadro)
  }, [valor, duracao, parado])
  // translate="no": o tradutor do Google (lib/idioma.ts) não mexe em valores, que mudam o tempo todo enquanto contam
  return <span translate="no">{formato(parado ? valor : mostrado)}</span>
}
