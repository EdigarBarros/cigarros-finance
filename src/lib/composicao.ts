/**
 * O compositor da tela do Consultor: pega as descobertas da pessoa (lib/achados.ts) e monta a tela dela.
 *
 * Ele não inventa desenho nenhum: escolhe entre os componentes já prontos e testados de pages/AnaliseGraficos.tsx
 * (o catálogo é o tipo `Visual`), e só usa um componente depois de conferir que o dado serve para ele (`valido`).
 *
 * Três decisões:
 *
 * 1. **O que vem primeiro.** A força de cada descoberta (o motor) mais o quanto a pessoa se interessa pelo assunto
 *    (lib/gosto.ts). A tela **parte da ordem da última visita**: um cartão só passa à frente do vizinho quando ganha dele
 *    por uma margem (`MARGEM`). Diferença pequena não troca nada de lugar, e não há acaso: a pessoa aprende onde cada
 *    coisa fica. O que faz um cartão subir: ficou importante, o número dele mudou de verdade (`mesmaVersao`, 10%) ou a
 *    pessoa passou a olhar muito aquele assunto. O gosto nunca rebaixa o que é importante (`importante`).
 * 2. **Como desenhar cada uma.** Cada formato de dado tem mais de um desenho possível (`candidatos`), com uma nota de
 *    **aptidão** para aquele dado. O desenho em que a pessoa viu da última vez **continua**; ele só troca se deixar de
 *    servir ao dado ou se o gosto por outro desenho ficar bem maior. Se a pessoa escolheu um ("Outro jeito"), vale o dela.
 * 3. **Onde fica cada cartão.** A primeira descoberta vira a manchete. As outras entram em faixas de 6 colunas, e o
 *    tamanho de cada cartão sai do desenho escolhido (`diagramar`): mesma lista, mesma diagramação.
 *
 * O que é importante não some: uma descoberta importante aparece mesmo que a pessoa a tenha escondido antes.
 *
 * É puro: mesmas entradas, mesma tela.
 */
import type { Tom } from './analise'
import { importante, medidaDe, type Achado, type Dado } from './achados'
import { fmtPct } from './format'
import { acaso, afinidade, mesmaVersao, type Gosto } from './gosto'
import { tx } from './textos'
import { COR, type Visual } from './visuais'

/** Os campos que só o desenho tem (sem id, título, frase…). */
type Desenho = Visual extends infer V ? (V extends { tipo: string } ? Omit<V, 'id' | 'prioridade' | 'titulo' | 'frase' | 'tom' | 'destino'> : never) : never

interface Candidato {
  forma: Visual['tipo']
  /** 0 a 1: quanto este desenho serve para este dado. */
  aptidao: number
  desenho: Desenho
}

const TOM_COR: Record<Tom, string> = { bom: COR.entrada, medio: COR.divida, ruim: COR.saida }

/** Todo número do desenho é um número de verdade (nada de NaN ou infinito chegando a um gráfico). */
function numerosSaos(x: unknown): boolean {
  if (typeof x === 'number') return Number.isFinite(x)
  if (Array.isArray(x)) return x.every(numerosSaos)
  if (x && typeof x === 'object') return Object.values(x).every(numerosSaos)
  return true
}

/** O dado serve para este componente? Cada um tem o mínimo de que precisa para se desenhar direito. */
export function valido(d: Desenho): boolean {
  if (!numerosSaos(d)) return false
  const soma = (fs: { valor: number }[]) => fs.reduce((s, f) => s + Math.max(0, f.valor), 0)
  switch (d.tipo) {
    case 'rosca': case 'quadradinhos': case 'faixa': return d.fatias.length >= 1 && soma(d.fatias) > 0
    case 'curva': return d.pontos.length >= 2
    case 'colunas': return d.colunas.length >= 1
    case 'barras': return d.barras.length >= 1
    case 'podio': return d.itens.length >= 3
    case 'halteres': case 'aneis': return d.itens.length >= 1
    case 'radar': return d.eixos.length >= 3
    case 'cascata': return d.passos.length >= 2
    case 'calendario': return d.dias.length >= 28
    case 'linhaDoTempo': return d.itens.length >= 1 && d.fim >= d.inicio
    case 'tabela': return d.linhas.length >= 1
    case 'pote': case 'trilha': return d.maximo > 0
    default: return true
  }
}

/** Os desenhos que servem a um dado (já conferidos por `valido`), cada um com a sua aptidão. Vazio: nada a desenhar. */
export function candidatos(dado: Dado): Candidato[] {
  return todos(dado).filter((c) => valido(c.desenho))
}

