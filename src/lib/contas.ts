import { createClient, type AuthChangeEvent, type Session } from '@supabase/supabase-js'
import { useSyncExternalStore } from 'react'
import { supabase } from './supabase'
import {
  apagarDoAparelho, apagarSessaoDaAba, apagarSoDaAba, CHAVE_DO_APARELHO, CHAVE_DO_PRAZO, contaConectada, guardarNaAba, marcarPrazo,
  pedirEscolhaDePerfil, refreshDaAba, sessaoDaAba, usuarioDaSessao,
} from './sessaoDaAba'

export { contaConectada, PRAZO_CONECTADO } from './sessaoDaAba'

/**
 * Perfis lembrados no aparelho (nome, e-mail, foto): nenhuma senha nem token fica nesta lista. A sessão fica na aba ou, com
 * "Manter conectado", no lugar do aparelho com prazo (lib/sessaoDaAba.ts).
 */
export interface ContaSalva {
  id: string
  email: string
  nome?: string
  foto?: string | null
  usadaEm: number
}

const CHAVE = 'opuscash.contas'
export const MAX_CONTAS = 5
const CHAVE_ADICIONANDO = 'opuscash.adicionando'

const idDaPagina = usuarioDaSessao()
let idAberto = idDaPagina
let emRecuperacao = false

/** Cliente que não guarda nada: entra, renova ou encerra uma sessão sem mexer na que a página usa. */
function clienteAParte() {
  return createClient(import.meta.env.VITE_SUPABASE_URL as string, import.meta.env.VITE_SUPABASE_ANON_KEY as string, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'opuscash-outra-conta' },
  })
}

/** Encerra no servidor uma sessão que saiu deste aparelho (melhor esforço: sem internet, ela vence sozinha no banco). */
async function encerrarNoServidor(refresh_token: string | null) {
  if (!refresh_token) return
  const tarefa = (async () => {
    const outro = clienteAParte()
    const { data } = await outro.auth.refreshSession({ refresh_token })
    if (data.session) await outro.auth.signOut({ scope: 'local' })
  })().catch(() => {})
  await Promise.race([tarefa, new Promise((r) => window.setTimeout(r, 4000))])
}

// a sessão do aparelho venceu (30 dias) e saiu daqui ao abrir: encerra também no servidor
if (sessaoDaAba.vencida) void encerrarNoServidor(sessaoDaAba.vencida)

// Página na sessão do aparelho: se o prazo vence com o app aberto, ou outra aba sai ou entra com outra conta, recarrega (ao
// abrir, a sessão vencida sai e o perfil pede a senha).
if (sessaoDaAba.modo === 'aparelho') {
  const conferir = () => {
    if (contaConectada() === idAberto) return
    void supabase.auth.stopAutoRefresh()
    location.reload()
  }
  window.setInterval(conferir, 60_000)
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') conferir() })
  window.addEventListener('storage', (e) => { if (e.key === null || e.key === CHAVE_DO_APARELHO || e.key === CHAVE_DO_PRAZO) conferir() })
}

export function concluirRecuperacao() {
  emRecuperacao = false
  if (sessaoDaAba.armazenamento) location.reload()
}

// ---------- preferências do aparelho separadas por conta ----------

/** Chave de uma preferência guardada no aparelho, separada para a conta aberta. */
const daConta = (base: string) => {
  const id = sessaoDaAba.armazenamento ? idDaPagina : idAberto
  return id ? `${base}@${id}` : base
}

/** Lê a preferência da conta aberta; quem ainda não tem uma própria usa a que valia antes (de quando era uma conta só). */
export function lerDaConta(base: string): string | null {
  try { return localStorage.getItem(daConta(base)) ?? localStorage.getItem(base) } catch { return null }
}
export function gravarNaConta(base: string, valor: string) {
  try { localStorage.setItem(daConta(base), valor) } catch { /* sem armazenamento: vale só nesta visita */ }
}
/** Apaga a escolha da conta aberta e a de antes, para voltar ao padrão de verdade. */
export function apagarDaConta(base: string) {
  try { localStorage.removeItem(daConta(base)); if (idDaPagina) localStorage.removeItem(base) } catch { /* nada guardado */ }
}

// ---------- a lista de contas ----------

function ler(texto: string | null): ContaSalva[] {
  try {
    const contas: unknown = JSON.parse(texto ?? '[]')
    if (!Array.isArray(contas)) return []
    return contas.flatMap((c) => {
      if (typeof c?.id !== 'string' || typeof c.email !== 'string') return []
      return [{
        id: c.id,
        email: c.email,
        nome: typeof c.nome === 'string' ? c.nome : undefined,
        foto: typeof c.foto === 'string' ? c.foto : undefined,
        usadaEm: typeof c.usadaEm === 'number' ? c.usadaEm : 0,
      }]
    })
  } catch { return [] }
}

