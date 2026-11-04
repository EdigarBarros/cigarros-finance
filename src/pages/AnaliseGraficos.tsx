import { useState, type CSSProperties, type ReactNode } from 'react'
import type { Tom } from '../lib/analise'
import type { Destino } from '../lib/conselheiro'
import { doMesChave } from '../lib/cartoes'
import { fmtDataCurta, fmtMesAno, fmtPct, fmtValor, LOCAL_DAS_DATAS } from '../lib/format'
import { COR_DO_TOM, fmtCurto, useEmVista } from './analiseApoio'
import type { Visual } from '../lib/visuais'
import { Anel } from '../components/ui'
import { Icone } from '../components/Icone'
import { Numero } from '../components/Numero'
import { tx } from '../lib/textos'

/*
 * Os desenhos do consultor: cada tipo de visual de lib/visuais.ts vira um gráfico em SVG ou HTML, com animação que só
 * começa quando o cartão aparece na tela (classe "vivo"). Com "Animações reduzidas" (Configurações), tudo aparece pronto.
 */

/**
 * O cartão de um visual: título curto, uma frase, o desenho e, se houver, o atalho para a tela certa. Com `prefs`, ganha a
 * estrela (favorito: vai para o topo) e o "esconder", e conta os toques (o que a pessoa mais usa sobe sozinho).
 */
export function CartaoVisual({ v, aoIr, prefs, children }: {
  v: Pick<Visual, 'id' | 'titulo' | 'frase' | 'tom' | 'destino'>
  aoIr?: (d: Destino) => void
  prefs?: { favorito: boolean; aoFavoritar: () => void; aoEsconder: () => void; aoTocar: () => void }
  children: ReactNode
}) {
  const [ref, vivo] = useEmVista<HTMLElement>()
  return (
    <section ref={ref} className={`cartao vis ${vivo ? 'vivo' : ''} ${prefs?.favorito ? 'favorito' : ''}`} onClickCapture={prefs?.aoTocar}
      style={{ '--c': v.tom ? COR_DO_TOM[v.tom] : 'var(--destaque)' } as CSSProperties}>
      <header className="vis-cab">
        <h3>{v.titulo}</h3>
        <span className="vis-botoes">
          {prefs && (
            <>
              <button className={`vis-ir vis-estrela ${prefs.favorito ? 'ligada' : ''}`} onClick={prefs.aoFavoritar} aria-pressed={prefs.favorito}
                aria-label={prefs.favorito ? tx('Tirar dos favoritos') : tx('Favoritar: este gráfico fica no topo')} title={prefs.favorito ? tx('Tirar dos favoritos') : tx('Favoritar: este gráfico fica no topo')}>
                <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" /></svg>
              </button>
              <button className="vis-ir" onClick={prefs.aoEsconder} aria-label={tx('Esconder este gráfico')} title={tx('Esconder este gráfico')}>
                <Icone nome="fechar" tamanho={15} />
              </button>
            </>
          )}
          {v.destino && aoIr && <button className="vis-ir" onClick={() => aoIr(v.destino!)} aria-label={tx('Abrir')}><Icone nome="dir" tamanho={18} /></button>}
        </span>
      </header>
      {v.frase && <p className="vis-frase">{v.frase}</p>}
      <div className="vis-corpo">{children}</div>
    </section>
  )
}

export function Grafico({ v }: { v: Visual }) {
  switch (v.tipo) {
    case 'cascata': return <Cascata passos={v.passos} />
    case 'calendario': return <Calendario v={v} />
    case 'curva': return <Curva pontos={v.pontos} zero={v.zero} tracejadoDesde={v.tracejadoDesde} cor={v.tom ? COR_DO_TOM[v.tom] : 'var(--caixa)'} />
    case 'rosca': return <Rosca fatias={v.fatias} ideal={v.ideal} centro={v.centro} />
    case 'radar': return <Radar eixos={v.eixos} />
    case 'barras': return <Barras barras={v.barras} />
    case 'halteres': return <Halteres itens={v.itens} />
    case 'colunas': return <Colunas colunas={v.colunas} />
    case 'linhaDoTempo': return <LinhaDoTempo v={v} />
    case 'pote': return <Pote atual={v.atual} maximo={v.maximo} marcos={v.marcos} />
    case 'aneis': return <Aneis itens={v.itens} />
    case 'tabela': return <Tabela colunas={v.colunas} linhas={v.linhas} />
    case 'fluxo': return <Fluxo grupos={v.grupos} />
  }
}

