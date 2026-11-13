import { useEffect, useState } from 'react'
import { noAppNativo } from '../lib/appAndroid'
import { idiomaAtual } from '../lib/idioma'
import { supabase } from '../lib/supabase'
import { nativo, tx } from '../lib/textos'
import { ArteAjustada, TAMANHO, type Arte } from './ArteNovidade'
import { Icone } from './Icone'
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
  /** arte montada no editor do painel (migração 32); sem ela, vale o cartão simples */
  arte?: Arte | null
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
          supabase.from('novidades').select('*')
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
  const rotulos = { ver: tx('Ver agora'), ok: tx('Legal!'), depois: tx('Depois'), fechar: tx('Fechar') }
  const arte = novidade.arte
  if (arte && Array.isArray(arte.elementos) && arte.elementos.length) {
    const i = idiomaAtual()
    const largura = (TAMANHO[arte.formato] ?? TAMANHO.em_pe).w
    return (
      <div className="novidade-fundo" onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
        <div className="novidade novidade-arte" role="dialog" aria-modal="true" aria-label={noIdioma(novidade.titulo)} style={{ width: `min(${largura}px, 100%)` }}>
          <ArteAjustada arte={arte} idioma={nativo && (i === 'en' || i === 'es') ? i : 'pt'} />
          <button type="button" className="novidade-x" onClick={aoFechar} aria-label={rotulos.fechar}><Icone nome="fechar" tamanho={16} /></button>
          <div className="novidade-botoes">
            {novidade.tela && <button type="button" className="novidade-depois" onClick={aoFechar}>{rotulos.depois}</button>}
            <button type="button" className="novidade-ok" onClick={novidade.tela ? () => aoVer(novidade.tela!) : aoFechar} autoFocus>
              {novidade.tela ? rotulos.ver : rotulos.ok}{novidade.tela && <Icone nome="seta" tamanho={17} />}
            </button>
          </div>
        </div>
      </div>
    )
  }
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
