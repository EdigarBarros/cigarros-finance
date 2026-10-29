// Conta de demonstração (Marina, 10 meses de histórico) usada nas capturas da landing page. Tudo inventado.
const U='11111111-1111-4111-8111-111111111111'
const ANO=2026
const id=(p,n)=>`${p}-${String(n).padStart(4,'0')}-4000-8000-000000000000`
const cats=[
 ['saida','Alimentação','🍽️','#ff9f0a',null],['saida','Moradia','🏠','#64d2ff',null],['saida','Transporte','🚗','#0a84ff',null],['saida','Saúde','💊','#ff6b6b',null],
 ['saida','Educação','📚','#5e5ce6',null],['saida','Lazer','🎉','#ff375f',null],['saida','Assinaturas','📺','#bf5af2',null],['saida','Compras','🛍️','#ff79c6',null],
 ['saida','Dívidas e parcelas','💳','#ffd60a','divida'],['saida','Outros','📦','#636366',null],
 ['entrada','Salário','💼','#30d158',null],['entrada','Renda extra','🧑‍💻','#63e6e2',null],['entrada','Rendimentos','📈','#bf5af2',null]]
const categorias=cats.map(([tipo,nome,icone,cor,papel],i)=>({id:id('c',i+1),user_id:U,tipo,nome,icone,cor,papel,ordem:i+1}))
const C=n=>categorias.find(c=>c.nome===n).id
const bancos=[{id:id('b',1),user_id:U,nome:'Nubank',cor:'#820ad1',ordem:0},{id:id('b',2),user_id:U,nome:'Itaú',cor:'#ec7000',ordem:1},{id:id('b',3),user_id:U,nome:'Carteira (dinheiro vivo)',cor:'#30d158',ordem:2}]
const [NU,IT,CA]=bancos.map(b=>b.id)
const cartoes=[
 {id:id('k',1),user_id:U,nome:'Nubank',cor:'#820ad1',banco_id:NU,limite:9000,dia_fechamento:3,dia_vencimento:10,ativo:true},
 {id:id('k',2),user_id:U,nome:'Itaú Click',cor:'#ec7000',banco_id:IT,limite:5000,dia_fechamento:20,dia_vencimento:27,ativo:true}]
const pad=n=>String(n).padStart(2,'0')
let seq=0
const L=(mes,dia,tipo,descricao,valor,cat,extra={})=>({id:id('l',++seq),user_id:U,ano:ANO,mes,tipo,descricao,valor,data:`${ANO}-${pad(mes)}-${pad(dia)}`,categoria_id:C(cat),banco_id:NU,forma:tipo==='entrada'?'pix':'pix',created_at:`${ANO}-${pad(mes)}-${pad(dia)}T12:00:00Z`,...extra})
const lanc=[]
const mercado=[890,960,1010,925,1080,940,1020,990,1055,742]
const extra=[0,800,0,1200,0,650,900,0,1500,2400]
for(let m=1;m<=10;m++){
  const hoje=m===10
  lanc.push(L(m,5,'entrada','Salário',6500,'Salário',{banco_id:NU,forma:'transferencia'}))
  if(extra[m-1]) lanc.push(L(m,12,'entrada','Freela de design',extra[m-1],'Renda extra'))
  lanc.push(L(m,5,'saida','Aluguel',1800,'Moradia',{forma:'boleto',conta_fixa_id:hoje?null:null}))
  lanc.push(L(m,8,'saida','Mercado Extra',Math.round(mercado[m-1]*0.55),'Alimentação',{forma:'debito'}))
  lanc.push(L(m,16-(m%3),'saida','Mercado Extra',Math.round(mercado[m-1]*0.45),'Alimentação',{forma:'debito'}))
  lanc.push(L(m,9,'saida','Plano de internet',119.9,'Moradia',{forma:'pix'}))
  lanc.push(L(m,11,'saida','Conta de luz',150+((m*37)%60),'Moradia',{forma:'pix'}))
  lanc.push(L(m,7,'saida','Combustível',220+((m*23)%90),'Transporte',{forma:'debito'}))
  lanc.push(L(m,14,'saida','Netflix',55.9,'Assinaturas',{forma:'pix'}))
  lanc.push(L(m,14,'saida','Spotify',21.9,'Assinaturas',{forma:'pix'}))
  lanc.push(L(m,13,'saida','iFood',60+((m*41)%110),'Alimentação',{forma:'pix'}))
  if(m%2===0) lanc.push(L(m,17,'saida','Cinema e jantar',140+((m*13)%80),'Lazer',{forma:'pix'}))
  if(m%3===0) lanc.push(L(m,10,'saida','Farmácia',68+((m*7)%50),'Saúde',{forma:'debito'}))
  lanc.push(L(m,10,'saida','Parcela do carro',1250,'Dívidas e parcelas',{forma:'pix',divida_id:id('d',1)}))
  lanc.push(L(m,15,'saida','Parcela do empréstimo',480,'Dívidas e parcelas',{forma:'pix',divida_id:id('d',2)}))
}
// outubro só até o dia 18: tira o que ainda não aconteceu
const sem=lanc.filter(l=>!(l.mes===10&&(+l.data.slice(8,10)>18)))
lanc.length=0; lanc.push(...sem)
// compras no cartão (cada parcela é uma saída com data no vencimento da fatura)
const compras=[
 {cartao:cartoes[0],desc:'iPhone 15',total:5400,n:12,data:'2026-07-20',cat:'Compras'},
 {cartao:cartoes[0],desc:'Curso de inglês',total:1980,n:6,data:'2026-08-28',cat:'Educação'},
 {cartao:cartoes[0],desc:'Tênis de corrida',total:540,n:3,data:'2026-10-09',cat:'Compras'},
 {cartao:cartoes[1],desc:'Notebook',total:6800,n:10,data:'2026-06-15',cat:'Compras'},
 {cartao:cartoes[1],desc:'Jantar de aniversário',total:420,n:1,data:'2026-10-12',cat:'Lazer'},
 {cartao:cartoes[1],desc:'Passagens para Salvador',total:1860,n:6,data:'2026-09-02',cat:'Lazer'}]
