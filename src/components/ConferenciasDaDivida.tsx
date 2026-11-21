import { useState } from 'react'
import { fmtDiv, type SituacaoDivida } from '../lib/dividas'
import { historicoDaDivida, type MudancaConferida } from '../lib/conferencias'
import { fmtDataLonga, fmtTaxa } from '../lib/format'
import type { Dados } from '../lib/useDados'
import { Icone } from './Icone'
import { tx } from '../lib/textos'

const pctTexto = (p: number) => `${fmtTaxa(Math.abs(p))}%`

/**
 * O histórico de "Conferi com o banco": em cada dia, quanto o app mostrava e quanto o banco mostrou, e se a dívida caiu ou
 * subiu. Fica guardado para a pessoa (e o consultor) saberem que o valor mudou e quando.
 */
export function ConferenciasDaDivida({ s, d }: { s: SituacaoDivida; d: Pick<Dados, 'conferencias' | 'conferenciasSemTabela' | 'delConferencia'> }) {
  const [apagando, setApagando] = useState<string | null>(null)
  if (d.conferenciasSemTabela) {
    return (
      <p className="cc-aviso-migracao">
        <Icone nome="ideia" tamanho={16} />
        <span>{tx('Para guardar o histórico das conferências com o banco, rode')} <code>supabase/migracao-37-conferencias-da-divida.sql</code> {tx('no SQL Editor do Supabase.')}</span>
      </p>
    )
  }
  const lista = historicoDaDivida(d.conferencias, s.divida.id)
  if (!lista.length) return null
  // os valores do histórico estão na moeda principal; `fmtDiv` os põe na moeda da dívida
  const dinheiro = (v: number) => fmtDiv(s, v)
  return (
    <section className="dv-conferencias">
      <h4 className="dv-ficha-titulo">{tx('Conferências com o banco')} <small>{lista.length}</small></h4>
      <ol className="dv-conferencias-lista">
        {lista.map((m, i) => <Item key={m.conferencia.id} m={m} indice={i} dinheiro={dinheiro}
          apagando={apagando === m.conferencia.id} aoPedirApagar={() => setApagando(m.conferencia.id)} aoManter={() => setApagando(null)}
          aoApagar={() => { setApagando(null); void d.delConferencia(m.conferencia.id) }} />)}
      </ol>
    </section>
  )
}

function Item({ m, indice, dinheiro, apagando, aoPedirApagar, aoManter, aoApagar }: {
  m: MudancaConferida; indice: number; dinheiro: (v: number) => string
  apagando: boolean; aoPedirApagar: () => void; aoManter: () => void; aoApagar: () => void
}) {
  const { conferencia: c } = m
  const frase = m.sentido === 'igual'
    ? tx('O banco confirmou {0}.', dinheiro(c.depois))
    : tx('Estava {0}; o banco mostrou {1}.', dinheiro(c.antes), dinheiro(c.depois))
  return (
    <li className={`dv-conferencia ${m.sentido}`} style={{ animationDelay: `${Math.min(indice, 10) * 40}ms` }}>
      <span className="dv-conferencia-marco" aria-hidden="true"><Icone nome={m.sentido === 'caiu' ? 'desce' : m.sentido === 'subiu' ? 'sobe' : 'check'} tamanho={14} /></span>
      <span className="dv-conferencia-corpo">
        <span className="dv-conferencia-topo">
          <strong>{fmtDataLonga(c.data)}</strong>
          {m.sentido !== 'igual' && (
            <span className="dv-conferencia-delta">
              {m.sentido === 'caiu' ? tx('caiu {0}', dinheiro(Math.abs(m.diferenca))) : tx('subiu {0}', dinheiro(m.diferenca))}
              {m.percentual !== 0 && ` (${m.sentido === 'caiu' ? '−' : '+'}${pctTexto(m.percentual)})`}
            </span>
          )}
        </span>
        <small>{frase}</small>
      </span>
      {apagando ? (
        <span className="dv-promessa-apagar">
          <button className="btn" onClick={aoManter}>{tx('Manter')}</button>
          <button className="btn perigo" onClick={aoApagar}>{tx('Excluir')}</button>
        </span>
      ) : (
        <button className="icone-btn" onClick={aoPedirApagar} aria-label={tx('Excluir conferência')} title={tx('Excluir conferência')}><Icone nome="lixeira" tamanho={14} /></button>
      )}
    </li>
  )
}
