import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createRoot } from 'react-dom/client'
import { tx } from '../lib/textos'
import { Icone } from './Icone'

/*
 * Avisos, confirmações e perguntas do app, no lugar do alert(), confirm() e prompt() do navegador (que abriam a caixa
 * cinza do sistema). Usam a mesma janela do app: no computador no meio da tela, no celular sobem como folha.
 *
 *   if (!(await confirmar('Excluir este lançamento?', { botao: 'Excluir', perigo: true }))) return
 *   await avisar('Não encontrei abas de mês…')
 *   const nome = await perguntar('Nome do banco:')
 */

interface Pedido {
  tipo: 'aviso' | 'confirmacao' | 'pergunta'
  texto: string
  titulo?: string
  botao?: string
  perigo?: boolean
  placeholder?: string
  cancelar?: string
  responder: (v: boolean | string | null) => void
}

let fila: Pedido[] = []
const ouvintes = new Set<() => void>()
const avisar_ = () => ouvintes.forEach((f) => f())
let montado = false

function pedir(p: Omit<Pedido, 'responder'>) {
  if (!montado) {
    montado = true
    const div = document.createElement('div')
    document.body.appendChild(div)
    createRoot(div).render(<Janelas />)
  }
  return new Promise<boolean | string | null>((responder) => {
    fila = [...fila, { ...p, responder }]
    avisar_()
  })
}

export interface OpcoesConfirmar { titulo?: string; botao?: string; perigo?: boolean; /** Texto do outro botão (padrão: Cancelar). */ cancelar?: string }

/** Pergunta sim ou não. `perigo`: o botão de confirmar sai vermelho (excluir, apagar, substituir). */
export const confirmar = (texto: string, o: OpcoesConfirmar = {}) => pedir({ tipo: 'confirmacao', texto, ...o }) as Promise<boolean>
/** Só um recado, com um botão de OK. */
export const avisar = (texto: string, titulo?: string) => pedir({ tipo: 'aviso', texto, titulo }).then(() => undefined)
/** Pede um texto curto. Devolve null se a pessoa cancelar. */
export const perguntar = (texto: string, o: { titulo?: string; placeholder?: string; botao?: string } = {}) =>
  pedir({ tipo: 'pergunta', texto, ...o }) as Promise<string | null>

function Janelas() {
  const atual = useSyncExternalStore((f) => { ouvintes.add(f); return () => ouvintes.delete(f) }, () => fila[0])
  if (!atual) return null
  const fechar = (v: boolean | string | null) => {
    fila = fila.slice(1)
    avisar_()
    atual.responder(v)
  }
  return <Janela key={fila.length + atual.texto} p={atual} aoResponder={fechar} />
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
