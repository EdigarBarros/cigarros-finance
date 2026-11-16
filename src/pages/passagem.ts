import type { ConsultorReal } from './algoritmoConsultor'

/**
 * A passagem do carrossel (Apresentacao.tsx) para o motor (Algoritmo.tsx): a sexta face do carrossel é a tela do
 * Consultor, e a câmera para nela exatamente onde o motor começa. Quem sabe onde é esse lugar é o motor (ele carrega a
 * foto no tema, idioma e aparelho certos e calcula o retângulo em medir()); ele publica aqui e o carrossel acompanha.
 * Assim os dois usam a mesma foto (o mesmo canvas, com as mesmas beiradas apagadas) no mesmo retângulo, ao pixel.
 */
export interface Passagem {
  real: ConsultorReal
  /** canto de cima à esquerda da tela do Consultor na área presa (px de CSS) e a escala (px por px da foto) */
  x: number; y: number; s: number
}

let atual: Passagem | null = null
const ouvintes = new Set<(p: Passagem | null) => void>()
let pedido: (() => void) | null = null

export function publicarPassagem(p: Passagem | null) {
  const a = atual
  if (a && p && a.real === p.real && a.x === p.x && a.y === p.y && a.s === p.s) return
  atual = p
  ouvintes.forEach((f) => f(p))
}

export function ouvirPassagem(f: (p: Passagem | null) => void) {
  ouvintes.add(f)
  f(atual)
  return () => { ouvintes.delete(f) }
}

/** O motor diz como pedir a foto antes da hora (o carrossel chega na sexta face antes de o motor estar perto). */
export function aoPedirConsultor(f: () => void) {
  pedido = f
  return () => { if (pedido === f) pedido = null }
}

export function pedirConsultor() { pedido?.() }
