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
import { converterTaxa, type CondicaoDeCusto } from '../../cairo'
import { taxaDosFluxos } from './taxaImplicita'
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
  /**
   * O que o contrato diz sobre adiantar (condição 'antecipacao' do Cairo). 'desconhecida' (o app ainda não pergunta): o
   * desconto calculado pelo juro do contrato é o que a pessoa pode pedir, mas o mínimo garantido é zero.
   */
  antecipacao: RegraDeAntecipacao
  /** O desconto que dá para dar como certo (0 quando a regra de antecipação é desconhecida; null se o desconto é desconhecido). */
  minimoGarantido: number | null
  /** As premissas que sustentam o número, em frases. */
  premissas: string[]
}

export type RegraDeAntecipacao = Extract<CondicaoDeCusto, { tipo: 'antecipacao' }>['regra']

/**
 * O que a parte de dados (Cairo, `analise.cairo.condicoes`) sabe do custo de uma dívida, lido para as contas daqui: o juro
 * do contrato (informado, ou o dos fluxos quando só se sabe o que foi recebido), a regra de antecipação e a última oferta de
 * quitação. A condição de atraso fica de fora de propósito: ela nunca desconta antecipação.
 */
export function custosDasCondicoes(condicoes: CondicaoDeCusto[], divida: string, reserva?: Pick<Divida, 'juros_mes' | 'valor_recebido' | 'valor_parcela' | 'total_parcelas'>) {
  const daqui = condicoes.filter((c) => 'divida' in c && c.divida === divida)
  const contratual = daqui.find((c): c is Extract<CondicaoDeCusto, { tipo: 'contratual' }> => c.tipo === 'contratual')
  const fluxo = daqui.find((c): c is Extract<CondicaoDeCusto, { tipo: 'fluxo_do_contrato' }> => c.tipo === 'fluxo_do_contrato')
  const ante = daqui.find((c): c is Extract<CondicaoDeCusto, { tipo: 'antecipacao' }> => c.tipo === 'antecipacao')
  const oferta = daqui.filter((c): c is Extract<CondicaoDeCusto, { tipo: 'oferta_quitacao' }> => c.tipo === 'oferta_quitacao').sort((a, b) => a.dia.localeCompare(b.dia)).pop()
  let contrato: JurosDoContrato
  if (contratual) {
    const mes = Math.round(converterTaxa(contratual.taxa, 'mes').fracao * 1e6) / 1e4
    contrato = {
      mes, origem: 'informada', zeroConfirmado: mes === 0,
      nota: mes === 0 ? tx('Você informou que o contrato não tem juros.') : tx('Juros do contrato informados por você: {0}% ao mês.', fmtTaxa(mes)),
    }
  } else if (fluxo && fluxo.parcelas.length) {
    // sem o dia em que o dinheiro caiu, a convenção do app: 1 mês antes da 1ª parcela (o formulário mostra o mesmo número)
    const primeira = [...fluxo.parcelas].sort((a, b) => a.vence.localeCompare(b.vence))[0].vence
    const recebidoEm = fluxo.recebidoEm ?? maisDias(primeira, -30)
    const t = taxaDosFluxos([
      { data: recebidoEm, valor: fluxo.recebido.centavos / 100 },
      ...fluxo.parcelas.map((p) => ({ data: p.vence, valor: -p.valor.centavos / 100 })),
    ], { faltaParaCET: fluxo.recebidoEm ? ['iof', 'tarifas', 'seguro'] : ['data-do-recebimento', 'iof', 'tarifas', 'seguro'] })
    contrato = t
      ? {
        mes: t.mes, origem: 'implicita', zeroConfirmado: false,
        nota: fluxo.recebidoEm
          ? tx('Juros calculados pelo que você recebeu e pelas datas das parcelas: cerca de {0}% ao mês. Inclui o que mais foi cobrado (IOF, tarifas): é o teto, não a taxa do contrato.', fmtTaxa(t.mes))
          : tx('Juros calculados pelo que você recebeu e pelas parcelas: cerca de {0}% ao mês (considerando a 1ª parcela 1 mês depois de receber).', fmtTaxa(t.mes)),
      }
      : { mes: null, origem: 'desconhecida', zeroConfirmado: false, nota: tx('Os juros do contrato não foram informados.') }
  } else contrato = reserva ? jurosDoContrato(reserva) : { mes: null, origem: 'desconhecida', zeroConfirmado: false, nota: tx('Os juros do contrato não foram informados.') }
  const banco: DescontoParaQuitar | null = oferta && oferta.valor.centavos < oferta.total.centavos
    ? { data: oferta.dia, total: oferta.total.centavos / 100, quitar: oferta.valor.centavos / 100, desconto: (oferta.total.centavos - oferta.valor.centavos) / 100 }
    : null
  return { contrato, antecipacao: (ante?.regra ?? 'desconhecida') as RegraDeAntecipacao, banco }
}

