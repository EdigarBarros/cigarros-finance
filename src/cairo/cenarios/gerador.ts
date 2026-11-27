/**
 * Os futuros possíveis da pessoa, de hoje até o fim do horizonte, para o planejador (parte de decisão) avaliar.
 *
 * Cada mundo junta:
 *  - os COMPROMISSOS da agenda do app (contas, parcelas, faturas): conhecidos desde hoje (`reveladoEm` = hoje);
 *  - a RENDA esperada, com o atraso e a chance de não vir aprendidos de cada fonte (aprendizado/entradas.ts): só é revelada
 *    quando cai (`reveladoEm` = o dia em que caiu no mundo);
 *  - o que TE DEVEM, com a chance de pagar no dia de cada pessoa (aprendizado/pontualidade.ts): nunca é dinheiro disponível
 *    antes de cair;
 *  - o DIA A DIA, sorteado de dias reais da pessoa (aprendizado/diaADia.ts), com o pico depois de cada entrada QUE CAIU
 *    NAQUELE MUNDO (a renda atrasada arrasta o pico junto: `dependeDe` 'desloca_junto').
 *
 * `revelar(mundo, dia)` dá à política só o que ela pode saber naquele dia. `trocarFuturo` monta os pares do teste de
 * não-antecipação (dois mundos iguais até um dia e diferentes depois).
 */
import { REGRAS } from '../contrato/politicas'
import type { Fluxo, GeradorDeCenarios, Horizonte, Mundo, Observado } from '../contrato/tipos'
import { lerValor } from '../contrato/validar'
import { centavosDe, lerDia, maiorDia, numero, doNumero, somarDias, type DiaISO, type Moeda, type Valor } from '../contrato/unidades'
import type { AReceberBruto, CartaoBruto, CompromissoBruto, ContaFixaBruta } from '../entrada'
import type { ModeloDoCartao } from '../aprendizado/cartao'
import { sorteio, type Sorteio } from '../aprendizado/aleatorio'
import type { ModeloDiaADia } from '../aprendizado/diaADia'
import { fonteDoCompromisso, type FonteDeRenda } from '../aprendizado/entradas'
import { pontualidadeDaDivida, type Pontualidade } from '../aprendizado/pontualidade'

export const GERADOR_VERSAO = '1.1.0'

export interface EntradaDoGerador {
  horizonte: Horizonte
  moeda: Moeda
  compromissos: CompromissoBruto[]
  contas: ContaFixaBruta[]
  aReceber: AReceberBruto[]
  fontes: FonteDeRenda[]
  pontualidade: Pontualidade[]
  diaADia: ModeloDiaADia | null
  /** (1.1) As compras futuras no cartão e os ciclos de cada cartão. */
  cartao?: ModeloDoCartao | null
  cartoes?: CartaoBruto[]
}

const prov = (refs: string[], conhecidoEm: DiaISO) => ({
  refs: refs.map((r) => { const [tabela, ...id] = r.split(':'); return { tabela, id: id.join(':'), versao: null } }), conhecidoEm, atualizadoEm: null,
})

interface Base {
  /** Os compromissos de saída (iguais em todo mundo). */
  saidas: Fluxo[]
  /** As entradas esperadas, com a fonte (para sortear o atraso). */
  entradas: { fluxo: Fluxo; fonte: FonteDeRenda | null; vence: DiaISO }[]
  receber: { fluxo: Fluxo; p: number }[]
}

