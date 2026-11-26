// Testa seleção de perfis e isolamento da sessão em Chromium com contas fictícias.
const path = require('path')
const R = path.join(__dirname, '..', '..')
const { iniciar } = require(R + '/scripts/app-de-demonstracao/servidor-falso.cjs')
const demo = require(R + '/scripts/app-de-demonstracao/dados-de-demonstracao.cjs')
const assert = require('node:assert/strict')
const ok = (condicao, mensagem) => { assert.ok(condicao, mensagem); console.log('OK   ' + mensagem) }

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const CONTAS = {
  'ana@exemplo.com': { id: 'aaaaaaaa-1111-4111-8111-111111111111', nome: 'Ana Souza' },
  'bia@exemplo.com': { id: 'bbbbbbbb-1111-4111-8111-111111111111', nome: 'Bia Lima' },
}
const porId = Object.fromEntries(Object.entries(CONTAS).map(([email, c]) => [c.id, { ...c, email }]))

/** Supabase Auth simulado com contas, renovação, recuperação e saída. */
async function comContas(t) {
  const validos = new Map() // refresh_token -> id
  const encerrados = []
  const escopos = []
  const recuperacoes = []
  const senhasAtualizadas = []
  let n = 0
  const sessaoDe = (c) => {
    n += 1
    const rt = `rt-${c.id.slice(0, 4)}-${n}`
    validos.set(rt, c.id)
    const user = { id: c.id, aud: 'authenticated', role: 'authenticated', email: c.email, user_metadata: { nome: c.nome }, app_metadata: {} }
    return { access_token: `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: c.id, role: 'authenticated', exp: 4102444800, n })}.c2ln`, refresh_token: rt, token_type: 'bearer', expires_in: 99999, expires_at: 4102444800, user }
  }
  const quem = (req) => { try { return JSON.parse(Buffer.from((req.headers().authorization || '').split('.')[1], 'base64url')).sub } catch { return null } }
  const h = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'content-type': 'application/json' }
  const ctx = t.page.context()
  await ctx.route('https://fake.supabase.co/auth/v1/**', async (route) => {
    const req = route.request(), u = new URL(req.url())
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: h })
    let body = null; try { body = req.postDataJSON() } catch { /* sem corpo */ }
    if (u.pathname.endsWith('/token') && u.searchParams.get('grant_type') === 'password') {
      const c = CONTAS[body?.email]
      if (!c || body.password !== 'senha1234') return route.fulfill({ status: 400, headers: h, body: JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid login credentials', msg: 'Invalid login credentials' }) })
      return route.fulfill({ status: 200, headers: h, body: JSON.stringify(sessaoDe({ ...c, email: body.email })) })
    }
    if (u.pathname.endsWith('/token') && u.searchParams.get('grant_type') === 'refresh_token') {
      const id = validos.get(body?.refresh_token)
      if (!id) return route.fulfill({ status: 400, headers: h, body: JSON.stringify({ code: 'refresh_token_not_found', error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token: Refresh Token Not Found' }) })
      validos.delete(body.refresh_token)
      return route.fulfill({ status: 200, headers: h, body: JSON.stringify(sessaoDe(porId[id])) })
    }
    if (u.pathname.endsWith('/user')) {
      const c = porId[quem(req)]
      if (c && req.method() === 'PUT' && body?.password) senhasAtualizadas.push(c.email)
      return c ? route.fulfill({ status: 200, headers: h, body: JSON.stringify(sessaoDe(c).user) }) : route.fulfill({ status: 401, headers: h, body: '{}' })
    }
    if (u.pathname.endsWith('/recover')) {
      recuperacoes.push(body?.email)
      return route.fulfill({ status: 200, headers: h, body: '{}' })
    }
    if (u.pathname.endsWith('/logout')) {
      const id = quem(req)
      encerrados.push(porId[id]?.email)
      escopos.push(u.searchParams.get('scope') || 'global')
      for (const [rt, x] of [...validos]) if (x === id) validos.delete(rt)
      return route.fulfill({ status: 204, headers: h, body: '' })
    }
    return route.fulfill({ status: 200, headers: h, body: '{}' })
  })
  // o nome do perfil vem da conta que pede (o resto dos dados é o da demonstração, igual para todas)
  await ctx.route('https://fake.supabase.co/rest/v1/perfis**', async (route) => {
    const req = route.request()
    if (req.method() !== 'GET') return route.fallback()
    const c = porId[quem(req)]
    const linha = { ...t.db.perfis[0], user_id: c?.id, nome: c?.nome ?? 'Ninguém' }
    const single = /pgrst\.object/.test(req.headers().accept || '')
    return route.fulfill({ status: 200, headers: h, body: JSON.stringify(single ? linha : [linha]) })
  })
  const linkDeRecuperacao = (email) => {
    const { access_token, refresh_token, token_type } = sessaoDe({ ...CONTAS[email], email })
    const parametros = new URLSearchParams({ access_token, refresh_token, token_type, expires_in: '3600', type: 'recovery' })
    return `${t.url}#${parametros}`
  }
  return { encerrados, escopos, recuperacoes, senhasAtualizadas, linkDeRecuperacao }
}

const perfil = (p, email) => p.locator('.pf-perfil', { hasText: email })
const menu = (p) => p.locator('.perfil-botao')
const formulario = (p) => p.locator('form.en-form.entrar.ativo')
const locais = (p) => p.evaluate(() => Object.entries(localStorage))
const sessaoAtiva = (p) => p.evaluate(() => {
  const chave = sessionStorage.getItem('opuscash.sessao-chave')
  return { chave, email: JSON.parse(sessionStorage.getItem(chave) ?? 'null')?.user.email }
})

async function entrar(p, email, manter) {
  const f = formulario(p)
  await f.locator('input[type=email]').fill(email)
  await f.locator('input[autocomplete=current-password]').fill('senha1234')
  if (manter !== undefined && (await f.locator('.chave-manter input').isChecked()) !== manter) await f.locator('.chave-manter').click()
  await Promise.all([p.waitForEvent('load'), f.locator('button.en-botao').click()])
}

async function confirmarPerfil(p, senha) {
  await p.locator('.sc-campo input').fill(senha)
  await p.locator('.sc-entrar').click()
}

async function abrirPainel(p, nome) {
  await p.locator('.perfil-botao', { hasText: nome }).waitFor()
}

async function testarComputador() {
  const t = await iniciar({ perfil: demo.perfil, dados: demo.dados, porta: 4870, semSessao: true })
  try {
    const p = t.page
    const s = await comContas(t)
    const externos = []
    p.context().on('request', (r) => {
      if (r.resourceType() === 'script' && new URL(r.url()).origin !== new URL(t.url).origin) externos.push(r.url())
    })
    await p.goto(t.url)
    await formulario(p).waitFor()
    await p.evaluate(() => {
      document.cookie = 'googtrans=/pt/fr; Path=/'
      const conta = {
        id: 'aaaaaaaa-1111-4111-8111-111111111111', email: 'ana@exemplo.com', nome: 'Ana Souza',
        access_token: 'LEGADO_ACESSO', refresh_token: 'LEGADO_RENOVACAO', manter: true,
      }
      localStorage.setItem('opuscash.contas', JSON.stringify([conta]))
      localStorage.setItem('sb-fake-auth-token', JSON.stringify({ ...conta, user: conta }))
    })
    await p.reload()
    await perfil(p, 'ana@exemplo.com').waitFor()
    const inicial = await locais(p)
    ok(!JSON.stringify(inicial).includes('LEGADO_'), 'migração remove os tokens antigos e mantém o perfil')
    ok(!inicial.some(([chave]) => chave === 'sb-fake-auth-token'), 'chave legada do Supabase removida')
    ok(!(await sessaoAtiva(p)).email, 'token legado não autentica a aba')
    ok(await p.locator('html').getAttribute('lang') === 'pt-BR', 'idioma legado indisponível volta para português')
    await perfil(p, 'ana@exemplo.com').click()
    await confirmarPerfil(p, 'errada123')
    await p.locator('.sc-errou').waitFor()
    ok(!(await sessaoAtiva(p)).email, 'senha incorreta mantém a conta fechada')
    await p.locator('.sc-esqueci').click()
    await p.locator('.sc .en-aviso.ok').waitFor()
    assert.deepEqual(s.recuperacoes, ['ana@exemplo.com'])
    await confirmarPerfil(p, 'senha1234')
    await abrirPainel(p, 'Ana')
    const chave = (await sessaoAtiva(p)).chave
    await p.reload()
    await abrirPainel(p, 'Ana')
    ok((await sessaoAtiva(p)).chave === chave, 'a própria aba mantém o login ao recarregar')
    const outraAba = await p.context().newPage()
    try {
      await outraAba.goto(t.url)
      await perfil(outraAba, 'ana@exemplo.com').waitFor()
      const outraSessao = await sessaoAtiva(outraAba)
      ok(outraSessao.chave !== chave && !outraSessao.email, 'uma nova aba pede autenticação')
      await menu(p).click()
      await p.locator('.cs-adicionar').click()
      await entrar(p, 'bia@exemplo.com')
      await abrirPainel(p, 'Bia')
      ok(!(await sessaoAtiva(outraAba)).email && !(await menu(outraAba).count()), 'a troca de conta não transmite sessão para outra aba')
    } finally { await outraAba.close() }
    await menu(p).click()
    await p.locator('.cs-linha', { hasText: 'ana@exemplo.com' }).locator('.cs-abrir').click()
    await formulario(p).waitFor()
    assert.equal(await formulario(p).locator('input[type=email]').inputValue(), 'ana@exemplo.com')
    ok((await sessaoAtiva(p)).email === 'bia@exemplo.com', 'trocar de perfil pede a senha e mantém a conta atual até autenticar')
    await entrar(p, 'ana@exemplo.com')
    await abrirPainel(p, 'Ana')
    const dadosLocais = JSON.stringify(await locais(p))
    ok(!/access_token|refresh_token/.test(dadosLocais), 'perfis e localStorage não guardam tokens novos')
    const cookies = await p.context().cookies()
    ok(!cookies.some(({ value }) => /access_token|refresh_token/.test(value)), 'cookies não guardam tokens')
    await menu(p).click()
    await p.locator('.menu-lista').getByText('Sair', { exact: true }).click()
    await perfil(p, 'ana@exemplo.com').waitFor()
    ok(s.encerrados.includes('ana@exemplo.com') && !(await sessaoAtiva(p)).email, 'Sair encerra a sessão no servidor simulado e apaga a cópia da aba')
    await p.locator('.idioma-btn').first().click()
    await p.getByRole('button', { name: 'English', exact: true }).click()
    await p.locator('html[lang=en]').waitFor()
    ok((await p.context().cookies()).some((c) => c.name === 'opuscash-idioma' && c.value === 'en'), 'inglês usa a preferência de idioma do app')
    await p.context().clearCookies()
    await p.goto(s.linkDeRecuperacao('ana@exemplo.com'))
    // A confirmação do e-mail abre uma página nova, inclusive quando o endereço só muda no fragmento.
    await p.reload()
    await p.getByRole('heading', { name: 'Criar senha nova' }).waitFor()
    await p.locator('input[autocomplete=new-password]').fill('nova-senha-local-1234')
    await p.getByRole('button', { name: 'Salvar senha' }).click()
    await abrirPainel(p, 'Ana')
    ok(s.senhasAtualizadas.includes('ana@exemplo.com') && (await sessaoAtiva(p)).email === 'ana@exemplo.com', 'o link de recuperação permite definir a senha e abrir a conta')
    assert.deepEqual(externos, [], 'nenhum script de tradução externo é solicitado')
    assert.deepEqual(t.msgs.filter((m) => m.startsWith('PAGEERROR')), [])
  } finally {
    await t.fechar()
  }
}

async function testarCelular() {
  const t = await iniciar({ perfil: demo.perfil, dados: demo.dados, porta: 4871, semSessao: true, toque: true })
  try {
    const p = t.page
    await p.setViewportSize({ width: 390, height: 844 })
    await comContas(t)
    await p.goto(t.url)
    await entrar(p, 'ana@exemplo.com')
    await p.locator('.topo-movel-avatar').click()
    await p.locator('.lista-folha .cs-adicionar').click()
    await entrar(p, 'bia@exemplo.com')
    await p.locator('.topo-movel-avatar').click()
    await p.locator('.lista-folha .cs-linha', { hasText: 'ana@exemplo.com' }).locator('.cs-abrir').click()
    await formulario(p).waitFor()
    ok((await sessaoAtiva(p)).email === 'bia@exemplo.com', 'celular: tocar em outro perfil solicita a senha')
    await entrar(p, 'ana@exemplo.com')
    await p.locator('.topo-movel-avatar').click()
    await p.locator('.lista-folha').getByText('Sair', { exact: true }).click()
    await perfil(p, 'ana@exemplo.com').waitFor()
    await p.locator('.pf-editar').click()
    await perfil(p, 'bia@exemplo.com').click()
    ok(!(await perfil(p, 'bia@exemplo.com').count()), 'celular: é possível esquecer um perfil')
    assert.deepEqual(t.msgs.filter((m) => m.startsWith('PAGEERROR')), [])
  } finally {
    await t.fechar()
  }
}

const doAparelho = (p) => p.evaluate(() => ({
  email: JSON.parse(localStorage.getItem('opuscash-conectado') ?? 'null')?.user?.email,
  prazo: JSON.parse(localStorage.getItem('opuscash.conectado') ?? 'null'),
}))
const DIA = 24 * 60 * 60 * 1000

/**
 * "Manter conectado": aparelho com prazo, abas novas sem senha, prazo vencido ou adulterado, sair e sair de todos.
 * Os cliques são sempre numa aba só: a outra só é observada (duas abas com as cenas 3D disputam a CPU do teste).
 */
async function testarManterConectado() {
  const t = await iniciar({ perfil: demo.perfil, dados: demo.dados, porta: 4872, semSessao: true })
  try {
    const p = t.page
    const s = await comContas(t)
    // animações reduzidas: duas abas com as cenas animadas não cabem na CPU do teste
    await p.emulateMedia({ reducedMotion: 'reduce' })
    const novaAba = async () => { const a = await p.context().newPage(); await a.emulateMedia({ reducedMotion: 'reduce' }); await a.goto(t.url); return a }
    await p.goto(t.url)
    await formulario(p).waitFor()
    ok(!(await formulario(p).locator('.chave-manter input').isChecked()), 'no navegador, "Manter conectado" vem desligado')
    await entrar(p, 'ana@exemplo.com', true)
    await abrirPainel(p, 'Ana')
    let ap = await doAparelho(p)
    ok(ap.email === 'ana@exemplo.com' && !(await sessaoAtiva(p)).email, 'ligado, a sessão vai para o aparelho e não para a aba')
    const resta = ap.prazo.ate - Date.now()
    ok(ap.prazo.id === CONTAS['ana@exemplo.com'].id && resta > 29.9 * DIA && resta <= 30 * DIA, 'o prazo é de 30 dias')
    let aba = await novaAba()
    await abrirPainel(aba, 'Ana')
    ok(true, 'uma aba nova abre a conta conectada sem pedir a senha')
    await aba.close()

    // outra conta sem "Manter conectado": fica só na aba; a conectada continua no aparelho
    await p.bringToFront()
    await menu(p).click()
    await p.locator('.cs-adicionar').click()
    await entrar(p, 'bia@exemplo.com', false)
    await abrirPainel(p, 'Bia')
    ok((await sessaoAtiva(p)).email === 'bia@exemplo.com' && (await doAparelho(p)).email === 'ana@exemplo.com', 'conta sem "Manter conectado" fica só na aba')
    aba = await novaAba()
    await abrirPainel(aba, 'Ana')
    ok(true, 'enquanto isso, outra aba abre a conta conectada')
    await aba.close()
    await p.bringToFront()
    await menu(p).click()
    const linhaAna = p.locator('.cs-linha', { hasText: 'ana@exemplo.com' })
    ok(!(await linhaAna.locator('.cs-venceu').count()), 'no menu, a conta conectada não pede a senha')
    await Promise.all([p.waitForEvent('load'), linhaAna.locator('.cs-abrir').click()])
    await abrirPainel(p, 'Ana')
    ok(s.encerrados.includes('bia@exemplo.com') && !(await sessaoAtiva(p)).email, 'abrir a conta conectada encerra a sessão da aba no servidor')

    // Sair na conta conectada: apaga do aparelho e encerra no servidor (a reação das outras abas é a mesma do prazo vencido)
    await p.bringToFront()
    await menu(p).click()
    await Promise.all([p.waitForEvent('load'), p.locator('.menu-lista').getByText('Sair', { exact: true }).click()])
    await perfil(p, 'ana@exemplo.com').waitFor()
    ap = await doAparelho(p)
    ok(!ap.email && !ap.prazo && s.encerrados.includes('ana@exemplo.com'), 'Sair apaga a sessão e o prazo do aparelho e encerra no servidor')
    ok(await perfil(p, 'ana@exemplo.com').locator('.pf-selo').count() === 1, 'depois de sair, o perfil volta a pedir a senha')

    // tela de senha do perfil com a chave ligada
    const entrarPeloPerfil = async () => {
      await p.bringToFront()
      await perfil(p, 'ana@exemplo.com').click()
      await p.locator('.sc .chave-manter').click()
      await Promise.all([p.waitForEvent('load'), confirmarPerfil(p, 'senha1234')])
      await abrirPainel(p, 'Ana')
    }
    await entrarPeloPerfil()
    ok((await doAparelho(p)).email === 'ana@exemplo.com', 'a tela de senha do perfil também deixa conectado')

    // prazo vencido: a aba aberta sai, a sessão sai do aparelho, é encerrada no servidor e o perfil pede a senha
    aba = await novaAba()
    await abrirPainel(aba, 'Ana')
    const antes = s.encerrados.length
    await p.evaluate((dia) => {
      const x = JSON.parse(localStorage.getItem('opuscash.conectado'))
      localStorage.setItem('opuscash.conectado', JSON.stringify({ ...x, ate: Date.now() - dia }))
    }, DIA)
    await perfil(aba, 'ana@exemplo.com').waitFor({ timeout: 70_000 })
    ok(true, 'prazo vencido: a aba que estava aberta sai')
    await aba.close()
    await p.reload()
    await perfil(p, 'ana@exemplo.com').waitFor()
    ok(!(await doAparelho(p)).email, 'prazo vencido: a sessão sai do aparelho')
    await p.waitForTimeout(800)
    ok(s.encerrados.length > antes, 'prazo vencido: a sessão é encerrada no servidor')

    // prazo adulterado (mais de 30 dias à frente) não vale
    await entrarPeloPerfil()
    await p.evaluate((dia) => {
      const x = JSON.parse(localStorage.getItem('opuscash.conectado'))
      localStorage.setItem('opuscash.conectado', JSON.stringify({ ...x, ate: Date.now() + 365 * dia }))
    }, DIA)
    await p.reload()
    await perfil(p, 'ana@exemplo.com').waitFor()
    ok(!(await doAparelho(p)).email, 'prazo adulterado não abre a conta')

    // sair de todos os aparelhos
    await entrarPeloPerfil()
    await menu(p).click()
    await p.locator('.menu-lista').getByText('Configurações', { exact: true }).click()
    await p.locator('.config-nav').getByText('Conta', { exact: true }).click()
    await p.locator('.cfg-acao', { hasText: 'Sair de todos os aparelhos' }).click()
    await p.locator('.cfg-acao', { hasText: 'Toque de novo' }).waitFor()
    await Promise.all([p.waitForEvent('load'), p.locator('.cfg-acao', { hasText: 'Toque de novo' }).click()])
    await perfil(p, 'ana@exemplo.com').waitFor()
    ok(s.escopos.includes('global') && !(await doAparelho(p)).email, 'Sair de todos os aparelhos encerra tudo no servidor (scope global)')
    assert.deepEqual(t.msgs.filter((m) => m.startsWith('PAGEERROR')), [])
  } finally {
    await t.fechar()
  }
}

/** Celular: o login do app abre com a chave, e com ela ligada a conta abre sozinha na próxima vez. */
async function testarManterNoCelular() {
  const t = await iniciar({ perfil: demo.perfil, dados: demo.dados, porta: 4873, semSessao: true, toque: true })
  try {
    const p = t.page
    await p.setViewportSize({ width: 390, height: 844 })
    await comContas(t)
    await p.goto(t.url + '?app=android')
    await formulario(p).waitFor()
    ok(await formulario(p).locator('.chave-manter input').isChecked(), 'celular (app): "Manter conectado" vem ligado')
    await entrar(p, 'ana@exemplo.com', true)
    await p.locator('.topo-movel-avatar').waitFor()
    const nova = await p.context().newPage()
    await nova.setViewportSize({ width: 390, height: 844 })
    await nova.goto(t.url)
    await nova.locator('.topo-movel-avatar').waitFor()
    ok((await doAparelho(nova)).email === 'ana@exemplo.com', 'celular: abrir de novo entra sem senha')
    await nova.close()
    assert.deepEqual(t.msgs.filter((m) => m.startsWith('PAGEERROR')), [])
  } finally {
    await t.fechar()
  }
}

;(async () => {
  await testarComputador()
  await testarCelular()
  await testarManterConectado()
  await testarManterNoCelular()
})().catch((erro) => { console.error(erro); process.exitCode = 1 })
