import { useCallback, useState } from 'react'

/*
 * A arrumação da Início neste aparelho: o que a pessoa escolheu (seções recolhidas, a peça do mosaico que já abre sozinha) e
 * a única adaptação que o app propõe a partir do uso: se ela abre a mesma peça do mosaico em vários dias diferentes, o app
 * PERGUNTA se deve deixar essa peça aberta ao entrar. Nada muda sem o "sim", nada some, e "Restaurar a arrumação original"
 * desfaz tudo.
 *
 * Privacidade: fica só no navegador (localStorage), com o mínimo para a regra funcionar: em que dias (contados desde 1970)
 * cada peça foi aberta, só os dos últimos 30 dias. Não vai para o servidor nem para a medição de uso (lib/uso.ts).
 */

export interface Arrumacao {
  /** Seções recolhidas pela pessoa (ex.: 'grafico-ano'). */
  recolhidas: string[]
  /** Peça do mosaico do detalhado que abre sozinha ao entrar (escolha da pessoa). */
  pecaFixa: string | null
  /** Dias em que cada peça foi aberta (dias desde 1970), só os últimos 30. */
  aberturas: Record<string, number[]>
  /** Sugestões de arrumação que a pessoa recusou (não voltam). */
  recusadas: string[]
}

const CHAVE = 'opuscash.inicio.arrumacao'
const VAZIA: Arrumacao = { recolhidas: [], pecaFixa: null, aberturas: {}, recusadas: [] }
/** Abrir a mesma peça em tantos dias diferentes (dentro da janela) faz o app perguntar se ela deve abrir sozinha. */
export const DIAS_PARA_SUGERIR = 3
export const JANELA_DIAS = 14
const GUARDAR_DIAS = 30

const lista = (x: unknown) => (Array.isArray(x) ? x.filter((v): v is string => typeof v === 'string') : [])
const diaDe = (d: Date) => Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000)

/** Lê o que está guardado, sem confiar no formato (versão antiga, armazenamento mexido à mão). */
export function lerArrumacao(texto: string | null): Arrumacao {
  try {
    const x = JSON.parse(texto ?? 'null')
    if (!x || typeof x !== 'object') return VAZIA
    const aberturas: Record<string, number[]> = {}
    for (const [k, v] of Object.entries(x.aberturas ?? {})) if (Array.isArray(v)) aberturas[k] = v.filter((n) => Number.isInteger(n))
    return { recolhidas: lista(x.recolhidas), pecaFixa: typeof x.pecaFixa === 'string' ? x.pecaFixa : null, aberturas, recusadas: lista(x.recusadas) }
  } catch {
    return VAZIA
  }
}

/** Anota que a peça foi aberta hoje (uma vez por dia) e esquece o que passou de 30 dias. */
export function registrarAbertura(a: Arrumacao, peca: string, hoje = new Date()): Arrumacao {
  const d = diaDe(hoje)
  const dias = [...new Set([...(a.aberturas[peca] ?? []), d])].filter((n) => n > d - GUARDAR_DIAS)
  return { ...a, aberturas: { ...a.aberturas, [peca]: dias } }
}

/**
 * A peça que vale sugerir deixar aberta: a aberta em mais dias diferentes nas últimas 2 semanas, se passou de 3 dias, se a
 * pessoa ainda não escolheu nenhuma e não recusou essa.
 */
export function pecaParaSugerir(a: Arrumacao, pecas: string[], hoje = new Date()): string | null {
  if (a.pecaFixa) return null
  const d = diaDe(hoje)
  let melhor: string | null = null
  let vezes = 0
  for (const p of pecas) {
    if (a.recusadas.includes(`peca:${p}`)) continue
    const n = (a.aberturas[p] ?? []).filter((x) => x > d - JANELA_DIAS).length
    if (n >= DIAS_PARA_SUGERIR && n > vezes) { melhor = p; vezes = n }
  }
  return melhor
}

/** A pessoa mudou alguma coisa na arrumação (aparece "Restaurar a arrumação original"). */
export const arrumacaoMudou = (a: Arrumacao) => a.recolhidas.length > 0 || a.pecaFixa !== null

function ler() {
  try { return lerArrumacao(localStorage.getItem(CHAVE)) } catch { return VAZIA }
}
function gravar(a: Arrumacao) {
  try { localStorage.setItem(CHAVE, JSON.stringify(a)) } catch { /* sem armazenamento: vale até recarregar */ }
}

export function useArrumacao() {
  const [a, setA] = useState<Arrumacao>(ler)
  const mudar = useCallback((f: (x: Arrumacao) => Arrumacao) => setA((x) => { const n = f(x); gravar(n); return n }), [])
  return {
    a,
    recolhida: (id: string) => a.recolhidas.includes(id),
    alternar: (id: string) => mudar((x) => ({ ...x, recolhidas: x.recolhidas.includes(id) ? x.recolhidas.filter((r) => r !== id) : [...x.recolhidas, id] })),
    abriuPeca: (id: string) => mudar((x) => registrarAbertura(x, id)),
    fixarPeca: (id: string | null) => mudar((x) => ({ ...x, pecaFixa: id })),
    recusar: (id: string) => mudar((x) => ({ ...x, recusadas: [...new Set([...x.recusadas, id])] })),
    /** Volta tudo ao original e esquece o uso anotado (as recusas continuam valendo). */
    restaurar: () => mudar((x) => ({ ...VAZIA, recusadas: x.recusadas })),
  }
}
