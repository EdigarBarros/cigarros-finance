import { hojeLocal } from './cartoes'
import type { Meta, MovimentoMeta } from './types'

const chaveMes = (iso: string) => Number(iso.slice(0, 4)) * 12 + Number(iso.slice(5, 7)) - 1
// data local (não UTC): à noite no Brasil o UTC já é o dia seguinte
const hojeIso = () => hojeLocal()

export interface SituacaoMeta {
  meta: Meta
  guardado: number
  falta: number
  /** 0 a 1. */
  progresso: number
  batida: boolean
  /** Quanto guardar por mês para chegar no prazo (null sem prazo ou já batida). */
  porMesNoPrazo: number | null
  /** O prazo já passou e falta dinheiro. */
  atrasada: boolean
  /** Média guardada por mês nos últimos meses (null se não houve aporte). */
  ritmo: number | null
  /** [ano, mês] em que chega no ritmo atual. */
  previsao: [number, number] | null
  movimentos: MovimentoMeta[]
}

/** Situação de uma meta hoje, a partir dos movimentos dela. */
export function situacaoMeta(meta: Meta, todos: MovimentoMeta[], hoje = hojeIso()): SituacaoMeta {
  const movimentos = todos.filter((m) => m.meta_id === meta.id).sort((a, b) => b.data.localeCompare(a.data))
  const guardado = Math.round(movimentos.reduce((a, m) => a + m.valor, 0) * 100) / 100
  const falta = Math.max(0, Math.round((meta.alvo - guardado) * 100) / 100)
  const batida = falta === 0
  const agora = chaveMes(hoje)

  let porMesNoPrazo: number | null = null
  let atrasada = false
  if (meta.prazo && !batida) {
    const meses = chaveMes(meta.prazo) - agora
    if (meses < 0) atrasada = true
    // conta o mês atual: com prazo em dezembro e hoje em outubro, são 3 meses para guardar (out, nov, dez)
    porMesNoPrazo = falta / Math.max(1, meses + 1)
  }

  // Ritmo: o que entrou nos últimos 3 meses (ou desde o primeiro aporte, se for mais recente), por mês.
  let ritmo: number | null = null
  const primeiro = movimentos[movimentos.length - 1]
  if (primeiro) {
    const janela = Math.min(3, agora - chaveMes(primeiro.data) + 1)
    const soma = movimentos.filter((m) => agora - chaveMes(m.data) < janela).reduce((a, m) => a + m.valor, 0)
    ritmo = soma > 0 ? soma / janela : null
  }
  let previsao: [number, number] | null = null
  if (!batida && ritmo) {
    const t = agora + Math.ceil(falta / ritmo - 0.0001)
    previsao = [Math.floor(t / 12), (t % 12) + 1]
  }

  return {
    meta, guardado, falta, batida, atrasada, porMesNoPrazo, ritmo, previsao, movimentos,
    progresso: Math.min(1, Math.max(0, guardado / meta.alvo)),
  }
}

/** Pontos de partida para quem não sabe por onde começar. */
export const MODELOS: { nome: string; icone: string; cor: string; dica: string; reserva?: boolean }[] = [
  { nome: 'Reserva de emergência', icone: '🛟', cor: '#30d158', dica: '6 meses do que você gasta, para imprevistos', reserva: true },
  { nome: 'Viagem', icone: '✈️', cor: '#64d2ff', dica: 'passagens, hospedagem e passeios' },
  { nome: 'Carro', icone: '🚗', cor: '#0a84ff', dica: 'entrada ou o carro inteiro' },
  { nome: 'Casa própria', icone: '🏠', cor: '#ff9f0a', dica: 'entrada do imóvel' },
  { nome: 'Estudos', icone: '🎓', cor: '#5e5ce6', dica: 'curso, faculdade, intercâmbio' },
  { nome: 'Aposentadoria', icone: '🌴', cor: '#bf5af2', dica: 'para o futuro, sem pressa' },
]
