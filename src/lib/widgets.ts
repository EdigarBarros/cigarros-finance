/**
 * Os cartões ("widgets") da Início do celular, o modelo de cada jeito de ver e a arrumação da pessoa. Puro: quem desenha
 * cada um é src/movel/widgets.tsx. No celular, o jeito (simples, equilibrado, detalhado) é o ponto de partida: diz quais
 * cartões aparecem e em que ordem; depois a pessoa adiciona, tira e muda a ordem (guardado em perfis.celular, migração 35).
 */
import type { Detalhe } from './types'

export type IdWidget =
  | 'contas' | 'gasto-mes' | 'ultimos' | 'categorias' | 'orientacao' | 'entrou-saiu' | 'gasto-dia' | 'nota' | 'comparacao'
  | 'dividas' | 'receber' | 'metas' | 'guardado' | 'cartoes' | 'evolucao' | 'resumo-mes'

/** Pequeno ocupa meia linha (dois lado a lado); grande ocupa a linha inteira. */
export type TamanhoWidget = 'pequeno' | 'grande'

export const TAMANHO: Record<IdWidget, TamanhoWidget> = {
  contas: 'grande', 'gasto-mes': 'grande', ultimos: 'grande', categorias: 'grande', orientacao: 'grande',
  'entrou-saiu': 'pequeno', 'gasto-dia': 'pequeno', nota: 'pequeno', comparacao: 'pequeno',
  dividas: 'grande', receber: 'grande', metas: 'grande', guardado: 'grande', cartoes: 'grande',
  evolucao: 'grande', 'resumo-mes': 'grande',
}

/**
 * O modelo de cada jeito, na ordem das perguntas da Início (docs/arquitetura-do-painel.md, seção 3): como estou, o que
 * preciso fazer, para onde está indo, o que estou construindo. Os três abrem igual: o gráfico mês a mês, o resumo do mês
 * (com o mês anterior), as contas por data e os últimos lançamentos; o que muda é o que vem depois. Cartão de módulo
 * desligado (ou sem nada para mostrar) fica de fora sozinho.
 */
export const MODELOS: Record<Detalhe, IdWidget[]> = {
  simples: ['evolucao', 'resumo-mes', 'contas', 'ultimos', 'orientacao', 'metas'],
  equilibrado: ['evolucao', 'resumo-mes', 'contas', 'ultimos', 'gasto-mes', 'categorias', 'orientacao', 'dividas', 'metas', 'guardado'],
  detalhado: [
    'evolucao', 'resumo-mes', 'contas', 'ultimos', 'gasto-mes', 'categorias', 'nota', 'comparacao', 'orientacao', 'cartoes',
    'dividas', 'receber', 'metas', 'guardado',
  ],
}

/** Uma linha da grade: um cartão grande, dois pequenos lado a lado ou um pequeno sozinho (que então ocupa a linha). */
export type LinhaDeWidgets = { tipo: 'grande' | 'sozinho'; ids: [IdWidget] } | { tipo: 'par'; ids: [IdWidget, IdWidget] }

/**
 * Junta os pequenos vizinhos em pares, na ordem da lista: a ordem de leitura é a da lista (não há pequeno "subindo" para
 * preencher um buraco lá em cima). Pequeno sem vizinho pequeno fica sozinho na linha.
 */
export function linhasDaGrade(ids: IdWidget[]): LinhaDeWidgets[] {
  const linhas: LinhaDeWidgets[] = []
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]
    if (TAMANHO[id] === 'grande') linhas.push({ tipo: 'grande', ids: [id] })
    else if (i + 1 < ids.length && TAMANHO[ids[i + 1]] === 'pequeno') linhas.push({ tipo: 'par', ids: [id, ids[++i]] })
    else linhas.push({ tipo: 'sozinho', ids: [id] })
  }
  return linhas
}

/** Um cartão numa linha do computador: quantas das 12 colunas ele ocupa. */
export interface CelulaDoComputador { id: IdWidget; colunas: number }

