/**
 * Peças visuais das telas (Consultor, Dívidas, Metas, Cartões, Contas, Lançamentos, Dinheiro guardado e Ano): o topo de
 * cada tela vira uma vitrine, com um desenho grande, um número só e pílulas com ícone. Embaixo, os gráficos pequenos que se
 * repetem pelas telas: anel, colunas dos meses, trilha até a chegada, linha do tempo e barra dividida.
 *
 * Tudo anima ao aparecer na tela (classe "vivo", via useEmVista) e para quando Configurações → Animações está em Reduzidas.
 * Cada tela escolhe quanto mostrar conforme o jeito de ver (simples, equilibrado ou detalhado): veja
 * docs/arquitetura-do-painel.md, seção 4.21.
 */
import { useId, type CSSProperties, type ReactNode } from 'react'
import type { Detalhe } from '../lib/types'
import { useEmVista } from '../pages/analiseApoio'
import { Icone } from './Icone'
import { Numero } from './Numero'
import './vitrine.css'

export type Nivel = Detalhe

export interface Pilula {
  icone: string
  rotulo: string
  valor: ReactNode
  /** Cor do ícone (variável do tema). */
  cor?: string
  /** Pinta o valor: verde, amarelo ou vermelho. */
  tom?: 'bom' | 'atencao' | 'ruim'
  aoClicar?: () => void
}

/**
 * O topo da tela: desenho grande à esquerda (anel, pote, velocímetro...), o rótulo, o número em destaque e as pílulas.
 * No celular o desenho fica em cima, menor.
 */
export function Vitrine({ cor, visual, rotulo, valor, formato, texto, sub, pilulas, acoes, className = '', children }: {
  cor: string
  visual?: ReactNode
  rotulo: ReactNode
  /** Número que conta até o valor; se vier `texto`, mostra o texto no lugar. */
  valor?: number
  formato?: (n: number) => string
  texto?: ReactNode
  sub?: ReactNode
  pilulas?: Pilula[]
  acoes?: ReactNode
  className?: string
  children?: ReactNode
}) {
  const [ref, vivo] = useEmVista<HTMLElement>()
  return (
    <section ref={ref} className={`cartao vitrine ${vivo ? 'vivo' : ''} ${visual ? '' : 'sem-visual'} ${className}`} style={{ '--c': cor } as CSSProperties}>
      <span className="vitrine-luz" aria-hidden="true"><i /><i /><i /></span>
      {visual && <div className="vitrine-visual">{visual}</div>}
      <div className="vitrine-texto">
        <span className="vitrine-rotulo">{rotulo}</span>
        <strong className="vitrine-valor">
          {texto ?? (valor !== undefined && formato ? <Numero valor={valor} formato={formato} /> : null)}
        </strong>
        {sub && <span className="vitrine-sub">{sub}</span>}
        {pilulas && pilulas.length > 0 && <Pilulas itens={pilulas} />}
        {acoes && <div className="vitrine-acoes">{acoes}</div>}
      </div>
      {children}
    </section>
  )
}

/** Pílulas com ícone: um número pequeno e o nome dele, sem frase. */
export function Pilulas({ itens, className = '' }: { itens: Pilula[]; className?: string }) {
  return (
    <ul className={`pilulas ${className}`}>
      {itens.map((p, i) => {
        const dentro = (
          <>
            <span className="pilula-ic" style={{ '--c': p.cor ?? 'var(--texto-2)' } as CSSProperties}><Icone nome={p.icone} tamanho={16} /></span>
            <span className="pilula-txt"><small>{p.rotulo}</small><b className={p.tom ?? ''}>{p.valor}</b></span>
          </>
        )
        return (
          <li key={i} style={{ '--i': i } as CSSProperties}>
            {p.aoClicar ? <button type="button" className="pilula" onClick={p.aoClicar}>{dentro}<Icone nome="dir" tamanho={14} /></button> : <span className="pilula">{dentro}</span>}
          </li>
        )
      })}
    </ul>
  )
}

/** Anel grande com degradê e brilho; a ponta tem uma bolinha que corre até o valor. */
export function AnelVivo({ valor, cor, cor2, tamanho = 150, espessura = 12, children }: {
  valor: number; cor: string; cor2?: string; tamanho?: number; espessura?: number; children?: ReactNode
}) {
  const id = useId().replace(/:/g, '')
  const p = Math.min(1, Math.max(0, valor))
  const r = 50 - espessura / 2 - 3
  const ang = -90 + p * 360
  const x = 50 + r * Math.cos((ang * Math.PI) / 180)
  const y = 50 + r * Math.sin((ang * Math.PI) / 180)
  return (
    <span className="anel-vivo" style={{ width: tamanho, height: tamanho, '--c': cor, '--p': p } as CSSProperties} role="img" aria-label={`${Math.round(p * 100)}%`}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <defs>
          <linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={cor2 ?? cor} />
            <stop offset="1" stopColor={cor} />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r={r} className="anel-vivo-fundo" strokeWidth={espessura} />
        {p > 0 && <circle cx="50" cy="50" r={r} className="anel-vivo-arco" strokeWidth={espessura} stroke={`url(#${id}-g)`} pathLength={100} strokeDasharray={`${p * 100} 100`} />}
        {p > 0.02 && <circle cx={x} cy={y} r={espessura / 2 - 1.5} className="anel-vivo-ponta" />}
      </svg>
      <span className="anel-vivo-meio">{children}</span>
    </span>
  )
}

