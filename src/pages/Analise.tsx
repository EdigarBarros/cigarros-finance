import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { compararRetratos, retratoDe, type Analise as DadosAnalise, type Mudanca, type Retrato } from '../lib/analise'
import { fmtDataCurta } from '../lib/format'
import { useMovimento } from '../lib/tema'
import { Icone } from '../components/Icone'
import { Interruptor } from '../components/ui'
import { useEmVista } from './analiseApoio'
import { Agora, Objetivo, ProximoPasso, SeuPerfil } from './AnaliseTopo'
import { Faixas, Manchete, useTelaViva } from './AnaliseTela'
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
          <p className="sub">{nivel === 'simples' ? tx('O que importa hoje, num olhar.') : tx('Uma tela montada para você, refeita a cada lançamento.')}</p>
        </div>
      </header>
      <Manchete t={tela} aoIr={(x) => x.destino && c.irPara(x.destino)} />
      <SeuPerfil a={a} nivel={nivel} />
      <OQueMudou reanalise={c.reanalise} desdeAVisita={desdeAVisita} max={nivel === 'detalhado' ? 4 : 2} />
      <Agora a={a} nivel={nivel} />
      {nivel === 'detalhado' ? <PlanoDeAcao a={a} aoIr={c.irPara} /> : <ProximoPasso a={a} aoIr={c.irPara} />}
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
