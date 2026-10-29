// Servidor estático do dist + Supabase falso em memória + Chromium (Playwright). Só para gerar as capturas da landing page.
// Servidor estático do dist + Supabase falso em memória, para testar o app no Chromium.
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto')
const CSP=JSON.parse(fs.readFileSync(path.join(__dirname,'..','..','vercel.json'))).headers[0].headers.find(h=>h.key==='Content-Security-Policy').value
const root=path.join(__dirname,'..','..','dist')
const mime={'.js':'text/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.webp':'image/webp','.webmanifest':'application/json','.mjs':'text/javascript'}
const uid='11111111-1111-4111-8111-111111111111'
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url')
const jwt=`${b64({alg:'HS256',typ:'JWT'})}.${b64({sub:uid,role:'authenticated',exp:4102444800})}.x`
const user={id:uid,aud:'authenticated',role:'authenticated',email:'teste@exemplo.com',user_metadata:{nome:'Teste'},app_metadata:{},created_at:'2026-01-01T00:00:00Z'}
const sessao={access_token:jwt,refresh_token:'r',token_type:'bearer',expires_in:99999,expires_at:4102444800,user}
const body0=r=>{try{return r.postDataJSON()}catch{return null}}
exports.iniciar=async function({semPerfil=false,perfil={},dados={},porta=4999,semSessao=false,assinatura=null,funcoes={},dpr=1}={}){
  const db0=0;const db={assinaturas:[{user_id:uid,status:'cortesia',teste_fim:null,periodo_fim:null,cancela_no_fim:false,moeda:null}],
    perfis:[{user_id:uid,nome:'Teste',moeda:'BRL',moedas:[],detalhe:'detalhado',modulos:{dividas:true,contas:true,cartoes:true,bancos:true,investimentos:true,moedas:false,metas:true},dispensadas:['tour','importar'],onboarding_em:'2026-01-01T00:00:00Z',...perfil}],
    categorias:[],lancamentos:[],meses:[],dividas:[],divida_saldos:[],bancos:[],metas:[],meta_movimentos:[],contas_fixas:[],cartoes:[],faturas_pagas:[],erros_app:[],...dados}
  const cats=[['saida','Alimentação'],['saida','Moradia'],['saida','Outros'],['saida','Dívidas e parcelas'],['entrada','Salário'],['entrada','Outros']]
  const srv=http.createServer((q,r)=>{let p=path.join(root,q.url.split('?')[0]);if(!fs.existsSync(p)||fs.statSync(p).isDirectory())p=path.join(root,'index.html');r.writeHead(200,{'content-type':mime[path.extname(p)]||'text/plain','content-security-policy':CSP});fs.createReadStream(p).pipe(r)})
  await new Promise(r=>srv.listen(porta,r))
  const {chromium}=require('playwright')
  const browser=await chromium.launch()
  const ctx=await browser.newContext({viewport:{width:1280,height:900},deviceScaleFactor:dpr})
  if(!semSessao) await ctx.addInitScript(([s])=>{try{localStorage.setItem('sb-fake-auth-token',JSON.stringify(s))}catch{}},[sessao])
  const log=[]
  if(semPerfil) db.perfis=[]
  if(assinatura) db.assinaturas=assinatura==='nenhuma'?[]:[{user_id:uid,status:assinatura,teste_fim:null,periodo_fim:null,cancela_no_fim:false,moeda:null}]
  await ctx.route('https://fake.supabase.co/**',async route=>{
    const req=route.request(),u=new URL(req.url()),m=req.method()
    const h={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*','content-type':'application/json'}
    if(m==='OPTIONS')return route.fulfill({status:204,headers:h})
    const t=u.pathname.split('/').pop()
    if(u.pathname.includes('/rpc/')){ if(t==='criar_categorias_padrao'){cats.forEach(([tipo,nome],i)=>db.categorias.push({id:crypto.randomUUID(),user_id:uid,tipo,nome,icone:'🏷️',cor:'#888',papel:nome.startsWith('Dívidas')?'divida':null,ordem:i}))} return route.fulfill({status:200,headers:h,body:'null'})}
    if(u.pathname.includes('/functions/v1/')){log.push(['FUNC',t,body0(req)]);const f=funcoes[t]||{ok:true};return route.fulfill({status:200,headers:h,body:JSON.stringify(f)})}
    if(u.pathname.includes('/auth/v1/recover')||u.pathname.includes('/auth/v1/resend')||u.pathname.includes('/auth/v1/logout')){log.push(['AUTH',t,body0(req)]);return route.fulfill({status:200,headers:h,body:'{}'})}
    if(u.pathname.includes('/auth/v1/signup')){log.push(['AUTH','signup',body0(req)]);return route.fulfill({status:200,headers:h,body:JSON.stringify({id:uid,email:'novo@exemplo.com',identities:[{}]})})}
    if(u.pathname.includes('/auth/v1/user'))return route.fulfill({status:200,headers:h,body:JSON.stringify(user)})
    if(u.pathname.includes('/auth/v1'))return route.fulfill({status:200,headers:h,body:JSON.stringify({...sessao,user})})
    if(!(t in db))return route.fulfill({status:404,headers:h,body:JSON.stringify({code:'42P01',message:'relation does not exist'})})
    const single=/pgrst\.object/.test(req.headers()['accept']||'')
    let body=null;try{body=req.postDataJSON()}catch{}
    if(m==='GET'||m==='HEAD'){const rows=db[t];return route.fulfill({status:200,headers:h,body:JSON.stringify(single?(rows[0]??null):rows)})}
    if(m==='POST'){const arr=Array.isArray(body)?body:[body];const novos=arr.map(x=>({id:crypto.randomUUID(),user_id:uid,created_at:new Date().toISOString(),...x}));
      if(u.searchParams.get('on_conflict')||/merge-duplicates/.test(req.headers()['prefer']||'')){const i=db[t].findIndex(x=>x.user_id===uid);if(i>=0&&t==='perfis'){db[t][i]={...db[t][i],...novos[0],id:undefined};return route.fulfill({status:201,headers:h,body:'[]'})}}
      db[t].push(...novos);log.push(['POST',t,novos]);return route.fulfill({status:201,headers:h,body:JSON.stringify(single?novos[0]:novos)})}
    if(m==='PATCH'){const id=(u.searchParams.get('id')||'').replace('eq.','');const rows=db[t].filter(x=>!id||x.id===id||t==='perfis');rows.forEach(x=>Object.assign(x,body));log.push(['PATCH',t,body]);return route.fulfill({status:200,headers:h,body:JSON.stringify(rows)})}
    if(m==='DELETE'){const id=(u.searchParams.get('id')||'').replace('eq.','');db[t]=db[t].filter(x=>id&&x.id!==id);log.push(['DELETE',t,id]);return route.fulfill({status:204,headers:h,body:''})}
    route.fulfill({status:200,headers:h,body:'[]'})
  })
  const page=await ctx.newPage()
  const msgs=[];page.on('console',x=>{if(['error','warning'].includes(x.type()))msgs.push(x.type()+': '+x.text().slice(0,300))});page.on('pageerror',e=>msgs.push('PAGEERROR: '+e.message))
  return {page,db,log,msgs,sessao,url:`http://localhost:${porta}/`,fechar:async()=>{await browser.close();srv.close()}}
}
