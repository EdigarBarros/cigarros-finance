/*
 * Onde fica a sessão do Supabase nesta página.
 *
 * - Na aba (padrão): sessionStorage, com uma chave por aba. Fechar o app ou o navegador encerra o login, e cada aba pode ter a
 *   sua conta.
 * - No aparelho ("Manter conectado", escolhido no login): localStorage, uma conta por aparelho, por no máximo PRAZO_CONECTADO
 *   desde a senha. Vencido o prazo, a sessão é apagada daqui antes de o Supabase lê-la (e encerrada no servidor por
 *   lib/contas.ts): a senha volta a ser pedida. O prazo também vale no banco (migração 46), que encerra sessões mais velhas.
 *
 * A aba usa a sessão do aparelho só quando não tem uma sessão própria e a pessoa não pediu para escolher o perfil (saiu de
 * uma conta nesta aba).
 */

const MARCADOR = 'opuscash.sessao-chave'
/** A chave da sessão do aparelho ("Manter conectado"). */
export const CHAVE_DO_APARELHO = 'opuscash-conectado'
/** De quem é a sessão do aparelho e até quando ela vale: { id, ate }. */
export const CHAVE_DO_PRAZO = 'opuscash.conectado'
/** Nesta aba a pessoa saiu de uma conta: mostra os perfis em vez de abrir sozinha a conta conectada. */
const CHAVE_ESCOLHER = 'opuscash.escolher-perfil'
/** Quanto tempo "Manter conectado" dura depois de digitar a senha. */
export const PRAZO_CONECTADO = 30 * 24 * 60 * 60 * 1000

const SUFIXOS = ['', '-user', '-code-verifier']

type Sessao = { user?: { id?: unknown }; refresh_token?: unknown }

function lerJson<T>(armazenamento: Storage | undefined, chave: string): T | null {
  try { return JSON.parse(armazenamento?.getItem(chave) ?? 'null') as T | null } catch { return null }
}
const idDe = (s: Sessao | null) => (typeof s?.user?.id === 'string' ? s.user.id : null)

function local(): Storage | undefined {
  try { return window.localStorage } catch { return undefined }
}

/** A conta conectada neste aparelho, se o prazo ainda vale e combina com a sessão guardada. */
export function contaConectada(): string | null {
  const armazenamento = local()
  const id = idDe(lerJson<Sessao>(armazenamento, CHAVE_DO_APARELHO))
  const prazo = lerJson<{ id?: unknown; ate?: unknown }>(armazenamento, CHAVE_DO_PRAZO)
  if (!id || prazo?.id !== id || typeof prazo.ate !== 'number') return null
  // prazo no futuro além do máximo também não vale (alguém mexeu no aparelho)
  return Date.now() < prazo.ate && prazo.ate - Date.now() <= PRAZO_CONECTADO ? id : null
}

/** Grava até quando a conta fica conectada (chamado antes de guardar a sessão no aparelho). */
export function marcarPrazo(id: string) {
  try { local()?.setItem(CHAVE_DO_PRAZO, JSON.stringify({ id, ate: Date.now() + PRAZO_CONECTADO })) } catch { /* sem armazenamento */ }
}

/** Apaga a sessão do aparelho e o prazo dela. Devolve o refresh token que estava lá (para encerrar no servidor). */
export function apagarDoAparelho(): string | null {
  const armazenamento = local()
  const rt = lerJson<Sessao>(armazenamento, CHAVE_DO_APARELHO)?.refresh_token
  try {
    for (const sufixo of SUFIXOS) armazenamento?.removeItem(CHAVE_DO_APARELHO + sufixo)
    armazenamento?.removeItem(CHAVE_DO_PRAZO)
  } catch { /* sem armazenamento */ }
  return typeof rt === 'string' && rt ? rt : null
}

export function pedirEscolhaDePerfil(pedir: boolean) {
  try {
    if (pedir) sessionStorage.setItem(CHAVE_ESCOLHER, '1')
    else sessionStorage.removeItem(CHAVE_ESCOLHER)
  } catch { /* sem armazenamento */ }
}

function iniciarSessaoDaAba() {
  // sessão do aparelho vencida, de outra conta que a do prazo, ou sem prazo: sai antes de o Supabase lê-la
  let vencida: string | null = null
  if (local()?.getItem(CHAVE_DO_APARELHO) && !contaConectada()) vencida = apagarDoAparelho()
  try {
    const daAba = window.sessionStorage
    let chaveDaAba = daAba.getItem(MARCADOR)
    if (!chaveDaAba?.startsWith('opuscash-sessao-')) {
      // O Supabase usa a chave também para sincronizar sessões. Uma chave por aba mantém as contas independentes.
      chaveDaAba = `opuscash-sessao-${crypto.randomUUID()}`
      daAba.setItem(MARCADOR, chaveDaAba)
    }
    const temNaAba = Boolean(idDe(lerJson<Sessao>(daAba, chaveDaAba)))
    const escolher = daAba.getItem(CHAVE_ESCOLHER) === '1'
    // link do e-mail (nova senha, confirmação): a sessão que ele traz fica só nesta aba, nunca no aparelho
    const vemDeLink = /(^|[#&?])(access_token|code|error_description)=/.test(location.hash + location.search)
    const aparelho = local()
    if (!temNaAba && !escolher && !vemDeLink && aparelho && contaConectada()) {
      return { modo: 'aparelho' as const, chave: CHAVE_DO_APARELHO, armazenamento: aparelho as Storage | undefined, chaveDaAba, vencida }
    }
    return { modo: 'aba' as const, chave: chaveDaAba, armazenamento: daAba as Storage | undefined, chaveDaAba, vencida }
  } catch {
    return { modo: 'aba' as const, chave: MARCADOR, armazenamento: undefined as Storage | undefined, chaveDaAba: MARCADOR, vencida }
  }
}

export const sessaoDaAba = iniciarSessaoDaAba()

export function usuarioDaSessao(): string | null {
  return idDe(lerJson<Sessao>(sessaoDaAba.armazenamento, sessaoDaAba.chave))
}

/** Guarda uma sessão só nesta aba (entrar sem "Manter conectado"). */
export function guardarNaAba(sessao: object) {
  try { sessionStorage.setItem(sessaoDaAba.chaveDaAba, JSON.stringify(sessao)) } catch { /* sem armazenamento */ }
}

/** O refresh token da sessão própria desta aba (se houver). */
export function refreshDaAba(): string | null {
  let s: Sessao | null = null
  try { s = lerJson<Sessao>(window.sessionStorage, sessaoDaAba.chaveDaAba) } catch { /* sem armazenamento */ }
  return typeof s?.refresh_token === 'string' && s.refresh_token ? s.refresh_token : null
}

/** Apaga a sessão que esta página usa (a da aba ou a do aparelho, com o prazo). */
export function apagarSessaoDaAba() {
  if (sessaoDaAba.modo === 'aparelho') { apagarDoAparelho(); return }
  apagarSoDaAba()
}

/** Apaga só a sessão própria desta aba (a do aparelho continua). */
export function apagarSoDaAba() {
  try {
    for (const sufixo of SUFIXOS) window.sessionStorage.removeItem(sessaoDaAba.chaveDaAba + sufixo)
  } catch { /* sem acesso ao armazenamento */ }
}

export function apagarSessaoLegada(url: string) {
  try {
    const projeto = new URL(url).hostname.split('.')[0]
    for (const sufixo of SUFIXOS) {
      localStorage.removeItem(`sb-${projeto}-auth-token${sufixo}`)
    }
  } catch { /* sem armazenamento */ }
}
