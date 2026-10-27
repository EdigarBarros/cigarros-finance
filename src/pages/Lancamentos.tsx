import { useMemo, useState } from 'react'
import { COR } from '../lib/charts'
import { fmtBRL, fmtDataLonga, MESES_NOME } from '../lib/format'
import { CATEGORIAS, CONTAS } from '../lib/rotulos'
import type { Categoria, Conta, Tipo } from '../lib/types'
import { Icone } from '../components/Icone'
import { ItemLancamento } from '../components/ItemLancamento'
import { Cartao, Segmentado, Vazio } from '../components/ui'
import type { Ctx } from './contexto'

type Filtro<T> = T | 'todos'

export function Lancamentos(c: Ctx) {
  const [tipo, setTipo] = useState<Filtro<Tipo>>('todos')
  const [conta, setConta] = useState<Filtro<Conta>>('todos')
  const [categoria, setCategoria] = useState<Filtro<Categoria>>('todos')
  const [busca, setBusca] = useState('')

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return c.lancsMes
      .filter((l) => tipo === 'todos' || l.tipo === tipo)
      .filter((l) => conta === 'todos' || (l.tipo === 'saida' && l.conta === conta))
      .filter((l) => categoria === 'todos' || (l.tipo === 'saida' && l.categoria === categoria))
      .filter((l) => !q || l.descricao.toLowerCase().includes(q))
      .sort((x, y) => (y.data ?? '').localeCompare(x.data ?? '') || (y.created_at ?? '').localeCompare(x.created_at ?? ''))
  }, [c.lancsMes, tipo, conta, categoria, busca])

  const dias = useMemo(() => {
    const g = new Map<string, typeof filtrados>()
    for (const l of filtrados) g.set(l.data ?? '', [...(g.get(l.data ?? '') ?? []), l])
    return [...g.entries()]
  }, [filtrados])

  const soma = (t: Tipo) => filtrados.filter((l) => l.tipo === t).reduce((a, l) => a + l.valor, 0)
  const filtrando = tipo !== 'todos' || conta !== 'todos' || categoria !== 'todos' || busca

  return (
    <div className="pagina">
      <header className="pagina-topo">
        <div>
          <h1>Lançamentos</h1>
          <p className="sub">{MESES_NOME[c.mes - 1]} de {c.ano} · {filtrados.length} {filtrados.length === 1 ? 'lançamento' : 'lançamentos'}</p>
        </div>
        <button className="btn primario so-desktop" onClick={() => c.novoLancamento()}><Icone nome="mais" tamanho={16} /> Novo lançamento</button>
      </header>

      <div className="faixa-totais">
        <div><span>Entradas</span><strong style={{ color: COR.entradas }}>{fmtBRL(soma('entrada'))}</strong></div>
        <div><span>Saídas</span><strong style={{ color: COR.saidas }}>{fmtBRL(soma('saida'))}</strong></div>
        <div><span>Saldo</span><strong>{fmtBRL(soma('entrada') - soma('saida'))}</strong></div>
      </div>

      <Cartao>
        <div className="filtros">
          <label className="busca">
            <Icone nome="busca" tamanho={16} />
            <input placeholder="Buscar descrição" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </label>
          <Segmentado rotulo="Tipo" valor={tipo} aoMudar={setTipo}
            opcoes={[{ id: 'todos', nome: 'Todos' }, { id: 'entrada', nome: 'Entradas' }, { id: 'saida', nome: 'Saídas' }]} />
          <select value={conta} onChange={(e) => setConta(e.target.value as Filtro<Conta>)} aria-label="Conta">
            <option value="todos">Todas as contas</option>
            {CONTAS.map((k) => <option key={k.id} value={k.id}>{k.nome}</option>)}
          </select>
          <select value={categoria} onChange={(e) => setCategoria(e.target.value as Filtro<Categoria>)} aria-label="Categoria">
            <option value="todos">Todas as categorias</option>
            {CATEGORIAS.map((k) => <option key={k.id} value={k.id}>{k.nome}</option>)}
          </select>
          {filtrando && (
            <button className="link" onClick={() => { setTipo('todos'); setConta('todos'); setCategoria('todos'); setBusca('') }}>Limpar filtros</button>
          )}
        </div>

        {dias.length ? (
          dias.map(([dia, itens]) => {
            const saldoDia = itens.reduce((a, l) => a + (l.tipo === 'entrada' ? l.valor : -l.valor), 0)
            return (
              <section key={dia} className="dia">
                <header>
                  <span>{fmtDataLonga(dia || null)}</span>
                  <span className={saldoDia < 0 ? 'negativo' : 'positivo'}>{fmtBRL(saldoDia)}</span>
                </header>
                <ul className="lista-lanc">
                  {itens.map((l) => <ItemLancamento key={l.id} l={l} mostrarData={false} aoClicar={() => c.editarLancamento(l)} />)}
                </ul>
              </section>
            )
          })
        ) : (
          <Vazio>{filtrando ? 'Nenhum lançamento com esses filtros.' : 'Nenhum lançamento neste mês. Toque em + para começar.'}</Vazio>
        )}
      </Cartao>
    </div>
  )
}
