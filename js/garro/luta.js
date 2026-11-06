/* GARRO — batalha, efeitos e movimento da luta, partes extras. Parte 7 de 8 do antigo js/garro.js: os arquivos são carregados em ordem (js/garro/*.js) e dividem o mesmo escopo global. */
/* ---------- batalha: cada bichinho com nível, ataque e defesa ---------- */
let BT=null;
function bStats(f){const S=statsAt(f.i,f.lv,f.rb);if(f.giant){const k=GEVO[f.i]?FORCA.gigante_evoluido:FORCA.gigante;S.atk=Math.round(S.atk*k);S.def=Math.round(S.def*k);S.hp=Math.round(S.hp*k)}return Object.assign({},f,S)}
function pickOpp(my){const myLv=lvOf(my);const same=Math.random()<.75;let j;do{j=Math.floor(Math.random()*NPL)}while(j===my||!PLUSH[j]||PLUSH[j].fora||(same&&(j<CH0)!==grande(my)));const lv=Math.max(1,Math.min(capOf(j),Math.round(myLv*(.75+Math.random()*.5))));return bStats({i:j,lv,giant:j<CH0&&Math.random()<.12?1:0})}
function bName(f){return (f.giant?'🏆 '+(GEVO[f.i]?'Gigante★ ':'Gigante '):'')+evName(f.i,f.i<CH0&&(isEvo(f.i,f.lv,f.rb)||(f.giant&&GEVO[f.i]))?1:0)}
// imagens da luta: todos desenhados de perfil OLHANDO PARA A DIREITA. O da esquerda fica como está, o da direita é espelhado: sempre cara a cara.
const BSPR=GD.sprites_luta.BSPR,BSPRE=GD.sprites_luta.BSPRE;const EVOSPR=BSPRE;// coleção usa as mesmas imagens evoluídas
function bSrc(f){const ev=f.i<CH0&&(isEvo(f.i,f.lv,f.rb)||(f.giant&&GEVO[f.i]));return (ev&&BSPRE[f.i]?BSPRE[f.i].img:null)||(BSPR[f.i]?BSPR[f.i].img:null)||(ev&&EVOSPR[f.i]?EVOSPR[f.i].img:PLUSH[f.i].img)}
function bSize(){const a=BT&&BT.me,b=BT&&BT.op;if(!a||!b)return;const any=a.giant||b.giant;for(const [side,f] of [['Me',a],['Op',b]]){const im=$('b'+side+'Img');im.classList.toggle('giant',!!f.giant);im.classList.toggle('small',!!(any&&!f.giant))}}
function bFill(side,f){const im=$('b'+side+'Img');im.src=bSrc(f);setTimeout(bSize,0);const fl=side!=='Me';im.dataset.flip=fl?'1':'0';im.style.transform=fl?'scaleX(-1)':'';$('b'+side+'Name').textContent=bName(f);$('b'+side+'St').textContent=(ELNAME[ELEM[f.i]]||'')+' · Nv '+f.lv+' · ⚔️ '+f.atk+' · 🛡️ '+f.def+' · ❤️ '+f.hp;$('b'+side+'Hp').style.width='100%'}
function openBattle(gi){const i=V.cur;if(i===undefined)return;audio();BT={me:bStats({i,lv:lvOf(i),rb:rbOf(i),giant:gi===true&&GCOLL[i]>0?1:0}),busy:false,done:false};BT.op=pickOpp(i);
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
  const SM=window.GARRO_SOM;if(SM&&SM.poder){SM.poder(el,crit);return}
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
function fightBattle(){if(!BT||BT.busy)return;if(BT.fought){BT.fought=0;BT.op=pickOpp(BT.me.i);bFill('Me',BT.me);bFill('Op',BT.op)}bIdle();BT.busy=true;$('bGo').disabled=$('bOther').disabled=$('bClose').disabled=true;const me=BT.me,op=BT.op,R=simBattle(me,op);$('bRes').textContent='Lutando...';if(window.GARRO_SOM)GARRO_SOM.musica('batalha');
  R.log.forEach((e,k)=>setTimeout(()=>{
    const A=$(e.t?'bOp':'bMe'),D=$(e.t?'bMe':'bOp');bLunge(e.t,e.crit);
    bFx(A,D,ELEM[(e.t?op:me).i],e.crit);
    setTimeout(()=>{bHit(e.t?0:1,e.crit);
    $('bMeHp').style.width=Math.round(e.ha/me.hp*100)+'%';$('bOpHp').style.width=Math.round(e.hb/op.hp*100)+'%';
    const f=document.createElement('span');f.className='bdmg';f.textContent=(e.crit?'💥 ':'')+'-'+e.d;f.style.left=(e.t?'18%':'68%');D.appendChild(f);setTimeout(()=>f.remove(),850);
    if(window.GARRO_SOM)GARRO_SOM.golpe(e.crit);else tone(e.crit?220:150+Math.random()*50,.09,'square',.07)},430)},k*850));
  setTimeout(()=>{
    const my=me.i;let line;
    if(R.win){const dn=bWin(0);bKO(1);const paid=battlePay();line='<big>Vitória! 🏆</big><span>'+dn+' · +10 XP'+(paid?' · +1 moeda 🪙':' · limite de moedas por hora')+'</span>';if(window.GARRO_SOM){GARRO_SOM.parar();GARRO_SOM.vitoria()}else [523,659,784,1046,1318].forEach((f,k)=>setTimeout(()=>tone(f,.18,'triangle',.1),k*110));gainXp(my,10);evento('battle_win');srv('battle',{plushId:my,win:true},r=>{coins=r.coins;careOf(my).xp=r.xp;saveCare();hud()})}
    else{bKO(0);const dn=bWin(1);line='<big>Derrota 💔</big><span>+4 XP pela luta</span>';if(window.GARRO_SOM){GARRO_SOM.parar();GARRO_SOM.derrota()}else tone(196,.4,'sawtooth',.08);gainXp(my,4);srv('battle',{plushId:my,win:false},r=>{coins=r.coins;careOf(my).xp=r.xp;saveCare();hud()})}
    $('bRes').innerHTML=line;$('bGo').textContent='⚔️ Lutar de novo';$('bGo').disabled=$('bOther').disabled=$('bClose').disabled=false;BT.busy=false;
    // depois de ganhar XP o nível pode ter mudado: atualiza o meu lado e sorteia outro adversário
    BT.me=bStats({i:my,lv:lvOf(my),giant:BT.me.giant});$('bMeSt').textContent=(ELNAME[ELEM[my]]||'')+' · Nv '+BT.me.lv+' · ⚔️ '+BT.me.atk+' · 🛡️ '+BT.me.def+' · ❤️ '+BT.me.hp;BT.fought=1},R.log.length*850+700)}
$('cBat').addEventListener('click',()=>{const i=V.cur;if(i===undefined)return;escolheCopia(i,'Batalhar com qual?',g=>openBattle(g))});
$('bGo').addEventListener('click',fightBattle);
$('bOther').addEventListener('click',()=>{if(!BT||BT.busy)return;BT.op=pickOpp(BT.me.i);BT.fought=0;bFill('Me',BT.me);bFill('Op',BT.op);bIdle();$('bRes').textContent='Novo adversário!';click(700)});
$('bClose').addEventListener('click',()=>{if(BT&&BT.busy)return;$('battle').hidden=true;if(window.GARRO_SOM)GARRO_SOM.parar();if(V.open&&V.cur!==undefined){renderCare();refreshVStats(V.cur)}});
function levelUp(i,lv){float('⬆ Nível '+lv,'xp');[659,880,1175].forEach((f,k)=>setTimeout(()=>tone(f,.1,'triangle',.07),k*70))}
function gainXp(i,n){const lv0=lvOf(i),st0=careStage(i),c=careOf(i);c.xp+=n;saveCare();const lv1=lvOf(i),st1=careStage(i);
  if(V.open&&V.cur===i){if(lv1>lv0)levelUp(i,lv1);renderCare();refreshVStats(i)}
  if(st1>st0)setTimeout(()=>evolve(i,st0,st1),900)}
function careGain(i,kind,amount){const c=careOf(i);if(c[kind]>=96)return false;evento(kind==='f'?'feed':kind==='l'?'pet':'play');
  c[kind]=Math.min(100,c[kind]+amount);c.t=Date.now();saveCare();
  srv('care',{plushId:i,kind,f:c.f,l:c.l,p:c.p},r=>{const cc=careOf(i);cc.xp=r.xp;INV.food=r.food;saveCare();saveInv();updFood()});
  const h=xpHoje(i),g=Math.max(0,Math.min(XPG[kind],XPDIA-h));c.xd=diaHoje();c.xh=h+g;saveCare();
  if(V.open&&V.cur===i)float(g?'+'+g+' XP':'XP de cuidar de hoje completo','xp');if(g)gainXp(i,g);else if(V.open&&V.cur===i)renderCare();return true}
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
  if(!(C.m&&(C.m.evoM||C.m.leg)))(C.obj||C.root).traverse(o=>{if(o.isMesh&&o.material&&o.material.emissive&&!o.userData.keep){o.material.emissive.copy(col);o.material.emissiveIntensity=.1;o.userData.tint=1}});// modelo evoluído (Tripo) já tem as cores certas: o brilho por cima lavava as cores
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
  setState('eat',2.6);V.ry=temVista(i)?vistaLeg(i):-.15;V.vy=0;
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
  $('vTags').innerHTML='<span>'+(ELNAME[ELEM[i]]||'')+'</span>'+(p.leg?(isEpic(i)?'<span class="rL">🔥 Épico</span>':isDrag(i)?'<span class="rL">🐉 Dragão · forma '+(formaIdx(lvOf(i))+1)+'/3</span>':'<span class="rL">✦ Lendário</span>'):'<span class="r'+r+'">'+['','Comum ★','Rara ★★','Lendária ★★★'][r]+'</span>');
  const own=PLUSH.filter(q=>coll[q.i]&&!q.fora).map(q=>q.i);V.cur=i;V.own=own;const many=own.length>1;$('vPrev').hidden=$('vNext').hidden=!many;
  if(many&&typeof preCarrega==='function'){const k=own.indexOf(i);preCarrega([own[(k+1)%own.length],own[(k-1+own.length)%own.length]],true)}}// os vizinhos já vão carregando
function vStep(d){const o=V.own||[];if(o.length<2)return;let k=o.indexOf(V.cur);k=(k+d+o.length)%o.length;audio();click(700);openViewer(o[k])}
$('vPrev').addEventListener('click',()=>vStep(-1));$('vNext').addEventListener('click',()=>vStep(1));
$('vHelp').addEventListener('click',()=>{const g=$('gest'),open=g.hidden;g.hidden=!open;$('vHelp').setAttribute('aria-expanded',open)});
addEventListener('keydown',e=>{if(!V.open)return;if(['Escape','ArrowLeft','ArrowRight',' ','ArrowDown'].includes(e.key))e.stopImmediatePropagation();if(e.key==='Escape')closeViewer();if(e.key==='ArrowLeft')vStep(-1);if(e.key==='ArrowRight')vStep(1)},true);
