/**
 * Planejador de pagamentos: para cada conta, parcela ou fatura da agenda do dinheiro (lib/analise.ts), decide de qual
 * dinheiro ela sai e em que dia pagar. Quando o dinheiro chega depois do vencimento, calcula quanto ela vai custar no dia
 * em que der para pagar; quando não dá para tudo, paga primeiro o que cobra mais caro pelo atraso e diz quanto a outra vai
 * estar valendo quando chegar a vez dela. Uma entrada nova (os R$ 200 do dia 20) refaz o plano inteiro.
 *
 * É puro como o motor: sem React, sem banco, com o dia de hoje entrando por `hoje`.
 */
import { fmtDataCurta, fmtTaxa, fmtValor } from './format'
import { tx } from './textos'
import type { EstadoDaDecisao } from './decisoes/decisao'

/** Multa por atraso quando ninguém informou: o máximo do Código de Defesa do Consumidor (2%). */
export const MULTA_PADRAO = 0.02
/** Juros de mora de conta e boleto quando ninguém informou (1% ao mês, o comum no Brasil). */
export const MORA_PADRAO_MES = 1
/** Fatura de cartão atrasada cai no rotativo: uma estimativa por baixo dos juros dele, ao mês. */
export const ROTATIVO_ESTIMADO_MES = 14

export interface Compromisso {
  descricao: string
  valor: number
  /** O vencimento de verdade (pode ser antes de hoje). */
  vence: string
  origem: 'lancamento' | 'conta' | 'parcela' | 'cartao' | 'recorrente'
  /** Juros em % ao mês informados pela pessoa (só nas parcelas de dívida); null = estimar. */
  jurosMes?: number | null
  /** De qual dívida é a parcela (o id), para o Planejamento juntar as atrasadas da mesma dívida. */
  grupo?: string
  /** Quantas parcelas de verdade vencem nesse dia (dívida feita de várias compras). */
  pecas?: number
  /**
   * Conta essencial (moradia, água, luz, gás, saúde, escola): pela política do app, é paga antes das outras quando o
   * dinheiro não dá para tudo, mesmo que outra cobre mais caro pelo atraso.
   */
  essencial?: boolean
  /** Quem disse que é essencial: a pessoa, ou o app pelo nome da categoria (inferido). */
  essencialPor?: 'pessoa' | 'categoria'
  /** Prioridade dada pela pessoa (maior vem antes): passa na frente da política do app. */
  prioridadePessoa?: number
}

export interface EntradaDoPlano {
  data: string
  valor: number
  /** Quem paga ("Salário", "Freela e Pix da Ana"). */
  descricao: string
  /**
   * O quanto dá para contar com ela: compromisso conhecido (conta fixa a receber, lançada para o futuro) ou só costume
   * (repete todo mês, mas ninguém combinou). O que te devem não entra aqui: só no Planejar o mês, se a pessoa escolher.
   */
  certeza?: 'compromisso' | 'costume'
}

export interface DividaAberta {
  nome: string
  saldo: number
  /** % ao mês. */
  juros: number
}

export interface EntradaPlanejador {
  hoje: string
  /** Até quando planejar (o fim do mês que vem). */
  fim: string
  /** O que está na conta corrente hoje (null quando a pessoa não informa o saldo dos bancos). */
  saldoInicial: number | null
  /** Gasto do dia a dia por dia (só com saldo conhecido). */
  ritmoDia: number
  entradas: EntradaDoPlano[]
  compromissos: Compromisso[]
  /** Dívidas sem parcela fixa que correm juros todo dia. */
  abertas: DividaAberta[]
  /** Quanto dá para gastar por dia pela previsão do mês (lib/analise.ts), para comparar com o que o caixa aguenta. */
  porDiaDoMes: number | null
  /** Gasto do dia a dia lançado hoje. */
  gastouHoje: number
  /**
   * A parte essencial do gasto do dia a dia, por dia (mercado, farmácia, transporte). Com o saldo conhecido, o plano não
   * usa esse dinheiro para pagar conta não essencial antes do próximo dinheiro.
   */
  essencialDia?: number
  /**
   * O que precisa sobrar no fim do plano: o essencial entre o fim e o próximo dinheiro depois dele. Sem isso, o plano
   * mandaria tudo para adiantar dívida só porque a conta seguinte ficou fora do período.
   */
  depoisDoFim?: { ate: string; valor: number }
  /** Para quando não dá para tudo: o dinheiro guardado e o que te devem, que o plano não usa sozinho. */
  alternativas?: { guardado: number; aReceber: { nome: string; valor: number; data: string | null }[] }
  /**
   * Os testes de estresse: os cenários que a previsão aprendeu (lib/decisoes/cenarios.ts, a partir de `analise.cairo`).
   * Sem eles, nenhum: o planejador não inventa atraso com premissa fixa.
   */
  cenarios?: CenarioDoPlano[]
}

