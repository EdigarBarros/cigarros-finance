// Estorno (migração 40): compra no cartão estornada inteira, desfazer, gasto comum com estorno de parte, e sem a migração.
// Antes: build com fake.supabase.co (ver README desta pasta). Rodar: node scripts/app-de-demonstracao/testar-estorno.cjs
// FOTOS=pasta guarda as telas.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { iniciar } = require('./servidor-falso.cjs')
const demo = require('./dados-de-demonstracao.cjs')
const { expect } = require('playwright/test')

const fotos = process.env.FOTOS
const foto = async (page, nome) => { if (fotos) { await page.waitForTimeout(700); fs.mkdirSync(fotos, { recursive: true }); await page.screenshot({ path: path.join(fotos, `${nome}.png`) }) } }
const ok = (cond, msg) => { assert.ok(cond, msg); console.log('✓ ' + msg) }
const reais = (s) => Number(String(s).replace(/[^\d,-]/g, '').replace(',', '.'))

async function noCartao() {
  const t = await iniciar({ perfil: demo.perfil, dados: structuredClone(demo.dados), porta: 4840 })
  const { page, db } = t
  const erros = []
  page.on('pageerror', (e) => erros.push(e.message))
  try {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(t.url + '#/cartoes')
    await page.locator('.cw-vaga', { hasText: 'Nubank' }).locator('.cc-plastico').click()
    await page.locator('.ccx-abas').getByRole('tab', { name: /^Compras/ }).click()
    const linha = page.locator('.ccd-compras .item-lanc').first()
    const nome = (await linha.locator('.item-desc').textContent()).trim()
    const faturaAntes = reais(await page.locator('.ccd-compras-cab b').textContent())
    const parcela = reais(await linha.locator('.item-valor').textContent())
    await linha.click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: /Foi estornada/ }).click()
    await expect(dialog.locator('.lf-estorno')).toBeVisible()
    await foto(page, '1-estornar')
    await dialog.getByRole('button', { name: 'Marcar como estornada' }).click()
    await expect(dialog).toHaveCount(0)

    const compra = db.lancamentos.find((l) => l.descricao === nome && l.cartao_id).compra_id
    const parcelas = db.lancamentos.filter((l) => l.compra_id === compra)
    ok(parcelas.every((l) => Number(l.valor) === 0 && Number(l.estorno_valor) > 0 && l.estornado_em), `"${nome}": as ${parcelas.length} parcela(s) ficam com valor 0 e o estorno guardado`)
    const riscada = page.locator('.ccd-compras .item-lanc.estornado', { hasText: nome })
    await expect(riscada).toBeVisible()
    await expect(riscada).toContainText('estornada')
    await expect.poll(async () => reais(await page.locator('.ccd-compras-cab b').textContent())).toBeCloseTo(faturaAntes - parcela, 2)
    ok(true, 'a compra continua na lista, riscada, e a fatura cai o valor dela')
    await foto(page, '2-riscada')

    // abrir de novo: mostra o estorno, não deixa salvar, e desfaz
    await riscada.click()
    await expect(dialog.locator('.lf-estorno.feito')).toContainText('Estornada')
    await expect(dialog.getByRole('button', { name: 'Salvar', exact: true })).toBeDisabled()
    await dialog.getByRole('button', { name: 'Desfazer estorno' }).click()
    await page.locator('.aviso-fundo').getByRole('button', { name: 'Desfazer estorno' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect.poll(() => db.lancamentos.filter((l) => l.compra_id === compra).every((l) => Number(l.valor) > 0 && l.estorno_valor == null)).toBe(true)
    await expect.poll(async () => reais(await page.locator('.ccd-compras-cab b').textContent())).toBeCloseTo(faturaAntes, 2)
    ok(true, 'desfazer o estorno devolve o valor e a fatura volta ao que era')
    assert.deepEqual(erros, [])
  } finally {
    await t.fechar()
  }
}

/** Um gasto de Pix no mês de hoje (a demonstração tem o histórico até o mês passado). */
function comFarmacia() {
  const d = structuredClone(demo.dados)
  const h = new Date(), pad = (n) => String(n).padStart(2, '0')
  d.lancamentos.push({ id: 'l-7777-4000-8000-000000000000', user_id: d.bancos[0].user_id, ano: h.getFullYear(), mes: h.getMonth() + 1, tipo: 'saida',
    descricao: 'Farmácia', valor: 59.9, data: `${h.getFullYear()}-${pad(h.getMonth() + 1)}-${pad(h.getDate())}`, forma: 'pix', categoria_id: null, banco_id: null })
  return d
}

async function gastoComum() {
  const t = await iniciar({ perfil: demo.perfil, dados: comFarmacia(), porta: 4841 })
  const { page, db } = t
  try {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(t.url + '#/lancamentos')
    const linha = page.locator('.lc-card', { hasText: 'Farmácia' }).first()
    const nome = (await linha.locator('.lc-card-desc').textContent()).trim()
    const alvo = db.lancamentos.find((l) => l.id === 'l-7777-4000-8000-000000000000')
    const antes = Number(alvo.valor)
    await linha.click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: /Foi estornada/ }).click()
    await dialog.locator('.lf-estorno input[inputmode="decimal"]').fill('10,00')
    await dialog.getByRole('button', { name: 'Marcar como estornada' }).click()
    await expect(dialog).toHaveCount(0)
    await expect.poll(() => Number(db.lancamentos.find((l) => l.id === alvo.id).valor)).toBeCloseTo(antes - 10, 2)
    assert.equal(Number(db.lancamentos.find((l) => l.id === alvo.id).estorno_valor), 10)
    await expect(page.locator('.lc-card', { hasText: nome }).first()).toContainText('Estorno de')
    ok(true, `gasto comum "${nome}": estorno de R$ 10 deixa ${(antes - 10).toFixed(2)} contando e mostra "estorno de R$ 10,00"`)
    await foto(page, '3-lancamentos')

    // mais do que custou: recusa
    await page.locator('.lc-card', { hasText: nome }).first().click()
    await expect(dialog.locator('.lf-estorno.feito')).toContainText('Estorno de parte')
    await expect(dialog.getByRole('button', { name: 'Salvar', exact: true })).toBeEnabled()
    ok(true, 'com estorno de parte, o lançamento ainda pode ser editado')
  } finally {
    await t.fechar()
  }
}

async function semMigracao() {
  const t = await iniciar({ perfil: demo.perfil, dados: comFarmacia(), porta: 4842, semColunas: { lancamentos: ['estorno_valor', 'estornado_em'] } })
  try {
    const p = t.page
    await p.setViewportSize({ width: 1440, height: 900 })
    await p.goto(t.url + '#/lancamentos')
    await p.locator('.lc-card').first().click()
    await expect(p.getByRole('dialog')).toBeVisible()
    await p.waitForTimeout(800)
    ok(await p.getByRole('dialog').getByRole('button', { name: /Foi estornada/ }).count() === 0, 'sem a migração 40, o botão "Foi estornada" não aparece')
  } finally {
    await t.fechar()
  }
}

;(async () => {
  await noCartao()
  await gastoComum()
  await semMigracao()
})().catch((e) => { console.error(e); process.exit(1) })
