// Planejamento do mês: "Contar com quem me deve". O que te devem (o Rafael, na demonstração) fica fora até ligar o
// interruptor; ligado, vira uma barra "A receber: Rafael" que paga contas; desligar tira o que ele pagava; a escolha fica
// salva com o plano. No computador e no celular, nos dois temas, sem erro na página.
// Uso (depois do build com fake.supabase.co do README desta pasta): node scripts/app-de-demonstracao/testar-a-receber.cjs
// Com FOTOS=pasta, salva capturas.
const path = require('path')
const R = path.join(__dirname, '..', '..')
const { iniciar } = require(R + '/scripts/app-de-demonstracao/servidor-falso.cjs')
const demo = require(R + '/scripts/app-de-demonstracao/dados-de-demonstracao.cjs')
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA ') + m); if (!c) process.exitCode = 1 }
const esperar = (p, ms = 700) => p.waitForTimeout(ms)
const FOTOS = process.env.FOTOS
const foto = async (p, nome) => { if (FOTOS) await p.screenshot({ path: path.join(FOTOS, nome + '.png') }) }
const nomes = (p) => p.evaluate(() => [...document.querySelectorAll('.pj-entrada')].map((e) => e.querySelector('.pj-entrada-nome b')?.textContent))

;(async () => {
  for (const [tema, celular] of [['escuro', false], ['claro', true]]) {
    const t = await iniciar({ perfil: { ...demo.perfil, detalhe: 'equilibrado', tema }, dados: demo.dados, porta: 4900 + Math.floor(Math.random() * 60), dpr: 1 })
    const p = t.page
    const erros = []
    p.on('pageerror', (e) => erros.push(e.message))
    try {
      await p.setViewportSize(celular ? { width: 390, height: 844 } : { width: 1440, height: 900 })
      await p.goto(t.url + '#/analise'); await esperar(p, 2600)
      await p.locator('.pj-cartao button').first().click(); await esperar(p, 800)
      const chave = p.locator('.pj-guardado.a-receber')
      ok(await chave.count() === 1, `${tema}: o interruptor "Contar com quem me deve" aparece (${await chave.locator('small').textContent().catch(() => '')})`)
      let n = await nomes(p)
      ok(!n.some((x) => x?.startsWith('A receber')), `${tema}: desligado, o Rafael fica fora das entradas (${n.join(', ')})`)
      await foto(p, `${tema}-desligado`)
      await chave.click(); await esperar(p, 600)
      n = await nomes(p)
      ok(n.includes('A receber: Rafael'), `${tema}: ligado, entra a barra do Rafael (${n.join(', ')})`)
      const sub = await p.locator('.pj-entrada.a-receber small').first().textContent()
      ok(/ficou de pagar|sem dia combinado/.test(sub), `${tema}: a barra diz quando cai (${sub})`)
      // pôr uma conta na barra do Rafael (toque na conta, depois na barra)
      await p.locator('.pj-ficha.conta').first().click(); await esperar(p, 300)
      await p.locator('.pj-entrada.a-receber').first().click(); await esperar(p, 600)
      const fatias = await p.locator('.pj-entrada.a-receber .pj-fatia').count()
      ok(fatias === 1, `${tema}: a conta entra na barra do Rafael`)
      await foto(p, `${tema}-ligado`)
      // salvar, recarregar: continua ligado
      await p.locator('button', { hasText: 'Salvar plano' }).first().click(); await esperar(p, 600)
      await p.reload(); await esperar(p, 2600)
      await p.locator('.pj-cartao button').first().click(); await esperar(p, 800)
      ok(await p.locator('.pj-guardado.a-receber.ligado').count() === 1 && await p.locator('.pj-entrada.a-receber .pj-fatia').count() === 1,
        `${tema}: depois de recarregar, o plano lembra a escolha e a fatia`)
      // desligar: a fatia some e a conta volta para a bandeja
      await p.locator('.pj-guardado.a-receber').click(); await esperar(p, 600)
      ok(await p.locator('.pj-entrada.a-receber').count() === 0, `${tema}: desligar tira a barra do Rafael`)
      const largura = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      ok(largura <= 0, `${tema}: sem rolagem para o lado (${largura})`)
      ok(!erros.length, `${tema}: sem erro na página ${erros.join(' | ')}`)
    } finally { await t.fechar() }
  }
})()
