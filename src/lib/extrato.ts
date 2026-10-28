/**
 * Extrato bancário → lançamentos. Lê PDF, CSV/TXT, Excel, Word (.docx) e OFX, acha em cada linha a data, o valor e se
 * entrou ou saiu, e limpa a descrição (tira CPF/CNPJ, códigos, horários e o "TRANSFERENCIA RECEBIDA PELO PIX" que os
 * bancos põem na frente). O que não dá para entender fica marcado para revisar. Nada é gravado aqui.
 */
import { CATALOGO_BANCOS } from './bancos'
import type { Tipo } from './types'
import { lerDoZip } from './zip'

export interface LinhaExtrato {
  /** AAAA-MM-DD */
  data: string
  descricao: string
  /** Como veio no arquivo (para a pessoa comparar). */
  original: string
  valor: number
  tipo: Tipo
  /** Motivo para a pessoa conferir (nome incompleto, tipo adivinhado…). */
  revisar?: string
}

export interface ExtratoLido {
  linhas: LinhaExtrato[]
  formato: string
  /** Banco reconhecido no arquivo (nome do catálogo). */
  banco?: string
}

// ---------- limpeza da descrição ----------

const normal = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const MINUSCULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'para', 'em', 'no', 'na', 'com', 'a', 'o'])

/** "JOAO DA SILVA" → "Joao da Silva"; nomes já com maiúsculas e minúsculas ficam como estão. */
function capitalizar(s: string) {
  const letras = s.replace(/[^A-Za-zÀ-ÿ]/g, '')
  const maiusculas = letras.replace(/[^A-ZÀ-Þ]/g, '').length
  if (!letras || maiusculas / letras.length < 0.7) return s
  return s.toLowerCase().split(' ').map((p, i) => (i > 0 && MINUSCULAS.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1))).join(' ')
}

/** Lojas e apps que aparecem com nomes estranhos no extrato. */
const LOJAS: [RegExp, string][] = [
  [/\bifood|\bifd\*/, 'iFood'], [/\buber\s*\*?\s*eats/, 'Uber Eats'], [/\buber\b/, 'Uber'], [/\b99\s*(app|pop|taxi|food)?\b|\b99app/, '99'],
  [/\brappi/, 'Rappi'], [/mercado\s*livre|mercadolivre|\bmeli\b/, 'Mercado Livre'], [/mercado\s*pago|\bmp\s*\*/, 'Mercado Pago'],
  [/amazon|amzn/, 'Amazon'], [/netflix/, 'Netflix'], [/spotify/, 'Spotify'], [/shopee/, 'Shopee'], [/shein/, 'Shein'],
  [/aliexpress/, 'AliExpress'], [/disney/, 'Disney+'], [/hbo|\bmax\.com/, 'Max'], [/youtube/, 'YouTube'], [/google/, 'Google'],
  [/apple\.com|\bapple\b|itunes/, 'Apple'], [/steam/, 'Steam'], [/playstation|\bpsn\b/, 'PlayStation'], [/xbox|microsoft/, 'Microsoft'],
  [/claro\b/, 'Claro'], [/\bvivo\b/, 'Vivo'], [/\btim\b/, 'TIM'], [/\boi\b/, 'Oi'], [/smart\s*fit/, 'Smart Fit'],
  [/carrefour/, 'Carrefour'], [/assai/, 'Assaí'], [/atacadao/, 'Atacadão'], [/pao de acucar/, 'Pão de Açúcar'],
  [/drogasil/, 'Drogasil'], [/droga\s*raia|\braia\b/, 'Droga Raia'], [/pague\s*menos/, 'Pague Menos'],
  [/mc\s*donald|mcdonald/, "McDonald's"], [/burger\s*king/, 'Burger King'], [/\bshell\b/, 'Posto Shell'], [/ipiranga/, 'Posto Ipiranga'],
  [/petrobras|\bbr\s*mania/, 'Posto Petrobras'], [/sem\s*parar/, 'Sem Parar'], [/airbnb/, 'Airbnb'], [/booking/, 'Booking'],
]

