import { createClient, type PostgrestError } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const configurado = Boolean(url && key)
export const supabase = createClient(url ?? 'http://localhost', key ?? 'missing')

/** O Supabase entrega no máximo 1000 linhas por consulta. */
const PAGINA = 1000

/**
 * Lê todas as linhas, de 1000 em 1000. Sem isso, quem tem mais de 1000 lançamentos no ano perdia os mais novos: sumiam dos
 * totais e a conta do mês já paga aparecia em aberto. `consulta` monta a consulta de novo a cada página e precisa de uma
 * ordem estável (termine com `.order('id')`), senão uma linha pode cair em duas páginas ou em nenhuma.
 */
export async function lerTudo<T>(
  consulta: () => { range: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }> },
): Promise<{ data: T[]; error: PostgrestError | null }> {
  const todas: T[] = []
  for (;;) {
    const { data, error } = await consulta().range(todas.length, todas.length + PAGINA - 1)
    if (error) return { data: todas, error }
    todas.push(...(data ?? []))
    if (!data || data.length < PAGINA) return { data: todas, error: null }
  }
}
