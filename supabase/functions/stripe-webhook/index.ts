// Recebe os avisos do Stripe (assinou, renovou, falhou, cancelou) e atualiza a tabela assinaturas.
// Segredo necessário: STRIPE_SECRET_KEY. Sem verificação de JWT (quem chama é o Stripe).
//
// Em vez de confiar no corpo recebido, a função só lê o id do evento e busca o evento de novo no Stripe com a chave secreta:
// um aviso falso aponta para um evento que não existe e é ignorado.
import { createClient } from 'npm:@supabase/supabase-js@2'

const EVENTOS = ['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted']
const iso = (s?: number | null) => (s ? new Date(s * 1000).toISOString() : null)

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('ok')
  try {
    const { id } = await req.json()
    if (typeof id !== 'string' || !id.startsWith('evt_')) return new Response('ignorado')
    const r = await fetch(`https://api.stripe.com/v1/events/${id}`, { headers: { Authorization: `Bearer ${Deno.env.get('STRIPE_SECRET_KEY')}` } })
    if (!r.ok) return new Response('evento não encontrado', { status: 400 })
    const evento = await r.json()
    if (!EVENTOS.includes(evento.type)) return new Response('ignorado')

    const sub = evento.data.object
    const servico = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    let userId: string | undefined = sub.metadata?.supabase_user_id
    if (!userId) {
      const { data } = await servico.from('assinaturas').select('user_id').eq('stripe_customer_id', sub.customer).maybeSingle()
      userId = data?.user_id
    }
    if (!userId) return new Response('sem usuário', { status: 200 })

    // evento fora de ordem: se a assinatura já é outra (mais nova), não sobrescreve
    const { data: atual } = await servico.from('assinaturas').select('status, stripe_subscription_id').eq('user_id', userId).maybeSingle()
    if (atual?.status === 'cortesia') return new Response('cortesia')
    if (evento.type === 'customer.subscription.deleted' && atual?.stripe_subscription_id && atual.stripe_subscription_id !== sub.id) return new Response('antiga')

    const fim = sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end
    const { error } = await servico.from('assinaturas').upsert({
      user_id: userId,
      status: evento.type === 'customer.subscription.deleted' ? 'canceled' : sub.status,
      stripe_customer_id: sub.customer,
      stripe_subscription_id: sub.id,
      teste_fim: iso(sub.trial_end),
      periodo_fim: iso(fim),
      cancela_no_fim: Boolean(sub.cancel_at_period_end),
      moeda: sub.currency,
      atualizado_em: new Date().toISOString(),
    })
    if (error) return new Response(error.message, { status: 500 })
    return new Response('ok')
  } catch (e) {
    return new Response(e instanceof Error ? e.message : 'erro', { status: 500 })
  }
})
