import { useState } from 'react'
import { dispensarArquivo, entregarArquivo, useArquivoPronto } from '../lib/arquivoPronto'
import { tx } from '../lib/textos'
import { Icone } from './Icone'
import { Modal } from './ui'

/** O arquivo já está pronto; o segundo toque (aqui) abre o compartilhar do iPhone. Veja lib/arquivoPronto.ts. */
export function ArquivoPronto() {
  const arquivo = useArquivoPronto()
  const [erro, setErro] = useState<string | null>(null)
  if (!arquivo) return null
  const salvar = async () => {
    setErro(null)
    try {
      await entregarArquivo(arquivo)
      dispensarArquivo()
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e))
    }
  }
  return (
    <Modal titulo={tx('Backup pronto')} aoFechar={dispensarArquivo}>
      <div className="form">
        <p className="zerar-texto">{tx('Seu backup está pronto. Toque no botão e escolha Salvar em Arquivos (ou mande para você mesmo por e-mail ou WhatsApp).')}</p>
        {erro && <p className="form-erro">{erro}</p>}
        <div className="form-acoes">
          <span className="espaco" />
          <button type="button" className="btn" onClick={dispensarArquivo}>{tx('Agora não')}</button>
          <button type="button" className="btn primario" onClick={salvar}><Icone nome="exportar" tamanho={16} /> {tx('Salvar backup')}</button>
        </div>
      </div>
    </Modal>
  )
}
