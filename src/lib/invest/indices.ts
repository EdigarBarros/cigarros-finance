/**
 * Índices de referência (CDI, Selic e IPCA) para duas coisas: estimar quanto um título de renda fixa rendeu pela taxa
 * contratada e comparar a carteira com o CDI.
 *
 * As séries são as oficiais do Banco Central (Sistema Gerenciador de Séries Temporais, aberto e sem chave): 12 = CDI ao
 * dia, 11 = Selic ao dia, 433 = IPCA do mês. Só a data inicial vai na consulta: nenhum dado da pessoa sai do aparelho.
 * Ficam guardadas no navegador por 12 h; sem internet, vale o que já foi baixado, e o que depende de um índice que falta
 * simplesmente não é estimado (o app mostra o último valor conhecido e diz de quando é).
 *
 * As contas (`fator`) são puras e determinísticas: mesmas séries, mesmo resultado.
 */
import { useEffect, useState } from 'react'
import type { Indexador } from './tipos'

/** Série diária: os dias úteis em ordem e as somas acumuladas da taxa do dia (r, r² e r³) para compor qualquer % do índice. */
export interface SerieDiaria { datas: string[]; s1: number[]; s2: number[]; s3: number[] }
/** Série mensal: 'AAAA-MM' → variação do mês (0.0042 = 0,42%). */
export type SerieMensal = Record<string, number>
export interface Indices { cdi?: SerieDiaria; selic?: SerieDiaria; ipca?: SerieMensal; baixadoEm?: number }

const DIA = 86400000
const iso = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
const dataDe = (s: string) => new Date(`${s}T00:00:00Z`)
/** Dias corridos de `de` até `ate` (AAAA-MM-DD). */
export const diasEntre = (de: string, ate: string) => Math.round((dataDe(ate).getTime() - dataDe(de).getTime()) / DIA)
export const somarDias = (data: string, n: number) => iso(new Date(dataDe(data).getTime() + n * DIA))
export const somarMeses = (data: string, n: number) => {
  const d = dataDe(data)
  const dia = d.getUTCDate()
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() + n)
  d.setUTCDate(Math.min(dia, new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()))
  return iso(d)
}
export const fimDoMesDe = (data: string) => {
  const d = dataDe(data)
  return iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)))
}

/** Monta a série diária a partir dos pares [dia, taxa do dia em fração]. */
export function serieDiaria(pontos: [string, number][]): SerieDiaria {
  const ordenados = [...pontos].filter(([d, r]) => /^\d{4}-\d{2}-\d{2}$/.test(d) && Number.isFinite(r)).sort((a, b) => (a[0] < b[0] ? -1 : 1))
  const s: SerieDiaria = { datas: [], s1: [], s2: [], s3: [] }
  let [a, b, c] = [0, 0, 0]
  for (const [d, r] of ordenados) {
    if (s.datas[s.datas.length - 1] === d) continue
    a += r; b += r * r; c += r * r * r
    s.datas.push(d); s.s1.push(a); s.s2.push(b); s.s3.push(c)
  }
  return s
}

/** Primeiro índice com datas[i] >= d. */
function posicao(datas: string[], d: string) {
  let [lo, hi] = [0, datas.length]
  while (lo < hi) {
    const m = (lo + hi) >> 1
    if (datas[m] < d) lo = m + 1
    else hi = m
  }
  return lo
}

/** Dias úteis de segunda a sexta em [de, ate), sem feriados (só quando a série oficial não cobre o período). */
function diasDeSemana(de: string, ate: string) {
  const n = diasEntre(de, ate)
  if (n <= 0) return 0
  const inicio = dataDe(de).getUTCDay()
  let uteis = Math.floor(n / 7) * 5
  for (let i = 0; i < n % 7; i++) {
    const dia = (inicio + i) % 7
    if (dia !== 0 && dia !== 6) uteis++
  }
  return uteis
}

