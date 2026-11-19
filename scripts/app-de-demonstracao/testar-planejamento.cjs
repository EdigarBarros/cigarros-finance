// Planejamento do mês (src/components/Planejamento.tsx): o cartão no Consultor abre a mesa; arrastar uma conta para dentro
// de uma entrada cria a fatia (e a moedinha voa), puxar a borda paga menos, "Montar pra mim" cobre as contas, o plano fica
// guardado depois de recarregar e o Consultor passa a falar dele. No celular: tocar na conta e depois na entrada, a bandeja
// presa embaixo, sem rolagem para o lado. Nada pode dar erro na página.
// Uso (depois do build com fake.supabase.co do README desta pasta): node scripts/app-de-demonstracao/testar-planejamento.cjs
// Com FOTOS=pasta, salva capturas.
const path = require('path')
const R = path.join(__dirname, '..', '..')
const { iniciar } = require(R + '/scripts/app-de-demonstracao/servidor-falso.cjs')
const demo = require(R + '/scripts/app-de-demonstracao/dados-de-demonstracao.cjs')
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA ') + m); if (!c) process.exitCode = 1 }
const esperar = (p, ms = 700) => p.waitForTimeout(ms)
const FOTOS = process.env.FOTOS
const foto = async (p, nome, inteira = false) => { if (FOTOS) await p.screenshot({ path: path.join(FOTOS, nome + '.png'), fullPage: inteira }) }

const estado = (p) => p.evaluate(() => ({
  fontes: [...document.querySelectorAll('.pj-entrada')].map((e) => e.querySelector('.pj-entrada-nome b')?.textContent),
  fichas: [...document.querySelectorAll('.pj-ficha')].map((e) => e.dataset.conta),
  fatias: [...document.querySelectorAll('.pj-fatia')].map((e) => ({ nome: e.querySelector('b')?.textContent, valor: e.querySelector('small')?.textContent, w: e.getBoundingClientRect().width })),
  pct: document.querySelector('.pj-anel')?.getAttribute('aria-label'),
}))

