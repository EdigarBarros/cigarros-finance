// O arrasto do topo colorido no celular, com o processador 4x mais lento (como um celular simples): com o dedo na tela,
// só os pontos mudam (nada da lista de baixo e a página não sai do lugar); ao soltar, a página troca e encaixa certinho.
// Antes da correção de 16/11/2026, em Dívidas, eram 54 mudanças na tela e a página se deslocava no meio do gesto.
// Uso (depois do build com fake.supabase.co do README desta pasta): node scripts/app-de-demonstracao/testar-arrasto.cjs
const path=require('path')
const R=path.join(__dirname,'..','..')
const { iniciar } = require(R+'/scripts/app-de-demonstracao/servidor-falso.cjs')
const demo = require(R+'/scripts/app-de-demonstracao/dados-de-demonstracao.cjs')
const ok=(c,m)=>{console.log((c?'OK   ':'FALHA ')+m); if(!c) process.exitCode=1}

;(async()=>{
  const t = await iniciar({ perfil: {...demo.perfil, detalhe: 'equilibrado'}, dados: demo.dados, porta: 4950+Math.floor(Math.random()*40), dpr: 1, toque: true })
  const p=t.page
  await p.clock.install({ time: new Date('2026-11-16T10:00:00') })
  await p.setViewportSize({ width: 390, height: 844 })
  const cdp=await p.context().newCDPSession(p)
  for (const tela of ['dividas', 'inicio', 'lancamentos', 'analise', 'invest', 'contas', 'cartoes', 'metas', 'patrimonio']) {
    await p.goto(`${t.url}#/${tela}`); await p.waitForTimeout(2200); await p.clock.runFor(3000).catch(()=>{}); await p.waitForTimeout(400)
    if (await p.locator('.hero-movel-pagina').count() < 2) { console.log(`      ${tela}: uma página só no topo, nada a arrastar`); continue }
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
    await p.evaluate(()=>{
      window.__mud=0; window.__desloc=0; window.__dedo=true
      // os pontos podem mudar; o resto da tela não
      new MutationObserver((m)=>{ if(window.__dedo) window.__mud+=m.filter((x)=>!x.target.closest?.('.hero-movel-pontos')).length })
        .observe(document.querySelector('.app.movel'),{subtree:true,childList:true,characterData:true,attributes:true})
      new PerformanceObserver((l)=>l.getEntries().forEach(e=>{ if(window.__dedo) window.__desloc+=e.value })).observe({type:'layout-shift',buffered:false})
    })
    const caixa=await p.locator('.hero-movel-trilho').boundingBox()
    const y=caixa.y+caixa.height/2, x0=caixa.x+caixa.width*0.85, x1=caixa.x+caixa.width*0.15
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x0,y}]})
    for (let i=1;i<=20;i++) { await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x0+(x1-x0)*i/20,y}]}); await p.waitForTimeout(16) }
    const durante=await p.evaluate(()=>{ window.__dedo=false; return { mud:window.__mud, desloc:window.__desloc } })
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})
    await p.waitForTimeout(2000)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
    const fim=await p.evaluate(()=>{ const el=document.querySelector('.hero-movel-trilho'); return { pagina:Math.round(el.scrollLeft/el.clientWidth), torto:Math.round(el.scrollLeft%el.clientWidth), ponto:[...document.querySelectorAll('.hero-movel-pontos button')].findIndex(b=>b.classList.contains('ativo')) } })
    ok(durante.mud===0 && durante.desloc===0, `${tela}: com o dedo na tela, nada além dos pontos muda (${durante.mud} mudanças, deslocamento ${durante.desloc.toFixed(3)})`)
    ok(fim.pagina===1 && fim.ponto===1 && fim.torto===0, `${tela}: ao soltar, troca para a segunda página e encaixa (página ${fim.pagina}, ponto ${fim.ponto})`)
    if (tela==='dividas') ok(/Recebe todo mês/.test(await p.locator('.dividas-movel').innerText()), 'dividas: depois de parar, a lista de baixo passa para "Me devem"')
  }
  await t.fechar()
})().catch(e=>{console.error(e);process.exit(1)})