/** Dias úteis em [de, ate): pelos dias da série do CDI (que só tem dia útil) onde ela cobre, e de segunda a sexta no resto. */
export function diasUteis(de: string, ate: string, indices?: Indices): number {
  if (ate <= de) return 0
  const s = indices?.cdi ?? indices?.selic
  if (!s || !s.datas.length) return diasDeSemana(de, ate)
  const primeiro = s.datas[0]
  /** O primeiro dia que a série ainda não cobre. */
  const fimDaSerie = somarDias(s.datas[s.datas.length - 1], 1)
  const menor = (x: string, y: string) => (x < y ? x : y)
  const maior = (x: string, y: string) => (x > y ? x : y)
  let total = 0
  if (de < primeiro) total += diasDeSemana(de, menor(ate, primeiro))
  const [a, b] = [maior(de, primeiro), menor(ate, fimDaSerie)]
  if (b > a) total += posicao(s.datas, b) - posicao(s.datas, a)
  if (ate > fimDaSerie) total += diasDeSemana(maior(de, fimDaSerie), ate)
  return total
}

export interface Fator {
  /** Por quanto o valor é multiplicado no período. */
  fator: number
  /** Até que dia as séries cobriram (igual a `ate` quando cobriram tudo). */
  ate: string
  /** As séries cobriram o período inteiro. */
  completo: boolean
}

/** Quantos dias de folga sem dado ainda contam como "em dia" (fim de semana, feriado e a demora da divulgação). */
const FOLGA = 6

/**
 * Por quanto um valor aplicado é multiplicado de `de` a `ate` (rende nos dias úteis de [de, ate)), conforme o indexador:
 *  - `pre`: (1 + taxa)^(dias úteis / 252);
 *  - `cdi` e `selic`: produto de (1 + taxa do dia × % contratado), pela série oficial;
 *  - `ipca`: a inflação dos meses já divulgados (proporcional aos dias de cada mês) vezes a taxa real pelos dias úteis.
 * null quando não há série para estimar (o chamador fica com o último valor conhecido). Bruto: sem imposto.
 */
export function fator(indexador: Indexador, taxa: number, de: string, ate: string, indices?: Indices): Fator | null {
  if (ate <= de) return { fator: 1, ate, completo: true }
  if (indexador === 'pre') return { fator: Math.pow(1 + taxa / 100, diasUteis(de, ate, indices) / 252), ate, completo: true }
  if (indexador === 'cdi' || indexador === 'selic') {
    const s = indices?.[indexador] ?? (indexador === 'selic' ? indices?.cdi : undefined)
    if (!s || !s.datas.length) return null
    const ultimo = s.datas[s.datas.length - 1]
    if (de > ultimo) return diasEntre(ultimo, ate) <= FOLGA ? { fator: 1, ate, completo: true } : { fator: 1, ate: de, completo: false }
    const [i, j] = [posicao(s.datas, de), posicao(s.datas, ate)]
    const p = taxa / 100
    const soma = (v: number[]) => (j > 0 ? v[j - 1] : 0) - (i > 0 ? v[i - 1] : 0)
    // ln(1 + rp) = rp − (rp)²/2 + (rp)³/3 − …: com r na casa de 0,0005, o que sobra depois do cubo não chega a 1e-12 por dia
    const ln = j > i ? p * soma(s.s1) - (p * p * soma(s.s2)) / 2 + (p * p * p * soma(s.s3)) / 3 : 0
    const coberto = somarDias(ultimo, 1)
    const completo = ate <= coberto || diasEntre(ultimo, ate) <= FOLGA
    // a série não chega ao começo do período: não dá para dizer quanto rendeu
    if (de < s.datas[0] && diasEntre(de, s.datas[0]) > FOLGA) return null
    return { fator: Math.exp(ln), ate: completo ? ate : coberto, completo }
  }
  // IPCA + taxa
  const ipca = indices?.ipca
  if (!ipca || !Object.keys(ipca).length) return null
  let inflacao = 1
  let coberto = de
  let faltou = false
  let cursor = de
  while (cursor < ate) {
    const mes = cursor.slice(0, 7)
    const fim = somarDias(fimDoMesDe(cursor), 1)
    const ateAqui = fim < ate ? fim : ate
    const v = ipca[mes]
    if (v === undefined) faltou = true
    else if (!faltou) {
      inflacao *= Math.pow(1 + v, diasEntre(cursor, ateAqui) / diasEntre(`${mes}-01`, fim))
      coberto = ateAqui
    }
    cursor = ateAqui
  }
  // o IPCA de um mês sai no mês seguinte: até uns 45 dias sem o índice é o normal
  const completo = !faltou || diasEntre(coberto, ate) <= 45
  return { fator: inflacao * Math.pow(1 + taxa / 100, diasUteis(de, coberto, indices) / 252), ate: completo ? ate : coberto, completo }
}

