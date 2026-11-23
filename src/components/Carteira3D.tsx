import { forwardRef, useRef, type ReactNode } from 'react'
import { semMovimento } from '../lib/tema'
import { CartaoIlustrado } from './CartaoIlustrado'
import { Icone } from './Icone'
import { tx } from '../lib/textos'

/** Um cartão guardado numa fenda da carteira. */
export interface VagaDaCarteira {
  id: string
  nome: string
  cor: string
  banco?: string
  /** De qual fatura é o valor (ex.: "fatura de novembro"); vai no plástico, escondido pelo bolso. */
  rotulo: string
  valor: string
  /** Estado da fatura (paga, atrasada...): pinta o pontinho do bolso. */
  estado: string
  textoEstado: string
  rodape: ReactNode
}

/**
 * Carteira de couro desenhada só com CSS 3D e SVG (sem biblioteca 3D): cada cartão aparece pela fenda de um bolso, com a
 * fatura gravada em dourado no couro. Passar o ponteiro inclina a carteira e levanta o cartão; o cartão escolhido sai
 * (a animação de ida e volta fica em `voarCartao`, chamada pela tela). `compacta` é a carteira menor, ao lado do cartão.
 */
export const Carteira3D = forwardRef<HTMLDivElement, {
  vagas: VagaDaCarteira[]
  fora: string | null
  compacta: boolean
  aoEscolher: (id: string) => void
  aoNovo: () => void
}>(function Carteira3D({ vagas, fora, compacta, aoEscolher, aoNovo }, ref) {
  const couro = useRef<HTMLDivElement>(null)

  const mover = (e: React.PointerEvent) => {
    const el = couro.current
    if (!el || e.pointerType === 'touch' || semMovimento()) return
    const r = el.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width - 0.5
    const y = (e.clientY - r.top) / r.height - 0.5
    el.style.setProperty('--wy', `${x * (compacta ? 6 : 10)}deg`)
    el.style.setProperty('--wx', `${-y * (compacta ? 4 : 7)}deg`)
    el.style.setProperty('--lx', `${(x + 0.5) * 100}%`)
    el.style.setProperty('--ly', `${(y + 0.5) * 100}%`)
  }
  const soltar = () => {
    const el = couro.current
    if (el) for (const p of ['--wx', '--wy', '--lx', '--ly']) el.style.removeProperty(p)
  }
  // setas para cima e para baixo andam entre os cartões da carteira
  const teclas = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    const botoes = [...(couro.current?.querySelectorAll<HTMLButtonElement>('.cw-vaga > .cw-cartao > button, .cw-novo') ?? [])]
    const i = botoes.indexOf(document.activeElement as HTMLButtonElement)
    if (i < 0) return
    e.preventDefault()
    botoes[(i + (e.key === 'ArrowDown' ? 1 : -1) + botoes.length) % botoes.length]?.focus()
  }

  return (
    <div ref={ref} className={`cw ${compacta ? 'compacta' : ''}`}>
      <div ref={couro} className="cw-couro" onPointerMove={mover} onPointerLeave={soltar} onKeyDown={teclas}>
        <span className="cw-luz" aria-hidden="true" />
        <span className="cw-titulo" aria-hidden="true">{tx('Seus cartões')}</span>
        <ul className="cw-vagas" aria-label={tx('Seus cartões')}>
          {vagas.map((v, i) => (
            <li key={v.id} data-vaga={v.id} className={`cw-vaga ${fora === v.id ? 'saiu' : ''}`}
              style={{ '--i': i, '--c': v.cor } as React.CSSProperties}>
              <div className="cw-cartao">
                <CartaoIlustrado nome={v.nome} cor={v.cor} banco={v.banco} compacto={compacta} ativo={fora === v.id}
                  aoClicar={() => aoEscolher(v.id)} rodape={v.rodape}
                  conteudo={<span className="cc-plastico-fatura"><small>{v.rotulo}</small><b>{v.valor}</b></span>} />
              </div>
              <div className="cw-bolso" aria-hidden="true">
                <span className="cw-bolso-linha">
                  <b className="cw-bolso-valor">{v.valor}</b>
                  <span className={`cw-estado ${v.estado}`}><i />{v.textoEstado}</span>
                </span>
              </div>
            </li>
          ))}
        </ul>
        <button type="button" className="cw-novo" onClick={aoNovo}>
          <span><Icone nome="mais" tamanho={compacta ? 16 : 18} /></span>{tx('Adicionar cartão')}
        </button>
      </div>
    </div>
  )
})

