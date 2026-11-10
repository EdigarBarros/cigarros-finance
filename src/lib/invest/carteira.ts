/**
 * O motor da carteira: refaz, a partir das operações, tudo o que a tela mostra de cada investimento e da carteira inteira.
 *
 * É puro e determinístico (sem React, sem banco, a data entra por `hoje`): mesmas operações, mesmos números. Nenhum número
 * daqui vem de inteligência artificial nem é guardado: mudou, corrigiu ou apagou uma operação, tudo é refeito.
 *
 * Como cada coisa é calculada:
 *  - **Quantidade e custo**: pelas operações, em ordem de data, com **custo médio** (o padrão no Brasil). Vender parte
 *    baixa o custo na mesma proporção; a diferença para o que entrou no bolso é o resultado **realizado**.
 *  - **Valor de hoje**: ações, FIIs e ETFs = quantidade × o último preço que alguém informou (um preço digitado, importado
 *    ou o da última compra/venda), sempre com a fonte e a data. Títulos acompanhados pelo valor = o último saldo informado
 *    mais o que entrou e saiu depois; quando o título tem taxa (prefixado, % do CDI, IPCA+), o app **estima** o rendimento
 *    pela taxa contratada com os índices oficiais (lib/invest/indices.ts) e diz que é estimativa, bruta de imposto. Sem
 *    nada disso, mostra o que foi aplicado e avisa que falta atualizar. Nunca inventa preço.
 *  - **Resultado** = o que vale hoje − custo do que ainda tem + realizado + proventos − taxas pagas por fora.
 *  - **Rentabilidade** não é crescimento do saldo: aporte não é ganho. A conta é ponderada pelo tempo (`linhaDoTempo`): a
 *    cada dia com entrada ou saída de dinheiro, mede quanto a carteira rendeu desde a última vez, descontando o que entrou.
 *    Quem tinha 10 mil e aplicou mais 5 mil tem rentabilidade zero, não 50%. Há também a taxa ponderada pelo dinheiro
 *    (`taxaInterna`), que diz quanto rendeu o dinheiro da pessoa considerando quando ela pôs e tirou.
 *  - **Moedas**: cada ativo fica na moeda dele. O custo na moeda principal usa a cotação de cada operação; o valor de hoje
 *    usa a cotação de hoje. A diferença entre os dois que vem só do câmbio aparece separada (`cambial`).
 */
import type { Taxas } from '../moedas'
import { diasEntre, fator, fimDoMesDe, somarDias, type Indices } from './indices'
import { infoClasse, moedaDoAtivo, type Ativo, type Classe, type Liquidez, type Operacao, type PrecoInvest } from './tipos'

/** Quantidade menor que isso é zero (sobra de arredondamento). */
const EPS = 1e-7
const centavos = (n: number) => Math.round(n * 100) / 100

/** Preço de cota com mais dias que isso é "antigo". */
export const DIAS_PRECO_ANTIGO = 7
/** Saldo informado de um título com mais dias que isso é "antigo". */
export const DIAS_SALDO_ANTIGO = 45

export type NaturezaDoValor =
  /** Quantidade × preço conhecido. */
  | 'cotado'
  /** Saldo que a pessoa (ou um arquivo) informou. */
  | 'informado'
  /** Estimado pela taxa contratada e os índices oficiais (bruto). */
  | 'estimado'
  /** Sem preço nem taxa: vale o que foi aplicado, até alguém atualizar. */
  | 'custo'
  | 'zerado'

export interface Avaliacao {
  /** Quanto a posição vale, na moeda do ativo. */
  valor: number
  natureza: NaturezaDoValor
  /** Quem disse: 'manual', 'importacao', 'operacao' (o preço da última compra ou venda), 'indice' (estimativa pela taxa)... */
  fonte: string
  /** O dia a que a informação se refere (null quando não há nenhuma). */
  referencia: string | null
  /** Há quantos dias é essa informação. */
  dias: number
  situacao: 'em-dia' | 'antigo' | 'sem-preco'
  /** Preço de 1 cota, quando o ativo é acompanhado por quantidade. */
  preco?: number
}

export type AlertaDaPosicao =
  /** Uma venda maior que a quantidade que havia: falta alguma compra ou há operação repetida. */
  | 'venda-maior'
  /** O título já venceu e continua na carteira: falta registrar o vencimento. */
  | 'vencido'

