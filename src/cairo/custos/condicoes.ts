/**
 * As condições de custo de cada dívida, separadas pelo que cada uma é: o juro do CONTRATO, a regra do ATRASO (informada ou
 * aprendida nas conferências), o que se sabe sobre ANTECIPAR, os encargos pagos e as ofertas de quitação. As contas com
 * elas (custo do atraso, desconto de antecipação, TIR) são da parte de decisão (Claude 2).
 *
 * Por que separado: o motor antigo usava a taxa do atraso para descontar parcelas futuras numa antecipação, e o juro do
 * contrato como custo de atrasar. Com o tipo, uma condição 'atraso' não entra numa conta que pede 'contratual'.
 *
 * Unidades: o app guarda juros em percentual; aqui viram `Taxa` (fração com período e regime), uma vez, pela fronteira.
 */
import type { CondicaoDeCusto, Motivo } from '../contrato/tipos'
import { lerMoeda, lerTaxaFracao, lerTaxaPercentual, lerValor, TETO_ATRASO_MENSAL } from '../contrato/validar'
import { centavosDe, chaveDoMes, lerDia, mesDaChave, mesDe, noDiaDoMes, type DiaISO, type Moeda } from '../contrato/unidades'
import type { ConferenciaBruta, DividaBruta, FaturaPagaBruta, JurosAprendidoBruto } from '../entrada'

export interface CondicoesDeCusto { condicoes: CondicaoDeCusto[]; avisos: Motivo[] }

/** As parcelas do contrato: das partes, se houver; senão, da parcela fixa a partir do 1º vencimento. */
function parcelasDoContrato(d: DividaBruta, moeda: Moeda) {
  if (d.partes?.length) {
    return d.partes.map((p) => ({ vence: lerDia(p.vencimento), valor: p.valor })).filter((p) => p.vence)
      .map((p) => ({ vence: p.vence as DiaISO, valor: { centavos: centavosDe(p.valor), moeda } }))
  }
  const ini = lerDia(d.inicio ?? '')
  if (!ini || !d.valor_parcela || !d.total_parcelas) return []
  const k0 = chaveDoMes(mesDe(ini))
  const dia = Number(ini.slice(8, 10))
  return Array.from({ length: d.total_parcelas }, (_, i) => ({
    vence: noDiaDoMes(mesDaChave(k0 + i), dia),
    valor: { centavos: centavosDe(d.valor_parcela!), moeda },
  }))
}

