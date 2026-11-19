import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { compararRetratos, retratoDe, type Acao, type Analise as DadosAnalise, type EtapaDoPlano, type Mudanca, type Retrato } from '../lib/analise'
import { fmtDataCurta } from '../lib/format'
import { useMovimento } from '../lib/tema'
import { Icone } from '../components/Icone'
import { Interruptor } from '../components/ui'
import { useEmVista } from './analiseApoio'
import { Agora, Objetivo, ProximoPasso, SeuPerfil } from './AnaliseTopo'
import { Faixas, Manchete, useTelaViva } from './AnaliseTela'
import { CartaoDoPlanejamento, Planejamento } from '../components/Planejamento'
import type { Ctx } from './contexto'
import { tx } from '../lib/textos'
import './analise.css'

/**
 * Consultor financeiro: a análise de lib/analise.ts em forma de gráficos, refeita a cada mudança nos dados.
 * No topo, a manchete: a descoberta mais importante de hoje para esta pessoa. Depois, os blocos de sempre (perfil, agora,
 * próximo passo, objetivo) e a tela viva: as outras descobertas, com o desenho e o tamanho que o compositor escolheu
 * (pages/AnaliseTela.tsx; veja docs/arquitetura-do-painel.md, seção 4.7). O jeito de ver muda o quanto aparece:
 * - simples: 2 cartões depois da manchete e "Ver mais", sem abas;
 * - equilibrado: 5 cartões, abas por assunto;
 * - detalhado: todos, o plano de ação inteiro em lista.
 */
export function Analise(c: Ctx) {
  const a = c.analise
  const nivel = c.perfil.detalhe
  const movimento = useMovimento()
  const desdeAVisita = useDesdeAUltimaVisita(c.idUsuario, a)
  const tela = useTelaViva(c, a)
  const [planejando, setPlanejando] = useState(false)
  // os passos do plano que falam do Planejamento (destino 'analise') abrem a mesa em vez de navegar
  const irPara: Ctx['irPara'] = (p) => (p === 'analise' ? setPlanejando(true) : c.irPara(p))
  const montando = useMontagem(c.reanalise, desdeAVisita) && !c.contaNova

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
    <div className={`pagina analise an-${nivel} ${movimento === 'reduzido' ? 'parado' : ''} ${montando ? 'montando' : ''}`}>
      {montando && <span className="an-varredura" aria-hidden="true" />}
      <header className="pagina-topo an-cabecalho">
        <div>
          <h1>{tx('Seu consultor')}</h1>
          <p className="sub">{nivel === 'simples' ? tx('O que importa hoje, num olhar.') : tx('Uma tela montada para você, refeita a cada lançamento.')}</p>
        </div>
      </header>
      {montando && <OQueMudou reanalise={c.reanalise} desdeAVisita={desdeAVisita} max={nivel === 'detalhado' ? 4 : 3} aoVivo />}
      <Manchete t={tela} aoIr={(x) => x.destino && c.irPara(x.destino)} />
      <SeuPerfil a={a} nivel={nivel} />
      {!montando && <OQueMudou reanalise={c.reanalise} desdeAVisita={desdeAVisita} max={nivel === 'detalhado' ? 4 : 2} />}
      <Agora a={a} nivel={nivel} />
      <CartaoDoPlanejamento a={a} planejamento={c.planejamento} aoAbrir={() => setPlanejando(true)} />
      {nivel === 'detalhado' ? <PlanoDeAcao a={a} aoIr={irPara} /> : <ProximoPasso a={a} aoIr={irPara} />}
      <Objetivo a={a} memoria={c.memoria} nivel={nivel} aoEscolher={c.escolherObjetivo} />

      <Faixas t={tela} aoIr={(x) => x.destino && c.irPara(x.destino)} nivel={nivel} />

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
      {planejando && (
        <Planejamento a={a} planejamento={c.planejamento} salvar={c.salvarPlanejamento} aoFechar={() => setPlanejando(false)}
          aoLancarEntrada={() => { setPlanejando(false); c.novoLancamento('entrada') }} />
      )}
    </div>
  )
}

