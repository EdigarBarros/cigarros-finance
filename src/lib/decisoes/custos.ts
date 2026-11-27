/**
 * Custos de uma dívida, cada um com o nome certo: juros do contrato, encargos de atraso (multa, mora, valor por dia),
 * financiamento de fatura (rotativo), encargos (IOF, tarifas), antecipação e quitação. Puro como o motor: sem React, sem
 * banco, com o dia de hoje entrando por `hoje`.
 *
 * A regra que este arquivo existe para garantir: **o desconto por adiantar parcelas sai só do juro do contrato.** O juro do
 * atraso é o preço de esperar (cresce o que já venceu); ele nunca diz quanto o credor abate das parcelas que ainda não
 * venceram. E desconto desconhecido não é desconto zero: sem a taxa do contrato, o app não promete economia nenhuma e diz
 * o que perguntar ao credor.
 */
import type { DescontoParaQuitar } from '../jurosAprendido'
import { jurosEmbutidos } from '../dividas'
import type { Divida } from '../types'
import { tx } from '../textos'
import { fmtDataCurta, fmtTaxa, fmtValor } from '../format'

/** Os tipos de custo que o Kairo separa ao explicar quanto uma dívida custa. */
export type NaturezaDoCusto =
  | 'juros-contrato' // o juro combinado nas parcelas (Price, empréstimo, financiamento)
  | 'atraso-multa' // a multa, uma vez, quando passa do vencimento
  | 'atraso-mora' // os juros de mora, que correm por dia sobre o atrasado
  | 'atraso-fixo' // valor fixo por dia de atraso (credor pessoa física)
  | 'financiamento-fatura' // rotativo ou parcelamento da fatura do cartão
  | 'encargo' // IOF, tarifas, seguro: o que entra no CET além dos juros
  | 'antecipacao' // o desconto de adiantar parcelas que ainda não venceram
  | 'quitacao' // o valor para encerrar a dívida hoje

/** De onde veio uma taxa: muda o quanto o app pode afirmar com ela. */
export type OrigemDaTaxa = 'informada' | 'implicita' | 'aprendida' | 'padrao' | 'desconhecida'

/** O juro do contrato: o único que serve para descontar parcelas adiantadas. */
export interface JurosDoContrato {
  /** % ao mês; null = não se sabe. */
  mes: number | null
  origem: 'informada' | 'implicita' | 'desconhecida'
  /** A pessoa informou 0% ("Sei a taxa: 0"): não há juros a descontar. */
  zeroConfirmado: boolean
  /** Por que o app acha isso, numa frase. */
  nota: string
}

/**
 * O juro do contrato de uma dívida, sem nunca olhar a regra de atraso (`atraso_*`).
 * - `juros_mes` informado (inclusive 0): é ele.
 * - Sem ele, mas com o valor recebido e as parcelas: a taxa que as parcelas embutem (tabela Price), marcada como implícita.
 * - Senão: desconhecido. `juros_mes` vazio no banco tanto pode ser "sem juros" quanto "não sei" (o formulário grava os
 *   dois do mesmo jeito), então o app não pode tratar como zero confirmado.
 */
export function jurosDoContrato(d: Pick<Divida, 'juros_mes' | 'valor_recebido' | 'valor_parcela' | 'total_parcelas'>): JurosDoContrato {
  if (typeof d.juros_mes === 'number' && Number.isFinite(d.juros_mes) && d.juros_mes >= 0) {
    return {
      mes: d.juros_mes, origem: 'informada', zeroConfirmado: d.juros_mes === 0,
      nota: d.juros_mes === 0 ? tx('Você informou que o contrato não tem juros.') : tx('Juros do contrato informados por você: {0}% ao mês.', fmtTaxa(d.juros_mes)),
    }
  }
  const recebido = d.valor_recebido ?? 0
  const parcela = d.valor_parcela ?? 0
  const n = d.total_parcelas ?? 0
  if (recebido > 0 && parcela > 0 && n >= 1) {
    const e = jurosEmbutidos(recebido, { parcela, parcelas: n })
    if (e && e.aoMes !== null) {
      return {
        mes: e.aoMes, origem: 'implicita', zeroConfirmado: false,
        nota: tx('Juros calculados pelo que você recebeu e pelas parcelas: cerca de {0}% ao mês (considerando a 1ª parcela 1 mês depois de receber).', fmtTaxa(e.aoMes)),
      }
    }
  }
  return { mes: null, origem: 'desconhecida', zeroConfirmado: false, nota: tx('Os juros do contrato não foram informados.') }
}