/**
 * A grade do computador: linhas de 12 colunas, na ordem da lista. O gráfico do ano ocupa 8 e o resumo do mês 4 (cabe ao lado),
 * os grandes 6 (dois por linha) e os pequenos 3. O cartão que não cabe na sobra da linha começa a próxima; a sobra vai para
 * os cartões da linha (todos iguais: dividem por igual; senão, o último cresce). Assim a linha sempre fecha, sem buraco.
 */
export function linhasDoComputador(ids: IdWidget[], tamanhos?: TamanhosNoComputador): CelulaDoComputador[][] {
  const escolhida = (id: IdWidget) => tamanhos?.[id]?.c
  const largura = (id: IdWidget) => escolhida(id) ?? (id === 'evolucao' ? 8 : id === 'resumo-mes' ? 4 : TAMANHO[id] === 'pequeno' ? 3 : 6)
  const linhas: CelulaDoComputador[][] = []
  let linha: CelulaDoComputador[] = []
  let usadas = 0
  const fechar = () => {
    if (!linha.length) return
    const sobra = 12 - usadas
    // a sobra vai só para quem a pessoa não redimensionou; se todos foram, o espaço fica (outro cartão pode encaixar nele)
    const livres = linha.filter((x) => escolhida(x.id) === undefined)
    if (sobra > 0 && livres.length) {
      if (livres.length === linha.length && linha.every((x) => x.colunas === linha[0].colunas) && 12 % linha.length === 0) {
        linha = linha.map((x) => ({ ...x, colunas: 12 / linha.length }))
      } else {
        const ultimo = livres[livres.length - 1]
        linha = linha.map((x) => (x === ultimo ? { ...x, colunas: x.colunas + sobra } : x))
      }
    }
    linhas.push(linha)
    linha = []
    usadas = 0
  }
  for (const id of ids) {
    const w = largura(id)
    if (usadas + w > 12) fechar()
    linha.push({ id, colunas: w })
    usadas += w
  }
  fechar()
  return linhas
}

/**
 * O tamanho que a pessoa deu a um cartão no computador (arrastando o canto, no modo Arrumar): `c` colunas das 12 e `l`
 * linhas da grade (veja GRADE). Sem `l`, a altura é a do conteúdo. O celular ignora.
 */
export interface TamanhoNoComputador { c: number; l?: number }
export type TamanhosNoComputador = Partial<Record<IdWidget, TamanhoNoComputador>>

/**
 * A grade do computador em números: 12 colunas, linhas de 8 px e 16 px entre os cartões (um passo de 24 px na altura).
 * A posição de cada cartão é só conta com esses números: nunca depende de medir a tela no meio do arrasto (é o que deixa
 * o redimensionar liso, sem travar).
 */
export const GRADE = { colunas: 12, linha: 8, vao: 16, maxLinhas: 40 } as const
const PASSO = GRADE.linha + GRADE.vao
/** Quantas linhas da grade uma altura em px ocupa (para cima: o cartão nunca corta o conteúdo). */
export const linhasPara = (px: number) => Math.max(1, Math.ceil((px + GRADE.vao) / PASSO))
/** A altura, em px, de um cartão de `l` linhas. */
export const alturaDe = (l: number) => l * PASSO - GRADE.vao

/** O menor tamanho de cada cartão (colunas, altura em px): abaixo disso o conteúdo não cabe direito. */
const MINIMO: Record<IdWidget, [number, number]> = {
  evolucao: [5, 340], 'resumo-mes': [3, 170],
  contas: [4, 200], ultimos: [4, 200], categorias: [4, 180], orientacao: [4, 180], dividas: [4, 180], receber: [3, 150],
  metas: [4, 180], guardado: [3, 150], cartoes: [3, 150], 'gasto-mes': [4, 130],
  'entrou-saiu': [2, 120], 'gasto-dia': [2, 110], nota: [2, 110], comparacao: [2, 110],
}
export const minimoDe = (id: IdWidget) => ({ c: MINIMO[id][0], l: linhasPara(MINIMO[id][1]) })

