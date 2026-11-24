import { EvolucaoDetalhada } from '../components/EvolucaoDetalhada'
import { Fragment, useMemo, useState, type CSSProperties } from 'react'
import { PALETA } from '../lib/charts'
import { calendarioDe, pedirLadoDividas, type SituacaoDivida } from '../lib/dividas'
import { fmtMoeda, fmtValor, MESES_CURTO, MESES_NOME, moedaAtual, LOCAL_DAS_DATAS, noMeioDaFrase } from '../lib/format'
import {
  Bloco, BlocoDinheiro, BlocoDividas, BlocoGastos, BlocoLancamentos, BlocoMetas,
} from '../components/Blocos'
import { totalGuardado } from '../lib/guardado'
import { ComparacaoDetalhada, ContasPrioritarias, Diagnostico, Panorama, TopoDetalhado, VisaoGeral, type PecaDet } from '../components/InicioDetalhadoTelas'
import {
  AteOFimEq, CabecalhoEq, ComparacaoEq, ContasEq, FaixaEq, OrientacaoEq, PilulaDoJeito, PrincipaisGastos, RegistrarEq, ResultadoEq,
  ResumosCompactos, SaudeEq, TopoEq, type ResumoCompacto,
} from '../components/InicioEquilibrado'
import { FormDivida } from '../components/Formularios'
import { GraficoFluxo, moedasDoAno, SeletorDoModo } from '../components/Graficos'
import { useModoDoGrafico } from '../lib/modoDoGrafico'
import { Icone } from '../components/Icone'
import { BannerCarrossel, type Slide } from '../components/BannerCarrossel'
import { ConviteImportar } from '../components/ConviteImportar'
import { CartaoAcompanhar, CartaoSugestao } from '../components/Configuracoes'
import { Encaixe, type ItemEncaixe } from '../components/Encaixe'
import { Modal, ReguaMeses, Segmentado } from '../components/ui'
import { InicioSimples } from '../components/InicioSimples'
import { InicioPC } from '../components/InicioPC'
import { FormBaixa } from '../components/FormBaixa'
import { BlocoConselhos } from '../components/BlocoConselhos'
import { daquiA } from '../lib/paraFazer'
import { destaqueDaComparacao, maiorCategoria } from '../lib/comparacao'
import { useMesDaInicio } from '../lib/useMesDaInicio'
import { pedirCategoriaNosLancamentos } from '../lib/busca'
import type { SituacaoConta } from '../lib/contasFixas'
import { ComparacaoMes } from '../components/ComparacaoMes'
import { EntenderMes } from '../components/EntenderMes'
import { useArrumacao } from '../lib/arrumacao'
import { useAcoesDeLancar } from '../lib/botaoMais'
import { totaisDoMes } from '../lib/contasFixas'
import type { Ctx } from './contexto'
import { tx } from '../lib/textos'
import { naHoraDaDividaNova } from '../lib/naHora'

/** Lista de blocos de uma zona, sem os que não existem. */
const zona = (xs: unknown[]) => xs.filter(Boolean).map((x, i) => <Fragment key={i}>{x as React.ReactNode}</Fragment>)
/** Blocos que existem, prontos para o encaixe. */
const itensDe = (xs: [string, React.ReactNode][]): ItemEncaixe[] => xs.filter(([, no]) => Boolean(no)).map(([chave, no]) => ({ chave, no }))
/** Cada palavra do título sai do desfoque um pouco depois da anterior. */
const palavras = (texto: string, atraso = 0) =>
  texto.split(' ').map((p, i) => (
    <span key={i} className="palavra" style={{ animationDelay: `${atraso + i * 0.09}s` }}>{i ? ` ${p}` : p}</span>
  ))

/**
 * Início, no layout do OpusCash. A ordem continua respondendo, nesta sequência: como estou este mês (saudação e
 * indicadores)? o que preciso fazer (contas, cartões, dívidas)? para onde está indo meu dinheiro (fluxo, lançamentos,
 * categorias)? e por fim o que estou construindo (metas, dinheiro guardado).
 * O equilibrado e o detalhado mostram os mesmos blocos, na mesma posição; só mudam as linhas de cada um. O simples tem
 * a sua própria tela: o mês em palavras, uma lista única do que fazer e menos números (veja docs/arquitetura-do-painel.md).
 */
export function Inicio(c: Ctx) {
  // desde 18/11/2026 o computador tem a Início no desenho do celular (faixa do topo + cartões); a conta nova continua aqui
  return c.contaNova ? <InicioDeSempre {...c} /> : <InicioPC c={c} />
}

