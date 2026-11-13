import { useEffect, useRef, type CSSProperties, type PointerEvent } from 'react'
import { Icone } from '../components/Icone'
import { tx } from '../lib/textos'
import { FundoOpus } from './FundoOpus'
import './preco.css'

/**
 * Fim da página inicial: o plano (R$ 9,99 por mês, 7 dias grátis) num cartão de vidro que flutua e inclina com o mouse,
 * as duas formas de pagar (cartão que renova sozinho ou Pix de 30 dias, as mesmas da tela de assinatura) e, ao lado,
 * o que vem junto: dados criptografados, o consultor que analisa as finanças e o resto. Peças do OpusCash vagam no fundo.
 */
const VANTAGENS = [
  { icone: 'escudo', cor: '#22b8f0', titulo: tx('Dados criptografados'), texto: tx('Conexão segura e dados protegidos. Só você enxerga os seus.') },
  { icone: 'bussola', cor: '#1fd1a0', titulo: tx('Consultor inteligente'), texto: tx('Um algoritmo analisa as suas finanças e mostra o que fazer primeiro.') },
  { icone: 'importar', cor: '#8b7cf6', titulo: tx('Traga tudo de uma vez'), texto: tx('Importa o extrato do banco e planilhas em segundos.') },
  { icone: 'cartao', cor: '#f28a1c', titulo: tx('Cartões e parcelas'), texto: tx('Fatura, limite e parcelas de cada cartão, no dia certo.') },
  { icone: 'meta', cor: '#22c55e', titulo: tx('Metas e dívidas'), texto: tx('Veja quando cada meta chega e quando você fica livre das dívidas.') },
  { icone: 'globo', cor: '#ffc000', titulo: tx('Qualquer moeda'), texto: tx('Lance em qualquer moeda, com a cotação do dia.') },
]

/** O losango do Pix (desenho simples, não o logotipo). */
function SimboloPix() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.5 21.5 12 12 21.5 2.5 12Z" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M12 8 16 12 12 16 8 12Z" fill="currentColor" />
    </svg>
  )
}

export function Preco({ onLogin, onSignup }: { onLogin: () => void; onSignup: () => void }) {
  const secao = useRef<HTMLElement>(null)
  const plano = useRef<HTMLDivElement>(null)

  // as entradas só começam quando a seção aparece na tela
  useEffect(() => {
    const el = secao.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { el.classList.add('pr-visto'); obs.disconnect() } }, { threshold: 0.2 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // o cartão do plano inclina acompanhando o mouse
  const mover = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return
    const el = plano.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5
    el.style.setProperty('--ry', `${(x * 12).toFixed(2)}deg`)
    el.style.setProperty('--rx', `${(y * -9).toFixed(2)}deg`)
  }
  const soltar = () => {
    const el = plano.current
    if (!el) return
    for (const v of ['--ry', '--rx']) el.style.removeProperty(v)
  }

  return (
    <section className="pr" ref={secao} aria-labelledby="pr-titulo">
      <div className="pr-luzes" aria-hidden="true"><i /><i /><i /></div>
      <FundoOpus onde="preco" />

      <div className="pr-grade">
        <div className="pr-texto">
          <span className="pr-rotulo">{tx('Teste grátis por 7 dias')}</span>
          <h2 id="pr-titulo" className="pr-titulo">{tx('Pronto para transformar')} <em>{tx('suas finanças?')}</em></h2>
          <p className="pr-sub">{tx('Comece hoje, sem cartão. Em poucos minutos o seu dinheiro está organizado, e o consultor já mostra o que fazer primeiro.')}</p>
          <ul className="pr-vantagens">
            {VANTAGENS.map((v, i) => (
              <li key={v.titulo} style={{ '--c': v.cor, '--i': i } as CSSProperties}>
                <i><Icone nome={v.icone} tamanho={18} /></i>
                <span><b>{v.titulo}</b><small>{v.texto}</small></span>
              </li>
            ))}
          </ul>
        </div>

        <div className="pr-palco">
          <div className="pr-orbita" aria-hidden="true"><i /><i /></div>
          <div className="pr-plano" ref={plano} onPointerMove={mover} onPointerLeave={soltar}>
            <div className="pr-plano-corpo">
              <i className="pr-reflexo" aria-hidden="true" />
              <div className="pr-plano-topo">
                <span className="pr-selo"><Icone nome="estrela" tamanho={13} /> {tx('7 dias grátis')}</span>
                <span className="pr-nome">OpusCash</span>
              </div>
              <div className="pr-valor">
                <small>R$</small><strong>9,99</strong><span>{tx('/mês')}</span>
              </div>
              <p className="pr-nota">{tx('Sem cartão para começar. Só pedimos o cartão se você decidir assinar.')}</p>

              <div className="pr-formas" role="group" aria-label={tx('Formas de pagar')}>
                <div className="pr-forma cartao">
                  <i><Icone nome="cartao" tamanho={17} /></i>
                  <span><b>{tx('Cartão')}</b><small>{tx('Renova sozinho todo mês')}</small></span>
                </div>
                <div className="pr-forma pix">
                  <i><SimboloPix /></i>
                  <span><b>{tx('Pix')}</b><small>{tx('30 dias, sem cartão')}</small></span>
                </div>
              </div>

              <ul className="pr-inclui">
                <li><Icone nome="check" tamanho={14} /> {tx('Todas as telas e recursos')}</li>
                <li><Icone nome="check" tamanho={14} /> {tx('Consultor e Resumo do ano')}</li>
                <li><Icone nome="check" tamanho={14} /> {tx('Cancele quando quiser, sem multa')}</li>
              </ul>

              <button className="ap-btn ap-btn-cta ap-btn-grande pr-botao" onClick={onSignup}>
                {tx('Criar conta grátis')} <Icone nome="seta" tamanho={17} />
              </button>
              <button className="pr-entrar" onClick={onLogin}>{tx('Já tenho conta')}</button>
              <p className="pr-seguro"><Icone nome="escudo" tamanho={13} /> {tx('Pagamento na página segura do Stripe')}</p>
            </div>
          </div>

          <span className="pr-flutua a" aria-hidden="true"><i><Icone nome="escudo" tamanho={14} /></i>{tx('Criptografado')}</span>
          <span className="pr-flutua b" aria-hidden="true"><i><SimboloPix /></i>{tx('Pix ou cartão')}</span>
          <span className="pr-flutua c" aria-hidden="true"><i><Icone nome="bussola" tamanho={14} /></i>{tx('Consultor incluso')}</span>
        </div>
      </div>
    </section>
  )
}
