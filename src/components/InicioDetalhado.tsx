/**
 * Peças da Início no jeito detalhado: o mês num gráfico dia a dia (em cima) e um mosaico de peças (embaixo), cada uma com
 * ícone, um número e uma bolinha de cor. Tocar numa peça abre o bloco completo dela logo abaixo, então o detalhe continua
 * todo lá, só que um toque adiante (veja docs/arquitetura-do-painel.md).
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { DiaADia } from '../lib/previsao'
import type { Tarefa } from '../lib/paraFazer'
import { fmtValor, MESES_CURTO } from '../lib/format'
import { Icone } from './Icone'
import { tx } from '../lib/textos'
import './inicio-detalhado.css'

/** Verde: tudo certo; amarelo: pede atenção; vermelho: problema. */
export type Sinal = 'bom' | 'atencao' | 'ruim'
const NOME_DO_SINAL: Record<Sinal, () => string> = {
  bom: () => tx('Tudo certo'),
  atencao: () => tx('Pede atenção'),
  ruim: () => tx('Precisa de você'),
}

// ---------- o mês num gráfico ----------
const L = 300, A = 100, MARGEM = 8

/** Saldo acumulado dia a dia: a linha cheia vai até hoje, a tracejada mostra como o mês termina se nada mudar. */
function GraficoDoMes({ dd, positivo }: { dd: DiaADia; positivo: boolean }) {
  // saldo acumulado: feito[d] é o saldo ao fim do dia d (feito[0] = 0, antes do dia 1)
  const feito = dd.aconteceu.reduce((acc, v) => [...acc, acc[acc.length - 1] + v], [0])
  const ateHoje = feito[dd.hoje]
  // do dia de hoje em diante: o que vem (o que já devia ter acontecido e não aconteceu cai no próprio dia de hoje)
  const tracejada: [number, number][] = []
  if (dd.hoje < dd.dias || dd.vem.some((v) => v !== 0)) {
    let s = ateHoje
    tracejada.push([dd.hoje, s])
    if (dd.hoje > 0 && dd.vem[dd.hoje - 1]) tracejada.push([dd.hoje, (s += dd.vem[dd.hoje - 1])])
    for (let d = dd.hoje + 1; d <= dd.dias; d++) tracejada.push([d, (s += dd.vem[d - 1] + dd.aconteceu[d - 1])])
  }
  const valores = [...feito.slice(0, dd.hoje + 1), ...tracejada.map(([, v]) => v), 0]
  const min = Math.min(...valores), max = Math.max(...valores)
  const faixa = max - min || 1
  const x = (dia: number) => (dia / dd.dias) * L
  const y = (v: number) => MARGEM + (1 - (v - min) / faixa) * (A - 2 * MARGEM)
  const linha = (pts: [number, number][]) => pts.map(([d, v], i) => `${i ? 'L' : 'M'}${x(d).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
  const cheia = feito.slice(0, dd.hoje + 1).map((v, d) => [d, v] as [number, number])
  const cor = positivo ? 'var(--entrada)' : 'var(--saida)'
  const marcas = [1, 8, 15, 22, dd.dias]
  const pctHoje = (dd.hoje / dd.dias) * 100
  return (
    <div className="idet-graf">
      <svg viewBox={`0 0 ${L} ${A}`} preserveAspectRatio="none" aria-hidden="true">
        <line className="idet-zero" x1={0} x2={L} y1={y(0)} y2={y(0)} vectorEffect="non-scaling-stroke" />
        {cheia.length > 1 && (
          <>
            <path d={`${linha(cheia)} L${x(dd.hoje).toFixed(1)} ${y(0).toFixed(1)} L0 ${y(0).toFixed(1)}Z`} fill={cor} opacity={0.14} />
            <path d={linha(cheia)} fill="none" stroke={cor} strokeWidth={2.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </>
        )}
        {tracejada.length > 1 && (
          <path d={linha(tracejada)} fill="none" stroke="var(--divida)" strokeWidth={2} strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
        )}
        {dd.hoje > 0 && dd.hoje < dd.dias && <line className="idet-hoje" x1={x(dd.hoje)} x2={x(dd.hoje)} y1={0} y2={A} vectorEffect="non-scaling-stroke" />}
      </svg>
      {dd.hoje > 0 && dd.hoje < dd.dias && <span className="idet-hoje-rot" style={{ left: `${pctHoje}%` }}>{tx('hoje')}</span>}
      <div className="idet-eixo">{marcas.map((d) => <span key={d} style={{ left: `${(d / dd.dias) * 100}%` }}>{d}</span>)}</div>
    </div>
  )
}

/** O cartão do mês: quanto sobrou até hoje, como o mês deve terminar e o gráfico dia a dia. */
export function CartaoDoMes({ dd, nomeMes }: { dd: DiaADia; nomeMes: string }) {
  const futuro = dd.hoje === 0
  const acabou = dd.hoje === dd.dias
  const ateHoje = dd.entrou - dd.saiu
  const fim = ateHoje + dd.vaiEntrar - dd.vaiSair
  const temPrevisao = dd.vaiEntrar > 0 || dd.vaiSair > 0
  const valor = futuro ? fim : ateHoje
  const positivo = valor >= 0
  const rotulo = futuro ? tx('Previsto para {0}', nomeMes)
    : acabou ? (positivo ? tx('Sobrou em {0}', nomeMes) : tx('Faltou em {0}', nomeMes))
    : (positivo ? tx('Sobrou até hoje') : tx('Faltou até hoje'))
  return (
    <section className="cartao idet-mes">
      <div className="idet-mes-cab">
        <div>
          <span className="idet-rot">{rotulo}</span>
          <strong className={`idet-grande ${positivo ? 'bom' : 'ruim'}`}>{positivo ? '' : '− '}{fmtValor(Math.abs(valor))}</strong>
        </div>
        {!futuro && !acabou && temPrevisao && (
          <div className="idet-prev">
            <span className="idet-rot">{tx('Previsto no dia {0}', dd.dias)}</span>
            <strong className={fim < 0 ? 'ruim' : undefined}>{fim < 0 ? '− ' : '≈ '}{fmtValor(Math.abs(fim))}</strong>
          </div>
        )}
      </div>
      <GraficoDoMes dd={dd} positivo={positivo} />
      <div className="idet-legenda">
        {!futuro && <span><i style={{ background: positivo ? 'var(--entrada)' : 'var(--saida)' }} />{tx('Já aconteceu')}</span>}
        {(temPrevisao || !acabou) && <span><i className="tracejado" />{tx('O que vem, se nada mudar')}</span>}
      </div>
    </section>
  )
}

/** Entrou e saiu até hoje e o gasto médio por dia (com as compras no cartão), em números pequenos. No mês que ainda não começou: o que vai entrar e sair. */
export function NumerosDoMes({ dd, porDia }: { dd: DiaADia; porDia: number }) {
  const futuro = dd.hoje === 0
  const itens: [string, number, string][] = futuro
    ? [[tx('Vai entrar'), dd.vaiEntrar, 'var(--entrada)'], [tx('Vai sair'), dd.vaiSair, 'var(--saida)']]
    : [
      [tx('Entrou'), dd.entrou, 'var(--entrada)'],
      [tx('Saiu'), dd.saiu, 'var(--saida)'],
      [tx('Gasto por dia'), porDia, 'var(--caixa)'],
    ]
  return (
    <div className="idet-numeros">
      {itens.map(([rot, v, cor]) => (
        <div key={rot} className="cartao idet-num">
          <span className="idet-rot">{rot}</span>
          <strong style={{ color: cor }}>{fmtValor(v)}</strong>
        </div>
      ))}
    </div>
  )
}

// ---------- o que vem aí ----------
const iconeDaTarefa = (t: Tarefa) => (t.chave.startsWith('fatura:') ? 'cartao' : t.chave.startsWith('divida:') ? 'divida' : t.entrada ? 'receber' : 'calendario')
const corDaTarefa = (t: Tarefa) => (t.chave.startsWith('fatura:') ? 'var(--caixa)' : t.chave.startsWith('divida:') ? 'var(--saida)' : t.entrada ? 'var(--entrada)' : 'var(--divida)')

/** As próximas contas, faturas e parcelas, na ordem do vencimento (o que já venceu vem primeiro). */
export function VemAi({ tarefas }: { tarefas: Tarefa[] }) {
  if (!tarefas.length) return null
  return (
    <section className="cartao idet-vem">
      <span className="idet-rot">{tx('O que vem aí')}</span>
      <ul>
        {tarefas.map((t) => (
          <li key={t.chave} className={t.estado === 'atrasada' ? 'atrasada' : undefined}>
            <span className="idet-dia"><b>{t.vencimento.slice(8, 10)}</b>{MESES_CURTO[+t.vencimento.slice(5, 7) - 1]}</span>
            <span className="idet-ic" style={{ '--c': corDaTarefa(t) } as CSSProperties}><Icone nome={iconeDaTarefa(t)} tamanho={18} /></span>
            <span className="idet-vem-nome">
              {t.titulo}
              {t.estado === 'atrasada' && <small>{tx('atrasada')}</small>}
              {t.estado === 'vence_hoje' && <small>{tx('vence hoje')}</small>}
            </span>
            <strong className={t.entrada ? 'bom' : undefined}>{t.valor}</strong>
          </li>
        ))}
      </ul>
    </section>
  )
}

// ---------- o mosaico ----------
export interface Peca {
  chave: string
  icone: string
  /** Cor do ícone (uma variável do tema). */
  cor: string
  rotulo: string
  valor: string
  sub?: string
  sinal?: Sinal
  /** Barra de progresso (0 a 1). */
  progresso?: number
  /** O bloco completo, que abre ao tocar. */
  detalhe: ReactNode
}

/** Peças grandes; tocar abre o bloco completo logo abaixo (uma de cada vez), tocar de novo fecha. */
export function Mosaico({ pecas }: { pecas: Peca[] }) {
  const [aberta, setAberta] = useState<string | null>(null)
  const detalheRef = useRef<HTMLDivElement>(null)
  const atual = pecas.find((p) => p.chave === aberta)
  useEffect(() => {
    if (aberta) detalheRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [aberta])
  if (!pecas.length) return null
  const n = pecas.length
  const estilo = { '--n': n, '--meio': n <= 4 ? n : 3 } as CSSProperties
  return (
    <div className="idet-mosaico-area">
      <div className={`idet-mosaico${n % 2 ? ' impar' : ''}`} style={estilo}>
        {pecas.map((p) => (
          <button key={p.chave} type="button" className={`cartao idet-peca${p.chave === aberta ? ' aberta' : ''}`} style={{ '--c': p.cor } as CSSProperties}
            aria-expanded={p.chave === aberta} onClick={() => setAberta(p.chave === aberta ? null : p.chave)}>
            <span className="idet-peca-topo">
              <span className="idet-ic"><Icone nome={p.icone} tamanho={20} /></span>
              {p.sinal && <span className={`idet-sinal ${p.sinal}`} title={NOME_DO_SINAL[p.sinal]()} aria-label={NOME_DO_SINAL[p.sinal]()} role="img" />}
            </span>
            <span className="idet-rot">{p.rotulo}</span>
            <strong className="idet-peca-valor">{p.valor}</strong>
            {p.progresso !== undefined && <span className="idet-barra"><i style={{ width: `${Math.min(100, Math.max(0, p.progresso * 100))}%` }} /></span>}
            {p.sub && <span className="idet-peca-sub">{p.sub}</span>}
          </button>
        ))}
      </div>
      {atual && <div ref={detalheRef} className="idet-detalhe" key={atual.chave}>{atual.detalhe}</div>}
    </div>
  )
}