function todos(dado: Dado): Candidato[] {
  switch (dado.forma) {
    case 'pronto': {
      const { id: _i, prioridade: _p, titulo: _t, frase: _f, tom: _o, destino: _d, ...desenho } = dado.visual
      return [{ forma: dado.visual.tipo, aptidao: 1, desenho: desenho as Desenho }]
    }
    case 'partes': {
      const vivas = dado.partes.filter((p) => p.valor > 0)
      const total = vivas.reduce((s, p) => s + p.valor, 0) || 1
      const menor = Math.min(...vivas.map((p) => p.valor / total), 1)
      const maior = Math.max(...vivas.map((p) => p.valor / total), 0)
      const c: Candidato[] = [{ forma: 'rosca', aptidao: vivas.length <= 5 ? 0.8 : 0.6, desenho: { tipo: 'rosca', fatias: dado.partes, ideal: dado.ideal, centro: dado.centro } }]
      if (vivas.length >= 2 && vivas.length <= 4 && menor >= 0.02) c.push({ forma: 'quadradinhos', aptidao: 0.82, desenho: { tipo: 'quadradinhos', fatias: dado.partes, ideal: dado.ideal } })
      if (vivas.length >= 2 && vivas.length <= 6) c.push({ forma: 'faixa', aptidao: maior >= 0.7 ? 0.78 : 0.64, desenho: { tipo: 'faixa', fatias: dado.partes, ideal: dado.ideal } })
      return c
    }
    case 'serie': {
      const n = dado.pontos.length
      const zero = dado.pontos.some((p) => p.valor < 0)
      const curva: Candidato = { forma: 'curva', aptidao: dado.continua ? 0.88 : n >= 5 ? 0.66 : 0.3, desenho: { tipo: 'curva', pontos: dado.pontos, zero, tracejadoDesde: dado.tracejadoDesde } }
      const colunas: Candidato = { forma: 'colunas', aptidao: dado.continua ? 0.5 : 0.82, desenho: { tipo: 'colunas', colunas: dado.pontos } }
      // a projeção tracejada e as séries longas (o saldo dia a dia) só fazem sentido em linha
      if (n < 2) return [colunas]
      return dado.tracejadoDesde !== undefined || n > 14 ? [curva] : [curva, colunas]
    }
    case 'ranking': {
      const c: Candidato[] = [{ forma: 'barras', aptidao: 0.8, desenho: { tipo: 'barras', barras: dado.itens } }]
      const positivos = dado.itens.filter((x) => x.valor > 0)
      if (positivos.length >= 3 && positivos.length === dado.itens.length) {
        const ordenados = [...dado.itens].sort((a, b) => b.valor - a.valor)
        c.push({ forma: 'podio', aptidao: ordenados[0].valor >= ordenados[1].valor * 1.25 ? 0.8 : 0.68, desenho: { tipo: 'podio', itens: ordenados.map(({ rotulo, valor, icone }) => ({ rotulo, valor, icone })) } })
      }
      return c
    }
    case 'comparacao': return [duelo(dado.antes, dado.agora, dado.subirEBom, 0.85)]
    case 'pares': {
      const c: Candidato[] = [{ forma: 'halteres', aptidao: dado.itens.length > 1 ? 0.85 : 0.6, desenho: { tipo: 'halteres', itens: dado.itens } }]
      if (dado.itens.length === 1) {
        const x = dado.itens[0]
        c.push(duelo({ rotulo: tx('antes'), valor: x.antes }, { rotulo: tx('agora'), valor: x.agora }, false, 0.8))
      }
      return c
    }
    case 'progresso': {
      const maximo = Math.max(dado.alvo, dado.atual, 1)
      const trilha: Candidato = { forma: 'trilha', aptidao: 0.76, desenho: { tipo: 'trilha', atual: dado.atual, maximo, marcos: dado.marcos, legenda: dado.legenda } }
      // o pote é para o que se junta; um limite que vai sendo tomado não "enche"
      return dado.junta ? [{ forma: 'pote', aptidao: 0.76, desenho: { tipo: 'pote', atual: dado.atual, maximo, marcos: dado.marcos, legenda: dado.legenda } }, trilha] : [trilha]
    }
    case 'numero':
      return [{ forma: 'numerao', aptidao: 1, desenho: { tipo: 'numerao', valor: dado.valor, formato: dado.formato, legenda: dado.legenda, faisca: dado.historia } }]
  }
}

function duelo(antes: { rotulo: string; valor: number }, agora: { rotulo: string; valor: number }, subirEBom: boolean, aptidao: number): Candidato {
  const dif = agora.valor - antes.valor
  const melhorou = subirEBom ? dif >= 0 : dif <= 0
  const selo = antes.valor > 0 ? `${dif >= 0 ? '+' : '−'}${fmtPct(Math.abs(dif) / antes.valor)}` : ''
  return {
    forma: 'duelo', aptidao,
    desenho: { tipo: 'duelo', selo, seloTom: melhorou ? 'bom' : 'medio', lados: [{ ...antes, cor: COR.neutro }, { ...agora, cor: TOM_COR[melhorou ? 'bom' : 'medio'] }] },
  }
}

