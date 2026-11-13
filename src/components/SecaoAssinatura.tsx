import { useEffect, useRef, useState } from 'react'
import { aceitaPix, irParaStripe, pixComSobra, resumoDaAssinatura, type Assinatura, type ResumoAssinatura } from '../lib/assinatura'
import { avisar } from '../lib/avisos'
import { LOCAL_DAS_DATAS } from '../lib/format'
import { tx } from '../lib/textos'
import { Icone } from './Icone'
import { CartaoAcao } from './ui'

/** "12 de dezembro de 2026" (ou "December 12, 2026"), no idioma da pessoa. */
const dataExtensa = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(LOCAL_DAS_DATAS, { day: 'numeric', month: 'long', year: 'numeric' }) : '')

type Tom = 'ok' | 'aviso' | 'perigo' | 'neutro'

/** Selo, frase grande e tom de cada situação. */
function cabecalho(r: ResumoAssinatura, a: Assinatura): { selo: string; frase: string; tom: Tom } {
  const um = r.dias === 1
  switch (r.tipo) {
    case 'teste':
      return { selo: tx('Teste grátis'), tom: 'neutro', frase: um ? tx('Falta 1 dia de teste grátis') : tx('Faltam {0} dias de teste grátis', r.dias) }
    case 'pix':
      return { selo: r.dias <= 5 ? tx('Vence em breve') : tx('Pago com Pix'), tom: r.dias <= 5 ? 'aviso' : 'ok', frase: um ? tx('Falta 1 dia de acesso') : tx('Faltam {0} dias de acesso', r.dias) }
    case 'cartao':
      // cartão cadastrado antes da primeira cobrança (teste do Stripe): a data é a da primeira cobrança
      if (a.status === 'trialing') return { selo: tx('Ativa'), tom: 'ok', frase: r.dias <= 0 ? tx('Primeira cobrança hoje') : um ? tx('Primeira cobrança em 1 dia') : tx('Primeira cobrança em {0} dias', r.dias) }
      return { selo: tx('Ativa'), tom: 'ok', frase: r.dias <= 0 ? tx('Renova hoje') : um ? tx('Renova em 1 dia') : tx('Renova em {0} dias', r.dias) }
    case 'cartao-cancelada':
      return { selo: tx('Cancelada'), tom: 'aviso', frase: r.dias <= 0 ? tx('O acesso termina hoje') : um ? tx('Falta 1 dia de acesso') : tx('Faltam {0} dias de acesso', r.dias) }
    case 'cartao-recusado':
      return { selo: tx('Cobrança recusada'), tom: 'perigo', frase: tx('Não conseguimos cobrar seu cartão') }
    case 'liberada':
      return { selo: tx('Liberada'), tom: 'ok', frase: tx('Conta liberada') }
  }
}

/**
 * Configurações → Assinatura: tudo sobre o que a pessoa paga, num lugar só. Mostra quanto tempo falta, como ela paga e quando vence,
 * e oferece o que dá para fazer em cada caso: renovar com Pix, passar do Pix para o cartão (ou do cartão para o Pix), trocar o
 * cartão, ver faturas, cancelar ou reativar. Cartão, faturas e cancelamento são do portal do Stripe (stripe-portal); o Pix e a
 * assinatura nova são o checkout (stripe-checkout). Não aparece no app da Play Store (lib/appAndroid.ts) nem em conta sem cobrança.
 */
