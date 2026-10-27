import { restantes, totalDivida, type Resumo } from '../lib/calc'
import { COR } from '../lib/charts'
import { fmtBRL, fmtDataCurta, fmtUSD, MESES, MESES_NOME } from '../lib/format'
import { CATEGORIAS, CONTAS, NOME_CATEGORIA } from '../lib/rotulos'
import type { Divida, Lancamento, Tipo } from '../lib/types'
import { Rosca } from './Graficos'
import { Icone } from './Icone'

const corCategoria = Object.fromEntries(CATEGORIAS.map((c) => [c.id, c.cor]))
const porData = (a: Lancamento, b: Lancamento) =>
  (a.data ?? '').localeCompare(b.data ?? '') || (a.created_at ?? '').localeCompare(b.created_at ?? '')

/** Bloco ENTRADAS ou SAÍDAS: cabeçalho colorido, linhas descrição/valor/data e total no rodapé. */
export function QuadroLancamentos({ tipo, itens, aoNovo, aoEditar }: {
  tipo: Tipo; itens: Lancamento[]; aoNovo: () => void; aoEditar: (l: Lancamento) => void
}) {
  const saida = tipo === 'saida'
  const total = itens.reduce((a, l) => a + l.valor, 0)
  // Saídas agrupadas por conta, como os blocos NUBANK e INTER da planilha.
  const grupos = saida
    ? CONTAS.map((k) => ({ conta: k, itens: itens.filter((l) => l.conta === k.id).sort(porData) })).filter((g) => g.itens.length)
    : [{ conta: null, itens: [...itens].sort(porData) }]

  return (
    <section className={`quadro quadro-${tipo}`}>
      <header className="quadro-cab">
        <span>{saida ? 'SAÍDAS' : 'ENTRADAS'}</span>
        <span className="num">VALOR</span>
        <span>DATA</span>
        <button className="quadro-mais" onClick={aoNovo} aria-label={`Nova ${saida ? 'saída' : 'entrada'}`}><Icone nome="mais" tamanho={16} /></button>
      </header>
      <div className="quadro-corpo">
        {!itens.length && <p className="quadro-vazio">Nenhuma {saida ? 'saída' : 'entrada'} neste mês.</p>}
        {grupos.map((g) => (
          <div key={g.conta?.id ?? 'todas'}>
            {g.conta && grupos.length > 1 && (
              <div className="quadro-grupo" style={{ '--c': g.conta.cor } as React.CSSProperties}>
                <i className="marcador" />{g.conta.nome.toUpperCase()}
                <span>{fmtBRL(g.itens.reduce((a, l) => a + l.valor, 0))}</span>
              </div>
            )}
            {g.itens.map((l) => (
              <button key={l.id} className="quadro-linha" onClick={() => aoEditar(l)}>
                <span className="quadro-desc">
                  {saida && <i className="marcador" style={{ background: corCategoria[l.categoria] }} title={NOME_CATEGORIA[l.categoria]} />}
                  {l.descricao || '—'}
                </span>
                <span className="num">{fmtBRL(l.valor)}</span>
                <span className="quadro-data">{fmtDataCurta(l.data)}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
      <footer className="quadro-total">
        <span>TOTAL</span>
        <span className="num">{fmtBRL(total)}</span>
        <span>{itens.length} {itens.length === 1 ? 'item' : 'itens'}</span>
      </footer>
    </section>
  )
}

export function TabelaDividas({ itens, aoNova, aoEditar, aoPagar }: {
  itens: Divida[]; aoNova: () => void; aoEditar: (d: Divida) => void; aoPagar: (d: Divida) => void
}) {
  const mensal = itens.filter((d) => restantes(d) > 0).reduce((a, d) => a + d.valor_mensal, 0)
  const total = itens.reduce((a, d) => a + totalDivida(d), 0)
  return (
    <section className="bloco">
      <div className="tabela-rolagem">
        <table className="tabela-bloco tabela-dividas">
          <thead>
            <tr>
              <th>DÍVIDAS</th><th>VALOR MENSAL</th><th>PARCELAS</th><th>PAGAS</th><th>RESTANTES</th><th>TOTAL</th>
              <th><button className="quadro-mais" onClick={aoNova} aria-label="Nova dívida"><Icone nome="mais" tamanho={16} /></button></th>
            </tr>
          </thead>
          <tbody>
            {itens.map((d) => (
              <tr key={d.id} className={restantes(d) <= 0 ? 'quitada' : ''} onClick={() => aoEditar(d)}>
                <th>{d.descricao}</th>
                <td>{fmtBRL(d.valor_mensal)}</td>
                <td>{d.parcelas}</td>
                <td>{d.pagas}</td>
                <td>{restantes(d)}</td>
                <td>{fmtBRL(totalDivida(d))}</td>
                <td>
                  {restantes(d) > 0 && (
                    <button className="pagar" title="Marcar uma parcela como paga" onClick={(e) => { e.stopPropagation(); aoPagar(d) }}>+1</button>
                  )}
                </td>
              </tr>
            ))}
            {!itens.length && (
              <tr className="sem-dados"><td colSpan={7}>Nenhuma dívida neste mês. Toque em + para adicionar.</td></tr>
            )}
          </tbody>
          <tfoot>
            <tr><th>TOTAL</th><td>{fmtBRL(mensal)}</td><td /><td /><td /><td>{fmtBRL(total)}</td><td /></tr>
          </tfoot>
        </table>
      </div>
    </section>
  )
}

export function Metricas({ r, mes }: { r: Resumo; mes: number }) {
  // Mesma ordem e cores da planilha.
  const itens = [
    { nome: 'Transporte', valor: r.metricas.transporte, cor: corCategoria.transporte },
    { nome: 'Dívidas', valor: r.metricas.divida, cor: corCategoria.divida },
    { nome: 'Alimentação', valor: r.metricas.alimentacao, cor: corCategoria.alimentacao },
    { nome: 'Outros', valor: r.metricas.outros, cor: corCategoria.outros },
  ]
  return (
    <section className="bloco">
      <table className="tabela-bloco tabela-metricas">
        <thead><tr><th>MÉTRICAS</th><th>VALOR</th><th>%</th></tr></thead>
        <tbody>
          {itens.map((i) => (
            <tr key={i.nome}>
              <th><i className="marcador" style={{ background: i.cor }} />{i.nome.toUpperCase()}</th>
              <td>{fmtBRL(i.valor)}</td>
              <td>{r.saidas ? `${Math.round((i.valor / r.saidas) * 100)}%` : '–'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3 className="bloco-titulo">MÉTRICAS - {MESES[mes - 1]}</h3>
      {r.saidas > 0 ? <Rosca fatias={itens} /> : <p className="quadro-vazio">Sem saídas neste mês.</p>}
    </section>
  )
}

const LINHAS_ANUAIS: { nome: string; cor: string; valor: (r: Resumo) => string }[] = [
  { nome: 'ENTRADAS', cor: COR.entradas, valor: (r) => fmtBRL(r.entradas) },
  { nome: 'SAÍDAS', cor: COR.saidas, valor: (r) => fmtBRL(r.saidas) },
  { nome: 'FLUXO DE CAIXA', cor: COR.fluxo, valor: (r) => fmtBRL(r.fluxo) },
  { nome: 'CAIXA', cor: COR.caixa, valor: (r) => fmtBRL(r.caixa) },
  { nome: 'DÍVIDA', cor: COR.divida, valor: (r) => fmtBRL(r.divida) },
  { nome: 'INVESTIMENTOS', cor: COR.investimentos, valor: (r) => fmtBRL(r.investimentos) },
  { nome: 'US$', cor: COR.usd, valor: (r) => fmtUSD(r.usd) },
]

/** Resumo do ano: uma linha colorida por indicador, uma coluna por mês. */
export function TabelaAnual({ porMes, mesAtual, aoClicarMes }: {
  porMes: (Resumo | null)[]; mesAtual: number; aoClicarMes: (m: number) => void
}) {
  return (
    <div className="tabela-rolagem">
      <table className="tabela-anual">
        <thead>
          <tr>
            <th />
            {MESES.map((m, i) => (
              <th key={m} className={i + 1 === mesAtual ? 'atual' : ''}>
                <button onClick={() => aoClicarMes(i + 1)} title={`Abrir ${MESES_NOME[i]}`}>{m}</button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {LINHAS_ANUAIS.map((l) => (
            <tr key={l.nome} style={{ '--c': l.cor } as React.CSSProperties}>
              <th>{l.nome}</th>
              {porMes.map((r, i) => (
                <td key={i} className={`${i + 1 === mesAtual ? 'atual' : ''} ${r ? '' : 'vazio'}`}>
                  {r ? l.valor(r) : l.nome === 'US$' ? fmtUSD(0) : fmtBRL(0)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
