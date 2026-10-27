import {
  ArcElement, BarController, BarElement, CategoryScale, Chart, Filler, Legend, LinearScale,
  LineController, LineElement, PointElement, Tooltip,
  type Plugin,
} from 'chart.js'

// Linhas com brilho, como no gráfico da planilha.
const brilho: Plugin = {
  id: 'brilho',
  beforeDatasetDraw(chart, { meta }) {
    if (meta.type !== 'line') return
    const ctx = chart.ctx
    ctx.save()
    ctx.shadowColor = (meta.dataset?.options as { borderColor?: string })?.borderColor ?? 'transparent'
    ctx.shadowBlur = 10
  },
  afterDatasetDraw(chart, { meta }) {
    if (meta.type === 'line') chart.ctx.restore()
  },
}

Chart.register(
  ArcElement, BarController, BarElement, CategoryScale, Filler, Legend, LinearScale,
  LineController, LineElement, PointElement, Tooltip, brilho,
)
Chart.defaults.color = '#c9c9d1'
Chart.defaults.borderColor = '#22222b'
Chart.defaults.font.family = 'Inter, "Segoe UI", system-ui, sans-serif'
Chart.defaults.font.size = 11
Chart.defaults.plugins.tooltip.backgroundColor = '#22222b'
Chart.defaults.plugins.tooltip.borderColor = '#33333d'
Chart.defaults.plugins.tooltip.borderWidth = 1
Chart.defaults.plugins.tooltip.padding = 10
Chart.defaults.plugins.tooltip.titleColor = '#ededf0'
Chart.defaults.plugins.tooltip.bodyColor = '#ededf0'

// As cores da planilha.
export const COR = {
  entradas: '#92d050',
  saidas: '#ff2b2b',
  fluxo: '#a6a6a6',
  caixa: '#00b0f0',
  divida: '#ffc000',
  investimentos: '#e040e0',
  usd: '#00b050',
  nubank: '#9b4dde',
  inter: '#ff7a00',
  itau: '#ec7000',
  principal: '#8a8a96',
}

export const COR_CATEGORIA = {
  transporte: '#4472c4',
  divida: '#ed7d31',
  alimentacao: '#a5a5a5',
  outros: '#ffc000',
}
