import { LOCAL_DAS_DATAS } from '../lib/format'

/**
 * Dados e medidas das telas da apresentação (as telas em si estão em ApresentacaoTelas.tsx): tamanho de desenho,
 * onde fica cada bloco, os números de demonstração e o formato dos valores. A Apresentacao usa as medidas para mirar
 * a câmera; as telas, para se desenhar.
 */
export const DW = 1280, DH = 820
export type Ret = [x: number, y: number, w: number, h: number]
export const TELAS = ['inicio', 'ano', 'cartoes', 'lanc', 'metas'] as const
export type Tela = (typeof TELAS)[number]

/** n colunas iguais numa faixa de 1000 px, a partir de x = 252 (onde a barra lateral termina). */
const coluna = (i: number, n: number, y: number, h: number, gap = 12): Ret => {
  const w = (1000 - gap * (n - 1)) / n
  return [252 + i * (w + gap), y, w, h]
}

export const BLOCOS = {
  inicio: {
    topo: [252, 26, 1000, 66], hero: [252, 108, 692, 452],
    k1: [960, 108, 292, 62], k2: [960, 182, 292, 62], k3: [960, 256, 292, 62], vemai: [960, 332, 292, 228],
    c0: coluna(0, 6, 576, 120), c1: coluna(1, 6, 576, 120), c2: coluna(2, 6, 576, 120),
    c3: coluna(3, 6, 576, 120), c4: coluna(4, 6, 576, 120), c5: coluna(5, 6, 576, 120),
    saude: [252, 712, 1000, 92],
  },
  ano: { topo: [252, 26, 1000, 60], hero: [252, 100, 1000, 136], meses: [252, 250, 1000, 108], graf: [252, 372, 1000, 432] },
  cartoes: {
    topo: [252, 26, 1000, 66], resumo: [252, 104, 1000, 168],
    nubank: [252, 292, 320, 196], itau: [592, 292, 320, 196], novo: [932, 292, 320, 176],
    limites: [252, 508, 1000, 108], fatura: [252, 636, 490, 170], proximas: [762, 636, 490, 170],
  },
  lanc: { topo: [252, 26, 1000, 66], cal: [252, 104, 330, 300], onde: [252, 420, 330, 384], sobrou: [602, 104, 650, 150], lista: [602, 272, 650, 532] },
  metas: {
    topo: [252, 26, 1000, 66], resumo: [252, 104, 1000, 170], quando: [252, 292, 580, 200], pormes: [852, 292, 400, 200],
    p1: [252, 512, 320, 294], p2: [592, 512, 320, 294], p3: [932, 512, 320, 294],
  },
} satisfies Record<Tela, Record<string, Ret>>

/** Regiões que a câmera enquadra e que não são um bloco só. */
export const ZONAS: Record<string, Ret> = {
  'cartoes.par': [252, 292, 660, 196],
  'metas.potes': [252, 512, 1000, 294],
  'lanc.lado': [602, 104, 650, 700],
}

export const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const moedaRedonda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
export const compacto = new Intl.NumberFormat(LOCAL_DAS_DATAS, { notation: 'compact', maximumFractionDigits: 1 })
export const R = (n: number) => moeda.format(n)

export type Formato = 'brl' | 'mais' | 'menos' | 'pct' | 'int'
export const formatar = (f: Formato, v: number) =>
  f === 'pct' ? `${Math.round(v)}%` : f === 'int' ? String(Math.round(v)) : f === 'mais' ? `+ ${R(v)}` : f === 'menos' ? `− ${R(v)}` : R(v)

/** Escalonamento: o item i de n começa um pouco depois do anterior (a mesma conta está no CSS). */
export const escalonar = (k: number, i: number, n: number, passo = 0.15) => Math.min(1, Math.max(0, k * (1 + (n - 1) * passo) - i * passo))

// ─── dados de demonstração (milhares de reais), de janeiro a dezembro de 2026 ───
export const DIVIDA = [76.5, 74.6, 72.7, 70.8, 68.4, 65.9, 63.4, 61.0, 58.7, 56.4, 54.7, 53.0]
export const GUARDADO = [12.4, 13.6, 14.9, 16.2, 17.5, 18.7, 20.0, 21.3, 22.7, 24.1, 25.3, 26.5]
export const INVESTIDO = [13.0, 21.5, 29.0, 34.0, 37.0, 41.5, 46.5, 50.0, 51.8, 53.8, 54.9, 56.0]
export const ENTROU = [7.2, 7.4, 7.7, 8.1, 7.0, 7.15, 7.4, 6.5, 8.0, 8.9]
export const SAIU = [5.8, 5.5, 6.6, 5.8, 5.9, 6.22, 6.0, 6.61, 7.16, 5.66]
export const OUTUBRO = 9
/** Até onde vai o eixo do gráfico (mil reais). */
export const TETO = 80

/** Tamanho da área do gráfico grande (as camadas 3D têm esse tamanho). */
export const PLOT = { w: 640, h: 270 }
/** Valor da dívida (em reais) num ponto x da área do gráfico grande: o rótulo que acompanha a linha. */
export function dividaEm(x: number) {
  const i = Math.min(OUTUBRO, Math.max(0, (x / PLOT.w) * 12 - 0.5))
  const a = Math.floor(i), t = i - a
  return moedaRedonda.format((DIVIDA[a] + ((DIVIDA[Math.min(OUTUBRO, a + 1)] ?? DIVIDA[a]) - DIVIDA[a]) * t) * 1000)
}
