import { useEffect, useRef, useState } from 'react'
import { diasDeTeste, irParaStripe, type Assinatura } from '../lib/assinatura'
import { useMobile } from '../lib/useMobile'
import { Icone } from './Icone'

const CHAVE = 'opuscash.avisoTeste'
const HORA = 3_600_000
const LIMITE_ARRASTO = 90

const escondidoAte = () => {
  try { return Number(localStorage.getItem(CHAVE)) || 0 } catch { return 0 }
}

/**
 * Aviso do teste grátis. Não fica o tempo todo na tela: aparece, a pessoa dispensa e ele só volta mais tarde (a cada 24 h; a cada 6 h
 * nos últimos 2 dias). No celular é uma notificação flutuante que se dispensa arrastando para o lado; no computador, uma faixa com X.
 */
export function AvisoTeste({ assinatura, moeda }: { assinatura: Assinatura; moeda: string }) {
  const mobile = useMobile()
  const dias = diasDeTeste(assinatura)
  const [visivel, setVisivel] = useState(false)
  const [saindo, setSaindo] = useState(false)
  const [dx, setDx] = useState(0)
  const inicio = useRef<{ x: number; y: number } | null>(null)

  // aparece alguns segundos depois de abrir o painel, e só se não foi dispensado há pouco
  useEffect(() => {
    if (escondidoAte() > Date.now()) return
    const t = window.setTimeout(() => setVisivel(true), 3000)
    return () => window.clearTimeout(t)
  }, [])

  const dispensar = () => {
    try { localStorage.setItem(CHAVE, String(Date.now() + (dias <= 2 ? 6 : 24) * HORA)) } catch { /* vale só nesta visita */ }
    setSaindo(true)
    window.setTimeout(() => setVisivel(false), 220)
  }

  if (!visivel) return null

  const arrastar = {
    onPointerDown: (e: React.PointerEvent) => { inicio.current = { x: e.clientX, y: e.clientY } },
    onPointerMove: (e: React.PointerEvent) => {
      if (!inicio.current) return
      const mx = e.clientX - inicio.current.x
      if (Math.abs(mx) > 6) setDx(mx)
    },
    onPointerUp: () => {
      inicio.current = null
      if (Math.abs(dx) > LIMITE_ARRASTO) dispensar()
      else setDx(0)
    },
    onPointerCancel: () => { inicio.current = null; setDx(0) },
  }

  const estilo = mobile && dx !== 0
    ? { transform: `translateX(${dx}px)`, opacity: Math.max(0.2, 1 - Math.abs(dx) / 260), transition: 'none' }
    : undefined

  return (
    <div className={`aviso-teste ${mobile ? 'flutuante' : ''} ${saindo ? 'saindo' : ''}`} role="status" style={estilo} {...(mobile ? arrastar : {})}>
      <span>
        Teste grátis: {dias === 1 ? 'falta 1 dia' : `faltam ${dias} dias`}. Só pedimos o cartão quando você decidir assinar.
      </span>
      <button className="link" onClick={() => void irParaStripe('stripe-checkout', moeda).then((m) => m && alert(m))}>Assinar agora</button>
      {!mobile && (
        <button className="aviso-teste-x" onClick={dispensar} aria-label="Fechar aviso"><Icone nome="fechar" tamanho={16} /></button>
      )}
    </div>
  )
}
