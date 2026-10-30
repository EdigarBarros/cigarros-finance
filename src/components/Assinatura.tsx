import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { iniciarTesteGratis, irParaStripe, podeTestar, type Assinatura } from '../lib/assinatura'
import { supabase } from '../lib/supabase'
import { Icone } from './Icone'
import { LinksLegais } from './Legal'
import { Marca } from './Marca'
import { VitrinePlanos } from './VitrinePlanos'
import { tx } from '../lib/textos'

const ETAPAS = [
  { icone: 'calendario', cor: 'var(--entrada)', titulo: tx('Hoje'), texto: tx('Seu teste começa na hora. Acesso completo, sem cartão.') },
  { icone: 'relogio', cor: '#f5a524', titulo: tx('Dia 7'), texto: tx('O teste termina e o painel fica bloqueado. Seus dados continuam guardados.') },
  { icone: 'cartao', cor: 'var(--destaque)', titulo: tx('Para continuar'), texto: tx('Assine por R$ 9,99 por mês. Sem fidelidade, cancele quando quiser.') },
]

const SEGURANCA = [
  { icone: 'escudo', titulo: tx('Conexão criptografada'), texto: tx('Tudo o que você digita viaja protegido (HTTPS) entre o seu aparelho e o OpusCash.') },
  { icone: 'cofre', titulo: tx('Dados criptografados'), texto: tx('Seus dados ficam guardados em servidores com criptografia, e sua senha nunca é salva em texto.') },
  { icone: 'pessoa', titulo: tx('Só você enxerga'), texto: tx('Cada conta é isolada no banco de dados: ninguém vê os lançamentos de ninguém. Não vendemos nem lemos seus dados.') },
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
  const [saindo, setSaindo] = useState(false)
  const testeGravado = useRef(false)
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
    // Se o teste já foi gravado numa tentativa anterior (e só o painel não abriu), não repete a gravação: só tenta abrir de novo.
    if (!testeGravado.current) {
      const msg = await iniciarTesteGratis()
      if (msg) { setErro(msg); setOcupado(null); return }
      testeGravado.current = true
    }
    // a tela é coberta pela marca (a mesma do "Carregando") e, só então, o App a troca pelo painel: nunca fica em branco
    setSaindo(true)
    await new Promise((r) => window.setTimeout(r, 480))
    await aoAtualizar()
    // se esta tela continua aqui, o painel não abriu (leitura falhou): descobre a tela e deixa tentar de novo
    setSaindo(false)
    setOcupado(null)
    setErro(tx('Seu teste já começou, mas não deu para abrir o painel agora. Toque no botão para tentar de novo.'))
  }
  const assinar = async () => {
    setOcupado('assinar')
    setErro(null)
    // a moeda do perfil escolhe o preço na página de pagamento; sem perfil ainda, o Stripe decide pelo país
    const { data } = await supabase.from('perfis').select('moeda').maybeSingle()
    const msg = await irParaStripe('stripe-checkout', (data as { moeda?: string } | null)?.moeda)
    if (msg) { setErro(msg); setOcupado(null) }
  }

  const titulo = esperando ? tx('Confirmando seu pagamento…')
    : novo ? tx('Comece com 7 dias grátis')
    : testeAcabou ? tx('Seu teste grátis acabou')
    : assinatura?.status === 'past_due' || assinatura?.status === 'unpaid' ? tx('Não conseguimos cobrar seu cartão')
    : tx('Sua assinatura terminou')
  const sub = novo ? tx('Use o OpusCash completo por 7 dias, sem pagar nada. Se quiser continuar depois, são R$ 9,99 por mês.')
    : testeAcabou ? tx('Seus 7 dias grátis terminaram. Assine para continuar de onde parou. Seus dados continuam guardados.')
    : tx('Assine para voltar ao seu painel. Seus dados continuam guardados.')

  return (
    <main className={`pl ${saindo ? 'saindo' : ''}`}>
      <section className="pl-lado">
        <div className="pl-orbe pl-orbe-a" aria-hidden="true" />
        <div className="pl-orbe pl-orbe-b" aria-hidden="true" />
        <div className="pl-lado-conteudo">
          <Marca grande />
          <h2 className="pl-frase">{tx('Suas finanças em')} <span className="gradiente-texto">{tx('um só lugar')}</span>.</h2>
          <VitrinePlanos />
          <div className="pl-seguranca">
            <h3><Icone nome="escudo" tamanho={18} />{tx('Seus dados, protegidos')}</h3>
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
          {esperando ? (
            <>
              <h1>{titulo}</h1>
              <div className="pl-carregando" aria-hidden="true"><i /><i /><i /></div>
              <p className="pl-sub">{tx('Isso leva só alguns segundos. Você entra sozinho assim que o pagamento for confirmado.')}</p>
            </>
          ) : (
            <>
              <article className="pl-card destaque">
                {novo ? (
                  <>
                    <span className="pl-selo"><Icone nome="ideia" tamanho={13} />{tx('Sem cartão para começar')}</span>
                    <h1>{titulo}</h1>
                    <div className="pl-faixa">
                      <span><strong>{tx('7 dias')}</strong> {tx('grátis')}</span>
                      <Icone nome="seta" tamanho={16} />
                      <span><strong>R$ 9,99</strong> {tx('por mês')}</span>
                    </div>
                    <p className="pl-sub">{sub}</p>
                    <ol className="pl-linha">
                      {ETAPAS.map((e, i) => (
                        <li key={e.titulo} style={{ '--i': i } as CSSProperties}>
                          <span className="pl-etapa-icone" style={{ '--c': e.cor } as CSSProperties}><Icone nome={e.icone} tamanho={18} /></span>
                          <div><strong>{e.titulo}</strong><p>{e.texto}</p></div>
                        </li>
                      ))}
                    </ol>
                  </>
                ) : (
                  <>
                    <div className="pl-preco-grande"><strong>R$ 9,99</strong><span>{tx('por mês')}</span></div>
                    <h1>{titulo}</h1>
                    <p className="pl-sub">{sub}</p>
                    <ul className="pl-pontos">
                      <li><Icone nome="check" tamanho={15} />{tx('Tudo do OpusCash, sem limites')}</li>
                      <li><Icone nome="check" tamanho={15} />{tx('Sem fidelidade, cancele quando quiser')}</li>
                      <li><Icone nome="check" tamanho={15} />{tx('Valor na sua moeda na página de pagamento')}</li>
                    </ul>
                  </>
                )}
                {erro && <p className="form-erro" role="alert">{erro}</p>}
                {novo ? (
                  <button className="btn gradiente pl-botao" onClick={comecarTeste} disabled={ocupado !== null}>
                    {ocupado === 'teste' ? tx('Preparando seu painel…') : <>{tx('Começar meus 7 dias grátis')} <Icone nome="seta" tamanho={17} /></>}
                  </button>
                ) : (
                  <button className="btn gradiente pl-botao" onClick={assinar} disabled={ocupado !== null}>
                    {ocupado === 'assinar' ? tx('Abrindo o pagamento…') : tx('Assinar por R$ 9,99/mês')}
                  </button>
                )}
                <small className="pl-nota">
                  {novo ? tx('Depois dos 7 dias, para continuar usando o painel: R$ 9,99 por mês. O cartão só é pedido nessa hora, na página segura do Stripe.')
                    : tx('O pagamento é feito na página segura do Stripe. Cancele quando quiser, sem multa.')}
                </small>
              </article>
              <small className="pl-nota">{tx('Ao continuar, você concorda com os')} <a href="#/termos">{tx('Termos de uso')}</a> {tx('e a')} <a href="#/privacidade">{tx('Política de privacidade')}</a>.</small>
            </>
          )}
          <LinksLegais />
          <button className="link pl-sair" onClick={() => supabase.auth.signOut()}>{tx('Sair ({0})', email)}</button>
        </div>
      </section>
    </main>
  )
}
