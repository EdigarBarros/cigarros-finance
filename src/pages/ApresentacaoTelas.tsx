import type { CSSProperties, ReactNode } from 'react'
import { BancoIcone } from '../components/BancoIcone'
import { Icone } from '../components/Icone'
import { Marca } from '../components/Marca'
import { LOCAL_DAS_DATAS, MESES_CURTO, MESES_NOME, fmtDataCurta, fmtDataLonga, fmtMesAno } from '../lib/format'
import { tx } from '../lib/textos'
import {
  BLOCOS, DIVIDA, ENTROU, dividaEm, GUARDADO, INVESTIDO, OUTUBRO, PLOT, R, SAIU, TETO, compacto, formatar, type Formato, type Ret, type Tela,
} from './apresentacaoCena'

/**
 * As telas do painel em miniatura para a apresentação da página inicial: Início, Resumo do ano, Cartões, Lançamentos e
 * Metas, cada uma desenhada num tamanho fixo (DW x DH px "de desenho") com dados de demonstração (Marina, outubro de
 * 2026). Cada bloco com data-bloco é uma camada que a câmera solta em 3D (data-z diz quanto ele sobe). O que se anima
 * dentro das telas lê variáveis CSS (--k-nome, de 0 a 1) que a Apresentacao escreve na tela conforme o scroll; os
 * números com data-conta contam até o valor deles.
 */

/** Número que conta de 0 até v conforme a variável --k-{k} (o texto inicial já é o valor final). */
function N({ v, k, f = 'brl', i, n, className }: { v: number; k: string; f?: Formato; i?: number; n?: number; className?: string }) {
  return <b className={className} data-conta={v} data-k={k} data-f={f} data-i={i} data-n={n}>{formatar(f, v)}</b>
}

/** Um bloco (camada 3D) na posição dele em BLOCOS. */
function B<T extends Tela>({ t, id, z, className = '', style, children }: { t: T; id: keyof (typeof BLOCOS)[T] & string; z: number; className?: string; style?: CSSProperties; children?: ReactNode }) {
  const [x, y, w, h] = (BLOCOS[t] as Record<string, Ret>)[id]
  return <div className={`td-bloco ${className}`} data-bloco={id} data-z={z} style={{ left: x, top: y, width: w, height: h, ...style }}>{children}</div>
}

const cor = (c: string, extra?: Record<string, string | number>) => ({ '--c': c, ...extra }) as CSSProperties

function Lateral({ ativo }: { ativo: number }) {
  const itens = [
    ['inicio', tx('Início')], ['lista', tx('Lançamentos')], ['bussola', tx('Consultor')], ['investir', tx('Invest')],
    ['calendario', tx('Contas do mês')], ['cartao', tx('Cartões')], ['divida', tx('Dívidas')], ['meta', tx('Metas')],
    ['carteira', tx('Dinheiro guardado')], ['ano', tx('Resumo do ano')],
  ]
  return (
    <aside className="td-lateral">
      <Marca compacta />
      <nav>
        {itens.map(([i, t], n) => <span key={i} className={n === ativo ? 'ativo' : ''}><Icone nome={i} tamanho={17} />{t}</span>)}
      </nav>
    </aside>
  )
}

function Topo({ titulo, sub, children }: { titulo: ReactNode; sub: string; children?: ReactNode }) {
  return (
    <>
      <div><strong>{titulo}</strong><span>{sub}</span></div>
      {children && <div className="td-topo-botoes">{children}</div>}
    </>
  )
}

function Chip({ icone, c, rotulo, children }: { icone: string; c: string; rotulo: string; children: ReactNode }) {
  return (
    <span className="td-chip-info" style={cor(c)}>
      <i><Icone nome={icone} tamanho={14} /></i>
      <span><small>{rotulo}</small>{children}</span>
    </span>
  )
}

/** Aro que enche (pathLength 1): v de 0 a 1, animado pela variável --k-{k}. */
function Aro({ v, k, c, tam = 120, esp = 11, children, className = '' }: { v: number; k: string; c: string; tam?: number; esp?: number; children?: ReactNode; className?: string }) {
  return (
    <div className={`td-aro ${className}`} style={{ width: tam, height: tam, '--c': c, '--v': v, '--kk': `var(--k-${k}, 1)` } as CSSProperties}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="42" className="fundo" style={{ strokeWidth: esp }} />
        <circle cx="50" cy="50" r="42" className="cheio" pathLength={1} style={{ strokeWidth: esp }} />
      </svg>
      <div className="td-aro-meio">{children}</div>
    </div>
  )
}


type Pt = [number, number]
/** Curva suave que passa pelos pontos (Catmull-Rom em Bézier). */
function curvaSvg(pts: Pt[]) {
  const f = (n: number) => n.toFixed(1)
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2
    d += ` C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`
  }
  return d
}
/** Posições do gráfico do ano num retângulo w x h: 12 meses, eixo de 0 a TETO mil. */
function escala(w: number, h: number) {
  const x = (i: number) => (w * (i + 0.5)) / 12
  const y = (v: number) => h * (1 - v / TETO)
  const serie = (vs: number[], de = 0, ate = vs.length) => vs.slice(de, ate).map((v, i): Pt => [x(i + de), y(v)])
  return { x, y, serie }
}

