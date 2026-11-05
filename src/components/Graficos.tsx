import type { Chart as ChartJS, ChartData, ChartEvent, ChartOptions, Plugin, ScriptableContext } from 'chart.js'
import { Chart as Misto, Doughnut } from 'react-chartjs-2'
import type { Resumo } from '../lib/calc'
import { temPrevisao, type DiaADia, type PrevisaoMes } from '../lib/previsao'
import { hojeLocal } from '../lib/cartoes'
import { useModoDoGrafico, type ModoDoGrafico } from '../lib/modoDoGrafico'
import { PALETA, useCoresDoGrafico } from '../lib/charts'
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { fmtDataCurta, fmtMoeda, fmtValor, MESES_CURTO, MESES_NOME, moedaAtual, valoresEstaoOcultos } from '../lib/format'
import { Icone } from './Icone'
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

const barra = (label: string, cores: readonly [string, string], data: (number | null)[], compacto?: boolean, stack?: string) => ({
  type: 'bar' as const, label, data, order: 2, ...(stack ? { stack } : {}),
  backgroundColor: degradeBarra(cores), hoverBackgroundColor: cores[0],
  borderRadius: compacto ? 3 : 5, borderSkipped: 'start' as const,
  maxBarThickness: compacto ? 10 : 20, categoryPercentage: 0.64, barPercentage: 0.84,
})

/** Fundo listrado na cor da barra: o que ainda não aconteceu (o desenho avisa, sem depender só da cor). */
const listrado = (cor: string) => (ctx: ScriptableContext<'bar'>) => {
  const alvo = ctx.chart.ctx
  const tela = document.createElement('canvas')
  tela.width = tela.height = 8
  const t = tela.getContext('2d')
  if (!alvo || !t) return comAlfa(cor, 0.3)
  t.fillStyle = comAlfa(cor, 0.16)
  t.fillRect(0, 0, 8, 8)
  t.strokeStyle = comAlfa(cor, 0.85)
  t.lineWidth = 2
  t.beginPath()
  for (const d of [-8, 0, 8]) { t.moveTo(d, 8); t.lineTo(d + 8, 0) }
  t.stroke()
  return alvo.createPattern(tela, 'repeat') ?? comAlfa(cor, 0.3)
}

