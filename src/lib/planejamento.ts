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
  /** Dinheiro guardado (caixinha, reserva, investimento): só entra no plano se a pessoa escolher usar. */
  guardado?: boolean
  /** Dinheiro que alguém te deve ("me devem"): só entra no plano se a pessoa escolher contar com ele. */
  aReceber?: boolean
  /** A receber sem dia combinado: conta no fim do mês (o plano não sabe quando cai). */
  semDia?: boolean
  /** A receber: quem paga. */
  quem?: string
  /**
   * Já caiu: a entrada estava no plano salvo e foi lançada (não vem mais como prevista). Continua na mesa com as fatias que
   * tinha, mas não recebe conta nova (o dinheiro já está na conta; contar de novo seria em dobro).
   */
  feito?: boolean
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
  /**
   * Parcelas atrasadas da mesma dívida juntas numa ficha só: quantas são e o vencimento médio (pelo valor), que é de onde
   * conta o custo de esperar. `vence` fica sendo a mais antiga ("desde 2 de mar").
   */
  juntas?: { parcelas: number; venceMedio: string }
  /** Já paga: a conta estava no plano salvo e foi paga (lançada). A fatia fica travada, como foi planejada. */
  feito?: boolean
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
  /**
   * O dinheiro guardado que pode entrar no plano deste mês (uma barra por banco com caixinha ou reserva, e os
   * investimentos). Fica de fora das `fontes` até a pessoa ligar "Usar o dinheiro guardado" (`quadroDoPlano`).
   */
  guardados: Fonte[]
  /**
   * O que te devem e deve cair no mês (a promessa, a parcela; o atrasado sem dia, no fim do mês de hoje). Fica de fora das
   * `fontes` até a pessoa ligar "Contar com quem me deve" (`quadroDoPlano`).
   */
  aReceber: Fonte[]
  destinos: Destino[]
}

export interface PlanoGuardado {
  partes: Parte[]
  /** Quando a pessoa mexeu pela última vez. */
  em: string
  /** A pessoa escolheu usar o dinheiro guardado neste mês. */
  comGuardado?: boolean
  /** A pessoa escolheu contar, neste mês, com o dinheiro de quem te deve. */
  comAReceber?: boolean
  /**
   * Como estavam, ao salvar, as entradas e as contas que têm fatia: quando uma entrada cai ou uma conta é paga (e some do
   * que o planejador prevê), o plano a mantém na mesa como "já caiu" ou "paga", em vez de esquecer o que foi feito.
   */
  fotos?: Fotos
}

export interface Fotos {
  fontes: Record<string, { nome: string; valor: number; data: string; aReceber?: boolean; quem?: string }>
  destinos: Record<string, { nome: string; valor: number | null; vence: string | null; tipo: TipoDestino }>
}

/** O plano de cada mês, pela chave 'AAAA-MM'. */
export type Planejamentos = Record<string, PlanoGuardado>

