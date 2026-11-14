/**
 * Peças da Início no jeito detalhado: o mês com o gráfico do ano mês a mês, o mesmo do Resumo do ano (em cima), e um mosaico de peças (embaixo), cada uma com
 * ícone, um número e uma bolinha de cor. Tocar numa peça abre o bloco completo dela logo abaixo, então o detalhe continua
 * todo lá, só que um toque adiante (veja docs/arquitetura-do-painel.md).
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { DiaADia } from '../lib/previsao'
import { fraseDoAtraso, type Tarefa } from '../lib/paraFazer'
import { fmtValor, MESES_CURTO } from '../lib/format'
import { Icone } from './Icone'
import { tx } from '../lib/textos'
import type { SituacaoDoMes } from '../lib/situacaoDoMes'
import './entender.css'
import './inicio-detalhado.css'

/** Verde: tudo certo; amarelo: pede atenção; vermelho: problema. */
export type Sinal = 'bom' | 'atencao' | 'ruim'
const NOME_DO_SINAL: Record<Sinal, () => string> = {
  bom: () => tx('Tudo certo'),
  atencao: () => tx('Pede atenção'),
  ruim: () => tx('Precisa de você'),
}

// ---------- o mês num gráfico ----------
/**
 * O cartão do mês: quanto sobrou até hoje, o estado do mês (a mesma conta dos outros jeitos), o resultado previsto para o
 * último dia com o "Entender previsão" e, embaixo, o gráfico do ano mês a mês (`grafico`), que a pessoa pode recolher.
 */
export function CartaoDoMes({ dd, nomeMes, divida, grafico, situacao, aoEntender, graficoRecolhido, aoAlternarGrafico }: {
  dd: DiaADia; nomeMes: string
  /** O gráfico do cartão: o ano mês a mês (o mesmo do Resumo do ano), no lugar do antigo dia a dia. */
  grafico?: ReactNode
  /** Quanto se deve ao fim de cada dia: vira a linha "Dívidas: hoje → no dia 30" do topo. */
  divida?: number[]
  situacao: SituacaoDoMes
  aoEntender: () => void
  /** A pessoa recolheu o gráfico (fica guardado neste aparelho). */
  graficoRecolhido?: boolean
  aoAlternarGrafico?: () => void
}) {
  const dividaHoje = divida?.length ? divida[Math.max(1, Math.min(dd.dias, dd.hoje)) - 1] : 0
  const dividaFim = divida?.length ? divida[dd.dias - 1] : 0
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
  const comSelo = situacao.estado !== 'sem_dados'
  return (
    <section className="cartao idet-mes">
      <div className="idet-mes-cab">
        <div>
          <span className="idet-rot">{rotulo}</span>
          <strong className={`idet-grande ${positivo ? 'bom' : 'ruim'}`}>{positivo ? '' : '− '}{fmtValor(Math.abs(valor))}</strong>
        </div>
        {!futuro && !acabou && temPrevisao && (
          <div className="idet-prev">
            <span className="idet-rot">{tx('Resultado previsto no dia {0}', dd.dias)}</span>
            <strong className={fim < 0 ? 'ruim' : undefined}>{fim < 0 ? '− ' : '≈ '}{fmtValor(Math.abs(fim))}</strong>
            <button type="button" className="btn-entender" onClick={aoEntender}><Icone nome="ideia" tamanho={15} /> {tx('Entender previsão')}</button>
          </div>
        )}
      </div>
      {comSelo && (
        <div className="idet-estado">
          <button type="button" className={`selo-mes ${situacao.estado}`} onClick={aoEntender} title={tx('Por que este estado?')}>
            <i aria-hidden="true" />{situacao.selo}
          </button>
        </div>
      )}
      {dividaHoje > 0 && (
        <p className="idet-divida">
          <i />{tx('Dívidas')} <b>{fmtValor(dividaHoje)}</b>
          {!acabou && Math.abs(dividaFim - dividaHoje) >= 0.5 && <span className="idet-divida-fim">{'→ '}<b>{fmtValor(dividaFim)}</b> {tx('no dia {0}', dd.dias)}</span>}
        </p>
      )}
      {grafico && <GraficoRecolhivel grafico={grafico} recolhido={graficoRecolhido} aoAlternar={aoAlternarGrafico} />}
    </section>
  )
}

