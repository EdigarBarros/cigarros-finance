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
  { pessoa: true, re: /^(transf(erencia)?\.?\s+)?(pix\s+)?(recebid[oa]|recebimento)(\s+(pelo|via|por)\s+pix)?\s*(de|-|:)?\s*/, tipo: 'entrada', nome: (r) => r || 'Pix recebido' },
  { pessoa: true, re: /^(transf(erencia)?\.?\s+)?(pix\s+)?(enviad[oa]|envio)(\s+(pelo|via|por)\s+pix)?\s*(para|-|:)?\s*/, tipo: 'saida', nome: (r) => r || 'Pix enviado' },
  { pessoa: true, re: /^pix\s+de\s+/, tipo: 'entrada', nome: (r) => r || 'Pix recebido' },
  { pessoa: true, re: /^pix\s+para\s+/, tipo: 'saida', nome: (r) => r || 'Pix enviado' },
  { pessoa: true, re: /^(transferencia|transf\.?)\s+de\s+/, tipo: 'entrada', nome: (r) => r || 'Transferência recebida' },
  { pessoa: true, re: /^(transferencia|transf\.?)\s+para\s+/, tipo: 'saida', nome: (r) => r || 'Transferência enviada' },
  { pessoa: true, re: /^(ted|doc|transferencia|transf\.?)\s+recebid[oa]\s*(de|-|:)?\s*/, tipo: 'entrada', nome: (r) => r || 'Transferência recebida' },
  { pessoa: true, re: /^(ted|doc|transferencia|transf\.?)\s+enviad[oa]\s*(para|-|:)?\s*/, tipo: 'saida', nome: (r) => r || 'Transferência enviada' },
  { pessoa: true, re: /^pix\s*(transf(erencia)?\.?|qr[sc]?(\s*code)?|copia e cola|agendado)?\s*(-|:)?\s*/, nome: (r, t) => r || (t === 'entrada' ? 'Pix recebido' : 'Pix enviado') },
  { pessoa: true, re: /^(ted|doc|transferencia|transf\.?)\s*(-|:)?\s*/, nome: (r, t) => r || (t === 'entrada' ? 'Transferência recebida' : 'Transferência enviada') },
  { re: /^((pagamento|pgto|pag\.?)\s+(de\s+)?)?(boleto|titulo)\s*(-|:)?\s*/, tipo: 'saida', nome: (r) => r || 'Boleto' },
  { re: /^((pagamento|pgto)\s+(de\s+)?)?fatura\s*(do\s+cartao)?\s*(-|:)?\s*/, tipo: 'saida', nome: (r) => (r ? `Fatura ${r}` : 'Fatura do cartão') },
  { re: /^(compra (com |no |de )?cart[aã]o( de debito| de credito| deb| cred)?( mc| visa| elo)?|compra no debito|compra no credito|compra|debito|cartao)\s*(-|:|em)?\s*/, tipo: 'saida', nome: (r) => r || 'Compra' },
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
    .replace(/["“”]+/g, ' ') // Inter: Pix enviado: "Cp :60746948-FULANO"
    .replace(/\bcp\s*:\s*\d*\s*-?/gi, ' ')
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
  const { texto, ilegivel } = consertarTexto(bruta)
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
/** Dia que existe no calendário: 31/02 e 29/02 de ano comum não valem (o banco recusa a data e derruba o lote inteiro). */
const valida = (a: number, m: number, d: number) => m >= 1 && m <= 12 && d >= 1 && a >= 2000 && a <= 2100 && d <= new Date(Date.UTC(a, m, 0)).getUTCDate()

/**
 * Acha uma data no texto (vários formatos). `anoPadrao` para "12/10" e "12 out". Devolve a data, onde ela estava e, nas
 * que não trazem o ano, `semAno` (o ano é um palpite: ver `ajustarVirada`).
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
  m = t.match(/(^|\s)(\d{1,2})\/(\d{1,2})(\s|$)/)
  if (m && valida(anoPadrao, +m[3], +m[2])) return { data: `${anoPadrao}-${dois(+m[3])}-${dois(+m[2])}`, trecho: m[0].trim(), semAno: true }
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
 * Datas sem ano ("28/12", "03/01") ganham o ano aberto; num extrato que atravessa a virada do ano isso põe janeiro antes
 * de dezembro. Quando os meses dão a volta (dez → jan, ou jan → dez nos extratos que começam pelo mais novo), o que
 * vem depois da volta é do ano seguinte. `semAno` diz quais linhas tiveram a data adivinhada; as com ano escrito ficam.
 */
function ajustarVirada(linhas: LinhaExtrato[], semAno: boolean[]) {
  const ix = linhas.map((_, i) => i).filter((i) => semAno[i])
  if (ix.length < 2) return
  const mes = (i: number) => Number(linhas[i].data.slice(5, 7))
  const saltos = ix.slice(1).map((i, k) => mes(i) - mes(ix[k]))
  const adiante = saltos.some((d) => d <= -7) // dez → jan: o mais antigo vem primeiro
  const atras = saltos.some((d) => d >= 7) // jan → dez: o mais novo vem primeiro
  if (adiante === atras) return
  const poeAno = (i: number, mais: number) => { linhas[i].data = `${Number(linhas[i].data.slice(0, 4)) + mais}${linhas[i].data.slice(4)}` }
  let mais = 0
  if (adiante) {
    saltos.forEach((d, k) => { if (d <= -7) mais++; if (mais) poeAno(ix[k + 1], mais) })
  } else {
    for (let k = saltos.length - 1; k >= 0; k--) { if (saltos[k] >= 7) mais++; if (mais) poeAno(ix[k], mais) }
  }
}

/**
 * Valores em reais no texto, na ordem: "- R$ 1.234,56", "1234.56", "(50,00)", "30,00 D", "30,00 CR", "100,00D".
 * O "-" só é sinal quando está colado no número (ou antes do R$): o " - " com espaço dos dois lados é separador
 * ("15/10 PIX RECEBIDO MARIA - 1.200,00" é entrada).
 */
export function acharValores(s: string): { valor: number; sinal: -1 | 0 | 1; trecho: string }[] {
  // o número tem que estar inteiro: "51.365.272" (raiz de CNPJ) não pode virar R$ 51,36
  const re = /([-+−](?:\s*(?=r\$)|(?!\s)))?(r\$\s*)?(\(?)(?<![\d.,])(\d{1,3}(?:\.\d{3})+,\d{2}|\d+,\d{2}|\d{1,3}(?:,\d{3})+\.\d{2}|\d+\.\d{2})(?![\d.,]*\d)(\)?)([-+](?!\s*\d)|\s*(?:cr|db|d|c)(?![\w/.]))?/gi
  const lista: { valor: number; sinal: -1 | 0 | 1; trecho: string }[] = []
  for (const m of s.matchAll(re)) {
    const num = m[4]
    const br = /,\d{2}$/.test(num)
    const valor = Number(br ? num.replace(/\./g, '').replace(',', '.') : num.replace(/,/g, ''))
    if (!Number.isFinite(valor) || valor === 0) continue
    const fim = (m[6] ?? '').trim().toLowerCase()
    const sinal: -1 | 0 | 1 = m[1]?.match(/[-−]/) || (m[3] && m[5]) || fim === '-' || fim === 'd' || fim === 'db' ? -1 : m[1]?.includes('+') || fim === '+' || fim === 'c' || fim === 'cr' ? 1 : 0
    lista.push({ valor, sinal, trecho: m[0] })
  }
  return lista
}

// "Rem:" (remetente) e "Des:" (destinatário) são como o Bradesco diz de quem veio e para quem foi o Pix
const PISTA_ENTRADA = /recebid|recebimento|credito|deposito|estorno|rendimento|salario|reembolso|cashback|devolucao|entrada|\brem:/
const PISTA_SAIDA = /enviad|pagamento|pgto|compra|debito|saque|tarifa|boleto|fatura|envio|saida|transferencia para|\bdes:/
const IGNORAR = /^(data\b|lancamentos?\b|periodo|extrato|movimentac)/
/** O que vem depois de "Saldo"/"Total" nas linhas de resumo ("Saldo do dia", "Total da fatura"). */
const RESUMO_DEPOIS = /^((do|da|de|dos|das)\s+(dia|mes|periodo|fatura|conta|extrato|cartao|compras|pagamentos|lancamentos|entradas|saidas|creditos|debitos|despesas|receitas|limite|investimentos|aplicacoes)|anterior|final|inicial|atual|disponivel|bloqueado|parcial|geral|liquido|bruto|em\s+(conta|c\/?c)|apos|a\s+(pagar|receber)|pago|devedor|credor|fatura|compras|entradas|saidas|creditos|debitos|despesas|receitas|gastos?|lancamentos|pagamentos|periodo|mes|dia|conta|limite|cartao|c\/c|cc|invest\w*|aplica\w*|poupanca)\b/

/**
 * Linha de resumo do extrato, que não é lançamento: "Saldo", "Saldo do dia", "Total da fatura", cabeçalho, período.
 * "Saldo"/"Total" sozinhos ou seguidos de número ou de uma palavra de resumo; "Saldo Farma", "Total Express" e
 * "TotalPass" são lojas e seguem como lançamento.
 */
function ehResumo(n: string) {
  if (/^limite (total|disponivel|de credito|utilizado|da conta)\b|^(opening|closing|beginning|ending|previous|available|current|starting) balance\b|^balance (brought|carried) forward\b|^saldo (inicial|final|anterior)\b/.test(n.trim())) return true
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

const RUIDO_DE_PAGINA = /\bpagina\s+\d+\s*(de|\/)\s*\d+|\bpag\.?\s*\d+\s*(de|\/)\s*\d+|\bouvidoria\b|\bsac\b|\b0800\b|\bcnpj\b|\bwww\.|https?:|\S+@\S+\.\w+|\bfale conosco|\bcentral de (atendimento|relacionamento)|\bdeficiente (auditivo|de fala)|\btel(efone)?s?\.?:?\s*\(?\d|\(\d{2}\)\s*\d{4,5}-?\d{4}/

/**
 * Linhas de texto → lançamentos. Uma linha com data e valor é um lançamento; linha só com data vira o dia dos
 * próximos (extratos que agrupam por dia); linha sem data nem valor logo depois de um lançamento completa a descrição
 * dele (nome quebrado em duas linhas).
 */
export function deTexto(linhas: string[], anoPadrao: number): LinhaExtrato[] {
  const mesPrimeiro = mesVemPrimeiro(linhas)
  // fatura de cartão: a compra vem sem sinal (é gasto) e o que vem com menos é pagamento ou estorno (entrou no cartão)
  const topo = normal(linhas.slice(0, 40).join(' '))
  const ehFatura = /\bfatura\b/.test(topo) && /\bvencimento\b/.test(topo)
  /** "Total de entradas" / "Total de saídas" (Nubank): as linhas de baixo, até o próximo total ou dia, são desse tipo. */
  let secao: 1 | -1 | null = null
  const saida: LinhaExtrato[] = []
  /** Para cada linha de `saida`: a data veio sem ano (ver `ajustarVirada`). */
  const semAno: boolean[] = []
  let diaAtual: string | null = null
  let diaSemAno = false
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
    const d = acharData(linha, anoPadrao, mesPrimeiro)
    const valores = acharValores(linha)
    // rodapé e cabeçalho de página ("Página 1 de 3", "Ouvidoria 0800…", CNPJ, site): nem lançamento, nem continuação de nome
    if (!valores.length && RUIDO_DE_PAGINA.test(n)) continue
    // a descrição sem a data e os valores: é ela que diz se a linha é um resumo ("Saldo do dia") ou uma loja ("Saldo Farma")
    const semDataEValor = [d?.trecho, ...valores.map((v) => v.trecho)].reduce<string>((x, t) => (t ? x.replace(t.toLowerCase(), ' ') : x), n).replace(/\s+/g, ' ').trim()
    if (!valores.length && CABECALHO_DE_PAGINA.test(semDataEValor)) { ultimo = null; continue }
    if (ehResumo(n) || ehResumo(semDataEValor) || /\bsaldo\b/.test(n) && !/^(saldo|total)\b/.test(semDataEValor) && valores.length <= 1 && !/pix|transf|compra|pagamento/.test(n)) {
      const resumo = semDataEValor.replace(/[^a-z/ ]/g, ' ').replace(/\s+/g, ' ').trim()
      if (valores.length === 1 && SALDO_DA_CONTA.test(resumo)) saldos.push({ antes: saida.length, depois: saida.length, valor: comSinal(valores[0]) })
      // "01 OUT 2026  Total de entradas" e "1 de Outubro  Saldo do dia": o dia dos lançamentos de baixo
      // (só quando a data abre a linha: "Data de vencimento: 10 NOV" não é dia de lançamento)
      if (d && n.startsWith(d.trecho)) { diaAtual = d.data; diaSemAno = Boolean(d.semAno); secao = null }
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
      if (resto.replace(/[^A-Za-zÀ-ÿ]/g, '').length < 4) { diaAtual = d.data; diaSemAno = Boolean(d.semAno); ultimo = null; pendente = null; secao = null; continue }
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
      if (d) { diaAtual = d.data; diaSemAno = Boolean(d.semAno) }
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
  ajustarVirada(saida, semAno)
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
  tipo: /^(tipo|natureza|d\/c|c\/d|e\/s|dc|cd|operacao|movimentacao|entrada\/saida|credito\/debito|debito\/credito|type|dr\/cr|cr\/dr|sinal)( de (transacao|lancamento|movimentacao|operacao))?$/,
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
function lerLinhasDaTabela(corpo: string[][], col: Colunas, cab: string[], anoPadrao: number): LinhaExtrato[] {
  // Coluna de valor com sinal (as saídas vêm negativas): nela, o valor sem sinal é entrada. Sem nenhum negativo na coluna,
  // o número sozinho não diz nada e quem decide é a coluna "Tipo", o saldo ou o texto da linha.
  const colComSinal = col.valor !== undefined && corpo.some((r) => valorDaCelula(r[col.valor!] ?? '')?.sinal === -1)
  // Fatura de cartão (Nubank: date,category,title,amount): a compra vem positiva e o pagamento ("Pagamento recebido")
  // negativo, o contrário do extrato de conta; vale o cabeçalho do Nubank ou um "Pagamento recebido" com valor negativo.
  const nomes = cab.map(nomeDeColuna)
  const textoDaLinha = (r: string[]) => normal(col.desc !== undefined ? r[col.desc] ?? '' : r.join(' '))
  const fatura = col.valor !== undefined && col.saldo === undefined && (
    ['date', 'category', 'title', 'amount'].every((h) => nomes.includes(h)) ||
    corpo.some((r) => valorDaCelula(r[col.valor!] ?? '')?.sinal === -1 && /^pagamento recebido/.test(textoDaLinha(r)))
  )
  // a categoria do cartão ("restaurante") não é parte do nome
  const colCategoria = nomes.findIndex((c) => /^(category|categoria)$/.test(c))
  const usadas = new Set([col.data, col.valor, col.credito, col.debito, col.tipo, col.saldo, col.doc, colCategoria >= 0 ? colCategoria : undefined].filter((x) => x !== undefined))
  // outras colunas de texto, menos as que são código (sem espaço, com número: "abc-123", ids), na ordem das colunas,
  // para "Pix recebido" + "Fulano" virar "Pix de Fulano" (Inter: "Histórico" + "Descrição")
  const ehTexto = (c: string) => c && /[A-Za-zÀ-ÿ]/.test(c) && !acharData(c, anoPadrao) && !(/\d/.test(c) && !/\s/.test(c.trim()))
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
    const d = col.data !== undefined ? acharData(r[col.data] ?? '', anoPadrao, mesPrimeiro) : null
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
    if (fatura && sinal === 1 && /^pagamento recebido/.test(normal(texto))) Object.assign(l, { pagamentoDaFatura: true, revisar: l.revisar ?? 'pagamento da fatura: já está no extrato da conta' })
    if (col.saldo !== undefined) { const s = valorComSinal(r[col.saldo] ?? ''); if (s !== null) saldos.push({ antes: saida.length + 1, depois: saida.length, valor: s }) }
    saida.push(l)
    semAno.push(Boolean(data.semAno))
    fontes.push({ bruta: texto, sinal: sinal || (extraTipo === 'entrada' ? 1 : extraTipo === 'saida' ? -1 : 0) })
    ultimo = saida.length - 1
  }
  tipoPeloSaldo(saida, fontes, saldos)
  ajustarVirada(saida, semAno)
  return saida
}

/** Linhas de uma tabela → lançamentos. Acha o cabeçalho (ou adivinha as colunas pelo conteúdo). */
export function deTabela(linhas: string[][], anoPadrao: number): LinhaExtrato[] {
  const rows = linhas.map((r) => r.map((c) => String(c ?? '').trim())).filter((r) => r.some(Boolean))
  if (!rows.length) return []
  for (let i = 0; i < Math.min(rows.length, 40); i++) {
    const col = colunasDoCabecalho(rows[i])
    if (col) return lerLinhasDaTabela(rows.slice(i + 1), col, rows[i], anoPadrao)
  }
  const col = colunasPeloConteudo(rows, anoPadrao)
  return col ? lerLinhasDaTabela(rows, col, [], anoPadrao) : deTexto(rows.map((r) => r.join('  ')), anoPadrao)
}

/** CSV com aspas e separador adivinhado (; , ou tab), ou o separador dado. */
export function lerCsv(texto: string, separador?: string): string[][] {
  const primeira = texto.split(/\r?\n/).find((l) => l.trim()) ?? ''
  const sep = separador ?? [';', '\t', ','].sort((a, b) => primeira.split(b).length - primeira.split(a).length)[0]
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
  for (const m of texto.matchAll(/<STMTTRN>([\s\S]*?)(<\/STMTTRN>|(?=<STMTTRN>)|<\/BANKTRANLIST>)/gi)) {
    const b = m[1]
    const d = campo(b, 'DTPOSTED')
    const v = numeroOfx(campo(b, 'TRNAMT'))
    if (d.length < 8 || !v) continue
    const desc = [campo(b, 'NAME'), campo(b, 'MEMO')].filter(Boolean).join(' - ')
    saida.push(montar(`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`, desc, v, v < 0 ? -1 : 1))
  }
  return saida
}

// ---------- arquivos ----------

/** Leitor de PDF (pdf.js), baixado só quando alguém importa um PDF. */
const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168'

export interface ItemTexto { str: string; transform: number[]; width: number; height?: number }

/** Um pedaço de texto do PDF e onde ele está na página (x da esquerda, y de baixo para cima, largura e altura da letra). */
export interface ItemPdf { str: string; x: number; y: number; w: number; h: number }

/** Os pedaços de texto de cada página do PDF (pdf.js). */
async function itensDoPdf(dados: ArrayBuffer): Promise<ItemPdf[][]> {
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
  const paginas: ItemPdf[][] = []
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const { items } = await page.getTextContent()
    paginas.push(itensDaPagina(items))
  }
  return paginas
}

/** Os pedaços de uma página como o pdf.js entrega (`getTextContent().items`) → texto e posição. */
export function itensDaPagina(items: ItemTexto[]): ItemPdf[] {
  return items.filter((it) => it.str?.trim()).map((it) => ({
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
      linhas.push(juntos)
    }
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
const PALAVRA_VALOR = /^[-+−(]?(r\$)?[-+−]?\(?(\d{1,3}(\.\d{3})+,\d{2}|\d+,\d{2}|\d{1,3}(,\d{3})+\.\d{2}|\d+\.\d{2})\)?[-+]?$/i
/** O que gruda num valor: "R$" e "-" antes, "D", "C", "CR", "DB" e "-" depois. */
const ANTES_DO_VALOR = /^(r\$|[-+−])$/i
const DEPOIS_DO_VALOR = /^(d|c|cr|db|dr|[-+])$/i

/**
 * Uma linha do PDF em pedaços: cada palavra ganha a posição dela (proporcional dentro do trecho que o pdf.js entregou);
 * palavras vizinhas da mesma espécie se juntam, e um vão maior que uma letra e meia separa colunas. Uma data colada no
 * fim de um texto ("PASTELLOCO 01/10") fica no texto.
 */
function pedacosDaLinha(itens: ItemPdf[]): Pedaco[] {
  const palavras: { texto: string; x0: number; x1: number; letra: number }[] = []
  for (const it of itens) {
    const str = it.str
    const letra = str.length ? (it.w || str.length * it.h * 0.5) / str.length : it.h * 0.5
    for (const m of str.matchAll(/\S+/g)) palavras.push({ texto: m[0], x0: it.x + m.index * letra, x1: it.x + (m.index + m[0].length) * letra, letra })
  }
  const pedacos: Pedaco[] = []
  for (let i = 0; i < palavras.length; i++) {
    const p = palavras[i]
    const ant = pedacos[pedacos.length - 1]
    const perto = ant && p.x0 - ant.x1 <= p.letra * 1.5
    let tipo: Pedaco['tipo'] = PALAVRA_DATA.test(p.texto) ? 'data' : PALAVRA_VALOR.test(p.texto) ? 'valor' : 'texto'
    // "R$ 1.234,56", "- 500,00", "114,00 D"
    if (tipo === 'texto' && ANTES_DO_VALOR.test(p.texto) && palavras[i + 1] && PALAVRA_VALOR.test(palavras[i + 1].texto) && palavras[i + 1].x0 - p.x1 <= p.letra * 1.5) {
      const prox = palavras[++i]
      pedacos.push({ texto: `${p.texto}${p.texto.length > 1 ? ' ' : ''}${prox.texto}`, x0: p.x0, x1: prox.x1, tipo: 'valor', letra: p.letra })
      continue
    }
    if (perto && ant.tipo === 'valor' && tipo === 'texto' && DEPOIS_DO_VALOR.test(p.texto)) { ant.texto += ` ${p.texto}`; ant.x1 = p.x1; continue }
    if (perto && ant.tipo === 'texto' && tipo === 'data') tipo = 'texto'
    if (perto && ant.tipo === 'texto' && tipo === 'texto') { ant.texto += ` ${p.texto}`; ant.x1 = p.x1; continue }
    // data seguida de horário ou de texto colado ("01/10 10:12 Fulano"): fica junto, quem decide é a coluna
    if (perto && ant.tipo === 'data' && tipo === 'texto') { ant.texto += ` ${p.texto}`; ant.x1 = p.x1; ant.tipo = 'texto'; continue }
    pedacos.push({ texto: p.texto, x0: p.x0, x1: p.x1, tipo, letra: p.letra })
  }
  return pedacos
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
 * PDF com tabela (Data | Histórico | Crédito | Débito | Saldo): cada número vai para a coluna embaixo da qual está, então
 * dá para saber se é crédito, débito, valor ou saldo, coisa que o texto corrido perde. O cabeçalho é procurado de novo em
 * cada página; as linhas fora da tabela (título, rodapé, aviso do banco) separam os lançamentos e não viram nome.
 */
function dePdfPelasColunas(linhas: ItemPdf[][], anoPadrao: number): LinhaExtrato[] {
  /** As colunas da página atual (onde cada uma está) e, para cada uma, a posição dela na tabela da primeira página. */
  let cols: ColunaPdf[] | null = null
  let mapa: number[] = []
  let nomes: string[] | null = null
  const tabela: string[][] = []
  for (const itens of linhas) {
    const pedacos = pedacosDaLinha(itens)
    if (!pedacos.length) continue
    // cabeçalho: só texto, com a data e algum valor entre os nomes
    if (pedacos.every((p) => p.tipo === 'texto') && colunasDoCabecalho(pedacos.map((p) => p.texto))) {
      cols = pedacos.map((p) => ({ nome: p.texto, chave: chaveDaColuna(p.texto), x0: p.x0, x1: p.x1 }))
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
      if (p.tipo === 'texto' && cols[j].chave === 'data' && !acharData(p.texto, anoPadrao)) j = desc >= 0 ? desc : j
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
  return col ? lerLinhasDaTabela(tabela, col, nomes, anoPadrao) : []
}

/**
 * PDF já aberto (os pedaços de cada página) → lançamentos e o texto corrido (para achar o banco no cabeçalho). Lê pelas
 * colunas quando o PDF tem uma tabela com cabeçalho, e pelo texto corrido quando não tem (ou quando as colunas acharam
 * bem menos lançamentos que o texto).
 */
export function lerPaginasPdf(paginas: ItemPdf[][], anoPadrao: number): { linhas: LinhaExtrato[]; texto: string[] } {
  const linhas = linhasDasPaginas(paginas)
  const texto = linhas.map(textoDaLinhaPdf)
  const peloTexto = deTexto(texto, anoPadrao)
  const pelasColunas = dePdfPelasColunas(linhas, anoPadrao)
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

/** Lê o arquivo do extrato e devolve os lançamentos encontrados (do mais antigo para o mais novo). */
export async function lerExtrato(arquivo: File, anoPadrao = new Date().getFullYear()): Promise<ExtratoLido> {
  const nome = arquivo.name.toLowerCase()
  const ext = nome.split('.').pop() ?? ''
  const dados = await arquivo.arrayBuffer()
  let linhas: LinhaExtrato[] = []
  let formato = ext.toUpperCase()
  let cabecalho = ''
  if (ext === 'pdf') {
    const pdf = lerPaginasPdf(await itensDoPdf(dados), anoPadrao)
    cabecalho = cabecalhoDe(pdf.texto)
    linhas = pdf.linhas
  } else if (ext === 'docx') {
    const w = await linhasDoWord(dados)
    cabecalho = cabecalhoDe(w.texto)
    linhas = w.tabela.length > 2 ? deTabela(w.tabela, anoPadrao) : []
    if (!linhas.length) linhas = deTexto([...w.texto, ...w.tabela.map((r) => r.join('  '))], anoPadrao)
    formato = 'Word'
  } else if (ext === 'xlsx' || ext === 'xls' || ext === 'ods') {
    const XLSX = await import('xlsx')
    const wb = XLSX.read(dados, { type: 'array', cellDates: true })
    // células cruas: data vira AAAA-MM-DD e número fica número (formatado, "-80.5" perderia o jeito de valor)
    const celula = (v: unknown) => (v instanceof Date ? `${v.getFullYear()}-${dois(v.getMonth() + 1)}-${dois(v.getDate())}` : String(v ?? ''))
    const folhas = wb.SheetNames.map((s) => XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[s], { header: 1, raw: true, defval: '' }).map((r) => r.map(celula)))
    // a aba que rende mais lançamentos (não a mais comprida: pode ser um resumo ou uma lista de categorias)
    const melhor = folhas.map((f) => ({ f, l: deTabela(f, anoPadrao) })).sort((a, b) => b.l.length - a.l.length || b.f.length - a.f.length)[0]
    cabecalho = cabecalhoDe((melhor?.f ?? []).map((r) => r.join(' ')))
    linhas = melhor?.l ?? []
    formato = 'Excel'
  } else if (ext === 'doc') {
    throw new Error('Arquivos .doc antigos não dão para ler. Abra no Word e salve como .docx (ou exporte o extrato em PDF/CSV).')
  } else {
    // CSV, TXT, OFX: texto (tenta UTF-8 e, com caracteres quebrados, Latin-1, comum nos bancos)
    let texto: string
    try { texto = new TextDecoder('utf-8', { fatal: true }).decode(dados) } catch { texto = new TextDecoder('windows-1252').decode(dados) }
    if (/<OFX>|<STMTTRN>/i.test(texto)) { cabecalho = texto.split(/<STMTTRN>/i)[0].slice(0, 3000); linhas = deOfx(texto); formato = 'OFX' } else {
      cabecalho = cabecalhoDe(texto.split(/\r?\n/))
      const tabela = lerCsv(texto)
      linhas = tabela.some((r) => r.length >= 3) ? deTabela(tabela, anoPadrao) : []
      // o separador da primeira linha pode enganar (título antes da tabela): tenta os outros
      if (!linhas.length) {
        for (const sep of [';', ',', '\t']) {
          const t = lerCsv(texto, sep)
          const l = t.some((r) => r.length >= 3) ? deTabela(t, anoPadrao) : []
          if (l.length > linhas.length) linhas = l
        }
      }
      if (!linhas.length) linhas = deTexto(texto.split(/\r?\n/), anoPadrao)
      formato = ext === 'csv' ? 'CSV' : 'Texto'
    }
  }
  linhas.sort((a, b) => a.data.localeCompare(b.data))
  return { linhas, formato, banco: bancoDoExtrato(arquivo.name, cabecalho) }
}
