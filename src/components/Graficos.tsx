import type { Chart as ChartJS, ChartData, ChartOptions, Plugin, ScriptableContext } from 'chart.js'
import { Chart as Misto, Doughnut } from 'react-chartjs-2'
import type { Resumo } from '../lib/calc'
import { PALETA, useCoresDoGrafico } from '../lib/charts'
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { fmtMoeda, fmtValor, MESES_CURTO, MESES_NOME, moedaAtual, valoresEstaoOcultos } from '../lib/format'
import { Segmentado } from './ui'
import type { Visao } from '../lib/perfil'
import { tx } from '../lib/textos'

/**
 * Caixa do gráfico. O gráfico só é criado depois da primeira pintura da página: criar o Chart.js e desenhar os eixos custa
 * dezenas de milissegundos e, junto com o resto da página, deixava a troca de tela travada (a caixa já ocupa o espaço, nada pula).
 */
function CaixaDoGrafico({ style, children }: { style?: CSSProperties; children: ReactNode }) {
  const [pronto, setPronto] = useState(false)
  useEffect(() => {
    let b = 0
    const a = requestAnimationFrame(() => { b = requestAnimationFrame(() => setPronto(true)) })
    return () => { cancelAnimationFrame(a); cancelAnimationFrame(b) }
  }, [])
  return <div className="grafico" style={style}>{pronto ? children : null}</div>
}

/** Eixo sem os ",00": R$ 8.000 lê mais fácil que R$ 8.000,00. */
const semCentavos = (n: number, formatar: (n: number) => string = fmtValor) => (valoresEstaoOcultos() ? '' : formatar(n).replace(/,00$/, ''))
const milhar = (n: number) => valoresEstaoOcultos() ? '' : (Math.abs(n) >= 1000 ? tx('{0} mil', (n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })) : String(n))

type Quadro = {
  chart: ChartJS & { $cresceu?: boolean }; type: string; mode: string; dataIndex: number; datasetIndex: number; index: number
}
const primeira = (ctx: Quadro) => !ctx.chart.$cresceu && ctx.type === 'data' && ctx.mode === 'default'
// a linha do zero no eixo da própria série (a linha do acumulado usa o eixo da direita)
const zeroY = (ctx: Quadro) => ctx.chart.getDatasetMeta(ctx.datasetIndex)?.yScale?.getPixelForValue(0) ?? ctx.chart.scales.y?.getPixelForValue(0)

const ehLinha = (ctx: Quadro) => (ctx.chart.data.datasets[ctx.datasetIndex] as { type?: string } | undefined)?.type === 'line'

/**
 * Entrada das barras: nascem da linha do zero com uma curva macia, uma logo depois da outra (atraso pequeno, para parecer
 * uma onda e não degraus). As linhas entram pela cortina do plugin `revelar` (lib/charts.ts). Só na primeira vez; depois
 * (dados chegando, outro mês) o gráfico vai suave do valor atual para o novo.
 */
