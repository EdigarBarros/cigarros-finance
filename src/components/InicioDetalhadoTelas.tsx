/**
 * As seções da Início no jeito detalhado (computador e tablet), no layout do OpusCash: Visão geral, Contas prioritárias,
 * Comparação entre períodos, Dívidas/contas/cartões/metas e Diagnóstico financeiro. A Evolução financeira fica em
 * EvolucaoDetalhada.tsx. Aqui só se desenha: os números chegam prontos de pages/Inicio.tsx (veja docs/arquitetura-do-painel.md,
 * 4.0.1).
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { DiaADia } from '../lib/previsao'
import { fraseDoAtraso, type Tarefa } from '../lib/paraFazer'
import type { ComparacaoDeGastos, LinhaComparada } from '../lib/comparacao'
import type { Analise, Tom } from '../lib/analise'
import type { Conselho, Gravidade } from '../lib/conselheiro'
import type { Categoria } from '../lib/types'
import { SEM_CATEGORIA } from '../lib/categorias'
import { fmtValor, MESES_CURTO, MESES_NOME, noMeioDaFrase } from '../lib/format'
import { IconeCategoria } from './IconeCategoria'
import { Lancs } from './ComparacaoMes'
import { Icone } from './Icone'
import { Modal } from './ui'
import { tx } from '../lib/textos'
import './comparacao.css'
import './inicio-detalhado.css'

const comSinal = (n: number) => `${n > 0 ? '+ ' : n < 0 ? '- ' : ''}${fmtValor(Math.abs(n))}`
const COR_DO_TOM: Record<Tom, string> = { bom: 'var(--entrada)', medio: 'var(--divida)', ruim: 'var(--saida)' }

/** Título de cada seção: grande, com a linha de explicação embaixo e, opcionalmente, algo à direita. */
function Titulo({ titulo, sub, icone, lado }: { titulo: string; sub?: ReactNode; icone?: string; lado?: ReactNode }) {
  return (
    <header className="dt-titulo">
      {icone && <span className="dt-titulo-ic"><Icone nome={icone} tamanho={30} /></span>}
      <div className="dt-titulo-txt">
        <h2>{titulo}</h2>
        {sub && <p>{sub}</p>}
      </div>
      {lado && <div className="dt-titulo-lado">{lado}</div>}
    </header>
  )
}

/** Quadradinho colorido com o ícone (a cor vem de `cor`, uma variável do tema). */
const Tile = ({ icone, cor, tamanho = 27 }: { icone: string; cor: string; tamanho?: number }) => (
  <span className="dt-tile" style={{ '--c': cor } as CSSProperties}><Icone nome={icone} tamanho={tamanho} /></span>
)