compras.forEach((cp,ci)=>{
  const [a,m,d]=cp.data.split('-').map(Number), c=cp.cartao
  let fm=m, fa=a; if(d>c.dia_fechamento){fm++; if(fm>12){fm=1;fa++}}
  let vm=fm, va=fa; if(c.dia_vencimento<=c.dia_fechamento){vm++; if(vm>12){vm=1;va++}}
  const base=Math.round(cp.total*100/cp.n)/100
  for(let k=0;k<cp.n;k++){
    let pm=vm+k, pa=va; while(pm>12){pm-=12;pa++}
    if(pa!==ANO) continue
    lanc.push({id:id('l',++seq),user_id:U,ano:pa,mes:pm,tipo:'saida',descricao:cp.desc,valor:base,data:`${pa}-${pad(pm)}-${pad(c.dia_vencimento)}`,categoria_id:C(cp.cat),banco_id:null,
      cartao_id:c.id,compra_id:id('p',ci+1),parcela:k+1,parcelas:cp.n,data_compra:cp.data,forma:null,created_at:`${cp.data}T12:00:00Z`})
  }
})
// contas fixas (a de aluguel e salário já têm baixa; luz e internet pagas; academia vence esta semana)
const contas_fixas=[
 {id:id('f',1),user_id:U,tipo:'entrada',descricao:'Salário',valor:6500,categoria_id:C('Salário'),banco_id:NU,dia:5,inicio:'2026-10-01',fim:null,ativa:true},
 {id:id('f',2),user_id:U,tipo:'saida',descricao:'Aluguel',valor:1800,categoria_id:C('Moradia'),banco_id:NU,dia:5,inicio:'2026-10-01',fim:null,ativa:true},
 {id:id('f',3),user_id:U,tipo:'saida',descricao:'Conta de luz',valor:180,categoria_id:C('Moradia'),banco_id:NU,dia:11,inicio:'2026-10-01',fim:null,ativa:true},
 {id:id('f',4),user_id:U,tipo:'saida',descricao:'Internet',valor:119.9,categoria_id:C('Moradia'),banco_id:NU,dia:9,inicio:'2026-10-01',fim:null,ativa:true},
 {id:id('f',5),user_id:U,tipo:'saida',descricao:'Academia',valor:99.9,categoria_id:C('Saúde'),banco_id:IT,dia:20,inicio:'2026-10-01',fim:null,ativa:true},
 {id:id('f',6),user_id:U,tipo:'saida',descricao:'Plano de saúde',valor:389.5,categoria_id:C('Saúde'),banco_id:IT,dia:25,inicio:'2026-10-01',fim:null,ativa:true},
 {id:id('f',7),user_id:U,tipo:'saida',descricao:'Condomínio',valor:420,categoria_id:C('Moradia'),banco_id:NU,dia:17,inicio:'2026-10-01',fim:null,ativa:true},
 {id:id('f',8),user_id:U,tipo:'entrada',descricao:'Aluguel da garagem',valor:350,categoria_id:C('Renda extra'),banco_id:NU,dia:28,inicio:'2026-10-01',fim:null,ativa:true}]
