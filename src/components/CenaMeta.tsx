import { useRef } from 'react'
import { semMovimento } from '../lib/tema'

/*
 * Cenas em 3D isométrico dos modelos de meta (boia, avião de papel, carro, casa, capelo, ilha e alvo). Todas usam a
 * cor da meta (--c) em três tons, como os potes, e ficam num viewBox de 140×120. Cada cena tem duas camadas: a de fora
 * (.cn-obj) flutua sempre; a de dentro anima quando o cartão ganha o mouse (no celular, sozinha, de tempos em tempos).
 */

/** Cópias do contorno empurradas para trás: dão espessura de objeto sólido. */
function Espessura({ d, dx, dy, passos = 5 }: { d: string; dx: number; dy: number; passos?: number }) {
  return (
    <g className="cn-lado">
      {Array.from({ length: passos }, (_, i) => passos - i).map((k) => (
        <path key={k} d={d} transform={`translate(${(dx * k) / passos} ${(dy * k) / passos})`} />
      ))}
    </g>
  )
}

const sombra = (cx: number, cy: number, rx: number) => <ellipse className="cn-sombra" cx={cx} cy={cy} rx={rx} ry={rx * 0.17} />

function Boia() {
  return (
    <>
      <ellipse className="cn-agua" cx="70" cy="86" rx="60" ry="17" />
      <ellipse className="cn-onda" cx="70" cy="84" rx="44" ry="12" />
      <ellipse className="cn-onda dois" cx="70" cy="84" rx="44" ry="12" />
      <g className="cn-obj">
        <g className="cn-acao cn-boia">
          {[7, 6, 5, 4, 3, 2, 1].map((k) => <ellipse key={k} className="cn-boia-lado" cx="70" cy={62 + k} rx="36" ry="19" />)}
          <ellipse className="cn-boia-anel" cx="70" cy="62" rx="36" ry="19" />
          <ellipse className="cn-boia-faixas" cx="70" cy="62" rx="36" ry="19" />
          <path className="cn-brilho-linha" d="M42 52 Q56 44 74 44" />
        </g>
      </g>
    </>
  )
}

function Aviao() {
  return (
    <>
      <path className="cn-rastro" d="M6 104 C28 108 30 84 50 78" />
      <g className="cn-nuvens">
        <path className="cn-nuvem" d="M14 74a7 7 0 0 1 12-5a9 9 0 0 1 17 3a6 6 0 0 1 0 12H16a5 5 0 0 1-2-10z" />
        <path className="cn-nuvem longe" d="M96 92a5 5 0 0 1 9-4a7 7 0 0 1 13 2a5 5 0 0 1 0 9h-21a4 4 0 0 1-1-7z" />
      </g>
      {sombra(76, 108, 30)}
      <g className="cn-obj">
        <g className="cn-acao cn-aviao">
          <polygon className="cn-escuro" points="120,30 74,70 92,82" />
          <polygon className="cn-lado-cheio" points="120,30 60,66 68,88" />
          <polygon className="cn-claro" points="120,30 22,56 60,66" />
          <polygon className="cn-base" points="120,30 60,66 66,72" />
          <path className="cn-brilho-linha" d="M112 34 L34 55" />
        </g>
      </g>
    </>
  )
}

const CARRO = 'M28 84Q28 72 38 70L54 68L65 55Q68 51 74 51L93 51Q98 51 101 55L110 67Q118 68 118 76L118 84Q118 89 113 89L33 89Q28 89 28 84Z'

function Roda({ x, y }: { x: number; y: number }) {
  return (
    <g className="cn-roda" style={{ transformOrigin: `${x}px ${y}px` }}>
      <circle className="cn-pneu" cx={x} cy={y} r="10" />
      <circle className="cn-aro" cx={x} cy={y} r="5.5" />
      <path className="cn-raio" d={`M${x - 5} ${y}h10M${x} ${y - 5}v10`} />
    </g>
  )
}

function Carro() {
  return (
    <>
      <g className="cn-vento">
        <path d="M4 66h18M10 76h16M2 86h14" />
      </g>
      {sombra(72, 100, 48)}
      <g className="cn-obj">
        <g className="cn-acao cn-carro">
          <polygon className="cn-feixe" points="118,71 140,62 140,88 118,78" />
          <circle className="cn-pneu" cx="40" cy="81" r="9" />
          <circle className="cn-pneu" cx="90" cy="81" r="9" />
          <Espessura d={CARRO} dx={-10} dy={-8} />
          <g className="cn-carroceria">
            <path className="cn-base" d={CARRO} />
            <path className="cn-vidro" d="M59 67L67 57Q69 55 72 55L81 55L81 67Z" />
            <path className="cn-vidro" d="M85 55L94 55Q97 55 99 58L106 67L85 67Z" />
            <path className="cn-brilho-linha" d="M67 54Q69 52 74 52L93 52Q97 52 100 55" />
            <path className="cn-vinco" d="M83 70V86M38 74H116" />
            <rect className="cn-farol" x="112" y="72" width="6" height="5" rx="2" />
            <rect className="cn-lanterna" x="28" y="72" width="4" height="5" rx="1.5" />
          </g>
          <Roda x={48} y={89} />
          <Roda x={99} y={89} />
        </g>
      </g>
    </>
  )
}