/** Um "e se": muda o que entra ou sai e o plano é refeito, sem olhar o futuro de verdade. */
export interface CenarioDoPlano {
  id: string
  /** A premissa numa frase ("Se o Salário cair 3 dias depois"). */
  premissa: string
  /** Quem montou: o app (premissa fixa) ou a previsão (aprendida com o histórico). */
  origem: 'app' | 'previsao'
  /** Adia entradas: a de `descricao` (ou a próxima grande, sem ela) cai `dias` depois. */
  adiar?: { dias: number; descricao?: string }
  /** Um gasto que ninguém esperava, no dia `data`. */
  imprevisto?: { valor: number; data: string }
  /** Entradas que não vêm (pela descrição). */
  semEntradas?: string[]
}

/** O que um cenário faz com o plano. */
export interface ResultadoDoCenario {
  id: string
  premissa: string
  origem: CenarioDoPlano['origem']
  /** Contas que atrasariam e no plano normal não atrasam. */
  novasAtrasadas: string[]
  /** Das novas, as essenciais. */
  essenciaisAtrasadas: string[]
  /** Quanto o atraso custaria a mais. */
  custoExtra: number
  /** O dinheiro a mais hoje que evitaria todo atraso nesse cenário. */
  faltaMinima: number
}

export type { EstadoDaDecisao }

export interface PagamentoPlanejado {
  descricao: string
  valor: number
  vence: string
  origem: Compromisso['origem']
  /** O dia em que dá para pagar (null: o dinheiro não dá até o fim do mês que vem). */
  pagarEm: string | null
  /** Dias de atraso no dia em que for pago (ou até o fim do plano, se não der). */
  atraso: number
  /** Multa e juros do atraso, em dinheiro. */
  custo: number
  /** Juros do atraso, em % ao mês (informado ou estimado). */
  taxaMes: number
  multa: number
  /** A taxa não foi informada: o custo é uma estimativa. */
  estimada: boolean
  /** De qual dinheiro sai ("Salário"; null quando não há entrada antes e o saldo de hoje não é conhecido). */
  fonte: string | null
  /** O dia em que esse dinheiro entrou (o de hoje, quando sai do saldo). */
  fonteData: string | null
  grupo?: string
  pecas?: number
  /** Conta essencial (a política do app a protege). */
  essencial?: boolean
}

/** Uma decisão do planejador, no mesmo formato das percepções da agenda. */
export interface DicaDoPlano {
  id: string
  icone: string
  tom: 'bom' | 'medio' | 'ruim'
  titulo: string
  porque: string
  data?: string
  /** Recomenda, pergunta (a escolha é da pessoa), condicional (depende de algo acontecer) ou faltam dados. */
  estado?: EstadoDaDecisao
  /** Por que decide assim: a regra do app ou a escolha da pessoa. */
  regra?: 'app' | 'pessoa'
  /** O que sustenta a dica (taxas estimadas, saldo não informado, cenário). */
  premissas?: string[]
  /** O que foi considerado e não escolhido. */
  alternativas?: string[]
}

/** Quanto dá para gastar hoje: o menor entre o que o mês aguenta e o que o caixa aguenta até o próximo dinheiro. */
export interface GastoDeHoje {
  pode: number
  gastou: number
  /** O que ainda dá hoje (pode ser negativo: passou do limite). */
  resta: number
  porDiaDoMes: number | null
  /** O que o saldo aguenta por dia sem atrasar nada até a próxima entrada (null sem saldo informado). */
  porDiaDoCaixa: number | null
  /** Quem manda no número: o mês (sobra-alvo) ou o caixa (contas antes do próximo dinheiro). */
  motivo: 'mes' | 'caixa'
  /** A próxima entrada, até quando vale a conta do caixa. */
  ate: EntradaDoPlano | null
  /** Contas que vencem até a próxima entrada. */
  antesDoDinheiro: number
}

