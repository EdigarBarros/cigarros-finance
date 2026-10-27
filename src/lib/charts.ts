import {
  ArcElement, BarController, BarElement, CategoryScale, Chart, Filler, Legend, LinearScale,
  LineController, LineElement, PointElement, Tooltip,
} from 'chart.js'

Chart.register(
  ArcElement, BarController, BarElement, CategoryScale, Filler, Legend, LinearScale,
  LineController, LineElement, PointElement, Tooltip,
)
Chart.defaults.color = '#a0a0ab'
Chart.defaults.borderColor = '#22222b'
Chart.defaults.font.family = 'Inter, "Segoe UI", system-ui, sans-serif'
Chart.defaults.font.size = 11
Chart.defaults.plugins.tooltip.backgroundColor = '#22222b'
Chart.defaults.plugins.tooltip.borderColor = '#33333d'
Chart.defaults.plugins.tooltip.borderWidth = 1
Chart.defaults.plugins.tooltip.padding = 10
Chart.defaults.plugins.tooltip.titleColor = '#ededf0'
Chart.defaults.plugins.tooltip.bodyColor = '#ededf0'

// Identidade da planilha (verde entradas, vermelho saídas, roxo Nubank, laranja Inter...),
// com os tons ajustados para o fundo escuro e para leitura por daltônicos.
export const COR = {
  entradas: '#7cc242',
  saidas: '#e5484d',
  caixa: '#3987e5',
  divida: '#c98500',
  investimentos: '#d55181',
  usd: '#199e70',
  nubank: '#9b4dde',
  inter: '#ff7a00',
  itau: '#ec7000',
  principal: '#8a8a96',
}

export const COR_CATEGORIA = {
  transporte: '#3987e5',
  divida: '#d95926',
  alimentacao: '#199e70',
  outros: '#c98500',
}
