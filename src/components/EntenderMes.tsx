/**
 * "Entender previsão": como o app chegou no estado do mês (Mês no azul, Mês apertado…) e no "Deve sobrar / Pode faltar".
 * A mesma janela nos três jeitos de ver, com os mesmos números do cartão do mês (lib/previsao.ts → comporPrevisao).
 * Desenho (18/11/2026, pedido do dono: mais visual, menos texto): a resposta primeiro, num cartão grande; a conta numa
 * cascata (até hoje → + vai entrar → − vai sair → = fim do mês); para onde vai o que ainda vai sair, numa barra por
 * grupo e quanto disso já venceu; os grupos fechados, com os itens a um clique; as explicações recolhidas.
 * Veja docs/arquitetura-do-painel.md, seção 4.0.3.
 */
import { useState, type CSSProperties } from 'react'
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
/** Ícone e cor de cada grupo: a mesma cor na barra e no grupo, para o olho ligar um ao outro. */
const visualDoGrupo = (g: GrupoPrevisto, entrada: boolean) => {
  if (entrada) return { icone: g.origem === 'lancamento' ? 'lista' : 'receber', cor: g.origem === 'lancamento' ? 'var(--caixa)' : 'var(--entrada)' }
  switch (g.origem) {
    case 'conta': return { icone: 'calendario', cor: 'var(--caixa)' }
    case 'fatura': return { icone: 'cartao', cor: 'var(--violeta)' }
    case 'parcela': return { icone: 'divida', cor: 'var(--divida)' }
    default: return { icone: 'lista', cor: 'var(--texto-2)' }
  }
}

/**
 * A conta em cascata: cada coluna começa onde a anterior terminou (sobe com o que entra, desce com o que sai) e a
 * última mostra onde o mês termina. Com a linha do zero, dá para ver na hora se o fim fica acima ou abaixo dele.
 */
function Cascata({ passos }: { passos: { rotulo: string; valor: number; tipo: 'base' | 'mais' | 'menos' | 'fim' }[] }) {
  // de onde até onde vai cada coluna
  const colunas: (typeof passos[number] & { de: number; ate: number })[] = []
  for (const p of passos) {
    const nivel = colunas.length ? colunas[colunas.length - 1].ate : 0
    if (p.tipo === 'base' || p.tipo === 'fim') colunas.push({ ...p, de: 0, ate: p.valor })
    else colunas.push({ ...p, de: nivel, ate: p.tipo === 'mais' ? nivel + p.valor : nivel - p.valor })
  }
  const max = Math.max(0, ...colunas.flatMap((k) => [k.de, k.ate]))
  const min = Math.min(0, ...colunas.flatMap((k) => [k.de, k.ate]))
  const W = 400, H = 190, topo = 26, base = 26, alto = H - topo - base
  const y = (v: number) => topo + ((max - v) / (max - min || 1)) * alto
  const largura = W / colunas.length
  const barra = Math.min(58, largura * 0.56)
  const cor = (k: typeof colunas[number]) =>
    k.tipo === 'mais' ? 'var(--entrada)' : k.tipo === 'menos' ? 'var(--saida)' : k.ate < 0 ? 'var(--saida)' : k.tipo === 'fim' ? 'var(--entrada)' : 'var(--caixa)'
  const sinal = (k: typeof colunas[number]) => (k.tipo === 'mais' ? '+' : k.tipo === 'menos' ? '−' : k.ate < 0 ? '−' : '')
  return (
    <figure className="em-cascata">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={colunas.map((k) => `${k.rotulo}: ${sinal(k)}${fmtValor(Math.abs(k.valor))}`).join('; ')}>
        <line className="em-zero" x1={0} x2={W} y1={y(0)} y2={y(0)} />
        {colunas.map((k, i) => {
          const cx = largura * i + largura / 2
          const y1 = y(Math.max(k.de, k.ate)), y2 = y(Math.min(k.de, k.ate))
          const proxima = colunas[i + 1]
          return (
            <g key={k.rotulo} className="em-coluna" style={{ '--c': cor(k), '--i': i } as CSSProperties}>
              {/* a linha que liga o fim desta coluna ao começo da próxima */}
              {proxima && <line className="em-ponte" x1={cx + barra / 2} x2={cx + largura - barra / 2} y1={y(k.tipo === 'fim' ? k.valor : k.ate)} y2={y(k.tipo === 'fim' ? k.valor : k.ate)} />}
              <rect x={cx - barra / 2} y={y1} width={barra} height={Math.max(3, y2 - y1)} rx={7} />
              <text className="em-coluna-valor" x={cx} y={Math.max(14, y1 - 8)} textAnchor="middle">{sinal(k)}{fmtValor(Math.abs(k.valor)).replace(/,\d\d$/, '')}</text>
              <text className="em-coluna-rotulo" x={cx} y={H - 6} textAnchor="middle">{k.rotulo}</text>
            </g>
          )
        })}
      </svg>
    </figure>
  )
}

