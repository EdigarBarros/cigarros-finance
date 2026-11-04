/**
 * Planejador de pagamentos: para cada conta, parcela e fatura dos próximos dias, decide com qual dinheiro e em que dia
 * pagar, como alguém que administra o caixa da pessoa.
 *
 * Anda dia a dia (de hoje até o fim do mês que vem): o dinheiro que entra vai para o caixa e cada compromisso vencido é
 * pago assim que o caixa dá. Quando não dá para tudo, paga primeiro o que fica mais caro atrasar (maior multa e juros por
 * dia) e diz quanto o outro vai custar quando chegar a vez dele. Também aponta quando dá para quitar uma dívida que corre
 * juros todo dia (cheque especial, empréstimo sem parcela) com o dinheiro que sobra de uma entrada.
 *
 * Puro, como o resto do motor. Os custos de atraso são estimativas: com os juros da dívida informados, usa eles; sem eles,
 * a regra comum no Brasil para contas (multa de 2% mais 1% ao mês); a fatura do cartão atrasada cai no rotativo, bem mais
 * caro (cerca de 15% ao mês).
 */
import type { Evento } from './analise'
import { fmtDataCurta, fmtTaxa, fmtValor } from './format'
import { tx } from './textos'

export const MULTA_ATRASO = 0.02
/** Juros de mora padrão de uma conta atrasada: 1% ao mês. */
export const JUROS_MORA_MES = 1
/** Rotativo do cartão (estimativa, a faixa comum no Brasil). */
export const JUROS_ROTATIVO_MES = 15

export interface Pagamento {
  descricao: string
  valor: number
  vence: string
  /** Em que dia pagar (null: o dinheiro não dá até o fim da janela). */
  pagarEm: string | null
  /** De onde sai o dinheiro: a entrada daquele dia (ou a mais recente antes dele), ou o saldo da conta. */
  fonte: string | null
  /** Dias de atraso (0 = em dia). */
  atraso: number
  /** Quanto custa a mais pelo atraso (multa e juros, estimado). */
  custo: number
  taxaMes: number
  /** A taxa é estimada (sem os juros informados). */
  estimada: boolean
  origem: Evento['origem']
}

export interface DicaDoPlano {
  id: string
  icone: string
  tom: 'bom' | 'medio' | 'ruim'
  titulo: string
  porque: string
  data?: string
}

export interface PlanoDePagamentos {
  pagamentos: Pagamento[]
  /** Quantos vão atrasar e quanto isso custa. */
  atrasos: number
  custoTotal: number
  semDinheiro: Pagamento[]
  dicas: DicaDoPlano[]
}

const utc = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10))
const diasEntre = (de: string, ate: string) => Math.round((utc(ate) - utc(de)) / 86400000)
const centavos = (n: number) => Math.round(n * 100) / 100

/** Juros por mês de um compromisso atrasado e se é estimativa. */
function taxaDoAtraso(ev: Evento): { taxa: number; estimada: boolean } {
  if (ev.origem === 'cartao') return { taxa: JUROS_ROTATIVO_MES, estimada: true }
  if (ev.origem === 'parcela' && typeof ev.juros === 'number' && ev.juros > 0) return { taxa: ev.juros, estimada: false }
  return { taxa: JUROS_MORA_MES, estimada: true }
}

/** Quanto o compromisso custa pago com `dias` de atraso (multa só se atrasar). */
export const valorComAtraso = (valor: number, taxaMes: number, dias: number) =>
  dias <= 0 ? valor : centavos(valor * (1 + MULTA_ATRASO) + valor * (taxaMes / 100) * (dias / 30))

export interface EntradaPlanejador {
  hoje: string
  /** Fim da janela (último dia do mês que vem). */
  fim: string
  eventos: Evento[]
  /** Saldo da conta corrente hoje (null: não informado; o plano conta só com o que entra). */
  saldoInicial: number | null
  /** Gasto do dia a dia por dia (só com saldo conhecido). */
  ritmoDia: number
  /** Dívidas sem parcela que correm juros todo dia (cheque especial, empréstimo de valor aberto). */
  abertas: { nome: string; saldo: number; juros: number }[]
}

