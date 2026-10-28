import {
  Animation, animator, ArcElement, BarController, BarElement, CategoryScale, Chart, Filler, Legend, LinearScale,
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
Chart.defaults.font.family = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif'
Chart.defaults.font.size = 11
Chart.defaults.plugins.tooltip.borderWidth = 1
Chart.defaults.plugins.tooltip.padding = 12
Chart.defaults.plugins.tooltip.cornerRadius = 12
Chart.defaults.plugins.tooltip.boxPadding = 4
Chart.defaults.plugins.tooltip.usePointStyle = true
Chart.defaults.plugins.legend.labels.usePointStyle = true
Chart.defaults.plugins.legend.labels.pointStyle = 'circle'
// Mexer campo a campo, nunca trocar o objeto inteiro: o Chart.js usa os nomes que existem em defaults.animation
// (delay, from, type…) para saber o que ler de cada animação. Trocando o objeto, ele passava a ignorar type/from/delay:
// as animações por mês não funcionavam e a animação de cor de um degradê quebrava o motor de animação da página inteira
// (todos os gráficos sumiam).
const animacaoPadrao = Chart.defaults.animation as Exclude<typeof Chart.defaults.animation, false>
animacaoPadrao.duration = 1100
animacaoPadrao.easing = 'easeOutQuart'
// depois da primeira animação, o gráfico só faz transições suaves: não volta a crescer do zero a cada atualização
animacaoPadrao.onComplete = ({ chart }) => { (chart as Chart & { $cresceu?: boolean }).$cresceu = true }
// Até 2× a resolução da tela: no iPhone (3×) cada gráfico ocupa bem menos memória e o Safari para de descartá-lo.
Chart.defaults.devicePixelRatio = Math.min(2, window.devicePixelRatio || 1)

// ---------- gráficos que não travam ----------
// O Chart.js tem um motor de animação só para a página toda. Se um quadro de animação de qualquer gráfico dá erro, o motor
// fica marcado como ocupado e nunca mais roda: todos os gráficos, inclusive os criados depois, ficam em branco para sempre.
// Aqui o motor pega o erro, registra no console e termina as animações desenhando tudo no estado final.

/** Últimos erros de gráfico, para diagnóstico (F12 → Console: `__opuscashErrosGraficos`). */
const errosGraficos: unknown[] = []
;(window as unknown as { __opuscashErrosGraficos: unknown[] }).__opuscashErrosGraficos = errosGraficos
function registrarErro(e: unknown) {
  if (errosGraficos.length < 20) errosGraficos.push(e)
  console.error('[OpusCash] erro num gráfico; o painel se recuperou sozinho:', e)
}

type MotorInterno = { _update: (data?: number) => void; _charts: Map<Chart, { items: unknown[] }> }
const motor = animator as unknown as MotorInterno
const passoOriginal = motor._update.bind(motor)
motor._update = (data?: number) => {
  try {
    passoOriginal(data)
  } catch (e) {
    registrarErro(e)
    // abandona as animações em curso e desenha cada gráfico no estado final
    motor._charts.forEach((a) => { a.items.length = 0 })
    setTimeout(() => Object.values(Chart.instances).forEach((c) => {
      try { c.update('none') } catch (e2) { registrarErro(e2) }
    }))
  }
}

// Uma animação sem interpolador (valor que não é número nem cor, como um degradê) pula direto para o valor final,
// em vez de quebrar o quadro.
type AnimacaoInterna = { _fn?: unknown; tick: (data: number) => void }
const prototipo = Animation.prototype as unknown as AnimacaoInterna
const tickOriginal = prototipo.tick
prototipo.tick = function (this: AnimacaoInterna, data: number) {
  if (typeof this._fn !== 'function') this._fn = (_de: unknown, para: unknown) => para
  return tickOriginal.call(this, data)
}

// Vigia: o gráfico que não se desenhar até 1,8 s depois de criado é desenhado direto, sem animação.
type ComVigia = Chart & { $desenhou?: boolean }
Chart.register({
  id: 'vigia',
  afterInit(chart: Chart) {
    setTimeout(() => {
      const c = chart as ComVigia
      if (!c.$desenhou && c.canvas) {
        try { c.update('none') } catch (e) { registrarErro(e) }
      }
    }, 1800)
  },
  afterDraw(chart: Chart) { (chart as ComVigia).$desenhou = true },
})

/**
 * O Safari (iPhone, iPad e Mac) apaga o desenho dos gráficos quando a aba ou o app fica em segundo plano, ou quando a
 * página volta do cache, e o Chart.js não percebe. Ao voltar, redesenha todos.
 */
const redesenhar = () => Object.values(Chart.instances).forEach((c) => {
  try { c.resize(); c.update('none') } catch (e) { registrarErro(e) }
})
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') requestAnimationFrame(redesenhar) })
window.addEventListener('pageshow', () => requestAnimationFrame(redesenhar))
window.addEventListener('focus', () => requestAnimationFrame(redesenhar))

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

/**
 * Cores dos gráficos de barras e linhas, na base do gráfico da planilha: entradas em verde, saídas em vermelho e linhas
 * vivas com brilho (caixa azul, dívida amarela, investimentos roxo, dólar verde). Barras com degradê [topo, base].
 */
export const PALETA = {
  entradas: ['#5ee08f', '#14b88a'] as const,
  saidas: ['#ff6b6b', '#e0435f'] as const,
  sobrou: '#22b8f0',
  acumulado: '#ffc000',
  caixa: '#22b8f0',
  divida: '#ffc000',
  investimentos: '#c45cf0',
  usd: '#10d07a',
}
