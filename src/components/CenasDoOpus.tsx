import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { LOCAL_DAS_DATAS, MESES_CURTO, MESES_NOME, fmtMesAno, noMeioDaFrase } from '../lib/format'
import { semMovimento } from '../lib/tema'
import { tx } from '../lib/textos'
import { Icone } from './Icone'
import { IconeCategoria } from './IconeCategoria'
import { PoteMeta } from './PoteMeta'
import './cenas-opus.css'

/*
 * O fundo da tela "Quem está usando?" (components/EscolherConta.tsx): cenas em 3D, uma depois da outra e em loop, mostrando
 * o que o OpusCash faz. Nada aqui é dado de alguém: os valores são inventados para a vitrine.
 *
 * Como o 3D funciona: cada peça (`P`) é um ponto de tamanho zero no centro do palco, com a perspectiva, o balanço do mundo
 * (--wx/--wy, que o palco anima) e a pose da peça (onde ela fica). Como todas giram em volta do mesmo ponto, parecem estar
 * no mesmo espaço, vistas pela mesma câmera. O conteúdo (`.cn-in`) entra com a animação dele. Nenhuma opacidade no meio da
 * cadeia 3D: quem some e aparece é o conteúdo, ou a cena inteira (que fica fora do 3D).
 * Com animações reduzidas (Configurações), tudo aparece já no fim e as cenas só trocam.
 */

// ---------- números ----------

const formatos = new Map<string, Intl.NumberFormat>()
function din(v: number, moeda = 'BRL', casas = 2) {
  const k = `${moeda}:${casas}`
  let f = formatos.get(k)
  if (!f) {
    f = new Intl.NumberFormat(LOCAL_DAS_DATAS, { style: 'currency', currency: moeda, minimumFractionDigits: casas, maximumFractionDigits: casas })
    formatos.set(k, f)
  }
  return f.format(v)
}
const din0 = (v: number) => din(v, 'BRL', 0)
const porcento = new Intl.NumberFormat(LOCAL_DAS_DATAS, { style: 'percent', maximumFractionDigits: 0 })
const pct = (v: number) => porcento.format(v / 100)
const variacao = new Intl.NumberFormat(LOCAL_DAS_DATAS, { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1, signDisplay: 'always' })

/** Um número que corre de `de` até `ate`, começando `d` segundos depois de a cena entrar. */
function Conta({ de = 0, ate, d = 0, dur = 1.4, f }: { de?: number; ate: number; d?: number; dur?: number; f: (n: number) => string }) {
  const [v, setV] = useState(() => (semMovimento() ? ate : de))
  useEffect(() => {
    if (semMovimento()) return
    let raf = 0
    const t0 = performance.now() + d * 1000
    const passo = (t: number) => {
      const k = Math.min(1, Math.max(0, (t - t0) / (dur * 1000)))
      setV(de + (ate - de) * (1 - Math.pow(1 - k, 3)))
      if (k < 1) raf = requestAnimationFrame(passo)
    }
    raf = requestAnimationFrame(passo)
    return () => cancelAnimationFrame(raf)
  }, [de, ate, d, dur])
  return <span className="cn-num">{f(v)}</span>
}

