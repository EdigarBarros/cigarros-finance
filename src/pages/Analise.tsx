import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { compararRetratos, retratoDe, type Analise as DadosAnalise, type Mudanca, type Retrato } from '../lib/analise'
import { visuais, type Visual } from '../lib/visuais'
import { fmtDataCurta } from '../lib/format'
import { useMovimento } from '../lib/tema'
import { Icone } from '../components/Icone'
import { Interruptor } from '../components/ui'
import { type Nivel } from '../components/Vitrine'
import { CartaoVisual, Grafico, type AcoesDoCartao } from './AnaliseGraficos'
import { useEmVista } from './analiseApoio'
import { Agora, Objetivo, ProximoPasso, SeuPerfil } from './AnaliseTopo'
import type { Ctx } from './contexto'
import { tx } from '../lib/textos'
import './analise.css'

/** Quantos gráficos aparecem antes de "Ver mais gráficos" (no jeito simples, menos). */
const GRAFICOS_NA_FRENTE = { simples: 2, equilibrado: 4, detalhado: 99 } as const

/** Os assuntos do feed: cada gráfico mora num deles (as abas do equilibrado e as seções do detalhado). */
type Assunto = 'mes' | 'gastos' | 'dividas' | 'guardado' | 'como'
const ASSUNTO_DO_VISUAL: Record<string, Assunto> = {
  calendario: 'mes', 'curva-saldo': 'mes', fluxo: 'mes', 'colunas-sobra': 'mes',
  'rosca-503020': 'gastos', categorias: 'gastos', halteres: 'gastos', 'tabela-orcamento': 'gastos', 'barras-fixas': 'gastos',
  'linha-dividas': 'dividas', 'rosca-juros': 'dividas', 'barras-estrategias': 'dividas',
  'pote-reserva': 'guardado', 'aneis-metas': 'guardado', 'curva-patrimonio': 'guardado',
  radar: 'como',
}
const ASSUNTOS: { id: Assunto; icone: string; nome: () => string }[] = [
  { id: 'mes', icone: 'calendario', nome: () => tx('O mês') },
  { id: 'gastos', icone: 'carteira', nome: () => tx('Gastos') },
  { id: 'dividas', icone: 'divida', nome: () => tx('Dívidas') },
  { id: 'guardado', icone: 'cofre', nome: () => tx('Guardado') },
  { id: 'como', icone: 'bussola', nome: () => tx('Como estou') },
]
const assuntoDe = (v: Visual): Assunto => ASSUNTO_DO_VISUAL[v.id] ?? 'como'

/**
 * Consultor financeiro: a análise de lib/analise.ts em forma de gráficos, refeita a cada mudança nos dados.
 * Cada jeito de ver tem a sua montagem (veja docs/arquitetura-do-painel.md, seção 4.7):
 * - simples: a vitrine do "hoje você pode gastar", um passo por vez, nota e mês em dois quadros e 2 gráficos;
 * - equilibrado: a vitrine com velocímetro, os três quadros (como estou, faça agora, o mês) e o feed em abas por assunto;
 * - detalhado: tudo isso, o plano de ação inteiro em lista e o feed inteiro, dividido em seções por assunto.
 */
