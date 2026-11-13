import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { Icone } from '../components/Icone'
import { semMovimento } from '../lib/tema'
import { tx } from '../lib/textos'
import './algoritmo.css'

/**
 * "O motor do OpusCash": depois das telas, uma seção presa na tela enquanto a pessoa rola, com um núcleo em 3D (o
 * algoritmo) e cinco cenas:
 *   1. o motor rodando por baixo do painel, puxando os dados pela rede;
 *   2. o Consultor: nota por pilar, plano de ação;
 *   3. a tela se montando e se adaptando a cada pessoa (Simples, Equilibrado, Detalhado);
 *   4. o leitor de extrato: PDF, planilha e OFX passando pelo scanner e virando lançamentos;
 *   5. a proteção: conexão e dados criptografados, cada conta só vê os próprios dados.
 *
 * O palco é desenhado em PW x PH px e escalado para caber. O componente escreve, a cada quadro, a câmera e o núcleo
 * (transform) e as variáveis de cada cena: --aN (quanto a cena N está na tela, 0 a 1) e --tN (o andamento dela, 0 a 1).
 * Tudo o mais é CSS em cima dessas variáveis.
 */
const PW = 960, PH = 680

const CENAS = [
  { titulo: tx('Um motor por trás de cada número'), texto: tx('Por baixo de cada tela, um algoritmo próprio cruza lançamentos, cartões, dívidas e metas, e refaz a análise a cada mudança.') },
  { titulo: tx('Um consultor que pensa por você'), texto: tx('Nota de 0 a 100 em cada pilar, previsão do mês, assinaturas esquecidas e um plano de ação na ordem certa.') },
  { titulo: tx('Uma tela que se monta para você'), texto: tx('O painel se adapta a cada pessoa: mais simples ou mais detalhado, só com o que você usa.') },
  { titulo: tx('Lê o extrato de qualquer banco'), texto: tx('PDF, Excel, CSV, Word e OFX viram lançamentos em segundos. Tudo conferido pelo saldo e lido no seu aparelho.') },
  { titulo: tx('Seus dados, trancados'), texto: tx('Conexão criptografada, dados guardados com criptografia e cada conta só enxerga os próprios dados.') },
] as const

/** Onde a câmera fica em cada cena (graus) e onde o núcleo vai (px no palco, escala). */
const ROTEIRO = [
  { rx: 18, ry: -14, nx: 0, ny: 150, ns: 0.9 },
  { rx: 10, ry: 16, nx: -330, ny: 210, ns: 0.5 },
  { rx: 14, ry: -18, nx: -320, ny: 240, ns: 0.46 },
  { rx: 8, ry: 12, nx: 0, ny: -262, ns: 0.44 },
  { rx: 12, ry: -10, nx: 0, ny: 20, ns: 1.05 },
]

const limitar = (n: number, a = 0, b = 1) => Math.min(b, Math.max(a, n))
const suave = (a: number, b: number, x: number) => { const t = limitar((x - a) / (b - a)); return t * t * (3 - 2 * t) }
const mistura = (a: number, b: number, t: number) => a + (b - a) * t

/** Os nós da rede em volta do núcleo (px no palco, a partir do centro) e o rótulo de alguns deles. */
const NOS: [number, number, string?][] = [
  [-400, -230, tx('lançamentos')], [-250, -290], [-60, -310, tx('cartões')], [150, -295], [330, -250, tx('dívidas')], [430, -110],
  [440, 90, tx('metas')], [330, 250], [140, 300, tx('saldos')], [-80, 310], [-290, 270, tx('categorias')], [-440, 110], [-450, -60],
  [-190, -160], [200, -150], [250, 120], [-220, 140], [20, -190],
]
/** Ligações: entre nós vizinhos e de cada nó de dentro até o núcleo (índice -1). */
const LIGA: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10], [10, 11], [11, 12], [12, 0],
  [0, 13], [1, 13], [2, 17], [3, 14], [4, 14], [5, 15], [6, 15], [7, 15], [8, 16], [9, 16], [10, 16], [11, 16], [12, 13],
  [13, -1], [14, -1], [15, -1], [16, -1], [17, -1], [13, 17], [17, 14],
]