// ---------- 1. Visão geral ----------
export function VisaoGeral({ nome, dd, nomeMes, decorridos, saldoContas, divida, dividaJuros, aoModo, aoNovo, aoEntender, aoLancamentos, aoPatrimonio, aoDividas }: {
  nome: string
  dd: DiaADia
  nomeMes: string
  /** Dias contados na média por dia (no mês de hoje, até hoje). */
  decorridos: number
  /** Saldo nas contas (null = ninguém informou; undefined = bancos desligados). */
  saldoContas?: number | null
  /** Saldo devedor (undefined = dívidas desligadas). */
  divida?: number
  dividaJuros: number
  aoModo: () => void
  aoNovo: () => void
  aoEntender: () => void
  aoLancamentos: () => void
  aoPatrimonio: () => void
  aoDividas: () => void
}) {
  const resultado = dd.entrou - dd.saiu
  const fim = dd.entrou - dd.saiu + dd.vaiEntrar - dd.vaiSair
  const futuro = dd.hoje === 0
  const maior = Math.max(dd.entrou, dd.saiu, 1)
  const primeiro = nome.trim().split(/\s+/)[0]
  const cartoes: { chave: string; icone: string; cor: string; rotulo: string; valor: string; corValor?: string; sub?: string; acao: () => void }[] = [
    { chave: 'entrou', icone: 'receber', cor: 'var(--entrada)', rotulo: tx('Entradas realizadas'), valor: fmtValor(dd.entrou), corValor: 'var(--entrada)', acao: aoLancamentos },
    { chave: 'saiu', icone: 'sobe', cor: 'var(--saida)', rotulo: tx('Saídas realizadas'), valor: fmtValor(dd.saiu), corValor: 'var(--saida)', acao: aoLancamentos },
    { chave: 'receber', icone: 'camadas', cor: 'var(--texto-2)', rotulo: tx('Ainda a receber'), valor: fmtValor(dd.vaiEntrar), acao: aoEntender },
    { chave: 'pagar', icone: 'cartao', cor: 'var(--texto-2)', rotulo: tx('Ainda a pagar'), valor: fmtValor(dd.vaiSair), acao: aoEntender },
    ...(saldoContas !== undefined ? [{ chave: 'contas', icone: 'banco', cor: 'var(--texto-2)', rotulo: tx('Saldo nas contas'), valor: saldoContas === null ? tx('Não informado') : fmtValor(saldoContas), acao: aoPatrimonio }] : []),
    ...(divida !== undefined ? [{
      chave: 'divida', icone: 'alerta', cor: 'var(--divida)', rotulo: tx('Saldo devedor'), valor: fmtValor(divida),
      sub: dividaJuros > 0 ? tx('Inclui {0} em juros estimados', fmtValor(dividaJuros)) : undefined, acao: aoDividas,
    }] : []),
  ]
  return (
    <section id="det-resumo" className="dt-secao" tabIndex={-1}>
      <header className="dt-topo">
        <div>
          {primeiro && <span className="dt-ola">{tx('Olá, {0}', primeiro)}</span>}
          <div className="dt-topo-linha">
            <h1>{tx('Visão geral')}</h1>
            <button type="button" className="dt-modo" onClick={aoModo}><Icone nome="camadas" tamanho={17} />{tx('Modo detalhado')}</button>
          </div>
        </div>
        <button type="button" className="btn primario dt-novo" onClick={aoNovo}><Icone nome="mais" tamanho={20} />{tx('Novo lançamento')}</button>
      </header>

      <div className="dt-destaques">
        <div className="cartao dt-destaque">
          <Tile icone={resultado >= 0 ? 'investir' : 'desce'} cor={resultado >= 0 ? 'var(--entrada)' : 'var(--saida)'} tamanho={40} />
          <div>
            <span className="dt-rot-maior">{tx('Resultado do mês')}</span>
            <strong className="dt-enorme" style={{ color: resultado >= 0 ? 'var(--entrada)' : 'var(--saida)' }}>{futuro ? tx('Período não iniciado') : fmtValor(resultado)}</strong>
          </div>
        </div>
        <button type="button" className="cartao dt-destaque dt-clicavel" onClick={aoEntender}>
          <Tile icone="calendario" cor="var(--divida)" tamanho={40} />
          <div>
            <span className="dt-rot-maior">{tx('Previsão para o fim do mês')}</span>
            <strong className="dt-grande" style={{ color: fim >= 0 ? 'var(--entrada)' : 'var(--divida)' }}>{fmtValor(fim)}</strong>
            <small className="dt-sub">{tx('Até {0} de {1}', dd.dias, nomeMes)}</small>
          </div>
          <span className="dt-seta"><Icone nome="dir" tamanho={22} /></span>
        </button>
      </div>

      <div className="dt-grade3">
        {cartoes.map((k) => (
          <button key={k.chave} type="button" className="cartao dt-numero dt-clicavel" onClick={k.acao}>
            <Tile icone={k.icone} cor={k.cor} />
            <div>
              <span className="dt-rot">{k.rotulo}</span>
              <strong className="dt-medio" style={k.corValor ? { color: k.corValor } : undefined}>{futuro && (k.chave === 'entrou' || k.chave === 'saiu') ? tx('Período não iniciado') : k.valor}</strong>
              {k.sub && <small className="dt-sub">{k.sub}</small>}
            </div>
            <span className="dt-seta"><Icone nome="dir" tamanho={20} /></span>
          </button>
        ))}
      </div>

      <div className="cartao dt-fluxo">
        <div className="dt-fluxo-barras">
          <h3>{tx('Fluxo de {0}', noMeioDaFrase(nomeMes))}</h3>
          {[[tx('Entradas'), dd.entrou, 'var(--entrada)'], [tx('Saídas'), dd.saiu, 'var(--saida)']].map(([rot, v, cor]) => (
            <div key={rot as string} className="dt-fluxo-linha" style={{ '--c': cor } as CSSProperties}>
              <span className="dt-fluxo-nome"><i />{rot}</span>
              <span className="dt-fluxo-valor">{fmtValor(v as number)}</span>
              <span className="dt-trilho"><b style={{ width: `${Math.max(0, ((v as number) / maior) * 100)}%` }} /></span>
            </div>
          ))}
        </div>
        <div className="dt-fluxo-media">
          <Tile icone="calendario" cor="var(--caixa)" />
          <div>
            <span className="dt-rot">{tx('Média diária de saídas')}</span>
            <strong className="dt-medio" style={{ color: 'var(--caixa)' }}>{futuro ? tx('Período não iniciado') : fmtValor(dd.saiu / Math.max(1, decorridos))}</strong>
          </div>
        </div>
      </div>
    </section>
  )
}

