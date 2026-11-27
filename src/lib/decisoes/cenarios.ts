/**
 * Os "e se" do planejador, tirados do que a parte de dados aprendeu (Cairo, `analise.cairo.aprendizado.entradas`): para cada
 * fonte de renda, o atraso que o histórico mostra (o p90 do atraso em dias) e a chance de não vir. Este arquivo não prevê
 * nada: só traduz o aprendizado do Cairo para o formato do planejador (`CenarioDoPlano`).
 *
 * Sem o Cairo, ou sem histórico que mostre atraso ou falta, não há cenário: o app não inventa um atraso com premissa fixa.
 * Enquanto a previsão não estiver calibrada (`calibracao.cobertura80` null), a frase não fala em "chance": diz que já
 * aconteceu no histórico.
 */
import type { LeituraDoCairo } from '../../cairo'
import type { CenarioDoPlano, EntradaDoPlano } from '../planejador'
import { tx } from '../textos'

/** "Salário Acme" e "Salário" são a mesma fonte: compara sem acento, maiúscula e números. */
const chave = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]+/g, ' ').trim()
const mesma = (planejador: string, fonte: string) => {
  const a = chave(planejador), b = chave(fonte)
  return Boolean(a && b) && (a === b || a.split(' + ').some((x) => x === b) || a.includes(b) || b.includes(a))
}

/** O histórico precisa pesar pelo menos isto para um atraso aprendido virar "e se". */
export const PESO_MINIMO_DO_HISTORICO = 0.4
/** A falta de renda vira "e se" a partir desta chance (uma falta em poucos meses já passa). */
export const FALTA_MINIMA = 0.1

export function cenariosDaPrevisao(cairo: LeituraDoCairo | null, entradas: EntradaDoPlano[], hoje: string, ate: string): CenarioDoPlano[] {
  if (!cairo) return []
  const proximas = entradas.filter((x) => x.valor > 0 && x.data >= hoje && x.data <= ate).sort((a, b) => b.valor - a.valor)
  const out: CenarioDoPlano[] = []
  for (const e of proximas) {
    const f = cairo.aprendizado.entradas.find((x) => mesma(e.descricao, x.descricao))
    if (!f) continue
    const p90 = f.atraso.dist.quantis.p90 ?? 0
    if (p90 >= 1 && f.atraso.pesoDoHistorico >= PESO_MINIMO_DO_HISTORICO) {
      out.push({
        id: `atraso:${f.chave}`, origem: 'previsao', adiar: { dias: Math.round(p90), descricao: e.descricao },
        premissa: Math.round(p90) === 1 ? tx('Se {0} cair 1 dia depois, como já aconteceu', e.descricao) : tx('Se {0} cair {1} dias depois, como já aconteceu', e.descricao, Math.round(p90)),
      })
    }
    if (f.pNaoOcorre >= FALTA_MINIMA) {
      out.push({ id: `falta:${f.chave}`, origem: 'previsao', semEntradas: [e.descricao], premissa: tx('Se {0} não vier neste mês, como já aconteceu', e.descricao) })
    }
    if (out.length >= 2) break
  }
  return out
}
