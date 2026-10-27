import { restantes, totalDivida } from '../lib/calc'
import { COR } from '../lib/charts'
import { fmtBRL, fmtUSD, MESES_NOME, variacao } from '../lib/format'
import { CATEGORIAS, CONTAS } from '../lib/rotulos'
import { GraficoEntradasSaidas, Rosca } from '../components/Graficos'
import { Icone } from '../components/Icone'
import { ItemLancamento } from '../components/ItemLancamento'
import { Cartao, Kpi, Progresso, Vazio } from '../components/ui'
import type { Ctx } from './contexto'

export function Inicio(c: Ctx) {
  const { r, anterior: a } = c
  const recentes = [...c.lancsMes]
    .sort((x, y) => (y.data ?? '').localeCompare(x.data ?? '') || (y.created_at ?? '').localeCompare(x.created_at ?? ''))
    .slice(0, 8)
  const maiorConta = Math.max(...CONTAS.map((k) => r.porConta[k.id]), 1)
  const dividasAbertas = c.dividasMes.filter((d) => restantes(d) > 0)
  const taxaGasto = r.entradas > 0 ? r.saidas / r.entradas : null

  return (
    <div className="pagina">
      <section className="hero">
        <div>
          <span className="hero-rotulo">Saldo de {MESES_NOME[c.mes - 1].toLowerCase()}</span>
          <strong className={`hero-valor ${r.fluxo < 0 ? 'negativo' : 'positivo'}`}>{fmtBRL(r.fluxo)}</strong>
          <span className="hero-sub">
            {taxaGasto === null
              ? 'Nenhuma entrada registrada ainda.'
              : r.fluxo < 0
                ? `Saiu ${fmtBRL(-r.fluxo)} a mais do que entrou.`
                : `Você gastou ${Math.round(taxaGasto * 100)}% do que entrou.`}
          </span>
        </div>
        <div className="hero-acoes">
          <button className="btn entrada" onClick={() => c.novoLancamento('entrada')}><Icone nome="sobe" tamanho={16} /> Entrada</button>
          <button className="btn saida" onClick={() => c.novoLancamento('saida')}><Icone nome="desce" tamanho={16} /> Saída</button>
        </div>
      </section>

      <div className="kpis">
        <Kpi rotulo="Entradas" valor={fmtBRL(r.entradas)} cor={COR.entradas} delta={variacao(r.entradas, a?.entradas)} />
        <Kpi rotulo="Saídas" valor={fmtBRL(r.saidas)} cor={COR.saidas} delta={variacao(r.saidas, a?.saidas)} menorMelhor />
        <Kpi rotulo="Caixa" valor={fmtBRL(r.caixa)} cor={COR.caixa} delta={variacao(r.caixa, a?.caixa)} />
        <Kpi rotulo="Dívida" valor={fmtBRL(r.divida)} cor={COR.divida} delta={variacao(r.divida, a?.divida)} menorMelhor />
        <Kpi rotulo="Investimentos" valor={fmtBRL(r.investimentos)} cor={COR.investimentos} />
        <Kpi rotulo="Dólar" valor={fmtUSD(r.usd)} cor={COR.usd} />
      </div>

      <div className="grade-dash">
        <Cartao titulo={`Entradas × saídas em ${c.ano}`} className="largo"
          acao={<button className="link" onClick={() => c.irPara('ano')}>Ver ano</button>}>
          <GraficoEntradasSaidas porMes={c.porMes} mesAtual={c.mes} aoClicarMes={c.irParaMes} />
        </Cartao>

        <Cartao titulo="Para onde foi o dinheiro">
          {r.saidas > 0 ? (
            <Rosca
              centro="Saídas"
              total={r.saidas}
              fatias={CATEGORIAS.map((k) => ({ nome: k.nome, valor: r.metricas[k.id], cor: k.cor }))}
            />
          ) : (
            <Vazio>Sem saídas neste mês.</Vazio>
          )}
        </Cartao>

        <Cartao titulo="Últimos lançamentos" className="largo" acao={<button className="link" onClick={() => c.irPara('lancamentos')}>Ver todos</button>}>
          {recentes.length ? (
            <ul className="lista-lanc">
              {recentes.map((l) => <ItemLancamento key={l.id} l={l} aoClicar={() => c.editarLancamento(l)} />)}
            </ul>
          ) : (
            <Vazio>Nada lançado em {MESES_NOME[c.mes - 1].toLowerCase()} ainda.</Vazio>
          )}
        </Cartao>

        <div className="pilha">
        <Cartao titulo="Saídas por conta">
          <ul className="barras">
            {CONTAS.map((k) => (
              <li key={k.id}>
                <span className="barras-nome"><i className="marcador" style={{ background: k.cor }} />{k.nome}</span>
                <span className="barras-valor">{fmtBRL(r.porConta[k.id])}</span>
                <Progresso valor={r.porConta[k.id]} total={maiorConta} cor={k.cor} />
              </li>
            ))}
          </ul>
        </Cartao>

        <Cartao titulo="Dívidas" acao={<button className="link" onClick={() => c.irPara('dividas')}>Gerenciar</button>}>
          {dividasAbertas.length ? (
            <ul className="barras">
              {dividasAbertas.map((d) => (
                <li key={d.id}>
                  <span className="barras-nome">{d.descricao}</span>
                  <span className="barras-valor">{fmtBRL(totalDivida(d))}</span>
                  <Progresso valor={d.pagas} total={d.parcelas} cor={COR.divida} />
                  <span className="barras-sub">{d.pagas} de {d.parcelas} parcelas pagas · {fmtBRL(d.valor_mensal)}/mês</span>
                </li>
              ))}
            </ul>
          ) : (
            <Vazio>
              Nenhuma dívida em aberto.
              {!c.dividasMes.length && <><br /><button className="link" onClick={c.copiarMesAnterior}>Trazer do mês anterior</button></>}
            </Vazio>
          )}
        </Cartao>

        <Cartao titulo="Meta em dólar" acao={<button className="link" onClick={() => c.irPara('patrimonio')}>Editar</button>}>
          {r.metaUsd > 0 ? (
            <div className="meta">
              <strong>{fmtUSD(r.usd)}</strong>
              <span> de {fmtUSD(r.metaUsd)}</span>
              <Progresso valor={r.usd} total={r.metaUsd} cor={COR.usd} />
              <p className="barras-sub">
                {r.usd >= r.metaUsd ? 'Meta batida! 🎉' : `Faltam ${fmtUSD(r.metaUsd - r.usd)} (${Math.round((r.usd / r.metaUsd) * 100)}% concluído)`}
              </p>
            </div>
          ) : (
            <Vazio>Defina uma meta em Patrimônio para acompanhar aqui.</Vazio>
          )}
        </Cartao>
        </div>
      </div>
    </div>
  )
}
