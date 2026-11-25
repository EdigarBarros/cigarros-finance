// Planejamento do mês: o que já aconteceu desde o plano salvo fica na mesa, travado. Salva um plano com o Plano de saúde
// pago pelo Aluguel da garagem; depois a garagem cai (lançada) e o Plano de saúde é pago (baixa). Ao abrir de novo, a
// entrada aparece como "já caiu", a fatia como "paga" (sem puxador, sem ajuste) e o placar não piora. Celular e computador.
// Uso (depois do build com fake.supabase.co do README desta pasta): node scripts/app-de-demonstracao/testar-plano-travado.cjs
// Com FOTOS=pasta, salva capturas.
const path = require('path')
const R = path.join(__dirname, '..', '..')
const { iniciar } = require(R + '/scripts/app-de-demonstracao/servidor-falso.cjs')
const demo = require(R + '/scripts/app-de-demonstracao/dados-de-demonstracao.cjs')
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA ') + m); if (!c) process.exitCode = 1 }
const esperar = (p, ms = 700) => p.waitForTimeout(ms)
const FOTOS = process.env.FOTOS
const foto = async (p, nome) => { if (FOTOS) await p.screenshot({ path: path.join(FOTOS, nome + '.png') }) }
const abrir = async (dados, tela, guardado) => {
  const t = await iniciar({ perfil: { ...demo.perfil, detalhe: 'equilibrado' }, dados, porta: 4900 + Math.floor(Math.random() * 60), dpr: 1 })
  const erros = []
  t.page.on('pageerror', (e) => erros.push(e.message))
  if (guardado) await t.page.addInitScript((g) => { for (const [k, v] of g) localStorage.setItem(k, v) }, guardado)
  await t.page.setViewportSize(tela)
  await t.page.goto(t.url + '#/analise'); await esperar(t.page, 2600)
  await t.page.locator('.pj-cartao button').first().click(); await esperar(t.page, 800)
  return { t, p: t.page, erros }
}
const anel = (p) => p.locator('.pj-anel').getAttribute('aria-label')

;(async () => {
  for (const [nome, tela] of [['computador', { width: 1440, height: 900 }], ['celular', { width: 390, height: 844 }]]) {
    // 1. o plano: Plano de saúde (vence hoje ou logo) pago pelo Aluguel da garagem
    const a = await abrir(demo.dados, tela)
    let guardado
    try {
      await a.p.locator('.pj-ficha', { hasText: 'Plano de saúde' }).first().click(); await esperar(a.p, 300)
      await a.p.locator('.pj-entrada', { hasText: 'Aluguel da garagem' }).first().click(); await esperar(a.p, 600)
      ok(await a.p.locator('.pj-entrada', { hasText: 'Aluguel da garagem' }).locator('.pj-fatia').count() === 1, `${nome}: o Plano de saúde entra no Aluguel da garagem`)
      await a.p.locator('button', { hasText: 'Salvar plano' }).first().click(); await esperar(a.p, 600)
      guardado = await a.p.evaluate(() => Object.entries(localStorage).filter(([k]) => k.startsWith('opuscash-planejamento-')))
      ok(guardado.length === 1 && guardado[0][1].includes('"fotos"'), `${nome}: o plano salvo leva as fotos`)
      ok(!a.erros.length, `${nome}: sem erro na página (antes) ${a.erros.join(' | ')}`)
    } finally { await a.t.fechar() }

    // 2. a garagem caiu e o Plano de saúde foi pago (baixas de novembro)
    const hoje = new Date().toISOString().slice(0, 10)
    const [ano, mes] = hoje.split('-').map(Number)
    const f = (d) => demo.dados.contas_fixas.find((x) => x.descricao === d)
    const baixa = (c, tipo, valor) => ({ id: `l-baixa-${c.id}`, user_id: c.user_id, ano, mes, tipo, descricao: c.descricao, valor, data: hoje, categoria_id: c.categoria_id, banco_id: c.banco_id, conta_fixa_id: c.id, forma: 'pix', created_at: hoje + 'T12:00:00Z' })
    const dados = { ...demo.dados, lancamentos: [...demo.dados.lancamentos, baixa(f('Aluguel da garagem'), 'entrada', 350), baixa(f('Plano de saúde'), 'saida', 389.5)] }
    const b = await abrir(dados, tela, guardado)
    try {
      const garagem = b.p.locator('.pj-entrada.caiu', { hasText: 'Aluguel da garagem' })
      ok(await garagem.count() === 1, `${nome}: a garagem continua na mesa, como já caiu (${await garagem.locator('small').first().textContent().catch(() => '')})`)
      const fatia = garagem.locator('.pj-fatia.paga')
      ok(await fatia.count() === 1, `${nome}: a fatia do Plano de saúde continua, como paga (${await fatia.locator('small').textContent().catch(() => '')})`)
      ok(await fatia.locator('.pj-puxador').count() === 0, `${nome}: a fatia paga não tem puxador`)
      await fatia.click({ force: true }); await esperar(b.p, 400)
      ok(await b.p.locator('.pj-ajuste').count() === 0, `${nome}: tocar na fatia paga não abre o ajuste`)
      ok(await b.p.locator('.pj-ficha', { hasText: 'Plano de saúde' }).count() === 0, `${nome}: o Plano de saúde não volta para a bandeja`)
      await foto(b.p, `travado-${nome}`)
      // Montar pra mim não desfaz o que já aconteceu
      await b.p.locator('.pj-montar').click(); await esperar(b.p, 700)
      ok(await b.p.locator('.pj-fatia.paga').count() === 1, `${nome}: "Montar pra mim" mantém a fatia paga (${await anel(b.p)})`)
      ok(!b.erros.length, `${nome}: sem erro na página (depois) ${b.erros.join(' | ')}`)
    } finally { await b.t.fechar() }
  }
})()
