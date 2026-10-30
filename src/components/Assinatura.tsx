import { useEffect, useRef, useState } from 'react'
import { iniciarTesteGratis, irParaStripe, podeTestar, type Assinatura } from '../lib/assinatura'
import { supabase } from '../lib/supabase'
import { Icone } from './Icone'
import { LinksLegais } from './Legal'
import { Marca } from './Marca'

const BENEFICIOS = [
  'Lançamentos, categorias, bancos e cartões',
  'Dívidas, metas e contas do mês',
  'Qualquer moeda, com a cotação do dia',
  'Importa extrato do banco e planilhas',
]

const SEGURANCA = [
  { icone: 'escudo', titulo: 'Conexão criptografada', texto: 'Tudo o que você digita viaja protegido (HTTPS) entre o seu aparelho e o OpusCash.' },
  { icone: 'cofre', titulo: 'Dados criptografados', texto: 'Seus dados ficam guardados em servidores com criptografia, e sua senha nunca é salva em texto.' },
  { icone: 'pessoa', titulo: 'Só você enxerga', texto: 'Cada conta é isolada no banco de dados: ninguém vê os lançamentos de ninguém. Não vendemos nem lemos seus dados.' },
]

/**
 * Tela cheia que fica no lugar do painel enquanto a pessoa não tem acesso: conta nova (escolhe entre o teste grátis e assinar),
 * teste que acabou, assinatura cancelada ou cobrança que falhou. O teste grátis de 7 dias começa quando ela clica no plano, sem
 * cartão; o cartão só é pedido ao assinar, na página do Stripe. Voltando da página de pagamento, espera o Stripe avisar o
 * servidor e entra sozinha.
 */
export function TelaAssinatura({ assinatura, email, aoAtualizar }: { assinatura: Assinatura | null; email: string; aoAtualizar: () => Promise<unknown> }) {
  const voltou = new URLSearchParams(window.location.search).get('assinatura') === 'ok'
  const [ocupado, setOcupado] = useState<'teste' | 'assinar' | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [esperando, setEsperando] = useState(voltou)
  const tentativas = useRef(0)

  // Depois de pagar, o aviso do Stripe leva alguns segundos para chegar: consulta até liberar (ou desiste em 40 s).
  useEffect(() => {
    if (!esperando) return
    const t = window.setInterval(() => {
      tentativas.current += 1
      void aoAtualizar()
      if (tentativas.current >= 20) setEsperando(false)
    }, 2000)
    return () => window.clearInterval(t)
  }, [esperando, aoAtualizar])

  const novo = podeTestar(assinatura)
  const testeAcabou = assinatura?.status === 'teste'

  const comecarTeste = async () => {
    setOcupado('teste')
    setErro(null)
    const msg = await iniciarTesteGratis()
    if (msg) { setErro(msg); setOcupado(null); return }
    await aoAtualizar() // com o teste gravado, o App troca esta tela pelo painel
  }
  const assinar = async () => {
    setOcupado('assinar')
    setErro(null)
    // a moeda do perfil escolhe o preço na página de pagamento; sem perfil ainda, o Stripe decide pelo país
    const { data } = await supabase.from('perfis').select('moeda').maybeSingle()
    const msg = await irParaStripe('stripe-checkout', (data as { moeda?: string } | null)?.moeda)
    if (msg) { setErro(msg); setOcupado(null) }
  }

  const titulo = esperando ? 'Confirmando seu pagamento…'
    : novo ? 'Escolha como começar'
    : testeAcabou ? 'Seu teste grátis acabou'
    : assinatura?.status === 'past_due' || assinatura?.status === 'unpaid' ? 'Não conseguimos cobrar seu cartão'
    : 'Sua assinatura terminou'
  const sub = novo ? 'Teste tudo por 7 dias, sem cartão. Se gostar, é só assinar depois.'
    : testeAcabou ? 'Seus 7 dias grátis terminaram. Assine para continuar de onde parou. Seus dados continuam guardados.'
    : 'Assine para voltar ao seu painel. Seus dados continuam guardados.'

  return (
    <main className="pl">
      <section className="pl-lado">
        <div className="pl-orbe pl-orbe-a" aria-hidden="true" />
        <div className="pl-orbe pl-orbe-b" aria-hidden="true" />
        <div className="pl-lado-conteudo">
          <Marca grande />
          <h2 className="pl-frase">Suas finanças em <span className="gradiente-texto">um só lugar</span>.</h2>
          <ul className="pl-beneficios">
            {BENEFICIOS.map((b) => <li key={b}><Icone nome="check" tamanho={16} />{b}</li>)}
          </ul>
          <div className="pl-seguranca">
            <h3><Icone nome="escudo" tamanho={18} />Seus dados, protegidos</h3>
            <ul>
              {SEGURANCA.map((s) => (
                <li key={s.titulo}>
                  <span className="pl-seg-icone"><Icone nome={s.icone} tamanho={18} /></span>
                  <div><strong>{s.titulo}</strong><p>{s.texto}</p></div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="pl-planos">
        <div className="pl-planos-miolo">
          <h1>{titulo}</h1>
          {esperando ? (
            <p className="pl-sub">Isso leva só alguns segundos. Você entra sozinho assim que o pagamento for confirmado.</p>
          ) : (
            <>
              <p className="pl-sub">{sub}</p>
              <div className={`pl-cards ${novo ? '' : 'um'}`}>
                {novo && (
                  <article className="pl-card destaque">
                    <span className="pl-selo">Mais escolhido</span>
                    <h3>Teste grátis</h3>
                    <div className="pl-valor"><strong>R$ 0</strong><span>por 7 dias</span></div>
                    <ul>
                      <li><Icone nome="check" tamanho={15} />Acesso completo, sem limites</li>
                      <li><Icone nome="check" tamanho={15} />Sem cartão de crédito</li>
                      <li><Icone nome="check" tamanho={15} />Seus dados ficam guardados se você assinar</li>
                    </ul>
                    <button className="btn gradiente pl-botao" onClick={comecarTeste} disabled={ocupado !== null}>
                      {ocupado === 'teste' ? 'Preparando seu painel…' : 'Começar teste grátis'}
                    </button>
                  </article>
                )}
                <article className="pl-card">
                  <h3>OpusCash mensal</h3>
                  <div className="pl-valor"><strong>R$ 9,99</strong><span>/ mês</span></div>
                  <ul>
                    <li><Icone nome="check" tamanho={15} />Tudo do teste, sem prazo</li>
                    <li><Icone nome="check" tamanho={15} />Sem fidelidade, cancele quando quiser</li>
                    <li><Icone nome="check" tamanho={15} />Valor na sua moeda na página de pagamento</li>
                  </ul>
                  <button className={`btn pl-botao ${novo ? '' : 'gradiente'}`} onClick={assinar} disabled={ocupado !== null}>
                    {ocupado === 'assinar' ? 'Abrindo o pagamento…' : novo ? 'Assinar agora' : 'Assinar por R$ 9,99/mês'}
                  </button>
                </article>
              </div>
              {erro && <p className="form-erro" role="alert">{erro}</p>}
              <small className="pl-nota">O cartão só é pedido se você decidir assinar, na página segura do Stripe. Cancele quando quiser, sem multa.</small>
              <small className="pl-nota">Ao continuar, você concorda com os <a href="#/termos">Termos de uso</a> e a <a href="#/privacidade">Política de privacidade</a>.</small>
            </>
          )}
          <LinksLegais />
          <button className="link pl-sair" onClick={() => supabase.auth.signOut()}>Sair ({email})</button>
        </div>
      </section>
    </main>
  )
}
