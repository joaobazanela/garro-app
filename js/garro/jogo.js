/* GARRO — estado do jogo, som, entrada (toques), coleção. Parte 3 de 8 do antigo js/garro.js: os arquivos são carregados em ordem (js/garro/*.js) e dividem o mesmo escopo global. */
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
  if(typeof tabsMaq==='function')tabsMaq();
  $('time').textContent=claw.state==='move'?Math.ceil(roundTime/60):'--';
  $('drop').disabled=claw.state!=='move';
}
function showGrab(p,force,closed){
  if(!p){$('who').innerHTML=closed&&closed.plush?'Pegou só a pontinha de '+closed.plush.name+'.':'A garra fechou no vazio.';$('mForce').style.width=Math.round(force/12)+'%';$('mWeight').style.width='0';return}
  $('who').innerHTML=p.name+' <em>· '+p.cm+' cm · '+p.g+' g'+(closed!==undefined?' · '+closed+'/3 pontas':'')+'</em>';
  $('mForce').style.width=Math.min(100,force/12)+'%';$('mWeight').style.width=Math.min(100,p.g/12)+'%';
}

/* ---------- modo HABILIDADE (data/regras.json → HABILIDADE): sem sorteio. A mesma jogada dá sempre o mesmo resultado.
   Pega firme quem (1) fecha a garra perto do centro do bichinho (mira) e (2) trava a barra de força na faixa verde.
   Quanto mais raro, mais estreitas a mira e a faixa verde. ---------- */