// Elimina as cópias de sessão das versões anteriores, mantendo apenas as informações dos perfis.
function limparPerfisLegados(legado: string | null) {
  if (legado === null) return
  const limpo = JSON.stringify(ler(legado))
  if (limpo !== legado) localStorage.setItem(CHAVE, limpo)
}
try {
  limparPerfisLegados(localStorage.getItem(CHAVE))
  localStorage.removeItem('opuscash.pulso')
  localStorage.removeItem('opuscash.aberturas')
} catch { /* sem armazenamento */ }

const ouvintes = new Set<() => void>()
let cache: { texto: string | null; lista: ContaSalva[] } = { texto: null, lista: [] }
function lista(): ContaSalva[] {
  let texto: string | null = null
  try { texto = localStorage.getItem(CHAVE) } catch { /* sem armazenamento */ }
  if (texto !== cache.texto) cache = { texto, lista: ler(texto) }
  return cache.lista
}

function gravar(contas: ContaSalva[]) {
  const ordenadas = [...contas].sort((a, b) => b.usadaEm - a.usadaEm).slice(0, MAX_CONTAS)
  try { localStorage.setItem(CHAVE, JSON.stringify(ordenadas)) } catch { /* sem armazenamento: o aparelho só não lembra */ }
  ouvintes.forEach((f) => f())
}

window.addEventListener('storage', (e) => {
  if (e.key === CHAVE) {
    try { limparPerfisLegados(localStorage.getItem(CHAVE)) } catch { /* sem armazenamento */ }
  }
  if (e.key === CHAVE || e.key === null) ouvintes.forEach((f) => f())
})

/** As contas lembradas neste aparelho, da usada mais recentemente para a mais antiga. */
export const contasSalvas = () => lista()

export function useContasSalvas() {
  return useSyncExternalStore((f) => { ouvintes.add(f); return () => ouvintes.delete(f) }, lista)
}

/** Atualiza os metadados do perfil depois de uma autenticação. */
function lembrar(s: Session) {
  const atual = lista()
  const antes = atual.find((c) => c.id === s.user.id)
  const nome = typeof s.user.user_metadata?.nome === 'string' ? s.user.user_metadata.nome : undefined
  const email = s.user.email ?? antes?.email ?? ''
  if (antes && antes.email === email && Date.now() - antes.usadaEm < 60_000) return
  gravar([{
    id: s.user.id,
    email,
    nome: antes?.nome || nome,
    foto: antes?.foto,
    usadaEm: Date.now(),
  }, ...atual.filter((c) => c.id !== s.user.id)])
}

/** O painel conta o nome e a foto que a pessoa escolheu, para a lista mostrar como no menu. */
export function atualizarConta(id: string, dados: { nome?: string; foto?: string | null }) {
  const atual = lista()
  const c = atual.find((x) => x.id === id)
  if (!c || (c.nome === dados.nome && c.foto === dados.foto)) return
  gravar(atual.map((x) => (x.id === id ? { ...x, ...dados } : x)))
}

/** Remove o perfil deste aparelho. */
export function esquecerConta(id: string) {
  gravar(lista().filter((x) => x.id !== id))
}

async function encerrarSessao() {
  // nesta aba, depois de sair, aparecem os perfis (a conta conectada no aparelho não abre sozinha)
  pedirEscolhaDePerfil(true)
  try {
    await supabase.auth.stopAutoRefresh()
    // sem resposta do servidor em 6 s, sai assim mesmo (a cópia local é apagada abaixo; a sessão vence no banco)
    await Promise.race([supabase.auth.signOut({ scope: 'local' }), new Promise((r) => window.setTimeout(r, 6000))])
  } catch {
    // A sessão local também é removida quando o servidor está indisponível.
  } finally {
    apagarSessaoDaAba()
    location.reload()
  }
}

/** Volta para os perfis depois de encerrar a sessão ativa. */
export async function sairParaOsPerfis() {
  await encerrarSessao()
}

/** Encerra a sessão ativa e remove o perfil dela deste aparelho. */
export async function sairDestaConta() {
  if (idAberto) esquecerConta(idAberto)
  await encerrarSessao()
}

/**
 * "Sair de todos os aparelhos": encerra no servidor todas as sessões da conta (celular perdido, computador de outra pessoa),
 * inclusive esta. Em todo lugar a senha volta a ser pedida.
 */
export async function sairDeTodosOsAparelhos(): Promise<boolean> {
  const { error } = await supabase.auth.signOut({ scope: 'global' })
  if (error && !/session.*missing|not.*found/i.test(error.message)) return false
  if (contaConectada() === idAberto) apagarDoAparelho()
  pedirEscolhaDePerfil(true)
  apagarSessaoDaAba()
  location.reload()
  return true
}

/** Trocou a senha: as outras sessões da conta (outros aparelhos, outras abas) são encerradas no servidor. */
export async function encerrarOutrasSessoes() {
  try { await supabase.auth.signOut({ scope: 'others' }) } catch { /* sem internet: ficam até vencer */ }
  // a sessão conectada neste aparelho, se for de outra sessão da mesma conta, acabou de ser encerrada
  if (sessaoDaAba.modo === 'aba' && contaConectada() === idAberto) apagarDoAparelho()
}

