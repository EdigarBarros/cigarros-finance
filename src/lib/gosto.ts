/**
 * O gosto de cada pessoa: o que a tela do Consultor aprende com o uso, para montar a próxima melhor do que a de hoje.
 *
 * A tela é montada por lib/composicao.ts a partir das descobertas de lib/achados.ts. A cada visita, este arquivo anota:
 *  - por **desenho** (rosca, quadradinhos, duelo…) e por **assunto** (o mês, gastos, dívidas…): quantas vezes a pessoa viu,
 *    quantas se interessou (tocou, abriu a tela, favoritou, escolheu aquele desenho) e quantas rejeitou (escondeu, trocou);
 *  - por **descoberta**: a última versão que ela viu (para saber o que é novidade), em quantos dias já viu a mesma coisa
 *    (o que não muda vai cansando e cede o lugar) e o desenho que ela escolheu, se escolheu.
 *
 * Com isso, `afinidade` devolve quanto a pessoa gosta de um desenho ou assunto: a média do que deu certo, com um empurrão
 * para o que ela ainda viu pouco (para a tela experimentar, e não ficar presa ao primeiro acerto). O que é antigo pesa
 * cada vez menos: o gosto muda, e a memória acompanha.
 *
 * É puro: `registrar` recebe o gosto e devolve o gosto novo. Nada sai do aparelho além da cópia no perfil da própria
 * pessoa (`perfis.consultor.gosto`), e são só contagens: nenhum valor em dinheiro fica aqui.
 */

/** [quantas vezes viu, quanto se interessou, quanto rejeitou] */
export type Placar = [number, number, number]

export interface LembrancaDoAchado {
  /** A versão da descoberta que a pessoa viu por último (muda quando os números mudam). */
  s: string
  /** O último dia em que viu (dias desde 1970). */
  d: number
  /** Em quantos dias diferentes viu a mesma versão. */
  n: number
  /** O desenho da última vez. */
  f?: string
  /** O desenho que a pessoa escolheu ("Ver de outro jeito"): vale até ela trocar de novo. */
  e?: string
}

export interface Gosto {
  formas: Record<string, Placar>
  temas: Record<string, Placar>
  achados: Record<string, LembrancaDoAchado>
  fav: string[]
  oculto: string[]
  /** Quantos sinais já foram anotados: entre a cópia do aparelho e a do banco, vale a que sabe mais. */
  total: number
}

export const GOSTO_VAZIO: Gosto = { formas: {}, temas: {}, achados: {}, fav: [], oculto: [], total: 0 }

/** Passando disso, as contagens caem pela metade: o que é antigo pesa menos e o gosto pode mudar. */
const MEMORIA_CHEIA = 60
/** Descobertas lembradas (as vistas há mais tempo saem). */
const MAX_ACHADOS = 80

const numero = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : 0)
const placares = (x: unknown): Record<string, Placar> => {
  const r: Record<string, Placar> = {}
  if (!x || typeof x !== 'object') return r
  for (const [k, v] of Object.entries(x as Record<string, unknown>).slice(0, 60)) {
    if (Array.isArray(v)) r[k] = [numero(v[0]), numero(v[1]), numero(v[2])]
  }
  return r
}
const textos = (x: unknown) => (Array.isArray(x) ? x.filter((t): t is string => typeof t === 'string').slice(0, 100) : [])

/** Garante a forma, mesmo vindo de uma versão antiga ou de um JSON estranho. */
export function normGosto(x: unknown): Gosto {
  const g = (x && typeof x === 'object' ? x : {}) as Partial<Record<keyof Gosto, unknown>>
  const achados: Record<string, LembrancaDoAchado> = {}
  if (g.achados && typeof g.achados === 'object') {
    for (const [k, v] of Object.entries(g.achados as Record<string, Partial<LembrancaDoAchado> | null>).slice(0, MAX_ACHADOS * 2)) {
      if (!v || typeof v.s !== 'string') continue
      achados[k] = { s: v.s, d: numero(v.d), n: numero(v.n), ...(typeof v.f === 'string' ? { f: v.f } : {}), ...(typeof v.e === 'string' ? { e: v.e } : {}) }
    }
  }
  return { formas: placares(g.formas), temas: placares(g.temas), achados, fav: textos(g.fav), oculto: textos(g.oculto), total: numero(g.total) }
}

/** O dia de hoje como número (dias desde 1970, no fuso da pessoa). */
export const diaDe = (hoje = new Date()) => Math.floor((hoje.getTime() - hoje.getTimezoneOffset() * 60000) / 86400000)

export type Sinal =
  /** O cartão ficou na tela tempo bastante para ser lido. */
  | 'viu'
  /** Tocou no cartão (abriu uma lista, escolheu um dia…). */
  | 'tocou'
  /** Foi para a tela de que o cartão fala. */
  | 'abriu'
  | 'favoritou'
  | 'escondeu'
  /** Pediu outro desenho para a mesma descoberta: `forma` é o que ela deixou, `para` é o que escolheu. */
  | 'trocou'

