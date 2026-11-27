/**
 * Avaliação por consequências: mundos sintéticos (com semente) executados dia a dia. Em cada dia, a política só vê o que dá
 * para saber naquele dia (`visaoNoDia`): o dinheiro que já caiu, as entradas previstas que ainda não caíram (na data
 * prevista, ou amanhã se já passou), as contas combinadas e os imprevistos que já aconteceram. Ela decide o que pagar hoje,
 * e o mundo responde: a entrada cai (ou atrasa, ou não vem), o imprevisto aparece, o dia a dia gasta.
 *
 * Duas políticas, o mesmo motor (lib/planejador.ts):
 *  - antiga: o planejador como era (paga primeiro o que cobra mais caro pelo atraso, sem reservar o essencial);
 *  - nova: protege as contas essenciais e o essencial do dia a dia até o próximo dinheiro.
 *
 * O placar mede a gravidade, não só a média: dias com conta essencial atrasada, dias sem dinheiro para o essencial do dia,
 * contas atrasadas, multa e juros, contas que ficaram sem pagar, cautela (conta atrasada com dinheiro parado que dava para
 * ela), alarmes falsos e riscos não avisados no primeiro dia.
 *
 * São mundos inventados: provam que a política faz o que promete nas regras deles, não que o mundo real é assim. Resultado
 * melhor aqui não é prova de causa no mundo real.
 */
import { custoDoAtraso, MULTA_PADRAO, planejar, simularPagamentos, type Compromisso, type EntradaPlanejador } from '../../src/lib/planejador'

export interface ContaDoMundo { id: string; descricao: string; valor: number; vence: string; essencial: boolean; origem: Compromisso['origem']; jurosMes: number | null }
export interface EntradaDoMundo { descricao: string; valor: number; prevista: string; /** null: não vem. */ cai: string | null }
export interface Mundo {
  hoje: string
  fim: string
  saldo: number
  ritmoDia: number
  essencialDia: number
  contas: ContaDoMundo[]
  entradas: EntradaDoMundo[]
  imprevistos: { data: string; valor: number }[]
}

const utc = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)))
const maisDias = (iso: string, n: number) => new Date(utc(iso) + n * 86400000).toISOString().slice(0, 10)
const diasEntre = (a: string, b: string) => Math.round((utc(b) - utc(a)) / 86400000)
const centavos = (n: number) => Math.round(n * 100) / 100

/** O que dá para saber no fim do dia `dia` (depois de ver o que caiu nele). Não depende de nada que vem depois. */
export function visaoNoDia(m: Mundo, dia: string) {
  const caidas = m.entradas.filter((x) => x.cai !== null && x.cai <= dia).map((x) => ({ descricao: x.descricao, valor: x.valor, cai: x.cai! }))
  const previstas = m.entradas.filter((x) => !(x.cai !== null && x.cai <= dia))
    .map((x) => ({ descricao: x.descricao, valor: x.valor, data: x.prevista > dia ? x.prevista : maisDias(dia, 1) }))
  const imprevistos = m.imprevistos.filter((x) => x.data <= dia)
  return { caidas, previstas, contas: m.contas, imprevistos }
}

export type Politica = 'antiga' | 'nova' | 'so-ordem' | 'so-reserva'

export interface Placar {
  diasEssencialAtrasado: number
  diasContaAtrasada: number
  contasAtrasadas: number
  essenciaisAtrasadas: number
  naoPagas: number
  essenciaisNaoPagas: number
  diasSemEssencialDoDia: number
  custo: number
  diasDeCautela: number
  /** O plano do primeiro dia previu atraso e nada atrasou. */
  alarmeFalso: number
  /** Nada previsto (nem como "e se") e algo atrasou. */
  riscoNaoAvisado: number
  /** Só o "e se" avisou, e nada atrasou (aviso condicional, não alarme). */
  condicionalSemOcorrer: number
  /** Só o "e se" avisou, e atrasou. */
  condicionalQueOcorreu: number
}

const vazio = (): Placar => ({
  diasEssencialAtrasado: 0, diasContaAtrasada: 0, contasAtrasadas: 0, essenciaisAtrasadas: 0, naoPagas: 0, essenciaisNaoPagas: 0,
  diasSemEssencialDoDia: 0, custo: 0, diasDeCautela: 0, alarmeFalso: 0, riscoNaoAvisado: 0, condicionalSemOcorrer: 0, condicionalQueOcorreu: 0,
})

/** A entrada do planejador que a política monta com o que sabe no dia. */
function entradaNoDia(m: Mundo, dia: string, caixa: number, pendentes: ContaDoMundo[], politica: Politica): EntradaPlanejador {
  const v = visaoNoDia(m, dia)
  return {
    hoje: dia, fim: m.fim, saldoInicial: centavos(caixa), ritmoDia: m.ritmoDia, porDiaDoMes: null, gastouHoje: 0, abertas: [], cenarios: [],
    essencialDia: politica === 'nova' || politica === 'so-reserva' ? m.essencialDia : 0,
    entradas: v.previstas.map((x) => ({ data: x.data, valor: x.valor, descricao: x.descricao })),
    compromissos: pendentes.map((c) => ({ descricao: c.descricao, valor: c.valor, vence: c.vence, origem: c.origem, jurosMes: c.jurosMes, ...((politica === 'nova' || politica === 'so-ordem') && c.essencial ? { essencial: true } : {}) })),
  }
}

