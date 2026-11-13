import { useCallback, useEffect, useRef, useState } from 'react'
import { noAppAndroid } from './appAndroid'
import { aoMudarConexao } from './conexao'
import { supabase } from './supabase'
import { tx } from './textos'

export type StatusAssinatura =
  | 'sem_assinatura' | 'teste' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete' | 'incomplete_expired' | 'paused' | 'cortesia' | 'pix'

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

/** Pix de 30 dias (pagamento único): vale até periodo_fim. Não renova sozinho; a pessoa paga de novo. */
export const emPix = (a: Assinatura | null) => Boolean(a && a.status === 'pix' && a.periodo_fim && new Date(a.periodo_fim).getTime() > Date.now())

/** Dias que faltam do Pix (arredonda para cima; 0 se acabou). */
export const diasDePix = (a: Assinatura | null) => (emPix(a) ? Math.max(1, Math.ceil((new Date(a!.periodo_fim!).getTime() - Date.now()) / 86_400_000)) : 0)

/** O Pix de 30 dias venceu (a conta voltou a precisar de pagamento). */
export const pixAcabou = (a: Assinatura | null) => Boolean(a && a.status === 'pix' && !emPix(a))

/**
 * Quanto sobra de Pix para o cartão esperar: o Stripe só aceita começar a cobrança do cartão (`trial_end`) com pelo menos 48 h
 * pela frente, então aqui vale 50 h. A função stripe-checkout usa a mesma conta; quem mudar uma, mude a outra.
 */
export const PIX_MINIMO_PARA_ESPERAR_MS = 50 * 3_600_000

/** Sobra Pix suficiente para o cartão só começar a cobrar depois dele (e a pessoa não perder os dias já pagos). */
export const pixComSobra = (a: Assinatura | null) => emPix(a) && new Date(a!.periodo_fim!).getTime() - Date.now() > PIX_MINIMO_PARA_ESPERAR_MS

/** Dias inteiros até uma data (arredonda para cima; 0 se já passou). */
export const diasAte = (iso: string | null) => (iso ? Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)) : 0)

/**
 * O que a tela "Assinatura" (Configurações) mostra, em uma palavra:
 *  - `teste`: teste grátis de 7 dias, sem cartão; - `pix`: Pix de 30 dias (não renova sozinho);
 *  - `cartao`: assinatura no cartão, renovando; - `cartao-cancelada`: cancelada, vale até o fim do período já pago;
 *  - `cartao-recusado`: o cartão foi recusado e o Stripe ainda tenta de novo (a pessoa tem acesso); - `liberada`: conta liberada por nós.
 * Devolve null para quem não tem acesso (essas pessoas veem a tela de assinatura inteira, não o painel).
 */
export type TipoAssinatura = 'teste' | 'pix' | 'cartao' | 'cartao-cancelada' | 'cartao-recusado' | 'liberada'

export interface ResumoAssinatura {
  tipo: TipoAssinatura
  /** Fim do acesso (teste e Pix), próxima cobrança (cartão) ou último dia (cancelada), em ISO. Nulo se não houver. */
  fim: string | null
  /** Dias que faltam para `fim`. */
  dias: number
  /** Duração do período inteiro, para a barra de tempo (7 no teste, 30 no Pix e no cartão). */
  total: number
}

export function resumoDaAssinatura(a: Assinatura | null): ResumoAssinatura | null {
  if (!a) return null
  if (a.status === 'cortesia') return { tipo: 'liberada', fim: null, dias: 0, total: 0 }
  if (emTeste(a)) return { tipo: 'teste', fim: a.teste_fim, dias: diasDeTeste(a), total: 7 }
  if (emPix(a)) return { tipo: 'pix', fim: a.periodo_fim, dias: diasDePix(a), total: 30 }
  if (a.status === 'past_due') return { tipo: 'cartao-recusado', fim: null, dias: 0, total: 0 }
  if (a.status === 'active' || a.status === 'trialing') {
    // no teste do Stripe (o cartão cadastrado antes da primeira cobrança) a data que vale é a do fim do teste
    const fim = (a.status === 'trialing' ? a.teste_fim : null) ?? a.periodo_fim
    return { tipo: a.cancela_no_fim ? 'cartao-cancelada' : 'cartao', fim, dias: diasAte(fim), total: 30 }
  }
  return null
}

