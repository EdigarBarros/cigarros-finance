import type { Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { Configuracao, Login } from './components/Entrada'
import { Painel } from './components/Painel'
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
  return <Painel userId={sessao.user.id} email={sessao.user.email ?? ''} nome={sessao.user.user_metadata?.nome} />
}