export interface Posicao {
  ativo: Ativo
  moeda: string
  /** Quanto vale 1 da moeda do ativo na principal, hoje (null: sem cotação; os totais na moeda principal ficam de fora). */
  taxa: number | null
  quantidade: number
  /** Custo de aquisição do que ainda está na carteira. */
  custo: number
  custoMedio: number | null
  /** Tudo o que já foi posto nesse ativo (compras e aplicações, com as taxas). */
  aplicado: number
  /** Tudo o que já voltou em vendas, resgates e amortizações (líquido de taxas e impostos). */
  retirado: number
  /** Proventos e juros recebidos em dinheiro (líquidos). */
  proventos: number
  /** Ganho ou perda do que já foi vendido ou resgatado. */
  realizado: number
  custosPagos: number
  impostosPagos: number
  avaliacao: Avaliacao
  valor: number
  /** Ganho ou perda do que ainda está na carteira. */
  naoRealizado: number
  resultado: number
  // ---- na moeda principal ----
  valorP: number
  custoP: number
  aplicadoP: number
  retiradoP: number
  proventosP: number
  resultadoP: number
  /** A parte do resultado que veio só da variação do câmbio (0 para ativos na moeda principal). */
  cambialP: number
  /** Fatia da carteira (0 a 1), pelo valor na moeda principal. */
  participacao: number
  /** Ainda há algo nesse ativo. */
  aberta: boolean
  alertas: AlertaDaPosicao[]
  primeiraOperacao: string | null
  ultimaOperacao: string | null
  operacoes: number
}

// ---------- reprodução das operações de um ativo ----------

interface Estado {
  qtd: number
  custo: number
  custoP: number
  aplicado: number
  aplicadoP: number
  retirado: number
  retiradoP: number
  proventos: number
  proventosP: number
  realizado: number
  realizadoP: number
  custos: number
  impostos: number
  /** Taxas e impostos pagos por fora (não saíram do saldo do ativo). */
  porFora: number
  porForaP: number
  /** Ativo por valor: o saldo e o dia até onde ele está atualizado. */
  base: number
  dataBase: string | null
  /** O saldo veio de uma estimativa pela taxa (e até que dia os índices cobriram). */
  estimado: boolean
  estimadoAte: string | null
  informado: { data: string; fonte: string } | null
  preco: { valor: number; data: string; fonte: string } | null
  alertas: Set<AlertaDaPosicao>
  primeira: string | null
  ultima: string | null
  n: number
}

const estadoVazio = (): Estado => ({
  qtd: 0, custo: 0, custoP: 0, aplicado: 0, aplicadoP: 0, retirado: 0, retiradoP: 0, proventos: 0, proventosP: 0, realizado: 0, realizadoP: 0,
  custos: 0, impostos: 0, porFora: 0, porForaP: 0, base: 0, dataBase: null, estimado: false, estimadoAte: null, informado: null, preco: null,
  alertas: new Set(), primeira: null, ultima: null, n: 0,
})

/** O que uma operação moveu de dinheiro, na moeda do ativo: `aporte` entra na carteira (negativo sai), `renda` é ganho pago em dinheiro. */
interface Fluxo { aporte: number; renda: number }

type Evento = { data: string; ordem: number; op?: Operacao; preco?: PrecoInvest }

/** Na mesma data: primeiro o que aumenta a posição, depois o que diminui, e por fim o preço de fechamento do dia. */
const ORDEM_DO_TIPO: Record<Operacao['tipo'], number> = {
  ajuste: 0, desdobramento: 1, grupamento: 1, bonificacao: 2, compra: 3, transferencia: 4, provento: 5, juros: 5, amortizacao: 6,
  taxa: 7, imposto: 7, venda: 8, vencimento: 9,
}

function eventosDe(ops: Operacao[], precos: PrecoInvest[]): Evento[] {
  const es: Evento[] = [
    ...ops.map((op) => ({ data: op.data, ordem: ORDEM_DO_TIPO[op.tipo], op })),
    ...precos.map((preco) => ({ data: preco.data, ordem: 20, preco })),
  ]
  return es.sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : a.ordem - b.ordem || ((a.op?.created_at ?? '') < (b.op?.created_at ?? '') ? -1 : 1)))
}

/** Reproduz as operações de um ativo em ordem. `ate(D)` aplica tudo até o fim do dia D (os dias só andam para a frente). */
class Reprodutor {
  readonly e = estadoVazio()
  private i = 0
  private readonly eventos: Evento[]
  /** Os fluxos de cada dia já aplicado (para a rentabilidade). */
  fluxos = new Map<string, Fluxo>()
  readonly ativo: Ativo
  private readonly taxaHoje: number
  private readonly indices?: Indices
  constructor(ativo: Ativo, ops: Operacao[], precos: PrecoInvest[], taxaHoje: number, indices?: Indices) {
    this.ativo = ativo
    this.taxaHoje = taxaHoje
    this.indices = indices
    this.eventos = eventosDe(ops, precos)
  }

  /** Os dias em que este ativo teve operação ou preço. */
  datas(): string[] { return this.eventos.map((x) => x.data) }

  ate(dia: string) {
    while (this.i < this.eventos.length && this.eventos[this.i].data <= dia) {
      const ev = this.eventos[this.i++]
      if (ev.op) this.aplicar(ev.op)
      else if (ev.preco) this.precificar(ev.preco)
    }
    if (this.ativo.por_valor) this.render(dia)
    return this.e
  }

