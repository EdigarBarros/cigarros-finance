import { Chart } from 'react-chartjs-2'
import type { Resumo } from '../lib/calc'
import { COR } from '../lib/charts'
import { fmtBRL, fmtUSD, MESES } from '../lib/format'

interface Props {
  ano: number
  mesAtual: number
  /** null = mês sem nenhum dado (fica em branco, como a planilha). */
  porMes: (Resumo | null)[]
  onMes: (m: number) => void
}

const LINHAS: { chave: keyof Resumo; nome: string; cor: string; usd?: boolean }[] = [
  { chave: 'entradas', nome: 'ENTRADAS', cor: COR.entradas },
  { chave: 'saidas', nome: 'SAÍDAS', cor: COR.saidas },
  { chave: 'fluxo', nome: 'FLUXO DE CAIXA', cor: COR.fluxo },
  { chave: 'caixa', nome: 'CAIXA', cor: COR.caixa },
  { chave: 'divida', nome: 'DÍVIDA', cor: COR.divida },
  { chave: 'investimentos', nome: 'INVESTIMENTOS', cor: COR.investimentos },
  { chave: 'usd', nome: 'US$', cor: COR.usd, usd: true },
]

export function Anual({ ano, mesAtual, porMes, onMes }: Props) {
  const serie = (k: keyof Resumo) => porMes.map((r) => (r ? (r[k] as number) : null))
  const linha = (k: keyof Resumo, label: string, cor: string) => ({
    type: 'line' as const, label, data: serie(k), borderColor: cor, backgroundColor: cor,
    borderWidth: 2, pointRadius: 2, spanGaps: true,
  })

  return (
    <section className="anual">
      <div className="grafico-anual">
        <Chart
          type="bar"
          data={{
            labels: MESES.map((m) => m.slice(0, 3)),
            datasets: [
              { type: 'bar', label: 'ENTRADAS', data: serie('entradas'), backgroundColor: COR.entradas },
              { type: 'bar', label: 'SAÍDAS', data: serie('saidas'), backgroundColor: COR.saidas },
              linha('caixa', 'CAIXA', COR.caixa),
              linha('divida', 'DÍVIDA', COR.divida),
              linha('investimentos', 'INVESTIMENTOS', COR.investimentos),
              linha('usd', 'US$', COR.usd),
            ],
          }}
          options={{
            maintainAspectRatio: false,
            plugins: {
              legend: { position: 'bottom', labels: { boxWidth: 14, font: { size: 10 } } },
              tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${fmtBRL(c.parsed.y ?? 0)}` } },
            },
            scales: {
              x: { grid: { display: false } },
              y: { ticks: { callback: (v) => fmtBRL(Number(v)) } },
            },
          }}
        />
      </div>
      <div className="tabela-rolagem">
        <table className="tabela-anual">
          <thead>
            <tr>
              <th>{ano}</th>
              {MESES.map((m, i) => (
                <th key={m} className={i + 1 === mesAtual ? 'atual' : ''}>
                  <button onClick={() => onMes(i + 1)}>{m}</button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {LINHAS.map((l) => (
              <tr key={l.chave} style={{ color: l.cor }}>
                <th>{l.nome}</th>
                {porMes.map((r, i) => (
                  <td key={i} className={i + 1 === mesAtual ? 'atual' : ''}>
                    {r ? (l.usd ? fmtUSD(r.usd) : fmtBRL(r[l.chave] as number)) : ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
