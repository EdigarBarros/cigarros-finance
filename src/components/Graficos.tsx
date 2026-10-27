import type { Plugin } from 'chart.js'
import { Bar, Chart, Doughnut } from 'react-chartjs-2'
import type { Resumo } from '../lib/calc'
import { COR } from '../lib/charts'
import { fmtBRL, fmtUSD, MESES, MESES_NOME } from '../lib/format'

const eixoReais = {
  ticks: { callback: (v: string | number) => fmtBRL(Number(v)), maxTicksLimit: 7 },
  grid: { color: '#1e1e26' },
  border: { display: false },
}

/** O gráfico da planilha: barras de entradas × saídas e linhas de caixa, dívida, investimentos e US$. */
export function GraficoAnual({ porMes, mesAtual, aoClicarMes, altura = 360 }: {
  porMes: (Resumo | null)[]; mesAtual: number; aoClicarMes?: (m: number) => void; altura?: number
}) {
  const serie = (f: (r: Resumo) => number) => porMes.map((r) => (r ? f(r) : 0))
  const linha = (label: string, cor: string, f: (r: Resumo) => number) => ({
    type: 'line' as const, label, data: serie(f), borderColor: cor, backgroundColor: cor,
    borderWidth: 3, pointRadius: 0, pointHoverRadius: 5, tension: 0, order: 0,
  })
  const barra = (label: string, cor: string, f: (r: Resumo) => number) => ({
    type: 'bar' as const, label, data: serie(f), backgroundColor: cor,
    borderRadius: 3, maxBarThickness: 16, categoryPercentage: 0.55, order: 1,
  })
  return (
    <div className="grafico" style={{ height: altura }}>
      <Chart
        type="bar"
        data={{
          labels: MESES.map((m) => m.slice(0, 3)),
          datasets: [
            barra('ENTRADAS', COR.entradas, (r) => r.entradas),
            barra('SAÍDAS', COR.saidas, (r) => r.saidas),
            linha('CAIXA', COR.caixa, (r) => r.caixa),
            linha('DÍVIDA', COR.divida, (r) => r.divida),
            linha('INVESTIMENTOS', COR.investimentos, (r) => r.investimentos),
            linha('US$', COR.usd, (r) => r.usd),
          ],
        }}
        options={{
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          onClick: (_e, els) => els[0] && aoClicarMes?.(els[0].index + 1),
          plugins: {
            legend: { position: 'bottom', labels: { boxWidth: 22, boxHeight: 8, padding: 16, font: { size: 11, weight: 600 }, sort: (x, y) => x.datasetIndex! - y.datasetIndex! } },
            tooltip: {
              callbacks: {
                title: (i) => MESES_NOME[i[0].dataIndex],
                label: (c) => ` ${c.dataset.label}: ${c.dataset.label === 'US$' ? fmtUSD(c.parsed.y ?? 0) : fmtBRL(c.parsed.y ?? 0)}`,
              },
            },
          },
          scales: {
            x: {
              grid: { display: false },
              border: { color: '#3a3a46' },
              ticks: { color: (t) => (t.index + 1 === mesAtual ? '#ffffff' : '#a0a0ab'), font: (t) => ({ weight: t.index + 1 === mesAtual ? 800 : 600 }) },
            },
            y: eixoReais,
          },
        }}
      />
    </div>
  )
}

/** Saldo de cada mês (positivo ou negativo). */
export function GraficoSaldo({ porMes }: { porMes: (Resumo | null)[] }) {
  return (
    <div className="grafico" style={{ height: 220 }}>
      <Bar
        data={{
          labels: MESES.map((m) => m.slice(0, 3)),
          datasets: [{
            label: 'Fluxo de caixa',
            data: porMes.map((r) => r?.fluxo ?? null),
            backgroundColor: porMes.map((r) => ((r?.fluxo ?? 0) >= 0 ? COR.entradas : COR.saidas)),
            borderRadius: 3,
            maxBarThickness: 22,
          }],
        }}
        options={{
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { title: (i) => MESES_NOME[i[0].dataIndex], label: (c) => ` Fluxo: ${fmtBRL(c.parsed.y ?? 0)}` } },
          },
          scales: { x: { grid: { display: false }, border: { display: false } }, y: eixoReais },
        }}
      />
    </div>
  )
}

export interface Fatia { nome: string; valor: number; cor: string }

// Escreve a % dentro de cada fatia, como o gráfico de métricas da planilha.
const porcentagens: Plugin<'doughnut'> = {
  id: 'porcentagens',
  afterDatasetsDraw(chart) {
    const dados = chart.data.datasets[0].data as number[]
    const total = dados.reduce((a, b) => a + b, 0)
    const { ctx } = chart
    ctx.save()
    ctx.font = '700 12px Inter, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    chart.getDatasetMeta(0).data.forEach((arco, i) => {
      const p = total ? dados[i] / total : 0
      if (p < 0.04) return
      const { x, y } = arco.tooltipPosition(true) as { x: number; y: number }
      ctx.fillStyle = '#ffffff'
      ctx.shadowColor = '#000000aa'
      ctx.shadowBlur = 4
      ctx.fillText(`${Math.round(p * 100)}%`, x, y)
    })
    ctx.restore()
  },
}

export function Rosca({ fatias, altura = 260 }: { fatias: Fatia[]; altura?: number }) {
  return (
    <div className="grafico" style={{ height: altura }}>
      <Doughnut
        data={{
          labels: fatias.map((f) => f.nome.toUpperCase()),
          datasets: [{ data: fatias.map((f) => Math.max(0, f.valor)), backgroundColor: fatias.map((f) => f.cor), borderColor: '#14141a', borderWidth: 2, hoverOffset: 6 }],
        }}
        plugins={[porcentagens]}
        options={{
          cutout: '45%',
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { boxWidth: 10, boxHeight: 10, padding: 14, font: { size: 11, weight: 600 } } },
            tooltip: { callbacks: { label: (c) => ` ${fmtBRL(Number(c.raw))}` } },
          },
        }}
      />
    </div>
  )
}