/** Passa por cada valor de `passos` na hora marcada (segundos). Com animações reduzidas, já começa no último. */
function useLinhaDoTempo<T>(passos: [number, T][]): T {
  const [v, setV] = useState<T>(() => passos[semMovimento() ? passos.length - 1 : 0][1])
  useEffect(() => {
    if (semMovimento()) return
    const ts = passos.slice(1).map(([s, x]) => window.setTimeout(() => setV(x), s * 1000))
    return () => ts.forEach(clearTimeout)
    // os passos são fixos em cada cena
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return v
}

// ---------- peças ----------

type Anim = 'surge' | 'cai' | 'lado' | 'cresce' | 'gira'

/**
 * Uma peça no palco. `p`: a pose no palco largo (computador); `e`: no estreito (celular), quando muda. `d`: atraso da
 * entrada, em segundos. `tresD`: o conteúdo tem 3D dentro (anel, colunas): entra sem mexer na opacidade.
 * `largo`: só aparece no palco largo.
 */
function P({ p, e, d = 0, a = 'surge', tresD, largo, className = '', children }: {
  p: string; e?: string; d?: number; a?: Anim; tresD?: boolean; largo?: boolean; className?: string; children: ReactNode
}) {
  return (
    <div className={`cn-peca ${largo ? 'cn-so-largo' : ''}`} style={{ '--pose': p, '--pose-e': e ?? p } as CSSProperties}>
      <div className={`cn-in a-${a} ${tresD ? 'tres-d' : ''} ${className}`} style={{ animationDelay: `${d}s` }}>{children}</div>
    </div>
  )
}

/** Atraso de um pedaço dentro da peça (segundos). */
const em = (d: number, extra?: CSSProperties) => ({ '--d': `${d}s`, ...extra } as CSSProperties)

function Cab({ icone, titulo, sub }: { icone: string; titulo: string; sub?: string }) {
  return (
    <div className="cn-cab">
      <span className="cn-chip"><Icone nome={icone} tamanho={16} /></span>
      <span><b>{titulo}</b>{sub && <small>{sub}</small>}</span>
    </div>
  )
}

function Barra({ de = 0, ate, d, cor }: { de?: number; ate: number; d: number; cor?: string }) {
  return (
    <span className="cn-barra" style={cor ? { '--c': cor } as CSSProperties : undefined}>
      <i style={em(d, { '--de': de / 100, '--ate': ate / 100 } as CSSProperties)} />
    </span>
  )
}

// ---------- 1. Lançamentos ----------

const LANCAMENTOS = [
  { e: '💼', n: () => tx('Salário'), v: 5200, m: 'BRL', entra: true },
  { e: '🛒', n: () => tx('Mercado'), v: 312.4, m: 'BRL' },
  { e: '🧑‍💻', n: () => tx('Freela para fora'), v: 450, m: 'USD', entra: true, real: 2430 },
  { e: '✈️', n: () => tx('Hotel em Lisboa'), v: 120, m: 'EUR', real: 702 },
  { e: '📺', n: () => tx('Streaming'), v: 39.9, m: 'BRL' },
]
// quanto saiu em cada dia do mês (0 a 4); o dia 12 é o que mais pesou
const CALOR = [0, 1, 0, 2, 3, 1, 0, 1, 2, 0, 1, 4, 2, 1, 0, 1, 2, 0, 1, 3, 0, 2, 1, 0, 2, 1, 0, 1, 3, 1]
const MOEDAS = [['R$', 'BRL'], ['US$', 'USD'], ['€', 'EUR'], ['£', 'GBP'], ['¥', 'JPY'], ['Fr', 'CHF']] // sem-tx

function CenaLancamentos() {
  return (
    <>
      <P p="translate3d(-150px, -6px, 0) rotateY(13deg)" e="translate3d(-28px, -22px, 0) rotateY(9deg)" d={0.1}>
        <div className="cn-painel" style={{ width: 296 }}>
          <Cab icone="lista" titulo={tx('Lançamentos')} sub={noMeioDaFrase(MESES_NOME[10])} />
          {LANCAMENTOS.map((l, k) => (
            <div key={k} className="cn-linha cn-vem" style={em(0.5 + k * 0.5)}>
              <span className="cn-ic" style={{ '--c': l.entra ? 'var(--entrada)' : 'var(--saida)' } as CSSProperties}>
                <IconeCategoria emoji={l.e} tamanho={15} />
              </span>
              <span className="cn-txt"><b>{l.n()}</b>{l.real && <small>≈ {din(l.real)}</small>}</span>
              <b className={l.entra ? 'cn-entra' : 'cn-sai'}>{l.entra ? '+' : '−'}{din(l.v, l.m)}</b>
            </div>
          ))}
          <div className="cn-total cn-vem" style={em(3.1)}>
            <span>{tx('Sobrou no mês')}</span>
            <b className="cn-entra"><Conta ate={6575.7} d={3.2} f={din} /></b>
          </div>
        </div>
      </P>
      <P p="translate3d(178px, -92px, -110px) rotateY(-18deg)" e="translate3d(118px, -168px, -170px) rotateY(-16deg)" d={1.6} a="lado">
        <div className="cn-painel cn-cal" style={{ width: 232 }}>
          <Cab icone="calendario" titulo={tx('Onde mais saiu')} />
          <div className="cn-dias">
            {CALOR.map((n, k) => (
              <i key={k} className={`q${n} ${k === 11 ? 'topo' : ''}`} style={em(2 + k * 0.035)}>{k + 1}</i>
            ))}
          </div>
          <span className="cn-dica cn-vem" style={em(3.4)}><b>{tx('Dia {0}', 12)}</b> {din(890)}</span>
        </div>
      </P>
      <P p="translate3d(196px, 118px, 80px)" e="translate3d(128px, 150px, 70px)" d={1.1} a="cresce" tresD>
        <div className="cn-carrossel">
          <div className="cn-anel">
            {MOEDAS.map(([s, c], k) => (
              <span key={c} className="cn-moeda" style={{ '--k': k } as CSSProperties}>
                <span className="cn-moeda-face"><b translate="no">{s}</b><small translate="no">{c}</small></span>
              </span>
            ))}
          </div>
          <span className="cn-etiqueta">{tx('Várias moedas')}</span>
        </div>
      </P>
    </>
  )
}

// ---------- 2. Consultor ----------

const DADOS = [
  { t: () => tx('Mercado +18%'), x: -210, y: -130 },
  { t: () => tx('Salário caiu dia 5'), x: -230, y: 30 },
  { t: () => tx('3 assinaturas'), x: -150, y: 150 },
  { t: () => tx('Fatura fecha dia 5'), x: -40, y: -170 },
  { t: () => tx('Meta da viagem'), x: 40, y: 170 },
]
const BARRAS_CONSULTOR = [42, 64, 38, 80, 55, 92]

function CenaConsultor() {
  // as peças da tela montada ficam todas na mesma pose, cada uma na sua altura
  const tela = 'translate3d(122px, 0, 0) rotateY(-15deg)'
  const telaE = 'translate3d(36px, 30px, 0) rotateY(-10deg)'
  const bloco = (y: number, z = 22) => `${tela} translate3d(0, ${y}px, ${z}px)`
  const blocoE = (y: number, z = 22) => `${telaE} translate3d(0, ${y}px, ${z}px)`
  return (
    <>
      <P p="translate3d(-170px, -10px, 50px)" e="translate3d(-120px, -150px, 60px)" d={0} a="cresce">
        <div className="cn-orbe">
          <i className="cn-onda" /><i className="cn-onda" style={em(1.2)} />
          <span className="cn-orbe-miolo"><Icone nome="ideia" tamanho={34} /></span>
          {DADOS.map((x, k) => (
            <span key={k} className="cn-dado" style={em(0.4 + k * 0.45, { '--x': `${x.x}px`, '--y': `${x.y}px` } as CSSProperties)}>{x.t()}</span>
          ))}
        </div>
      </P>
      <P p={tela} e={telaE} d={1.2} a="lado">
        <div className="cn-painel cn-moldura" style={{ width: 270, height: 300 }} />
      </P>
      <P p={bloco(-112)} e={blocoE(-112)} d={2.0} a="cai">
        <div className="cn-bloco cn-bloco-cab" style={{ width: 236 }}>
          <span className="cn-ponto" /><b>{tx('Sua tela de hoje')}</b>
        </div>
      </P>
      <P p={bloco(-48)} e={blocoE(-48)} d={2.5} a="cai">
        <div className="cn-bloco" style={{ width: 236 }}>
          <small>{tx('Sobra prevista no fim do mês')}</small>
          <b className="cn-grande cn-entra"><Conta ate={640} d={2.7} f={din0} /></b>
        </div>
      </P>
      <P p={bloco(28)} e={blocoE(28)} d={3.0} a="cai">
        <div className="cn-bloco cn-colunas" style={{ width: 236 }}>
          {BARRAS_CONSULTOR.map((h, k) => <i key={k} style={em(3.2 + k * 0.08, { '--h': `${h}%` } as CSSProperties)} />)}
        </div>
      </P>
      <P p={bloco(102)} e={blocoE(102)} d={3.5} a="cai">
        <div className="cn-bloco cn-conselho" style={{ width: 236 }}>
          <span className="cn-chip"><Icone nome="ideia" tamanho={15} /></span>
          <span>{tx('Corte {0} em assinaturas e feche o mês no azul.', din0(90))}</span>
        </div>
      </P>
      <P p="translate3d(-150px, 136px, 70px)" e="translate3d(-96px, -48px, 90px)" d={4.2} a="surge">
        <div className="cn-fala">
          <span className="cn-digitando"><i /><i /><i /></span>
          <span className="cn-fala-texto">{tx('Montei sua tela com o que importa agora.')}</span>
        </div>
      </P>
    </>
  )
}

// ---------- 3. Contas do mês ----------

function CenaContas() {
  const pote = useLinhaDoTempo<number>([[0, 0.42], [4.4, 0.6], [5.5, 0.78]])
  const internet = useLinhaDoTempo<0 | 1 | 2>([[0, 0], [3.4, 1], [4.4, 2]])
  const academia = useLinhaDoTempo<boolean>([[0, false], [5.5, true]])
  const pago = useLinhaDoTempo<number>([[0, 970], [4.4, 1089.9], [5.5, 1179.9]])
  return (
    <>
      <P p="translate3d(-176px, -10px, 30px) rotateY(15deg)" e="translate3d(-62px, -120px, 30px) rotateY(10deg)" d={0.1}>
        <div className="cn-painel cn-form" style={{ width: 250 }}>
          <Cab icone="calendario" titulo={tx('Nova conta do mês')} />
          <label className="cn-campo"><small>{tx('Nome')}</small><span className="cn-digita" style={em(0.6)}>{tx('Internet')}</span></label>
          <label className="cn-campo"><small>{tx('Vence')}</small><span className="cn-digita" style={em(1.3)}>{tx('Todo dia {0}', 10)}</span></label>
          <label className="cn-campo"><small>{tx('Valor')}</small><span className="cn-digita" style={em(2.0)}>{din(119.9)}</span></label>
          <span className="cn-botao" style={em(2.8)}><Icone nome="check" tamanho={15} />{tx('Salvar conta')}</span>
        </div>
      </P>
      <P p="translate3d(40px, 30px, 90px)" e="translate3d(96px, 40px, 110px)" d={0.6} a="cresce">
        <div className="cn-pote">
          <PoteMeta progresso={pote} cor="#4ea3ff" icone="🧾" tamanho={150} />
          <span className="cn-etiqueta"><Conta key={pago} de={pago === 970 ? 970 : pago - 100} ate={pago} dur={0.8} f={din0} /> {tx('pagos')}</span>
        </div>
      </P>
      <P p="translate3d(228px, -60px, -90px) rotateY(-18deg)" e="translate3d(-80px, 112px, -40px) rotateY(10deg)" d={1.0} a="lado">
        <div className="cn-painel" style={{ width: 220 }}>
          <Cab icone="lista" titulo={tx('Contas do mês')} />
          <div className="cn-conta pago"><Icone nome="check" tamanho={14} /><span>{tx('Aluguel')}</span><b>{din0(850)}</b></div>
          <div className="cn-conta pago"><Icone nome="check" tamanho={14} /><span>{tx('Luz')}</span><b>{din0(120)}</b></div>
          {internet > 0 && (
            <div className={`cn-conta nova ${internet === 2 ? 'pago' : ''}`}><Icone nome={internet === 2 ? 'check' : 'relogio'} tamanho={14} /><span>{tx('Internet')}</span><b>{din0(120)}</b></div>
          )}
          <div className={`cn-conta ${academia ? 'pago' : ''}`}><Icone nome={academia ? 'check' : 'relogio'} tamanho={14} /><span>{tx('Academia')}</span><b>{din0(90)}</b></div>
          <div className="cn-conta"><Icone nome="relogio" tamanho={14} /><span>{tx('Condomínio')}</span><b>{din0(540)}</b></div>
        </div>
      </P>
    </>
  )
}

// ---------- 4. Cartões ----------

const PLASTICOS = [
  { c1: '#2b3242', c2: '#0b0f19', fim: '7702', p: 'translate3d(-214px, -40px, -80px) rotateY(32deg) rotateZ(-10deg)', e: 'translate3d(-70px, -190px, -90px) rotateY(18deg) rotateZ(-8deg)' },
  { c1: '#ff8a3d', c2: '#d6372b', fim: '3310', p: 'translate3d(-186px, 0px, -20px) rotateY(28deg) rotateZ(-4deg)', e: 'translate3d(-40px, -168px, -30px) rotateY(16deg) rotateZ(-3deg)' },
  { c1: '#9b6bff', c2: '#4b2bd1', fim: '4821', p: 'translate3d(-158px, 40px, 40px) rotateY(24deg) rotateZ(2deg)', e: 'translate3d(-10px, -146px, 30px) rotateY(14deg) rotateZ(3deg)' },
]
const COMPRAS = [
  { e: '🛍️', n: () => tx('Loja de roupas'), p: () => tx('Parcela {0} de {1}', 3, 10), v: 89.9 },
  { e: '✈️', n: () => tx('Passagem'), p: () => tx('Parcela {0} de {1}', 2, 6), v: 210 },
  { e: '🍽️', n: () => tx('Restaurante'), p: () => tx('À vista'), v: 132.5 },
]

function CenaCartoes() {
  return (
    <>
      {PLASTICOS.map((c, k) => (
        <P key={c.fim} p={c.p} e={c.e} d={0.1 + k * 0.25} a="gira">
          <div className="cn-plastico" style={{ '--c1': c.c1, '--c2': c.c2 } as CSSProperties}>
            <span className="cn-plastico-topo"><i className="cn-chip-ouro" /><Icone nome="cartao" tamanho={18} /></span>
            <span className="cn-plastico-num" translate="no">•••• {c.fim}</span>
            <small>{tx('CRÉDITO')}</small>
            <i className="cn-brilho" />
          </div>
        </P>
      ))}
      <P p="translate3d(120px, 0, 20px) rotateY(-14deg)" e="translate3d(14px, 82px, 40px) rotateY(-8deg)" d={0.9} a="lado">
        <div className="cn-painel" style={{ width: 290 }}>
          <Cab icone="cartao" titulo={tx('Fatura de {0}', noMeioDaFrase(MESES_NOME[11]))} sub={tx('Fecha dia {0} · vence dia {1}', 5, 12)} />
          <b className="cn-grande"><Conta ate={1842.3} d={1.2} dur={1.8} f={din} /></b>
          <div className="cn-limite"><small>{tx('Limite usado')}</small><small><Conta ate={62} d={1.6} f={pct} /></small></div>
          <Barra ate={62} d={1.6} cor="var(--violeta)" />
          {COMPRAS.map((c, k) => (
            <div key={k} className="cn-linha cn-vem" style={em(2.4 + k * 0.45)}>
              <span className="cn-ic" style={{ '--c': 'var(--violeta)' } as CSSProperties}><IconeCategoria emoji={c.e} tamanho={15} /></span>
              <span className="cn-txt"><b>{c.n()}</b><small>{c.p()}</small></span>
              <b>{din(c.v)}</b>
            </div>
          ))}
        </div>
      </P>
    </>
  )
}

// ---------- 5. Dívidas ----------

function CenaDividas() {
  const pagas = 9
  return (
    <>
      <P p="translate3d(-40px, -4px, 30px) rotateY(10deg)" e="translate3d(0, -40px, 30px) rotateY(6deg)" d={0.1}>
        <div className="cn-painel" style={{ width: 300 }}>
          <Cab icone="divida" titulo={tx('Empréstimo pessoal')} sub={tx('24 parcelas de {0}', din0(350))} />
          <small className="cn-rotulo">{tx('Falta pagar')}</small>
          <b className="cn-grande"><Conta de={5250} ate={3850} d={1} dur={2.6} f={din0} /></b>
          <Barra de={38} ate={54} d={1} cor="var(--entrada)" />
          <div className="cn-parcelas">
            {Array.from({ length: 24 }, (_, k) => (
              <i key={k} className={`${k < pagas + 4 ? 'paga' : ''} ${k >= pagas && k < pagas + 4 ? 'agora' : ''}`} style={k >= pagas ? em(1.1 + (k - pagas) * 0.55) : undefined} />
            ))}
          </div>
          <small className="cn-rotulo"><Conta de={pagas} ate={pagas + 4} d={1.1} dur={2.2} f={(n) => tx('{0} de 24 parcelas pagas', Math.round(n))} /></small>
        </div>
      </P>
      <P p="translate3d(214px, -112px, -50px) rotateY(-16deg)" e="translate3d(92px, -196px, -40px) rotateY(-10deg)" d={3.6} a="cresce">
        <div className="cn-selo-grande">
          <Icone nome="bandeira" tamanho={22} />
          <span><small>{tx('Acaba em')}</small><b>{fmtMesAno(2027, 8)}</b></span>
        </div>
      </P>
      <P p="translate3d(-250px, 150px, 90px) rotateY(16deg)" e="translate3d(-60px, 196px, 70px) rotateY(8deg)" d={1.4} a="lado">
        <div className="cn-painel cn-mini" style={{ width: 230 }}>
          <div className="cn-divida"><span>{tx('Cheque especial')}</span><Barra de={70} ate={0} d={2.2} cor="var(--saida)" /><em className="cn-quitada" style={em(3.4)}><Icone nome="check" tamanho={12} />{tx('Quitada')}</em></div>
          <div className="cn-divida"><span>{tx('Cartão atrasado')}</span><Barra de={85} ate={48} d={2.4} cor="var(--divida)" /></div>
        </div>
      </P>
    </>
  )
}

// ---------- 6. Metas ----------

function Anel({ ate, d, cor, tam = 180, esp = 14 }: { ate: number; d: number; cor: string; tam?: number; esp?: number }) {
  const r = (tam - esp) / 2
  const c = 2 * Math.PI * r
  return (
    <svg className="cn-anel-meta" width={tam} height={tam} viewBox={`0 0 ${tam} ${tam}`} aria-hidden="true">
      <circle cx={tam / 2} cy={tam / 2} r={r} className="cn-anel-trilho" strokeWidth={esp} />
      <circle cx={tam / 2} cy={tam / 2} r={r} stroke={cor} strokeWidth={esp} strokeLinecap="round" className="cn-anel-valor"
        style={em(d, { '--c': c, '--fim': c * (1 - ate / 100) } as CSSProperties)} />
    </svg>
  )
}

function CenaMetas() {
  return (
    <>
      <P p="translate3d(-80px, -10px, 40px) rotateY(10deg)" e="translate3d(-20px, -70px, 40px) rotateY(6deg)" d={0.1} a="cresce">
        <div className="cn-meta-grande">
          <Anel ate={72} d={0.5} cor="var(--entrada)" />
          <span className="cn-meta-miolo">
            <IconeCategoria emoji="✈️" tamanho={26} />
            <b><Conta ate={72} d={0.5} dur={2} f={pct} /></b>
            <small>{tx('Viagem')}</small>
          </span>
          {[0, 1, 2, 3].map((k) => <i key={k} className="cn-moedinha" style={em(0.6 + k * 0.5, { '--x': `${(k % 2 ? 1 : -1) * (14 + k * 6)}px` } as CSSProperties)} />)}
        </div>
      </P>
      <P p="translate3d(-80px, 140px, 90px)" e="translate3d(-20px, 70px, 90px)" d={2.6} a="surge">
        <div className="cn-pilula"><Conta ate={7200} d={0.4} dur={2} f={din0} /> {tx('de {0}', din0(10000))}</div>
      </P>
      <P p="translate3d(200px, -10px, -70px) rotateY(-18deg)" e="translate3d(40px, 156px, -20px) rotateY(-6deg)" d={0.9} a="lado">
        <div className="cn-painel" style={{ width: 240 }}>
          <Cab icone="meta" titulo={tx('Suas metas')} />
          <div className="cn-divida"><span>{tx('Reserva de emergência')}</span><Barra ate={54} d={1.5} cor="var(--caixa)" /></div>
          <div className="cn-divida"><span>{tx('Notebook novo')}</span><Barra ate={100} d={1.8} cor="var(--violeta)" /><em className="cn-quitada" style={em(3.2)}><Icone nome="check" tamanho={12} />{tx('Concluída')}</em></div>
        </div>
      </P>
      <P p="translate3d(176px, -150px, 20px)" e="translate3d(120px, -180px, 20px)" d={3.6} a="cresce" largo>
        <div className="cn-selo-grande"><Icone nome="calendario" tamanho={20} /><span><small>{tx('Chega em')}</small><b>{fmtMesAno(2027, 3)}</b></span></div>
      </P>
    </>
  )
}

// ---------- 7. Dinheiro guardado ----------

const GUARDADO = [
  { n: () => tx('Reserva'), v: 9800, h: 150, c: '#14c9a0' },
  { n: () => tx('Viagem'), v: 5230, h: 96, c: '#4ea3ff' },
  { n: () => tx('Poupança'), v: 3400, h: 70, c: '#8b7cf6' },
]

function Coluna({ h, c, d, neg }: { h: number; c: string; d: number; neg?: boolean }) {
  return (
    <span className={`cn-coluna ${neg ? 'neg' : ''}`} style={em(d, { '--h': `${h}px`, '--c': c } as CSSProperties)}>
      <i className="frente" /><i className="lado" /><i className="tampa" />
    </span>
  )
}

function CenaGuardado() {
  return (
    <>
      <P p="translate3d(70px, 40px, 0) rotateX(-12deg) rotateY(-26deg)" e="translate3d(30px, 40px, 0) rotateX(-12deg) rotateY(-24deg)" d={0} a="cresce" tresD>
        <div className="cn-pilhas">
          {GUARDADO.map((g, k) => (
            <span key={k} className="cn-pilha">
              <b className="cn-vem" style={em(1.2 + k * 0.3)}>{din0(g.v)}</b>
              <Coluna h={g.h} c={g.c} d={0.3 + k * 0.25} />
              <small>{g.n()}</small>
            </span>
          ))}
        </div>
      </P>
      <P p="translate3d(-230px, -110px, 60px) rotateY(14deg)" e="translate3d(-60px, -190px, 60px) rotateY(8deg)" d={0.5} a="lado">
        <div className="cn-painel" style={{ width: 250 }}>
          <Cab icone="cofre" titulo={tx('Dinheiro guardado')} />
          <b className="cn-grande"><Conta ate={18430} d={0.8} dur={2.2} f={din} /></b>
          <span className="cn-pilula cn-entra cn-vem" style={em(2.4)}><Icone nome="sobe" tamanho={13} />{tx('{0} de rendimento este mês', din(142.8))}</span>
        </div>
      </P>
    </>
  )
}

// ---------- 8. Resumo do ano ----------

// o que sobrou em cada mês (milhares)
const ANO = [1.2, 0.8, -0.4, 1.5, 1.1, 0.6, 1.9, 1.3, -0.2, 1.0, 1.6, 2.4]

function CenaAno() {
  return (
    <>
      <P p="translate3d(0, -10px, 0) rotateX(-14deg) rotateY(-18deg)" e="translate3d(0, -40px, 0) rotateX(-14deg) rotateY(-16deg)" d={0} a="cresce" tresD>
        <div className="cn-ano">
          {ANO.map((v, k) => (
            <span key={k} className="cn-mes">
              <Coluna h={Math.abs(v) * 58} c={v < 0 ? '#ff6b81' : k === 11 ? '#14c9a0' : '#1f8ef1'} d={0.2 + k * 0.12} neg={v < 0} />
              <small>{MESES_CURTO[k]}</small>
            </span>
          ))}
        </div>
      </P>
      <P p="translate3d(-200px, -150px, 60px)" e="translate3d(-40px, -200px, 60px)" d={2.2} a="cresce">
        <div className="cn-selo-grande"><Icone nome="estrela" tamanho={20} /><span><small>{tx('Melhor mês')}</small><b>{MESES_NOME[11]}</b></span></div>
      </P>
      <P p="translate3d(0, 150px, 110px)" e="translate3d(0, 150px, 110px)" d={1.6} a="surge">
        <div className="cn-painel cn-kpis">
          <span><small>{tx('Entrou')}</small><b className="cn-entra"><Conta ate={74300} d={1.8} f={din0} /></b></span>
          <span><small>{tx('Saiu')}</small><b className="cn-sai"><Conta ate={61900} d={1.9} f={din0} /></b></span>
          <span><small>{tx('Sobrou')}</small><b><Conta ate={12400} d={2.0} f={din0} /></b></span>
        </div>
      </P>
    </>
  )
}

// ---------- 9. Investimentos ----------

const CARTEIRA = [
  { n: () => tx('Renda fixa'), v: 55, c: '#14c9a0' },
  { n: () => tx('Ações'), v: 25, c: '#1f8ef1' },
  { n: () => tx('Fundos imobiliários'), v: 15, c: '#8b7cf6' },
  { n: () => tx('Exterior'), v: 5, c: '#ffc24b' },
]
const CURVA = 'M0 92 C 20 88, 30 70, 50 74 S 80 60, 100 62 S 130 40, 150 46 S 180 30, 200 24 S 230 18, 250 8' // sem-tx

// onde começa cada fatia da rosca (% do círculo)
const INICIO_FATIA = CARTEIRA.map((_, k) => CARTEIRA.slice(0, k).reduce((s, p) => s + p.v, 0))

function Rosca() {
  const r = 52, c = 2 * Math.PI * r
  return (
    <svg className="cn-rosca" width="140" height="140" viewBox="0 0 140 140" aria-hidden="true">
      {CARTEIRA.map((p, k) => (
        <circle key={k} cx="70" cy="70" r={r} stroke={p.c} strokeWidth="22" fill="none"
          style={em(0.9 + k * 0.25, { '--arco': (p.v / 100) * c, '--c': c, '--gira': `${(INICIO_FATIA[k] / 100) * 360 - 90}deg` } as CSSProperties)} />
      ))}
    </svg>
  )
}

function CenaInvest() {
  return (
    <>
      <P p="translate3d(-104px, 0, 20px) rotateY(13deg)" e="translate3d(-10px, -96px, 20px) rotateY(8deg)" d={0.1}>
        <div className="cn-painel" style={{ width: 300 }}>
          <Cab icone="investir" titulo={tx('Sua carteira')} />
          <b className="cn-grande"><Conta ate={42180.55} d={0.5} dur={2} f={din} /></b>
          <span className="cn-pilula cn-entra cn-vem" style={em(1.6)}><Icone nome="sobe" tamanho={13} />{tx('{0} no ano', variacao.format(0.124))}</span>
          <svg className="cn-curva" viewBox="0 0 250 100" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id="cn-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#14c9a0" stopOpacity=".38" /><stop offset="1" stopColor="#14c9a0" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path className="cn-curva-area" d={`${CURVA} V100 H0Z`} fill="url(#cn-area)" style={em(1.6)} />
            <path className="cn-curva-linha" d={CURVA} pathLength={1} style={em(0.6)} />
          </svg>
        </div>
      </P>
      <P p="translate3d(196px, -40px, 30px) rotateX(48deg)" e="translate3d(70px, 118px, 30px) rotateX(48deg)" d={0.6} a="cresce" tresD>
        <div className="cn-rosca-gira"><Rosca /></div>
      </P>
      <P p="translate3d(196px, 106px, 70px)" e="translate3d(-104px, 140px, 70px)" d={1.6} a="lado">
        <div className="cn-painel cn-legenda-rosca">
          {CARTEIRA.map((p, k) => (
            <span key={k} className="cn-vem" style={em(1.8 + k * 0.2)}><i style={{ background: p.c }} />{p.n()}<b>{pct(p.v)}</b></span>
          ))}
        </div>
      </P>
    </>
  )
}

// ---------- a sequência ----------

interface Cena { titulo: () => string; sub: () => string; cor: string; dur: number; Conteudo: () => ReactNode }

const CENAS: Cena[] = [
  { titulo: () => tx('Lançamentos'), sub: () => tx('Cada entrada e saída no lugar, em real, dólar, euro e outras moedas.'), cor: '#14c9a0', dur: 8000, Conteudo: CenaLancamentos },
  { titulo: () => tx('Consultor'), sub: () => tx('Ele lê o seu mês e monta a tela com o que importa agora.'), cor: '#8b7cf6', dur: 8000, Conteudo: CenaConsultor },
  { titulo: () => tx('Contas do mês'), sub: () => tx('Crie a conta uma vez e veja o pote encher a cada pagamento.'), cor: '#4ea3ff', dur: 7500, Conteudo: CenaContas },
  { titulo: () => tx('Cartões'), sub: () => tx('As faturas, o limite e as parcelas de todos os cartões.'), cor: '#9b6bff', dur: 7000, Conteudo: CenaCartoes },
  { titulo: () => tx('Dívidas'), sub: () => tx('Cada parcela paga e o mês em que a dívida acaba.'), cor: '#ffc24b', dur: 7000, Conteudo: CenaDividas },
  { titulo: () => tx('Metas'), sub: () => tx('Diga quanto quer juntar e acompanhe até chegar lá.'), cor: '#2ad4a0', dur: 6500, Conteudo: CenaMetas },
  { titulo: () => tx('Dinheiro guardado'), sub: () => tx('A reserva e as caixinhas somadas, rendendo à vista.'), cor: '#14c9a0', dur: 6500, Conteudo: CenaGuardado },
  { titulo: () => tx('Resumo do ano'), sub: () => tx('Os doze meses lado a lado: quanto entrou, saiu e sobrou.'), cor: '#1f8ef1', dur: 7000, Conteudo: CenaAno },
  { titulo: () => tx('Investimentos'), sub: () => tx('A carteira inteira, com quanto rendeu de verdade.'), cor: '#3d4be0', dur: 7000, Conteudo: CenaInvest },
]

/** Tamanho do palco desenhado: no largo (computador) e no estreito (celular). As peças são posicionadas nessa medida. */
const LARGO = { w: 700, h: 460 }
const ESTREITO = { w: 420, h: 480 }

/** O fundo animado: o palco com as cenas e, por cima, o nome da cena e as marcas de qual está passando. */
export default function CenasDoOpus() {
  const [i, setI] = useState(0)
  const [saindo, setSaindo] = useState<number | null>(null)
  const area = useRef<HTMLDivElement>(null)

  // tamanho: a escala do palco e se ele é estreito
  useEffect(() => {
    const el = area.current
    if (!el) return
    const medir = () => {
      const { width: w, height: h } = el.getBoundingClientRect()
      const estreito = w / Math.max(h, 1) < 1.15
      const m = estreito ? ESTREITO : LARGO
      el.classList.toggle('estreito', estreito)
      el.style.setProperty('--esc', String(Math.max(0.4, Math.min(w / m.w, h / m.h, 1.5))))
    }
    medir()
    // mede no quadro seguinte: mudar a escala dentro do aviso de tamanho fazia o navegador reclamar
    // ("ResizeObserver loop completed with undelivered notifications")
    let quadro = 0
    const ro = new ResizeObserver(() => { cancelAnimationFrame(quadro); quadro = requestAnimationFrame(medir) })
    ro.observe(el)
    return () => { cancelAnimationFrame(quadro); ro.disconnect() }
  }, [])

  // o mouse inclina um pouco o palco (só com mouse e com animações completas)
  useEffect(() => {
    const el = area.current
    if (!el || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    let raf = 0, alvoX = 0, alvoY = 0, x = 0, y = 0
    const passo = () => {
      x += (alvoX - x) * 0.06; y += (alvoY - y) * 0.06
      el.style.setProperty('--px', x.toFixed(3)); el.style.setProperty('--py', y.toFixed(3))
      raf = Math.abs(alvoX - x) + Math.abs(alvoY - y) > 0.002 ? requestAnimationFrame(passo) : 0
    }
    const mover = (e: PointerEvent) => {
      if (semMovimento()) return
      alvoX = e.clientX / innerWidth - 0.5; alvoY = e.clientY / innerHeight - 0.5
      if (!raf) raf = requestAnimationFrame(passo)
    }
    window.addEventListener('pointermove', mover)
    return () => { window.removeEventListener('pointermove', mover); cancelAnimationFrame(raf) }
  }, [])

  // a troca de cena: quando a aba está escondida, espera voltar
  useEffect(() => {
    let t = 0
    const agendar = (ms: number) => {
      t = window.setTimeout(() => { if (document.hidden) agendar(1000); else ir((i + 1) % CENAS.length) }, ms)
    }
    agendar(CENAS[i].dur)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i])
  useEffect(() => {
    if (saindo === null) return
    const t = window.setTimeout(() => setSaindo(null), 900)
    return () => clearTimeout(t)
  }, [saindo])
  const ir = (n: number) => {
    if (n === i) return
    setSaindo(i)
    setI(n)
  }

  const cena = CENAS[i]
  const Atual = cena.Conteudo
  const Anterior = saindo !== null ? CENAS[saindo].Conteudo : null
  return (
    <div className="cn-fundo" style={{ '--cor': cena.cor } as CSSProperties}>
      <div className="cn-luz" aria-hidden="true" />
      <div className="cn-chao" aria-hidden="true"><i /></div>
      <div className="cn-area" ref={area} aria-hidden="true">
        {Anterior && saindo !== null && <div key={`s${saindo}`} className="cn-cena saindo"><Anterior /></div>}
        <div key={i} className="cn-cena"><Atual /></div>
      </div>
      <div className="cn-veu" aria-hidden="true" />
      <div className="cn-legenda">
        <h2 key={i} className="cn-titulo">{cena.titulo()}</h2>
        <p key={`p${i}`} className="cn-sub">{cena.sub()}</p>
        <div className="cn-marcas">
          {CENAS.map((c, k) => (
            <button key={k} type="button" className={k === i ? 'ativa' : ''} aria-label={tx('Mostrar: {0}', c.titulo())} aria-current={k === i}
              onClick={() => ir(k)}>
              <i style={k === i ? { animationDuration: `${c.dur}ms` } : undefined} />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
