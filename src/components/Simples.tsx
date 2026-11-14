/**
 * Peças da Início no jeito simples: o resumo do mês em palavras (com o que ainda falta até o fim do mês) e uma lista
 * única do que fazer (contas, faturas e parcelas, na ordem do vencimento). O resto da tela reaproveita os blocos de
 * `Blocos.tsx`. Veja docs/arquitetura-do-painel.md, seção 4.1.
 */
import { useState, type ReactNode } from 'react'
import type { Resumo } from '../lib/calc'
import { fmtValor, MESES_CURTO } from '../lib/format'
import { agruparTarefas, type Tarefa } from '../lib/paraFazer'
import { Icone } from './Icone'
import { Numero } from './Numero'
import { tx } from '../lib/textos'
import { useAcoesDeLancar } from '../lib/botaoMais'
import type { SituacaoDoMes } from '../lib/situacaoDoMes'
import './entender.css'
import './simples.css'

const LIMITE = 5

function Linhas({ tarefas }: { tarefas: Tarefa[] }) {
  return (
    <ul className="afazeres">
      {tarefas.map((t) => (
        <li key={t.chave} className={`afazer ${t.estado}`}>
          <span className="conta-dia" aria-hidden="true">
            <b>{t.vencimento.slice(8, 10)}</b><small>{MESES_CURTO[Number(t.vencimento.slice(5, 7)) - 1]}</small>
          </span>
          <span className="afazer-info">
            <strong>{t.titulo}</strong>
            <span className={`chip-estado ${t.estado}`}>{t.frase}</span>
          </span>
          <span className="afazer-lado">
            <span className={`afazer-valor ${t.entrada ? 'entrada' : ''}`}>{t.valor}{t.aprox && <small>{t.aprox}</small>}</span>
            <button className={`btn ${t.botao.principal ? 'primario' : ''}`} onClick={t.botao.acao}>{t.botao.texto}</button>
          </span>
        </li>
      ))}
    </ul>
  )
}

/**
 * "Para fazer": uma lista só, com o dia do vencimento em destaque e a ação a um toque, separada em grupos: o que já venceu
 * (precisa de atenção, com há quantos dias), o que vence logo e, com `limite`, o que vence depois (recolhido). Antes, a
 * lista "Próximos 7 dias" do equilibrado abria com uma fatura vencida em outubro misturada à conta de amanhã.
 */
export function BlocoParaFazer({ tarefas, aoVerTudo, titulo, vazio, limite, rotuloProximas }: {
  tarefas: Tarefa[]; aoVerTudo?: () => void
  /** Outro título e outra frase para quando nada vence no período (o equilibrado mostra os próximos 7 dias). */
  titulo?: string; vazio?: string
  /** AAAA-MM-DD: o que vence até aqui é "próximo"; depois disso fica recolhido em "Mais para frente no mês". */
  limite?: string
  /** Nome do grupo do que vence logo ("Próximos 7 dias"). */
  rotuloProximas?: string
}) {
  const [todas, setTodas] = useState(false)
  const [depoisAberto, setDepoisAberto] = useState(false)
  const g = agruparTarefas(tarefas, limite ?? '9999-12-31')
  const atrasadas = g.atrasadas.length
  // sem abrir tudo: até 5 linhas, guardando pelo menos 2 para o que vence logo (senão 7 atrasadas escondem a conta de amanhã)
  const nProx = todas ? g.proximas.length : Math.min(g.proximas.length, Math.max(2, LIMITE - atrasadas))
  const nAtr = todas ? atrasadas : Math.min(atrasadas, Math.max(0, LIMITE - nProx))
  const escondidas = atrasadas - nAtr + g.proximas.length - nProx
  const comGrupos = atrasadas > 0 || g.depois.length > 0
  const abertas = atrasadas + g.proximas.length
  return (
    <section className="bloco para-fazer">
      <header className="bloco-cab">
        <h2>{titulo ?? tx('Para fazer')}</h2>
        {tarefas.length > 0 && (
          <span className={`para-fazer-conta ${atrasadas ? 'atrasada' : ''}`}>
            {atrasadas
              ? (atrasadas === 1 ? tx('1 com atraso') : tx('{0} com atraso', atrasadas))
              : (tarefas.length === 1 ? tx('1 em aberto') : tx('{0} em aberto', tarefas.length))}
          </span>
        )}
      </header>
      {!tarefas.length && <p className="para-fazer-vazio"><Icone nome="check" tamanho={18} /> {tx('Tudo em dia neste mês! 🎉')}</p>}
      {atrasadas > 0 && (
        <div className="pf-grupo atencao">
          <h3 className="pf-grupo-tit"><Icone nome="relogio" tamanho={15} /> {tx('Precisam de atenção')}<small>{tx('já venceram')}</small></h3>
          <Linhas tarefas={g.atrasadas.slice(0, nAtr)} />
        </div>
      )}
      {tarefas.length > 0 && (g.proximas.length > 0 || limite) && (
        <div className="pf-grupo">
          {comGrupos && <h3 className="pf-grupo-tit">{rotuloProximas ?? tx('Próximos vencimentos')}</h3>}
          {g.proximas.length
            ? <Linhas tarefas={g.proximas.slice(0, nProx)} />
            : <p className="para-fazer-vazio pequeno"><Icone nome="check" tamanho={16} /> {vazio ?? tx('Nada vence nos próximos dias.')}</p>}
        </div>
      )}
      {escondidas > 0 && (
        <button className="quadro-ver" onClick={() => setTodas(true)}>{tx('Ver mais {0}', escondidas)}</button>
      )}
      {todas && abertas > LIMITE && (
        <button className="quadro-ver" onClick={() => setTodas(false)}>{tx('Mostrar menos')}</button>
      )}
      {g.depois.length > 0 && (
        <div className="pf-grupo depois">
          <button type="button" className="pf-depois" aria-expanded={depoisAberto} onClick={() => setDepoisAberto(!depoisAberto)}>
            <span>{tx('Mais para frente no mês')}</span>
            <small>{g.depois.length === 1 ? tx('1 conta') : tx('{0} contas', g.depois.length)}</small>
            <Icone nome={depoisAberto ? 'cima' : 'abaixo'} tamanho={16} />
          </button>
          {depoisAberto && <Linhas tarefas={g.depois} />}
        </div>
      )}
      {aoVerTudo && tarefas.length > 0 && !escondidas && (
        <button className="quadro-ver" onClick={aoVerTudo}>{tx('Ver contas do mês')}</button>
      )}
    </section>
  )
}

