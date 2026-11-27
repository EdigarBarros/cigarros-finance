import type { Decisao } from '../lib/decisoes/decisao'
import { tx } from '../lib/textos'

/** O que sustenta um passo do plano: se é recomendação, pergunta, condição ou falta de dado, as premissas e as alternativas. */
export function DecisaoExplicada({ d }: { d: Decisao | undefined }) {
  if (!d) return null
  const selo = d.estado === 'pergunta' ? tx('A escolha é sua')
    : d.estado === 'condicional' ? tx('Depende de acontecer')
      : d.estado === 'faltam-dados' ? tx('Pode mudar com um dado que falta')
        : d.regra === 'pessoa' ? tx('Segue a sua prioridade') : tx('Recomendação')
  return (
    <span className="decisao">
      <span className={`decisao-selo decisao-${d.estado}`}>{selo}</span>
      {d.premissas.length > 0 && (
        <span className="decisao-bloco">
          <b>{tx('Com base em')}</b>
          {d.premissas.map((p) => <span key={p}>{p}</span>)}
        </span>
      )}
      {d.alternativas.length > 0 && (
        <span className="decisao-bloco">
          <b>{tx('Também pensei em')}</b>
          {d.alternativas.map((p) => <span key={p}>{p}</span>)}
        </span>
      )}
    </span>
  )
}
