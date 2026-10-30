import { Marca } from './Marca'

/**
 * Tela cheia de carregamento, na mesma cor da cortina da tela de planos: assim, ao criar a conta ou entrar, a marca fica
 * parada na tela e a cortina sobe revelando a tela seguinte, sem piscar uma tela em branco no meio.
 */
export function Carregando() {
  return (
    <div className="splash" role="status" aria-label="Carregando">
      <Marca grande />
      <span className="splash-pontos" aria-hidden="true"><i /><i /><i /></span>
    </div>
  )
}