function montarBase(e: EntradaDoGerador): Base {
  const { hoje, ate } = e.horizonte
  const saidas: Fluxo[] = []
  const entradas: Base['entradas'] = []
  const receber: Base['receber'] = []
  // devolução de quem te deve marcada para o futuro: vale mais que a parcela prevista da mesma dívida perto do mesmo dia
  const devolucoes = e.compromissos.filter((c) => c.natureza === 'devolucao' && c.divida_id)
  e.compromissos.forEach((c, i) => {
    const data = lerDia(c.data)
    const v = lerValor(c.valor, e.moeda)
    if (!data || !v.ok || v.valor.centavos <= 0 || data > ate) return
    const dia = maiorDia(data, hoje)
    const id = `c${i}:${c.origem}:${c.descricao}`
    const tipo = c.natureza === 'credito_recebido' ? 'emprestimo-recebido' : c.natureza === 'emprestimo_concedido' ? 'emprestimo-concedido'
      : c.natureza === 'devolucao' ? 'me-devem' : c.natureza === 'transferencia_propria' ? 'transferencia'
        : c.origem === 'parcela' ? 'parcela' : c.origem === 'cartao' ? 'fatura' : c.origem === 'conta' ? 'conta-fixa' : c.origem === 'recorrente' ? 'recorrente' : 'lancamento-futuro'
    // recorrente: o app detectou que se repete, ninguém contratou. Lançamento futuro e conta: a pessoa disse.
    const origem: Fluxo['origem'] = c.origem === 'recorrente' ? 'previsto' : 'compromisso'
    const divida = c.divida_id ?? c.grupo
    const ref = prov(divida ? [`dividas:${divida}`] : [], hoje)
    const comDivida = divida ? { divida } : {}
    if (c.tipo === 'saida') {
      const natureza: Fluxo['natureza'] = c.natureza === 'emprestimo_concedido' ? 'emprestimo_concedido'
        : c.natureza === 'transferencia_propria' ? 'transferencia_propria' : c.essencial ? 'essencial' : 'obrigacao'
      saidas.push({ id, dia, reveladoEm: hoje, valor: v.valor, sentido: 'sai', natureza, origem, tipo, descricao: c.descricao, ref, ...comDivida })
    } else if (c.natureza === 'devolucao') {
      // quem te deve disse que paga nesse dia: continua incerto (a chance é a da pontualidade dessa pessoa)
      const p = (c.divida_id && pontualidadeDaDivida(e.pontualidade, c.divida_id)?.p) || REGRAS.pontualidadePrior.valor.media
      receber.push({ p, fluxo: { id, dia, reveladoEm: dia, valor: v.valor, sentido: 'entra', natureza: 'a_receber', origem, tipo, descricao: c.descricao, ref, ...comDivida } })
    } else if (c.natureza === 'credito_recebido') {
      // empréstimo contratado que vai cair: é caixa, não é renda; não tem atraso aprendido
      entradas.push({ vence: data, fonte: null, fluxo: { id, dia, reveladoEm: dia, valor: v.valor, sentido: 'entra', natureza: 'credito_recebido', origem, tipo, descricao: c.descricao, ref, ...comDivida } })
    } else if (c.natureza === 'transferencia_propria') {
      // resgate da caixinha para a conta: muda de bolso
      entradas.push({ vence: data, fonte: null, fluxo: { id, dia, reveladoEm: dia, valor: v.valor, sentido: 'entra', natureza: 'transferencia_propria', origem, tipo, descricao: c.descricao, ref } })
    } else {
      const fonte = c.origem === 'lancamento' ? null : fonteDoCompromisso(e.fontes, c.descricao, e.contas)
      entradas.push({
        vence: data, fonte,
        fluxo: { id, dia, reveladoEm: dia, valor: v.valor, sentido: 'entra', natureza: 'renda', origem, tipo, descricao: c.descricao, ref, ...(fonte ? { fonte: fonte.chave } : {}) },
      })
    }
  })
  e.aReceber.forEach((a, i) => {
    const data = lerDia(a.data)
    const v = lerValor(a.valor, e.moeda)
    if (!data || !v.ok || v.valor.centavos <= 0 || data > ate) return
    // a pessoa já marcou a devolução desta dívida perto deste dia: é a mesma, não conta duas vezes
    if (devolucoes.some((d) => d.divida_id === a.divida_id && Math.abs(numero(lerDia(d.data) ?? data) - numero(data)) <= 7)) return
    const dia = maiorDia(data, hoje)
    const p = pontualidadeDaDivida(e.pontualidade, a.divida_id)?.p ?? REGRAS.pontualidadePrior.valor.media
    receber.push({
      p,
      fluxo: {
        id: `r${i}:${a.divida_id}`, dia, reveladoEm: dia, valor: v.valor, sentido: 'entra', natureza: 'a_receber', origem: 'previsto',
        tipo: 'me-devem', descricao: a.descricao, ref: prov([`dividas:${a.divida_id}`], hoje), divida: a.divida_id,
      },
    })
  })
  return { saidas, entradas, receber }
}

/** Os dias do dia a dia: de amanhã até o fim do horizonte (o de hoje já está, em parte, lançado). */
function diasDoDiaADia(h: Horizonte): DiaISO[] {
  const out: DiaISO[] = []
  for (let n = numero(h.hoje) + 1; n <= numero(h.ate); n++) out.push(doNumero(n))
  return out
}

