import type { SituacaoDivida } from './dividas'
import type { Caixa, Lancamento, Mes } from './types'
import { BANCOS, TIPOS_CAIXA } from './types'

const soma = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

export function somaCaixa(caixa?: Caixa) {
  if (!caixa) return 0
  return soma(BANCOS.flatMap((b) => TIPOS_CAIXA.map((t) => caixa[b]?.[t] ?? 0)))
}
export const totalCaixa = (m?: Mes) => somaCaixa(m?.caixa)

/** Mês com os valores que valem nele: o que foi informado, ou herdado do último mês informado. */
export interface MesEfetivo extends Mes {
  /** De onde veio o caixa/US$, quando o mês não tem valores próprios. */
  herdadoDe: [number, number] | null
}

/**
 * Caixa, US$ e meta passam de um mês para o outro até você atualizar.
 * Só herda até o mês atual do calendário, para meses futuros não parecerem preenchidos.
 */
export function mesEfetivo(meses: Mes[], ano: number, mes: number, hoje = new Date()): MesEfetivo {
  const proprio = meses.find((m) => m.ano === ano && m.mes === mes)
  const base: Mes = proprio ?? { ano, mes, investimentos: 0, usd: 0, meta_usd: 0, caixa: {} }
  const chave = ano * 12 + mes
  const podeHerdar = chave <= hoje.getFullYear() * 12 + hoje.getMonth() + 1
  const anteriores = meses.filter((m) => m.ano * 12 + m.mes < chave).sort((a, b) => b.ano * 12 + b.mes - (a.ano * 12 + a.mes))
  const ultimoCom = (f: (m: Mes) => boolean) => anteriores.find(f)

  let herdadoDe: [number, number] | null = null
  let caixa = base.caixa ?? {}
  let usd = base.usd
  if (podeHerdar && !somaCaixa(caixa)) {
    const m = ultimoCom((x) => somaCaixa(x.caixa) > 0)
    if (m) {
      caixa = m.caixa
      herdadoDe = [m.ano, m.mes]
    }
  }
  if (podeHerdar && !usd) {
    const m = ultimoCom((x) => x.usd > 0)
    if (m) {
      usd = m.usd
      herdadoDe ??= [m.ano, m.mes]
    }
  }
  const meta = base.meta_usd || ultimoCom((x) => x.meta_usd > 0)?.meta_usd || 0
  return { ...base, caixa, usd, meta_usd: meta, herdadoDe }
}

/** Os números do quadro de resumo de cada mês. */
export function resumoMes(lancs: Lancamento[], dividas: SituacaoDivida[], mes?: Mes) {
  const entradas = soma(lancs.filter((l) => l.tipo === 'entrada').map((l) => l.valor))
  const saidasLista = lancs.filter((l) => l.tipo === 'saida')
  const saidas = soma(saidasLista.map((l) => l.valor))
  const porCategoria = (c: string) => soma(saidasLista.filter((l) => l.categoria === c).map((l) => l.valor))
  const porConta = (c: string) => soma(saidasLista.filter((l) => l.conta === c).map((l) => l.valor))

  return {
    entradas,
    saidas,
    fluxo: entradas - saidas,
    caixa: totalCaixa(mes),
    divida: soma(dividas.map((d) => d.restante)),
    parcelasMensais: soma(dividas.filter((d) => d.restante > 0).map((d) => d.divida.valor_parcela ?? 0)),
    investimentos: mes?.investimentos ?? 0,
    usd: mes?.usd ?? 0,
    metaUsd: mes?.meta_usd ?? 0,
    // Como nas abas da planilha: DÍVIDAS nas métricas = saídas que foram pagamento de dívida.
    metricas: {
      transporte: porCategoria('transporte'),
      divida: porCategoria('divida'),
      alimentacao: porCategoria('alimentacao'),
      outros: porCategoria('outros'),
    },
    porConta: { principal: porConta('principal'), nubank: porConta('nubank'), inter: porConta('inter') },
  }
}

export type Resumo = ReturnType<typeof resumoMes>
