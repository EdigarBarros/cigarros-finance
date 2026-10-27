import { useEffect, useRef, useState, type ReactNode } from 'react'
import { caixaDoBanco, type Resumo } from '../lib/calc'
import { COR } from '../lib/charts'
import { parcelasDe, type SituacaoDivida } from '../lib/dividas'
import { fmtMoeda, fmtMesAno, fmtPct, fmtValor, MESES_CURTO, MESES_NOME } from '../lib/format'
import type { SituacaoMeta } from '../lib/metas'
import { converter, infoMoeda, type Taxas } from '../lib/moedas'
import type { Visao } from '../lib/perfil'
import { fatiasDeGastos } from '../lib/categorias'
import type { Banco, Caixa, Categoria, Detalhe, Lancamento, Tipo } from '../lib/types'
import { Rosca } from './Graficos'
import { Icone } from './Icone'
import { ItemLancamento } from './ItemLancamento'
import { Progresso, Segmentado } from './ui'

/**
 * Bloco da Início: título à esquerda, um número de apoio à direita e o conteúdo embaixo.
 * Todos os blocos de uma zona usam este mesmo cabeçalho, para a página ler como uma coisa só.
 */
export function Bloco({ titulo, valor, legenda, acao, id, className = '', children }: {
  titulo: ReactNode; valor?: ReactNode; legenda?: string; acao?: ReactNode; id?: string; className?: string; children: ReactNode
}) {
  return (
    <section className={`bloco ${className}`} id={id}>
      <header className="bloco-cab">
        <h2>{titulo}</h2>
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
export function BlocoLancamentos({ lancs, nivel, mobile, categoriaDe, bancos, aoEditar, aoVerTodos }: {
  lancs: Lancamento[]; nivel: Detalhe; mobile: boolean
  categoriaDe: (l: Lancamento) => Categoria | undefined
  /** Só passa quando o módulo de bancos está ligado. */
  bancos?: Banco[]
  aoEditar: (l: Lancamento) => void; aoVerTodos: () => void
}) {
  const [filtro, setFiltro] = useState<Tipo | 'todos'>('todos')
  const detalhado = nivel === 'detalhado'
  const limite = detalhado ? (mobile ? 8 : 10) : mobile || nivel === 'simples' ? 5 : 6
  const doFiltro = maisRecentes(lancs).filter((l) => filtro === 'todos' || l.tipo === filtro)
  return (
    <Bloco titulo={detalhado ? 'Lançamentos do mês' : 'Últimos lançamentos'}>
      {detalhado && (
        <div className="bloco-filtro">
          <Segmentado rotulo="Mostrar" valor={filtro} aoMudar={setFiltro}
            opcoes={[{ id: 'todos', nome: 'Tudo' }, { id: 'entrada', nome: 'Entradas' }, { id: 'saida', nome: 'Saídas' }]} />
        </div>
      )}
      {doFiltro.length ? (
        <ul className="lista-lanc bloco-lista">
          {doFiltro.slice(0, limite).map((l) => (
            <ItemLancamento key={l.id} l={l} categoria={categoriaDe(l)} banco={bancos?.find((b) => b.id === l.banco_id)} aoClicar={() => aoEditar(l)} />
          ))}
        </ul>
      ) : (
        <p className="quadro-vazio">{filtro === 'entrada' ? 'Nenhuma entrada neste mês.' : 'Nenhuma saída neste mês.'}</p>
      )}
      {lancs.length > limite && (
        <button className="quadro-ver" onClick={aoVerTodos}>Ver todos os {lancs.length} lançamentos</button>
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
    <Bloco id="para-onde-foi" titulo="Para onde foi o dinheiro" acao={<button className="link" onClick={aoEditar}>Categorias</button>}>
      {!completas.length ? (
        <p className="quadro-vazio">Quando você lançar saídas, aparece aqui em que você mais gasta.</p>
      ) : (
        <>
          {nivel !== 'simples' && (
            <div className="rosca-centro-caixa">
              <Rosca fatias={completas} altura={188} legenda={false} rotulos={false} cutout="66%" />
              <div className="rosca-centro"><small>Saiu</small><strong>{fmtValor(r.saidas)}</strong></div>
            </div>
          )}
          <ul className="gastos">
            {fatias.map((f) => {
              const antes = anterior?.gastosPorCategoria[f.id]
              // só vale destacar mudança grande (10% ou mais); abaixo disso é ruído
              const dif = detalhado && mesAnterior && antes ? (f.valor - antes) / antes : null
              return (
                <li key={f.id}>
                  <span className="gasto-nome"><i className="marcador" style={{ background: f.cor }} />{f.icone}&nbsp;{f.nome}</span>
                  <span className="gasto-valor">{fmtValor(f.valor)}<small>{r.saidas ? `${Math.round((f.valor / r.saidas) * 100)}%` : ''}</small></span>
                  <span className="gasto-barra"><span style={{ width: `${(f.valor / maior) * 100}%`, background: f.cor }} /></span>
                  {dif !== null && Math.abs(dif) >= 0.1 && (
                    <span className="gasto-sub">{fmtPct(Math.abs(dif))} {dif > 0 ? 'a mais' : 'a menos'} que em {mesAnterior}</span>
                  )}
                </li>
              )
            })}
          </ul>
          {!detalhado && completas.length > limite && (
            <button className="quadro-ver" onClick={() => setTodas(!todas)}>{todas ? 'Mostrar menos' : `Ver todas as ${completas.length} categorias`}</button>
          )}
        </>
      )}
    </Bloco>
  )
}

const capitalizar = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)
const quando = (q: [number, number] | null) => (q ? fmtMesAno(q[0], q[1]) : null)

/** Dívidas: o problema inteiro (quanto falta), junto do progresso e do próximo passo (pagar). */
export function BlocoDividas({ itens, nivel, aoEditar, aoPagar, aoNova, aoVerTodas }: {
  itens: SituacaoDivida[]; nivel: Detalhe
  aoEditar: (s: SituacaoDivida) => void; aoPagar: (s: SituacaoDivida) => void; aoNova: () => void; aoVerTodas: () => void
}) {
  const total = itens.reduce((a, s) => a + s.restante, 0)
  const inicial = itens.reduce((a, s) => a + s.saldoInicial, 0)
  const pagoPct = inicial > 0 ? Math.round(((inicial - total) / inicial) * 100) : 0
  // Só dá para prever o fim quando toda dívida em aberto tem parcela definida.
  const semParcela = itens.some((s) => s.restante > 0 && !s.quitacao)
  const fim = semParcela ? null : itens.map((s) => s.quitacao).filter((q): q is [number, number] => q !== null)
    .sort((a, b) => b[0] * 12 + b[1] - (a[0] * 12 + a[1]))[0] ?? null
  const limite = nivel === 'detalhado' ? Infinity : 4
  return (
    <Bloco titulo="Dívidas" valor={itens.length ? fmtValor(total) : undefined} legenda={itens.length ? 'falta pagar' : undefined}
      acao={<button className="quadro-mais" onClick={aoNova} aria-label="Adicionar dívida"><Icone nome="mais" tamanho={16} /></button>}>
      {!itens.length ? (
        <p className="quadro-vazio">Tem parcela ou empréstimo? Adicione para ver quanto falta e quando acaba. <button className="link" onClick={aoNova}>Adicionar dívida</button></p>
      ) : (
        <>
          {total > 0 && (
            <p className="bloco-sub">
              Você já pagou <b>{pagoPct}%</b>.{fim && <> Sem dívidas em <b>{quando(fim)}</b>.</>}
            </p>
          )}
          {itens.slice(0, limite).map((s) => (
            <div key={s.divida.id} className={`divida-linha ${s.quitadaNoMes ? 'quitada' : ''}`}>
              <button className="divida-linha-info" onClick={() => aoEditar(s)}>
                <span className="divida-linha-nome">{s.divida.descricao}</span>
                <span className="divida-linha-valor">{s.quitadaNoMes ? 'Quitada ✓' : fmtValor(s.restante)}</span>
                <Progresso valor={s.saldoInicial - s.restante} total={s.saldoInicial} cor={COR.entradas} />
                <span className="divida-linha-sub">
                  {(() => {
                    const p = parcelasDe(s)
                    return capitalizar([
                      p && !s.quitadaNoMes ? `parcela ${p.proxima} de ${p.total}` : null,
                      nivel !== 'simples' && s.divida.valor_parcela ? `${fmtValor(s.divida.valor_parcela)} por mês` : null,
                      s.quitadaNoMes ? null : s.quitacao ? `acaba em ${quando(s.quitacao)}` : 'sem parcela definida, toque para definir',
                      nivel === 'detalhado' && s.pagoNoMes ? `pago neste mês ${fmtValor(s.pagoNoMes)}` : null,
                    ].filter(Boolean).join(' · '))
                  })()}
                </span>
              </button>
              {!s.quitadaNoMes && <button className="pagar" onClick={() => aoPagar(s)}>Pagar</button>}
            </div>
          ))}
          {itens.length > limite && <button className="quadro-ver" onClick={aoVerTodas}>Ver todas as {itens.length} dívidas</button>}
        </>
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
    <Bloco titulo="Dinheiro guardado" valor={total ? fmtValor(total) : undefined}
      acao={<button className="link" onClick={aoAbrir}>Abrir</button>}>
      {v.bancos && (abrir && bancos.length
        ? bancos.map((b) => {
          const ls = lancs.filter((l) => l.banco_id === b.id)
          return linha(b.id, <><i className="marcador" style={{ background: b.cor }} />{b.nome}</>, fmtValor(caixaDoBanco(caixa, b.id)),
            nivel === 'detalhado' && ls.length ? `Entrou ${fmtValor(somaTipo(ls, 'entrada'))} · saiu ${fmtValor(somaTipo(ls, 'saida'))} neste mês` : null,
            () => aoAbrirBanco(b.id))
        })
        : linha('contas', <><i className="marcador" style={{ background: COR.caixa }} />Nas contas</>, fmtValor(totalCaixa),
          bancos.length ? null : 'Adicione seus bancos para ver quanto tem em cada um', aoAbrir))}
      {v.investimentos && linha('inv', <><i className="marcador" style={{ background: COR.investimentos }} />Investido</>, fmtValor(investimentos),
        investimentos ? null : 'Informar quanto você tem investido', aoAbrir)}
      {v.moedas && (abrir
        ? lista.map((m) => {
          const i = infoMoeda(m)
          const conv = converter(moedas[m] ?? 0, m, taxas)
          return linha(m, <>{i.bandeira}&nbsp;&nbsp;{i.nome}</>, conv === null ? '—' : `≈ ${fmtValor(conv)}`,
            conv === null ? 'Sem cotação agora' : `${fmtMoeda(moedas[m] ?? 0, m)} · 1 ${m} = ${fmtValor(taxas[m])}`, aoAbrir)
        })
        : linha('moedas', <><i className="marcador" style={{ background: COR.usd }} />Em outras moedas</>, `≈ ${fmtValor(totalMoedas)}`, null, aoAbrir))}
      {herdadoDe && (
        <p className="aviso-herdado">Valores de {MESES_NOME[herdadoDe[1] - 1].toLowerCase()} de {herdadoDe[0]}. <button className="link" onClick={aoAbrir}>Atualizar</button></p>
      )}
    </Bloco>
  )
}

/** As metas em andamento: progresso e previsão (a página Metas tem o resto). Fecha a Início com algo que anima. */
export function BlocoMetas({ metas, taxas, nivel, aoAbrir }: { metas: SituacaoMeta[]; taxas: Taxas; nivel: Detalhe; aoAbrir: () => void }) {
  const ativas = metas.filter((s) => !s.batida)
  const guardado = metas.reduce((a, s) => a + (converter(s.guardado, s.meta.moeda, taxas) ?? 0), 0)
  const limite = nivel === 'simples' ? 2 : nivel === 'equilibrado' ? 4 : 6
  return (
    <Bloco titulo="Metas" valor={metas.length ? fmtValor(guardado) : undefined} legenda={metas.length ? 'guardado' : undefined}
      acao={<button className="link" onClick={aoAbrir}>{metas.length ? 'Abrir' : 'Criar'}</button>}>
      {!metas.length && (
        <p className="quadro-vazio">Junte dinheiro para uma viagem, um carro ou uma reserva. <button className="link" onClick={aoAbrir}>Criar a primeira meta</button></p>
      )}
      {metas.length > 0 && !ativas.length && <p className="quadro-vazio">Todas as metas batidas! 🎉 <button className="link" onClick={aoAbrir}>Criar outra</button></p>}
      {ativas.slice(0, limite).map((s) => (
        <button key={s.meta.id} className="banco-linha" onClick={aoAbrir}>
          <span className="banco-linha-nome">{s.meta.icone}&nbsp;&nbsp;{s.meta.nome}</span>
          <span className="banco-linha-saldo">{Math.round(s.progresso * 100)}%</span>
          <Progresso valor={s.guardado} total={s.meta.alvo} cor={s.meta.cor} />
          <span className="banco-linha-sub">
            {fmtMoeda(s.guardado, s.meta.moeda)} de {fmtMoeda(s.meta.alvo, s.meta.moeda)}
            {s.previsao && ` · chega em ${fmtMesAno(s.previsao[0], s.previsao[1])}`}
          </span>
        </button>
      ))}
      {ativas.length > limite && <button className="quadro-ver" onClick={aoAbrir}>Ver todas as {ativas.length} metas</button>}
    </Bloco>
  )
}

const LINHAS_ANUAIS: { nome: string; cor: string; valor: (r: Resumo) => number; mostrar?: (v: Visao) => boolean }[] = [
  { nome: 'Entrou', cor: COR.entradas, valor: (r) => r.entradas },
  { nome: 'Saiu', cor: COR.saidas, valor: (r) => r.saidas },
  { nome: 'Sobrou', cor: COR.fluxo, valor: (r) => r.fluxo },
  { nome: 'Guardado nas contas', cor: COR.caixa, valor: (r) => r.caixa, mostrar: (v) => v.bancos },
  { nome: 'Dívidas', cor: COR.divida, valor: (r) => r.divida, mostrar: (v) => v.dividas },
  { nome: 'Investido', cor: COR.investimentos, valor: (r) => r.investimentos, mostrar: (v) => v.investimentos },
  { nome: 'Em outras moedas', cor: COR.usd, valor: (r) => r.moedasConvertido, mostrar: (v) => v.moedas },
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
                <button onClick={() => aoClicarMes(i + 1)} title={`Abrir ${MESES_NOME[i].toLowerCase()}`}>{m}</button>
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
