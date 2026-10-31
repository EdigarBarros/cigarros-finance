import { Fragment, useState } from 'react'
import { COR, PALETA } from '../lib/charts'
import { calendarioDe, pedirLadoDividas, type SituacaoDivida } from '../lib/dividas'
import { fmtMoeda, fmtValor, MESES_CURTO, MESES_NOME, variacao, LOCAL_DAS_DATAS, noMeioDaFrase } from '../lib/format'
import { situacaoMeta } from '../lib/metas'
import {
  Bloco, BlocoDinheiro, BlocoDividas, BlocoGastos, BlocoLancamentos, BlocoMetas,
} from '../components/Blocos'
import { FormDivida } from '../components/Formularios'
import { GraficoFluxo } from '../components/Graficos'
import { Icone } from '../components/Icone'
import { BannerCarrossel, type Slide } from '../components/BannerCarrossel'
import { ConviteImportar } from '../components/ConviteImportar'
import { CartaoAcompanhar, CartaoSugestao } from '../components/Configuracoes'
import { Encaixe, type ItemEncaixe } from '../components/Encaixe'
import { Kpi, Progresso, ReguaMeses, type Tendencia } from '../components/ui'
import { BlocoParaFazer, ResumoSimples } from '../components/Simples'
import { BlocoConselhos } from '../components/BlocoConselhos'
import { tarefasDoMes } from '../lib/paraFazer'
import { totaisDoMes } from '../lib/contasFixas'
import type { Ctx } from './contexto'
import { tx } from '../lib/textos'

