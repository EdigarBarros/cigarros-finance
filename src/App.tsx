import type { Session } from '@supabase/supabase-js'
import { lazy, Suspense, useEffect, useReducer, useRef, useState } from 'react'
import { BotaoIdioma } from './components/BotaoIdioma'
import { BotaoTema } from './components/BotaoTema'
import { Carregando } from './components/Carregando'
import { Configuracao, Login, NovaSenha } from './components/Entrada'
import { TelaAssinatura } from './components/Assinatura'
import { TelaSemInternet } from './components/SemInternet'
import { PaginaLegal } from './components/Legal'
import { noAppAndroid } from './lib/appAndroid'
import { documentoDoHash } from './lib/legal'
import { nativo } from './lib/textos'
import { temAcesso, useAssinatura } from './lib/assinatura'
import { configurado, supabase } from './lib/supabase'
import { useSemInternet } from './lib/conexao'
import { iniciarUso, marcarTela } from './lib/uso'
import { Apresentacao } from './pages/Apresentacao'
import './pages/apresentacao.css'
import './pages/apresentacao-telas.css'

/**
 * Telas sem a barra do painel: os botões de tema e de idioma ficam presos no canto de cima (no painel, ficam na barra).
 * `traduzida`: a tela tem os textos em inglês e espanhol (lib/textos.ts); nesses idiomas o tradutor do Google não mexe nela.
 */
const comIdioma = (tela: React.ReactNode, traduzida = true) => (
  <>
    {traduzida && nativo ? <div translate="no" className="tela-nativa">{tela}</div> : tela}
    <div className="topo-flutuante">
      <BotaoTema />
      <BotaoIdioma flutuante />
    </div>
  </>
)

const carregarPainel = () => import('./components/Painel').then((m) => ({ default: m.Painel }))
const Painel = lazy(carregarPainel)

/**
 * Quem já tem sessão guardada neste aparelho vai cair no painel: começa a baixá-lo agora, junto com a leitura da sessão e da
 * assinatura, em vez de esperar as duas terminarem (era uma fila: sessão, assinatura e só então o painel).
 */
try {
  if (Object.keys(localStorage).some((k) => /^sb-.+-auth-token$/.test(k))) void carregarPainel()
} catch { /* armazenamento bloqueado: baixa quando precisar */ }