/** Uma barra só, dividida pelos grupos, cada um na cor do ícone dele na lista logo abaixo (sem legenda: a lista é a legenda). */
function BarraDosGrupos({ grupos, entrada, total, nomeDoCartao }: { grupos: GrupoPrevisto[]; entrada: boolean; total: number; nomeDoCartao: (id?: string) => string }) {
  if (!grupos.length || total <= 0) return null
  return (
    <div className="em-partes">
      <div className="em-partes-barra" aria-hidden="true">
        {grupos.map((g) => (
          <i key={g.chave} style={{ '--c': visualDoGrupo(g, entrada).cor, flexGrow: g.total } as CSSProperties}
            title={`${nomeDoGrupo(g, entrada, nomeDoCartao)}: ${Math.round((g.total / total) * 100)}%`} />
        ))}
      </div>
    </div>
  )
}

/** Um grupo fechado: ícone, nome, quantos itens, quanto. Clicar abre a lista. */
function Grupo({ g, entrada, total, nomeDoCartao }: { g: GrupoPrevisto; entrada: boolean; total: number; nomeDoCartao: (id?: string) => string }) {
  const [todos, setTodos] = useState(false)
  const itens = todos ? g.itens : g.itens.slice(0, POR_GRUPO)
  const vencidos = g.itens.filter((i) => i.atrasado).length
  const { icone, cor } = visualDoGrupo(g, entrada)
  return (
    <li>
      <details className="em-grupo" style={{ '--c': cor, '--p': total > 0 ? g.total / total : 0 } as CSSProperties}>
        <summary>
          <span className="em-grupo-ic" aria-hidden="true"><Icone nome={icone} tamanho={18} /></span>
          <span className="em-grupo-nome">
            <b>{nomeDoGrupo(g, entrada, nomeDoCartao)}</b>
            <small>
              <span className="em-grupo-pct">{Math.round((total > 0 ? g.total / total : 0) * 100)}%</span>
              {g.itens.length === 1 ? tx('1 item') : tx('{0} itens', g.itens.length)}
              {vencidos > 0 && <em>{vencidos === 1 ? tx('1 vencido') : tx('{0} vencidos', vencidos)}</em>}
            </small>
            <span className="em-grupo-parte" aria-hidden="true"><i /></span>
          </span>
          <b className="em-grupo-valor">{fmtValor(g.total)}</b>
          <Icone nome="abaixo" tamanho={16} />
        </summary>
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
      </details>
    </li>
  )
}