const HAB=Object.assign({ativo:false,periodo_ms:1200,verde_centro:.72,garra:1000,classes:{}},GD.regras.HABILIDADE||{});
const HABC=p=>{const C=HAB.classes||{},k=p.epic?'epico':p.giant?'gigante':p.egg!==undefined?(p.egg>=0?'ovo_lendario':'ovo_comum'):p.stone!==undefined?'pedra':p.i<CH0?'grande':'bolinha';return Object.assign({mira:.4,verde:.25},C[k]||{},{k})};
function habForca(){const t=(performance.now()-(claw.habT0||0))/HAB.periodo_ms,f=t-Math.floor(t);return f<.5?f*2:2-f*2}// sobe e desce sempre no mesmo ritmo
function habTrava(){if(HAB.ativo&&claw.habF==null&&(claw.state==='down'||claw.state==='close')){claw.habF=habForca();click(900)}}
function start(){
  if(claw.state!=='ready')return false;
  if(MACH===3){if(!canPay(ECOST)){$('hint').textContent='A máquina de ovos custa '+ECOST+' moedas por jogada.';banner('Moedas insuficientes','Ovos: '+ECOST+' 🪙 por jogada');return false}
    claw.state='move';roundTime=ROUND;roundWin=false;evento('egg_play');claw.eggFirm=null;
    // o servidor sorteia no começo da jogada se a garra vai segurar firme o ovo lendário (sem login: sorteio aqui)
    if(ONL&&!DEV){coins-=ECOST;hud();syncEstado('egg_round_start').then(r=>{if(r&&typeof r.coins==='number'){coins=r.coins;hud()}claw.eggFirm=!!(r&&r.firm)})}
    else{spend(ECOST);claw.eggFirm=Math.random()<(MQ.segurar_lendario??.33)}claw.force=losses>=4?1100+Math.random()*150:600+Math.random()*500;
    $('hint').textContent='Escolha um ovo e aperte PEGAR';click(500);hud();return true}
  if(MACH===4){const EC=EPM.preco;if(!canPay(EC)){$('hint').textContent='A máquina do épico custa '+EC+' moedas por jogada.';banner('Moedas insuficientes','Épico: '+EC+' 🪙 por jogada');return false}
    claw.state='move';roundTime=ROUND;roundWin=false;evento('epic_play');claw.epicFirm=null;
    // o servidor sorteia no começo da jogada se a garra vai segurar firme o épico (sem login: sorteio aqui)
    if(ONL&&!DEV){coins-=EC;hud();syncEstado('epic_round_start').then(r=>{if(r&&typeof r.coins==='number'){coins=r.coins;hud()}else{coins+=EC;hud()}claw.epicFirm=!!(r&&r.firm)})}
    else{spend(EC);claw.epicFirm=Math.random()<(EPM.segurar??.05)}claw.force=900+Math.random()*400;
    $('hint').textContent='Mire no meio do épico e aperte PEGAR';click(500);hud();return true}
  if(MACH===2){if(!canPay(GCOST)){$('hint').textContent='A máquina gigante custa '+GCOST+' moedas por jogada.';banner('Moedas insuficientes','Gigante: '+GCOST+' 🪙 por jogada');return false}
    claw.state='move';roundTime=ROUND;roundWin=false;pay(GCOST,'giant_round_start');evento('giant_play');claw.force=losses>=MQR.gigante.derrotas_ajuda?1250+Math.random()*150:MQR.gigante.min+Math.random()*MQR.gigante.var;
    $('hint').textContent='Mire no meio do gigante e aperte PEGAR';click(500);hud();return true}
  if(!DEV&&coins<=0){$('hint').textContent='Sem moedas. Toque em +1 moeda abaixo.';banner('Sem moedas');return false}
  claw.state='move';roundTime=ROUND;roundWin=false;
  if(!DEV){const useBonus=bonus>0&&coins-bonus<=0;coins--;
    if(useBonus){bonus--;saveBonus()}else syncEstado('round_start').then(r=>{if(r)coins=r.coins+bonus;else{coins++;erroAmigavel('Não deu pra confirmar a jogada — a próxima pode não valer')}});}
  // real machines vary the claw voltage each play; after a losing streak they pay out
  claw.force=losses>=MQR.garra.derrotas_ajuda?1150+Math.random()*150:MQR.garra.min+Math.random()*MQR.garra.var;
  if(HAB.ativo)claw.force=HAB.garra;
  $('hint').textContent='Posicione e aperte PEGAR';click(500);hud();return true;
}
function drop(){if(HAB.ativo&&(claw.state==='down'||claw.state==='close')){habTrava();return}if(claw.state!=='move')return;if(HAB.ativo){claw.force=HAB.garra;claw.habT0=performance.now();claw.habF=null;claw.habRes=null}claw.state='down';claw.press=0;dir=0;hum(true);$('bar').style.width='0';if(HAB.ativo)$('hint').textContent='Toque PEGAR de novo quando a barra estiver no verde';hud()}

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
  claw.slipAt=grip<p.g?claw.y-10-Math.random()*40:-1;claw.firme=false;
  // ovos são lisos: escorregam logo depois de subir, a não ser que a garra esteja firme
  if(p.epic){if(claw.epicFirm===true){claw.hold=grip=Math.max(grip,p.g*3);claw.slipAt=-1;claw.firme=true}else{claw.firme=false;claw.slipAt=claw.y-10-Math.random()*30}}
  if(p.egg!==undefined){const firme=p.egg>=0?claw.eggFirm===true:Math.random()>=(MQ.escorregar_comum??.4);
    if(firme){claw.hold=grip=Math.max(grip,p.g*3);claw.slipAt=-1;claw.firme=true}else claw.slipAt=claw.y-14-Math.random()*46}
  if(HAB.ativo){const C=HABC(p),f=claw.habF==null?habForca():claw.habF,aim=(b===claw.target&&claw.habDx!=null?claw.habDx:dx/half)<=C.mira,forca=Math.abs(f-HAB.verde_centro)<=C.verde/2;claw.habF=f;
    claw.habRes={aim,forca,C};
    if(aim&&forca){claw.hold=grip=Math.max(grip,p.g*3);claw.slipAt=-1;claw.firme=true}
    else{claw.firme=false;claw.slipAt=claw.y-24;claw.hold=grip=Math.min(grip,p.g*.9)}
}
  showGrab(p,grip,closed);
  if(claw.habRes){const R=claw.habRes,f=claw.habF;$('who').innerHTML=(R.aim?'✅':'❌')+' Mira'+(R.aim?'':' · faltou centralizar')+' &nbsp; '+(R.forca?'✅':'❌')+' Força'+(R.forca?'':' · '+(f>HAB.verde_centro?'forte demais':'fraca demais'))}
}
function release(reason){
  const b=claw.held;if(!b)return;
  Composite.remove(world,claw.link);claw.link=null;claw.held=null;b.frictionAir=.012;
  // gigante levado até a porta do prêmio: conta como pego e cai pela portinhola (é largo demais para o buraco)
  if(b.plush.giant){if(!reason&&(claw.state==='release'||claw.x<DIV)){b.plush.won=1;b.collisionFilter.mask=0;Body.setPosition(b,{x:Math.min(b.position.x,DIV*.5),y:b.position.y});Body.setVelocity(b,{x:0,y:2});return}
    b.collisionFilter.mask=CAT_PLUSH|CAT_WALL|CAT_PRONG|CAT_GUARD}
  setTimeout(()=>{b.collisionFilter.mask=CAT_PLUSH|CAT_WALL|CAT_PRONG|CAT_GUARD},900);
  if(reason==='slip'){banner(claw.snag?'Enroscou!':'Escorregou!',b.plush.name);thud()}
  if(reason==='liso'){banner('Escorregou!',b.plush.egg>=0?'O ovo lendário é liso... tente de novo':'Ovo liso!');thud()}
  if(reason==='heavy'){banner('Pesado demais!',b.plush.name+' · '+b.plush.g+' g');thud()}
}
function stress(){return claw.held?claw.held.plush.g/claw.hold:0}

