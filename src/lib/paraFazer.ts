/**
 * O "Para fazer" da Início no jeito simples: contas do mês, faturas de cartão e parcelas de dívida numa lista só,
 * na ordem do vencimento (o que já venceu vem primeiro).
 */
import { pendentes, fmtConta, aproxConta, fraseDaSituacao, type SituacaoConta } from './contasFixas'
import type { SituacaoCartao } from './cartoes'
import { calendarioDe, fimDoMes, fmtDiv, type SituacaoDivida } from './dividas'
import { fmtDataCurta, fmtValor } from './format'
import { tx } from './textos'

export type Estado = 'atrasada' | 'vence_hoje' | 'a_vencer'

/** Uma linha do "Para fazer": conta do mês, fatura de cartão ou parcela de dívida. */
export interface Tarefa {
  chave: string
  /** AAAA-MM-DD */
  vencimento: string
  estado: Estado
  titulo: string
  frase: string
  valor: string
  aprox?: string
  entrada?: boolean
  botao: { texto: string; acao: () => void; principal?: boolean }
}

const dois = (n: number) => String(n).padStart(2, '0')
const hojeIso = () => { const d = new Date(); return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}` }
const diasEntre = (de: string, ate: string) =>
  Math.round((Date.UTC(+ate.slice(0, 4), +ate.slice(5, 7) - 1, +ate.slice(8, 10)) - Date.UTC(+de.slice(0, 4), +de.slice(5, 7) - 1, +de.slice(8, 10))) / 86400000)
const estadoDe = (venc: string, hoje: string): Estado => (venc < hoje ? 'atrasada' : venc === hoje ? 'vence_hoje' : 'a_vencer')

/** "vence em 3 dias", "venceu ontem"… (as mesmas frases das contas do mês). */
function frasePrazo(venc: string, hoje: string) {
  const d = diasEntre(hoje, venc)
  if (d === 0) return tx('vence hoje')
  if (d === 1) return tx('vence amanhã')
  if (d > 1) return tx('vence em {0} dias', d)
  if (d === -1) return tx('venceu ontem')
  if (d >= -30) return tx('venceu há {0} dias', -d)
  return tx('venceu em {0}', fmtDataCurta(venc))
}

/**
 * Tudo que pede uma ação no mês aberto, numa lista só e na ordem do vencimento (o que já venceu vem primeiro).
 * Parcelas: as que vencem até o fim do mês e ainda não foram pagas. Faturas: as do mês que ainda não foram pagas,
 * mais as de meses anteriores que venceram sem pagar.
 */
export function tarefasDoMes({ ano, mes, contas, faturas, dividas, diaRef, aoPagarConta, aoPagarDivida, aoVerCartoes }: {
  ano: number; mes: number
  contas: SituacaoConta[]; faturas: SituacaoCartao[]; dividas: SituacaoDivida[]
  diaRef: string
  aoPagarConta: (s: SituacaoConta) => void
  aoPagarDivida: (s: SituacaoDivida) => void
  aoVerCartoes: () => void
}) {
  const hoje = hojeIso()
  const fim = fimDoMes(ano, mes)
  const lista: Tarefa[] = []
  let parcelas = 0

  const { atrasadas, proximas } = pendentes(contas)
  for (const s of [...atrasadas, ...proximas]) {
    const entrada = s.conta.tipo === 'entrada'
    lista.push({
      chave: `conta:${s.conta.id}`, vencimento: s.vencimento, estado: s.estado === 'paga' || s.estado === 'fora' ? 'a_vencer' : s.estado,
      titulo: s.conta.descricao, frase: fraseDaSituacao(s), valor: fmtConta(s), aprox: aproxConta(s) || undefined, entrada,
      botao: { texto: entrada ? tx('Recebi') : tx('Paguei'), acao: () => aoPagarConta(s), principal: true },
    })
  }

  for (const s of faturas) {
    const nome = tx('Fatura do cartão {0}', s.cartao.nome)
    for (const f of s.atrasadas) {
      lista.push({
        chave: `fatura:${s.cartao.id}:${f.ano}-${f.mes}`, vencimento: f.vencimento, estado: 'atrasada', titulo: nome,
        frase: frasePrazo(f.vencimento, hoje), valor: fmtValor(f.valor), botao: { texto: tx('Ver fatura'), acao: aoVerCartoes },
      })
    }
    const aPagar = s.valor > 0 && (s.status === 'aberta' || s.status === 'fechada' || s.status === 'atrasada')
    if (aPagar && s.vencimento <= fim) {
      lista.push({
        chave: `fatura:${s.cartao.id}`, vencimento: s.vencimento, estado: estadoDe(s.vencimento, hoje), titulo: nome,
        frase: frasePrazo(s.vencimento, hoje), valor: fmtValor(s.valor), botao: { texto: tx('Ver fatura'), acao: aoVerCartoes },
      })
    }
  }

  for (const s of dividas) {
    const cal = calendarioDe(s, diaRef)
    const doMes = cal?.parcelas.filter((p) => p.falta > 0 && p.vencimento <= fim) ?? []
    if (!doMes.length) continue
    const falta = doMes.reduce((a, p) => a + p.falta, 0)
    parcelas += falta
    const venc = doMes[0].vencimento
    lista.push({
      chave: `divida:${s.divida.id}`, vencimento: venc, estado: estadoDe(venc, hoje),
      titulo: doMes.length > 1 ? tx('{0}: {1} parcelas', s.divida.descricao, doMes.length) : tx('Parcela: {0}', s.divida.descricao),
      frase: frasePrazo(venc, hoje), valor: fmtDiv(s, falta),
      botao: { texto: tx('Pagar'), acao: () => aoPagarDivida(s), principal: true },
    })
  }

  lista.sort((a, b) => a.vencimento.localeCompare(b.vencimento) || a.titulo.localeCompare(b.titulo))
  return { lista, parcelas: Math.round(parcelas * 100) / 100 }
}