  /** Ativo por valor: leva o saldo até `dia` pela taxa contratada (quando há taxa e índice). */
  private render(dia: string) {
    const { e, ativo: a } = this
    if (!e.dataBase || dia <= e.dataBase) { e.dataBase ??= dia; return }
    // depois do vencimento o título não rende mais
    const fim = a.vencimento && dia > a.vencimento ? a.vencimento : dia
    if (e.base > EPS && a.indexador && a.taxa !== null && fim > e.dataBase) {
      const f = fator(a.indexador, a.taxa, e.dataBase, fim, this.indices)
      if (f) {
        e.base *= f.fator
        e.estimado = true
        // os índices não chegaram até aqui: guarda o primeiro dia sem cobertura (só um saldo informado limpa isso)
        if (!f.completo) e.estimadoAte ??= f.ate
      }
    }
    e.dataBase = dia
  }

  private fluxo(data: string, aporte: number, renda: number) {
    const f = this.fluxos.get(data) ?? { aporte: 0, renda: 0 }
    f.aporte += aporte
    f.renda += renda
    this.fluxos.set(data, f)
  }

  private precificar(p: PrecoInvest) {
    const { e, ativo: a } = this
    if (a.por_valor) {
      this.render(p.data)
      // um preço de cota num ativo por valor não diz o saldo: fica de fora
      if (p.natureza !== 'saldo') return
      e.base = p.valor
      e.dataBase = p.data
      e.estimado = false
      e.estimadoAte = null
      e.informado = { data: p.data, fonte: p.fonte }
    } else {
      const valor = p.natureza === 'saldo' ? (e.qtd > EPS ? p.valor / e.qtd : null) : p.valor
      if (valor !== null) e.preco = { valor, data: p.data, fonte: p.fonte }
    }
  }

  private aplicar(op: Operacao) {
    const { e, ativo: a } = this
    // cotação do dia da operação; sem ela, a de hoje (o efeito do câmbio fica zerado nessa operação, em vez de inventado)
    const t = op.cotacao ?? this.taxaHoje
    const q = Math.abs(op.quantidade ?? 0)
    const valor = op.valor || 0
    const liquido = valor - op.custos - op.impostos
    e.primeira ??= op.data
    e.ultima = op.data
    e.n++
    e.custos += op.custos
    e.impostos += op.impostos
    if (a.por_valor) this.render(op.data)
    const precoDaOp = () => {
      const p = op.preco ?? (q > EPS && valor > 0 ? valor / q : null)
      if (p !== null && p > 0 && !a.por_valor) e.preco = { valor: p, data: op.data, fonte: 'operacao' }
    }
    /** Baixa `fracao` do custo (e do custo na moeda principal) e devolve o que foi baixado. */
    const baixar = (fracao: number) => {
      const f = Math.min(1, Math.max(0, fracao))
      const [c, cp] = [e.custo * f, e.custoP * f]
      e.custo -= c
      e.custoP -= cp
      return [c, cp] as const
    }
    switch (op.tipo) {
      case 'compra': {
        const total = valor + op.custos
        e.custo += total; e.custoP += total * t
        e.aplicado += total; e.aplicadoP += total * t
        if (a.por_valor) e.base += valor
        else e.qtd += q
        precoDaOp()
        this.fluxo(op.data, total, 0)
        break
      }
      case 'venda':
      case 'vencimento': {
        let fracao: number
        if (a.por_valor) {
          // resgatou mais do que o app sabia que havia: o rendimento não estava registrado, e o resgate leva tudo
          fracao = op.tipo === 'vencimento' || e.base <= EPS ? 1 : Math.min(1, valor / e.base)
          e.base = op.tipo === 'vencimento' ? 0 : Math.max(0, e.base - valor)
        } else {
          let vendida = op.tipo === 'vencimento' ? e.qtd : q
          if (vendida > e.qtd + EPS) { e.alertas.add('venda-maior'); vendida = e.qtd }
          fracao = e.qtd > EPS ? vendida / e.qtd : 0
          e.qtd = Math.max(0, e.qtd - vendida)
          if (e.qtd <= EPS) { e.qtd = 0; fracao = 1 }
          precoDaOp()
        }
        const [c, cp] = baixar(fracao)
        e.realizado += liquido - c
        e.realizadoP += liquido * t - cp
        e.retirado += liquido; e.retiradoP += liquido * t
        this.fluxo(op.data, -liquido, 0)
        break
      }
      case 'provento':
      case 'juros':
        e.proventos += liquido; e.proventosP += liquido * t
        // juro pago em dinheiro sai do que tinha rendido (nunca do que foi aplicado)
        if (a.por_valor) e.base -= Math.min(valor, Math.max(0, e.base - e.custo))
        this.fluxo(op.data, 0, liquido)
        break
      case 'amortizacao': {
        // devolução de capital: baixa o custo; o que passar do custo é ganho
        const baixa = Math.min(e.custo, valor)
        const fracao = e.custo > EPS ? baixa / e.custo : 0
        const [, cp] = baixar(fracao)
        e.realizado += valor - baixa
        e.realizadoP += valor * t - cp
        e.retirado += valor; e.retiradoP += valor * t
        if (a.por_valor) e.base = Math.max(0, e.base - valor)
        // a cota passa a valer menos na mesma medida do que foi devolvido: o preço conhecido acompanha (senão a devolução pareceria ganho)
        else if (e.preco && e.qtd > EPS) e.preco = { ...e.preco, valor: Math.max(0, e.preco.valor - valor / e.qtd) }
        this.fluxo(op.data, -valor, 0)
        break
      }
      case 'taxa':
      case 'imposto':
        if (op.tipo === 'taxa') e.custos += valor
        else e.impostos += valor
        if (a.por_valor) e.base = Math.max(0, e.base - valor) // saiu do próprio saldo (come-cotas, taxa de custódia)
        else { e.porFora += valor; e.porForaP += valor * t; this.fluxo(op.data, 0, -valor) }
        break
      case 'desdobramento':
      case 'grupamento': {
        const f = op.fator ?? 1
        if (!a.por_valor && f > 0) {
          e.qtd *= f
          // o preço conhecido era da cota de antes: acompanha a mudança, para o valor não dar um salto que não existiu
          if (e.preco) e.preco = { ...e.preco, valor: e.preco.valor / f }
        }
        break
      }
      case 'bonificacao':
        if (!a.por_valor) e.qtd += q
        e.custo += valor; e.custoP += valor * t
        this.fluxo(op.data, valor, 0)
        break
      case 'ajuste': {
        // correção ou posição inicial: soma (ou tira) quantidade e custo; nunca deixa negativo
        const dq = op.quantidade ?? 0
        if (!a.por_valor) e.qtd = Math.max(0, e.qtd + dq)
        else e.base = Math.max(0, e.base + valor)
        e.custo = Math.max(0, e.custo + valor)
        e.custoP = Math.max(0, e.custoP + valor * t)
        if (valor > 0) { e.aplicado += valor; e.aplicadoP += valor * t }
        precoDaOp()
        this.fluxo(op.data, valor, 0)
        break
      }
      case 'transferencia':
        break
    }
  }