// ---------- medidor da nota ----------

/** Velocímetro de 0 a 100: o arco enche e o ponteiro gira até a nota. */
export function Medidor({ valor, tom }: { valor: number | null; tom: Tom }) {
  const p = valor === null ? 0 : Math.max(0, Math.min(100, valor))
  return (
    <div className="medidor" style={{ '--c': COR_DO_TOM[tom], '--ang': `${-90 + (p / 100) * 180}deg` } as CSSProperties}>
      <svg viewBox="0 0 200 110" aria-hidden="true">
        {/* as faixas de fora: até 45 frágil, até 70 razoável, daí para cima boa */}
        <path className="medidor-zona ruim" d="M8 100 A92 92 0 0 1 84.2 9.4" />
        <path className="medidor-zona medio" d="M87 9.1 A92 92 0 0 1 152.4 25.1" />
        <path className="medidor-zona bom" d="M154.8 26.8 A92 92 0 0 1 192 100" />
        <path className="medidor-fundo" d="M20 100 A80 80 0 0 1 180 100" pathLength={100} />
        {valor !== null && <path className="medidor-arco" d="M20 100 A80 80 0 0 1 180 100" pathLength={100} strokeDasharray={`${p} 100`} />}
        {/* a bolinha corre pela borda do arco até a nota, sem passar por cima do número */}
        {valor !== null && <g className="medidor-ponteiro"><circle cx="100" cy="20" r="10" /></g>}
      </svg>
      <span className="medidor-valor">{valor === null ? '—' : <Numero valor={valor} formato={(n) => String(Math.round(n))} />}</span>
    </div>
  )
}

/** A escada das 5 fases: degraus que sobem, os feitos em verde e um alfinete no atual. */
export function Escada({ fases, atual }: { fases: { id: string; nome: string }[]; atual: number }) {
  return (
    <ol className="escada">
      {fases.map((f, i) => (
        <li key={f.id} className={i < atual ? 'feita' : i === atual ? 'atual' : ''} style={{ '--i': i, '--h': `${26 + i * 15}px` } as CSSProperties}>
          <span className="escada-degrau">{i < atual ? <Icone nome="check" tamanho={14} /> : i + 1}</span>
          <small>{f.nome}</small>
        </li>
      ))}
    </ol>
  )
}

// ---------- cascata (como o mês fecha) ----------

function Cascata({ passos }: { passos: { rotulo: string; valor: number; tipo: 'entra' | 'sai' | 'fica' }[] }) {
  const entra = passos.find((p) => p.tipo === 'entra')?.valor ?? 0
  // cada saída desce a partir de onde a anterior parou; a última coluna mostra o que fica
  const barras = passos.reduce<{ lista: (typeof passos[number] & { de: number; ate: number })[]; nivel: number }>((acc, p) => {
    if (p.tipo === 'entra') return { lista: [...acc.lista, { ...p, de: 0, ate: p.valor }], nivel: p.valor }
    if (p.tipo === 'sai') return { lista: [...acc.lista, { ...p, de: acc.nivel - p.valor, ate: acc.nivel }], nivel: acc.nivel - p.valor }
    return { lista: [...acc.lista, { ...p, de: Math.min(0, p.valor), ate: Math.max(0, p.valor) }], nivel: acc.nivel }
  }, { lista: [], nivel: 0 }).lista
  const max = Math.max(entra, ...barras.map((b) => b.ate), 1)
  const min = Math.min(0, ...barras.map((b) => b.de))
  const faixa = max - min
  const y = (v: number) => ((v - min) / faixa) * 100
  return (
    <div className="cascata" style={{ '--zero': `${y(0)}%` } as CSSProperties}>
      {barras.map((b, i) => (
        <div key={b.rotulo} className={`cascata-col ${b.tipo} ${b.tipo === 'fica' && b.valor < 0 ? 'negativo' : ''}`} style={{ '--i': i } as CSSProperties}>
          <div className="cascata-area">
            <i style={{ bottom: `${y(b.de)}%`, height: `${Math.max(0.8, y(b.ate) - y(b.de))}%` }} />
            <b style={{ bottom: `calc(${y(b.ate)}% + 4px)` }}>{b.tipo === 'sai' ? `−${fmtCurto(b.valor)}` : fmtCurto(b.valor)}</b>
          </div>
          <small>{b.rotulo}</small>
        </div>
      ))}
    </div>
  )
}

