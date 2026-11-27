import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { Analise } from '../lib/analise'
import type { Conselho } from '../lib/conselheiro'
import { falasDaTela, falasDoKairo, humorDe, humorDoTom, type FalaDoKairo } from '../lib/kairo'
import { tx } from '../lib/textos'
import type { Pagina } from '../pages/contexto'
import { Icone } from './Icone'
import { Kairo, KairoMarca, type Careta } from './Kairo'

/** As telas que ele já visitou voando nesta visita ao app: em cada uma, o passeio acontece uma vez só. */
const visitadas = new Set<string>()
/** O que ele já disse sozinho nesta visita: não repete o mesmo assunto de tela em tela. */
const jaFalou = new Set<string>()
let apresentou = false

/** Quanto tempo ele fica pousado falando antes de voltar para o canto (com o ponteiro em cima, espera). */
const TEMPO_POUSADO = 4200

type Fase = 'parado' | 'indo' | 'pousado' | 'voltando'
interface Ponto { x: number; y: number }
interface Dito { titulo: string; sub: string; f: FalaDoKairo | null; tom: string; careta: Careta }

/**
 * O Kairo solto, em todas as telas do painel menos a dele (o Consultor, onde ele está no topo). Feito como o assistente
 * do vídeo de referência:
 * - Fica no canto numa pílula ("Kairo"), boiando, com o humor do dinheiro e um número quando a tela aberta tem algo
 *   importante. Passando o ponteiro, ele sorri.
 * - Na primeira vez que a pessoa abre uma tela (em cada visita ao app), ele sai do canto voando (esticado na direção do
 *   voo), pousa em cima do primeiro cartão da tela (amassa ao pousar e solta uma ondinha), olha em volta lendo e diz o
 *   que viu num balãozinho: o mais importante da tela, ou que está tudo certo. Na primeira tela, se apresenta. Depois
 *   volta encolhendo para o canto. Tocar nele pousado abre o painel; tocar fora ou rolar a tela o manda de volta.
 * - Tocado no canto, abre o painel: ele grande no topo ("Oi, Marina. Eu sou o Kairo."), a nota e o que ele tem a dizer
 *   sobre a tela aberta (o plano de ação, o conselheiro e os sinais que levam a ela), com o botão que resolve, o
 *   "Agora não" dos conselhos, a análise completa e o Planejar o mês.
 * - Com "Animações reduzidas" ele não voa: só mostra o balão parado no canto quando a tela tem algo importante.
 * - "Esconder o Kairo" tira ele daqui; o interruptor do pé do Consultor traz de volta.
 */
