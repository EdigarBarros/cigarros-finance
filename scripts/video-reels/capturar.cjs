// Fotografa as 8 telas do painel (celular, tema escuro) com a conta de demonstração, para o reels.html. Ver ROTEIRO.md.
const R=require('path').join(__dirname,'..','app-de-demonstracao')+'/'
const { iniciar } = require(R+'servidor-falso.cjs')
const demo = require(R+'dados-de-demonstracao.cjs')
const fs=require('fs')
;(async()=>{
  const t = await iniciar({ perfil: demo.perfil, dados: demo.dados, porta: 4802, dpr: 3 })
  const p=t.page
  await p.emulateMedia({colorScheme:'dark',reducedMotion:'reduce'})
  await p.setViewportSize({width:430,height:932})
  fs.mkdirSync(__dirname+'/cap',{recursive:true})
  const meta={}
  for (const pg of ['inicio','lancamentos','contas','cartoes','dividas','metas','patrimonio','ano']){
    await p.goto(`${t.url}#/${pg}`); await p.evaluate(()=>document.documentElement.classList.remove('esc')); await p.waitForTimeout(2800)
    await p.locator('nav.abas-movel').screenshot({path:`${__dirname}/cap/nav_${pg}.png`})
    if(pg==='inicio'){ await p.locator('button.fab').screenshot({path:`${__dirname}/cap/fab.png`}); await p.locator('header.barra').screenshot({path:__dirname+'/cap/barra.png'}) }
    await p.evaluate(()=>{if(!document.getElementById('esc-st')){const st=document.createElement('style');st.id='esc-st';st.textContent='.esc .fab,.esc .abas-movel{visibility:hidden!important}';document.head.appendChild(st)};document.documentElement.classList.add('esc')})
    await p.waitForTimeout(200)
    const H0=await p.evaluate(()=>document.documentElement.scrollHeight)
    await p.setViewportSize({width:430,height:H0}); await p.waitForTimeout(3500)
    await p.screenshot({path:`${__dirname}/cap/${pg}.png`})
    await p.evaluate(()=>document.querySelectorAll('.pagina canvas').forEach(c=>c.style.visibility='hidden'))
    await p.screenshot({path:`${__dirname}/cap/${pg}_vazio.png`})
    meta[pg]=await p.evaluate(()=>{
      const pag=document.querySelector('.pagina')
      const ehCard=e=>{const s=getComputedStyle(e);const r=e.getBoundingClientRect();return r.width>=150&&r.height>=40&&parseFloat(s.borderTopLeftRadius)>=10&&(s.backgroundColor!=='rgba(0, 0, 0, 0)'||s.backgroundImage!=='none'||parseFloat(s.borderTopWidth)>0)}
      const out=[]
      const andar=e=>{for(const c of e.children){ if(ehCard(c)){const r=c.getBoundingClientRect();out.push({x:Math.round(r.left),y:Math.round(r.top+scrollY),w:Math.round(r.width),h:Math.round(r.height),cls:String(c.className).slice(0,40),txt:c.innerText.slice(0,30).replace(/\n/g,' | ')})} else andar(c)}}
      andar(pag)
      const b=document.querySelector('header.barra').getBoundingClientRect()
      const cv=[...pag.querySelectorAll('canvas')].map(c=>{const r=c.getBoundingClientRect();return {x:Math.round(r.left),y:Math.round(r.top+scrollY),w:Math.round(r.width),h:Math.round(r.height)}})
      return {canvas:cv,H:document.documentElement.scrollHeight,barra:{y:Math.round(b.top+scrollY),h:Math.round(b.height)},cards:out}
    })
    await p.setViewportSize({width:430,height:932})
  }
  fs.writeFileSync(__dirname+'/cap/meta.json',JSON.stringify(meta,null,1))
  console.log(t.msgs.slice(0,5))
  await t.fechar()
})()