/** O que a linha é, pelo começo da descrição (a ordem importa: o mais específico primeiro). */
const TIPOS_DE_LINHA: { re: RegExp; tipo?: Tipo; nome: (resto: string, tipo: Tipo) => string }[] = [
  { re: /^(transf(erencia)?\.?\s+)?(pix\s+)?(recebid[oa]|recebimento)(\s+(pelo|via|por)\s+pix)?\s*(de|-|:)?\s*/, tipo: 'entrada', nome: (r) => (r ? `Pix de ${r}` : 'Pix recebido') },
  { re: /^(transf(erencia)?\.?\s+)?(pix\s+)?(enviad[oa]|envio)(\s+(pelo|via|por)\s+pix)?\s*(para|-|:)?\s*/, tipo: 'saida', nome: (r) => (r ? `Pix para ${r}` : 'Pix enviado') },
  { re: /^pix\s+de\s+/, tipo: 'entrada', nome: (r) => (r ? `Pix de ${r}` : 'Pix recebido') },
  { re: /^pix\s+para\s+/, tipo: 'saida', nome: (r) => (r ? `Pix para ${r}` : 'Pix enviado') },
  { re: /^(transferencia|transf\.?)\s+de\s+/, tipo: 'entrada', nome: (r) => (r ? `Transferência de ${r}` : 'Transferência recebida') },
  { re: /^(transferencia|transf\.?)\s+para\s+/, tipo: 'saida', nome: (r) => (r ? `Transferência para ${r}` : 'Transferência enviada') },
  { re: /^(ted|doc|transferencia|transf\.?)\s+recebid[oa]\s*(de|-|:)?\s*/, tipo: 'entrada', nome: (r) => (r ? `Transferência de ${r}` : 'Transferência recebida') },
  { re: /^(ted|doc|transferencia|transf\.?)\s+enviad[oa]\s*(para|-|:)?\s*/, tipo: 'saida', nome: (r) => (r ? `Transferência para ${r}` : 'Transferência enviada') },
  { re: /^pix\s*(transf(erencia)?\.?|qr\s*code|copia e cola|agendado)?\s*(-|:)?\s*/, nome: (r, t) => (r ? `Pix ${t === 'entrada' ? 'de' : 'para'} ${r}` : t === 'entrada' ? 'Pix recebido' : 'Pix enviado') },
  { re: /^(ted|doc|transferencia|transf\.?)\s*(-|:)?\s*/, nome: (r, t) => (r ? `Transferência ${t === 'entrada' ? 'de' : 'para'} ${r}` : 'Transferência') },
  { re: /^((pagamento|pgto|pag\.?)\s+(de\s+)?)?(boleto|titulo)\s*(-|:)?\s*/, tipo: 'saida', nome: (r) => (r ? `Boleto ${r}` : 'Boleto') },
  { re: /^((pagamento|pgto)\s+(de\s+)?)?fatura\s*(do\s+cartao)?\s*(-|:)?\s*/, tipo: 'saida', nome: (r) => (r ? `Fatura ${r}` : 'Fatura do cartão') },
  { re: /^(compra (com |no |de )?cart[aã]o( de debito| de credito| deb| cred)?( mc| visa| elo)?|compra no debito|compra no credito|compra|debito|cartao)\s*(-|:|em)?\s*/, tipo: 'saida', nome: (r) => r || 'Compra' },
  { re: /^(saque)\b\s*(-|:)?\s*/, tipo: 'saida', nome: () => 'Saque' },
  { re: /^(tarifa|taxa|iof|juros|multa)\b/, tipo: 'saida', nome: (r) => r || 'Tarifa do banco' },
  { re: /^(rendimento|rend\.?\s+pago|juros sobre|remuneracao)/, tipo: 'entrada', nome: () => 'Rendimento' },
  { re: /^(estorno|reembolso|cashback|devolucao)\s*(-|:)?\s*/, tipo: 'entrada', nome: (r, _t) => (r ? `Estorno ${r}` : 'Estorno') },
  { re: /^(deposito|dep\.?)\b\s*(-|:)?\s*/, tipo: 'entrada', nome: (r) => (r ? `Depósito ${r}` : 'Depósito') },
  { re: /^(salario|pagamento de salario|folha)/, tipo: 'entrada', nome: () => 'Salário' },
]

