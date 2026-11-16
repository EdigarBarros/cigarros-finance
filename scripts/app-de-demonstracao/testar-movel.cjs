// Moldura e Início do celular (src/movel): nos três jeitos, em 320, 360, 390 e 430 px, nos temas escuro e claro e com a
// fonte a 150% e 200%: sem rolagem de lado, nada fora da tela, toques do topo, das ações e das abas com 44 px, e o fim da
// tela acima da barra de baixo. Depois: o topo que desliza (ponto ativo e cor), o modelo de cada jeito, a conta tocada abre
// a conferência, as folhas "Mais", da conta e dos meses, os alvos do tutorial, adicionar/tirar/subir cartões (gravado na
// conta, com e sem a migração 35, e de volta depois de recarregar), Lançamentos e Contas do mês no celular (larguras, temas,
// filtros, edição, conferência sem baixa), Cartões e Dívidas (cor de cada cartão, deslizar troca o cartão ou o lado), Metas e
// Dinheiro guardado (escolher a meta, abrir o banco), Consultor e Invest (a ordem que o Consultor monta é a mesma do
// computador) e o computador sem nada do celular.
// Uso (depois do build com fake.supabase.co do README desta pasta): node scripts/app-de-demonstracao/testar-movel.cjs
const path=require('path')
const R=path.join(__dirname,'..','..')
const { iniciar } = require(R+'/scripts/app-de-demonstracao/servidor-falso.cjs')
const demo = require(R+'/scripts/app-de-demonstracao/dados-de-demonstracao.cjs')
const ok=(c,m)=>{console.log((c?'OK   ':'FALHA ')+m); if(!c) process.exitCode=1}
const esperar=(p,ms=700)=>p.waitForTimeout(ms)

async function abrir(p, url){ await p.goto(url); await esperar(p,2200); await p.clock.runFor(3000).catch(()=>{}); await esperar(p,400) }

/** Medidas da tela aberta: rolagem de lado, coisas fora da tela, toques pequenos e o fim acima da barra de baixo. */
const medir=()=>{
  const cw=document.documentElement.clientWidth
  const visivel=(e)=>{const b=e.getBoundingClientRect();return b.width>0&&b.height>0&&getComputedStyle(e).visibility!=='hidden'}
  // o topo que desliza tem as páginas seguintes à direita, de propósito (rolam por dentro do trilho)
  const fora=[...document.querySelectorAll('.app.movel *')].filter(e=>!e.closest('.hero-movel-trilho, .dicas-movel')&&visivel(e)&&(e.getBoundingClientRect().right>cw+0.5||e.getBoundingClientRect().left<-0.5)).map(e=>e.className||e.tagName)
  const pequenos=[...document.querySelectorAll('.topo-movel button, .topo-movel-busca, .acoes-movel button, .abas-movel-nova button, .hero-movel-pilula, .linha-movel, .widget-titulo, .widget-rodape, .pilulas-movel button')]
    .filter(visivel).filter(e=>{const b=e.getBoundingClientRect();return b.height<36||b.width<36||(e.matches('.topo-movel button, .acoes-movel button, .abas-movel-nova button, .hero-movel-pilula')&&b.height<44)})
    .map(e=>`${(e.getAttribute('aria-label')||e.textContent).trim().slice(0,20)} ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`)
  window.scrollTo(0, document.documentElement.scrollHeight)
  const ult=[...document.querySelectorAll('.app.movel .pagina > *')].filter(visivel).pop().getBoundingClientRect(), nav=document.querySelector('.abas-movel').getBoundingClientRect()
  window.scrollTo(0,0)
  return {lado:document.documentElement.scrollWidth>cw, fora:fora.slice(0,5), pequenos, acima:ult.bottom<=nav.top+1}
}

