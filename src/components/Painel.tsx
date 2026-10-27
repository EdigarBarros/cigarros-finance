import { useEffect, useMemo, useRef, useState } from 'react'
import { sugestoes, type Sugestao } from '../lib/adaptacao'
import { mesEfetivo, resumoMes } from '../lib/calc'
import { categoriaDe as categoriaDoLanc } from '../lib/categorias'
import { faltaPagarNoMes, lancamentoDaBaixa, lancamentoParecido, situacoesDoMes, type SituacaoConta } from '../lib/contasFixas'
import { situacoesDoMes as situacoesDosCartoes, totalFaturasDoMes } from '../lib/cartoes'
import { COR } from '../lib/charts'
import { situacaoDividas, type SituacaoDivida } from '../lib/dividas'
import { definirMoedaPrincipal, fmtValor, MESES_CURTO, MESES_NOME } from '../lib/format'
import { useCambio } from '../lib/moedas'
import { inferirPerfil, PERFIL_PADRAO, visao } from '../lib/perfil'
import { supabase } from '../lib/supabase'
import type { Lancamento, Modulo, Perfil, Tipo } from '../lib/types'
import { useMobile } from '../lib/useMobile'
import { estiloLente, useLente } from '../lib/useLente'
import { useVidroLiquido } from '../lib/vidroLiquido'
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
import { FormLancamento } from './Formularios'
import { Kpi } from './ui'
import { Icone } from './Icone'
import { Marca } from './Marca'
import { Personalizar } from './Personalizar'
import { Questionario } from './Questionario'

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