/** O gráfico do ano numa camada só (o do Início). */
function GraficoInicio() {
  const W = 640, H = 236
  const { x, y, serie } = escala(W, H)
  const div = serie(DIVIDA, 0, OUTUBRO + 1)
  const area = `${curvaSvg(div)} L${x(OUTUBRO)} ${H} L${x(0)} ${H} Z`
  const bw = 11
  return (
    <svg className="ti-graf" width={W} height={H + 22} viewBox={`0 0 ${W} ${H + 22}`} aria-hidden="true">
      {[0, 0.25, 0.5, 0.75, 1].map((g) => <line key={g} x1="0" x2={W} y1={H * g} y2={H * g} className="grade" />)}
      <rect x={x(OUTUBRO) - 24} y="0" width="48" height={H} rx="10" className="faixa" />
      <path d={area} className="area" />
      {ENTROU.map((v, i) => (
        <g key={i} style={{ '--i': i } as CSSProperties}>
          <rect x={x(i) - bw - 1} y={y(v)} width={bw} height={H - y(v)} rx="3" className="barra e" />
          <rect x={x(i) + 1} y={y(SAIU[i])} width={bw} height={H - y(SAIU[i])} rx="3" className="barra s" />
        </g>
      ))}
      <path d={curvaSvg(div)} pathLength={1} className="linha divida" />
      <path d={curvaSvg(serie(GUARDADO, 0, OUTUBRO + 1))} pathLength={1} className="linha guardado" />
      <path d={curvaSvg(serie(INVESTIDO, 0, OUTUBRO + 1))} pathLength={1} className="linha investido" />
      {MESES_CURTO.map((m, i) => <text key={i} x={x(i)} y={H + 17} className={i === OUTUBRO ? 'mes atual' : 'mes'}>{m}</text>)}
    </svg>
  )
}

function Legenda() {
  return (
    <div className="td-legenda">
      <span style={cor('var(--entrada)')}><i />{tx('Entrou')}</span>
      <span style={cor('var(--saida)')}><i />{tx('Saiu')}</span>
      <span style={cor('var(--caixa)')}><i className="traco" />{tx('Guardado nas contas')}</span>
      <span style={cor('var(--divida)')}><i className="traco" />{tx('Dívidas')}</span>
      <span style={cor('var(--violeta)')}><i className="traco" />{tx('Investido')}</span>
    </div>
  )
}

// ─────────────────────────────── INÍCIO ───────────────────────────────
function TelaInicio() {
  const t = 'inicio'
  const vemAi = [
    { dia: '2026-10-20', nome: tx('Academia'), valor: 99.9, icone: 'calendario', c: 'var(--divida)', nota: tx('em 3 dias') },
    { dia: '2026-10-25', nome: tx('Seguro do carro'), valor: 210, icone: 'calendario', c: 'var(--divida)', nota: tx('em 8 dias') },
    { dia: '2026-10-27', nome: tx('Fatura do Itaú'), valor: 990, icone: 'cartao', c: 'var(--caixa)', nota: tx('fecha dia 20') },
    { dia: '2026-11-05', nome: tx('Salário'), valor: 6500, icone: 'receber', c: 'var(--entrada)', nota: tx('vai entrar'), entra: true },
  ]
  const cartoes = [
    { icone: 'enviar', c: 'var(--saida)', titulo: tx('Gastos do mês'), v: 5663.1, nota: tx('8% menos que em set') },
    { icone: 'calendario', c: 'var(--divida)', titulo: tx('Contas do mês'), v: 1299.9, nota: tx('3 para pagar') },
    { icone: 'cartao', c: 'var(--caixa)', titulo: tx('Cartões'), v: 2190, nota: tx('2 faturas abertas') },
    { icone: 'divida', c: 'var(--saida)', titulo: tx('Dívidas'), v: 56430, nota: tx('tudo em dia') },
    { icone: 'carteira', c: 'var(--caixa)', titulo: tx('Dinheiro guardado'), v: 77865.97, nota: tx('em 3 bancos') },
  ]
  return (
    <>
      <Lateral ativo={0} />
      <B t={t} id="topo" z={90} className="td-topo">
        <Topo titulo={<>{tx('Olá,')} <em translate="no">{tx('Marina!')}</em></>} sub={tx('Resumo de outubro de 2026. Você está no caminho certo!')}>
          <i className="td-pilula entrada"><Icone nome="sobe" tamanho={14} /> {tx('Lançar entrada')}</i>
          <i className="td-pilula saida"><Icone nome="desce" tamanho={14} /> {tx('Lançar saída')}</i>
        </Topo>
      </B>

      <B t={t} id="hero" z={170} className="ti-hero">
        <div className="ti-hero-topo">
          <div>
            <small className="td-sobre">{tx('Sobrou até hoje')}</small>
            <N v={3236.9} k="ini" className="ti-grande" />
            <span className="ti-divida"><i />{tx('Dívidas')} <b>{R(56430)}</b> → <b>{R(54700)}</b> {tx('no dia 31')}</span>
          </div>
          <div className="ti-previsto">
            <small className="td-sobre">{tx('Previsto no dia 31')}</small>
            <b>≈ {R(1937)}</b>
          </div>
        </div>
        <div className="td-abas"><span className="ativo">{tx('Já aconteceu')}</span><span>{tx('O que vem aí')}</span></div>
        <GraficoInicio />
        <Legenda />
      </B>

      {[
        { id: 'k1' as const, z: 300, rot: tx('Entrou'), v: 8900, c: 'var(--entrada)' },
        { id: 'k2' as const, z: 340, rot: tx('Saiu'), v: 5663.1, c: 'var(--saida)' },
        { id: 'k3' as const, z: 380, rot: tx('Gasto por dia'), v: 333.12, c: 'var(--caixa)' },
      ].map((k) => (
        <B key={k.id} t={t} id={k.id} z={k.z} className="ti-kpi" style={cor(k.c)}>
          <small className="td-sobre">{k.rot}</small>
          <N v={k.v} k="ini" />
        </B>
      ))}

      <B t={t} id="vemai" z={240} className="ti-vemai">
        <small className="td-sobre">{tx('O que vem aí')}</small>
        <ul>
          {vemAi.map((v) => {
            const [, m, d] = v.dia.split('-').map(Number)
            return (
              <li key={v.dia} style={cor(v.c)}>
                <span className="ti-data">{String(d).padStart(2, '0')}<small>{MESES_CURTO[m - 1].toLowerCase()}</small></span>
                <i className="ti-icone"><Icone nome={v.icone} tamanho={15} /></i>
                <span className="ti-nome">{v.nome}<small>{v.nota}</small></span>
                <b className={v.entra ? 'entra' : ''}>{R(v.valor)}</b>
              </li>
            )
          })}
        </ul>
      </B>

      {cartoes.map((c, i) => (
        <B key={i} t={t} id={`c${i}` as 'c0'} z={130 + (i % 3) * 70} className="ti-cartao" style={cor(c.c)}>
          <i className="ti-icone"><Icone nome={c.icone} tamanho={17} /></i>
          <small className="td-sobre">{c.titulo}</small>
          <N v={c.v} k="ini" />
          <span className="ti-nota">{c.nota}</span>
        </B>
      ))}
      <B t={t} id="c5" z={270} className="ti-cartao" style={cor('var(--violeta)')}>
        <i className="ti-icone"><Icone nome="meta" tamanho={17} /></i>
        <small className="td-sobre">{tx('Metas')}</small>
        <N v={37} k="ini" f="pct" />
        <span className="td-trilho"><i style={{ '--v': 0.37 } as CSSProperties} /></span>
        <span className="ti-nota">{tx('4 metas')}</span>
      </B>

      <B t={t} id="saude" z={80} className="ti-saude">
        <Aro v={0.72} k="ini" c="var(--entrada)" tam={58} esp={12}><b>72</b></Aro>
        <div>
          <strong>{tx('Saúde do seu dinheiro')}</strong>
          <span>{tx('Boa! Se sobrar dinheiro, adiante primeiro o Empréstimo pessoal: é a dívida mais cara.')}</span>
        </div>
        <i className="td-pilula neutra">{tx('Ver dívidas')} <Icone nome="seta" tamanho={14} /></i>
      </B>
    </>
  )
}

