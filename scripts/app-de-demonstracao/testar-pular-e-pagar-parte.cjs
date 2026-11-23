// Pular compra, pagar parte da fatura e pagar com o cofrinho (migração 38), no app de verdade com o Supabase falso.
// Antes: build com fake.supabase.co (ver README desta pasta). Rodar: node scripts/app-de-demonstracao/testar-pular-e-pagar-parte.cjs
// FOTOS=pasta guarda as telas de cada passo. A data do navegador é a de hoje: a fatura do teste vence no fim do mês de hoje.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { iniciar } = require('./servidor-falso.cjs')
const demo = require('./dados-de-demonstracao.cjs')
const { expect } = require('playwright/test')

const pad = (n) => String(n).padStart(2, '0')
const hoje = new Date()
const ANO = hoje.getFullYear(), MES = hoje.getMonth() + 1
const prox = MES === 12 ? { ano: ANO + 1, mes: 1 } : { ano: ANO, mes: MES + 1 }
const ultimo = (a, m) => new Date(a, m, 0).getDate()
const venc = `${ANO}-${pad(MES)}-${pad(Math.min(30, ultimo(ANO, MES)))}`
const PP = 'b-0009-4000-8000-000000000000', CARTAO = 'k-0009-4000-8000-000000000000'
const fotos = process.env.FOTOS
const foto = async (page, nome) => { if (fotos) { await page.waitForTimeout(900); fs.mkdirSync(fotos, { recursive: true }); await page.screenshot({ path: path.join(fotos, `${nome}.png`) }) } }

/** A conta da Marina com um PicPay: fecha dia 25, vence dia 30, limite garantido ligado ao cofrinho (R$ 500 na caixinha). */
function dados() {
  const d = structuredClone(demo.dados)
  const U = d.bancos[0].user_id
  d.bancos.push({ id: PP, user_id: U, nome: 'PicPay', cor: '#21c25e', ordem: 3 })
  d.cartoes.push({ id: CARTAO, user_id: U, nome: 'PicPay', cor: '#21c25e', banco_id: PP, limite: 300, dia_fechamento: 25, dia_vencimento: 30, ativo: true, limite_garantido: 0, garantia_caixinha: true })
  for (const m of d.meses) m.caixa[PP] = { cc: 50, caixinha: 500 }
  const compra = (n, descricao, valor) => ({
    id: `l-99${n}0-4000-8000-000000000000`, user_id: U, ano: ANO, mes: MES, tipo: 'saida', descricao, valor, data: venc,
    data_compra: `${ANO}-${pad(MES)}-0${n}`, cartao_id: CARTAO, compra_id: `c-99${n}0-4000-8000-000000000000`, parcela: 1, parcelas: 1, categoria_id: null, banco_id: null,
  })
  d.lancamentos.push(compra(1, 'Mercado', 700), compra(2, 'Tênis', 100))
  return d
}

async function abrirPicPay(page, url) {
  await page.goto(url + '#/cartoes')
  await page.locator('.cc-carteira-item', { hasText: 'PicPay' }).locator('.cc-plastico, button, [role="button"]').first().click()
  await expect(page.locator('.ccd-cab h2')).toHaveText('PicPay')
}

