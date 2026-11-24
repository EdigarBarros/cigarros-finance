const MARCADOR = 'opuscash.sessao-chave'

function iniciarSessaoDaAba() {
  try {
    const armazenamento = window.sessionStorage
    const existente = armazenamento.getItem(MARCADOR)
    if (existente?.startsWith('opuscash-sessao-')) return { chave: existente, armazenamento }
    // O Supabase usa a chave também para sincronizar sessões. Uma chave por aba mantém as contas independentes.
    const chave = `opuscash-sessao-${crypto.randomUUID()}`
    armazenamento.setItem(MARCADOR, chave)
    return { chave, armazenamento }
  } catch {
    return { chave: MARCADOR, armazenamento: undefined }
  }
}

export const sessaoDaAba = iniciarSessaoDaAba()

export function usuarioDaSessao(): string | null {
  try {
    const sessao = JSON.parse(sessaoDaAba.armazenamento?.getItem(sessaoDaAba.chave) ?? 'null')
    return typeof sessao?.user?.id === 'string' ? sessao.user.id : null
  } catch { return null }
}

export function apagarSessaoDaAba() {
  try {
    for (const sufixo of ['', '-user', '-code-verifier']) {
      sessaoDaAba.armazenamento?.removeItem(sessaoDaAba.chave + sufixo)
    }
  } catch { /* sem acesso ao armazenamento */ }
}

export function apagarSessaoLegada(url: string) {
  try {
    const projeto = new URL(url).hostname.split('.')[0]
    for (const sufixo of ['', '-user', '-code-verifier']) {
      localStorage.removeItem(`sb-${projeto}-auth-token${sufixo}`)
    }
  } catch { /* sem acesso ao armazenamento */ }
}