function animacoesDeEntrada() {
  return {
    // os degradês são recriados a cada quadro; animar a cor deles quebra o Chart.js
    colors: false as const,
    y: {
      type: 'number' as const, easing: 'easeOutCubic' as const, duration: 650,
      from: (ctx: Quadro) => (primeira(ctx) && !ehLinha(ctx) ? zeroY(ctx) : undefined),
      delay: (ctx: Quadro) => (primeira(ctx) && !ehLinha(ctx) ? ctx.dataIndex * 18 + ctx.datasetIndex * 10 : 0),
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

/** Linha fina e suave (curva monotônica, sem exageros), com bolinhas discretas com contorno da cor do cartão. */
const linha = (label: string, cor: string, data: (number | null)[], fundo: string, compacto?: boolean, extra?: object) => ({
  type: 'line' as const, label, data, order: 1,
  borderColor: cor, backgroundColor: cor, borderWidth: compacto ? 2 : 2.25, cubicInterpolationMode: 'monotone' as const,
  borderCapStyle: 'round' as const, borderJoinStyle: 'round' as const,
  pointRadius: compacto ? 2.5 : 3.5, pointBorderWidth: 2, pointBorderColor: fundo, pointBackgroundColor: cor,
  pointHoverRadius: 6, pointHoverBorderWidth: 2, pointHitRadius: 12, spanGaps: false,
  ...extra,
})

/** Cor com transparência (as cores da paleta são #rrggbb). */
const comAlfa = (hex: string, a: number) => `${hex}${Math.round(a * 255).toString(16).padStart(2, '0')}`

/**
 * Linha do Mês a mês: fina, sem bolinhas (a bolinha só aparece ao tocar ou passar o mouse). Com `area`, ganha uma sombra
 * leve até a base, que mostra o tamanho do que se acumula (a dívida).
 */
const linhaSuave = (label: string, cor: string, data: (number | null)[], fundo: string, compacto?: boolean, area?: boolean) =>
  linha(label, cor, data, fundo, compacto, {
    borderWidth: area ? 2 : 1.5, pointRadius: 0, pointHoverRadius: 5,
    ...(area ? { fill: 'origin', backgroundColor: comAlfa(cor, 0.16) } : {}),
  })

/** Opções comuns: eixo em reais (aceita negativos), meses embaixo, legenda com o desenho de cada série. */
function opcoes(c: ReturnType<typeof useCoresDoGrafico>, {
  rotulos, mesDoIndice, mesAtual, compacto, legenda = true, eixoDireito, destacar, formatar = fmtValor,
}: {
  rotulos: string[]; mesDoIndice: (i: number) => number; mesAtual?: number; compacto?: boolean; legenda?: boolean
  /** Pinta uma faixa clarinha atrás do mês aberto. */
  destacar?: boolean
  /** Cor do eixo da direita (y1), para uma série de outra grandeza, como o acumulado do ano. */
  eixoDireito?: string
  /** Como escrever um valor: na moeda principal por padrão, ou em outra moeda. */
  formatar?: (n: number) => string
}): ChartOptions<'bar'> {
  const ticksReais = compacto
    ? { callback: (v: string | number) => milhar(Number(v)), maxTicksLimit: 5, font: { size: 9 } }
    : { callback: (v: string | number) => semCentavos(Number(v), formatar), maxTicksLimit: 7, padding: 8 }
  return {
    maintainAspectRatio: false,
    animations: animacoesDeEntrada() as unknown as ChartOptions<'bar'>['animations'],
    interaction: { mode: 'index', intersect: false },
    plugins: {
      // o gráfico não troca o mês ao ser tocado: isso pegava a pessoa de surpresa (a escolha do mês é explícita)
      destaqueMes: { indice: destacar && mesAtual ? rotulos.findIndex((_, i) => mesDoIndice(i) === mesAtual) : -1, cor: c.tema === 'escuro' ? 'rgba(148, 163, 196, .075)' : 'rgba(15, 174, 134, .075)' },
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
          label: (x) => ` ${x.dataset.label}: ${formatar(x.parsed.y ?? 0)}`,
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
export function GraficoFluxo({ porMes, mesAtual, altura, compacto, moeda }: {
  porMes: (Resumo | null)[]; mesAtual: number
  /** Outra moeda (valores como foram lançados, sem conversão); sem ela, a moeda principal. */
  moeda?: string
  /** Sem altura, ocupa a caixa em que está (veja .grafico-esticado). */
  altura?: number; compacto?: boolean
}) {
  const c = useCoresDoGrafico()
  const inicio = Math.max(0, Math.min(mesAtual - 6, 6))
  const meses = porMes.slice(inicio, inicio + 6)
  const fora = Boolean(moeda) && moeda !== moedaAtual()
  const entrou = (r: Resumo) => (fora ? r.entradasMoeda[moeda!] ?? 0 : r.entradas)
  const saiu = (r: Resumo) => (fora ? r.saidasMoeda[moeda!] ?? 0 : r.saidas)
  const data = {
    labels: MESES_CURTO.slice(inicio, inicio + 6),
    datasets: [
      barra(tx('Entrou'), PALETA.entradas, serie(meses, entrou), compacto),
      barra(tx('Saiu'), PALETA.saidas, serie(meses, saiu), compacto),
      linha(tx('Sobrou'), PALETA.sobrou, serie(meses, (r) => (fora ? Math.round((entrou(r) - saiu(r)) * 100) / 100 : r.fluxo)), c.fundo, compacto),
    ],
  } as unknown as ChartData<'bar'>
  return (
    <CaixaDoGrafico style={altura ? { height: altura } : undefined}>
      <Misto type="bar" key={c.tema + c.ocultos + (fora ? moeda : '')} data={data}
        options={opcoes(c, { rotulos: MESES_CURTO.slice(inicio, inicio + 6), mesDoIndice: (i) => inicio + i + 1, mesAtual, compacto, legenda: false, destacar: true, formatar: fora ? (n) => fmtMoeda(n, moeda!) : fmtValor })} />
    </CaixaDoGrafico>
  )
}

/**
 * Mês a mês do ano, como o gráfico da planilha: Entrou e Saiu em barras e, por cima, as linhas brilhantes do que a pessoa
 * acompanha (guardado nas contas, dívidas, investido, outras moedas), conforme os módulos ligados.
 */
/** Linhas da dica das dívidas: de onde veio a subida ou a descida do mês. */
function origemDaDivida(r: Resumo | null | undefined): string[] {
  if (!r) return []
  const l: string[] = []
  if (r.dividaNovas) l.push(`  ${tx('nova dívida')}: +${fmtValor(r.dividaNovas)}`)
  if (r.dividaAumentos) l.push(`  ${tx('emprestado a mais')}: +${fmtValor(r.dividaAumentos)}`)
  if (r.dividaAjustes) l.push(`  ${tx('ajuste de saldo')}: ${r.dividaAjustes > 0 ? '+' : '−'}${fmtValor(Math.abs(r.dividaAjustes))}`)
  if (r.dividaPagos) l.push(`  ${tx('pagamentos')}: −${fmtValor(r.dividaPagos)}`)
  return l
}

/** Moedas (além da principal) que aparecem no ano: lançamentos, dívidas ou saldo guardado. */
export function moedasDoAno(porMes: (Resumo | null)[]) {
  const achadas = new Set<string>()
  for (const r of porMes) {
    if (!r) continue
    for (const k of [...Object.keys(r.entradasMoeda), ...Object.keys(r.saidasMoeda), ...Object.keys(r.dividaMoeda)]) achadas.add(k)
    for (const [k, valor] of Object.entries(r.moedas)) if (valor > 0) achadas.add(k)
  }
  achadas.delete(moedaAtual())
  return [...achadas].sort()
}

export function GraficoAnual({ porMes, mesAtual, altura = 400, compacto, v }: {
  porMes: (Resumo | null)[]; mesAtual: number; altura?: number; v: Visao
  /** Celular: eixo em "mil" e legenda menor. */
  compacto?: boolean
}) {
  const c = useCoresDoGrafico()
  const principal = moedaAtual()
  const extras = useMemo(() => moedasDoAno(porMes), [porMes])
  const [escolhida, setEscolhida] = useState(principal)
  // Só aparece o seletor quando há algo em outra moeda; a visão padrão é a da moeda principal, igual a antes.
  const moeda = extras.includes(escolhida) ? escolhida : principal
  const fora = moeda !== principal
  const temDividaFora = porMes.some((r) => r && Object.keys(r.dividaMoeda).length > 0)
  const algum = (f: (r: Resumo) => number) => porMes.some((r) => r && f(r) > 0)
  const data = (fora
    ? {
        labels: MESES_CURTO,
        datasets: [
          barra(tx('Entrou'), PALETA.entradas, serie(porMes, (r) => r.entradasMoeda[moeda] ?? 0), compacto),
          barra(tx('Saiu'), PALETA.saidas, serie(porMes, (r) => r.saidasMoeda[moeda] ?? 0), compacto),
          ...(algum((r) => r.moedas[moeda] ?? 0) ? [linhaSuave(tx('Guardado em {0}', moeda), PALETA.caixa, serie(porMes, (r) => (r.moedas[moeda] ?? null) as number), c.fundo, compacto)] : []),
          ...(algum((r) => r.dividaMoeda[moeda] ?? 0) ? [linhaSuave(tx('Dívidas em {0}', moeda), PALETA.divida, serie(porMes, (r) => r.dividaMoeda[moeda] ?? 0), c.fundo, compacto, true)] : []),
        ],
      }
    : {
        labels: MESES_CURTO,
        datasets: [
          barra(tx('Entrou'), PALETA.entradas, serie(porMes, (r) => r.entradas), compacto),
          barra(tx('Saiu'), PALETA.saidas, serie(porMes, (r) => r.saidas), compacto),
          ...(v.bancos ? [linhaSuave(tx('Guardado nas contas'), PALETA.caixa, serie(porMes, (r) => r.caixa), c.fundo, compacto)] : []),
          ...(v.dividas ? [linhaSuave(tx('Dívidas'), PALETA.divida, serie(porMes, (r) => r.divida), c.fundo, compacto, true)] : []),
          ...(v.investimentos ? [linhaSuave(tx('Investido'), PALETA.investimentos, serie(porMes, (r) => r.investimentos), c.fundo, compacto)] : []),
          ...(v.moedas ? [linhaSuave(tx('Em outras moedas'), PALETA.usd, serie(porMes, (r) => r.moedasConvertido), c.fundo, compacto)] : []),
        ],
      }) as unknown as ChartData<'bar'>
  const opcoesBase = opcoes(c, { rotulos: MESES_CURTO, mesDoIndice: (i) => i + 1, mesAtual, compacto, destacar: true, formatar: fora ? (n) => fmtMoeda(n, moeda) : fmtValor })
  // a sombra da dívida é desenhada antes de qualquer série: fica atrás das barras, que continuam nítidas
  const base: ChartOptions<'bar'> = { ...opcoesBase, plugins: { ...opcoesBase.plugins, filler: { drawTime: 'beforeDatasetsDraw' } } }
  return (
    <>
      {extras.length > 0 && (
        <div className="grafico-moeda">
          <Segmentado rotulo={tx('Ver o gráfico em')} valor={moeda} aoMudar={setEscolhida}
            opcoes={[principal, ...extras].map((m) => ({ id: m, nome: m }))} />
        </div>
      )}
      <CaixaDoGrafico style={{ height: altura }}>
        <Misto type="bar" key={c.tema + c.ocultos + moeda} data={data} options={fora ? base : comOrigemDaDivida(base, porMes)} />
      </CaixaDoGrafico>
      {fora
        ? <p className="campo-ajuda">{tx('Valores em {0}, como você lançou: sem conversão. Entrou, Saiu e Dívidas só desta moeda.', moeda)}</p>
        : temDividaFora && <p className="campo-ajuda">{tx('As dívidas em outras moedas entram aqui pela cotação de hoje. Para ver os valores exatos, escolha a moeda acima.')}</p>}
    </>
  )
}

/** Acrescenta à dica da linha de Dívidas o que fez ela mudar naquele mês. */
function comOrigemDaDivida(o: ChartOptions<'bar'>, porMes: (Resumo | null)[]): ChartOptions<'bar'> {
  const cb = o.plugins?.tooltip?.callbacks
  return {
    ...o,
    plugins: {
      ...o.plugins,
      tooltip: { ...o.plugins?.tooltip, callbacks: { ...cb, afterLabel: (x) => (x.dataset.label === tx('Dívidas') ? origemDaDivida(porMes[x.dataIndex]) : []) } },
    },
  }
}

/**
 * Quanto sobrou em cada mês: barra verde quando sobrou e vermelha quando faltou, e a linha brilhante do acumulado no
 * ano (quanto já sobrou somando os meses até ali).
 */
export function GraficoSaldo({ porMes, mesAtual, compacto }: {
  porMes: (Resumo | null)[]; mesAtual?: number; compacto?: boolean
}) {
  const c = useCoresDoGrafico()
  const principal = moedaAtual()
  const extras = useMemo(() => moedasDoAno(porMes), [porMes])
  const [escolhida, setEscolhida] = useState(principal)
  // Só aparece o seletor quando há algo em outra moeda; a visão padrão é a da moeda principal, igual a antes.
  const moeda = extras.includes(escolhida) ? escolhida : principal
  const fora = moeda !== principal
  const fluxoDe = (r: Resumo) => (fora ? Math.round(((r.entradasMoeda[moeda] ?? 0) - (r.saidasMoeda[moeda] ?? 0)) * 100) / 100 : r.fluxo)
  // acumulado no ano: soma do que sobrou até cada mês (meses sem dados ficam em branco)
  const acumulado = porMes.map((r, i) => (r ? porMes.slice(0, i + 1).reduce((a, x) => a + (x ? fluxoDe(x) : 0), 0) : null))
  const sobrou = serie(porMes, fluxoDe)
  const data = {
    labels: MESES_CURTO,
    datasets: [
      {
        ...barra(tx('Sobrou no mês'), PALETA.entradas, sobrou, compacto),
        // faltou: vermelho, descendo da linha do zero
        backgroundColor: (ctx: ScriptableContext<'bar'>) => {
          const v = sobrou[ctx.dataIndex] ?? 0
          return degradeBarra(v >= 0 ? PALETA.entradas : [PALETA.saidas[1], PALETA.saidas[0]])(ctx)
        },
        hoverBackgroundColor: sobrou.map((v) => ((v ?? 0) >= 0 ? PALETA.entradas[0] : PALETA.saidas[0])),
        maxBarThickness: compacto ? 14 : 26,
      },
      linha(tx('Acumulado no ano'), PALETA.acumulado, acumulado, c.fundo, compacto, { yAxisID: 'y1' }),
    ],
  } as unknown as ChartData<'bar'>
  return (
    <>
      {extras.length > 0 && (
        <div className="grafico-moeda">
          <Segmentado rotulo={tx('Ver o gráfico em')} valor={moeda} aoMudar={setEscolhida}
            opcoes={[principal, ...extras].map((m) => ({ id: m, nome: m }))} />
        </div>
      )}
      <CaixaDoGrafico style={{ height: compacto ? 240 : 280 }}>
        <Misto type="bar" key={c.tema + c.ocultos + moeda} data={data}
          options={opcoes(c, { rotulos: MESES_CURTO, mesDoIndice: (i) => i + 1, mesAtual, compacto, eixoDireito: PALETA.acumulado, destacar: true, formatar: fora ? (n) => fmtMoeda(n, moeda) : fmtValor })} />
      </CaixaDoGrafico>
      {fora && <p className="campo-ajuda">{tx('Valores em {0}, como você lançou: sem conversão. Entrou e Saiu só desta moeda.', moeda)}</p>}
    </>
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
    ctx.font = tx('600 12px -apple-system, BlinkMacSystemFont, Inter, system-ui, sans-serif')
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
    <CaixaDoGrafico style={{ height: altura }}>
      {/* As fatias vêm da maior para a menor; quando a ordem muda, o gráfico é refeito
          (animar a troca de posição das fatias quebra o Chart.js). */}
      <Doughnut
        key={c.tema + c.ocultos + fatias.map((f) => f.nome).join('|')}
        data={{
          labels: fatias.map((f) => f.nome),
          datasets: [{ data: fatias.map((f) => Math.max(0, f.valor)), backgroundColor: fatias.map((f) => f.cor), borderColor: c.fundo, borderWidth: 3, spacing: 0, borderRadius: 4, hoverOffset: 8 }],
        }}
        plugins={rotulos ? [porcentagens] : []}
        options={{
          cutout,
          maintainAspectRatio: false,
          animation: { animateRotate: true, animateScale: true, duration: 700, easing: 'easeOutQuart' },
          plugins: {
            legend: { display: legenda, position: 'bottom', labels: { boxWidth: 8, boxHeight: 8, padding: 14, font: { size: 12, weight: 500 } } },
            tooltip: { callbacks: { label: (c) => ` ${fmtValor(Number(c.raw))}` } },
          },
        }}
      />
    </CaixaDoGrafico>
  )
}