// ─────────────────────────────── RESUMO DO ANO ───────────────────────────────

function GraficoAno() {
  const { w: W, h: H } = PLOT
  const { x, y, serie } = escala(W, H)
  const div = serie(DIVIDA, 0, OUTUBRO + 1)
  const area = `${curvaSvg(div)} L${x(OUTUBRO)} ${H} L${x(0)} ${H} Z`
  const projecao = curvaSvg(serie(DIVIDA, OUTUBRO))
  const bw = 15
  const ponta = (vs: number[]) => [x(OUTUBRO), y(vs[OUTUBRO])] as const
  const camada = (d: number, c: string, rotulo: string | null, filhos: ReactNode, extra = '') => (
    <div className={`ta-camada ${extra}`} style={{ '--d': d, '--c': c } as CSSProperties}>
      {rotulo && <span className="ta-camada-nome">{rotulo}</span>}
      {filhos}
    </div>
  )
  const [gx, gy] = ponta(GUARDADO), [ix, iy] = ponta(INVESTIDO)
  return (
    <div className="ta-plot" style={{ width: W, height: H }}>
      {camada(0, 'var(--texto-3)', null, (
        <svg width={W} height={H} aria-hidden="true">
          {[0, 0.25, 0.5, 0.75, 1].map((g) => <line key={g} x1="0" x2={W} y1={H * g} y2={H * g} className="grade" />)}
          <rect x={x(OUTUBRO) - 26} y="0" width="52" height={H} rx="12" className="faixa" />
        </svg>
      ), 'base')}
      {camada(24, 'var(--entrada)', null, (
        <svg width={W} height={H} aria-hidden="true">
          {ENTROU.map((v, i) => (
            <g key={i} style={{ '--i': i } as CSSProperties}>
              <rect x={x(i) - bw - 1.5} y={y(v)} width={bw} height={H - y(v)} rx="4" className="barra e" />
              <rect x={x(i) + 1.5} y={y(SAIU[i])} width={bw} height={H - y(SAIU[i])} rx="4" className="barra s" />
            </g>
          ))}
        </svg>
      ))}
      {camada(90, 'var(--divida)', tx('Dívidas'), (
        <>
          <svg width={W} height={H} aria-hidden="true">
            <defs>
              <linearGradient id="ta-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="var(--divida)" stopOpacity=".34" />
                <stop offset="1" stopColor="var(--divida)" stopOpacity=".02" />
              </linearGradient>
            </defs>
            <path d={area} fill="url(#ta-area)" className="area" />
            <path d={projecao} className="linha divida projecao" />
            <path d={curvaSvg(div)} pathLength={1} className="linha divida grossa" data-divida />
            <g data-divida-ponto>
              <circle r="15" className="halo" />
              <circle r="6.5" className="ponto" />
            </g>
          </svg>
          <span className="ta-tag" data-divida-tag>{dividaEm(W)}</span>
        </>
      ))}
      {camada(150, 'var(--caixa)', null, (
        <>
          <svg width={W} height={H} aria-hidden="true">
            <path d={curvaSvg(serie(GUARDADO, 0, OUTUBRO + 1))} pathLength={1} className="linha guardado grossa" />
            <circle cx={gx} cy={gy} r="5.5" className="fim guardado" />
          </svg>
          <span className="ta-fim-nome" style={{ left: gx, top: gy }}>{tx('Guardado nas contas')}</span>
        </>
      ))}
      {camada(210, 'var(--violeta)', null, (
        <>
          <svg width={W} height={H} aria-hidden="true">
            <path d={curvaSvg(serie(INVESTIDO, 0, OUTUBRO + 1))} pathLength={1} className="linha investido grossa" />
            <circle cx={ix} cy={iy} r="5.5" className="fim investido" />
          </svg>
          <span className="ta-fim-nome" style={{ left: ix, top: iy }}>{tx('Investido')}</span>
        </>
      ))}
    </div>
  )
}

