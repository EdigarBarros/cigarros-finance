/**
 * "Entender previsão": como o app chegou no estado do mês (Mês no azul, Mês apertado…) e no "Deve sobrar / Pode faltar".
 * A mesma janela nos três jeitos de ver, com os mesmos números do cartão do mês: parte do que já entrou menos o que já
 * saiu, soma o que ainda vai entrar e tira o que ainda vai sair, item por item (lib/previsao.ts → comporPrevisao), e diz
 * o que a conta não sabe. Veja docs/arquitetura-do-painel.md, seção 4.0.3.
 */
import { useState } from 'react'
import type { ComposicaoDaPrevisao, GrupoPrevisto } from '../lib/previsao'
import { criteriosDoEstado, type SituacaoDoMes } from '../lib/situacaoDoMes'
import { fmtDataCurta, fmtValor } from '../lib/format'
import { Modal } from './ui'
import { Icone } from './Icone'
import { tx } from '../lib/textos'
import './entender.css'

/** Itens mostrados por grupo antes do "e mais N". */
const POR_GRUPO = 6

const nomeDoGrupo = (g: GrupoPrevisto, entrada: boolean, nomeDoCartao: (id?: string) => string) => {
  switch (g.origem) {
    case 'conta': return entrada ? tx('Contas a receber') : tx('Contas do mês sem baixa')
    case 'fatura': return tx('Fatura do cartão {0} (em aberto)', nomeDoCartao(g.cartaoId))
    case 'parcela': return tx('Parcelas de dívidas')
    default: return tx('Lançamentos com data mais à frente')
  }
}

function Grupo({ g, entrada, nomeDoCartao }: { g: GrupoPrevisto; entrada: boolean; nomeDoCartao: (id?: string) => string }) {
  const [todos, setTodos] = useState(false)
  const itens = todos ? g.itens : g.itens.slice(0, POR_GRUPO)
  return (
    <li className="em-grupo">
      <p className="em-grupo-cab"><span>{nomeDoGrupo(g, entrada, nomeDoCartao)}</span><b>{fmtValor(g.total)}</b></p>
      <ul className="em-itens">
        {itens.map((i, k) => (
          <li key={k} className={i.atrasado ? 'atrasado' : undefined}>
            <span className="em-data">{i.data ? fmtDataCurta(i.data) : '—'}</span>
            <span className="em-desc">
              {i.descricao}
              {i.atrasado && <small>{entrada ? tx('não caiu ainda') : tx('já venceu')}</small>}
            </span>
            <span className="em-valor">{fmtValor(i.valor)}</span>
          </li>
        ))}
      </ul>
      {g.itens.length > POR_GRUPO && (
        <button type="button" className="link em-mais" onClick={() => setTodos(!todos)}>
          {todos ? tx('Mostrar menos') : tx('e mais {0}', g.itens.length - POR_GRUPO)}
        </button>
      )}
    </li>
  )
}

