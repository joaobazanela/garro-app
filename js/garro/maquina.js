/* GARRO — mundo de física, máquina do gigante, garra e arte da máquina. Parte 2 de 8 do antigo js/garro.js: os arquivos são carregados em ordem (js/garro/*.js) e dividem o mesmo escopo global. */
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
// cerca invisível a EDGE_FREE do buraco do prêmio: o monte nunca chega perto da divisória, então nada fica parado quase caindo no buraco.
// Só vale para o que está solto (bichinho na garra atravessa, como a guarda de vidro)
const EDGE_FREE=0;// o monte fica escorado na divisória (só não pode ficar equilibrado no topo dela: ver tiraDaBorda)
const fence=Bodies.rectangle(DIV+EDGE_FREE+3,(80+FLOOR)/2,6,FLOOR-80,{isStatic:true,friction:.1,collisionFilter:{category:CAT_GUARD}});Composite.add(world,fence);
Composite.add(world,walls);
const prongL=Bodies.rectangle(0,0,7,40,{isStatic:true,isSensor:true,collisionFilter:{category:CAT_PRONG}});
const prongR=Bodies.rectangle(0,0,7,40,{isStatic:true,isSensor:true,collisionFilter:{category:CAT_PRONG}});
Composite.add(world,[prongL,prongR]);
// parede invisível em cima da divisória: só o bicho que está na garra passa por ela
const guard=Bodies.rectangle(DIV,(80+DIVTOP)/2,8,DIVTOP-80,{isStatic:true,friction:.2,collisionFilter:{category:CAT_GUARD}});Composite.add(world,guard);

let bodies=[];
function addPlush(p,x,y){
  const liso=p.egg!==undefined;// ovos são lisos
  const b=Bodies.fromVertices(x,y,[p.verts.map(v=>({x:v.x,y:v.y}))],{friction:liso?.12:.85,frictionStatic:liso?.25:1.2,frictionAir:.012,restitution:.04,
    collisionFilter:{category:CAT_PLUSH,mask:CAT_PLUSH|CAT_WALL|CAT_PRONG|CAT_GUARD}},true);
  Body.setMass(b,p.g/100);Body.setAngle(b,(Math.random()-.5)*.6);
  b.plush=p;bodies.push(b);Composite.add(world,b);return b;
}
const PILE=30;// pilha baixa: nada pode passar da linha do topo da divisória (DIVTOP)
function pickPlush(cnt){
  const round=MQR.so_redondos!==false||Math.random()<.86,BASE=PLUSH.filter(p=>!p.leg);let pool=BASE.filter(p=>(p.i>=CH0)===round&&(cnt[p.i]||0)<(round?3:1));if(!pool.length)pool=BASE.filter(p=>(cnt[p.i]||0)<1);if(!pool.length)pool=BASE;
  let t=0;pool.forEach(p=>t+=p.rare);let r=Math.random()*t;for(const p of pool){r-=p.rare;if(r<0)return p}return pool[0];
}
// onde a pilha está mais baixa (sorteia alguns pontos e fica com o mais vazio): assim preenche toda a área, inclusive junto da divisória
function xBaixo(){let best=DIV+40,bt=-1;for(let q=0;q<7;q++){const x=DIV+34+Math.random()*(W-DIV-68);let topo=FLOOR;for(const b of bodies)if(b.position.x>DIV&&Math.abs(b.position.x-x)<42)topo=Math.min(topo,b.bounds.min.y);if(topo>bt){bt=topo;best=x}}return best}
function fill(n,fromY){
  const cnt={};bodies.forEach(b=>cnt[b.plush.i]=(cnt[b.plush.i]||0)+1);
  for(let k=0;k<n;k++){let p=pickPlush(cnt);if(!bodies.some(b=>b.plush.stone!==undefined)&&!cnt.stone&&Math.random()<.012){p=STONES[Math.floor(Math.random()*STONES.length)];cnt.stone=1}cnt[p.i]=(cnt[p.i]||0)+1;addPlush(p,xBaixo(),fromY-k*70)}
}
// ninguém fica acima da linha da divisória: o que assentou lá em cima (parado) sai da máquina com uma nuvenzinha
const LIM_EXTRA=38;// a área marcada vai um pouco acima do topo da divisória
function abaixaPilha(mudo){let n=0;for(let i=bodies.length-1;i>=0;i--){const b=bodies[i];if((!mudo&&b===claw.held)||b.plush.won||b.plush.giant||b.plush.leg||b.position.x<DIV)continue;
    if(b.bounds.min.y<DIVTOP-LIM_EXTRA&&Math.hypot(b.velocity.x,b.velocity.y)<.5){if(!mudo)puff(b.position.x,b.position.y,10,['#fff','#ffd7ef'],true);Composite.remove(world,b);bodies.splice(i,1);n++}}return n}
