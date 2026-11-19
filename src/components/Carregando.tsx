import { useSegurarAbertura } from '../lib/abertura'
import { tx } from '../lib/textos'

/**
 * Tela cheia de carregamento. O desenho com animação é a abertura (components/Abertura.tsx), que fica por cima de tudo e
 * sai só quando todas as telas de carregamento terminam; aqui fica o fundo, na mesma cor (e na da cortina da tela de
 * planos), para nada piscar em branco por baixo.
 * `segurar` falso (quem só visita a página inicial, sem conta neste aparelho): a abertura não entra. Para essa pessoa o
 * carregamento dura um instante (só ler que não há sessão), e a página inicial vem logo.
 */
export function Carregando({ segurar = true }: { segurar?: boolean }) {
  useSegurarAbertura(segurar)
  return <div className="splash" aria-busy="true" aria-label={tx('Carregando')} />
}
