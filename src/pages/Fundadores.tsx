import { useEffect, useRef, type CSSProperties, type PointerEvent } from 'react'
import { tx } from '../lib/textos'
import './fundadores.css'

/**
 * "Quem faz o OpusCash": os dois sócios, logo antes do teste grátis da página de apresentação.
 * Cada um é um cartão de estúdio em camadas (fundo, primeiro nome gigante atrás, foto, sobrenome de vidro na frente),
 * que inclina com o mouse; as camadas ficam em profundidades diferentes, daí o efeito 3D.
 * O papel (Fundador, Sócio-fundador) vai fino e espaçado no rodapé.
 * `tam` e `tamSob`: tamanho da letra (em % da largura do cartão) para o nome ocupar a largura certa em Montserrat 800.
 */
const SOCIOS = [
  { primeiro: 'EDIGAR', sobrenome: 'BARROS', nome: 'Edigar Barros', foto: '/fundadores/edigar.webp', alt: 900 / 1561,
    papel: tx('Fundador'), tam: 22.7, tamSob: 15.4 },
  { primeiro: 'EDUARDO', sobrenome: 'MATOS', nome: 'Eduardo Matos', foto: '/fundadores/eduardo.webp', alt: 900 / 1565,
    papel: tx('Sócio-fundador'), tam: 17.2, tamSob: 18.3 },
]

function Cartao({ s, i }: { s: (typeof SOCIOS)[number]; i: number }) {
  const ref = useRef<HTMLDivElement>(null)
  // inclinação acompanhando o ponteiro (só mouse/caneta: no toque o cartão flutua sozinho)
  const mover = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width - 0.5
    const y = (e.clientY - r.top) / r.height - 0.5
    el.style.setProperty('--ry', `${(x * 14).toFixed(2)}deg`)
    el.style.setProperty('--rx', `${(y * -10).toFixed(2)}deg`)
    el.style.setProperty('--lx', `${((x + 0.5) * 100).toFixed(1)}%`)
    el.style.setProperty('--ly', `${((y + 0.5) * 100).toFixed(1)}%`)
    el.style.setProperty('--px', x.toFixed(3))
    el.style.setProperty('--py', y.toFixed(3))
    el.classList.add('mexendo')
  }
  const soltar = () => {
    const el = ref.current
    if (!el) return
    for (const v of ['--ry', '--rx', '--px', '--py']) el.style.removeProperty(v)
    el.classList.remove('mexendo')
  }
  return (
    <article className="fd-socio" style={{ '--i': i } as CSSProperties}>
      <div className="fd-cartao" ref={ref} onPointerMove={mover} onPointerLeave={soltar}>
        <div className="fd-fundo" />
        <span className="fd-nome" aria-hidden="true" style={{ '--tam': s.tam } as CSSProperties}>{s.primeiro}</span>
        {/* a moldura corta a foto rente ao cartão: a foto se mexe (paralaxe) sem nunca vazar pela borda */}
        <div className="fd-moldura">
          <img className="fd-foto" src={s.foto} alt={s.nome} width={900} height={Math.round(900 / s.alt)} loading="lazy" decoding="async" />
        </div>
        <div className="fd-chao" />
        <span className="fd-sobrenome" aria-hidden="true" style={{ '--tam': s.tamSob } as CSSProperties}>{s.sobrenome}</span>
        {/* o nome já está escrito grande (só para enfeite); aqui ele vai para leitores de tela */}
        <h3 className="fd-oculto">{s.nome}</h3>
        <p className="fd-papel">{s.papel}</p>
        <i className="fd-reflexo" />
      </div>
    </article>
  )
}

export function Fundadores() {
  const ref = useRef<HTMLElement>(null)
  // as animações de entrada só começam quando a seção aparece na tela
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { el.classList.add('fd-visto'); obs.disconnect() }
    }, { threshold: 0.2 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <section className="fd" ref={ref} aria-labelledby="fd-titulo">
      <div className="fd-luzes" aria-hidden="true"><i /><i /></div>
      <header className="fd-topo">
        <span className="fd-rotulo">{tx('Os idealizadores')}</span>
        <h2 id="fd-titulo">{tx('Quem faz o OpusCash')}</h2>
        <p>{tx('Uma ideia que saiu do papel e virou realidade. Dois sócios com a mão na massa para você cuidar do seu dinheiro com clareza.')}</p>
      </header>
      <div className="fd-grade">
        {SOCIOS.map((s, i) => <Cartao key={s.nome} s={s} i={i} />)}
      </div>
    </section>
  )
}
