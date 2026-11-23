/**
 * A cor do topo de cada página do celular. Cada tom é um degradê escuro que desce até o fundo da tela (as cores são as do
 * OpusCash: verde-água da marca para o que sobra, coral para o que falta, azul do caixa, âmbar das dívidas, violeta dos
 * investimentos; 'cor' usa uma cor passada pela tela, como a do cartão de crédito). O texto do topo é sempre branco: os
 * degradês são escuros nos dois temas. Os degradês ficam em movel.css (`.movel-fundo i[data-t=…]`).
 */
export type Tom = 'sobra' | 'falta' | 'guardado' | 'dividas' | 'invest' | 'cor'

export const TONS: Tom[] = ['sobra', 'falta', 'guardado', 'dividas', 'invest', 'cor']

/** A cor de cima de cada degradê (o primeiro ponto de `.movel-fundo i[data-t=…]` em movel.css): tem de ser a mesma. */
const TOPO: Record<Exclude<Tom, 'cor'>, string> = { sobra: '#3f9488', falta: '#a8606b', guardado: '#7d84a6', dividas: '#a98656', invest: '#8d7fbd' }

/** Mistura duas cores #rrggbb (`p` da primeira), como o color-mix(in srgb, a p%, b) do CSS. */
function misturar(a: string, b: string, p: number) {
  const n = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  if (!/^#[0-9a-f]{6}$/i.test(a) || !/^#[0-9a-f]{6}$/i.test(b)) return b
  const [x, y] = [n(a), n(b)]
  return '#' + x.map((v, i) => Math.round(v * p + y[i] * (1 - p)).toString(16).padStart(2, '0')).join('')
}

/**
 * A cor do topo da tela aberta no celular: pinta a faixa do relógio e da ilha do iPhone (app na tela de início) e a barra
 * de status do Android, para o degradê continuar por trás delas em vez de uma faixa preta solta.
 */
export function corDoTopo(tom: Tom | null, cor?: string | null): string | null {
  if (!tom) return null
  // 'cor': color-mix(in srgb, cor 50%, #8a8f99), o primeiro ponto do degradê 'cor'
  return tom === 'cor' ? misturar(cor || '#3d4be0', '#8a8f99', 0.5) : TOPO[tom]
}