/** "Vai entrar" ou "vai sair": o título com o total, a barra dos grupos e os grupos. */
function Lado({ entrada, grupos, total, atrasado, nomeDoCartao, vazio }: {
  entrada: boolean; grupos: GrupoPrevisto[]; total: number; atrasado: number; nomeDoCartao: (id?: string) => string; vazio: string
}) {
  return (
    <section className={`em-lado ${entrada ? 'entra' : 'sai'}`}>
      <header className="em-lado-cab">
        <span className="em-lado-ic" aria-hidden="true"><Icone nome={entrada ? 'sobe' : 'desce'} tamanho={17} /></span>
        <h3>{entrada ? tx('Vai entrar') : tx('Vai sair')}</h3>
        <b>{entrada ? '+ ' : '− '}{fmtValor(total)}</b>
      </header>
      {grupos.length ? (
        <>
          <BarraDosGrupos grupos={grupos} entrada={entrada} total={total} nomeDoCartao={nomeDoCartao} />
          {atrasado > 0 && total > 0 && (
            <div className="em-vencido" style={{ '--p': Math.min(1, atrasado / total) } as CSSProperties}>
              <Icone nome="relogio" tamanho={15} />
              <span>{entrada ? tx('{0} já devia ter caído', fmtValor(atrasado)) : tx('{0} já venceu', fmtValor(atrasado))}</span>
              <span className="em-vencido-barra" aria-hidden="true"><i /></span>
              <b>{Math.round((atrasado / total) * 100)}%</b>
            </div>
          )}
          <ul className="em-grupos">{grupos.map((g) => <Grupo key={g.chave} g={g} entrada={entrada} total={total} nomeDoCartao={nomeDoCartao} />)}</ul>
        </>
      ) : <p className="em-vazio"><Icone nome="ideia" tamanho={15} /> {vazio}</p>}
    </section>
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
  const fim = atual ? c.resultado : situacao.resultado
  const falta = fim < 0
  const tomEstado = situacao.estado === 'critico' ? 'ruim' : situacao.estado === 'atencao' ? 'atencao' : situacao.estado === 'favoravel' ? 'bom' : 'neutro'
  return (
    <Modal titulo={atual ? tx('Entender previsão') : tx('Entender o mês')} aoFechar={aoFechar}>
      <div className="entender">
        {/* a resposta, primeiro */}
        <section className={`em-resposta ${falta ? 'falta' : 'sobra'}`}>
          <div className="em-resposta-topo">
            <span className="em-resposta-ic" aria-hidden="true"><Icone nome={falta ? 'alerta' : 'check'} tamanho={20} /></span>
            <span>{atual ? (falta ? tx('Pode faltar no dia {0}', dias) : tx('Deve sobrar no dia {0}', dias)) : (falta ? tx('Faltou em {0}', nomeMes) : tx('Sobrou em {0}', nomeMes))}</span>
            {situacao.selo && <span className={`em-selo ${tomEstado}`}><i aria-hidden="true" />{situacao.selo}</span>}
          </div>
          <strong className="em-resposta-valor">{falta ? '− ' : ''}{fmtValor(Math.abs(fim))}</strong>
          {situacao.motivos.length > 0 && (
            <ul className="em-motivos">
              {situacao.motivos.map((m) => (
                <li key={m.id} className={m.peso}>
                  <Icone nome={m.peso === 'critico' ? 'alerta' : m.peso === 'atencao' ? 'relogio' : m.peso === 'favoravel' ? 'check' : 'ideia'} tamanho={15} />
                  <span>{m.texto}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* a conta, em cascata */}
        {atual ? (
          <Cascata passos={[
            { rotulo: tx('Até hoje'), valor: c.referencia, tipo: 'base' },
            { rotulo: tx('Vai entrar'), valor: c.totalReceber, tipo: 'mais' },
            { rotulo: tx('Vai sair'), valor: c.totalPagar, tipo: 'menos' },
            { rotulo: tx('Fim do mês'), valor: c.resultado, tipo: 'fim' },
          ]} />
        ) : (
          <Cascata passos={[
            { rotulo: tx('Entrou'), valor: c.entrou, tipo: 'mais' },
            { rotulo: tx('Saiu'), valor: c.saiu, tipo: 'menos' },
            { rotulo: situacao.resultado < 0 ? tx('Faltou') : tx('Sobrou'), valor: situacao.resultado, tipo: 'fim' },
          ]} />
        )}
        {atual && (
          <p className="em-hoje">
            <span><i className="entra" aria-hidden="true" />{tx('Entrou')} <b>{fmtValor(c.entrou)}</b></span>
            <span><i className="sai" aria-hidden="true" />{tx('Saiu')} <b>{fmtValor(c.saiu)}</b></span>
            <span className="em-hoje-nota">{tx('em {0} até hoje', nomeMes)}</span>
          </p>
        )}

        {atual ? (
          <>
            <Lado entrada grupos={c.receber} total={c.totalReceber} atrasado={c.receberAtrasado} nomeDoCartao={nomeDoCartao}
              vazio={tx('Nenhum recebimento previsto. Cadastre o seu salário em Contas do mês para ele aparecer aqui.')} />
            <Lado entrada={false} grupos={c.pagar} total={c.totalPagar} atrasado={c.pagarAtrasado} nomeDoCartao={nomeDoCartao}
              vazio={tx('Nada a pagar previsto até o fim do mês.')} />
          </>
        ) : c.totalPagar > 0 && (
          <Lado entrada={false} grupos={c.pagar} total={c.totalPagar} atrasado={c.pagarAtrasado} nomeDoCartao={nomeDoCartao}
            vazio={tx('Nada a pagar previsto até o fim do mês.')} />
        )}

        {/* as explicações, recolhidas */}
        <details className="em-saiba">
          <summary><Icone nome="ideia" tamanho={16} /> {tx('O que a previsão considera')} <Icone nome="abaixo" tamanho={16} /></summary>
          <ul>
            <li>{tx('Só entra o que está no app: contas do mês sem baixa, parcelas de dívidas, faturas de cartão em aberto e lançamentos com data mais à frente.')}</li>
            <li>{tx('Gastos do dia a dia que ainda não foram lançados não entram. O Consultor estima esses gastos pelo seu costume.')}</li>
            <li>{tx('Cada valor conta uma vez só: conta paga sai da lista (já está no que saiu) e compra no cartão fica na fatura até ela ser paga.')}</li>
            <li>{tx('Fatura de um mês que já passou contou como saída no mês dela: mesmo atrasada, não entra de novo aqui.')}</li>
            <li>{tx('Valores em outra moeda usam a cotação do dia. Parcela atrasada leva os juros de atraso estimados, quando cadastrados.')}</li>
          </ul>
        </details>
        {situacao.selo && (
          <details className="em-saiba">
            <summary><Icone nome="bussola" tamanho={16} /> {tx('Como o app decide o estado do mês')} <Icone nome="abaixo" tamanho={16} /></summary>
            <ul>{criteriosDoEstado().map((t) => <li key={t}>{t}</li>)}</ul>
          </details>
        )}
      </div>
    </Modal>
  )
}
