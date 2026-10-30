import { useSyncExternalStore } from 'react'

/**
 * Troca de idioma do site inteiro. O app é escrito em português; os outros idiomas vêm da tradução automática do Google
 * (o mesmo tradutor do Chrome), que cobre mais de cem idiomas sem precisarmos manter um texto para cada um.
 *
 * Como funciona: a escolha fica no cookie `googtrans` (o formato que o tradutor do Google lê: "/pt/en"). Com um idioma
 * escolhido, carregamos o script do Google, que traduz a página e continua traduzindo o que aparece depois. A barra e os
 * balões do Google ficam escondidos (index.css); quem troca o idioma é o nosso botão (components/BotaoIdioma.tsx).
 * Voltar ao português apaga o cookie e recarrega a página, que é o único jeito garantido de desfazer a tradução.
 */

export const ORIGINAL = 'pt'

/** código do Google, nome no próprio idioma, nome em inglês e em português (os três servem para a busca do menu) */
export type Idioma = { codigo: string; nativo: string; ingles: string; portugues: string }

export const IDIOMAS: Idioma[] = [
  { codigo: 'pt', nativo: 'Português', ingles: 'Portuguese', portugues: 'Português' },
  { codigo: 'en', nativo: 'English', ingles: 'English', portugues: 'Inglês' },
  { codigo: 'es', nativo: 'Español', ingles: 'Spanish', portugues: 'Espanhol' },
  { codigo: 'fr', nativo: 'Français', ingles: 'French', portugues: 'Francês' },
  { codigo: 'de', nativo: 'Deutsch', ingles: 'German', portugues: 'Alemão' },
  { codigo: 'it', nativo: 'Italiano', ingles: 'Italian', portugues: 'Italiano' },
  { codigo: 'zh-CN', nativo: '中文（简体）', ingles: 'Chinese (Simplified)', portugues: 'Chinês (simplificado)' },
  { codigo: 'zh-TW', nativo: '中文（繁體）', ingles: 'Chinese (Traditional)', portugues: 'Chinês (tradicional)' },
  { codigo: 'hi', nativo: 'हिन्दी', ingles: 'Hindi', portugues: 'Híndi' },
  { codigo: 'ar', nativo: 'العربية', ingles: 'Arabic', portugues: 'Árabe' },
  { codigo: 'bn', nativo: 'বাংলা', ingles: 'Bengali', portugues: 'Bengali' },
  { codigo: 'ru', nativo: 'Русский', ingles: 'Russian', portugues: 'Russo' },
  { codigo: 'ja', nativo: '日本語', ingles: 'Japanese', portugues: 'Japonês' },
  { codigo: 'ko', nativo: '한국어', ingles: 'Korean', portugues: 'Coreano' },
  { codigo: 'id', nativo: 'Bahasa Indonesia', ingles: 'Indonesian', portugues: 'Indonésio' },
  { codigo: 'tr', nativo: 'Türkçe', ingles: 'Turkish', portugues: 'Turco' },
  { codigo: 'vi', nativo: 'Tiếng Việt', ingles: 'Vietnamese', portugues: 'Vietnamita' },
  { codigo: 'ur', nativo: 'اردو', ingles: 'Urdu', portugues: 'Urdu' },
  { codigo: 'fa', nativo: 'فارسی', ingles: 'Persian', portugues: 'Persa' },
  { codigo: 'pl', nativo: 'Polski', ingles: 'Polish', portugues: 'Polonês' },
  { codigo: 'uk', nativo: 'Українська', ingles: 'Ukrainian', portugues: 'Ucraniano' },
  { codigo: 'nl', nativo: 'Nederlands', ingles: 'Dutch', portugues: 'Holandês' },
  { codigo: 'th', nativo: 'ไทย', ingles: 'Thai', portugues: 'Tailandês' },
  { codigo: 'sw', nativo: 'Kiswahili', ingles: 'Swahili', portugues: 'Suaíli' },
  { codigo: 'ta', nativo: 'தமிழ்', ingles: 'Tamil', portugues: 'Tâmil' },
  { codigo: 'te', nativo: 'తెలుగు', ingles: 'Telugu', portugues: 'Telugo' },
  { codigo: 'mr', nativo: 'मराठी', ingles: 'Marathi', portugues: 'Marati' },
  { codigo: 'gu', nativo: 'ગુજરાતી', ingles: 'Gujarati', portugues: 'Guzerate' },
  { codigo: 'kn', nativo: 'ಕನ್ನಡ', ingles: 'Kannada', portugues: 'Canarês' },
  { codigo: 'ml', nativo: 'മലയാളം', ingles: 'Malayalam', portugues: 'Malaiala' },
  { codigo: 'pa', nativo: 'ਪੰਜਾਬੀ', ingles: 'Punjabi', portugues: 'Punjabi' },
  { codigo: 'or', nativo: 'ଓଡ଼ିଆ', ingles: 'Odia', portugues: 'Oriá' },
  { codigo: 'ne', nativo: 'नेपाली', ingles: 'Nepali', portugues: 'Nepalês' },
  { codigo: 'si', nativo: 'සිංහල', ingles: 'Sinhala', portugues: 'Cingalês' },
  { codigo: 'ms', nativo: 'Bahasa Melayu', ingles: 'Malay', portugues: 'Malaio' },
  { codigo: 'tl', nativo: 'Filipino', ingles: 'Filipino', portugues: 'Filipino' },
  { codigo: 'my', nativo: 'မြန်မာ', ingles: 'Burmese', portugues: 'Birmanês' },
  { codigo: 'km', nativo: 'ខ្មែរ', ingles: 'Khmer', portugues: 'Khmer' },
  { codigo: 'lo', nativo: 'ລາວ', ingles: 'Lao', portugues: 'Laosiano' },
  { codigo: 'iw', nativo: 'עברית', ingles: 'Hebrew', portugues: 'Hebraico' },
  { codigo: 'el', nativo: 'Ελληνικά', ingles: 'Greek', portugues: 'Grego' },
  { codigo: 'ro', nativo: 'Română', ingles: 'Romanian', portugues: 'Romeno' },
  { codigo: 'hu', nativo: 'Magyar', ingles: 'Hungarian', portugues: 'Húngaro' },
  { codigo: 'cs', nativo: 'Čeština', ingles: 'Czech', portugues: 'Tcheco' },
  { codigo: 'sk', nativo: 'Slovenčina', ingles: 'Slovak', portugues: 'Eslovaco' },
  { codigo: 'sv', nativo: 'Svenska', ingles: 'Swedish', portugues: 'Sueco' },
  { codigo: 'no', nativo: 'Norsk', ingles: 'Norwegian', portugues: 'Norueguês' },
  { codigo: 'da', nativo: 'Dansk', ingles: 'Danish', portugues: 'Dinamarquês' },
  { codigo: 'fi', nativo: 'Suomi', ingles: 'Finnish', portugues: 'Finlandês' },
  { codigo: 'is', nativo: 'Íslenska', ingles: 'Icelandic', portugues: 'Islandês' },
  { codigo: 'bg', nativo: 'Български', ingles: 'Bulgarian', portugues: 'Búlgaro' },
  { codigo: 'sr', nativo: 'Српски', ingles: 'Serbian', portugues: 'Sérvio' },
  { codigo: 'hr', nativo: 'Hrvatski', ingles: 'Croatian', portugues: 'Croata' },
  { codigo: 'bs', nativo: 'Bosanski', ingles: 'Bosnian', portugues: 'Bósnio' },
  { codigo: 'sl', nativo: 'Slovenščina', ingles: 'Slovenian', portugues: 'Esloveno' },
  { codigo: 'mk', nativo: 'Македонски', ingles: 'Macedonian', portugues: 'Macedônio' },
  { codigo: 'sq', nativo: 'Shqip', ingles: 'Albanian', portugues: 'Albanês' },
  { codigo: 'lt', nativo: 'Lietuvių', ingles: 'Lithuanian', portugues: 'Lituano' },
  { codigo: 'lv', nativo: 'Latviešu', ingles: 'Latvian', portugues: 'Letão' },
  { codigo: 'et', nativo: 'Eesti', ingles: 'Estonian', portugues: 'Estoniano' },
  { codigo: 'be', nativo: 'Беларуская', ingles: 'Belarusian', portugues: 'Bielorrusso' },
  { codigo: 'ka', nativo: 'ქართული', ingles: 'Georgian', portugues: 'Georgiano' },
  { codigo: 'hy', nativo: 'Հայերեն', ingles: 'Armenian', portugues: 'Armênio' },
  { codigo: 'az', nativo: 'Azərbaycanca', ingles: 'Azerbaijani', portugues: 'Azerbaijano' },
  { codigo: 'kk', nativo: 'Қазақ тілі', ingles: 'Kazakh', portugues: 'Cazaque' },
  { codigo: 'uz', nativo: 'Oʻzbekcha', ingles: 'Uzbek', portugues: 'Uzbeque' },
  { codigo: 'ky', nativo: 'Кыргызча', ingles: 'Kyrgyz', portugues: 'Quirguiz' },
  { codigo: 'tg', nativo: 'Тоҷикӣ', ingles: 'Tajik', portugues: 'Tadjique' },
  { codigo: 'tk', nativo: 'Türkmen', ingles: 'Turkmen', portugues: 'Turcomeno' },
  { codigo: 'mn', nativo: 'Монгол', ingles: 'Mongolian', portugues: 'Mongol' },
  { codigo: 'ps', nativo: 'پښتو', ingles: 'Pashto', portugues: 'Pashto' },
  { codigo: 'ku', nativo: 'Kurdî', ingles: 'Kurdish', portugues: 'Curdo' },
  { codigo: 'am', nativo: 'አማርኛ', ingles: 'Amharic', portugues: 'Amárico' },
  { codigo: 'ha', nativo: 'Hausa', ingles: 'Hausa', portugues: 'Hauçá' },
  { codigo: 'yo', nativo: 'Yorùbá', ingles: 'Yoruba', portugues: 'Iorubá' },
  { codigo: 'ig', nativo: 'Igbo', ingles: 'Igbo', portugues: 'Igbo' },
  { codigo: 'zu', nativo: 'isiZulu', ingles: 'Zulu', portugues: 'Zulu' },
  { codigo: 'xh', nativo: 'isiXhosa', ingles: 'Xhosa', portugues: 'Xhosa' },
  { codigo: 'af', nativo: 'Afrikaans', ingles: 'Afrikaans', portugues: 'Africâner' },
  { codigo: 'so', nativo: 'Soomaali', ingles: 'Somali', portugues: 'Somali' },
  { codigo: 'rw', nativo: 'Kinyarwanda', ingles: 'Kinyarwanda', portugues: 'Quiniaruanda' },
  { codigo: 'mg', nativo: 'Malagasy', ingles: 'Malagasy', portugues: 'Malgaxe' },
  { codigo: 'ny', nativo: 'Chichewa', ingles: 'Chichewa', portugues: 'Chichewa' },
  { codigo: 'sn', nativo: 'chiShona', ingles: 'Shona', portugues: 'Shona' },
  { codigo: 'st', nativo: 'Sesotho', ingles: 'Sesotho', portugues: 'Sesoto' },
  { codigo: 'ht', nativo: 'Kreyòl ayisyen', ingles: 'Haitian Creole', portugues: 'Crioulo haitiano' },
  { codigo: 'ca', nativo: 'Català', ingles: 'Catalan', portugues: 'Catalão' },
  { codigo: 'gl', nativo: 'Galego', ingles: 'Galician', portugues: 'Galego' },
  { codigo: 'eu', nativo: 'Euskara', ingles: 'Basque', portugues: 'Basco' },
  { codigo: 'cy', nativo: 'Cymraeg', ingles: 'Welsh', portugues: 'Galês' },
  { codigo: 'ga', nativo: 'Gaeilge', ingles: 'Irish', portugues: 'Irlandês' },
  { codigo: 'gd', nativo: 'Gàidhlig', ingles: 'Scottish Gaelic', portugues: 'Gaélico escocês' },
  { codigo: 'lb', nativo: 'Lëtzebuergesch', ingles: 'Luxembourgish', portugues: 'Luxemburguês' },
  { codigo: 'mt', nativo: 'Malti', ingles: 'Maltese', portugues: 'Maltês' },
  { codigo: 'fy', nativo: 'Frysk', ingles: 'Frisian', portugues: 'Frísio' },
  { codigo: 'co', nativo: 'Corsu', ingles: 'Corsican', portugues: 'Corso' },
  { codigo: 'eo', nativo: 'Esperanto', ingles: 'Esperanto', portugues: 'Esperanto' },
  { codigo: 'la', nativo: 'Latina', ingles: 'Latin', portugues: 'Latim' },
  { codigo: 'yi', nativo: 'ייִדיש', ingles: 'Yiddish', portugues: 'Iídiche' },
  { codigo: 'jw', nativo: 'Basa Jawa', ingles: 'Javanese', portugues: 'Javanês' },
  { codigo: 'su', nativo: 'Basa Sunda', ingles: 'Sundanese', portugues: 'Sundanês' },
  { codigo: 'ceb', nativo: 'Cebuano', ingles: 'Cebuano', portugues: 'Cebuano' },
  { codigo: 'hmn', nativo: 'Hmoob', ingles: 'Hmong', portugues: 'Hmong' },
  { codigo: 'haw', nativo: 'ʻŌlelo Hawaiʻi', ingles: 'Hawaiian', portugues: 'Havaiano' },
  { codigo: 'mi', nativo: 'Te Reo Māori', ingles: 'Maori', portugues: 'Maori' },
  { codigo: 'sm', nativo: 'Gagana Samoa', ingles: 'Samoan', portugues: 'Samoano' },
  { codigo: 'sd', nativo: 'سنڌي', ingles: 'Sindhi', portugues: 'Sindi' },
  { codigo: 'ug', nativo: 'ئۇيغۇرچە', ingles: 'Uyghur', portugues: 'Uigur' },
  { codigo: 'tt', nativo: 'Татарча', ingles: 'Tatar', portugues: 'Tártaro' },
  { codigo: 'qu', nativo: 'Runa Simi', ingles: 'Quechua', portugues: 'Quíchua' },
  { codigo: 'gn', nativo: 'Avañeʼẽ', ingles: 'Guarani', portugues: 'Guarani' },
  { codigo: 'ay', nativo: 'Aymar aru', ingles: 'Aymara', portugues: 'Aimará' },
]

