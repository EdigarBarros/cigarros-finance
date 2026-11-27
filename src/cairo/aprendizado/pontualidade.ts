/**
 * Quem te deve paga no combinado? Pelas promessas de pagamento já vencidas de cada pessoa (cumprida ou não), puxadas para a
 * referência de "metade das vezes" (aprendizado.pontualidade.prior). Com duas promessas, a referência ainda pesa metade:
 * ninguém vira "mau pagador" com pouca evidência, e o Cairo não diz frase forte sobre a pessoa.
 *
 * O resultado é só a chance de o dinheiro cair no dia; dinheiro a receber nunca vira dinheiro disponível
 * (politica.a-receber-nao-disponivel).
 */
import { REGRAS } from '../contrato/politicas'
import type { DividaBruta, PromessaBruta } from '../entrada'
import { proporcao } from './evidencia'

export interface Pontualidade {
  /** O nome da pessoa (ou a descrição da dívida, sem nome). */
  quem: string
  dividas: string[]
  cumpridas: number
  vencidas: number
  /** Chance de pagar no combinado, com faixa de 80% (larga com pouca evidência). */
  p: number
  p10: number
  p90: number
  pesoDoHistorico: number
}

const chaveDaPessoa = (d: DividaBruta) => (d.pessoa?.trim() || d.descricao).toLowerCase()

export function aprenderPontualidade(dividas: DividaBruta[], promessas: PromessaBruta[]): Pontualidade[] {
  const prior = REGRAS.pontualidadePrior.valor
  const porPessoa = new Map<string, { quem: string; dividas: string[]; cumpridas: number; vencidas: number }>()
  for (const d of dividas.filter((x) => x.sentido === 'me_devem' && !x.em_espera)) {
    const k = chaveDaPessoa(d)
    const p = porPessoa.get(k) ?? { quem: d.pessoa?.trim() || d.descricao, dividas: [], cumpridas: 0, vencidas: 0 }
    p.dividas.push(d.id)
    for (const x of promessas.filter((y) => y.divida_id === d.id && y.estado !== 'aguardando' && y.estado !== 'hoje')) {
      p.vencidas++
      if (x.estado === 'cumprida') p.cumpridas++
    }
    porPessoa.set(k, p)
  }
  return [...porPessoa.values()].map((x) => {
    const r = proporcao(x.cumpridas, x.vencidas, prior.media, prior.forca)
    return { ...x, p: r.p, p10: r.p10, p90: r.p90, pesoDoHistorico: r.pesoDoHistorico }
  })
}

export const pontualidadeDaDivida = (ps: Pontualidade[], dividaId: string) => ps.find((p) => p.dividas.includes(dividaId)) ?? null
