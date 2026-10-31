import { useEffect, useRef, useState, type ReactNode } from 'react'
import { caixaDoBanco, type Resumo } from '../lib/calc'
import { COR } from '../lib/charts'
import { fmtDiv, parcelasDe, type SituacaoDivida } from '../lib/dividas'
import { fmtMoeda, fmtMesAno, fmtPct, fmtValor, MESES_CURTO, MESES_NOME, noMeioDaFrase } from '../lib/format'
import type { SituacaoMeta } from '../lib/metas'
import { converter, infoMoeda, type Taxas } from '../lib/moedas'
import type { Visao } from '../lib/perfil'
import { fatiasDeGastos } from '../lib/categorias'
import type { Banco, Caixa, Categoria, Detalhe, Lancamento, Tipo } from '../lib/types'
import { Rosca } from './Graficos'
import { IconeCategoria } from './IconeCategoria'
import { Icone } from './Icone'
import { ItemLancamento } from './ItemLancamento'
import { Anel, Progresso, Segmentado } from './ui'
import { tx } from '../lib/textos'

/**
 * Bloco da Início: título à esquerda, um número de apoio à direita e o conteúdo embaixo.
 * Todos os blocos de uma zona usam este mesmo cabeçalho, para a página ler como uma coisa só.
 */
export function Bloco({ titulo, sub, valor, legenda, acao, id, className = '', children }: {
  titulo: ReactNode; sub?: ReactNode; valor?: ReactNode; legenda?: string; acao?: ReactNode; id?: string; className?: string; children: ReactNode
}) {
  return (
    <section className={`bloco ${className}`} id={id}>
      <header className="bloco-cab">
        <h2>{titulo}</h2>
        {sub && <p className="bloco-cab-sub">{sub}</p>}
        {valor !== undefined && (
          <span className="bloco-cab-valor">
            {legenda && <small>{legenda}</small>}
            <strong>{valor}</strong>
          </span>
        )}
        {acao}
      </header>
      {children}
    </section>
  )
}

const somaTipo = (ls: Lancamento[], t: Tipo) => ls.filter((l) => l.tipo === t).reduce((a, l) => a + l.valor, 0)
const maisRecentes = (ls: Lancamento[]) =>
  [...ls].sort((a, b) => (b.data ?? '').localeCompare(a.data ?? '') || (b.created_at ?? '').localeCompare(a.created_at ?? ''))

/** Últimos lançamentos (simples e equilibrado) ou lançamentos do mês com filtro (detalhado). */
export function BlocoLancamentos({ lancs, nivel, categoriaDe, bancos, aoEditar, aoVerTodos }: {
  lancs: Lancamento[]; nivel: Detalhe
  categoriaDe: (l: Lancamento) => Categoria | undefined
  /** Só passa quando o módulo de bancos está ligado. */
  bancos?: Banco[]
  aoEditar: (l: Lancamento) => void; aoVerTodos: () => void
}) {
  const [filtro, setFiltro] = useState<Tipo | 'todos'>('todos')
  const detalhado = nivel === 'detalhado'
  // na Início a lista acompanha a altura do gráfico ao lado; o resto fica em Lançamentos
  const limite = detalhado ? 7 : 5
  const doFiltro = maisRecentes(lancs).filter((l) => filtro === 'todos' || l.tipo === filtro)
  return (
    <Bloco titulo={detalhado ? tx('Lançamentos do mês') : tx('Últimos lançamentos')}
      acao={lancs.length > 0 && <button className="link" onClick={aoVerTodos}>{tx('Ver todos')} <Icone nome="seta" tamanho={14} /></button>}>
      {detalhado && (
        <div className="bloco-filtro">
          <Segmentado rotulo={tx('Mostrar')} valor={filtro} aoMudar={setFiltro}
            opcoes={[{ id: 'todos', nome: tx('Tudo') }, { id: 'entrada', nome: tx('Entradas') }, { id: 'saida', nome: tx('Saídas') }]} />
        </div>
      )}
      {doFiltro.length ? (
        <ul className="lista-lanc bloco-lista">
          {doFiltro.slice(0, limite).map((l) => (
            <ItemLancamento key={l.id} l={l} categoria={categoriaDe(l)} banco={bancos?.find((b) => b.id === l.banco_id)} aoClicar={() => aoEditar(l)} />
          ))}
        </ul>
      ) : (
        <p className="quadro-vazio">{filtro === 'entrada' ? tx('Nenhuma entrada neste mês.') : tx('Nenhuma saída neste mês.')}</p>
      )}
      {detalhado && lancs.length > limite && (
        <button className="quadro-ver" onClick={aoVerTodos}>{tx('Ver todos os {0} lançamentos', lancs.length)}</button>
      )}
    </Bloco>
  )
}

