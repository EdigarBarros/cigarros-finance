/** Cores e letras do selo de cada banco (veja components/BancoIcone). */
export interface EstiloBanco {
  /** Duas cores do degradê do fundo. */
  fundo: [string, string]
  letra: string
  texto: string
  /** Faixa ou detalhe de outra cor, para os selos não ficarem todos iguais. */
  detalhe?: string
  /** Primeiro apelido do banco na lista abaixo: é por ele que o símbolo de verdade é achado (lib/logosBancos). */
  chave?: string
}

const E = (fundo: [string, string], letra: string, texto: string, detalhe?: string): EstiloBanco => ({ fundo, letra, texto, detalhe })

/** Nome (sem acento, minúsculo) → selo. Os apelidos curtos só valem como palavra inteira. */
const ESTILOS: [string[], EstiloBanco][] = [
  [['nubank', 'nu'], E(['#a43bdb', '#6a039a'], '#fff', 'nu')],
  [['itau'], E(['#ff8a1f', '#e26300'], '#fff', 'itaú', '#123c8c')],
  [['bradesco'], E(['#e3173f', '#a8051f'], '#fff', 'b')],
  [['banco do brasil', 'bb'], E(['#ffe14a', '#f2c200'], '#1c3f94', 'BB')],
  [['caixa', 'caixa economica'], E(['#2a74c4', '#14508f'], '#fff', 'X', '#f39200')],
  [['santander'], E(['#ff2b2b', '#c40000'], '#fff', 'S')],
  [['inter', 'banco inter'], E(['#ff9433', '#ff6a00'], '#fff', 'inter')],
  [['c6 bank', 'c6'], E(['#3a3a3a', '#0d0d0d'], '#fff', 'C6')],
  [['picpay'], E(['#3bd876', '#11a64b'], '#fff', 'P')],
  [['mercado pago', 'mp'], E(['#2ec4f3', '#008fcf'], '#fff', 'mp', '#ffe600')],
  [['pagbank', 'pagseguro'], E(['#1fc184', '#008a55'], '#fff', 'pb', '#ffd400')],
  [['neon'], E(['#5ff2ff', '#00bcd9'], '#043a4f', 'n')],
  [['next'], E(['#3cf095', '#00b45a'], '#062e1a', 'nx')],
  [['btg pactual', 'btg'], E(['#1f63a3', '#0a3561'], '#fff', 'btg')],
  [['xp'], E(['#2a2a2a', '#0a0a0a'], '#f5c400', 'XP')],
  [['sicredi'], E(['#58bd4d', '#2d8a25'], '#fff', 's')],
  [['sicoob'], E(['#1cbab3', '#007a74'], '#fff', 'sc', '#c9d200')],
  [['banrisul'], E(['#2a78c9', '#003f80'], '#fff', 'B')],
  [['original'], E(['#4fcf6a', '#1a9637'], '#fff', 'o')],
  [['will bank', 'will'], E(['#ffe042', '#f5c400'], '#1e1e1e', 'will')],
  [['infinitepay'], E(['#9be679', '#5dbf34'], '#0a2a10', 'ip')],
  [['banco pan', 'pan'], E(['#45b6f0', '#0d82c4'], '#fff', 'pan')],
  [['bv'], E(['#3b8cff', '#0052cc'], '#fff', 'bv')],
  [['safra'], E(['#2a3c78', '#101a3c'], '#d9b46a', 'S')],
  [['agibank', 'agi'], E(['#22d184', '#00995a'], '#fff', 'agi')],
  [['rico'], E(['#ff8a33', '#e65500'], '#fff', 'rico')],
  [['nomad'], E(['#ffe066', '#f5bf00'], '#1e1e1e', 'N')],
  [['wise'], E(['#b5f08f', '#86d64f'], '#163300', 'w')],
  [['carteira', 'dinheiro', 'dinheiro vivo', 'especie'], E(['#a6dc68', '#6fae35'], '#173b06', '$')],
]

const normal = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

/** Acha o selo pelo nome: nome inteiro do banco contido no texto, ou apelido curto como palavra inteira. */
export function estiloDoBanco(nome: string): EstiloBanco | undefined {
  const n = ` ${normal(nome)} `
  const achado = ESTILOS.find(([nomes]) => nomes.some((x) => n.includes(` ${x} `)))
  return achado && { ...achado[1], chave: achado[0][0] }
}

/** Cor da letra que dá para ler sobre uma cor de fundo (texto escuro em amarelo, claro em roxo). */
export function corSobre(hex: string) {
  const h = hex.replace('#', '')
  const v = h.length === 3 ? h.split('').map((x) => x + x).join('') : h.padEnd(6, '0')
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255)
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return lum > 0.62 ? '#141a26' : '#ffffff'
}

export const iniciaisDoBanco = (nome: string) => normal(nome).split(' ').filter(Boolean).slice(0, 2).map((x) => x[0]).join('').toUpperCase() || '?'

