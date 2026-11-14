/**
 * Comparação dos gastos com o mês anterior, de um jeito justo:
 *
 *  - **Mês que está correndo**: do dia 1 até hoje contra o **mesmo intervalo** do mês anterior (dia 14 contra dia 14; num
 *    mês mais curto, até o último dia dele). Antes, o "ritmo" dividia o gasto até hoje pelos dias que passaram e comparava
 *    com a média do mês passado inteiro: no dia 3, o aluguel pago no dia 1 virava "gastando muito mais".
 *  - **Mês que já acabou**: o mês inteiro contra o mês anterior inteiro.
 *  - A mesma regra nos dois lados: entra o lançamento de saída do mês com data até o dia de corte (ou sem data). Compra no
 *    cartão entra pela data da parcela, como no resto do app. Dinheiro guardado não é gasto (quem chama já tira).
 *  - Sem gasto no período anterior não há porcentagem (crescer "∞%" não diz nada): fica só a diferença em dinheiro.
 *  - Sem nenhum lançamento no mês anterior, não há comparação: o resultado diz isso (`semBase`).
 *
 * É puro: recebe os lançamentos, a data de hoje e como achar a categoria.
 */
import { MESES_CURTO, noMeioDaFrase } from './format'
import { tx } from './textos'
import type { Lancamento } from './types'

export interface LinhaComparada {
  /** Id da categoria ('' = sem categoria). */
  id: string
  atual: number
  anterior: number
  /** atual − anterior */
  diferenca: number
  /** Os lançamentos que formam cada lado (para a pessoa ver de onde veio a mudança). */
  lancsAtual: Lancamento[]
  lancsAnterior: Lancamento[]
}

export interface ComparacaoDeGastos {
  ano: number
  mes: number
  anoAnterior: number
  mesAnterior: number
  /** Dia de corte nos dois meses (null = meses inteiros). */
  ateDia: number | null
  ateDiaAnterior: number | null
  atual: number
  anterior: number
  /** (atual − anterior) / anterior; null quando o anterior é zero. */
  variacao: number | null
  /** O mês anterior não tem nenhum lançamento: não dá para comparar. */
  semBase: boolean
  /** Por categoria, da maior mudança (em dinheiro) para a menor. Só as que tiveram gasto em algum dos lados. */
  categorias: LinhaComparada[]
  /** A categoria que mais cresceu e a que mais caiu, quando a mudança passa do ruído (`RELEVANTE`). */
  maiorAlta: LinhaComparada | null
  maiorQueda: LinhaComparada | null
}

/** Mudança de categoria menor que isto (da parte do maior total) é ruído e não vira destaque. */
export const RELEVANTE = 0.03

const dois = (n: number) => String(n).padStart(2, '0')
const centavos = (n: number) => Math.round(n * 100) / 100
const diasNoMes = (ano: number, mes: number) => new Date(ano, mes, 0).getDate()