export function executar(m: Mundo, politica: Politica) {
  const placar = vazio()
  let caixa = m.saldo
  const pendentes: ContaDoMundo[] = [...m.contas]
  const decisoes: { dia: string; pagar: string[] }[] = []
  const atrasou = new Set<string>()
  // o aviso do primeiro dia: o plano previu atraso (ou, na nova, um "e se" que atrasa)?
  // o "e se" da nova: o atraso que o Cairo aprenderia destes mundos (o salário atrasa até 3 dias em 9 de cada 10 meses),
  // passado como dado de teste, do mesmo jeito que lib/decisoes/cenarios.ts passa o aprendido
  const salario = m.entradas.find((x) => x.descricao.startsWith('Salário'))
  const cenarios = politica === 'nova' && salario ? [{ id: 'atraso', origem: 'previsao' as const, premissa: '', adiar: { dias: 3, descricao: salario.descricao } }] : []
  const primeira = planejar({ ...entradaNoDia(m, m.hoje, caixa, pendentes, politica), cenarios })
  const previu = primeira.atrasos > 0
  const condicional = !previu && Boolean(primeira.estresse?.some((r) => r.novasAtrasadas.length))

  for (let dia = m.hoje; dia <= m.fim; dia = maisDias(dia, 1)) {
    for (const x of m.entradas) if (x.cai === dia) caixa += x.valor
    for (const x of m.imprevistos) if (x.data === dia) pendentes.push({ id: `imp:${dia}`, descricao: 'Imprevisto', valor: x.valor, vence: dia, essencial: true, origem: 'lancamento', jurosMes: 0 })
    const e = entradaNoDia(m, dia, caixa, pendentes, politica)
    const r = simularPagamentos(e, { semPolitica: politica === 'antiga' || politica === 'so-reserva' })
    const hoje = r.pagamentos.filter((p) => p.pagarEm === dia)
    const pagos: string[] = []
    for (const p of hoje) {
      const c = pendentes.find((x) => x.descricao === p.descricao && x.vence === p.vence)
      if (!c) continue
      const atraso = Math.max(0, diasEntre(c.vence, dia))
      const custo = custoDoAtraso(c.valor, atraso, p.taxaMes, MULTA_PADRAO)
      if (caixa < c.valor + custo - 0.005) continue
      caixa -= c.valor + custo
      placar.custo += custo
      pendentes.splice(pendentes.indexOf(c), 1)
      pagos.push(c.descricao)
    }
    decisoes.push({ dia, pagar: pagos })
    for (const c of pendentes) if (c.vence < dia) {
      placar.diasContaAtrasada++
      if (c.essencial) placar.diasEssencialAtrasado++
      if (!atrasou.has(c.id)) { atrasou.add(c.id); placar.contasAtrasadas++; if (c.essencial) placar.essenciaisAtrasadas++ }
      if (caixa >= c.valor + custoDoAtraso(c.valor, diasEntre(c.vence, dia), c.jurosMes ?? 14, MULTA_PADRAO)) placar.diasDeCautela++
    }
    // o dia a dia: o essencial sai sempre (se não tem, faltou); o resto, só se houver dinheiro
    if (caixa < m.essencialDia - 0.005) placar.diasSemEssencialDoDia++
    caixa -= m.essencialDia
    caixa -= Math.max(0, Math.min(m.ritmoDia - m.essencialDia, caixa))
  }
  for (const c of pendentes) {
    placar.naoPagas++
    if (c.essencial) placar.essenciaisNaoPagas++
    placar.custo += custoDoAtraso(c.valor, Math.max(0, diasEntre(c.vence, m.fim)), c.jurosMes ?? 14, MULTA_PADRAO)
  }
  const aconteceu = placar.contasAtrasadas > 0 || placar.naoPagas > 0
  if (previu && !aconteceu) placar.alarmeFalso = 1
  if (!previu && !condicional && aconteceu) placar.riscoNaoAvisado = 1
  if (condicional) placar[aconteceu ? 'condicionalQueOcorreu' : 'condicionalSemOcorrer'] = 1
  placar.custo = centavos(placar.custo)
  return { placar, decisoes }
}

