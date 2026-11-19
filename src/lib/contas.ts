import { createClient, type AuthChangeEvent, type Session } from '@supabase/supabase-js'
import { useSyncExternalStore } from 'react'
import { supabase } from './supabase'

/*
 * Várias contas no mesmo aparelho, como a troca de contas do Google: quem entra numa conta fica lembrado aqui; pelo menu da
 * conta dá para adicionar outra e alternar entre elas sem digitar a senha de novo.
 *
 * Segurança: nenhuma senha é guardada. Guardamos só a sessão que o próprio Supabase já guarda no aparelho para a conta aberta
 * (os dois tokens), uma por conta. Ao trocar, a sessão da conta escolhida é renovada num cliente à parte (se não der, a conta
 * aberta continua aberta e a escolhida pede a senha de novo) e só então vira a sessão do app. A página recarrega na troca: nada
 * da conta anterior fica na memória (dados, cache, telas abertas).
 *
 * O que fica guardado no aparelho e muda de pessoa para pessoa (tema, arrumação da Início, valores escondidos…) é separado por
 * conta com `lerDaConta` / `gravarNaConta`.
 */

export interface ContaSalva {
  id: string
  email: string
  nome?: string
  foto?: string | null
  access_token: string
  refresh_token: string
  /** A sessão guardada não vale mais (expirou ou foi encerrada em outro lugar): para abrir, só com a senha. */
  precisaEntrar?: boolean
  /** Última vez que a conta esteve aberta (ms), para a ordem da lista e para saber qual esquecer quando passa do máximo. */
  usadaEm: number
}

const CHAVE = 'opuscash.contas'
/** Quantas contas o aparelho lembra. */
export const MAX_CONTAS = 5
/** Aba onde a pessoa pediu "Adicionar outra conta": mostra o login sem fechar a conta aberta. */
const CHAVE_ADICIONANDO = 'opuscash.adicionando'

// ---------- a conta aberta nesta página ----------

/** O id da conta cuja sessão o Supabase guardou neste aparelho (lido direto, antes de qualquer tela). */
function idGuardadoPeloSupabase(): string | null {
  try {
    const k = Object.keys(localStorage).find((x) => /^sb-.+-auth-token$/.test(x))
    if (!k) return null
    const s = JSON.parse(localStorage.getItem(k) ?? 'null') as { user?: { id?: unknown } } | null
    return typeof s?.user?.id === 'string' ? s.user.id : null
  } catch { return null }
}

/** A conta com que esta página abriu. Trocar de conta recarrega a página, então isto vale enquanto a página viver. */
const idDaPagina = idGuardadoPeloSupabase()
/** A conta aberta agora (muda sem recarregar quando a pessoa sai, ou entra a partir da tela de login). */
let idAberto = idDaPagina
/** Aberta pelo link de "Esqueci minha senha": não recarrega até a senha nova ser criada (a tela dela some ao recarregar). */
let emRecuperacao = false

// ---------- preferências do aparelho separadas por conta ----------

/** Chave de uma preferência guardada no aparelho, separada para a conta aberta. */
const daConta = (base: string) => (idDaPagina ? `${base}@${idDaPagina}` : base)

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

function ler(): ContaSalva[] {
  try {
    const x = JSON.parse(localStorage.getItem(CHAVE) ?? '[]') as unknown
    if (!Array.isArray(x)) return []
    return x.filter((c): c is ContaSalva => Boolean(c) && typeof c.id === 'string' && typeof c.email === 'string'
      && typeof c.access_token === 'string' && typeof c.refresh_token === 'string')
  } catch { return [] }
}

const ouvintes = new Set<() => void>()
let cache: { texto: string | null; lista: ContaSalva[] } = { texto: null, lista: [] }
function lista(): ContaSalva[] {
  let texto: string | null = null
  try { texto = localStorage.getItem(CHAVE) } catch { /* sem armazenamento */ }
  if (texto !== cache.texto) cache = { texto, lista: ler() }
  return cache.lista
}

function gravar(contas: ContaSalva[]) {
  const ordenadas = [...contas].sort((a, b) => b.usadaEm - a.usadaEm).slice(0, MAX_CONTAS)
  try { localStorage.setItem(CHAVE, JSON.stringify(ordenadas)) } catch { /* sem armazenamento: o aparelho só não lembra */ }
  ouvintes.forEach((f) => f())
}

window.addEventListener('storage', (e) => { if (e.key === CHAVE || e.key === null) ouvintes.forEach((f) => f()) })

/** As contas lembradas neste aparelho, da usada mais recentemente para a mais antiga. */
export const contasSalvas = () => lista()

export function useContasSalvas() {
  return useSyncExternalStore((f) => { ouvintes.add(f); return () => ouvintes.delete(f) }, lista)
}

