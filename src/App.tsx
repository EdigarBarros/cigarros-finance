import type { Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { Configuracao, Login } from './components/Entrada'
import { TelaAssinatura } from './components/Assinatura'
import { PaginaLegal } from './components/Legal'
import { documentoDoHash } from './lib/legal'
import { Painel } from './components/Painel'
import { temAcesso, useAssinatura } from './lib/assinatura'
import { configurado, supabase } from './lib/supabase'

export default function App() {
  const [sessao, setSessao] = useState<Session | null | undefined>(undefined)
  const [doc, setDoc] = useState(documentoDoHash)

  useEffect(() => {
    if (!configurado) return
    supabase.auth.getSession().then(({ data }) => setSessao(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSessao(s))
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
  if (!sessao) return <Login />
  return <ComAcesso userId={sessao.user.id} email={sessao.user.email ?? ''} nome={sessao.user.user_metadata?.nome} />
}

/** Só abre o painel para quem está no teste grátis, com a assinatura em dia ou com a conta liberada. */
function ComAcesso({ userId, email, nome }: { userId: string; email: string; nome?: string }) {
  const { assinatura, carregando, cobranca, recarregar } = useAssinatura(userId)
  if (carregando) return <div className="tela-central">Carregando…</div>
  if (cobranca && !temAcesso(assinatura)) return <TelaAssinatura assinatura={assinatura} email={email} aoAtualizar={recarregar} />
  return <Painel userId={userId} email={email} nome={nome} assinatura={cobranca ? assinatura : null} />
}