export interface Previsao {
  /** Contas e parcelas que ainda vão sair no mês. */
  faltaPagar: number
  /** Contas que ainda vão entrar no mês. */
  faltaReceber: number
}

/**
 * O mês numa olhada, para quem não quer gráfico: quanto sobrou (ou faltou), um selo em palavras, uma barra do que
 * entrou contra o que saiu e, no mês atual, quanto deve sobrar depois de pagar o que falta.
 * O selo vem da mesma conta dos outros jeitos (lib/situacaoDoMes.ts). O valor, o estado e a previsão ficam separados: o
 * número tem a cor do sinal (sobrou é verde mesmo num mês apertado), o selo diz o estado e a previsão tem a sua própria cor.
 */
export function ResumoSimples({ r, nomeMes, vazio, futuro, ateHoje, previsao, comCartao, acoes, aoVerGastos, situacao, aoEntender }: {
  r: Resumo
  /** Mês de hoje: os números contam só o que já aconteceu até hoje (o resto está na previsão do fim do mês). */
  ateHoje?: boolean
  /** Mês que ainda não começou: não dá para dizer se foi bom ou ruim, só o que já está lançado para ele. */
  futuro?: boolean
  /** "outubro" */
  nomeMes: string
  vazio: boolean
  /** Só no mês atual e quando há algo a pagar ou receber. */
  previsao: Previsao | null
  /** Há fatura em aberto: avisa que as compras no cartão já contam no que saiu. */
  comCartao: boolean
  acoes: ReactNode
  aoVerGastos: () => void
  /** O estado do mês, a mesma conta nos três jeitos. */
  situacao: SituacaoDoMes
  /** Abre o "Entender previsão" (a conta passo a passo e o porquê do selo). */
  aoEntender: () => void
}) {
  const refAcoes = useAcoesDeLancar<HTMLDivElement>()
  const sobrou = r.fluxo >= 0
  const fimDoMes = previsao ? r.fluxo - previsao.faltaPagar + previsao.faltaReceber : null
  const estado = vazio ? null : futuro ? 'futuro' : situacao.estado === 'sem_dados' ? null : situacao.estado
  const nadaAinda = !vazio && !futuro && r.entradas === 0 && r.saidas === 0
  const frase = futuro && !vazio ? tx('{0} ainda não começou. Isso é o que já está lançado para ele, como parcelas e compras no cartão.', nomeMes[0].toUpperCase() + nomeMes.slice(1))
    : vazio ? tx('Nada lançado em {0} ainda. Comece pelo que entrou ou pelo que saiu.', nomeMes)
    : nadaAinda ? tx('Nada entrou nem saiu até hoje.')
    : r.fluxo < 0 ? <>{tx('Saiu {0} a mais do que entrou.', fmtValor(-r.fluxo))} <button className="link" onClick={aoVerGastos}>{tx('Ver para onde foi')}</button></>
      : r.fluxo === 0 ? tx('Entrou e saiu o mesmo valor.')
        : r.entradas > 0 ? tx('Você ficou com {0}% do que entrou.', Math.round((r.fluxo / r.entradas) * 100)) : ''
  // a barra inteira é o maior dos dois: o que saiu pinta por cima do que entrou, e o resto é o que sobrou
  const topo = Math.max(r.entradas, r.saidas) || 1
  const pSaiu = (Math.min(r.saidas, r.entradas || r.saidas) / topo) * 100
  const pAMais = (Math.max(0, r.saidas - r.entradas) / topo) * 100
  const motivo = estado && estado !== 'futuro' && estado !== 'favoravel' ? situacao.motivos[0]?.texto : null

  return (
    <section className={`resumo-simples ${estado ?? 'sem-dados'}`}>
      <div className="rs-principal">
        {estado && estado !== 'futuro' && (
          <button type="button" className="rs-selo" onClick={aoEntender} title={tx('Por que este estado?')}>
            <i aria-hidden="true" />{situacao.selo}
          </button>
        )}
        <p className="rs-rotulo">{vazio ? tx('Seu mês') : futuro ? (sobrou ? tx('Deve sobrar em {0}', nomeMes) : tx('Já sai em {0}', nomeMes)) : ateHoje ? (sobrou ? tx('Sobrou até hoje') : tx('Faltou até hoje')) : sobrou ? tx('Sobrou em {0}', nomeMes) : tx('Faltou em {0}', nomeMes)}</p>
        {!vazio && <strong className={`rs-valor ${sobrou ? 'pos' : 'neg'}`}><Numero valor={Math.abs(r.fluxo)} formato={fmtValor} /></strong>}
        <p className="rs-frase">{frase}</p>
        {motivo && <p className="rs-motivo">{motivo}</p>}
        {/* com entrou e saiu zerados (no começo do mês) a barra sairia inteira verde, como se tivesse sobrado tudo */}
        {!vazio && !futuro && (r.entradas > 0 || r.saidas > 0) && (
          <div className="rs-barra-caixa">
            <div className="rs-numeros">
              <span><i className="entrou" />{tx('Entrou')} <b>{fmtValor(r.entradas)}</b></span>
              <span><i className="saiu" />{tx('Saiu')} <b>{fmtValor(r.saidas)}</b></span>
            </div>
            <div className="rs-barra" role="img"
              aria-label={tx('Entrou {0} e saiu {1}', fmtValor(r.entradas), fmtValor(r.saidas))}>
              <span className="saiu" style={{ width: `${pSaiu}%` }} />
              {pAMais > 0 && <span className="a-mais" style={{ width: `${pAMais}%` }} />}
            </div>
          </div>
        )}
      </div>
      <div className="rs-lado">
        {previsao && fimDoMes !== null && (
          <div className="rs-previsao">
            <h3><Icone nome="calendario" tamanho={16} /> {tx('Até o fim do mês')}</h3>
            {previsao.faltaPagar > 0 && <p><span>{tx('Ainda falta pagar')}</span><b>{fmtValor(previsao.faltaPagar)}</b></p>}
            {previsao.faltaReceber > 0 && <p><span>{tx('Ainda falta receber')}</span><b className="pos">{fmtValor(previsao.faltaReceber)}</b></p>}
            <p className={`rs-previsao-total ${fimDoMes < 0 ? 'neg' : ''}`}>
              <span>{fimDoMes < 0 ? tx('Pode faltar') : tx('Deve sobrar')}</span>
              <b>{fimDoMes < 0 ? '− ' : ''}{fmtValor(Math.abs(fimDoMes))}</b>
            </p>
            {comCartao && <small>{tx('As compras no cartão já contam no que saiu.')}</small>}
            <button type="button" className="btn-entender" onClick={aoEntender}><Icone nome="ideia" tamanho={15} /> {tx('Entender previsão')}</button>
          </div>
        )}
        <div className="rs-acoes" data-tour="lancar" ref={refAcoes}>{acoes}</div>
      </div>
    </section>
  )
}