/** Meio velocímetro (0 a 1): o arco enche até o valor, com uma bolinha na ponta; o texto fica dentro do arco. */
export function Velocimetro({ valor, cor, children }: { valor: number; cor: string; children?: ReactNode }) {
  const p = Math.min(1, Math.max(0, valor))
  const a = Math.PI - p * Math.PI
  return (
    <span className="velocimetro" style={{ '--c': cor } as CSSProperties}>
      <svg viewBox="0 0 200 112" aria-hidden="true">
        <path className="velocimetro-fundo" d="M18 100 A82 82 0 0 1 182 100" pathLength={100} />
        {p > 0 && <path className="velocimetro-arco" d="M18 100 A82 82 0 0 1 182 100" pathLength={100} strokeDasharray={`${p * 100} 100`} />}
        {Array.from({ length: 11 }, (_, i) => {
          const r = Math.PI - (i / 10) * Math.PI
          return <line key={i} className="velocimetro-risco" x1={100 + 62 * Math.cos(r)} y1={100 - 62 * Math.sin(r)} x2={100 + 68 * Math.cos(r)} y2={100 - 68 * Math.sin(r)} />
        })}
        {p > 0 && <circle className="velocimetro-ponta" cx={100 + 82 * Math.cos(a)} cy={100 - 82 * Math.sin(a)} r="5" />}
      </svg>
      {children && <span className="velocimetro-meio">{children}</span>}
    </span>
  )
}

/** Colunas dos meses (ou dias): a coluna em destaque brilha; cada uma cresce do chão, uma depois da outra. */
export function Colunas({ itens, cor, altura = 150, formato, rotuloDoValor = true }: {
  itens: { rotulo: string; valor: number; destaque?: boolean; cor?: string; titulo?: string; listrado?: boolean }[]
  cor: string; altura?: number; formato: (n: number) => string; rotuloDoValor?: boolean
}) {
  const [ref, vivo] = useEmVista<HTMLDivElement>()
  const maior = Math.max(1, ...itens.map((x) => x.valor))
  return (
    <div ref={ref} className={`vt-colunas ${vivo ? 'vivo' : ''} ${itens.length > 8 ? 'muitas' : ''}`} style={{ '--c': cor, '--alt': `${altura}px`, '--n': itens.length } as CSSProperties}>
      {itens.map((x, i) => (
        <div key={`${x.rotulo}${i}`} className={`vt-col ${x.destaque ? 'destaque' : ''} ${x.valor ? '' : 'vazia'} ${x.listrado ? 'listrado' : ''}`} title={x.titulo}
          style={{ '--i': i, ...(x.cor ? { '--c': x.cor } : {}) } as CSSProperties}>
          {/* com muitas colunas, o valor aparece só na de destaque e na maior (o resto fica no toque) */}
          {rotuloDoValor && <b>{x.valor && (itens.length <= 4 || x.destaque || x.valor === maior) ? formato(x.valor) : '\u00a0'}</b>}
          <span className="vt-col-trilho"><i style={{ height: `${x.valor ? Math.max(5, (x.valor / maior) * 100) : 0}%` }} /></span>
          <small>{x.rotulo}</small>
        </div>
      ))}
    </div>
  )
}

/**
 * A trilha até a chegada: o caminho pintado até onde já foi, um bonequinho (bolinha) no ponto de hoje e a bandeira no fim,
 * com a data. Serve para "livre das dívidas em", "meta chega em".
 */
export function Trilha({ progresso, cor, inicio, fim, marcos = [] }: {
  progresso: number; cor: string; inicio: ReactNode; fim: ReactNode; marcos?: { em: number; rotulo: string }[]
}) {
  const [ref, vivo] = useEmVista<HTMLDivElement>()
  const p = Math.min(1, Math.max(0, progresso))
  return (
    <div ref={ref} className={`vt-trilha ${vivo ? 'vivo' : ''}`} style={{ '--c': cor, '--p': p } as CSSProperties}>
      <div className="vt-trilha-caminho">
        <i className="vt-trilha-feito" />
        {marcos.map((m) => <em key={m.rotulo} className={p >= m.em ? 'passou' : ''} style={{ left: `${m.em * 100}%` }} title={m.rotulo} />)}
        <span className="vt-trilha-voce" />
        <span className="vt-trilha-bandeira"><Icone nome="meta" tamanho={16} /></span>
      </div>
      <div className="vt-trilha-rotulos"><span>{inicio}</span><span>{fim}</span></div>
    </div>
  )
}

