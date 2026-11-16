/**
 * As peças do layout do celular (docs/arquitetura-do-painel.md, seção "Celular"): o topo grande que desliza entre páginas,
 * a fileira de ações redondas, os cartões com título e as linhas de lista. Cada tela do celular é montada com elas.
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Icone } from '../components/Icone'
import { tx } from '../lib/textos'
import { semMovimento } from '../lib/tema'
import type { Tom } from './tom'

export interface PaginaDoHero {
  id: string
  tom: Tom
  rotulo: string
  /** O número grande, já formatado. */
  valor: string
  sub?: ReactNode
  pilula?: { texto: string; acao: () => void }
}

/** Número longo encolhe para caber numa linha (R$ 1.234.567,89 não pode quebrar). */
const tamanhoDoValor = (v: string) => (v.length > 13 ? 34 : v.length > 10 ? 42 : 52)

/**
 * O topo da tela: um número grande por página, e a pessoa desliza para os lados para ver a próxima (com os pontos embaixo).
 * Desliza com a rolagem do próprio navegador (scroll-snap): o gesto é o do sistema e não briga com o "voltar" do Android.
 */
export function HeroDeslizante({ paginas, aoMudar }: { paginas: PaginaDoHero[]; aoMudar?: (p: PaginaDoHero) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [atual, setAtual] = useState(0)
  const i = Math.min(atual, paginas.length - 1)
  const chave = paginas.map((p) => p.id).join()
  useEffect(() => { if (paginas[i]) aoMudar?.(paginas[i]) }, [i, chave]) // eslint-disable-line react-hooks/exhaustive-deps
  const aoRolar = () => {
    const el = ref.current
    if (!el || !el.clientWidth) return
    const n = Math.round(el.scrollLeft / el.clientWidth)
    if (n !== atual) setAtual(n)
  }
  const irPara = (n: number) => ref.current?.scrollTo({ left: n * ref.current.clientWidth, behavior: semMovimento() ? 'auto' : 'smooth' })
  return (
    <section className="hero-movel" aria-roledescription={tx('carrossel')} aria-label={tx('Resumo')}>
      <div className="hero-movel-trilho" ref={ref} onScroll={aoRolar}>
        {paginas.map((p, n) => (
          <div key={p.id} className="hero-movel-pagina" role="group" aria-roledescription={tx('página')}
            aria-label={tx('{0} de {1}: {2}', n + 1, paginas.length, p.rotulo)} aria-hidden={n !== i || undefined}>
            <p className="hero-movel-rotulo">{p.rotulo}</p>
            <p className="hero-movel-valor" style={{ fontSize: tamanhoDoValor(p.valor) }}>{p.valor}</p>
            {p.sub && <p className="hero-movel-sub">{p.sub}</p>}
            {p.pilula && <button className="hero-movel-pilula" onClick={p.pilula.acao} tabIndex={n === i ? undefined : -1}>{p.pilula.texto}</button>}
          </div>
        ))}
      </div>
      {paginas.length > 1 && (
        <div className="hero-movel-pontos">
          {paginas.map((p, n) => (
            <button key={p.id} className={n === i ? 'ativo' : ''} onClick={() => irPara(n)} aria-label={tx('Ver {0}', p.rotulo)}
              aria-current={n === i || undefined}><i /></button>
          ))}
        </div>
      )}
    </section>
  )
}

export interface Acao { id: string; icone: string; rotulo: string; acao: () => void; tour?: string }

/** A fileira de botões redondos logo abaixo do topo: o que se faz nesta tela. */
export function BotoesDeAcao({ acoes, refAcoes }: { acoes: Acao[]; refAcoes?: React.Ref<HTMLDivElement> }) {
  return (
    <div className="acoes-movel" ref={refAcoes}>
      {acoes.map((a) => (
        <button key={a.id} onClick={a.acao} data-tour={a.tour}>
          <span className="acoes-movel-circulo" aria-hidden="true"><Icone nome={a.icone} tamanho={24} /></span>
          <span>{a.rotulo}</span>
        </button>
      ))}
    </div>
  )
}

/** Um cartão da tela: título pequeno em cima (que leva à tela completa, com "›") e o conteúdo. */
export function CartaoWidget({ titulo, aoAbrir, children, rodape, className = '' }: {
  titulo?: string; aoAbrir?: () => void; children: ReactNode; rodape?: { texto: string; acao: () => void }; className?: string
}) {
  return (
    <section className={`widget ${className}`} aria-label={titulo}>
      {titulo && (aoAbrir
        ? <button className="widget-titulo" onClick={aoAbrir}>{titulo}<Icone nome="dir" tamanho={15} /></button>
        : <h2 className="widget-titulo">{titulo}</h2>)}
      {children}
      {rodape && <button className="widget-rodape" onClick={rodape.acao}>{rodape.texto}</button>}
    </section>
  )
}

/** Círculo colorido com o ícone (ou qualquer conteúdo, como o ícone da categoria). */
export function IconeRedondo({ icone, cor, children, tamanho = 44 }: { icone?: string; cor?: string; children?: ReactNode; tamanho?: number }) {
  return (
    <span className="icone-redondo" aria-hidden="true" style={{ '--c': cor ?? 'var(--texto-2)', width: tamanho, height: tamanho } as CSSProperties}>
      {children ?? (icone && <Icone nome={icone} tamanho={Math.round(tamanho * 0.45)} />)}
    </span>
  )
}

/** Uma linha de lista: ícone redondo, título e linha de baixo à esquerda, valor à direita. */
export function LinhaDeLista({ icone, titulo, sub, valor, valorSub, tomValor, aoTocar, progresso }: {
  icone: ReactNode; titulo: ReactNode; sub?: ReactNode; valor?: ReactNode; valorSub?: ReactNode
  tomValor?: 'entrada' | 'saida' | 'alerta'; aoTocar?: () => void; progresso?: { parte: number; cor?: string }
}) {
  const corpo = (
    <>
      {icone}
      <span className="linha-movel-texto">
        <span className="linha-movel-titulo">{titulo}</span>
        {sub && <span className="linha-movel-sub">{sub}</span>}
        {progresso && (
          <span className="linha-movel-barra" aria-hidden="true">
            <i style={{ width: `${Math.round(Math.max(0, Math.min(1, progresso.parte)) * 100)}%`, background: progresso.cor }} />
          </span>
        )}
      </span>
      {(valor || valorSub) && (
        <span className="linha-movel-valor">
          {valor && <b className={tomValor ? `v-${tomValor}` : undefined}>{valor}</b>}
          {valorSub && <small>{valorSub}</small>}
        </span>
      )}
    </>
  )
  return aoTocar ? <button className="linha-movel" onClick={aoTocar}>{corpo}</button> : <div className="linha-movel">{corpo}</div>
}

/** Cartão de dica ou convite, que a pessoa pode dispensar. Vários ficam lado a lado e deslizam. */
export interface Dica { id: string; icone: string; titulo: string; texto?: string; botao?: { texto: string; acao: () => void }; aoDispensar?: () => void; tour?: string }

export function CarrosselDeDicas({ dicas }: { dicas: Dica[] }) {
  if (!dicas.length) return null
  return (
    <div className={`dicas-movel ${dicas.length === 1 ? 'uma' : ''}`}>
      {dicas.map((d) => (
        <section key={d.id} className="dica-movel" data-tour={d.tour} aria-label={d.titulo}>
          <IconeRedondo icone={d.icone} cor="var(--destaque)" tamanho={40} />
          <div>
            <h3>{d.titulo}</h3>
            {d.texto && <p>{d.texto}</p>}
            {d.botao && <button className="link" onClick={d.botao.acao}>{d.botao.texto}</button>}
          </div>
          {d.aoDispensar && (
            <button className="dica-movel-fechar" onClick={d.aoDispensar} aria-label={tx('Dispensar')}><Icone nome="fechar" tamanho={16} /></button>
          )}
        </section>
      ))}
    </div>
  )
}
