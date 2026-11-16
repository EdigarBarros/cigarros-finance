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
import { Modal } from './ui'
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
export function CartaoDoMes({ dd, nomeMes, grafico, aoEntender, graficoRecolhido, aoAlternarGrafico }: {
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
  const fim = dd.entrou - dd.saiu + dd.vaiEntrar - dd.vaiSair
  return (
    <section className="cartao idet-mes">
      <span className="idet-rot">{tx('Resultado do mês até hoje')}</span>
      <strong className={`idet-grande ${dd.entrou >= dd.saiu ? 'bom' : 'ruim'}`}>{fmtValor(dd.entrou - dd.saiu)}</strong>
      <button className="det-previsao" onClick={aoEntender}>
        <span>{tx('Previsão para o fim do mês')}<small>{tx('Até {0} de {1} · consultar composição', dd.dias, nomeMes)}</small></span>
        <strong>{fmtValor(fim)}</strong><Icone nome="dir" tamanho={16} />
      </button>
      <button className="det-linha det-linha-btn" onClick={aoEntender}><span>{tx('Ainda a receber')}</span><b>{fmtValor(dd.vaiEntrar)}</b><Icone nome="dir" tamanho={14} /></button>
      <button className="det-linha det-linha-btn" onClick={aoEntender}><span>{tx('Ainda a pagar')}</span><b>{fmtValor(dd.vaiSair)}</b><Icone nome="dir" tamanho={14} /></button>
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
  const itens: [string, number, string, string?][] = [
      [tx('Entradas realizadas'), dd.entrou, 'var(--entrada)'],
      [tx('Saídas realizadas'), dd.saiu, 'var(--saida)'],
      [tx('Média diária de saídas'), porDia, 'var(--caixa)', diasContados === 1 ? tx('o que saiu ÷ 1 dia') : tx('o que saiu ÷ {0} dias', diasContados)],
    ]
  return (
    <div className="idet-numeros">
      {itens.map(([rot, v, cor, ajuda]) => (
        <div key={rot} className="cartao idet-num">
          <span className="idet-rot">{rot}</span>
          <strong style={{ color: cor }}>{futuro ? tx('Período não iniciado') : fmtValor(v)}</strong>
          {ajuda && <details className="idet-ajuda"><summary>{tx('Como calculamos')}</summary><p>{ajuda}. {tx('Saídas realizadas do mês selecionado, incluindo faturas reconhecidas como pagas. Não é um limite recomendado de gasto.')}</p></details>}
        </div>
      ))}
    </div>
  )
}

// ---------- o que vem aí ----------
/** Atrasadas mostradas antes do resumo "e mais N". */
const ATRASADAS_VISIVEIS = 2
/** Próximas mostradas. */
const PROXIMAS_VISIVEIS = 3

function LinhaVem({ t }: { t: Tarefa }) {
  const [aberta, setAberta] = useState(false)
  return (
    <li className={t.estado === 'atrasada' ? 'atrasada' : undefined}>
      <button className="det-tarefa" onClick={() => setAberta(true)} aria-label={tx('Detalhar {0}', t.titulo)}><span className="idet-dia"><b>{t.vencimento.slice(8, 10)}</b>{MESES_CURTO[+t.vencimento.slice(5, 7) - 1]}</span>
      <span className="idet-vem-nome">
        {t.titulo}
        {t.estado === 'atrasada' && <small>{fraseDoAtraso(t)}</small>}
        {t.estado === 'vence_hoje' && <small>{tx('vence hoje')}</small>}
      </span>
      <strong className={t.entrada ? 'bom' : undefined}>{t.valor}</strong><Icone nome="dir" tamanho={14} /></button>
      {aberta && <Modal titulo={t.titulo} aoFechar={() => setAberta(false)}><p>{t.valor}</p><p>{t.vencimento} · {t.frase}</p><p className="det-nota">{t.chave.startsWith('divida:') ? tx('Valor da parcela pendente. Não representa o saldo total da dívida.') : tx('Registro pendente; abrir não confirma pagamento.')}</p><button className="btn" onClick={() => { setAberta(false); t.botao.acao() }}>{t.botao.texto}</button></Modal>}
    </li>
  )
}

/**
 * O que precisa de atenção (já venceu, com há quantos dias) separado do que vem aí (na ordem do vencimento). Antes, as
 * 4 linhas eram as 4 mais antigas: com faturas atrasadas, a conta de amanhã nem aparecia.
 */
export function VemAi({ tarefas, aoVerTudo }: { tarefas: Tarefa[]; aoVerTudo?: () => void }) {
  const [todas, setTodas] = useState(false)
  if (!tarefas.length) return null
  const atrasadas = tarefas.filter((t) => t.estado === 'atrasada')
  const proximas = tarefas.filter((t) => t.estado !== 'atrasada')
  const maisAtrasadas = atrasadas.length - ATRASADAS_VISIVEIS
  return (
    <section className="cartao idet-vem">
      {atrasadas.length > 0 && (
        <>
          <span className="idet-rot idet-rot-atencao">{tx('Atrasadas ({0})', atrasadas.length)}</span>
          <ul>
            {(todas ? atrasadas : atrasadas.slice(0, ATRASADAS_VISIVEIS)).map((t) => <LinhaVem key={t.chave} t={t} />)}
          </ul>
          {!todas && maisAtrasadas > 0 && <p className="idet-vem-mais">{maisAtrasadas === 1 ? tx('e mais 1 atrasada') : tx('e mais {0} atrasadas', maisAtrasadas)}</p>}
        </>
      )}
      {proximas.length > 0 && (
        <>
          <span className="idet-rot">{tx('Próximas ({0})', proximas.length)}</span>
          <ul>{(todas ? proximas : proximas.slice(0, PROXIMAS_VISIVEIS)).map((t) => <LinhaVem key={t.chave} t={t} />)}</ul>
        </>
      )}
      <button type="button" className="link idet-vem-tudo" onClick={() => setTodas(!todas)}>{todas ? tx('Mostrar menos') : tx('Ver todas as contas')}</button>
      {todas && aoVerTudo && <button className="link" onClick={aoVerTudo}>{tx('Contas do mês')}</button>}
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
  const sinais = [...new Set(pecas.map((p) => p.sinal).filter(x => x && x !== 'bom'))] as Sinal[]
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
              {p.sinal && p.sinal !== 'bom' && <span className={`idet-sinal ${p.sinal}`} title={NOME_DO_SINAL[p.sinal]()} aria-label={NOME_DO_SINAL[p.sinal]()} role="img" />}
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
