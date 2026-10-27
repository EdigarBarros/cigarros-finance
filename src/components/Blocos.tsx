import { useEffect, useRef, useState } from 'react'
import type { Resumo } from '../lib/calc'
import { COR } from '../lib/charts'
import type { SituacaoDivida } from '../lib/dividas'
import { fmtBRL, fmtDataCurta, fmtUSD, MESES, MESES_CURTO, MESES_NOME } from '../lib/format'
import { CATEGORIAS, COR_BANCO, CONTAS, NOME_BANCO, NOME_CATEGORIA } from '../lib/rotulos'
import { BANCOS, TIPOS_CAIXA, type Caixa, type Lancamento, type Tipo } from '../lib/types'
import { Rosca } from './Graficos'
import { Icone } from './Icone'
import { Progresso } from './ui'

const corCategoria = Object.fromEntries(CATEGORIAS.map((c) => [c.id, c.cor]))
const porData = (a: Lancamento, b: Lancamento) =>
  (a.data ?? '').localeCompare(b.data ?? '') || (a.created_at ?? '').localeCompare(b.created_at ?? '')

/** Bloco ENTRADAS ou SAÍDAS: cabeçalho colorido, linhas descrição/valor/data e total no rodapé. */
export function QuadroLancamentos({ tipo, itens, aoNovo, aoEditar, limite }: {
  tipo: Tipo; itens: Lancamento[]; aoNovo: () => void; aoEditar: (l: Lancamento) => void
  /** No celular mostra só os mais recentes, com "ver todos". */
  limite?: number
}) {
  const saida = tipo === 'saida'
  const [aberto, setAberto] = useState(false)
  const total = itens.reduce((a, l) => a + l.valor, 0)
  const cortar = limite !== undefined && !aberto && itens.length > limite
  // No modo resumido aparecem os mais recentes primeiro.
  const visiveis = cortar ? [...itens].sort(porData).reverse().slice(0, limite) : itens
  // Saídas agrupadas por conta, como os blocos NUBANK e INTER da planilha.
  const grupos = saida && !cortar
    ? CONTAS.map((k) => ({ conta: k, itens: visiveis.filter((l) => l.conta === k.id).sort(porData) })).filter((g) => g.itens.length)
    : [{ conta: null, itens: cortar ? visiveis : [...visiveis].sort(porData) }]

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
        {limite !== undefined && itens.length > limite && (
          <button className="quadro-ver" onClick={() => setAberto(!aberto)}>
            {aberto ? 'Mostrar menos' : `Ver todos os ${itens.length}`}
          </button>
        )}
      </div>
      <footer className="quadro-total">
        <span>TOTAL</span>
        <span className="num">{fmtBRL(total)}</span>
        <span>{itens.length} {itens.length === 1 ? 'item' : 'itens'}</span>
      </footer>
    </section>
  )
}

const quando = (q: [number, number] | null) => (q ? `${MESES_CURTO[q[1] - 1].toLowerCase()}/${String(q[0]).slice(2)}` : '—')

export function TabelaDividas({ itens, aoNova, aoEditar, aoPagar }: {
  itens: SituacaoDivida[]; aoNova: () => void; aoEditar: (s: SituacaoDivida) => void; aoPagar: (s: SituacaoDivida) => void
}) {
  const parcelas = itens.filter((s) => s.restante > 0).reduce((a, s) => a + (s.divida.valor_parcela ?? 0), 0)
  const pago = itens.reduce((a, s) => a + s.pagoNoMes, 0)
  const total = itens.reduce((a, s) => a + s.restante, 0)
  return (
    <section className="bloco">
      <div className="tabela-rolagem">
        <table className="tabela-bloco tabela-dividas">
          <thead>
            <tr>
              <th>DÍVIDAS</th><th>PARCELA</th><th>PAGO NO MÊS</th><th>QUITAÇÃO</th><th>RESTANTE</th>
              <th><button className="quadro-mais" onClick={aoNova} aria-label="Nova dívida"><Icone nome="mais" tamanho={16} /></button></th>
            </tr>
          </thead>
          <tbody>
            {itens.map((s) => (
              <tr key={s.divida.id} className={s.quitadaNoMes ? 'quitada' : ''} onClick={() => aoEditar(s)}>
                <th>{s.divida.descricao}</th>
                <td>{s.divida.valor_parcela ? fmtBRL(s.divida.valor_parcela) : '—'}</td>
                <td>{s.pagoNoMes ? fmtBRL(s.pagoNoMes) : '—'}</td>
                <td>{s.quitadaNoMes ? 'quitada ✓' : quando(s.quitacao)}</td>
                <td>{fmtBRL(s.restante)}</td>
                <td>
                  {!s.quitadaNoMes && (
                    <button className="pagar" title="Registrar pagamento" onClick={(e) => { e.stopPropagation(); aoPagar(s) }}>pagar</button>
                  )}
                </td>
              </tr>
            ))}
            {!itens.length && (
              <tr className="sem-dados"><td colSpan={6}>Nenhuma dívida em aberto. Toque em + para adicionar.</td></tr>
            )}
          </tbody>
          <tfoot>
            <tr><th>TOTAL</th><td>{fmtBRL(parcelas)}</td><td>{fmtBRL(pago)}</td><td /><td>{fmtBRL(total)}</td><td /></tr>
          </tfoot>
        </table>
      </div>
    </section>
  )
}

