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
})()
