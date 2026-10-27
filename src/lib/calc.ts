import type { Divida, Lancamento, Mes } from './types'
import { BANCOS, TIPOS_CAIXA } from './types'

const soma = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

export const restantes = (d: Divida) => d.parcelas - d.pagas
export const totalDivida = (d: Divida) => restantes(d) * d.valor_mensal

export function totalCaixa(m?: Mes) {
  if (!m) return 0
  return soma(BANCOS.flatMap((b) => TIPOS_CAIXA.map((t) => m.caixa?.[b]?.[t] ?? 0)))
}

/** Os mesmos números do quadro de resumo de cada aba da planilha. */
export function resumoMes(lancs: Lancamento[], dividas: Divida[], mes?: Mes) {
  const entradas = soma(lancs.filter((l) => l.tipo === 'entrada').map((l) => l.valor))
  const saidasLista = lancs.filter((l) => l.tipo === 'saida')
  const saidas = soma(saidasLista.map((l) => l.valor))
  const porCategoria = (c: string) => soma(saidasLista.filter((l) => l.categoria === c).map((l) => l.valor))

  const transporte = porCategoria('transporte')
  const alimentacao = porCategoria('alimentacao')
  // Como nas abas da planilha: DÍVIDAS nas métricas = saídas que foram pagamento de dívida.
  const pagoDividas = porCategoria('divida')
  const outros = porCategoria('outros')

  return {
    entradas,
    saidas,
    fluxo: entradas - saidas,
    caixa: totalCaixa(mes),
    divida: soma(dividas.map(totalDivida)),
    investimentos: mes?.investimentos ?? 0,
    usd: mes?.usd ?? 0,
    metaUsd: mes?.meta_usd ?? 0,
    metricas: { transporte, divida: pagoDividas, alimentacao, outros },
    porConta: {
      principal: soma(saidasLista.filter((l) => l.conta === 'principal').map((l) => l.valor)),
      nubank: soma(saidasLista.filter((l) => l.conta === 'nubank').map((l) => l.valor)),
      inter: soma(saidasLista.filter((l) => l.conta === 'inter').map((l) => l.valor)),
    },
  }
}

export type Resumo = ReturnType<typeof resumoMes>