const baixa=(fid,desc,dia,tipo,valor,cat)=>lanc.push({id:id('l',++seq),user_id:U,ano:ANO,mes:10,tipo,descricao:desc,valor,data:`${ANO}-10-${pad(dia)}`,categoria_id:C(cat),banco_id:NU,conta_fixa_id:fid,forma:'pix',created_at:`${ANO}-10-${pad(dia)}T12:00:00Z`})
// as baixas de outubro substituem os lançamentos soltos equivalentes
const sai=(d)=>{const i=lanc.findIndex(l=>l.mes===10&&l.descricao===d&&!l.cartao_id); if(i>=0) lanc.splice(i,1)}
sai('Aluguel'); sai('Plano de internet'); sai('Conta de luz'); sai('Salário')
baixa(contas_fixas[0].id,'Salário',5,'entrada',6500,'Salário')
baixa(contas_fixas[1].id,'Aluguel',5,'saida',1800,'Moradia')
baixa(contas_fixas[3].id,'Internet',9,'saida',119.9,'Moradia')
baixa(contas_fixas[2].id,'Conta de luz',11,'saida',173.4,'Moradia')
baixa(contas_fixas[6].id,'Condomínio',17,'saida',420,'Moradia')
// dívidas
const dividas=[
 {id:id('d',1),user_id:U,descricao:'Financiamento do carro',valor_parcela:1250,sentido:'devo',pessoa:'Banco Itaú',inicio:'2026-01-10',total_parcelas:48,moeda:null,created_at:'2026-01-01T00:00:00Z'},
 {id:id('d',2),user_id:U,descricao:'Empréstimo pessoal',valor_parcela:480,sentido:'devo',pessoa:'Nubank',inicio:'2026-01-15',total_parcelas:18,moeda:null,created_at:'2026-01-02T00:00:00Z'},
 {id:id('d',3),user_id:U,descricao:'Empréstimo ao Rafa',valor_parcela:300,sentido:'me_devem',pessoa:'Rafael',inicio:'2026-09-20',total_parcelas:6,moeda:null,created_at:'2026-01-03T00:00:00Z'}]
const divida_saldos=[
 {id:id('s',1),user_id:U,divida_id:id('d',1),data:'2026-01-02',saldo:61250},
 {id:id('s',2),user_id:U,divida_id:id('d',2),data:'2026-01-02',saldo:12480},
 {id:id('s',3),user_id:U,divida_id:id('d',3),data:'2026-08-20',saldo:1800}]
// metas
const metas=[
 {id:id('m',1),user_id:U,nome:'Reserva de emergência',icone:'🛟',cor:'#30d158',moeda:'BRL',alvo:24000,prazo:null,ordem:0,created_at:'2026-01-01T00:00:00Z'},
 {id:id('m',2),user_id:U,nome:'Viagem ao Japão',icone:'✈️',cor:'#64d2ff',moeda:'BRL',alvo:18000,prazo:'2027-07-01',ordem:1,created_at:'2026-01-01T00:00:00Z'},
 {id:id('m',3),user_id:U,nome:'Notebook novo',icone:'💻',cor:'#bf5af2',moeda:'BRL',alvo:9000,prazo:'2026-12-01',ordem:2,created_at:'2026-01-01T00:00:00Z'},
 {id:id('m',4),user_id:U,nome:'Entrada do apartamento',icone:'🏠',cor:'#ff9f0a',moeda:'BRL',alvo:60000,prazo:'2028-12-01',ordem:3,created_at:'2026-01-01T00:00:00Z'}]
const mov=[]
const dep=(mi,vals)=>vals.forEach((v,i)=>{ if(v) mov.push({id:id('v',mov.length+1),user_id:U,meta_id:id('m',mi),data:`${ANO}-${pad(i+1)}-${pad(8+mi)}`,valor:v,descricao:''}) })
dep(1,[1500,1500,1800,1500,1700,1500,1800,1600,1500,1400])
dep(2,[500,500,600,500,700,500,550,600,650,700])
dep(3,[700,800,700,900,800,850,700,750,800,800])
dep(4,[1000,1000,1200,1000,1300,1000,1200,1300,1300,1300])
// patrimônio por mês
const meses=[]
for(let m=1;m<=12;m++) meses.push({user_id:U,ano:ANO,mes:m,investimentos:8000+m*820,usd:0,meta_usd:0,moedas:{},
  caixa:{[NU]:{cc:2200+m*140,caixinha:5200+m*610,reserva:3000+m*400},[IT]:{cc:1400+m*60,caixinha:0,reserva:0},[CA]:{cc:180,caixinha:0,reserva:0}}})
const faturas_pagas=[]
// todas as faturas que já venceram aparecem pagas (o valor é a soma das parcelas daquele mês)
cartoes.forEach((c,ci)=>{
  for(let m=1;m<=10;m++){
    const venc=`${ANO}-${pad(m)}-${pad(c.dia_vencimento)}`
    if(venc>'2026-10-18') continue
    const valor=Math.round(lanc.filter(l=>l.cartao_id===c.id&&l.mes===m).reduce((a,l)=>a+l.valor,0)*100)/100
    if(valor>0) faturas_pagas.push({id:id('q',faturas_pagas.length+1),user_id:U,cartao_id:c.id,ano:ANO,mes:m,valor,pago_em:venc,banco_id:c.banco_id,tipo:'paga',juros:0})
  }
})
module.exports={perfil:{nome:'Marina',moeda:'BRL',moedas:[],detalhe:'detalhado',modulos:{dividas:true,contas:true,cartoes:true,bancos:true,investimentos:true,moedas:false,metas:true},dispensadas:['tour','importar','investir','moedas','bancos','cartoes','dividas','metas','contas','parcelas'],onboarding_em:'2026-01-02T00:00:00Z'},
 dados:{categorias,bancos,cartoes,lancamentos:lanc,contas_fixas,dividas,divida_saldos,metas,meta_movimentos:mov,meses,faturas_pagas}}
