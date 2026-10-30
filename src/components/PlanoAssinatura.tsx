import { useEffect, useState, type CSSProperties } from 'react'
import { irParaStripe, type Assinatura } from '../lib/assinatura'
import { precoMensal, situacaoDoPlano, type FasePlano } from '../lib/plano'
import { Icone } from './Icone'

const data = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)
const dataCurta = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')

/** Conta de 0 até o número (o número "sobe" quando a aba abre). Sem animação para quem prefere menos movimento. */
function useContagem(alvo: number) {
  const reduzir = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const [n, setN] = useState(reduzir ? alvo : 0)
  useEffect(() => {
    if (reduzir) return
    let quadro = 0
    const inicio = performance.now()
    const passo = (t: number) => {
      const p = Math.min(1, (t - inicio) / 900)
      setN(Math.round(alvo * (1 - Math.pow(1 - p, 3))))
      if (p < 1) quadro = requestAnimationFrame(passo)
    }
    quadro = requestAnimationFrame(passo)
    return () => cancelAnimationFrame(quadro)
  }, [alvo, reduzir])
  return reduzir ? alvo : n
}

const ICONE_FASE: Record<FasePlano, string> = { teste: 'sol', ativa: 'escudo', cancelando: 'relogio', problema: 'cartao', encerrada: 'relogio', cortesia: 'escudo' }

/**
 * Aba "Plano" das Configurações: em que pé está a assinatura (teste, ativa, cancelada, pagamento pendente, encerrada), quantos
 * dias faltam, quando assinou, quando renova e quando o acesso é cortado, numa linha do tempo animada.
 */
export function PlanoAssinatura({ assinatura, moeda }: { assinatura: Assinatura; moeda: string }) {
  const s = situacaoDoPlano(assinatura)
  const contado = useContagem(s.dias ?? 0)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const abrir = async (funcao: 'stripe-checkout' | 'stripe-portal') => {
    setOcupado(true)
    setErro(null)
    const msg = await irParaStripe(funcao, funcao === 'stripe-checkout' ? moeda : undefined)
    if (msg) { setErro(msg); setOcupado(false) }
  }
  const assinar = (s.fase === 'teste' && assinatura.status === 'teste') || s.fase === 'encerrada'
  const botao = s.fase === 'cortesia' ? null
    : assinar ? { texto: s.fase === 'encerrada' ? 'Assinar de novo' : 'Assinar agora', funcao: 'stripe-checkout' as const, principal: true }
    : s.fase === 'cancelando' ? { texto: 'Reativar assinatura', funcao: 'stripe-portal' as const, principal: true }
    : s.fase === 'problema' ? { texto: 'Atualizar cartão', funcao: 'stripe-portal' as const, principal: true }
    : { texto: 'Gerenciar assinatura', funcao: 'stripe-portal' as const, principal: false }
  const nota = s.fase === 'teste' && assinatura.status === 'teste'
    ? 'Ao assinar, a cobrança começa na hora e os dias que sobrarem do teste não são somados.'
    : botao?.funcao === 'stripe-portal' ? 'Você troca o cartão, vê as faturas ou cancela na página segura do Stripe.' : ''

  return (
    <div className="pa" style={{ '--c': s.cor } as CSSProperties}>
      <section className={`pa-hero fase-${s.fase}`}>
        <div className="pa-topo">
          <span className="pa-chip"><i className="pa-ponto" />{s.rotulo}</span>
          <span className="pa-plano">OpusCash · {precoMensal(assinatura)}</span>
        </div>

        {s.dias !== null ? (
          <div className="pa-numero" aria-label={`${s.dias} ${s.legendaDias}`}>
            <strong>{contado}</strong>
            <span>{s.legendaDias}</span>
          </div>
        ) : (
          <div className="pa-emblema" aria-hidden="true"><Icone nome={ICONE_FASE[s.fase]} tamanho={38} /></div>
        )}

        {s.progresso !== null && s.inicio && s.fim && (
          <div className="pa-progresso">
            <div className="pa-barra" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(s.progresso * 100)}>
              <i style={{ '--p': s.progresso } as CSSProperties} />
              <b style={{ '--p': s.progresso } as CSSProperties} />
            </div>
            <div className="pa-datas"><span>{dataCurta(s.inicio)}</span><span>{dataCurta(s.fim)}</span></div>
          </div>
        )}

        <p className="pa-resumo">{s.resumo}</p>

        {botao && (
          <div className="pa-acao">
            <button type="button" className={`btn pa-botao ${botao.principal ? 'gradiente' : ''}`} onClick={() => void abrir(botao.funcao)} disabled={ocupado}>
              {ocupado ? 'Abrindo o pagamento…' : <>{botao.texto} <Icone nome="seta" tamanho={16} /></>}
            </button>
            {nota && <small>{nota}</small>}
          </div>
        )}
        {erro && <p className="form-erro" role="alert">{erro}</p>}
      </section>

      <section className="cfg-cartao pa-linha-cartao">
        <h4>Linha do tempo <small>O que já aconteceu e o que vem pela frente</small></h4>
        <ol className="pa-linha">
          {s.marcos.map((m, n) => (
            <li key={m.chave} className={m.estado} style={{ '--i': n } as CSSProperties}>
              <span className="pa-marco"><Icone nome={m.icone} tamanho={18} /></span>
              <div>
                <strong>{m.titulo}{m.data && <time dateTime={m.data.toISOString()}>{data(m.data)}</time>}</strong>
                <p>{m.texto}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="pa-fatos">
        <div><span><Icone nome="cartao" tamanho={18} /></span><strong>Plano mensal</strong><small>{maiuscula(precoMensal(assinatura))}, sem fidelidade.</small></div>
        <div><span><Icone nome="escudo" tamanho={18} /></span><strong>Pagamento seguro</strong><small>O cartão fica com o Stripe. O OpusCash não guarda o número.</small></div>
        <div><span><Icone nome="exportar" tamanho={18} /></span><strong>Seus dados são seus</strong><small>Mesmo sem plano, eles continuam guardados.</small></div>
      </section>
    </div>
  )
}
