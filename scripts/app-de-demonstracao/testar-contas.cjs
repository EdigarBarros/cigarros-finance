// Várias contas no mesmo aparelho (src/lib/contas.ts): entrar, adicionar outra, trocar sem senha, o tema de cada uma, sair de
// uma sem perder as outras, a tela "Quem está usando?", conta cuja sessão venceu (pede a senha com o e-mail preenchido), tirar
// uma conta da lista (encerra a sessão dela no servidor) e a folha da conta no celular.
// Uso (depois do build com fake.supabase.co do README desta pasta): node scripts/app-de-demonstracao/testar-contas.cjs
const path = require('path')
const R = path.join(__dirname, '..', '..')
const { iniciar } = require(R + '/scripts/app-de-demonstracao/servidor-falso.cjs')
const demo = require(R + '/scripts/app-de-demonstracao/dados-de-demonstracao.cjs')
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA ') + m); if (!c) process.exitCode = 1 }
const esperar = (p, ms = 700) => p.waitForTimeout(ms)

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const CONTAS = {
  'ana@exemplo.com': { id: 'aaaaaaaa-1111-4111-8111-111111111111', nome: 'Ana Souza' },
  'bia@exemplo.com': { id: 'bbbbbbbb-1111-4111-8111-111111111111', nome: 'Bia Lima' },
  'caio@exemplo.com': { id: 'cccccccc-1111-4111-8111-111111111111', nome: 'Caio Reis' },
}
const porId = Object.fromEntries(Object.entries(CONTAS).map(([email, c]) => [c.id, { ...c, email }]))

/** Um Supabase Auth falso com três contas: senha, renovação (o token gira a cada uso), usuário e saída. */
async function comTresContas(t) {
  const validos = new Map() // refresh_token -> id
  const encerrados = []
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
      return c ? route.fulfill({ status: 200, headers: h, body: JSON.stringify(sessaoDe(c).user) }) : route.fulfill({ status: 401, headers: h, body: '{}' })
    }
    if (u.pathname.endsWith('/logout')) {
      const id = quem(req)
      encerrados.push(porId[id]?.email)
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
  return { encerrados, revogar: (email) => { for (const [rt, x] of [...validos]) if (x === CONTAS[email].id) validos.delete(rt) } }
}

const ola = (p) => p.evaluate(() => document.querySelector('.perfil-botao')?.textContent?.trim() ?? document.querySelector('.modal h2, .folha h2')?.textContent ?? '')
const salvas = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('opuscash.contas') || '[]').map((c) => c.email + (c.precisaEntrar ? '*' : '')))
async function entrar(p, email, manter = true) {
  const f = p.locator('form.en-form.entrar.ativo')
  await f.locator('input[type=email]').fill(email)
  if (!manter) await f.locator('.chave-manter').click()
  await f.locator('input[autocomplete="current-password"]').fill('senha1234')
  await Promise.all([p.waitForLoadState('load').catch(() => {}), f.locator('button.en-botao').click()])
  await esperar(p, 2500)
}
async function abrirMenu(p) { await p.locator('.perfil-botao').click(); await esperar(p, 400) }