async function fluxo() {
  const t = await iniciar({ perfil: demo.perfil, dados: dados(), porta: 4810 })
  const { page, db } = t
  const caixinha = () => db.meses.find((m) => m.ano === ANO && m.mes === MES).caixa[PP].caixinha
  try {
    await abrirPicPay(page, t.url)
    const valor = page.locator('.ccd-fatura .ccd-valor')
    await expect(valor).toContainText('800,00')
    await foto(page, '1-fatura-800')

    // ---------- pular o tênis para a próxima fatura ----------
    await page.locator('.ccd-acoes').getByRole('button', { name: 'Pular compra' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('checkbox', { name: /Tênis/ }).click()
    await expect(dialog.locator('.cc-acordo-resumo')).toContainText('100,00')
    await foto(page, '2-escolhendo')
    await dialog.getByRole('button', { name: /^Pular para / }).click()
    await expect(dialog).toHaveCount(0)
    await expect(valor).toContainText('700,00')
    await expect(page.locator('.ccd-puladas')).toContainText('Tênis')
    const tenis = db.lancamentos.find((l) => l.descricao === 'Tênis')
    assert.deepEqual([tenis.ano, tenis.mes, tenis.pulada_de], [prox.ano, prox.mes, venc])
    await foto(page, '3-fatura-700')

    // ---------- pagar 300 com o cofrinho: fica faltando 400 ----------
    await page.locator('.ccd-acoes').getByRole('button', { name: 'Paguei a fatura' }).click()
    await expect(dialog.getByRole('textbox', { name: 'Quanto pagou' })).toHaveValue('700,00')
    await dialog.getByRole('textbox', { name: 'Quanto pagou' }).fill('300,00')
    await dialog.getByRole('radio', { name: /Do cofrinho/ }).click()
    await expect(dialog.locator('.cc-caixinha')).toContainText('500,00')
    await expect(dialog).toContainText('Fica faltando R$ 400,00')
    await foto(page, '4-pagando-parte')
    await dialog.getByRole('button', { name: 'Pagar esta parte' }).click()
    await expect(dialog).toHaveCount(0)
    await expect(page.locator('.ccd-fatura .chip-estado')).toContainText('Faltam R$ 400,00')
    await expect.poll(caixinha).toBe(200)
    assert.equal(db.faturas_parciais.length, 1)
    assert.deepEqual([db.faturas_parciais[0].valor, db.faturas_parciais[0].da_caixinha, db.faturas_parciais[0].saldo_mexido], [300, true, true])
    await foto(page, '5-paga-em-parte')

    // ---------- pagar o resto pela conta: a fatura fecha, a caixinha não muda ----------
    await page.locator('.ccd-acoes').getByRole('button', { name: 'Pagar o resto' }).click()
    await expect(dialog.getByRole('textbox', { name: 'Quanto pagou' })).toHaveValue('400,00')
    await dialog.getByRole('button', { name: 'Marcar como paga' }).click()
    await expect(dialog).toHaveCount(0)
    await expect(page.locator('.ccd-fatura .chip-estado')).toHaveText('Paga')
    const paga = db.faturas_pagas.find((p) => p.cartao_id === CARTAO)
    assert.deepEqual([paga.valor, paga.da_caixinha], [400, false])
    assert.equal(caixinha(), 200)
    await foto(page, '6-paga')

    // ---------- desfazer o pagamento do cofrinho: os 300 voltam para a caixinha ----------
    await page.locator('.ccd-parte li button').first().click()
    await dialog.getByRole('button', { name: 'Desfazer' }).click()
    await dialog.getByRole('button', { name: 'Desfazer mesmo' }).click()
    await expect.poll(caixinha).toBe(500)
    assert.equal(db.faturas_parciais.length, 0)
    assert.deepEqual(t.msgs.filter((m) => m.includes('PAGEERROR')), [])
    console.log('✓ pular compra, pagar parte com o cofrinho, pagar o resto e desfazer')
  } finally {
    await t.fechar()
  }
}

/** Ainda sem a migração 38: nada de novo aparece e pagar continua como antes. */
async function semMigracao() {
  const d = dados()
  delete d.faturas_parciais
  const t = await iniciar({ perfil: demo.perfil, dados: d, porta: 4811, semColunas: { lancamentos: ['pulada_de', 'pago_por'], faturas_pagas: ['da_caixinha', 'saldo_mexido'] } })
  try {
    t.db.faturas_parciais = undefined
    delete t.db.faturas_parciais
    await abrirPicPay(t.page, t.url)
    await expect(t.page.locator('.ccd-fatura .ccd-valor')).toContainText('800,00')
    await expect(t.page.locator('.ccd-acoes').getByRole('button', { name: 'Pular compra' })).toHaveCount(0)
    await t.page.locator('.ccd-acoes').getByRole('button', { name: 'Paguei a fatura' }).click()
    const dialog = t.page.getByRole('dialog')
    await expect(dialog.getByRole('radio', { name: /Do cofrinho/ })).toHaveCount(0)
    await dialog.getByRole('textbox', { name: 'Quanto pagou' }).fill('300,00')
    await dialog.getByRole('button', { name: 'Marcar como paga' }).click()
    await expect(t.page.locator('.ccd-fatura .chip-estado')).toHaveText('Paga')
    const paga = t.db.faturas_pagas.find((p) => p.cartao_id === CARTAO)
    assert.equal(paga.valor, 300)
    assert.ok(!('da_caixinha' in paga))
    // sem a migração 39, a compra nova não pergunta quem paga
    await t.page.locator('.ccd-cab').getByRole('button', { name: 'Nova compra' }).click()
    await expect(dialog.getByRole('radio', { name: 'Outra pessoa' })).toHaveCount(0)
    console.log('✓ sem a migração 38: tudo como antes')
  } finally {
    await t.fechar()
  }
}

/** Compra que outra pessoa paga (migração 39): a assinatura da mãe no seu cartão. */
async function quemPaga() {
  const t = await iniciar({ perfil: demo.perfil, dados: dados(), porta: 4812 })
  const { page, db } = t
  try {
    await abrirPicPay(page, t.url)
    await page.locator('.ccd-cab').getByRole('button', { name: 'Nova compra' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Valor').fill('19,90')
    await dialog.getByRole('combobox', { name: 'Descrição' }).or(dialog.getByRole('textbox', { name: 'Descrição' })).first().fill('Amazon Prime')
    await dialog.getByRole('radio', { name: 'Outra pessoa' }).click()
    await dialog.getByRole('button', { name: 'Salvar', exact: true }).click()
    await expect(dialog.locator('.form-erro')).toContainText('Escreva quem paga')
    await dialog.getByPlaceholder('Quem? Ex.: Mãe').fill('Mãe')
    await foto(page, '7-quem-paga')
    await dialog.getByRole('button', { name: 'Salvar', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    const prime = db.lancamentos.find((l) => l.descricao === 'Amazon Prime')
    assert.equal(prime.pago_por, 'Mãe')
    await expect(page.locator('.ccd-outros')).toContainText('19,90')
    await expect(page.locator('.ccd-outros')).toContainText('Mãe paga R$ 19,90')
    await expect(page.locator('.ccd-compras')).toContainText('paga por Mãe')
    await foto(page, '8-fatura-com-a-mae')
    // ao editar a parcela, "Eu" tira o nome da compra
    await page.locator('.ccd-compras .item-lanc', { hasText: 'Amazon Prime' }).click()
    await expect(dialog.getByRole('radio', { name: 'Outra pessoa' })).toHaveAttribute('aria-checked', 'true')
    await dialog.getByRole('radio', { name: 'Eu' }).click()
    await dialog.getByRole('button', { name: 'Salvar', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await expect.poll(() => db.lancamentos.find((l) => l.descricao === 'Amazon Prime').pago_por).toBe(null)
    await expect(page.locator('.ccd-outros')).toHaveCount(0)
    assert.deepEqual(t.msgs.filter((m) => m.includes('PAGEERROR')), [])
    console.log('✓ compra que outra pessoa paga: grava, mostra na fatura e volta para "Eu"')
  } finally {
    await t.fechar()
  }
}

;(async () => {
  await fluxo()
  await semMigracao()
  await quemPaga()
})().catch((e) => { console.error(e); process.exit(1) })
