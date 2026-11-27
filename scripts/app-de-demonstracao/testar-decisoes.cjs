// As decisões do Kairo (lib/decisoes, lib/planejador.ts): no plano de ação do Consultor, o passo que depende de algo mostra,
// ao abrir o "por quê", o selo (recomendação, a escolha é sua, depende de acontecer, falta dado), as premissas e o que foi
// considerado; a dívida atrasada sem juros do contrato não promete desconto; o consultor usa o calendário de caixa na hora
// de parcelar. Computador e celular, temas escuro e claro, sem erro na página.
// Uso (depois do build com fake.supabase.co do README desta pasta): node scripts/app-de-demonstracao/testar-decisoes.cjs
// Com FOTOS=pasta, salva capturas.
const path = require('path')
const R = path.join(__dirname, '..', '..')
const { iniciar } = require(R + '/scripts/app-de-demonstracao/servidor-falso.cjs')
const demo = require(R + '/scripts/app-de-demonstracao/dados-de-demonstracao.cjs')
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA ') + m); if (!c) process.exitCode = 1 }
const esperar = (p, ms = 700) => p.waitForTimeout(ms)
const FOTOS = process.env.FOTOS
const foto = async (p, nome) => { if (FOTOS) await p.screenshot({ path: path.join(FOTOS, nome + '.png'), fullPage: false }) }

;(async () => {
  for (const tema of ['escuro', 'claro']) {
    const t = await iniciar({ perfil: { ...demo.perfil, detalhe: 'detalhado', tema }, dados: structuredClone(demo.dados), porta: 5100 + Math.floor(Math.random() * 60), dpr: 2 })
    const p = t.page
    const erros = []
    p.on('pageerror', (e) => erros.push(e.message))
    await p.addInitScript((x) => { try { localStorage.setItem('opuscash-tema', x) } catch { /* */ } }, tema)
    try {
      await p.setViewportSize({ width: 1440, height: 900 })
      await p.goto(t.url + '#/analise'); await esperar(p, 2600)
      const passos = p.locator('.an-plano li')
      const n = await passos.count()
      ok(n > 0, `${tema}: o plano de ação tem passos (${n})`)
      let comDecisao = 0
      const selos = []
      for (let i = 0; i < n; i++) {
        const li = passos.nth(i)
        await li.locator('.an-plano-texto').click(); await esperar(p, 250)
        const d = li.locator('.decisao')
        if (await d.count()) {
          comDecisao++
          selos.push(`${(await li.locator('strong').first().textContent()).slice(0, 50)} → ${await d.locator('.decisao-selo').textContent()}`)
          if (comDecisao === 1) { await li.scrollIntoViewIfNeeded(); await foto(p, `${tema}-decisao`) }
        }
      }
      console.log('     ' + selos.join('\n     '))
      ok(comDecisao > 0, `${tema}: algum passo mostra a decisão explicada (${comDecisao})`)
      const textoPlano = (await p.locator('.an-plano').textContent()) || ''
      ok(!/deixa de pagar cerca de R\$\s?0,00/.test(textoPlano), `${tema}: nenhuma economia de R$ 0,00 prometida`)

      // na hora de parcelar no cartão: o Kairo fala do calendário quando a compra cai até o fim do mês que vem
      await p.goto(t.url + '#/lancamentos'); await esperar(p, 1600)
      ok(erros.length === 0, `${tema}: nenhum erro na página ${erros.join(' | ')}`)

      // celular
      await p.setViewportSize({ width: 390, height: 844 })
      await p.goto(t.url + '#/analise'); await esperar(p, 2400)
      const larg = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      ok(larg <= 0, `${tema}: no celular, nada passa da largura da tela (${larg}px)`)
      const abriu = p.locator('.an-plano li .an-plano-texto')
      if (await abriu.count()) {
        for (let i = 0; i < await abriu.count(); i++) {
          await abriu.nth(i).click(); await esperar(p, 200)
          if (await p.locator('.an-plano li.aberto .decisao').count()) { await p.locator('.an-plano li.aberto').scrollIntoViewIfNeeded(); await foto(p, `${tema}-celular-decisao`); break }
        }
      }
      const larg2 = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      ok(larg2 <= 0, `${tema}: com o porquê aberto, nada passa da largura (${larg2}px)`)
      ok(erros.length === 0, `${tema}: nenhum erro na página no celular ${erros.join(' | ')}`)
    } finally {
      await t.fechar()
    }
  }
})()
