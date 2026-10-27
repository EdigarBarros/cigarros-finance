/** Emblema + nome "Cigarros Finance". */
export function Marca({ compacta }: { compacta?: boolean }) {
  return (
    <div className={`marca ${compacta ? 'compacta' : ''}`}>
      <img className="marca-emblema" src="/emblema.webp" alt="" width={36} height={36} />
      {!compacta && (
        <span className="marca-nome">
          <strong>Cigarros</strong>
          <small>FINANCE</small>
        </span>
      )}
    </div>
  )
}
