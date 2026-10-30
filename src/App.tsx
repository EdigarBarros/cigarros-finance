import type { Session } from '@supabase/supabase-js'
import { lazy, Suspense, useEffect, useReducer, useState } from 'react'
import { BotaoIdioma } from './components/BotaoIdioma'
import { Carregando } from './components/Carregando'
import { Configuracao, Login, NovaSenha } from './components/Entrada'
import { TelaAssinatura } from './components/Assinatura'
import { PaginaLegal } from './components/Legal'
import { documentoDoHash } from './lib/legal'
import { nativo } from './lib/textos'
import { temAcesso, useAssinatura } from './lib/assinatura'
import { configurado, supabase } from './lib/supabase'
import { Apresentacao } from './pages/Apresentacao'
import './pages/apresentacao.css'

/**
 * Telas sem a barra do painel: o botão de idioma fica preso no canto de cima (no painel, ele fica na barra, ao lado do tema).
 * `traduzida`: a tela tem os textos em inglês e espanhol (lib/textos.ts); nesses idiomas o tradutor do Google não mexe nela.
 */
const comIdioma = (tela: React.ReactNode, traduzida = true) => (
  <>
    {traduzida && nativo ? <div translate="no" className="tela-nativa">{tela}</div> : tela}
    <BotaoIdioma flutuante />
  </>
)

const Painel = lazy(() => import('./components/Painel').then((m) => ({ default: m.Painel })))

export default function App() {
  const [sessao, setSessao] = useState<Session | null | undefined>(undefined)
  const [doc, setDoc] = useState(documentoDoHash)
  const [recuperando, setRecuperando] = useState(false)
  // null = landing; senão, qual aba do login abrir (entrar ou criar conta)
  const [login, setLogin] = useState<'entrar' | 'criar' | null>(null)

  useEffect(() => {
    if (!configurado) return
    supabase.auth.getSession().then(({ data }) => setSessao(data.session))
    const { data } = supabase.auth.onAuthStateChange((e, s) => {
      setSessao(s)
      if (e === 'PASSWORD_RECOVERY') setRecuperando(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const aoMudar = () => setDoc(documentoDoHash())
    window.addEventListener('hashchange', aoMudar)
    return () => window.removeEventListener('hashchange', aoMudar)
  }, [])

  if (doc) return comIdioma(<PaginaLegal doc={doc} />, false)
  if (!configurado) return comIdioma(<Configuracao />)
  if (sessao === undefined) return <Carregando />

  // o link de "Esqueci minha senha" cria uma sessão: a tela de nova senha vem antes de qualquer outra
  if (recuperando) return comIdioma(<NovaSenha aoConcluir={() => setRecuperando(false)} />)
  if (!sessao) {
    // Landing page por padrão; o login (ou o cadastro) abre quando a pessoa clica
    if (login) return comIdioma(<Login inicial={login} />)
    return comIdioma(<Apresentacao onLogin={() => setLogin('entrar')} onSignup={() => setLogin('criar')} />)
  }

  return <ComAcesso userId={sessao.user.id} email={sessao.user.email ?? ''} nome={sessao.user.user_metadata?.nome} />
}

/** Só abre o painel para quem está no teste grátis, com a assinatura em dia ou com a conta liberada. */
function ComAcesso({ userId, email, nome }: { userId: string; email: string; nome?: string }) {
  const { assinatura, carregando, cobranca, recarregar } = useAssinatura(userId)
  // Quando o teste grátis acaba com o painel aberto, a tela de assinatura entra na hora (sem esperar a pessoa recarregar).
  const [, reavaliar] = useReducer((n: number) => n + 1, 0)
  const fimDoTeste = assinatura?.status === 'teste' && assinatura.teste_fim ? new Date(assinatura.teste_fim).getTime() : null
  useEffect(() => {
    if (!fimDoTeste) return
    const falta = fimDoTeste - Date.now()
    if (falta <= 0 || falta > 2_000_000_000) return // já acabou, ou longe demais para um timer
    const t = window.setTimeout(reavaliar, falta + 500)
    return () => window.clearTimeout(t)
  }, [fimDoTeste])
  if (carregando) return <Carregando />
  if (cobranca && !temAcesso(assinatura)) return comIdioma(<TelaAssinatura assinatura={assinatura} email={email} aoAtualizar={recarregar} />)
  return (
    <Suspense fallback={<Carregando />}>
      <Painel userId={userId} email={email} nome={nome} assinatura={cobranca ? assinatura : null} />
    </Suspense>
  )
}