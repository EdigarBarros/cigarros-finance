/**
 * O miolo do cartão de cada dívida (tela Dívidas, "Cada dívida"), montado por lib/cartaoDaDivida.ts: o valor, o destaque
 * escolhido para aquela dívida e as peças que couberam. Aqui só o desenho de cada peça; quem escolhe é o compositor.
 */
import type { CSSProperties, ReactNode } from 'react'
import { diasDeAtraso, diasAte, emUmMes, montarCartao, tracosDe, type Destaque, type Montagem, type Peca, type TracosDaDivida } from '../lib/cartaoDaDivida'
import { aproxDiv, fmtDiv, type Calendario, type SituacaoDivida } from '../lib/dividas'
import { fmtDataCurta, fmtMesAno, fmtTaxa, MESES_CURTO, noMeioDaFrase } from '../lib/format'
import { tx } from '../lib/textos'
import { Icone } from './Icone'
import { Numero } from './Numero'
import { Anel } from './ui'
import './cartao-divida.css'

const PALETA_PARTES = ['#4c8dff', '#8b5cf6', '#14b8a6', '#f59e0b', '#e255a1', '#22c55e', '#0ea5e9', '#ef4444']

/** O miolo: valor + destaque, e as peças embaixo. Devolve também a montagem, para o cartão saber se mostra o "Conferi". */
export function mioloDaDivida(s: SituacaoDivida, cal: Calendario | null, recebe: boolean, hoje: string): { montagem: Montagem; miolo: ReactNode } {
  const t = tracosDe(s, cal, recebe, hoje)
  const montagem = montarCartao(t)
  const fmt = (n: number) => fmtDiv(s, n)
  const comJuros = s.jurosAtraso > 0
  const rotulo = t.quitada ? (recebe ? tx('recebido') : tx('quitada')) : recebe ? tx('falta receber') : comJuros ? tx('falta pagar hoje') : tx('falta pagar')
  const miolo = (
    <div className="dvm" data-destaque={montagem.destaque}>
      <div className="dv-cartao-meio">
        <span>
          <small>{rotulo}</small>
          <strong>{t.quitada ? fmt(s.saldoInicial) : <Numero valor={s.restanteHoje} formato={fmt} />}</strong>
          {s.moeda && !t.quitada && <small className="dv-aprox">{aproxDiv(s, s.restanteHoje)}</small>}
        </span>
        <DestaqueDaDivida d={montagem.destaque} t={t} recebe={recebe} />
      </div>
      {montagem.pecas.map((p) => <PecaDaDivida key={p} p={p} d={montagem.destaque} t={t} cal={cal} s={s} recebe={recebe} fmt={fmt} />)}
    </div>
  )
  return { montagem, miolo }
}

/** O desenho grande ao lado do valor. */
function DestaqueDaDivida({ d, t, recebe }: { d: Destaque; t: TracosDaDivida; recebe: boolean }) {
  const pct = t.inicial > 0 ? Math.min(1, t.pago / t.inicial) : 1
  switch (d) {
    case 'festa':
      return <span className="dvm-festa" aria-hidden="true"><Icone nome="check" tamanho={26} /></span>
    case 'taxa':
      return (
        <span className="dvm-taxa" title={tx('Juros do contrato')}>
          <b>{fmtTaxa(t.jurosContrato ?? 0)}%</b><small>{tx('ao mês')}</small>
        </span>
      )
    case 'dias': {
      const n = diasDeAtraso(t)
      return (
        <span className="dvm-dias">
          <b>{n}</b><small>{n === 1 ? tx('dia de atraso') : tx('dias de atraso')}</small>
        </span>
      )
    }
    case 'folhinha': {
      const [, m, dia] = (t.proxima?.data ?? '').split('-').map(Number)
      const em = diasAte(t)
      return (
        <span className="dvm-folhinha">
          <i>{noMeioDaFrase(MESES_CURTO[(m || 1) - 1])}</i>
          <b>{dia}</b>
          <small>{em === 0 ? tx('hoje') : em === 1 ? tx('amanhã') : tx('em {0} dias', em ?? 0)}</small>
        </span>
      )
    }
    case 'fatias':
      return <AnelDeFatias estados={t.parcelas!.estados} pagas={t.parcelas!.pagas} total={t.parcelas!.total} />
    default:
      return <Anel valor={pct} cor={recebe ? 'var(--entrada)' : 'var(--caixa)'} tamanho={56}>{Math.round(pct * 100)}%</Anel>
  }
}

