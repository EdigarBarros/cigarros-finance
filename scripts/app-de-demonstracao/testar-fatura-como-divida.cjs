// Fatura de cartão como dívida: aparece em Dívidas (computador e celular), dá para pagar por lá, por uma saída em
// Lançamentos ("Isso paga…" → a fatura) e pelo Planejamento ("Já paguei"). Os três gravam o mesmo pagamento da tela Cartões
// (faturas_parciais / faturas_pagas). Uso (depois do build com fake.supabase.co): node scripts/app-de-demonstracao/testar-fatura-como-divida.cjs
const path = require('path')
const R = path.join(__dirname, '..', '..')
const { iniciar } = require(R + '/scripts/app-de-demonstracao/servidor-falso.cjs')
const demo = require(R + '/scripts/app-de-demonstracao/dados-de-demonstracao.cjs')
let falhas = 0
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA ') + m); if (!c) falhas++ }
const reais = (t) => Number(String(t).replace(/[^\d,]/g, '').replace(',', '.'))

async function abrir({ toque = false, largura = 1440 } = {}) {
  const t = await iniciar({ perfil: { ...demo.perfil, detalhe: 'equilibrado' }, dados: structuredClone(demo.dados), porta: 4980 + Math.floor(Math.random() * 15), dpr: 1, toque })
  const erros = []
  t.page.on('pageerror', (e) => erros.push(e.message))
  await t.page.setViewportSize({ width: largura, height: 900 })
  return { t, p: t.page, erros }
}
const pagos = (t) => (t.db.faturas_parciais?.length ?? 0) + (t.db.faturas_pagas?.length ?? 0)

