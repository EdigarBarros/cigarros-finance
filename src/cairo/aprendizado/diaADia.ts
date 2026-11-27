/**
 * O ritmo do gasto do dia a dia da pessoa, aprendido dia a dia (não pela média do mês ÷ 30,4).
 *
 *  - Cada dia de um mês bem registrado é uma observação, inclusive os dias sem gasto (o zero também é hábito).
 *  - Peso de cada dia: atualidade (meia-vida) × mudança de comportamento (o que veio antes de uma quebra pesa menos).
 *  - Dia da semana: para sortear um dia futuro, os dias do mesmo dia da semana pesam mais; quanto menos sábados no histórico,
 *    mais o sábado "pega emprestado" dos outros dias (λ = k / (k + massa do mesmo dia da semana)).
 *  - Pico depois de uma entrada: se o gasto sobe nos dias seguintes a uma entrada, o fator aprendido (puxado para 1, "sem
 *    efeito", na medida da evidência) multiplica esses dias nos cenários.
 *
 * O sorteio repete dias reais da pessoa (reamostragem): guarda os dias de gasto alto e os de zero, sem supor curva normal.
 */
import { REGRAS } from '../contrato/politicas'
import type { Motivo, Parametro } from '../contrato/tipos'
import { diaDaSemana, diasNoMes, doNumero, mesDaChave, numero, type DiaISO } from '../contrato/unidades'
import type { Historico } from '../fatos/historico'
import type { Sorteio } from './aleatorio'
import { massa, nEfetivo, pesoDoHistorico, pesoPorIdade, suavizar, type Obs } from './evidencia'
import { detectarQuebra, type Quebra } from './quebras'

export interface DiaObservado { dia: DiaISO; valor: number; peso: number; semana: number; aposEntrada: boolean }

export interface ModeloDiaADia {
  dias: DiaObservado[]
  /** Média por dia (centavos), já com pesos. */
  mediaDiaria: Parametro<number>
  /** Fator do gasto nos dias logo depois de uma entrada (1 = sem efeito). */
  picoAposEntrada: Parametro<number>
  /** Mudança no nível mensal do dia a dia (centavos por dia), se houver. */
  quebra: (Quebra & { mes: string }) | null
  nEf: number
  /** Sorteia o gasto de um dia futuro (centavos, antes do fator do pico). */
  sortear(dia: DiaISO, r: Sorteio): number
  motivos: Motivo[]
}

/** Dias (números) com entrada de renda relevante: pelo menos 30% da mediana mensal de renda. */
function diasDeEntrada(h: Historico): Set<number> {
  const porMes = new Map<number, number>()
  for (const l of h.lancs) if (l.classe === 'renda') porMes.set(l.chave, (porMes.get(l.chave) ?? 0) + l.valor)
  const ms = [...porMes.values()].sort((a, b) => a - b)
  const med = ms.length ? ms[Math.floor(ms.length / 2)] : 0
  const out = new Set<number>()
  for (const l of h.lancs) if (l.classe === 'renda' && l.dia && l.valor >= 0.3 * med) out.add(numero(l.dia))
  return out
}

