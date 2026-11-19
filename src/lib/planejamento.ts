/**
 * Planejamento do mês: a pessoa diz com qual dinheiro paga cada conta. Cada entrada (o salário do dia 20, o freela do dia
 * 25, o saldo de hoje) é uma barra que vai sendo fatiada; cada fatia é uma parte dela indo para uma conta, uma dívida ou
 * uma meta. Uma conta pode ser paga em pedaços, por entradas diferentes (R$ 250 agora, R$ 250 com o próximo dinheiro).
 *
 * As entradas e as contas saem do planejador de pagamentos (lib/planejador.ts), que o Consultor já calcula: aqui não se
 * lança nada, só se decide. O plano fica em `perfis.consultor.planejamento` (a mesma coluna da memória, migração 24) e
 * no aparelho. O Consultor lê o plano e avisa o que ele deixa atrasar ou sem dinheiro (`conselhosDoPlanejamento`).
 *
 * É puro como o motor: sem React, sem banco, com o dia de hoje entrando por `hoje`.
 */
import { custoDoAtraso, type Compromisso, type Plano } from './planejador'
import { tx } from './textos'

/** Um dinheiro que entra (ou o que já está na conta hoje). */
export interface Fonte {
  id: string
  nome: string
  valor: number
  /** O dia em que o dinheiro está disponível (hoje, para o saldo). */
  data: string
  saldo?: boolean
}

export type TipoDestino = 'conta' | 'divida' | 'meta' | 'guardar'

/** Para onde o dinheiro pode ir. */
export interface Destino {
  id: string
  nome: string
  tipo: TipoDestino
  /** Quanto falta pagar; null = recebe o quanto a pessoa quiser (meta, guardar). */
  valor: number | null
  /** Vencimento de verdade (null para dívida sem parcela e meta). */
  vence: string | null
  /** Já venceu antes de hoje. */
  atrasada: boolean
  /** Juros em % ao mês: do atraso (conta) ou da dívida aberta. */
  juros: number | null
  multa: number
  /** Os juros não foram informados: são estimativa. */
  estimada: boolean
  origem: Compromisso['origem'] | 'aberta' | 'meta' | 'guardar'
  /** Posição estável, para a tela dar a cor. */
  indice: number
}

/** Uma fatia: quanto desta entrada vai para este destino. */
export interface Parte {
  entrada: string
  conta: string
  valor: number
}

export type QualMes = 'este' | 'proximo'

export interface Quadro {
  qual: QualMes
  /** 'AAAA-MM' do mês planejado. */
  mes: string
  hoje: string
  fontes: Fonte[]
  destinos: Destino[]
}

export interface PlanoGuardado {
  partes: Parte[]
  /** Quando a pessoa mexeu pela última vez. */
  em: string
}

/** O plano de cada mês, pela chave 'AAAA-MM'. */
export type Planejamentos = Record<string, PlanoGuardado>

/** O que a tela e o Consultor precisam de uma dívida aberta (sem parcela fixa, correndo juros). */
export interface AbertaDoQuadro { nome: string; saldo: number; juros: number }
export interface MetaDoQuadro { id: string; nome: string }

