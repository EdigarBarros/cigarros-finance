import { useState, type CSSProperties } from 'react'
import type { Tom } from '../lib/analise'
import { doMesChave } from '../lib/cartoes'
import { fmtDataCurta, fmtMesAno, fmtPct, fmtValor, LOCAL_DAS_DATAS } from '../lib/format'
import { COR_DO_TOM, fmtCurto } from './analiseApoio'
import type { Fatia, FormatoDoNumero, GrupoDoFluxo, LadoDoDuelo, Ponto, Visual } from '../lib/visuais'
import { Anel } from '../components/ui'
import { Icone } from '../components/Icone'
import { Numero } from '../components/Numero'
import { tx } from '../lib/textos'

/*
 * Os desenhos do consultor: cada tipo de visual de lib/visuais.ts vira um gráfico em SVG ou HTML, com animação que só
 * começa quando o cartão aparece na tela (classe "vivo"). Com "Animações reduzidas" (Configurações), tudo aparece pronto.
 */

export function Grafico({ v }: { v: Visual }) {
  switch (v.tipo) {
    case 'cascata': return <Cascata passos={v.passos} />
    case 'calendario': return <Calendario v={v} />
    case 'curva': return <Curva pontos={v.pontos} zero={v.zero} tracejadoDesde={v.tracejadoDesde} cor={v.tom ? COR_DO_TOM[v.tom] : 'var(--an-destino)'} />
    case 'rosca': return <Rosca fatias={v.fatias} ideal={v.ideal} centro={v.centro} />
    case 'radar': return <Radar eixos={v.eixos} />
    case 'barras': return <Barras barras={v.barras} />
    case 'halteres': return <Halteres itens={v.itens} />
    case 'colunas': return <Colunas colunas={v.colunas} />
    case 'linhaDoTempo': return <LinhaDoTempo v={v} />
    case 'pote': return <Pote atual={v.atual} maximo={v.maximo} marcos={v.marcos} legenda={v.legenda ?? tx('guardado')} />
    case 'aneis': return <Aneis itens={v.itens} />
    case 'tabela': return <Tabela colunas={v.colunas} linhas={v.linhas} />
    case 'fluxo': return <Fluxo grupos={v.grupos} semDinheiro={v.semDinheiro} />
    case 'quadradinhos': return <Quadradinhos fatias={v.fatias} ideal={v.ideal} />
    case 'faixa': return <Faixa fatias={v.fatias} ideal={v.ideal} />
    case 'duelo': return <Duelo lados={v.lados} selo={v.selo} tom={v.seloTom} />
    case 'numerao': return <Numerao valor={v.valor} formato={v.formato} legenda={v.legenda} faisca={v.faisca} cor={v.tom ? COR_DO_TOM[v.tom] : 'var(--destaque)'} />
    case 'podio': return <Podio itens={v.itens} />
    case 'trilha': return <Trilha atual={v.atual} maximo={v.maximo} marcos={v.marcos} legenda={v.legenda} cor={v.tom ? COR_DO_TOM[v.tom] : 'var(--an-destino)'} />
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
        <li key={b.rotulo} style={{ '--i': i, '--c': b.cor ?? 'var(--an-destino)' } as CSSProperties}>
          <span className="barras-rotulo">{b.icone && <span className="barras-icone">{b.icone}</span>}<span>{b.rotulo}</span>{b.nota && <small>{b.nota}</small>}</span>
          <span className="barras-trilho"><i style={{ width: `${(b.valor / max) * 100}%` }} /></span>
          <b>{fmtCurto(b.valor)}</b>
        </li>
      ))}
    </ul>
  )
}

// ---------- de onde sai o dinheiro ----------

/**
 * Cada dinheiro que entra vira uma barra dividida no que ele paga; o atraso aparece em laranja, com o custo. Fechado, cada
 * entrada mostra só a barra e três etiquetas (com destino, livre, com atraso); tocar abre a lista do que ela paga.
 */