  /** Quanto a posição vale no fim do dia `dia` (já aplicado com `ate`). */
  avaliar(dia: string): Avaliacao {
    const { e, ativo: a } = this
    const idade = (ref: string | null) => (ref ? Math.max(0, diasEntre(ref, dia)) : 0)
    if (a.por_valor) {
      if (e.base <= 0.005) return { valor: 0, natureza: 'zerado', fonte: '', referencia: e.ultima, dias: 0, situacao: 'em-dia' }
      if (e.estimado) {
        const ref = e.estimadoAte ?? dia
        return { valor: centavos(e.base), natureza: 'estimado', fonte: 'indice', referencia: ref, dias: idade(ref), situacao: e.estimadoAte ? 'antigo' : 'em-dia' }
      }
      if (e.informado) {
        const dias = idade(e.informado.data)
        return { valor: centavos(e.base), natureza: 'informado', fonte: e.informado.fonte, referencia: e.informado.data, dias, situacao: dias > DIAS_SALDO_ANTIGO ? 'antigo' : 'em-dia' }
      }
      return { valor: centavos(e.base), natureza: 'custo', fonte: 'operacao', referencia: e.ultima, dias: idade(e.ultima), situacao: 'sem-preco' }
    }
    if (e.qtd <= EPS) return { valor: 0, natureza: 'zerado', fonte: '', referencia: e.ultima, dias: 0, situacao: 'em-dia' }
    if (e.preco) {
      const dias = idade(e.preco.data)
      return { valor: centavos(e.qtd * e.preco.valor), natureza: 'cotado', fonte: e.preco.fonte, referencia: e.preco.data, dias, situacao: dias > DIAS_PRECO_ANTIGO ? 'antigo' : 'em-dia', preco: e.preco.valor }
    }
    return { valor: centavos(e.custo), natureza: 'custo', fonte: 'operacao', referencia: e.ultima, dias: idade(e.ultima), situacao: 'sem-preco' }
  }
}

// ---------- a carteira ----------

export interface EntradaCarteira {
  ativos: Ativo[]
  operacoes: Operacao[]
  precos: PrecoInvest[]
  /** AAAA-MM-DD */
  hoje: string
  /** Moeda principal da pessoa. */
  moeda: string
  /** Quanto vale 1 de cada moeda na principal, hoje. */
  taxas: Taxas
  indices?: Indices
}

const agrupar = <T, K>(xs: T[], chave: (x: T) => K) => {
  const m = new Map<K, T[]>()
  for (const x of xs) {
    const k = chave(x)
    const g = m.get(k)
    if (g) g.push(x)
    else m.set(k, [x])
  }
  return m
}

