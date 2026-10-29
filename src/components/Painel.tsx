import { useEffect, useMemo, useRef, useState } from 'react'
import { sugestoes, type Sugestao } from '../lib/adaptacao'
import { mesEfetivo, resumoMes } from '../lib/calc'
import { categoriaDe as categoriaDoLanc } from '../lib/categorias'
import { faltaPagarNoMes, lancamentoDaBaixa, lancamentoParecido, situacoesDoMes, type SituacaoConta } from '../lib/contasFixas'
import { contaNasSaidas, garantidoDo, nomeDaFatura, renegociada, situacoesDoMes as situacoesDosCartoes, totalFaturasDoMes } from '../lib/cartoes'
import { COR } from '../lib/charts'
import { calendarioDe, fimDoMes, meDevem, nativoDiv, situacaoDividas, type SituacaoDivida } from '../lib/dividas'
import { definirMoedaPrincipal, fmtValor, MESES_CURTO, MESES_NOME } from '../lib/format'
import { useCambio } from '../lib/moedas'
import { inferirPerfil, PERFIL_PADRAO, visao } from '../lib/perfil'
import { supabase } from '../lib/supabase'
import type { Lancamento, Modulo, Perfil, Tipo } from '../lib/types'
import { useMobile } from '../lib/useMobile'
import { estiloLente, useLente } from '../lib/useLente'
import { definirTema, semMovimento, useTema } from '../lib/tema'
import { irParaStripe, type Assinatura } from '../lib/assinatura'
import { useCartoes } from '../lib/useCartoes'
import { useContasFixas } from '../lib/useContasFixas'
import { useDados } from '../lib/useDados'
import { Ano } from '../pages/Ano'
import { Cartoes } from '../pages/Cartoes'
import { Contas } from '../pages/Contas'
import type { Ctx, Pagina } from '../pages/contexto'
import { Dividas } from '../pages/Dividas'
import { Inicio } from '../pages/Inicio'
import { Lancamentos } from '../pages/Lancamentos'
import { Metas } from '../pages/Metas'
import { Patrimonio } from '../pages/Patrimonio'
import { GerenciarCategorias } from './Categorias'
import { BlocoCartoes } from './BlocoCartoes'
import { BlocoContasDoMes } from './BlocoContas'
import { ImportarExtrato, OrganizarNomes } from './Extrato'
import { FormLancamento } from './Formularios'
import { Kpi } from './ui'
import { Icone } from './Icone'
import { CartaoDicas, type Dica } from './CartaoDicas'
import { Marca } from './Marca'
import { Configuracoes, ExcluirContaModal, ZerarDados } from './Configuracoes'
import { Questionario } from './Questionario'
import { Tour } from './Tour'

/**
 * A ordem daqui é a do menu e também a prioridade nas abas do celular (veja docs/arquitetura-do-painel.md):
 * o que se usa todo dia, depois o que tem prazo (do mais próximo ao mais distante), depois o que se constrói,
 * e por fim a retrospectiva.
 * As páginas `contas` ("Contas do mês") e `cartoes` ("Cartões") entram entre `lancamentos` e `dividas`.
 */
const PAGINAS: { id: Pagina; nome: string; curto: string; icone: string }[] = [
  { id: 'inicio', nome: 'Início', curto: 'Início', icone: 'inicio' },
  { id: 'lancamentos', nome: 'Lançamentos', curto: 'Lançamentos', icone: 'lista' },
  { id: 'contas', nome: 'Contas do mês', curto: 'Contas', icone: 'calendario' },
  { id: 'cartoes', nome: 'Cartões', curto: 'Cartões', icone: 'cartao' },
  { id: 'dividas', nome: 'Dívidas', curto: 'Dívidas', icone: 'divida' },
  { id: 'metas', nome: 'Metas', curto: 'Metas', icone: 'meta' },
  { id: 'patrimonio', nome: 'Dinheiro guardado', curto: 'Guardado', icone: 'carteira' },
  { id: 'ano', nome: 'Resumo do ano', curto: 'Ano', icone: 'ano' },
]