function TelaAno() {
  const t = 'ano'
  const sobrou = ENTROU.map((e, i) => e - SAIU[i])
  const numeros = [
    { rot: tx('Entrou'), v: 8900, c: 'var(--entrada)' },
    { rot: tx('Saiu'), v: 5663.1, c: 'var(--saida)' },
    { rot: tx('Sobrou'), v: 3236.9, c: 'var(--entrada)' },
    { rot: tx('Guardado nas contas'), v: 24080, c: 'var(--caixa)', linha: true },
    { rot: tx('Dívidas'), v: 56430, c: 'var(--divida)' },
    { rot: tx('Investido'), v: 53785.97, c: 'var(--violeta)' },
  ]
  return (
    <>
      <Lateral ativo={9} />
      <B t={t} id="topo" z={80} className="td-topo">
        <Topo titulo={tx('Resumo de 2026')} sub={tx('10 meses com dados · toque num mês para abrir')} />
      </B>
      <B t={t} id="hero" z={150} className="td-hero" style={cor('var(--caixa)')}>
        <Aro v={0.19} k="anoh" c="var(--caixa)" tam={104}><b>19%</b><small>{tx('do que entrou ficou')}</small></Aro>
        <div className="td-hero-texto">
          <small className="td-hero-rotulo"><Icone nome="ano" tamanho={14} /> {tx('Sobrou em 2026')}</small>
          <N v={14096.2} k="anoh" className="td-hero-valor" />
          <div className="td-chips">
            <Chip icone="receber" c="var(--entrada)" rotulo={tx('Entrou no ano')}><b>{R(75350)}</b></Chip>
            <Chip icone="enviar" c="var(--saida)" rotulo={tx('Saiu no ano')}><b>{R(61253.8)}</b></Chip>
            <Chip icone="carteira" c="var(--divida)" rotulo={tx('Gasto médio por mês')}><b>{R(6125.38)}</b></Chip>
            <Chip icone="estrela" c="var(--violeta)" rotulo={tx('Melhor mês')}><b>{MESES_NOME[OUTUBRO]}</b></Chip>
          </div>
        </div>
      </B>
      <B t={t} id="meses" z={230} className="ta-meses">
        {MESES_CURTO.map((m, i) => {
          const s = sobrou[i]
          return (
            <span key={i} className={`ta-mes ${s === undefined ? 'vazio' : s < 0 ? 'neg' : ''} ${i === OUTUBRO ? 'atual' : ''}`} style={{ '--i': i } as CSSProperties}>
              <small>{m}</small>
              <b>{s === undefined ? '—' : `${s < 0 ? '−' : '+'}R$ ${compacto.format(Math.abs(s) * 1000)}`}</b>
              {s !== undefined && <i style={{ '--v': SAIU[i] / ENTROU[i] } as CSSProperties} />}
            </span>
          )
        })}
      </B>
      <B t={t} id="graf" z={60} className="ta-graf">
        <header>
          <strong>{tx('Mês a mês')}</strong>
          <div className="td-abas"><span className="ativo">{tx('Já aconteceu')}</span><span>{tx('O que vem aí')}</span></div>
        </header>
        <div className="ta-eixo">
          {[80, 60, 40, 20, 0].map((v) => <small key={v}>{v ? `R$ ${v}.000` : 'R$ 0'}</small>)}
        </div>
        <GraficoAno />
        <div className="ta-meses-eixo">{MESES_CURTO.map((m, i) => <small key={i} className={i === OUTUBRO ? 'atual' : ''}>{m}</small>)}</div>
        <Legenda />
        <div className="ta-lado">
          <strong>{MESES_NOME[OUTUBRO]}</strong>
          {numeros.map((n) => (
            <span key={n.rot} className={n.linha ? 'linha' : ''} style={cor(n.c)}><small>{n.rot}</small><N v={n.v} k="ano" /></span>
          ))}
        </div>
      </B>
    </>
  )
}