/**
 * O que fica sem dinheiro, em etiquetas: a mesma conta repetida vira uma só ("Atlética Yawara ×18"), as que mais pesam
 * vêm primeiro e, passando de 6, o resto fica num "+N" que abre. Sem isso, 40 compromissos viravam um paredão.
 */
function EtiquetasDaFalta({ itens }: { itens: { rotulo: string; valor: number }[] }) {
  const [tudo, setTudo] = useState(false)
  const juntos = [...itens.reduce((m, x) => {
    const g = m.get(x.rotulo) ?? { rotulo: x.rotulo, valor: 0, vezes: 0 }
    g.valor += x.valor
    g.vezes++
    return m.set(x.rotulo, g)
  }, new Map<string, { rotulo: string; valor: number; vezes: number }>()).values()].sort((a, b) => b.valor - a.valor)
  const MAX = 6
  const vistos = tudo ? juntos : juntos.slice(0, MAX)
  return (
    <span className="fluxo-etiquetas">
      {vistos.map((x) => (
        <span key={x.rotulo} className="falta" title={fmtValor(x.valor)}>{x.rotulo}{x.vezes > 1 && <small className="fluxo-vezes">×{x.vezes}</small>}</span>
      ))}
      {juntos.length > MAX && (
        <button className="fluxo-mais" onClick={() => setTudo(!tudo)} aria-expanded={tudo}>
          {tudo ? tx('Mostrar menos') : `+${juntos.length - MAX}`}
        </button>
      )}
    </span>
  )
}

function Fluxo({ grupos, semDinheiro }: { grupos: GrupoDoFluxo[]; semDinheiro: { rotulo: string; valor: number; custo: number }[] }) {
  const [tudo, setTudo] = useState(false)
  const [aberto, setAberto] = useState<string | null>(null)
  const MAX_GRUPOS = 4
  return (
    <div className="fluxo">
      {(tudo ? grupos : grupos.slice(0, MAX_GRUPOS)).map((g, i) => {
        const usado = g.itens.reduce((s, x) => s + x.valor, 0)
        const base = Math.max(g.valor, usado, 1)
        const sobra = Math.max(0, g.valor - usado)
        const atrasa = g.itens.filter((x) => x.atraso > 0).reduce((s, x) => s + x.valor, 0)
        const pct = g.valor > 0 ? Math.min(100, Math.round((usado / g.valor) * 100)) : 100
        const chave = `${g.data}${i}`
        const esta = aberto === chave
        return (
          <div key={chave} className={`fluxo-grupo ${esta ? 'aberto' : ''}`} style={{ '--i': i } as CSSProperties}>
            <button className="fluxo-topo" onClick={() => setAberto(esta ? null : chave)} aria-expanded={esta}>
              <span className="fluxo-cab">
                <span className="fluxo-fonte"><Icone nome="receber" tamanho={15} /> <b>{g.fonte}</b> <small>{fmtDataCurta(g.data)}</small></span>
                <b>{fmtCurto(g.valor)}</b>
                <Icone nome={esta ? 'cima' : 'abaixo'} tamanho={14} />
              </span>
              <span className="fluxo-barra" role="img" aria-label={tx('{0} paga {1} de {2}', g.fonte, fmtValor(usado), fmtValor(g.valor))}>
                {g.itens.map((x, k) => (
                  <i key={k} className={x.atraso > 0 ? 'atrasa' : ''} style={{ width: `${(x.valor / base) * 100}%`, '--k': k } as CSSProperties} />
                ))}
                {sobra > 0.5 && <i className="sobra" style={{ width: `${(sobra / base) * 100}%` }} />}
              </span>
              <span className="fluxo-etiquetas">
                <span className="destino">{tx('{0}% com destino', pct)}</span>
                {sobra >= 0.5 && <span className="livre">{tx('{0} livre', fmtCurto(sobra))}</span>}
                {atrasa > 0 && <span className="atrasa">{tx('{0} com atraso', fmtCurto(atrasa))}</span>}
              </span>
            </button>
            {esta && (
              <ul className="fluxo-itens">
                {g.itens.map((x, k) => (
                  <li key={k} className={x.atraso > 0 ? 'atrasa' : ''}>
                    <i aria-hidden="true" />
                    <span>{x.rotulo}</span>
                    {x.atraso > 0 && <small>{x.atraso === 1 ? tx('1 dia de atraso, +{0}', fmtValor(x.custo)) : tx('{0} dias de atraso, +{1}', x.atraso, fmtValor(x.custo))}</small>}
                    <b>{fmtCurto(x.valor)}</b>
                  </li>
                ))}
                {sobra > 0.5 && <li className="fluxo-sobra"><i aria-hidden="true" /><span>{tx('Sobra para o dia a dia')}</span><b>{fmtCurto(sobra)}</b></li>}
              </ul>
            )}
          </div>
        )
      })}
      {grupos.length > MAX_GRUPOS && (
        <button className="quadro-ver" onClick={() => setTudo(!tudo)}>
          {tudo ? tx('Mostrar menos') : tx('Ver as {0} entradas', grupos.length)}
        </button>
      )}
      {semDinheiro.length > 0 && (
        <div className="fluxo-grupo falta">
          <div className="fluxo-cab"><span className="fluxo-fonte"><Icone nome="escudo" tamanho={15} /> <b>{tx('Sem dinheiro até o fim do mês que vem')}</b></span>
            <b>{fmtCurto(semDinheiro.reduce((a, x) => a + x.valor, 0))}</b></div>
          <EtiquetasDaFalta itens={semDinheiro} />
        </div>
      )}
      <Legenda itens={[
        { cor: 'var(--an-destino)', rotulo: tx('Já tem destino (paga no prazo)') },
        ...(grupos.some((g) => g.itens.some((x) => x.atraso > 0)) ? [{ cor: 'var(--an-atencao)', rotulo: tx('Paga com atraso (custa mais)') }] : []),
        { cor: 'var(--an-bom)', rotulo: tx('Livre para você') },
        ...(semDinheiro.length ? [{ cor: 'var(--an-ruim)', rotulo: tx('Falta dinheiro') }] : []),
      ]} />
    </div>
  )
}

