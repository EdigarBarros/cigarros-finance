import type { Session } from '@supabase/supabase-js'
import { lazy, Suspense, useEffect, useReducer, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { BotaoIdioma } from './components/BotaoIdioma'
import { BotaoTema } from './components/BotaoTema'
import { Carregando } from './components/Carregando'
import { temSessaoSalva } from './lib/abertura'
import { Configuracao, Login, NovaSenha } from './components/Entrada'
import { TelaAssinatura } from './components/Assinatura'
import { TelaSemInternet } from './components/SemInternet'
import { PaginaLegal } from './components/Legal'
import { noAppAndroid } from './lib/appAndroid'
import { documentoDoHash } from './lib/legal'
import { nativo, tx } from './lib/textos'
import { temAcesso, useAssinatura } from './lib/assinatura'
import { configurado, supabase } from './lib/supabase'
import { aoMudarSessao, pararDeAdicionar, useAdicionando, useContasSalvas } from './lib/contas'
import { EscolherConta } from './components/EscolherConta'
import { useSemInternet } from './lib/conexao'
import { iniciarUso, marcarTela } from './lib/uso'
import { semMovimento } from './lib/tema'
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
if (temSessaoSalva()) void carregarPainel()

export default function App() {
  const [sessao, setSessao] = useState<Session | null | undefined>(undefined)
  const [doc, setDoc] = useState(documentoDoHash)
  const [recuperando, setRecuperando] = useState(false)
  // null = a tela de entrada (perfis, ou a apresentação para quem nunca entrou); senão, qual abrir: o login (entrar ou criar
  // conta) ou a apresentação pedida na tela de perfis
  const [login, setLogin] = useState<Destino | null>(null)
  // várias contas no aparelho (lib/contas.ts): as lembradas e o "Adicionar outra conta" pedido no menu
  const contas = useContasSalvas()
  const adicionando = useAdicionando()
  // abrir o login entra no histórico: o "voltar" do navegador (ou o gesto de voltar do celular) traz de volta à tela anterior
  const abrirLogin = (m: Destino) => trocarDeTela('vai', () => { history.pushState({ opusLogin: m }, ''); setLogin(m) })
  const voltarAoInicio = () => { if (history.state?.opusLogin) history.back(); else trocarDeTela('volta', () => setLogin(null)) }
  useEffect(() => {
    // a página abre sempre na tela de entrada: uma marca de login que ficou no histórico (entrou, recarregou, saiu) faria o
    // "voltar" cair no login em vez dos perfis
    if (history.state?.opusLogin) history.replaceState(null, '')
    const aoVoltar = () => trocarDeTela('volta', () => setLogin(history.state?.opusLogin ?? null))
    window.addEventListener('popstate', aoVoltar)
    return () => window.removeEventListener('popstate', aoVoltar)
  }, [])
  // tirou a última conta do aparelho (Gerenciar contas): segue para o login, em vez de voltar à apresentação
  const tinhaContas = useRef(contas.length > 0)
  useEffect(() => {
    if (tinhaContas.current && !contas.length && !login) abrirLogin('entrar')
    tinhaContas.current = contas.length > 0
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contas.length])

  useEffect(() => {
    if (!configurado) return
    supabase.auth.getSession().then(({ data }) => setSessao(data.session))
    const { data } = supabase.auth.onAuthStateChange((e, s) => {
      // outra conta entrou e a página vai recarregar: a tela de agora (a senha com o "tudo certo") fica até lá
      if (aoMudarSessao(e, s)) return
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
  if (sessao === undefined) return <Carregando segurar={temSessaoSalva()} />

  // o link de "Esqueci minha senha" cria uma sessão: a tela de nova senha vem antes de qualquer outra
  if (recuperando) return comIdioma(<NovaSenha aoConcluir={() => setRecuperando(false)} />)
  // "Adicionar outra conta" (ou entrar de novo numa conta lembrada cuja sessão venceu): o login aparece por cima, e a conta
  // aberta continua aberta até a outra entrar. "Voltar" desiste sem mudar nada.
  if (adicionando && (!sessao || adicionando.de === sessao.user.id)) {
    return comIdioma(<Login key={adicionando.email} inicial="entrar" emailInicial={adicionando.email} rotuloVoltar={tx('Voltar')} aoVoltar={pararDeAdicionar} />)
  }
  if (!sessao) {
    // Landing page por padrão; o login (ou o cadastro) abre quando a pessoa clica. No app da Play Store, que já foi instalado,
    // a propaganda (com o preço) não faz sentido: abre direto no login.
    // no app da Play Store não há apresentação para onde voltar
    // Com contas lembradas neste aparelho, primeiro a escolha de qual abrir (como no Google).
    if (!login && contas.length) {
      return comIdioma(<EscolherConta aoOutra={() => abrirLogin('entrar')} aoInicio={noAppAndroid ? undefined : () => abrirLogin('apresentacao')} />)
    }
    if (login === 'apresentacao' && !noAppAndroid) return comIdioma(<Apresentacao onLogin={() => abrirLogin('entrar')} onSignup={() => abrirLogin('criar')} />)
    if (login || noAppAndroid) {
      return comIdioma(<Login inicial={login === 'criar' ? 'criar' : 'entrar'} aoVoltar={noAppAndroid && !contas.length ? undefined : voltarAoInicio}
        rotuloVoltar={contas.length ? tx('Voltar') : undefined} />)
    }
    return comIdioma(<Apresentacao onLogin={() => abrirLogin('entrar')} onSignup={() => abrirLogin('criar')} />)
  }

  return <ComAcesso userId={sessao.user.id} email={sessao.user.email ?? ''} nome={sessao.user.user_metadata?.nome} />
}

type Destino = 'entrar' | 'criar' | 'apresentacao'

/**
 * Troca entre as telas de fora do painel (perfis, login, apresentação) com uma transição: a tela de agora recua e gira um
 * pouco, a nova chega do outro lado (index.css, ::view-transition). `vai` entra mais fundo, `volta` faz o caminho contrário.
 * Sem suporte do navegador, ou com animações reduzidas, só troca.
 */
function trocarDeTela(sentido: 'vai' | 'volta', mudar: () => void) {
  const doc = document as Document & { startViewTransition?: (f: () => void) => { finished: Promise<void> } }
  if (!doc.startViewTransition || semMovimento()) { mudar(); return }
  document.documentElement.dataset.troca = sentido
  const t = doc.startViewTransition(() => flushSync(mudar))
  void t.finished.finally(() => { delete document.documentElement.dataset.troca })
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