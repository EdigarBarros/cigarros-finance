import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Icone } from '../components/Icone'
import { Marca } from '../components/Marca'

/**
 * Landing page do OpusCash. No meio dela, uma tela do app (montada em HTML, com dados de demonstração) flutua em 3D:
 * conforme a pessoa rola, a câmera gira em volta dela, os blocos se soltam em camadas, a câmera dá zoom em cada
 * ferramenta (gráfico, cartão, contas, metas) enquanto ela se anima, e no fim tudo se recolhe de volta numa tela só.
 * Tudo é escrito direto no DOM a cada quadro, a partir de um progresso suavizado: nada de re-render por pixel.
 */
const CENAS = [
  { titulo: 'Tudo num relance', texto: 'Quanto sobrou, quanto entrou e quanto saiu. Logo ao abrir.', p: 0.16 },
  { titulo: 'O ano inteiro', texto: 'Para onde foi o dinheiro, mês a mês.', p: 0.34 },
  { titulo: 'Cartões sob controle', texto: 'Fatura, parcelas e limite de cada cartão, no dia certo.', p: 0.48 },
  { titulo: 'Contas do mês', texto: 'Aluguel, luz, internet. Toque em “Paguei” e pronto.', p: 0.62 },
  { titulo: 'Metas que enchem', texto: 'Cada pote enche conforme você guarda.', p: 0.76 },
  { titulo: 'Tudo em um só lugar', texto: 'Seu dinheiro organizado, do jeito que deveria ser.', p: 0.95 },
] as const
/** Onde termina cada cena (progresso do scroll). */
const FIM_CENA = [0.27, 0.41, 0.55, 0.69, 0.84, 1]

/** A tela de demonstração é desenhada num tamanho fixo (px "de desenho") e escalada para caber. */
const DW = 1280, DH = 860
type Ret = [x: number, y: number, w: number, h: number]
const BLOCOS = {
  topo: [252, 34, 988, 76],
  k1: [252, 130, 316, 128],
  k2: [588, 130, 316, 128],
  k3: [924, 130, 316, 128],
  graf: [252, 278, 628, 282],
  cart: [900, 278, 340, 282],
  contas: [252, 580, 408, 246],
  metas: [680, 580, 560, 246],
} satisfies Record<string, Ret>
type Bloco = keyof typeof BLOCOS
const TUDO: Ret = [0, 0, DW, DH]
/** Quanto cada bloco sobe (eixo Z) quando a tela "explode" em camadas. */
const ALTURA: Record<Bloco, number> = { topo: 110, k1: 260, k2: 340, k3: 420, graf: 190, cart: 300, contas: 150, metas: 230 }
/** Janela de foco de cada ferramenta: [começa, termina]. */
const FOCO: Partial<Record<Bloco, [number, number]>> = { graf: [0.31, 0.38], cart: [0.45, 0.52], contas: [0.59, 0.66], metas: [0.73, 0.8] }

/** Roteiro da câmera: para onde olha (alvo), quanto aproxima (m, sobre o enquadramento do alvo) e de que ângulo. */
interface Quadro { p: number; alvo: Bloco | 'tudo'; m: number; rx: number; ry: number; rz: number }
const CAMERA: Quadro[] = [
  { p: 0, alvo: 'tudo', m: 0.74, rx: 48, ry: 0, rz: -12 },
  { p: 0.11, alvo: 'tudo', m: 0.86, rx: 16, ry: -22, rz: 2 },
  { p: 0.2, alvo: 'tudo', m: 0.8, rx: 22, ry: -34, rz: 5 },
  { p: 0.25, alvo: 'tudo', m: 0.8, rx: 18, ry: -30, rz: 3 },
  { p: 0.32, alvo: 'graf', m: 0.9, rx: 12, ry: 18, rz: -1 },
  { p: 0.38, alvo: 'graf', m: 0.9, rx: 6, ry: 10, rz: 0 },
  { p: 0.46, alvo: 'cart', m: 0.9, rx: 10, ry: -22, rz: 1 },
  { p: 0.52, alvo: 'cart', m: 0.9, rx: 5, ry: -12, rz: 0 },
  { p: 0.6, alvo: 'contas', m: 0.9, rx: 12, ry: 20, rz: -1 },
  { p: 0.66, alvo: 'contas', m: 0.9, rx: 7, ry: 12, rz: 0 },
  { p: 0.74, alvo: 'metas', m: 0.9, rx: 12, ry: -18, rz: 1 },
  { p: 0.8, alvo: 'metas', m: 0.9, rx: 6, ry: -10, rz: 0 },
  { p: 0.9, alvo: 'tudo', m: 0.92, rx: 0, ry: 0, rz: 0 },
  { p: 1, alvo: 'tudo', m: 0.9, rx: 8, ry: 0, rz: 0 },
]