/** A legenda das cores: cada cor com o que ela quer dizer, em palavras. */
function Legenda({ itens }: { itens: { cor: string; rotulo: string }[] }) {
  return (
    <ul className="legenda">
      {itens.map((x) => <li key={x.rotulo}><i style={{ '--c': x.cor } as CSSProperties} />{x.rotulo}</li>)}
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
      <Legenda itens={[
        { cor: 'var(--an-neutro)', rotulo: tx('Pagando só as parcelas') },
        ...(v.itens.some((x) => x.fimComPlano !== null && x.fimComPlano < x.fim) ? [{ cor: 'var(--an-bom)', rotulo: tx('Com o plano (acaba antes)') }] : []),
      ]} />
    </div>
  )
}

// ---------- pote (reserva) ----------

function Pote({ atual, maximo, marcos, legenda }: { atual: number; maximo: number; marcos: { rotulo: string; valor: number }[]; legenda: string }) {
  const p = Math.min(1, atual / Math.max(1, maximo))
  return (
    <div className="rsv">
      <div className="rsv-vidro" style={{ '--n': `${p * 100}%` } as CSSProperties}>
        <i className="rsv-agua" />
        {marcos.map((m) => (
          <span key={m.rotulo} className="rsv-marco" style={{ bottom: `${Math.min(100, (m.valor / Math.max(1, maximo)) * 100)}%` }}><small>{m.rotulo}</small></span>
        ))}
      </div>
      <div className="rsv-numeros">
        <strong><Numero valor={atual} formato={fmtValor} /></strong>
        <small>{legenda}</small>
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

// ---------- os desenhos que o compositor escolhe (lib/composicao.ts) ----------

/** As partes em porcentagens inteiras que somam 100 (o que sobra do arredondamento vai para quem perdeu mais). */
function porCento(fatias: Fatia[]): number[] {
  const total = fatias.reduce((s, f) => s + Math.max(0, f.valor), 0)
  if (total <= 0) return fatias.map(() => 0)
  const exatos = fatias.map((f) => (Math.max(0, f.valor) / total) * 100)
  const inteiros = exatos.map(Math.floor)
  let falta = 100 - inteiros.reduce((s, n) => s + n, 0)
  const ordem = exatos.map((x, i) => ({ i, resto: x - Math.floor(x) })).sort((a, b) => b.resto - a.resto)
  for (const { i } of ordem) {
    if (falta <= 0) break
    inteiros[i]++
    falta--
  }
  return inteiros
}

function LegendaDasPartes({ fatias, pcts, ideal }: { fatias: Fatia[]; pcts: number[]; ideal?: Fatia[] }) {
  return (
    <ul className="rosca-legenda partes-legenda">
      {fatias.map((f, i) => (
        <li key={f.rotulo}>
          <i style={{ background: f.cor }} />
          <span>{f.rotulo}</span>
          <b>{pcts[i]}%</b>
          {ideal && <small>{tx('ideal {0}', fmtPct(ideal[i]?.valor ?? 0))}</small>}
        </li>
      ))}
    </ul>
  )
}

/** 100 quadradinhos: cada um é 1% do todo. Enchem em onda, uma cor de cada vez. */
function Quadradinhos({ fatias, ideal }: { fatias: Fatia[]; ideal?: Fatia[] }) {
  const pcts = porCento(fatias)
  const cores = pcts.flatMap((n, i) => Array.from({ length: n }, () => fatias[i].cor))
  return (
    <div className="quadradinhos">
      <div className="quadradinhos-grade" role="img" aria-label={fatias.map((f, i) => `${f.rotulo}: ${pcts[i]}%`).join(', ')}>
        {Array.from({ length: 100 }, (_, i) => <i key={i} style={{ '--i': i, background: cores[i] ?? 'var(--preench-3)' } as CSSProperties} />)}
      </div>
      <LegendaDasPartes fatias={fatias} pcts={pcts} ideal={ideal} />
    </div>
  )
}

/** Uma barra só, dividida nas partes; a legenda diz quanto é cada uma. */
function Faixa({ fatias, ideal }: { fatias: Fatia[]; ideal?: Fatia[] }) {
  const pcts = porCento(fatias)
  return (
    <div className="faixa">
      <div className="faixa-barra" role="img" aria-label={fatias.map((f, i) => `${f.rotulo}: ${pcts[i]}%`).join(', ')}>
        {fatias.map((f, i) => pcts[i] > 0 && (
          <i key={f.rotulo} style={{ '--i': i, flexGrow: pcts[i], background: f.cor } as CSSProperties}>{pcts[i] >= 12 && <b>{pcts[i]}%</b>}</i>
        ))}
      </div>
      <LegendaDasPartes fatias={fatias} pcts={pcts} ideal={ideal} />
    </div>
  )
}

/** Dois valores frente a frente: duas colunas que sobem e, no meio, a diferença. */
function Duelo({ lados, selo, tom }: { lados: [LadoDoDuelo, LadoDoDuelo]; selo: string; tom: Tom }) {
  const max = Math.max(1, ...lados.map((l) => Math.abs(l.valor)))
  return (
    <div className="duelo">
      {lados.map((l, i) => (
        <div key={i} className="duelo-lado" style={{ '--i': i, '--c': l.cor } as CSSProperties}>
          <b>{fmtCurto(l.valor)}</b>
          <span className="duelo-coluna"><i style={{ height: `${Math.max(3, (Math.abs(l.valor) / max) * 100)}%` }} /></span>
          <small>{l.rotulo}</small>
        </div>
      ))}
      {selo && <span className="duelo-selo" style={{ '--c': COR_DO_TOM[tom] } as CSSProperties}>{selo}</span>}
    </div>
  )
}

const FORMATO: Record<FormatoDoNumero, (n: number) => string> = {
  dinheiro: fmtValor,
  pct: (n) => fmtPct(n),
  inteiro: (n) => String(Math.round(n)),
}

/** Um número só, bem grande, contando até o valor; embaixo, a história dele em colunas pequenas (se houver). */
function Numerao({ valor, formato, legenda, faisca, cor }: { valor: number; formato: FormatoDoNumero; legenda: string; faisca?: Ponto[]; cor: string }) {
  const max = Math.max(1, ...(faisca ?? []).map((p) => Math.abs(p.valor)))
  return (
    <div className="numerao" style={{ '--c': cor } as CSSProperties}>
      <strong><Numero valor={valor} formato={FORMATO[formato]} duracao={1600} /></strong>
      <span>{legenda}</span>
      {formato === 'pct' && <span className="numerao-barra"><i style={{ width: `${Math.max(0, Math.min(1, valor)) * 100}%` }} /></span>}
      {faisca && faisca.length >= 2 && (
        <div className="numerao-faisca" aria-hidden="true">
          {faisca.map((p, i) => (
            <span key={i} className={p.valor >= 0 ? 'pos' : 'neg'} style={{ '--i': i } as CSSProperties} title={`${p.rotulo}: ${fmtValor(p.valor)}`}>
              <i style={{ height: `${Math.max(8, (Math.abs(p.valor) / max) * 100)}%` }} />
              <small>{p.rotulo}</small>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/** Os três maiores num pódio (o maior no meio); do quarto em diante, em linha. */
function Podio({ itens }: { itens: { rotulo: string; valor: number; icone?: string }[] }) {
  const tres = itens.slice(0, 3)
  const max = Math.max(1, tres[0]?.valor ?? 1)
  // a ordem do pódio na tela: 2º, 1º, 3º
  const ordem = [1, 0, 2].filter((i) => tres[i])
  return (
    <div className="podio">
      <div className="podio-degraus">
        {ordem.map((i) => (
          <div key={i} className={`podio-lugar lugar-${i + 1}`} style={{ '--i': i } as CSSProperties}>
            <span className="podio-nome">{tres[i].icone && <span>{tres[i].icone}</span>} {tres[i].rotulo}</span>
            <b>{fmtCurto(tres[i].valor)}</b>
            <i style={{ height: `${Math.max(28, (tres[i].valor / max) * 100)}%` }}><em>{i + 1}</em></i>
          </div>
        ))}
      </div>
      {itens.length > 3 && (
        <ul className="podio-resto">
          {itens.slice(3).map((x, i) => <li key={`${x.rotulo}${i}`}><span>{i + 4}. {x.rotulo}</span><b>{fmtCurto(x.valor)}</b></li>)}
        </ul>
      )}
    </div>
  )
}

/** Uma trilha de 0 ao alvo: a barra anda até onde a pessoa está e os marcos ficam no caminho. */
function Trilha({ atual, maximo, marcos, legenda, cor }: { atual: number; maximo: number; marcos: { rotulo: string; valor: number }[]; legenda: string; cor: string }) {
  const base = Math.max(1, maximo)
  const p = Math.max(0, Math.min(1, atual / base))
  return (
    <div className="trilha" style={{ '--c': cor, '--p': p } as CSSProperties}>
      <div className="trilha-numeros">
        <span className="trilha-valor"><strong><Numero valor={atual} formato={fmtValor} /></strong><small>{legenda}</small></span>
        <span>{fmtPct(p)}</span>
      </div>
      <div className="trilha-barra">
        <i className="trilha-feito" />
        {marcos.map((m) => <i key={m.rotulo} className={`trilha-marco ${atual >= m.valor ? 'ok' : ''}`} style={{ left: `${Math.max(0, Math.min(1, m.valor / base)) * 100}%` }} />)}
        <i className="trilha-ponto" />
      </div>
      <ul className="trilha-marcos">
        {marcos.map((m) => (
          <li key={m.rotulo} className={atual >= m.valor ? 'ok' : ''}>
            <Icone nome={atual >= m.valor ? 'check' : 'meta'} tamanho={14} /> {m.rotulo}: {fmtCurto(m.valor)}
          </li>
        ))}
      </ul>
    </div>
  )
}
