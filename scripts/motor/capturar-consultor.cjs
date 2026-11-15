/**
 * Fotografa a tela do Consultor de verdade (o app de demonstração, conta inventada da Marina) para a abertura do
 * "motor do OpusCash" na página inicial (src/pages/Algoritmo.tsx), onde ela se desmonta peça por peça.
 *
 * Para cada aparelho (pc, cel) e idioma (pt, en, es) gera em src/pages/motor/:
 *   consultor-<aparelho>-<idioma>-c.jpg  só o fundo (sem os blocos);
 *   ...-b.webp  só os blocos (cartões, barra lateral, botões), sem o conteúdo e sem nada atrás: transparente fora
 *               deles, com as quinas redondas e a sombra de verdade;
 *   ...-p.webp  só as peças de dentro dos blocos (textos, gráficos, ícones), também transparente em volta;
 *   ...json     onde fica cada bloco (n1) e cada peça (n2), em px.
 * O fundo, os blocos e as peças desenhados uns sobre os outros dão a tela como a pessoa vê.
 *
 * A transparência sai de duas fotos da mesma camada, uma sobre preto e outra sobre branco: onde a camada é opaca as
 * duas são iguais; onde ela não existe, uma é preta e a outra branca. A diferença dá a opacidade de cada ponto.
 *
 * Como rodar (depois do build de demonstração, ver scripts/app-de-demonstracao/README.md):
 *   node scripts/motor/capturar-consultor.cjs
 */
const path = require('path')
const fs = require('fs')
const raiz = path.join(__dirname, '..', '..')
const { iniciar } = require(path.join(raiz, 'scripts/app-de-demonstracao/servidor-falso.cjs'))
const demo = require(path.join(raiz, 'scripts/app-de-demonstracao/dados-de-demonstracao.cjs'))
const saida = path.join(raiz, 'src/pages/motor')

const APARELHOS = [['pc', 1240, 800, 1.5], ['cel', 390, 844, 2]]
const IDIOMAS = ['pt', 'en', 'es']

/** Escolhe as peças na página (roda dentro do navegador). */
function marcar() {
  const vw = innerWidth, vh = innerHeight, A = vw * vh
  const transparente = (c) => !c || c === 'transparent' || /rgba\([^)]*,\s*0\)$/.test(c)
  const visivel = (el) => {
    const r = el.getBoundingClientRect(), s = getComputedStyle(el)
    return r.width > 2 && r.height > 2 && r.bottom > 0 && r.right > 0 && r.top < vh && r.left < vw && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05
  }
  const fundo = (el) => {
    const s = getComputedStyle(el)
    return !transparente(s.backgroundColor) || s.backgroundImage !== 'none' || (parseFloat(s.borderTopWidth) > 0 && !transparente(s.borderTopColor)) || s.boxShadow !== 'none'
  }
  const folha = (el) => ['svg', 'img', 'canvas', 'button', 'input', 'a'].includes(el.tagName.toLowerCase()) || [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) || fundo(el)
  const area = (el) => { const r = el.getBoundingClientRect(); return r.width * r.height }
  const todos = [...document.body.querySelectorAll('*')].filter(visivel)
  const n1 = [], livres = new Set()
  for (const el of todos) {
    if (n1.some((p) => p.contains(el))) continue
    const a = area(el) / A
    if (a > 0.003 && a < 0.45 && fundo(el)) n1.push(el)
  }
  // o que está solto, fora dos blocos (o título da página, por exemplo), vira bloco sem fundo
  for (const el of todos) {
    if (n1.some((p) => p.contains(el) || el.contains(p))) continue
    if (folha(el) && area(el) / A < 0.45) { n1.push(el); livres.add(el) }
  }
  const n2 = []
  n1.forEach((p, i) => {
    if (livres.has(p)) return
    const dentro = []
    for (const el of p.querySelectorAll('*')) {
      if (!visivel(el) || dentro.some((d) => d.contains(el))) continue
      if (folha(el) && area(el) / area(p) < 0.6) dentro.push(el)
    }
    dentro.forEach((el) => { el.setAttribute('data-m2', ''); n2.push([el, i]) })
  })
  n1.forEach((el) => el.setAttribute('data-m1', ''))
  const caixa = (el) => {
    const r = el.getBoundingClientRect()
    const x0 = Math.max(0, r.left), y0 = Math.max(0, r.top), x1 = Math.min(vw, r.right), y1 = Math.min(vh, r.bottom)
    return [x0, y0, x1 - x0, y1 - y0].map((v) => Math.round(v * 10) / 10)
  }
  return {
    w: vw, h: vh,
    n1: n1.map((el) => [...caixa(el), livres.has(el) ? 1 : 0]),
    n2: n2.map(([el, i]) => [...caixa(el), i]),
  }
}