/** Barra do que ainda vem (Vai entrar / Vai sair): listrada, empilhada em cima da barra do que já aconteceu. */
const barraPrevista = (label: string, cor: string, data: (number | null)[], compacto: boolean | undefined, stack: string) => ({
  type: 'bar' as const, label, data, order: 2, stack, previsto: true,
  backgroundColor: listrado(cor), hoverBackgroundColor: cor, borderColor: cor, borderWidth: 1.5,
  borderRadius: compacto ? 3 : 5, borderSkipped: false as const,
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
    ...(area ? { fill: 'origin', backgroundColor: comAlfa(cor, 0.11) } : {}),
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
            const prevista = Boolean((d as { previsto?: boolean }).previsto)
            return {
              text: d.label ?? '', datasetIndex: i, hidden: !chart.isDatasetVisible(i), fontColor: c.texto,
              fillStyle: prevista ? comAlfa(cor, 0.35) : cor, strokeStyle: cor, lineWidth: linhaSerie ? 3 : prevista ? 1.5 : 0,
              pointStyle: linhaSerie ? 'line' : 'rectRounded',
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
/** Saldo de mês futuro que ninguém informou é desconhecido, não zero: a linha para em vez de despencar. */
const saldo = (meses: (Resumo | null)[], f: (r: Resumo) => number) => meses.map((r) => (r && !r.saldoDesconhecido ? f(r) : null))
const centavos = (n: number) => Math.round(n * 100) / 100

/**
 * O que cada mês mostra nas barras, conforme o modo: o que já aconteceu (mês futuro sem nada acontecido fica em branco) e,
 * no modo "O que vem aí", também o que ainda vai entrar e sair (um mês só com previsão também aparece).
 */
function fluxoDosMeses(porMes: (Resumo | null)[], previsto: PrevisaoMes[], modo: ModoDoGrafico) {
  const vazio = (i: number) => !porMes[i] || (previsto[i].futuro && previsto[i].entrou === 0 && previsto[i].saiu === 0)
  const aparece = (i: number) => !vazio(i) || (modo === 'previsto' && temPrevisao(previsto[i]))
  const pegar = (f: (p: PrevisaoMes) => number) => previsto.map((p, i) => (aparece(i) ? f(p) : null))
  return {
    entrou: pegar((p) => p.entrou),
    saiu: pegar((p) => p.saiu),
    vaiEntrar: pegar((p) => p.vaiEntrar),
    vaiSair: pegar((p) => p.vaiSair),
    sobrou: previsto.map((p, i) => (vazio(i) ? null : centavos(p.entrou - p.saiu))),
    vaiSobrar: previsto.map((p) => (temPrevisao(p) ? centavos(p.entrou + p.vaiEntrar - p.saiu - p.vaiSair) : null)),
  }
}

/** Com barras empilhadas (o que já aconteceu + o que vem aí), cada linha leva a sua própria pilha, para não somar uma na outra. */
function empilhar<T extends { type?: string }>(datasets: T[], opcoesBase: ChartOptions<'bar'>) {
  return {
    datasets: datasets.map((d, i) => (d.type === 'line' ? { ...d, stack: `linha${i}` } : d)),
    opcoes: { ...opcoesBase, scales: { ...opcoesBase.scales, x: { ...opcoesBase.scales?.x, stacked: true }, y: { ...opcoesBase.scales?.y, stacked: true } } } as ChartOptions<'bar'>,
  }
}

/** Escolha do que os gráficos de fluxo mostram. */
export function SeletorDoModo({ modo, aoMudar }: { modo: ModoDoGrafico; aoMudar: (m: ModoDoGrafico) => void }) {
  return (
    <Segmentado rotulo={tx('O que mostrar no gráfico')} valor={modo} aoMudar={aoMudar}
      opcoes={[{ id: 'feito', nome: tx('Já aconteceu') }, { id: 'previsto', nome: tx('O que vem aí') }]} />
  )
}

/**
 * Fluxo financeiro da Início: Entrou e Saiu em barras lado a lado e a linha brilhante do que sobrou, nos 6 meses até o
 * aberto (de jan a jun quando o mês aberto é antes de junho). Mês sem dados fica em branco.
 */
export function GraficoFluxo({ porMes, previsto, modo = 'feito', mesAtual, altura, compacto, moeda }: {
  porMes: (Resumo | null)[]; mesAtual: number
  /** O que já aconteceu e o que ainda vem em cada mês do ano. */
  previsto: PrevisaoMes[]; modo?: ModoDoGrafico
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
  // Na moeda principal o gráfico segue o modo; em outra moeda os valores são os lançados, sem previsão.
  const f = fluxoDosMeses(porMes, previsto, fora ? 'feito' : modo)
  const janela = <T,>(xs: T[]) => xs.slice(inicio, inicio + 6)
  const comPrevisao = !fora && modo === 'previsto'
  const base = opcoes(c, { rotulos: MESES_CURTO.slice(inicio, inicio + 6), mesDoIndice: (i) => inicio + i + 1, mesAtual, compacto, legenda: false, destacar: true, formatar: fora ? (n) => fmtMoeda(n, moeda!) : fmtValor })
  const series = fora
    ? [
        barra(tx('Entrou'), PALETA.entradas, serie(meses, entrou), compacto),
        barra(tx('Saiu'), PALETA.saidas, serie(meses, saiu), compacto),
        linha(tx('Sobrou'), PALETA.sobrou, serie(meses, (r) => Math.round((entrou(r) - saiu(r)) * 100) / 100), c.fundo, compacto),
      ]
    : [
        barra(tx('Entrou'), PALETA.entradas, janela(f.entrou), compacto, comPrevisao ? 'entrou' : undefined),
        barra(tx('Saiu'), PALETA.saidas, janela(f.saiu), compacto, comPrevisao ? 'saiu' : undefined),
        ...(comPrevisao ? [
          barraPrevista(tx('Vai entrar'), PALETA.entradas[0], janela(f.vaiEntrar), compacto, 'entrou'),
          barraPrevista(tx('Vai sair'), PALETA.saidas[0], janela(f.vaiSair), compacto, 'saiu'),
        ] : []),
        linha(tx('Sobrou'), PALETA.sobrou, janela(f.sobrou), c.fundo, compacto),
        ...(comPrevisao ? [linha(tx('Vai sobrar'), PALETA.sobrou, janela(f.vaiSobrar), c.fundo, compacto, { borderDash: [5, 4] })] : []),
      ]
  const { datasets, opcoes: opcoesFinais } = comPrevisao ? empilhar(series, base) : { datasets: series, opcoes: base }
  const data = { labels: MESES_CURTO.slice(inicio, inicio + 6), datasets } as unknown as ChartData<'bar'>
  return (
    <CaixaDoGrafico style={altura ? { height: altura } : undefined}>
      <Misto type="bar" key={c.tema + c.ocultos + (fora ? moeda : '') + modo} data={data} options={opcoesFinais} />
    </CaixaDoGrafico>
  )
}

/**
 * O gráfico do Resumo do ano, só que de um mês: um ponto por dia no lugar de um por mês. Entrou e Saiu em barras (com "O que
 * vem aí", o que ainda vai entrar e sair listrado em cima), as linhas suaves do que sobrou no mês até cada dia e das dívidas
 * (com a sombra leve, como no ano), e o painel do dia ao lado: tocar ou passar o mouse num dia escolhe o dia do painel.
 */
export function GraficoDoMes({ dd, ano, mes, divida, altura = 300, compacto }: {
  dd: DiaADia; ano: number; mes: number; altura?: number; compacto?: boolean
  /** Quanto se deve ao fim de cada dia (sem o módulo de dívidas, não vem). */
  divida?: number[]
}) {
  const c = useCoresDoGrafico()
  const [modo, setModo] = useModoDoGrafico()
  const temVem = dd.vaiEntrar > 0 || dd.vaiSair > 0
  const comPrevisao = temVem && modo === 'previsto'
  // até onde as séries do que já aconteceu vão: o mês que ainda não começou não tem nada; o que já acabou vai até o fim
  const ultimoFeito = dd.hoje
  const dias = Array.from({ length: dd.dias }, (_, i) => i + 1)
  const rotulos = dias.map(String)
  const nulo = (n: number) => (n ? centavos(n) : null)
  const entrou = dias.map((d) => (d <= ultimoFeito ? nulo(dd.entrouDia[d - 1]) : null))
  const saiu = dias.map((d) => (d <= ultimoFeito ? nulo(dd.saiuDia[d - 1]) : null))
  const vaiEntrar = dias.map((d) => nulo(dd.vaiEntrarDia[d - 1]))
  const vaiSair = dias.map((d) => nulo(dd.vaiSairDia[d - 1]))
  // o que sobrou no mês até cada dia; com "O que vem aí", somando também o que ainda vem
  let feito = 0, comVem = 0
  const acumulado = dias.map((d) => {
    feito += dd.entrouDia[d - 1] - dd.saiuDia[d - 1]
    comVem += dd.entrouDia[d - 1] - dd.saiuDia[d - 1] + dd.vaiEntrarDia[d - 1] - dd.vaiSairDia[d - 1]
    return { feito: centavos(feito), comVem: centavos(comVem) }
  })
  const sobrou = dias.map((d, i) => (d <= ultimoFeito ? acumulado[i].feito : comPrevisao ? acumulado[i].comVem : null))
  const dividas = divida ? dias.map((d, i) => (d <= ultimoFeito || comPrevisao ? centavos(divida[i]) : null)) : null
  // o dia do painel: hoje, até a pessoa escolher outro (vale enquanto o mês aberto não mudar)
  // no mês que já acabou, o último dia que teve movimento (o último dia do mês costuma vir vazio)
  const ultimoComMovimento = dias.filter((d) => d <= dd.hoje && (dd.entrouDia[d - 1] || dd.saiuDia[d - 1])).at(-1)
  const padrao = (dd.hoje === dd.dias && ultimoComMovimento ? ultimoComMovimento : Math.min(dd.dias, Math.max(1, dd.hoje || 1))) - 1
  const [escolha, setEscolha] = useState<{ ref: string; indice: number } | null>(null)
  const ref = `${ano}-${mes}`
  const indice = escolha && escolha.ref === ref ? escolha.indice : padrao
  const escolher = (i: number) => setEscolha({ ref, indice: Math.min(dd.dias - 1, Math.max(0, i)) })
  const series = [
    barra(tx('Entrou'), PALETA.entradas, entrou, compacto, comPrevisao ? 'entrou' : undefined),
    barra(tx('Saiu'), PALETA.saidas, saiu, compacto, comPrevisao ? 'saiu' : undefined),
    ...(comPrevisao ? [
      barraPrevista(tx('Vai entrar'), PALETA.entradas[0], vaiEntrar, compacto, 'entrou'),
      barraPrevista(tx('Vai sair'), PALETA.saidas[0], vaiSair, compacto, 'saiu'),
    ] : []),
    {
      ...linhaSuave(tx('Sobrou no mês'), PALETA.sobrou, sobrou, c.fundo, compacto),
      // reta de um dia para o outro: a curva suave subia antes de o dinheiro entrar
      cubicInterpolationMode: 'default' as const, tension: 0,
      // depois de hoje, tracejada: é o que ainda vem
      segment: { borderDash: (x: { p1DataIndex: number }) => (x.p1DataIndex >= ultimoFeito ? [5, 4] : undefined) },
    },
    // a dívida é muito maior que o dia a dia e achataria as barras: começa escondida, um toque na legenda mostra
    ...(dividas ? [{ ...linhaSuave(tx('Dívidas'), PALETA.divida, dividas, c.fundo, compacto, true), hidden: true }] : []),
  ].map((x) => (x.type === 'bar' ? { ...x, categoryPercentage: 0.82, barPercentage: 0.92 } : x))
  const opcoesBase = opcoes(c, { rotulos, mesDoIndice: (i) => i + 1, mesAtual: indice + 1, compacto, destacar: true })
  // no eixo, só alguns dias (1, 5, 10…) e o de hoje; o resto aparece no painel
  const folga = compacto ? 3 : 2
  const mostra = (i: number) => {
    const d = i + 1
    if (d === 1 || d === dd.dias || (d === dd.hoje && dd.hoje < dd.dias)) return true
    // os redondos (5, 10…) saem quando ficam colados no último dia ou no de hoje
    const perto = (x: number) => Math.abs(d - x) < folga
    return (compacto ? d % 10 === 0 : d % 5 === 0) && !perto(dd.dias) && !(dd.hoje < dd.dias && perto(dd.hoje)) && d > folga
  }
  const base: ChartOptions<'bar'> = {
    ...opcoesBase,
    onClick: (e: ChartEvent, _: unknown, chart: ChartJS) => {
      const i = chart.getElementsAtEventForMode(e as unknown as Event, 'index', { intersect: false }, true)[0]?.index
      if (i !== undefined && i !== indice) escolher(i)
    },
    onHover: (e: ChartEvent, _: unknown, chart: ChartJS) => {
      if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
      const i = chart.getElementsAtEventForMode(e as unknown as Event, 'index', { intersect: false }, true)[0]?.index
      if (i !== undefined && i !== indice) escolher(i)
    },
    plugins: { ...opcoesBase.plugins, tooltip: { enabled: false }, filler: { drawTime: 'beforeDatasetsDraw' } },
    scales: {
      ...opcoesBase.scales,
      x: {
        ...opcoesBase.scales?.x,
        ticks: {
          ...opcoesBase.scales?.x?.ticks,
          color: (t: { index: number }) => (t.index === dd.hoje - 1 || t.index === indice ? c.textoForte : c.texto),
          font: (t: { index: number }) => ({ weight: t.index === indice ? 800 : 600, size: compacto ? 9 : 11 }),
          callback: (_v: string | number, i: number) => (mostra(i) ? rotulos[i] : ''),
        },
      },
    } as ChartOptions<'bar'>['scales'],
  }
  const { datasets, opcoes: opcoesFinais } = comPrevisao ? empilhar(series as { type?: string }[], base) : { datasets: series, opcoes: base }
  const data = { labels: rotulos, datasets } as unknown as ChartData<'bar'>
  return (
    <>
      {temVem && <div className="grafico-moeda"><SeletorDoModo modo={modo} aoMudar={setModo} /></div>}
      <div className="grafico-com-painel">
        <div className="gcp">
          <CaixaDoGrafico style={{ height: altura }}>
            <Misto type="bar" key={c.tema + c.ocultos + modo + dd.dias} data={data} options={opcoesFinais} />
          </CaixaDoGrafico>
          <PainelDoDia indice={indice} dd={dd} ano={ano} mes={mes} aoMudar={escolher} comPrevisao={comPrevisao}
            sobrou={acumulado[indice]} divida={divida?.[indice]} />
        </div>
      </div>
    </>
  )
}

/** O painel do dia escolhido no gráfico do mês, com as setas para andar de um dia para o outro (o mesmo do painel do ano). */
function PainelDoDia({ indice, dd, ano, mes, aoMudar, comPrevisao, sobrou, divida }: {
  indice: number; dd: DiaADia; ano: number; mes: number; aoMudar: (i: number) => void; comPrevisao: boolean
  sobrou: { feito: number; comVem: number }; divida?: number
}) {
  const d = indice + 1
  const iso = `${ano}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  const aconteceu = d <= dd.hoje
  const entrou = aconteceu ? dd.entrouDia[indice] : 0
  const saiu = aconteceu ? dd.saiuDia[indice] : 0
  const vaiEntrar = dd.vaiEntrarDia[indice]
  const vaiSair = dd.vaiSairDia[indice]
  const mostraVem = comPrevisao && (vaiEntrar > 0 || vaiSair > 0)
  const nada = !entrou && !saiu && !mostraVem
  const ate = aconteceu || !comPrevisao ? sobrou.feito : sobrou.comVem
  const linha = (nome: string, valor: string, tom: string) => (
    <div className="pm-linha"><span>{nome}</span><b className={`pm-valor ${tom}`}>{valor}</b></div>
  )
  return (
    <aside className="painel-mes" aria-live="polite">
      <div className="pm-topo">
        <button className="pm-nav" onClick={() => aoMudar(indice - 1)} disabled={indice <= 0} aria-label={tx('Dia anterior')}><Icone nome="esq" tamanho={16} /></button>
        <h3>{iso === hojeLocal() ? tx('Hoje, {0}', fmtDataCurta(iso)) : fmtDataCurta(iso)}</h3>
        <button className="pm-nav" onClick={() => aoMudar(indice + 1)} disabled={indice >= dd.dias - 1} aria-label={tx('Próximo dia')}><Icone nome="dir" tamanho={16} /></button>
      </div>
      {nada ? <p className="pm-vazio">{aconteceu ? tx('Nada entrou nem saiu neste dia.') : tx('Nada previsto para este dia.')}</p> : (
        <>
          {(entrou > 0 || saiu > 0) && (
            <>
              {linha(tx('Entrou'), fmtValor(entrou), 'entrou')}
              {linha(tx('Saiu'), fmtValor(saiu), 'saiu')}
            </>
          )}
          {mostraVem && (
            <>
              {(entrou > 0 || saiu > 0) && <hr className="pm-sep" />}
              {linha(tx('Vai entrar'), fmtValor(vaiEntrar), 'entrou')}
              {linha(tx('Vai sair'), fmtValor(vaiSair), 'saiu')}
            </>
          )}
        </>
      )}
      {(aconteceu || comPrevisao) && (
        <>
          <hr className="pm-sep" />
          {linha(ate >= 0 ? tx('Sobrou no mês até aqui') : tx('Faltou no mês até aqui'), fmtValor(Math.abs(ate)), ate >= 0 ? 'entrou' : 'saiu')}
          {divida !== undefined && linha(tx('Dívidas'), fmtValor(divida), 'divida')}
        </>
      )}
    </aside>
  )
}

/**
 * Mês a mês do ano, como o gráfico da planilha: Entrou e Saiu em barras e, por cima, as linhas brilhantes do que a pessoa
 * acompanha (guardado nas contas, dívidas, investido, outras moedas), conforme os módulos ligados.
 */
/** De onde veio a subida ou a descida da dívida no mês, como pares nome/valor (com sinal). */
function origensDaDivida(r: Resumo | null | undefined): [string, number][] {
  if (!r) return []
  const l: [string, number][] = []
  if (r.dividaNovas) l.push([tx('nova dívida'), r.dividaNovas])
  if (r.dividaAumentos) l.push([tx('emprestado a mais'), r.dividaAumentos])
  if (r.dividaAjustes) l.push([tx('ajuste de saldo'), r.dividaAjustes])
  if (r.dividaJuros) l.push([tx('juros do atraso (estimado)'), r.dividaJuros])
  if (r.dividaPagos) l.push([tx('pagamentos'), -r.dividaPagos])
  return l
}

/**
 * Resumo do mês escolhido no gráfico, num painel fixo (ao lado do gráfico em tela larga, embaixo em tela estreita).
 * Substitui o card que abria em cima do gráfico e escondia as barras e a linha.
 */
function PainelDoMes({ indice, r, v, fora, moeda, aoMudar, p, modo }: {
  indice: number; r: Resumo | null; v: Visao; fora: boolean; moeda: string; aoMudar: (i: number) => void
  /** O que já aconteceu e o que ainda vem neste mês; com o modo, diz o que o painel mostra. */
  p?: PrevisaoMes; modo: ModoDoGrafico
}) {
  const comPrevisao = !fora && modo === 'previsto' && temPrevisao(p)
  // mesmo critério do gráfico: mês futuro em que nada aconteceu ainda fica em branco
  const semNadaFeito = !fora && !comPrevisao && Boolean(p?.futuro) && p!.entrou === 0 && p!.saiu === 0
  const fmt = fora ? (n: number) => fmtMoeda(n, moeda) : fmtValor
  const sinal = (n: number) => `${n < 0 ? '−' : '+'}${fmt(Math.abs(n))}`
  // Na moeda principal o painel mostra o que já aconteceu (a fatura em aberto só entra em "Vai sair").
  const entrou = r ? (fora ? (r.entradasMoeda[moeda] ?? 0) : p ? p.entrou : r.entradas) : 0
  const saiu = r ? (fora ? (r.saidasMoeda[moeda] ?? 0) : p ? p.saiu : r.saidas) : 0
  const semSaldo = !fora && Boolean(r?.saldoDesconhecido)
  const dif = Math.round((entrou - saiu) * 100) / 100
  const guardado = r ? (fora ? (r.moedas[moeda] ?? 0) : r.caixa) : 0
  const divida = r ? (fora ? (r.dividaMoeda[moeda] ?? 0) : r.divida) : 0
  const origens = r && !fora ? origensDaDivida(r) : []
  const linha = (nome: string, valor: string, tom: string) => (
    <div className="pm-linha"><span>{nome}</span><b className={`pm-valor ${tom}`}>{valor}</b></div>
  )
  return (
    <aside className="painel-mes" aria-live="polite">
      <div className="pm-topo">
        <button className="pm-nav" onClick={() => aoMudar(indice - 1)} disabled={indice <= 0} aria-label={tx('Mês anterior')}><Icone nome="esq" tamanho={16} /></button>
        <h3>{MESES_NOME[indice]}</h3>
        <button className="pm-nav" onClick={() => aoMudar(indice + 1)} disabled={indice >= 11} aria-label={tx('Próximo mês')}><Icone nome="dir" tamanho={16} /></button>
      </div>
      {(!r || semNadaFeito) && !comPrevisao ? <p className="pm-vazio">{tx('Sem lançamentos neste mês.')}</p> : (
        <>
          {linha(tx('Entrou'), fmt(entrou), 'entrou')}
          {linha(tx('Saiu'), fmt(saiu), 'saiu')}
          {linha(dif >= 0 ? tx('Sobrou') : tx('Faltou'), fmt(Math.abs(dif)), dif >= 0 ? 'entrou' : 'saiu')}
          {comPrevisao && p && (() => {
            const vai = centavos(entrou + p.vaiEntrar - saiu - p.vaiSair)
            return (
              <>
                <hr className="pm-sep" />
                {linha(tx('Vai entrar'), fmt(p.vaiEntrar), 'entrou')}
                {linha(tx('Vai sair'), fmt(p.vaiSair), 'saiu')}
                {linha(vai >= 0 ? tx('Vai sobrar') : tx('Vai faltar'), fmt(Math.abs(vai)), vai >= 0 ? 'entrou' : 'saiu')}
                {p.vaiEntrar === 0 && <p className="pm-aviso">{tx('Nenhum dinheiro previsto para entrar neste mês.')}</p>}
              </>
            )
          })()}
          {r && ((fora ? guardado > 0 : v.bancos && !semSaldo) || (fora ? divida > 0 : v.dividas) || (!fora && ((v.investimentos || v.moedas) && !semSaldo))) && <hr className="pm-sep" />}
          {r && (fora ? guardado > 0 : v.bancos && !semSaldo) && linha(fora ? tx('Guardado em {0}', moeda) : tx('Guardado nas contas'), fmt(guardado), 'caixa')}
          {r && (fora ? divida > 0 : v.dividas) && linha(fora ? tx('Dívidas em {0}', moeda) : tx('Dívidas'), fmt(divida), 'divida')}
          {origens.length > 0 && (
            <ul className="pm-origem">
              {origens.map(([nome, valor]) => <li key={nome}><span>{nome}</span><b>{sinal(valor)}</b></li>)}
            </ul>
          )}
          {r && !fora && v.investimentos && !semSaldo && linha(tx('Investido'), fmt(r.investimentos), 'invest')}
          {r && !fora && v.moedas && !semSaldo && linha(tx('Em outras moedas'), fmt(r.moedasConvertido), 'usd')}
        </>
      )}
    </aside>
  )
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

export function GraficoAnual({ porMes, previsto, mesAtual, altura = 400, compacto, v }: {
  porMes: (Resumo | null)[]; mesAtual: number; altura?: number; v: Visao
  /** O que já aconteceu e o que ainda vem em cada mês. */
  previsto: PrevisaoMes[]
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
  const [modo, setModo] = useModoDoGrafico()
  const temDividaFora = porMes.some((r) => r && Object.keys(r.dividaMoeda).length > 0)
  const algum = (f: (r: Resumo) => number) => porMes.some((r) => r && f(r) > 0)
  // O mês do painel: o aberto no app, até a pessoa tocar em outro mês do gráfico (valendo só enquanto o mês aberto não mudar).
  const [escolha, setEscolha] = useState<{ ref: number; indice: number } | null>(null)
  const indice = escolha && escolha.ref === mesAtual ? escolha.indice : Math.min(11, Math.max(0, mesAtual - 1))
  const escolher = (i: number) => setEscolha({ ref: mesAtual, indice: Math.min(11, Math.max(0, i)) })
  const comPrevisao = !fora && modo === 'previsto'
  const f = fluxoDosMeses(porMes, previsto, fora ? 'feito' : modo)
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
          barra(tx('Entrou'), PALETA.entradas, f.entrou, compacto, comPrevisao ? 'entrou' : undefined),
          barra(tx('Saiu'), PALETA.saidas, f.saiu, compacto, comPrevisao ? 'saiu' : undefined),
          ...(comPrevisao ? [
            barraPrevista(tx('Vai entrar'), PALETA.entradas[0], f.vaiEntrar, compacto, 'entrou'),
            barraPrevista(tx('Vai sair'), PALETA.saidas[0], f.vaiSair, compacto, 'saiu'),
          ] : []),
          ...(v.bancos ? [linhaSuave(tx('Guardado nas contas'), PALETA.caixa, saldo(porMes, (r) => r.caixa), c.fundo, compacto)] : []),
          ...(v.dividas ? [linhaSuave(tx('Dívidas'), PALETA.divida, serie(porMes, (r) => r.divida), c.fundo, compacto, true)] : []),
          ...(v.investimentos ? [linhaSuave(tx('Investido'), PALETA.investimentos, saldo(porMes, (r) => r.investimentos), c.fundo, compacto)] : []),
          ...(v.moedas ? [linhaSuave(tx('Em outras moedas'), PALETA.usd, saldo(porMes, (r) => r.moedasConvertido), c.fundo, compacto)] : []),
        ],
      }) as unknown as ChartData<'bar'>
  const opcoesBase = opcoes(c, { rotulos: MESES_CURTO, mesDoIndice: (i) => i + 1, mesAtual: indice + 1, compacto, destacar: true, formatar: fora ? (n) => fmtMoeda(n, moeda) : fmtValor })
  // Sem card flutuante: tocar (ou, com mouse, passar) num mês escolhe o mês do painel. A sombra da dívida é desenhada antes de
  // qualquer série, atrás das barras, que continuam nítidas.
  const base: ChartOptions<'bar'> = {
    ...opcoesBase,
    onClick: (e: ChartEvent, _: unknown, chart: ChartJS) => {
      const i = chart.getElementsAtEventForMode(e as unknown as Event, 'index', { intersect: false }, true)[0]?.index
      if (i !== undefined && i !== indice) escolher(i)
    },
    onHover: (e: ChartEvent, _: unknown, chart: ChartJS) => {
      if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
      const i = chart.getElementsAtEventForMode(e as unknown as Event, 'index', { intersect: false }, true)[0]?.index
      if (i !== undefined && i !== indice) escolher(i)
    },
    plugins: { ...opcoesBase.plugins, tooltip: { enabled: false }, filler: { drawTime: 'beforeDatasetsDraw' } },
  }
  const { datasets: seriesFinais, opcoes: opcoesFinais } = comPrevisao
    ? empilhar(data.datasets as { type?: string }[], base)
    : { datasets: data.datasets, opcoes: base }
  const dadosFinais = { ...data, datasets: seriesFinais } as unknown as ChartData<'bar'>
  return (
    <>
      <div className="grafico-moeda">
        {!fora && <SeletorDoModo modo={modo} aoMudar={setModo} />}
        {extras.length > 0 && (
          <Segmentado rotulo={tx('Ver o gráfico em')} valor={moeda} aoMudar={setEscolhida}
            opcoes={[principal, ...extras].map((m) => ({ id: m, nome: m }))} />
        )}
      </div>
      <div className="grafico-com-painel">
        <div className="gcp">
          <CaixaDoGrafico style={{ height: altura }}>
            <Misto type="bar" key={c.tema + c.ocultos + moeda + modo} data={dadosFinais} options={opcoesFinais} />
          </CaixaDoGrafico>
          <PainelDoMes indice={indice} r={porMes[indice] ?? null} v={v} fora={fora} moeda={moeda} aoMudar={escolher} p={previsto[indice]} modo={modo} />
        </div>
      </div>
      {fora
        ? <p className="campo-ajuda">{tx('Valores em {0}, como você lançou: sem conversão. Entrou, Saiu e Dívidas só desta moeda.', moeda)}</p>
        : temDividaFora && <p className="campo-ajuda">{tx('As dívidas em outras moedas entram aqui pela cotação de hoje. Para ver os valores exatos, escolha a moeda acima.')}</p>}
    </>
  )
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
