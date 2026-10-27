import { useMemo, useRef, useState } from 'react'
import { COR } from '../lib/charts'
import { dividaPelaDescricao, type SituacaoDivida } from '../lib/dividas'
import { dataPadrao, fmtBRL, paraCampo, parseNumero } from '../lib/format'
import { CATEGORIAS, CONTAS } from '../lib/rotulos'
import type { Categoria, Conta, Divida, Lancamento, Tipo } from '../lib/types'
import { Modal, Segmentado } from './ui'

type NovoLanc = Omit<Lancamento, 'id'>

interface FormLancProps {
  ano: number
  mes: number
  inicial?: Lancamento
  /** Valores pré-preenchidos (ex.: pagamento de uma dívida). */
  preset?: Partial<NovoLanc>
  tipoInicial?: Tipo
  /** Lançamentos já feitos, para sugerir descrição, conta e categoria. */
  historico: Lancamento[]
  /** Dívidas em aberto, para ligar o pagamento. */
  dividas: Divida[]
  aoSalvar: (l: NovoLanc, id?: string) => void
  aoExcluir?: (id: string) => void
  aoFechar: () => void
}

export function FormLancamento(p: FormLancProps) {
  const ini = { ...p.preset, ...p.inicial }
  const [tipo, setTipo] = useState<Tipo>(ini.tipo ?? p.tipoInicial ?? 'saida')
  const [valor, setValor] = useState(ini.valor ? paraCampo(ini.valor) : '')
  const [descricao, setDescricao] = useState(ini.descricao ?? '')
  const [data, setData] = useState(ini.data ?? dataPadrao(p.ano, p.mes))
  const [conta, setConta] = useState<Conta>(ini.conta ?? 'principal')
  const [categoria, setCategoria] = useState<Categoria>(ini.categoria ?? 'outros')
  const [dividaId, setDividaId] = useState<string>(ini.divida_id ?? '')
  const [mexeuCategoria, setMexeuCategoria] = useState(Boolean(p.inicial || p.preset))
  const [mexeuDivida, setMexeuDivida] = useState(Boolean(p.inicial || p.preset))
  const [erro, setErro] = useState<string | null>(null)
  const [salvos, setSalvos] = useState(0)
  const campoValor = useRef<HTMLInputElement>(null)

  // Última conta/categoria usada para cada descrição — "iFood" já vem como alimentação.
  const memoria = useMemo(() => {
    const m = new Map<string, Lancamento>()
    for (const l of p.historico) if (l.descricao) m.set(chave(l.descricao), l)
    return m
  }, [p.historico])
  const sugestoes = useMemo(
    () => [...new Set(p.historico.filter((l) => l.tipo === tipo).map((l) => l.descricao).filter(Boolean))].slice(-300),
    [p.historico, tipo],
  )
  // A dívida ligada pode já ter sido quitada; continua na lista para não sumir da edição.
  const opcoesDivida = useMemo(() => {
    const extra = ini.divida_id && !p.dividas.some((d) => d.id === ini.divida_id) ? [{ id: ini.divida_id, descricao: 'Dívida quitada', valor_parcela: null }] : []
    return [...p.dividas, ...extra]
  }, [p.dividas, ini.divida_id])

  const escolherDivida = (id: string) => {
    setDividaId(id)
    setMexeuDivida(true)
    const d = opcoesDivida.find((x) => x.id === id)
    if (d) {
      setCategoria('divida')
      if (!valor && d.valor_parcela) setValor(paraCampo(d.valor_parcela))
      if (!descricao) setDescricao(`${d.descricao} – parcela`)
    }
  }

  const aoDigitarDescricao = (texto: string) => {
    setDescricao(texto)
    const anterior = memoria.get(chave(texto))
    if (anterior && !mexeuCategoria && anterior.tipo === tipo) {
      setCategoria(anterior.categoria)
      setConta(anterior.conta)
    }
    // "Notebook – parcela" já se liga à dívida do notebook.
    if (!mexeuDivida && tipo === 'saida') {
      const d = dividaPelaDescricao(texto, p.dividas)
      setDividaId(d?.id ?? '')
      if (d && !mexeuCategoria) setCategoria('divida')
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
    const saida = tipo === 'saida'
    const ligada = saida && categoria === 'divida' && dividaId ? dividaId : null
    p.aoSalvar(
      {
        ano: a, mes: m, tipo, valor: n, descricao: descricao.trim(), data,
        conta: saida ? conta : 'principal',
        categoria: saida ? categoria : 'outros',
        divida_id: ligada,
      },
      p.inicial?.id,
    )
    if (!continuar) return p.aoFechar()
    setValor('')
    setDescricao('')
    setDividaId('')
    setMexeuCategoria(false)
    setMexeuDivida(false)
    setErro(null)
    setSalvos((s) => s + 1)
    campoValor.current?.focus()
  }

  const cor = tipo === 'entrada' ? COR.entradas : COR.saidas

  return (
    <Modal titulo={p.inicial ? 'Editar lançamento' : p.preset?.divida_id ? 'Pagamento de dívida' : 'Novo lançamento'} aoFechar={p.aoFechar}>
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
            {categoria === 'divida' && opcoesDivida.length > 0 && (
              <label className="campo">
                <span className="campo-rotulo">Abate qual dívida?</span>
                <select value={dividaId} onChange={(e) => escolherDivida(e.target.value)}>
                  <option value="">Nenhuma (só conta como gasto com dívida)</option>
                  {opcoesDivida.map((d) => (
                    <option key={d.id} value={d.id}>{d.descricao}{d.valor_parcela ? ` · parcela ${fmtBRL(d.valor_parcela)}` : ''}</option>
                  ))}
                </select>
                {dividaId && <span className="campo-ajuda">O saldo da dívida cai automaticamente com este pagamento.</span>}
              </label>
            )}
          </>
        )}
        {erro && <p className="form-erro">{erro}</p>}
        {salvos > 0 && !erro && <p className="form-ok">{salvos} lançamento{salvos > 1 ? 's' : ''} salvo{salvos > 1 ? 's' : ''}. Pode lançar o próximo.</p>}
        <div className="form-acoes">
          {p.inicial && p.aoExcluir && (
            <button
              type="button"
              className="btn perigo"
              onClick={() => { if (confirm('Excluir este lançamento?')) { p.aoExcluir!(p.inicial!.id); p.aoFechar() } }}
            >
              Excluir
            </button>
          )}
          <span className="espaco" />
          {!p.inicial && !p.preset && <button type="button" className="btn" onClick={() => salvar(true)}>Salvar e lançar outro</button>}
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
  /** Ao editar: a dívida e como ela está no mês aberto. */
  situacao?: SituacaoDivida
  aoCriar: (d: { descricao: string; valor_parcela: number | null; saldo: number; data: string }) => void
  aoEditar: (id: string, patch: Partial<Divida>) => void
  aoNovoSaldo: (id: string, data: string, saldo: number) => void
  aoExcluir: (id: string) => void
  aoFechar: () => void
}