/** Dívidas em formato de lista (celular). */
export function ListaDividas({ itens, aoEditar, aoPagar, aoNova }: {
  itens: SituacaoDivida[]; aoEditar: (s: SituacaoDivida) => void; aoPagar: (s: SituacaoDivida) => void; aoNova: () => void
}) {
  const total = itens.reduce((a, s) => a + s.restante, 0)
  return (
    <section className="bloco lista-dividas">
      <header className="bloco-cab">
        <span>DÍVIDAS</span>
        <strong>{fmtBRL(total)}</strong>
        <button className="quadro-mais" onClick={aoNova} aria-label="Nova dívida"><Icone nome="mais" tamanho={16} /></button>
      </header>
      {!itens.length && <p className="quadro-vazio">Nenhuma dívida em aberto 🎉</p>}
      {itens.map((s) => (
        <div key={s.divida.id} className={`divida-linha ${s.quitadaNoMes ? 'quitada' : ''}`}>
          <button className="divida-linha-info" onClick={() => aoEditar(s)}>
            <span className="divida-linha-nome">{s.divida.descricao}</span>
            <span className="divida-linha-valor">{s.quitadaNoMes ? 'quitada ✓' : fmtBRL(s.restante)}</span>
            <Progresso valor={s.saldoInicial - s.restante} total={s.saldoInicial} cor={s.quitadaNoMes ? COR.entradas : COR.divida} />
            <span className="divida-linha-sub">
              {s.pagoNoMes ? `pago no mês ${fmtBRL(s.pagoNoMes)}` : 'nada pago no mês'}
              {s.quitacao && ` · acaba em ${quando(s.quitacao)}`}
            </span>
          </button>
          {!s.quitadaNoMes && <button className="pagar" onClick={() => aoPagar(s)}>pagar</button>}
        </div>
      ))}
    </section>
  )
}

/** Caixa por banco. No celular mostra só o total de cada banco. */
export function QuadroCaixa({ caixa, total, herdadoDe, compacto, aoAbrir }: {
  caixa: Caixa; total: number; herdadoDe: [number, number] | null; compacto?: boolean; aoAbrir: () => void
}) {
  const nomes = { cc: 'CONTA CORRENTE', caixinha: 'CAIXINHA', reserva: 'RESERVA DE EMERGÊNCIA' }
  const aviso = herdadoDe && (
    <p className="aviso-herdado">Valores de {MESES_NOME[herdadoDe[1] - 1].toLowerCase()}/{herdadoDe[0]} — <button className="link" onClick={aoAbrir}>atualizar</button></p>
  )
  if (compacto) {
    return (
      <section className="bloco">
        <header className="bloco-cab"><span style={{ color: COR.caixa }}>CAIXA</span><strong>{fmtBRL(total)}</strong></header>
        <div className="caixa-bancos">
          {BANCOS.map((b) => (
            <button key={b} onClick={aoAbrir}>
              <span><i className="marcador" style={{ background: COR_BANCO[b] }} />{NOME_BANCO[b]}</span>
              <strong>{fmtBRL(TIPOS_CAIXA.reduce((a, t) => a + (caixa[b]?.[t] ?? 0), 0))}</strong>
            </button>
          ))}
        </div>
        {aviso}
      </section>
    )
  }
  return (
    <section className="bloco">
      <div className="tabela-rolagem">
        <table className="tabela-bloco tabela-caixa">
          <thead>
            <tr>
              <th>CAIXA</th>
              {BANCOS.map((b) => <th key={b} style={{ color: COR_BANCO[b] }}>{NOME_BANCO[b].toUpperCase()}</th>)}
            </tr>
          </thead>
          <tbody>
            {TIPOS_CAIXA.map((t) => (
              <tr key={t} onClick={aoAbrir}>
                <th>{nomes[t]}</th>
                {BANCOS.map((b) => <td key={b} className={caixa[b]?.[t] ? '' : 'vazio'}>{fmtBRL(caixa[b]?.[t] ?? 0)}</td>)}
              </tr>
            ))}
          </tbody>
          <tfoot><tr><th>TOTAL</th><td colSpan={3}>{fmtBRL(total)}</td></tr></tfoot>
        </table>
      </div>
      {aviso}
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
  // Rola até o mês aberto (no celular a tabela não cabe inteira).
  const caixa = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = caixa.current
    const col = el?.querySelector('thead th.atual') as HTMLElement | null
    if (el && col && el.scrollWidth > el.clientWidth) el.scrollTo({ left: col.offsetLeft - el.clientWidth / 2 + col.clientWidth, behavior: 'smooth' })
  }, [mesAtual])
  return (
    <div className="tabela-rolagem" ref={caixa}>
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
