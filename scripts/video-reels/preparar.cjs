// Depois de capturar.cjs: copia a marca, acha a linha da dívida no gráfico "Mês a mês" e gera dados.js para o reels.html.
const fs = require('fs'), path = require('path'), { chromium } = require('playwright')
;(async () => {
  const cap = path.join(__dirname, 'cap'), pub = path.join(__dirname, '..', '..', 'public')
  for (const f of ['logo-opuscash.webp', 'simbolo.webp']) fs.copyFileSync(path.join(pub, f), path.join(cap, f))
  const meta = JSON.parse(fs.readFileSync(path.join(cap, 'meta.json')))
  const card = meta.ano.cards[4] // "Mês a mês"
  const b = await chromium.launch(), p = await b.newPage()
  const png = 'data:image/png;base64,' + fs.readFileSync(path.join(cap, 'ano.png')).toString('base64')
  // pixels amarelos (a cor das dívidas) coluna a coluna, na metade de cima do gráfico (a 3x)
  const linha = await p.evaluate(async ({ png, card }) => {
    const im = new Image(); im.src = png; await im.decode()
    const c = document.createElement('canvas'); c.width = card.w * 3; c.height = card.h * 3
    const g = c.getContext('2d'); g.drawImage(im, -card.x * 3, -card.y * 3)
    const d = g.getImageData(0, 0, c.width, c.height).data, pts = []
    for (let x = 150; x < Math.min(1110, c.width); x += 6) {
      const ys = []
      for (let y = 0; y < Math.min(1000, c.height); y++) { const i = (y * c.width + x) * 4; if (d[i] > 220 && d[i + 1] > 160 && d[i + 1] < 215 && d[i + 2] < 110) ys.push(y) }
      if (ys.length) pts.push([+(card.x + x / 3).toFixed(1), +(card.y + ys.reduce((a, b) => a + b) / ys.length / 3).toFixed(1)])
    }
    return pts
  }, { png, card })
  await b.close()
  fs.writeFileSync(path.join(__dirname, 'dados.js'), `window.META=${JSON.stringify(meta)};\nwindow.LINHA=${JSON.stringify(linha)};\n`)
  console.log('linha da dívida:', linha.length, 'pontos')
})()