export function condicoesDeCusto(
  dividas: DividaBruta[], conferencias: ConferenciaBruta[], faturas: FaturaPagaBruta[], aprendidos: JurosAprendidoBruto[], moedaPrincipal: Moeda,
): CondicoesDeCusto {
  const condicoes: CondicaoDeCusto[] = []
  const avisos: Motivo[] = []
  for (const d of dividas) {
    if ((d.sentido ?? 'devo') !== 'devo') continue
    const ref = `dividas:${d.id}`
    const mv = d.moeda ? lerMoeda(d.moeda, ref) : null
    const moeda = mv && mv.ok ? mv.valor : moedaPrincipal

    if (typeof d.juros_mes === 'number') {
      const t = lerTaxaPercentual(d.juros_mes, 'mes', 'composta', ref)
      if (t.ok) { condicoes.push({ tipo: 'contratual', divida: d.id, taxa: t.valor, fonte: 'informada', desde: null }); avisos.push(...t.avisos) }
      else avisos.push(...t.erros)
    }

    if (typeof d.valor_recebido === 'number' && d.valor_recebido > 0) {
      const parcelas = parcelasDoContrato(d, moeda)
      const rec = lerValor(d.valor_recebido, moeda, ref)
      // a data em que o dinheiro foi recebido só existe nas partes (quando a compra ou o empréstimo começou)
      const inicios = (d.partes ?? []).map((p) => lerDia(p.inicio ?? '')).filter((x): x is DiaISO => Boolean(x)).sort()
      if (rec.ok && parcelas.length) condicoes.push({ tipo: 'fluxo_do_contrato', divida: d.id, recebido: rec.valor, recebidoEm: inicios[0] ?? null, parcelas })
    }

    const temAtraso = typeof d.atraso_juros_mes === 'number' || (d.atraso_reais_dia ?? 0) > 0
    if (temAtraso) {
      const regime = d.atraso_tipo === 'composto' ? 'composta' : 'simples'
      const mora = typeof d.atraso_juros_mes === 'number' ? lerTaxaPercentual(d.atraso_juros_mes, d.atraso_periodo === 'dia' ? 'dia' : 'mes', regime, ref, TETO_ATRASO_MENSAL) : null
      const porDia = (d.atraso_reais_dia ?? 0) > 0 ? lerValor(d.atraso_reais_dia, moeda, ref) : null
      if (mora && !mora.ok) avisos.push(...mora.erros)
      if (mora && mora.ok) avisos.push(...mora.avisos)
      condicoes.push({
        tipo: 'atraso', divida: d.id, fonte: 'informada', base: d.atraso_base === 'saldo' ? 'saldo' : 'parcela',
        multa: typeof d.atraso_multa === 'number' && d.atraso_multa >= 0 ? d.atraso_multa / 100 : null,
        mora: mora && mora.ok ? mora.valor : null, porDia: porDia && porDia.ok ? porDia.valor : null,
      })
    }

    const a = aprendidos.find((x) => x.divida_id === d.id)
    if (a) {
      const mora = a.modelo === 'pct' ? lerTaxaFracao(a.taxaDia, 'dia', 'simples', ref, TETO_ATRASO_MENSAL) : null
      const porDia = a.modelo === 'reais' ? lerValor(a.reaisDia, moedaPrincipal, ref) : null
      if (mora && !mora.ok) avisos.push(...mora.erros)
      else condicoes.push({
        tipo: 'atraso', divida: d.id, fonte: 'aprendida', base: d.atraso_base === 'saldo' ? 'saldo' : 'parcela', multa: null,
        mora: mora && mora.ok ? mora.valor : null, porDia: porDia && porDia.ok ? porDia.valor : null,
        amostras: a.amostras, confianca: a.confianca,
      })
    }

    // o app ainda não pergunta o que o contrato diz sobre adiantar: sem isso, a economia de antecipar é desconhecida
    condicoes.push({ tipo: 'antecipacao', divida: d.id, regra: 'desconhecida' })

    const quitar = conferencias.filter((c) => c.divida_id === d.id && c.qual_valor === 'quitar')
      .sort((x, y) => x.data.localeCompare(y.data) || (x.created_at ?? '').localeCompare(y.created_at ?? '')).pop()
    const dq = quitar ? lerDia(quitar.data) : null
    if (quitar && dq) {
      const v = lerValor(quitar.depois, moedaPrincipal, `divida_conferencias:${quitar.id}`)
      const t = lerValor(quitar.antes, moedaPrincipal, `divida_conferencias:${quitar.id}`)
      if (v.ok && t.ok) condicoes.push({ tipo: 'oferta_quitacao', divida: d.id, valor: v.valor, total: t.valor, dia: dq, ref: { tabela: 'divida_conferencias', id: quitar.id, versao: null } })
    }
  }
  for (const f of faturas) {
    if (!(typeof f.juros === 'number' && f.juros > 0)) continue
    const dia = lerDia(f.pago_em)
    const v = lerValor(f.juros, moedaPrincipal, `faturas_pagas:${f.id}`)
    if (dia && v.ok) condicoes.push({ tipo: 'encargo', divida: null, valor: v.valor, dia, descricao: 'juros-da-fatura', ref: { tabela: 'faturas_pagas', id: f.id, versao: null } })
  }
  return { condicoes, avisos }
}
