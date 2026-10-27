import { useState } from 'react'
import { COR } from '../lib/charts'
import type { SituacaoDivida } from '../lib/dividas'
import { fmtValor, MESES, MESES_NOME, variacao } from '../lib/format'
import { fatiasDeGastos } from '../lib/categorias'
import { situacaoMeta } from '../lib/metas'
import { converter } from '../lib/moedas'
import type { Lancamento, Tipo } from '../lib/types'
import {
  BlocoMetas, BlocoMoedas, ListaDividas, Metricas, PorBanco, QuadroCaixa, QuadroLancamentos, TabelaAnual, TabelaDividas,
} from '../components/Blocos'
import { FormDivida } from '../components/Formularios'
import { GraficoAnual, Rosca } from '../components/Graficos'
import { Icone } from '../components/Icone'
import { ItemLancamento } from '../components/ItemLancamento'
import { AdicionarAoPainel, CartaoSugestao } from '../components/Personalizar'
import { Cartao, Kpi, Segmentado, Vazio } from '../components/ui'
import type { Ctx } from './contexto'

const recentes = (ls: Lancamento[]) =>
  [...ls].sort((a, b) => (b.data ?? '').localeCompare(a.data ?? '') || (b.created_at ?? '').localeCompare(a.created_at ?? ''))

/**
 * Visão geral. Monta-se conforme o perfil: só os blocos dos módulos ligados e, no jeito "detalhado",
 * os quadros no estilo da planilha.
 */
