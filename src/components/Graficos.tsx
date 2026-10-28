import type { Chart as ChartJS, Plugin, ScriptableContext } from 'chart.js'
import { Bar, Doughnut, Line } from 'react-chartjs-2'
import type { Resumo } from '../lib/calc'
import { COR, useCoresDoGrafico } from '../lib/charts'
import { fmtValor, MESES_CURTO, MESES_NOME } from '../lib/format'
import type { Visao } from '../lib/perfil'

/** Eixo sem os ",00": R$ 8.000 lê mais fácil que R$ 8.000,00. */
const semCentavos = (n: number) => fmtValor(n).replace(/,00$/, '')

const eixoReais = (grade: string) => ({
  ticks: { callback: (v: string | number) => semCentavos(Number(v)), maxTicksLimit: 6, padding: 8 },
  grid: { color: grade },
  border: { display: false },
})

/** Pontos e barras nascem da linha do zero, um depois do outro (como no vídeo de referência). */
type Quadro = { chart: ChartJS; type: string; mode: string; dataIndex: number }
const crescer = {
  y: {
    type: 'number' as const, properties: ['y'], duration: 1100, easing: 'easeOutQuart' as const,
    from: (ctx: Quadro) => ctx.chart.scales.y?.getPixelForValue(0),
    delay: (ctx: Quadro) => (ctx.type === 'data' && ctx.mode === 'default' ? ctx.dataIndex * 70 : 0),
  },
}

/** Preenchimento em degradê da cor da linha até transparente, de cima para baixo. */
const degrade = (cor: string, forca = 0.32) => (ctx: ScriptableContext<'line'>) => {
  const { chart } = ctx
  const area = (chart as ChartJS).chartArea
  if (!area) return 'transparent'
  const g = chart.ctx.createLinearGradient(0, area.top, 0, area.bottom)
  g.addColorStop(0, cor + Math.round(forca * 255).toString(16).padStart(2, '0'))
  g.addColorStop(1, cor + '00')
  return g
}

/**
 * Fluxo financeiro: Entrou × Saiu nos últimos 6 meses do ano aberto, em área com degradê.
 * Mês sem dados fica em branco (a linha para).
 */
export function GraficoFluxo({ porMes, mesAtual, aoClicarMes, altura = 280, compacto }: {
  porMes: (Resumo | null)[]; mesAtual: number; aoClicarMes?: (m: number) => void; altura?: number; compacto?: boolean
}) {
  const c = useCoresDoGrafico()
  // seis meses terminando no mês aberto (de jan a jun quando o mês aberto é antes de junho)
  const inicio = Math.max(0, Math.min(mesAtual - 6, 6))
  const meses = porMes.slice(inicio, inicio + 6)
  const serie = (f: (r: Resumo) => number) => meses.map((r) => (r ? f(r) : null))
  const area = (label: string, cor: string, f: (r: Resumo) => number) => ({
    label, data: serie(f), borderColor: cor, backgroundColor: degrade(cor), fill: 'origin' as const,
    borderWidth: compacto ? 2 : 2.5, tension: 0.42, pointRadius: meses.map((_, i) => (inicio + i + 1 === mesAtual ? 4 : 0)),
    pointBackgroundColor: cor, pointBorderColor: c.fundo, pointBorderWidth: 2, pointHoverRadius: 6, spanGaps: false,
  })
  return (
    <div className="grafico" style={{ height: altura }}>
      <Line
        key={c.tema}
        data={{
          labels: MESES_CURTO.slice(inicio, inicio + 6),
          datasets: [area('Entrou', COR.entradas, (r) => r.entradas), area('Saiu', COR.despesas, (r) => r.saidas)],
        }}
        options={{
          maintainAspectRatio: false,
          // o degradê é recriado a cada quadro; animar a cor dele quebra o Chart.js
          animations: { ...crescer, colors: false },
          interaction: { mode: 'index', intersect: false },
          onClick: (_e, els) => els[0] && aoClicarMes?.(inicio + els[0].index + 1),
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                title: (i) => MESES_NOME[inicio + i[0].dataIndex],
                label: (x) => ` ${x.dataset.label}: ${fmtValor(x.parsed.y ?? 0)}`,
              },
            },
          },
          scales: {
            x: {
              grid: { display: false }, border: { display: false },
              ticks: {
                color: (t) => (inicio + t.index + 1 === mesAtual ? c.textoForte : c.texto),
                font: (t) => ({ weight: inicio + t.index + 1 === mesAtual ? 700 : 500, size: compacto ? 10 : 12 }),
                padding: 8,
              },
            },
            y: compacto
              ? { ...eixoReais(c.grade), min: 0, ticks: { callback: (v: string | number) => milhar(Number(v)), maxTicksLimit: 5, font: { size: 10 } } }
              : { ...eixoReais(c.grade), min: 0 },
          },
        }}
      />
    </div>
  )
}

