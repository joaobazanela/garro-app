/* GARRO — lógica do jogo. Conteúdo estático fica em data/*.json (carregado antes, em window.GD). */
(function(){
const SPRITES=GD.sprites.SPRITES;
const CH0=20;// first id of the round collectibles (no evolution)
const DATA=GD.pelucias.DATA;
const PLUSH=DATA.map((d,i)=>({i,name:d[0],cm:d[1],g:d[2],tex:d[3],rare:d[4],desc:d[5],...SPRITES[i]}));const NPL=PLUSH.length;

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
function logErro(context,err){
  try{
    const message=(err&&err.message)||String(err||'erro desconhecido');
    const stack=(err&&err.stack)||null;
    sb.from('client_errors').insert({context,message,stack,url:location.href}).then(()=>{},()=>{});
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
    if(!res.ok){logErro('syncEstado:'+action,'HTTP '+res.status);return null}
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
    const {data:pc,error:e2}=await sb.from('plush_care').select('plush_id,xp,f,l,p,updated_at');
    if(pc&&!e2){CARE={};pc.forEach(r=>{CARE[r.plush_id]={xp:r.xp,f:r.f,l:r.l,p:r.p,t:Date.parse(r.updated_at)||Date.now()}});saveCare()}
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
  $('authGate').hidden=true;
  $('gameRoot').hidden=false;
  hud();renderShelf();
}

sb.auth.onAuthStateChange((event,s)=>{
  if(s)iniciarAposLogin();
});

$('btnGoogleLogin').addEventListener('click',entrarComGoogle);
$('btnRetryLogin').addEventListener('click',()=>showAuthState('Default'));

(async()=>{
  const {data:{session:s}}=await sb.auth.getSession();
  if(s)await iniciarAposLogin();
})();

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
let INV={food:3,st:[0,0,0,0,0,0,0,0]};try{const o=JSON.parse(localStorage.getItem('garro-inv')||'');if(o&&typeof o==='object')INV=Object.assign(INV,o)}catch(e){}
while(INV.st.length<STONES.length)INV.st.push(0);
function saveInv(){try{localStorage.setItem('garro-inv',JSON.stringify(INV))}catch(e){}}
const STONE_OF=i=>{const e=ELEM[i];return ['embers','lava'].includes(e)?0:['cloud','electric','ice','water','sand'].includes(e)?1:['earth','stone'].includes(e)?2:['leaves','flowers'].includes(e)?3:e==='swamp'?4:e==='shadow'?7:['stars','petals','gold'].includes(e)?6:5};

/* ---------- physics world ---------- */
const engine=Engine.create();engine.gravity.y=1;engine.positionIterations=8;engine.velocityIterations=6;
const world=engine.world;
const CAT_PLUSH=1,CAT_WALL=2,CAT_PRONG=4,CAT_GUARD=8;
const wallOpts={isStatic:true,friction:.9,collisionFilter:{category:CAT_WALL}};
const walls=[
  Bodies.rectangle(DIV+(W-DIV)/2,FLOOR+20,W-DIV,40,wallOpts),
  Bodies.rectangle(-20,H/2-200,40,H+400,wallOpts),
  Bodies.rectangle(W+20,H/2-200,40,H+400,wallOpts),
  Bodies.rectangle(DIV,(DIVTOP+FLOOR)/2+10,6,FLOOR-DIVTOP+20,{...wallOpts,chamfer:{radius:3}})
];
Composite.add(world,walls);
const prongL=Bodies.rectangle(0,0,7,40,{isStatic:true,isSensor:true,collisionFilter:{category:CAT_PRONG}});
const prongR=Bodies.rectangle(0,0,7,40,{isStatic:true,isSensor:true,collisionFilter:{category:CAT_PRONG}});
Composite.add(world,[prongL,prongR]);
// parede invisível em cima da divisória: só o bicho que está na garra passa por ela
const guard=Bodies.rectangle(DIV,(80+DIVTOP)/2,8,DIVTOP-80,{isStatic:true,friction:.2,collisionFilter:{category:CAT_GUARD}});Composite.add(world,guard);

let bodies=[];
function addPlush(p,x,y){
  const b=Bodies.fromVertices(x,y,[p.verts.map(v=>({x:v.x,y:v.y}))],{friction:.85,frictionStatic:1.2,frictionAir:.012,restitution:.04,
    collisionFilter:{category:CAT_PLUSH,mask:CAT_PLUSH|CAT_WALL|CAT_PRONG|CAT_GUARD}},true);
  Body.setMass(b,p.g/100);Body.setAngle(b,(Math.random()-.5)*.6);
  b.plush=p;bodies.push(b);Composite.add(world,b);return b;
}
const PILE=16;
function pickPlush(cnt){
  const round=Math.random()<.86;let pool=PLUSH.filter(p=>(p.i>=CH0)===round&&(cnt[p.i]||0)<(round?3:1));if(!pool.length)pool=PLUSH.filter(p=>(cnt[p.i]||0)<1);if(!pool.length)pool=PLUSH;
  let t=0;pool.forEach(p=>t+=p.rare);let r=Math.random()*t;for(const p of pool){r-=p.rare;if(r<0)return p}return pool[0];
}
function fill(n,fromY){
  const cnt={};bodies.forEach(b=>cnt[b.plush.i]=(cnt[b.plush.i]||0)+1);
  for(let k=0;k<n;k++){let p=pickPlush(cnt);if(!bodies.some(b=>b.plush.stone!==undefined)&&!cnt.stone&&Math.random()<.012){p=STONES[Math.floor(Math.random()*STONES.length)];cnt.stone=1}cnt[p.i]=(cnt[p.i]||0)+1;addPlush(p,DIV+60+Math.random()*(W-DIV-110),fromY-k*70)}
}
function settlePile(){fill(PILE,FLOOR-60);for(let i=0;i<500;i++)Engine.update(engine,1000/60);
  for(let i=bodies.length-1;i>=0;i--)if(bodies[i].position.x<DIV){Composite.remove(world,bodies[i]);bodies.splice(i,1)}}
settlePile();
// novos bichos caem devagar: 1 a cada 4 jogadas quando a pilha baixa; só repõe 3 de uma vez se estiver quase vazia
let sinceDrop=0;
function restock(){if(MACH===2){if(!bodies.length)placeGiant();return}sinceDrop++;if(bodies.length<6){fill(Math.min(3,PILE-bodies.length),-60);sinceDrop=0}else if(bodies.length<13&&sinceDrop>=4){fill(1,-60);sinceDrop=0}}
const SWAP_COST=10;
/* ---------- segunda máquina: um bichinho gigante ---------- */
let MACH=1;const GCOST=50,GK=2.4;
let FX=[],DECOR=[];
function puff(x,y,n,cols,up){for(let k=0;k<n;k++)FX.push({x:x+(Math.random()-.5)*60,y,vx:(Math.random()-.5)*(up?5:3.4),vy:-(up?2+Math.random()*4:Math.random()*1.6),r:up?3+Math.random()*3:5+Math.random()*9,life:0,max:50+Math.random()*40,col:cols[k%cols.length],g:up?.12:-.01})}
function shakeWin(px){const w=document.querySelector('.window');if(w&&w.animate)w.animate([{transform:'translate(0,0)'},{transform:`translate(${px}px,${px*.6}px)`},{transform:`translate(${-px}px,${-px*.4}px)`},{transform:`translate(${px*.6}px,${px*.3}px)`},{transform:`translate(${-px*.3}px,0)`},{transform:'translate(0,0)'}],{duration:480})}
function boom(){tone(46,.7,'sine',.4);tone(64,.45,'triangle',.22);setTimeout(()=>tone(38,.5,'sine',.25),90)}
function drawFX(){for(let i=FX.length-1;i>=0;i--){const f=FX[i];f.life++;f.x+=f.vx;f.y+=f.vy;f.vy+=f.g;f.vx*=.97;const a=1-f.life/f.max;if(a<=0){FX.splice(i,1);continue}
  ctx.globalAlpha=a*(f.g<0?.5:.95);ctx.fillStyle=f.col;ctx.beginPath();ctx.arc(f.x,f.y,f.r*(f.g<0?1+f.life/f.max:1),0,7);ctx.fill()}ctx.globalAlpha=1}
function drawGiantDecor(){
  for(const d of DECOR){const p=PLUSH[d.i];if(!p.baked)continue;ctx.drawImage(p.baked,d.x-p.dw/2-p.pad,FLOOR-p.dh-p.pad+4,p.dw+p.pad*2,p.dh+p.pad*2)}
  // régua no vidro
  const x0=W-12;ctx.strokeStyle='rgba(255,230,160,.55)';ctx.fillStyle='rgba(255,230,160,.75)';ctx.lineWidth=1;ctx.font='700 8px Nunito, sans-serif';ctx.textAlign='right';
  ctx.beginPath();ctx.moveTo(x0,FLOOR);ctx.lineTo(x0,FLOOR-100*PXCM);ctx.stroke();
  for(let cm=0;cm<=100;cm+=5){const y=FLOOR-cm*PXCM,big=cm%20===0;ctx.beginPath();ctx.moveTo(x0,y);ctx.lineTo(x0-(big?8:4),y);ctx.stroke();if(big&&cm)ctx.fillText(cm+' cm',x0-10,y+3)}}
const backG=layer(x=>{let g=x.createLinearGradient(0,0,0,H);g.addColorStop(0,'rgba(30,26,70,.62)');g.addColorStop(1,'rgba(10,8,30,.7)');x.fillStyle=g;x.fillRect(0,0,W,H);
  x.globalAlpha=.07;x.strokeStyle='#ffd27a';for(let i=-H;i<W+H;i+=34){x.beginPath();x.moveTo(i,0);x.lineTo(i+H,H);x.stroke()}x.globalAlpha=1;
  g=x.createRadialGradient(W*.62,0,10,W*.62,0,H*.9);g.addColorStop(0,'rgba(255,214,120,.34)');g.addColorStop(1,'rgba(255,214,120,0)');x.fillStyle=g;x.fillRect(0,0,W,H)});
function giantOf(i){const p=PLUSH[i],G=Object.create(p);G.giant=1;G.dw=p.dw*GK;G.dh=p.dh*GK;G.cx=p.cx*GK;G.cy=p.cy*GK;G.cm=Math.round(p.cm*GK);G.g=760+Math.round(Math.random()*100);G.tex=Math.max(.85,p.tex);
  G.verts=p.verts.map(v=>({x:v.x*GK,y:v.y*GK}));G.name=p.name;
  // desenha de novo no tamanho grande, direto da imagem original (esticar a pequena deixava borrado)
  if(p.image&&p.image.complete&&p.image.naturalWidth){const pad=16,c=document.createElement('canvas');c.width=Math.ceil((G.dw+pad*2)*dpr);c.height=Math.ceil((G.dh+pad*2)*dpr);const x=c.getContext('2d');x.scale(dpr,dpr);x.imageSmoothingQuality='high';x.shadowColor='rgba(0,0,0,.55)';x.shadowBlur=14;x.shadowOffsetY=7;x.drawImage(p.image,pad,pad,G.dw,G.dh);G.baked=c;G.pad=pad}
  else Object.defineProperty(G,'pad',{get:()=>(p.pad||10)*GK});return G}
function placeGiant(){const i=Math.floor(Math.random()*CH0),G=giantOf(i);G.landed=false;const gb=addPlush(G,(DIV+W)/2+12+(Math.random()-.5)*30,-G.dh*.6);Body.setAngle(gb,0);gb.frictionAir=.02;
  const rs=[];while(rs.length<3){const r=CH0+Math.floor(Math.random()*(NPL-CH0));if(!rs.includes(r))rs.push(r)}DECOR=[{i:rs[0],x:DIV+24},{i:rs[1],x:W-58},{i:rs[2],x:W-28}];
  $('who').innerHTML='Gigante da vez: <b>'+G.name+'</b> <em>· '+G.cm+' cm</em>'}
function setMachine(m){if(m===MACH)return;if(claw.state!=='ready'){banner('Espere a garra voltar');return}
  MACH=m;const k=(m===2?1.7:1)/CS;CS=m===2?1.7:1;Body.scale(prongL,k,k);Body.scale(prongR,k,k);
  for(const b of bodies)Composite.remove(world,b);bodies.length=0;if(m===2)placeGiant();else{settlePile();$('who').textContent='Mire bem no centro da pelúcia. As pesadas escorregam fácil.'}
  $('gsign').hidden=m!==2;$('mach1').classList.toggle('on',m===1);$('mach2').classList.toggle('on',m===2);document.querySelector('.window').classList.toggle('giant',m===2);
  $('hint').textContent=m===2?'Máquina gigante: '+GCOST+' moedas por jogada':'Toque nas setas para colocar uma moeda';audio();click(m===2?300:600);hud()}

function swapMachine(){if(claw.state!=='ready'){banner('Espere a garra voltar');return}
  if(!canPay(SWAP_COST)){banner('Moedas insuficientes','Trocar custa '+SWAP_COST+' 🪙');return}
  pay(SWAP_COST,'swap');for(const b of bodies)Composite.remove(world,b);bodies.length=0;if(MACH===2)placeGiant();else settlePile();sinceDrop=0;
  audio();[523,659,784].forEach((f,k)=>setTimeout(()=>tone(f,.12,'triangle',.09),k*90));banner('Bichinhos trocados!',DEV?'grátis (dev)':'-'+SWAP_COST+' 🪙',true);hud()}

/* ---------- claw ---------- */
let CS=1;// escala da garra (1 = normal, maior na máquina gigante)
const claw={x:HOME,y:REST,open:1,oL:1,oR:1,oB:1,lb:null,rb:null,bsnag:false,target:null,snag:false,state:'ready',t:0,held:null,link:null,force:0,hold:0,slipAt:-1,moving:0,hits:0};
function setProngs(){
  for(const [b,s] of [[prongL,-1],[prongR,1]]){
    const a=-.2+(s<0?claw.oL:claw.oR)*.82,th=-s*a,px=claw.x+s*9*CS,py=claw.y+6*CS;
    Body.setPosition(b,{x:px-Math.sin(th)*20*CS,y:py+Math.cos(th)*20*CS});Body.setAngle(b,th);
  }
  const solid=claw.state==='down';prongL.isSensor=prongR.isSensor=!solid;
}

function tip(s,o){const a=-.2+o*.82,th=-s*a,lx=-s*8*CS,ly=41*CS;return{x:claw.x+s*9*CS+lx*Math.cos(th)-ly*Math.sin(th),y:claw.y+6*CS+lx*Math.sin(th)+ly*Math.cos(th)}}
function beginClose(){
  const c=claw;c.lb=c.rb=null;c.snag=false;c.target=null;
  for(let oy=0;oy<=60&&!c.target;oy+=4){const h=Query.point(bodies,{x:c.x,y:c.y+(12+oy)*CS});if(h.length)c.target=h[0]}
  if(!c.target)for(const s of[-1,1]){const h=Query.point(bodies,tip(s,s<0?c.oL:c.oR));if(h.length){c.target=h[0];break}}
  let n=0;for(const b of bodies)if(b!==c.target&&Math.abs(b.position.x-c.x)<60&&b.bounds.min.y<c.y+50)n++;
  c.bsnag=Math.random()<Math.min(.5,n*.12);
}
/* ---------- static art, pre-rendered ---------- */
function layer(fn){const c=document.createElement('canvas');c.width=W*dpr;c.height=H*dpr;const x=c.getContext('2d');x.scale(dpr,dpr);fn(x);return c}
const back=layer(x=>{
  let g=x.createLinearGradient(0,0,0,H);g.addColorStop(0,'#2b1830');g.addColorStop(.55,'#3d2036');g.addColorStop(1,'#1a0d16');x.fillStyle=g;x.fillRect(0,0,W,H);
  // quilted back panel
  x.globalAlpha=.08;x.strokeStyle='#ffd0e4';x.lineWidth=1;
  for(let i=-H;i<W+H;i+=26){x.beginPath();x.moveTo(i,0);x.lineTo(i+H,H);x.stroke();x.beginPath();x.moveTo(i,H);x.lineTo(i+H,0);x.stroke()}
  x.globalAlpha=1;
  // warm top light
  g=x.createRadialGradient(W/2,10,10,W/2,10,H*.9);g.addColorStop(0,'rgba(255,214,170,.32)');g.addColorStop(1,'rgba(255,214,170,0)');x.fillStyle=g;x.fillRect(0,0,W,H);
  // floor
  g=x.createLinearGradient(0,FLOOR,0,H);g.addColorStop(0,'#5a2a40');g.addColorStop(1,'#2a1220');x.fillStyle=g;x.fillRect(DIV,FLOOR,W-DIV,H-FLOOR);
  // chute
  x.fillStyle='#050304';x.fillRect(0,FLOOR,DIV,H-FLOOR);
  g=x.createLinearGradient(0,DIVTOP,0,FLOOR);g.addColorStop(0,'rgba(255,191,60,0)');g.addColorStop(1,'rgba(255,191,60,.16)');x.fillStyle=g;x.fillRect(0,DIVTOP,DIV,FLOOR-DIVTOP);
  x.fillStyle='#ffbf3c';x.font='900 11px Nunito, sans-serif';x.textAlign='center';x.fillText('▼ PRÊMIO ▼',DIV/2,FLOOR+20);
});
const front=layer(x=>{
  // chute glass + divider
  x.fillStyle='rgba(200,230,255,.07)';x.fillRect(0,DIVTOP,DIV,FLOOR-DIVTOP);
  let g=x.createLinearGradient(DIV-3,0,DIV+3,0);g.addColorStop(0,'rgba(255,255,255,.15)');g.addColorStop(.5,'rgba(255,255,255,.55)');g.addColorStop(1,'rgba(255,255,255,.1)');
  x.fillStyle=g;x.fillRect(DIV-3,DIVTOP,6,FLOOR-DIVTOP);x.fillStyle='#ffbf3c';x.fillRect(DIV-4,DIVTOP-2,8,3);
  // glass reflections
  g=x.createLinearGradient(0,0,W,H);g.addColorStop(0,'rgba(255,255,255,.10)');g.addColorStop(.35,'rgba(255,255,255,0)');g.addColorStop(.6,'rgba(255,255,255,0)');g.addColorStop(.62,'rgba(255,255,255,.07)');g.addColorStop(.7,'rgba(255,255,255,0)');
  x.fillStyle=g;x.fillRect(0,0,W,H);
  x.fillStyle='rgba(255,255,255,.06)';x.beginPath();x.moveTo(W-70,30);x.lineTo(W-52,30);x.lineTo(W-140,H);x.lineTo(W-158,H);x.fill();
  // vignette
  g=x.createRadialGradient(W/2,H*.45,H*.3,W/2,H*.5,H*.8);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,.55)');x.fillStyle=g;x.fillRect(0,0,W,H);
});
const rail=layer(x=>{
  let g=x.createLinearGradient(0,0,0,24);g.addColorStop(0,'#2a2a30');g.addColorStop(.5,'#8d8a94');g.addColorStop(1,'#3a3840');x.fillStyle=g;x.fillRect(0,0,W,24);
  for(let i=8;i<W;i+=16){x.fillStyle='rgba(255,236,200,.9)';x.beginPath();x.arc(i,4,1.6,0,7);x.fill()}
});

function metal(x,x0,x1){const g=ctx.createLinearGradient(x0,0,x1,0);g.addColorStop(0,'#4a4750');g.addColorStop(.28,'#e9e7ee');g.addColorStop(.42,'#ffffff');g.addColorStop(.62,'#9c99a3');g.addColorStop(1,'#3e3b44');return g}
// uma garra: braço curvo que abre para fora e fecha em gancho, com junta parafusada e ponta de borracha
function prongPath(s,k){const p=[[-3.2,0],[3.2,0],[s*5+3.6*s,21],[-s*1.5+2.4*s,36],[-s*8,42.5],[-s*9.5,39.5],[-s*3.5-2*s,34.5],[s*5-3*s,22]];
  ctx.beginPath();ctx.moveTo(-3.4,0);ctx.lineTo(3.4,0);ctx.quadraticCurveTo(s*9.5,12,s*7.4,22);ctx.quadraticCurveTo(s*4.2,33,-s*2,38.5);ctx.quadraticCurveTo(-s*6,41.5,-s*9.2,41.8);ctx.lineTo(-s*9.6,38.6);
  ctx.quadraticCurveTo(-s*5,37,-s*2.8,34.2);ctx.quadraticCurveTo(s*1.4,29,s*2.4,22);ctx.quadraticCurveTo(s*3.6,10,-3.4,0);ctx.closePath()}
function drawProng(s,depth){
  const a=-.2+(s<0?claw.oL:claw.oR)*.82;
  ctx.save();ctx.translate(claw.x+s*9*CS,claw.y+6*CS);ctx.scale(CS,CS);ctx.rotate(-s*a);
  if(depth){ctx.fillStyle='#4a4650';prongPath(s);ctx.fill();ctx.restore();return}
  ctx.shadowColor='rgba(0,0,0,.45)';ctx.shadowBlur=4;ctx.shadowOffsetY=2;
  ctx.fillStyle='#242128';prongPath(s);ctx.fill();ctx.shadowColor='transparent';
  ctx.save();ctx.scale(.84,.94);ctx.translate(s*.6,.6);const g=ctx.createLinearGradient(-6,0,8,0);g.addColorStop(0,'#5d5a63');g.addColorStop(.4,'#f6f5f9');g.addColorStop(.7,'#a9a6b0');g.addColorStop(1,'#56535c');
  ctx.fillStyle=g;prongPath(s);ctx.fill();ctx.restore();
  // ponta de borracha
  ctx.fillStyle='#1c1a1f';ctx.beginPath();ctx.ellipse(-s*8.6,40.4,3.1,2.3,s*.4,0,7);ctx.fill();
  // junta do meio
  ctx.fillStyle='#2b2830';ctx.beginPath();ctx.arc(s*5.6,22,2.6,0,7);ctx.fill();ctx.fillStyle='#d9d6de';ctx.beginPath();ctx.arc(s*5.6,22,1.3,0,7);ctx.fill();
  // pino de cima
  ctx.fillStyle='#2b2830';ctx.beginPath();ctx.arc(0,0,3.6,0,7);ctx.fill();ctx.fillStyle='#e9e7ee';ctx.beginPath();ctx.arc(0,0,1.8,0,7);ctx.fill();
  ctx.restore();
}
function drawClaw(){
  const {x,y}=claw,k=CS;
  // carrinho no trilho de cima
  let g=ctx.createLinearGradient(0,4,0,24);g.addColorStop(0,'#f0eef4');g.addColorStop(.5,'#8e8b95');g.addColorStop(1,'#3a3740');
  ctx.fillStyle=g;if(ctx.roundRect){ctx.beginPath();ctx.roundRect(x-24,5,48,16,4);ctx.fill()}else ctx.fillRect(x-24,5,48,16);
  ctx.fillStyle='#ff7a1a';ctx.fillRect(x-24,15,48,3);
  for(const wx of[-15,15]){ctx.fillStyle='#1d1b20';ctx.beginPath();ctx.arc(x+wx,6,4,0,7);ctx.fill();ctx.fillStyle='#b9b6bf';ctx.beginPath();ctx.arc(x+wx,6,1.6,0,7);ctx.fill()}
  ctx.fillStyle='#2a272e';ctx.fillRect(x-4,20,8,4);
  // cabo de aço trançado
  const top=24,bot=y-24*k,hv=claw.held&&claw.held.plush.giant,jt=hv?Math.sin(performance.now()/38)*1.6:0;ctx.strokeStyle='#1b181d';ctx.lineWidth=hv?3.6:3;ctx.beginPath();ctx.moveTo(x,top);ctx.quadraticCurveTo(x+jt,(top+bot)/2,x,bot);ctx.stroke();
  ctx.strokeStyle='rgba(220,220,230,.55)';ctx.lineWidth=1;ctx.beginPath();for(let yy=top;yy<bot;yy+=4){ctx.moveTo(x-1.4,yy);ctx.lineTo(x+1.4,yy+2.6)}ctx.stroke();
  // garra de trás (perspectiva)
  const L=24+(1-claw.oB)*16;ctx.save();ctx.translate(x,y+4*k);ctx.scale(k,k);ctx.fillStyle='#3a3640';ctx.beginPath();ctx.moveTo(-2.6,0);ctx.lineTo(2.6,0);ctx.lineTo(2,L*.82);ctx.quadraticCurveTo(1,L,-1.2,L);ctx.lineTo(-2.2,L*.82);ctx.closePath();ctx.fill();ctx.fillStyle='#1c1a1f';ctx.beginPath();ctx.ellipse(0,L-1,2.2,1.6,0,0,7);ctx.fill();ctx.restore();
  drawProng(-1);drawProng(1);
  // motor: cilindro cromado com faixa laranja e tampa
  ctx.save();ctx.translate(x,y);ctx.scale(k,k);
  ctx.fillStyle='#2a272e';ctx.beginPath();ctx.ellipse(0,-24,9,3.4,0,0,7);ctx.fill();
  ctx.fillStyle=metal(0,-16,16);if(ctx.roundRect){ctx.beginPath();ctx.roundRect(-16,-23,32,20,[6,6,3,3]);ctx.fill()}else ctx.fillRect(-16,-23,32,20);
  const ob=ctx.createLinearGradient(-16,0,16,0);ob.addColorStop(0,'#a8410a');ob.addColorStop(.35,'#ffb23a');ob.addColorStop(.7,'#ff7a1a');ob.addColorStop(1,'#8a3408');
  ctx.fillStyle=ob;ctx.fillRect(-16,-15,32,5);
  ctx.fillStyle='rgba(255,255,255,.55)';ctx.fillRect(-9,-21,3,16);
  // aro de baixo com os pinos
  ctx.fillStyle='#232026';if(ctx.roundRect){ctx.beginPath();ctx.roundRect(-14,-4,28,9,3);ctx.fill()}else ctx.fillRect(-14,-4,28,9);
  ctx.fillStyle='#77737d';ctx.fillRect(-14,-4,28,2);
  for(const sx of[-9,0,9]){ctx.fillStyle='#cfccd4';ctx.beginPath();ctx.arc(sx,1,1.4,0,7);ctx.fill()}
  ctx.fillStyle=claw.state==='move'?'#ff4f8b':'#5fd39b';ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=6;ctx.beginPath();ctx.arc(10,-19,2.2,0,7);ctx.fill();
  ctx.restore();
}
function drawPlush(b){
  const p=b.plush,img=p.baked;
  ctx.save();ctx.translate(b.position.x,b.position.y);ctx.rotate(b.angle);
  if(img)ctx.drawImage(img,-p.cx-p.dw/2-p.pad,-p.cy-p.dh/2-p.pad,p.dw+p.pad*2,p.dh+p.pad*2);
  else if(p.image.complete)ctx.drawImage(p.image,-p.cx-p.dw/2,-p.cy-p.dh/2,p.dw,p.dh);
  ctx.restore();
}

/* ---------- game state ---------- */
let coins=15,dir=0,roundTime=0,losses=0,roundWin=false;
const ROUND=25*60;
let coll={};try{coll=JSON.parse(localStorage.getItem('garra-real')||'{}')||{}}catch(e){coll={}}
const totalWins=()=>Object.values(coll).reduce((a,b)=>a+b,0);
// coleção também guardada no aparelho (junta com a do servidor pelo maior valor) e moedas ganhas na venda
const XKEY='garro-coll';let XCOLL={};try{XCOLL=JSON.parse(localStorage.getItem(XKEY)||'{}')||{}}catch(e){XCOLL={}}
function saveX(){try{localStorage.setItem(XKEY,JSON.stringify(coll));localStorage.setItem('garra-real',JSON.stringify(coll))}catch(e){}}
let bonus=0;try{bonus=+localStorage.getItem('garro-bonus')||0}catch(e){}
let GCOLL={};try{GCOLL=JSON.parse(localStorage.getItem('garro-giant')||'{}')||{}}catch(e){}
function saveG(){try{localStorage.setItem('garro-giant',JSON.stringify(GCOLL));localStorage.setItem('garro-gevo',JSON.stringify(GEVO))}catch(e){}}
let GEVO={};try{GEVO=JSON.parse(localStorage.getItem('garro-gevo')||'{}')||{}}catch(e){}
const GEVO_STONES=5;
// moedas infinitas só para quem desenvolve (conta Google). Na versão sem login: tocar 7x no contador de moedas liga/desliga.
const DEV_EMAILS=GD.regras.DEV_EMAILS;let DEV=false;
// cópia de teste dos devs (artefato): já abre com moedas infinitas; 7 toques no contador desligam
try{const g=localStorage.getItem('garro-dev');if(window.GARRO_OFFLINE&&(g==='1'||(window.GARRO_DEVDEFAULT&&g!=='0')))DEV=true}catch(e){if(window.GARRO_DEVDEFAULT)DEV=true}
const canPay=n=>DEV||coins>=n;
let ONL=false;// true quando logado (estado vem do Supabase)
function spend(n){if(DEV)return;coins-=n;bonus-=n;saveBonus()}
// pagar algo: logado -> o servidor desconta (e devolve o saldo certo); sem login -> guarda no aparelho
function pay(n,action){if(DEV)return;if(!ONL){spend(n);return}coins-=n;hud();syncEstado(action).then(r=>{if(r&&typeof r.coins==='number'){coins=r.coins;hud()}})}
function srv(action,extra,ok){if(!ONL||DEV)return;syncEstado(action,extra).then(r=>{if(r&&!r.error&&ok)ok(r)})}
function saveBonus(){try{localStorage.setItem('garro-bonus',String(bonus))}catch(e){}}

let bannerT=0;
function banner(t,sub,win){const b=$('banner');b.innerHTML=t+(sub?'<small>'+sub+'</small>':'');b.className='banner show'+(win?' win':'');clearTimeout(bannerT);bannerT=setTimeout(()=>b.className='banner',2200)}
function hud(){
  $('coins').textContent=DEV?'∞':coins;$('wins').textContent=totalWins();
  $('time').textContent=claw.state==='move'?Math.ceil(roundTime/60):'--';
  $('drop').disabled=claw.state!=='move';
}
function showGrab(p,force,closed){
  if(!p){$('who').innerHTML=closed&&closed.plush?'Pegou só a pontinha de '+closed.plush.name+'.':'A garra fechou no vazio.';$('mForce').style.width=Math.round(force/12)+'%';$('mWeight').style.width='0';return}
  $('who').innerHTML=p.name+' <em>· '+p.cm+' cm · '+p.g+' g'+(closed!==undefined?' · '+closed+'/3 pontas':'')+'</em>';
  $('mForce').style.width=Math.min(100,force/12)+'%';$('mWeight').style.width=Math.min(100,p.g/12)+'%';
}

function start(){
  if(claw.state!=='ready')return false;
  if(MACH===2){if(!canPay(GCOST)){$('hint').textContent='A máquina gigante custa '+GCOST+' moedas por jogada.';banner('Moedas insuficientes','Gigante: '+GCOST+' 🪙 por jogada');return false}
    claw.state='move';roundTime=ROUND;roundWin=false;pay(GCOST,'giant_round_start');evento('giant_play');claw.force=losses>=3?1250+Math.random()*150:700+Math.random()*600;
    $('hint').textContent='Mire no meio do gigante e aperte PEGAR';click(500);hud();return true}
  if(!DEV&&coins<=0){$('hint').textContent='Sem moedas. Toque em +1 moeda abaixo.';banner('Sem moedas');return false}
  claw.state='move';roundTime=ROUND;roundWin=false;
  if(!DEV){const useBonus=bonus>0&&coins-bonus<=0;coins--;
    if(useBonus){bonus--;saveBonus()}else syncEstado('round_start').then(r=>{if(r)coins=r.coins+bonus;else{coins++;erroAmigavel('Não deu pra confirmar a jogada — a próxima pode não valer')}});}
  // real machines vary the claw voltage each play; after a losing streak they pay out
  claw.force=losses>=6?1150+Math.random()*150:520+Math.random()*560;
  $('hint').textContent='Posicione e aperte PEGAR';click(500);hud();return true;
}
function drop(){if(claw.state!=='move')return;claw.state='down';claw.press=0;dir=0;hum(true);$('bar').style.width='0';hud()}

function attach(b,hits,mult,closed){mult=mult||1;
  const p=b.plush,dx=Math.abs(b.position.x-claw.x),half=p.dw/2;
  const centered=1-Math.min(1,dx/(half*.9));
  let grip=claw.force*p.tex*(.3+.45*centered+.25*Math.min(1,hits/18))*mult;
  if(p.giant)grip*=1.45;// garra grande da máquina gigante aperta mais
  claw.hold=grip;claw.held=b;
  const gp={x:claw.x,y:claw.y+30*CS};
  claw.link=Constraint.create({pointA:{x:gp.x,y:gp.y},bodyB:b,pointB:{x:gp.x-b.position.x,y:gp.y-b.position.y},length:0,stiffness:.12,damping:.08});
  Composite.add(world,claw.link);
  b.collisionFilter.mask=p.giant?0:CAT_PLUSH|CAT_WALL;b.frictionAir=.03;// gigante na garra atravessa vidro e divisória
  claw.slipAt=grip<p.g?claw.y-10-Math.random()*40:-1;
  showGrab(p,grip,closed);
}
function release(reason){
  const b=claw.held;if(!b)return;
  Composite.remove(world,claw.link);claw.link=null;claw.held=null;b.frictionAir=.012;
  // gigante levado até a porta do prêmio: conta como pego e cai pela portinhola (é largo demais para o buraco)
  if(b.plush.giant){if(!reason&&(claw.state==='release'||claw.x<DIV)){b.plush.won=1;b.collisionFilter.mask=0;Body.setPosition(b,{x:Math.min(b.position.x,DIV*.5),y:b.position.y});Body.setVelocity(b,{x:0,y:2});return}
    b.collisionFilter.mask=CAT_PLUSH|CAT_WALL|CAT_PRONG|CAT_GUARD}
  setTimeout(()=>{b.collisionFilter.mask=CAT_PLUSH|CAT_WALL|CAT_PRONG|CAT_GUARD},900);
  if(reason==='slip'){banner(claw.snag?'Enroscou!':'Escorregou!',b.plush.name);thud()}
  if(reason==='heavy'){banner('Pesado demais!',b.plush.name+' · '+b.plush.g+' g');thud()}
}
function stress(){return claw.held?claw.held.plush.g/claw.hold:0}

// avisos para as missões (js/missoes.js): capture, feed, pet, play, battle_win, stone, giant_play, giant_capture, giant_evolve
function evento(kind,n){try{window.dispatchEvent(new CustomEvent('garro:evento',{detail:{kind,n:n||1}}))}catch(e){}}
function won(b){
  const p=b.plush;if(p.stone!==undefined){INV.st[p.stone]++;saveInv();roundWin=true;losses=0;banner(p.name+'!','Pedra rara! Use no bicho do mesmo elemento',true);fanfare();hud();return}
  if(p.giant){evento('capture');evento('giant_capture');coll[p.i]=(coll[p.i]||0)+1;saveX();GCOLL[p.i]=(GCOLL[p.i]||0)+1;saveG();shakeWin(10);boom();for(let k=0;k<3;k++)setTimeout(()=>puff(40+Math.random()*60,FLOOR-40,26,['#ffd23c','#ff5a8a','#5ad1ff','#8aff6a','#ffffff'],true),k*300);const c0=careOf(p.i);c0.xp+=60;saveCare();srv('giant_capture',{plushId:p.i},r=>{coll[p.i]=r.count;GCOLL[p.i]=r.giants;careOf(p.i).xp=r.xp;saveX();saveG();saveCare();renderShelf()});
    roundWin=true;losses=0;banner('🏆 GIGANTE! '+p.name,'+60 XP · selo de gigante na coleção',true);fanfare();setTimeout(fanfare,700);renderShelf(p.i);hud();return}
  evento('capture');coll[p.i]=(coll[p.i]||0)+1;saveX();const dup=coll[p.i]>1,evo=p.i<CH0;if(dup){const c0=careOf(p.i);c0.xp+=evo?20:5;saveCare()}
  syncEstado('capture',{plushId:p.i});
  roundWin=true;losses=0;banner(p.name+'!',dup?(evo?'Repetida! +20 XP pra evoluir':'Repetida! 2 iguais = 1 moeda'):p.rare<=2?'Pelúcia rara!':'Caiu no prêmio',true);fanfare();renderShelf(p.i);hud();
}

function step(){
  const c=claw;
  if(c.state==='move'){
    if(dir){const nx=Math.max(22,Math.min(W-22,c.x+dir*1.9));c.x=nx}
    hum(!!dir);roundTime--;$('bar').style.width=(roundTime/ROUND*100)+'%';
    if(roundTime%60===0)hud();
    if(roundTime<=0)drop();
  }else if(c.state==='down'){
    c.y+=2.2;
    const pts=[-12,-6,0,6,12].map(o=>({x:c.x+o*CS,y:c.y+6*CS})).concat([tip(-1,c.oL),tip(1,c.oR),{x:c.x,y:c.y+28*CS}]);
    // like a real claw it keeps pushing into the soft pile a little before closing, so the prongs sink around the plush
    let floor=c.y>=FLOOR-44*CS,center=Query.point(bodies,{x:c.x,y:c.y+34*CS}).length>0,side=false;for(const pt of pts)if(pt.y>=FLOOR)floor=true;else if(Query.point(bodies,pt).length)side=true;
    if(side||center)c.press=(c.press||0)+(center?3.2:2.2);
    if(floor||c.press>(center?14:22)){c.state='close';c.t=0;c.press=0;hum(false);click(220);beginClose()}
  }else if(c.state==='close'){
    c.t++;
    for(const s of[-1,1]){const k=s<0?'oL':'oR',bk=s<0?'lb':'rb';if(c[bk])continue;
      const nv=Math.max(0,c[k]-.022),hit=Query.point(bodies.concat(walls.slice(1)),tip(s,nv)).find(b=>b!==c.target);
      if(hit&&c.t>2)c[bk]=hit;else c[k]=nv}
    c.oB=Math.max(c.bsnag?.55:0,c.oB-.022);c.open=Math.min(c.oL,c.oR);
    if(c.t>50&&(c.oL<=0||c.lb)&&(c.oR<=0||c.rb)){
      const closed=(c.lb?0:1)+(c.rb?0:1)+(c.bsnag?0:1),t=c.target;c.snag=closed<3;
      let n=0;if(t)for(let ox=-14;ox<=14;ox+=4)for(let oy=10;oy<=46;oy+=6)if(Query.point([t],{x:c.x+ox*CS,y:c.y+oy*CS}).length)n++;
      if(t&&n>=4)attach(t,n,[0,.12,.5,1][closed],closed);
      else{showGrab(null,c.force,t);if(c.snag&&t)banner('Enroscou!','Uma ponta prendeu na vizinha')}
      c.state='up';hum(true);
    }
  }else if(c.state==='up'){
    const heavy=c.held&&c.held.plush.giant;c.y-=heavy?.85:1.5;
    if(c.held){
      if(c.slipAt>0&&c.y<c.slipAt)release(c.held.plush.g>c.hold*1.25?'heavy':'slip');
      else if(Math.random()<Math.max(0,stress()-.6)*.01+(Math.abs(c.held.angularVelocity)>.06?stress()*.012:0))release('slip');
    }
    if(c.y<=REST){c.y=REST;c.state='top';c.t=0;hum(false);
      if(c.held){c.hold*=.82;const s=stress();if(s>1&&Math.random()<.8)release('slip');else if(Math.random()<Math.pow(s,4)*.35)release('slip')}}
  }else if(c.state==='top'){
    if(++c.t>24){c.state='return';hum(true)}
  }else if(c.state==='return'){
    const d=HOME-c.x;c.x+=Math.sign(d)*Math.min(Math.abs(d),c.held&&c.held.plush.giant?1.05:1.8);
    if(c.held&&Math.random()<Math.max(0,stress()-.7)*.008+(Math.abs(c.held.angularVelocity)>.07?stress()*.01:0))release('slip');
    if(Math.abs(d)<.5){c.state='release';c.t=0;hum(false)}
  }else if(c.state==='release'){
    c.t++;if(c.t>10){c.open=Math.min(1,c.open+.04);c.oL=c.oR=c.oB=c.open}
    if(c.t===22&&c.held)release();
    if(c.t>110){
      c.state='ready';if(!roundWin){losses++;if(!$('banner').classList.contains('show'))banner('Não foi dessa vez')}
      $('hint').textContent=(DEV||coins>0)?'Toque nas setas para jogar de novo':'Acabaram as moedas';
      restock();
      hud();
    }
  }
  if(c.link){c.link.pointA.x=c.x;c.link.pointA.y=c.y+30*CS}
  setProngs();
  Engine.update(engine,1000/60);
  for(let i=bodies.length-1;i>=0;i--){const b=bodies[i];
    if(b.position.y>H+60){Composite.remove(world,b);bodies.splice(i,1);if(b.position.x<DIV+20)won(b)}
    else if(b.plush.giant&&b!==claw.held&&(b.plush.won?b.position.y>FLOOR-40:(b.position.x<DIV+30&&b.position.y>230))){Composite.remove(world,b);bodies.splice(i,1);won(b)}
    else if(b.plush.giant&&!b.plush.landed&&b.position.y>FLOOR-b.plush.dh*.5-26&&Math.abs(b.velocity.y)<1.6){b.plush.landed=true;shakeWin(8);boom();puff(b.position.x,FLOOR-6,30,['#8a7a6a','#b8a890','#6a5a4a']);banner('🦖 GIGANTE!',b.plush.name+' · '+b.plush.cm+' cm',true)}
    else if(b.plush.giant&&!b.plush.won&&b.position.x>=DIV+30&&b.position.y>FLOOR+10){Body.setPosition(b,{x:Math.min(W-90,b.position.x),y:FLOOR-130});Body.setVelocity(b,{x:0,y:0})}}
}
function draw(){
  ctx.drawImage(back,0,0,W,H);if(MACH===2){ctx.drawImage(backG,0,0,W,H);drawGiantDecor()}
  for(const b of bodies)if(b!==claw.held)drawPlush(b);
  if(claw.held)drawPlush(claw.held);
  ctx.drawImage(front,0,0,W,H);
  ctx.drawImage(rail,0,0,W,H);
  drawClaw();drawFX();
}
let last=performance.now(),acc=0;
function loop(now){acc+=Math.min(80,now-last);last=now;let n=0;while(acc>=16.67&&n<4){step();acc-=16.67;n++}draw();requestAnimationFrame(loop)}
setProngs();requestAnimationFrame(loop);

/* ---------- sound ---------- */
let ac=null,motor=null;
function audio(){if(!ac){try{ac=new(window.AudioContext||window.webkitAudioContext)()}catch(e){}}if(ac&&ac.state==='suspended')ac.resume()}
function tone(f,d,type,vol){if(!ac)return;try{const o=ac.createOscillator(),g=ac.createGain();o.type=type||'sine';o.frequency.value=f;
  g.gain.setValueAtTime(vol||.1,ac.currentTime);g.gain.exponentialRampToValueAtTime(.0008,ac.currentTime+d);o.connect(g).connect(ac.destination);o.start();o.stop(ac.currentTime+d)}catch(e){}}
function click(f){tone(f,.06,'square',.06)}
function thud(){tone(90,.25,'sine',.25);tone(60,.3,'triangle',.15)}
function fanfare(){[523,659,784,1046,1318].forEach((f,i)=>setTimeout(()=>tone(f,.25,'triangle',.12),i*95))}
function hum(on){if(!ac)return;try{
  if(on&&!motor){const o=ac.createOscillator(),g=ac.createGain(),f=ac.createBiquadFilter();o.type='sawtooth';o.frequency.value=(claw.held&&claw.held.plush.giant)?40:58;f.type='lowpass';f.frequency.value=320;
    g.gain.value=.035;o.connect(f).connect(g).connect(ac.destination);o.start();motor={o,g}}
  else if(!on&&motor){motor.g.gain.setTargetAtTime(0,ac.currentTime,.03);const m=motor;setTimeout(()=>m.o.stop(),150);motor=null}}catch(e){}}

/* ---------- input ---------- */
function hold(el,v){
  const on=e=>{e.preventDefault();audio();if(claw.state==='ready')start();if(claw.state==='move'){dir=v;el.classList.add('on')}};
  const off=()=>{if(dir===v)dir=0;el.classList.remove('on')};
  el.addEventListener('pointerdown',on);['pointerup','pointerleave','pointercancel'].forEach(t=>el.addEventListener(t,off));
}
hold($('left'),-1);hold($('right'),1);
$('drop').addEventListener('pointerdown',e=>{e.preventDefault();audio();drop()});
addEventListener('keydown',e=>{
  if(e.repeat)return;
  if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();audio();if(claw.state==='ready')start();if(claw.state==='move')dir=e.key==='ArrowLeft'?-1:1}
  if(e.key===' '||e.key==='ArrowDown'){e.preventDefault();audio();if(claw.state==='ready')start();else drop()}
});
addEventListener('keyup',e=>{if(e.key==='ArrowLeft'&&dir<0||e.key==='ArrowRight'&&dir>0)dir=0});
$('refill').addEventListener('click',()=>{
  syncEstado('refill').then(r=>{if(r){coins=r.coins+bonus;hud()}else erroAmigavel('Ainda não deu pra repor — espere um pouco e tente de novo')});
  $('hint').textContent='Toque nas setas para jogar'
});

async function abrirRanking(){
  const {data,error}=await sb.from('ranking').select('*').order('wins',{ascending:false}).limit(50);
  const ol=$('rankingList');
  ol.innerHTML='';
  if(error){
    ol.innerHTML='<li>Não foi possível carregar o ranking agora.</li>';
    $('rankingPanel').hidden=false;
    return;
  }
  (data||[]).forEach(r=>{
    const li=document.createElement('li');
    li.textContent=(r.display_name||'Jogador')+' — '+r.wins+' vitórias · '+r.total_plush+' pelúcias';
    ol.appendChild(li);
  });
  $('rankingPanel').hidden=false;
}
$('btnRanking').addEventListener('click',abrirRanking);
$('rankingClose').addEventListener('click',()=>{$('rankingPanel').hidden=true});

/* ---------- collection ---------- */
function detail(i){
  const p=PLUSH[i],n=coll[i]||0,d=$('detail');d.hidden=false;
  d.innerHTML=n?'<img src="'+p.img+'" alt=""><div><h3>'+p.name+'</h3><p>'+p.desc+'</p><div class="stats">'+p.cm+' cm · '+p.g+' g · pego '+n+'x</div></div>'
    :'<img src="'+p.img+'" alt="" style="filter:brightness(0) opacity(.35)"><div><h3>???</h3><p>Ainda não capturado.</p><div class="stats">'+p.cm+' cm · '+p.g+' g</div></div>';
}
function renderShelf(focus){
  const g=$('grid');g.innerHTML='';let got=0;
  PLUSH.forEach(p=>{const n=coll[p.i]||0;if(n)got++;
    const s=document.createElement('button');s.className='slot'+(n?'':' lock');s.setAttribute('aria-label',n?p.name:'Pelúcia não capturada');
    const stg=n&&p.i<CH0?careStage(p.i):0;if(stg)s.className+=' was';s.innerHTML=(GCOLL[p.i]?'<i class="gbadge">🏆'+(GCOLL[p.i]>1?GCOLL[p.i]:'')+'</i>':'')+'<img src="'+p.img+'" alt=""><span>'+(n?evName(p.i,0):'???')+'</span>'+(n>1?'<b>×'+n+'</b>':'')+(n?'<u>'+(stg?'evoluiu ↓':'NV '+lvOf(p.i))+'</u>':'');
    s.addEventListener('click',()=>{if(n){$('detail').hidden=true;openViewer(p.i)}else detail(p.i)});g.appendChild(s)});
  // evoluídos: cada um ganha um lugar novo, separado da forma de antes
  const evs=PLUSH.filter(p=>p.i<CH0&&(coll[p.i]||0)>0&&careStage(p.i)===1);
  if(evs.length){const h=document.createElement('div');h.className='gsec';h.textContent='★ Evoluídos ('+evs.length+')';g.appendChild(h);
    evs.forEach(p=>{const s=document.createElement('button');s.className='slot evo';s.setAttribute('aria-label',evName(p.i,1));
      s.innerHTML=(GCOLL[p.i]?'<i class="gbadge">🏆'+(GEVO[p.i]?'★':'')+'</i>':'')+'<img src="'+(EVOSPR[p.i]?EVOSPR[p.i].img:p.img)+'" alt=""><span>'+evName(p.i,1)+'</span><u>★ NV '+lvOf(p.i)+'</u>';
      s.addEventListener('click',()=>{$('detail').hidden=true;openViewer(p.i)});g.appendChild(s)})}
  $('count').textContent=got+' de '+NPL;
  if(focus!==undefined)detail(focus);
}
/* ---------- 3D creatures with dog-like reactions ---------- */
// b body, c belly, a accent, e eye, size [halfWidth, halfHeight, halfLength], h head radius, sn snout, ea ears, lg leg length, tl tail, x extras
const SPEC=GD.modelos.SPEC;
const V={open:false};
let FUR=null;const MATS=GD.modelos.MATS;let SPH=null;
function furTex(){if(FUR)return FUR;const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');x.fillStyle='#ececec';x.fillRect(0,0,256,256);
  for(let i=0;i<7000;i++){const g=175+Math.random()*80|0;x.strokeStyle='rgba('+g+','+g+','+g+',.6)';const px=Math.random()*256,py=Math.random()*256,a=Math.random()*6.28,l=2+Math.random()*5;x.beginPath();x.moveTo(px,py);x.lineTo(px+Math.cos(a)*l,py+Math.sin(a)*l);x.stroke()}
  FUR=new THREE.CanvasTexture(c);FUR.wrapS=FUR.wrapT=THREE.RepeatWrapping;FUR.repeat.set(2.5,2.5);return FUR}
function M(col,o){o=o||{};const k=col+'|'+JSON.stringify(o);if(MATS[k])return MATS[k];
  const smooth=o.gloss||o.flat||o.glass||o.glow;
  const m=new THREE.MeshStandardMaterial({color:new THREE.Color(col).convertSRGBToLinear(),roughness:o.gloss?.12:o.glass?.2:1,metalness:o.metal||0,
    flatShading:!!o.flat,
    transparent:!!o.op,opacity:o.op||1,side:o.side?THREE.DoubleSide:THREE.FrontSide,depthWrite:!o.op});
  if(o.glow){m.emissive=new THREE.Color(col).convertSRGBToLinear();m.emissiveIntensity=o.glow}
  m.userData.fur=!smooth&&!o.op;
  if(!smooth&&!o.side)plushify(m);
  return MATS[k]=m}
const SHELLS=GD.modelos.SHELLS;const NSHELL=12;const FURTIME={value:0};
// strand fur: stacked shells; each strand lives in a 3D cell, thins toward the tip, droops and sways
function furMat(base,l,len,dens){const key=base.uuid+'|'+l+'|'+len+'|'+dens;if(SHELLS[key])return SHELLS[key];
  const t=l/NSHELL,m=new THREE.MeshStandardMaterial({color:base.color.clone(),vertexColors:!!base.vertexColors,map:base.map,roughness:1,metalness:0});
  m.onBeforeCompile=sh=>{sh.uniforms.uTime=FURTIME;
    sh.vertexShader='uniform float uTime;\nattribute float furK;\nvarying vec3 vFurP;\n'+sh.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\n vFurP=position;\n float fl='+t.toFixed(3)+';\n transformed+=normalize(objectNormal)*fl*furK*'+len.toFixed(4)+';\n transformed.y-=fl*fl*'+(len*.4).toFixed(4)+';\n transformed.x+=sin(uTime*1.6+position.y*7.+position.z*5.)*fl*fl*'+(len*.15).toFixed(4)+';');
    sh.fragmentShader='varying vec3 vFurP;\n'+sh.fragmentShader.replace('#include <map_fragment>',
      '#include <map_fragment>\n {vec3 q=vFurP*'+dens.toFixed(1)+';vec3 c=floor(q);vec3 f=fract(q)-.5;\n  float h=fract(sin(dot(c,vec3(12.9898,78.233,37.719)))*43758.5453);\n  if(h<'+(t*.92).toFixed(3)+'||length(f)>'+(.62-t*.42).toFixed(3)+')discard;\n  float h2=fract(sin(dot(c,vec3(39.346,11.135,83.155)))*24634.6345);\n  diffuseColor.rgb*='+(0.7+t*.42).toFixed(3)+'*vec3(1.07,1.,.9)*(1.+step(.84,h2)*'+(t*.35).toFixed(3)+');}')};
  m.customProgramCacheKey=()=>'fur'+l+'_'+len+'_'+dens+(base.map?'m':'')+(base.vertexColors?'v':'');
  return SHELLS[key]=m}
const noRay=()=>{};
function addFur(root,sp,C){const len0=(sp&&sp.fl)||.05,dens0=(sp&&sp.fd)||48,list=[],head=C&&C.head,legs=(C&&C.legs)||[],tail=C&&C.tail,bs=(sp&&sp.s)||[.5,.5,.8];
  root.traverse(o=>{if(o.isMesh&&(o.material===SDFMAT||o.material.userData.photo)&&!o.userData.shell)list.push(o)});
  for(const m of list){if(!m.userData.skinDark){m.material=m.material.clone();m.material.color.multiplyScalar(.8);m.material.userData=Object.assign({},m.material.userData,{photo:true});m.userData.skinDark=1}
    let cat='body';for(let u=m;u;u=u.parent){if(u===head){cat='head';break}if(u===tail){cat='tail';break}if(legs.includes(u)){cat='leg';break}}
    const len=len0,dens=cat==='head'?dens0*1.7:dens0,pa=m.geometry.attributes.position,K=new Float32Array(pa.count);
    for(let k=0;k<pa.count;k++){const y=pa.getY(k),z=pa.getZ(k);
      K[k]=cat==='head'?.3:cat==='tail'?1.45:cat==='leg'?(.45+.5*Math.min(1,Math.max(0,(y+.05)/.25))+.85*Math.exp(-(((y+(sp.lg||.4)*.72)/.07)**2))):(.8+.75*Math.min(1,Math.max(0,z/(bs[2]*.75)))*Math.min(1,Math.max(0,(bs[1]*.7-y)/bs[1])))}
    m.geometry.setAttribute('furK',new THREE.BufferAttribute(K,1));
    for(let l=1;l<=NSHELL;l++){const s=new THREE.Mesh(m.geometry,furMat(m.material,l,len,dens));s.userData.shell=1;s.raycast=noRay;m.add(s)}}}
function ell(col,sx,sy,sz,o){const m=new THREE.Mesh(SPH,M(col,o));m.scale.set(sx,sy,sz);return m}
function cone(col,r,h,o,seg){const g=new THREE.ConeGeometry(r,h,seg||14);g.translate(0,h/2,0);return new THREE.Mesh(g,M(col,o))}
function cyl(col,r0,r1,h,o){const g=new THREE.CylinderGeometry(r0,r1,h,12);g.translate(0,-h/2,0);return new THREE.Mesh(g,M(col,o))}
function P(o,x,y,z){o.position.set(x,y,z);return o}
function R(o,x,y,z){o.rotation.set(x||0,y||0,z||0);return o}
function grp(){return new THREE.Group()}
function wingShape(w,h,bat){const s=new THREE.Shape();s.moveTo(0,0);
  if(bat){s.quadraticCurveTo(w*.4,h*.9,w,h);s.lineTo(w*.85,h*.35);s.quadraticCurveTo(w*.7,h*.5,w*.62,h*.18);s.quadraticCurveTo(w*.45,h*.35,w*.38,h*.05);s.quadraticCurveTo(w*.2,h*.2,0,0)}
  else{s.bezierCurveTo(w*.3,h*1.1,w*1.05,h*1.05,w,h*.45);s.bezierCurveTo(w*.95,h*.05,w*.4,-h*.1,0,0)}
  return new THREE.ShapeGeometry(s,16)}

/* ---------- sculpted surfaces: smooth-union of ellipsoids meshed with surface nets ---------- */
const SDFCACHE={};let SDFMAT=null;
function sdfMat(){if(SDFMAT)return SDFMAT;SDFMAT=plushify(new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:1}));SDFMAT.userData.fur=true;return SDFMAT}
// real plush surface: fur / scale detail taken from the Sylvorn and Terranox models, triplanar so it has no seams
const DETU=GD.modelos.DETU,DETT={};
const SCALY=GD.modelos.SCALY;
function detTex(kind){if(DETT[kind])return DETT[kind];const f='models/tex/'+kind+'.jpg',src=GLBDATA[f]?'data:image/jpeg;base64,'+GLBDATA[f]:f;
  const t=new THREE.TextureLoader().load(src);t.wrapS=t.wrapT=THREE.RepeatWrapping;return DETT[kind]=t}