function reprodutores(e: EntradaCarteira, so?: Set<string>) {
  const ops = agrupar(e.operacoes.filter((o) => o.data <= e.hoje), (o) => o.ativo_id)
  const precos = agrupar(e.precos.filter((p) => p.data <= e.hoje), (p) => p.ativo_id)
  return e.ativos.filter((a) => !so || so.has(a.id)).map((a) => {
    const moeda = moedaDoAtivo(a, e.moeda)
    const taxa = moeda === e.moeda ? 1 : e.taxas[moeda] ?? null
    return { r: new Reprodutor(a, ops.get(a.id) ?? [], precos.get(a.id) ?? [], taxa ?? 1, e.indices), moeda, taxa }
  })
}

/** A posição de cada ativo hoje (inclusive os já encerrados, que guardam o resultado realizado). */
export function posicoes(e: EntradaCarteira): Posicao[] {
  const lista = reprodutores(e).map(({ r, moeda, taxa }) => {
    const s = r.ate(e.hoje)
    const av = r.avaliar(e.hoje)
    const t = taxa ?? 0
    const aberta = av.valor > 0.005
    const custo = aberta ? s.custo : 0
    const alertas = new Set(s.alertas)
    if (aberta && r.ativo.vencimento && r.ativo.vencimento < e.hoje) alertas.add('vencido')
    const naoRealizado = aberta ? av.valor - custo : 0
    const valorP = centavos(av.valor * t)
    const custoP = aberta ? s.custoP : 0
    const p: Posicao = {
      ativo: r.ativo, moeda, taxa,
      quantidade: r.ativo.por_valor ? 0 : Math.round(s.qtd * 1e8) / 1e8,
      custo: centavos(custo), custoMedio: !r.ativo.por_valor && s.qtd > EPS ? s.custo / s.qtd : null,
      aplicado: centavos(s.aplicado), retirado: centavos(s.retirado), proventos: centavos(s.proventos), realizado: centavos(s.realizado),
      custosPagos: centavos(s.custos), impostosPagos: centavos(s.impostos),
      avaliacao: av, valor: av.valor, naoRealizado: centavos(naoRealizado),
      resultado: centavos(naoRealizado + s.realizado + s.proventos - s.porFora),
      valorP, custoP: centavos(custoP), aplicadoP: centavos(s.aplicadoP), retiradoP: centavos(s.retiradoP), proventosP: centavos(s.proventosP),
      resultadoP: centavos(valorP - custoP + s.realizadoP + s.proventosP - s.porForaP),
      // o que o custo de hoje valeria na cotação de hoje menos o que ele custou na cotação de cada compra
      cambialP: aberta && moeda !== e.moeda ? centavos(custo * t - custoP) : 0,
      participacao: 0, aberta, alertas: [...alertas], primeiraOperacao: s.primeira, ultimaOperacao: s.ultima, operacoes: s.n,
    }
    return p
  })
  const total = lista.reduce((a, p) => a + p.valorP, 0)
  for (const p of lista) p.participacao = total > 0 ? p.valorP / total : 0
  return lista
}

// ---------- a linha do tempo: valor, aportes e rentabilidade ----------

export interface PontoDaLinha {
  data: string
  /** Quanto a carteira valia no fim do dia, na moeda principal (cotação de hoje: a linha mostra o ativo, não o câmbio). */
  valor: number
  /** Dinheiro que entrou na carteira no dia (negativo: saiu). */
  aporte: number
  /** Proventos e juros pagos no dia, menos taxas pagas por fora. */
  renda: number
  /** Soma dos aportes líquidos até o dia. */
  aportado: number
  /** Índice de rentabilidade ponderada pelo tempo (1 no primeiro dia): 1,12 = rendeu 12% desde o começo. */
  indice: number
}

/**
 * A carteira (ou só alguns ativos) dia a dia nos dias que importam: todo dia com operação ou preço novo, todo fim de mês, os
 * `marcos` pedidos e hoje. A rentabilidade de um dia para o outro desconta o dinheiro que entrou e soma o que foi pago:
 *   r = (valor de hoje − aporte de hoje + renda de hoje) / valor do ponto anterior − 1
 * O dia em que o dinheiro entra não rende por causa dele: é isso que separa aporte de rentabilidade.
 */
export function linhaDoTempo(e: EntradaCarteira, opcoes: { ativos?: Set<string>; marcos?: string[] } = {}): PontoDaLinha[] {
  const rs = reprodutores(e, opcoes.ativos).filter((x) => x.taxa !== null)
  const dias = new Set<string>()
  for (const { r } of rs) for (const d of r.datas()) dias.add(d)
  if (!dias.size) return []
  const primeiro = [...dias].sort()[0]
  for (let d = fimDoMesDe(primeiro); d < e.hoje; d = fimDoMesDe(somarDias(d, 1))) dias.add(d)
  for (const m of opcoes.marcos ?? []) if (m > primeiro && m < e.hoje) dias.add(m)
  dias.add(e.hoje)
  const pontos: PontoDaLinha[] = []
  let aportado = 0
  let indice = 1
  let anterior = 0
  for (const data of [...dias].sort()) {
    let valor = 0
    let aporte = 0
    let renda = 0
    for (const { r, taxa } of rs) {
      r.ate(data)
      valor += r.avaliar(data).valor * taxa!
      const f = r.fluxos.get(data)
      if (f) { aporte += f.aporte * taxa!; renda += f.renda * taxa! }
    }
    if (anterior > 0.005) indice *= (valor - aporte + renda) / anterior
    aportado += aporte
    anterior = valor
    pontos.push({ data, valor: centavos(valor), aporte: centavos(aporte), renda: centavos(renda), aportado: centavos(aportado), indice })
  }
  return pontos
}

