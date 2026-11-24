import { useState } from 'react'
import { fmtDiv, moedaDaDivida, nativoDiv, type Calendario, type SituacaoDivida } from '../lib/dividas'
import { casasDaMoeda, mascarar, paraCampoMoeda } from '../lib/dinheiro'
import { moedaAtual, parseNumero, simbolo } from '../lib/format'
import type { Dados } from '../lib/useDados'
import { Icone } from './Icone'
import { Segmentado } from './ui'
import { pistaDaConferencia } from '../lib/jurosAprendido'
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
 * Os juros estimados viram valor de verdade e voltam a contar a partir de hoje. Cada conferência ensina ao app quanto o banco
 * cobra de verdade (lib/jurosAprendido.ts); por isso pergunta qual número é: o total, ou o valor com desconto para quitar.
 * Enquanto a pessoa digita, mostra na hora quanto a dívida cresceu por dia, comparado com a regra informada.
 */
export function ConferirComBanco({ s, cal, d, aoFechar }: {
  s: SituacaoDivida; cal: Calendario | null; d: Pick<Dados, 'conferirDivida' | 'anotarValorParaQuitar' | 'conferenciasSemPista'>; aoFechar: () => void
}) {
  const moeda = moedaDaDivida(s.original) ?? moedaAtual()
  const [valor, setValor] = useState(() => paraCampoMoeda(nativoDiv(s, s.restanteHoje), moeda))
  const [qual, setQual] = useState<'total' | 'quitar'>('total')
  const [salvando, setSalvando] = useState(false)
  const n = parseNumero(valor)
  const estimado = nativoDiv(s, s.restanteHoje)
  const dif = n !== null ? Math.round((n - estimado) * 100) / 100 : 0
  const bateu = n !== null && Math.abs(dif) < 0.01
  const hoje = hojeIso()
  // o que o número digitado diz sobre os juros: quanto ela cresceu por dia desde que começou a contar
  const pista = pistaDaConferencia(s, cal, hoje)
  const cresceuPorDia = qual === 'total' && n !== null && pista.dias_juros && pista.dias_juros > 0
    ? Math.max(0, (dif * (s.moeda ? s.taxa : 1) + pista.juros_estimado) / pista.dias_juros)
    : null
  const informado = s.atraso?.diario ?? 0
  const fora = cresceuPorDia !== null && Math.abs(cresceuPorDia - informado) >= 0.05 && (informado <= 0 || Math.abs(cresceuPorDia - informado) / informado > 0.15)
  const salvar = async () => {
    if (n === null || n < 0 || salvando) return
    setSalvando(true)
    // o valor digitado está na moeda da dívida; o app guarda a situação na moeda principal
    const principal = s.moeda ? n * s.taxa : n
    if (qual === 'quitar') await d.anotarValorParaQuitar(s, principal, hoje)
    else await d.conferirDivida(s, cal, principal, hoje, 'conferir')
    setSalvando(false)
    aoFechar()
  }
  return (
    <form className="dv-conferir" onSubmit={(e) => { e.preventDefault(); void salvar() }}>
      {!d.conferenciasSemPista && (
        <div className="dv-conferir-qual">
          <span className="campo-rotulo">{tx('Qual número o banco mostra?')}</span>
          <Segmentado rotulo={tx('Qual número o banco mostra?')} valor={qual} aoMudar={setQual}
            opcoes={[{ id: 'total', nome: tx('O total que devo') }, { id: 'quitar', nome: tx('O valor para quitar hoje') }]} />
          <small className="campo-ajuda">{qual === 'total'
            ? tx('Use sempre o mesmo número: assim eu aprendo quanto o banco cobra de juros de verdade.')
            : tx('O valor com desconto para quitar não muda a dívida: eu só anoto quanto o banco abate.')}</small>
        </div>
      )}
      <label className="campo">
        <span className="campo-rotulo">{qual === 'quitar' ? tx('Quanto o banco pede para quitar hoje?') : tx('Quanto o banco mostra hoje?')}</span>
        <span className="campo-caixa"><span className="prefixo">{simbolo(moeda)}</span>
          <input autoFocus inputMode="decimal" value={valor} onFocus={(e) => e.target.select()} onChange={(e) => setValor(mascarar(e.target.value, casasDaMoeda(moeda)))} />
        </span>
        <span className="campo-ajuda">
          {qual === 'quitar'
            ? (dif < -0.005 ? tx('{0} de desconto para quitar hoje.', fmtDiv(s, Math.abs(s.moeda ? dif * s.taxa : dif))) : tx('Digite o valor que o banco pede para quitar a dívida inteira hoje.'))
            : Math.abs(dif) >= 0.01
              ? (dif > 0 ? tx('{0} a mais que a estimativa do app.', fmtDiv(s, Math.abs(s.moeda ? dif * s.taxa : dif))) : tx('{0} a menos que a estimativa do app.', fmtDiv(s, Math.abs(s.moeda ? dif * s.taxa : dif))))
              : tx('O valor digitado vira o valor real da dívida, e os juros do atraso voltam a contar a partir de hoje.')}
        </span>
      </label>
      {cresceuPorDia !== null && fora && (
        <p className={`dv-conferir-leitura ${cresceuPorDia > informado ? 'mais' : 'menos'}`}>
          <Icone nome={cresceuPorDia > informado ? 'sobe' : 'desce'} tamanho={15} />
          <span>{informado > 0
            ? tx('Por esse número, ela cresceu uns {0} por dia nos últimos {1} dias. Pela regra que você informou, seriam {2}.', fmtDiv(s, cresceuPorDia), pista.dias_juros ?? 0, fmtDiv(s, informado))
            : tx('Por esse número, ela cresceu uns {0} por dia nos últimos {1} dias.', fmtDiv(s, cresceuPorDia), pista.dias_juros ?? 0)}
          {' '}{tx('Vou guardar isso para acertar a conta.')}</span>
        </p>
      )}
      <div className="form-acoes">
        <span className="espaco" />
        <button type="button" className="btn" onClick={aoFechar}>{tx('Cancelar')}</button>
        <button type="submit" className="btn primario" disabled={n === null || n < 0 || salvando}>
          <Icone nome="check" tamanho={15} /> {qual === 'quitar' ? tx('Anotar valor para quitar') : bateu ? tx('Bateu com o banco') : tx('Salvar valor do banco')}
        </button>
      </div>
    </form>
  )
}
