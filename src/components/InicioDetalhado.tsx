/**
 * Peças da Início no jeito detalhado: o mês num gráfico semana a semana, como o do Resumo do ano (em cima) e um mosaico de peças (embaixo), cada uma com
 * ícone, um número e uma bolinha de cor. Tocar numa peça abre o bloco completo dela logo abaixo, então o detalhe continua
 * todo lá, só que um toque adiante (veja docs/arquitetura-do-painel.md).
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { DiaADia } from '../lib/previsao'
import type { Tarefa } from '../lib/paraFazer'
import { fmtValor, MESES_CURTO } from '../lib/format'
import { Icone } from './Icone'
import { GraficoDoMes } from './Graficos'
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
/** O cartão do mês: quanto sobrou até hoje, como o mês deve terminar e o gráfico dia a dia. */
export function CartaoDoMes({ dd, nomeMes, compacto }: { dd: DiaADia; nomeMes: string; compacto?: boolean }) {
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
      <GraficoDoMes dd={dd} compacto={compacto} altura={compacto ? 230 : 280} />
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