/** O que a tela e o Consultor precisam de uma dívida aberta (sem parcela fixa, correndo juros). */
export interface AbertaDoQuadro { nome: string; saldo: number; juros: number }
export interface MetaDoQuadro { id: string; nome: string }
/** Um lugar com dinheiro guardado (o banco, ou os investimentos). */
export interface GuardadoDoQuadro { id: string; nome: string; valor: number }
/** Um dinheiro que alguém ficou de te pagar (`aReceberPrevisto` em lib/dividas.ts); `data` null = sem dia combinado. */
export interface AReceberDoQuadro { id: string; nome: string; valor: number; data: string | null }

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
export function quadroDoMes(plano: Plano | null, hoje: string, qual: QualMes, extras: { abertas?: AbertaDoQuadro[]; metas?: MetaDoQuadro[]; guardados?: GuardadoDoQuadro[]; aReceber?: AReceberDoQuadro[] } = {}): Quadro {
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
  // As parcelas atrasadas da mesma dívida viram uma ficha só (a dívida de 5 compras do Mercado Pago, com 6 dias de
  // vencimento atrasados, era 6 fichas "Mercado Pago" iguais). Paga-se a ficha; o dinheiro cobre a mais antiga primeiro.
  const grupos = new Map<string, typeof todos>()
  for (const p of todos) {
    if (p.origem !== 'parcela' || p.vence >= hoje || !p.grupo) continue
    grupos.set(p.grupo, [...(grupos.get(p.grupo) ?? []), p])
  }
  const feitos = new Set<string>()
  for (const p of todos) {
    const grupo = p.origem === 'parcela' && p.vence < hoje && p.grupo ? grupos.get(p.grupo)! : null
    if (grupo && grupo.length > 1) {
      if (feitos.has(p.grupo!)) continue
      feitos.add(p.grupo!)
      const valor = centavos(grupo.reduce((s, x) => s + x.valor, 0))
      const medio = grupo.reduce((s, x) => s + utc(x.vence) * x.valor, 0) / Math.max(valor, 0.01)
      destinos.push({
        id: idDe(`c:atrasadas:${p.grupo}`), nome: p.descricao, tipo: 'conta', valor, vence: grupo[0].vence, atrasada: true,
        juros: Math.max(...grupo.map((x) => x.taxaMes)), multa: p.multa, estimada: grupo.every((x) => x.estimada), origem: 'parcela',
        indice: destinos.length,
        juntas: { parcelas: grupo.reduce((s, x) => s + (x.pecas ?? 1), 0), venceMedio: new Date(medio).toISOString().slice(0, 10) },
      })
      continue
    }
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
  // o dinheiro guardado está disponível hoje: entra só no plano deste mês (no do mês que vem seria contado duas vezes)
  const guardados: Fonte[] = qual !== 'este' ? [] : (extras.guardados ?? [])
    .filter((g) => g.valor >= 0.01)
    .map((g) => ({ id: unico(`g:${g.id}`), nome: g.nome, valor: centavos(g.valor), data: hoje, guardado: true }))
  // o que te devem: no dia combinado (a promessa, a parcela); o que não tem dia entra no fim do mês de hoje, só neste mês
  // (no do mês que vem seria contado duas vezes)
  const aReceber: Fonte[] = (extras.aReceber ?? [])
    .filter((r) => r.valor >= 0.01 && (r.data === null ? qual === 'este' : r.data >= ini && r.data <= fim))
    .sort((a, b) => (a.data ?? fim).localeCompare(b.data ?? fim) || b.valor - a.valor)
    .map((r) => ({
      id: unico(`r:${r.id}`), nome: tx('A receber: {0}', r.nome), valor: centavos(r.valor), data: r.data ?? fim, aReceber: true, quem: r.nome,
      ...(r.data === null ? { semDia: true } : {}),
    }))
  return { qual, mes, hoje, fontes, guardados, aReceber, destinos }
}

/** O quadro com o dinheiro guardado e o que te devem entrando como barras, conforme a pessoa escolheu. */
export function comExtras(q: Quadro, usar: { guardado: boolean; aReceber: boolean }): Quadro {
  const sem = q.fontes.filter((f) => !f.guardado && !f.aReceber)
  return {
    ...q,
    fontes: [...sem, ...(usar.aReceber ? q.aReceber ?? [] : []), ...(usar.guardado ? q.guardados : [])],
  }
}

/** O quadro com o dinheiro guardado entrando como barras, quando a pessoa escolheu usar (o que te devem fica como está). */
export const comGuardado = (q: Quadro, usar: boolean): Quadro => comExtras(q, { guardado: usar, aReceber: q.fontes.some((f) => f.aReceber) })

/**
 * O que já aconteceu desde que o plano foi salvo: a entrada lançada (não vem mais como prevista) volta como "já caiu", e
 * a conta paga volta como "paga", com o valor que o plano dava a ela. Assim as fatias continuam onde estavam, travadas,
 * em vez de a conta voltar para a bandeja ou a entrada sumir. O dinheiro guardado não entra aqui (ele não "cai").
 */
export function comFeitos(q: Quadro, guardado: PlanoGuardado | undefined): Quadro {
  const fotos = guardado?.fotos
  if (!fotos || !guardado?.partes.length) return q
  const fontes = [...q.fontes], destinos = [...q.destinos]
  const usadas = new Set(guardado.partes.map((p) => p.entrada)), pagas = new Set(guardado.partes.map((p) => p.conta))
  for (const id of usadas) {
    const f = fotos.fontes[id]
    if (!f || fontes.some((x) => x.id === id) || id.startsWith('g:') || id.startsWith('saldo')) continue
    // o que te devem só volta com o interruptor ligado
    if (f.aReceber && !fontes.some((x) => x.aReceber)) continue
    fontes.push({ id, nome: f.nome, valor: centavos(f.valor), data: f.data, feito: true, ...(f.aReceber ? { aReceber: true, quem: f.quem } : {}) })
  }
  for (const id of pagas) {
    const d = fotos.destinos[id]
    if (!d || d.tipo !== 'conta' || destinos.some((x) => x.id === id)) continue
    const planejado = centavos(guardado.partes.filter((p) => p.conta === id).reduce((s, p) => s + p.valor, 0))
    destinos.push({
      id, nome: d.nome, tipo: 'conta', valor: centavos(Math.min(d.valor ?? planejado, planejado)), vence: d.vence, atrasada: false,
      juros: null, multa: 0, estimada: false, origem: 'conta', indice: destinos.length, feito: true,
    })
  }
  // conta paga em parte: continua prevista, mas menor que na foto. A diferença foi paga: vira a ficha irmã "<id>~pago",
  // travada como as pagas, e `valerPartes` passa para ela as primeiras fatias da conta (do dinheiro que cai antes).
  for (const id of pagas) {
    const d = fotos.destinos[id], x = destinos.find((y) => y.id === id)
    if (!d || d.valor === null || !x || x.feito || x.valor === null || d.valor - x.valor < 0.01) continue
    const planejado = centavos(guardado.partes.filter((p) => p.conta === id || p.conta === irmaPaga(id)).reduce((s, p) => s + p.valor, 0))
    const ja = destinos.find((y) => y.id === irmaPaga(id))
    const valor = centavos(Math.min(planejado, (ja?.valor ?? 0) + d.valor - x.valor))
    if (valor < 0.01) continue
    if (ja) ja.valor = valor
    else destinos.push({ ...x, id: irmaPaga(id), valor, atrasada: false, juros: null, multa: 0, estimada: false, juntas: undefined, feito: true })
  }
  return { ...q, fontes, destinos }
}

/** A parte já paga de uma conta paga em parte (ficha irmã, travada). */
export const irmaPaga = (id: string) => `${id}~pago`

/** O quadro como a pessoa deixou o plano deste mês (com ou sem o dinheiro guardado e o que te devem, e o que já foi feito). */
export const quadroDoPlano = (q: Quadro, guardado: PlanoGuardado | undefined) =>
  comFeitos(comExtras(q, { guardado: guardado?.comGuardado === true, aReceber: guardado?.comAReceber === true }), guardado)

/** As fotos para guardar com o plano: as entradas e as contas que têm fatia, como estão agora. */
export function fotosDe(q: Quadro, partes: Parte[]): Fotos {
  const fotos: Fotos = { fontes: {}, destinos: {} }
  for (const p of partes) {
    const f = fonteDe(q, p.entrada), d = destinoDe(q, p.conta)
    if (f && !f.saldo && !f.guardado) fotos.fontes[f.id] = { nome: f.nome, valor: f.valor, data: f.data, ...(f.aReceber ? { aReceber: true, quem: f.quem } : {}) }
    if (d && d.tipo === 'conta') fotos.destinos[d.id] = { nome: d.nome, valor: d.valor, vence: d.vence, tipo: d.tipo }
  }
  return fotos
}

/** A fatia não pode mudar: a conta já foi paga. */
export const travada = (q: Quadro, p: Parte) => Boolean(destinoDe(q, p.conta)?.feito)

/** Dinheiro guardado não vai para meta nem para "Guardar": já está guardado. */
const podeIr = (f: Fonte, d: Destino) => !(f.guardado && (d.tipo === 'meta' || d.tipo === 'guardar'))
/** Fatia nova: nem em conta já paga, nem em entrada que já caiu. */
const podeNova = (f: Fonte, d: Destino) => podeIr(f, d) && !f.feito && !d.feito

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
  if (!f || !d || !d.vence || d.atrasada || d.feito) return 0
  return Math.max(0, diasEntre(d.vence, f.data))
}

