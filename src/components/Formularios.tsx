import { useMemo, useRef, useState } from 'react'
import { dicaDaDescricao } from '../lib/adaptacao'
import { categoriaPelaDescricao, doTipo } from '../lib/categorias'
import { gerarParcelas, hojeLocal, nomeDaFatura, textoParcelamento } from '../lib/cartoes'
import { formaDe, formaPelaDescricao, formasDoTipo, type FormaPagamento } from '../lib/formas'
import { COR } from '../lib/charts'
import { calendarioDe, dividaPelaDescricao, inicioPelaProxima, meDevem, mesesAntes, nativoDiv, parcelasDe, somaMesesData, type SituacaoDivida } from '../lib/dividas'
import { dataPadrao, fmtMesAno, fmtMoeda, fmtValor, parseNumero, simbolo } from '../lib/format'
import { casasDaMoeda, mascarar, paraCampoMoeda } from '../lib/dinheiro'
import { infoMoeda, moedasUsaveis, type Taxas } from '../lib/moedas'
import { visao } from '../lib/perfil'
import { bancoConhecido, bancoNaDescricao, CORES_LIVRES, mesmoNome } from '../lib/rotulos'
import { contaPeloNome, type MemoriaConta } from '../lib/contasFixas'
import type { Banco, CartaoCredito, Categoria, ContaFixa, Divida, Lancamento, Perfil, Tipo } from '../lib/types'
import { EscolhaCategoria } from './Categorias'
import { Icone } from './Icone'
import type { NovaDivida } from '../lib/useDados'
import { CampoCotacao } from './CampoCotacao'
import { EscolhaMoeda } from './EscolhaMoeda'
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
  /** Compras já lançadas nos cartões: servem para avisar quando a mesma compra é lançada duas vezes. */
  comprasCartao?: Lancamento[]
  /** Avisa em que fatura a compra caiu (principalmente quando já passou do fechamento). */
  aoCompraSalva?: (aviso: { cartao: string; fechamento: number; depoisDoFechamento: boolean; ano: number; mes: number; anoCompra: number }) => void
  aoNovoCartao?: () => void
  /** Contas do mês (só com o módulo ligado): o lançamento pode ser a baixa de uma delas ("este Pix é a pensão"). */
  contasFixas?: ContaFixa[]
  /** Nomes que a pessoa já ligou a cada conta, para escolher a conta sozinho ao digitar a descrição. */
  memoriaContas?: Map<string, MemoriaConta>
  aoFechar: () => void
}