function mundo(e: EntradaDoGerador, base: Base, indice: number, semente: number, mediano: boolean): Mundo {
  const r: Sorteio = sorteio(semente)
  const { hoje, ate } = e.horizonte
  const fluxos: Fluxo[] = [...base.saidas]
  const caiu: DiaISO[] = []
  for (const x of base.entradas) {
    const s = mediano || !x.fonte ? { atraso: x.fonte?.atraso.dist.quantis.p50 ?? 0, vem: !x.fonte || x.fonte.pNaoOcorre < 0.5 } : x.fonte.sortear(r)
    if (!s.vem) continue
    // atrasada já: cai a partir de hoje
    const dia = maiorDia(somarDias(x.vence, s.atraso), hoje)
    if (dia > ate) continue
    fluxos.push({ ...x.fluxo, id: `${x.fluxo.id}@${indice}`, dia, reveladoEm: dia })
    // o pico do dia a dia foi aprendido depois de entrada de renda: empréstimo e resgate não contam
    if (x.fluxo.natureza === 'renda' && x.fluxo.valor.centavos > 0) caiu.push(dia)
  }
  for (const x of base.receber) {
    if (mediano ? x.p < 0.5 : r() >= x.p) continue
    fluxos.push({ ...x.fluxo, id: `${x.fluxo.id}@${indice}` })
  }
  const m = e.diaADia
  if (m) {
    const janela = REGRAS.janelaAposEntrada.valor
    const pico = m.picoAposEntrada.valor
    const caiuN = caiu.map(numero)
    for (const d of diasDoDiaADia(e.horizonte)) {
      const n = numero(d)
      const entradaAntes = caiuN.find((c) => n >= c && n < c + janela)
      const fator = entradaAntes !== undefined ? pico : 1
      const bruto = mediano ? m.mediaDiaria.valor : m.sortear(d, r)
      const c = centavosDe((bruto * fator) / 100)
      if (c <= 0) continue
      fluxos.push({
        id: `d:${d}@${indice}`, dia: d, reveladoEm: d, valor: { centavos: c, moeda: e.moeda }, sentido: 'sai', natureza: 'dia_a_dia',
        origem: 'previsto', tipo: 'dia-a-dia', descricao: '', ref: prov([], hoje),
        ...(entradaAntes !== undefined ? { dependeDe: { fluxo: `entrada:${doNumero(entradaAntes)}`, relacao: 'desloca_junto' as const } } : {}),
      })
    }
  }
  fluxos.push(...comprasFuturasNoCartao(e, indice, mediano, r))
  fluxos.sort((a, b) => a.dia.localeCompare(b.dia) || (a.sentido === b.sentido ? 0 : a.sentido === 'entra' ? -1 : 1))
  return { indice, semente, fluxos }
}

/**
 * As compras que a pessoa ainda vai fazer no cartão, de amanhã até o fim do horizonte: cada uma cai na fatura do ciclo em que
 * foi feita (e as parcelas, nas seguintes), só as que vencem dentro do horizonte. Um fluxo por dia de compra, cartão e
 * fatura: `dia` é o vencimento, `reveladoEm` e `competencia` o dia da compra (a pessoa sabe que comprou quando compra).
 * As compras até hoje já estão na fatura da agenda: não entram de novo.
 */
function comprasFuturasNoCartao(e: EntradaDoGerador, indice: number, mediano: boolean, r: Sorteio): Fluxo[] {
  const m = e.cartao
  const cartoes = (e.cartoes ?? []).map((c) => ({
    id: c.id,
    ciclos: c.ciclos.map((x) => ({ fechamento: lerDia(x.fechamento), vencimento: lerDia(x.vencimento) }))
      .filter((x): x is { fechamento: DiaISO; vencimento: DiaISO } => Boolean(x.fechamento && x.vencimento)),
  })).filter((c) => c.ciclos.length)
  if (!m || !cartoes.length) return []
  const { hoje, ate } = e.horizonte
  const ciclos = new Map(cartoes.map((c) => [c.id, c.ciclos]))
  // a compra feita num cartão que não existe mais vai para o primeiro cartão ativo
  const cartaoDe = (id: string) => (ciclos.has(id) ? id : cartoes[0].id)
  // na versão mediana: a média por dia da parcela k (0 = a primeira) de cada cartão
  const medias = [...m.mediaPorParcela].flatMap(([cartao, ks]) => ks.map((valor, k) => ({ cartao: cartaoDe(cartao), k, valor })))
  const out: Fluxo[] = []
  for (const d of diasDoDiaADia(e.horizonte)) {
    const porFatura = new Map<string, { cartao: string; vence: DiaISO; centavos: number }>()
    /** Põe a parcela `k` de uma compra feita em `d` na fatura certa (o ciclo do dia, mais k). */
    const por = (cartao: string, k: number, centavos: number) => {
      const cs = ciclos.get(cartao)!
      const i0 = cs.findIndex((x) => x.fechamento >= d)
      if (i0 < 0 || i0 + k >= cs.length || cs[i0 + k].vencimento > ate) return
      const vence = cs[i0 + k].vencimento
      const x = porFatura.get(`${cartao}|${vence}`) ?? { cartao, vence, centavos: 0 }
      x.centavos += centavos
      porFatura.set(`${cartao}|${vence}`, x)
    }
    if (mediano) for (const x of medias) por(x.cartao, x.k, x.valor)
    else for (const c of m.sortear(d, r)) for (let k = 0; k < c.parcelas; k++) por(cartaoDe(c.cartao), k, c.parcela)
    for (const x of porFatura.values()) {
      const c = Math.round(x.centavos)
      if (c <= 0) continue
      out.push({
        id: `k:${d}:${x.cartao}:${x.vence}@${indice}`, dia: x.vence, reveladoEm: d, competencia: d, valor: { centavos: c as Valor['centavos'], moeda: e.moeda },
        sentido: 'sai', natureza: 'obrigacao', origem: 'previsto', tipo: 'compra-cartao-futura', descricao: '', ref: prov([`cartoes:${x.cartao}`], hoje),
      })
    }
  }
  return out
}