export function SecaoAssinatura({ assinatura, moeda, confirmando, aoSuporte }: { assinatura: Assinatura; moeda: string; confirmando?: boolean; aoSuporte?: () => void }) {
  const [ocupado, setOcupado] = useState<string | null>(null)
  /** Explicação aberta antes de seguir: "Passar para o cartão" (de quem está no Pix) ou "Trocar para Pix" (de quem está no cartão). */
  const [painel, setPainel] = useState<'cartao' | 'pix' | null>(null)
  const r = resumoDaAssinatura(assinatura)
  const aberto = useRef<HTMLElement>(null)
  // a explicação abre abaixo dos cartões: no celular isso pode ficar fora da tela, então leva a vista até ela
  useEffect(() => { if (painel) aberto.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }) }, [painel])

  // voltar da página de pagamento pelo botão "voltar" do aparelho traz esta tela de volta como estava: destrava os botões
  useEffect(() => {
    const voltou = (e: PageTransitionEvent) => { if (e.persisted) setOcupado(null) }
    window.addEventListener('pageshow', voltou)
    return () => window.removeEventListener('pageshow', voltou)
  }, [])

  if (!r) return <section className="cfg-cartao"><p className="ass-nota">{tx('Esta conta ainda não tem uma assinatura ativa.')}</p></section>

  const ir = async (chave: string, abrir: () => Promise<string | null>) => {
    if (ocupado) return
    setOcupado(chave)
    const msg = await abrir() // se deu certo, a página troca para o Stripe e o botão fica ocupado até lá
    if (msg) { setOcupado(null); void avisar(msg) }
  }
  const portal = (chave: string) => () => void ir(chave, () => irParaStripe('stripe-portal'))
  const assinarNoCartao = (chave: string, exigirEspera = false) => () => void ir(chave, () => irParaStripe('stripe-checkout', moeda, undefined, exigirEspera))
  const pagarComPix = (chave: string) => () => void ir(chave, () => irParaStripe('stripe-checkout', 'BRL', 'pix'))

  const { selo, frase, tom } = cabecalho(r, assinatura)
  const emReais = aceitaPix(assinatura.moeda ?? moeda)
  const fim = dataExtensa(r.fim)
  const parte = r.total > 0 ? Math.min(1, Math.max(0, r.dias / r.total)) : 0

  const forma = r.tipo === 'teste' ? tx('Nenhuma ainda')
    : r.tipo === 'pix' ? tx('Pix')
    : r.tipo === 'liberada' ? tx('Não precisa pagar')
    : tx('Cartão')
  const renovacao = r.tipo === 'teste' ? tx('Acaba sozinho, sem cobrar nada')
    : r.tipo === 'pix' ? tx('Manual: você paga o Pix de novo')
    : r.tipo === 'cartao-cancelada' ? tx('Cancelada: não será cobrado de novo')
    : r.tipo === 'liberada' ? tx('Sem renovação')
    : tx('Automática, todo mês')
  const valor = r.tipo === 'liberada' ? null
    : r.tipo === 'pix' ? tx('R$ 9,99 a cada 30 dias')
    : r.tipo === 'teste' ? (emReais ? tx('Grátis por 7 dias, depois R$ 9,99 por mês') : tx('Grátis por 7 dias'))
    : emReais ? tx('R$ 9,99 por mês') : tx('Cobrado na sua moeda (veja nas faturas)')
  const rotuloFim = r.tipo === 'teste' ? tx('Teste até')
    : r.tipo === 'pix' || r.tipo === 'cartao-cancelada' ? tx('Acesso até')
    : assinatura.status === 'trialing' ? tx('Primeira cobrança')
    : tx('Próxima cobrança')
  const linhas: [string, string][] = [
    [tx('Forma de pagamento'), forma],
    [tx('Renovação'), renovacao],
    ...(valor ? [[tx('Valor'), valor] as [string, string]] : []),
  ]
  const plano = r.tipo === 'pix' ? tx('Pix de 30 dias') : r.tipo === 'teste' ? tx('Teste de 7 dias') : r.tipo === 'liberada' ? tx('Sem cobrança') : tx('Assinatura no cartão')

  // o que pede atenção agora, em uma faixa colorida logo abaixo do resumo
  const alerta: { tom: Tom; texto: string } | null =
    r.tipo === 'pix' && r.dias <= 5 ? { tom: 'aviso', texto: tx('Seu acesso por Pix termina em breve. O Pix não renova sozinho: renove para não perder o acesso.') }
    : r.tipo === 'cartao-recusado' ? { tom: 'perigo', texto: tx('O banco recusou a cobrança. Troque o cartão para manter o acesso: o Stripe tenta de novo em seguida.') }
    : r.tipo === 'cartao-cancelada' ? { tom: 'aviso', texto: emReais
      ? tx('Você cancelou: usa o OpusCash até {0} e não será cobrado de novo. Depois disso, é só escolher Pix ou cartão na tela que aparece. Seus dados continuam guardados.', fim)
      : tx('Você cancelou: usa o OpusCash até {0} e não será cobrado de novo. Depois disso, é só assinar de novo na tela que aparece. Seus dados continuam guardados.', fim) }
    : null

  return (
    <>
      {confirmando && (
        <p className="ass-alerta tom-neutro" role="status"><Icone nome="relogio" tamanho={16} /><span>{tx('Conferindo seu pagamento… Se você acabou de pagar, os dias novos aparecem aqui em alguns segundos.')}</span></p>
      )}
      <section className={`cfg-cartao ass-resumo tom-${tom}`} aria-label={tx('Resumo da assinatura')}>
        <header className="ass-topo">
          <span className="ass-icone"><Icone nome="cartao" tamanho={22} /></span>
          <div className="ass-nome"><strong>{tx('OpusCash')}</strong><small>{plano}</small></div>
          <span className={`ass-selo tom-${tom}`}>{selo}</span>
        </header>
        <div className="ass-tempo">
          <strong>{frase}</strong>
          {r.fim && r.tipo !== 'cartao-recusado' && <span>{rotuloFim}: {fim}</span>}
        </div>
        {parte > 0 && (
          <div className="ass-barra" role="progressbar" aria-valuemin={0} aria-valuemax={r.total} aria-valuenow={Math.min(r.dias, r.total)} aria-label={frase}>
            <i style={{ width: `${Math.max(parte * 100, 3)}%` }} />
          </div>
        )}
        <dl className="ass-lista">
          {linhas.map(([rotulo, texto]) => <div key={rotulo}><dt>{rotulo}</dt><dd>{texto}</dd></div>)}
        </dl>
        {alerta && <p className={`ass-alerta tom-${alerta.tom}`} role="status"><Icone nome="sino" tamanho={16} /><span>{alerta.texto}</span></p>}
        {r.tipo === 'liberada' && <p className="ass-nota">{tx('Sua conta foi liberada pela equipe do OpusCash. Você não precisa pagar nada.')}</p>}
      </section>

      {r.tipo !== 'liberada' && (
        <div className="cfg-acoes ass-acoes">
          {r.tipo === 'teste' && (
            <>
              <CartaoAcao icone="cartao" titulo={tx('Assinar no cartão')} texto={tx('Renova sozinha todo mês, sem você precisar lembrar. Cancele quando quiser.')}
                aoClicar={assinarNoCartao('assinar')} ocupado={ocupado === 'assinar'} />
              {emReais && <CartaoAcao icone="relogio" titulo={tx('Pagar 30 dias com Pix')} texto={tx('R$ 9,99 de uma vez, sem cartão e sem renovação automática.')}
                aoClicar={pagarComPix('pix')} ocupado={ocupado === 'pix'} />}
            </>
          )}

          {r.tipo === 'pix' && (
            <>
              <CartaoAcao icone="relogio" titulo={tx('Renovar com Pix')} texto={tx('Soma mais 30 dias ao que já sobrou. Pagamento único de R$ 9,99, sem cartão.')}
                aoClicar={pagarComPix('pix')} ocupado={ocupado === 'pix'} />
              <CartaoAcao icone="cartao" titulo={tx('Passar para o cartão')} texto={tx('Renova sozinha todo mês, sem você precisar lembrar de pagar.')}
                aoClicar={() => setPainel(painel === 'cartao' ? null : 'cartao')} />
            </>
          )}

          {(r.tipo === 'cartao' || r.tipo === 'cartao-cancelada' || r.tipo === 'cartao-recusado') && (
            <>
              {r.tipo === 'cartao-cancelada' && <CartaoAcao icone="trocar" titulo={tx('Reativar assinatura')} texto={tx('Volte a ser cobrado todo mês e fique sem interrupção.')}
                aoClicar={portal('portal')} ocupado={ocupado === 'portal'} />}
              <CartaoAcao icone="cartao" titulo={tx('Trocar o cartão')} texto={r.tipo === 'cartao-recusado' ? tx('Atualize o cartão para a cobrança passar e o acesso continuar.') : tx('Atualize o cartão que paga a assinatura.')}
                aoClicar={portal('cartao')} ocupado={ocupado === 'cartao'} />
              <CartaoAcao icone="relatorio" titulo={tx('Ver faturas')} texto={tx('Recibos e cobranças anteriores.')}
                aoClicar={portal('faturas')} ocupado={ocupado === 'faturas'} />
              {r.tipo === 'cartao' && emReais && <CartaoAcao icone="relogio" titulo={tx('Trocar para Pix')} texto={tx('O Pix paga 30 dias de uma vez e não renova sozinho.')}
                aoClicar={() => setPainel(painel === 'pix' ? null : 'pix')} />}
              {r.tipo !== 'cartao-cancelada' && r.fim && <CartaoAcao icone="fechar" titulo={tx('Cancelar assinatura')} texto={tx('Você usa até {0} e não é cobrado de novo.', fim)}
                aoClicar={portal('cancelar')} ocupado={ocupado === 'cancelar'} perigo />}
            </>
          )}
        </div>
      )}

      {painel === 'cartao' && (
        <section ref={aberto} className="cfg-cartao ass-confirma" aria-label={tx('Passar para o cartão')}>
          <h4>{tx('Passar para o cartão')}</h4>
          <p>
            {pixComSobra(assinatura)
              ? tx('Seus dias de Pix continuam valendo: o cartão só começa a ser cobrado em {0}. Depois disso, renova sozinha todo mês e você cancela quando quiser. A página de pagamento mostra a data antes de você confirmar.', fim)
              : tx('Como seu Pix acaba em {0}, o cartão é cobrado hoje e os dias que sobraram não são somados. Depois renova sozinha todo mês e você cancela quando quiser.', fim)}
          </p>
          <div className="ass-confirma-acoes">
            <button type="button" className="btn" onClick={() => setPainel(null)} disabled={ocupado !== null}>{tx('Agora não')}</button>
            <button type="button" className="btn gradiente" onClick={assinarNoCartao('cartao-pix', pixComSobra(assinatura))} disabled={ocupado !== null}>
              {ocupado === 'cartao-pix' ? tx('Abrindo o pagamento…') : tx('Continuar para o pagamento')}
            </button>
          </div>
        </section>
      )}

      {painel === 'pix' && (
        <section ref={aberto} className="cfg-cartao ass-confirma" aria-label={tx('Trocar para Pix')}>
          <h4>{tx('Trocar para Pix')}</h4>
          <p>{tx('O Pix é um pagamento único de 30 dias e não renova sozinho. Para trocar, são dois passos:')}</p>
          <ol>
            <li>{tx('Cancele a assinatura do cartão. Você continua com acesso até {0}.', fim)}</li>
            <li>{tx('Quando esse prazo acabar, escolha Pix na tela que aparece e pague R$ 9,99.')}</li>
          </ol>
          <div className="ass-confirma-acoes">
            <button type="button" className="btn" onClick={() => setPainel(null)} disabled={ocupado !== null}>{tx('Agora não')}</button>
            <button type="button" className="btn perigo-forte" onClick={portal('cancelar-pix')} disabled={ocupado !== null}>
              {ocupado === 'cancelar-pix' ? tx('Abrindo…') : tx('Cancelar o cartão')}
            </button>
          </div>
        </section>
      )}

      {r.tipo !== 'liberada' && (
        <p className="ass-rodape">
          <Icone nome="escudo" tamanho={15} />
          <span>{tx('Cartão, faturas e cancelamento ficam na página segura do Stripe: o OpusCash não guarda os dados do seu cartão.')}</span>
          {aoSuporte && <button type="button" className="link" onClick={aoSuporte}>{tx('Falar com o suporte')}</button>}
        </p>
      )}
    </>
  )
}
