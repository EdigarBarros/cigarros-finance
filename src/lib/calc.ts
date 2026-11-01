import type { SituacaoDivida } from './dividas'
import { totalConvertido, type Taxas } from './moedas'
import type { Caixa, Lancamento, Mes } from './types'
import { TIPOS_CAIXA } from './types'

const soma = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

export function somaCaixa(caixa?: Caixa) {
  if (!caixa) return 0
  return soma(Object.values(caixa).flatMap((b) => TIPOS_CAIXA.map((t) => b?.[t] ?? 0)))
}
export const caixaDoBanco = (caixa: Caixa, id: string) => soma(TIPOS_CAIXA.map((t) => caixa[id]?.[t] ?? 0))
export const totalCaixa = (m?: Mes) => somaCaixa(m?.caixa)

/** Mês com os valores que valem nele: o que foi informado, ou herdado do último mês informado. */
export interface MesEfetivo extends Mes {
  /** De onde veio o caixa/outras moedas, quando o mês não tem valores próprios. */
  herdadoDe: [number, number] | null
}

// "Zerei de propósito" x "nunca preenchi": o banco guarda os saldos por chave (banco/tipo e moeda), e só quem digitou
// (ou confirmou o mês) cria a chave; a planilha importada e o mês novo não gravam zeros. Então chave presente, mesmo com 0,
// é valor informado e não herda do mês anterior. Os investimentos são uma coluna número (0 por padrão): lá o 0 de quem
// nunca preencheu e o de quem zerou são iguais, e separar os dois pede uma migração no banco.
const caixaInformado = (c?: Caixa) => Object.values(c ?? {}).some((b) => TIPOS_CAIXA.some((t) => typeof b?.[t] === 'number'))
const moedasInformadas = (m?: Record<string, number>) => Object.values(m ?? {}).some((v) => typeof v === 'number')

/**
 * Caixa, investimentos, outras moedas e meta passam de um mês para o outro até você atualizar.
 * Só herda até o mês atual do calendário, para meses futuros não parecerem preenchidos.
 */
export function mesEfetivo(meses: Mes[], ano: number, mes: number, hoje = new Date()): MesEfetivo {
  const proprio = meses.find((m) => m.ano === ano && m.mes === mes)
  const base: Mes = proprio ?? { ano, mes, investimentos: 0, moedas: {}, meta_usd: 0, caixa: {} }
  const chave = ano * 12 + mes
  const podeHerdar = chave <= hoje.getFullYear() * 12 + hoje.getMonth() + 1
  const anteriores = meses.filter((m) => m.ano * 12 + m.mes < chave).sort((a, b) => b.ano * 12 + b.mes - (a.ano * 12 + a.mes))
  const ultimoCom = (f: (m: Mes) => boolean) => anteriores.find(f)

  let herdadoDe: [number, number] | null = null
  let caixa = base.caixa ?? {}
  let moedas = base.moedas ?? {}
  if (podeHerdar && !caixaInformado(caixa)) {
    const m = ultimoCom((x) => caixaInformado(x.caixa))
    if (m) {
      caixa = m.caixa
      herdadoDe = [m.ano, m.mes]
    }
  }
  if (podeHerdar && !moedasInformadas(moedas)) {
    const m = ultimoCom((x) => moedasInformadas(x.moedas))
    if (m) {
      moedas = m.moedas
      herdadoDe ??= [m.ano, m.mes]
    }
  }
  // investimento que você não atualizou continua lá (senão o patrimônio parece cair a zero no mês novo)
  let investimentos = base.investimentos
  if (podeHerdar && !investimentos) {
    const m = ultimoCom((x) => x.investimentos > 0)
    if (m) {
      investimentos = m.investimentos
      herdadoDe ??= [m.ano, m.mes]
    }
  }
  const meta = base.meta_usd || ultimoCom((x) => x.meta_usd > 0)?.meta_usd || 0
  return { ...base, caixa, moedas, investimentos, meta_usd: meta, herdadoDe }
}

/** Os números do quadro de resumo de cada mês. */
/** id da categoria de um lançamento ('' = sem categoria). */
export type CategoriaDoLanc = (l: Lancamento) => string

/** Soma, por moeda, o valor original dos lançamentos feitos em outra moeda (o que a pessoa de fato digitou). */
const nativoPorMoeda = (ls: Lancamento[]) => {
  const r: Record<string, number> = {}
  for (const l of ls) if (l.moeda_original && l.valor_original) r[l.moeda_original] = Math.round(((r[l.moeda_original] ?? 0) + l.valor_original) * 100) / 100
  return r
}

export function resumoMes(lancs: Lancamento[], dividas: SituacaoDivida[], mes: Mes | undefined, taxas: Taxas, categoriaDo: CategoriaDoLanc) {
  const entradas = soma(lancs.filter((l) => l.tipo === 'entrada').map((l) => l.valor))
  const saidasLista = lancs.filter((l) => l.tipo === 'saida')
  const saidas = soma(saidasLista.map((l) => l.valor))
  const gastosPorCategoria: Record<string, number> = {}
  for (const l of saidasLista) {
    const k = categoriaDo(l)
    gastosPorCategoria[k] = (gastosPorCategoria[k] ?? 0) + l.valor
  }

  // Dívida em outra moeda sem cotação não entra nos totais na moeda principal (só em `dividaMoeda`, na moeda dela).
  const convertidas = dividas.filter((d) => !d.semCotacao)
  return {
    entradas,
    saidas,
    fluxo: entradas - saidas,
    caixa: totalCaixa(mes),
    divida: soma(convertidas.map((d) => d.restante)),
    /** Em outra moeda, no valor que a pessoa digitou (sem conversão): entradas, saídas e dívidas de cada moeda. */
    entradasMoeda: nativoPorMoeda(lancs.filter((l) => l.tipo === 'entrada')),
    saidasMoeda: nativoPorMoeda(saidasLista),
    dividaMoeda: dividas.reduce<Record<string, number>>((r, d) => {
      if (d.moeda && d.restante > 0) r[d.moeda] = Math.round(((r[d.moeda] ?? 0) + d.restante / d.taxa) * 100) / 100
      return r
    }, {}),
    /** De onde veio a variação das dívidas no mês: nasceram, foram pagas, aumentaram (empréstimo) ou foram ajustadas (juros, acordo). */
    dividaNovas: soma(convertidas.map((d) => d.novaNoMes)),
    dividaPagos: soma(convertidas.map((d) => d.pagoNoMes)),
    dividaAumentos: soma(convertidas.map((d) => d.aumentoNoMes)),
    dividaAjustes: soma(convertidas.map((d) => d.ajusteNoMes)),
    parcelasMensais: soma(convertidas.filter((d) => d.restante > 0).map((d) => d.divida.valor_parcela ?? 0)),
    investimentos: mes?.investimentos ?? 0,
    moedas: mes?.moedas ?? {},
    /** Outras moedas somadas, na moeda principal (cotação de hoje). */
    moedasConvertido: totalConvertido(mes?.moedas ?? {}, taxas),
    /** Quanto saiu em cada categoria, pelo id ('' = sem categoria). */
    gastosPorCategoria,
  }
}

export type Resumo = ReturnType<typeof resumoMes>
