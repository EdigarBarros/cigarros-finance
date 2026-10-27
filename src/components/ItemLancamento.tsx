import { COR } from '../lib/charts'
import { fmtBRL, fmtDataCurta } from '../lib/format'
import { CATEGORIAS, NOME_CATEGORIA, NOME_CONTA } from '../lib/rotulos'
import type { Lancamento } from '../lib/types'
import { Icone } from './Icone'

const corCategoria = Object.fromEntries(CATEGORIAS.map((c) => [c.id, c.cor]))

export function ItemLancamento({ l, aoClicar, mostrarData = true }: { l: Lancamento; aoClicar: () => void; mostrarData?: boolean }) {
  const entrada = l.tipo === 'entrada'
  return (
    <li>
      <button className="item-lanc" onClick={aoClicar}>
        <span className="item-icone" style={{ color: entrada ? COR.entradas : COR.saidas }}>
          <Icone nome={entrada ? 'sobe' : 'desce'} tamanho={16} />
        </span>
        <span className="item-texto">
          <span className="item-desc">{l.descricao || (entrada ? 'Entrada' : 'Saída')}</span>
          <span className="item-meta">
            {mostrarData && l.data && <>{fmtDataCurta(l.data)} · </>}
            {entrada ? 'Entrada' : (
              <>
                {NOME_CONTA[l.conta]} · <i className="marcador" style={{ background: corCategoria[l.categoria] }} />{NOME_CATEGORIA[l.categoria]}
                {l.divida_id && ' · abate dívida'}
              </>
            )}
          </span>
        </span>
        <span className={`item-valor ${entrada ? 'mais' : ''}`}>{entrada ? '+' : '−'} {fmtBRL(l.valor)}</span>
      </button>
    </li>
  )
}