function settlePile(){// enche até a linha da divisória: cai um por vez em cima da pilha; quando um assenta acima da linha, está cheio
  for(let r=0,fora=0;r<70&&bodies.length<30&&fora<6;r++){fill(1,DIVTOP-130);for(let i=0;i<150;i++)Engine.update(engine,1000/60);fora+=abaixaPilha(true)}
  for(let i=0;i<150;i++)Engine.update(engine,1000/60);abaixaPilha(true);
  for(let i=bodies.length-1;i>=0;i--)if(bodies[i].position.x<DIV){Composite.remove(world,bodies[i]);bodies.splice(i,1)}}
settlePile();
// novos bichos caem devagar: 1 a cada 4 jogadas quando a pilha baixa; só repõe 3 de uma vez se estiver quase vazia
let sinceDrop=0;
const MEIO=()=>(DIV+W)/2;
// ovos comuns nos lados (longe do meio, onde fica o lendário)
function fillEggs(n,fromY,perto){for(let k=0;k<n;k++){let x;if(perto)x=MEIO()+(k%2?1:-1)*(52+Math.random()*16);else{const L=DIV+40,Rr=W-40,m=MEIO();do x=L+Math.random()*(Rr-L);while(Math.abs(x-m)<70)}addPlush(EGG_C,x,fromY-k*55)}}
function legNaMaquina(){return bodies.filter(b=>b.plush.egg>=0).length}
// o ovo lendário fica em pé no pedestal (não rola), no meio da caixa
function addLegEgg(y){const e=EGGS[legDia()];if(!e)return;const b=addPlush(e,MEIO()+(Math.random()-.5)*10,y);Body.setAngle(b,0);Body.setInertia(b,Infinity);b.friction=.6;b.frictionStatic=.9;return b}
// primeiro o lendário no chão do meio, depois os comuns dos lados e alguns encostados nele (cercado, mas dá para pegar por cima)
function settleEggs(){fill0();const n=MQ.ovos_comuns||11,perto=Math.min(4,n);
  for(let k=0;k<(MQ.lendarios_na_maquina||1);k++)addLegEgg(FLOOR-90-k*120);for(let i=0;i<90;i++)Engine.update(engine,1000/60);
  fillEggs(n-perto,FLOOR-60);for(let i=0;i<120;i++)Engine.update(engine,1000/60);
  fillEggs(perto,FLOOR-120,true);for(let i=0;i<400;i++)Engine.update(engine,1000/60);
  for(let i=bodies.length-1;i>=0;i--)if(bodies[i].position.x<DIV){Composite.remove(world,bodies[i]);bodies.splice(i,1)}}
