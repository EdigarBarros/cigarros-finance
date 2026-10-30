import { useState } from 'react'
import type { SugestaoVinculo } from '../lib/contasFixas'
import { fmtDataCurta, fmtValor } from '../lib/format'
import type { ContaFixa, Lancamento } from '../lib/types'
import { Icone } from './Icone'
import { Modal } from './ui'

/**
 * Depois de ligar um lançamento a uma conta do mês: "Achei mais estes parecidos. Também são da Pensão?". Os que o app tem
 * certeza vêm marcados; os duvidosos, desmarcados. O que ficar desmarcado o app não sugere de novo para essa conta.
 */
export function ParecidosConta({ conta, modelo, itens, aoLigar, aoRecusar, aoFechar }: {
  conta: ContaFixa
  modelo: Lancamento
  itens: SugestaoVinculo[]
  aoLigar: (ids: string[]) => void
  aoRecusar: (ids: string[]) => void
  aoFechar: () => void
}) {
  const [marcados, setMarcados] = useState(() => new Set(itens.filter((x) => x.forca === 'certo').map((x) => x.lanc.id)))
  const entrada = conta.tipo === 'entrada'
  const alternar = (id: string) => setMarcados((s) => {
    const n = new Set(s)
    if (n.has(id)) n.delete(id)
    else n.add(id)
    return n
  })
  const confirmar = () => {
    aoLigar([...marcados])
    aoRecusar(itens.map((x) => x.lanc.id).filter((id) => !marcados.has(id)))
    aoFechar()
  }

  return (
    <Modal titulo={`Mais lançamentos de ${conta.descricao}?`} aoFechar={aoFechar}>
      <div className="form vinculo-parecidos">
        <p className="vinculo-intro">
          Você ligou <b>{modelo.descricao}</b> a <b>{conta.descricao}</b>. Achei {itens.length === 1 ? 'outro lançamento parecido' : `mais ${itens.length} lançamentos parecidos`} em
          outros meses. {itens.length === 1 ? 'Ele também é' : 'Eles também são'} {entrada ? 'o recebimento' : 'o pagamento'} dessa conta?
        </p>
        <ul className="vinculo-lista">
          {itens.map(({ lanc, forca }) => (
            <li key={lanc.id}>
              <label className={marcados.has(lanc.id) ? '' : 'desmarcado'}>
                <input type="checkbox" checked={marcados.has(lanc.id)} onChange={() => alternar(lanc.id)} />
                <span className="vinculo-data">{fmtDataCurta(lanc.data)}<small>{lanc.ano}</small></span>
                <span className="vinculo-nome"><strong>{lanc.descricao}</strong>{forca === 'talvez' && <small>parecido, confira</small>}</span>
                <span className={`vinculo-valor ${lanc.tipo}`}>{entrada ? '+' : '−'} {fmtValor(lanc.valor)}</span>
              </label>
            </li>
          ))}
        </ul>
        <span className="campo-ajuda">Ligados, eles contam como {entrada ? 'recebidos' : 'pagos'} em Contas do mês e não precisam de “{entrada ? 'Recebi' : 'Paguei'}”.</span>
        <div className="form-acoes">
          <span className="espaco" />
          <button type="button" className="btn" onClick={() => { aoRecusar(itens.map((x) => x.lanc.id)); aoFechar() }}>Nenhum é</button>
          <button type="button" className="btn primario" disabled={!marcados.size} onClick={confirmar}>
            <Icone nome="check" tamanho={16} /> Ligar {marcados.size || ''}
          </button>
        </div>
      </div>
    </Modal>
  )
}
