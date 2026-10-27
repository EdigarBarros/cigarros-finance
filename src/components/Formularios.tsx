import { useMemo, useRef, useState } from 'react'
import { COR } from '../lib/charts'
import { dataPadrao, paraCampo, parseNumero } from '../lib/format'
import { CATEGORIAS, CONTAS } from '../lib/rotulos'
import type { Categoria, Conta, Divida, Lancamento, Tipo } from '../lib/types'
import { Modal, Segmentado } from './ui'

type NovoLanc = Omit<Lancamento, 'id'>

interface FormLancProps {
  ano: number
  mes: number
  inicial?: Lancamento
  tipoInicial?: Tipo
  /** Lançamentos já feitos, para sugerir descrição, conta e categoria. */
  historico: Lancamento[]
  aoSalvar: (l: NovoLanc, id?: string) => void
  aoExcluir?: (id: string) => void
  aoFechar: () => void
}

export function FormLancamento({ ano, mes, inicial, tipoInicial = 'saida', historico, aoSalvar, aoExcluir, aoFechar }: FormLancProps) {
  const [tipo, setTipo] = useState<Tipo>(inicial?.tipo ?? tipoInicial)
  const [valor, setValor] = useState(inicial ? paraCampo(inicial.valor) : '')
  const [descricao, setDescricao] = useState(inicial?.descricao ?? '')
  const [data, setData] = useState(inicial?.data ?? dataPadrao(ano, mes))
  const [conta, setConta] = useState<Conta>(inicial?.conta ?? 'principal')
  const [categoria, setCategoria] = useState<Categoria>(inicial?.categoria ?? 'outros')
  const [mexeuCategoria, setMexeuCategoria] = useState(Boolean(inicial))
  const [erro, setErro] = useState<string | null>(null)
  const [salvos, setSalvos] = useState(0)
  const campoValor = useRef<HTMLInputElement>(null)

  // Última conta/categoria usada para cada descrição — "iFood" já vem como alimentação.
  const memoria = useMemo(() => {
    const m = new Map<string, Lancamento>()
    for (const l of historico) if (l.descricao) m.set(chave(l.descricao), l)
    return m
  }, [historico])
  const sugestoes = useMemo(
    () => [...new Set(historico.filter((l) => l.tipo === tipo).map((l) => l.descricao).filter(Boolean))].slice(-300),
    [historico, tipo],
  )

  const aoDigitarDescricao = (d: string) => {
    setDescricao(d)
    const anterior = memoria.get(chave(d))
    if (anterior && !mexeuCategoria && anterior.tipo === tipo) {
      setCategoria(anterior.categoria)
      setConta(anterior.conta)
    }
  }

  const salvar = (continuar: boolean) => {
    const n = parseNumero(valor)
    if (!n || n <= 0) {
      setErro('Informe um valor maior que zero.')
      campoValor.current?.focus()
      return
    }
    if (!data) return setErro('Informe a data.')
    const [a, m] = data.split('-').map(Number)
    aoSalvar(
      {
        ano: a, mes: m, tipo, valor: n, descricao: descricao.trim(), data,
        conta: tipo === 'saida' ? conta : 'principal',
        categoria: tipo === 'saida' ? categoria : 'outros',
      },
      inicial?.id,
    )
    if (!continuar) return aoFechar()
    setValor('')
    setDescricao('')
    setMexeuCategoria(false)
    setErro(null)
    setSalvos((s) => s + 1)
    campoValor.current?.focus()
  }

  const cor = tipo === 'entrada' ? COR.entradas : COR.saidas

  return (
    <Modal titulo={inicial ? 'Editar lançamento' : 'Novo lançamento'} aoFechar={aoFechar}>
      <form className="form" onSubmit={(e) => { e.preventDefault(); salvar(false) }}>
        <Segmentado
          rotulo="Tipo"
          valor={tipo}
          aoMudar={setTipo}
          opcoes={[
            { id: 'saida', nome: 'Saída', cor: COR.saidas },
            { id: 'entrada', nome: 'Entrada', cor: COR.entradas },
          ]}
        />
        <label className="valor-grande" style={{ '--c': cor } as React.CSSProperties}>
          <span>R$</span>
          <input
            ref={campoValor}
            autoFocus
            inputMode="decimal"
            placeholder="0,00"
            value={valor}
            onChange={(e) => { setValor(e.target.value); setErro(null) }}
            aria-label="Valor"
          />
        </label>
        <label className="campo">
          <span className="campo-rotulo">Descrição</span>
          <input
            list="sugestoes-descricao"
            value={descricao}
            onChange={(e) => aoDigitarDescricao(e.target.value)}
            placeholder={tipo === 'saida' ? 'Ex.: iFood, 99, mercado…' : 'Ex.: salário, Pix de cliente…'}
          />
          <datalist id="sugestoes-descricao">
            {sugestoes.map((s) => <option key={s} value={s} />)}
          </datalist>
        </label>
        <label className="campo">
          <span className="campo-rotulo">Data</span>
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} required />
        </label>
        {tipo === 'saida' && (
          <>
            <div className="campo">
              <span className="campo-rotulo">Conta</span>
              <Segmentado rotulo="Conta" valor={conta} aoMudar={setConta} opcoes={CONTAS} />
            </div>
            <div className="campo">
              <span className="campo-rotulo">Categoria</span>
              <Segmentado
                rotulo="Categoria"
                valor={categoria}
                aoMudar={(c) => { setCategoria(c); setMexeuCategoria(true) }}
                opcoes={CATEGORIAS}
              />
            </div>
          </>
        )}
        {erro && <p className="form-erro">{erro}</p>}
        {salvos > 0 && !erro && <p className="form-ok">{salvos} lançamento{salvos > 1 ? 's' : ''} salvo{salvos > 1 ? 's' : ''}. Pode lançar o próximo.</p>}
        <div className="form-acoes">
          {inicial && aoExcluir && (
            <button
              type="button"
              className="btn perigo"
              onClick={() => { if (confirm('Excluir este lançamento?')) { aoExcluir(inicial.id); aoFechar() } }}
            >
              Excluir
            </button>
          )}
          <span className="espaco" />
          {!inicial && <button type="button" className="btn" onClick={() => salvar(true)}>Salvar e lançar outro</button>}
          <button type="submit" className="btn primario">Salvar</button>
        </div>
      </form>
    </Modal>
  )
}

