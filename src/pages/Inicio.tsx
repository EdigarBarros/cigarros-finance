import { useState } from 'react'
import { COR } from '../lib/charts'
import { fmtBRL, fmtUSD, MESES, variacao } from '../lib/format'
import { COR_BANCO, NOME_BANCO, NOME_TIPO_CAIXA } from '../lib/rotulos'
import { BANCOS, TIPOS_CAIXA, type Divida } from '../lib/types'
import { Metricas, QuadroLancamentos, TabelaAnual, TabelaDividas } from '../components/Blocos'
import { FormDivida } from '../components/Formularios'
import { GraficoAnual } from '../components/Graficos'
import { Icone } from '../components/Icone'
import { Cartao, Kpi, Progresso } from '../components/ui'
import type { Ctx } from './contexto'

export function Inicio(c: Ctx) {
  const { r, anterior: a } = c
  const [divida, setDivida] = useState<Divida | 'nova' | null>(null)
  const caixa = c.metaMes?.caixa ?? {}

  return (
    <div className="pagina">
      <section className="hero">
        <div>
          <span className="hero-rotulo">Controle financeiro · {MESES[c.mes - 1]}/{c.ano}</span>
          <strong className={`hero-valor ${r.fluxo < 0 ? 'negativo' : 'positivo'}`}>{fmtBRL(r.fluxo)}</strong>
          <span className="hero-sub">
            Fluxo de caixa do mês ·{' '}
            {r.entradas === 0 ? 'nenhuma entrada ainda' : r.fluxo < 0 ? `saiu ${fmtBRL(-r.fluxo)} a mais do que entrou` : `sobrou ${fmtBRL(r.fluxo)}`}
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
        <Kpi rotulo="US$" valor={fmtUSD(r.usd)} cor={COR.usd} />
      </div>

      <div className="duas-colunas">
        <QuadroLancamentos tipo="entrada" itens={c.lancsMes.filter((l) => l.tipo === 'entrada')}
          aoNovo={() => c.novoLancamento('entrada')} aoEditar={c.editarLancamento} />
        <QuadroLancamentos tipo="saida" itens={c.lancsMes.filter((l) => l.tipo === 'saida')}
          aoNovo={() => c.novoLancamento('saida')} aoEditar={c.editarLancamento} />
      </div>

      <Cartao titulo={`Evolução de ${c.ano}`} acao={<span className="dica-cab">toque num mês para abrir</span>}>
        <GraficoAnual porMes={c.porMes} mesAtual={c.mes} aoClicarMes={c.irParaMes} />
      </Cartao>

      <div className="duas-colunas">
        <div className="pilha">
          <TabelaDividas
            itens={c.dividasMes}
            aoNova={() => setDivida('nova')}
            aoEditar={setDivida}
            aoPagar={(d) => c.d.updDivida(d.id, { pagas: d.pagas + 1 })}
          />
          {!c.dividasMes.length && (
            <button className="btn" onClick={c.copiarMesAnterior}><Icone nome="copiar" tamanho={16} /> Trazer dívidas e caixa do mês anterior</button>
          )}
          <section className="bloco">
            <div className="tabela-rolagem">
              <table className="tabela-bloco tabela-caixa">
                <thead>
                  <tr>
                    <th>CAIXA</th>
                    {BANCOS.map((b) => <th key={b} style={{ color: COR_BANCO[b] }}>{NOME_BANCO[b].toUpperCase()}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {TIPOS_CAIXA.map((t) => (
                    <tr key={t} onClick={() => c.irPara('patrimonio')}>
                      <th>{NOME_TIPO_CAIXA[t].toUpperCase()}</th>
                      {BANCOS.map((b) => <td key={b} className={caixa[b]?.[t] ? '' : 'vazio'}>{fmtBRL(caixa[b]?.[t] ?? 0)}</td>)}
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr><th>TOTAL</th><td colSpan={3}>{fmtBRL(r.caixa)}</td></tr></tfoot>
              </table>
            </div>
          </section>
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
        </div>
        <Metricas r={r} mes={c.mes} />
      </div>

      <Cartao titulo={`Resumo de ${c.ano}`}>
        <TabelaAnual porMes={c.porMes} mesAtual={c.mes} aoClicarMes={c.irParaMes} />
      </Cartao>

      {divida && (
        <FormDivida
          ano={c.ano}
          mes={c.mes}
          ordem={c.dividasMes.length}
          inicial={divida === 'nova' ? undefined : divida}
          aoSalvar={(d, id) => (id ? c.d.updDivida(id, d) : c.d.addDivida(d))}
          aoExcluir={c.d.delDivida}
          aoFechar={() => setDivida(null)}
        />
      )}
    </div>
  )
}
