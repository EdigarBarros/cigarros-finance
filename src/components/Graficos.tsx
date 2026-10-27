import type { Plugin } from 'chart.js'
import { Bar, Chart, Doughnut } from 'react-chartjs-2'
import type { Resumo } from '../lib/calc'
import { COR } from '../lib/charts'
import { fmtBRL, fmtUSD, MESES, MESES_NOME } from '../lib/format'

const eixoReais = {
  ticks: { callback: (v: string | number) => fmtBRL(Number(v)), maxTicksLimit: 7 },
  grid: { color: 'rgba(84, 84, 88, .35)' },
  border: { display: false },
}

const milhar = (n: number) => (Math.abs(n) >= 1000 ? `${(n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : String(n))

/** O gráfico da planilha: barras de entradas × saídas e linhas de caixa, dívida, investimentos e US$. */
export function GraficoAnual({ porMes, mesAtual, aoClicarMes, altura = 360, compacto }: {
  porMes: (Resumo | null)[]; mesAtual: number; aoClicarMes?: (m: number) => void; altura?: number
  /** Celular: eixo em "mil", legenda menor e barras mais finas. */
  compacto?: boolean
}) {
  const serie = (f: (r: Resumo) => number) => porMes.map((r) => (r ? f(r) : 0))
  const linha = (label: string, cor: string, f: (r: Resumo) => number) => ({
    type: 'line' as const, label, data: serie(f), borderColor: cor, backgroundColor: cor,
    borderWidth: compacto ? 2 : 3, pointRadius: 0, pointHoverRadius: 5, tension: 0, order: 0,
  })
  const barra = (label: string, cor: string, f: (r: Resumo) => number) => ({
    type: 'bar' as const, label, data: serie(f), backgroundColor: cor,
    borderRadius: 6, borderSkipped: false as const, maxBarThickness: compacto ? 7 : 14, categoryPercentage: compacto ? 0.7 : 0.55, order: 1,
  })
  // Valores negativos pequenos (ex.: investimento de -R$ 27) não justificam um eixo indo a -R$ 5 mil.
  const valores = porMes.flatMap((r) => (r ? [r.entradas, r.saidas, r.caixa, r.divida, r.investimentos, r.usd] : []))
  const piso = Math.min(0, ...valores) >= -0.05 * Math.max(1, ...valores) ? 0 : undefined
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
            legend: { position: 'bottom', labels: { boxWidth: compacto ? 6 : 8, boxHeight: compacto ? 6 : 8, padding: compacto ? 10 : 18, font: { size: compacto ? 10 : 12, weight: 500 }, sort: (x, y) => x.datasetIndex! - y.datasetIndex! } },
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
              ticks: {
                color: (t) => (t.index + 1 === mesAtual ? '#ffffff' : '#a0a0ab'),
                font: (t) => ({ weight: t.index + 1 === mesAtual ? 800 : 600, size: compacto ? 9 : 11 }),
                maxRotation: 0,
                autoSkip: false,
                callback: (_v, i) => (compacto ? MESES[i].slice(0, 1) : MESES[i].slice(0, 3)),
              },
            },
            y: compacto
              ? { ...eixoReais, min: piso, ticks: { callback: (v: string | number) => milhar(Number(v)), maxTicksLimit: 6, font: { size: 9 } } }
              : { ...eixoReais, min: piso },
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
            borderRadius: 6,
            borderSkipped: false,
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
    ctx.font = '600 12px -apple-system, BlinkMacSystemFont, Inter, system-ui, sans-serif'
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
          datasets: [{ data: fatias.map((f) => Math.max(0, f.valor)), backgroundColor: fatias.map((f) => f.cor), borderColor: 'transparent', borderWidth: 0, spacing: 3, borderRadius: 6, hoverOffset: 8 }],
        }}
        plugins={[porcentagens]}
        options={{
          cutout: '45%',
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { boxWidth: 8, boxHeight: 8, padding: 14, font: { size: 12, weight: 500 } } },
            tooltip: { callbacks: { label: (c) => ` ${fmtBRL(Number(c.raw))}` } },
          },
        }}
      />
    </div>
  )
}
