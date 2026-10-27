import { useEffect, useRef, useState } from 'react'
import { caixaDoBanco, type Resumo } from '../lib/calc'
import { COR } from '../lib/charts'
import type { SituacaoDivida } from '../lib/dividas'
import { fmtDataCurta, fmtMoeda, fmtValor, MESES, MESES_CURTO, MESES_NOME } from '../lib/format'
import { converter, infoMoeda, type Taxas } from '../lib/moedas'
import type { Visao } from '../lib/perfil'
import { fatiasDeGastos, SEM_CATEGORIA } from '../lib/categorias'
import { TIPOS_CAIXA, type Banco, type Caixa, type Categoria, type Lancamento, type Tipo } from '../lib/types'
import { Rosca } from './Graficos'
import { Icone } from './Icone'
import { Progresso } from './ui'

const porData = (a: Lancamento, b: Lancamento) =>
  (a.data ?? '').localeCompare(b.data ?? '') || (a.created_at ?? '').localeCompare(b.created_at ?? '')

/** Bloco ENTRADAS ou SAÍDAS: cabeçalho colorido, linhas descrição/valor/data e total no rodapé. */
export function QuadroLancamentos({ tipo, itens, aoNovo, aoEditar, limite, categoriaDe }: {
  tipo: Tipo; itens: Lancamento[]; aoNovo: () => void; aoEditar: (l: Lancamento) => void
  categoriaDe: (l: Lancamento) => Categoria | undefined
  /** No celular mostra só os mais recentes, com "ver todos". */
  limite?: number
}) {
  const saida = tipo === 'saida'
  const [aberto, setAberto] = useState(false)
  const total = itens.reduce((a, l) => a + l.valor, 0)
  const cortar = limite !== undefined && !aberto && itens.length > limite
  // No modo resumido aparecem os mais recentes primeiro.
  const visiveis = cortar ? [...itens].sort(porData).reverse().slice(0, limite) : [...itens].sort(porData)

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
        {visiveis.map((l) => {
          const c = categoriaDe(l) ?? SEM_CATEGORIA
          return (
          <button key={l.id} className="quadro-linha" onClick={() => aoEditar(l)}>
            <span className="quadro-desc">
              <i className="marcador" style={{ background: c.cor }} title={c.nome} />
              {l.descricao || '—'}
            </span>
            <span className="num">{fmtValor(l.valor)}</span>
            <span className="quadro-data">{fmtDataCurta(l.data)}</span>
          </button>
          )
        })}
        {limite !== undefined && itens.length > limite && (
          <button className="quadro-ver" onClick={() => setAberto(!aberto)}>
            {aberto ? 'Mostrar menos' : `Ver todos os ${itens.length}`}
          </button>
        )}
      </div>
      <footer className="quadro-total">
        <span>TOTAL</span>
        <span className="num">{fmtValor(total)}</span>
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
                <td>{s.divida.valor_parcela ? fmtValor(s.divida.valor_parcela) : '—'}</td>
                <td>{s.pagoNoMes ? fmtValor(s.pagoNoMes) : '—'}</td>
                <td>{s.quitadaNoMes ? 'quitada ✓' : quando(s.quitacao)}</td>
                <td>{fmtValor(s.restante)}</td>
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
            <tr><th>TOTAL</th><td>{fmtValor(parcelas)}</td><td>{fmtValor(pago)}</td><td /><td>{fmtValor(total)}</td><td /></tr>
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
        <strong>{fmtValor(total)}</strong>
        <button className="quadro-mais" onClick={aoNova} aria-label="Nova dívida"><Icone nome="mais" tamanho={16} /></button>
      </header>
      {!itens.length && <p className="quadro-vazio">Nenhuma dívida em aberto 🎉</p>}
      {itens.map((s) => (
        <div key={s.divida.id} className={`divida-linha ${s.quitadaNoMes ? 'quitada' : ''}`}>
          <button className="divida-linha-info" onClick={() => aoEditar(s)}>
            <span className="divida-linha-nome">{s.divida.descricao}</span>
            <span className="divida-linha-valor">{s.quitadaNoMes ? 'quitada ✓' : fmtValor(s.restante)}</span>
            <Progresso valor={s.saldoInicial - s.restante} total={s.saldoInicial} cor={s.quitadaNoMes ? COR.entradas : COR.divida} />
            <span className="divida-linha-sub">
              {s.pagoNoMes ? `pago no mês ${fmtValor(s.pagoNoMes)}` : 'nada pago no mês'}
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
export function QuadroCaixa({ caixa, bancos, total, herdadoDe, compacto, aoAbrir }: {
  caixa: Caixa; bancos: Banco[]; total: number; herdadoDe: [number, number] | null; compacto?: boolean; aoAbrir: () => void
}) {
  const nomes = { cc: 'CONTA CORRENTE', caixinha: 'CAIXINHA', reserva: 'RESERVA DE EMERGÊNCIA' }
  const aviso = herdadoDe && (
    <p className="aviso-herdado">Valores de {MESES_NOME[herdadoDe[1] - 1].toLowerCase()}/{herdadoDe[0]} — <button className="link" onClick={aoAbrir}>atualizar</button></p>
  )
  if (!bancos.length) {
    return (
      <section className="bloco">
        <header className="bloco-cab"><span style={{ color: COR.caixa }}>CAIXA</span><strong>{fmtValor(total)}</strong></header>
        <p className="quadro-vazio">Cadastre seus bancos para acompanhar o saldo de cada um. <button className="link" onClick={aoAbrir}>Cadastrar</button></p>
      </section>
    )
  }
  if (compacto || bancos.length > 4) {
    return (
      <section className="bloco">
        <header className="bloco-cab"><span style={{ color: COR.caixa }}>CAIXA</span><strong>{fmtValor(total)}</strong></header>
        <div className="caixa-bancos">
          {bancos.map((b) => (
            <button key={b.id} onClick={aoAbrir}>
              <span><i className="marcador" style={{ background: b.cor }} />{b.nome}</span>
              <strong>{fmtValor(caixaDoBanco(caixa, b.id))}</strong>
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
              {bancos.map((b) => <th key={b.id} style={{ color: b.cor }}>{b.nome.toUpperCase()}</th>)}
            </tr>
          </thead>
          <tbody>
            {TIPOS_CAIXA.map((t) => (
              <tr key={t} onClick={aoAbrir}>
                <th>{nomes[t]}</th>
                {bancos.map((b) => <td key={b.id} className={caixa[b.id]?.[t] ? '' : 'vazio'}>{fmtValor(caixa[b.id]?.[t] ?? 0)}</td>)}
              </tr>
            ))}
          </tbody>
          <tfoot><tr><th>TOTAL</th><td colSpan={bancos.length}>{fmtValor(total)}</td></tr></tfoot>
        </table>
      </div>
      {aviso}
    </section>
  )
}

/** Quanto entrou e saiu por banco no mês (lançamentos sem banco ficam em "Sem banco"). */
export function PorBanco({ bancos, lancs, caixa, aoAbrir }: {
  bancos: Banco[]; lancs: Lancamento[]; caixa: Caixa; aoAbrir: (id: string | null) => void
}) {
  const linhas = [
    ...bancos.map((b) => ({ id: b.id as string | null, nome: b.nome, cor: b.cor, ls: lancs.filter((l) => l.banco_id === b.id) })),
    { id: null, nome: 'Sem banco', cor: '#55555f', ls: lancs.filter((l) => !l.banco_id || !bancos.some((b) => b.id === l.banco_id)) },
  ].filter((x) => x.ls.length || (x.id && caixaDoBanco(caixa, x.id)))
  const maior = Math.max(1, ...linhas.flatMap((x) => [somaTipo(x.ls, 'entrada'), somaTipo(x.ls, 'saida')]))
  return (
    <section className="bloco">
      <header className="bloco-cab"><span>POR BANCO</span><span className="bloco-cab-leg"><i style={{ background: COR.entradas }} />entrou <i style={{ background: COR.saidas }} />saiu</span></header>
      {!linhas.length && <p className="quadro-vazio">Nenhum lançamento neste mês.</p>}
      {linhas.map((x) => {
        const ent = somaTipo(x.ls, 'entrada')
        const sai = somaTipo(x.ls, 'saida')
        return (
          <button key={x.id ?? 'sem'} className="banco-linha" onClick={() => aoAbrir(x.id)}>
            <span className="banco-linha-nome"><i className="marcador" style={{ background: x.cor }} />{x.nome}</span>
            <span className={`banco-linha-saldo ${ent - sai < 0 ? 'negativo' : ''}`}>{fmtValor(ent - sai)}</span>
            <span className="banco-barras">
              <span style={{ width: `${(ent / maior) * 100}%`, background: COR.entradas }} />
              <span style={{ width: `${(sai / maior) * 100}%`, background: COR.saidas }} />
            </span>
            <span className="banco-linha-sub">+{fmtValor(ent)} · −{fmtValor(sai)}</span>
          </button>
        )
      })}
    </section>
  )
}

/** Quanto a pessoa tem em cada outra moeda e quanto isso vale na principal, com a meta em dólar. */
export function BlocoMoedas({ moedas, lista, taxas, metaUsd, aoAbrir }: {
  moedas: Record<string, number>; lista: string[]; taxas: Taxas; metaUsd: number; aoAbrir: () => void
}) {
  const total = lista.reduce((a, m) => a + (converter(moedas[m] ?? 0, m, taxas) ?? 0), 0)
  const usd = moedas.USD ?? 0
  return (
    <section className="bloco">
      <header className="bloco-cab"><span style={{ color: COR.usd }}>OUTRAS MOEDAS</span><strong>≈ {fmtValor(total)}</strong></header>
      {lista.map((m) => {
        const i = infoMoeda(m)
        const valor = moedas[m] ?? 0
        const conv = converter(valor, m, taxas)
        return (
          <button key={m} className="banco-linha" onClick={aoAbrir}>
            <span className="banco-linha-nome">{i.bandeira}&nbsp;&nbsp;{i.nome}</span>
            <span className="banco-linha-saldo">{fmtMoeda(valor, m)}</span>
            <span className="banco-linha-sub">
              {conv === null ? 'Sem cotação agora' : `≈ ${fmtValor(conv)} · 1 ${m} = ${fmtValor(taxas[m])}`}
            </span>
          </button>
        )
      })}
      {metaUsd > 0 && lista.includes('USD') && (
        <div className="meta meta-bloco">
          <h3 className="bloco-titulo">META EM DÓLAR</h3>
          <div><strong>{fmtMoeda(usd, 'USD')}</strong><span> de {fmtMoeda(metaUsd, 'USD')}</span></div>
          <Progresso valor={usd} total={metaUsd} cor={COR.usd} />
          <p className="barras-sub">{usd >= metaUsd ? 'Meta batida! 🎉' : `Faltam ${fmtMoeda(metaUsd - usd, 'USD')}`}</p>
        </div>
      )}
    </section>
  )
}

const somaTipo = (ls: Lancamento[], t: Tipo) => ls.filter((l) => l.tipo === t).reduce((a, l) => a + l.valor, 0)

/** Gasto de cada categoria no mês (todas na tabela; as maiores no gráfico). */
export function Metricas({ r, mes, categorias, aoEditar }: { r: Resumo; mes: number; categorias: Categoria[]; aoEditar: () => void }) {
  const itens = fatiasDeGastos(r.gastosPorCategoria, categorias, Infinity)
  return (
    <section className="bloco">
      <table className="tabela-bloco tabela-metricas">
        <thead><tr><th>MÉTRICAS</th><th>VALOR</th><th>%</th></tr></thead>
        <tbody>
          {itens.map((i) => (
            <tr key={i.nome}>
              <th><i className="marcador" style={{ background: i.cor }} />{i.icone}&nbsp;{i.nome.toUpperCase()}</th>
              <td>{fmtValor(i.valor)}</td>
              <td>{r.saidas ? `${Math.round((i.valor / r.saidas) * 100)}%` : '–'}</td>
            </tr>
          ))}
          {!itens.length && <tr className="sem-dados"><td colSpan={3}>Sem saídas neste mês.</td></tr>}
        </tbody>
      </table>
      <h3 className="bloco-titulo">MÉTRICAS - {MESES[mes - 1]}</h3>
      {r.saidas > 0 ? <Rosca fatias={fatiasDeGastos(r.gastosPorCategoria, categorias)} /> : <p className="quadro-vazio">Sem saídas neste mês.</p>}
      <p className="aviso-herdado"><button className="link" onClick={aoEditar}>Editar categorias</button></p>
    </section>
  )
}

const LINHAS_ANUAIS: { nome: string; cor: string; valor: (r: Resumo) => number; mostrar?: (v: Visao) => boolean }[] = [
  { nome: 'ENTRADAS', cor: COR.entradas, valor: (r) => r.entradas },
  { nome: 'SAÍDAS', cor: COR.saidas, valor: (r) => r.saidas },
  { nome: 'SOBROU', cor: COR.fluxo, valor: (r) => r.fluxo },
  { nome: 'CAIXA', cor: COR.caixa, valor: (r) => r.caixa, mostrar: (v) => v.bancos },
  { nome: 'DÍVIDA', cor: COR.divida, valor: (r) => r.divida, mostrar: (v) => v.dividas },
  { nome: 'INVESTIMENTOS', cor: COR.investimentos, valor: (r) => r.investimentos, mostrar: (v) => v.investimentos },
  { nome: 'OUTRAS MOEDAS', cor: COR.usd, valor: (r) => r.moedasConvertido, mostrar: (v) => v.moedas },
]

/** Resumo do ano: uma linha colorida por indicador (dos módulos ligados), uma coluna por mês. */
export function TabelaAnual({ porMes, mesAtual, aoClicarMes, v }: {
  porMes: (Resumo | null)[]; mesAtual: number; aoClicarMes: (m: number) => void; v: Visao
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
          {LINHAS_ANUAIS.filter((l) => !l.mostrar || l.mostrar(v)).map((l) => (
            <tr key={l.nome} style={{ '--c': l.cor } as React.CSSProperties}>
              <th>{l.nome}</th>
              {porMes.map((r, i) => (
                <td key={i} className={`${i + 1 === mesAtual ? 'atual' : ''} ${r ? '' : 'vazio'}`}>
                  {fmtValor(r ? l.valor(r) : 0)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
