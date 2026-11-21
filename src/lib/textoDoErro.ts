/**
 * O texto de um erro para a pessoa ler. O Supabase devolve o erro como objeto simples ({ message, details, hint, code }),
 * que não é `Error`: `String(e)` virava "[object Object]" e escondia a causa.
 */
export function textoDoErro(e: unknown): string {
  if (e instanceof Error) return e.message
  if (e && typeof e === 'object') {
    const o = e as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown }
    const partes = [o.message, o.details, o.hint].filter((x): x is string => typeof x === 'string' && x.trim() !== '')
    if (partes.length) return partes.join(' · ') + (o.code ? ` (${String(o.code)})` : '')
    try { return JSON.stringify(e) } catch { /* cai para String */ }
  }
  return String(e)
}

/** Um `Error` de verdade (com a mensagem legível) a partir de qualquer coisa lançada. */
export const paraErro = (e: unknown): Error => (e instanceof Error ? e : Object.assign(new Error(textoDoErro(e)), { causa: e }))
