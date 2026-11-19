import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { temSessaoSalva, useAberturaSegura } from '../lib/abertura'
import { semMovimento } from '../lib/tema'
import { tx } from '../lib/textos'
import './abertura.css'

/** Tempo mínimo na tela, para a entrada terminar inteira (o símbolo se desenha, a órbita fecha e o nome sobe). */
const MINIMO = 1500
/** Entre uma tela de carregamento e a seguinte (sessão → assinatura → painel), espera um pouco antes de sair. */
const FOLGA = 140
const SAIDA = 760
const NOME = 'OPUSCASH'

type Fase = 'fora' | 'dentro' | 'saindo'

/**
 * A abertura do OpusCash: tela cheia no fundo do painel (grafite no escuro, claro no claro), com o símbolo do infinito se
 * desenhando da esquerda para a direita, uma órbita de luz que gira em volta enquanto carrega e o nome subindo letra por
 * letra. Quando tudo carregou, o centro cresce e desfoca e o fundo se dissolve, revelando a tela de baixo.
 * Fica por cima de tudo (fora das telas), então não pisca na troca entre uma tela de carregamento e outra; quem pede para
 * ela ficar são as telas de carregamento (lib/abertura.ts).
 */
export function Abertura() {
  const segura = useAberturaSegura()
  const [fase, setFase] = useState<Fase>(() => (temSessaoSalva() ? 'dentro' : 'fora'))
  const desde = useRef(0)
  const [vez, setVez] = useState(0)
  useEffect(() => { desde.current = performance.now() }, [])

  useEffect(() => {
    if (segura) {
      if (fase === 'fora') { desde.current = performance.now(); setVez((v) => v + 1); setFase('dentro') }
      else if (fase === 'saindo') setFase('dentro')
      return
    }
    if (fase === 'dentro') {
      const parado = semMovimento()
      const falta = parado ? 0 : Math.max(0, MINIMO - (performance.now() - desde.current))
      const t = window.setTimeout(() => setFase('saindo'), falta + FOLGA)
      return () => window.clearTimeout(t)
    }
    if (fase === 'saindo') {
      const t = window.setTimeout(() => setFase('fora'), semMovimento() ? 200 : SAIDA)
      return () => window.clearTimeout(t)
    }
  }, [segura, fase])

  if (fase === 'fora') return null
  return (
    <div key={vez} className={`abertura ${fase === 'saindo' ? 'saindo' : ''}`} role="status" aria-label={tx('Carregando')} translate="no">
      <div className="abertura-luz" aria-hidden="true" />
      <div className="abertura-centro" aria-hidden="true">
        <div className="abertura-simbolo">
          <svg className="abertura-orbita" viewBox="0 0 220 220">
            <defs>
              <linearGradient id="abertura-arco" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="var(--marca-3)" stopOpacity="0" />
                <stop offset=".55" stopColor="var(--marca-2)" stopOpacity=".55" />
                <stop offset="1" stopColor="var(--marca-3)" />
              </linearGradient>
            </defs>
            <circle className="abertura-trilho" cx="110" cy="110" r="104" />
            <g className="abertura-giro">
              <circle className="abertura-arco" cx="110" cy="110" r="104" stroke="url(#abertura-arco)" pathLength="100" />
              <circle className="abertura-ponta" cx="65.7" cy="204.1" r="2.6" />
            </g>
          </svg>
          <span className="abertura-infinito">
            <img src="/simbolo.webp" alt="" width={140} height={68} />
          </span>
        </div>
        <div className="abertura-nome">
          {[...NOME].map((l, i) => (
            <span key={i} className={i >= 4 ? 'cash' : ''} style={{ '--i': i } as CSSProperties}>{l}</span>
          ))}
        </div>
      </div>
    </div>
  )
}
