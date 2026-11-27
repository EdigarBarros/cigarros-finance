/**
 * Quando a renda cai de verdade: para cada fonte que se repete (conta fixa de entrada, ou entrada que aparece todo mês com
 * a mesma descrição), o atraso em dias contra o dia combinado e a chance de não vir no mês.
 *
 * A referência é "cai no dia e sempre vem" (regras aprendizado.atraso-renda.prior e aprendizado.falta-renda.prior). Cada
 * mês observado vai pesando o histórico. Mês mal registrado não ensina: não dá para saber se a renda faltou ou se faltou
 * lançar.
 */
import { REGRAS } from '../contrato/politicas'
import type { Distribuicao, Estimativa } from '../contrato/tipos'
import { mesDaChave, noDiaDoMes, numero, type DiaISO, type MesISO } from '../contrato/unidades'
import type { ContaFixaBruta } from '../entrada'
import { chaveDescricao, contaValeNoMes, type Historico } from '../fatos/historico'
import { recorrencias } from '../fatos/recorrencias'
import { pesoDoHistorico, pesoPorIdade, proporcao, quantilPonderado, type Obs } from './evidencia'
import type { Sorteio } from './aleatorio'

export interface FonteDeRenda {
  /** 'conta:<id>' ou 'desc:<chave da descrição>'. */
  chave: string
  descricao: string
  /** O dia do mês combinado (ou o dia típico, na detectada). */
  diaPrevisto: number
  origem: 'conta_fixa' | 'detectada'
  /** Atraso em dias contra o dia combinado (negativo: veio antes). */
  atraso: Estimativa<number>
  /** Chance de não vir no mês. */
  pNaoOcorre: number
  meses: number
  /** Sorteia o atraso e se vem, com a referência pesando na medida da evidência. */
  sortear(r: Sorteio): { atraso: number; vem: boolean }
}

const CAL = { versao: 'sem-calibracao', cobertura80: null }

function montarFonte(chave: string, descricao: string, diaPrevisto: number, origem: FonteDeRenda['origem'], atrasos: Obs[], faltas: Obs[], conhecidos: number): FonteDeRenda {
  const prior = REGRAS.atrasoDeRendaPrior.valor
  const pf = REGRAS.faltaDeRendaPrior.valor
  const mAtr = atrasos.reduce((a, o) => a + o.peso, 0)
  const p = pesoDoHistorico(mAtr, prior.forca)
  const vezes = atrasos.length + faltas.length
  const falta = proporcao(faltas.length, vezes, pf.media, pf.forca)
  const q = (x: number) => {
    const emp = quantilPonderado(atrasos, x)
    // mistura: com peso p o histórico, com 1 - p a referência (cai no dia)
    return emp === null ? prior.dias : Math.round(p * emp + (1 - p) * prior.dias)
  }
  const dist: Distribuicao<number> = { quantis: { p10: q(0.1), p50: q(0.5), p90: q(0.9) }, pNaoOcorre: falta.p, calibracao: CAL }
  return {
    chave, descricao, diaPrevisto, origem, meses: conhecidos, pNaoOcorre: falta.p,
    atraso: { tipo: 'estimativa', dist, prov: { refs: [], conhecidoEm: null, atualizadoEm: null }, metodo: 'suavizado', nEf: mAtr, pesoDoHistorico: p },
    sortear(r: Sorteio) {
      const vem = r() >= falta.p
      if (!atrasos.length || r() >= p) return { atraso: prior.dias, vem }
      const emp = quantilPonderado(atrasos, r())
      return { atraso: emp ?? prior.dias, vem }
    },
  }
}