/** O Pix só existe em reais: é a moeda do checkout avulso. */
export const aceitaPix = (moeda?: string | null) => (moeda ?? 'BRL').toUpperCase() === 'BRL'

/** Teste grátis, assinatura em dia, conta liberada, Pix de 30 dias valendo, ou cobrança recusada ainda em nova tentativa (past_due): entram no painel. */
export const temAcesso = (a: Assinatura | null) => Boolean(a && (['trialing', 'active', 'past_due', 'cortesia'].includes(a.status) || emTeste(a) || emPix(a)))

/** Ainda não usou o teste grátis (conta nova que não escolheu plano): pode começar o teste sem cartão. */
export const podeTestar = (a: Assinatura | null) => !a || (a.status === 'sem_assinatura' && !a.teste_fim)

/** Começa o teste grátis de 7 dias (o banco grava e garante que só acontece uma vez). Devolve a mensagem de erro, ou null se deu certo. */
export async function iniciarTesteGratis(): Promise<string | null> {
  const { data, error } = await supabase.rpc('iniciar_teste_gratis')
  if (error) return tx('Não foi possível começar o teste agora. Tente de novo.')
  if (data) return null
  return noAppAndroid ? tx('O teste grátis já foi usado nesta conta.') : tx('O teste grátis já foi usado nesta conta. Assine para continuar.')
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
    let lendo = false
    const rodar = async () => {
      if (lendo) return // uma leitura de cada vez (a volta da conexão pode chegar no meio de uma)
      lendo = true
      const ok = await recarregar()
      lendo = false
      if (!ok && !cancelado) timer = setTimeout(() => void rodar(), Math.min(2000 * 2 ** tentativa++, 30_000))
    }
    void rodar()
    // a conexão voltou: tenta na hora, sem esperar a próxima tentativa (que pode estar a até 30 s)
    const pararDeOuvir = aoMudarConexao((semInternet) => {
      if (semInternet || cancelado || leuPara.current === userId) return
      clearTimeout(timer)
      tentativa = 0
      void rodar()
    })
    return () => {
      cancelado = true
      clearTimeout(timer)
      pararDeOuvir()
    }
  }, [recarregar, userId])

  return { assinatura, carregando, cobranca, erro, recarregar }
}

/** Abre a página de pagamento (cartão só aqui, ao assinar) ou o portal de gerenciar a assinatura, e leva a pessoa até lá. */
export async function irParaStripe(funcao: 'stripe-checkout' | 'stripe-portal', moeda?: string, tipo?: 'pix', exigirEspera?: boolean): Promise<string | null> {
  const { data: ok, error } = await supabase.functions.invoke(funcao, { body: { retorno: window.location.origin, moeda, tipo } })
  // Resposta que não é 2xx (ex.: 409 "ja_ativa") chega como erro, com o corpo em error.context: lê de lá.
  let data: { url?: string; erro?: string; espera?: boolean } | null = ok
  const resposta = (error as { context?: unknown } | null)?.context
  if (!data && resposta instanceof Response) data = await resposta.clone().json().catch(() => null)
  // Pix → cartão com dias sobrando: só segue se o servidor confirmou que o cartão espera o fim do Pix. Um servidor mais antigo cobraria
  // na hora e a pessoa perderia os dias pagos; nesse caso a página de pagamento nem é aberta.
  if (data?.url && exigirEspera && data.espera !== true) return tx('Esta troca ainda está sendo preparada. Tente de novo daqui a pouco, seus dias de Pix estão guardados.')
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