function Casa() {
  return (
    <>
      {/* terreno com espessura */}
      <polygon className="cn-chao-lado" points="23,77 79,109 79,114 23,82" />
      <polygon className="cn-chao-lado escuro" points="79,109 124,83 124,88 79,114" />
      <polygon className="cn-chao" points="68,51 124,83 79,109 23,77" />
      <g className="cn-obj">
        <g className="cn-acao cn-casa">
          <g className="cn-fumaca">
            <circle cx="61" cy="20" r="3.5" /><circle cx="64" cy="13" r="4.5" /><circle cx="60" cy="5" r="5.5" />
          </g>
          <polygon className="cn-parede" points="44,77 79,97 79,69 44,49" />
          <polygon className="cn-parede-sombra" points="105,82 79,97 79,69 92,44 105,54" />
          <polygon className="cn-base" points="44,49 79,69 92,44 57,24" />
          <path className="cn-brilho-linha" d="M58 26L90 44" />
          <polygon className="cn-escuro" points="56,30 61,33 61,46 56,43" />
          <polygon className="cn-lado-cheio" points="61,33 67,30 67,36 61,46" />
          <polygon className="cn-claro" points="61,27 67,30 61,33 56,30" />
          <polygon className="cn-porta" points="65,73 72,77 72,93 65,89" />
          <polygon className="cn-janela" points="49,58 58,63 58,73 49,68" />
          <polygon className="cn-janela" points="98,66 87,72 87,82 98,76" />
          {/* arvorezinha no canto do terreno */}
          <path className="cn-tronco-fino" d="M108 88v-8" />
          <circle className="cn-base" cx="108" cy="76" r="7" />
          <circle className="cn-claro" cx="106" cy="74" r="3" />
        </g>
      </g>
    </>
  )
}

function Capelo() {
  return (
    <>
      {/* livro */}
      <polygon className="cn-base" points="30,88 70,100 70,108 30,96" />
      <polygon className="cn-escuro" points="70,100 110,88 110,96 70,108" />
      <polygon className="cn-pagina" points="30,88 70,76 110,88 70,100" />
      <path className="cn-folhas-livro" d="M73 103L107 93" />
      <g className="cn-estrelas">
        <path d="M24 30l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" /><path d="M116 60l1.5 3.5 3.5 1.5-3.5 1.5-1.5 3.5-1.5-3.5-3.5-1.5 3.5-1.5z" />
      </g>
      <g className="cn-obj">
        <g className="cn-acao cn-capelo">
          <path className="cn-lado-cheio" d="M44 40V60Q70 74 96 60V40Q70 50 44 40Z" />
          <polygon className="cn-escuro" points="28,32 70,50 112,32 112,36 70,54 28,36" />
          <polygon className="cn-base" points="70,14 112,32 70,50 28,32" />
          <path className="cn-brilho-linha" d="M36 31L70 17" />
          <g className="cn-borla">
            <path d="M70 32L104 37V58" />
            <path className="cn-borla-ponta" d="M101 56h6l1.5 10h-9z" />
          </g>
          <circle className="cn-claro" cx="70" cy="32" r="3.5" />
        </g>
      </g>
    </>
  )
}

const FOLHAS = [
  'M0 0Q-18-14-36-2Q-18-6 0 0Z', 'M0 0Q-10-22-30-24Q-12-14 0 0Z', 'M0 0Q12-22 32-18Q12-12 0 0Z',
  'M0 0Q20-8 36 6Q18-2 0 0Z', 'M0 0Q-16 4-26 20Q-12 6 0 0Z', 'M0 0Q14 6 22 22Q10 8 0 0Z',
]