const milhar = (n: number) => (Math.abs(n) >= 1000 ? `${(n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : String(n))

/**
 * Linhas de Entrou, Saiu e Sobrou mês a mês. Com `linhas`, a legenda também oferece Guardado nas contas, Dívidas,
 * Investido e Em outras moedas (dos módulos ligados), mas elas começam escondidas:
 * quem quer ver toca na legenda. Assim o gráfico abre limpo e continua completo.
 */
export function GraficoAnual({ porMes, mesAtual, aoClicarMes, altura = 360, compacto, v, linhas }: {
  porMes: (Resumo | null)[]; mesAtual: number; aoClicarMes?: (m: number) => void; altura?: number; v: Visao
  /** Celular: eixo em "mil" e legenda menor. */
  compacto?: boolean
  /** Oferece as linhas extras na legenda (escondidas até a pessoa tocar). */
  linhas?: boolean
}) {
  const c = useCoresDoGrafico()
  // Meses sem dados ficam em branco (a linha para), em vez de cair a zero.
  const serie = (f: (r: Resumo) => number) => porMes.map((r) => (r ? f(r) : null))
  const linha = (label: string, cor: string, f: (r: Resumo) => number, escondida = false) => ({
    label, data: serie(f), borderColor: cor, backgroundColor: cor, hidden: escondida,
    borderWidth: compacto ? 2 : 2.5, pointRadius: compacto ? 2 : 3, pointHoverRadius: 6, tension: 0.35, spanGaps: false,
  })
  const valores = porMes.flatMap((r) => (r ? [r.entradas, r.saidas, r.fluxo] : []))
  const piso = Math.min(0, ...valores) >= -0.05 * Math.max(1, ...valores) ? 0 : undefined
  return (
    <div className="grafico" style={{ height: altura }}>
      <Line
        key={c.tema}
        data={{
          labels: MESES_CURTO,
          datasets: [
            linha('Entrou', COR.entradas, (r) => r.entradas),
            linha('Saiu', COR.saidas, (r) => r.saidas),
            linha('Sobrou', COR.fluxo, (r) => r.fluxo),
            ...(linhas && v.bancos ? [linha('Guardado nas contas', COR.caixa, (r) => r.caixa, true)] : []),
            ...(linhas && v.dividas ? [linha('Dívidas', COR.divida, (r) => r.divida, true)] : []),
            ...(linhas && v.investimentos ? [linha('Investido', COR.investimentos, (r) => r.investimentos, true)] : []),
            ...(linhas && v.moedas ? [linha('Em outras moedas', COR.usd, (r) => r.moedasConvertido, true)] : []),
          ],
        }}
        options={{
          maintainAspectRatio: false,
          animations: crescer,
          interaction: { mode: 'index', intersect: false },
          onClick: (_e, els) => els[0] && aoClicarMes?.(els[0].index + 1),
          plugins: {
            legend: { position: 'bottom', labels: { boxWidth: compacto ? 6 : 8, boxHeight: compacto ? 6 : 8, padding: compacto ? 10 : 18, font: { size: compacto ? 10 : 12, weight: 500 } } },
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
              border: { color: c.eixo },
              ticks: {
                color: (t) => (t.index + 1 === mesAtual ? c.textoForte : c.texto),
                font: (t) => ({ weight: t.index + 1 === mesAtual ? 800 : 600, size: compacto ? 9 : 11 }),
                maxRotation: 0,
                autoSkip: false,
                callback: (_v, i) => (compacto ? MESES_CURTO[i].slice(0, 1) : MESES_CURTO[i]),
              },
            },
            y: compacto
              ? { ...eixoReais(c.grade), min: piso, ticks: { callback: (v: string | number) => milhar(Number(v)), maxTicksLimit: 6, font: { size: 9 } } }
              : { ...eixoReais(c.grade), min: piso },
          },
        }}
      />
    </div>
  )
}

/** Saldo de cada mês (positivo ou negativo). */
export function GraficoSaldo({ porMes }: { porMes: (Resumo | null)[] }) {
  const c = useCoresDoGrafico()
  return (
    <div className="grafico" style={{ height: 220 }}>
      <Bar
        key={c.tema}
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
          animations: crescer,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { title: (i) => MESES_NOME[i[0].dataIndex], label: (x) => ` Sobrou: ${fmtValor(x.parsed.y ?? 0)}` } },
          },
          scales: { x: { grid: { display: false }, border: { display: false } }, y: eixoReais(c.grade) },
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
  const c = useCoresDoGrafico()
  return (
    <div className="grafico" style={{ height: altura }}>
      {/* As fatias vêm da maior para a menor; quando a ordem muda, o gráfico é refeito
          (animar a troca de posição das fatias quebra o Chart.js). */}
      <Doughnut
        key={c.tema + fatias.map((f) => f.nome).join('|')}
        data={{
          labels: fatias.map((f) => f.nome),
          datasets: [{ data: fatias.map((f) => Math.max(0, f.valor)), backgroundColor: fatias.map((f) => f.cor), borderColor: c.fundo, borderWidth: 3, spacing: 0, borderRadius: 4, hoverOffset: 8 }],
        }}
        plugins={rotulos ? [porcentagens] : []}
        options={{
          cutout,
          maintainAspectRatio: false,
          animation: { animateRotate: true, animateScale: true, duration: 1300, easing: 'easeOutQuart' },
          plugins: {
            legend: { display: legenda, position: 'bottom', labels: { boxWidth: 8, boxHeight: 8, padding: 14, font: { size: 12, weight: 500 } } },
            tooltip: { callbacks: { label: (c) => ` ${fmtValor(Number(c.raw))}` } },
          },
        }}
      />
    </div>
  )
}
