// Recebe os avisos do Stripe (assinou, renovou, falhou, cancelou) e atualiza a tabela assinaturas.
// Segredo necessário: STRIPE_SECRET_KEY. Sem verificação de JWT (quem chama é o Stripe).
//
// Em vez de confiar no corpo recebido, a função só lê o id do evento e busca o evento de novo no Stripe com a chave secreta:
// um aviso falso aponta para um evento que não existe e é ignorado.
import { createClient } from 'npm:@supabase/supabase-js@2'

const EVENTOS = ['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted']
const STRIPE = 'https://api.stripe.com/v1'
const cab = () => ({ Authorization: `Bearer ${Deno.env.get('STRIPE_SECRET_KEY')}` })
const iso = (s?: number | null) => (s ? new Date(s * 1000).toISOString() : null)

/**
 * Teste grátis uma vez por cartão. Quando uma assinatura está em teste, pega a impressão digital do cartão (fingerprint, que o Stripe
 * calcula e que não revela o número) e a guarda. Se o mesmo cartão já foi usado no teste de OUTRA conta, encerra o teste agora: a
 * cobrança começa na hora. Não derruba o webhook se algo falhar aqui (o pior caso é a pessoa ganhar o teste).
 */
async function conferirCartaoDoTeste(servico: ReturnType<typeof createClient>, sub: Record<string, any>, userId: string) {
  try {
    let pm: string | null = typeof sub.default_payment_method === 'string' ? sub.default_payment_method : sub.default_payment_method?.id ?? null
    if (!pm) {
      const c = await (await fetch(`${STRIPE}/customers/${sub.customer}`, { headers: cab() })).json()
      const padrao = c?.invoice_settings?.default_payment_method
      pm = typeof padrao === 'string' ? padrao : padrao?.id ?? null
    }
    if (!pm) return
    const m = await (await fetch(`${STRIPE}/payment_methods/${pm}`, { headers: cab() })).json()
    const fingerprint: string | undefined = m?.card?.fingerprint
    if (!fingerprint) return
    const { data: dono } = await servico.from('teste_cartoes').select('user_id').eq('fingerprint', fingerprint).maybeSingle()
    if (!dono) {
      await servico.from('teste_cartoes').insert({ fingerprint, user_id: userId })
      return
    }
    if (dono.user_id === userId) return
    await fetch(`${STRIPE}/subscriptions/${sub.id}`, {
      method: 'POST',
      headers: { ...cab(), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ trial_end: 'now' }),
    })
  } catch { /* ver comentário acima */ }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('ok')
  try {
    const { id } = await req.json()
    if (typeof id !== 'string' || !id.startsWith('evt_')) return new Response('ignorado')
    const r = await fetch(`https://api.stripe.com/v1/events/${id}`, { headers: { Authorization: `Bearer ${Deno.env.get('STRIPE_SECRET_KEY')}` } })
    if (!r.ok) return new Response('evento não encontrado', { status: 400 })
    const evento = await r.json()
    if (!EVENTOS.includes(evento.type)) return new Response('ignorado')

    // O corpo do evento é uma foto do momento em que ele aconteceu. Avisos chegam fora de ordem (um "created" incompleto depois de um
    // "updated" ativo) e o Stripe reenvia avisos velhos; gravar a foto deixaria quem paga trancado para fora, ou quem cancelou com acesso.
    // Por isso o evento só diz QUAL assinatura mudou: o estado gravado é o de agora, lido do Stripe.
    const doEvento = evento.data.object
    const servico = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    let userId: string | undefined = doEvento.metadata?.supabase_user_id
    if (!userId) {
      const { data } = await servico.from('assinaturas').select('user_id').eq('stripe_customer_id', doEvento.customer).maybeSingle()
      userId = data?.user_id
    }
    if (!userId) return new Response('sem usuário', { status: 200 })

    const rs = await fetch(`${STRIPE}/subscriptions/${doEvento.id}`, { headers: cab() })
    let sub: Record<string, any>
    if (rs.status === 404) sub = { ...doEvento, status: 'canceled' } // a assinatura não existe mais: vale como cancelada
    else if (!rs.ok) return new Response('não foi possível ler a assinatura', { status: 500 }) // o Stripe tenta de novo
    else sub = await rs.json()

    // evento fora de ordem: se a assinatura já é outra (mais nova), não sobrescreve
    const { data: atual } = await servico.from('assinaturas').select('status, stripe_subscription_id').eq('user_id', userId).maybeSingle()
    if (atual?.status === 'cortesia') return new Response('cortesia')
    const outra = Boolean(atual?.stripe_subscription_id) && atual?.stripe_subscription_id !== sub.id
    const encerrada = sub.status === 'canceled' || sub.status === 'incomplete_expired'
    if (outra && (evento.type === 'customer.subscription.deleted' || encerrada)) return new Response('antiga')

    if (sub.status === 'trialing') await conferirCartaoDoTeste(servico, sub, userId)

    const fim = sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end
    const { error } = await servico.from('assinaturas').upsert({
      user_id: userId,
      status: sub.status,
      stripe_customer_id: sub.customer,
      stripe_subscription_id: sub.id,
      teste_fim: iso(sub.trial_end),
      periodo_fim: iso(fim),
      cancela_no_fim: Boolean(sub.cancel_at_period_end),
      moeda: sub.currency,
      atualizado_em: new Date().toISOString(),
    })
    // 23503: a conta já foi excluída (a chave de assinaturas.user_id não existe mais). Não há o que gravar; 200 para o Stripe parar de reenviar.
    if (error?.code === '23503') return new Response('conta excluída')
    if (error) return new Response(error.message, { status: 500 })
    return new Response('ok')
  } catch (e) {
    return new Response(e instanceof Error ? e.message : 'erro', { status: 500 })
  }
})
