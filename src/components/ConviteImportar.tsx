import { Icone } from './Icone'
import { tx } from '../lib/textos'

/**
 * Convite em destaque para trazer os dados de uma vez (extrato do banco ou planilha), em vez de lançar um por um. Aparece
 * para quem ainda tem poucos lançamentos e some de vez quando a pessoa toca no X.
 */
export function ConviteImportar({ aoExtrato, aoPlanilha, aoDispensar }: { aoExtrato: () => void; aoPlanilha: () => void; aoDispensar: () => void }) {
  return (
    <section className="convite-importar" data-tour="importar" aria-label={tx('Importar seus dados')}>
      <span className="convite-importar-icone" aria-hidden="true"><Icone nome="relatorio" tamanho={26} /></span>
      <div className="convite-importar-texto">
        <strong>{tx('Você tem algum extrato ou planilha?')}</strong>
        <p>{tx('Traga tudo de uma vez em vez de lançar um por um. Aceita o extrato do seu banco (PDF, OFX, Excel, CSV ou Word) e planilhas do Excel. O app arruma os nomes e mostra tudo antes de gravar.')}</p>
      </div>
      <div className="convite-importar-acoes">
        <button type="button" className="btn primario" onClick={aoExtrato}><Icone nome="relatorio" tamanho={16} /> {tx('Importar extrato')}</button>
        <button type="button" className="btn" onClick={aoPlanilha}><Icone nome="importar" tamanho={16} /> {tx('Importar planilha')}</button>
      </div>
      <button type="button" className="convite-importar-fechar" onClick={aoDispensar} aria-label={tx('Não mostrar de novo')} title={tx('Não mostrar de novo')}><Icone nome="fechar" tamanho={16} /></button>
    </section>
  )
}
