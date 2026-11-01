import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { LOCAL_DAS_DATAS, MESES_CURTO, MESES_NOME, fmtDataLonga } from '../lib/format'
import { tx } from '../lib/textos'
import { useMobile } from '../lib/useMobile'
import { Icone } from './Icone'

/*
 * As peças de escolher do app: lista de opções, data, mês e sugestões ao digitar. Substituem o <select>, o
 * <input type="date|month"> e o <datalist> do navegador, que abriam aquelas telas cinzas do sistema, fora do visual do
 * OpusCash. No computador abrem como um quadro preso ao campo; no celular sobem como folha, igual às janelas do app.
 */

const dois = (n: number) => String(n).padStart(2, '0')
const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const hojeIso = () => { const d = new Date(); return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}` }

interface Posicao { left: number; width: number; maxH: number; top?: number; bottom?: number }

/** Onde o quadro aparece: embaixo do campo, ou em cima quando falta lugar; acompanha a rolagem. */
function usePosicao(ancora: RefObject<HTMLElement | null>, aberto: boolean, largura: number, altura: number, fixa: boolean) {
  const [pos, setPos] = useState<Posicao | null>(null)
  useLayoutEffect(() => {
    if (!aberto) return
    const calcular = () => {
      const el = ancora.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const vw = window.innerWidth, vh = window.innerHeight
      const width = Math.min(fixa ? largura : Math.max(r.width, largura), vw - 16)
      const left = Math.min(Math.max(8, r.left), vw - width - 8)
      const embaixo = vh - r.bottom - 14, emCima = r.top - 14
      const sobe = embaixo < Math.min(altura, 260) && emCima > embaixo
      const maxH = Math.max(160, Math.min(altura, sobe ? emCima : embaixo))
      setPos(sobe ? { left, width, maxH, bottom: vh - r.top + 6 } : { left, width, maxH, top: r.bottom + 6 })
    }
    calcular()
    window.addEventListener('resize', calcular)
    window.addEventListener('scroll', calcular, true)
    return () => { window.removeEventListener('resize', calcular); window.removeEventListener('scroll', calcular, true) }
  }, [aberto, ancora, largura, altura, fixa])
  return pos
}

/**
 * O quadro que abre por cima de tudo (até das janelas). `folha`: no celular sobe de baixo, com alça e título.
 * Fecha com Esc, tocando fora ou com `aoFechar`; ao fechar, o foco volta para o campo.
 */
function Quadro({ ancora, aoFechar, titulo, largura = 0, larguraFixa, altura = 360, folha = true, foco = true, children, className = '' }: {
  ancora: RefObject<HTMLElement | null>; aoFechar: () => void; titulo: string; largura?: number; larguraFixa?: boolean; altura?: number
  folha?: boolean; foco?: boolean; children: ReactNode; className?: string
}) {
  const mobile = useMobile()
  const comoFolha = folha && mobile
  const pos = usePosicao(ancora, !comoFolha, largura, altura, Boolean(larguraFixa))
  const caixa = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ancora.current
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); aoFechar() } }
    // em captura: o Esc fecha só o quadro, não a janela que está atrás dele
    window.addEventListener('keydown', esc, true)
    if (foco) requestAnimationFrame(() => caixa.current?.querySelector<HTMLElement>('[data-foco]')?.focus({ preventScroll: true }))
    return () => { window.removeEventListener('keydown', esc, true); if (foco) el?.focus({ preventScroll: true }) }
  }, [aoFechar, ancora, foco])

  if (comoFolha) {
    return createPortal(
      <div className="escolha-fundo" onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
        <div ref={caixa} className={`escolha-folha ${className}`} role="dialog" aria-modal="true" aria-label={titulo}>
          <span className="alca" aria-hidden="true" />
          <header className="escolha-folha-topo">
            <strong>{titulo}</strong>
            <button type="button" className="icone-btn" onClick={aoFechar} aria-label={tx('Fechar')}><Icone nome="fechar" tamanho={18} /></button>
          </header>
          {children}
        </div>
      </div>,
      document.body,
    )
  }
  if (!pos) return null
  return createPortal(
    <>
      <div className="escolha-fora" onMouseDown={aoFechar} />
      <div ref={caixa} className={`escolha-quadro ${pos.bottom != null ? 'acima' : ''} ${className}`} role="dialog" aria-label={titulo}
        style={{ left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom, maxHeight: pos.maxH }}
        onMouseDown={(e) => e.preventDefault()}>
        {children}
      </div>
    </>,
    document.body,
  )
}

/* ---------------------------------------------------------------- lista de opções */

export interface OpcaoEscolha {
  valor: string
  rotulo: string
  /** Texto menor à direita (um valor, um aviso). */
  detalhe?: string
  desativado?: boolean
  /** Bolinha de cor antes do nome (a cor do banco, por exemplo). */
  cor?: string
  /** Título da seção em que a opção aparece (as opções do mesmo grupo vêm juntas). */
  grupo?: string
  /** Como a opção aparece na grade (ex.: "5"), quando o nome inteiro vai no campo ("dia 5"). */
  curto?: string
}

/**
 * Lista de opções no lugar do <select>. Teclado: setas, Enter, Esc e começar a digitar um nome. Com muitas opções, ganha
 * uma busca no topo. `className` vai no botão (para quem já tinha um estilo próprio, como os filtros de Lançamentos).
 */
export function Seletor({ valor, opcoes, aoMudar, rotulo, className = '', placeholder, desativado, grade }: {
  valor: string; opcoes: OpcaoEscolha[]; aoMudar: (v: string) => void; rotulo: string
  className?: string; placeholder?: string; desativado?: boolean
  /** Opções curtas (os dias do mês) em grade de 7 colunas, como um calendário, em vez de uma lista comprida. */
  grade?: boolean
}) {
  const [aberto, setAberto] = useState(false)
  const botao = useRef<HTMLButtonElement>(null)
  const atual = opcoes.find((o) => o.valor === valor)
  return (
    <>
      <button ref={botao} type="button" className={`escolha-gatilho ${className}`} aria-haspopup="listbox" aria-expanded={aberto}
        aria-label={atual ? `${rotulo}: ${atual.rotulo}` : rotulo} disabled={desativado}
        onClick={() => setAberto(!aberto)}
        onKeyDown={(e) => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setAberto(true) } }}>
        {atual?.cor && <i className="escolha-cor" style={{ background: atual.cor }} />}
        <span className={`escolha-texto ${atual ? '' : 'vazio'}`}>{atual ? atual.rotulo : placeholder ?? tx('Escolher…')}</span>
        {atual?.detalhe && <small className="escolha-detalhe">{atual.detalhe}</small>}
        <Icone nome="abaixo" tamanho={16} />
      </button>
      {aberto && (
        <Quadro ancora={botao} aoFechar={() => setAberto(false)} titulo={rotulo} largura={grade ? 312 : 220} larguraFixa={grade}>
          <ListaOpcoes opcoes={opcoes} valor={valor} rotulo={rotulo} grade={grade} aoEscolher={(v) => { setAberto(false); aoMudar(v) }} />
        </Quadro>
      )}
    </>
  )
}

function ListaOpcoes({ opcoes, valor, rotulo, grade, aoEscolher }: { opcoes: OpcaoEscolha[]; valor: string; rotulo: string; grade?: boolean; aoEscolher: (v: string) => void }) {
  const [busca, setBusca] = useState('')
  const comBusca = opcoes.length > 10
  const visiveis = useMemo(() => {
    const t = semAcento(busca.trim())
    return t ? opcoes.filter((o) => semAcento(o.rotulo).includes(t)) : opcoes
  }, [busca, opcoes])
  const [realce, setRealce] = useState(() => Math.max(0, opcoes.findIndex((o) => o.valor === valor)))
  const lista = useRef<HTMLUListElement>(null)
  const digitado = useRef({ texto: '', ate: 0 })
  const id = useId()

  useEffect(() => {
    lista.current?.querySelector<HTMLElement>(`[data-i="${realce}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [realce])

  const mover = (passo: number) => {
    if (!visiveis.length) return
    let i = realce
    for (let n = 0; n < visiveis.length; n++) {
      i = (i + passo + visiveis.length) % visiveis.length
      if (!visiveis[i].desativado) break
    }
    setRealce(i)
  }
  const teclas = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); mover(grade ? 7 : 1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); mover(grade ? -7 : -1) }
    else if (grade && e.key === 'ArrowRight') { e.preventDefault(); mover(1) }
    else if (grade && e.key === 'ArrowLeft') { e.preventDefault(); mover(-1) }
    else if (e.key === 'Home') { e.preventDefault(); setRealce(0) }
    else if (e.key === 'End') { e.preventDefault(); setRealce(visiveis.length - 1) }
    else if (e.key === 'Enter' || (e.key === ' ' && !comBusca)) {
      e.preventDefault()
      const o = visiveis[realce]
      if (o && !o.desativado) aoEscolher(o.valor)
    } else if (!comBusca && e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      // começar a digitar pula para a opção com esse nome
      const agora = Date.now()
      digitado.current = { texto: (agora < digitado.current.ate ? digitado.current.texto : '') + semAcento(e.key), ate: agora + 700 }
      const i = visiveis.findIndex((o) => !o.desativado && semAcento(o.rotulo).startsWith(digitado.current.texto))
      if (i >= 0) setRealce(i)
    }
  }

  return (
    <div className="escolha-lista-caixa" onKeyDown={teclas}>
      {comBusca && (
        <div className="escolha-busca">
          <Icone nome="busca" tamanho={16} />
          <input data-foco type="text" value={busca} placeholder={tx('Buscar…')} aria-label={tx('Buscar')} aria-controls={id}
            onChange={(e) => { setBusca(e.target.value); setRealce(0) }} autoComplete="off" />
        </div>
      )}
      <ul ref={lista} id={id} className={`escolha-lista ${grade ? 'grade' : ''}`} role="listbox" aria-label={rotulo} tabIndex={comBusca ? -1 : 0}
        data-foco={comBusca ? undefined : true} aria-activedescendant={visiveis[realce] ? `${id}-${realce}` : undefined}>
        {visiveis.map((o, i) => [
          o.grupo && o.grupo !== visiveis[i - 1]?.grupo && <li key={`g${i}`} className="escolha-grupo" role="presentation">{o.grupo}</li>,
          <li key={o.valor} id={`${id}-${i}`} data-i={i} role="option" aria-selected={o.valor === valor} aria-disabled={o.desativado || undefined}
            className={`${o.valor === valor ? 'ativo' : ''} ${i === realce ? 'realce' : ''} ${o.desativado ? 'desativado' : ''}`}
            onMouseMove={() => i !== realce && !o.desativado && setRealce(i)}
            onClick={() => !o.desativado && aoEscolher(o.valor)}>
            {o.cor && <i className="escolha-cor" style={{ background: o.cor }} />}
            <span className="escolha-nome">{grade && o.curto ? o.curto : o.rotulo}</span>
            {o.detalhe && <small>{o.detalhe}</small>}
            {o.valor === valor && <Icone nome="check" tamanho={16} />}
          </li>,
        ])}
        {!visiveis.length && <li className="escolha-vazio" role="presentation">{tx('Nada encontrado')}</li>}
      </ul>
    </div>
  )
}

