import { Doughnut } from 'react-chartjs-2'
import type { Resumo } from '../lib/calc'
import { COR } from '../lib/charts'
import { fmtBRL, fmtPct, fmtUSD, MESES } from '../lib/format'
import { CelulaNumero } from './Celula'

export function Metricas({ r, mes }: { r: Resumo; mes: number }) {
  const itens = [
    { nome: 'TRANSPORTE', v: r.metricas.transporte, cor: COR.transporte },
    { nome: 'DÍVIDAS', v: r.metricas.dividas, cor: COR.dividas },
    { nome: 'ALIMENTAÇÃO', v: r.metricas.alimentacao, cor: COR.alimentacao },
    { nome: 'OUTROS', v: r.metricas.outros, cor: COR.outros },
  ]
  const pct = (v: number) => (r.saidas ? v / r.saidas : 0)

  return (
    <section className="metricas">
      <table>
        <thead>
          <tr>
            <th>MÉTRICAS</th>
            <th className="num">VALOR</th>
            <th className="num">%</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((i) => (
            <tr key={i.nome}>
              <th><span className="bolinha" style={{ background: i.cor }} />{i.nome}</th>
              <td className="num">{fmtBRL(i.v)}</td>
              <td className="num">{fmtPct(pct(i.v))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3>MÉTRICAS - {MESES[mes - 1]}</h3>
      <div className="rosca">
        {r.saidas > 0 ? (
          <Doughnut
            data={{
              labels: itens.map((i) => i.nome),
              datasets: [{ data: itens.map((i) => Math.max(0, i.v)), backgroundColor: itens.map((i) => i.cor), borderColor: '#000' }],
            }}
            options={{
              cutout: '50%',
              maintainAspectRatio: false,
              plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } },
                tooltip: { callbacks: { label: (c) => ` ${fmtBRL(itens[c.dataIndex].v)} (${fmtPct(pct(itens[c.dataIndex].v))})` } },
              },
            }}
          />
        ) : (
          <p className="vazio">Sem saídas neste mês.</p>
        )}
      </div>
      <p className="dica">
        Toque na letra ao lado de cada saída para trocar a categoria: <b className="cat-transporte">T</b> transporte,{' '}
        <b className="cat-divida">D</b> dívida, <b className="cat-alimentacao">A</b> alimentação, <b className="cat-outros">O</b> outros.
      </p>
    </section>
  )
}

export function MetaUsd({ r, onMeta }: { r: Resumo; onMeta: (n: number) => void }) {
  const falta = Math.max(0, r.metaUsd - r.usd)
  return (
    <section className="meta-usd">
      <h2>META DE US$ DOLARES</h2>
      <label className="meta-campo">
        <span>Meta</span>
        <CelulaNumero value={r.metaUsd} format={fmtUSD} onCommit={onMeta} placeholder="defina a meta" ariaLabel="Meta em dólares" />
      </label>
      {r.metaUsd > 0 ? (
        <>
          <div className="rosca pequena">
            <Doughnut
              data={{
                labels: ['Guardado', 'Falta'],
                datasets: [{ data: [r.usd, falta], backgroundColor: [COR.usd, '#333'], borderColor: '#000' }],
              }}
              options={{
                cutout: '60%',
                maintainAspectRatio: false,
                plugins: {
                  legend: { position: 'bottom', labels: { boxWidth: 10 } },
                  tooltip: { callbacks: { label: (c) => ` ${fmtUSD(Number(c.raw))}` } },
                },
              }}
            />
          </div>
          <p className="meta-texto">
            {fmtUSD(r.usd)} de {fmtUSD(r.metaUsd)} · {falta > 0 ? `faltam ${fmtUSD(falta)}` : 'meta batida!'}
          </p>
        </>
      ) : (
        <p className="vazio">Defina uma meta para acompanhar o progresso.</p>
      )}
    </section>
  )
}
