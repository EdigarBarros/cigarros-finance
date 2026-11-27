import { humorDoTom } from '../lib/kairo'
import type { FalaNaHora } from '../lib/naHora'
import { tx } from '../lib/textos'
import { Kairo } from './Kairo'

/** O Kairo falando na hora da decisão (lib/naHora.ts): uma caixinha com ele, dentro do formulário. */
export function AvisoDoConsultor({ fala }: { fala: FalaNaHora | null }) {
  if (!fala) return null
  return (
    <p className={`aviso-consultor ${fala.tom}`} role="note" aria-live="polite">
      <span className="aviso-consultor-ic" aria-hidden="true"><Kairo humor={humorDoTom(fala.tom)} tamanho={26} vivo /></span>
      <span><strong>{tx('Kairo:')}</strong> {fala.texto}</span>
    </p>
  )
}
