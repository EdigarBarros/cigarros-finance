import { useTema } from '../lib/tema'

export type Cena = 'montanhas' | 'mar' | 'cidade' | 'floresta' | 'dunas'

/** Cores de cada cena: à noite no tema escuro, de dia no tema claro. */
const PALETAS = {
  escuro: {
    ceu: ['#0a1330', '#1c2c55', '#3a3f6b'], astro: '#ffd9a0', brilho: 'rgba(255, 170, 90, .55)',
    longe: '#26365f', meio: '#172446', perto: '#0b1326', agua: '#13244a', reflexo: 'rgba(255, 200, 140, .35)',
    janela: '#ffd27a', predio: ['#1b2a4d', '#14203d', '#0e182f'], arvore: ['#14304a', '#0d2236', '#081624'],
    duna: ['#4a3a5e', '#33294a', '#1f1a33'], estrela: 'rgba(255, 255, 255, .7)',
  },
  claro: {
    ceu: ['#7fc2ff', '#bfe3ff', '#eaf6ff'], astro: '#ffe27a', brilho: 'rgba(255, 220, 120, .6)',
    longe: '#9cc7e6', meio: '#6aa6cf', perto: '#3f7fae', agua: '#5fb2e0', reflexo: 'rgba(255, 255, 255, .55)',
    janela: '#e8f4ff', predio: ['#a8c3df', '#86a9cc', '#6489b3'], arvore: ['#6fbf8e', '#3f9d6a', '#257a4f'],
    duna: ['#f5d39a', '#eab872', '#d99a4e'], estrela: 'rgba(255, 255, 255, 0)',
  },
}

/**
 * Paisagem desenhada em SVG para fundos ilustrados (banner da Início, cartão de dicas). Preenche a caixa toda
 * (corta as sobras, mantendo o chão embaixo) e acompanha o tema.
 */
