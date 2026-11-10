import type { SituacaoCartao } from './cartoes'
import type { SituacaoConta } from './contasFixas'
import { calendarioDe, meDevem, promessasDe, type SituacaoDivida } from './dividas'
import type { Pagamento } from './types'

/** Algo que ainda vai entrar ou sair num dia do mês e ainda não foi lançado. */
export interface Previsto {
  chave: string
  nome: string
  /** Na moeda principal. */
  valor: number
  tipo: 'entrada' | 'saida'
  /** De onde vem: conta do mês, parcela de uma dívida sua, parcela de alguém que te deve ou fatura do cartão. */
  origem: 'conta' | 'divida' | 'receber' | 'cartao'
  /** Já devia ter acontecido (dia antes de hoje) e não aconteceu. */
  atrasado: boolean
  /** "Parcela 2 de 5", para dívidas com parcelas. */
  detalhe?: string
  /** Veio de uma promessa de pagamento (o atrasado foi para o dia prometido). */
  prometido?: boolean
}

/**
 * O que ainda vem no mês, dia a dia (chave AAAA-MM-DD): contas do mês sem a baixa ("Paguei" / "Recebi") e as parcelas que
 * faltam das dívidas e do que te devem, e a fatura do cartão em aberto, cada uma no dia em que vence. Lançamento já feito
 * não entra aqui (ele está na lista).
 */
export function previstosDoMes({ ano, mes, contas, dividas, faturas = [], pagamentos = [], diaRef, hoje }: {
  ano: number; mes: number; contas: SituacaoConta[]; dividas: SituacaoDivida[]; faturas?: SituacaoCartao[]
  /** Para ver se a promessa de pagamento de cada dívida ainda vale. */
  pagamentos?: Pagamento[]
  diaRef: string; hoje: string
}): Map<string, Previsto[]> {
  const prefixo = `${ano}-${String(mes).padStart(2, '0')}`
  const porDia = new Map<string, Previsto[]>()
  const por = (d: string, p: Previsto) => { const xs = porDia.get(d); if (xs) xs.push(p); else porDia.set(d, [p]) }
  for (const s of contas) {
    if (s.estado === 'paga' || s.estado === 'fora' || s.valor <= 0 || !s.vencimento.startsWith(prefixo)) continue
    por(s.vencimento, {
      chave: `c-${s.conta.id}`, nome: s.conta.descricao, valor: s.valor, tipo: s.conta.tipo, origem: 'conta',
      atrasado: s.estado === 'atrasada',
    })
  }
  for (const s of dividas) {
    if (s.semCotacao || s.restante <= 0) continue
    const recebe = meDevem(s.divida)
    const cal = calendarioDe(s, diaRef)
    const total = cal?.parcelas.length ?? 0
    const nome = s.divida.pessoa && !s.divida.descricao.includes(s.divida.pessoa) ? `${s.divida.descricao} · ${s.divida.pessoa}` : s.divida.descricao
    // com promessa de pagamento de pé, o que está atrasado vai para o dia prometido (o valor prometido, se tiver)
    const ativa = promessasDe(s, pagamentos, hoje).ativa
    if (ativa) {
      const atrasado = (cal?.parcelas ?? []).filter((p) => p.falta > 0 && p.vencimento < hoje).reduce((t, p) => t + p.falta, 0)
      const valor = ativa.valor ?? atrasado
      if (valor > 0 && ativa.promessa.data.startsWith(prefixo)) {
        por(ativa.promessa.data, {
          chave: `pr-${ativa.promessa.id}`, nome, valor: Math.round(valor * 100) / 100, tipo: recebe ? 'entrada' : 'saida',
          origem: recebe ? 'receber' : 'divida', atrasado: false, prometido: true,
        })
      }
    }
    for (const p of cal?.parcelas ?? []) {
      if (p.falta <= 0 || !p.vencimento.startsWith(prefixo)) continue
      if (ativa && p.vencimento < hoje) continue
      por(p.vencimento, {
        chave: `d-${s.divida.id}-${p.n}`,
        nome,
        valor: Math.round(p.falta * 100) / 100, tipo: recebe ? 'entrada' : 'saida', origem: recebe ? 'receber' : 'divida',
        atrasado: p.vencimento < hoje,
        detalhe: total > 1 ? `${p.n}/${total}` : undefined,
      })
    }
  }
  // fatura do cartão em aberto no dia em que vence (as compras ficam na tela Cartões; aqui sai o valor da fatura)
  for (const f of faturas) {
    if (f.paga || f.valor <= 0 || !f.vencimento.startsWith(prefixo)) continue
    por(f.vencimento, {
      chave: `f-${f.cartao.id}-${f.ano}-${f.mes}`, nome: f.cartao.nome, valor: f.valor, tipo: 'saida', origem: 'cartao',
      atrasado: f.vencimento < hoje,
    })
  }
  return porDia
}

export const somaPrevistos = (xs: Previsto[] | undefined, tipo: Previsto['tipo']) =>
  Math.round((xs ?? []).filter((x) => x.tipo === tipo).reduce((t, x) => t + x.valor, 0) * 100) / 100
