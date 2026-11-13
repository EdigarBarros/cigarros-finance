/**
 * Extrato bancário → lançamentos. Lê PDF, CSV/TXT, Excel, Word (.docx) e OFX, acha em cada linha a data, o valor e se
 * entrou ou saiu, e limpa a descrição (tira CPF/CNPJ, códigos, horários e o "TRANSFERENCIA RECEBIDA PELO PIX" que os
 * bancos põem na frente). O que não dá para entender fica marcado para revisar. Nada é gravado aqui.
 */
import { CATALOGO_BANCOS } from './bancos'
import type { Tipo } from './types'
import { formaPelaDescricao, type FormaGravada } from './formas'
import { lerDoZip } from './zip'
import { lerTudo, supabase } from './supabase'
import { registrarErro } from './erros'

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
  /** Como foi pago, quando o extrato diz (Pix, transferência, boleto, débito): o nome fica só com a pessoa ou a loja. */
  forma?: FormaGravada | null
  /**
   * Pagamento da fatura numa fatura de cartão ("Pagamento recebido"). Não é renda: é o dinheiro que saiu da conta para pagar o
   * cartão, e esse já aparece no extrato da conta. Vem desmarcado na revisão para não contar em dobro.
   */
  pagamentoDaFatura?: boolean
}

export interface ExtratoLido {
  linhas: LinhaExtrato[]
  formato: string
  /** Banco reconhecido no arquivo (nome do catálogo). */
  banco?: string
  /** Quantidades sobre o texto do arquivo (nunca o conteúdo): explicam por que nada foi lido. */
  pistas: PistasDoTexto
}

export interface PistasDoTexto {
  /** linhas com algum texto */
  linhas: number
  /** linhas com data, com valor e com os dois */
  comData: number
  comValor: number
  comDataEValor: number
  /** parece comprovante de um pagamento só (Pix, TED, boleto), não um extrato */
  comprovante: boolean
}

/**
 * O que o texto do arquivo tem, em quantidades: quantas linhas, quantas com data, com valor, com os dois e se parece um
 * comprovante. Serve para explicar por que nada virou lançamento sem guardar nada do que está escrito.
 */
