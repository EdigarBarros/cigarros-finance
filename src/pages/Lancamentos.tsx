import { useMemo, useState } from 'react'
import { hojeLocal } from '../lib/cartoes'
import { COR } from '../lib/charts'
import { SEM_CATEGORIA } from '../lib/categorias'
import { fmtDataLonga, fmtValor, MESES_NOME } from '../lib/format'
import type { Lancamento, Tipo } from '../lib/types'
import { BancoIcone } from '../components/BancoIcone'
import { Selo } from '../components/Categorias'
import { Icone } from '../components/Icone'
import { ItemLancamento } from '../components/ItemLancamento'
import { Numero } from '../components/Numero'
import { Segmentado } from '../components/ui'
import type { Ctx } from './contexto'

type Filtro<T> = T | 'todos'
const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const SEMANA_LETRA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const doisDig = (n: number) => String(n).padStart(2, '0')
const somaTipo = (ls: Lancamento[], t: Tipo) => ls.filter((l) => l.tipo === t).reduce((a, l) => a + l.valor, 0)

/**
 * Lançamentos do mês: os totais, o calendário do mês (cada dia mais forte quanto mais saiu; tocar filtra o dia), as
 * categorias em chips com o total de cada uma, os bancos, a busca e a lista por dia ou pelos maiores valores.
 */