/** Sorteio com semente (mulberry32): o mesmo número de mundos e a mesma semente dão o mesmo placar. */
function sorteio(semente: number) {
  let a = semente >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function mundoSorteado(r: () => number): Mundo {
  const entre = (a: number, b: number) => a + (b - a) * r()
  const inteiro = (a: number, b: number) => Math.floor(entre(a, b + 1))
  const salario = Math.round(entre(2000, 4000))
  const contas: ContaDoMundo[] = []
  const entradas: EntradaDoMundo[] = []
  const atrasoDoSalario = () => { const x = r(); return x < 0.7 ? 0 : x < 0.9 ? inteiro(1, 3) : inteiro(4, 7) }
  const aluguel = Math.round(salario * entre(0.3, 0.45))
  const fatura = Math.round(salario * entre(0.2, 0.6))
  for (const [ano, mes] of [[2026, 11], [2026, 12]] as const) {
    const dia = (d: number) => `${ano}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const prev = dia(5)
    entradas.push({ descricao: `Salário ${mes}`, valor: salario, prevista: prev, cai: maisDias(prev, atrasoDoSalario()) })
    if (r() < 0.3) {
      const prevista = dia(inteiro(12, 25))
      entradas.push({ descricao: `Freela ${mes}`, valor: Math.round(entre(300, 800)), prevista, cai: r() < 0.3 ? null : maisDias(prevista, inteiro(0, 5)) })
    }
    contas.push({ id: `alu${mes}`, descricao: `Aluguel ${mes}`, valor: aluguel, vence: dia(inteiro(6, 10)), essencial: true, origem: 'conta', jurosMes: null })
    contas.push({ id: `luz${mes}`, descricao: `Luz ${mes}`, valor: Math.round(entre(100, 300)), vence: dia(inteiro(10, 20)), essencial: true, origem: 'conta', jurosMes: null })
    contas.push({ id: `net${mes}`, descricao: `Internet ${mes}`, valor: 100, vence: dia(15), essencial: false, origem: 'conta', jurosMes: null })
    contas.push({ id: `fat${mes}`, descricao: `Fatura ${mes}`, valor: fatura, vence: dia(inteiro(8, 15)), essencial: false, origem: 'cartao', jurosMes: null })
    if (r() < 0.5) contas.push({ id: `emp${mes}`, descricao: `Empréstimo ${mes}`, valor: Math.round(entre(200, 500)), vence: dia(20), essencial: false, origem: 'parcela', jurosMes: Math.round(entre(5, 10)) })
  }
  const ritmoDia = Math.round((salario * entre(0.12, 0.3)) / 30)
  return {
    hoje: '2026-11-01', fim: '2026-12-31', saldo: Math.round(entre(0, 1500)), ritmoDia, essencialDia: Math.round(ritmoDia * 0.6),
    contas, entradas, imprevistos: r() < 0.25 ? [{ data: `2026-11-${String(inteiro(2, 28)).padStart(2, '0')}`, valor: Math.round(entre(100, 800)) }] : [],
  }
}

/** Um mundo pequeno, para o teste de não olhar o futuro. */
export function cenarioDeExemplo(o: { salarioCai: string }): Mundo {
  return {
    hoje: '2026-11-01', fim: '2026-11-30', saldo: 300, ritmoDia: 30, essencialDia: 20,
    entradas: [{ descricao: 'Salário', valor: 2500, prevista: '2026-11-10', cai: o.salarioCai }],
    contas: [
      { id: 'a', descricao: 'Aluguel', valor: 1000, vence: '2026-11-11', essencial: true, origem: 'conta', jurosMes: null },
      { id: 'f', descricao: 'Fatura', valor: 600, vence: '2026-11-08', essencial: false, origem: 'cartao', jurosMes: null },
      { id: 'n', descricao: 'Internet', valor: 100, vence: '2026-11-03', essencial: false, origem: 'conta', jurosMes: null },
    ],
    imprevistos: [],
  }
}

export function avaliar(n: number, semente: number) {
  const r = sorteio(semente)
  const soma = { antiga: vazio(), nova: vazio(), 'so-ordem': vazio(), 'so-reserva': vazio() }
  let melhorEssencial = 0, piorEssencial = 0, maisCaro = 0, maisBarato = 0
  for (let i = 0; i < n; i++) {
    const m = mundoSorteado(r)
    const a = executar(m, 'antiga').placar
    const b = executar(m, 'nova').placar
    const o = executar(m, 'so-ordem').placar
    const rs = executar(m, 'so-reserva').placar
    for (const k of Object.keys(a) as (keyof Placar)[]) { soma.antiga[k] += a[k]; soma.nova[k] += b[k]; soma['so-ordem'][k] += o[k]; soma['so-reserva'][k] += rs[k] }
    if (b.diasEssencialAtrasado < a.diasEssencialAtrasado) melhorEssencial++
    if (b.diasEssencialAtrasado > a.diasEssencialAtrasado) piorEssencial++
    if (b.custo > a.custo + 0.005) maisCaro++
    if (b.custo < a.custo - 0.005) maisBarato++
  }
  const arred = (p: Placar) => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, centavos(v)])) as unknown as Placar
  return {
    mundos: n, semente, antiga: arred(soma.antiga), nova: arred(soma.nova),
    /** De onde vem cada efeito: só a ordem do essencial, ou só a reserva do dia a dia. */
    decomposicao: { soOrdem: arred(soma['so-ordem']), soReserva: arred(soma['so-reserva']) },
    mundosEmQueANovaProtegeMaisOEssencial: melhorEssencial, mundosEmQueANovaProtegeMenos: piorEssencial,
    mundosEmQueANovaCustaMais: maisCaro, mundosEmQueANovaCustaMenos: maisBarato,
  }
}
