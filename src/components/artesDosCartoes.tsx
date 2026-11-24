import { useId, type CSSProperties, type ReactNode } from 'react'
import { estiloDoBanco } from '../lib/estiloBanco'
import { logoDoBanco } from '../lib/logosBancos'

/*
 * O visual de verdade do cartão de cada banco, redesenhado (não são fotos): o fundo em CSS e os detalhes (logo, chip,
 * aproximação, bandeira, o nome gravado) num SVG de 320 × 202, que estica junto com o plástico. Os logos são os mesmos
 * SVGs dos selos (lib/logosBancos.ts); as palavras (CAIXA, ourocard, PagBank…) são texto. Modelo: as fotos que o Edigar
 * mandou (Nubank, Itaú, Bradesco, BB Ourocard, Caixa, Santander SX, Inter, C6, PicPay, Mercado Pago, PagBank e Neon).
 * Cartão em pé no banco (Nubank, PagBank, C6, Inter, Mercado Pago) vira cartão deitado com as palavras de lado.
 */

/** Onde vai o bloco da fatura (valor + fecha/vence), em % do plástico. */
type Lugar = { left?: string; right?: string; top?: string; bottom?: string; alinhar?: 'start' | 'end' }

export interface ArteCartao {
  chave: string
  /** Cor principal (o tom do topo no celular e a luz em volta). */
  cor: string
  /** Fundo do plástico (CSS). */
  fundo: string
  /** Cor dos textos por cima (fatura, dias). */
  tinta: string
  bloco: Lugar
  desenho: (titular: string) => ReactNode
}

const FONTE = 'Montserrat, Inter, system-ui, sans-serif'
const nomeGravado = (t: string) => t.trim().toUpperCase().slice(0, 24)

// ---------- peças ----------

/** Chip (dourado ou prata) com as divisões. */
function Chip({ x, y, w = 38, prata, giro }: { x: number; y: number; w?: number; prata?: boolean; giro?: number }) {
  const id = useId().replace(/:/g, '')
  const h = w * 0.76
  return (
    <g transform={giro ? `rotate(${giro} ${x + w / 2} ${y + h / 2})` : undefined}>
      <defs>
        <linearGradient id={`ch${id}`} x1="0" y1="0" x2="1" y2="1">
          {prata
            ? <><stop offset="0" stopColor="#f4f4f4" /><stop offset=".5" stopColor="#b9bcc2" /><stop offset="1" stopColor="#e6e7ea" /></>
            : <><stop offset="0" stopColor="#fbe7a6" /><stop offset=".5" stopColor="#d6ad4f" /><stop offset="1" stopColor="#f2d589" /></>}
        </linearGradient>
      </defs>
      <rect x={x} y={y} width={w} height={h} rx={w * 0.16} fill={`url(#ch${id})`} stroke={prata ? 'rgba(60,60,70,.35)' : 'rgba(120,85,20,.45)'} strokeWidth=".8" />
      <path d={`M${x + w * 0.34} ${y}v${h}M${x + w * 0.66} ${y}v${h}M${x} ${y + h * 0.34}h${w * 0.34}M${x + w * 0.66} ${y + h * 0.34}h${w * 0.34}M${x} ${y + h * 0.66}h${w * 0.34}M${x + w * 0.66} ${y + h * 0.66}h${w * 0.34}M${x + w * 0.34} ${y + h * 0.5}h${w * 0.32}`}
        stroke={prata ? 'rgba(60,60,70,.4)' : 'rgba(120,85,20,.5)'} strokeWidth=".8" fill="none" />
    </g>
  )
}

/** Símbolo de pagamento por aproximação (as ondas). */
const Aprox = ({ x, y, s = 1, cor = '#fff', giro = 0 }: { x: number; y: number; s?: number; cor?: string; giro?: number }) => (
  <g transform={`translate(${x} ${y}) rotate(${giro}) scale(${s})`} fill="none" stroke={cor} strokeWidth="1.7" strokeLinecap="round" opacity=".9">
    <path d="M0 -4c1.4 1.4 1.4 4.6 0 6M4 -7c2.6 2.6 2.6 9.4 0 12M8 -10c3.8 3.8 3.8 15.2 0 18" />
  </g>
)

