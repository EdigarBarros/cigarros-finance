import { useEffect, useState } from 'react'
import { diasDeTeste, emTeste, irParaStripe, type Assinatura } from '../lib/assinatura'
import { Icone } from './Icone'
import { avisar } from '../lib/avisos'
import { tx } from '../lib/textos'

const DURACAO = 15000

const hoje = () => new Date().toLocaleDateString('sv-SE')
const chaveDe = (userId: string) => `opuscash.aviso-teste.${userId}`
const jaViuHoje = (userId: string) => {
  try { return localStorage.getItem(chaveDe(userId)) === hoje() } catch { return false }
}
const marcarVisto = (userId: string) => {
  try { localStorage.setItem(chaveDe(userId), hoje()) } catch { /* sem armazenamento: aparece de novo na próxima vez, sem problema */ }
}

/**
 * Lembrete do teste grátis, em forma de notificação: aparece no canto, some sozinho (ou ao fechar) e só volta no dia seguinte.
 * Não fica fixo no topo da tela. `adiar` segura o aviso enquanto outra coisa ocupa a tela (o passeio guiado, por exemplo).
 */
export function AvisoTeste({ assinatura, userId, moeda, adiar }: { assinatura: Assinatura | null; userId: string; moeda: string; adiar?: boolean }) {
  const [visivel, setVisivel] = useState(false)
  const [saindo, setSaindo] = useState(false)
  const [pausado, setPausado] = useState(false)
  const ativo = emTeste(assinatura)

  useEffect(() => {
    if (!ativo || adiar || jaViuHoje(userId)) return
    const t = window.setTimeout(() => setVisivel(true), 1800)
    return () => window.clearTimeout(t)
  }, [ativo, adiar, userId])

  if (!ativo || !visivel) return null
  const dias = diasDeTeste(assinatura)
  const fechar = () => {
    if (saindo) return
    marcarVisto(userId)
    setSaindo(true)
    window.setTimeout(() => setVisivel(false), 350)
  }

  return (
    <aside className={`aviso-teste ${saindo ? 'saindo' : ''} ${pausado ? 'pausado' : ''}`} role="status"
      onMouseEnter={() => setPausado(true)} onMouseLeave={() => setPausado(false)}>
      <span className="aviso-teste-icone"><Icone nome="relogio" tamanho={20} /></span>
      <div className="aviso-teste-texto">
        <strong>{tx('Teste grátis:')} {dias === 1 ? tx('falta 1 dia') : tx('faltam {0} dias', dias)}</strong>
        <p>{tx('Quando acabar, é só assinar por R$ 9,99 por mês para continuar de onde parou.')}</p>
        <button type="button" className="aviso-teste-assinar"
          onClick={() => void irParaStripe('stripe-checkout', moeda).then((m) => m && avisar(m))}>
          {tx('Assinar agora')} <Icone nome="seta" tamanho={14} />
        </button>
      </div>
      <button type="button" className="aviso-teste-fechar" onClick={fechar} aria-label={tx('Fechar aviso')}><Icone nome="fechar" tamanho={16} /></button>
      <i className="aviso-teste-barra" style={{ animationDuration: `${DURACAO}ms` }} onAnimationEnd={fechar} aria-hidden="true" />
    </aside>
  )
}
