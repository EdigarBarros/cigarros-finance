/**
 * "Comparado com outubro": os gastos do mês contra o mês anterior, no mesmo intervalo de dias (lib/comparacao.ts). Mostra a
 * variação do total e as categorias que mais mudaram; tocar numa categoria abre os lançamentos dos dois lados, para a
 * pessoa ver de onde veio a mudança. Equilibrado: o total e os dois destaques. Detalhado: todas as categorias que mudaram.
 */
import { useState, type CSSProperties } from 'react'
import type { ComparacaoDeGastos, LinhaComparada } from '../lib/comparacao'
import { SEM_CATEGORIA } from '../lib/categorias'
import { fmtDataCurta, fmtValor, MESES_CURTO, MESES_NOME, noMeioDaFrase } from '../lib/format'
import type { Categoria, Lancamento } from '../lib/types'
import { IconeCategoria } from './IconeCategoria'
import { Icone } from './Icone'
import { tx } from '../lib/textos'
import './comparacao.css'

/** Lançamentos mostrados de cada lado ao abrir uma categoria. */
const POR_LADO = 5
/** Categorias no detalhado antes do "Ver todas". */
const CATEGORIAS_DETALHADO = 6

const comSinal = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${fmtValor(Math.abs(n))}`

function Lancs({ titulo, lancs }: { titulo: string; lancs: Lancamento[] }) {
  return (
    <div className="cmp-lado">
      <span className="cmp-lado-tit">{titulo}</span>
      {!lancs.length ? <p className="cmp-nada">{tx('Nenhum gasto')}</p> : (
        <ul>
          {lancs.slice(0, POR_LADO).map((l) => (
            <li key={l.id}><span className="cmp-l-data">{l.data ? fmtDataCurta(l.data) : '—'}</span><span className="cmp-l-desc">{l.descricao}</span><b>{fmtValor(l.valor)}</b></li>
          ))}
          {lancs.length > POR_LADO && <li className="cmp-l-mais">{tx('e mais {0}', lancs.length - POR_LADO)}</li>}
        </ul>
      )}
    </div>
  )
}

function Linha({ x, cat, rotuloAtual, rotuloAnterior, aberta, aoAbrir, frase }: {
  x: LinhaComparada; cat: { nome: string; icone: string; cor: string }
  rotuloAtual: string; rotuloAnterior: string; aberta: boolean; aoAbrir: () => void
  /** Frase no lugar do nome (os destaques do equilibrado). */
  frase?: string
}) {
  const sobe = x.diferenca > 0
  return (
    <li className={`cmp-linha${aberta ? ' aberta' : ''}`}>
      <button type="button" className="cmp-linha-botao" aria-expanded={aberta} onClick={aoAbrir}>
        <span className="cmp-ic" style={{ '--c': cat.cor } as CSSProperties}><IconeCategoria emoji={cat.icone} tamanho={16} /></span>
        <span className="cmp-nome">{frase ?? cat.nome}<small>{fmtValor(x.anterior)} → {fmtValor(x.atual)}</small></span>
        <span className={`cmp-dif ${sobe ? 'sobe' : 'desce'}`}>
          <Icone nome={sobe ? 'sobe' : 'desce'} tamanho={13} />{comSinal(x.diferenca)}
        </span>
        <Icone nome={aberta ? 'cima' : 'abaixo'} tamanho={16} />
      </button>
      {aberta && (
        <div className="cmp-detalhe">
          <Lancs titulo={rotuloAtual} lancs={x.lancsAtual} />
          <Lancs titulo={rotuloAnterior} lancs={x.lancsAnterior} />
        </div>
      )}
    </li>
  )
}

export function ComparacaoMes({ comp, categorias, detalhado, atrasadas = 0, aoVerLancamentos }: {
  comp: ComparacaoDeGastos
  categorias: Categoria[]
  detalhado?: boolean
  /** Contas a pagar já vencidas e sem baixa no mês de hoje: ainda não estão nos gastos (o "gastou menos" pode ser só isso). */
  atrasadas?: number
  aoVerLancamentos: () => void
}) {
  const [aberta, setAberta] = useState<string | null>(null)
  const [todas, setTodas] = useState(false)
  const nomeAnt = noMeioDaFrase(MESES_NOME[comp.mesAnterior - 1])
  const curtoAnt = noMeioDaFrase(MESES_CURTO[comp.mesAnterior - 1])
  const curtoAtual = noMeioDaFrase(MESES_CURTO[comp.mes - 1])
  const cat = (id: string) => {
    const c = categorias.find((k) => k.id === id)
    return c ? { nome: c.nome, icone: c.icone, cor: c.cor } : { ...SEM_CATEGORIA, nome: tx('Sem categoria') }
  }
  const periodo = comp.ateDia !== null
    ? tx('De 1 a {0} de {1} contra 1 a {2} de {3}.', comp.ateDia, curtoAtual, comp.ateDiaAnterior, curtoAnt)
    : tx('O mês inteiro contra {0} inteiro.', nomeAnt)
  const rotuloAtual = comp.ateDia !== null ? tx('{0}, até o dia {1}', curtoAtual, comp.ateDia) : curtoAtual
  const rotuloAnterior = comp.ateDiaAnterior !== null ? tx('{0}, até o dia {1}', curtoAnt, comp.ateDiaAnterior) : curtoAnt

  let principal: string
  let tom: 'sobe' | 'desce' | 'igual' = 'igual'
  if (comp.semBase) principal = tx('Sem lançamentos em {0} para comparar.', nomeAnt)
  else if (comp.variacao === null) {
    principal = comp.atual > 0
      ? (comp.ateDia !== null ? tx('Em {0}, nada tinha saído até o dia {1}; agora saiu {2}.', nomeAnt, comp.ateDiaAnterior, fmtValor(comp.atual)) : tx('Em {0} não houve gastos; agora saiu {1}.', nomeAnt, fmtValor(comp.atual)))
      : tx('Nenhum gasto nos dois períodos.')
  } else {
    const p = Math.round(Math.abs(comp.variacao) * 100)
    if (p === 0) principal = comp.ateDia !== null ? tx('Gastos iguais aos do mesmo período de {0}.', nomeAnt) : tx('Gastos iguais aos de {0}.', nomeAnt)
    else if (comp.variacao > 0) { tom = 'sobe'; principal = comp.ateDia !== null ? tx('Gastos {0}% maiores que no mesmo período de {1}.', p, nomeAnt) : tx('Gastos {0}% maiores que em {1}.', p, nomeAnt) }
    else { tom = 'desce'; principal = comp.ateDia !== null ? tx('Gastos {0}% menores que no mesmo período de {1}.', p, nomeAnt) : tx('Gastos {0}% menores que em {1}.', p, nomeAnt) }
  }

  const mudaram = comp.categorias.filter((x) => x.diferenca !== 0)
  const visiveis = todas ? mudaram : mudaram.slice(0, CATEGORIAS_DETALHADO)
  const alternar = (id: string) => setAberta(aberta === id ? null : id)

  return (
    <section className="bloco comparacao-mes" aria-label={tx('Comparado com {0}', nomeAnt)}>
      <header className="bloco-cab">
        <h2>{tx('Comparado com {0}', nomeAnt)}</h2>
      </header>
      <div className="cmp-corpo">
        <p className={`cmp-principal ${tom}`}>
          {tom !== 'igual' && <Icone nome={tom === 'sobe' ? 'sobe' : 'desce'} tamanho={16} />}
          <span>{principal}</span>
        </p>
        {!comp.semBase && (
          <p className="cmp-valores">
            <span>{rotuloAtual} <b>{fmtValor(comp.atual)}</b></span>
            <span>{rotuloAnterior} <b>{fmtValor(comp.anterior)}</b></span>
          </p>
        )}
        <p className="cmp-periodo">{periodo} {tx('Conta as saídas lançadas, com as compras no cartão; dinheiro guardado não entra.')}</p>
        {atrasadas > 0 && !comp.semBase && (
          <p className="cmp-aviso"><Icone nome="relogio" tamanho={14} />{' '}
            {atrasadas === 1
              ? tx('1 conta vencida ainda não foi paga (ou não teve baixa): quando for, ela entra nos gastos e a comparação muda.')
              : tx('{0} contas vencidas ainda não foram pagas (ou não tiveram baixa): quando forem, elas entram nos gastos e a comparação muda.', atrasadas)}
          </p>
        )}

        {!comp.semBase && !detalhado && (comp.maiorAlta || comp.maiorQueda) && (
          <ul className="cmp-lista">
            {comp.maiorAlta && (
              <Linha x={comp.maiorAlta} cat={cat(comp.maiorAlta.id)} rotuloAtual={rotuloAtual} rotuloAnterior={rotuloAnterior}
                aberta={aberta === `+${comp.maiorAlta.id}`} aoAbrir={() => alternar(`+${comp.maiorAlta!.id}`)}
                frase={tx('Seus gastos com {0} aumentaram', cat(comp.maiorAlta.id).nome)} />
            )}
            {comp.maiorQueda && (
              <Linha x={comp.maiorQueda} cat={cat(comp.maiorQueda.id)} rotuloAtual={rotuloAtual} rotuloAnterior={rotuloAnterior}
                aberta={aberta === `-${comp.maiorQueda.id}`} aoAbrir={() => alternar(`-${comp.maiorQueda!.id}`)}
                frase={tx('A maior redução foi em {0}', cat(comp.maiorQueda.id).nome)} />
            )}
          </ul>
        )}
        {!comp.semBase && detalhado && mudaram.length > 0 && (
          <ul className="cmp-lista">
            {visiveis.map((x) => (
              <Linha key={x.id} x={x} cat={cat(x.id)} rotuloAtual={rotuloAtual} rotuloAnterior={rotuloAnterior}
                aberta={aberta === x.id} aoAbrir={() => alternar(x.id)} />
            ))}
          </ul>
        )}
        <div className="cmp-pe">
          {detalhado && mudaram.length > CATEGORIAS_DETALHADO && (
            <button type="button" className="link" onClick={() => setTodas(!todas)}>
              {todas ? tx('Mostrar menos') : tx('Ver todas as {0} categorias', mudaram.length)}
            </button>
          )}
          <button type="button" className="link" onClick={aoVerLancamentos}>{tx('Ver lançamentos')}</button>
        </div>
      </div>
    </section>
  )
}
