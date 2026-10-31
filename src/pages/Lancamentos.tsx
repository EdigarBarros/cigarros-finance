import { useMemo, useState } from 'react'
import { hojeLocal } from '../lib/cartoes'
import { COR } from '../lib/charts'
import { SEM_CATEGORIA } from '../lib/categorias'
import { formaDe, FORMAS, infoForma, type FormaPagamento } from '../lib/formas'
import { fmtDataCurta, fmtDataLonga, fmtMoeda, fmtValor, MESES_NOME, noMeioDaFrase } from '../lib/format'
import { ehEmprestimo } from '../lib/dividas'
import type { Banco, Categoria, Lancamento, Tipo } from '../lib/types'
import { Icone } from '../components/Icone'
import { Numero } from '../components/Numero'
import { CenaLancamentos } from '../components/Vazios'
import { Segmentado } from '../components/ui'
import type { Ctx } from './contexto'
import { tx } from '../lib/textos'

type Filtro<T> = T | 'todos'
const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', tx('sáb')]
const SEMANA_LETRA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const doisDig = (n: number) => String(n).padStart(2, '0')
const somaTipo = (ls: Lancamento[], t: Tipo) => ls.filter((l) => l.tipo === t).reduce((a, l) => a + l.valor, 0)

/**
 * Lançamentos do mês em duas colunas. À esquerda, presa ao rolar: o calendário do mês (cada dia mais forte quanto mais
 * saiu; tocar filtra o dia) e "Para onde foi", as categorias em barras (tocar filtra a categoria). À direita: o resumo
 * (entrou, saiu, sobrou), a barra de filtros e os lançamentos em cartões, numa linha do tempo por dia ou pelos maiores.
 */
