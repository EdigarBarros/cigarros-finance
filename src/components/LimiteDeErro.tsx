import { Component, type ErrorInfo, type ReactNode } from 'react'
import { registrarErro } from '../lib/erros'
import { Marca } from './Marca'
import { EMAIL_SUPORTE } from '../lib/legal'

/** Se uma tela quebrar, mostra um aviso com saída em vez de deixar a página em branco, e registra o erro. */
export class LimiteDeErro extends Component<{ children: ReactNode }, { quebrou: boolean }> {
  state = { quebrou: false }
  static getDerivedStateFromError() { return { quebrou: true } }
  componentDidCatch(erro: Error, info: ErrorInfo) {
    registrarErro(erro, `tela ${location.hash || '/'} ${info.componentStack?.split('\n')[1]?.trim() ?? ''}`)
  }
  render() {
    if (!this.state.quebrou) return this.props.children
    return (
      <div className="tela-central">
        <div className="cartao login">
          <div className="login-marca"><Marca grande /></div>
          <h1>Algo deu errado</h1>
          <p>Já registramos o problema. Seus dados estão guardados. Recarregue a página para continuar.</p>
          <button className="btn gradiente" onClick={() => location.reload()}>Recarregar</button>
          {EMAIL_SUPORTE && <small>Se continuar, escreva para <a href={`mailto:${EMAIL_SUPORTE}`}>{EMAIL_SUPORTE}</a>.</small>}
        </div>
      </div>
    )
  }
}
