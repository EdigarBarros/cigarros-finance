import type { Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { Configuracao, Login } from './components/Entrada'
import { TelaAssinatura } from './components/Assinatura'
import { Painel } from './components/Painel'
import { temAcesso, useAssinatura } from './lib/assinatura'
import { configurado, supabase } from './lib/supabase'

export default function App() {
  const [sessao, setSessao] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    if (!configurado) return
    supabase.auth.getSession().then(({ data }) => setSessao(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSessao(s))
    return () => data.subscription.unsubscribe()
  }, [])

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
