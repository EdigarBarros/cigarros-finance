import { useEffect, useState } from 'react'
import { fmtDataCurta, parseNumero } from '../lib/format'

interface Base {
  className?: string
  placeholder?: string
  ariaLabel?: string
}

/** Célula de texto editável: grava ao sair do campo ou com Enter, como numa planilha. */
export function CelulaTexto({ value, onCommit, ...p }: Base & { value: string; onCommit: (v: string) => void }) {
  const [v, setV] = useState(value)
  useEffect(() => setV(value), [value])
  return (
    <input
      className={`celula ${p.className ?? ''}`}
      value={v}
      placeholder={p.placeholder}
      aria-label={p.ariaLabel}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v !== value && onCommit(v)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') setV(value)
      }}
    />
  )
}

/** Célula numérica: mostra formatado, edita no formato brasileiro e aceita "=10+5". */
export function CelulaNumero({
  value, onCommit, format, ...p
}: Base & { value: number; onCommit: (v: number) => void; format: (n: number) => string }) {
  const [editando, setEditando] = useState(false)
  const [v, setV] = useState('')
  const [invalido, setInvalido] = useState(false)
  return (
    <input
      className={`celula num ${invalido ? 'invalido' : ''} ${p.className ?? ''}`}
      inputMode="decimal"
      value={editando ? v : value ? format(value) : ''}
      placeholder={p.placeholder}
      aria-label={p.ariaLabel}
      onFocus={(e) => {
        setEditando(true)
        setV(value ? String(value).replace('.', ',') : '')
        requestAnimationFrame(() => e.target.select())
      }}
      onChange={(e) => {
        setV(e.target.value)
        setInvalido(false)
      }}
      onBlur={() => {
        const n = v.trim() === '' ? 0 : parseNumero(v)
        if (n === null) {
          setInvalido(true)
          setEditando(false)
          return
        }
        setEditando(false)
        if (n !== value) onCommit(n)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') {
          setV(value ? String(value).replace('.', ',') : '')
          e.currentTarget.blur()
        }
      }}
    />
  )
}

/** Mostra a data curta como na planilha ("2-out"); ao tocar vira o seletor de data. */
export function CelulaData({ value, onCommit, ...p }: Base & { value: string | null; onCommit: (v: string | null) => void }) {
  const [editando, setEditando] = useState(false)
  return editando ? (
    <input
      type="date"
      autoFocus
      className={`celula data ${p.className ?? ''}`}
      defaultValue={value ?? ''}
      aria-label={p.ariaLabel}
      onFocus={(e) => {
        try {
          e.currentTarget.showPicker()
        } catch {
          /* navegador sem showPicker: o usuário digita a data */
        }
      }}
      onChange={(e) => {
        // grava assim que uma data completa é escolhida no seletor
        if (e.target.value && e.target.value !== value) onCommit(e.target.value)
      }}
      onBlur={() => setEditando(false)}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === 'Escape') && setEditando(false)}
    />
  ) : (
    <input
      readOnly
      className={`celula data ${p.className ?? ''}`}
      value={fmtDataCurta(value)}
      placeholder="data"
      aria-label={p.ariaLabel}
      onFocus={() => setEditando(true)}
    />
  )
}
