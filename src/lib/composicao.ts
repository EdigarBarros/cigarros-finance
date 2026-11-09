/**
 * O compositor da tela do Consultor: pega as descobertas da pessoa (lib/achados.ts) e monta a tela dela.
 *
 * Três decisões, todas tomadas aqui e nenhuma fixa:
 *
 * 1. **O que vem primeiro.** A força de cada descoberta (o motor), mais o quanto a pessoa se interessa pelo assunto
 *    (lib/gosto.ts), mais a novidade (o que mudou desde a última vez sobe; o que ela já viu igual por vários dias cede o
 *    lugar, a não ser que seja urgente), mais um pouco de acaso que muda a cada dia.
 * 2. **Como desenhar cada uma.** Cada formato de dado tem mais de um desenho possível (`candidatos`): um todo dividido
 *    pode ser rosca, 100 quadradinhos ou uma barra só; dois valores podem ser um duelo ou um "antes × agora". Cada desenho
 *    recebe uma nota pela **aptidão** para aquele dado (quadradinhos não servem com 7 fatias; pódio pede 3 itens), pelo
 *    gosto da pessoa por ele, pela variedade (o mesmo desenho duas vezes na tela perde pontos) e pela rotação (o desenho de
 *    ontem perde um pouco hoje). Se a pessoa escolheu um desenho ("Ver de outro jeito"), vale o dela.
 * 3. **Onde fica cada cartão.** A primeira descoberta vira a manchete. As outras entram em faixas de 6 colunas, e o
 *    tamanho de cada cartão sai do desenho escolhido: os largos (calendário, curva, tabela) pedem meia tela ou mais, os
 *    compactos (número grande, duelo, pote) cabem em um terço (`diagramar`).
 *
 * A tela não muda debaixo do dedo: dentro do mesmo dia, com os mesmos dados, a montagem é a mesma. Ela muda quando os
 * dados mudam, quando o dia vira e conforme o gosto aprende.
 *
 * É puro: mesmas entradas, mesma tela.
 */
import type { Tom } from './analise'
import type { Achado, Dado } from './achados'
import { fmtPct } from './format'
import { acaso, afinidade, diaDe, type Gosto } from './gosto'
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

/** Os desenhos possíveis para um dado, cada um com a sua aptidão. Sempre devolve pelo menos um. */
export function candidatos(dado: Dado): Candidato[] {
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
  /** A versão da descoberta (muda quando a frase muda). */
  versao: string
  /** A pessoa ainda não viu ('novo') ou viu com outros números ('mudou'). */
  novidade: 'novo' | 'mudou' | null
}

export interface Tela {
  /** A primeira é a manchete. */
  pecas: Peca[]
  /** Quantas das primeiras são favoritas. */
  favoritos: number
  escondidos: Achado[]
}

export interface Escolhas {
  fav: string[]
  oculto: string[]
  /** O desenho que a pessoa pediu nesta visita, por descoberta. */
  formas: Record<string, string>
}

const versaoDe = (a: Achado) => Math.round(acaso(`${a.titulo}|${a.frase}`) * 1e5).toString(36)

const visualDe = (a: Achado, c: Candidato): Visual =>
  ({ ...c.desenho, id: a.id, prioridade: a.forca, titulo: a.titulo, frase: a.frase, tom: a.tom, destino: a.destino }) as Visual

/** Uma descoberta já com o desenho pedido (ou o mais apto, se o pedido não serve para ela). */
export function pecaCom(a: Achado, forma: string | undefined, novidade: Peca['novidade'] = null): Peca {
  const c = candidatos(a.dado).sort((x, y) => y.aptidao - x.aptidao)
  const visual = visualDe(a, c.find((x) => x.forma === forma) ?? c[0])
  return { achado: a, visual, formas: c.map((x) => x.forma), largo: largo(visual), versao: versaoDe(a), novidade }
}

