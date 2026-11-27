/**
 * Uma parcela nova cabe? Além da referência de quanto da renda vai para parcelas (lib/naHora.ts), o plano de pagamentos é
 * refeito com as parcelas novas nas datas delas: alguma conta passa a atrasar? O dinheiro do essencial depois do fim do
 * plano continua lá? E até quanto por mês caberia sem atrasar nada. Puro.
 */
import { simularPagamentos, type EntradaPlanejador } from '../planejador'
import { tx } from '../textos'
import type { EstadoDaDecisao } from './decisao'

export interface ParcelaNova { data: string; valor: number }

export interface AvaliacaoDaParcela {
  /** Quantas das parcelas novas caem dentro do plano (até o fim do mês que vem). */
  noPeriodo: number
  /** Contas que passariam a atrasar (no plano sem a compra, não atrasam). */
  novasAtrasadas: string[]
  essenciaisAtrasadas: string[]
  /** Multa e juros a mais por esses atrasos. */
  custoExtra: number
  /** Com a compra, o dinheiro que precisa ficar para depois do fim do plano deixa de existir. */
  faltaDepois: number
  /** Até quanto por mês caberia, nas mesmas datas, sem nenhum atraso novo (null: sem o saldo de hoje não dá para saber). */
  cabePorMes: number | null
  estado: EstadoDaDecisao
  premissas: string[]
}

const centavos = (n: number) => Math.round(n * 100) / 100
const chave = (p: { descricao: string; vence: string }) => `${p.descricao}|${p.vence}`

function comParcelas(e: EntradaPlanejador, datas: string[], valor: number): EntradaPlanejador {
  return {
    ...e,
    compromissos: [...e.compromissos, ...datas.map((d) => ({ descricao: tx('Compra nova'), valor, vence: d, origem: 'cartao' as const, jurosMes: null }))],
  }
}

/** Dinheiro que sobra no fim, contra o que precisa ficar para o essencial depois do fim. */
const sobraDoFim = (r: ReturnType<typeof simularPagamentos>) => (r.caixaNoDia.length ? Math.min(...r.caixaNoDia.slice(-1).map((x) => x.caixa)) : 0)

export function avaliarParcelaNova(e: EntradaPlanejador, novas: ParcelaNova[]): AvaliacaoDaParcela | null {
  const dentro = novas.filter((p) => p.valor > 0 && p.data >= e.hoje && p.data <= e.fim)
  if (!dentro.length) return null
  const premissas: string[] = []
  const base = simularPagamentos(e)
  const jaAtrasam = new Set([...base.pagamentos.filter((p) => p.atraso > 0), ...base.semDinheiro].map(chave))
  const reserva = Math.max(0, e.depoisDoFim?.valor ?? 0)

  const testar = (datas: string[], valor: number) => {
    const r = simularPagamentos(comParcelas(e, datas, valor))
    const novasAtr = [...r.pagamentos.filter((p) => p.atraso > 0), ...r.semDinheiro].filter((p) => !jaAtrasam.has(chave(p)))
    return { r, novasAtr }
  }
  const datas = dentro.map((p) => p.data)
  const valor = Math.max(...dentro.map((p) => p.valor))
  const { r, novasAtr } = testar(datas, valor)
  const comSaldo = e.saldoInicial !== null
  const faltaDepois = comSaldo && reserva > 0 ? centavos(Math.max(0, reserva - sobraDoFim(r)) - Math.max(0, reserva - sobraDoFim(base))) : 0

  let cabePorMes: number | null = null
  if (comSaldo) {
    const cabe = (v: number) => {
      const t = testar(datas, v)
      return !t.novasAtr.length && (reserva <= 0 || sobraDoFim(t.r) >= Math.min(reserva, sobraDoFim(base)) - 0.005)
    }
    let lo = 0, hi = Math.max(valor * 4, 100)
    if (cabe(hi)) cabePorMes = Math.floor(hi)
    else {
      for (let k = 0; k < 30 && hi - lo > 1; k++) {
        const mid = (lo + hi) / 2
        if (cabe(mid)) lo = mid
        else hi = mid
      }
      cabePorMes = Math.floor(lo)
    }
  } else {
    premissas.push(tx('Sem o saldo de hoje informado, o app não confere se o dinheiro do dia a dia aguenta: contei só o que vai entrar.'))
  }
  if (e.essencialDia) premissas.push(tx('Já deixei separado o essencial do dia a dia (mercado, farmácia, transporte, estimado pelas categorias dos seus gastos) até cada entrada.'))
  if (e.semComprasFuturasDoCartao) premissas.push(tx('Não contei as compras que você ainda vai fazer no cartão: se a fatura vier maior, cabe menos.'))
  if (reserva > 0) premissas.push(tx('E o essencial até o primeiro dinheiro depois do fim do plano.'))
  if (dentro.length < novas.length) premissas.push(tx('O plano vai só até o fim do mês que vem: as parcelas depois disso não entram nesta conta.'))

  const novasAtrasadas = [...new Set(novasAtr.map((p) => p.descricao))]
  return {
    noPeriodo: dentro.length, novasAtrasadas,
    essenciaisAtrasadas: [...new Set(novasAtr.filter((p) => p.essencial).map((p) => p.descricao))],
    custoExtra: centavos(Math.max(0, r.custoTotal - base.custoTotal)),
    faltaDepois, cabePorMes,
    // "cabe" nunca é garantido: sem o saldo, falta dado; sem as compras futuras do cartão, depende delas
    estado: !comSaldo ? 'faltam-dados' : e.semComprasFuturasDoCartao ? 'condicional' : 'recomenda', premissas,
  }
}
