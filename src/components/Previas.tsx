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

/** Miniatura de cada jeito de ver: mais blocos e gráficos conforme o nível. */
export function PreviaDetalhe({ nivel }: { nivel: 'simples' | 'equilibrado' | 'detalhado' }) {
  return (
    <span className={`previa-detalhe ${nivel}`} aria-hidden="true">
      <span className="pd-kpis"><i /><i /><i />{nivel === 'detalhado' && <><i /><i /></>}</span>
      {nivel !== 'simples' && <span className="pd-grafico"><i /><i /><i /><i /><i /><i /></span>}
      <span className="pd-lista"><i /><i />{nivel === 'detalhado' && <><i /><i /></>}</span>
    </span>
  )
}