const porCodigo = new Map(IDIOMAS.map((i) => [i.codigo, i]))

/** Idioma do navegador no código do Google ("en-US" → "en", "zh-TW" → "zh-TW", "he" → "iw"). */
function codigoDoNavegador(tag: string): string | null {
  const t = tag.toLowerCase()
  if (t.startsWith('zh')) return /tw|hk|mo|hant/.test(t) ? 'zh-TW' : 'zh-CN'
  const base = { he: 'iw', jv: 'jw', fil: 'tl', nb: 'no', nn: 'no' }[t.split('-')[0]] ?? t.split('-')[0]
  return porCodigo.has(base) ? base : null
}

/** Os idiomas do navegador da pessoa, para aparecerem no topo do menu. */
export function sugeridos(): Idioma[] {
  const codigos = (navigator.languages?.length ? navigator.languages : [navigator.language]).map(codigoDoNavegador)
  return [...new Set(codigos)].filter((c): c is string => !!c).map((c) => porCodigo.get(c)!)
}

const lerCookie = (): string => {
  const m = document.cookie.match(/(?:^|;\s*)googtrans=\/[^/;]*\/([^;]+)/)
  const codigo = m ? decodeURIComponent(m[1]) : ORIGINAL
  return porCodigo.has(codigo) ? codigo : ORIGINAL
}