const maisDias = (iso: string, n: number) => new Date(utc(iso) + n * 86400000).toISOString().slice(0, 10)

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
  /** A regra de antecipação do contrato (Cairo). Sem ela: desconhecida. */
  antecipacao?: RegraDeAntecipacao
}): Quitacao {
  const antecipacao: RegraDeAntecipacao = a.antecipacao ?? 'desconhecida'
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
      antecipacao, minimoGarantido: centavos(Math.max(0, semDesconto - a.banco.quitar)),
    }
  }
  if (a.banco) premissas.push(tx('O credor pediu {0} para quitar em {1}, mas faz mais de {2} dias: peça o valor de novo.', fmtValor(a.banco.quitar), fmtDataCurta(a.banco.data), validade))

  const c = a.contrato
  // nada a vencer (dívida sem parcela, ou só o atrasado): não há o que descontar, o valor é o que falta
  if (aVencer <= 0) return { nominal, vencido, encargosDoAtraso: encargos, aVencer, semDesconto, desconto: 0, paraQuitar: semDesconto, estado: 'sem-desconto', antecipacao, minimoGarantido: 0, premissas }
  if (c.mes === null) {
    premissas.push(tx('Sem os juros do contrato, não dá para saber quanto o credor abate das parcelas que ainda não venceram. Peça a ele o valor para quitar hoje.'))
    return { nominal, vencido, encargosDoAtraso: encargos, aVencer, semDesconto, desconto: null, paraQuitar: null, estado: 'desconhecido', antecipacao, minimoGarantido: null, premissas }
  }
  if (c.mes === 0 || antecipacao === 'sem_desconto') {
    if (antecipacao === 'sem_desconto' && c.mes !== 0) premissas.push(tx('O contrato diz que adiantar não tem desconto.'))
    premissas.push(tx('Contrato sem juros: adiantar não tem desconto.'))
    return { nominal, vencido, encargosDoAtraso: encargos, aVencer, semDesconto, desconto: 0, paraQuitar: semDesconto, estado: 'sem-desconto', antecipacao, minimoGarantido: 0, premissas }
  }
  const presente = abertas.filter((p) => p.vence > a.hoje).reduce((s, p) => s + valorPresente(p.valor, diasEntre(a.hoje, p.vence), c.mes!), 0)
  const desconto = centavos(aVencer - presente)
  premissas.push(c.origem === 'informada'
    ? tx('Desconto pela redução proporcional dos juros do contrato ({0}% ao mês) nas parcelas que ainda não venceram. Em crédito ao consumidor isso é direito seu; com pessoa física, depende de acordo.', fmtTaxa(c.mes))
    : tx('Desconto estimado pela taxa que as parcelas embutem ({0}% ao mês); o contrato pode ter outra taxa. Peça o valor para quitar ao credor.', fmtTaxa(c.mes)))
  const garantido = antecipacao === 'desconto_contratual' || antecipacao === 'desconto_informado'
  if (!garantido) premissas.push(tx('O app ainda não sabe o que o seu contrato diz sobre adiantar: o desconto é o que você pode pedir, não um valor garantido.'))
  return {
    nominal, vencido, encargosDoAtraso: encargos, aVencer, semDesconto, desconto,
    paraQuitar: centavos(semDesconto - desconto), estado: c.origem === 'informada' ? 'calculado' : 'estimado', antecipacao,
    minimoGarantido: garantido ? desconto : 0, premissas,
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
