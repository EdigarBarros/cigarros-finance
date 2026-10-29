import { VERSAO } from './atualizacao'
import { supabase } from './supabase'

/**
 * Registro de erros do app: quando algo quebra na tela de alguém, grava na tabela erros_app (migração 16) para o dono ver depois.
 * Nunca atrapalha o app (qualquer falha aqui é ignorada) e grava no máximo 5 por sessão, sem repetir a mesma mensagem.
 */
const vistos = new Set<string>()

export function registrarErro(erro: unknown, onde: string) {
  try {
    const e = erro instanceof Error ? erro : new Error(String(erro))
    const mensagem = e.message.slice(0, 500) || 'erro sem mensagem'
    if (vistos.size >= 5 || vistos.has(mensagem)) return
    vistos.add(mensagem)
    console.error('[OpusCash]', onde, e)
    void supabase.auth.getSession().then(({ data }) => {
      if (!data.session) return
      return supabase.from('erros_app').insert({
        mensagem, onde: onde.slice(0, 300), detalhe: (e.stack ?? '').slice(0, 4000), versao: VERSAO,
      })
    }).catch(() => {})
  } catch { /* nunca atrapalha */ }
}

export function iniciarRegistroDeErros() {
  window.addEventListener('error', (ev) => registrarErro(ev.error ?? ev.message, `janela ${location.hash || '/'}`))
  window.addEventListener('unhandledrejection', (ev) => registrarErro(ev.reason, `promessa ${location.hash || '/'}`))
}
