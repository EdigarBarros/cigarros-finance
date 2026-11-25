// Planejamento do mês: a fatura que já foi paga em parte entra só com o que falta (antes entrava com o valor inteiro).
// Uso (depois do build com fake.supabase.co do README desta pasta): node scripts/app-de-demonstracao/testar-fatura-em-parte.cjs
const path = require('path')
const R = path.join(__dirname, '..', '..')
const { iniciar } = require(R + '/scripts/app-de-demonstracao/servidor-falso.cjs')
const demo = require(R + '/scripts/app-de-demonstracao/dados-de-demonstracao.cjs')
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA ') + m); if (!c) process.exitCode = 1 }
const valorEmReais = (t) => Number(t.replace(/[^\d,]/g, '').replace(',', '.'))

async function telaLancamentos(dados) {
  const t = await iniciar({ perfil: { ...demo.perfil, detalhe: 'equilibrado' }, dados, porta: 4900 + Math.floor(Math.random() * 60), dpr: 1 })
  try {
    await t.page.setViewportSize({ width: 1440, height: 900 })
    await t.page.goto(t.url + '#/lancamentos'); await t.page.waitForTimeout(2600)
    return await t.page.locator('.lc-nota-cartao').first().textContent().catch(() => '')
  } finally { await t.fechar() }
}

async function fichaDaFatura(dados) {
  const t = await iniciar({ perfil: { ...demo.perfil, detalhe: 'equilibrado' }, dados, porta: 4900 + Math.floor(Math.random() * 60), dpr: 1 })
  const p = t.page
  const erros = []
  p.on('pageerror', (e) => erros.push(e.message))
  try {
    await p.setViewportSize({ width: 1440, height: 900 })
    await p.goto(t.url + '#/analise'); await p.waitForTimeout(2600)
    await p.locator('.pj-cartao button').first().click(); await p.waitForTimeout(800)
    const fichas = await p.$$eval('.pj-ficha', (xs) => xs.map((x) => ({ nome: x.querySelector('b')?.textContent, valor: x.querySelector('.pj-ficha-valor')?.textContent ?? '' })))
    return { ficha: fichas.find((f) => f.nome?.startsWith('Fatura do')), erros }
  } finally { await t.fechar() }
}

;(async () => {
  const antes = await fichaDaFatura(demo.dados)
  ok(!!antes.ficha, `a fatura aparece na mesa (${JSON.stringify(antes.ficha)})`)
  if (!antes.ficha) return
  const cheia = valorEmReais(antes.ficha.valor)
  // descobre de qual cartão e mês é essa fatura e paga metade dela em parte
  const nome = antes.ficha.nome.replace('Fatura do ', '')
  const cartao = demo.dados.cartoes.find((c) => c.nome === nome)
  const hoje = new Date().toISOString().slice(0, 10)
  const compra = demo.dados.lancamentos.filter((l) => l.cartao_id === cartao.id && l.data && l.data >= hoje).sort((a, b) => a.data.localeCompare(b.data))[0]
  const metade = Math.round(cheia * 50) / 100
  const dados = { ...demo.dados, faturas_parciais: [{ id: 'fp-1', user_id: cartao.user_id, cartao_id: cartao.id, ano: compra.ano, mes: compra.mes, valor: metade, pago_em: hoje, banco_id: null, da_caixinha: false, saldo_mexido: false, created_at: hoje + 'T00:00:00Z' }] }
  const depois = await fichaDaFatura(dados)
  const resto = valorEmReais(depois.ficha?.valor ?? '0')
  ok(Math.abs(resto - (cheia - metade)) < 0.02, `paga ${metade} em parte, a mesa mostra só o que falta: ${cheia} → ${resto}`)
  const aviso = await telaLancamentos(dados)
  ok(/já pagou R\$\s495,00 e faltam R\$\s495,00/i.test(aviso), `Lançamentos: o aviso do cartão diz quanto já pagou e quanto falta (${aviso.trim()})`)
  ok(!antes.erros.length && !depois.erros.length, `sem erro na página ${[...antes.erros, ...depois.erros].join(' | ')}`)
})()