export function compararGastos({ lancs, ano, mes, hoje, categoriaDe }: {
  /** Saídas e entradas do mês e do anterior (podem vir outros meses junto). Sem os guardados. */
  lancs: Lancamento[]
  ano: number
  mes: number
  /** AAAA-MM-DD de hoje, no fuso do aparelho. */
  hoje: string
  categoriaDe: (l: Lancamento) => string | undefined
}): ComparacaoDeGastos | null {
  const [anoA, mesA] = mes === 1 ? [ano - 1, 12] : [ano, mes - 1]
  const este = ano * 12 + mes
  const agora = +hoje.slice(0, 4) * 12 + +hoje.slice(5, 7)
  // um mês que ainda não começou não tem gasto para comparar
  if (este > agora) return null
  const correndo = este === agora
  const ateDia = correndo ? +hoje.slice(8, 10) : null
  const ateDiaAnterior = ateDia === null ? null : Math.min(ateDia, diasNoMes(anoA, mesA))
  const corte = (a: number, m: number, d: number | null) => (d === null ? null : `${a}-${dois(m)}-${dois(d)}`)
  const corteAtual = corte(ano, mes, ateDia)
  const corteAnterior = corte(anoA, mesA, ateDiaAnterior)
  const dentro = (l: Lancamento, c: string | null) => c === null || !l.data || l.data <= c

  const doMes = (a: number, m: number) => lancs.filter((l) => l.ano === a && l.mes === m)
  const anteriorTodo = doMes(anoA, mesA)
  const saidas = (xs: Lancamento[], c: string | null) => xs.filter((l) => l.tipo === 'saida' && dentro(l, c))
  const ladoAtual = saidas(doMes(ano, mes), corteAtual)
  const ladoAnterior = saidas(anteriorTodo, corteAnterior)
  const soma = (xs: Lancamento[]) => centavos(xs.reduce((t, l) => t + l.valor, 0))
  const atual = soma(ladoAtual)
  const anterior = soma(ladoAnterior)

  const linhas = new Map<string, LinhaComparada>()
  const linha = (id: string) => linhas.get(id) ?? linhas.set(id, { id, atual: 0, anterior: 0, diferenca: 0, lancsAtual: [], lancsAnterior: [] }).get(id)!
  for (const l of ladoAtual) { const x = linha(categoriaDe(l) ?? ''); x.atual += l.valor; x.lancsAtual.push(l) }
  for (const l of ladoAnterior) { const x = linha(categoriaDe(l) ?? ''); x.anterior += l.valor; x.lancsAnterior.push(l) }
  const porValor = (a: Lancamento, b: Lancamento) => b.valor - a.valor
  const categorias = [...linhas.values()]
    .map((x) => ({ ...x, atual: centavos(x.atual), anterior: centavos(x.anterior), diferenca: centavos(x.atual - x.anterior), lancsAtual: x.lancsAtual.sort(porValor), lancsAnterior: x.lancsAnterior.sort(porValor) }))
    .sort((a, b) => Math.abs(b.diferenca) - Math.abs(a.diferenca) || b.atual - a.atual)

  const semBase = anteriorTodo.length === 0
  const piso = Math.max(atual, anterior) * RELEVANTE
  const relevantes = semBase ? [] : categorias.filter((x) => Math.abs(x.diferenca) >= piso && x.diferenca !== 0)
  const maiorAlta = relevantes.filter((x) => x.diferenca > 0).sort((a, b) => b.diferenca - a.diferenca)[0] ?? null
  const maiorQueda = relevantes.filter((x) => x.diferenca < 0).sort((a, b) => a.diferenca - b.diferenca)[0] ?? null

  return {
    ano, mes, anoAnterior: anoA, mesAnterior: mesA, ateDia, ateDiaAnterior, atual, anterior,
    variacao: semBase || anterior <= 0 ? null : (atual - anterior) / anterior,
    semBase, categorias, maiorAlta, maiorQueda,
  }
}

export interface PilulaDeGastos { texto: string; tom: 'bom' | 'atencao' | 'ruim' }

/**
 * A comparação em uma pílula (o equilibrado mostra no cartão do mês; o detalhado, na peça "Gastos do mês"). Gastar até o
 * mesmo: verde; até 20% a mais: amarelo; mais que isso: vermelho. Sem base para comparar, nada.
 */
export function pilulaDeGastos(comp: ComparacaoDeGastos | null): PilulaDeGastos | null {
  if (!comp || comp.semBase || comp.variacao === null) return null
  const p = Math.round(Math.abs(comp.variacao) * 100)
  const mes = noMeioDaFrase(MESES_CURTO[comp.mesAnterior - 1])
  const tom = comp.variacao <= 0 ? 'bom' : comp.variacao <= 0.2 ? 'atencao' : 'ruim'
  const mesmo = comp.ateDia !== null
  if (p === 0) return { tom: 'bom', texto: mesmo ? tx('Gastos iguais aos do mesmo período de {0}', mes) : tx('Gastos iguais aos de {0}', mes) }
  if (comp.variacao > 0) return { tom, texto: mesmo ? tx('Gastos {0}% acima do mesmo período de {1}', p, mes) : tx('Gastos {0}% acima de {1}', p, mes) }
  return { tom, texto: mesmo ? tx('Gastos {0}% abaixo do mesmo período de {1}', p, mes) : tx('Gastos {0}% abaixo de {1}', p, mes) }
}
