import { useEffect, useState } from 'react'
import { semMovimento } from '../lib/tema'
import { Icone } from './Icone'
import { Marca } from './Marca'
import { Paisagem, type Cena } from './Paisagem'

export interface Slide {
  id: string
  cena: Cena
  titulo: [string, string]
  texto: string
  botao: string
  acao: () => void
}

const INTERVALO = 8000

/**
 * Banner ilustrado da Início: cada mensagem tem a sua paisagem e troca sozinha a cada 8 s (para sob o ponteiro).
 * A paisagem acompanha o tema: noite no escuro, dia no claro. Os pontinhos escolhem a mensagem.
 */
export function BannerCarrossel({ slides }: { slides: Slide[] }) {
  const [i, setI] = useState(0)
  const [parado, setParado] = useState(false)
  const n = slides.length
  const atual = slides[n ? i % n : 0]
  useEffect(() => {
    if (parado || n < 2 || semMovimento()) return
    const t = setTimeout(() => setI((x) => (x + 1) % n), INTERVALO)
    return () => clearTimeout(t)
  }, [i, parado, n])
  if (!atual) return null
  return (
    <section className="banner" onMouseEnter={() => setParado(true)} onMouseLeave={() => setParado(false)} aria-roledescription="carrossel">
      <div className="banner-cena" key={atual.cena}><Paisagem cena={atual.cena} /></div>
      <div className="banner-topo">
        <Marca />
        {n > 1 && (
          <div className="banner-pontos" role="tablist" aria-label="Mensagens">
            {slides.map((s, k) => (
              <button key={s.id} role="tab" aria-selected={k === i % n} aria-label={s.titulo.join(' ')}
                className={k === i % n ? 'ativo' : ''} onClick={() => setI(k)}>
                {k === i % n && !parado && <i style={{ animationDuration: `${INTERVALO}ms` }} />}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="banner-texto" key={atual.id} aria-live="polite">
        <strong>{atual.titulo[0]}<br />{atual.titulo[1]}</strong>
        <p>{atual.texto}</p>
        <button className="btn" onClick={atual.acao}>{atual.botao} <Icone nome="seta" tamanho={16} /></button>
      </div>
    </section>
  )
}