/** Para onde foi o dinheiro: categorias da maior para a menor. A rosca entra a partir do equilibrado. */
export function BlocoGastos({ r, anterior, categorias, nivel, mesAnterior, aoEditar }: {
  r: Resumo; anterior: Resumo | null; categorias: Categoria[]; nivel: Detalhe
  /** "set": com que mês as variações se comparam. */
  mesAnterior?: string
  aoEditar: () => void
}) {
  const [todas, setTodas] = useState(false)
  const detalhado = nivel === 'detalhado'
  const limite = nivel === 'simples' ? 4 : 5
  const completas = fatiasDeGastos(r.gastosPorCategoria, categorias, Infinity)
  const fatias = detalhado || todas ? completas : fatiasDeGastos(r.gastosPorCategoria, categorias, limite)
  const maior = completas[0]?.valor ?? 0
  return (
    <Bloco id="para-onde-foi" titulo={tx('Para onde foi o dinheiro')} acao={<button className="link" onClick={aoEditar}>{tx('Categorias')}</button>}>
      {!completas.length ? (
        <p className="quadro-vazio">{tx('Quando você lançar saídas, aparece aqui em que você mais gasta.')}</p>
      ) : (
        <>
          {nivel !== 'simples' && (
            <div className="rosca-lado">
              <div className="rosca-centro-caixa">
                <Rosca fatias={fatiasDeGastos(r.gastosPorCategoria, categorias, 6)} altura={170} legenda={false} rotulos={false} cutout="72%" />
                <div className="rosca-centro"><strong>{fmtValor(r.saidas)}</strong><small>{tx('Saiu no mês')}</small></div>
              </div>
              <ul className="legenda-lista">
                {fatiasDeGastos(r.gastosPorCategoria, categorias, 6).map((f) => (
                  <li key={f.id}>
                    <i className="marcador" style={{ background: f.cor }} />
                    <span>{f.nome}</span>
                    <b>{r.saidas ? `${Math.round((f.valor / r.saidas) * 100)}%` : ''}</b>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {(nivel === 'simples' || detalhado || todas) && <ul className="gastos">
            {fatias.map((f) => {
              const antes = anterior?.gastosPorCategoria[f.id]
              // só vale destacar mudança grande (10% ou mais); abaixo disso é ruído
              const dif = detalhado && mesAnterior && antes ? (f.valor - antes) / antes : null
              return (
                <li key={f.id}>
                  <span className="gasto-nome">
                    <span className="gasto-icone" style={{ color: f.cor }}><IconeCategoria emoji={f.icone} tamanho={15} /></span>{f.nome}
                    {dif !== null && Math.abs(dif) >= 0.1 && (
                      <span className={`chip-info ${dif > 0 ? 'ruim' : 'bom'}`} title={dif > 0 ? tx('{0} a mais que em {1}', fmtPct(Math.abs(dif)), mesAnterior) : tx('{0} a menos que em {1}', fmtPct(Math.abs(dif)), mesAnterior)}>
                        <Icone nome={dif > 0 ? 'sobe' : 'desce'} tamanho={11} />{fmtPct(Math.abs(dif))}
                      </span>
                    )}
                  </span>
                  <span className="gasto-valor">{fmtValor(f.valor)}<small>{r.saidas ? `${Math.round((f.valor / r.saidas) * 100)}%` : ''}</small></span>
                  <span className="gasto-barra"><span style={{ width: `${(f.valor / maior) * 100}%`, background: f.cor }} /></span>
                </li>
              )
            })}
          </ul>}
          {!detalhado && (nivel === 'simples' ? completas.length > limite : true) && (
            <button className="quadro-ver" onClick={() => setTodas(!todas)}>
              {todas ? tx('Mostrar menos') : nivel === 'simples' ? tx('Ver todas as {0} categorias', completas.length) : tx('Ver valores por categoria')}
            </button>
          )}
        </>
      )}
    </Bloco>
  )
}

const quando = (q: [number, number] | null) => (q ? fmtMesAno(q[0], q[1]) : null)

/** Dívidas: o problema inteiro (quanto falta), junto do progresso e do próximo passo (pagar). */
export function BlocoDividas({ itens, nivel, aoEditar, aoPagar, aoNova, aoVerTodas, aReceber, aoVerReceber, resumo }: {
  itens: SituacaoDivida[]; nivel: Detalhe
  /** Só o progresso (quanto já pagou e quando acaba), sem uma linha por dívida: as parcelas do mês ficam no "Para fazer". */
  resumo?: boolean
  aoEditar: (s: SituacaoDivida) => void; aoPagar: (s: SituacaoDivida) => void; aoNova: () => void; aoVerTodas: () => void
  /** O que te devem (lado "me devem"), numa linha no pé do bloco. */
  aReceber?: { falta: number; atrasado: number; quantos: number }
  aoVerReceber?: () => void
}) {
  const total = itens.reduce((a, s) => a + s.restante, 0)
  const inicial = itens.reduce((a, s) => a + s.saldoInicial, 0)
  const pagoPct = inicial > 0 ? Math.round(((inicial - total) / inicial) * 100) : 0
  // Só dá para prever o fim quando toda dívida em aberto tem parcela definida.
  const semParcela = itens.some((s) => s.restante > 0 && !s.quitacao)
  const fim = semParcela ? null : itens.map((s) => s.quitacao).filter((q): q is [number, number] => q !== null)
    .sort((a, b) => b[0] * 12 + b[1] - (a[0] * 12 + a[1]))[0] ?? null
  // na Início a lista fica curta para caber ao lado de contas e cartões; a página Dívidas tem todas
  const limite = nivel === 'simples' ? 3 : 4
  return (
    <Bloco titulo={tx('Dívidas')} valor={itens.length ? fmtValor(total) : undefined} legenda={itens.length ? tx('falta pagar') : undefined}
      acao={<button className="quadro-mais" onClick={aoNova} aria-label={tx('Adicionar dívida')}><Icone nome="mais" tamanho={16} /></button>}>
      {!itens.length ? (
        <p className="quadro-vazio">{tx('Tem parcela ou empréstimo? Adicione para ver quanto falta e quando acaba.')} <button className="link" onClick={aoNova}>{tx('Adicionar dívida')}</button></p>
      ) : (
        <>
          {total > 0 && (
            <div className="divida-resumo">
              <Anel valor={pagoPct / 100} cor={COR.entradas} tamanho={58}>{pagoPct}%</Anel>
              <span className="divida-resumo-texto">
                <small>{tx('já pago')}</small>
                <b>{fmtValor(inicial - total)}</b>
              </span>
              {fim && <span className="chip-info"><Icone nome="calendario" tamanho={13} /> {tx('livre em')} {quando(fim)}</span>}
            </div>
          )}
          {resumo && <button className="quadro-ver" onClick={aoVerTodas}>{tx('Ver dívidas')}</button>}
          {!resumo && itens.slice(0, limite).map((s) => (
            <div key={s.divida.id} className={`divida-linha ${s.quitadaNoMes ? 'quitada' : ''}`}>
              <button className="divida-linha-info" onClick={() => aoEditar(s)}>
                <span className="divida-linha-nome">{s.divida.descricao}</span>
                <span className="divida-linha-valor">{s.quitadaNoMes ? tx('Quitada ✓') : fmtDiv(s, s.restante)}</span>
                <Progresso valor={s.saldoInicial - s.restante} total={s.saldoInicial} cor={COR.entradas} />
                {(() => {
                  // chips curtos no lugar da frase: parcela, valor por mês, quando acaba, pago no mês
                  const p = parcelasDe(s)
                  const chips = [
                    p && !s.quitadaNoMes ? <span key="p" className="chip-info" title={tx('parcela {0} de {1}', p.proxima, p.total)}>{p.proxima}/{p.total}</span> : null,
                    nivel !== 'simples' && s.divida.valor_parcela ? <span key="v" className="chip-info">{tx('{0}/mês', fmtDiv(s, s.divida.valor_parcela))}</span> : null,
                    !s.quitadaNoMes && s.quitacao ? <span key="q" className="chip-info"><Icone nome="calendario" tamanho={12} />{quando(s.quitacao)}</span> : null,
                    nivel === 'detalhado' && s.pagoNoMes ? <span key="m" className="chip-info bom">+{fmtDiv(s, s.pagoNoMes)}</span> : null,
                  ].filter(Boolean)
                  return chips.length > 0 && <span className="divida-linha-sub chips-info">{chips}</span>
                })()}
              </button>
              {!s.quitadaNoMes && <button className="pagar" onClick={() => aoPagar(s)}>{tx('Pagar')}</button>}
            </div>
          ))}
          {!resumo && itens.length > limite && <button className="quadro-ver" onClick={aoVerTodas}>{tx('Ver todas as {0} dívidas', itens.length)}</button>}
        </>
      )}
      {!resumo && aReceber && aReceber.quantos > 0 && (
        <button className="divida-receber" onClick={aoVerReceber}>
          <span className="divida-receber-icone"><Icone nome="receber" tamanho={18} /></span>
          <span className="divida-receber-texto">
            <b>{tx('A receber')}</b>
            <small>
              {tx('{0} em aberto', aReceber.quantos)}
              {aReceber.atrasado > 0 && <> · <em>{tx('{0} venceu', fmtValor(aReceber.atrasado))}</em></>}
            </small>
          </span>
          <strong>{fmtValor(aReceber.falta)}</strong>
          <Icone nome="dir" tamanho={16} />
        </button>
      )}
    </Bloco>
  )
}

/** Dinheiro guardado: contas, investimentos e outras moedas num bloco só. O nível define o quanto se abre. */
export function BlocoDinheiro({ v, nivel, bancos, caixa, investimentos, moedas, lista, taxas, lancs, herdadoDe, aoAbrir, aoAbrirBanco }: {
  v: Visao; nivel: Detalhe; bancos: Banco[]; caixa: Caixa; investimentos: number
  moedas: Record<string, number>; lista: string[]; taxas: Taxas; lancs: Lancamento[]
  herdadoDe: [number, number] | null
  aoAbrir: () => void; aoAbrirBanco: (id: string | null) => void
}) {
  const totalCaixa = bancos.reduce((a, b) => a + caixaDoBanco(caixa, b.id), 0)
  const totalMoedas = lista.reduce((a, m) => a + (converter(moedas[m] ?? 0, m, taxas) ?? 0), 0)
  const total = (v.bancos ? totalCaixa : 0) + (v.investimentos ? investimentos : 0) + (v.moedas ? totalMoedas : 0)
  const abrir = nivel !== 'simples'
  const linha = (chave: string, nome: ReactNode, valor: string, sub: ReactNode, onClick: () => void) => (
    <button key={chave} className="banco-linha" onClick={onClick}>
      <span className="banco-linha-nome">{nome}</span>
      <span className="banco-linha-saldo">{valor}</span>
      {sub && <span className="banco-linha-sub">{sub}</span>}
    </button>
  )
  return (
    <Bloco titulo={tx('Dinheiro guardado')} valor={total ? fmtValor(total) : undefined}
      acao={<button className="link" onClick={aoAbrir}>{tx('Abrir')}</button>}>
      {v.bancos && (abrir && bancos.length
        ? bancos.map((b) => {
          const ls = lancs.filter((l) => l.banco_id === b.id)
          return linha(b.id, <><i className="marcador" style={{ background: b.cor }} />{b.nome}</>, fmtValor(caixaDoBanco(caixa, b.id)),
            nivel === 'detalhado' && ls.length ? tx('Entrou {0} · saiu {1} neste mês', fmtValor(somaTipo(ls, 'entrada')), fmtValor(somaTipo(ls, 'saida'))) : null,
            () => aoAbrirBanco(b.id))
        })
        : linha('contas', <><i className="marcador" style={{ background: COR.caixa }} />{tx('Nas contas')}</>, fmtValor(totalCaixa),
          bancos.length ? null : tx('Adicione seus bancos para ver quanto tem em cada um'), aoAbrir))}
      {v.investimentos && linha('inv', <><i className="marcador" style={{ background: COR.investimentos }} />{tx('Investido')}</>, fmtValor(investimentos),
        investimentos ? null : tx('Informar quanto você tem investido'), aoAbrir)}
      {v.moedas && (abrir
        ? lista.map((m) => {
          const i = infoMoeda(m)
          const conv = converter(moedas[m] ?? 0, m, taxas)
          return linha(m, <>{i.bandeira}&nbsp;&nbsp;{i.nome}</>, conv === null ? '—' : `≈ ${fmtValor(conv)}`,
            conv === null ? tx('Sem cotação agora') : `${fmtMoeda(moedas[m] ?? 0, m)} · 1 ${m} = ${fmtValor(taxas[m])}`, aoAbrir)
        })
        : linha('moedas', <><i className="marcador" style={{ background: COR.usd }} />{tx('Em outras moedas')}</>, `≈ ${fmtValor(totalMoedas)}`, null, aoAbrir))}
      {herdadoDe && (
        <p className="aviso-herdado">{tx('Valores de {0} de {1}.', MESES_NOME[herdadoDe[1] - 1].toLowerCase(), herdadoDe[0])} <button className="link" onClick={aoAbrir}>{tx('Atualizar')}</button></p>
      )}
    </Bloco>
  )
}

/** As metas em andamento: progresso e previsão (a página Metas tem o resto). Fecha a Início com algo que anima. */
export function BlocoMetas({ metas, taxas, nivel, aoAbrir }: { metas: SituacaoMeta[]; taxas: Taxas; nivel: Detalhe; aoAbrir: () => void }) {
  const ativas = metas.filter((s) => !s.batida)
  const guardado = metas.reduce((a, s) => a + (converter(s.guardado, s.meta.moeda, taxas) ?? 0), 0)
  const limite = nivel === 'simples' ? 2 : nivel === 'equilibrado' ? 4 : Infinity
  return (
    <Bloco titulo={tx('Suas metas')} sub={metas.length ? <>{tx('{0} guardado no total', fmtValor(guardado))}</> : undefined}
      acao={<button className="link" onClick={aoAbrir}>{metas.length ? <>{tx('Ver todas')} <Icone nome="seta" tamanho={14} /></> : tx('Criar')}</button>}>
      {!metas.length && (
        <p className="quadro-vazio">{tx('Junte dinheiro para uma viagem, um carro ou uma reserva.')} <button className="link" onClick={aoAbrir}>{tx('Criar a primeira meta')}</button></p>
      )}
      {metas.length > 0 && !ativas.length && <p className="quadro-vazio">{tx('Todas as metas batidas! 🎉')} <button className="link" onClick={aoAbrir}>{tx('Criar outra')}</button></p>}
      {ativas.slice(0, limite).map((s) => (
        <button key={s.meta.id} className="meta-linha" onClick={aoAbrir} style={{ '--c': s.meta.cor } as React.CSSProperties}>
          <span className="meta-linha-icone" aria-hidden="true"><IconeCategoria emoji={s.meta.icone} tamanho={20} /></span>
          <span className="meta-linha-nome">{s.meta.nome}</span>
          <span className="meta-linha-pct">{Math.round(s.progresso * 100)}%</span>
          <span className="meta-linha-valor">
            {fmtMoeda(s.guardado, s.meta.moeda)} / {fmtMoeda(s.meta.alvo, s.meta.moeda)}
            {nivel !== 'simples' && s.previsao && (' · ' + tx('chega em {0}', fmtMesAno(s.previsao[0], s.previsao[1])))}
          </span>
          <Progresso valor={s.guardado} total={s.meta.alvo} cor={s.meta.cor} />
        </button>
      ))}
      {ativas.length > limite && <button className="quadro-ver" onClick={aoAbrir}>{tx('Ver todas as {0} metas', ativas.length)}</button>}
    </Bloco>
  )
}

const LINHAS_ANUAIS: { nome: string; cor: string; valor: (r: Resumo) => number; mostrar?: (v: Visao) => boolean }[] = [
  { nome: tx('Entrou'), cor: COR.entradas, valor: (r) => r.entradas },
  { nome: tx('Saiu'), cor: COR.saidas, valor: (r) => r.saidas },
  { nome: tx('Sobrou'), cor: COR.fluxo, valor: (r) => r.fluxo },
  { nome: tx('Guardado nas contas'), cor: COR.caixa, valor: (r) => r.caixa, mostrar: (v) => v.bancos },
  { nome: tx('Dívidas'), cor: COR.divida, valor: (r) => r.divida, mostrar: (v) => v.dividas },
  { nome: tx('Investido'), cor: COR.investimentos, valor: (r) => r.investimentos, mostrar: (v) => v.investimentos },
  { nome: tx('Em outras moedas'), cor: COR.usd, valor: (r) => r.moedasConvertido, mostrar: (v) => v.moedas },
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
            {MESES_CURTO.map((m, i) => (
              <th key={m} className={i + 1 === mesAtual ? 'atual' : ''}>
                <button onClick={() => aoClicarMes(i + 1)} title={tx('Abrir {0}', noMeioDaFrase(MESES_NOME[i]))}>{m}</button>
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
