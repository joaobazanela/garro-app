/* GARRO — lógica do jogo. Conteúdo estático fica em data/*.json (carregado antes, em window.GD). */
/* Este arquivo é a parte 1 de 8: o jogo foi dividido em js/garro/*.js (carregados em ordem pelo index.html; dividem o mesmo escopo). */
const SPRITES=GD.sprites.SPRITES;
const CH0=20;// first id of the round collectibles (no evolution)
const DATA=GD.pelucias.DATA;
const PLUSH=DATA.map((d,i)=>({i,name:d[0],cm:d[1],g:d[2],tex:d[3],rare:d[4],desc:d[5],...SPRITES[i]}));const NPL=PLUSH.length;const FORA=new Set(GD.pelucias.FORA||[]);PLUSH.forEach(p=>{if(FORA.has(p.i))p.fora=1});
// bolinhas: BOL_N iguais + as pedras da evolução viram o grande evoluído (data/regras.json → EVOLUCAO.bolinhas)
const BOL_N=((GD.regras||{}).EVOLUCAO||{}).bolinhas||10,ehBolinha=i=>i>=CH0&&i<CH0+20&&!(PLUSH[i]||{}).fora;// redondos antigos aposentados (fora da máquina e da coleção)
// lendários (data/lendarios.json): ids depois das 43 pelúcias; não caem na máquina, nascem de ovos
const LEGD=GD.lendarios||{lendarios:[]},LEG0=LEGD.id0||43,LEGS=LEGD.lendarios||[];
const isLeg=i=>i>=LEG0,grande=i=>i<CH0||i>=LEG0;
for(const L of LEGS){const sp=L.sprite||{w:200,h:200,hull:[[.15,.1],[.85,.1],[.95,.9],[.05,.9]],img:'img/lendarios/'+L.slug+'.webp'};
  PLUSH[L.id]={i:L.id,leg:1,slug:L.slug,name:L.nome,cm:L.cm,g:L.g,tex:.9,rare:0,desc:L.desc,...sp};
  GD.pelucias.STAT[L.id]=L.stat;GD.pelucias.ELEM[L.id]=L.elemento}
// épicos (data/lendarios.json → epicos, ids 53 a 56): os mais fortes; usam o visualizador 3D dos lendários
const EPS=LEGD.epicos||[],EPM=LEGD.epico_maquina||{preco:500,segurar:.05},EPIC0=EPS.length?EPS[0].id:999,isEpic=i=>i>=EPIC0&&i<EPIC0+EPS.length;
for(const E of EPS){const sp=Object.assign({w:200,h:200,hull:[[.12,.08],[.88,.08],[.96,.92],[.04,.92]]},E.sprite||{});
  PLUSH[E.id]={i:E.id,leg:1,epic:1,slug:E.slug,name:E.nome,cm:E.cm,g:E.g,tex:.9,rare:0,desc:E.desc,...sp};GD.pelucias.STAT[E.id]=E.stat;GD.pelucias.ELEM[E.id]=E.elemento}
function epicDia(){const d=new Date(Date.now()-3*36e5).toISOString().slice(0,10);return EPS.length?EPS[Math.floor(Date.parse(d+'T00:00:00Z')/864e5)%EPS.length].id:-1}

const {Engine,Bodies,Body,Composite,Constraint,Query,Vertices}=Matter;
const W=360,H=500,FLOOR=470,DIV=96,DIVTOP=290,REST=64,HOME=48,PXCM=3.0;
const cv=document.getElementById('c'),ctx=cv.getContext('2d');
const dpr=Math.min(window.devicePixelRatio||1,3);
cv.width=W*dpr;cv.height=H*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);
const $=id=>document.getElementById(id);

/* ---------- autenticação e sincronização ---------- */
const SUPABASE_URL='https://dscxtivmuqavisgxzohr.supabase.co';
const SUPABASE_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRzY3h0aXZtdXFhdmlzZ3h6b2hyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI0MTU2NTksImV4cCI6MjEwNzk5MTY1OX0.ACAFsFsXp2hjbvysQJ7malmsmuj77NBuByr1t45UH5k';
const sb=supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);

function showAuthState(name){
  ['Default','Loading','Error'].forEach(n=>{$('auth'+n).hidden=n!==name});
}

