import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { filaDeAvisos, type Pedido } from '../lib/avisos'
import { tx } from '../lib/textos'
import { Icone } from './Icone'

/** A janela dos avisos e confirmações de lib/avisos.ts, no visual do app. */
export function Janelas() {
  const atual = useSyncExternalStore(filaDeAvisos.ouvir, filaDeAvisos.atual)
  if (!atual) return null
  return <Janela key={filaDeAvisos.tamanho() + atual.texto} p={atual} aoResponder={filaDeAvisos.responder} />
}

function Janela({ p, aoResponder }: { p: Pedido; aoResponder: (v: boolean | string | null) => void }) {
  const [texto, setTexto] = useState('')
  const principal = useRef<HTMLButtonElement>(null)
  const campo = useRef<HTMLInputElement>(null)
  const cancelar = () => aoResponder(p.tipo === 'pergunta' ? null : p.tipo === 'confirmacao' ? false : true)
  const ok = () => aoResponder(p.tipo === 'pergunta' ? texto.trim() || null : true)

  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null
    ;(campo.current ?? principal.current)?.focus()
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); cancelar() } }
    window.addEventListener('keydown', esc, true)
    return () => { window.removeEventListener('keydown', esc, true); anterior?.focus?.({ preventScroll: true }) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const icone = p.perigo ? 'lixeira' : p.tipo === 'aviso' ? 'ideia' : p.tipo === 'pergunta' ? 'lapis' : 'check'
  return (
    <div className="modal-fundo aviso-fundo" onMouseDown={(e) => e.target === e.currentTarget && cancelar()}>
      <form className={`modal aviso ${p.perigo ? 'perigo' : ''}`} role="alertdialog" aria-modal="true" aria-label={p.titulo ?? p.texto}
        onSubmit={(e) => { e.preventDefault(); ok() }}>
        <span className="alca" aria-hidden="true" />
        <span className="aviso-icone" aria-hidden="true"><Icone nome={icone} tamanho={22} /></span>
        {p.titulo && <h2>{p.titulo}</h2>}
        <p className="aviso-texto">{p.texto}</p>
        {p.tipo === 'pergunta' && (
          <input ref={campo} className="aviso-campo" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={p.placeholder}
            aria-label={p.titulo ?? p.texto} maxLength={60} autoComplete="off" />
        )}
        <div className="aviso-acoes">
          {p.tipo !== 'aviso' && <button type="button" className="btn" onClick={cancelar}>{p.cancelar ?? tx('Cancelar')}</button>}
          <button ref={principal} type="submit" className={`btn ${p.perigo ? 'perigo-forte' : 'primario'}`}
            disabled={p.tipo === 'pergunta' && !texto.trim()}>
            {p.botao ?? (p.tipo === 'aviso' ? tx('Entendi') : p.tipo === 'pergunta' ? tx('Salvar') : tx('Confirmar'))}
          </button>
        </div>
      </form>
    </div>
  )
}
