// Parcela adiantada (entrada fixa que caiu duas vezes no mês): o formulário aceita, o lançamento fica no mês em que caiu e
// o mês seguinte aparece como "recebido adiantado"; Desfazer reabre o mês. Uso (depois do build com fake.supabase.co do
// README desta pasta): node scripts/app-de-demonstracao/testar-adiantada.cjs
const R = require('path').join(__dirname, '..', '..')
const { iniciar } = require(R + '/scripts/app-de-demonstracao/servidor-falso.cjs')
const demo = require(R + '/scripts/app-de-demonstracao/dados-de-demonstracao.cjs')
const SHOT = process.argv[2]
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA ') + m); if (!c) process.exitCode = 1 }
;(async () => {
  const dados = structuredClone(demo.dados)
  const t = await iniciar({ perfil: demo.perfil, dados, porta: 4811 })
  const p = t.page, w = (ms = 800) => p.waitForTimeout(ms)
  try {
    await p.clock.install({ time: new Date('2026-11-16T10:00:00') })
    await p.goto(t.url + '#/lancamentos'); await w(2500); await p.clock.runFor(3000).catch(() => {})
    // 1) o salário de novembro, normal (ligado à conta)
    const lancar = async (valor) => {
      await p.getByRole('button', { name: '+ Entrada' }).first().click(); await w()
      const dlg = p.getByRole('dialog')
      await dlg.locator('input[placeholder="0,00"]').first().fill(valor)
      await dlg.getByRole('button', { name: /É de uma entrada fixa\?/ }).click(); await w(400)
      const opc = p.getByRole('option', { name: /^Salário/ })
      const desat = await opc.getAttribute('aria-disabled')
      await opc.click(); await w(400)
      return { dlg, desat }
    }
    let { dlg } = await lancar('6500')
    await dlg.getByRole('button', { name: /^Salvar$/ }).click(); await w(1500)
    // fecha a pergunta "Mais lançamentos de Salário?" (os parecidos dos outros meses)
    await p.keyboard.press('Escape'); await w(600)
    // 2) a parcela adiantada: mesma entrada fixa, mesmo mês
    const r = await lancar('6500')
    ok(r.desat !== 'true', 'Salário continua escolhível mesmo já lançado em novembro')
    const ajuda = await r.dlg.locator('.campo-ajuda').filter({ hasText: 'adiantada' }).textContent().catch(() => '')
    console.log('ajuda:', ajuda)
    ok(/dezembro de 2026/.test(ajuda), 'o formulário diz que vira a de dezembro, adiantada')
    if (SHOT) await r.dlg.screenshot({ path: SHOT + '-form.png' })
    await r.dlg.getByRole('button', { name: /^Salvar$/ }).click(); await w(1500)
    const erro = await p.getByText('já tem um lançamento neste mês').count()
    ok(erro === 0, 'sem o bloqueio "já tem um lançamento neste mês"')
    // 3) dezembro: o salário aparece recebido adiantado
    await p.goto(t.url + '#/contas'); await w(2000)
    await p.getByRole('button', { name: /Próximo mês|mês seguinte/i }).first().click().catch(() => {})
    await w(1500)
    const txt = await p.locator('body').innerText()
    const m = txt.match(/Salário[\s\S]{0,200}/)
    console.log('dezembro:', m && m[0].replace(/\s+/g, ' ').slice(0, 200))
    ok(/recebido adiantado em 16/.test(txt), 'dezembro mostra o salário "recebido adiantado em 16 de nov"')
    if (SHOT) await p.screenshot({ path: SHOT + '-dez.png', fullPage: false })
    const boleto = p.locator('article.ct-boleto').filter({ hasText: 'recebido adiantado' })
    await boleto.getByRole('button', { name: /Desfazer/ }).click(); await w(500)
    await p.getByRole('button', { name: 'Desfazer', exact: true }).last().click(); await w(1500)
    const txt2 = await p.locator('body').innerText()
    ok(!/recebido adiantado/.test(txt2), 'depois do Desfazer, dezembro volta a esperar o salário')
  } catch (e) { console.log('ERRO', e.message); process.exitCode = 1 } finally { await t.fechar() }
})()