export function Lancamentos(c: Ctx) {
  const [tipo, setTipo] = useState<Filtro<Tipo>>('todos')
  const [banco, setBanco] = useState<Filtro<string>>('todos')
  /** id da categoria, 'sem' (sem categoria) ou 'todos'. */
  const [categoria, setCategoria] = useState<Filtro<string>>('todos')
  const [dia, setDia] = useState<string | null>(null)
  const [ordem, setOrdem] = useState<'data' | 'valor'>('data')
  const { busca, setBusca } = c
  const hoje = hojeLocal()

  // tudo menos a categoria e o dia: base para os chips de categoria e para o calendário
  const base = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return c.lancsMes
      .filter((l) => tipo === 'todos' || l.tipo === tipo)
      .filter((l) => banco === 'todos' || (banco === 'sem' ? !l.banco_id : l.banco_id === banco))
      .filter((l) => !q || l.descricao.toLowerCase().includes(q) || Boolean(c.categoriaDe(l)?.nome.toLowerCase().includes(q)))
  }, [c.lancsMes, tipo, banco, busca, c.categorias]) // eslint-disable-line react-hooks/exhaustive-deps

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
  const filtrando = tipo !== 'todos' || banco !== 'todos' || categoria !== 'todos' || busca || dia
  const limpar = () => { setTipo('todos'); setBanco('todos'); setCategoria('todos'); setBusca(''); setDia(null) }
  const bancoDe = (l: Lancamento) => (c.v.bancos ? c.d.bancos.find((b) => b.id === l.banco_id) : undefined)
  const cartaoDe = (l: Lancamento) => (l.cartao_id ? c.cartoes.cartoes.find((k) => k.id === l.cartao_id) : undefined)
  const item = (l: Lancamento, i: number, mostrarData: boolean) => (
    <ItemLancamento key={l.id} l={l} indice={i} categoria={c.categoriaDe(l)} banco={bancoDe(l)} cartao={cartaoDe(l)}
      mostrarData={mostrarData} aoClicar={() => c.editarLancamento(l)} />
  )

  return (
    <div className="pagina pg-lanc">
      <header className="pagina-topo">
        <div>
          <h1>Lançamentos</h1>
          <p className="sub">{MESES_NOME[c.mes - 1]} de {c.ano} · {filtrados.length} {filtrados.length === 1 ? 'lançamento' : 'lançamentos'}{filtrando ? ' com os filtros' : ''}</p>
        </div>
        <div className="lc-topo-acoes so-desktop">
          <button className="btn lc-btn-entrada" onClick={() => c.novoLancamento('entrada')}><Icone nome="receber" tamanho={16} /> Entrada</button>
          <button className="btn lc-btn-saida" onClick={() => c.novoLancamento('saida')}><Icone nome="enviar" tamanho={16} /> Saída</button>
        </div>
      </header>

      <section className="lc-topo">
        <div className="lc-totais">
          {[
            { id: 'entrou', rotulo: 'Entrou', valor: entrou, cor: COR.entradas, icone: 'receber' },
            { id: 'saiu', rotulo: 'Saiu', valor: saiu, cor: COR.saidas, icone: 'enviar' },
            { id: 'sobrou', rotulo: entrou - saiu < 0 ? 'Faltou' : 'Sobrou', valor: entrou - saiu, cor: entrou - saiu < 0 ? COR.saidas : COR.caixa, icone: 'investir' },
          ].map((t, i) => (
            <div key={t.id} className="cartao lc-total" style={{ '--c': t.cor, animationDelay: `${i * 60}ms` } as React.CSSProperties}>
              <span className="lc-total-icone"><Icone nome={t.icone} tamanho={18} /></span>
              <span><small>{t.rotulo}</small><strong><Numero valor={Math.abs(t.valor)} formato={fmtValor} /></strong></span>
            </div>
          ))}
        </div>
        <CalorDoMes ano={c.ano} mes={c.mes} lancs={semDia} dia={dia} hoje={hoje} aoEscolher={(d) => setDia(d === dia ? null : d)} />
      </section>

      <section className="cartao lc-lista">
        <div className="lc-filtros">
          <label className="busca">
            <Icone nome="busca" tamanho={16} />
            <input placeholder="Buscar descrição ou categoria" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </label>
          <Segmentado rotulo="Tipo" valor={tipo} aoMudar={(t) => { setTipo(t); setCategoria('todos') }}
            opcoes={[{ id: 'todos', nome: 'Todos' }, { id: 'entrada', nome: 'Entradas', cor: COR.entradas }, { id: 'saida', nome: 'Saídas', cor: COR.saidas }]} />
          <Segmentado rotulo="Ordem" valor={ordem} aoMudar={setOrdem}
            opcoes={[{ id: 'data', nome: 'Recentes' }, { id: 'valor', nome: 'Maiores' }]} />
        </div>

        {chips.length > 0 && (
          <div className="lc-chips" role="group" aria-label="Categorias">
            <button className={`lc-chip ${categoria === 'todos' ? 'ativo' : ''}`} onClick={() => setCategoria('todos')}>
              <span className="lc-chip-todas"><Icone nome="lista" tamanho={14} /></span>
              <span><b>Todas</b><small>{fmtValor(chips.reduce((a, k) => a + k.total, 0))}</small></span>
            </button>
            {chips.map((k) => (
              <button key={k.id} className={`lc-chip ${categoria === k.id ? 'ativo' : ''}`} style={{ '--c': k.cor } as React.CSSProperties}
                onClick={() => setCategoria(categoria === k.id ? 'todos' : k.id)} title={`${k.n} ${k.n === 1 ? 'lançamento' : 'lançamentos'}`}>
                <Selo c={k} tamanho={26} />
                <span><b>{k.nome}</b><small>{fmtValor(k.total)}</small></span>
              </button>
            ))}
            <button className="lc-chip editar" onClick={c.gerenciarCategorias}><Icone nome="lapis" tamanho={14} /> Editar</button>
          </div>
        )}

        {c.v.bancos && c.d.bancos.length > 0 && (
          <div className="lc-bancos" role="group" aria-label="Bancos">
            <button className={`lc-banco ${banco === 'todos' ? 'ativo' : ''}`} onClick={() => setBanco('todos')}>Todos os bancos</button>
            {c.d.bancos.map((b) => (
              <button key={b.id} className={`lc-banco ${banco === b.id ? 'ativo' : ''}`} onClick={() => setBanco(banco === b.id ? 'todos' : b.id)}>
                <BancoIcone nome={b.nome} cor={b.cor} tamanho={18} />{b.nome}
              </button>
            ))}
            <button className={`lc-banco ${banco === 'sem' ? 'ativo' : ''}`} onClick={() => setBanco(banco === 'sem' ? 'todos' : 'sem')}>Sem banco</button>
          </div>
        )}

        {filtrando && (
          <div className="lc-filtrando">
            {dia && <span className="chip-info"><Icone nome="calendario" tamanho={12} /> {fmtDataLonga(dia)}</span>}
            <span>{filtrados.length} de {c.lancsMes.length}</span>
            <button className="link" onClick={limpar}><Icone nome="fechar" tamanho={13} /> Limpar filtros</button>
          </div>
        )}

        {!filtrados.length ? (
          <div className="lc-vazio">
            <span className="lc-vazio-icone"><Icone nome={filtrando ? 'busca' : 'lista'} tamanho={30} /></span>
            <strong>{filtrando ? 'Nada com esses filtros' : `Nada lançado em ${MESES_NOME[c.mes - 1].toLowerCase()}`}</strong>
            {filtrando
              ? <button className="btn" onClick={limpar}>Limpar filtros</button>
              : <span className="lc-vazio-acoes">
                  <button className="btn lc-btn-entrada" onClick={() => c.novoLancamento('entrada')}><Icone nome="receber" tamanho={16} /> Entrada</button>
                  <button className="btn lc-btn-saida" onClick={() => c.novoLancamento('saida')}><Icone nome="enviar" tamanho={16} /> Saída</button>
                </span>}
          </div>
        ) : ordem === 'valor' ? (
          <ul className="lista-lanc lc-itens">{filtrados.map((l, i) => item(l, i, true))}</ul>
        ) : (
          grupos.map(([d, itens], gi) => {
            const saldo = itens.reduce((a, l) => a + (l.tipo === 'entrada' ? l.valor : -l.valor), 0)
            const data = d ? new Date(`${d}T12:00:00`) : null
            const ontem = data && d === somaDias(hoje, -1)
            return (
              <section key={d} className="lc-dia" style={{ animationDelay: `${Math.min(gi, 8) * 50}ms` }}>
                <header className="lc-dia-cab">
                  <span className={`lc-dia-tile ${d === hoje ? 'hoje' : ''}`}>
                    <b>{data ? doisDig(data.getDate()) : '—'}</b>
                    <small>{data ? SEMANA[data.getDay()] : ''}</small>
                  </span>
                  <span className="lc-dia-nome">{d === hoje ? 'Hoje' : ontem ? 'Ontem' : d ? fmtDataLonga(d) : 'Sem data'}<small>{itens.length} {itens.length === 1 ? 'lançamento' : 'lançamentos'}</small></span>
                  <span className={`lc-dia-saldo ${saldo < 0 ? 'negativo' : 'positivo'}`}>{saldo < 0 ? '−' : '+'} {fmtValor(Math.abs(saldo))}</span>
                </header>
                <ul className="lista-lanc lc-itens">{itens.map((l, i) => item(l, i, false))}</ul>
              </section>
            )
          })
        )}
      </section>
    </div>
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
        <h3 className="ccd-titulo">Dia a dia</h3>
        {pico.saiu > 0 && <small>dia que mais saiu: <b>{pico.n}</b> ({fmtValor(pico.saiu)})</small>}
      </header>
      <div className="lc-calor-grade" role="grid" aria-label={`Gastos por dia de ${MESES_NOME[mes - 1]}`}>
        {SEMANA_LETRA.map((s, i) => <span key={i} className="lc-calor-semana">{s}</span>)}
        {Array.from({ length: offset }, (_, i) => <span key={`v${i}`} />)}
        {porDia.map((x, i) => (
          <button key={x.d} role="gridcell"
            className={`lc-calor-dia ${x.d === hoje ? 'hoje' : ''} ${x.d === dia ? 'ativo' : ''} ${x.qtd ? '' : 'vazio'} ${x.d > hoje ? 'futuro' : ''}`}
            style={{ '--i': x.saiu / maior, animationDelay: `${i * 12}ms` } as React.CSSProperties}
            title={x.qtd ? `${x.n}: saiu ${fmtValor(x.saiu)}${x.entrou ? `, entrou ${fmtValor(x.entrou)}` : ''}` : `${x.n}: nada lançado`}
            onClick={() => aoEscolher(x.d)} disabled={!x.qtd}>
            {x.n}
            {x.entrou > 0 && <i className="lc-calor-entrou" />}
          </button>
        ))}
      </div>
      <span className="lc-calor-legenda"><small>menos</small><i /><i /><i /><i /><small>mais gasto</small><i className="entrou" /><small>entrou</small></span>
    </div>
  )
}
