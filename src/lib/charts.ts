import {
  ArcElement, BarController, BarElement, CategoryScale, Chart, Filler, Legend, LinearScale,
  LineController, LineElement, PointElement, Tooltip,
  type Plugin,
} from 'chart.js'
import { coresDoGrafico, useTema, type Tema } from './tema'

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
Chart.defaults.font.family = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif'
Chart.defaults.font.size = 11
Chart.defaults.plugins.tooltip.borderWidth = 1
Chart.defaults.plugins.tooltip.padding = 12
Chart.defaults.plugins.tooltip.cornerRadius = 12
Chart.defaults.plugins.tooltip.boxPadding = 4
Chart.defaults.plugins.tooltip.usePointStyle = true
Chart.defaults.plugins.legend.labels.usePointStyle = true
Chart.defaults.plugins.legend.labels.pointStyle = 'circle'
Chart.defaults.animation = { duration: 1100, easing: 'easeOutQuart' }

/** Ajusta as cores padrão do Chart.js ao tema (texto, linhas de grade e balão). */
export function coresPadrao(t: Tema) {
  const c = coresDoGrafico(t)
  Chart.defaults.color = c.texto
  Chart.defaults.borderColor = c.grade
  Chart.defaults.plugins.tooltip.backgroundColor = c.tooltip
  Chart.defaults.plugins.tooltip.borderColor = c.tooltipBorda
  Chart.defaults.plugins.tooltip.titleColor = c.textoForte
  Chart.defaults.plugins.tooltip.bodyColor = c.textoForte
  return c
}

/** Hook dos gráficos: cores do tema atual. Use `tema` como key para refazer o gráfico ao trocar de tema. */
export function useCoresDoGrafico() {
  const { tema } = useTema()
  return { tema, ...coresPadrao(tema) }
}

// Papéis de cor (os mesmos da planilha), em tons que funcionam no claro e no escuro.
// Entrou/progresso puxam o verde-água da marca OpusCash; o azul e o violeta vêm do símbolo.
export const COR = {
  entradas: '#14b88a',
  saidas: '#f0506e',
  /** Saídas nos gráficos de área (como no layout do OpusCash). */
  despesas: '#8b7cf6',
  fluxo: '#8e98ae',
  caixa: '#2f8cf0',
  divida: '#f5a524',
  investimentos: '#8b5cf6',
  usd: '#14b8c4',
  nubank: '#9b4dde',
  inter: '#ff7a00',
  itau: '#ec7000',
  principal: '#8e98ae',
  /** Gradiente do símbolo, da esquerda para a direita. */
  marca: ['#3d4be0', '#1f8ef1', '#14c9a0'] as const,
}
