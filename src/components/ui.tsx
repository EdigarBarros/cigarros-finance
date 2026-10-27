import { useEffect, useRef, useState, type ReactNode } from 'react'
import { fmtPct, paraCampo, parseNumero } from '../lib/format'
import { estiloLente, useLente } from '../lib/useLente'
import { Icone } from './Icone'

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

/** Indicador do topo: valor grande, marcador de cor e variação contra o mês anterior. */
export function Kpi({ rotulo, valor, cor, delta, menorMelhor, contra = 'no mês passado', children }: {
  rotulo: string; valor: string; cor: string; delta?: number | null; menorMelhor?: boolean
  /** Com o que se compara, depois de "que": "em set", "no mês passado". */
  contra?: string; children?: ReactNode
}) {
  const bom = delta == null ? null : menorMelhor ? delta <= 0 : delta >= 0
  return (
    <div className="kpi" style={{ '--c': cor } as React.CSSProperties}>
      <span className="kpi-rotulo"><i className="marcador" />{rotulo}</span>
      <strong className="kpi-valor">{valor}</strong>
      {delta != null && (
        <span className={`kpi-delta ${bom ? 'bom' : 'ruim'}`}>
          <Icone nome={delta >= 0 ? 'sobe' : 'desce'} tamanho={12} />
          {fmtPct(Math.abs(delta))} {delta >= 0 ? 'a mais' : 'a menos'} que {contra}
        </span>
      )}
      {children}
    </div>
  )
}

export function Progresso({ valor, total, cor }: { valor: number; total: number; cor: string }) {
  const p = total > 0 ? Math.min(1, Math.max(0, valor / total)) : 0
  return (
    <div className="progresso" role="progressbar" aria-valuenow={Math.round(p * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div style={{ width: `${p * 100}%`, background: cor }} />
    </div>
  )
}

export function Modal({ titulo, aoFechar, children }: { titulo: string; aoFechar: () => void; children: ReactNode }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [aoFechar])
  return (
    <div className="modal-fundo" onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={titulo}>
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
