import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { EMAIL_SUPORTE } from '../lib/legal'
import { configurado, supabase } from '../lib/supabase'
import { EVENTO_ABRIR_SUPORTE as EVENTO } from '../lib/suporte'
import { useRespostasNovas } from '../lib/useSuporte'
import { tx } from '../lib/textos'
import { Icone } from './Icone'

/*
 * Aba "Suporte" presa na borda direita, em TODAS as telas do OpusCash: painel, janelas abertas, planejamento, tutorial,
 * tela de assinatura, login, apresentação, termos, sem internet e até a tela de erro. Fica fora do App (main.tsx), por cima
 * de tudo, e ocupa só uma faixa fina da borda: não cobre botões nem o fim das listas. Tem o ícone e a palavra "Suporte",
 * para ninguém precisar adivinhar o que é.
 * - Com conta aberta: abre a janela de suporte do app (pedidos e conversa) por cima do que estiver na tela.
 * - Sem conta: abre um e-mail para o suporte (VITE_EMAIL_SUPORTE).
 * Outras telas abrem a mesma janela com `abrirSuporte()` de lib/suporte.ts (ex.: "Falar com o suporte" da tela de assinatura).
 */

const Suporte = lazy(() => import('./Suporte').then((m) => ({ default: m.Suporte })))

function Aba({ avisos, aoAbrir, href }: { avisos: number; aoAbrir?: () => void; href?: string }) {
  const rotulo = avisos > 0
    ? (avisos === 1 ? tx('Suporte: 1 resposta nova') : tx('Suporte: {0} respostas novas', avisos))
    : tx('Suporte: peça ajuda')
  const miolo = (
    <>
      <Icone nome="conversa" tamanho={17} />
      <span>{tx('Suporte')}</span>
      {avisos > 0 && <b className="suporte-aba-aviso">{avisos}</b>}
    </>
  )
  return href
    ? <a className="suporte-aba" href={href} aria-label={rotulo} title={rotulo}>{miolo}</a>
    : <button type="button" className="suporte-aba" onClick={aoAbrir} aria-label={rotulo} title={rotulo}>{miolo}</button>
}

function ComConta() {
  const [aberto, setAberto] = useState<false | 'lista' | 'novo'>(false)
  const [avisos, conferir] = useRespostasNovas()
  useEffect(() => {
    const abrir = (e: Event) => setAberto((e as CustomEvent<'novo' | null>).detail === 'novo' ? 'novo' : 'lista')
    window.addEventListener(EVENTO, abrir)
    return () => window.removeEventListener(EVENTO, abrir)
  }, [])
  return (
    <>
      {!aberto && <Aba avisos={avisos} aoAbrir={() => setAberto('lista')} />}
      {aberto && (
        <Suspense fallback={null}>
          <Suporte inicial={aberto === 'novo' ? 'novo' : undefined} aoFechar={() => { setAberto(false); conferir() }} aoMudar={conferir} />
        </Suspense>
      )}
    </>
  )
}

function SemConta() {
  // sem conta não há pedido no app: "Falar com o suporte" de qualquer tela também vira o e-mail
  useEffect(() => {
    if (!EMAIL_SUPORTE) return
    const abrir = () => { window.location.href = `mailto:${EMAIL_SUPORTE}` }
    window.addEventListener(EVENTO, abrir)
    return () => window.removeEventListener(EVENTO, abrir)
  }, [])
  if (!EMAIL_SUPORTE) return null
  return <Aba avisos={0} href={`mailto:${EMAIL_SUPORTE}?subject=${encodeURIComponent(tx('Ajuda com o OpusCash'))}`} />
}

/** Um erro aqui nunca derruba o app: a aba só some. */
class Protegido extends Component<{ children: ReactNode }, { erro: boolean }> {
  state = { erro: false }
  static getDerivedStateFromError() { return { erro: true } }
  render() { return this.state.erro ? null : this.props.children }
}

export function SuporteGlobal() {
  const [userId, setUserId] = useState<string | null | undefined>(configurado ? undefined : null)
  useEffect(() => {
    if (!configurado) return
    void supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user.id ?? null))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setUserId(s?.user.id ?? null))
    return () => data.subscription.unsubscribe()
  }, [])
  if (userId === undefined) return null
  return (
    <Protegido>
      <div className="suporte-camada">
        {userId ? <ComConta key={userId} /> : <SemConta />}
      </div>
    </Protegido>
  )
}