// O Google grava o cookie no domínio do site e no domínio com ponto ("www.x.com" e ".x.com"); apagamos e gravamos nos dois.
function dominios(): string[] {
  const host = location.hostname
  const partes = host.split('.')
  const lista = ['', `; domain=${host}`, `; domain=.${host}`]
  if (partes.length > 2) lista.push(`; domain=.${partes.slice(-3).join('.')}`, `; domain=.${partes.slice(-2).join('.')}`)
  return lista
}

function gravarCookie(codigo: string | null) {
  for (const d of dominios()) {
    document.cookie = codigo
      ? `googtrans=/${ORIGINAL}/${codigo}; path=/; max-age=31536000; SameSite=Lax${d}`
      : `googtrans=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT${d}`
  }
}

let atual = lerCookie()
const ouvintes = new Set<() => void>()
const assinar = (f: () => void) => {
  ouvintes.add(f)
  return () => ouvintes.delete(f)
}

/** O idioma escolhido (código do Google). */
export const useIdioma = () => useSyncExternalStore(assinar, () => atual)
export const idiomaPorCodigo = (codigo: string) => porCodigo.get(codigo) ?? porCodigo.get(ORIGINAL)!

let carregado = false

declare global {
  interface Window {
    google?: { translate?: { TranslateElement: new (opcoes: object, id: string) => unknown } }
    iniciarTradutorOpusCash?: () => void
  }
}