// ---------- calendário do mês ----------

function Calendario({ v }: { v: Extract<Visual, { tipo: 'calendario' }> }) {
  const [escolhido, setEscolhido] = useState<number | null>(null)
  const primeiro = new Date(v.ano, v.mes - 1, 1).getDay()
  const semana = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(LOCAL_DAS_DATAS, { weekday: 'narrow' }).format(new Date(2026, 1, 1 + i)))
  const maior = Math.max(1, ...v.dias.map((d) => Math.max(d.entra, d.sai)))
  const marcado = new Map(v.marcados.map((m) => [m.dia, m.tom]))
  const dia = escolhido !== null ? v.dias[escolhido - 1] : null
  const iso = (d: number) => `${v.ano}-${String(v.mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  return (
    <div className="calendario">
      <div className="calendario-grade">
        {semana.map((s, i) => <span key={`s${i}`} className="calendario-semana">{s}</span>)}
        {Array.from({ length: primeiro }, (_, i) => <span key={`v${i}`} />)}
        {v.dias.map((d, i) => {
          const tom = marcado.get(d.dia)
          return (
            <button key={d.dia} style={{ '--i': i, '--m': tom ? COR_DO_TOM[tom] : 'transparent' } as CSSProperties}
              className={`calendario-dia ${d.dia < v.hoje ? 'passou' : ''} ${d.dia === v.hoje ? 'hoje' : ''} ${tom ? 'marcado' : ''} ${escolhido === d.dia ? 'escolhido' : ''}`}
              onClick={() => setEscolhido(escolhido === d.dia ? null : d.dia)} aria-label={fmtDataCurta(iso(d.dia))}>
              <span>{d.dia}</span>
              <span className="calendario-marcas">
                {d.entra > 0 && <i className="entra" style={{ width: 5 + 7 * Math.sqrt(d.entra / maior), height: 5 + 7 * Math.sqrt(d.entra / maior) }} />}
                {d.sai > 0 && <i className="sai" style={{ width: 5 + 7 * Math.sqrt(d.sai / maior), height: 5 + 7 * Math.sqrt(d.sai / maior) }} />}
              </span>
            </button>
          )
        })}
      </div>
      <p className="calendario-detalhe">
        {dia ? (
          <>
            <b>{fmtDataCurta(iso(dia.dia))}</b>
            {dia.entra > 0 && <span className="entra">+ {fmtValor(dia.entra)}</span>}
            {dia.sai > 0 && <span className="sai">− {fmtValor(dia.sai)}</span>}
            {!dia.entra && !dia.sai && <span>{tx('Nada neste dia.')}</span>}
          </>
        ) : (
          <>
            <span className="entra"><i /> {tx('entra')}</span>
            <span className="sai"><i /> {tx('sai')}</span>
            <span>{tx('Toque num dia para ver.')}</span>
          </>
        )}
      </p>
    </div>
  )
}

// ---------- curva (saldo dia a dia, tudo o que é seu) ----------

function Curva({ pontos, zero, tracejadoDesde, cor }: { pontos: { rotulo: string; valor: number }[]; zero: boolean; tracejadoDesde?: number; cor: string }) {
  const L = 300, A = 120, M = 8
  const vals = pontos.map((p) => p.valor)
  const max = Math.max(...vals, zero ? 0 : -Infinity)
  const min = Math.min(...vals, zero ? 0 : Infinity)
  const faixa = max - min || 1
  const x = (i: number) => M + (i / Math.max(1, pontos.length - 1)) * (L - 2 * M)
  const y = (v: number) => M + (1 - (v - min) / faixa) * (A - 2 * M)
  const corte = tracejadoDesde ?? pontos.length - 1
  const linha = (ps: number[]) => ps.map((i, k) => `${k ? 'L' : 'M'}${x(i).toFixed(1)} ${y(pontos[i].valor).toFixed(1)}`).join(' ')
  const cheia = linha(pontos.map((_, i) => i).filter((i) => i <= corte))
  const tracejada = corte < pontos.length - 1 ? linha([corte, ...pontos.map((_, i) => i).filter((i) => i > corte)]) : ''
  const base = zero ? y(0) : A - M
  const area = `${cheia} L${x(corte).toFixed(1)} ${base.toFixed(1)} L${x(0).toFixed(1)} ${base.toFixed(1)} Z` // sem-tx: desenho
  const iMin = vals.indexOf(Math.min(...vals))
  return (
    <div className="curva" style={{ '--c': cor } as CSSProperties}>
      <svg viewBox={`0 0 ${L} ${A}`} aria-hidden="true">
        <defs>
          <linearGradient id="curva-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="currentColor" stopOpacity=".28" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        {zero && <line className="curva-zero" x1={M} x2={L - M} y1={y(0)} y2={y(0)} />}
        <path className="curva-area" d={area} fill="url(#curva-grad)" />
        <path className="curva-linha" d={cheia} pathLength={1} />
        {tracejada && <path className="curva-tracejada" d={tracejada} />}
        <circle className="curva-ponto" cx={x(iMin)} cy={y(vals[iMin])} r="4.5" />
        <circle className="curva-ponto fim" cx={x(pontos.length - 1)} cy={y(vals[vals.length - 1])} r="4.5" />
      </svg>
      <div className="curva-eixo">
        <span>{pontos[0].rotulo}<b>{fmtCurto(vals[0])}</b></span>
        {iMin !== 0 && iMin !== pontos.length - 1 && <span className="min">{pontos[iMin].rotulo}<b>{fmtCurto(vals[iMin])}</b></span>}
        <span>{pontos[pontos.length - 1].rotulo}<b>{fmtCurto(vals[vals.length - 1])}</b></span>
      </div>
    </div>
  )
}

// ---------- rosca ----------

function Rosca({ fatias, ideal, centro }: { fatias: { rotulo: string; valor: number; cor: string }[]; ideal?: { rotulo: string; valor: number; cor: string }[]; centro: { valor: string; rotulo: string } }) {
  const total = fatias.reduce((s, f) => s + Math.max(0, f.valor), 0) || 1
  const arcos = (fs: typeof fatias, soma: number) => {
    let ac = 0
    return fs.map((f) => {
      const p = (Math.max(0, f.valor) / soma) * 100
      const r = { ...f, p, inicio: ac }
      ac += p
      return r
    })
  }
  return (
    <div className="rosca">
      <div className="rosca-desenho">
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <circle className="rosca-fundo" cx="60" cy="60" r="48" />
          {arcos(fatias, total).map((f, i) => f.p > 0 && (
            <circle key={f.rotulo} className="rosca-fatia" cx="60" cy="60" r="48" pathLength={100} stroke={f.cor}
              strokeDasharray={`${Math.max(0, f.p - 0.8)} 100`} strokeDashoffset={-f.inicio} style={{ '--i': i } as CSSProperties} />
          ))}
          {ideal && arcos(ideal, 1).map((f) => (
            <circle key={`i${f.rotulo}`} className="rosca-ideal" cx="60" cy="60" r="35" pathLength={100} stroke={f.cor}
              strokeDasharray={`${Math.max(0, f.p - 1)} 100`} strokeDashoffset={-f.inicio} />
          ))}
        </svg>
        <span className="rosca-centro"><b>{centro.valor}</b><small>{centro.rotulo}</small></span>
      </div>
      <ul className="rosca-legenda">
        {fatias.map((f, i) => (
          <li key={f.rotulo}>
            <i style={{ background: f.cor }} />
            <span>{f.rotulo}</span>
            <b>{fmtPct(f.valor / total)}</b>
            {ideal && <small>{tx('ideal {0}', fmtPct(ideal[i]?.valor ?? 0))}</small>}
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---------- radar ----------

function Radar({ eixos }: { eixos: { rotulo: string; valor: number }[] }) {
  const n = eixos.length
  const ponto = (i: number, r: number) => {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2
    return [Math.cos(a) * r, Math.sin(a) * r] as const
  }
  const poligono = (r: (i: number) => number) => eixos.map((_, i) => ponto(i, r(i)).map((c) => c.toFixed(1)).join(',')).join(' ')
  return (
    <div className="radar">
      <svg viewBox="-165 -112 330 228" aria-hidden="true">
        {[25, 50, 75, 100].map((r) => <polygon key={r} className="radar-grade" points={poligono(() => r * 0.8)} />)}
        {eixos.map((_, i) => { const [x, y] = ponto(i, 80); return <line key={i} className="radar-eixo" x1="0" y1="0" x2={x} y2={y} /> })}
        <polygon className="radar-valor" points={poligono((i) => Math.max(4, eixos[i].valor) * 0.8)} />
        {eixos.map((e, i) => {
          const [x, y] = ponto(i, Math.max(4, e.valor) * 0.8)
          return <circle key={`p${i}`} className="radar-ponto" cx={x} cy={y} r="4" style={{ '--c': COR_DO_TOM[e.valor >= 70 ? 'bom' : e.valor >= 45 ? 'medio' : 'ruim'] } as CSSProperties} />
        })}
        {eixos.map((e, i) => {
          const [x, y] = ponto(i, 100)
          return (
            <text key={`t${i}`} className="radar-rotulo" x={x} y={y + (y > 10 ? 10 : y < -10 ? -4 : 4)} textAnchor={x > 10 ? 'start' : x < -10 ? 'end' : 'middle'}>
              {e.rotulo} <tspan className="radar-nota">{e.valor}</tspan>
            </text>
          )
        })}
      </svg>
    </div>
  )
}

// ---------- barras ----------

function Barras({ barras }: { barras: { rotulo: string; valor: number; cor?: string; icone?: string; nota?: string }[] }) {
  const max = Math.max(1, ...barras.map((b) => b.valor))
  return (
    <ul className="barras">
      {barras.map((b, i) => (
        <li key={b.rotulo} style={{ '--i': i, '--c': b.cor ?? 'var(--caixa)' } as CSSProperties}>
          <span className="barras-rotulo">{b.icone && <span className="barras-icone">{b.icone}</span>}<span>{b.rotulo}</span>{b.nota && <small>{b.nota}</small>}</span>
          <span className="barras-trilho"><i style={{ width: `${(b.valor / max) * 100}%` }} /></span>
          <b>{fmtCurto(b.valor)}</b>
        </li>
      ))}
    </ul>
  )
}

// ---------- antes × agora ----------

function Halteres({ itens }: { itens: { rotulo: string; icone: string; antes: number; agora: number }[] }) {
  const max = Math.max(1, ...itens.flatMap((x) => [x.antes, x.agora]))
  const p = (v: number) => `${(v / max) * 100}%`
  return (
    <ul className="halteres">
      {itens.map((x, i) => {
        const subiu = x.agora > x.antes
        return (
          <li key={x.rotulo} className={subiu ? 'subiu' : 'caiu'} style={{ '--i': i, '--de': p(x.antes), '--ate': p(x.agora) } as CSSProperties}>
            <span className="halteres-rotulo"><span>{x.icone}</span> {x.rotulo}</span>
            <span className="halteres-trilho">
              <i className="halteres-liga" style={{ left: p(Math.min(x.antes, x.agora)), width: `${(Math.abs(x.agora - x.antes) / max) * 100}%` }} />
              <i className="halteres-antes" style={{ left: p(x.antes) }} />
              <i className="halteres-agora" style={{ left: p(x.agora) }} />
            </span>
            <span className="halteres-valores"><small>{fmtCurto(x.antes)}</small><Icone nome="seta" tamanho={12} /><b>{fmtCurto(x.agora)}</b></span>
          </li>
        )
      })}
      <li className="halteres-legenda"><span><i className="halteres-antes" /> {tx('antes')}</span><span><i className="halteres-agora" /> {tx('agora')}</span></li>
    </ul>
  )
}

// ---------- colunas (sobra mês a mês) ----------

function Colunas({ colunas }: { colunas: { rotulo: string; valor: number }[] }) {
  const maxPos = Math.max(1, ...colunas.map((c) => c.valor))
  const maxNeg = Math.max(0, ...colunas.map((c) => -c.valor))
  const zero = (maxPos / (maxPos + maxNeg)) * 100
  return (
    <div className="colunas" style={{ '--zero': `${zero}%` } as CSSProperties}>
      {colunas.map((c, i) => {
        const h = (Math.abs(c.valor) / (maxPos + maxNeg)) * 100
        return (
          <div key={`${c.rotulo}${i}`} className={`colunas-col ${c.valor >= 0 ? 'pos' : 'neg'}`} style={{ '--i': i } as CSSProperties} title={fmtValor(c.valor)}>
            <i style={c.valor >= 0 ? { bottom: `calc(100% - var(--zero))`, height: `${h}%` } : { top: 'var(--zero)', height: `${h}%` }} />
            <small>{c.rotulo}</small>
          </div>
        )
      })}
    </div>
  )
}

// ---------- linha do tempo (dívidas) ----------

function LinhaDoTempo({ v }: { v: Extract<Visual, { tipo: 'linhaDoTempo' }> }) {
  const total = Math.max(1, v.fim - v.inicio)
  const p = (k: number) => `${Math.max(2, ((k - v.inicio) / total) * 100)}%`
  const mes = (k: number) => { const m = doMesChave(k); return fmtMesAno(m.ano, m.mes) }
  return (
    <div className="tempo">
      {v.itens.map((x, i) => (
        <div key={x.rotulo} className="tempo-linha" style={{ '--i': i } as CSSProperties}>
          <span className="tempo-rotulo">{x.rotulo}</span>
          <span className="tempo-trilho">
            <i className="tempo-sem" style={{ width: p(x.fim) }} />
            {x.fimComPlano !== null && x.fimComPlano < x.fim && <i className="tempo-com" style={{ width: p(x.fimComPlano) }} />}
          </span>
          <span className="tempo-fim">
            <b>{mes(x.fimComPlano !== null && x.fimComPlano < x.fim ? x.fimComPlano : x.fim)}</b>
            {x.fimComPlano !== null && x.fimComPlano < x.fim && <small>{tx('era {0}', mes(x.fim))}</small>}
          </span>
        </div>
      ))}
      <div className="tempo-eixo"><span>{tx('Hoje')}</span><span>{mes(v.fim)}</span></div>
    </div>
  )
}

// ---------- pote (reserva) ----------

function Pote({ atual, maximo, marcos }: { atual: number; maximo: number; marcos: { rotulo: string; valor: number }[] }) {
  const p = Math.min(1, atual / Math.max(1, maximo))
  return (
    <div className="pote">
      <div className="pote-vidro" style={{ '--n': `${p * 100}%` } as CSSProperties}>
        <i className="pote-agua" />
        {marcos.map((m) => (
          <span key={m.rotulo} className="pote-marco" style={{ bottom: `${Math.min(100, (m.valor / Math.max(1, maximo)) * 100)}%` }}><small>{m.rotulo}</small></span>
        ))}
      </div>
      <div className="pote-numeros">
        <strong><Numero valor={atual} formato={fmtValor} /></strong>
        <small>{tx('guardado')}</small>
        {marcos.map((m) => (
          <span key={m.rotulo} className={atual >= m.valor ? 'ok' : ''}>
            <Icone nome={atual >= m.valor ? 'check' : 'meta'} tamanho={14} /> {m.rotulo}: {fmtCurto(m.valor)}
          </span>
        ))}
      </div>
    </div>
  )
}

// ---------- anéis (metas) ----------

function Aneis({ itens }: { itens: { rotulo: string; icone: string; progresso: number; legenda: string; tom: Tom }[] }) {
  return (
    <ul className="aneis">
      {itens.map((x) => (
        <li key={x.rotulo}>
          <Anel valor={x.progresso} cor={COR_DO_TOM[x.tom]} tamanho={74}><span className="aneis-icone">{x.icone}</span></Anel>
          <b>{fmtPct(x.progresso)}</b>
          <span>{x.rotulo}</span>
          <small>{x.legenda}</small>
        </li>
      ))}
    </ul>
  )
}

// ---------- tabela (teto para cada gasto) ----------

function Tabela({ colunas, linhas }: { colunas: string[]; linhas: { icone: string; rotulo: string; valores: number[]; corta: boolean }[] }) {
  const max = Math.max(1, ...linhas.flatMap((l) => l.valores))
  return (
    <table className="tabela-vis">
      <thead><tr>{colunas.map((c) => <th key={c}>{c}</th>)}</tr></thead>
      <tbody>
        {linhas.map((l, i) => (
          <tr key={l.rotulo} className={l.corta ? 'corta' : ''} style={{ '--i': i } as CSSProperties}>
            <td><span className="tabela-icone">{l.icone}</span> {l.rotulo}</td>
            <td><span className="tabela-barra" style={{ '--w': `${(l.valores[0] / max) * 100}%` } as CSSProperties} />{fmtCurto(l.valores[0])}</td>
            <td>{l.corta && <Icone nome="desce" tamanho={13} />}{fmtCurto(l.valores[1])}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ---------- de onde sai o dinheiro (planejador) ----------

/** Quantos compromissos aparecem antes de "Ver todos" (os que não têm dinheiro sempre aparecem). */
const NO_FLUXO = 8

function Fluxo({ grupos }: { grupos: Extract<Visual, { tipo: 'fluxo' }>['grupos'] }) {
  const [todos, setTodos] = useState(false)
  const total = grupos.reduce((s, g) => s + g.pagamentos.length, 0)
  // corta pelo número de compromissos, mantendo os grupos inteiros e sempre o "ainda sem dinheiro"
  let conta = 0
  const vistos = todos ? grupos : grupos.filter((g) => {
    if (!g.data) return true
    conta += g.pagamentos.length
    return conta - g.pagamentos.length < NO_FLUXO
  })
  return (
    <>
    <ol className="fluxo">
      {vistos.map((g, i) => (
        <li key={`${g.data}${g.fonte}${i}`} className={g.data ? '' : 'falta'} style={{ '--i': i } as CSSProperties}>
          <span className="fluxo-no" aria-hidden="true"><Icone nome={g.data ? 'receber' : 'escudo'} tamanho={14} /></span>
          <div className="fluxo-cab">
            <b>{g.data ? fmtDataCurta(g.data) : g.fonte}</b>
            {g.data && g.fonte && <span>{tx('com {0}', g.fonte)}</span>}
          </div>
          <ul>
            {g.pagamentos.map((p, k) => (
              <li key={`${p.descricao}${k}`} className={p.atraso > 0 || !g.data ? 'atrasa' : 'em-dia'}>
                <span className="fluxo-nome">{p.descricao}</span>
                <b>{fmtCurto(p.valor + p.custo)}</b>
                <small>
                  {!g.data ? tx('vence {0}', fmtDataCurta(p.vence))
                    : p.atraso === 1 ? (p.custo >= 0.01 ? tx('1 dia de atraso · +{0}', fmtValor(p.custo)) : tx('1 dia de atraso'))
                      : p.atraso > 1 ? (p.custo >= 0.01 ? tx('{0} dias de atraso · +{1}', p.atraso, fmtValor(p.custo)) : tx('{0} dias de atraso', p.atraso))
                      : tx('em dia')}
                </small>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
    {total > NO_FLUXO && vistos.length < grupos.length && <button className="quadro-ver" onClick={() => setTodos(true)}>{tx('Ver os {0} compromissos', total)}</button>}
    </>
  )
}
