// Exclui a conta de quem está logado: cancela a assinatura no Stripe (se houver) e apaga o login e todos os dados.
// Os dados somem junto com o usuário (todas as tabelas têm "on delete cascade" para auth.users). Não tem volta.
// Segredo necessário: STRIPE_SECRET_KEY. O resto o Supabase já fornece.
import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const resposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return resposta({ erro: 'Use POST.' }, 405)
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!
    const eu = createClient(url, anon, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
    const { data: { user } } = await eu.auth.getUser()
    if (!user) return resposta({ erro: 'Entre na sua conta para excluí-la.' }, 401)
    const servico = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { confirmar, senha } = await req.json().catch(() => ({}))
    if (!user.email || typeof confirmar !== 'string' || confirmar.trim().toLowerCase() !== user.email.toLowerCase()) {
      return resposta({ erro: 'Confirme o e-mail da conta.' }, 400)
    }
    if (typeof senha !== 'string' || !senha) {
      return resposta({ erro: 'Confirme sua senha na versão mais recente do OpusCash para excluir a conta.' }, 400)
    }

    // A autenticação temporária é independente da sessão que já estava aberta no aparelho.
    const confirmacao = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: login, error: erroLogin } = await confirmacao.auth.signInWithPassword({ email: user.email, password: senha })
    if (erroLogin?.status === 429) return resposta({ erro: 'Muitas tentativas. Aguarde e tente novamente.' }, 429)
    if (erroLogin && (erroLogin.status === undefined || erroLogin.status >= 500)) {
      return resposta({ erro: 'Não foi possível confirmar sua senha. Tente novamente.' }, 503)
    }
    if (erroLogin || !login.session) return resposta({ erro: 'A senha não confere.' }, 403)
    const { error: erroSaida } = await confirmacao.auth.signOut({ scope: 'local' })
    if (erroSaida) return resposta({ erro: 'Não foi possível confirmar sua senha. Tente novamente.' }, 503)
    if (login.user?.id !== user.id) return resposta({ erro: 'Não foi possível confirmar a conta.' }, 403)

    // Cancela a cobrança antes de apagar: sem isso o Stripe continuaria cobrando um cliente que não existe mais aqui.
    const { data: ass, error: erroAssinatura } = await servico.from('assinaturas').select('stripe_subscription_id, status').eq('user_id', user.id).maybeSingle()
    if (erroAssinatura) return resposta({ erro: 'Não foi possível conferir a assinatura. Tente novamente.' }, 503)
    if (ass?.stripe_subscription_id && ass.status !== 'cortesia' && !['canceled', 'incomplete_expired'].includes(ass.status)) {
      const cab = { Authorization: `Bearer ${Deno.env.get('STRIPE_SECRET_KEY')}` }
      const url_sub = `https://api.stripe.com/v1/subscriptions/${ass.stripe_subscription_id}`
      // Quem pagou o Pix de 30 dias guarda o id de uma assinatura de cartão antiga, já cancelada: lê o estado de verdade antes de cancelar.
      const rs = await fetch(url_sub, { headers: cab })
      if (!rs.ok && rs.status !== 404) return resposta({ erro: 'Não foi possível conferir a assinatura. Tente de novo.' }, 502)
      const viva = rs.ok && !['canceled', 'incomplete_expired'].includes((await rs.json()).status)
      if (viva) {
        const r = await fetch(url_sub, { method: 'DELETE', headers: cab })
        // 404 = o Stripe já não conhece essa assinatura: segue em frente. Qualquer outro erro para tudo (não apaga sem cancelar).
        if (!r.ok && r.status !== 404) {
          const j = await r.json().catch(() => null)
          return resposta({ erro: j?.error?.message ?? 'Não foi possível cancelar a assinatura. Tente de novo.' }, 502)
        }
      }
    }

    const { error } = await servico.auth.admin.deleteUser(user.id)
    if (error) return resposta({ erro: error.message }, 500)
    return resposta({ ok: true })
  } catch {
    return resposta({ erro: 'Não foi possível concluir a exclusão. Tente novamente.' }, 500)
  }
})