export function Analise(c: Ctx) {
  const a = c.analise
  const nivel = c.perfil.detalhe
  const movimento = useMovimento()
  const desdeAVisita = useDesdeAUltimaVisita(c.idUsuario, a)
  const lista = useMemo(() => visuais(a), [a])
  const feed = useFeed(c.idUsuario, lista)

  if (c.contaNova) {
    return (
      <div className="pagina analise">
        <header className="pagina-topo an-cabecalho"><div><h1>{tx('Seu consultor')}</h1></div></header>
        <section className="cartao an-vazio">
          <span className="an-vazio-icone"><Icone nome="bussola" tamanho={30} /></span>
          <h2>{tx('Seu consultor começa no primeiro lançamento')}</h2>
          <p>{tx('Lance o que entra e o que sai. A cada lançamento, os gráficos se refazem sozinhos.')}</p>
          <div className="an-vazio-acoes">
            <button className="btn primario" onClick={() => c.novoLancamento('saida')}><Icone nome="mais" tamanho={16} /> {tx('Fazer o primeiro lançamento')}</button>
            <button className="btn" onClick={c.importarExtrato}><Icone nome="relatorio" tamanho={16} /> {tx('Importar extrato')}</button>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className={`pagina analise an-${nivel} ${movimento === 'reduzido' ? 'parado' : ''}`}>
      <header className="pagina-topo an-cabecalho">
        <div>
          <h1>{tx('Seu consultor')}</h1>
          <p className="sub">{nivel === 'simples' ? tx('O que importa hoje, num olhar.') : tx('Os gráficos se refazem a cada lançamento.')}</p>
        </div>
      </header>
      <SeuPerfil a={a} nivel={nivel} />
      <OQueMudou reanalise={c.reanalise} desdeAVisita={desdeAVisita} max={nivel === 'detalhado' ? 4 : 2} />
      <Agora a={a} nivel={nivel} />
      {nivel === 'detalhado' ? <PlanoDeAcao a={a} aoIr={c.irPara} /> : <ProximoPasso a={a} aoIr={c.irPara} />}
      <Objetivo a={a} memoria={c.memoria} nivel={nivel} aoEscolher={c.escolherObjetivo} />

      {nivel === 'detalhado'
        ? <FeedEmSecoes feed={feed} aoIr={c.irPara} />
        : <FeedEmAbas feed={feed} aoIr={c.irPara} nivel={nivel} />}

      <Escondidos feed={feed} />

      {nivel === 'simples' && (
        <button className="vt-mais-detalhe" onClick={c.personalizar}>
          <Icone nome="ano" tamanho={16} /> {tx('Quer ver todos os gráficos? Mudar o jeito de ver')}
        </button>
      )}

      <footer className="an-rodape">
        <label className="an-avisos">
          <Interruptor ligado={c.avisosDaAnalise} aoMudar={c.mudarAvisosDaAnalise} rotulo={tx('Avisar quando a análise mudar')} />
          <span>{tx('Avisar quando a análise mudar')}</span>
        </label>
        <p>{tx('Orientações de educação financeira, feitas com o que você lançou. Não é recomendação de investimento.')}</p>
      </footer>
    </div>
  )
}










/** No detalhado: o plano de ação inteiro, em ordem, com o ganho de cada passo e o atalho. */
function PlanoDeAcao({ a, aoIr }: { a: DadosAnalise; aoIr: Ctx['irPara'] }) {
  const [aberto, setAberto] = useState<string | null>(null)
  const [ref, vivo] = useEmVista<HTMLElement>()
  if (!a.acoes.length) {
    return (
      <section className="cartao an-agora nivel-tudo-certo">
        <span className="an-agora-icone"><Icone nome="check" tamanho={24} /></span>
        <strong>{tx('Nada pedindo ação agora.')}</strong>
      </section>
    )
  }
  return (
    <section ref={ref} className={`cartao an-plano ${vivo ? 'vivo' : ''}`}>
      <header className="vis-cab">
        <h3><Icone nome="ideia" tamanho={17} /> {tx('Seu plano de ação')}</h3>
        <span className="an-plano-conta">{a.acoes.length === 1 ? tx('1 passo') : tx('{0} passos', a.acoes.length)}</span>
      </header>
      <ol>
        {a.acoes.map((x, i) => (
          <li key={x.id} className={`nivel-${x.urgencia} ${aberto === x.id ? 'aberto' : ''}`} style={{ '--i': i } as CSSProperties}>
            <span className="an-plano-n">{i + 1}</span>
            <span className="an-plano-ic"><Icone nome={x.icone} tamanho={18} /></span>
            <button className="an-plano-texto" onClick={() => setAberto(aberto === x.id ? null : x.id)} aria-expanded={aberto === x.id}>
              <strong>{x.titulo}</strong>
              {x.impacto && <small className="an-plano-ganho"><Icone nome="sobe" tamanho={12} /> {x.impacto}</small>}
              {aberto === x.id && <span className="an-plano-porque">{x.porque}</span>}
            </button>
            <button className="btn" onClick={() => aoIr(x.destino)}>{x.botao} <Icone nome="seta" tamanho={14} /></button>
          </li>
        ))}
      </ol>
    </section>
  )
}


type Feed = ReturnType<typeof useFeed>

/** Simples e equilibrado: os gráficos na ordem do motor, com abas por assunto (no equilibrado) e "Ver mais". */
function FeedEmAbas({ feed, aoIr, nivel }: { feed: Feed; aoIr: Ctx['irPara']; nivel: Nivel }) {
  const [assunto, setAssunto] = useState<Assunto | 'tudo'>('tudo')
  const [todos, setTodos] = useState(false)
  const naFrente = Math.max(GRAFICOS_NA_FRENTE[nivel], feed.favoritos)
  const doAssunto = assunto === 'tudo' ? feed.mostrados : feed.mostrados.filter((v) => assuntoDe(v) === assunto)
  const vistos = todos || assunto !== 'tudo' ? doAssunto : doAssunto.slice(0, naFrente)
  const temAssunto = (id: Assunto) => feed.mostrados.some((v) => assuntoDe(v) === id)
  if (!feed.mostrados.length) return null
  return (
    <section className="an-feed-area">
      <div className="an-feed-cab">
        <h2 className="vt-secao"><span className="vt-secao-ic"><Icone nome="relatorio" tamanho={16} /></span><span>{tx('Seus gráficos')}</span></h2>
        {nivel !== 'simples' && (
          <div className="an-abas" role="tablist" aria-label={tx('Assunto')}>
            <button role="tab" aria-selected={assunto === 'tudo'} className={assunto === 'tudo' ? 'ativo' : ''} onClick={() => setAssunto('tudo')}>{tx('Tudo')}</button>
            {ASSUNTOS.filter((s) => temAssunto(s.id)).map((s) => (
              <button key={s.id} role="tab" aria-selected={assunto === s.id} className={assunto === s.id ? 'ativo' : ''} onClick={() => setAssunto(s.id)}>
                <Icone nome={s.icone} tamanho={14} /> {s.nome()}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="an-feed" key={assunto}>
        {vistos.map((v) => (
          <CartaoVisual key={v.id} v={v} aoIr={aoIr} acoes={feed.acoes(v.id)}><Grafico v={v} /></CartaoVisual>
        ))}
      </div>
      {assunto === 'tudo' && doAssunto.length > naFrente && (
        <button className="btn an-mais" onClick={() => setTodos(!todos)}>
          <Icone nome={todos ? 'cima' : 'ano'} tamanho={17} />
          {todos ? tx('Mostrar menos') : tx('Ver mais {0} gráficos', doAssunto.length - naFrente)}
        </button>
      )}
    </section>
  )
}

/** Detalhado: todos os gráficos, em seções por assunto, com um índice no topo para pular direto a uma delas. */
function FeedEmSecoes({ feed, aoIr }: { feed: Feed; aoIr: Ctx['irPara'] }) {
  const favoritos = feed.mostrados.slice(0, feed.favoritos)
  const resto = feed.mostrados.slice(feed.favoritos)
  // a seção sobe conforme o gráfico mais importante dela (a ordem do motor e do uso)
  const secoes = ASSUNTOS
    .map((s) => ({ ...s, itens: resto.filter((v) => assuntoDe(v) === s.id), primeiro: resto.findIndex((v) => assuntoDe(v) === s.id) }))
    .filter((s) => s.itens.length)
    .sort((x, y) => x.primeiro - y.primeiro)
  const grupos: { id: string; icone: string; nome: string; itens: Visual[] }[] = [
    ...(favoritos.length ? [{ id: 'fav', icone: 'estrela', nome: tx('Favoritos'), itens: favoritos }] : []),
    ...secoes.map((s) => ({ id: s.id, icone: s.icone, nome: s.nome(), itens: s.itens })),
  ]
  const ir = (id: string) => document.getElementById(`an-secao-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  if (!grupos.length) return null
  return (
    <section className="an-feed-area">
      <nav className="an-indice" aria-label={tx('Assuntos')}>
        {grupos.map((g) => (
          <button key={g.id} onClick={() => ir(g.id)}><Icone nome={g.icone} tamanho={15} /> {g.nome} <small>{g.itens.length}</small></button>
        ))}
      </nav>
      {grupos.map((g) => (
        <div key={g.id} id={`an-secao-${g.id}`} className="an-secao">
          <h2 className="vt-secao"><span className="vt-secao-ic"><Icone nome={g.icone} tamanho={16} /></span><span>{g.nome}</span></h2>
          <div className="an-feed">
            {g.itens.map((v) => (
              <CartaoVisual key={v.id} v={v} aoIr={aoIr} acoes={feed.acoes(v.id)}><Grafico v={v} /></CartaoVisual>
            ))}
          </div>
        </div>
      ))}
    </section>
  )
}

function Escondidos({ feed }: { feed: Feed }) {
  const [ver, setVer] = useState(false)
  if (!feed.escondidos.length) return null
  return (
    <section className="an-escondidos">
      <button className="link" onClick={() => setVer(!ver)} aria-expanded={ver}>
        <Icone nome="olho-fechado" tamanho={15} />
        {feed.escondidos.length === 1 ? tx('1 gráfico escondido') : tx('{0} gráficos escondidos', feed.escondidos.length)}
        <Icone nome={ver ? 'cima' : 'abaixo'} tamanho={14} />
      </button>
      {ver && (
        <ul>
          {feed.escondidos.map((v) => (
            <li key={v.id}>
              <span>{v.titulo}</span>
              <button className="btn" onClick={() => feed.mostrar(v.id)}><Icone nome="olho" tamanho={15} /> {tx('Mostrar de novo')}</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/**
 * O que a última mudança fez com a análise ou, sem mudança nesta visita, o que mudou desde a anterior. O retrato da visita
 * fica no navegador (só números), para comparar na próxima.
 */
function useDesdeAUltimaVisita(id: string, a: DadosAnalise) {
  const chave = `opuscash:analise:${id}`
  const [antes] = useState<Retrato | null>(() => {
    try { return JSON.parse(localStorage.getItem(chave) ?? 'null') as Retrato | null } catch { return null }
  })
  const agora = useRef(a)
  useEffect(() => { agora.current = a }, [a])
  useEffect(() => {
    const guardar = () => { try { localStorage.setItem(chave, JSON.stringify(retratoDe(agora.current))) } catch { /* sem armazenamento */ } }
    window.addEventListener('pagehide', guardar)
    return () => { guardar(); window.removeEventListener('pagehide', guardar) }
  }, [chave])
  return useMemo(() => (antes ? { em: antes.em, mudancas: compararRetratos(antes, retratoDe(a)) } : null), [antes, a])
}



/** Só aparece quando algo mudou de fato: uma faixa com setas para cima ou para baixo. */
function OQueMudou({ reanalise, desdeAVisita, max }: { reanalise: Ctx['reanalise']; desdeAVisita: { em: string; mudancas: Mudanca[] } | null; max: number }) {
  const lista = reanalise?.mudancas.length ? reanalise.mudancas : desdeAVisita?.mudancas ?? []
  if (!lista.length) return null
  return (
    <section className="cartao an-mudou">
      <span className="an-mudou-titulo">
        <Icone nome="historico" tamanho={14} />
        {reanalise?.mudancas.length ? tx('Mudou agora') : tx('Desde {0}', fmtDataCurta(desdeAVisita!.em.slice(0, 10)))}
      </span>
      <ul>
        {lista.slice(0, max).map((m, i) => (
          <li key={i} className={m.tom} style={{ '--i': i } as CSSProperties}>
            <span className="an-mudou-seta"><Icone nome={m.tom === 'bom' ? 'sobe' : m.tom === 'ruim' ? 'desce' : 'seta'} tamanho={14} /></span>
            <span>{m.texto}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

interface MemoriaDoFeed { fav: string[]; oculto: string[]; toques: Record<string, number> }

/**
 * O feed aprende com o uso: favoritos vão para o topo, escondidos saem da frente e cada toque num gráfico o sobe um pouco.
 * A memória fica no navegador (por pessoa); sem armazenamento, o feed segue só a ordem do motor.
 */
function useFeed(idUsuario: string, lista: Visual[]) {
  const chave = `opuscash:feed:${idUsuario}`
  const [m, setM] = useState<MemoriaDoFeed>(() => {
    try {
      const lido = JSON.parse(localStorage.getItem(chave) ?? 'null') as Partial<MemoriaDoFeed> | null
      return { fav: lido?.fav ?? [], oculto: lido?.oculto ?? [], toques: lido?.toques ?? {} }
    } catch { return { fav: [], oculto: [], toques: {} } }
  })
  const mudar = (f: (x: MemoriaDoFeed) => MemoriaDoFeed) => setM((antes) => {
    const novo = f(antes)
    try { localStorage.setItem(chave, JSON.stringify(novo)) } catch { /* sem armazenamento */ }
    return novo
  })
  // A ordem pelo uso é a da abertura da aba: um toque não faz o cartão pular de lugar debaixo do dedo.
  const [toquesDaAbertura] = useState(m.toques)
  const ordem = useMemo(() => {
    const peso = (v: Visual) => v.prioridade + Math.min(12, (toquesDaAbertura[v.id] ?? 0) * 2)
    const visiveis = lista.filter((v) => !m.oculto.includes(v.id))
    const favs = m.fav.map((id) => visiveis.find((v) => v.id === id)).filter((v): v is Visual => Boolean(v))
    const resto = visiveis.filter((v) => !m.fav.includes(v.id)).sort((x, y) => peso(y) - peso(x))
    return { mostrados: [...favs, ...resto], favoritos: favs.length, escondidos: lista.filter((v) => m.oculto.includes(v.id)) }
  }, [lista, m, toquesDaAbertura])
  const acoes = (id: string): AcoesDoCartao => ({
    fav: m.fav.includes(id),
    aoFavoritar: () => mudar((x) => ({ ...x, fav: x.fav.includes(id) ? x.fav.filter((f) => f !== id) : [...x.fav, id] })),
    aoEsconder: () => mudar((x) => ({ ...x, oculto: [...x.oculto.filter((o) => o !== id), id], fav: x.fav.filter((f) => f !== id) })),
    aoTocar: () => mudar((x) => ({ ...x, toques: { ...x.toques, [id]: Math.min(50, (x.toques[id] ?? 0) + 1) } })),
  })
  const mostrar = (id: string) => mudar((x) => ({ ...x, oculto: x.oculto.filter((o) => o !== id) }))
  return { ...ordem, acoes, mostrar }
}