type Retangulo = Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>
const quadro = (el: Element | null | undefined): Retangulo | null => {
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { left: r.left, top: r.top, width: r.width, height: r.height }
}

/** Onde está agora o plástico do cartão `id` dentro da carteira. */
export const quadroDaVaga = (carteira: HTMLElement | null, id: string) =>
  quadro(carteira?.querySelector(`[data-vaga="${CSS.escape(id)}"] .cc-plastico`))

export const quadroDe = quadro

/** Quanto do cartão `id` aparece fora do bolso (0 a 1). */
export function quantoAparece(carteira: HTMLElement | null, id: string) {
  const vaga = carteira?.querySelector(`[data-vaga="${CSS.escape(id)}"]`)
  const c = quadro(vaga?.querySelector('.cc-plastico'))
  const b = quadro(vaga?.querySelector('.cw-bolso'))
  if (!c || !b || c.height <= 0) return 0.3
  return Math.min(1, Math.max(0.1, (b.top - c.top) / c.height))
}

const EASE = 'cubic-bezier(.2, .8, .2, 1)'
const ate = (de: Retangulo, para: Retangulo) =>
  `translate(${de.left - para.left}px, ${de.top - para.top}px) scale(${de.width / para.width})`

/**
 * O cartão saindo da carteira: começa na fenda (só a parte de cima aparecendo, o resto escondido no bolso), sobe, gira
 * um pouco no ar e pousa grande no lugar dele (`el`). Só `transform`, `opacity` e `clip-path`: roda na placa de vídeo.
 */
export function sairDaCarteira(el: HTMLElement, daVaga: Retangulo, aparece: number) {
  const para = quadro(el)
  if (!para) return
  const escondido = `${Math.round((1 - aparece) * 100)}%`
  const sobe = daVaga.height * (1 - aparece) + 18
  el.animate([
    { transform: ate(daVaga, para), clipPath: `inset(0 0 ${escondido} 0 round 14px)`, offset: 0 },
    { transform: `${ate({ ...daVaga, top: daVaga.top - sobe }, para)} rotate(-5deg)`, clipPath: 'inset(0 0 0 0 round 14px)', offset: 0.32 },
    { transform: 'translate(0, -14px) rotateY(-14deg) rotateX(6deg) scale(1.03)', clipPath: 'inset(0 0 0 0 round 18px)', offset: 0.78 },
    { transform: 'none', clipPath: 'inset(0 0 0 0 round 18px)' },
  ], { duration: 920, easing: EASE })
}

/**
 * O cartão voltando: sai de onde estava grande (`de`), passa por cima da carteira e desce para dentro do bolso.
 */
export function voltarParaCarteira(carteira: HTMLElement | null, id: string, de: Retangulo) {
  const vaga = carteira?.querySelector<HTMLElement>(`[data-vaga="${CSS.escape(id)}"]`)
  const casca = vaga?.querySelector<HTMLElement>('.cw-cartao')
  const el = vaga?.querySelector<HTMLElement>('.cc-plastico')
  const para = quadro(el)
  if (!casca || !el || !para) return
  // o cartão passa por cima dos outros cartões e bolsos e só no fim volta para trás do bolso dele
  const z = Number(getComputedStyle(casca).zIndex) || 1
  casca.animate([{ zIndex: 150 }, { zIndex: 150, offset: 0.8 }, { zIndex: z, offset: 0.81 }, { zIndex: z }], { duration: 820 })
  el.animate([
    { transform: ate(de, para), offset: 0 },
    { transform: `translate(0, ${-para.height * 0.9}px) rotate(4deg)`, offset: 0.6 },
    { transform: `translate(0, ${-para.height * 0.55}px)`, offset: 0.8 },
    { transform: 'none' },
  ], { duration: 820, easing: EASE })
}

/** A carteira mudando de tamanho (grande ↔ ao lado do cartão), sem pulo: anima do lugar antigo para o novo. */
export function moverCarteira(el: HTMLElement | null, de: Retangulo | null) {
  const para = quadro(el)
  if (!el || !de || !para || (Math.abs(de.left - para.left) < 1 && Math.abs(de.width - para.width) < 1)) return
  el.animate([
    { transform: ate(de, para), transformOrigin: 'top left' },
    { transform: 'none', transformOrigin: 'top left' },
  ], { duration: 760, easing: EASE })
}