/**
 * O gráfico do ano com o botão de recolher. No computador fica dentro do cartão do mês; no celular vem num cartão próprio,
 * depois dos números e do "o que vem aí", para o gráfico grande não empurrar o resumo para baixo.
 */
export function GraficoRecolhivel({ grafico, recolhido, aoAlternar }: { grafico: ReactNode; recolhido?: boolean; aoAlternar?: () => void }) {
  return (
    <>
      {aoAlternar && (
        <button type="button" className="idet-recolher" aria-expanded={!recolhido} onClick={aoAlternar}>
          <Icone nome="ano" tamanho={15} />
          {recolhido ? tx('Mostrar o gráfico do ano') : tx('Recolher o gráfico do ano')}
          <Icone nome={recolhido ? 'abaixo' : 'cima'} tamanho={15} />
        </button>
      )}
      {!recolhido && grafico}
    </>
  )
}

/**
 * Entrou e saiu até hoje e o gasto médio por dia (com as compras no cartão), em números pequenos, cada um dizendo de onde
 * vem. No mês que ainda não começou: o que vai entrar e sair.
 */
export function NumerosDoMes({ dd, porDia, diasContados }: { dd: DiaADia; porDia: number; diasContados: number }) {
  const futuro = dd.hoje === 0
  const itens: [string, number, string, string?][] = futuro
    ? [[tx('Vai entrar'), dd.vaiEntrar, 'var(--entrada)'], [tx('Vai sair'), dd.vaiSair, 'var(--saida)']]
    : [
      [dd.hoje < dd.dias ? tx('Entrou até hoje') : tx('Entrou'), dd.entrou, 'var(--entrada)'],
      [dd.hoje < dd.dias ? tx('Saiu até hoje') : tx('Saiu'), dd.saiu, 'var(--saida)'],
      [tx('Gasto por dia'), porDia, 'var(--caixa)', diasContados === 1 ? tx('o que saiu ÷ 1 dia') : tx('o que saiu ÷ {0} dias', diasContados)],
    ]
  return (
    <div className="idet-numeros">
      {itens.map(([rot, v, cor, ajuda]) => (
        <div key={rot} className="cartao idet-num">
          <span className="idet-rot">{rot}</span>
          <strong style={{ color: cor }}>{fmtValor(v)}</strong>
          {ajuda && <small className="idet-ajuda">{ajuda}</small>}
        </div>
      ))}
    </div>
  )
}

// ---------- o que vem aí ----------
const iconeDaTarefa = (t: Tarefa) => (t.chave.startsWith('fatura:') ? 'cartao' : t.chave.startsWith('divida:') ? 'divida' : t.entrada ? 'receber' : 'calendario')
const corDaTarefa = (t: Tarefa) => (t.chave.startsWith('fatura:') ? 'var(--caixa)' : t.chave.startsWith('divida:') ? 'var(--saida)' : t.entrada ? 'var(--entrada)' : 'var(--divida)')

/** Atrasadas mostradas antes do resumo "e mais N". */
const ATRASADAS_VISIVEIS = 2
/** Próximas mostradas. */
const PROXIMAS_VISIVEIS = 3

function LinhaVem({ t }: { t: Tarefa }) {
  return (
    <li className={t.estado === 'atrasada' ? 'atrasada' : undefined}>
      <span className="idet-dia"><b>{t.vencimento.slice(8, 10)}</b>{MESES_CURTO[+t.vencimento.slice(5, 7) - 1]}</span>
      <span className="idet-ic" style={{ '--c': corDaTarefa(t) } as CSSProperties}><Icone nome={iconeDaTarefa(t)} tamanho={18} /></span>
      <span className="idet-vem-nome">
        {t.titulo}
        {t.estado === 'atrasada' && <small>{fraseDoAtraso(t)}</small>}
        {t.estado === 'vence_hoje' && <small>{tx('vence hoje')}</small>}
      </span>
      <strong className={t.entrada ? 'bom' : undefined}>{t.valor}</strong>
    </li>
  )
}