function Rede() {
  const ponto = (i: number) => (i < 0 ? [0, 0] : [NOS[i][0], NOS[i][1]])
  return (
    <svg className="ag-rede" viewBox={`${-PW / 2} ${-PH / 2} ${PW} ${PH}`} aria-hidden="true">
      <defs>
        <linearGradient id="ag-fio" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--marca-1)" /><stop offset="1" stopColor="var(--marca-3)" />
        </linearGradient>
      </defs>
      {LIGA.map(([a, b], i) => {
        const [x1, y1] = ponto(a), [x2, y2] = ponto(b)
        const d = `M${x1} ${y1} L${x2} ${y2}`
        return (
          <g key={i}>
            <path d={d} className="ag-fio" />
            {/* pulso só nas ligações até o núcleo e em algumas da borda: cada pulso redesenha a rede a cada quadro */}
            {(b === -1 || i % 4 === 0) && <path d={d} className="ag-pulso" style={{ animationDelay: `${(i * 0.37) % 3}s`, animationDuration: `${2.4 + (i % 5) * 0.5}s` }} />}
          </g>
        )
      })}
      {NOS.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i > 12 ? 4 : 5.5} className={i % 3 === 0 ? 'ag-no aceso' : 'ag-no'} />)}
    </svg>
  )
}

/** O núcleo: esfera de luz com anéis girando em planos diferentes. */
function Nucleo({ refEl }: { refEl: RefObject<HTMLDivElement | null> }) {
  return (
    <div className="ag-nucleo" ref={refEl} aria-hidden="true">
      {/* no plano do núcleo vale a ordem do HTML: o brilho atrás, dois anéis atrás da esfera e um na frente */}
      <i className="ag-halo" />
      <i className="ag-anel c" /><i className="ag-anel b" />
      <i className="ag-esfera" />
      <i className="ag-anel a" />
    </div>
  )
}

/** Cena 1: o painel de vidro deitado sobre o núcleo, com feixes de luz subindo. */
function CenaPainel() {
  return (
    <div className="ag-cena ag-c1" style={{ '--a': 'var(--a0)', '--t': 'var(--t0)' } as CSSProperties}>
      <div className="ag-painel">
        <div className="ag-painel-topo"><b>{tx('Olá, Marina!')}</b><span /><span /></div>
        <div className="ag-painel-kpis">{[0, 1, 2].map((i) => <span key={i} style={{ '--i': i } as CSSProperties}><i /><b /></span>)}</div>
        <div className="ag-painel-graf">{Array.from({ length: 12 }, (_, i) => <i key={i} style={{ '--h': [40, 55, 48, 70, 62, 80, 66, 74, 90, 72, 84, 96][i], '--i': i } as CSSProperties} />)}</div>
      </div>
      {[-180, -60, 60, 180].map((x, i) => <i key={i} className="ag-feixe" style={{ '--x': `${x}px`, '--i': i } as CSSProperties} />)}
      {NOS.filter((no) => no[2]).map(([x, y, rotulo], i) => (
        <span key={rotulo} className="ag-dado" style={{ left: PW / 2 + x, top: PH / 2 + y, '--i': i } as CSSProperties}>{rotulo}</span>
      ))}
    </div>
  )
}