;(async () => {
  for (const tema of ['escuro', 'claro']) {
    const t = await iniciar({ perfil: { ...demo.perfil, detalhe: 'equilibrado', tema }, dados: demo.dados, porta: 4900 + Math.floor(Math.random() * 60), dpr: 1 })
    const p = t.page
    const erros = []
    p.on('pageerror', (e) => erros.push(e.message))
    await p.addInitScript((x) => { try { localStorage.setItem('opuscash-tema', x === 'escuro' ? 'escuro' : 'claro') } catch { /* */ } }, tema)
    try {
      // ---------- computador ----------
      await p.setViewportSize({ width: 1440, height: 900 })
      await p.goto(t.url + '#/analise'); await esperar(p, 2600)
      const cartao = p.locator('.pj-cartao')
      ok(await cartao.count() === 1, `${tema}: o cartão "Planejar o mês" aparece no Consultor`)
      await foto(p, `${tema}-consultor`)
      await cartao.locator('button').click(); await esperar(p, 700)
      let s = await estado(p)
      ok(s.fontes.length > 0, `${tema}: a mesa mostra as entradas (${s.fontes.join(', ')})`)
      ok(s.fichas.length > 0, `${tema}: as contas sem dinheiro estão na bandeja (${s.fichas.length})`)
      await foto(p, `${tema}-mesa-vazia`)

      // arrastar a primeira conta para a primeira entrada
      const ficha = p.locator('.pj-ficha').first(), barra = p.locator('.pj-entrada .pj-barra').first()
      const a = await ficha.boundingBox(), b = await barra.boundingBox()
      await p.mouse.move(a.x + 30, a.y + 20); await p.mouse.down()
      await p.mouse.move(a.x - 60, a.y + 10, { steps: 6 })
      const fantasma = await p.locator('.pj-fantasma').count()
      await p.mouse.move(b.x + b.width * 0.6, b.y + b.height / 2, { steps: 10 })
      const mira = await p.locator('.pj-entrada.mira').count()
      await foto(p, `${tema}-arrastando`)
      await p.mouse.up(); await esperar(p, 400)
      ok(fantasma === 1, `${tema}: a conta segue o mouse enquanto arrasta`)
      ok(mira === 1, `${tema}: a entrada embaixo do mouse acende`)
      s = await estado(p)
      ok(s.fatias.length === 1, `${tema}: soltar cria a fatia (${JSON.stringify(s.fatias[0])})`)
      await foto(p, `${tema}-fatia`)

      // puxar a borda para a esquerda: paga menos
      const antes = s.fatias[0]
      const borda = await p.locator('.pj-puxador').first().boundingBox()
      if (borda && antes.w > 60) {
        await p.mouse.move(borda.x + borda.width / 2, borda.y + borda.height / 2); await p.mouse.down()
        await p.mouse.move(borda.x - antes.w * 0.4, borda.y + borda.height / 2, { steps: 8 }); await p.mouse.up(); await esperar(p, 500)
        const depois = (await estado(p)).fatias[0]
        ok(depois && depois.w < antes.w - 5 && depois.valor !== antes.valor, `${tema}: puxar a borda diminui a fatia (${antes.valor} → ${depois?.valor})`)
      } else ok(true, `${tema}: fatia estreita, sem borda para puxar`)

      // tocar na fatia abre o ajuste; "Metade"
      await p.locator('.pj-fatia').first().click(); await esperar(p, 300)
      ok(await p.locator('.pj-ajuste').count() === 1, `${tema}: tocar na fatia abre o ajuste`)
      await foto(p, `${tema}-ajuste`)
      await p.getByRole('button', { name: 'Pronto' }).click(); await esperar(p, 300)

      // montar pra mim
      await p.getByRole('button', { name: 'Montar pra mim' }).click(); await esperar(p, 1200)
      s = await estado(p)
      ok(s.fatias.length >= 2, `${tema}: "Montar pra mim" distribui (${s.fatias.length} fatias, ${s.pct})`)
      await foto(p, `${tema}-montado`)
      ok(await p.locator('.pj-dicas li').count() > 0, `${tema}: o Consultor comenta o plano`)

      // o Consultor fica numa coluna própria: à esquerda do dinheiro na tela larga
      const colunas = await p.evaluate(() => {
        const c = document.querySelector('.pj-consultor')?.getBoundingClientRect(), e = document.querySelector('.pj-entradas')?.getBoundingClientRect()
        return c && e ? { consultorAEsquerda: c.right <= e.left + 1, lado: c.left < e.left } : null
      })
      ok(colunas?.consultorAEsquerda, `${tema}: em 1440 px o Consultor fica ao lado do dinheiro, à esquerda`)

      // mudança sem salvar: o X pergunta; "Continuar mexendo" volta; "Salvar plano" grava
      ok(await p.locator('.pj-gravar').count() === 1, `${tema}: com mudança, aparecem Salvar plano e Descartar`)
      await p.locator('.pj-fechar').click(); await esperar(p, 400)
      ok(await p.locator('.pj-pergunta').count() === 1, `${tema}: fechar com mudança sem salvar pergunta antes`)
      await foto(p, `${tema}-pergunta`)
      await p.getByRole('button', { name: 'Continuar mexendo' }).click(); await esperar(p, 300)
      ok(await p.locator('.pj').count() === 1 && await p.locator('.pj-pergunta').count() === 0, `${tema}: "Continuar mexendo" volta para a mesa`)
      await p.locator('.pj-gravar').click(); await esperar(p, 500)
      ok(await p.locator('.pj-salvo').count() === 1, `${tema}: depois de salvar, aparece "Plano salvo"`)

      // descartar: volta ao salvo
      await p.getByRole('button', { name: 'Recomeçar' }).click(); await esperar(p, 300)
      ok((await estado(p)).fatias.length === 0, `${tema}: recomeçar limpa a mesa (ainda sem salvar)`)
      await p.locator('.pj-descartar').first().click(); await esperar(p, 500)
      ok((await estado(p)).fatias.length === s.fatias.length, `${tema}: "Descartar" volta ao último plano salvo`)

      // fechar, recarregar: o plano salvo continua
      await p.locator('.pj-fechar').click(); await esperar(p, 400)
      ok(await p.locator('.pj').count() === 0, `${tema}: sem mudança, o X fecha direto`)
      await p.reload(); await esperar(p, 2600)
      ok(/Continuar o plano/.test(await p.locator('.pj-cartao').textContent()), `${tema}: depois de recarregar, o cartão diz "Continuar o plano"`)
      await p.locator('.pj-cartao button').click(); await esperar(p, 700)
      ok((await estado(p)).fatias.length === s.fatias.length, `${tema}: o plano guardado volta igual`)
      await p.keyboard.press('Escape'); await esperar(p, 300)
      ok(await p.locator('.pj').count() === 0, `${tema}: Esc fecha a mesa`)

      // ---------- celular ----------
      await p.setViewportSize({ width: 390, height: 844 })
      await p.goto(t.url + '#/analise'); await esperar(p, 2200)
      const abrir = p.locator('.pj-cartao button')
      await abrir.scrollIntoViewIfNeeded(); await abrir.click(); await esperar(p, 700)
      await p.getByRole('button', { name: 'Recomeçar' }).click(); await esperar(p, 300)
      const presa = await p.evaluate(() => getComputedStyle(document.querySelector('.pj-bandeja')).position)
      ok(presa === 'fixed', `${tema}: no celular a bandeja fica presa embaixo`)
      await p.locator('.pj-ficha').first().click(); await esperar(p, 250)
      ok(await p.locator('.pj-ficha.escolhida').count() === 1, `${tema}: tocar numa conta escolhe ela`)
      ok(await p.locator('.pj-entrada.alvo').count() > 0, `${tema}: as entradas que recebem acendem`)
      await foto(p, `${tema}-cel-escolhida`)
      await p.locator('.pj-entrada.alvo').first().click(); await esperar(p, 500)
      ok((await estado(p)).fatias.length === 1, `${tema}: tocar na entrada põe a conta nela`)
      const lado = await p.evaluate(() => document.querySelector('.pj').scrollWidth > document.querySelector('.pj').clientWidth)
      ok(!lado, `${tema}: sem rolagem para o lado no celular`)
      await foto(p, `${tema}-cel`)
      ok(!erros.length, `${tema}: nenhum erro na página ${erros.join(' | ')}`)
    } finally {
      await t.fechar()
    }
  }
})()
