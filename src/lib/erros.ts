import { ehErroDeVersao, VERSAO, versaoNovaNecessaria } from './atualizacao'
import { supabase } from './supabase'

/**
 * Registro de erros do app: quando algo quebra na tela de alguém, grava na tabela erros_app (migração 16) para o dono ver depois.
 * Nunca atrapalha o app (qualquer falha aqui é ignorada) e grava no máximo 5 por sessão, sem repetir a mesma mensagem.
 */
const vistos = new Set<string>()
const classes = new Set(['TypeError', 'RangeError', 'SyntaxError', 'ReferenceError', 'AbortError'])
type OrigemDoErro = 'janela' | 'promessa' | 'tela' | 'consultor' | 'invest importar' | 'invest gravar importacao'
  | 'leitor pdf' | 'extrato pdf' | 'importar extrato' | 'extrato sem lancamentos'

export function registrarErro(erro: unknown, onde: OrigemDoErro) {
  try {
    const e = erro instanceof Error ? erro : new Error(String(erro))
    // saiu versão nova e esta aba ainda pedia um pedaço da antiga (em qualquer lugar, não só nas telas): não é defeito,
    // é só atualizar. O app recarrega na hora certa (lib/atualizacao.ts).
    if (ehErroDeVersao(e)) { versaoNovaNecessaria(); return }
    if (/^script error\.?$/i.test(e.message.trim())) return
    const mensagem = classes.has(e.name) ? e.name : 'Erro do aplicativo'
    const chave = `${onde}:${mensagem}`
    if (vistos.size >= 5 || vistos.has(chave)) return
    vistos.add(chave)
    if (import.meta.env.DEV) console.error('[OpusCash]', onde, e)
    void supabase.auth.getSession().then(({ data }) => {
      if (!data.session) return
      return supabase.from('erros_app').insert({
        mensagem, onde, versao: VERSAO,
      })
    }).catch(() => {})
  } catch { /* nunca atrapalha */ }
}

export function iniciarRegistroDeErros() {
  window.addEventListener('error', (ev) => registrarErro(ev.error ?? ev.message, 'janela'))
  window.addEventListener('unhandledrejection', (ev) => registrarErro(ev.reason, 'promessa'))
}