// ─────────────────────────────── CARTÕES ───────────────────────────────
function Plastico({ banco, c1, c2, valor, fecha, lado }: { banco: string; c1: string; c2: string; valor: number; fecha: string; lado: number }) {
  return (
    <div className="tc-palco">
      <div className="tc-plastico" style={{ '--c1': c1, '--c2': c2, '--lado': lado } as CSSProperties}>
        <span className="tc-nome"><BancoIcone nome={banco} tamanho={30} /><b translate="no">{banco}</b><i className="tc-nfc" /></span>
        <span className="tc-meio">
          <i className="tc-chip" />
          <span><small>{tx('fatura de outubro')}</small><N v={valor} k="carh" /></span>
        </span>
        <span className="tc-rodape">{fecha} <b>{tx('CRÉDITO')}</b></span>
        <i className="tc-brilho" />
      </div>
    </div>
  )
}

function TelaCartoes() {
  const t = 'cartoes'
  const proximas = [960, 960, 960, 450, 450, 180, 0]
  return (
    <>
      <Lateral ativo={5} />
      <B t={t} id="topo" z={80} className="td-topo">
        <Topo titulo={tx('Cartões')} sub={tx('Faturas de outubro, limite e parcelas de cada cartão.')}>
          <i className="td-pilula cheia"><Icone nome="mais" tamanho={14} /> {tx('Adicionar cartão')}</i>
        </Topo>
      </B>
      <B t={t} id="resumo" z={130} className="td-hero" style={cor('var(--violeta)')}>
        <div className="tc-rosca" style={{ '--kk': 'var(--k-carh, 1)' } as CSSProperties}>
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" r="40" className="fundo" />
            <circle cx="50" cy="50" r="40" pathLength={1} className="fatia" style={{ '--c': '#8a2be2', '--v': 0.44, '--de': 0 } as CSSProperties} />
            <circle cx="50" cy="50" r="40" pathLength={1} className="fatia" style={{ '--c': '#f07a12', '--v': 0.56, '--de': 0.44 } as CSSProperties} />
          </svg>
          <b>{tx('2 cartões')}</b>
        </div>
        <div className="td-hero-texto">
          <small className="td-hero-rotulo"><Icone nome="cartao" tamanho={14} /> {tx('Faturas de outubro')}</small>
          <N v={2190} k="carh" className="td-hero-valor" />
          <div className="td-chips">
            <Chip icone="relogio" c="var(--divida)" rotulo={tx('Falta pagar')}><b>{R(2190)}</b></Chip>
            <Chip icone="escudo" c="var(--caixa)" rotulo={tx('Limite livre')}><b>{R(8690)}</b></Chip>
            <Chip icone="check" c="var(--entrada)" rotulo={tx('Em atraso')}><b>{R(0)}</b></Chip>
          </div>
        </div>
      </B>
      <B t={t} id="nubank" z={240} className="tc-cartao">
        <Plastico banco="Nubank" c1="#a136f5" c2="#5b0aa6" valor={960} fecha={tx('fecha dia 25 · vence dia 2')} lado={-1} />
        <span className="tc-status azul">{tx('Aberta · fecha em 8 dias')}</span>
      </B>
      <B t={t} id="itau" z={320} className="tc-cartao">
        <Plastico banco="Itaú" c1="#f28a1c" c2="#a4480a" valor={1230} fecha={tx('fecha dia 20 · vence dia 27')} lado={1} />
        <span className="tc-status amarelo">{tx('Fecha em 3 dias')}</span>
      </B>
      <B t={t} id="novo" z={110} className="tc-novo">
        <i><Icone nome="mais" tamanho={20} /></i>
        <span>{tx('Adicionar cartão')}</span>
      </B>
      <B t={t} id="limites" z={170} className="tc-limites">
        <strong><Icone nome="escudo" tamanho={16} /> {tx('Quanto do limite cada cartão usa')}</strong>
        {[
          { banco: 'Nubank', v: 0.21, c1: '#c06bff', c2: '#7a12d0' },
          { banco: 'Itaú', v: 0.68, c1: '#f7b06a', c2: '#ec7110' },
        ].map((l, i) => (
          <span key={l.banco} className="tc-limite" style={{ '--v': l.v, '--i': i, '--c1': l.c1, '--c2': l.c2 } as CSSProperties}>
            <BancoIcone nome={l.banco} tamanho={24} /><b translate="no">{l.banco}</b>
            <span className="td-trilho"><i /></span>
            <N v={l.v * 100} k="lim" f="pct" i={i} n={2} />
          </span>
        ))}
      </B>
      <B t={t} id="fatura" z={210} className="tc-fatura">
        <header><strong>{tx('Fatura de outubro')}</strong><span className="tc-status azul">{tx('Aberta')}</span></header>
        <N v={960} k="carh" className="tc-fatura-valor" />
        <div className="tc-linha-tempo"><i /><b /></div>
        <div className="tc-datas">
          <span><small>{tx('abriu')}</small>{fmtDataCurta('2026-09-26')}</span>
          <span><small>{tx('fecha')}</small>{fmtDataCurta('2026-10-25')}</span>
          <span><small>{tx('vence')}</small>{fmtDataCurta('2026-11-02')}</span>
        </div>
        <div className="td-topo-botoes">
          <i className="td-pilula cheia"><Icone nome="check" tamanho={14} /> {tx('Paguei a fatura')}</i>
          <i className="td-pilula neutra">{tx('Ver compras')}</i>
        </div>
      </B>
      <B t={t} id="proximas" z={260} className="tc-proximas">
        <header><strong>{tx('Próximas faturas')}</strong><span>{tx('{0} já comprometidos', R(3960))}</span></header>
        <div className="tc-barras">
          {proximas.map((v, i) => (
            <span key={i} style={{ '--v': v / 960, '--i': i } as CSSProperties} className={i === 0 ? 'atual' : ''}>
              <small>{v ? `R$ ${v}` : '—'}</small>
              <i><b /></i>
              <small>{MESES_CURTO[(OUTUBRO + i) % 12].toLowerCase()}</small>
            </span>
          ))}
        </div>
      </B>
    </>
  )
}