/** Bandeira Mastercard (os dois círculos), com ou sem o nome embaixo. */
const Master = ({ x, y, r = 13, giro = 0, nome, corNome = '#fff' }: { x: number; y: number; r?: number; giro?: number; nome?: boolean; corNome?: string }) => (
  <g transform={`translate(${x} ${y}) rotate(${giro})`}>
    <circle cx={-r * 0.62} cy="0" r={r} fill="#eb001b" />
    <circle cx={r * 0.62} cy="0" r={r} fill="#f79e1b" />
    <path d={`M0 ${-r * 0.78}a${r} ${r} 0 0 1 0 ${r * 1.56}a${r} ${r} 0 0 1 0 ${-r * 1.56}z`} fill="#ff5f00" />
    {nome && <text x="0" y={r + 8} textAnchor="middle" fontFamily={FONTE} fontSize={r * 0.55} fontWeight="600" fill={corNome}>mastercard</text>}
  </g>
)

/** Bandeira Visa (a palavra em itálico). */
const Visa = ({ x, y, tam = 26, cor = '#fff', giro = 0, ancora = 'end', extra }: { x: number; y: number; tam?: number; cor?: string; giro?: number; ancora?: 'start' | 'end' | 'middle'; extra?: string }) => (
  <g transform={`translate(${x} ${y}) rotate(${giro})`}>
    <text textAnchor={ancora} fontFamily="'Arial Black', 'Helvetica Neue', Arial, sans-serif" fontStyle="italic" fontWeight="900" fontSize={tam} letterSpacing="-.02em" fill={cor}>VISA</text>
    {extra && <text y={tam * 0.5} textAnchor={ancora} fontFamily={FONTE} fontSize={tam * 0.36} fontWeight="500" fill={cor}>{extra}</text>}
  </g>
)

/** Bandeira Elo (a palavra arredondada). */
const Elo = ({ x, y, tam = 30, cor = '#fff' }: { x: number; y: number; tam?: number; cor?: string }) => (
  <text x={x} y={y} textAnchor="end" fontFamily={FONTE} fontWeight="800" fontSize={tam} letterSpacing="-.03em" fill={cor}>elo</text>
)

/** Logo do banco a partir do SVG que o app já tem; `pinta` troca todas as cores por uma só. */
function Logo({ chave, x, y, w, h, pinta, giro = 0 }: { chave: string; x: number; y: number; w: number; h: number; pinta?: string; giro?: number }) {
  const logo = logoDoBanco(chave)
  if (!logo) return null
  return (
    <g transform={giro ? `rotate(${giro} ${x + w / 2} ${y + h / 2})` : undefined} className={pinta ? 'ca-pinta' : undefined} style={pinta ? { '--pinta': pinta } as CSSProperties : undefined}>
      <svg x={x} y={y} width={w} height={h} viewBox={logo.viewBox} dangerouslySetInnerHTML={{ __html: logo.corpo }} />
    </g>
  )
}

/** O nome gravado no plástico (letra de cartão, em caixa alta). */
const Titular = ({ texto, x, y, tam = 10, cor = '#fff', giro = 0, ancora = 'start', opac = 0.92 }: { texto: string; x: number; y: number; tam?: number; cor?: string; giro?: number; ancora?: 'start' | 'end'; opac?: number }) =>
  texto.trim() ? (
    <text transform={`translate(${x} ${y}) rotate(${giro})`} textAnchor={ancora} fontFamily="'Courier New', 'OCR A Std', monospace" fontWeight="700"
      fontSize={tam} letterSpacing=".12em" fill={cor} opacity={opac}>{nomeGravado(texto)}</text>
  ) : null

// ---------- os 12 cartões ----------