/** O ponto da linha no fim do dia `data` (o último até lá), ou null se a carteira ainda não existia. */
export function pontoEm(linha: PontoDaLinha[], data: string): PontoDaLinha | null {
  let achado: PontoDaLinha | null = null
  for (const p of linha) {
    if (p.data > data) break
    achado = p
  }
  return achado
}

export interface Desempenho {
  de: string
  ate: string
  /** Valor no começo e no fim do período. */
  inicio: number
  fim: number
  /** Dinheiro que entrou (menos o que saiu) no período. */
  aportes: number
  /** Proventos e juros recebidos no período. */
  renda: number
  /** Ganho em dinheiro: o que a carteira cresceu sem contar os aportes. */
  ganho: number
  /** Rentabilidade ponderada pelo tempo no período (0,124 = 12,4%); null sem base para medir. */
  rentabilidade: number | null
  /** Taxa ponderada pelo dinheiro no período (não anualizada); null quando não dá para calcular. */
  taxaInterna: number | null
}

/** Como a carteira foi de `de` (fim do dia) até o fim da linha. Com `de` antes do começo, vale desde a primeira operação. */
export function desempenho(linha: PontoDaLinha[], de: string | null): Desempenho | null {
  if (!linha.length) return null
  const ultimo = linha[linha.length - 1]
  const base = de ? pontoEm(linha, de) : null
  const desde = base?.data ?? linha[0].data
  const depois = linha.filter((p) => (base ? p.data > base.data : true))
  const aportes = depois.reduce((a, p) => a + p.aporte, 0)
  const renda = depois.reduce((a, p) => a + p.renda, 0)
  const inicio = base?.valor ?? 0
  // a rentabilidade começa a contar no primeiro ponto em que já havia dinheiro aplicado
  const indiceBase = base ? base.indice : 1
  const fluxos: [string, number][] = []
  if (inicio > 0) fluxos.push([desde, -inicio])
  for (const p of depois) if (p.aporte || p.renda) fluxos.push([p.data, p.renda - p.aporte])
  fluxos.push([ultimo.data, ultimo.valor])
  const anual = taxaInterna(fluxos)
  const dias = diasEntre(desde, ultimo.data)
  return {
    de: desde, ate: ultimo.data, inicio, fim: ultimo.valor, aportes: centavos(aportes), renda: centavos(renda),
    ganho: centavos(ultimo.valor - inicio - aportes + renda),
    rentabilidade: linha.some((p) => p.valor > 0.005 && p.data < ultimo.data) && indiceBase > 0 ? ultimo.indice / indiceBase - 1 : null,
    taxaInterna: anual === null || dias <= 0 ? null : Math.pow(1 + anual, dias / 365) - 1,
  }
}

/**
 * Taxa interna de retorno ao ano de uma lista de [dia, dinheiro] (negativo: saiu do bolso; positivo: voltou ou vale hoje).
 * É a taxa ponderada pelo dinheiro: pesa mais o período em que havia mais dinheiro aplicado. null quando não há solução
 * (tudo do mesmo sinal, tudo no mesmo dia).
 */
export function taxaInterna(fluxos: [string, number][]): number | null {
  const fs = fluxos.filter(([, v]) => Math.abs(v) > 0.005)
  if (fs.length < 2 || !fs.some(([, v]) => v > 0) || !fs.some(([, v]) => v < 0)) return null
  const t0 = fs.reduce((a, [d]) => (d < a ? d : a), fs[0][0])
  const anos = fs.map(([d, v]) => [diasEntre(t0, d) / 365, v] as const)
  if (!anos.some(([t]) => t > 0)) return null
  const vpl = (r: number) => anos.reduce((a, [t, v]) => a + v / Math.pow(1 + r, t), 0)
  // bisseção: o valor presente cai quando a taxa sobe (o dinheiro sai antes de voltar)
  let [lo, hi] = [-0.9999, 100]
  let [flo, fhi] = [vpl(lo), vpl(hi)]
  if (!Number.isFinite(flo) || !Number.isFinite(fhi) || flo * fhi > 0) return null
  for (let i = 0; i < 200; i++) {
    const m = (lo + hi) / 2
    const fm = vpl(m)
    if (Math.abs(fm) < 1e-7 || hi - lo < 1e-10) return m
    if (fm * flo > 0) { lo = m; flo = fm } else { hi = m; fhi = fm }
  }
  return (lo + hi) / 2
}

// ---------- o retrato da carteira ----------