const centavos = (n: number) => Math.round(n * 100) / 100
const utc = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)))
export const diasEntre = (de: string, ate: string) => Math.round((utc(ate) - utc(de)) / 86400000)
const fimDoMes = (mes: string) => {
  const [a, m] = mes.split('-').map(Number)
  return `${mes}-${String(new Date(Date.UTC(a, m, 0)).getUTCDate()).padStart(2, '0')}`
}
export const mesSeguinte = (mes: string) => {
  const [a, m] = mes.split('-').map(Number)
  return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, '0')}`
}
const chave = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** Juros a partir dos quais uma dívida "cara" passa na frente no "Montar pra mim" e nas dicas (% ao mês). */
export const JUROS_CARO = 5

/**
 * Monta o quadro de um mês com o que o planejador já sabe: as entradas que ainda vão cair (e o saldo de hoje, para este
 * mês) e as contas, parcelas e faturas que vencem nele (as atrasadas entram no mês de hoje). Dívidas abertas com juros
 * entram como "adiantar"; as metas, como lugar para guardar o que sobrar.
 */
export function quadroDoMes(plano: Plano | null, hoje: string, qual: QualMes, extras: { abertas?: AbertaDoQuadro[]; metas?: MetaDoQuadro[] } = {}): Quadro {
  const mesHoje = hoje.slice(0, 7)
  const mes = qual === 'este' ? mesHoje : mesSeguinte(mesHoje)
  const ini = qual === 'este' ? hoje : `${mes}-01`
  const fim = fimDoMes(mes)
  const fontes: Fonte[] = []
  const usadas = new Set<string>()
  const unico = (id: string) => { let x = id, n = 2; while (usadas.has(x)) x = `${id}-${n++}`; usadas.add(x); return x }
  for (const f of plano?.fontes ?? []) {
    if (f.valor <= 0) continue
    const doSaldo = plano!.comSaldo && f.data === hoje && f === plano!.fontes[0]
    if (doSaldo) {
      if (qual === 'este') fontes.push({ id: unico('saldo'), nome: tx('O que está na conta'), valor: centavos(f.valor), data: hoje, saldo: true })
      continue
    }
    if (f.data < ini || f.data > fim) continue
    fontes.push({ id: unico(`e:${f.data}:${chave(f.descricao)}`), nome: f.descricao, valor: centavos(f.valor), data: f.data })
  }

  const destinos: Destino[] = []
  const todos = [...(plano?.pagamentos ?? []), ...(plano?.semDinheiro ?? [])]
    .filter((p) => (qual === 'este' ? p.vence <= fim : p.vence >= ini && p.vence <= fim))
    .sort((a, b) => a.vence.localeCompare(b.vence) || b.valor - a.valor)
  const ids = new Set<string>()
  const idDe = (base: string) => { let x = base, n = 2; while (ids.has(x)) x = `${base}-${n++}`; ids.add(x); return x }
  for (const p of todos) {
    destinos.push({
      id: idDe(`c:${p.vence}:${chave(p.descricao)}`), nome: p.descricao, tipo: 'conta', valor: centavos(p.valor), vence: p.vence,
      atrasada: p.vence < hoje, juros: p.taxaMes, multa: p.multa, estimada: p.estimada, origem: p.origem, indice: destinos.length,
    })
  }
  for (const d of (extras.abertas ?? []).filter((x) => x.saldo > 0 && x.juros > 0).sort((a, b) => b.juros - a.juros).slice(0, 3)) {
    destinos.push({
      id: idDe(`d:${chave(d.nome)}`), nome: d.nome, tipo: 'divida', valor: centavos(d.saldo), vence: null, atrasada: false,
      juros: d.juros, multa: 0, estimada: false, origem: 'aberta', indice: destinos.length,
    })
  }
  const metas = (extras.metas ?? []).slice(0, 3)
  for (const m of metas) {
    destinos.push({ id: idDe(`m:${m.id}`), nome: m.nome, tipo: 'meta', valor: null, vence: null, atrasada: false, juros: null, multa: 0, estimada: false, origem: 'meta', indice: destinos.length })
  }
  if (!metas.length) {
    destinos.push({ id: 'guardar', nome: tx('Guardar'), tipo: 'guardar', valor: null, vence: null, atrasada: false, juros: null, multa: 0, estimada: false, origem: 'guardar', indice: destinos.length })
  }
  return { qual, mes, hoje, fontes, destinos }
}

// ---------- contas do plano ----------

export const fonteDe = (q: Quadro, id: string) => q.fontes.find((x) => x.id === id)
export const destinoDe = (q: Quadro, id: string) => q.destinos.find((x) => x.id === id)
export const usado = (partes: Parte[], f: Fonte) => centavos(partes.filter((p) => p.entrada === f.id).reduce((s, p) => s + p.valor, 0))
export const sobra = (partes: Parte[], f: Fonte) => Math.max(0, centavos(f.valor - usado(partes, f)))
export const pago = (partes: Parte[], d: Destino) => centavos(partes.filter((p) => p.conta === d.id).reduce((s, p) => s + p.valor, 0))
export const falta = (partes: Parte[], d: Destino) => (d.valor === null ? Infinity : Math.max(0, centavos(d.valor - pago(partes, d))))

/** Quantos dias a conta atrasa se for paga com esta entrada (0: no prazo, ou já estava atrasada antes de hoje). */
export function atrasoDa(q: Quadro, p: Parte): number {
  const f = fonteDe(q, p.entrada), d = destinoDe(q, p.conta)
  if (!f || !d || !d.vence || d.atrasada) return 0
  return Math.max(0, diasEntre(d.vence, f.data))
}

/** Multa e juros que a parte paga a mais por cair depois do vencimento (contando o atraso que já existe). */
export function custoDa(q: Quadro, p: Parte): number {
  const f = fonteDe(q, p.entrada), d = destinoDe(q, p.conta)
  if (!f || !d || !d.vence || d.tipo !== 'conta') return 0
  const dias = diasEntre(d.vence, f.data)
  return dias > 0 ? custoDoAtraso(p.valor, dias, d.juros ?? 1, d.multa) : 0
}

/**
 * O plano guardado contra o quadro de agora: tira as partes cuja entrada ou conta sumiu (a conta foi paga, a entrada
 * mudou de dia) e encolhe as que passaram do valor (a conta ficou menor, a entrada também). Nunca cria parte.
 */
export function valerPartes(q: Quadro, partes: Parte[]): Parte[] {
  const certas: Parte[] = []
  for (const p of partes) {
    const f = fonteDe(q, p.entrada), d = destinoDe(q, p.conta)
    if (!f || !d || !(p.valor > 0)) continue
    const cabe = Math.min(sobra(certas, f), falta(certas, d), p.valor)
    if (cabe >= 0.01) certas.push({ entrada: p.entrada, conta: p.conta, valor: centavos(cabe) })
  }
  return certas
}

/** Põe o que cabe de uma conta numa entrada (soma à parte que já existe). Devolve as partes novas e quanto entrou. */
export function por(q: Quadro, partes: Parte[], conta: string, entrada: string, quanto?: number): { partes: Parte[]; valor: number } {
  const f = fonteDe(q, entrada), d = destinoDe(q, conta)
  if (!f || !d) return { partes, valor: 0 }
  const v = centavos(Math.min(sobra(partes, f), falta(partes, d), quanto ?? Infinity))
  if (v <= 0) return { partes, valor: 0 }
  const ja = partes.find((p) => p.entrada === entrada && p.conta === conta)
  return {
    partes: ja ? partes.map((p) => (p === ja ? { ...p, valor: centavos(p.valor + v) } : p)) : [...partes, { entrada, conta, valor: v }],
    valor: v,
  }
}

/** Até quanto esta parte pode ir (o que já tem mais o que sobra na entrada e o que falta na conta). */
export function maximoDa(q: Quadro, partes: Parte[], p: Parte): number {
  const f = fonteDe(q, p.entrada), d = destinoDe(q, p.conta)
  if (!f || !d) return p.valor
  const outras = partes.filter((x) => !(x.entrada === p.entrada && x.conta === p.conta))
  return centavos(Math.min(sobra(outras, f), d.valor === null ? Infinity : Math.max(0, d.valor - pago(outras, d))))
}

/** Troca o valor de uma parte (0 tira). */
export function mudarParte(q: Quadro, partes: Parte[], entrada: string, conta: string, valor: number): Parte[] {
  const p = partes.find((x) => x.entrada === entrada && x.conta === conta)
  if (!p) return partes
  const v = centavos(Math.max(0, Math.min(maximoDa(q, partes, p), valor)))
  return v < 0.01 ? partes.filter((x) => x !== p) : partes.map((x) => (x === p ? { ...x, valor: v } : x))
}

/** A ordem em que as contas pedem dinheiro: atrasadas, juros caros, depois pelo vencimento. */
function prioridade(a: Destino, b: Destino) {
  const caro = (d: Destino) => (d.tipo === 'conta' && !d.estimada && (d.juros ?? 0) >= JUROS_CARO ? d.juros! : d.tipo === 'conta' && d.origem === 'cartao' ? JUROS_CARO : 0)
  return Number(b.atrasada) - Number(a.atrasada) || caro(b) - caro(a) || (a.vence ?? '9').localeCompare(b.vence ?? '9') || b.valor! - a.valor!
}

/**
 * "Montar pra mim": cada conta do mês, na ordem de quem cobra mais caro por esperar, sai do dinheiro que chega a tempo
 * (o mais cedo primeiro); se não chegar a tempo, do primeiro que chegar. Depois, o que sobra adianta a dívida aberta mais
 * cara (acima de 5% ao mês) e o resto vai para a primeira meta (ou "Guardar").
 */
export function montarPraMim(q: Quadro): Parte[] {
  let partes: Parte[] = []
  const contas = q.destinos.filter((d) => d.tipo === 'conta').sort(prioridade)
  for (const d of contas) {
    const fontes = [...q.fontes].sort((a, b) => {
      const ok = (f: Fonte) => (d.atrasada || !d.vence || f.data <= d.vence ? 0 : 1)
      return ok(a) - ok(b) || a.data.localeCompare(b.data)
    })
    for (const f of fontes) partes = por(q, partes, d.id, f.id).partes
  }
  for (const d of q.destinos.filter((x) => x.tipo === 'divida' && (x.juros ?? 0) >= JUROS_CARO)) {
    for (const f of q.fontes) partes = por(q, partes, d.id, f.id).partes
  }
  const guardar = q.destinos.find((x) => x.tipo === 'meta' || x.tipo === 'guardar')
  if (guardar) for (const f of q.fontes) partes = por(q, partes, guardar.id, f.id).partes
  return partes
}

// ---------- o placar ----------

export interface Placar {
  /** % das contas do mês com dinheiro (0 a 100). */
  pct: number
  coberto: number
  total: number
  /** Dinheiro das entradas ainda sem destino. */
  semDestino: number
  /** Partes que pagam depois do vencimento. */
  atrasos: number
  /** Quanto o plano custa em multa e juros (atrasos e contas que já venceram). */
  custo: number
  /** Contas do mês que ainda têm algo sem dinheiro. */
  faltando: number
  /** Tudo do mês com dinheiro e nada atrasando por causa do plano. */
  fechado: boolean
}

export function placarDe(q: Quadro, partes: Parte[]): Placar {
  const contas = q.destinos.filter((d) => d.tipo === 'conta')
  const total = centavos(contas.reduce((s, d) => s + d.valor!, 0))
  const coberto = centavos(contas.reduce((s, d) => s + Math.min(d.valor!, pago(partes, d)), 0))
  const atrasos = partes.filter((p) => atrasoDa(q, p) > 0).length
  const faltando = contas.filter((d) => falta(partes, d) > 0.009).length
  return {
    pct: total ? Math.min(100, Math.floor((coberto / total) * 100 + 1e-9)) : 0,
    coberto, total,
    semDestino: centavos(q.fontes.reduce((s, f) => s + sobra(partes, f), 0)),
    atrasos,
    custo: centavos(partes.reduce((s, p) => s + custoDa(q, p), 0)),
    faltando,
    fechado: total > 0 && faltando === 0 && atrasos === 0,
  }
}

// ---------- as dicas do Consultor dentro do jogo ----------

export interface DicaDoPlanejamento {
  id: string
  icone: string
  tom: 'bom' | 'atencao' | 'ruim' | 'neutro'
  texto: string
  /** Um passo que a tela pode fazer pela pessoa. */
  acao?: { rotulo: string; conta: string; entrada: string }
}

const dinheiro = (n: number, fmt: (n: number) => string) => fmt(n)

/** O que o Consultor diz enquanto a pessoa monta o plano: no máximo 4, o mais caro primeiro. */
export function dicasDe(q: Quadro, partes: Parte[], fmt: (n: number) => string, fmtData: (iso: string) => string): DicaDoPlanejamento[] {
  const dicas: DicaDoPlanejamento[] = []
  const contas = q.destinos.filter((d) => d.tipo === 'conta')
  if (!q.fontes.length) return dicas
  if (!partes.length) {
    dicas.push({ id: 'comecar', icone: 'ideia', tom: 'neutro', texto: tx('Comece pelo dinheiro que cai primeiro: coloque nele a conta que vence antes. Ou toque em "Montar pra mim" e ajuste depois.') })
    return dicas
  }
  // 1) atraso por causa do plano, com uma entrada que chega a tempo e tem espaço
  for (const p of partes) {
    const dias = atrasoDa(q, p)
    if (!dias) continue
    const f = fonteDe(q, p.entrada)!, d = destinoDe(q, p.conta)!
    const melhor = q.fontes.find((x) => x.id !== f.id && x.data <= d.vence! && sobra(partes, x) >= p.valor - 0.009)
    dicas.push({
      id: `atraso:${d.id}`, icone: 'relogio', tom: 'atencao',
      texto: (dias === 1
        ? tx('{0} vence {1}, mas {2} só cai {3}: atrasa 1 dia e custa uns {4}.', d.nome, fmtData(d.vence!), f.nome, fmtData(f.data), dinheiro(custoDa(q, p), fmt))
        : tx('{0} vence {1}, mas {2} só cai {3}: atrasa {4} dias e custa uns {5}.', d.nome, fmtData(d.vence!), f.nome, fmtData(f.data), dias, dinheiro(custoDa(q, p), fmt))),
      acao: melhor ? { rotulo: tx('Pagar com {0}', melhor.nome), conta: d.id, entrada: melhor.id } : undefined,
    })
  }
  // 2) atrasadas e caras ainda sem dinheiro
  const caras = contas.filter((d) => falta(partes, d) > 0.009 && (d.atrasada || (!d.estimada && (d.juros ?? 0) >= JUROS_CARO) || d.origem === 'cartao'))
    .sort(prioridade)
  for (const d of caras.slice(0, 2)) {
    const livre = q.fontes.find((f) => sobra(partes, f) > 0.009)
    const f = falta(partes, d)
    dicas.push({
      id: `caro:${d.id}`, icone: 'alerta', tom: 'ruim',
      texto: d.atrasada
        ? tx('{0} já venceu e ainda tem {1} sem dinheiro: cada dia soma multa e juros. É a primeira da fila.', d.nome, dinheiro(f, fmt))
        : tx('{0} cobra {1}% ao mês se atrasar e tem {2} sem dinheiro. Vale pagar antes das outras.', d.nome, String(Math.round((d.juros ?? 0) * 10) / 10).replace('.', ','), dinheiro(f, fmt)),
      acao: livre ? { rotulo: tx('Pôr em {0}', livre.nome), conta: d.id, entrada: livre.id } : undefined,
    })
  }
  // 3) conta paga em parte: o resto precisa de outra entrada
  for (const d of contas.filter((x) => pago(partes, x) > 0 && falta(partes, x) > 0.009 && !caras.includes(x)).slice(0, 1)) {
    const proxima = q.fontes.find((f) => sobra(partes, f) >= falta(partes, d) - 0.009)
    dicas.push({
      id: `parte:${d.id}`, icone: 'ideia', tom: 'neutro',
      texto: tx('{0}: {1} já têm dinheiro, faltam {2}. Coloque o resto em outra entrada.', d.nome, dinheiro(pago(partes, d), fmt), dinheiro(falta(partes, d), fmt)),
      acao: proxima ? { rotulo: tx('Pôr em {0}', proxima.nome), conta: d.id, entrada: proxima.id } : undefined,
    })
  }
  // 4) dinheiro sem destino
  const semDestino = centavos(q.fontes.reduce((s, f) => s + sobra(partes, f), 0))
  const faltam = contas.filter((d) => falta(partes, d) > 0.009)
  if (semDestino > 0.009) {
    const divida = q.destinos.find((d) => d.tipo === 'divida' && falta(partes, d) > 0.009)
    const guardar = q.destinos.find((d) => d.tipo === 'meta' || d.tipo === 'guardar')
    const alvo = faltam[0] ?? divida ?? guardar
    const fonte = q.fontes.find((f) => sobra(partes, f) > 0.009)!
    dicas.push({
      id: 'sem-destino', icone: 'cofre', tom: 'neutro',
      texto: faltam.length
        ? tx('{0} ainda sem destino, e {1} ainda sem dinheiro.', dinheiro(semDestino, fmt), faltam[0].nome)
        : divida
          ? tx('{0} ainda sem destino. Adiantar {1} ({2}% ao mês) é o que mais rende.', dinheiro(semDestino, fmt), divida.nome, String(Math.round((divida.juros ?? 0) * 10) / 10).replace('.', ','))
          : tx('{0} ainda sem destino. Dinheiro sem destino some no dia a dia: guarde uma parte.', dinheiro(semDestino, fmt)),
      acao: alvo ? { rotulo: tx('Pôr em {0}', alvo.nome), conta: alvo.id, entrada: fonte.id } : undefined,
    })
  }
  // 5) fechou
  const pl = placarDe(q, partes)
  if (pl.fechado) dicas.push({ id: 'fechado', icone: 'check', tom: 'bom', texto: tx('Tudo o que vence no mês tem dinheiro e nada atrasa por causa do plano.') })
  else if (faltam.length && !semDestino && !caras.length) {
    dicas.push({ id: 'nao-cabe', icone: 'alerta', tom: 'atencao', texto: tx('O dinheiro do mês acabou e {0} ainda ficam sem pagar. Veja o que dá para adiar ou negociar.', dinheiro(faltam.reduce((s, d) => s + falta(partes, d), 0), fmt)) })
  }
  const ordem = { ruim: 0, atencao: 1, neutro: 2, bom: 3 }
  return dicas.sort((a, b) => ordem[a.tom] - ordem[b.tom]).slice(0, 4)
}

// ---------- o Consultor lendo o plano ----------

export interface ConselhoDoPlano {
  id: string
  tom: 'ruim' | 'medio' | 'bom'
  icone: string
  titulo: string
  porque: string
}

/**
 * O que o Consultor tira do plano da pessoa, para o plano de ação: conta que o plano deixa atrasar, conta que ficou sem
 * dinheiro e (sem plano ainda) o convite para planejar quando o mês tem mais de uma entrada e várias contas.
 */
export function conselhosDoPlanejamento(q: Quadro, guardado: PlanoGuardado | undefined, fmt: (n: number) => string, fmtData: (iso: string) => string): ConselhoDoPlano[] {
  const contas = q.destinos.filter((d) => d.tipo === 'conta')
  if (!q.fontes.length || !contas.length) return []
  const partes = guardado ? valerPartes(q, guardado.partes) : []
  if (!partes.length) {
    if (q.fontes.length >= 2 && contas.length >= 3) {
      return [{
        id: 'planejar', tom: 'medio', icone: 'calendario',
        titulo: tx('Planeje com qual dinheiro sai cada conta.'),
        porque: tx('Este mês tem {0} entradas e {1} contas. Dividir cada entrada entre as contas, antes de o dinheiro cair, mostra o que atrasa e o que sobra.', q.fontes.length, contas.length),
      }]
    }
    return []
  }
  const lista: ConselhoDoPlano[] = []
  const atrasadas = partes.filter((p) => atrasoDa(q, p) > 0)
  if (atrasadas.length) {
    const p = atrasadas.sort((a, b) => custoDa(q, b) - custoDa(q, a))[0]
    const d = destinoDe(q, p.conta)!, f = fonteDe(q, p.entrada)!
    lista.push({
      id: `atraso:${d.id}`, tom: 'medio', icone: 'relogio',
      titulo: tx('Seu plano paga {0} depois do vencimento.', d.nome),
      porque: tx('{0} vence {1} e o plano paga com {2}, que cai {3}. São {4} de multa e juros: troque por um dinheiro que chegue antes.', d.nome, fmtData(d.vence!), f.nome, fmtData(f.data), fmt(custoDa(q, p))),
    })
  }
  const sem = contas.filter((d) => falta(partes, d) > 0.009)
  if (sem.length) {
    const total = centavos(sem.reduce((s, d) => s + falta(partes, d), 0))
    lista.push({
      id: 'sem-dinheiro', tom: sem.some((d) => d.atrasada) ? 'ruim' : 'medio', icone: 'alerta',
      titulo: sem.length === 1 ? tx('No seu plano, {0} ainda está sem dinheiro.', sem[0].nome) : tx('No seu plano, {0} contas ainda estão sem dinheiro.', sem.length),
      porque: tx('Faltam {0} no plano do mês. Coloque o que falta em alguma entrada ou veja o que dá para adiar.', fmt(total)),
    })
  }
  return lista
}

// ---------- guardar ----------

/** Lê o que veio do banco ou do aparelho, sem confiar no formato. Fica só o mês de hoje e o próximo. */
export function normPlanejamentos(x: unknown, hoje?: string): Planejamentos {
  const saida: Planejamentos = {}
  if (!x || typeof x !== 'object') return saida
  const valem = hoje ? new Set([hoje.slice(0, 7), mesSeguinte(hoje.slice(0, 7))]) : null
  for (const [mes, v] of Object.entries(x as Record<string, unknown>)) {
    if (!/^\d{4}-\d{2}$/.test(mes) || (valem && !valem.has(mes)) || !v || typeof v !== 'object') continue
    const partes = Array.isArray((v as PlanoGuardado).partes) ? (v as PlanoGuardado).partes : []
    saida[mes] = {
      em: typeof (v as PlanoGuardado).em === 'string' ? (v as PlanoGuardado).em : '',
      partes: partes.filter((p) => p && typeof p.entrada === 'string' && typeof p.conta === 'string' && Number.isFinite(p.valor) && p.valor > 0)
        .map((p) => ({ entrada: p.entrada, conta: p.conta, valor: centavos(p.valor) })),
    }
  }
  return saida
}