/** Põe o tamanho dentro dos limites: entre o mínimo do cartão e a grade inteira (12 colunas, 40 linhas). */
export function limitarTamanho(id: IdWidget, t: TamanhoNoComputador): TamanhoNoComputador {
  const min = minimoDe(id)
  const c = Math.max(min.c, Math.min(GRADE.colunas, Math.round(t.c)))
  return t.l === undefined ? { c } : { c, l: Math.max(min.l, Math.min(GRADE.maxLinhas, Math.round(t.l))) }
}

/** Um cartão posto na grade do computador: coluna e linha onde começa, largura e altura em células. */
export interface Bloco { id: IdWidget; x: number; y: number; w: number; h: number; fixo: boolean }

/**
 * Encaixa os cartões, na ordem, como bloquinhos: cada um vai para o primeiro lugar livre (de cima para baixo, da esquerda
 * para a direita) onde cabe inteiro; assim um cartão baixo pode ir para o lado de um alto, embaixo de outro. Depois, o
 * cartão de altura automática estica até o fundo do mais alto que começa na mesma linha, se o espaço embaixo dele estiver
 * livre (a fileira fica alinhada, sem degrau). Puro: só conta, nada de medir a tela.
 * `fixo`: a pessoa escolheu a altura; senão é a do conteúdo. `preso`: um cartão que fica onde está (o que a pessoa está
 * puxando pelo canto, para não fugir do mouse); os outros se encaixam em volta dele.
 */
export function encaixar(itens: { id: IdWidget; w: number; h: number; fixo: boolean }[], colunas: number = GRADE.colunas, preso?: { id: IdWidget; x: number; y: number }): Bloco[] {
  const ocupado: number[] = [] // uma máscara de bits por linha da grade
  const mascara = (x: number, w: number) => ((1 << w) - 1) << x
  const livre = (x: number, y: number, w: number, h: number) => {
    const bits = mascara(x, w)
    for (let r = y; r < y + h; r++) if ((ocupado[r] ?? 0) & bits) return false
    return true
  }
  const blocos: Bloco[] = []
  const doPreso = preso && itens.find((it) => it.id === preso.id)
  let blocoPreso: Bloco | null = null
  if (preso && doPreso) {
    const w = Math.max(1, Math.min(colunas - preso.x, doPreso.w)), h = Math.max(1, doPreso.h)
    for (let r = preso.y; r < preso.y + h; r++) ocupado[r] = (ocupado[r] ?? 0) | mascara(preso.x, w)
    blocoPreso = { id: preso.id, x: preso.x, y: preso.y, w, h, fixo: doPreso.fixo }
  }
  for (const it of itens) {
    if (blocoPreso && it.id === blocoPreso.id) { blocos.push(blocoPreso); continue }
    const w = Math.max(1, Math.min(colunas, it.w)), h = Math.max(1, it.h)
    let x = 0, y = 0
    procura: for (;; y++) for (x = 0; x + w <= colunas; x++) if (livre(x, y, w, h)) break procura
    for (let r = y; r < y + h; r++) ocupado[r] = (ocupado[r] ?? 0) | mascara(x, w)
    blocos.push({ id: it.id, x, y, w, h, fixo: it.fixo })
  }
  for (const b of blocos) {
    if (b.fixo) continue
    const fundo = Math.max(...blocos.filter((o) => o.y === b.y).map((o) => o.y + o.h))
    const bits = mascara(b.x, b.w)
    while (b.y + b.h < fundo && !((ocupado[b.y + b.h] ?? 0) & bits)) {
      ocupado[b.y + b.h] = (ocupado[b.y + b.h] ?? 0) | bits
      b.h++
    }
  }
  return blocos
}

/** A altura da grade inteira, em linhas. */
export const linhasDaGradeToda = (blocos: Bloco[]) => blocos.reduce((m, b) => Math.max(m, b.y + b.h), 0)