export default function App() {
  const [sessao, setSessao] = useState<Session | null | undefined>(undefined)
  const [doc, setDoc] = useState(documentoDoHash)
  const [recuperando, setRecuperando] = useState(false)
  // null = landing; senão, qual aba do login abrir (entrar ou criar conta)
  const [login, setLogin] = useState<'entrar' | 'criar' | null>(null)
  // abrir o login entra no histórico: o "voltar" do navegador (ou o gesto de voltar do celular) traz de volta à apresentação
  const abrirLogin = (m: 'entrar' | 'criar') => { history.pushState({ opusLogin: m }, ''); setLogin(m) }
  const voltarAoInicio = () => { if (history.state?.opusLogin) history.back(); else setLogin(null) }
  useEffect(() => {
    const aoVoltar = () => setLogin(history.state?.opusLogin ?? null)
    window.addEventListener('popstate', aoVoltar)
    return () => window.removeEventListener('popstate', aoVoltar)
  }, [])

  useEffect(() => {
    if (!configurado) return
    supabase.auth.getSession().then(({ data }) => setSessao(data.session))
    const { data } = supabase.auth.onAuthStateChange((e, s) => {
      setSessao(s)
      if (e === 'PASSWORD_RECOVERY') setRecuperando(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const aoMudar = () => setDoc(documentoDoHash())
    window.addEventListener('hashchange', aoMudar)
    return () => window.removeEventListener('hashchange', aoMudar)
  }, [])

  if (doc) return comIdioma(<PaginaLegal doc={doc} />, false)
  if (!configurado) return comIdioma(<Configuracao />)
  if (sessao === undefined) return <Carregando />

  // o link de "Esqueci minha senha" cria uma sessão: a tela de nova senha vem antes de qualquer outra
  if (recuperando) return comIdioma(<NovaSenha aoConcluir={() => setRecuperando(false)} />)
  if (!sessao) {
    // Landing page por padrão; o login (ou o cadastro) abre quando a pessoa clica. No app da Play Store, que já foi instalado,
    // a propaganda (com o preço) não faz sentido: abre direto no login.
    // no app da Play Store não há apresentação para onde voltar
    if (login || noAppAndroid) return comIdioma(<Login inicial={login ?? 'entrar'} aoVoltar={noAppAndroid ? undefined : voltarAoInicio} />)
    return comIdioma(<Apresentacao onLogin={() => abrirLogin('entrar')} onSignup={() => abrirLogin('criar')} />)
  }

  return <ComAcesso userId={sessao.user.id} email={sessao.user.email ?? ''} nome={sessao.user.user_metadata?.nome} />
}

/** Só abre o painel para quem está no teste grátis, com a assinatura em dia ou com a conta liberada. */
function ComAcesso({ userId, email, nome }: { userId: string; email: string; nome?: string }) {
  const { assinatura, carregando, cobranca, erro, recarregar } = useAssinatura(userId)
  const semInternet = useSemInternet()
  // Quando o teste grátis (ou o Pix de 30 dias) acaba com o painel aberto, a tela de assinatura entra na hora (sem esperar a pessoa recarregar).
  const [, reavaliar] = useReducer((n: number) => n + 1, 0)
  const fimDoAcesso = assinatura?.status === 'teste' && assinatura.teste_fim ? new Date(assinatura.teste_fim).getTime()
    : assinatura?.status === 'pix' && assinatura.periodo_fim ? new Date(assinatura.periodo_fim).getTime()
    : null
  useEffect(() => {
    if (!fimDoAcesso) return
    const falta = fimDoAcesso - Date.now()
    if (falta <= 0 || falta > 2_000_000_000) return // já acabou, ou longe demais para um timer
    const t = window.setTimeout(reavaliar, falta + 500)
    return () => window.clearTimeout(t)
  }, [fimDoAcesso])
  // Voltando da página de pagamento (?assinatura=ok) o aviso do Stripe leva alguns segundos para chegar: confere de novo a cada 2 s, por até 40 s,
  // até a assinatura mudar (ex.: o Pix pago somou os 30 dias). Enquanto isso a aba Assinatura avisa que está conferindo.
  const [confirmando, setConfirmando] = useState(() => new URLSearchParams(window.location.search).get('assinatura') === 'ok')
  const chaveAtual = useRef('')
  const chave = assinatura ? `${assinatura.status}|${assinatura.periodo_fim}|${assinatura.teste_fim}|${assinatura.cancela_no_fim}` : ''
  useEffect(() => { chaveAtual.current = chave }, [chave])
  useEffect(() => {
    if (carregando || !confirmando) return
    const inicio = chaveAtual.current
    let tentativas = 0
    const t = window.setInterval(() => {
      tentativas += 1
      if (chaveAtual.current !== inicio || tentativas > 20) {
        window.clearInterval(t)
        setConfirmando(false)
        try { window.history.replaceState(null, '', window.location.pathname + window.location.hash) } catch { /* sem history: o aviso só não some da barra de endereço */ }
        return
      }
      void recarregar()
    }, 2000)
    return () => window.clearInterval(t)
  }, [carregando, confirmando, recarregar])
  // medição de uso (telas, tempo, idioma: nunca o conteúdo) para o painel de suporte; desliga ao sair da conta
  useEffect(() => iniciarUso(), [userId])
  const naAssinatura = !carregando && cobranca && !temAcesso(assinatura)
  useEffect(() => { if (naAssinatura) marcarTela('assinatura') }, [naAssinatura])
  // sem internet (ou sem resposta do servidor) antes de o painel abrir: avisa, em vez do carregando para sempre
  if (carregando) return semInternet || erro ? comIdioma(<TelaSemInternet aoTentar={recarregar} />) : <Carregando />
  if (cobranca && !temAcesso(assinatura)) return comIdioma(<TelaAssinatura assinatura={assinatura} email={email} aoAtualizar={recarregar} />)
  return (
    <Suspense fallback={<Carregando />}>
      {/* inglês e espanhol: o painel já vem traduzido (tx), o tradutor do Google não mexe */}
      {nativo
        ? <div translate="no" className="tela-nativa"><Painel userId={userId} email={email} nome={nome} assinatura={cobranca ? assinatura : null} confirmandoPagamento={confirmando} /></div>
        : <Painel userId={userId} email={email} nome={nome} assinatura={cobranca ? assinatura : null} confirmandoPagamento={confirmando} />}
    </Suspense>
  )
}