// ---------- 2. Contas prioritárias ----------
const ATRASADAS = 2
const PROXIMAS = 3

function LinhaConta({ t }: { t: Tarefa }) {
  const [aberta, setAberta] = useState(false)
  const atrasada = t.estado === 'atrasada'
  const n = t.diasAtraso ?? 0
  return (
    <li>
      <button type="button" className="dt-conta" onClick={() => setAberta(true)} aria-label={tx('Detalhar {0}', t.titulo)}>
        <span className={`dt-dia${atrasada ? ' atrasada' : ''}`}><b>{t.vencimento.slice(8, 10)}</b>{noMeioDaFrase(MESES_CURTO[+t.vencimento.slice(5, 7) - 1])}</span>
        <span className="dt-conta-nome">
          {t.titulo}
          {atrasada && <small>{t.entrada ? fraseDoAtraso(t) : n === 1 ? tx('1 dia em atraso') : tx('{0} dias em atraso', n)}</small>}
          {t.estado === 'vence_hoje' && <small className="hoje">{tx('vence hoje')}</small>}
        </span>
        <strong className={t.entrada ? 'bom' : undefined}>{t.valor}</strong>
        <Icone nome="dir" tamanho={18} />
      </button>
      {aberta && (
        <Modal titulo={t.titulo} aoFechar={() => setAberta(false)}>
          <p>{t.valor}</p>
          <p>{t.vencimento} · {t.frase}</p>
          <p className="det-nota">{t.chave.startsWith('divida:') ? tx('Valor da parcela pendente. Não representa o saldo total da dívida.') : tx('Registro pendente; abrir não confirma pagamento.')}</p>
          <button className="btn" onClick={() => { setAberta(false); t.botao.acao() }}>{t.botao.texto}</button>
        </Modal>
      )}
    </li>
  )
}

function ListaContas({ tipo, titulo, itens, visiveis, resto, verTudo }: {
  tipo: 'atrasadas' | 'proximas'; titulo: string; itens: Tarefa[]; visiveis: number
  resto: (n: number) => string; verTudo: string
}) {
  const [todas, setTodas] = useState(false)
  const mais = itens.length - visiveis
  return (
    <div className={`cartao dt-lista ${tipo}`}>
      <h3>{titulo}</h3>
      {itens.length ? (
        <ul>{(todas ? itens : itens.slice(0, visiveis)).map((t) => <LinhaConta key={t.chave} t={t} />)}</ul>
      ) : (
        <p className="dt-vazio dt-lista-vazia"><Icone nome={tipo === 'atrasadas' ? 'check' : 'calendario'} tamanho={30} />{tipo === 'atrasadas' ? tx('Nenhuma conta atrasada.') : tx('Nenhum vencimento próximo.')}</p>
      )}
      {mais > 0 && (
        <footer>
          <span>{todas ? '' : resto(mais)}</span>
          <button type="button" className="dt-link" onClick={() => setTodas(!todas)}>{todas ? tx('Mostrar menos') : verTudo}<Icone nome={todas ? 'cima' : 'dir'} tamanho={18} /></button>
        </footer>
      )}
    </div>
  )
}

