import type { ReactNode } from 'react'

/**
 * Bandeiras das moedas, desenhadas em SVG (no Windows os emojis de bandeira viram só as letras do país).
 * Simplificadas para ficarem legíveis num círculo pequeno.
 */
const W = '#ffffff'
const estrela = (cx: number, cy: number, r: number, cor: string, giro = -90) => {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = ((giro + i * 36) * Math.PI) / 180
    const raio = i % 2 ? r * 0.42 : r
    return `${(cx + Math.cos(a) * raio).toFixed(2)},${(cy + Math.sin(a) * raio).toFixed(2)}`
  })
  return <polygon points={pts.join(' ')} fill={cor} />
}
const listras = (cores: string[], vertical = false) =>
  cores.map((c, i) => {
    const t = 24 / cores.length
    return vertical
      ? <rect key={i} x={i * t} y="0" width={t + 0.1} height="24" fill={c} />
      : <rect key={i} x="0" y={i * t} width="24" height={t + 0.1} fill={c} />
  })

const DESENHOS: Record<string, ReactNode> = {
  BRL: (
    <>
      <rect width="24" height="24" fill="#229e45" />
      <polygon points="12,3.5 22,12 12,20.5 2,12" fill="#f8d117" />
      <circle cx="12" cy="12" r="4.6" fill="#1c3f94" />
      <path d="M7.6 11.2c2.8-.8 6-.5 8.7.9" stroke={W} strokeWidth=".9" fill="none" />
    </>
  ),
  USD: (
    <>
      {listras(['#b22234', W, '#b22234', W, '#b22234', W, '#b22234'])}
      <rect width="12" height="13" fill="#3c3b6e" />
      {[[3, 3], [6, 3], [9, 3], [4.5, 5.6], [7.5, 5.6], [3, 8.2], [6, 8.2], [9, 8.2], [4.5, 10.8], [7.5, 10.8]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r=".75" fill={W} />
      ))}
    </>
  ),
  EUR: (
    <>
      <rect width="24" height="24" fill="#003399" />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i * 30 * Math.PI) / 180
        return <g key={i}>{estrela(12 + Math.cos(a) * 6.2, 12 + Math.sin(a) * 6.2, 1.25, '#ffcc00')}</g>
      })}
    </>
  ),
  GBP: (
    <>
      <rect width="24" height="24" fill="#012169" />
      <path d="M0 0 24 24M24 0 0 24" stroke={W} strokeWidth="4.5" />
      <path d="M0 0 24 24M24 0 0 24" stroke="#c8102e" strokeWidth="1.6" />
      <path d="M12 0v24M0 12h24" stroke={W} strokeWidth="7" />
      <path d="M12 0v24M0 12h24" stroke="#c8102e" strokeWidth="4" />
    </>
  ),
  ARS: (
    <>
      {listras(['#74acdf', W, '#74acdf'])}
      <circle cx="12" cy="12" r="2.4" fill="#f6b40e" stroke="#85340a" strokeWidth=".4" />
    </>
  ),
  CLP: (
    <>
      <rect width="24" height="12" fill={W} />
      <rect y="12" width="24" height="12" fill="#d52b1e" />
      <rect width="10" height="12" fill="#0039a6" />
      {estrela(5, 6, 2.6, W)}
    </>
  ),
  UYU: (
    <>
      {listras([W, '#0038a8', W, '#0038a8', W, '#0038a8', W, '#0038a8', W])}
      <rect width="10.5" height="10.6" fill={W} />
      <circle cx="5.2" cy="5.3" r="2.6" fill="#fcd116" stroke="#7b3f00" strokeWidth=".35" />
    </>
  ),
  PYG: (
    <>
      {listras(['#d52b1e', W, '#0038a8'])}
      <circle cx="12" cy="12" r="2.2" fill="none" stroke="#0038a8" strokeWidth=".7" />
      {estrela(12, 12, 1, '#fcd116')}
    </>
  ),
  COP: (
    <>
      <rect width="24" height="12" fill="#fcd116" />
      <rect y="12" width="24" height="6" fill="#003893" />
      <rect y="18" width="24" height="6" fill="#ce1126" />
    </>
  ),
  PEN: <>{listras(['#d91023', W, '#d91023'], true)}</>,
  MXN: (
    <>
      {listras(['#006847', W, '#ce1126'], true)}
      <circle cx="12" cy="12" r="2.1" fill="#8c5a2b" />
      <path d="M10.3 13.6c1.1.8 2.3.8 3.4 0" stroke="#006847" strokeWidth=".7" fill="none" />
    </>
  ),
  CAD: (
    <>
      <rect width="24" height="24" fill={W} />
      <rect width="6" height="24" fill="#d52b1e" />
      <rect x="18" width="6" height="24" fill="#d52b1e" />
      <path fill="#d52b1e" d="M12 6.2l1 2 1.4-.7-.4 3 1.7-1.7.4 1.1 1.8-.3-.7 1.7.8.4-2.8 2.1.3 1-2.7-.4V17h-.6v-2.6l-2.7.4.3-1-2.8-2.1.8-.4-.7-1.7 1.8.3.4-1.1 1.7 1.7-.4-3 1.4.7z" />
    </>
  ),
  AUD: (
    <>
      <rect width="24" height="24" fill="#012169" />
      <g transform="scale(.5)">
        <path d="M0 0 24 24M24 0 0 24" stroke={W} strokeWidth="4.5" />
        <path d="M0 0 24 24M24 0 0 24" stroke="#e4002b" strokeWidth="1.6" />
        <path d="M12 0v24M0 12h24" stroke={W} strokeWidth="7" />
        <path d="M12 0v24M0 12h24" stroke="#e4002b" strokeWidth="4" />
      </g>
      {estrela(6, 18, 2.2, W)}
      {estrela(18, 6, 1.2, W)}
      {estrela(20.5, 11, 1.2, W)}
      {estrela(15.5, 13, 1.2, W)}
      {estrela(18, 19, 1.3, W)}
    </>
  ),
  CHF: (
    <>
      <rect width="24" height="24" fill="#da291c" />
      <path d="M10.2 5.5h3.6v4.7h4.7v3.6h-4.7v4.7h-3.6v-4.7H5.5v-3.6h4.7z" fill={W} />
    </>
  ),
  JPY: (
    <>
      <rect width="24" height="24" fill={W} />
      <circle cx="12" cy="12" r="5.2" fill="#bc002d" />
    </>
  ),
  CNY: (
    <>
      <rect width="24" height="24" fill="#de2910" />
      {estrela(7, 8, 3.4, '#ffde00')}
      {estrela(12.6, 4.2, 1.1, '#ffde00', -60)}
      {estrela(14.8, 6.8, 1.1, '#ffde00', -80)}
      {estrela(14.8, 10, 1.1, '#ffde00', -100)}
      {estrela(12.6, 12.4, 1.1, '#ffde00', -120)}
    </>
  ),
  AOA: (
    <>
      <rect width="24" height="12" fill="#cc092f" />
      <rect y="12" width="24" height="12" fill="#000" />
      <path d="M9 15.5a4.5 4.5 0 1 0 1.5-7.5" stroke="#ffcb00" strokeWidth="1.3" fill="none" />
      <path d="M9.5 9.8l5 5.4" stroke="#ffcb00" strokeWidth="1.2" />
      {estrela(11.2, 11.6, 1.5, '#ffcb00')}
    </>
  ),
  MZN: (
    <>
      <rect width="24" height="7.6" fill="#009a44" />
      <rect y="7.6" width="24" height="8.8" fill={W} />
      <rect y="8.6" width="24" height="6.8" fill="#000" />
      <rect y="16.4" width="24" height="7.6" fill="#fce100" />
      <polygon points="0,0 11,12 0,24" fill="#d21034" />
      {estrela(4.2, 12, 2.4, '#fce100')}
    </>
  ),
}

/** Bandeira redonda da moeda (código ISO). Sem desenho, mostra o código num círculo. */
export function Bandeira({ moeda, tamanho = 28 }: { moeda: string; tamanho?: number }) {
  const desenho = DESENHOS[moeda]
  const id = `bandeira-${moeda}`
  return (
    <svg className="bandeira" width={tamanho} height={tamanho} viewBox="0 0 24 24" aria-hidden="true">
      <defs><clipPath id={id}><circle cx="12" cy="12" r="12" /></clipPath></defs>
      {desenho
        ? <g clipPath={`url(#${id})`}>{desenho}</g>
        : <><circle cx="12" cy="12" r="12" fill="currentColor" opacity=".15" /><text x="12" y="15" textAnchor="middle" fontSize="7" fontWeight="700" fill="currentColor">{moeda}</text></>}
      <circle cx="12" cy="12" r="11.6" fill="none" stroke="rgba(0,0,0,.18)" strokeWidth=".8" />
    </svg>
  )
}