export function EntenderMes({ situacao, composicao, nomeMes, dias, nomeDoCartao, aoFechar }: {
  situacao: SituacaoDoMes
  /** O que entrou, saiu e ainda está em aberto no mês (a previsão só vale no mês de hoje). */
  composicao: ComposicaoDaPrevisao
  /** "novembro" */
  nomeMes: string
  /** Dias do mês (o resultado previsto é o do último dia). */
  dias: number
  nomeDoCartao: (id?: string) => string
  aoFechar: () => void
}) {
  const c = composicao
  const atual = situacao.momento === 'atual'
  return (
    <Modal titulo={atual ? tx('Entender previsão') : tx('Entender o mês')} aoFechar={aoFechar}>
      <div className="entender">
        {situacao.selo && (
          <section className={`em-estado ${situacao.estado}`}>
            <p className="em-selo"><i aria-hidden="true" />{situacao.selo}</p>
            <ul className="em-motivos">
              {situacao.motivos.map((m) => <li key={m.id} className={m.peso}>{m.texto}</li>)}
            </ul>
            <details className="em-criterios">
              <summary>{tx('Como o app decide o estado do mês')}</summary>
              <ul>{criteriosDoEstado().map((t) => <li key={t}>{t}</li>)}</ul>
            </details>
          </section>
        )}

        {atual ? (
          <section className="em-conta" aria-label={tx('Como a previsão foi calculada')}>
            <h3>{tx('A conta, passo a passo')}</h3>
            <ol className="em-passos">
              <li>
                <p className="em-passo"><span>{tx('Resultado até hoje')}</span><b className={c.referencia < 0 ? 'neg' : undefined}>{c.referencia < 0 ? '− ' : ''}{fmtValor(Math.abs(c.referencia))}</b></p>
                <p className="em-nota">{tx('Entrou {0} e saiu {1} em {2} até hoje. Não é o saldo do banco: é o que entrou menos o que saiu neste mês.', fmtValor(c.entrou), fmtValor(c.saiu), nomeMes)}</p>
              </li>
              <li>
                <p className="em-passo"><span><i className="em-sinal mais" aria-hidden="true">+</i>{tx('Ainda vai entrar')}</span><b className="pos">{fmtValor(c.totalReceber)}</b></p>
                {c.receber.length ? (
                  <ul className="em-grupos">{c.receber.map((g) => <Grupo key={g.chave} g={g} entrada nomeDoCartao={nomeDoCartao} />)}</ul>
                ) : (
                  <p className="em-nota aviso"><Icone nome="ideia" tamanho={14} /> {tx('Nenhum recebimento previsto. Cadastre o seu salário em Contas do mês para ele aparecer aqui.')}</p>
                )}
              </li>
              <li>
                <p className="em-passo"><span><i className="em-sinal menos" aria-hidden="true">−</i>{tx('Ainda vai sair')}</span><b className="neg">{fmtValor(c.totalPagar)}</b></p>
                {c.pagar.length
                  ? <ul className="em-grupos">{c.pagar.map((g) => <Grupo key={g.chave} g={g} entrada={false} nomeDoCartao={nomeDoCartao} />)}</ul>
                  : <p className="em-nota">{tx('Nada a pagar previsto até o fim do mês.')}</p>}
              </li>
              <li className="em-total">
                <p className="em-passo">
                  <span><i className="em-sinal igual" aria-hidden="true">=</i>{c.resultado < 0 ? tx('Pode faltar no dia {0}', dias) : tx('Deve sobrar no dia {0}', dias)}</span>
                  <b className={c.resultado < 0 ? 'neg' : 'pos'}>{c.resultado < 0 ? '− ' : ''}{fmtValor(Math.abs(c.resultado))}</b>
                </p>
                <p className="em-nota">{`${fmtValor(c.referencia)} + ${fmtValor(c.totalReceber)} − ${fmtValor(c.totalPagar)}`}</p>
              </li>
            </ol>
            {(c.pagarAtrasado > 0 || c.receberAtrasado > 0) && (
              <p className="em-nota aviso">
                <Icone nome="relogio" tamanho={14} />{' '}
                {c.pagarAtrasado > 0 && tx('{0} do que vai sair já venceu.', fmtValor(c.pagarAtrasado))}{' '}
                {c.receberAtrasado > 0 && tx('{0} do que vai entrar já devia ter caído: confira se não falta marcar "Recebi".', fmtValor(c.receberAtrasado))}
              </p>
            )}
          </section>
        ) : (
          <section className="em-conta">
            <h3>{tx('Como o mês fechou')}</h3>
            <p className="em-passo"><span>{tx('Entrou')}</span><b className="pos">{fmtValor(c.entrou)}</b></p>
            <p className="em-passo"><span>{tx('Saiu')}</span><b className="neg">{fmtValor(c.saiu)}</b></p>
            <p className="em-passo em-total"><span>{situacao.resultado < 0 ? tx('Faltou') : tx('Sobrou')}</span><b className={situacao.resultado < 0 ? 'neg' : 'pos'}>{fmtValor(Math.abs(situacao.resultado))}</b></p>
            {c.totalPagar > 0 && (
              <>
                <p className="em-nota aviso"><Icone nome="relogio" tamanho={14} /> {tx('Ficou em aberto neste mês: {0}.', fmtValor(c.totalPagar))}</p>
                <ul className="em-grupos">{c.pagar.map((g) => <Grupo key={g.chave} g={g} entrada={false} nomeDoCartao={nomeDoCartao} />)}</ul>
              </>
            )}
          </section>
        )}

        <section className="em-premissas">
          <h3>{tx('O que a previsão considera')}</h3>
          <ul>
            <li>{tx('Só entra o que está no app: contas do mês sem baixa, parcelas de dívidas, faturas de cartão em aberto e lançamentos com data mais à frente.')}</li>
            <li>{tx('Gastos do dia a dia que ainda não foram lançados não entram. O Consultor estima esses gastos pelo seu costume.')}</li>
            <li>{tx('Cada valor conta uma vez só: conta paga sai da lista (já está no que saiu) e compra no cartão fica na fatura até ela ser paga.')}</li>
            <li>{tx('Fatura de um mês que já passou contou como saída no mês dela: mesmo atrasada, não entra de novo aqui.')}</li>
            <li>{tx('Valores em outra moeda usam a cotação do dia. Parcela atrasada leva os juros de atraso estimados, quando cadastrados.')}</li>
          </ul>
        </section>
      </div>
    </Modal>
  )
}