// bichinho solto que ficou encostado na divisória do buraco do prêmio (a garra o soltou ali): empurra para dentro do monte, nunca deixa "quase caindo"
function tiraDaBorda(){const lim=DIV+EDGE_FREE+8;for(const b of bodies){if(b===claw.held||b.plush.won||b.plush.giant)continue;const x=b.position.x,e=b.plush.dw*.42;
    if(x>DIV+4&&x-e<lim&&b.position.y<DIVTOP+30){Body.setPosition(b,{x:x+3,y:b.position.y-.6});Body.setVelocity(b,{x:Math.max(b.velocity.x,.8),y:Math.min(b.velocity.y,0)})}}}
function fill0(){for(const b of bodies)Composite.remove(world,b);bodies.length=0}
function restock(){if(MACH===4){if(!bodies.length)placeEpic();return}if(MACH===2){if(!bodies.length)placeGiant();return}if(MACH===3){if(legNaMaquina()<(MQ.lendarios_na_maquina||1))addLegEgg(-80);if(bodies.length<(MQ.ovos_comuns||11)-3)fillEggs(2,-60);return}abaixaPilha();const topo=Math.min(DIVTOP+200,...bodies.filter(b=>b.position.x>DIV&&!b.plush.won).map(b=>b.bounds.min.y));if(topo>DIVTOP-LIM_EXTRA+60&&bodies.length<30)fill(topo>DIVTOP+80?2:1,-60)}
const SWAP_COST=10,ECOST=(LEGD.maquina&&LEGD.maquina.preco)||200;
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
function giantOf(i,K){K=K||GK;const p=PLUSH[i],G=Object.create(p);G.giant=1;G.dw=p.dw*K;G.dh=p.dh*K;G.cx=p.cx*K;G.cy=p.cy*K;G.cm=Math.round(p.cm*K);G.g=760+Math.round(Math.random()*100);G.tex=Math.max(.85,p.tex);
  G.verts=p.verts.map(v=>({x:v.x*K,y:v.y*K}));G.name=p.name;
  // desenha de novo no tamanho grande, direto da imagem original (esticar a pequena deixava borrado)
  if(p.image&&p.image.complete&&p.image.naturalWidth){const pad=16,c=document.createElement('canvas');c.width=Math.ceil((G.dw+pad*2)*dpr);c.height=Math.ceil((G.dh+pad*2)*dpr);const x=c.getContext('2d');x.scale(dpr,dpr);x.imageSmoothingQuality='high';x.shadowColor='rgba(0,0,0,.55)';x.shadowBlur=14;x.shadowOffsetY=7;x.drawImage(p.image,pad,pad,G.dw,G.dh);G.baked=c;G.pad=pad}
  else Object.defineProperty(G,'pad',{get:()=>(p.pad||10)*K});return G}
function placeGiant(){const i=Math.floor(Math.random()*CH0),G=giantOf(i);G.landed=false;const gb=addPlush(G,(DIV+W)/2+12+(Math.random()-.5)*30,-G.dh*.6);Body.setAngle(gb,0);gb.frictionAir=.02;
  const rs=[];while(rs.length<3){const r=CH0+Math.floor(Math.random()*(NPL-CH0));if(!rs.includes(r))rs.push(r)}DECOR=[{i:rs[0],x:DIV+24},{i:rs[1],x:W-58},{i:rs[2],x:W-28}];
  $('who').innerHTML='Gigante da vez: <b>'+G.name+'</b> <em>· '+G.cm+' cm</em>'}
// travas: gigante só com todos os normais; ovos com normais + gigantes; épico com normais + gigantes + lendários (o servidor confere igual)
function faltas(){let n=0,g=0,l=0;for(let i=0;i<LEG0;i++)if(!(coll[i]>0))n++;for(let i=0;i<CH0;i++)if(!(GCOLL[i]>0))g++;for(const L of LEGS)if(!(coll[L.id]>0))l++;return{n,g,l}}
function travaMaq(m){if(DEV)return '';const f=faltas();
  if(m===2&&f.n)return 'Pegue todos os bichinhos normais primeiro (faltam '+f.n+')';
  if(m===3&&(f.n||f.g))return 'Pegue todos os normais e todos os gigantes (faltam '+(f.n+f.g)+')';
  if(m===4&&(f.n||f.g||f.l))return 'Pegue todos os normais, gigantes e lendários (faltam '+(f.n+f.g+f.l)+')';return ''}
