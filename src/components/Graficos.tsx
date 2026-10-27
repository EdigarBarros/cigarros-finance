import { Bar, Doughnut } from 'react-chartjs-2'
import type { Resumo } from '../lib/calc'
import { COR } from '../lib/charts'
import { fmtBRL, MESES_CURTO, MESES_NOME } from '../lib/format'

const eixoReais = {
  ticks: { callback: (v: string | number) => compacto(Number(v)), maxTicksLimit: 5 },
  grid: { color: '#1e1e26' },
  border: { display: false },
}
const compacto = (n: number) =>
  Math.abs(n) >= 1000 ? `R$ ${(n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : `R$ ${n}`

/** Entradas × saídas mês a mês. O mês aberto fica em destaque. */
export function GraficoEntradasSaidas({ porMes, mesAtual, aoClicarMes }: {
  porMes: (Resumo | null)[]; mesAtual: number; aoClicarMes?: (m: number) => void
}) {
  return (
    <div className="grafico" style={{ height: 240 }}>
      <Bar
        data={{
          labels: MESES_CURTO,
          datasets: [
            { label: 'Entradas', data: porMes.map((r) => r?.entradas ?? null), backgroundColor: COR.entradas, borderRadius: 4, borderSkipped: 'start', maxBarThickness: 18 },
            { label: 'Saídas', data: porMes.map((r) => r?.saidas ?? null), backgroundColor: COR.saidas, borderRadius: 4, borderSkipped: 'start', maxBarThickness: 18 },
          ],
        }}
        options={{
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          onClick: (_e, els) => els[0] && aoClicarMes?.(els[0].index + 1),
          plugins: {
            legend: { position: 'top', align: 'end', labels: { boxWidth: 10, boxHeight: 10, useBorderRadius: true, borderRadius: 2 } },
            tooltip: {
              callbacks: {
                title: (i) => MESES_NOME[i[0].dataIndex],
                label: (c) => ` ${c.dataset.label}: ${fmtBRL(c.parsed.y ?? 0)}`,
                footer: (i) => {
                  const r = porMes[i[0].dataIndex]
                  return r ? `Saldo: ${fmtBRL(r.fluxo)}` : ''
                },
              },
            },
          },
          scales: {
            // o mês aberto fica destacado no eixo
            x: { grid: { display: false }, border: { display: false },
              ticks: { color: (t) => (t.index + 1 === mesAtual ? '#ededf0' : '#6b6b76'), font: (t) => ({ weight: t.index + 1 === mesAtual ? 700 : 400 }) } },
            y: eixoReais,
          },
        }}
      />
    </div>
  )
}

/** Saldo de cada mês (positivo ou negativo). */
export function GraficoSaldo({ porMes }: { porMes: (Resumo | null)[] }) {
  return (
    <div className="grafico" style={{ height: 200 }}>
      <Bar
        data={{
          labels: MESES_CURTO,
          datasets: [{
            label: 'Saldo',
            data: porMes.map((r) => r?.fluxo ?? null),
            backgroundColor: porMes.map((r) => ((r?.fluxo ?? 0) >= 0 ? COR.entradas : COR.saidas)),
            borderRadius: 4,
            maxBarThickness: 22,
          }],
        }}
        options={{
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { title: (i) => MESES_NOME[i[0].dataIndex], label: (c) => ` Saldo: ${fmtBRL(c.parsed.y ?? 0)}` } },
          },
          scales: { x: { grid: { display: false }, border: { display: false } }, y: eixoReais },
        }}
      />
    </div>
  )
}

export interface Fatia { nome: string; valor: number; cor: string }

/** Rosca com a lista de valores ao lado (a lista é a legenda e a tabela ao mesmo tempo). */
export function Rosca({ fatias, total, centro }: { fatias: Fatia[]; total: number; centro: string }) {
  const visiveis = fatias.filter((f) => f.valor > 0)
  return (
    <div className="rosca-bloco">
      <div className="rosca">
        <Doughnut
          data={{
            labels: visiveis.map((f) => f.nome),
            datasets: [{ data: visiveis.map((f) => f.valor), backgroundColor: visiveis.map((f) => f.cor), borderColor: '#14141a', borderWidth: 2, hoverOffset: 4 }],
          }}
          options={{
            cutout: '68%',
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: { callbacks: { label: (c) => ` ${fmtBRL(Number(c.raw))} · ${pct(Number(c.raw), total)}` } },
            },
          }}
        />
        <div className="rosca-centro">
          <span>{centro}</span>
          <strong>{fmtBRL(total)}</strong>
        </div>
      </div>
      <ul className="legenda">
        {fatias.map((f) => (
          <li key={f.nome}>
            <i className="marcador" style={{ background: f.cor }} />
            <span className="legenda-nome">{f.nome}</span>
            <span className="legenda-valor">{fmtBRL(f.valor)}</span>
            <span className="legenda-pct">{pct(f.valor, total)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

const pct = (v: number, t: number) => (t > 0 ? `${Math.round((v / t) * 100)}%` : '–')
