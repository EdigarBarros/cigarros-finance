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
    ctx.shadowBlur = 6
  },
  afterDatasetDraw(chart, { meta }) {
    if (meta.type === 'line') chart.ctx.restore()
  },
}

Chart.register(
  ArcElement, BarController, BarElement, CategoryScale, Filler, Legend, LinearScale,
  LineController, LineElement, PointElement, Tooltip, brilho,
)
Chart.defaults.color = 'rgba(235, 235, 245, .6)'
Chart.defaults.borderColor = '#22222b'
Chart.defaults.font.family = '-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, system-ui, sans-serif'
Chart.defaults.font.size = 11
Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(44, 44, 46, .92)'
Chart.defaults.plugins.tooltip.borderColor = 'rgba(255, 255, 255, .12)'
Chart.defaults.plugins.tooltip.borderWidth = 1
Chart.defaults.plugins.tooltip.padding = 10
Chart.defaults.plugins.tooltip.cornerRadius = 14
Chart.defaults.plugins.tooltip.boxPadding = 4
Chart.defaults.plugins.tooltip.usePointStyle = true
Chart.defaults.plugins.legend.labels.usePointStyle = true
Chart.defaults.plugins.legend.labels.pointStyle = 'circle'
Chart.defaults.animation = { duration: 900, easing: 'easeOutQuint' }
Chart.defaults.borderColor = 'rgba(255, 255, 255, .06)'
Chart.defaults.plugins.tooltip.titleColor = '#ededf0'
Chart.defaults.plugins.tooltip.bodyColor = '#ededf0'

// Os mesmos papéis de cor da planilha, nas cores de sistema da Apple (modo escuro).
export const COR = {
  entradas: '#30d158', // systemGreen
  saidas: '#ff453a', // systemRed
  fluxo: '#98989d', // systemGray
  caixa: '#64d2ff', // systemCyan
  divida: '#ffd60a', // systemYellow
  investimentos: '#bf5af2', // systemPurple
  usd: '#63e6e2', // systemMint
  nubank: '#9b4dde',
  inter: '#ff7a00',
  itau: '#ec7000',
  principal: '#8e8e93',
}