export function KairoFlutuante({ pagina, nome, a, conselhos, irPara, aoDispensar, aoPlanejar, aoEsconder }: {
  pagina: Pagina
  /** O primeiro nome da pessoa, para ele cumprimentar. */
  nome: string
  a: Analise | null
  conselhos: Conselho[]
  irPara: (p: Pagina) => void
  aoDispensar: (idConselho: string) => void
  aoPlanejar: () => void
  aoEsconder: () => void
}) {
  const todas = useMemo(() => falasDoKairo(a, conselhos), [a, conselhos])
  const { daqui, deOutras } = useMemo(() => falasDaTela(pagina, todas), [pagina, todas])
  const importantes = daqui.filter((f) => f.tom === 'urgente' || f.tom === 'atencao').length
  const humorBase = humorDe(a, daqui.length ? daqui : todas)

  const [aberto, setAberto] = useState(false)
  const [sobre, setSobre] = useState(false)
  const painel = useRef<HTMLDivElement>(null)
  const doca = useRef<HTMLButtonElement>(null)

  // ---------- o passeio: voa até a tela, lê, fala e volta ----------
  const [fase, setFase] = useState<Fase>('parado')
  const [pos, setPos] = useState<Ponto>({ x: 0, y: 0 })
  const [de, setDe] = useState<Ponto>({ x: 0, y: 0 })
  const [careta, setCareta] = useState<Careta | null>(null)
  const [fala, setFala] = useState<Dito | null>(null)
  const timers = useRef<number[]>([])
  const sobreOVoador = useRef(false)
  const limpar = () => { timers.current.forEach((t) => window.clearTimeout(t)); timers.current = [] }
  const depois = (ms: number, f: () => void) => { timers.current.push(window.setTimeout(f, ms)) }

  const centroDaDoca = (): Ponto => {
    const r = doca.current?.querySelector('.kairo')?.getBoundingClientRect()
    return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: innerWidth - 50, y: innerHeight - 50 }
  }
  const voltar = () => {
    limpar()
    setFala(null)
    setCareta(null)
    setFase((f) => (f === 'parado' ? f : 'voltando'))
    setDe(pos)
    setPos(centroDaDoca())
    depois(850, () => setFase('parado'))
  }

  // o que dizer ao pousar nesta tela
  const primeira = daqui.find((f) => (f.tom === 'urgente' || f.tom === 'atencao') && !jaFalou.has(f.id))
  const oQueDizer = (): Dito => {
    if (!apresentou) return { titulo: nome ? tx('Oi, {0}! Eu sou o Kairo.', nome) : tx('Oi! Eu sou o Kairo.'), sub: tx('Seu consultor. Estou de olho nos seus números.'), f: null, tom: 'bom', careta: 'feliz' }
    if (primeira) return { titulo: primeira.titulo, sub: tx('Toque em mim para ver o que fazer'), f: primeira, tom: primeira.tom, careta: humorDoTom(primeira.tom) }
    return { titulo: tx('Dei uma olhada aqui. Nada pedindo atenção.'), sub: '', f: null, tom: 'bom', careta: 'feliz' }
  }

  useEffect(() => {
    if (aberto || visitadas.has(pagina)) return
    let t = 0
    const tentar = () => {
      // a abertura do app (components/Abertura.tsx) ainda na tela: espera ela sair
      if (document.querySelector('.abertura')) { t = window.setTimeout(tentar, 400); return }
      if (visitadas.has(pagina)) return
      visitadas.add(pagina)
      const dito = oQueDizer()
      if (dito.f) jaFalou.add(dito.f.id)
      if (document.documentElement.dataset.movimento === 'reduzido') {
        // sem voo: o balão parado no canto, só para se apresentar ou quando a tela tem algo importante
        if (dito.f || !apresentou) { apresentou = true; setFala(dito); depois(TEMPO_POUSADO + 2000, () => setFala(null)) }
        return
      }
      apresentou = true
      const alvo = alvoDaTela()
      const inicio = centroDaDoca()
      setDe(inicio); setPos(inicio); setFase('indo'); setCareta('surpreso')
      requestAnimationFrame(() => requestAnimationFrame(() => setPos(alvo)))
      // pousa, olha em volta lendo e fala com a cara do que achou
      depois(1000, () => setFase('pousado'))
      depois(1500, () => setCareta('pensando'))
      depois(2500, () => { setCareta(dito.careta); setFala(dito) })
      // depois da primeira cara, ele volta a viver sozinho (pisca, olha em volta) com o humor do que disse
      depois(3700, () => setCareta(null))
      depois(2500 + TEMPO_POUSADO, () => { if (!sobreOVoador.current) voltar() })
    }
    t = window.setTimeout(tentar, 900)
    return () => window.clearTimeout(t)
  }, [pagina, aberto]) // eslint-disable-line react-hooks/exhaustive-deps

  // trocar de tela, rolar ou tocar fora no meio do passeio: ele volta para o canto
  useEffect(() => () => limpar(), [])
  useEffect(() => {
    if (fase === 'parado' || fase === 'voltando') return
    const sair = () => voltar()
    const fora = (e: PointerEvent) => { if (!(e.target as Element).closest?.('.kairo-voador')) voltar() }
    window.addEventListener('wheel', sair, { passive: true })
    window.addEventListener('touchmove', sair, { passive: true })
    window.addEventListener('pointerdown', fora)
    window.addEventListener('hashchange', sair)
    return () => {
      window.removeEventListener('wheel', sair); window.removeEventListener('touchmove', sair)
      window.removeEventListener('pointerdown', fora); window.removeEventListener('hashchange', sair)
    }
  }, [fase]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- o painel ----------
  useEffect(() => {
    if (!aberto) return
    painel.current?.focus()
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') { setAberto(false); doca.current?.focus() } }
    const fora = (e: PointerEvent) => {
      const alvo = e.target as Node
      if (!painel.current?.contains(alvo) && !doca.current?.contains(alvo)) setAberto(false)
    }
    window.addEventListener('keydown', tecla)
    window.addEventListener('pointerdown', fora)
    return () => { window.removeEventListener('keydown', tecla); window.removeEventListener('pointerdown', fora) }
  }, [aberto])

  const abrir = () => { if (fase !== 'parado') voltar(); setFala(null); setAberto((x) => !x) }
  const ir = (f: FalaDoKairo) => { setAberto(false); irPara(f.destino as Pagina) }
  const frase = humorBase === 'preocupado' ? tx('Tem coisa pedindo atenção. Vamos por partes.')
    : humorBase === 'feliz' ? tx('Seu dinheiro está em ordem. Bom trabalho.')
      : tx('Estou de olho nos seus números.')
  const voando = fase !== 'parado'
  const humorDaDoca = fala?.f ? humorDoTom(fala.f.tom) : humorBase
  // a bolinha estica na direção do voo, como uma gota
  const angulo = Math.atan2(pos.y - de.y, pos.x - de.x)
  const grande = innerWidth < 601 ? 62 : 78

  return (
    <div className={`kairo-solto ${aberto ? 'aberto' : ''}`}>
      {fala && !voando && !aberto && (
        <div className={`kairo-balao ${fala.tom}`} role="status" aria-live="polite">
          <button className="kairo-balao-texto" onClick={fala.f ? abrir : () => setFala(null)}>
            <b>{fala.titulo}</b>
            {fala.sub && <span>{fala.sub}</span>}
          </button>
          <button className="kairo-balao-fechar" onClick={() => setFala(null)} aria-label={tx('Fechar')}><Icone nome="fechar" tamanho={13} /></button>
        </div>
      )}

      {aberto && (
        <div className="kairo-painel" ref={painel} tabIndex={-1} role="dialog" aria-label={tx('Kairo, seu consultor financeiro')}>
          <button className="kairo-painel-fechar" onClick={() => setAberto(false)} aria-label={tx('Fechar')}><Icone nome="fechar" tamanho={16} /></button>
          <header className="kairo-painel-cab">
            <Kairo humor={humorBase} tamanho={76} vivo flutua sombra segue />
            <strong>{nome ? tx('Oi, {0}. Eu sou o Kairo.', nome) : tx('Oi! Eu sou o Kairo.')}</strong>
            <KairoMarca sub={false} />
            <span className="kairo-painel-nota">
              {a?.nota != null ? tx('Nota {0} · {1}', a.nota, a.rotulo) : tx('Ainda aprendendo com os seus lançamentos')}
            </span>
          </header>
          <p className="kairo-painel-frase">{frase}</p>

          <div className="kairo-painel-falas">
            {pagina !== 'inicio' && <h4>{tx('Nesta tela')}</h4>}
            {daqui.length ? (
              <ul>{daqui.map((f, i) => <Fala key={f.id} f={f} i={i} aoIr={ir} aoDispensar={aoDispensar} aqui />)}</ul>
            ) : <p className="kairo-painel-vazio"><Icone nome="check" tamanho={15} /> {tx('Nesta tela, nada pede atenção agora.')}</p>}
            {deOutras.length > 0 && (
              <>
                <h4>{tx('Em outras telas')}</h4>
                <ul>{deOutras.map((f, i) => <Fala key={f.id} f={f} i={daqui.length + i} aoIr={ir} aoDispensar={aoDispensar} />)}</ul>
              </>
            )}
          </div>

          <footer className="kairo-painel-pe">
            <button className="btn primario" onClick={() => { setAberto(false); irPara('analise') }}><Icone nome="kairo" tamanho={16} /> {tx('Ver a análise completa')}</button>
            {a?.quadros && <button className="btn" onClick={() => { setAberto(false); aoPlanejar() }}><Icone nome="calendario" tamanho={16} /> {tx('Planejar o mês')}</button>}
            <button className="link kairo-esconder" onClick={() => { setAberto(false); aoEsconder() }}>{tx('Esconder o Kairo')}</button>
          </footer>
        </div>
      )}

      {/* no canto: a pílula com ele dentro (vazia enquanto ele passeia) */}
      <button ref={doca} className={`kairo-doca ${voando ? 'fora' : ''}`} onClick={abrir} aria-expanded={aberto}
        onPointerEnter={() => setSobre(true)} onPointerLeave={() => setSobre(false)}
        aria-label={importantes ? (importantes === 1 ? tx('Kairo: 1 coisa para ver nesta tela') : tx('Kairo: {0} coisas para ver nesta tela', importantes)) : tx('Falar com o Kairo, seu consultor')}
        title={tx('Kairo, seu consultor')}>
        <Kairo humor={humorDaDoca} careta={sobre || aberto ? 'feliz' : null} tamanho={34} vivo={!voando} segue />
        <span className="kairo-doca-nome">Kairo</span>
        {importantes > 0 && !aberto && <b className="kairo-ponto" aria-hidden="true">{importantes}</b>}
      </button>

      {/* o Kairo que voa pela tela */}
      {voando && (
        <div className={`kairo-voador ${fase}`} style={{ '--x': `${pos.x}px`, '--y': `${pos.y}px`, '--ang': `${angulo}rad`, '--g': `${grande}px` } as CSSProperties}
          onPointerEnter={() => { sobreOVoador.current = true }}
          onPointerLeave={() => { sobreOVoador.current = false }}>
          <button className="kairo-voador-bola" onClick={abrir} aria-label={tx('Falar com o Kairo, seu consultor')}>
            <span className="kairo-voador-estica"><Kairo humor={fala ? (fala.f ? humorDoTom(fala.f.tom) : 'feliz') : humorBase} careta={careta} tamanho={grande} vivo={fase === 'pousado'} sombra={fase === 'pousado'} /></span>
            {fase === 'pousado' && <span className="kairo-onda" aria-hidden="true" />}
          </button>
          {fala && fase === 'pousado' && (
            <button className={`kairo-voador-fala ${fala.tom}`} onClick={fala.f ? abrir : voltar} role="status" aria-live="polite">
              <b>{fala.titulo}</b>
              {fala.sub && <span>{fala.sub}</span>}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/** Onde ele pousa: perto do alto do primeiro cartão grande que aparece na tela (ou no meio da área da tela). */
function alvoDaTela(): Ponto {
  const largura = innerWidth, altura = innerHeight
  const celular = largura < 601
  const cartoes = [...document.querySelectorAll<HTMLElement>('.conteudo .cartao, .conteudo section')]
  const r = cartoes.map((c) => c.getBoundingClientRect()).find((x) => x.width > 220 && x.height > 90 && x.top > 70 && x.top < altura * 0.55)
  const x = r ? (celular ? largura / 2 : r.left + r.width * 0.6) : largura * 0.55
  const y = r ? r.top + Math.min(r.height / 2, 96) : altura * 0.42
  // longe das bordas, para o balão de cima caber
  return { x: Math.max(150, Math.min(largura - 150, x)), y: Math.max(170, Math.min(altura - 150, y)) }
}

function Fala({ f, i, aoIr, aoDispensar, aqui }: { f: FalaDoKairo; i: number; aoIr: (f: FalaDoKairo) => void; aoDispensar: (id: string) => void; aqui?: boolean }) {
  return (
    <li className={`kairo-fala ${f.tom}`} style={{ '--i': i } as CSSProperties}>
      <span className="kairo-fala-ic" aria-hidden="true"><Icone nome={f.icone} tamanho={16} /></span>
      <span className="kairo-fala-texto">
        <b>{f.titulo}</b>
        {aqui && <small>{f.texto}</small>}
        <span className="kairo-fala-acoes">
          <button className="link" onClick={() => aoIr(f)}>{f.botao || tx('Ver')} <Icone nome="seta" tamanho={13} /></button>
          {f.origem === 'conselho' && <button className="link kairo-agora-nao" onClick={() => aoDispensar(f.idOrigem)}>{tx('Agora não')}</button>}
        </span>
      </span>
    </li>
  )
}