export interface Plano {
  pagamentos: PagamentoPlanejado[]
  semDinheiro: PagamentoPlanejado[]
  dicas: DicaDoPlano[]
  /** Quantos vão atrasar (pagos com atraso + sem dinheiro). */
  atrasos: number
  /** Quanto os atrasos custam, somados. */
  custoTotal: number
  /** O saldo é conhecido: o plano parte do que está na conta hoje. */
  comSaldo: boolean
  /** De onde sai o dinheiro: o saldo de hoje (se conhecido) e cada dia em que entra dinheiro. */
  fontes: EntradaDoPlano[]
  hoje: GastoDeHoje | null
  /** O dinheiro a mais, hoje, que evitaria todo atraso (0: nada atrasa). */
  faltaMinima?: number
  /** O que os testes de estresse fazem com o plano. */
  estresse?: ResultadoDoCenario[]
  /** Essenciais que atrasam mesmo com a proteção (o dinheiro não dá nem para eles). */
  essenciaisAtrasadas?: string[]
  /** Quanto ficou guardado para depois do fim do plano (o essencial até o próximo dinheiro). */
  reservaDepois?: number
}

const centavos = (n: number) => Math.round(n * 100) / 100
const utc = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)))
const diasEntre = (de: string, ate: string) => Math.round((utc(ate) - utc(de)) / 86400000)

/** Juros e multa de um compromisso: o informado ou a estimativa de cada tipo. */
function taxasDe(c: Compromisso): { taxaMes: number; multa: number; estimada: boolean } {
  if (typeof c.jurosMes === 'number' && c.jurosMes >= 0) return { taxaMes: c.jurosMes, multa: MULTA_PADRAO, estimada: false }
  if (c.origem === 'cartao') return { taxaMes: ROTATIVO_ESTIMADO_MES, multa: MULTA_PADRAO, estimada: true }
  return { taxaMes: MORA_PADRAO_MES, multa: MULTA_PADRAO, estimada: true }
}

/** Quanto custa pagar `dias` depois do vencimento: a multa uma vez e os juros proporcionais aos dias. */
export const custoDoAtraso = (valor: number, dias: number, taxaMes: number, multa = MULTA_PADRAO) =>
  dias <= 0 ? 0 : centavos(valor * multa + valor * (taxaMes / 100) * (dias / 30))

interface Pendente extends Compromisso { taxaMes: number; multa: number; estimada: boolean }

/**
 * A ordem de quem pede dinheiro primeiro: o que a pessoa priorizou, depois o essencial (política do app), depois o que
 * cobra mais caro pelo atraso. `semPolitica` desliga a do essencial (para comparar quanto ela custa).
 */
const classe = (p: Pendente, semPolitica: boolean) => (p.prioridadePessoa ? 0 : p.essencial && !semPolitica ? 1 : 2)

