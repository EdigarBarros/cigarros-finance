import { useState } from 'react'
import { fmtDiv, moedaDaDivida, nativoDiv, type Calendario, type SituacaoDivida } from '../lib/dividas'
import { casasDaMoeda, mascarar, paraCampoMoeda } from '../lib/dinheiro'
import { moedaAtual, parseNumero, simbolo } from '../lib/format'
import type { Dados } from '../lib/useDados'
import { Icone } from './Icone'
import { tx } from '../lib/textos'

/** Hoje (AAAA-MM-DD) no fuso do aparelho. */
const hojeIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

/** Selo "com juros, estimado" e, embaixo, "cresce ~R$ 1,70 por dia". */
export function SeloJuros({ s }: { s: SituacaoDivida }) {
  if (!s.atraso || s.jurosAtraso <= 0) return null
  return (
    <>
      <span className="chip-estado dv juros" title={tx('Estimativa pela regra de juros do atraso. Confira com o banco para acertar.')}>{tx('com juros, estimado')}</span>
      {s.atraso.diario > 0 && <small className="dv-cresce">{tx('cresce ~{0} por dia', fmtDiv(s, s.atraso.diario))}</small>}
    </>
  )
}

/**
 * "Conferi com o banco": a pessoa digita quanto o banco mostra hoje (já vem o estimado) e o app grava como o valor real.
 * Os juros estimados viram valor de verdade e voltam a contar a partir de hoje.
 */
export function ConferirComBanco({ s, cal, d, aoFechar }: {
  s: SituacaoDivida; cal: Calendario | null; d: Pick<Dados, 'conferirDivida'>; aoFechar: () => void
}) {
  const moeda = moedaDaDivida(s.original) ?? moedaAtual()
  const [valor, setValor] = useState(() => paraCampoMoeda(nativoDiv(s, s.restanteHoje), moeda))
  const [salvando, setSalvando] = useState(false)
  const n = parseNumero(valor)
  const estimado = nativoDiv(s, s.restanteHoje)
  const dif = n !== null ? Math.round((n - estimado) * 100) / 100 : 0
  const salvar = async () => {
    if (n === null || n < 0 || salvando) return
    setSalvando(true)
    // o valor digitado está na moeda da dívida; o app guarda a situação na moeda principal
    const principal = s.moeda ? n * s.taxa : n
    await d.conferirDivida(s, cal, principal, hojeIso(), 'conferir')
    setSalvando(false)
    aoFechar()
  }
  return (
    <form className="dv-conferir" onSubmit={(e) => { e.preventDefault(); void salvar() }}>
      <label className="campo">
        <span className="campo-rotulo">{tx('Quanto o banco mostra hoje?')}</span>
        <span className="campo-caixa"><span className="prefixo">{simbolo(moeda)}</span>
          <input autoFocus inputMode="decimal" value={valor} onFocus={(e) => e.target.select()} onChange={(e) => setValor(mascarar(e.target.value, casasDaMoeda(moeda)))} />
        </span>
        <span className="campo-ajuda">
          {Math.abs(dif) >= 0.01
            ? (dif > 0 ? tx('{0} a mais que a estimativa do app.', fmtDiv(s, Math.abs(s.moeda ? dif * s.taxa : dif))) : tx('{0} a menos que a estimativa do app.', fmtDiv(s, Math.abs(s.moeda ? dif * s.taxa : dif))))
            : tx('O valor digitado vira o valor real da dívida, e os juros do atraso voltam a contar a partir de hoje.')}
        </span>
      </label>
      <div className="form-acoes">
        <span className="espaco" />
        <button type="button" className="btn" onClick={aoFechar}>{tx('Cancelar')}</button>
        <button type="submit" className="btn primario" disabled={n === null || n < 0 || salvando}><Icone nome="check" tamanho={15} /> {tx('Salvar valor do banco')}</button>
      </div>
    </form>
  )
}