const limitar = (n: number, a = 0, b = 1) => Math.min(b, Math.max(a, n))
const rampa = (a: number, b: number, x: number) => limitar((x - a) / (b - a))
const suave = (a: number, b: number, x: number) => {
  const t = rampa(a, b, x)
  return t * t * (3 - 2 * t)
}
const mistura = (a: number, b: number, t: number) => a + (b - a) * t
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
const peso = (j: [number, number] | undefined, p: number) => (j ? suave(j[0] - 0.07, j[0], p) * (1 - suave(j[1], j[1] + 0.07, p)) : 0)

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const KPIS = [
  { id: 'k1', titulo: 'Sobrou em outubro', valor: 1046.9, nota: 'R$ 209,60 a mais que em set', cor: 'var(--entrada)', icone: 'carteira' },
  { id: 'k2', titulo: 'Entrou no mês', valor: 8900, nota: '11% a mais que em set', cor: 'var(--caixa)', icone: 'receber' },
  { id: 'k3', titulo: 'Saiu no mês', valor: 7853.1, nota: '10% a mais que em set', cor: 'var(--saida)', icone: 'enviar' },
] as const
const MESES = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']
const ENTRADAS = [0.62, 0.66, 0.6, 0.7, 0.68, 0.74, 0.72, 0.78, 0.8, 0.86, 0.82, 0.9]
const SAIDAS = [0.55, 0.6, 0.64, 0.58, 0.66, 0.62, 0.7, 0.66, 0.72, 0.76, 0.7, 0.74]
const CONTAS = [
  { dia: 5, nome: 'Aluguel', valor: 'R$ 1.800,00' },
  { dia: 10, nome: 'Internet', valor: 'R$ 119,90' },
  { dia: 15, nome: 'Conta de luz', valor: 'R$ 182,40' },
  { dia: 20, nome: 'Academia', valor: 'R$ 99,90' },
]
const METAS = [
  { nome: 'Viagem', valor: 0.72, cor: 'var(--caixa)', falta: 'faltam R$ 840' },
  { nome: 'Reserva', valor: 0.48, cor: 'var(--entrada)', falta: 'faltam R$ 5.200' },
  { nome: 'Notebook', valor: 0.9, cor: 'var(--violeta)', falta: 'faltam R$ 380' },
]
const ARO = 2 * Math.PI * 42

const ANO = new Date().getFullYear()

const estiloBloco = (b: Bloco) => {
  const [x, y, w, h] = BLOCOS[b]
  return { left: x, top: y, width: w, height: h }
}