export type EstadoDoDesconto =
  | 'confirmado' // o credor informou o valor para quitar (conferência recente)
  | 'calculado' // pela taxa do contrato informada, com a redução proporcional dos juros
  | 'estimado' // pela taxa implícita (das parcelas e do valor recebido)
  | 'sem-desconto' // contrato sem juros, ou nada a vencer: o valor para quitar é o que falta
  | 'desconhecido' // sem a taxa do contrato: o app não sabe quanto o credor abate

export interface ParcelaEmAberto {
  vence: string
  valor: number
}

export interface Quitacao {
  /** A soma do que falta, sem desconto (o teto do que se paga para quitar, fora o atraso). */
  nominal: number
  /** O que já venceu (não tem desconto). */
  vencido: number
  /** Encargos do atraso estimados sobre o que venceu (multa e mora): entram à parte, nunca no desconto. */
  encargosDoAtraso: number
  /** O que ainda não venceu. */
  aVencer: number
  /** O desconto de adiantar o que ainda não venceu (null: desconhecido). */
  desconto: number | null
  /** Para quitar hoje: vencido + encargos + (a vencer − desconto). null quando o desconto é desconhecido. */
  paraQuitar: number | null
  /** O teto: o que sai sem desconto nenhum (vencido + encargos + a vencer). */
  semDesconto: number
  estado: EstadoDoDesconto
  /** As premissas que sustentam o número, em frases. */
  premissas: string[]
}

const centavos = (n: number) => Math.round(n * 100) / 100
const utc = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)))
export const diasEntre = (de: string, ate: string) => Math.round((utc(ate) - utc(de)) / 86400000)

/** Valor de hoje de uma parcela que vence daqui a `dias`, a `taxaMes` % ao mês (juros compostos, mês de 30 dias). */
export const valorPresente = (valor: number, dias: number, taxaMes: number) => (dias <= 0 || taxaMes <= 0 ? valor : valor / Math.pow(1 + taxaMes / 100, dias / 30))

/**
 * Quanto sai para quitar hoje, separando o que é desconto de antecipação (só pelo juro do contrato) do que é atraso.
 *
 * `banco`: a última conferência "para quitar" com o credor. Vale como confirmada até `validadeDias` depois (o valor muda
 * com o tempo); fora disso, vira só uma pista na premissa.
 */