const ARTES: Record<string, Omit<ArteCartao, 'chave'>> = {
  nubank: {
    // o Nubank do Edigar (foto do cartão dele), deitado: "nu" e o nome de lado à esquerda, Mastercard e chip à direita
    cor: '#6a2fd0', tinta: '#fff',
    fundo: 'radial-gradient(70% 90% at 20% 85%, rgba(214,120,255,.55), transparent 60%), radial-gradient(60% 70% at 70% 30%, rgba(150,110,255,.35), transparent 60%), linear-gradient(120deg, #7f45dc 0%, #6331cc 45%, #4a1fa6 100%)',
    bloco: { left: '6%', top: '64%' },
    desenho: (t) => <>
      <Logo chave="nubank" x={13} y={36} w={56} h={31} pinta="#f4f0ff" giro={90} />
      <Titular texto={t} x={98} y={30} tam={9.5} giro={90} cor="#e8e2f7" />
      <Master x={276} y={52} r={18} giro={90} />
      <Chip x={240} y={108} w={31} prata giro={90} />
    </>,
  },
  itau: {
    cor: '#ff6200', tinta: '#fff',
    fundo: 'radial-gradient(90% 80% at 85% 0%, rgba(255,160,80,.55), transparent 60%), linear-gradient(150deg, #ff7a1a 0%, #ff6200 45%, #f05400 100%)',
    bloco: { left: '7%', top: '38%' },
    desenho: (t) => <>
      <Master x={36} y={30} r={13} />
      <Chip x={262} y={20} w={36} prata />
      <g>
        <rect x="18" y="146" width="38" height="38" rx="9" fill="#fff" />
        <g className="ca-pinta" style={{ '--pinta': '#0b2f8a' } as CSSProperties}>
          {logoDoBanco('itau') && <svg x="18" y="146" width="38" height="38" viewBox={logoDoBanco('itau')!.viewBox} dangerouslySetInnerHTML={{ __html: logoDoBanco('itau')!.corpo }} />}
        </g>
      </g>
      <Titular texto={t} x={66} y={180} tam={9} />
    </>,
  },
  bradesco: {
    // Visa Platinum: prata com a retícula de pontos em ondas
    cor: '#9a9ca1', tinta: '#fff',
    fundo: 'radial-gradient(circle, rgba(255,255,255,.34) 0 .85px, transparent 1.35px) 0 0 / 6px 6px, radial-gradient(60% 120% at 50% 50%, rgba(40,40,45,.35), transparent 70%), radial-gradient(90% 90% at 15% 20%, rgba(255,255,255,.35), transparent 60%), linear-gradient(120deg, #7d7f84 0%, #a9abb0 30%, #8a8c91 55%, #b8babe 78%, #77797e 100%)',
    bloco: { left: '7%', top: '50%' },
    desenho: (t) => <>
      <Logo chave="bradesco" x={16} y={14} w={22} h={22} pinta="#fff" />
      <text x="42" y="32" fontFamily={FONTE} fontWeight="700" fontSize="19" letterSpacing="-.01em" fill="#fff">bradesco</text>
      <Aprox x={286} y={30} s={0.95} />
      <Chip x={22} y={52} w={36} prata />
      <Visa x={300} y={170} tam={30} />
      <text x="300" y="186" textAnchor="end" fontFamily={FONTE} fontSize="10" fontWeight="500" fill="#fff">Platinum</text>
      <Titular texto={t} x={22} y={188} tam={9.5} />
    </>,
  },
  'banco do brasil': {
    // Ourocard em pé, virado de lado: "ourocard" embaixo, VISA no alto, chip e símbolo do BB à direita, losangos bem claros
    cor: '#f7e21b', tinta: '#22408f',
    fundo: 'linear-gradient(160deg, #fbea2c 0%, #f7e21b 55%, #f2d914 100%)',
    bloco: { left: '6%', top: '30%' },
    desenho: (t) => <>
      <g fill="none" stroke="rgba(255,255,255,.38)" strokeWidth="1.3">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => <path key={i} d={`M${60 + i * 34} 0 L${60 + i * 34 + 101} 202 M${60 + i * 34 + 101} 0 L${60 + i * 34} 202`} />)}
      </g>
      <Visa x={18} y={36} tam={26} ancora="start" cor="#c9b80f" />
      <Titular texto={t} x={300} y={36} tam={9.5} cor="#22408f" ancora="end" />
      <text x="16" y="186" fontFamily="'Arial Narrow', 'Roboto Condensed', Montserrat, sans-serif" fontWeight="800" fontSize="30" letterSpacing="-.01em" fill="#22408f">ourocard</text>
      <Chip x={232} y={130} w={34} prata giro={-90} />
      <Aprox x={238} y={110} s={0.85} cor="#22408f" giro={-90} />
      <Logo chave="banco do brasil" x={272} y={160} w={30} h={30} pinta="#22408f" />
    </>,
  },
  caixa: {
    cor: '#1072c4', tinta: '#fff',
    fundo: 'radial-gradient(90% 80% at 90% 20%, rgba(70,200,255,.5), transparent 60%), linear-gradient(120deg, #0b4d9b 0%, #0d63b8 45%, #1aa3dd 100%)',
    bloco: { left: '7%', top: '52%' },
    desenho: (t) => <>
      <text x="160" y="40" textAnchor="middle" fontFamily={FONTE} fontWeight="900" fontStyle="italic" fontSize="26" letterSpacing=".02em" fill="#fff">
        CAI<tspan fill="#f7941d">X</tspan>A
      </text>
      <Chip x={24} y={60} w={36} prata />
      <Aprox x={70} y={74} s={0.8} />
      <Elo x={302} y={186} tam={30} />
      <Titular texto={t} x={22} y={188} tam={9.5} />
    </>,
  },
  santander: {
    // Visa Platinum do Edigar: grafite com a pintura vermelha e rosa (e uns riscos azuis no alto), chama vermelha
    cor: '#2e2e31', tinta: '#fff',
    fundo: 'radial-gradient(circle, rgba(255,255,255,.05) 0 .6px, transparent 1px) 0 0 / 4px 4px, linear-gradient(135deg, #3b3b3e 0%, #2f2f32 55%, #252527 100%)',
    bloco: { left: '6%', top: '56%' },
    desenho: (t) => <>
      <defs>
        <filter id="st-pincel" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency=".035 .09" numOctaves="3" seed="7" />
          <feDisplacementMap in="SourceGraphic" scale="22" />
        </filter>
      </defs>
      <g filter="url(#st-pincel)">
        <ellipse cx="170" cy="98" rx="74" ry="82" fill="#e5202c" />
        <path d="M110 40 C 170 10, 250 40, 262 110 C 270 170, 210 200, 150 196" fill="none" stroke="#ff4d7a" strokeWidth="10" opacity=".8" />
        <path d="M200 60 C 240 80, 240 140, 200 150 C 170 158, 150 130, 168 110" fill="none" stroke="#2f2f32" strokeWidth="9" />
        <ellipse cx="205" cy="100" rx="16" ry="9" fill="#2f2f32" />
        <path d="M100 150 C 120 175, 150 190, 190 200" fill="none" stroke="#e5202c" strokeWidth="14" />
        <g fill="none" strokeWidth="3" opacity=".9">
          <path d="M40 4 C 90 10, 150 2, 230 6" stroke="#64b8ff" /><path d="M60 12 C 120 18, 180 10, 250 14" stroke="#ff3d6e" />
          <path d="M80 2 C 140 8, 200 0, 270 4" stroke="#8fd0ff" />
        </g>
      </g>
      <Aprox x={58} y={50} s={0.9} giro={-90} />
      <Chip x={36} y={66} w={40} prata />
      <Logo chave="santander" x={22} y={168} w={24} h={22} pinta="#e5322d" />
      <Visa x={290} y={86} tam={28} giro={-90} ancora="start" />
      <text transform="translate(304 86) rotate(-90)" fontFamily={FONTE} fontSize="8.5" fontWeight="500" fill="#fff">Platinum</text>
      <Titular texto={t} x={60} y={188} tam={8.5} />
    </>,
  },
  inter: {
    // o Inter do Edigar: laranja-avermelhado com brilho, "inter" com os raios no alto à direita, chip à esquerda e Mastercard
    cor: '#ff5a1a', tinta: '#fff',
    fundo: 'radial-gradient(circle, rgba(255,210,120,.35) 0 .6px, transparent 1px) 0 0 / 5px 5px, radial-gradient(80% 90% at 25% 15%, rgba(255,170,90,.55), transparent 60%), linear-gradient(135deg, #ff6a22 0%, #ff5a1a 50%, #ec4614 100%)',
    bloco: { left: '10%', top: '52%' },
    desenho: (t) => <>
      <g stroke="#fff" strokeWidth="2.2" strokeLinecap="round">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => {
          const ang = (Math.PI / 2) * (i / 6)
          return <line key={i} x1={199 - Math.cos(ang) * 9} y1={54 - Math.sin(ang) * 9} x2={199 - Math.cos(ang) * 24} y2={54 - Math.sin(ang) * 24} />
        })}
      </g>
      <rect x="195" y="32" width="4.5" height="22" fill="#fff" />
      <text x="206" y="54" fontFamily={FONTE} fontWeight="800" fontSize="34" letterSpacing="-.02em" fill="#fff">inter</text>
      <Chip x={36} y={66} w={40} prata />
      <g>
        <circle cx="258" cy="170" r="20" fill="#e0201b" stroke="#fff" strokeWidth="2" />
        <circle cx="286" cy="170" r="20" fill="#f7941d" stroke="#fff" strokeWidth="2" />
        <path d="M272 155.5a20 20 0 0 1 0 29a20 20 0 0 1 0 -29z" fill="#f05a1a" />
      </g>
      <Titular texto={t} x={36} y={188} tam={9} />
    </>,
  },
  'c6 bank': {
    cor: '#bfc1c6', tinta: '#1f2023',
    fundo: 'repeating-linear-gradient(90deg, rgba(255,255,255,.07) 0 1px, transparent 1px 3px), radial-gradient(120% 90% at 30% 10%, #fafafa, transparent 60%), linear-gradient(160deg, #eeeeee 0%, #cfd0d3 45%, #e4e5e7 62%, #b3b5ba 100%)',
    bloco: { left: '7%', top: '52%' },
    desenho: (t) => <>
      <Aprox x={30} y={30} s={0.8} cor="#3a3b40" giro={-90} />
      <Chip x={20} y={50} w={34} prata />
      <g transform="translate(298 150) rotate(-90)">
        <svg x="0" y="-22" width="42" height="23" viewBox={logoDoBanco('c6 bank')?.viewBox ?? '0 0 44 24'} className="ca-pinta" style={{ '--pinta': '#1f2023' } as CSSProperties}
          dangerouslySetInnerHTML={{ __html: logoDoBanco('c6 bank')?.corpo ?? '' }} />
        <text x="46" y="0" fontFamily={FONTE} fontWeight="500" fontSize="20" letterSpacing=".06em" fill="#1f2023">BANK</text>
      </g>
      <Master x={262} y={176} r={13} />
      <Titular texto={t} x={20} y={188} tam={9} cor="#1f2023" />
    </>,
  },
  'mercado pago': {
    cor: '#16294a', tinta: '#e9eef7',
    fundo: 'radial-gradient(70% 70% at 30% 15%, rgba(120,150,190,.45), transparent 60%), linear-gradient(150deg, #1f3858 0%, #13243e 55%, #0a1528 100%)',
    bloco: { left: '7%', top: '40%' },
    desenho: (t) => {
      const id = 'mp-letras'
      return <>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity=".9" />
            <stop offset=".55" stopColor="#c9d6e8" stopOpacity=".35" />
            <stop offset="1" stopColor="#000" stopOpacity=".55" />
          </linearGradient>
        </defs>
        <g fontFamily={FONTE} fontWeight="900" fontSize="44" letterSpacing="-.04em" fill={`url(#${id})`}>
          <text x="168" y="54">MER</text><text x="168" y="98">CADO</text><text x="168" y="142">PAGO</text>
        </g>
        <Chip x={22} y={24} w={32} prata />
        <Aprox x={64} y={38} s={0.8} />
        <Logo chave="mercado pago" x={18} y={150} w={34} h={28} pinta="#cfd8e6" />
        <text x="300" y="166" textAnchor="end" fontFamily={FONTE} fontSize="11" fontWeight="600" fill="#cfd8e6">credit</text>
        <Visa x={300} y={188} tam={22} cor="#e9eef7" />
        <Titular texto={t} x={60} y={170} tam={8.5} cor="#cfd8e6" />
      </>
    },
  },
  neon: {
    cor: '#26a6e6', tinta: '#fff',
    fundo: 'radial-gradient(90% 90% at 10% 0%, rgba(140,250,255,.6), transparent 55%), linear-gradient(135deg, #5be3f2 0%, #2cb4e8 48%, #1a7cd4 100%)',
    bloco: { left: '7%', top: '46%' },
    desenho: (t) => <>
      <Visa x={22} y={44} tam={24} ancora="start" extra="Gold" />
      <Chip x={250} y={22} w={34} prata />
      <Aprox x={296} y={34} s={0.7} />
      <text x="302" y="186" textAnchor="end" fontFamily={FONTE} fontWeight="800" fontStyle="italic" fontSize="34" letterSpacing="-.04em" fill="#fff">neon</text>
      <Titular texto={t} x={22} y={186} tam={9} />
    </>,
  },
  pagbank: {
    cor: '#d9e646', tinta: '#2b300c',
    fundo: 'radial-gradient(100% 90% at 20% 0%, #f3f78e, transparent 60%), linear-gradient(135deg, #eaf06c 0%, #dce84c 50%, #cbd93a 100%)',
    bloco: { left: '30%', top: '44%' },
    desenho: (t) => <>
      <g fill="none" stroke="rgba(255,255,255,.4)" strokeWidth="9">
        <circle cx="150" cy="40" r="66" /><circle cx="120" cy="170" r="58" />
      </g>
      <Visa x={34} y={176} tam={30} giro={-90} ancora="start" />
      <Aprox x={86} y={44} s={0.8} cor="#2b300c" giro={-90} />
      <Chip x={66} y={58} w={34} prata giro={-90} />
      <g transform="translate(302 160) rotate(-90)">
        <text x="0" y="0" fontFamily={FONTE} fontWeight="800" fontStyle="italic" fontSize="20" letterSpacing="-.02em" fill="#1f2310">PagBank</text>
      </g>
      <Logo chave="pagbank" x={262} y={162} w={30} h={30} />
      <Titular texto={t} x={276} y={156} tam={8.5} cor="#2b300c" giro={-90} />
    </>,
  },
  picpay: {
    cor: '#21c25e', tinta: '#fff',
    fundo: 'radial-gradient(100% 90% at 15% 0%, rgba(120,240,160,.45), transparent 55%), linear-gradient(135deg, #2fcf6e 0%, #20b65a 50%, #12994a 100%)',
    bloco: { left: '7%', top: '36%' },
    desenho: (t) => <>
      <text x="300" y="26" textAnchor="end" fontFamily={FONTE} fontSize="12" fontWeight="600" fill="rgba(255,255,255,.85)">gold</text>
      <Chip x={22} y={36} w={34} prata />
      <Aprox x={66} y={49} s={0.8} />
      <Logo chave="picpay" x={18} y={166} w={18} h={18} pinta="#fff" />
      <text x="40" y="182" fontFamily={FONTE} fontWeight="800" fontSize="19" letterSpacing="-.02em" fill="#fff">PicPay</text>
      <Master x={280} y={174} r={13} />
      <Titular texto={t} x={22} y={158} tam={8.5} />
    </>,
  },
  next: {
    // o Next do Edigar: verde-limão com o triângulo preto, "next" e o nome de lado, VISA de lado no alto à direita
    cor: '#5fe83a', tinta: '#123308',
    fundo: 'radial-gradient(90% 90% at 70% 80%, rgba(220,255,170,.45), transparent 60%), linear-gradient(135deg, #66f23f 0%, #5fe83a 55%, #52d630 100%)',
    bloco: { left: '17%', top: '63%' },
    desenho: (t) => <>
      <polygon points="89,27 231,68 165,166 209,153" fill="none" stroke="#1b1f17" strokeWidth="3.4" strokeLinejoin="round" />
      <Aprox x={58} y={50} s={1} cor="#fff" giro={-90} />
      <Chip x={38} y={69} w={39} prata />
      <text transform="translate(40 186) rotate(-90)" fontFamily={FONTE} fontWeight="600" fontSize="22" letterSpacing="-.01em" fill="#fff">next</text>
      <Titular texto={t} x={257} y={178} tam={9.5} giro={-90} cor="#f2fbe9" />
      <Visa x={298} y={78} tam={22} giro={-90} ancora="start" cor="#f2fbe9" />
    </>,
  },
}

/** O visual do banco do cartão, pelo nome do cartão ou do banco ligado a ele (o mesmo reconhecimento do selo). */
export function arteDoCartao(nome: string, banco?: string): ArteCartao | null {
  const chave = (estiloDoBanco(nome) ?? (banco ? estiloDoBanco(banco) : undefined))?.chave
  const a = chave ? ARTES[chave] : undefined
  return a && chave ? { chave, ...a } : null
}
