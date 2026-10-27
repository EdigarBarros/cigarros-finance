import { fmtDataCurta, fmtMoeda, fmtValor } from '../lib/format'
import { SEM_CATEGORIA } from '../lib/categorias'
import type { Banco, Categoria, Lancamento } from '../lib/types'
import { Selo } from './Categorias'

export function ItemLancamento({ l, banco, categoria, aoClicar, mostrarData = true }: {
  l: Lancamento; banco?: Banco; categoria?: Categoria; aoClicar: () => void; mostrarData?: boolean
}) {
  const entrada = l.tipo === 'entrada'
  const c = categoria ?? SEM_CATEGORIA
  return (
    <li>
      <button className="item-lanc" onClick={aoClicar}>
        <Selo c={c} tamanho={38} />
        <span className="item-texto">
          <span className="item-desc">{l.descricao || (entrada ? 'Entrada' : 'Saída')}</span>
          <span className="item-meta">
            {mostrarData && l.data && <>{fmtDataCurta(l.data)} · </>}
            {banco && <><i className="marcador" style={{ background: banco.cor }} />{banco.nome} · </>}
            {c.nome}
            {l.divida_id && ' · abate dívida'}
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