export function ContasPrioritarias({ tarefas, aoOrganizar }: { tarefas: Tarefa[]; aoOrganizar: () => void }) {
  const atrasadas = tarefas.filter((t) => t.estado === 'atrasada')
  const proximas = tarefas.filter((t) => t.estado !== 'atrasada')
  return (
    <section id="det-prioridades" className="dt-secao" tabIndex={-1}>
      <Titulo titulo={tx('Contas prioritárias')} sub={tx('O que exige sua atenção agora')} lado={tarefas.length > 0 && (
        <>
          <span className="dt-pilula ruim"><Icone nome="relogio" tamanho={20} />{atrasadas.length === 1 ? tx('1 atrasada') : tx('{0} atrasadas', atrasadas.length)}</span>
          <span className="dt-pilula bom"><Icone nome="calendario" tamanho={20} />{proximas.length === 1 ? tx('1 próxima') : tx('{0} próximas', proximas.length)}</span>
        </>
      )} />
      {tarefas.length === 0 ? <p className="cartao dt-vazio-grande">{tx('Nenhuma conta pendente neste período.')}</p> : (
        <>
          <div className="dt-duas">
            <ListaContas tipo="atrasadas" titulo={tx('Atrasadas')} itens={atrasadas} visiveis={ATRASADAS}
              resto={(n) => (n === 1 ? tx('+ 1 conta atrasada') : tx('+ {0} contas atrasadas', n))} verTudo={tx('Ver atrasadas')} />
            <ListaContas tipo="proximas" titulo={tx('Próximos vencimentos')} itens={proximas} visiveis={PROXIMAS}
              resto={(n) => (n === 1 ? tx('+ 1 próxima conta') : tx('+ {0} próximas contas', n))} verTudo={tx('Ver todas as contas')} />
          </div>
          {atrasadas.length > 0 && (
            <div className="cartao dt-faixa">
              <span className="dt-faixa-ic"><Icone nome="escudo" tamanho={34} /></span>
              <p>{tx('Priorize o que está vencido para evitar mais juros.')}</p>
              <button type="button" className="btn primario dt-faixa-btn" onClick={aoOrganizar}>{tx('Organizar pagamentos')}<Icone nome="dir" tamanho={18} /></button>
            </div>
          )}
        </>
      )}
    </section>
  )
}

// ---------- 4. Comparação entre períodos ----------
const CATEGORIAS = 5

function LinhaCategoria({ x, cat, maior, rotuloAtual, rotuloAnterior }: {
  x: LinhaComparada; cat: { nome: string; icone: string; cor: string }; maior: number; rotuloAtual: string; rotuloAnterior: string
}) {
  const [aberta, setAberta] = useState(false)
  const sobe = x.diferenca > 0
  return (
    <>
      <tr className={aberta ? 'aberta' : undefined}>
        <td>
          <button type="button" className="dt-cat" aria-expanded={aberta} onClick={() => setAberta(!aberta)}>
            <span className="dt-cat-ic" style={{ '--c': cat.cor } as CSSProperties}><IconeCategoria emoji={cat.icone} tamanho={18} /></span>
            <b>{cat.nome}</b>
          </button>
        </td>
        <td>{fmtValor(x.anterior)}</td>
        <td>{fmtValor(x.atual)}</td>
        <td className={sobe ? 'sobe' : 'desce'}>{comSinal(x.diferenca)}</td>
        <td className="dt-cat-barra"><span className="dt-trilho"><b style={{ width: `${Math.max(4, (Math.abs(x.diferenca) / maior) * 100)}%`, background: sobe ? 'var(--saida)' : 'var(--entrada)' }} /></span></td>
      </tr>
      {aberta && (
        <tr className="dt-cat-detalhe"><td colSpan={5}><div className="cmp-detalhe"><Lancs titulo={rotuloAtual} lancs={x.lancsAtual} /><Lancs titulo={rotuloAnterior} lancs={x.lancsAnterior} /></div></td></tr>
      )}
    </>
  )
}