/** O que se espera e ainda não se sabe se vem, IGUAL em todo mundo: renda no dia típico, me devem e o dia a dia médio. */
function esperadosDe(e: EntradaDoGerador, base: Base, med: Mundo): Fluxo[] {
  const { hoje, ate } = e.horizonte
  const out: Fluxo[] = []
  for (const x of base.entradas) {
    const atraso = x.fonte?.atraso.dist.quantis.p50 ?? 0
    const dia = maiorDia(somarDias(x.vence, atraso), hoje)
    if (dia > ate) continue
    out.push({ ...x.fluxo, id: `${x.fluxo.id}@-1`, dia, reveladoEm: dia, pOcorre: x.fonte ? 1 - x.fonte.pNaoOcorre : 1 })
  }
  for (const x of base.receber) out.push({ ...x.fluxo, id: `${x.fluxo.id}@-1`, pOcorre: x.p })
  out.push(...med.fluxos.filter((f) => f.natureza === 'dia_a_dia' || f.tipo === 'compra-cartao-futura'))
  return out.sort((a, b) => a.dia.localeCompare(b.dia))
}

export function criarGerador(e: EntradaDoGerador): GeradorDeCenarios & { esperados: Fluxo[] } {
  const base = montarBase(e)
  const med = mundo(e, base, -1, 0, true)
  const esperados = esperadosDe(e, base, med)
  return {
    versao: GERADOR_VERSAO,
    horizonte: e.horizonte,
    moeda: e.moeda,
    gerar(n: number, semente: number) {
      const r = sorteio(semente)
      return Array.from({ length: n }, (_, i) => mundo(e, base, i, Math.floor(r() * 4294967296), false))
    },
    mediano: () => med,
    esperados,
  }
}

const idBase = (id: string) => (id.includes('@') ? id.slice(0, id.lastIndexOf('@')) : id)

/**
 * O que a política pode saber no dia `dia`: o que este mundo já revelou e o que ainda se espera. O esperado que já caiu
 * sai da lista; o que passou do dia sem cair continua esperado a partir de amanhã, com `esperadoEm` no dia original.
 * O dia a dia passado sai (ou aconteceu, ou não).
 */
export function revelar(m: Mundo, esperados: Fluxo[], dia: DiaISO): Observado {
  const conhecidos = m.fluxos.filter((f) => f.reveladoEm <= dia)
  const vieram = new Set(conhecidos.map((f) => idBase(f.id)))
  const amanha = somarDias(dia, 1)
  const ainda = esperados
    // a compra no cartão esperada para um dia que já passou: ou foi feita (está nos conhecidos) ou não foi
    .filter((f) => !vieram.has(idBase(f.id)) && (f.natureza !== 'dia_a_dia' || f.dia > dia) && !(f.tipo === 'compra-cartao-futura' && (f.competencia ?? f.dia) <= dia))
    .map((f) => (f.dia > dia ? f : { ...f, dia: amanha, reveladoEm: amanha, esperadoEm: f.dia }))
  return { hoje: dia, conhecidos, esperados: ainda }
}

/** Um mundo igual a `a` até `dia` (inclusive) e igual a `b` depois: o par do teste de não-antecipação. */
export function trocarFuturo(a: Mundo, b: Mundo, dia: DiaISO): Mundo {
  return { indice: a.indice, semente: a.semente, fluxos: [...a.fluxos.filter((f) => f.reveladoEm <= dia), ...b.fluxos.filter((f) => f.reveladoEm > dia)] }
}

export const somaDe = (fluxos: Fluxo[], moeda: Moeda): Valor => ({ centavos: fluxos.reduce((s, f) => s + f.valor.centavos, 0) as Valor['centavos'], moeda })