const chave = (s: string) => s.trim().toLowerCase().replace(/\s+[–-]\s+\d+x$/, '')

interface FormDividaProps {
  ano: number
  mes: number
  inicial?: Divida
  ordem: number
  aoSalvar: (d: Omit<Divida, 'id'>, id?: string) => void
  aoExcluir?: (id: string) => void
  aoFechar: () => void
}

export function FormDivida({ ano, mes, inicial, ordem, aoSalvar, aoExcluir, aoFechar }: FormDividaProps) {
  const [descricao, setDescricao] = useState(inicial?.descricao ?? '')
  const [valor, setValor] = useState(inicial ? paraCampo(inicial.valor_mensal) : '')
  const [parcelas, setParcelas] = useState(String(inicial?.parcelas ?? 1))
  const [pagas, setPagas] = useState(String(inicial?.pagas ?? 0))
  const [erro, setErro] = useState<string | null>(null)

  const salvar = () => {
    const v = parseNumero(valor)
    const p = Number(parcelas)
    const pg = Number(pagas)
    if (!descricao.trim()) return setErro('Dê um nome para a dívida.')
    if (!v || v <= 0) return setErro('Informe o valor de cada parcela.')
    if (!Number.isInteger(p) || p < 1) return setErro('Parcelas precisa ser 1 ou mais.')
    if (!Number.isInteger(pg) || pg < 0 || pg > p) return setErro('Pagas precisa estar entre 0 e o total de parcelas.')
    aoSalvar({ ano, mes, descricao: descricao.trim(), valor_mensal: v, parcelas: p, pagas: pg, ordem: inicial?.ordem ?? ordem }, inicial?.id)
    aoFechar()
  }

  return (
    <Modal titulo={inicial ? 'Editar dívida' : 'Nova dívida'} aoFechar={aoFechar}>
      <form className="form" onSubmit={(e) => { e.preventDefault(); salvar() }}>
        <label className="campo">
          <span className="campo-rotulo">Nome</span>
          <input autoFocus value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Notebook, cartão Nubank…" />
        </label>
        <label className="campo">
          <span className="campo-rotulo">Valor de cada parcela (R$)</span>
          <input inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" />
        </label>
        <div className="form-linha">
          <label className="campo">
            <span className="campo-rotulo">Total de parcelas</span>
            <input type="number" min={1} value={parcelas} onChange={(e) => setParcelas(e.target.value)} />
          </label>
          <label className="campo">
            <span className="campo-rotulo">Já pagas</span>
            <input type="number" min={0} value={pagas} onChange={(e) => setPagas(e.target.value)} />
          </label>
        </div>
        {erro && <p className="form-erro">{erro}</p>}
        <div className="form-acoes">
          {inicial && aoExcluir && (
            <button
              type="button"
              className="btn perigo"
              onClick={() => { if (confirm(`Excluir "${inicial.descricao}"?`)) { aoExcluir(inicial.id); aoFechar() } }}
            >
              Excluir
            </button>
          )}
          <span className="espaco" />
          <button type="button" className="btn" onClick={aoFechar}>Cancelar</button>
          <button type="submit" className="btn primario">Salvar</button>
        </div>
      </form>
    </Modal>
  )
}