function setDet(i){const sc=SCALY.includes(i);DETU.uDet.value=detTex(sc?'scale':'fur');DETU.uDS.value=i>=20?2.6:sc?.9:1.15;DETU.uStr.value=i>=20?.2:sc?1.2:1.3}
function plushify(m){m.map=null;m.bumpMap=null;
  m.onBeforeCompile=sh=>{Object.assign(sh.uniforms,DETU);
    sh.vertexShader='varying vec3 vTP;\nvarying vec3 vON;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n vTP=position*vec3(length(modelMatrix[0].xyz),length(modelMatrix[1].xyz),length(modelMatrix[2].xyz));vON=normalize(normal);');
    sh.fragmentShader='uniform sampler2D uDet;uniform float uDS,uStr;\nvarying vec3 vTP;\nvarying vec3 vON;\n'+sh.fragmentShader
      .replace('#include <color_fragment>','#include <color_fragment>\n float gDet=.5;{vec3 bw=pow(abs(vON),vec3(4.));bw/=bw.x+bw.y+bw.z;vec3 p=vTP*uDS;gDet=texture2D(uDet,p.yz).r*bw.x+texture2D(uDet,p.xz+.37).r*bw.y+texture2D(uDet,p.xy+.71).r*bw.z;\n diffuseColor.rgb*=clamp(1.+(gDet*2.-1.)*uStr,.72,1.35);}')
      .replace('#include <normal_fragment_begin>','#include <normal_fragment_begin>\n {vec2 dh=vec2(dFdx(gDet),dFdy(gDet))*uStr*.3;vec3 sx=dFdx(-vViewPosition),sy=dFdy(-vViewPosition);vec3 r1=cross(sy,normal),r2=cross(normal,sx);float fd=dot(sx,r1);normal=normalize(abs(fd)*normal-sign(fd)*(dh.x*r1+dh.y*r2));}')};
  m.customProgramCacheKey=()=>'pl'+(m.vertexColors?'v':'');return m}
function vh(x,y,z){let h=(x*374761393+y*668265263+z*1274126177)|0;h=(h^(h>>>13))*1274126177|0;return((h^(h>>>16))>>>0)/4294967295}
function vnoise(x,y,z){const X=Math.floor(x),Y=Math.floor(y),Z=Math.floor(z),fx=x-X,fy=y-Y,fz=z-Z,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy),w=fz*fz*(3-2*fz);
  const L=(a,b,t)=>a+(b-a)*t;return L(L(L(vh(X,Y,Z),vh(X+1,Y,Z),u),L(vh(X,Y+1,Z),vh(X+1,Y+1,Z),u),v),L(L(vh(X,Y,Z+1),vh(X+1,Y,Z+1),u),L(vh(X,Y+1,Z+1),vh(X+1,Y+1,Z+1),u),v),w)}
function sdfMesh(prims,k,step,noise){
  step=step||.035;const key=JSON.stringify(prims)+k+step+'|'+(noise||0);let geo=SDFCACHE[key];
  if(!geo){
    const P=prims.map(p=>({c:p.c,r:p.r,rx:p.rx||0,w:p.w||1,paint:!!p.paint,col:new THREE.Color(p.col).convertSRGBToLinear(),cos:Math.cos(-(p.rx||0)),sin:Math.sin(-(p.rx||0)),mr:Math.min(...p.r)}));
    const mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];
    for(const p of P.filter(q=>!q.paint))for(let a=0;a<3;a++){const e=(p.rx?Math.max(...p.r):p.r[a])+k*2.5;mn[a]=Math.min(mn[a],p.c[a]-e);mx[a]=Math.max(mx[a],p.c[a]+e)}
    const nx=Math.ceil((mx[0]-mn[0])/step)+2,ny=Math.ceil((mx[1]-mn[1])/step)+2,nz=Math.ceil((mx[2]-mn[2])/step)+2;
    const pd=(p,x,y,z)=>{let dx=x-p.c[0],dy=y-p.c[1],dz=z-p.c[2];if(p.rx){const ty=dy*p.cos-dz*p.sin,tz=dy*p.sin+dz*p.cos;dy=ty;dz=tz}
      const ax=dx/p.r[0],ay=dy/p.r[1],az=dz/p.r[2],k0=Math.sqrt(ax*ax+ay*ay+az*az),bx=ax/p.r[0],by=ay/p.r[1],bz=az/p.r[2],k1=Math.sqrt(bx*bx+by*by+bz*bz)||1e-6;return k0*(k0-1)/k1};
    const SH=P.filter(p=>!p.paint),NA=noise||0;const field=(x,y,z)=>{let s=0;for(const p of SH){const d=pd(p,x,y,z);if(d<k*12)s+=Math.exp(-d/k)}return (s>0?-k*Math.log(s):k*12)+(NA?NA*(vnoise(x*9,y*9,z*9)*.7+vnoise(x*23,y*23,z*23)*.3-.5):0)};
    const F=new Float32Array(nx*ny*nz),id=(i,j,l)=>i+nx*(j+ny*l);
    for(let l=0;l<nz;l++)for(let j=0;j<ny;j++)for(let i=0;i<nx;i++)F[id(i,j,l)]=field(mn[0]+i*step,mn[1]+j*step,mn[2]+l*step);
    const cell=new Int32Array(nx*ny*nz).fill(-1),pos=[];
    const v=new Float32Array(8);const E=[[0,1],[2,3],[4,5],[6,7],[0,2],[1,3],[4,6],[5,7],[0,4],[1,5],[2,6],[3,7]],O=[[0,0,0],[1,0,0],[0,1,0],[1,1,0],[0,0,1],[1,0,1],[0,1,1],[1,1,1]];
    for(let l=0;l<nz-1;l++)for(let j=0;j<ny-1;j++)for(let i=0;i<nx-1;i++){
      const b0=id(i,j,l),dyy=nx,dzz=nx*ny;
      v[0]=F[b0];v[1]=F[b0+1];v[2]=F[b0+dyy];v[3]=F[b0+dyy+1];v[4]=F[b0+dzz];v[5]=F[b0+dzz+1];v[6]=F[b0+dzz+dyy];v[7]=F[b0+dzz+dyy+1];
      let neg=0;for(let q=0;q<8;q++)if(v[q]<0)neg++;if(!neg||neg===8)continue;
      let sx=0,sy=0,sz=0,n=0;for(const [a,b] of E){if((v[a]<0)===(v[b]<0))continue;const t=v[a]/(v[a]-v[b]);
        sx+=O[a][0]+(O[b][0]-O[a][0])*t;sy+=O[a][1]+(O[b][1]-O[a][1])*t;sz+=O[a][2]+(O[b][2]-O[a][2])*t;n++}
      cell[id(i,j,l)]=pos.length/3;pos.push(mn[0]+(i+sx/n)*step,mn[1]+(j+sy/n)*step,mn[2]+(l+sz/n)*step)}
    const idx=[];
    const quad=(a,b,c,d,flip)=>{if(a<0||b<0||c<0||d<0)return;if(flip)idx.push(a,c,b,a,d,c);else idx.push(a,b,c,a,c,d)};
    for(let l=1;l<nz-1;l++)for(let j=1;j<ny-1;j++)for(let i=0;i<nx-1;i++){const f0=F[id(i,j,l)],f1=F[id(i+1,j,l)];if((f0<0)===(f1<0))continue;
      quad(cell[id(i,j-1,l-1)],cell[id(i,j,l-1)],cell[id(i,j,l)],cell[id(i,j-1,l)],f0>0)}
    for(let l=1;l<nz-1;l++)for(let j=0;j<ny-1;j++)for(let i=1;i<nx-1;i++){const f0=F[id(i,j,l)],f1=F[id(i,j+1,l)];if((f0<0)===(f1<0))continue;
      quad(cell[id(i-1,j,l-1)],cell[id(i-1,j,l)],cell[id(i,j,l)],cell[id(i,j,l-1)],f0>0)}
    for(let l=0;l<nz-1;l++)for(let j=1;j<ny-1;j++)for(let i=1;i<nx-1;i++){const f0=F[id(i,j,l)],f1=F[id(i,j,l+1)];if((f0<0)===(f1<0))continue;
      quad(cell[id(i-1,j-1,l)],cell[id(i,j-1,l)],cell[id(i,j,l)],cell[id(i-1,j,l)],f0>0)}
    const nv=pos.length/3,col=new Float32Array(nv*3),uv=new Float32Array(nv*2);
    let cx=0,cy=0,cz=0;for(let v=0;v<nv;v++){cx+=pos[v*3];cy+=pos[v*3+1];cz+=pos[v*3+2]}cx/=nv;cy/=nv;cz/=nv;
    const kc=k*.55;
    for(let v=0;v<nv;v++){const x=pos[v*3],y=pos[v*3+1],z=pos[v*3+2];let r=0,g=0,b=0,w=0;
      for(const p of P){const ww=Math.exp(-Math.max(0,pd(p,x,y,z))/(p.paint?kc*.35:kc))*p.w;r+=p.col.r*ww;g+=p.col.g*ww;b+=p.col.b*ww;w+=ww}
      col[v*3]=r/w;col[v*3+1]=g/w;col[v*3+2]=b/w;
      const dx=x-cx,dy=y-cy,dz=z-cz,L=Math.hypot(dx,dy,dz)||1;uv[v*2]=Math.atan2(dz,dx)/(2*Math.PI)*3;uv[v*2+1]=Math.acos(dy/L)/Math.PI*2}
    geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('color',new THREE.BufferAttribute(col,3));
    geo.setAttribute('uv',new THREE.BufferAttribute(uv,2));geo.setIndex(nv>65535?new THREE.Uint32BufferAttribute(idx,1):new THREE.Uint16BufferAttribute(idx,1));
    geo.computeVertexNormals();SDFCACHE[key]=geo;
  }
  return new THREE.Mesh(geo,sdfMat());
}

