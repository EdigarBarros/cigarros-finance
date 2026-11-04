import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { compararRetratos, retratoDe, type Analise as DadosAnalise, type Mudanca, type Retrato } from '../lib/analise'
import { cascataDoMes, visuais, type Visual } from '../lib/visuais'
import { tracosDe, type Traco } from '../lib/jeito'
import { fmtDataCurta, fmtValor, MESES_NOME, noMeioDaFrase } from '../lib/format'
import { useMovimento } from '../lib/tema'
import { Icone } from '../components/Icone'
import { Interruptor } from '../components/ui'
import { Numero } from '../components/Numero'
import { CartaoVisual, Escada, Grafico, Medidor, type AcoesDoCartao } from './AnaliseGraficos'
import { COR_DO_TOM, useEmVista } from './analiseApoio'
import type { Ctx } from './contexto'
import { tx } from '../lib/textos'
import './analise.css'

/** Quantos gráficos aparecem antes de "Ver mais gráficos" (no jeito simples, menos). */
const GRAFICOS_NA_FRENTE = { simples: 2, equilibrado: 4, detalhado: 8 } as const

/**
 * Consultor financeiro: a análise de lib/analise.ts em forma de gráficos, refeita a cada mudança nos dados.
 * No topo, três cartões respondem: como estou (velocímetro e escada das fases), o que fazer agora (um passo por vez) e
 * como o mês fecha (cascata). Depois vem o feed de gráficos que lib/visuais.ts escolhe para a pessoa, do mais para o
 * menos importante. Pouco texto: título curto, uma frase e, quando precisa, "Por quê?" para a explicação.
 * Veja docs/arquitetura-do-painel.md, seção 4.7.
 */
