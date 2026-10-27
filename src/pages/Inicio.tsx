import { useState } from 'react'
import { COR } from '../lib/charts'
import type { SituacaoDivida } from '../lib/dividas'
import { fmtBRL, fmtUSD, MESES, MESES_NOME, variacao } from '../lib/format'
import type { Tipo } from '../lib/types'
import { ListaDividas, Metricas, PorBanco, QuadroCaixa, QuadroLancamentos, TabelaAnual, TabelaDividas } from '../components/Blocos'
import { FormDivida } from '../components/Formularios'
import { GraficoAnual } from '../components/Graficos'
import { Icone } from '../components/Icone'
import { Cartao, Kpi, Progresso, Segmentado } from '../components/ui'
import type { Ctx } from './contexto'

export function Inicio(c: Ctx) {
  const { r, anterior: a, mobile } = c
  const [divida, setDivida] = useState<SituacaoDivida | 'nova' | null>(null)
  const [lado, setLado] = useState<Tipo>('saida')

  const entradas = c.lancsMes.filter((l) => l.tipo === 'entrada')
  const saidas = c.lancsMes.filter((l) => l.tipo === 'saida')
  const abrirDivida = (s: SituacaoDivida) => setDivida(s)
  const novaDivida = () => setDivida('nova')

  const kpis = (
    <div className="kpis">
      <Kpi rotulo="Entradas" valor={fmtBRL(r.entradas)} cor={COR.entradas} delta={variacao(r.entradas, a?.entradas)} />
      <Kpi rotulo="Saídas" valor={fmtBRL(r.saidas)} cor={COR.saidas} delta={variacao(r.saidas, a?.saidas)} menorMelhor />
      <Kpi rotulo="Caixa" valor={fmtBRL(r.caixa)} cor={COR.caixa} delta={variacao(r.caixa, a?.caixa)} />
      <Kpi rotulo="Dívida" valor={fmtBRL(r.divida)} cor={COR.divida} delta={variacao(r.divida, a?.divida)} menorMelhor />
      <Kpi rotulo="Investimentos" valor={fmtBRL(r.investimentos)} cor={COR.investimentos} />
      <Kpi rotulo="US$" valor={fmtUSD(r.usd)} cor={COR.usd} />
    </div>
  )

  const meta = (
    <section className="bloco meta-bloco">
      <h3 className="bloco-titulo">META DE US$ DÓLARES</h3>
      {r.metaUsd > 0 ? (
        <div className="meta">
          <div><strong>{fmtUSD(r.usd)}</strong><span> de {fmtUSD(r.metaUsd)}</span></div>
          <Progresso valor={r.usd} total={r.metaUsd} cor={COR.usd} />
          <p className="barras-sub">{r.usd >= r.metaUsd ? 'Meta batida! 🎉' : `Faltam ${fmtUSD(r.metaUsd - r.usd)}`}</p>
        </div>
      ) : (
        <p className="quadro-vazio">Sem meta definida. <button className="link" onClick={() => c.irPara('patrimonio')}>Definir meta</button></p>
      )}
    </section>
  )

  const caixa = (
    <QuadroCaixa caixa={c.mesEf.caixa} bancos={c.d.bancos} total={r.caixa} herdadoDe={c.mesEf.herdadoDe} compacto={mobile} aoAbrir={() => c.irPara('patrimonio')} />
  )

  const porBanco = c.d.bancos.length > 0 && (
    <PorBanco bancos={c.d.bancos} lancs={c.lancsMes} caixa={c.mesEf.caixa} aoAbrir={c.abrirBanco} />
  )

  return (
    <div className="pagina">
      <header className="pagina-topo">
        <div>
          <h1>Visão geral</h1>
          <p className="sub">{MESES_NOME[c.mes - 1]} de {c.ano}</p>
        </div>
      </header>
      <section className="hero">
        <div>
          <span className="hero-rotulo">Fluxo de caixa · {MESES[c.mes - 1]}/{c.ano}</span>
          <strong className={`hero-valor ${r.fluxo < 0 ? 'negativo' : 'positivo'}`}>{fmtBRL(r.fluxo)}</strong>
          <span className="hero-sub">
            {r.entradas === 0 && r.saidas === 0
              ? `Nada lançado em ${MESES_NOME[c.mes - 1].toLowerCase()} ainda.`
              : r.fluxo < 0 ? `Saiu ${fmtBRL(-r.fluxo)} a mais do que entrou.` : `Sobrou ${fmtBRL(r.fluxo)} no mês.`}
            {r.divida > 0 && ` Dívidas: ${fmtBRL(r.divida)}.`}
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

      {mobile ? (
        <>
          <Cartao titulo={`Evolução de ${c.ano}`}>
            <GraficoAnual porMes={c.porMes} mesAtual={c.mes} aoClicarMes={c.irParaMes} altura={260} compacto />
          </Cartao>
          <Metricas r={r} mes={c.mes} />
          <section className="pilha">
            <Segmentado
              rotulo="Mostrar"
              valor={lado}
              aoMudar={setLado}
              opcoes={[
                { id: 'saida', nome: `Saídas · ${fmtBRL(r.saidas)}`, cor: COR.saidas },
                { id: 'entrada', nome: `Entradas · ${fmtBRL(r.entradas)}`, cor: COR.entradas },
              ]}
            />
            <QuadroLancamentos key={lado} tipo={lado} itens={lado === 'saida' ? saidas : entradas} limite={6}
              aoNovo={() => c.novoLancamento(lado)} aoEditar={c.editarLancamento} />
          </section>
          <ListaDividas itens={c.situacao} aoEditar={abrirDivida} aoPagar={c.pagarDivida} aoNova={novaDivida} />
          {porBanco}
          {caixa}
          {meta}
          <Cartao titulo={`Resumo de ${c.ano}`}>
            <TabelaAnual porMes={c.porMes} mesAtual={c.mes} aoClicarMes={c.irParaMes} />
          </Cartao>
        </>
      ) : (
        <>
          <div className="duas-colunas">
            <QuadroLancamentos tipo="entrada" itens={entradas} aoNovo={() => c.novoLancamento('entrada')} aoEditar={c.editarLancamento} />
            <QuadroLancamentos tipo="saida" itens={saidas} aoNovo={() => c.novoLancamento('saida')} aoEditar={c.editarLancamento} />
          </div>
          <Cartao titulo={`Evolução de ${c.ano}`} acao={<span className="dica-cab">toque num mês para abrir</span>}>
            <GraficoAnual porMes={c.porMes} mesAtual={c.mes} aoClicarMes={c.irParaMes} />
          </Cartao>
          <div className="duas-colunas">
            <div className="pilha">
              <TabelaDividas itens={c.situacao} aoNova={novaDivida} aoEditar={abrirDivida} aoPagar={c.pagarDivida} />
              {porBanco}
              {caixa}
              {meta}
            </div>
            <Metricas r={r} mes={c.mes} />
          </div>
          <Cartao titulo={`Resumo de ${c.ano}`}>
            <TabelaAnual porMes={c.porMes} mesAtual={c.mes} aoClicarMes={c.irParaMes} />
          </Cartao>
        </>
      )}

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
