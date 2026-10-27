import type { Resumo as R } from '../lib/calc'
import { fmtBRL, fmtUSD } from '../lib/format'
import { CelulaNumero } from './Celula'

interface Props {
  r: R
  onInvestimentos: (n: number) => void
  onUsd: (n: number) => void
}

export function Resumo({ r, onInvestimentos, onUsd }: Props) {
  return (
    <section className="resumo">
      <Item rotulo="ENTRADAS" cor="entradas" valor={fmtBRL(r.entradas)} />
      <Item rotulo="SAÍDAS" cor="saidas" valor={fmtBRL(r.saidas)} />
      <Item rotulo="FLUXO DE CAIXA" cor="fluxo" valor={fmtBRL(r.fluxo)} negativo={r.fluxo < 0} />
      <Item rotulo="CAIXA" cor="caixa" valor={fmtBRL(r.caixa)} />
      <Item rotulo="DÍVIDA" cor="divida" valor={fmtBRL(r.divida)} />
      <div className="resumo-item cor-investimentos">
        <span className="rotulo">INVESTIMENTOS</span>
        <CelulaNumero value={r.investimentos} format={fmtBRL} onCommit={onInvestimentos} placeholder="R$ 0,00" ariaLabel="Investimentos" />
      </div>
      <div className="resumo-item cor-usd">
        <span className="rotulo">US$</span>
        <CelulaNumero value={r.usd} format={fmtUSD} onCommit={onUsd} placeholder="$0.00" ariaLabel="Dólares" />
      </div>
    </section>
  )
}

function Item({ rotulo, cor, valor, negativo }: { rotulo: string; cor: string; valor: string; negativo?: boolean }) {
  return (
    <div className={`resumo-item cor-${cor}`}>
      <span className="rotulo">{rotulo}</span>
      <span className={`valor ${negativo ? 'negativo' : ''}`}>{valor}</span>
    </div>
  )
}