export function Paisagem({ cena, className = '' }: { cena: Cena; className?: string }) {
  const { tema } = useTema()
  const c = PALETAS[tema]
  const id = `ceu-${cena}-${tema}`
  const estrelas = tema === 'escuro' && (
    <g fill={c.estrela}>
      {[[30, 30], [80, 18], [140, 40], [210, 22], [260, 50], [320, 28], [370, 44], [110, 70], [300, 76], [50, 88]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i % 3 ? 0.9 : 1.4} />
      ))}
    </g>
  )
  const ceu = (
    <>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c.ceu[0]} />
          <stop offset=".6" stopColor={c.ceu[1]} />
          <stop offset="1" stopColor={c.ceu[2]} />
        </linearGradient>
        <radialGradient id={`${id}-b`}>
          <stop offset="0" stopColor={c.brilho} />
          <stop offset="1" stopColor={c.brilho.replace(/[\d.]+\)$/, '0)')} />
        </radialGradient>
      </defs>
      <rect width="400" height="260" fill={`url(#${id})`} />
      {estrelas}
    </>
  )
  const sol = (x: number, y: number, r = 16) => (
    <>
      <circle cx={x} cy={y} r={r * 4} fill={`url(#${id}-b)`} />
      <circle cx={x} cy={y} r={r} fill={c.astro} />
    </>
  )

  return (
    <svg className={`paisagem ${className}`} viewBox="0 0 400 260" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      {ceu}
      {cena === 'montanhas' && (
        <>
          {sol(300, 112)}
          <path d="M0 180 L60 135 L105 160 L170 102 L235 150 L290 122 L350 160 L400 138 L400 260 L0 260Z" fill={c.longe} />
          <path d="M170 102 L184 118 L176 116 L163 113Z" fill="rgba(255,255,255,.55)" />
          <path d="M0 205 L80 150 L140 185 L215 135 L300 190 L355 160 L400 185 L400 260 L0 260Z" fill={c.meio} />
          <path d="M0 230 L70 205 L150 225 L240 195 L330 225 L400 210 L400 260 L0 260Z" fill={c.perto} />
        </>
      )}
      {cena === 'mar' && (
        <>
          {sol(200, 150, 22)}
          <rect y="150" width="400" height="110" fill={c.agua} />
          <g stroke={c.reflexo} strokeWidth="2.5" strokeLinecap="round">
            <path d="M175 162h50M182 172h36M188 182h24M192 192h16" />
            <path d="M40 175h40M300 185h50M70 205h30M260 215h40" opacity=".6" />
          </g>
          <path d="M0 150 Q60 140 120 150 L0 150Z" fill={c.longe} />
          <path d="M290 150 Q330 128 400 140 L400 150Z" fill={c.longe} />
          <path d="M300 200 L330 200 L326 207 L304 207Z M314 200 L314 176 L327 198Z" fill={c.perto} />
          <path d="M0 235 Q100 222 200 238 T400 232 L400 260 L0 260Z" fill={c.perto} opacity=".85" />
        </>
      )}
      {cena === 'cidade' && (
        <>
          {tema === 'escuro' ? <circle cx="330" cy="104" r="13" fill={c.astro} /> : sol(330, 104, 13)}
          {[[0, 150, 40, c.predio[0]], [35, 120, 34, c.predio[0]], [72, 140, 30, c.predio[0]], [300, 130, 36, c.predio[0]], [340, 110, 40, c.predio[0]], [375, 150, 30, c.predio[0]],
            [20, 170, 46, c.predio[1]], [70, 108, 38, c.predio[1]], [112, 160, 40, c.predio[1]], [160, 98, 42, c.predio[1]], [206, 130, 36, c.predio[1]], [246, 104, 44, c.predio[1]], [292, 165, 40, c.predio[1]], [336, 140, 36, c.predio[1]]]
            .map(([x, y, w, cor], i) => <rect key={i} x={x as number} y={y as number} width={w as number} height={260 - (y as number)} fill={cor as string} />)}
          <g fill={c.janela} opacity={tema === 'escuro' ? 0.9 : 0.75}>
            {Array.from({ length: 34 }, (_, i) => {
              const col = [76, 86, 96, 166, 176, 186, 196, 252, 262, 272, 282, 212, 222][i % 13]
              const lin = 110 + Math.floor(i / 3) * 14 + (i % 2) * 7
              return (i * 7) % 5 === 0 ? null : <rect key={i} x={col} y={lin} width="5" height="6" rx="1" />
            })}
          </g>
          <rect y="232" width="400" height="28" fill={c.predio[2]} />
        </>
      )}
      {cena === 'floresta' && (
        <>
          {sol(90, 112, 14)}
          <path d="M0 170 Q100 130 200 160 T400 150 L400 260 L0 260Z" fill={c.longe} />
          {[[30, 170, 0], [70, 160, 0], [120, 168, 0], [250, 160, 0], [300, 168, 0], [350, 158, 0],
            [10, 200, 1], [55, 190, 1], [100, 198, 1], [150, 188, 1], [210, 196, 1], [265, 186, 1], [320, 194, 1], [380, 188, 1],
            [35, 225, 2], [90, 218, 2], [175, 226, 2], [240, 216, 2], [300, 224, 2], [365, 218, 2]].map(([x, y, n], i) => {
            const h = 34 + n * 10
            return <path key={i} d={`M${x} ${y - h} L${x + 14 + n * 3} ${y} L${x - 14 - n * 3} ${y}Z`} fill={c.arvore[n]} />
          })}
          <rect y="226" width="400" height="34" fill={c.arvore[2]} />
        </>
      )}
      {cena === 'dunas' && (
        <>
          {sol(110, 118, 18)}
          <path d="M0 180 Q120 140 230 175 T400 165 L400 260 L0 260Z" fill={c.duna[0]} />
          <path d="M0 210 Q90 175 200 205 T400 195 L400 260 L0 260Z" fill={c.duna[1]} />
          <path d="M290 205 v-30 a6 6 0 0 1 12 0 v30 M284 192 v-10 a4 4 0 0 1 8 0 M302 186 h6 a4 4 0 0 0 4-4 v-6" stroke={c.arvore[1]} strokeWidth="6" strokeLinecap="round" fill="none" />
          <path d="M0 240 Q150 215 280 238 T400 232 L400 260 L0 260Z" fill={c.duna[2]} />
        </>
      )}
    </svg>
  )
}