// ─────────────────────────────── LANÇAMENTOS ───────────────────────────────
const CATEGORIAS = {
  moradia: { nome: tx('Moradia'), c: '#3b9cff' },
  dividas: { nome: tx('Dívidas e parcelas'), c: '#f2b01e' },
  alimentacao: { nome: tx('Alimentação'), c: '#f07a12' },
  transporte: { nome: tx('Transporte'), c: '#2f6bff' },
  lazer: { nome: tx('Lazer'), c: '#ef4a6a' },
  assinaturas: { nome: tx('Assinaturas'), c: '#a855f7' },
  renda: { nome: tx('Renda extra'), c: '#14b8a6' },
}
type Cat = keyof typeof CATEGORIAS

function TelaLancamentos() {
  const t = 'lanc'
  // gasto de cada dia de outubro (o calendário fica mais forte onde saiu mais); 12 e 5 tiveram entrada
  const gastos: Record<number, number> = { 5: 1800, 7: 270, 8: 408, 9: 119.9, 10: 1250, 11: 173.4, 13: 140, 14: 77.8, 15: 814, 17: 610 }
  const entradas = new Set([5, 12])
  const nivel = (v = 0) => (v >= 1000 ? 4 : v >= 500 ? 3 : v >= 200 ? 2 : v > 0 ? 1 : 0)
  const semana = (d: string) => new Intl.DateTimeFormat(LOCAL_DAS_DATAS, { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`)).replace('.', '').toUpperCase()
  const letras = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(LOCAL_DAS_DATAS, { weekday: 'narrow', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, 9, 4 + i, 12))))
  const dias: { d: string; itens: { nome: string; cat: Cat; v: number; entra?: boolean; forma: string }[] }[] = [
    { d: '2026-10-17', itens: [{ nome: tx('Cinema e jantar'), cat: 'lazer', v: 190, forma: tx('Pix') }, { nome: tx('Condomínio'), cat: 'moradia', v: 420, forma: tx('Pix') }] },
    { d: '2026-10-15', itens: [{ nome: tx('Mercado'), cat: 'alimentacao', v: 334, forma: tx('Débito') }, { nome: tx('Parcela do empréstimo'), cat: 'dividas', v: 480, forma: tx('Pix') }] },
    { d: '2026-10-14', itens: [{ nome: tx('Streaming'), cat: 'assinaturas', v: 55.9, forma: tx('Crédito') }, { nome: tx('Música'), cat: 'assinaturas', v: 21.9, forma: tx('Crédito') }] },
    { d: '2026-10-12', itens: [{ nome: tx('Freela de design'), cat: 'renda', v: 2400, entra: true, forma: tx('Pix') }] },
  ]
  const onde: { cat: Cat; v: number; p: number }[] = [
    { cat: 'moradia', v: 2513.3, p: 44 }, { cat: 'dividas', v: 1730, p: 31 }, { cat: 'alimentacao', v: 882, p: 16 },
    { cat: 'transporte', v: 270, p: 5 }, { cat: 'lazer', v: 190, p: 3 }, { cat: 'assinaturas', v: 77.8, p: 1 },
  ]
  let item = 0
  return (
    <>
      <Lateral ativo={1} />
      <B t={t} id="topo" z={80} className="td-topo">
        <Topo titulo={tx('Lançamentos')} sub={tx('Outubro de 2026 · 15 lançamentos')}>
          <i className="td-pilula neutra"><Icone nome="importar" tamanho={14} /> {tx('Importar extrato')}</i>
          <i className="td-pilula entrada">+ {tx('Entrada')}</i>
          <i className="td-pilula saida">− {tx('Saída')}</i>
        </Topo>
      </B>
      <B t={t} id="cal" z={240} className="tl-cal">
        <header><strong>{tx('Dia a dia')}</strong><span>{tx('dia que mais saiu: 5')}</span></header>
        <div className="tl-semana">{letras.map((l, i) => <small key={i}>{l}</small>)}</div>
        <div className="tl-dias">
          {Array.from({ length: 4 }, (_, i) => <span key={`v${i}`} className="vazio" />)}
          {Array.from({ length: 31 }, (_, i) => {
            const d = i + 1
            return (
              <span key={d} className={`n${nivel(gastos[d])} ${d > 17 ? 'futuro' : ''} ${d === 17 ? 'hoje' : ''}`} style={{ '--i': i } as CSSProperties}>
                {d}{entradas.has(d) && <i />}
              </span>
            )
          })}
        </div>
        <div className="tl-escala"><small>{tx('menos')}</small>{[1, 2, 3, 4].map((n) => <i key={n} className={`n${n}`} />)}<small>{tx('mais gasto')}</small></div>
      </B>
      <B t={t} id="onde" z={170} className="tl-onde">
        <header><strong>{tx('Para onde foi')}</strong><span>{tx('Editar categorias')}</span></header>
        {onde.map((o, i) => (
          <span key={o.cat} className="tl-cat" style={{ '--c': CATEGORIAS[o.cat].c, '--v': o.p / 44, '--i': i } as CSSProperties}>
            <span><b>{CATEGORIAS[o.cat].nome}</b><b>{R(o.v)} <small>{o.p}%</small></b></span>
            <span className="td-trilho"><i /></span>
          </span>
        ))}
      </B>
      <B t={t} id="sobrou" z={300} className="td-hero tl-sobrou" style={cor('var(--entrada)')}>
        <Aro v={0.64} k="lanh" c="var(--caixa)" tam={96}><b>64%</b><small>{tx('do que entrou saiu')}</small></Aro>
        <div className="td-hero-texto">
          <small className="td-hero-rotulo"><Icone nome="sobe" tamanho={14} /> {tx('Sobrou')}</small>
          <N v={3236.9} k="lanh" className="td-hero-valor" />
          <div className="td-chips">
            <Chip icone="receber" c="var(--entrada)" rotulo={tx('Entrou')}><b>{R(8900)}</b></Chip>
            <Chip icone="enviar" c="var(--saida)" rotulo={tx('Saiu')}><b>{R(5663.1)}</b></Chip>
            <Chip icone="lista" c="var(--violeta)" rotulo={tx('Lançamentos')}><N v={15} k="lanh" f="int" /></Chip>
          </div>
        </div>
      </B>
      <B t={t} id="lista" z={110} className="tl-lista">
        {dias.map((g) => {
          const total = g.itens.reduce((s, it) => s + (it.entra ? it.v : -it.v), 0)
          return (
            <div key={g.d} className="tl-dia">
              <span className="tl-dia-num">{g.d.slice(8)}<small>{semana(g.d)}</small></span>
              <div className="tl-dia-corpo">
                <header>
                  <span><b>{fmtDataLonga(g.d)}</b> {g.itens.length === 1 ? tx('1 lançamento') : tx('{0} lançamentos', g.itens.length)}</span>
                  <b className={total > 0 ? 'entra' : 'sai'}>{total > 0 ? `+ ${R(total)}` : `− ${R(-total)}`}</b>
                </header>
                <div className="tl-itens">
                  {g.itens.map((it) => (
                    <span key={it.nome} className="tl-item" style={{ '--c': CATEGORIAS[it.cat].c, '--i': item++ } as CSSProperties}>
                      <small>{CATEGORIAS[it.cat].nome}</small>
                      <strong>{it.nome}</strong>
                      <b className={it.entra ? 'entra' : 'sai'}>{it.entra ? `+ ${R(it.v)}` : `− ${R(it.v)}`}</b>
                      <span className="tl-tags"><i translate="no">{'Nubank'}</i><i>{it.forma}</i></span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </B>
    </>
  )
}

// ─────────────────────────────── METAS ───────────────────────────────
function Pote({ c, v, i, icone, grande }: { c: string; v: number; i: number; icone: string; grande?: boolean }) {
  return (
    <div className={`tm-pote ${grande ? 'grande' : ''}`} style={{ '--c': c, '--v': v, '--i': i } as CSSProperties}>
      <i className="tm-tampa" />
      <div className="tm-vidro">
        <div className="tm-agua">
          <svg className="tm-onda" viewBox="0 0 200 20" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 10 Q25 2 50 10 T100 10 T150 10 T200 10 V20 H0 Z" />
          </svg>
        </div>
        <span className="tm-selo"><Icone nome={icone} tamanho={grande ? 20 : 16} /></span>
        <i className="tm-reflexo" />
      </div>
    </div>
  )
}

function TelaMetas() {
  const t = 'metas'
  const metas = [
    { nome: tx('Notebook novo'), icone: 'relatorio', c: '#a855f7', v: 0.87, chega: fmtMesAno(2026, 12) },
    { nome: tx('Viagem ao Japão'), icone: 'enviar', c: '#38bdf8', v: 0.32, chega: fmtMesAno(2027, 7) },
    { nome: tx('Reserva de emergência'), icone: 'escudo', c: '#22c55e', v: 0.66, chega: fmtMesAno(2027, 8) },
    { nome: tx('Entrada do apartamento'), icone: 'inicio', c: '#f59e0b', v: 0.19, chega: fmtMesAno(2028, 12) },
  ]
  const potes = [
    { id: 'p1' as const, z: 300, nome: tx('Reserva de emergência'), icone: 'escudo', c: '#22c55e', guardado: 15800, de: 24000, selo: tx('Sem prazo'), nota: tx('No seu ritmo, chega em {0}', fmtMesAno(2027, 8)) },
    { id: 'p2' as const, z: 380, nome: tx('Viagem ao Japão'), icone: 'enviar', c: '#38bdf8', guardado: 5800, de: 18000, selo: tx('Abaixo do ritmo'), nota: tx('Guarde {0}/mês até {1}', R(1355.56), fmtMesAno(2027, 7)) },
    { id: 'p3' as const, z: 300, nome: tx('Notebook novo'), icone: 'relatorio', c: '#a855f7', guardado: 7800, de: 9000, selo: tx('Quase lá'), nota: tx('Guarde {0}/mês até {1}', R(600), fmtMesAno(2026, 12)) },
  ]
  const porMes = [
    { nome: tx('Viagem ao Japão'), v: 1355.56, p: 36, c: '#38bdf8' },
    { nome: tx('Notebook novo'), v: 600, p: 16, c: '#a855f7' },
    { nome: tx('Entrada do apartamento'), v: 1861.54, p: 48, c: '#f59e0b' },
  ]
  return (
    <>
      <Lateral ativo={7} />
      <B t={t} id="topo" z={80} className="td-topo">
        <Topo titulo={tx('Metas')} sub={tx('Junte dinheiro para o que importa: cada pote enche conforme você guarda.')}>
          <i className="td-pilula cheia"><Icone nome="mais" tamanho={14} /> {tx('Criar meta')}</i>
        </Topo>
      </B>
      <B t={t} id="resumo" z={140} className="td-hero" style={cor('var(--entrada)')}>
        <div className="tm-pote-hero">
          <Pote c="#22c55e" v={0.37} i={0} icone="meta" grande />
          <N v={37} k="meth" f="pct" className="tm-selo-pct" />
        </div>
        <div className="td-hero-texto">
          <small className="td-hero-rotulo"><Icone nome="meta" tamanho={14} /> {tx('Guardado nas metas')}</small>
          <N v={41000} k="meth" className="td-hero-valor" />
          <span className="td-hero-de">{tx('de {0}', R(111000))}</span>
          <div className="td-chips">
            <Chip icone="meta" c="var(--caixa)" rotulo={tx('Faltam')}><b>{R(70000)}</b></Chip>
            <Chip icone="calendario" c="var(--divida)" rotulo={tx('Guardar por mês')}><b>{R(3817.1)}</b></Chip>
            <Chip icone="check" c="var(--entrada)" rotulo={tx('Batidas')}><b>{tx('0 de 4')}</b></Chip>
          </div>
        </div>
      </B>
      <B t={t} id="quando" z={200} className="tm-quando">
        <header><strong><Icone nome="relogio" tamanho={16} /> {tx('Quando cada meta chega')}</strong></header>
        {metas.map((m, i) => (
          <span key={m.nome} className="tm-quando-linha" style={{ '--c': m.c, '--v': m.v, '--i': i, '--fim': [0.12, 0.38, 0.46, 1][i] } as CSSProperties}>
            <b><Icone nome={m.icone} tamanho={14} /> {m.nome}</b>
            <span className="tm-quando-trilho"><i className="fim" /><i className="ja" /></span>
            <small>{m.chega}</small>
          </span>
        ))}
        <div className="tm-quando-eixo"><small>{tx('Hoje')}</small><small>{fmtMesAno(2028, 12)}</small></div>
      </B>
      <B t={t} id="pormes" z={250} className="tm-pormes">
        <header><strong><Icone nome="calendario" tamanho={16} /> {tx('Quanto guardar por mês')}</strong><span>{R(3817.1)}</span></header>
        <div className="tm-pilha">{porMes.map((m, i) => <i key={m.nome} style={{ '--c': m.c, '--v': m.p, '--i': i } as CSSProperties} />)}</div>
        {porMes.map((m) => (
          <span key={m.nome} className="tm-pormes-linha" style={cor(m.c)}><i /><span>{m.nome}</span><b>{R(m.v)}</b><small>{m.p}%</small></span>
        ))}
      </B>
      {potes.map((p, i) => (
        <B key={p.id} t={t} id={p.id} z={p.z} className="tm-card" style={cor(p.c, { '--i': i })}>
          <Pote c={p.c} v={p.guardado / p.de} i={i} icone={p.icone} />
          <div className="tm-card-texto">
            <span className="tm-card-topo"><strong>{p.nome}</strong><small>{p.selo}</small></span>
            <N v={p.guardado} k="met" i={i} n={3} className="tm-card-valor" />
            <span className="tm-card-de">{tx('de {0}', R(p.de))}</span>
            <span className="td-trilho tm-trilho"><i style={{ '--v': p.guardado / p.de } as CSSProperties} /></span>
            <span className="tm-card-nota">{p.nota}</span>
          </div>
          <div className="tm-botoes">
            <i className="td-pilula cheia"><Icone nome="mais" tamanho={14} /> {tx('Guardar')}</i>
            <i className="td-pilula neutra">{tx('Retirar')}</i>
          </div>
        </B>
      ))}
    </>
  )
}

const CONTEUDO: Record<Tela, () => ReactNode> = {
  inicio: TelaInicio, ano: TelaAno, cartoes: TelaCartoes, lanc: TelaLancamentos, metas: TelaMetas,
}

/** Uma das telas do painel, desenhada com os dados de demonstração. */
export function TelaDaApresentacao({ t }: { t: Tela }) {
  const Conteudo = CONTEUDO[t]
  return <Conteudo />
}
