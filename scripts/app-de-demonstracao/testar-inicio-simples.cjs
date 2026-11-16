// Início do jeito simples no celular: topo, "Mais", previsão = cálculo, gastos por categoria, "Marcar como paga",
// troca de modo e, em 320, 360, 390 e 430 px, nada cortado, sem rolagem de lado e o fim da tela acima da barra de baixo.
// Uso (depois do build com fake.supabase.co do README desta pasta): node scripts/app-de-demonstracao/testar-inicio-simples.cjs
const path=require('path')
const R=path.join(__dirname,'..','..')
const { iniciar } = require(R+'/scripts/app-de-demonstracao/servidor-falso.cjs')
const demo = require(R+'/scripts/app-de-demonstracao/dados-de-demonstracao.cjs')
const ok=(c,m)=>{console.log((c?'OK   ':'FALHA ')+m); if(!c) process.exitCode=1}
;(async()=>{
  const t = await iniciar({ perfil: {...demo.perfil, detalhe:'simples'}, dados: demo.dados, porta: 4950+Math.floor(Math.random()*40), dpr: 1, toque:true })
  const p=t.page
  await p.emulateMedia({colorScheme:'dark'})
  await p.clock.install({ time: new Date('2026-11-16T10:00:00') })
  for (const w of [320, 360, 390, 430]) {
    await p.setViewportSize({ width: w, height: 800 })
    await p.goto(`${t.url}#/`); await p.waitForTimeout(2500); await p.clock.runFor(3000).catch(()=>{}); await p.waitForTimeout(500)
    const r = await p.evaluate(()=>{
      const cw=document.documentElement.clientWidth
      const cortados=[...document.querySelectorAll('.inicio-simples *')].filter(e=>getComputedStyle(e).textOverflow==='ellipsis'&&e.scrollWidth>e.clientWidth+1).length
      const fora=[...document.querySelectorAll('.inicio-simples *, .barra *')].filter(e=>{const b=e.getBoundingClientRect();return b.width>0&&(b.right>cw+0.5||b.left<-0.5)}).length
      const pequenos=[...document.querySelectorAll('.inicio-simples button, .barra button')].filter(e=>{const b=e.getBoundingClientRect();return b.width>0&&(b.height<44||b.width<44)}).map(e=>e.textContent.trim())
      window.scrollTo(0, document.documentElement.scrollHeight)
      const ult=document.querySelector('.is-modo-atual').getBoundingClientRect(), nav=document.querySelector('.abas-movel').getBoundingClientRect()
      return {lado:document.documentElement.scrollWidth>cw, cortados, fora, pequenos, acima: ult.bottom<=nav.top}
    })
    ok(!r.lado && !r.cortados && !r.fora, `${w}px: sem rolagem de lado, sem valor cortado ou fora da tela`)
    ok(!r.pequenos.length, `${w}px: toques de 44px ou mais ${r.pequenos.join(', ')}`)
    ok(r.acima, `${w}px: o fim da tela rola para cima da barra de baixo`)
  }
  await p.setViewportSize({ width: 390, height: 800 })
  await p.goto(`${t.url}#/`); await p.waitForTimeout(2500); await p.clock.runFor(3000).catch(()=>{}); await p.waitForTimeout(500)
  const foto=async()=>{await p.waitForTimeout(700)}
  ok(await p.locator('.fab').count()===0, 'sem o "+" no Início do jeito simples')
  ok(await p.locator('.barra .suporte-btn, .barra .idioma, .barra .menu-movel, .barra .ajustes-btn').count()===0, 'topo sem suporte, idioma, menu e configurações')
  ok(await p.locator('.barra button[aria-pressed]').count()===1, 'topo com o olho')
  const porque=await p.locator('.is-orientacao-texto p').innerText()
  ok(porque.length>0 && porque.split(/(?<=[.!?])\s+(?=\p{Lu})/u).length<=2, 'orientação com até 2 frases: '+porque.slice(0,60))
  // o "Mais" tem idioma, suporte, configurações, tema e sair
  await p.locator('.abas-movel button[data-tour="mais"]').click(); await foto()
  const textoMais=await p.locator('.mais-lista').innerText()
  for (const x of ['Idioma','Suporte','Configurações','Tema claro','Sair','Metas']) ok(textoMais.includes(x), 'Mais tem '+x)
  await p.locator('.mais-idioma .idioma-btn').click(); await p.waitForTimeout(400)
  ok(await p.locator('.idioma-menu').isVisible(), 'idioma abre de dentro do Mais'); await foto()
  await p.goto(`${t.url}#/`); await p.reload(); await p.waitForTimeout(2500); await p.clock.runFor(3000).catch(()=>{}); await p.waitForTimeout(500)
  // Ver cálculo: os números batem com o resumo
  const frase=await p.locator('.is-previsao-frase').innerText()
  await p.locator('.is-ver-calculo').click(); await foto()
  const total=await p.locator('.em-total .em-passo b').innerText()
  ok(frase.replace(/\s/g,'').includes(total.replace(/[−\s]/g,'')), `previsão "${frase}" = cálculo "${total}"`)
  await p.keyboard.press('Escape'); await p.waitForTimeout(300)
  // gastos por categoria: barras na mesma escala do total
  await p.locator('.is-acesso', {hasText:'Gastos por categoria'}).click(); await foto()
  const barras=await p.$$eval('.is-gastos-lista li', ls=>ls.map(li=>{const t=li.querySelector('.is-gastos-barra'),b=t.querySelector('span');return {pct:li.querySelector('small').textContent, larg:Math.round(b.getBoundingClientRect().width/t.getBoundingClientRect().width*100)}}))
  ok(barras.every(b=>b.pct==='<1%'||Math.abs(parseInt(b.pct)-b.larg)<=1), 'barra = porcentagem: '+JSON.stringify(barras.slice(0,3)))
  await p.keyboard.press('Escape'); await p.waitForTimeout(300)
  // marcar como paga: abre a conferência com valor, dia e banco, e grava a baixa
  const linha=p.locator('.is-conta', {hasText:'Aluguel'})
  await linha.locator('button').click(); await foto()
  ok(await p.locator('.modal input[aria-label="Valor"]').count()===1, 'conferência tem o valor')
  ok(await p.locator('.modal').innerText().then(x=>x.includes('Nubank')), 'conferência tem o banco')
  const antes=t.db.lancamentos.length
  await p.locator('.modal button[type="submit"]').click(); await p.waitForTimeout(1200)
  const novo=t.db.lancamentos.slice(antes).find(l=>l.descricao==='Aluguel')
  ok(novo && novo.valor===1800 && novo.data==='2026-11-16' && novo.banco_id, 'baixa gravada: '+JSON.stringify(novo&&{valor:novo.valor,data:novo.data,banco:!!novo.banco_id}))
  // registrar entrada e saída abrem o formulário certo
  await p.locator('.is-acoes .btn.entrada').click(); await p.waitForTimeout(700)
  ok(await p.locator('.modal').count()===1, 'Registrar entrada abre o formulário'); await foto()
  await p.keyboard.press('Escape'); await p.waitForTimeout(300)
  // trocar o modo: grava no perfil e mantém
  await p.locator('.is-modo-atual .link').click(); await foto()
  await p.locator('.is-modo').nth(1).click(); await p.waitForTimeout(1200)
  ok(t.db.perfis[0].detalhe==='equilibrado', 'modo gravado no perfil: '+t.db.perfis[0].detalhe)
  ok(await p.locator('.inicio-simples').count()===0, 'tela mudou para o equilibrado')
  const erros=t.msgs.filter(m=>m.startsWith('PAGEERROR')); ok(!erros.length, 'nenhum PAGEERROR '+erros.join(' '))
  await t.fechar()

  // várias parcelas atrasadas da mesma dívida numa linha: o valor diz que é a soma delas, e o prazo é o da mais antiga
  const dados=JSON.parse(JSON.stringify(demo.dados))
  dados.lancamentos=dados.lancamentos.filter(l=>!(l.divida_id===dados.dividas[1].id&&l.mes>=9))
  const t2 = await iniciar({ perfil: {...demo.perfil, detalhe:'simples'}, dados, porta: 4990+Math.floor(Math.random()*9), dpr: 1, toque:true })
  await t2.page.clock.install({ time: new Date('2026-11-16T10:00:00') })
  await t2.page.setViewportSize({ width: 360, height: 800 })
  await t2.page.goto(`${t2.url}#/`); await t2.page.waitForTimeout(2500); await t2.page.clock.runFor(3000).catch(()=>{}); await t2.page.waitForTimeout(500)
  if(await t2.page.locator('.is-pe .is-ver').first().innerText().then(x=>x.startsWith('Ver todas'))) await t2.page.locator('.is-pe .is-ver').first().click()
  const linhaParcelas=await t2.page.locator('.is-conta',{hasText:'Empréstimo pessoal'}).innerText()
  ok(/soma de 3 parcelas/.test(linhaParcelas) && /a mais antiga venceu há \d+ dias/.test(linhaParcelas) && /Registrar pagamento/.test(linhaParcelas), 'parcelas somadas explícitas: '+linhaParcelas.replace(/\n/g,' | '))
  await t2.fechar()
})()
