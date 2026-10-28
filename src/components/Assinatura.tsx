import { useEffect, useRef, useState } from 'react'
import { irParaStripe, type Assinatura } from '../lib/assinatura'
import { supabase } from '../lib/supabase'
import { Icone } from './Icone'
import { Marca } from './Marca'

const BENEFICIOS = [
  'Lançamentos, categorias, bancos e cartões',
  'Dívidas, metas e contas do mês',
  'Qualquer moeda, com a cotação do dia',
  'Importa extrato do banco e planilhas',
]

/**
 * Tela que fica no lugar do painel enquanto a pessoa não tem acesso: conta nova, teste que acabou, assinatura cancelada
 * ou cobrança que falhou. O pagamento é na página do Stripe (cartão obrigatório; os 7 dias grátis só valem na primeira vez).
 * Voltando da página de pagamento, espera o Stripe avisar o servidor e entra sozinha.
 */
export function TelaAssinatura({ assinatura, email, aoAtualizar }: { assinatura: Assinatura | null; email: string; aoAtualizar: () => Promise<unknown> }) {
  const voltou = new URLSearchParams(window.location.search).get('assinatura') === 'ok'
  const [ocupado, setOcupado] = useState(false)
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

  const jaTeve = Boolean(assinatura && assinatura.status !== 'sem_assinatura')
  const assinar = async () => {
    setOcupado(true)
    setErro(null)
    // a moeda do perfil escolhe o preço na página de pagamento; sem perfil ainda, o Stripe decide pelo país
    const { data } = await supabase.from('perfis').select('moeda').maybeSingle()
    const msg = await irParaStripe('stripe-checkout', (data as { moeda?: string } | null)?.moeda)
    if (msg) { setErro(msg); setOcupado(false) }
  }

  const titulo = esperando ? 'Confirmando seu pagamento…'
    : !jaTeve ? 'Experimente 7 dias grátis'
    : assinatura?.status === 'past_due' || assinatura?.status === 'unpaid' ? 'Não conseguimos cobrar seu cartão'
    : 'Sua assinatura terminou'

  return (
    <div className="tela-central">
      <div className="cartao as">
        <Marca grande />
        <h1>{titulo}</h1>
        {esperando ? (
          <p className="as-sub">Isso leva só alguns segundos. Você entra sozinho assim que o pagamento for confirmado.</p>
        ) : (
          <>
            <p className="as-sub">
              {!jaTeve
                ? 'Cadastre o cartão agora e use tudo por 7 dias sem pagar nada. Cancele quando quiser, antes do fim do teste, e não cobramos.'
                : 'Assine de novo para voltar ao seu painel. Seus dados continuam guardados.'}
            </p>
            <div className="as-preco">
              <strong>R$ 9,99</strong><span>/ mês</span>
              <small>O valor equivalente na sua moeda aparece na página de pagamento.</small>
            </div>
            <ul className="as-lista">
              {BENEFICIOS.map((b) => <li key={b}><Icone nome="check" tamanho={16} />{b}</li>)}
            </ul>
            {erro && <p className="form-erro" role="alert">{erro}</p>}
            <button className="btn gradiente as-botao" onClick={assinar} disabled={ocupado}>
              {ocupado ? 'Abrindo o pagamento…' : jaTeve ? 'Assinar por R$ 9,99/mês' : 'Começar 7 dias grátis'}
            </button>
            {!jaTeve && <small className="as-nota">Depois do teste, R$ 9,99 por mês no cartão. Sem fidelidade.</small>}
          </>
        )}
        <button className="link as-sair" onClick={() => supabase.auth.signOut()}>Sair ({email})</button>
      </div>
    </div>
  )
}
