import { useMemo, useRef, useState } from 'react'
import { dicaDaDescricao } from '../lib/adaptacao'
import { categoriaPelaDescricao, doTipo } from '../lib/categorias'
import { gerarParcelas, textoParcelamento } from '../lib/cartoes'
import { COR } from '../lib/charts'
import { dividaPelaDescricao, mesesAntes, parcelasDe, type SituacaoDivida } from '../lib/dividas'
import { dataPadrao, fmtMesAno, fmtValor, paraCampo, parseNumero, simbolo } from '../lib/format'
import { infoMoeda, type Taxas } from '../lib/moedas'
import { visao } from '../lib/perfil'
import { bancoConhecido, bancoNaDescricao, CORES_LIVRES, mesmoNome } from '../lib/rotulos'
import type { Banco, CartaoCredito, Categoria, Divida, Lancamento, Perfil, Tipo } from '../lib/types'
import { EscolhaCategoria } from './Categorias'
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
  categorias: Categoria[]
  categoriaDe: (l: Lancamento) => Categoria | undefined
  aoNovaCategoria?: (c: Omit<Categoria, 'id' | 'ordem'>) => Promise<Categoria | undefined>
  bancos: Banco[]
  aoNovoBanco: (nome: string, cor: string) => Promise<Banco | undefined>
  aoSalvar: (l: NovoLanc, id?: string) => void
  aoExcluir?: (id: string) => void
  /** Cartões de crédito (só com o módulo ligado): a saída pode ser uma compra no cartão. */
  cartoes?: CartaoCredito[]
  cartaoInicial?: string
  /** Grava todas as parcelas de uma compra no cartão de uma vez. */
  aoSalvarCompra?: (parcelas: NovoLanc[]) => void
  aoExcluirCompra?: (compraId: string) => void
  aoNovoCartao?: () => void
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
  // Sem escolha, a categoria fica em "Outros" (se a pessoa tiver uma com esse nome).
  const outrosDe = (t: Tipo) => p.categorias.find((c) => c.tipo === t && /^outros$/i.test(c.nome))?.id ?? ''
  const catDivida = p.categorias.find((c) => c.tipo === 'saida' && c.papel === 'divida')
  const [categoriaId, setCategoriaId] = useState(
    p.inicial ? p.categoriaDe(p.inicial)?.id ?? '' : ini.categoria_id ?? outrosDe(ini.tipo ?? p.tipoInicial ?? 'saida'),
  )
  const [dividaId, setDividaId] = useState<string>(ini.divida_id ?? '')
  const [mexeuCategoria, setMexeuCategoria] = useState(Boolean(p.inicial || p.preset))
  const [mexeuDivida, setMexeuDivida] = useState(Boolean(p.inicial || p.preset))
  const [erro, setErro] = useState<string | null>(null)
  const [salvos, setSalvos] = useState(0)
  const campoValor = useRef<HTMLInputElement>(null)
  // Compra no cartão: só em saída nova. Ao editar uma parcela, o cartão e a compra já estão definidos.
  const [cartaoId, setCartaoId] = useState(p.cartaoInicial ?? '')
  const [vezes, setVezes] = useState(1)
  const ehParcela = Boolean(p.inicial?.compra_id)
  const cartaoDaParcela = p.cartoes?.find((c) => c.id === p.inicial?.cartao_id)

  // Última conta/categoria usada para cada descrição — "iFood" já vem como alimentação.
  const memoria = useMemo(() => {
    const m = new Map<string, Lancamento>()
    for (const l of p.historico) if (l.descricao) m.set(chave(l.descricao), l)
    return m
  }, [p.historico])
  // Categorias do tipo, as mais usadas primeiro.
  const opcoesCategoria = useMemo(() => {
    const uso = new Map<string, number>()
    for (const l of p.historico) {
      const id = l.tipo === tipo ? p.categoriaDe(l)?.id : undefined
      if (id) uso.set(id, (uso.get(id) ?? 0) + 1)
    }
    return doTipo(p.categorias, tipo).sort((a, b) => (uso.get(b.id) ?? 0) - (uso.get(a.id) ?? 0))
  }, [p.historico, p.categorias, tipo]) // eslint-disable-line react-hooks/exhaustive-deps
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
  const cartao = !p.inicial && tipo === 'saida' && p.aoSalvarCompra ? p.cartoes?.find((c) => c.id === cartaoId && c.ativo) : undefined
  const parcelas = useMemo(() => {
    const total = numero && numero > 0 ? (estrangeira ? (taxa ? Math.round(numero * taxa * 100) / 100 : 0) : numero) : 0
    return cartao && total > 0 && data ? gerarParcelas(total, vezes, data, cartao) : []
  }, [cartao, numero, estrangeira, taxa, vezes, data])
  const ehDivida = p.categorias.find((c) => c.id === categoriaId)?.papel === 'divida'
  const mudarTipo = (t: Tipo) => {
    setTipo(t)
    if (!p.categorias.some((c) => c.id === categoriaId && c.tipo === t)) {
      setCategoriaId(categoriaPelaDescricao(descricao, t, p.categorias)?.id ?? outrosDe(t))
      setMexeuCategoria(false)
    }
  }

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
      if (catDivida) setCategoriaId(catDivida.id)
      if (!valor && d.valor_parcela) setValor(paraCampo(d.valor_parcela))
      if (!descricao) setDescricao(`${d.descricao} – parcela`)
    }
  }

  const aoDigitarDescricao = (texto: string) => {
    setDescricao(texto)
    const anterior = memoria.get(chave(texto))
    // Categoria: a que você usou da última vez para essa descrição ou, sem histórico, a que a descrição sugere.
    if (!mexeuCategoria) {
      const daMemoria = anterior && anterior.tipo === tipo ? p.categoriaDe(anterior)?.id : undefined
      const sugerida = daMemoria ?? categoriaPelaDescricao(texto, tipo, p.categorias)?.id
      if (sugerida) setCategoriaId(sugerida)
    }
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
      if (d && !mexeuCategoria && catDivida) setCategoriaId(catDivida.id)
    }
  }

  const salvar = (continuar: boolean) => {
    const n = parseNumero(valor)
    if (!n || n <= 0) {
      setErro('Digite um valor maior que zero.')
      campoValor.current?.focus()
      return
    }
    if (!data) return setErro('Escolha a data.')
    if (estrangeira && (!taxa || taxa <= 0)) return setErro(`Digite quanto vale 1 ${infoMoeda(moeda).nome.toLowerCase()} em ${simbolo(principal)}.`)
    const [a, m] = data.split('-').map(Number)
    const saida = tipo === 'saida'
    const ligada = saida && ehDivida && dividaId ? dividaId : null
    // Em outra moeda, o valor vai convertido e o original fica guardado. Os campos só vão quando usados,
    // para funcionar também em bancos ainda sem a migração 4.
    const moedaOriginal = estrangeira
      ? { valor_original: n, moeda_original: moeda }
      : original ? { valor_original: null, moeda_original: null } : {}
    if (cartao && p.aoSalvarCompra) {
      // Uma saída por parcela, na fatura em que cai; a data de cada uma é o vencimento da fatura.
      const compraId = crypto.randomUUID()
      p.aoSalvarCompra(gerarParcelas(estrangeira ? Math.round(n * taxa! * 100) / 100 : n, vezes, data, cartao).map((x) => ({
        ano: x.ano, mes: x.mes, tipo: 'saida', valor: x.valor, descricao: descricao.trim(), data: x.data,
        banco_id: null, categoria_id: categoriaId || null, divida_id: null,
        cartao_id: cartao.id, compra_id: compraId, parcela: x.parcela, parcelas: x.parcelas, data_compra: data,
      })))
      setVezes(1)
    } else {
      p.aoSalvar(
        {
          ano: a, mes: m, tipo, valor: estrangeira ? Math.round(n * taxa! * 100) / 100 : n, descricao: descricao.trim(), data,
          banco_id: bancoId || null,
          categoria_id: categoriaId || null,
          divida_id: ligada,
          ...moedaOriginal,
        },
        p.inicial?.id,
      )
    }
    if (!continuar) return p.aoFechar()
    setValor('')
    setDescricao('')
    setDividaId('')
    setCategoriaId(outrosDe(tipo))
    setMexeuCategoria(false)
    setMexeuBanco(false)
    setMexeuDivida(false)
    setErro(null)
    setSalvos((s) => s + 1)
    campoValor.current?.focus()
  }

  const cor = tipo === 'entrada' ? COR.entradas : COR.saidas

  return (
    <Modal titulo={p.inicial ? 'Editar lançamento' : p.preset?.divida_id ? 'Pagar dívida' : 'Novo lançamento'} aoFechar={p.aoFechar}>
      <form className="form" onSubmit={(e) => { e.preventDefault(); salvar(false) }}>
        {ehParcela && (
          <div className="form-dica fixa" role="status">
            <Icone nome="cartao" tamanho={16} />
            <span>
              {(p.inicial!.parcelas ?? 1) > 1 ? `Parcela ${p.inicial!.parcela} de ${p.inicial!.parcelas} da compra` : 'Compra no cartão'}
              {cartaoDaParcela && <> no <b>{cartaoDaParcela.nome}</b></>}. As outras parcelas não mudam.
            </span>
          </div>
        )}
        {!ehParcela && (
          <Segmentado
            rotulo="Tipo"
            valor={tipo}
            aoMudar={mudarTipo}
            opcoes={[
              { id: 'saida', nome: 'Saída', cor: COR.saidas },
              { id: 'entrada', nome: 'Entrada', cor: COR.entradas },
            ]}
          />
        )}
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
          <span className="campo-rotulo">{cartao ? 'Data da compra' : ehParcela ? 'Vencimento da parcela' : 'Data'}</span>
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} required />
        </label>
        {!p.inicial && tipo === 'saida' && p.cartoes && p.aoSalvarCompra && (
          <>
            <div className="campo">
              <span className="campo-rotulo">Como pagou?</span>
              <div className="chips">
                <button type="button" className={`chip ${!cartao ? 'ativo' : ''}`} onClick={() => setCartaoId('')}>Débito/Pix/dinheiro</button>
                {p.cartoes.filter((c) => c.ativo).map((c) => (
                  <button key={c.id} type="button" className={`chip ${cartao?.id === c.id ? 'ativo' : ''}`} onClick={() => setCartaoId(c.id)}
                    style={{ '--c': c.cor } as React.CSSProperties}>
                    <i className="marcador" />{c.nome}
                  </button>
                ))}
                {p.aoNovoCartao && <button type="button" className="chip novo" onClick={p.aoNovoCartao}>+ cartão</button>}
              </div>
            </div>
            {cartao && (
              <label className="campo">
                <span className="campo-rotulo">Em quantas vezes?</span>
                <select value={vezes} onChange={(e) => setVezes(Number(e.target.value))}>
                  {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n === 1 ? '1x (à vista)' : `${n}x`}</option>)}
                </select>
                <span className="campo-ajuda">
                  {parcelas.length ? textoParcelamento(parcelas, Number(data.slice(0, 4))) : 'Informe o valor para ver como as parcelas ficam.'}
                </span>
              </label>
            )}
          </>
        )}
        {(v.bancos || bancoId) && !cartao && !ehParcela && (
          <EscolhaBanco
            bancos={p.bancos}
            valor={bancoId}
            aoMudar={(id) => { setBancoId(id); setMexeuBanco(true) }}
            aoNovoBanco={p.aoNovoBanco}
          />
        )}
        <EscolhaCategoria
          key={tipo}
          tipo={tipo}
          opcoes={opcoesCategoria}
          valor={categoriaId}
          aoMudar={(id) => { setCategoriaId(id); setMexeuCategoria(true) }}
          aoCriar={p.aoNovaCategoria}
        />
        {tipo === 'saida' && (
          <>
            {ehDivida && (v.dividas || dividaId) && opcoesDivida.length > 0 && (
              <label className="campo">
                <span className="campo-rotulo">Qual dívida você está pagando?</span>
                <select value={dividaId} onChange={(e) => escolherDivida(e.target.value)}>
                  <option value="">Nenhuma (só entra como gasto)</option>
                  {opcoesDivida.map((d) => (
                    <option key={d.id} value={d.id}>{d.descricao}{d.valor_parcela ? ` · parcela ${fmtValor(d.valor_parcela)}` : ''}</option>
                  ))}
                </select>
                {dividaId && <span className="campo-ajuda">A dívida diminui sozinha com este pagamento.</span>}
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
              onClick={() => { if (confirm(ehParcela ? 'Excluir só esta parcela? As outras continuam.' : 'Excluir este lançamento?')) { p.aoExcluir!(p.inicial!.id); p.aoFechar() } }}
            >
              {ehParcela && (p.inicial.parcelas ?? 1) > 1 ? 'Excluir só esta parcela' : 'Excluir'}
            </button>
          )}
          {ehParcela && (p.inicial!.parcelas ?? 1) > 1 && p.aoExcluirCompra && (
            <button
              type="button"
              className="btn perigo"
              onClick={() => { if (confirm(`Excluir a compra inteira "${p.inicial!.descricao}"? Todas as parcelas serão apagadas.`)) { p.aoExcluirCompra!(p.inicial!.compra_id!); p.aoFechar() } }}
            >
              Excluir a compra inteira
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
  aoCriar: (d: { descricao: string; valor_parcela: number | null; saldo: number; data: string; inicio?: { data: string; saldo: number } }) => void
  aoEditar: (id: string, patch: Partial<Divida>) => void
  aoNovoSaldo: (id: string, data: string, saldo: number) => void
  aoExcluir: (id: string) => void
  aoFechar: () => void
  /** Aberto por "Definir parcela": começa no modo parcelado, com o cursor no valor da parcela. */
  definirParcela?: boolean
}

/** Quantidade de parcelas digitada: inteiro de 1 a 600, ou null. */
const inteiro = (t: string) => {
  const n = Number(t.trim())
  return Number.isInteger(n) && n >= 1 && n <= 600 ? n : null
}

/**
 * Dívida do jeito que a pessoa pensa: "é parcelado?" Parcelada, pede o valor da parcela e quantas faltam
 * (e, se souber, de quantas); sem parcela fixa, pede quanto falta pagar.
 */
export function FormDivida({ ano, mes, situacao, aoCriar, aoEditar, aoNovoSaldo, aoExcluir, aoFechar, definirParcela }: FormDividaProps) {
  const d = situacao?.divida
  const atuais = situacao ? parcelasDe(situacao) : null
  const [descricao, setDescricao] = useState(d?.descricao ?? '')
  const [parcelado, setParcelado] = useState<'sim' | 'nao'>(d && !d.valor_parcela && !definirParcela ? 'nao' : 'sim')
  const [parcela, setParcela] = useState(d?.valor_parcela ? paraCampo(d.valor_parcela) : '')
  const [faltam, setFaltam] = useState('')
  const [total, setTotal] = useState('')
  const [saldo, setSaldo] = useState('')
  const [data, setData] = useState(dataPadrao(ano, mes))
  const [erro, setErro] = useState<string | null>(null)
  const [confirmar, setConfirmar] = useState(false)

  const vp = parseNumero(parcela)
  const nFaltam = inteiro(faltam)
  const nTotal = inteiro(total)
  // Prévia do que vai ficar: "falta R$ 3.600 (12 × R$ 300) · acaba em out de 2027"
  const previa = parcelado === 'sim' && vp && vp > 0 && (nFaltam ?? atuais?.faltam)
    ? (() => {
        const n = (nFaltam ?? atuais!.faltam)
        // mesma conta do cartão da dívida: as parcelas que faltam começam no mês seguinte
        const t = ano * 12 + (mes - 1) + n
        return `Falta pagar ${fmtValor(vp * n)} (${n} × ${fmtValor(vp)}) · última parcela em ${fmtMesAno(Math.floor(t / 12), (t % 12) + 1)}`
      })()
    : null

  const salvar = () => {
    if (!descricao.trim()) return setErro('Dê um nome para a dívida.')
    if (parcelado === 'sim') {
      if (!vp || vp <= 0) return setErro('Digite o valor da parcela.')
      if (faltam.trim() && !nFaltam) return setErro('Digite quantas parcelas faltam (um número inteiro).')
      if (!d && !nFaltam) return setErro('Digite quantas parcelas faltam.')
      if (total.trim() && (!nTotal || (nFaltam && nTotal < nFaltam))) return setErro('O total de parcelas não pode ser menor que as que faltam.')
      const n = nFaltam ?? atuais?.faltam ?? 0
      // Com o total, registra o valor de quando a dívida começou: é isso que mostra "parcela 4 de 12".
      const inicio = nTotal && nTotal > n ? { data: mesesAntes(data, nTotal - n), saldo: Math.round(vp * nTotal * 100) / 100 } : undefined
      if (!d) {
        aoCriar({ descricao: descricao.trim(), valor_parcela: vp, saldo: Math.round(vp * n * 100) / 100, data, inicio })
      } else {
        if (descricao.trim() !== d.descricao || vp !== d.valor_parcela) aoEditar(d.id, { descricao: descricao.trim(), valor_parcela: vp })
        if (inicio && inicio.saldo > situacao!.saldoInicial) aoNovoSaldo(d.id, inicio.data, inicio.saldo)
        if (nFaltam) aoNovoSaldo(d.id, data, Math.round(vp * nFaltam * 100) / 100)
      }
    } else {
      const s = saldo.trim() ? parseNumero(saldo) : null
      if (saldo.trim() && (s === null || s < 0)) return setErro('Digite um valor válido.')
      if (!d && (s === null || s <= 0)) return setErro('Digite quanto falta pagar.')
      if (!d) aoCriar({ descricao: descricao.trim(), valor_parcela: null, saldo: s!, data })
      else {
        if (descricao.trim() !== d.descricao || d.valor_parcela !== null) aoEditar(d.id, { descricao: descricao.trim(), valor_parcela: null })
        if (s !== null) aoNovoSaldo(d.id, data, s)
      }
    }
    aoFechar()
  }

  return (
    <Modal titulo={d ? 'Editar dívida' : 'Adicionar dívida'} aoFechar={aoFechar}>
      <form className="form" onSubmit={(e) => { e.preventDefault(); salvar() }}>
        <label className="campo">
          <span className="campo-rotulo">Nome</span>
          <input autoFocus={!d} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Notebook, empréstimo, cartão Nubank…" />
        </label>
        <div className="campo">
          <span className="campo-rotulo">É parcelado?</span>
          <Segmentado rotulo="É parcelado?" valor={parcelado} aoMudar={(v) => { setParcelado(v); setErro(null) }}
            opcoes={[{ id: 'sim', nome: 'Sim, pago em parcelas' }, { id: 'nao', nome: 'Não, tenho um valor a pagar' }]} />
        </div>
        {parcelado === 'sim' ? (
          <>
            <div className="form-linha">
              <label className="campo">
                <span className="campo-rotulo">Valor da parcela</span>
                <span className="campo-caixa"><span className="prefixo">{simbolo()}</span>
                  <input autoFocus={Boolean(d) && !d?.valor_parcela} inputMode="decimal" value={parcela} onChange={(e) => setParcela(e.target.value)} placeholder="0,00" />
                </span>
              </label>
              <label className="campo">
                <span className="campo-rotulo">Quantas faltam</span>
                <input inputMode="numeric" value={faltam} onChange={(e) => setFaltam(e.target.value)}
                  placeholder={atuais ? String(atuais.faltam) : d && vp ? String(Math.ceil(situacao!.restante / vp - 0.001)) : 'Ex.: 10'} />
              </label>
            </div>
            <label className="campo">
              <span className="campo-rotulo">De quantas no total? <small>(opcional)</small></span>
              <input inputMode="numeric" value={total} onChange={(e) => setTotal(e.target.value)} placeholder={atuais ? String(atuais.total) : 'Ex.: 12'} />
              <span className="campo-ajuda">Se souber, o app mostra quanto você já pagou ("parcela 4 de 12").</span>
            </label>
            {previa && <p className="divida-previa">{previa}</p>}
          </>
        ) : (
          <label className="campo">
            <span className="campo-rotulo">{d ? 'Quanto falta pagar agora' : 'Quanto falta pagar'} {d && <small>(só se mudou)</small>}</span>
            <span className="campo-caixa"><span className="prefixo">{simbolo()}</span>
              <input inputMode="decimal" value={saldo} onChange={(e) => setSaldo(e.target.value)} placeholder={d ? paraCampo(situacao!.restante) : '0,00'} />
            </span>
          </label>
        )}
        {d && (
          <label className="campo">
            <span className="campo-rotulo">Valor atualizado em</span>
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            <span className="campo-ajuda">Os pagamentos lançados já abatem sozinhos. Mude o que falta só se houve juros, acordo ou se estava errado.</span>
          </label>
        )}
        {erro && <p className="form-erro">{erro}</p>}
        <div className="form-acoes">
          {d && (
            confirmar
              ? <button type="button" className="btn perigo" onClick={() => { aoExcluir(d.id); aoFechar() }}>Excluir mesmo</button>
              : <button type="button" className="btn perigo" onClick={() => setConfirmar(true)}>Excluir</button>
          )}
          {d && situacao!.restante > 0 && (
            <button type="button" className="btn" onClick={() => { aoNovoSaldo(d.id, data, 0); aoFechar() }}>Já quitei</button>
          )}
          <span className="espaco" />
          <button type="button" className="btn" onClick={aoFechar}>Cancelar</button>
          <button type="submit" className="btn primario">Salvar</button>
        </div>
        {confirmar && <span className="campo-ajuda">A dívida e todo o histórico dela serão excluídos. Os pagamentos lançados continuam, só deixam de abater dela.</span>}
      </form>
    </Modal>
  )
}

/** Banco do lançamento: opcional, com atalho para cadastrar um novo. */
export function EscolhaBanco({ bancos, valor, aoMudar, aoNovoBanco }: {
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
        <button type="button" className="chip novo" onClick={novo}>+ Novo banco</button>
      </div>
    </div>
  )
}
