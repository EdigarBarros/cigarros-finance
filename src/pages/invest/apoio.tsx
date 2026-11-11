/**
 * Apoio das telas do Invest: o que as quatro abas e as janelas usam em comum (as ações da página, o gráfico de linhas, o
 * selo que diz de onde vem e de quando é cada valor, e os formatos de quantidade e de variação).
 */
import { useId, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { Achado } from '../../lib/achados'
import { fmtDataCurta, fmtPct, LOCAL_DAS_DATAS } from '../../lib/format'
import type { Avaliacao } from '../../lib/invest/carteira'
import type { Ativo, LinhaPendente, Operacao, TipoOperacao } from '../../lib/invest/tipos'
import { tx } from '../../lib/textos'
import { Icone } from '../../components/Icone'
import { useEmVista } from '../analiseApoio'

export type Aba = 'geral' | 'carteira' | 'analises' | 'plano'

/** O que qualquer parte da tela pode pedir à página (pages/Invest.tsx): trocar de aba, abrir um ativo ou uma janela. */
export interface AcoesInvest {
  abrirAba: (a: Aba) => void
  abrirAtivo: (id: string | null) => void
  novoAtivo: () => void
  editarAtivo: (a: Ativo) => void
  /** `pendente`: a operação resolve uma linha que ficou para revisar numa importação. */
  novaOperacao: (o?: { ativoId?: string; tipo?: TipoOperacao; pendente?: { importacaoId: string; linha: LinhaPendente } }) => void
  editarOperacao: (op: Operacao) => void
  atualizarValores: (ativoId?: string) => void
  importar: () => void
  pendencias: () => void
  editarPlano: () => void
  explicar: (a: Achado) => void
  /** Leva para onde a ação de uma descoberta aponta (lib/invest/descobertas.ts, `IR`). */
  ir: (destino: string) => void
}

const formatoQtd = new Intl.NumberFormat(LOCAL_DAS_DATAS, { maximumFractionDigits: 8 })
/** Quantidade de cotas: sem casas quando é inteira, com até 8 quando é fração (Tesouro, cripto). */
export const fmtQtd = (n: number) => formatoQtd.format(n)
/** Variação com sinal: "+4,8%", "−1,2%". */
export const fmtVariacao = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${fmtPct(Math.abs(n))}`
export const tomDoNumero = (n: number) => (n > 0.0000001 ? 'bom' : n < -0.0000001 ? 'ruim' : '')

/** De onde veio o valor de um ativo, em palavras. */
export function fonteDoValor(av: Avaliacao): string {
  if (av.natureza === 'estimado') return tx('Estimado pela taxa do título (bruto, antes do imposto)')
  if (av.natureza === 'custo') return tx('Sem valor informado: vale o que foi aplicado')
  if (av.natureza === 'zerado') return tx('Posição encerrada')
  const origem = av.fonte === 'operacao' ? tx('preço da última compra ou venda') : av.fonte === 'importacao' ? tx('arquivo importado') : av.fonte === 'manual' ? tx('informado por você') : av.fonte
  return av.natureza === 'informado' ? tx('Saldo de {0} ({1})', fmtDataCurta(av.referencia), origem) : tx('Preço de {0} ({1})', fmtDataCurta(av.referencia), origem)
}

/** Selo pequeno com a situação do valor: em dia, de N dias atrás, estimado ou sem valor. Nunca deixa um valor velho parecer novo. */
export function SeloDoValor({ av, curto = false }: { av: Avaliacao; curto?: boolean }) {
  if (av.natureza === 'zerado') return null
  const antigo = av.situacao !== 'em-dia'
  const texto = av.natureza === 'custo' ? tx('sem valor atual')
    : av.natureza === 'estimado' ? (antigo ? tx('estimado até {0}', fmtDataCurta(av.referencia)) : tx('estimado'))
      : av.dias === 0 ? tx('hoje') : av.dias === 1 ? tx('ontem') : tx('há {0} dias', av.dias)
  if (curto && !antigo && av.natureza !== 'estimado') return null
  return <span className={`inv-selo ${antigo ? 'antigo' : ''}`} title={fonteDoValor(av)}><Icone nome={antigo ? 'relogio' : 'check'} tamanho={11} /> {texto}</span>
}

export interface SerieDoGrafico { nome: string; cor: string; valores: (number | null)[]; tracejada?: boolean; area?: boolean }

/**
 * Gráfico de linhas próprio (SVG), no jeito dos gráficos do Consultor: as linhas se desenham ao entrar na tela, e passar o
 * dedo (ou o mouse) mostra os valores do ponto. Serve à evolução da carteira (valor × aportado) e às projeções (três cenários).
 */
export function GraficoDeLinhas({ series, rotulos, formato, altura = 220, legenda = true }: {
  series: SerieDoGrafico[]; rotulos: string[]; formato: (n: number) => string; altura?: number; legenda?: boolean
}) {
  const [ref, vivo] = useEmVista<HTMLDivElement>()
  const area = useRef<HTMLDivElement>(null)
  const [foco, setFoco] = useState<number | null>(null)
  const id = useId()
  const n = rotulos.length
  const todos = series.flatMap((s) => s.valores).filter((v): v is number => v !== null && Number.isFinite(v))
  if (n < 2 || !todos.length) return null
  const [L, A] = [600, 200]
  const max = Math.max(...todos)
  const min = Math.min(...todos)
  // o eixo começa perto do menor valor (não em zero): a variação fica visível, e os rótulos dizem a escala
  const folga = (max - min) * 0.12 || Math.max(1, Math.abs(max) * 0.05)
  const [piso, teto] = [min >= 0 ? Math.max(0, min - folga) : min - folga, max + folga]
  const x = (i: number) => (i / (n - 1)) * L
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
  const aoMover = (clientX: number) => {
    const r = area.current?.getBoundingClientRect()
    if (!r || r.width <= 0) return
    setFoco(Math.max(0, Math.min(n - 1, Math.round(((clientX - r.left) / r.width) * (n - 1)))))
  }
  // até 6 rótulos no eixo, bem espaçados, sempre com o primeiro e o último
  const passos = Math.min(6, n)
  const marcas = [...new Set(Array.from({ length: passos }, (_, k) => Math.round((k / (passos - 1)) * (n - 1))))]
  const linhas = [0, 0.5, 1].map((f) => piso + (teto - piso) * f)
  return (
    <div ref={ref} className={`inv-grafico ${vivo ? 'vivo' : ''}`} style={{ '--alt': `${altura}px` } as CSSProperties}>
      <div className="inv-grafico-corpo">
        <div className="inv-grafico-eixo" aria-hidden="true">{[...linhas].reverse().map((v, i) => <span key={i}>{formato(v)}</span>)}</div>
        <div ref={area} className="inv-grafico-area" onPointerMove={(e) => aoMover(e.clientX)} onPointerDown={(e) => aoMover(e.clientX)} onPointerLeave={() => setFoco(null)}
          role="img" aria-label={series.map((s) => `${s.nome}: ${formato(s.valores[n - 1] ?? 0)}`).join('; ')}>
          <svg viewBox={`0 0 ${L} ${A}`} preserveAspectRatio="none" aria-hidden="true">
            <defs>
              {series.filter((s) => s.area).map((s, i) => (
                <linearGradient key={i} id={`${id}-g${i}`} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" stopColor={s.cor} stopOpacity=".28" /><stop offset="1" stopColor={s.cor} stopOpacity="0" />
                </linearGradient>
              ))}
            </defs>
            {[0, 0.5, 1].map((f) => <line key={f} className="inv-grafico-grade" x1="0" x2={L} y1={A * f} y2={A * f} />)}
            {series.filter((s) => s.area).map((s, i) => {
              const vs = s.valores
              const primeiro = vs.findIndex((v) => v !== null)
              const ultimo = vs.length - 1 - [...vs].reverse().findIndex((v) => v !== null)
              return primeiro >= 0 && <path key={i} className="inv-grafico-fundo" d={`${caminho(vs)}L${x(ultimo).toFixed(1)} ${A}L${x(primeiro).toFixed(1)} ${A}Z`} fill={`url(#${id}-g${i})`} />
            })}
            {series.map((s) => (
              <path key={s.nome} className={`inv-grafico-linha ${s.tracejada ? 'tracejada' : ''}`} d={caminho(s.valores)} stroke={s.cor} vectorEffect="non-scaling-stroke" />
            ))}
          </svg>
          {foco !== null && (
            <>
              <span className="inv-grafico-cursor" style={{ left: `${(foco / (n - 1)) * 100}%` }} aria-hidden="true" />
              {series.map((s) => s.valores[foco] !== null && s.valores[foco] !== undefined && (
                <i key={s.nome} className="inv-grafico-ponto" style={{ left: `${(foco / (n - 1)) * 100}%`, top: `${(y(s.valores[foco]!) / A) * 100}%`, background: s.cor }} aria-hidden="true" />
              ))}
              <div className={`inv-grafico-dica ${foco > n / 2 ? 'esq' : ''}`} style={{ left: `${(foco / (n - 1)) * 100}%` }}>
                <b>{rotulos[foco]}</b>
                {series.map((s) => s.valores[foco] !== null && s.valores[foco] !== undefined && (
                  <span key={s.nome}><i style={{ background: s.cor }} />{s.nome}<strong>{formato(s.valores[foco]!)}</strong></span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      <div className="inv-grafico-rotulos" aria-hidden="true">{marcas.map((i) => <span key={i} style={{ left: `${(i / (n - 1)) * 100}%` }}>{rotulos[i]}</span>)}</div>
      {legenda && series.length > 1 && (
        <ul className="inv-grafico-legenda">
          {series.map((s) => <li key={s.nome}><i className={s.tracejada ? 'tracejada' : ''} style={{ '--c': s.cor } as CSSProperties} />{s.nome}</li>)}
        </ul>
      )}
    </div>
  )
}

/** Um cartão com título e ícone, no padrão das outras telas (classes de components/vitrine.css). */
export function Quadro({ icone, titulo, acao, children, className = '' }: { icone: string; titulo: ReactNode; acao?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`cartao vt-cartao inv-quadro ${className}`}>
      <h3><Icone nome={icone} tamanho={17} /> <span>{titulo}</span>{acao && <span className="inv-quadro-acao">{acao}</span>}</h3>
      {children}
    </section>
  )
}

/** Uma barra de progresso fina, com a fatia pintada. */
export function Fatia({ fracao, cor }: { fracao: number; cor: string }) {
  return <span className="inv-fatia" aria-hidden="true"><i style={{ width: `${Math.max(0, Math.min(1, fracao)) * 100}%`, background: cor }} /></span>
}