/** Um anel com uma fatia por parcela (paga, pela metade, atrasada, a vencer) e "pagas/total" no meio. */
function AnelDeFatias({ estados, pagas, total }: { estados: TracosDaDivida['parcelas'] extends infer P ? P extends { estados: infer E } ? E : never : never; pagas: number; total: number }) {
  const R = 25, C = 30, folga = total > 12 ? 2 : 4
  const passo = 360 / total
  const ponto = (graus: number) => {
    const r = ((graus - 90) * Math.PI) / 180
    return `${(C + R * Math.cos(r)).toFixed(2)},${(C + R * Math.sin(r)).toFixed(2)}`
  }
  return (
    <span className="dvm-fatias" title={tx('{0} de {1} parcelas pagas', pagas, total)}>
      <svg viewBox="0 0 60 60" aria-hidden="true">
        {estados.map((e, i) => {
          const a = i * passo + folga / 2, b = (i + 1) * passo - folga / 2
          return <path key={i} className={e} style={{ '--i': i } as CSSProperties} d={`M${ponto(a)} A${R},${R} 0 ${b - a > 180 ? 1 : 0} 1 ${ponto(b)}`} />
        })}
      </svg>
      <span><b>{pagas}</b><small>/{total}</small></span>
    </span>
  )
}

