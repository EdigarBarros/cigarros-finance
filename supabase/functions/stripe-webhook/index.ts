// Recebe os avisos do Stripe (assinou, renovou, falhou, cancelou, pagou ou reembolsou o Pix de 30 dias) e atualiza a tabela assinaturas.
// O Stripe autentica cada notificação com STRIPE_WEBHOOK_SECRET; sem ele, o evento é lido de novo na API do Stripe (ver abaixo). O gateway não exige JWT deste endpoint.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import Stripe from 'npm:stripe@23.2.0'

// Pix de 30 dias (pagamento único, criado em stripe-checkout com tipo 'pix'). Estes valores são os mesmos de lá.
const PIX_MOEDA = 'brl'
const PIX_VALOR = 999
const PIX_TIPO = 'pix_30_dias'
const PIX_DIAS = 30
// Reembolso: tira os dias do Pix devolvido (só reembolso total; parcial não mexe no acesso)
const STRIPE = 'https://api.stripe.com/v1'
const cryptoStripe = Stripe.createSubtleCryptoProvider()
const cab = () => ({ Authorization: `Bearer ${Deno.env.get('STRIPE_SECRET_KEY')}` })
const iso = (s?: number | null) => (s ? new Date(s * 1000).toISOString() : null)

/**
 * Teste grátis uma vez por cartão. Quando uma assinatura está em teste, pega a impressão digital do cartão (fingerprint, que o Stripe
 * calcula e que não revela o número) e a guarda. Se o mesmo cartão já foi usado no teste de OUTRA conta, encerra o teste agora: a
 * cobrança começa na hora. Não derruba o webhook se algo falhar aqui (o pior caso é a pessoa ganhar o teste).
 */
