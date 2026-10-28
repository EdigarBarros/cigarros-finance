import { useId } from 'react'
import { IconeCategoria } from './IconeCategoria'

/** Onda que se repete a cada 60 unidades: deslizando 60 para a esquerda, volta ao começo sem emenda. */
const ONDA = 'M0 6 Q15 0 30 6 T60 6 T90 6 T120 6 T150 6 T180 6 T210 6 T240 6 V160 H0Z'

/**
 * Pote de vidro que enche com a cor da meta até o progresso (0 a 1), com uma onda suave na superfície, os marcos de
 * 25/50/75% na lateral e o ícone da meta num rótulo. Ao aparecer, o líquido sobe do fundo até o nível.
 */
export function PoteMeta({ progresso, cor, icone, tamanho = 120 }: { progresso: number; cor: string; icone: string; tamanho?: number }) {
  const id = useId().replace(/:/g, '')
  const p = Math.min(1, Math.max(0, progresso))
  // corpo do pote: de y=34 a y=134 (100 de altura); o nível é medido a partir do fundo
  const nivel = 134 - 100 * p
  return (
    <svg className={`pote ${p >= 1 ? 'cheio' : ''}`} width={tamanho} height={tamanho * 1.15} viewBox="0 0 120 138" aria-hidden="true"
      style={{ '--c': cor } as React.CSSProperties}>
      <defs>
        <clipPath id={`${id}-corpo`}>
          <path d="M22 34h76a8 8 0 0 1 8 8v80a12 12 0 0 1-12 12H26a12 12 0 0 1-12-12V42a8 8 0 0 1 8-8z" />
        </clipPath>
        <linearGradient id={`${id}-liq`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={cor} stopOpacity=".95" />
          <stop offset="1" stopColor={cor} stopOpacity=".6" />
        </linearGradient>
        <linearGradient id={`${id}-vidro`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity=".16" />
          <stop offset=".35" stopColor="#fff" stopOpacity=".04" />
          <stop offset="1" stopColor="#fff" stopOpacity=".1" />
        </linearGradient>
      </defs>
      {/* tampa */}
      <rect className="pote-tampa" x="26" y="18" width="68" height="14" rx="5" />
      <rect x="30" y="21" width="60" height="3" rx="1.5" fill="#fff" opacity=".18" />
      {/* vidro */}
      <path className="pote-vidro" d="M22 34h76a8 8 0 0 1 8 8v80a12 12 0 0 1-12 12H26a12 12 0 0 1-12-12V42a8 8 0 0 1 8-8z" fill={`url(#${id}-vidro)`} />
      <g clipPath={`url(#${id}-corpo)`}>
        {p > 0 && <g className="pote-nivel" style={{ transform: `translateY(${nivel}px)` }}>
          {/* a animação usa transform; o deslocamento da onda de trás fica num grupo à parte */}
          <g transform="translate(0 -4)"><path className="pote-onda tras" d={ONDA} fill={cor} opacity=".45" /></g>
          <path className="pote-onda" d={ONDA} fill={`url(#${id}-liq)`} />
        </g>}
        {/* bolhas que sobem quando a meta está cheia */}
        {p >= 1 && [30, 58, 84].map((x, i) => <circle key={x} className="pote-bolha" cx={x} cy="128" r={2 + (i % 2)} style={{ animationDelay: `${i * 0.7}s` }} />)}
      </g>
      {/* marcos de 25, 50 e 75% */}
      {[0.25, 0.5, 0.75].map((m) => (
        <path key={m} className={`pote-marco ${p >= m ? 'passou' : ''}`} d={`M98 ${134 - 100 * m}h6`} />
      ))}
      <path d="M22 34h76a8 8 0 0 1 8 8v80a12 12 0 0 1-12 12H26a12 12 0 0 1-12-12V42a8 8 0 0 1 8-8z" fill="none" className="pote-contorno" />
      <path d="M24 46v58" stroke="#fff" strokeOpacity=".35" strokeWidth="3" strokeLinecap="round" />
      {/* rótulo com o ícone */}
      <circle className="pote-rotulo" cx="60" cy="74" r="17" />
      <foreignObject x="47" y="61" width="26" height="26">
        <span className="pote-icone"><IconeCategoria emoji={icone} tamanho={18} /></span>
      </foreignObject>
    </svg>
  )
}