export function Analise(c: Ctx) {
  const a = c.analise
  const movimento = useMovimento()
  const [todos, setTodos] = useState(c.perfil.detalhe === 'detalhado')
  const desdeAVisita = useDesdeAUltimaVisita(c.idUsuario, a)
  const lista = useMemo(() => visuais(a), [a])
  const tracos = useMemo(() => tracosDe(a), [a])
  const feed = useFeed(c.idUsuario, lista)
  const [verEscondidos, setVerEscondidos] = useState(false)
  const naFrente = Math.max(GRAFICOS_NA_FRENTE[c.perfil.detalhe], feed.favoritos)
  const vistos = todos ? feed.mostrados : feed.mostrados.slice(0, naFrente)

  if (c.contaNova) {
    return (
      <div className="pagina analise">
        <Cabecalho />
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
    <div className={`pagina analise ${movimento === 'reduzido' ? 'parado' : ''}`}>
      <Cabecalho />
      <SeuJeito tracos={tracos} />
      <OQueMudou reanalise={c.reanalise} desdeAVisita={desdeAVisita} />
      {/* no computador, os quatro cartões do topo ficam em grade 2 × 2; no celular, um embaixo do outro */}
      <div className={`an-topo ${a.mes ? '' : 'sem-mes'}`}>
        <div className="an-topo-hoje"><HojePodeGastar a={a} /></div>
        <div className="an-topo-agora"><FacaAgora a={a} aoIr={c.irPara} /></div>
        <div className="an-topo-como"><ComoEstou a={a} /></div>
        {a.mes && <div className="an-topo-mes"><SeuMes a={a} /></div>}
      </div>

      <div className="an-feed">
        {vistos.map((v) => (
          <CartaoVisual key={v.id} v={v} aoIr={c.irPara} acoes={feed.acoes(v.id)}><Grafico v={v} /></CartaoVisual>
        ))}
      </div>
      {feed.mostrados.length > naFrente && (
        <button className="btn an-mais" onClick={() => setTodos(!todos)}>
          <Icone nome={todos ? 'cima' : 'ano'} tamanho={17} />
          {todos ? tx('Mostrar menos') : tx('Ver mais {0} gráficos', feed.mostrados.length - naFrente)}
        </button>
      )}
      {feed.escondidos.length > 0 && (
        <section className="an-escondidos">
          <button className="link" onClick={() => setVerEscondidos(!verEscondidos)} aria-expanded={verEscondidos}>
            <Icone nome="olho-fechado" tamanho={15} />
            {feed.escondidos.length === 1 ? tx('1 gráfico escondido') : tx('{0} gráficos escondidos', feed.escondidos.length)}
            <Icone nome={verEscondidos ? 'cima' : 'abaixo'} tamanho={14} />
          </button>
          {verEscondidos && (
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

function Cabecalho() {
  return (
    <header className="pagina-topo">
      <div>
        <h1>{tx('Seu consultor')}</h1>
        <p className="sub">{tx('Os gráficos se refazem a cada lançamento.')}</p>
      </div>
    </header>
  )
}

/** "Por quê?": a explicação fica escondida até a pessoa pedir. */
function PorQue({ texto }: { texto: string }) {
  const [aberto, setAberto] = useState(false)
  if (!texto) return null
  return (
    <div className={`an-porque ${aberto ? 'aberto' : ''}`}>
      <button className="link" onClick={() => setAberto(!aberto)} aria-expanded={aberto}>
        {aberto ? tx('Esconder') : tx('Por quê?')} <Icone nome={aberto ? 'cima' : 'abaixo'} tamanho={14} />
      </button>
      {aberto && <p>{texto}</p>}
    </div>
  )
}

/** Os traços do jeito da pessoa (lib/jeito.ts): tocar mostra por que o motor leu assim. */
function SeuJeito({ tracos }: { tracos: Traco[] }) {
  const [aberto, setAberto] = useState<string | null>(null)
  if (!tracos.length) return null
  const t = tracos.find((x) => x.id === aberto)
  return (
    <section className="an-jeito" aria-label={tx('Seu jeito com o dinheiro')}>
      <span className="an-jeito-titulo">{tx('Seu jeito')}</span>
      <div className="an-jeito-lista">
        {tracos.map((x) => (
          <button key={x.id} className={`an-traco ${aberto === x.id ? 'aberto' : ''}`} onClick={() => setAberto(aberto === x.id ? null : x.id)} aria-expanded={aberto === x.id}>
            <Icone nome={x.icone} tamanho={14} /> {x.nome}
          </button>
        ))}
      </div>
      {t && <p className="an-jeito-porque">{t.porque} {tx('Os gráficos abaixo estão na ordem que mais serve a esse jeito.')}</p>}
    </section>
  )
}

/**
 * Hoje você pode gastar: o menor entre o que o mês aguenta (guardando a sobra-alvo) e o que o saldo aguenta sem atrasar
 * nenhuma conta até o próximo dinheiro entrar (lib/planejador.ts). Mostra quanto já saiu hoje e quanto ainda dá.
 */
function HojePodeGastar({ a }: { a: DadosAnalise }) {
  const [ref, vivo] = useEmVista<HTMLElement>()
  const h = a.plano?.hoje
  if (!h) return null
  const passou = h.resta < 0
  const cheio = h.pode > 0 ? Math.min(1, h.gastou / h.pode) : h.gastou > 0 ? 1 : 0
  const tom = h.pode <= 0 || passou ? 'ruim' : cheio >= 0.8 ? 'medio' : 'bom'
  const ate = h.ate ? tx('até {0}, quando entra {1}', fmtDataCurta(h.ate.data), h.ate.descricao) : tx('até o fim do mês que vem')
  const semFolga = h.motivo === 'mes'
    ? tx('Pela previsão, o mês já fecha no vermelho: não há folga para o dia a dia. Segure o que der.')
    : h.ate
      ? tx('Até {0}, quando entra {1}, as contas já levam o dinheiro da conta. Segure o que der.', fmtDataCurta(h.ate.data), h.ate.descricao)
      : tx('Até o fim do mês que vem, as contas já levam o dinheiro da conta. Segure o que der.')
  const porque = [
    h.motivo === 'caixa'
      ? h.ate
        ? tx('Até {0}, quando entra {1}, vencem {2} em contas. Com o saldo de hoje, sobram {3} por dia sem atrasar nada.', fmtDataCurta(h.ate.data), h.ate.descricao, fmtValor(h.antesDoDinheiro), fmtValor(h.porDiaDoCaixa!))
        : tx('Não há dinheiro previsto para entrar até o fim do mês que vem. Com o saldo de hoje e {0} em contas até lá, sobram {1} por dia.', fmtValor(h.antesDoDinheiro), fmtValor(h.porDiaDoCaixa!))
      : h.pode > 0
        ? tx('Pela previsão do mês: tirando as contas e guardando {0}, o que sobra dividido pelos dias que faltam dá {1} por dia.', fmtValor(a.mes?.sobraAlvo ?? 0), fmtValor(h.porDiaDoMes ?? 0))
        : tx('Pela previsão do mês, depois das contas e do que é para guardar ({0}), não sobra nada para os dias que faltam.', fmtValor(a.mes?.sobraAlvo ?? 0)),
    h.motivo === 'caixa' && h.porDiaDoMes !== null && h.porDiaDoMes > (h.porDiaDoCaixa ?? 0)
      ? tx('Pelo mês inteiro daria {0} por dia, mas as contas vencem antes de o dinheiro chegar: por isso o número de hoje é menor.', fmtValor(Math.floor(h.porDiaDoMes)))
      : '',
    h.porDiaDoCaixa === null ? tx('Informe o saldo dos bancos para eu conferir também se o dinheiro chega antes das contas.') : '',
    tx('O número vale se o que entra e sai estiver lançado, e se refaz a cada lançamento. Renda extra não entra na conta.'),
  ].filter(Boolean).join(' ')
  return (
    <section ref={ref} className={`cartao vis an-hoje ${vivo ? 'vivo' : ''}`} style={{ '--c': COR_DO_TOM[tom], '--cheio': cheio } as CSSProperties}>
      <span className="an-hoje-rotulo"><Icone nome="carteira" tamanho={16} /> {tx('Hoje você pode gastar')}</span>
      <strong className="an-hoje-valor"><Numero valor={Math.max(0, h.pode)} formato={fmtValor} /></strong>
      <span className="an-hoje-ate">{h.pode > 0 ? tx('por dia, {0}', ate) : semFolga}</span>
      <div className="an-hoje-trilho" aria-hidden="true"><i /></div>
      <div className="an-hoje-pe">
        <span>{tx('Já gastou hoje: {0}', fmtValor(h.gastou))}</span>
        <b className={passou ? 'ruim' : ''}>{passou ? tx('Passou {0}', fmtValor(-h.resta)) : tx('Ainda dá {0}', fmtValor(h.resta))}</b>
      </div>
      <PorQue texto={porque} />
    </section>
  )
}

/** 1. Como estou: velocímetro da nota e a escada das fases. */
function ComoEstou({ a }: { a: DadosAnalise }) {
  const [ref, vivo] = useEmVista<HTMLElement>()
  const iFase = a.fases.findIndex((f) => f.id === a.fase)
  return (
    <section ref={ref} className={`cartao vis an-como ${vivo ? 'vivo' : ''}`} style={{ '--c': COR_DO_TOM[a.tom] } as CSSProperties}>
      <div className="an-como-topo">
        <Medidor valor={a.nota} tom={a.tom} />
        <div className="an-como-texto">
          <span className="an-rotulo">{a.rotulo}</span>
          <strong>{tx('Degrau {0} de 5', iFase + 1)}</strong>
          <span>{a.fases[iFase].nome}</span>
        </div>
      </div>
      <Escada fases={a.fases} atual={iFase} />
      <PorQue texto={a.temFluxo ? a.porqueFase : a.resumo[0]} />
    </section>
  )
}

/** 2. Faça agora: um passo por vez, com o ganho em destaque; as setas passam para o próximo. */
function FacaAgora({ a, aoIr }: { a: DadosAnalise; aoIr: Ctx['irPara'] }) {
  const [i, setI] = useState(0)
  const acoes = a.acoes
  if (!acoes.length) {
    return (
      <section className="cartao an-agora nivel-tudo-certo">
        <span className="an-agora-icone"><Icone nome="check" tamanho={24} /></span>
        <strong>{tx('Nada pedindo ação agora.')}</strong>
      </section>
    )
  }
  const x = acoes[Math.min(i, acoes.length - 1)]
  return (
    <section className={`cartao an-agora nivel-${x.urgencia}`} key={x.id}>
      <div className="an-agora-cab">
        <span className="an-agora-titulo">{tx('Faça agora')}</span>
        {acoes.length > 1 && (
          <span className="an-agora-nav">
            <button className="icone-btn" onClick={() => setI((i - 1 + acoes.length) % acoes.length)} aria-label={tx('Passo anterior')}><Icone nome="esq" tamanho={16} /></button>
            <span className="an-pontos" aria-label={tx('Passo {0} de {1}', i + 1, acoes.length)}>
              {acoes.map((p, k) => <i key={p.id} className={k === i ? 'atual' : ''} />)}
            </span>
            <button className="icone-btn" onClick={() => setI((i + 1) % acoes.length)} aria-label={tx('Próximo passo')}><Icone nome="dir" tamanho={16} /></button>
          </span>
        )}
      </div>
      <div className="an-agora-passo">
        <span className="an-agora-icone" aria-hidden="true"><Icone nome={x.icone} tamanho={24} /></span>
        <strong>{x.titulo}</strong>
      </div>
      {x.impacto && <span className="an-impacto"><Icone nome="sobe" tamanho={14} /> {x.impacto}</span>}
      <div className="an-agora-pe">
        <PorQue texto={x.porque} />
        <button className="btn primario" onClick={() => aoIr(x.destino)}>{x.botao} <Icone nome="seta" tamanho={15} /></button>
      </div>
    </section>
  )
}

/** 3. Como o mês fecha: o número grande e a cascata (entra, sai, fica). */
function SeuMes({ a }: { a: DadosAnalise }) {
  const m = a.mes!
  const passos = cascataDoMes(a)!
  const sobra = m.resultadoPrevisto >= 0
  return (
    <CartaoVisual v={{ id: 'mes', titulo: tx('Como {0} deve fechar', noMeioDaFrase(MESES_NOME[a.hoje.mes - 1])), frase: '', tom: sobra ? 'bom' : 'ruim' }}>
      <div className={`an-mes-numero ${sobra ? 'bom' : 'ruim'}`}>
        <small>{sobra ? tx('Deve sobrar') : tx('Pode faltar')}</small>
        <strong><Numero valor={Math.abs(m.resultadoPrevisto)} formato={fmtValor} /></strong>
      </div>
      <Grafico v={{ id: 'cascata', tipo: 'cascata', prioridade: 0, titulo: '', frase: '', passos }} />
      {m.rendaExtraMedia > 0 && <p className="an-nota-fraca">{tx('Sem contar renda extra (em média, {0} por mês).', fmtValor(m.rendaExtraMedia))}</p>}
    </CartaoVisual>
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

/** Só aparece quando algo mudou de fato: até 2 linhas, com seta para cima ou para baixo. */
function OQueMudou({ reanalise, desdeAVisita }: { reanalise: Ctx['reanalise']; desdeAVisita: { em: string; mudancas: Mudanca[] } | null }) {
  const lista = reanalise?.mudancas.length ? reanalise.mudancas : desdeAVisita?.mudancas ?? []
  if (!lista.length) return null
  return (
    <section className="cartao an-mudou">
      <span className="an-mudou-titulo">
        <Icone nome="historico" tamanho={14} />
        {reanalise?.mudancas.length ? tx('Mudou agora') : tx('Desde {0}', fmtDataCurta(desdeAVisita!.em.slice(0, 10)))}
      </span>
      <ul>
        {lista.slice(0, 2).map((m, i) => (
          <li key={i} className={m.tom}>
            <Icone nome={m.tom === 'bom' ? 'sobe' : m.tom === 'ruim' ? 'desce' : 'seta'} tamanho={15} />
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
