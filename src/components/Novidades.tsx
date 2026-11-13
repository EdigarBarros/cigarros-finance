import { useEffect, useState } from 'react'
import { noAppNativo } from '../lib/appAndroid'
import { idiomaAtual } from '../lib/idioma'
import { supabase } from '../lib/supabase'
import { nativo, tx } from '../lib/textos'
import { CartaoNovidade, CORES_NOVIDADE, type CorNovidade } from './CartaoNovidade'

/*
 * Pop-up "Tem novidade!" (migração 31). As novidades são criadas e publicadas no painel de suporte; aqui só se lê a
 * mais recente publicada. Aparece UMA vez por pessoa (em qualquer aparelho: fica "novidade:<id>" em perfis.dispensadas)
 * e só para quem já tinha conta quando ela foi publicada (quem chega depois vê o tutorial, não a novidade).
 * Publicar uma novidade não pede versão nova do site nem do app.
 */

type Texto = { pt: string; en?: string; es?: string }
export interface Novidade {
  id: number; titulo: Texto; itens: { icone: string; texto: Texto }[]; icone: string; cor: string; tela: string | null
  onde: 'todos' | 'site' | 'app'; publicada_em: string
}

const noIdioma = (t?: Texto) => {
  if (!t) return ''
  const i = idiomaAtual()
  return (nativo && (i === 'en' || i === 'es') && t[i]?.trim()) || t.pt
}

/** "novidade:12" guardado → já viu a 12 e todas as anteriores. */
const vistaAte = (dispensadas: string[]) =>
  Math.max(0, ...dispensadas.filter((d) => d.startsWith('novidade:')).map((d) => Number(d.slice(9)) || 0))

/** A novidade que esta pessoa ainda não viu (ou null). Lê uma vez por abertura do painel. */
export function useNovidade(ativo: boolean, dispensadas: string[]) {
  const [nova, setNova] = useState<Novidade | null>(null)
  const ate = vistaAte(dispensadas)
  useEffect(() => {
    if (!ativo) return
    let cancelado = false
    void (async () => {
      try {
        const [{ data: s }, { data, error }] = await Promise.all([
          supabase.auth.getSession(),
          supabase.from('novidades').select('id, titulo, itens, icone, cor, tela, onde, publicada_em')
            .in('onde', ['todos', noAppNativo ? 'app' : 'site']).order('publicada_em', { ascending: false }).limit(1),
        ])
        const n = (data as Novidade[] | null)?.[0]
        if (cancelado || error || !n) return
        // conta criada depois da novidade: chegou já com ela, não precisa do aviso
        const criada = s.session?.user.created_at
        if (criada && new Date(criada).getTime() > new Date(n.publicada_em).getTime()) return
        setNova(n)
      } catch { /* sem a migração 31 ou sem internet: sem pop-up */ }
    })()
    return () => { cancelado = true }
  }, [ativo])
  return nova && nova.id > ate ? nova : null
}

export function PopupNovidade({ novidade, aoVer, aoFechar }: { novidade: Novidade; aoVer: (tela: string) => void; aoFechar: () => void }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [aoFechar])
  return (
    <CartaoNovidade
      titulo={noIdioma(novidade.titulo)}
      itens={(novidade.itens ?? []).slice(0, 4).map((it) => ({ icone: it.icone, texto: noIdioma(it.texto) }))}
      icone={novidade.icone}
      cor={(CORES_NOVIDADE as string[]).includes(novidade.cor) ? novidade.cor as CorNovidade : 'marca'}
      rotulos={{ selo: tx('Novidade'), ver: tx('Ver agora'), ok: tx('Legal!'), depois: tx('Depois'), fechar: tx('Fechar') }}
      temBotaoVer={Boolean(novidade.tela)}
      aoVer={() => aoVer(novidade.tela!)}
      aoFechar={aoFechar}
    />
  )
}