export interface Fatia { id: string; rotulo: string; valor: number; fracao: number; cor?: string }
export type FaixaDeLiquidez = 'diaria' | 'ate30' | 'ate365' | 'longo' | 'sem-data'

export interface Vencimento { ativo: Ativo; data: string; dias: number; valor: number }
export interface ProventoDoMes { mes: string; valor: number }
export interface OperacaoFutura { op: Operacao; ativo: Ativo; valorP: number }

export interface Carteira {
  hoje: string
  moeda: string
  posicoes: Posicao[]
  /** As que ainda têm algo, da maior para a menor. */
  abertas: Posicao[]
  /** Quanto tudo vale hoje, na moeda principal. */
  valor: number
  /** Custo de aquisição do que ainda está na carteira. */
  custo: number
  /** Tudo o que já foi posto (compras e aplicações). */
  aplicado: number
  /** O que foi posto menos o que voltou em vendas, resgates e amortizações: o capital líquido aportado. */
  aportadoLiquido: number
  proventos: number
  realizado: number
  naoRealizado: number
  /** Resultado de tudo, desde o começo: não realizado + realizado + proventos − taxas por fora. */
  resultado: number
  /** A parte do resultado que é só variação de câmbio. */
  cambial: number
  porClasse: Fatia[]
  porInstituicao: Fatia[]
  porMoeda: Fatia[]
  porEmissor: Fatia[]
  /** Só da renda variável com setor informado. */
  porSetor: Fatia[]
  porLiquidez: Fatia[]
  /** Fatia da carteira em renda variável (0 a 1). */
  rendaVariavel: number
  /** Títulos com vencimento a partir de hoje, do mais próximo ao mais distante. */
  vencimentos: Vencimento[]
  /** Proventos e juros recebidos em cada um dos últimos 24 meses (inclusive os zerados), do mais antigo ao mais novo. */
  proventosPorMes: ProventoDoMes[]
  /** Operações com data futura (proventos anunciados, por exemplo): ainda não contam, aparecem como previstas. */
  futuras: OperacaoFutura[]
  /** Quanto da carteira (0 a 1) está com valor em dia: é a confiança dos números de hoje. */
  emDia: number
  /** Ativos em moeda sem cotação: ficam fora dos totais. */
  semCotacao: Posicao[]
  primeiraOperacao: string | null
}

const fatias = (grupos: Map<string, { rotulo: string; valor: number; cor?: string }>, total: number): Fatia[] =>
  [...grupos].map(([id, g]) => ({ id, rotulo: g.rotulo, valor: centavos(g.valor), fracao: total > 0 ? g.valor / total : 0, cor: g.cor }))
    .filter((f) => f.valor > 0.005).sort((a, b) => b.valor - a.valor)

/** Em quanto tempo o dinheiro de um ativo pode estar na conta. */
export function faixaDeLiquidez(a: Ativo, hoje: string): FaixaDeLiquidez {
  // o que se vende na bolsa cai na conta em dias; fundos e o resto dependem do que a pessoa informou
  const padrao: Liquidez | null = a.liquidez ?? (a.por_valor ? null : 'diaria')
  if (padrao === 'diaria') return 'diaria'
  const dias = padrao === 'prazo' ? a.liquidez_dias : a.vencimento ? Math.max(0, diasEntre(hoje, a.vencimento)) : null
  if (dias === null) return 'sem-data'
  return dias <= 30 ? 'ate30' : dias <= 365 ? 'ate365' : 'longo'
}

export const CLASSES_NA_ORDEM: Classe[] = ['renda_fixa', 'acao', 'fii', 'etf', 'fundo', 'internacional', 'previdencia', 'cripto', 'outro']

