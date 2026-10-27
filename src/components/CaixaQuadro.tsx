import { totalCaixa } from '../lib/calc'
import { fmtBRL } from '../lib/format'
import type { Banco, Caixa, Mes, TipoCaixa } from '../lib/types'
import { BANCOS, TIPOS_CAIXA } from '../lib/types'
import { CelulaNumero } from './Celula'

const NOME_BANCO: Record<Banco, string> = { nubank: 'NUBANK', inter: 'INTER', itau: 'ITAU' }
const NOME_TIPO: Record<TipoCaixa, string> = { cc: 'CONTA CORRENTE', caixinha: 'CAIXINHA', reserva: 'RESERVA EMERGENCIA' }

export function CaixaQuadro({ mes, onChange }: { mes?: Mes; onChange: (c: Caixa) => void }) {
  const caixa = mes?.caixa ?? {}
  const setar = (b: Banco, t: TipoCaixa, v: number) => onChange({ ...caixa, [b]: { ...caixa[b], [t]: v } })

  return (
    <section className="caixa">
      <table>
        <thead>
          <tr>
            <th className="titulo">CAIXA</th>
            {BANCOS.map((b) => (
              <th key={b} className={`banco-${b}`}>{NOME_BANCO[b]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {TIPOS_CAIXA.map((t) => (
            <tr key={t} className={`caixa-${t}`}>
              <th>{NOME_TIPO[t]}</th>
              {BANCOS.map((b) => (
                <td key={b}>
                  <CelulaNumero
                    value={caixa[b]?.[t] ?? 0}
                    format={fmtBRL}
                    placeholder="R$ 0,00"
                    onCommit={(v) => setar(b, t, v)}
                    ariaLabel={`${NOME_TIPO[t]} ${NOME_BANCO[b]}`}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th>TOTAL</th>
            <td colSpan={3}>{fmtBRL(totalCaixa(mes))}</td>
          </tr>
        </tfoot>
      </table>
    </section>
  )
}
