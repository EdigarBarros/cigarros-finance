import { useEffect, useState } from 'react'
import { semMovimento } from '../lib/tema'
import { Icone } from './Icone'
import { Paisagem, type Cena } from './Paisagem'
import { tx } from '../lib/textos'

const CENAS: Cena[] = ['montanhas', 'mar', 'cidade', 'floresta', 'dunas']

export interface Dica {
  id: string
  titulo: string
  botao: string
  icone: string
  acao: () => void
  /** Pede atenção (conta vencida): fica no tom de alerta. */
  alerta?: boolean
}

const INTERVALO = 7000

/**
 * Cartão do menu lateral, esticado de logo abaixo do menu até o pé: mostra uma dica útil por vez, com uma paisagem e um
 * botão de ação, e troca sozinho a cada poucos segundos (para quando o ponteiro está em cima). Os pontinhos escolhem a dica.
 */
export function CartaoDicas({ dicas }: { dicas: Dica[] }) {
  const [i, setI] = useState(0)
  const [parado, setParado] = useState(false)
  const n = dicas.length
  const atual = dicas[n ? i % n : 0]

  useEffect(() => {
    if (parado || n < 2 || semMovimento()) return
    const t = setTimeout(() => setI((x) => (x + 1) % n), INTERVALO)
    return () => clearTimeout(t)
  }, [i, parado, n])

  if (!atual) return null
  return (
    <section className={`lateral-promo dicas ${atual.alerta ? 'alerta-dica' : ''}`}
      onMouseEnter={() => setParado(true)} onMouseLeave={() => setParado(false)}
      onFocus={() => setParado(true)} onBlur={() => setParado(false)} aria-live="polite">
      {/* cada dica com a sua paisagem, preenchendo o alto do cartão */}
      <div className="dica-cena" key={`cena-${atual.id}`}><Paisagem cena={CENAS[(n ? i % n : 0) % CENAS.length]} /></div>
      <div className="dica-conteudo" key={atual.id}>
        <span className="dica-icone"><Icone nome={atual.icone} tamanho={18} /></span>
        <strong>{atual.titulo}</strong>
        <button className="btn" onClick={atual.acao}>{atual.botao} <Icone nome="seta" tamanho={16} /></button>
      </div>
      {n > 1 && (
        <div className="dica-pontos" role="tablist" aria-label={tx('Dicas')}>
          {dicas.map((d, k) => (
            <button key={d.id} role="tab" aria-selected={k === i % n} aria-label={d.titulo}
              className={k === i % n ? 'ativo' : ''} onClick={() => setI(k)}>
              {/* a barrinha do ponto ativo enche no tempo da troca */}
              {k === i % n && !parado && <i style={{ animationDuration: `${INTERVALO}ms` }} />}
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
