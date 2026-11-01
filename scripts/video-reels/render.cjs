// uso: node render.cjs previa 1,4,6.5   |   node render.cjs video [fps] [a partir do segundo, refaz só o fim]
const { chromium } = require('playwright'), fs = require('fs'), path = require('path')
;(async () => {
  const [modo, arg] = process.argv.slice(2)
  const b = await chromium.launch({ args: ['--allow-file-access-from-files'] })
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 })
  p.on('pageerror', (e) => console.log('ERRO', e.message)); p.on('console', (m) => m.type() === 'error' && console.log('CONSOLE', m.text()))
  await p.goto('file://' + path.join(__dirname, 'reels.html'))
  await p.evaluate(async () => {
    await window.pronto
    const urls = new Set(); document.querySelectorAll('*').forEach((e) => { const m = /url\("?([^")]+)"?\)/.exec(e.style.backgroundImage); if (m) urls.add(m[1]) })
    await Promise.all([...urls].map((u) => new Promise((r) => { const i = new Image(); i.onload = i.onerror = r; i.src = u })))
  })
  if (modo === 'previa') {
    process.chdir(__dirname); fs.mkdirSync('previa', { recursive: true })
    for (const t of arg.split(',').map(Number)) {
      await p.evaluate((t) => window.desenhar(t), t)
      await p.screenshot({ path: `previa/t${t.toFixed(1).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 80 })
    }
  } else {
    const fps = Number(arg || 30), total = await p.evaluate(() => window.TOTAL), n = Math.round(total * fps)
    process.chdir(__dirname); if (!process.argv[4]) fs.rmSync('quadros', { recursive: true, force: true }); fs.mkdirSync('quadros', { recursive: true })
    const t0 = Date.now()
    const desde = Math.round(Number(process.argv[4] || 0) * fps)
    for (let i = desde; i < n; i++) {
      await p.evaluate((t) => window.desenhar(t), i / fps)
      await p.screenshot({ path: `quadros/q${String(i).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 94 })
      if (i % 150 === 0) console.log(i, '/', n, ((Date.now() - t0) / 1000).toFixed(0) + 's')
    }
  }
  await b.close()
})()