/** O que a pessoa arrumou na Início do celular. */
export interface ArrumacaoInicio {
  /** O jeito de ver em que a arrumação foi feita: trocar de jeito recomeça pelo modelo do novo. */
  base: Detalhe
  /** Os cartões na ordem em que aparecem (inclusive os que agora não têm o que mostrar: guardam o lugar). */
  ordem: IdWidget[]
  /** Cartões do modelo que a pessoa tirou: não voltam sozinhos. */
  removidos: IdWidget[]
  /** Quando foi arrumada (ISO): entre a cópia do aparelho e a do banco, vale a mais recente. */
  em: string
  /** O tamanho dos cartões no computador (só os que a pessoa redimensionou). O celular não usa, mas guarda. */
  tamanhos?: TamanhosNoComputador
}

/** Tudo o que o celular guarda da pessoa (perfis.celular). */
export interface Celular { v: 1; inicio?: ArrumacaoInicio }

const ehId = (x: unknown): x is IdWidget => typeof x === 'string' && x in TAMANHO
const semRepetir = <T,>(xs: T[]) => [...new Set(xs)]

/** Lê os tamanhos do computador: o que não tiver o formato certo some; o que passar dos limites volta para eles. */
function normTamanhos(x: unknown): TamanhosNoComputador | undefined {
  if (!x || typeof x !== 'object') return undefined
  const saida: TamanhosNoComputador = {}
  for (const [id, t] of Object.entries(x as Record<string, unknown>)) {
    if (!ehId(id) || !t || typeof t !== 'object') continue
    const { c, l } = t as { c?: unknown; l?: unknown }
    if (typeof c !== 'number' || !Number.isFinite(c)) continue
    saida[id] = limitarTamanho(id, typeof l === 'number' && Number.isFinite(l) ? { c, l } : { c })
  }
  return Object.keys(saida).length ? saida : undefined
}

/** Lê o que veio do banco ou do aparelho; o que não tiver o formato certo (ou for de outra versão do app) é ignorado. */
export function normCelular(x: unknown): Celular | null {
  if (!x || typeof x !== 'object') return null
  const i = (x as { inicio?: unknown }).inicio
  if (!i || typeof i !== 'object') return { v: 1 }
  const a = i as Partial<Record<keyof ArrumacaoInicio, unknown>>
  if (!['simples', 'equilibrado', 'detalhado'].includes(a.base as string) || !Array.isArray(a.ordem)) return { v: 1 }
  const tamanhos = normTamanhos(a.tamanhos)
  return {
    v: 1,
    inicio: {
      base: a.base as Detalhe,
      ordem: semRepetir(a.ordem.filter(ehId)),
      removidos: semRepetir(Array.isArray(a.removidos) ? a.removidos.filter(ehId) : []),
      em: typeof a.em === 'string' ? a.em : '',
      ...(tamanhos ? { tamanhos } : {}),
    },
  }
}

/** Entre duas cópias (aparelho e banco), a arrumada por último. */
export const maisRecente = (a: Celular | null, b: Celular | null): Celular | null =>
  !a?.inicio ? b ?? a : !b?.inicio ? a : (a.inicio.em >= b.inicio.em ? a : b)

/**
 * Os cartões da Início, na ordem, antes de tirar os que não têm o que mostrar agora:
 * - sem arrumação (ou feita em outro jeito de ver), vale o modelo do jeito;
 * - cartão que a versão do app não conhece some; repetido conta uma vez;
 * - cartão do modelo que a pessoa nunca viu nem tirou (cartão novo do app) entra junto do vizinho que ele tem no modelo.
 */
export function cartoesDaInicio(a: ArrumacaoInicio | undefined, detalhe: Detalhe): IdWidget[] {
  const modelo = MODELOS[detalhe]
  if (!a || a.base !== detalhe) return [...modelo]
  const lista = semRepetir(a.ordem.filter(ehId))
  modelo.forEach((id, i) => {
    if (lista.includes(id) || a.removidos.includes(id)) return
    const antes = modelo.slice(0, i).reverse().find((x) => lista.includes(x))
    const depois = modelo.slice(i + 1).find((x) => lista.includes(x))
    if (antes) lista.splice(lista.indexOf(antes) + 1, 0, id)
    else if (depois) lista.splice(lista.indexOf(depois), 0, id)
    else lista.push(id)
  })
  return lista
}