/** Multa e juros que a parte paga a mais por cair depois do vencimento (contando o atraso que já existe). */
export function custoDa(q: Quadro, p: Parte): number {
  const f = fonteDe(q, p.entrada), d = destinoDe(q, p.conta)
  if (!f || !d || !d.vence || d.tipo !== 'conta' || d.feito) return 0
  const dias = diasEntre(d.juntas?.venceMedio ?? d.vence, f.data)
  return dias > 0 ? custoDoAtraso(p.valor, dias, d.juros ?? 1, d.multa) : 0
}

/**
 * O plano guardado contra o quadro de agora: tira as partes cuja entrada ou conta sumiu (a conta foi paga, a entrada
 * mudou de dia) e encolhe as que passaram do valor (a conta ficou menor, a entrada também). Nunca cria parte.
 */
export function valerPartes(q: Quadro, partes: Parte[]): Parte[] {
  const certas: Parte[] = []
  const somar = (entrada: string, conta: string, valor: number) => {
    const ja = certas.find((x) => x.entrada === entrada && x.conta === conta)
    if (ja) ja.valor = centavos(ja.valor + valor)
    else certas.push({ entrada, conta, valor: centavos(valor) })
  }
  // do dinheiro que cai antes para o que cai depois: numa conta paga em parte, o que foi pago sai das primeiras fatias
  const data = (p: Parte) => fonteDe(q, p.entrada)?.data ?? '9'
  for (const p of [...partes].sort((a, b) => data(a).localeCompare(data(b)))) {
    const f = fonteDe(q, p.entrada), d = destinoDe(q, p.conta)
    if (!f || !d || !(p.valor > 0) || !podeIr(f, d)) continue
    let resto = p.valor
    const irma = destinoDe(q, irmaPaga(p.conta))
    if (irma) {
      const vai = Math.min(sobra(certas, f), falta(certas, irma), resto)
      if (vai >= 0.01) { somar(p.entrada, irma.id, vai); resto = centavos(resto - vai) }
    }
    const cabe = Math.min(sobra(certas, f), falta(certas, d), resto)
    if (cabe >= 0.01) somar(p.entrada, p.conta, cabe)
  }
  return certas
}