export function ComparacaoDetalhada({ comp, categorias, atrasadas, aoVerLancamentos }: {
  comp: ComparacaoDeGastos | null
  categorias: Categoria[]
  /** Contas vencidas e sem baixa no mês de hoje (ainda fora dos gastos). */
  atrasadas: number
  aoVerLancamentos: () => void
}) {
  const [todas, setTodas] = useState(false)
  if (!comp || comp.semBase) {
    return (
      <section id="det-comparacao" className="dt-secao" tabIndex={-1}>
        <Titulo titulo={tx('Comparação entre períodos')} />
        <p className="cartao dt-vazio-grande">{comp ? tx('Sem lançamentos em {0} para comparar.', noMeioDaFrase(MESES_NOME[comp.mesAnterior - 1])) : tx('Sem dados suficientes para comparar este período.')}</p>
      </section>
    )
  }
  const nomeAtual = MESES_NOME[comp.mes - 1]
  const nomeAnt = MESES_NOME[comp.mesAnterior - 1]
  const cat = (id: string) => {
    const c = categorias.find((k) => k.id === id)
    return c ? { nome: c.nome, icone: c.icone, cor: c.cor } : { ...SEM_CATEGORIA, nome: tx('Sem categoria') }
  }
  const sub = comp.ateDia !== null
    ? tx('{0} vs. {1} · dias 1 a {2}', nomeAtual, noMeioDaFrase(nomeAnt), comp.ateDia)
    : tx('{0} vs. {1} · mês inteiro', nomeAtual, noMeioDaFrase(nomeAnt))
  const p = comp.variacao === null ? null : Math.round(Math.abs(comp.variacao) * 100)
  const tom = comp.atual > comp.anterior ? 'sobe' : comp.atual < comp.anterior ? 'desce' : 'igual'
  const manchete = p === null
    ? (comp.atual > 0 ? tx('Gastos novos neste período') : tx('Nenhum gasto nos dois períodos'))
    : p === 0 ? tx('Gastos iguais') : tom === 'sobe' ? tx('Gastos {0}% maiores', p) : tx('Gastos {0}% menores', p)
  const maiorTotal = Math.max(comp.atual, comp.anterior, 1)
  const mudaram = comp.categorias.filter((x) => x.diferenca !== 0)
  const visiveis = todas ? mudaram : mudaram.slice(0, CATEGORIAS)
  const maiorDif = Math.max(1, ...mudaram.map((x) => Math.abs(x.diferenca)))
  const curtoAtual = noMeioDaFrase(MESES_CURTO[comp.mes - 1]), curtoAnt = noMeioDaFrase(MESES_CURTO[comp.mesAnterior - 1])
  const rotuloAtual = comp.ateDia !== null ? tx('{0}, até o dia {1}', curtoAtual, comp.ateDia) : curtoAtual
  const rotuloAnterior = comp.ateDiaAnterior !== null ? tx('{0}, até o dia {1}', curtoAnt, comp.ateDiaAnterior) : curtoAnt
  return (
    <section id="det-comparacao" className="dt-secao" tabIndex={-1}>
      <Titulo titulo={tx('Comparação entre períodos')} sub={sub} />
      <div className={`cartao dt-cmp-topo${atrasadas > 0 ? '' : ' sem-aviso'}`}>
        <div className="dt-cmp-manchete">
          <div className="dt-cmp-linha1">
            {tom !== 'igual' && <Tile icone={tom === 'sobe' ? 'investir' : 'desce'} cor={tom === 'sobe' ? 'var(--saida)' : 'var(--entrada)'} tamanho={26} />}
            <strong className={tom}>{manchete}</strong>
          </div>
          <div className="dt-cmp-valores">
            <span>{nomeAtual}<b>{fmtValor(comp.atual)}</b></span>
            <span>{nomeAnt}<b>{fmtValor(comp.anterior)}</b></span>
          </div>
          <span className={`dt-cmp-variacao ${tom}`}>{tx('Variação:')} <b>{comSinal(comp.atual - comp.anterior)}</b></span>
        </div>
        <div className="dt-cmp-barras">
          {[[nomeAtual, comp.atual, 'var(--saida)'], [nomeAnt, comp.anterior, 'color-mix(in srgb, var(--caixa) 45%, var(--texto-3))']].map(([n, v, cor]) => (
            <div key={n as string}>
              <span><em>{n}</em><b>{fmtValor(v as number)}</b></span>
              <span className="dt-trilho grosso"><b style={{ width: `${((v as number) / maiorTotal) * 100}%`, background: cor as string }} /></span>
            </div>
          ))}
        </div>
        {atrasadas > 0 && (
          <div className="dt-cmp-aviso">
            <Tile icone="info" cor="var(--divida)" tamanho={26} />
            <div>
              <strong>{atrasadas === 1 ? tx('1 conta vencida ainda não foi paga.') : tx('{0} contas vencidas ainda não foram pagas.', atrasadas)}</strong>
              <p>{tx('Ao pagar, esses valores entram na comparação.')}</p>
            </div>
          </div>
        )}
      </div>

      <div className="cartao dt-cmp-tabela">
        <h3>{tx('Onde seus gastos mudaram')}</h3>
        {mudaram.length ? (
          <div className="dt-tabela-rolagem">
            <table>
              <thead><tr><th>{tx('Categoria')}</th><th>{nomeAnt}</th><th>{nomeAtual}</th><th>{tx('Variação')}</th><th aria-hidden="true" /></tr></thead>
              <tbody>
                {visiveis.map((x) => <LinhaCategoria key={x.id} x={x} cat={cat(x.id)} maior={maiorDif} rotuloAtual={rotuloAtual} rotuloAnterior={rotuloAnterior} />)}
              </tbody>
            </table>
          </div>
        ) : <p className="dt-vazio">{tx('Nenhuma categoria mudou entre os dois períodos.')}</p>}
        <footer>
          {mudaram.length > CATEGORIAS ? (
            <button type="button" className="dt-link" onClick={() => setTodas(!todas)}>
              {todas ? tx('Mostrar menos') : tx('Ver todas as {0} categorias', mudaram.length)}<Icone nome={todas ? 'cima' : 'dir'} tamanho={18} />
            </button>
          ) : <span />}
          <button type="button" className="dt-link" onClick={aoVerLancamentos}>{tx('Ver lançamentos')}<Icone nome="dir" tamanho={18} /></button>
        </footer>
      </div>
    </section>
  )
}