function InicioDeSempre(c: Ctx) {
  const { r, anterior: a, mobile, v } = c
  // os números do mês (o mesmo cálculo da Início do celular): lib/useMesDaInicio.ts
  const {
    hoje, hojeIso, nomeMes, mesDeHoje, momento, ddMes, tarefas, composicao, situacao, comparacao, gastosDoPeriodo,
    atrasadasAPagar, pilulaGastos, situacaoMetas, progressoDasMetas,
  } = useMesDaInicio(c)
  const hojePorExtenso = hoje.toLocaleDateString(LOCAL_DAS_DATAS, { day: 'numeric', month: 'long', year: 'numeric' })
  const nivel = c.perfil.detalhe
  const detalhado = nivel === 'detalhado'
  // conta nova vê a mesma boas-vindas em todos os jeitos
  const simples = nivel === 'simples' && !c.contaNova
  const [divida, setDivida] = useState<SituacaoDivida | 'nova' | null>(null)
  // gráfico de fluxo em outra moeda (só há escolha quando existe algo em outra moeda no ano)
  const moedasFora = useMemo(() => moedasDoAno(c.porMes), [c.porMes])
  const [modoDoGrafico, setModoDoGrafico] = useModoDoGrafico()
  const [moedaEscolhida, setMoedaFluxo] = useState(moedaAtual())
  const moedaFluxo = moedasFora.includes(moedaEscolhida) ? moedaEscolhida : moedaAtual()

  const abrirDivida = (s: SituacaoDivida) => setDivida(s)
  const novaDivida = () => setDivida('nova')
  // Comparação só dentro do mesmo ano (em janeiro não há mês anterior).
  const mesAnt = c.mes > 1 ? noMeioDaFrase(MESES_CURTO[c.mes - 2]) : undefined
  const mesVazio = c.lancsMes.length === 0
  const haAno = c.porMes.some(Boolean)
  // os 6 meses que o gráfico de fluxo mostra (mesma conta do GraficoFluxo)
  const inicioDoFluxo = Math.max(0, Math.min(c.mes - 6, 6))
  const janelaDoFluxo = c.previsto.slice(inicioDoFluxo, inicioDoFluxo + 6)
  // modo "O que vem aí" com saídas previstas e nenhuma entrada prevista: avisa por que não há barra verde
  const semRecebimentoPrevisto = modoDoGrafico === 'previsto' && moedaFluxo === moedaAtual() && c.v.contas && janelaDoFluxo.some((p) => p.vaiSair > 0) && !janelaDoFluxo.some((p) => p.vaiEntrar > 0)

  // ---------- 0. Saudação ----------
  const [entender, setEntender] = useState(false)
  const abrirEntender = () => setEntender(true)
  const nomeDoCartao = (id?: string) => c.cartoes.cartoes.find((k) => k.id === id)?.nome ?? ''
  const janelaEntender = entender && (
    <EntenderMes situacao={situacao} composicao={composicao} nomeMes={nomeMes} dias={ddMes.dias} nomeDoCartao={nomeDoCartao} aoFechar={() => setEntender(false)} />
  )
  const [conferir, setConferir] = useState<SituacaoConta | null>(null)
  const [explorar, setExplorar] = useState(false)
  const arrumacao = useArrumacao()
  const refAcoes = useAcoesDeLancar<HTMLDivElement>()
  // a frase do mês, tirada dos números (no simples ela já está no resumo, ao lado do selo)
  const animo = c.contaNova || simples || situacao.estado === 'sem_dados' ? '' : ' ' + situacao.motivos[0].texto
  const botoes = (
    <>
      <button className="btn entrada" onClick={() => c.novoLancamento('entrada')}><Icone nome="sobe" tamanho={16} /> {tx('Lançar entrada')}</button>
      <button className="btn saida" onClick={() => c.novoLancamento('saida')}><Icone nome="desce" tamanho={16} /> {tx('Lançar saída')}</button>
    </>
  )
  const saudacao = (
    <header className="pagina-topo saudacao">
      <div>
        <h1>
          {palavras(tx('Olá,'))}
          {c.perfil.nome ? <span className="nome" translate="no">{palavras(`${c.perfil.nome}!`, 0.09)}</span> : palavras('!')}
        </h1>
        {!detalhado && <p className="sub">{tx('Resumo de {0} de {1}.{2}', nomeMes, c.ano, animo)}</p>}
      </div>
      <div className="saudacao-lado">
        <div className="data-hoje">
          <Icone nome="calendario" tamanho={22} />
          <span>{tx('Hoje')}<b>{hojePorExtenso}</b></span>
        </div>
        {!mobile && !c.contaNova && !simples && <div className="hero-acoes" data-tour="lancar">{botoes}</div>}
      </div>
    </header>
  )

  // ---------- 1. Como estou este mês? (cada jeito tem o seu resumo do mês) ----------
  // Gasto por dia: no mês de hoje, só as saídas até hoje (parcela de cartão e conta com data futura ainda não saíram do bolso)
  const diasNoMes = new Date(c.ano, c.mes, 0).getDate()
  const decorridos = mesDeHoje ? hoje.getDate() : diasNoMes
  // (no mês aberto vale o mesmo "Saiu" do quadro: compra em fatura ainda aberta não saiu do bolso)


  const sugestao = c.sugestao && (
    <CartaoSugestao s={c.sugestao} aoAceitar={() => c.aceitarSugestao(c.sugestao!)} aoRecusar={() => c.recusarSugestao(c.sugestao!)} />
  )

  // Saúde do seu dinheiro: todos os conselhos ativos, logo abaixo do resumo do mês (conta nova ainda não tem o que analisar)
  const saude = !c.contaNova && (
    <BlocoConselhos conselhos={c.conselhos} semDados={c.conselhosSemDados} dispensados={c.conselhosDispensados} simples={simples}
      aoIr={c.irPara} aoDispensar={c.dispensarConselho}
      nota={{ valor: c.analise.nota, rotulo: c.analise.rotulo, tom: c.analise.tom }} aoAbrirAnalise={() => c.irPara('analise')} />
  )

  // ---------- 2. O que preciso fazer? ----------
  // quem te deve: o total que falta receber e o que já venceu (do calendário de parcelas)
  const abertasReceber = c.aReceber.filter((s) => s.restante > 0)
  const aReceber = {
    quantos: abertasReceber.length,
    falta: abertasReceber.reduce((a, s) => a + s.restante, 0),
    atrasado: abertasReceber.reduce((a, s) => a + (calendarioDe(s, c.diaRef)?.emAtraso ?? 0), 0),
  }
  const dividas = v.dividas && (
    <BlocoDividas itens={c.situacao} nivel={nivel} aoNova={novaDivida} aoEditar={abrirDivida} aoPagar={c.pagarDivida} aoVerTodas={() => c.irPara('dividas')}
      aReceber={aReceber} aoVerReceber={() => { pedirLadoDividas('me_devem'); c.irPara('dividas') }} />
  )
  const oQueFazer = itensDe([['contas', c.blocos?.contas], ['cartoes', c.blocos?.cartoes], ['dividas', dividas]])

  // ---------- 3. Para onde está indo? ----------
  const fluxo = v.graficoAno && haAno && (
    <Bloco titulo={tx('Entrou e saiu nos últimos meses')} className="bloco-esticado"
      acao={
        <span className="legenda-topo">
          <span><i className="legenda-barra" style={{ background: PALETA.entradas[0] }} />{tx('Entrou')}</span>
          <span><i className="legenda-barra" style={{ background: PALETA.saidas[0] }} />{tx('Saiu')}</span>
          {modoDoGrafico === 'previsto' && moedaFluxo === moedaAtual() && (
            <>
              <span><i className="legenda-barra listrada" style={{ '--cor': PALETA.entradas[0] } as CSSProperties} />{tx('Vai entrar')}</span>
              <span><i className="legenda-barra listrada" style={{ '--cor': PALETA.saidas[0] } as CSSProperties} />{tx('Vai sair')}</span>
            </>
          )}
          <span><i className="legenda-linha" style={{ background: PALETA.sobrou }} />{tx('Sobrou')}</span>
          {modoDoGrafico === 'previsto' && moedaFluxo === moedaAtual() && (
            <span><i className="legenda-linha" style={{ background: `repeating-linear-gradient(90deg, ${PALETA.sobrou} 0 5px, transparent 5px 8px)` }} />{tx('Vai sobrar')}</span>
          )}
        </span>
      }>
      {/* o gráfico ocupa a altura que sobrar no cartão, para ficar da mesma altura que os lançamentos ao lado */}
      {/* só aparece quando há algo em outra moeda; a visão padrão é a da moeda principal */}
      <div className="grafico-moeda grafico-moeda-inicio">
        {moedaFluxo === moedaAtual() && <SeletorDoModo modo={modoDoGrafico} aoMudar={setModoDoGrafico} />}
        {moedasFora.length > 0 && (
          <Segmentado rotulo={tx('Ver o gráfico em')} valor={moedaFluxo} aoMudar={setMoedaFluxo}
            opcoes={[moedaAtual(), ...moedasFora].map((m) => ({ id: m, nome: m }))} />
        )}
      </div>
      {semRecebimentoPrevisto && <p className="campo-ajuda aviso-previsao">{tx('Nenhum dinheiro previsto para entrar. Cadastre o seu salário em Contas do mês para ele aparecer aqui.')}</p>}
      <div className="bloco-corpo grafico-esticado">
        <GraficoFluxo porMes={c.porMes} previsto={c.previsto} modo={modoDoGrafico} mesAtual={c.mes} compacto={mobile} moeda={moedaFluxo} />
      </div>
      {/* escolher o mês aqui troca a página inteira, como o seletor do topo */}
      <ReguaMeses mes={c.mes} comDados={c.porMes.map(Boolean)} aoEscolher={c.irParaMes} />
    </Bloco>
  )
  const lancamentos = !mesVazio ? (
    <BlocoLancamentos lancs={c.lancsMes} nivel={nivel} categoriaDe={c.categoriaDe} dividas={c.d.dividas}
      bancos={v.bancos ? c.d.bancos : undefined} aoEditar={c.editarLancamento} aoVerTodos={() => c.irPara('lancamentos')} />
  ) : !c.contaNova && (
    <section className="cartao vazio-mes">
      <h2>{tx('Comece por aqui')}</h2>
      <p>{tx('Lance o que entrou ou o que saiu em {0}. O resto do painel se monta sozinho.', nomeMes)}</p>
      <div className="hero-acoes" ref={refAcoes}>{botoes}</div>
    </section>
  )
  const linhaFluxo = zona([fluxo, lancamentos])

  // ---------- 4. Categorias, metas e o convite para planejar ----------
  const gastos = !mesVazio && (
    <BlocoGastos r={r} anterior={a} categorias={c.categorias} nivel={nivel} mesAnterior={mesAnt} aoEditar={c.gerenciarCategorias} />
  )
  const metas = v.metas && !c.d.metasSemTabela && (
    <BlocoMetas metas={situacaoMetas} taxas={c.taxas} nivel={nivel} aoAbrir={() => c.irPara('metas')} />
  )
  // Banner ilustrado: mensagens que se revezam, cada uma com a sua paisagem (só as que fazem sentido para o perfil).
  const slides: Slide[] = [
    ...(c.d.lancs.length < 40 ? [{
      id: 'importar', cena: 'cidade' as const, titulo: [tx('Seus dados'), tx('de uma vez só.')] as [string, string], texto: tx('Tem um extrato do banco ou uma planilha? Importe e pronto.'),
      botao: tx('Importar extrato'), acao: c.importarExtrato,
    }] : []),
    {
      id: 'planeje', cena: 'montanhas', titulo: [tx('Planeje hoje,'), tx('conquiste amanhã.')], texto: tx('Organize suas finanças e realize seus sonhos.'),
      ...(v.paginaAno ? { botao: tx('Ver o ano'), acao: () => c.irPara('ano') } : { botao: tx('Personalizar'), acao: c.personalizar }),
    },
    {
      id: 'viagem', cena: 'mar', titulo: [tx('Pequenos passos,'), tx('grandes viagens.')], texto: tx('Junte um pouco todo mês para a próxima viagem.'),
      botao: v.metas ? tx('Ver metas') : tx('Criar meta'), acao: () => { if (!v.metas) c.ligarModulo('metas'); c.irPara('metas') },
    },
    {
      id: 'destino', cena: 'cidade', titulo: [tx('Cada real'), tx('com um destino.')], texto: tx('Veja para onde foi o seu dinheiro este mês.'),
      botao: tx('Ver lançamentos'), acao: () => c.irPara('lancamentos'),
    },
    {
      id: 'reserva', cena: 'floresta', titulo: [tx('Reserva primeiro,'), tx('tranquilidade depois.')], texto: tx('Seis meses de gastos guardados seguram qualquer imprevisto.'),
      ...(v.bancos || v.investimentos ? { botao: tx('Dinheiro guardado'), acao: () => c.irPara('patrimonio') } : { botao: v.metas ? tx('Ver metas') : tx('Criar meta'), acao: () => { if (!v.metas) c.ligarModulo('metas'); c.irPara('metas') } }),
    },
    ...(v.dividas ? [{
      id: 'dividas', cena: 'dunas' as const, titulo: [tx('Dívida paga'), tx('é liberdade.')] as [string, string], texto: tx('Acompanhe quanto falta e quando cada uma termina.'),
      botao: tx('Ver dívidas'), acao: () => c.irPara('dividas'),
    }] : []),
  ]
  // Quem ainda tem poucos lançamentos vê o convite em destaque até dispensar.
  const convite = c.d.lancs.length < 20 && !c.perfil.dispensadas.includes('importar') && (
    <ConviteImportar aoExtrato={c.importarExtrato} aoPlanilha={c.importar} aoDispensar={() => c.dispensar('importar')} />
  )
  const banner = !mobile && !c.contaNova && <BannerCarrossel slides={slides} />

  // ---------- 5. O que tenho ----------
  const dinheiro = (v.bancos || v.investimentos || v.moedas) && (
    <BlocoDinheiro v={v} nivel={nivel} bancos={c.d.bancos} caixa={c.mesEf.caixa} investimentos={r.investimentos}
      moedas={c.mesEf.moedas} lista={c.perfil.moedas} taxas={c.taxas} lancs={c.lancsMes} herdadoDe={c.mesEf.herdadoDe}
      aoAbrir={() => c.irPara('patrimonio')} aoAbrirBanco={c.abrirBanco} />
  )
  const acompanhar = !c.contaNova && <CartaoAcompanhar perfil={c.perfil} aoLigar={c.ligarModulo} aoPersonalizar={c.personalizar} />
  const analise = itensDe([['gastos', gastos], ['metas', metas], ['dinheiro', dinheiro]])
  // Os cartões elásticos (banner e "Acompanhe mais") preenchem a sobra das colunas: o banner fica junto do
  // "O que fazer"; sem esse grupo, os dois vão para a análise.
  const elBanner: ItemEncaixe | null = banner ? { chave: 'banner', no: banner, elastico: true, fixarNasColunas: true } : null
  const elAcompanhar: ItemEncaixe | null = acompanhar ? { chave: 'acompanhar', no: acompanhar, elastico: true } : null
  if (oQueFazer.length && elBanner) oQueFazer.push(elBanner)
  else if (elBanner) analise.push(elBanner)
  if (elAcompanhar) (analise.length || !oQueFazer.length ? analise : oQueFazer).push(elAcompanhar)
  // muda quando o tamanho dos blocos muda de verdade: aí os blocos podem trocar de coluna
  const versao = [c.ano, c.mes, nivel, c.lancsMes.length, c.situacao.length, c.aReceber.length, c.situacoesContas.length, c.faturas.length, c.d.metas.length, c.categorias.length].join('|')

  const formDivida = divida && (
    <FormDivida
      ano={c.ano}
      mes={c.mes}
      naHora={(p, n, primeira) => naHoraDaDividaNova(c.analise, p, n, primeira)}
      situacao={divida === 'nova' ? undefined : divida}
      aoCriar={c.d.addDivida}
      aoEditar={c.d.updDivida}
      aoNovoSaldo={c.d.addSaldo}
          aoMudarValor={c.d.ajustarValorDivida}
          aoMoverInicio={c.d.moverInicioDivida}
          pagamentos={c.d.pagamentos}
      aoExcluir={c.d.delDivida}
      perfil={c.perfil}
      semMoeda={c.d.dividasSemMoeda}
      semJuros={c.d.dividasSemJuros}
      semAtraso={c.d.dividasSemAtraso}
      semCusto={c.d.dividasSemCusto}
      aoFechar={() => setDivida(null)}
    />
  )

  // sugestões opcionais (recursos do app): sempre depois do que é informação e aviso financeiro
  const opcionais = (convite || sugestao) && <div className="inicio-opcionais">{convite}{sugestao}</div>

  // ---------- Jeito simples: a própria tela (components/InicioSimples.tsx) ----------
  if (simples) {
    // o convite para outro jeito de ver não aparece aqui: a troca fica no "Modo simples · Alterar", no fim da tela
    const sugestaoSimples = c.sugestao && !c.sugestao.id.startsWith('detalhe:') ? sugestao : null
    return (
      <InicioSimples c={c} dd={ddMes} composicao={composicao} momento={momento} nomeMes={nomeMes} hojeIso={hojeIso} metas={situacaoMetas}
        aoEntender={abrirEntender}
        extras={<>{(convite || sugestaoSimples) && <div className="inicio-opcionais">{convite}{sugestaoSimples}</div>}{formDivida}{janelaEntender}</>} />
    )
  }

  // ---------- Jeito equilibrado: entender o mês, agir e ver o que mudou, com pouca leitura ----------
  // Três seções (docs/arquitetura-do-painel.md, 4.0.2): Visão geral (resultado, até o fim do mês e contas), Seu dinheiro em
  // perspectiva (comparação e principais gastos) e Seu próximo passo (orientação, saúde e resumos). Explicação longa e lista
  // completa abrem por toque.
  if (nivel === 'equilibrado' && !c.contaNova) {
    const dd = ddMes
    const comAgenda = (v.contas && c.situacoesContas.length > 0) || (v.cartoes && c.faturas.length > 0) || (v.dividas && c.situacao.some((s) => s.restante > 0))
    // nada é pago ao tocar: a conta abre a conferência (valor e dia), a parcela abre o lançamento já preenchido, a fatura leva aos cartões
    const agir = (t: (typeof tarefas.lista)[number]) => {
      if (t.origem === 'conta' && t.conta) setConferir(t.conta)
      else t.botao.acao()
    }
    // o que saiu até hoje, por categoria (a mesma base da comparação): existe mesmo sem mês anterior para comparar
    const periodo = comparacao ?? (momento !== 'futuro' ? gastosDoPeriodo : null)
    const principais = periodo && !mesVazio && (
      <PrincipaisGastos comp={periodo} categorias={c.categorias} momento={momento}
        aoAbrirLancamentos={(id) => { pedirCategoriaNosLancamentos(id || 'sem'); c.irPara('lancamentos') }} />
    )
    const comparar = comparacao && !mesVazio && (
      <ComparacaoEq comp={comparacao} categorias={c.categorias} atrasadas={momento === 'atual' ? atrasadasAPagar : 0} aoExplorar={() => setExplorar(true)} />
    )
    // a orientação não repete a comparação: "gastos disparando" na mesma categoria do destaque já está lá
    const destaque = destaqueDaComparacao(comparacao)
    const conselhosEq = c.conselhos.filter((k) => !(destaque && k.id === `gasto-disparou:${destaque.id}`))
    const orientacao = (
      <OrientacaoEq conselhos={conselhosEq} semDados={c.conselhosSemDados} aoIr={c.irPara} aoDispensar={c.dispensarConselho}
        todas={(
          <BlocoConselhos conselhos={conselhosEq} semDados={c.conselhosSemDados} dispensados={c.conselhosDispensados} simples={false}
            aoIr={c.irPara} aoDispensar={c.dispensarConselho} />
        )} />
    )

    const resumos: ResumoCompacto[] = []
    if (v.dividas) {
      // o mesmo critério do detalhado e do simples: o que se deve hoje, com os juros de atraso estimados (restanteHoje);
      // o "% quitado" compara o valor registrado que ainda falta com o valor inicial
      const comSaldo = c.situacao.filter((s) => !s.semCotacao)
      const falta = comSaldo.reduce((t, s) => t + s.restanteHoje, 0)
      const registrado = comSaldo.reduce((t, s) => t + s.restante, 0)
      const inicial = comSaldo.reduce((t, s) => t + s.saldoInicial, 0)
      const comJuros = falta - registrado > 0.005
      if (falta > 0) {
        const pago = inicial > 0 ? Math.max(0, Math.min(1, (inicial - registrado) / inicial)) : undefined
        resumos.push({
          chave: 'dividas', rotulo: tx('Dívidas'), valor: fmtValor(falta), cor: 'var(--divida)', icone: 'cartao',
          sub: pago !== undefined
            ? (comJuros ? tx('{0}% quitado · inclui juros de atraso estimados', Math.round(pago * 100)) : tx('{0}% quitado', Math.round(pago * 100)))
            : (comJuros ? tx('Inclui juros de atraso estimados') : undefined),
          progresso: pago, aoAbrir: () => c.irPara('dividas'),
        })
      }
    }
    if (metas && situacaoMetas.length) {
      const frente = situacaoMetas.filter((s) => !s.batida).sort((x, y) => y.progresso - x.progresso)[0]
      resumos.push({
        chave: 'metas', rotulo: frente ? tx('Meta em destaque:') : tx('Metas'), cor: 'var(--violeta)', icone: 'meta', texto: true,
        valor: frente ? frente.meta.nome : tx('Todas as metas batidas'),
        sub: frente ? tx('{0} de {1}', fmtMoeda(frente.guardado, frente.meta.moeda), fmtMoeda(frente.meta.alvo, frente.meta.moeda)) : undefined,
        progresso: frente ? frente.progresso : 1, aoAbrir: () => c.irPara('metas'),
      })
    }
    if (dinheiro) {
      const nb = c.d.bancos.length
      // o total soma o saldo dos bancos (e, ligados, investimentos e outras moedas): não é tudo dinheiro livre para gastar
      const soContas = v.bancos && !v.investimentos && !v.moedas
      resumos.push({
        chave: 'contas', rotulo: soContas ? tx('Saldo nas contas') : tx('Saldo nas contas e investimentos'), cor: 'var(--caixa)', icone: 'carteira',
        valor: fmtValor(totalGuardado({ v, bancos: c.d.bancos, caixa: c.mesEf.caixa, investimentos: r.investimentos, moedas: c.mesEf.moedas, lista: c.perfil.moedas, taxas: c.taxas })),
        sub: v.bancos && nb ? (nb === 1 ? tx('Em 1 banco') : tx('Em {0} bancos', nb)) : undefined, aoAbrir: () => c.irPara('patrimonio'),
      })
    }
    const semNada = mesVazio && !dd.vaiEntrar && !dd.vaiSair && !c.d.carregando
    const modo = <PilulaDoJeito atual="equilibrado" aoMudar={c.mudarDetalhe} />
    const registrar = <RegistrarEq aoEntrada={() => c.novoLancamento('entrada')} aoSaida={() => c.novoLancamento('saida')} aoImportar={c.importarExtrato} />
    const faturaAberta = composicao.pagar.some((g) => g.origem === 'fatura')
    const maior = maiorCategoria(periodo && !mesVazio ? periodo : null, c.categorias, nomeMes)
    const temPerspectiva = Boolean(comparar || principais)
    return (
      <div className="pagina inicio inicio-eq">
        {/* ---------- 1. Visão geral ---------- */}
        <section className="eq-secao" aria-label={tx('Visão geral')}>
          <TopoEq nome={c.perfil.nome ?? ''} modo={modo} registrar={registrar} />
          {semNada ? lancamentos : (
            <div className={`eq-duas${momento === 'atual' ? '' : ' uma'}`}>
              <ResultadoEq dd={dd} nomeMes={nomeMes} momento={momento} mesVazio={mesVazio} carregando={c.d.carregando}
                faturaAberta={faturaAberta} aoVerCalculo={abrirEntender} />
              {momento === 'atual' && <AteOFimEq dd={dd} previsaoSabe={Boolean(v.contas || v.cartoes || v.dividas)} aoVerCalculo={abrirEntender} />}
            </div>
          )}
          {/* o gráfico do ano, o mesmo da detalhada, à vista ao abrir: quem fica no jeito padrão também vê o dinheiro mês a mês */}
          {!semNada && <EvolucaoDetalhada c={c} dd={dd} />}
          {comAgenda && (
            <ContasEq tarefas={tarefas.lista} limite={mesDeHoje ? daquiA(7, hoje) : undefined} hoje={hojePorExtenso} aoAgir={agir}
              aoVerContas={v.contas ? () => c.irPara('contas') : undefined} />
          )}
        </section>

        {/* ---------- 2. Seu dinheiro em perspectiva ---------- */}
        {temPerspectiva && (
          <section className="eq-secao" aria-label={tx('Seu dinheiro em perspectiva')}>
            <CabecalhoEq modo={modo} titulo={tx('Seu dinheiro em perspectiva')} hoje={hojePorExtenso}
              sub={<>{tx('Comparativo e principais gastos')} · <b>{tx('{0} de {1}', nomeMes, c.ano)}</b></>} />
            <div className={`eq-duas eq-duas-perspectiva${comparar && principais ? '' : ' uma'}`}>{comparar}{principais}</div>
            {maior && (
              <FaixaEq titulo={maior.frase} botao={tx('Ver lançamentos')}
                acao={() => { pedirCategoriaNosLancamentos(maior.id || 'sem'); c.irPara('lancamentos') }} />
            )}
          </section>
        )}

        {/* ---------- 3. Seu próximo passo ---------- */}
        <section className="eq-secao" aria-label={tx('Seu próximo passo')}>
          <CabecalhoEq modo={modo} titulo={tx('Seu próximo passo')} sub={tx('Orientações e compromissos financeiros')} hoje={hojePorExtenso} />
          <div className="eq-duas eq-duas-passo">
            {orientacao}
            <SaudeEq nota={{ valor: c.analise.nota, rotulo: c.analise.rotulo, tom: c.analise.tom }} aoDiagnostico={() => c.irPara('analise')} />
          </div>
          <ResumosCompactos itens={resumos} />
          {v.investimentos ? (
            <FaixaEq titulo={tx('Seus investimentos')} texto={tx('Veja quanto você tem investido e quanto rendeu.')} botao={tx('Ver investimentos')}
              acao={() => c.irPara('invest')} />
          ) : (
            <FaixaEq titulo={tx('Começou a investir?')} texto={tx('Acompanhe quanto você tem investido mês a mês.')} botao={tx('Acompanhar investimentos')}
              acao={() => { c.ligarModulo('investimentos'); c.irPara('invest') }} />
          )}
        </section>

        {opcionais}
        {formDivida}
        {janelaEntender}
        {conferir && (
          <FormBaixa c={c} s={conferir} conferir aoFechar={() => setConferir(null)} />
        )}
        {explorar && comparacao && (
          <Modal titulo={tx('Comparação com o mês anterior')} aoFechar={() => setExplorar(false)} tamanho="grande">
            <ComparacaoMes comp={comparacao} categorias={c.categorias} detalhado atrasadas={momento === 'atual' ? atrasadasAPagar : 0}
              aoVerLancamentos={() => { setExplorar(false); c.irPara('lancamentos') }} />
          </Modal>
        )}
      </div>
    )
  }

  // ---------- Jeito detalhado: as seções do layout do OpusCash (components/InicioDetalhadoTelas.tsx) ----------
  if (detalhado && !c.contaNova) {
    const dd = ddMes
    const contasDoMes = v.contas ? c.situacoesContas : []
    const pecas: PecaDet[] = []

    if (!mesVazio) {
      // o mesmo "Saiu" do quadro do mês, contra o mesmo período do mês anterior (lib/comparacao.ts)
      const p = comparacao && !comparacao.semBase && comparacao.variacao !== null ? Math.round(Math.abs(comparacao.variacao) * 100) : null
      const mesAntNome = comparacao ? noMeioDaFrase(MESES_NOME[comparacao.mesAnterior - 1]) : ''
      const mesmo = comparacao?.ateDia !== null
      const sobe = (comparacao?.variacao ?? 0) > 0
      const corDoTom = pilulaGastos?.tom === 'ruim' ? 'var(--saida)' : pilulaGastos?.tom === 'atencao' ? 'var(--divida)' : 'var(--entrada)'
      pecas.push({
        chave: 'gastos', icone: 'enviar', cor: 'var(--saida)', rotulo: tx('Gastos do mês'), valor: fmtValor(ddMes.saiu),
        sub: p === null || !pilulaGastos ? undefined
          : p === 0 ? (mesmo ? tx('Igual ao mesmo período de {0}', mesAntNome) : tx('Igual a {0}', mesAntNome))
          : sobe ? (mesmo ? tx('{0}% acima do mesmo período de {1}', p, mesAntNome) : tx('{0}% acima de {1}', p, mesAntNome))
          : (mesmo ? tx('{0}% abaixo do mesmo período de {1}', p, mesAntNome) : tx('{0}% abaixo de {1}', p, mesAntNome)),
        subIcone: sobe ? 'sobe' : 'desce', subCor: corDoTom,
        // quanto do que entrou já saiu
        progresso: ddMes.entrou > 0 ? ddMes.saiu / ddMes.entrou : undefined,
        detalhe: <div className="idet-detalhe-duas">{gastos}{lancamentos}</div>,
      })
    }
    if (c.blocos?.contas) {
      const tot = totaisDoMes(contasDoMes)
      const n = tot.qtdAtrasadas
      pecas.push({
        chave: 'contas', icone: 'calendario', cor: 'var(--divida)', rotulo: tx('Contas cadastradas a pagar'), valor: fmtValor(tot.faltaPagar),
        sub: n ? (n === 1 ? tx('1 atrasada') : tx('{0} atrasadas', n)) : tx('Sem faturas e parcelas de dívidas'),
        subIcone: n ? 'alerta' : 'calendario', subCor: n ? 'var(--saida)' : 'var(--divida)',
        detalhe: c.blocos.contas,
      })
    }
    if (c.blocos?.cartoes) {
      const abertas = c.faturas.filter((f) => !f.paga)
      // como o "Em atraso" da tela Cartões: as de meses anteriores e a do próprio mês, se já venceu
      const atrasadas = c.faturas.reduce((t, f) => t + f.atrasadas.length + (f.status === 'atrasada' ? 1 : 0), 0)
      pecas.push({
        chave: 'cartoes', icone: 'cartao', cor: 'var(--caixa)', rotulo: tx('Cartões'), valor: fmtValor(abertas.reduce((t, f) => t + f.valor, 0)),
        sub: atrasadas ? (atrasadas === 1 ? tx('1 fatura atrasada') : tx('{0} faturas atrasadas', atrasadas)) : c.faturas.length ? tx('Fatura do mês') : undefined,
        subIcone: atrasadas ? 'alerta' : 'cartao', subCor: atrasadas ? 'var(--saida)' : 'var(--caixa)',
        detalhe: c.blocos.cartoes,
      })
    }
    if (dividas) {
      const abertas = c.situacao.filter((s) => s.restante > 0)
      const atrasadas = abertas.filter((s) => (calendarioDe(s, c.diaRef)?.emAtraso ?? 0) > 0).length
      pecas.push({
        chave: 'dividas', icone: 'divida', cor: 'var(--saida)', rotulo: tx('Dívidas'), valor: fmtValor(r.divida),
        sub: atrasadas ? (atrasadas === 1 ? tx('1 atrasada') : tx('{0} atrasadas', atrasadas))
          : abertas.length ? (abertas.length === 1 ? tx('1 em dia') : tx('{0} em dia', abertas.length)) : tx('nenhuma em aberto'),
        subIcone: atrasadas ? 'alerta' : 'check', subCor: atrasadas ? 'var(--saida)' : 'var(--entrada)',
        detalhe: dividas,
      })
    }
    if (dinheiro) {
      const nb = c.d.bancos.length
      pecas.push({
        chave: 'dinheiro', icone: 'cofre', cor: 'var(--caixa)', rotulo: tx('Saldo nas contas'),
        valor: Object.keys(c.mesEf.caixa).length ? fmtValor(r.caixa) : tx('Não informado'),
        sub: v.bancos && nb ? (nb === 1 ? tx('Em 1 banco') : tx('Distribuído em {0} bancos', nb)) : undefined, subIcone: 'banco', subCor: 'var(--caixa)',
        detalhe: dinheiro,
      })
    }
    if (metas && situacaoMetas.length) {
      const n = situacaoMetas.length
      pecas.push({
        chave: 'metas', icone: 'meta', cor: 'var(--violeta)', rotulo: tx('Metas'), valor: `${Math.round(progressoDasMetas * 100)}%`,
        progresso: progressoDasMetas, sub: n === 1 ? tx('1 meta cadastrada') : tx('{0} metas cadastradas', n), subIcone: 'bandeira', subCor: 'var(--violeta)',
        detalhe: metas,
      })
    }

    return (
      <div className="pagina inicio inicio-det">
        <TopoDetalhado nome={c.perfil.nome ?? ''} aoModo={c.personalizar} aoNovo={() => c.novoLancamento()} />
        {/* o gráfico do ano vem primeiro: a leitura de relance de como o dinheiro anda */}
        <EvolucaoDetalhada c={c} dd={dd} />
        <VisaoGeral dd={dd} nomeMes={nomeMes} decorridos={decorridos}
          saldoContas={v.bancos ? (Object.keys(c.mesEf.caixa).length ? r.caixa : null) : undefined}
          divida={v.dividas ? r.divida : undefined} dividaJuros={r.dividaJuros}
          aoEntender={abrirEntender}
          aoLancamentos={() => c.irPara('lancamentos')} aoPatrimonio={() => c.irPara('patrimonio')} aoDividas={() => c.irPara('dividas')} />
        <ContasPrioritarias tarefas={tarefas.lista} aoOrganizar={() => c.irPara('contas')} />
        <ComparacaoDetalhada comp={mesVazio ? null : comparacao} categorias={c.categorias} atrasadas={momento === 'atual' ? atrasadasAPagar : 0}
          aoVerLancamentos={() => c.irPara('lancamentos')} />
        <Panorama pecas={pecas} inicial={arrumacao.a.pecaFixa} aoAbrir={arrumacao.abriuPeca}
          aoCartoes={() => c.irPara('cartoes')} aoDividas={() => c.irPara('dividas')} aoGerenciar={() => c.irPara('contas')} />
        <Diagnostico analise={c.analise} conselhos={c.conselhos} semDados={c.conselhosSemDados} aoIr={c.irPara} aoDispensar={c.dispensarConselho}
          aoAnalise={() => c.irPara('analise')} />
        {opcionais}
        {arrumacao.a.pecaFixa && <button className="link dt-restaurar" onClick={arrumacao.restaurar}>{tx('Restaurar a arrumação original')}</button>}
        {formDivida}
        {janelaEntender}
      </div>
    )
  }

  return (
    <div className="pagina inicio">
      {saudacao}

      {/* conta nova: o convite vem antes de tudo, para ser a primeira coisa que a pessoa vê */}
      {c.contaNova && convite}

      {c.contaNova ? (
        <section className="boas-vindas">
          <img src="/simbolo.webp" alt="" width={84} height={41} />
          <div>
            <h2>{tx('Tudo pronto para começar')}</h2>
            <p>{tx('Lance o que entrou e o que saiu neste mês e o painel se monta sozinho. Seus dados são só seus: ninguém mais vê o que você lança aqui.')}</p>
            <div className="hero-acoes boas-vindas-acoes" data-tour="lancar" ref={refAcoes}>{botoes}</div>
          </div>
        </section>
      ) : null}

      {saude}

      {/* duas colunas que terminam juntas: os blocos se dividem e os cartões elásticos preenchem a sobra */}
      {oQueFazer.length > 0 && <Encaixe itens={oQueFazer} versao={versao} />}
      {linhaFluxo.length > 0 && <div className="linha-fluxo">{linhaFluxo}</div>}
      {analise.length > 0 && <Encaixe itens={analise} versao={versao} />}

      {!c.contaNova && opcionais}

      {formDivida}
    </div>
  )
}
