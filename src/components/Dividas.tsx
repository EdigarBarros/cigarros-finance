import { restantes, totalDivida } from '../lib/calc'
import { fmtBRL } from '../lib/format'
import type { Divida } from '../lib/types'
import { CelulaNumero, CelulaTexto } from './Celula'

interface Props {
  ano: number
  mes: number
  itens: Divida[]
  onAdd: (d: Omit<Divida, 'id'>) => void
  onUpd: (id: string, patch: Partial<Divida>) => void
  onDel: (id: string) => void
}

const inteiro = (n: number) => String(n)

export function Dividas({ ano, mes, itens, onAdd, onUpd, onDel }: Props) {
  const mensal = itens.filter((d) => restantes(d) > 0).reduce((a, d) => a + d.valor_mensal, 0)
  const total = itens.reduce((a, d) => a + totalDivida(d), 0)

  return (
    <section className="dividas">
      <div className="tabela-rolagem">
        <table>
          <thead>
            <tr>
              <th>DÍVIDAS</th>
              <th>VALOR MENSAL</th>
              <th>PARCELAS</th>
              <th>PAGAS</th>
              <th>RESTANTES</th>
              <th>TOTAL</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {itens.map((d) => (
              <tr key={d.id}>
                <td><CelulaTexto value={d.descricao} onCommit={(descricao) => onUpd(d.id, { descricao })} ariaLabel="Dívida" /></td>
                <td><CelulaNumero value={d.valor_mensal} format={fmtBRL} onCommit={(valor_mensal) => onUpd(d.id, { valor_mensal })} ariaLabel="Valor mensal" /></td>
                <td><CelulaNumero value={d.parcelas} format={inteiro} onCommit={(n) => onUpd(d.id, { parcelas: Math.round(n) })} ariaLabel="Parcelas" /></td>
                <td>
                  <div className="pagas">
                    <CelulaNumero value={d.pagas} format={inteiro} placeholder="0" onCommit={(n) => onUpd(d.id, { pagas: Math.round(n) })} ariaLabel="Pagas" />
                    {restantes(d) > 0 && (
                      <button title="Marcar mais uma parcela como paga" onClick={() => onUpd(d.id, { pagas: d.pagas + 1 })}>+1</button>
                    )}
                  </div>
                </td>
                <td className="num">{restantes(d)}</td>
                <td className="num">{fmtBRL(totalDivida(d))}</td>
                <td>
                  <button className="apagar" title="Apagar dívida" onClick={() => confirm(`Apagar "${d.descricao}"?`) && onDel(d.id)}>×</button>
                </td>
              </tr>
            ))}
            <tr>
              <td colSpan={7}>
                <button
                  className="link"
                  onClick={() => onAdd({ ano, mes, descricao: 'Nova dívida', valor_mensal: 0, parcelas: 1, pagas: 0, ordem: itens.length })}
                >
                  + adicionar dívida
                </button>
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <th>TOTAL</th>
              <td className="num">{fmtBRL(mensal)}</td>
              <td colSpan={3} />
              <td className="num">{fmtBRL(total)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  )
}
