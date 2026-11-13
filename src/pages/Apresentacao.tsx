import { useEffect, useRef, useState } from 'react'
import { Icone } from '../components/Icone'
import { Marca } from '../components/Marca'
import { tx } from '../lib/textos'
import { ligarRolagemSuave } from '../lib/rolagemSuave'
import { semMovimento } from '../lib/tema'
import { Algoritmo } from './Algoritmo'
import { Fundadores } from './Fundadores'
import { FundoOpus } from './FundoOpus'
import { Preco } from './Preco'
import { TelaDaApresentacao } from './ApresentacaoTelas'
import { BLOCOS, DH, DW, TELAS, ZONAS, dividaEm, escalonar, formatar, type Formato, type Ret, type Tela } from './apresentacaoCena'

/**
 * Landing page do OpusCash. No meio dela, cinco telas do painel (montadas em HTML, com dados de demonstração) ficam num
 * carrossel 3D, como as faces de um cilindro. Conforme a pessoa rola, a câmera voa de uma tela para a outra: no Início
 * os blocos se soltam em camadas; no Resumo do ano o gráfico se abre em planos (barras, dívida, guardado, investido) e a
 * linha da dívida se desenha com o valor acompanhando; nos Cartões os plásticos saltam e inclinam; nos Lançamentos cada
 * lançamento chega voando; nas Metas os potes enchem. No fim a câmera se afasta e mostra tudo junto.
 * Tudo é escrito direto no DOM a cada quadro, a partir de um progresso suavizado: nada de re-render por pixel.
 */
const CENAS = [
  { titulo: tx('Tudo num relance'), texto: tx('Quanto sobrou, o que vem aí e como anda cada parte do seu dinheiro. Logo ao abrir.'), p: 0.09 },
  { titulo: tx('O ano inteiro'), texto: tx('Entradas, saídas e a linha da sua dívida, mês a mês.'), p: 0.315 },
  { titulo: tx('Cartões sob controle'), texto: tx('Fatura, limite e parcelas de cada cartão, sem surpresa no fim do mês.'), p: 0.5 },
  { titulo: tx('Cada lançamento no lugar'), texto: tx('Dia a dia e por categoria, com quanto sobrou no mês.'), p: 0.685 },
  { titulo: tx('Metas que enchem'), texto: tx('Cada pote enche conforme você guarda e mostra quando a meta chega.'), p: 0.86 },
  { titulo: tx('Tudo em um só lugar'), texto: tx('Seu dinheiro organizado, do jeito que deveria ser.'), p: 0.985 },
] as const
/** Onde termina cada cena (progresso do scroll). */
const FIM_CENA = [0.195, 0.405, 0.59, 0.775, 0.925, 1]

// ─── o carrossel: as telas são faces de um cilindro, PASSO graus uma da outra ───
const PASSO = 32, RAIO = 2600
const rad = (g: number) => (g * Math.PI) / 180
const lugar = (i: number) => {
  const a = (i - (TELAS.length - 1) / 2) * PASSO
  return { x: RAIO * Math.sin(rad(a)), z: -RAIO * (1 - Math.cos(rad(a))), a }
}
/** Para onde a câmera olha: centro (no mundo) de uma tela, de um bloco dela ou do carrossel todo, o ângulo da tela e o tamanho a enquadrar. */
function focoDe(alvo: string) {
  if (alvo === 'mundo') return { x: 0, y: 0, z: -560, a: 0, w: 3000, h: DH * 1.25 }
  const [t, b] = alvo.split('.') as [Tela, string | undefined]
  const r: Ret = b ? (ZONAS[alvo] ?? (BLOCOS[t] as Record<string, Ret>)[b]) : [0, 0, DW, DH]
  const L = lugar(TELAS.indexOf(t))
  const du = r[0] + r[2] / 2 - DW / 2
  return { x: L.x + du * Math.cos(rad(L.a)), y: r[1] + r[3] / 2 - DH / 2, z: L.z - du * Math.sin(rad(L.a)), a: L.a, w: r[2], h: r[3] }
}

