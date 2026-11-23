// Tela Cartões do computador: a carteira 3D e o cartão fora dela, com abas. No app de verdade com o Supabase falso.
// Antes: build com fake.supabase.co (ver README desta pasta). Rodar: node scripts/app-de-demonstracao/testar-carteira-pc.cjs
// FOTOS=pasta guarda as telas de cada passo.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { iniciar } = require('./servidor-falso.cjs')
const demo = require('./dados-de-demonstracao.cjs')
const { expect } = require('playwright/test')

const fotos = process.env.FOTOS
const foto = async (page, nome) => { if (fotos) { await page.waitForTimeout(1200); fs.mkdirSync(fotos, { recursive: true }); await page.screenshot({ path: path.join(fotos, `${nome}.png`) }) } }
const ok = (cond, msg) => { assert.ok(cond, msg); console.log('✓ ' + msg) }

function dados() {
  const d = structuredClone(demo.dados)
  d.cartoes.push({ ...d.cartoes[0], id: 'k-0077-4000-8000-000000000000', nome: 'Inter Black', cor: '#1f2937', banco_id: null, limite: 5000 })
  return d
}
const vaga = (page, nome) => page.locator('.cw-vaga', { hasText: nome }).locator('.cc-plastico')
/** Nada do cartão escolhido fica escondido atrás de outro: o ponto do meio do que aparece de cada cartão é dele. */
const cartoesVisiveis = async (page) => {
  // espera a carteira parar (as animações que não repetem para sempre)
  await page.waitForFunction(() => document.querySelector('.cw')?.getAnimations({ subtree: true })
    .every((a) => a.playState !== 'running' || a.effect.getTiming().iterations === Infinity))
  return olharCartoes(page)
}
const olharCartoes = (page) => page.evaluate(() => [...document.querySelectorAll('.cw-vaga:not(.saiu)')].every((v) => {
  const p = v.querySelector('.cc-plastico').getBoundingClientRect()
  const e = document.elementFromPoint(p.left + p.width / 2, p.top + 8)
  return e && v.contains(e)
}))

