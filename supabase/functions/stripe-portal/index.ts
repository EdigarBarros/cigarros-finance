// Abre o portal do Stripe, onde a pessoa troca o cartão, vê as faturas ou cancela a assinatura.
// Segredo necessário: STRIPE_SECRET_KEY.
import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
// Restringe CORS: aceita a origem da requisição se for localhost ou .netlify.app, senão usa '*'.
const getCorsHeaders = (req: Request) => {
  const origin = req.headers.get('Origin') || ''
  const isAllowed = origin.includes('localhost') || origin.includes('netlify.app') || origin.includes('opuscash')
  return {
    ...CORS_HEADERS,
    'Access-Control-Allow-Origin': isAllowed ? origin : '*',
  }
}
const resposta = (corpo: unknown, status = 200, req: Request) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const eu = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
    const { data: { user } } = await eu.auth.getUser()
    if (!user) return resposta({ erro: 'Entre na sua conta.' }, 401, req)
    const servico = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { retorno } = await req.json().catch(() => ({}))
    let origem: string
    try { origem = new URL(String(retorno)).origin } catch { return resposta({ erro: 'Endereço de retorno inválido.' }, 400, req) }

    const { data } = await servico.from('assinaturas').select('stripe_customer_id').eq('user_id', user.id).maybeSingle()
    if (!data?.stripe_customer_id) return resposta({ erro: 'Você ainda não tem assinatura.' }, 404, req)

    const r = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${Deno.env.get('STRIPE_SECRET_KEY')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ customer: data.stripe_customer_id, return_url: `${origem}/` }),
    })
    const j = await r.json()
    if (!r.ok) return resposta({ erro: j?.error?.message ?? 'Erro no Stripe' }, 500, req)
    return resposta({ url: j.url }, 200, req)
  } catch (e) {
    return resposta({ erro: e instanceof Error ? e.message : 'Erro inesperado.' }, 500, req)
  }
})