export function quitacaoHoje(a: {
  hoje: string
  parcelas: ParcelaEmAberto[]
  contrato: JurosDoContrato
  /** Encargos de atraso estimados até hoje (lib/jurosAtraso.ts), na mesma moeda das parcelas. */
  encargosDoAtraso?: number
  banco?: DescontoParaQuitar | null
  validadeDias?: number
}): Quitacao {
  const abertas = a.parcelas.filter((p) => p.valor > 0.004)
  const vencido = centavos(abertas.filter((p) => p.vence <= a.hoje).reduce((s, p) => s + p.valor, 0))
  const aVencer = centavos(abertas.filter((p) => p.vence > a.hoje).reduce((s, p) => s + p.valor, 0))
  const encargos = centavos(Math.max(0, a.encargosDoAtraso ?? 0))
  const nominal = centavos(vencido + aVencer)
  const semDesconto = centavos(nominal + encargos)
  const premissas: string[] = []
  if (encargos > 0) premissas.push(tx('Inclui cerca de {0} de multa e juros do atraso, estimados pela regra de atraso: eles não entram no desconto.', fmtValor(encargos)))

  const validade = a.validadeDias ?? 30
  if (a.banco && diasEntre(a.banco.data, a.hoje) <= validade && diasEntre(a.banco.data, a.hoje) >= 0) {
    premissas.push(tx('Valor para quitar informado pelo credor em {0}. Confirme antes de pagar: ele muda com o tempo.', fmtDataCurta(a.banco.data)))
    return {
      nominal, vencido, encargosDoAtraso: encargos, aVencer, semDesconto,
      desconto: centavos(Math.max(0, semDesconto - a.banco.quitar)), paraQuitar: centavos(a.banco.quitar), estado: 'confirmado', premissas,
    }
  }
  if (a.banco) premissas.push(tx('O credor pediu {0} para quitar em {1}, mas faz mais de {2} dias: peça o valor de novo.', fmtValor(a.banco.quitar), fmtDataCurta(a.banco.data), validade))

  const c = a.contrato
  // nada a vencer (dívida sem parcela, ou só o atrasado): não há o que descontar, o valor é o que falta
  if (aVencer <= 0) return { nominal, vencido, encargosDoAtraso: encargos, aVencer, semDesconto, desconto: 0, paraQuitar: semDesconto, estado: 'sem-desconto', premissas }
  if (c.mes === null) {
    premissas.push(tx('Sem os juros do contrato, não dá para saber quanto o credor abate das parcelas que ainda não venceram. Peça a ele o valor para quitar hoje.'))
    return { nominal, vencido, encargosDoAtraso: encargos, aVencer, semDesconto, desconto: null, paraQuitar: null, estado: 'desconhecido', premissas }
  }
  if (c.mes === 0) {
    premissas.push(tx('Contrato sem juros: adiantar não tem desconto.'))
    return { nominal, vencido, encargosDoAtraso: encargos, aVencer, semDesconto, desconto: 0, paraQuitar: semDesconto, estado: 'sem-desconto', premissas }
  }
  const presente = abertas.filter((p) => p.vence > a.hoje).reduce((s, p) => s + valorPresente(p.valor, diasEntre(a.hoje, p.vence), c.mes!), 0)
  const desconto = centavos(aVencer - presente)
  premissas.push(c.origem === 'informada'
    ? tx('Desconto pela redução proporcional dos juros do contrato ({0}% ao mês) nas parcelas que ainda não venceram. Em crédito ao consumidor isso é direito seu; com pessoa física, depende de acordo.', fmtTaxa(c.mes))
    : tx('Desconto estimado pela taxa que as parcelas embutem ({0}% ao mês); o contrato pode ter outra taxa. Peça o valor para quitar ao credor.', fmtTaxa(c.mes)))
  return {
    nominal, vencido, encargosDoAtraso: encargos, aVencer, semDesconto, desconto,
    paraQuitar: centavos(semDesconto - desconto), estado: c.origem === 'informada' ? 'calculado' : 'estimado', premissas,
  }
}


/**
 * Economia de adiantar `dinheiro` numa dívida parcelada: as parcelas do fim saem pelo valor de hoje (o desconto do contrato).
 * Devolve quanto de dívida some (nominal), quanto se paga e quanto se deixa de pagar. Sem juro do contrato conhecido, a
 * economia é null (não 0): o app não sabe.
 */
export function economiaDeAdiantar(a: { hoje: string; parcelas: ParcelaEmAberto[]; contrato: JurosDoContrato; dinheiro: number }) {
  const futuras = a.parcelas.filter((p) => p.vence > a.hoje && p.valor > 0.004).sort((x, y) => y.vence.localeCompare(x.vence))
  let resta = a.dinheiro
  let abatido = 0
  const taxa = a.contrato.mes ?? 0
  for (const p of futuras) {
    if (resta <= 0.004) break
    const vp = valorPresente(p.valor, diasEntre(a.hoje, p.vence), taxa)
    if (resta >= vp) { abatido += p.valor; resta -= vp }
    else { abatido += p.valor * (resta / vp); resta = 0 }
  }
  const pago = centavos(a.dinheiro - resta)
  const nominalAbatido = centavos(abatido)
  return {
    pago, abatido: nominalAbatido,
    economia: a.contrato.mes === null ? null : centavos(nominalAbatido - pago),
    /** Sem taxa do contrato, cada real adiantado abate pelo menos um real (o mínimo garantido). */
    minimoAbatido: a.contrato.mes === null ? pago : nominalAbatido,
  }
}

/** Uma taxa de atraso, com a origem (para a explicação dizer se é a do credor ou uma estimativa do app). */
export interface TaxaDoAtraso { mes: number; multa: number; origem: OrigemDaTaxa }
