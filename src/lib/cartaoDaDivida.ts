/**
 * O compositor do cartão de cada dívida (tela Dívidas, "Cada dívida"): a mesma ideia do compositor do Consultor
 * (lib/composicao.ts), em ponto pequeno. O topo do cartão (quem, nome, estado) e o botão de pagar não mudam; o miolo é
 * montado para aquela dívida, escolhendo peças de um catálogo:
 *
 * 1. **Os traços da dívida** (`tracosDe`): parcelada ou valor único, com ou sem data, atrasada há quantos dias, com juros
 *    do contrato, com juros de atraso crescendo, feita de partes, empréstimo com valor recebido, de pessoa ou de banco…
 * 2. **O destaque** (o desenho grande ao lado do valor): cada um tem uma nota de aptidão para aqueles traços; vence o de
 *    maior nota entre os que servem. Ex.: atrasada sem nada pago → os dias de atraso (um anel de 0% não diz nada);
 *    parcelada → as parcelas num anel de fatias; valor único com data → a folhinha do dia; juros altos → a taxa.
 * 3. **As peças do miolo**: também por aptidão, até caber no espaço (`ORCAMENTO`), sem duas da mesma família (duas
 *    barras de progresso, dois avisos de tempo) e sem repetir o que o destaque já mostra.
 *
 * Puro: mesmos traços, mesmo cartão. As peças são desenhadas em components/CartaoDaDivida.tsx.
 */
import { atrasadoHoje, gruposDasPartes, meDevem, type Calendario, type SituacaoDivida } from './dividas'
import { diasEntre } from './jurosAtraso'

export interface TracosDaDivida {
  /** Lado "me devem": o que se recebe. */
  recebe: boolean
  quitada: boolean
  /** Quanto falta (com os juros de atraso estimados) e quanto falta registrado. */
  restanteHoje: number
  restante: number
  /** Maior saldo já registrado (base do progresso) e quanto já foi pago. */
  inicial: number
  pago: number
  /** Parcelas do calendário (só quando há mais de uma). */
  parcelas: { total: number; pagas: number; atrasadas: number; estados: ('paga' | 'parcial' | 'atrasada' | 'aberta')[] } | null
  /** A parcela (ou data) que vem: quando e quanto. */
  proxima: { data: string; valor: number } | null
  /** Tem alguma data combinada (parcela, vencimento único ou partes). */
  temData: boolean
  /** O que está vencido hoje (com juros estimados) e desde quando. */
  vencido: { valor: number; desde: string } | null
  /** Juros do contrato, em % ao mês. */
  jurosContrato: number | null
  /** Juros de atraso: quanto já somou e quanto cresce por dia. */
  jurosAtraso: { total: number; porDia: number } | null
  /** Empréstimo com o valor recebido de fato: quanto veio e quanto volta. */
  emprestimo: { recebido: number; total: number } | null
  /** Partes da dívida (só com duas ou mais). */
  partes: { nome: string; valor: number }[]
  /** Previsão de quitar [ano, mês] e quantos meses faltam. */
  quitacao: [number, number] | null
  mesesRestantes: number | null
  /** Hoje, 'AAAA-MM-DD'. */
  hoje: string
}

export type Destaque = 'fatias' | 'anel' | 'folhinha' | 'dias' | 'taxa' | 'festa'
export type Peca =
  | 'parcelas' | 'barra' | 'chegada'
  | 'atraso' | 'proxima' | 'livre'
  | 'crescendo' | 'jurosContrato' | 'emprestimo'
  | 'partes' | 'quitada'

export interface Montagem {
  destaque: Destaque
  pecas: Peca[]
  /** O link embaixo do botão: conferir o valor com o banco (quando os juros são estimados). */
  conferir: boolean
}

/** Espaço do miolo, em unidades (a maior parte das peças ocupa 1; as com gráfico, 2). */
export const ORCAMENTO = 4

interface DefPeca { familia: string; altura: number; aptidao: (t: TracosDaDivida, d: Destaque) => number }