/** Os tamanhos que continuam valendo: os da mesma base (trocar de jeito recomeça tudo pelo modelo). */
const tamanhosDe = (a: ArrumacaoInicio | undefined, detalhe: Detalhe) => (a?.base === detalhe ? a.tamanhos : undefined)

const arrumada = (detalhe: Detalhe, ordem: IdWidget[], removidos: IdWidget[], em: string, tamanhos?: TamanhosNoComputador): ArrumacaoInicio =>
  ({ base: detalhe, ordem, removidos: semRepetir(removidos), em, ...(tamanhos && Object.keys(tamanhos).length ? { tamanhos } : {}) })

/** Põe o cartão no fim da Início (e tira da lista dos removidos). */
export function adicionarCartao(a: ArrumacaoInicio | undefined, detalhe: Detalhe, id: IdWidget, em: string): ArrumacaoInicio {
  const lista = cartoesDaInicio(a, detalhe).filter((x) => x !== id)
  const removidos = a?.base === detalhe ? a.removidos.filter((x) => x !== id) : []
  return arrumada(detalhe, [...lista, id], removidos, em, tamanhosDe(a, detalhe))
}

/** Tira o cartão da Início; ele vai para a folha "Adicionar cartões" e não volta sozinho. */
export function removerCartao(a: ArrumacaoInicio | undefined, detalhe: Detalhe, id: IdWidget, em: string): ArrumacaoInicio {
  const lista = cartoesDaInicio(a, detalhe).filter((x) => x !== id)
  const removidos = a?.base === detalhe ? a.removidos : []
  return arrumada(detalhe, lista, [...removidos, id], em, tamanhosDe(a, detalhe))
}

/**
 * Sobe (-1) ou desce (+1) o cartão uma posição entre os que estão na tela (`visiveis`): trocar com um cartão escondido
 * (sem nada para mostrar agora) pareceria que o botão não fez nada.
 */
export function moverCartao(a: ArrumacaoInicio | undefined, detalhe: Detalhe, id: IdWidget, passo: -1 | 1, visiveis: IdWidget[], em: string): ArrumacaoInicio | null {
  const i = visiveis.indexOf(id)
  const vizinho = visiveis[i + passo]
  if (i < 0 || !vizinho) return null
  const lista = cartoesDaInicio(a, detalhe)
  const x = lista.indexOf(id), y = lista.indexOf(vizinho)
  if (x < 0 || y < 0) return null
  lista[x] = vizinho
  lista[y] = id
  return arrumada(detalhe, lista, a?.base === detalhe ? a.removidos : [], em, tamanhosDe(a, detalhe))
}

/**
 * A nova ordem dos cartões que estão na tela (o arrastar do computador). Os escondidos (sem nada para mostrar agora)
 * continuam onde estavam na lista; os da tela ocupam os lugares deles, na ordem nova.
 */
export function reordenarCartoes(a: ArrumacaoInicio | undefined, detalhe: Detalhe, novaOrdem: IdWidget[], em: string): ArrumacaoInicio {
  const lista = cartoesDaInicio(a, detalhe)
  const naTela = new Set(novaOrdem.filter((id) => lista.includes(id)))
  const fila = [...naTela]
  const ordem = lista.map((id) => (naTela.has(id) ? fila.shift()! : id))
  return arrumada(detalhe, ordem, a?.base === detalhe ? a.removidos : [], em, tamanhosDe(a, detalhe))
}

/** Muda o tamanho de um cartão no computador (null: volta ao tamanho de sempre). */
export function redimensionarCartao(a: ArrumacaoInicio | undefined, detalhe: Detalhe, id: IdWidget, t: TamanhoNoComputador | null, em: string): ArrumacaoInicio {
  const tamanhos: TamanhosNoComputador = { ...tamanhosDe(a, detalhe) }
  if (t) tamanhos[id] = limitarTamanho(id, t)
  else delete tamanhos[id]
  return arrumada(detalhe, cartoesDaInicio(a, detalhe), a?.base === detalhe ? a.removidos : [], em, tamanhos)
}