/* ---------------------------------------------------------------- data */

// "D S T Q Q S S" (ou "S M T W T F S"), na língua da tela, começando no domingo
const SEMANA = Array.from({ length: 7 }, (_, i) =>
  new Intl.DateTimeFormat(LOCAL_DAS_DATAS, { weekday: 'narrow', timeZone: 'UTC' }).format(Date.UTC(2026, 10, 1 + i)).toUpperCase())

/** "2 de outubro" no ano corrente; "2 de outubro de 2025" (ou "October 2, 2025") nos outros. */
function textoDaData(iso: string) {
  const ano = Number(iso.slice(0, 4))
  return ano === new Date().getFullYear() ? fmtDataLonga(iso) : tx('{0} de {1} (data com ano)', fmtDataLonga(iso), ano).replace(' (data com ano)', '')
}

/**
 * Campo de data no lugar do <input type="date">: o botão mostra a data por extenso e abre o calendário do mês, no mesmo
 * jeito do "Dia a dia" de Lançamentos. `min`/`max` (aaaa-mm-dd) apagam os dias de fora. Sem `obrigatorio`, dá para limpar.
 */
export function CampoData({ valor, aoMudar, rotulo, min, max, obrigatorio, className = '' }: {
  valor: string; aoMudar: (v: string) => void; rotulo: string; min?: string; max?: string; obrigatorio?: boolean; className?: string
}) {
  const [aberto, setAberto] = useState(false)
  const botao = useRef<HTMLButtonElement>(null)
  return (
    <>
      <button ref={botao} type="button" className={`escolha-gatilho data ${className}`} aria-haspopup="dialog" aria-expanded={aberto}
        aria-label={valor ? `${rotulo}: ${textoDaData(valor)}` : rotulo} onClick={() => setAberto(!aberto)}>
        <span className={`escolha-texto ${valor ? '' : 'vazio'}`}>{valor ? textoDaData(valor) : tx('Escolher data')}</span>
        <Icone nome="calendario" tamanho={16} />
      </button>
      {obrigatorio && <input className="escolha-obrigatorio" tabIndex={-1} aria-hidden="true" value={valor} required onChange={() => {}}
        onInvalid={() => setAberto(true)} />}
      {aberto && (
        <Quadro ancora={botao} aoFechar={() => setAberto(false)} titulo={rotulo} largura={312} larguraFixa altura={400}>
          <Calendario valor={valor} min={min} max={max} obrigatorio={obrigatorio}
            aoEscolher={(v) => { setAberto(false); aoMudar(v) }} />
        </Quadro>
      )}
    </>
  )
}