/** Cena 2: o Consultor analisando. */
function CenaConsultor() {
  const pilares = [
    { nome: tx('Sobra'), v: 0.78, c: '#22c55e' }, { nome: tx('Reserva'), v: 0.52, c: '#22b8f0' },
    { nome: tx('Dívidas'), v: 0.44, c: '#ffc000' }, { nome: tx('Cartão'), v: 0.81, c: '#a855f7' },
    { nome: tx('Gastos'), v: 0.67, c: '#ef4a6a' }, { nome: tx('Metas'), v: 0.71, c: '#1fd1a0' },
  ]
  const plano = [
    { t: tx('Adiante o Empréstimo pessoal'), d: tx('a dívida mais cara: 4,2% ao mês') },
    { t: tx('Cancele 3 assinaturas paradas'), d: tx('R$ 418 a mais no ano') },
    { t: tx('Guarde R$ 650 por mês'), d: tx('a reserva fica pronta em agosto') },
  ]
  return (
    <div className="ag-cena ag-c2" style={{ '--a': 'var(--a1)', '--t': 'var(--t1)' } as CSSProperties}>
      <div className="ag-consultor">
        <header><i><Icone nome="bussola" tamanho={16} /></i><b>{tx('Consultor')}</b><span className="ag-status"><i />{tx('Análise pronta')}</span></header>
        <div className="ag-consultor-meio">
          <div className="ag-nota"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="42" className="fundo" /><circle cx="50" cy="50" r="42" pathLength={1} className="cheio" /></svg><b data-conta="72">72</b><small>{tx('Boa')}</small></div>
          <ul className="ag-pilares">
            {pilares.map((p, i) => <li key={p.nome} style={{ '--c': p.c, '--v': p.v, '--i': i } as CSSProperties}><span>{p.nome}</span><i><b /></i></li>)}
          </ul>
        </div>
        <strong className="ag-plano-titulo">{tx('Plano de ação')}</strong>
        <ol className="ag-plano">
          {plano.map((p, i) => <li key={p.t} style={{ '--i': i } as CSSProperties}><span>{i + 1}</span><div><b>{p.t}</b><small>{p.d}</small></div></li>)}
        </ol>
      </div>
      {[tx('Previsão do mês'), tx('Regra 50/30/20'), tx('Gastos formiga'), tx('Avalanche × bola de neve'), tx('Ritmo das metas')].map((c, i) => (
        <span key={c} className="ag-chip" style={{ '--i': i } as CSSProperties}><i />{c}</span>
      ))}
    </div>
  )
}

