// O Cairo (src/cairo) dentro do app: a análise do Consultor roda o núcleo novo junto (analise.cairo). Confere, pelo
// diagnóstico sem dado financeiro (globalThis.__cairo), que ele leu sem erro, quanto tempo levou e que nenhuma regra de
// contagem foi violada; e que Início, Consultor e Planejamento abrem sem erro na página (computador e celular).
// Uso (depois do build com fake.supabase.co do README desta pasta): node scripts/app-de-demonstracao/testar-cairo.cjs
const path = require('path')
const R = path.join(__dirname, '..', '..')
const { iniciar } = require(R + '/scripts/app-de-demonstracao/servidor-falso.cjs')
const demo = require(R + '/scripts/app-de-demonstracao/dados-de-demonstracao.cjs')
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA ') + m); if (!c) process.exitCode = 1 }
const esperar = (p, ms = 700) => p.waitForTimeout(ms)

;(async () => {
  for (const largura of [1440, 390]) {
    const t = await iniciar({ perfil: demo.perfil, dados: structuredClone(demo.dados), porta: 5100 + Math.floor(Math.random() * 60), dpr: 1 })
    const p = t.page
    const erros = []
    p.on('pageerror', (e) => erros.push(e.message))
    p.on('console', (m) => { if (m.type() === 'error' && /Cairo/.test(m.text())) erros.push(m.text()) })
    try {
      await p.setViewportSize({ width: largura, height: largura > 500 ? 900 : 844 })
      await p.goto(t.url + '#/inicio'); await esperar(p, 2600)
      const d = await p.evaluate(() => globalThis.__cairo ?? null)
      ok(d && d.ok, `${largura}px: o Cairo leu os dados da Marina sem erro (${d ? `${d.ms} ms, versão ${d.versao}` : 'sem diagnóstico'})`)
      ok(d && d.violacoes === 0, `${largura}px: nenhuma regra de contagem única violada`)
      ok(d && d.mesesNoFluxo >= 3, `${largura}px: os meses da Marina entram nas médias (${d?.mesesNoFluxo})`)
      ok(d && d.ms < 400, `${largura}px: leitura em menos de 400 ms (${d?.ms} ms)`)
      for (const tela of ['analise', 'lancamentos', 'dividas', 'inicio']) {
        await p.goto(t.url + `#/${tela}`); await esperar(p, 1500)
        const x = await p.evaluate(() => globalThis.__cairo ?? null)
        ok(x && x.ok, `${largura}px: ${tela} abre e o Cairo continua lendo (${x?.ms} ms)`)
      }
      const lado = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      ok(lado <= 1, `${largura}px: sem rolagem para o lado`)
      ok(erros.length === 0, `${largura}px: nenhum erro na página${erros.length ? ': ' + erros.join(' | ') : ''}`)
    } finally {
      await t.fechar()
    }
  }
  // ---------- "Outubro está todo lançado?": a Marina com quase nada lançado em outubro ----------
  for (const largura of [1440, 390]) {
    const dados = structuredClone(demo.dados)
    let deixou = 0
    // deixa só 2 saídas em outubro (o normal dela é umas 12): poucas saídas, de propósito
    dados.lancamentos = dados.lancamentos.filter((l) => !(l.ano === 2026 && l.mes === 10 && l.tipo === 'saida' && deixou++ >= 2))
    const t = await iniciar({ perfil: demo.perfil, dados, porta: 5200 + Math.floor(Math.random() * 60), dpr: 1 })
    const p = t.page
    const erros = []
    p.on('pageerror', (e) => erros.push(e.message))
    try {
      await p.setViewportSize({ width: largura, height: largura > 500 ? 900 : 844 })
      await p.goto(t.url + '#/analise'); await esperar(p, 2800)
      const cartao = p.locator('.pergunta-mes').first()
      ok(await cartao.count() > 0, `${largura}px: o Consultor pergunta sobre o mês com poucas saídas`)
      const texto = (await cartao.innerText()).replace(/\s+/g, ' ')
      ok(/outubro/i.test(texto), `${largura}px: a pergunta fala de outubro ("${texto.slice(0, 90)}…")`)
      await p.getByRole('button', { name: 'Está tudo lançado' }).click(); await esperar(p, 1200)
      ok(/Anotado: outubro está todo lançado/.test(await p.locator('.pergunta-mes').first().innerText()), `${largura}px: a resposta é anotada`)
      await p.reload(); await esperar(p, 2800)
      ok(await p.locator('.pergunta-mes').count() === 0, `${largura}px: depois de recarregar, a pergunta não volta (a resposta ficou no perfil)`)
      const lado = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      ok(lado <= 1, `${largura}px: sem rolagem para o lado`)
      ok(erros.length === 0, `${largura}px: nenhum erro na página${erros.length ? ': ' + erros.join(' | ') : ''}`)
    } finally {
      await t.fechar()
    }
  }
  // ---------- desfazer ----------
  {
    const dados = structuredClone(demo.dados)
    let deixou = 0
    dados.lancamentos = dados.lancamentos.filter((l) => !(l.ano === 2026 && l.mes === 10 && l.tipo === 'saida' && deixou++ >= 2))
    const t = await iniciar({ perfil: demo.perfil, dados, porta: 5300 + Math.floor(Math.random() * 60), dpr: 1 })
    const p = t.page
    try {
      await p.setViewportSize({ width: 1280, height: 900 })
      await p.goto(t.url + '#/analise'); await esperar(p, 2800)
      await p.getByRole('button', { name: 'Faltou lançar' }).click(); await esperar(p, 1000)
      ok(/Anotado: faltou lançar em outubro/.test(await p.locator('.pergunta-mes').first().innerText()), 'faltou lançar: anotado')
      await p.getByRole('button', { name: 'Desfazer' }).click(); await esperar(p, 1200)
      ok(await p.getByRole('button', { name: 'Está tudo lançado' }).count() > 0, 'desfazer: a pergunta volta')
    } finally {
      await t.fechar()
    }
  }
})()
