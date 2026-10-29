import type { Session } from '@supabase/supabase-js'
import { lazy, Suspense, useEffect, useState } from 'react'
import { Configuracao, Login, NovaSenha } from './components/Entrada'
import { TelaAssinatura } from './components/Assinatura'
import { PaginaLegal } from './components/Legal'
import { documentoDoHash } from './lib/legal'
import { temAcesso, useAssinatura } from './lib/assinatura'
import { configurado, supabase } from './lib/supabase'
import { Apresentacao } from './pages/Apresentacao'
import './pages/apresentacao.css'

const Painel = lazy(() => import('./components/Painel').then((m) => ({ default: m.Painel })))

export default function App() {
  const [sessao, setSessao] = useState<Session | null | undefined>(undefined)
  const [doc, setDoc] = useState(documentoDoHash)
  const [recuperando, setRecuperando] = useState(false)
  const [mostrarLogin, setMostrarLogin] = useState(false)

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

  if (doc) return <PaginaLegal doc={doc} />
  if (!configurado) return <Configuracao />
  if (sessao === undefined) return <div className="tela-central">Carregando…</div>

  if (!sessao) {
    if (recuperando) return <NovaSenha aoConcluir={() => setRecuperando(false)} />
    // Mostra a landing page premium por padrão, ou o login se o usuário clicou em "Já tenho conta"
    if (mostrarLogin) return <Login />
    return <Apresentacao onLogin={() => setMostrarLogin(true)} onSignup={() => setMostrarLogin(true)} />
  }

  return <ComAcesso userId={sessao.user.id} email={sessao.user.email ?? ''} nome={sessao.user.user_metadata?.nome} />
}

/** Só abre o painel para quem está no teste grátis, com a assinatura em dia ou com a conta liberada. */
function ComAcesso({ userId, email, nome }: { userId: string; email: string; nome?: string }) {
  const { assinatura, carregando, cobranca, recarregar } = useAssinatura(userId)
  if (carregando) return <div className="tela-central">Carregando…</div>
  if (cobranca && !temAcesso(assinatura)) return <TelaAssinatura assinatura={assinatura} email={email} aoAtualizar={recarregar} />
  return (
    <Suspense fallback={<div className="tela-central">Carregando…</div>}>
      <Painel userId={userId} email={email} nome={nome} assinatura={cobranca ? assinatura : null} />
    </Suspense>
  )
}