function Calendario({ valor, min, max, obrigatorio, aoEscolher }: {
  valor: string; min?: string; max?: string; obrigatorio?: boolean; aoEscolher: (v: string) => void
}) {
  const hoje = hojeIso()
  const base = valor || (max && hoje > max ? max : min && hoje < min ? min : hoje)
  const [ano, setAno] = useState(Number(base.slice(0, 4)))
  const [mes, setMes] = useState(Number(base.slice(5, 7)))
  const [realce, setRealce] = useState(base)
  const grade = useRef<HTMLDivElement>(null)

  const fora = (iso: string) => Boolean((min && iso < min) || (max && iso > max))
  const primeiroDia = new Date(ano, mes - 1, 1).getDay()
  const diasNoMes = new Date(ano, mes, 0).getDate()
  const mesMin = min?.slice(0, 7), mesMax = max?.slice(0, 7), esteMes = `${ano}-${dois(mes)}`

  const irPara = (iso: string) => {
    setRealce(iso)
    setAno(Number(iso.slice(0, 4)))
    setMes(Number(iso.slice(5, 7)))
  }
  const andarMes = (passo: number) => {
    const d = new Date(ano, mes - 1 + passo, 1)
    setAno(d.getFullYear())
    setMes(d.getMonth() + 1)
  }
  const somarDias = (iso: string, n: number) => {
    const [a, m, d] = iso.split('-').map(Number)
    const x = new Date(a, m - 1, d + n)
    return `${x.getFullYear()}-${dois(x.getMonth() + 1)}-${dois(x.getDate())}`
  }
  const teclas = (e: React.KeyboardEvent) => {
    const passos: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }
    if (e.key in passos) { e.preventDefault(); irPara(somarDias(realce, passos[e.key])) }
    else if (e.key === 'PageUp' || e.key === 'PageDown') { e.preventDefault(); andarMes(e.key === 'PageUp' ? -1 : 1) }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!fora(realce)) aoEscolher(realce) }
  }
  useEffect(() => { grade.current?.querySelector<HTMLElement>('[tabindex="0"]')?.focus({ preventScroll: true }) }, [realce])

  return (
    <div className="calendario">
      <div className="calendario-topo">
        <button type="button" className="icone-btn" onClick={() => andarMes(-1)} disabled={Boolean(mesMin && esteMes <= mesMin)} aria-label={tx('Mês anterior')}>
          <Icone nome="esq" tamanho={18} />
        </button>
        <strong aria-live="polite">{MESES_NOME[mes - 1]} <span>{ano}</span></strong>
        <button type="button" className="icone-btn" onClick={() => andarMes(1)} disabled={Boolean(mesMax && esteMes >= mesMax)} aria-label={tx('Próximo mês')}>
          <Icone nome="dir" tamanho={18} />
        </button>
      </div>
      <div className="calendario-semana" aria-hidden="true">{SEMANA.map((s, i) => <span key={i}>{s}</span>)}</div>
      <div ref={grade} className="calendario-dias" role="grid" onKeyDown={teclas}>
        {Array.from({ length: primeiroDia }, (_, i) => <span key={`v${i}`} />)}
        {Array.from({ length: diasNoMes }, (_, i) => {
          const iso = `${esteMes}-${dois(i + 1)}`
          const desligado = fora(iso)
          return (
            <button key={iso} type="button" role="gridcell" data-foco={iso === realce || undefined} tabIndex={iso === realce ? 0 : -1}
              className={`${iso === valor ? 'ativo' : ''} ${iso === hoje ? 'hoje' : ''}`} disabled={desligado}
              aria-selected={iso === valor} aria-label={textoDaData(iso)}
              onClick={() => aoEscolher(iso)}>
              {i + 1}
            </button>
          )
        })}
      </div>
      <div className="calendario-rodape">
        {!fora(hoje) && <button type="button" className="chip" onClick={() => aoEscolher(hoje)}>{tx('Hoje')}</button>}
        {!fora(somarDias(hoje, -1)) && <button type="button" className="chip" onClick={() => aoEscolher(somarDias(hoje, -1))}>{tx('Ontem')}</button>}
        {!obrigatorio && valor && <button type="button" className="link" onClick={() => aoEscolher('')}>{tx('Limpar')}</button>}
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- mês */

/** Campo de mês no lugar do <input type="month">: os 12 meses em grade, como o seletor de mês do topo. */
export function CampoMes({ valor, aoMudar, rotulo, min, obrigatorio, className = '' }: {
  valor: string; aoMudar: (v: string) => void; rotulo: string; min?: string; obrigatorio?: boolean; className?: string
}) {
  const [aberto, setAberto] = useState(false)
  const botao = useRef<HTMLButtonElement>(null)
  const texto = valor ? `${MESES_NOME[Number(valor.slice(5, 7)) - 1]} ${valor.slice(0, 4)}` : ''
  return (
    <>
      <button ref={botao} type="button" className={`escolha-gatilho data ${className}`} aria-haspopup="dialog" aria-expanded={aberto}
        aria-label={texto ? `${rotulo}: ${texto}` : rotulo} onClick={() => setAberto(!aberto)}>
        <span className={`escolha-texto ${valor ? '' : 'vazio'}`}>{texto || tx('Escolher mês')}</span>
        <Icone nome="calendario" tamanho={16} />
      </button>
      {obrigatorio && <input className="escolha-obrigatorio" tabIndex={-1} aria-hidden="true" value={valor} required onChange={() => {}}
        onInvalid={() => setAberto(true)} />}
      {aberto && (
        <Quadro ancora={botao} aoFechar={() => setAberto(false)} titulo={rotulo} largura={300} larguraFixa altura={300}>
          <GradeMeses valor={valor} min={min} obrigatorio={obrigatorio} aoEscolher={(v) => { setAberto(false); aoMudar(v) }} />
        </Quadro>
      )}
    </>
  )
}

function GradeMeses({ valor, min, obrigatorio, aoEscolher }: { valor: string; min?: string; obrigatorio?: boolean; aoEscolher: (v: string) => void }) {
  const agora = hojeIso().slice(0, 7)
  const [ano, setAno] = useState(Number((valor || (min && agora < min ? min : agora)).slice(0, 4)))
  const anoMin = min ? Number(min.slice(0, 4)) : -Infinity
  return (
    <div className="calendario meses">
      <div className="calendario-topo">
        <button type="button" className="icone-btn" onClick={() => setAno(ano - 1)} disabled={ano <= anoMin} aria-label={tx('Ano anterior')}>
          <Icone nome="esq" tamanho={18} />
        </button>
        <strong aria-live="polite">{ano}</strong>
        <button type="button" className="icone-btn" onClick={() => setAno(ano + 1)} aria-label={tx('Próximo ano')}><Icone nome="dir" tamanho={18} /></button>
      </div>
      <div className="calendario-meses">
        {MESES_CURTO.map((nome, i) => {
          const iso = `${ano}-${dois(i + 1)}`
          return (
            <button key={iso} type="button" className={`${iso === valor ? 'ativo' : ''} ${iso === agora ? 'hoje' : ''}`}
              data-foco={iso === (valor || agora) || undefined} disabled={Boolean(min && iso < min)}
              aria-pressed={iso === valor} aria-label={`${MESES_NOME[i]} ${ano}`} onClick={() => aoEscolher(iso)}>
              {nome}
            </button>
          )
        })}
      </div>
      {!obrigatorio && valor && (
        <div className="calendario-rodape"><button type="button" className="link" onClick={() => aoEscolher('')}>{tx('Limpar')}</button></div>
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- sugestões ao digitar */

/**
 * Campo de texto com sugestões embaixo enquanto se digita, no lugar do <datalist> (que abria a lista cinza do navegador).
 * Setas escolhem, Enter preenche, Esc fecha.
 */
export function CampoSugestoes({ valor, aoMudar, sugestoes, placeholder, rotulo, maxLength }: {
  valor: string; aoMudar: (v: string) => void; sugestoes: string[]; placeholder?: string; rotulo: string; maxLength?: number
}) {
  const campo = useRef<HTMLInputElement>(null)
  const [focado, setFocado] = useState(false)
  const [fechado, setFechado] = useState(false)
  const [realce, setRealce] = useState(-1)
  const id = useId()
  const lista = useMemo(() => {
    const t = semAcento(valor.trim())
    const todas = t ? sugestoes.filter((s) => semAcento(s).includes(t) && semAcento(s) !== t) : sugestoes
    return todas.slice(0, 6)
  }, [valor, sugestoes])
  const aberto = focado && !fechado && lista.length > 0

  const escolher = (s: string) => { aoMudar(s); setFechado(true); setRealce(-1) }
  return (
    <>
      <input ref={campo} value={valor} placeholder={placeholder} aria-label={rotulo} maxLength={maxLength} autoComplete="off"
        role="combobox" aria-expanded={aberto} aria-controls={id} aria-autocomplete="list"
        aria-activedescendant={aberto && realce >= 0 ? `${id}-${realce}` : undefined}
        onChange={(e) => { aoMudar(e.target.value); setFechado(false); setRealce(-1) }}
        onFocus={() => setFocado(true)} onBlur={() => { setFocado(false); setFechado(false); setRealce(-1) }}
        onKeyDown={(e) => {
          if (!aberto) return
          if (e.key === 'ArrowDown') { e.preventDefault(); setRealce((realce + 1) % lista.length) }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setRealce((realce - 1 + lista.length) % lista.length) }
          else if (e.key === 'Enter' && realce >= 0) { e.preventDefault(); escolher(lista[realce]) }
          else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setFechado(true) }
        }} />
      {aberto && (
        <Quadro ancora={campo} aoFechar={() => setFechado(true)} titulo={rotulo} folha={false} foco={false} largura={220} altura={280}
          className="sugestoes">
          <ul id={id} className="escolha-lista" role="listbox" aria-label={rotulo}>
            {lista.map((s, i) => (
              <li key={s} id={`${id}-${i}`} role="option" aria-selected={i === realce} className={i === realce ? 'realce' : ''}
                onMouseDown={(e) => e.preventDefault()} onClick={() => escolher(s)}>
                <Icone nome="historico" tamanho={15} />
                <span className="escolha-nome">{s}</span>
              </li>
            ))}
          </ul>
        </Quadro>
      )}
    </>
  )
}