/** Roteiro da câmera: para onde olha (alvo), quanto aproxima (m, sobre o enquadramento do alvo) e de que ângulo. */
interface Quadro { p: number; alvo: string; m: number; rx: number; ry: number; rz: number; /** ângulo do carrossel, quando não é o da tela do alvo */ a?: number }
const CAMERA: Quadro[] = [
  { p: 0, alvo: 'inicio', m: 0.74, rx: 48, ry: 0, rz: -12 },
  { p: 0.06, alvo: 'inicio', m: 0.86, rx: 16, ry: -22, rz: 2 },
  { p: 0.12, alvo: 'inicio', m: 0.8, rx: 22, ry: -32, rz: 5 },
  { p: 0.165, alvo: 'inicio', m: 0.86, rx: 8, ry: -10, rz: 1 },
  // de uma tela para a outra: afasta, gira o carrossel e aproxima de novo
  { p: 0.205, alvo: 'ano', m: 0.64, rx: 14, ry: 24, rz: -2 },
  { p: 0.245, alvo: 'ano', m: 0.86, rx: 8, ry: 8, rz: 0 },
  // o gráfico do ano de lado, com os planos separados, e depois de frente
  { p: 0.29, alvo: 'ano.graf', m: 0.84, rx: 20, ry: -28, rz: 2 },
  { p: 0.33, alvo: 'ano.graf', m: 0.9, rx: 14, ry: -18, rz: 1 },
  { p: 0.372, alvo: 'ano.graf', m: 0.92, rx: 4, ry: 4, rz: 0 },
  { p: 0.41, alvo: 'cartoes', m: 0.62, rx: 12, ry: -26, rz: 2 },
  { p: 0.45, alvo: 'cartoes.par', m: 0.72, rx: 24, ry: 16, rz: -3 },
  { p: 0.5, alvo: 'cartoes.par', m: 0.76, rx: 14, ry: -14, rz: 1 },
  { p: 0.55, alvo: 'cartoes', m: 0.86, rx: 8, ry: -6, rz: 0 },
  { p: 0.595, alvo: 'lanc', m: 0.62, rx: 14, ry: 26, rz: -2 },
  { p: 0.635, alvo: 'lanc', m: 0.84, rx: 14, ry: 12, rz: -1 },
  { p: 0.68, alvo: 'lanc.lado', m: 0.86, rx: 18, ry: -18, rz: 2 },
  { p: 0.73, alvo: 'lanc.lado', m: 0.9, rx: 6, ry: -6, rz: 0 },
  { p: 0.78, alvo: 'metas', m: 0.62, rx: 14, ry: -24, rz: 2 },
  { p: 0.815, alvo: 'metas', m: 0.86, rx: 12, ry: -8, rz: 1 },
  { p: 0.86, alvo: 'metas.potes', m: 0.8, rx: 22, ry: 10, rz: -2 },
  { p: 0.9, alvo: 'metas.potes', m: 0.84, rx: 8, ry: 4, rz: 0 },
  // no fim a câmera se afasta e o carrossel gira de volta, passando pelas telas
  { p: 0.955, alvo: 'mundo', m: 0.95, rx: 14, ry: 8, rz: 0, a: 22 },
  { p: 1, alvo: 'mundo', m: 1, rx: 6, ry: -4, rz: 0, a: -14 },
]