;(async()=>{
  for (const jeito of ['simples','equilibrado','detalhado']) {
    const t = await iniciar({ perfil: {...demo.perfil, detalhe:jeito}, dados: demo.dados, porta: 4950+Math.floor(Math.random()*40), dpr: 1, toque:true })
    const p=t.page
    await p.clock.install({ time: new Date('2026-11-16T10:00:00') })
    for (const tema of ['escuro','claro']) {
      await p.addInitScript((tema)=>{try{localStorage.setItem('opuscash-tema',tema)}catch{}},tema)
      for (const w of [320, 360, 390, 430]) {
        await p.setViewportSize({ width: w, height: 800 })
        await abrir(p, `${t.url}#/inicio`)
        const r=await p.evaluate(medir)
        ok(!r.lado && !r.fora.length, `${jeito} ${tema} ${w}px: sem rolagem de lado e nada fora da tela ${r.fora.join(', ')}`)
        ok(!r.pequenos.length, `${jeito} ${tema} ${w}px: toques grandes o bastante ${r.pequenos.join(' | ')}`)
        ok(r.acima, `${jeito} ${tema} ${w}px: o fim da tela rola para cima da barra de baixo`)
      }
    }
    // fonte grande (configuração de acessibilidade do aparelho)
    for (const f of ['150%','200%']) {
      await p.setViewportSize({ width: 360, height: 800 })
      await abrir(p, `${t.url}#/inicio`)
      await p.evaluate((f)=>{document.documentElement.style.fontSize=f},f); await esperar(p,400)
      const lado=await p.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth)
      ok(!lado, `${jeito} fonte ${f}: sem rolagem de lado`)
    }
    // o modelo do jeito: o simples mostra menos cartões que o detalhado
    await p.setViewportSize({ width: 390, height: 800 })
    await abrir(p, `${t.url}#/inicio`)
    const n=await p.locator('.widgets-movel .widget').count()
    console.log(`      ${jeito}: ${n} cartões`)
    if (jeito==='simples') ok(n>=2 && n<=5, `simples com poucos cartões (${n})`)
    if (jeito==='detalhado') ok(n>=8, `detalhado com mais cartões (${n})`)
    await t.fechar()
  }

  // ---------- Lançamentos e Contas do mês no celular ----------
  {
    const t = await iniciar({ perfil: {...demo.perfil, detalhe:'equilibrado'}, dados: demo.dados, porta: 4950+Math.floor(Math.random()*40), dpr: 1, toque:true })
    const p=t.page
    await p.clock.install({ time: new Date('2026-11-16T10:00:00') })
    for (const tema of ['escuro','claro']) {
      await p.addInitScript((tema)=>{try{localStorage.setItem('opuscash-tema',tema)}catch{}},tema)
      for (const pg of ['lancamentos','contas','cartoes','dividas','metas','patrimonio','analise','invest']) for (const w of [320, 360, 390, 430]) {
        await p.setViewportSize({ width: w, height: 800 })
        await abrir(p, `${t.url}#/${pg}`)
        const r=await p.evaluate(medir)
        ok(!r.lado && !r.fora.length, `${pg} ${tema} ${w}px: sem rolagem de lado e nada fora da tela ${r.fora.join(', ')}`)
        ok(!r.pequenos.length, `${pg} ${tema} ${w}px: toques grandes o bastante ${r.pequenos.join(' | ')}`)
        ok(r.acima, `${pg} ${tema} ${w}px: o fim da tela rola para cima da barra de baixo`)
      }
    }
    await p.setViewportSize({ width: 390, height: 800 })
    // Lançamentos: outubro tem lançamentos fora do cartão
    await abrir(p, `${t.url}#/lancamentos`)
    ok(await p.locator('.hero-movel-pagina').count()===3 && await p.locator('.fab').count()===0, 'Lançamentos: topo com saiu, entrou e sobrou, sem o "+"')
    await p.locator('.topo-movel-mes').click(); await esperar(p)
    await p.locator('.meses-movel .quadro-meses-grade button').nth(9).click(); await esperar(p,1200)
    const linhas=await p.locator('.dia-movel .linha-movel').count()
    ok(linhas>0, `Lançamentos de outubro em cartões por dia (${linhas})`)
    const saiuAntes=await p.locator('.hero-movel-pagina').first().locator('.hero-movel-valor').innerText()
    await p.locator('.pilulas-movel button').first().click(); await esperar(p,700)
    const saiuDepois=await p.locator('.hero-movel-pagina').first().locator('.hero-movel-valor').innerText()
    ok(await p.locator('.filtros-movel').count()===1 && saiuAntes!==saiuDepois, `a pílula da categoria filtra e o topo acompanha (${saiuAntes} → ${saiuDepois})`)
    await p.locator('.filtros-movel .link').click(); await esperar(p,500)
    ok(await p.locator('.filtros-movel').count()===0, '"Limpar filtros" volta tudo')
    await p.locator('.acoes-movel button', { hasText: 'Filtrar' }).click(); await esperar(p)
    ok(await p.locator('.filtrar-movel').count()===1, 'Filtrar abre a folha dos filtros')
    await p.locator('.filtrar-movel').getByRole('radio', { name: 'Entradas' }).click().catch(async()=>{ await p.locator('.filtrar-movel button', { hasText: 'Entradas' }).first().click() })
    await esperar(p,400)
    await p.locator('.filtrar-movel .btn.primario').click(); await esperar(p,500)
    ok((await p.locator('.filtros-movel').innerText()).includes('Entradas'), 'filtrar por entradas aparece nos filtros ativos')
    await p.locator('.dia-movel .linha-movel').first().click(); await esperar(p,900)
    ok(await p.locator('.modal').count()===1, 'tocar num lançamento abre a edição')
    await p.keyboard.press('Escape'); await esperar(p)
    // Contas do mês
    await p.locator('.topo-movel-mes').click(); await esperar(p)
    await p.locator('.meses-movel .quadro-meses-grade button').nth(10).click(); await esperar(p,900)
    await p.locator('.abas-movel-nova button[data-tour="mais"]').click(); await esperar(p)
    await p.locator('.mais-grade button[data-tour="nav-contas"]').click(); await esperar(p,1500)
    ok(await p.locator('.hero-movel-pagina').count()>=1 && await p.locator('.fab').count()===0, 'Contas: topo com o que falta pagar, sem o "+"')
    const baixasAntes=t.log.filter(x=>x[0]==='POST'&&x[1]==='lancamentos').length
    await p.locator('.conta-movel .linha-movel', { hasText: 'Internet' }).click(); await esperar(p,900)
    ok(await p.locator('.modal').count()===1 && t.log.filter(x=>x[0]==='POST'&&x[1]==='lancamentos').length===baixasAntes, 'tocar numa conta abre a conferência, sem dar baixa')
    await p.keyboard.press('Escape'); await esperar(p)
    await p.locator('.acoes-movel button', { hasText: 'Todas' }).click(); await esperar(p)
    ok(await p.locator('.modal .lista-folha .linha-movel').count()>=5, '"Todas" lista as contas fixas para editar')
    await p.locator('.modal .lista-folha .linha-movel').first().click(); await esperar(p,900)
    ok(await p.locator('.modal').count()===1 && /Editar conta fixa/.test(await p.locator('.modal').innerText()), 'tocar numa conta fixa abre a edição')
    await p.keyboard.press('Escape'); await esperar(p)
    // Cartões: uma página por cartão, na cor dele; deslizar troca o cartão de baixo
    await abrir(p, `${t.url}#/cartoes`)
    const nCartoes=await p.locator('.hero-movel-pagina').count()
    const cor0=await p.evaluate(()=>getComputedStyle(document.querySelector('.movel-fundo')).getPropertyValue('--tom-cor').trim())
    ok(nCartoes>=2 && await p.evaluate(()=>document.querySelector('.movel-fundo i.ativo')?.dataset.t)==='cor' && cor0, `Cartões: ${nCartoes} cartões no topo, na cor de cada um (${cor0})`)
    ok(await p.locator('.fab').count()===0, 'Cartões: sem o "+"')
    const fatura0=await p.locator('.ccd-fatura .ccd-valor').innerText()
    await p.locator('.hero-movel-pontos button').nth(1).click(); await esperar(p,1400)
    const cor1=await p.evaluate(()=>getComputedStyle(document.querySelector('.movel-fundo')).getPropertyValue('--tom-cor').trim())
    const fatura1=await p.locator('.ccd-fatura .ccd-valor').innerText()
    ok(cor1 && cor1!==cor0 && fatura1!==fatura0, `deslizar troca o cartão e a cor (${fatura0} → ${fatura1})`)
    await p.locator('.cartoes-movel .widget .linha-movel').first().click(); await esperar(p,900)
    ok(await p.locator('.modal').count()===1, 'tocar numa compra abre a edição')
    await p.keyboard.press('Escape'); await esperar(p)
    // Dívidas: deslizar troca o lado (no lugar das abas)
    await abrir(p, `${t.url}#/dividas`)
    ok(/Cada dívida/.test(await p.locator('.dividas-movel').innerText()) && await p.locator('.fab').count()===0, 'Dívidas: "Cada dívida", sem o "+"')
    await p.locator('.dividas-movel .widget .linha-movel').first().click(); await esperar(p,900)
    ok(await p.locator('.modal').count()===1, 'tocar numa dívida abre a ficha')
    await p.keyboard.press('Escape'); await esperar(p)
    await p.locator('.hero-movel-pontos button').nth(1).click(); await esperar(p,1400)
    const ladoReceber=await p.locator('.dividas-movel').innerText()
    ok(/Recebe todo mês/.test(ladoReceber) && await p.evaluate(()=>document.querySelector('.movel-fundo i.ativo')?.dataset.t)==='sobra', 'deslizar leva ao lado "Me devem"')
    // Metas: guardar pede a meta (há mais de uma) e abre o formulário dela
    await abrir(p, `${t.url}#/metas`)
    ok(await p.locator('.metas-movel .widget .linha-movel').count()>=2 && await p.locator('.fab').count()===0, 'Metas: as metas em linhas, sem o "+"')
    await p.locator('.acoes-movel button', { hasText: 'Guardar' }).click(); await esperar(p)
    ok(/Guardar em qual meta/.test(await p.locator('.modal').innerText()), '"Guardar" pergunta em qual meta')
    await p.locator('.modal .lista-folha .linha-movel').first().click(); await esperar(p,900)
    ok(await p.locator('.modal').count()===1 && !/Guardar em qual meta/.test(await p.locator('.modal').innerText()), 'escolher a meta abre o formulário de guardar')
    await p.keyboard.press('Escape'); await esperar(p)
    await p.locator('.metas-movel .widget .linha-movel').first().click(); await esperar(p,900)
    ok(await p.locator('.modal').count()===1, 'tocar numa meta abre a ficha')
    await p.keyboard.press('Escape'); await esperar(p)
    // Dinheiro guardado: o total e uma página por banco; tocar no banco abre os saldos para editar
    await abrir(p, `${t.url}#/patrimonio`)
    const nPag=await p.locator('.hero-movel-pagina').count(), nBancos=await p.locator('.guardado-movel .widget .linha-movel').count()
    ok(nPag>=2 && nPag===1+await p.evaluate(()=>[...document.querySelectorAll('.guardado-movel .widget .linha-movel .icone-banco-movel')].length) && await p.locator('.fab').count()===0, `Guardado: total + uma página por banco (${nPag} páginas, ${nBancos} linhas)`)
    await p.locator('.hero-movel-pontos button').nth(1).click(); await esperar(p,1400)
    ok(await p.evaluate(()=>document.querySelector('.movel-fundo i.ativo')?.dataset.t)==='cor', 'a página do banco tem a cor dele')
    await p.locator('.guardado-movel .widget .linha-movel').first().click(); await esperar(p,1200)
    ok(await p.locator('.gd-tipos .gd-tipo').count()===3, 'abrir o banco mostra conta, caixinha e reserva para atualizar')
    await p.locator('.acoes-movel button', { hasText: 'Todos' }).click(); await esperar(p,900)
    ok(await p.locator('.gd-tipos').count()===0 && await p.locator('.hero-movel-pagina').count()===nPag, '"Todos" volta para todos os bancos')
    await t.fechar()
  }

  // ---------- Consultor e Invest: a tela que eles montam fica como eles montaram ----------
  {
    const titulos = async (largura, toque) => {
      const t = await iniciar({ perfil: {...demo.perfil, detalhe:'detalhado'}, dados: demo.dados, porta: 4950+Math.floor(Math.random()*40), dpr: 1, toque })
      const p=t.page
      await p.clock.install({ time: new Date('2026-11-16T10:00:00') })
      await p.setViewportSize({ width: largura, height: 900 })
      await abrir(p, `${t.url}#/analise`)
      const r = await p.evaluate(()=>({ cartoes:[...document.querySelectorAll('.peca h3, .peca .peca-titulo')].map(e=>e.textContent.trim()).filter(Boolean), movel:Boolean(document.querySelector('.consultor-movel')) }))
      return { t, p, r }
    }
    const movel = await titulos(390, true)
    const computador = await titulos(1280, false)
    ok(movel.r.movel && !computador.r.movel, 'Consultor: no celular a tela do celular, no computador a de sempre')
    ok(movel.r.cartoes.length >= 3 && JSON.stringify(movel.r.cartoes)===JSON.stringify(computador.r.cartoes),
      `Consultor: os cartões que ele monta vêm na mesma ordem no celular e no computador (${movel.r.cartoes.length} cartões)`)
    const p=movel.p
    ok(await p.locator('.consultor-movel .an-manchete').count()===1 && await p.locator('.fab').count()===0, 'Consultor: a manchete dele logo abaixo do topo, sem o "+"')
    await p.locator('.acoes-movel button', { hasText: 'Objetivo' }).click(); await esperar(p,900)
    ok(await p.evaluate(()=>{ const el=document.querySelector('.consultor-movel .an-obj, .consultor-movel .an-obj-faixa'); if(!el) return false; const b=el.getBoundingClientRect(); return b.top>=0 && b.top<innerHeight }), '"Objetivo" leva até o objetivo')
    // Invest: as quatro abas cabem e trocam
    await abrir(p, `${movel.t.url}#/invest`)
    ok(await p.locator('.invest-movel .hero-movel-pagina').count()>=2 && await p.locator('.fab').count()===0, 'Invest: topo com a carteira e o aportado, sem o "+"')
    const cortadas=await p.evaluate(()=>[...document.querySelectorAll('.invest-movel .inv-abas span')].filter(e=>e.scrollWidth>e.clientWidth+1).map(e=>e.textContent))
    ok(!cortadas.length, `Invest: o nome das quatro abas cabe ${cortadas.join(', ')}`)
    await p.locator('.invest-movel .inv-abas button', { hasText: 'Análises' }).click(); await esperar(p,1200)
    ok(await p.locator('.invest-movel .peca').count()>0, 'Invest: a aba Análises mostra as descobertas montadas pelo analista')
    await movel.t.fechar(); await computador.t.fechar()
  }

  const t = await iniciar({ perfil: {...demo.perfil, detalhe:'equilibrado'}, dados: demo.dados, porta: 4950+Math.floor(Math.random()*40), dpr: 1, toque:true })
  const p=t.page
  await p.clock.install({ time: new Date('2026-11-16T10:00:00') })
  await p.setViewportSize({ width: 390, height: 800 })
  await abrir(p, `${t.url}#/inicio`)
  // o topo que desliza
  const paginas=await p.locator('.hero-movel-pagina').count()
  ok(paginas===4, `topo com 4 páginas (sobra, guardado, dívidas, investimentos): ${paginas}`)
  const tom0=await p.evaluate(()=>document.querySelector('.movel-fundo i.ativo')?.dataset.t)
  await p.locator('.hero-movel-pontos button').nth(2).click(); await esperar(p,1200)
  const depois=await p.evaluate(()=>({tom:document.querySelector('.movel-fundo i.ativo')?.dataset.t, ponto:[...document.querySelectorAll('.hero-movel-pontos button')].findIndex(b=>b.classList.contains('ativo'))}))
  ok(['sobra','falta'].includes(tom0) && depois.tom==='dividas' && depois.ponto===2, `deslizar troca a página e a cor (${tom0} → ${depois.tom}, ponto ${depois.ponto})`)
  // alvos do tutorial
  for (const alvo of ['lancar','nav-inicio','nav-lancamentos','mais','menu-conta']) ok(await p.locator(`[data-tour="${alvo}"]:visible`).count()>0, `tutorial acha "${alvo}"`)
  ok(await p.locator('.fab').count()===0, 'sem o "+" na Início (a fileira de ações faz o papel dele)')
  // a conta tocada abre a conferência, sem pagar nada
  // (a fatura leva para a tela Cartões; a conta do mês, "Internet" nos dados de demonstração, abre a conferência)
  const linhaDaConta=p.locator('.widget[aria-label="Contas a pagar"] .linha-movel', { hasText: 'Internet' })
  ok(await linhaDaConta.count()===1, 'a conta "Internet" está na lista de contas a pagar')
  await linhaDaConta.click(); await esperar(p,900)
  ok(await p.locator('.modal').count()===1 && await p.locator('.widget[aria-label="Contas a pagar"] .linha-movel', { hasText: 'Internet' }).count()===1,
    'tocar numa conta abre a conferência, sem dar baixa direto')
  await p.keyboard.press('Escape'); await esperar(p)
  // folhas
  await p.locator('.abas-movel-nova button[data-tour="mais"]').click(); await esperar(p)
  const mais=await p.locator('.mais-grade').innerText()
  ok(/Contas/.test(mais) && /Dívidas/.test(mais) && /Ajustes/.test(mais), 'o "Mais" tem as outras telas e os ajustes')
  await p.locator('.mais-grade button[data-tour="nav-ano"]').click(); await esperar(p,1500)
  ok(await p.evaluate(()=>location.hash)==='#/ano' && await p.locator('.abas-movel-nova button[data-tour="mais"].ativo').count()===1, 'tela do "Mais" abre e a aba "Mais" fica marcada')
  ok(await p.locator('.fab').count()===1, 'nas telas sem versão de celular ainda, o "+" continua')
  await p.locator('.topo-movel-avatar').click(); await esperar(p)
  const conta=await p.locator('.lista-folha').innerText()
  ok(/Configurações/.test(conta) && /Sair/.test(conta) && /Suporte/.test(conta), 'a foto abre a conta (configurações, suporte, sair)')
  await p.keyboard.press('Escape'); await esperar(p)
  await p.locator('.topo-movel-mes').click(); await esperar(p)
  await p.locator('.meses-movel .quadro-meses-grade button').nth(9).click(); await esperar(p,900)
  ok((await p.locator('.topo-movel-mes').innerText()).trim().toLowerCase().startsWith('out'), 'o mês do topo troca o mês aberto')
  // busca do topo leva aos lançamentos
  await p.locator('.topo-movel-busca input').fill('notebook'); await esperar(p,1200)
  ok(await p.evaluate(()=>location.hash)==='#/lancamentos', 'buscar no topo abre os lançamentos')
  await t.fechar()

  // ---------- escolher, tirar e mudar a ordem dos cartões (gravado na conta, migração 35) ----------
  for (const semColuna of [false, true]) {
    const nome = semColuna ? 'sem a migração 35' : 'com a migração 35'
    const t = await iniciar({ perfil: {...demo.perfil, detalhe:'simples'}, dados: demo.dados, porta: 4950+Math.floor(Math.random()*40), dpr: 1, toque:true,
      semColunas: semColuna ? { perfis: ['celular'] } : {} })
    const p=t.page
    await p.clock.install({ time: new Date('2026-11-16T10:00:00') })
    await p.setViewportSize({ width: 390, height: 800 })
    await abrir(p, `${t.url}#/inicio`)
    const ordem=()=>p.evaluate(()=>[...document.querySelectorAll('.widgets-movel [data-cartao]')].map(e=>e.dataset.cartao))
    const antes=await ordem()
    await p.locator('.cartoes-adicionar').click(); await esperar(p)
    ok(await p.locator('.previa-cartao').count()>=5, `${nome}: a folha mostra os cartões que faltam`)
    ok(await p.locator('.abas-movel-nova').isVisible()===false, `${nome}: com a folha aberta a barra de abas sai da frente`)
    await p.locator('.previa-cartao-botao[aria-label*="Gasto do mês"]').click(); await esperar(p,900)
    const comGasto=await ordem()
    ok(comGasto.at(-1)==='gasto-mes' && comGasto.length===antes.length+1, `${nome}: o cartão novo entra no fim (${comGasto.join(', ')})`)
    await p.locator('.cartoes-arrumar').click(); await esperar(p)
    await p.locator('button[aria-label="Subir o cartão Gasto do mês"]').click(); await esperar(p,300)
    await p.locator('button[aria-label="Tirar o cartão Metas"]').click(); await esperar(p,300)
    await p.getByRole('button', { name: 'Pronto' }).click(); await esperar(p,900)
    const arrumada=await ordem()
    const subiu=[...comGasto]; const i=subiu.indexOf('gasto-mes'); [subiu[i-1],subiu[i]]=[subiu[i],subiu[i-1]]; const esperada=subiu.filter(x=>x!=='metas')
    ok(JSON.stringify(arrumada)===JSON.stringify(esperada), `${nome}: subir e tirar mudam a tela (${arrumada.join(', ')})`)
    const gravado=t.log.filter(x=>x[0]==='PATCH'&&x[1]==='perfis'&&x[2].celular).at(-1)
    if (!semColuna) ok(gravado && JSON.stringify(gravado[2].celular.inicio.ordem)===JSON.stringify(arrumada), 'a arrumação vai para a conta (perfis.celular)')
    ok(await p.locator('.alerta[role="alert"]').count()===0, `${nome}: nenhum aviso de erro`)
    await abrir(p, `${t.url}#/inicio`)
    ok(JSON.stringify(await ordem())===JSON.stringify(arrumada), `${nome}: depois de recarregar, a mesma arrumação`)
    if (!semColuna) {
      // outro aparelho (sem a cópia local): a arrumação vem da conta
      await p.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('opuscash-celular-')).forEach(k=>localStorage.removeItem(k)))
      await abrir(p, `${t.url}#/inicio`)
      ok(JSON.stringify(await ordem())===JSON.stringify(arrumada), 'em outro aparelho, a arrumação vem da conta')
      await p.locator('.cartoes-arrumar').click(); await esperar(p)
      await p.locator('button', { hasText: 'Voltar ao modelo' }).click(); await esperar(p,900)
      ok(JSON.stringify(await ordem())===JSON.stringify(antes), '"Voltar ao modelo" devolve os cartões do jeito')
    }
    await t.fechar()
  }

  {
  const t = await iniciar({ perfil: {...demo.perfil, detalhe:'equilibrado'}, dados: demo.dados, porta: 4950+Math.floor(Math.random()*40), dpr: 1, toque:true })
  const p=t.page
  // computador: nada do celular
  await p.setViewportSize({ width: 1280, height: 900 }); await abrir(p, `${t.url}#/inicio`)
  ok(await p.locator('.app.movel, .topo-movel, .hero-movel').count()===0 && await p.locator('.lateral').count()===1, 'no computador continua a tela de antes')
  await t.fechar()
  }
})().catch(e=>{console.error(e);process.exit(1)})
