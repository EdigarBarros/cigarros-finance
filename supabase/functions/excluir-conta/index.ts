// Exclui a conta de quem está logado: cancela a assinatura no Stripe (se houver) e apaga o login e todos os dados.
// Os dados somem junto com o usuário (todas as tabelas têm "on delete cascade" para auth.users). Não tem volta.
// Segredo necessário: STRIPE_SECRET_KEY. O resto o Supabase já fornece.
import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const resposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const eu = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
    const { data: { user } } = await eu.auth.getUser()
    if (!user) return resposta({ erro: 'Entre na sua conta para excluí-la.' }, 401)
    const servico = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { confirmar } = await req.json().catch(() => ({}))
    if (String(confirmar ?? '').trim().toLowerCase() !== (user.email ?? '').toLowerCase()) {
      return resposta({ erro: 'Digite o e-mail da conta para confirmar.' }, 400)
    }

    // Cancela a cobrança antes de apagar: sem isso o Stripe continuaria cobrando um cliente que não existe mais aqui.
    const { data: ass } = await servico.from('assinaturas').select('stripe_subscription_id, status').eq('user_id', user.id).maybeSingle()
    if (ass?.stripe_subscription_id && ass.status !== 'cortesia' && !['canceled', 'incomplete_expired'].includes(ass.status)) {
      const r = await fetch(`https://api.stripe.com/v1/subscriptions/${ass.stripe_subscription_id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${Deno.env.get('STRIPE_SECRET_KEY')}` },
      })
      // 404 = o Stripe já não conhece essa assinatura: segue em frente. Qualquer outro erro para tudo (não apaga sem cancelar).
      if (!r.ok && r.status !== 404) {
        const j = await r.json().catch(() => null)
        return resposta({ erro: j?.error?.message ?? 'Não foi possível cancelar a assinatura. Tente de novo.' }, 502)
      }
    }

    const { error } = await servico.auth.admin.deleteUser(user.id)
    if (error) return resposta({ erro: error.message }, 500)
    return resposta({ ok: true })
  } catch (e) {
    return resposta({ erro: e instanceof Error ? e.message : 'Erro inesperado.' }, 500)
  }
})