/**
 * Entra com a senha. A conta é conferida num cliente à parte e a sessão vai para onde a pessoa escolheu: com "Manter
 * conectado", para o aparelho (prazo de 30 dias, uma conta conectada por aparelho); sem ele, só para esta aba. A sessão que
 * ocupava o lugar sai e é encerrada no servidor. Dando certo, a página recarrega na conta. Devolve a mensagem de erro.
 */
export async function entrarComSenha(email: string, senha: string, manter: boolean, aoAcertar?: () => void): Promise<string | null> {
  const { data, error } = await clienteAParte().auth.signInWithPassword({ email: email.trim(), password: senha })
  if (error || !data.session) return error?.message ?? 'Invalid login credentials'
  aoAcertar?.()
  const s = data.session
  lembrar(s)
  pararDeAdicionar()
  // sem armazenamento (navegação privada muito restrita): a sessão fica só na memória desta página
  if (!sessaoDaAba.armazenamento) {
    const { error: e2 } = await supabase.auth.setSession({ access_token: s.access_token, refresh_token: s.refresh_token })
    return e2?.message ?? null
  }
  await supabase.auth.stopAutoRefresh()
  pedirEscolhaDePerfil(false)
  // a sessão própria que a aba tinha (outra conta, ou a mesma sem "Manter conectado") dá lugar à nova
  const daAba = refreshDaAba()
  apagarSoDaAba()
  const antigas = [daAba]
  if (manter) {
    antigas.push(apagarDoAparelho())
    marcarPrazo(s.user.id)
    try { localStorage.setItem(CHAVE_DO_APARELHO, JSON.stringify(s)) } catch { guardarNaAba(s) }
  } else {
    guardarNaAba(s)
  }
  await Promise.all(antigas.filter((rt) => rt && rt !== s.refresh_token).map((rt) => encerrarNoServidor(rt)))
  await Promise.resolve(esperaDaRecarga)
  location.reload()
  return null
}

/** Abre a conta que está conectada neste aparelho (perfil sem senha): a sessão própria da aba, se houver, sai. */
export async function abrirContaConectada(antesDeRecarregar?: Promise<unknown>) {
  pedirEscolhaDePerfil(false)
  if (sessaoDaAba.modo === 'aba' && usuarioDaSessao()) {
    await supabase.auth.stopAutoRefresh()
    const rt = refreshDaAba()
    apagarSoDaAba()
    await encerrarNoServidor(rt)
  }
  await antesDeRecarregar
  location.reload()
}

// ---------- "Adicionar outra conta" ----------

const ouvintesAdicionar = new Set<() => void>()
type Adicionando = { de: string | null; email: string }
let adicionando: Adicionando | null = (() => {
  try { return JSON.parse(sessionStorage.getItem(CHAVE_ADICIONANDO) ?? 'null') as Adicionando | null } catch { return null }
})()

/**
 * Mostra o login por cima da conta aberta (ela continua aberta e lembrada). Entrando, a conta nova vira a aberta; voltando,
 * nada muda. `email` já preenche o campo (conta lembrada cuja sessão venceu).
 */
export function adicionarConta(email = '') {
  adicionando = { de: idAberto, email }
  try { sessionStorage.setItem(CHAVE_ADICIONANDO, JSON.stringify(adicionando)) } catch { /* vale nesta visita */ }
  ouvintesAdicionar.forEach((f) => f())
}
export function pararDeAdicionar() {
  adicionando = null
  try { sessionStorage.removeItem(CHAVE_ADICIONANDO) } catch { /* nada guardado */ }
  ouvintesAdicionar.forEach((f) => f())
}
export function useAdicionando() {
  return useSyncExternalStore((f) => { ouvintesAdicionar.add(f); return () => ouvintesAdicionar.delete(f) }, () => adicionando)
}

// ---------- acompanhando a sessão ----------

/** Quem mostra uma animação ao entrar (a tela de senha) pede para a página esperar ela terminar antes de recarregar. */
let esperaDaRecarga: Promise<unknown> | null = null
export function esperarAntesDeRecarregar(p: Promise<unknown>) { esperaDaRecarga = p }

/** Devolve true quando a página vai recarregar (outra conta entrou): aí a tela de agora fica até lá, sem trocar. */
export function aoMudarSessao(evento: AuthChangeEvent, s: Session | null): boolean {
  if (evento === 'PASSWORD_RECOVERY') emRecuperacao = true
  if (evento === 'SIGNED_OUT') emRecuperacao = false
  if (s && evento !== 'SIGNED_OUT') lembrar(s)
  idAberto = s?.user.id ?? null
  // a página abriu com outra conta (ou sem nenhuma, lendo as preferências de antes): recarrega na conta que entrou
  if (evento === 'SIGNED_IN' && s && s.user.id !== idDaPagina && !emRecuperacao) {
    pararDeAdicionar()
    if (!sessaoDaAba.armazenamento) return false
    void Promise.resolve(esperaDaRecarga).finally(() => location.reload())
    return true
  }
  return false
}
