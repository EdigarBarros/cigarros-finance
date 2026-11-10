/**
 * A tela viva do Consultor: a parte que é montada para cada pessoa (veja docs/arquitetura-do-painel.md, seção 4.7).
 *
 * lib/achados.ts diz o que há para contar, lib/composicao.ts decide a ordem, o desenho e o tamanho de cada cartão, e
 * lib/gosto.ts aprende com o que a pessoa faz aqui. Este arquivo só mostra e anota:
 *  - a **manchete**: a descoberta mais importante de hoje, grande, no topo da aba;
 *  - as **faixas**: as outras, em cartões de larguras diferentes (6 colunas no computador, uma no celular);
 *  - em cada cartão: "Outro jeito" (troca o desenho e ensina o gosto), favoritar, esconder e o atalho para a tela certa.
 *
 * Os sinais (viu, tocou, abriu, favoritou, escondeu, trocou) ficam na memória da visita e são gravados ao sair da aba,
 * para a tela não se refazer debaixo do dedo.
 */
import { Component, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { Analise } from '../lib/analise'
import { achados, type Achado, type Tema } from '../lib/achados'
import { compor, diagramar, type Escolhas, type Peca } from '../lib/composicao'
import { registrarErro } from '../lib/erros'
import { afinidade, comOrdem, mostrarDeNovo, registrar, type Gosto, type Sinal } from '../lib/gosto'
import { tx } from '../lib/textos'
import { Icone } from '../components/Icone'
import { type Nivel } from '../components/Vitrine'
import { Grafico } from './AnaliseGraficos'
import { COR_DO_TOM, useEmVista } from './analiseApoio'
import type { Ctx } from './contexto'

/** Quantos cartões aparecem depois da manchete, antes de "Ver mais". */
const NA_FRENTE = { simples: 2, equilibrado: 5, detalhado: 99 } as const

export interface TemaDaTela { id: Tema; icone: string; nome: () => string }

const TEMAS: TemaDaTela[] = [
  { id: 'mes', icone: 'calendario', nome: () => tx('O mês') },
  { id: 'gastos', icone: 'carteira', nome: () => tx('Gastos') },
  { id: 'dividas', icone: 'divida', nome: () => tx('Dívidas') },
  { id: 'guardado', icone: 'cofre', nome: () => tx('Guardado') },
  { id: 'como', icone: 'bussola', nome: () => tx('Como estou') },
]

/** Favoritos e escondidos da versão anterior do feed (ficavam só no navegador): entram no gosto na primeira visita. */
function doFeedAntigo(idUsuario: string): { fav: string[]; oculto: string[] } {
  try {
    const lido = JSON.parse(localStorage.getItem(`opuscash:feed:${idUsuario}`) ?? 'null') as { fav?: unknown; oculto?: unknown } | null
    const textos = (x: unknown) => (Array.isArray(x) ? x.filter((t): t is string => typeof t === 'string') : [])
    return { fav: textos(lido?.fav), oculto: textos(lido?.oculto) }
  } catch { return { fav: [], oculto: [] } }
}

/**
 * A tela montada e o que a pessoa pode fazer com ela. O gosto usado para montar é o da abertura da aba; o que ela faz
 * agora vale na hora só para o que ela mesma pediu (favoritar, esconder, trocar o desenho) e é gravado ao sair.
 */
export function useTelaViva(c: Ctx, a: Analise) {
  const lista = useMemo(() => achados(a), [a])
  return useTelaVivaDe({ lista, gosto: c.gosto, salvar: c.salvarGosto, temas: TEMAS, antigo: () => doFeedAntigo(c.idUsuario) })
}

/**
 * A mesma tela viva para qualquer lista de descobertas (o Invest usa esta, com o gosto e os assuntos dele).
 * `antigo`: favoritos e escondidos de uma versão anterior, para quem ainda não tem gosto anotado.
 */
export function useTelaVivaDe(o: { lista: Achado[]; gosto: Gosto; salvar: (g: Gosto) => void; temas: TemaDaTela[]; antigo?: () => { fav: string[]; oculto: string[] } }) {
  const c = { gosto: o.gosto, salvarGosto: o.salvar }
  const [base, setBase] = useState<Gosto>(() => {
    if (c.gosto.total > 0) return c.gosto
    const antigo = o.antigo?.() ?? { fav: [], oculto: [] }
    return antigo.fav.length || antigo.oculto.length ? { ...c.gosto, ...antigo } : c.gosto
  })
  const vivo = useRef(base)
  const sujo = useRef(base !== c.gosto)
  const jaContou = useRef(new Set<string>())
  const telaAgora = useRef({ ordem: base.ordem, desenhos: base.desenhos })
  const [escolhas, setEscolhas] = useState<Escolhas>({ fav: base.fav, oculto: base.oculto, formas: {} })

  const salvar = useRef(c.salvarGosto)
  useEffect(() => { salvar.current = c.salvarGosto })
  // o gosto chegou do banco depois de a aba abrir (outro aparelho sabia mais): passa a ser a base do que se anota aqui
  useEffect(() => {
    if (!sujo.current && c.gosto.total > vivo.current.total) vivo.current = c.gosto
  }, [c.gosto])
  useEffect(() => {
    const gravar = () => {
      // a ordem desta visita é o ponto de partida da próxima: a pessoa encontra as coisas onde deixou
      const comAOrdem = comOrdem(vivo.current, telaAgora.current.ordem, telaAgora.current.desenhos)
      if (!sujo.current && comAOrdem === vivo.current) return
      vivo.current = comAOrdem
      sujo.current = false
      salvar.current(vivo.current)
    }
    const aoEsconder = () => { if (document.visibilityState === 'hidden') gravar() }
    window.addEventListener('pagehide', gravar)
    document.addEventListener('visibilitychange', aoEsconder)
    return () => {
      gravar()
      window.removeEventListener('pagehide', gravar)
      document.removeEventListener('visibilitychange', aoEsconder)
    }
  }, [])

  const lista = o.lista
  const tela = useMemo(() => compor(lista, base, escolhas), [lista, base, escolhas])
  useEffect(() => { telaAgora.current = tela }, [tela])

  const anotar = (sinal: Sinal, p: Peca, para?: string) => {
    // ver e tocar contam uma vez por visita em cada cartão
    if (sinal === 'viu' || sinal === 'tocou') {
      const chave = `${sinal}|${p.achado.id}`
      if (jaContou.current.has(chave)) return
      jaContou.current.add(chave)
    }
    vivo.current = registrar(vivo.current, { sinal, achado: p.achado.id, tema: p.achado.tema, forma: p.visual.tipo, versao: p.versao, medida: p.medida, para }, new Date())
    sujo.current = true
    if (sinal === 'favoritou' || sinal === 'escondeu') setEscolhas((e) => ({ ...e, fav: vivo.current.fav, oculto: vivo.current.oculto }))
    if (sinal === 'trocou' && para) setEscolhas((e) => ({ ...e, formas: { ...e.formas, [p.achado.id]: para } }))
  }
  const mostrar = (id: string) => {
    vivo.current = mostrarDeNovo(vivo.current, id)
    sujo.current = true
    setEscolhas((e) => ({ ...e, oculto: vivo.current.oculto }))
  }
  /** O assunto de que a pessoa mais gosta, quando já dá para dizer. */
  const temas = o.temas
  const preferido = useMemo(() => {
    const melhor = temas.map((t) => ({ t, af: afinidade(base.temas, t.id), bom: base.temas[t.id]?.[1] ?? 0 }))
      .filter((x) => x.bom >= 3 && x.af >= 0.3).sort((x, y) => y.af - x.af)[0]
    return melhor?.t ?? null
  }, [base, temas])
  /** Volta a uma organização guardada (ordem, desenhos, favoritos e escondidos), na hora. */
  const restaurar = (x: { ordem: string[]; desenhos: Record<string, string>; fav: string[]; oculto: string[] }) => {
    vivo.current = { ...vivo.current, ...x, total: vivo.current.total + 1 }
    sujo.current = false
    telaAgora.current = { ordem: x.ordem, desenhos: x.desenhos }
    salvar.current(vivo.current)
    setBase(vivo.current)
    setEscolhas({ fav: x.fav, oculto: x.oculto, formas: {} })
  }
  return { tela, anotar, mostrar, preferido, temas, restaurar }
}

export type Tela = ReturnType<typeof useTelaVivaDe>
/** Para onde a seta de um cartão leva (e o que o "Por quê?" abre): quem usa a tela decide. */
export interface AcoesDaTela { aoIr: (a: Achado) => void; aoExplicar?: (a: Achado) => void }

/** Chama `aoVer` quando o desenho fica na tela por um instante (tempo de ler), uma vez só. */
function useVisto<T extends Element>(aoVer: () => void) {
  const ref = useRef<T>(null)
  const chamar = useRef(aoVer)
  useEffect(() => { chamar.current = aoVer })
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    let espera: ReturnType<typeof setTimeout> | undefined
    let lendo = false
    const o = new IntersectionObserver(([e]) => {
      // metade do desenho na tela, ou (num desenho mais alto que a tela) metade da tela tomada por ele
      const agora = e.isIntersecting && (e.intersectionRatio >= 0.5 || e.intersectionRect.height >= (e.rootBounds?.height ?? window.innerHeight) * 0.5)
      if (agora === lendo) return
      lendo = agora
      clearTimeout(espera)
      if (agora) espera = setTimeout(() => { chamar.current(); o.disconnect() }, 1200)
    }, { threshold: [0, 0.25, 0.5, 0.75, 1] })
    o.observe(el)
    return () => { clearTimeout(espera); o.disconnect() }
  }, [])
  return ref
}