/** Desenhos que precisam de largura (meia tela ou mais no computador). Os outros cabem em um terço. */
function largo(v: Visual): boolean {
  switch (v.tipo) {
    case 'calendario': case 'fluxo': case 'tabela': case 'linhaDoTempo': case 'halteres': case 'curva': case 'radar': case 'cascata': return true
    case 'colunas': return v.colunas.length > 6
    case 'barras': return v.barras.length > 4
    case 'aneis': return v.itens.length > 2
    default: return false
  }
}

/** Desenhos altos, de explorar com calma: não servem de manchete. */
const COMPRIDOS = new Set<Visual['tipo']>(['fluxo', 'tabela', 'calendario'])

export interface Peca {
  achado: Achado
  /** O desenho escolhido, pronto para pages/AnaliseGraficos.tsx. */
  visual: Visual
  /** Todos os desenhos que servem a esta descoberta, na ordem em que "Ver de outro jeito" passa por eles. */
  formas: Visual['tipo'][]
  largo: boolean
  /** O que a descoberta diz (o título e o tom; a frase, nas que não têm um número só). */
  versao: string
  /** O número principal dela: com `versao`, diz se houve mudança relevante desde a última vez. */
  medida?: number
  /** Informação financeira importante: não dá para esconder e o gosto não rebaixa. */
  importante: boolean
  /** A pessoa ainda não viu ('novo') ou o número mudou de verdade desde a última vez ('mudou'). */
  novidade: 'novo' | 'mudou' | null
}

export interface Tela {
  /** A primeira é a manchete. */
  pecas: Peca[]
  /** Quantas das primeiras são favoritas. */
  favoritos: number
  escondidos: Achado[]
  /** Os cartões (sem os favoritos) na ordem desta montagem: é o que a próxima visita usa como ponto de partida. */
  ordem: string[]
  /** O desenho de cada cartão nesta montagem. */
  desenhos: Record<string, string>
}

export interface Escolhas {
  fav: string[]
  oculto: string[]
  /** O desenho que a pessoa pediu nesta visita, por descoberta. */
  formas: Record<string, string>
}

/** Com número principal, a versão é o título e o tom (o número é comparado à parte); sem ele, a frase inteira. */
const versaoDe = (a: Achado) => Math.round(acaso(medidaDe(a.dado) === undefined ? `${a.titulo}|${a.frase}` : `${a.titulo}|${a.tom ?? ''}`) * 1e5).toString(36)

const visualDe = (a: Achado, c: Candidato): Visual =>
  ({ ...c.desenho, id: a.id, prioridade: a.forca, titulo: a.titulo, frase: a.frase, tom: a.tom, destino: a.destino }) as Visual

/** Uma descoberta já com o desenho pedido (ou o mais apto, se o pedido não serve para ela). null: nenhum desenho serve. */
export function pecaCom(a: Achado, forma: string | undefined, novidade: Peca['novidade'] = null): Peca | null {
  const c = candidatos(a.dado).sort((x, y) => y.aptidao - x.aptidao)
  if (!c.length) return null
  const visual = visualDe(a, c.find((x) => x.forma === forma) ?? c[0])
  return { achado: a, visual, formas: c.map((x) => x.forma), largo: largo(visual), versao: versaoDe(a), medida: medidaDe(a.dado), novidade, importante: importante(a) }
}

/** Quanto o gosto pelo assunto pode somar ou tirar de um cartão (de −20 a +20). */
const PESO_DO_GOSTO = 20
/** Quantos pontos um cartão precisa ter a mais que o vizinho de cima para passar à frente dele. */
export const MARGEM = 8
/** Quanto o desenho da última vez vale a mais na escolha: é o que o mantém no lugar. */
const FICA = 9

/**
 * Monta a tela: a ordem das descobertas e o desenho de cada uma.
 * @param g o gosto como estava ao abrir a aba (a tela não se reordena a cada toque)
 */
