import type { Chart as ChartJS, ChartData, ChartOptions, Plugin, ScriptableContext } from 'chart.js'
import { Chart as Misto, Doughnut } from 'react-chartjs-2'
import type { Resumo } from '../lib/calc'
import { PALETA, useCoresDoGrafico } from '../lib/charts'
import { fmtValor, MESES_CURTO, MESES_NOME } from '../lib/format'
import type { Visao } from '../lib/perfil'

/** Eixo sem os ",00": R$ 8.000 lê mais fácil que R$ 8.000,00. */
const semCentavos = (n: number) => fmtValor(n).replace(/,00$/, '')
const milhar = (n: number) => (Math.abs(n) >= 1000 ? `${(n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : String(n))

type Quadro = {
  chart: ChartJS & { $cresceu?: boolean }; type: string; mode: string; dataIndex: number; datasetIndex: number; index: number
}
const primeira = (ctx: Quadro) => !ctx.chart.$cresceu && ctx.type === 'data' && ctx.mode === 'default'
// a linha do zero no eixo da própria série (a linha do acumulado usa o eixo da direita)
const zeroY = (ctx: Quadro) => ctx.chart.getDatasetMeta(ctx.datasetIndex)?.yScale?.getPixelForValue(0) ?? ctx.chart.scales.y?.getPixelForValue(0)

const ehLinha = (ctx: Quadro) => (ctx.chart.data.datasets[ctx.datasetIndex] as { type?: string } | undefined)?.type === 'line'

/**
 * Animação de entrada, como no vídeo de referência. Só na primeira vez; depois (dados chegando, outro mês) o gráfico
 * vai suave do valor atual para o novo.
 * - Barras nascem da linha do zero, mês a mês, uma série logo depois da outra.
 * - Linhas se desenham da esquerda para a direita, como uma caneta: cada ponto aparece depois do anterior, saindo da
 *   altura dele, começando quando as barras já estão subindo.
 */
function animacoesDeEntrada(pontos: number) {
  const passo = 1100 / Math.max(1, pontos)
  const anterior = (ctx: Quadro) => {
    if (!ctx.dataIndex) return zeroY(ctx)
    const p = ctx.chart.getDatasetMeta(ctx.datasetIndex).data[ctx.dataIndex - 1]
    const y = p?.getProps(['y'], true).y
    return Number.isFinite(y) ? y : zeroY(ctx)
  }
  return {
    // os degradês são recriados a cada quadro; animar a cor deles quebra o Chart.js
    colors: false as const,
    x: {
      type: 'number' as const, easing: 'linear' as const, duration: passo,
      from: (ctx: Quadro) => (primeira(ctx) && ehLinha(ctx) ? NaN : undefined),
      delay: (ctx: Quadro) => (primeira(ctx) && ehLinha(ctx) ? 350 + ctx.dataIndex * passo : 0),
    },
    y: {
      type: 'number' as const, easing: 'easeOutQuart' as const,
      duration: (ctx: Quadro) => (primeira(ctx) && ehLinha(ctx) ? passo : 900),
      from: (ctx: Quadro) => (!primeira(ctx) ? undefined : ehLinha(ctx) ? anterior(ctx) : zeroY(ctx)),
      delay: (ctx: Quadro) => (!primeira(ctx) ? 0 : ehLinha(ctx) ? 350 + ctx.dataIndex * passo : ctx.dataIndex * 70 + ctx.datasetIndex * 40),
    },
  }
}

/** Degradê vertical para as barras (ou cor lisa enquanto o gráfico ainda não tem área). */
const degradeBarra = ([topo, base]: readonly [string, string]) => (ctx: ScriptableContext<'bar'>) => {
  const { chart } = ctx
  const area = (chart as ChartJS).chartArea
  if (!area || !chart.ctx || ![area.top, area.bottom].every(Number.isFinite) || area.bottom <= area.top) return topo
  const g = chart.ctx.createLinearGradient(0, area.top, 0, area.bottom)
  g.addColorStop(0, topo)
  g.addColorStop(1, base)
  return g
}

const barra = (label: string, cores: readonly [string, string], data: (number | null)[], compacto?: boolean) => ({
  type: 'bar' as const, label, data, order: 2,
  backgroundColor: degradeBarra(cores), hoverBackgroundColor: cores[0],
  borderRadius: compacto ? 3 : 5, borderSkipped: 'start' as const,
  maxBarThickness: compacto ? 10 : 20, categoryPercentage: 0.64, barPercentage: 0.84,
})

const linha = (label: string, cor: string, data: (number | null)[], compacto?: boolean, extra?: object) => ({
  type: 'line' as const, label, data, order: 1,
  borderColor: cor, backgroundColor: cor, borderWidth: compacto ? 2.5 : 3, tension: 0.35,
  pointRadius: 0, pointHoverRadius: 5, pointHitRadius: 10, pointBackgroundColor: cor, spanGaps: false,
  ...extra,
})

/** Opções comuns: eixo em reais (aceita negativos), meses embaixo, legenda com o desenho de cada série. */
function opcoes(c: ReturnType<typeof useCoresDoGrafico>, {
  rotulos, mesDoIndice, mesAtual, compacto, legenda = true, aoClicarMes, eixoDireito,
}: {
  rotulos: string[]; mesDoIndice: (i: number) => number; mesAtual?: number; compacto?: boolean; legenda?: boolean
  aoClicarMes?: (m: number) => void
  /** Cor do eixo da direita (y1), para uma série de outra grandeza, como o acumulado do ano. */
  eixoDireito?: string
}): ChartOptions<'bar'> {
  const ticksReais = compacto
    ? { callback: (v: string | number) => milhar(Number(v)), maxTicksLimit: 5, font: { size: 9 } }
    : { callback: (v: string | number) => semCentavos(Number(v)), maxTicksLimit: 7, padding: 8 }
  return {
    maintainAspectRatio: false,
    animations: animacoesDeEntrada(rotulos.length) as unknown as ChartOptions<'bar'>['animations'],
    interaction: { mode: 'index', intersect: false },
    onClick: (_e, els) => { if (els[0]) aoClicarMes?.(mesDoIndice(els[0].index)) },
    plugins: {
      legend: {
        display: legenda, position: 'bottom',
        labels: {
          usePointStyle: true, padding: compacto ? 10 : 18, boxWidth: compacto ? 7 : 9, boxHeight: compacto ? 7 : 9,
          font: { size: compacto ? 10 : 12, weight: 600 },
          // barra vira um quadradinho; linha vira um traço, como na legenda da planilha
          generateLabels: (chart) => chart.data.datasets.map((d, i) => {
            const linhaSerie = (d as { type?: string }).type === 'line'
            const hover = d.hoverBackgroundColor as string | string[]
            const cor = linhaSerie ? (d.borderColor as string) : Array.isArray(hover) ? PALETA.entradas[0] : hover
            return {
              text: d.label ?? '', datasetIndex: i, hidden: !chart.isDatasetVisible(i), fontColor: c.texto,
              fillStyle: cor, strokeStyle: cor, lineWidth: linhaSerie ? 3 : 0, pointStyle: linhaSerie ? 'line' : 'rectRounded',
            }
          }),
        },
      },
      tooltip: {
        callbacks: {
          title: (i) => MESES_NOME[mesDoIndice(i[0].dataIndex) - 1],
          label: (x) => ` ${x.dataset.label}: ${fmtValor(x.parsed.y ?? 0)}`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false }, border: { color: c.eixo },
        ticks: {
          color: (t) => (mesDoIndice(t.index) === mesAtual ? c.textoForte : c.texto),
          font: (t) => ({ weight: mesDoIndice(t.index) === mesAtual ? 800 : 600, size: compacto ? 9 : 11 }),
          maxRotation: 0, autoSkip: false,
          callback: (_v, i) => (compacto && rotulos.length > 6 ? rotulos[i].slice(0, 1) : rotulos[i]),
        },
      },
      y: { grace: '6%', grid: { color: c.grade }, border: { display: false }, ticks: ticksReais },
      ...(eixoDireito ? {
        y1: {
          position: 'right' as const, grace: '6%', grid: { display: false }, border: { display: false },
          ticks: { ...ticksReais, color: eixoDireito },
        },
      } : {}),
    },
  }
}

const serie = (meses: (Resumo | null)[], f: (r: Resumo) => number) => meses.map((r) => (r ? f(r) : null))

/**
 * Fluxo financeiro da Início: Entrou e Saiu em barras lado a lado e a linha brilhante do que sobrou, nos 6 meses até o
 * aberto (de jan a jun quando o mês aberto é antes de junho). Mês sem dados fica em branco.
 */
export function GraficoFluxo({ porMes, mesAtual, aoClicarMes, altura, compacto }: {
  porMes: (Resumo | null)[]; mesAtual: number; aoClicarMes?: (m: number) => void
  /** Sem altura, ocupa a caixa em que está (veja .grafico-esticado). */
  altura?: number; compacto?: boolean
}) {
  const c = useCoresDoGrafico()
  const inicio = Math.max(0, Math.min(mesAtual - 6, 6))
  const meses = porMes.slice(inicio, inicio + 6)
  const data = {
    labels: MESES_CURTO.slice(inicio, inicio + 6),
    datasets: [
      barra('Entrou', PALETA.entradas, serie(meses, (r) => r.entradas), compacto),
      barra('Saiu', PALETA.saidas, serie(meses, (r) => r.saidas), compacto),
      linha('Sobrou', PALETA.sobrou, serie(meses, (r) => r.fluxo), compacto, { pointRadius: compacto ? 2 : 3 }),
    ],
  } as unknown as ChartData<'bar'>
  return (
    <div className="grafico" style={altura ? { height: altura } : undefined}>
      <Misto type="bar" key={c.tema} data={data}
        options={opcoes(c, { rotulos: MESES_CURTO.slice(inicio, inicio + 6), mesDoIndice: (i) => inicio + i + 1, mesAtual, compacto, legenda: false, aoClicarMes })} />
    </div>
  )
}

/**
 * Mês a mês do ano, como o gráfico da planilha: Entrou e Saiu em barras e, por cima, as linhas brilhantes do que a pessoa
 * acompanha (guardado nas contas, dívidas, investido, outras moedas), conforme os módulos ligados.
 */
export function GraficoAnual({ porMes, mesAtual, aoClicarMes, altura = 400, compacto, v }: {
  porMes: (Resumo | null)[]; mesAtual: number; aoClicarMes?: (m: number) => void; altura?: number; v: Visao
  /** Celular: eixo em "mil" e legenda menor. */
  compacto?: boolean
}) {
  const c = useCoresDoGrafico()
  const data = {
    labels: MESES_CURTO,
    datasets: [
      barra('Entrou', PALETA.entradas, serie(porMes, (r) => r.entradas), compacto),
      barra('Saiu', PALETA.saidas, serie(porMes, (r) => r.saidas), compacto),
      ...(v.bancos ? [linha('Guardado nas contas', PALETA.caixa, serie(porMes, (r) => r.caixa), compacto)] : []),
      ...(v.dividas ? [linha('Dívidas', PALETA.divida, serie(porMes, (r) => r.divida), compacto)] : []),
      ...(v.investimentos ? [linha('Investido', PALETA.investimentos, serie(porMes, (r) => r.investimentos), compacto)] : []),
      ...(v.moedas ? [linha('Em outras moedas', PALETA.usd, serie(porMes, (r) => r.moedasConvertido), compacto)] : []),
    ],
  } as unknown as ChartData<'bar'>
  return (
    <div className="grafico" style={{ height: altura }}>
      <Misto type="bar" key={c.tema} data={data}
        options={opcoes(c, { rotulos: MESES_CURTO, mesDoIndice: (i) => i + 1, mesAtual, compacto, aoClicarMes })} />
    </div>
  )
}

/**
 * Quanto sobrou em cada mês: barra verde quando sobrou e vermelha quando faltou, e a linha brilhante do acumulado no
 * ano (quanto já sobrou somando os meses até ali).
 */
export function GraficoSaldo({ porMes, mesAtual, aoClicarMes, compacto }: {
  porMes: (Resumo | null)[]; mesAtual?: number; aoClicarMes?: (m: number) => void; compacto?: boolean
}) {
  const c = useCoresDoGrafico()
  // acumulado no ano: soma do que sobrou até cada mês (meses sem dados ficam em branco)
  const acumulado = porMes.map((r, i) => (r ? porMes.slice(0, i + 1).reduce((a, x) => a + (x?.fluxo ?? 0), 0) : null))
  const sobrou = serie(porMes, (r) => r.fluxo)
  const data = {
    labels: MESES_CURTO,
    datasets: [
      {
        ...barra('Sobrou no mês', PALETA.entradas, sobrou, compacto),
        // faltou: vermelho, descendo da linha do zero
        backgroundColor: (ctx: ScriptableContext<'bar'>) => {
          const v = sobrou[ctx.dataIndex] ?? 0
          return degradeBarra(v >= 0 ? PALETA.entradas : [PALETA.saidas[1], PALETA.saidas[0]])(ctx)
        },
        hoverBackgroundColor: sobrou.map((v) => ((v ?? 0) >= 0 ? PALETA.entradas[0] : PALETA.saidas[0])),
        maxBarThickness: compacto ? 14 : 26,
      },
      linha('Acumulado no ano', PALETA.acumulado, acumulado, compacto, { pointRadius: compacto ? 2 : 3, yAxisID: 'y1' }),
    ],
  } as unknown as ChartData<'bar'>
  return (
    <div className="grafico" style={{ height: compacto ? 240 : 280 }}>
      <Misto type="bar" key={c.tema} data={data}
        options={opcoes(c, { rotulos: MESES_CURTO, mesDoIndice: (i) => i + 1, mesAtual, compacto, aoClicarMes, eixoDireito: PALETA.acumulado })} />
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
