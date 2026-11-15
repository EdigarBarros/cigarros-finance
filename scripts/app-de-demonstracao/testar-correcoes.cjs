// Regressões de metas e paginação. Antes: build com fake.supabase.co (ver README desta pasta).
// Usa Playwright disponível no ambiente; PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH é opcional.
const assert = require('node:assert/strict')
const { chromium } = require('playwright')
if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
  const launch = chromium.launch.bind(chromium)
  chromium.launch = options => launch({ ...options, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH })
}
const { iniciar } = require('./servidor-falso.cjs')
const demo = require('./dados-de-demonstracao.cjs')
const { expect } = require('playwright/test')

async function metas() {
  const t = await iniciar({ perfil: demo.perfil, dados: structuredClone(demo.dados), porta: 4802 })
  try {
    const page = t.page, dialog = page.getByRole('dialog')
    await page.goto(t.url + '#/metas')
    await page.getByRole('button', { name: 'Criar meta', exact: true }).click()
    const nome = 'Teste de gravação'
    await dialog.getByRole('textbox', { name: 'Nome da meta', exact: true }).fill(nome)
    await dialog.locator('input[placeholder="0,00"]').fill('10000')

    // Uma requisição pendente não pode ser repetida nem fechar o formulário via Escape.
    let liberar, entrou, tentativas = 0
    const entrada = new Promise(r => { entrou = r })
    const pendente = new Promise(r => { liberar = r })
    const bloquear = async route => {
      if (route.request().method() !== 'POST') return route.fallback()
      tentativas++
      entrou()
      await pendente
      return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Falha simulada', code: '503' }) })
    }
    await page.route('https://fake.supabase.co/rest/v1/metas**', bloquear)
    await dialog.getByRole('button', { name: 'Criar meta', exact: true }).click()
    await entrada
    await expect(dialog.getByRole('button', { name: 'Salvando…', exact: true })).toBeDisabled()
    await dialog.locator('form').evaluate(form => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })
    await page.keyboard.press('Escape')
    await expect(dialog).toBeVisible()
    liberar()
    await expect(dialog.getByText('Não deu certo. Tente de novo.', { exact: true })).toBeVisible()
    assert.equal(tentativas, 1)
    await expect(dialog.getByRole('textbox', { name: 'Nome da meta', exact: true })).toHaveValue(nome)
    assert(!t.db.metas.some(m => m.nome === nome))
    await page.unroute('https://fake.supabase.co/rest/v1/metas**', bloquear)
    await dialog.getByRole('button', { name: 'Criar meta', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    assert.equal(t.db.metas.filter(m => m.nome === nome).length, 1)

    // Editar: falha preserva o formulário e o valor gravado; nova tentativa aplica a edição.
    await page.getByRole('button', { name: 'Ver ' + nome, exact: true }).click()
    await dialog.getByRole('button', { name: 'Editar', exact: true }).click()
    await dialog.getByRole('textbox', { name: 'Nome da meta', exact: true }).fill(nome + ' editada')
    const falhar = async route => route.request().method() === 'GET' ? route.fallback() : route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Falha simulada', code: '503' }) })
    await page.route('https://fake.supabase.co/rest/v1/metas**', falhar)
    await dialog.getByRole('button', { name: 'Salvar', exact: true }).click()
    await expect(dialog.getByText('Não deu certo. Tente de novo.', { exact: true })).toBeVisible()
    assert(t.db.metas.some(m => m.nome === nome))
    await page.unroute('https://fake.supabase.co/rest/v1/metas**', falhar)
    await dialog.getByRole('button', { name: 'Salvar', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    assert(t.db.metas.some(m => m.nome === nome + ' editada'))

    // Guardar e retirar: erro não perde valor/observação; repetir grava uma única vez.
    for (const acao of ['Guardar', 'Retirar']) {
      const card = page.locator('article.mt-cartao').filter({ has: page.getByRole('button', { name: 'Ver ' + nome + ' editada', exact: true }) })
      await card.getByRole('button', { name: acao, exact: true }).click()
      const valor = dialog.locator('input[placeholder="0,00"]')
      await valor.fill('1000')
      await dialog.locator('input[maxlength="60"]').fill('Observação preservada')
      const antes = t.db.meta_movimentos.length
      await page.route('https://fake.supabase.co/rest/v1/meta_movimentos**', falhar)
      await dialog.getByRole('button', { name: acao, exact: true }).click()
      await expect(dialog.getByText('Não deu certo. Tente de novo.', { exact: true })).toBeVisible()
      assert.equal(t.db.meta_movimentos.length, antes)
      await expect(valor).not.toHaveValue('')
      await expect(dialog.locator('input[maxlength="60"]')).toHaveValue('Observação preservada')
      await page.unroute('https://fake.supabase.co/rest/v1/meta_movimentos**', falhar)
      await dialog.getByRole('button', { name: acao, exact: true }).click()
      await expect(dialog).toHaveCount(0)
      assert.equal(t.db.meta_movimentos.length, antes + 1)
      assert.equal(t.db.meta_movimentos.at(-1).valor, acao === 'Guardar' ? 10 : -10)
    }
    assert.deepEqual(t.msgs.filter(x => x.startsWith('PAGEERROR:')), [])
    console.log('Metas: criar, editar, guardar e retirar — falha e nova tentativa; envio duplicado bloqueado.')
  } finally { await t.fechar() }
}

async function faturas() {
  const dados = structuredClone(demo.dados)
  // Dois pagamentos da última página pertencem aos cartões visíveis; 1.000 registros anteriores são de arquivo.
  const agora = new Date(), ano = agora.getFullYear(), mes = agora.getMonth() + 1
  dados.faturas_pagas = Array.from({ length: 1000 }, (_, i) => ({ id: `arquivo-${i}`, cartao_id: `cartao-arquivado-${Math.floor(i / 12)}`, ano: ano - 1, mes: i % 12 + 1, valor: 1, tipo: 'paga' }))
  dados.faturas_pagas.push(...dados.cartoes.slice(0, 2).map((c, i) => ({ id: `ultima-${i}`, cartao_id: c.id, ano, mes, valor: 100, tipo: i === 0 ? 'paga' : 'renegociada', pago_em: `${ano}-${String(mes).padStart(2, '0')}-01` })))
  const t = await iniciar({ perfil: demo.perfil, dados, porta: 4803 })
  try {
    const paginas = []
    t.page.on('request', r => {
      const u = new URL(r.url())
      if (u.pathname.endsWith('/faturas_pagas') && u.searchParams.get('select') === '*') paginas.push(u)
    })
    await t.page.goto(t.url + '#/cartoes')
    await expect(t.page.locator('.pg-cartoes')).toBeVisible()
    await expect(t.page.locator('.pg-cartoes').getByText('Paga', { exact: true }).first()).toBeVisible()
    await expect(t.page.locator('.pg-cartoes').getByText('Renegociada', { exact: true }).first()).toBeVisible()
    assert(paginas.some(u => u.searchParams.get('offset') === '1000'))
    assert(paginas.every(u => u.searchParams.get('order') === 'ano.asc,mes.asc,id.asc'))
    assert.deepEqual(t.msgs.filter(x => x.startsWith('PAGEERROR:')), [])
    console.log('Cartões: 1.002 faturas carregadas; pagamento e renegociação da segunda página reconhecidos na tela.')
  } finally { await t.fechar() }
}
;(async () => { await metas(); await faturas() })().catch(e => { console.error(e); process.exitCode = 1 })