export function Lancamentos(c: Ctx) {
  const [tipo, setTipo] = useState<Filtro<Tipo>>('todos')
  const [banco, setBanco] = useState<Filtro<string>>('todos')
  const [forma, setForma] = useState<Filtro<FormaPagamento | 'sem'>>('todos')
  /** id da categoria, 'sem' (sem categoria) ou 'todos'. */
  const [categoria, setCategoria] = useState<Filtro<string>>('todos')
  const [dia, setDia] = useState<string | null>(null)
  const [ordem, setOrdem] = useState<'data' | 'valor'>('data')
  const [todasCategorias, setTodasCategorias] = useState(false)
  const { busca, setBusca } = c
  const hoje = hojeLocal()

  // tudo menos a categoria e o dia: base para os chips de categoria e para o calendário
  const base = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return c.lancsMes
      .filter((l) => tipo === 'todos' || l.tipo === tipo)
      .filter((l) => banco === 'todos' || (banco === 'sem' ? !l.banco_id : l.banco_id === banco))
      .filter((l) => forma === 'todos' || (formaDe(l) ?? 'sem') === forma)
      .filter((l) => !q || l.descricao.toLowerCase().includes(q) || Boolean(c.categoriaDe(l)?.nome.toLowerCase().includes(q)))
  }, [c.lancsMes, tipo, banco, forma, busca, c.categorias]) // eslint-disable-line react-hooks/exhaustive-deps

  const daCategoria = (l: Lancamento) => categoria === 'todos' || (categoria === 'sem' ? !c.categoriaDe(l) : c.categoriaDe(l)?.id === categoria)
  const semDia = base.filter(daCategoria)
  const filtrados = semDia
    .filter((l) => !dia || l.data === dia)
    .sort((x, y) => ordem === 'valor'
      ? y.valor - x.valor
      : (y.data ?? '').localeCompare(x.data ?? '') || (y.created_at ?? '').localeCompare(x.created_at ?? ''))

  const grupos = useMemo(() => {
    const g = new Map<string, Lancamento[]>()
    for (const l of filtrados) g.set(l.data ?? '', [...(g.get(l.data ?? '') ?? []), l])
    return [...g.entries()]
  }, [filtrados])

  // chips de categoria: as do tipo escolhido (sem tipo, as de saída), da maior para a menor
  const tipoChips: Tipo = tipo === 'entrada' ? 'entrada' : 'saida'
  const chips = useMemo(() => {
    const m = new Map<string, { id: string; nome: string; icone: string; cor: string; total: number; n: number }>()
    for (const l of base.filter((x) => x.tipo === tipoChips && (!dia || x.data === dia))) {
      const k = c.categoriaDe(l)
      const id = k?.id ?? 'sem'
      const g = m.get(id) ?? { id, nome: k?.nome ?? SEM_CATEGORIA.nome, icone: k?.icone ?? SEM_CATEGORIA.icone, cor: k?.cor ?? SEM_CATEGORIA.cor, total: 0, n: 0 }
      g.total += l.valor
      g.n++
      m.set(id, g)
    }
    return [...m.values()].sort((a, b) => b.total - a.total)
  }, [base, tipoChips, dia]) // eslint-disable-line react-hooks/exhaustive-deps

  const entrou = somaTipo(filtrados, 'entrada')
  const saiu = somaTipo(filtrados, 'saida')
  const filtrando = tipo !== 'todos' || banco !== 'todos' || forma !== 'todos' || categoria !== 'todos' || busca || dia
  const limpar = () => { setTipo('todos'); setBanco('todos'); setForma('todos'); setCategoria('todos'); setBusca(''); setDia(null) }
  // formas de pagamento usadas no mês (com os outros filtros aplicados, menos a própria forma)
  const formasDoMes = useMemo(() => {
    const q = busca.trim().toLowerCase()
    const m = new Map<FormaPagamento | 'sem', number>()
    for (const l of c.lancsMes) {
      if (tipo !== 'todos' && l.tipo !== tipo) continue
      if (banco !== 'todos' && (banco === 'sem' ? l.banco_id : l.banco_id !== banco)) continue
      if (q && !l.descricao.toLowerCase().includes(q)) continue
      const f = formaDe(l) ?? 'sem'
      m.set(f, (m.get(f) ?? 0) + l.valor)
    }
    return m
  }, [c.lancsMes, tipo, banco, busca])
  const bancoDe = (l: Lancamento) => (c.v.bancos ? c.d.bancos.find((b) => b.id === l.banco_id) : undefined)
  const cartaoDe = (l: Lancamento) => (l.cartao_id ? c.cartoes.cartoes.find((k) => k.id === l.cartao_id) : undefined)

  const totalChips = chips.reduce((a, k) => a + k.total, 0)
  const chipsVisiveis = todasCategorias || chips.length <= 6 ? chips : chips.slice(0, 5)
  const cartao = (l: Lancamento, i: number, mostrarData: boolean) => (
    <CartaoLancamento key={l.id} l={l} indice={i} categoria={c.categoriaDe(l)} banco={bancoDe(l)} cartao={cartaoDe(l)} emprestimo={ehEmprestimo(l, c.d.dividas)}
      mostrarData={mostrarData} aoClicar={() => c.editarLancamento(l)} />
  )
  const comBancos = c.v.bancos && c.d.bancos.length > 0
  const comFormas = formasDoMes.size > 1 || forma !== 'todos'
  const parteSaiu = entrou > 0 ? Math.min(1, saiu / entrou) : saiu > 0 ? 1 : 0

  return (
    <div className="pagina pg-lanc">
      <header className="pagina-topo">
        <div>
          <h1>{tx('Lançamentos')}</h1>
          <p className="sub">{tx('{0} de {1} · {2}', MESES_NOME[c.mes - 1], c.ano, filtrados.length)} {filtrados.length === 1 ? tx('lançamento') : tx('lançamentos')}{filtrando ? (' ' + tx('com os filtros')) : ''}</p>
        </div>
        <div className="lc-topo-acoes">
          <button className="btn" onClick={c.importarExtrato} title={tx('PDF, CSV, Excel, Word ou OFX do banco')}>{tx('Importar extrato')}</button>
          <button className="btn" onClick={c.organizarNomes}>{tx('Organizar nomes')}</button>
          <span className="so-desktop lc-topo-novo">
            <button className="btn lc-btn-entrada" onClick={() => c.novoLancamento('entrada')}>+ {tx('Entrada')}</button>
            <button className="btn lc-btn-saida" onClick={() => c.novoLancamento('saida')}>− {tx('Saída')}</button>
          </span>
        </div>
      </header>

      <div className={`lc-grade ${c.lancsMes.length === 0 ? 'sem-lado' : ''}`}>
        {c.lancsMes.length > 0 && (
          <aside className="lc-lado">
            <CalorDoMes ano={c.ano} mes={c.mes} lancs={semDia} dia={dia} hoje={hoje} aoEscolher={(d) => setDia(d === dia ? null : d)} />

            {chips.length > 0 && (
              <section className="cartao lc-cats" aria-label={tx('Categorias')}>
                <header className="lc-cats-cab">
                  <h3 className="ccd-titulo">{tipoChips === 'entrada' ? tx('De onde veio') : tx('Para onde foi')}</h3>
                  <button className="link" onClick={c.gerenciarCategorias}>{tx('Editar categorias')}</button>
                </header>
                <div className="lc-cats-lista">
                  {chipsVisiveis.map((k, i) => (
                    <button key={k.id} className={`lc-cat ${categoria === k.id ? 'ativo' : ''} ${categoria !== 'todos' && categoria !== k.id ? 'apagado' : ''}`}
                      style={{ '--c': k.cor, '--p': totalChips ? k.total / chips[0].total : 0, animationDelay: `${i * 40}ms` } as React.CSSProperties}
                      onClick={() => setCategoria(categoria === k.id ? 'todos' : k.id)} aria-pressed={categoria === k.id}
                      title={k.n === 1 ? tx('1 lançamento') : tx('{0} lançamentos', k.n)}>
                      <span className="lc-cat-nome">{k.nome}</span>
                      <span className="lc-cat-valor">{fmtValor(k.total)}<small>{totalChips ? Math.round((k.total / totalChips) * 100) : 0}%</small></span>
                      <span className="lc-cat-barra"><i /></span>
                    </button>
                  ))}
                </div>
                {chips.length > 6 && (
                  <button className="link lc-cats-mais" onClick={() => setTodasCategorias(!todasCategorias)}>
                    {todasCategorias ? tx('Mostrar menos') : tx('Ver todas as {0}', chips.length)}
                  </button>
                )}
              </section>
            )}
          </aside>
        )}

        <div className="lc-principal">
          <section className="cartao lc-resumo">
            <div className="lc-resumo-numeros">
              {[
                { id: 'entrou', rotulo: tx('Entrou'), valor: entrou, cor: COR.entradas },
                { id: 'saiu', rotulo: tx('Saiu'), valor: saiu, cor: COR.saidas },
                { id: 'sobrou', rotulo: entrou - saiu < 0 ? tx('Faltou') : tx('Sobrou'), valor: entrou - saiu, cor: entrou - saiu < 0 ? COR.saidas : COR.caixa },
              ].map((t) => (
                <div key={t.id} className="lc-resumo-item" style={{ '--c': t.cor } as React.CSSProperties}>
                  <small>{t.rotulo}</small>
                  <strong><Numero valor={Math.abs(t.valor)} formato={fmtValor} /></strong>
                </div>
              ))}
            </div>
            {(entrou > 0 || saiu > 0) && (
              <div className="lc-resumo-regua">
                <span className="lc-resumo-trilho"><i style={{ width: `${parteSaiu * 100}%` }} /></span>
                <small>{entrou > 0
                  ? tx('Saiu {0}% do que entrou', Math.round((saiu / entrou) * 100))
                  : tx('Nada entrou com esses filtros')}</small>
              </div>
            )}
          </section>

          {(c.lancsMes.length > 0 || filtrando) && (
            <section className="lc-barra">
              <label className="busca">
                <Icone nome="busca" tamanho={16} />
                <input placeholder={tx('Buscar descrição ou categoria')} value={busca} onChange={(e) => setBusca(e.target.value)} />
              </label>
              <Segmentado rotulo={tx('Tipo')} valor={tipo} aoMudar={(t) => { setTipo(t); setCategoria('todos') }}
                opcoes={[{ id: 'todos', nome: tx('Todos') }, { id: 'entrada', nome: tx('Entradas'), cor: COR.entradas }, { id: 'saida', nome: tx('Saídas'), cor: COR.saidas }]} />
              <Segmentado rotulo={tx('Ordem')} valor={ordem} aoMudar={setOrdem}
                opcoes={[{ id: 'data', nome: tx('Por dia') }, { id: 'valor', nome: tx('Maiores') }]} />
              {comBancos && (
                <select className={`lc-select ${banco !== 'todos' ? 'ativo' : ''}`} value={banco} onChange={(e) => setBanco(e.target.value)} aria-label={tx('Banco')}>
                  <option value="todos">{tx('Todos os bancos')}</option>
                  {c.d.bancos.map((b) => <option key={b.id} value={b.id}>{b.nome}</option>)}
                  <option value="sem">{tx('Sem banco')}</option>
                </select>
              )}
              {comFormas && (
                <select className={`lc-select ${forma !== 'todos' ? 'ativo' : ''}`} value={forma} onChange={(e) => setForma(e.target.value as Filtro<FormaPagamento | 'sem'>)} aria-label={tx('Forma de pagamento')}>
                  <option value="todos">{tx('Todas as formas')}</option>
                  {FORMAS.filter((f) => formasDoMes.has(f.id) || forma === f.id).map((f) => (
                    <option key={f.id} value={f.id}>{f.nome} · {fmtValor(formasDoMes.get(f.id) ?? 0)}</option>
                  ))}
                  {(formasDoMes.has('sem') || forma === 'sem') && <option value="sem">{tx('Sem forma · {0}', fmtValor(formasDoMes.get('sem') ?? 0))}</option>}
                </select>
              )}
            </section>
          )}

          {filtrando && (
            <div className="lc-filtrando">
              {dia && <span className="chip-info">{fmtDataLonga(dia)}</span>}
              {categoria !== 'todos' && <span className="chip-info">{chips.find((k) => k.id === categoria)?.nome ?? SEM_CATEGORIA.nome}</span>}
              <span>{tx('{0} de {1}', filtrados.length, c.lancsMes.length)}</span>
              <button className="link" onClick={limpar}><Icone nome="fechar" tamanho={13} /> {tx('Limpar filtros')}</button>
            </div>
          )}

          {!filtrados.length ? (
            <section className={`cartao ${filtrando ? 'lc-vazio' : tx('lc-vazio vz-vazio')}`}>
              {filtrando ? <span className="lc-vazio-icone"><Icone nome="busca" tamanho={30} /></span> : <CenaLancamentos />}
              {filtrando
                ? <strong>{tx('Nada com esses filtros')}</strong>
                : <h2>{c.d.lancs.length === 0 ? tx('Comece a fazer seus lançamentos') : tx('Nada lançado em {0}', noMeioDaFrase(MESES_NOME[c.mes - 1]))}</h2>}
              {!filtrando && <p>{c.d.lancs.length === 0
                ? tx('Registre o que entrou e o que saiu, um por um, ou traga tudo de uma vez do extrato do seu banco. O painel se monta sozinho.')
                : tx('Quando você lançar algo neste mês, ele aparece aqui, dia a dia.')}</p>}
              {filtrando
                ? <button className="btn" onClick={limpar}>{tx('Limpar filtros')}</button>
                : <span className="lc-vazio-acoes">
                    <button className="btn lc-btn-entrada" onClick={() => c.novoLancamento('entrada')}>+ {tx('Entrada')}</button>
                    <button className="btn lc-btn-saida" onClick={() => c.novoLancamento('saida')}>− {tx('Saída')}</button>
                    <button className="btn" onClick={c.importarExtrato}>{tx('Importar extrato ou planilha')}</button>
                  </span>}
            </section>
          ) : ordem === 'valor' ? (
            <div className="lc-cartoes">{filtrados.map((l, i) => cartao(l, i, true))}</div>
          ) : (
            <div className="lc-linha-tempo">
              {grupos.map(([d, itens], gi) => {
                const saldo = itens.reduce((a, l) => a + (l.tipo === 'entrada' ? l.valor : -l.valor), 0)
                const data = d ? new Date(`${d}T12:00:00`) : null
                const ontem = data && d === somaDias(hoje, -1)
                return (
                  <section key={d} className={`lc-dia ${d === hoje ? 'hoje' : ''} ${d === dia ? 'ativo' : ''}`} style={{ animationDelay: `${Math.min(gi, 8) * 50}ms` }}>
                    <button className="lc-dia-marco" onClick={() => d && setDia(d === dia ? null : d)} title={tx('Mostrar só este dia')} disabled={!d}>
                      <b>{data ? doisDig(data.getDate()) : '—'}</b>
                      <small>{data ? SEMANA[data.getDay()] : ''}</small>
                    </button>
                    <div className="lc-dia-corpo">
                      <header className="lc-dia-cab">
                        <span className="lc-dia-nome">{d === hoje ? tx('Hoje') : ontem ? tx('Ontem') : d ? fmtDataLonga(d) : tx('Sem data')}</span>
                        <small>{itens.length} {itens.length === 1 ? tx('lançamento') : tx('lançamentos')}</small>
                        <span className={`lc-dia-saldo ${saldo < 0 ? 'negativo' : 'positivo'}`}>{saldo < 0 ? '−' : '+'} {fmtValor(Math.abs(saldo))}</span>
                      </header>
                      <div className="lc-cartoes">{itens.map((l, i) => cartao(l, i, false))}</div>
                    </div>
                  </section>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Um lançamento como cartão: a categoria em cima, na cor dela (sem selo), a descrição, o valor grande e, embaixo, em
 * texto, o que ele é além de um gasto comum (banco, forma, cartão e parcela, dívida, conta do mês, outra moeda).
 */
function CartaoLancamento({ l, banco, categoria, cartao, emprestimo, aoClicar, mostrarData, indice }: {
  l: Lancamento; banco?: Banco; categoria?: Categoria; cartao?: { nome: string; cor: string }; emprestimo?: boolean
  aoClicar: () => void; mostrarData: boolean; indice: number
}) {
  const entrada = l.tipo === 'entrada'
  const k = categoria ?? SEM_CATEGORIA
  const parcelado = Boolean(l.compra_id && (l.parcelas ?? 1) > 1)
  const etiquetas = [
    banco && { id: 'bc', texto: banco.nome, cor: banco.cor },
    l.cartao_id && { id: 'cc', texto: cartao ? tx('Cartão {0}', cartao.nome) : tx('Cartão'), cor: cartao?.cor },
    parcelado && { id: 'pc', texto: tx('Parcela {0} de {1}', l.parcela, l.parcelas) },
    !l.cartao_id && l.forma && { id: 'fp', texto: infoForma(l.forma).nome },
    l.divida_id && { id: 'dv', texto: emprestimo ? tx('Dinheiro emprestado') : entrada ? tx('Recebido de quem devia') : tx('Pagamento de dívida') },
    l.conta_fixa_id && { id: 'cf', texto: tx('Todo mês') },
  ].filter(Boolean) as { id: string; texto: string; cor?: string }[]
  return (
    <button className={`lc-card ${entrada ? 'entrada' : ''}`} onClick={aoClicar}
      style={{ '--c': k.cor, animationDelay: `${Math.min(indice, 12) * 30}ms` } as React.CSSProperties}>
      <span className="lc-card-topo">
        <span className="lc-card-cat">{k.nome}</span>
        {mostrarData && l.data && <small>{fmtDataCurta(l.data)}</small>}
      </span>
      <span className="lc-card-desc">{l.descricao || (entrada ? tx('Entrada') : tx('Saída'))}</span>
      <span className="lc-card-valor">
        {entrada ? '+' : '−'} {fmtValor(l.valor)}
        {l.moeda_original && l.valor_original != null && <small>{fmtMoeda(l.valor_original, l.moeda_original)}</small>}
      </span>
      {etiquetas.length > 0 && (
        <span className="lc-card-etiquetas">
          {etiquetas.map((e) => <span key={e.id} style={e.cor ? ({ '--e': e.cor } as React.CSSProperties) : undefined} className={e.cor ? 'com-cor' : ''}>{e.texto}</span>)}
        </span>
      )}
    </button>
  )
}

function somaDias(iso: string, n: number) {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${doisDig(d.getMonth() + 1)}-${doisDig(d.getDate())}`
}

/**
 * Calendário do mês: cada dia pinta mais forte quanto mais saiu nele, com um pontinho verde quando entrou dinheiro.
 * Tocar num dia mostra só os lançamentos dele (tocar de novo volta a mostrar todos).
 */
function CalorDoMes({ ano, mes, lancs, dia, hoje, aoEscolher }: {
  ano: number; mes: number; lancs: Lancamento[]; dia: string | null; hoje: string; aoEscolher: (d: string) => void
}) {
  const total = new Date(ano, mes, 0).getDate()
  const offset = new Date(ano, mes - 1, 1).getDay()
  const porDia = Array.from({ length: total }, (_, i) => {
    const d = `${ano}-${doisDig(mes)}-${doisDig(i + 1)}`
    const ls = lancs.filter((l) => l.data === d)
    return { d, n: i + 1, saiu: somaTipo(ls, 'saida'), entrou: somaTipo(ls, 'entrada'), qtd: ls.length }
  })
  const maior = Math.max(1, ...porDia.map((x) => x.saiu))
  const pico = porDia.reduce((a, x) => (x.saiu > a.saiu ? x : a), porDia[0])
  return (
    <div className="cartao lc-calor">
      <header className="lc-calor-cab">
        <h3 className="ccd-titulo">{tx('Dia a dia')}</h3>
        {pico.saiu > 0 && <small>{tx('dia que mais saiu:')} <b>{pico.n}</b> ({fmtValor(pico.saiu)})</small>}
      </header>
      <div className="lc-calor-grade" role="grid" aria-label={tx('Gastos por dia de {0}', MESES_NOME[mes - 1])}>
        {SEMANA_LETRA.map((s, i) => <span key={i} className="lc-calor-semana">{s}</span>)}
        {Array.from({ length: offset }, (_, i) => <span key={`v${i}`} />)}
        {porDia.map((x, i) => (
          <button key={x.d} role="gridcell"
            className={`lc-calor-dia ${x.d === hoje ? 'hoje' : ''} ${x.d === dia ? 'ativo' : ''} ${x.qtd ? '' : 'vazio'} ${x.d > hoje ? 'futuro' : ''}`}
            style={{ '--i': x.saiu / maior, animationDelay: `${i * 12}ms` } as React.CSSProperties}
            title={x.qtd ? tx('{0}: saiu {1}', x.n, fmtValor(x.saiu)) + (x.entrou ? tx(', entrou {0}', fmtValor(x.entrou)) : '') : tx('{0}: nada lançado', x.n)}
            onClick={() => aoEscolher(x.d)} disabled={!x.qtd}>
            {x.n}
            {x.entrou > 0 && <i className="lc-calor-entrou" />}
          </button>
        ))}
      </div>
      <span className="lc-calor-legenda"><small>{tx('menos')}</small><i /><i /><i /><i /><small>{tx('mais gasto')}</small><i className="entrou" /><small>{tx('entrou')}</small></span>
    </div>
  )
}
