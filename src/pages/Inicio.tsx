import { Fragment, useState } from 'react'
import { COR, PALETA } from '../lib/charts'
import type { SituacaoDivida } from '../lib/dividas'
import { fmtMoeda, fmtValor, MESES_CURTO, MESES_NOME, variacao } from '../lib/format'
import { situacaoMeta } from '../lib/metas'
import {
  Bloco, BlocoDinheiro, BlocoDividas, BlocoGastos, BlocoLancamentos, BlocoMetas,
} from '../components/Blocos'
import { FormDivida } from '../components/Formularios'
import { GraficoFluxo } from '../components/Graficos'
import { Icone } from '../components/Icone'
import { Marca } from '../components/Marca'
import { CartaoAcompanhar, CartaoSugestao } from '../components/Configuracoes'
import { Encaixe, type ItemEncaixe } from '../components/Encaixe'
import { Kpi, Progresso, ReguaMeses, type Tendencia } from '../components/ui'
import type { Ctx } from './contexto'

const hoje = new Date()
const hojePorExtenso = hoje.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
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
 * Os três jeitos de ver mostram os mesmos blocos, na mesma posição; só mudam as linhas de cada um
 * (veja docs/arquitetura-do-painel.md).
 */
export function Inicio(c: Ctx) {
  const { r, anterior: a, mobile, v } = c
  const nivel = c.perfil.detalhe
  const detalhado = nivel === 'detalhado'
  const [divida, setDivida] = useState<SituacaoDivida | 'nova' | null>(null)

  const abrirDivida = (s: SituacaoDivida) => setDivida(s)
  const novaDivida = () => setDivida('nova')
  const nomeMes = MESES_NOME[c.mes - 1].toLowerCase()
  // Comparação só dentro do mesmo ano (em janeiro não há mês anterior).
  const mesAnt = c.mes > 1 ? MESES_CURTO[c.mes - 2].toLowerCase() : undefined
  const delta = (atual: number, antes: number | undefined) => (v.comparacao ? variacao(atual, antes) : null)
  const situacaoMetas = c.d.metas.map((m) => situacaoMeta(m, c.d.movimentosMeta))
  const mesVazio = c.lancsMes.length === 0
  const haAno = c.porMes.some(Boolean)

  // ---------- 0. Saudação ----------
  const sobrou = r.fluxo >= 0
  const animo = c.contaNova || mesVazio ? '' : r.fluxo > 0 ? ' Você está no caminho certo! 🚀' : r.fluxo < 0 ? ' Vale olhar para onde foi.' : ''
  const botoes = (
    <>
      <button className="btn entrada" onClick={() => c.novoLancamento('entrada')}><Icone nome="sobe" tamanho={16} /> Lançar entrada</button>
      <button className="btn saida" onClick={() => c.novoLancamento('saida')}><Icone nome="desce" tamanho={16} /> Lançar saída</button>
    </>
  )
  const saudacao = (
    <header className="pagina-topo saudacao">
      <div>
        <h1>
          {palavras('Olá,')}
          {c.perfil.nome ? <span className="nome">{palavras(`${c.perfil.nome}!`, 0.09)}</span> : palavras('!')}
        </h1>
        <p className="sub">Resumo de {nomeMes} de {c.ano}.{animo}</p>
      </div>
      <div className="saudacao-lado">
        <div className="data-hoje">
          <Icone nome="calendario" tamanho={22} />
          <span>Hoje<b>{hojePorExtenso}</b></span>
        </div>
        {!mobile && !c.contaNova && <div className="hero-acoes">{botoes}</div>}
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
  const fraseResultado = mesVazio ? `Nada lançado em ${nomeMes} ainda.`
    : r.fluxo < 0 ? <>Saiu {fmtValor(-r.fluxo)} a mais. <button className="link" onClick={irParaGastos}>Ver para onde foi</button></>
    : r.fluxo === 0 ? 'Entrou e saiu o mesmo valor.'
    : `Você ficou com ${Math.round((r.fluxo / r.entradas) * 100)}% do que entrou.`
  const resultado = (
    <Kpi rotulo={`${sobrou ? 'Sobrou' : 'Faltou'} em ${nomeMes}`} valor={Math.abs(r.fluxo)} icone="carteira" destaque
      cor={sobrou ? COR.entradas : COR.saidas} tendencia={tendencia((x) => x.fluxo)}>
      {difAnterior !== null && Math.abs(difAnterior) >= 0.5 ? (
        <span className={`kpi-delta ${difAnterior > 0 ? 'bom' : 'ruim'}`}>
          <Icone nome={difAnterior > 0 ? 'sobe' : 'desce'} tamanho={13} />
          {fmtValor(Math.abs(difAnterior))} {difAnterior > 0 ? 'a mais' : 'a menos'}<span>que em {mesAnt}</span>
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
    !mesVazio && <Kpi key="entrou" rotulo="Entrou no mês" valor={r.entradas} icone="receber" cor={COR.caixa} tendencia={tendencia((x) => x.entradas)} delta={delta(r.entradas, a?.entradas)} contra={mesAnt && `em ${mesAnt}`} />,
    !mesVazio && <Kpi key="saiu" rotulo="Saiu no mês" valor={r.saidas} icone="enviar" cor={COR.despesas} tendencia={tendencia((x) => x.saidas)} delta={delta(r.saidas, a?.saidas)} menorMelhor contra={mesAnt && `em ${mesAnt}`} />,
    c.kpisExtras,
    detalhado && !mesVazio && (
      <Kpi key="media" rotulo="Gasto médio por dia" valor={r.saidas / decorridos} cor={COR.fluxo} icone="ano" tendencia={tendMedia}>
        <span className="kpi-sub">em {decorridos} {decorridos === 1 ? 'dia' : 'dias'}</span>
      </Kpi>
    ),
    detalhado && maiorSaida && (
      <Kpi key="maior" rotulo="Maior saída" valor={maiorSaida.valor} cor={COR.saidas} icone="desce" tendencia={tendMaior}>
        <span className="kpi-sub">{maiorSaida.descricao || 'Sem descrição'}</span>
      </Kpi>
    ),
  ]
  // A meta mais adiantada ocupa o 4º cartão quando sobra lugar na linha (como "Meta de economia" no layout).
  const metaDestaque = v.metas && !c.d.metasSemTabela
    ? situacaoMetas.filter((s) => !s.batida).sort((x, y) => y.progresso - x.progresso)[0] : undefined
  const ocupados = 1 + (mesVazio ? 0 : 2) + (c.kpisExtras ? 1 : 0)
  if (metaDestaque && ocupados < 4) {
    indicadores.push(
      <Kpi key="meta" rotulo={`Meta: ${metaDestaque.meta.nome}`} valor={fmtMoeda(metaDestaque.meta.alvo, metaDestaque.meta.moeda)}
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

  // ---------- 2. O que preciso fazer? ----------
  const dividas = v.dividas && (
    <BlocoDividas itens={c.situacao} nivel={nivel} aoNova={novaDivida} aoEditar={abrirDivida} aoPagar={c.pagarDivida} aoVerTodas={() => c.irPara('dividas')} />
  )
  const oQueFazer = itensDe([['contas', c.blocos?.contas], ['cartoes', c.blocos?.cartoes], ['dividas', dividas]])

  // ---------- 3. Para onde está indo? ----------
  const fluxo = v.graficoAno && haAno && (
    <Bloco titulo="Fluxo financeiro" className="bloco-esticado"
      acao={
        <span className="legenda-topo">
          <span><i className="legenda-barra" style={{ background: PALETA.entradas[0] }} />Entrou</span>
          <span><i className="legenda-barra" style={{ background: PALETA.saidas[0] }} />Saiu</span>
          <span><i className="legenda-linha" style={{ background: PALETA.sobrou }} />Sobrou</span>
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
    <BlocoLancamentos lancs={c.lancsMes} nivel={nivel} categoriaDe={c.categoriaDe}
      bancos={v.bancos ? c.d.bancos : undefined} aoEditar={c.editarLancamento} aoVerTodos={() => c.irPara('lancamentos')} />
  ) : !c.contaNova && (
    <section className="cartao vazio-mes">
      <h2>Comece por aqui</h2>
      <p>Lance o que entrou ou o que saiu em {nomeMes}. O resto do painel se monta sozinho.</p>
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
  const banner = !mobile && !c.contaNova && (
    <section className="banner">
      <svg className="montanhas" viewBox="0 0 400 200" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 150 L70 90 L120 120 L190 40 L250 105 L300 70 L400 140 L400 200 L0 200Z" fill="rgba(20,30,58,.85)" />
        <path d="M0 175 L90 125 L150 150 L230 95 L310 150 L360 128 L400 160 L400 200 L0 200Z" fill="rgba(8,13,26,.95)" />
      </svg>
      <Marca />
      <strong>Planeje hoje,<br />conquiste amanhã.</strong>
      <p>Organize suas finanças e realize seus sonhos.</p>
      {v.paginaAno
        ? <button className="btn" onClick={() => c.irPara('ano')}>Ver o ano <Icone nome="seta" tamanho={16} /></button>
        : <button className="btn" onClick={c.personalizar}>Personalizar <Icone nome="seta" tamanho={16} /></button>}
    </section>
  )

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
  const versao = [c.ano, c.mes, nivel, c.lancsMes.length, c.situacao.length, c.situacoesContas.length, c.faturas.length, c.d.metas.length, c.categorias.length].join('|')

  return (
    <div className="pagina inicio">
      {saudacao}

      {c.contaNova ? (
        <section className="boas-vindas">
          <img src="/simbolo.webp" alt="" width={84} height={41} />
          <div>
            <h2>Tudo pronto para começar</h2>
            <p>Lance o que entrou e o que saiu neste mês e o painel se monta sozinho. Seus dados são só seus: ninguém mais vê o que você lança aqui.</p>
            <div className="hero-acoes boas-vindas-acoes">{botoes}</div>
          </div>
        </section>
      ) : kpis}

      {sugestao}

      {/* duas colunas que terminam juntas: os blocos se dividem e os cartões elásticos preenchem a sobra */}
      {oQueFazer.length > 0 && <Encaixe itens={oQueFazer} versao={versao} />}
      {linhaFluxo.length > 0 && <div className="linha-fluxo">{linhaFluxo}</div>}
      {analise.length > 0 && <Encaixe itens={analise} versao={versao} />}

      {divida && (
        <FormDivida
          ano={c.ano}
          mes={c.mes}
          situacao={divida === 'nova' ? undefined : divida}
          aoCriar={c.d.addDivida}
          aoEditar={c.d.updDivida}
          aoNovoSaldo={c.d.addSaldo}
          aoExcluir={c.d.delDivida}
          aoFechar={() => setDivida(null)}
        />
      )}
    </div>
  )
}
