/**
 * O que o Kairo (o consultor em pessoa, components/Kairo.tsx) sente e diz em cada tela. Puro como o motor: sem React,
 * sem banco. Ele não calcula nada novo: lê o que o motor já decidiu (lib/analise.ts: o plano de ação e os sinais) e o
 * conselheiro (lib/conselheiro.ts), e escolhe o que vale dizer na tela aberta.
 */
import type { Acao, Analise } from './analise'
import type { Conselho, Destino } from './conselheiro'

export type Humor = 'calmo' | 'feliz' | 'preocupado' | 'pensando' | 'comemorando'

/** De onde a fala veio decide o que "Agora não" faz (só o conselheiro tem o "esconder até o mês que vem"). */
export type OrigemDaFala = 'plano' | 'conselho' | 'sinal'

export interface FalaDoKairo {
  /** Estável: `<origem>:<id do motor>`. */
  id: string
  origem: OrigemDaFala
  /** O id no motor de origem (o do conselheiro serve para "Agora não"). */
  idOrigem: string
  tom: 'urgente' | 'atencao' | 'bom' | 'info'
  icone: string
  titulo: string
  texto: string
  destino: Destino
  botao: string
  prioridade: number
}

const PESO: Record<FalaDoKairo['tom'], number> = { urgente: 3000, atencao: 2000, bom: 1000, info: 0 }

const deAcao = (x: Acao): FalaDoKairo => ({
  id: `plano:${x.id}`, origem: 'plano', idOrigem: x.id, icone: x.icone, titulo: x.titulo, texto: x.porque,
  destino: x.destino, botao: x.botao, prioridade: x.prioridade,
  tom: x.urgencia === 'urgente' ? 'urgente' : x.urgencia === 'importante' ? 'atencao' : 'info',
})

const deConselho = (c: Conselho): FalaDoKairo => ({
  id: `conselho:${c.id}`, origem: 'conselho', idOrigem: c.id, icone: c.icone, titulo: c.titulo, texto: c.porque,
  destino: c.destino, botao: c.botao, prioridade: c.prioridade,
  tom: c.gravidade === 'urgente' ? 'urgente' : c.gravidade === 'atencao' ? 'atencao' : 'bom',
})

/** Mesmo assunto dito por dois motores: compara o título sem acento, maiúscula e números. */
const assunto = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]+/g, ' ').trim()

/**
 * Tudo o que o Kairo tem para dizer, já ordenado: urgente, atenção, elogio e o resto; dentro de cada um, pela prioridade
 * do motor. Sem repetir assunto (o plano de ação fala primeiro, depois o conselheiro, depois os sinais sem passo).
 */
export function falasDoKairo(a: Analise | null, conselhos: Conselho[]): FalaDoKairo[] {
  const todas: FalaDoKairo[] = []
  const vistos = new Set<string>()
  const por = (f: FalaDoKairo) => {
    const k = assunto(f.titulo)
    if (vistos.has(k) || vistos.has(f.id)) return
    vistos.add(k); vistos.add(f.id)
    todas.push(f)
  }
  if (a) a.acoes.forEach((x) => por(deAcao(x)))
  conselhos.forEach((c) => por(deConselho(c)))
  // os sinais que não viraram passo do plano são descobertas: só os que pedem atenção ou elogiam
  if (a) {
    for (const s of a.sinais) {
      if (s.acao || s.tom === 'medio') continue
      por({
        id: `sinal:${s.id}`, origem: 'sinal', idOrigem: s.id, icone: s.tom === 'bom' ? 'check' : 'ideia', titulo: s.titulo,
        texto: s.chamado ? `${s.frase} ${s.chamado}` : s.frase, destino: s.destino, botao: '', prioridade: s.forca,
        tom: s.tom === 'bom' ? 'bom' : 'atencao',
      })
    }
  }
  return todas.sort((x, y) => PESO[y.tom] + y.prioridade - (PESO[x.tom] + x.prioridade))
}

/**
 * O que ele diz na tela aberta: o que leva a ela. Na Início, o mais importante de tudo. Nada para esta tela: as mais
 * importantes do resto, marcadas como "de outra tela" pela própria tela (o destino é outro).
 */
export function falasDaTela(pagina: string, todas: FalaDoKairo[], max = 4): { daqui: FalaDoKairo[]; deOutras: FalaDoKairo[] } {
  if (pagina === 'inicio') return { daqui: todas.slice(0, max), deOutras: [] }
  const daqui = todas.filter((f) => f.destino === pagina).slice(0, max)
  const deOutras = todas.filter((f) => f.destino !== pagina && f.tom !== 'info').slice(0, daqui.length ? 1 : 2)
  return { daqui, deOutras }
}

/** O humor do Kairo pelo estado do dinheiro: preocupado com atraso ou urgência, feliz com tudo em ordem. */
export function humorDe(a: Analise | null, falas: FalaDoKairo[]): Humor {
  if (!a || !a.temFluxo) return falas.some((f) => f.tom === 'urgente') ? 'preocupado' : 'calmo'
  if (a.atrasoTotal > 0.009 || falas.some((f) => f.tom === 'urgente') || a.tom === 'ruim') return 'preocupado'
  if (a.tom === 'bom' && !falas.some((f) => f.tom === 'atencao')) return 'feliz'
  return 'calmo'
}

/** O humor de uma fala só (na hora da decisão, no Planejamento, no aviso da reanálise). */
export function humorDoTom(tom: 'bom' | 'medio' | 'ruim' | 'urgente' | 'atencao' | 'elogio' | 'info'): Humor {
  return tom === 'ruim' || tom === 'urgente' ? 'preocupado' : tom === 'bom' || tom === 'elogio' ? 'feliz' : 'calmo'
}