// avisos para as missões (js/missoes.js): capture, feed, pet, play, battle_win, stone, giant_play, giant_capture, giant_evolve
function evento(kind,n){try{window.dispatchEvent(new CustomEvent('garro:evento',{detail:{kind,n:n||1}}))}catch(e){}}
function won(b){
  const p=b.plush;
  // ovo lendário que caiu sem estar firme na garra (empurrado) volta para o meio da caixa
  if(p.egg>=0&&claw.eggFirm!==true){addLegEgg(-80);banner('Quase!','O ovo lendário voltou para o meio');return}
  if(p.egg!==undefined){roundWin=true;losses=0;evento('capture');shakeWin(4);puff(50,FLOOR-40,18,['#ffd23c','#ffffff','#c9b4ff'],true);
    try{window.dispatchEvent(new CustomEvent('garro:ovo',{detail:{leg:p.egg}}))}catch(e){}hud();return}if(p.stone!==undefined){INV.st[p.stone]++;saveInv();roundWin=true;losses=0;banner(p.name+'!','Pedra rara! Use no bicho do mesmo elemento',true);fanfare();hud();return}
  // épico: só conta se a garra estava firme (sorteio no servidor no começo da jogada)
  if(p.epic){if(claw.epicFirm!==true){placeEpic();banner('Quase!','O épico escapou e voltou para o lugar');return}
    if(p.epicEgg){const e=p.ei;evento('capture');shakeWin(12);boom();fanfare();setTimeout(fanfare,600);puff(50,FLOOR-40,22,['#ffd23c','#ff7a2a','#ffffff'],true);
      const ev=d=>{try{window.dispatchEvent(new CustomEvent('garro:ovoepico',{detail:d}))}catch(_){}};
      if(ONL&&!DEV)srv('epic_capture',{},r=>{if(typeof r.coins==='number'){coins=r.coins;hud()}ev({epic:r.epic,egg:r.egg})});else ev({epic:e,local:1});
      roundWin=true;losses=0;banner('🔥 OVO ÉPICO!','Ovo de '+PLUSH[e].name+' foi para o Ninho',true);hud();return}
    const e=p.i;evento('capture');coll[e]=(coll[e]||0)+1;saveX();const c0=careOf(e);c0.xp=Math.max(c0.xp,xpTotal(e,30));saveCare();shakeWin(12);boom();fanfare();setTimeout(fanfare,600);
    if(ONL&&!DEV)srv('epic_capture',{},r=>{coll[r.epic]=r.count;careOf(r.epic).xp=r.xp;saveX();saveCare();renderShelf()});
    roundWin=true;losses=0;banner('🔥 ÉPICO! '+p.name,'O bichinho mais forte que existe',true);renderShelf(e);hud();return}
  if(p.giant){evento('capture');evento('giant_capture');coll[p.i]=(coll[p.i]||0)+1;saveX();GCOLL[p.i]=(GCOLL[p.i]||0)+1;saveG();shakeWin(10);boom();for(let k=0;k<3;k++)setTimeout(()=>puff(40+Math.random()*60,FLOOR-40,26,['#ffd23c','#ff5a8a','#5ad1ff','#8aff6a','#ffffff'],true),k*300);const c0=careOf(p.i);c0.xp+=60;saveCare();if(ONL&&!DEV)srv('giant_capture',{plushId:p.i},r=>{coll[p.i]=r.count;GCOLL[p.i]=r.giants;careOf(p.i).xp=r.xp;saveX();saveG();saveCare();renderShelf();try{window.dispatchEvent(new CustomEvent('garro:gigante',{detail:r}))}catch(e){}});
    else try{window.dispatchEvent(new CustomEvent('garro:gigante',{detail:{local:1}}))}catch(e){}
    roundWin=true;losses=0;banner('🏆 GIGANTE! '+p.name,'+60 XP · selo de gigante na coleção',true);fanfare();setTimeout(fanfare,700);renderShelf(p.i);hud();return}
  // redondo pego pode virar um grande do mesmo grupo de pedra (logado: o servidor sorteia; sem login/dev: sorteio aqui)
  let id=p.i,tr=false;
  if(!HAB.ativo&&(!ONL||DEV)&&id>=CH0&&Math.random()<(MQR.transformar_chance||0)){const g=[];for(let j=0;j<CH0;j++)if(STONE_OF(j)===STONE_OF(id))g.push(j);if(g.length){id=g[Math.random()*g.length|0];tr=true}}
  evento('capture');coll[id]=(coll[id]||0)+1;saveX();const dup=coll[id]>1,evo=id<CH0;if(dup){const c0=careOf(id);c0.xp+=evo?20:5;saveCare()}
  syncEstado('capture',{plushId:p.i}).then(r=>{if(r&&r.transformed&&r.plushId!==p.i){coll[p.i]=Math.max(0,(coll[p.i]||0)-1);coll[r.plushId]=Math.max((coll[r.plushId]||0)+1,r.count||1);saveX();transformou(p.i,r.plushId)}});
  roundWin=true;losses=0;
  if(tr)transformou(p.i,id);
  else{banner(p.name+'!',dup?(evo?'Repetida! +20 XP pra evoluir':Math.min(coll[id],BOL_N)+'/'+BOL_N+' para o '+evName(id-CH0,1)):p.rare<=2?'Pelúcia rara!':'Caiu no prêmio',true);fanfare()}
  renderShelf(id);hud();
}
function transformou(de,para){setTimeout(()=>{banner('✨ Transformou!',PLUSH[de].name+' virou '+PLUSH[para].name+'!',true);fanfare();setTimeout(fanfare,500);shakeWin(6);
  puff(50,FLOOR-40,22,['#ffd23c','#ffffff','#9ad8ff','#ff9ad8'],true);renderShelf(para)},350)}

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
      if(c.slipAt>0&&c.y<c.slipAt)release(c.held.plush.egg!==undefined?'liso':c.held.plush.g>c.hold*1.25?'heavy':'slip');
      else if(!HAB.ativo&&!c.firme&&Math.random()<Math.max(0,stress()-.6)*.01+(Math.abs(c.held.angularVelocity)>.06?stress()*.012:0))release('slip');
    }
    if(c.y<=REST){c.y=REST;c.state='top';c.t=0;hum(false);
      if(c.held&&!c.firme&&!HAB.ativo){c.hold*=.82;const s=stress();if(s>1&&Math.random()<.8)release('slip');else if(Math.random()<Math.pow(s,4)*.35)release('slip')}}
  }else if(c.state==='top'){
    if(++c.t>24){c.state='return';hum(true)}
  }else if(c.state==='return'){
    const d=HOME-c.x;c.x+=Math.sign(d)*Math.min(Math.abs(d),c.held&&c.held.plush.giant?1.05:1.8);
    if(!HAB.ativo&&c.held&&!c.firme&&Math.random()<Math.max(0,stress()-.7)*.008+(Math.abs(c.held.angularVelocity)>.07?stress()*.01:0))release('slip');
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
  tiraDaBorda();
  Engine.update(engine,1000/60);
  for(let i=bodies.length-1;i>=0;i--){const b=bodies[i];
    if(b.position.y>H+60){Composite.remove(world,b);bodies.splice(i,1);if(b.position.x<DIV+20)won(b)}
    else if(b.plush.giant&&b!==claw.held&&(b.plush.won?b.position.y>FLOOR-40:(b.position.x<DIV+30&&b.position.y>230))){Composite.remove(world,b);bodies.splice(i,1);won(b)}
    else if(b.plush.giant&&!b.plush.landed&&b.position.y>FLOOR-b.plush.dh*.5-26&&Math.abs(b.velocity.y)<1.6){b.plush.landed=true;shakeWin(8);boom();puff(b.position.x,FLOOR-6,30,['#8a7a6a','#b8a890','#6a5a4a']);banner('🦖 GIGANTE!',b.plush.name+' · '+b.plush.cm+' cm',true)}
    else if(b.plush.giant&&!b.plush.won&&b.position.x>=DIV+30&&b.position.y>FLOOR+10){Body.setPosition(b,{x:Math.min(W-90,b.position.x),y:FLOOR-130});Body.setVelocity(b,{x:0,y:0})}}
}
function drawHab(){const c=claw;
  // guia de mira: linha até o bichinho embaixo; verde quando está dentro da margem dele
  if(c.state==='move'||c.state==='ready'){let alvo=null;for(const b of bodies){if(b.position.x<DIV)continue;const h=b.plush.dw/2;if(Math.abs(b.position.x-c.x)<h&&(!alvo||b.position.y<alvo.position.y))alvo=b}
    let ok=false;if(alvo){const C=HABC(alvo.plush);ok=Math.abs(alvo.position.x-c.x)<=alvo.plush.dw/2*C.mira}
    const y1=alvo?alvo.position.y:FLOOR;ctx.save();ctx.setLineDash([4,5]);ctx.lineWidth=2;ctx.strokeStyle=ok?'rgba(90,255,140,.9)':'rgba(255,255,255,.45)';ctx.beginPath();ctx.moveTo(c.x,c.y+40*CS);ctx.lineTo(c.x,y1);ctx.stroke();ctx.setLineDash([]);
    if(alvo){const C=HABC(alvo.plush),w=alvo.plush.dw*C.mira;ctx.fillStyle=ok?'rgba(90,255,140,.28)':'rgba(255,255,255,.16)';ctx.fillRect(alvo.position.x-w/2,alvo.position.y-3,w,6)}ctx.restore()}
  // barra de força: sobe e desce; toque em PEGAR de novo para travar na faixa verde
  if(c.state==='down'||c.state==='close'||(c.state==='up'&&c.habF!=null&&c.y>REST+40)){const X=W-22,Y0=120,Hh=220,alvo=c.target||null;
    let C=HABC((alvo&&alvo.plush)||{i:CH0});if(!alvo){let mais=null;for(const b of bodies)if(Math.abs(b.position.x-c.x)<b.plush.dw/2&&(!mais||b.position.y<mais.position.y))mais=b;if(mais)C=HABC(mais.plush)}
    const f=c.habF!=null?c.habF:habForca();ctx.save();ctx.fillStyle='rgba(0,0,0,.7)';ctx.fillRect(X-12,Y0-6,24,Hh+12);
    ctx.fillStyle='rgba(255,255,255,.18)';ctx.fillRect(X-8,Y0,16,Hh);
    const gv=C.verde,gc=HAB.verde_centro;ctx.fillStyle='#4be37a';ctx.fillRect(X-8,Y0+Hh*(1-(gc+gv/2)),16,Hh*gv);
    const yy=Y0+Hh*(1-f);ctx.fillStyle=c.habF!=null?'#ffd25a':'#fff';ctx.fillRect(X-14,yy-3,28,6);
    ctx.font='900 9px system-ui';ctx.textAlign='center';ctx.fillStyle='#fff';ctx.fillText('FORÇA',X,Y0-10);
    if(c.habF==null&&c.state==='down'){ctx.font='800 11px system-ui';ctx.fillText('toque PEGAR',X-40,Y0+Hh+18)}ctx.restore()}
}
function draw(){
  ctx.drawImage(back,0,0,W,H);if(MACH===2){ctx.drawImage(backG,0,0,W,H);drawGiantDecor()}
  for(const b of bodies)if(b!==claw.held)drawPlush(b);
  if(claw.held)drawPlush(claw.held);
  ctx.drawImage(front,0,0,W,H);
  ctx.drawImage(rail,0,0,W,H);
  drawClaw();drawFX();if(HAB.ativo)drawHab();
}
let last=performance.now(),acc=0;
// com a Aventura, o visualizador, a luta ou a loja por cima, a máquina para (não gasta o celular desenhando o que ninguém vê)
const cobre=()=>{const a=document.getElementById('aventura');let vo=false;try{vo=!!V.open}catch(e){}return !!((a&&!a.hidden)||vo||!$('battle').hidden||!$('shop').hidden||!$('inv').hidden)};
function loop(now){if(cobre()){last=now;requestAnimationFrame(loop);return}acc+=Math.min(80,now-last);last=now;let n=0;while(acc>=16.67&&n<4){step();acc-=16.67;n++}draw();requestAnimationFrame(loop)}
setProngs();requestAnimationFrame(loop);

