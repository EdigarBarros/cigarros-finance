/**
 * Cada real conta uma vez. As regras de classificação (fatos/movimentos.ts) já tiram das somas o que só muda de lugar; aqui
 * ficam as conferências do que a pessoa pode ter registrado em dobro, e as invariantes que o Cairo garante.
 *
 *  - Invariante: um lançamento entra uma vez (id único) e cai em exatamente uma classe; renda + gasto + o que ficou de fora
 *    somam o total lançado.
 *  - Aviso: a fatura do cartão lançada também como saída comum. As compras já são os gastos; o pagamento lançado à parte
 *    conta o mesmo dinheiro duas vezes.
 *  - Aviso: conta fixa já paga no mês e ainda na agenda daquele mês.
 */
import type { Motivo } from '../contrato/tipos'
import { diasEntre, lerDia } from '../contrato/unidades'
import type { CompromissoBruto, ContaFixaBruta, FaturaPagaBruta } from '../entrada'
import { chaveDescricao, type LancNormal } from './historico'

export interface Contagem {
  /** Somas da janela, em centavos, por classe. */
  porClasse: Record<string, number>
  total: number
  /** Defeito nosso: não deveria acontecer nunca. */
  violacoes: Motivo[]
  /** O que a pessoa pode ter registrado em dobro. */
  avisos: Motivo[]
}

const RE_FATURA = /\bfatura\b|\bcartao\b|\bcredit card\b|\btarjeta\b/

export function conferirContagem(lancs: LancNormal[], faturas: FaturaPagaBruta[], compromissos: CompromissoBruto[], contas: ContaFixaBruta[]): Contagem {
  const violacoes: Motivo[] = []
  const avisos: Motivo[] = []
  const vistos = new Set<string>()
  for (const l of lancs) {
    if (vistos.has(l.id)) violacoes.push({ codigo: 'contagem.lancamento-repetido', params: { id: l.id }, refs: [`lancamentos:${l.id}`], regras: [] })
    vistos.add(l.id)
  }
  const porClasse: Record<string, number> = {}
  let total = 0
  for (const l of lancs) {
    porClasse[l.classe] = (porClasse[l.classe] ?? 0) + l.valor
    total += l.valor
  }
  const somaClasses = Object.values(porClasse).reduce((a, b) => a + b, 0)
  if (somaClasses !== total) violacoes.push({ codigo: 'contagem.classes-nao-fecham', params: { total, somaClasses }, refs: [], regras: [] })

  // fatura lançada também como saída comum (sem cartão), no valor e perto do dia em que foi paga
  for (const f of faturas) {
    if (f.tipo === 'renegociada') continue
    const pago = lerDia(f.pago_em)
    if (!pago) continue
    const alvo = Math.round(f.valor * 100)
    const suspeito = lancs.find((l) => l.tipo === 'saida' && l.classe === 'gasto' && !l.cartao && l.dia
      && Math.abs(diasEntre(pago, l.dia)) <= 3 && Math.abs(l.valor - alvo) <= Math.max(100, alvo * 0.01)
      && RE_FATURA.test(chaveDescricao(l.descricao)))
    if (suspeito) avisos.push({ codigo: 'contagem.fatura-lancada-como-gasto', params: { valor: alvo, dia: pago }, refs: [`lancamentos:${suspeito.id}`, `faturas_pagas:${f.id}`], regras: [] })
  }

  // conta fixa paga no mês e ainda na agenda daquele mês
  for (const c of compromissos.filter((x) => x.origem === 'conta')) {
    const conta = contas.find((k) => chaveDescricao(k.descricao) === chaveDescricao(c.descricao) && k.tipo === c.tipo)
    const dia = lerDia(c.vence ?? c.data)
    if (!conta || !dia) continue
    const chave = Number(dia.slice(0, 4)) * 12 + Number(dia.slice(5, 7))
    if (lancs.some((l) => l.contaFixa === conta.id && l.chave === chave)) {
      avisos.push({ codigo: 'contagem.conta-paga-na-agenda', params: { conta: conta.descricao, dia }, refs: [`contas_fixas:${conta.id}`], regras: [] })
    }
  }
  return { porClasse, total, violacoes, avisos }
}
