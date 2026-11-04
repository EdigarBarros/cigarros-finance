import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { compararRetratos, retratoDe, type Analise as DadosAnalise, type Mudanca, type Retrato } from '../lib/analise'
import { cascataDoMes, perfilFinanceiro, visuais } from '../lib/visuais'
import { fmtDataCurta, fmtValor, MESES_NOME, noMeioDaFrase } from '../lib/format'
import { useMovimento } from '../lib/tema'
import { Icone } from '../components/Icone'
import { Interruptor } from '../components/ui'
import { Numero } from '../components/Numero'
import { CartaoVisual, Escada, Grafico, Medidor } from './AnaliseGraficos'
import { COR_DO_TOM, useEmVista, usePreferenciasVisuais } from './analiseApoio'
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
  const prefs = usePreferenciasVisuais(c.idUsuario)
  // a ordem é do motor (importância e o jeito da pessoa), mais o uso: favoritos no topo, o que ela mais toca sobe
  const lista = useMemo(() => visuais(a)
    .filter((v) => !prefs.escondidos.includes(v.id))
    .map((v) => ({ v, nota: v.prioridade + prefs.peso(v.id) }))
    .sort((x, y) => y.nota - x.nota)
    .map(({ v }) => v), [a, prefs]) // eslint-disable-line react-hooks/exhaustive-deps
  const naFrente = Math.max(GRAFICOS_NA_FRENTE[c.perfil.detalhe], prefs.favoritos.filter((f) => lista.some((v) => v.id === f)).length)
  const vistos = todos ? lista : lista.slice(0, naFrente)

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
      <ComoEstou a={a} />
      {a.mes && <HojePodeGastar a={a} />}
      <OQueMudou reanalise={c.reanalise} desdeAVisita={desdeAVisita} />
      <FacaAgora a={a} aoIr={c.irPara} />
      {a.mes && <SeuMes a={a} />}

      <div className="an-feed">
        {vistos.map((v) => (
          <CartaoVisual key={v.id} v={v} aoIr={c.irPara}
            prefs={{ favorito: prefs.favoritos.includes(v.id), aoFavoritar: () => prefs.favoritar(v.id), aoEsconder: () => prefs.esconder(v.id), aoTocar: () => prefs.tocar(v.id) }}>
            <Grafico v={v} />
          </CartaoVisual>
        ))}
      </div>
      {lista.length > naFrente && (
        <button className="btn an-mais" onClick={() => setTodos(!todos)}>
          <Icone nome={todos ? 'cima' : 'ano'} tamanho={17} />
          {todos ? tx('Mostrar menos') : tx('Ver mais {0} gráficos', lista.length - naFrente)}
        </button>
      )}
      {prefs.escondidos.length > 0 && (
        <button className="link an-escondidos" onClick={prefs.mostrarTodos}>
          {prefs.escondidos.length === 1 ? tx('Mostrar o gráfico escondido') : tx('Mostrar os {0} gráficos escondidos', prefs.escondidos.length)}
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

/** 1. Como estou: velocímetro da nota e a escada das fases. */
function ComoEstou({ a }: { a: DadosAnalise }) {
  const [ref, vivo] = useEmVista<HTMLElement>()
  const iFase = a.fases.findIndex((f) => f.id === a.fase)
  const tracos = perfilFinanceiro(a).rotulos
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
      {tracos.length > 0 && (
        <div className="an-tracos" aria-label={tx('Seu jeito com o dinheiro')}>
          {tracos.map((t) => <span key={t}>{t}</span>)}
        </div>
      )}
      <PorQue texto={a.temFluxo ? a.porqueFase : a.resumo[0]} />
    </section>
  )
}

/**
 * Hoje você pode gastar: o orçamento do dia a dia, refeito todo dia e a cada lançamento. É o que sobra do mês depois das
 * contas, parcelas, faturas e da sobra que o plano guarda, dividido pelos dias que faltam; a barra mostra quanto já foi.
 */
function HojePodeGastar({ a }: { a: DadosAnalise }) {
  const [ref, vivo] = useEmVista<HTMLElement>()
  const m = a.mes!
  const limite = Math.max(0, Math.floor(m.porDia))
  const gasto = m.gastoHoje
  const resta = Math.max(0, limite - gasto)
  const passou = limite > 0 && gasto > limite
  const p = limite > 0 ? Math.min(1, gasto / limite) : 1
  return (
    <section ref={ref} className={`cartao vis an-hoje ${vivo ? 'vivo' : ''} ${limite <= 0 ? 'sem' : passou ? 'passou' : ''}`}>
      <div className="an-hoje-topo">
        <span className="an-hoje-icone" aria-hidden="true"><Icone nome="carteira" tamanho={22} /></span>
        <div>
          <small>{limite > 0 ? tx('Hoje você pode gastar') : tx('Hoje')}</small>
          <strong>{limite > 0 ? <Numero valor={limite} formato={fmtValor} /> : tx('Segure os gastos')}</strong>
        </div>
      </div>
      {limite > 0 && (
        <>
          <div className="an-hoje-barra" role="img" aria-label={tx('Já foram {0} de {1}', fmtValor(gasto), fmtValor(limite))}>
            <i style={{ width: `${p * 100}%` }} />
          </div>
          <div className="an-hoje-linha">
            <span>{tx('Já foram {0}', fmtValor(gasto))}</span>
            <b>{passou ? tx('Passou {0}', fmtValor(gasto - limite)) : tx('Ainda dá {0}', fmtValor(resta))}</b>
          </div>
        </>
      )}
      <PorQue texto={limite > 0
        ? tx('Do que entra até o fim do mês, já tirei as contas, parcelas e faturas que ainda vêm e {0} para guardar. O resto, dividido pelos {1} dias que faltam, dá {2} por dia para Uber, café, mercado e o resto do dia a dia. Gastou menos hoje? Amanhã o valor sobe. Não conta renda extra que ainda não foi lançada.',
          fmtValor(m.sobraAlvo), m.diasNoMes - m.dia + 1, fmtValor(limite))
        : tx('O que entra até o fim do mês mal cobre as contas, parcelas e faturas que ainda vêm. Cada gasto do dia a dia agora sai do que estava guardado ou vira atraso.')} />
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
        <span className={`an-dia ${m.porDia > 0 ? '' : 'sem'}`}>
          <Icone nome={m.porDia > 0 ? 'carteira' : 'escudo'} tamanho={15} />
          {m.porDia > 0 ? tx('Pode gastar até {0} por dia', fmtValor(Math.floor(m.porDia))) : tx('Sem folga para o dia a dia')}
        </span>
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