/* ---------- sound ---------- */
let ac=null,motor=null;
function audio(){if(!ac){try{ac=new(window.AudioContext||window.webkitAudioContext)()}catch(e){}}if(ac&&ac.state==='suspended')ac.resume()}
function tone(f,d,type,vol){if(!ac||(window.GARRO_SOM&&GARRO_SOM.mudoEfeitos()))return;try{const o=ac.createOscillator(),g=ac.createGain();o.type=type||'sine';o.frequency.value=f;
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
  let tot=0;PLUSH.forEach(p=>{if(p.leg||p.fora)return;tot++;const n=coll[p.i]||0;if(n)got++;
    const s=document.createElement('button');s.className='slot'+(n?'':' lock');s.setAttribute('aria-label',n?p.name:'Pelúcia não capturada');
    const stg=n&&p.i<CH0?careStage(p.i):0;if(stg)s.className+=' was';s.innerHTML=(GCOLL[p.i]?'<i class="gbadge">🏆'+(GCOLL[p.i]>1?GCOLL[p.i]:'')+'</i>':'')+'<img src="'+p.img+'" alt=""><span>'+(n?evName(p.i,0):'???')+'</span>'+(n>1?'<b>×'+n+'</b>':'')+(n?'<u>'+(stg?'evoluiu ↓':'NV '+lvOf(p.i))+'</u>':'');
    s.addEventListener('click',()=>{if(n){$('detail').hidden=true;openViewer(p.i)}else detail(p.i)});g.appendChild(s)});
  // evoluídos: cada um ganha um lugar novo, separado da forma de antes
  const evs=PLUSH.filter(p=>p.i<CH0&&(coll[p.i]||0)>0&&careStage(p.i)===1);
  if(evs.length){const h=document.createElement('div');h.className='gsec';h.textContent='★ Evoluídos ('+evs.length+')';g.appendChild(h);
    evs.forEach(p=>{const s=document.createElement('button');s.className='slot evo';s.setAttribute('aria-label',evName(p.i,1));
      s.innerHTML=(GCOLL[p.i]?'<i class="gbadge">🏆'+(GEVO[p.i]?'★':'')+'</i>':'')+'<img src="'+(EVOSPR[p.i]?EVOSPR[p.i].img:p.img)+'" alt=""><span>'+evName(p.i,1)+'</span><u>★ NV '+lvOf(p.i)+'</u>';
      s.addEventListener('click',()=>{$('detail').hidden=true;openViewer(p.i)});g.appendChild(s)})}
  $('count').textContent=got+' de '+tot;
  if(focus!==undefined&&!isLeg(focus))detail(focus);
  try{window.dispatchEvent(new Event('garro:estante'))}catch(e){}
}
