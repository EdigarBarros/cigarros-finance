// Dívidas em espera (migração 45): a dívida continua na página Dívidas, à parte, e soma no total geral, mas sai do
// consultor e dos números de cima; "Pôr em espera" e "Voltar a contar" gravam na dívida. No celular: a seção à parte e
// sem rolagem para o lado. Nada pode dar erro na página.
// Uso (depois do build com fake.supabase.co do README desta pasta): node scripts/app-de-demonstracao/testar-dividas-em-espera.cjs
const path = require('path')
const R = path.join(__dirname, '..', '..')
const { iniciar } = require(R + '/scripts/app-de-demonstracao/servidor-falso.cjs')
const demo = require(R + '/scripts/app-de-demonstracao/dados-de-demonstracao.cjs')
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA ') + m); if (!c) process.exitCode = 1 }
const esperar = (p, ms = 700) => p.waitForTimeout(ms)
const EMPRESTIMO = 'd-0002-4000-8000-000000000000'

function dados() {
  const d = structuredClone(demo.dados)
  for (const x of d.dividas) x.em_espera = x.id === EMPRESTIMO
  return d
}

;(async () => {
  const t = await iniciar({ perfil: { ...demo.perfil, detalhe: 'detalhado' }, dados: dados(), porta: 5300 + Math.floor(Math.random() * 60), dpr: 1 })
  const p = t.page
  const erros = []
  p.on('pageerror', (e) => erros.push(e.message))
  try {
    await p.setViewportSize({ width: 1440, height: 900 })
    // ---------- Dívidas ----------
    await p.goto(t.url + '#/dividas'); await esperar(p, 1800)
    const secao = p.locator('.dv-espera')
    ok(await secao.count() === 1 && (await secao.textContent()).includes('Empréstimo pessoal'), 'a dívida em espera aparece na seção "Em espera"')
    ok((await p.locator('.dv-grade').first().textContent()).includes('Empréstimo pessoal') === false, 'e não na lista das ativas')
    const topo = await p.locator('.dv-vitrine').textContent()
    ok(topo.includes('Você deve nas dívidas ativas') && topo.includes('Total geral, com as em espera'), 'o topo mostra as ativas e o total geral')
    // pôr o financiamento em espera pela ficha
    await p.locator('.dv-cartao-corpo', { hasText: 'Financiamento do carro' }).first().click(); await esperar(p, 700)
    await p.getByRole('dialog').getByRole('button', { name: 'Pôr em espera' }).click(); await esperar(p, 700)
    ok(t.db.dividas.find((x) => x.descricao === 'Financiamento do carro').em_espera === true, '"Pôr em espera" grava na dívida')
    await p.getByRole('dialog').getByRole('button', { name: 'Voltar a contar' }).click(); await esperar(p, 700)
    ok(t.db.dividas.find((x) => x.descricao === 'Financiamento do carro').em_espera === false, '"Voltar a contar" desfaz')
    await p.keyboard.press('Escape'); await esperar(p, 400)

    // ---------- Consultor e Início não contam com ela ----------
    await p.goto(t.url + '#/analise'); await esperar(p, 2600)
    const b = p.locator('button', { hasText: 'Ver mais' }); if (await b.count()) { await b.first().click(); await esperar(p, 800) }
    const consultor = await p.locator('.pagina.analise').textContent()
    ok(!consultor.includes('Empréstimo pessoal'), 'o consultor não fala da dívida em espera')
    ok(consultor.includes('Financiamento do carro'), 'e continua falando das ativas')

    // ---------- celular ----------
    await p.setViewportSize({ width: 390, height: 844 })
    await p.goto(t.url + '#/dividas'); await esperar(p, 1800)
    ok((await p.locator('.dividas-movel').textContent()).includes('Em espera'), 'no celular, a seção "Em espera" aparece')
    const largura = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    ok(largura <= 1, `no celular, nada passa da largura da tela (${largura}px)`)
    ok(!erros.length, `nenhum erro na página${erros.length ? ` (${erros.join(' | ')})` : ''}`)
  } catch (e) {
    ok(false, e.message)
  } finally {
    await t.fechar()
  }
})()
