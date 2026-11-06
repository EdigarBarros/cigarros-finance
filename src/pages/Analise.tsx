import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { compararRetratos, retratoDe, type Analise as DadosAnalise, type Mudanca, type Retrato } from '../lib/analise'
import { cascataDoMes, fmtCurto, visuais, type Visual } from '../lib/visuais'
import { tracosDe, type Traco } from '../lib/jeito'
import { OBJETIVOS } from '../lib/memoria'
import { fmtDataCurta, fmtValor, MESES_NOME, noMeioDaFrase } from '../lib/format'
import { useMovimento } from '../lib/tema'
import { Icone } from '../components/Icone'
import { Interruptor } from '../components/ui'
import { Numero } from '../components/Numero'
import { Velocimetro, Vitrine, type Nivel, type Pilula } from '../components/Vitrine'
import { CartaoVisual, Escada, Grafico, Medidor, type AcoesDoCartao } from './AnaliseGraficos'
import { COR_DO_TOM, useEmVista } from './analiseApoio'
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
  const tracos = useMemo(() => tracosDe(a), [a])
  const feed = useFeed(c.idUsuario, lista)

  if (c.contaNova) {
    return (
      <div className="pagina analise">
        <Cabecalho nivel={nivel} />
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
      <Cabecalho nivel={nivel} tracos={nivel === 'simples' ? undefined : tracos} />
      <HojePodeGastar a={a} nivel={nivel} />
      <OQueMudou reanalise={c.reanalise} desdeAVisita={desdeAVisita} max={nivel === 'detalhado' ? 4 : 2} />
      {c.memoria.objetivo === null
        ? <EscolherObjetivo aoEscolher={c.escolherObjetivo} />
        : <OQueAprendi a={a} nivel={nivel} aoTrocar={() => c.escolherObjetivo(null)} />}

      {nivel === 'simples' ? (
        <div className="an-quadros simples">
          <FacaAgora a={a} aoIr={c.irPara} />
          <div className="an-dupla">
            <NotaCurta a={a} />
            {a.mes && <MesNaBalanca a={a} />}
          </div>
        </div>
      ) : (
        <div className={`an-quadros ${a.mes ? '' : 'sem-mes'}`}>
          <ComoEstou a={a} />
          {nivel === 'equilibrado' ? <FacaAgora a={a} aoIr={c.irPara} /> : null}
          {a.mes && <SeuMes a={a} />}
        </div>
      )}

      {nivel === 'detalhado' && <PlanoDeAcao a={a} aoIr={c.irPara} />}

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

function Cabecalho({ nivel, tracos }: { nivel: Nivel; tracos?: Traco[] }) {
  return (
    <header className="pagina-topo an-cabecalho">
      <div>
        <h1>{tx('Seu consultor')}</h1>
        <p className="sub">{nivel === 'simples' ? tx('O que importa hoje, num olhar.') : tx('Os gráficos se refazem a cada lançamento.')}</p>
      </div>
      {tracos && tracos.length > 0 && <SeuJeito tracos={tracos} />}
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
 * nenhuma conta até o próximo dinheiro entrar (lib/planejador.ts). Vira a vitrine da aba: o velocímetro mostra quanto do
 * dia já foi; as pílulas, quanto já saiu, quanto ainda dá e (fora do simples) a nota e o fim do mês.
 */
function HojePodeGastar({ a, nivel }: { a: DadosAnalise; nivel: Nivel }) {
  const h = a.plano?.hoje
  if (!h) return <VitrineSemPlano a={a} />
  const passou = h.resta < 0
  const cheio = h.pode > 0 ? Math.min(1, h.gastou / h.pode) : 1
  const tom = h.pode <= 0 || passou ? 'ruim' : cheio >= 0.8 ? 'medio' : 'bom'
  const ate = h.ate ? tx('até {0}, quando entra {1}', fmtDataCurta(h.ate.data), h.ate.descricao) : tx('até o fim do mês que vem')
  const semFolga = h.motivo === 'mes'
    ? tx('Pela previsão, o mês já fecha no vermelho. Segure o que der.')
    : tx('As contas já levam o dinheiro da conta. Segure o que der.')
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
  const pilulas: Pilula[] = [
    { icone: 'enviar', rotulo: tx('Já gastou hoje'), valor: fmtValor(h.gastou), cor: 'var(--an-ruim)' },
    { icone: passou ? 'desce' : 'check', rotulo: passou ? tx('Passou') : tx('Ainda dá'), valor: fmtValor(Math.abs(h.resta)), cor: COR_DO_TOM[passou ? 'ruim' : 'bom'], tom: passou ? 'ruim' : 'bom' },
  ]
  if (nivel !== 'simples' && a.mes) {
    const sobra = a.mes.resultadoPrevisto >= 0
    pilulas.push({ icone: 'calendario', rotulo: sobra ? tx('Mês deve sobrar') : tx('Mês pode faltar'), valor: fmtValor(Math.abs(a.mes.resultadoPrevisto)), cor: COR_DO_TOM[sobra ? 'bom' : 'ruim'], tom: sobra ? 'bom' : 'ruim' })
  }
  if (nivel === 'detalhado' && h.porDiaDoMes !== null) {
    pilulas.push({ icone: 'ano', rotulo: tx('Pelo mês inteiro'), valor: tx('{0}/dia', fmtValor(Math.max(0, Math.floor(h.porDiaDoMes)))), cor: 'var(--an-destino)' })
  }
  return (
    <Vitrine cor={COR_DO_TOM[tom]} className="an-vitrine"
      visual={
        <Velocimetro valor={cheio} cor={COR_DO_TOM[tom]}>
          <b className="an-vel-pct">{h.pode > 0 ? `${Math.round(cheio * 100)}%` : <Icone nome="escudo" tamanho={26} />}</b>
          <small className="an-vel-rot">{h.pode > 0 ? tx('do dia já foi') : tx('sem folga')}</small>
        </Velocimetro>
      }
      rotulo={<><Icone nome="carteira" tamanho={16} /> {tx('Hoje você pode gastar')}</>}
      valor={Math.max(0, h.pode)} formato={fmtValor}
      sub={h.pode > 0 ? tx('por dia, {0}', ate) : semFolga}
      pilulas={pilulas}>
      <div className="an-vitrine-porque"><PorQue texto={porque} /></div>
    </Vitrine>
  )
}

/** Sem o plano (falta saldo e agenda): a vitrine mostra a nota no lugar. */
function VitrineSemPlano({ a }: { a: DadosAnalise }) {
  return (
    <Vitrine cor={COR_DO_TOM[a.tom]} className="an-vitrine"
      visual={<div className="an-vitrine-medidor"><Medidor valor={a.nota} tom={a.tom} /></div>}
      rotulo={<><Icone nome="bussola" tamanho={16} /> {tx('Como está seu dinheiro')}</>}
      texto={a.rotulo}
      sub={a.resumo[0]} />
  )
}

/** Como estou: velocímetro da nota e a escada das fases. */
function ComoEstou({ a }: { a: DadosAnalise }) {
  const [ref, vivo] = useEmVista<HTMLElement>()
  const iFase = a.fases.findIndex((f) => f.id === a.fase)
  return (
    <section ref={ref} className={`cartao vis an-como ${vivo ? 'vivo' : ''}`} style={{ '--c': COR_DO_TOM[a.tom] } as CSSProperties}>
      <header className="vis-cab"><h3>{tx('Como estou')}</h3><span className="an-rotulo">{a.rotulo}</span></header>
      <div className="an-como-topo">
        <Medidor valor={a.nota} tom={a.tom} />
        <div className="an-como-texto">
          <strong>{tx('Degrau {0} de 5', iFase + 1)}</strong>
          <span>{a.fases[iFase].nome}</span>
        </div>
      </div>
      <Escada fases={a.fases} atual={iFase} />
      <PorQue texto={a.temFluxo ? a.porqueFase : a.resumo[0]} />
    </section>
  )
}

/** No simples: a nota e o degrau num quadro pequeno, sem a escada inteira. */
function NotaCurta({ a }: { a: DadosAnalise }) {
  const [ref, vivo] = useEmVista<HTMLElement>()
  const iFase = a.fases.findIndex((f) => f.id === a.fase)
  return (
    <section ref={ref} className={`cartao vis an-nota ${vivo ? 'vivo' : ''}`} style={{ '--c': COR_DO_TOM[a.tom] } as CSSProperties}>
      <header className="vis-cab"><h3>{tx('Sua nota')}</h3><span className="an-rotulo">{a.rotulo}</span></header>
      <Medidor valor={a.nota} tom={a.tom} />
      <ol className="an-degraus" aria-label={tx('Degrau {0} de 5', iFase + 1)}>
        {a.fases.map((f, i) => <li key={f.id} className={i < iFase ? 'feito' : i === iFase ? 'atual' : ''} style={{ '--i': i } as CSSProperties} title={f.nome} />)}
      </ol>
      <span className="an-nota-fase">{a.fases[iFase].nome}</span>
    </section>
  )
}

/** No simples: como o mês fecha numa balança de duas barras (entra × sai) e o número do que fica. */
function MesNaBalanca({ a }: { a: DadosAnalise }) {
  const [ref, vivo] = useEmVista<HTMLElement>()
  const m = a.mes!
  const sobra = m.resultadoPrevisto >= 0
  const maior = Math.max(1, m.entradasPrevistas, m.saidasPrevistas)
  return (
    <section ref={ref} className={`cartao vis an-balanca ${vivo ? 'vivo' : ''}`} style={{ '--c': COR_DO_TOM[sobra ? 'bom' : 'ruim'] } as CSSProperties}>
      <header className="vis-cab"><h3>{tx('Como {0} deve fechar', noMeioDaFrase(MESES_NOME[a.hoje.mes - 1]))}</h3></header>
      <div className={`an-mes-numero ${sobra ? 'bom' : 'ruim'}`}>
        <small>{sobra ? tx('Deve sobrar') : tx('Pode faltar')}</small>
        <strong><Numero valor={Math.abs(m.resultadoPrevisto)} formato={fmtValor} /></strong>
      </div>
      <div className="an-balanca-barras">
        <span className="entra"><Icone nome="receber" tamanho={15} /><i style={{ width: `${(m.entradasPrevistas / maior) * 100}%` }} /><b>{fmtCurto(m.entradasPrevistas)}</b></span>
        <span className="sai"><Icone nome="enviar" tamanho={15} /><i style={{ width: `${(m.saidasPrevistas / maior) * 100}%` }} /><b>{fmtCurto(m.saidasPrevistas)}</b></span>
      </div>
    </section>
  )
}

/** Faça agora: um passo por vez, com o ganho em destaque; as setas passam para o próximo. */
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
    <section className={`cartao an-agora nivel-${x.urgencia}`}>
      <div className="an-agora-cab">
        <span className="an-agora-titulo"><Icone nome="ideia" tamanho={15} /> {tx('Faça agora')}</span>
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
      <div className="an-agora-passo" key={x.id}>
        <span className="an-agora-icone" aria-hidden="true"><Icone nome={x.icone} tamanho={26} /></span>
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

/** Como o mês fecha: o número grande e a cascata (entra, sai, fica). */
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

/**
 * "O que você quer agora?": o objetivo guia o consultor (a ordem do plano e o resumo). Aparece até a pessoa escolher, e
 * volta quando ela toca em "Trocar".
 */
function EscolherObjetivo({ aoEscolher }: { aoEscolher: Ctx['escolherObjetivo'] }) {
  return (
    <section className="cartao an-objetivo">
      <div className="an-objetivo-cab">
        <span className="an-objetivo-icone"><Icone nome="bussola" tamanho={20} /></span>
        <div>
          <h2>{tx('O que você quer agora?')}</h2>
          <p>{tx('Escolha o que mais importa para você hoje. O consultor muda a ordem do plano e o que ele fala. Dá para trocar quando quiser.')}</p>
        </div>
      </div>
      <div className="an-objetivo-opcoes">
        {OBJETIVOS.map((o) => (
          <button key={o.id} className="an-objetivo-opcao" onClick={() => aoEscolher(o.id)}>
            <Icone nome={o.icone} tamanho={18} />
            <span><strong>{o.nome()}</strong><small>{o.descricao()}</small></span>
          </button>
        ))}
      </div>
    </section>
  )
}

/** O objetivo escolhido, onde a pessoa está em relação a ele e o que o consultor aprendeu conferindo os passos do plano. */
function OQueAprendi({ a, nivel, aoTrocar }: { a: DadosAnalise; nivel: Nivel; aoTrocar: () => void }) {
  const ap = a.aprendizado
  if (!ap.objetivo) return null
  const objetivo = OBJETIVOS.find((o) => o.id === ap.objetivo)
  const detalhes = nivel !== 'simples'
  return (
    <section className="cartao an-aprendi">
      <div className="an-aprendi-cab">
        <span className="an-aprendi-objetivo"><Icone nome={objetivo?.icone ?? 'bussola'} tamanho={14} /> {objetivo?.nome()}</span>
        <button className="link" onClick={aoTrocar}>{tx('Trocar')}</button>
      </div>
      {ap.frase && <p className="an-aprendi-frase">{ap.frase}</p>}
      {ap.vitorias.length > 0 && (
        <ul className="an-aprendi-lista bom" aria-label={tx('O que deu certo')}>
          {ap.vitorias.map((t, i) => <li key={i}><Icone nome="check" tamanho={14} /> {t}</li>)}
        </ul>
      )}
      {detalhes && ap.ajustes.length > 0 && (
        <ul className="an-aprendi-lista medio" aria-label={tx('O que não deu certo')}>
          {ap.ajustes.map((t, i) => <li key={i}><Icone nome="desfazer" tamanho={14} /> {t} {tx('O próximo passo vem menor.')}</li>)}
        </ul>
      )}
      {detalhes && ap.acompanhando.length > 0 && (
        <details className="an-aprendi-acompanha">
          <summary>{ap.acompanhando.length === 1 ? tx('Acompanhando 1 passo do plano') : tx('Acompanhando {0} passos do plano', ap.acompanhando.length)}</summary>
          <ul>
            {ap.acompanhando.map((x, i) => <li key={i}>{tx('{0} Confiro quando {1} fechar.', x.titulo, noMeioDaFrase(MESES_NOME[x.mes - 1]))}</li>)}
          </ul>
        </details>
      )}
    </section>
  )
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

