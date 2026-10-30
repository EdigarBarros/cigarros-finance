import { Component, type ErrorInfo, type ReactNode } from 'react'
import { ehErroDeVersao, versaoNovaNecessaria } from '../lib/atualizacao'
import { registrarErro } from '../lib/erros'
import { Marca } from './Marca'
import { EMAIL_SUPORTE } from '../lib/legal'
import { tx } from '../lib/textos'

/** Se uma tela quebrar, mostra um aviso com saída em vez de deixar a página em branco, e registra o erro. */
export class LimiteDeErro extends Component<{ children: ReactNode }, { quebrou: boolean; versao: boolean }> {
  state = { quebrou: false, versao: false }
  static getDerivedStateFromError(erro: unknown) { return { quebrou: true, versao: ehErroDeVersao(erro) } }
  componentDidCatch(erro: Error, info: ErrorInfo) {
    // saiu versão nova e esta aba ainda era da antiga: não é defeito, é só atualizar
    if (ehErroDeVersao(erro)) { versaoNovaNecessaria(); return }
    registrarErro(erro, `tela ${location.hash || '/'} ${info.componentStack?.split('\n')[1]?.trim() ?? ''}`)
  }
  render() {
    if (!this.state.quebrou) return this.props.children
    if (this.state.versao) return <div className="tela-central">{tx('Atualizando o OpusCash…')}</div>
    return (
      <div className="tela-central">
        <div className="cartao login">
          <div className="login-marca"><Marca grande /></div>
          <h1>{tx('Algo deu errado')}</h1>
          <p>{tx('Já registramos o problema. Seus dados estão guardados. Recarregue a página para continuar.')}</p>
          <button className="btn gradiente" onClick={() => location.reload()}>{tx('Recarregar')}</button>
          {EMAIL_SUPORTE && <small>{tx('Se continuar, escreva para')} <a href={`mailto:${EMAIL_SUPORTE}`}>{EMAIL_SUPORTE}</a>.</small>}
        </div>
      </div>
    )
  }
}
