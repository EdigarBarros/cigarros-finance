import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useMovimento } from '../lib/tema'
import { tx } from '../lib/textos'
import { Kairo, type Careta } from './Kairo'
import './kairo-apresentacao.css'

/*
 * A apresentação do Kairo para quem ainda não lançou nada (o Consultor de conta nova, computador e celular).
 * Um palco em 3D: cinco cartões de dados flutuando em profundidade (lançamentos, comparação com o mês anterior, tendência,
 * categorias e a nota), o mundo balançando devagar, e o Kairo voando de um cartão para o outro. Em cada parada ele olha
 * para o cartão, faz uma careta e o cartão "acorda": acende a borda, uma luz passa por ele e o gráfico se refaz. Embaixo,
 * uma legenda conta o que ele está fazendo. No fim da volta ele vem para a frente comemorando e tudo recomeça.
 * Os números são ilustração (não são da pessoa). Com "Animações reduzidas", fica parado na última cena (ele feliz, na frente).
 */

interface Parada {
  /** O cartão que ele lê (null: a frente do palco). */
  cartao: Cartao | null
  /** Onde ele fica no mundo (px, a partir do meio) e a profundidade. */
  x: number; y: number; z: number
  careta: Careta
  /** Para onde os olhos apontam enquanto ele lê. */
  olhar: [number, number]
  legenda: () => string
}
type Cartao = 'lanc' | 'comp' | 'tend' | 'cat' | 'nota'

const PARADAS: Parada[] = [
  { cartao: 'lanc', x: -112, y: -58, z: 120, careta: 'pensando', olhar: [-9, 0], legenda: () => tx('Lendo o que entra e o que sai…') },
  { cartao: 'comp', x: 118, y: -72, z: 110, careta: 'surpreso', olhar: [8, -2], legenda: () => tx('Comparando com o mês passado…') },
  { cartao: 'tend', x: -96, y: 76, z: 130, careta: 'calmo', olhar: [-8, 3], legenda: () => tx('Vendo para onde os gastos vão…') },
  { cartao: 'cat', x: 6, y: -112, z: 40, careta: 'piscadela', olhar: [0, -5], legenda: () => tx('Separando por categoria…') },
  { cartao: 'nota', x: 122, y: 70, z: 120, careta: 'pensando', olhar: [9, 3], legenda: () => tx('Calculando a sua nota…') },
  { cartao: null, x: 0, y: 4, z: 190, careta: 'comemorando', olhar: [0, 0], legenda: () => tx('Pronto: a sua análise sai daqui.') },
]
const TEMPO = 3000