/** A simulação dia a dia: de qual dinheiro sai cada conta e em que dia. Puro; o resto do plano lê o que ela devolve. */
export function simularPagamentos(e: EntradaPlanejador, opcoes: { semPolitica?: boolean; extraHoje?: number } = {}) {
  const semPolitica = Boolean(opcoes.semPolitica)
  const comSaldo = e.saldoInicial !== null
  const ritmo = comSaldo ? Math.max(0, e.ritmoDia) : 0
  const essencialDia = comSaldo ? Math.min(ritmo, Math.max(0, e.essencialDia ?? 0)) : 0
  // a entrada de hoje ainda conta: se ela estivesse lançada, não viria como prevista (a pensão do dia 25 sumia à meia-noite)
  const entradas = [...e.entradas].filter((x) => x.valor > 0 && x.data >= e.hoje && x.data <= e.fim).sort((a, b) => a.data.localeCompare(b.data))
  const pendentes: Pendente[] = e.compromissos
    .filter((c) => c.valor > 0 && c.vence <= e.fim)
    .map((c) => ({ ...c, ...taxasDe(c) }))
    .sort((a, b) => a.vence.localeCompare(b.vence) || b.taxaMes - a.taxaMes)
  const antes = (a: Pendente, b: Pendente) => classe(a, semPolitica) - classe(b, semPolitica)
    || (b.prioridadePessoa ?? 0) - (a.prioridadePessoa ?? 0) || b.taxaMes - a.taxaMes || a.vence.localeCompare(b.vence) || a.valor - b.valor

  // Os dias em que algo acontece: hoje, cada entrada e cada vencimento.
  const datas = [...new Set([e.hoje, e.fim, ...entradas.map((x) => x.data), ...pendentes.map((p) => (p.vence < e.hoje ? e.hoje : p.vence))])].sort()
  let caixa = (e.saldoInicial ?? 0) + (opcoes.extraHoje ?? 0)
  let cursor = e.hoje
  let fonte: EntradaDoPlano | null = comSaldo ? { data: e.hoje, valor: e.saldoInicial!, descricao: tx('o saldo de hoje') } : null
  const pagamentos: PagamentoPlanejado[] = []
  /** O caixa no fim de cada dia, para saber quanto de uma entrada fica livre de verdade. */
  const caixaNoDia: { data: string; caixa: number }[] = []
  const sobras: { data: string; sobra: number; fonte: string }[] = []
  const fontes: EntradaDoPlano[] = fonte ? [fonte] : []

  for (const d of datas) {
    caixa -= ritmo * diasEntre(cursor, d)
    cursor = d
    const doDia = entradas.filter((x) => x.data === d)
    if (doDia.length) {
      const valor = centavos(doDia.reduce((s, x) => s + x.valor, 0))
      caixa += valor
      fonte = { data: d, valor, descricao: doDia.map((x) => x.descricao).join(' + ') }
      fontes.push(fonte)
    }
    const proxEntrada = entradas.find((x) => x.data > d)?.data ?? null
    // O essencial do dia a dia até o próximo dinheiro (ou até o fim): conta não essencial não usa esse dinheiro.
    const essencialAteODinheiro = essencialDia * diasEntre(d, proxEntrada ?? e.fim)
    // O que já venceu (ou vence hoje) e ainda não foi pago, na ordem de quem pede primeiro.
    const devidos = pendentes.filter((p) => p.vence <= d).sort(antes)
    for (const p of devidos) {
      const atraso = Math.max(0, diasEntre(p.vence, d))
      const custo = custoDoAtraso(p.valor, atraso, p.taxaMes, p.multa)
      const total = p.valor + custo
      // Guarda para o que vence antes do próximo dinheiro e pede antes desta: pagar esta agora faria aquela atrasar.
      const reservar = pendentes
        .filter((x) => x.vence > d && (!proxEntrada || x.vence < proxEntrada) && antes(x, p) < 0)
        .reduce((s, x) => s + x.valor, 0)
        + (classe(p, semPolitica) === 2 ? essencialAteODinheiro : 0)
      if (caixa - total < reservar - 0.005 || caixa - total < -0.005) continue
      caixa -= total
      pendentes.splice(pendentes.indexOf(p), 1)
      pagamentos.push({
        descricao: p.descricao, valor: p.valor, vence: p.vence, origem: p.origem, pagarEm: d, atraso, custo, taxaMes: p.taxaMes,
        multa: p.multa, estimada: p.estimada, fonte: fonte?.descricao ?? null, fonteData: fonte?.data ?? null, grupo: p.grupo, pecas: p.pecas,
        ...(p.essencial ? { essencial: true } : {}),
      })
    }
    caixaNoDia.push({ data: d, caixa: centavos(caixa) })
    if (doDia.length) sobras.push({ data: d, sobra: centavos(caixa), fonte: fonte!.descricao })
  }

  const semDinheiro: PagamentoPlanejado[] = pendentes.map((p) => {
    const atraso = Math.max(0, diasEntre(p.vence, e.fim))
    return {
      descricao: p.descricao, valor: p.valor, vence: p.vence, origem: p.origem, pagarEm: null, atraso,
      custo: custoDoAtraso(p.valor, atraso, p.taxaMes, p.multa), taxaMes: p.taxaMes, multa: p.multa, estimada: p.estimada, fonte: null, fonteData: null,
      grupo: p.grupo, pecas: p.pecas, ...(p.essencial ? { essencial: true } : {}),
    }
  })
  const atrasados = pagamentos.filter((p) => p.atraso > 0)
  return {
    pagamentos, semDinheiro, caixaNoDia, sobras, fontes, comSaldo,
    atrasos: atrasados.length + semDinheiro.length,
    custoTotal: centavos([...atrasados, ...semDinheiro].reduce((s, p) => s + p.custo, 0)),
  }
}

/** Os que atrasam (pagos depois do vencimento ou sem dinheiro), pelo nome e vencimento. */
const chaveDoAtraso = (p: PagamentoPlanejado) => `${p.descricao}|${p.vence}`
const atrasadosDe = (r: ReturnType<typeof simularPagamentos>) => [...r.pagamentos.filter((p) => p.atraso > 0), ...r.semDinheiro]

/** O dinheiro a mais hoje que faz nada atrasar (busca binária no próprio plano; 0 quando nada atrasa). */
export function faltaMinimaDe(e: EntradaPlanejador): number {
  if (!simularPagamentos(e).atrasos) return 0
  const teto = e.compromissos.reduce((s, c) => s + Math.max(0, c.valor), 0) * 1.2 + 1
  if (simularPagamentos(e, { extraHoje: teto }).atrasos) return Math.ceil(teto)
  let lo = 0, hi = teto
  for (let k = 0; k < 40 && hi - lo > 0.5; k++) {
    const mid = (lo + hi) / 2
    if (simularPagamentos(e, { extraHoje: mid }).atrasos) lo = mid
    else hi = mid
  }
  return Math.ceil(hi)
}

