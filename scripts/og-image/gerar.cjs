// Gera public/og-image.jpg (a imagem que aparece ao compartilhar o link no WhatsApp, Instagram, Facebook…) a partir de og.html.
// Uso (na raiz do projeto): npm i --no-save playwright && npx playwright install chromium && node scripts/og-image/gerar.cjs
const path = require('path')
const { chromium } = require('playwright')

;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
  await page.goto('file://' + path.join(__dirname, 'og.html'), { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  const fontes = await page.evaluate(() => ['Sora', 'Montserrat', 'Inter'].map((f) => `${f}: ${document.fonts.check(`700 20px ${f}`) ? 'ok' : 'FALTOU'}`))
  console.log(fontes.join(' | '))
  // JPEG: bem menor que PNG (o WhatsApp às vezes não mostra a prévia de imagens com mais de ~300 KB)
  await page.screenshot({ path: path.join(__dirname, '..', '..', 'public', 'og-image.jpg'), type: 'jpeg', quality: 90 })
  await browser.close()
  console.log('ok: public/og-image.jpg')
})().catch((e) => { console.error(e); process.exit(1) })