/** Pedaços que nunca são nome: documentos, códigos, horários, datas, valores, agência/conta. */
function semRuido(s: string) {
  return s
    .replace(/\b[a-z]?\d[\da-z]{9,}\b/gi, (m) => (/\d{4}/.test(m) ? ' ' : m)) // ids de transação (E1234567820231012…)
    .replace(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\b\d{14}\b/g, ' ') // CNPJ
    .replace(/\d{3}\.\d{3}\.\d{3}-\d{2}/g, ' ') // CPF
    .replace(/[*•x]{2,3}\.?\d{3}\.?\d{3}-?[*•x]{1,2}/gi, ' ') // CPF mascarado
    .replace(/\b\d{2}\.\d{3}\.\d{3}\b/g, ' ') // raiz de CNPJ (MEI: "51.365.272 Fulano")
    .replace(/(^|\s)(ag([eê]ncia)?|conta|cc|c\/c|banco|inst(itui[cç][aã]o)?|id|doc|nsu|aut(oriza[cç][aã]o)?|c[oó]d(igo)?)\.?\s*:?\s*[\w-]*\d[\w-]*/gi, ' ')
    .replace(/\b[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}\b/gi, ' ')
    .replace(/\b\d{1,2}:\d{2}(:\d{2})?\b/g, ' ') // horário
    .replace(/(?<=[a-z])\d{1,2}\/\d{1,2}\b/gi, ' ') // data grudada no nome (Itaú: "JOSE A16/10")
    .replace(/\b\d{1,2}[/.-]\d{1,2}([/.-]\d{2,4})?\b/g, ' ') // data
    .replace(/[-+−]?\s*r\$\s*[\d.,]+/gi, ' ')
    .replace(/\b\d+([.,]\d+)*\b/g, (m) => (m.replace(/\D/g, '').length >= 4 ? ' ' : m)) // números soltos longos
    .replace(/[|•*_#]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/(\s[a-z])+$/i, '') // letra solta no fim (sobra de nome cortado)
    .replace(/^[\s\-–:.,/]+|[\s\-–:.,/]+$/g, '')
}

/** Pedaços que são do banco ou da conta, não de quem pagou ou recebeu. */
const INSTITUICAO = /pagamentos|\bbanco\b|\bbco\b|\binstitui|\bip\b|\bs\.?\s?a\.?$|\bnu\b|picpay|mercado ?pago|pagseguro|pagbank|caixa economica|bradesco|itau|santander|\binter\b|\bc6\b|ag[eê]ncia|\bconta\b/i

/**
 * Nos extratos o nome vem picado: "MARIA DE SOUZA - ***.123.456-** - NU PAGAMENTOS - Agência: 1". Fica o primeiro
 * pedaço que tem cara de nome (sem documento, código ou nome de banco).
 */
function nomeDosPedacos(s: string) {
  const pedacos = s.split(/\s[-–|]\s|\s{2,}/).map(semRuido).filter((p) => p.replace(/[^A-Za-zÀ-ÿ]/g, '').length >= 2)
  return pedacos.find((p) => !INSTITUICAO.test(normal(p))) ?? pedacos[0] ?? ''
}

/**
 * Descrição limpa de um lançamento do extrato e, se for o caso, o tipo que ela revela ("Pix recebido" é entrada).
 * `revisar` diz quando sobrou pouco do nome (só números, ou cortado).
 */
export function limparDescricao(bruta: string, tipoAtual?: Tipo): { descricao: string; tipo?: Tipo; revisar?: string } {
  const original = bruta.replace(/\s+/g, ' ').trim()
  const n = normal(original)
  for (const [re, loja] of LOJAS) if (re.test(n)) return { descricao: loja }
  const limpo = semRuido(original)
  const nl = normal(limpo)
  for (const t of TIPOS_DE_LINHA) {
    const m = nl.match(t.re)
    if (!m) continue
    const resto = capitalizar(nomeDosPedacos(limpo.slice(m[0].length)))
    const tipo = t.tipo ?? tipoAtual ?? 'saida'
    const descricao = t.nome(resto, tipo).trim()
    const curto = resto && resto.replace(/[^A-Za-zÀ-ÿ]/g, '').length < 3
    return { descricao, tipo: t.tipo, revisar: curto ? 'nome incompleto' : undefined }
  }
  const nome = capitalizar(limpo)
  const letras = nome.replace(/[^A-Za-zÀ-ÿ]/g, '').length
  if (letras < 3) {
    const t = tipoAtual ?? 'saida'
    return { descricao: t === 'entrada' ? 'Entrada' : 'Saída', revisar: original ? 'sem nome: só números no extrato' : 'sem descrição' }
  }
  return { descricao: nome }
}

// ---------- datas e valores ----------

const MESES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const dois = (n: number) => String(n).padStart(2, '0')
const valida = (a: number, m: number, d: number) => m >= 1 && m <= 12 && d >= 1 && d <= 31 && a >= 2000 && a <= 2100

/** Acha uma data no texto (vários formatos). `anoPadrao` para "12/10" e "12 out". Devolve a data e onde ela estava. */
export function acharData(s: string, anoPadrao: number): { data: string; trecho: string } | null {
  const t = normal(s)
  let m = t.match(/\b(\d{4})-(\d{2})-(\d{2})\b/)
  if (m && valida(+m[1], +m[2], +m[3])) return { data: `${m[1]}-${m[2]}-${m[3]}`, trecho: m[0] }
  m = t.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/)
  if (m) {
    const a = m[3].length === 2 ? 2000 + +m[3] : +m[3]
    if (valida(a, +m[2], +m[1])) return { data: `${a}-${dois(+m[2])}-${dois(+m[1])}`, trecho: m[0] }
  }
  m = t.match(/\b(\d{1,2})\s*(de\s+)?(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-zç]*\.?(\s*(de\s+)?(\d{4}))?\b/)
  if (m) {
    const mes = MESES_ABREV.indexOf(m[3]) + 1
    const a = m[6] ? +m[6] : anoPadrao
    if (valida(a, mes, +m[1])) return { data: `${a}-${dois(mes)}-${dois(+m[1])}`, trecho: m[0] }
  }
  m = t.match(/(^|\s)(\d{1,2})\/(\d{1,2})(\s|$)/)
  if (m && valida(anoPadrao, +m[3], +m[2])) return { data: `${anoPadrao}-${dois(+m[3])}-${dois(+m[2])}`, trecho: m[0].trim() }
  return null
}

/** Valores em reais no texto, na ordem: "- R$ 1.234,56", "1234.56", "(50,00)", "30,00 D". */
export function acharValores(s: string): { valor: number; sinal: -1 | 0 | 1; trecho: string }[] {
  // o número tem que estar inteiro: "51.365.272" (raiz de CNPJ) não pode virar R$ 51,36
  const re = /([-+−]\s*)?(r\$\s*)?(\(?)(?<![\d.,])(\d{1,3}(?:\.\d{3})+,\d{2}|\d+,\d{2}|\d{1,3}(?:,\d{3})+\.\d{2}|\d+\.\d{2})(?![\d.,]*\d)(\)?)(\s*[-+](?!\s*\d)|\s+[dc]\b)?/gi
  const lista: { valor: number; sinal: -1 | 0 | 1; trecho: string }[] = []
  for (const m of s.matchAll(re)) {
    const num = m[4]
    const br = /,\d{2}$/.test(num)
    const valor = Number(br ? num.replace(/\./g, '').replace(',', '.') : num.replace(/,/g, ''))
    if (!Number.isFinite(valor) || valor === 0) continue
    const fim = (m[6] ?? '').trim().toLowerCase()
    const sinal: -1 | 0 | 1 = m[1]?.match(/[-−]/) || (m[3] && m[5]) || fim === '-' || fim === 'd' ? -1 : m[1]?.includes('+') || fim === '+' || fim === 'c' ? 1 : 0
    lista.push({ valor, sinal, trecho: m[0] })
  }
  return lista
}

const PISTA_ENTRADA = /recebid|recebimento|credito|deposito|estorno|rendimento|salario|reembolso|cashback|devolucao|entrada/
const PISTA_SAIDA = /enviad|pagamento|pgto|compra|debito|saque|tarifa|boleto|fatura|envio|saida|transferencia para/
const IGNORAR = /^(saldo|total|saldo (do dia|anterior|final|disponivel|em conta)|data\b|lancamentos?\b|periodo|extrato|movimentac)/

function tipoPorPista(texto: string): Tipo | null {
  const n = normal(texto)
  if (PISTA_ENTRADA.test(n)) return 'entrada'
  if (PISTA_SAIDA.test(n)) return 'saida'
  return null
}

function montar(data: string, desc: string, valor: number, sinal: -1 | 0 | 1, extraTipo?: Tipo): LinhaExtrato {
  let tipo: Tipo = sinal < 0 ? 'saida' : sinal > 0 ? 'entrada' : extraTipo ?? tipoPorPista(desc) ?? 'saida'
  const adivinhado = !sinal && !extraTipo && !tipoPorPista(desc)
  const limpo = limparDescricao(desc, tipo)
  if (!sinal && !extraTipo && limpo.tipo) tipo = limpo.tipo
  return {
    data, valor: Math.round(Math.abs(valor) * 100) / 100, tipo, descricao: limpo.descricao, original: desc.trim(),
    revisar: limpo.revisar ?? (adivinhado && !limpo.tipo ? 'confira se entrou ou saiu' : undefined),
  }
}

// ---------- texto corrido (PDF, Word, TXT) ----------

/**
 * Linhas de texto → lançamentos. Uma linha com data e valor é um lançamento; linha só com data vira o dia dos
 * próximos (extratos que agrupam por dia); linha sem data nem valor logo depois de um lançamento completa a descrição
 * dele (nome quebrado em duas linhas).
 */
export function deTexto(linhas: string[], anoPadrao: number): LinhaExtrato[] {
  const saida: LinhaExtrato[] = []
  let diaAtual: string | null = null
  let ultimo: { l: LinhaExtrato; bruta: string } | null = null
  // linha com data e descrição mas sem valor: o valor vem na linha seguinte ("15/10 PIX RECEBIDO" + "MARIA … R$ 1.200,00")
  let pendente: { data: string; texto: string } | null = null
  for (const bruta of linhas) {
    const linha = bruta.replace(/\s+/g, ' ').trim()
    if (!linha) continue
    const n = normal(linha)
    const d = acharData(linha, anoPadrao)
    const valores = acharValores(linha)
    if (IGNORAR.test(n) || /\bsaldo\b/.test(n) && valores.length <= 1 && !/pix|transf|compra|pagamento/.test(n)) { ultimo = null; continue }
    if (d && !valores.length) {
      const resto = semRuido(linha.replace(d.trecho, ''))
      if (resto.replace(/[^A-Za-zÀ-ÿ]/g, '').length < 4) { diaAtual = d.data; ultimo = null; pendente = null; continue }
      pendente = { data: d.data, texto: linha.replace(d.trecho, ' ') }
      ultimo = null
      continue
    }
    const data = d?.data ?? pendente?.data ?? diaAtual
    if (valores.length && data) {
      // com dois valores na linha, o último costuma ser o saldo: vale o primeiro
      const v = valores[0]
      let desc = (!d && pendente ? `${pendente.texto} ` : '') + linha.replace(v.trecho, ' ')
      pendente = null
      if (d) desc = desc.replace(new RegExp(d.trecho.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&'), 'i'), ' ')
      for (const x of valores.slice(1)) desc = desc.replace(x.trecho, ' ')
      const l = montar(data, desc, v.valor, v.sinal)
      saida.push(l)
      ultimo = { l, bruta: desc }
      continue
    }
    // continuação do nome do lançamento anterior
    if (ultimo && !d && !valores.length && linha.length < 60) {
      const junto: string = `${ultimo.bruta} ${linha}`
      const novo = montar(ultimo.l.data, junto, ultimo.l.valor, ultimo.l.tipo === 'entrada' ? 1 : -1)
      Object.assign(ultimo.l, { descricao: novo.descricao, original: novo.original, revisar: novo.revisar })
      ultimo = { l: ultimo.l, bruta: junto }
    }
  }
  return saida
}

// ---------- tabelas (CSV, Excel, tabelas do Word) ----------

const COLUNAS = {
  data: /^(data|date|dt)\b|data (da )?(transacao|lancamento|movimento|compra)/,
  desc: /descri|historico|lancamento|estabelecimento|^title$|memo|detalhe|favorecido|nome|beneficiario/,
  valor: /^(valor|amount|quantia|montante)|valor \(r\$\)|valor r\$/,
  credito: /^(credito|entrada|entradas|valor credito)/,
  debito: /^(debito|saida|saidas|valor debito)/,
  tipo: /^(tipo|natureza|d\/c|c\/d|operacao)$/,
  saldo: /^saldo/,
}

/** Valor de uma célula: número cru do Excel ("-80.5", "250") ou texto com R$ e vírgula. */
function valorDaCelula(c: string): { valor: number; sinal: -1 | 0 | 1 } | null {
  const t = c.trim()
  if (/^[-+]?\d+(\.\d+)?$/.test(t)) {
    const n = Number(t)
    return n ? { valor: Math.abs(n), sinal: n < 0 ? -1 : 1 } : null
  }
  return acharValores(t)[0] ?? null
}

/** Linhas de uma tabela → lançamentos. Acha o cabeçalho (ou adivinha as colunas pelo conteúdo). */
export function deTabela(linhas: string[][], anoPadrao: number): LinhaExtrato[] {
  const rows = linhas.map((r) => r.map((c) => String(c ?? '').trim())).filter((r) => r.some(Boolean))
  if (!rows.length) return []
  let iCab = -1
  let col: Partial<Record<keyof typeof COLUNAS, number>> = {}
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const achado: typeof col = {}
    rows[i].forEach((c, j) => {
      const n = normal(c)
      for (const k of Object.keys(COLUNAS) as (keyof typeof COLUNAS)[]) {
        if (achado[k] === undefined && COLUNAS[k].test(n) && !(k === 'desc' && /^(data|valor|saldo)/.test(n))) achado[k] = j
      }
    })
    // a descrição: a coluna de nome mais forte ("Descrição" antes de "Histórico" antes de "Nome")
    const prioridade = [/descri/, /estabelecimento|^title$/, /historico/, /lancamento/, /memo|detalhe/, /favorecido|beneficiario|nome/]
    for (const re of prioridade) {
      const j = rows[i].findIndex((c) => re.test(normal(c)) && !/^(data|valor|saldo)/.test(normal(c)))
      if (j >= 0) { achado.desc = j; break }
    }
    if (achado.data !== undefined && (achado.valor !== undefined || achado.credito !== undefined || achado.debito !== undefined)) {
      iCab = i
      col = achado
      break
    }
  }
  const corpo = iCab >= 0 ? rows.slice(iCab + 1) : rows
  if (iCab < 0) {
    // sem cabeçalho: a coluna com mais datas, a com mais valores e a com mais texto
    const largura = Math.max(...rows.map((r) => r.length))
    const conta = (f: (c: string) => boolean) => Array.from({ length: largura }, (_, j) => rows.filter((r) => r[j] && f(r[j])).length)
    const datas = conta((c) => Boolean(acharData(c, anoPadrao)) && c.length <= 25)
    const valores = conta((c) => Boolean(valorDaCelula(c)) && c.replace(/[^\d]/g, '').length <= 12 && !/[a-z]{3}/i.test(c) && !acharData(c, anoPadrao))
    const textos = Array.from({ length: largura }, (_, j) => rows.reduce((a, r) => a + (r[j]?.replace(/[^A-Za-zÀ-ÿ]/g, '').length ?? 0), 0))
    col.data = datas.indexOf(Math.max(...datas))
    col.valor = valores.indexOf(Math.max(...valores))
    col.desc = textos.indexOf(Math.max(...textos))
    if (!datas[col.data] || !valores[col.valor]) return deTexto(rows.map((r) => r.join('  ')), anoPadrao)
  }
  const saida: LinhaExtrato[] = []
  for (const r of corpo) {
    const d = col.data !== undefined ? acharData(r[col.data] ?? '', anoPadrao) : null
    if (!d) continue
    if (r.some((c, j) => j !== col.data && IGNORAR.test(normal(c)))) continue
    let valor = 0
    let sinal: -1 | 0 | 1 = 0
    if (col.valor !== undefined && r[col.valor]) {
      const v = valorDaCelula(r[col.valor])
      if (v) { valor = v.valor; sinal = v.sinal }
    }
    if (!valor && col.credito !== undefined) { const v = valorDaCelula(r[col.credito] ?? ''); if (v) { valor = v.valor; sinal = 1 } }
    if (!valor && col.debito !== undefined) { const v = valorDaCelula(r[col.debito] ?? ''); if (v) { valor = v.valor; sinal = -1 } }
    if (!valor) continue
    let extraTipo: Tipo | undefined
    if (col.tipo !== undefined) {
      const t = normal(r[col.tipo] ?? '')
      if (/^(c|credito|entrada|receita)/.test(t)) extraTipo = 'entrada'
      else if (/^(d|debito|saida|despesa)/.test(t)) extraTipo = 'saida'
    }
    // descrição: a coluna de descrição e, se houver, as outras de texto (Inter: "Histórico" + "Descrição")
    const usadas = new Set([col.data, col.valor, col.credito, col.debito, col.tipo, col.saldo].filter((x) => x !== undefined))
    // outras colunas de texto, menos as que são código (sem espaço, com número: "abc-123", ids)
    // na ordem das colunas, para "Pix recebido" + "Fulano" virar "Pix de Fulano"
    const ehTexto = (c: string) => c && /[A-Za-zÀ-ÿ]/.test(c) && !acharData(c, anoPadrao) && !(/\d/.test(c) && !/\s/.test(c.trim()))
    const desc = r.filter((c, j) => j === col.desc ? Boolean(c) : !usadas.has(j) && ehTexto(c)).join(' - ')
    saida.push(montar(d.data, desc, valor, sinal, extraTipo))
  }
  return saida
}

/** CSV com separador adivinhado (; , ou tab) e aspas. */
export function lerCsv(texto: string): string[][] {
  const primeira = texto.split(/\r?\n/).find((l) => l.trim()) ?? ''
  const sep = [';', '\t', ','].sort((a, b) => primeira.split(b).length - primeira.split(a).length)[0]
  const linhas: string[][] = []
  let campo = ''
  let linha: string[] = []
  let aspas = false
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i]
    if (aspas) {
      if (ch === '"' && texto[i + 1] === '"') { campo += '"'; i++ } else if (ch === '"') aspas = false
      else campo += ch
    } else if (ch === '"') aspas = true
    else if (ch === sep) { linha.push(campo); campo = '' } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && texto[i + 1] === '\n') i++
      linha.push(campo)
      linhas.push(linha)
      linha = []
      campo = ''
    } else campo += ch
  }
  if (campo || linha.length) { linha.push(campo); linhas.push(linha) }
  return linhas
}