/**
 * O que precisa de atenção (já venceu, com há quantos dias) separado do que vem aí (na ordem do vencimento). Antes, as
 * 4 linhas eram as 4 mais antigas: com faturas atrasadas, a conta de amanhã nem aparecia.
 */
export function VemAi({ tarefas, aoVerTudo }: { tarefas: Tarefa[]; aoVerTudo?: () => void }) {
  if (!tarefas.length) return null
  const atrasadas = tarefas.filter((t) => t.estado === 'atrasada')
  const proximas = tarefas.filter((t) => t.estado !== 'atrasada')
  const maisAtrasadas = atrasadas.length - ATRASADAS_VISIVEIS
  return (
    <section className="cartao idet-vem">
      {atrasadas.length > 0 && (
        <>
          <span className="idet-rot idet-rot-atencao">{tx('Precisam de atenção')}</span>
          <ul>
            {atrasadas.slice(0, ATRASADAS_VISIVEIS).map((t) => <LinhaVem key={t.chave} t={t} />)}
          </ul>
          {maisAtrasadas > 0 && <p className="idet-vem-mais">{maisAtrasadas === 1 ? tx('e mais 1 atrasada') : tx('e mais {0} atrasadas', maisAtrasadas)}</p>}
        </>
      )}
      {proximas.length > 0 && (
        <>
          <span className="idet-rot">{tx('O que vem aí')}</span>
          <ul>{proximas.slice(0, PROXIMAS_VISIVEIS).map((t) => <LinhaVem key={t.chave} t={t} />)}</ul>
        </>
      )}
      {aoVerTudo && <button type="button" className="link idet-vem-tudo" onClick={aoVerTudo}>{tx('Ver todas as contas')}</button>}
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

/**
 * Peças grandes; tocar abre o bloco completo logo abaixo (uma de cada vez), tocar de novo fecha. `inicial`: a peça que a
 * pessoa escolheu deixar aberta ao entrar. Embaixo, a legenda das bolinhas (a cor nunca fala sozinha).
 */
export function Mosaico({ pecas, inicial = null, aoAbrir }: { pecas: Peca[]; inicial?: string | null; aoAbrir?: (chave: string) => void }) {
  const [aberta, setAberta] = useState<string | null>(() => (inicial && pecas.some((p) => p.chave === inicial) ? inicial : null))
  const detalheRef = useRef<HTMLDivElement>(null)
  const pelaPessoa = useRef(false)
  const atual = pecas.find((p) => p.chave === aberta)
  useEffect(() => {
    // só rola até o bloco quando a pessoa tocou (a peça que abre sozinha ao entrar não puxa a tela para baixo)
    if (aberta && pelaPessoa.current) detalheRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [aberta])
  if (!pecas.length) return null
  const n = pecas.length
  const estilo = { '--n': n, '--meio': n <= 4 ? n : 3 } as CSSProperties
  const sinais = [...new Set(pecas.map((p) => p.sinal).filter(Boolean))] as Sinal[]
  return (
    <div className="idet-mosaico-area">
      <div className={`idet-mosaico${n % 2 ? ' impar' : ''}`} style={estilo}>
        {pecas.map((p) => (
          <button key={p.chave} type="button" className={`cartao idet-peca${p.chave === aberta ? ' aberta' : ''}`} style={{ '--c': p.cor } as CSSProperties}
            aria-expanded={p.chave === aberta} onClick={() => {
              pelaPessoa.current = true
              const abrir = p.chave !== aberta
              setAberta(abrir ? p.chave : null)
              if (abrir) aoAbrir?.(p.chave)
            }}>
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
      {sinais.length > 0 && (
        <p className="idet-legenda" aria-hidden="true">
          {(['bom', 'atencao', 'ruim'] as Sinal[]).filter((x) => sinais.includes(x)).map((x) => (
            <span key={x}><i className={`idet-sinal ${x}`} />{NOME_DO_SINAL[x]()}</span>
          ))}
        </p>
      )}
      {atual && <div ref={detalheRef} className="idet-detalhe" key={atual.chave}>{atual.detalhe}</div>}
    </div>
  )
}
