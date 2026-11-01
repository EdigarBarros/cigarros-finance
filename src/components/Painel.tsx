import { lazy, Suspense, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { sugestoes, type Sugestao } from '../lib/adaptacao'
import { mesEfetivo, resumoMes } from '../lib/calc'
import { categoriaDe as categoriaDoLanc } from '../lib/categorias'
import {
  chaveRecusa, faltaPagarNoMes, lancamentoDaBaixa, memoriaDasContas, parecidosNosOutrosMeses, situacoesDoMes, sugestoesDoMes,
  type SituacaoConta, type SugestaoVinculo,
} from '../lib/contasFixas'
import { contaNasSaidas, garantidoDo, nomeDaFatura, renegociada, situacoesDoMes as situacoesDosCartoes, totalFaturasDoMes } from '../lib/cartoes'
import { COR } from '../lib/charts'
import { avisosDispensadosNoMes, conselhos as conselhosDe, dispensarPorUmMes, faltamDadosParaConselhos } from '../lib/conselheiro'
import { calendarioDe, fimDoMes, inicioDaDivida, meDevem, saldoMaisRecenteDaDivida, nativoDiv, situacaoDividas, type SituacaoDivida } from '../lib/dividas'
import { definirMoedaPrincipal, definirValoresOcultos, fmtDataCurta, fmtValor, MESES_CURTO, MESES_NOME, useValoresOcultos } from '../lib/format'
import { useCambio } from '../lib/moedas'
import { inferirPerfil, PERFIL_PADRAO, visao } from '../lib/perfil'
import { supabase } from '../lib/supabase'
import type { Lancamento, Modulo, Perfil, Tipo } from '../lib/types'
import { useMobile } from '../lib/useMobile'
import { useBarraLateral } from '../lib/useBarraLateral'
import { estiloLente, useLente } from '../lib/useLente'
import { definirTema, semMovimento, useTema } from '../lib/tema'
import { ehErroDeVersao, lembrarMes, mesAntesDeAtualizar } from '../lib/atualizacao'
import { irParaStripe, type Assinatura } from '../lib/assinatura'
import { AvisoTeste } from './AvisoTeste'
import { useCartoes } from '../lib/useCartoes'
import { useContasFixas } from '../lib/useContasFixas'
import { useDados } from '../lib/useDados'
import type { Ctx, Pagina } from '../pages/contexto'
import { BlocoCartoes } from './BlocoCartoes'
import { BlocoContasDoMes } from './BlocoContas'
import { Kpi } from './ui'
import { avisar, confirmar } from '../lib/avisos'
import { BotaoIdioma } from './BotaoIdioma'
import { Icone } from './Icone'
import { CartaoDicas, type Dica } from './CartaoDicas'
import { Marca } from './Marca'
import { tx } from '../lib/textos'
import { useHoje } from '../lib/useHoje'

// Cada tela e cada janela vira um pedaço à parte: o painel abre só com o que a pessoa vê e o resto chega sob demanda
// (e é baixado em segundo plano logo depois, veja `carregarRestante`).
const paginas = {
  Inicio: () => import('../pages/Inicio'),
  Lancamentos: () => import('../pages/Lancamentos'),
  Contas: () => import('../pages/Contas'),
  Cartoes: () => import('../pages/Cartoes'),
  Dividas: () => import('../pages/Dividas'),
  Metas: () => import('../pages/Metas'),
  Patrimonio: () => import('../pages/Patrimonio'),
  Ano: () => import('../pages/Ano'),
}
const Inicio = lazy(() => paginas.Inicio().then((m) => ({ default: m.Inicio })))
const Lancamentos = lazy(() => paginas.Lancamentos().then((m) => ({ default: m.Lancamentos })))
const Contas = lazy(() => paginas.Contas().then((m) => ({ default: m.Contas })))
const Cartoes = lazy(() => paginas.Cartoes().then((m) => ({ default: m.Cartoes })))
const Dividas = lazy(() => paginas.Dividas().then((m) => ({ default: m.Dividas })))
const Metas = lazy(() => paginas.Metas().then((m) => ({ default: m.Metas })))
const Patrimonio = lazy(() => paginas.Patrimonio().then((m) => ({ default: m.Patrimonio })))
const Ano = lazy(() => paginas.Ano().then((m) => ({ default: m.Ano })))
const janelas = {
  Formularios: () => import('./Formularios'),
  Configuracoes: () => import('./Configuracoes'),
  Extrato: () => import('./Extrato'),
  Categorias: () => import('./Categorias'),
  VinculoConta: () => import('./VinculoConta'),
}
const FormLancamento = lazy(() => janelas.Formularios().then((m) => ({ default: m.FormLancamento })))
const Configuracoes = lazy(() => janelas.Configuracoes().then((m) => ({ default: m.Configuracoes })))
const ExcluirContaModal = lazy(() => janelas.Configuracoes().then((m) => ({ default: m.ExcluirContaModal })))
const ZerarDados = lazy(() => janelas.Configuracoes().then((m) => ({ default: m.ZerarDados })))
const ImportarExtrato = lazy(() => janelas.Extrato().then((m) => ({ default: m.ImportarExtrato })))
const OrganizarNomes = lazy(() => janelas.Extrato().then((m) => ({ default: m.OrganizarNomes })))
const GerenciarCategorias = lazy(() => janelas.Categorias().then((m) => ({ default: m.GerenciarCategorias })))
const ParecidosConta = lazy(() => janelas.VinculoConta().then((m) => ({ default: m.ParecidosConta })))
const Questionario = lazy(() => import('./Questionario').then((m) => ({ default: m.Questionario })))
const Tour = lazy(() => import('./Tour').then((m) => ({ default: m.Tour })))

/** Com o painel já na tela e o aparelho parado, baixa as outras telas e janelas para a troca de tela ser instantânea. */
function carregarRestante() {
  // Configurações e o lançamento primeiro: são o que a pessoa mais abre e não pode clicar e ver nada acontecer
  const fila = [janelas.Configuracoes, janelas.Formularios, ...Object.values(paginas), ...Object.values(janelas)]
  const proximo = () => {
    const f = fila.shift()
    if (!f) return
    void f().catch(() => {}) // sem rede agora: baixa quando a pessoa abrir
    agendar(proximo)
  }
  agendar(proximo)
}
const agendar = (f: () => void) => {
  const ric = (window as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback
  if (ric) ric(f, { timeout: 1200 })
  else setTimeout(f, 300)
}

/**
 * A ordem daqui é a do menu e também a prioridade nas abas do celular (veja docs/arquitetura-do-painel.md):
 * o que se usa todo dia, depois o que tem prazo (do mais próximo ao mais distante), depois o que se constrói,
 * e por fim a retrospectiva.
 * As páginas `contas` ("Contas do mês") e `cartoes` ("Cartões") entram entre `lancamentos` e `dividas`.
 */
const PAGINAS: { id: Pagina; nome: string; curto: string; icone: string }[] = [
  { id: 'inicio', nome: tx('Início'), curto: tx('Início'), icone: 'inicio' },
  { id: 'lancamentos', nome: tx('Lançamentos'), curto: tx('Lançamentos'), icone: 'lista' },
  { id: 'contas', nome: tx('Contas do mês'), curto: tx('Contas'), icone: 'calendario' },
  { id: 'cartoes', nome: tx('Cartões'), curto: tx('Cartões'), icone: 'cartao' },
  { id: 'dividas', nome: tx('Dívidas'), curto: tx('Dívidas'), icone: 'divida' },
  { id: 'metas', nome: tx('Metas'), curto: tx('Metas'), icone: 'meta' },
  { id: 'patrimonio', nome: tx('Dinheiro guardado'), curto: tx('Guardado'), icone: 'carteira' },
  { id: 'ano', nome: tx('Resumo do ano'), curto: tx('Ano'), icone: 'ano' },
]

/** Na barra do celular cabem 5 abas; passando disso, as 4 primeiras ficam e o resto vai para "Mais". */
const MAX_ABAS = 5

const paginaDoHash = (): Pagina => {
  const h = location.hash.replace('#/', '') as Pagina
  return PAGINAS.some((p) => p.id === h) ? h : 'inicio'
}

export function Painel({ userId, email, nome: nomeConta, assinatura }: { userId: string; email: string; nome?: string; assinatura?: Assinatura | null }) {
  // muda sozinho na virada do dia (a aba pode ficar aberta de um dia para o outro)
  const hoje = useHoje()
  const [pagina, setPagina] = useState<Pagina>(paginaDoHash)
  // depois de uma atualização automática, volta no mês que a pessoa estava olhando (senão, o mês de hoje)
  const [ano, setAno] = useState(() => mesAntesDeAtualizar()?.ano ?? hoje.getFullYear())
  const [mes, setMes] = useState(() => mesAntesDeAtualizar()?.mes ?? hoje.getMonth() + 1)
  useEffect(() => lembrarMes(ano, mes), [ano, mes])
  useEffect(carregarRestante, [])
  const [avisoFatura, setAvisoFatura] = useState<{ compraId: string; cartaoId: string; cartao: string; fechamento: number; depoisDoFechamento: boolean; ano: number; mes: number; anoCompra: number } | null>(null)
  const [form, setForm] = useState<{ inicial?: Lancamento; tipo?: Tipo; preset?: Partial<Lancamento>; cartaoId?: string } | null>(null)
  const [menu, setMenu] = useState(false)
  const [mais, setMais] = useState(false)
  const [bancoAberto, setBancoAberto] = useState<string | null>(null)
  /** Cartão que a tela Cartões abre primeiro (o da compra que acabou de ser lançada). */
  const [cartaoAberto, setCartaoAberto] = useState<string | null>(null)
  /** Compra no cartão lançada na tela Lançamentos: a ida para a tela Cartões acontece quando o formulário fecha (com "Salvar e lançar outro" ele continua aberto). */
  const idaParaCartao = useRef<{ ano: number; mes: number; cartaoId: string; compraId: string } | null>(null)
  /** A compra recém-lançada que a tela Cartões destaca (rola até ela). */
  const [compraDestacada, setCompraDestacada] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)
  /** Configurações aberta; 'painel' abre direto na seção Painel (jeito de ver e o que aparece). */
  const [ajustes, setAjustes] = useState<boolean | 'painel'>(false)
  const [refazendo, setRefazendo] = useState(false)
  /** Tutorial guiado aberto. */
  const [tour, setTour] = useState(false)
  const [editarCategorias, setEditarCategorias] = useState(false)
  const [zerando, setZerando] = useState(false)
  const [excluindo, setExcluindo] = useState(false)
  const [quadroMeses, setQuadroMeses] = useState(false)
  const [busca, setBusca] = useState('')
  const [extrato, setExtrato] = useState(false)
  const [organizar, setOrganizar] = useState(false)
  /** "Esses também são da pensão?": aberto depois de ligar um lançamento a uma conta do mês. */
  const [parecidos, setParecidos] = useState<{ modelo: Lancamento; itens: SugestaoVinculo[] } | null>(null)
  const arquivo = useRef<HTMLInputElement>(null)
  // pílula que desliza até o item ativo (menu lateral e abas do celular)
  const refNav = useRef<HTMLElement>(null)
  const refAbas = useRef<HTMLElement>(null)
  const { tema } = useTema()
  const ocultos = useValoresOcultos()
  const d = useDados(userId, ano)
  const contas = useContasFixas(d.setErro)
  // Baixas em andamento e uma pausa curta depois de cada uma: ao dar baixa a conta sai da lista e a de baixo sobe, então um toque
  // duplo (ou apressado) não pode cair em "Paguei" de outra conta.
  const baixando = useRef(new Set<string>())
  const esfriando = useRef(false)
  const mobile = useMobile()
  const barra = useBarraLateral()

  // Quem já tinha dados antes das perguntas existirem ganha um perfil com o que já usa, sem questionário.
  const temDados = d.lancs.length > 0 || d.bancos.length > 0 || d.dividas.length > 0 || d.meses.length > 0
  const perfil: Perfil = d.perfil ?? (temDados || d.perfilSemTabela ? inferirPerfil(d) : PERFIL_PADRAO)
  const precisaPerfil = !d.carregando && d.perfil === null && !d.perfilSemTabela && temDados
  // Antes do painel podem aparecer o carregamento e as perguntas do primeiro acesso.
  const carregandoPerfil = d.perfil === undefined && d.carregando
  const perguntar = (d.perfil === null && !temDados && !d.perfilSemTabela && !d.carregando) || refazendo
  const noPainel = !carregandoPerfil && !perguntar
  useEffect(() => {
    if (precisaPerfil) void d.salvarPerfil(perfil)
  }, [precisaPerfil]) // eslint-disable-line react-hooks/exhaustive-deps
  definirMoedaPrincipal(perfil.moeda)
  const v = visao(perfil)
  const cartoes = useCartoes({
    ativo: v.cartoes, ano, lancsDoAno: d.lancs, categoriasAntigas: d.categoriasAntigas,
    recarregarLancs: d.recarregar, aoErro: d.setErro,
  })
  const { taxas } = useCambio(perfil.moeda, v.moedas || d.lancs.some((l) => l.moeda_original) || d.metas.some((m) => m.moeda !== perfil.moeda)
    || d.dividas.some((x) => x.moeda && x.moeda !== perfil.moeda) || contas.contas.some((x) => x.moeda && x.moeda !== perfil.moeda))
  const paginas = PAGINAS.filter((p) =>
    p.id === 'contas' ? v.contas : p.id === 'cartoes' ? v.cartoes : p.id === 'dividas' ? v.dividas : p.id === 'metas' ? v.metas : p.id === 'patrimonio' ? v.bancos || v.investimentos || v.moedas : p.id === 'ano' ? v.paginaAno : true,
  )
  const paginaAtual = paginas.some((p) => p.id === pagina) ? pagina : 'inicio'
  // O menu muda na hora; a página nova é montada em segundo plano (em pedaços), sem congelar a animação do menu.
  const paginaMostrada = useDeferredValue(paginaAtual)
  // Quem terminou as perguntas há pouco e ainda não viu (nem pulou) o tutorial recebe o convite sozinho, uma vez por abertura.
  useEffect(() => {
    const recemChegou = perfil.onboarding_em ? Date.now() - new Date(perfil.onboarding_em).getTime() < 3 * 86400000 : false
    if (!noPainel || d.carregando || !recemChegou || perfil.dispensadas.includes('tour')) return
    const t = window.setTimeout(() => setTour(true), 1200)
    return () => window.clearTimeout(t)
  }, [noPainel, d.carregando, perfil.onboarding_em, perfil.dispensadas]) // eslint-disable-line react-hooks/exhaustive-deps
  const categoriaDe = (l: Lancamento) => categoriaDoLanc(l, d.categorias, d.categoriasAntigas)
  const idCategoria = (l: Lancamento) => categoriaDe(l)?.id ?? ''

  useEffect(() => {
    const aoMudar = () => setPagina(paginaDoHash())
    window.addEventListener('hashchange', aoMudar)
    return () => window.removeEventListener('hashchange', aoMudar)
  }, [])
  const lenteNav = useLente(refNav, 'button.ativo', `${paginaAtual}|${paginas.length}|${noPainel}|${barra.trilho}|${barra.retrato}`)
  const lenteAbas = useLente(refAbas, 'button.ativo', `${paginaAtual}|${mobile}|${paginas.length}|${noPainel}|${barra.abasOcultas}`)
  const abas = paginas.length <= MAX_ABAS ? paginas : paginas.slice(0, MAX_ABAS - 1)
  const naMais = paginas.slice(abas.length)

  // Ao trocar de mês, os blocos da página sobem de novo (mesma animação da entrada).
  const primeiraVez = useRef(true)
  useEffect(() => {
    if (primeiraVez.current) {
      primeiraVez.current = false
      return
    }
    if (semMovimento()) return
    document.querySelectorAll<HTMLElement>('.pagina > *, .kpis > *').forEach((el, i) =>
      el.animate(
        // só opacidade e deslocamento: animar 'filter' em blocos grandes engasga em tablet
        [{ opacity: 0.35, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }],
        { duration: 450, delay: Math.min(i, 6) * 30, easing: 'cubic-bezier(.32,.72,0,1)', fill: 'backwards' },
      ),
    )
  }, [mes, ano])

  const irPara = (p: Pagina) => {
    setBancoAberto(null)
    setCartaoAberto(null)
    setCompraDestacada(null)
    idaParaCartao.current = null
    setMais(false)
    setMenu(false)
    barra.fechar()
    location.hash = `/${p}`
    setPagina(p)
    window.scrollTo({ top: 0 })
  }

  // Compras de fatura renegociada saem das contas do mês: a fatura virou dívida, e o que sai do bolso são as parcelas dela.
  const comFaturas = v.cartoes && !cartoes.semTabela
  // só as renegociações mudam a conta: a chave evita refazer tudo a cada fatura marcada como paga
  const chaveRenegociadas = cartoes.faturasPagas.filter(renegociada).map((p) => `${p.cartao_id}${p.ano}${p.mes}`).join()
  const lancsContados = useMemo(
    () => (comFaturas && chaveRenegociadas ? d.lancs.filter(contaNasSaidas(cartoes.faturasPagas)) : d.lancs),
    [d.lancs, chaveRenegociadas, comFaturas], // eslint-disable-line react-hooks/exhaustive-deps
  )

  // O que você deve entra nas contas do mês; o que te devem fica à parte (só vira entrada quando você recebe).
  const dividasDevo = useMemo(() => d.dividas.filter((x) => !meDevem(x)), [d.dividas])
  const dividasMeDevem = useMemo(() => d.dividas.filter(meDevem), [d.dividas])

  // Cada mês é calculado com dívidas e caixa contínuos: nada precisa ser copiado à mão.
  const porMesCompleto = useMemo(() => {
    const agora = hoje.getFullYear() * 12 + hoje.getMonth() + 1
    return MESES_NOME.map((_, i) => {
      const m = i + 1
      const l = lancsContados.filter((x) => x.mes === m && x.ano === ano)
      const sit = situacaoDividas(dividasDevo, d.saldos, d.pagamentos, ano, m, taxas)
      const ef = mesEfetivo(d.meses, ano, m)
      const temProprio = d.meses.some((x) => x.ano === ano && x.mes === m)
      // Meses futuros sem lançamentos ficam em branco, como na planilha.
      const vazio = !l.length && !temProprio && (ano * 12 + m > agora || (!sit.length && !ef.herdadoDe))
      return { sit, ef, resumo: vazio ? null : resumoMes(l, sit, ef, taxas, idCategoria) }
    })
  }, [lancsContados, dividasDevo, d.saldos, d.pagamentos, d.meses, ano, taxas, d.categorias, hoje]) // eslint-disable-line react-hooks/exhaustive-deps
  const porMes = porMesCompleto.map((x) => x.resumo)

  const lancsMes = lancsContados.filter((l) => l.mes === mes && l.ano === ano)
  const { sit: situacao, ef: mesEf } = porMesCompleto[mes - 1]
  const aReceber = useMemo(
    () => situacaoDividas(dividasMeDevem, d.saldos, d.pagamentos, ano, mes, taxas),
    [dividasMeDevem, d.saldos, d.pagamentos, ano, mes, taxas],
  )
  // Dia que vale para dizer o que está atrasado: hoje, ou o fim do mês aberto quando ele já passou.
  const hojeIso = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`
  const diaRef = fimDoMes(ano, mes) < hojeIso ? fimDoMes(ano, mes) : hojeIso
  // as dívidas como foram cadastradas (parcela na moeda delas), para as listas dos formulários
  const dividasAbertas = [...situacao, ...aReceber].filter((s) => s.restante > 0).map((s) => s.original)

  const mudarMes = (delta: number) => {
    let [a, m] = [ano, mes + delta]
    if (m < 1) [a, m] = [a - 1, 12]
    if (m > 12) [a, m] = [a + 1, 1]
    setAno(a)
    setMes(m)
  }

  const tarefa = async (msg: string, fn: () => Promise<unknown>) => {
    setOcupado(msg)
    try {
      await fn()
    } catch (e) {
      d.setErro(ehErroDeVersao(e)
        ? tx('Saiu uma versão nova do OpusCash. Feche esta janela e ele se atualiza sozinho; depois é só tentar de novo.')
        : e instanceof Error ? e.message : String(e))
    } finally {
      setOcupado(null)
    }
  }

  const importar = (f: File) =>
    tarefa(tx('Lendo a planilha…'), async () => {
      // A biblioteca de planilhas é pesada; só baixa quando alguém importa ou exporta.
      const { lerPlanilha, gravarImportacao } = await import('../lib/planilha')
      const meses = await lerPlanilha(f)
      if (arquivo.current) arquivo.current.value = ''
      if (!meses.length) return avisar(tx('Não encontrei abas de mês com dados nessa planilha. Cada aba precisa ter o mês e o ano no nome (ex.: OUTUBRO26 ou NOV 26) ou no título (ex.: CONTROLE FINANCEIRO JANEIRO/2024).'), tx('Nada para importar'))
      const lista = meses.map((m) => tx('{0}/{1}: {2} lançamentos', MESES_NOME[m.mes - 1], m.ano, m.lancs.length)).join('\n')
      if (!(await confirmar(tx('Encontrei {0} meses:\n\n{1}\n\nOs dados desses meses no app serão substituídos pelos da planilha. Quer continuar?', meses.length, lista), { titulo: tx('Importar planilha'), botao: tx('Importar') }))) return
      setOcupado(tx('Salvando…'))
      await gravarImportacao(userId, meses)
      const ultimo = meses[meses.length - 1]
      if (ultimo.ano === ano) await d.recarregar()
      setAno(ultimo.ano)
      setMes(ultimo.mes)
    })

  const situacoesContas = useMemo(
    () => situacoesDoMes(contas.contas, d.lancs, ano, mes, undefined, taxas),
    [contas.contas, d.lancs, ano, mes, taxas],
  )
  const esfriar = () => {
    esfriando.current = true
    setTimeout(() => { esfriando.current = false }, 800)
  }

  // Como cada conta aparece nos lançamentos: o nome dela e tudo o que a pessoa já ligou a ela (deste e dos outros anos).
  const memoriaContas = useMemo(
    () => memoriaDasContas(contas.contas, [...d.lancs.filter((l) => l.conta_fixa_id), ...d.vinculosOutrosAnos], taxas),
    [contas.contas, d.lancs, d.vinculosOutrosAnos, taxas],
  )
  // Lançamento do mês que parece ser de cada conta ainda sem baixa (veio do extrato, por exemplo).
  const sugestoesVinculo = useMemo(
    () => sugestoesDoMes(situacoesContas, d.lancs, ano, mes, memoriaContas, perfil.dispensadas),
    [situacoesContas, d.lancs, ano, mes, memoriaContas, perfil.dispensadas], // eslint-disable-line react-hooks/exhaustive-deps
  )
  /** Depois de ligar `salvo` a uma conta: procura os parecidos dos outros meses e pergunta se também são dela. */
  const perguntarParecidos = (salvo: Lancamento, lancs: Lancamento[]) => {
    const conta = contas.contas.find((x) => x.id === salvo.conta_fixa_id)
    if (!conta) return
    const mem = memoriaDasContas([conta], [...lancs.filter((l) => l.conta_fixa_id), ...d.vinculosOutrosAnos], taxas).get(conta.id)!
    // com `salvo` na lista: é ele que marca o mês dele como já resolvido (cada conta tem um lançamento por mês)
    const itens = parecidosNosOutrosMeses(conta, mem, lancs, perfil.dispensadas)
    if (itens.length) setParecidos({ modelo: salvo, itens })
  }
  /** A conta já tem um lançamento ligado nesse mês? (o banco aceita só um por mês) */
  const contaOcupada = (contaId: string, l: Pick<Lancamento, 'id' | 'ano' | 'mes'>) =>
    d.lancs.some((x) => x.conta_fixa_id === contaId && x.ano === l.ano && x.mes === l.mes && x.id !== l.id)
  const ligarAConta = (lancId: string, contaId: string) => {
    const l = d.lancs.find((x) => x.id === lancId)
    if (!l || contaOcupada(contaId, l)) return
    const ligado = { ...l, conta_fixa_id: contaId }
    void d.updLanc(lancId, { conta_fixa_id: contaId })
    perguntarParecidos(ligado, d.lancs.map((x) => (x.id === lancId ? ligado : x)))
  }
  const recusarVinculos = (lancIds: string[], contaId: string) => {
    if (lancIds.length) mudarPerfil({ ...perfil, dispensadas: [...new Set([...perfil.dispensadas, ...lancIds.map((id) => chaveRecusa(contaId, id))])] })
  }

  const pagarConta = async (s: SituacaoConta, mudancas?: { valor?: number; data?: string; cotacao?: number }) => {
    if (s.baixa || baixando.current.has(s.conta.id) || esfriando.current) return
    // O dinheiro já está num lançamento (veio do extrato, ou foi lançado à mão)? Em vez de lançar de novo, usa esse.
    const sugerido = sugestoesVinculo.get(s.conta.id)
    if (sugerido && !mudancas) {
      const { lanc } = sugerido
      esfriando.current = true
      const usar = await confirmar(s.conta.tipo === 'entrada'
        ? tx('Já existe “{0}” de {1} em {2}. Ele é o recebimento de {3}?', lanc.descricao, fmtValor(lanc.valor), fmtDataCurta(lanc.data), s.conta.descricao)
        : tx('Já existe “{0}” de {1} em {2}. Ele é o pagamento de {3}?', lanc.descricao, fmtValor(lanc.valor), fmtDataCurta(lanc.data), s.conta.descricao),
        { titulo: tx('Já está lançado?'), botao: tx('Sim, usar este'), cancelar: tx('Não, lançar outro') })
      esfriar()
      if (usar) return ligarAConta(lanc.id, s.conta.id)
      recusarVinculos([lanc.id], s.conta.id)
    }
    // Conta em outra moeda sem cotação (combinada ou do dia): não grava nada por 1 por 1, pede a cotação.
    const baixa = lancamentoDaBaixa(s.conta, ano, mes, mudancas, taxas)
    esfriar()
    if (!baixa) return d.setErro(tx('Ainda não temos a cotação de {0}. Toque no lápis (“Outro valor ou outra data”) e informe a cotação do pagamento.', s.moeda ?? ''))
    baixando.current.add(s.conta.id)
    void d.addLanc(baixa).finally(() => baixando.current.delete(s.conta.id))
  }
  const desfazerBaixa = (s: SituacaoConta) => {
    if (s.baixa) void d.delLanc(s.baixa.id)
  }

  const mudarPerfil = (p: Perfil) => void d.salvarPerfil(p)
  const ligarModulo = (m: Modulo) => mudarPerfil({ ...perfil, modulos: { ...perfil.modulos, [m]: true } })
  const sugestao = useMemo(
    () => sugestoes(perfil, d.lancs, porMes.filter(Boolean).length, (l) => categoriaDe(l)?.papel === 'divida')[0] ?? null,
    // perfil muda de identidade a cada render; o que importa são os dados e as escolhas da pessoa
    [d.lancs, d.categorias, porMesCompleto, perfil.modulos, perfil.moedas, perfil.detalhe, perfil.dispensadas], // eslint-disable-line react-hooks/exhaustive-deps
  )

  // Conselheiro: lê os últimos meses fechados (de qualquer ano) e o mês atual, sem depender do mês que está aberto na tela.
  const lancsDosConselhos = useMemo(() => {
    const abertos = new Set(lancsContados.map((l) => l.id))
    const outros = d.lancsRecentes.filter((l) => !abertos.has(l.id))
    return [...lancsContados, ...(comFaturas && chaveRenegociadas ? outros.filter(contaNasSaidas(cartoes.faturasPagas)) : outros)]
  }, [lancsContados, d.lancsRecentes, chaveRenegociadas, comFaturas]) // eslint-disable-line react-hooks/exhaustive-deps
  const conselhos = useMemo(() => conselhosDe({
    hoje, lancs: lancsDosConselhos, categorias: d.categorias, categoriaDe: idCategoria, dividas: d.dividas, saldos: d.saldos,
    pagamentos: d.pagamentos, taxas, meses: d.meses, metas: d.metas, movimentosMeta: d.movimentosMeta, perfil,
    dividasSemJuros: d.dividasSemJuros,
    compras: comFaturas ? cartoes.compras.filter(contaNasSaidas(cartoes.faturasPagas)) : [],
  }), [lancsDosConselhos, d.categorias, d.dividas, d.saldos, d.pagamentos, taxas, d.meses, d.metas, d.movimentosMeta, d.dividasSemJuros, perfil.modulos, perfil.moedas, perfil.dispensadas, comFaturas, cartoes.compras, chaveRenegociadas]) // eslint-disable-line react-hooks/exhaustive-deps

  // "Agora não": o conselho some até o mês que vem (se ainda for verdade, volta).
  const dispensarConselho = (id: string) => mudarPerfil({ ...perfil, dispensadas: dispensarPorUmMes(perfil.dispensadas, id, hoje) })

  // Pagar (o que você deve) ou receber (o que te devem): o valor sugerido é o atrasado ou a próxima parcela.
  const pagarDivida = (s: SituacaoDivida, valor?: number) => {
    // sem calendário nem parcela fixa, o valor fica em branco: a pessoa paga quanto puder
    const sugerido = valor ?? calendarioDe(s, diaRef)?.sugerido ?? (s.divida.valor_parcela ? Math.min(s.divida.valor_parcela, s.restante) : undefined)
    const recebe = meDevem(s.divida)
    setForm({
      preset: {
        tipo: recebe ? 'entrada' : 'saida', divida_id: s.divida.id,
        ...(recebe ? {} : { categoria_id: d.categorias.find((c) => c.papel === 'divida')?.id ?? null }),
        descricao: recebe ? tx('{0} – recebido', `${s.divida.descricao}${s.divida.pessoa ? ` (${s.divida.pessoa})` : ''}`) : tx('{0} – parcela', s.divida.descricao),
        // sem cotação da moeda da dívida não há valor na moeda principal: o formulário pede a cotação (não assume 1 por 1)
        valor: sugerido && sugerido > 0 && !s.semCotacao ? sugerido : undefined,
        // dívida em outra moeda: o pagamento abre nessa moeda, com o valor sugerido nela
        ...(s.moeda && sugerido && sugerido > 0 ? { moeda_original: s.moeda, valor_original: nativoDiv(s, sugerido) } : {}),
      },
    })
  }

  // Limite garantido que vem da caixinha do banco do cartão: o valor guardado nela hoje (tela Dinheiro guardado).
  const caixaHoje = mesEfetivo(d.meses, hoje.getFullYear(), hoje.getMonth() + 1).caixa
  const garantidoDe = (k: (typeof cartoes.cartoes)[number]) => garantidoDo(k, k.banco_id ? caixaHoje[k.banco_id]?.caixinha : 0)
  const faturas = comFaturas ? situacoesDosCartoes(cartoes.cartoes, cartoes.compras, cartoes.faturasPagas, ano, mes, undefined, garantidoDe) : []
  // faturas que venceram sem pagar (em qualquer cartão), para o alerta das dicas
  const faturasAtrasadas = faturas.flatMap((s) => [...s.atrasadas, ...(s.status === 'atrasada' ? [s] : [])].map((f) => ({ ...f, cartao: s.cartao })))

  // Editar uma parcela pode mudá-la de ano; as compras de outros anos só são lidas de novo ao recarregar.
  // Ligou o lançamento a uma conta do mês? Em seguida o app pergunta pelos parecidos dos outros meses.
  /** Dívida de um empréstimo (recebido ou feito): nasce zerada na véspera do lançamento, que então soma o valor emprestado. */
  const criarEmprestimo = ({ quem, data, sentido }: { quem: string; data: string; sentido: 'devo' | 'me_devem' }) => {
    const vespera = new Date(`${data}T12:00:00`)
    vespera.setDate(vespera.getDate() - 1)
    const pad = (n: number) => String(n).padStart(2, '0')
    return d.addDivida({
      descricao: sentido === 'devo' ? tx('Empréstimo do {0}', quem) : tx('Empréstimo para {0}', quem), pessoa: quem, sentido, valor_parcela: null, inicio: null,
      saldo: 0, data: `${vespera.getFullYear()}-${pad(vespera.getMonth() + 1)}-${pad(vespera.getDate())}`,
    })
  }

  const salvarLancamento = async (l: Omit<Lancamento, 'id'>, id?: string) => {
    const antes = id ? d.lancs.find((x) => x.id === id) : undefined
    const lancs = d.lancs
    let salvo: Lancamento | undefined
    if (!id) salvo = await d.addLanc(l)
    else {
      await d.updLanc(id, l)
      if (antes) salvo = { ...antes, ...l }
      if (antes?.cartao_id) await cartoes.recarregar()
    }
    if (salvo?.conta_fixa_id && salvo.conta_fixa_id !== antes?.conta_fixa_id) {
      perguntarParecidos(salvo, [...lancs.filter((x) => x.id !== salvo.id), salvo])
    }
  }

  // Contas fixas e cartões entram na Início pelos lugares reservados para eles (zona "O que fazer" e indicadores).
  const comContas = v.contas && !contas.semTabela
  // a dívida já ligada ao lançamento aberto continua na lista, mesmo quitada
  const ligadaAoForm = form?.inicial?.divida_id ? d.dividas.find((x) => x.id === form.inicial?.divida_id) : undefined
  const dividasDoForm = ligadaAoForm && !dividasAbertas.some((x) => x.id === ligadaAoForm.id) ? [...dividasAbertas, ligadaAoForm] : dividasAbertas
  const comCartoes = comFaturas
  // Indicador zerado no topo só ocupa atenção: a fatura entra quando há fatura no mês.
  const totalFaturas = comCartoes ? totalFaturasDoMes(faturas) : 0
  const comKpiContas = comContas && situacoesContas.length > 0
  const kpisExtras = comKpiContas || totalFaturas > 0 ? (
    <>
      {comKpiContas && <Kpi rotulo={tx('Falta pagar no mês')} valor={faltaPagarNoMes(situacoesContas)} cor={COR.divida} icone="calendario" aoClicar={() => irPara('contas')} />}
      {totalFaturas > 0 && <Kpi rotulo={tx('Fatura do cartão')} valor={totalFaturas} cor={COR.investimentos} icone="cartao" aoClicar={() => irPara('cartoes')} />}
    </>
  ) : undefined

  const ctx: Ctx = {
    kpisExtras,
    blocos: {
      contas: comContas ? <BlocoContasDoMes completo={perfil.detalhe === 'detalhado'} situacoes={situacoesContas} aoAbrir={() => irPara('contas')} aoPagar={pagarConta} /> : undefined,
      cartoes: comCartoes ? <BlocoCartoes situacoes={faturas} aoAbrir={() => irPara('cartoes')} /> : undefined,
    },
    busca, setBusca,
    ano, mes, d, cartoes, faturas, lancsMes, lancsAno: lancsContados, situacao, aReceber, diaRef, mesEf, porMes, mobile,
    perfil, v, taxas, sugestao,
    aceitarSugestao: (s: Sugestao) => mudarPerfil(s.aplicar(perfil)),
    recusarSugestao: (s: Sugestao) => mudarPerfil({ ...perfil, dispensadas: [...perfil.dispensadas, s.id] }),
    dispensar: (id: string) => mudarPerfil({ ...perfil, dispensadas: [...new Set([...perfil.dispensadas, id])] }),
    conselhos, dispensarConselho,
    conselhosSemDados: faltamDadosParaConselhos({ lancs: lancsDosConselhos, dividas: d.dividas, hoje }),
    conselhosDispensados: avisosDispensadosNoMes(perfil.dispensadas, hoje),
    ligarModulo,
    personalizar: () => setAjustes('painel'),
    categorias: d.categorias,
    categoriaDe,
    gerenciarCategorias: () => (d.categoriasAntigas
      ? d.setErro(tx('Para criar e editar categorias, falta atualizar o banco de dados: rode supabase/migracao-05-categorias.sql no SQL Editor do Supabase.'))
      : setEditarCategorias(true)),
    importar: () => arquivo.current?.click(),
    importarExtrato: () => setExtrato(true),
    organizarNomes: () => setOrganizar(true),
    contaNova: !d.carregando && !temDados,
    r: resumoMes(lancsMes, situacao, mesEf, taxas, idCategoria),
    anterior: mes > 1 ? porMes[mes - 2] : null,
    irPara,
    irParaMes: setMes,
    novoLancamento: (tipo) => setForm({ tipo }),
    editarLancamento: (l) => setForm({ inicial: l }),
    novaCompraNoCartao: (cartaoId) => setForm({ tipo: 'saida', cartaoId }),
    pagarDivida,
    contas, situacoesContas, pagarConta, desfazerBaixa,
    memoriaContas,
    sugestaoDaConta: (id) => (comContas ? sugestoesVinculo.get(id) : undefined),
    ligarAConta,
    recusarVinculo: (lancId, contaId) => recusarVinculos([lancId], contaId),
    cartaoAberto, compraDestacada,
    bancoAberto,
    abrirBanco: (id) => {
      irPara('patrimonio')
      setBancoAberto(id ?? 'sem')
    },
  }

  // Primeiro acesso: as perguntas montam o painel antes de qualquer coisa.
  if (carregandoPerfil) return <Esqueleto />
  if (perguntar) {
    return (
      <Suspense fallback={<Esqueleto />}>
      <Questionario
        inicial={perfil.nome || !nomeConta ? perfil : { ...perfil, nome: nomeConta }}
        foto={d.foto}
        aoMudarFoto={(f) => void d.salvarFoto(f)}
        aoConcluir={(p, importar) => {
          mudarPerfil(p); setRefazendo(false); irPara('inicio')
          if (importar) setExtrato(true)
          else if (!perfil.dispensadas.includes('tour')) window.setTimeout(() => setTour(true), 700)
        }}
        aoCancelar={refazendo ? () => setRefazendo(false) : undefined}
      />
      </Suspense>
    )
  }

  const trocarTema = (e: React.MouseEvent) => definirTema(tema === 'escuro' ? 'claro' : 'escuro', { x: e.clientX, y: e.clientY })
  const nome = perfil.nome.trim() || email.split('@')[0]
  const iniciais = nome.split(/\s+/).slice(0, 2).map((x) => x[0]?.toUpperCase() ?? '').join('')
  // o sino acende com contas atrasadas ou vencendo hoje
  const avisos = comContas ? situacoesContas.filter((s) => s.conta.tipo === 'saida' && (s.estado === 'atrasada' || s.estado === 'vence_hoje')) : []
  const atrasadas = avisos.filter((s) => s.estado === 'atrasada').length
  const buscar = (q: string) => {
    setBusca(q)
    // a busca de Lançamentos e a dos Cartões são a mesma: digitar em Cartões refina o resultado de lá
    if (paginaAtual !== 'lancamentos' && paginaAtual !== 'cartoes') irPara('lancamentos')
  }

  // Dicas que se revezam no pé do menu lateral: primeiro o que pede atenção, depois atalhos úteis.
  const faltaDividas = situacao.reduce((a, s) => a + s.restante, 0)
  const atrasoDevo = situacao.reduce((a, s) => a + (calendarioDe(s, diaRef)?.emAtraso ?? 0), 0)
  const atrasoReceber = aReceber.reduce((a, s) => a + (calendarioDe(s, diaRef)?.emAtraso ?? 0), 0)
  // Primeiro os alertas de hoje (contas, faturas, parcelas atrasadas); depois até 3 conselhos do conselheiro (lib/conselheiro.ts);
  // as dicas genéricas só aparecem enquanto o conselheiro não tem nada a dizer.
  const alertas: Dica[] = [
    ...(avisos.length ? [{
      id: 'contas', alerta: true, icone: 'sino', botao: tx('Ver contas'), acao: () => irPara('contas'),
      titulo: avisos.length === 1 ? tx('1 conta pede atenção.') : tx('{0} contas pedem atenção.', avisos.length),
    }] : []),
    ...(faturasAtrasadas.length ? [{
      id: 'faturas', alerta: true, icone: 'cartao', botao: tx('Resolver'), acao: () => irPara('cartoes'),
      titulo: faturasAtrasadas.length === 1
        ? tx('A fatura {0} de {1} venceu.', faturasAtrasadas[0].cartao.nome, nomeDaFatura(faturasAtrasadas[0].ano, faturasAtrasadas[0].mes, ano))
        : tx('{0} faturas venceram sem pagar.', faturasAtrasadas.length),
    }] : []),
    ...(v.dividas && atrasoDevo > 0 ? [{
      id: 'dividas-atraso', alerta: true, icone: 'relogio', botao: tx('Ver dívidas'), acao: () => irPara('dividas'),
      titulo: tx('{0} de parcelas atrasadas.', fmtValor(atrasoDevo)),
    }] : []),
    ...(v.dividas && atrasoReceber > 0 ? [{
      id: 'receber-atraso', icone: 'receber', botao: tx('Cobrar'), acao: () => irPara('dividas'),
      titulo: tx('Te devem {0} que já venceu.', fmtValor(atrasoReceber)),
    }] : []),
  ]
  const dicasDoConselheiro: Dica[] = conselhos.slice(0, 3).map((c) => ({
    id: c.id, alerta: c.gravidade === 'urgente', icone: c.icone, titulo: c.titulo, botao: c.botao, acao: () => irPara(c.destino),
    dispensar: () => dispensarConselho(c.id),
  }))
  const dicasGenericas: Dica[] = [
    { id: 'lancar', icone: 'mais', botao: tx('Lançar agora'), acao: () => setForm({}), titulo: tx('Lançou o que gastou hoje?') },
    ...(d.lancs.length < 40 ? [{ id: 'importar', icone: 'relatorio', botao: tx('Importar extrato'), acao: () => setExtrato(true), titulo: tx('Tem um extrato ou planilha? Traga tudo de uma vez.') }] : []),
    ...(v.dividas && faltaDividas > 0 ? [{
      id: 'dividas', icone: 'divida', botao: tx('Ver dívidas'), acao: () => irPara('dividas'), titulo: tx('Faltam {0} nas dívidas.', fmtValor(faltaDividas)),
    }] : []),
    v.metas
      ? { id: 'metas', icone: 'meta', botao: tx('Ver metas'), acao: () => irPara('metas'), titulo: tx('Guarde um pouco para as suas metas.') }
      : { id: 'metas', icone: 'meta', botao: tx('Criar meta'), acao: () => { ligarModulo('metas'); irPara('metas') }, titulo: tx('Tem um sonho para juntar dinheiro?') },
    { id: 'controle', icone: 'ajustes', botao: tx('Personalizar'), acao: () => setAjustes(true), titulo: tx('Mais controle para o seu dinheiro.') },
    {
      id: 'backup', icone: 'exportar', botao: tx('Baixar backup'), titulo: tx('Guarde uma cópia dos seus dados.'),
      acao: () => tarefa(tx('Preparando o backup…'), async () => (await import('../lib/planilha')).exportarBackup()),
    },
    {
      id: 'tema', icone: tema === 'escuro' ? 'sol' : 'lua', botao: tx('Trocar tema'), titulo: tema === 'escuro' ? tx('Que tal o tema claro?') : tx('Que tal o tema escuro?'),
      acao: () => definirTema(tema === 'escuro' ? 'claro' : 'escuro', { x: 130, y: innerHeight - 110 }),
    },
  ]
  const dicas: Dica[] = [...alertas, ...(dicasDoConselheiro.length ? dicasDoConselheiro : dicasGenericas)]

  const menuItens = (
    <>
      <button onClick={() => setAjustes(true)}><Icone nome="engrenagem" /> {tx('Configurações')}</button>
      <button onClick={() => setTour(true)}><Icone nome="ideia" /> {tx('Ver o tutorial')}</button>
      <button onClick={trocarTema}><Icone nome={tema === 'escuro' ? 'sol' : 'lua'} /> {tema === 'escuro' ? tx('Tema claro') : tx('Tema escuro')}</button>
      <button onClick={() => setExtrato(true)}><Icone nome="relatorio" /> {tx('Importar extrato')}</button>
      <button onClick={() => arquivo.current?.click()}><Icone nome="importar" /> {tx('Importar planilha')}</button>
      <button onClick={() => tarefa(tx('Preparando o backup…'), async () => (await import('../lib/planilha')).exportarBackup())}>
        <Icone nome="exportar" /> {tx('Baixar backup')}
      </button>
      <button onClick={() => supabase.auth.signOut()}><Icone nome="sair" /> {tx('Sair')}</button>
    </>
  )

  return (
    <div className={`app ${barra.trilho ? 'trilho' : ''} ${barra.retrato ? 'retrato' : ''} ${barra.abasOcultas ? 'abas-ocultas' : ''}`}>
      {barra.retrato && !barra.trilho && <div className="lateral-fundo" onClick={barra.fechar} aria-hidden="true" />}
      <aside className="lateral">
        <div className="lateral-topo">
          <Marca />
          <button className="lateral-alternar" onClick={barra.alternarLateral}
            aria-expanded={!barra.trilho} aria-label={barra.trilho ? tx('Mostrar o menu') : tx('Esconder o menu')}
            title={barra.trilho ? tx('Mostrar o menu') : tx('Esconder o menu')}>
            <Icone nome={barra.trilho ? 'dir' : 'esq'} tamanho={18} />
          </button>
        </div>
        <nav ref={refNav} aria-label={tx('Páginas')}>
          {lenteNav && <span className="lente" aria-hidden="true" style={estiloLente(lenteNav)} />}
          {paginas.map((p) => (
            <button key={p.id} data-tour={`nav-${p.id}`} className={paginaAtual === p.id ? 'ativo' : ''} onClick={() => irPara(p.id)}
              aria-current={paginaAtual === p.id ? 'page' : undefined} aria-label={p.nome} title={barra.trilho ? p.nome : undefined}>
              <Icone nome={p.icone} /> <span className="rotulo">{p.nome}</span>
            </button>
          ))}
          <button data-tour="nav-config" onClick={() => { barra.fechar(); setAjustes(true) }} aria-label={tx('Configurações')} title={barra.trilho ? tx('Configurações') : undefined}>
            <Icone nome="engrenagem" /> <span className="rotulo">{tx('Configurações')}</span>
          </button>
        </nav>
        <div className="lateral-rodape">
          <CartaoDicas dicas={dicas} />
        </div>
      </aside>

      <div className="conteudo">
        <header className="barra">
          {mobile && <Marca compacta />}
          {!mobile && (
            <label className="busca-topo">
              <Icone nome="busca" tamanho={18} />
              <input type="search" placeholder={tx('Busque por nome, valor ou data…')} value={busca} onChange={(e) => buscar(e.target.value)} aria-label={tx('Buscar lançamentos')} />
            </label>
          )}
          <div className="barra-direita">
            {(ocupado || d.carregando) && <span className="carregando so-desktop">{ocupado ?? tx('Carregando…')}</span>}
            <div className="seletor-mes">
              <button className="icone-btn" onClick={() => mudarMes(-1)} aria-label={tx('Mês anterior')}><Icone nome="esq" tamanho={18} /></button>
              <button className="seletor-mes-nome" onClick={() => setQuadroMeses(!quadroMeses)} aria-expanded={quadroMeses} aria-label={tx('Escolher mês')}>
                <Icone nome="calendario" tamanho={17} />{mobile ? MESES_CURTO[mes - 1] : MESES_NOME[mes - 1]} <small>{ano}</small>
              </button>
              <button className="icone-btn" onClick={() => mudarMes(1)} aria-label={tx('Próximo mês')}><Icone nome="dir" tamanho={18} /></button>
              {quadroMeses && (
                <>
                  <div className="fora" onClick={() => setQuadroMeses(false)} />
                  <div className="quadro-meses" role="dialog" aria-label={tx('Meses')}>
                    <div className="quadro-meses-ano">
                      <button className="icone-btn" onClick={() => setAno(ano - 1)} aria-label={tx('Ano anterior')}><Icone nome="esq" tamanho={16} /></button>
                      {ano}
                      <button className="icone-btn" onClick={() => setAno(ano + 1)} aria-label={tx('Próximo ano')}><Icone nome="dir" tamanho={16} /></button>
                    </div>
                    <div className="quadro-meses-grade">
                      {MESES_CURTO.map((m, i) => (
                        <button key={m} className={`${i + 1 === mes ? 'ativo' : ''} ${porMes[i] ? 'com-dados' : ''}`}
                          onClick={() => { setMes(i + 1); setQuadroMeses(false) }} aria-current={i + 1 === mes ? 'date' : undefined}>
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
            <BotaoIdioma />
            <button className="icone-btn" onClick={() => definirValoresOcultos(!ocultos)} aria-pressed={ocultos}
              aria-label={ocultos ? tx('Mostrar valores') : tx('Ocultar valores')} title={ocultos ? tx('Mostrar valores') : tx('Ocultar valores')}>
              <Icone nome={ocultos ? 'olho-fechado' : 'olho'} />
            </button>
            <button className="icone-btn tema-btn" onClick={trocarTema} aria-label={tema === 'escuro' ? tx('Usar tema claro') : tx('Usar tema escuro')} title={tema === 'escuro' ? tx('Tema claro') : tx('Tema escuro')}>
              <Icone nome={tema === 'escuro' ? 'sol' : 'lua'} />
            </button>
            <button className="icone-btn ajustes-btn" onClick={() => setAjustes(true)} aria-label={tx('Configurações')} title={tx('Configurações')}>
              <Icone nome="engrenagem" />
            </button>
            {comContas && (
              <button className="icone-btn" onClick={() => irPara('contas')}
                aria-label={avisos.length ? (avisos.length === 1 ? tx('1 conta pede atenção') : tx('{0} contas pedem atenção', avisos.length)) : tx('Contas do mês')}
                title={avisos.length ? (avisos.length === 1 ? tx('1 conta pede atenção') : tx('{0} contas pedem atenção', avisos.length)) : tx('Nada atrasado')}>
                <Icone nome="sino" />
                {avisos.length > 0 && <span className={`sino-ponto ${atrasadas ? 'atraso' : ''}`} />}
              </button>
            )}
            <div className="perfil-topo">
              <button className="perfil-botao" data-tour="menu-conta" onClick={() => setMenu(!menu)} aria-expanded={menu} aria-label={tx('Sua conta')}>
                <span className="avatar" aria-hidden="true">{d.foto ? <img src={d.foto} alt="" /> : iniciais || '?'}</span>
                <span>{tx('Olá,')} <span translate="no">{nome}</span></span>
                <Icone nome="abaixo" tamanho={18} />
              </button>
              {menu && !mobile && (
                <>
                  <div className="fora" onClick={() => setMenu(false)} />
                  <div className="menu-lista" onClick={() => setMenu(false)}>
                    <span className="email">{email}</span>
                    {menuItens}
                  </div>
                </>
              )}
            </div>
            <div className="menu-movel">
              <button className="icone-btn" data-tour="menu-conta" onClick={() => setMenu(!menu)} aria-label={tx('Menu')} aria-expanded={menu}><Icone nome="menu" /></button>
              {menu && mobile && (
                <>
                  <div className="fora" onClick={() => setMenu(false)} />
                  <div className="menu-lista" onClick={() => setMenu(false)}>
                    <span className="email">{email}</span>
                    {menuItens}
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <AvisoTeste assinatura={assinatura ?? null} userId={userId} moeda={perfil.moeda} adiar={tour} />

        {assinatura?.status === 'past_due' && (
          <div className="alerta" role="status">
            <span>{tx('Não conseguimos cobrar seu cartão. Atualize a forma de pagamento para não perder o acesso.')}</span>
            <button className="link" onClick={() => void irParaStripe('stripe-portal').then((m) => m && avisar(m))}>{tx('Atualizar cartão')}</button>
          </div>
        )}

        {d.perfilSemTabela && (
          <div className="alerta aviso-migracao" role="status">
            {tx('Falta atualizar o banco de dados para guardar suas preferências e usar outras moedas. Rode {0}', ' ')}<code>supabase/migracao-04-perfil-e-moedas.sql</code> {tx('no SQL Editor do Supabase.')}
          </div>
        )}

        {avisoFatura && (
          <div className="alerta aviso-ok" role="status">
            <span>
              {avisoFatura.depoisDoFechamento
                ? <>{tx('Compra lançada na fatura de')} <b>{nomeDaFatura(avisoFatura.ano, avisoFatura.mes, avisoFatura.anoCompra)}</b> {tx('do {0}, porque a fatura anterior já fechou (dia {1}).', avisoFatura.cartao, avisoFatura.fechamento)}</>
                : <>{tx('Compra lançada na fatura de')} <b>{nomeDaFatura(avisoFatura.ano, avisoFatura.mes, avisoFatura.anoCompra)}</b> {tx('do {0}.', avisoFatura.cartao)}</>}
            </span>
            <span>
              {!(paginaAtual === 'cartoes' && ano === avisoFatura.ano && mes === avisoFatura.mes && cartaoAberto === avisoFatura.cartaoId) && (
                <button className="link" onClick={() => {
                  setAno(avisoFatura.ano); setMes(avisoFatura.mes); setAvisoFatura(null)
                  irPara('cartoes'); setCartaoAberto(avisoFatura.cartaoId); setCompraDestacada(avisoFatura.compraId)
                }}>{tx('Ver fatura')}</button>
              )}
              {' '}<button className="link" onClick={() => setAvisoFatura(null)}>{tx('Fechar')}</button>
            </span>
          </div>
        )}

        {d.erro && (
          <div className="alerta" role="alert">
            <span>{tx('Não deu certo. Tente de novo.')} <small>{tx('Detalhe: {0}', d.erro)}</small></span>
            <button className="link" onClick={() => d.setErro(null)}>{tx('Fechar')}</button>
          </div>
        )}

        <Suspense fallback={null}>
        {paginaMostrada === 'inicio' && <Inicio {...ctx} />}
        {paginaMostrada === 'lancamentos' && <Lancamentos {...ctx} />}
        {paginaMostrada === 'contas' && <Contas {...ctx} />}
        {paginaMostrada === 'cartoes' && <Cartoes key={cartaoAberto ?? 'todos'} {...ctx} />}
        {paginaMostrada === 'dividas' && <Dividas {...ctx} />}
        {paginaMostrada === 'metas' && <Metas {...ctx} />}
        {paginaMostrada === 'patrimonio' && <Patrimonio key={bancoAberto ?? 'todos'} {...ctx} />}
        {paginaMostrada === 'ano' && <Ano {...ctx} />}
        </Suspense>
      </div>

      <button className="fab" data-tour="lancar" onClick={() => setForm({})} aria-label={tx('Novo lançamento')}><Icone nome="mais" tamanho={26} /></button>

      <nav className="abas-movel" ref={refAbas}>
        <button className="abas-alca" onClick={barra.alternarAbas} aria-expanded={!barra.abasOcultas}
          aria-label={barra.abasOcultas ? tx('Mostrar a barra de baixo') : tx('Esconder a barra de baixo')}>
          <Icone nome={barra.abasOcultas ? 'cima' : 'abaixo'} tamanho={16} />
        </button>
        {lenteAbas && <span className="lente" aria-hidden="true" style={estiloLente(lenteAbas)} />}
        {abas.map((p) => (
          <button key={p.id} data-tour={`nav-${p.id}`} className={paginaAtual === p.id ? 'ativo' : ''} onClick={() => irPara(p.id)}>
            <Icone nome={p.icone} /> <span>{p.curto}</span>
          </button>
        ))}
        {naMais.length > 0 && (
          <button data-tour="mais" className={naMais.some((p) => p.id === paginaAtual) ? 'ativo' : ''} onClick={() => setMais(!mais)} aria-expanded={mais}>
            <Icone nome="reticencias" /> <span>{tx('Mais')}</span>
          </button>
        )}
      </nav>

      {mobile && mais && (
        <div className="mais-fundo" onClick={() => setMais(false)}>
          <div className="menu-lista mais-lista" role="menu">
            {naMais.map((p) => (
              <button key={p.id} role="menuitem" className={paginaAtual === p.id ? 'ativo' : ''} onClick={() => irPara(p.id)}>
                <Icone nome={p.icone} /> {p.nome}
              </button>
            ))}
          </div>
        </div>
      )}

      <input ref={arquivo} type="file" accept=".xlsx,.xlsm,.xls" hidden onChange={(e) => e.target.files?.[0] && importar(e.target.files[0])} />

      <Suspense fallback={null}>
      {form && (
        <FormLancamento
          key={form.inicial?.id ?? form.preset?.divida_id ?? 'novo'}
          ano={ano}
          mes={mes}
          inicial={form.inicial}
          tipoInicial={form.tipo}
          preset={form.preset}
          historico={d.lancs}
          dividas={dividasDoForm}
          aoNovaDivida={criarEmprestimo}
          inicioDivida={(id) => inicioDaDivida(d.saldos, id)}
          saldoDaDivida={(id) => saldoMaisRecenteDaDivida(d.saldos, id)}
          aoMoverInicioDivida={d.moverInicioDivida}
          perfil={perfil}
          taxas={taxas}
          aoMudarPerfil={mudarPerfil}
          categorias={d.categorias}
          categoriaDe={categoriaDe}
          aoNovaCategoria={d.categoriasAntigas ? undefined : d.addCategoria}
          bancos={d.bancos}
          aoNovoBanco={d.addBanco}
          aoSalvar={(l, id) => void salvarLancamento(l, id)}
          aoExcluir={(id) => {
            // a parcela de cartão apagada também sai dos totais dos outros anos, que só são lidos de novo ao recarregar
            const apagado = d.lancs.find((x) => x.id === id)
            void Promise.resolve(d.delLanc(id)).then(() => (!apagado || apagado.cartao_id ? cartoes.recarregar() : undefined))
          }}
          cartoes={v.cartoes && !cartoes.semTabela ? cartoes.cartoes : undefined}
          cartaoInicial={form.cartaoId}
          aoSalvarCompra={cartoes.addCompra}
          aoExcluirCompra={cartoes.delCompra}
          comprasCartao={cartoes.compras}
          aoCompraSalva={(a) => {
            setAvisoFatura(a)
            // Compra no cartão lançada na tela Lançamentos: ao fechar o formulário, leva para a tela Cartões, no cartão e na fatura em que ela caiu
            if (paginaAtual === 'lancamentos') idaParaCartao.current = { ano: a.ano, mes: a.mes, cartaoId: a.cartaoId, compraId: a.compraId }
          }}
          aoNovoCartao={() => { setForm(null); irPara('cartoes') }}
          contasFixas={comContas ? contas.contas : undefined}
          memoriaContas={memoriaContas}
          aoFechar={() => {
            setForm(null)
            const ida = idaParaCartao.current
            idaParaCartao.current = null
            if (ida) {
              setAno(ida.ano); setMes(ida.mes)
              irPara('cartoes')
              setCartaoAberto(ida.cartaoId)
              setCompraDestacada(ida.compraId)
            }
          }}
        />
      )}

      {parecidos && (() => {
        const conta = contas.contas.find((x) => x.id === parecidos.modelo.conta_fixa_id)
        return conta && (
          <ParecidosConta conta={conta} modelo={parecidos.modelo} itens={parecidos.itens}
            aoLigar={(ids) => {
              // um por mês: pula o mês que já tem lançamento ligado (ou que já recebeu outro desta lista)
              const meses = new Set<number>()
              for (const id of ids) {
                const l = d.lancs.find((x) => x.id === id)
                if (!l || meses.has(l.ano * 12 + l.mes) || contaOcupada(conta.id, l)) continue
                meses.add(l.ano * 12 + l.mes)
                void d.updLanc(id, { conta_fixa_id: conta.id })
              }
            }}
            aoRecusar={(ids) => recusarVinculos(ids, conta.id)}
            aoFechar={() => setParecidos(null)} />
        )
      })()}

      {ajustes && (
        <Configuracoes
          secaoInicial={ajustes === 'painel' ? 'painel' : undefined}
          perfil={perfil}
          email={email}
          categorias={d.categorias}
          foto={d.foto}
          aoMudarFoto={(f) => void d.salvarFoto(f)}
          aoMudar={mudarPerfil}
          aoRefazer={() => { setAjustes(false); setRefazendo(true) }}
          aoTour={() => { setAjustes(false); setTour(true) }}
          aoCategorias={() => { setAjustes(false); ctx.gerenciarCategorias() }}
          aoBackup={() => tarefa(tx('Preparando o backup…'), async () => (await import('../lib/planilha')).exportarBackup())}
          aoImportar={() => { setAjustes(false); arquivo.current?.click() }}
          aoExtrato={() => { setAjustes(false); setExtrato(true) }}
          aoOrganizar={() => { setAjustes(false); setOrganizar(true) }}
          aoZerar={() => { setAjustes(false); setZerando(true) }}
          assinatura={assinatura}
          aoSair={() => supabase.auth.signOut()}
          aoExcluirConta={() => { setAjustes(false); setExcluindo(true) }}
          aoFechar={() => setAjustes(false)}
        />
      )}

      {extrato && <ImportarExtrato c={ctx} aoFechar={() => setExtrato(false)} />}
      {tour && !form && !ajustes && !extrato && !organizar && (
        <Tour perfil={perfil} v={v} nome={perfil.nome.trim()} mobile={mobile} aoLigar={ligarModulo} aoIrPara={irPara}
          aoTerminar={() => { setTour(false); if (!perfil.dispensadas.includes('tour')) ctx.dispensar('tour') }} />
      )}
      {organizar && <OrganizarNomes c={ctx} aoFechar={() => setOrganizar(false)} />}

      {excluindo && (
        <ExcluirContaModal email={email} aoBaixarBackup={async () => (await import('../lib/planilha')).exportarBackup()} aoFechar={() => setExcluindo(false)} />
      )}

      {zerando && (
        <ZerarDados
          contagem={{
            entradas: d.lancs.filter((l) => l.tipo === 'entrada').length,
            saidas: d.lancs.filter((l) => l.tipo === 'saida').length,
            dividas: d.dividas.length, cartoes: cartoes.cartoes.length, contas: contas.contas.length, metas: d.metas.length,
            guardado: d.meses.filter((m) => m.investimentos || Object.keys(m.moedas ?? {}).length || Object.keys(m.caixa ?? {}).length).length,
          }}
          aoBaixarBackup={async () => (await import('../lib/planilha')).exportarBackup()}
          // depois de apagar, recarrega a página: todos os dados e o perfil voltam do zero
          aoZerar={async (escolha) => { await d.zerarDados(escolha); location.hash = '/inicio'; location.reload() }}
          aoFechar={() => setZerando(false)}
        />
      )}

      {editarCategorias && (
        <GerenciarCategorias
          categorias={d.categorias}
          contagem={d.lancs.reduce<Record<string, number>>((m, l) => { const id = idCategoria(l); if (id) m[id] = (m[id] ?? 0) + 1; return m }, {})}
          aoCriar={d.addCategoria}
          aoEditar={d.updCategoria}
          aoExcluir={d.delCategoria}
          aoFechar={() => setEditarCategorias(false)}
        />
      )}
      </Suspense>
    </div>
  )
}

/** Enquanto os dados chegam: a moldura do painel com blocos que brilham, em vez de uma tela vazia. */
function Esqueleto() {
  return (
    <div className="app" aria-busy="true" aria-label={tx('Carregando')}>
      <aside className="lateral"><Marca /></aside>
      <div className="conteudo">
        <div className="esqueleto-tela">
          <div className="esqueleto linha-titulo" />
          <div className="esqueleto-kpis">{[0, 1, 2, 3].map((i) => <div key={i} className="esqueleto" />)}</div>
          <div className="esqueleto-meio"><div className="esqueleto" /><div className="esqueleto" /></div>
        </div>
      </div>
    </div>
  )
}
