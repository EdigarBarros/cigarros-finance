import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { tx } from './textos'

export type StatusAssinatura =
  | 'sem_assinatura' | 'teste' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete' | 'incomplete_expired' | 'paused' | 'cortesia'

export interface Assinatura {
  status: StatusAssinatura
  teste_fim: string | null
  periodo_fim: string | null
  cancela_no_fim: boolean
  moeda: string | null
}

/** Teste grátis do OpusCash (sem cartão): vale até teste_fim. */
export const emTeste = (a: Assinatura | null) => Boolean(a && a.status === 'teste' && a.teste_fim && new Date(a.teste_fim).getTime() > Date.now())

/** Dias que faltam do teste grátis sem cartão (arredonda para cima; 0 se acabou). */
export const diasDeTeste = (a: Assinatura | null) => (emTeste(a) ? Math.max(1, Math.ceil((new Date(a!.teste_fim!).getTime() - Date.now()) / 86_400_000)) : 0)

/** Teste grátis, assinatura em dia, conta liberada, ou cobrança recusada ainda em nova tentativa (past_due): entram no painel. */
export const temAcesso = (a: Assinatura | null) => Boolean(a && (['trialing', 'active', 'past_due', 'cortesia'].includes(a.status) || emTeste(a)))

/** Ainda não usou o teste grátis (conta nova que não escolheu plano): pode começar o teste sem cartão. */
export const podeTestar = (a: Assinatura | null) => !a || (a.status === 'sem_assinatura' && !a.teste_fim)

/** Começa o teste grátis de 7 dias (o banco grava e garante que só acontece uma vez). Devolve a mensagem de erro, ou null se deu certo. */
export async function iniciarTesteGratis(): Promise<string | null> {
  const { data, error } = await supabase.rpc('iniciar_teste_gratis')
  if (error) return tx('Não foi possível começar o teste agora. Tente de novo.')
  return data ? null : tx('O teste grátis já foi usado nesta conta. Assine para continuar.')
}

const faltaTabela = (e: { code?: string; message: string }) =>
  e.code === '42P01' || e.code === 'PGRST205' || /does not exist|schema cache/i.test(e.message)

/**
 * Situação da assinatura de quem está logado. Sem a migração 12 (tabela inexistente) o app não cobra: `cobranca` fica falso
 * e o painel abre normalmente.
 *
 * Erro passageiro (rede ruim, timeout) NÃO vira "nunca assinou": quem já pagou veria "Comece com 7 dias grátis". Enquanto a
 * primeira leitura não der certo, `carregando` fica ligado e a leitura se repete sozinha (espera crescente, até 30 s). Depois
 * de uma leitura boa, uma falha só liga `erro` e mantém a situação anterior.
 */
export function useAssinatura(userId: string) {
  const [assinatura, setAssinatura] = useState<Assinatura | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [cobranca, setCobranca] = useState(true)
  /** Última leitura falhou por motivo passageiro (a situação mostrada pode estar desatualizada). */
  const [erro, setErro] = useState(false)
  /** Para quem já houve uma leitura boa. */
  const leuPara = useRef<string | null>(null)

  /** Devolve verdadeiro se leu (ou se não há tabela); falso se falhou por motivo passageiro. */
  const recarregar = useCallback(async () => {
    const { data, error } = await supabase
      .from('assinaturas').select('status, teste_fim, periodo_fim, cancela_no_fim, moeda').eq('user_id', userId).maybeSingle()
    if (error && !faltaTabela(error)) {
      setErro(true)
      if (leuPara.current === userId) setCarregando(false)
      return false
    }
    leuPara.current = userId
    setErro(false)
    if (error) setCobranca(false)
    else setAssinatura((data as Assinatura | null) ?? null)
    setCarregando(false)
    return true
  }, [userId])

  useEffect(() => {
    let cancelado = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let tentativa = 0
    const rodar = async () => {
      const ok = await recarregar()
      if (!ok && !cancelado) timer = setTimeout(() => void rodar(), Math.min(2000 * 2 ** tentativa++, 30_000))
    }
    void rodar()
    return () => {
      cancelado = true
      clearTimeout(timer)
    }
  }, [recarregar])

  return { assinatura, carregando, cobranca, erro, recarregar }
}

/** Abre a página de pagamento (cartão só aqui, ao assinar) ou o portal de gerenciar a assinatura, e leva a pessoa até lá. */
export async function irParaStripe(funcao: 'stripe-checkout' | 'stripe-portal', moeda?: string): Promise<string | null> {
  const { data: ok, error } = await supabase.functions.invoke(funcao, { body: { retorno: window.location.origin, moeda } })
  // Resposta que não é 2xx (ex.: 409 "ja_ativa") chega como erro, com o corpo em error.context: lê de lá.
  let data: { url?: string; erro?: string } | null = ok
  const resposta = (error as { context?: unknown } | null)?.context
  if (!data && resposta instanceof Response) data = await resposta.clone().json().catch(() => null)
  if (data?.url) {
    window.location.href = data.url as string
    return null
  }
  if (data?.erro === 'ja_ativa') {
    window.location.reload()
    return null
  }
  // já existe uma assinatura com pagamento por resolver: o acerto do cartão é no portal, não numa assinatura nova
  if (data?.erro === 'pagamento_pendente' && funcao === 'stripe-checkout') return irParaStripe('stripe-portal')
  return (data?.erro as string | undefined) ?? error?.message ?? tx('Não foi possível abrir o pagamento. Tente de novo.')
}

/** Apaga a conta (login e todos os dados) e cancela a assinatura. Devolve a mensagem de erro, ou null se deu certo. */
export async function excluirConta(email: string): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke('excluir-conta', { body: { confirmar: email } })
  if (data?.ok) {
    await supabase.auth.signOut()
    return null
  }
  return (data?.erro as string | undefined) ?? error?.message ?? tx('Não foi possível excluir a conta. Tente de novo.')
}