;(async () => {
  // ---------- computador ----------
  const t = await iniciar({ perfil: demo.perfil, dados: demo.dados, porta: 4870, semSessao: true })
  const p = t.page
  const s = await comTresContas(t)
  await p.goto(t.url); await esperar(p, 1500)
  ok(await p.locator('form.en-form.entrar.ativo').count() === 1, 'visitante novo (sem contas no aparelho) cai direto no login')
  await p.locator('.en-voltar').click(); await esperar(p, 1500)
  ok(await p.locator('.ap-btn-ghost').count() >= 1, '"Início" do login mostra a apresentação')
  await p.locator('.ap-btn-ghost').first().click(); await esperar(p, 900)
  await entrar(p, 'ana@exemplo.com')
  ok(/Ana/.test(await ola(p)), 'entrou na Ana: ' + await ola(p))
  ok(JSON.stringify(await salvas(p)) === '["ana@exemplo.com"]', 'Ana lembrada no aparelho')
  await abrirMenu(p)
  ok(await p.locator('.menu-lista').getByText('Sair', { exact: true }).count() === 1, 'com uma conta só, o botão continua "Sair"')
  await p.locator('.cs-adicionar').click(); await esperar(p, 700)
  ok(await p.locator('.en-voltar').textContent().then((x) => /Voltar/.test(x)), '"Adicionar outra conta" abre o login com "Voltar"')
  await p.locator('.en-voltar').click(); await esperar(p, 1200)
  ok(/Ana/.test(await ola(p)), '"Voltar" mantém a Ana aberta')
  await abrirMenu(p); await p.locator('.cs-adicionar').click(); await esperar(p, 700)
  await entrar(p, 'bia@exemplo.com')
  ok(/Bia/.test(await ola(p)), 'adicionou e abriu a Bia: ' + await ola(p))
  ok((await salvas(p)).sort().join() === 'ana@exemplo.com,bia@exemplo.com', 'duas contas lembradas')
  // tema da Bia: escuro; a Ana fica com o dela
  const temaAna = 'claro'
  await p.evaluate(() => { const a = Object.keys(localStorage).filter((k) => k.startsWith('opuscash-tema')); a.forEach((k) => localStorage.removeItem(k)) })
  await abrirMenu(p)
  const botaoTema = p.locator('.menu-lista button', { hasText: /Tema (escuro|claro)/ })
  if (/claro/.test(await botaoTema.textContent())) { await botaoTema.click(); await esperar(p, 1200); await abrirMenu(p) }
  await p.locator('.menu-lista button', { hasText: 'Tema escuro' }).click(); await esperar(p, 1500)
  ok(await p.evaluate(() => document.documentElement.dataset.tema) === 'escuro', 'Bia escolheu o tema escuro')
  // troca para a Ana pelo menu
  await abrirMenu(p)
  ok(await p.locator('.menu-lista').getByText('Sair', { exact: true }).count() === 1, 'com outra conta, o botão continua "Sair" (a conta fica no aparelho)')
  ok(await p.locator('.cs-linha', { hasText: 'ana@exemplo.com' }).count() === 1, 'o menu da Bia mostra a Ana para trocar')
  await Promise.all([p.waitForEvent('load'), p.locator('.cs-linha', { hasText: 'ana@exemplo.com' }).locator('.cs-abrir').click()])
  await esperar(p, 2500)
  ok(/Ana/.test(await ola(p)), 'trocou para a Ana sem senha: ' + await ola(p))
  const temaDaAna = await p.evaluate(() => document.documentElement.dataset.tema)
  ok(temaDaAna !== 'escuro' || temaAna === 'escuro', `a Ana não herdou o tema escuro da Bia (${temaDaAna})`)
  // adiciona a Caio e volta para a Bia: o tema escuro dela volta
  await abrirMenu(p); await p.locator('.cs-adicionar').click(); await esperar(p, 700)
  await entrar(p, 'caio@exemplo.com')
  ok(/Caio/.test(await ola(p)), 'adicionou o Caio')
  await abrirMenu(p)
  ok(await p.locator('.menu-lista .cs-linha').count() === 2, 'o menu do Caio mostra as outras duas contas')
  await Promise.all([p.waitForEvent('load'), p.locator('.cs-linha', { hasText: 'bia@exemplo.com' }).locator('.cs-abrir').click()])
  await esperar(p, 2500)
  ok(/Bia/.test(await ola(p)), 'trocou para a Bia')
  ok(await p.evaluate(() => document.documentElement.dataset.tema) === 'escuro', 'o tema escuro da Bia voltou com ela')
  // "Sair" volta para os perfis e a conta continua lá; com "Manter conectado" (o padrão), abre de novo sem senha
  const perfis = () => p.locator('.escolher-conta .pf-perfil:not(.pf-outra)')
  const sair = async () => { await abrirMenu(p); await p.locator('.menu-lista').getByText('Sair', { exact: true }).click(); await esperar(p, 2500) }
  await sair()
  ok(await p.locator('.escolher-conta').count() === 1, 'depois de sair, aparece "Quem está usando?"')
  ok(await perfis().count() === 3 && (await p.locator('.escolher-conta').textContent()).includes('bia@'), 'a Bia continua na lista com a Ana e o Caio')
  ok(!s.encerrados.includes('bia@exemplo.com'), 'a sessão da Bia não foi encerrada (ela fica conectada)')
  ok(await p.locator('.escolher-conta .cn-cena').count() >= 1, 'as cenas do app passam no fundo')
  await Promise.all([p.waitForEvent('load'), perfis().filter({ hasText: 'bia@exemplo.com' }).click()])
  await esperar(p, 3000)
  ok(/Bia/.test(await ola(p)), 'tocou na Bia e ela abriu sem senha')
  // sem "Manter conectado": a lista não guarda a sessão, sair encerra e o perfil pede a senha numa tela própria
  await sair()
  await p.locator('.escolher-conta .pf-outra').click(); await esperar(p, 900)
  await entrar(p, 'caio@exemplo.com', false)
  ok(/Caio/.test(await ola(p)), 'o Caio entrou sem "Manter conectado"')
  ok(await p.evaluate(() => JSON.parse(localStorage.getItem('opuscash.contas')).find((c) => c.email === 'caio@exemplo.com').refresh_token === ''), 'a lista não guarda a sessão do Caio')
  await sair()
  ok(s.encerrados.includes('caio@exemplo.com'), 'ao sair, a sessão do Caio foi encerrada no servidor')
  ok(await perfis().filter({ hasText: 'caio@exemplo.com' }).getByText('Pede a senha').count() === 1, 'o perfil do Caio mostra "Pede a senha"')
  await perfis().filter({ hasText: 'caio@exemplo.com' }).click(); await esperar(p, 1500)
  ok(await p.locator('.sc').count() === 1 && /caio@exemplo\.com/.test(await p.locator('.sc-email').textContent()), 'tocar no Caio abre a tela de senha com o e-mail dele')
  await p.locator('.sc-campo input').fill('errada123'); await p.locator('.sc-entrar').click(); await esperar(p, 1200)
  ok(await p.locator('.sc.sc-errou').count() === 1 && await p.locator('.sc .en-aviso').count() === 1, 'senha errada: o cartão avisa e fica vermelho')
  await p.locator('.sc-campo input').fill('senha1234')
  await Promise.all([p.waitForEvent('load'), p.locator('.sc-entrar').click()])
  await esperar(p, 3000)
  ok(/Caio/.test(await ola(p)), 'com a senha certa, o Caio abriu')
  // fechou o app (ou o navegador) e abriu de novo: sem "Manter conectado", a sessão não fica
  // (recarregar grava o sinal de vida da aba; o script abaixo zera ele antes do app, como se o app tivesse fechado há tempo)
  await p.context().addInitScript(() => { if (localStorage.getItem('teste-fechou')) { localStorage.removeItem('teste-fechou'); localStorage.setItem('opuscash.pulso', '0'); sessionStorage.clear() } })
  await p.evaluate(() => { sessionStorage.clear(); localStorage.setItem('teste-fechou', '1') })
  await p.reload(); await esperar(p, 2500)
  ok(await p.locator('.escolher-conta').count() === 1, 'reabrindo o app, o Caio (sem manter) volta para os perfis')
  ok((await salvas(p)).includes('caio@exemplo.com*'), 'e o perfil dele pede a senha')
  // sessão vencida de uma conta conectada (encerrada em outro lugar): o perfil cai na tela de senha
  s.revogar('ana@exemplo.com')
  await perfis().filter({ hasText: 'ana@exemplo.com' }).click(); await esperar(p, 2000)
  ok(await p.locator('.sc').count() === 1, 'sessão vencida da Ana: tela de senha')
  ok(await p.locator('.sc .chave-manter.ligada').count() === 1, 'na tela de senha da Ana, "Manter conectado" já vem ligado')
  await p.locator('.sc-voltar').click(); await esperar(p, 900)
  ok(await p.locator('.escolher-conta').count() === 1, '"Voltar" da tela de senha volta para os perfis')
  // "Início" leva à apresentação; o voltar do navegador traz de volta
  await p.locator('.pf-inicio').click(); await esperar(p, 1500)
  ok(await p.locator('.ap-btn-ghost').count() >= 1, '"Início" abre a apresentação do OpusCash')
  await p.goBack(); await esperar(p, 1500)
  ok(await p.locator('.escolher-conta').count() === 1, 'voltando, os perfis aparecem de novo')
  // tirar contas só pelo "Gerenciar contas"; sem nenhuma, vai para o login
  await p.locator('.pf-gerenciar').click(); await esperar(p, 400)
  await perfis().filter({ hasText: 'bia@exemplo.com' }).click(); await esperar(p, 1200)
  ok(!(await salvas(p)).some((x) => x.startsWith('bia@')), 'Gerenciar contas: tirou a Bia do aparelho')
  ok(s.encerrados.includes('bia@exemplo.com'), 'a sessão da Bia foi encerrada no servidor')
  for (const email of ['ana@exemplo.com', 'caio@exemplo.com']) { await perfis().filter({ hasText: email }).click(); await esperar(p, 900) }
  await esperar(p, 900)
  ok(await p.locator('form.en-form.entrar.ativo').count() === 1, 'sem nenhuma conta no aparelho, vai direto para o login')
  await p.screenshot({ path: path.join(R, 'node_modules/.cache/contas-pc.png') })
  ok(!t.msgs.some((m) => m.startsWith('PAGEERROR')), 'sem erro na página (PC): ' + t.msgs.filter((m) => m.startsWith('PAGEERROR')).join(' | '))
  await t.fechar()

  // ---------- celular ----------
  const m = await iniciar({ perfil: demo.perfil, dados: demo.dados, porta: 4871, semSessao: true, toque: true })
  const q = m.page
  await q.setViewportSize({ width: 390, height: 844 })
  await comTresContas(m)
  await q.goto(m.url); await esperar(q, 1500)
  await entrar(q, 'ana@exemplo.com')
  const folha = async () => { await q.locator('.topo-movel-avatar').click(); await esperar(q, 700) }
  await folha()
  ok(await q.locator('.lista-folha .cs-adicionar').count() === 1, 'celular: a folha da conta tem "Adicionar outra conta"')
  await q.locator('.lista-folha .cs-adicionar').click(); await esperar(q, 900)
  await entrar(q, 'bia@exemplo.com')
  await folha()
  ok(await q.locator('.lista-folha .cs-linha', { hasText: 'ana@exemplo.com' }).count() === 1, 'celular: a folha da Bia mostra a Ana')
  const largura = await q.evaluate(() => { const l = document.querySelector('.lista-folha .cs-linha').getBoundingClientRect(); return { r: l.right, w: innerWidth } })
  ok(largura.r <= largura.w, 'celular: a linha da conta cabe na tela')
  await q.screenshot({ path: path.join(R, 'node_modules/.cache/contas-celular.png') })
  await Promise.all([q.waitForEvent('load'), q.locator('.lista-folha .cs-linha', { hasText: 'ana@exemplo.com' }).locator('.cs-abrir').click()])
  await esperar(q, 2500)
  await folha()
  ok(/Ana/.test(await q.locator('.modal h2, h2').first().textContent()), 'celular: trocou para a Ana')
  await q.locator('.lista-folha').getByText('Sair', { exact: true }).click(); await esperar(q, 2500)
  ok(await q.locator('.escolher-conta .pf-perfil:not(.pf-outra):not(.pf-editar)').count() === 2, 'celular: saiu da Ana e as duas continuam na lista')
  ok(await q.locator('.escolher-conta .pf-editar').count() === 1, 'celular: o quadro "Editar" aparece no lugar de "Gerenciar contas"')
  await q.locator('.escolher-conta .pf-editar').click(); await esperar(q, 400)
  ok(await q.locator('.escolher-conta.editando .pf-tirar').count() === 2, 'celular: "Editar" mostra a lixeira em cada conta')
  await q.locator('.escolher-conta .pf-editar').click(); await esperar(q, 400)
  ok(await q.locator('.escolher-conta.editando').count() === 0, 'celular: "Concluir" volta ao normal sem tirar ninguém')
  await q.screenshot({ path: path.join(R, 'node_modules/.cache/contas-escolher.png') })
  // abrir o app de novo com duas contas: escolhe nos perfis, a não ser que uma seja quase sempre a usada
  await m.page.context().addInitScript(() => { if (localStorage.getItem('teste-fechou')) { localStorage.removeItem('teste-fechou'); localStorage.setItem('opuscash.pulso', '0'); sessionStorage.clear() } })
  const reabrir = async () => { await q.evaluate(() => localStorage.setItem('teste-fechou', '1')); await q.reload(); await esperar(q, 2500) }
  const idDe = (email) => q.evaluate((e) => JSON.parse(localStorage.getItem('opuscash.contas')).find((c) => c.email === e).id, email)
  await Promise.all([q.waitForEvent('load'), q.locator('.escolher-conta .pf-perfil', { hasText: 'bia@exemplo.com' }).click()])
  await esperar(q, 2500)
  const [ana, bia] = [await idDe('ana@exemplo.com'), await idDe('bia@exemplo.com')]
  await q.evaluate(([a, b]) => localStorage.setItem('opuscash.aberturas', JSON.stringify([a, b, a, b, a, b])), [ana, bia])
  await reabrir()
  ok(await q.locator('.escolher-conta').count() === 1, 'celular: alternando entre as contas, abrir o app mostra os perfis')
  await Promise.all([q.waitForEvent('load'), q.locator('.escolher-conta .pf-perfil', { hasText: 'bia@exemplo.com' }).click()])
  await esperar(q, 2500)
  ok(await q.locator('.escolher-conta').count() === 0, 'celular: o perfil da Bia abriu sem senha')
  await q.evaluate((b) => localStorage.setItem('opuscash.aberturas', JSON.stringify([b, b, b, b, b, b])), bia)
  await reabrir()
  ok(await q.locator('.escolher-conta').count() === 0 && await q.locator('.topo-movel-avatar').count() === 1, 'celular: quase sempre a Bia, abrir o app entra direto nela')
  ok(!m.msgs.some((x) => x.startsWith('PAGEERROR')), 'sem erro na página (celular)')
  await m.fechar()
})().catch((e) => { console.error(e); process.exitCode = 1 })