/** Quando cada tela se solta em camadas: [sobe de, até, desce de, até]. */
const EXPLODE: Record<Tela, [number, number, number, number]> = {
  inicio: [0.04, 0.11, 0.135, 0.19],
  ano: [0.212, 0.245, 0.258, 0.29],
  cartoes: [0.415, 0.45, 0.535, 0.575],
  lanc: [0.6, 0.635, 0.705, 0.75],
  metas: [0.785, 0.82, 0.87, 0.91],
}
/** Janela de foco de cada bloco (sobe e acende; os outros da tela apagam um pouco): [começa, termina]. */
const FOCO: Record<string, [number, number]> = {
  'ano.graf': [0.275, 0.375],
  'cartoes.nubank': [0.445, 0.53], 'cartoes.itau': [0.445, 0.53],
  'lanc.lista': [0.65, 0.725],
  'metas.p1': [0.84, 0.895], 'metas.p2': [0.84, 0.895], 'metas.p3': [0.84, 0.895],
}
/**
 * O que se anima dentro de cada tela: vira a variável CSS --k-{nome} (0 a 1) na tela. Dois números: sobe de a até b
 * e fica. Quatro: sobe e depois volta (a separação dos planos do gráfico).
 */
const ANIM: Record<string, { t: Tela; j: [number, number] | [number, number, number, number]; movimento?: boolean }> = {
  ini: { t: 'inicio', j: [0.02, 0.12] },
  anoh: { t: 'ano', j: [0.205, 0.26] },
  meses: { t: 'ano', j: [0.215, 0.275] },
  ano: { t: 'ano', j: [0.26, 0.345] },
  sep: { t: 'ano', j: [0.262, 0.3, 0.345, 0.385], movimento: true },
  faixa: { t: 'ano', j: [0.345, 0.375] },
  carh: { t: 'cartoes', j: [0.415, 0.47] },
  carta: { t: 'cartoes', j: [0.44, 0.475, 0.52, 0.56], movimento: true },
  brilho: { t: 'cartoes', j: [0.47, 0.52] },
  lim: { t: 'cartoes', j: [0.48, 0.54] },
  prox: { t: 'cartoes', j: [0.5, 0.56] },
  lanh: { t: 'lanc', j: [0.605, 0.655] },
  cal: { t: 'lanc', j: [0.61, 0.67] },
  lan: { t: 'lanc', j: [0.64, 0.73] },
  cat: { t: 'lanc', j: [0.65, 0.71] },
  meth: { t: 'metas', j: [0.785, 0.835] },
  metb: { t: 'metas', j: [0.8, 0.86] },
  met: { t: 'metas', j: [0.835, 0.9] },
}

const limitar = (n: number, a = 0, b = 1) => Math.min(b, Math.max(a, n))
const rampa = (a: number, b: number, x: number) => limitar((x - a) / (b - a))
const suave = (a: number, b: number, x: number) => {
  const t = rampa(a, b, x)
  return t * t * (3 - 2 * t)
}
const sino = ([a, b, c, d]: [number, number, number, number], p: number) => suave(a, b, p) * (1 - suave(c, d, p))
/**
 * Curva suave que passa por todos os pontos (ps, vs): Hermite monotônica (Fritsch-Carlson). A velocidade é contínua de
 * um ponto ao outro, então a câmera não para e arranca em cada quadro do roteiro, e a curva nunca passa do ponto.
 */