function build(sp){
  if(!SPH)SPH=new THREE.SphereGeometry(1,30,22);
  const [bx,by,bz]=sp.s,hr=sp.h,body=grp(),root=grp(),C={root,body,ears:[],legs:[],eyes:[],lids:[],brows:[],segs:[],wings:[],smoke:[]};
  root.add(body);
  const hc=sp.hc||sp.b;
  // torso
  const nk=sp.nk||0,HY=sp.bird?by*1.05:by*(.75+nk*1.5),HZ=sp.bird?bz*.45:bz*(.88+nk*.02);
  const bp=[{c:[0,0,0],r:[bx,by,bz],col:sp.b},{c:[0,-by*.25,bz*.1],r:[bx*.8,by*.74,bz*.78],col:sp.bc||sp.c}];
  if(sp.tc)bp.push({c:[0,by*.42,-bz*.05],r:[bx*.8,by*.6,bz*.9],col:sp.tc,w:5});
  if(sp.paint)for(const q of sp.paint)bp.push({c:[q[0]*bx,q[1]*by,q[2]*bz],r:[q[3],q[4],q[5]],col:q[6],w:q[7]||8,paint:1});
  if(sp.chest)bp.push({c:[0,HY-hr*1.0,HZ-hr*.1],r:[hr*.72,hr*.95,hr*.5],col:sp.c,w:6},{c:[0,by*.25,bz*.8],r:[bx*.5,by*.45,bz*.18],col:sp.c,w:4});
  else if(sp.x.includes('ruff')||sp.x.includes('maneBig'))bp.push({c:[0,HY-hr*.95,HZ-hr*.15],r:[hr*.82,hr*.95,hr*.62],col:sp.c,w:6},{c:[0,by*.1,bz*.72],r:[bx*.7,by*.7,bz*.32],col:sp.c,w:6});
  if(sp.x.includes('maneBlue'))bp.push({c:[0,HY-hr*.55,HZ-hr*.75],r:[hr*.8,hr*.85,hr*.6],col:sp.a,w:6});
  if(!sp.bird)bp.push({c:[0,(by*.45+HY)/2,(bz*.62+HZ)/2],r:[hr*.62,Math.max(hr*.85,(HY-by*.2)/2+hr*.25),hr*.56],col:sp.b,rx:.45},{c:[0,0,-bz*.52],r:[bx*.9,by*.82,bz*.5],col:sp.b},{c:[0,-by*.1,bz*.56],r:[bx*.62,by*.64,bz*.42],col:sp.c});
  body.add(sdfMesh(bp,.09,.04,sp.fluff||.035));
  // legs
  const lr=.11*Math.max(1,bx/.5)*(sp.lt||1),L=sp.lg,lc=sp.lc||sp.b;
  const hips=sp.bird?[[-bx*.45,-by*.5,-bz*.05],[bx*.45,-by*.5,-bz*.05]]:[[-bx*.6,-by*.42,bz*.58],[bx*.6,-by*.42,bz*.58],[-bx*.6,-by*.42,-bz*.58],[bx*.6,-by*.42,-bz*.58]];
  hips.forEach((h,i)=>{const g=P(grp(),...h);
    if(sp.bird){g.add(cyl(lc,.05,.04,L,{}));for(const a of[-.5,0,.5])g.add(R(P(cone(lc,.035,.18),0,-L,0),Math.PI/2,a,0))}
    else{const tp=sp.face==='doe'?.78:1;const lp=[{c:[0,-lr*.5,0],r:[lr*1.55,lr*2.1,lr*1.7],col:lc},{c:[0,-L*.55,0],r:[lr*1.05*tp,L*.5,lr*1.05*tp],col:lc},{c:[0,-L*.9,lr*.05],r:[lr*.85*tp*.85,lr*.7,lr*.85*tp*.85],col:lc}];
      if(sp.toes){lp.push({c:[0,-L-lr*.1,lr*.25],r:[lr*1.35,lr*.8,lr*1.45],col:lc});for(const tx of[-1,0,1])lp.push({c:[tx*lr*.7,-L-lr*.3,lr*1.35],r:[lr*.52,lr*.48,lr*.55],col:lc})}
      else if(!sp.hoof)lp.push({c:[0,-L-lr*.05,lr*.35],r:[lr*1.2,lr*.75,lr*1.4],col:sp.c===sp.b?lc:sp.c});
      g.add(sdfMesh(lp,lr*.45,.03,(sp.fluff||.035)*.5));
      if(sp.hoof)g.add(P(cyl(sp.hoof,lr*.8,lr*.95,lr*.9,{gloss:1}),0,-L+lr*.25,lr*.05))}
    g.userData.front=i<2&&!sp.bird;body.add(g);C.legs.push(g)});
  C.feet=-by*.42-L-lr*.75;if(sp.bird)C.feet=-by*.5-L;
  // head
  const head=P(grp(),0,HY,HZ);head.userData.part='head';body.add(head);C.head=head;
  const snC=sp.sn==='skull'?hc:(sp.c===sp.b?hc:sp.c);
  const doeEye=(s)=>{const d=new THREE.Vector3(s*.6,.16,.78).normalize(),t=1/Math.sqrt((d.x/.92)**2+(d.y/.88)**2+(d.z/1.18)**2);return{d,p:[d.x*t*hr*.94,d.y*t*hr*.94,hr*.1+d.z*t*hr*.94]}};
  const hp=sp.face==='doe'?[{c:[0,-hr*.04,hr*.1],r:[hr*.9,hr*.8,hr*1.18],col:hc},{c:[0,hr*.3,-hr*.15],r:[hr*.78,hr*.42,hr*.8],col:hc}]:[{c:[0,0,0],r:[hr,hr*.95,hr],col:hc}];
  if(sp.sn!=='beak'&&sp.sn!=='skull')for(const s of[-1,1])hp.push({c:[s*hr*.42,-hr*.3,hr*.38],r:[hr*.42,hr*.36,hr*.42],col:sp.chk?sp.c:hc,w:sp.chk?3:1});
  if(sp.chk)hp.push({c:[0,hr*.55,-hr*.05],r:[hr*.6,hr*.35,hr*.7],col:'#8a6644',w:4,paint:1});
  if(sp.sn==='dog')hp.push({c:[0,-hr*.28,hr*.8],r:[hr*.42,hr*.33,hr*.45],col:snC});
  if(sp.sn==='short')hp.push({c:[0,-hr*.3,hr*.78],r:[hr*.38,hr*.28,hr*.34],col:snC});
  if(sp.sn==='deer')hp.push(sp.face==='doe'?{c:[0,-hr*.33,hr*(sp.snz?1.0:1.12)],r:[hr*.27,hr*.24,hr*(sp.snz||.82)],col:snC}:{c:[0,-hr*.34,hr*.9],r:[hr*.33,hr*.29,hr*.72],col:snC});
  if(sp.face==='doe'){hp.push({c:[0,-hr*.6,hr*.62],r:[hr*.3,hr*.2,hr*.4],col:sp.c});
    hp.push({c:[0,-hr*.1,hr*1.0],r:[hr*.2,hr*.1,hr*.62],col:hc,w:6,paint:1},{c:[0,hr*.35,hr*.35],r:[hr*.4,hr*.3,hr*.4],col:'#7a5a3c',w:5,paint:1});
    for(const s of[-1,1]){const e=doeEye(s).p;hp.push({c:[e[0],e[1]-hr*.04,e[2]],r:[hr*.26,hr*.22,hr*.22],col:sp.c,w:5,paint:1})}}
  if(sp.sn==='flat')hp.push({c:[0,-hr*.32,hr*.62],r:[hr*.36,hr*.25,hr*.3],col:sp.c});
  head.add(sdfMesh(hp,hr*.16,.032,(sp.fluff||.035)*.45));
  if(sp.sn==='dog')head.add(P(ell('#2a1a1e',hr*.13,hr*.09,hr*.09,{gloss:1}),0,-hr*.14,hr*1.22));
  if(sp.sn==='short')head.add(P(ell('#2a1a1e',hr*.09,hr*.06,hr*.06,{gloss:1}),0,-hr*.2,hr*1.1));
  if(sp.sn==='deer'){head.add(P(ell('#1a1012',hr*.19,hr*.12,hr*.12,{gloss:1}),0,-hr*.18,hr*(sp.face==='doe'?(sp.snz?1.0+sp.snz*.95:1.85):1.58)));
    if(sp.face==='doe'){const mo=new THREE.Mesh(new THREE.TorusGeometry(hr*.12,hr*.014,6,16,Math.PI),M('#3a2018',{gloss:1}));mo.rotation.set(-.35,0,Math.PI);const nz=sp.snz?1.0+sp.snz*.95:1.85;P(mo,0,-hr*.42,hr*(nz-.15));head.add(mo);
      head.add(P(ell('#3a2018',hr*.012,hr*.08,hr*.012,{gloss:1}),0,-hr*.32,hr*(nz-.06)))}}
  if(sp.sn==='flat'){head.add(P(ell('#f08aa8',hr*.07,hr*.05,hr*.05,{gloss:1}),0,-hr*.18,hr*.98))}
  if(sp.sn==='skull'){head.add(P(ell('#1a1220',hr*.06,hr*.08,hr*.04),-.04,-hr*.25,hr*.96));head.add(P(ell('#1a1220',hr*.06,hr*.08,hr*.04),.04,-hr*.25,hr*.96))}
  if(sp.sn==='beak'){head.add(R(P(cone('#ffc24a',hr*.24,hr*.6,{gloss:1}),0,-hr*.12,hr*.8),Math.PI/2,0,0))}
  const tg=P(ell('#ff7d9a',hr*.13,hr*.04,hr*.2,{gloss:1}),0,-hr*.5,hr*(sp.sn==='dog'?1.05:.9));tg.userData.base=tg.scale.clone();head.add(tg);C.tongue=tg;
  // eyes: glossy plush eyes with lids and brows
  const er=hr*(sp.sn==='flat'?.24:.2)*(sp.es||1);
  for(const s of[-1,1]){
    const doe=sp.face==='doe',ey=doe?(sp.eyR||.78):1;
    const d=doe?new THREE.Vector3(s*.6,.16,.78).normalize():new THREE.Vector3(s*(sp.bird?.72:.52),.22,sp.bird?.6:.8).normalize();
    const eo=doe?P(grp(),...doeEye(s).p):P(grp(),d.x*hr*.86,d.y*hr*.86,d.z*hr*.86);eo.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),d);head.add(eo);
    const eg=grp();eo.add(eg);if(doe){eg.rotation.z=s*.18;eg.add(ell('#1a0f0a',er*1.12,er*ey*1.1,er*.5,{gloss:1}))}
    eg.add(ell(sp.e,er,er*ey,er*(doe?.6:.8),{gloss:1}));
    eg.add(P(ell('#050305',er*(doe?.4:.45),er*(doe?.52:.45)*ey,er*.3,{gloss:1}),0,0,er*(doe?.45:.62)));
    const hl=new THREE.Mesh(SPH,new THREE.MeshBasicMaterial({color:0xffffff}));hl.scale.setScalar(er*.2);P(hl,er*.35,er*.38*ey,er*(doe?.6:.7));eg.add(hl);
    if(doe){const h2=new THREE.Mesh(SPH,new THREE.MeshBasicMaterial({color:0xffffff}));h2.scale.setScalar(er*.09);P(h2,-er*.3,-er*.3*ey,er*.58);eg.add(h2);
      const wing=ell('#1a0f0a',er*.42,er*.07,er*.08,{gloss:1});P(wing,s*er*1.1,er*.12,er*.05);wing.rotation.z=s*.35;eg.add(wing)}
    const lid=new THREE.Mesh(new THREE.SphereGeometry(er*1.12,20,10,0,Math.PI*2,0,Math.PI/2),M(hc));lid.scale.y=ey;lid.rotation.x=-1.25;eg.add(lid);
    if(sp.x.includes('eyeRim')&&!doe){const rim=new THREE.Mesh(new THREE.TorusGeometry(er*.98,er*.13,8,24),M('#2a1a12',{gloss:1}));rim.position.z=er*.3;eg.add(rim)}C.lids.push(lid);
    const brow=new THREE.Mesh(new THREE.BoxGeometry(er*1.7,er*.32,er*.35),M('#2a1a1e',{gloss:1}));P(brow,0,er*1.2,er*.55);brow.rotation.z=s*.5;brow.visible=false;eg.add(brow);C.brows.push(brow);
  }
  // ears
  const ear=(s)=>{const g=P(grp(),s*hr*.5,hr*.62,-hr*.12);g.rotation.z=-s*.35;head.add(g);C.ears.push(g);return g};
  for(const s of[-1,1]){
    if(sp.ea==='point'){const g=ear(s);g.add(R(cone(sp.b,hr*.28,hr*.62),-.15,0,0));g.add(P(R(cone(sp.c,hr*.16,hr*.42),-.15,0,0),0,.02,.06))}
    if(sp.ea==='long'){const g=ear(s);g.add(R(cone(sp.b,hr*.2,hr*.95),-.3,0,0));g.add(P(R(cone(sp.a,hr*.1,hr*.6),-.3,0,0),0,.04,.05))}
    if(sp.ea==='big'){const g=ear(s);g.rotation.z=-s*.7;g.add(R(cone(sp.b,hr*.36,hr*.85),-.1,0,0));g.add(P(R(cone(sp.a,hr*.22,hr*.6),-.1,0,0),0,.03,.07))}
    if(sp.ea==='zig'){const g=ear(s);g.rotation.z=-s*.6;g.add(R(cone(sp.a,hr*.3,hr*1.05),-.1,0,0));g.add(P(cone('#1a1716',hr*.12,hr*.35),0,hr*.95,-.08))}
    if(sp.ea==='finLong'){const g=ear(s);g.add(P(R(ell(sp.a,.04,hr*.25,hr*.9),.9,0,0),0,hr*.1,-hr*.6));g.add(P(R(ell(sp.b,.035,hr*.2,hr*.7),.6,s*.3,0),0,-hr*.1,-hr*.5))}
    if(sp.ea==='leaf'){const g=ear(s);g.rotation.z=-s*1.1;g.add(R(P(ell('#9ab65a',hr*.22,hr*.55,hr*.06),0,hr*.45,0),-.1,0,0))}
    if(sp.ea==='pointDark'){const g=ear(s);g.add(R(cone(sp.b,hr*.32,hr*.8),-.15,0,0));g.add(P(R(cone('#2a1510',hr*.2,hr*.55),-.15,0,0),0,.03,.07))}
    if(sp.ea==='longPurple'){const g=ear(s);g.add(R(cone(sp.b,hr*.26,hr*1.15),-.25,0,0));g.add(P(R(cone(sp.a,hr*.15,hr*.8),-.25,0,0),0,.04,.06))}
    if(sp.ea==='deerBig'){const g=ear(s);g.scale.setScalar(sp.ear||1);g.position.set(s*hr*.72,hr*.42,-hr*.2);g.rotation.set(-.15,s*.55,-s*1.05);g.add(P(ell(sp.b,hr*.34,hr*.72,hr*.09),0,hr*.62,0));g.add(P(ell('#e2c9a8',hr*.2,hr*.5,hr*.05),0,hr*.6,hr*.07));g.add(P(ell('#5e4430',hr*.06,hr*.1,hr*.05),0,hr*1.28,0))}
    if(sp.ea==='deer'){const g=ear(s);g.rotation.z=-s*1.25;g.add(P(ell(sp.b,hr*.15,hr*.38,hr*.1),0,hr*.3,0));g.add(P(ell(sp.c,hr*.09,hr*.26,hr*.05),0,hr*.3,.04))}
  }
  // tail
  const tail=P(grp(),0,sp.bird?-by*.2:by*.25,-bz*.92);tail.rotation.x=sp.bird?-.2:.55;body.add(tail);C.tail=tail;
  const chain=(n,len,r0,r1,col,o,bend)=>{let parent=tail;for(let i=0;i<n;i++){const g=grp();if(i)P(g,0,0,-len);g.rotation.x=bend||0;
      const r=r0+(r1-r0)*i/Math.max(1,n-1);g.add(P(ell(col,r,r,len*.82,o),0,0,-len/2));parent.add(g);C.segs.push(g);parent=g}return parent};
  let end;
  switch(sp.tl){
    case'thick':end=chain(3,.3,.2,.09,sp.b);if(sp.x.includes('plates'))C.segs.forEach((g,i)=>g.add(P(cone(sp.a,.07,.16),0,.14-i*.03,-.15)));break;
    case'fin':end=chain(3,.28,.12,.06,sp.b);end.add(P(R(ell(sp.a,.03,.3,.36),.3,0,0),0,.05,-.45));break;
    case'flame':end=chain(2,.28,.13,.12,sp.b);for(const [c,r,h,a] of [[sp.b,.22,.55,0],['#ff9a1f',.17,.5,.35],['#ffd23a',.12,.42,-.3]])end.add(R(P(cone(c,r,h),0,0,-.2),-1.2+a*.3,0,a));break;
    case'feather':end=tail;for(let i=-2;i<=2;i++)tail.add(R(P(ell(i%2?sp.a:(sp.bird?'#ffb52a':sp.b),.06,.08,.5),i*.08,0,-.4),-.2,i*.25,0));break;
    case'curl':end=chain(4,.25,.12,.07,sp.b,{},.45);end.add(P(cone(sp.a,.07,.2),0,0,-.25));break;
    case'curlBig':end=chain(5,.28,.17,.14,sp.a,{},.5);end.add(P(R(new THREE.Mesh(new THREE.TorusGeometry(.07,.02,8,16,Math.PI*1.4),M('#f2c84a',{gloss:1,metal:.3})),0,Math.PI/2,0),0,.1,-.2));break;
    case'zig':end=chain(3,.28,.1,.06,sp.a);C.segs.forEach((g,i)=>{g.rotation.y=i%2?.6:-.6;g.children[0].scale.x*=.4;g.children[0].scale.y*=1.5});end.add(R(P(cone('#1a1716',.08,.25),0,0,-.25),-Math.PI/2,0,0));break;
    case'short':end=chain(1,.2,.12,.12,sp.b);break;
    case'finLong':end=chain(5,.26,.13,.05,sp.b,{},-.25);end.add(P(R(ell(sp.a,.03,.16,.22),.3,0,0),0,.03,-.15));tail.rotation.x=-.4;break;
    case'flameBig':end=chain(3,.3,.2,.28,sp.b,{},.35);for(const [c,r,h,a] of [['#ff9a1f',.24,.6,0],['#ffd23a',.17,.5,.4],[sp.b,.19,.55,-.4]])end.add(R(P(cone(c,r,h),0,.05,-.2),-1.3,0,a));tail.rotation.x=.3;break;
    case'zigBig':end=chain(3,.3,.14,.1,sp.a);C.segs.forEach((g,i)=>{g.rotation.y=i%2?.7:-.7;g.children[0].scale.x*=.35;g.children[0].scale.y*=2.2});for(let i=0;i<4;i++)end.add(R(P(cone(i%2?'#1a1716':sp.a,.1,.35),0,.05,-.1*i),-1.2,0,(i-1.5)*.4));break;
    case'deer':end=chain(1,.16,.14,.15,sp.c);tail.rotation.x=.9;break;
    case'bushySdf':{const TL=sp.tlen||1;tail.rotation.x=sp.tang!==undefined?sp.tang:-.75;const tp=[];for(let i=0;i<9;i++){const t=i/8;tp.push({c:[0,Math.sin(t*2.4)*.16*TL,-.1-t*.95*TL],r:[(.11+.1*Math.sin(t*Math.PI))*(sp.tw||1),(.13+.12*Math.sin(t*Math.PI*.9))*(sp.tw||1)*1.15,.18*TL],col:i>=7?sp.c:sp.b,w:i>=7?3:1})}
      tail.add(sdfMesh(tp,.08,.03,(sp.fluff||.035)*1.2));end=tail;break}
    case'bushy':end=chain(4,.26,.19,.27,sp.b,{},.22);tail.rotation.x=-.55;end.add(P(ell(sp.c,.2,.2,.2),0,0,-.28));break;
    case'smoke':end=chain(3,.28,.18,.1,sp.a,{op:.55});break;
    case'long':end=chain(5,.26,.15,.05,sp.b);if(sp.x.includes('spikesP')||sp.x.includes('spikes'))C.segs.forEach((g,i)=>g.add(P(R(cone(sp.x.includes('spikes')?'#2a1a1c':sp.a,.06,.18),-.4,0,0),0,.1-i*.015,-.12)));break;
    case'leaf':end=chain(2,.3,.14,.1,sp.b);end.add(P(R(ell('#9ab65a',.2,.04,.32),0,0,0),0,0,-.25));end.add(P(flower(sp.a,.5),0,.08,-.2));break;
    case'fluffy':end=chain(2,.22,.17,.2,sp.b);break;
    case'fluffyBig':end=chain(3,.3,.2,.28,sp.b);end.add(P(ell(sp.a,.12,.12,.14),0,0,-.25));break;
  }
  C.tailBase=tail.rotation.x;
  C.nB=body.children.length;C.nH=head.children.length;
  // extras
  const top=(t)=>{const z=t*bz*.9;return [0,by*Math.sqrt(Math.max(0,1-(t*.9)**2))*.96,z]};
  const surf=(th,ph,k)=>[bx*Math.cos(ph)*Math.sin(th)*k,by*Math.sin(ph)*k,bz*Math.cos(ph)*Math.cos(th)*k];
  const rnd=(i)=>{const v=Math.sin(i*127.1+sp.b.length*311.7)*43758.5;return v-Math.floor(v)};
  const dots=(n,col,r,o,minPh)=>{for(let i=0;i<n;i++){const th=rnd(i)*6.28,ph=(minPh||-.2)+rnd(i+50)*(1.4-(minPh||-.2));const m=P(ell(col,r,r*.4,r,o),...surf(th,ph,.94));m.lookAt(0,0,0);m.userData.dot=1;body.add(m)}};
  function flower(col,k){const f=grp();for(let i=0;i<6;i++){const p=ell(col,.12*k,.04*k,.22*k);const a=i/6*Math.PI*2;P(p,Math.cos(a)*.17*k,0,Math.sin(a)*.17*k);p.rotation.y=-a+Math.PI/2;p.rotation.x=.2;f.add(p)}f.add(ell('#ffd23a',.1*k,.07*k,.1*k));return f}
  const wingPair=(make)=>{for(const s of[-1,1]){const g=P(grp(),s*bx*.55,by*.65,sp.bird?0:bz*.15);make(g,s);body.add(g);C.wings.push(g)}};
  const ring=(par,n,cx,cy,cz,Rr,tilt,mk)=>{for(let i=0;i<n;i++){const a=i/n*Math.PI*2,g=P(grp(),cx+Math.cos(a)*Rr,cy+Math.sin(a)*Rr*.95,cz);g.rotation.set(tilt,0,a-Math.PI/2);g.add(mk(i,a));par.add(g)}};
  for(const ex of sp.x){switch(ex){
    case'ruff':break;
    case'flameMane':ring(head,13,0,-hr*.05,-hr*.45,hr*.85,-.7,(i)=>{const c=cone(i%3===0?'#ffd23a':i%3===1?'#ff9a1f':sp.b,hr*.3,hr*1.05);c.scale.z=.55;c.position.y=hr*.1;return c});break;
    case'leafMane':ring(head,12,0,-hr*.1,-hr*.45,hr*.85,-.7,(i)=>{const l=ell(i%2?'#6f8f3a':'#9ab65a',hr*.26,hr*.7,hr*.07);l.position.y=hr*.55;return l});break;
    case'headFins':for(const s of[-1,1])for(let i=0;i<3;i++){const f=ell(i%2?sp.b:sp.a,.06,hr*.42,hr*(1.7-i*.3));P(f,s*hr*(.45+i*.2),hr*(.7-i*.35),-hr*(1.3-i*.1));f.rotation.set(-.45+i*.2,s*.35,s*.35);head.add(f)}break;
    case'sideFinsBig':for(const s of[-1,1]){const f=ell(sp.a,.75,.03,.32);P(f,s*bx*1.3,by*.1,bz*.1);f.rotation.set(0,s*.5,-s*.45);body.add(f);const f2=ell(sp.b,.5,.025,.22);P(f2,s*bx*1.2,-by*.2,-bz*.45);f2.rotation.set(0,s*.8,-s*.3);body.add(f2)}break;
    case'crystalsBig':for(let i=0;i<26;i++){const th=rnd(i)*6.28,ph=.05+rnd(i+11)*1.35,c=new THREE.Mesh(new THREE.OctahedronGeometry(.15),M(i%3?sp.a:'#a8c8f4',{glass:1}));c.scale.set(.55,2+rnd(i+5)*1.4,.55);P(c,...surf(th,ph,.98));c.lookAt(0,0,0);c.rotateX&&0;body.add(c);const w=grp();body.add(w)}
      ring(head,9,0,hr*.1,-hr*.45,hr*.85,-.9,(i)=>{const c=new THREE.Mesh(new THREE.OctahedronGeometry(.12),M(i%2?sp.a:'#a8c8f4',{glass:1}));c.scale.set(.55,2.6,.55);c.position.y=hr*.35;return c});break;
    case'spikesYBig':for(let i=0;i<16;i++){const th=(rnd(i)-.5)*2.2+Math.PI,ph=.35+rnd(i+20)*1.1,c=cone(i%4===0?'#1a1716':sp.a,.11,.42+rnd(i)*.2);P(c,...surf(th,ph,.96));c.lookAt(0,0,0);c.rotation.x+=Math.PI/2*0;body.add(c)}
      ring(head,7,0,hr*.25,-hr*.4,hr*.6,-1.1,(i)=>cone(sp.a,hr*.18,hr*.6));break;
    case'lavaBig':dots(34,sp.a,.14,{glow:1.6},-.4);dots(12,'#ffc23a',.07,{glow:1.8},-.2);break;
    case'rocksDark':for(let i=0;i<10;i++){const th=rnd(i)*6.28,ph=rnd(i+20)*1.2,r=.2+rnd(i+40)*.12;const m=new THREE.Mesh(new THREE.DodecahedronGeometry(r),M(i%2?'#2e2522':'#4a3b34',{flat:1}));m.scale.y=.55;P(m,...surf(th,ph,.95));body.add(m)}break;
    case'smokeDark':for(let i=0;i<20;i++){const th=rnd(i)*6.28,ph=-.3+rnd(i+10)*1.6,r=.22+rnd(i+70)*.16;const ac=i%4===0;const m=P(ell(ac?sp.a:'#221a2c',ac?r*.6:r,ac?r*.6:r,ac?r*.9:r,{op:ac?.6:.9}),...surf(th,ph,ac?1.12:1.02));m.userData.base=m.position.clone();body.add(m);C.smoke.push(m)}break;
    case'wingsUp':wingPair((g,s)=>{g.rotation.set(-.35,0,-s*.2);for(let i=0;i<8;i++){const f=ell(i<3?sp.a:sp.b,.05,.4+i*.08,.14);P(f,s*(.05+i*.08),.36+i*.06,-i*.07);f.rotation.set(0,0,-s*(.05+i*.075));g.add(f)}});break;
    case'fairyWingsBig':wingPair((g,s)=>{g.position.y+=.1;for(const [k,y,a,col] of[[1.25,.1,-.1,'#d9c4ff'],[.85,-.12,-.9,'#ffc2dc']]){const m=new THREE.Mesh(wingShape(k,k*.85),M(col,{op:.55,side:1,gloss:1}));m.scale.x=s;m.rotation.set(-.15,s*.55,a*s*.4);P(m,0,y,-.1);g.add(m)}});break;
    case'tuft':ring(head,5,0,hr*.7,-hr*.1,hr*.25,-.3,(i)=>cone(sp.a,hr*.12,hr*.4));break;
    case'spikesPBig':for(let i=0;i<9;i++){const t=.75-i*.2,c=cone(sp.a,.1,.36+rnd(i)*.14);P(c,...top(t));c.rotation.x=-.45;body.add(c);
      for(const s of[-1,1]){const d=cone(i%2?'#4a2a8c':sp.a,.08,.3);P(d,s*.24,top(t)[1]-.08,top(t)[2]);d.rotation.set(-.4,0,-s*.75);body.add(d)}}
      ring(head,5,0,hr*.5,-hr*.45,hr*.35,-1.2,(i)=>cone(sp.a,hr*.12,hr*.45));break;
    case'plates':for(let i=0;i<6;i++){const t=.65-i*.27;const c=cone(sp.a,.15-i*.008,.3-i*.015);P(c,...top(t));c.scale.x=.45;c.rotation.x=-t*.6;body.add(c)}break;
    case'spotsBrown':dots(10,'#5f7a30',.12,{},0);break;
    case'dorsalFin':body.add(P(R(ell(sp.a,.04,.32,.5),.2,0,0),...top(-.1)));break;
    case'sideFins':for(const s of[-1,1])body.add(R(P(ell(sp.a,.45,.03,.22),s*bx*1.05,-by*.1,bz*.2),0,s*.4,s*-.3));break;
    case'flames':for(let i=0;i<7;i++){const t=.5-i*.17,c=cone(i%2?'#ff9a1f':'#ffd23a',.1,.32);P(c,...top(t));c.rotation.x=-.7;body.add(c)}
      for(let i=-1;i<=1;i++)head.add(R(P(cone(i?'#ff9a1f':'#ffd23a',.08,.3),i*.12,hr*.85,-hr*.1),-.4,0,-i*.3));
      body.add(P(ell(sp.c,bx*.55,by*.45,.2),0,by*.3,bz*.82));break;
    case'spots':dots(8,'#3a1a10',.07,{},-.1);break;
    case'wings':wingPair((g,s)=>{for(let i=0;i<5;i++){const f=ell(i%2?sp.a:sp.b,.06,.1,.45+i*.06);P(f,s*(.12+i*.13),.18+i*.07,-.05-i*.05);f.rotation.set(-.6,s*(.5+i*.1),s*-(.9+i*.12));g.add(f)}});break;
    case'crest':for(let i=-1;i<=1;i++)head.add(R(P(cone(sp.a,.06,.28),i*.1,hr*.8,-hr*.3),-.6,0,-i*.25));break;
    case'batWings':case'batWingsBig':{const big=ex==='batWingsBig',k=big?1.3:.75;wingPair((g,s)=>{g.rotation.z=-s*.45;const m=new THREE.Mesh(wingShape(k,k*.85,true),M(big?'#8e1a1e':sp.a,{side:1}));m.scale.x=s;m.rotation.set(.25,s*.3,s*.2);g.add(m);
      g.add(R(cyl(big?'#2a1a1c':'#2a2236',.025,.02,k*1.2),0,0,-s*2.1))})};break;
    case'glowPurple':dots(6,sp.a,.08,{glow:.6},-.1);break;
    case'leaves':for(let i=0;i<8;i++){const t=.5-i*.15,l=ell(i%2?'#6f8f3a':'#9ab65a',.12,.04,.3);P(l,(i%2?.15:-.15),top(t)[1],top(t)[2]);l.rotation.set(-.5,0,i%2?-.6:.6);body.add(l)}break;
    case'flower':head.add(P(flower(sp.a,1.1),.1,hr*.92,-.05));break;
    case'crystals':for(let i=0;i<9;i++){const t=.75-i*.19,c=new THREE.Mesh(new THREE.OctahedronGeometry(.13),M(i%3?sp.a:'#a8c8f4',{glass:1}));c.scale.set(.6,1.8+rnd(i)*.8,.6);P(c,(rnd(i+9)-.5)*.3,top(t)[1]+.1,top(t)[2]);c.rotation.set(-.4,0,(rnd(i+3)-.5)*.8);body.add(c)}
      for(let i=-1;i<=1;i++){const c=new THREE.Mesh(new THREE.OctahedronGeometry(.09),M(sp.a,{glass:1}));c.scale.set(.6,2,.6);P(c,i*.15,hr*.9,-hr*.2);c.rotation.z=-i*.4;head.add(c)}break;
    case'spikesY':for(let i=0;i<5;i++){const c=cone(sp.a,.08,.28);P(c,...top(.6-i*.25));c.rotation.x=-.8;body.add(c)}
      head.add(P(ell(sp.a,hr*.7,hr*.3,hr*.6),0,hr*.55,-hr*.25));break;
    case'patch':body.add(P(ell('#1a1716',bx*.4,by*.35,bz*.3),bx*.5,-by*.05,-bz*.1));break;
    case'lava':dots(16,sp.a,.09,{glow:1.2},-.3);break;
    case'horn':head.add(R(P(cone('#e82a14',.12,.35,{gloss:1}),0,hr*.85,0),-.3,0,0));for(const s of[-1,1])head.add(R(P(cone('#b8241a',.06,.15),s*.25,hr*.7,-.05),0,0,-s*.5));break;
    case'spotsNavy':dots(11,sp.a,.16,{},-.3);break;
    case'moon':head.add(R(P(new THREE.Mesh(new THREE.TorusGeometry(.16,.04,8,24,Math.PI*1.3),M('#f2c84a',{gloss:1,metal:.4})),0,hr*1.05,-hr*.1),0,0,.6));break;
    case'maneBlue':for(let i=0;i<7;i++)head.add(R(P(ell(sp.a,.13,.12,.42),(i-3)*.11,hr*(.75-Math.abs(i-3)*.08),-hr*.55),.6,0,(i-3)*.25));break;
    case'antlers':for(const s of[-1,1]){const g=P(grp(),s*hr*.32,hr*.82,-hr*.15);g.rotation.set(-.35,0,-s*.42);g.scale.setScalar(sp.ant||1);head.add(g);
      if(sp.antStyle==='branch'){g.rotation.set(-.3,s*.2,-s*.95);
        const seg=(par,len,r0,r1,depth,ang,twist)=>{const b=grp();b.rotation.set(twist||0,0,ang);par.add(b);b.add(R(cyl(sp.a,r1,r0,len,{velvet:1}),Math.PI,0,0));
          b.add(P(ell(sp.a,r1*1.35,r1*1.35,r1*1.35,{velvet:1}),0,len,0));const t=P(grp(),0,len,0);b.add(t);
          if(depth>0){seg(t,len*.72,r1,r1*.78,depth-1,s*.35,0);seg(t,len*.62,r1*.9,r1*.72,depth-1,-s*.75,.5)}if(depth>1){const mid=P(grp(),0,len*.5,0);b.add(mid);seg(mid,len*.55,r1*.85,r1*.7,0,s*1.05,-.7)}};
        seg(g,.3,.09,.075,3,s*.25,0)}
      else{g.add(R(cyl(sp.a,.075,.11,.75,{velvet:1}),Math.PI,0,0));
      for(const [y,a,l] of[[.25,1,.3],[.48,-1,.26]]){const b=P(grp(),0,y,0);b.rotation.z=s*a*.9;g.add(b);b.add(R(cyl(sp.a,.045,.065,l,{velvet:1}),Math.PI,0,0));b.add(P(ell('#6e5640',.036,.05,.036),0,l,0))}
      g.add(P(ell('#6e5640',.06,.08,.06),0,.8,0))}}break;
    case'maneBig':for(let i=0;i<0;i++){const t=i/13,a=(rnd(i)-.5)*1.6,r=.17+rnd(i+3)*.07;body.add(P(ell(sp.c,r*1.1,r*1.15,r*.9),Math.sin(a)*bx*.5,-by*.35+t*(HY-hr*.6+by*.35),bz*.72+(HZ-bz*.72)*t+.12*Math.cos(a)))}
      for(let i=0;i<4;i++)head.add(P(ell(sp.c,.13,.11,.1),(i-1.5)*.12,-hr*.75,hr*.15));break;
    case'mane':body.add(P(ell(sp.c,bx*.75,by*.6,.3),0,by*.35,bz*.75));break;
    case'eyeRim':C.eyes&&0;break;
    case'legTufts':C.legs.forEach(g=>{for(let i=0;i<3;i++)g.add(P(ell(sp.c,.07,.05,.06),(i-1)*.05,-sp.lg*.7,.08))});break;
    case'patchesBrown':dots(10,'#9a7650',.17,{},.15);dots(6,'#e8dcc8',.07,{},.3);break;
    case'spotsWhite':dots(8,'#f4ece0',.06,{},.1);break;
    case'horns2':for(const s of[-1,1])head.add(R(P(cone('#8c8590',.08,.4,{gloss:1}),s*hr*.4,hr*.7,-hr*.2),-1.1,0,-s*.4));break;
    case'spikes':for(let i=0;i<6;i++){const c=cone('#2a1a1c',.06,.18);P(c,...top(.6-i*.22));c.rotation.x=-.6;body.add(c)}break;
    case'patchesBlack':dots(7,sp.a,.14,{},-.2);break;
    case'cloud':for(let i=0;i<46;i++){const th=rnd(i)*6.28,ph=-.3+rnd(i+30)*1.6,r=.12+rnd(i+60)*.1;body.add(P(ell(i%3?sp.b:sp.a,r,r*.9,r),...surf(th,ph,.95)))}
      for(let i=0;i<5;i++)head.add(P(ell(i%2?sp.a:sp.b,.13,.12,.13),(i-2)*.15,hr*.8,-hr*.35));break;
    case'rocks':for(let i=0;i<14;i++){const th=rnd(i)*6.28,ph=rnd(i+20)*1.3,r=.18+rnd(i+40)*.14;const m=new THREE.Mesh(new THREE.DodecahedronGeometry(r),M(i%2?'#7a756c':'#958f83',{flat:1}));m.scale.y=.6;P(m,...surf(th,ph,.95));m.lookAt(0,0,0);body.add(m)}break;
    case'moss':dots(10,sp.a,.13,{},.3);break;
    case'smoke':for(let i=0;i<12;i++){const th=rnd(i)*6.28,ph=-.2+rnd(i+10)*1.4,r=.2+rnd(i+70)*.15;const m=P(ell(i%2?sp.a:'#5a2a9a',r,r,r,{op:.45}),...surf(th,ph,1.05));m.userData.base=m.position.clone();body.add(m);C.smoke.push(m)}break;
    case'shell':{const sh=new THREE.Mesh(new THREE.SphereGeometry(1,28,14,0,Math.PI*2,0,Math.PI/2),M(sp.a));sh.scale.set(bx*1.15,by*1.6,bz*1.08);P(sh,0,by*.1,-bz*.05);body.add(sh);
      const rim=new THREE.Mesh(new THREE.TorusGeometry(1,.09,8,32),M('#2b56b0'));rim.scale.set(bx*1.15,bz*1.08,1);rim.rotation.x=Math.PI/2;P(rim,0,by*.12,-bz*.05);body.add(rim);
      for(let i=0;i<10;i++){const th=rnd(i)*6.28,r=.4+rnd(i+5)*.45;body.add(P(ell('#2b56b0',.12,.05,.12),Math.sin(th)*bx*r,by*.1+by*1.6*Math.sqrt(1-r*r)*.98,Math.cos(th)*bz*r-bz*.05))}}break;
    case'coral':for(let i=0;i<7;i++){const col=['#f26a8a','#ff9a3a','#ffd23a','#c45ad8'][i%4],g=P(grp(),(rnd(i)-.5)*bx*1.1,by*1.55,(rnd(i+3)-.5)*bz);
      g.add(R(cyl(col,.03,.045,.4),Math.PI,0,(rnd(i+7)-.5)*.6));for(const a of[-.7,.7])g.add(P(R(cyl(col,.02,.03,.22),Math.PI,0,a),0,.2,0));body.add(g)}break;
    case'fireWings':wingPair((g,s)=>{for(let i=0;i<6;i++){const f=ell(['#ff5a1a','#ffb52a','#e8401c'][i%3],.05,.12,.4+i*.07);P(f,s*(.1+i*.12),.25+i*.05,-.05);f.rotation.set(-.3,s*.3,s*-(.5+i*.18));g.add(f)}});break;
    case'crestFire':for(let i=-1;i<=1;i++)head.add(R(P(cone(i?'#ffb52a':'#e8401c',.06,.3),i*.08,hr*.75,-hr*.4),-.9,0,-i*.3));break;
    case'fairyWings':wingPair((g,s)=>{for(const [k,y,a,col] of[[.9,.15,-.2,'#d9c4ff'],[.6,-.05,-.9,'#ffc2dc']]){const m=new THREE.Mesh(wingShape(k,k*.8),M(col,{op:.5,side:1,gloss:1}));m.scale.x=s;m.rotation.set(-.4,s*.5,a*s*.4);P(m,0,y,0);g.add(m)}});break;
    case'bow':for(const s of[-1,1])head.add(P(R(ell(sp.a,.1,.07,.05),0,0,s*.4),s*.1,-hr*.85,hr*.25));head.add(P(ell(sp.a,.05,.05,.05),0,-hr*.85,hr*.28));break;
    case'spikesP':for(let i=0;i<7;i++){const t=.7-i*.22,c=cone(sp.a,.08,.26+rnd(i)*.1);P(c,...top(t));c.rotation.x=-.5;body.add(c);
      for(const s of[-1,1]){const d=cone(sp.a,.06,.2);P(d,s*.18,top(t)[1]-.05,top(t)[2]);d.rotation.set(-.4,0,-s*.6);body.add(d)}}break;
    case'spotsDark':dots(10,'#3f5a1c',.08,{},-.2);break;
    case'hornsGold':for(const s of[-1,1]){const g=P(grp(),s*hr*.38,hr*.55,-hr*.15);g.rotation.set(-1.95,0,-s*.25);head.add(g);g.add(cone(sp.a,.075,.55,{gloss:1,metal:.4}));g.add(P(R(cone(sp.a,.05,.45,{gloss:1,metal:.4}),.45,0,0),0,.5,0));g.add(P(R(cone(sp.a,.03,.3,{gloss:1,metal:.4}),.9,0,0),0,.9,.18))}break;
    case'goldMarks':dots(14,sp.a,.11,{gloss:1,metal:.4},-.3);break;
  }}
  if(sp.bird)body.rotation.x=-.35;
  return C;
}

/* ---------- photo skin: project the reference photo onto the sculpted body ---------- */
const FILLS=GD.fills.FILLS;const PTEX={};
function photoTex(i){if(PTEX[i])return PTEX[i];const t=new THREE.TextureLoader().load(FILLS[i]);t.encoding=THREE.sRGBEncoding;t.anisotropy=4;return PTEX[i]=t}
function projectPhoto(C,i,sp){
  const pv=sp.pv||[50,12],a=pv[0]*Math.PI/180,p=pv[1]*Math.PI/180,ca=Math.cos(a),sa=Math.sin(a),cp=Math.cos(p),spp=Math.sin(p);
  const pr=(x,y,z)=>{const X=ca*x+sa*z,Z=-sa*x+ca*z;return[X,cp*y-spp*Z]};
  C.root.updateMatrixWorld(true);const inv=new THREE.Matrix4().copy(C.root.matrixWorld).invert(),v=new THREE.Vector3(),targets=[];
  let mnx=1e9,mny=1e9,mxx=-1e9,mxy=-1e9;
  C.root.traverse(o=>{if(!o.isMesh||o.userData.shell||!o.geometry.attributes.position)return;const m=new THREE.Matrix4().multiplyMatrices(inv,o.matrixWorld),pos=o.geometry.attributes.position;
    for(let k=0;k<pos.count;k+=2){v.fromBufferAttribute(pos,k).applyMatrix4(m);const q=pr(v.x,v.y,v.z);if(q[0]<mnx)mnx=q[0];if(q[0]>mxx)mxx=q[0];if(q[1]<mny)mny=q[1];if(q[1]>mxy)mxy=q[1]}
    if(o.material===SDFMAT){let inHead=false;for(let u=o;u;u=u.parent)if(u===C.head)inHead=true;if(!inHead)targets.push([o,m])}});
  if(!targets.length||!FILLS[i])return;
  const mat=new THREE.MeshStandardMaterial({map:photoTex(i),roughness:1,metalness:0});mat.userData.fur=true;mat.userData.photo=true;
  for(const [o,m] of targets){const g=o.geometry.clone(),pos=g.attributes.position,uv=new Float32Array(pos.count*2);
    for(let k=0;k<pos.count;k++){v.fromBufferAttribute(pos,k).applyMatrix4(m);const q=pr(Math.abs(v.x),v.y,v.z);uv[k*2]=(q[0]-mnx)/(mxx-mnx);uv[k*2+1]=(q[1]-mny)/(mxy-mny)}
    g.setAttribute('uv',new THREE.BufferAttribute(uv,2));
    if(sp.chest){const cl=new Float32Array(pos.count*3),bz=sp.s[2],by=sp.s[1];for(let k=0;k<pos.count;k++){v.fromBufferAttribute(pos,k).applyMatrix4(m);
      const w=Math.min(1,Math.max(0,(v.z-bz*.45)/(bz*.3)))*Math.min(1,Math.max(0,(v.y+by*.7)/(by*.4)));cl[k*3]=1+.22*w;cl[k*3+1]=1+.17*w;cl[k*3+2]=1+.08*w}
      g.setAttribute('color',new THREE.BufferAttribute(cl,3));mat.vertexColors=true}
    o.geometry=g;o.material=mat}
}
/* ---------- real 3D models (GLB from image-to-3D) ---------- */
// per model: file, head region (z,y thresholds) + neck pivot, tail start + pivot, personality speed
const NOEXTRA=new Set();
const MODELS={
  0:{file:'models/terranox.glb',skin:null,key:'terra1',hc:[0,.22,.4],hr:.12,hp:[0,.17,.3],tz:-.4,tp:[0,.2,-.42],spd:.55,wag:.18},
  10:{file:'models/sylvorn.glb',hc:[0,.42,.36],hr:.14,hp:[0,.36,.24],tz:-.3,tp:[0,.32,-.3],spd:1,wag:.35}
};
// derived plushes: the Sylvorn mesh without antlers/ears, a painted skin per plush, plus the plush's own parts (ears, wings, fins, tail...)
const DEER=GD.modelos.DEER;
const DER=GD.modelos.DER;
for(const k in DER)MODELS[k]=Object.assign({},DEER,DER[k],{skin:'models/skins/'+k+'.jpg',key:'d'+k});
// Tripo models sent by the team; each one is also the base for its "cousins" (same body, repainted skin)
const NB=GD.modelos.NB;
for(const [k,b,o] of [[11,'draksel',{spd:.9,wag:.3}],[6,'glacien',{spd:.7,wag:.2}],[2,'flarion',{spd:1.1,wag:.4}],[8,'magmord',{spd:.5,wag:.15}],[13,'petrun',{spd:.4,wag:.12}],
  [4,'umbros',{spd:.9,wag:.35}],[16,'ignovus',{spd:1,wag:.25}],[14,'sombril',{spd:.6,wag:.15}],
  [12,'sombril',{spd:.6,wag:.15,skin:1}]])
  MODELS[k]=Object.assign({file:'models/'+b+'.glb'},NB[b],o,{skin:(k==14||k==16)?null:'models/skins/'+k+'.jpg',key:b+k});

// Tripo models made for each plush (own body and own painted texture, no repaint)
NB.aquarim={hc:[0,.4,.33],hr:.13,hp:[0,.3,.2],tz:-.2,tp:[0,.12,-.2],wing:{x:.1,y:.38,z0:-.1,z1:.2,a:.3}};
NB.coralith={hc:[0,.27,.38],hr:.1,hp:[0,.2,.25],tz:-.3,tp:[0,.12,-.3]};
NB.lunaris={hc:[0,.5,.36],hr:.14,hp:[0,.42,.2],tz:-.2,tp:[0,.35,-.25]};
NB.voltik={hc:[0,.55,.32],hr:.15,hp:[0,.45,.2],tz:-.28,tp:[0,.35,-.3]};
NB.floriss={hc:[0,.55,.33],hr:.17,hp:[0,.4,.2],tz:-.3,tp:[0,.25,-.3]};
NB.lumina={hc:[0,.5,.3],hr:.14,hp:[0,.4,.2],tz:-.2,tp:[0,.15,-.2],wing:{x:.08,y:.5,z0:-.15,z1:.15,a:.5}};
NB.toxilys={hc:[0,.38,.36],hr:.12,hp:[0,.3,.22],tz:-.25,tp:[0,.2,-.3]};
NB.auren={hc:[0,.55,.33],hr:.17,hp:[0,.45,.2],tz:-.3,tp:[0,.25,-.35]};
NB.zephyra={hc:[0,.5,.35],hr:.13,hp:[0,.42,.2],tz:-.15,tp:[0,.12,-.15],wing:{x:.1,y:.45,z0:-.12,z1:.15,a:.5}};
for(const [k,b,o] of [[1,'aquarim',{spd:1,wag:.3}],[15,'coralith',{spd:.45,wag:.12}],[9,'lunaris',{spd:.9,wag:.3}],[7,'voltik',{spd:1.3,wag:.4}],[5,'floriss',{spd:.8,wag:.25}],[3,'zephyra',{spd:1,wag:.25}],[17,'lumina',{spd:1,wag:.3}],[18,'toxilys',{spd:.6,wag:.25}],[19,'auren',{spd:.7,wag:.3}]]){
  MODELS[k]=Object.assign({file:'models/'+b+'.glb'},NB[b],o,{skin:null,key:b+k});NOEXTRA.add(k)}