// ---------- 5. Dívidas, contas, cartões e metas ----------
export interface PecaDet {
  chave: string
  icone: string
  /** Cor do ícone (uma variável do tema). */
  cor: string
  rotulo: string
  valor: string
  /** A linha de baixo, com o seu ícone e a sua cor. */
  sub?: string
  subIcone?: string
  subCor?: string
  /** Barra (0 a 1). */
  progresso?: number
  /** O bloco completo, que abre logo abaixo ao tocar. */
  detalhe: ReactNode
}

export function Panorama({ pecas, inicial = null, aoAbrir, aoCartoes, aoDividas, aoGerenciar }: {
  pecas: PecaDet[]
  /** A peça que a pessoa escolheu deixar aberta ao entrar (lib/arrumacao.ts). */
  inicial?: string | null
  aoAbrir?: (chave: string) => void
  aoCartoes: () => void
  aoDividas: () => void
  aoGerenciar: () => void
}) {
  const [aberta, setAberta] = useState<string | null>(() => (inicial && pecas.some((p) => p.chave === inicial) ? inicial : null))
  const detalheRef = useRef<HTMLDivElement>(null)
  const pelaPessoa = useRef(false)
  useEffect(() => {
    if (aberta && pelaPessoa.current) detalheRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [aberta])
  const atual = pecas.find((p) => p.chave === aberta)
  return (
    <section id="det-patrimonio" className="dt-secao" tabIndex={-1}>
      <Titulo titulo={tx('Dívidas, contas, cartões e metas')} sub={tx('Seu panorama financeiro em um só lugar.')} />
      {pecas.length > 0 && (
        <div className="dt-grade3 dt-pecas">
          {pecas.map((p) => (
            <button key={p.chave} type="button" className={`cartao dt-peca${p.chave === aberta ? ' aberta' : ''}`} style={{ '--c': p.cor } as CSSProperties}
              aria-expanded={p.chave === aberta} onClick={() => {
                pelaPessoa.current = true
                const abrir = p.chave !== aberta
                setAberta(abrir ? p.chave : null)
                if (abrir) aoAbrir?.(p.chave)
              }}>
              <span className="dt-peca-cab"><Tile icone={p.icone} cor={p.cor} /><span className="dt-peca-rot">{p.rotulo}</span></span>
              <strong className="dt-peca-valor">{p.valor}</strong>
              {p.progresso !== undefined && <span className="dt-trilho"><b style={{ width: `${Math.min(100, Math.max(0, p.progresso * 100))}%`, background: p.cor }} /></span>}
              {p.sub && <span className="dt-peca-sub" style={{ '--s': p.subCor ?? p.cor } as CSSProperties}>{p.subIcone && <Icone nome={p.subIcone} tamanho={20} />}{p.sub}</span>}
            </button>
          ))}
        </div>
      )}
      {atual && <div ref={detalheRef} className="dt-peca-detalhe" key={atual.chave}>{atual.detalhe}</div>}
      <div className="cartao dt-compromissos">
        <strong>{tx('Visão de compromissos')}</strong>
        <span className="dt-compromissos-sep" aria-hidden="true" />
        <button type="button" onClick={aoCartoes} style={{ '--c': 'var(--caixa)' } as CSSProperties}><Icone nome="cartao" tamanho={22} />{tx('Cartões e contas')}</button>
        <button type="button" onClick={aoDividas} style={{ '--c': 'var(--saida)' } as CSSProperties}><Icone nome="divida" tamanho={22} />{tx('Dívidas')}</button>
        <button type="button" className="dt-link dt-compromissos-ir" onClick={aoGerenciar}>{tx('Gerenciar compromissos')}<Icone nome="seta" tamanho={20} /></button>
      </div>
    </section>
  )
}

// ---------- 6. Diagnóstico financeiro ----------
const SEGMENTOS = 12

/** O medidor da nota: arco aberto embaixo, em segmentos; os preenchidos vão até a nota, na cor do tom. */
function Medidor({ nota, tom, rotulo }: { nota: number | null; tom: Tom; rotulo: string }) {
  const cheios = nota === null ? 0 : Math.max(nota > 0 ? 1 : 0, Math.round((nota / 100) * SEGMENTOS))
  const cx = 100, cy = 100, r = 80
  const inicio = 130, volta = 280, folga = 13
  const passo = volta / SEGMENTOS
  const ponto = (a: number) => [cx + r * Math.cos((a * Math.PI) / 180), cy + r * Math.sin((a * Math.PI) / 180)]
  return (
    <div className="dt-medidor">
      <svg viewBox="0 0 200 182" role="img" aria-label={nota === null ? tx('Sem nota ainda') : tx('Nota {0} de 100', nota)}>
        {Array.from({ length: SEGMENTOS }, (_, i) => {
          const a0 = inicio + i * passo + folga / 2, a1 = inicio + (i + 1) * passo - folga / 2
          const [x0, y0] = ponto(a0), [x1, y1] = ponto(a1)
          return <path key={i} d={`M${x0} ${y0} A${r} ${r} 0 0 1 ${x1} ${y1}`} fill="none" strokeWidth={17} strokeLinecap="round"
            stroke={i < cheios ? COR_DO_TOM[tom] : 'color-mix(in srgb, var(--texto-3) 55%, var(--superficie))'} />
        })}
      </svg>
      <div className="dt-medidor-nota">
        <strong style={{ color: COR_DO_TOM[tom] }}>{nota ?? '—'}</strong><span>/100</span>
      </div>
      <span className="dt-saude-rotulo" style={{ '--c': COR_DO_TOM[tom] } as CSSProperties}>{rotulo}</span>
    </div>
  )
}

const SELO: Record<Gravidade, () => string> = {
  urgente: () => tx('Prioridade alta'),
  atencao: () => tx('Atenção'),
  elogio: () => tx('Informação'),
}
const COR_GRAVIDADE: Record<Gravidade, string> = { urgente: 'var(--saida)', atencao: 'var(--divida)', elogio: 'var(--entrada)' }

function Orientacao({ c, aoIr, aoDispensar }: { c: Conselho; aoIr: (d: Conselho['destino']) => void; aoDispensar: (id: string) => void }) {
  const [aberta, setAberta] = useState(false)
  const titulo = c.id === 'sem-reserva' ? tx('Confira a cobertura para imprevistos.') : c.titulo
  return (
    <li className={`dt-orientacao${aberta ? ' aberta' : ''}`} style={{ '--c': COR_GRAVIDADE[c.gravidade] } as CSSProperties}>
      <Tile icone={c.icone} cor={COR_GRAVIDADE[c.gravidade]} tamanho={26} />
      <div className="dt-orientacao-txt">
        <span className="dt-selo">{SELO[c.gravidade]()}</span>
        <strong>{titulo}</strong>
        <button type="button" className="dt-link" onClick={() => aoIr(c.destino)}>{c.botao} →</button>
        {aberta && (
          <div className="dt-orientacao-mais">
            <p>{c.porque}</p>
            {c.id === 'sem-reserva' && <p className="det-nota">{tx('Esta regra considera saldos bancários e investimentos; não verifica liquidez nem destinação para emergências.')}</p>}
            <button type="button" className="link" onClick={() => aoDispensar(c.id)} title={tx('Esconde este aviso até o mês que vem')}>{tx('Agora não')}</button>
          </div>
        )}
      </div>
      <button type="button" className="dt-orientacao-abrir" aria-expanded={aberta} aria-label={aberta ? tx('Recolher') : tx('Saber mais')} onClick={() => setAberta(!aberta)}>
        <Icone nome={aberta ? 'abaixo' : 'dir'} tamanho={22} />
      </button>
    </li>
  )
}

export function Diagnostico({ analise, conselhos, semDados, aoIr, aoDispensar, aoAnalise }: {
  analise: Analise
  conselhos: Conselho[]
  semDados: boolean
  aoIr: (d: Conselho['destino']) => void
  aoDispensar: (id: string) => void
  aoAnalise: () => void
}) {
  const [como, setComo] = useState(false)
  const n = conselhos.length
  return (
    <section id="det-diagnostico" className="dt-secao" tabIndex={-1}>
      <Titulo icone="coracao" titulo={tx('Diagnóstico financeiro')} sub={tx('Entenda seus riscos e saiba por onde começar')} />
      <div className="dt-diag">
        <div className="cartao dt-saude">
          <h3>{tx('Saúde financeira')}</h3>
          <Medidor nota={analise.nota} tom={analise.tom} rotulo={analise.rotulo} />
          <small className="dt-saude-base">{tx('Baseado nos registros disponíveis')}</small>
          <hr />
          <p className="dt-saude-aviso"><Icone nome="info" tamanho={30} />{tx('Saldo em conta não é reserva de emergência.')}</p>
          <button type="button" className="dt-contorno" onClick={aoAnalise}>{tx('Entenda a pontuação')}<Icone nome="externo" tamanho={20} /></button>
        </div>
        <div className="dt-diag-lado">
          <div className="cartao dt-orientacoes">
            <h3>{n === 0 ? tx('Orientações para você') : n === 1 ? tx('1 orientação para você') : tx('{0} orientações para você', n)}</h3>
            {n > 0 ? (
              <ul>{conselhos.map((c) => <Orientacao key={c.id} c={c} aoIr={aoIr} aoDispensar={aoDispensar} />)}</ul>
            ) : (
              <p className="dt-vazio">{semDados ? tx('Dados insuficientes para gerar orientações.') : tx('Nenhum alerta ativo para os registros disponíveis.')}</p>
            )}
          </div>
          <div className={`cartao dt-como${como ? ' aberto' : ''}`}>
            <button type="button" className="dt-como-cab" aria-expanded={como} onClick={() => setComo(!como)}>
              <Icone nome="calculadora" tamanho={22} /><span>{tx('Como calculamos a saúde financeira')}</span><Icone nome={como ? 'cima' : 'abaixo'} tamanho={22} />
            </button>
            {como && (
              <div className="dt-como-corpo">
                <p>{tx('Escala de 0 a 100. Média ponderada: sobra 25, reserva 20, dívidas 20, controle 15, cartão 10 e metas 10. Pilares sem dados são removidos e os pesos restantes são redistribuídos.')}</p>
                {analise.pilares.map((p) => (
                  <div key={p.id} className="dt-pilar">
                    <span><b>{p.nome}</b><em style={{ color: COR_DO_TOM[p.tom] }}>{p.nota}/100</em></span>
                    <p>{p.frase}</p>
                    <small>{p.referencia}</small>
                  </div>
                ))}
                <button type="button" className="dt-link" onClick={aoAnalise}>{tx('Abrir a análise completa')}<Icone nome="dir" tamanho={18} /></button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
