import { useRef, useState } from 'react'
import { dataPadrao, fmtBRL, parseNumero } from '../lib/format'
import type { Categoria, Conta, Lancamento, Tipo } from '../lib/types'
import { CelulaData, CelulaNumero, CelulaTexto } from './Celula'

const CATEGORIAS: { id: Categoria; letra: string; nome: string }[] = [
  { id: 'outros', letra: 'O', nome: 'Outros' },
  { id: 'transporte', letra: 'T', nome: 'Transporte' },
  { id: 'divida', letra: 'D', nome: 'Dívida' },
  { id: 'alimentacao', letra: 'A', nome: 'Alimentação' },
]

interface Props {
  titulo: string
  tema: 'entrada' | 'saida' | 'nubank' | 'inter'
  tipo: Tipo
  conta: Conta
  ano: number
  mes: number
  itens: Lancamento[]
  onAdd: (l: Omit<Lancamento, 'id'>) => void
  onUpd: (id: string, patch: Partial<Lancamento>) => void
  onDel: (id: string) => void
  /** Mostra a coluna DATA no cabeçalho (só a primeira seção de saídas tem, como na planilha). */
  cabecalho?: boolean
}

export function ListaLancamentos(p: Props) {
  const total = p.itens.reduce((a, l) => a + l.valor, 0)
  const saida = p.tipo === 'saida'

  return (
    <section className={`lista tema-${p.tema}`}>
      <div className="lista-cab">
        <span>{p.titulo}</span>
        {p.cabecalho !== false && (
          <>
            <span className="num">VALOR</span>
            <span>DATA</span>
          </>
        )}
      </div>
      {p.itens.map((l) => (
        <div className="linha" key={l.id}>
          <CelulaTexto value={l.descricao} onCommit={(descricao) => p.onUpd(l.id, { descricao })} ariaLabel="Descrição" />
          <CelulaNumero value={l.valor} format={fmtBRL} onCommit={(valor) => p.onUpd(l.id, { valor })} ariaLabel="Valor" />
          <CelulaData value={l.data} onCommit={(data) => p.onUpd(l.id, { data })} ariaLabel="Data" />
          <div className="acoes">
            {saida && <BotaoCategoria valor={l.categoria} onChange={(categoria) => p.onUpd(l.id, { categoria })} />}
            <button
              type="button"
              className="apagar"
              title="Apagar linha"
              onClick={() => confirm(`Apagar "${l.descricao || fmtBRL(l.valor)}"?`) && p.onDel(l.id)}
            >
              ×
            </button>
          </div>
        </div>
      ))}
      <LinhaNova {...p} />
      <div className="lista-total">
        <span>TOTAL</span>
        <span className="num">{fmtBRL(total)}</span>
        <span />
      </div>
    </section>
  )
}

function BotaoCategoria({ valor, onChange }: { valor: Categoria; onChange: (c: Categoria) => void }) {
  const i = CATEGORIAS.findIndex((c) => c.id === valor)
  const atual = CATEGORIAS[i]
  return (
    <button
      type="button"
      className={`categoria cat-${valor}`}
      title={`Categoria: ${atual.nome} (clique para trocar)`}
      onClick={() => onChange(CATEGORIAS[(i + 1) % CATEGORIAS.length].id)}
    >
      {atual.letra}
    </button>
  )
}

/** Linha em branco no fim da lista: digite e aperte Enter (ou saia da linha) para lançar. */
function LinhaNova(p: Props) {
  const [desc, setDesc] = useState('')
  const [valor, setValor] = useState('')
  const [data, setData] = useState(() => dataPadrao(p.ano, p.mes))
  const [categoria, setCategoria] = useState<Categoria>('outros')
  const [invalido, setInvalido] = useState(false)
  const linha = useRef<HTMLFormElement>(null)
  const primeiro = useRef<HTMLInputElement>(null)

  const lancar = (manterFoco: boolean) => {
    if (!desc.trim() && !valor.trim()) return
    const n = valor.trim() ? parseNumero(valor) : 0
    if (n === null) return setInvalido(true)
    p.onAdd({
      ano: p.ano, mes: p.mes, tipo: p.tipo, conta: p.conta,
      descricao: desc.trim(), valor: n, data: data || null, categoria,
    })
    setDesc('')
    setValor('')
    setCategoria('outros')
    if (manterFoco) primeiro.current?.focus()
  }

  return (
    <form
      ref={linha}
      className="linha nova"
      onSubmit={(e) => {
        e.preventDefault()
        lancar(true)
      }}
      onBlur={(e) => {
        if (!linha.current?.contains(e.relatedTarget as Node | null)) lancar(false)
      }}
    >
      <input
        ref={primeiro}
        className="celula"
        placeholder="+ novo lançamento"
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        aria-label="Nova descrição"
      />
      <input
        className={`celula num ${invalido ? 'invalido' : ''}`}
        placeholder="0,00"
        inputMode="decimal"
        value={valor}
        onChange={(e) => {
          setValor(e.target.value)
          setInvalido(false)
        }}
        aria-label="Novo valor"
      />
      <CelulaData value={data} onCommit={(v) => setData(v ?? '')} ariaLabel="Nova data" />
      <div className="acoes">
        {p.tipo === 'saida' && <BotaoCategoria valor={categoria} onChange={setCategoria} />}
        <button type="submit" className="adicionar" title="Lançar">
          ↵
        </button>
      </div>
    </form>
  )
}