/**
 * Cada desenho fica isolado: se um deles falhar, só aquele cartão mostra um aviso (e o erro é registrado); o resto da
 * tela continua de pé.
 */
class DesenhoSeguro extends Component<{ id: string; children: ReactNode }, { quebrou: boolean }> {
  state = { quebrou: false }
  static getDerivedStateFromError() { return { quebrou: true } }
  componentDidCatch(erro: Error) { registrarErro(erro, `consultor ${this.props.id}`) }
  render() {
    if (!this.state.quebrou) return this.props.children
    return <p className="peca-falhou"><Icone nome="escudo" tamanho={16} /> {tx('Não deu para desenhar este gráfico agora. O resto da tela continua valendo.')}</p>
  }
}

/** Um cartão da tela: a descoberta, o desenho escolhido e o que dá para fazer com ele. */
function Cartao({ p, largura, indice, manchete, t, aoIr, aoExplicar }: { p: Peca; largura: number; indice: number; manchete?: boolean; t: Tela } & AcoesDaTela) {
  const [refVivo, vivo] = useEmVista<HTMLElement>()
  const refVisto = useVisto<HTMLDivElement>(() => t.anotar('viu', p))
  const fav = t.tela.pecas.indexOf(p) < t.tela.favoritos
  const a = p.achado
  const proxima = p.formas.length > 1 ? p.formas[(p.formas.indexOf(p.visual.tipo) + 1) % p.formas.length] : null
  const temDestino = Boolean(a.destino || a.porQue?.acao)
  const abrir = () => { t.anotar('abriu', p); aoIr(a) }
  // um cartão compacto sozinho na faixa deita: texto de um lado, desenho do outro
  const deitado = manchete || (largura === 6 && !p.largo)
  return (
    <section ref={refVivo} className={`cartao vis peca ${vivo ? 'vivo' : ''} ${fav ? 'fav' : ''} ${manchete ? 'an-manchete' : ''} ${deitado ? 'deitado' : ''} ${p.largo ? 'largo' : 'compacto'}`}
      style={{ '--c': a.tom ? COR_DO_TOM[a.tom] : 'var(--destaque)', '--l': largura, '--i': Math.min(indice, 8) } as CSSProperties}>
      {manchete && <span className="an-manchete-luz" aria-hidden="true" />}
      <div className="peca-texto">
        {(manchete || p.novidade || p.importante) && (
          <span className="peca-selos">
            {manchete && <span className="peca-selo destaque"><Icone nome="ideia" tamanho={13} /> {tx('Destaque de hoje')}</span>}
            {p.importante && !manchete && <span className="peca-selo">{tx('Importante')}</span>}
            {p.novidade && <span className="peca-selo">{p.novidade === 'novo' ? tx('Novo') : tx('Mudou')}</span>}
          </span>
        )}
        <header className="vis-cab">
          <h3>{a.titulo}</h3>
          {temDestino && !manchete && <button className="vis-ir" onClick={abrir} aria-label={a.porQue?.acao?.rotulo ?? tx('Abrir')} title={a.porQue?.acao?.rotulo}><Icone nome="dir" tamanho={18} /></button>}
        </header>
        {a.frase && <p className="vis-frase">{a.frase}</p>}
        {manchete && temDestino && <button className="btn primario peca-abrir" onClick={abrir}>{a.porQue?.acao?.rotulo ?? tx('Ver de perto')} <Icone nome="seta" tamanho={15} /></button>}
      </div>
      <div ref={refVisto} className="vis-corpo" onPointerUp={() => t.anotar('tocou', p)}>
        <DesenhoSeguro key={p.visual.tipo} id={`${a.id}:${p.visual.tipo}`}><Grafico v={p.visual} /></DesenhoSeguro>
      </div>
      <footer className="peca-pe">
        {proxima && (
          <button className="peca-trocar" onClick={() => t.anotar('trocou', p, proxima)} title={tx('Mostrar este dado em outro desenho')}>
            <Icone nome="trocar" tamanho={14} /> {tx('Outro jeito')}
          </button>
        )}
        {a.porQue && aoExplicar && (
          <button className="peca-trocar peca-porque" onClick={() => { t.anotar('tocou', p); aoExplicar(a) }}>
            <Icone nome="ideia" tamanho={14} /> {tx('Por que estou vendo isso?')}
          </button>
        )}
        <span className="peca-acoes">
          <button className={`vis-ir vis-fav ${fav ? 'ligado' : ''}`} onClick={() => t.anotar('favoritou', p)} aria-pressed={fav}
            aria-label={fav ? tx('Tirar dos favoritos') : tx('Favoritar: fica no topo')} title={fav ? tx('Tirar dos favoritos') : tx('Favoritar: fica no topo')}>
            <Icone nome="estrela" tamanho={15} />
          </button>
          {/* o que é importante não se esconde: é a informação de que a pessoa mais precisa */}
          {!p.importante && (
            <button className="vis-ir" onClick={() => t.anotar('escondeu', p)} aria-label={tx('Esconder este gráfico')} title={tx('Esconder este gráfico')}>
              <Icone nome="olho-fechado" tamanho={15} />
            </button>
          )}
        </span>
      </footer>
    </section>
  )
}

