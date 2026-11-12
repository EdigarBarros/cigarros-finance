/** Formatos e textos curtos das telas do Invest: quantidade, variação com sinal e de onde vem o valor de um ativo. */
import { fmtDataCurta, fmtPct, LOCAL_DAS_DATAS } from '../../lib/format'
import type { Avaliacao } from '../../lib/invest/carteira'
import { tx } from '../../lib/textos'

const formatoQtd = new Intl.NumberFormat(LOCAL_DAS_DATAS, { maximumFractionDigits: 8 })
/** Quantidade de cotas: sem casas quando é inteira, com até 8 quando é fração (Tesouro, cripto). */
export const fmtQtd = (n: number) => formatoQtd.format(n)
/** Variação com sinal: "+4,8%", "−1,2%". */
export const fmtVariacao = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${fmtPct(Math.abs(n))}`
export const tomDoNumero = (n: number) => (n > 0.0000001 ? 'bom' : n < -0.0000001 ? 'ruim' : '')

/** De onde veio o valor de um ativo, em palavras. */
export function fonteDoValor(av: Avaliacao): string {
  if (av.natureza === 'estimado') return tx('Estimado pela taxa do título (bruto, antes do imposto)')
  if (av.natureza === 'custo') return tx('Sem valor informado: vale o que foi aplicado')
  if (av.natureza === 'zerado') return tx('Posição encerrada')
  const origem = av.fonte === 'operacao' ? tx('preço da última compra ou venda') : av.fonte === 'importacao' ? tx('arquivo importado') : av.fonte === 'manual' ? tx('informado por você') : av.fonte
  return av.natureza === 'informado' ? tx('Saldo de {0} ({1})', fmtDataCurta(av.referencia), origem) : tx('Preço de {0} ({1})', fmtDataCurta(av.referencia), origem)
}
