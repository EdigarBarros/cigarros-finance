import { useMemo, useRef, useState } from 'react'
import { dicaDaDescricao } from '../lib/adaptacao'
import { COR } from '../lib/charts'
import { dividaPelaDescricao, type SituacaoDivida } from '../lib/dividas'
import { dataPadrao, fmtValor, paraCampo, parseNumero, simbolo } from '../lib/format'
import { infoMoeda, type Taxas } from '../lib/moedas'
import { visao } from '../lib/perfil'
import { bancoConhecido, bancoNaDescricao, CATEGORIAS, CORES_LIVRES, mesmoNome } from '../lib/rotulos'
import type { Banco, Categoria, Divida, Lancamento, Perfil, Tipo } from '../lib/types'
import { Icone } from './Icone'
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
  /** Decide quais campos aparecem; a dica do formulário pode ligar um módulo na hora. */
  perfil: Perfil
  aoMudarPerfil: (p: Perfil) => void
  taxas: Taxas
  bancos: Banco[]
  aoNovoBanco: (nome: string, cor: string) => Promise<Banco | undefined>
  aoSalvar: (l: NovoLanc, id?: string) => void
  aoExcluir?: (id: string) => void
  aoFechar: () => void
}

export function FormLancamento(p: FormLancProps) {
  const ini = { ...p.preset, ...p.inicial }
  const v = visao(p.perfil)
  const principal = p.perfil.moeda
  const original = ini.moeda_original && ini.valor_original ? { moeda: ini.moeda_original, valor: ini.valor_original } : null
  const [tipo, setTipo] = useState<Tipo>(ini.tipo ?? p.tipoInicial ?? 'saida')
  const [valor, setValor] = useState(original ? paraCampo(original.valor) : ini.valor ? paraCampo(ini.valor) : '')
  const [moeda, setMoeda] = useState(original?.moeda ?? principal)
  // Cotação usada: a de quando foi lançado (ao editar) ou, vazia, a do dia.
  const [cotacao, setCotacao] = useState(original && ini.valor ? String(Math.round((ini.valor / original.valor) * 10000) / 10000).replace('.', ',') : '')
  const [descricao, setDescricao] = useState(ini.descricao ?? '')
  const [data, setData] = useState(ini.data ?? dataPadrao(p.ano, p.mes))
  const [bancoId, setBancoId] = useState<string>(ini.banco_id ?? '')
  const [mexeuBanco, setMexeuBanco] = useState(Boolean(p.inicial))
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
  const extra = ini.divida_id && !p.dividas.some((d) => d.id === ini.divida_id) ? [{ id: ini.divida_id, descricao: 'Dívida quitada', valor_parcela: null }] : []
  const opcoesDivida = [...p.dividas, ...extra]

  const moedasDisponiveis = [...new Set([principal, ...(v.moedas ? p.perfil.moedas : []), ...(original ? [original.moeda] : [])])]
  const estrangeira = moeda !== principal
  const taxa = (cotacao.trim() ? parseNumero(cotacao) : null) ?? p.taxas[moeda] ?? null
  const numero = parseNumero(valor)
  const dica = dicaDaDescricao(descricao, p.perfil, tipo)

  const aceitarDica = () => {
    if (!dica) return
    const pf = p.perfil
    if (dica.modulo === 'moedas' && dica.moeda) {
      p.aoMudarPerfil({ ...pf, moedas: [...new Set([...pf.moedas, dica.moeda])], modulos: { ...pf.modulos, moedas: true } })
      setMoeda(dica.moeda)
    } else {
      p.aoMudarPerfil({ ...pf, modulos: { ...pf.modulos, [dica.modulo]: true } })
    }
  }

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
    if (anterior && !mexeuCategoria && anterior.tipo === tipo) setCategoria(anterior.categoria)
    // Banco: o que estiver escrito na descrição, "(Next)", ou o que você usou da última vez.
    if (!mexeuBanco && v.bancos) {
      const escrito = bancoNaDescricao(texto, p.bancos)
      const doNome = escrito ? p.bancos.find((b) => mesmoNome(b.nome, escrito)) : undefined
      setBancoId(doNome?.id ?? anterior?.banco_id ?? '')
    }
    // "Notebook – parcela" já se liga à dívida do notebook.
    if (!mexeuDivida && tipo === 'saida' && v.dividas) {
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
    if (estrangeira && (!taxa || taxa <= 0)) return setErro(`Informe quanto vale 1 ${infoMoeda(moeda).nome.toLowerCase()} em ${simbolo(principal)}.`)
    const [a, m] = data.split('-').map(Number)
    const saida = tipo === 'saida'
    const ligada = saida && categoria === 'divida' && dividaId ? dividaId : null
    // Em outra moeda, o valor vai convertido e o original fica guardado. Os campos só vão quando usados,
    // para funcionar também em bancos ainda sem a migração 4.
    const moedaOriginal = estrangeira
      ? { valor_original: n, moeda_original: moeda }
      : original ? { valor_original: null, moeda_original: null } : {}
    p.aoSalvar(
      {
        ano: a, mes: m, tipo, valor: estrangeira ? Math.round(n * taxa! * 100) / 100 : n, descricao: descricao.trim(), data,
        banco_id: bancoId || null,
        categoria: saida ? categoria : 'outros',
        divida_id: ligada,
        ...moedaOriginal,
      },
      p.inicial?.id,
    )
    if (!continuar) return p.aoFechar()
    setValor('')
    setDescricao('')
    setDividaId('')
    setMexeuCategoria(false)
    setMexeuBanco(false)
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
        {moedasDisponiveis.length > 1 && (
          <div className="moeda-escolha">
            <Segmentado rotulo="Moeda" valor={moeda} aoMudar={(m) => { setMoeda(m); setCotacao('') }}
              opcoes={moedasDisponiveis.map((m) => ({ id: m, nome: `${infoMoeda(m).bandeira} ${m}` }))} />
          </div>
        )}
        <label className="valor-grande" style={{ '--c': cor } as React.CSSProperties}>
          <span>{simbolo(moeda)}</span>
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
        {estrangeira && (
          <div className="cotacao">
            <label className="campo-caixa">
              <span className="prefixo">1 {moeda} =</span>
              <input inputMode="decimal" value={cotacao} onChange={(e) => setCotacao(e.target.value)}
                placeholder={p.taxas[moeda] ? String(Math.round(p.taxas[moeda] * 10000) / 10000).replace('.', ',') : 'cotação'}
                aria-label={`Cotação de 1 ${moeda} em ${principal}`} />
              <span className="prefixo">{simbolo(principal)}</span>
            </label>
            <span className="campo-ajuda">
              {numero && taxa ? <>≈ <b>{fmtValor(numero * taxa)}</b> na sua moeda. </> : null}
              {cotacao.trim() ? 'Cotação que você informou.' : p.taxas[moeda] ? 'Cotação de hoje; troque se pagou outra.' : 'Sem cotação automática agora: informe a que você pagou.'}
            </span>
          </div>
        )}
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
        {dica && (
          <div className="form-dica" role="status">
            <Icone nome="ideia" tamanho={16} />
            <span>{dica.texto}</span>
            <button type="button" className="link" onClick={aceitarDica}>{dica.botao}</button>
          </div>
        )}
        <label className="campo">
          <span className="campo-rotulo">Data</span>
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} required />
        </label>
        {(v.bancos || bancoId) && (
          <EscolhaBanco
            bancos={p.bancos}
            valor={bancoId}
            aoMudar={(id) => { setBancoId(id); setMexeuBanco(true) }}
            aoNovoBanco={p.aoNovoBanco}
          />
        )}
        {tipo === 'saida' && (
          <>
            <div className="campo">
              <span className="campo-rotulo">Categoria</span>
              <Segmentado
                rotulo="Categoria"
                valor={categoria}
                aoMudar={(c) => { setCategoria(c); setMexeuCategoria(true) }}
                opcoes={CATEGORIAS}
              />
            </div>
            {categoria === 'divida' && (v.dividas || dividaId) && opcoesDivida.length > 0 && (
              <label className="campo">
                <span className="campo-rotulo">Abate qual dívida?</span>
                <select value={dividaId} onChange={(e) => escolherDivida(e.target.value)}>
                  <option value="">Nenhuma (só conta como gasto com dívida)</option>
                  {opcoesDivida.map((d) => (
                    <option key={d.id} value={d.id}>{d.descricao}{d.valor_parcela ? ` · parcela ${fmtValor(d.valor_parcela)}` : ''}</option>
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
              placeholder={d ? fmtValor(situacao!.restante) : '0,00'} />
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

/** Banco do lançamento: opcional, com atalho para cadastrar um novo. */
function EscolhaBanco({ bancos, valor, aoMudar, aoNovoBanco }: {
  bancos: Banco[]; valor: string; aoMudar: (id: string) => void
  aoNovoBanco: (nome: string, cor: string) => Promise<Banco | undefined>
}) {
  const novo = async () => {
    const nome = prompt('Nome do banco (ex.: Nubank, Itaú, Next, Dinheiro):')?.trim()
    if (!nome) return
    const existente = bancos.find((b) => mesmoNome(b.nome, nome))
    if (existente) return aoMudar(existente.id)
    const cor = bancoConhecido(nome)?.cor ?? CORES_LIVRES[bancos.length % CORES_LIVRES.length]
    const criado = await aoNovoBanco(bancoConhecido(nome)?.nome ?? nome, cor)
    if (criado) aoMudar(criado.id)
  }
  return (
    <div className="campo">
      <span className="campo-rotulo">Banco <small>(opcional)</small></span>
      <div className="chips">
        <button type="button" className={`chip ${valor === '' ? 'ativo' : ''}`} onClick={() => aoMudar('')}>Nenhum</button>
        {bancos.map((b) => (
          <button key={b.id} type="button" className={`chip ${valor === b.id ? 'ativo' : ''}`} onClick={() => aoMudar(b.id)}
            style={{ '--c': b.cor } as React.CSSProperties}>
            <i className="marcador" />{b.nome}
          </button>
        ))}
        <button type="button" className="chip novo" onClick={novo}>+ banco</button>
      </div>
    </div>
  )
}
