import {
  Animation, animator, ArcElement, BarController, BarElement, CategoryScale, Chart, Filler, Legend, LinearScale,
  LineController, LineElement, PointElement, Tooltip,
  type ChartType, type Plugin,
} from 'chart.js'

declare module 'chart.js' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface PluginOptionsByType<TType extends ChartType> {
    /** Faixa atrás do mês escolhido: índice do rótulo (-1 = nenhum). */
    destaqueMes?: { indice?: number; cor?: string; borda?: string; largura?: number }
    /** Balões com o valor de cada barra do mês escolhido (o texto vem em `balao` de cada série). */
    baloes?: { indice?: number; fundo?: string; texto?: string }
  }
}
import { useValoresOcultos } from './format'
import { coresDoGrafico, semMovimento, useTema, type Tema } from './tema'

type ComRevelar = Chart & { $revelarInicio?: number; $revelado?: boolean; $quadro?: number; $recortou?: boolean }
const suaveVaiVolta = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

/**
 * Entrada das linhas: em vez de pular ponto a ponto, a linha inteira é revelada por uma cortina que corre da esquerda para
 * a direita com aceleração suave. Só no primeiro desenho do gráfico.
 */
const revelar: Plugin = {
  id: 'revelar',
  beforeDatasetDraw(chart, { meta }) {
    const c = chart as ComRevelar
    if (meta.type !== 'line' || c.$revelado || !chart.chartArea) return
    if (semMovimento()) { c.$revelado = true; return }
    const agora = performance.now()
    c.$revelarInicio ??= agora
    const t = Math.min(1, Math.max(0, (agora - c.$revelarInicio - 100) / 750))
    if (t >= 1) { c.$revelado = true; return }
    const { left, top, right, bottom } = chart.chartArea
    chart.ctx.save()
    chart.ctx.beginPath()
    chart.ctx.rect(left - 8, top - 12, (right - left + 16) * suaveVaiVolta(t), bottom - top + 24)
    chart.ctx.clip()
    c.$recortou = true
    // continua redesenhando até a cortina terminar (as barras podem já ter parado)
    if (!c.$quadro) c.$quadro = requestAnimationFrame(() => { c.$quadro = 0; if (c.ctx) c.draw() })
  },
  afterDatasetDraw(chart, { meta }) {
    const c = chart as ComRevelar
    if (meta.type === 'line' && c.$recortou) { chart.ctx.restore(); c.$recortou = false }
  },
}

/** Faixa clarinha atrás do mês escolhido (options.plugins.destaqueMes.indice). */
const destaqueMes: Plugin = {
  id: 'destaqueMes',
  beforeDatasetsDraw(chart, _args, opts: { indice?: number; cor?: string; borda?: string; largura?: number }) {
    const x = chart.scales.x
    if (opts?.indice == null || opts.indice < 0 || !x || !chart.chartArea) return
    const meio = x.getPixelForValue(opts.indice)
    const largura = (x.width / Math.max(1, x.ticks.length)) * (opts.largura ?? 0.86)
    // com borda, a moldura desce até o nome do mês (como um cartão em volta da coluna)
    const top = chart.chartArea.top - (opts.borda ? 6 : 0)
    const bottom = opts.borda ? x.bottom + 4 : chart.chartArea.bottom
    const ctx = chart.ctx
    ctx.save()
    ctx.fillStyle = opts.cor ?? 'rgba(128, 140, 170, .1)'
    ctx.beginPath()
    ctx.roundRect(meio - largura / 2, top, largura, bottom - top, opts.borda ? 12 : 10)
    ctx.fill()
    if (opts.borda) { ctx.strokeStyle = opts.borda; ctx.lineWidth = 1.5; ctx.stroke() }
    ctx.restore()
  },
}

/**
 * Balões em cima das barras do mês escolhido, cada um com o valor da barra e a borda na cor dela (`balao` e `balaoCor` em
 * cada série). Quando dois se encostam, o segundo sobe um pouco, para os dois ficarem legíveis.
 */
const baloes: Plugin = {
  id: 'baloes',
  afterDatasetsDraw(chart, _args, opts: { indice?: number; fundo?: string; texto?: string }) {
    if (opts?.indice == null || opts.indice < 0) return
    const ctx = chart.ctx
    const feitos: { x: number; y: number; l: number; a: number }[] = []
    ctx.save()
    ctx.font = '700 12px Inter, system-ui, sans-serif'
    chart.data.datasets.forEach((d, i) => {
      const extra = d as { balao?: string; balaoCor?: string }
      if (!extra.balao || !chart.isDatasetVisible(i)) return
      const el = chart.getDatasetMeta(i).data[opts.indice!] as unknown as { x: number; y: number } | undefined
      if (!el || !Number.isFinite(el.y)) return
      const l = ctx.measureText(extra.balao).width + 18, a = 24
      const x = Math.min(Math.max(el.x - l / 2, 2), chart.width - l - 2)
      let y = el.y - a - 12
      for (const f of feitos) {
        if (x < f.x + f.l + 4 && x + l + 4 > f.x && y < f.y + f.a + 4 && y + a + 4 > f.y) y = f.y - a - 6
      }
      y = Math.max(2, y)
      feitos.push({ x, y, l, a })
      const cor = extra.balaoCor ?? '#888'
      ctx.beginPath()
      ctx.roundRect(x, y, l, a, 7)
      ctx.fillStyle = opts.fundo ?? '#0e1525'
      ctx.fill()
      ctx.lineWidth = 1.5
      ctx.strokeStyle = cor
      ctx.stroke()
      // a pontinha apontando para a barra
      const px = Math.min(Math.max(el.x, x + 10), x + l - 10)
      ctx.beginPath()
      ctx.moveTo(px - 5, y + a); ctx.lineTo(px, y + a + 6); ctx.lineTo(px + 5, y + a)
      ctx.fillStyle = opts.fundo ?? '#0e1525'
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(px - 5, y + a); ctx.lineTo(px, y + a + 6); ctx.lineTo(px + 5, y + a)
      ctx.stroke()
      ctx.fillStyle = opts.texto ?? '#fff'
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(extra.balao, x + l / 2, y + a / 2 + .5)
    })
    ctx.restore()
  },
}

