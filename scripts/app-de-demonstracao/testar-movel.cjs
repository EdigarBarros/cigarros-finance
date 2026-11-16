// Moldura e Início do celular (src/movel): nos três jeitos, em 320, 360, 390 e 430 px, nos temas escuro e claro e com a
// fonte a 150% e 200%: sem rolagem de lado, nada fora da tela, toques do topo, das ações e das abas com 44 px, e o fim da
// tela acima da barra de baixo. Depois: o topo que desliza (ponto ativo e cor), o modelo de cada jeito, a conta tocada abre
// a conferência, as folhas "Mais", da conta e dos meses, os alvos do tutorial, adicionar/tirar/subir cartões (gravado na
// conta, com e sem a migração 35, e de volta depois de recarregar) e o computador sem nada do celular.
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
  const pequenos=[...document.querySelectorAll('.topo-movel button, .topo-movel-busca, .acoes-movel button, .abas-movel-nova button, .hero-movel-pilula, .linha-movel, .widget-titulo, .widget-rodape')]
    .filter(visivel).filter(e=>{const b=e.getBoundingClientRect();return b.height<36||b.width<36||(e.matches('.topo-movel button, .acoes-movel button, .abas-movel-nova button, .hero-movel-pilula')&&b.height<44)})
    .map(e=>`${(e.getAttribute('aria-label')||e.textContent).trim().slice(0,20)} ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`)
  window.scrollTo(0, document.documentElement.scrollHeight)
  const ult=[...document.querySelectorAll('.inicio-movel > *')].filter(visivel).pop().getBoundingClientRect(), nav=document.querySelector('.abas-movel').getBoundingClientRect()
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
  await p.locator('.mais-grade button[data-tour="nav-dividas"]').click(); await esperar(p,1500)
  ok(await p.evaluate(()=>location.hash)==='#/dividas' && await p.locator('.abas-movel-nova button[data-tour="mais"].ativo').count()===1, 'tela do "Mais" abre e a aba "Mais" fica marcada')
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