function PecaDaDivida({ p, d, t, cal, s, recebe, fmt }: { p: Peca; d: Destaque; t: TracosDaDivida; cal: Calendario | null; s: SituacaoDivida; recebe: boolean; fmt: (n: number) => string }) {
  switch (p) {
    case 'quitada':
      return <p className="dvm-linha bom"><Icone nome="check" tamanho={15} /> {tx('Tudo {0}. 🎉', recebe ? tx('recebido') : tx('pago'))}</p>

    case 'atraso': {
      const n = diasDeAtraso(t)
      return (
        <div className="dvm-atraso">
          <Icone nome="relogio" tamanho={16} />
          <span><b>{fmt(t.vencido!.valor)}</b> {tx('vencido desde {0}', fmtDataCurta(t.vencido!.desde))}</span>
          {/* o destaque já mostra os dias de atraso: aqui não repete */}
          {n > 0 && d !== 'dias' && <em>{n === 1 ? tx('1 dia') : tx('{0} dias', n)}</em>}
        </div>
      )
    }

    case 'proxima': {
      const em = diasAte(t)
      return (
        <div className="dvm-proxima">
          <Icone nome="calendario" tamanho={16} />
          <span>{tx('Próxima:')} <b>{fmtDataCurta(t.proxima!.data)}</b> · {fmt(t.proxima!.valor)}</span>
          {em !== null && <em>{em === 0 ? tx('hoje') : em === 1 ? tx('amanhã') : tx('em {0} dias', em)}</em>}
        </div>
      )
    }

    case 'livre':
      return (
        <div className="dvm-livre">
          <span className="dvm-livre-ic" aria-hidden="true"><Icone nome="trocar" tamanho={16} /></span>
          <span>
            <b>{recebe ? tx('Recebe quanto e quando puder') : tx('Paga quanto e quando puder')}</b>
            <small>{t.pago > 0 ? (recebe ? tx('Já recebeu {0}', fmt(t.pago)) : tx('Já pagou {0}', fmt(t.pago))) : tx('Sem data combinada')}</small>
          </span>
        </div>
      )

    case 'parcelas': {
      const ps = t.parcelas!
      const abertas = ps.total - ps.pagas - ps.atrasadas
      return (
        <div className="dvm-parcelas">
          <span className="dv-pips" aria-hidden="true">
            {cal!.parcelas.map((x, i) => (
              <i key={x.n} className={x.estado} style={{ '--p': `${(x.pago / x.valor) * 100}%`, animationDelay: `${150 + i * 22}ms` } as CSSProperties} />
            ))}
          </span>
          <span className="dvm-legenda">
            {ps.pagas > 0 && <span className="paga"><i />{ps.pagas === 1 ? tx('1 paga') : tx('{0} pagas', ps.pagas)}</span>}
            {ps.atrasadas > 0 && <span className="atrasada"><i />{ps.atrasadas === 1 ? tx('1 atrasada') : tx('{0} atrasadas', ps.atrasadas)}</span>}
            {abertas > 0 && <span className="aberta"><i />{tx('{0} a vencer', abertas)}</span>}
          </span>
        </div>
      )
    }

    case 'barra': {
      const pct = Math.min(1, t.pago / t.inicial)
      return (
        <div className="dvm-barra">
          <span className="dv-barra" aria-hidden="true"><i style={{ width: `${pct * 100}%` }} /></span>
          <small>{recebe ? tx('Recebido {0} de {1}', fmt(t.pago), fmt(t.inicial)) : tx('Pago {0} de {1}', fmt(t.pago), fmt(t.inicial))}</small>
        </div>
      )
    }

    case 'chegada':
      return (
        <p className="dvm-linha">
          <Icone nome="meta" tamanho={15} /> {tx('Termina em {0}', fmtMesAno(t.quitacao![0], t.quitacao![1]))}
          <span className="dvm-sub">· {tx('faltam {0} meses', t.mesesRestantes ?? 0)}</span>
        </p>
      )

    case 'crescendo': {
      const j = t.jurosAtraso!
      const mes = j.porDia * 30
      // sete barrinhas subindo: o que a dívida vira nas próximas semanas, se nada for pago
      const semanas = [0, 1, 2, 3, 4, 5, 6].map((k) => t.restanteHoje + j.porDia * 7 * k)
      const max = semanas[semanas.length - 1] || 1, min = semanas[0] * 0.96
      return (
        <div className="dvm-crescendo">
          <span className="dvm-crescendo-texto">
            <b>{tx('Juros do atraso')}</b>
            <small>{tx('+{0} por dia · estimado', fmt(j.porDia))}</small>
            <small>{tx('em 30 dias: +{0}', fmt(mes))}</small>
          </span>
          <span className="dvm-crescendo-barras" aria-hidden="true">
            {semanas.map((v, k) => <i key={k} style={{ '--h': (v - min) / (max - min || 1), '--i': k } as CSSProperties} />)}
          </span>
        </div>
      )
    }

    case 'jurosContrato': {
      const depois = emUmMes(t)
      return (
        <div className="dvm-duelo">
          <span className="dvm-duelo-titulo">{d === 'taxa' ? tx('Se ficar sem pagar') : tx('Juros de {0}% ao mês', fmtTaxa(t.jurosContrato!))}</span>
          <span className="dvm-duelo-linha"><small>{tx('hoje')}</small><i style={{ '--p': t.restanteHoje / depois } as CSSProperties} /><b>{fmt(t.restanteHoje)}</b></span>
          <span className="dvm-duelo-linha mais"><small>{tx('em 1 mês')}</small><i style={{ '--p': 1 } as CSSProperties} /><b>{fmt(depois)}</b></span>
        </div>
      )
    }

    case 'emprestimo': {
      const e = t.emprestimo!
      const juros = Math.max(0, e.total - e.recebido)
      const pct = e.recebido > 0 ? (juros / e.recebido) * 100 : 0
      return (
        <div className="dvm-emprestimo">
          <span className="dvm-emprestimo-titulo">
            {recebe ? tx('Emprestou {0}, recebe {1}', fmt(e.recebido), fmt(e.total)) : tx('Recebeu {0}, devolve {1}', fmt(e.recebido), fmt(e.total))}
          </span>
          <span className="dvm-emprestimo-barra" aria-hidden="true">
            <i style={{ flexGrow: e.recebido } as CSSProperties} />
            {juros > 0 && <i className="juros" style={{ flexGrow: juros } as CSSProperties} />}
          </span>
          <small>{juros > 0 ? tx('{0} de juros ({1}%)', fmt(juros), fmtTaxa(pct)) : tx('Sem juros')}</small>
        </div>
      )
    }

    case 'partes': {
      const total = t.partes.reduce((a, x) => a + x.valor, 0) || 1
      const mostrar = t.partes.slice(0, 3)
      return (
        <div className="dvm-partes">
          <span className="dvm-partes-barra" aria-hidden="true">
            {t.partes.map((x, i) => <i key={x.nome + i} style={{ '--c': PALETA_PARTES[i % PALETA_PARTES.length], flexGrow: x.valor } as CSSProperties} />)}
          </span>
          <span className="dvm-partes-lista">
            {mostrar.map((x, i) => (
              <span key={x.nome + i} style={{ '--c': PALETA_PARTES[i % PALETA_PARTES.length] } as CSSProperties}>
                <i /><em>{x.nome}</em><b>{Math.round((x.valor / total) * 100)}%</b>
              </span>
            ))}
            {t.partes.length > 3 && <span className="dvm-sub">{tx('+{0} partes', t.partes.length - 3)}</span>}
          </span>
        </div>
      )
    }
  }
  void s
  return null
}