/**
 * No detalhado: o plano de ação inteiro, em etapas (lib/analise.ts decide a etapa de cada passo): o que não espera, o que
 * vem em seguida e o que fica para quando der, cada uma numa coluna no computador. O que só pede para a pessoa informar
 * algo vai num rodapé, sem número. O "porquê" de cada passo abre ao tocar.
 */
export function PlanoDeAcao({ a, aoIr }: { a: DadosAnalise; aoIr: Ctx['irPara'] }) {
  const [aberto, setAberto] = useState<string | null>(null)
  const [tudo, setTudo] = useState(false)
  const [ref, vivo] = useEmVista<HTMLElement>()
  if (!a.acoes.length) {
    return (
      <section className="cartao an-agora nivel-tudo-certo">
        <span className="an-agora-icone"><Icone nome="check" tamanho={24} /></span>
        <strong>{tx('Nada pedindo ação agora.')}</strong>
      </section>
    )
  }
  const etapaDe = (x: Acao): EtapaDoPlano => x.etapa ?? (x.urgencia === 'urgente' ? 'agora' : x.urgencia === 'importante' ? 'seguida' : 'depois')
  const dados = a.acoes.filter((x) => etapaDe(x) === 'dados')
  const etapas = ETAPAS.map((e) => ({ ...e, passos: a.acoes.filter((x) => etapaDe(x) === e.id) })).filter((e) => e.passos.length)
  const passos = a.acoes.length - dados.length
  let n = 0
  return (
    <section ref={ref} className={`cartao an-plano ${vivo ? 'vivo' : ''}`}>
      <header className="vis-cab">
        <h3><Icone nome="ideia" tamanho={17} /> {tx('Seu plano de ação')}</h3>
        <span className="an-plano-conta">{passos === 1 ? tx('1 passo') : tx('{0} passos', passos)}</span>
      </header>
      {passos > 0 && (
        <div className="an-plano-etapas" style={{ '--colunas': etapas.length } as CSSProperties}>
          {etapas.map((e) => {
            // Muitos passos cansam: o "quando der" mostra 3 e esconde o resto atrás de um botão.
            const visiveis = e.id === 'depois' && !tudo ? e.passos.slice(0, MAX_QUANDO_DER) : e.passos
            const escondidos = e.passos.length - visiveis.length
            return (
              <div key={e.id} className={`an-plano-etapa etapa-${e.id}`}>
                <div className="an-plano-etapa-cab">
                  <Icone nome={e.icone} tamanho={15} />
                  <strong>{e.nome()}</strong>
                  <span>{e.dica()}</span>
                </div>
                <ol>
                  {visiveis.map((x) => {
                    const i = n++
                    return (
                      <li key={x.id} className={aberto === x.id ? 'aberto' : ''} style={{ '--i': i } as CSSProperties}>
                        <span className="an-plano-n">{i + 1}</span>
                        <button className="an-plano-texto" onClick={() => setAberto(aberto === x.id ? null : x.id)} aria-expanded={aberto === x.id}>
                          <strong>{x.titulo}</strong>
                          {x.impacto && <small className="an-plano-ganho">{x.impacto}</small>}
                          {aberto === x.id && <span className="an-plano-porque">{x.porque}</span>}
                        </button>
                        <button className="an-plano-ir" onClick={() => aoIr(x.destino)}>
                          <span>{x.botao}</span> <Icone nome="seta" tamanho={14} />
                        </button>
                      </li>
                    )
                  })}
                </ol>
                {escondidos > 0 && (
                  <button className="link an-plano-mais" onClick={() => setTudo(true)}>
                    {escondidos === 1 ? tx('Ver mais 1 passo') : tx('Ver mais {0} passos', escondidos)}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
      {dados.length > 0 && (
        <div className="an-plano-dados">
          <span><Icone nome="lista" tamanho={14} /> {tx('Para o plano ficar mais certo')}</span>
          <ul>
            {dados.map((x) => (
              <li key={x.id}>
                <button onClick={() => aoIr(x.destino)} title={x.porque}>{x.titulo} <Icone nome="seta" tamanho={13} /></button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

const MAX_QUANDO_DER = 3
const ETAPAS: { id: Exclude<EtapaDoPlano, 'dados'>; nome: () => string; dica: () => string; icone: string }[] = [
  { id: 'agora', nome: () => tx('Agora'), dica: () => tx('Não dá para esperar'), icone: 'relogio' },
  { id: 'seguida', nome: () => tx('Em seguida'), dica: () => tx('Muda o seu mês'), icone: 'seta' },
  { id: 'depois', nome: () => tx('Quando der'), dica: () => tx('Melhora com o tempo'), icone: 'estrela' },
]


/**
 * O que a última mudança fez com a análise ou, sem mudança nesta visita, o que mudou desde a anterior. O retrato da visita
 * fica no navegador (só números), para comparar na próxima.
 */
export function useDesdeAUltimaVisita(id: string, a: DadosAnalise) {
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
 * A montagem ao vivo: ao abrir o Consultor depois de uma mudança que mexeu na análise (um lançamento, uma dívida, uma conta
 * paga) ou, na primeira visita da sessão, quando algo mudou desde a anterior, a pessoa vê a tela sendo refeita: o cartão
 * "o que mudou" vem para o topo contando o que o consultor fez (lendo, refazendo as contas, montando) e a lista de mudanças,
 * enquanto uma luz desce pela tela e os cartões se montam um a um, de cima para baixo. Cada mudança anima uma vez só.
 */
let reanaliseMontada = 0
let visitaMontada = false
export function useMontagem(reanalise: Ctx['reanalise'], desdeAVisita: { mudancas: Mudanca[] } | null) {
  const [montar] = useState(() => (reanalise?.mudancas.length ? reanalise.em.getTime() > reanaliseMontada : !visitaMontada && !!desdeAVisita?.mudancas.length))
  useEffect(() => {
    if (!montar) return
    if (reanalise) reanaliseMontada = Math.max(reanaliseMontada, reanalise.em.getTime())
    visitaMontada = true
  }, [montar]) // eslint-disable-line react-hooks/exhaustive-deps
  // a visita já conta mesmo sem montagem: voltar à aba não repete o "desde a última visita"
  useEffect(() => { visitaMontada = true }, [])
  return montar
}

/** Só aparece quando algo mudou de fato: uma faixa com setas para cima ou para baixo. `aoVivo`: a montagem (acima). */
export function OQueMudou({ reanalise, desdeAVisita, max, aoVivo }: { reanalise: Ctx['reanalise']; desdeAVisita: { em: string; mudancas: Mudanca[] } | null; max: number; aoVivo?: boolean }) {
  const lista = reanalise?.mudancas.length ? reanalise.mudancas : desdeAVisita?.mudancas ?? []
  if (!lista.length) return null
  const titulo = reanalise?.mudancas.length ? tx('Mudou agora') : tx('Desde {0}', fmtDataCurta(desdeAVisita!.em.slice(0, 10)))
  const nota = reanalise?.mudancas.length && reanalise.nota !== null && reanalise.notaAntes !== null && reanalise.nota !== reanalise.notaAntes
    ? { de: reanalise.notaAntes, para: reanalise.nota } : null
  return (
    <section className={`cartao an-mudou ${aoVivo ? 'ao-vivo' : ''}`}>
      {aoVivo && <span className="an-mudou-progresso" aria-hidden="true" />}
      <span className="an-mudou-titulo">
        <Icone nome={aoVivo ? 'bussola' : 'historico'} tamanho={14} />
        {aoVivo ? (
          <span className="an-mudou-troca">
            <span className="antes" aria-hidden="true">{tx('Refazendo sua tela…')}</span>
            <span className="depois">{tx('Refiz sua tela')} · {titulo}</span>
          </span>
        ) : titulo}
        {aoVivo && nota && (
          <span className={`an-mudou-nota ${nota.para > nota.de ? 'bom' : 'ruim'}`}>
            {tx('Nota {0} → {1}', nota.de, nota.para)}
          </span>
        )}
      </span>
      {aoVivo && (
        <ol className="an-mudou-passos" aria-hidden="true">
          {[tx('Li o que mudou'), tx('Refiz as contas'), tx('Montei a tela de novo')].map((p, i) => (
            <li key={i} style={{ '--i': i } as CSSProperties}><span className="an-mudou-ok"><Icone nome="check" tamanho={11} /></span>{p}</li>
          ))}
        </ol>
      )}
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