async function principal() {
  const t = await iniciar({ perfil: demo.perfil, dados: dados(), porta: 4830 })
  const { page } = t
  const erros = []
  page.on('pageerror', (e) => erros.push(e.message))
  try {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(t.url + '#/cartoes')
    await expect(page.locator('.cw-vaga')).toHaveCount(3)
    await expect(page.locator('.ccx-resumo .cc-vitrine')).toBeVisible()
    await expect(page.locator('.ccx-abas')).toHaveCount(0)
    await page.waitForTimeout(1600)
    ok(await cartoesVisiveis(page), 'carteira: os três cartões aparecem pela fenda, cada um com o seu bolso')
    await foto(page, '1-carteira')

    // tirar o Nubank da carteira
    await vaga(page, 'Nubank').click()
    await expect(page.locator('.ccx-cab h2')).toHaveText('Nubank')
    await expect(page.locator('.cw.compacta')).toBeVisible()
    await expect(page.locator('.cw-vaga.saiu')).toContainText('960')
    const anim = await page.evaluate(() => document.querySelector('.ccx-voo').getAnimations().length)
    ok(anim > 0, 'o cartão sai da carteira com animação')
    await page.waitForTimeout(1400)
    ok(await cartoesVisiveis(page), 'carteira encolhida: os outros cartões continuam visíveis')
    await foto(page, '2-nubank-fora')

    // abas: cada uma mostra a sua parte
    const abas = page.locator('.ccx-abas').getByRole('tab')
    await expect(abas).toHaveCount(5)
    await expect(page.locator('.ccx-abas').getByRole('tab', { name: /^Fatura/ })).toHaveAttribute('aria-selected', 'true')
    await expect(page.locator('.ccd-fatura')).toBeVisible()
    await page.locator('.ccx-abas').getByRole('tab', { name: /^Compras/ }).click()
    await expect(page.locator('.ccd-compras')).toBeVisible()
    await expect(page.locator('.ccd-fatura')).toHaveCount(0)
    await page.locator('.ccx-abas').getByRole('tab', { name: /Pagas e renegociadas/ }).click()
    await expect(page.getByRole('tabpanel')).toContainText('Faturas resolvidas')
    await page.locator('.ccx-abas').getByRole('tab', { name: /Próximas e parceladas/ }).click()
    await expect(page.getByRole('tabpanel')).toContainText('Próximas faturas')
    await expect(page.getByRole('tabpanel')).toContainText('Parceladas em andamento')
    await page.locator('.ccx-abas').getByRole('tab', { name: /Limite e caixinha/ }).click()
    await expect(page.locator('.ccx-painel .ccd-titulo', { hasText: 'Limite' })).toBeVisible()
    // setas do teclado andam entre as abas
    await page.locator('.ccx-abas').getByRole('tab', { name: /Limite e caixinha/ }).press('ArrowRight')
    await expect(page.locator('.ccx-abas').getByRole('tab', { name: /^Fatura/ })).toHaveAttribute('aria-selected', 'true')
    ok(true, 'as cinco abas: Fatura, Compras, Pagas e renegociadas, Próximas e parceladas, Limite e caixinha')

    // trocar de cartão pela carteira do lado
    await page.locator('.ccx-abas').getByRole('tab', { name: /^Compras/ }).click()
    await vaga(page, 'Itaú').click()
    await expect(page.locator('.ccx-cab h2')).toHaveText('Itaú Click')
    await expect(page.locator('.ccx-abas').getByRole('tab', { name: /^Compras/ })).toHaveAttribute('aria-selected', 'true')
    await expect(page.locator('.cw-vaga.saiu')).toHaveCount(1)
    await page.waitForTimeout(1400)
    ok(await cartoesVisiveis(page), 'trocar de cartão: o anterior volta para a fenda e a aba escolhida continua')

    // Esc guarda o cartão
    await page.keyboard.press('Escape')
    await expect(page.locator('.ccx-cab')).toHaveCount(0)
    await expect(page.locator('.cw.compacta')).toHaveCount(0)
    await expect(page.locator('.cw-vaga.saiu')).toHaveCount(0)
    await page.waitForTimeout(1400)
    ok(await cartoesVisiveis(page), 'Esc guarda o cartão de volta na carteira')

    // "Resolver no..." da faixa de atraso tira o cartão certo, na fatura
    await page.locator('.ccx-alerta').getByRole('button', { name: /Resolver no Nubank/ }).click()
    await expect(page.locator('.ccx-cab h2')).toHaveText('Nubank')
    await expect(page.locator('.ccx-abas').getByRole('tab', { name: /^Fatura/ })).toHaveAttribute('aria-selected', 'true')
    await expect(page.locator('.ccd-atrasadas, .ccd-fatura.atrasada').first()).toBeVisible()
    // "Guardar na carteira"
    await page.getByRole('button', { name: 'Guardar na carteira' }).click()
    await expect(page.locator('.ccx-cab')).toHaveCount(0)
    ok(true, 'faixa de atraso abre o cartão na fatura; "Guardar na carteira" devolve')

    // aba lembrada ao voltar para a tela
    await vaga(page, 'Inter').click()
    await page.locator('.ccx-abas').getByRole('tab', { name: /Próximas e parceladas/ }).click()
    await page.goto(t.url + '#/inicio'); await page.goto(t.url + '#/cartoes')
    await vaga(page, 'Nubank').click()
    await expect(page.locator('.ccx-abas').getByRole('tab', { name: /Próximas e parceladas/ })).toHaveAttribute('aria-selected', 'true')
    ok(true, 'a aba escolhida fica lembrada')

    // tema escuro
    await page.evaluate(() => { document.documentElement.dataset.tema = 'escuro' })
    await foto(page, '3-escuro')

    // tela estreita: carteira em cima, sem rolagem de lado
    await page.setViewportSize({ width: 1000, height: 800 })
    await page.waitForTimeout(500)
    const largura = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth])
    ok(largura[0] <= largura[1], `tela de 1000px: nada passa da largura (${largura[0]} ≤ ${largura[1]})`)
    await foto(page, '4-estreita')

    assert.deepEqual(erros, [])
  } finally {
    await t.fechar()
  }
}

/** Jeito simples: só Fatura e Compras. Animações reduzidas: nada voa. */
async function simplesEParado() {
  const t = await iniciar({ perfil: { ...demo.perfil, detalhe: 'simples' }, dados: dados(), porta: 4831 })
  const { page } = t
  try {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(t.url + '#/cartoes')
    await page.evaluate(() => { localStorage.clear() })
    await vaga(page, 'Nubank').click()
    await expect(page.locator('.ccx-abas').getByRole('tab')).toHaveCount(2)
    await expect(page.locator('.vt-mais-detalhe')).toBeVisible()
    ok(true, 'jeito simples: só as abas Fatura e Compras, com o convite para ver mais')
  } finally {
    await t.fechar()
  }
  const t2 = await iniciar({ perfil: demo.perfil, dados: dados(), porta: 4832 })
  try {
    const p = t2.page
    await p.setViewportSize({ width: 1440, height: 900 })
    await p.goto(t2.url + '#/cartoes')
    await p.evaluate(() => localStorage.clear())
    // Configurações → Animações: Reduzidas (fica guardado no aparelho)
    await p.evaluate(() => localStorage.setItem('opuscash-movimento', 'reduzido'))
    await p.reload()
    await expect(p.locator('html')).toHaveAttribute('data-movimento', 'reduzido')
    await vaga(p, 'Nubank').click()
    await expect(p.locator('.ccx-cab h2')).toHaveText('Nubank')
    const voando = await p.evaluate(() => document.querySelector('.ccx-voo').getAnimations().length + document.querySelector('.cw').getAnimations().length)
    ok(voando === 0, 'animações reduzidas: o cartão aparece sem voar e a carteira muda sem animar')
  } finally {
    await t2.fechar()
  }
}

;(async () => {
  await principal()
  await simplesEParado()
})().catch((e) => { console.error(e); process.exit(1) })
