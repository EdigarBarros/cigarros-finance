import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { useSyncExternalStore } from 'react'
import { supabase } from './supabase'
import { apagarSessaoDaAba, sessaoDaAba, usuarioDaSessao } from './sessaoDaAba'

/** Perfis lembrados no aparelho. A sessão ativa pertence ao armazenamento da aba, separado desta lista. */
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
  try {
    await supabase.auth.stopAutoRefresh()
    await supabase.auth.signOut({ scope: 'local' })
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
