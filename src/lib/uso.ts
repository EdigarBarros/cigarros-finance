import { noAppNativo } from './appAndroid'
import { VERSAO } from './atualizacao'
import { idiomaAtual } from './idioma'
import { supabase } from './supabase'

/*
 * Medição de uso (migração 30), para o painel de suporte entender como o app é usado e melhorá-lo.
 * Guarda só: em qual tela a pessoa está, quanto tempo fica em cada uma, QUANTOS toques e teclas (nunca o que foi digitado),
 * o idioma, se é o site ou o app e a versão. Nada do que a pessoa lança ou escreve sai daqui.
 * Nunca atrapalha o app: qualquer falha (sem a migração, sem internet) é ignorada.
 */

const INTERVALO = 60_000
/** Sem tocar em nada por este tempo, o relógio da tela para (a pessoa largou o aparelho com o app aberto). */
const PARADO = 3 * 60_000

type Conta = { s: number; i: number; v: number }

let tela = 'painel'
let acumulado: Record<string, Conta> = {}
let ultimoTique = Date.now()
let ultimaInteracao = Date.now()
let ultimoEnvio = 0
let ligado = false
let desligado = false

const visivel = () => document.visibilityState === 'visible'
const conta = (t: string) => (acumulado[t] ??= { s: 0, i: 0, v: 0 })

const aparelho = () => {
  if (noAppNativo) return 'app_android'
  try {
    return window.matchMedia('(pointer: coarse)').matches ? 'site_celular' : 'site_computador'
  } catch {
    return 'site'
  }
}

/** Soma à tela atual o tempo desde o último tique (só com o app visível e a pessoa mexendo). */
function contarTempo() {
  const agora = Date.now()
  if (visivel() && agora - ultimaInteracao < PARADO) {
    const s = Math.min(agora - ultimoTique, INTERVALO * 2) / 1000
    if (s > 0) conta(tela).s += s
  }
  ultimoTique = agora
}

function enviar(saiu = false) {
  if (!ligado || desligado) return
  contarTempo()
  const telas: Record<string, Conta> = {}
  for (const [t, c] of Object.entries(acumulado)) {
    const s = Math.round(c.s)
    if (s || c.i || c.v) telas[t] = { s, i: c.i, v: c.v }
  }
  acumulado = {}
  ultimoEnvio = Date.now()
  try {
    void supabase.rpc('uso_ping', {
      p_tela: tela, p_idioma: idiomaAtual(), p_aparelho: aparelho(), p_versao: VERSAO, p_telas: telas, p_saiu: saiu,
    }).then(({ error }) => {
      // sem a migração 30 no banco: para de tentar até recarregar
      if (error && /uso_ping|function|schema cache/i.test(error.message)) desligado = true
    }, () => {})
  } catch { /* nunca atrapalha */ }
}

/** A tela que a pessoa está vendo agora ("inicio", "lancar", "configuracoes", "tutorial"...). */
export function marcarTela(nova: string) {
  if (nova === tela) return
  contarTempo()
  tela = nova
  conta(nova).v += 1
  // troca de tela avisa logo o painel de suporte (sem mandar mais de um sinal a cada 15 s)
  if (ligado && visivel() && Date.now() - ultimoEnvio > 15_000) enviar()
}

/** Um acontecimento de uso: tutorial pulado ou visto, perguntas iniciais respondidas. */
export function marcarUso(tipo: 'tutorial_pulou' | 'tutorial_terminou' | 'tutorial_reviu' | 'questionario_terminou' | 'questionario_refez',
  detalhe: Record<string, string | number | boolean> = {}) {
  if (!ligado || desligado) return
  try {
    void supabase.rpc('uso_marco', { p_tipo: tipo, p_detalhe: detalhe }).then(() => {}, () => {})
  } catch { /* nunca atrapalha */ }
}

/** Liga a medição (com a pessoa logada). Devolve a função que desliga (ao sair da conta). */
export function iniciarUso(): () => void {
  if (ligado) return () => {}
  ligado = true
  ultimoTique = ultimaInteracao = Date.now()
  conta(tela).v += 1
  const mexeu = () => {
    if (Date.now() - ultimaInteracao >= PARADO) ultimoTique = Date.now() // voltou de uma pausa: o tempo parado não conta
    ultimaInteracao = Date.now()
    conta(tela).i += 1
  }
  const aoMudarVisibilidade = () => {
    if (visivel()) {
      ultimoTique = ultimaInteracao = Date.now()
      enviar()
    } else enviar(true)
  }
  const aoSair = () => enviar(true)
  window.addEventListener('pointerdown', mexeu, { passive: true, capture: true })
  window.addEventListener('keydown', mexeu, { passive: true, capture: true })
  document.addEventListener('visibilitychange', aoMudarVisibilidade)
  window.addEventListener('pagehide', aoSair)
  const relogio = window.setInterval(() => { if (visivel()) enviar() }, INTERVALO)
  const primeiro = window.setTimeout(() => enviar(), 1500)
  return () => {
    enviar(true)
    ligado = false
    window.clearInterval(relogio)
    window.clearTimeout(primeiro)
    window.removeEventListener('pointerdown', mexeu, { capture: true })
    window.removeEventListener('keydown', mexeu, { capture: true })
    document.removeEventListener('visibilitychange', aoMudarVisibilidade)
    window.removeEventListener('pagehide', aoSair)
  }
}