/**
 * Monta a tela: a ordem das descobertas e o desenho de cada uma.
 * @param g o gosto como estava ao abrir a aba (a tela não se reordena a cada toque)
 * @param semente muda a cada dia e a cada pessoa (ex.: "id|2026-11-09")
 */
export function compor(lista: Achado[], g: Gosto, escolhas: Escolhas, semente: string, hoje = new Date()): Tela {
  const dia = diaDe(hoje)
  const visiveis = lista.filter((a) => !escolhas.oculto.includes(a.id))
  const novidadeDe = (a: Achado): Peca['novidade'] => {
    const l = g.achados[a.id]
    // quem está começando não vê tudo marcado como novo
    if (!l) return g.total > 0 ? 'novo' : null
    return l.s !== versaoDe(a) ? 'mudou' : null
  }
  const pontos = (a: Achado) => {
    const l = g.achados[a.id]
    const novidade = novidadeDe(a)
    const mesma = l && l.s === versaoDe(a)
    // o que já foi visto igual por vários dias cede o lugar; o urgente, não
    const habito = mesma && a.forca < 80 ? Math.min(18, Math.max(0, l.n - 2) * 3) : 0
    return a.forca + afinidade(g.temas, a.tema) * 10 + (novidade === 'mudou' ? 10 : novidade === 'novo' ? 6 : 0) - habito + acaso(`${semente}|${a.id}`) * 6
  }
  const favs = escolhas.fav.map((id) => visiveis.find((a) => a.id === id)).filter((a): a is Achado => Boolean(a))
  const resto = visiveis.filter((a) => !escolhas.fav.includes(a.id)).map((a) => ({ a, p: pontos(a) })).sort((x, y) => y.p - x.p).map((x) => x.a)

  const usados = new Map<string, number>()
  const pecas = [...favs, ...resto].map((a) => {
    const l = g.achados[a.id]
    const pedida = escolhas.formas[a.id] ?? l?.e
    const c = candidatos(a.dado)
    let forma = c.find((x) => x.forma === pedida)?.forma
    if (!forma) {
      const mesmaDeOntem = l && l.s === versaoDe(a) && l.d !== dia ? l.f : undefined
      forma = c.map((x) => ({
        forma: x.forma,
        p: x.aptidao * 30 + afinidade(g.formas, x.forma) * 10 + acaso(`${semente}|${a.id}|${x.forma}`) * 8
          - (usados.get(x.forma) ?? 0) * 7 - (x.forma === mesmaDeOntem ? 5 : 0),
      })).sort((x, y) => y.p - x.p)[0].forma
    }
    usados.set(forma, (usados.get(forma) ?? 0) + 1)
    return pecaCom(a, forma, novidadeDe(a))
  })
  // a manchete é a primeira que cabe num olhar: listas compridas e calendário não viram manchete (ficam logo abaixo)
  if (!favs.length) {
    const i = pecas.slice(0, 3).findIndex((p) => !COMPRIDOS.has(p.visual.tipo))
    if (i > 0) pecas.unshift(...pecas.splice(i, 1))
  }
  return { pecas, favoritos: favs.length, escondidos: lista.filter((a) => escolhas.oculto.includes(a.id)) }
}

/**
 * Quantas das 6 colunas cada cartão ocupa (no computador), na ordem recebida. Cada faixa soma 6:
 * três compactos (2+2+2), dois iguais (3+3), um largo com um compacto (4+2 ou 2+4) ou um sozinho (6).
 */
export function diagramar(pecas: Pick<Peca, 'largo'>[], semente: string): number[] {
  const larguras: number[] = []
  let i = 0
  let faixa = 0
  while (i < pecas.length) {
    const falta = pecas.length - i
    const [a, b, c] = [pecas[i], pecas[i + 1], pecas[i + 2]]
    if (falta === 1) {
      larguras.push(6)
      i += 1
    } else if (falta >= 3 && !a.largo && !b.largo && !c.largo && (falta !== 4 || pecas[i + 3].largo) && acaso(`${semente}|faixa${faixa}`) < 0.75) {
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
    faixa++
  }
  return larguras
}
