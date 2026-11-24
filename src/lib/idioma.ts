export const ORIGINAL = 'pt'
export const IDIOMAS_NATIVOS = ['en', 'es'] as const

export type Idioma = { codigo: string; nativo: string; ingles: string; portugues: string }

export const IDIOMAS: Idioma[] = [
  { codigo: 'pt', nativo: 'Português', ingles: 'Portuguese', portugues: 'Português' },
  { codigo: 'en', nativo: 'English', ingles: 'English', portugues: 'Inglês' },
  { codigo: 'es', nativo: 'Español', ingles: 'Spanish', portugues: 'Espanhol' },
]

const porCodigo = new Map(IDIOMAS.map((idioma) => [idioma.codigo, idioma]))
export const idiomaPorCodigo = (codigo: string) => porCodigo.get(codigo) ?? IDIOMAS[0]

function lerIdioma(): string {
  const escolhido = document.cookie.match(/(?:^|;\s*)opuscash-idioma=([a-z]+)(?:;|$)/)?.[1]
  const legado = document.cookie.match(/(?:^|;\s*)googtrans=\/pt\/([a-z]+)(?:;|$)/)?.[1]
  return idiomaPorCodigo(escolhido ?? legado ?? ORIGINAL).codigo
}

const atual = lerIdioma()
export const idiomaAtual = () => atual

export function sugeridos(): Idioma[] {
  const idiomas = navigator.languages?.length ? navigator.languages : [navigator.language]
  const codigos = new Set(idiomas.map((tag) => tag.toLowerCase().split('-')[0]))
  return [...codigos].flatMap((codigo) => porCodigo.get(codigo) ?? [])
}

export function iniciarIdioma() {
  document.documentElement.lang = atual === ORIGINAL ? 'pt-BR' : atual
}

export function trocarIdioma(codigo: string) {
  if (!porCodigo.has(codigo) || atual === codigo) return
  const seguro = location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `opuscash-idioma=${codigo}; Path=/; Max-Age=31536000; SameSite=Lax${seguro}`
  location.reload()
}