export function aprenderEntradas(h: Historico, contas: ContaFixaBruta[]): FonteDeRenda[] {
  const hojeN = numero(h.hoje)
  const fontes: FonteDeRenda[] = []
  const qualidadePorChave = new Map(h.fechados.map((k, i) => [k, h.qualidade[i]]))
  const mesBemRegistrado = (k: number) => {
    const q = qualidadePorChave.get(k)
    return Boolean(q && q.gastos === 'conta' && (q.renda === 'conta' || q.renda === 'zero_real'))
  }

  // 1. contas fixas de entrada, pela baixa (o lançamento ligado à conta)
  for (const c of contas.filter((x) => x.tipo === 'entrada' && x.ativa)) {
    const atrasos: Obs[] = []
    const faltas: Obs[] = []
    let conhecidos = 0
    for (const k of h.fechados) {
      const m = mesDaChave(k)
      if (!contaValeNoMes(c, m)) continue
      const previsto = noDiaDoMes(m, c.dia)
      const peso = pesoPorIdade(hojeN - numero(previsto))
      const baixas = h.lancs.filter((l) => l.contaFixa === c.id && l.chave === k && l.dia)
      if (baixas.length) {
        conhecidos++
        const primeiro = baixas.map((l) => l.dia!).sort()[0]
        atrasos.push({ valor: numero(primeiro) - numero(previsto), peso })
      } else if (mesBemRegistrado(k) && !h.lancs.some((l) => l.contaFixa === c.id && l.chave === k)) {
        conhecidos++
        faltas.push({ valor: 1, peso })
      }
    }
    fontes.push(montarFonte(`conta:${c.id}`, c.descricao, c.dia, 'conta_fixa', atrasos, faltas, conhecidos))
  }

  // 2. entradas que se repetem pela descrição, sem conta fixa (fatos/recorrencias.ts)
  const repetem = new Set(recorrencias(h.lancs, h.atual, 'entrada').map((r) => r.chave))
  const porChave = new Map<string, { k: number; dia: DiaISO; descricao: string }[]>()
  for (const l of h.lancs) if (l.classe === 'renda' && !l.contaFixa && l.dia && repetem.has(l.chaveDescricao)) {
    const xs = porChave.get(l.chaveDescricao) ?? []
    xs.push({ k: l.chave, dia: l.dia, descricao: l.descricao })
    porChave.set(l.chaveDescricao, xs)
  }
  const nomesDeContas = new Set(contas.filter((c) => c.tipo === 'entrada').map((c) => chaveDescricao(c.descricao)))
  for (const [chave, xs] of porChave) {
    const meses = new Set(xs.map((x) => x.k))
    if (nomesDeContas.has(chave)) continue
    // o dia típico: a mediana do dia do mês da primeira entrada de cada mês
    const primeiros = [...meses].map((k) => xs.filter((x) => x.k === k).map((x) => x.dia).sort()[0])
    const diasDoMes = primeiros.map((d) => Number(d.slice(8, 10))).sort((a, b) => a - b)
    const diaTipico = diasDoMes[Math.floor(diasDoMes.length / 2)]
    const atrasos: Obs[] = primeiros.map((d) => {
      const previsto = noDiaDoMes(d.slice(0, 7) as MesISO, diaTipico)
      return { valor: numero(d) - numero(previsto), peso: pesoPorIdade(hojeN - numero(d)) }
    })
    // meses bem registrados, depois da primeira vez, em que não veio
    const desde = Math.min(...meses)
    const faltas: Obs[] = h.fechados.filter((k) => k > desde && !meses.has(k) && mesBemRegistrado(k))
      .map((k) => ({ valor: 1, peso: pesoPorIdade(hojeN - numero(noDiaDoMes(mesDaChave(k), diaTipico))) }))
    fontes.push(montarFonte(`desc:${chave}`, xs[xs.length - 1].descricao, diaTipico, 'detectada', atrasos, faltas, meses.size + faltas.length))
  }
  return fontes
}

/** A fonte de um compromisso de entrada da agenda (pela conta fixa ou pela descrição). */
export function fonteDoCompromisso(fontes: FonteDeRenda[], descricao: string, contas: ContaFixaBruta[]): FonteDeRenda | null {
  const ch = chaveDescricao(descricao)
  const conta = contas.find((c) => c.tipo === 'entrada' && chaveDescricao(c.descricao) === ch)
  if (conta) return fontes.find((f) => f.chave === `conta:${conta.id}`) ?? null
  return fontes.find((f) => f.chave === `desc:${ch}`) ?? null
}

