import {
  ArcElement, BarController, BarElement, CategoryScale, Chart, Legend, LinearScale,
  LineController, LineElement, PointElement, Tooltip,
} from 'chart.js'

Chart.register(
  ArcElement, BarController, BarElement, CategoryScale, Legend, LinearScale,
  LineController, LineElement, PointElement, Tooltip,
)
Chart.defaults.color = '#d9d9d9'
Chart.defaults.borderColor = '#262626'
Chart.defaults.font.family = 'Calibri, Carlito, "Segoe UI", system-ui, sans-serif'

// Cores tiradas da planilha.
export const COR = {
  entradas: '#92d050',
  saidas: '#ff0000',
  fluxo: '#a6a6a6',
  caixa: '#00b0f0',
  divida: '#ffc000',
  investimentos: '#cc00cc',
  usd: '#00b050',
  transporte: '#4472c4',
  dividas: '#ed7d31',
  alimentacao: '#a5a5a5',
  outros: '#ffc000',
}
