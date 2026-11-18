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
}

/** Tudo o que o celular guarda da pessoa (perfis.celular). */
export interface Celular { v: 1; inicio?: ArrumacaoInicio }

const ehId = (x: unknown): x is IdWidget => typeof x === 'string' && x in TAMANHO
const semRepetir = <T,>(xs: T[]) => [...new Set(xs)]

/** Lê o que veio do banco ou do aparelho; o que não tiver o formato certo (ou for de outra versão do app) é ignorado. */
export function normCelular(x: unknown): Celular | null {
  if (!x || typeof x !== 'object') return null
  const i = (x as { inicio?: unknown }).inicio
  if (!i || typeof i !== 'object') return { v: 1 }
  const a = i as Partial<Record<keyof ArrumacaoInicio, unknown>>
  if (!['simples', 'equilibrado', 'detalhado'].includes(a.base as string) || !Array.isArray(a.ordem)) return { v: 1 }
  return {
    v: 1,
    inicio: {
      base: a.base as Detalhe,
      ordem: semRepetir(a.ordem.filter(ehId)),
      removidos: semRepetir(Array.isArray(a.removidos) ? a.removidos.filter(ehId) : []),
      em: typeof a.em === 'string' ? a.em : '',
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

const arrumada = (detalhe: Detalhe, ordem: IdWidget[], removidos: IdWidget[], em: string): ArrumacaoInicio =>
  ({ base: detalhe, ordem, removidos: semRepetir(removidos), em })

/** Põe o cartão no fim da Início (e tira da lista dos removidos). */
export function adicionarCartao(a: ArrumacaoInicio | undefined, detalhe: Detalhe, id: IdWidget, em: string): ArrumacaoInicio {
  const lista = cartoesDaInicio(a, detalhe).filter((x) => x !== id)
  const removidos = a?.base === detalhe ? a.removidos.filter((x) => x !== id) : []
  return arrumada(detalhe, [...lista, id], removidos, em)
}

/** Tira o cartão da Início; ele vai para a folha "Adicionar cartões" e não volta sozinho. */
export function removerCartao(a: ArrumacaoInicio | undefined, detalhe: Detalhe, id: IdWidget, em: string): ArrumacaoInicio {
  const lista = cartoesDaInicio(a, detalhe).filter((x) => x !== id)
  const removidos = a?.base === detalhe ? a.removidos : []
  return arrumada(detalhe, lista, [...removidos, id], em)
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
  return arrumada(detalhe, lista, a?.base === detalhe ? a.removidos : [], em)
}