export function Painel({ userId, email }: { userId: string; email: string }) {
  const [pagina, setPagina] = useState<Pagina>(paginaDoHash)
  const [ano, setAno] = useState(hoje.getFullYear())
  const [mes, setMes] = useState(hoje.getMonth() + 1)
  const [form, setForm] = useState<{ inicial?: Lancamento; tipo?: Tipo; preset?: Partial<Lancamento>; cartaoId?: string } | null>(null)
  const [menu, setMenu] = useState(false)
  const [mais, setMais] = useState(false)
  const [bancoAberto, setBancoAberto] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [ajustes, setAjustes] = useState(false)
  const [refazendo, setRefazendo] = useState(false)
  const [editarCategorias, setEditarCategorias] = useState(false)
  const arquivo = useRef<HTMLInputElement>(null)
  // controles flutuantes: vidro com refração líquida + lente deslizante no item ativo
  const refLateral = useRef<HTMLElement>(null)
  const refNav = useRef<HTMLElement>(null)
  const refSeletor = useRef<HTMLDivElement>(null)
  const refMeses = useRef<HTMLElement>(null)
  const refAbas = useRef<HTMLElement>(null)
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
  useVidroLiquido(refLateral, { escala: 26, bezel: 22, desfoque: 20, ativo: noPainel })
  useVidroLiquido(refSeletor, { ativo: noPainel })
  useVidroLiquido(refMeses, { ativo: noPainel })
  useVidroLiquido(refAbas, { escala: 40, bezel: 20, ativo: noPainel })
  useEffect(() => {
    if (precisaPerfil) void d.salvarPerfil(perfil)
  }, [precisaPerfil]) // eslint-disable-line react-hooks/exhaustive-deps
  definirMoedaPrincipal(perfil.moeda)
  const v = visao(perfil)
  const cartoes = useCartoes({
    ativo: v.cartoes, ano, lancsDoAno: d.lancs, categoriasAntigas: d.categoriasAntigas,
    recarregarLancs: d.recarregar, aoErro: d.setErro,
  })
  const { taxas } = useCambio(perfil.moeda, v.moedas || d.lancs.some((l) => l.moeda_original) || d.metas.some((m) => m.moeda !== perfil.moeda))
  const paginas = PAGINAS.filter((p) =>
    p.id === 'contas' ? v.contas : p.id === 'cartoes' ? v.cartoes : p.id === 'dividas' ? v.dividas : p.id === 'metas' ? v.metas : p.id === 'patrimonio' ? v.bancos || v.investimentos || v.moedas : p.id === 'ano' ? v.paginaAno : true,
  )
  const paginaAtual = paginas.some((p) => p.id === pagina) ? pagina : 'inicio'
  const categoriaDe = (l: Lancamento) => categoriaDoLanc(l, d.categorias, d.categoriasAntigas)
  const idCategoria = (l: Lancamento) => categoriaDe(l)?.id ?? ''

  useEffect(() => {
    const aoMudar = () => setPagina(paginaDoHash())
    window.addEventListener('hashchange', aoMudar)
    return () => window.removeEventListener('hashchange', aoMudar)
  }, [])
  const lenteNav = useLente(refNav, 'button.ativo', `${paginaAtual}|${paginas.length}|${noPainel}`)
  const lenteMeses = useLente(refMeses, 'button.ativo', `${mes}|${ano}|${noPainel}`)
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
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    document.querySelectorAll<HTMLElement>('.pagina > *').forEach((el, i) =>
      el.animate(
        [{ opacity: 0.35, filter: 'blur(8px)', transform: 'translateY(6px)' }, { opacity: 1, filter: 'none', transform: 'none' }],
        { duration: 650, delay: Math.min(i, 6) * 35, easing: 'cubic-bezier(.32,.72,0,1)', fill: 'backwards' },
      ),
    )
  }, [mes, ano])

  // Mantém a aba do mês aberto visível quando a barra de meses rola (celular).
  useEffect(() => {
    const aba = document.querySelector('.abas-meses .ativo') as HTMLElement | null
    const barra = aba?.parentElement
    if (aba && barra) barra.scrollTo({ left: aba.offsetLeft - barra.clientWidth / 2 + aba.clientWidth / 2, behavior: 'smooth' })
  }, [mes, pagina])

  const irPara = (p: Pagina) => {
    setBancoAberto(null)
    setMais(false)
    location.hash = `/${p}`
    setPagina(p)
    window.scrollTo({ top: 0 })
  }

  // Cada mês é calculado com dívidas e caixa contínuos: nada precisa ser copiado à mão.
  const porMesCompleto = useMemo(() => {
    const agora = hoje.getFullYear() * 12 + hoje.getMonth() + 1
    return MESES_NOME.map((_, i) => {
      const m = i + 1
      const l = d.lancs.filter((x) => x.mes === m)
      const sit = situacaoDividas(d.dividas, d.saldos, d.pagamentos, ano, m)
      const ef = mesEfetivo(d.meses, ano, m)
      const temProprio = d.meses.some((x) => x.ano === ano && x.mes === m)
      // Meses futuros sem lançamentos ficam em branco, como na planilha.
      const vazio = !l.length && !temProprio && (ano * 12 + m > agora || (!sit.length && !ef.herdadoDe))
      return { sit, ef, resumo: vazio ? null : resumoMes(l, sit, ef, taxas, idCategoria) }
    })
  }, [d.lancs, d.dividas, d.saldos, d.pagamentos, d.meses, ano, taxas, d.categorias]) // eslint-disable-line react-hooks/exhaustive-deps
  const porMes = porMesCompleto.map((x) => x.resumo)

  const lancsMes = d.lancs.filter((l) => l.mes === mes)
  const { sit: situacao, ef: mesEf } = porMesCompleto[mes - 1]
  const dividasAbertas = situacao.filter((s) => s.restante > 0).map((s) => s.divida)

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
    () => situacoesDoMes(contas.contas, d.lancs, ano, mes),
    [contas.contas, d.lancs, ano, mes],
  )
  const esfriar = () => {
    esfriando.current = true
    setTimeout(() => { esfriando.current = false }, 800)
  }
  const pagarConta = (s: SituacaoConta, mudancas?: { valor?: number; data?: string }) => {
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
    void d.addLanc(lancamentoDaBaixa(s.conta, ano, mes, mudancas)).finally(() => baixando.current.delete(s.conta.id))
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

  const pagarDivida = (s: SituacaoDivida) =>
    setForm({
      preset: {
        tipo: 'saida', categoria_id: d.categorias.find((c) => c.papel === 'divida')?.id ?? null, divida_id: s.divida.id,
        descricao: `${s.divida.descricao} – parcela`,
        valor: Math.min(s.divida.valor_parcela ?? s.restante, s.restante),
      },
    })

  const faturas = v.cartoes && !cartoes.semTabela ? situacoesDosCartoes(cartoes.cartoes, cartoes.compras, cartoes.faturasPagas, ano, mes) : []

  // Editar uma parcela pode mudá-la de ano; as compras de outros anos só são lidas de novo ao recarregar.
  const salvarLancamento = async (l: Omit<Lancamento, 'id'>, id?: string) => {
    if (!id) return d.addLanc(l)
    await d.updLanc(id, l)
    if (d.lancs.find((x) => x.id === id)?.cartao_id) await cartoes.recarregar()
  }

  // Contas fixas e cartões entram na Início pelos lugares reservados para eles (zona "O que fazer" e indicadores).
  const comContas = v.contas && !contas.semTabela
  const comCartoes = v.cartoes && !cartoes.semTabela
  const kpisExtras = (comContas && situacoesContas.length > 0) || (comCartoes && faturas.length > 0) ? (
    <>
      {comContas && situacoesContas.length > 0 && <Kpi rotulo="Falta pagar no mês" valor={fmtValor(faltaPagarNoMes(situacoesContas))} cor={COR.divida} />}
      {comCartoes && faturas.length > 0 && <Kpi rotulo="Fatura do cartão" valor={fmtValor(totalFaturasDoMes(faturas))} cor={COR.investimentos} />}
    </>
  ) : undefined

  const ctx: Ctx = {
    kpisExtras,
    blocos: {
      contas: comContas ? <BlocoContasDoMes situacoes={situacoesContas} aoAbrir={() => irPara('contas')} aoPagar={pagarConta} /> : undefined,
      cartoes: comCartoes ? <BlocoCartoes situacoes={faturas} aoAbrir={() => irPara('cartoes')} /> : undefined,
    },
    ano, mes, d, cartoes, faturas, lancsMes, situacao, mesEf, porMes, mobile,
    perfil, v, taxas, sugestao,
    aceitarSugestao: (s: Sugestao) => mudarPerfil(s.aplicar(perfil)),
    recusarSugestao: (s: Sugestao) => mudarPerfil({ ...perfil, dispensadas: [...perfil.dispensadas, s.id] }),
    ligarModulo,
    personalizar: () => setAjustes(true),
    categorias: d.categorias,
    categoriaDe,
    gerenciarCategorias: () => (d.categoriasAntigas
      ? d.setErro('Para criar e editar categorias, falta atualizar o banco de dados: rode supabase/migracao-05-categorias.sql no SQL Editor do Supabase.')
      : setEditarCategorias(true)),
    importar: () => arquivo.current?.click(),
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
  if (carregandoPerfil) return <div className="tela-central">Carregando…</div>
  if (perguntar) {
    return (
      <Questionario
        inicial={perfil}
        aoConcluir={(p) => { mudarPerfil(p); setRefazendo(false); irPara('inicio') }}
        aoCancelar={refazendo ? () => setRefazendo(false) : undefined}
      />
    )
  }

  const menuItens = (
    <>
      <button onClick={() => setAjustes(true)}><Icone nome="ajustes" /> Personalizar painel</button>
      <button onClick={() => arquivo.current?.click()}><Icone nome="importar" /> Importar planilha</button>
      <button onClick={() => tarefa('Preparando o backup…', async () => (await import('../lib/planilha')).exportarBackup())}>
        <Icone nome="exportar" /> Baixar backup
      </button>
      <button onClick={() => supabase.auth.signOut()}><Icone nome="sair" /> Sair</button>
    </>
  )

  return (
    <div className="app">
      <aside className="lateral" ref={refLateral}>
        <Marca />
        <nav ref={refNav}>
          {lenteNav && <span className="lente" aria-hidden="true" style={estiloLente(lenteNav)} />}
          {paginas.map((p) => (
            <button key={p.id} className={paginaAtual === p.id ? 'ativo' : ''} onClick={() => irPara(p.id)}>
              <Icone nome={p.icone} /> {p.nome}
            </button>
          ))}
        </nav>
        <div className="lateral-rodape">
          {menuItens}
          <span className="email">{email}</span>
        </div>
      </aside>

      <div className="conteudo">
        <header className="barra">
          {mobile && <Marca compacta />}
          <div className="seletor-mes" ref={refSeletor}>
            <button className="icone-btn" onClick={() => mudarMes(-1)} aria-label="Mês anterior"><Icone nome="esq" /></button>
            <span>{MESES_NOME[mes - 1]} <small>{ano}</small></span>
            <button className="icone-btn" onClick={() => mudarMes(1)} aria-label="Próximo mês"><Icone nome="dir" /></button>
          </div>
          <nav className="abas-meses" aria-label="Meses" ref={refMeses}>
            {lenteMeses && <span className="lente" aria-hidden="true" style={estiloLente(lenteMeses)} />}
            {MESES_NOME.map((m, i) => (
              <button
                key={m}
                className={`${i + 1 === mes ? 'ativo' : ''} ${porMes[i] ? 'com-dados' : ''}`}
                onClick={() => setMes(i + 1)}
                aria-current={i + 1 === mes ? 'page' : undefined}
              >
                {MESES_CURTO[i]}
              </button>
            ))}
          </nav>
          {(ocupado || d.carregando) && <span className="carregando">{ocupado ?? 'Carregando…'}</span>}
          <div className="menu-movel">
            <button className="icone-btn" onClick={() => setMenu(!menu)} aria-label="Menu" aria-expanded={menu}><Icone nome="menu" /></button>
            {menu && (
              <div className="menu-lista" onClick={() => setMenu(false)}>
                <span className="email">{email}</span>
                {menuItens}
              </div>
            )}
          </div>
        </header>

        {d.perfilSemTabela && (
          <div className="alerta aviso-migracao" role="status">
            Falta atualizar o banco de dados para guardar suas preferências e usar outras moedas. Rode
            {' '}<code>supabase/migracao-04-perfil-e-moedas.sql</code> no SQL Editor do Supabase.
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

      <button className="fab" onClick={() => setForm({})} aria-label="Novo lançamento"><Icone nome="mais" tamanho={26} /></button>

      <nav className="abas-movel" ref={refAbas}>
        {lenteAbas && <span className="lente" aria-hidden="true" style={estiloLente(lenteAbas)} />}
        {abas.map((p) => (
          <button key={p.id} className={paginaAtual === p.id ? 'ativo' : ''} onClick={() => irPara(p.id)}>
            <Icone nome={p.icone} /> <span>{p.curto}</span>
          </button>
        ))}
        {naMais.length > 0 && (
          <button className={naMais.some((p) => p.id === paginaAtual) ? 'ativo' : ''} onClick={() => setMais(!mais)} aria-expanded={mais}>
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
          aoNovoCartao={() => { setForm(null); irPara('cartoes') }}
          aoFechar={() => setForm(null)}
        />
      )}

      {ajustes && (
        <Personalizar
          perfil={perfil}
          aoMudar={mudarPerfil}
          aoRefazer={() => { setAjustes(false); setRefazendo(true) }}
          aoCategorias={() => { setAjustes(false); ctx.gerenciarCategorias() }}
          aoFechar={() => setAjustes(false)}
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
