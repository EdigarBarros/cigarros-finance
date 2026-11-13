/**
 * Fotografa a tela do Consultor de verdade (o app de demonstração, conta inventada da Marina) para a abertura do
 * "motor do OpusCash" na página inicial (src/pages/Algoritmo.tsx), onde ela se desmonta peça por peça.
 *
 * Para cada aparelho (pc, cel) e idioma (pt, en, es) gera em src/pages/motor/:
 *   consultor-<aparelho>-<idioma>-a.jpg  a tela inteira, como a pessoa vê;
 *   ...-b.jpg  só os blocos (cartões, barra lateral, botões) com o conteúdo deles escondido;
 *   ...-c.jpg  só o fundo (sem os blocos);
 *   ...json    onde fica cada bloco (n1) e cada peça de dentro dele (n2: textos, gráficos, ícones), em px.
 * Desenhar o fundo, os blocos (de b) e as peças (de a) uns sobre os outros dá exatamente a foto a.
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
      const base = path.join(saida, `consultor-${aparelho}-${idioma}`)
      const foto = (letra) => p.screenshot({ path: `${base}-${letra}.jpg`, type: 'jpeg', quality: 80 })
      const mapa = await p.evaluate(marcar)
      await foto('a')
      await p.addStyleTag({ content: '[data-m2]{visibility:hidden!important}' })
      await p.waitForTimeout(150)
      await foto('b')
      await p.addStyleTag({ content: '[data-m1]{visibility:hidden!important}' })
      await p.waitForTimeout(150)
      await foto('c')
      fs.writeFileSync(`${base}.json`, JSON.stringify(mapa))
      console.log(aparelho, idioma, await p.evaluate(() => document.documentElement.lang), 'blocos', mapa.n1.length, 'peças', mapa.n2.length)
      await t.fechar()
    }
  }
})().catch((e) => { console.error(e); process.exit(1) })
