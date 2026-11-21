// Baixar backup no celular (Configurações > Dados): no celular comum o arquivo .xlsx baixa; no iPhone aparece o "Backup pronto" e o
// segundo toque entrega o arquivo ao compartilhar. Roda com ordemEstrita (o Supabase recusa ordenar por coluna que a tabela não
// tem: o backup chegou a quebrar porque `meses` não tem `id`). Nada pode dar erro na página.
// Uso (depois do build com fake.supabase.co do README desta pasta): node scripts/app-de-demonstracao/testar-backup.cjs
const path = require('path')
const R = path.join(__dirname, '..', '..')
const { iniciar } = require(R + '/scripts/app-de-demonstracao/servidor-falso.cjs')
const demo = require(R + '/scripts/app-de-demonstracao/dados-de-demonstracao.cjs')
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA ') + m); if (!c) process.exitCode = 1 }
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0 Mobile/15E148 Safari/604.1'

;(async () => {
  for (const modo of ['celular comum', 'iPhone']) {
    const t = await iniciar({ perfil: demo.perfil, dados: demo.dados, porta: 4900 + Math.floor(Math.random() * 60), dpr: 1, toque: true, ordemEstrita: true })
    const p = t.page, erros = []
    p.on('pageerror', (e) => erros.push(e.message))
    if (modo === 'iPhone') {
      await p.addInitScript((ua) => {
        Object.defineProperty(navigator, 'userAgent', { get: () => ua })
        window.__share = null
        navigator.canShare = (d) => Boolean(d && d.files && d.files.length)
        navigator.share = async (d) => { window.__share = { nome: d.files[0].name, tamanho: d.files[0].size } }
      }, IPHONE)
    }
    let baixou = null
    p.on('download', (d) => { baixou = d.suggestedFilename() })
    await p.setViewportSize({ width: 390, height: 800 })
    await p.goto(t.url + '#/inicio'); await p.waitForTimeout(2500)
    const tocar = async (rx) => { await p.locator('button,a,[role=button]').filter({ hasText: rx }).or(p.getByLabel(rx)).first().tap(); await p.waitForTimeout(900) }
    await tocar(/Sua conta/); await tocar(/Baixar backup/); await p.waitForTimeout(3000)
    if (modo === 'celular comum') ok(/^backup-financas-.*\.xlsx$/.test(baixou || ''), `${modo}: baixa o arquivo ${baixou}`)
    else {
      ok(await p.getByText('Backup pronto').count() > 0, `${modo}: aparece "Backup pronto"`)
      ok(!baixou, `${modo}: não tenta o download direto (o iOS ignora)`)
      await p.getByRole('button', { name: /Salvar backup/ }).tap(); await p.waitForTimeout(700)
      const s = await p.evaluate(() => window.__share)
      ok(s && /^backup-financas-.*\.xlsx$/.test(s.nome) && s.tamanho > 2000, `${modo}: o segundo toque entrega o .xlsx ${JSON.stringify(s)}`)
      ok(await p.getByText('Backup pronto').count() === 0, `${modo}: a folha fecha depois de salvar`)
    }
    ok(!/object Object/.test(await p.evaluate(() => document.body.innerText)), `${modo}: nenhum "[object Object]" na tela`)
    ok(!erros.length, `${modo}: sem erro na página ${erros.join('|')}`)
    await t.fechar()
  }
})()