/** Nota 0 a 1 de cada destaque para estes traços (0: não serve). */
const DESTAQUES: Record<Destaque, (t: TracosDaDivida) => number> = {
  festa: (t) => (t.quitada ? 1 : 0),
  // juros de contrato altos (agiota, cheque especial): a taxa é o que mais importa ver
  taxa: (t) => (t.jurosContrato !== null && t.jurosContrato >= 8 ? 0.92 : 0),
  // vencida sem nada pago: o tempo de atraso diz mais que um anel em 0%
  dias: (t) => (!t.vencido ? 0 : t.pago <= 0 ? 0.9 : t.parcelas ? 0.55 : 0.7),
  // parcelas: um anel em fatias, uma por parcela (até 24; acima disso vira o anel comum)
  fatias: (t) => (t.parcelas && t.parcelas.total >= 2 && t.parcelas.total <= 24 ? (t.parcelas.pagas > 0 ? 0.86 : 0.6) : 0),
  // valor único com data e ainda no prazo: a folhinha do dia
  folhinha: (t) => (!t.parcelas && t.proxima && !t.vencido ? 0.84 : 0),
  // o anel de quanto já foi pago: bom quando já tem progresso
  anel: (t) => (t.inicial <= 0 ? 0 : t.pago > 0 ? 0.7 : 0.25),
}

const PECAS: Record<Peca, DefPeca> = {
  quitada: { familia: 'fim', altura: 1, aptidao: (t) => (t.quitada ? 1 : 0) },
  atraso: { familia: 'tempo', altura: 1, aptidao: (t, d) => (t.vencido ? (d === 'dias' ? 0.8 : 0.95) : 0) },
  // sem data: o que define a dívida é poder pagar quando quiser
  livre: { familia: 'tempo', altura: 1, aptidao: (t) => (!t.temData && !t.parcelas && !t.quitada ? 0.9 : 0) },
  proxima: { familia: 'tempo', altura: 1, aptidao: (t, d) => (t.proxima && !t.vencido ? (d === 'folhinha' ? 0 : 0.72) : 0) },
  crescendo: { familia: 'custo', altura: 2, aptidao: (t) => (t.jurosAtraso && t.jurosAtraso.porDia > 0 ? 0.88 : 0) },
  jurosContrato: { familia: 'custo', altura: 2, aptidao: (t) => (t.jurosContrato && t.jurosContrato > 0 && t.restante > 0 ? (t.jurosContrato >= 8 ? 0.8 : 0.42) : 0) },
  emprestimo: { familia: 'custo', altura: 2, aptidao: (t) => (t.emprestimo && t.emprestimo.recebido > 0 && t.emprestimo.total > 0 ? 0.74 : 0) },
  parcelas: { familia: 'progresso', altura: 1, aptidao: (t, d) => (t.parcelas && t.parcelas.total >= 2 && t.parcelas.total <= 36 && d !== 'fatias' ? 0.8 : 0) },
  barra: { familia: 'progresso', altura: 1, aptidao: (t, d) => (t.inicial > 0 && !t.parcelas && t.pago > 0 && d !== 'anel' ? 0.55 : 0) },
  chegada: { familia: 'fim', altura: 1, aptidao: (t) => (t.quitacao && !t.vencido && t.mesesRestantes !== null && t.mesesRestantes > 1 ? 0.6 : 0) },
  partes: { familia: 'composicao', altura: 2, aptidao: (t) => (t.partes.length >= 2 ? 0.66 : 0) },
}