/** Cena 3: a tela se montando (linhas de código, blocos em arame que se enchem) e mudando de jeito. */
function CenaTela() {
  // posição de cada bloco (% do quadro) em cada jeito: Simples, Equilibrado, Detalhado
  const blocos: [number, number, number, number][][] = [
    [[0, 0, 100, 46], [0, 0, 100, 34], [0, 0, 64, 30]],
    [[0, 52, 48, 48], [0, 40, 32, 22], [68, 0, 32, 30]],
    [[52, 52, 48, 48], [34, 40, 32, 22], [0, 35, 32, 30]],
    [[50, 100, 0, 0], [68, 40, 32, 22], [34, 35, 32, 30]],
    [[50, 100, 0, 0], [0, 68, 100, 32], [68, 35, 32, 30]],
    [[50, 100, 0, 0], [50, 100, 0, 0], [0, 70, 100, 30]],
  ]
  const codigo = [
    "perfil.detalhe = 'equilibrado'",
    'modulos = { cartoes: true, metas: true }',
    'montar(inicio, perfil)',
    'prioridade(dividas.maisCara)',
  ]
  return (
    <div className="ag-cena ag-c3" style={{ '--a': 'var(--a2)', '--t': 'var(--t2)' } as CSSProperties}>
      <div className="ag-codigo" translate="no">{codigo.map((l, i) => <span key={i} style={{ '--i': i } as CSSProperties}>{l}</span>)}</div>
      <div className="ag-tela">
        <div className="ag-modos">
          <span className="m0">{tx('Simples')}</span><span className="m1">{tx('Equilibrado')}</span><span className="m2">{tx('Detalhado')}</span><i className="ag-modo-marca" />
        </div>
        <div className="ag-quadro">
          {blocos.map((b, i) => (
            <div key={i} className="ag-bloco" style={{
              '--i': i,
              '--x0': b[0][0], '--y0': b[0][1], '--w0': b[0][2], '--h0': b[0][3],
              '--x1': b[1][0], '--y1': b[1][1], '--w1': b[1][2], '--h1': b[1][3],
              '--x2': b[2][0], '--y2': b[2][1], '--w2': b[2][2], '--h2': b[2][3],
            } as CSSProperties}>
              <i /><b /><b />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Cena 4: os arquivos passam pelo scanner e saem como lançamentos. */
function CenaExtrato() {
  const docs = [
    { tipo: 'PDF', c: '#ef4a6a' }, { tipo: 'XLSX', c: '#22c55e' }, { tipo: 'OFX', c: '#22b8f0' },
  ]
  const linhas = [
    { d: '05/11', n: tx('Salário'), v: '+ R$ 6.500,00', e: true, c: '#14b8a6' },
    { d: '05/11', n: tx('Aluguel'), v: '− R$ 1.800,00', c: '#3b9cff' },
    { d: '08/11', n: tx('Mercado'), v: '− R$ 408,00', c: '#f07a12' },
    { d: '09/11', n: tx('Internet'), v: '− R$ 119,90', c: '#3b9cff' },
    { d: '12/11', n: tx('Freela de design'), v: '+ R$ 2.400,00', e: true, c: '#14b8a6' },
    { d: '14/11', n: tx('Streaming'), v: '− R$ 55,90', c: '#a855f7' },
  ]
  return (
    <div className="ag-cena ag-c4" style={{ '--a': 'var(--a3)', '--t': 'var(--t3)' } as CSSProperties}>
      {docs.map((d, i) => (
        <div key={d.tipo} className="ag-doc" style={{ '--c': d.c, '--i': i } as CSSProperties}>
          <span className="ag-doc-tipo" translate="no">{d.tipo}</span>
          {Array.from({ length: 7 }, (_, k) => <i key={k} style={{ '--k': k } as CSSProperties} />)}
        </div>
      ))}
      <div className="ag-scanner"><i className="ag-laser" /></div>
      <div className="ag-linhas">
        <header><Icone nome="lista" tamanho={14} /> {tx('Lançamentos reconhecidos')}</header>
        {linhas.map((l, i) => (
          <span key={i} className="ag-linha" style={{ '--i': i, '--c': l.c } as CSSProperties}>
            <small>{l.d}</small><b>{l.n}</b><strong className={l.e ? 'entra' : 'sai'}>{l.v}</strong>
          </span>
        ))}
        <span className="ag-confere"><Icone nome="check" tamanho={13} /> {tx('Conferido pelo saldo')}</span>
      </div>
    </div>
  )
}

/** Cena 5: o cadeado, os pacotes passando cifrados e as garantias. */
function CenaCripto() {
  const selos = [
    { icone: 'globo', t: tx('Conexão criptografada') },
    { icone: 'cofre', t: tx('Dados guardados com criptografia') },
    { icone: 'pessoa', t: tx('Cada conta só vê os próprios dados') },
  ]
  const cifra = ['9f2c·a71e·04bd·e5c3', '7d10·c9aa·3f6e·b204', 'e83b·5c0f·d19a·62c7', '1a4e·f7b3·8c25·d0e9', 'b6c1·2e8f·74ad·0953']
  return (
    <div className="ag-cena ag-c5" style={{ '--a': 'var(--a4)', '--t': 'var(--t4)' } as CSSProperties}>
      <div className="ag-trilha">
        {Array.from({ length: 6 }, (_, i) => <i key={i} className="ag-pacote" style={{ '--i': i } as CSSProperties}><b /></i>)}
      </div>
      <div className="ag-cifra" translate="no">{cifra.map((c, i) => <span key={i} style={{ '--i': i } as CSSProperties}>{c}</span>)}</div>
      <div className="ag-cadeado" aria-hidden="true">
        <svg viewBox="0 0 120 140">
          <defs>
            <linearGradient id="ag-cad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="var(--marca-1)" /><stop offset="1" stopColor="var(--marca-3)" /></linearGradient>
          </defs>
          <path d="M30 62 V44 a30 30 0 0 1 60 0 V62" className="arco" />
          <rect x="14" y="60" width="92" height="72" rx="18" fill="url(#ag-cad)" />
          <circle cx="60" cy="92" r="10" fill="#fff" fillOpacity=".92" />
          <rect x="56" y="96" width="8" height="18" rx="4" fill="#fff" fillOpacity=".92" />
        </svg>
      </div>
      <div className="ag-selos">
        {selos.map((s, i) => <span key={s.t} style={{ '--i': i } as CSSProperties}><i><Icone nome={s.icone} tamanho={15} /></i>{s.t}</span>)}
      </div>
    </div>
  )
}

export function Algoritmo() {
  const secaoRef = useRef<HTMLElement>(null)
  const stickyRef = useRef<HTMLDivElement>(null)
  const palcoRef = useRef<HTMLDivElement>(null)
  const mundoRef = useRef<HTMLDivElement>(null)
  const nucleoRef = useRef<HTMLDivElement>(null)
  const [cena, setCena] = useState(0)

  useEffect(() => {
    const secao = secaoRef.current, sticky = stickyRef.current, palco = palcoRef.current, mundo = mundoRef.current, nucleo = nucleoRef.current
    if (!secao || !sticky || !palco || !mundo || !nucleo) return
    const n = CENAS.length
    let reduzir = semMovimento()
    const cenas = [...mundo.querySelectorAll<HTMLElement>('.ag-cena')]

    // o palco desenhado em PW x PH cabe na área livre (à direita do texto no computador; embaixo dele no celular)
    const medir = () => {
      reduzir = semMovimento()
      const w = sticky.clientWidth, h = sticky.clientHeight, celular = w <= 900
      let cx: number, cy: number, aw: number, ah: number
      if (celular) { const topo = Math.min(260, h * 0.32); cx = w / 2; cy = topo + (h - topo) / 2; aw = w * 0.98; ah = h - topo - 16 }
      else { const esq = Math.min(460, w * 0.38); cx = esq + (w - esq) / 2; cy = h / 2; aw = w - esq - 30; ah = h * 0.9 }
      const s = Math.min(aw / PW, ah / PH) * (celular ? 1.24 : 1) // no celular pode vazar um pouco das bordas (a rede e as pontas), senão fica pequeno demais
      // a escala parte do canto de cima (transform-origin 0 0): o canto vai para o centro menos meia largura já escalada
      palco.style.transform = `translate(${(cx - (PW * s) / 2).toFixed(1)}px, ${(cy - (PH * s) / 2).toFixed(1)}px) scale(${s.toFixed(4)})`
    }

    const ultimo = new Map<string, string>()
    const por = (k: string, v: string, f: () => void) => { if (ultimo.get(k) !== v) { ultimo.set(k, v); f() } }
    let cenaAtual = -1
    const desenhar = (p: number, tempo: number) => {
      // cada cena ocupa 1/n do caminho; a vizinha entra enquanto a outra sai
      const pos = p * n - 0.5 // posição contínua no roteiro (0 = meio da cena 1)
      const i0 = Math.max(0, Math.min(n - 1, Math.floor(pos))), i1 = Math.min(n - 1, i0 + 1)
      const f = suave(0, 1, pos - i0)
      const a = ROTEIRO[i0], b = ROTEIRO[i1]
      const bal = reduzir ? 0 : 1
      const rx = mistura(a.rx, b.rx, f) * bal + (reduzir ? 0 : Math.sin(tempo * 0.0005) * 1.6)
      const ry = mistura(a.ry, b.ry, f) * bal + (reduzir ? 0 : Math.cos(tempo * 0.0004) * 2.2)
      mundo.style.transform = `rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`
      nucleo.style.transform = `translate3d(${mistura(a.nx, b.nx, f).toFixed(1)}px, ${mistura(a.ny, b.ny, f).toFixed(1)}px, -40px) scale(${mistura(a.ns, b.ns, f).toFixed(3)})`
      for (let i = 0; i < n; i++) {
        const ini = i / n, fim = (i + 1) / n
        const entra = i === 0 ? 1 : suave(ini - 0.035, ini + 0.035, p)
        const sai = i === n - 1 ? 0 : suave(fim - 0.035, fim + 0.035, p)
        const ac = (entra * (1 - sai)).toFixed(3), t = limitar((p - ini) / (fim - ini) * 1.15).toFixed(3)
        por(`a${i}`, ac, () => mundo.style.setProperty(`--a${i}`, ac))
        por(`t${i}`, t, () => mundo.style.setProperty(`--t${i}`, t))
      }
      // cena 3: a tela se monta no jeito Equilibrado, vira Simples e depois Detalhado (--m de 0 a 2; --q0..2 são os pesos)
      const t2 = limitar((p - 2 / n) / (1 / n) * 1.15)
      const m = t2 < 0.5 ? 1 : t2 < 0.66 ? 1 - suave(0.5, 0.66, t2) : suave(0.72, 0.92, t2) * 2
      const pesos = [Math.max(0, 1 - m), Math.max(0, 1 - Math.abs(m - 1)), Math.max(0, m - 1)]
      por('m', m.toFixed(3), () => {
        mundo.style.setProperty('--m', m.toFixed(3))
        pesos.forEach((q, k) => mundo.style.setProperty(`--q${k}`, q.toFixed(3)))
      })
      const enche = suave(0.14, 0.34, t2).toFixed(3)
      por('enche', enche, () => mundo.style.setProperty('--enche', enche))
      // cena que não está na tela nem é pintada
      cenas.forEach((el, i) => { const fora = Number(ultimo.get(`a${i}`) ?? 0) < 0.002; por(`v${i}`, fora ? 'hidden' : '', () => { el.style.visibility = fora ? 'hidden' : '' }) })
      const qual = Math.min(n - 1, Math.floor(p * n))
      if (qual !== cenaAtual) { cenaAtual = qual; setCena(qual) }
    }

    let alvo = 0, atual = 0, quadro = 0, visivel = false, antes = 0
    const lerScroll = () => {
      const total = secao.offsetHeight - window.innerHeight
      alvo = total > 0 ? limitar(-secao.getBoundingClientRect().top / total) : 0
    }
    const laco = (agora: number) => {
      const dt = Math.min(0.05, (agora - (antes || agora)) / 1000); antes = agora
      // o desenhado persegue o scroll suavemente (um tempo de resposta de ~0,2 s), sem pular etapas num scroll rápido
      atual = reduzir ? alvo : atual + (alvo - atual) * (1 - Math.exp(-dt * 7))
      if (Math.abs(alvo - atual) < 0.0002) atual = alvo
      desenhar(atual, agora)
      quadro = visivel ? requestAnimationFrame(laco) : 0
    }
    const obs = new IntersectionObserver(([e]) => {
      visivel = e.isIntersecting
      sticky.classList.toggle('ag-parado', !visivel)
      if (visivel && !quadro) { lerScroll(); antes = 0; quadro = requestAnimationFrame(laco) }
    })
    obs.observe(secao)
    const aoScroll = () => lerScroll()
    const aoRedim = () => { medir(); lerScroll(); desenhar(atual, performance.now()) }
    medir(); lerScroll(); atual = alvo; desenhar(atual, performance.now())
    window.addEventListener('scroll', aoScroll, { passive: true })
    window.addEventListener('resize', aoRedim)
    return () => { obs.disconnect(); window.removeEventListener('scroll', aoScroll); window.removeEventListener('resize', aoRedim); if (quadro) cancelAnimationFrame(quadro) }
  }, [])

  const irPara = (i: number) => {
    const el = secaoRef.current
    if (!el) return
    const topo = el.getBoundingClientRect().top + window.scrollY, total = el.offsetHeight - window.innerHeight
    window.scrollTo({ top: topo + total * ((i + 0.5) / CENAS.length), behavior: 'smooth' })
  }

  return (
    <section className="ag" ref={secaoRef} aria-labelledby="ag-titulo">
      <div className="ag-sticky" ref={stickyRef}>
        <div className="ag-luz" aria-hidden="true" />
        <div className="ag-chao" aria-hidden="true" />
        <div className="ag-palco" ref={palcoRef} style={{ width: PW, height: PH }} aria-hidden="true">
          <div className="ag-mundo" ref={mundoRef}>
            <Rede />
            <Nucleo refEl={nucleoRef} />
            <CenaPainel />
            <CenaConsultor />
            <CenaTela />
            <CenaExtrato />
            <CenaCripto />
          </div>
        </div>
        <div className="ag-texto">
          <span className="ag-rotulo" id="ag-titulo"><i />{tx('O motor do OpusCash')}</span>
          <div className="ag-pilha" aria-live="polite">
            {CENAS.map((c, i) => (
              <div key={c.titulo} className={`ag-legenda ${cena === i ? 'ativa' : ''}`} aria-hidden={cena !== i}>
                <h2>{c.titulo}</h2>
                <p>{c.texto}</p>
              </div>
            ))}
          </div>
          <div className="ag-trilho" role="tablist" aria-label={tx('Partes do motor do OpusCash')}>
            {CENAS.map((c, i) => (
              <button key={c.titulo} role="tab" aria-selected={cena === i} aria-label={c.titulo} className={cena === i ? 'ativo' : ''} onClick={() => irPara(i)} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
