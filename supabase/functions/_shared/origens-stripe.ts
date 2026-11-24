const origens = new Set([
  'https://www.opuscash.com.br',
  'https://opuscash.com.br',
  ...(Deno.env.get('STRIPE_ALLOWED_ORIGINS') ?? '').split(',').map((origem) => origem.trim()).filter(Boolean),
])

export function getCorsHeaders(req: Request): Record<string, string> {
  const origem = req.headers.get('Origin')
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
  if (origem && origens.has(origem)) headers['Access-Control-Allow-Origin'] = origem
  return headers
}

export function origemDeRetorno(req: Request, retorno: unknown): string | null {
  if (typeof retorno !== 'string' || !origens.has(retorno)) return null
  const origem = req.headers.get('Origin')
  return origem === null || origem === retorno ? retorno : null
}
