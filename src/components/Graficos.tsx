import type { Plugin } from 'chart.js'
import { Bar, Chart, Doughnut } from 'react-chartjs-2'
import type { Resumo } from '../lib/calc'
import { COR } from '../lib/charts'
import { fmtValor, MESES_CURTO, MESES_NOME } from '../lib/format'
import type { Visao } from '../lib/perfil'

/** Eixo sem os ",00": R$ 8.000 lê mais fácil que R$ 8.000,00. */
const semCentavos = (n: number) => fmtValor(n).replace(/,00$/, '')

const eixoReais = {
  ticks: { callback: (v: string | number) => semCentavos(Number(v)), maxTicksLimit: 7 },
  grid: { color: 'rgba(84, 84, 88, .35)' },
  border: { display: false },
}

const milhar = (n: number) => (Math.abs(n) >= 1000 ? `${(n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : String(n))

/**
 * Barras de Entrou × Saiu mês a mês. Com `linhas`, a legenda também oferece Guardado nas contas, Dívidas,
 * Investido e Em outras moedas (dos módulos ligados, na moeda principal), mas elas começam escondidas:
 * quem quer ver toca na legenda. Assim o gráfico abre limpo e continua completo.
 */
export function GraficoAnual({ porMes, mesAtual, aoClicarMes, altura = 360, compacto, v, linhas }: {
  porMes: (Resumo | null)[]; mesAtual: number; aoClicarMes?: (m: number) => void; altura?: number; v: Visao
  /** Celular: eixo em "mil", legenda menor e barras mais finas. */
  compacto?: boolean
  /** Oferece as linhas extras na legenda (escondidas até a pessoa tocar). */
  linhas?: boolean
}) {
  const serie = (f: (r: Resumo) => number) => porMes.map((r) => (r ? f(r) : 0))
  const linha = (label: string, cor: string, f: (r: Resumo) => number) => ({
    type: 'line' as const, label, data: serie(f), borderColor: cor, backgroundColor: cor, hidden: true,
    borderWidth: compacto ? 2 : 3, pointRadius: 0, pointHoverRadius: 5, tension: 0, order: 0,
  })
  const barra = (label: string, cor: string, f: (r: Resumo) => number) => ({
    type: 'bar' as const, label, data: serie(f), backgroundColor: cor,
    borderRadius: 6, borderSkipped: false as const, maxBarThickness: compacto ? 7 : 14, categoryPercentage: compacto ? 0.7 : 0.55, order: 1,
  })
  // Valores negativos pequenos (ex.: investimento de -R$ 27) não justificam um eixo indo a -R$ 5 mil.
  const valores = porMes.flatMap((r) => (r ? (linhas ? [r.entradas, r.saidas, r.caixa, r.divida, r.investimentos, r.moedasConvertido] : [r.entradas, r.saidas]) : []))
  const piso = Math.min(0, ...valores) >= -0.05 * Math.max(1, ...valores) ? 0 : undefined
  return (
    <div className="grafico" style={{ height: altura }}>
      <Chart
        type="bar"
        data={{
          labels: MESES_CURTO,
          datasets: [
            barra('Entrou', COR.entradas, (r) => r.entradas),
            barra('Saiu', COR.saidas, (r) => r.saidas),
            ...(linhas && v.bancos ? [linha('Guardado nas contas', COR.caixa, (r) => r.caixa)] : []),
            ...(linhas && v.dividas ? [linha('Dívidas', COR.divida, (r) => r.divida)] : []),
            ...(linhas && v.investimentos ? [linha('Investido', COR.investimentos, (r) => r.investimentos)] : []),
            ...(linhas && v.moedas ? [linha('Em outras moedas', COR.usd, (r) => r.moedasConvertido)] : []),
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
                label: (c) => ` ${c.dataset.label}: ${fmtValor(c.parsed.y ?? 0)}`,
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
                callback: (_v, i) => (compacto ? MESES_CURTO[i].slice(0, 1) : MESES_CURTO[i]),
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
          labels: MESES_CURTO,
          datasets: [{
            label: 'Sobrou',
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
            tooltip: { callbacks: { title: (i) => MESES_NOME[i[0].dataIndex], label: (c) => ` Sobrou: ${fmtValor(c.parsed.y ?? 0)}` } },
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

export function Rosca({ fatias, altura = 260, legenda = true, rotulos = true, cutout = '45%' }: {
  fatias: Fatia[]; altura?: number
  /** Legenda embaixo; desligue quando uma lista ao lado já faz esse papel. */
  legenda?: boolean
  /** Porcentagem escrita em cada fatia. */
  rotulos?: boolean
  cutout?: string
}) {
  return (
    <div className="grafico" style={{ height: altura }}>
      {/* As fatias vêm da maior para a menor; quando a ordem muda, o gráfico é refeito
          (animar a troca de posição das fatias quebra o Chart.js). */}
      <Doughnut
        key={fatias.map((f) => f.nome).join('|')}
        data={{
          labels: fatias.map((f) => f.nome),
          datasets: [{ data: fatias.map((f) => Math.max(0, f.valor)), backgroundColor: fatias.map((f) => f.cor), borderColor: 'transparent', borderWidth: 0, spacing: 3, borderRadius: 6, hoverOffset: 8 }],
        }}
        plugins={rotulos ? [porcentagens] : []}
        options={{
          cutout,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: legenda, position: 'bottom', labels: { boxWidth: 8, boxHeight: 8, padding: 14, font: { size: 12, weight: 500 } } },
            tooltip: { callbacks: { label: (c) => ` ${fmtValor(Number(c.raw))}` } },
          },
        }}
      />
    </div>
  )
}