/** A entrada com o cenário aplicado (adiar, imprevisto, entrada que não vem). */
export function aplicarCenario(e: EntradaPlanejador, c: CenarioDoPlano): EntradaPlanejador {
  let entradas = [...e.entradas]
  if (c.semEntradas?.length) entradas = entradas.filter((x) => !c.semEntradas!.includes(x.descricao))
  if (c.adiar) {
    const alvo = c.adiar.descricao
      ? entradas.find((x) => x.descricao === c.adiar!.descricao)
      : [...entradas].filter((x) => x.data >= e.hoje).sort((a, b) => b.valor - a.valor || a.data.localeCompare(b.data))[0]
    if (alvo) entradas = entradas.map((x) => (x === alvo ? { ...x, data: maisDias(x.data, c.adiar!.dias) } : x))
  }
  const compromissos = c.imprevisto && c.imprevisto.valor > 0
    ? [...e.compromissos, { descricao: tx('Imprevisto'), valor: c.imprevisto.valor, vence: c.imprevisto.data, origem: 'lancamento' as const, jurosMes: 0, essencial: true }]
    : e.compromissos
  return { ...e, entradas, compromissos }
}

function estresseDe(e: EntradaPlanejador, base: ReturnType<typeof simularPagamentos>, faltaBase: number): ResultadoDoCenario[] {
  const jaAtrasam = new Set(atrasadosDe(base).map(chaveDoAtraso))
  return (e.cenarios ?? []).map((c) => {
    const ee = aplicarCenario(e, c)
    const r = simularPagamentos(ee)
    const novas = atrasadosDe(r).filter((p) => !jaAtrasam.has(chaveDoAtraso(p)) && p.descricao !== tx('Imprevisto'))
    return {
      id: c.id, premissa: c.premissa, origem: c.origem,
      novasAtrasadas: [...new Set(novas.map((p) => p.descricao))],
      essenciaisAtrasadas: [...new Set(novas.filter((p) => p.essencial).map((p) => p.descricao))],
      custoExtra: centavos(Math.max(0, r.custoTotal - base.custoTotal)),
      faltaMinima: novas.length ? Math.max(0, faltaMinimaDe(ee) - faltaBase) : 0,
    }
  })
}

const maisDias = (iso: string, n: number) => new Date(utc(iso) + n * 86400000).toISOString().slice(0, 10)

