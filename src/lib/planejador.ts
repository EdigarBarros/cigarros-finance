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
}

export interface EntradaDoPlano {
  data: string
  valor: number
  /** Quem paga ("Salário", "Freela e Pix da Ana"). */
  descricao: string
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
}

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
}

/** Uma decisão do planejador, no mesmo formato das percepções da agenda. */
export interface DicaDoPlano {
  id: string
  icone: string
  tom: 'bom' | 'medio' | 'ruim'
  titulo: string
  porque: string
  data?: string
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

export function planejar(e: EntradaPlanejador): Plano {
  const comSaldo = e.saldoInicial !== null
  const ritmo = comSaldo ? Math.max(0, e.ritmoDia) : 0
  const entradas = [...e.entradas].filter((x) => x.valor > 0 && x.data > e.hoje && x.data <= e.fim).sort((a, b) => a.data.localeCompare(b.data))
  const pendentes: Pendente[] = e.compromissos
    .filter((c) => c.valor > 0 && c.vence <= e.fim)
    .map((c) => ({ ...c, ...taxasDe(c) }))
    .sort((a, b) => a.vence.localeCompare(b.vence) || b.taxaMes - a.taxaMes)

  // Os dias em que algo acontece: hoje, cada entrada e cada vencimento.
  const datas = [...new Set([e.hoje, e.fim, ...entradas.map((x) => x.data), ...pendentes.map((p) => (p.vence < e.hoje ? e.hoje : p.vence))])].sort()
  let caixa = e.saldoInicial ?? 0
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
    // O que já venceu (ou vence hoje) e ainda não foi pago, do que cobra mais caro pelo atraso para o mais barato.
    const devidos = pendentes.filter((p) => p.vence <= d).sort((a, b) => b.taxaMes - a.taxaMes || a.vence.localeCompare(b.vence) || a.valor - b.valor)
    for (const p of devidos) {
      const atraso = Math.max(0, diasEntre(p.vence, d))
      const custo = custoDoAtraso(p.valor, atraso, p.taxaMes, p.multa)
      const total = p.valor + custo
      // Guarda para o que vence antes do próximo dinheiro e cobra mais caro que esta: pagar esta agora faria a cara atrasar.
      const reservar = pendentes
        .filter((x) => x.vence > d && (!proxEntrada || x.vence < proxEntrada) && x.taxaMes > p.taxaMes)
        .reduce((s, x) => s + x.valor, 0)
      if (caixa - total < reservar - 0.005 || caixa - total < -0.005) continue
      caixa -= total
      pendentes.splice(pendentes.indexOf(p), 1)
      pagamentos.push({
        descricao: p.descricao, valor: p.valor, vence: p.vence, origem: p.origem, pagarEm: d, atraso, custo, taxaMes: p.taxaMes,
        multa: p.multa, estimada: p.estimada, fonte: fonte?.descricao ?? null, fonteData: fonte?.data ?? null,
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
    }
  })
  const atrasados = pagamentos.filter((p) => p.atraso > 0)
  const dicas: DicaDoPlano[] = []
  const semSaldo = comSaldo ? '' : ` ${tx('(Sem o saldo de hoje informado, contei só o dinheiro que ainda vai entrar.)')}`

  // 1. Não dá para pagar tudo de uma vez: qual primeiro e quanto o outro vai custar depois
  const passouNaFrente = (p: PagamentoPlanejado, x: PagamentoPlanejado) => x !== p && x.vence <= p.pagarEm! && x.pagarEm! > p.pagarEm! && x.taxaMes < p.taxaMes
  const escolha = pagamentos.find((p) => atrasados.some((x) => passouNaFrente(p, x)))
  if (escolha) {
    const depois = atrasados.find((x) => passouNaFrente(escolha, x))!
    dicas.push({
      id: `escolha:${escolha.descricao}`, icone: 'acordo', tom: 'medio', data: escolha.pagarEm!,
      titulo: tx('Pague {0} primeiro e deixe {1} para {2}.', escolha.descricao, depois.descricao, fmtDataCurta(depois.pagarEm!)),
      porque: [
        tx('Em {0} o dinheiro não dá para os dois. {1} cobra mais caro pelo atraso ({2}% ao mês), então vai primeiro.', fmtDataCurta(escolha.pagarEm!), escolha.descricao, fmtTaxa(escolha.taxaMes)),
        depois.atraso === 1
          ? tx('{0} atrasa 1 dia e, quando você pagar, vai estar em cerca de {1}, {2} a mais.', depois.descricao, fmtValor(depois.valor + depois.custo), fmtValor(depois.custo))
          : tx('{0} atrasa {1} dias e, quando você pagar, vai estar em cerca de {2}, {3} a mais.', depois.descricao, depois.atraso, fmtValor(depois.valor + depois.custo), fmtValor(depois.custo)),
        depois.estimada ? tx('Os juros de {0} são uma estimativa ({1}% ao mês mais 2% de multa).', depois.descricao, fmtTaxa(depois.taxaMes)) : '',
      ].filter(Boolean).join(' '),
    })
  }

  // 2. O que vence antes de o dinheiro chegar: em que dia dá para pagar e quanto custa
  const jaDito = (p: PagamentoPlanejado) => dicas.some((d) => d.id.endsWith(`:${p.descricao}`)) || (escolha && passouNaFrente(escolha, p))
  const pior = [...atrasados].filter((p) => p !== escolha && !jaDito(p)).sort((a, b) => b.custo - a.custo || b.atraso - a.atraso)[0]
  if (pior) {
    dicas.push({
      id: `pagar-em:${pior.descricao}`, icone: 'relogio', tom: 'medio', data: pior.pagarEm!,
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
  if (semDinheiro.length) {
    const total = centavos(semDinheiro.reduce((s, p) => s + p.valor, 0))
    dicas.push({
      id: 'sem-dinheiro', icone: 'escudo', tom: 'ruim', data: semDinheiro[0].vence < e.hoje ? e.hoje : semDinheiro[0].vence,
      titulo: semDinheiro.length === 1 ? tx('Falta dinheiro para {0}.', semDinheiro[0].descricao) : tx('Falta dinheiro para {0} compromissos.', semDinheiro.length),
      porque: tx('Com o que está lançado para entrar, {0} ficam sem pagar até o fim do mês que vem. Negocie a data agora: antes de vencer, o credor costuma aceitar sem multa.', fmtValor(total)) + semSaldo,
    })
  }

  // 4. Dívida que corre juros todo dia: dá para quitar (ou adiantar) com a sobra de alguma entrada?
  for (const ab of [...e.abertas].filter((x) => x.juros > 0 && x.saldo > 0).sort((a, b) => b.juros - a.juros).slice(0, 1)) {
    // a sobra de uma entrada só é livre se o caixa não for preciso depois (o menor caixa daí em diante)
    const livre = sobras
      .map((s) => ({ ...s, livre: Math.min(s.sobra, ...caixaNoDia.filter((x) => x.data >= s.data).map((x) => x.caixa)) }))
      .find((s) => s.livre >= Math.min(ab.saldo, 50))
    if (!livre) continue
    const paga = centavos(Math.min(ab.saldo, livre.livre))
    const evita = centavos(paga * (ab.juros / 100))
    dicas.push({
      id: `adiantar-aberta:${ab.nome}`, icone: 'cofre', tom: 'bom', data: livre.data,
      titulo: paga >= ab.saldo - 0.005
        ? tx('Dá para quitar {0} em {1}.', ab.nome, fmtDataCurta(livre.data))
        : tx('Dá para adiantar {0} de {1} em {2}.', fmtValor(paga), ab.nome, fmtDataCurta(livre.data)),
      porque: tx('{0} cobra {1}% ao mês, e os juros correm todo dia. Quando entrar {2} e as contas forem pagas, sobram {3}; usando {4} para pagar essa dívida, você evita cerca de {5} de juros por mês.',
        ab.nome, fmtTaxa(ab.juros), livre.fonte, fmtValor(livre.livre), fmtValor(paga), fmtValor(evita)),
    })
  }

  return {
    pagamentos, semDinheiro, dicas, comSaldo, fontes,
    atrasos: atrasados.length + semDinheiro.length,
    custoTotal: centavos([...atrasados, ...semDinheiro].reduce((s, p) => s + p.custo, 0)),
    hoje: gastoDeHoje(e),
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
