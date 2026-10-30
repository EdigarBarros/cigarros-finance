import { tx } from './textos'
/**
 * Atualização automática: quando sai uma versão nova do site, o app se recarrega sozinho, mas só num momento em que a
 * pessoa não perde nada.
 *
 * - Como sabe: a cada publicação, /versao.json traz um número novo (veja vite.config.ts). O app confere a cada 2 minutos e
 *   sempre que a pessoa volta para a aba. Também sabe quando tenta abrir um pedaço do app que não existe mais
 *   (vite:preloadError), o que acontece com abas abertas antes da publicação.
 * - Quando recarrega: nunca com uma janela aberta (lançamento, conta, cartão…), com o cursor num campo, logo depois de a
 *   pessoa digitar ou tocar, com o login preenchido, no tutorial ou nas perguntas iniciais. Recarrega quando a aba vai
 *   para o segundo plano ou depois de um tempo parada. Até lá, a versão antiga segue funcionando normalmente.
 * - Depois: volta para a mesma página, na mesma altura da tela, e mostra "OpusCash atualizado".
 */
declare const __VERSAO__: string
export const VERSAO = __VERSAO__

const CHAVE = 'opuscash-volta'
const CONFERIR_A_CADA = 2 * 60_000
const PARADA_POR = 30_000 // sem tocar nem digitar por esse tempo, com a aba à vista

let pendente = false
let ultimoToque = Date.now()

/** O erro é de um pedaço do app que sumiu numa publicação nova (cada navegador escreve de um jeito)? */
export const ehErroDeVersao = (e: unknown) =>
  /dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/i
    .test(String((e as Error | undefined)?.message ?? e))

/** Dá para recarregar agora sem a pessoa perder nada do que está fazendo? */
function semNadaEmAndamento() {
  if (document.querySelector('.modal-fundo, [role="dialog"], .tour, .qz, .quadro-meses, .menu-lista')) return false
  const foco = document.activeElement as HTMLElement | null
  if (foco && (foco.matches('input, textarea, select') || foco.isContentEditable)) return false
  // fora das janelas: login, cadastro e busca com algo escrito
  for (const el of document.querySelectorAll<HTMLInputElement>('.en-form input, input[type="search"], .busca input')) {
    if (el.value) return false
  }
  return true
}

function recarregar() {
  try { sessionStorage.setItem(CHAVE, JSON.stringify({ y: Math.round(scrollY), hash: location.hash, em: Date.now() })) } catch { /* sem onde guardar: só não volta à altura */ }
  location.reload()
}

/**
 * Recarrega se houver versão nova e o momento for seguro: na hora, se a própria pessoa acabou de precisar da versão nova
 * (`jaPediu`); senão, com a aba em segundo plano ou depois de um tempo sem ela tocar em nada.
 */
function tentar(jaPediu = false) {
  if (!pendente || !semNadaEmAndamento()) return
  if (jaPediu || document.visibilityState === 'hidden' || Date.now() - ultimoToque >= PARADA_POR) recarregar()
}

async function conferir() {
  if (pendente) return tentar()
  try {
    const r = await fetch('/versao.json', { cache: 'no-store' })
    if (!r.ok) return
    const { versao } = (await r.json()) as { versao?: string }
    if (versao && versao !== VERSAO) { pendente = true; tentar() }
  } catch { /* sem internet: confere na próxima */ }
}

/** Avisa que uma tela precisou de um pedaço da versão nova (o app recarrega assim que puder). */
export function versaoNovaNecessaria() {
  pendente = true
  tentar(true)
}

/** Depois de recarregar por atualização: volta à mesma altura da tela e avisa, discretamente. */
function voltarAoLugar() {
  let volta: { y: number; hash: string; em: number } | null = null
  try {
    volta = JSON.parse(sessionStorage.getItem(CHAVE) ?? 'null')
    sessionStorage.removeItem(CHAVE)
  } catch { return }
  if (!volta || Date.now() - volta.em > 60_000 || volta.hash !== location.hash) return
  const alvo = volta.y
  // a página monta aos poucos (dados chegando): tenta até ela ter altura, e desiste se a pessoa rolar antes
  let mexeu = false
  const parar = () => { mexeu = true }
  addEventListener('wheel', parar, { once: true, passive: true })
  addEventListener('touchstart', parar, { once: true, passive: true })
  const inicio = Date.now()
  const passo = () => {
    if (mexeu) return
    if (document.documentElement.scrollHeight >= alvo + innerHeight || Date.now() - inicio > 5000) { scrollTo(0, alvo); return }
    requestAnimationFrame(passo)
  }
  requestAnimationFrame(passo)
  setTimeout(() => {
    const aviso = document.createElement('div')
    aviso.className = 'aviso-atualizado'
    aviso.setAttribute('role', 'status')
    aviso.textContent = tx('OpusCash atualizado ✓')
    document.body.appendChild(aviso)
    setTimeout(() => aviso.remove(), 3600)
  }, 600)
}

export function iniciarAtualizacao() {
  voltarAoLugar()
  // pedaço do app que sumiu: a versão nova é necessária agora (o erro segue para quem chamou, que mostra o aviso dele)
  addEventListener('vite:preloadError', () => versaoNovaNecessaria())
  if (VERSAO === 'dev') return
  const tocou = () => { ultimoToque = Date.now() }
  for (const ev of ['pointerdown', 'keydown', 'input', 'wheel', 'touchmove']) addEventListener(ev, tocou, { capture: true, passive: true })
  document.addEventListener('visibilitychange', () => (document.visibilityState === 'visible' ? conferir() : tentar()))
  setInterval(conferir, CONFERIR_A_CADA)
  setInterval(() => tentar(), 10_000)
}
