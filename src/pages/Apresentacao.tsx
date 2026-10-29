import { useCallback, useEffect, useRef, useState } from 'react'
import { Icone } from '../components/Icone'
import { Marca } from '../components/Marca'

/**
 * Landing page do OpusCash. No meio dela, as telas REAIS do app (capturas em /landing, feitas com dados de demonstração)
 * flutuam em 3D, vistas de lado, e a câmera voa de uma para a outra conforme a pessoa rola a página.
 * As capturas existem nos dois temas; veja scripts/telas-da-landing para gerá-las de novo quando o app mudar.
 */
const CENAS = [
  { arquivo: 'inicio', titulo: 'Tudo num relance', texto: 'Quanto sobrou, quanto entrou e o que vence. Logo ao abrir.' },
  { arquivo: 'cartoes', titulo: 'Cartões sob controle', texto: 'Fatura, parcelas e limite de cada cartão, no dia certo.' },
  { arquivo: 'contas', titulo: 'Contas do mês', texto: 'Aluguel, luz, internet. Toque em “Paguei” e pronto.' },
  { arquivo: 'metas', titulo: 'Metas que enchem', texto: 'Cada pote enche conforme você guarda.' },
  { arquivo: 'dividas', titulo: 'Dívidas organizadas', texto: 'Quanto falta, o que venceu e quando você fica livre.' },
  { arquivo: 'ano', titulo: 'O ano inteiro', texto: 'Para onde foi o dinheiro, mês a mês.' },
] as const

/** Como a câmera olha para cada tela: giro lateral (ry), inclinação (rx) e aproximação (dz, em fração da largura da tela). */
interface Pose { ry: number; rx: number; dz: number }
const POSES_DESKTOP: Pose[] = [
  { ry: -36, rx: 9, dz: 0 },
  { ry: 30, rx: 7, dz: 0.04 },
  { ry: -26, rx: 12, dz: 0 },
  { ry: 34, rx: 6, dz: 0.06 },
  { ry: -30, rx: 10, dz: 0.02 },
  { ry: -6, rx: 3, dz: 0.16 },
]
const POSES_CELULAR: Pose[] = [
  { ry: -22, rx: 6, dz: 0 },
  { ry: 18, rx: 5, dz: 0.02 },
  { ry: -16, rx: 8, dz: 0 },
  { ry: 20, rx: 4, dz: 0.03 },
  { ry: -18, rx: 6, dz: 0 },
  { ry: -4, rx: 2, dz: 0.08 },
]

