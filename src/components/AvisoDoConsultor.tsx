import type { FalaNaHora } from '../lib/naHora'
import { tx } from '../lib/textos'
import { Icone } from './Icone'

/** O consultor falando na hora da decisão (lib/naHora.ts): uma caixinha com a bússola, dentro do formulário. */
export function AvisoDoConsultor({ fala }: { fala: FalaNaHora | null }) {
  if (!fala) return null
  return (
    <p className={`aviso-consultor ${fala.tom}`} role="note">
      <span className="aviso-consultor-ic" aria-hidden="true"><Icone nome="bussola" tamanho={15} /></span>
      <span><strong>{tx('O consultor:')}</strong> {fala.texto}</span>
    </p>
  )
}
