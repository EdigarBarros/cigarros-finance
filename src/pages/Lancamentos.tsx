import { useMemo, useState } from 'react'
import { COR } from '../lib/charts'
import { fmtValor, fmtDataLonga, MESES_NOME } from '../lib/format'
import { doTipo } from '../lib/categorias'
import type { Tipo } from '../lib/types'
import { Icone } from '../components/Icone'
import { ItemLancamento } from '../components/ItemLancamento'
import { Cartao, Segmentado, Vazio } from '../components/ui'
import type { Ctx } from './contexto'

type Filtro<T> = T | 'todos'

export function Lancamentos(c: Ctx) {
  const [tipo, setTipo] = useState<Filtro<Tipo>>('todos')
  const [banco, setBanco] = useState<Filtro<string>>('todos')
  /** id da categoria, 'sem' (sem categoria) ou 'todos'. */
  const [categoria, setCategoria] = useState<Filtro<string>>('todos')
  const [busca, setBusca] = useState('')

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return c.lancsMes
      .filter((l) => tipo === 'todos' || l.tipo === tipo)
      .filter((l) => banco === 'todos' || (banco === 'sem' ? !l.banco_id : l.banco_id === banco))
      .filter((l) => categoria === 'todos' || (categoria === 'sem' ? !c.categoriaDe(l) : c.categoriaDe(l)?.id === categoria))
      .filter((l) => !q || l.descricao.toLowerCase().includes(q))
      .sort((x, y) => (y.data ?? '').localeCompare(x.data ?? '') || (y.created_at ?? '').localeCompare(x.created_at ?? ''))
  }, [c.lancsMes, tipo, banco, categoria, busca]) // eslint-disable-line react-hooks/exhaustive-deps

  const dias = useMemo(() => {
    const g = new Map<string, typeof filtrados>()
    for (const l of filtrados) g.set(l.data ?? '', [...(g.get(l.data ?? '') ?? []), l])
    return [...g.entries()]
  }, [filtrados])

  const soma = (t: Tipo) => filtrados.filter((l) => l.tipo === t).reduce((a, l) => a + l.valor, 0)
  const filtrando = tipo !== 'todos' || banco !== 'todos' || categoria !== 'todos' || busca

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
        <div><span>Entradas</span><strong style={{ color: COR.entradas }}>{fmtValor(soma('entrada'))}</strong></div>
        <div><span>Saídas</span><strong style={{ color: COR.saidas }}>{fmtValor(soma('saida'))}</strong></div>
        <div><span>Saldo</span><strong>{fmtValor(soma('entrada') - soma('saida'))}</strong></div>
      </div>

      <Cartao>
        <div className="filtros">
          <label className="busca">
            <Icone nome="busca" tamanho={16} />
            <input placeholder="Buscar descrição" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </label>
          <Segmentado rotulo="Tipo" valor={tipo} aoMudar={setTipo}
            opcoes={[{ id: 'todos', nome: 'Todos' }, { id: 'entrada', nome: 'Entradas' }, { id: 'saida', nome: 'Saídas' }]} />
          {c.v.bancos && c.d.bancos.length > 0 && (
            <select value={banco} onChange={(e) => setBanco(e.target.value)} aria-label="Banco">
              <option value="todos">Todos os bancos</option>
              {c.d.bancos.map((b) => <option key={b.id} value={b.id}>{b.nome}</option>)}
              <option value="sem">Sem banco</option>
            </select>
          )}
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)} aria-label="Categoria">
            <option value="todos">Todas as categorias</option>
            {(['saida', 'entrada'] as const).map((t) => (
              <optgroup key={t} label={t === 'saida' ? 'Saídas' : 'Entradas'}>
                {doTipo(c.categorias, t).map((k) => <option key={k.id} value={k.id}>{k.icone} {k.nome}</option>)}
              </optgroup>
            ))}
            <option value="sem">Sem categoria</option>
          </select>
          <button className="link" onClick={c.gerenciarCategorias}>Editar categorias</button>
          {filtrando && (
            <button className="link" onClick={() => { setTipo('todos'); setBanco('todos'); setCategoria('todos'); setBusca('') }}>Limpar filtros</button>
          )}
        </div>

        {dias.length ? (
          dias.map(([dia, itens]) => {
            const saldoDia = itens.reduce((a, l) => a + (l.tipo === 'entrada' ? l.valor : -l.valor), 0)
            return (
              <section key={dia} className="dia">
                <header>
                  <span>{fmtDataLonga(dia || null)}</span>
                  <span className={saldoDia < 0 ? 'negativo' : 'positivo'}>{fmtValor(saldoDia)}</span>
                </header>
                <ul className="lista-lanc">
                  {itens.map((l) => <ItemLancamento key={l.id} l={l} categoria={c.categoriaDe(l)} banco={c.v.bancos ? c.d.bancos.find((b) => b.id === l.banco_id) : undefined} mostrarData={false} aoClicar={() => c.editarLancamento(l)} />)}
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
