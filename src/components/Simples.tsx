/**
 * A lista "Contas e vencimentos" da Início no jeito equilibrado: contas, faturas e parcelas numa lista só, na ordem do
 * vencimento. (O jeito simples tem a sua própria tela, em InicioSimples.tsx.) Veja docs/arquitetura-do-painel.md.
 */
import { useState } from 'react'
import { MESES_CURTO } from '../lib/format'
import { agruparTarefas, type Tarefa } from '../lib/paraFazer'
import { Icone } from './Icone'
import { tx } from '../lib/textos'
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