/** Carrega o tradutor do Google (uma vez). Com o cookie gravado, ele já começa traduzindo para o idioma escolhido. */
function carregarTradutor() {
  if (carregado) return
  carregado = true
  protegerReact()
  const caixa = document.createElement('div')
  caixa.id = 'tradutor-google'
  caixa.setAttribute('aria-hidden', 'true')
  document.body.appendChild(caixa)
  window.iniciarTradutorOpusCash = () => {
    if (window.google?.translate) new window.google.translate.TranslateElement({ pageLanguage: ORIGINAL, autoDisplay: false }, caixa.id)
  }
  const s = document.createElement('script')
  s.src = 'https://translate.google.com/translate_a/element.js?cb=iniciarTradutorOpusCash'
  s.async = true
  s.onerror = () => { carregado = false; caixa.remove() } // sem internet ou bloqueado: a página segue em português
  document.head.appendChild(s)
}

/** Ao abrir o site: se a pessoa já tinha escolhido outro idioma, traduz de novo. */
export function iniciarIdioma() {
  if (atual === ORIGINAL) return
  document.documentElement.lang = atual
  carregarTradutor()
}

export function trocarIdioma(codigo: string) {
  if (codigo === atual) return
  gravarCookie(codigo === ORIGINAL ? null : codigo)
  // Já traduzida, a página recarrega no idioma novo: desfazer uma tradução e fazer outra por cima deixa restos na tela.
  if (carregado || codigo === ORIGINAL) {
    location.reload()
    return
  }
  atual = codigo
  document.documentElement.lang = codigo
  ouvintes.forEach((f) => f())
  carregarTradutor()
}

