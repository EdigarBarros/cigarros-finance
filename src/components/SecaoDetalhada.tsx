import type { ReactNode } from 'react'
import { tx } from '../lib/textos'
export function SecaoDetalhada({ id, titulo, resumo, recolhida, alternar, children }: { id: string; titulo: string; resumo: string; recolhida: boolean; alternar: () => void; children: ReactNode }) {
  return <section id={id} className="cartao det-secao">
    <button className="det-secao-cab" onClick={alternar} aria-expanded={!recolhida} aria-controls={`${id}-conteudo`}><span><h2>{titulo}</h2><small>{resumo}</small></span><span>{recolhida ? '+' : '−'}<span className="sr-only">{recolhida ? tx('Expandir') : tx('Recolher')}</span></span></button>
    {!recolhida && <div id={`${id}-conteudo`} className="det-secao-corpo">{children}</div>}
  </section>
}