export function compor(lista: Achado[], g: Gosto, escolhas: Escolhas): Tela {
  // o importante aparece mesmo que tenha sido escondido antes, quando ainda não era
  const escondido = (a: Achado) => escolhas.oculto.includes(a.id) && !importante(a)
  const visiveis = lista.filter((a) => !escondido(a) && candidatos(a.dado).length > 0)
  const novidadeDe = (a: Achado): Peca['novidade'] => {
    const l = g.achados[a.id]
    // "novo" é o que não estava na tela da última visita (quem está começando não vê tudo marcado como novo)
    if (!l) return g.ordem.length > 0 && !(a.id in g.desenhos) ? 'novo' : null
    return mesmaVersao(l, versaoDe(a), medidaDe(a.dado)) ? null : 'mudou'
  }
  const pontos = new Map(visiveis.map((a) => {
    const gosto = afinidade(g.temas, a.tema)
    // o gosto sobe o que a pessoa olha e desce o que ela ignora, mas nunca desce o que é importante
    return [a.id, a.forca + (importante(a) ? Math.max(0, gosto) : gosto) * PESO_DO_GOSTO + (novidadeDe(a) === 'mudou' ? 10 : 0)] as const
  }))
  const p = (a: Achado) => pontos.get(a.id)!
  const favs = escolhas.fav.map((id) => visiveis.find((a) => a.id === id)).filter((a): a is Achado => Boolean(a))
  const soltos = visiveis.filter((a) => !escolhas.fav.includes(a.id))

  // A ordem parte da última visita. Quem já estava na tela fica onde estava; quem é novo entra pelo lugar que os pontos
  // dele pedem. Depois, cada cartão só sobe enquanto ganhar do de cima pela margem.
  const lugar = new Map(g.ordem.map((id, i) => [id, i]))
  const resto: Achado[] = soltos.filter((a) => lugar.has(a.id)).sort((x, y) => lugar.get(x.id)! - lugar.get(y.id)!)
  for (const a of soltos.filter((x) => !lugar.has(x.id)).sort((x, y) => p(y) - p(x) || (x.id < y.id ? -1 : 1))) {
    const i = resto.findIndex((x) => p(x) < p(a))
    resto.splice(i < 0 ? resto.length : i, 0, a)
  }
  for (let i = 1; i < resto.length; i++) {
    let k = i
    while (k > 0 && p(resto[k]) >= p(resto[k - 1]) + MARGEM) {
      [resto[k - 1], resto[k]] = [resto[k], resto[k - 1]]
      k--
    }
  }

  const usados = new Map<string, number>()
  const pecas = [...favs, ...resto].map((a) => {
    const l = g.achados[a.id]
    const pedida = escolhas.formas[a.id] ?? l?.e
    const c = candidatos(a.dado)
    const forma = c.find((x) => x.forma === pedida)?.forma ?? c.map((x) => ({
      forma: x.forma,
      p: x.aptidao * 30 + afinidade(g.formas, x.forma) * 10 - (usados.get(x.forma) ?? 0) * 7 + (x.forma === (g.desenhos[a.id] ?? l?.f) ? FICA : 0),
    })).sort((x, y) => y.p - x.p || (x.forma < y.forma ? -1 : 1))[0].forma
    usados.set(forma, (usados.get(forma) ?? 0) + 1)
    return pecaCom(a, forma, novidadeDe(a))!
  })
  // a manchete é a primeira que cabe num olhar: listas compridas e calendário não viram manchete (ficam logo abaixo)
  if (!favs.length) {
    const i = pecas.slice(0, 3).findIndex((x) => !COMPRIDOS.has(x.visual.tipo))
    if (i > 0) pecas.unshift(...pecas.splice(i, 1))
  }
  return {
    pecas, favoritos: favs.length, escondidos: lista.filter(escondido), ordem: resto.map((a) => a.id),
    desenhos: Object.fromEntries(pecas.map((x) => [x.achado.id, x.visual.tipo])),
  }
}

/**
 * Quantas das 6 colunas cada cartão ocupa (no computador), na ordem recebida. Cada faixa soma 6:
 * três compactos (2+2+2), dois iguais (3+3), um largo com um compacto (4+2 ou 2+4) ou um sozinho (6).
 */
export function diagramar(pecas: Pick<Peca, 'largo'>[]): number[] {
  const larguras: number[] = []
  let i = 0
  while (i < pecas.length) {
    const falta = pecas.length - i
    const [a, b, c] = [pecas[i], pecas[i + 1], pecas[i + 2]]
    if (falta === 1) {
      larguras.push(6)
      i += 1
    } else if (falta >= 3 && !a.largo && !b.largo && !c.largo && (falta !== 4 || pecas[i + 3].largo)) {
      // (com 4 restando e o quarto compacto também, 3+1 deixaria um compacto sozinho na faixa: melhor 2+2)
      larguras.push(2, 2, 2)
      i += 3
    } else if (falta === 4 && !a.largo && !b.largo && !c.largo && !pecas[i + 3].largo) {
      larguras.push(3, 3)
      i += 2
    } else if (a.largo && !b.largo) {
      larguras.push(4, 2)
      i += 2
    } else if (!a.largo && b.largo) {
      larguras.push(2, 4)
      i += 2
    } else {
      larguras.push(3, 3)
      i += 2
    }
  }
  return larguras
}