// Valor de dinheiro, porcentagem ou número sozinho ("R$ 1.800,00", "-US$ 5", "12%", "9 / 49"): o tradutor trocaria "R$" por
// "rúpias" e mexeria nos separadores, então o elemento que só tem isso ganha translate="no".
const SO_VALOR = /^[-+−–]?\s?(?:[A-Z]{0,3}\$|[€£¥₹₩₽₺₦₱₴₫฿]|[A-Z]{3})?\s?[-+−–]?\d[\d.,\s/%]*(?:[€£¥₹₩₽₺₦₱₴₫฿]|[A-Z]{3})?$/u

function protegerValores(raiz: Node) {
  const marcar = (t: Node) => {
    const e = t.parentElement
    if (e && !e.closest('[translate="no"], font') && SO_VALOR.test(e.textContent!.trim())) e.setAttribute('translate', 'no')
  }
  if (raiz.nodeType === Node.TEXT_NODE) return marcar(raiz)
  const textos = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT)
  while (textos.nextNode()) marcar(textos.currentNode)
}

/** Tira a marca "_gt_…" com que o tradutor anota o que já traduziu (sem ela, ele traduz de novo). */
function desmarcar(n: Node) {
  for (const k of Object.getOwnPropertyNames(n)) if (k.startsWith('_gt_')) delete (n as unknown as Record<string, unknown>)[k]
}

type Fibra = { tag: number; stateNode: unknown; child: Fibra | null; sibling: Fibra | null; return: Fibra | null; alternate: Fibra | null }

/** Os filhos que o React pôs neste elemento, na ordem (textos e elementos), lidos da árvore interna do React. */
function filhosDoReact(el: Element): Node[] | null {
  const campos = el as unknown as Record<string, Fibra>
  const chave = Object.keys(el).find((k) => k.startsWith('__reactFiber$'))
  if (!chave) return null
  // cada elemento guarda uma das duas versões da sua fibra; a atual é a que chega na raiz que está na tela
  const raiz = document.getElementById('root') as unknown as Record<string, Fibra> | null
  const chaveRaiz = raiz && Object.keys(raiz).find((k) => k.startsWith('__reactContainer$'))
  const atualDaRaiz = chaveRaiz ? (raiz[chaveRaiz].stateNode as { current: Fibra }).current : null
  const ehAtual = (f: Fibra) => { let r = f; while (r.return) r = r.return; return r === atualDaRaiz }
  let fibra = campos[chave]
  if (fibra.alternate && !ehAtual(fibra) && ehAtual(fibra.alternate)) fibra = fibra.alternate
  const lista: Node[] = []
  const andar = (f: Fibra | null) => {
    for (; f; f = f.sibling) {
      if (f.tag === 5 || f.tag === 6) lista.push(f.stateNode as Node) // elemento ou texto
      else if (f.tag !== 4 && f.tag !== 26) andar(f.child) // componentes e fragmentos: os filhos deles; portais e <link>/<title>: não
    }
  }
  andar(fibra.child)
  return lista
}