export function KairoApresentacao() {
  const movimento = useMovimento()
  const parado = movimento === 'reduzido'
  const [i, setI] = useState(PARADAS.length - 1)
  const [voando, setVoando] = useState(false)
  const palco = useRef<HTMLDivElement>(null)
  const [escala, setEscala] = useState(1)

  // a volta: muda de parada a cada TEMPO; o primeiro pedaço de cada parada é o voo
  useEffect(() => {
    if (parado) return
    let vivo = true
    const timers: number[] = []
    const ir = (n: number) => {
      if (!vivo) return
      setI(n); setVoando(true)
      timers.push(window.setTimeout(() => vivo && setVoando(false), 950))
      timers.push(window.setTimeout(() => ir((n + 1) % PARADAS.length), n === PARADAS.length - 1 ? TEMPO + 900 : TEMPO))
    }
    timers.push(window.setTimeout(() => ir(0), 900))
    return () => { vivo = false; timers.forEach((t) => window.clearTimeout(t)) }
  }, [parado])

  // o mundo tem 640 px de largura: em tela menor, encolhe inteiro
  useEffect(() => {
    const el = palco.current
    if (!el) return
    const medir = () => setEscala(Math.min(1, el.clientWidth / 660))
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const p = PARADAS[parado ? PARADAS.length - 1 : i]
  const ativo = !voando ? p.cartao : null
  const careta: Careta = voando ? 'surpreso' : p.careta
  return (
    <div className={`ka ${parado ? 'parado' : ''}`}>
      <div className="ka-palco" ref={palco} aria-hidden="true">
        <div className="ka-mundo" style={{ '--esc': escala } as CSSProperties}>
          <span className="ka-chao" />
          <Pecas />
          <CartaoDado id="lanc" ativo={ativo} pos={[-210, -52, -30, 20]} titulo={tx('Lançamentos')}>
            <ul className="ka-lancs">
              {[['+', 62], ['−', 44], ['−', 30], ['+', 52]].map(([s, w], k) => (
                <li key={k} className={s === '+' ? 'entra' : 'sai'} style={{ '--k': k } as CSSProperties}>
                  <i /><b style={{ width: `${w}%` }} /><em>{s}</em>
                </li>
              ))}
            </ul>
          </CartaoDado>
          <CartaoDado id="comp" ativo={ativo} pos={[214, -70, -70, -18]} titulo={tx('Comparação')}>
            <div className="ka-comp">
              {[[70, 48], [44, 58], [82, 64], [36, 30]].map(([a, b], k) => (
                <span key={k} style={{ '--k': k } as CSSProperties}><i style={{ height: `${a}%` }} /><b style={{ height: `${b}%` }} /></span>
              ))}
            </div>
          </CartaoDado>
          <CartaoDado id="tend" ativo={ativo} pos={[-196, 92, 20, 14]} titulo={tx('Tendência')}>
            <svg className="ka-tend" viewBox="0 0 140 54" preserveAspectRatio="none">
              <path className="ka-tend-area" d="M0 44 L20 38 L40 41 L60 28 L80 31 L100 18 L120 22 L140 10 L140 54 L0 54Z" />
              <path className="ka-tend-linha" pathLength={1} d="M0 44 L20 38 L40 41 L60 28 L80 31 L100 18 L120 22 L140 10" />
            </svg>
          </CartaoDado>
          <CartaoDado id="cat" ativo={ativo} pos={[8, -124, -170, 0]} titulo={tx('Para onde vai')}>
            <div className="ka-cat">
              <svg viewBox="0 0 42 42">
                {[[0.4, 0, 'var(--ka-c1)'], [0.25, 0.4, 'var(--ka-c2)'], [0.2, 0.65, 'var(--ka-c3)'], [0.15, 0.85, 'var(--ka-c4)']].map(([f, ini, cor], k) => (
                  <circle key={k} cx="21" cy="21" r="15.9" pathLength={1} style={{ stroke: cor as string, strokeDasharray: `${f} 1`, strokeDashoffset: -(ini as number), '--k': k } as CSSProperties} />
                ))}
              </svg>
              <span>{[44, 30, 20].map((w, k) => <i key={k} style={{ width: `${w}px`, '--k': k } as CSSProperties} />)}</span>
            </div>
          </CartaoDado>
          <CartaoDado id="nota" ativo={ativo} pos={[220, 96, 10, -16]} titulo={tx('Sua nota')}>
            <div className="ka-nota">
              <svg viewBox="0 0 60 34"><path className="ka-nota-fundo" d="M6 30 A24 24 0 0 1 54 30" /><path className="ka-nota-arco" pathLength={1} d="M6 30 A24 24 0 0 1 54 30" /></svg>
              <b>72</b>
            </div>
          </CartaoDado>

          {/* o Kairo, no mesmo espaço 3D dos cartões */}
          <div className={`ka-kairo ${voando ? 'voando' : 'pousado'}`} style={{ '--x': `${p.x}px`, '--y': `${p.y}px`, '--z': `${p.z}px` } as CSSProperties}>
            <span className="ka-kairo-estica">
              <Kairo humor="feliz" careta={careta} olhar={voando ? null : p.olhar} tamanho={p.cartao ? 74 : 96} vivo={!parado} sombra />
            </span>
            {!voando && p.cartao && <span className="ka-onda" key={i} />}
          </div>
        </div>
      </div>
      <p className="ka-legenda" aria-live="off" key={parado ? 'fim' : i}>
        <span className="ka-legenda-ponto" />{p.legenda()}
      </p>
    </div>
  )
}

function CartaoDado({ id, ativo, pos, titulo, children }: { id: Cartao; ativo: Cartao | null; pos: [number, number, number, number]; titulo: string; children: ReactNode }) {
  const [x, y, z, giro] = pos
  return (
    <div className={`ka-cartao ka-c-${id} ${ativo === id ? 'ativo' : ''}`} style={{ '--x': `${x}px`, '--y': `${y}px`, '--z': `${z}px`, '--giro': `${giro}deg` } as CSSProperties}>
      <span className="ka-cartao-titulo">{titulo}</span>
      {children}
      <span className="ka-varre" />
    </div>
  )
}

/** Pontinhos de dados soltos no ar, em profundidades diferentes. */
function Pecas() {
  const pecas = [[-300, -140, -220], [290, -150, -260], [-40, 150, -120], [320, 30, -200], [-320, 40, -160], [150, -170, -300], [-150, -170, -240], [90, 160, -60]]
  return (
    <>
      {pecas.map(([x, y, z], k) => (
        <i key={k} className="ka-peca" style={{ '--x': `${x}px`, '--y': `${y}px`, '--z': `${z}px`, '--k': k } as CSSProperties} />
      ))}
    </>
  )
}