/** OFX (o formato "Money" que vários bancos exportam): cada <STMTTRN> é um lançamento. */
export function deOfx(texto: string): LinhaExtrato[] {
  const campo = (bloco: string, nome: string) => bloco.match(new RegExp(`<${nome}>([^<\\r\\n]*)`, 'i'))?.[1]?.trim() ?? ''
  const saida: LinhaExtrato[] = []
  for (const m of texto.matchAll(/<STMTTRN>([\s\S]*?)(<\/STMTTRN>|(?=<STMTTRN>)|<\/BANKTRANLIST>)/gi)) {
    const b = m[1]
    const d = campo(b, 'DTPOSTED')
    const v = Number(campo(b, 'TRNAMT').replace(',', '.'))
    if (d.length < 8 || !v) continue
    const desc = [campo(b, 'NAME'), campo(b, 'MEMO')].filter(Boolean).join(' - ')
    saida.push(montar(`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`, desc, v, v < 0 ? -1 : 1))
  }
  return saida
}

// ---------- arquivos ----------

/** Leitor de PDF (pdf.js), baixado só quando alguém importa um PDF. */
const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168'

interface ItemTexto { str: string; transform: number[]; width: number }

/** Texto do PDF em linhas, na ordem de leitura (agrupa por altura na página e ordena da esquerda para a direita). */
async function linhasDoPdf(dados: ArrayBuffer): Promise<string[]> {
  let pdfjs: { getDocument: (o: object) => { promise: Promise<{ numPages: number; getPage: (n: number) => Promise<{ getTextContent: () => Promise<{ items: ItemTexto[] }> }> }> }; GlobalWorkerOptions: { workerSrc: string } }
  try {
    pdfjs = await import(/* @vite-ignore */ `${PDFJS}/pdf.min.mjs`)
  } catch {
    throw new Error('Não consegui carregar o leitor de PDF (precisa de internet). Tente exportar o extrato em CSV ou Excel.')
  }
  pdfjs.GlobalWorkerOptions.workerSrc = `${PDFJS}/pdf.worker.min.mjs`
  let doc
  try {
    doc = await pdfjs.getDocument({ data: new Uint8Array(dados) }).promise
  } catch (e) {
    throw new Error(/password/i.test(String(e)) ? 'Esse PDF tem senha. Abra no app do banco e exporte sem senha (ou em CSV).' : 'Não consegui abrir esse PDF.')
  }
  const linhas: string[] = []
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const { items } = await page.getTextContent()
    const grupos: { y: number; itens: ItemTexto[] }[] = []
    for (const it of items) {
      if (!it.str?.trim()) continue
      const y = it.transform[5]
      const g = grupos.find((x) => Math.abs(x.y - y) < 3)
      if (g) g.itens.push(it)
      else grupos.push({ y, itens: [it] })
    }
    grupos.sort((a, b) => b.y - a.y)
    for (const g of grupos) {
      g.itens.sort((a, b) => a.transform[4] - b.transform[4])
      let texto = ''
      let fim = -Infinity
      for (const it of g.itens) {
        const x = it.transform[4]
        texto += (texto ? (x - fim > 14 ? '  ' : ' ') : '') + it.str.trim()
        fim = x + (it.width ?? 0)
      }
      linhas.push(texto)
    }
  }
  return linhas
}

