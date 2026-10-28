import { fmtDataCurta, fmtMoeda, fmtValor } from '../lib/format'
import { SEM_CATEGORIA } from '../lib/categorias'
import { infoForma } from '../lib/formas'
import type { Banco, Categoria, Lancamento } from '../lib/types'
import { BancoIcone } from './BancoIcone'
import { Selo } from './Categorias'
import { Icone } from './Icone'

/**
 * Um lançamento na lista: selo da categoria, descrição, categoria e banco, e etiquetas do que ele é além de um gasto
 * comum (parcela no cartão, pagamento de dívida, recebimento de quem te devia, conta do mês, outra moeda).
 */
export function ItemLancamento({ l, banco, categoria, cartao, aoClicar, mostrarData = true, indice }: {
  l: Lancamento; banco?: Banco; categoria?: Categoria
  /** Cartão de crédito da compra, para a etiqueta com o selo do banco. */
  cartao?: { nome: string; cor: string }
  aoClicar: () => void; mostrarData?: boolean
  /** Posição na lista, para a entrada em cascata. */
  indice?: number
}) {
  const entrada = l.tipo === 'entrada'
  const c = categoria ?? SEM_CATEGORIA
  const parcelado = Boolean(l.compra_id && (l.parcelas ?? 1) > 1)
  const etiquetas = [
    l.cartao_id && (
      <span key="cc" className="item-tag no-cartao">
        {cartao ? <BancoIcone nome={cartao.nome} cor={cartao.cor} tamanho={13} /> : <Icone nome="cartao" tamanho={12} />}
        {parcelado ? `${l.parcela}/${l.parcelas}` : 'cartão'}
      </span>
    ),
    !l.cartao_id && l.forma && (
      <span key="fp" className="item-tag forma" style={{ '--c': infoForma(l.forma).cor } as React.CSSProperties}>
        <Icone nome={infoForma(l.forma).icone} tamanho={12} />{infoForma(l.forma).nome}
      </span>
    ),
    l.divida_id && <span key="dv" className={`item-tag ${entrada ? 'receber' : 'divida'}`}><Icone nome={entrada ? 'receber' : 'divida'} tamanho={12} />{entrada ? 'recebido' : 'dívida'}</span>,
    l.conta_fixa_id && <span key="cf" className="item-tag conta"><Icone nome="calendario" tamanho={12} />todo mês</span>,
  ].filter(Boolean)
  return (
    <li style={indice !== undefined ? { animationDelay: `${Math.min(indice, 12) * 30}ms` } : undefined}>
      <button className="item-lanc" onClick={aoClicar}>
        <Selo c={c} tamanho={38} />
        <span className="item-texto">
          <span className="item-desc">{l.descricao || (entrada ? 'Entrada' : 'Saída')}</span>
          <span className="item-meta">
            {mostrarData && l.data && <>{fmtDataCurta(l.data)} · </>}
            {banco && <span className="item-banco"><i className="marcador" style={{ background: banco.cor }} />{banco.nome} · </span>}
            {c.nome}
            {etiquetas.length > 0 && <span className="item-tags">{etiquetas}</span>}
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
