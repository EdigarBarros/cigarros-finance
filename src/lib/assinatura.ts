import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

export type StatusAssinatura =
  | 'sem_assinatura' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete' | 'incomplete_expired' | 'paused' | 'cortesia'

export interface Assinatura {
  status: StatusAssinatura
  teste_fim: string | null
  periodo_fim: string | null
  cancela_no_fim: boolean
  moeda: string | null
}

/** Teste grátis, assinatura em dia ou conta liberada: entram no painel. */
export const temAcesso = (a: Assinatura | null) => Boolean(a && ['trialing', 'active', 'cortesia'].includes(a.status))

const faltaTabela = (e: { code?: string; message: string }) =>
  e.code === '42P01' || e.code === 'PGRST205' || /does not exist|schema cache/i.test(e.message)

/**
 * Situação da assinatura de quem está logado. Sem a migração 12 (tabela inexistente) o app não cobra: `cobranca` fica falso
 * e o painel abre normalmente.
 */
export function useAssinatura(userId: string) {
  const [assinatura, setAssinatura] = useState<Assinatura | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [cobranca, setCobranca] = useState(true)

  const recarregar = useCallback(async () => {
    const { data, error } = await supabase
      .from('assinaturas').select('status, teste_fim, periodo_fim, cancela_no_fim, moeda').eq('user_id', userId).maybeSingle()
    if (error && faltaTabela(error)) setCobranca(false)
    else setAssinatura((data as Assinatura | null) ?? null)
    setCarregando(false)
  }, [userId])

  useEffect(() => {
    void recarregar()
  }, [recarregar])

  return { assinatura, carregando, cobranca, recarregar }
}

/** Abre a página de pagamento (7 dias grátis) ou o portal de gerenciar a assinatura, e leva a pessoa até lá. */
export async function irParaStripe(funcao: 'stripe-checkout' | 'stripe-portal', moeda?: string): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke(funcao, { body: { retorno: window.location.origin, moeda } })
  if (data?.url) {
    window.location.href = data.url as string
    return null
  }
  if (data?.erro === 'ja_ativa') {
    window.location.reload()
    return null
  }
  return (data?.erro as string | undefined) ?? error?.message ?? 'Não foi possível abrir o pagamento. Tente de novo.'
}