/** Parágrafos e linhas de tabela de um .docx. */
async function linhasDoWord(dados: ArrayBuffer): Promise<{ tabela: string[][]; texto: string[] }> {
  const xml = await lerDoZip(dados, 'word/document.xml')
  if (!xml) throw new Error('Não achei o texto dentro desse arquivo do Word.')
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
  const textoDe = (el: Element) => [...el.getElementsByTagNameNS(W, 't')].map((t) => t.textContent ?? '').join('')
  const tabela = [...doc.getElementsByTagNameNS(W, 'tr')].map((tr) => [...tr.getElementsByTagNameNS(W, 'tc')].map(textoDe))
  const texto = [...doc.getElementsByTagNameNS(W, 'p')].filter((p) => !p.closest('tbl')).map(textoDe)
  return { tabela, texto }
}

function bancoNoTexto(texto: string) {
  const n = ` ${normal(texto).replace(/[^a-z0-9 ]/g, ' ')} `
  return CATALOGO_BANCOS.find((b) => !b.nome.startsWith('Carteira') && n.includes(` ${normal(b.nome)} `))?.nome
}

/** Lê o arquivo do extrato e devolve os lançamentos encontrados (do mais antigo para o mais novo). */
export async function lerExtrato(arquivo: File, anoPadrao = new Date().getFullYear()): Promise<ExtratoLido> {
  const nome = arquivo.name.toLowerCase()
  const ext = nome.split('.').pop() ?? ''
  const dados = await arquivo.arrayBuffer()
  let linhas: LinhaExtrato[] = []
  let formato = ext.toUpperCase()
  let textoTodo = arquivo.name
  if (ext === 'pdf') {
    const ls = await linhasDoPdf(dados)
    textoTodo += ` ${ls.slice(0, 40).join(' ')}`
    linhas = deTexto(ls, anoPadrao)
  } else if (ext === 'docx') {
    const w = await linhasDoWord(dados)
    textoTodo += ` ${w.texto.slice(0, 40).join(' ')}`
    linhas = w.tabela.length > 2 ? deTabela(w.tabela, anoPadrao) : []
    if (!linhas.length) linhas = deTexto([...w.texto, ...w.tabela.map((r) => r.join('  '))], anoPadrao)
    formato = 'Word'
  } else if (ext === 'xlsx' || ext === 'xls' || ext === 'ods') {
    const XLSX = await import('xlsx')
    const wb = XLSX.read(dados, { type: 'array', cellDates: true })
    // células cruas: data vira AAAA-MM-DD e número fica número (formatado, "-80.5" perderia o jeito de valor)
    const celula = (v: unknown) => (v instanceof Date ? `${v.getFullYear()}-${dois(v.getMonth() + 1)}-${dois(v.getDate())}` : String(v ?? ''))
    const folhas = wb.SheetNames.map((s) => XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[s], { header: 1, raw: true, defval: '' }).map((r) => r.map(celula)))
    const maior = folhas.sort((a, b) => b.length - a.length)[0] ?? []
    textoTodo += ` ${maior.slice(0, 10).flat().join(' ')}`
    linhas = deTabela(maior, anoPadrao)
    formato = 'Excel'
  } else if (ext === 'doc') {
    throw new Error('Arquivos .doc antigos não dão para ler. Abra no Word e salve como .docx (ou exporte o extrato em PDF/CSV).')
  } else {
    // CSV, TXT, OFX: texto (tenta UTF-8 e, com caracteres quebrados, Latin-1, comum nos bancos)
    let texto = new TextDecoder('utf-8').decode(dados)
    if (texto.includes('�')) texto = new TextDecoder('windows-1252').decode(dados)
    textoTodo += ` ${texto.slice(0, 3000)}`
    if (/<OFX>|<STMTTRN>/i.test(texto)) { linhas = deOfx(texto); formato = 'OFX' } else {
      const tabela = lerCsv(texto)
      linhas = tabela.some((r) => r.length >= 3) ? deTabela(tabela, anoPadrao) : []
      if (!linhas.length) linhas = deTexto(texto.split(/\r?\n/), anoPadrao)
      formato = ext === 'csv' ? 'CSV' : 'Texto'
    }
  }
  linhas.sort((a, b) => a.data.localeCompare(b.data))
  return { linhas, formato, banco: bancoNoTexto(textoTodo) }
}