/** A descoberta mais importante de hoje, grande, no topo da aba. */
export function Manchete({ t, aoIr, aoExplicar }: { t: Tela } & AcoesDaTela) {
  const p = t.tela.pecas[0]
  if (!p) return null
  return <Cartao key={p.achado.id} p={p} largura={6} indice={0} manchete t={t} aoIr={aoIr} aoExplicar={aoExplicar} />
}

/** As outras descobertas, em faixas de cartões de larguras diferentes, com as abas por assunto e "Ver mais". */
export function Faixas({ t, aoIr, aoExplicar, nivel, depois }: { t: Tela; nivel: Nivel; /** Um atalho no fim da seção (o Invest põe o "desfazer a reorganização"). */ depois?: ReactNode } & AcoesDaTela) {
  const [tema, setTema] = useState<Tema | 'tudo'>('tudo')
  const [todos, setTodos] = useState(false)
  // em "Tudo", a primeira já está no topo da aba (a manchete); num assunto, aparecem todas as dele
  const doTema = tema === 'tudo' ? t.tela.pecas.slice(1) : t.tela.pecas.filter((p) => p.achado.tema === tema)
  const naFrente = Math.max(NA_FRENTE[nivel], t.tela.favoritos - 1)
  const vistos = todos || tema !== 'tudo' ? doTema : doTema.slice(0, naFrente)
  // a diagramação só se refaz quando muda o que está na tela (os cartões ou o desenho de algum)
  const chave = vistos.map((p) => `${p.achado.id}:${p.visual.tipo}`).join()
  const larguras = useMemo(() => diagramar(vistos), [chave]) // eslint-disable-line react-hooks/exhaustive-deps
  const temTema = (id: Tema) => t.tela.pecas.some((p) => p.achado.tema === id)
  if (t.tela.pecas.length <= 1 && !t.tela.escondidos.length) return null
  return (
    <section className="an-feed-area">
      <div className="an-feed-cab">
        <h2 className="vt-secao">
          <span className="vt-secao-ic"><Icone nome="ideia" tamanho={16} /></span>
          <span>{tx('Montado para você')}</span>
        </h2>
        {nivel !== 'simples' && t.tela.pecas.length > 2 && (
          <div className="an-abas" role="tablist" aria-label={tx('Assunto')}>
            <button role="tab" aria-selected={tema === 'tudo'} className={tema === 'tudo' ? 'ativo' : ''} onClick={() => setTema('tudo')}>{tx('Tudo')}</button>
            {t.temas.filter((s) => temTema(s.id)).map((s) => (
              <button key={s.id} role="tab" aria-selected={tema === s.id} className={tema === s.id ? 'ativo' : ''} onClick={() => setTema(s.id)}>
                <Icone nome={s.icone} tamanho={14} /> {s.nome()}
              </button>
            ))}
          </div>
        )}
      </div>
      <p className="an-tela-sub">
        {tx('Esta tela é só sua. Cada coisa fica no seu lugar e só muda quando há novidade nos seus números.')}
        {t.preferido && <span className="an-tela-aprendi"><Icone nome="check" tamanho={13} /> {tx('Aprendi que você olha mais: {0}', t.preferido.nome())}</span>}
      </p>
      {vistos.length > 0 && (
        <div className="an-tela" key={tema}>
          {vistos.map((p, i) => <Cartao key={p.achado.id} p={p} largura={larguras[i] ?? 6} indice={i} t={t} aoIr={aoIr} aoExplicar={aoExplicar} />)}
        </div>
      )}
      {tema === 'tudo' && doTema.length > naFrente && (
        <button className="btn an-mais" onClick={() => setTodos(!todos)}>
          <Icone nome={todos ? 'cima' : 'ano'} tamanho={17} />
          {todos ? tx('Mostrar menos') : doTema.length - naFrente === 1 ? tx('Ver mais 1 descoberta') : tx('Ver mais {0} descobertas', doTema.length - naFrente)}
        </button>
      )}
      <Escondidos t={t} />
      {depois}
    </section>
  )
}

function Escondidos({ t }: { t: Tela }) {
  const [ver, setVer] = useState(false)
  const lista = t.tela.escondidos
  if (!lista.length) return null
  return (
    <section className="an-escondidos">
      <button className="link" onClick={() => setVer(!ver)} aria-expanded={ver}>
        <Icone nome="olho-fechado" tamanho={15} />
        {lista.length === 1 ? tx('1 gráfico escondido') : tx('{0} gráficos escondidos', lista.length)}
        <Icone nome={ver ? 'cima' : 'abaixo'} tamanho={14} />
      </button>
      {ver && (
        <ul>
          {lista.map((a) => (
            <li key={a.id}>
              <span>{a.titulo}</span>
              <button className="btn" onClick={() => t.mostrar(a.id)}><Icone nome="olho" tamanho={15} /> {tx('Mostrar de novo')}</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
