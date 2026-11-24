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
    await expect(page.locator('.cxr')).toBeVisible()
    await expect(page.locator('.cxr-linha')).toHaveCount(3)
    await expect(page.locator('.cxr-linha', { hasText: 'Itaú Click' })).toContainText('livres')
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
    await expect(page.locator('.ccx-painel .lpc')).toBeVisible()
    await expect(page.locator('.lpc')).toContainText('Livre para gastar')
    await expect(page.locator('.lpc')).toContainText('O que está usando o limite')
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

    // Esc guarda o cartão. Na volta, o cartão nunca fica por cima do próprio bolso: ele sobe acima da boca do bolso,
    // passa para trás dele e só então desliza para dentro (antes descia por cima e "teleportava" para dentro no fim).
    await page.keyboard.press('Escape')
    const porCima = await page.evaluate(async () => {
      const vaga = document.querySelector('[data-vaga] .cw-cartao') && [...document.querySelectorAll('.cw-vaga')].find((v) => v.querySelector('.cw-cartao').getAnimations().some((a) => a.effect.getTiming().duration === 900))
      if (!vaga) return 'sem animação de volta'
      const casca = vaga.querySelector('.cw-cartao'), plastico = vaga.querySelector('.cc-plastico'), bolso = vaga.querySelector('.cw-bolso')
      const anims = [...casca.getAnimations(), ...plastico.getAnimations()].filter((a) => a.effect.getTiming().duration === 900)
      anims.forEach((a) => a.pause())
      const ruins = []
      for (let t = 0; t <= 900; t += 30) {
        anims.forEach((a) => { a.currentTime = t })
        const c = plastico.getBoundingClientRect(), b = bolso.getBoundingClientRect()
        // só vale na descida, já alinhado com a fenda (no voo de lado ele passa por cima da carteira, e é assim mesmo)
        const alinhado = Math.abs(c.left - (b.left + 8)) < 4 && Math.abs(c.width - (b.width - 16)) < 4
        const sobre = alinhado && c.bottom > b.top + 2
        if (sobre && Number(getComputedStyle(casca).zIndex) > Number(getComputedStyle(bolso).zIndex)) ruins.push(t)
      }
      anims.forEach((a) => a.play())
      return ruins.length ? 'por cima do bolso em ' + ruins.join(', ') + ' ms' : ''
    })
    ok(porCima === '', `a volta não passa por cima do próprio bolso ${porCima}`)
    await expect(page.locator('.ccx-cab')).toHaveCount(0)
    await expect(page.locator('.cw.compacta')).toHaveCount(0)
    await expect(page.locator('.cw-vaga.saiu')).toHaveCount(0)
    await page.waitForTimeout(1400)
    ok(await cartoesVisiveis(page), 'Esc guarda o cartão de volta na carteira')

    // "Resolver no..." da faixa de atraso tira o cartão certo, na fatura
    await page.locator('.cxr .ccx-alerta').getByRole('button', { name: /Resolver no Nubank/ }).click()
    await expect(page.locator('.ccx-cab h2')).toHaveText('Nubank')
    await expect(page.locator('.ccx-abas').getByRole('tab', { name: /^Fatura/ })).toHaveAttribute('aria-selected', 'true')
    await expect(page.locator('.ccd-atrasadas, .ccd-fatura.atrasada').first()).toBeVisible()
    // "Guardar na carteira"
    await page.getByRole('button', { name: 'Guardar na carteira' }).click()
    await expect(page.locator('.ccx-cab')).toHaveCount(0)
    ok(true, 'faixa de atraso abre o cartão na fatura; "Guardar na carteira" devolve')

    // clicar na linha do resumo tira aquele cartão
    await page.locator('.cxr-linha', { hasText: 'Itaú Click' }).click()
    await expect(page.locator('.ccx-cab h2')).toHaveText('Itaú Click')
    await page.keyboard.press('Escape')
    await expect(page.locator('.ccx-cab')).toHaveCount(0)
    ok(true, 'a linha do resumo abre o cartão')

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

/** A novidade com a cena animada: aparece no computador e não aparece no celular. */
async function novidadeAnimada() {
  const novidade = () => [{
    id: 99, titulo: { pt: 'Seus cartões numa carteira' }, itens: [{ icone: 'cartao', texto: { pt: 'Antes ficava tudo junto.' } }],
    icone: 'cartao', cor: 'marca', tela: 'cartoes', onde: 'site', publicada_em: new Date().toISOString(),
    arte: { formato: 'deitado', fundo: 'noite', elementos: [], animacao: 'carteira-cartoes' },
  }]
  const perfil = { ...demo.perfil, dispensadas: (demo.perfil.dispensadas || []).filter((x) => !x.startsWith('novidade')) }
  const t = await iniciar({ perfil, dados: { ...dados(), novidades: novidade() }, porta: 4833 })
  try {
    const p = t.page
    await p.setViewportSize({ width: 1440, height: 900 })
    await p.goto(t.url + '#/inicio')
    await expect(p.locator('.novidade-cena .cn-palco')).toBeVisible({ timeout: 20000 })
    await expect(p.locator('.novidade-cena')).toContainText('Seus cartões numa carteira')
    await p.getByRole('button', { name: /Ver de novo/ }).click()
    await expect(p.locator('.novidade-cena .cn-palco')).toBeVisible()
    await p.locator('.novidade-cena').getByRole('button', { name: /Ver agora/ }).click()
    await expect(p.locator('.novidade-cena')).toHaveCount(0)
    await expect.poll(() => p.evaluate(() => location.hash)).toBe('#/cartoes')
    ok(true, 'novidade animada: aparece no computador, "Ver de novo" repete e "Ver agora" leva aos Cartões')
  } finally {
    await t.fechar()
  }
  const t2 = await iniciar({ perfil, dados: { ...dados(), novidades: novidade() }, porta: 4834, toque: true })
  try {
    const p = t2.page
    await p.setViewportSize({ width: 390, height: 844 })
    await p.goto(t2.url + '#/inicio')
    await p.waitForTimeout(5000)
    ok(await p.locator('.novidade').count() === 0, 'no celular a novidade da carteira não aparece (a tela nova é só do computador)')
  } finally {
    await t2.fechar()
  }
}

;(async () => {
  await principal()
  await simplesEParado()
  await novidadeAnimada()
})().catch((e) => { console.error(e); process.exit(1) })