export function FormDivida({ ano, mes, situacao, aoCriar, aoEditar, aoNovoSaldo, aoExcluir, aoFechar }: FormDividaProps) {
  const d = situacao?.divida
  const [descricao, setDescricao] = useState(d?.descricao ?? '')
  const [parcela, setParcela] = useState(d?.valor_parcela ? paraCampo(d.valor_parcela) : '')
  const [saldo, setSaldo] = useState('')
  const [data, setData] = useState(dataPadrao(ano, mes))
  const [erro, setErro] = useState<string | null>(null)

  const salvar = () => {
    if (!descricao.trim()) return setErro('Dê um nome para a dívida.')
    const vp = parcela.trim() ? parseNumero(parcela) : null
    if (parcela.trim() && (!vp || vp <= 0)) return setErro('Valor da parcela inválido.')
    const s = saldo.trim() ? parseNumero(saldo) : null
    if (saldo.trim() && (s === null || s < 0)) return setErro('Saldo inválido.')
    if (!d) {
      if (s === null || s <= 0) return setErro('Informe quanto falta pagar.')
      aoCriar({ descricao: descricao.trim(), valor_parcela: vp, saldo: s, data })
    } else {
      if (descricao.trim() !== d.descricao || vp !== d.valor_parcela) aoEditar(d.id, { descricao: descricao.trim(), valor_parcela: vp })
      if (s !== null) aoNovoSaldo(d.id, data, s)
    }
    aoFechar()
  }

  return (
    <Modal titulo={d ? 'Editar dívida' : 'Nova dívida'} aoFechar={aoFechar}>
      <form className="form" onSubmit={(e) => { e.preventDefault(); salvar() }}>
        <label className="campo">
          <span className="campo-rotulo">Nome</span>
          <input autoFocus={!d} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Notebook, cartão Nubank…" />
        </label>
        <label className="campo">
          <span className="campo-rotulo">Parcela mensal (opcional)</span>
          <input inputMode="decimal" value={parcela} onChange={(e) => setParcela(e.target.value)} placeholder="0,00" />
          <span className="campo-ajuda">Com a parcela, o app prevê quando a dívida acaba.</span>
        </label>
        <div className="form-linha">
          <label className="campo">
            <span className="campo-rotulo">{d ? 'Saldo devedor atualizado' : 'Quanto falta pagar'}</span>
            <input inputMode="decimal" value={saldo} onChange={(e) => setSaldo(e.target.value)}
              placeholder={d ? fmtBRL(situacao!.restante) : '0,00'} />
          </label>
          <label className="campo">
            <span className="campo-rotulo">Em qual data</span>
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </label>
        </div>
        {d && <span className="campo-ajuda">Só preencha o saldo se o banco mudou o valor (juros, acordo). Pagamentos já abatem sozinhos.</span>}
        {erro && <p className="form-erro">{erro}</p>}
        <div className="form-acoes">
          {d && (
            <button
              type="button"
              className="btn perigo"
              onClick={() => { if (confirm(`Excluir "${d.descricao}" e todo o histórico dela?`)) { aoExcluir(d.id); aoFechar() } }}
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
