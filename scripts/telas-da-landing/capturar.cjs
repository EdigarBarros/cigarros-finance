// Gera as capturas de tela do app que aparecem em 3D na landing page (public/landing).
// Uso (na raiz do projeto):
//   VITE_SUPABASE_URL=https://fake.supabase.co VITE_SUPABASE_ANON_KEY=anon npm run build
//   npm i --no-save playwright && npx playwright install chromium
//   node scripts/telas-da-landing/capturar.cjs        # grava PNGs em scripts/telas-da-landing/saida
//   python3 scripts/telas-da-landing/converter.py     # converte para WebP em public/landing
const path = require('path')
const fs = require('fs')
const { iniciar } = require('./servidor-falso.cjs')
const demo = require('./dados-de-demonstracao.cjs')

const PAGINAS = ['inicio', 'cartoes', 'contas', 'metas', 'dividas', 'ano']
const FORMATOS = [
  { sufixo: '', largura: 1280, altura: 800 }, // computador
  { sufixo: '-m', largura: 390, altura: 844 }, // celular
]
const saida = path.join(__dirname, 'saida')

;(async () => {
  fs.mkdirSync(saida, { recursive: true })
  let porta = 4800
  for (const tema of ['escuro', 'claro']) {
    for (const f of FORMATOS) {
      const t = await iniciar({ perfil: demo.perfil, dados: demo.dados, porta: porta++, dpr: 2 })
      const { page } = t
      await page.addInitScript((x) => localStorage.setItem('opuscash-tema', x), tema)
      await page.setViewportSize({ width: f.largura, height: f.altura })
      // relógio que corre a partir de uma data fixa (os gráficos animam pelo relógio; congelado, saem vazios)
      await page.clock.install({ time: new Date('2026-10-18T15:00:00-03:00') })
      await page.clock.resume()
      for (const p of PAGINAS) {
        await page.goto(`${t.url}#/${p}`, { waitUntil: 'networkidle' })
        await page.waitForTimeout(3200)
        await page.addStyleTag({ content: '.fab{display:none!important}' })
        await page.screenshot({ path: path.join(saida, `${tema}-${p}${f.sufixo}.png`) })
        console.log('ok', tema, p, f.sufixo || '(computador)')
      }
      await t.fechar()
    }
  }
})().catch((e) => { console.error(e); process.exit(1) })