export function planejar(e: EntradaPlanejador): PlanoDePagamentos {
  const compromissos = e.eventos.filter((ev) => ev.tipo === 'saida').map((ev) => ({ ev, vence: ev.vence ?? ev.data, ...taxaDoAtraso(ev) }))
  const entradas = e.eventos.filter((ev) => ev.tipo === 'entrada')
  const datas = [...new Set([e.hoje, ...e.eventos.map((ev) => ev.data)])].sort()
  let caixa = e.saldoInicial ?? 0
  let ultimaFonte: string | null = e.saldoInicial !== null ? tx('o saldo da conta') : null
  let cursor = e.hoje
  const pagos: Pagamento[] = []
  let pendentes: typeof compromissos = []
  /** O caixa que sobra no fim de cada dia em que entrou dinheiro (para ver se dá para adiantar uma dívida aberta). */
  const sobras: { data: string; sobra: number; fonte: string }[] = []

  for (const d of datas) {
    if (e.saldoInicial !== null) caixa -= e.ritmoDia * diasEntre(cursor, d)
    cursor = d
    const doDia = entradas.filter((x) => x.data === d)
    if (doDia.length) {
      caixa += doDia.reduce((s, x) => s + x.valor, 0)
      ultimaFonte = doDia.length === 1 ? doDia[0].descricao : tx('o dinheiro que entra nesse dia')
    }
    pendentes.push(...compromissos.filter((c) => c.ev.data === d))
    // paga primeiro o que fica mais caro atrasar (custo por dia), depois o que venceu antes
    pendentes.sort((a, b) => b.ev.valor * b.taxa - a.ev.valor * a.taxa || a.vence.localeCompare(b.vence))
    const ficam: typeof compromissos = []
    for (const c of pendentes) {
      const atraso = Math.max(0, diasEntre(c.vence, d))
      const devido = valorComAtraso(c.ev.valor, c.taxa, atraso)
      if (caixa + 0.005 >= devido) {
        caixa -= devido
        pagos.push({
          descricao: c.ev.descricao, valor: c.ev.valor, vence: c.vence, pagarEm: d, fonte: ultimaFonte, atraso,
          custo: centavos(devido - c.ev.valor), taxaMes: c.taxa, estimada: c.estimada, origem: c.ev.origem,
        })
      } else ficam.push(c)
    }
    pendentes = ficam
    if (doDia.length) sobras.push({ data: d, sobra: caixa, fonte: ultimaFonte! })
  }
  const semDinheiro: Pagamento[] = pendentes.map((c) => {
    const atraso = Math.max(0, diasEntre(c.vence, e.fim))
    return {
      descricao: c.ev.descricao, valor: c.ev.valor, vence: c.vence, pagarEm: null, fonte: null, atraso,
      custo: centavos(valorComAtraso(c.ev.valor, c.taxa, atraso) - c.ev.valor), taxaMes: c.taxa, estimada: c.estimada, origem: c.ev.origem,
    }
  })
  const pagamentos = [...pagos, ...semDinheiro].sort((a, b) => a.vence.localeCompare(b.vence))
  const atrasados = pagos.filter((p) => p.atraso > 0)
  const dicas: DicaDoPlano[] = []

  // 1. Não dá para pagar tudo de uma vez: qual primeiro e quanto o outro vai custar depois
  const porDia = new Map<string, Pagamento[]>()
  for (const p of atrasados) porDia.set(p.pagarEm!, [...(porDia.get(p.pagarEm!) ?? []), p])
  // num dia em que os dois já tinham vencido, o dinheiro foi para um e o outro esperou: diz por quê
  const ficouParaDepois = (p: Pagamento, x: Pagamento) => x !== p && x.vence <= p.pagarEm! && (x.pagarEm === null || x.pagarEm > p.pagarEm!) && x.taxaMes < p.taxaMes
  const esperaram = [...atrasados, ...semDinheiro]
  const escolha = pagos.find((p) => esperaram.some((x) => ficouParaDepois(p, x)))
  if (escolha) {
    const depois = esperaram.find((x) => ficouParaDepois(escolha, x))!
    dicas.push({
      id: `escolha:${escolha.descricao}`, icone: 'acordo', tom: 'medio', data: escolha.pagarEm!,
      titulo: depois.pagarEm
        ? tx('Em {0}, pague {1} primeiro e deixe {2} para {3}.', fmtDataCurta(escolha.pagarEm!), escolha.descricao, depois.descricao, fmtDataCurta(depois.pagarEm))
        : tx('Em {0}, pague {1} primeiro.', fmtDataCurta(escolha.pagarEm!), escolha.descricao),
      porque: depois.pagarEm
        ? tx('O dinheiro não dá para os dois. {0} cobra mais caro pelo atraso ({1}% ao mês contra {2}%), então vai primeiro. {3} espera {4} dias de atraso e, quando você pagar, vai estar em cerca de {5}, {6} a mais.',
          escolha.descricao, fmtTaxa(escolha.taxaMes), fmtTaxa(depois.taxaMes), depois.descricao, depois.atraso, fmtValor(depois.valor + depois.custo), fmtValor(depois.custo))
        : tx('O dinheiro não dá para os dois. {0} cobra mais caro pelo atraso ({1}% ao mês contra {2}%), então vai primeiro. Para {3} ainda não há dinheiro lançado.',
          escolha.descricao, fmtTaxa(escolha.taxaMes), fmtTaxa(depois.taxaMes), depois.descricao),
    })
  }

  // 2. O que vence antes de o dinheiro chegar: em que dia dá para pagar e quanto custa
  const pior = [...atrasados].filter((p) => p !== escolha && !(escolha && ficouParaDepois(escolha, p))).sort((a, b) => b.custo - a.custo)[0]
  if (pior && !dicas.some((d) => d.id.endsWith(pior.descricao))) {
    dicas.push({
      id: `pagar-em:${pior.descricao}`, icone: 'relogio', tom: 'medio', data: pior.pagarEm!,
      titulo: tx('Pague {0} em {1}, com {2}.', pior.descricao, fmtDataCurta(pior.pagarEm!), pior.fonte ?? tx('o próximo dinheiro')),
      porque: pior.custo >= 0.01
        ? tx('Ela vence em {0}, mas o dinheiro só dá em {1}. Com {2} dias de atraso, vai custar cerca de {3} ({4} a mais de multa e juros{5}).',
          fmtDataCurta(pior.vence), fmtDataCurta(pior.pagarEm!), pior.atraso, fmtValor(pior.valor + pior.custo), fmtValor(pior.custo), pior.estimada ? tx(', numa estimativa') : '')
        : tx('Ela vence em {0}, mas o dinheiro só dá em {1}.', fmtDataCurta(pior.vence), fmtDataCurta(pior.pagarEm!)),
    })
  }

  // 3. Não dá até o fim do mês que vem
  if (semDinheiro.length) {
    const total = centavos(semDinheiro.reduce((s, p) => s + p.valor, 0))
    dicas.push({
      id: 'sem-dinheiro', icone: 'escudo', tom: 'ruim',
      titulo: semDinheiro.length === 1 ? tx('Falta dinheiro para {0}.', semDinheiro[0].descricao) : tx('Falta dinheiro para {0} compromissos.', semDinheiro.length),
      porque: tx('Com o que está lançado para entrar, {0} ficam sem pagar até o fim do mês que vem. Negocie a data agora: antes de vencer, o credor costuma aceitar sem multa.', fmtValor(total)),
    })
  }

  // 4. Dívida que corre juros todo dia: dá para quitar (ou adiantar) com a sobra de alguma entrada?
  for (const ab of [...e.abertas].sort((a, b) => b.juros - a.juros).slice(0, 1)) {
    // a sobra de uma entrada só é livre se o caixa não for preciso depois (o menor caixa daí em diante)
    const livre = sobras.map((s, i) => ({ ...s, livre: Math.min(s.sobra, ...sobras.slice(i).map((x) => x.sobra)) })).find((s) => s.livre >= Math.min(ab.saldo, 50))
    if (!livre) continue
    const paga = centavos(Math.min(ab.saldo, livre.livre))
    const evita = centavos(paga * (ab.juros / 100))
    dicas.push({
      id: `adiantar-aberta:${ab.nome}`, icone: 'cofre', tom: 'bom', data: livre.data,
      titulo: paga >= ab.saldo - 0.005
        ? tx('Dá para quitar {0} em {1}.', ab.nome, fmtDataCurta(livre.data))
        : tx('Dá para adiantar {0} de {1} em {2}.', fmtValor(paga), ab.nome, fmtDataCurta(livre.data)),
      porque: tx('Ela cobra {0}% ao mês, todo dia. Quando entrar {1}, sobram {2} depois de pagar as contas; usando {3} nela, você evita cerca de {4} de juros por mês.',
        fmtTaxa(ab.juros), livre.fonte, fmtValor(livre.livre), fmtValor(paga), fmtValor(evita)),
    })
  }

  return {
    pagamentos, semDinheiro, dicas,
    atrasos: atrasados.length + semDinheiro.length,
    custoTotal: centavos([...atrasados, ...semDinheiro].reduce((s, p) => s + p.custo, 0)),
  }
}