/** Quanto o CDI rendeu de `de` a `ate` (0.101 = 10,1%), ou null sem a série. */
export function cdiNoPeriodo(de: string, ate: string, indices?: Indices): { retorno: number; ate: string; completo: boolean } | null {
  const f = fator('cdi', 100, de, ate, indices)
  return f ? { retorno: f.fator - 1, ate: f.ate, completo: f.completo } : null
}

// ---------- buscar no Banco Central ----------

const CHAVE = 'opuscash-indices-v1'
const VALIDADE = 12 * 60 * 60 * 1000
interface Guardado { desde: string; cdi: [string, number][]; selic: [string, number][]; ipca: [string, number][]; em: number }

const brParaIso = (d: string) => `${d.slice(6, 10)}-${d.slice(3, 5)}-${d.slice(0, 2)}`
const isoParaBr = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`

async function serieDoBC(codigo: number, de: string, ate: string): Promise<[string, number][]> {
  const pontos: [string, number][] = []
  // séries diárias: o Banco Central entrega no máximo 10 anos por consulta
  for (let a = de; a <= ate; a = somarDias(somarMeses(a, 108), 1)) {
    const b = somarMeses(a, 108) < ate ? somarMeses(a, 108) : ate
    const r = await fetch(`https://api.bcb.gov.br/dados/serie/bcdata.sgs.${codigo}/dados?formato=json&dataInicial=${isoParaBr(a)}&dataFinal=${isoParaBr(b)}`)
    // sem nenhum valor no período, o Banco Central responde 404: é série vazia, não falha
    if (r.status === 404) continue
    if (!r.ok) throw new Error(`BCB ${codigo}: ${r.status}`)
    const j = (await r.json()) as { data?: string; valor?: string }[]
    if (!Array.isArray(j)) throw new Error(`BCB ${codigo}: resposta inesperada`)
    for (const x of j) {
      const v = Number(String(x.valor ?? '').replace(',', '.'))
      if (typeof x.data === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(x.data) && Number.isFinite(v)) pontos.push([brParaIso(x.data), v / 100])
    }
  }
  return pontos
}

const montar = (g: Guardado): Indices => ({
  cdi: serieDiaria(g.cdi), selic: serieDiaria(g.selic), baixadoEm: g.em,
  ipca: Object.fromEntries(g.ipca.map(([d, v]) => [d.slice(0, 7), v])),
})

function lerGuardado(): Guardado | null {
  try {
    const g = JSON.parse(localStorage.getItem(CHAVE) ?? 'null') as Guardado | null
    return g && Array.isArray(g.cdi) && Array.isArray(g.ipca) && typeof g.desde === 'string' ? g : null
  } catch { return null }
}

/**
 * As séries desde `desde` (o dia da operação mais antiga), para quem tem carteira. Enquanto baixa (ou sem internet),
 * devolve o que já estava guardado; `falhou` diz que a tentativa de atualizar não deu certo.
 */
export function useIndices(desde: string | null) {
  const [indices, setIndices] = useState<Indices | undefined>(() => { const g = lerGuardado(); return g ? montar(g) : undefined })
  const [falhou, setFalhou] = useState(false)
  useEffect(() => {
    if (!desde) return
    // nunca mais que 10 anos para trás: é o que uma consulta cobre, e o que a tela mostra
    const hoje = iso(new Date())
    // pelo menos 3 meses para trás: o IPCA do mês só sai no mês seguinte, e um período sem nenhum valor volta como erro
    const pedido = desde < somarMeses(hoje, -3) ? desde : somarMeses(hoje, -3)
    const inicio = pedido < somarMeses(hoje, -119) ? somarMeses(hoje, -119) : `${pedido.slice(0, 7)}-01`
    const g = lerGuardado()
    if (g && g.desde <= inicio && Date.now() - g.em < VALIDADE) return
    let vivo = true
    Promise.all([serieDoBC(12, inicio, hoje), serieDoBC(11, inicio, hoje), serieDoBC(433, inicio, hoje)])
      .then(([cdi, selic, ipca]) => {
        const novo: Guardado = { desde: inicio, cdi, selic, ipca, em: Date.now() }
        try { localStorage.setItem(CHAVE, JSON.stringify(novo)) } catch { /* sem armazenamento: vale só nesta visita */ }
        if (vivo) { setIndices(montar(novo)); setFalhou(false) }
      })
      .catch(() => vivo && setFalhou(true))
    return () => { vivo = false }
  }, [desde])
  return { indices, falhou }
}
