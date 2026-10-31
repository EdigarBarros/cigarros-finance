/**
 * Peças da Início no jeito simples: o resumo do mês em palavras (com o que ainda falta até o fim do mês) e uma lista
 * única do que fazer (contas, faturas e parcelas, na ordem do vencimento). O resto da tela reaproveita os blocos de
 * `Blocos.tsx`. Veja docs/arquitetura-do-painel.md, seção 4.1.
 */
import { useState, type ReactNode } from 'react'
import type { Resumo } from '../lib/calc'
import { fmtValor, MESES_CURTO } from '../lib/format'
import type { Tarefa } from '../lib/paraFazer'
import { Icone } from './Icone'
import { Numero } from './Numero'
import { tx } from '../lib/textos'
import './simples.css'

const LIMITE = 5

/** "Para fazer": uma lista só, com o dia do vencimento em destaque e a ação a um toque. */
export function BlocoParaFazer({ tarefas, aoVerTudo }: { tarefas: Tarefa[]; aoVerTudo?: () => void }) {
  const [todas, setTodas] = useState(false)
  const atrasadas = tarefas.filter((t) => t.estado === 'atrasada').length
  const visiveis = todas ? tarefas : tarefas.slice(0, LIMITE)
  return (
    <section className="bloco para-fazer">
      <header className="bloco-cab">
        <h2>{tx('Para fazer')}</h2>
        {tarefas.length > 0 && (
          <span className={`para-fazer-conta ${atrasadas ? 'atrasada' : ''}`}>
            {atrasadas
              ? (atrasadas === 1 ? tx('1 com atraso') : tx('{0} com atraso', atrasadas))
              : (tarefas.length === 1 ? tx('1 em aberto') : tx('{0} em aberto', tarefas.length))}
          </span>
        )}
      </header>
      {!tarefas.length ? (
        <p className="para-fazer-vazio"><Icone nome="check" tamanho={18} /> {tx('Tudo em dia neste mês! 🎉')}</p>
      ) : (
        <ul className="afazeres">
          {visiveis.map((t) => (
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
      )}
      {tarefas.length > LIMITE && (
        <button className="quadro-ver" onClick={() => setTodas(!todas)}>
          {todas ? tx('Mostrar menos') : tx('Ver mais {0}', tarefas.length - LIMITE)}
        </button>
      )}
      {tarefas.length <= LIMITE && aoVerTudo && tarefas.length > 0 && (
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
 */
export function ResumoSimples({ r, nomeMes, vazio, futuro, previsao, comCartao, acoes, aoVerGastos }: {
  r: Resumo
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
}) {
  const sobrou = r.fluxo >= 0
  const fimDoMes = previsao ? r.fluxo - previsao.faltaPagar + previsao.faltaReceber : null
  const estado = vazio ? null : futuro ? 'futuro'
    : r.fluxo < 0 ? 'ruim'
      : (fimDoMes !== null && fimDoMes < 0) || (r.entradas > 0 && r.fluxo / r.entradas < 0.05) ? 'aperto'
        : 'bom'
  const selo = estado === 'ruim' ? tx('Mês no vermelho') : estado === 'aperto' ? tx('Mês apertado') : tx('Mês no azul')
  const frase = futuro && !vazio ? tx('{0} ainda não começou. Isso é o que já está lançado para ele, como parcelas e compras no cartão.', nomeMes[0].toUpperCase() + nomeMes.slice(1))
    : vazio ? tx('Nada lançado em {0} ainda. Comece pelo que entrou ou pelo que saiu.', nomeMes)
    : r.fluxo < 0 ? <>{tx('Saiu {0} a mais do que entrou.', fmtValor(-r.fluxo))} <button className="link" onClick={aoVerGastos}>{tx('Ver para onde foi')}</button></>
      : r.fluxo === 0 ? tx('Entrou e saiu o mesmo valor.')
        : r.entradas > 0 ? tx('Você ficou com {0}% do que entrou.', Math.round((r.fluxo / r.entradas) * 100)) : ''
  // a barra inteira é o maior dos dois: o que saiu pinta por cima do que entrou, e o resto é o que sobrou
  const topo = Math.max(r.entradas, r.saidas) || 1
  const pSaiu = (Math.min(r.saidas, r.entradas || r.saidas) / topo) * 100
  const pAMais = (Math.max(0, r.saidas - r.entradas) / topo) * 100

  return (
    <section className={`resumo-simples ${estado ?? 'sem-dados'}`}>
      <div className="rs-principal">
        {estado && estado !== 'futuro' && <span className="rs-selo"><i />{selo}</span>}
        <p className="rs-rotulo">{vazio ? tx('Seu mês') : futuro ? (sobrou ? tx('Deve sobrar em {0}', nomeMes) : tx('Já sai em {0}', nomeMes)) : sobrou ? tx('Sobrou em {0}', nomeMes) : tx('Faltou em {0}', nomeMes)}</p>
        {!vazio && <strong className="rs-valor"><Numero valor={Math.abs(r.fluxo)} formato={fmtValor} /></strong>}
        <p className="rs-frase">{frase}</p>
        {!vazio && !futuro && (
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
              <b>{fmtValor(Math.abs(fimDoMes))}</b>
            </p>
            {comCartao && <small>{tx('As compras no cartão já contam no que saiu.')}</small>}
          </div>
        )}
        <div className="rs-acoes" data-tour="lancar">{acoes}</div>
      </div>
    </section>
  )
}
