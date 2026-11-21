/**
 * O gráfico do valor, no jeito dos apps de corretora: o número grande em cima (com os centavos menores), o ganho e a
 * rentabilidade do período logo abaixo, a linha pintada pela direção (verde subindo, vermelha caindo) com o degradê embaixo,
 * o maior e o menor valor marcados na direita, o ponto de hoje pulsando e os períodos em pílulas.
 *
 * Passar o dedo (ou o mouse, ou as setas do teclado) troca o topo pelo valor, o ganho e a rentabilidade daquele dia.
 * O ganho nunca conta aporte (vem de analista.ts → serieDoValor, nas contas de `desempenho`).
 */
import { useId, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import { tx } from '../../lib/textos'
import { useEmVista } from '../analiseApoio'
import type { Periodo, PontoDoValor } from './analista'
import { fmtVariacao } from './formatos'

/** Os períodos das pílulas, do mais curto ao mais longo. */
export const PERIODOS: { id: Periodo; curto: () => string; nome: () => string }[] = [
  { id: '1m', curto: () => tx('1M'), nome: () => tx('1 mês') },
  { id: '3m', curto: () => tx('3M'), nome: () => tx('3 meses') },
  { id: '6m', curto: () => tx('6M'), nome: () => tx('6 meses') },
  { id: '12m', curto: () => tx('1A'), nome: () => tx('12 meses') },
  { id: 'tudo', curto: () => tx('Tudo'), nome: () => tx('Tudo') },
]

/** O texto que acompanha o ganho quando ninguém está passando o dedo: "em 12 meses", "desde o início". */
export function textoDoPeriodo(p: Periodo, desdeOInicio: boolean): string {
  if (p === 'tudo' || desdeOInicio) return tx('desde o início')
  return p === '1m' ? tx('no último mês') : p === '3m' ? tx('em 3 meses') : p === '6m' ? tx('em 6 meses') : tx('em 12 meses')
}

/** Separa os centavos do resto ("R$ 1.234" + ",56") para escrevê-los menores. Valor escondido ou sem centavos: tudo junto. */
function partes(texto: string): [string, string] {
  const m = /^(.*\d)([.,]\d{2})(\D*)$/.exec(texto)
  return m ? [m[1], m[2] + m[3]] : [texto, '']
}

// a área da linha: o desenho vai até 86% da largura (70% no celular); o resto fica para o ponto de hoje e as etiquetas
// do maior e do menor valor
const L = 1000
const A = 300

export function GraficoDoValor({ rotulo, agora, serie, formato, formatoCurto, periodo, texto, mostrarAportado = true, extras, altura = 220, vazio, estreito = false }: {
  rotulo: ReactNode
  /** O que o topo mostra sem dedo na tela (os números de hoje, os mesmos do resto da página). */
  agora: { valor: number; ganho: number | null; rentabilidade: number | null; aportado?: number | null }
  serie: { rotulos: string[]; pontos: PontoDoValor[] }
  formato: (n: number) => string
  formatoCurto: (n: number) => string
  periodo?: { valor: Periodo; aoMudar: (p: Periodo) => void }
  /** O que vem depois do ganho, sem dedo na tela ("em 12 meses"). */
  texto: string
  mostrarAportado?: boolean
  /** Selos ao lado do número (rentabilidade × CDI, valores antigos...). */
  extras?: ReactNode
  altura?: number
  /** O que aparece no lugar do desenho quando ainda não há dois pontos. */
  vazio?: ReactNode
  /** Tela estreita (celular): a linha acaba antes, para o ponto de hoje não cair em cima das etiquetas. */
  estreito?: boolean
}) {
  const FIM = estreito ? 0.7 : 0.86
  const [ref, vivo] = useEmVista<HTMLDivElement>()
  const area = useRef<HTMLDivElement>(null)
  const [foco, setFoco] = useState<number | null>(null)
  const id = useId().replace(/:/g, '')
  const { rotulos, pontos } = serie
  const n = pontos.length
  const valores = pontos.map((p) => p.valor)
  const validos = valores.filter((v): v is number => v !== null && Number.isFinite(v))
  const desenha = n >= 2 && validos.length >= 2

  // a direção do período inteiro pinta a linha (não muda enquanto o dedo passa, para não piscar)
  const sobe = (agora.ganho ?? 0) >= 0
  const p = foco !== null ? pontos[foco] : null
  const valor = p?.valor ?? agora.valor
  const ganho = p ? p.ganho : agora.ganho
  const rent = p ? p.rentabilidade : agora.rentabilidade
  const aportado = p ? p.aportado : agora.aportado ?? null
  const [inteiro, centavos] = partes(formato(valor))
  const tomGanho = ganho === null || Math.abs(ganho) < 0.005 ? '' : ganho > 0 ? 'bom' : 'ruim'

  const topo = (
    <div className="ivg-topo">
      <span className="inv-rotulo">{rotulo}</span>
      <div className="ivg-valor-linha">
        <strong className="ivg-valor" aria-live="polite"><span>{inteiro}</span><small>{centavos}</small></strong>
        {extras && foco === null && <div className="inv-chips">{extras}</div>}
      </div>
      <p className="ivg-variacao">
        {ganho !== null && (
          <span className={`ivg-ganho ${tomGanho}`}>
            {ganho > 0.005 ? '+' : ganho < -0.005 ? '−' : ''}{formato(Math.abs(ganho))}
            {rent !== null && <><i className={`ivg-seta ${rent < 0 ? 'desce' : ''}`} aria-hidden="true" />{fmtVariacao(rent).replace(/^[+−]/, '')}</>}
          </span>
        )}
        <span className="ivg-quando">{ganho !== null ? '· ' : ''}{p ? rotulos[foco!] : texto}</span>
      </p>
      {mostrarAportado && aportado !== null && aportado !== undefined && (
        <p className="ivg-variacao ivg-aportado"><i aria-hidden="true" />{tx('Você aportou {0}', formato(aportado))}</p>
      )}
    </div>
  )

  if (!desenha) {
    return <div className="ivg">{topo}{vazio}{periodo && <Pilulas periodo={periodo} />}</div>
  }

  const max = Math.max(...validos)
  const min = Math.min(...validos)
  const aportes = mostrarAportado ? pontos.map((x) => x.aportado).filter((v): v is number => v !== null && Number.isFinite(v)) : []
  // a escala segue o valor (o aportado só entra se couber perto, para não achatar a linha principal)
  const [lo, hi] = [Math.min(min, ...aportes.filter((v) => v >= min - (max - min))), Math.max(max, ...aportes.filter((v) => v <= max + (max - min)))]
  const faixa = hi - lo || Math.max(1, Math.abs(hi) * 0.04)
  const [piso, teto] = [lo - faixa * 0.14, hi + faixa * 0.22]
  const x = (i: number) => (i / (n - 1)) * L * FIM
  const y = (v: number) => A - ((v - piso) / (teto - piso)) * A
  const caminho = (vs: (number | null)[]) => {
    let d = ''
    let aberto = false
    vs.forEach((v, i) => {
      if (v === null || !Number.isFinite(v)) { aberto = false; return }
      d += `${aberto ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`
      aberto = true
    })
    return d
  }
  const primeiro = valores.findIndex((v) => v !== null)
  const ultimo = n - 1 - [...valores].reverse().findIndex((v) => v !== null)
  const iMax = valores.indexOf(max)
  const pct = (v: number) => `${(y(v) / A) * 100}%`
  const xPct = (i: number) => `${(x(i) / L) * 100}%`
  const juntos = Math.abs(y(max) - y(min)) / A < 0.16

  const aoMover = (clientX: number) => {
    const r = area.current?.getBoundingClientRect()
    if (!r || r.width <= 0) return
    const f = (clientX - r.left) / (r.width * FIM)
    setFoco(Math.max(0, Math.min(n - 1, Math.round(f * (n - 1)))))
  }
  const teclado = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const atual = foco ?? n - 1
    setFoco(Math.max(0, Math.min(n - 1, atual + (e.key === 'ArrowLeft' ? -1 : 1))))
  }
  const marcas = [0, Math.round((n - 1) / 2), n - 1]

  return (
    <div ref={ref} className={`ivg ${vivo ? 'vivo' : ''} ${sobe ? 'sobe' : 'desce'}`} style={{ '--alt': `${altura}px` } as CSSProperties}>
      {topo}
      <div ref={area} className="ivg-area" tabIndex={0}
        onPointerMove={(e) => aoMover(e.clientX)} onPointerDown={(e) => aoMover(e.clientX)} onPointerLeave={() => setFoco(null)}
        onKeyDown={teclado} onBlur={() => setFoco(null)}
        role="img" aria-label={tx('Evolução: de {0} a {1}. Mínimo {2}, máximo {3}.', formato(valores[primeiro] ?? 0), formato(valores[ultimo] ?? 0), formato(min), formato(max))}>
        <svg className="ivg-grade-svg" viewBox={`0 0 ${L} ${A}`} preserveAspectRatio="none" aria-hidden="true">
          {[1, 2, 3, 4, 5, 6, 7].map((k) => <line key={`v${k}`} className="ivg-grade" x1={(k / 8) * L} x2={(k / 8) * L} y1="0" y2={A} />)}
          {[1, 2, 3, 4].map((k) => <line key={`h${k}`} className="ivg-grade" x1="0" x2={L} y1={(k / 5) * A} y2={(k / 5) * A} />)}
        </svg>
        <svg className="ivg-desenho" viewBox={`0 0 ${L} ${A}`} preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id={`${id}-f`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" style={{ stopColor: 'var(--ivg-cor)', stopOpacity: .26 }} />
              <stop offset=".7" style={{ stopColor: 'var(--ivg-cor)', stopOpacity: .06 }} />
              <stop offset="1" style={{ stopColor: 'var(--ivg-cor)', stopOpacity: 0 }} />
            </linearGradient>
            <linearGradient id={`${id}-l`} gradientUnits="userSpaceOnUse" x1="0" x2={L * FIM} y1="0" y2="0">
              <stop offset="0" style={{ stopColor: 'var(--ivg-cor)', stopOpacity: .55 }} />
              <stop offset="1" style={{ stopColor: 'var(--ivg-cor)' }} />
            </linearGradient>
          </defs>
          <path className="ivg-fundo" d={`${caminho(valores)}L${x(ultimo).toFixed(1)} ${A}L${x(primeiro).toFixed(1)} ${A}Z`} fill={`url(#${id}-f)`} />
          {mostrarAportado && aportes.length > 1 && <path className="ivg-aporte" d={caminho(pontos.map((q) => q.aportado))} vectorEffect="non-scaling-stroke" />}
          <path className="ivg-linha" d={caminho(valores)} stroke={`url(#${id}-l)`} vectorEffect="non-scaling-stroke" />
        </svg>

        {/* o maior valor: linha pontilhada até a etiqueta, e o número em cima do pico */}
        <span className="ivg-teto" style={{ top: pct(max) }} aria-hidden="true" />
        <span className="ivg-etiqueta" style={{ top: pct(max) }} aria-hidden="true">{formatoCurto(max)}</span>
        {(iMax / (n - 1)) * FIM < FIM - 0.18 && <span className="ivg-pico" style={{ left: xPct(iMax), top: pct(max) }} aria-hidden="true">{formatoCurto(max)}</span>}
        {!juntos && <span className="ivg-etiqueta" style={{ top: pct(min) }} aria-hidden="true">{formatoCurto(min)}</span>}

        {foco === null && valores[ultimo] !== null && (
          <i className="ivg-agora" style={{ left: xPct(ultimo), top: pct(valores[ultimo]!) }} aria-hidden="true" />
        )}
        {foco !== null && (
          <>
            <span className="ivg-cursor" style={{ left: xPct(foco) }} aria-hidden="true" />
            {valores[foco] !== null && <i className="ivg-ponto" style={{ left: xPct(foco), top: pct(valores[foco]!) }} aria-hidden="true" />}
          </>
        )}
      </div>
      <div className="ivg-rotulos" aria-hidden="true">
        {marcas.map((i, k) => <span key={k} style={{ left: xPct(i) }}>{rotulos[i]}</span>)}
      </div>
      {periodo && <Pilulas periodo={periodo} />}
    </div>
  )
}

function Pilulas({ periodo }: { periodo: { valor: Periodo; aoMudar: (p: Periodo) => void } }) {
  return (
    <div className="ivg-periodos" role="radiogroup" aria-label={tx('Período')}>
      {PERIODOS.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={periodo.valor === o.id} title={o.nome()}
          className={periodo.valor === o.id ? 'ativo' : ''} onClick={() => periodo.aoMudar(o.id)}>
          {o.curto()}
        </button>
      ))}
    </div>
  )
}