/** Monta o cartão: o destaque de maior nota e as peças que cabem, das mais aptas para as menos. */
export function montarCartao(t: TracosDaDivida): Montagem {
  const destaque = (Object.keys(DESTAQUES) as Destaque[])
    .map((d) => ({ d, nota: DESTAQUES[d](t) }))
    .filter((x) => x.nota > 0)
    .sort((a, b) => b.nota - a.nota)[0]?.d ?? 'anel'
  // quitada: a festa e a linha de tudo pago, e mais nada
  if (t.quitada) return { destaque, pecas: ['quitada'], conferir: false }
  const notas = (Object.keys(PECAS) as Peca[])
    .map((p) => ({ p, nota: PECAS[p].aptidao(t, destaque) }))
    .filter((x) => x.nota > 0)
    .sort((a, b) => b.nota - a.nota || a.p.localeCompare(b.p))
  const pecas: Peca[] = []
  const familias = new Set<string>()
  let usado = 0
  for (const { p } of notas) {
    const def = PECAS[p]
    if (familias.has(def.familia) || usado + def.altura > ORCAMENTO) continue
    pecas.push(p)
    familias.add(def.familia)
    usado += def.altura
  }
  return { destaque, pecas, conferir: !t.quitada && Boolean(t.jurosAtraso && t.jurosAtraso.total > 0) }
}

/** Dias de atraso desde a primeira parcela vencida. */
export const diasDeAtraso = (t: Pick<TracosDaDivida, 'vencido' | 'hoje'>) => (t.vencido ? Math.max(0, diasEntre(t.vencido.desde, t.hoje)) : 0)
/** Dias até a próxima data (0 = hoje). */
export const diasAte = (t: Pick<TracosDaDivida, 'proxima' | 'hoje'>) => (t.proxima ? diasEntre(t.hoje, t.proxima.data) : null)
/** Quanto a dívida fica se nada for pago por um mês, com os juros do contrato. */
export const emUmMes = (t: Pick<TracosDaDivida, 'restanteHoje' | 'jurosContrato'>) =>
  Math.round(t.restanteHoje * (1 + (t.jurosContrato ?? 0) / 100) * 100) / 100

/** Os traços da dívida, a partir da situação e do calendário (os mesmos números do resto da tela). */
export function tracosDe(s: SituacaoDivida, cal: Calendario | null, recebe: boolean, hoje: string): TracosDaDivida {
  const quitada = s.restante <= 0
  const ps = cal && cal.parcelas.length > 1 ? cal.parcelas : null
  const o = s.original
  const recebido = o.valor_recebido != null && o.valor_recebido > 0 ? o.valor_recebido * s.taxa : null
  const totalEmprestimo = s.divida.valor_parcela && ps ? s.divida.valor_parcela * ps.length : s.saldoInicial
  const juros = s.divida.juros_mes
  return {
    recebe,
    quitada,
    restanteHoje: s.restanteHoje,
    restante: s.restante,
    inicial: s.saldoInicial,
    pago: Math.max(0, s.saldoInicial - s.restante),
    parcelas: ps ? {
      total: ps.length,
      pagas: ps.filter((p) => p.estado === 'paga').length,
      atrasadas: ps.filter((p) => p.estado === 'atrasada').length,
      estados: ps.map((p) => (p.estado === 'paga' ? 'paga' : p.estado === 'parcial' ? 'parcial' : p.estado === 'atrasada' ? 'atrasada' : 'aberta')),
    } : null,
    proxima: cal?.proxima ? { data: cal.proxima.vencimento, valor: cal.proxima.falta } : null,
    temData: Boolean(cal && cal.parcelas.length),
    vencido: cal?.atrasadas.length ? { valor: atrasadoHoje(s, cal), desde: cal.atrasadas[0].vencimento } : null,
    jurosContrato: !meDevem(s.divida) && !quitada && typeof juros === 'number' && juros > 0 ? juros : null,
    jurosAtraso: s.atraso && s.jurosAtraso > 0 ? { total: s.jurosAtraso, porDia: s.atraso.diario } : null,
    emprestimo: recebido ? { recebido, total: totalEmprestimo } : null,
    partes: s.divida.partes?.length ? gruposDasPartes(s.divida.partes).map((g) => ({ nome: g.nome, valor: g.total })).filter((g) => g.valor > 0) : [],
    quitacao: s.quitacao,
    mesesRestantes: s.mesesRestantes,
    hoje,
  }
}

