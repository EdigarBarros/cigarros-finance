import { useEffect, useRef, useState, useCallback } from 'react'
import { Icone } from '../components/Icone'
import { Marca } from '../components/Marca'

/**
 * Landing page premium do OpusCash com animações scroll-driven 3D.
 * O dashboard "gruda" na tela e se transforma conforme o usuário rola,
 * revelando diferentes funcionalidades com perspectiva 3D.
 * Foco em visual, animações e ilustrações — mínimo de texto.
 */
export function Apresentacao({ onLogin, onSignup }: { onLogin: () => void; onSignup: () => void }) {
  const palcoRef = useRef<HTMLDivElement>(null)
  const [progresso, setProgresso] = useState(0) // 0 a 1 — progresso do scroll no palco
  const [cena, setCena] = useState(0) // 0-4: qual cena está ativa

  const aoScroll = useCallback(() => {
    if (!palcoRef.current) return
    const el = palcoRef.current
    const rect = el.getBoundingClientRect()
    const alturaPalco = el.offsetHeight
    const alturaViewport = window.innerHeight
    // Calcula quanto do palco já passou pelo topo da viewport
    const scrolled = Math.max(0, -rect.top)
    const totalScrollavel = alturaPalco - alturaViewport
    const p = totalScrollavel > 0 ? Math.min(1, Math.max(0, scrolled / totalScrollavel)) : 0
    setProgresso(p)
    setCena(Math.min(4, Math.floor(p * 5)))
  }, [])

  useEffect(() => {
    window.addEventListener('scroll', aoScroll, { passive: true })
    aoScroll()
    return () => window.removeEventListener('scroll', aoScroll)
  }, [aoScroll])

  // Transforms 3D do dashboard baseado no progresso
  const rotateX = 12 - progresso * 12 // 12deg → 0deg
  const rotateY = -6 + progresso * 12 // -6deg → 6deg
  const scale = 0.85 + progresso * 0.15 // 0.85 → 1.0
  const translateY = 40 - progresso * 40 // 40px → 0px

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
            <img src="/logo-opuscash.webp" alt="OpusCash" />
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

      {/* ─── DASHBOARD 3D STICKY ─── */}
      <section className="ap-palco" ref={palcoRef}>
        <div className="ap-palco-sticky">
          {/* Labels das cenas que aparecem/desaparecem */}
          <div className={`ap-cena-label ${cena === 0 ? 'ativa' : ''}`}>
            <span className="ap-cena-num">01</span>
            <h2>Visão geral</h2>
            <p>Saldo, entradas e saídas num glance</p>
          </div>
          <div className={`ap-cena-label ${cena === 1 ? 'ativa' : ''}`}>
            <span className="ap-cena-num">02</span>
            <h2>Cartões inteligentes</h2>
            <p>Faturas, parcelas e limites sob controle</p>
          </div>
          <div className={`ap-cena-label ${cena === 2 ? 'ativa' : ''}`}>
            <span className="ap-cena-num">03</span>
            <h2>Metas visuais</h2>
            <p>Progresso em tempo real com gráficos vivos</p>
          </div>
          <div className={`ap-cena-label ${cena === 3 ? 'ativa' : ''}`}>
            <span className="ap-cena-num">04</span>
            <h2>Dívidas organizadas</h2>
            <p>Parcelas, saldo restante e evolução clara</p>
          </div>
          <div className={`ap-cena-label ${cena === 4 ? 'ativa' : ''}`}>
            <span className="ap-cena-num">05</span>
            <h2>Relatórios completos</h2>
            <p>Entenda seus gastos com gráficos interativos</p>
          </div>

          {/* Dashboard 3D */}
          <div
            className="ap-dash-3d"
            style={{
              transform: `perspective(1200px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(${scale}) translateY(${translateY}px)`,
            }}
          >
            <div className="ap-dash-glow" />
            <div className="ap-dash-frame">
              {/* Barra superior do dashboard */}
              <div className="ap-dash-topbar">
                <div className="ap-dash-dots"><i /><i /><i /></div>
                <Marca compacta />
                <div className="ap-dash-mes">Outubro 2025</div>
              </div>

              <div className="ap-dash-body">
                {/* Sidebar */}
                <nav className="ap-dash-nav">
                  {[
                    { icone: 'inicio', nome: 'Início', ativo: cena === 0 },
                    { icone: 'lista', nome: 'Lançamentos', ativo: false },
                    { icone: 'cartao', nome: 'Cartões', ativo: cena === 1 },
                    { icone: 'meta', nome: 'Metas', ativo: cena === 2 },
                    { icone: 'divida', nome: 'Dívidas', ativo: cena === 3 },
                    { icone: 'ano', nome: 'Resumo', ativo: cena === 4 },
                  ].map((item) => (
                    <div key={item.nome} className={`ap-dash-nav-item ${item.ativo ? 'ativo' : ''}`}>
                      <Icone nome={item.icone} tamanho={16} />
                      <span>{item.nome}</span>
                    </div>
                  ))}
                </nav>

                {/* Conteúdo principal — muda conforme a cena */}
                <div className="ap-dash-content">
                  {/* Cena 0: Visão geral */}
                  <div className={`ap-dash-cena ${cena === 0 ? 'ativa' : ''}`}>
                    <div className="ap-kpi-row">
                      <div className="ap-kpi ap-kpi-saldo">
                        <small>Saldo total</small>
                        <strong>R$ 12.450<small>,00</small></strong>
                        <svg viewBox="0 0 200 50" className="ap-spark">
                          <defs>
                            <linearGradient id="sg" x1="0" y1="0" x2="1" y2="0">
                              <stop offset="0%" stopColor="var(--marca-1)" />
                              <stop offset="100%" stopColor="var(--marca-3)" />
                            </linearGradient>
                          </defs>
                          <path d="M0,40 Q30,20 60,28 T120,15 T200,8" fill="none" stroke="url(#sg)" strokeWidth="2.5" />
                          <path d="M0,40 Q30,20 60,28 T120,15 T200,8 V50 H0Z" fill="url(#sg)" opacity=".08" />
                        </svg>
                      </div>
                      <div className="ap-kpi ap-kpi-entrada">
                        <small>Entradas</small>
                        <strong>+R$ 8.200</strong>
                        <div className="ap-bar-mini"><i style={{ width: '72%' }} /></div>
                      </div>
                      <div className="ap-kpi ap-kpi-saida">
                        <small>Saídas</small>
                        <strong>−R$ 3.750</strong>
                        <div className="ap-bar-mini saida"><i style={{ width: '45%' }} /></div>
                      </div>
                    </div>
                    <div className="ap-cards-row">
                      <div className="ap-card-vis ap-card-nubank">
                        <span className="ap-card-band">Nubank</span>
                        <span className="ap-card-val">R$ 2.340</span>
                        <span className="ap-card-lim">de R$ 8.000</span>
                      </div>
                      <div className="ap-card-vis ap-card-itaú">
                        <span className="ap-card-band">Itaú</span>
                        <span className="ap-card-val">R$ 1.120</span>
                        <span className="ap-card-lim">de R$ 5.000</span>
                      </div>
                    </div>
                  </div>

                  {/* Cena 1: Cartões */}
                  <div className={`ap-dash-cena ${cena === 1 ? 'ativa' : ''}`}>
                    <div className="ap-cards-detail">
                      <div className="ap-card-big ap-card-nubank-big">
                        <div className="ap-card-chip" />
                        <span className="ap-card-num">•••• 4821</span>
                        <div className="ap-card-info">
                          <span>Nubank Ultravioleta</span>
                          <span>Fatura: R$ 2.340,00</span>
                        </div>
                        <div className="ap-card-barra"><i style={{ width: '29%' }} /></div>
                      </div>
                      <div className="ap-card-big ap-card-itau-big">
                        <div className="ap-card-chip" />
                        <span className="ap-card-num">•••• 7733</span>
                        <div className="ap-card-info">
                          <span>Itaú Personnalité</span>
                          <span>Fatura: R$ 1.120,00</span>
                        </div>
                        <div className="ap-card-barra"><i style={{ width: '22%' }} /></div>
                      </div>
                    </div>
                    <div className="ap-parcelas">
                      <h4>Parcelas ativas</h4>
                      {[
                        { nome: 'iPhone 15 Pro', val: 'R$ 450/mês', rest: '3 de 12' },
                        { nome: 'Curso React', val: 'R$ 197/mês', rest: '1 de 6' },
                        { nome: 'Notebook Dell', val: 'R$ 380/mês', rest: '5 de 10' },
                      ].map((p) => (
                        <div key={p.nome} className="ap-parcela-item">
                          <span>{p.nome}</span>
                          <strong>{p.val}</strong>
                          <small>{p.rest}</small>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Cena 2: Metas */}
                  <div className={`ap-dash-cena ${cena === 2 ? 'ativa' : ''}`}>
                    <div className="ap-metas-grid">
                      {[
                        { nome: 'Reserva de emergência', atual: 18500, meta: 30000, cor: 'var(--marca-3)' },
                        { nome: 'Viagem Europa', atual: 4200, meta: 12000, cor: 'var(--marca-2)' },
                        { nome: 'MacBook Pro', atual: 8900, meta: 15000, cor: 'var(--marca-1)' },
                        { nome: 'Trocar de carro', atual: 22000, meta: 60000, cor: 'var(--divida)' },
                      ].map((m) => {
                        const pct = Math.round((m.atual / m.meta) * 100)
                        return (
                          <div key={m.nome} className="ap-meta-card">
                            <div className="ap-meta-ring">
                              <svg viewBox="0 0 80 80">
                                <circle cx="40" cy="40" r="34" fill="none" stroke="var(--preench-3)" strokeWidth="6" />
                                <circle cx="40" cy="40" r="34" fill="none" stroke={m.cor} strokeWidth="6"
                                  strokeDasharray={`${pct * 2.136} 213.6`} strokeLinecap="round"
                                  transform="rotate(-90 40 40)" />
                              </svg>
                              <span>{pct}%</span>
                            </div>
                            <h4>{m.nome}</h4>
                            <p>R$ {m.atual.toLocaleString('pt-BR')} <small>/ R$ {m.meta.toLocaleString('pt-BR')}</small></p>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Cena 3: Dívidas */}
                  <div className={`ap-dash-cena ${cena === 3 ? 'ativa' : ''}`}>
                    <div className="ap-dividas-lista">
                      {[
                        { nome: 'Financiamento apto', total: 'R$ 285.000', parcela: 'R$ 2.150/mês', rest: 118, cor: 'var(--divida)' },
                        { nome: 'Empréstimo pessoal', total: 'R$ 15.000', parcela: 'R$ 890/mês', rest: 8, cor: 'var(--saida)' },
                        { nome: 'Cartão Nubank', total: 'R$ 2.340', parcela: 'Fatura mensal', rest: 1, cor: 'var(--violeta)' },
                      ].map((d) => (
                        <div key={d.nome} className="ap-divida-card">
                          <div className="ap-divida-top">
                            <h4>{d.nome}</h4>
                            <span className="ap-divida-badge" style={{ background: d.cor }}>{d.rest} parc.</span>
                          </div>
                          <div className="ap-divida-vals">
                            <div><small>Total</small><strong>{d.total}</strong></div>
                            <div><small>Parcela</small><strong>{d.parcela}</strong></div>
                          </div>
                          <div className="ap-divida-barra">
                            <i style={{ width: `${Math.max(5, 100 - d.rest * 0.8)}%`, background: d.cor }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Cena 4: Relatório */}
                  <div className={`ap-dash-cena ${cena === 4 ? 'ativa' : ''}`}>
                    <div className="ap-relatorio">
                      <div className="ap-grafico-barras">
                        {['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out'].map((m, i) => {
                          const h = [45, 62, 38, 71, 55, 80, 48, 65, 72, 58][i]
                          return (
                            <div key={m} className="ap-barra-col">
                              <div className="ap-barra-fill" style={{ height: `${h}%` }}>
                                <div className="ap-barra-entrada" style={{ height: `${60 + Math.random() * 20}%` }} />
                              </div>
                              <small>{m}</small>
                            </div>
                          )
                        })}
                      </div>
                      <div className="ap-legenda">
                        <span><i className="ap-leg-ent" /> Entradas</span>
                        <span><i className="ap-leg-sai" /> Saídas</span>
                      </div>
                      <div className="ap-categorias-top">
                        {[
                          { nome: 'Moradia', pct: 32, cor: 'var(--caixa)' },
                          { nome: 'Alimentação', pct: 22, cor: 'var(--entrada)' },
                          { nome: 'Transporte', pct: 15, cor: 'var(--divida)' },
                          { nome: 'Lazer', pct: 12, cor: 'var(--violeta)' },
                          { nome: 'Outros', pct: 19, cor: 'var(--texto-3)' },
                        ].map((c) => (
                          <div key={c.nome} className="ap-cat-item">
                            <span>{c.nome}</span>
                            <div className="ap-cat-bar"><i style={{ width: `${c.pct}%`, background: c.cor }} /></div>
                            <strong>{c.pct}%</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
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
            <p className="ap-preco-nota">Cancele em até 7 dias e não cobramos nada</p>
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
            <li><Icone nome="check" tamanho={14} /> Lançamentos ilimitados</li>
            <li><Icone nome="check" tamanho={14} /> Múltiplos cartões</li>
            <li><Icone nome="check" tamanho={14} /> Metas e dívidas</li>
            <li><Icone nome="check" tamanho={14} /> Relatórios completos</li>
          </ul>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="ap-footer">
        <Marca />
        <p>© 2025 OpusCash · Todos os direitos reservados</p>
        <div className="ap-footer-links">
          <a href="#/termos">Termos</a>
          <a href="#/privacidade">Privacidade</a>
        </div>
      </footer>
    </div>
  )
}