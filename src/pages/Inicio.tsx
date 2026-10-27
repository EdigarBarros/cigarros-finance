import { Fragment, useState } from 'react'
import { COR } from '../lib/charts'
import type { SituacaoDivida } from '../lib/dividas'
import { fmtValor, MESES_CURTO, MESES_NOME, variacao } from '../lib/format'
import { situacaoMeta } from '../lib/metas'
import {
  Bloco, BlocoDinheiro, BlocoDividas, BlocoGastos, BlocoLancamentos, BlocoMetas,
} from '../components/Blocos'
import { FormDivida } from '../components/Formularios'
import { GraficoAnual } from '../components/Graficos'
import { Icone } from '../components/Icone'
import { AdicionarAoPainel, CartaoSugestao } from '../components/Personalizar'
import { Kpi } from '../components/ui'
import type { Ctx } from './contexto'

const hoje = new Date()
/** Lista de blocos de uma zona, sem os que não existem. */
const zona = (xs: unknown[]) => xs.filter(Boolean).map((x, i) => <Fragment key={i}>{x as React.ReactNode}</Fragment>)

/**
 * Início. A ordem responde a três perguntas, nesta sequência: como estou este mês? o que preciso fazer?
 * para onde está indo meu dinheiro? Depois vêm a evolução do ano e o que a pessoa tem e está construindo.
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

  // ---------- 1. Como estou este mês? ----------
  const sobrou = r.fluxo >= 0
  const difAnterior = v.comparacao && !mesVazio && a && (a.entradas || a.saidas) ? r.fluxo - a.fluxo : null
  const irParaGastos = () => document.getElementById('para-onde-foi')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const fraseHero = mesVazio ? `Nada lançado em ${nomeMes} ainda.`
    : r.fluxo < 0 ? <>Saiu {fmtValor(-r.fluxo)} a mais do que entrou. <button className="link" onClick={irParaGastos}>Ver para onde foi</button></>
    : r.fluxo === 0 ? 'Entrou e saiu o mesmo valor.'
    : `Você ficou com ${Math.round((r.fluxo / r.entradas) * 100)}% do que entrou.`
  const botoes = (
    <>
      <button className="btn entrada" onClick={() => c.novoLancamento('entrada')}><Icone nome="sobe" tamanho={16} /> Lançar entrada</button>
      <button className="btn saida" onClick={() => c.novoLancamento('saida')}><Icone nome="desce" tamanho={16} /> Lançar saída</button>
    </>
  )
  const resultado = (
    <section className="hero">
      <div>
        <span className="hero-rotulo">{sobrou ? 'Sobrou' : 'Faltou'} em {nomeMes}</span>
        <strong className={`hero-valor ${sobrou ? 'positivo' : 'negativo'}`}>{fmtValor(Math.abs(r.fluxo))}</strong>
        <span className="hero-sub">{fraseHero}</span>
        {difAnterior !== null && Math.abs(difAnterior) >= 0.5 && (
          <span className={`kpi-delta hero-delta ${difAnterior > 0 ? 'bom' : 'ruim'}`}>
            <Icone nome={difAnterior > 0 ? 'sobe' : 'desce'} tamanho={12} />
            {fmtValor(Math.abs(difAnterior))} {difAnterior > 0 ? 'a mais' : 'a menos'} que em {mesAnt}
          </span>
        )}
      </div>
      {/* no celular quem lança é o botão + fixo, ao alcance do polegar */}
      {!mobile && !c.contaNova && <div className="hero-acoes">{botoes}</div>}
    </section>
  )

  // Média por dia: mês aberto até hoje; mês passado inteiro.
  const diasNoMes = new Date(c.ano, c.mes, 0).getDate()
  const decorridos = c.ano === hoje.getFullYear() && c.mes === hoje.getMonth() + 1 ? hoje.getDate() : diasNoMes
  const maiorSaida = c.lancsMes.filter((l) => l.tipo === 'saida').sort((x, y) => y.valor - x.valor)[0]
  const kpis = (!mesVazio || c.kpisExtras) && (
    <div className="kpis">
      {!mesVazio && (
        <>
          <Kpi rotulo="Entrou" valor={fmtValor(r.entradas)} cor={COR.entradas} delta={delta(r.entradas, a?.entradas)} contra={mesAnt && `em ${mesAnt}`} />
          <Kpi rotulo="Saiu" valor={fmtValor(r.saidas)} cor={COR.saidas} delta={delta(r.saidas, a?.saidas)} menorMelhor contra={mesAnt && `em ${mesAnt}`} />
        </>
      )}
      {c.kpisExtras}
      {detalhado && !mesVazio && (
        <>
          <Kpi rotulo="Gasto médio por dia" valor={fmtValor(r.saidas / decorridos)} cor={COR.fluxo}>
            <span className="kpi-sub">em {decorridos} {decorridos === 1 ? 'dia' : 'dias'}</span>
          </Kpi>
          {maiorSaida && (
            <Kpi rotulo="Maior saída" valor={fmtValor(maiorSaida.valor)} cor={COR.saidas}>
              <span className="kpi-sub">{maiorSaida.descricao || 'Sem descrição'}</span>
            </Kpi>
          )}
        </>
      )}
    </div>
  )

  const sugestao = c.sugestao && (
    <CartaoSugestao s={c.sugestao} aoAceitar={() => c.aceitarSugestao(c.sugestao!)} aoRecusar={() => c.recusarSugestao(c.sugestao!)} />
  )

  // ---------- 2. O que preciso fazer? ----------
  const dividas = v.dividas && (
    <BlocoDividas itens={c.situacao} nivel={nivel} aoNova={novaDivida} aoEditar={abrirDivida} aoPagar={c.pagarDivida} aoVerTodas={() => c.irPara('dividas')} />
  )
  const oQueFazer = zona([c.blocos?.contas, c.blocos?.cartoes, dividas])

  // ---------- 3. Para onde está indo? ----------
  const paraOndeVai = !mesVazio ? (
    <div className="duas-colunas">
      <BlocoGastos r={r} anterior={a} categorias={c.categorias} nivel={nivel} mesAnterior={mesAnt} aoEditar={c.gerenciarCategorias} />
      <BlocoLancamentos lancs={c.lancsMes} nivel={nivel} mobile={mobile} categoriaDe={c.categoriaDe}
        bancos={v.bancos ? c.d.bancos : undefined} aoEditar={c.editarLancamento} aoVerTodos={() => c.irPara('lancamentos')} />
    </div>
  ) : !c.contaNova && (
    <section className="cartao vazio-mes">
      <h2>Comece por aqui</h2>
      <p>Lance o que entrou ou o que saiu em {nomeMes}. O resto do painel se monta sozinho.</p>
      <div className="hero-acoes">{botoes}</div>
    </section>
  )

  // ---------- 4. Evolução no tempo (a partir do equilibrado) ----------
  const evolucao = v.graficoAno && haAno && (
    <Bloco titulo={`Mês a mês em ${c.ano}`} acao={<button className="link" onClick={() => c.irPara('ano')}>Ver o ano</button>}>
      <div className="bloco-corpo">
        <GraficoAnual porMes={c.porMes} mesAtual={c.mes} aoClicarMes={c.irParaMes} v={v} linhas={detalhado}
          {...(mobile ? { altura: 230, compacto: true } : { altura: 320 })} />
        {detalhado && <p className="dica">Toque num nome da legenda para mostrar ou esconder cada linha.</p>}
      </div>
    </Bloco>
  )

  // ---------- 5. O que tenho e estou construindo ----------
  const dinheiro = (v.bancos || v.investimentos || v.moedas) && (
    <BlocoDinheiro v={v} nivel={nivel} bancos={c.d.bancos} caixa={c.mesEf.caixa} investimentos={r.investimentos}
      moedas={c.mesEf.moedas} lista={c.perfil.moedas} taxas={c.taxas} lancs={c.lancsMes} herdadoDe={c.mesEf.herdadoDe}
      aoAbrir={() => c.irPara('patrimonio')} aoAbrirBanco={c.abrirBanco} />
  )
  const metas = v.metas && !c.d.metasSemTabela && (
    <BlocoMetas metas={situacaoMetas} taxas={c.taxas} nivel={nivel} aoAbrir={() => c.irPara('metas')} />
  )
  const construindo = zona([dinheiro, metas])

  return (
    <div className="pagina inicio">
      <header className="pagina-topo">
        <div>
          <h1>{c.perfil.nome ? `Olá, ${c.perfil.nome}` : 'Início'}</h1>
          <p className="sub">Resumo de {nomeMes} de {c.ano}</p>
        </div>
      </header>

      {c.contaNova ? (
        <section className="boas-vindas">
          <img src="/emblema.webp" alt="" width={56} height={56} />
          <div>
            <h2>Tudo pronto para começar</h2>
            <p>Lance o que entrou e o que saiu neste mês e o painel se monta sozinho. Seus dados são só seus: ninguém mais vê o que você lança aqui.</p>
            <div className="hero-acoes boas-vindas-acoes">{botoes}</div>
          </div>
        </section>
      ) : (
        <div className="topo-resumo">
          {resultado}
          {kpis}
        </div>
      )}

      {sugestao}

      {oQueFazer.length > 0 && <div className="zona">{oQueFazer}</div>}
      {paraOndeVai}
      {evolucao}
      {construindo.length > 0 && <div className="zona">{construindo}</div>}

      <AdicionarAoPainel perfil={c.perfil} aoLigar={c.ligarModulo} aoPersonalizar={c.personalizar} />

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
          definirParcela={divida !== 'nova' && !divida.divida.valor_parcela && !divida.quitadaNoMes}
        />
      )}
    </div>
  )
}