export function FormLancamento(p: FormLancProps) {
  const ini = { ...p.preset, ...p.inicial }
  const v = visao(p.perfil)
  const principal = p.perfil.moeda
  const original = ini.moeda_original && ini.valor_original ? { moeda: ini.moeda_original, valor: ini.valor_original } : null
  const [tipo, setTipo] = useState<Tipo>(ini.tipo ?? p.tipoInicial ?? 'saida')
  const [valor, setValor] = useState(original ? paraCampoMoeda(original.valor, original.moeda) : ini.valor ? paraCampoMoeda(ini.valor, principal) : '')
  const [moeda, setMoeda] = useState(original?.moeda ?? principal)
  // Cotação usada: a de quando foi lançado (ao editar) ou, vazia, a do dia.
  const [cotacao, setCotacao] = useState<number | null>(original && ini.valor ? ini.valor / original.valor : null)
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
  // Forma de pagamento: a do lançamento, "crédito" quando já vem de um cartão, ou vazia até a pessoa escolher (ou o app deduzir).
  const [forma, setForma] = useState<FormaPagamento | ''>(formaDe({ forma: ini.forma, cartao_id: ini.cartao_id ?? p.cartaoInicial }) ?? '')
  const [mexeuForma, setMexeuForma] = useState(Boolean(p.inicial || p.cartaoInicial))
  const [vezes, setVezes] = useState(1)
  const [contaId, setContaId] = useState(ini.conta_fixa_id ?? '')
  const [mexeuConta, setMexeuConta] = useState(Boolean(p.inicial || p.preset))
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
  const extra: Divida[] = ini.divida_id && !p.dividas.some((d) => d.id === ini.divida_id) ? [{ id: ini.divida_id, descricao: ini.tipo === 'entrada' ? 'Já recebida' : 'Dívida quitada', valor_parcela: null }] : []
  const opcoesDivida = [...p.dividas, ...extra]
  // saída paga o que você deve; entrada recebe de quem te deve
  const devo = opcoesDivida.filter((d) => !meDevem(d))
  const aReceber = opcoesDivida.filter((d) => meDevem(d) || (d.id === ini.divida_id && ini.tipo === 'entrada'))

  const moedasDisponiveis = moedasUsaveis(p.perfil, original?.moeda, ini.moeda_original)
  const estrangeira = moeda !== principal
  const taxa = cotacao ?? p.taxas[moeda] ?? null
  const numero = parseNumero(valor)
  const dica = dicaDaDescricao(descricao, p.perfil, tipo)
  const cartao = !p.inicial && tipo === 'saida' && forma === 'credito' && p.aoSalvarCompra ? p.cartoes?.find((c) => c.id === cartaoId && c.ativo) : undefined
  const cartoesAtivos = p.cartoes?.filter((c) => c.ativo) ?? []
  const parcelas = useMemo(() => {
    const total = numero && numero > 0 ? (estrangeira ? (taxa ? Math.round(numero * taxa * 100) / 100 : 0) : numero) : 0
    return cartao && total > 0 && data ? gerarParcelas(total, vezes, data, cartao) : []
  }, [cartao, numero, estrangeira, taxa, vezes, data])
  const depoisDoFechamento = Boolean(cartao && parcelas.length && Number(data.slice(8, 10)) > cartao.dia_fechamento)
  const duplicada = useMemo(() => {
    if (!cartao || !parcelas.length) return false
    const nome = descricao.trim().toLowerCase()
    return (p.comprasCartao ?? []).some((l) => l.cartao_id === cartao.id && (l.parcela ?? 1) === 1 && l.data_compra === data
      && Math.abs(l.valor - parcelas[0].valor) < 0.005 && (l.descricao ?? '').trim().toLowerCase() === nome)
  }, [cartao, parcelas, data, descricao, p.comprasCartao])
  const [duplicadaOk, setDuplicadaOk] = useState(false)
  const ehDivida = p.categorias.find((c) => c.id === categoriaId)?.papel === 'divida'
  // Contas do mês do mesmo tipo. Cada conta tem uma baixa por mês: a que já tem outro lançamento no mês fica indisponível.
  const [anoData, mesData] = data ? data.split('-').map(Number) : [p.ano, p.mes]
  const contasDoTipo = (p.contasFixas ?? []).filter((c) => c.tipo === tipo && (c.ativa || c.id === ini.conta_fixa_id))
  const ocupada = (id: string) => p.historico.some((x) => x.conta_fixa_id === id && x.ano === anoData && x.mes === mesData && x.id !== p.inicial?.id)
  const contaEscolhida = contasDoTipo.find((c) => c.id === contaId)
  const escolherConta = (id: string) => {
    setContaId(id)
    setMexeuConta(true)
    const k = contasDoTipo.find((c) => c.id === id)
    if (k?.categoria_id && !mexeuCategoria) setCategoriaId(k.categoria_id)
    if (k && !descricao.trim()) setDescricao(k.descricao)
  }
  const mudarTipo = (t: Tipo) => {
    setTipo(t)
    if (forma && !formasDoTipo(t).some((f) => f.id === forma)) setForma('')
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
      // dívida em outra moeda: o pagamento já abre nessa moeda, com a parcela dela
      if (d.moeda && moedasDisponiveis.includes(d.moeda)) { setMoeda(d.moeda); setCotacao(null) }
      if (!valor && d.valor_parcela) setValor(paraCampoMoeda(d.valor_parcela, d.moeda ?? principal))
      if (!descricao) setDescricao(`${d.descricao} – parcela`)
    }
  }

  const escolherForma = (f: FormaPagamento) => {
    setMexeuForma(true)
    const nova = forma === f ? '' : f
    setForma(nova)
    // crédito com um cartão só: já deixa escolhido
    if (nova === 'credito' && !cartaoId && cartoesAtivos.length === 1) setCartaoId(cartoesAtivos[0].id)
  }
  const ligarCartoes = () => p.aoMudarPerfil({ ...p.perfil, modulos: { ...p.perfil.modulos, cartoes: true } })

  const aoDigitarDescricao = (texto: string) => {
    setDescricao(texto)
    const anterior = memoria.get(chave(texto))
    // Forma de pagamento: a que você usou da última vez para essa descrição ou, sem histórico, a que o texto diz ("Pix João").
    if (!mexeuForma) {
      const daMemoria = anterior && anterior.tipo === tipo ? formaDe(anterior) : null
      const cartaoDaMemoria = daMemoria === 'credito' ? cartoesAtivos.find((c) => c.id === anterior?.cartao_id) : undefined
      if (daMemoria === 'credito' && !(cartaoDaMemoria && !p.inicial && p.aoSalvarCompra)) setForma('')
      else if (daMemoria === 'credito') { setForma('credito'); setCartaoId(cartaoDaMemoria!.id) }
      else setForma(daMemoria ?? formaPelaDescricao(texto, tipo) ?? '')
    }
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
    // "Pix de João Silva" já ligado antes à pensão: escolhe a conta sozinho (se ela ainda não tem lançamento neste mês).
    if (!mexeuConta && p.contasFixas && p.memoriaContas) {
      const k = contaPeloNome(texto, tipo, p.contasFixas, p.memoriaContas)
      setContaId(k && !ocupada(k.id) ? k.id : '')
    }
    // "Notebook – parcela" já se liga à dívida do notebook.
    if (!mexeuDivida && tipo === 'saida' && v.dividas) {
      const d = dividaPelaDescricao(texto, p.dividas.filter((x) => !meDevem(x)))
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
    if (forma === 'credito' && !p.inicial && !cartao) return setErro('Escolha o cartão de crédito da compra.')
    if (estrangeira && (!taxa || taxa <= 0)) return setErro(`Digite quanto vale 1 ${infoMoeda(moeda).nome.toLowerCase()} em ${simbolo(principal)}.`)
    if (contaEscolhida && !cartao && ocupada(contaEscolhida.id)) {
      return setErro(`${contaEscolhida.descricao} já tem um lançamento neste mês. Escolha “Não” ou mude a data.`)
    }
    const [a, m] = data.split('-').map(Number)
    const saida = tipo === 'saida'
    // aberto pela própria dívida (ou já ligado), o pagamento fica ligado mesmo sem a categoria de dívidas
    const ligada = saida
      ? ((ehDivida || dividaId === ini.divida_id) && devo.some((d) => d.id === dividaId) ? dividaId : null)
      : (aReceber.some((d) => d.id === dividaId) ? dividaId : null)
    // Em outra moeda, o valor vai convertido e o original fica guardado. Os campos só vão quando usados,
    // para funcionar também em bancos ainda sem a migração 4.
    const moedaOriginal = estrangeira
      ? { valor_original: n, moeda_original: moeda }
      : original ? { valor_original: null, moeda_original: null } : {}
    if (cartao && p.aoSalvarCompra) {
      if (duplicada && !duplicadaOk) {
        setDuplicadaOk(true)
        return setErro('Você já lançou uma compra igual a essa neste cartão. Se for outra compra mesmo, toque em salvar de novo.')
      }
      // Uma saída por parcela, na fatura em que cai; a data de cada uma é o vencimento da fatura.
      const compraId = crypto.randomUUID()
      p.aoSalvarCompra(gerarParcelas(estrangeira ? Math.round(n * taxa! * 100) / 100 : n, vezes, data, cartao).map((x) => ({
        ano: x.ano, mes: x.mes, tipo: 'saida', valor: x.valor, descricao: descricao.trim(), data: x.data,
        banco_id: null, categoria_id: categoriaId || null, divida_id: null,
        cartao_id: cartao.id, compra_id: compraId, parcela: x.parcela, parcelas: x.parcelas, data_compra: data,
      })))
      setVezes(1)
      setDuplicadaOk(false)
      p.aoCompraSalva?.({
        cartao: cartao.nome, fechamento: cartao.dia_fechamento, depoisDoFechamento,
        ano: parcelas[0].ano, mes: parcelas[0].mes, anoCompra: Number(data.slice(0, 4)),
      })
    } else {
      p.aoSalvar(
        {
          ano: a, mes: m, tipo, valor: estrangeira ? Math.round(n * taxa! * 100) / 100 : n, descricao: descricao.trim(), data,
          banco_id: bancoId || null,
          categoria_id: categoriaId || null,
          divida_id: ligada,
          forma: forma && forma !== 'credito' ? forma : null,
          // sem o módulo de contas o campo não aparece: o vínculo que já existia fica como está
          ...(p.contasFixas ? { conta_fixa_id: contaEscolhida?.id ?? null } : {}),
          ...moedaOriginal,
        },
        p.inicial?.id,
      )
    }
    if (!continuar) return p.aoFechar()
    setValor('')
    setDescricao('')
    setDividaId('')
    setContaId('')
    setMexeuConta(false)
    setCategoriaId(outrosDe(tipo))
    setMexeuCategoria(false)
    setMexeuBanco(false)
    setMexeuForma(false)
    setMexeuDivida(false)
    setErro(null)
    setSalvos((s) => s + 1)
    campoValor.current?.focus()
  }

  const cor = tipo === 'entrada' ? COR.entradas : COR.saidas

  return (
    <Modal titulo={p.inicial ? 'Editar lançamento' : p.preset?.divida_id ? (p.preset.tipo === 'entrada' ? 'Receber' : 'Pagar dívida') : 'Novo lançamento'} aoFechar={p.aoFechar}>
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
          <EscolhaMoeda moedas={moedasDisponiveis} valor={moeda}
            aoMudar={(m) => { setMoeda(m); setCotacao(null); setValor((t) => { const n = parseNumero(t); return n ? paraCampoMoeda(n, m) : t }) }} />
        )}
        <label className="valor-grande" style={{ '--c': cor } as React.CSSProperties}>
          <span>{simbolo(moeda)}</span>
          <input
            ref={campoValor}
            autoFocus
            inputMode="decimal"
            placeholder="0,00"
            value={valor}
            onChange={(e) => { setValor(mascarar(e.target.value, casasDaMoeda(moeda))); setErro(null) }}
            aria-label="Valor"
          />
        </label>
        {estrangeira && (
          <div className="cotacao">
            <CampoCotacao key={moeda} moeda={moeda} principal={principal} taxaDia={p.taxas[moeda]} valor={cotacao} aoMudar={setCotacao} />
            <span className="campo-ajuda">
              {numero && taxa ? <>≈ <b>{fmtValor(numero * taxa)}</b> na sua moeda. </> : null}
              {cotacao ? 'Cotação que você informou.' : p.taxas[moeda] ? 'Cotação de hoje; troque se pagou outra.' : 'Sem cotação automática agora: informe a que você pagou.'}
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
        {!ehParcela && (
          <div className="campo">
            <span className="campo-rotulo">{tipo === 'saida' ? 'Como pagou?' : 'Como recebeu?'} <small>(opcional)</small></span>
            <div className="chips forma-chips" role="group" aria-label="Forma de pagamento">
              {formasDoTipo(tipo).filter((f) => !(f.id === 'credito' && p.inicial)).map((f) => (
                <button key={f.id} type="button" className={`chip forma-chip ${forma === f.id ? 'ativo' : ''}`} aria-pressed={forma === f.id}
                  style={{ '--c': f.cor } as React.CSSProperties} onClick={() => escolherForma(f.id)}>
                  <Icone nome={f.icone} tamanho={14} />{f.nome}
                </button>
              ))}
            </div>
            {forma === 'credito' && !p.inicial && (p.cartoes ? (
              <>
                <div className="chips forma-cartoes">
                  {cartoesAtivos.map((c) => (
                    <button key={c.id} type="button" className={`chip ${cartao?.id === c.id ? 'ativo' : ''}`} onClick={() => setCartaoId(c.id)}
                      style={{ '--c': c.cor } as React.CSSProperties}>
                      <i className="marcador" />{c.nome}
                    </button>
                  ))}
                  {p.aoNovoCartao && <button type="button" className="chip novo" onClick={p.aoNovoCartao}>+ cartão</button>}
                </div>
                {!cartoesAtivos.length && <span className="campo-ajuda">Você ainda não cadastrou nenhum cartão. Cadastre um para a compra entrar na fatura.</span>}
              </>
            ) : p.perfil.modulos.cartoes ? (
              <span className="campo-ajuda">Cartão de crédito indisponível: falta rodar a migração 8 no Supabase.</span>
            ) : (
              <span className="campo-ajuda">
                Para a compra entrar na fatura, ligue o cartão de crédito. <button type="button" className="link" onClick={ligarCartoes}>Ligar agora</button>
              </span>
            ))}
            {cartao && <span className="campo-ajuda">A compra entra na fatura do {cartao.nome} e desconta do limite dele na aba Cartões.</span>}
          </div>
        )}
        {cartao && (
          <label className="campo">
            <span className="campo-rotulo">Em quantas vezes?</span>
            <select value={vezes} onChange={(e) => setVezes(Number(e.target.value))}>
              {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n === 1 ? '1x (à vista)' : `${n}x`}</option>)}
            </select>
            {depoisDoFechamento && (
              <span className="campo-ajuda aviso-fatura" role="note">
                A fatura do {cartao!.nome} fecha dia {cartao!.dia_fechamento}, então essa compra entra na fatura de {nomeDaFatura(parcelas[0].ano, parcelas[0].mes, Number(data.slice(0, 4)))}.
              </span>
            )}
            <span className="campo-ajuda">
              {parcelas.length ? textoParcelamento(parcelas, Number(data.slice(0, 4))) : 'Informe o valor para ver como as parcelas ficam.'}
            </span>
          </label>
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
        {!cartao && contasDoTipo.length > 0 && (
          <label className="campo">
            <span className="campo-rotulo">{tipo === 'entrada' ? 'É de uma entrada fixa?' : 'É de uma conta do mês?'} <small>(opcional)</small></span>
            <select value={contaEscolhida?.id ?? ''} onChange={(e) => escolherConta(e.target.value)}>
              <option value="">Não</option>
              {contasDoTipo.map((k) => (
                <option key={k.id} value={k.id} disabled={ocupada(k.id) && k.id !== contaId}>
                  {k.descricao}{ocupada(k.id) ? ' · já tem lançamento neste mês' : ''}
                </option>
              ))}
            </select>
            {contaEscolhida && (
              <span className="campo-ajuda">
                {contaEscolhida.descricao} fica como {tipo === 'entrada' ? 'recebida' : 'paga'} neste mês, sem precisar tocar em “{tipo === 'entrada' ? 'Recebi' : 'Paguei'}”.
                {!ini.conta_fixa_id && ' Depois o app procura os parecidos dos outros meses.'}
              </span>
            )}
          </label>
        )}
        {tipo === 'saida' && (
          <>
            {(ehDivida || (dividaId && dividaId === ini.divida_id)) && (v.dividas || dividaId) && devo.length > 0 && (
              <label className="campo">
                <span className="campo-rotulo">Qual dívida você está pagando?</span>
                <select value={dividaId} onChange={(e) => escolherDivida(e.target.value)}>
                  <option value="">Nenhuma (só entra como gasto)</option>
                  {devo.map((d) => (
                    <option key={d.id} value={d.id}>{d.descricao}{d.valor_parcela ? ` · parcela ${fmtMoeda(d.valor_parcela, d.moeda ?? principal)}` : ''}</option>
                  ))}
                </select>
                {dividaId && <span className="campo-ajuda">A dívida diminui sozinha com este pagamento.</span>}
              </label>
            )}
          </>
        )}
        {tipo === 'entrada' && (v.dividas || dividaId) && aReceber.length > 0 && (
          <label className="campo">
            <span className="campo-rotulo">É de alguém que te devia? <small>(opcional)</small></span>
            <select value={aReceber.some((d) => d.id === dividaId) ? dividaId : ''} onChange={(e) => { setDividaId(e.target.value); setMexeuDivida(true) }}>
              <option value="">Não</option>
              {aReceber.map((d) => (
                <option key={d.id} value={d.id}>{d.descricao}{d.pessoa ? ` · ${d.pessoa}` : ''}{d.valor_parcela ? ` · parcela ${fmtMoeda(d.valor_parcela, d.moeda ?? principal)}` : ''}</option>
              ))}
            </select>
            {dividaId && aReceber.some((d) => d.id === dividaId) && <span className="campo-ajuda">O que falta receber diminui sozinho com esta entrada.</span>}
          </label>
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
  /** Dívida nova: de que lado começa ("devo" ou "me devem"). */
  sentidoInicial?: 'devo' | 'me_devem'
  /** Migração 10 pendente: sem "me devem", pessoa e vencimento. */
  semExtras?: boolean
  /** Para oferecer as moedas que a pessoa usa. */
  perfil: Perfil
  /** Migração 14 pendente: dívida só na moeda principal. */
  semMoeda?: boolean
  aoCriar: (d: NovaDivida & { saldo: number; data: string; marcoInicial?: { data: string; saldo: number } }) => unknown
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
 * Dívida do jeito que a pessoa pensa, dos dois lados ("eu devo" e "me devem"): com quem, é parcelado?, quanto e quando
 * vence a próxima. Parcelada, pede o valor da parcela e quantas faltam (e, se souber, de quantas); sem parcela fixa,
 * pede quanto falta e, se houver, a data combinada. O vencimento da próxima monta o calendário de parcelas.
 */
export function FormDivida({ ano, mes, situacao, sentidoInicial, semExtras, perfil, semMoeda, aoCriar, aoEditar, aoNovoSaldo, aoExcluir, aoFechar, definirParcela }: FormDividaProps) {
  // a dívida como foi cadastrada (parcela na moeda dela); `situacao.divida` já vem convertida para a moeda principal
  const d = situacao?.original
  const moedaInicial = d?.moeda || perfil.moeda
  const [moeda, setMoeda] = useState(moedaInicial)
  const moedas = moedasUsaveis(perfil, d?.moeda)
  const atuais = situacao ? parcelasDe(situacao) : null
  const [hoje] = useState(() => hojeLocal())
  const cal = situacao ? calendarioDe(situacao, hoje) : null
  const [sentido, setSentido] = useState<'devo' | 'me_devem'>(d?.sentido ?? sentidoInicial ?? 'devo')
  const [descricao, setDescricao] = useState(d?.descricao ?? '')
  const [pessoa, setPessoa] = useState(d?.pessoa ?? '')
  const [parcelado, setParcelado] = useState<'sim' | 'nao'>(d && !d.valor_parcela && !definirParcela ? 'nao' : 'sim')
  const [parcela, setParcela] = useState(d?.valor_parcela ? paraCampoMoeda(d.valor_parcela, moedaInicial) : '')
  const [faltam, setFaltam] = useState('')
  const [total, setTotal] = useState('')
  const [saldo, setSaldo] = useState('')
  // vencimento da próxima parcela em aberto (ou a data combinada, sem parcela fixa)
  const [proxima, setProxima] = useState(cal?.proxima?.vencimento ?? (d ? '' : somaMesesData(hoje, 1)))
  const [data, setData] = useState(dataPadrao(ano, mes))
  const [erro, setErro] = useState<string | null>(null)
  const [confirmar, setConfirmar] = useState(false)
  const recebe = sentido === 'me_devem'

  const vp = parseNumero(parcela)
  const nFaltam = inteiro(faltam)
  const nTotal = inteiro(total)
  // Prévia do que vai ficar: "falta R$ 3.600 (12 × R$ 300) · última em out de 2027"
  const n = nFaltam ?? atuais?.faltam
  const previa = parcelado === 'sim' && vp && vp > 0 && n
    ? (() => {
        const ultima = proxima ? somaMesesData(proxima, n - 1) : null
        const t = ano * 12 + (mes - 1) + n
        const [ua, um] = ultima ? ultima.split('-').map(Number) : [Math.floor(t / 12), (t % 12) + 1]
        return `${recebe ? 'Falta receber' : 'Falta pagar'} ${fmtMoeda(vp * n, moeda)} (${n} × ${fmtMoeda(vp, moeda)}) · última parcela em ${fmtMesAno(ua, um)}`
      })()
    : null

  const salvar = () => {
    if (!descricao.trim()) return setErro(recebe ? 'Dê um nome (ex.: computador que vendi).' : 'Dê um nome para a dívida.')
    const extras = { sentido, pessoa: pessoa.trim() || null }
    if (parcelado === 'sim') {
      if (!vp || vp <= 0) return setErro('Digite o valor da parcela.')
      if (faltam.trim() && !nFaltam) return setErro('Digite quantas parcelas faltam (um número inteiro).')
      if (!d && !nFaltam) return setErro('Digite quantas parcelas faltam.')
      if (total.trim() && (!nTotal || (nFaltam && nTotal < nFaltam))) return setErro('O total de parcelas não pode ser menor que as que faltam.')
      const nf = nFaltam ?? atuais?.faltam ?? 0
      const totalN = nTotal ?? (d ? d.total_parcelas ?? atuais?.total ?? nf : nf)
      // Com o total, registra o valor de quando a dívida começou: é isso que mostra "parcela 4 de 12".
      const marcoInicial = nTotal && nTotal > nf ? { data: mesesAntes(data, nTotal - nf), saldo: Math.round(vp * nTotal * 100) / 100 } : undefined
      const inicio = proxima ? inicioPelaProxima(proxima, totalN - nf) : d?.inicio ?? null
      const campos = { descricao: descricao.trim(), valor_parcela: vp, ...extras, moeda: moeda === perfil.moeda ? null : moeda, inicio, total_parcelas: totalN || null }
      if (!d) {
        aoCriar({ ...campos, saldo: Math.round(vp * nf * 100) / 100, data, marcoInicial })
      } else {
        aoEditar(d.id, campos)
        if (marcoInicial && marcoInicial.saldo > nativoDiv(situacao!, situacao!.saldoInicial)) aoNovoSaldo(d.id, marcoInicial.data, marcoInicial.saldo)
        if (nFaltam) aoNovoSaldo(d.id, data, Math.round(vp * nFaltam * 100) / 100)
      }
    } else {
      const v = saldo.trim() ? parseNumero(saldo) : null
      if (saldo.trim() && (v === null || v < 0)) return setErro('Digite um valor válido.')
      if (!d && (v === null || v <= 0)) return setErro(recebe ? 'Digite quanto falta receber.' : 'Digite quanto falta pagar.')
      const campos = { descricao: descricao.trim(), valor_parcela: null, ...extras, moeda: moeda === perfil.moeda ? null : moeda, inicio: proxima || null, total_parcelas: null }
      if (!d) aoCriar({ ...campos, saldo: v!, data })
      else {
        aoEditar(d.id, campos)
        if (v !== null) aoNovoSaldo(d.id, data, v)
      }
    }
    aoFechar()
  }

  return (
    <Modal titulo={d ? (recebe ? 'Editar a receber' : 'Editar dívida') : recebe ? 'Alguém te deve' : 'Adicionar dívida'} aoFechar={aoFechar}>
      <form className="form" onSubmit={(e) => { e.preventDefault(); salvar() }}>
        {!semExtras && (
          <Segmentado rotulo="Quem deve" valor={sentido} aoMudar={(v) => { setSentido(v); setErro(null) }}
            opcoes={[{ id: 'devo', nome: 'Eu devo', cor: COR.saidas }, { id: 'me_devem', nome: 'Me devem', cor: COR.entradas }]} />
        )}
        {moedas.length > 1 && !semMoeda && (
          <div className="campo">
            <span className="campo-rotulo">{d ? 'Moeda da dívida' : 'Em que moeda?'}</span>
            {/* depois de criada, a moeda não muda: os saldos já estão guardados nela */}
            <EscolhaMoeda moedas={d ? [moeda] : moedas} valor={moeda} aoMudar={(m) => { setMoeda(m); setParcela((t) => { const x = parseNumero(t); return x ? paraCampoMoeda(x, m) : t }); setSaldo((t) => { const x = parseNumero(t); return x ? paraCampoMoeda(x, m) : t }) }} />
          </div>
        )}
        <div className="form-linha">
          <label className="campo">
            <span className="campo-rotulo">{recebe ? 'O quê' : 'Nome'}</span>
            <input autoFocus={!d} value={descricao} onChange={(e) => setDescricao(e.target.value)}
              placeholder={recebe ? 'Ex.: computador que vendi, empréstimo…' : 'Ex.: notebook, empréstimo, acordo…'} />
          </label>
          {!semExtras && (
            <label className="campo">
              <span className="campo-rotulo">{recebe ? 'Quem te deve' : 'Com quem'} <small>(opcional)</small></span>
              <input value={pessoa} onChange={(e) => setPessoa(e.target.value)} maxLength={40} placeholder={recebe ? 'Ex.: João' : 'Ex.: Nubank, loja, Maria'} />
            </label>
          )}
        </div>
        <div className="campo">
          <span className="campo-rotulo">É parcelado?</span>
          <Segmentado rotulo="É parcelado?" valor={parcelado} aoMudar={(v) => { setParcelado(v); setErro(null) }}
            opcoes={[{ id: 'sim', nome: 'Sim, em parcelas' }, { id: 'nao', nome: recebe ? 'Não, um valor só' : 'Não, tenho um valor a pagar' }]} />
        </div>
        {parcelado === 'sim' ? (
          <>
            <div className="form-linha">
              <label className="campo">
                <span className="campo-rotulo">Valor da parcela</span>
                <span className="campo-caixa"><span className="prefixo">{simbolo(moeda)}</span>
                  <input autoFocus={Boolean(d) && !d?.valor_parcela} inputMode="decimal" value={parcela} onChange={(e) => setParcela(mascarar(e.target.value, casasDaMoeda(moeda)))} placeholder="0,00" />
                </span>
              </label>
              <label className="campo">
                <span className="campo-rotulo">Quantas faltam</span>
                <input inputMode="numeric" value={faltam} onChange={(e) => setFaltam(e.target.value)}
                  placeholder={atuais ? String(atuais.faltam) : d && vp ? String(Math.ceil(nativoDiv(situacao!, situacao!.restante) / vp - 0.001)) : 'Ex.: 10'} />
              </label>
            </div>
            <div className="form-linha">
              <label className="campo">
                <span className="campo-rotulo">De quantas no total? <small>(opcional)</small></span>
                <input inputMode="numeric" value={total} onChange={(e) => setTotal(e.target.value)} placeholder={atuais ? String(atuais.total) : 'Ex.: 12'} />
              </label>
              {!semExtras && (
                <label className="campo">
                  <span className="campo-rotulo">A próxima vence em</span>
                  <input type="date" value={proxima} onChange={(e) => setProxima(e.target.value)} />
                </label>
              )}
            </div>
            <span className="campo-ajuda">
              {semExtras ? 'Se souber o total, o app mostra quanto já foi pago ("parcela 4 de 12").'
                : `Com o vencimento, o app mostra cada parcela ${recebe ? 'recebida' : 'paga'}, pela metade ou atrasada.`}
            </span>
            {previa && <p className="divida-previa">{previa}</p>}
          </>
        ) : (
          <div className="form-linha">
            <label className="campo">
              <span className="campo-rotulo">{recebe ? 'Quanto falta receber' : 'Quanto falta pagar'}{d && <small> (só se mudou)</small>}</span>
              <span className="campo-caixa"><span className="prefixo">{simbolo(moeda)}</span>
                <input inputMode="decimal" value={saldo} onChange={(e) => setSaldo(mascarar(e.target.value, casasDaMoeda(moeda)))} placeholder={d ? paraCampoMoeda(nativoDiv(situacao!, situacao!.restante), moeda) : '0,00'} />
              </span>
            </label>
            {!semExtras && (
              <label className="campo">
                <span className="campo-rotulo">Combinado para <small>(opcional)</small></span>
                <input type="date" value={proxima} onChange={(e) => setProxima(e.target.value)} />
              </label>
            )}
          </div>
        )}
        {d && (
          <label className="campo">
            <span className="campo-rotulo">Valor atualizado em</span>
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            <span className="campo-ajuda">{recebe ? 'Cada recebimento lançado' : 'Os pagamentos lançados'} já abatem sozinhos. Mude o que falta só se houve juros, acordo ou se estava errado.</span>
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
            <button type="button" className="btn" onClick={() => { aoNovoSaldo(d.id, data, 0); aoFechar() }}>{recebe ? 'Já recebi tudo' : 'Já quitei'}</button>
          )}
          <span className="espaco" />
          <button type="button" className="btn" onClick={aoFechar}>Cancelar</button>
          <button type="submit" className="btn primario">Salvar</button>
        </div>
        {confirmar && <span className="campo-ajuda">Ela e todo o histórico dela serão excluídos. Os lançamentos continuam, só deixam de abater dela.</span>}
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
