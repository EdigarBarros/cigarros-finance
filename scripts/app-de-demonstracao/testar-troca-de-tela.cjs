// Troca de tela no painel do computador: só a animação do painel (os blocos que sobem), nunca a dos perfis e do login
// (o giro em 3D de App.tsx, trocarDeTela). Trocar de tela muda o endereço (#/dividas), o que dispara "popstate", e o giro
// dos perfis entrava junto. Antes: build com fake.supabase.co (ver README desta pasta).
// Rodar: node scripts/app-de-demonstracao/testar-troca-de-tela.cjs
const assert = require('node:assert/strict')
const { iniciar } = require('./servidor-falso.cjs')
const demo = require('./dados-de-demonstracao.cjs')

;(async () => {
  const t = await iniciar({ perfil: demo.perfil, dados: structuredClone(demo.dados), porta: 4840 })
  const p = t.page
  try {
    await p.goto(t.url + '#/ano')
    await p.waitForTimeout(2500)
    // anota toda vez que a animação dos perfis é ligada (data-troca no <html>)
    await p.evaluate(() => {
      window.__trocas = []
      new MutationObserver(() => { if (document.documentElement.dataset.troca) window.__trocas.push(document.documentElement.dataset.troca) })
        .observe(document.documentElement, { attributes: true, attributeFilter: ['data-troca'] })
    })
    for (const nome of ['Dívidas', 'Cartões', 'Metas']) {
      await p.locator('.lateral').getByRole('button', { name: nome }).first().click()
      await p.waitForTimeout(900)
    }
    await p.goBack()
    await p.waitForTimeout(900)
    assert.deepEqual(await p.evaluate(() => window.__trocas), [], 'o giro dos perfis não entra nas telas do painel')
    // e a animação do painel continua: os blocos da página nova sobem
    const animacao = await p.evaluate(() => getComputedStyle(document.querySelector('.pagina > *')).animationName)
    assert.match(animacao, /surgir/)
    assert.deepEqual(t.msgs.filter((m) => m.includes('PAGEERROR')), [])
    console.log('✓ trocar de tela no computador usa só a animação do painel')
  } finally {
    await t.fechar()
  }
})().catch((e) => { console.error(e); process.exit(1) })
