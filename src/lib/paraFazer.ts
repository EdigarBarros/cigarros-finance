/**
 * O "Para fazer" da Início no jeito simples: contas do mês, faturas de cartão e parcelas de dívida numa lista só,
 * na ordem do vencimento (o que já venceu vem primeiro).
 */
import { pendentes, fmtConta, aproxConta, fraseDaSituacao, type SituacaoConta } from './contasFixas'
import type { SituacaoCartao } from './cartoes'
import { calendarioDe, fimDoMes, fmtDiv, type SituacaoDivida } from './dividas'
import { fmtValor } from './format'
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
  /** Só nas atrasadas: há quantos dias venceu (pela data do aparelho, sem fuso de servidor). */
  diasAtraso?: number
  botao: { texto: string; acao: () => void; principal?: boolean }
}

const dois = (n: number) => String(n).padStart(2, '0')
const hojeIso = () => daquiA(0)
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
  // sempre em dias, mesmo quando faz meses: "venceu em 5 de ago" escondia há quanto tempo a conta está parada
  return tx('venceu há {0} dias', -d)
}

/**
 * Tudo que pede uma ação no mês aberto, numa lista só e na ordem do vencimento (o que já venceu vem primeiro).
 * Parcelas: as que vencem até o fim do mês e ainda não foram pagas. Faturas: as do mês que ainda não foram pagas,
 * mais as de meses anteriores que venceram sem pagar.
 */
export function tarefasDoMes({ ano, mes, contas, faturas, dividas, diaRef, aoPagarConta, aoPagarDivida, aoVerCartoes, hoje = hojeIso() }: {
  ano: number; mes: number
  /** AAAA-MM-DD de hoje (no fuso do aparelho); só os testes trocam. */
  hoje?: string
  contas: SituacaoConta[]; faturas: SituacaoCartao[]; dividas: SituacaoDivida[]
  diaRef: string
  aoPagarConta: (s: SituacaoConta) => void
  aoPagarDivida: (s: SituacaoDivida) => void
  aoVerCartoes: () => void
}) {
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
    // parcela atrasada já leva os juros de atraso estimados
    const falta = doMes.reduce((a, p) => a + p.falta + (s.atraso?.porParcela.get(p.n) ?? 0), 0)
    parcelas += falta
    const venc = doMes[0].vencimento
    lista.push({
      chave: `divida:${s.divida.id}`, vencimento: venc, estado: estadoDe(venc, hoje),
      titulo: doMes.length > 1 ? tx('{0}: {1} parcelas', s.divida.descricao, doMes.length) : tx('Parcela: {0}', s.divida.descricao),
      frase: frasePrazo(venc, hoje), valor: fmtDiv(s, falta),
      botao: { texto: tx('Pagar'), acao: () => aoPagarDivida(s), principal: true },
    })
  }

  for (const t of lista) if (t.estado === 'atrasada') t.diasAtraso = Math.max(1, diasEntre(t.vencimento, hoje))
  lista.sort((a, b) => a.vencimento.localeCompare(b.vencimento) || a.titulo.localeCompare(b.titulo))
  return { lista, parcelas: Math.round(parcelas * 100) / 100 }
}

/** Data de hoje mais `dias`, como AAAA-MM-DD (no fuso do aparelho, como o resto da lista). */
export function daquiA(dias: number, hoje = new Date()) {
  const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + dias)
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`
}

export interface GruposDeTarefas {
  /** Já venceram e continuam em aberto (contas, faturas e parcelas de meses anteriores também). */
  atrasadas: Tarefa[]
  /** Vencem de hoje até `limite`. */
  proximas: Tarefa[]
  /** Vencem depois de `limite` (ainda dentro do mês aberto). */
  depois: Tarefa[]
}

/**
 * Separa a lista do mês em três grupos: o que já venceu (precisa de atenção), o que vence até `limite` e o resto. Antes, a
 * lista "Próximos 7 dias" misturava uma fatura vencida em outubro com a conta de amanhã. Uma tarefa fica em um grupo só.
 */
export function agruparTarefas(lista: Tarefa[], limite: string): GruposDeTarefas {
  const g: GruposDeTarefas = { atrasadas: [], proximas: [], depois: [] }
  for (const t of lista) (t.estado === 'atrasada' ? g.atrasadas : t.vencimento <= limite ? g.proximas : g.depois).push(t)
  return g
}

/** "há 3 dias", "há 98 dias": o atraso de uma tarefa para mostrar ao lado do nome. */
export const fraseDoAtraso = (t: Pick<Tarefa, 'diasAtraso' | 'entrada'>) => {
  const n = t.diasAtraso ?? 0
  if (t.entrada) return n === 1 ? tx('não caiu há 1 dia') : tx('não caiu há {0} dias', n)
  return n === 1 ? tx('atrasada há 1 dia') : tx('atrasada há {0} dias', n)
}
