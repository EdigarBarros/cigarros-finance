const assert = require('node:assert/strict')
const { chromium } = require('playwright')
const launch = chromium.launch.bind(chromium)
chromium.launch = o => launch({ ...o, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium' })
const { iniciar } = require('./servidor-falso.cjs')
const demo = require('./dados-de-demonstracao.cjs')
const fs = require('node:fs')
const pasta = process.env.OPUS_CAPTURAS || '/workspace/artifacts'
fs.mkdirSync(pasta, { recursive: true })
;(async () => {
 const t = await iniciar({ perfil: { ...demo.perfil, detalhe: 'detalhado' }, dados: structuredClone(demo.dados), toque: true, porta: 4805 })
 try {
  const page = t.page
  await page.goto(t.url)
  await page.locator('.inicio-det').waitFor()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  for (const width of [320,360,390,430]) {
   await page.setViewportSize({ width, height: 844 })
   await page.evaluate(() => window.scrollTo(0,0))
   await page.screenshot({ path: `${pasta}/detalhado-${width}.png`, fullPage: true })
   const med = await page.evaluate(() => ({ tela: innerWidth, pagina: document.documentElement.scrollWidth }))
   assert(med.pagina <= med.tela, `${width}: rolagem horizontal ${JSON.stringify(med)}`)
   assert.equal(await page.locator('.fab').count(), 0)
   for (const zoom of ['150%', '200%']) {
    await page.evaluate(z => document.documentElement.style.fontSize = z, zoom)
    const largura = await page.evaluate(() => document.documentElement.scrollWidth)
    assert(largura <= width, `${width}/${zoom}: rolagem horizontal ${largura}`)
    await page.screenshot({ path: `${pasta}/detalhado-${width}-texto-${zoom.slice(0,-1)}.png`, fullPage: true })
   }
   await page.evaluate(() => document.documentElement.style.fontSize = '')
  }
  await page.setViewportSize({width:390,height:844})
  await page.evaluate(() => window.scrollTo(0,0))
  await page.screenshot({path:`${pasta}/detalhado-topo-390.png`})
  await page.locator('#det-evolucao').screenshot({path:`${pasta}/detalhado-evolucao-390.png`})
  await page.locator('#det-diagnostico').screenshot({path:`${pasta}/detalhado-diagnostico-390.png`})
  await page.locator('.det-registrar').click()
  await page.getByRole('dialog').waitFor()
  assert.equal(await page.getByRole('dialog').count(),1)
  await page.keyboard.press('Escape')
  // Selecionar mês é possível com toque e teclado, sem hover.
  await page.locator('.det-mes-selecionado select').selectOption('9')
  assert((await page.locator('.det-painel h3').textContent()).includes('Set'))
  await page.getByRole('radio',{name:'Saldos',exact:true}).click()
  await page.getByLabel('Investimentos',{exact:true}).check()
  await page.getByText('Consultar os números em lista',{exact:true}).click()
  assert(await page.locator('.det-lista-mes').count() > 0)
  // Tocar em conta só abre a consulta; não grava nada.
  const antes = t.log.length
  await page.locator('.det-tarefa').first().click()
  await page.getByRole('dialog').waitFor()
  assert.equal(await page.getByRole('dialog').count(),1)
  assert.equal(t.log.length,antes)
  await page.keyboard.press('Escape')
  // Recolher mantém resumo e preferência após recarregar.
  await page.locator('#det-evolucao .det-secao-cab').click()
  await page.reload()
  await page.locator('.inicio-det').waitFor()
  assert.equal(await page.locator('#det-evolucao .det-secao-cab').getAttribute('aria-expanded'),'false')
  await page.locator('#det-evolucao .det-secao-cab').click()
  await page.getByRole('button',{name:'Ocultar valores',exact:true}).click()
  assert.equal(await page.locator('.det-chart canvas').count(),0)
  assert((await page.locator('.idet-grande').textContent()).includes('••'))
  await page.locator('.det-previsao').click()
  assert(!(await page.getByRole('dialog').textContent()).includes('R$'))
  await page.keyboard.press('Escape')
  await page.screenshot({path:`${pasta}/detalhado-privacidade.png`,fullPage:true})
  assert.deepEqual(t.msgs.filter(x=>x.startsWith('PAGEERROR:')),[])
  console.log('Detalhado: 320/360/390/430 px, texto 150%/200%, seleção de mês, séries, lista, consulta sem pagamento, recolhimento persistido e privacidade: OK')
 } finally { await t.fechar() }
 // Modos existentes continuam com suas estruturas próprias.
 for(const modo of ['simples','equilibrado']) {
  const t = await iniciar({perfil:{...demo.perfil,detalhe:modo},dados:structuredClone(demo.dados),porta:4805})
  try { await t.page.setViewportSize({width:390,height:844}); await t.page.goto(t.url); await t.page.locator(modo==='simples'?'.inicio-simples':'.inicio-eq').waitFor(); assert.equal(await t.page.locator('.inicio-det').count(),0); await t.page.screenshot({path:`${pasta}/${modo}-390.png`,fullPage:true}); assert.deepEqual(t.msgs.filter(x=>x.startsWith('PAGEERROR:')),[]) } finally { await t.fechar() }
 }
 console.log('Simples e equilibrado preservam estruturas independentes: OK')
})().catch(e=>{console.error(e);process.exitCode=1})