/** Põe o que cabe de uma conta numa entrada (soma à parte que já existe). Devolve as partes novas e quanto entrou. */
export function por(q: Quadro, partes: Parte[], conta: string, entrada: string, quanto?: number): { partes: Parte[]; valor: number } {
  const f = fonteDe(q, entrada), d = destinoDe(q, conta)
  if (!f || !d || !podeNova(f, d)) return { partes, valor: 0 }
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
  // conta paga não muda; entrada que já caiu só diminui
  if (!f || !d || d.feito) return p.valor
  if (f.feito) return p.valor
  const outras = partes.filter((x) => !(x.entrada === p.entrada && x.conta === p.conta))
  return centavos(Math.min(sobra(outras, f), d.valor === null ? Infinity : Math.max(0, d.valor - pago(outras, d))))
}

/** Troca o valor de uma parte (0 tira). */
export function mudarParte(q: Quadro, partes: Parte[], entrada: string, conta: string, valor: number): Parte[] {
  const p = partes.find((x) => x.entrada === entrada && x.conta === conta)
  if (!p || travada(q, p)) return partes
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
 * Com o dinheiro guardado ligado, ele só paga conta, e só o que o dinheiro do mês não paga a tempo (pagar atrasado custa
 * multa e juros; tirar do guardado, não). Não adianta dívida nem vai para meta: guardado fica guardado o quanto der.
 * O que te devem (ligado) vem depois do dinheiro certo: só paga conta que ele não cobre a tempo, porque pode não cair.
 */
export function montarPraMim(q: Quadro, antes: Parte[] = []): Parte[] {
  // o que já aconteceu fica: as fatias das contas pagas e das entradas que já caíram
  let partes: Parte[] = antes.filter((p) => travada(q, p) || fonteDe(q, p.entrada)?.feito)
  // o que te devem pode não cair: no automático só cobre conta, não adianta dívida nem vai para meta
  const doMes = q.fontes.filter((f) => !f.guardado && !f.aReceber)
  const contas = q.destinos.filter((d) => d.tipo === 'conta').sort(prioridade)
  for (const d of contas) {
    const fontes = [...q.fontes].sort((a, b) => {
      // o dinheiro certo que chega a tempo, depois o que te devem e chega a tempo, depois o guardado, e por fim o que atrasa
      const ordem = (f: Fonte) => (f.guardado ? 2 : !(d.atrasada || !d.vence || f.data <= d.vence) ? 3 : f.aReceber ? 1 : 0)
      return ordem(a) - ordem(b) || a.data.localeCompare(b.data)
    })
    for (const f of fontes) partes = por(q, partes, d.id, f.id).partes
  }
  for (const d of q.destinos.filter((x) => x.tipo === 'divida' && (x.juros ?? 0) >= JUROS_CARO)) {
    for (const f of doMes) partes = por(q, partes, d.id, f.id).partes
  }
  const guardar = q.destinos.find((x) => x.tipo === 'meta' || x.tipo === 'guardar')
  if (guardar) for (const f of doMes) partes = por(q, partes, guardar.id, f.id).partes
  return partes
}

// ---------- o placar ----------

export interface Placar {
  /** % das contas do mês com dinheiro (0 a 100). */
  pct: number
  coberto: number
  total: number
  /** Dinheiro das entradas ainda sem destino (não contam o guardado que não foi usado, que continua guardado, nem o que te devem). */
  semDestino: number
  /** Quanto o plano tira do dinheiro guardado. */
  doGuardado: number
  /** Quanto o plano conta com o dinheiro de quem te deve. */
  doAReceber: number
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
    semDestino: centavos(q.fontes.filter((f) => !f.guardado && !f.aReceber && !f.feito).reduce((s, f) => s + sobra(partes, f), 0)),
    doGuardado: centavos(q.fontes.filter((f) => f.guardado).reduce((s, f) => s + usado(partes, f), 0)),
    doAReceber: centavos(q.fontes.filter((f) => f.aReceber).reduce((s, f) => s + usado(partes, f), 0)),
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
  /** Um passo que a tela pode fazer pela pessoa: pôr uma conta numa entrada, ou ligar o dinheiro guardado. */
  acao?: { rotulo: string; conta: string; entrada: string } | { rotulo: string; usarGuardado: true } | { rotulo: string; usarAReceber: true }
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
  // 4) dinheiro sem destino (o guardado que não foi usado continua guardado: não conta)
  const semDestino = centavos(q.fontes.filter((f) => !f.guardado && !f.aReceber && !f.feito).reduce((s, f) => s + sobra(partes, f), 0))
  const faltam = contas.filter((d) => falta(partes, d) > 0.009)
  const usandoGuardado = q.fontes.some((f) => f.guardado)
  const totalGuardado = centavos(q.guardados.reduce((s, f) => s + f.valor, 0))
  const doGuardado = centavos(q.fontes.filter((f) => f.guardado).reduce((s, f) => s + usado(partes, f), 0))
  // o dinheiro do mês acabou e falta conta, mas há dinheiro guardado: oferecer usar
  if (!usandoGuardado && totalGuardado > 0.009 && faltam.length && semDestino <= 0.009) {
    dicas.push({
      id: 'usar-guardado', icone: 'cofre', tom: 'atencao',
      texto: tx('O dinheiro do mês acabou e faltam {0}. Você tem {1} guardado: dá para tirar de lá o que falta.', dinheiro(faltam.reduce((s, d) => s + falta(partes, d), 0), fmt), dinheiro(totalGuardado, fmt)),
      acao: { rotulo: tx('Usar o dinheiro guardado'), usarGuardado: true },
    })
  }
  // o dinheiro do mês acabou e falta conta, mas alguém te deve e deve pagar neste mês: oferecer contar com isso
  const usandoAReceber = q.fontes.some((f) => f.aReceber)
  const listaAReceber = q.aReceber ?? []
  const totalAReceber = centavos(listaAReceber.reduce((s, f) => s + f.valor, 0))
  if (!usandoAReceber && totalAReceber > 0.009 && faltam.length && semDestino <= 0.009) {
    dicas.push({
      id: 'usar-a-receber', icone: 'receber', tom: 'atencao',
      texto: tx('O dinheiro do mês acabou e faltam {0}. Te devem {1} para este mês: dá para contar com isso no plano.', dinheiro(faltam.reduce((s, d) => s + falta(partes, d), 0), fmt), dinheiro(totalAReceber, fmt)),
      acao: { rotulo: tx('Contar com quem me deve'), usarAReceber: true },
    })
  }
  const doAReceber = centavos(q.fontes.filter((f) => f.aReceber).reduce((s, f) => s + usado(partes, f), 0))
  if (doAReceber > 0.009) {
    const semDia = q.fontes.filter((f) => f.aReceber && f.semDia && usado(partes, f) > 0.009)
    dicas.push({
      id: 'conta-com-a-receber', icone: 'receber', tom: 'neutro',
      texto: semDia.length
        ? tx('O plano conta com {0} de quem te deve, e {1} não tem dia combinado (contei no fim do mês). Anote a promessa na dívida para o plano saber quando cai.', dinheiro(doAReceber, fmt), semDia[0].quem ?? semDia[0].nome)
        : tx('O plano conta com {0} de quem te deve. Se não cair no dia, essas contas ficam sem dinheiro: cobre antes do vencimento.', dinheiro(doAReceber, fmt)),
    })
  }
  if (doGuardado > 0.009) {
    dicas.push({
      id: 'tirou-do-guardado', icone: 'cofre', tom: 'neutro',
      texto: tx('O plano tira {0} do dinheiro guardado. Quando der, devolva para não ficar sem reserva para imprevistos.', dinheiro(doGuardado, fmt)),
    })
  }
  if (semDestino > 0.009) {
    const divida = q.destinos.find((d) => d.tipo === 'divida' && falta(partes, d) > 0.009)
    const guardar = q.destinos.find((d) => d.tipo === 'meta' || d.tipo === 'guardar')
    const alvo = faltam[0] ?? divida ?? guardar
    const fonte = q.fontes.find((f) => !f.guardado && !f.aReceber && !f.feito && sobra(partes, f) > 0.009)!
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
  else if (faltam.length && !semDestino && !caras.length && (usandoGuardado || totalGuardado <= 0.009) && (usandoAReceber || totalAReceber <= 0.009)) {
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
  q = quadroDoPlano(q, guardado)
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

/** O próximo dinheiro do plano que a pessoa montou e o que ela decidiu pagar com ele. */
export interface PassoDoPlano {
  fonte: { nome: string; data: string; valor: number; saldo: boolean }
  pagar: { nome: string; valor: number; tipo: TipoDestino; atrasa: boolean }[]
  total: number
}

/** O plano do mês como o Consultor lê: o placar e o próximo passo que a própria pessoa decidiu. null sem plano salvo. */
export interface LeituraDoPlano {
  placar: Placar
  /** O dinheiro mais cedo (de hoje em diante) que tem contas para pagar no plano. */
  proximo: PassoDoPlano | null
  partes: number
}

export function lerPlano(q: Quadro, guardado: PlanoGuardado | undefined): LeituraDoPlano | null {
  if (!guardado?.partes.length) return null
  const qq = quadroDoPlano(q, guardado)
  const partes = valerPartes(qq, guardado.partes)
  if (!partes.length) return null
  const placar = placarDe(qq, partes)
  const fontes = [...qq.fontes].filter((f) => !f.feito && (f.data >= qq.hoje || f.saldo)).sort((a, b) => a.data.localeCompare(b.data) || Number(Boolean(b.saldo)) - Number(Boolean(a.saldo)))
  let proximo: PassoDoPlano | null = null
  for (const f of fontes) {
    const dela = partes.filter((p) => p.entrada === f.id && !travada(qq, p))
    if (!dela.length) continue
    const pagar = dela.map((p) => {
      const d = destinoDe(qq, p.conta)!
      return { nome: d.nome, valor: p.valor, tipo: d.tipo, atrasa: atrasoDa(qq, p) > 0 }
    }).sort((a, b) => b.valor - a.valor)
    proximo = { fonte: { nome: f.nome, data: f.data, valor: f.valor, saldo: Boolean(f.saldo) }, pagar, total: centavos(pagar.reduce((s, x) => s + x.valor, 0)) }
    break
  }
  return { placar, proximo, partes: partes.length }
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
      ...((v as PlanoGuardado).comGuardado === true ? { comGuardado: true } : {}),
      ...((v as PlanoGuardado).comAReceber === true ? { comAReceber: true } : {}),
      ...(normFotos((v as PlanoGuardado).fotos) ?? {}),
      em: typeof (v as PlanoGuardado).em === 'string' ? (v as PlanoGuardado).em : '',
      partes: partes.filter((p) => p && typeof p.entrada === 'string' && typeof p.conta === 'string' && Number.isFinite(p.valor) && p.valor > 0)
        .map((p) => ({ entrada: p.entrada, conta: p.conta, valor: centavos(p.valor) })),
    }
  }
  return saida
}

/** As fotos guardadas, sem confiar no formato: fica só o que tem nome e valor. */
function normFotos(x: unknown): { fotos: Fotos } | null {
  if (!x || typeof x !== 'object') return null
  const { fontes, destinos } = x as Partial<Fotos>
  const fotos: Fotos = { fontes: {}, destinos: {} }
  for (const [id, f] of Object.entries(fontes && typeof fontes === 'object' ? fontes : {})) {
    if (f && typeof f.nome === 'string' && Number.isFinite(f.valor) && typeof f.data === 'string') {
      fotos.fontes[id] = { nome: f.nome, valor: centavos(f.valor), data: f.data, ...(f.aReceber === true ? { aReceber: true, quem: typeof f.quem === 'string' ? f.quem : undefined } : {}) }
    }
  }
  for (const [id, d] of Object.entries(destinos && typeof destinos === 'object' ? destinos : {})) {
    if (d && typeof d.nome === 'string' && (d.valor === null || Number.isFinite(d.valor)) && d.tipo === 'conta') {
      fotos.destinos[id] = { nome: d.nome, valor: d.valor === null ? null : centavos(d.valor), vence: typeof d.vence === 'string' ? d.vence : null, tipo: 'conta' }
    }
  }
  return Object.keys(fotos.fontes).length || Object.keys(fotos.destinos).length ? { fotos } : null
}