;(async () => {
  // 1. Dívidas: a seção, pagar parte da fatura
  {
    const { t, p, erros } = await abrir()
    try {
      await p.goto(t.url + '#/dividas'); await p.waitForTimeout(2500)
      const itens = p.locator('.fcd-item')
      ok(await itens.count() > 0, `Dívidas mostra as faturas a pagar (${await itens.count()})`)
      const nome = await itens.first().locator('.fcd-texto b').textContent()
      const falta = reais(await itens.first().locator('.fcd-valor b').textContent())
      await itens.first().getByRole('button', { name: 'Pagar fatura' }).click(); await p.waitForTimeout(600)
      const campo = p.locator('.modal input[inputmode="decimal"]').first()
      ok(Math.abs(reais(await campo.inputValue()) - falta) < 0.02, `o pagamento abre com o que falta da ${nome} (${falta})`)
      ok(/^Fatura de \S+ do /.test(nome), `Dívidas diz de qual mês é a fatura (${nome})`)
      await campo.fill(String(Math.round((falta + 50) * 100)))
      ok(/mais do que falta/.test(await p.locator('.modal').textContent()), 'avisa quando o valor passa do que falta')
      const metade = Math.round(falta * 50) / 100
      // o campo é de dinheiro, como caixa registradora: os dígitos entram em centavos
      await campo.fill(String(Math.round(metade * 100)))
      const antes = pagos(t)
      await p.locator('.modal button[type=submit]').click(); await p.waitForTimeout(1500)
      ok(pagos(t) === antes + 1 && (t.db.faturas_parciais ?? []).some((x) => Math.abs(x.valor - metade) < 0.02), `pagar a metade grava um pagamento de parte (${metade}), igual à tela Cartões`)
      const agora = reais(await p.locator('.fcd-item', { hasText: nome }).first().locator('.fcd-valor b').textContent())
      ok(Math.abs(agora - (falta - metade)) < 0.02, `a fatura continua em Dívidas só com o que falta (${agora})`)
      ok(/já pagou/.test(await p.locator('.fcd-item', { hasText: nome }).first().textContent()), 'e mostra quanto já foi pago')
      await p.locator('.fcd-item', { hasText: nome }).first().getByRole('button', { name: 'Ver no cartão' }).click(); await p.waitForTimeout(1500)
      ok(/#\/cartoes/.test(p.url()), '"Ver no cartão" leva para a tela Cartões')
      ok(!erros.length, `sem erro na página ${erros.join(' | ')}`)
    } finally { await t.fechar() }
  }
  // 2. Lançamentos: uma saída que paga a fatura
  {
    const { t, p, erros } = await abrir()
    try {
      await p.goto(t.url + '#/lancamentos'); await p.waitForTimeout(2500)
      await p.locator('.lc-btn-saida').first().click(); await p.waitForTimeout(700)
      await p.locator('.modal input[inputmode="decimal"]').first().fill('10000')
      const campo = p.locator('.modal label.campo', { hasText: 'Isso paga ou empresta' })
      await campo.locator('.escolha-gatilho').click(); await p.waitForTimeout(300)
      const opcao = p.locator('[role=listbox] [role=option]', { hasText: 'Fatura de' }).first()
      ok(await opcao.count() > 0, '"Isso paga…" lista as faturas do cartão')
      ok(/Fatura de \S+ do .+ · vence .+ · falta/.test(await opcao.textContent()), `a opção diz de qual mês é a fatura e quando vence (${(await opcao.textContent()).trim()})`)
      await opcao.click(); await p.waitForTimeout(300)
      ok(/vira o pagamento desta fatura/.test(await campo.textContent()), 'avisa que vira o pagamento da fatura e não um gasto')
      const lancsAntes = t.db.lancamentos.length, antes = pagos(t)
      await p.locator('.modal form.form').evaluate((f) => f.requestSubmit()); await p.waitForTimeout(900)
      const valor = await p.locator('.modal input[inputmode="decimal"]').first().inputValue()
      ok(reais(valor) === 100, `abre o pagamento da fatura já com os R$ 100 (${valor})`)
      await p.locator('.modal button[type=submit]').click(); await p.waitForTimeout(1500)
      ok(pagos(t) === antes + 1 && t.db.lancamentos.length === lancsAntes, 'grava o pagamento da fatura e nenhuma saída a mais (as compras já contam)')
      ok(!erros.length, `sem erro na página ${erros.join(' | ')}`)
    } finally { await t.fechar() }
  }
  // 3. Planejamento: "Já paguei" na fatia da fatura
  {
    const { t, p, erros } = await abrir()
    try {
      await p.goto(t.url + '#/analise'); await p.waitForTimeout(2600)
      await p.locator('.pj-cartao button').first().click(); await p.waitForTimeout(800)
      await p.getByRole('button', { name: /Montar pra mim/ }).click(); await p.waitForTimeout(500)
      await p.getByRole('button', { name: /Salvar plano/ }).first().click(); await p.waitForTimeout(800)
      const fatia = p.locator('.pj-fatia[title^="Fatura do"]').first()
      ok(await fatia.count() > 0, 'o plano tem a fatia de uma fatura')
      const nome = (await fatia.getAttribute('title')).split(':')[0]
      await fatia.click(); await p.waitForTimeout(400)
      ok(await p.locator('.pj-pagar-fatura').count() === 1, 'a fatia da fatura oferece "Já paguei"')
      await p.locator('.pj-pagar-fatura').click(); await p.waitForTimeout(900)
      ok(await p.locator('.pj').count() === 0 && await p.locator('.modal button[type=submit]').count() === 1, 'a mesa sai e abre o pagamento da fatura')
      const antes = pagos(t)
      await p.locator('.modal input[inputmode="decimal"]').first().inputValue()
      await p.locator('.modal button[type=submit]').click(); await p.waitForTimeout(2500)
      ok(pagos(t) === antes + 1, 'grava o pagamento')
      ok(await p.locator('.pj').count() === 1, 'a mesa volta sozinha depois de pagar')
      const paga = p.locator('.pj-fatia.paga', { hasText: nome.replace('Fatura do ', '') })
      ok(await paga.count() > 0, `a fatia de ${nome} fica travada como paga`)
      ok(!erros.length, `sem erro na página ${erros.join(' | ')}`)
    } finally { await t.fechar() }
  }
  // 5. Pagar pela conta de um banco: o valor sai do saldo da conta dele; Lançamentos mostra os pagamentos da fatura quitada
  {
    const { t, p, erros } = await abrir()
    try {
      await p.goto(t.url + '#/dividas'); await p.waitForTimeout(2500)
      const hoje = new Date(), aqui = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
      const item = p.locator('.fcd-item:not(.atrasada)').first()
      const falta = reais(await item.locator('.fcd-valor b').textContent())
      await item.getByRole('button', { name: 'Pagar fatura' }).click(); await p.waitForTimeout(600)
      const conta = p.locator('.modal .chips .cc-origem', { hasText: 'Da conta' })
      if (await conta.count()) await conta.click()
      await p.locator('.modal label.campo', { hasText: 'De qual banco saiu' }).locator('.escolha-gatilho').click(); await p.waitForTimeout(300)
      await p.locator('[role=listbox] [role=option]').filter({ hasNotText: 'Não sei' }).first().click(); await p.waitForTimeout(300)
      ok(/sai do saldo da conta deste banco/.test(await p.locator('.modal').textContent()), 'o pagamento avisa que sai do saldo da conta')
      const caixa = () => {
        const m = t.db.meses.find((x) => x.ano === hoje.getFullYear() && x.mes === hoje.getMonth() + 1)
        return JSON.parse(JSON.stringify(m?.caixa ?? {}))
      }
      const antes = caixa()
      await p.locator('.modal button[type=submit]').click(); await p.waitForTimeout(2000)
      const depois = caixa()
      const mudou = Object.keys(depois).filter((b) => Math.abs((depois[b]?.cc ?? 0) - (antes[b]?.cc ?? 0)) > 0.005)
      const delta = mudou.length === 1 ? (depois[mudou[0]].cc ?? 0) - (antes[mudou[0]]?.cc ?? 0) : null
      ok(delta !== null && Math.abs(delta + falta) < 0.02, `o saldo da conta do banco cai ${falta} no mês do pagamento (${delta})`)
      const quitada = (t.db.faturas_pagas ?? []).at(-1)
      ok(quitada && quitada.saldo_mexido === true && quitada.da_caixinha === false, 'o pagamento fica marcado como já descontado do saldo (para desfazer certo)')
      await p.goto(t.url + '#/lancamentos'); await p.waitForTimeout(2200)
      const nota = await p.locator('.lc-nota-cartao').first().textContent().catch(() => '')
      ok(/está paga: R\$\s?[\d.,]+ em /.test(nota), `Lançamentos mostra o pagamento da fatura quitada, com o dia (${nota.trim().slice(0, 160)})`)
      ok(!erros.length, `sem erro na página ${erros.join(' | ')}`)
    } finally { await t.fechar() }
  }
  // 4. Celular: a seção em Dívidas
  {
    const { t, p, erros } = await abrir({ toque: true, largura: 390 })
    try {
      await p.goto(t.url + '#/dividas'); await p.waitForTimeout(2600)
      ok(await p.locator('.fcd-item').count() > 0, 'celular: Dívidas mostra as faturas a pagar')
      const largo = await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)
      ok(largo, 'celular: nada passa da largura da tela')
      ok(!erros.length, `sem erro na página ${erros.join(' | ')}`)
    } finally { await t.fechar() }
  }
  process.exitCode = falhas ? 1 : 0
})()
