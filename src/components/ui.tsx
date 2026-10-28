import { useEffect, useRef, useState, type ReactNode } from 'react'
import { fmtPct, fmtValor, paraCampo, parseNumero } from '../lib/format'
import { estiloLente, useLente } from '../lib/useLente'
import { Icone } from './Icone'
import { Numero } from './Numero'

export function Cartao({ titulo, acao, children, className = '' }: {
  titulo?: ReactNode; acao?: ReactNode; children: ReactNode; className?: string
}) {
  return (
    <section className={`cartao ${className}`}>
      {(titulo || acao) && (
        <header className="cartao-topo">
          {titulo && <h2>{titulo}</h2>}
          {acao}
        </header>
      )}
      {children}
    </section>
  )
}

/**
 * Indicador do topo: ícone redondo, valor grande (que conta até o número quando é number) e variação contra o mês anterior.
 * `destaque` pinta o cartão inteiro com a cor (o resultado do mês).
 */
export function Kpi({ rotulo, valor, cor, icone, destaque, delta, menorMelhor, contra = 'no mês passado', aoClicar, tendencia, children }: {
  rotulo: string; valor: string | number; cor: string; icone?: string; destaque?: boolean
  /** Valores dos últimos meses para a minilinha no canto do cartão. */
  tendencia?: (number | null)[]
  delta?: number | null; menorMelhor?: boolean
  /** Com o que se compara, depois de "que": "em set", "no mês passado". */
  contra?: string; aoClicar?: () => void; children?: ReactNode
}) {
  const bom = delta == null ? null : menorMelhor ? delta <= 0 : delta >= 0
  const conteudo = (
    <>
      {icone && <span className="kpi-icone"><Icone nome={icone} tamanho={22} /></span>}
      {aoClicar && <span className="kpi-seta"><Icone nome="dir" tamanho={18} /></span>}
      {tendencia && <span className="kpi-faisca"><Faisca valores={tendencia} cor={cor} /></span>}
      <span className="kpi-rotulo">{!icone && <i className="marcador" />}{rotulo}</span>
      <strong className="kpi-valor">{typeof valor === 'number' ? <Numero valor={valor} formato={fmtValor} /> : valor}</strong>
      {delta != null && (
        <span className={`kpi-delta ${bom ? 'bom' : 'ruim'}`}>
          <Icone nome={delta >= 0 ? 'sobe' : 'desce'} tamanho={13} />
          {fmtPct(Math.abs(delta))} {delta >= 0 ? 'a mais' : 'a menos'}
          <span>que {contra}</span>
        </span>
      )}
      {children}
    </>
  )
  const estilo = { '--c': cor } as React.CSSProperties
  const classe = `kpi ${destaque ? 'destaque' : ''}`
  return aoClicar
    ? <button type="button" className={classe} style={estilo} onClick={aoClicar}>{conteudo}</button>
    : <div className={classe} style={estilo}>{conteudo}</div>
}

export function Progresso({ valor, total, cor }: { valor: number; total: number; cor: string }) {
  const p = total > 0 ? Math.min(1, Math.max(0, valor / total)) : 0
  return (
    <div className="progresso" role="progressbar" aria-valuenow={Math.round(p * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div style={{ width: `${p * 100}%`, background: cor }} />
    </div>
  )
}

/** `tamanho="grande"`: painel largo no computador e tela cheia no celular (ex.: Configurações). */
export function Modal({ titulo, aoFechar, children, tamanho }: { titulo: string; aoFechar: () => void; children: ReactNode; tamanho?: 'grande' }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [aoFechar])
  return (
    <div className="modal-fundo" onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      <div className={`modal ${tamanho ?? ''}`} role="dialog" aria-modal="true" aria-label={titulo}>
        <span className="alca" aria-hidden="true" />
        <header className="modal-topo">
          <h2>{titulo}</h2>
          <button className="icone-btn" onClick={aoFechar} aria-label="Fechar"><Icone nome="fechar" /></button>
        </header>
        {children}
      </div>
    </div>
  )
}

/** Campo de dinheiro que salva ao sair. Aceita "1.234,56" e contas como "=105,53-60,02". */
export function CampoValor({ valor, aoSalvar, prefixo = 'R$', rotulo }: {
  valor: number; aoSalvar: (n: number) => void; prefixo?: string; rotulo: string
}) {
  const [texto, setTexto] = useState(paraCampo(valor))
  const [erro, setErro] = useState(false)
  const [focado, setFocado] = useState(false)
  if (!focado && texto !== paraCampo(valor) && !erro) setTexto(paraCampo(valor))
  return (
    <label className={`campo-valor ${erro ? 'erro' : ''}`}>
      <span className="campo-rotulo">{rotulo}</span>
      <span className="campo-caixa">
        <span className="prefixo">{prefixo}</span>
        <input
          inputMode="decimal"
          placeholder="0,00"
          value={texto}
          onFocus={(e) => { setFocado(true); e.target.select() }}
          onChange={(e) => { setTexto(e.target.value); setErro(false) }}
          onBlur={() => {
            setFocado(false)
            const n = texto.trim() ? parseNumero(texto) : 0
            if (n === null) return setErro(true)
            setTexto(paraCampo(n))
            if (n !== valor) aoSalvar(n)
          }}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        />
      </span>
    </label>
  )
}

/** Controle segmentado no estilo Apple: uma pílula de vidro desliza até a opção escolhida. */
export function Segmentado<T extends string>({ opcoes, valor, aoMudar, rotulo }: {
  opcoes: { id: T; nome: string; cor?: string }[]; valor: T; aoMudar: (v: T) => void; rotulo: string
}) {
  const caixa = useRef<HTMLDivElement>(null)
  const pilula = useLente(caixa, 'button.ativo', `${valor}|${opcoes.length}`)
  return (
    <div className="segmentado" role="radiogroup" aria-label={rotulo} ref={caixa}>
      {pilula && (
        <span className="segmentado-pilula" aria-hidden="true" style={estiloLente(pilula)} />
      )}
      {opcoes.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={valor === o.id}
          className={valor === o.id ? 'ativo' : ''}
          style={o.cor ? ({ '--c': o.cor } as React.CSSProperties) : undefined}
          onClick={() => aoMudar(o.id)}
        >
          {o.cor && <i className="marcador" />}
          {o.nome}
        </button>
      ))}
    </div>
  )
}