function Ilha() {
  return (
    <>
      <g className="cn-sol-g"><circle className="cn-sol-luz" cx="34" cy="42" r="20" /><circle className="cn-sol" cx="34" cy="42" r="12" /></g>
      <ellipse className="cn-agua" cx="70" cy="96" rx="62" ry="15" />
      <ellipse className="cn-onda" cx="70" cy="93" rx="40" ry="10" />
      <ellipse className="cn-areia-lado" cx="70" cy="94" rx="34" ry="9" />
      <ellipse className="cn-areia" cx="70" cy="90" rx="34" ry="9" />
      <g className="cn-obj">
        <g className="cn-acao">
          <path className="cn-tronco" d="M72 90Q66 66 82 38" />
          <path className="cn-tronco-marcas" d="M72 90Q66 66 82 38" />
          <g transform="translate(82 38)">
            <g className="cn-folhas">
              {FOLHAS.map((d, i) => <path key={d} className={i % 2 ? 'cn-escuro' : 'cn-base'} d={d} />)}
              <circle className="cn-lado-cheio" cx="-3" cy="4" r="3.5" /><circle className="cn-lado-cheio" cx="4" cy="5" r="3.5" />
            </g>
          </g>
        </g>
      </g>
    </>
  )
}

function Alvo() {
  return (
    <>
      {sombra(66, 106, 36)}
      <path className="cn-pe" d="M52 84L44 104M74 84L84 104M64 88L68 100" />
      <g className="cn-obj">
        <g className="cn-acao">
          {[6, 5, 4, 3, 2, 1].map((k) => <ellipse key={k} className="cn-lado-cheio" cx={62 + k} cy="56" rx="28" ry="32" />)}
          <ellipse className="cn-base" cx="62" cy="56" rx="28" ry="32" />
          <ellipse className="cn-branco" cx="62" cy="56" rx="21" ry="24" />
          <ellipse className="cn-base" cx="62" cy="56" rx="14" ry="16" />
          <ellipse className="cn-branco" cx="62" cy="56" rx="7" ry="8" />
          <ellipse className="cn-escuro" cx="62" cy="56" rx="3" ry="3.4" />
          <g className="cn-flecha">
            <path className="cn-haste" d="M62 56L106 24" />
            <polygon className="cn-claro" points="106,24 116,22 112,30 104,28" />
            <polygon className="cn-base" points="102,27 110,18 114,20 106,24" />
          </g>
        </g>
      </g>
    </>
  )
}

const CENAS: Record<string, () => React.JSX.Element> = { '🛟': Boia, '✈️': Aviao, '🚗': Carro, '🏠': Casa, '🎓': Capelo, '🌴': Ilha }

/** A cena do modelo, escolhida pelo ícone da meta; qualquer outro ícone vira o alvo. */
export function CenaMeta({ icone }: { icone: string }) {
  const Cena = CENAS[icone] ?? Alvo
  return (
    <svg className="cn" viewBox="0 0 140 120" aria-hidden="true">
      <Cena />
    </svg>
  )
}

/** Cartão de um modelo de meta: a cena grande num palco que inclina em 3D seguindo o mouse, e o nome embaixo. */
export function CartaoModelo({ cor, icone, nome, dica, selo, indice, largo, aoEscolher }: {
  cor: string; icone: string; nome: string; dica: string; selo?: string; indice: number; largo?: boolean; aoEscolher: () => void
}) {
  const ref = useRef<HTMLButtonElement>(null)
  const mover = (e: React.PointerEvent) => {
    const el = ref.current
    if (!el || e.pointerType === 'touch' || semMovimento()) return
    const r = el.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width
    const y = (e.clientY - r.top) / r.height
    el.style.setProperty('--ry', `${(x - 0.5) * 22}deg`)
    el.style.setProperty('--rx', `${(0.5 - y) * 16}deg`)
    el.style.setProperty('--mx', `${x * 100}%`)
    el.style.setProperty('--my', `${y * 100}%`)
  }
  const soltar = () => {
    for (const p of ['--rx', '--ry', '--mx', '--my']) ref.current?.style.removeProperty(p)
  }
  return (
    <button ref={ref} type="button" className={`mt-modelo ${largo ? 'largo' : ''}`} title={dica} aria-label={`${nome}: ${dica}`}
      style={{ '--c': cor, '--i': indice, animationDelay: `${indice * 60}ms` } as React.CSSProperties}
      onPointerMove={mover} onPointerLeave={soltar} onClick={aoEscolher}>
      <span className="mt-modelo-palco">
        <span className="mt-modelo-luz" aria-hidden="true" />
        <CenaMeta icone={icone} />
      </span>
      <span className="mt-modelo-texto">
        <strong>{nome}</strong>
        {selo && <span className="mt-modelo-selo">{selo}</span>}
      </span>
      <span className="mt-modelo-reflexo" aria-hidden="true" />
    </button>
  )
}