const limitar = (n: number, a = 0, b = 1) => Math.min(b, Math.max(a, n))
const suave = (a: number, b: number, x: number) => {
  const t = limitar((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}
const mistura = (a: number, b: number, t: number) => a + (b - a) * t

/** Onde cada tela fica no espaço (múltiplos da largura W): uma "estrada" que vai para o fundo e para o lado. */
const passo = { x: 0.62, y: -0.05, z: -0.78 }

const ANO = new Date().getFullYear()

const temaAtual = () => (document.documentElement.dataset.tema === 'claro' ? 'claro' : 'escuro')

export function Apresentacao({ onLogin, onSignup }: { onLogin: () => void; onSignup: () => void }) {
  const palcoRef = useRef<HTMLDivElement>(null)
  const palcoPalcoRef = useRef<HTMLDivElement>(null)
  const mundoRef = useRef<HTMLDivElement>(null)
  const planos = useRef<(HTMLDivElement | null)[]>([])
  const quadro = useRef(0)
  const medidas = useRef({ w: 900, celular: false, reduzir: false })
  const [cena, setCena] = useState(0)
  const [tema, setTema] = useState<'claro' | 'escuro'>(temaAtual)
  const [celular, setCelular] = useState(false) // celular: telas em pé (capturas do app no celular)

  // as capturas são do tema da pessoa; se o tema mudar, troca as imagens
  useEffect(() => {
    const o = new MutationObserver(() => setTema(temaAtual()))
    o.observe(document.documentElement, { attributes: true, attributeFilter: ['data-tema'] })
    return () => o.disconnect()
  }, [])

  /** Posiciona a câmera e as telas para o progresso p (0 a 1) do scroll. Escreve direto no DOM: nada de re-render por pixel. */
  const desenhar = useCallback((p: number) => {
    const mundo = mundoRef.current
    if (!mundo) return
    const { w, celular, reduzir } = medidas.current
    const poses = celular ? POSES_CELULAR : POSES_DESKTOP
    const n = CENAS.length
    const u = p * (n - 1)
    const i = Math.min(n - 2, Math.floor(u))
    // a câmera "descansa" um pouco em cada tela antes de seguir para a próxima
    const t = suave(0.36, 0.64, u - i)
    const k = i + t // posição da câmera entre as telas (fracionária)
    const a = poses[i], b = poses[i + 1]
    const ry = reduzir ? 0 : mistura(a.ry, b.ry, t)
    const rx = reduzir ? 0 : mistura(a.rx, b.rx, t)
    const dz = reduzir ? 0 : mistura(a.dz, b.dz, t) * w
    const px = k * passo.x * w, py = k * passo.y * w, pz = k * passo.z * w
    mundo.style.transform = `translateZ(${dz.toFixed(1)}px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) translate3d(${(-px).toFixed(1)}px, ${(-py).toFixed(1)}px, ${(-pz).toFixed(1)}px)`
    planos.current.forEach((el, j) => {
      if (!el) return
      const d = j - k // 0 = a tela em foco; negativo = já passou; positivo = vem aí
      // a que sai some rápido (passa perto da câmera); as que vêm aparecem em segundo plano
      const op = d <= 0 ? limitar(1 + d * 2.4) : limitar(1 - d * 0.42)
      el.style.opacity = op.toFixed(3)
      el.style.visibility = op < 0.01 ? 'hidden' : 'visible'
    })
    const foco = Math.round(k)
    setCena((antes) => (antes === foco ? antes : foco))
    palcoRef.current?.style.setProperty('--k', k.toFixed(3))
  }, [])

  const medir = useCallback(() => {
    const el = palcoPalcoRef.current
    if (!el) return
    const largura = el.clientWidth
    const altura = el.clientHeight
    const celular = largura <= 900
    // celular: tela em pé (390 x 844); cabe no que sobra embaixo do texto
    const w = celular
      ? Math.min(largura * 0.7, ((altura - 210) * 0.92) / (844 / 390))
      : Math.min(1120, largura * 0.66)
    medidas.current = { w, celular, reduzir: window.matchMedia('(prefers-reduced-motion: reduce)').matches }
    setCelular(celular)
    el.style.setProperty('--ar', celular ? String(844 / 390) : '0.625')
    el.style.setProperty('--w', `${w.toFixed(1)}px`)
    el.style.setProperty('--persp', `${(w * 1.9).toFixed(0)}px`)
    // as telas ficam em fila no espaço; cada uma já com a sua posição fixa
    planos.current.forEach((pl, j) => {
      if (pl) pl.style.transform = `translate3d(${(j * passo.x * w).toFixed(1)}px, ${(j * passo.y * w).toFixed(1)}px, ${(j * passo.z * w).toFixed(1)}px)`
    })
  }, [])

  const aoScroll = useCallback(() => {
    if (quadro.current) return
    quadro.current = requestAnimationFrame(() => {
      quadro.current = 0
      const el = palcoRef.current
      if (!el) return
      const total = el.offsetHeight - window.innerHeight
      const p = total > 0 ? limitar(-el.getBoundingClientRect().top / total) : 0
      desenhar(p)
    })
  }, [desenhar])

  useEffect(() => {
    const aoRedimensionar = () => { medir(); aoScroll() }
    medir()
    window.addEventListener('scroll', aoScroll, { passive: true })
    window.addEventListener('resize', aoRedimensionar)
    aoScroll()
    return () => {
      window.removeEventListener('scroll', aoScroll)
      window.removeEventListener('resize', aoRedimensionar)
      if (quadro.current) cancelAnimationFrame(quadro.current)
    }
  }, [aoScroll, medir])

  // clicar numa bolinha do trilho leva ao meio daquela cena
  const irParaCena = (i: number) => {
    const el = palcoRef.current
    if (!el) return
    const topo = el.getBoundingClientRect().top + window.scrollY
    const total = el.offsetHeight - window.innerHeight
    window.scrollTo({ top: topo + total * (i / (CENAS.length - 1)), behavior: 'smooth' })
  }

  return (
    <div className="ap">
      {/* ─── HERO ─── */}
      <section className="ap-hero">
        <div className="ap-hero-orbs">
          <i className="ap-orb ap-orb-a" />
          <i className="ap-orb ap-orb-b" />
          <i className="ap-orb ap-orb-c" />
        </div>
        <div className="ap-hero-centro">
          <div className="ap-logo-flutuante">
            {/* o logo em imagem tem "OPUS" branco: no tema claro entra a marca desenhada */}
            <img className="ap-logo-escuro" src="/logo-opuscash.webp" alt="OpusCash" />
            <span className="ap-logo-claro"><Marca grande /></span>
            <span className="ap-logo-brilho" />
          </div>
<h1 className="ap-h1">
            Seu dinheiro,<br /><em>infinitas</em> possibilidades
          </h1>
          <p className="ap-tagline">Controle financeiro com visual premium</p>
          <div className="ap-botoes">
            <button className="ap-btn ap-btn-cta" onClick={onSignup}>
              Começar grátis <Icone nome="seta" tamanho={17} />
            </button>
            <button className="ap-btn ap-btn-ghost" onClick={onLogin}>
              Já tenho conta
            </button>
          </div>
        </div>
        <div className="ap-scroll-hint">
          <span className="ap-scroll-mouse">
            <span className="ap-scroll-dot" />
          </span>
          <small>Role para explorar</small>
        </div>
      </section>

      {/* ─── AS TELAS DO APP EM 3D ─── */}
      <section className="ap-palco" ref={palcoRef}>
        <div className="ap-palco-sticky" ref={palcoPalcoRef}>
          <div className="ap-luz" aria-hidden="true" />

          <div className="ap-palco-cena" aria-hidden="true">
            <div className="ap-mundo" ref={mundoRef}>
              {CENAS.map((c, i) => (
                <div key={c.arquivo} className="ap-plano" ref={(el) => { planos.current[i] = el }}>
                  <img src={`/landing/${tema}-${c.arquivo}${celular ? '-m' : ''}.webp`} alt="" width={celular ? 780 : 2560} height={celular ? 1688 : 1600} decoding="async" draggable={false} />
                </div>
              ))}
            </div>
          </div>

          <div className="ap-cenas">
            <div className="ap-cena-pilha" aria-live="polite">
              {CENAS.map((c, i) => (
                <div key={c.arquivo} className={`ap-cena-label ${cena === i ? 'ativa' : ''}`} aria-hidden={cena !== i}>
                  <span className="ap-cena-num">{String(i + 1).padStart(2, '0')} / {String(CENAS.length).padStart(2, '0')}</span>
                  <h2>{c.titulo}</h2>
                  <p>{c.texto}</p>
                </div>
              ))}
            </div>
            <div className="ap-trilho" role="tablist" aria-label="Telas do OpusCash">
              {CENAS.map((c, i) => (
                <button key={c.arquivo} role="tab" aria-selected={cena === i} aria-label={c.titulo}
                  className={`ap-trilho-ponto ${cena === i ? 'ativo' : ''}`} onClick={() => irParaCena(i)} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── CTA FINAL ─── */}
      <section className="ap-cta-final">
        <div className="ap-cta-orbs">
          <i className="ap-orb ap-orb-d" />
          <i className="ap-orb ap-orb-e" />
        </div>
        <div className="ap-cta-centro">
          <div className="ap-preco">
            <span className="ap-preco-tag">Teste grátis por 7 dias</span>
            <div className="ap-preco-valor">
              <small>R$</small>
              <strong>9,99</strong>
              <span>/mês</span>
            </div>
            <p className="ap-preco-nota">Cartão necessário para começar. Cancele em até 7 dias e não cobramos nada.</p>
          </div>
          <h2 className="ap-cta-titulo">Pronto para transformar<br />suas finanças?</h2>
          <div className="ap-botoes">
            <button className="ap-btn ap-btn-cta ap-btn-grande" onClick={onSignup}>
              Criar conta grátis <Icone nome="seta" tamanho={17} />
            </button>
            <button className="ap-btn ap-btn-ghost" onClick={onLogin}>
              Entrar
            </button>
          </div>
          <ul className="ap-features-mini">
            <li><Icone nome="check" tamanho={14} /> Cartões, faturas e parcelas</li>
            <li><Icone nome="check" tamanho={14} /> Metas, dívidas e contas do mês</li>
            <li><Icone nome="check" tamanho={14} /> Qualquer moeda, com a cotação do dia</li>
            <li><Icone nome="check" tamanho={14} /> Importa extrato do banco e planilhas</li>
          </ul>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="ap-footer">
        <Marca />
        <p>© {ANO} OpusCash · Todos os direitos reservados</p>
        <div className="ap-footer-links">
          <a href="#/termos">Termos</a>
          <a href="#/privacidade">Privacidade</a>
        </div>
      </footer>
    </div>
  )
}