/** Na barra do celular cabem 5 abas; passando disso, as 4 primeiras ficam e o resto vai para "Mais". */
const MAX_ABAS = 5

const paginaDoHash = (): Pagina => {
  const h = location.hash.replace('#/', '') as Pagina
  return PAGINAS.some((p) => p.id === h) ? h : 'inicio'
}

const hoje = new Date()

export function Painel({ userId, email, nome: nomeConta, assinatura }: { userId: string; email: string; nome?: string; assinatura?: Assinatura | null }) {
  const [pagina, setPagina] = useState<Pagina>(paginaDoHash)
  const [ano, setAno] = useState(hoje.getFullYear())
  const [mes, setMes] = useState(hoje.getMonth() + 1)
  const [avisoFatura, setAvisoFatura] = useState<{ cartao: string; fechamento: number; depoisDoFechamento: boolean; ano: number; mes: number; anoCompra: number } | null>(null)
  const [form, setForm] = useState<{ inicial?: Lancamento; tipo?: Tipo; preset?: Partial<Lancamento>; cartaoId?: string } | null>(null)
  const [menu, setMenu] = useState(false)
  const [mais, setMais] = useState(false)
  const [bancoAberto, setBancoAberto] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [ajustes, setAjustes] = useState(false)
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
  const arquivo = useRef<HTMLInputElement>(null)
  // pílula que desliza até o item ativo (menu lateral e abas do celular)
  const refNav = useRef<HTMLElement>(null)
  const refAbas = useRef<HTMLElement>(null)
  const { tema } = useTema()
  const d = useDados(userId, ano)
  const contas = useContasFixas(d.setErro)
  // Baixas em andamento e uma pausa curta depois de cada uma: ao dar baixa a conta sai da lista e a de baixo sobe, então um toque
  // duplo (ou apressado) não pode cair em "Paguei" de outra conta.
  const baixando = useRef(new Set<string>())
  const esfriando = useRef(false)
  const mobile = useMobile()

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
  const lenteNav = useLente(refNav, 'button.ativo', `${paginaAtual}|${paginas.length}|${noPainel}`)
  const lenteAbas = useLente(refAbas, 'button.ativo', `${paginaAtual}|${mobile}|${paginas.length}|${noPainel}`)
  const abas = paginas.length <= MAX_ABAS ? paginas : paginas.slice(0, MAX_ABAS - 1)
  const naMais = paginas.slice(abas.length)

  // Ao trocar de mês, os blocos da página saem do desfoque de novo (mesma animação da entrada).
  const primeiraVez = useRef(true)
  useEffect(() => {
    if (primeiraVez.current) {
      primeiraVez.current = false
      return
    }
    if (semMovimento()) return
    document.querySelectorAll<HTMLElement>('.pagina > *, .kpis > *').forEach((el, i) =>
      el.animate(
        // sem desfoque em quem tem gráfico (o Safari pode deixar o canvas em branco sob filtro animado)
        el.querySelector('canvas')
          ? [{ opacity: 0.35, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }]
          : [{ opacity: 0.35, filter: 'blur(8px)', transform: 'translateY(6px)' }, { opacity: 1, filter: 'none', transform: 'none' }],
        { duration: 650, delay: Math.min(i, 6) * 35, easing: 'cubic-bezier(.32,.72,0,1)', fill: 'backwards' },
      ),
    )
  }, [mes, ano])

  const irPara = (p: Pagina) => {
    setBancoAberto(null)
    setMais(false)
    setMenu(false)
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
      const l = lancsContados.filter((x) => x.mes === m)
      const sit = situacaoDividas(dividasDevo, d.saldos, d.pagamentos, ano, m, taxas)
      const ef = mesEfetivo(d.meses, ano, m)
      const temProprio = d.meses.some((x) => x.ano === ano && x.mes === m)
      // Meses futuros sem lançamentos ficam em branco, como na planilha.
      const vazio = !l.length && !temProprio && (ano * 12 + m > agora || (!sit.length && !ef.herdadoDe))
      return { sit, ef, resumo: vazio ? null : resumoMes(l, sit, ef, taxas, idCategoria) }
    })
  }, [lancsContados, dividasDevo, d.saldos, d.pagamentos, d.meses, ano, taxas, d.categorias]) // eslint-disable-line react-hooks/exhaustive-deps
  const porMes = porMesCompleto.map((x) => x.resumo)

  const lancsMes = lancsContados.filter((l) => l.mes === mes)
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
      d.setErro(e instanceof Error ? e.message : String(e))
    } finally {
      setOcupado(null)
    }
  }

  const importar = (f: File) =>
    tarefa('Lendo a planilha…', async () => {
      // A biblioteca de planilhas é pesada; só baixa quando alguém importa ou exporta.
      const { lerPlanilha, gravarImportacao } = await import('../lib/planilha')
      const meses = await lerPlanilha(f)
      if (arquivo.current) arquivo.current.value = ''
      if (!meses.length) return alert('Não encontrei abas de mês (ex.: OUTUBRO26) com dados nessa planilha.')
      const lista = meses.map((m) => `${MESES_NOME[m.mes - 1]}/${m.ano}: ${m.lancs.length} lançamentos`).join('\n')
      if (!confirm(`Encontrei ${meses.length} meses:\n\n${lista}\n\nOs dados desses meses no app serão substituídos pelos da planilha. Quer continuar?`)) return
      setOcupado('Salvando…')
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
  const pagarConta = (s: SituacaoConta, mudancas?: { valor?: number; data?: string; cotacao?: number }) => {
    if (s.baixa || baixando.current.has(s.conta.id) || esfriando.current) return
    // Já lançou "Aluguel" à mão este mês? Em vez de lançar de novo, a pessoa pode usar esse lançamento.
    const parecido = lancamentoParecido(s.conta, d.lancs, ano, mes)
    if (parecido && confirm(`Já existe um lançamento “${parecido.descricao}” de ${fmtValor(parecido.valor)} neste mês.\n\nEle é ${s.conta.tipo === 'entrada' ? 'o recebimento' : 'o pagamento'} desta conta?\n\nOK: sim, usar ele.\nCancelar: não, lançar outro.`)) {
      esfriar()
      void d.updLanc(parecido.id, { conta_fixa_id: s.conta.id })
      return
    }
    esfriar()
    baixando.current.add(s.conta.id)
    void d.addLanc(lancamentoDaBaixa(s.conta, ano, mes, mudancas, taxas)).finally(() => baixando.current.delete(s.conta.id))
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

  // Pagar (o que você deve) ou receber (o que te devem): o valor sugerido é o atrasado ou a próxima parcela.
  const pagarDivida = (s: SituacaoDivida, valor?: number) => {
    // sem calendário nem parcela fixa, o valor fica em branco: a pessoa paga quanto puder
    const sugerido = valor ?? calendarioDe(s, diaRef)?.sugerido ?? (s.divida.valor_parcela ? Math.min(s.divida.valor_parcela, s.restante) : undefined)
    const recebe = meDevem(s.divida)
    setForm({
      preset: {
        tipo: recebe ? 'entrada' : 'saida', divida_id: s.divida.id,
        ...(recebe ? {} : { categoria_id: d.categorias.find((c) => c.papel === 'divida')?.id ?? null }),
        descricao: recebe ? `${s.divida.descricao}${s.divida.pessoa ? ` (${s.divida.pessoa})` : ''} – recebido` : `${s.divida.descricao} – parcela`,
        valor: sugerido && sugerido > 0 ? sugerido : undefined,
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
  const salvarLancamento = async (l: Omit<Lancamento, 'id'>, id?: string) => {
    if (!id) return d.addLanc(l)
    await d.updLanc(id, l)
    if (d.lancs.find((x) => x.id === id)?.cartao_id) await cartoes.recarregar()
  }

  // Contas fixas e cartões entram na Início pelos lugares reservados para eles (zona "O que fazer" e indicadores).
  const comContas = v.contas && !contas.semTabela
  const comCartoes = comFaturas
  // Indicador zerado no topo só ocupa atenção: a fatura entra quando há fatura no mês.
  const totalFaturas = comCartoes ? totalFaturasDoMes(faturas) : 0
  const comKpiContas = comContas && situacoesContas.length > 0
  const kpisExtras = comKpiContas || totalFaturas > 0 ? (
    <>
      {comKpiContas && <Kpi rotulo="Falta pagar no mês" valor={faltaPagarNoMes(situacoesContas)} cor={COR.divida} icone="calendario" aoClicar={() => irPara('contas')} />}
      {totalFaturas > 0 && <Kpi rotulo="Fatura do cartão" valor={totalFaturas} cor={COR.investimentos} icone="cartao" aoClicar={() => irPara('cartoes')} />}
    </>
  ) : undefined

  const ctx: Ctx = {
    kpisExtras,
    blocos: {
      contas: comContas ? <BlocoContasDoMes completo={perfil.detalhe === 'detalhado'} situacoes={situacoesContas} aoAbrir={() => irPara('contas')} aoPagar={pagarConta} /> : undefined,
      cartoes: comCartoes ? <BlocoCartoes situacoes={faturas} aoAbrir={() => irPara('cartoes')} /> : undefined,
    },
    busca, setBusca,
    ano, mes, d, cartoes, faturas, lancsMes, situacao, aReceber, diaRef, mesEf, porMes, mobile,
    perfil, v, taxas, sugestao,
    aceitarSugestao: (s: Sugestao) => mudarPerfil(s.aplicar(perfil)),
    recusarSugestao: (s: Sugestao) => mudarPerfil({ ...perfil, dispensadas: [...perfil.dispensadas, s.id] }),
    dispensar: (id: string) => mudarPerfil({ ...perfil, dispensadas: [...new Set([...perfil.dispensadas, id])] }),
    ligarModulo,
    personalizar: () => setAjustes(true),
    categorias: d.categorias,
    categoriaDe,
    gerenciarCategorias: () => (d.categoriasAntigas
      ? d.setErro('Para criar e editar categorias, falta atualizar o banco de dados: rode supabase/migracao-05-categorias.sql no SQL Editor do Supabase.')
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
    if (paginaAtual !== 'lancamentos') irPara('lancamentos')
  }

  // Dicas que se revezam no pé do menu lateral: primeiro o que pede atenção, depois atalhos úteis.
  const faltaDividas = situacao.reduce((a, s) => a + s.restante, 0)
  const atrasoDevo = situacao.reduce((a, s) => a + (calendarioDe(s, diaRef)?.emAtraso ?? 0), 0)
  const atrasoReceber = aReceber.reduce((a, s) => a + (calendarioDe(s, diaRef)?.emAtraso ?? 0), 0)
  const dicas: Dica[] = [
    ...(avisos.length ? [{
      id: 'contas', alerta: true, icone: 'sino', botao: 'Ver contas', acao: () => irPara('contas'),
      titulo: `${avisos.length} ${avisos.length === 1 ? 'conta pede' : 'contas pedem'} atenção.`,
    }] : []),
    ...(faturasAtrasadas.length ? [{
      id: 'faturas', alerta: true, icone: 'cartao', botao: 'Resolver', acao: () => irPara('cartoes'),
      titulo: faturasAtrasadas.length === 1
        ? `A fatura ${faturasAtrasadas[0].cartao.nome} de ${nomeDaFatura(faturasAtrasadas[0].ano, faturasAtrasadas[0].mes, ano)} venceu.`
        : `${faturasAtrasadas.length} faturas venceram sem pagar.`,
    }] : []),
    { id: 'lancar', icone: 'mais', botao: 'Lançar agora', acao: () => setForm({}), titulo: 'Lançou o que gastou hoje?' },
    ...(d.lancs.length < 40 ? [{ id: 'importar', icone: 'relatorio', botao: 'Importar extrato', acao: () => setExtrato(true), titulo: 'Tem um extrato ou planilha? Traga tudo de uma vez.' }] : []),
    ...(v.dividas && atrasoDevo > 0 ? [{
      id: 'dividas-atraso', alerta: true, icone: 'relogio', botao: 'Ver dívidas', acao: () => irPara('dividas'),
      titulo: `${fmtValor(atrasoDevo)} de parcelas atrasadas.`,
    }] : []),
    ...(v.dividas && atrasoReceber > 0 ? [{
      id: 'receber-atraso', icone: 'receber', botao: 'Cobrar', acao: () => irPara('dividas'),
      titulo: `Te devem ${fmtValor(atrasoReceber)} que já venceu.`,
    }] : []),
    ...(v.dividas && faltaDividas > 0 ? [{
      id: 'dividas', icone: 'divida', botao: 'Ver dívidas', acao: () => irPara('dividas'), titulo: `Faltam ${fmtValor(faltaDividas)} nas dívidas.`,
    }] : []),
    v.metas
      ? { id: 'metas', icone: 'meta', botao: 'Ver metas', acao: () => irPara('metas'), titulo: 'Guarde um pouco para as suas metas.' }
      : { id: 'metas', icone: 'meta', botao: 'Criar meta', acao: () => { ligarModulo('metas'); irPara('metas') }, titulo: 'Tem um sonho para juntar dinheiro?' },
    { id: 'controle', icone: 'ajustes', botao: 'Personalizar', acao: () => setAjustes(true), titulo: 'Mais controle para o seu dinheiro.' },
    {
      id: 'backup', icone: 'exportar', botao: 'Baixar backup', titulo: 'Guarde uma cópia dos seus dados.',
      acao: () => tarefa('Preparando o backup…', async () => (await import('../lib/planilha')).exportarBackup()),
    },
    {
      id: 'tema', icone: tema === 'escuro' ? 'sol' : 'lua', botao: 'Trocar tema', titulo: tema === 'escuro' ? 'Que tal o tema claro?' : 'Que tal o tema escuro?',
      acao: () => definirTema(tema === 'escuro' ? 'claro' : 'escuro', { x: 130, y: innerHeight - 110 }),
    },
  ]

  const menuItens = (
    <>
      <button onClick={() => setAjustes(true)}><Icone nome="engrenagem" /> Configurações</button>
      <button onClick={() => setTour(true)}><Icone nome="ideia" /> Ver o tutorial</button>
      <button onClick={trocarTema}><Icone nome={tema === 'escuro' ? 'sol' : 'lua'} /> {tema === 'escuro' ? 'Tema claro' : 'Tema escuro'}</button>
      <button onClick={() => setExtrato(true)}><Icone nome="relatorio" /> Importar extrato</button>
      <button onClick={() => arquivo.current?.click()}><Icone nome="importar" /> Importar planilha</button>
      <button onClick={() => tarefa('Preparando o backup…', async () => (await import('../lib/planilha')).exportarBackup())}>
        <Icone nome="exportar" /> Baixar backup
      </button>
      <button onClick={() => supabase.auth.signOut()}><Icone nome="sair" /> Sair</button>
    </>
  )

  return (
    <div className="app">
      <aside className="lateral">
        <Marca />
        <nav ref={refNav} aria-label="Páginas">
          {lenteNav && <span className="lente" aria-hidden="true" style={estiloLente(lenteNav)} />}
          {paginas.map((p) => (
            <button key={p.id} data-tour={`nav-${p.id}`} className={paginaAtual === p.id ? 'ativo' : ''} onClick={() => irPara(p.id)} aria-current={paginaAtual === p.id ? 'page' : undefined}>
              <Icone nome={p.icone} /> {p.nome}
            </button>
          ))}
          <button data-tour="nav-config" onClick={() => setAjustes(true)}><Icone nome="engrenagem" /> Configurações</button>
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
              <input type="search" placeholder="Busque por lançamentos ou categorias…" value={busca} onChange={(e) => buscar(e.target.value)} aria-label="Buscar lançamentos" />
            </label>
          )}
          <div className="barra-direita">
            {(ocupado || d.carregando) && <span className="carregando so-desktop">{ocupado ?? 'Carregando…'}</span>}
            <div className="seletor-mes">
              <button className="icone-btn" onClick={() => mudarMes(-1)} aria-label="Mês anterior"><Icone nome="esq" tamanho={18} /></button>
              <button className="seletor-mes-nome" onClick={() => setQuadroMeses(!quadroMeses)} aria-expanded={quadroMeses} aria-label="Escolher mês">
                <Icone nome="calendario" tamanho={17} />{mobile ? MESES_CURTO[mes - 1] : MESES_NOME[mes - 1]} <small>{ano}</small>
              </button>
              <button className="icone-btn" onClick={() => mudarMes(1)} aria-label="Próximo mês"><Icone nome="dir" tamanho={18} /></button>
              {quadroMeses && (
                <>
                  <div className="fora" onClick={() => setQuadroMeses(false)} />
                  <div className="quadro-meses" role="dialog" aria-label="Meses">
                    <div className="quadro-meses-ano">
                      <button className="icone-btn" onClick={() => setAno(ano - 1)} aria-label="Ano anterior"><Icone nome="esq" tamanho={16} /></button>
                      {ano}
                      <button className="icone-btn" onClick={() => setAno(ano + 1)} aria-label="Próximo ano"><Icone nome="dir" tamanho={16} /></button>
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
            <button className="icone-btn tema-btn so-desktop" onClick={trocarTema} aria-label={tema === 'escuro' ? 'Usar tema claro' : 'Usar tema escuro'} title={tema === 'escuro' ? 'Tema claro' : 'Tema escuro'}>
              <Icone nome={tema === 'escuro' ? 'sol' : 'lua'} />
            </button>
            {comContas && (
              <button className="icone-btn" onClick={() => irPara('contas')}
                aria-label={avisos.length ? `${avisos.length} ${avisos.length === 1 ? 'conta pede' : 'contas pedem'} atenção` : 'Contas do mês'}
                title={avisos.length ? `${avisos.length} ${avisos.length === 1 ? 'conta pede' : 'contas pedem'} atenção` : 'Nada atrasado'}>
                <Icone nome="sino" />
                {avisos.length > 0 && <span className={`sino-ponto ${atrasadas ? 'atraso' : ''}`} />}
              </button>
            )}
            <div className="perfil-topo">
              <button className="perfil-botao" data-tour="menu-conta" onClick={() => setMenu(!menu)} aria-expanded={menu} aria-label="Sua conta">
                <span className="avatar" aria-hidden="true">{d.foto ? <img src={d.foto} alt="" /> : iniciais || '?'}</span>
                <span>Olá, {nome}</span>
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
              <button className="icone-btn" data-tour="menu-conta" onClick={() => setMenu(!menu)} aria-label="Menu" aria-expanded={menu}><Icone nome="menu" /></button>
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

        {assinatura?.status === 'past_due' && (
          <div className="alerta" role="status">
            <span>Não conseguimos cobrar seu cartão. Atualize a forma de pagamento para não perder o acesso.</span>
            <button className="link" onClick={() => void irParaStripe('stripe-portal').then((m) => m && alert(m))}>Atualizar cartão</button>
          </div>
        )}

        {d.perfilSemTabela && (
          <div className="alerta aviso-migracao" role="status">
            Falta atualizar o banco de dados para guardar suas preferências e usar outras moedas. Rode
            {' '}<code>supabase/migracao-04-perfil-e-moedas.sql</code> no SQL Editor do Supabase.
          </div>
        )}

        {avisoFatura && (
          <div className="alerta aviso-ok" role="status">
            <span>
              {avisoFatura.depoisDoFechamento
                ? <>Compra lançada na fatura de <b>{nomeDaFatura(avisoFatura.ano, avisoFatura.mes, avisoFatura.anoCompra)}</b> do {avisoFatura.cartao}, porque a fatura anterior já fechou (dia {avisoFatura.fechamento}).</>
                : <>Compra lançada na fatura de <b>{nomeDaFatura(avisoFatura.ano, avisoFatura.mes, avisoFatura.anoCompra)}</b> do {avisoFatura.cartao}.</>}
            </span>
            <span>
              <button className="link" onClick={() => { setAno(avisoFatura.ano); setMes(avisoFatura.mes); setAvisoFatura(null); irPara('cartoes') }}>Ver fatura</button>
              {' '}<button className="link" onClick={() => setAvisoFatura(null)}>Fechar</button>
            </span>
          </div>
        )}

        {d.erro && (
          <div className="alerta" role="alert">
            <span>Não deu certo. Tente de novo. <small>Detalhe: {d.erro}</small></span>
            <button className="link" onClick={() => d.setErro(null)}>Fechar</button>
          </div>
        )}

        {paginaAtual === 'inicio' && <Inicio {...ctx} />}
        {paginaAtual === 'lancamentos' && <Lancamentos {...ctx} />}
        {paginaAtual === 'contas' && <Contas {...ctx} />}
        {paginaAtual === 'cartoes' && <Cartoes {...ctx} />}
        {paginaAtual === 'dividas' && <Dividas {...ctx} />}
        {paginaAtual === 'metas' && <Metas {...ctx} />}
        {paginaAtual === 'patrimonio' && <Patrimonio key={bancoAberto ?? 'todos'} {...ctx} />}
        {paginaAtual === 'ano' && <Ano {...ctx} />}
      </div>

      <button className="fab" data-tour="lancar" onClick={() => setForm({})} aria-label="Novo lançamento"><Icone nome="mais" tamanho={26} /></button>

      <nav className="abas-movel" ref={refAbas}>
        {lenteAbas && <span className="lente" aria-hidden="true" style={estiloLente(lenteAbas)} />}
        {abas.map((p) => (
          <button key={p.id} data-tour={`nav-${p.id}`} className={paginaAtual === p.id ? 'ativo' : ''} onClick={() => irPara(p.id)}>
            <Icone nome={p.icone} /> <span>{p.curto}</span>
          </button>
        ))}
        {naMais.length > 0 && (
          <button data-tour="mais" className={naMais.some((p) => p.id === paginaAtual) ? 'ativo' : ''} onClick={() => setMais(!mais)} aria-expanded={mais}>
            <Icone nome="reticencias" /> <span>Mais</span>
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

      {form && (
        <FormLancamento
          key={form.inicial?.id ?? form.preset?.divida_id ?? 'novo'}
          ano={ano}
          mes={mes}
          inicial={form.inicial}
          tipoInicial={form.tipo}
          preset={form.preset}
          historico={d.lancs}
          dividas={dividasAbertas}
          perfil={perfil}
          taxas={taxas}
          aoMudarPerfil={mudarPerfil}
          categorias={d.categorias}
          categoriaDe={categoriaDe}
          aoNovaCategoria={d.categoriasAntigas ? undefined : d.addCategoria}
          bancos={d.bancos}
          aoNovoBanco={d.addBanco}
          aoSalvar={(l, id) => void salvarLancamento(l, id)}
          aoExcluir={d.delLanc}
          cartoes={v.cartoes && !cartoes.semTabela ? cartoes.cartoes : undefined}
          cartaoInicial={form.cartaoId}
          aoSalvarCompra={cartoes.addCompra}
          aoExcluirCompra={cartoes.delCompra}
          comprasCartao={cartoes.compras}
          aoCompraSalva={(a) => setAvisoFatura(a)}
          aoNovoCartao={() => { setForm(null); irPara('cartoes') }}
          aoFechar={() => setForm(null)}
        />
      )}

      {ajustes && (
        <Configuracoes
          perfil={perfil}
          email={email}
          categorias={d.categorias}
          foto={d.foto}
          aoMudarFoto={(f) => void d.salvarFoto(f)}
          aoMudar={mudarPerfil}
          aoRefazer={() => { setAjustes(false); setRefazendo(true) }}
          aoTour={() => { setAjustes(false); setTour(true) }}
          aoCategorias={() => { setAjustes(false); ctx.gerenciarCategorias() }}
          aoBackup={() => tarefa('Preparando o backup…', async () => (await import('../lib/planilha')).exportarBackup())}
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
    </div>
  )
}

/** Enquanto os dados chegam: a moldura do painel com blocos que brilham, em vez de uma tela vazia. */
function Esqueleto() {
  return (
    <div className="app" aria-busy="true" aria-label="Carregando">
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
