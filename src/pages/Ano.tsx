import { Line } from 'react-chartjs-2'
import type { Resumo } from '../lib/calc'
import { COR } from '../lib/charts'
import { fmtBRL, fmtUSD, MESES_CURTO, MESES_NOME } from '../lib/format'
import { GraficoEntradasSaidas, GraficoSaldo } from '../components/Graficos'
import { Cartao, Kpi } from '../components/ui'
import type { Ctx } from './contexto'

export function Ano(c: Ctx) {
  const meses = c.porMes.filter((r): r is Resumo => r !== null)
  const soma = (k: 'entradas' | 'saidas' | 'fluxo') => meses.reduce((a, r) => a + r[k], 0)
  const mediaGasto = meses.length ? soma('saidas') / meses.length : 0
  const melhor = c.porMes.reduce<number | null>((b, r, i) => (r && (b === null || r.fluxo > c.porMes[b]!.fluxo) ? i : b), null)

  return (
    <div className="pagina">
      <header className="pagina-topo">
        <div>
          <h1>Resumo de {c.ano}</h1>
          <p className="sub">{meses.length} {meses.length === 1 ? 'mês' : 'meses'} com dados · toque num mês para abrir</p>
        </div>
      </header>

      <div className="kpis">
        <Kpi rotulo="Entradas no ano" valor={fmtBRL(soma('entradas'))} cor={COR.entradas} />
        <Kpi rotulo="Saídas no ano" valor={fmtBRL(soma('saidas'))} cor={COR.saidas} />
        <Kpi rotulo="Saldo do ano" valor={fmtBRL(soma('fluxo'))} cor={COR.caixa} />
        <Kpi rotulo="Gasto médio por mês" valor={fmtBRL(mediaGasto)} cor={COR.divida}>
          {melhor !== null && <span className="kpi-delta">Melhor mês: {MESES_NOME[melhor]}</span>}
        </Kpi>
      </div>

      <div className="grade-dash">
        <Cartao titulo="Entradas × saídas" className="largo">
          <GraficoEntradasSaidas porMes={c.porMes} mesAtual={c.mes} aoClicarMes={(m) => { c.irParaMes(m); c.irPara('inicio') }} />
        </Cartao>
        <Evolucao titulo="Caixa" cor={COR.caixa} serie={c.porMes.map((r) => r?.caixa ?? null)} />
        <Cartao titulo="Saldo de cada mês" className="largo">
          <GraficoSaldo porMes={c.porMes} />
        </Cartao>
        <Evolucao titulo="Dívida" cor={COR.divida} serie={c.porMes.map((r) => r?.divida ?? null)} />
        <Evolucao titulo="Investimentos" cor={COR.investimentos} serie={c.porMes.map((r) => r?.investimentos ?? null)} />
        <Evolucao titulo="Dólar" cor={COR.usd} usd serie={c.porMes.map((r) => r?.usd ?? null)} />
      </div>

      <Cartao titulo="Mês a mês">
        <div className="tabela-rolagem">
          <table className="tabela">
            <thead>
              <tr><th>Mês</th><th>Entradas</th><th>Saídas</th><th>Saldo</th><th>Caixa</th><th>Dívida</th><th>Investimentos</th><th>US$</th></tr>
            </thead>
            <tbody>
              {c.porMes.map((r, i) => (
                <tr key={i} className={`${r ? 'clicavel' : 'sem-dados'} ${i + 1 === c.mes ? 'atual' : ''}`}
                  onClick={() => r && (c.irParaMes(i + 1), c.irPara('inicio'))}>
                  <th>{MESES_NOME[i]}</th>
                  {r ? (
                    <>
                      <td>{fmtBRL(r.entradas)}</td><td>{fmtBRL(r.saidas)}</td>
                      <td className={r.fluxo < 0 ? 'negativo' : 'positivo'}>{fmtBRL(r.fluxo)}</td>
                      <td>{fmtBRL(r.caixa)}</td><td>{fmtBRL(r.divida)}</td><td>{fmtBRL(r.investimentos)}</td><td>{fmtUSD(r.usd)}</td>
                    </>
                  ) : <td colSpan={7}>—</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Cartao>
    </div>
  )
}

/** Uma linha por medida (em vez de misturar escalas diferentes no mesmo gráfico). */
function Evolucao({ titulo, cor, serie, usd }: { titulo: string; cor: string; serie: (number | null)[]; usd?: boolean }) {
  const fmt = usd ? fmtUSD : fmtBRL
  const ultimo = [...serie].reverse().find((v) => v !== null)
  return (
    <Cartao titulo={<><i className="marcador" style={{ background: cor }} />{titulo}</>} acao={<strong>{ultimo != null ? fmt(ultimo) : '—'}</strong>}>
      <div className="grafico" style={{ height: 120 }}>
        <Line
          data={{
            labels: MESES_CURTO,
            datasets: [{ data: serie, borderColor: cor, backgroundColor: cor + '22', fill: true, borderWidth: 2, pointRadius: 3, pointHoverRadius: 5, spanGaps: true, tension: 0.3 }],
          }}
          options={{
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: { legend: { display: false }, tooltip: { callbacks: { title: (i) => MESES_NOME[i[0].dataIndex], label: (ctx) => ` ${fmt(ctx.parsed.y ?? 0)}` } } },
            scales: { x: { grid: { display: false }, border: { display: false }, ticks: { maxTicksLimit: 6 } }, y: { display: false } },
          }}
        />
      </div>
    </Cartao>
  )
}