async function conferirCartaoDoTeste(servico: SupabaseClient, sub: Record<string, any>, userId: string) {
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

/**
 * Pix pago: lê a sessão de pagamento de novo no Stripe (o corpo do aviso não é confiável) e só libera se foi uma sessão nossa
 * de Pix, paga, no valor certo e em reais. Quem grava é a função registrar_pix do banco, que numa transação só registra o
 * pagamento (a chave é o id da sessão: aviso repetido não soma dias de novo) e dá os 30 dias de acesso.
 */
async function liberarPix(sessaoId: unknown): Promise<Response> {
  if (typeof sessaoId !== 'string' || !sessaoId.startsWith('cs_')) return new Response('ignorado')
  const rs = await fetch(`${STRIPE}/checkout/sessions/${sessaoId}`, { headers: cab() })
  if (rs.status === 404) return new Response('sessão não encontrada')
  if (!rs.ok) return new Response('não foi possível ler a sessão', { status: 500 }) // o Stripe tenta de novo
  const s = await rs.json()
  if (s.mode !== 'payment' || s.metadata?.tipo !== PIX_TIPO) return new Response('ignorado') // não é um Pix nosso
  if (s.payment_status !== 'paid') return new Response('ainda não pago') // o aviso async_payment_succeeded chega quando pagar
  if (s.currency !== PIX_MOEDA || s.amount_total !== PIX_VALOR) {
    // dinheiro recebido que não bate com o preço esperado (preço mudado só em stripe-checkout?): não libera, mas deixa rastro
    console.error(`Pix ${s.id}: valor inesperado (${s.amount_total} ${s.currency}); acesso NÃO liberado`)
    return new Response('valor inesperado')
  }
  const userId: string | undefined = s.metadata?.supabase_user_id
  if (!userId) return new Response('sem usuário')

  const servico = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const cliente = typeof s.customer === 'string' ? s.customer : s.customer?.id ?? null
  const { data, error } = await servico.rpc('registrar_pix', {
    p_sessao: s.id, p_user: userId, p_valor: s.amount_total, p_moeda: s.currency, p_customer: cliente, p_dias: PIX_DIAS,
  })
  // 23503: a conta já foi excluída. Não há a quem liberar; 200 para o Stripe parar de reenviar.
  if (error?.code === '23503') return new Response('conta excluída')
  if (error) return new Response(error.message, { status: 500 })
  if (data?.repetido) return new Response('já registrado')
  if (data?.estornado) return new Response('pagamento já estornado')
  if (data?.creditado === false) {
    // a pessoa pagou o Pix já tendo acesso (cortesia ou assinatura ativa): fica em pagamentos_pix com creditado = false para reembolso
    console.error(`Pix ${s.id}: pago por quem já tinha acesso; sem crédito (pagamentos_pix.creditado = false)`)
    return new Response('pago sem crédito')
  }
  return new Response('ok')
}

/**
 * Cobrança reembolsada: se era um Pix de 30 dias nosso, tira os dias (função estornar_pix do banco, uma vez por sessão).
 * Lê a cobrança de novo no Stripe e acha a sessão de pagamento pelo payment_intent.
 */
async function estornarPix(cobrancaId: unknown): Promise<Response> {
  if (typeof cobrancaId !== 'string' || !/^(ch|py)_/.test(cobrancaId)) return new Response('ignorado')
  const rc = await fetch(`${STRIPE}/charges/${cobrancaId}`, { headers: cab() })
  if (!rc.ok) return new Response('não foi possível ler a cobrança', { status: rc.status === 404 ? 200 : 500 })
  const c = await rc.json()
  if (!c.refunded) return new Response('reembolso parcial: acesso mantido')
  const pi = typeof c.payment_intent === 'string' ? c.payment_intent : c.payment_intent?.id
  if (!pi) return new Response('ignorado')
  const rs = await fetch(`${STRIPE}/checkout/sessions?payment_intent=${pi}&limit=1`, { headers: cab() })
  if (!rs.ok) return new Response('não foi possível ler a sessão', { status: 500 })
  const s = (await rs.json())?.data?.[0]
  if (!s || s.metadata?.tipo !== PIX_TIPO) return new Response('ignorado') // não é um Pix nosso
  const servico = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data, error } = await servico.rpc('estornar_pix', { p_sessao: s.id })
  if (error) return new Response(error.message, { status: 500 })
  if (data?.ajustar_no_stripe) console.error(`Pix ${s.id} reembolsado, mas já virou assinatura no cartão: ajuste os dias no Stripe`)
  return new Response(JSON.stringify(data))
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Use POST', { status: 405, headers: { Allow: 'POST' } })
  const assinatura = req.headers.get('Stripe-Signature')
  if (!assinatura) return new Response('Assinatura ausente', { status: 400 })
  const segredo = Deno.env.get('STRIPE_WEBHOOK_SECRET')
  const chave = Deno.env.get('STRIPE_SECRET_KEY')
  if (!chave) {
    console.error('STRIPE_SECRET_KEY não configurada no webhook')
    return new Response('Webhook indisponível', { status: 503 })
  }

  let evento: Stripe.Event
  const corpo = await req.text()
  if (segredo) {
    try {
      const stripe = new Stripe(chave, { httpClient: Stripe.createFetchHttpClient() })
      evento = await stripe.webhooks.constructEventAsync(corpo, assinatura, segredo, undefined, cryptoStripe)
    } catch {
      return new Response('Notificação do Stripe inválida', { status: 400 })
    }
  } else {
    // Sem STRIPE_WEBHOOK_SECRET o pagamento não pode parar (em 25/11/2026 um Pix pago ficou sem liberar por isso). O corpo não
    // vale nada: dele só sai o id, e o evento inteiro é lido no próprio Stripe com a chave secreta. Um id inventado ou de outra
    // conta não existe lá (404) e é recusado. Mesma garantia da assinatura, com uma chamada a mais.
    console.error('STRIPE_WEBHOOK_SECRET ausente: evento conferido direto na API do Stripe. Cadastre o segredo no Supabase.')
    let id: unknown
    try { id = JSON.parse(corpo)?.id } catch { /* corpo inválido: cai no teste abaixo */ }
    if (typeof id !== 'string' || !/^evt_[A-Za-z0-9]+$/.test(id)) return new Response('Notificação do Stripe inválida', { status: 400 })
    const re = await fetch(`${STRIPE}/events/${id}`, { headers: cab() })
    if (re.status === 404) return new Response('Notificação do Stripe inválida', { status: 400 })
    if (!re.ok) return new Response('não foi possível ler o evento', { status: 500 }) // o Stripe tenta de novo
    evento = await re.json()
  }

  try {
    if (evento.type === 'checkout.session.completed' || evento.type === 'checkout.session.async_payment_succeeded') {
      return await liberarPix(evento.data.object.id)
    }
    if (evento.type === 'charge.refunded') return await estornarPix(evento.data.object.id)
    if (evento.type !== 'customer.subscription.created' && evento.type !== 'customer.subscription.updated'
      && evento.type !== 'customer.subscription.deleted') return new Response('ignorado')

    // O corpo do evento é uma foto do momento em que ele aconteceu. Avisos chegam fora de ordem (um "created" incompleto depois de um
    // "updated" ativo) e o Stripe reenvia avisos velhos; gravar a foto deixaria quem paga trancado para fora, ou quem cancelou com acesso.
    // Por isso o evento só diz QUAL assinatura mudou: o estado gravado é o de agora, lido do Stripe.
    const doEvento = evento.data.object
    const servico = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    let userId: string | undefined = doEvento.metadata?.supabase_user_id
    if (!userId) {
      const cliente = typeof doEvento.customer === 'string' ? doEvento.customer : doEvento.customer.id
      const { data } = await servico.from('assinaturas').select('user_id').eq('stripe_customer_id', cliente).maybeSingle()
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
    // Pix de 30 dias vigente: um aviso de uma assinatura antiga (cancelada, recusada...) não tira o acesso pago. Só uma assinatura
    // que está valendo (em teste ou ativa) assume o lugar do Pix.
    if (atual?.status === 'pix' && !['trialing', 'active'].includes(sub.status)) return new Response('pix vigente')
    const outra = Boolean(atual?.stripe_subscription_id) && atual?.stripe_subscription_id !== sub.id
    const encerrada = sub.status === 'canceled' || sub.status === 'incomplete_expired'
    if (outra && (evento.type === 'customer.subscription.deleted' || encerrada)) return new Response('antiga')

    // O teste que vem de dias de Pix já pagos (stripe-checkout marca depois_do_pix) não é teste grátis: não há o que conferir no cartão.
    if (sub.status === 'trialing' && !sub.metadata?.depois_do_pix) await conferirCartaoDoTeste(servico, sub, userId)

    const fim = sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end
    // Assinatura que nasceu dos dias de Pix (depois_do_pix) e foi encerrada ANTES do fim desses dias: quem pagou o Pix continua com o
    // que sobrou. Volta a valer como Pix até o fim do trial (o cartão nunca chegou a cobrar).
    const pixDevolvido = sub.status === 'canceled' && Boolean(sub.metadata?.depois_do_pix) && Number(sub.trial_end) * 1000 > Date.now()
    const { error } = await servico.from('assinaturas').upsert({
      user_id: userId,
      status: pixDevolvido ? 'pix' : sub.status,
      stripe_customer_id: sub.customer,
      stripe_subscription_id: sub.id,
      teste_fim: pixDevolvido ? null : iso(sub.trial_end),
      periodo_fim: pixDevolvido ? iso(sub.trial_end) : iso(fim),
      cancela_no_fim: pixDevolvido ? false : Boolean(sub.cancel_at_period_end),
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