export function Inicio(c: Ctx) {
  const { r, anterior: a, mobile, v } = c
  const [divida, setDivida] = useState<SituacaoDivida | 'nova' | null>(null)
  const [lado, setLado] = useState<Tipo>('saida')

  const entradas = c.lancsMes.filter((l) => l.tipo === 'entrada')
  const saidas = c.lancsMes.filter((l) => l.tipo === 'saida')
  const abrirDivida = (s: SituacaoDivida) => setDivida(s)
  const novaDivida = () => setDivida('nova')
  const delta = (atual: number, antes: number | undefined) => (v.comparacao ? variacao(atual, antes) : null)
  const nomeMes = MESES_NOME[c.mes - 1].toLowerCase()
  const situacaoMetas = c.d.metas.map((m) => situacaoMeta(m, c.d.movimentosMeta))

  const kpis = (
    <div className="kpis">
      <Kpi rotulo="Entrou" valor={fmtValor(r.entradas)} cor={COR.entradas} delta={delta(r.entradas, a?.entradas)} />
      <Kpi rotulo="Saiu" valor={fmtValor(r.saidas)} cor={COR.saidas} delta={delta(r.saidas, a?.saidas)} menorMelhor />
      {v.bancos && <Kpi rotulo="Guardado nas contas" valor={fmtValor(r.caixa)} cor={COR.caixa} delta={delta(r.caixa, a?.caixa)} />}
      {v.dividas && (
        <Kpi rotulo="Falta pagar" valor={fmtValor(r.divida)} cor={COR.divida} delta={delta(r.divida, a?.divida)} menorMelhor>
          {!c.situacao.length && <button className="link kpi-acao" onClick={novaDivida}>Cadastrar uma dívida</button>}
        </Kpi>
      )}
      {/* módulo recém-ligado ainda sem valor: o próprio indicador leva até onde preencher */}
      {v.investimentos && (
        <Kpi rotulo="Investido" valor={fmtValor(r.investimentos)} cor={COR.investimentos}>
          {!r.investimentos && <button className="link kpi-acao" onClick={() => c.irPara('patrimonio')}>Informar quanto tem</button>}
        </Kpi>
      )}
      {v.moedas && (
        <Kpi rotulo="Em outras moedas" valor={`≈ ${fmtValor(r.moedasConvertido)}`} cor={COR.usd}>
          {!r.moedasConvertido && <button className="link kpi-acao" onClick={() => c.irPara('patrimonio')}>Informar quanto tem</button>}
        </Kpi>
      )}
      {v.metas && situacaoMetas.length > 0 && (
        <Kpi rotulo="Guardado nas metas" valor={fmtValor(situacaoMetas.reduce((t, x) => t + (converter(x.guardado, x.meta.moeda, c.taxas) ?? 0), 0))} cor={COR.investimentos} />
      )}
    </div>
  )

  const caixa = v.bancos && (
    <QuadroCaixa caixa={c.mesEf.caixa} bancos={c.d.bancos} total={r.caixa} herdadoDe={c.mesEf.herdadoDe} compacto={mobile || !v.planilha} aoAbrir={() => c.irPara('patrimonio')} />
  )
  const porBanco = v.bancos && c.d.bancos.length > 0 && (
    <PorBanco bancos={c.d.bancos} lancs={c.lancsMes} caixa={c.mesEf.caixa} aoAbrir={c.abrirBanco} />
  )
  const moedas = v.moedas && (
    <BlocoMoedas moedas={c.mesEf.moedas} lista={c.perfil.moedas} taxas={c.taxas} aoAbrir={() => c.irPara('patrimonio')} />
  )
  const metas = v.metas && !c.d.metasSemTabela && (
    <BlocoMetas metas={situacaoMetas} taxas={c.taxas} aoAbrir={() => c.irPara('metas')} />
  )
  const dividas = v.dividas && (
    v.planilha && !mobile
      ? <TabelaDividas itens={c.situacao} aoNova={novaDivida} aoEditar={abrirDivida} aoPagar={c.pagarDivida} />
      : <ListaDividas itens={c.situacao} aoEditar={abrirDivida} aoPagar={c.pagarDivida} aoNova={novaDivida} />
  )
  const grafico = (compacto: boolean) => v.graficoAno && (
    <Cartao titulo={`Evolução de ${c.ano}`} acao={!compacto && <span className="dica-cab">toque num mês para abrir</span>}>
      <GraficoAnual porMes={c.porMes} mesAtual={c.mes} aoClicarMes={c.irParaMes} v={v} {...(compacto ? { altura: 260, compacto } : {})} />
    </Cartao>
  )
  const tabelaAno = v.planilha && (
    <Cartao titulo={`Resumo de ${c.ano}`}>
      <TabelaAnual porMes={c.porMes} mesAtual={c.mes} aoClicarMes={c.irParaMes} v={v} />
    </Cartao>
  )

  // ---------- jeito simples e equilibrado: listas e um gráfico de categorias ----------
  const fatias = fatiasDeGastos(r.gastosPorCategoria, c.categorias)
  const essencial = (
    <>
      <div className="duas-colunas">
        <Cartao titulo="Últimos lançamentos" acao={c.lancsMes.length > 0 && <button className="link" onClick={() => c.irPara('lancamentos')}>Ver todos</button>}>
          {c.lancsMes.length ? (
            <ul className="lista-lanc">
              {recentes(c.lancsMes).slice(0, 6).map((l) => (
                <ItemLancamento key={l.id} l={l} categoria={c.categoriaDe(l)} banco={v.bancos ? c.d.bancos.find((b) => b.id === l.banco_id) : undefined}
                  aoClicar={() => c.editarLancamento(l)} />
              ))}
            </ul>
          ) : (
            <Vazio>
              Nada lançado em {nomeMes} ainda.<br />
              <button className="link" onClick={() => c.novoLancamento('entrada')}>Lançar uma entrada</button> ou{' '}
              <button className="link" onClick={() => c.novoLancamento('saida')}>uma saída</button>
            </Vazio>
          )}
        </Cartao>
        <Cartao titulo="Para onde foi o dinheiro" acao={<button className="link" onClick={c.gerenciarCategorias}>Categorias</button>}>
          {fatias.length ? <Rosca fatias={fatias} /> : <Vazio>Quando você lançar saídas, aparece aqui em que você mais gasta.</Vazio>}
        </Cartao>
      </div>
      {grafico(mobile)}
      {(dividas || porBanco || caixa || moedas || metas) && (
        <div className="duas-colunas">
          {dividas}
          {porBanco}
          {caixa}
          {moedas}
          {metas}
        </div>
      )}
    </>
  )

  // ---------- jeito detalhado: os quadros da planilha ----------
  const completo = mobile ? (
    <>
      {grafico(true)}
      <Metricas r={r} mes={c.mes} categorias={c.categorias} aoEditar={c.gerenciarCategorias} />
      <section className="pilha">
        <Segmentado
          rotulo="Mostrar"
          valor={lado}
          aoMudar={setLado}
          opcoes={[
            { id: 'saida', nome: `Saídas · ${fmtValor(r.saidas)}`, cor: COR.saidas },
            { id: 'entrada', nome: `Entradas · ${fmtValor(r.entradas)}`, cor: COR.entradas },
          ]}
        />
        <QuadroLancamentos key={lado} tipo={lado} itens={lado === 'saida' ? saidas : entradas} limite={6}
          aoNovo={() => c.novoLancamento(lado)} aoEditar={c.editarLancamento} categoriaDe={c.categoriaDe} />
      </section>
      {dividas}
      {porBanco}
      {caixa}
      {moedas}
          {metas}
      {tabelaAno}
    </>
  ) : (
    <>
      <div className="duas-colunas">
        <QuadroLancamentos tipo="entrada" itens={entradas} aoNovo={() => c.novoLancamento('entrada')} aoEditar={c.editarLancamento} categoriaDe={c.categoriaDe} />
        <QuadroLancamentos tipo="saida" itens={saidas} aoNovo={() => c.novoLancamento('saida')} aoEditar={c.editarLancamento} categoriaDe={c.categoriaDe} />
      </div>
      {grafico(false)}
      <div className="duas-colunas">
        <div className="pilha">
          {dividas}
          {porBanco}
          {caixa}
          {moedas}
          {metas}
        </div>
        <Metricas r={r} mes={c.mes} categorias={c.categorias} aoEditar={c.gerenciarCategorias} />
      </div>
      {tabelaAno}
    </>
  )

  return (
    <div className="pagina">
      <header className="pagina-topo">
        <div>
          <h1>{c.perfil.nome ? `Olá, ${c.perfil.nome}` : 'Visão geral'}</h1>
          <p className="sub">{MESES_NOME[c.mes - 1]} de {c.ano}</p>
        </div>
      </header>
      {c.contaNova && (
        <section className="boas-vindas">
          <img src="/emblema.webp" alt="" width={56} height={56} />
          <div>
            <h2>Seu painel está pronto</h2>
            <p>Seus dados são só seus: ninguém mais vê o que você lança aqui. Para começar, lance o que entrou e o que saiu este mês. O botão <b>+</b> fica sempre à mão.</p>
            <div className="hero-acoes boas-vindas-acoes">
              <button className="btn entrada" onClick={() => c.novoLancamento('entrada')}><Icone nome="sobe" tamanho={16} /> Lançar entrada</button>
              <button className="btn saida" onClick={() => c.novoLancamento('saida')}><Icone nome="desce" tamanho={16} /> Lançar saída</button>
            </div>
          </div>
        </section>
      )}
      {c.sugestao && <CartaoSugestao s={c.sugestao} aoAceitar={() => c.aceitarSugestao(c.sugestao!)} aoRecusar={() => c.recusarSugestao(c.sugestao!)} />}
      <section className="hero">
        <div>
          <span className="hero-rotulo">{v.planilha ? `Fluxo de caixa · ${MESES[c.mes - 1]}/${c.ano}` : `Resultado de ${nomeMes}`}</span>
          <strong className={`hero-valor ${r.fluxo < 0 ? 'negativo' : 'positivo'}`}>{fmtValor(r.fluxo)}</strong>
          <span className="hero-sub">
            {r.entradas === 0 && r.saidas === 0
              ? `Nada lançado em ${nomeMes} ainda.`
              : r.fluxo < 0 ? `Saiu ${fmtValor(-r.fluxo)} a mais do que entrou.` : `Sobrou ${fmtValor(r.fluxo)} no mês.`}
            {v.dividas && r.divida > 0 && ` Dívidas: ${fmtValor(r.divida)}.`}
          </span>
        </div>
        {!mobile && (
          <div className="hero-acoes">
            <button className="btn entrada" onClick={() => c.novoLancamento('entrada')}><Icone nome="sobe" tamanho={16} /> Entrada</button>
            <button className="btn saida" onClick={() => c.novoLancamento('saida')}><Icone nome="desce" tamanho={16} /> Saída</button>
          </div>
        )}
      </section>

      {kpis}

      {v.planilha ? completo : essencial}

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
        />
      )}
    </div>
  )
}