/* ---------- relatório de erros (vai pro Supabase, nunca pro jogador em texto técnico) ---------- */
// no máximo 25 por visita, e a mesma mensagem só 1 vez por minuto (rede ruim não pode encher a tabela)
const ERRLOG={n:0,vistos:{}};
function logErro(context,err){
  try{
    const message=(err&&err.message)||String(err||'erro desconhecido');
    const stack=(err&&err.stack)||null,k=context+'|'+message,t=Date.now();
    if(ERRLOG.n>=25||(ERRLOG.vistos[k]&&t-ERRLOG.vistos[k]<60000))return;
    ERRLOG.vistos[k]=t;ERRLOG.n++;
    sb.auth.getSession().then(({data:{session:s}})=>sb.from('client_errors').insert({context,message,stack,url:location.href,user_id:s&&s.user?s.user.id:null})).then(()=>{},()=>{});
  }catch(e){}
}
function erroAmigavel(msg){
  banner(msg||'Ops! Algo deu errado.','Tente de novo em instantes');
}
addEventListener('error',e=>{logErro('window.onerror',e.error||e.message)});
addEventListener('unhandledrejection',e=>{logErro('unhandledrejection',e.reason)});

async function syncEstado(action,extra){
  try{
    const {data:{session:s}}=await sb.auth.getSession();
    if(!s)return null;
    const res=await fetch(SUPABASE_URL+'/functions/v1/sync-estado',{
      method:'POST',
      headers:{'Authorization':'Bearer '+s.access_token,'Content-Type':'application/json'},
      body:JSON.stringify(Object.assign({action},extra||{}))
    });
    if(!res.ok){let d='';try{const j=await res.clone().json();d=' '+(j.error||'')+(j.detail?' '+String(j.detail).slice(0,120):'')}catch(e){}logErro('syncEstado:'+action,'HTTP '+res.status+d);return null}
    return res.json();
  }catch(e){logErro('syncEstado:'+action,e);return null}
}

async function carregarEstado(){
  try{const {data:{session:s0}}=await sb.auth.getSession();DEV=!!(s0&&s0.user&&DEV_EMAILS.includes((s0.user.email||'').toLowerCase()))}catch(e){}
  const {data:ps}=await sb.from('player_state').select('coins,wins').single();
  const {data:colRows}=await sb.from('collection').select('plush_id,count');
  ONL=true;bonus=0;saveBonus();// logado: moedas só do servidor
  coins=(ps?ps.coins:15);
  coll={};
  (colRows||[]).forEach(r=>{coll[r.plush_id]=r.count});
  await carregarEstadoExtra();
}
// estado do jogador que vive no Supabase (migração 0006): inventário, XP/cuidado e gigantes.
// Na primeira vez, manda UMA vez o que estava guardado no aparelho (o servidor aplica limites).
async function carregarEstadoExtra(){
  try{
    const {data:st}=await sb.from('player_state').select('imported_local').single();
    if(st&&st.imported_local===false){const d={food:INV.food,stones:INV.st,xp:{},giants:GCOLL,giants_evolved:GEVO,coll:XCOLL};for(const k in CARE)d.xp[k]=CARE[k].xp|0;
      await syncEstado('import_local',{data:d});const {data:c2}=await sb.from('collection').select('plush_id,count');if(c2){coll={};c2.forEach(r=>{coll[r.plush_id]=r.count})}}
    const {data:inv,error:e1}=await sb.from('inventory').select('item,qty');
    if(inv&&!e1){INV.food=0;INV.st=INV.st.map(()=>0);inv.forEach(r=>{if(r.item==='food')INV.food=r.qty;else{const k=+r.item.split('_')[1];if(k>=0&&k<INV.st.length)INV.st[k]=r.qty}});saveInv()}
    const {data:pc,error:e2}=await sb.from('plush_care').select('plush_id,xp,f,l,p,rebirths,stone_pending,evolved,updated_at');
    if(pc&&!e2){CARE={};pc.forEach(r=>{CARE[r.plush_id]={xp:r.xp,f:r.f,l:r.l,p:r.p,rb:r.rebirths|0,sp:r.stone_pending|0,ev:!!r.evolved,t:Date.parse(r.updated_at)||Date.now()}});saveCare()}
    const {data:gs,error:e3}=await sb.from('giants').select('plush_id,count,evolved');
    if(gs&&!e3){GCOLL={};GEVO={};gs.forEach(r=>{if(r.count>0){GCOLL[r.plush_id]=r.count;if(r.evolved)GEVO[r.plush_id]=1}});saveG()}
  }catch(e){console.warn('estado extra',e)}
}

async function entrarComGoogle(){
  showAuthState('Loading');
  const {error}=await sb.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin+location.pathname}});
  if(error)showAuthState('Error');
}

async function iniciarAposLogin(){
  await carregarEstado();
  devTudo();// admin: um de cada
  $('authGate').hidden=true;
  $('gameRoot').hidden=false;
  hud();renderShelf();
}