// Tripo próprios que faltavam: Glacien, Petrun, Flarion e Nimbri (corpo e textura do próprio modelo)
NB.glacien2={hc:[0,.31,.4],hr:.13,hp:[0,.25,.3],tz:-.4,tp:[0,.18,-.43]};
NB.flarion2={hc:[-.1,.42,.38],hr:.15,hp:[-.08,.34,.28],tz:-.4,tp:[.12,.3,-.43]};
NB.petrun2={hc:[0,.15,.42],hr:.12,hp:[0,.13,.32],tz:-.4,tp:[.04,.18,-.42]};
NB.nimbri2={hc:[.06,.3,.38],hr:.16,hp:[.04,.26,.26],tz:-.4,tp:[-.1,.28,-.43]};
for(const [k,b,o] of [[6,'glacien',{spd:.8,wag:.25}],[13,'petrun',{spd:.4,wag:.12}],[2,'flarion',{spd:1.1,wag:.4}],[12,'nimbri',{spd:.7,wag:.2}]]){
  MODELS[k]=Object.assign({file:'models/'+b+'.glb'},NB[b+'2'],o,{skin:null,key:b+'T'+k});NOEXTRA.add(k)}
NOEXTRA.add(0);// Terranox: modelo Tripo próprio (dinossauro)
const GLB={};
const GLBDATA={};
function loadGLB(m){if(GLB[m.file])return GLB[m.file];
  GLB[m.file]=new Promise((res,rej)=>{if(!THREE.GLTFLoader)return rej('noloader');const b64=GLBDATA[m.file];if(!b64&&(window.GARRO_GLBTXT||(window.GARRO_EVOTXT&&m.evoM))){fetch(m.file+'.txt?v='+ASSETV).then(r=>{if(!r.ok)throw new Error('evo');return r.text()}).then(t=>{const bin=Uint8Array.from(atob(t.trim()),c=>c.charCodeAt(0));new THREE.GLTFLoader().parse(bin.buffer,'',g=>res(g.scene),rej)}).catch(rej);return}
    if(!b64)return new THREE.GLTFLoader().load(((window.GARRO_REMOTE&&m.remote)?window.GARRO_REMOTE:'')+m.file+'?v='+ASSETV,g=>res(g.scene),undefined,rej);
    const bin=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));new THREE.GLTFLoader().parse(bin.buffer,'',g=>res(g.scene),rej)});return GLB[m.file]}
// pelo fofo nas formas evoluídas (modelos Tripo saem lisos/em placas): mesma textura de pelo dos bichos de pelúcia, por cima da cor do modelo
function furDet(mat,k){const U={uDet:DETU.uDet,uDS:{value:.22},uFS:{value:k}};
  mat.onBeforeCompile=sh=>{Object.assign(sh.uniforms,U);
    sh.vertexShader='varying vec3 vTP;\nvarying vec3 vON;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n vTP=position*vec3(length(modelMatrix[0].xyz),length(modelMatrix[1].xyz),length(modelMatrix[2].xyz));vON=normalize(normal);');
    sh.fragmentShader='uniform sampler2D uDet;uniform float uDS,uFS;\nvarying vec3 vTP;\nvarying vec3 vON;\n'+sh.fragmentShader
      .replace('#include <map_fragment>','#include <map_fragment>\n float gDet=.5;{vec3 bw=pow(abs(vON),vec3(4.));bw/=bw.x+bw.y+bw.z;vec3 p=vTP*uDS;gDet=texture2D(uDet,p.yz).r*bw.x+texture2D(uDet,p.xz+.37).r*bw.y+texture2D(uDet,p.xy+.71).r*bw.z;\n diffuseColor.rgb*=clamp(1.+(gDet*2.-1.)*uFS,.75,1.25);}')
      .replace('#include <normal_fragment_begin>','#include <normal_fragment_begin>\n {vec2 dh=vec2(dFdx(gDet),dFdy(gDet))*uFS*.3;vec3 sx=dFdx(-vViewPosition),sy=dFdy(-vViewPosition);vec3 r1=cross(sy,normal),r2=cross(normal,sx);float fd=dot(sx,r1);normal=normalize(abs(fd)*normal-sign(fd)*(dh.x*r1+dh.y*r2));}')};
  mat.customProgramCacheKey=()=>'glbfur'+k}