/** A tela do app em miniatura. Cada bloco com data-bloco é uma camada que a câmera move em 3D. */
function TelaDemo() {
  return (
    <>
      <aside className="td-lateral">
        <Marca compacta />
        <nav>
          {[['inicio', 'Início'], ['lista', 'Lançamentos'], ['calendario', 'Contas do mês'], ['cartao', 'Cartões'], ['divida', 'Dívidas'], ['meta', 'Metas'], ['ano', 'Resumo do ano']].map(([i, t], n) => (
            <span key={t} className={n === 0 ? 'ativo' : ''}><Icone nome={i} tamanho={17} />{t}</span>
          ))}
        </nav>
      </aside>

      <div className="td-bloco td-topo" data-bloco="topo" style={estiloBloco('topo')}>
        <div>
          <strong>Olá, <em>Marina!</em></strong>
          <span>Resumo de outubro de 2026. Você está no caminho certo!</span>
        </div>
        <div className="td-topo-botoes">
          <i className="td-pilula entrada"><Icone nome="sobe" tamanho={14} /> Lançar entrada</i>
          <i className="td-pilula saida"><Icone nome="desce" tamanho={14} /> Lançar saída</i>
        </div>
      </div>

      {KPIS.map((k) => (
        <div key={k.id} className="td-bloco td-kpi" data-bloco={k.id} style={{ ...estiloBloco(k.id), '--c': k.cor } as CSSProperties}>
          <span className="td-kpi-titulo"><i><Icone nome={k.icone} tamanho={16} /></i>{k.titulo}</span>
          <b className="td-kpi-valor" data-conta={k.valor}>{brl.format(k.valor)}</b>
          <small><Icone nome="sobe" tamanho={12} /> {k.nota}</small>
          <svg className="td-kpi-linha" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 24 C12 22 18 26 28 20 S46 10 56 16 S78 22 86 10 S96 4 100 3" pathLength={1} />
          </svg>
        </div>
      ))}

      <div className="td-bloco td-graf" data-bloco="graf" style={estiloBloco('graf')}>
        <header><strong>Resumo do ano</strong><span><i className="e" /> Entrou <i className="s" /> Saiu</span></header>
        <div className="td-barras">
          {MESES.map((m, i) => (
            <div key={i} className="td-mes" style={{ '--i': i } as CSSProperties}>
              <div className="td-par">
                <i className="e" style={{ height: `${ENTRADAS[i] * 100}%` }} />
                <i className="s" style={{ height: `${SAIDAS[i] * 100}%` }} />
              </div>
              <small>{m}</small>
            </div>
          ))}
        </div>
      </div>

      <div className="td-bloco td-cart" data-bloco="cart" style={estiloBloco('cart')}>
        <header><strong>Cartões</strong><span>faturas R$ 2.190,00</span></header>
        <div className="td-cartao-palco">
          <div className="td-cartao" data-cartao>
            <div className="td-cartao-frente">
              <span className="td-cartao-nome"><b>nu</b> Nubank</span>
              <i className="td-chip" />
              <small>fatura de outubro</small>
              <strong>R$ 780,00</strong>
              <span className="td-cartao-rodape">vence dia 10 <b>CRÉDITO</b></span>
              <i className="td-brilho" data-brilho />
            </div>
            <div className="td-cartao-verso"><i className="td-tarja" /><span>•••• 4821</span></div>
          </div>
        </div>
        <div className="td-limite"><span>Limite usado</span><span>livre R$ 4.520,00</span></div>
        <div className="td-trilha"><i data-fatura /></div>
      </div>

      <div className="td-bloco td-contas" data-bloco="contas" style={estiloBloco('contas')}>
        <header><strong>Contas do mês</strong><span data-falta>falta pagar R$ 2.202,20</span></header>
        <ul>
          {CONTAS.map((c) => (
            <li key={c.nome} data-conta-item>
              <span className="td-dia">{c.dia}<small>OUT</small></span>
              <span className="td-conta-nome">{c.nome}</span>
              <span className="td-conta-valor">{c.valor}</span>
              <i className="td-check"><Icone nome="check" tamanho={14} /></i>
            </li>
          ))}
        </ul>
      </div>

      <div className="td-bloco td-metas" data-bloco="metas" style={estiloBloco('metas')}>
        <header><strong>Metas</strong><span>3 potes enchendo</span></header>
        <div className="td-aros">
          {METAS.map((m) => (
            <div key={m.nome} className="td-meta" style={{ '--c': m.cor } as CSSProperties}>
              <svg viewBox="0 0 100 100" aria-hidden="true">
                <circle cx="50" cy="50" r="42" className="fundo" />
                <circle cx="50" cy="50" r="42" className="cheio" strokeDasharray={ARO} strokeDashoffset={ARO} data-aro={m.valor} />
              </svg>
              <b data-pct={m.valor}>{Math.round(m.valor * 100)}%</b>
              <strong>{m.nome}</strong>
              <small>{m.falta}</small>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

export function Apresentacao({ onLogin, onSignup }: { onLogin: () => void; onSignup: () => void }) {
  const palcoRef = useRef<HTMLElement>(null)
  const stickyRef = useRef<HTMLDivElement>(null)
  const telaRef = useRef<HTMLDivElement>(null)
  const [cena, setCena] = useState(0)

  useEffect(() => {
    const palco = palcoRef.current, sticky = stickyRef.current, tela = telaRef.current
    if (!palco || !sticky || !tela) return

    const camadas = (Object.keys(BLOCOS) as Bloco[]).map((b) => ({ b, el: tela.querySelector<HTMLElement>(`[data-bloco="${b}"]`)! }))
    const contadores = [...tela.querySelectorAll<HTMLElement>('[data-conta]')]
    const aros = [...tela.querySelectorAll<SVGCircleElement>('[data-aro]')]
    const pcts = [...tela.querySelectorAll<HTMLElement>('[data-pct]')]
    const itens = [...tela.querySelectorAll<HTMLElement>('[data-conta-item]')]
    const falta = tela.querySelector<HTMLElement>('[data-falta]')!
    const cartao = tela.querySelector<HTMLElement>('[data-cartao]')!
    const brilho = tela.querySelector<HTMLElement>('[data-brilho]')!
    const fatura = tela.querySelector<HTMLElement>('[data-fatura]')!
    const valoresContas = [1800, 119.9, 182.4, 99.9]

    const centro = (q: Quadro) => {
      const [x, y, w, h] = q.alvo === 'tudo' ? TUDO : BLOCOS[q.alvo]
      return [x + w / 2, y + h / 2]
    }

    // medidas da área onde a tela aparece; recalculadas no resize
    let cx = 0, cy = 0, aw = 0, ah = 0, reduzir = false, giroMax = 1
    // enquadramento (escala) de cada quadro da câmera, para o alvo dele caber na área
    let escalas: number[] = []
    let cam: Record<'fx' | 'fy' | 's' | 'rx' | 'ry' | 'rz', (p: number) => number>
    const medir = () => {
      const w = sticky.clientWidth, h = sticky.clientHeight
      const celular = w <= 900
      reduzir = window.matchMedia('(prefers-reduced-motion: reduce)').matches
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
      escalas = CAMERA.map((q) => {
        const [, , rw, rh] = q.alvo === 'tudo' ? TUDO : BLOCOS[q.alvo]
        // no celular a visão geral pode vazar um pouco das bordas (senão a tela fica minúscula);
        // de perto, sem passar de 1,3x o tamanho de desenho (fica nítido e não estoura a tela)
        const folga = q.alvo === 'tudo' && celular ? 1.3 : 1
        return Math.min((aw * folga) / rw, ah / rh, q.alvo === 'tudo' ? 9 : 1.3) * q.m
      })
      const ps = CAMERA.map((q) => q.p)
      cam = {
        fx: curva(ps, CAMERA.map((q) => centro(q)[0])),
        fy: curva(ps, CAMERA.map((q) => centro(q)[1])),
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

    let ultimaConta = -1, cenaAtual = -1
    const desenhar = (p: number, tempo: number) => {
      // câmera: segue a curva do roteiro
      const fx = cam.fx(p), fy = cam.fy(p), s = Math.exp(cam.s(p))
      const giro = giroMax
      // um balanço leve e contínuo, para a tela nunca parecer congelada
      const bx2 = reduzir ? 0 : Math.sin(tempo * 0.00055) * 1.4, by2 = reduzir ? 0 : Math.cos(tempo * 0.00043) * 1.8
      const rx = cam.rx(p) * giro + bx2, ry = cam.ry(p) * giro + by2, rz = cam.rz(p) * giro
      tela.style.transform = `scale3d(${s.toFixed(4)}, ${s.toFixed(4)}, ${s.toFixed(4)}) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) rotateZ(${rz.toFixed(2)}deg) translate3d(${(-fx).toFixed(1)}px, ${(-fy).toFixed(1)}px, 0)`

      // explosão em camadas no começo; foco (sobe e acende) na ferramenta da vez; no fim, tudo se recolhe
      const explode = reduzir ? 0 : suave(0.05, 0.16, p) * (1 - suave(0.22, 0.31, p))
      const pesos = camadas.map(({ b }) => peso(FOCO[b], p))
      const somaFoco = pesos.reduce((x, y) => x + y, 0)
      camadas.forEach(({ b, el }, j) => {
        const f = pesos[j]
        const z = ALTURA[b] * explode + (reduzir ? 0 : 70 * f)
        const esc = 1 + 0.025 * f
        por(`t${b}`, `translate3d(0, 0, ${z.toFixed(1)}px) scale(${esc.toFixed(4)})`, (v) => { el.style.transform = v })
        por(`o${b}`, (1 - 0.6 * (somaFoco - f)).toFixed(3), (v) => { el.style.opacity = v })
        el.classList.toggle('em-foco', f > 0.5)
      })

      // números contando
      const n = suave(0.02, 0.15, p)
      por('n', n.toFixed(3), (v) => {
        contadores.forEach((el) => { el.textContent = brl.format(Number(el.dataset.conta) * Number(v)) })
        tela.style.setProperty('--n', v)
      })
      // gráfico crescendo (cada mês um pouco depois do anterior)
      por('g', suave(0.26, 0.38, p).toFixed(3), (v) => tela.style.setProperty('--g', v))
      // cartão: sai da tela, dá uma volta inteira e volta; a fatura enche
      const giroCartao = suave(0.42, 0.52, p)
      const sobe = Math.sin(giroCartao * Math.PI)
      por('cartao', `translateZ(${(sobe * 60).toFixed(1)}px) rotateY(${(giroCartao * 360 * (reduzir ? 0 : 1)).toFixed(1)}deg) rotateX(${(sobe * 10 * giro).toFixed(1)}deg)`, (v) => { cartao.style.transform = v })
      por('brilho', `translateX(${mistura(-120, 220, suave(0.47, 0.53, p)).toFixed(1)}%) skewX(-18deg)`, (v) => { brilho.style.transform = v })
      por('fatura', `scaleX(${(0.42 * suave(0.46, 0.54, p)).toFixed(3)})`, (v) => { fatura.style.transform = v })
      // contas sendo pagas uma a uma
      const c = rampa(0.58, 0.68, p) * CONTAS.length
      const pagas = Math.floor(c + 0.0001)
      if (pagas !== ultimaConta) {
        ultimaConta = pagas
        itens.forEach((el, k) => el.classList.toggle('paga', k < pagas))
        const resto = valoresContas.slice(pagas).reduce((x, y) => x + y, 0)
        falta.textContent = resto > 0 ? `falta pagar ${brl.format(resto)}` : 'tudo pago ✓'
      }
      // metas enchendo
      const m = suave(0.71, 0.82, p)
      por('m', m.toFixed(3), (t) => {
        aros.forEach((el, k) => {
          const v = Number(el.dataset.aro) * limitar(Number(t) * 1.25 - k * 0.12)
          el.style.strokeDashoffset = (ARO * (1 - v)).toFixed(2)
          pcts[k].textContent = `${Math.round(v * 100)}%`
        })
      })

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
    const RIGIDEZ = 42, AMORTECE = 2 * Math.sqrt(RIGIDEZ), VEL_MAX = 0.24 // VEL_MAX em progresso por segundo
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

      {/* ─── O APP EM 3D ─── */}
      <section className="ap-palco" ref={palcoRef}>
        <div className="ap-palco-sticky" ref={stickyRef}>
          <div className="ap-luz" aria-hidden="true" />

          <div className="ap-palco-cena" aria-hidden="true">
            <div className="td-tela" ref={telaRef} style={{ width: DW, height: DH }}>
              <TelaDemo />
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
            <div className="ap-trilho" role="tablist" aria-label="Telas do OpusCash">
              {CENAS.map((c, i) => (
                <button key={c.titulo} role="tab" aria-selected={cena === i} aria-label={c.titulo}
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