/**
 * O tradutor troca os textos da página por <font> com o texto traduzido (às vezes junta vários textos de uma frase num <font>
 * só). O React não sabe disso: continua mexendo nos textos originais, que já saíram da página. Sem este ajuste, um valor que
 * muda (o nome do mês ao trocar de mês, por exemplo) ficaria parado na tela, e tirar um texto da tela daria erro
 * ("removeChild"). Quando o React mexe num texto que o tradutor tirou da página, o elemento onde ele estava volta a ter os
 * filhos do React (em português, já atualizados) no lugar dos <font>, sem a marca de "já traduzido", e o tradutor traduz esse
 * elemento de novo.
 */
function protegerReact() {
  const removeChild = Node.prototype.removeChild
  const insertBefore = Node.prototype.insertBefore
  const pais = new WeakMap<Node, Element>() // texto que o tradutor tirou da página → elemento onde ele estava

  const pendentes = new Set<Element>()
  const refazer = (el: Element) => {
    if (!pendentes.size) queueMicrotask(() => { pendentes.forEach(refazerAgora); pendentes.clear() })
    pendentes.add(el)
  }
  function refazerAgora(el: Element) {
    const lista = el.isConnected ? filhosDoReact(el) : null
    if (!lista) return
    for (const n of [...el.childNodes]) if (n.nodeName === 'FONT' && !lista.includes(n)) removeChild.call(el, n)
    let depois: Node | null = null
    for (let i = lista.length - 1; i >= 0; i--) {
      const n = lista[i]
      if (n.nodeType === Node.TEXT_NODE) desmarcar(n)
      if (n.parentNode !== el || n.nextSibling !== depois) insertBefore.call(el, n, depois)
      depois = n
    }
  }

  protegerValores(document.body)
  // Este observador nasce antes do que o tradutor cria, então roda antes dele a cada mudança na página.
  new MutationObserver((registros) => {
    for (const r of registros) {
      const alvo = r.target as Element
      if (r.type === 'characterData') { protegerValores(alvo); continue }
      // o tradutor põe o <font> logo antes do texto e depois tira o texto: o <font> é o irmão anterior de quem saiu
      if ([...r.addedNodes, r.previousSibling].some((a) => a?.nodeName === 'FONT')) {
        r.removedNodes.forEach((n) => n.nodeType === Node.TEXT_NODE && pais.set(n, alvo))
      } else if (r.addedNodes.length && !alvo.closest?.('font')) {
        // O tradutor não traduz o que entra dentro de um elemento cujo aria-label ou title ele já traduziu (o menu lateral, o
        // botão do mês…): ele marca esse elemento com uma propriedade "_gt_…". Tirando a marca, o texto novo é traduzido.
        for (let e: Element | null = alvo; e && e !== document.body; e = e.parentElement) desmarcar(e)
        r.addedNodes.forEach(protegerValores)
      }
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true })

  Node.prototype.removeChild = function <T extends Node>(this: Node, filho: T): T {
    if (filho.parentNode === this) return removeChild.call(this, filho) as T
    // o React tirando um texto que o tradutor já tinha tirado: o <font> que ficou no lugar sai quando o elemento for refeito
    const pai = pais.get(filho)
    if (pai === this) refazer(pai)
    return filho
  }

  Node.prototype.insertBefore = function <T extends Node>(this: Node, novo: T, ref: Node | null): T {
    if (!ref || ref.parentNode === this) return insertBefore.call(this, novo, ref) as T
    // a referência é um texto que o tradutor tirou da página: entra no fim e o elemento é refeito na ordem certa
    insertBefore.call(this, novo, null)
    if (this instanceof Element) refazer(this)
    return novo
  }

  const valor = Object.getOwnPropertyDescriptor(Node.prototype, 'nodeValue')!
  Object.defineProperty(Node.prototype, 'nodeValue', {
    ...valor,
    set(this: Node, texto: string | null) {
      valor.set!.call(this, texto)
      const pai = this.isConnected ? null : pais.get(this)
      if (pai) refazer(pai)
    },
  })
}