Chart.register(
  ArcElement, BarController, BarElement, CategoryScale, Filler, Legend, LinearScale,
  LineController, LineElement, PointElement, Tooltip, revelar, destaqueMes, baloes,
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
animacaoPadrao.duration = 650
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

// ---------- caixinha de detalhes que não fica no caminho ----------
// No celular não existe "tirar o mouse de cima": depois de um toque, a caixinha ficava presa tapando o gráfico. Agora ela
// some sozinha 2,5 s depois do último toque, ao tocar de novo no mesmo mês, ao tocar fora do gráfico e ao rolar a página.
// No computador, um clique no gráfico também a fecha, até o mouse passar para outro mês.
// O Chart.js entrega o toque como evento de mouse (mousedown/mousemove/click): o dedo se reconhece pelo pointerType.
type ComCaixinha = Chart & { $calado?: number | null; $timer?: ReturnType<typeof setTimeout> }
const SOME_DEPOIS_DO_TOQUE = 2500
const mesAtivo = (chart: Chart) => chart.tooltip?.getActiveElements()[0]?.index ?? null
const aberta = (chart: Chart) => mesAtivo(chart) !== null && (chart.tooltip?.opacity ?? 0) > 0
/** Fecha na hora (sem animação: a de sumir não rodava quando chamada no meio de um evento, e a caixinha ficava na tela). */
function esconderCaixinha(chart: Chart) {
  if (!chart.tooltip || mesAtivo(chart) === null) return
  chart.tooltip.setActiveElements([], { x: 0, y: 0 })
  chart.setActiveElements([])
  setTimeout(() => { try { chart.update('none') } catch (e) { registrarErro(e) } })
}
const ehDedo = (e: Event | null | undefined) =>
  !!e && ('pointerType' in e ? (e as PointerEvent).pointerType !== 'mouse' : e.type.startsWith('touch'))
/** Mês sob o dedo ou o mouse, antes de a caixinha reagir ao evento. */
const mesNoPonto = (chart: Chart, e: Event) =>
  chart.getElementsAtEventForMode(e, 'index', { intersect: false }, false)[0]?.index ?? null
Chart.register({
  id: 'caixinhaEducada',
  // Barrar o evento aqui (return false) evita que a caixinha reabra, nem que seja por um instante.
  beforeEvent(chart: Chart, args: { event: { type: string; native: Event | null } }) {
    const c = chart as ComCaixinha
    const { type: tipo, native } = args.event
    if (!native || (tipo !== 'mousedown' && tipo !== 'mousemove' && tipo !== 'click')) return
    const mes = mesNoPonto(chart, native)
    if (tipo === 'mousedown' && ehDedo(native)) {
      // tocar no mês que já está aberto fecha a caixinha; tocar em qualquer outro lugar abre de novo
      if (aberta(chart) && mes === mesAtivo(chart)) {
        c.$calado = mes
        esconderCaixinha(chart)
        return false
      }
      c.$calado = null
      return
    }
    if (c.$calado != null) {
      if (mes === c.$calado) return false
      c.$calado = null
    }
  },
  afterEvent(chart: Chart, args: { event: { type: string; native: Event | null } }) {
    const c = chart as ComCaixinha
    const { type: tipo, native } = args.event
    if (tipo === 'mouseout') { c.$calado = null; return }
    if (ehDedo(native)) {
      clearTimeout(c.$timer)
      // no instante do toque a caixinha ainda está surgindo (opacidade 0): vale o mês ativo, não a opacidade
      if (mesAtivo(chart) !== null) c.$timer = setTimeout(() => esconderCaixinha(chart), SOME_DEPOIS_DO_TOQUE)
    } else if (tipo === 'click' && mesAtivo(chart) !== null) {
      c.$calado = mesAtivo(chart)
      esconderCaixinha(chart)
    }
  },
})
// Tocar fora do gráfico ou rolar a página fecha as caixinhas abertas.
const fecharCaixinhas = (exceto?: EventTarget | null) => Object.values(Chart.instances).forEach((ch) => {
  if (ch.canvas !== exceto) esconderCaixinha(ch)
})
document.addEventListener('pointerdown', (e) => fecharCaixinhas(e.target), { passive: true, capture: true })
window.addEventListener('scroll', () => fecharCaixinhas(), { passive: true, capture: true })

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
  // `ocultos` entra na chave dos gráficos: ao esconder os valores eles são refeitos sem números nos eixos
  return { tema, ocultos: useValoresOcultos() ? 'o' : '', ...coresPadrao(tema) }
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