export function aprenderDiaADia(h: Historico): ModeloDiaADia | null {
  const motivos: Motivo[] = []
  const hojeN = numero(h.hoje)
  // meses que entram: fechados com gastos bem registrados, e o atual até ontem
  const chavesOk = new Set(h.fechados.filter((_, i) => h.qualidade[i].gastos === 'conta'))
  chavesOk.add(h.atual)
  const porDia = new Map<number, number>()
  const semData = new Map<number, number>()
  for (const l of h.lancs) {
    if (!l.diaADia || !chavesOk.has(l.chave)) continue
    if (l.dia) {
      const n = numero(l.dia)
      if (n >= hojeN) continue
      porDia.set(n, (porDia.get(n) ?? 0) + l.valor)
    } else semData.set(l.chave, (semData.get(l.chave) ?? 0) + l.valor)
  }
  const entradas = diasDeEntrada(h)
  const janela = REGRAS.janelaAposEntrada.valor
  const aposEntrada = (n: number) => { for (let i = 0; i < janela; i++) if (entradas.has(n - i)) return true; return false }

  // série mensal (por dia, para comparar meses de tamanhos diferentes) e a quebra
  const chavesOrdenadas = [...chavesOk].filter((k) => k !== h.atual).sort((a, b) => a - b)
  const serie: { chave: number; porDia: number }[] = chavesOrdenadas.map((k) => {
    const m = mesDaChave(k)
    const a = Number(m.slice(0, 4)); const me = Number(m.slice(5, 7))
    const ini = numero(`${m}-01` as DiaISO)
    const nd = diasNoMes(a, me)
    let s = semData.get(k) ?? 0
    for (let d = 0; d < nd; d++) s += porDia.get(ini + d) ?? 0
    return { chave: k, porDia: s / nd }
  })
  const q = detectarQuebra(serie.map((x) => x.porDia))
  const quebraEm = q ? numero(`${mesDaChave(serie[q.inicio].chave)}-01` as DiaISO) : null
  if (q) motivos.push({ codigo: 'dia-a-dia.mudou', params: { mes: mesDaChave(serie[q.inicio].chave), antes: Math.round(q.antes), depois: Math.round(q.depois) }, refs: [], regras: [REGRAS.quebraLimiar.id, REGRAS.pesoAntesDaQuebra.id] })

  const dias: DiaObservado[] = []
  for (const k of chavesOk) {
    const m = mesDaChave(k)
    const a = Number(m.slice(0, 4)); const me = Number(m.slice(5, 7))
    const ini = numero(`${m}-01` as DiaISO)
    const nd = diasNoMes(a, me)
    // sem data: espalhado pelos dias do mês (é gasto de verdade, só não se sabe o dia)
    const extra = (semData.get(k) ?? 0) / nd
    for (let d = 0; d < nd; d++) {
      const n = ini + d
      if (n >= hojeN) break
      const valor = (porDia.get(n) ?? 0) + extra
      const peso = pesoPorIdade(hojeN - n) * (quebraEm !== null && n < quebraEm ? REGRAS.pesoAntesDaQuebra.valor : 1)
      dias.push({ dia: doNumero(n), valor, peso, semana: diaDaSemana(doNumero(n)), aposEntrada: aposEntrada(n) })
    }
  }
  const obs: Obs[] = dias.map((d) => ({ valor: d.valor, peso: d.peso }))
  if (massa(obs) < REGRAS.diaADiaMinimoDias.valor) return null

  const media = obs.reduce((s, o) => s + o.valor * o.peso, 0) / massa(obs)
  const k = REGRAS.forcaDaReferencia.valor
  // o pico: média nos dias depois de entrada ÷ média geral, puxado para 1
  const apos = dias.filter((d) => d.aposEntrada)
  const razoes: Obs[] = media > 0 ? apos.map((d) => ({ valor: d.valor / media, peso: d.peso })) : []
  // cada janela de dias depois de uma entrada é UMA observação do efeito, não três
  const pico = suavizar(razoes.map((o) => ({ ...o, peso: o.peso / janela })), 1, k)
  const porSemana = Array.from({ length: 7 }, (_, s) => massa(obs.filter((_, i) => dias[i].semana === s)))
  const lambda = porSemana.map((m) => k / (k + m))

  const nEf = nEfetivo(obs)
  // somas acumuladas dos pesos por dia da semana, para sortear em O(log n)
  const acumulados = Array.from({ length: 7 }, (_, s) => {
    let acc = 0
    return dias.map((x) => (acc += x.peso * (x.semana === s ? 1 : lambda[s])))
  })
  const base = dias.map((d) => (d.aposEntrada && pico.valor > 0 ? d.valor / pico.valor : d.valor))
  return {
    dias,
    mediaDiaria: { id: 'dia-a-dia.media', valor: media, referencia: media, nEf, pesoDoHistorico: pesoDoHistorico(massa(obs), k), metodo: 'media-ponderada' },
    picoAposEntrada: { id: 'dia-a-dia.pico-apos-entrada', valor: pico.valor, referencia: 1, nEf: pico.nEf, pesoDoHistorico: pico.pesoDoHistorico, metodo: 'suavizado' },
    quebra: q ? { ...q, mes: mesDaChave(serie[q.inicio].chave) } : null,
    nEf,
    motivos,
    // o dia sorteado vem sem o efeito da entrada (dividido pelo pico): quem sabe se o dia futuro é depois de uma entrada
    // é o cenário, que multiplica de volta
    sortear(dia: DiaISO, r: Sorteio) {
      const acc = acumulados[diaDaSemana(dia)]
      const alvo = r() * acc[acc.length - 1]
      let lo = 0; let hi = acc.length - 1
      while (lo < hi) { const m = (lo + hi) >> 1; if (acc[m] > alvo) hi = m; else lo = m + 1 }
      return base[lo]
    },
  }
}