/* ---------- sprites: bake a soft contact shadow once ---------- */
function bakeP(p){
  const s=p.cm*PXCM/Math.max(p.w,p.h);p.dw=p.w*s;p.dh=p.h*s;
  const img=new Image();img.src=p.img;p.image=img;
  img.onload=()=>{const pad=10,c=document.createElement('canvas');c.width=Math.ceil((p.dw+pad*2)*dpr);c.height=Math.ceil((p.dh+pad*2)*dpr);
    const x=c.getContext('2d');x.scale(dpr,dpr);x.shadowColor='rgba(0,0,0,.55)';x.shadowBlur=8;x.shadowOffsetY=4;x.drawImage(img,pad,pad,p.dw,p.dh);p.baked=c;p.pad=pad};
  const verts=Vertices.hull(p.hull.map(([u,v])=>({x:(u-.5)*p.dw,y:(v-.5)*p.dh})));
  p.verts=verts;const c=Vertices.centre(verts);p.cx=c.x;p.cy=c.y;
}
PLUSH.forEach(bakeP);
/* ---------- pedras raras ---------- */
const STONESPR=GD.sprites_pedras.STONESPR;
const STONES=GD.pelucias.STONES.map((d,k)=>({i:100+k,stone:k,name:d[0],cm:12,g:70,tex:.9,rare:1,desc:d[1],...STONESPR[k]}));
STONES.forEach(bakeP);
// máquina de ovos: muitos ovos comuns (branco com pintinhas, nunca são lendários) e o ovo do lendário do dia no meio.
// Os ovos são lisos: o comum escorrega às vezes; o lendário só fica firme quando o servidor sorteou "firme" no começo da jogada.
const EGGS=LEGS.map((L,k)=>{const o=L.ovo||{w:160,h:256,hull:[[.5,0],[1,.5],[.5,1],[0,.5]]};
  return{i:200+k,egg:k,name:'Ovo de '+L.nome,cm:21,g:200,tex:1,rare:1,desc:'',w:o.w,h:o.h,hull:o.hull,img:'img/lendarios/ovo_'+L.slug+'.webp'}});
EGGS.forEach(bakeP);
// máquina do épico: o OVO do épico do dia (data/lendarios.json → epicos[].ovo); vai para o Ninho e choca como o dos lendários
const EPEGGS=EPS.map((E,k)=>{const o=E.ovo||{w:160,h:256,hull:[[.5,0],[1,.5],[.5,1],[0,.5]]};
  return{i:220+k,epic:1,epicEgg:1,ei:E.id,name:'Ovo de '+E.nome,cm:EPM.ovo_cm||46,g:1500,tex:1,rare:1,desc:'',w:o.w,h:o.h,hull:o.hull,img:o.img||'img/lendarios/ovo_'+E.slug+'.webp'}});
EPEGGS.forEach(bakeP);
// máquina comum (data/regras.json → MAQUINA): só redondos, chance de virar grande, força da garra; travas das outras máquinas
const MQR=Object.assign({so_redondos:true,transformar_chance:.05,garra:{min:380,var:400,derrotas_ajuda:8},gigante:{min:500,var:450,derrotas_ajuda:5}},GD.regras.MAQUINA||{});
const MQ=LEGD.maquina||{},OC=MQ.ovo_comum||{w:156,h:211,hull:[[.5,0],[1,.5],[.5,1],[0,.5]],img:'img/lendarios/ovo_comum.webp'};
const EGG_C={i:210,egg:-1,comum:1,name:OC.nome||'Ovo comum',cm:14,g:150,tex:1,desc:'',w:OC.w,h:OC.h,hull:OC.hull,img:OC.img};bakeP(EGG_C);
function legDia(){if(window.GARRO_LEND)return GARRO_LEND.legDoDia();const d=new Date(Date.now()-3*36e5).toISOString().slice(0,10);return Math.floor(Date.parse(d+'T00:00:00Z')/864e5)%(LEGS.length||10)}
let INV={food:3,st:[0,0,0,0,0,0,0,0]};try{const o=JSON.parse(localStorage.getItem('garro-inv')||'');if(o&&typeof o==='object')INV=Object.assign(INV,o)}catch(e){}
while(INV.st.length<STONES.length)INV.st.push(0);
function saveInv(){try{localStorage.setItem('garro-inv',JSON.stringify(INV))}catch(e){}}
const STONE_OF=i=>{const e=ELEM[i];return ['embers','lava'].includes(e)?0:['cloud','electric','ice','water','sand'].includes(e)?1:['earth','stone'].includes(e)?2:['leaves','flowers'].includes(e)?3:e==='swamp'?4:e==='shadow'?7:['stars','petals','gold'].includes(e)?6:5};