export interface Evento {
  sinal: Sinal
  achado: string
  tema: string
  forma: string
  /** A versão da descoberta que estava na tela. */
  versao: string
  para?: string
}

const somar = (m: Record<string, Placar>, k: string, viu: number, bom: number, ruim: number): Record<string, Placar> => {
  const p = m[k] ?? [0, 0, 0]
  let novo: Placar = [p[0] + viu, p[1] + bom, p[2] + ruim]
  if (novo[0] > MEMORIA_CHEIA) novo = [novo[0] / 2, novo[1] / 2, novo[2] / 2]
  return { ...m, [k]: novo }
}

/** O gosto depois de um sinal. */
export function registrar(g: Gosto, e: Evento, hoje = new Date()): Gosto {
  let { formas, temas, achados, fav, oculto } = g
  const dia = diaDe(hoje)
  const lembranca = achados[e.achado]
  switch (e.sinal) {
    case 'viu': {
      formas = somar(formas, e.forma, 1, 0, 0)
      temas = somar(temas, e.tema, 1, 0, 0)
      const mesma = lembranca?.s === e.versao
      achados = {
        ...achados,
        [e.achado]: { ...lembranca, s: e.versao, d: dia, f: e.forma, n: mesma ? lembranca.n + (lembranca.d === dia ? 0 : 1) : 1 },
      }
      break
    }
    case 'tocou':
      formas = somar(formas, e.forma, 0, 0.5, 0)
      temas = somar(temas, e.tema, 0, 0.5, 0)
      break
    case 'abriu':
      formas = somar(formas, e.forma, 0, 1, 0)
      temas = somar(temas, e.tema, 0, 1.5, 0)
      break
    case 'favoritou':
      if (fav.includes(e.achado)) fav = fav.filter((x) => x !== e.achado)
      else {
        fav = [...fav, e.achado]
        formas = somar(formas, e.forma, 0, 1.5, 0)
        temas = somar(temas, e.tema, 0, 2, 0)
      }
      break
    case 'escondeu':
      oculto = [...oculto.filter((x) => x !== e.achado), e.achado]
      fav = fav.filter((x) => x !== e.achado)
      // esconder fala do assunto, e só um pouco do desenho
      formas = somar(formas, e.forma, 0, 0, 0.5)
      temas = somar(temas, e.tema, 0, 0, 1.5)
      break
    case 'trocou':
      formas = somar(formas, e.forma, 0, 0, 1)
      if (e.para) {
        formas = somar(formas, e.para, 0, 1, 0)
        achados = { ...achados, [e.achado]: { ...(lembranca ?? { s: e.versao, d: dia, n: 1 }), f: e.para, e: e.para } }
      }
      break
  }
  // as descobertas vistas há mais tempo saem da lembrança
  const chaves = Object.keys(achados)
  if (chaves.length > MAX_ACHADOS) {
    const ficam = chaves.sort((a, b) => achados[b].d - achados[a].d).slice(0, MAX_ACHADOS)
    achados = Object.fromEntries(ficam.map((k) => [k, achados[k]]))
  }
  return { formas, temas, achados, fav, oculto, total: g.total + 1 }
}

/** Volta a mostrar uma descoberta escondida. */
export const mostrarDeNovo = (g: Gosto, achado: string): Gosto => ({ ...g, oculto: g.oculto.filter((x) => x !== achado), total: g.total + 1 })

/**
 * Quanto a pessoa gosta de um desenho ou de um assunto, de −1 a 1 (0 = ainda não dá para dizer).
 * É a média do que deu certo (ver sem tocar conta como um "não" bem fraco), mais um empurrão para o que foi pouco visto.
 */
export function afinidade(m: Record<string, Placar>, k: string): number {
  const p = m[k]
  const [viu, bom, ruim] = p ?? [0, 0, 0]
  const media = (bom + 1) / (bom + ruim + viu * 0.12 + 2)
  let vistos = 0
  for (const x of Object.values(m)) vistos += x[0]
  const curiosidade = Math.min(0.25, 0.18 * Math.sqrt(Math.log(vistos + 2) / (viu + 1)))
  return Math.max(-1, Math.min(1, (media - 0.5) * 2 + curiosidade))
}

/** Um número de 0 a 1 que só depende do texto: o mesmo texto dá sempre o mesmo número (o "acaso" de cada dia). */
export function acaso(texto: string): number {
  let h = 2166136261
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  h ^= h >>> 15
  h = Math.imul(h, 2246822507)
  h ^= h >>> 13
  return ((h >>> 0) % 100000) / 100000
}
