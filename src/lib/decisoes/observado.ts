/**
 * Do que a pessoa sabe num dia (o `Observado` do Cairo: `revelar(mundo, esperados, dia)`) para a entrada do planejador.
 * É a ponte que deixa o planejador rodar dentro dos cenários da parte de dados sem ver o futuro: ele só recebe o que foi
 * revelado até o dia e o que se espera (igual em todos os mundos).
 *
 * - Entradas: a renda esperada que ainda não caiu (na data esperada; a atrasada, amanhã) e o crédito já contratado que vai
 *   cair (empréstimo recebido: é caixa, mesmo não sendo renda). O que te devem fica de fora: o planejador não conta com ele
 *   sozinho; quando a devolução cai, ela já é caixa de quem executa o plano (`entraNoCaixa`).
 * - Contas: os compromissos de saída ainda não pagos (`pagos` tem os ids de base já pagos), com o dia do vencimento; o id
 *   de base vai em `grupo`, para quem executa o plano saber qual fluxo pagou.
 * - Dia a dia: a média por dia do que se espera gastar até o fim do horizonte. O Cairo ainda não separa o essencial do
 *   conforto no dia a dia (`dia_a_dia`), então o essencial do dia fica 0 aqui até essa separação existir.
 */
import type { DiaISO, Fluxo, Observado } from '../../cairo'
import type { Compromisso, EntradaPlanejador } from '../planejador'

const reais = (f: Fluxo) => f.valor.centavos / 100

/**
 * O que mexe no caixa: toda entrada e saída de verdade, inclusive empréstimo recebido, dinheiro emprestado e devolução de
 * quem te devia. Só a transferência entre os próprios bolsos fica de fora (o dinheiro não sai da pessoa). Renda e consumo
 * são outra conta (a parte de dados classifica): aqui é só se o dinheiro está ou não na mão.
 */
export const mexeNoCaixa = (f: Fluxo) => f.natureza !== 'transferencia_propria'
/** Entrou dinheiro na mão (renda, crédito recebido, devolução de quem te deve). */
export const entraNoCaixa = (f: Fluxo) => f.sentido === 'entra' && mexeNoCaixa(f)
/** Entrada esperada com que o plano pode contar: renda, e crédito contratado. O "me devem" não (pode não vir). */
const contaComEla = (f: Fluxo) => f.sentido === 'entra' && (f.natureza === 'renda' || (f.natureza === 'credito_recebido' && f.origem === 'compromisso'))
const origemDe = (f: Fluxo): Compromisso['origem'] => (f.tipo === 'fatura' ? 'cartao' : f.tipo === 'parcela' ? 'parcela' : f.tipo === 'conta-fixa' ? 'conta' : 'recorrente')
/** O mesmo fluxo em mundos diferentes tem o id com "@mundo" no fim: o id de base o identifica. */
export const idDeBase = (id: string) => (id.includes('@') ? id.slice(0, id.lastIndexOf('@')) : id)
const utc = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)))

export function entradaDoObservado(o: Observado, a: { caixa: number | null; ate: DiaISO; pagos: Set<string> }): EntradaPlanejador {
  const entradas = o.esperados
    .filter((f) => contaComEla(f) && f.dia <= a.ate)
    .map((f) => ({ data: f.dia, valor: reais(f), descricao: f.descricao, certeza: f.origem === 'compromisso' ? 'compromisso' as const : 'costume' as const }))
  const contas = [...o.conhecidos, ...o.esperados]
    .filter((f) => f.sentido === 'sai' && mexeNoCaixa(f) && f.natureza !== 'dia_a_dia' && !a.pagos.has(idDeBase(f.id)) && f.dia <= a.ate)
  const vistos = new Set<string>()
  const compromissos: Compromisso[] = []
  for (const f of contas) {
    const id = idDeBase(f.id)
    if (vistos.has(id)) continue
    vistos.add(id)
    compromissos.push({ descricao: f.descricao || f.tipo, valor: reais(f), vence: f.dia, origem: origemDe(f), jurosMes: null, ...(f.natureza === 'essencial' ? { essencial: true } : {}),
      // emprestar a alguém não tem multa nem juro de atraso (Claude 1, pedido 8)
      ...(f.natureza === 'emprestimo_concedido' ? { semCusto: true } : {}), grupo: id })
  }
  const diaADia = o.esperados.filter((f) => f.natureza === 'dia_a_dia' && f.dia > o.hoje && f.dia <= a.ate)
  const dias = Math.max(1, Math.round((utc(a.ate) - utc(o.hoje)) / 86400000))
  return {
    hoje: o.hoje, fim: a.ate, saldoInicial: a.caixa, ritmoDia: Math.round((diaADia.reduce((s, f) => s + reais(f), 0) / dias) * 100) / 100,
    porDiaDoMes: null, gastouHoje: 0, abertas: [], entradas, compromissos, cenarios: [], essencialDia: 0,
  }
}