export function pistasDoTexto(textos: string[], anoPadrao = new Date().getFullYear()): PistasDoTexto {
  const linhas = textos.map((t) => t.trim()).filter(Boolean)
  let comData = 0, comValor = 0, comDataEValor = 0
  for (const t of linhas) {
    const d = Boolean(acharData(t, anoPadrao))
    const v = acharValores(t).length > 0
    if (d) comData++
    if (v) comValor++
    if (d && v) comDataEValor++
  }
  const tudo = normal(linhas.slice(0, 80).join(' '))
  const comprovante = /\b(comprovante|recibo)\b/.test(tudo) && comDataEValor <= 2 && linhas.length <= 80
  return { linhas: linhas.length, comData, comValor, comDataEValor, comprovante }
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
  [/\bifood|\bifd\*/, 'iFood'], [/\buber\s*\*?\s*eats/, 'Uber Eats'], [/\buber\b/, 'Uber'], [/(?<![\d.,/*-])\b99\s*(app|pop|taxi|food)?\b(?![.,/-]?\d)/, '99'],
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
const TIPOS_DE_LINHA: { re: RegExp; tipo?: Tipo; /** Pix ou transferência: o que vem depois é uma pessoa (ou loja) do outro lado. */ pessoa?: boolean; nome: (resto: string, tipo: Tipo) => string }[] = [
  // Bradesco: "TRANSFERENCIA PIX" e, na linha de baixo, "REM: FULANO" (quem mandou) ou "DES: FULANO" (para quem foi)
  // (o que vem antes, "TRANSFERENCIA PIX", "PIX QR CODE DINAMICO", é só o jeito)
  { pessoa: true, re: /^(.*?\s)?rem:\s*/, tipo: 'entrada', nome: (r) => r || 'Pix recebido' },
  { pessoa: true, re: /^(.*?\s)?des:\s*/, tipo: 'saida', nome: (r) => r || 'Pix enviado' },
  { pessoa: true, re: /^(transf(erencia)?\.?\s+)?(pix\s+(?:[-–]\s+)?)?(recebid[oa]|recebimento)(\s+(pelo|via|por)\s+pix)?\s*(de|-|:)?\s*/, tipo: 'entrada', nome: (r) => r || 'Pix recebido' },
  { pessoa: true, re: /^(transf(erencia)?\.?\s+)?(pix\s+(?:[-–]\s+)?)?(enviad[oa]|envio|emitid[oa])(\s+(pelo|via|por)\s+pix)?\s*(para|-|:)?\s*/, tipo: 'saida', nome: (r) => r || 'Pix enviado' },
  { pessoa: true, re: /^pix\s+de\s+/, tipo: 'entrada', nome: (r) => r || 'Pix recebido' },
  { pessoa: true, re: /^pix\s+para\s+/, tipo: 'saida', nome: (r) => r || 'Pix enviado' },
  { pessoa: true, re: /^(transferencia|transf\.?)\s+de\s+/, tipo: 'entrada', nome: (r) => r || 'Transferência recebida' },
  { pessoa: true, re: /^(transferencia|transf\.?)\s+para\s+/, tipo: 'saida', nome: (r) => r || 'Transferência enviada' },
  { pessoa: true, re: /^(ted|doc|transferencia|transf\.?)\s+recebid[oa]\s*(de|-|:)?\s*/, tipo: 'entrada', nome: (r) => r || 'Transferência recebida' },
  { pessoa: true, re: /^(ted|doc|transferencia|transf\.?)\s+enviad[oa]\s*(para|-|:)?\s*/, tipo: 'saida', nome: (r) => r || 'Transferência enviada' },
  { pessoa: true, re: /^pix\s*(transf(erencia)?\.?|qr[sc]?(\s*code)?|copia e cola|agendado)?\s*(-|:)?\s*/, nome: (r, t) => r || (t === 'entrada' ? 'Pix recebido' : 'Pix enviado') },
  { pessoa: true, re: /^(ted|doc|transferencia|transf\.?)\s*(-|:)?\s*/, nome: (r, t) => r || (t === 'entrada' ? 'Transferência recebida' : 'Transferência enviada') },
  // Nubank: "Pagamento de boleto efetuado - ENEL" (o "efetuado" não é nome)
  { re: /^((pagamento|pgto|pag\.?)\s+(de\s+)?)?(boleto|titulo)(\s+(efetuado|realizado|pago|agendado))?\s*(-|:)?\s*/, tipo: 'saida', nome: (r) => r || 'Boleto' },
  { re: /^((pagamento|pgto)\s+(de\s+)?)?fatura\s*(do\s+cartao)?\s*(-|:)?\s*/, tipo: 'saida', nome: (r) => (r ? `Fatura ${r}` : 'Fatura do cartão') },
  { re: /^(visa electron|maestro|(elo|mastercard|master|visa) d[eé]bito|compra parcelad[ao]|compra (com |no |de )?cart[aã]o( de debito| de credito| deb| cred)?( mc| visa| elo)?|compra no debito|compra no credito|compra|debito|cartao)\s*(-|:|em)?\s*/, tipo: 'saida', nome: (r) => r || 'Compra' },
  { re: /^(saque)\b\s*(-|:)?\s*/, tipo: 'saida', nome: () => 'Saque' },
  { re: /^(tarifa|taxa|iof|juros|multa)\b/, tipo: 'saida', nome: (r) => r || 'Tarifa do banco' },
  { re: /^(rendimento|rend\.?\s+pago|juros sobre|remuneracao)/, tipo: 'entrada', nome: () => 'Rendimento' },
  { re: /^(estorno|reembolso|cashback|devolucao)\s*(-|:)?\s*/, tipo: 'entrada', nome: (r, _t) => (r ? `Estorno ${r}` : 'Estorno') },
  { re: /^(deposito|dep\.?)\b\s*(-|:)?\s*/, tipo: 'entrada', nome: (r) => (r ? `Depósito ${r}` : 'Depósito') },
  { re: /^(salario|pagamento de salario|folha)/, tipo: 'entrada', nome: () => 'Salário' },
]

/** Tira o que é documento ou código de transação (CNPJ, CPF, mascarado, ids), para nada disso passar por nome ou loja. */
function semDocumentos(s: string) {
  return s
    .replace(/\b[a-z]?\d[\da-z]{9,}\b/gi, (m) => (/\d{4}/.test(m) ? ' ' : m)) // ids de transação (E1234567820231012…)
    .replace(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\b\d{14}\b/g, ' ') // CNPJ
    .replace(/\d{3}\.\d{3}\.\d{3}-\d{2}/g, ' ') // CPF
    .replace(/[*•x]{2,3}\.?\d{3}\.?\d{3}-?[*•x]{1,2}/gi, ' ') // CPF mascarado
    .replace(/\b\d{2}\.\d{3}\.\d{3}\b/g, ' ') // raiz de CNPJ (MEI: "51.365.272 Fulano")
}

/** Pedaços que nunca são nome: documentos, códigos, horários, datas, valores, agência/conta. */
function semRuido(s: string) {
  return semDocumentos(s)
    .replace(/\b(outra|mesma)\s+(if|institui[cç][aã]o|titularidade)\b|\bdoc\.\s*:\s*\S+|\b(pagamento|recebimento)\s+pix\b/gi, ' ') // Sicoob: "PIX EMITIDO OUTRA IF … DOC.: Pix"
    .replace(/["“”]+/g, ' ') // Inter: Pix enviado: "Cp :60746948-FULANO"
    .replace(/\bcp\s*:\s*\d*\s*-?/gi, ' ')
    .replace(/(^|\s)(ag([eê]ncia)?|conta|cc|c\/c|banco|inst(itui[cç][aã]o)?|id|doc|nsu|aut(oriza[cç][aã]o)?|c[oó]d(igo)?)\.?\s*:?\s*[\w-]*\d[\w-]*/gi, ' ')
    .replace(/\b[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}\b/gi, ' ')
    .replace(/\b\d{1,2}:\d{2}(:\d{2})?\b/g, ' ') // horário
    .replace(/(?<=[a-z])\d{1,2}\/\d{1,2}\b/gi, ' ') // data grudada no nome (Itaú: "JOSE A16/10")
    .replace(/\b\d{1,2}[/.-]\d{1,2}([/.-]\d{2,4})?\b/g, ' ') // data
    .replace(/[-+−]?\s*r\$\s*[-+−]?[\d.,]*/gi, ' ')
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

/** Byte de cada caractere que o Windows-1252 põe no lugar dos bytes 0x80–0x9F (para desfazer UTF-8 lido como Latin-1). */
const CP1252: Record<string, number> = {
  '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87, 'ˆ': 0x88, '‰': 0x89, 'Š': 0x8a, '‹': 0x8b, 'Œ': 0x8c,
  'Ž': 0x8e, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '˜': 0x98, '™': 0x99, 'š': 0x9a, '›': 0x9b,
  'œ': 0x9c, 'ž': 0x9e, 'Ÿ': 0x9f,
}
const MOJIBAKE = /[ÃÂ][\u0080-\u00bf€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]/

/**
 * Acentos quebrados do arquivo: UTF-8 lido como Latin-1 ("Ã§" onde era "ç", "Ã" + caractere invisível onde era "Á") é
 * desfeito; o que nunca deu para ler (�, caracteres de controle) sai do texto e `ilegivel` avisa que faltou uma letra.
 */
export function consertarTexto(s: string): { texto: string; ilegivel: boolean } {
  let t = s.normalize('NFC')
  if (MOJIBAKE.test(t)) {
    try {
      const bytes = Uint8Array.from(t, (c) => CP1252[c] ?? c.charCodeAt(0))
      if (![...t].some((c) => c.charCodeAt(0) > 0xff && !(c in CP1252))) {
        const certo = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
        if (!certo.includes('\ufffd')) t = certo
      }
    } catch { /* não era UTF-8 lido errado: fica como está */ }
  }
  const ilegivel = /[\ufffd\u0080-\u009f]/.test(t)
  return { texto: ilegivel ? t.replace(/[\ufffd\u0080-\u009f]/g, '') : t, ilegivel }
}

/** Palavras que mostram que o nome do outro lado do Pix é de empresa ("Uber do Brasil Tecnologia Ltda"), não de pessoa. */
const SINAL_DE_EMPRESA = /\b(ltda|eireli|epp|mei|me|ip|cia|s\.\s?a|s\/a|comercio|servicos|tecnologia|pagamentos?|brasil|restaurantes?|supermercados?|farmacias?|inc|llc|gmbh|prime|video|music|plus|pay|app|apps|food|eats|store|shop|play|cloud|marketplace|online|digital|delivery|telecom|celular|internet|streaming)\b/

/**
 * Loja do outro lado de um Pix ou transferência. "TIM MAIA" e "ANA SHELL" são pessoas, então a loja só vale quando o nome
 * todo é o da loja ("Uber", "iFood") ou traz cara de empresa ("... Ltda", "... Pagamentos"), ou quando é descritivo de
 * cartão/app ("MP*LOJA", "UBER *TRIP").
 */
function lojaDaContraparte(resto: string, semDoc: string): string | null {
  const nr = normal(resto)
  if (!nr) return null
  const descritivo = /[a-z0-9]\s*\*\s*[a-z]/i.test(semDoc)
  const alvo = descritivo ? normal(semDoc) : nr
  for (const [re, loja] of LOJAS) {
    const m = re.exec(alvo)
    if (!m) continue
    const letras = (x: string) => x.replace(/[^a-z0-9]/g, '')
    if (descritivo || letras(m[0]) === letras(nr) || SINAL_DE_EMPRESA.test(nr)) return loja
  }
  return null
}

function limparSemForma(bruta: string, tipoAtual?: Tipo): { descricao: string; tipo?: Tipo; revisar?: string } {
  const original = bruta.replace(/\s+/g, ' ').trim()
  const semDoc = semDocumentos(original)
  const limpo = semRuido(original)
  const nl = normal(limpo)
  // Pix e transferência: primeiro o nome de quem está do outro lado (a loja só vale se o nome todo for de loja);
  // nas outras linhas (compra, boleto…) a loja pode estar em qualquer lugar do texto
  const ehPessoa = TIPOS_DE_LINHA.find((t) => t.re.test(nl))?.pessoa
  if (!ehPessoa) {
    const n = normal(semDoc)
    for (const [re, loja] of LOJAS) if (re.test(n)) return { descricao: loja }
  }
  for (const t of TIPOS_DE_LINHA) {
    const m = nl.match(t.re)
    if (!m) continue
    const resto = capitalizar(nomeDosPedacos(limpo.slice(m[0].length)))
    const tipo = t.tipo ?? tipoAtual ?? 'saida'
    if (t.pessoa) {
      const loja = lojaDaContraparte(resto, semDoc)
      if (loja) return { descricao: loja, tipo: t.tipo }
    }
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

/**
 * Descrição limpa de um lançamento do extrato, o tipo que ela revela ("Pix recebido" é entrada) e a forma de pagamento
 * (Pix, transferência, boleto, débito): o nome fica só com quem recebeu ou pagou. `revisar` diz quando sobrou pouco do
 * nome (só números, cortado ou com letra que não deu para ler).
 */
export function limparDescricao(bruta: string, tipoAtual?: Tipo): { descricao: string; tipo?: Tipo; revisar?: string; forma?: FormaGravada | null } {
  const { texto: comParcela, ilegivel } = consertarTexto(bruta)
  // "LOJA - Parcela 2/10", "LOJA PARC 02/10": a parcela não é parte do nome (e o "2/10" não é data)
  const texto = comParcela.replace(/\s*[-–(]?\s*\b(parcela|parc\.?|pcl\.?)\s*\d{1,2}\s*(\/|de)\s*\d{1,2}\)?/gi, ' ')
  const r = limparSemForma(texto, tipoAtual)
  const forma = formaPelaDescricao(texto, r.tipo ?? tipoAtual ?? 'saida')
  return { ...r, forma, revisar: r.revisar ?? (ilegivel ? 'tinha letra que não deu para ler: confira o nome' : undefined) }
}

// ---------- datas e valores ----------

/** Meses abreviados em português, inglês e espanhol ("out", "oct", "dic"…). */
const MESES_NOMES: Record<string, number> = {
  jan: 1, ene: 1, fev: 2, feb: 2, mar: 3, abr: 4, apr: 4, mai: 5, may: 5, jun: 6, jul: 7,
  ago: 8, aug: 8, set: 9, sep: 9, out: 10, oct: 10, nov: 11, dez: 12, dec: 12, dic: 12,
}
const MES = Object.keys(MESES_NOMES).join('|')
/** Nomes inteiros: "2 dicas" e "3 energia" não são datas, "2 dic" e "3 enero" são. */
const MESES_INTEIROS = new Set(('janeiro fevereiro marco abril maio junho julho agosto setembro outubro novembro dezembro ' +
  'january february march april may june july august september sept october november december ' +
  'enero febrero marzo mayo junio julio septiembre setiembre octubre noviembre diciembre').split(' '))
const ehMes = (palavra: string) => palavra.replace(/\.$/, '').length === 3 || MESES_INTEIROS.has(palavra.replace(/\.$/, ''))
const dois = (n: number) => String(n).padStart(2, '0')
/** Que dia é hoje (os testes trocam, para não dependerem do dia em que rodam). */
export const relogio = { hoje: () => new Date() }
/** Dia que existe no calendário: 31/02 e 29/02 de ano comum não valem (o banco recusa a data e derruba o lote inteiro). */
const valida = (a: number, m: number, d: number) => m >= 1 && m <= 12 && d >= 1 && a >= 2000 && a <= 2100 && d <= new Date(Date.UTC(a, m, 0)).getUTCDate()

/** O que vem logo antes de "2/3" quando é a parcela ("PARC 2/3", "Parcela 02/10", "3x 1/3"). */
const PARCELA_ANTES = /(\bparc(ela(s|do|da|mento)?)?\.?|\bpcl\.?|\bprc\.?|\b\d{1,2}\s?x)\s*$/

/**
 * Acha uma data no texto (vários formatos). `anoPadrao` para "12/10" e "12 out". Devolve a data, onde ela estava e, nas
 * que não trazem o ano, `semAno` (o ano é um palpite: ver `ajustarAno`).
 */
export function acharData(s: string, anoPadrao: number, mesPrimeiro = false): { data: string; trecho: string; semAno?: boolean } | null {
  const t = normal(s)
  let m = t.match(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/)
  if (m && valida(+m[1], +m[2], +m[3])) return { data: `${m[1]}-${dois(+m[2])}-${dois(+m[3])}`, trecho: m[0] }
  m = t.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/)
  if (m) {
    const a = m[3].length === 2 ? 2000 + +m[3] : +m[3]
    if (mesPrimeiro && valida(a, +m[1], +m[2])) return { data: `${a}-${dois(+m[1])}-${dois(+m[2])}`, trecho: m[0] }
    if (valida(a, +m[2], +m[1])) return { data: `${a}-${dois(+m[2])}-${dois(+m[1])}`, trecho: m[0] }
    // 10/15/2025: o segundo número não cabe como mês, então é mês/dia (jeito americano)
    if (+m[2] > 12 && valida(a, +m[1], +m[2])) return { data: `${a}-${dois(+m[1])}-${dois(+m[2])}`, trecho: m[0] }
  }
  // "12 out", "12 de outubro de 2025", "12-oct-2025"
  const porExtenso = t.match(new RegExp(`\\b(\\d{1,2})\\s*(?:de\\s+|-)?((${MES})[a-zç]*)\\.?(?:\\s*(?:de\\s+|-|,\\s*)?(\\d{4}))?\\b`))
  if (porExtenso && ehMes(porExtenso[2])) {
    const [trecho, dia, , mes, ano] = porExtenso
    const a = ano ? +ano : anoPadrao
    if (valida(a, MESES_NOMES[mes], +dia)) return { data: `${a}-${dois(MESES_NOMES[mes])}-${dois(+dia)}`, trecho, ...(ano ? {} : { semAno: true }) }
  }
  // "Oct 15, 2025" (jeito americano)
  const americano = t.match(new RegExp(`\\b((${MES})[a-z]*)\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b`))
  if (americano && ehMes(americano[1])) {
    const [trecho, , mes, dia, ano] = americano
    if (valida(+ano, MESES_NOMES[mes], +dia)) return { data: `${ano}-${dois(MESES_NOMES[mes])}-${dois(+dia)}`, trecho }
  }
  // "12/10" solto; "parc 2/3", "parcela 02/10" e "3x 1/3" são a parcela, não um dia
  for (const c of t.matchAll(/(?<=^|\s)(\d{1,2})\/(\d{1,2})(?=\s|$)/g)) {
    if (PARCELA_ANTES.test(t.slice(0, c.index))) continue
    if (valida(anoPadrao, +c[2], +c[1])) return { data: `${anoPadrao}-${dois(+c[2])}-${dois(+c[1])}`, trecho: c[0], semAno: true }
  }
  return null
}

/**
 * O extrato escreve mês/dia (jeito americano)? Vale o que os números provam ("10/15/2026" só cabe como mês/dia,
 * "15/10/2026" só como dia/mês); sem prova, o cabeçalho em inglês com centavos depois de ponto ("4.50").
 */
function mesVemPrimeiro(textos: string[], nomes: string[] = []): boolean {
  let diaMes = 0, mesDia = 0
  for (const t of textos) {
    for (const m of t.matchAll(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/g)) {
      if (+m[1] > 12 && +m[2] <= 12) diaMes++
      else if (+m[2] > 12 && +m[1] <= 12) mesDia++
    }
  }
  if (diaMes || mesDia) return mesDia > diaMes
  const ingles = nomes.some((n) => /^(date|description|amount|balance|debit|credit|transaction date|posting date|details)$/.test(nomeDeColuna(n)))
  return ingles && textos.some((t) => /\d\.\d{2}(?!\d)/.test(t)) && !textos.some((t) => /\d,\d{2}(?!\d)/.test(t))
}

/**
 * As datas escritas com o ano em qualquer lugar do arquivo (período do extrato, vencimento da fatura, dia da emissão, os
 * próprios lançamentos): é por elas que as datas sem ano ("28/12") descobrem de que ano são.
 */
export function datasComAno(textos: string[]): string[] {
  const achadas: string[] = []
  const poe = (a: number, m: number, d: number) => { if (valida(a, m, d)) achadas.push(`${a}-${dois(m)}-${dois(d)}`) }
  const extenso = new RegExp(`\\b(\\d{1,2})\\s*(?:de\\s+|-|/)?((${MES})[a-zç]*)\\.?\\s*(?:de\\s+|-|/|,\\s*)?(\\d{4})\\b`, 'g')
  const mesEAno = new RegExp(`(?<!\\d\\s?(?:de\\s)?)\\b((${MES})[a-zç]*)\\.?\\s*(?:de\\s+|/|-)?\\s*(20\\d{2})\\b`, 'g')
  for (const bruto of textos) {
    const t = normal(bruto)
    if (!/\d{4}|\d\/\d{2}\b/.test(t)) continue
    for (const m of t.matchAll(/(?<![\d/.-])(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?![\d/.-])/g)) poe(+m[1], +m[2], +m[3])
    for (const m of t.matchAll(/(?<![\d/.-])(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})(?![\d/.-])/g)) {
      const a = m[3].length === 2 ? 2000 + +m[3] : +m[3]
      if (+m[2] > 12) poe(a, +m[1], +m[2]); else poe(a, +m[2], +m[1])
    }
    for (const m of t.matchAll(extenso)) if (ehMes(m[2])) poe(+m[4], MESES_NOMES[m[3]], +m[1])
    for (const m of t.matchAll(mesEAno)) if (ehMes(m[1])) poe(+m[3], MESES_NOMES[m[2]], 15)
  }
  return achadas
}

const DIA = 86400000
const emDias = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / DIA

/**
 * O ano das datas que vieram sem ele ("28/12", "03 JAN"), que nascem com o ano aberto no app:
 * 1. Num extrato que atravessa a virada, os meses dão a volta (dez → jan, ou jan → dez nos que começam pelo mais novo):
 *    o que vem depois da volta é do ano seguinte.
 * 2. O arquivo quase sempre escreve o ano em algum lugar (período, vencimento, emissão): as datas sem ano vão para o ano
 *    que as deixa dentro (ou mais perto) dessas datas. A fatura que vence em 10/01/2026 tem as compras de dezembro de 2025.
 * 3. Sem nenhum ano no arquivo, lançamento não cai no futuro: extrato de dezembro importado em janeiro é do ano passado.
 * `semAno` diz quais linhas tiveram o ano adivinhado; as que trazem o ano escrito ficam como estão.
 */
function ajustarAno(linhas: LinhaExtrato[], semAno: boolean[], referencias: string[]) {
  const ix = linhas.map((_, i) => i).filter((i) => semAno[i])
  if (!ix.length) return
  const poeAno = (i: number, mais: number) => {
    const l = linhas[i]
    const a = Number(l.data.slice(0, 4)) + mais, m = Number(l.data.slice(5, 7)), d = Number(l.data.slice(8, 10))
    // 29/02 num ano que não é bissexto: fica 28/02
    l.data = `${a}-${dois(m)}-${dois(valida(a, m, d) ? d : d - 1)}`
  }
  const mes = (i: number) => Number(linhas[i].data.slice(5, 7))
  const saltos = ix.slice(1).map((i, k) => mes(i) - mes(ix[k]))
  const adiante = saltos.some((d) => d <= -7) // dez → jan: o mais antigo vem primeiro
  const atras = saltos.some((d) => d >= 7) // jan → dez: o mais novo vem primeiro
  if (adiante !== atras) {
    let mais = 0
    if (adiante) saltos.forEach((d, k) => { if (d <= -7) mais++; if (mais) poeAno(ix[k + 1], mais) })
    else for (let k = saltos.length - 1; k >= 0; k--) { if (saltos[k] >= 7) mais++; if (mais) poeAno(ix[k], mais) }
  }
  const hoje = relogio.hoje()
  const limite = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()) / DIA
  const refs = referencias.map(emDias).filter((d) => d <= limite + 400)
  const dias = ix.map((i) => emDias(linhas[i].data))
  let melhor = 0
  if (refs.length) {
    const de = Math.min(...refs), ate = Math.max(...refs)
    const longe = (k: number) => dias.reduce((s, d) => { const x = d + k * 365.25; return s + (x < de ? de - x : x > ate ? x - ate : 0) }, 0)
    // empate (todas dentro do período): fica o ano aberto e, depois, o mais novo
    let nota = longe(0)
    for (const k of [1, -1, -2, -3, -4, -5]) { const n = longe(k); if (n < nota - 0.5) { nota = n; melhor = k } }
  } else {
    while (melhor > -5 && Math.max(...dias) + melhor * 365.25 > limite + 10) melhor--
  }
  if (melhor) for (const i of ix) poeAno(i, melhor)
}

/**
 * Valores em reais no texto, na ordem: "- R$ 1.234,56", "R$ -1.234,56", "1234.56", "(50,00)", "30,00 D", "30,00 CR", "100,00D", "42,79-".
 * O "-" só é sinal quando está colado no número (ou antes do R$): o " - " com espaço dos dois lados é separador
 * ("15/10 PIX RECEBIDO MARIA - 1.200,00" é entrada).
 */
export function acharValores(s: string): { valor: number; sinal: -1 | 0 | 1; trecho: string; pos: number }[] {
  const lista: { valor: number; sinal: -1 | 0 | 1; trecho: string; pos: number }[] = []
  for (const m of s.matchAll(RE_VALOR)) {
    const g = m.groups!
    const br = /,\d{2}$/.test(g.num)
    const valor = Number(br ? g.num.replace(/\./g, '').replace(',', '.') : g.num.replace(/,/g, ''))
    if (!Number.isFinite(valor) || valor === 0) continue
    const fim = (g.fim ?? '').trim().toLowerCase()
    const antes = `${g.s1 ?? ''}${g.s2 ?? ''}`
    const sinal: -1 | 0 | 1 = /[-−]/.test(antes) || (g.abre && g.fecha) || fim === '-' || fim === 'd' || fim === 'db' || fim === 'dr' ? -1 : antes.includes('+') || fim === '+' || fim === 'c' || fim === 'cr' ? 1 : 0
    lista.push({ valor, sinal, trecho: m[0], pos: m.index })
  }
  return lista
}
// o número tem que estar inteiro: "51.365.272" (raiz de CNPJ) não pode virar R$ 51,36
const RE_VALOR = /(?<s1>[-+−](?:\s*(?=r\$)|(?!\s)))?(?:r\$\s*(?<s2>[-+−]\s?)?)?(?<abre>\(?)(?<![\d.,])(?<num>\d{1,3}(?:\.\d{3})+,\d{2}|\d+,\d{2}|\d{1,3}(?:,\d{3})+\.\d{2}|\d+\.\d{2})(?![\d.,]*\d)(?<fecha>\)?)(?<fim>[-+](?!\s*\d)|\s*(?:cr|db|dr|d|c)(?![\w/.&'-]))?/gi

// "Rem:" (remetente) e "Des:" (destinatário) são como o Bradesco diz de quem veio e para quem foi o Pix
const PISTA_ENTRADA = /recebid|recebimento|credito|deposito|estorno|rendimento|salario|reembolso|cashback|devolucao|entrada|\brem:/
const PISTA_SAIDA = /enviad|emitid|pagamento|pgto|compra|debito|saque|tarifa|boleto|fatura|envio|saida|transferencia para|\bdes:/
const IGNORAR = /^(data\b|lancamentos?\b|periodo|extrato|movimentac)/
/** O que vem depois de "Saldo"/"Total" nas linhas de resumo ("Saldo do dia", "Total da fatura"). */
const RESUMO_DEPOIS = /^((do|da|de|dos|das)\s+(dia|mes|periodo|fatura|conta|extrato|cartao|compras|pagamentos|lancamentos|entradas|saidas|creditos|debitos|despesas|receitas|limite|investimentos|aplicacoes)|anterior|final|inicial|atual|disponivel|bloqueado|parcial|geral|liquido|bruto|em\s+(conta|c\/?c)|apos|a\s+(pagar|receber)|pago|devedor|credor|fatura|compras|entradas|saidas|creditos|debitos|despesas|receitas|gastos?|lancamentos|pagamentos|periodo|mes|dia|conta|limite|cartao|c\/c|cc|invest\w*|aplica\w*|poupanca)\b/

/**
 * Linha de resumo do extrato, que não é lançamento: "Saldo", "Saldo do dia", "Total da fatura", cabeçalho, período.
 * "Saldo"/"Total" sozinhos ou seguidos de número ou de uma palavra de resumo; "Saldo Farma", "Total Express" e
 * "TotalPass" são lojas e seguem como lançamento.
 */
function ehResumo(texto: string) {
  // "S A L D O" (Banco do Brasil) é "saldo"
  const n = /^(\S\s)+\S$/.test(texto.trim()) ? texto.replace(/\s/g, '') : texto
  if (/^limite (total|disponivel|de credito|utilizado|da conta)\b|^(opening|closing|beginning|ending|previous|available|current|starting) balance\b|^balance (brought|carried) forward\b|^saldo (inicial|final|anterior)\b/.test(n.trim())) return true
  if (/^(total (de |das |dos )?)?(entradas|saidas|creditos|debitos|rendimentos?( liquidos?)?)\s*:?\s*[-+−]?\s*(r\$|\d)/.test(n.trim())) return true
  const m = /^(saldo|total)\b\s*(.*)$/.exec(n.trim())
  if (!m) return IGNORAR.test(n.trim())
  return !/^[a-z]/.test(m[2]) || /^r\$/.test(m[2]) || RESUMO_DEPOIS.test(m[2])
}

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
    data, valor: Math.round(Math.abs(valor) * 100) / 100, tipo, descricao: limpo.descricao, original: consertarTexto(desc).texto.trim(), forma: limpo.forma,
    revisar: limpo.revisar ?? (adivinhado && !limpo.tipo ? 'confira se entrou ou saiu' : undefined),
  }
}

// ---------- texto corrido (PDF, Word, TXT) ----------

/** Rodapé e cabeçalho que o PDF repete em toda página (e que não são parte do nome de nenhum lançamento). */
/**
 * Cabeçalho de página com a data em que o extrato foi gerado ("Banco Bradesco S/A … 08/11/2026", "Emitido em 08/11"). Essa
 * data não é de lançamento: se virasse o dia dos próximos, o primeiro lançamento de cada página ia para o dia da emissão.
 */
const CABECALHO_DE_PAGINA = /^banco\s+[a-z ]{2,30}?\s+s\.?\s*\/?\s*a\b|^(emitido|emissao|gerado|impresso|consultado|data (de |da )?(emissao|impressao|consulta))\b/

/** Saldo da conta numa linha de resumo ("Saldo anterior", "Saldo do dia"): serve para descobrir se cada lançamento entrou ou saiu. */
const SALDO_DA_CONTA = /^saldo( (anterior|inicial|final|do dia|atual|disponivel|em conta( corrente)?|em c\/?c))?$|^(opening|closing|beginning|ending|previous|starting) balance$|^balance (brought|carried) forward$/

/** "01/10/2026 a 31/10/2026", "DE 03 DEZ A 02 JAN", "1 de outubro de 2026 até 31 de outubro de 2026": o período do extrato, não um lançamento. */
const UMA_DATA = `(?:\\d{1,2}[/.-]\\d{1,2}(?:[/.-]\\d{2,4})?|\\d{1,2}\\s*(?:de\\s+)?(?:${MES})[a-z]*\\.?(?:\\s*(?:de\\s+)?\\d{4})?)`
const PERIODO = new RegExp(`(?<![\\d/.-])${UMA_DATA}\\s*(?:\\ba\\b|\\bate\\b|\\bto\\b|\\be\\b|[-–])\\s*${UMA_DATA}(?![\\d/.-])`)
/** Fatura de cartão: a compra vem sem sinal (é gasto) e o que vem com menos é pagamento ou estorno (entrou no cartão). */
const pareceFatura = (linhas: string[]) => { const topo = normal(linhas.slice(0, 40).join(' ')); return /\bfatura\b/.test(topo) && /\bvencimento\b/.test(topo) }

const RESUMO_DA_FATURA = /\b(total (desta|da|dessa|a|de) (fatura|pagar)|valor (total )?(desta|da|dessa) fatura|pagamento minimo|melhor (dia|data) (de|para) compra|limite (total|disponivel|de credito|utilizado)|(data (de|do) )?vencimento\s*:?\s*\d)/

const RUIDO_DE_PAGINA = /\bpagina\s+\d+\s*(de|\/)\s*\d+|\bpag\.?\s*\d+\s*(de|\/)\s*\d+|\bouvidoria\b|\bsac\b|\b0800\b|\bcnpj\b|\bwww\.|https?:|\S+@\S+\.\w+|\bfale conosco|\bcentral de (atendimento|relacionamento)|\bdeficiente (auditivo|de fala)|\btel(efone)?s?\.?:?\s*\(?\d|\(\d{2}\)\s*\d{4,5}-?\d{4}/

/**
 * Linhas de texto → lançamentos. Uma linha com data e valor é um lançamento; linha só com data vira o dia dos
 * próximos (extratos que agrupam por dia); linha sem data nem valor logo depois de um lançamento completa a descrição
 * dele (nome quebrado em duas linhas).
 */
export function deTexto(linhas: string[], anoPadrao: number, opcoes: { referencias?: string[] } = {}): LinhaExtrato[] {
  const mesPrimeiro = mesVemPrimeiro(linhas)
  const ehFatura = pareceFatura(linhas)
  /** "Total de entradas" / "Total de saídas" (Nubank): as linhas de baixo, até o próximo total ou dia, são desse tipo. */
  let secao: 1 | -1 | null = null
  const saida: LinhaExtrato[] = []
  /** Para cada linha de `saida`: a data veio sem ano (ver `ajustarAno`). */
  const semAno: boolean[] = []
  let diaAtual: string | null = null
  let diaSemAno = false
  /** O dia atual veio de uma data que abre a linha (título do dia ou primeira coluna). */
  let diaNoComeco = false
  let ultimo: { l: LinhaExtrato; bruta: string; sinal: -1 | 0 | 1 } | null = null
  // linha com data e descrição mas sem valor: o valor vem na linha seguinte ("15/10 PIX RECEBIDO" + "MARIA … R$ 1.200,00")
  let pendente: { data: string; texto: string; semAno: boolean } | null = null
  /** Saldos lidos, com a posição em `saida`: `antes` = lançamentos lidos até ele (extrato do mais antigo para o mais novo), `depois` = no do mais novo para o mais antigo. */
  const saldos: { antes: number; depois: number; valor: number }[] = []
  /** O texto de cada lançamento e se o sinal veio escrito, para refazer o tipo pelo saldo no fim. */
  const fontes: { bruta: string; sinal: -1 | 0 | 1 }[] = []
  for (const bruta of linhas) {
    const linha = bruta.replace(/\s+/g, ' ').trim()
    if (!linha) continue
    const n = normal(linha)
    let d = acharData(linha, anoPadrao, mesPrimeiro)
    const valores = acharValores(linha)
    // o período do extrato ("01/10/2026 a 31/10/2026", sozinho ou com os totais ao lado) não é lançamento
    const periodo = PERIODO.exec(n)
    if (periodo && (!d || n.indexOf(d.trecho) >= periodo.index)) { ultimo = null; pendente = null; continue }
    // "Compra Loja 3/10  30,00" debaixo do dia: quando os dias do extrato abrem a linha, um "3/10" no meio dela é o dia da
    // compra ou a parcela, não a data do lançamento
    if (d?.semAno && diaAtual && diaNoComeco && valores.length && /^\d{1,2}\/\d{1,2}$/.test(d.trecho) && !n.startsWith(d.trecho)) d = null
    // rodapé e cabeçalho de página ("Página 1 de 3", "Ouvidoria 0800…", CNPJ, site): nem lançamento, nem continuação de nome
    if (!valores.length && RUIDO_DE_PAGINA.test(n)) continue
    // a descrição sem a data e os valores: é ela que diz se a linha é um resumo ("Saldo do dia") ou uma loja ("Saldo Farma")
    const semDataEValor = [d?.trecho, ...valores.map((v) => v.trecho)].reduce<string>((x, t) => (t ? x.replace(t.toLowerCase(), ' ') : x), n).replace(/\s+/g, ' ').trim()
    if (!valores.length && CABECALHO_DE_PAGINA.test(semDataEValor)) { ultimo = null; continue }
    // "Vencimento: 10/11/2026  Total desta fatura 311,69", "Pagamento mínimo R$ 46,75": resumo da fatura
    if (RESUMO_DA_FATURA.test(n)) { ultimo = null; pendente = null; continue }
    if (ehResumo(n) || ehResumo(semDataEValor) || /\bsaldo\b/.test(n) && !/^(saldo|total)\b/.test(semDataEValor) && valores.length <= 1 && !/pix|transf|compra|pagamento/.test(n)) {
      const resumo = semDataEValor.replace(/[^a-z/ ]/g, ' ').replace(/\s+/g, ' ').trim()
      if (valores.length === 1 && SALDO_DA_CONTA.test(resumo)) saldos.push({ antes: saida.length, depois: saida.length, valor: comSinal(valores[0]) })
      // "01 OUT 2026  Total de entradas" e "1 de Outubro  Saldo do dia": o dia dos lançamentos de baixo
      // (só quando a data abre a linha: "Data de vencimento: 10 NOV" não é dia de lançamento)
      if (d && n.startsWith(d.trecho)) { diaAtual = d.data; diaSemAno = Boolean(d.semAno); diaNoComeco = true; secao = null }
      if (/^(total (de |das |dos )?)?(entradas|creditos|recebimentos)$/.test(resumo)) secao = 1
      else if (/^(total (de |das |dos )?)?(saidas|debitos|pagamentos|gastos|despesas)$/.test(resumo)) secao = -1
      ultimo = null
      pendente = null
      continue
    }
    // "REM: FULANO 01/10" (Bradesco): a data no fim de uma linha sem valor é parte do nome do lançamento de cima, não um dia novo
    const dataNoFim = Boolean(d && !valores.length && ultimo && !n.startsWith(d.trecho) && n.endsWith(d.trecho) && /^\d{1,2}\/\d{1,2}(\/\d{2,4})?$/.test(d.trecho))
    if (d && !valores.length && !dataNoFim) {
      const resto = semRuido(linha.replace(d.trecho, ''))
      if (resto.replace(/[^A-Za-zÀ-ÿ]/g, '').length < 4) { diaAtual = d.data; diaSemAno = Boolean(d.semAno); diaNoComeco = n.startsWith(d.trecho); ultimo = null; pendente = null; secao = null; continue }
      pendente = { data: d.data, texto: linha.replace(d.trecho, ' '), semAno: Boolean(d.semAno) }
      ultimo = null
      continue
    }
    const data = d?.data ?? pendente?.data ?? diaAtual
    if (valores.length && data) {
      // com dois valores na linha, o último costuma ser o saldo: vale o primeiro
      const v = valores[0]
      let desc = (!d && pendente ? `${pendente.texto} ` : '') + linha.replace(v.trecho, ' ')
      const adivinhada = d ? Boolean(d.semAno) : pendente ? pendente.semAno : diaSemAno
      pendente = null
      // os próximos lançamentos sem data (extrato que só escreve a data no primeiro do dia) são deste dia
      if (d && d.data !== diaAtual) secao = null
      if (d) { diaAtual = d.data; diaSemAno = Boolean(d.semAno); diaNoComeco = n.startsWith(d.trecho) }
      if (d) desc = desc.replace(new RegExp(d.trecho.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&'), 'i'), ' ')
      for (const x of valores.slice(1)) desc = desc.replace(x.trecho, ' ')
      // fatura de cartão em PDF: o pagamento da fatura vem com sinal de menos, mas é dinheiro que entrou no cartão
      const pagouFatura = v.sinal === -1 && (/\bpagamento recebido\b/.test(normal(desc)) || ehFatura && /\bpagamento\b/.test(normal(desc)))
      const sinal: -1 | 0 | 1 = pagouFatura || (ehFatura && v.sinal === -1) ? 1 : ehFatura && !v.sinal ? -1 : v.sinal || secao || 0
      const l = montar(data, desc, v.valor, sinal)
      if (pagouFatura) Object.assign(l, { pagamentoDaFatura: true, revisar: l.revisar ?? 'pagamento da fatura: já está no extrato da conta' })
      // com dois valores, o último é o saldo depois deste lançamento
      if (valores.length >= 2) saldos.push({ antes: saida.length + 1, depois: saida.length, valor: comSinal(valores[valores.length - 1]) })
      saida.push(l)
      semAno.push(adivinhada)
      fontes.push({ bruta: desc, sinal })
      ultimo = { l, bruta: desc, sinal }
      continue
    }
    // continuação do nome do lançamento anterior
    if (ultimo && (!d || dataNoFim) && !valores.length && linha.length < 60) {
      const junto: string = `${ultimo.bruta} ${d && dataNoFim ? linha.replace(new RegExp(d.trecho.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&'), 'i'), ' ').trim() : linha}`
      // refaz como o lançamento nasceu (mesmo sinal), para o tipo, a forma e o aviso "confira se entrou ou saiu" acompanharem o nome inteiro
      const novo = montar(ultimo.l.data, junto, ultimo.l.valor, ultimo.sinal)
      Object.assign(ultimo.l, { descricao: novo.descricao, original: novo.original, revisar: ultimo.l.pagamentoDaFatura ? ultimo.l.revisar : novo.revisar, tipo: novo.tipo, forma: novo.forma })
      ultimo = { l: ultimo.l, bruta: junto, sinal: ultimo.sinal }
      fontes[saida.indexOf(ultimo.l)].bruta = junto
    }
  }
  tipoPeloSaldo(saida, fontes, saldos)
  ajustarAno(saida, semAno, opcoes.referencias ?? datasComAno(linhas))
  return saida
}

const comSinal = (v: { valor: number; sinal: -1 | 0 | 1 }) => (v.sinal < 0 ? -v.valor : v.valor)

/**
 * Extrato em PDF com colunas Crédito e Débito (Bradesco e outros): no texto as duas colunas viram só um número, sem dizer
 * se entrou ou saiu. O saldo diz: entre dois saldos, os lançamentos somam a diferença. Para cada trecho entre saldos,
 * procura o jeito (entrou/saiu) de cada lançamento sem sinal que fecha a conta; só usa quando há um jeito só. Testa o
 * extrato lido do mais antigo para o mais novo e ao contrário, e fica com o sentido que explica mais lançamentos.
 */
function tipoPeloSaldo(saida: LinhaExtrato[], fontes: { bruta: string; sinal: -1 | 0 | 1 }[], saldos: { antes: number; depois: number; valor: number }[]) {
  if (saldos.length < 2) return
  const cent = (v: number) => Math.round(v * 100)
  const resolver = (pos: 'antes' | 'depois', inverte: boolean) => {
    const achados = new Map<number, 1 | -1>()
    const marcos = [...saldos].sort((a, b) => a[pos] - b[pos])
    for (let k = 1; k < marcos.length; k++) {
      const de = marcos[k - 1][pos], ate = marcos[k][pos]
      if (ate <= de) continue
      let falta = cent(marcos[k].valor - marcos[k - 1].valor) * (inverte ? -1 : 1)
      const livres: number[] = []
      for (let i = de; i < ate; i++) {
        if (fontes[i].sinal) falta -= fontes[i].sinal * cent(saida[i].valor)
        else livres.push(i)
      }
      if (!livres.length || livres.length > 14) continue
      let achado = -1, quantos = 0
      for (let m = 0; m < 1 << livres.length && quantos < 2; m++) {
        let soma = 0
        livres.forEach((i, b) => { soma += (m >> b & 1 ? 1 : -1) * cent(saida[i].valor) })
        if (soma === falta) { achado = m; quantos++ }
      }
      if (quantos === 1) livres.forEach((i, b) => achados.set(i, achado >> b & 1 ? 1 : -1))
    }
    return achados
  }
  const doMaisAntigo = resolver('antes', false)
  const doMaisNovo = resolver('depois', true)
  const melhor = doMaisNovo.size > doMaisAntigo.size ? doMaisNovo : doMaisAntigo
  for (const [i, sinal] of melhor) {
    const l = saida[i]
    const novo = montar(l.data, fontes[i].bruta, l.valor, sinal)
    Object.assign(l, { tipo: novo.tipo, descricao: novo.descricao, forma: novo.forma, revisar: l.pagamentoDaFatura ? l.revisar : novo.revisar })
  }
}

// ---------- tabelas (CSV, Excel, tabelas do Word, PDF lido pelas colunas) ----------

/** Nomes de coluna, do jeito que os bancos escrevem (português, inglês e espanhol). */
const COLUNAS = {
  data: /^(data|date|dt|fecha|dia)\b|^(transaction|posting|booking|value|release) date/,
  desc: /descri|historico|lancamento|estabelecimento|^title$|^titulo$|memo|detalhe|favorecido|nome|beneficiario|concepto|^details?$|payee|merchant|narrativ/,
  valor: /^(valor|amount|quantia|montante|importe|monto|value|r\$)\b|\bamount\b/,
  credito: /^(credito|creditos|entradas?|valor (de |do )?credito|credits?|deposits?|money in|paid in|abonos?|ingresos?|haber)\b|\bcredits?$/,
  debito: /^(debito|debitos|saidas?|valor (de |do )?debito|debits?|withdrawals?|money out|paid out|cargos?|egresos?|debe)\b|\bdebits?$/,
  tipo: /^(tipo|natureza|d\/c|c\/d|e\/s|dc|cd|operacao|movimentacao|entrada\/saida|credito\/debito|debito\/credito|type|dr\/cr|cr\/dr|sinal)( (de |do |da )?(transacao|lancamento|movimentacao|movimento|operacao))?$/,
  saldo: /^(saldo|balance|running balance|partial balance)\b|\bbalance$/,
  doc: /^(dcto|docto|documento|doc|n[o°º]?\s*(do\s+)?doc(umento)?|nr\.?\s*doc(umento)?|num(ero)?(\s+do)?\s*doc(umento)?|referencia|ref|reference( id)?|id|identificador|nsu|autenticacao|lote|ag\.?\s*origem|agencia)\.?$/,
}
type Chave = keyof typeof COLUNAS
type Colunas = Partial<Record<Chave, number>>
/** Cada nome de coluna vale para uma coisa só: "Valor crédito" é crédito (não valor), "Débito/Crédito" é o tipo. */
const ORDEM_DAS_COLUNAS: Chave[] = ['tipo', 'credito', 'debito', 'saldo', 'data', 'valor', 'doc', 'desc']
const nomeDeColuna = (c: string) => normal(c).replace(/_/g, ' ').replace(/\s+/g, ' ').trim()
function chaveDaColuna(c: string): Chave | undefined {
  const n = nomeDeColuna(c)
  if (!n || n.length > 40 || /\d{2}/.test(n)) return undefined
  return ORDEM_DAS_COLUNAS.find((k) => COLUNAS[k].test(n))
}

/** As colunas de uma linha de cabeçalho; só vale se tiver a data e algum valor (valor, crédito ou débito). */
function colunasDoCabecalho(nomes: string[]): Colunas | null {
  const col: Colunas = {}
  nomes.forEach((c, j) => { const k = chaveDaColuna(c); if (k && col[k] === undefined) col[k] = j })
  // a descrição: a coluna de nome mais forte ("Descrição" antes de "Histórico" antes de "Nome")
  const prioridade = [/descri/, /estabelecimento|^title$|^titulo$/, /historico/, /lancamento/, /memo|detalhe|concepto/, /favorecido|beneficiario|nome|payee|merchant/]
  for (const re of prioridade) {
    const j = nomes.findIndex((c) => chaveDaColuna(c) === 'desc' && re.test(nomeDeColuna(c)))
    if (j >= 0) { col.desc = j; break }
  }
  return col.data !== undefined && (col.valor !== undefined || col.credito !== undefined || col.debito !== undefined) ? col : null
}

/**
 * Valor de uma célula: número cru do Excel ("-80.5", "250"), milhar sem centavos ("-1.200") ou texto com R$ e vírgula.
 * Sem sinal escrito, o sinal fica 0 (não dá para saber se entrou ou saiu só pelo número): quem decide é a coluna.
 */
function valorDaCelula(c: string): { valor: number; sinal: -1 | 0 | 1 } | null {
  const t = c.trim().replace(/^([-+−])\s+/, '$1')
  const sinalEscrito = (n: number): -1 | 0 | 1 => (n < 0 ? -1 : t.startsWith('+') ? 1 : 0)
  if (/^[-+−]?\d{1,3}(\.\d{3})+$/.test(t)) {
    const n = Number(t.replace('−', '-').replace(/\./g, ''))
    return n ? { valor: Math.abs(n), sinal: sinalEscrito(n) } : null
  }
  if (/^[-+−]?\d+(\.\d+)?$/.test(t)) {
    const n = Number(t.replace('−', '-'))
    return n ? { valor: Math.abs(n), sinal: sinalEscrito(n) } : null
  }
  return acharValores(t)[0] ?? null
}

/** Coluna "Tipo" ("C", "Débito", "Saída", "Pix recebido", "Compra no débito"…) → entrada ou saída. */
function tipoDaCelula(c: string): Tipo | undefined {
  const t = normal(c).trim()
  if (!t) return undefined
  if (/^(c|cr|cred|e|\+)$/.test(t)) return 'entrada'
  if (/^(d|db|dr|deb|s|-)$/.test(t)) return 'saida'
  if (/recebid|^(credito|credit|entrada|receita|deposito|deposit|rendimento|estorno|reembolso)/.test(t)) return 'entrada'
  if (/enviad|^(debito|debit|saida|despesa|pagamento|pgto|compra|saque|tarifa|boleto)/.test(t)) return 'saida'
  return tipoPorPista(t) ?? undefined
}

/** Célula que é número de valor (não data, não código comprido como "81234567890", não texto). */
function ehValorNaTabela(c: string, anoPadrao: number) {
  const t = c.trim()
  if (!t || /^\d{7,}$/.test(t) || acharData(t, anoPadrao)) return false
  if (/[a-z]{2}/i.test(t.replace(/\b(r\$|brl|usd|eur|cr|db|dr)\b/gi, ''))) return false
  return Boolean(valorDaCelula(t))
}
const valorComSinal = (c: string) => { const v = valorDaCelula(c); return v ? (v.sinal < 0 ? -v.valor : v.valor) : null }

/**
 * Tabela sem cabeçalho que dê para reconhecer: as colunas pelo conteúdo. A data é a coluna com mais datas; entre as
 * colunas de número, o saldo é a que muda exatamente o valor de outra coluna a cada linha; duas colunas que nunca vêm
 * cheias juntas são crédito e débito; uma coluna só com C/D é o tipo; a descrição é a que tem mais letras.
 */
function colunasPeloConteudo(rows: string[][], anoPadrao: number): Colunas | null {
  const largura = Math.max(...rows.map((r) => r.length))
  const cols = Array.from({ length: largura }, (_, j) => j)
  const datas = cols.map((j) => rows.filter((r) => r[j] && r[j].length <= 25 && acharData(r[j], anoPadrao)).length)
  const col: Colunas = { data: datas.indexOf(Math.max(...datas)) }
  if (!datas[col.data!]) return null
  const linhas = rows.filter((r) => acharData(r[col.data!] ?? '', anoPadrao))
  const n = linhas.length
  const conta = (j: number, f: (c: string) => boolean) => linhas.filter((r) => r[j] && f(r[j])).length
  const numericas = cols.filter((j) => j !== col.data && conta(j, (c) => ehValorNaTabela(c, anoPadrao)) >= Math.max(1, n * 0.3))
  if (!numericas.length) return null
  const indicador = cols.find((j) => j !== col.data && !numericas.includes(j) && conta(j, (c) => /^(c|d|cr|db|dr|\+|-)$/i.test(c.trim())) >= Math.max(1, n * 0.6))
  if (indicador !== undefined) col.tipo = indicador
  const num = (r: string[], j: number) => (ehValorNaTabela(r[j] ?? '', anoPadrao) ? valorComSinal(r[j]) : null)
  const cent = (v: number) => Math.round(Math.abs(v) * 100)

  // o saldo: a diferença entre duas linhas seguidas é o valor de uma delas (do mais antigo para o mais novo, ou ao contrário)
  let saldo: { j: number; nota: number; antigoPrimeiro: boolean } | null = null
  if (numericas.length >= 2) {
    for (const j of numericas) {
      let pares = 0, ida = 0, volta = 0
      for (let i = 1; i < linhas.length; i++) {
        const a = num(linhas[i - 1], j), b = num(linhas[i], j)
        if (a === null || b === null) continue
        pares++
        const dif = cent(b - a)
        if (numericas.some((k) => k !== j && num(linhas[i], k) !== null && cent(num(linhas[i], k)!) === dif)) ida++
        if (numericas.some((k) => k !== j && num(linhas[i - 1], k) !== null && cent(num(linhas[i - 1], k)!) === dif)) volta++
      }
      const nota = pares ? Math.max(ida, volta) / pares : 0
      if (pares >= 2 && nota >= 0.6 && (!saldo || nota > saldo.nota)) saldo = { j, nota, antigoPrimeiro: ida >= volta }
    }
  }
  if (saldo) col.saldo = saldo.j
  const restantes = numericas.filter((j) => j !== col.saldo).sort((a, b) => conta(b, (c) => ehValorNaTabela(c, anoPadrao)) - conta(a, (c) => ehValorNaTabela(c, anoPadrao)))
  if (!restantes.length) return null
  const [a, b] = restantes.slice(0, 2).sort((x, y) => x - y)
  const juntas = b === undefined ? n : linhas.filter((r) => num(r, a) !== null && num(r, b) !== null).length
  const cheias = b === undefined ? 0 : linhas.filter((r) => num(r, a) !== null || num(r, b) !== null).length
  if (b !== undefined && juntas <= n * 0.1 && cheias >= n * 0.6) {
    // crédito e débito: quem diz qual é qual é o saldo, o sinal escrito ou o nome ("Pix recebido"); sem nada, crédito vem antes
    let votoA = 0
    linhas.forEach((r, i) => {
      const va = num(r, a), vb = num(r, b)
      const v = va ?? vb
      if (v === null) return
      const lado = va !== null ? 1 : -1
      if (v < 0) votoA -= lado * 2
      if (saldo && i > 0) {
        const s0 = num(linhas[i - 1], saldo.j), s1 = num(r, saldo.j)
        if (s0 !== null && s1 !== null && s1 !== s0) votoA += lado * ((s1 > s0) === saldo.antigoPrimeiro ? 2 : -2)
      }
      const pista = tipoPorPista(r.filter((_, j) => j !== a && j !== b && j !== col.data).join(' '))
      if (pista) votoA += lado * (pista === 'entrada' ? 1 : -1)
    })
    col.credito = votoA >= 0 ? a : b
    col.debito = votoA >= 0 ? b : a
  } else col.valor = restantes[0]
  const usadas = new Set(Object.values(col))
  const letras = cols.map((j) => (usadas.has(j) ? -1 : linhas.reduce((s, r) => s + (r[j]?.replace(/[^A-Za-zÀ-ÿ]/g, '').length ?? 0), 0)))
  if (Math.max(...letras) > 0) col.desc = letras.indexOf(Math.max(...letras))
  return col
}

/** Lê as linhas de uma tabela de colunas já conhecidas. `cab`: os nomes das colunas (vazio quando foram adivinhadas). */
function lerLinhasDaTabela(corpo: string[][], col: Colunas, cab: string[], anoPadrao: number, opcoes: { referencias: string[]; fatura?: boolean }): LinhaExtrato[] {
  // Coluna de valor com sinal (as saídas vêm negativas): nela, o valor sem sinal é entrada. Sem nenhum negativo na coluna,
  // o número sozinho não diz nada e quem decide é a coluna "Tipo", o saldo ou o texto da linha.
  const colComSinal = col.valor !== undefined && corpo.some((r) => valorDaCelula(r[col.valor!] ?? '')?.sinal === -1)
  // Fatura de cartão (Nubank: date,category,title,amount): a compra vem positiva e o pagamento ("Pagamento recebido")
  // negativo, o contrário do extrato de conta; vale o cabeçalho do Nubank ou um "Pagamento recebido" com valor negativo.
  const nomes = cab.map(nomeDeColuna)
  const textoDaLinha = (r: string[]) => normal(col.desc !== undefined ? r[col.desc] ?? '' : r.join(' '))
  const fatura = col.valor !== undefined && col.saldo === undefined && (
    Boolean(opcoes.fatura) || ['date', 'category', 'title', 'amount'].every((h) => nomes.includes(h)) ||
    corpo.some((r) => valorDaCelula(r[col.valor!] ?? '')?.sinal === -1 && /^pagamento recebido/.test(textoDaLinha(r)))
  )
  // a categoria do cartão ("restaurante") não é parte do nome
  const colCategoria = nomes.findIndex((c) => /^(category|categoria)$/.test(c))
  const usadas = new Set([col.data, col.valor, col.credito, col.debito, col.tipo, col.saldo, col.doc, colCategoria >= 0 ? colCategoria : undefined].filter((x) => x !== undefined))
  // colunas repetidas ("Data contábil", "Saldo sacável", "Valor em dólar") também não são nome
  cab.forEach((c, j) => { const k = chaveDaColuna(c); if (k && k !== 'desc') usadas.add(j) })
  // outras colunas de texto, menos as que são código (sem espaço, com número: "abc-123", ids), na ordem das colunas,
  // para "Pix recebido" + "Fulano" virar "Pix de Fulano" (Inter: "Histórico" + "Descrição")
  const soData = (c: string) => { const d = acharData(c, anoPadrao); return Boolean(d) && normal(c).replace(d!.trecho, ' ').replace(/[^a-z]/g, '').length < 4 }
  const ehTexto = (c: string) => c && /[A-Za-zÀ-ÿ]/.test(c) && !soData(c) && !(/\d/.test(c) && !/\s/.test(c.trim())) && !ehValorNaTabela(c, anoPadrao)
  const descDa = (r: string[]) => r.filter((c, j) => (j === col.desc ? Boolean(c?.trim()) : !usadas.has(j) && ehTexto(c))).map((c) => c.trim()).join(' - ')

  const mesPrimeiro = mesVemPrimeiro(corpo.map((r) => r.join(" ")), cab)
  const saida: LinhaExtrato[] = []
  const semAno: boolean[] = []
  const fontes: { bruta: string; sinal: -1 | 0 | 1 }[] = []
  const saldos: { antes: number; depois: number; valor: number }[] = []
  /** O dia das linhas sem data (extrato que só escreve a data no primeiro lançamento do dia). */
  let dia: { data: string; semAno?: boolean } | null = null
  /** O lançamento de cima, que uma linha só com texto completa ("REM: FULANO" debaixo de "TRANSFERENCIA PIX"). */
  let ultimo: number | null = null
  /** Linha com data e nome mas sem valor: o valor vem na de baixo. */
  let pendente: string | null = null
  for (const r of corpo) {
    if (!r.length) { ultimo = null; pendente = null; continue } // quebra (rodapé, fim da tabela na página)
    let d = col.data !== undefined ? acharData(r[col.data] ?? '', anoPadrao, mesPrimeiro) : null
    // "Data de geração: 08-11-2026" na coluna da data é rodapé, não o dia de um lançamento
    if (d && normal(r[col.data!]).replace(d.trecho, ' ').replace(/[^a-z]/g, '').length > 6) d = null
    // "00/00/0000" (linha de saldo do Banco do Brasil): tem cara de data e não é dia nenhum
    if (!d && col.data !== undefined && /^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}$/.test((r[col.data] ?? '').trim())) { ultimo = null; pendente = null; continue }
    const desc = descDa(r)
    const nd = normal(desc)
    if (r.some((c, j) => j !== col.data && ehResumo(normal(c)))) {
      // "Saldo anterior", "Saldo do dia": anotado para conferir no fim se cada lançamento entrou ou saiu
      const v = [col.saldo, col.valor, col.credito].map((j) => (j !== undefined ? valorComSinal(r[j] ?? '') : null)).find((x) => x !== null)
      if (v !== undefined && v !== null && SALDO_DA_CONTA.test(nd.replace(/[^a-z/ ]/g, ' ').replace(/\s+/g, ' ').trim())) saldos.push({ antes: saida.length, depois: saida.length, valor: v })
      if (d) dia = d
      ultimo = null; pendente = null
      continue
    }
    let valor = 0
    let sinal: -1 | 0 | 1 = 0
    if (col.valor !== undefined && r[col.valor]) {
      const v = valorDaCelula(r[col.valor])
      if (v) { valor = v.valor; sinal = fatura ? (v.sinal === -1 ? 1 : -1) : v.sinal }
    }
    if (!valor && col.credito !== undefined) { const v = valorDaCelula(r[col.credito] ?? ''); if (v) { valor = v.valor; sinal = 1 } }
    if (!valor && col.debito !== undefined) { const v = valorDaCelula(r[col.debito] ?? ''); if (v) { valor = v.valor; sinal = -1 } }
    if (!valor) {
      if (!desc || RUIDO_DE_PAGINA.test(nd) || CABECALHO_DE_PAGINA.test(nd)) { if (desc) { ultimo = null; pendente = null } if (d) dia = d; continue }
      // só texto: completa o nome do lançamento de cima (mesmo dia) ou, com data e sem ninguém em cima, é o nome do de baixo
      if (!/[A-Za-zÀ-ÿ]{2}/.test(desc)) continue
      if (ultimo !== null && (!d || d.data === saida[ultimo].data) && desc.length < 80) {
        const f = fontes[ultimo]
        f.bruta = `${f.bruta} ${desc}`
        const l = saida[ultimo]
        const novo = montar(l.data, f.bruta, l.valor, f.sinal)
        Object.assign(l, { descricao: novo.descricao, original: novo.original, tipo: novo.tipo, forma: novo.forma, revisar: l.pagamentoDaFatura ? l.revisar : novo.revisar })
      } else if (d) { dia = d; pendente = desc }
      continue
    }
    const data = d ?? dia
    if (!data) continue
    if (d) dia = d
    const texto = (!d && pendente ? `${pendente} ` : '') + desc
    pendente = null
    const extraTipo = col.tipo !== undefined ? tipoDaCelula(r[col.tipo] ?? '') : undefined
    if (!sinal && !extraTipo && colComSinal) sinal = 1
    const l = montar(data.data, texto, valor, sinal, extraTipo)
    // o pagamento da fatura sai da conta e já está no extrato dela: importar de novo contaria em dobro
    if (fatura && sinal === 1 && /^pagamento recebido|^pagamento\b.*\b(fatura|efetuado|em \d)|^pagamento$|^pagto\b/.test(normal(texto).trim())) Object.assign(l, { pagamentoDaFatura: true, revisar: l.revisar ?? 'pagamento da fatura: já está no extrato da conta' })
    if (col.saldo !== undefined) { const s = valorComSinal(r[col.saldo] ?? ''); if (s !== null) saldos.push({ antes: saida.length + 1, depois: saida.length, valor: s }) }
    saida.push(l)
    semAno.push(Boolean(data.semAno))
    fontes.push({ bruta: texto, sinal: sinal || (extraTipo === 'entrada' ? 1 : extraTipo === 'saida' ? -1 : 0) })
    ultimo = saida.length - 1
  }
  tipoPeloSaldo(saida, fontes, saldos)
  ajustarAno(saida, semAno, opcoes.referencias)
  return saida
}

/** Linhas de uma tabela → lançamentos. Acha o cabeçalho (ou adivinha as colunas pelo conteúdo). */
export function deTabela(linhas: string[][], anoPadrao: number, opcoes: { /** sem cair no texto corrido quando não acha as colunas */ soTabela?: boolean } = {}): LinhaExtrato[] {
  const rows = linhas.map((r) => r.map((c) => String(c ?? '').trim())).filter((r) => r.some(Boolean))
  if (!rows.length) return []
  const referencias = datasComAno(rows.map((r) => r.join('  ')))
  for (let i = 0; i < Math.min(rows.length, 40); i++) {
    const col = colunasDoCabecalho(rows[i])
    if (col) return lerLinhasDaTabela(rows.slice(i + 1), col, rows[i], anoPadrao, { referencias })
  }
  const col = colunasPeloConteudo(rows, anoPadrao)
  return col ? lerLinhasDaTabela(rows, col, [], anoPadrao, { referencias }) : opcoes.soTabela ? [] : deTexto(rows.map((r) => r.join('  ')), anoPadrao, { referencias })
}

/**
 * Os separadores que o CSV pode ter, do mais provável para o menos: o que aparece o mesmo tanto de vezes (duas ou mais)
 * em mais linhas. O título de cima ("Extrato, conta 1,2,3") não decide sozinho.
 */
export function separadoresDoCsv(texto: string): string[] {
  const linhas = texto.split(/\r\n|\r|\n/).filter((l) => l.trim()).slice(0, 200)
  const nota = (sep: string) => {
    const vezes = new Map<number, number>()
    for (const l of linhas) { const n = l.replace(/"[^"]*"/g, '').split(sep).length - 1; if (n >= 2) vezes.set(n, (vezes.get(n) ?? 0) + 1) }
    return Math.max(0, ...vezes.values())
  }
  return [';', '\t', '|', ','].map((sep) => ({ sep, n: nota(sep) })).filter((x) => x.n).sort((a, b) => b.n - a.n).map((x) => x.sep)
}

/** CSV com aspas e separador adivinhado (; , tab ou |), ou o separador dado. */
export function lerCsv(texto: string, separador?: string): string[][] {
  const sep = separador ?? separadoresDoCsv(texto)[0] ?? ';'
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

/** Número do OFX: o padrão é "-1234.56", mas há bancos que escrevem "-1.234,56" ou "1,234.56". */
function numeroOfx(t: string) {
  const s = t.replace(/\s/g, '').replace('−', '-')
  const virgula = s.lastIndexOf(',')
  const ponto = s.lastIndexOf('.')
  if (virgula >= 0 && ponto >= 0) return Number(virgula > ponto ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, ''))
  if (virgula >= 0) return Number(/^[-+]?\d+,\d{1,2}$/.test(s) ? s.replace(',', '.') : s.replace(/,/g, ''))
  return Number(s)
}

/** &amp; &quot; &#39; e companhia, como o OFX em XML escreve. */
const entidades = (s: string) =>
  s.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (m, e: string) => {
    const x = e.toLowerCase()
    if (x[0] === '#') return String.fromCodePoint(x[1] === 'x' ? parseInt(x.slice(2), 16) : Number(x.slice(1)))
    return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }[x] ?? m
  })

/** OFX (o formato "Money" que vários bancos exportam): cada <STMTTRN> é um lançamento. */
export function deOfx(texto: string): LinhaExtrato[] {
  const campo = (bloco: string, nome: string) => entidades(bloco.match(new RegExp(`<${nome}>([^<\\r\\n]*)`, 'i'))?.[1]?.trim() ?? '')
  const saida: LinhaExtrato[] = []
  const cartao = /<CREDITCARDMSGSRSV1>|<CCSTMTRS>/i.test(texto)
  for (const m of texto.matchAll(/<STMTTRN>([\s\S]*?)(<\/STMTTRN>|(?=<STMTTRN>)|<\/BANKTRANLIST>)/gi)) {
    const b = m[1]
    const d = campo(b, 'DTPOSTED')
    const v = numeroOfx(campo(b, 'TRNAMT'))
    if (d.length < 8 || !v) continue
    // muitos bancos repetem o mesmo texto no nome e no memo
    const nome = campo(b, 'NAME'), memo = campo(b, 'MEMO')
    const desc = [nome, normal(memo).includes(normal(nome)) ? '' : memo].filter(Boolean).join(' - ') || memo
    const l = montar(`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`, desc, v, v < 0 ? -1 : 1)
    // fatura de cartão: o pagamento dela já está no extrato da conta
    if (cartao && v > 0 && /^pagamento\b|^pagto\b/.test(normal(desc).trim())) Object.assign(l, { pagamentoDaFatura: true, revisar: l.revisar ?? 'pagamento da fatura: já está no extrato da conta' })
    saida.push(l)
  }
  return saida
}

// ---------- arquivos ----------

export interface ItemTexto { str: string; transform: number[]; width: number; height?: number }

/** Um pedaço de texto do PDF e onde ele está na página (x da esquerda, y de baixo para cima, largura e altura da letra). */
export interface ItemPdf { str: string; x: number; y: number; w: number; h: number }

/** O que o leitor usa do pdf.js (em `lib/pdfjs.ts`; os testes passam o deles). */
export interface LeitorDePdf {
  getDocument: (o: object) => { promise: Promise<{ numPages: number; getPage: (n: number) => Promise<{ getTextContent: (o?: object) => Promise<{ items: unknown[] }> }> }> }
}

/** Os pedaços de texto de cada página do PDF (pdf.js). */
export async function itensDoPdf(dados: ArrayBuffer, leitor?: LeitorDePdf): Promise<ItemPdf[][]> {
  let pdfjs: LeitorDePdf
  try {
    pdfjs = leitor ?? (await import('./pdfjs')).pdfjs
  } catch (e) {
    registrarErro(e, 'carregar o leitor de PDF')
    throw new Error('Não consegui carregar o leitor de PDF. Confira a internet e tente de novo, ou exporte o extrato em CSV, Excel ou OFX.')
  }
  // Cada tentativa recebe uma cópia: o pdf.js leva os bytes para o worker e o original fica vazio.
  const abrir = (opcoes: object) => pdfjs.getDocument({ data: new Uint8Array(dados.slice(0)), ...opcoes }).promise
  let doc
  try {
    doc = await abrir({})
  } catch (primeiro) {
    if (/password/i.test(String(primeiro))) throw new Error('Esse PDF tem senha. Abra no app do banco e exporte sem senha (ou em CSV).')
    // PDF meio torto (comum em extrato gerado por sistema de banco): tenta de novo sem as partes que costumam quebrar
    try {
      doc = await abrir({ isEvalSupported: false, disableFontFace: true, useSystemFonts: false, stopAtErrors: false })
    } catch (e) {
      registrarErro(e, `extrato PDF (${dados.byteLength} bytes): ${String(primeiro).slice(0, 200)}`)
      throw new Error('Não consegui abrir esse PDF. Ele pode estar corrompido: baixe de novo pelo app do banco ou exporte em CSV, Excel ou OFX.')
    }
  }
  const paginas: ItemPdf[][] = []
  let comErro = 0
  for (let p = 1; p <= doc.numPages; p++) {
    // uma página que não dá para ler não derruba as outras
    try {
      const page = await doc.getPage(p)
      const { items } = await page.getTextContent()
      paginas.push(itensDaPagina(items as ItemTexto[]))
    } catch (e) {
      comErro++
      registrarErro(e, `extrato PDF: página ${p} de ${doc.numPages}`)
      paginas.push([])
    }
  }
  if (comErro === doc.numPages) throw new Error('Não consegui ler o texto desse PDF. Baixe de novo pelo app do banco ou exporte em CSV, Excel ou OFX.')
  // PDF sem texto nenhum: é foto ou papel escaneado
  if (paginas.reduce((n, p) => n + p.reduce((k, it) => k + it.str.replace(/\s/g, '').length, 0), 0) < 20) {
    throw new Error('Esse PDF é uma foto do extrato (escaneado ou print): não tem texto para ler. Baixe o extrato pelo app ou site do banco, em PDF, CSV, Excel ou OFX.')
  }
  return paginas
}

/** Os pedaços de uma página como o pdf.js entrega (`getTextContent().items`) → texto e posição. */
export function itensDaPagina(items: ItemTexto[]): ItemPdf[] {
  return items.filter((it) => it.str?.trim() && Array.isArray(it.transform)).map((it) => ({
    str: it.str, x: it.transform[4], y: it.transform[5], w: it.width ?? 0,
    h: Math.abs(it.transform[3]) || it.height || Math.hypot(it.transform[0], it.transform[1]) || 10,
  }))
}

/** As linhas de cada página: os pedaços na mesma altura, da esquerda para a direita, de cima para baixo. */
function linhasDasPaginas(paginas: ItemPdf[][]): ItemPdf[][] {
  const linhas: ItemPdf[][] = []
  for (const itens of paginas) {
    const grupos: { y: number; itens: ItemPdf[] }[] = []
    for (const it of itens) {
      if (!it.str?.trim()) continue
      const g = grupos.find((x) => Math.abs(x.y - it.y) < 3)
      if (g) g.itens.push(it)
      else grupos.push({ y: it.y, itens: [it] })
    }
    grupos.sort((a, b) => b.y - a.y)
    const daPagina: ItemPdf[][] = []
    for (const g of grupos) {
      // PDF que vem letra por letra (ou sílaba por sílaba): pedaços colados viram uma palavra só
      const juntos: ItemPdf[] = []
      for (const it of g.itens.sort((a, b) => a.x - b.x)) {
        const ant = juntos[juntos.length - 1]
        const letra = ant && ant.str.length ? ant.w / ant.str.length : 0
        if (ant && letra && it.x - (ant.x + ant.w) < letra * 0.3 && !/\s$/.test(ant.str) && !/^\s/.test(it.str)) {
          juntos[juntos.length - 1] = { ...ant, str: ant.str + it.str, w: it.x + it.w - ant.x }
        } else juntos.push({ ...it })
      }
      daPagina.push(juntos)
    }
    linhas.push(...juntarLinhasQuebradas(separarLadoALado(daPagina)))
  }
  return linhas
}

/** Texto corrido de uma linha do PDF: espaço duplo onde há um vão grande (entre colunas). */
function textoDaLinhaPdf(itens: ItemPdf[]) {
  let texto = ''
  let fim = -Infinity
  for (const it of itens) {
    texto += (texto ? (it.x - fim > 14 ? '  ' : ' ') : '') + it.str.trim()
    fim = it.x + it.w
  }
  return texto
}

/** Um pedaço de uma linha do PDF: uma data, um valor ou um trecho de texto, e de onde até onde ele vai na página. */
interface Pedaco { texto: string; x0: number; x1: number; tipo: 'data' | 'valor' | 'texto'; /** largura de uma letra ali */ letra: number }

// "4.50" é valor, não dia 4 do mês 50: com ponto ou traço, a data precisa do ano
const PALAVRA_DATA = /^(\d{1,2}\/\d{1,2}(\/\d{2,4})?|\d{1,2}[.-]\d{1,2}[.-]\d{2,4}|\d{4}[-/.]\d{1,2}[-/.]\d{1,2})$/
/** Vão entre colunas, no texto da linha (um caractere que nenhuma regra de data ou valor atravessa). */
const VAO = '\u0001'

/**
 * Uma linha do PDF em pedaços. A linha vira um texto só, com a posição de cada letra (proporcional dentro do trecho que o
 * pdf.js entregou) e uma marca onde há um vão maior que uma letra e meia (entre colunas). Os valores são achados nesse
 * texto pela mesma regra do resto do leitor ("-R$ 114,00", "R$ -114,00", "- R$ 114,00", "114,00 D", "42,79-"); o que sobra
 * entre eles e os vãos é texto, ou data quando o trecho é (ou começa por) uma data. Uma data colada no fim de um texto
 * ("PASTELLOCO 01/10") fica no texto; se uma data é mesmo a do lançamento, quem decide é a coluna em que ela está.
 */
function pedacosDaLinha(itens: ItemPdf[]): Pedaco[] {
  let texto = ''
  const x0: number[] = [], x1: number[] = [], larg: number[] = []
  let fim = -Infinity
  const poe = (ch: string, a: number, b: number, letra: number) => { texto += ch; x0.push(a); x1.push(b); larg.push(letra) }
  for (const it of itens) {
    const str = it.str
    const letra = str.length ? (it.w || str.length * it.h * 0.5) / str.length : it.h * 0.5
    for (const m of str.matchAll(/\S+/g)) {
      const a = it.x + m.index * letra
      if (texto) poe(a - fim > letra * 1.5 ? VAO : ' ', fim, a, letra)
      for (let k = 0; k < m[0].length; k++) poe(m[0][k], a + k * letra, a + (k + 1) * letra, letra)
      fim = a + m[0].length * letra
    }
  }
  const pedacos: Pedaco[] = []
  const trecho = (de: number, ate: number, valor: boolean) => {
    // sem os espaços e vãos das pontas
    while (de < ate && /[\s\u0001]/.test(texto[de])) de++
    while (ate > de && /[\s\u0001]/.test(texto[ate - 1])) ate--
    if (ate <= de) return
    const t = texto.slice(de, ate)
    // "01-10-2026 Transferência Pix" (colunas apertadas): a data que abre o trecho é um pedaço e o resto é outro
    const abre = valor ? null : /^(\S+)\s+\S/.exec(t)
    if (abre && PALAVRA_DATA.test(abre[1])) {
      pedacos.push({ texto: abre[1], x0: x0[de], x1: x1[de + abre[1].length - 1], letra: larg[de], tipo: 'data' })
      return trecho(de + abre[1].length, ate, false)
    }
    pedacos.push({ texto: t, x0: x0[de], x1: x1[ate - 1], letra: larg[de], tipo: valor ? 'valor' : PALAVRA_DATA.test(t) ? 'data' : 'texto' })
  }
  const textoAte = (de: number, ate: number) => {
    let i = de
    for (let k = de; k < ate; k++) if (texto[k] === VAO) { trecho(i, k, false); i = k + 1 }
    trecho(i, ate, false)
  }
  let pos = 0
  for (const m of texto.matchAll(RE_VALOR)) {
    textoAte(pos, m.index)
    trecho(m.index, m.index + m[0].length, true)
    pos = m.index + m[0].length
  }
  textoAte(pos, texto.length)
  return pedacos
}

/** Começo de lançamento: "01/10", "01/10/2026", "01 OUT". */
const COMECA_COM_DATA = new RegExp(`^(\\d{1,2}/\\d{1,2}(/\\d{2,4})?|\\d{1,2}\\s(${MES})\\b)`, 'i')

/**
 * Fatura com os lançamentos em duas colunas lado a lado (Itaú e outros): cada linha do papel traz dois lançamentos
 * ("01/10 LOJA A 42,79     04/10 LOJA B 30,00"). Quando várias linhas da página repetem esse desenho com a segunda data
 * sempre no mesmo lugar, a página é cortada ali: primeiro o lado esquerdo inteiro, depois o direito.
 */
function separarLadoALado(linhas: ItemPdf[][]): ItemPdf[][] {
  const cortes: number[] = []
  let comValor = 0
  for (const itens of linhas) {
    const p = pedacosDaLinha(itens)
    const v = p.findIndex((x) => x.tipo === 'valor')
    if (v < 0) continue
    comValor++
    const d = p.findIndex((x, i) => i > v && x.tipo !== 'valor' && COMECA_COM_DATA.test(x.texto))
    if (d > 0 && p.some((x, i) => i > d && x.tipo === 'valor')) cortes.push(p[d].x0)
  }
  if (cortes.length < 2 || cortes.length < comValor * 0.4) return linhas
  const meio = [...cortes].sort((a, b) => a - b)[Math.floor(cortes.length / 2)]
  const perto = cortes.filter((x) => Math.abs(x - meio) < 12)
  if (perto.length < cortes.length * 0.7) return linhas
  const corte = Math.min(...perto) - 3
  const lado = (direito: boolean) => linhas.map((l) => l.filter((it) => (it.x >= corte) === direito)).filter((l) => l.length)
  return [...lado(false), ...lado(true)]
}

/** Coluna do cabeçalho de um PDF: o nome, o que ela é e de onde até onde vai. */
interface ColunaPdf { nome: string; chave?: Chave; x0: number; x1: number }
const NUMERICAS: Chave[] = ['valor', 'credito', 'debito', 'saldo']

/** A coluna onde um pedaço cai: texto na última coluna que começa antes dele; número na que mais se sobrepõe a ele, ou na de borda (esquerda, direita ou meio) mais perto. */
function colunaDoPedaco(p: Pedaco, cols: ColunaPdf[]): number {
  const numericas = cols.some((c) => c.chave && NUMERICAS.includes(c.chave))
  const candidatas = cols.map((c, j) => ({ c, j })).filter(({ c }) => {
    if (!numericas) return true
    const num = Boolean(c.chave && NUMERICAS.includes(c.chave))
    return p.tipo === 'valor' ? num : !num
  })
  // texto (e data) é alinhado à esquerda: fica na última coluna que começa antes dele
  if (p.tipo !== 'valor') {
    const antes = candidatas.filter(({ c }) => c.x0 <= p.x0 + p.letra * 1.5).sort((a, b) => b.c.x0 - a.c.x0)[0]
    if (antes) return antes.j
  }
  let melhor = { j: -1, nota: Infinity }
  for (const { c, j } of candidatas) {
    const sobra = Math.min(p.x1, c.x1) - Math.max(p.x0, c.x0)
    const nota = sobra > 0 ? -sobra : Math.min(Math.abs(p.x0 - c.x0), Math.abs(p.x1 - c.x1), Math.abs((p.x0 + p.x1) / 2 - (c.x0 + c.x1) / 2))
    if (nota < melhor.nota) melhor = { j, nota }
  }
  return melhor.j
}

/**
 * Lançamento que ocupa várias linhas do papel (o nome quebrado em duas ou três, o tipo numa coluna e a pessoa em outra)
 * vira uma linha só. A linha que tem o valor é o lançamento; as linhas só de texto coladas nela (em cima ou embaixo, pela
 * distância: dentro do mesmo lançamento as linhas ficam mais juntas do que entre um lançamento e outro) entram nele, cada
 * trecho na coluna de texto em que está. Assim "Transferência | BEATRIZ … | 120,00" + "recebida pelo Pix | NU PAGAMENTOS"
 * sai "Transferência recebida pelo Pix | BEATRIZ … NU PAGAMENTOS | 120,00", e não as duas colunas misturadas.
 * Rodapé, cabeçalho, resumo, título de dia e texto comprido não entram em lançamento nenhum.
 */
function juntarLinhasQuebradas(linhas: ItemPdf[][]): ItemPdf[][] {
  const info = linhas.map((itens) => {
    const p = pedacosDaLinha(itens)
    const texto = p.map((x) => x.texto).join(' ')
    const n = normal(texto)
    const temValor = p.some((x) => x.tipo === 'valor')
    const d = temValor ? null : acharData(texto, 2000)
    let solta = !temValor && p.length > 0 && texto.length <= 90 && !RUIDO_DE_PAGINA.test(n) && !CABECALHO_DE_PAGINA.test(n) && !RESUMO_DA_FATURA.test(n) && !ehResumo(n) && !PERIODO.test(n)
    if (solta && (colunasDoCabecalho(p.map((x) => x.texto)) || cabecalhoApertado(p))) solta = false
    // só a data (título do dia) não completa ninguém
    if (solta && d && semRuido(texto.replace(new RegExp(d.trecho.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&'), 'i'), ' ')).replace(/[^A-Za-zÀ-ÿ]/g, '').length < 4) solta = false
    return { itens, p, solta, temValor, y: itens[0]?.y ?? 0, h: Math.max(1, ...itens.map((i) => i.h)), x0: Math.min(...itens.map((i) => i.x)), comecaComData: Boolean(d && n.startsWith(d.trecho)) }
  })
  const dono = info.map(() => -1)
  for (let i = 0; i < info.length; i++) {
    if (!info[i].solta) continue
    let j = i
    while (j + 1 < info.length && info[j + 1].solta && info[j + 1].y < info[j].y) j++
    const cima = i > 0 && info[i - 1].temValor && info[i - 1].y > info[i].y ? i - 1 : -1
    const baixo = j + 1 < info.length && info[j + 1].temValor && info[j + 1].y < info[j].y ? j + 1 : -1
    const vao = (k: number) => info[k].y - info[k + 1].y // entre a linha k e a de baixo
    const vaos: number[] = []
    for (let k = cima >= 0 ? cima : i; k < (baixo >= 0 ? baixo : j); k++) vaos.push(vao(k))
    const menor = Math.min(...vaos)
    // junto = quase o menor vão do trecho (um ponto de folga) e nunca mais que duas linhas e meia de distância
    const perto = (v: number, h: number) => v <= menor + Math.max(1, h * 0.12) && v <= h * 2.5
    // a linha que começa pela data, no lugar da data do lançamento, é outro lançamento (o valor vem na de baixo) ou o título do dia
    // nem a que começa antes do texto do lançamento (aviso ou rodapé na margem), a não ser a hora debaixo da data ("10:12:44")
    const cabe = (k: number, a: number) => {
      if (info[k].comecaComData && info[k].x0 <= info[a].x0 + info[k].h) return false
      const texto = info[a].p.find((x) => x.tipo === 'texto')
      return !texto || info[k].x0 >= texto.x0 - info[k].h || info[k].p.map((x) => x.texto).join('').replace(/[^A-Za-zÀ-ÿ]/g, '').length < 4
    }
    let k = i
    if (cima >= 0) while (k <= j && perto(vao(k - 1), info[k].h) && cabe(k, cima)) dono[k++] = cima
    if (baixo >= 0) for (let m = j; m >= k && perto(vao(m), info[m].h) && cabe(m, baixo); m--) dono[m] = baixo
    i = j
  }
  if (!dono.some((a) => a >= 0)) return linhas
  const saida: ItemPdf[][] = []
  info.forEach((L, a) => {
    if (dono[a] >= 0) return
    const minhas = dono.map((x, k) => (x === a ? k : -1)).filter((k) => k >= 0)
    if (!minhas.length) { saida.push(L.itens); return }
    const cols = L.p.map((c) => ({ ...c, antes: [] as string[], depois: [] as string[] }))
    for (const k of minhas) {
      for (const q of info[k].p) {
        // a coluna de texto do lançamento que começa antes (ou junto) deste trecho; sem nenhuma, ele fica onde está
        let col = cols.filter((c) => c.tipo === 'texto' && c.x0 <= q.x0 + q.letra * 2).sort((x, y) => y.x0 - x.x0)[0]
        if (!col) { col = { ...q, texto: '', tipo: 'texto', antes: [], depois: [] }; cols.push(col) }
        ;(k < a ? col.antes : col.depois).push(q.texto)
      }
    }
    saida.push(cols.sort((x, y) => x.x0 - y.x0).map((c) => ({ str: [...c.antes, c.texto, ...c.depois].filter(Boolean).join(' '), x: c.x0, y: L.y, w: c.x1 - c.x0, h: L.h })))
  })
  return saida
}

/**
 * Cabeçalho com os nomes das colunas tão juntos que parecem um texto só ("DATA ESTABELECIMENTO VALOR EM R$"): cada palavra
 * que é nome de coluna abre uma coluna e as outras ("EM", "(R$)") ficam na de trás. Só vale com data, nome e valor.
 */
function cabecalhoApertado(pedacos: Pedaco[]): Pedaco[] | null {
  const cols: Pedaco[] = []
  for (const p of pedacos) {
    let x = p.x0
    for (const palavra of p.texto.split(' ')) {
      const fim = x + palavra.length * p.letra
      const ant = cols[cols.length - 1]
      if (chaveDaColuna(palavra) || !ant) cols.push({ texto: palavra, x0: x, x1: fim, tipo: 'texto', letra: p.letra })
      else { ant.texto += ` ${palavra}`; ant.x1 = fim }
      x = fim + p.letra
    }
  }
  const chaves = cols.map((c) => chaveDaColuna(c.texto))
  const tem = (k: Chave) => chaves.includes(k)
  return cols.length > pedacos.length && tem('data') && tem('desc') && (tem('valor') || tem('credito') || tem('debito')) ? cols : null
}

/**
 * PDF com tabela (Data | Histórico | Crédito | Débito | Saldo): cada número vai para a coluna embaixo da qual está, então
 * dá para saber se é crédito, débito, valor ou saldo, coisa que o texto corrido perde. O cabeçalho é procurado de novo em
 * cada página; as linhas fora da tabela (título, rodapé, aviso do banco) separam os lançamentos e não viram nome.
 */
function dePdfPelasColunas(linhas: ItemPdf[][], anoPadrao: number, opcoes: { referencias: string[]; fatura?: boolean }): LinhaExtrato[] {
  /** As colunas da página atual (onde cada uma está) e, para cada uma, a posição dela na tabela da primeira página. */
  let cols: ColunaPdf[] | null = null
  let mapa: number[] = []
  let nomes: string[] | null = null
  const tabela: string[][] = []
  for (const itens of linhas) {
    const pedacos = pedacosDaLinha(itens)
    if (!pedacos.length) continue
    // cabeçalho: só texto, com a data e algum valor entre os nomes
    const cabecalho = pedacos.every((p) => p.tipo === 'texto') ? (colunasDoCabecalho(pedacos.map((p) => p.texto)) ? pedacos : cabecalhoApertado(pedacos)) : null
    if (cabecalho) {
      cols = cabecalho.map((p) => ({ nome: p.texto, chave: chaveDaColuna(p.texto), x0: p.x0, x1: p.x1 }))
      if (!nomes) nomes = cols.map((c) => c.nome)
      // a mesma tabela em outra página (talvez com uma coluna a mais ou a menos): cada coluna vai para a de mesmo nome
      // ou de mesma espécie da primeira página; a que não existe lá fica de fora
      const primeira = nomes
      mapa = cols.map((c) => {
        const igual = primeira.findIndex((n) => nomeDeColuna(n) === nomeDeColuna(c.nome))
        return igual >= 0 ? igual : c.chave ? primeira.findIndex((n) => chaveDaColuna(n) === c.chave) : -1
      })
      tabela.push([])
      continue
    }
    if (!cols) continue
    const linha: string[] = nomes!.map(() => '')
    const desc = cols.findIndex((c) => c.chave === 'desc')
    const inicioDosNumeros = Math.min(...cols.filter((c) => c.chave && NUMERICAS.includes(c.chave)).map((c) => c.x0))
    let fora = false
    for (const p of pedacos) {
      // valor bem à esquerda das colunas de número ("PARC 2/3 R$ 50,00" no meio do nome): é parte do nome
      if (p.tipo === 'valor' && p.x1 < inicioDosNumeros - p.letra * 2) p.tipo = 'texto'
      let j = colunaDoPedaco(p, cols)
      if (j < 0) continue
      // data solta que não está embaixo da coluna Data ("REM: FULANO  01/10"): é texto
      if (p.tipo === 'data' && cols[j].chave !== 'data') p.tipo = 'texto'
      if (p.tipo === 'texto' && cols[j].chave === 'data' && !acharData(p.texto, anoPadrao)) {
        // debaixo da data, a hora ou o dia da semana ("10:12:44", "seg") não é nome de ninguém
        if (p.texto.replace(/[^A-Za-zÀ-ÿ]/g, '').length < 4) continue
        j = desc >= 0 ? desc : j
      }
      const col = cols[j]
      // texto que começa bem antes da coluna de nome ou atravessa a tabela: é aviso, título ou rodapé
      if (p.tipo === 'texto' && col.chave === 'desc' && (p.x0 < col.x0 - p.letra * 3 || p.x1 > inicioDosNumeros + p.letra * 2)) fora = true
      const k = mapa[j]
      if (k >= 0) linha[k] = linha[k] ? `${linha[k]} ${p.texto}` : p.texto
    }
    tabela.push(fora ? [] : linha)
  }
  if (!nomes) return []
  const col = colunasDoCabecalho(nomes)
  return col ? lerLinhasDaTabela(tabela, col, nomes, anoPadrao, opcoes) : []
}

/**
 * PDF já aberto (os pedaços de cada página) → lançamentos e o texto corrido (para achar o banco no cabeçalho). Lê pelas
 * colunas quando o PDF tem uma tabela com cabeçalho, e pelo texto corrido quando não tem (ou quando as colunas acharam
 * bem menos lançamentos que o texto).
 */
export function lerPaginasPdf(paginas: ItemPdf[][], anoPadrao: number): { linhas: LinhaExtrato[]; texto: string[] } {
  const linhas = linhasDasPaginas(paginas)
  const texto = linhas.map(textoDaLinhaPdf)
  const referencias = datasComAno(texto)
  const peloTexto = deTexto(texto, anoPadrao, { referencias })
  const pelasColunas = dePdfPelasColunas(linhas, anoPadrao, { referencias, fatura: pareceFatura(texto) })
  return { linhas: pelasColunas.length && pelasColunas.length >= peloTexto.length * 0.6 ? pelasColunas : peloTexto, texto }
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

/**
 * Bancos cujo nome é também palavra comum ("caixa", "original", "next", "rico", "inter"…): no texto do extrato só valem
 * com o contexto de banco ("Caixa Econômica", "Banco Original"). No nome do arquivo ("extrato-inter.csv") vale a palavra
 * sozinha, menos "original" e "next", que aparecem em qualquer nome de arquivo.
 */
const CONTEXTO_DO_BANCO: Record<string, RegExp> = {
  Caixa: /caixa economica|caixa federal|\bcef\b/,
  Inter: /banco inter\b|bancointer|inter\.co\b|\binter\s+(s\.?\s?a|bank|pay)\b/,
  Original: /banco original|bancooriginal/,
  Next: /banco next|\bnext\s+(bank|bradesco)|conta next/,
  Rico: /rico\s+(investimentos|corretora|ctvm)|rico\.com\.br/,
  Neon: /banco neon|neon pagamentos|conta neon|neon\.com\.br/,
  Wise: /wise\.com|transferwise|wise\s+(brasil|payments|europe)/,
  Nomad: /nomad\s+(global|bank|conta|financial)|getnomad|nomad\.co\b/,
  XP: /xp\s+investimentos|banco xp|conta xp/,
  BV: /banco bv\b|bv\s+(financeira|s\.?\s?a)|banco votorantim/,
}
const SO_COM_CONTEXTO = new Set(['Original', 'Next'])
/** Outros jeitos de o banco se escrever no cabeçalho do extrato. */
const APELIDO_DO_BANCO: Record<string, RegExp> = { Nubank: /nu pagamentos|nu financeira/, 'Banco do Brasil': /\bbb\.com\.br|banco do brasil/ }

/** Banco citado no texto (a primeira menção), com a palavra inteira; `doArquivo` para o nome do arquivo. */
function acharBanco(texto: string, doArquivo: boolean): string | undefined {
  const t = normal(texto)
  let melhor: { nome: string; pos: number } | undefined
  for (const b of CATALOGO_BANCOS) {
    if (b.nome.startsWith('Carteira')) continue
    const exigeContexto = b.nome in CONTEXTO_DO_BANCO && !(doArquivo && !SO_COM_CONTEXTO.has(b.nome))
    const palavra = normal(b.nome).replace(/[^a-z0-9 ]/g, '').split(' ').join('[\\s_.-]*')
    const achados = [
      exigeContexto ? CONTEXTO_DO_BANCO[b.nome] : new RegExp(`(?<![a-z0-9])${palavra}(?![a-z0-9])`),
      ...(APELIDO_DO_BANCO[b.nome] ? [APELIDO_DO_BANCO[b.nome]] : []),
    ].map((re) => re.exec(t)?.index).filter((i): i is number => i !== undefined)
    const pos = Math.min(...achados)
    if (achados.length && (!melhor || pos < melhor.pos)) melhor = { nome: b.nome, pos }
  }
  return melhor?.nome
}

/**
 * O banco do extrato: o nome do arquivo e o cabeçalho (o que vem antes do primeiro lançamento) dizem; os lançamentos não
 * ("PIX … Nubank" num extrato do Bradesco é o destino do Pix, não o banco do extrato).
 */
function bancoDoExtrato(nomeDoArquivo: string, cabecalho: string) {
  return acharBanco(nomeDoArquivo.replace(/\.[^.]+$/, ''), true) ?? acharBanco(cabecalho, false)
}

/** As linhas de cima do arquivo, até o primeiro lançamento (uma linha com data e valor, ou que começa pela data). */
function cabecalhoDe(linhas: string[]) {
  const antes: string[] = []
  for (const l of linhas.slice(0, 60)) {
    const t = l.trim()
    if (!t) continue
    if (/^\d{1,2}[/.-]\d{1,2}([/.-]\d{2,4})?(\s|$|[;,\t])|^\d{4}-\d{2}-\d{2}/.test(t) || (acharData(t, 2025) && acharValores(t).length)) break
    antes.push(t)
  }
  return antes.join(' ').slice(0, 3000)
}

// ---------- repetidos em outros anos ----------

/** O que faz dois lançamentos serem o mesmo para o aviso de repetido: dia, tipo e valor. */
export const chaveDeRepetido = (l: { data?: string | null; tipo: Tipo; valor: number }) => `${l.data}|${l.tipo}|${Math.round(l.valor * 100)}`

/**
 * Só o ano aberto fica carregado no app. Num extrato que cruza a virada (dez–jan), os lançamentos de dias de outro ano
 * são buscados aqui para o aviso de repetido valer neles também. `anosComErro`: anos que não deu para consultar.
 */
export async function buscarJaLancados(linhas: { data: string }[], anoAberto: number): Promise<{ lancs: { data: string; tipo: Tipo; valor: number }[]; anosComErro: number[] }> {
  const faixas = new Map<number, [string, string]>()
  for (const { data } of linhas) {
    const ano = Number(data.slice(0, 4))
    if (ano === anoAberto) continue
    const f = faixas.get(ano)
    faixas.set(ano, f ? [data < f[0] ? data : f[0], data > f[1] ? data : f[1]] : [data, data])
  }
  const lancs: { data: string; tipo: Tipo; valor: number }[] = []
  const anosComErro: number[] = []
  await Promise.all([...faixas].map(async ([ano, [de, ate]]) => {
    try {
      const r = await lerTudo<{ id: string; data: string; tipo: Tipo; valor: number }>(() => supabase.from('lancamentos').select('id, data, tipo, valor').gte('data', de).lte('data', ate).order('id'))
      if (r.error) throw r.error
      lancs.push(...r.data.map((x) => ({ data: x.data, tipo: x.tipo, valor: Number(x.valor) })))
    } catch {
      anosComErro.push(ano)
    }
  }))
  return { lancs, anosComErro: anosComErro.sort() }
}

/** Todo PDF começa com "%PDF" (às vezes depois de alguns bytes de lixo, que os leitores toleram). */
export function pareceUmPdf(dados: ArrayBuffer) {
  return new TextDecoder('latin1').decode(dados.slice(0, 1024)).includes('%PDF-')
}
const pareceUmaPagina = (dados: ArrayBuffer) => /<(!doctype html|html|head|body)\b/i.test(new TextDecoder('latin1').decode(dados.slice(0, 2048)))

/** Texto de um arquivo: UTF-16 (com ou sem a marca no começo), UTF-8 e, com caracteres quebrados, Latin-1 (comum nos bancos). */
export function decodificar(dados: ArrayBuffer): string {
  const b = new Uint8Array(dados)
  if (b[0] === 0xff && b[1] === 0xfe) return new TextDecoder('utf-16le').decode(dados)
  if (b[0] === 0xfe && b[1] === 0xff) return new TextDecoder('utf-16be').decode(dados)
  // sem a marca: no UTF-16 um byte sim, um não é zero
  const amostra = b.subarray(0, 400)
  const zeros = (resto: number) => amostra.filter((x, i) => i % 2 === resto && x === 0).length
  if (amostra.length >= 8 && zeros(1) > amostra.length * 0.3) return new TextDecoder('utf-16le').decode(dados)
  if (amostra.length >= 8 && zeros(0) > amostra.length * 0.3) return new TextDecoder('utf-16be').decode(dados)
  try { return new TextDecoder('utf-8', { fatal: true }).decode(dados) } catch { return new TextDecoder('windows-1252').decode(dados) }
}

/** As tabelas de uma página HTML (o ".xls" que vários bancos exportam é uma página assim), linha por linha. */
export function tabelasDoHtml(html: string): string[][] {
  const limpa = (c: string) => entidades(c.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, '')).replace(/[\s\u00a0]+/g, ' ').trim()
  const linhas: string[][] = []
  for (const tr of html.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '').matchAll(/<tr\b[^>]*>([\s\S]*?)(?=<\/tr>|<tr\b|<\/table>|$)/gi)) {
    const celulas: string[] = []
    for (const c of tr[1].matchAll(/<t[dh]\b([^>]*)>([\s\S]*?)(?=<\/t[dh]>|<t[dh]\b|$)/gi)) {
      celulas.push(limpa(c[2]))
      // célula que ocupa várias colunas: as outras ficam vazias, para as colunas de baixo continuarem alinhadas
      const largura = Math.min(Number(/colspan\s*=\s*["']?(\d+)/i.exec(c[1])?.[1] ?? 1), 50)
      for (let k = 1; k < largura; k++) celulas.push('')
    }
    if (celulas.length) linhas.push(celulas)
  }
  return linhas
}

type Planilhas = typeof import('xlsx')

/**
 * As células de uma aba, como texto. Data vira AAAA-MM-DD pelo número que o Excel guarda (sem passar por fuso horário,
 * que em alguns aparelhos jogava o lançamento para a véspera) e número fica número ("-80.5": formatado perderia o jeito
 * de valor). As linhas e colunas vêm das células que existem, não do tamanho que a aba diz ter.
 */
function linhasDaAba(ws: import('xlsx').WorkSheet, XLSX: Planilhas): string[][] {
  const linhas: string[][] = []
  for (const ref in ws) {
    if (ref[0] === '!') continue
    const c = ws[ref] as import('xlsx').CellObject
    const { r, c: j } = XLSX.utils.decode_cell(ref)
    if (r > 50000 || j > 100 || c.v === undefined || c.v === null) continue
    let v = ''
    if (c.v instanceof Date) v = `${c.v.getUTCFullYear()}-${dois(c.v.getUTCMonth() + 1)}-${dois(c.v.getUTCDate())}`
    else if (c.t === 'n' && typeof c.v === 'number') {
      const d = c.z && XLSX.SSF.is_date(String(c.z)) && c.v >= 1 ? XLSX.SSF.parse_date_code(c.v) : null
      // só a hora (0,43) ou formato de data num número que não é data: fica o número
      v = d && d.y >= 1990 && d.y <= 2100 ? `${d.y}-${dois(d.m)}-${dois(d.d)}` : String(c.v)
    } else if (c.t !== 'e' && c.t !== 'z') v = String(c.v)
    if (!v.trim()) continue
    const linha = (linhas[r] ??= [])
    linha[j] = v
  }
  // as que não existem viram vazias (uma linha vazia separa uma tabela da outra)
  return Array.from(linhas, (l) => Array.from(l ?? [], (x) => x ?? ''))
}

/** O que o arquivo é de verdade, pelo começo dele: o nome engana (".xls" que é página, ".csv" que é planilha, ".txt" que é PDF). */
function especieDoArquivo(dados: ArrayBuffer, ext: string): 'pdf' | 'zip' | 'ole' | 'texto' {
  const b = new Uint8Array(dados.slice(0, 8))
  if (b[0] === 0x50 && b[1] === 0x4b && (b[2] === 3 || b[2] === 5)) return 'zip'
  if (b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0) return 'ole'
  // com outro nome, só é PDF se começa mesmo por "%PDF" (um texto pode citar "%PDF-" lá pelo meio)
  return pareceUmPdf(dados) && (ext === 'pdf' || new TextDecoder('latin1').decode(dados.slice(0, 1024)).indexOf('%PDF-') < 64) ? 'pdf' : 'texto'
}

/** Lê o arquivo do extrato e devolve os lançamentos encontrados (do mais antigo para o mais novo). */
export async function lerExtrato(arquivo: File, anoPadrao = new Date().getFullYear(), leitorDePdf?: LeitorDePdf): Promise<ExtratoLido> {
  const nome = arquivo.name.toLowerCase()
  const ext = nome.split('.').pop() ?? ''
  const dados = await arquivo.arrayBuffer()
  if (!dados.byteLength) throw new Error('Esse arquivo está vazio. Baixe o extrato de novo pelo app ou site do banco.')
  const especie = especieDoArquivo(dados, ext)
  let linhas: LinhaExtrato[] = []
  let formato = ext.toUpperCase()
  let cabecalho = ''
  /** o texto do arquivo, linha por linha (só para as pistas de quando nada é lido) */
  let textoTodo: string[] = []
  if (especie === 'pdf') {
    const pdf = lerPaginasPdf(await itensDoPdf(dados, leitorDePdf), anoPadrao)
    cabecalho = cabecalhoDe(pdf.texto)
    linhas = pdf.linhas
    textoTodo = pdf.texto
    formato = 'PDF'
  } else if (ext === 'pdf') {
    throw new Error(pareceUmaPagina(dados)
      ? 'Esse arquivo é uma página da internet salva com o nome .pdf, não o extrato. No app ou site do banco, use “Exportar” ou “Baixar PDF”.'
      : 'Esse arquivo não é um PDF de verdade (só o nome termina em .pdf). Baixe o extrato de novo pelo app do banco ou exporte em CSV, Excel ou OFX.')
  } else if (especie === 'zip' && (ext === 'docx' || (ext !== 'xlsx' && ext !== 'ods' && await lerDoZip(dados, 'word/document.xml').catch(() => null)))) {
    const w = await linhasDoWord(dados)
    cabecalho = cabecalhoDe(w.texto)
    linhas = w.tabela.length > 2 ? deTabela(w.tabela, anoPadrao) : []
    textoTodo = [...w.texto, ...w.tabela.map((r) => r.join('  '))]
    if (!linhas.length) linhas = deTexto(textoTodo, anoPadrao)
    formato = 'Word'
  } else if (especie === 'ole' && ext === 'doc') {
    throw new Error('Arquivos .doc antigos não dão para ler. Abra no Word e salve como .docx (ou exporte o extrato em PDF/CSV).')
  } else if (especie === 'zip' || especie === 'ole') {
    const XLSX = await import('xlsx')
    let wb: import('xlsx').WorkBook
    try {
      wb = XLSX.read(dados, { type: 'array', cellDates: false, cellNF: true, cellText: false })
    } catch (e) {
      if (/password|encrypt/i.test(String(e))) throw new Error('Essa planilha tem senha. Abra no Excel, salve sem senha e envie de novo (ou exporte o extrato em CSV).')
      throw new Error('Não consegui abrir essa planilha. Abra no Excel ou no Google Planilhas, salve de novo como .xlsx (ou .csv) e envie de novo.')
    }
    const folhas = wb.SheetNames.map((s) => linhasDaAba(wb.Sheets[s], XLSX))
    // a aba que rende mais lançamentos (não a mais comprida: pode ser um resumo ou uma lista de categorias)
    const melhor = folhas.map((f) => ({ f, l: deTabela(f, anoPadrao) })).sort((a, b) => b.l.length - a.l.length || b.f.length - a.f.length)[0]
    cabecalho = cabecalhoDe((melhor?.f ?? []).map((r) => r.join(' ')))
    linhas = melhor?.l ?? []
    textoTodo = (melhor?.f ?? []).map((r) => r.join('  '))
    formato = 'Excel'
  } else {
    // texto: OFX, página HTML (o ".xls" de vários bancos), CSV ou texto corrido
    const texto = decodificar(dados).replace(/^\ufeff/, '')
    if (/<OFX>|<STMTTRN>/i.test(texto)) { cabecalho = texto.split(/<STMTTRN>/i)[0].slice(0, 3000); linhas = deOfx(texto); textoTodo = texto.split(/\r\n|\r|\n/); formato = 'OFX' } else if (/<table\b/i.test(texto) && /<t[dh]\b/i.test(texto)) {
      const tabela = tabelasDoHtml(texto)
      cabecalho = cabecalhoDe(tabela.map((r) => r.join(' ')))
      linhas = deTabela(tabela, anoPadrao)
      textoTodo = tabela.map((r) => r.join('  '))
      formato = ext === 'xls' || ext === 'xlsx' ? 'Excel' : 'HTML'
    } else {
      const porLinha = texto.split(/\r\n|\r|\n/)
      textoTodo = porLinha
      cabecalho = cabecalhoDe(porLinha)
      // o separador (; , tab ou |) é o que rende mais lançamentos: a primeira linha pode ser um título e enganar
      for (const sep of separadoresDoCsv(texto)) {
        const t = lerCsv(texto, sep)
        const l = t.some((r) => r.length >= 3) ? deTabela(t, anoPadrao, { soTabela: true }) : []
        if (l.length > linhas.length) linhas = l
      }
      if (!linhas.length) linhas = deTexto(porLinha, anoPadrao)
      formato = ext === 'csv' ? 'CSV' : ext === 'xls' || ext === 'xlsx' ? 'Excel' : 'Texto'
    }
  }
  linhas.sort((a, b) => a.data.localeCompare(b.data))
  // as pistas só importam quando nada foi lido (contar linhas de um extrato grande à toa custaria tempo)
  const pistas = linhas.length ? { linhas: 0, comData: 0, comValor: 0, comDataEValor: 0, comprovante: false } : pistasDoTexto(textoTodo, anoPadrao)
  return { linhas, formato, banco: bancoDoExtrato(arquivo.name, cabecalho), pistas }
}
