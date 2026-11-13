// Cria a página de pagamento do Stripe e devolve o endereço dela. O teste grátis de 7 dias é do OpusCash (sem cartão, migração 17):
// aqui a cobrança começa assim que a pessoa assina. Com tipo 'pix' cria, em vez disso, um pagamento único de 30 dias só com Pix.
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

// Pix de 30 dias: o stripe-webhook confere estes mesmos valores antes de liberar o acesso.
const PIX_MOEDA = 'brl'
const PIX_VALOR = 999 // centavos: R$ 9,99
const PIX_TIPO = 'pix_30_dias'

// Quem está no Pix e passa para o cartão não perde os dias que já pagou: o cartão só começa a cobrar quando o Pix acabar (trial_end).
// O Stripe só aceita trial_end com pelo menos 48 h pela frente; com folga, 50 h (src/lib/assinatura.ts, PIX_MINIMO_PARA_ESPERAR_MS).
const PIX_MINIMO_PARA_ESPERAR_MS = 50 * 3_600_000

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
// Versão antiga da API só para o Pix: nas versões novas o Stripe recusa `payment_method_types` ao criar a página de pagamento
// (os meios de pagamento passam a vir do painel) e o Pix deixaria de ser a única opção da tela.
const VERSAO_API_PIX = '2024-06-20'
async function stripe(caminho: string, dados?: Record<string, unknown>, versao?: string) {
  const r = await fetch(`https://api.stripe.com/v1/${caminho}`, {
    method: dados ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${Deno.env.get('STRIPE_SECRET_KEY')}`, ...(versao ? { 'Stripe-Version': versao } : {}), ...(dados ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
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

    const { retorno, moeda, tipo } = await req.json().catch(() => ({}))
    const ehPix = tipo === 'pix'
    let origem: string
    try { origem = new URL(String(retorno)).origin } catch { return resposta({ erro: 'Endereço de retorno inválido.' }, 400, req) }

    const { data: atual } = await servico.from('assinaturas').select('*').eq('user_id', user.id).maybeSingle()
    if (atual && ['trialing', 'active', 'cortesia'].includes(atual.status)) return resposta({ erro: 'ja_ativa' }, 409, req)
    // Já existe uma assinatura no Stripe com pagamento por resolver (cobrança recusada, pendente ou parada): uma segunda assinatura
    // cobraria em dobro. O app manda a pessoa para o portal, onde ela acerta o cartão da assinatura que já existe.
    if (atual && ['past_due', 'unpaid', 'incomplete', 'paused'].includes(atual.status)) return resposta({ erro: 'pagamento_pendente' }, 409, req)

    let cliente: string | null = atual?.stripe_customer_id ?? null
    if (!cliente) {
      const c = await stripe('customers', { email: user.email, metadata: { supabase_user_id: user.id } })
      cliente = c.id as string
      await servico.from('assinaturas').upsert({ user_id: user.id, stripe_customer_id: cliente, atualizado_em: new Date().toISOString() })
    }

    // Pix de 30 dias: pagamento ÚNICO em reais (a conta não tem o Pix Automático, então o Pix não cabe em assinatura). Quando o Stripe
    // avisa que foi pago, o stripe-webhook dá 30 dias de acesso (status 'pix'). O preço vai aqui mesmo, sem produto cadastrado.
    if (ehPix) {
      const sessaoPix = await stripe('checkout/sessions', {
        mode: 'payment',
        customer: cliente,
        client_reference_id: user.id,
        line_items: [{ price_data: { currency: PIX_MOEDA, unit_amount: PIX_VALOR, product_data: { name: 'OpusCash: 30 dias de acesso (Pix)' } }, quantity: 1 }],
        payment_method_types: ['pix'],
        payment_method_options: { pix: { expires_after_seconds: 3600 } },
        metadata: { supabase_user_id: user.id, tipo: PIX_TIPO },
        payment_intent_data: { metadata: { supabase_user_id: user.id, tipo: PIX_TIPO } },
        locale: 'pt-BR',
        success_url: `${origem}/?assinatura=ok`,
        cancel_url: `${origem}/?assinatura=cancelada`,
      }, VERSAO_API_PIX)
      return resposta({ url: sessaoPix.url }, 200, req)
    }

    const precos = await stripe('prices?lookup_keys[]=opuscash_mensal&active=true')
    const preco = precos.data?.[0]?.id
    if (!preco) return resposta({ erro: 'Plano não encontrado no Stripe.' }, 500, req)

    // o fim do Pix vem do banco, não do aparelho: o pedido não escolhe a data
    const fimDoPix = atual?.status === 'pix' && atual.periodo_fim ? new Date(atual.periodo_fim).getTime() : 0
    const esperarPeloPix = fimDoPix - Date.now() > PIX_MINIMO_PARA_ESPERAR_MS

    const moedaEscolhida = typeof moeda === 'string' && MOEDAS.includes(moeda.toLowerCase()) ? moeda.toLowerCase() : undefined
    const sessao = await stripe('checkout/sessions', {
      mode: 'subscription',
      customer: cliente,
      client_reference_id: user.id,
      line_items: [{ price: preco, quantity: 1 }],
      currency: moedaEscolhida,
      payment_method_collection: 'always',
      subscription_data: {
        // depois_do_pix: o stripe-webhook não confere o cartão como "teste grátis de outra conta" (esses dias foram pagos)
        metadata: { supabase_user_id: user.id, ...(esperarPeloPix ? { depois_do_pix: '1' } : {}) },
        trial_end: esperarPeloPix ? Math.floor(fimDoPix / 1000) : undefined,
      },
      allow_promotion_codes: true,
      locale: 'auto',
      success_url: `${origem}/?assinatura=ok`,
      cancel_url: `${origem}/?assinatura=cancelada`,
    })
    // espera: o app só leva a pessoa ao pagamento de "Passar do Pix para o cartão" se o servidor confirma que respeita os dias de Pix
    // (um servidor mais antigo não manda este campo e cobraria na hora)
    return resposta({ url: sessao.url, espera: esperarPeloPix }, 200, req)
  } catch (e) {
    return resposta({ erro: e instanceof Error ? e.message : 'Erro inesperado.' }, 500, req)
  }
})
