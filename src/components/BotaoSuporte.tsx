import { EMAIL_SUPORTE } from '../lib/legal'
import { tx } from '../lib/textos'
import { Icone } from './Icone'

/**
 * Botão de suporte flutuante, preso no canto de baixo, em todas as telas: quem travou em algum lugar (um pagamento que não
 * liberou, um login que não entra) acha ajuda sem procurar.
 * - Com conta aberta (`aoAbrir`): abre a janela de suporte do app, com os pedidos e a conversa.
 * - Sem conta (login, apresentação, termos): não há como abrir um pedido, então vira um e-mail para o suporte.
 *   Sem e-mail configurado na hospedagem (VITE_EMAIL_SUPORTE), não aparece.
 * `avisos`: respostas do suporte ainda não vistas (mostra a bolinha com o número).
 */
export function BotaoSuporte({ aoAbrir, avisos = 0, className = '' }: { aoAbrir?: () => void; avisos?: number; className?: string }) {
  const rotulo = avisos > 0
    ? (avisos === 1 ? tx('Suporte: 1 resposta nova') : tx('Suporte: {0} respostas novas', avisos))
    : tx('Suporte: peça ajuda')
  const miolo = (
    <>
      <Icone nome="conversa" tamanho={19} />
      <span>{tx('Suporte')}</span>
      {avisos > 0 && <b className="suporte-flutuante-aviso">{avisos}</b>}
    </>
  )
  if (aoAbrir) {
    return <button type="button" className={`suporte-flutuante ${className}`} onClick={aoAbrir} aria-label={rotulo} title={rotulo}>{miolo}</button>
  }
  if (!EMAIL_SUPORTE) return null
  return (
    <a className={`suporte-flutuante ${className}`} href={`mailto:${EMAIL_SUPORTE}?subject=${encodeURIComponent(tx('Ajuda com o OpusCash'))}`}
      aria-label={rotulo} title={EMAIL_SUPORTE}>
      {miolo}
    </a>
  )
}