export function planejar(e: EntradaPlanejador): Plano {
  const base = simularPagamentos(e)
  const { pagamentos, semDinheiro, caixaNoDia, sobras, fontes, comSaldo } = base
  const atrasados = pagamentos.filter((p) => p.atraso > 0)
  const dicas: DicaDoPlano[] = []
  const semSaldo = comSaldo ? '' : ` ${tx('(Sem o saldo de hoje informado, contei só o dinheiro que ainda vai entrar.)')}`

  // 1. Não dá para pagar tudo de uma vez: qual primeiro e quanto o outro vai custar depois. Vai primeiro o que a pessoa
  // priorizou, depois o essencial (política do app), depois o que cobra mais caro pelo atraso.
  const pesa = (p: PagamentoPlanejado) => {
    const c = e.compromissos.find((x) => x.descricao === p.descricao && x.vence === p.vence)
    return { pessoa: c?.prioridadePessoa ?? 0, essencial: Boolean(c?.essencial), por: c?.essencialPor }
  }
  const passouNaFrente = (p: PagamentoPlanejado, x: PagamentoPlanejado) => x !== p && x.vence <= p.pagarEm! && x.pagarEm! > p.pagarEm!
    && (pesa(p).pessoa > pesa(x).pessoa || (pesa(p).pessoa === pesa(x).pessoa && ((pesa(p).essencial && !pesa(x).essencial) || (pesa(p).essencial === pesa(x).essencial && x.taxaMes < p.taxaMes))))
  const escolha = pagamentos.find((p) => atrasados.some((x) => passouNaFrente(p, x)))
  // o que a política do essencial custa: o mesmo plano sem ela
  const semPolitica = simularPagamentos(e, { semPolitica: true })
  if (escolha) {
    const depois = atrasados.find((x) => passouNaFrente(escolha, x))!
    const porPessoa = pesa(escolha).pessoa > pesa(depois).pessoa
    const porEssencial = !porPessoa && pesa(escolha).essencial && !pesa(depois).essencial
    const custaMais = centavos(base.custoTotal - semPolitica.custoTotal)
    dicas.push({
      id: `escolha:${escolha.descricao}`, icone: 'acordo', tom: 'medio', data: escolha.pagarEm!, estado: 'recomenda', regra: porPessoa ? 'pessoa' : 'app',
      titulo: tx('Pague {0} primeiro e deixe {1} para {2}.', escolha.descricao, depois.descricao, fmtDataCurta(depois.pagarEm!)),
      porque: [
        porPessoa ? tx('Em {0} o dinheiro não dá para os dois. Você pediu para {1} vir antes, então vai primeiro.', fmtDataCurta(escolha.pagarEm!), escolha.descricao)
          : porEssencial ? tx('Em {0} o dinheiro não dá para os dois. {1} é uma conta essencial, então vai primeiro, mesmo que {2} cobre mais pelo atraso.', fmtDataCurta(escolha.pagarEm!), escolha.descricao, depois.descricao)
            : tx('Em {0} o dinheiro não dá para os dois. {1} cobra mais caro pelo atraso ({2}% ao mês), então vai primeiro.', fmtDataCurta(escolha.pagarEm!), escolha.descricao, fmtTaxa(escolha.taxaMes)),
        depois.atraso === 1
          ? tx('{0} atrasa 1 dia e, quando você pagar, vai estar em cerca de {1}, {2} a mais.', depois.descricao, fmtValor(depois.valor + depois.custo), fmtValor(depois.custo))
          : tx('{0} atrasa {1} dias e, quando você pagar, vai estar em cerca de {2}, {3} a mais.', depois.descricao, depois.atraso, fmtValor(depois.valor + depois.custo), fmtValor(depois.custo)),
        depois.estimada ? tx('Os juros de {0} são uma estimativa ({1}% ao mês mais 2% de multa).', depois.descricao, fmtTaxa(depois.taxaMes)) : '',
      ].filter(Boolean).join(' '),
      premissas: [
        ...(porEssencial && pesa(escolha).por === 'categoria' ? [tx('Considerei {0} essencial pela categoria.', escolha.descricao)] : []),
        ...(depois.estimada ? [tx('Juros de atraso de {0} estimados.', depois.descricao)] : []),
      ],
      alternativas: porEssencial && custaMais >= 0.01
        ? [tx('Pagar {0} antes custaria cerca de {1} a menos de multa e juros, mas deixaria {2} atrasada. No Planejar o mês, você escolhe o contrário se preferir.', depois.descricao, fmtValor(custaMais), escolha.descricao)]
        : [],
    })
  }

  // 2. O que vence antes de o dinheiro chegar: em que dia dá para pagar e quanto custa
  const jaDito = (p: PagamentoPlanejado) => dicas.some((d) => d.id.endsWith(`:${p.descricao}`)) || (escolha && passouNaFrente(escolha, p))
  const pior = [...atrasados].filter((p) => p !== escolha && !jaDito(p)).sort((a, b) => b.custo - a.custo || b.atraso - a.atraso)[0]
  // A reserva do essencial do dia a dia empurrou esta conta? Então a dica diz, e diz quanto custa (a escolha é da pessoa).
  const semReserva = pior && comSaldo && (e.essencialDia ?? 0) > 0 ? simularPagamentos({ ...e, essencialDia: 0 }) : null
  const antesSemReserva = pior && semReserva?.pagamentos.find((x) => x.descricao === pior.descricao && x.vence === pior.vence)
  const pelaReserva = Boolean(pior && antesSemReserva && antesSemReserva.pagarEm! < pior.pagarEm!)
  if (pior) {
    dicas.push({
      id: `pagar-em:${pior.descricao}`, icone: 'relogio', tom: 'medio', data: pior.pagarEm!, estado: comSaldo ? 'recomenda' : 'faltam-dados', regra: 'app',
      premissas: [
        ...(pior.estimada ? [tx('Juros de atraso de {0} estimados.', pior.descricao)] : []),
        ...(comSaldo ? [] : [tx('Sem o saldo de hoje, contei só o dinheiro que ainda vai entrar.')]),
        ...(pelaReserva ? [tx('Deixei separado o essencial do dia a dia (mercado, farmácia, transporte) até o próximo dinheiro: por isso {0} espera.', pior!.descricao)] : []),
      ],
      alternativas: [
        ...(pelaReserva ? [tx('Pagar {0} em {1} custaria {2} a menos, mas tiraria o dinheiro do essencial do dia a dia até o próximo dinheiro.', pior.descricao, fmtDataCurta(antesSemReserva!.pagarEm!), fmtValor(centavos(Math.max(0, pior.custo - antesSemReserva!.custo))))] : []),
        tx('Negociar a data antes de vencer.'),
      ],
      titulo: tx('Pague {0} em {1}, com {2}.', pior.descricao, fmtDataCurta(pior.pagarEm!), pior.fonte ?? tx('o próximo dinheiro')),
      porque: [
        tx('{0} vence em {1}, mas o dinheiro só dá em {2}.', pior.descricao, fmtDataCurta(pior.vence), fmtDataCurta(pior.pagarEm!)),
        pior.custo < 0.01 ? ''
          : pior.atraso === 1
            ? tx('Com 1 dia de atraso, vai custar cerca de {0} ({1} a mais de multa e juros).', fmtValor(pior.valor + pior.custo), fmtValor(pior.custo))
            : tx('Com {0} dias de atraso, vai custar cerca de {1} ({2} a mais de multa e juros).', pior.atraso, fmtValor(pior.valor + pior.custo), fmtValor(pior.custo)),
        pior.custo >= 0.01 && pior.estimada ? tx('Os juros de {0} são uma estimativa ({1}% ao mês mais 2% de multa).', pior.descricao, fmtTaxa(pior.taxaMes)) : '',
        tx('Se der para negociar a data antes de vencer, melhor: costuma sair sem multa.'),
        semSaldo.trim(),
      ].filter(Boolean).join(' '),
    })
  }

  // 3. Não dá até o fim do mês que vem
  // o mínimo que faltaria hoje para nada atrasar, e de onde ele pode vir (o guardado e quem te deve, só se a pessoa quiser)
  const faltaMinima = faltaMinimaDe(e)
  const saidas: string[] = []
  if (faltaMinima > 0) {
    const guardado = e.alternativas?.guardado ?? 0
    if (guardado >= faltaMinima) saidas.push(tx('Usar {0} do dinheiro guardado evita todo atraso (no Planejar o mês, ligue "Usar o dinheiro guardado").', fmtValor(faltaMinima)))
    else if (guardado >= 1) saidas.push(tx('O dinheiro guardado ({0}) cobre parte dos {1} que faltam.', fmtValor(guardado), fmtValor(faltaMinima)))
    for (const r of (e.alternativas?.aReceber ?? []).filter((x) => x.valor > 0).slice(0, 2)) {
      saidas.push(r.data
        ? tx('Se {0} pagar {1} até {2}, ajuda; mas pode não cair, então o plano não conta com isso.', r.nome, fmtValor(r.valor), fmtDataCurta(r.data))
        : tx('Se {0} pagar os {1}, ajuda; sem dia combinado, o plano não conta com isso.', r.nome, fmtValor(r.valor)))
    }
    saidas.push(tx('Negociar as datas antes de vencer, começando pelo que não é essencial.'))
  }
  const essenciaisAtrasadas = [...new Set([...atrasados, ...semDinheiro].filter((p) => p.essencial).map((p) => p.descricao))]
  if (semDinheiro.length) {
    const total = centavos(semDinheiro.reduce((s, p) => s + p.valor, 0))
    dicas.push({
      id: 'sem-dinheiro', icone: 'escudo', tom: 'ruim', data: semDinheiro[0].vence < e.hoje ? e.hoje : semDinheiro[0].vence,
      estado: comSaldo ? 'recomenda' : 'faltam-dados', regra: 'app', alternativas: saidas,
      premissas: comSaldo ? [] : [tx('Sem o saldo de hoje, contei só o dinheiro que ainda vai entrar: informe o saldo dos bancos para saber se falta mesmo.')],
      titulo: semDinheiro.length === 1 ? tx('Falta dinheiro para {0}.', semDinheiro[0].descricao) : tx('Falta dinheiro para {0} compromissos.', semDinheiro.length),
      porque: tx('Com o que está lançado para entrar, {0} ficam sem pagar até o fim do mês que vem. Negocie a data agora: antes de vencer, o credor costuma aceitar sem multa.', fmtValor(total)) + semSaldo,
    })
  }

  // 4. Dívida que corre juros todo dia: dá para quitar (ou adiantar) com a sobra de alguma entrada? Só a sobra livre de
  // verdade: o menor caixa daí em diante, menos o essencial que precisa ficar para depois do fim do plano.
  const reservaDepois = centavos(Math.max(0, e.depoisDoFim?.valor ?? 0))
  for (const ab of [...e.abertas].filter((x) => x.juros > 0 && x.saldo > 0).sort((a, b) => b.juros - a.juros).slice(0, 1)) {
    const livre = sobras
      .map((s) => ({ ...s, livre: centavos(Math.min(s.sobra, ...caixaNoDia.filter((x) => x.data >= s.data).map((x) => x.caixa)) - reservaDepois) }))
      .find((s) => s.livre >= Math.min(ab.saldo, 50))
    if (!livre) continue
    const paga = centavos(Math.min(ab.saldo, livre.livre))
    const evita = centavos(paga * (ab.juros / 100))
    dicas.push({
      id: `adiantar-aberta:${ab.nome}`, icone: 'cofre', tom: 'bom', data: livre.data, estado: 'recomenda', regra: 'app',
      titulo: paga >= ab.saldo - 0.005
        ? tx('Dá para quitar {0} em {1}.', ab.nome, fmtDataCurta(livre.data))
        : tx('Dá para adiantar {0} de {1} em {2}.', fmtValor(paga), ab.nome, fmtDataCurta(livre.data)),
      porque: tx('{0} cobra {1}% ao mês, e os juros correm todo dia. Quando entrar {2} e as contas forem pagas, sobram {3}; usando {4} para pagar essa dívida, você evita cerca de {5} de juros por mês.',
        ab.nome, fmtTaxa(ab.juros), livre.fonte, fmtValor(livre.livre), fmtValor(paga), fmtValor(evita)),
      premissas: reservaDepois > 0 && e.depoisDoFim
        ? [tx('Já deixei {0} separados para o essencial entre {1} e {2}, quando entra o próximo dinheiro.', fmtValor(reservaDepois), fmtDataCurta(e.fim), fmtDataCurta(e.depoisDoFim.ate))]
        : [],
    })
  }

  // 5. E se: o plano aguenta o salário atrasar ou um imprevisto? Só avisa o que vira atraso de conta essencial (ou de
  // tudo, quando o plano normal não atrasa nada), com a premissa dita e o quanto deixar separado.
  const estresse = estresseDe(e, base, faltaMinima)
  const fragil = estresse.find((r) => r.essenciaisAtrasadas.length) ?? (base.atrasos ? undefined : estresse.find((r) => r.novasAtrasadas.length))
  if (fragil) {
    const lista = (fragil.essenciaisAtrasadas.length ? fragil.essenciaisAtrasadas : fragil.novasAtrasadas).slice(0, 2)
    dicas.push({
      id: `e-se:${fragil.id}`, icone: 'escudo', tom: 'medio', estado: 'condicional', regra: 'app',
      titulo: lista.length === 1 ? tx('{0}, {1} atrasa.', fragil.premissa, lista[0]) : tx('{0}, {1} e {2} atrasam.', fragil.premissa, lista[0], lista[1]),
      porque: fragil.faltaMinima >= 1
        ? tx('O plano de hoje fecha, mas fica justo. Deixar {0} separados (ou passar o vencimento para depois do dinheiro) cobre esse caso.', fmtValor(fragil.faltaMinima))
        : tx('O plano de hoje fecha, mas fica justo. Passar o vencimento para depois do dinheiro cobre esse caso.'),
      premissas: [fragil.origem === 'app' ? tx('É um teste com premissa fixa, não uma previsão.') : tx('Cenário tirado do seu histórico.')],
    })
  }

  return {
    pagamentos, semDinheiro, dicas, comSaldo, fontes,
    atrasos: base.atrasos,
    custoTotal: base.custoTotal,
    hoje: gastoDeHoje(e),
    faltaMinima, estresse, essenciaisAtrasadas, reservaDepois,
  }
}

