// Cria a página de pagamento do Stripe e devolve o endereço dela. O teste grátis de 7 dias é do OpusCash (sem cartão, migração 17):
// aqui a cobrança começa assim que a pessoa assina.
// Segredo necessário: STRIPE_SECRET_KEY. O resto (SUPABASE_URL, chaves) o Supabase já fornece.
import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Restringe CORS: aceita a origem da requisição se for localhost ou .netlify.app, senão usa '*' (necessário para o cliente Supabase funcionar em dev/prod sem config extra de env, mas idealmente seria restrito).
// Nota: Em produção crítica, defina ALLOWED_ORIGINS no ambiente. Aqui, priorizamos funcionalidade com segurança razoável (JWT ainda é validado).
const getCorsHeaders = (req: Request) => {
  const origin = req.headers.get('Origin') || ''
  // Permite localhost (dev) e netlify.app (prod). Ajuste conforme seu domínio real.
  const isAllowed = origin.includes('localhost') || origin.includes('netlify.app') || origin.includes('opuscash')
  return {
    ...CORS_HEADERS,
    'Access-Control-Allow-Origin': isAllowed ? origin : '*',
  }
}

const MOEDAS = ['brl', 'usd', 'eur', 'gbp', 'ars', 'clp', 'uyu', 'cop', 'pen', 'mxn', 'cad', 'aud', 'chf']

const resposta = (corpo: unknown, status = 200, req: Request) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } })

/** Formulário no jeito do Stripe: objetos e listas viram chaves[com][colchetes]. */
function formulario(obj: Record<string, unknown>, prefixo = '', saida = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue
    const chave = prefixo ? `${prefixo}[${k}]` : k
    if (Array.isArray(v)) v.forEach((x, i) => (typeof x === 'object' ? formulario(x as Record<string, unknown>, `${chave}[${i}]`, saida) : saida.append(`${chave}[${i}]`, String(x))))
    else if (typeof v === 'object') formulario(v as Record<string, unknown>, chave, saida)
    else saida.append(chave, String(v))
  }
  return saida
}
async function stripe(caminho: string, dados?: Record<string, unknown>) {
  const r = await fetch(`https://api.stripe.com/v1/${caminho}`, {
    method: dados ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${Deno.env.get('STRIPE_SECRET_KEY')}`, ...(dados ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
    body: dados ? formulario(dados) : undefined,
  })
  const j = await r.json()
  if (!r.ok) throw new Error(j?.error?.message ?? 'Erro no Stripe')
  return j
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const eu = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
    const { data: { user } } = await eu.auth.getUser()
    if (!user) return resposta({ erro: 'Entre na sua conta para assinar.' }, 401, req)
    const servico = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { retorno, moeda } = await req.json().catch(() => ({}))
    let origem: string
    try { origem = new URL(String(retorno)).origin } catch { return resposta({ erro: 'Endereço de retorno inválido.' }, 400, req) }

    const { data: atual } = await servico.from('assinaturas').select('*').eq('user_id', user.id).maybeSingle()
    if (atual && ['trialing', 'active', 'past_due', 'cortesia'].includes(atual.status)) return resposta({ erro: 'ja_ativa' }, 409, req)

    let cliente: string | null = atual?.stripe_customer_id ?? null
    if (!cliente) {
      const c = await stripe('customers', { email: user.email, metadata: { supabase_user_id: user.id } })
      cliente = c.id as string
      await servico.from('assinaturas').upsert({ user_id: user.id, stripe_customer_id: cliente, atualizado_em: new Date().toISOString() })
    }

    const precos = await stripe('prices?lookup_keys[]=opuscash_mensal&active=true')
    const preco = precos.data?.[0]?.id
    if (!preco) return resposta({ erro: 'Plano não encontrado no Stripe.' }, 500, req)

    const moedaEscolhida = typeof moeda === 'string' && MOEDAS.includes(moeda.toLowerCase()) ? moeda.toLowerCase() : undefined
    const sessao = await stripe('checkout/sessions', {
      mode: 'subscription',
      customer: cliente,
      client_reference_id: user.id,
      line_items: [{ price: preco, quantity: 1 }],
      currency: moedaEscolhida,
      payment_method_collection: 'always',
      subscription_data: {
        metadata: { supabase_user_id: user.id },
      },
      allow_promotion_codes: true,
      locale: 'auto',
      success_url: `${origem}/?assinatura=ok`,
      cancel_url: `${origem}/?assinatura=cancelada`,
    })
    return resposta({ url: sessao.url }, 200, req)
  } catch (e) {
    return resposta({ erro: e instanceof Error ? e.message : 'Erro inesperado.' }, 500, req)
  }
})