/** Guarda (ou atualiza) a sessão de uma conta. Chamado a cada mudança de sessão: entrar, renovar o token, mudar o nome. */
function lembrar(s: Session) {
  const atual = lista()
  const antes = atual.find((c) => c.id === s.user.id)
  const nome = typeof s.user.user_metadata?.nome === 'string' ? s.user.user_metadata.nome : undefined
  const conta: ContaSalva = {
    ...antes,
    id: s.user.id,
    email: s.user.email ?? antes?.email ?? '',
    nome: antes?.nome || nome,
    access_token: s.access_token,
    refresh_token: s.refresh_token,
    precisaEntrar: false,
    usadaEm: Date.now(),
  }
  if (antes && antes.access_token === conta.access_token && antes.refresh_token === conta.refresh_token && !antes.precisaEntrar
    && antes.email === conta.email && Date.now() - antes.usadaEm < 60_000) return
  gravar([conta, ...atual.filter((c) => c.id !== conta.id)])
}

/** O painel conta o nome e a foto que a pessoa escolheu, para a lista mostrar como no menu. */
export function atualizarConta(id: string, dados: { nome?: string; foto?: string | null }) {
  const atual = lista()
  const c = atual.find((x) => x.id === id)
  if (!c || (c.nome === dados.nome && c.foto === dados.foto)) return
  gravar(atual.map((x) => (x.id === id ? { ...x, ...dados } : x)))
}

function marcarPrecisaEntrar(id: string) {
  gravar(lista().map((c) => (c.id === id ? { ...c, precisaEntrar: true } : c)))
}

/** Cliente sem guardar nada: renova ou encerra a sessão de uma conta sem mexer na que está aberta. */
function clienteAParte() {
  return createClient(import.meta.env.VITE_SUPABASE_URL as string, import.meta.env.VITE_SUPABASE_ANON_KEY as string, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'opuscash-outra-conta' },
  })
}

/**
 * Tira a conta da lista deste aparelho. Se ela não é a aberta, também encerra a sessão dela no servidor (melhor esforço:
 * sem internet, a sessão só deixa de ficar guardada aqui).
 */
export async function esquecerConta(id: string) {
  const c = lista().find((x) => x.id === id)
  gravar(lista().filter((x) => x.id !== id))
  if (!c || id === idAberto || c.precisaEntrar) return
  try {
    const outro = clienteAParte()
    const { error } = await outro.auth.setSession({ access_token: c.access_token, refresh_token: c.refresh_token })
    if (!error) await outro.auth.signOut({ scope: 'local' })
  } catch { /* sem internet: a sessão vence sozinha */ }
}

/** Sai da conta aberta (só neste aparelho) e tira ela da lista; as outras contas continuam lembradas. */
export async function sairDestaConta() {
  const s = (await supabase.auth.getSession()).data.session
  if (s) gravar(lista().filter((x) => x.id !== s.user.id))
  await supabase.auth.signOut({ scope: 'local' })
}

export type ResultadoDaTroca = 'ok' | 'precisa-entrar' | 'sem-internet'

/**
 * Abre outra conta lembrada sem pedir a senha. A sessão dela é renovada num cliente à parte: se não valer mais, a conta aberta
 * continua como está e a escolhida fica marcada para entrar com a senha. Dando certo, a página recarrega já na conta nova.
 */
export async function trocarPara(id: string): Promise<ResultadoDaTroca> {
  const alvo = lista().find((c) => c.id === id)
  if (!alvo || alvo.precisaEntrar) return 'precisa-entrar'
  // guarda a sessão mais nova da conta aberta antes de sair dela
  const atual = (await supabase.auth.getSession()).data.session
  if (atual) lembrar(atual)
  if (atual?.user.id === id) { location.reload(); return 'ok' }
  const { data, error } = await clienteAParte().auth.refreshSession({ refresh_token: alvo.refresh_token })
  if (error || !data.session) {
    if (error && /fetch|network|load failed/i.test(error.message)) return 'sem-internet'
    marcarPrecisaEntrar(id)
    return 'precisa-entrar'
  }
  lembrar(data.session)
  const { error: e2 } = await supabase.auth.setSession({ access_token: data.session.access_token, refresh_token: data.session.refresh_token })
  if (e2) return /fetch|network|load failed/i.test(e2.message) ? 'sem-internet' : 'precisa-entrar'
  pararDeAdicionar()
  location.reload()
  return 'ok'
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

/**
 * Chamado a cada evento de sessão do Supabase (App.tsx). Lembra a conta e, quando outra conta passa a ser a aberta (aqui ou em
 * outra aba deste aparelho, que o Supabase avisa), recarrega a página para nada da anterior ficar na memória. Entrar pela tela
 * de login também recarrega: as preferências da conta (tema, arrumação…) são lidas ao abrir a página.
 */
export function aoMudarSessao(evento: AuthChangeEvent, s: Session | null) {
  if (evento === 'PASSWORD_RECOVERY') emRecuperacao = true
  if (s && evento !== 'SIGNED_OUT') lembrar(s)
  idAberto = s?.user.id ?? null
  // a página abriu com outra conta (ou sem nenhuma, lendo as preferências de antes): recarrega na conta que entrou
  if (evento === 'SIGNED_IN' && s && s.user.id !== idDaPagina && !emRecuperacao) {
    pararDeAdicionar()
    location.reload()
  }
}