/**
 * Quanto dá para gastar hoje. O mês diz quanto sobra por dia guardando a sobra-alvo; o caixa diz quanto o saldo aguenta
 * por dia sem atrasar nenhuma conta até o próximo dinheiro entrar. Vale o menor dos dois.
 */
function gastoDeHoje(e: EntradaPlanejador): GastoDeHoje | null {
  const ate = [...e.entradas].filter((x) => x.valor > 0 && x.data > e.hoje).sort((a, b) => a.data.localeCompare(b.data))[0] ?? null
  const limite = ate?.data ?? e.fim
  const antesDoDinheiro = centavos(e.compromissos.filter((c) => c.valor > 0 && c.vence < limite).reduce((s, c) => s + c.valor, 0))
  const porDiaDoCaixa = e.saldoInicial === null ? null
    : centavos(Math.max(0, e.saldoInicial - antesDoDinheiro) / Math.max(1, diasEntre(e.hoje, limite)))
  if (porDiaDoCaixa === null && e.porDiaDoMes === null) return null
  const mes = e.porDiaDoMes === null ? null : Math.max(0, e.porDiaDoMes)
  const motivo: GastoDeHoje['motivo'] = porDiaDoCaixa !== null && (mes === null || porDiaDoCaixa < mes) ? 'caixa' : 'mes'
  const pode = Math.floor(motivo === 'caixa' ? porDiaDoCaixa! : mes!)
  return {
    pode, gastou: centavos(e.gastouHoje), resta: centavos(pode - e.gastouHoje), porDiaDoMes: mes, porDiaDoCaixa, motivo, ate, antesDoDinheiro,
  }
}
