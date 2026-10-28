/** Contato de suporte, mostrado nos termos, na privacidade e na tela de assinatura. Defina VITE_EMAIL_SUPORTE na hospedagem. */
export const EMAIL_SUPORTE = (import.meta.env.VITE_EMAIL_SUPORTE as string | undefined)?.trim() ?? ''
/** Quem responde pelo serviço (nome ou razão social). Defina VITE_RESPONSAVEL na hospedagem. */
export const RESPONSAVEL = (import.meta.env.VITE_RESPONSAVEL as string | undefined)?.trim() || 'o responsável pelo OpusCash'

export type Documento = 'termos' | 'privacidade'
/** Os documentos ficam em endereços públicos (#/termos e #/privacidade), abertos mesmo sem login. */
export const documentoDoHash = (): Documento | null => {
  const h = window.location.hash.replace('#/', '')
  return h === 'termos' || h === 'privacidade' ? h : null
}
