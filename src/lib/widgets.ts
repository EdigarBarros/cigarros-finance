/**
 * Os cartões ("widgets") da Início do celular e o modelo de cada jeito de ver. Puro: quem desenha cada um é
 * src/movel/widgets.tsx. No celular, o jeito (simples, equilibrado, detalhado) é o ponto de partida: diz quais cartões
 * aparecem e em que ordem.
 */
import type { Detalhe } from './types'

export type IdWidget =
  | 'contas' | 'gasto-mes' | 'ultimos' | 'categorias' | 'orientacao' | 'entrou-saiu' | 'gasto-dia' | 'nota' | 'comparacao'
  | 'dividas' | 'receber' | 'metas' | 'guardado' | 'cartoes'

/** Pequeno ocupa meia linha (dois lado a lado); grande ocupa a linha inteira. */
export type TamanhoWidget = 'pequeno' | 'grande'

export const TAMANHO: Record<IdWidget, TamanhoWidget> = {
  contas: 'grande', 'gasto-mes': 'grande', ultimos: 'grande', categorias: 'grande', orientacao: 'grande',
  'entrou-saiu': 'pequeno', 'gasto-dia': 'pequeno', nota: 'pequeno', comparacao: 'pequeno',
  dividas: 'grande', receber: 'grande', metas: 'grande', guardado: 'grande', cartoes: 'grande',
}

/**
 * O modelo de cada jeito, na ordem das perguntas da Início (docs/arquitetura-do-painel.md, seção 3): como estou, o que
 * preciso fazer, para onde está indo, o que estou construindo. Cartão de módulo desligado (ou sem nada para mostrar) fica
 * de fora sozinho.
 */
export const MODELOS: Record<Detalhe, IdWidget[]> = {
  simples: ['contas', 'ultimos', 'orientacao', 'metas'],
  equilibrado: ['entrou-saiu', 'gasto-dia', 'contas', 'gasto-mes', 'categorias', 'orientacao', 'ultimos', 'dividas', 'metas', 'guardado'],
  detalhado: [
    'entrou-saiu', 'gasto-dia', 'contas', 'gasto-mes', 'categorias', 'nota', 'comparacao', 'orientacao', 'ultimos', 'cartoes',
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
