/** Miniatura do app em cada tema, para escolher vendo. */
export function PreviaTema({ tema }: { tema: 'claro' | 'escuro' | 'auto' }) {
  return (
    <span className={`previa-tema ${tema}`} aria-hidden="true">
      <span className="pt-lado" />
      <span className="pt-topo" />
      <span className="pt-cartoes"><i /><i /><i /></span>
      <span className="pt-grafico"><i /><i /><i /><i /><i /></span>
    </span>
  )
}

/** Miniatura de cada jeito de ver: o simples é um cartão grande com a barra do mês e uma lista; os outros, cartões e gráficos. */
export function PreviaDetalhe({ nivel }: { nivel: 'simples' | 'equilibrado' | 'detalhado' }) {
  if (nivel === 'simples') {
    return (
      <span className="previa-detalhe simples" aria-hidden="true">
        <span className="pd-resumo"><b /><em /></span>
        <span className="pd-lista"><i /><i /><i /></span>
      </span>
    )
  }
  return (
    <span className={`previa-detalhe ${nivel}`} aria-hidden="true">
      <span className="pd-kpis"><i /><i /><i />{nivel === 'detalhado' && <><i /><i /></>}</span>
      <span className="pd-grafico"><i /><i /><i /><i /><i /><i /></span>
      <span className="pd-lista"><i /><i />{nivel === 'detalhado' && <><i /><i /></>}</span>
    </span>
  )
}