function tabsMaq(){const t=[[2,'mach2','🦖 Gigante · '+GCOST+' 🪙'],[3,'mach4','🥚 Ovos · '+ECOST+' 🪙'],[4,'mach5','🔥 Épico · '+EPM.preco+' 🪙']];
  for(const [m,id,txt] of t){const b=$(id);if(!b)continue;const tv=travaMaq(m);b.classList.toggle('lock',!!tv);b.title=tv;b.textContent=(tv?'🔒 ':'')+txt}}
// máquina do épico: o épico do dia, grande como um gigante, liso: só fica firme na garra quando o servidor sorteou "firme"
function epicOf(i){const e=EPEGGS[i-EPIC0];if(e&&e.verts)return e;const G=giantOf(i,72/PLUSH[i].cm);G.epic=1;G.g=1500;G.name=PLUSH[i].name;return G}
function placeEpic(){for(const b of bodies)Composite.remove(world,b);bodies.length=0;const i=epicDia();if(i<0)return;const G=epicOf(i);G.landed=false;const gb=addPlush(G,(DIV+W)/2+12,-G.dh*.6);Body.setAngle(gb,0);gb.frictionAir=.02;DECOR=[];
  $('who').innerHTML=(G.epicEgg?'Ovo épico do dia: <b>'+PLUSH[i].name+'</b> <em>· choca no Ninho · muito liso, quase nunca fica firme na garra</em>':'Épico do dia: <b>'+G.name+'</b> <em>· muito liso, quase nunca fica firme na garra</em>')}
function setMachine(m){if(m===MACH)return;if(claw.state!=='ready'){banner('Espere a garra voltar');return}
  {const tv=travaMaq(m);if(tv){banner('🔒 Máquina trancada',tv);audio();tone(220,.15,'sine',.06);return}}
  MACH=m;const gg=m===2||m===4,k=(gg?1.7:1)/CS;CS=gg?1.7:1;Body.scale(prongL,k,k);Body.scale(prongR,k,k);
  for(const b of bodies)Composite.remove(world,b);bodies.length=0;if(m===2)placeGiant();else if(m===4)placeEpic();else if(m===3){settleEggs();$('who').textContent='Ovo branco é comum (+1 🪙). O ovo do lendário do dia fica no meio: é liso e escorrega fácil!'}else{settlePile();$('who').textContent='Mire bem no centro da pelúcia. As pesadas escorregam fácil.'}
  $('gsign').hidden=m!==2;if($('mach5'))$('mach5').classList.toggle('on',m===4);$('mach1').classList.toggle('on',m===1);$('mach2').classList.toggle('on',m===2);if($('mach4'))$('mach4').classList.toggle('on',m===3);document.querySelector('.window').classList.toggle('giant',gg);document.querySelector('.window').classList.toggle('ovos',m===3);
  $('hint').textContent=m===4?'Máquina do épico: '+EPM.preco+' moedas por jogada':m===2?'Máquina gigante: '+GCOST+' moedas por jogada':m===3?'Máquina de ovos: '+ECOST+' moedas por jogada':'Toque nas setas para colocar uma moeda';audio();click(m===2?300:m===3?420:600);hud()}

function swapMachine(){if(claw.state!=='ready'){banner('Espere a garra voltar');return}
  if(!canPay(SWAP_COST)){banner('Moedas insuficientes','Trocar custa '+SWAP_COST+' 🪙');return}
  pay(SWAP_COST,'swap');for(const b of bodies)Composite.remove(world,b);bodies.length=0;if(MACH===4)placeEpic();else if(MACH===2)placeGiant();else if(MACH===3)settleEggs();else settlePile();sinceDrop=0;
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

