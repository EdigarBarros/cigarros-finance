// App na tela de início do celular (iPhone com ilha dinâmica, Android): a faixa do relógio e a barra de status ficam na cor do
// topo da tela aberta, e não numa faixa preta solta. Simula o iPhone 17 Pro Max (440 × 956, 62 px em cima e 34 embaixo).
// Antes: build com fake.supabase.co (ver README desta pasta). Rodar: node scripts/app-de-demonstracao/testar-ilha.cjs
// FOTOS=pasta guarda as telas.
const assert = require('node:assert/strict')
const path = require('node:path')
const { iniciar } = require('./servidor-falso.cjs')
const demo = require('./dados-de-demonstracao.cjs')

;(async () => {
  const t = await iniciar({ perfil: { ...demo.perfil, detalhe: 'equilibrado' }, dados: structuredClone(demo.dados), porta: 4830, dpr: 1, toque: true })
  const p = t.page
  try {
    await p.setViewportSize({ width: 440, height: 956 })
    const cdp = await p.context().newCDPSession(p)
    await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 62, bottom: 34, left: 0, right: 0 } })
    const faixa = () => p.evaluate(() => ({
      altura: parseFloat(getComputedStyle(document.documentElement, '::before').height),
      cor: getComputedStyle(document.documentElement).getPropertyValue('--faixa-topo').trim(),
      barra: document.querySelector('meta[name="theme-color"]').getAttribute('content'),
      topo: document.querySelector('.topo-movel').getBoundingClientRect().top,
    }))

    await p.goto(t.url + '#/inicio')
    await p.waitForTimeout(2000)
    let f = await faixa()
    assert.equal(f.altura, 62, 'a faixa cobre a ilha')
    assert.equal(f.cor, '#3f9488', 'na Início, a faixa é o verde do topo')
    assert.equal(f.barra, '#3f9488', 'a barra de status do Android também')
    assert.ok(f.topo >= 62, 'nada do topo do app fica atrás da ilha')
    if (process.env.FOTOS) await p.screenshot({ path: path.join(process.env.FOTOS, 'ilha-inicio.png') })

    await p.goto(t.url + '#/dividas')
    await p.waitForTimeout(2000)
    f = await faixa()
    // a faixa é a cor de cima do degradê que está aceso (o primeiro ponto dele em movel.css)
    const doDegrade = await p.evaluate(() => {
      const g = getComputedStyle(document.querySelector('.movel-fundo i.ativo')).backgroundImage
      const [r, gg, b] = g.match(/rgb\((\d+), (\d+), (\d+)\)/).slice(1).map(Number)
      return '#' + [r, gg, b].map((v) => v.toString(16).padStart(2, '0')).join('')
    })
    assert.notEqual(f.cor, '#3f9488', 'mudou de tela, mudou a cor')
    assert.equal(f.cor, doDegrade, 'em Dívidas, a cor de cima do degradê')
    assert.equal(f.barra, doDegrade)

    // no tema escuro também (ele tinha uma regra própria que deixava a faixa grafite por cima da cor)
    await p.emulateMedia({ colorScheme: 'dark' })
    await p.goto(t.url + '#/inicio')
    await p.waitForTimeout(2000)
    const pintada = await p.evaluate(() => getComputedStyle(document.documentElement, '::before').backgroundColor)
    assert.equal(pintada, 'rgb(63, 148, 136)', 'tema escuro: a faixa é o verde do topo, não o grafite')
    if (process.env.FOTOS) await p.screenshot({ path: path.join(process.env.FOTOS, 'ilha-inicio-escuro.png') })
    // rolou: a barra de busca fica na mesma cor da faixa (antes, a faixa verde e a barra cinza pareciam duas peças coladas)
    for (const esquema of ['dark', 'light']) {
      await p.emulateMedia({ colorScheme: esquema })
      await p.evaluate(() => window.scrollTo(0, 600))
      await p.waitForTimeout(1200)
      const [faixaCor, barraCor] = await p.evaluate(() => [
        getComputedStyle(document.documentElement, '::before').backgroundColor, getComputedStyle(document.querySelector('.topo-movel')).backgroundColor,
      ])
      assert.equal(barraCor, faixaCor, `rolou (${esquema}): barra e faixa da mesma cor`)
      if (process.env.FOTOS) await p.screenshot({ path: path.join(process.env.FOTOS, `ilha-rolou-${esquema}.png`) })
      await p.evaluate(() => window.scrollTo(0, 0))
    }

    // no computador, nada muda: a faixa volta ao padrão
    await p.setViewportSize({ width: 1280, height: 900 })
    await p.waitForTimeout(1500)
    f = await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--faixa-topo').trim())
    assert.equal(f, '', 'no computador, sem cor de topo')
    assert.deepEqual(t.msgs.filter((m) => m.includes('PAGEERROR')), [])
    console.log('✓ a faixa da ilha e a barra de status seguem a cor do topo de cada tela')
  } finally {
    await t.fechar()
  }
})().catch((e) => { console.error(e); process.exit(1) })
