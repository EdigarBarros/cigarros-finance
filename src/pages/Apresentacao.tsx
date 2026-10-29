import { useEffect, useRef, useState } from 'react'
import { Icone } from '../components/Icone'
import { Marca } from '../components/Marca'

/**
 * Landing page premium do OpusCash com animações scroll-driven e efeitos 3D.
 * Design dark theme com gradientes azul-verde inspirados na logo.
 * Seções: Hero → Features → Dashboard Preview → Pricing → CTA Final
 */
export function Apresentacao({ onLogin, onSignup }: { onLogin: () => void; onSignup: () => void }) {
  const [scrollY, setScrollY] = useState(0)
  const heroRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Parallax effect para o hero
  const heroTransform = `translateY(${scrollY * 0.4}px)`
  const heroOpacity = Math.max(0, 1 - scrollY / 600)

  return (
    <div className="apresentacao">
      {/* Hero Section */}
      <section className="ap-hero" ref={heroRef}>
        <div className="ap-hero-bg" style={{ transform: heroTransform, opacity: heroOpacity }}>
          <div className="ap-gradient-orb ap-orb-1" />
          <div className="ap-gradient-orb ap-orb-2" />
          <div className="ap-gradient-orb ap-orb-3" />
        </div>

        <div className="ap-hero-content" style={{ opacity: heroOpacity }}>
          <div className="ap-logo-3d">
            <img src="/logo-opuscash.webp" alt="OpusCash" className="ap-logo-img" />
            <div className="ap-logo-glow" />
          </div>

          <h1 className="ap-titulo">
            Seu dinheiro, <em>infinitas</em> possibilidades
          </h1>

          <p className="ap-subtitulo">
            Controle financeiro completo com visual premium. Entradas, saídas, cartões,
            dívidas e metas num lugar só.
          </p>

          <div className="ap-cta-group">
            <button className="ap-btn-primary" onClick={onSignup}>
              Começar grátis <Icone nome="seta" tamanho={18} />
            </button>
            <button className="ap-btn-secondary" onClick={onLogin}>
              Já tenho conta
            </button>
          </div>

          <div className="ap-scroll-indicator">
            <span>Role para descobrir</span>
            <Icone nome="abaixo" tamanho={20} />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="ap-features">
        <div className="ap-container">
          <h2 className="ap-section-title">Tudo que você precisa</h2>
          <p className="ap-section-subtitle">Ferramentas poderosas com interface intuitiva</p>

          <div className="ap-features-grid">
            <FeatureCard
              icone="carteira"
              titulo="Lançamentos"
              descricao="Registre entradas e saídas em segundos. Categorize automaticamente."
              delay={0}
            />
            <FeatureCard
              icone="cartao"
              titulo="Cartões"
              descricao="Acompanhe faturas, parcelas e limites de todos os seus cartões."
              delay={100}
            />
            <FeatureCard
              icone="meta"
              titulo="Metas"
              descricao="Defina objetivos e veja seu progresso em tempo real."
              delay={200}
            />
            <FeatureCard
              icone="relatorio"
              titulo="Relatórios"
              descricao="Gráficos interativos para entender seus gastos."
              delay={300}
            />
            <FeatureCard
              icone="divida"
              titulo="Dívidas"
              descricao="Controle parcelas e acompanhe a evolução do saldo."
              delay={400}
            />
            <FeatureCard
              icone="cofre"
              titulo="Multi-bancos"
              descricao="Organize contas de diferentes bancos num só lugar."
              delay={500}
            />
          </div>
        </div>
      </section>

      {/* Dashboard Preview Section */}
      <section className="ap-preview">
        <div className="ap-container">
          <h2 className="ap-section-title">Visual premium</h2>
          <p className="ap-section-subtitle">Interface moderna que transforma controle financeiro em experiência</p>

          <div className="ap-dashboard-mockup">
            <div className="ap-mockup-frame">
              <div className="ap-mockup-header">
                <div className="ap-mockup-dots">
                  <span /><span /><span />
                </div>
                <div className="ap-mockup-title">OpusCash Dashboard</div>
              </div>
              <div className="ap-mockup-body">
                <div className="ap-mockup-sidebar">
                  <div className="ap-mockup-logo"><Marca /></div>
                  <div className="ap-mockup-nav">
                    <div className="ap-mockup-nav-item active">Início</div>
                    <div className="ap-mockup-nav-item">Lançamentos</div>
                    <div className="ap-mockup-nav-item">Cartões</div>
                    <div className="ap-mockup-nav-item">Metas</div>
                  </div>
                </div>
                <div className="ap-mockup-content">
                  <div className="ap-mockup-card ap-mockup-card-large">
                    <div className="ap-mockup-card-label">Saldo total</div>
                    <div className="ap-mockup-card-value">R$ 12.450,00</div>
                    <div className="ap-mockup-card-chart">
                      <svg viewBox="0 0 200 60" className="ap-mini-chart">
                        <path d="M0,50 Q25,30 50,35 T100,20 T150,25 T200,10" fill="none" stroke="url(#gradient)" strokeWidth="2" />
                        <defs>
                          <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#3b82f6" />
                            <stop offset="100%" stopColor="#10b981" />
                          </linearGradient>
                        </defs>
                      </svg>
                    </div>
                  </div>
                  <div className="ap-mockup-grid">
                    <div className="ap-mockup-card">
                      <div className="ap-mockup-card-label">Entradas</div>
                      <div className="ap-mockup-card-value positive">+ R$ 8.200</div>
                    </div>
                    <div className="ap-mockup-card">
                      <div className="ap-mockup-card-label">Saídas</div>
                      <div className="ap-mockup-card-value negative">- R$ 3.750</div>
                    </div>
                    <div className="ap-mockup-card">
                      <div className="ap-mockup-card-label">Metas</div>
                      <div className="ap-mockup-card-progress">
                        <div className="ap-progress-bar" style={{ width: '68%' }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="ap-mockup-glow" />
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="ap-pricing">
        <div className="ap-container">
          <h2 className="ap-section-title">Comece grátis</h2>
          <p className="ap-section-subtitle">7 dias de teste grátis. Cancele quando quiser.</p>

          <div className="ap-pricing-card">
            <div className="ap-pricing-price">
              <span className="ap-price-currency">R$</span>
              <span className="ap-price-value">9,99</span>
              <span className="ap-price-period">/mês</span>
            </div>
            <ul className="ap-pricing-features">
              <li><Icone nome="check" tamanho={16} /> Lançamentos, categorias, bancos e cartões</li>
              <li><Icone nome="check" tamanho={16} /> Dívidas, metas e contas do mês</li>
              <li><Icone nome="check" tamanho={16} /> Qualquer moeda, com a cotação do dia</li>
              <li><Icone nome="check" tamanho={16} /> Importa extrato do banco e planilhas</li>
            </ul>
            <button className="ap-btn-primary ap-btn-large" onClick={onSignup}>
              Começar teste grátis
            </button>
            <p className="ap-pricing-note">Cartão necessário para começar o teste. Cancele em até 7 dias e não cobramos nada. Depois, R$ 9,99 por mês (ou o equivalente na sua moeda), sem fidelidade.</p>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="ap-final-cta">
        <div className="ap-gradient-orb ap-orb-4" />
        <div className="ap-container">
          <h2 className="ap-final-title">Pronto para transformar suas finanças?</h2>
          <p className="ap-final-subtitle">Junte-se a milhares de pessoas que já controlam seu dinheiro com o OpusCash</p>
          <div className="ap-cta-group">
            <button className="ap-btn-primary ap-btn-large" onClick={onSignup}>
              Criar conta grátis <Icone nome="seta" tamanho={18} />
            </button>
            <button className="ap-btn-secondary" onClick={onLogin}>
              Entrar
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="ap-footer">
        <div className="ap-container">
          <div className="ap-footer-logo"><Marca /></div>
          <p className="ap-footer-text">© 2025 OpusCash. Todos os direitos reservados.</p>
          <div className="ap-footer-links">
            <a href="#/termos">Termos</a>
            <a href="#/privacidade">Privacidade</a>
          </div>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({ icone, titulo, descricao, delay }: { icone: string; titulo: string; descricao: string; delay: number }) {
  const [visible, setVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && setVisible(true),
      { threshold: 0.2 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={`ap-feature-card ${visible ? 'visible' : ''}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className="ap-feature-icon">
        <Icone nome={icone} tamanho={28} />
      </div>
      <h3>{titulo}</h3>
      <p>{descricao}</p>
    </div>
  )
}