function deformMat(mat,m,U){
  // formas evoluídas: o modelo inteiro se mexe, sem dobrar cabeça/cauda (dobrar esticava o rosto)
  if(m.noDeform){if(m.pelo&&!mat.isMeshDepthMaterial){furDet(mat,m.pelo);return}mat.customProgramCacheKey=()=>'glbnd';return}
  const ds=(m.ds!=null?m.ds:.5).toFixed(3);// força das dobras: os modelos Tripo esticam se a cabeça/cauda gira demais
  mat.onBeforeCompile=sh=>{Object.assign(sh.uniforms,U);
    sh.vertexShader='uniform float uHY,uHP,uHR,uTail,uT,uWing;\nmat3 rY(float a){float c=cos(a),s=sin(a);return mat3(c,0.,-s,0.,1.,0.,s,0.,c);}\nmat3 rX(float a){float c=cos(a),s=sin(a);return mat3(1.,0.,0.,0.,c,s,0.,-s,c);}\nmat3 rZ(float a){float c=cos(a),s=sin(a);return mat3(c,s,0.,-s,c,0.,0.,0.,1.);}\n'+
    sh.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      {vec3 hp=vec3(${m.hp.map(v=>v.toFixed(3)).join(',')});float hw=${m.hc?`1.-smoothstep(${(m.hr*.8).toFixed(3)},${(m.hr*1.8).toFixed(3)},length(transformed-vec3(${m.hc.map(v=>v.toFixed(3)).join(',')})))`:`smoothstep(${(m.hz-.04).toFixed(3)},${(m.hz+.18).toFixed(3)},transformed.z)*smoothstep(${(m.hy-.18).toFixed(3)},${(m.hy+.04).toFixed(3)},transformed.y)`};
       vec3 d=transformed-hp;transformed=mix(transformed,hp+rY(uHY*${ds})*rX(uHP*${ds})*rZ(uHR*${ds})*d,hw);
       vec3 tp=vec3(${m.tp.map(v=>v.toFixed(3)).join(',')});float tw=(1.-smoothstep(${(m.tz-.12).toFixed(3)},${m.tz.toFixed(3)},transformed.z))*(1.-smoothstep(${(m.tx||.6).toFixed(3)},${((m.tx||.6)+.1).toFixed(3)},abs(transformed.x)));
       float far=max(0.,${m.tz.toFixed(3)}-transformed.z);vec3 e=transformed-tp;transformed=mix(transformed,tp+rY(uTail*${ds}*(.4+far*2.))*e,tw);${m.wing?`{const float wx=${m.wing.x.toFixed(3)},wy=${m.wing.y.toFixed(3)};float ww=smoothstep(wx,wx+.14,abs(transformed.x))*smoothstep(wy,wy+.1,transformed.y)*smoothstep(${(m.wing.z0-.1).toFixed(3)},${m.wing.z0.toFixed(3)},transformed.z)*(1.-smoothstep(${m.wing.z1.toFixed(3)},${(m.wing.z1+.1).toFixed(3)},transformed.z))*(1.-hw);
       float sx=sign(transformed.x);vec3 wp=vec3(sx*wx,wy,transformed.z);transformed=wp+rZ(sx*uWing*${ds}*ww)*(transformed-wp);}`:''}}`)};
  mat.customProgramCacheKey=()=>'glb'+(m.key||m.file)+ds;
}
function weldNormals(g){const p=g.attributes.position,n=p.count,id=new Int32Array(n),map=new Map();let m=0;
  for(let i=0;i<n;i++){const k=Math.round(p.getX(i)*1e5)+','+Math.round(p.getY(i)*1e5)+','+Math.round(p.getZ(i)*1e5);let v=map.get(k);if(v===undefined){v=m++;map.set(k,v)}id[i]=v}
  const acc=new Float32Array(m*3),ix=g.index.array,a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
  for(let t=0;t<ix.length;t+=3){a.fromBufferAttribute(p,ix[t]);b.fromBufferAttribute(p,ix[t+1]);c.fromBufferAttribute(p,ix[t+2]);b.sub(a);c.sub(a);b.cross(c);
    for(let q=0;q<3;q++){const w=id[ix[t+q]]*3;acc[w]+=b.x;acc[w+1]+=b.y;acc[w+2]+=b.z}}
  const N=new Float32Array(n*3);for(let i=0;i<n;i++){const w=id[i]*3,l=Math.hypot(acc[w],acc[w+1],acc[w+2])||1;N[i*3]=acc[w]/l;N[i*3+1]=acc[w+1]/l;N[i*3+2]=acc[w+2]/l}
  g.setAttribute('normal',new THREE.BufferAttribute(N,3))}
const SKIN={};
// forma evoluída: arquivo .glb próprio quando existir (ex.: 'models/petrun_evo.glb'); senão o mesmo corpo com a pele evoluída
// modelos Tripo das formas evoluídas (cada arquivo veio com base+evolução; aqui só a evolução)
const EVOFILE=GD.modelos.EVOFILE,NBE=GD.modelos.NBE,EVOFAIL={};
const EVT={};
function evoTex(i,map){if(EVT[i])return EVT[i];const img=map.image;if(!img||!img.width)return map;
  const S=Math.min(1024,img.width),cv=document.createElement('canvas');cv.width=cv.height=S;const x=cv.getContext('2d');x.drawImage(img,0,0,S,S);
  const D=x.getImageData(0,0,S,S),d=D.data,e=ELEM[i];let seed=i*977+13;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
  // manchas grandes (musgo, brasas, estrelas) num grid grosso
  const G=24,grid=new Float32Array((G+1)*(G+1));for(let k=0;k<grid.length;k++)grid[k]=rnd();
  const noise=(px,py)=>{const gx=px/S*G,gy=py/S*G,ix=gx|0,iy=gy|0,fx=gx-ix,fy=gy-iy,a=grid[iy*(G+1)+ix],b=grid[iy*(G+1)+ix+1],c=grid[(iy+1)*(G+1)+ix],dd=grid[(iy+1)*(G+1)+ix+1];return a+(b-a)*fx+(c-a)*fy+(a-b-c+dd)*fx*fy};
  for(let p=0,n=0;p<d.length;p+=4,n++){let r=d[p]/255,g=d[p+1]/255,b=d[p+2]/255;const mx=Math.max(r,g,b),mn=Math.min(r,g,b),L=(mx+mn)/2,sat=mx-mn;
    const px=n%S,py=(n/S)|0;let nz=noise(px,py);
    // contraste + cor mais forte para todos
    const k=1.28;r=L+(r-L)*k;g=L+(g-L)*k;b=L+(b-L)*k;r=(r-.5)*1.1+.5;g=(g-.5)*1.1+.5;b=(b-.5)*1.1+.5;
    if(e==='stone'||e==='earth'){if(sat<.18&&nz>.52){const t=Math.min(1,(nz-.52)*6);r=r*(1-t)+(.30+.25*L)*t;g=g*(1-t)+(.46+.3*L)*t;b=b*(1-t)+(.12+.1*L)*t}if(e==='earth'){r*=.95;g*=1.04;b*=.9}}
    else if(e==='lava'||e==='embers'){if(L<.35){r*=.55;g*=.42;b*=.42}else{r=Math.min(1,r*1.12+.06);g=Math.min(1,g*1.1+.03)}if(L<.3&&nz>.6){const t=Math.min(1,(nz-.6)*5);r+=t*.7;g+=t*.25}}
    else if(e==='ice'||e==='water'||e==='cloud'){if(sat<.2&&L>.55){r*=.86;g*=.94}b=Math.min(1,b*1.08+.03);if(nz>.72&&L>.5){const t=Math.min(1,(nz-.72)*6);r+=t*.15;g+=t*.2;b+=t*.25}}
    else if(e==='shadow'){r*=.82;g*=.72;b*=.92;if(sat>.15){r=Math.min(1,r*1.15+.04);b=Math.min(1,b*1.3+.06)}}
    else if(e==='stars'||e==='gold'||e==='petals'){if(L>.5){r=Math.min(1,r*1.06+.03);g=Math.min(1,g*1.03+.02)}if(nz>.8&&L>.45){const t=Math.min(1,(nz-.8)*8);r+=t*.35;g+=t*.28;b+=t*.05}}
    else if(e==='electric'){if(r>b){r=Math.min(1,r*1.1+.04);g=Math.min(1,g*1.1+.04)}}
    else if(e==='leaves'||e==='flowers'||e==='sand'){if(g>r&&g>b){g=Math.min(1,g*1.08)}if(r>g&&r>b){r=Math.min(1,r*1.1)}}
    else if(e==='swamp'){if(sat>.15){r=Math.min(1,r*1.1);b=Math.min(1,b*1.12)}}
    d[p]=Math.max(0,Math.min(255,r*255));d[p+1]=Math.max(0,Math.min(255,g*255));d[p+2]=Math.max(0,Math.min(255,b*255))}
  x.putImageData(D,0,0);const t=new THREE.CanvasTexture(cv);t.flipY=map.flipY;t.encoding=THREE.sRGBEncoding;t.anisotropy=4;t.wrapS=map.wrapS;t.wrapT=map.wrapT;return EVT[i]=t}
function applyEvoTex(i){const C=V.C;if(!C||!C.obj)return;C.obj.traverse(o=>{if(o.isMesh&&!o.userData.keep&&o.userData.baseMap){o.material.map=evoTex(i,o.userData.baseMap);o.material.needsUpdate=true}})}
const ASSETV='72';function loadSkin(f){if(SKIN[f])return SKIN[f];return SKIN[f]=new Promise(res=>{const src=GLBDATA[f]?'data:image/jpeg;base64,'+GLBDATA[f]:f+'?v='+ASSETV;
  new THREE.TextureLoader().load(src,t=>{t.flipY=false;t.encoding=THREE.sRGBEncoding;t.anisotropy=4;res(t)},undefined,()=>res(null))})}
function dropTail(g,m){const w=g.attributes.uv2;if(!w)return g;g=g.clone();const p=g.attributes.position,B=m.TA;
  for(let i=0;i<p.count;i++){const k=w.getX(i);if(k<=0)continue;const x=p.getX(i),y=p.getY(i),z=p.getZ(i);p.setXYZ(i,x+(B[0]+(x-B[0])*.1-x)*k,y+(B[1]+(y-B[1])*.1-y)*k,z+(B[2]+(z-B[2])*.1-z)*k)}
  p.needsUpdate=true;return g}
// build the procedural plush and move its own parts (ears, horns, wings, fins, tail...) onto the GLB body
function attachParts(obj,i,m){const sp0=SPEC[i],sp=Object.assign({},sp0,{x:sp0.x.filter(k=>m.only?m.only.includes(k):!(m.skip||[]).includes(k))}),C=build(sp),[bx,by,bz]=sp.s,hr=sp.h;
  const kH=m.HR/hr,rB=[m.BR[0]/bx,m.BR[1]/by,m.BR[2]/bz],kB=(rB[0]+rB[1]+rB[2])/3;
  const hpG=new THREE.Group();hpG.position.fromArray(m.hp);hpG.rotation.order='YXZ';obj.add(hpG);
  const tpG=new THREE.Group();tpG.position.fromArray(m.tp);obj.add(tpG);
  const bodyG=new THREE.Group();obj.add(bodyG);
  const hx=C.head.children.slice(C.nH).concat(m.noears?[]:C.ears);
  for(const o of hx){o.position.multiplyScalar(kH).add(new THREE.Vector3(m.HC[0]-m.hp[0],m.HC[1]-m.hp[1],m.HC[2]-m.hp[2]));o.scale.multiplyScalar(kH);hpG.add(o)}
  const bx_=C.body.children.slice(C.nB).filter(o=>!o.userData.dot);
  for(const o of bx_){if(C.wings.includes(o)){o.children=o.children.filter(c=>!(c.geometry&&c.geometry.type==='CylinderGeometry'));o.scale.multiplyScalar(m.ws||1)}o.position.set(m.BC[0]+o.position.x*rB[0],m.BC[1]+o.position.y*rB[1],m.BC[2]+o.position.z*rB[2]);o.scale.multiplyScalar(kB);bodyG.add(o)}
  if(m.notail){const t=C.tail;t.position.set(m.TA[0]-m.tp[0],m.TA[1]-m.tp[1],m.TA[2]-m.tp[2]);t.scale.multiplyScalar(kB*1.15*(m.ts||1));tpG.add(t)}
  const wings=(C.wings||[]).map(w=>({w,z:w.rotation.z,s:Math.sign(w.position.x)||1}));
  return{hpG,tpG,wings,segs:C.segs||[]}}
async function openGLB(i){setDet(i);
  const evo=careStage(i)>0&&i<CH0,m0=MODELS[i];let m=evo&&EVOFILE[i]&&!EVOFAIL[i]?Object.assign({},m0,NBE[i]||{},{file:EVOFILE[i],skin:null,key:m0.key+'E',remote:1,evoM:1,wing:null,notail:false,noDeform:1}):m0;if(!initViewer())return false;
  let src;try{src=await loadGLB(m)}catch(e){if(m===m0)return false;EVOFAIL[i]=1;delete GLB[m.file];m=m0;try{src=await loadGLB(m)}catch(e2){return false}}
  const evoModel=m!==m0;
  if(V.C)V.spin.remove(V.C.root);if(V.T){V.spin.remove(V.T.root);V.T=null}
  const U={uHY:{value:0},uHP:{value:0},uHR:{value:0},uTail:{value:0},uT:{value:0},uWing:{value:0}};
  const obj=src.clone(true);
  const skin=m.skin?await loadSkin(m.skin):null;
  obj.traverse(o=>{if(o.isMesh){if(m.notail)o.geometry=dropTail(o.geometry,m);if(!o.geometry.attributes.normal)weldNormals(o.geometry);
    const mm=o.material.clone();if(skin)mm.map=skin;if(mm.map)mm.map.encoding=THREE.sRGBEncoding;if(evo&&!evoModel&&mm.map){o.userData.baseMap=mm.map;mm.map=evoTex(i,mm.map)}else if(mm.map)o.userData.baseMap=mm.map;mm.roughness=.92;mm.metalness=0;deformMat(mm,m,U);o.material=mm;const dm=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking});deformMat(dm,m,U);o.customDepthMaterial=dm}});
  const box=new THREE.Box3().setFromObject(obj),sz=box.getSize(new THREE.Vector3()),k=2/Math.max(sz.x,sz.y,sz.z);
  const parts=m.evoM?null:(m.HC?attachParts(obj,i,m):attachExtras(obj,i,m));
  const roll=new THREE.Group(),root=new THREE.Group();obj.scale.setScalar(k);obj.position.y=-sz.y*k/2;roll.add(obj);roll.position.y=sz.y*k/2;root.add(roll);
  root.position.y=-1;V.spin.add(root);
  setFloor(i);castAll(root);
  V.C={root,roll,obj,U,m,h:sz.y*k,wx:sz.x*k,parts};V.mode='glb';V.chibi=false;V.sp={};
  {const st=careStage(i);V.C.gs=GROW[st].gs;root.scale.setScalar(V.C.gs);killAura()}
  V.size={xz:Math.max(sz.x,sz.z)*k,y:sz.y*k};if(careStage(i))makeAura(i);
  Object.assign(V,{ry:-.6,rx:.1,vy:0,st:'idle',until:0,taps:[],t0:performance.now(),wag:0,side:1,
    G:{hy:0,hp:0,hr:0,tail:0,wagA:.2,wagS:4,roll:0,crouch:0,bob:0,shake:0,lift:0}});
  return true;
}
function hitGLB(e){
  const r=$('v3d').getBoundingClientRect();V.ray.setFromCamera({x:(e.clientX-r.left)/r.width*2-1,y:-(e.clientY-r.top)/r.height*2+1},V.cam);
  const h=V.ray.intersectObject(V.C.root,true)[0];if(!h)return null;
  const lp=V.C.obj.worldToLocal(h.point.clone()),m=V.C.m;
  if(m.hc?lp.distanceTo(new THREE.Vector3().fromArray(m.hc))<m.hr*1.6:(lp.z>m.hz&&lp.y>m.hy-.05))return'head';if(lp.z<m.tz)return'tail';return'body';
}
function gloop(now){
  const dt=Math.min(.05,(now-V.last)/1000),t=(now-V.t0)/1000;V.last=now;
  const C=V.C,G=V.G,sp=C.m.spd,m=C.m;
  if(V.st!=='idle'&&V.st!=='belly'&&t>V.until){V.st='idle';V.nextIdle=t+2+Math.random()*2.5;mood('')}
  // when left alone the plush does little things by itself
  if(V.st==='idle'&&t>(V.nextIdle||3)){const acts=['look','look','sniff','hop','stretch','sit','wag'];if(m.wing)acts.push('flap','flap');
    V.act=acts[Math.random()*acts.length|0];V.actT=t;V.actSide=Math.random()<.5?-1:1;V.nextIdle=t+4.5+Math.random()*4}
  const st=V.st,el=t-(V.stT||0),toCam=Math.max(-.7,Math.min(.7,-V.ry));
  const ae=t-(V.actT||-99),act=st==='idle'&&ae<2.6?V.act:null,ap=act?Math.sin(Math.min(1,ae/2.6)*Math.PI):0;
  const X={byaw:0,hy:Math.sin(t*.5*sp)*.14+Math.sin(t*1.3*sp)*.03,hp:Math.sin(t*.7*sp)*.05,hr:0,wagA:m.wag,wagS:3.5*sp,roll:0,crouch:0,bob:0,shake:0,lean:0,pitch:0,back:0,hop:0,wing:.05,wingS:2.4};
  if(act==='look')Object.assign(X,{hy:V.actSide*.3*ap,hp:-.08*ap,hr:V.actSide*.06*ap,byaw:V.actSide*.3*ap});
  if(act==='sniff')Object.assign(X,{hp:.28*ap,hy:Math.sin(t*7)*.1*ap,pitch:.07*ap});
  if(act==='hop')Object.assign(X,{hop:ap,wagA:m.wag*2,wagS:9*sp,wing:.3});
  if(act==='stretch')Object.assign(X,{crouch:.85*ap,pitch:.1*ap,hp:-.25*ap});
  if(act==='sit')Object.assign(X,{pitch:-.13*ap,crouch:.35*ap,hp:-.1*ap});
  if(act==='wag')Object.assign(X,{wagA:m.wag*2.6,wagS:11*sp,hy:toCam*.25*ap,byaw:toCam*.25*ap});
  if(act==='flap')Object.assign(X,{wing:.6*ap,wingS:9,hp:-.1*ap});
  if(st==='pet')Object.assign(X,{hy:toCam*.28,hp:.08,hr:.12*V.side,byaw:toCam*.3,wagA:m.wag*2.4,wagS:12*sp,bob:1,lean:V.side*.1,wing:.3,wingS:8});
  if(st==='scratch')Object.assign(X,{hy:.15,hp:-.12,hr:.1,wagA:m.wag*2,wagS:11*sp,shake:.3,lean:-.08,bob:.6,wing:.2,wingS:10});
  if(st==='tail')Object.assign(X,{hy:(V.ry>0?-1:1)*.32,byaw:(V.ry>0?-1:1)*.35,wagA:m.wag*2.8,wagS:10*sp,lean:(V.ry>0?-1:1)*.06});
  if(st==='hurt'){Object.assign(X,{hy:Math.max(-.35,Math.min(.35,-toCam*.4+.2)),byaw:Math.max(-.45,Math.min(.45,-toCam*.5+.25)),hp:.2,hr:0,wagA:0,crouch:.9,back:el<.3?.2:.12,wing:0});if(el<.3){X.hy=toCam*.3;X.byaw=0}
    if(el>1.5)Object.assign(X,{hr:Math.sin(t*9)*.12,crouch:.5})}
  if(st==='belly')Object.assign(X,{hy:.12,hp:-.1,hr:.08,wagA:m.wag*2,wagS:8,roll:Math.PI,wing:.25,wingS:7});
  if(st==='tired')Object.assign(X,{hy:.1,hp:.32,hr:.2,wagA:m.wag*.25,wagS:2,roll:Math.PI*.46,crouch:.6,wing:0,wingS:1,bob:0});
  if(st==='shake'&&el>.45)X.shake=1;
  if(st==='run')Object.assign(X,{hy:0,hp:-.12,hr:0,wagA:m.wag*2.6,wagS:16,wing:.55,wingS:13});
  if(st==='eat'){Object.assign(X,{hy:0,hp:.1+Math.sin(t*16)*.12,wagA:m.wag*2,wagS:9*sp,byaw:0,bob:.5,wing:.25,wingS:7});V.ry+=(-.18-V.ry)*Math.min(1,dt*3)}
  const k=Math.min(1,dt*6*sp),kr=Math.min(1,dt*(st==='run'?7:2.5*sp)),kf=Math.min(1,dt*9);
  for(const n of['hy','hp','hr','wagA','wagS','crouch','bob','shake','lean','pitch','wing','wingS','byaw'])G[n]=(G[n]||0)+(X[n]-(G[n]||0))*k;
  G.back=(G.back||0)+(X.back-(G.back||0))*kf;G.hop=(G.hop||0)+(X.hop-(G.hop||0))*kf;G.roll+=(X.roll-G.roll)*kr;
  V.wag+=dt*G.wagS;V.wph=(V.wph||0)+dt*G.wingS;
  C.U.uHY.value=G.hy;C.U.uHP.value=G.hp;C.U.uHR.value=G.hr+(st==='hurt'&&el<1?Math.sin(t*40)*.04:0);C.U.uTail.value=Math.sin(V.wag)*G.wagA;
  if(C.U.uWing)C.U.uWing.value=G.wing*Math.sin(V.wph)*(m.wing?m.wing.a:0);
  const shk=G.shake*Math.sin(t*28)*.25*(st==='shake'?Math.max(0,1-(el-.45)/1.1):1);
  if(C.parts){const q=C.parts;q.hpG.rotation.set(C.U.uHP.value,C.U.uHY.value,C.U.uHR.value);q.tpG.rotation.y=C.U.uTail.value*1.1;
    const fl=(m.wing||q.xw)?(st==='pet'||st==='scratch'?.5:.18):0;for(const w of q.wings)w.w.rotation.z=w.z+w.s*Math.sin(t*(st==='idle'?3:9)*sp)*fl}
  // squash keeps the feet on the floor (scale is taken around the middle of the body)
  const br=Math.sin(t*2.2*sp)*.015,sy=1+br-G.crouch*.1;
  C.roll.scale.set(1+G.crouch*.05,sy,1+G.crouch*.03);
  C.roll.rotation.z=G.roll+shk+G.lean*(1-G.roll/Math.PI);C.roll.rotation.x=G.pitch;C.roll.rotation.y=G.byaw*(1-G.roll/Math.PI);
  const hopY=act==='hop'?Math.abs(Math.sin(ae*Math.PI*1.6))*.16*G.hop:0;
  C.roll.position.y=C.h/2*sy+(st==='belly'?.04:0)+G.bob*Math.abs(Math.sin(t*7))*.05+hopY+Math.abs(G.pitch)*C.h*.25+(C.wx?(C.wx/2-C.h/2*sy)*Math.max(0,Math.sin(Math.min(G.roll,Math.PI/2))):0)+(st==='tired'?Math.sin(t*2.4)*.008:0);
  V.ry+=V.vy;V.vy*=.92;V.spin.rotation.y=V.ry;V.spin.rotation.x=V.rx*.6;
  if(st==='run'){const r=runPose(el,V.until-V.stT);C.root.position.x=r.x;C.root.position.z=r.z;C.root.rotation.y=r.yaw;C.roll.position.y+=Math.abs(Math.sin(t*14))*.1*r.sp;C.roll.rotation.x=Math.sin(t*14)*.07*r.sp}
  else{C.root.position.x*=.8;C.root.position.z+=(-G.back-C.root.position.z)*.25;C.root.rotation.y*=.8}
  popTick(C);stage(t);
  V.renderer.render(V.scene,V.cam);
  if(V.open&&V.mode==='glb')V.raf=requestAnimationFrame(gloop);
}

/* ---------- viewer ---------- */
// ---------- element floor under the plush ----------
const ELEM=GD.pelucias.ELEM;
const FLOORS=GD.modelos.FLOORS;
function floorTex(el){if(FLOORS[el])return FLOORS[el];
  const S=512,c=document.createElement('canvas');c.width=c.height=S;const x=c.getContext('2d'),g=document.createElement('canvas');g.width=g.height=S;const gx=g.getContext('2d');
  let seed=el.length*977+el.charCodeAt(0)*31;const R=()=>{seed=(seed*16807)%2147483647;return seed/2147483647};
  const P={earth:['#7a5a3a','#5e4630'],water:['#2f7fb8','#1d5a8c'],embers:['#3a2620','#221612'],cloud:['#9fb0cc','#7486a8'],shadow:['#2a2236','#16121e'],flowers:['#6f9a3c','#4f7a2a'],
    ice:['#d8ecfa','#a9cdea'],electric:['#3a3d4a','#24262f'],lava:['#3a2a26','#1c1412'],stars:['#1d2350','#0c1030'],leaves:['#5e6e34','#3e4a22'],stone:['#8e8a82','#6a665f'],
    sand:['#e2cfa0','#c8b07c'],petals:['#f6dbe8','#e8bfd4'],swamp:['#3e5228','#26341a'],gold:['#f3ead8','#d9c8a4']}[el];
  const rg=x.createRadialGradient(S/2,S/2,10,S/2,S/2,S/2);rg.addColorStop(0,P[0]);rg.addColorStop(1,P[1]);x.fillStyle=rg;x.fillRect(0,0,S,S);
  const dots=(n,cols,r0,r1,a)=>{for(let i=0;i<n;i++){x.globalAlpha=a||.35;x.fillStyle=cols[i%cols.length];x.beginPath();x.arc(R()*S,R()*S,r0+R()*(r1-r0),0,7);x.fill()}x.globalAlpha=1};
  const crack=(ctx,col,w,n,len,glow)=>{ctx.strokeStyle=col;ctx.lineWidth=w;ctx.lineCap='round';if(glow){ctx.shadowColor=col;ctx.shadowBlur=glow}
    for(let i=0;i<n;i++){let px=R()*S,py=R()*S,a=R()*6.3;ctx.beginPath();ctx.moveTo(px,py);for(let k=0;k<len;k++){a+=(R()-.5)*1.3;px+=Math.cos(a)*9;py+=Math.sin(a)*9;ctx.lineTo(px,py)}ctx.stroke()}ctx.shadowBlur=0};
  const blades=(n,cols,h)=>{x.lineWidth=2;for(let i=0;i<n;i++){const px=R()*S,py=R()*S,a=-1.57+(R()-.5)*.9,l=h*(.5+R());x.strokeStyle=cols[i%cols.length];x.globalAlpha=.7;x.beginPath();x.moveTo(px,py);x.quadraticCurveTo(px+Math.cos(a)*l*.5+3,py+Math.sin(a)*l*.5,px+Math.cos(a)*l,py+Math.sin(a)*l);x.stroke()}x.globalAlpha=1};
  const flower=(px,py,r,col)=>{x.fillStyle=col;for(let k=0;k<5;k++){const a=k/5*6.28;x.beginPath();x.arc(px+Math.cos(a)*r,py+Math.sin(a)*r,r*.75,0,7);x.fill()}x.fillStyle='#ffd23a';x.beginPath();x.arc(px,py,r*.6,0,7);x.fill()};
  let glow=false;dots(5000,['#000','#fff'],.6,1.8,.07);
  switch(el){
    case'earth':dots(260,['#4a3420','#8f6e48','#6b4e32'],3,9,.5);for(let i=0;i<18;i++){const px=R()*S,py=R()*S;x.save();x.translate(px,py);x.globalAlpha=.85;x.fillStyle='#5f7f30';x.beginPath();x.ellipse(0,0,22+R()*30,12+R()*18,R()*3,0,7);x.fill();x.restore();x.globalAlpha=1}blades(900,['#6f9a3c','#86b04a','#4f7a2a'],12);break;
    case'water':for(let i=0;i<40;i++){x.strokeStyle='rgba(255,255,255,'+(.08+R()*.18)+')';x.lineWidth=1+R()*2;x.beginPath();x.ellipse(R()*S,R()*S,10+R()*60,5+R()*25,R()*3,0,7);x.stroke()}crack(x,'rgba(160,220,255,.35)',2,30,14);break;
    case'embers':dots(400,['#151010','#4a3328'],2,8,.6);crack(gx,'#ff6a1a',2,10,10,5);for(let i=0;i<140;i++){gx.fillStyle=['#ff9a2a','#ffd23a','#ff5a14'][i%3];gx.beginPath();gx.arc(R()*S,R()*S,1+R()*3,0,7);gx.fill()}glow=true;break;
    case'cloud':for(let i=0;i<70;i++){const px=R()*S,py=R()*S,r=18+R()*40,q=x.createRadialGradient(px,py,1,px,py,r);q.addColorStop(0,'rgba(255,255,255,.9)');q.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=q;x.fillRect(px-r,py-r,2*r,2*r)}dots(200,['#b9c9e6'],4,12,.2);break;
    case'shadow':dots(500,['#120e18','#3a2e4a'],3,10,.5);for(let i=0;i<30;i++){const px=R()*S,py=R()*S,r=30+R()*60,q=x.createRadialGradient(px,py,1,px,py,r);q.addColorStop(0,'rgba(138,60,240,.22)');q.addColorStop(1,'rgba(138,60,240,0)');x.fillStyle=q;x.fillRect(px-r,py-r,2*r,2*r)}break;
    case'flowers':blades(1500,['#7fae44','#5a8a30','#9cc45a'],13);for(let i=0;i<70;i++)flower(R()*S,R()*S,3+R()*3,['#f6a6c6','#ffffff','#ffd23a','#c9a6f6'][i%4]);break;
    case'petals':dots(300,['#ffffff','#f7c6da'],3,8,.5);for(let i=0;i<120;i++){x.save();x.translate(R()*S,R()*S);x.rotate(R()*6.3);x.fillStyle=['#f6a6c6','#f27aa8','#ffffff','#d9c4ff'][i%4];x.globalAlpha=.8;x.beginPath();x.ellipse(0,0,6,3,0,0,7);x.fill();x.restore()}x.globalAlpha=1;
      for(let i=0;i<60;i++){gx.fillStyle='#fff';gx.beginPath();gx.arc(R()*S,R()*S,1+R()*1.5,0,7);gx.fill()}glow=true;break;
    case'ice':crack(x,'rgba(255,255,255,.75)',1.5,26,12);dots(300,['#ffffff','#8ec2ea'],2,7,.4);for(let i=0;i<90;i++){gx.fillStyle='#e8f6ff';gx.beginPath();gx.arc(R()*S,R()*S,1+R()*1.8,0,7);gx.fill()}glow=true;break;
    case'electric':for(let i=0;i<40;i++){x.strokeStyle='rgba(0,0,0,.35)';x.lineWidth=2;x.strokeRect(R()*S,R()*S,30+R()*50,30+R()*50)}crack(gx,'#ffe14a',2,14,9,6);glow=true;break;
    case'lava':dots(700,['#120c0a','#4a3a34','#2a1e1a'],3,12,.6);crack(gx,'#ff5a14',2.5,16,12,6);crack(gx,'#ffc23a',1.2,10,8,3);glow=true;break;
    case'stars':dots(500,['#ffffff'],.6,1.6,.7);for(let i=0;i<60;i++){gx.fillStyle=['#ffffff','#9cc4ff','#f2c84a'][i%3];gx.beginPath();gx.arc(R()*S,R()*S,1+R()*2.2,0,7);gx.fill()}glow=true;break;
    case'leaves':dots(300,['#2e3818','#6e7e40'],3,10,.5);for(let i=0;i<260;i++){x.save();x.translate(R()*S,R()*S);x.rotate(R()*6.3);x.fillStyle=['#8a6a2a','#a8843a','#6e8a3a','#5a4420'][i%4];x.globalAlpha=.85;x.beginPath();x.ellipse(0,0,10,4.5,0,0,7);x.fill();x.restore()}x.globalAlpha=1;break;
    case'stone':for(let i=0;i<120;i++){const px=R()*S,py=R()*S,r=12+R()*22;x.fillStyle=['#9a958c','#7d7870','#a8a39a','#86817a'][i%4];x.beginPath();x.ellipse(px,py,r,r*.8,R()*3,0,7);x.fill();x.strokeStyle='rgba(40,36,32,.5)';x.lineWidth=2;x.stroke()}dots(80,['#6f8a2c'],4,10,.5);break;
    case'sand':dots(1500,['#b89c68','#f2e2b8','#a88a58'],.8,2.2,.5);for(let i=0;i<24;i++){const col=['#f26a8a','#ff9a3a','#c45ad8','#ffffff'][i%4];x.fillStyle=col;x.save();x.translate(R()*S,R()*S);x.rotate(R()*6.3);x.beginPath();x.ellipse(0,0,6,4,0,0,7);x.fill();x.restore()}
      for(let i=0;i<14;i++){x.strokeStyle='rgba(80,160,220,.25)';x.lineWidth=3;x.beginPath();x.ellipse(R()*S,R()*S,20+R()*40,8+R()*14,R()*3,0,7);x.stroke()}break;
    case'swamp':dots(500,['#1a2410','#4e6a2c'],3,12,.5);for(let i=0;i<20;i++){x.fillStyle='rgba(30,50,30,.55)';x.beginPath();x.ellipse(R()*S,R()*S,20+R()*40,10+R()*20,R()*3,0,7);x.fill()}for(let i=0;i<50;i++){gx.strokeStyle='#9be05a';gx.lineWidth=1.5;gx.beginPath();gx.arc(R()*S,R()*S,2+R()*4,0,7);gx.stroke()}glow=true;break;
    case'gold':x.strokeStyle='rgba(180,140,70,.55)';x.lineWidth=3;for(let r=40;r<S/2;r+=46){x.beginPath();x.arc(S/2,S/2,r,0,7);x.stroke()}for(let a=0;a<16;a++){x.beginPath();x.moveTo(S/2,S/2);x.lineTo(S/2+Math.cos(a/16*6.28)*S/2,S/2+Math.sin(a/16*6.28)*S/2);x.stroke()}
      crack(x,'rgba(150,130,110,.25)',1,20,10);for(let i=0;i<40;i++){gx.fillStyle='#ffd77a';gx.beginPath();gx.arc(R()*S,R()*S,1+R()*2,0,7);gx.fill()}glow=true;break;
  }
  const mask=(ctx)=>{ctx.globalCompositeOperation='destination-in';const m=ctx.createRadialGradient(S/2,S/2,S*.3,S/2,S/2,S/2);m.addColorStop(0,'rgba(0,0,0,1)');m.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=m;ctx.fillRect(0,0,S,S);ctx.globalCompositeOperation='source-over'};
  mask(x);const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.anisotropy=4;
  let e=null;if(glow){mask(gx);e=new THREE.CanvasTexture(g);e.encoding=THREE.sRGBEncoding}
  return FLOORS[el]={map:t,glow:e}}
function setFloor(i){const el=ELEM[i]||'earth',f=floorTex(el),m=V.floor.material;m.map=f.map;m.emissiveMap=f.glow;m.emissive.set(f.glow?0xffffff:0x000000);m.emissiveIntensity=f.glow?1:0;
  m.roughness=el==='water'||el==='ice'?.35:.95;m.needsUpdate=true;V.floorEl=el}
function castAll(root){root.traverse(o=>{if(o.isMesh&&!o.userData.shell&&!(o.material&&o.material.transparent)){o.castShadow=true}})}
// run in circles (swipe up on the plush)
function runPose(el,dur){const u=Math.min(1,el/dur),e=Math.max(0,Math.min(1,(u-.08)/.84)),a=2*Math.PI*2*(e-Math.sin(2*Math.PI*e)/(2*Math.PI)),R=.55*Math.min(1,e*5,(1-e)*5);
  return{x:-R+R*Math.cos(a),z:R*Math.sin(a),yaw:-a,on:e>0&&e<1,sp:Math.sin(Math.PI*e)}}
const _wp=new THREE.Vector3();
function popTick(C){if(!V.pop||!C.gs)return;const u=(performance.now()-V.pop)/900;if(u<1)C.root.scale.setScalar(C.gs*(u<.3?.55+u/.3*.7:1+.2*Math.sin((u-.3)/.7*Math.PI*2)*(1-u)));else{C.root.scale.setScalar(C.gs);V.pop=0}}
function stage(t){tickFood();tickAura(t);// floor turns with the plush, shadow follows it
  const run=V.st==='run',K=V.runK=(V.runK||1)+((run?.7:1)-(V.runK||1))*.06;
  V.spin.scale.setScalar(V.k*K);V.spin.position.y=V.ground+V.k*K;
  V.floor.rotation.z=V.ry;V.floor.scale.setScalar(V.floorR*K);V.floor.position.y=V.ground;
  if(V.floorEl&&V.floor.material.emissiveMap)V.floor.material.emissiveIntensity=.55+Math.sin(t*2.2)*.2;
  V.C.root.getWorldPosition(_wp);V.shadow.position.x=_wp.x;V.shadow.position.z=_wp.z;V.shadow.position.y=V.ground+.012;
  V.shadow.scale.set(V.size.xz*V.k*K*.95,V.size.xz*V.k*K*.7,1)}
function shadowTex(){const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');
  const g=x.createRadialGradient(64,64,4,64,64,62);g.addColorStop(0,'rgba(0,0,0,.8)');g.addColorStop(.3,'rgba(0,0,0,.5)');g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(0,0,128,128);return new THREE.CanvasTexture(c)}
function initViewer(){
  if(V.renderer)return true;if(!window.THREE)return false;
  const cvs=$('v3d');try{V.renderer=new THREE.WebGLRenderer({canvas:cvs,antialias:true,alpha:true})}catch(e){return false}
  V.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));V.renderer.outputEncoding=THREE.sRGBEncoding;
  V.scene=new THREE.Scene();V.cam=new THREE.PerspectiveCamera(36,1,.1,50);V.cam.position.set(0,.35,6);V.cam.lookAt(0,-.15,0);
  V.scene.add(new THREE.HemisphereLight(0xfff4ee,0x40202e,.85));
  V.renderer.shadowMap.enabled=true;V.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const key=new THREE.DirectionalLight(0xffffff,1.05);key.position.set(2.5,5,3);key.castShadow=true;key.shadow.mapSize.set(1024,1024);
  Object.assign(key.shadow.camera,{left:-3,right:3,top:3,bottom:-3,near:.5,far:20});key.shadow.bias=-.0015;key.shadow.normalBias=.02;key.shadow.radius=4;V.scene.add(key);V.key=key;
  const fill=new THREE.DirectionalLight(0xffe2c8,.35);fill.position.set(-3,1,3);V.scene.add(fill);
  const rim=new THREE.DirectionalLight(0xff9cc4,.55);rim.position.set(-2,2,-4);V.scene.add(rim);
  V.spin=new THREE.Group();V.scene.add(V.spin);
  V.shadow=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:shadowTex(),transparent:true,depthWrite:false}));V.shadow.rotation.x=-Math.PI/2;V.shadow.renderOrder=2;V.scene.add(V.shadow);
  V.floor=new THREE.Mesh(new THREE.CircleGeometry(1,64),new THREE.MeshStandardMaterial({color:0xffffff,transparent:true,depthWrite:false,roughness:.95}));V.floor.rotation.x=-Math.PI/2;V.floor.receiveShadow=true;V.floor.renderOrder=1;V.scene.add(V.floor);
  V.ray=new THREE.Raycaster();
  let down=null,moved=false,lp=0;
  cvs.addEventListener('pointerdown',e=>{e.preventDefault();audio();try{cvs.setPointerCapture(e.pointerId)}catch(_){}
    if(V.mode==='terra'){tDown(e);return}
    down={x:e.clientX,y:e.clientY,t:performance.now(),lx:e.clientX,ly:e.clientY,rx:V.rx,ry:V.ry,onC:!!hit(e)};moved=false;
    clearTimeout(lp);lp=setTimeout(()=>{if(down&&!moved&&hit(e))setState('belly',1e9)},550)});
  cvs.addEventListener('pointermove',e=>{if(V.mode==='terra'){tMove(e);return}if(!down)return;const dx=e.clientX-down.lx,dy=e.clientY-down.ly;
    if(Math.hypot(e.clientX-down.x,e.clientY-down.y)>9){moved=true;clearTimeout(lp)}
    if(moved&&V.st!=='belly'){V.vy=dx*.011;V.ry+=dx*.011;V.rx=Math.max(-.35,Math.min(.6,V.rx+dy*.006))}
    down.lx=e.clientX;down.ly=e.clientY});
  const up=e=>{if(V.mode==='terra'){tUp(e);return}if(!down)return;clearTimeout(lp);const dt=performance.now()-down.t;
    const sx=e.clientX-down.x,sy=e.clientY-down.y;
    if(V.st==='belly'){setState('shake',1.5);playShake()}
    else if(moved&&down.onC&&sy<-50&&Math.abs(sy)>Math.abs(sx)*1.4&&dt<1200&&V.st!=='run'){V.rx=down.rx;V.ry=down.ry;V.vy=0;setState('run',4.2);float('💨','love',e);[523,659,784,1047].forEach((f,k)=>setTimeout(()=>tone(f,.07,'square',.04),k*70));careGain(V.cur,'p',30)}
    else if(!moved&&dt<350){const part=hit(e);if(part)tap(part,e)}down=null};
  cvs.addEventListener('pointerup',up);cvs.addEventListener('pointercancel',e=>{if(V.mode==='terra'){tUp(e);return}clearTimeout(lp);if(V.st==='belly')setState('shake',1.5);down=null});
  addEventListener('resize',()=>V.open&&fit());
// a área do bicho muda de tamanho quando os botões de baixo aparecem/somem: sem reajustar, a imagem esticava
if(window.ResizeObserver){new ResizeObserver(()=>{if(V.open&&V.renderer)fit()}).observe($('v3d'))}
  return true;
}
function hit(e){
  if(V.mode==='glb')return hitGLB(e);
  const r=$('v3d').getBoundingClientRect();V.ray.setFromCamera({x:(e.clientX-r.left)/r.width*2-1,y:-(e.clientY-r.top)/r.height*2+1},V.cam);
  const h=V.ray.intersectObject(V.C.root,true)[0];if(!h)return null;
  if(V.chibi){const lp=V.C.head.worldToLocal(h.point.clone());return V.C.headTest?(V.C.headTest(lp)?'head':'body'):lp.y>-.22?'head':'body'}
  for(let o=h.object;o;o=o.parent)if(o.userData.part)return o.userData.part;return'body';
}
function fit(){
  const cvs=$('v3d'),w=cvs.clientWidth,h=cvs.clientHeight;if(!w||!h)return;
  V.renderer.setSize(w,h,false);V.cam.aspect=w/h;V.cam.updateProjectionMatrix();
  const visH=2*6*Math.tan(18*Math.PI/180),visW=visH*V.cam.aspect;
  const gg=Math.max(1,(V.C&&V.C.gs)||1),Sxz=V.size.xz*gg,Sy=V.size.y*gg;
  const nar=visW<visH*1.2;// tela estreita (celular): o bicho ocupa mais da área
  const k=Math.min(visW*(nar?.86:.7)/Sxz,visH*(nar?.6:.5)/Sy,visW*(nar?.74:.62)/Math.max(Sy,1e-3));V.spin.scale.setScalar(k);
  const ground=-k*V.size.y/2-.15;V.spin.position.y=ground+k;V.k=k;V.ground=ground;V.floorR=Math.min(visW*.5,visH*.42,V.size.xz*k*1.15);
  V.shadow.position.y=ground+.01;V.shadow.scale.set(V.size.xz*k*1.1,V.size.xz*k*.8,1);
}
const GEST0='<span>Arraste: girar</span><span>Toque na cabeça: carinho</span><span>Toque no corpo: coçar</span><span>3 toques rápidos: fica bravo</span><span>Segure: barriga pra cima</span><span>Deslize pra cima nele: corre em círculos</span>';
const FOXID=2;
function openFoxViewer(i){if(!openFox(i)){detail(i);return}const p=PLUSH[i];$('gest').innerHTML=GEST0;$('vName').textContent=p.name;refreshVStats(i);$('vDesc').textContent=p.desc;
  $('viewer').hidden=false;V.open=true;document.body.style.overflow='hidden';fit();renderCare();cancelAnimationFrame(V.raf);V.last=performance.now();V.raf=requestAnimationFrame(vloop)}
function openChibiViewer(i){killAura();if(!openChibi(i,2)){detail(i);return}const p=PLUSH[i];$('gest').innerHTML=GEST0;$('vName').textContent=p.name;refreshVStats(i);$('vDesc').textContent=p.desc;
  $('viewer').hidden=false;V.open=true;document.body.style.overflow='hidden';fit();renderCare();cancelAnimationFrame(V.raf);V.last=performance.now();V.raf=requestAnimationFrame(vloop)}
function openViewer(i){
  vTags(i);if(i>=CH0){openChibiViewer(i);return}if(PROC[i]){openFoxViewer(i);return}try{if(!localStorage.getItem('garro-help')){$('gest').hidden=false;$('vHelp').setAttribute('aria-expanded',true);localStorage.setItem('garro-help','1')}}catch(e){}
  if(MODELS[i]){openGLB(i).then(ok=>{if(ok){const p=PLUSH[i];$('gest').innerHTML=GEST0;$('vName').textContent=p.name;refreshVStats(i);$('vDesc').textContent=p.desc;
    $('viewer').hidden=false;V.open=true;document.body.style.overflow='hidden';fit();renderCare();cancelAnimationFrame(V.raf);V.last=performance.now();V.raf=requestAnimationFrame(gloop)}else openProc(i)});return}
  openProc(i)}
function openProc(i){
  setDet(i);
  if(!initViewer()){detail(i);return}
  if(V.C){V.spin.remove(V.C.root)}if(V.T){V.spin.remove(V.T.root);V.T=null}V.mode='creature';$('gest').innerHTML=GEST0;
  const sp=SPEC[i],C=build(sp);V.C=C;V.sp=sp;
  try{projectPhoto(C,i,sp)}catch(e){}addFur(C.root,sp,C);
  setFloor(i);castAll(C.root);
  C.baseY=-1-C.feet;C.backY=-1+sp.s[1]*(sp.x.includes('shell')?1.5:1.02);C.root.position.y=C.baseY;V.spin.add(C.root);
  C.root.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(C.root),sz=box.getSize(new THREE.Vector3());
  V.size={xz:Math.max(sz.x,sz.z),y:sz.y};
  Object.assign(V,{ry:-.7,rx:.1,vy:0,st:'idle',until:0,taps:[],t0:performance.now(),blinkAt:1.5,blinkTo:0,wag:0,side:1,
    S:{lid:0,ear:0,tailX:0,wagA:.2,wagS:5,tongue:0,hx:0,hy:0,hz:0,crouch:0,roll:0,paddle:0,scratch:0,shake:0,brow:0,flap:0}});
  const p=PLUSH[i];$('vName').textContent=p.name;$('vStats').textContent=p.cm+' cm · '+p.g+' g · pego '+(coll[i]||0)+'x';$('vDesc').textContent=p.desc;
  $('viewer').hidden=false;V.open=true;document.body.style.overflow='hidden';fit();
  cancelAnimationFrame(V.raf);V.last=performance.now();V.raf=requestAnimationFrame(vloop);
}
function closeViewer(){killAura();if(FOOD){V.scene.remove(FOOD.g);FOOD=null}$('vEvo').classList.remove('on');$('viewer').hidden=true;V.open=false;document.body.style.overflow='';cancelAnimationFrame(V.raf)}
function setState(s,dur){if(MOODS[s])mood(MOODS[s]);V.st=s;V.until=(performance.now()-V.t0)/1000+dur;V.stT=(performance.now()-V.t0)/1000;
  if(s==='belly'){float('✨','love');[988,1175,1318,1175,1480].forEach((f,k)=>setTimeout(()=>tone(f,.09,'triangle',.06),k*80))}}
function float(txt,cls,e){
  const box=$('viewer').getBoundingClientRect(),s=document.createElement('span');s.className='fx '+cls;s.textContent=txt;
  s.style.left=((e?e.clientX:box.left+box.width/2)-box.left+(Math.random()-.5)*40)+'px';s.style.top=((e?e.clientY:box.top+box.height/2)-box.top-20)+'px';
  $('viewer').appendChild(s);setTimeout(()=>s.remove(),1300);
}
function growl(){if(!ac)return;try{const o=ac.createOscillator(),l=ac.createOscillator(),g=ac.createGain(),lg=ac.createGain(),f=ac.createBiquadFilter();
  o.type='sawtooth';o.frequency.value=92;f.type='lowpass';f.frequency.value=420;l.frequency.value=26;lg.gain.value=.05;g.gain.value=.07;
  l.connect(lg).connect(g.gain);o.connect(f).connect(g).connect(ac.destination);const t=ac.currentTime;g.gain.setTargetAtTime(0,t+.55,.08);o.start();l.start();o.stop(t+.9);l.stop(t+.9)}catch(e){}}
function playShake(){for(let k=0;k<8;k++)setTimeout(()=>tone(140+Math.random()*80,.05,'triangle',.05),500+k*55)}
function tap(part,e){
  const t=(performance.now()-V.t0)/1000;V.taps=V.taps.filter(x=>t-x<.9);V.taps.push(t);
  if(V.taps.length>=3||(V.st==='hurt'&&t<V.until)){
    setState('hurt',2.8);V.snap=t;float('💢','mad',e);growl();if(V.taps.length>3)setTimeout(()=>{tone(420,.08,'square',.08);setTimeout(()=>tone(300,.1,'square',.07),70)},250);
  }else if(V.st==='belly'||V.st==='shake'){}
  else if(part==='head'){setState('pet',2.2);V.side=Math.random()<.5?-1:1;float('❤','love',e);if(t-(V.lc||-9)>.7){V.lc=t;careGain(V.cur,'l',12)}
    tone(620,.25,'sine',.06);setTimeout(()=>tone(880,.3,'sine',.05),180)}
  else if(part==='tail'&&V.mode==='glb'){setState('tail',2);tone(260,.15,'sine',.06)}
  else{setState('scratch',2.2);float('❤','love',e);if(t-(V.lc||-9)>.7){V.lc=t;careGain(V.cur,'l',8)}for(let k=0;k<7;k++)setTimeout(()=>tone(75,.07,'sine',.2),150+k*95)}
}
function vloop(now){
  const dt=Math.min(.05,(now-V.last)/1000),t=(now-V.t0)/1000;V.last=now;FURTIME.value=t;
  const C=V.C,S=V.S,T={lid:0,ear:0,tailX:0,wagA:.22,wagS:5,tongue:0,hx:Math.sin(t*.7)*.08,hy:Math.sin(t*.45)*.35+Math.sin(t*1.3)*.05,hz:0,crouch:0,roll:0,paddle:0,scratch:0,shake:0,brow:0,flap:.1};
  if(V.st!=='idle'&&V.st!=='belly'&&t>V.until)V.st='idle';
  const st=V.st,el=t-(V.stT||0);
  if(st==='idle'){if(t>V.blinkAt){V.blinkTo=t+.13;V.blinkAt=t+2.5+Math.random()*3}if(t<V.blinkTo)T.lid=1;
    if(Math.sin(t*.23)>.92)T.tongue=.6}
  if(st==='pet')Object.assign(T,{lid:.92,ear:-.45,tailX:.15,wagA:.75,wagS:17,tongue:1,hx:-.28,hy:.1*V.side,hz:.32*V.side});
  if(st==='scratch')Object.assign(T,{lid:.75,ear:-.25,tailX:.15,wagA:.7,wagS:15,tongue:1,hx:-.32,hy:0,hz:.12,scratch:1});
  if(st==='hurt'){Object.assign(T,{lid:.48,ear:-1.15,tailX:-1.25,wagA:0,wagS:5,tongue:0,hx:.35,hy:.75,hz:-.1,crouch:1,brow:1});
    if(t-V.snap<.35)Object.assign(T,{hy:-.1,hx:-.05,crouch:.4})}
  if(st==='tired')Object.assign(T,{lid:.62,ear:-.9,tailX:-.2,wagA:.05,wagS:2,hx:.2,hy:.1,hz:.25,roll:Math.PI*.42,paddle:0,flap:0});
  if(st==='belly')Object.assign(T,{lid:.88,ear:-.7,tailX:-.3,wagA:.85,wagS:11,tongue:1,hx:-.25,hy:.35,hz:.2,roll:Math.PI,paddle:1,flap:0});
  if(st==='shake'){Object.assign(T,{lid:.3,ear:0,tailX:.3,wagA:.5,wagS:9,tongue:.5});if(el>.45)T.shake=1}
  if(st==='run')Object.assign(T,{lid:.1,ear:-.5,tailX:.4,wagA:0,wagS:5,tongue:1,hx:-.15,hy:0,hz:0});
  if(st==='eat'){Object.assign(T,{lid:.3,ear:.15+Math.sin(t*16)*.1,tailX:.2,wagA:.7,wagS:12,tongue:.6+.4*Math.sin(t*15),hx:.1+Math.sin(t*16)*.2,hy:0,hz:0,crouch:.1});V.ry+=(-.18-V.ry)*Math.min(1,dt*3)}
  const k=Math.min(1,dt*7),k2=Math.min(1,dt*(st==='belly'||st==='shake'?3.2:7));
  for(const n in S)S[n]+=(T[n]-S[n])*(n==='roll'?k2:k);
  V.wag+=dt*S.wagS;
  // turntable
  if(st==='pet'||st==='scratch')V.ry+=(-.35-V.ry)*dt*2;
  V.ry+=V.vy;V.vy*=.92;V.spin.rotation.y=V.ry;V.spin.rotation.x=V.rx*.6;
  // body
  const shakeOsc=S.shake*Math.sin(el*30)*.45*Math.max(0,1-(el-.45)/1);
  C.root.rotation.z=S.roll+shakeOsc;
  C.root.position.y=C.baseY+(C.backY-C.baseY)*(S.roll/Math.PI)-S.crouch*.14+(st==='belly'?Math.sin(t*3)*.02:0);
  C.root.position.x=st==='hurt'?Math.sin(t*55)*.01:0;
  C.body.scale.set(1+S.crouch*.03,1-S.crouch*.07+Math.sin(t*2.4)*.012,1);
  C.body.rotation.y=st==='belly'?Math.sin(t*2.6)*.12:0;
  C.head.rotation.set(S.hx,S.hy,S.hz+(st==='shake'?shakeOsc*.6:0));
  C.ears.forEach((g,i)=>{g.rotation.x=S.ear+(st==='shake'?Math.sin(el*30+i)*.6*S.shake:0)+(st==='idle'&&Math.sin(t*1.7+i*2)>.97?-.3:0)});
  C.tail.rotation.y=Math.sin(V.wag)*S.wagA;
  C.tail.rotation.x=C.tailBase+S.tailX;
  C.segs.forEach((g,i)=>{if(i)g.rotation.y=(V.sp.tl==='zig'?(i%2?.6:-.6):0)+Math.sin(V.wag-i*.7)*S.wagA*.45});
  C.legs.forEach((g,i)=>{let r=S.paddle*((g.userData.front?.9:-.6)+Math.sin(t*9+i*1.7)*.4);
    if(i===3||(V.sp.bird&&i===1))r+=S.scratch*(-.9+Math.sin(t*32)*.45);
    if(st==='hurt')r+=g.userData.front?-.15*S.crouch:.2*S.crouch;
    g.rotation.x=r});
  {const lo=C.lidOpen!==undefined?C.lidOpen:-1.25;C.lids.forEach(l=>l.rotation.x=lo+S.lid*(Math.PI/2-lo))}
  C.brows.forEach(b=>b.visible=S.brow>.5);
  C.tongue.visible=S.tongue>.05;C.tongue.scale.copy(C.tongue.userData.base).multiplyScalar(Math.max(.01,S.tongue));
  C.tongue.position.y=-V.sp.h*.5-Math.abs(Math.sin(t*9))*.015*S.tongue;
  C.wings.forEach((g,i)=>{const s=i?1:-1;g.rotation.z=s*(Math.sin(t*(st==='pet'||st==='scratch'?14:2.2))*(st==='pet'||st==='scratch'?.25:.05))});
  C.smoke.forEach((m,i)=>{m.position.y=m.userData.base.y+Math.sin(t*1.3+i)*.05});
  if(st==='run'){const r=runPose(el,V.until-V.stT);C.root.position.x=r.x;C.root.position.z=r.z;C.root.rotation.y=r.yaw;C.root.position.y+=Math.abs(Math.sin(t*15))*.09*r.sp;C.body.rotation.x=Math.sin(t*15)*.06*r.sp;
    C.legs.forEach((g,i)=>g.rotation.x=Math.sin(t*15+(i%2?Math.PI:0)+(i>1?.6:0))*.8*r.sp);C.tail.rotation.y=Math.sin(t*20)*.6;C.ears.forEach(g=>g.rotation.x=-.5*r.sp)}
  else{C.root.position.z+=(0-C.root.position.z)*.2;C.root.rotation.y*=.8;if(st!=='hurt')C.root.position.x*=.8;C.body.rotation.x*=.8}
  V.shadow.material.opacity=1-S.roll/Math.PI*.2;popTick(C);stage(t);
  V.renderer.render(V.scene,V.cam);
  if(V.open&&V.mode==='creature')V.raf=requestAnimationFrame(vloop);
}
$('vClose').addEventListener('click',closeViewer);
addEventListener('keydown',e=>{if(e.key==='Escape'&&V.open)closeViewer()});

/* ---------- Terranox: GLB-based validation model ---------- */
const TERRA={};
// personality: calm, sturdy reptile. Everything runs slower and heavier.
const TP=GD.modelos.TP;
function b64u8(s){const bin=atob(s),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return u}
function buildTerra(){
  const mat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.86,metalness:0});
  const parent={head:'body',eyeL:'head',eyeR:'head',legFL:'body',legFR:'body',legBL:'body',legBR:'body',tail0:'body'};
  for(let k=1;k<8;k++)parent['tail'+k]='tail'+(k-1);
  const tag=n=>n==='body'?'body':n==='head'||n.startsWith('eye')?'head':n.startsWith('leg')?'leg':'tail';
  const G={};
  for(const n in TERRA){const d=TERRA[n],g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(b64u8(d.p).buffer),3));
    const c8=b64u8(d.c),cf=new Float32Array(c8.length);for(let i=0;i<c8.length;i++)cf[i]=Math.pow(c8[i]/255,2.2);
    g.setAttribute('color',new THREE.BufferAttribute(cf,3));g.setIndex(new THREE.BufferAttribute(new Uint16Array(b64u8(d.i).buffer),1));g.computeVertexNormals();
    const m=new THREE.Mesh(g,mat);m.userData.part=tag(n);m.userData.leg=n.startsWith('leg')?n:null;
    const grp=new THREE.Group();grp.add(m);G[n]=grp}
  for(const n in TERRA){if(n==='body')continue;const p=TERRA[n].pivot,q=TERRA[parent[n]].pivot;G[n].position.set(p[0]-q[0],p[1]-q[1],p[2]-q[2]);G[parent[n]].add(G[n])}
  // eyelids + brows (added so the face can blink, relax and frown)
  const lidMat=new THREE.MeshStandardMaterial({color:new THREE.Color('#8e9d58').convertSRGBToLinear(),roughness:.9});
  const browMat=new THREE.MeshStandardMaterial({color:new THREE.Color('#3e4a24').convertSRGBToLinear(),roughness:.8});
  const lids=[],brows=[];
  for(const [n,s] of [['eyeL',-1],['eyeR',1]]){
    const lid=new THREE.Mesh(new THREE.SphereGeometry(.215,24,12,0,Math.PI*2,0,Math.PI/2),lidMat);lid.position.set(0,0,.05);G[n].add(lid);lids.push(lid);
    const brow=new THREE.Mesh(new THREE.BoxGeometry(.32,.07,.1),browMat);brow.position.set(0,.25,.1);brow.rotation.z=s*.45;brow.visible=false;G[n].add(brow);brows.push(brow);
  }
  const roll=new THREE.Group();roll.position.y=1.15;G.body.position.y=-1.15;roll.add(G.body);
  const root=new THREE.Group();root.add(roll);
  return {root,roll,G,lids,brows,tail:[0,1,2,3,4,5,6,7].map(k=>G['tail'+k]),legs:{FL:G.legFL,FR:G.legFR,BL:G.legBL,BR:G.legBR}};
}
const TS=GD.modelos.TS;
function tnow(){return (performance.now()-V.t0)/1000}
function tset(s,dur,extra){TS.st=s;TS.stT=tnow();TS.until=TS.stT+dur;Object.assign(TS,extra||{});TS.lastTouch=tnow()}
function openTerra(){
  if(!initViewer()){detail(0);return}
  if(V.C)V.spin.remove(V.C.root);if(V.T)V.spin.remove(V.T.root);
  V.mode='terra';V.T=buildTerra();V.C={root:V.T.root};V.spin.add(V.T.root);
  V.T.root.position.y=-1;V.T.root.updateMatrixWorld(true);
  const sz=new THREE.Box3().setFromObject(V.T.root).getSize(new THREE.Vector3());V.size={xz:Math.max(sz.x,sz.z)*.62,y:sz.y};
  Object.assign(V,{ry:-.75,rx:.12,vy:0,t0:performance.now(),taps:[]});
  Object.assign(TS,{st:'idle',until:0,stT:0,lastTouch:0,blinkAt:2,blinkTo:0,lookAt:4,lookY:0,walkAt:9,stroke:0,leg:null,wag:0,
    S:{lid:0,hx:0,hy:0,hz:0,bodyY:0,pitch:0,roll:0,tailX:0,tailAmp:.06,tailSpd:1.2,paddle:0,brow:0,tickle:0,walk:0,lift:0}});
  const p=PLUSH[0];$('vName').textContent=p.name;$('vStats').textContent=p.cm+' cm · '+p.g+' g · protótipo 3D';$('vDesc').textContent='Tranquilo e resistente. Movimentos lentos de réptil.';
  $('gest').innerHTML='<span>Arraste no fundo: girar</span><span>Deslize nele: carinho</span><span>Cabeça · barriga · patas · rabo: reações</span><span>3 toques: incomodado</span><span>Segure: barriga pra cima</span><span>Deslize pra cima nele: corre em círculos</span>';
  $('viewer').hidden=false;V.open=true;document.body.style.overflow='hidden';fit();
  cancelAnimationFrame(V.raf);V.last=performance.now();V.raf=requestAnimationFrame(tloop);
}
function tpart(e){
  const r=$('v3d').getBoundingClientRect();V.ray.setFromCamera({x:(e.clientX-r.left)/r.width*2-1,y:-(e.clientY-r.top)/r.height*2+1},V.cam);
  const h=V.ray.intersectObject(V.T.root,true)[0];if(!h)return null;
  let part=h.object.userData.part||'body';
  if(part==='body'){const lp=V.T.G.body.worldToLocal(h.point.clone());if(lp.y<.75)part='belly'}
  return {part,leg:h.object.userData.leg,point:h.point};
}
function tWake(){if(TS.st==='sleep'){tset('surprise',1.4);tone(520,.12,'sine',.06);setTimeout(()=>tone(700,.1,'sine',.05),90);return true}return false}
function tTap(hit,e){
  const t=tnow();V.taps=V.taps.filter(x=>t-x<1);V.taps.push(t);
  if(tWake())return;
  if(V.taps.length>=3||(TS.st==='annoyed'&&t<TS.until)){tset('annoyed',3.4);float('💢','mad',e);growl();return}
  if(V.taps.length===2&&hit.part!=='head'){tset('curious',1.8);float('❓','love',e);return}
  switch(hit.part){
    case'head':tset('pet',2.6);float('❤','love',e);tone(330,.3,'sine',.07);setTimeout(()=>tone(440,.35,'sine',.06),220);break;
    case'belly':tset('tickle',2.4);float('✨','love',e);[600,760,640,820,700].forEach((f,k)=>setTimeout(()=>tone(f,.08,'triangle',.05),k*110));break;
    case'leg':tset('paw',1.6,{leg:hit.leg});tone(200,.12,'sine',.08);break;
    case'tail':tset('tailTap',2.2);tone(260,.15,'sine',.06);break;
    default:tset('scratch',2.4);float('❤','love',e);for(let k=0;k<5;k++)setTimeout(()=>tone(70,.08,'sine',.18),150+k*160);
  }
}
let tdown=null,tlp=0;
function tDown(e){
  audio();const hit=tpart(e);tdown={x:e.clientX,y:e.clientY,lx:e.clientX,ly:e.clientY,t:performance.now(),hit,moved:false};
  clearTimeout(tlp);if(hit)tlp=setTimeout(()=>{if(tdown&&!tdown.moved){tWake();tset('belly',1e9);float('✨','love');[392,494,587,494,659].forEach((f,k)=>setTimeout(()=>tone(f,.12,'triangle',.06),k*110))}},600);
}
function tMove(e){
  if(!tdown)return;const dx=e.clientX-tdown.lx,dy=e.clientY-tdown.ly;
  if(Math.hypot(e.clientX-tdown.x,e.clientY-tdown.y)>9&&!tdown.moved){tdown.moved=true;clearTimeout(tlp)}
  if(tdown.moved){
    if(tdown.hit&&TS.st!=='belly'){ // stroking the plush
      TS.stroke+=Math.hypot(dx,dy);if(TS.st!=='stroke'){tWake();tset('stroke',1.2)}else TS.until=tnow()+1.2;
      if(TS.stroke>160){TS.stroke=0;float('❤','love',e);tone(300,.35,'sine',.05)}
    }else if(!tdown.hit){V.vy=dx*.011;V.ry+=dx*.011;V.rx=Math.max(-.35,Math.min(.6,V.rx+dy*.006))}
  }
  tdown.lx=e.clientX;tdown.ly=e.clientY;
}
function tUp(e){
  if(!tdown)return;clearTimeout(tlp);
  if(TS.st==='belly'){tset('shake',2.2)}
  else if(!tdown.moved&&performance.now()-tdown.t<350&&tdown.hit)tTap(tdown.hit,e);
  tdown=null;
}
function tloop(now){
  const dt=Math.min(.05,(now-V.last)/1000),t=tnow(),sp=TP.spd;V.last=now;
  const T=V.T,S=TS.S,G=T.G;
  if(TS.st!=='idle'&&TS.st!=='belly'&&TS.st!=='sleep'&&t>TS.until)TS.st='idle';
  if(TS.st==='idle'&&t-(TS.lastTouch||0)>16)tset('sleep',1e9);
  const st=TS.st,el=t-TS.stT;
  // look toward the player: undo the turntable yaw
  const toCam=Math.max(-.9,Math.min(.9,-V.ry));
  const X={lid:0,hx:.05,hy:0,hz:0,bodyY:Math.sin(t*1.1*sp)*.012,pitch:0,roll:0,tailX:0,tailAmp:.07,tailSpd:1.3,paddle:0,brow:0,tickle:0,walk:0,lift:0};
  if(st==='idle'){
    if(t>TS.blinkAt){TS.blinkTo=t+.22;TS.blinkAt=t+3.5+Math.random()*4}if(t<TS.blinkTo)X.lid=1;
    if(t>TS.lookAt){TS.lookY=Math.random()<.4?toCam:(Math.random()-.5)*1.1;TS.lookAt=t+4+Math.random()*4}
    X.hy=TS.lookY;X.hx=.05+Math.sin(t*.4)*.04;
    if(t>TS.walkAt){TS.walkUntil=t+3.2;TS.walkAt=t+14+Math.random()*10}
    if(t<(TS.walkUntil||0))X.walk=1;
  }
  if(st==='sleep')Object.assign(X,{lid:1,hx:.38,hy:.15,bodyY:-.06+Math.sin(t*.9)*.025,tailAmp:.02,tailSpd:.6});
  if(st==='surprise')Object.assign(X,{lid:-.35,hx:-.2,hy:toCam,bodyY:.05,tailX:.15,tailAmp:.15,tailSpd:4});
  if(st==='curious')Object.assign(X,{hx:-.1,hy:toCam,hz:.35*Math.sin(el*2),tailAmp:.12});
  if(st==='pet')Object.assign(X,{lid:el<.3?1:.8,hx:-.15,hy:toCam*.6,hz:.25,tailAmp:.35,tailSpd:3.2});
  if(st==='stroke')Object.assign(X,{lid:.9,hx:.12,hy:toCam*.3,hz:.12,bodyY:-.04,tailAmp:.3,tailSpd:2.4});
  if(st==='scratch')Object.assign(X,{lid:.7,hx:-.2,hz:.18,tailAmp:.4,tailSpd:3.5,lift:1});
  if(st==='tickle')Object.assign(X,{lid:.75,hx:-.25,tickle:1,tailAmp:.45,tailSpd:5,paddle:.5});
  if(st==='paw')Object.assign(X,{hy:TS.leg&&TS.leg.endsWith('L')?.5:-.5,hx:.25});
  if(st==='tailTap')Object.assign(X,{hy:(V.ry>0?-1:1)*.9,hx:.1,tailAmp:.6,tailSpd:4.5,tailX:.25});
  if(st==='annoyed'){Object.assign(X,{lid:.45,hx:.3,hy:-toCam*.9+.4,bodyY:-.08,tailX:-.15,tailAmp:.5,tailSpd:7,brow:1});if(el<.25)X.hy=toCam}
  if(st==='belly')Object.assign(X,{lid:.85,hx:-.2,hy:.3,roll:Math.PI,paddle:1,tailAmp:.3,tailSpd:2.6,bodyY:.12});
  if(st==='shake'){Object.assign(X,{lid:.3,tailAmp:.3,tailSpd:3});}
  const k=Math.min(1,dt*5*sp),kr=Math.min(1,dt*2.2*sp);
  for(const n in S)S[n]+=(X[n]-S[n])*(n==='roll'?kr:k);
  // turntable
  V.ry+=V.vy;V.vy*=.92;V.spin.rotation.y=V.ry;V.spin.rotation.x=V.rx*.6;
  // body: breathing, roll, shake (heavy, low frequency)
  const shake=st==='shake'&&el>.9?Math.sin(el*16)*.28*Math.max(0,1-(el-.9)/1.2):0;
  T.roll.rotation.z=S.roll+shake+(st==='tickle'?Math.sin(t*14)*.06:0);
  T.roll.position.y=1.15+S.bodyY;
  G.body.scale.set(1,1+Math.sin(t*1.1*sp)*.018,1+Math.sin(t*1.1*sp)*.008);
  G.head.rotation.set(S.hx+(st==='sleep'?Math.sin(t*.9)*.02:0),S.hy,S.hz);
  T.lids.forEach(l=>l.rotation.x=-.55+S.lid*(Math.PI/2+.55));T.brows.forEach(b=>b.visible=S.brow>.5);
  // tail: slow S-curve sway
  TS.wag+=dt*S.tailSpd;T.tail.forEach((g,i)=>{g.rotation.y=Math.sin(TS.wag-i*.45)*S.tailAmp*(i?.55:1);g.rotation.x=i===0?-S.tailX:0});
  // legs
  const L=T.legs,wk=S.walk,ph=t*3.2;
  const legSwing={FL:Math.sin(ph)*.28*wk,BR:Math.sin(ph)*.28*wk,FR:Math.sin(ph+Math.PI)*.28*wk,BL:Math.sin(ph+Math.PI)*.28*wk};
  for(const n in L){let r=legSwing[n];
    r+=S.paddle*((n[0]==='F'?-.7:.5)+Math.sin(t*6*sp+'FBRL'.indexOf(n[1])*1.7+(n[0]==='F'?0:2))*.35);
    if(n==='BR')r+=S.lift*(-.6+Math.sin(t*18)*.3);
    if(st==='paw'&&TS.leg==='leg'+n)r+=-.75*Math.sin(Math.min(1,el/1.6)*Math.PI);
    L[n].rotation.x=r;L[n].rotation.z=st==='paw'&&TS.leg==='leg'+n?(n[1]==='L'?-.25:.25)*Math.sin(Math.min(1,el/1.6)*Math.PI):0}
  if(wk>.05)T.roll.rotation.z+=Math.sin(ph)*.025*wk;
  if(st==='sleep'&&Math.floor(t/2.4)!==TS.zz){TS.zz=Math.floor(t/2.4);float('💤','love')}
  V.shadow.material.opacity=1;
  V.renderer.render(V.scene,V.cam);
  if(V.open&&V.mode==='terra')V.raf=requestAnimationFrame(tloop);
}

$('t3d')&&$('t3d').addEventListener('click',()=>{audio();openTerra()});

/* ---------- 15 bichinhos redondos (folha nova): construídos em código, com 3 estágios ---------- */
// b corpo, c focinho/barriga, a detalhe, e íris, f patinhas; ear/horn/extra descrevem as partes. m = manchas pintadas [x,y,z,rx,ry,rz,cor]
const CH_STAGES=GD.pelucias.CH_STAGES;
const CH=GD.pelucias.CH;

const CHF=GD.pelucias.CHF;
function mixc(a,b,t){const A=new THREE.Color(a),B=new THREE.Color(b);return '#'+A.lerp(B,t).getHexString()}
function chibiStage(xp){return xp>=CH_STAGES[2].xp?2:xp>=CH_STAGES[1].xp?1:0}
function sphChain(pts,r0,r1,col){const n=pts.length,pr=pts.map((p,i)=>{const r=r0+(r1-r0)*i/(n-1);return{c:p,r:[r,r,r],col,w:1}});return sdfMesh(pr,.035,.014,0)}
function curve(f,n){const a=[];for(let i=0;i<n;i++)a.push(f(i/(n-1)));return a}
function buildChibi(sp,stage){
  if(!SPH)SPH=new THREE.SphereGeometry(1,30,22);
  const S=CH_STAGES[stage],pf=S.pf,pale=S.pale,tn=c=>pale?mixc(c,'#efe6dc',pale):c;
  const body=grp(),root=grp(),C={root,body,ears:[],legs:[],eyes:[],lids:[],brows:[],segs:[],wings:[],smoke:[]};root.add(body);
  const RX=.64,RY=.56,RZ=.58,B=tn(sp.b),Cc=tn(sp.c),A=tn(sp.a);
  // head blob (the whole body): egg shaped, wider at the bottom, with painted markings and muzzle
  const prims=[{c:[0,.07,0],r:[.58,.52,.54],col:B},{c:[0,-.1,0],r:[.64,.5,.57],col:B,w:1}];
  prims.push({c:[0,-.17,.49],r:[.21,.15,.13],col:Cc,w:6,paint:1});
  if(sp.ear!=='fin')prims.push({c:[0,-.4,.28],r:[.34,.14,.26],col:Cc===B?B:mixc(B,Cc,.5),w:2,paint:1});
  if(stage>=1&&sp.m){const h0=sdfMesh(prims,.1,.03,.004),rc0=new THREE.Raycaster();
    for(const m of sp.m){const p=new THREE.Vector3(m[0],m[1],m[2]);rc0.set(p.clone().multiplyScalar(3),p.clone().negate().normalize());const h=rc0.intersectObject(h0,false)[0],c=h?h.point.clone().multiplyScalar(.97):p;
      prims.push({c:[c.x,c.y,c.z],r:[m[3],m[4],m[5]],col:tn(m[6]),w:stage>=2?16:6,paint:1})}}
  const head=P(grp(),0,0,0);head.userData.part='head';body.add(head);C.head=head;
  const hm=sdfMesh(prims,.1,.03,.004);head.add(hm);hm.updateMatrixWorld(true);const rc=new THREE.Raycaster();
  const hitAt=(o,d)=>{rc.set(o,d.clone().normalize().negate());const h=rc.intersectObject(hm,false)[0];return h?h.point:o.clone().multiplyScalar(.3)};
  // feet
  const fcol=tn(sp.f||sp.c);
  [[-.27,-.5,.3,1],[.27,-.5,.3,1],[-.34,-.48,-.22,0],[.34,-.48,-.22,0]].forEach(([x,y,z,fr])=>{const g=P(grp(),x,y+.12,z);g.userData.front=!!fr;
    g.add(P(ell(fcol,.17,.1,.2),0,-.12,fr?.04:0));if(fr)for(const tx of[-1,0,1])g.add(P(ell(mixc(fcol,'#000000',.18),.035,.03,.04),tx*.07,-.1,.2));body.add(g);C.legs.push(g)});
  C.feet=-.6;
  // eyes
  const er=.2*S.ef*(sp.es||1);
  for(const s of[-1,1]){
    const d=new THREE.Vector3(s*.43,.07,.9).normalize(),t=1/Math.sqrt((d.x/RX)**2+(d.y/RY)**2+(d.z/RZ)**2);
    const hp_=hitAt(d.clone().multiplyScalar(2),d),eo=P(grp(),hp_.x-d.x*.035,hp_.y-d.y*.035,hp_.z-d.z*.035);eo.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),d);head.add(eo);
    const eg=grp();eo.add(eg);
    eg.add(ell('#14101a',er*1.06,er*1.14,er*.55,{gloss:1}));
    eg.add(P(ell(sp.e,er*.86,er*.95,er*.55,{gloss:1}),0,0,er*.12));
    eg.add(P(ell(mixc(sp.e,'#ffffff',.45),er*.62,er*.2,er*.2,{gloss:1}),0,-er*.5,er*.5));
    eg.add(P(ell('#07060a',er*.52,er*.58,er*.4,{gloss:1}),0,er*.02,er*.4));
    const hl=new THREE.Mesh(SPH,new THREE.MeshBasicMaterial({color:0xffffff}));hl.scale.set(er*.22,er*.24,er*.18);P(hl,er*.32,er*.36,er*.74);eg.add(hl);
    const h2=new THREE.Mesh(SPH,new THREE.MeshBasicMaterial({color:0xffffff}));h2.scale.setScalar(er*.12);P(h2,-er*.3,-er*.28,er*.68);eg.add(h2);
    const lid=new THREE.Mesh(new THREE.SphereGeometry(er*1.16,20,10,0,Math.PI*2,0,Math.PI/2),M(B));lid.scale.set(1,1.1,1);lid.rotation.x=-1.95;eg.add(lid);C.lids.push(lid);
    const brow=new THREE.Mesh(new THREE.BoxGeometry(er*1.7,er*.32,er*.35),M('#2a1a1e',{gloss:1}));P(brow,0,er*1.3,er*.5);brow.rotation.z=s*.5;brow.visible=false;eg.add(brow);C.brows.push(brow);
  }
  // nose and w-shaped mouth
  const nz=.5,ny=-.1;const nzz=hitAt(new THREE.Vector3(0,-.1,2),new THREE.Vector3(0,0,1)).z;head.add(P(ell(sp.nose||'#e08a96',.055,.04,.04,{gloss:1}),0,-.1,nzz-.005));
  const tube=new THREE.MeshStandardMaterial({color:new THREE.Color(sp.mouth||'#5a3a3a').convertSRGBToLinear(),roughness:.6});
  for(const s of[-1,1]){const a=new THREE.Mesh(new THREE.TorusGeometry(.04,.0095,6,14,Math.PI),tube);a.rotation.z=Math.PI;const mz=hitAt(new THREE.Vector3(s*.04,-.185,2),new THREE.Vector3(0,0,1)).z;a.position.set(s*.042,-.17,mz+.004);a.rotation.y=s*.12;head.add(a)}
  const nl=new THREE.Mesh(new THREE.BoxGeometry(.009,.05,.009),tube);nl.position.set(0,-.145,hitAt(new THREE.Vector3(0,-.145,2),new THREE.Vector3(0,0,1)).z+.003);head.add(nl);
  const tg=P(ell('#ff7d9a',.05,.018,.07,{gloss:1}),0,-.22,hitAt(new THREE.Vector3(0,-.22,2),new THREE.Vector3(0,0,1)).z-.03);tg.userData.base=tg.scale.clone();tg.visible=false;head.add(tg);C.tongue=tg;
  if((sp.extra||[]).includes('fangs'))for(const s of[-1,1])head.add(P(R(cone('#ffffff',.018,.06,{gloss:1},8),Math.PI,0,0),s*.085,-.2,hitAt(new THREE.Vector3(s*.085,-.2,2),new THREE.Vector3(0,0,1)).z-.005));
  // ears
  const ear=(x,y,z,rz,ry)=>{const g=P(grp(),x,y,z);g.rotation.set(0,ry||0,rz||0);head.add(g);C.ears.push(g);return g};
  const sx=pf;
  const softEar=(col,inCol,L,Wd,T,tipCol)=>{const pr=[{c:[0,0,0],r:[Wd,Wd*.85,T*1.15],col,w:1},{c:[0,L*.5,0],r:[Wd*.78,L*.52,T*.9],col,w:1},{c:[0,L*.92,0],r:[Wd*.3,L*.3,T*.6],col:tipCol||col,w:tipCol?20:1}];
    if(inCol)pr.push({c:[0,L*.45,T*.75],r:[Wd*.5,L*.42,T*.42],col:inCol,w:9,paint:1});return sdfMesh(pr,.05,.02,.002)};
  for(const s of[-1,1]){
    const E=sp.ear,eb=B,ei=tn(sp.earIn||sp.c),tip=sp.tip?tn(sp.tip):null,k=pf;
    const put=(m,x,y,z,rz,ry,rx)=>{const g=ear(x,y,z,rz,ry);m.scale.setScalar(k);m.rotation.x=rx||0;g.add(m);return g};
    if(E==='fox')put(softEar(eb,ei,.58,.3,.09,tip),s*.37,.38,-.04,-s*.42);
    if(E==='cat')put(softEar(eb,ei,.46,.21,.08,tip),s*.37,.38,-.02,-s*.4);
    if(E==='dragonEar'){const g=put(softEar(eb,ei,.5,.21,.08,null),s*.38,.4,-.02,-s*.4);
      for(const [col,r,h,rz] of[['#ff9a1f',.07,.22,.0],['#ffd23a',.05,.16,.5]])g.add(P(R(cone(col,r*k,h*k,{glow:.7}),0,0,-s*rz),0,.5*k,0))}
    if(E==='bat')put(softEar(eb,ei,.56,.27,.08,null),s*.4,.38,-.04,-s*.62);
    if(E==='leaf'){put(softEar(eb,ei,.58,.25,.07,null),s*.4,.38,-.03,-s*.62)}
    if(E==='bunny')put(softEar(eb,ei,.86,.17,.075,null),s*.27,.42,-.06,-s*.2,0,-.08);
    if(E==='bear')put(softEar(eb,ei,.05,.21,.12,null),s*.45,.4,-.03,-s*.35,0,.1);
    if(E==='floppy'){const m=softEar(sp.earC?tn(sp.earC):eb,ei,.52,.14,.07,null);const g=put(m,s*.62,.12,-.08,-s*(2.65),0,0);g.scale.setScalar(sp.horn==='ram'?.62:1)}
    if(E==='fin'){const g=ear(s*.58,.02,-.08,0,s*.9),kk=Math.max(.6,pf);const fg=wingShape(.8*kk,.62*kk,false),fm=new THREE.Mesh(fg,M(sp.fin,{side:1}));fm.rotation.set(0,s>0?0:Math.PI,0);fm.rotation.z=s*.3;fm.position.set(0,-.12*kk,0);g.add(fm);
      for(const q of[-.1,.12,.32]){const rb=new THREE.Mesh(new THREE.BoxGeometry(.52*kk,.014,.014),M(tn(sp.a)));rb.position.set(s*.27*kk,q*kk-.02,.003);rb.rotation.z=s*(q*1.4-.1);g.add(rb)}}
  }
  // horns / crest / extras
  if(sp.horn==='drag'||sp.horn==='demon'){const k=pf*(sp.horn==='demon'?.8:1);for(const s of[-1,1]){const pts=curve(t=>[s*(.48+Math.sin(t*2.2)*.2*k),.34+t*.5*k,-.05-t*.12*k],10);
    const g=sphChain(pts,.075*k,.014,tn(sp.hornC||'#6a2ca6'),{gloss:.6});head.add(g);if(sp.horn==='drag'){const b=P(ell(tn('#b898e8'),.04*k,.04*k,.04*k,{gloss:1}),s*.54,.43,-.05);head.add(b)}}}
  if(sp.horn==='ram'){const k=pf;for(const s of[-1,1]){const pts=curve(t=>{const a=t*Math.PI*2.5+.2,r=.27*k*(1-t*.62);return[s*(.58+Math.sin(a)*r),.26+Math.cos(a)*r-.08*k,-.06+Math.sin(a*.0)*0]},26);
    const g=sphChain(pts,.082*k,.03*k,tn(sp.hornC),{gloss:.35});head.add(g)}}
  if((sp.extra||[]).includes('unihorn')){const h=cone(tn(sp.hornC),.07*pf,.3*pf,{gloss:.6},12);P(h,0,.52,.22);h.rotation.x=.3;head.add(h)}
  if((sp.extra||[]).includes('crestSpikes')){for(const [x,z,h,rz] of[[0,-.08,.3,0],[-.15,-.1,.22,.4],[.15,-.1,.22,-.4]]){const q=P(cone(tn(sp.spikeC||(sp.a==='#5a1f90'?'#8a7aa8':'#3a4a78')),.075*pf,h*pf,{},10),x,.5,z);q.rotation.x=-.25;q.rotation.z=rz;head.add(q)}}
  if((sp.extra||[]).includes('flame')){const g=P(grp(),0,.5,.05);head.add(g);[[0,.34,0],[-.1,.24,.5],[.1,.24,-.5]].forEach(([x,h,rz],i)=>{const q=R(P(cone(sp.flameC[i?1:0],.1*pf,h*pf,{glow:.5},10),x*.4,0,0),0,0,rz*.5);q.scale.z=.7;g.add(q)})}
  if((sp.extra||[]).includes('sprout')){const g=P(grp(),0,.55,.04);head.add(g);g.add(P(cyl('#4f8a2a',.02*pf,.02*pf,.2*pf),0,.2*pf,0));
    for(const s of[-1,1]){const l=R(P(ell('#7cc84a',.15*pf,.045*pf,.07*pf),s*.12*pf,.0,0),0,0,s*.4);l.rotation.z=s*.45;const lg=P(grp(),0,.19*pf,0);lg.add(l);g.add(lg)}}
  if((sp.extra||[]).includes('dorsal')){const k=Math.max(.6,pf);const m=new THREE.Mesh(wingShape(.5*k,.5*k,false),M(sp.fin,{side:1}));m.rotation.set(0,Math.PI/2,Math.PI/2);m.position.set(0,.5,-.1);m.scale.set(1.2,1.5,1);head.add(m);}
  if((sp.extra||[]).includes('antenna')){for(const s of[-1,1]){const g=P(grp(),s*.2,.5,-.02);g.rotation.z=-s*.38;head.add(g);const k=pf;g.add(P(cyl(tn('#8ede44'),.022,.022,.5*k),0,.5*k,0));g.add(P(ell(tn('#8ede44'),.085*k,.085*k,.085*k),0,.56*k,0))}}
  if((sp.extra||[]).includes('diamond')&&stage>=1){const d=new THREE.Mesh(new THREE.OctahedronGeometry(.13*Math.min(1,pf+.1),0),M(sp.dia,{gloss:1,glow:.35}));d.scale.set(.78,1.2,.35);d.position.set(0,.3,.53);head.add(d)}
  if((sp.extra||[]).includes('heart')&&stage>=1){}
  // tail
  const tail=P(grp(),0,-.35,-.5);tail.rotation.x=.45;body.add(tail);C.tail=tail;C.tailBase=.45;const T=sp.tail;
  const tk=Math.max(.6,pf);
  if(T==='puff')tail.add(P(ell(B,.14*tk,.14*tk,.14*tk),0,0,-.1));
  if(T==='fox'){tail.add(P(ell(B,.18*tk,.18*tk,.34*tk),0,0,-.22));tail.add(P(ell(tn(sp.c),.15*tk,.15*tk,.14*tk),0,0,-.5*tk))}
  if(T==='cat'){tail.add(P(ell(B,.07*tk,.07*tk,.4*tk),0,0,-.25));tail.add(P(ell(sp.tip?tn(sp.tip):B,.075*tk,.075*tk,.1*tk),0,0,-.52*tk))}
  if(T==='leaf'){tail.add(R(P(ell(tn('#8ccf5a'),.14*tk,.04*tk,.3*tk),0,0,-.25),0,0,0))}
  if(T==='dragon'){tail.add(P(ell(B,.1*tk,.1*tk,.32*tk),0,0,-.2));const c=R(P(cone(tn(sp.tailFlame?'#ff9a1f':(sp.a)),.11*tk,.34*tk,{glow:sp.tailFlame?.5:0},12),0,0,-.45*tk),-Math.PI/2,0,0);tail.add(c)}
  if(T==='fish'){const m=new THREE.Mesh(wingShape(.5*tk,.5*tk,false),M(sp.fin,{side:1}));m.rotation.set(0,Math.PI/2,-Math.PI/2);m.position.set(0,-.18*tk,0);tail.add(m);tail.add(P(ell(B,.1*tk,.1*tk,.2*tk),0,0,-.12))}
  C.lidOpen=-1.95;C.baseY=0;return C}
function chibiSize(i,stage){const sp=CH[i-CH0];if(stage===2){}const C=buildChibi(sp,2);C.root.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(C.root),z=b.getSize(new THREE.Vector3());return{xz:Math.max(z.x,z.z),y:z.y,top:b.max.y}}
const CHSZ=GD.pelucias.CHSZ;
function openChibi(i,stage,pop){
  setDet(i);
  if(!initViewer())return false;
  if(V.C&&V.C.root)V.spin.remove(V.C.root);if(V.T){V.spin.remove(V.T.root);V.T=null}
  const sp=CH[i-CH0],S=CH_STAGES[stage],C=buildChibi(sp,stage);
  V.mode='creature';V.chibi=true;V.C=C;V.sp={h:.5,tl:'',bird:0};
  const gs=S.gs;C.gs=gs;C.root.scale.setScalar(gs);
  setFloor(i);castAll(C.root);
  C.baseY=-1-C.feet*gs;C.backY=-1+.62*gs;C.root.position.y=C.baseY;V.spin.add(C.root);
  if(!CHSZ[i])CHSZ[i]=chibiSize(i,2);V.size={xz:CHSZ[i].xz,y:CHSZ[i].y};
  Object.assign(V,{ry:-.5,rx:.1,vy:0,st:'idle',until:0,taps:[],t0:performance.now(),blinkAt:1.5,blinkTo:0,wag:0,side:1,pop:pop?performance.now():0,
    S:{lid:0,ear:0,tailX:0,wagA:.2,wagS:5,tongue:0,hx:0,hy:0,hz:0,crouch:0,roll:0,paddle:0,scratch:0,shake:0,brow:0,flap:0}});
  return true}
/* ---------- cuidados: comida, carinho e brincar até evoluir ---------- */
const CARE_KEY='garro-care';
let CARE={};try{CARE=JSON.parse(localStorage.getItem(CARE_KEY)||'{}')||{}}catch(e){CARE={}}
function saveCare(){try{localStorage.setItem(CARE_KEY,JSON.stringify(CARE))}catch(e){}}
const DECAY=GD.regras.DECAY;// pontos por minuto
const XPG=GD.regras.XPG;
// the first 20 plushes keep their painted look: they only grow a bit; the 15 round ones also change shape and color
const GROW=GD.regras.GROW;const EVO_LV=50;
// ataque e defesa no nível 1: os grandes são bem mais fortes que os redondos (cada um tem seu jeito)
const STAT=GD.pelucias.STAT;
const capOf=i=>i<CH0?100:30;
function lvOf(i){return Math.min(capOf(i),1+Math.floor(careOf(i).xp/(i<CH0?4:5)))}
function statsAt(i,lv){const b=STAT[i],ev=i<CH0&&lv>=EVO_LV?1.35:1,gr=i<CH0?.04:.03,atk=Math.round(b[0]*(1+(lv-1)*gr)*ev),df=Math.round(b[1]*(1+(lv-1)*gr)*ev);return{lv,atk,def:df,hp:Math.round((atk+df)*2+lv*5)}}
function renderPow(i){const e=$('vPow');if(!e)return;const S=statsAt(i,lvOf(i));e.innerHTML='<span>Nv <b>'+S.lv+'</b></span><span>⚔️ <b>'+S.atk+'</b></span><span>🛡️ <b>'+S.def+'</b></span><span>❤️ <b>'+S.hp+'</b></span>'}
const EVN=GD.pelucias.EVN;
const ECOL=GD.pelucias.ECOL;
function evName(i,st){const n=PLUSH[i].name;return st>0?(EVN[n]||n):n}
function careOf(i){let c=CARE[i];const now=Date.now();
  if(!c){c=CARE[i]={xp:0,f:55,l:55,p:55,t:now};saveCare()}
  const mins=Math.max(0,(now-c.t)/60000);if(mins>.02){for(const k in DECAY)c[k]=Math.max(0,c[k]-DECAY[k]*mins);c.t=now}
  return c}
function careXp(i){return careOf(i).xp}
function careStage(i){return i>=CH0?2:lvOf(i)>=EVO_LV?1:0}
function gsOf(i,st){return i>=CH0?1:GROW[st].gs}
function refreshVStats(i){const p=PLUSH[i],st=careStage(i);$('vStats').textContent=Math.round(p.cm*gsOf(i,st))+' cm · '+p.g+' g · pego '+(coll[i]||0)+'x'+(i>=CH0?'':' · '+(st?'Evoluído':'Base'))+(GCOLL[i]?' · 🏆 gigante'+(GEVO[i]?' evoluído':'')+' ×'+GCOLL[i]:'');if(i<CH0)$('vName').textContent=evName(i,st);renderPow(i)}
function renderCare(){
  if(!V.open||V.cur===undefined)return;const i=V.cur;renderSell(i);renderPow(i);
  const c=careOf(i),lv=lvOf(i),cap=capOf(i),st=careStage(i),m=(c.f+c.l+c.p)/3;
  if(i>=CH0){$('cStage').textContent=m>60?'😊 Feliz':m>30?'🙂 Tranquilo':'😟 Carente';$('cXp').textContent='Nv '+lv+(lv>=cap?' (máx)':' / '+cap)+' · 2 repetidas = 1 moeda';$('cXpBar').style.width=Math.min(100,(lv-1)/(cap-1)*100)+'%'}
  else{$('cStage').textContent=st?'★ '+evName(i,1):PLUSH[i].name;
    $('cXp').textContent=st?'Nv '+lv+' · forma evoluída!':'Nv '+lv+' · evolui no Nv '+EVO_LV+' para '+evName(i,1);
    $('cXpBar').style.width=Math.min(100,st?(lv-EVO_LV)/(cap-EVO_LV)*100:(lv-1)/(EVO_LV-1)*100)+'%'}
  for(const [k,id,b] of [['f','mF','cFeed'],['l','mL','cPet'],['p','mP','cPlay']]){$(id).style.width=Math.round(c[k])+'%';$(b).classList.toggle('low',c[k]<25)}
  updFood();const sb=$('cStone');if(sb){const sk=STONE_OF(i),n=INV.st[sk]||0;sb.hidden=!(i<CH0&&!st);sb.classList.toggle('buy',!n);sb.innerHTML=n?'💎 Evoluir agora com '+STONES[sk].name+' <small>(você tem '+n+')</small>':'💎 Evoluir com '+STONES[sk].name+' <small>· você não tem · comprar '+PRICE.stone+' 🪙</small>'}
}
function updFood(){const s=$('cFeed')&&$('cFeed').querySelector('span');if(s)s.textContent='🍓 Comida ×'+INV.food}
function useStone(){const i=V.cur;if(i===undefined||i>=CH0)return;const k=STONE_OF(i);if(lvOf(i)>=EVO_LV)return;if((INV.st[k]||0)<=0){audio();renderShop();$('shMsg').textContent='Você não tem '+STONES[k].name+': compre aqui 💎';$('shop').hidden=false;return}const c=careOf(i);INV.st[k]--;saveInv();evento('stone');srv('use_stone',{plushId:i,stone:k},r=>{INV.st[k]=r.stones;const cc=careOf(i);cc.xp=Math.max(cc.xp,r.xp);saveInv();saveCare()});audio();[523,784,1046,1568].forEach((f,q)=>setTimeout(()=>tone(f,.14,'triangle',.1),q*90));for(let q=0;q<6;q++)setTimeout(()=>float('💎','love'),q*90);gainXp(i,Math.max(1,(EVO_LV-1)*4-c.xp));renderCare()}
const SELL_PRICE=1,SELL_BIG=30,SELL_GIANT=40;// redondo 1 · bicho especial (que evolui) 30 · pelúcia gigante 40
function renderSell(i){const b=$('cSell'),bg=$('cSellG');if(!b)return;const n=coll[i]||0,big=i<CH0;b.hidden=false;b.disabled=n<1;b.dataset.armed='';
  b.textContent=n>=1?'💰 Vender 1 · +'+(big?SELL_BIG:SELL_PRICE)+' moeda'+(big?'s':'')+' (tenho '+n+')':'💰 Nenhum para vender';
  renderGiantRow(i);const gn=GCOLL[i]||0;bg.hidden=!(big&&gn);bg.dataset.armed='';bg.disabled=false;bg.textContent='🏆 Vender gigante · +'+SELL_GIANT+' moedas (tenho '+gn+')'}
async function sellDup(){const i=V.cur;if(i===undefined)return;const n=coll[i]||0;if(n<1)return;const big=i<CH0,b=$('cSell');
  if(big&&b.dataset.armed!=='1'){b.dataset.armed='1';b.textContent='Toque de novo: vender '+PLUSH[i].name+' por '+SELL_BIG+' 🪙';return}
  const q=1,gain=big?SELL_BIG:SELL_PRICE;b.disabled=true;
  const r=await syncEstado('sell',{plushId:i,qty:q});
  if(r&&typeof r.coins==='number'){coins=r.coins+bonus;coll[i]=Math.max(0,typeof r.count==='number'?r.count:n-q)}else{coll[i]=n-q;bonus+=gain;coins+=gain;saveBonus()}
  saveX();audio();[784,988,1319,1568].forEach((f,k)=>setTimeout(()=>tone(f,.12,'triangle',.09),k*80));
  for(let k=0;k<6;k++)setTimeout(()=>float('🪙','love'),k*100);banner('+'+gain+' moeda'+(gain>1?'s':''),'Vendeu '+PLUSH[i].name+(coll[i]?'':' (era o último)'),true);
  hud();renderShelf();if(!coll[i]&&V.open){$('vClose').click();return}renderSell(i);if(V.open)refreshVStats(i)}
function sellGiant(){const i=V.cur;if(i===undefined||!(GCOLL[i]>0))return;const b=$('cSellG');
  if(b.dataset.armed!=='1'){b.dataset.armed='1';b.textContent='Toque de novo: vender o gigante por '+SELL_GIANT+' 🪙';return}
  GCOLL[i]--;if(!GCOLL[i])delete GEVO[i];saveG();coins+=SELL_GIANT;if(ONL)srv('sell_giant',{plushId:i},r=>{coins=r.coins;GCOLL[i]=r.giants;saveG();hud()});else{bonus+=SELL_GIANT;saveBonus()}audio();fanfare();banner('+'+SELL_GIANT+' moedas','Vendeu o '+PLUSH[i].name+' gigante',true);
  hud();renderShelf();renderSell(i);if(V.open)refreshVStats(i)}
$('cSell').addEventListener('click',sellDup);$('cSellG').addEventListener('click',sellGiant);
$('cBatG').addEventListener('click',()=>openBattle(true));
function renderGiantRow(i){const r=$('gRow');if(!r)return;const gn=i<CH0?GCOLL[i]||0:0;r.hidden=!gn;if(!gn)return;const k=STONE_OF(i),n=INV.st[k]||0,b=$('cGEvo');
  b.hidden=!!GEVO[i];b.classList.toggle('buy',n<GEVO_STONES);b.innerHTML=n>=GEVO_STONES?'💎 Evoluir o gigante <small>(usa '+GEVO_STONES+' '+STONES[k].name+' · tem '+n+')</small>':'💎 Gigante evolui com '+GEVO_STONES+' '+STONES[k].name+' <small>· tem '+n+' · comprar</small>'}
function evolveGiant(){const i=V.cur;if(i===undefined||!(GCOLL[i]>0)||GEVO[i])return;const k=STONE_OF(i);audio();
  if((INV.st[k]||0)<GEVO_STONES){renderShop();$('shMsg').textContent='Para evoluir o gigante precisa de '+GEVO_STONES+' '+STONES[k].name+' (tem '+(INV.st[k]||0)+')';$('shop').hidden=false;return}
  INV.st[k]-=GEVO_STONES;saveInv();GEVO[i]=1;saveG();evento('giant_evolve');srv('giant_evolve',{plushId:i,stone:k},r=>{INV.st[k]=r.stones;saveInv()});[523,659,784,1046,1318,1568,2093].forEach((q,n)=>setTimeout(()=>tone(q,.24,'triangle',.11),n*100));for(let n=0;n<10;n++)setTimeout(()=>float(['💎','✨','🏆','🌟'][n%4],'love'),n*110);
  const e=$('vEvo');e.innerHTML='🏆 Gigante evoluiu!<small>'+evName(i,1)+' gigante</small>';e.classList.remove('on');void e.offsetWidth;e.classList.add('on');renderGiantRow(i);renderShelf();refreshVStats(i)}
$('cGEvo').addEventListener('click',evolveGiant);
$('btnSwap').addEventListener('click',swapMachine);
$('mach1').addEventListener('click',()=>setMachine(1));$('mach2').addEventListener('click',()=>setMachine(2));
{let tc=0,tt=0;$('coins').parentElement.addEventListener('click',()=>{if(!window.GARRO_OFFLINE)return;const now=Date.now();if(now-tt>1500)tc=0;tt=now;if(++tc>=7){tc=0;DEV=!DEV;try{localStorage.setItem('garro-dev',DEV?'1':'0')}catch(e){}banner(DEV?'Modo dev: moedas infinitas':'Modo dev desligado');hud()}})}

/* ---------- loja ---------- */
const PRICE=GD.regras.PRICE;
function renderShop(){$('shCoins').textContent=DEV?'∞':coins;$('shFood').textContent=INV.food;$('buyFood').disabled=!canPay(PRICE.food);
  const g=$('shStones');if(!g.children.length){STONES.forEach((p,k)=>{const d=document.createElement('div');d.className='shst';d.innerHTML='<img src="'+p.img+'" alt=""><b>'+p.name+'</b><small>'+p.desc+'</small><small>Você tem: <i id="shS'+k+'">0</i></small><button data-k="'+k+'">400 🪙</button>';g.appendChild(d)});
    g.addEventListener('click',e=>{const b=e.target.closest('button');if(b)buyThing('stone',+b.dataset.k)})}
  STONES.forEach((p,k)=>{$('shS'+k).textContent=INV.st[k]});g.querySelectorAll('button').forEach(b=>b.disabled=!canPay(PRICE.stone))}
function buyThing(kind,k){const pr=PRICE[kind];if(!canPay(pr)){$('shMsg').textContent='Moedas insuficientes: faltam '+(pr-coins)+' 🪙';return}$('shMsg').textContent='';
  if(ONL&&!DEV){const item=kind==='food'?'food':'stone_'+k;$('shMsg').textContent='Comprando...';syncEstado('buy',{item}).then(r=>{if(!r||r.error){$('shMsg').textContent='Não deu para comprar agora. Tente de novo.';return}
    $('shMsg').textContent='';coins=r.coins;if(kind==='food')INV.food=r.qty;else{INV.st[k]=r.qty;evento('stone')}saveInv();hud();audio();[784,988,1319].forEach((f,q)=>setTimeout(()=>tone(f,.1,'triangle',.08),q*70));renderShop();if(V.open)renderCare()});return}
  spend(pr);if(kind==='food')INV.food++;else{INV.st[k]++;evento('stone')}saveInv();hud();audio();[784,988,1319].forEach((f,q)=>setTimeout(()=>tone(f,.1,'triangle',.08),q*70));renderShop();if(V.open)renderCare()}
$('btnShop').addEventListener('click',()=>{audio();renderShop();$('shop').hidden=false});
$('shClose').addEventListener('click',()=>{$('shop').hidden=true});
$('buyFood').addEventListener('click',()=>buyThing('food'));
$('cStone').addEventListener('click',useStone);
/* ---------- inventário ---------- */
function canEvolveWith(i,k){return i<CH0&&(coll[i]||0)>0&&STONE_OF(i)===k&&lvOf(i)<EVO_LV}
function renderInv(){$('ivFood').textContent=INV.food;const g=$('ivStones');g.innerHTML='';
  STONES.map((p,k)=>k).sort((a,b)=>((INV.st[b]||0)>0)-((INV.st[a]||0)>0)||a-b).forEach(k=>{const p=STONES[k],n=INV.st[k]||0,d=document.createElement('div');d.className='shst ivst'+(n?'':' zero');
    const who=[];for(let i=0;i<CH0;i++)if(STONE_OF(i)===k)who.push(PLUSH[i].name);
    d.innerHTML='<span class="n">×'+n+'</span><img src="'+p.img+'" alt=""><b>'+p.name+'</b><small>'+(who.length?'Evolui: '+who.join(', '):'Ainda sem bicho')+'</small><button data-k="'+k+'">'+(n?'Evoluir um bichinho':'Comprar na loja')+'</button>';g.appendChild(d)});
}
function invPick(k){const box=$('ivPick'),list=[];for(let i=0;i<CH0;i++)if(canEvolveWith(i,k))list.push(i);
  box.hidden=false;box.innerHTML='<h4>'+STONES[k].name+' · escolha quem evolui</h4>'+(list.length?list.map(i=>'<div class="ivrow"><img src="'+PLUSH[i].img+'" alt=""><div><b>'+PLUSH[i].name+'</b><small>Nv '+lvOf(i)+' → vira '+(EVN[PLUSH[i].name]||'forma evoluída')+'</small></div><button data-i="'+i+'">Evoluir</button></div>').join(''):'<small style="color:var(--dim);font-weight:700">Nenhum bichinho seu pode usar esta pedra agora (precisa ter capturado e ainda não ter evoluído).</small>');
  box.parentElement.scrollTo({top:0,behavior:'smooth'})}
$('ivStones').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const k=+b.dataset.k;audio();if((INV.st[k]||0)>0)invPick(k);else{$('inv').hidden=true;renderShop();$('shop').hidden=false}});
$('ivPick').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const i=+b.dataset.i;$('inv').hidden=true;openViewer(i);setTimeout(useStone,900)});
$('btnInv').addEventListener('click',()=>{audio();renderInv();$('ivPick').hidden=true;$('inv').hidden=false});
$('ivClose').addEventListener('click',()=>{$('inv').hidden=true});
$('ivBuy').addEventListener('click',()=>{$('inv').hidden=true;renderShop();$('shop').hidden=false});
/* ---------- batalha: cada bichinho com nível, ataque e defesa ---------- */
let BT=null;
function bStats(f){const S=statsAt(f.i,f.lv);if(f.giant){const k=GEVO[f.i]&&f.giant?1.6:1.35;S.atk=Math.round(S.atk*k);S.def=Math.round(S.def*k);S.hp=Math.round(S.hp*(k+.25))}return Object.assign({},f,S)}
function pickOpp(my){const myLv=lvOf(my);const same=Math.random()<.75;let j;do{j=Math.floor(Math.random()*NPL)}while(j===my||(same&&(j<CH0)!==(my<CH0)));const lv=Math.max(1,Math.min(capOf(j),Math.round(myLv*(.75+Math.random()*.5))));return bStats({i:j,lv,giant:j<CH0&&Math.random()<.12?1:0})}
function bName(f){return (f.giant?'🏆 '+(GEVO[f.i]?'Gigante★ ':'Gigante '):'')+evName(f.i,f.i<CH0&&(f.lv>=EVO_LV||(f.giant&&GEVO[f.i]))?1:0)}
// imagens da luta: todos desenhados de perfil OLHANDO PARA A DIREITA. O da esquerda fica como está, o da direita é espelhado: sempre cara a cara.
const BSPR=GD.sprites_luta.BSPR,BSPRE=GD.sprites_luta.BSPRE;const EVOSPR=BSPRE;// coleção usa as mesmas imagens evoluídas
function bSrc(f){const ev=f.i<CH0&&(f.lv>=EVO_LV||(f.giant&&GEVO[f.i]));return (ev&&BSPRE[f.i]?BSPRE[f.i].img:null)||(BSPR[f.i]?BSPR[f.i].img:null)||(ev&&EVOSPR[f.i]?EVOSPR[f.i].img:PLUSH[f.i].img)}
function bSize(){const a=BT&&BT.me,b=BT&&BT.op;if(!a||!b)return;const any=a.giant||b.giant;for(const [side,f] of [['Me',a],['Op',b]]){const im=$('b'+side+'Img');im.classList.toggle('giant',!!f.giant);im.classList.toggle('small',!!(any&&!f.giant))}}
function bFill(side,f){const im=$('b'+side+'Img');im.src=bSrc(f);setTimeout(bSize,0);const fl=side!=='Me';im.dataset.flip=fl?'1':'0';im.style.transform=fl?'scaleX(-1)':'';$('b'+side+'Name').textContent=bName(f);$('b'+side+'St').textContent=(ELNAME[ELEM[f.i]]||'')+' · Nv '+f.lv+' · ⚔️ '+f.atk+' · 🛡️ '+f.def+' · ❤️ '+f.hp;$('b'+side+'Hp').style.width='100%'}
function openBattle(gi){const i=V.cur;if(i===undefined)return;audio();BT={me:bStats({i,lv:lvOf(i),giant:gi===true&&GCOLL[i]>0?1:0}),busy:false,done:false};BT.op=pickOpp(i);
  bFill('Me',BT.me);bFill('Op',BT.op);bIdle();$('bRes').innerHTML='Quem tem mais poder leva vantagem, mas a sorte conta!';$('bGo').disabled=$('bOther').disabled=$('bClose').disabled=false;$('bGo').textContent='⚔️ Lutar!';$('battle').hidden=false}
function simBattle(a,b){let ha=a.hp,hb=b.hp,turn=Math.random()<.5?0:1;const log=[];
  for(let r=0;r<80&&ha>0&&hb>0;r++){const A=turn?b:a,D=turn?a:b;let d=Math.max(2,Math.round(A.atk*(.8+Math.random()*.4)-D.def*.45));const crit=Math.random()<.1;if(crit)d=Math.round(d*1.5);
    if(turn)ha=Math.max(0,ha-d);else hb=Math.max(0,hb-d);log.push({t:turn,d,crit,ha,hb});turn^=1}
  return{log,win:hb<=0}}
function battlePay(){let o={t:0,n:0};try{o=JSON.parse(localStorage.getItem('garro-bpay')||'')||o}catch(e){}
  const now=Date.now();if(now-o.t>36e5)o={t:now,n:0};let paid=0;if(o.n<5){o.n++;paid=1;if(!ONL){bonus++;saveBonus()}coins++;hud()}try{localStorage.setItem('garro-bpay',JSON.stringify(o))}catch(e){}return paid}

/* ---------- efeitos de ataque por elemento ---------- */
const BFX=GD.modelos.BFX;
BFX.stone=BFX.stone;
function bFx(from,to,el,crit){const F=BFX[el]||BFX.earth,fld=$('bFx');if(!fld)return;const fr=from.getBoundingClientRect(),tr=to.getBoundingClientRect(),pr=fld.getBoundingClientRect();
  const ax=fr.left+fr.width/2-pr.left,ay=fr.top+fr.height*.4-pr.top,bx=tr.left+tr.width/2-pr.left,by=tr.top+tr.height*.4-pr.top;const dx=bx-ax,dy=by-ay;
  const col=F.c,n=F.n+(crit?2:0);
  for(let k=0;k<n;k++){const el2=document.createElement('i');el2.textContent=F.e[k%F.e.length];el2.style.setProperty('--c',col);const sz=(F.big||1)*(crit?1.35:1);el2.style.fontSize=(34*sz)+'px';fld.appendChild(el2);
    const d=F.m==='bolt'?k*90:F.m==='jet'?k*55:F.m==='spray'?k*50:k*140,jx=(Math.random()-.5)*30,jy=(Math.random()-.5)*30;let kf;
    if(F.m==='arc'){kf=[{transform:`translate(${ax}px,${ay}px) rotate(0deg) scale(.6)`,opacity:1},{transform:`translate(${ax+dx*.5}px,${ay+dy*.5-120}px) rotate(180deg) scale(1.2)`,opacity:1,offset:.5},{transform:`translate(${bx}px,${by}px) rotate(400deg) scale(1)`,opacity:1}]}
    else if(F.m==='bolt'){const pts=[];for(let q=0;q<=6;q++){const t=q/6;pts.push({transform:`translate(${ax+dx*t+(q%2?18:-18)*(q>0&&q<6)+jx*t}px,${ay+dy*t+(q%2?-14:14)*(q>0&&q<6)}px) scale(${.8+.5*(q%2)}) rotate(${(q%2?20:-20)}deg)`,opacity:q==6?.9:1,offset:t})}kf=pts}
    else if(F.m==='jet'){kf=[{transform:`translate(${ax}px,${ay}px) scale(.5)`,opacity:0},{transform:`translate(${ax+dx*.2}px,${ay+dy*.2+jy*.3}px) scale(1)`,opacity:1,offset:.2},{transform:`translate(${bx+jx}px,${by+jy}px) scale(1.1)`,opacity:1}]}
    else if(F.m==='spray'){const sx=(Math.random()-.5)*120,sy=-30-Math.random()*60;kf=[{transform:`translate(${ax}px,${ay}px) scale(.4) rotate(0)`,opacity:0},{transform:`translate(${ax+dx*.35+sx*.5}px,${ay+dy*.35+sy}px) scale(1) rotate(120deg)`,opacity:1,offset:.35},{transform:`translate(${bx+jx}px,${by+jy}px) scale(.9) rotate(300deg)`,opacity:1}]}
    else{kf=[{transform:`translate(${ax}px,${ay}px) scale(.4)`,opacity:1},{transform:`translate(${bx}px,${by}px) scale(1.2)`,opacity:1}]}
    const an=el2.animate(kf,{duration:420,delay:d,easing:F.m==='arc'?'ease-in':'ease-out',fill:'both'});
    an.onfinish=()=>{const sp=document.createElement('i');sp.textContent=F.e[k%F.e.length];sp.style.setProperty('--c',col);sp.style.fontSize=(40*sz)+'px';sp.style.transform=`translate(${bx+jx}px,${by+jy}px)`;fld.appendChild(sp);
      sp.animate([{opacity:1,transform:`translate(${bx+jx}px,${by+jy}px) scale(.8)`},{opacity:0,transform:`translate(${bx+jx*2}px,${by+jy*2-20}px) scale(1.8)`}],{duration:380,fill:'forwards'}).onfinish=()=>sp.remove();el2.remove()}}
  const fl=document.createElement('div');fl.className='flash';fl.style.setProperty('--c',col);fl.style.left=bx+'px';fl.style.top=by+'px';fld.appendChild(fl);
  fl.animate([{opacity:0,transform:'scale(.4)'},{opacity:.95,transform:'scale(1.2)',offset:.3},{opacity:0,transform:'scale(1.6)'}],{duration:520,delay:360+(n-1)*(F.m==='bolt'?90:F.m==='jet'?55:F.m==='spray'?50:140)*.6}).onfinish=()=>fl.remove();
  // tom do ataque
  const t=F.f;if(t[0]>=1000)[1400,900,1500,700].forEach((q,i)=>setTimeout(()=>tone(q,.05,'sawtooth',.06),i*60));else tone(t[0]+Math.random()*30,.18,F.m==='jet'?'sine':'square',.07)}

/* ---------- movimento na luta ---------- */
const DS='drop-shadow(0 8px 10px rgba(0,0,0,.5))';
function bImg(sd){return $(sd?'bOpImg':'bMeImg')}
const FACEL=new Set([0,1,2,3,4,5,6,7,8,9,10,11,13,15,17,18,19]);// sprites cuja cabeça olha para a esquerda
// keyframes em "espaço de frente": +x = na direção do adversário. O lado direito espelha o movimento todo;
// o espelho da imagem fica por dentro, então a cara continua virada para o outro e o bote vai para a frente.
function bA(sd,kf,o){const fl=bImg(sd).dataset.flip==='1',A=sd?'scaleX(-1) ':'',B=(fl!==!!sd)?' scaleX(-1)':'';
  kf=kf.map(f=>Object.assign({},f,{transform:A+(f.transform||'none').replace(/^none$/,'')+B}));return bImg(sd).animate(kf,o)}
function bClear(){bImg(0).style.transformOrigin=bImg(1).style.transformOrigin='';for(const sd of[0,1]){const im=bImg(sd);im.getAnimations().forEach(a=>a.cancel())}$('bFx').querySelectorAll('.bconf').forEach(e=>e.remove())}
function bIdle(){bClear();[0,1].forEach(sd=>{const im=bImg(sd);bA(sd,[{transform:'translateY(0) scale(1,1)'},{transform:'translateY(-5px) scale(.99,1.025)'},{transform:'translateY(0) scale(1,1)'}],{duration:1500+sd*260,iterations:Infinity,easing:'ease-in-out'})})}
function bLunge(sd,crit){const im=bImg(sd),k=crit?1.5:1;bA(sd,[{transform:'translateX(0) scale(1)'},{transform:`translateX(${-16*k}px) scale(${.94},${1.06}) rotate(${-4*k}deg)`,offset:.3},{transform:`translateX(${62*k}px) scale(${1.1+.05*k}) rotate(${5*k}deg)`,offset:.55},{transform:'translateX(0) scale(1)'}],{duration:crit?560:440,easing:'ease-in-out'})}
function bHit(sd,crit){const im=bImg(sd),k=crit?1.6:1;bA(sd,[{transform:'translateX(0) rotate(0)',filter:DS},{transform:`translateX(${-26*k}px) rotate(${-8*k}deg) scale(.94,1.04)`,filter:'brightness(2.2) '+DS,offset:.25},{transform:`translateX(${8*k}px) rotate(${3*k}deg)`,filter:DS,offset:.6},{transform:'translateX(0) rotate(0)',filter:DS}],{duration:crit?520:380,easing:'ease-out'})}
function bKO(sd){const im=bImg(sd);im.style.transformOrigin='50% 62%';im.getAnimations().forEach(a=>a.cancel());bA(sd,[{transform:'translate(0,0) rotate(0)',filter:DS,opacity:1},{transform:'translate(-8px,2px) rotate(-14deg)',offset:.3},{transform:'translate(0,22px) rotate(-84deg)',filter:'grayscale(.7) '+DS,opacity:.7}],{duration:900,fill:'forwards',easing:'ease-in'})}
function bConf(sd,list,n){const fld=$('bFx'),pr=fld.getBoundingClientRect(),r=bImg(sd).getBoundingClientRect(),cx=r.left+r.width/2-pr.left,cy=r.top-pr.top+r.height*.1;
  for(let k=0;k<n;k++){const e=document.createElement('i');e.className='bconf';e.textContent=list[k%list.length];e.style.fontSize=(22+Math.random()*14)+'px';fld.appendChild(e);const dx=(Math.random()-.5)*150,h=40+Math.random()*90;
    e.animate([{transform:`translate(${cx}px,${cy}px) scale(.4)`,opacity:0},{transform:`translate(${cx+dx*.5}px,${cy-h}px) scale(1.1)`,opacity:1,offset:.35},{transform:`translate(${cx+dx}px,${cy-h-40}px) scale(.9)`,opacity:0}],{duration:1300+Math.random()*700,delay:k*140,fill:'both'}).onfinish=()=>e.remove()}}
function bWin(sd){const im=bImg(sd);im.getAnimations().forEach(a=>a.cancel());const m=Math.floor(Math.random()*3);let name;
  if(m===0){name='Três pulinhos de alegria! 🎉';const f=[];for(let q=0;q<3;q++){f.push({transform:'translateY(0) scale(1.08,.9)'},{transform:'translateY(-62px) scale(.94,1.1) rotate('+(q%2?-8:8)+'deg)'})}f.push({transform:'translateY(0) scale(1.08,.9)'},{transform:'translateY(0) scale(1)'});
    bA(sd,f,{duration:1900,easing:'ease-in-out'}).onfinish=()=>bIdle2(sd)}
  else if(m===1){name='Deitou e rolou de felicidade! 🥰';
    bA(sd,[{transform:'translate(0,0) rotate(0)'},{transform:'translate(0,16px) rotate(-90deg)',offset:.2},{transform:'translate(50px,18px) rotate(270deg)',offset:.45},{transform:'translate(-50px,18px) rotate(630deg)',offset:.7},{transform:'translate(0,16px) rotate(740deg) scale(1,1)',offset:.85},{transform:'translate(0,-30px) rotate(720deg)',offset:.93},{transform:'translate(0,0) rotate(720deg)'}],{duration:2300,easing:'ease-in-out'}).onfinish=()=>bIdle2(sd)}
  else{name='Correndo em círculos de alegria! 🌀';const f=[],N=24,R=52;for(let q=0;q<=N*2;q++){const a=q/N*Math.PI*2;f.push({transform:`translate(${(Math.sin(a)*R).toFixed(1)}px,${(-Math.abs(Math.sin(q*.9))*14+(1-Math.cos(a))*10).toFixed(1)}px) rotate(${(Math.sin(a)*8).toFixed(1)}deg) scale(${Math.cos(a)>0?1:1})`})}
    bA(sd,f,{duration:2600,easing:'linear'}).onfinish=()=>bIdle2(sd)}
  bConf(sd,['⭐','💖','✨','🎉'],10);return name}
function bIdle2(sd){const im=bImg(sd);bA(sd,[{transform:'translateY(0)'},{transform:'translateY(-6px) scale(.99,1.03)'},{transform:'translateY(0)'}],{duration:1100,iterations:Infinity,easing:'ease-in-out'})}
function bSad(sd){const im=bImg(sd);bA(sd,[{transform:'translateY(0) rotate(0)'},{transform:'translateY(10px) rotate(-6deg) scale(1,.94)'}],{duration:900,fill:'forwards',easing:'ease-out'});bConf(sd,['💧','💔'],4)}
function fightBattle(){if(!BT||BT.busy)return;if(BT.fought){BT.fought=0;BT.op=pickOpp(BT.me.i);bFill('Me',BT.me);bFill('Op',BT.op)}bIdle();BT.busy=true;$('bGo').disabled=$('bOther').disabled=$('bClose').disabled=true;const me=BT.me,op=BT.op,R=simBattle(me,op);$('bRes').textContent='Lutando...';
  R.log.forEach((e,k)=>setTimeout(()=>{
    const A=$(e.t?'bOp':'bMe'),D=$(e.t?'bMe':'bOp');bLunge(e.t,e.crit);
    bFx(A,D,ELEM[(e.t?op:me).i],e.crit);
    setTimeout(()=>{bHit(e.t?0:1,e.crit);
    $('bMeHp').style.width=Math.round(e.ha/me.hp*100)+'%';$('bOpHp').style.width=Math.round(e.hb/op.hp*100)+'%';
    const f=document.createElement('span');f.className='bdmg';f.textContent=(e.crit?'💥 ':'')+'-'+e.d;f.style.left=(e.t?'18%':'68%');D.appendChild(f);setTimeout(()=>f.remove(),850);
    tone(e.crit?220:150+Math.random()*50,.09,'square',.07)},430)},k*850));
  setTimeout(()=>{
    const my=me.i;let line;
    if(R.win){const dn=bWin(0);bKO(1);const paid=battlePay();line='<big>Vitória! 🏆</big><span>'+dn+' · +10 XP'+(paid?' · +1 moeda 🪙':' · limite de moedas por hora')+'</span>';[523,659,784,1046,1318].forEach((f,k)=>setTimeout(()=>tone(f,.18,'triangle',.1),k*110));gainXp(my,10);evento('battle_win');srv('battle',{plushId:my,win:true},r=>{coins=r.coins;careOf(my).xp=r.xp;saveCare();hud()})}
    else{bKO(0);const dn=bWin(1);line='<big>Derrota 💔</big><span>+4 XP pela luta</span>';tone(196,.4,'sawtooth',.08);gainXp(my,4);srv('battle',{plushId:my,win:false},r=>{coins=r.coins;careOf(my).xp=r.xp;saveCare();hud()})}
    $('bRes').innerHTML=line;$('bGo').textContent='⚔️ Lutar de novo';$('bGo').disabled=$('bOther').disabled=$('bClose').disabled=false;BT.busy=false;
    // depois de ganhar XP o nível pode ter mudado: atualiza o meu lado e sorteia outro adversário
    BT.me=bStats({i:my,lv:lvOf(my),giant:BT.me.giant});$('bMeSt').textContent=(ELNAME[ELEM[my]]||'')+' · Nv '+BT.me.lv+' · ⚔️ '+BT.me.atk+' · 🛡️ '+BT.me.def+' · ❤️ '+BT.me.hp;BT.fought=1},R.log.length*850+700)}
$('cBat').addEventListener('click',openBattle);
$('bGo').addEventListener('click',fightBattle);
$('bOther').addEventListener('click',()=>{if(!BT||BT.busy)return;BT.op=pickOpp(BT.me.i);BT.fought=0;bFill('Me',BT.me);bFill('Op',BT.op);bIdle();$('bRes').textContent='Novo adversário!';click(700)});
$('bClose').addEventListener('click',()=>{if(BT&&BT.busy)return;$('battle').hidden=true;if(V.open&&V.cur!==undefined){renderCare();refreshVStats(V.cur)}});
function levelUp(i,lv){float('⬆ Nível '+lv,'xp');[659,880,1175].forEach((f,k)=>setTimeout(()=>tone(f,.1,'triangle',.07),k*70))}
function gainXp(i,n){const lv0=lvOf(i),st0=careStage(i),c=careOf(i);c.xp+=n;saveCare();const lv1=lvOf(i),st1=careStage(i);
  if(V.open&&V.cur===i){if(lv1>lv0)levelUp(i,lv1);renderCare();refreshVStats(i)}
  if(st1>st0)setTimeout(()=>evolve(i,st0,st1),900)}
function careGain(i,kind,amount){const c=careOf(i);if(c[kind]>=96)return false;evento(kind==='f'?'feed':kind==='l'?'pet':'play');
  c[kind]=Math.min(100,c[kind]+amount);c.t=Date.now();saveCare();
  srv('care',{plushId:i,kind,f:c.f,l:c.l,p:c.p},r=>{const cc=careOf(i);cc.xp=r.xp;INV.food=r.food;saveCare();saveInv();updFood()});
  if(V.open&&V.cur===i)float('+'+XPG[kind]+' XP','xp');gainXp(i,XPG[kind]);return true}
function evolve(i,from,to){
  if(!V.open||V.cur!==i||i>=CH0)return;const p=PLUSH[i];
  const f=$('vFlash');f.classList.remove('go');void f.offsetWidth;f.classList.add('go');
  const e=$('vEvo');e.innerHTML='✨ '+p.name+' evoluiu!<small>'+evName(i,0)+' → '+evName(i,1)+'</small>';e.classList.remove('on');void e.offsetWidth;e.classList.add('on');
  [523,659,784,1046,1318,1568,2093].forEach((q,k)=>setTimeout(()=>tone(q,.24,'triangle',.11),k*100));
  for(let k=0;k<10;k++)setTimeout(()=>float(['✨','⭐','💖','🌟'][k%4],'love'),k*110);
  setTimeout(()=>{
    if(PROC[i]){openFox(i,true)}else{const C=V.C;if(C){C.gs=GROW[to].gs;V.pop=performance.now();if(EVOFILE[i]&&!EVOFAIL[i])setTimeout(()=>openViewer(i),1600);else applyEvoTex(i);makeAura(i)}}
    V.last=performance.now();refreshVStats(i);renderCare();if(V.open)fit()},380)}
/* evoluídos: brilho na cor do elemento + faíscas girando + anel no chão */
function killAura(){V.evoK=0;if(V.evoG){if(V.evoG.parent)V.evoG.parent.remove(V.evoG);V.evoG=null;V.evoW=null}if(V.aura){V.spin.remove(V.aura.g);V.aura=null}
  if(V.C&&(V.C.obj||V.C.root))(V.C.obj||V.C.root).traverse(o=>{if(o.isMesh&&o.material&&o.material.emissive&&!o.userData.keep&&o.material.emissiveIntensity!==undefined&&o.userData.tint){o.material.emissive.setRGB(0,0,0);o.material.emissiveIntensity=0;o.userData.tint=0}})}
function makeAura(i){killAura();const C=V.C;if(!C||!(C.obj||C.root))return;if(C.obj)makeEvo(i);const col=new THREE.Color(ECOL[ELEM[i]]||'#ffd23c');
  if(!(C.m&&C.m.evoM))(C.obj||C.root).traverse(o=>{if(o.isMesh&&o.material&&o.material.emissive&&!o.userData.keep){o.material.emissive.copy(col);o.material.emissiveIntensity=.1;o.userData.tint=1}});// modelo evoluído (Tripo) já tem as cores certas: o brilho por cima lavava as cores
  const g=new THREE.Group(),R0=Math.max(V.size.xz*.62,.7),sp=[];
  const mat=new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.9,depthWrite:false,blending:THREE.AdditiveBlending});
  for(let k=0;k<22;k++){const m=new THREE.Mesh(new THREE.OctahedronGeometry(.035+Math.random()*.03,0),mat);g.add(m);sp.push({m,a:Math.random()*6.28,r:R0*(.85+Math.random()*.4),s:(.5+Math.random())*(k%2?1:-1)*.7,h:Math.random(),v:.18+Math.random()*.3})}
  const ring=new THREE.Mesh(new THREE.RingGeometry(R0*1.02,R0*1.16,64),new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.55,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=-.985;g.add(ring);
  const ring2=new THREE.Mesh(new THREE.RingGeometry(R0*.7,R0*.74,64),ring.material);ring2.rotation.x=-Math.PI/2;ring2.position.y=-.98;g.add(ring2);
  V.spin.add(g);V.aura={g,sp,ring,ring2,H:V.size.y*1.25}}
function tickAura(t){const A=V.aura;if(!A)return;const u=t||performance.now()/1000;if(V.evoW)for(const w of V.evoW)w.g.rotation.z=-w.s*(.08+.1*Math.sin(u*2.2));
  for(const q of A.sp){q.h=(q.h+q.v*.004)%1;q.a+=q.s*.012;q.m.position.set(Math.cos(q.a)*q.r,-1+q.h*A.H,Math.sin(q.a)*q.r);q.m.rotation.y+=.05;q.m.scale.setScalar(Math.sin(q.h*Math.PI)*1.3+.1)}
  A.ring.material.opacity=.4+.2*Math.sin(u*3);A.ring2.rotation.z=u*.6;A.ring.scale.setScalar(1+.03*Math.sin(u*3))}
function setPale(C,pale){if(!C||!C.obj)return;C.obj.traverse(o=>{if(o.isMesh&&!o.userData.keep&&o.material&&o.material.emissive){o.material.emissive.setRGB(.6,.55,.5);o.material.emissiveIntensity=pale*.9}})}
/* food */
const FOODS=GD.textos.FOODS;
function foodMesh(k){if(!SPH)SPH=new THREE.SphereGeometry(1,30,22);const g=grp();
  if(k===0){g.add(ell('#e0283a',.1,.115,.1,{gloss:1}));g.add(P(cone('#3ea838',.07,.06,{},6),0,.11,0));for(let a=0;a<6;a++){const q=P(ell('#ffe9a0',.012,.016,.008),Math.cos(a*1.05)*.085,Math.sin(a*2.1)*.05,Math.sin(a*1.05)*.07);g.add(q)}}
  if(k===1){const c=new THREE.Mesh(new THREE.CylinderGeometry(.11,.11,.045,18),M('#d9a35a'));g.add(c);for(const [x,z] of[[.04,.03],[-.05,.02],[0,-.06],[.06,-.04]])g.add(P(ell('#4a2a14',.02,.012,.02),x,.024,z));g.rotation.x=.5}
  if(k===2){g.add(ell('#d02a22',.11,.1,.11,{gloss:1}));g.add(P(cyl('#6a4a2a',.012,.012,.07),0,.14,0));g.add(R(P(ell('#58b04a',.05,.018,.03),.04,.12,0),0,0,.4))}
  if(k===3){g.add(ell('#ff7ab0',.085,.085,.085,{gloss:1}));for(const s of[-1,1])g.add(R(P(cone('#ffd0e4',.06,.1,{gloss:1},8),s*.12,0,0),0,0,-s*Math.PI/2));}
  return g}
let FOOD=null;
function mouthWorld(){const C=V.C,v=new THREE.Vector3();
  if(C.head&&V.chibi)return C.head.localToWorld(C.mouth?v.set(C.mouth[0],C.mouth[1],C.mouth[2]):v.set(0,-.16,.68));
  const m=C.m;if(C.obj&&m&&m.hc)return C.obj.localToWorld(v.set(m.hc[0],m.hc[1]-m.hr*.45,m.hc[2]+m.hr*1.25));
  return C.root.localToWorld(v.set(0,.2,.5))}
function feedPet(){
  const i=V.cur;if(i===undefined||FOOD||V.st==='run'||V.st==='belly')return;audio();
  const c=careOf(i);if(c.f>=96){mood('Tô cheinho! 😋');float('😋','love');tone(330,.12,'sine',.06);return}
  if(INV.food<=0){mood('Sem comida! Compre na loja 🛒');float('🛒','love');tone(220,.15,'sine',.06);setTimeout(()=>{renderShop();$('shMsg').textContent='Sua comida acabou: compre mais aqui 🍓';$('shop').hidden=false},450);return}
  INV.food--;saveInv();updFood();
  const k=Math.floor(Math.random()*FOODS.length),g=foodMesh(k);castAll(g);V.scene.add(g);
  const from=V.cam.position.clone().add(new THREE.Vector3(1.1*V.k,.9*V.k+.4,-3.6));
  setState('eat',2.6);V.ry=-.15;V.vy=0;
  FOOD={g,k,t0:performance.now(),from,done:0,i};mood('Que cheirinho! '+FOODS[k].e)}
function tickFood(){if(!FOOD)return;const F=FOOD,u=(performance.now()-F.t0)/1000,to=mouthWorld();
  const s=V.k*.9+.18;F.g.scale.setScalar(s);
  if(u<.95){const e=u/.95,e2=e*e*(3-2*e);F.g.position.lerpVectors(F.from,to,e2);F.g.position.y+=Math.sin(e*Math.PI)*.35;F.g.rotation.y=u*6;F.g.rotation.z=u*3}
  else if(u<1.9){F.g.position.copy(to);const q=1-(u-.95)/.95;F.g.scale.setScalar(s*Math.max(.02,q));F.g.position.y+=Math.sin(u*30)*.01;F.g.rotation.y=u*9;
    if(!F.munch||((u*1000|0)%230<16&&!F.last)){}}
  if(u>=.95&&!F.done){F.done=1;careGain(F.i,'f',34);float(FOODS[F.k].e,'love');for(let q=0;q<4;q++)setTimeout(()=>tone(150+Math.random()*60,.05,'square',.05),q*170)}
  if(u>=1.9){V.scene.remove(F.g);FOOD=null;mood('Nham nham! 😋')}}
function petBtn(){const i=V.cur;if(i===undefined||V.st==='run'||V.st==='belly')return;audio();setState('pet',2.6);V.side=Math.random()<.5?-1:1;
  for(let k=0;k<3;k++)setTimeout(()=>float('❤','love'),k*150);tone(620,.25,'sine',.06);setTimeout(()=>tone(880,.3,'sine',.05),180);careGain(i,'l',20)}
function playBtn(){const i=V.cur;if(i===undefined||V.st==='belly'||V.st==='tired')return;audio();
  if(careOf(i).p>=96){V.tireN=(V.tireN||0)+1;
    if(V.tireN>=3){if(V.C&&V.C.root){V.C.root.position.x=0;V.C.root.position.z=0;V.C.root.rotation.y=0}V.tireN=0;setState('tired',7);V.vy=0;[0,1,2,3,4].forEach(k=>setTimeout(()=>float(['😮‍💨','💦','💤'][k%3],'love'),k*380));tone(260,.35,'sine',.06);setTimeout(()=>tone(196,.5,'sine',.05),300);return}
    if(V.st!=='run')setState('run',2.2);mood('Ufa... tô ficando cansado 😮‍💨');float('💦','love');return}
  if(V.st==='run')return;V.tireN=0;setState('run',4.2);float('💨','love');
  [523,659,784,1047].forEach((f,k)=>setTimeout(()=>tone(f,.07,'square',.04),k*70));careGain(i,'p',30)}
$('cFeed').addEventListener('click',feedPet);$('cPet').addEventListener('click',petBtn);$('cPlay').addEventListener('click',playBtn);
setInterval(()=>{if(V.open)renderCare()},2500);
/* ---------- partes extras nos 10 bichos que reaproveitam o corpo de outro: o corpo fica, entram as peças da referência ---------- */
let XMAT=null;const XM=()=>XMAT||(XMAT=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.95,metalness:0}));
const XS=(pr,k,st,nz)=>{const m=sdfMesh(pr,k||.012,st||.006,nz||0);m.material=XM();return m};
const DIR=(m,p,d)=>{m.position.set(p[0],p[1],p[2]);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(d[0],d[1],d[2]).normalize());return m};
const xsph=(r,col,x,y,z)=>{const m=XS([{c:[0,0,0],r:[r,r,r],col,w:1}],.012,.006);m.position.set(x,y,z);return m};
function dens(pts,r0,r1){const o=[pts[0]];for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],d=Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2]),rr=Math.max(r1,.015),n=Math.max(1,Math.ceil(d/(rr*.9)));for(let q=1;q<=n;q++){const t=q/n;o.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t])}}return o}
function xblade(pts,r0,r1,col,flat,tipCol){pts=dens(pts,r0,r1);const n=pts.length;return XS(pts.map((p,i)=>{const t=i/(n-1),r=r0+(r1-r0)*t;return{c:p,r:[Math.max(.016,r*(flat||.2)),Math.max(.022,r),Math.max(.022,r)],col:(tipCol&&i>n*.7)?tipCol:col,w:1}}),.012,.0055)}
function xchain(pts,r0,r1,col,tipCol){pts=dens(pts,r0,r1);const n=pts.length;return XS(pts.map((p,i)=>{const t=i/(n-1),r=r0+(r1-r0)*t;return{c:p,r:[r,r,r],col:(tipCol&&i>n*.75)?tipCol:col,w:1}}),.014,.0055)}
function xleaf(len,wid,col,vein){const pr=[{c:[0,len*.5,0],r:[.008,len*.5,wid],col,w:1},{c:[0,len*.9,0],r:[.007,len*.2,wid*.35],col,w:1}];if(vein)pr.push({c:[.006,len*.5,0],r:[.004,len*.48,.004],col:vein,w:12,paint:1});return XS(pr,.01,.005)}
function xcone(col,r,h,seg,glow){const g=new THREE.ConeGeometry(r,h,seg||10);g.translate(0,h/2,0);return new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:new THREE.Color(col).convertSRGBToLinear(),roughness:.9}))}
function xbl(pts){return pts}
const curveYZ=(f,n,sx)=>curve(t=>{const p=f(t);return[sx*p[0],p[1],p[2]]},n);
// each entry returns {head:[meshes],body:[meshes],tail:[meshes],wings:[{w,s}]} positioned in the model's own units
const EXTRA={
 1:()=>{const H=[];for(const s of[-1,1]){
    H.push(xblade(curveYZ(t=>[.07+.07*t,.36+.1*Math.sin(t*2.3)-.03*t*t,.34-.5*t],16,s),.05,.013,'#3b6ccc',.22));
    H.push(xblade(curveYZ(t=>[.09+.1*t,.33+.04*Math.sin(t*2.4),.31-.42*t],14,s),.04,.012,'#7ea8ee',.22))}
   return{head:H}},
 3:()=>{const H=[],T=[];for(const [x,a] of[[0,0],[-.04,.35],[.04,-.35]]){H.push(xblade([[x,.5,.12],[x*1.6,.58,.08],[x*2.2,.66,.02]],.03,.016,'#b6a4e6',.4))}
   for(let k=-2;k<=2;k++)T.push(xblade([[k*.02,.15,-.28],[k*.06,.2,-.45],[k*.1,.2,-.62]],.03,.008,k%2?'#cdbff0':'#e8e2f6',.3));return{head:H,tail:T}},
 5:()=>{const B=[],H=[],cols=['#6fae3c','#4e8e2c','#8cc84a','#5a9a32'];let q=0;
   for(const z of[.3,.12,-.06,-.24,-.4])for(const s of[-1,1]){const L=xleaf(.13,.045,cols[q++%4],'#c8e88a');DIR(L,[s*.07,.41-Math.abs(z)*.05,z],[s*.8,.5,-.3]);B.push(L)}
   for(const s of[-1,1]){const L=xleaf(.16,.055,'#6fae3c','#c8e88a');DIR(L,[s*.05,.4,.33],[s*.6,.6,-.35]);H.push(L)}
   const L=xleaf(.12,.04,'#8cc84a','#c8e88a');DIR(L,[0,.42,.36],[0,.7,.1]);H.push(L);return{head:H,body:B}},
 7:()=>{const T=[],y='#f2c12e',k='#3a2a1a';
   const zz=[];for(let i=0;i<9;i++)zz.push([i%2?.045:-.045,.28+.04*i,-.42-.06*i]);T.push(xblade(zz,.05,.012,y,.25,k));
   const H=[];for(const s of[-1,1])H.push(xblade(curveYZ(t=>[.05+.05*t,.4+.16*t,.33-.12*t],10,s),.04,.006,y,.25,k));return{head:H,tail:T}},
 9:()=>{const H=[],T=[],cream='#efe0b8',navy='#1d2f6a';
   const m=new THREE.Mesh(new THREE.TorusGeometry(.055,.024,10,24,Math.PI*1.5),new THREE.MeshStandardMaterial({color:new THREE.Color(cream).convertSRGBToLinear(),roughness:.4,emissive:0x6a5a2a,emissiveIntensity:.5}));m.position.set(.0,.58,.3);m.rotation.set(0,0,.6);H.push(m);
   T.push(xchain(curve(t=>{const a=t*Math.PI*1.5;return[0,.3+.4*t,-.45-.3*Math.sin(t*Math.PI*.95)*(1-t*.25)]},20),.075,.04,navy));return{head:H,tail:T}},
 12:()=>{const B=[],H=[],w='#f7f9ff',b='#5f8fd6';let sd=7;const rnd=()=>{sd=(sd*16807)%2147483647;return sd/2147483647-.5};
   const puff=(x,y,z,r,col)=>{const pr=[{c:[0,0,0],r:[r*.7,r*.7,r*.7],col,w:1}];for(let i=0;i<12;i++){const d=[rnd(),rnd(),rnd()],l=Math.hypot(...d)||1;pr.push({c:[d[0]/l*r*.62,d[1]/l*r*.62,d[2]/l*r*.62],r:[r*.42,r*.42,r*.42],col,w:1})}const m=XS(pr,.016,.0065,.01);m.position.set(x,y,z);return m};
   for(let i=0;i<14;i++){const a=i/14*Math.PI*2,x=Math.sin(a)*.25,z=-.08+Math.cos(a)*.42;if(z>.24)continue;B.push(puff(x,.2,z,.1,w));B.push(puff(x*.96,.36,z,.1,i%5===1?b:w))}
   for(let i=0;i<9;i++){const a=i/9*Math.PI*2,x=Math.sin(a)*.14,z=-.1+Math.cos(a)*.3;B.push(puff(x,.5,z,.085,i%3===0?b:w))}
   for(const [x,z] of[[.27,.0],[-.27,.0],[.2,-.3],[-.2,-.3]])B.push(puff(x,.46,z,.075,b));
   for(const s of[-1,1])H.push(puff(s*.13,.53,.3,.07,b),puff(s*.16,.46,.27,.06,w));return{head:H,body:B}},
 15:()=>{const B=[],cols=['#f08a6a','#ffb04a','#c870c8','#5a8ad8','#f06a8a','#ffd070','#4ac8c8'];
   B.push(XS([{c:[0,.33,-.1],r:[.27,.03,.35],col:'#2c4fa0',w:1}],.02,.008));
   B.push(XS([{c:[0,.37,-.1],r:[.23,.06,.31],col:'#a85a2a',w:1},{c:[0,.42,-.1],r:[.15,.04,.22],col:'#c47a36',w:1}],.03,.009));
   let q=0;for(const [x,y,z,l,dx,dz] of[[.1,.44,.05,.13,.4,-.2],[-.1,.44,.05,.13,-.4,-.2],[0,.46,-.1,.17,0,0],[.12,.43,-.2,.14,.4,.1],[-.12,.43,-.2,.14,-.4,.1],[0,.44,.12,.11,0,.4],[.06,.44,-.3,.12,.2,.3],[-.06,.44,-.3,.12,-.2,.3],[.14,.4,-.05,.12,.7,0],[-.14,.4,-.05,.12,-.7,0]]){
     const c=cols[q++%7],g=grp();for(const [a,h] of[[0,1],[-.55,.65],[.55,.65]]){const k=xcone(c,.024,l*h,8);k.rotation.z=a;g.add(k)}DIR(g,[x,y,z],[dx,1,dz]);B.push(g)}
   return{body:B}},
 17:()=>{const B=[],H=[],W=[];
   const wing=(big)=>{const sh=new THREE.Shape();const w=big?.52:.34,h=big?.32:.22;sh.moveTo(0,0);sh.bezierCurveTo(w*.3,h*1.15,w*1.1,h*1.1,w,h*.4);sh.bezierCurveTo(w*.95,0,w*.4,-h*.1,0,0);
     const geo=new THREE.ShapeGeometry(sh,16),pa=geo.attributes.position,cl=new Float32Array(pa.count*3),c1=new THREE.Color(big?0x9fe4f6:0xffb0e0).convertSRGBToLinear(),c2=new THREE.Color(big?0xf6b4e8:0xb8ecf8).convertSRGBToLinear(),cc=new THREE.Color();
     for(let i=0;i<pa.count;i++){const u=Math.min(1,Math.max(0,(pa.getX(i)/w*.6+pa.getY(i)/h*.4)));cc.copy(c1).lerp(c2,u);cl[i*3]=cc.r;cl[i*3+1]=cc.g;cl[i*3+2]=cc.b}
     geo.setAttribute('color',new THREE.BufferAttribute(cl,3));
     const m=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({vertexColors:true,transparent:true,opacity:.86,side:THREE.DoubleSide,roughness:.4,emissive:0x7a6a9a,emissiveIntensity:.35,depthWrite:false}));
     const g=grp();g.add(m);return g};
   for(const s of[-1,1]){const a=wing(1);a.scale.x=1;a.scale.x=s;a.position.set(s*.05,.36,-.06);a.rotation.set(0,-s*.55,s*.12);a.userData.keep=1;B.push(a);W.push({w:a,s:1,z:a.rotation.z});
     const c=wing(0);c.scale.x=s;c.position.set(s*.05,.32,-.1);c.rotation.set(0,-s*.6,s*-.45);B.push(c);W.push({w:c,s:-1,z:c.rotation.z})}
   for(const s of[-1,1])H.push(xsph(.04,'#f06a8a',s*.07,.5,.34));H.push(xsph(.025,'#f6a0c0',0,.5,.35));return{head:H,body:B,wings:W}},
 18:()=>{const B=[],H=[],T=[],p='#6b3fc4',d='#3f2490';
   for(let i=0;i<7;i++){const k=xcone(i%2?p:d,.032-i*.002,.12-i*.007,8);DIR(k,[0,.45-i*.005,.22-i*.1],[0,1,-.3-i*.05]);B.push(k)}
   for(const s of[-1,1]){const k=xcone(p,.028,.11,8);DIR(k,[s*.09,.42,.33],[s*.4,1,-.2]);H.push(k)}
   for(let i=0;i<4;i++){const k=xcone(i%2?p:d,.028,.1,8);DIR(k,[0,.3,-.3-.07*i],[0,.8,-.7]);T.push(k)}return{head:H,body:B,tail:T}},
 19:()=>{const H=[],B=[],g1='#d6a64c',g2='#f0cf7a';
   for(const s of[-1,1]){H.push(xchain(curveYZ(t=>[.07+.05*Math.sin(t*2.4),.4+.13*t,.3-.24*t],12,s),.026,.008,g1,g2))}
   return{head:H,body:B}}
};
function attachExtras(obj,i,m){const f=NOEXTRA.has(i)?null:EXTRA[i];if(!f)return null;const E=f(),hp=m.hp,tp=m.tp;
  const hpG=new THREE.Group();hpG.position.fromArray(hp);hpG.rotation.order='YXZ';obj.add(hpG);
  const tpG=new THREE.Group();tpG.position.fromArray(tp);obj.add(tpG);
  const add=(g,arr,piv)=>{for(const o of arr||[]){o.position.set(o.position.x-piv[0],o.position.y-piv[1],o.position.z-piv[2]);g.add(o)}};
  // the pieces are placed in model units; pieces built at the origin carry their own position
  add(hpG,E.head,hp);add(tpG,E.tail,tp);for(const o of E.body||[])obj.add(o);
  const wings=(E.wings||[]).map(w=>w);
  hpG.traverse(o=>o.userData.keep=1);tpG.traverse(o=>o.userData.keep=1);for(const o of E.body||[])o.traverse(q=>q.userData.keep=1);
  return{hpG,tpG,wings,segs:[],xw:wings.length>0}}
/* viewer extras: tags, mood label, browse captured plushes, gesture help */
const ELNAME=GD.pelucias.ELNAME;
const MOODS=GD.textos.MOODS;
let moodT=0;
function mood(txt){const el=$('vMood');if(!el)return;if(!txt){el.classList.remove('on');return}el.textContent=txt;el.classList.add('on');clearTimeout(moodT);moodT=setTimeout(()=>el.classList.remove('on'),2200)}
function vTags(i){const p=PLUSH[i],r=p.rare<=2?3:p.rare<=4?2:1;
  $('vTags').innerHTML='<span>'+(ELNAME[ELEM[i]]||'')+'</span><span class="r'+r+'">'+['','Comum ★','Rara ★★','Lendária ★★★'][r]+'</span>';
  const own=PLUSH.filter(q=>coll[q.i]).map(q=>q.i);V.cur=i;V.own=own;const many=own.length>1;$('vPrev').hidden=$('vNext').hidden=!many}
function vStep(d){const o=V.own||[];if(o.length<2)return;let k=o.indexOf(V.cur);k=(k+d+o.length)%o.length;audio();click(700);openViewer(o[k])}
$('vPrev').addEventListener('click',()=>vStep(-1));$('vNext').addEventListener('click',()=>vStep(1));
$('vHelp').addEventListener('click',()=>{const g=$('gest'),open=g.hidden;g.hidden=!open;$('vHelp').setAttribute('aria-expanded',open)});
addEventListener('keydown',e=>{if(!V.open)return;if(['Escape','ArrowLeft','ArrowRight',' ','ArrowDown'].includes(e.key))e.stopImmediatePropagation();if(e.key==='Escape')closeViewer();if(e.key==='ArrowLeft')vStep(-1);if(e.key==='ArrowRight')vStep(1)},true);
/* ---------- attract screen: the real 3D claw machine ---------- */
(function attract(){const el=$('attract');if(!window.THREE||!THREE.GLTFLoader)return;
  let R;try{R=new THREE.WebGLRenderer({canvas:$('a3d'),antialias:true,alpha:true})}catch(e){return}
  el.hidden=false;R.setPixelRatio(Math.min(devicePixelRatio||1,2));R.outputEncoding=THREE.sRGBEncoding;R.shadowMap.enabled=true;R.shadowMap.type=THREE.PCFSoftShadowMap;
  const sc=new THREE.Scene(),cam=new THREE.PerspectiveCamera(34,1,.05,50);
  sc.add(new THREE.HemisphereLight(0xfff0f6,0x3a1830,.75));
  const k=new THREE.DirectionalLight(0xffffff,1.1);k.position.set(1.6,3.2,2.4);k.castShadow=true;k.shadow.mapSize.set(1024,1024);Object.assign(k.shadow.camera,{left:-1.2,right:1.2,top:1.6,bottom:-.4,near:.5,far:8});k.shadow.radius=4;sc.add(k);
  const pk=new THREE.PointLight(0xff4f9a,1.2,4);pk.position.set(-1,1.2,1);sc.add(pk);const bl=new THREE.PointLight(0x4f8aff,.9,4);bl.position.set(1.1,.6,-.8);sc.add(bl);
  const ft=floorTex('stars'),fl=new THREE.Mesh(new THREE.CircleGeometry(1.25,64),new THREE.MeshStandardMaterial({map:ft.map,emissiveMap:ft.glow,emissive:0xffffff,emissiveIntensity:.6,transparent:true,roughness:.6}));
  fl.rotation.x=-Math.PI/2;fl.receiveShadow=true;sc.add(fl);
  const sh=new THREE.Mesh(new THREE.PlaneGeometry(.75,.75),new THREE.MeshBasicMaterial({map:shadowTex(),transparent:true,depthWrite:false}));sh.rotation.x=-Math.PI/2;sh.position.y=.004;sc.add(sh);
  const spin=new THREE.Group();sc.add(spin);let t0=performance.now(),raf=0,leaving=0,ok=false;
  const size=()=>{const w=innerWidth,h=innerHeight;R.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix()};size();addEventListener('resize',size);
  loadGLB({file:'models/machine.glb'}).then(src=>{const o=src.clone(true);o.traverse(m=>{if(m.isMesh){if(!m.geometry.attributes.normal)weldNormals(m.geometry);m.castShadow=true;
      const mm=m.material.clone();if(mm.map)mm.map.encoding=THREE.sRGBEncoding;mm.roughness=.55;mm.metalness=.1;m.material=mm}});
    const b=new THREE.Box3().setFromObject(o),z=b.getSize(new THREE.Vector3()),s=1.3/z.y;o.scale.setScalar(s);o.position.set(-(b.min.x+z.x/2)*s,0,-(b.min.z+z.z/2)*s);spin.add(o);ok=true}).catch(()=>{});
  const target=new THREE.Vector3(0,.82,.6);
  function loop(now){const t=(now-t0)/1000;
    if(!leaving){spin.rotation.y=Math.sin(t*.35)*.55;const fit=Math.max(1,.62/cam.aspect);cam.position.set(Math.sin(t*.2)*.15,.95,2.9*fit);cam.lookAt(0,.62,0)}
    else{const u=Math.min(1,(now-leaving)/900);spin.rotation.y*=.88;cam.position.lerp(target,.12);cam.lookAt(0,.78,0);if(u>=1){end();return}}
    fl.material.emissiveIntensity=.5+Math.sin(t*2)*.15;pk.intensity=1+Math.sin(t*3)*.3;
    R.render(sc,cam);raf=requestAnimationFrame(loop)}
  function end(){cancelAnimationFrame(raf);el.classList.add('out');setTimeout(()=>{el.hidden=true;try{R.dispose();R.forceContextLoss&&R.forceContextLoss()}catch(e){}},520)}
  $('play').addEventListener('click',()=>{audio();if(leaving)return;leaving=performance.now();[392,523,659,784].forEach((f,i)=>setTimeout(()=>tone(f,.12,'triangle',.1),i*80));if(!ok)end()});
  raf=requestAnimationFrame(loop);
})();
/* ---------- Flarion: raposa de fogo montada em código, igual à folha de referência ---------- */
const FOXC=GD.modelos.FOXC;
let FLM=null;
function flameLeaf(len,wid,c0,c1,bend,seed){
  const sh=new THREE.Shape();sh.moveTo(0,0);sh.bezierCurveTo(wid*1.5,len*.2,wid*1.3,len*.82,wid*.1,len);sh.bezierCurveTo(-wid*.9,len*.88,-wid*1.4,len*.3,0,0);
  const g=new THREE.ShapeGeometry(sh,14),p=g.attributes.position,n=p.count,col=new Float32Array(n*3),A=new THREE.Color(c0).convertSRGBToLinear(),B=new THREE.Color(c1).convertSRGBToLinear();
  for(let i=0;i<n;i++){const t=Math.min(1,Math.max(0,p.getY(i)/len)),u=Math.min(1,t*1.15);p.setZ(i,t*t*bend*len);col[i*3]=A.r+(B.r-A.r)*u;col[i*3+1]=A.g+(B.g-A.g)*u;col[i*3+2]=A.b+(B.b-A.b)*u}
  g.setAttribute('color',new THREE.BufferAttribute(col,3));g.computeVertexNormals();
  FLM=FLM||new THREE.MeshStandardMaterial({vertexColors:true,roughness:.85,metalness:0,side:THREE.DoubleSide});
  return new THREE.Mesh(g,FLM)}
function leafAt(parent,pos,dir,len,wid,c0,c1,bend,roll){const m=flameLeaf(len,wid,c0,c1,bend);m.position.set(pos[0],pos[1],pos[2]);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(dir[0],dir[1],dir[2]).normalize());m.rotateY(roll||0);parent.add(m);return m}
function buildFox(evo){
  if(!SPH)SPH=new THREE.SphereGeometry(1,30,22);
  const F=FOXC,body=grp(),root=grp(),C={root,body,ears:[],legs:[],eyes:[],lids:[],brows:[],segs:[],wings:[],smoke:[]};root.add(body);
  // corpo: tronco baixo e fofo, peito largo, manchas escuras nos flancos
  const bp=[{c:[0,-.12,-.12],r:[.37,.33,.5],col:F.o},{c:[0,-.1,.22],r:[.34,.33,.3],col:F.o},{c:[0,-.2,-.5],r:[.3,.28,.3],col:F.o}];
  for(const s of[-1,1]){bp.push({c:[s*.34,-.08,-.18],r:[.1,.12,.14],col:F.dk,w:5,paint:1},{c:[s*.3,-.24,-.4],r:[.1,.08,.12],col:F.dk,w:5,paint:1},{c:[s*.28,.12,-.35],r:[.09,.07,.1],col:F.r,w:5,paint:1},{c:[s*.2,.2,-.1],r:[.14,.06,.2],col:F.o2,w:3,paint:1})}
  bp.push({c:[0,-.38,.0],r:[.22,.08,.4],col:F.cr,w:3,paint:1});
  body.add(sdfMesh(bp,.1,.034,.004));
  // gola creme: peito felpudo de lóbulos macios
  const ru=[{c:[0,-.22,.36],r:[.3,.26,.22],col:F.cr,w:1},{c:[0,-.34,.34],r:[.24,.16,.22],col:F.cr,w:1}];
  for(let k=0;k<11;k++){const a=(k-5)/5,x=a*.3;ru.push({c:[x,-.34+Math.abs(a)*.12+(k%2?-.04:.02),.46-Math.abs(a)*.1],r:[.1,.1,.1],col:F.cr,w:1})}
  for(const s of[-1,1])ru.push({c:[s*.27,-.14,.34],r:[.1,.16,.14],col:F.cr,w:1});
  body.add(sdfMesh(ru,.05,.03,.004));
  // juba de chamas: folhas de fogo largas varridas para trás, por cima do pescoço e das costas
  let sd=7;const rnd=()=>(sd=(sd*16807)%2147483647)/2147483647;
  for(let q=0;q<5;q++)for(const x of[-.34,-.17,0,.17,.34]){const z0=.2-q*.2-Math.abs(x)*.3,y0=.2-Math.abs(x)*.35+(q?0:.05);
    leafAt(body,[x,y0,z0],[x*1.3,.5+rnd()*.25,-.8-rnd()*.3],.66+rnd()*.2-q*.05,.2+rnd()*.06,q%2?'#e4501a':'#f06a22',rnd()>.5?'#ffc23a':'#ffa52e',.14,rnd()*3)}
  // pernas: coxa laranja, canela e pata escuras
  [[-.2,.3,1],[.2,.3,1],[-.22,-.42,0],[.22,-.42,0]].forEach(([x,z,fr])=>{const g=P(grp(),x,-.27,z);g.userData.front=!!fr;
    g.add(sdfMesh([{c:[0,-.07,0],r:[.13,.17,.13],col:F.o,w:1},{c:[0,-.21,0],r:[.1,.1,.1],col:F.paw,w:1},{c:[0,-.3,.05],r:[.11,.06,.15],col:F.paw,w:1}],.05,.03,0));
    if(fr)for(const tx of[-1,0,1])g.add(P(ell('#150a08',.022,.02,.03),tx*.05,-.33,.19));
    body.add(g);C.legs.push(g)});
  C.feet=-.6;
  // cabeça
  const head=P(grp(),0,0,0);head.userData.part='head';body.add(head);C.head=head;
  const hp=[{c:[0,0,0],r:[.34,.29,.3],col:F.o},{c:[0,-.07,.27],r:[.12,.1,.19],col:F.o2,w:2},{c:[0,-.14,.12],r:[.2,.08,.2],col:F.cr,w:2,paint:1},{c:[0,-.13,.36],r:[.08,.05,.1],col:F.cr,w:6,paint:1}];
  for(const s of[-1,1]){hp.push({c:[s*.3,-.1,.06],r:[.1,.14,.2],col:F.cr,w:2,paint:1},{c:[s*.14,.2,.2],r:[.06,.05,.07],col:F.dk,w:5,paint:1})}
  hp.push({c:[0,.14,.24],r:[.035,.07,.05],col:F.r,w:4,paint:1});
  const hm=sdfMesh(hp,.08,.028,.003);head.add(hm);hm.updateMatrixWorld(true);const rc=new THREE.Raycaster();
  const hitAt=(o,d)=>{rc.set(o,d.clone().normalize());const h=rc.intersectObject(hm,false)[0];return h?h.point:o.clone().add(d.clone().multiplyScalar(-1.5))};
  const zAt=(x,y)=>hitAt(new THREE.Vector3(x,y,2),new THREE.Vector3(0,0,-1)).z;
  head.add(P(ell('#120808',.05,.038,.04,{gloss:1}),0,-.04,zAt(0,-.04)-.005));
  const tube=new THREE.MeshStandardMaterial({color:new THREE.Color('#3a1812').convertSRGBToLinear(),roughness:.6});
  for(const s of[-1,1]){const a=new THREE.Mesh(new THREE.TorusGeometry(.04,.009,6,14,Math.PI),tube);a.rotation.z=Math.PI;a.position.set(s*.04,-.13,zAt(s*.04,-.13)+.004);head.add(a)}
  const nl=new THREE.Mesh(new THREE.BoxGeometry(.009,.05,.009),tube);nl.position.set(0,-.09,zAt(0,-.09)+.003);head.add(nl);
  const tg=P(ell('#ff7d9a',.04,.016,.06,{gloss:1}),0,-.17,zAt(0,-.17)-.04);tg.userData.base=tg.scale.clone();tg.visible=false;head.add(tg);C.tongue=tg;
  // olhos (no lugar certo da superfície)
  const er=.088;
  for(const s of[-1,1]){const x=s*.14,y=.07,z=zAt(x,y),d=new THREE.Vector3(s*.45,.15,1).normalize(),eo=P(grp(),x-d.x*.03,y-d.y*.03,z-d.z*.03);eo.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),d);head.add(eo);
    const eg=grp();eo.add(eg);
    eg.add(ell('#150b0a',er*1.05,er*1.15,er*.55,{gloss:1}));
    eg.add(P(ell('#4a2412',er*.8,er*.9,er*.5,{gloss:1}),0,0,er*.12));
    eg.add(P(ell('#050303',er*.58,er*.66,er*.42,{gloss:1}),0,0,er*.3));
    const hl=new THREE.Mesh(SPH,new THREE.MeshBasicMaterial({color:0xffffff}));hl.scale.set(er*.26,er*.28,er*.2);P(hl,er*.3,er*.34,er*.7);eg.add(hl);
    const lid=new THREE.Mesh(new THREE.SphereGeometry(er*1.18,20,10,0,Math.PI*2,0,Math.PI/2),M(F.o));lid.scale.set(1,1.1,1);lid.rotation.x=-1.95;eg.add(lid);C.lids.push(lid);
    const brow=new THREE.Mesh(new THREE.BoxGeometry(er*1.7,er*.32,er*.35),M('#2a1a1e',{gloss:1}));P(brow,0,er*1.3,er*.5);brow.rotation.z=s*.5;brow.visible=false;eg.add(brow);C.brows.push(brow)}
  // orelhas de raposa: altas, laranja por fora, escuras por dentro, ponta escura
  for(const s of[-1,1]){const g=P(grp(),s*.2,.22,-.04);g.rotation.set(0,0,-s*.38);g.scale.setScalar(1.02);head.add(g);C.ears.push(g);
    g.add(sdfMesh([{c:[0,0,0],r:[.15,.12,.07],col:F.o,w:1},{c:[0,.2,0],r:[.12,.2,.055],col:F.o,w:1},{c:[0,.4,0],r:[.04,.15,.035],col:'#5a2418',w:10},{c:[0,.2,.045],r:[.075,.2,.035],col:'#2a100c',w:9,paint:1},{c:[0,.05,.05],r:[.08,.07,.03],col:F.cr,w:6,paint:1}],.05,.02,.002));
  }
  for(const s of[-1,1])for(let q=0;q<3;q++)leafAt(head,[s*(.12+q*.03),.22,-.12-q*.05],[s*.25,.8,-.6],.4+q*.04,.1,'#e4501a','#ffb02e',.12,q);
  for(let q=0;q<4;q++){const x=(q-1.5)*.07;leafAt(head,[x,.24,-.02-Math.abs(x)],[x*2,.7,-.5],.42+(q%2)*.1,.1,'#f06a22','#ffc23a',.1,q)}
  for(const s of[-1,1])for(let q=0;q<4;q++)leafAt(head,[s*.3,-.12+q*.07,.0-q*.03],[s*.5,.12-q*.04,-1],.36-q*.03,.11,q%2?'#f08a2a':'#e4581e','#ffc940',.1,q);
  // tufos creme no peito e nas bochechas
  for(let k=0;k<11;k++){const a=(k-5)/5;leafAt(body,[a*.3,-.16,.5-Math.abs(a)*.12],[a*1.1,-.9,.5],.26,.13,'#f2dfc0','#fff8e8',.15,k)}
  for(let k=0;k<9;k++){const a=(k-4)/4;leafAt(body,[a*.26,-.3,.46-Math.abs(a)*.1],[a*1.0,-1,.2],.24,.13,'#f2dfc0','#fff8e8',.15,k+2)}
  for(const s of[-1,1])for(let q=0;q<3;q++)leafAt(head,[s*.26,-.14-q*.03,.1],[s*1,-.5-q*.2,.6],.22,.12,'#f5e4c6','#fff8e8',.15,q);
  // cauda enorme de chamas, enrolada para cima
  const tail=P(grp(),0,-.12,-.58);tail.rotation.x=.25;body.add(tail);C.tail=tail;C.tailBase=.25;
  const tp=[[0,0,0],[0,.02,-.2],[0,.12,-.4],[0,.32,-.52],[0,.58,-.52],[0,.8,-.4]];
  tail.add(xchain(tp,.18,.1,F.o,F.o2));
  for(let q=0;q<28;q++){const t=.15+q/27*.85,py=.05+t*.85,pz=-.3-Math.sin(t*2.3)*.28,side=(q%3-1);
    leafAt(tail,[side*.07,py,pz],[side*.55,.6+t*.5,-.25+t*.45],.62+t*.28,.28,q%3?'#e4501a':'#c8391a',q%2?'#ffc23a':'#ffa52e',.14,q)}
  leafAt(tail,[0,.8,-.35],[0,1,.15],.8,.3,'#f06a22','#ffd04a',.1,0);
  if(evo){// Flarion Inferno: asas de chamas, juba maior e brilho
    for(const s of[-1,1]){const w=P(grp(),s*.14,.2,-.02);body.add(w);for(let k=0;k<9;k++){const t=k/8,a=(-10+t*95)*Math.PI/180;leafAt(w,[0,0,0],[s*Math.cos(a),Math.sin(a),-.35-.3*t],.95-.25*Math.abs(t-.3),.2,t<.5?'#e4501a':'#f06a22',t<.5?'#ffb02e':'#ffd64a',.18,0)}C.wings.push(w)}
    for(let q=0;q<10;q++){const x=(q%5-2)*.14;leafAt(body,[x,.25,.1-Math.floor(q/5)*.2],[x*1.3,.6,-.8],.8,.22,'#f06a22','#ffd04a',.15,q)}}
  head.position.set(0,.27,.4);head.scale.setScalar(1.3);C.lidOpen=-1.95;C.baseY=0;C.mouth=[0,-.12,.45];C.headTest=lp=>lp.z>-.2&&lp.y>-.3;return C}
function foxSize(id){const C=PROC[id](false);C.root.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(C.root),z=b.getSize(new THREE.Vector3());return{xz:Math.max(z.x,z.z),y:z.y}}
let FOXSZ={};

/* ---------- Nimbri: carneirinho de nuvem montado em código, igual à folha de referência ---------- */
function buildCloud(evo){
  if(!SPH)SPH=new THREE.SphereGeometry(1,30,22);
  const W='#f4f6fb',W2='#dde7f7',B='#6f9be0',B2='#9dbcf0',body=grp(),root=grp(),C={root,body,ears:[],legs:[],eyes:[],lids:[],brows:[],segs:[],wings:[],smoke:[]};root.add(body);
  let sd=11;const rnd=()=>(sd=(sd*16807)%2147483647)/2147483647;
  // corpo: couve-flor de bolinhas de algodão brancas, algumas azuladas
  const bp=[{c:[0,-.05,-.08],r:[.46,.38,.55],col:W}];
  for(let k=0;k<38;k++){const t=(k+.5)/38,ph=Math.acos(1-2*t),th=Math.PI*(1+Math.sqrt(5))*k,x=Math.sin(ph)*Math.cos(th),y=Math.cos(ph),z=Math.sin(ph)*Math.sin(th);
    if(y<-.55)continue;const r=.17+rnd()*.08;bp.push({c:[x*.52,-.03+y*.42,-.1+z*.58],r:[r,r,r],col:k%5===2?W2:W,w:1})}
  body.add(sdfMesh(bp,.028,.03,.006));
  // golinha de pelo ao redor do pescoço
  const nk=[];for(let k=0;k<9;k++){const a=(k/9)*Math.PI*2;nk.push({c:[Math.cos(a)*.28,.02+Math.sin(a)*.2,.34],r:[.15,.15,.15],col:k%3?W:W2,w:1})}
  body.add(sdfMesh(nk,.03,.03,.005));
  // pernas curtas, patinhas azul-claras
  [[-.2,.3,1],[.2,.3,1],[-.22,-.4,0],[.22,-.4,0]].forEach(([x,z,fr])=>{const g=P(grp(),x,-.34,z);g.userData.front=!!fr;
    g.add(sdfMesh([{c:[0,-.08,0],r:[.14,.15,.14],col:W,w:1},{c:[0,-.22,.04],r:[.11,.06,.14],col:B2,w:1}],.04,.03,0));body.add(g);C.legs.push(g)});
  C.feet=-.62;
  // cauda: nuvem grande de bolinhas azuis e brancas
  const tail=P(grp(),0,.0,-.62);tail.rotation.x=.2;body.add(tail);C.tail=tail;C.tailBase=.2;
  const tp=[];[[-.12,.12,-.12,.17,B],[.08,.3,-.2,.18,B2],[-.16,.46,-.1,.15,B],[.12,.14,-.3,.17,W],[0,.0,-.1,.17,W],[.16,.42,-.28,.14,B2],[-.06,.26,-.34,.15,B],[.2,.26,-.08,.13,W2],[-.2,.28,-.26,.14,B2],[.02,.46,-.24,.13,B]].forEach(([x,y,z,r,c])=>tp.push({c:[x,y,z],r:[r,r,r],col:c,w:c===B||c===B2?4:1}));
  tail.add(sdfMesh(tp,.03,.03,.005));
  // cabeça pequena e branca
  const head=P(grp(),0,0,0);head.userData.part='head';body.add(head);C.head=head;
  const hp=[{c:[0,0,0],r:[.29,.25,.27],col:W},{c:[0,-.07,.22],r:[.13,.1,.12],col:W,w:1},{c:[0,-.1,.3],r:[.04,.03,.03],col:B2,w:5,paint:1}];
  for(const s of[-1,1])hp.push({c:[s*.2,-.1,.1],r:[.14,.13,.14],col:W,w:1});
  const hm=sdfMesh(hp,.05,.026,.004);head.add(hm);hm.updateMatrixWorld(true);const rc=new THREE.Raycaster();
  const zAt=(x,y)=>{rc.set(new THREE.Vector3(x,y,2),new THREE.Vector3(0,0,-1));const h=rc.intersectObject(hm,false)[0];return h?h.point.z:.25};
  head.add(P(ell('#8fb4ee',.036,.026,.03,{gloss:1}),0,-.07,zAt(0,-.07)-.004));
  const tube=new THREE.MeshStandardMaterial({color:new THREE.Color('#6a86b8').convertSRGBToLinear(),roughness:.6});
  for(const s of[-1,1]){const a=new THREE.Mesh(new THREE.TorusGeometry(.035,.008,6,14,Math.PI),tube);a.rotation.z=Math.PI;a.position.set(s*.035,-.12,zAt(s*.035,-.12)+.004);head.add(a)}
  const tg=P(ell('#ff7d9a',.035,.014,.05,{gloss:1}),0,-.15,zAt(0,-.15)-.03);tg.userData.base=tg.scale.clone();tg.visible=false;head.add(tg);C.tongue=tg;
  const er=.082;
  for(const s of[-1,1]){const x=s*.13,y=.05,z=zAt(x,y),d=new THREE.Vector3(s*.5,.1,1).normalize(),eo=P(grp(),x-d.x*.03,y-d.y*.03,z-d.z*.03);eo.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),d);head.add(eo);
    const eg=grp();eo.add(eg);
    eg.add(ell('#15202e',er*1.05,er*1.15,er*.55,{gloss:1}));
    eg.add(P(ell('#3f8fe6',er*.8,er*.9,er*.5,{gloss:1}),0,0,er*.12));
    eg.add(P(ell('#05080e',er*.55,er*.62,er*.42,{gloss:1}),0,0,er*.3));
    const hl=new THREE.Mesh(SPH,new THREE.MeshBasicMaterial({color:0xffffff}));hl.scale.set(er*.26,er*.28,er*.2);P(hl,er*.3,er*.34,er*.7);eg.add(hl);
    const lid=new THREE.Mesh(new THREE.SphereGeometry(er*1.18,20,10,0,Math.PI*2,0,Math.PI/2),M(W));lid.scale.set(1,1.1,1);lid.rotation.x=-1.95;eg.add(lid);C.lids.push(lid);
    const brow=new THREE.Mesh(new THREE.BoxGeometry(er*1.7,er*.32,er*.35),M('#3a4a6a',{gloss:1}));P(brow,0,er*1.3,er*.5);brow.rotation.z=s*.5;brow.visible=false;eg.add(brow);C.brows.push(brow)}
  // orelhas: tufos azuis encaracolados ao lado da cabeça + topete azul atrás
  for(const s of[-1,1]){const g=P(grp(),s*.24,.16,-.05);head.add(g);C.ears.push(g);
    g.add(sdfMesh([{c:[0,0,0],r:[.13,.13,.13],col:B,w:1},{c:[s*.06,.1,-.05],r:[.1,.1,.1],col:B2,w:1},{c:[s*.12,-.02,-.06],r:[.09,.09,.09],col:B,w:1},{c:[0,.02,.1],r:[.08,.08,.08],col:B,w:1}],.04,.026,.003))}
  head.add(sdfMesh([{c:[-.1,.26,-.12],r:[.13,.12,.12],col:B,w:1},{c:[.1,.28,-.1],r:[.12,.12,.12],col:B2,w:1},{c:[0,.33,-.2],r:[.14,.13,.13],col:B,w:1},{c:[0,.22,-.02],r:[.1,.08,.1],col:W,w:1}],.05,.028,.003));
  if(evo){// Nimbri Tempestade: nuvem maior, mais azul, com raios
    const cp=[];for(let k=0;k<12;k++){const a=k*2.4;cp.push({c:[Math.cos(a)*.3,.38+(k%3)*.07,-.1+Math.sin(a)*.4],r:[.17,.17,.17],col:k%2?B:B2,w:4})}
    body.add(sdfMesh(cp,.03,.03,.005));
    const bolt=new THREE.MeshBasicMaterial({color:0xffe85a});
    for(const s of[-1,1])for(let k=0;k<3;k++){const g=P(grp(),s*(.5+k*.04),.1+k*.2,-.1-k*.18);const pts=[[0,.2,0],[.06*s,.08,0],[-.02*s,.02,0],[.05*s,-.14,0]];for(let q=0;q<3;q++){const a=pts[q],b=pts[q+1],d=new THREE.Vector3(b[0]-a[0],b[1]-a[1],0),m=new THREE.Mesh(new THREE.BoxGeometry(.014,d.length(),.014),bolt);m.position.set((a[0]+b[0])/2,(a[1]+b[1])/2,0);m.rotation.z=-Math.atan2(d.x,d.y);g.add(m)}body.add(g)}}
  head.position.set(0,.1,.6);head.scale.setScalar(1.12);
  C.lidOpen=-1.95;C.baseY=0;C.mouth=[0,-.1,.28];C.headTest=lp=>lp.z>-.2&&lp.y>-.28;return C}

/* ---------- formas evoluídas dos 20 grandes (nível 50): asas, cristais, coroas e brilhos, como na folha de evolução ---------- */
const EVY=new THREE.Vector3(0,1,0),EVS=.5;
function evBasis(m,dir){const y=new THREE.Vector3(dir[0],dir[1],dir[2]).normalize(),z=new THREE.Vector3(0,0,1).addScaledVector(y,-y.z);if(z.lengthSq()<.02)z.set(0,1,0);z.normalize();const x=new THREE.Vector3().crossVectors(y,z);m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,y,z))}
function evLeaf(g,pos,dir,len,wid,c0,c1,bend,flat,roll){len*=EVS;wid*=EVS;const m=flameLeaf(len,wid,c0,c1,bend);m.position.set(pos[0],pos[1],pos[2]);if(flat)evBasis(m,dir);else{m.quaternion.setFromUnitVectors(EVY,new THREE.Vector3(dir[0],dir[1],dir[2]).normalize());m.rotateY(roll||0)}g.add(m);return m}
function evFan(side,pos,n,len,wid,a0,a1,c0,c1,bend){const g=new THREE.Group();g.position.set(pos[0],pos[1],pos[2]);
  for(let k=0;k<n;k++){const t=n>1?k/(n-1):0,a=(a0+(a1-a0)*t)*Math.PI/180;evLeaf(g,[0,0,0],[side*Math.cos(a),Math.sin(a),-.3-.25*t],len*(1-.28*Math.abs(t-.3)),wid,c0,c1,bend,true)}return g}
function evMat(col,glow){return new THREE.MeshStandardMaterial({color:new THREE.Color(col).convertSRGBToLinear(),roughness:.55,metalness:.05,emissive:new THREE.Color(col).convertSRGBToLinear(),emissiveIntensity:glow||0})}
function evCone(g,pos,dir,r,h,col,glow,seg){r*=EVS;h*=EVS;const geo=new THREE.ConeGeometry(r,h,seg||6);geo.translate(0,h/2,0);const m=new THREE.Mesh(geo,evMat(col,glow));m.position.set(pos[0],pos[1],pos[2]);m.quaternion.setFromUnitVectors(EVY,new THREE.Vector3(dir[0],dir[1],dir[2]).normalize());g.add(m);return m}
function evBall(g,pos,r,col,glow){const m=new THREE.Mesh(new THREE.SphereGeometry(r,14,10),evMat(col,glow));m.position.set(pos[0],pos[1],pos[2]);g.add(m);return m}
function evFlower(g,pos,size,col,col2,mid){size*=.75;const f=new THREE.Group();f.position.set(pos[0],pos[1],pos[2]);for(let k=0;k<6;k++){const a=k/6*Math.PI*2;evLeaf(f,[0,0,0],[Math.cos(a),.35,Math.sin(a)],size,size*.42,col,col2,.1,false,0)}evBall(f,[0,.02,0],size*.2,mid||'#ffd23c',.3);g.add(f);return f}
function evRing(g,pos,r,col,arc,rot){const m=new THREE.Mesh(new THREE.TorusGeometry(r,.014,8,40,arc||Math.PI*2),new THREE.MeshBasicMaterial({color:new THREE.Color(col)}));m.position.set(pos[0],pos[1],pos[2]);if(rot)m.rotation.set(rot[0],rot[1],rot[2]);g.add(m);return m}
// cada forma: recebe (g, hc) com g no espaço do modelo (corpo ~1 de comprimento, costas em y~.5)
const EVCROWN=(c1,c2)=>(g,h)=>{};const EVCROWN_OLD=(c1,c2)=>(g,h)=>{evRing(g,[h[0],h[1]+.2,h[2]-.04],.15,c1,Math.PI*2,[Math.PI/2.4,0,0]);evRing(g,[h[0],h[1]+.2,h[2]-.04],.11,c2,Math.PI*2,[Math.PI/2.4,0,0]);for(let k=0;k<5;k++){const a=k*1.26;evBall(g,[h[0]+Math.sin(a)*.15,h[1]+.2+Math.cos(a)*.03,h[2]-.04+Math.cos(a)*.15],.018,c2,1)}};
const EVOX={
 1:EVCROWN('#7fd8ff','#ffffff'),2:EVCROWN('#ff5a1a','#ffe08a'),12:EVCROWN('#9fd8ff','#ffffff'),3:EVCROWN('#d8c8ff','#ffffff'),5:EVCROWN('#ff7ac0','#ffe0f0'),7:EVCROWN('#ffd21c','#fff7b0'),9:EVCROWN('#ffd870','#ffffff'),15:EVCROWN('#ff9ab8','#ffe0a0'),17:EVCROWN('#ff9ad4','#fff0fa'),18:EVCROWN('#a060ff','#d8ff60'),19:EVCROWN('#ffd23c','#fff7d0'),
 0:EVCROWN('#9a6a44','#d8ffa0'),
 4:g=>{for(const s of[-1,1]){const f=evFan(s,[s*.1,.44,.08],8,.58,.14,5,95,'#3a1f78','#b060ff',.22);g.add(f);(g.userData.w=g.userData.w||[]).push({g:f,s})}},
 6:EVCROWN('#7fd0ff','#ffffff'),
 8:g=>{for(let k=0;k<7;k++){const s=k%2?1:-1;evCone(g,[s*.12,.52,.3-k*.11],[s*.5,1,-.3],.07,.2+(k%3)*.05,'#ff6a1a',.9,6)}for(const s of[-1,1])evCone(g,[s*.14,.4,.38],[s*.8,.9,.4],.05,.2,'#ff8a2a',.9,6)},
 10:(g,h)=>{for(const s of[-1,1])for(let k=0;k<4;k++)evLeaf(g,[h[0]+s*.07,h[1]+.17,h[2]-.04],[s*(.5+k*.2),1,-.15-k*.1],.2,.06,'#4a9a2e','#b4ee70',.1,false,k);evRing(g,[h[0],h[1]+.1,h[2]-.1],.17,'#d8f090',Math.PI*2,[0,0,0])},
 11:g=>{for(const s of[-1,1]){const f=evFan(s,[s*.1,.46,.06],8,.68,.15,5,100,'#7a1418','#e04a28',.2);g.add(f);(g.userData.w=g.userData.w||[]).push({g:f,s})}},
 13:EVCROWN('#8a8478','#b8e070'),
 14:g=>{for(let k=0;k<10;k++){const a=k/10*Math.PI*2;evLeaf(g,[Math.cos(a)*.25,.15+(k%3)*.1,Math.sin(a)*.4],[Math.cos(a)*.6,.8,Math.sin(a)*.6],.34,.06,'#6a22c0','#d090ff',.2,false,k)}},
 16:g=>{for(const s of[-1,1]){const f=evFan(s,[s*.1,.4,.06],10,.62,.15,0,95,'#ff5a14','#ffd64a',.2);g.add(f);(g.userData.w=g.userData.w||[]).push({g:f,s})}for(let k=0;k<5;k++)evLeaf(g,[0,.2,-.2],[(k-2)*.3,.2,-1],.5,.1,'#ff5a14','#ffd64a',.15,true)},
};
function makeEvo(i){const C=V.C;if(!C||!C.obj||!EVOX[i]||(C.m&&C.m.evoM))return;const m=C.m||{};let h=m.hc||m.HC||[0,.3,.35];const g=new THREE.Group();g.userData.keep=1;
  // altura real das costas no centro do corpo: as peças nascem ali
  C.obj.updateMatrixWorld(true);const rc=new THREE.Raycaster();let ys=[];for(const z of[.12,0,-.12]){const o=C.obj.localToWorld(new THREE.Vector3(0,3,z));rc.set(o,new THREE.Vector3(0,-1,0));const hh=rc.intersectObject(C.obj,true)[0];if(hh)ys.push(C.obj.worldToLocal(hh.point.clone()).y)}
  const T=ys.length?ys.reduce((a,b)=>a+b)/ys.length:.45,dy=Math.max(-.2,Math.min(.2,T-.5));g.position.y=dy;h=[h[0],h[1]-dy,h[2]];
  EVOX[i](g,h);g.traverse(o=>{o.userData.keep=1;o.castShadow=false});C.obj.add(g);V.evoG=g;V.evoW=g.userData.w||null;
  if(!V.evoK){V.evoK=1;V.size={xz:V.size.xz*(g.userData.w?1.35:1.1),y:V.size.y*1.1};if(V.open)fit()}}
const PROC={};
function openFox(i,pop){
  setDet(i);
  if(!initViewer())return false;
  if(V.C&&V.C.root)V.spin.remove(V.C.root);if(V.T){V.spin.remove(V.T.root);V.T=null}
  const C=PROC[i](careStage(i)>0);
  V.mode='creature';V.chibi=true;V.C=C;V.sp={h:.24,tl:'',bird:0};
  C.gs=gsOf(i,careStage(i));C.root.scale.setScalar(C.gs);
  setFloor(i);castAll(C.root);
  C.baseY=-1-C.feet*C.gs;C.backY=-1+.62*C.gs;C.root.position.y=C.baseY;V.spin.add(C.root);
  if(!FOXSZ[i])FOXSZ[i]=foxSize(i);V.size={xz:FOXSZ[i].xz,y:FOXSZ[i].y};
  Object.assign(V,{ry:-.5,rx:.1,vy:0,st:'idle',until:0,taps:[],t0:performance.now(),blinkAt:1.5,blinkTo:0,wag:0,side:1,pop:pop?performance.now():0,
    S:{lid:0,ear:0,tailX:0,wagA:.2,wagS:5,tongue:0,hx:0,hy:0,hz:0,crouch:0,roll:0,paddle:0,scratch:0,shake:0,brow:0,flap:0}});
  killAura();if(careStage(i))makeAura(i);
  return true}

// interface pequena para os módulos em arquivos separados (js/missoes.js); nada de conteúdo aqui
window.GARRO={
  online:()=>ONL&&!DEV,sb:()=>sb,sync:(a,x)=>syncEstado(a,x),
  coins:()=>coins,setCoins:n=>{coins=n;hud()},addCoinsLocal:n=>{coins+=n;bonus+=n;saveBonus();hud()},
  coll:()=>coll,lvOf:i=>lvOf(i),CH0,banner:(t,s,w)=>banner(t,s,w),fanfare:()=>fanfare(),click:f=>{audio();click(f||600)}
};
window.dispatchEvent(new Event('garro:pronto'));
renderShelf();hud();
})();
