import { COR } from '../lib/charts'
import { fmtDataCurta, fmtMoeda, fmtValor } from '../lib/format'
import { CATEGORIAS, NOME_CATEGORIA } from '../lib/rotulos'
import type { Banco, Lancamento } from '../lib/types'
import { Icone } from './Icone'

const corCategoria = Object.fromEntries(CATEGORIAS.map((c) => [c.id, c.cor]))

export function ItemLancamento({ l, banco, aoClicar, mostrarData = true }: { l: Lancamento; banco?: Banco; aoClicar: () => void; mostrarData?: boolean }) {
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
            {banco && <><i className="marcador" style={{ background: banco.cor }} />{banco.nome} · </>}
            {entrada ? 'Entrada' : (
              <>
                <i className="marcador" style={{ background: corCategoria[l.categoria] }} />{NOME_CATEGORIA[l.categoria]}
                {l.divida_id && ' · abate dívida'}
              </>
            )}
          </span>
        </span>
        <span className={`item-valor ${entrada ? 'mais' : ''}`}>
          {entrada ? '+' : '−'} {fmtValor(l.valor)}
          {l.moeda_original && l.valor_original != null && <small>{fmtMoeda(l.valor_original, l.moeda_original)}</small>}
        </span>
      </button>
    </li>
  )
}