function curva(ps: readonly number[], vs: readonly number[]) {
  const n = ps.length
  const d = ps.slice(0, -1).map((_, i) => (vs[i + 1] - vs[i]) / (ps[i + 1] - ps[i]))
  const m = ps.map((_, i) => (i === 0 || i === n - 1 || d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2))
  d.forEach((di, i) => {
    if (di === 0) { m[i] = 0; m[i + 1] = 0; return }
    const a = m[i] / di, b = m[i + 1] / di, h = a * a + b * b
    if (h > 9) { const t = 3 / Math.sqrt(h); m[i] = t * a * di; m[i + 1] = t * b * di }
  })
  return (p: number) => {
    let i = 0
    while (i < n - 2 && p > ps[i + 1]) i++
    const h = ps[i + 1] - ps[i], t = limitar((p - ps[i]) / h), t2 = t * t, t3 = t2 * t
    return (2 * t3 - 3 * t2 + 1) * vs[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * vs[i + 1] + (t3 - t2) * h * m[i + 1]
  }
}
/** Peso do foco de um bloco: sobe antes da janela, fica 1 nela e desce depois. */
const peso = (j: [number, number] | undefined, p: number) => (j ? suave(j[0] - 0.05, j[0], p) * (1 - suave(j[1], j[1] + 0.05, p)) : 0)

const ANO = new Date().getFullYear()

export function Apresentacao({ onLogin, onSignup }: { onLogin: () => void; onSignup: () => void }) {
  const palcoRef = useRef<HTMLElement>(null)
  const stickyRef = useRef<HTMLDivElement>(null)
  const mundoRef = useRef<HTMLDivElement>(null)
  const [cena, setCena] = useState(0)

  // rodinha do mouse com inércia, como o arrasto no celular (a animação 3D acompanha sem trancos)
  useEffect(() => ligarRolagemSuave(), [])

  useEffect(() => {
    const palco = palcoRef.current, sticky = stickyRef.current, mundo = mundoRef.current
    if (!palco || !sticky || !mundo) return

    const telas = TELAS.map((t) => {
      const el = mundo.querySelector<HTMLElement>(`[data-tela="${t}"]`)!
      return {
        t, el,
        blocos: [...el.querySelectorAll<HTMLElement>('[data-bloco]')].map((b) => ({ el: b, chave: `${t}.${b.dataset.bloco}`, z: Number(b.dataset.z) || 0 })),
      }
    })
    const porTela = Object.fromEntries(telas.map((x) => [x.t, x.el])) as Record<Tela, HTMLElement>
    // números que contam, agrupados pela variável que os anima
    const contadores = new Map<string, { el: HTMLElement; v: number; f: Formato; i?: number; n: number }[]>()
    mundo.querySelectorAll<HTMLElement>('[data-conta]').forEach((el) => {
      const k = el.dataset.k!
      const lista = contadores.get(k) ?? []
      lista.push({ el, v: Number(el.dataset.conta), f: (el.dataset.f as Formato) ?? 'brl', i: el.dataset.i ? Number(el.dataset.i) : undefined, n: Number(el.dataset.n) || 1 })
      contadores.set(k, lista)
    })
    // a linha da dívida, o ponto que corre nela e o valor que acompanha o ponto
    const linhaDivida = mundo.querySelector<SVGPathElement>('[data-divida]')!
    const pontoDivida = mundo.querySelector<SVGGElement>('[data-divida-ponto]')!
    const tagDivida = mundo.querySelector<HTMLElement>('[data-divida-tag]')!
    const compDivida = linhaDivida.getTotalLength()

    // medidas da área onde as telas aparecem; recalculadas no resize
    let cx = 0, cy = 0, aw = 0, ah = 0, reduzir = false, giroMax = 1
    let cam: Record<'fx' | 'fy' | 'fz' | 'a' | 's' | 'rx' | 'ry' | 'rz', (p: number) => number>
    const medir = () => {
      const w = sticky.clientWidth, h = sticky.clientHeight
      const celular = w <= 900
      // a escolha de animações do OpusCash (Configurações); o "menos movimento" do Windows não conta, como no resto do app
      reduzir = semMovimento()
      giroMax = reduzir ? 0 : celular ? 0.6 : 1 // tela estreita: ângulos mais contidos, senão o bloco em foco sai pela lateral
      if (celular) {
        const topo = Math.min(250, h * 0.3)
        cx = w / 2; cy = topo + (h - topo) / 2; aw = w * 0.96; ah = h - topo - 24
      } else {
        const esq = Math.min(460, w * 0.38)
        cx = esq + (w - esq) / 2; cy = h / 2; aw = w - esq - 40; ah = h * 0.84
      }
      sticky.style.setProperty('--cx', `${cx.toFixed(0)}px`)
      sticky.style.setProperty('--cy', `${cy.toFixed(0)}px`)
      sticky.style.setProperty('--persp', `${Math.max(1200, aw * 1.6).toFixed(0)}px`)
      const focos = CAMERA.map((q) => focoDe(q.alvo))
      const escalas = CAMERA.map((q, i) => {
        const f = focos[i], tudo = q.alvo === 'mundo' || !q.alvo.includes('.')
        // no celular a visão geral pode vazar um pouco das bordas (senão a tela fica minúscula);
        // de perto, sem passar de 1,3x o tamanho de desenho (fica nítido e não estoura a tela)
        const folga = tudo && celular ? 1.3 : 1
        return Math.min((aw * folga) / f.w, ah / f.h, tudo ? 9 : 1.3) * q.m
      })
      const ps = CAMERA.map((q) => q.p)
      cam = {
        fx: curva(ps, focos.map((f) => f.x)),
        fy: curva(ps, focos.map((f) => f.y)),
        fz: curva(ps, focos.map((f) => f.z)),
        a: curva(ps, CAMERA.map((q, i) => q.a ?? focos[i].a)),
        s: curva(ps, escalas.map(Math.log)), // zoom em escala log: aproximar e afastar no mesmo ritmo
        rx: curva(ps, CAMERA.map((q) => q.rx)),
        ry: curva(ps, CAMERA.map((q) => q.ry)),
        rz: curva(ps, CAMERA.map((q) => q.rz)),
      }
    }

    // só toca no DOM quando o valor muda: cada escrita à toa custa recálculo de estilo ou repintura
    const ultimo = new Map<string, string>()
    const por = (chave: string, valor: string, aplicar: (v: string) => void) => {
      if (ultimo.get(chave) !== valor) { ultimo.set(chave, valor); aplicar(valor) }
    }

    let cenaAtual = -1
    const desenhar = (p: number, tempo: number) => {
      // câmera: segue a curva do roteiro
      const fx = cam.fx(p), fy = cam.fy(p), fz = cam.fz(p), a = cam.a(p), s = Math.exp(cam.s(p))
      const giro = giroMax
      // um balanço leve e contínuo, para a tela nunca parecer congelada
      const bx = reduzir ? 0 : Math.sin(tempo * 0.00055) * 1.4, by = reduzir ? 0 : Math.cos(tempo * 0.00043) * 1.8
      const rx = cam.rx(p) * giro + bx, ry = cam.ry(p) * giro + by, rz = cam.rz(p) * giro
      mundo.style.transform = `scale3d(${s.toFixed(4)}, ${s.toFixed(4)}, ${s.toFixed(4)}) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) rotateZ(${rz.toFixed(2)}deg) rotateY(${(-a).toFixed(2)}deg) translate3d(${(-fx).toFixed(1)}px, ${(-fy).toFixed(1)}px, ${(-fz).toFixed(1)}px)`

      // só as telas perto da câmera ficam visíveis (as outras nem são pintadas); na visão final, todas
      const ci = a / PASSO + (TELAS.length - 1) / 2
      const geral = p > 0.915
      telas.forEach(({ t, el, blocos }, i) => {
        const perto = geral || Math.abs(i - ci) < 1.55
        por(`v${t}`, perto ? '' : 'hidden', (v) => { el.style.visibility = v })
        if (!perto) return
        // explosão em camadas; foco (sobe e acende) no bloco da vez, com os outros da tela um pouco apagados
        const explode = reduzir ? 0 : sino(EXPLODE[t], p)
        const pesos = blocos.map((b) => peso(FOCO[b.chave], p))
        const maior = Math.max(0, ...pesos)
        blocos.forEach((b, j) => {
          const f = pesos[j]
          const z = b.z * explode + (reduzir ? 0 : 70 * f)
          por(`t${b.chave}`, z < 0.05 && f < 0.001 ? '' : `translate3d(0, 0, ${z.toFixed(1)}px) scale(${(1 + 0.025 * f).toFixed(4)})`, (v) => { b.el.style.transform = v })
          // opacidade 1 escrita como vazio: opacidade abaixo de 1 achata o 3D de dentro do bloco
          const o = 1 - 0.6 * (maior - f)
          por(`o${b.chave}`, o > 0.999 ? '' : o.toFixed(3), (v) => { b.el.style.opacity = v })
          b.el.classList.toggle('em-foco', f > 0.5)
        })
      })

      // o que se anima dentro das telas
      for (const [k, { t, j, movimento }] of Object.entries(ANIM)) {
        const v = movimento && reduzir ? 0 : j.length === 4 ? sino(j, p) : suave(j[0], j[1], p)
        const txt = v.toFixed(3)
        por(`k${k}`, txt, () => {
          porTela[t].style.setProperty(`--k-${k}`, txt)
          contadores.get(k)?.forEach((c) => {
            const f = c.i === undefined ? Number(txt) : escalonar(Number(txt), c.i, c.n)
            c.el.textContent = formatar(c.f, c.v * f)
          })
          if (k === 'ano') {
            const pt = linhaDivida.getPointAtLength(compDivida * v)
            pontoDivida.setAttribute('transform', `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)})`)
            tagDivida.style.transform = `translate(${pt.x.toFixed(1)}px, ${pt.y.toFixed(1)}px)`
            tagDivida.textContent = dividaEm(pt.x)
          }
        })
      }

      const qual = FIM_CENA.findIndex((f) => p <= f)
      if (qual !== cenaAtual) { cenaAtual = qual; setCena(qual) }
    }

    // progresso alvo (do scroll) e progresso desenhado. O desenhado anda como uma mola amortecida (acelera e freia
    // sem tranco) e com velocidade máxima: num scroll rápido a animação não pula etapas, só corre no ritmo dela.
    let alvo = 0, atual = 0, vel = 0, antes = 0, quadro = 0, visivel = false
    const lerScroll = () => {
      const total = palco.offsetHeight - window.innerHeight
      alvo = total > 0 ? limitar(-palco.getBoundingClientRect().top / total) : 0
    }
    const RIGIDEZ = 42, AMORTECE = 2 * Math.sqrt(RIGIDEZ), VEL_MAX = 0.2 // VEL_MAX em progresso por segundo
    const laco = (agora: number) => {
      const dt = Math.min(0.05, (agora - (antes || agora)) / 1000)
      antes = agora
      if (reduzir) { atual = alvo; vel = 0 } else {
        // passos de no máximo 1/120 s, para a mola ficar estável mesmo quando um quadro atrasa
        for (let resto = dt; resto > 0; resto -= 1 / 120) {
          const h = Math.min(resto, 1 / 120)
          vel += (RIGIDEZ * (alvo - atual) - AMORTECE * vel) * h
          vel = limitar(vel, -VEL_MAX, VEL_MAX)
          atual += vel * h
        }
        if (Math.abs(alvo - atual) < 0.00005 && Math.abs(vel) < 0.0005) { atual = alvo; vel = 0 }
      }
      desenhar(atual, agora)
      quadro = visivel ? requestAnimationFrame(laco) : 0
    }
    const ligar = () => { if (!quadro) { antes = 0; quadro = requestAnimationFrame(laco) } }

    const obs = new IntersectionObserver(([e]) => { visivel = e.isIntersecting; if (visivel) { lerScroll(); ligar() } })
    obs.observe(palco)
    const aoScroll = () => lerScroll()
    const aoRedimensionar = () => { medir(); lerScroll(); desenhar(atual, performance.now()) }
    medir(); lerScroll(); atual = alvo; vel = 0; desenhar(atual, performance.now())
    window.addEventListener('scroll', aoScroll, { passive: true })
    window.addEventListener('resize', aoRedimensionar)
    return () => {
      obs.disconnect()
      window.removeEventListener('scroll', aoScroll)
      window.removeEventListener('resize', aoRedimensionar)
      if (quadro) cancelAnimationFrame(quadro)
    }
  }, [])

  // clicar numa bolinha do trilho leva àquela cena
  const irParaCena = (i: number) => {
    const el = palcoRef.current
    if (!el) return
    const topo = el.getBoundingClientRect().top + window.scrollY
    const total = el.offsetHeight - window.innerHeight
    window.scrollTo({ top: topo + total * CENAS[i].p, behavior: 'smooth' })
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
        {/* peças do OpusCash lançadas para o fundo, vagando atrás do texto */}
        <FundoOpus onde="topo" mouse />
        <div className="ap-hero-centro">
          <div className="ap-logo-flutuante">
            {/* o logo em imagem tem "OPUS" branco: no tema claro entra a marca desenhada */}
            <img className="ap-logo-escuro" src="/logo-opuscash.webp" alt={tx('OpusCash')} width={960} height={329} fetchPriority="high" />
            <span className="ap-logo-claro"><Marca grande /></span>
            <span className="ap-logo-brilho" />
          </div>
<h1 className="ap-h1">
            {tx('Seu dinheiro,')}<br /><em>{tx('infinitas')}</em> {tx('possibilidades')}
          </h1>
          <p className="ap-tagline">{tx('Controle financeiro com visual premium')}</p>
          <div className="ap-botoes">
            <button className="ap-btn ap-btn-cta" onClick={onSignup}>
              {tx('Começar grátis')} <Icone nome="seta" tamanho={17} />
            </button>
            <button className="ap-btn ap-btn-ghost" onClick={onLogin}>
              {tx('Já tenho conta')}
            </button>
          </div>
        </div>
        <div className="ap-scroll-hint">
          <span className="ap-scroll-mouse">
            <span className="ap-scroll-dot" />
          </span>
          <small>{tx('Role para explorar')}</small>
        </div>
      </section>

      {/* ─── O APP EM 3D ─── */}
      <section className="ap-palco" ref={palcoRef}>
        <div className="ap-palco-sticky" ref={stickyRef}>
          <div className="ap-luz" aria-hidden="true" />

          <div className="ap-palco-cena" aria-hidden="true">
            <div className="td-mundo" ref={mundoRef}>
              {TELAS.map((t, i) => {
                const L = lugar(i)
                return (
                  <div key={t} className="td-tela" data-tela={t}
                    style={{ width: DW, height: DH, transform: `translate3d(${(L.x - DW / 2).toFixed(1)}px, ${-DH / 2}px, ${L.z.toFixed(1)}px) rotateY(${L.a}deg)` }}>
                    <TelaDaApresentacao t={t} />
                  </div>
                )
              })}
            </div>
          </div>

          <div className="ap-cenas">
            <div className="ap-cena-pilha" aria-live="polite">
              {CENAS.map((c, i) => (
                <div key={c.titulo} className={`ap-cena-label ${cena === i ? 'ativa' : ''}`} aria-hidden={cena !== i}>
                  <span className="ap-cena-num">{String(i + 1).padStart(2, '0')} / {String(CENAS.length).padStart(2, '0')}</span>
                  <h2>{c.titulo}</h2>
                  <p>{c.texto}</p>
                </div>
              ))}
            </div>
            <div className="ap-trilho" role="tablist" aria-label={tx('Telas do OpusCash')}>
              {CENAS.map((c, i) => (
                <button key={c.titulo} role="tab" aria-selected={cena === i} aria-label={c.titulo}
                  className={`ap-trilho-ponto ${cena === i ? 'ativo' : ''}`} onClick={() => irParaCena(i)} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── O MOTOR: o algoritmo por trás do app ─── */}
      <Algoritmo />

      {/* ─── QUEM FAZ O OPUSCASH ─── */}
      <Fundadores />

      {/* ─── O PLANO ─── */}
      <Preco onLogin={onLogin} onSignup={onSignup} />

      {/* ─── FOOTER ─── */}
      <footer className="ap-footer">
        <Marca />
        <p>{tx('© {0} OpusCash · Todos os direitos reservados', ANO)}</p>
        <div className="ap-footer-links">
          <a href="#/termos">{tx('Termos')}</a>
          <a href="#/privacidade">{tx('Privacidade')}</a>
        </div>
      </footer>
    </div>
  )
}