const hoje = new Date()
const hojePorExtenso = hoje.toLocaleDateString(LOCAL_DAS_DATAS, { day: 'numeric', month: 'long', year: 'numeric' })
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
  const { r, anterior: a, mobile, v } = c
  const nivel = c.perfil.detalhe
  const detalhado = nivel === 'detalhado'
  // conta nova vê a mesma boas-vindas em todos os jeitos
  const simples = nivel === 'simples' && !c.contaNova
  const [divida, setDivida] = useState<SituacaoDivida | 'nova' | null>(null)

  const abrirDivida = (s: SituacaoDivida) => setDivida(s)
  const novaDivida = () => setDivida('nova')
  const nomeMes = noMeioDaFrase(MESES_NOME[c.mes - 1])
  // Comparação só dentro do mesmo ano (em janeiro não há mês anterior).
  const mesAnt = c.mes > 1 ? noMeioDaFrase(MESES_CURTO[c.mes - 2]) : undefined
  const delta = (atual: number, antes: number | undefined) => (v.comparacao ? variacao(atual, antes) : null)
  const situacaoMetas = c.d.metas.map((m) => situacaoMeta(m, c.d.movimentosMeta))
  const mesVazio = c.lancsMes.length === 0
  const haAno = c.porMes.some(Boolean)

  // ---------- 0. Saudação ----------
  const sobrou = r.fluxo >= 0
  const animo = c.contaNova || mesVazio || simples ? '' : r.fluxo > 0 ? (' ' + tx('Você está no caminho certo! 🚀')) : r.fluxo < 0 ? (' ' + tx('Vale olhar para onde foi.')) : ''
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
        <p className="sub">{tx('Resumo de {0} de {1}.{2}', nomeMes, c.ano, animo)}</p>
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

  // ---------- 1. Como estou este mês? ----------
  // Minilinha com os valores reais dos últimos 6 meses até o aberto (a partir do equilibrado).
  const janela = Array.from({ length: Math.min(6, c.mes) }, (_, i) => c.mes - Math.min(6, c.mes) + i + 1)
  const serie = (f: (m: number) => number | null): Tendencia | undefined =>
    v.comparacao ? { valores: janela.map(f), meses: janela.map((m) => MESES_CURTO[m - 1]) } : undefined
  const tendencia = (f: (x: NonNullable<Ctx['porMes'][number]>) => number) => serie((m) => { const x = c.porMes[m - 1]; return x ? f(x) : null })

  const difAnterior = v.comparacao && !mesVazio && a && (a.entradas || a.saidas) ? r.fluxo - a.fluxo : null
  const irParaGastos = () => document.getElementById('para-onde-foi')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const fraseResultado = mesVazio ? tx('Nada lançado em {0} ainda.', nomeMes)
    : r.fluxo < 0 ? <>{tx('Saiu {0} a mais.', fmtValor(-r.fluxo))} <button className="link" onClick={irParaGastos}>{tx('Ver para onde foi')}</button></>
    : r.fluxo === 0 ? tx('Entrou e saiu o mesmo valor.')
    : tx('Você ficou com {0}% do que entrou.', Math.round((r.fluxo / r.entradas) * 100))
  const resultado = (
    <Kpi rotulo={sobrou ? tx('Sobrou em {0}', nomeMes) : tx('Faltou em {0}', nomeMes)} valor={Math.abs(r.fluxo)} icone="carteira" destaque
      cor={sobrou ? COR.entradas : COR.saidas} tendencia={tendencia((x) => x.fluxo)}>
      {difAnterior !== null && Math.abs(difAnterior) >= 0.5 ? (
        <span className={`kpi-delta ${difAnterior > 0 ? 'bom' : 'ruim'}`}>
          <Icone nome={difAnterior > 0 ? 'sobe' : 'desce'} tamanho={13} />
          {fmtValor(Math.abs(difAnterior))} {difAnterior > 0 ? tx('a mais') : tx('a menos')}<span>{tx('que em')} {mesAnt}</span>
        </span>
      ) : <span className="kpi-sub">{fraseResultado}</span>}
    </Kpi>
  )

  // Média por dia: mês aberto até hoje; mês passado inteiro.
  const diasNoMes = new Date(c.ano, c.mes, 0).getDate()
  const decorridos = c.ano === hoje.getFullYear() && c.mes === hoje.getMonth() + 1 ? hoje.getDate() : diasNoMes
  const maiorSaida = c.lancsMes.filter((l) => l.tipo === 'saida').sort((x, y) => y.valor - x.valor)[0]
  const diasDe = (m: number) => (c.ano === hoje.getFullYear() && m === hoje.getMonth() + 1 ? hoje.getDate() : new Date(c.ano, m, 0).getDate())
  const tendMedia = serie((m) => { const x = c.porMes[m - 1]; return x ? x.saidas / diasDe(m) : null })
  const tendMaior = serie((m) => {
    const saidas = c.d.lancs.filter((l) => l.mes === m && l.tipo === 'saida')
    return saidas.length ? Math.max(...saidas.map((l) => l.valor)) : null
  })
  const indicadores = [
    resultado,
    !mesVazio && <Kpi key="entrou" rotulo={tx('Entrou no mês')} valor={r.entradas} icone="receber" cor={COR.caixa} tendencia={tendencia((x) => x.entradas)} delta={delta(r.entradas, a?.entradas)} contra={mesAnt && tx('em {0}', mesAnt)} />,
    !mesVazio && <Kpi key="saiu" rotulo={tx('Saiu no mês')} valor={r.saidas} icone="enviar" cor={COR.despesas} tendencia={tendencia((x) => x.saidas)} delta={delta(r.saidas, a?.saidas)} menorMelhor contra={mesAnt && tx('em {0}', mesAnt)} />,
    c.kpisExtras,
    detalhado && !mesVazio && (
      <Kpi key="media" rotulo={tx('Gasto médio por dia')} valor={r.saidas / decorridos} cor={COR.fluxo} icone="ano" tendencia={tendMedia}>
        <span className="kpi-sub">{tx('em {0} {1}', decorridos, decorridos === 1 ? tx('dia') : tx('dias'))}</span>
      </Kpi>
    ),
    detalhado && maiorSaida && (
      <Kpi key="maior" rotulo={tx('Maior saída')} valor={maiorSaida.valor} cor={COR.saidas} icone="desce" tendencia={tendMaior}>
        <span className="kpi-sub">{maiorSaida.descricao || tx('Sem descrição')}</span>
      </Kpi>
    ),
  ]
  // A meta mais adiantada ocupa o 4º cartão quando sobra lugar na linha (como "Meta de economia" no layout).
  const metaDestaque = v.metas && !c.d.metasSemTabela
    ? situacaoMetas.filter((s) => !s.batida).sort((x, y) => y.progresso - x.progresso)[0] : undefined
  const ocupados = 1 + (mesVazio ? 0 : 2) + (c.kpisExtras ? 1 : 0)
  if (metaDestaque && ocupados < 4) {
    indicadores.push(
      <Kpi key="meta" rotulo={tx('Meta: {0}', metaDestaque.meta.nome)} valor={fmtMoeda(metaDestaque.meta.alvo, metaDestaque.meta.moeda)}
        icone="meta" cor={metaDestaque.meta.cor} aoClicar={() => c.irPara('metas')}>
        <span className="kpi-meta">
          <Progresso valor={metaDestaque.guardado} total={metaDestaque.meta.alvo} cor={metaDestaque.meta.cor} />
          <small>{Math.round(metaDestaque.progresso * 100)}%</small>
        </span>
      </Kpi>,
    )
  }
  const kpis = <div className="kpis">{zona(indicadores)}</div>

  const sugestao = c.sugestao && (
    <CartaoSugestao s={c.sugestao} aoAceitar={() => c.aceitarSugestao(c.sugestao!)} aoRecusar={() => c.recusarSugestao(c.sugestao!)} />
  )

  // Saúde do seu dinheiro: todos os conselhos ativos, logo abaixo do resumo do mês (conta nova ainda não tem o que analisar)
  const saude = !c.contaNova && (
    <BlocoConselhos conselhos={c.conselhos} semDados={c.conselhosSemDados} dispensados={c.conselhosDispensados} simples={simples}
      aoIr={c.irPara} aoDispensar={c.dispensarConselho} />
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
    <Bloco titulo={tx('Fluxo financeiro')} className="bloco-esticado"
      acao={
        <span className="legenda-topo">
          <span><i className="legenda-barra" style={{ background: PALETA.entradas[0] }} />{tx('Entrou')}</span>
          <span><i className="legenda-barra" style={{ background: PALETA.saidas[0] }} />{tx('Saiu')}</span>
          <span><i className="legenda-linha" style={{ background: PALETA.sobrou }} />{tx('Sobrou')}</span>
        </span>
      }>
      {/* o gráfico ocupa a altura que sobrar no cartão, para ficar da mesma altura que os lançamentos ao lado */}
      <div className="bloco-corpo grafico-esticado">
        <GraficoFluxo porMes={c.porMes} mesAtual={c.mes} compacto={mobile} />
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
      <div className="hero-acoes">{botoes}</div>
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
      aoFechar={() => setDivida(null)}
    />
  )

  // ---------- Jeito simples: a própria tela ----------
  if (simples) {
    const contasDoMes = v.contas ? c.situacoesContas : []
    const faturas = v.cartoes ? c.faturas : []
    const dividasAbertas = v.dividas ? c.situacao.filter((s) => s.restante > 0) : []
    const tarefas = tarefasDoMes({
      ano: c.ano, mes: c.mes, contas: contasDoMes, faturas, dividas: dividasAbertas, diaRef: c.diaRef,
      aoPagarConta: c.pagarConta, aoPagarDivida: c.pagarDivida, aoVerCartoes: () => c.irPara('cartoes'),
    })
    // só aparece quem tem algo cadastrado: sem contas, cartões nem dívidas, não há o que fazer
    const comParaFazer = contasDoMes.length > 0 || faturas.length > 0 || dividasAbertas.length > 0
    const mesAtual = c.ano === hoje.getFullYear() && c.mes === hoje.getMonth() + 1
    const contasTot = totaisDoMes(contasDoMes)
    const faltaPagar = Math.round((contasTot.faltaPagar + tarefas.parcelas) * 100) / 100
    const previsao = mesAtual && !mesVazio && (faltaPagar > 0 || contasTot.aReceber > 0) ? { faltaPagar, faltaReceber: contasTot.aReceber } : null
    const dividasResumo = v.dividas && (
      <BlocoDividas itens={c.situacao} nivel={nivel} resumo aoNova={novaDivida} aoEditar={abrirDivida} aoPagar={c.pagarDivida} aoVerTodas={() => c.irPara('dividas')} />
    )
    // no computador, duas colunas (o que fazer e o que aconteceu à esquerda; para onde foi e o que você tem à direita);
    // no celular, uma só, na ordem de `ordem`
    const esquerda = [
      comParaFazer && ['fazer', <BlocoParaFazer key="fazer" tarefas={tarefas.lista} aoVerTudo={v.contas ? () => c.irPara('contas') : undefined} />],
      !mesVazio && ['lancamentos', lancamentos],
    ].filter(Boolean) as [string, React.ReactNode][]
    const direita = [
      gastos && ['gastos', gastos],
      dividasResumo && ['dividas', dividasResumo],
      metas && ['metas', metas],
      dinheiro && ['dinheiro', dinheiro],
    ].filter(Boolean) as [string, React.ReactNode][]
    const coluna = (itens: [string, React.ReactNode][]) => itens.length > 0 && (
      <div className="simples-col">{itens.map(([k, no]) => <div key={k} className={`so so-${k}`}>{no}</div>)}</div>
    )
    return (
      <div className="pagina inicio inicio-simples">
        {saudacao}
        <ResumoSimples r={r} nomeMes={nomeMes} vazio={mesVazio} futuro={c.ano * 12 + c.mes > hoje.getFullYear() * 12 + hoje.getMonth() + 1} previsao={previsao}
          comCartao={tarefas.lista.some((t) => t.chave.startsWith('fatura:'))} acoes={botoes} aoVerGastos={irParaGastos} />
        {convite}
        {sugestao}
        {saude}
        {(esquerda.length > 0 || direita.length > 0) && (
          <div className="simples-colunas">{coluna(esquerda)}{coluna(direita)}</div>
        )}
        <p className="simples-rodape">
          {tx('Quer ver gráficos e comparar com o mês passado?')} <button className="link" onClick={c.personalizar}>{tx('Mudar o jeito de ver')}</button>
        </p>
        {formDivida}
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
            <div className="hero-acoes boas-vindas-acoes" data-tour="lancar">{botoes}</div>
          </div>
        </section>
      ) : kpis}

      {!c.contaNova && convite}

      {sugestao}

      {saude}

      {/* duas colunas que terminam juntas: os blocos se dividem e os cartões elásticos preenchem a sobra */}
      {oQueFazer.length > 0 && <Encaixe itens={oQueFazer} versao={versao} />}
      {linhaFluxo.length > 0 && <div className="linha-fluxo">{linhaFluxo}</div>}
      {analise.length > 0 && <Encaixe itens={analise} versao={versao} />}

      {formDivida}
    </div>
  )
}