export function carteira(e: EntradaCarteira, nomes: { semInstituicao: string; liquidez: Record<FaixaDeLiquidez, string> }): Carteira {
  const todas = posicoes(e)
  const comCotacao = todas.filter((p) => p.taxa !== null)
  const abertas = comCotacao.filter((p) => p.aberta).sort((a, b) => b.valorP - a.valorP)
  const soma = (f: (p: Posicao) => number, ps = comCotacao) => centavos(ps.reduce((a, p) => a + f(p), 0))
  const valor = soma((p) => p.valorP, abertas)
  const por = (chave: (p: Posicao) => { id: string; rotulo: string; cor?: string } | null, ps = abertas) => {
    const m = new Map<string, { rotulo: string; valor: number; cor?: string }>()
    for (const p of ps) {
      const k = chave(p)
      if (!k) continue
      const g = m.get(k.id) ?? { rotulo: k.rotulo, valor: 0, cor: k.cor }
      g.valor += p.valorP
      m.set(k.id, g)
    }
    return fatias(m, ps.reduce((a, p) => a + p.valorP, 0))
  }
  const variaveis = abertas.filter((p) => infoClasse(p.ativo.classe).variavel)
  const limpo = (s: string | null) => (s ?? '').trim()
  const mesDe = (d: string) => d.slice(0, 7)
  const taxaDe = new Map(todas.map((p) => [p.ativo.id, p.taxa]))
  const ativoDe = new Map(e.ativos.map((a) => [a.id, a]))
  // proventos por mês, 24 meses até o atual
  const meses: string[] = []
  for (let i = 23, d = `${mesDe(e.hoje)}-01`; i >= 0; i--) {
    const x = new Date(`${d}T00:00:00Z`)
    x.setUTCMonth(x.getUTCMonth() - i)
    meses.push(`${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, '0')}`)
  }
  const recebido = new Map<string, number>(meses.map((m) => [m, 0]))
  const futuras: OperacaoFutura[] = []
  for (const op of e.operacoes) {
    const ativo = ativoDe.get(op.ativo_id)
    const t = taxaDe.get(op.ativo_id)
    if (!ativo || t === null || t === undefined) continue
    const liquido = (op.valor - op.custos - op.impostos) * t
    if (op.data > e.hoje) { futuras.push({ op, ativo, valorP: centavos(liquido) }); continue }
    if ((op.tipo === 'provento' || op.tipo === 'juros') && recebido.has(mesDe(op.data))) recebido.set(mesDe(op.data), recebido.get(mesDe(op.data))! + liquido)
  }
  return {
    hoje: e.hoje, moeda: e.moeda, posicoes: todas, abertas, valor,
    custo: soma((p) => p.custoP, abertas), aplicado: soma((p) => p.aplicadoP),
    aportadoLiquido: soma((p) => p.aplicadoP - p.retiradoP), proventos: soma((p) => p.proventosP),
    realizado: soma((p) => p.resultadoP - (p.aberta ? p.valorP - p.custoP : 0) - p.proventosP),
    naoRealizado: soma((p) => p.valorP - p.custoP, abertas), resultado: soma((p) => p.resultadoP), cambial: soma((p) => p.cambialP, abertas),
    porClasse: por((p) => { const c = infoClasse(p.ativo.classe); return { id: c.id, rotulo: c.nome(), cor: c.cor } })
      .sort((a, b) => CLASSES_NA_ORDEM.indexOf(a.id as Classe) - CLASSES_NA_ORDEM.indexOf(b.id as Classe)),
    porInstituicao: por((p) => { const n = limpo(p.ativo.instituicao); return { id: n.toLowerCase() || '-', rotulo: n || nomes.semInstituicao } }),
    porMoeda: por((p) => ({ id: p.moeda, rotulo: p.moeda })),
    porEmissor: por((p) => { const n = limpo(p.ativo.emissor) || (p.ativo.classe === 'renda_fixa' ? limpo(p.ativo.instituicao) : ''); return n ? { id: n.toLowerCase(), rotulo: n } : null }),
    porSetor: por((p) => { const n = limpo(p.ativo.setor); return n ? { id: n.toLowerCase(), rotulo: n } : null }, variaveis),
    porLiquidez: por((p) => { const f = faixaDeLiquidez(p.ativo, e.hoje); return { id: f, rotulo: nomes.liquidez[f] } })
      .sort((a, b) => ['diaria', 'ate30', 'ate365', 'longo', 'sem-data'].indexOf(a.id) - ['diaria', 'ate30', 'ate365', 'longo', 'sem-data'].indexOf(b.id)),
    rendaVariavel: valor > 0 ? variaveis.reduce((a, p) => a + p.valorP, 0) / valor : 0,
    vencimentos: abertas.filter((p) => p.ativo.vencimento && p.ativo.vencimento >= e.hoje)
      .map((p) => ({ ativo: p.ativo, data: p.ativo.vencimento!, dias: diasEntre(e.hoje, p.ativo.vencimento!), valor: p.valorP }))
      .sort((a, b) => a.dias - b.dias),
    proventosPorMes: meses.map((mes) => ({ mes, valor: centavos(recebido.get(mes)!) })),
    futuras: futuras.sort((a, b) => (a.op.data < b.op.data ? -1 : 1)),
    emDia: valor > 0 ? abertas.filter((p) => p.avaliacao.situacao === 'em-dia').reduce((a, p) => a + p.valorP, 0) / valor : 1,
    semCotacao: todas.filter((p) => p.taxa === null && (p.aberta || p.operacoes > 0)),
    primeiraOperacao: todas.reduce<string | null>((a, p) => (p.primeiraOperacao && (!a || p.primeiraOperacao < a) ? p.primeiraOperacao : a), null),
  }
}

/** O valor da carteira no fim de cada mês ('AAAA-MM' → valor), do primeiro mês com operação até o mês de hoje. */
export function valorPorMes(linha: PontoDaLinha[], hoje: string): Map<string, number> {
  const m = new Map<string, number>()
  if (!linha.length) return m
  for (let d = fimDoMesDe(linha[0].data); ; d = fimDoMesDe(somarDias(d, 1))) {
    const fim = d > hoje ? hoje : d
    m.set(fim.slice(0, 7), pontoEm(linha, fim)?.valor ?? 0)
    if (d >= hoje) break
  }
  return m
}
