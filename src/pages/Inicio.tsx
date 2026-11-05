import { Fragment, useMemo, useState, type CSSProperties } from 'react'
import { PALETA } from '../lib/charts'
import { calendarioDe, dividaDiaADia, parcelasPorDia, pedirLadoDividas, type SituacaoDivida } from '../lib/dividas'
import { fmtValor, MESES_CURTO, moedaAtual, MESES_NOME, LOCAL_DAS_DATAS, noMeioDaFrase } from '../lib/format'
import { situacaoMeta } from '../lib/metas'
import {
  Bloco, BlocoDinheiro, BlocoDividas, BlocoGastos, BlocoLancamentos, BlocoMetas,
} from '../components/Blocos'
import { totalGuardado } from '../lib/guardado'
import { CartaoDoMes, Mosaico, NumerosDoMes, VemAi, type Peca, type Sinal } from '../components/InicioDetalhado'
import { MesEquilibrado, ResumosComAnel, type ResumoAnel } from '../components/InicioEquilibrado'
import { FormDivida } from '../components/Formularios'
import { GraficoFluxo, moedasDoAno, SeletorDoModo } from '../components/Graficos'
import { useModoDoGrafico } from '../lib/modoDoGrafico'
import { Icone } from '../components/Icone'
import { BannerCarrossel, type Slide } from '../components/BannerCarrossel'
import { ConviteImportar } from '../components/ConviteImportar'
import { CartaoAcompanhar, CartaoSugestao } from '../components/Configuracoes'
import { Encaixe, type ItemEncaixe } from '../components/Encaixe'
import { ReguaMeses, Segmentado } from '../components/ui'
import { BlocoParaFazer, ResumoSimples } from '../components/Simples'
import { BlocoConselhos } from '../components/BlocoConselhos'
import { tarefasDoMes } from '../lib/paraFazer'
import { totaisDoMes } from '../lib/contasFixas'
import type { Ctx } from './contexto'
import { tx } from '../lib/textos'
import { useHoje } from '../lib/useHoje'

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
  // muda sozinho na virada do dia (a aba pode ficar aberta de um dia para o outro)
  const hoje = useHoje()
  const hojePorExtenso = hoje.toLocaleDateString(LOCAL_DAS_DATAS, { day: 'numeric', month: 'long', year: 'numeric' })
  const hojeIso = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`
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
  const nomeMes = noMeioDaFrase(MESES_NOME[c.mes - 1])
  // Comparação só dentro do mesmo ano (em janeiro não há mês anterior).
  const mesAnt = c.mes > 1 ? noMeioDaFrase(MESES_CURTO[c.mes - 2]) : undefined
  const situacaoMetas = c.d.metas.map((m) => situacaoMeta(m, c.d.movimentosMeta))
  const mesVazio = c.lancsMes.length === 0
  const haAno = c.porMes.some(Boolean)
  // os 6 meses que o gráfico de fluxo mostra (mesma conta do GraficoFluxo)
  const inicioDoFluxo = Math.max(0, Math.min(c.mes - 6, 6))
  const janelaDoFluxo = c.previsto.slice(inicioDoFluxo, inicioDoFluxo + 6)
  // modo "O que vem aí" com saídas previstas e nenhuma entrada prevista: avisa por que não há barra verde
  const semRecebimentoPrevisto = modoDoGrafico === 'previsto' && moedaFluxo === moedaAtual() && c.v.contas && janelaDoFluxo.some((p) => p.vaiSair > 0) && !janelaDoFluxo.some((p) => p.vaiEntrar > 0)

  // ---------- 0. Saudação ----------
  // No mês de hoje os números contam só o que já aconteceu: parcela de cartão e conta com data mais para a frente ainda
  // não saíram do bolso (senão, no dia 4, o mês já aparece com as contas do dia 20 e um "faltou" que não aconteceu).
  const mesDeHoje = c.ano === hoje.getFullYear() && c.mes === hoje.getMonth() + 1
  // O mês dia a dia com as parcelas de dívida que ainda vencem nele: as três telas preveem o fim do mês com a mesma conta.
  const { ddMes, parcelasMes } = useMemo(() => {
    const dd = c.diaADia
    if (!v.dividas) return { ddMes: dd, parcelasMes: undefined }
    const parcelas = parcelasPorDia({ situacao: c.situacao, ano: c.ano, mes: c.mes, dias: dd.dias, hoje: dd.hoje, diaRef: c.diaRef })
    const total = parcelas.reduce((t, n) => t + n, 0)
    if (!total) return { ddMes: dd, parcelasMes: undefined }
    return {
      ddMes: { ...dd, vaiSair: Math.round((dd.vaiSair + total) * 100) / 100, vaiSairDia: dd.vaiSairDia.map((n, i) => n + parcelas[i]) },
      parcelasMes: parcelas,
    }
  }, [c.diaADia, c.situacao, c.ano, c.mes, c.diaRef, v.dividas])
  const entrouMes = mesDeHoje ? ddMes.entrou : r.entradas
  const saiuMes = mesDeHoje ? ddMes.saiu : r.saidas
  const fluxoMes = entrouMes - saiuMes
  const animo = c.contaNova || mesVazio || simples ? '' : fluxoMes > 0 ? (' ' + tx('Você está no caminho certo! 🚀')) : fluxoMes < 0 ? (' ' + tx('Vale olhar para onde foi.')) : ''
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

  // ---------- 1. Como estou este mês? (cada jeito tem o seu resumo do mês) ----------
  const irParaGastos = () => document.getElementById('para-onde-foi')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  // Gasto por dia: no mês de hoje, só as saídas até hoje (parcela de cartão e conta com data futura ainda não saíram do bolso)
  const diasNoMes = new Date(c.ano, c.mes, 0).getDate()
  const decorridos = mesDeHoje ? hoje.getDate() : diasNoMes
  const saidasContadas = (m: number) => (c.ano === hoje.getFullYear() && m === hoje.getMonth() + 1
    ? c.lancsAno.reduce((t, l) => (l.mes === m && l.tipo === 'saida' && (!l.data || l.data <= hojeIso) ? t + l.valor : t), 0)
    : c.porMes[m - 1]?.saidas ?? 0)

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
    <Bloco titulo={tx('Fluxo financeiro')} className="bloco-esticado"
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
      {semRecebimentoPrevisto && <p className="campo-ajuda aviso-previsao">{tx('Nenhum dinheiro previsto para entrar. Cadastre o seu salário em Contas fixas para ele aparecer aqui.')}</p>}
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

  // ritmo do gasto: por dia até hoje, comparado com o mês passado inteiro (1 = igual; null sem com o que comparar)
  const diasAnt = c.mes > 1 ? new Date(c.ano, c.mes - 1, 0).getDate() : 0
  const ritmoDoGasto = c.mes > 1 && a && a.saidas > 0 && ddMes.hoje > 0 ? (saidasContadas(c.mes) / decorridos) / (a.saidas / diasAnt) : null

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
    // No mês de hoje, só o que já aconteceu: parcela de cartão e conta com data mais para a frente vão para o "falta pagar"
    // (senão, no dia 5, o mês já aparece no vermelho com as parcelas do dia 27).
    const dd = ddMes
    const rSimples = mesAtual ? { ...r, entradas: dd.entrou, saidas: dd.saiu, fluxo: Math.round((dd.entrou - dd.saiu) * 100) / 100 } : r
    const faltaPagar = dd.vaiSair
    const faltaReceber = dd.vaiEntrar
    const previsao = mesAtual && !mesVazio && (faltaPagar > 0 || faltaReceber > 0) ? { faltaPagar, faltaReceber } : null
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
        <ResumoSimples r={rSimples} nomeMes={nomeMes} vazio={mesVazio} futuro={c.ano * 12 + c.mes > hoje.getFullYear() * 12 + hoje.getMonth() + 1} previsao={previsao}
          ateHoje={mesAtual} comCartao={!mesAtual && tarefas.lista.some((t) => t.chave.startsWith('fatura:'))} acoes={botoes} aoVerGastos={irParaGastos} />
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

  // ---------- Jeito equilibrado: o mês num olhar, os próximos 7 dias e o essencial do resto ----------
  if (nivel === 'equilibrado' && !c.contaNova) {
    const dd = ddMes
    const tarefas = tarefasDoMes({
      ano: c.ano, mes: c.mes, contas: v.contas ? c.situacoesContas : [], faturas: v.cartoes ? c.faturas : [],
      dividas: v.dividas ? c.situacao.filter((s) => s.restante > 0) : [],
      diaRef: c.diaRef, aoPagarConta: c.pagarConta, aoPagarDivida: c.pagarDivida, aoVerCartoes: () => c.irPara('cartoes'),
    })
    const comAgenda = (v.contas && c.situacoesContas.length > 0) || (v.cartoes && c.faturas.length > 0) || (v.dividas && c.situacao.some((s) => s.restante > 0))
    // no mês de hoje, só o que vence até daqui a 7 dias (o atrasado entra); nos outros meses, tudo o que está em aberto
    const daquiA7 = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 7)
    const limite7 = `${daquiA7.getFullYear()}-${String(daquiA7.getMonth() + 1).padStart(2, '0')}-${String(daquiA7.getDate()).padStart(2, '0')}`
    const agenda = comAgenda && (mesDeHoje
      ? <BlocoParaFazer tarefas={tarefas.lista.filter((t) => t.vencimento <= limite7)} titulo={tx('Próximos 7 dias')} vazio={tx('Nada vence nos próximos 7 dias.')}
          aoVerTudo={v.contas ? () => c.irPara('contas') : undefined} />
      : <BlocoParaFazer tarefas={tarefas.lista} aoVerTudo={v.contas ? () => c.irPara('contas') : undefined} />)

    const resumos: ResumoAnel[] = []
    if (v.dividas) {
      const abertas = c.situacao.filter((s) => s.restante > 0 && !s.semCotacao)
      if (abertas.length) {
        const falta = abertas.reduce((t, s) => t + s.restante, 0)
        const base = abertas.reduce((t, s) => t + Math.max(s.saldoInicial, s.restante), 0)
        resumos.push({
          chave: 'dividas', rotulo: tx('Dívidas'), valor: fmtValor(falta), cor: 'var(--divida)', icone: 'divida',
          progresso: base > 0 ? 1 - falta / base : 0, sub: tx('já pago'), aoAbrir: () => c.irPara('dividas'),
        })
      }
    }
    if (metas && situacaoMetas.length) {
      const media = situacaoMetas.reduce((t, s) => t + Math.min(1, s.progresso), 0) / situacaoMetas.length
      const frente = situacaoMetas.filter((s) => !s.batida).sort((x, y) => y.progresso - x.progresso)[0]
      resumos.push({
        chave: 'metas', rotulo: tx('Metas'), valor: situacaoMetas.length === 1 ? tx('1 meta') : tx('{0} metas', situacaoMetas.length),
        cor: 'var(--violeta)', icone: 'meta', progresso: media,
        sub: frente ? tx('{0} na frente', frente.meta.nome) : tx('Todas batidas'), aoAbrir: () => c.irPara('metas'),
      })
    }
    if (dinheiro) {
      const nb = c.d.bancos.length
      resumos.push({
        chave: 'guardado', rotulo: tx('Dinheiro guardado'), cor: 'var(--caixa)', icone: 'cofre',
        valor: fmtValor(totalGuardado({ v, bancos: c.d.bancos, caixa: c.mesEf.caixa, investimentos: r.investimentos, moedas: c.mesEf.moedas, lista: c.perfil.moedas, taxas: c.taxas })),
        sub: v.bancos && nb ? (nb === 1 ? tx('em 1 banco') : tx('em {0} bancos', nb)) : undefined, aoAbrir: () => c.irPara('patrimonio'),
      })
    }
    const gastosEq = !mesVazio && (
      <BlocoGastos r={r} anterior={a} categorias={c.categorias} nivel="simples" mesAnterior={mesAnt} aoEditar={c.gerenciarCategorias} />
    )
    const conselhoEq = (
      <BlocoConselhos conselhos={c.conselhos} semDados={c.conselhosSemDados} dispensados={c.conselhosDispensados} simples={false} limite={1}
        aoIr={c.irPara} aoDispensar={c.dispensarConselho}
        nota={{ valor: c.analise.nota, rotulo: c.analise.rotulo, tom: c.analise.tom }} aoAbrirAnalise={() => c.irPara('analise')} />
    )
    const semNada = mesVazio && !dd.vaiEntrar && !dd.vaiSair
    return (
      <div className="pagina inicio inicio-eq">
        {saudacao}
        {convite}
        {sugestao}
        <div className="ieq-cima">
          {semNada ? lancamentos : <MesEquilibrado dd={dd} nomeMes={nomeMes} ritmo={ritmoDoGasto} mesAnterior={mesAnt} />}
          {agenda}
        </div>
        <ResumosComAnel itens={resumos} />
        <div className="ieq-baixo">
          {gastosEq}
          {conselhoEq}
        </div>
        {formDivida}
      </div>
    )
  }

  // ---------- Jeito detalhado: o mês em gráfico em cima, o mosaico de peças embaixo ----------
  if (detalhado && !c.contaNova) {
    const dd = ddMes
    const contasDoMes = v.contas ? c.situacoesContas : []
    const tarefas = tarefasDoMes({
      ano: c.ano, mes: c.mes, contas: contasDoMes, faturas: v.cartoes ? c.faturas : [], dividas: v.dividas ? c.situacao.filter((s) => s.restante > 0) : [],
      diaRef: c.diaRef, aoPagarConta: c.pagarConta, aoPagarDivida: c.pagarDivida, aoVerCartoes: () => c.irPara('cartoes'),
    })
    // o mês que já acabou não tem "o que vem aí"
    const proximas = dd.hoje < dd.dias ? tarefas.lista.slice(0, 4) : []
    const pecas: Peca[] = []

    if (!mesVazio) {
      // ritmo do gasto: por dia até hoje, comparado com o mês passado inteiro
      const ritmo = ritmoDoGasto
      pecas.push({
        chave: 'gastos', icone: 'enviar', cor: 'var(--saida)', rotulo: tx('Gastos do mês'), valor: fmtValor(r.saidas),
        sub: ritmo === null ? undefined : ritmo <= 1 ? tx('gastando menos que em {0}', mesAnt) : tx('gastando mais que em {0}', mesAnt),
        sinal: ritmo === null ? undefined : ritmo <= 1 ? 'bom' : ritmo <= 1.2 ? 'atencao' : 'ruim',
        detalhe: <div className="idet-detalhe-duas">{gastos}{lancamentos}</div>,
      })
    }
    if (c.blocos?.contas) {
      const tot = totaisDoMes(contasDoMes)
      const pertoDeVencer = contasDoMes.some((s) => s.conta.tipo === 'saida' && (s.estado === 'vence_hoje' || (s.estado === 'a_vencer' && (s.diasRestantes ?? 99) <= 3)))
      const n = tot.qtdAtrasadas
      pecas.push({
        chave: 'contas', icone: 'calendario', cor: 'var(--divida)', rotulo: tx('Contas do mês'),
        valor: fmtValor(tot.faltaPagar),
        sub: n ? (n === 1 ? tx('1 atrasada') : tx('{0} atrasadas', n)) : tot.faltaPagar > 0 ? tx('falta pagar') : contasDoMes.length ? tx('tudo pago') : undefined,
        sinal: !contasDoMes.length ? undefined : n ? 'ruim' : pertoDeVencer ? 'atencao' : 'bom',
        detalhe: c.blocos.contas,
      })
    }
    if (c.blocos?.cartoes) {
      const abertas = c.faturas.filter((f) => !f.paga)
      const atrasadas = c.faturas.reduce((t, f) => t + f.atrasadas.length, 0)
      const perto = abertas.some((f) => f.valor > 0 && f.diasParaVencer >= 0 && f.diasParaVencer <= 3)
      pecas.push({
        chave: 'cartoes', icone: 'cartao', cor: 'var(--caixa)', rotulo: tx('Cartões'),
        valor: fmtValor(abertas.reduce((t, f) => t + f.valor, 0)),
        sub: atrasadas ? (atrasadas === 1 ? tx('1 fatura atrasada') : tx('{0} faturas atrasadas', atrasadas)) : c.faturas.length ? tx('fatura do mês') : undefined,
        sinal: !c.faturas.length ? undefined : atrasadas ? 'ruim' : perto ? 'atencao' : 'bom',
        detalhe: c.blocos.cartoes,
      })
    }
    if (dividas) {
      const abertas = c.situacao.filter((s) => s.restante > 0)
      const atrasadas = abertas.filter((s) => (calendarioDe(s, c.diaRef)?.emAtraso ?? 0) > 0).length
      pecas.push({
        chave: 'dividas', icone: 'divida', cor: 'var(--saida)', rotulo: tx('Dívidas'),
        valor: fmtValor(abertas.reduce((t, s) => t + s.restante, 0)),
        sub: atrasadas ? (atrasadas === 1 ? tx('1 atrasada') : tx('{0} atrasadas', atrasadas))
          : abertas.length ? (abertas.length === 1 ? tx('1 em dia') : tx('{0} em dia', abertas.length)) : tx('nenhuma em aberto'),
        sinal: atrasadas ? 'ruim' : abertas.length ? 'bom' : undefined,
        detalhe: dividas,
      })
    }
    if (dinheiro) {
      const guardado = totalGuardado({ v, bancos: c.d.bancos, caixa: c.mesEf.caixa, investimentos: r.investimentos, moedas: c.mesEf.moedas, lista: c.perfil.moedas, taxas: c.taxas })
      const nb = c.d.bancos.length
      pecas.push({
        chave: 'dinheiro', icone: 'cofre', cor: 'var(--caixa)', rotulo: tx('Dinheiro guardado'), valor: fmtValor(guardado),
        sub: v.bancos && nb ? (nb === 1 ? tx('em 1 banco') : tx('em {0} bancos', nb)) : undefined,
        sinal: guardado < 0 ? 'ruim' : undefined,
        detalhe: dinheiro,
      })
    }
    if (metas && situacaoMetas.length) {
      const media = situacaoMetas.reduce((t, s) => t + Math.min(1, s.progresso), 0) / situacaoMetas.length
      const n = situacaoMetas.length
      pecas.push({
        chave: 'metas', icone: 'meta', cor: 'var(--violeta)', rotulo: tx('Metas'), valor: `${Math.round(media * 100)}%`,
        sub: n === 1 ? tx('1 meta') : tx('{0} metas', n), progresso: media,
        sinal: 'bom' as Sinal,
        detalhe: metas,
      })
    }

    const semNada = mesVazio && !dd.vaiEntrar && !dd.vaiSair
    return (
      <div className="pagina inicio inicio-det">
        {saudacao}
        {convite}
        {sugestao}
        {semNada ? lancamentos : (
          <div className="idet-cima">
            <CartaoDoMes dd={dd} nomeMes={nomeMes} compacto={mobile} parcelasDia={parcelasMes}
              divida={v.dividas ? dividaDiaADia({ situacao: c.situacao, pagamentos: c.d.pagamentos, ano: c.ano, mes: c.mes, dias: dd.dias, hoje: dd.hoje, diaRef: c.diaRef }) : undefined} />
            <div className="idet-lado">
              <NumerosDoMes dd={dd} porDia={saidasContadas(c.mes) / decorridos} />
              <VemAi tarefas={proximas} />
            </div>
          </div>
        )}
        <Mosaico pecas={pecas} />
        {saude}
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
      ) : null}

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