/** Fotografa só o que `mostrar` deixa visível, sobre preto e sobre branco, e grava com transparência (webp). */
async function camada(p, arquivo, mostrar) {
  const fotos = []
  for (const cor of ['#000', '#fff']) {
    const estilo = await p.addStyleTag({ content: `html,body{background:${cor}!important}html::before,html::after,body::before,body::after{display:none!important}body *{visibility:hidden!important}${mostrar}` })
    await p.waitForTimeout(150)
    fotos.push((await p.screenshot({ type: 'png' })).toString('base64'))
    await estilo.evaluate((e) => e.remove())
  }
  const url = await p.evaluate(async ([preto, branco]) => {
    const abrir = (b64) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = `data:image/png;base64,${b64}` })
    const [ip, ib] = await Promise.all([abrir(preto), abrir(branco)])
    const c = document.createElement('canvas'); c.width = ip.width; c.height = ip.height
    const g = c.getContext('2d', { willReadFrequently: true })
    g.drawImage(ib, 0, 0); const B = g.getImageData(0, 0, c.width, c.height).data
    g.clearRect(0, 0, c.width, c.height); g.drawImage(ip, 0, 0)
    const d = g.getImageData(0, 0, c.width, c.height), P = d.data
    for (let i = 0; i < P.length; i += 4) {
      // sobre preto sai cor × opacidade; sobre branco, isso mais (1 − opacidade) de branco
      const a = 1 - (B[i] - P[i] + B[i + 1] - P[i + 1] + B[i + 2] - P[i + 2]) / 765
      if (a < 0.012) { P[i] = P[i + 1] = P[i + 2] = P[i + 3] = 0; continue }
      P[i] = Math.min(255, P[i] / a); P[i + 1] = Math.min(255, P[i + 1] / a); P[i + 2] = Math.min(255, P[i + 2] / a); P[i + 3] = Math.round(Math.min(1, a) * 255)
    }
    g.putImageData(d, 0, 0)
    return c.toDataURL('image/webp', 0.86)
  }, fotos)
  fs.writeFileSync(arquivo, Buffer.from(url.split(',')[1], 'base64'))
}

;(async () => {
  fs.mkdirSync(saida, { recursive: true })
  for (const [aparelho, w, h, dpr] of APARELHOS) {
    for (const idioma of IDIOMAS) {
      const t = await iniciar({ perfil: demo.perfil, dados: demo.dados, porta: 4700 + Math.floor(Math.random() * 200), dpr })
      const p = t.page
      await p.setViewportSize({ width: w, height: h })
      if (idioma !== 'pt') await p.context().addCookies([{ name: 'googtrans', value: `/pt/${idioma}`, url: t.url }])
      await p.addInitScript(() => { try { localStorage.setItem('opuscash-tema', 'escuro') } catch { /* */ } })
      await p.goto(`${t.url}#/analise`)
      await p.waitForTimeout(4500)
      // tudo parado: as fotos de cada camada precisam ser do mesmo instante
      await p.addStyleTag({ content: '*,*::before,*::after{animation-play-state:paused!important;transition:none!important;caret-color:transparent!important}' })
      await p.waitForTimeout(150)
      const base = path.join(saida, `consultor-${aparelho}-${idioma}`)
      const foto = (letra) => p.screenshot({ path: `${base}-${letra}.jpg`, type: 'jpeg', quality: 80 })
      const mapa = await p.evaluate(marcar)
      await camada(p, `${base}-b.webp`, '[data-m1],[data-m1] *{visibility:visible!important}[data-m2],[data-m2] *{visibility:hidden!important}')
      await camada(p, `${base}-p.webp`, '[data-m2],[data-m2] *{visibility:visible!important}')
      await p.addStyleTag({ content: '[data-m1]{visibility:hidden!important}' })
      await p.waitForTimeout(150)
      await foto('c')
      fs.writeFileSync(`${base}.json`, JSON.stringify(mapa))
      console.log(aparelho, idioma, await p.evaluate(() => document.documentElement.lang), 'blocos', mapa.n1.length, 'peças', mapa.n2.length)
      await t.fechar()
    }
  }
})().catch((e) => { console.error(e); process.exit(1) })
