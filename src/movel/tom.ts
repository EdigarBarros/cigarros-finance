/**
 * A cor do topo de cada página do celular. Cada tom é um degradê escuro que desce até o fundo da tela (as cores são as do
 * OpusCash: verde-água da marca para o que sobra, coral para o que falta, azul do caixa, âmbar das dívidas, violeta dos
 * investimentos; 'cor' usa uma cor passada pela tela, como a do cartão de crédito). O texto do topo é sempre branco: os
 * degradês são escuros nos dois temas. Os degradês ficam em movel.css (`.movel-fundo i[data-t=…]`).
 */
export type Tom = 'sobra' | 'falta' | 'guardado' | 'dividas' | 'invest' | 'cor'

export const TONS: Tom[] = ['sobra', 'falta', 'guardado', 'dividas', 'invest', 'cor']
