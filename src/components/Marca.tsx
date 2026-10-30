/** Símbolo do infinito + nome "OPUSCASH" (OPUS na cor do texto, CASH no verde-água da marca). */
export function Marca({ compacta, grande }: { compacta?: boolean; grande?: boolean }) {
  return (
    <div className={`marca ${compacta ? 'compacta' : ''} ${grande ? 'grande' : ''}`} aria-label="OpusCash" translate="no">
      <img className="marca-simbolo" src="/simbolo.webp" alt="" width={46} height={22} />
      <span className="marca-nome" aria-hidden="true">OPUS<b>CASH</b></span>
    </div>
  )
}