export function Vazio({ children }: { children: ReactNode }) {
  return <p className="vazio">{children}</p>
}

/** Interruptor liga/desliga, como nos Ajustes do iPhone. */
export function Interruptor({ ligado, aoMudar, rotulo }: { ligado: boolean; aoMudar: (v: boolean) => void; rotulo: string }) {
  return (
    <button type="button" role="switch" aria-checked={ligado} aria-label={rotulo} className={`interruptor ${ligado ? 'ligado' : ''}`}
      onClick={() => aoMudar(!ligado)}>
      <span />
    </button>
  )
}

/** Cartão de escolha grande, fácil de tocar (perguntas iniciais e ajustes). */
export function Opcao({ ativo, aoClicar, icone, titulo, texto, multipla }: {
  ativo: boolean; aoClicar: () => void; icone?: string; titulo: ReactNode; texto?: ReactNode
  /** Mostra uma caixa de seleção em vez de um círculo. */
  multipla?: boolean
}) {
  return (
    <button type="button" className={`opcao ${ativo ? 'ativo' : ''}`} onClick={aoClicar}
      role={multipla ? 'checkbox' : 'radio'} aria-checked={ativo}>
      {icone && <span className="opcao-icone">{/^[a-z]+$/.test(icone) ? <Icone nome={icone} /> : icone}</span>}
      <span className="opcao-texto">
        <strong>{titulo}</strong>
        {texto && <small>{texto}</small>}
      </span>
      <span className={`opcao-marca ${multipla ? 'quadrada' : ''}`} aria-hidden="true">{ativo && <Icone nome="check" tamanho={14} />}</span>
    </button>
  )
}

/** Anel de progresso (0 a 1) com o número no meio; desenha-se ao aparecer. */
export function Anel({ valor, cor, tamanho = 64, children }: { valor: number; cor: string; tamanho?: number; children?: ReactNode }) {
  const p = Math.min(1, Math.max(0, valor))
  return (
    <span className="anel" style={{ width: tamanho, height: tamanho, '--c': cor } as React.CSSProperties} role="img" aria-label={`${Math.round(p * 100)}%`}>
      <svg viewBox="0 0 36 36" aria-hidden="true">
        <circle cx="18" cy="18" r="15.5" className="anel-fundo" />
        <circle cx="18" cy="18" r="15.5" className="anel-arco" pathLength={100} strokeDasharray={`${p * 100} 100`} />
      </svg>
      <span className="anel-meio">{children}</span>
    </span>
  )
}

/** Minilinha de tendência (últimos meses), com o último ponto marcado; desenha-se da esquerda para a direita. */
export function Faisca({ valores, cor }: { valores: (number | null)[]; cor: string }) {
  const pts = valores.map((v, i) => [i, v] as const).filter((x): x is readonly [number, number] => x[1] !== null)
  if (pts.length < 2) return null
  const ys = pts.map((x) => x[1])
  const min = Math.min(...ys)
  const max = Math.max(...ys)
  const L = 96
  const A = 34
  const xy = pts.map(([i, v]) => [(i / (valores.length - 1)) * (L - 4) + 2, A - 3 - ((v - min) / (max - min || 1)) * (A - 8)] as const)
  // curva suave passando pelos pontos
  const d = xy.map(([x, y], i) => {
    if (!i) return `M${x.toFixed(1)} ${y.toFixed(1)}`
    const [px, py] = xy[i - 1]
    const cx = (px + x) / 2
    return `C${cx.toFixed(1)} ${py.toFixed(1)} ${cx.toFixed(1)} ${y.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`
  }).join(' ')
  const [ux, uy] = xy[xy.length - 1]
  const id = `faisca-${cor.replace('#', '')}`
  return (
    <svg className="faisca" viewBox={`0 0 ${L} ${A}`} width={L} height={A} aria-hidden="true" style={{ '--c': cor } as React.CSSProperties}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={cor} stopOpacity=".28" />
          <stop offset="1" stopColor={cor} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path className="faisca-area" d={`${d} L${ux.toFixed(1)} ${A} L${xy[0][0].toFixed(1)} ${A}Z`} fill={`url(#${id})`} />
      <path className="faisca-linha" d={d} pathLength={1} />
      <circle className="faisca-ponto" cx={ux} cy={uy} r="2.6" />
    </svg>
  )
}