/** Linha do tempo: uma barra por item, do começo ao fim, com a data de chegada na ponta. */
export function LinhaDoTempo({ itens, eixo }: {
  itens: { rotulo: string; icone?: ReactNode; cor: string; de: number; ate: number; hoje?: number; fim: string; aoClicar?: () => void }[]
  eixo: [string, string]
}) {
  const [ref, vivo] = useEmVista<HTMLDivElement>()
  return (
    <div ref={ref} className={`vt-tempo ${vivo ? 'vivo' : ''}`}>
      {itens.map((x, i) => {
        const de = Math.min(1, Math.max(0, x.de))
        const ate = Math.min(1, Math.max(de + 0.02, x.ate))
        const hoje = x.hoje === undefined ? null : Math.min(ate, Math.max(de, x.hoje))
        const linha = (
          <>
            <span className="vt-tempo-nome">{x.icone}<span>{x.rotulo}</span></span>
            <span className="vt-tempo-trilho">
              <i className="vt-tempo-barra" style={{ left: `${de * 100}%`, width: `${(ate - de) * 100}%` }} />
              {hoje !== null && <i className="vt-tempo-feito" style={{ left: `${de * 100}%`, width: `${(hoje - de) * 100}%` }} />}
            </span>
            <b className="vt-tempo-fim">{x.fim}</b>
          </>
        )
        return x.aoClicar
          ? <button type="button" key={x.rotulo + i} className="vt-tempo-linha" style={{ '--c': x.cor, '--i': i } as CSSProperties} onClick={x.aoClicar}>{linha}</button>
          : <div key={x.rotulo + i} className="vt-tempo-linha" style={{ '--c': x.cor, '--i': i } as CSSProperties}>{linha}</div>
      })}
      <div className="vt-tempo-eixo"><span>{eixo[0]}</span><span>{eixo[1]}</span></div>
    </div>
  )
}

/** Uma barra dividida nas partes de um todo, com a legenda embaixo (nome, valor e %). */
export function BarraDividida({ partes, formato, legenda = true }: {
  partes: { rotulo: string; valor: number; cor: string; icone?: ReactNode }[]; formato: (n: number) => string; legenda?: boolean
}) {
  const [ref, vivo] = useEmVista<HTMLDivElement>()
  const total = partes.reduce((a, x) => a + Math.max(0, x.valor), 0) || 1
  const visiveis = partes.filter((x) => x.valor > 0)
  return (
    <div ref={ref} className={`vt-dividida ${vivo ? 'vivo' : ''}`}>
      <div className="vt-dividida-barra" aria-hidden="true">
        {visiveis.map((x, i) => <i key={x.rotulo} style={{ width: `${(x.valor / total) * 100}%`, background: x.cor, '--i': i } as CSSProperties} />)}
      </div>
      {legenda && (
        <ul className="vt-dividida-legenda">
          {visiveis.map((x) => (
            <li key={x.rotulo}>
              <i style={{ background: x.cor }} />
              {x.icone}
              <span>{x.rotulo}</span>
              <b>{formato(x.valor)}</b>
              <small>{Math.round((x.valor / total) * 100)}%</small>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Rosca simples, com o total no meio. */
export function Rosquinha({ partes, tamanho = 150, children }: {
  partes: { rotulo: string; valor: number; cor: string }[]; tamanho?: number; children?: ReactNode
}) {
  const [ref, vivo] = useEmVista<HTMLSpanElement>()
  const total = partes.reduce((a, x) => a + Math.max(0, x.valor), 0) || 1
  const fatias = partes.filter((x) => x.valor > 0).map((x) => ({ ...x, p: (x.valor / total) * 100 }))
    .map((x, i, l) => ({ ...x, inicio: l.slice(0, i).reduce((a, y) => a + y.p, 0) }))
  return (
    <span ref={ref} className={`vt-rosca ${vivo ? 'vivo' : ''}`} style={{ width: tamanho, height: tamanho }}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle className="vt-rosca-fundo" cx="60" cy="60" r="48" />
        {fatias.map((x, i) => (
          <circle key={x.rotulo} className="vt-rosca-fatia" cx="60" cy="60" r="48" pathLength={100} stroke={x.cor}
            strokeDasharray={`${Math.max(0, x.p - 0.9)} 100`} strokeDashoffset={-x.inicio} style={{ '--i': i } as CSSProperties} />
        ))}
      </svg>
      <span className="vt-rosca-meio">{children}</span>
    </span>
  )
}

/** Título de seção pequeno, com ícone e, à direita, um atalho. */
export function TituloDaSecao({ icone, children, acao }: { icone: string; children: ReactNode; acao?: ReactNode }) {
  return (
    <h2 className="vt-secao">
      <span className="vt-secao-ic"><Icone nome={icone} tamanho={16} /></span>
      <span>{children}</span>
      {acao && <span className="vt-secao-acao">{acao}</span>}
    </h2>
  )
}
