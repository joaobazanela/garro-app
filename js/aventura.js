/* GARRO — Aventura: mapa de fases; cada fase é um mapa 3D visto de cima (floresta): o bichinho anda com o joystick,
   enfrenta os bichinhos selvagens em tempo real (Atacar, Poder, Especial do elemento, Esquivar) e chega ao portal.
   O mapa de cada partida é sorteado por js/mapas.js (o do JSON, data/aventura.json → mapa3d, é a reserva).
   Conteúdo (fases, inimigos, níveis, prêmios, regras da luta e da energia) vem de data/aventura.json (window.GD.aventura).
   Logado: começar gasta energia no servidor, e o servidor confere a vitória antes de pagar (rpc_adv_start / rpc_adv_end).
   Sem login: progresso e energia ficam no aparelho. */
(function(){
const G=window.GARRO,GD=window.GD||{},D=GD.aventura,PD=GD.pelucias;
if(!G||!D||!PD)return;
const $=id=>document.getElementById(id);
const LT=D.luta,EN=D.energia,STAT=PD.STAT,ELEM=PD.ELEM,ECOL=PD.ECOL,ELNAME=PD.ELNAME,BFX=(GD.modelos&&GD.modelos.BFX)||{};
const FASES=[];D.mundos.forEach(m=>m.fases.forEach(f=>FASES.push(Object.assign({mundo:m},f))));
// lendários (js/lendarios.js, ids a partir de G.LEG0): contam como bichinhos grandes
const LEG0=G.LEG0||43,NLEG=((GD.lendarios||{}).lendarios||[]).length,grande=i=>i<G.CH0||(NLEG>0&&i>=LEG0),redondo=i=>!grande(i);
const DESLIZA=new Set(((GD.lendarios||{}).lendarios||[]).concat((GD.lendarios||{}).epicos||[]).filter(L=>L.anda==='desliza').map(L=>+L.id)),cobra=i=>DESLIZA.has(i);
// Desafio Lendário: fase extra depois do chefão do mundo; o chefão é o lendário do dia (troca à meia-noite de Brasília, igual ao servidor)
function legDoDia(){const h=new Date(Date.now()-3*3600e3).toISOString().slice(0,10);return Math.floor(Date.parse(h+'T00:00:00Z')/864e5)%10}
if(D.desafio&&D.desafio.mapa3d&&NLEG>=10){const f=Object.assign({mundo:D.mundos[0],desafio:true},D.desafio);Object.defineProperty(f,'chefe',{get:()=>[LEG0+legDoDia(),D.desafio.nivel],enumerable:true});
  const pos=FASES.findIndex(x=>x.id===D.desafio.depois_de);FASES.splice(pos<0?FASES.length:pos+1,0,f)}// logo depois do chefão que o libera
const LKEY='garro-aventura';

// ---------- números da luta (mesmas fórmulas usadas para equilibrar as fases) ----------
const media=a=>a.reduce((x,y)=>x+y,0)/a.length;
const MB=media(STAT.slice(0,G.CH0).map(s=>(s[0]+s[1])/2)),MS=media(STAT.slice(G.CH0,G.LEG0||43).map(s=>(s[0]+s[1])/2));
// o nível pesa muito: ataque, defesa e vida crescem juntos; bichinhos redondos são equiparados aos grandes
function lutador(i,lv,o){o=o||{};const s=STAT[i],M=grande(i)?MB:MS,k=MB/M,a=(s[0]+M)/2*k,d=(s[1]+M)/2*k;
  const P=1+LT.nivel_k*(lv-1),ev=G.isEvo(i,lv,o.rb)?LT.evoluido:1,RB=1+G.REB_B*(o.rb|0);
  let atk=a*P*ev*RB,def=d*P*ev*RB,hp=(a+d)*P*ev*RB*LT.vida_k*(o.heroi?LT.heroi_vida:1);
  if(o.chefe){hp*=LT.chefe_vida;atk*=LT.chefe_ataque}
  hp=Math.round(hp);return{i,lv,rb:o.rb|0,atk,def,hp,max:hp,el:ELEM[i],cd:0,defesa:false,chefe:!!o.chefe}}
const grupo=el=>(D.grupos&&D.grupos[el])||el;
function elemMult(A,B){const a=grupo(A.el),b=grupo(B.el);if((D.vantagens[a]||[]).includes(b))return LT.vantagem;if((D.vantagens[b]||[]).includes(a))return LT.desvantagem;return 1}
function dano(A,B,mult){const em=elemMult(A,B);let d=A.atk*mult*(1-LT.variacao+Math.random()*2*LT.variacao)*60/(60+B.def)*em;
  const crit=Math.random()<LT.critico;if(crit)d*=1.5;if(B.defesa)d*=LT.defesa;return{d:Math.max(1,Math.round(d)),crit,em}}
function nivelMax(f){return Math.max(...f.inimigos.map(x=>x[1]).concat(f.chefe?[f.chefe[1]]:[]))}
function recomendado(f){return nivelMax(f)+(f.chefe?2:3)}
// o servidor só aceita vitória se o bichinho tiver pelo menos este nível (nível do inimigo mais forte − folga)
function nivelMin(f){if(G.dev())return 1;return Math.max(1,nivelMax(f)-(D.nivel_min_folga??6))}

// ---------- estado: progresso (estrelas por fase) e energia por bichinho ----------
let L={prog:{},en:{}};try{const o=JSON.parse(localStorage.getItem(LKEY)||'');if(o&&o.prog)L=Object.assign(L,o)}catch(e){}
function saveL(){try{localStorage.setItem(LKEY,JSON.stringify(L))}catch(e){}}
let S=null;// vindo do servidor quando logado
const box=()=>G.online()&&S?S:L;
// libera depois da fase anterior (o Desafio Lendário depende do chefão do mundo 1; o mundo seguinte não depende do Desafio)
function liberada(k){const f=FASES[k];if(G.dev())return true;// administradores (data/regras.json → DEV_EMAILS): qualquer fase, para teste
  if(f.desafio)return !!box().prog[f.depois_de];let j=k-1;while(j>=0&&FASES[j].desafio)j--;return j<0||!!box().prog[FASES[j].id]}
// nível do bichinho nesta partida: o real, ou (só admin, para testar) o recomendado da fase ou 100
let ADMLV=0;const admLv=(i,f)=>G.dev()&&ADMLV?(ADMLV==='rec'?recomendado(f):ADMLV):G.lvOf(i);
const numDe=k=>FASES.slice(0,k).filter(x=>!x.desafio&&x.mundo===FASES[k].mundo).length+1;// número da fase dentro do mundo (o Desafio não conta)
const temaDe=f=>(f&&f.mundo&&f.mundo.tema)||null;
function energia(i){if(G.dev())return{e:EN.max,s:Date.now(),falta:0};const r=box().en[i];if(!r)return{e:EN.max,s:Date.now(),falta:0};let e=r.e,s=r.s;const step=EN.recarga_min*6e4;
  if(e<EN.max){const n=Math.floor((Date.now()-s)/step);if(n>0){e=Math.min(EN.max,e+n);s=e>=EN.max?Date.now():s+n*step}}
  return{e,s,falta:e>=EN.max?0:Math.max(0,s+step-Date.now())}}
function tempo(ms){const m=Math.ceil(ms/6e4);return m>=60?Math.floor(m/60)+'h'+(m%60?String(m%60).padStart(2,'0'):''):m+' min'}
async function carregarServidor(){
  if(!G.online())return;
  try{const sb=G.sb();const [{data:p},{data:e}]=await Promise.all([sb.from('adventure_progress').select('stage,stars'),sb.from('adventure_energy').select('plush_id,energy,since')]);
    const n={prog:{},en:{}};(p||[]).forEach(r=>{n.prog[r.stage]=r.stars});(e||[]).forEach(r=>{n.en[r.plush_id]={e:r.energy,s:Date.parse(r.since)}});S=n;
    if(!pan.hidden&&TELA==='mapa')mapa();else if(!pan.hidden&&TELA==='escolha')escolha(FK)
  }catch(err){console.warn('aventura',err)}
}

// ---------- tela ----------
const tabs=document.querySelector('.mtabs');
if(tabs&&!$('mach3')){const b=document.createElement('button');b.id='mach3';b.type='button';b.textContent='🗺️ Aventura';tabs.appendChild(b);tabs.classList.add('tres')}
const pan=document.createElement('div');pan.className='adv';pan.id='aventura';pan.hidden=true;
pan.innerHTML='<div class="advtop"><button id="advBack" type="button" aria-label="Voltar">‹</button><h3 id="advTitle">Aventura</h3><span id="advCoins"></span></div><div class="advmsg" id="advMsg"></div><div class="advbody" id="advBody"></div>';
document.body.appendChild(pan);
let TELA='mapa',FK=0,SEL=null,RUN=null;
function moedas(){$('advCoins').textContent=G.coins()+' 🪙'}
function msg(t){$('advMsg').textContent=t||''}
function abrir(){G.click(650);msg('');pan.hidden=false;mapa();carregarServidor()}
function fechar(){if(RUN&&!RUN.fim)return desistir();limpa3D();pan.hidden=true;RUN=null}
$('mach3').addEventListener('click',abrir);
$('advBack').addEventListener('click',()=>{if(TELA==='mapa')fechar();else if(TELA==='escolha')mapa();else desistir()});

function estrelas(n){return '★'.repeat(n)+'☆'.repeat(3-n)}
// mapa: um MAPA-MÚNDI no alto (ilhas dos mundos) e, embaixo, uma JANELA por mundo que passa para o lado
// (cada janela tem o nome do mundo e as fases dele). Visual de cada mundo: data/aventura.json → mundos[].tema.mapa
const MAPA0={floresta:{ic:'🌳',c:['#1f5a2c','#0e2a16'],x:16,y:62},mar:{ic:'🌊',c:['#1a6a9a','#0a2a4a'],x:38,y:78},montanha:{ic:'💎',c:['#5a3a7a','#1c1028'],x:50,y:36},
  trevas:{ic:'🌑',c:['#3a2a5a','#120a1e'],x:84,y:26},fogo:{ic:'🌋',c:['#9a3a12','#2a0a04'],x:80,y:72},luz:{ic:'☀️',c:['#e8d8a0','#8a7a50'],x:24,y:30}};
let JAN=-1;
const vMundo=m=>Object.assign({ic:'⭐',c:['#2a4a3a','#0e1a14'],x:50,y:50},MAPA0[m.id]||{},(m.tema&&m.tema.mapa)||{});
// posições das fases dentro da janela: "cobrinha" de 3 colunas, de cima para baixo
const PJ=k=>{const r=Math.floor(k/3),c=k%3;return{x:[18,50,82][r%2?2-c:c],y:62+r*112}};
function mapa(){limpa3D();TELA='mapa';RUN=null;moedas();$('advTitle').textContent='Aventura';
  const pr=box().prog;let cur=FASES.findIndex((f,k)=>liberada(k)&&!pr[f.id]);if(cur<0)cur=FASES.length-1;
  const MS=D.mundos.map((m,mi)=>{const ks=FASES.map((f,k)=>k).filter(k=>FASES[k].mundo===m),pri=ks.find(k=>!FASES[k].desafio),ok=pri!==undefined&&liberada(pri),
    est=ks.reduce((a,k)=>a+(FASES[k].desafio?0:pr[FASES[k].id]||0),0),tot=ks.filter(k=>!FASES[k].desafio).length*3;return{m,mi,ks,ok,est,tot,v:vMundo(m)}});
  if(JAN<0||JAN>=MS.length){JAN=Math.max(0,MS.findIndex(o=>o.ks.includes(cur)))}
  // mapa-múndi
  let h='<div class="advmundi" role="tablist" aria-label="Mapa-múndi">';
  MS.forEach(o=>{h+='<button type="button" class="advilha'+(o.ok?'':' bloq')+(o.mi===JAN?' on':'')+'" data-m="'+o.mi+'" style="left:'+o.v.x+'%;top:'+o.v.y+'%;--c1:'+o.v.c[0]+';--c2:'+o.v.c[1]+'" aria-label="'+o.m.nome+'">'+
    '<span>'+(o.ok?o.v.ic:'🔒')+'</span><b>'+o.m.nome+'</b>'+(o.ok?'<i>★ '+o.est+'/'+o.tot+'</i>':'')+'</button>'});
  h+='</div><div class="advjnav"><button type="button" data-nav="-1" aria-label="Mundo anterior">‹</button><div class="advdots">'+MS.map(o=>'<i data-m="'+o.mi+'"'+(o.mi===JAN?' class="on"':'')+'></i>').join('')+'</div><button type="button" data-nav="1" aria-label="Próximo mundo">›</button></div>';
  // janelas
  h+='<div class="advjanelas" id="advJan">';
  MS.forEach(o=>{const n=o.ks.length,H=PJ(n-1).y+90,dc=(o.m.tema&&o.m.tema.deco)||['🌲','🌳','🍄','🌿','🌸','🪨'];
    h+='<section class="advjan'+(o.ok?'':' bloq')+'" data-m="'+o.mi+'" style="--c1:'+o.v.c[0]+';--c2:'+o.v.c[1]+'"><header><small>Mundo '+(o.mi+1)+'</small><h4>'+(o.ok?o.v.ic+' ':'🔒 ')+o.m.nome+'</h4><span>★ '+o.est+'/'+o.tot+'</span></header>';
    let pts='';o.ks.forEach((k,q)=>{const P=PJ(q);pts+=(q?' L':'M')+P.x+' '+P.y});
    h+='<div class="advjmap" style="height:'+H+'px"><svg viewBox="0 0 100 '+H+'" preserveAspectRatio="none"><path d="'+pts+'" class="trilha"/><path d="'+pts+'" class="trilha2"/></svg>';
    for(let q=0;q<10;q++)h+='<span class="advdeco" style="left:'+((q*37+9)%90+5)+'%;top:'+((q*71+30)%(H-30))+'px">'+dc[q%dc.length]+'</span>';
    o.ks.forEach((k,q)=>{const f=FASES[k],P=PJ(q),ok=liberada(k),st=pr[f.id]||0,cls=st?'feita':ok?'atual':'bloq';
      h+='<button type="button" class="advnode '+cls+(f.chefe?' chefe':'')+(f.desafio?' lenda':'')+'" data-k="'+k+'" style="left:'+P.x+'%;top:'+P.y+'px"'+(ok?'':' disabled')+'>'+
        (f.chefe?'<img src="'+G.sprite(f.chefe[0],G.EVO_LV,1)+'" alt="">':'<b>'+numDe(k)+'</b>')+(ok?'':'<em>🔒</em>')+'<i>'+(f.desafio?'👑 '+f.nome:st?estrelas(st):f.chefe?'Chefão':'')+'</i><s class="cav" aria-label="Dificuldade '+(f.caveiras||1)+' de 5">'+caveiras(f)+'</s></button>'});
    h+='</div>'+(o.ok?'':'<p class="advjbloq">Vença o chefão do mundo anterior para abrir.</p>')+'</section>'});
  h+='</div>'+(G.dev()?'<p class="advnote">🛠 Modo teste (admin): todas as fases liberadas, sem cansaço e sem nível mínimo.</p>':'')+'<p class="advnote">Arraste para o lado ou toque numa ilha do mapa para trocar de mundo. Cada fase cansa um pouco o bichinho (⚡).</p>';
  $('advBody').innerHTML=h;$('advBody').scrollTop=0;
  const J=$('advJan');J.scrollLeft=JAN*J.clientWidth;
  let tq=0;J.addEventListener('scroll',()=>{clearTimeout(tq);tq=setTimeout(()=>{const k=Math.round(J.scrollLeft/Math.max(1,J.clientWidth));if(k!==JAN){JAN=k;marcaJan()}},60)},{passive:true})}
function marcaJan(){document.querySelectorAll('.advilha').forEach(b=>b.classList.toggle('on',+b.dataset.m===JAN));document.querySelectorAll('.advdots i').forEach(b=>b.classList.toggle('on',+b.dataset.m===JAN))}
function irJan(k){const J=$('advJan');if(!J)return;JAN=Math.max(0,Math.min(D.mundos.length-1,k));J.scrollLeft=JAN*J.clientWidth;marcaJan()}

// escolher o bichinho
function pips(e){let s='';for(let k=0;k<EN.max;k++)s+='<i class="'+(k<e?'on':'')+'"></i>';return '<span class="advpips">'+s+'</span>'}
function escolha(k){limpa3D();TELA='escolha';FK=k;const f=FASES[k];moedas();$('advTitle').textContent=f.desafio?f.nome:(D.mundos.length>1?f.mundo.nome+' · ':'')+'Fase '+numDe(k);
  const coll=G.coll(),meus=Object.keys(coll).map(Number).filter(i=>coll[i]>0).sort((a,b)=>G.lvOf(b)-G.lvOf(a));
  if(SEL===null||!meus.includes(SEL))SEL=meus[0]??null;
  const LG=f.desafio&&window.GARRO_LEND?window.GARRO_LEND.porId(f.chefe[0]):null;
  let h='<div class="advfase'+(f.desafio?' lenda':'')+'"><b>'+f.nome+'</b><small>'+(f.desafio?'👑 Hoje: <b>'+(LG?LG.nome:G.name(f.chefe[0]))+'</b> · '+Math.round((f.chance_ovo||0)*100)+'% de chance do ovo dele (na 1ª vitória do dia) · troca todo dia':box().prog[f.id]?'Já vencida '+estrelas(box().prog[f.id])+' · repetir dá só XP':'1ª vitória: +'+f.premio+' 🪙'+(f.chefe?' · chance de pedra de evolução · 💎 na 1ª vitória':''))+'</small>';
  const meuLv=SEL!==null?G.lvOf(SEL):1,tps=tiposDa(f);
  h+='<div class="advdif"><span class="cav">'+caveiras(f)+'</span>'+Object.keys(tps).map(t=>TP[t]?'<span class="tp">'+TP[t].icone+' '+TP[t].nome+(tps[t]>1?' ×'+tps[t]:'')+'</span>':'').join('')+'</div>';
  h+='<div class="advfoes">'+f.inimigos.map(([j,lv])=>'<span><img src="'+G.sprite(j,lv)+'" alt=""><small class="'+corNv(lv,meuLv)+'">Nv '+lv+'</small></span>').join('')+(f.chefe?'<span class="chefe"><img src="'+G.sprite(f.chefe[0],G.EVO_LV,1)+'" alt=""><small class="'+corNv(f.chefe[1],meuLv)+'">👑 Nv '+f.chefe[1]+'</small></span>':'')+'</div>';
  h+='<small class="advrec">Recomendado: Nv '+recomendado(f)+' ou mais</small></div>';
  if(!meus.length)h+='<p class="advnote">Pegue uma pelúcia na máquina para começar a aventura.</p>';
  h+='<div class="advpets">'+meus.map(i=>{const lv=G.lvOf(i),E=energia(i),el=ELEM[i];return '<button type="button" class="advpet'+(i===SEL?' sel':'')+(lv<recomendado(f)-4?' fraco':'')+'" data-i="'+i+'"><img src="'+G.sprite(i,lv,0,G.rbOf(i))+'" alt=""><b>'+(lv>=G.EVO_LV&&i<G.CH0?G.evName(i):G.name(i))+'</b><small>Nv '+lv+' · '+(ELNAME[el]||'')+'</small>'+pips(E.e)+(E.e<EN.max?'<small class="advwait">+1 ⚡ em '+tempo(E.falta)+'</small>':'')+'</button>'}).join('')+'</div>';
  if(SEL!==null){const E=energia(SEL),nm=nivelMin(f),lvs=G.lvOf(SEL);h+='<div class="advgo">'+(lvs<nm?'<button type="button" disabled>Precisa de Nv '+nm+'</button><small>'+G.name(SEL)+' ainda é fraco para esta fase. Cuide dele para subir de nível ou escolha outro bichinho.</small>':E.e>0?'<button type="button" id="advStart">Jogar! ▶ '+(CUSTO&&!G.dev()?'<small>· '+CUSTO+' 🪙</small>':'')+'</button>':'<button type="button" id="advRest">😴 Descansar · '+EN.descanso_preco+' 🪙</button><small>'+G.name(SEL)+' está cansado. Volta 1 ⚡ em '+tempo(E.falta)+', ou descanse agora.</small>')+'</div>'}
  if(G.dev())h+='<div class="advdev">🛠 Modo teste (admin) · nível do bichinho nesta partida: '+[['0','real'],['rec','recomendado (Nv '+recomendado(f)+')'],['100','Nv 100']].map(([v,t])=>'<button type="button" data-lv="'+v+'"'+(String(ADMLV)===v?' class="on"':'')+'>'+t+'</button>').join('')+'</div>';
  $('advBody').innerHTML=h;
  const st=$('advStart');if(st)st.addEventListener('click',()=>comecar(k,SEL));
  const rs=$('advRest');if(rs)rs.addEventListener('click',()=>descansar(SEL))}
$('advBody').addEventListener('click',e=>{
  const n=e.target.closest('.advnode');if(n&&TELA==='mapa'){G.click(700);msg('');escolha(+n.dataset.k);return}
  const il=e.target.closest('.advilha,.advdots i');if(il&&TELA==='mapa'){G.click(680);irJan(+il.dataset.m);return}
  const nv=e.target.closest('[data-nav]');if(nv&&TELA==='mapa'){G.click(680);irJan(JAN+(+nv.dataset.nav));return}
  const dv=e.target.closest('.advdev button');if(dv&&TELA==='escolha'){ADMLV=dv.dataset.lv==='0'?0:dv.dataset.lv==='rec'?'rec':+dv.dataset.lv;G.click(700);escolha(FK);return}
  const p=e.target.closest('.advpet');if(p&&TELA==='escolha'){G.click(760);SEL=+p.dataset.i;msg('');escolha(FK);return}
  const r=e.target.closest('[data-r]');if(r){const v=r.dataset.r;if(v==='mapa')mapa();else if(v==='prox')escolha(FK+1);else escolha(FK)}
});

async function descansar(i){if(G.coins()<EN.descanso_preco){msg('Faltam moedas para descansar ('+EN.descanso_preco+' 🪙).');return}
  if(G.online()){const r=await G.sync('adv_rest',{plushId:i});if(!r||r.error||typeof r.coins!=='number'){msg('Não deu para descansar agora. Tente de novo.');return}
    G.setCoins(r.coins);box().en[i]={e:r.energy,s:Date.now()}}
  else{G.addCoinsLocal(-EN.descanso_preco);L.en[i]={e:EN.max,s:Date.now()};saveL()}
  G.tone(523,.2,'sine',.08);msg('');escolha(FK)}

const ERROS={sem_moedas:'Faltam moedas para jogar.',cansado:'Seu bichinho está cansado. Descanse ou espere a energia voltar.',fase_bloqueada:'Vença a fase anterior primeiro.',nao_tem:'Você não tem esse bichinho.'};
// cada partida custa moedas (data/aventura.json → custo_moedas); o servidor cobra no adv_start; admin (dev) joga de graça
const CUSTO=D.custo_moedas||0;
async function comecar(k,i){const f=FASES[k];if(!liberada(k))return;const E=energia(i);if(E.e<1||G.lvOf(i)<nivelMin(f)){escolha(k);return}
  if(CUSTO&&!G.dev()&&G.coins()<CUSTO){msg('Cada partida custa '+CUSTO+' 🪙. Faltam '+(CUSTO-G.coins())+' moedas.');return}
  const b=$('advStart');if(b)b.disabled=true;G.click(820);
  if(G.online()){const r=await G.sync('adv_start',{plushId:i,stage:f.id});
    if(!r||r.error||typeof r.energy!=='number'){const det=r&&r.detail||'';msg(Object.keys(ERROS).map(x=>det.includes(x)?ERROS[x]:'').join('')||'Não deu para começar. Tente de novo.');if(b)b.disabled=false;await carregarServidor();return}
    box().en[i]={e:r.energy,s:Date.parse(r.since)};if(typeof r.coins==='number')G.setCoins(r.coins)}
  else{L.en[i]={e:E.e-1,s:E.e>=EN.max?Date.now():E.s};saveL();if(CUSTO&&!G.dev())G.addCoinsLocal(-CUSTO)}
  const lv=admLv(i,f);
  // mapa novo a cada partida (js/mapas.js): percurso e quantidade de bichinhos mudam; sem o gerador usa o mapa reserva do JSON
  let M3=f.mapa3d;try{if(window.GARRO_MAPAS)M3=GARRO_MAPAS.novo(f.desafio?11:f.mundo.fases.findIndex(x=>x.id===f.id)+1,{inimigos:f.inimigos,chefe:f.chefe},!!f.desafio,D.mapa_variacao,f.desafio?null:f.mundo.dif)}catch(e){console.warn('mapa',e)}
  if(M3&&!f.desafio&&f.mundo.tema)M3.tema=f.mundo.tema;
  RUN={k,f,i,M:M3,hero:lutador(i,lv,{heroi:1,rb:G.rbOf(i)}),fim:false,quit:0,leaves:0,dif:difDe(k)};
  luta()}

// ---------- a fase: mapa 3D visto de cima (joystick, luta em tempo real, habilidades) ----------
const AR=D.arena||{},TP=D.tipos||{};
// dificuldade que cresce fase a fase (data/aventura.json: curva = [1ª fase, última fase])
function difDe(k){const f=FASES[k],fs=f.mundo.fases,i=fs.findIndex(x=>x.id===f.id),t=fs.length>1?i/(fs.length-1):0,o={};
  for(const [c,[a,b]] of Object.entries(D.curva||{}))o[c]=a+(b-a)*t;
  // cada mundo novo é um pouco mais rápido e agressivo (data/aventura.json → mundos[].dif: vel, recarga)
  const W=!f.desafio&&f.mundo.dif;if(W){for(const c of['inimigo_vel','tiro_vel','aggro'])if(o[c]!=null)o[c]*=W.vel||1;for(const c of['inimigo_recarga','inimigo_aviso'])if(o[c]!=null)o[c]*=W.recarga||1}
  return o}
const DF=(c,pad)=>{const v=RUN&&RUN.dif&&RUN.dif[c];return v??AR[c]??pad};
// cor do nível do inimigo comparado ao seu bichinho: verde fácil, amarelo parelho, vermelho difícil
function corNv(lv,meu){return lv<=meu-3?'fac':lv>meu+2?'dif':'med'}
function caveiras(f){const n=f.caveiras||1;return '💀'.repeat(n)+'<b>'+'💀'.repeat(5-n)+'</b>'}
function tiposDa(f){const c={};for(const cp of (f.mapa3d&&f.mapa3d.acampamentos)||[])for(const e of cp.inimigos)if(e[4])c[e[4]]=(c[e[4]]||0)+1;return c}
const ESPECIAIS={fogo:['🔥','Chamas','cone'],agua:['🌊','Onda','onda'],planta:['🌿','Cipós','raiz'],raio:['⚡','Corrente','corrente'],gelo:['❄️','Nevasca','nova'],
  terra:['🪨','Tremor','tremor'],ar:['🌪️','Rajada','investida'],sombra:['🌑','Sombra Veloz','teleporte'],luz:['✨','Brilho Curador','cura'],veneno:['☠️','Névoa Tóxica','nuvem']};
let TEC={},JOY={x:0,y:0};
function nomeDe(i,lv,rb){return G.isEvo(i,lv,rb)?G.evName(i):G.name(i)}
function pausar(on){const R=RUN;if(!R||!R.r3||R.fim)return;R.pausaU=on;R.pausa=on;$('advPause').hidden=!on;som('abaixar',on);TEC={};JOY.x=JOY.y=0;G.click(on?600:760)}
function aviso(t,ms){const a=$('advAviso');if(!a)return;a.textContent=t;a.classList.add('on');clearTimeout(aviso.t);aviso.t=setTimeout(()=>a.classList.remove('on'),ms||2600)}
function luta(){TELA='luta';msg('');const R=RUN,f=R.f,h=R.hero;$('advTitle').textContent=f.nome;
  const pw=(BFX[h.el]&&BFX[h.el].e[0])||'✨',E=ESPECIAIS[grupo(h.el)]||ESPECIAIS.terra;R.esp=E;R.espOk=h.lv>=(AR.especial_nivel||10);
  const cor=ECOL[h.el]||'#ffb23a';
  $('advBody').innerHTML='<div class="advscene a3d" id="advScene" style="--el:'+cor+'"><canvas id="advCv"></canvas><div class="advdano" id="advDano"></div>'+
    '<div class="advhud"><div class="advme"><span class="foto"><img src="'+G.sprite(R.i,h.lv,0,h.rb)+'" alt=""><small>'+h.lv+'</small></span><div class="info"><b>'+nomeDe(R.i,h.lv,h.rb)+'</b>'+
      '<div class="hp"><i id="advHpMe"></i><span id="advHpTxt"></span></div><div class="advobj"><span id="advObjE"></span><span class="advleaf" id="advLeaf"></span><span class="cav">'+caveiras(f)+'</span></div></div></div>'+
      '<div class="advdir"><canvas class="advmini" id="advMini" width="192" height="192"></canvas><button type="button" class="advpausa" id="advPausa" aria-label="Pausar">⏸</button></div></div>'+
    '<div class="advboss" id="advBoss" hidden><b>👑 '+(f.chefe?G.evName(f.chefe[0]):'')+' <small>Nv '+(f.chefe?f.chefe[1]:'')+'</small><span id="advHpBossTxt"></span></b><div class="hp"><i id="advHpBoss"></i></div></div>'+
    '<div class="advfx" id="advFx"></div><div class="advaviso" id="advAviso"></div><div class="advload" id="advLoad"><i></i>Entrando na floresta…</div>'+
    '<div class="advjoy" id="advJoy"><i id="advJoyK"></i></div>'+
    '<div class="advskills"><button type="button" data-k="A" class="atk">⚔️<span>Atacar</span></button>'+
    '<button type="button" data-k="P" class="pw">'+pw+'<span>Poder</span><em></em></button>'+
    '<button type="button" data-k="E" class="esp'+(R.espOk?'':' trava')+'">'+(R.espOk?E[0]:'🔒')+'<span>'+(R.espOk?E[1]:'Nv '+(AR.especial_nivel||10))+'</span><em></em></button>'+
    '<button type="button" data-k="D" class="dodge">💨<span>Esquivar</span><em></em></button></div>'+
    '<div class="advpause" id="advPause" hidden><h4>Pausado</h4><button type="button" id="advCont">▶ Continuar</button><button type="button" id="advSair" class="sec">Desistir da fase</button><small>Desistir conta como derrota.</small><div id="advSomP"></div></div></div>';
  {const sp=$('advSomP');if(sp&&window.GARRO_SOM)sp.appendChild(GARRO_SOM.botao('advsom'))}
  $('advPausa').addEventListener('click',()=>pausar(true));$('advCont').addEventListener('click',()=>pausar(false));
  $('advSair').addEventListener('click',()=>{const R=RUN;if(!R||R.fimPend)return;$('advPause').hidden=true;R.pausaU=false;R.pausa=false;R.fim=true;R.fimPend=1;terminar(false)});
  controles();folhas();iniciar3D().catch(e=>{console.warn('aventura 3d',e);aviso('Não deu para carregar a fase. Volte e tente de novo.',6000)})}

// ---- pernas andando no próprio modelo 3D (passo diagonal, a pata de apoio fica no chão) ----
// cobra=true (data/lendarios.json → anda: "desliza", ex.: Astrakai): o corpo todo ondula de lado e desliza, sem passos
// ponto ao lado do caminho (fração t do comprimento do caminho), afastado d dele e longe de outros trechos; devolve [x,z,giro de frente para o caminho]
function lugarAoLado(M,t,d){const C=M.caminho;if(!C||C.length<2)return null;const seg=[];let tot=0;for(let k=0;k<C.length-1;k++){const l=Math.hypot(C[k+1][0]-C[k][0],C[k+1][1]-C[k][1]);seg.push(l);tot+=l}
  const distC=(x,z)=>{let m=1e9;for(let k=0;k<C.length-1;k++){const [ax,az]=C[k],[bx,bz]=C[k+1],vx=bx-ax,vz=bz-az,L2=vx*vx+vz*vz||1,u=Math.max(0,Math.min(1,((x-ax)*vx+(z-az)*vz)/L2));m=Math.min(m,Math.hypot(ax+vx*u-x,az+vz*u-z))}return m};
  for(const dt of [0,.04,-.04,.08,-.08,.12,-.12]){let alvo=Math.max(0,Math.min(1,t+dt))*tot,k=0;while(k<seg.length-1&&alvo>seg[k]){alvo-=seg[k];k++}
    const [ax,az]=C[k],[bx,bz]=C[k+1],l=seg[k]||1,ux=(bx-ax)/l,uz=(bz-az)/l,px=ax+ux*Math.min(alvo,l),pz=az+uz*Math.min(alvo,l);
    for(const lado of [1,-1]){const x=px-uz*d*lado,z=pz+ux*d*lado;if(Math.abs(x)<M.largura/2+2&&distC(x,z)>d*.85)return[x,z,Math.atan2(px-x,pz-z)]}}
  return null}
function prepAndar(g,mini,cobra){const T=G.THREE(),inv=new T.Matrix4(),v=new T.Vector3();g.updateMatrixWorld(true);inv.copy(g.matrixWorld).invert();
  const ms=[],mn=new T.Vector3(1e9,1e9,1e9),mx=new T.Vector3(-1e9,-1e9,-1e9),low=[];
  g.traverse(o=>{if(!o.isMesh||!o.geometry||!o.geometry.attributes.position)return;const M=new T.Matrix4().multiplyMatrices(inv,o.matrixWorld),p=o.geometry.attributes.position;
    let lo=1e9;const st=Math.max(1,Math.floor(p.count/3000)),pts=[];for(let k=0;k<p.count;k+=st){v.fromBufferAttribute(p,k).applyMatrix4(M);mn.min(v);mx.max(v);if(v.y<lo)lo=v.y;pts.push(v.x,v.y,v.z)}
    ms.push({o,M,lo,pts})});
  const H=mx.y-mn.y||1,hip=mn.y+H*(mini?.2:.34);let sx=0,n=0;const zs=[];
  for(const m of ms)for(let k=0;k<m.pts.length;k+=3)if(m.pts[k+1]<mn.y+H*.12){sx+=m.pts[k];n++;zs.push(m.pts[k+2])}
  zs.sort((a,b)=>a-b);const zm=zs.length?zs[zs.length>>1]:(mn.z+mx.z)/2,av=a=>a.reduce((s,x)=>s+x,0)/Math.max(1,a.length);
  const U={uPh:{value:0},uAmp:{value:0},uHip:{value:hip},uMin:{value:mn.y},uXm:{value:n?sx/n:0},uZm:{value:zm},uDx:{value:(mx.x-mn.x)*.08},uDz:{value:(mx.z-mn.z)*.06},uH:{value:H}};
  if(cobra){const Lc=Math.max(.2,mx.z-mn.z);U.uK={value:6.283*1.3/Lc};U.uZh={value:mx.z};U.uLc={value:Lc};
    for(const m of ms){const mat=m.o.material.clone(),M2=m.M.clone(),G2=m.M.clone().invert();
      mat.onBeforeCompile=sh=>{Object.assign(sh.uniforms,U,{uM2G:{value:M2},uG2M:{value:G2}});
        sh.vertexShader='uniform float uPh,uAmp,uMin,uH,uK,uZh,uLc;uniform mat4 uM2G,uG2M;\n'+sh.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
          {vec3 gp=(uM2G*vec4(transformed,1.)).xyz;float t=clamp((uZh-gp.z)/uLc,0.,1.),a=.3+uAmp/.45*.7,w=t*uLc*uK-uPh*2.4,cab=smoothstep(.05,.3,t);
            gp.x+=sin(w)*uLc*.05*a*cab;gp.y+=max(0.,sin(w*2.))*uLc*.004*a*cab;transformed=(uG2M*vec4(gp,1.)).xyz;}`)};
      mat.customProgramCacheKey=()=>'andar3d_cobra';m.o.material=mat}
    return U}
  for(const m of ms){if(m.lo>mn.y+H*.1)continue;const mat=m.o.material.clone(),M2=m.M.clone(),G2=m.M.clone().invert();
    mat.onBeforeCompile=sh=>{Object.assign(sh.uniforms,U,{uM2G:{value:M2},uG2M:{value:G2}});
      sh.vertexShader='uniform float uPh,uAmp,uHip,uMin,uXm,uZm,uDx,uDz,uH;uniform mat4 uM2G,uG2M;\n'+sh.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
        if(uAmp>0.){vec3 gp=(uM2G*vec4(transformed,1.)).xyz;float wy=1.-smoothstep(uHip-(uHip-uMin)*.55,uHip,gp.y);
          if(wy>0.){float g=(smoothstep(uXm-uDx,uXm+uDx,gp.x)*2.-1.)*(smoothstep(uZm-uDz,uZm+uDz,gp.z)*2.-1.);
            gp.z+=(uHip-gp.y)*tan(uAmp)*sin(uPh)*g*wy;gp.y+=max(0.,cos(uPh)*g)*uH*.06*wy*wy*(uAmp/.45);transformed=(uG2M*vec4(gp,1.)).xyz;}}`)};
    mat.customProgramCacheKey=()=>'andar3d';m.o.material=mat}
  return U}

// ---- cenário ----
function texChao(M){const T=G.THREE(),W=M.largura+24,Lz=M.comprimento+24,cw=1024,ch=Math.min(4096,Math.round(cw*Lz/W)),c=document.createElement('canvas');c.width=cw;c.height=ch;const x=c.getContext('2d');
  const px=X=>(X+W/2)/W*cw,pz=Z=>(Z+12)/Lz*ch,rnd=semente(M.comprimento*7+3);
  const TM=M.tema||{},texturizado=!!(TM.texturas&&TM.texturas.chao);if(!texturizado){x.fillStyle=TM.chao||'#3f6b3a';x.fillRect(0,0,cw,ch)}
  for(let k=0;k<(texturizado?0:cw*ch/60);k++){x.fillStyle=(TM.pintas||['#4a7a40','#36602f','#557f45','#3a6838','#2f5a2c'])[k%5];const a=rnd()*cw,b=rnd()*ch;x.fillRect(a,b,1.5,3+rnd()*3)}
  const linha=(w,cor)=>{x.strokeStyle=cor;x.lineWidth=w/W*cw;x.lineCap='round';x.lineJoin='round';x.beginPath();M.caminho.forEach(([X,Z],k)=>k?x.lineTo(px(X),pz(Z)):x.moveTo(px(X),pz(Z)));x.stroke()};
  const TR=TM.trilha||['#4f6a38','#7a6446','#8f7452','#9c7f5a'];linha(4.8,TR[0]);linha(3.6,TR[1]);linha(3.0,TR[2]);linha(2.0,TR[3]);
  for(let k=0;k<(texturizado?0:cw*ch/500);k++){const a=rnd()*cw,b=rnd()*ch;x.fillStyle='rgba(120,100,80,.35)';x.beginPath();x.arc(a,b,1+rnd()*2,0,7);x.fill()}
  if(M.arena){const a=M.arena;x.fillStyle='#8a6f4c';x.beginPath();x.ellipse(px(a.x),pz(a.z),a.r/W*cw,a.r/Lz*ch,0,0,7);x.fill();x.strokeStyle='#c9b4ff';x.lineWidth=3;x.setLineDash([8,8]);x.stroke();x.setLineDash([])}
  for(let k=0;k<(texturizado?0:cw*ch/1400);k++){const a=rnd()*cw,b=rnd()*ch,c=(TM.flores||['#ffb3d1','#fff3c4','#c9b4ff','#ffffff'])[k%4];for(let q=0;q<4;q++){x.fillStyle=c;x.beginPath();x.arc(a+Math.cos(q*1.57)*1.6,b+Math.sin(q*1.57)*1.6,1.3,0,7);x.fill()}x.fillStyle='#ffd23c';x.beginPath();x.arc(a,b,.9,0,7);x.fill()}
  const t=new T.CanvasTexture(c);t.encoding=T.sRGBEncoding;t.anisotropy=4;return t}
function semente(s){let a=s>>>0||1;return()=>{a=(a*1664525+1013904223)>>>0;return a/4294967296}}
function sprEmoji(e,tam,brilho){const T=G.THREE(),c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');
  if(brilho){const g=x.createRadialGradient(64,64,8,64,64,62);g.addColorStop(0,brilho);g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(0,0,128,128)}
  x.font='76px system-ui';x.textAlign='center';x.textBaseline='middle';x.fillText(e,64,70);const t=new T.CanvasTexture(c);t.encoding=T.sRGBEncoding;
  const s=new T.Sprite(new T.SpriteMaterial({map:t,transparent:true,depthWrite:false}));s.scale.set(tam,tam,tam);return s}
let SOMBRA=null;function sombra(r){const T=G.THREE();if(!SOMBRA){const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d'),g=x.createRadialGradient(32,32,2,32,32,31);
    g.addColorStop(0,'rgba(0,0,0,.45)');g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(0,0,64,64);SOMBRA=new T.CanvasTexture(c)}
  const m=new T.Mesh(new T.PlaneGeometry(r*2,r*2),new T.MeshBasicMaterial({map:SOMBRA,transparent:true,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.y=.02;return m}
// cenário 3D (data/aventura.json → cenario3d; modelos em models/cenario/ recortados do diorama do portal). Carrega uma vez só.
// cada mundo pode trocar os modelos (tema.cenario3d no data/aventura.json): a Caverna Encantada usa pedras, barril e lanterna da caverna
const C3C={};const cfgDe=TT=>Object.assign({},D.cenario3d||{},(TT&&TT.cenario3d)||{});
function props3d(TT){const CF=cfgDe(TT);if(!D.cenario3d||!G.glb)return Promise.resolve(null);const ck=JSON.stringify(CF);if(C3C[ck])return C3C[ck];
  const malha=g=>{let m=null;g.traverse(o=>{if(o.isMesh&&!m)m=o});if(!m)throw new Error('sem malha');const mat=m.material;mat.roughness=.9;mat.metalness=0;if(mat.map)mat.map.encoding=G.THREE().sRGBEncoding;return{geo:m.geometry,mat}};
  // extras (opcionais): pedras_modelos = modelos no lugar das pedras do mapa; marcos = cenários grandes fora do caminho (castelo, masmorra…)
  const PM=CF.pedras_modelos||[],MK=CF.marcos||[],ok=f=>G.glb(f).catch(e=>{console.warn('cenario 3d',f,e);return null});
  const fixa=o=>{o.traverse(q=>{if(q.isMesh&&q.material){q.material.roughness=.9;q.material.metalness=0;if(q.material.map)q.material.map.encoding=G.THREE().sRGBEncoding}});return o};
  return C3C[ck]=Promise.all([G.glb(CF.portal),...CF.arvores.map(f=>G.glb(f)),G.glb(CF.cogumelos),CF.lanterna?G.glb(CF.lanterna).catch(()=>null):null]).then(([por,...r])=>{const lan=r.pop(),cog=r.pop();
    fixa(por);
    return Promise.all([Promise.all(PM.map(ok)),Promise.all(MK.map(m=>ok(m.modelo)))]).then(([ped,mk])=>
      ({portal:por,arv:r.map(malha),cog:malha(cog),lan:lan?malha(lan):null,ped:ped.filter(Boolean).map(malha),marcos:MK.map((m,k)=>mk[k]?Object.assign({},m,{obj:fixa(mk[k])}):null).filter(Boolean)}))}).catch(e=>{console.warn('cenario 3d',e);delete C3C[ck];return null})}
// Texturas PBR reais (512px, tiling). O cache mantém uma única cópia por caminho.
// 'map' usa sRGB; normal, rugosidade e emissivo são mapas de dados lineares.
const TEX_PBR={};
function texPBR(caminho,cor){if(!caminho)return null;const T=G.THREE(),chave=caminho+'|'+(cor?'s':'l');if(TEX_PBR[chave])return TEX_PBR[chave];
  const t=new T.TextureLoader().load(caminho,undefined,undefined,e=>console.warn('textura aventura',caminho,e));
  t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=4;if(cor)t.encoding=T.sRGBEncoding;TEX_PBR[chave]=t;return t}
function matPBR(TT,chave,opts){const T=G.THREE(),p=TT&&TT.texturas&&TT.texturas[chave];if(!p)return new T.MeshStandardMaterial(opts||{});
  const a=Object.assign({},opts||{});if(p.map)a.map=texPBR(p.map,true);if(p.normalMap)a.normalMap=texPBR(p.normalMap,false);
  if(p.roughnessMap)a.roughnessMap=texPBR(p.roughnessMap,false);if(p.emissiveMap)a.emissiveMap=texPBR(p.emissiveMap,false);
  const m=new T.MeshStandardMaterial(a);if(m.normalMap)m.normalScale.set(.55,.55);return m}
// decoração própria de cada mundo (tema.decor): inspirada nos mapas "Caverna Encantada" e "Mundo Aquático"
// trechos do caminho (o labirinto vai para os lados, sobe e às vezes desce): [x0,z0,x1,z1,comprimento,ux,uz]
function trechos(M){const out=[];for(let k=0;k<M.caminho.length-1;k++){const [x0,z0]=M.caminho[k],[x1,z1]=M.caminho[k+1],d=Math.hypot(x1-x0,z1-z0);if(d>.5)out.push([x0,z0,x1,z1,d,(x1-x0)/d,(z1-z0)/d])}return out}
function decorMundo(S,M,C3,inst,rnd){const T=G.THREE(),TT=M.tema||{},DEC=TT.decor,mec={},NOVO=!!(TT.cenario2&&window.GARRO_MUNDOS3D);if(!DEC)return mec;
  const perto=(lista,n,d)=>{const out=[];lista.forEach(([x,z,s],k)=>{for(let q=0;q<n;q++)out.push([x+(rnd()-.5)*d,z+(rnd()-.5)*d,s*(.5+rnd()*.6),k+q])});return out};
  if(DEC==='caverna'){
    // cristais que brilham, em tufos perto das pedras grandes
    const cr=perto(M.arvores.filter((q,k)=>k%2===0),2,1.8).concat(perto(M.pedras,1,1.2)),cores=TT.cristais||['#ff7ad9','#6ef0ff','#b48aff'];
    if(!NOVO)cores.forEach((cor,c)=>{const L=cr.filter(q=>q[3]%cores.length===c);if(!L.length)return;
      const mat=matPBR(TT,'cristal',{color:cor,emissive:cor,emissiveIntensity:.9,roughness:.25,metalness:.1,flatShading:true});
      inst(new T.ConeGeometry(.16,1,5),mat,L,(o,[x,z,s],col)=>{o.position.set(x,.45*s,z);o.scale.set(s,s*(1.2+rnd()*.8),s);o.rotation.set((rnd()-.5)*.6,rnd()*6,(rnd()-.5)*.6);col.set('#ffffff')})});
    // lanternas penduradas em postes ao longo da trilha (luz quente na caverna escura)
    if(C3&&C3.lan){const ls=[];trechos(M).forEach(([x0,z0,x1,z1,d,ux,uz],k)=>{if(k%2)return;const lado=k%4?1:-1;ls.push([(x0+x1)/2-uz*2.4*lado,(z0+z1)/2+ux*2.4*lado])});
      const poste=matPBR(TT,'casca',{color:'#d8b8a2',roughness:.9});
      inst(new T.CylinderGeometry(.06,.08,2.6,6),poste,ls,(o,[x,z],c)=>{o.position.set(x,1.3,z);o.scale.set(1,1,1);o.rotation.set(0,0,0);c.set('#ffffff')});
      inst(C3.lan.geo,C3.lan.mat,ls,(o,[x,z],c)=>{o.position.set(x,1.9,z);o.scale.setScalar(.75);o.rotation.set(0,0,0);c.set('#ffffff')});
      for(const [x,z] of ls){const l=new T.PointLight(TT.lanterna_cor||'#ffb35a',1.1,7,1.6);l.position.set(x,1.9,z);S.add(l)}}
    // morcegos voando em círculos pela caverna
    mec.morcegos=[];for(let k=0;k<14;k++){const sp=sprEmoji('🦇',.55),cz=rnd()*M.comprimento,cx=(rnd()-.5)*M.largura*.8;S.add(sp);mec.morcegos.push({s:sp,cx,cz,r:1.5+rnd()*2.5,v:(rnd()<.5?-1:1)*(1+rnd()),f:rnd()*6,h:2.6+rnd()*1.5})}
  }
  if(DEC==='trevas'){
    // árvores secas (tronco e galhos tortos), cristais roxos e torres escuras com ponta brilhante
    if(!NOVO){const tr=perto(M.arvores.filter((q,k)=>k%3===0),1,1.4),tm=matPBR(TT,'casca',{color:'#aaa0b6',roughness:.9});
    inst(new T.CylinderGeometry(.05,.11,1.8,5),tm,tr,(o,[x,z,s],c)=>{o.position.set(x,.9*s,z);o.scale.set(s,s,s);o.rotation.set((rnd()-.5)*.15,0,(rnd()-.5)*.15);c.set('#ffffff')});
    for(const [ang,inc,h,y] of [[0,.9,.8,1.3],[2.2,.8,.7,1.0],[4.1,1,.6,1.5]])inst(new T.CylinderGeometry(.02,.05,1,4),tm,tr,(o,[x,z,s],c)=>{const a=ang+(x*7+z)%6;o.position.set(x+Math.sin(a)*Math.sin(inc)*.4*h*s,(y+.4*h*Math.cos(inc))*s,z+Math.cos(a)*Math.sin(inc)*.4*h*s);o.scale.set(s,h*s,s);o.rotation.set(Math.cos(a)*inc,0,-Math.sin(a)*inc);c.set('#ffffff')});
    const cr=perto(M.pedras,2,1.4),cores=TT.cristais||['#b46aff','#8a5aff','#ff6ad9'];
    cores.forEach((cor,ci)=>{const L=cr.filter(q=>q[3]%cores.length===ci);if(!L.length)return;const mat=matPBR(TT,'cristal',{color:cor,emissive:cor,emissiveIntensity:.9,roughness:.3,flatShading:true});
      inst(new T.ConeGeometry(.15,1,5),mat,L,(o,[x,z,s],c)=>{o.position.set(x,.45*s,z);o.scale.set(s,s*(1.1+rnd()),s);o.rotation.set((rnd()-.5)*.5,rnd()*6,(rnd()-.5)*.5);c.set('#ffffff')})});
    const to=perto(M.arvores.filter((q,k)=>k%9===4),1,.5),tq=matPBR(TT,'pedra',{color:'#aaaaaf',roughness:.9}),tp=matPBR(TT,'cristal',{color:'#9a5aff',emissive:'#7a3aff',emissiveIntensity:.8,flatShading:true});
    inst(new T.CylinderGeometry(.2,.35,3,6),tq,to,(o,[x,z,s],c)=>{o.position.set(x,1.5*s,z);o.scale.setScalar(s);o.rotation.set(0,0,0);c.set('#ffffff')});
    inst(new T.ConeGeometry(.7,1.3,6),tp,to,(o,[x,z,s],c)=>{o.position.set(x,3.5*s,z);o.scale.setScalar(s);o.rotation.set(0,0,0);c.set('#ffffff')})}
    // escuro: uma luz roxa acompanha o bichinho (a "lanterna")
    mec.lanterna=new T.PointLight('#d8b8ff',1.6,9,1.4);S.add(mec.lanterna);
  }
  if(DEC==='fogo'){
    // rios de lava dos dois lados da trilha, chamas e vulcões nas bordas
    const lava=matPBR(TT,'magma',{color:'#ffffff',emissive:NOVO?'#ffffff':'#ff6a1a',emissiveIntensity:NOVO?1.15:1.6,roughness:.7,side:T.DoubleSide});mec.magmaMaps=[lava.map,lava.normalMap,lava.roughnessMap,lava.emissiveMap].filter(Boolean);
    // magma nas beiradas dos corredores do labirinto e riachos de lava atravessando a trilha (passe com Esquivar)
    const tira=(cx,cz,len,larg,ax,az,px,pz)=>{const m=new T.Mesh(new T.PlaneGeometry(larg,len),lava);m.rotation.x=-Math.PI/2;m.rotation.z=-Math.atan2(ax,az);m.position.set(cx,.03,cz);S.add(m);
      (mec.lava=mec.lava||[]).push([cx-ax*len/2,cz-az*len/2,cx+ax*len/2,cz+az*len/2,px,pz])};
    trechos(M).forEach(([x0,z0,x1,z1,d,ux,uz],k)=>{const mx=(x0+x1)/2,mz=(z0+z1)/2;
      if(d>4.6)for(const sd of [-1,1])tira(mx-uz*2.15*sd,mz+ux*2.15*sd,d-4.2,.85,ux,uz,uz*sd,-ux*sd);
      if(k>1&&k%3===2&&d>=6&&mz<M.comprimento-20)tira(mx,mz,4.2,1.0,-uz,ux,-ux,-uz)});
    mec.matLava=lava;if(!NOVO){const ch=perto(M.pedras,2,1.6).concat(perto(M.arvores.filter((q,k)=>k%3===1),1,1.2)),cores=TT.chamas||['#ff5a1a','#ff9a2a','#ffd04a'];
    cores.forEach((cor,ci)=>{const L=ch.filter(q=>q[3]%cores.length===ci);if(!L.length)return;const mat=matPBR(TT,'magma',{color:cor,emissive:cor,emissiveIntensity:1.1,roughness:.5,transparent:true,opacity:.92,side:T.DoubleSide});
      inst(new T.ConeGeometry(.2,1,6),mat,L,(o,[x,z,s],c)=>{o.position.set(x,.5*s,z);o.scale.set(s,s*(1+rnd()*.9),s);o.rotation.set(0,rnd()*6,0);c.set('#ffffff')})});
    const vu=M.arvores.filter(([x],k)=>Math.abs(x)>M.largura/2-1&&k%11===0),vm=matPBR(TT,'pedra',{color:'#dad0c8',roughness:.94}),vt=matPBR(TT,'magma',{color:'#ffffff',emissive:'#ff5a1a',emissiveIntensity:1.15,side:T.DoubleSide});
    inst(new T.ConeGeometry(2.4,4,7,1,true),vm,vu,(o,[x,z,s],c)=>{o.position.set(x*1.08,1.9*s,z);o.scale.setScalar(s);o.rotation.set(0,0,0);c.set('#ffffff')});
    inst(new T.CircleGeometry(.75,10),vt,vu,(o,[x,z,s],c)=>{o.position.set(x*1.08,3.6*s,z);o.scale.setScalar(s);o.rotation.set(-Math.PI/2,0,0);c.set('#ffffff')})}
  }
  if(DEC==='luz'){
    // colunas antigas (algumas quebradas), cristais dourados e azuis, e orbes de luz flutuando
    if(!NOVO){const co=perto(M.arvores.filter((q,k)=>k%4===0),1,.6),cm=matPBR(TT,'marmore',{color:'#ffffff',roughness:.45});
    inst(new T.CylinderGeometry(.32,.36,1,10),cm,co,(o,[x,z,s],c)=>{const h=1.6+((x*13+z*7)%1+1)%1*2.2;o.position.set(x,h*s/2,z);o.scale.set(s,h*s,s);o.rotation.set(0,0,0);c.set('#ffffff')});
    inst(new T.BoxGeometry(.9,.25,.9),cm,co,(o,[x,z,s],c)=>{o.position.set(x,.12*s,z);o.scale.setScalar(s);o.rotation.set(0,0,0);c.set('#ffffff')});
    const cr=perto(M.pedras,2,1.4),cores=TT.cristais||['#ffd86a','#8ac8ff','#ffffff'];
    cores.forEach((cor,ci)=>{const L=cr.filter(q=>q[3]%cores.length===ci);if(!L.length)return;const mat=matPBR(TT,'cristal',{color:cor,emissive:cor,emissiveIntensity:.7,roughness:.2,flatShading:true});
      inst(new T.ConeGeometry(.16,1,5),mat,L,(o,[x,z,s],c)=>{o.position.set(x,.45*s,z);o.scale.set(s,s*(1.1+rnd()*.8),s);o.rotation.set((rnd()-.5)*.4,rnd()*6,(rnd()-.5)*.4);c.set('#ffffff')})});
    const ob=perto(M.arvores.filter((q,k)=>k%5===2),1,2),om=matPBR(TT,'cristal',{color:'#fff2b0',emissive:'#fff2b0',emissiveIntensity:1.1,roughness:.15});
    inst(new T.SphereGeometry(.22,10,8),om,ob,(o,[x,z,s],c)=>{o.position.set(x,1.6+s,z);o.scale.setScalar(s);o.rotation.set(0,0,0);c.set('#ffffff')})}
    // cristais-chave: o portal só abre depois de acender os dois (ficam fora da trilha)
    mec.chaves=[];for(const fr of [.38,.7]){const tr=trechos(M),q=tr[Math.floor(tr.length*fr)],sd=fr<.5?-1:1,x=(q[0]+q[2])/2-q[6]*1.9*sd,z=(q[1]+q[3])/2+q[5]*1.9*sd;
      const mat=matPBR(TT,'cristal',{color:'#8a8aa0',emissive:'#2a2a40',emissiveIntensity:.5,roughness:.3,flatShading:true}),g=new T.Mesh(new T.OctahedronGeometry(.6,0),mat);g.scale.set(1,1.8,1);g.position.set(x,1.3,z);S.add(g);
      const base=new T.Mesh(new T.CylinderGeometry(.6,.75,.4,8),matPBR(TT,'marmore',{color:'#ffffff',roughness:.55}));base.position.set(x,.2,z);S.add(base);mec.chaves.push({x,z,g,mat,ok:false})}
  }
  if(DEC==='aquatico'){
    // corais (galhos coloridos), algas altas e conchas no fundo; baú do tesouro perto do portal
    if(!NOVO){const cores=TT.corais||['#ff8a4a','#ff6aa8','#b06aff','#ffd04a'],co=perto(M.arvores.filter((q,k)=>k%2===1),2,1.6);
    cores.forEach((cor,c)=>{const L=co.filter(q=>q[3]%cores.length===c);if(!L.length)return;const mat=matPBR(TT,'coral',{color:cor,roughness:.84});
      for(const [ang,inc,h] of [[0,0,1],[2.1,.55,.7],[4.2,.55,.75],[1.0,.8,.5]])inst(new T.CylinderGeometry(.05,.09,1,6),mat,L,(o,[x,z,s],col)=>{const a=ang+(x*3+z)%6;o.position.set(x+Math.sin(a)*Math.sin(inc)*.5*h*s,.5*h*s*Math.cos(inc)+.05,z+Math.cos(a)*Math.sin(inc)*.5*h*s);o.scale.set(s,h*s,s);o.rotation.set(Math.cos(a)*inc,0,-Math.sin(a)*inc);col.set('#ffffff')})});
    const al=perto(M.arvores,2,2.4),am=matPBR(TT,'alga',{color:TT.alga||'#3fa56a',roughness:.72,side:T.DoubleSide});
    inst(new T.PlaneGeometry(.22,1,1,4),am,al,(o,[x,z,s],col)=>{o.position.set(x,.8*s,z);o.scale.set(s,1.6*s,s);o.rotation.set((rnd()-.5)*.25,rnd()*6,(rnd()-.5)*.25);col.set(['#3fa56a','#2f8f7a','#5abf5a'][Math.abs(Math.round(x+z))%3])})}
    // correntezas: faixas que empurram o bichinho para o lado (bolhas mostram a direção)
    mec.correntes=[];const nC=Math.max(2,Math.floor(M.comprimento/30));for(let k=0;k<nC;k++){const z0=14+(M.comprimento-30)*(k+.5)/nC,dir=k%2?1:-1,bol=[];
      for(let q=0;q<10;q++){const b=sprEmoji('🫧',.35);b.position.set((rnd()-.5)*M.largura,.6+rnd()*.8,z0+rnd()*3.2);S.add(b);bol.push(b)}
      const fx=new T.Mesh(new T.PlaneGeometry(M.largura,3.2),new T.MeshBasicMaterial({color:'#9fe6ff',transparent:true,opacity:NOVO?.12:.18,depthWrite:false}));fx.rotation.x=-Math.PI/2;fx.position.set(0,.04,z0+1.6);S.add(fx);
      mec.correntes.push({z0,z1:z0+3.2,dir,bol})}
    if(NOVO)return mec;const cx=M.portal[0]+3,cz=M.portal[1]-2,bau=new T.Group(),mad=matPBR(TT,'madeira',{color:'#f2ce9b',roughness:.86}),our=new T.MeshStandardMaterial({color:'#ffd04a',metalness:.55,roughness:.3,emissive:'#493500'});
    const cx1=new T.Mesh(new T.BoxGeometry(1.2,.7,.8),mad);cx1.position.y=.35;const tampa=new T.Mesh(new T.CylinderGeometry(.4,.4,1.2,10,1,false,0,Math.PI),mad);tampa.rotation.z=Math.PI/2;tampa.position.y=.7;
    const fita=new T.Mesh(new T.BoxGeometry(.12,.75,.84),our);fita.position.y=.38;bau.add(cx1,tampa,fita);bau.position.set(cx,0,cz);bau.rotation.y=-.5;S.add(bau);
  }
  return mec}
function cenario(S,M,C3){const T=G.THREE(),rnd=semente(M.comprimento*13+1),CF=cfgDe(M.tema),blocos=[];
  // instâncias em blocos ao longo do caminho: só os blocos perto da câmera são desenhados
  const emBlocos=(base,lista,f)=>{const B=CF.bloco||6,gr={};lista.forEach(q=>{const v=base.length>1?Math.abs(Math.round(q[0]*7+q[1]*3))%base.length:0,c=Math.floor(q[1]/B),cx=Math.floor(q[0]/B),k=v+'_'+c+'_'+cx;(gr[k]=gr[k]||{v,c,cx,qs:[]}).qs.push(q)});
    for(const g of Object.values(gr)){const im=new T.InstancedMesh(base[g.v].geo,base[g.v].mat,g.qs.length),o=new T.Object3D();g.qs.forEach((q,k)=>{f(o,q);o.updateMatrix();im.setMatrixAt(k,o.matrix)});
      im.instanceMatrix.needsUpdate=true;im.frustumCulled=false;S.add(im);const r=2.2;blocos.push({m:im,z0:g.c*B-r,z1:(g.c+1)*B+r,x0:g.cx*B-r,x1:(g.cx+1)*B+r})}};
  const tx=M.tema&&M.tema.texturas&&M.tema.texturas.chao,E2=M.tema&&M.tema.cenario2&&window.GARRO_MUNDOS3D?M.tema.cenario2:null;
  if(tx&&E2){// cenário novo: chão PBR inteiro (sem estrada desenhada; o caminho é o espaço entre as paredes)
    const W=M.largura+24,L=M.comprimento+24,tl=E2.chao_tile||7,mat=matPBR(M.tema,'chao',{color:E2.chao_cor||'#ffffff',roughness:E2.chao_rug??.85,metalness:0,emissive:E2.chao_brilho?'#ffffff':'#000000',emissiveIntensity:E2.chao_brilho||0});
    for(const t of [mat.map,mat.normalMap,mat.roughnessMap,mat.emissiveMap])if(t){t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(W/tl,L/tl)}
    const base=new T.Mesh(new T.PlaneGeometry(W,L),mat);base.rotation.x=-Math.PI/2;base.position.set(0,0,M.comprimento/2);S.add(base);
    if(M.arena){const a=M.arena,an=new T.Mesh(new T.RingGeometry(a.r-.25,a.r,64),new T.MeshBasicMaterial({color:E2.arena||'#c9b4ff',transparent:true,opacity:.6,depthWrite:false}));an.rotation.x=-Math.PI/2;an.position.set(a.x,.03,a.z);S.add(an)}}
  else if(tx){const W=M.largura+24,L=M.comprimento+24,repX=W/7,repY=L/7,mat=matPBR(M.tema,'chao',{color:'#ffffff',roughness:.88});
    for(const t of [mat.map,mat.normalMap,mat.roughnessMap])if(t){t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(repX,repY)}
    const base=new T.Mesh(new T.PlaneGeometry(W,L),mat);base.rotation.x=-Math.PI/2;base.position.set(0,0,M.comprimento/2);S.add(base);
    // Canvas só pinta a trilha/arena, mantendo o chão PBR visível e a rota intacta.
    const trilha=new T.Mesh(new T.PlaneGeometry(W,L),new T.MeshBasicMaterial({map:texChao(M),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}));
    trilha.rotation.x=-Math.PI/2;trilha.position.set(0,.012,M.comprimento/2);S.add(trilha)}
  else{const chao=new T.Mesh(new T.PlaneGeometry(M.largura+24,M.comprimento+24),new T.MeshLambertMaterial({map:texChao(M)}));chao.rotation.x=-Math.PI/2;chao.position.set(0,0,M.comprimento/2);S.add(chao)}
  const inst=(geo,mat,lista,f)=>{const im=new T.InstancedMesh(geo,mat,lista.length),o=new T.Object3D(),c=new T.Color();lista.forEach((q,k)=>{f(o,q,c);o.updateMatrix();im.setMatrixAt(k,o.matrix);im.setColorAt(k,c)});im.instanceMatrix.needsUpdate=true;if(im.instanceColor)im.instanceColor.needsUpdate=true;S.add(im);return im};
  const lam=()=>new T.MeshLambertMaterial({color:0xffffff});
  const TT=M.tema||{},tinge=(base,hex)=>hex?base.map(b=>{const m=b.mat.clone();m.color=new T.Color(hex);return{geo:b.geo,mat:m}}):base;// cor do mundo multiplica a textura do modelo
  if(E2){}else if(C3){emBlocos(tinge(C3.arv,TT.arvore),M.arvores,(o,[x,z,s])=>{const k=(CF.arvore_tamanho||3.4)*s;o.position.set(x,-.22*k,z);o.scale.setScalar(k);o.rotation.set(0,(x*13.7+z*7.3)%6.283,0)})}
  else{inst(new T.CylinderGeometry(.13,.2,1,6),lam(),M.arvores,(o,[x,z,s],c)=>{o.position.set(x,.75*s,z);o.scale.set(s,1.5*s,s);o.rotation.set(0,0,0);c.set('#6b4a32')});
  const cores=['#2e6b4a','#3a7d4e','#2a5e52','#4a8a4a','#365f3a'];
  inst(new T.IcosahedronGeometry(1,0),lam(),M.arvores,(o,[x,z,s],c)=>{o.position.set(x,1.9*s,z);o.scale.set(.95*s,1.05*s,.95*s);o.rotation.set(0,(x*7+z)%6,0);c.set(cores[Math.abs(Math.round(x*3+z))%5])});
  inst(new T.IcosahedronGeometry(1,0),lam(),M.arvores,(o,[x,z,s],c)=>{o.position.set(x,2.7*s,z);o.scale.set(.6*s,.7*s,.6*s);o.rotation.set(0,(x+z*5)%6,0);c.set(cores[Math.abs(Math.round(x+z*3))%5]).offsetHSL(0,0,.05)})}
  if(!E2&&C3&&C3.ped&&C3.ped.length)emBlocos(C3.ped,M.pedras,(o,[x,z,s])=>{const k=(CF.pedra_tamanho||1.6)*s;o.position.set(x,-.04*k,z);o.scale.setScalar(k);o.rotation.set(0,(x*4.3+z*6.1)%6.283,0)});
  else if(!E2)inst(new T.DodecahedronGeometry(.5,0),lam(),M.pedras,(o,[x,z,s],c)=>{o.position.set(x,.2*s,z);o.scale.set(s,.65*s,s*1.1);o.rotation.set(0,(x*3+z)%6,0);c.set(TT.pedra||'#8a8a7e')});
  if(E2){}else if(C3)emBlocos(tinge([C3.cog],TT.cogumelo),M.cogumelos,(o,[x,z,s])=>{const k=(CF.cogumelo_tamanho||1.5)*s;o.position.set(x,-.12*k,z);o.scale.setScalar(k);o.rotation.set(0,(x*5.1+z*9.7)%6.283,0)});
  else{inst(new T.CylinderGeometry(.09,.12,1,6),lam(),M.cogumelos,(o,[x,z,s],c)=>{o.position.set(x,.3*s,z);o.scale.set(s,.6*s,s);o.rotation.set(0,0,0);c.set('#efe6d8')});
  inst(new T.SphereGeometry(.42,10,6,0,Math.PI*2,0,Math.PI/2),lam(),M.cogumelos,(o,[x,z,s],c)=>{o.position.set(x,.58*s,z);o.scale.set(s,.8*s,s);o.rotation.set(0,0,0);c.set(['#e86a8a','#b46ae8','#f2a04a'][Math.abs(Math.round(x+z))%3])})}
  const mec=decorMundo(S,M,C3,inst,rnd);
  // marcos: cenários grandes fora do caminho; x em meias-larguras do mapa (|x|>1 = fora das paredes), z em fração do comprimento (>1 = depois do portal)
  // ou "ao_lado": fração do caminho; fica a "afasta" do caminho (do lado livre), de frente para ele, e "solido" vira obstáculo
  const marcoObs=[];
  if(C3&&C3.marcos)for(const mk of C3.marcos){const o=mk.obj.clone();o.scale.setScalar(mk.tamanho||10);let x=(mk.x||0)*M.largura/2,z=(mk.z??.5)*M.comprimento,giro=mk.giro||0;
    if(mk.ao_lado!==undefined){const L=lugarAoLado(M,mk.ao_lado,mk.afasta||5);if(!L)continue;[x,z,giro]=L}
    if(mk.de_frente)giro=Math.PI+(mk.giro||0);// aberto para a câmera (que olha para +z)
    o.position.set(x,mk.y||0,z);o.rotation.set(0,giro,0);S.add(o);if(mk.solido)marcoObs.push([x,z,mk.solido])}
  if(E2){try{const m3=window.GARRO_MUNDOS3D.monta({T,S,M,blocos,texPBR,matLava:mec.matLava,cam:[AR.cam_altura||11.5,AR.cam_tras||8.5]});if(m3){mec.anim=m3.anim;mec.obs3d=m3.obs}}catch(e){console.warn('mundos3d',e)}}
  // sombras das árvores
  if(!E2)for(const [x,z,s] of M.arvores){if(z<-1||z>M.comprimento+1)continue;const sh=sombra(1.1*s);sh.position.set(x+.25,.015,z+.25);S.add(sh)}
  // morangos (moitas) e folhas douradas
  const itens=[];
  for(const [x,z] of M.morangos){const g=new T.Group(),b=new T.Mesh(new T.IcosahedronGeometry(.45,1),new T.MeshLambertMaterial({color:'#3f8a4a'}));b.position.y=.35;b.scale.y=.75;g.add(b);
    const f=sprEmoji('🍓',.6);f.position.y=.85;g.add(f);g.position.set(x,0,z);S.add(g);itens.push({t:'S',x,z,g,f})}
  for(const [x,z] of M.folhas){const g=new T.Group(),f=sprEmoji('🍃',.9,'rgba(255,220,90,.9)');f.position.y=1;g.add(f);g.position.set(x,0,z);S.add(g);itens.push({t:'L',x,z,g,f})}
  // portal: o diorama (arco, árvores, cogumelos, cristais) virado para quem chega; fechado (véu escuro) enquanto o chefão vive
  const obsP=[];
  if(C3){const K=CF.portal_tamanho||7.6,pg=new T.Group(),dio=C3.portal,PC=CF.portal_centro;dio.scale.setScalar(K);dio.position.set(PC?-PC[0]*K:0,-.18,PC?-PC[2]*K:0);pg.add(dio);// portal_centro: o arco do diorama fica no ponto do portal
    const veu=new T.Mesh(new T.CircleGeometry(1,40),new T.MeshBasicMaterial({color:'#140822',transparent:true,opacity:.9,side:T.DoubleSide,depthWrite:false}));const VE=PC?[0,PC[1],.012,CF.veu[0],CF.veu[1]]:(CF.veu||[0,.246,.012,.084,.106]);veu.scale.set(VE[3]*K,VE[4]*K,1);veu.position.set(VE[0]*K,VE[1]*K-.18,VE[2]*K);
    const luz=new T.Mesh(new T.CircleGeometry(1,40),new T.MeshBasicMaterial({color:'#ffc8f0',transparent:true,opacity:0,blending:T.AdditiveBlending,side:T.DoubleSide,depthWrite:false}));luz.scale.set((VE[3]+.002)*K,(VE[4]+.002)*K,1);luz.position.set(VE[0]*K,VE[1]*K-.18,(VE[2]+.002)*K);
    luz.visible=false;pg.add(veu,luz);pg.rotation.y=Math.PI;pg.position.set(M.portal[0],0,M.portal[1]);S.add(pg);
    // árvores e colunas do diorama também barram o caminho (só se passa pelo arco)
    for(const [dx,dz,r] of (CF.portal_obs||[[.3,.1,.16],[-.3,.1,.16],[.125,-.01,.045],[-.125,-.01,.045],[.42,-.05,.1],[-.42,-.05,.1]]))obsP.push([M.portal[0]+dx*K,M.portal[1]+dz*K,r*K]);
    var PORTAL={g:pg,veu,luz,VE}}
  else{const pg=new T.Group(),anel=new T.Mesh(new T.TorusGeometry(1.25,.13,10,40),new T.MeshBasicMaterial({color:'#ff9ac8'})),
    disco=new T.Mesh(new T.CircleGeometry(1.15,32),new T.MeshBasicMaterial({color:'#ffd0ea',transparent:true,opacity:.55,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide}));
  anel.position.y=1.45;disco.position.y=1.45;pg.add(anel,disco);const base=new T.Mesh(new T.CylinderGeometry(1.4,1.5,.15,24),new T.MeshLambertMaterial({color:'#6b5a7a'}));base.position.y=.07;pg.add(base);
  pg.position.set(M.portal[0],0,M.portal[1]);S.add(pg);var PORTAL={g:pg,anel,disco}}
  // vagalumes (no mar: peixinhos e bolhas; na caverna: esporos brilhando)
  const VG=TT.voadores||['✨'],vg=[];for(let k=0;k<(E2?(E2.voadores??0):40);k++){const s=sprEmoji(VG[k%VG.length],TT.voadores?.45:.25);s.position.set((rnd()-.5)*M.largura,1+rnd()*2.5,rnd()*M.comprimento);S.add(s);vg.push({s,y:s.position.y,f:rnd()*6})}
  // obstáculos para colisão
  const obs=obsP.slice().concat(mec.obs3d||[],marcoObs);const rP=E2?(E2.parede_raio??.85):C3?.45:.38;for(const [x,z,s] of M.arvores)obs.push([x,z,rP*s]);for(const [x,z,s] of M.pedras)obs.push([x,z,.5*s]);for(const [x,z,s] of M.cogumelos)obs.push([x,z,(C3?.55:.3)*s]);
  // área secreta: baú escondido no canto do mapa (cura tudo) e o bichinho raro que o guarda (acampamento secreto do mapa)
  if(M.secreto){const [sx,sz]=M.secreto,b=new T.Group(),mad=new T.MeshLambertMaterial({color:'#7a4a22'}),our=new T.MeshStandardMaterial({color:'#ffd04a',emissive:'#a07000',emissiveIntensity:.6});
    const c1=new T.Mesh(new T.BoxGeometry(.9,.55,.6),mad);c1.position.y=.28;const t1=new T.Mesh(new T.BoxGeometry(.95,.18,.65),our);t1.position.y=.62;b.add(c1,t1);b.position.set(sx,0,sz);S.add(b);
    const br=sprEmoji('✨',.7);br.position.set(sx,1.4,sz);S.add(br);itens.push({t:'B',x:sx,z:sz,g:b,f:br})}
  return{itens,portal:PORTAL,vg,obs,blocos,mec}}

// ---- montar a fase ----
async function iniciar3D(){const R=RUN,f=R.f,M=R.M||f.mapa3d,T=G.THREE();if(!T||!M)throw new Error('sem 3d');
  const cv=$('advCv'),rd=new T.WebGLRenderer({canvas:cv,antialias:true,powerPreference:'high-performance'});rd.setPixelRatio(Math.min(window.devicePixelRatio||1,2));rd.outputEncoding=T.sRGBEncoding;
  const S=new T.Scene();const TMA=(R.M&&R.M.tema)||{},LZ=TMA.luz||{};S.background=new T.Color(LZ.ceu||TMA.ceu||'#2c3a52');S.fog=new T.Fog(LZ.cor||TMA.neblina||TMA.ceu||'#2c3a52',(LZ.neblina||[])[0]??(TMA.escuro?9:26),(LZ.neblina||[])[1]??(TMA.escuro?26:52));
  S.add(LZ.hemi?new T.HemisphereLight(LZ.hemi[0],LZ.hemi[1],LZ.hemi[2]):new T.HemisphereLight(0xfff2e0,0x2f4a32,TMA.escuro?.35:1.05));const sol=LZ.sol?new T.DirectionalLight(LZ.sol[0],LZ.sol[1]):new T.DirectionalLight(0xffe2c4,TMA.escuro?.25:.95);sol.position.set(6,12,-5);S.add(sol);
  const cam=new T.PerspectiveCamera(42,1,.1,120);R.r3={rd,S,cam,T};const C3=await props3d(R.M&&R.M.tema);if(RUN!==R)return;R.w={M,...cenario(S,M,C3),ents:[],tiros:[],efeitos:[],nums:[]};
  // modelos: o bichinho e um de cada tipo de inimigo (cada inimigo é uma cópia)
  const heroEvo=G.isEvo(R.i,R.hero.lv,R.hero.rb);
  const hg=await G.modelo(R.i,heroEvo);if(RUN!==R)return;const Hs=redondo(R.i)?(AR.tam_redondo||.95):(AR.tam_heroi||1.3)*(R.i>=LEG0?1.12:1);hg.scale.setScalar(Hs);
  const hU=prepAndar(hg,redondo(R.i),cobra(R.i));const hroot=new T.Group();hroot.add(hg);hroot.add(sombra(.6*Hs));S.add(hroot);
  R.p={g:hroot,m:hg,U:hU,x:M.inicio[0],z:M.inicio[1],ang:0,r:.42*Hs,inv:0,cd:{A:0,P:0,E:0,D:0},dash:0,dx:0,dz:0,venceu:0,morto:0,lunge:0,raiz:0};
  for(const c of M.acampamentos)for(const [j,lv,x,z,tp] of c.inimigos)R.w.ents.push(await novoInimigo(j,lv,x,z,c,false,tp));R.total=R.w.ents.length+(f.chefe&&M.arena?1:0);
  R.minMobs=((M.acampamentos[0]&&M.acampamentos[0].inimigos.length)||0)+5;// portal só abre depois de matar pelo menos os bichinhos do acampamento inicial (+5)
  if(f.chefe&&M.arena){const b=await novoInimigo(f.chefe[0],f.chefe[1],M.arena.x,M.arena.z+2,{x:M.arena.x,z:M.arena.z},true);R.w.ents.push(b);R.w.boss=b}
  if(RUN!==R)return;
  R.t=0;R.cam=null;tamanho3D();hud();const ld=$('advLoad');if(ld)ld.hidden=true;
  aviso(f.chefe?'Atravesse a floresta e derrote o chefão!':'Derrote ao menos '+R.minMobs+' inimigos para abrir o portal ✨ · 3 folhas douradas escondidas',3200);
  som('musica',f.desafio?'chefe':(f.mundo&&f.mundo.id)||'floresta');
  R.last=performance.now();R.acc=0;R.raf=requestAnimationFrame(passo)}
async function novoInimigo(j,lv,x,z,camp,chefe,tipo){const R=RUN,T=G.THREE(),L_=lutador(j,lv,{chefe}),Tp=(tipo&&TP[tipo])||{};const k=(chefe?(AR.chefe_vida||1.6):(AR.inimigo_vida||.45))*(Tp.vida||1);L_.hp=L_.max=Math.max(10,Math.round(L_.hp*k));
  if(Tp.dano)L_.atk*=Tp.dano;const esc=Tp.escudo?Math.round(L_.max*Tp.escudo):0;
  const g=await G.modelo(j,chefe),s=(chefe?(AR.tam_chefe||3):redondo(j)?(AR.tam_redondo_inimigo||.8):(AR.tam_inimigo||1.1))*(Tp.tamanho||1);g.scale.setScalar(s);
  const U=prepAndar(g,redondo(j),cobra(j)),root=new T.Group();root.add(g);root.add(sombra(.55*s));root.position.set(x,0,z);R.r3.S.add(root);
  const bar=document.createElement('div');bar.className='advebar'+(chefe?' chefe':'')+(tipo?' '+tipo:'');bar.innerHTML='<small class="'+corNv(lv,R.hero.lv)+'">'+(Tp.icone?Tp.icone+' ':'')+'Nv '+lv+'</small>'+(esc?'<i class="esc"><b></b></i>':'')+'<i><b></b></i>';bar.hidden=true;$('advFx').appendChild(bar);
  if(tipo==='elite'){const a=new T.Mesh(new T.RingGeometry(.55*s,.68*s,32),new T.MeshBasicMaterial({color:'#7ad0ff',transparent:true,opacity:.7,depthWrite:false,side:T.DoubleSide}));a.rotation.x=-Math.PI/2;a.position.y=.04;root.add(a)}
  if(tipo==='curandeiro'){const a=sprEmoji('💚',.45);a.position.y=1.55*s;root.add(a)}
  return Object.assign(L_,{j,lv,g:root,m:g,U,x,z,cx:camp.x,cz:camp.z,ang:Math.PI,r:(chefe?.95:.4)*s/1.1,s,chefe:!!chefe,vivo:true,estado:'parado',t:0,cdA:1+Math.random(),cdT:2+Math.random()*2,
    aviso:0,lento:0,preso:0,veneno:0,morre:0,bar,nome:chefe?G.evName(j):G.name(j),tipo:tipo||'',Tp,esc,escMax:esc,longe:tipo==='atirador'||tipo==='curandeiro',cdC:2+Math.random()*2,
    pancada:chefe?{r:2.6,av:.9,m:1.5,rec:2}:tipo==='elite'?{r:Tp.pancada_raio||1.9,av:Tp.pancada_aviso||.75,m:1.2,rec:Tp.recarga||2.2}:null,ph:Math.random()*6})}
function tamanho3D(){const R=RUN;if(!R||!R.r3)return;const cv=$('advCv'),r=cv.getBoundingClientRect();R.r3.rd.setSize(r.width,r.height,false);R.r3.cam.aspect=r.width/Math.max(1,r.height);R.r3.cam.updateProjectionMatrix()}
window.addEventListener('resize',()=>{if(RUN&&TELA==='luta'&&RUN.r3)tamanho3D()});
// sons (js/sons.js): efeitos e música de cada mundo; sem o módulo, ficam os bipes antigos
function som(n,...a){const S=window.GARRO_SOM;if(S&&S[n]){S[n](...a);return true}return false}
function limpa3D(){som('parar');const R=RUN;if(!R||!R.r3)return;cancelAnimationFrame(R.raf);try{R.r3.rd.dispose();R.r3.rd.forceContextLoss()}catch(e){}R.r3=null}

// ---- controles: joystick (esquerda) e botões (direita); teclado no computador ----
function controles(){TEC={};JOY={x:0,y:0};const jz=$('advJoy'),kn=$('advJoyK');let id=null,cx=0,cy=0;
  const mv=e=>{const dx=e.clientX-cx,dy=e.clientY-cy,d=Math.hypot(dx,dy),mx=42,k=d>mx?mx/d:1;JOY.x=dx*k/mx;JOY.y=dy*k/mx;kn.style.transform='translate('+(dx*k)+'px,'+(dy*k)+'px)'};
  jz.addEventListener('pointerdown',e=>{e.preventDefault();id=e.pointerId;const r=jz.getBoundingClientRect();cx=r.left+r.width/2;cy=r.top+r.height/2;try{jz.setPointerCapture(id)}catch(_){}mv(e)});
  jz.addEventListener('pointermove',e=>{if(e.pointerId===id)mv(e)});
  const fim=e=>{if(e.pointerId!==id)return;id=null;JOY.x=JOY.y=0;kn.style.transform=''};jz.addEventListener('pointerup',fim);jz.addEventListener('pointercancel',fim);
  document.querySelectorAll('.advskills button[data-k]').forEach(b=>{const k=b.dataset.k;
    b.addEventListener('pointerdown',e=>{e.preventDefault();TEC[k]=true;TEC[k+'p']=true;b.classList.add('on')});
    const off=()=>{TEC[k]=false;b.classList.remove('on')};b.addEventListener('pointerup',off);b.addEventListener('pointercancel',off);b.addEventListener('pointerleave',off);b.addEventListener('contextmenu',e=>e.preventDefault())})}
const KMAP={ArrowLeft:'l',a:'l',A:'l',ArrowRight:'r',d:'r',D:'r',ArrowUp:'u',w:'u',W:'u',ArrowDown:'b',s:'b',S:'b',' ':'A',j:'A',J:'A',k:'P',K:'P',x:'P',X:'P',l:'E',L:'E',c:'E',C:'E',Shift:'D'};
window.addEventListener('keydown',e=>{if(TELA!=='luta'||pan.hidden)return;if(e.key==='Escape'||e.key==='p'||e.key==='P'){if(RUN&&RUN.r3&&!RUN.fim)pausar(!RUN.pausaU);return}if(RUN&&RUN.pausaU)return;const k=KMAP[e.key];if(!k)return;e.preventDefault();if(!TEC[k])TEC[k+'p']=true;TEC[k]=true});
window.addEventListener('keyup',e=>{const k=KMAP[e.key];if(k)TEC[k]=false});

// ---- laço ----
function passo(now){const R=RUN;if(!R||!R.r3||TELA!=='luta')return;R.raf=requestAnimationFrame(passo);
  if(document.hidden||R.pausa){R.last=now;return}
  R.acc+=Math.min(.1,(now-R.last)/1000);R.last=now;let n=0;
  while(R.acc>=1/60&&n<6){R.acc-=1/60;n++;fisica(1/60);if(R.fim)break}
  desenha()}
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
function mover(o,dx,dz){const R=RUN,M=R.w.M;o.x+=dx;o.z+=dz;
  for(const [x,z,r] of R.w.obs){const d=Math.hypot(o.x-x,o.z-z),m=r+o.r;if(d<m&&d>1e-4){o.x=x+(o.x-x)/d*m;o.z=z+(o.z-z)/d*m}}
  o.x=Math.max(-M.largura/2+.8,Math.min(M.largura/2-.8,o.x));o.z=Math.max(-1,Math.min(M.comprimento+1,o.z))}
function maisPerto(o,raio,filtro){let b=null,bd=raio;for(const e of RUN.w.ents){if(!e.vivo||(filtro&&!filtro(e)))continue;const d=dist(o,e)-e.r;if(d<bd){bd=d;b=e}}return b}
// mecânicas de cada mundo: lava queima (Fogo), correnteza empurra (Mar), lanterna no escuro (Trevas), cristais-chave (Luz), morcegos (Caverna)
function mecanicas(dt){const R=RUN,p=R.p,mc=R.w.mec;if(!mc||!p||p.morto)return;
  // Deslocamento visual da textura do magma: NÃO altera segmentos de colisão/dano.
  if(mc.anim)mc.anim(dt,R.t);
  if(mc.magmaMaps)for(const tex of mc.magmaMaps)tex.offset.y=(tex.offset.y-dt*.017+1)%1;
  if(mc.lava&&p.dash<=0){for(const [x0,z0,x1,z1,lado,lz] of mc.lava){const vx=x1-x0,vz=z1-z0,t=Math.max(0,Math.min(1,((p.x-x0)*vx+(p.z-z0)*vz)/(vx*vx+vz*vz))),d=Math.hypot(p.x-(x0+t*vx),p.z-(z0+t*vz));
    if(d<.6){if(!R.avisoLava){R.avisoLava=1;aviso('🔥 A lava queima! Fique na trilha (ou use Esquivar para pular)',2400)}if(p.inv<=0)som('lava');machuca(Math.max(1,Math.round(R.hero.max*.06)),lado,lz||0);faisca(p.x,.4,p.z,'#ff7a2a',6);break}}}
  if(mc.correntes)for(const c of mc.correntes){for(const b of c.bol){b.position.x+=c.dir*3*dt;if(Math.abs(b.position.x)>R.w.M.largura/2)b.position.x=-c.dir*R.w.M.largura/2}
    if(p.z>c.z0&&p.z<c.z1&&p.dash<=0){mover(p,c.dir*2.2*dt,0);if(c.somT===undefined||R.t-c.somT>3){c.somT=R.t;som('corrente')}if(!R.avisoCorr){R.avisoCorr=1;aviso('🌊 Correnteza! Ela empurra para o lado',1800)}}}
  if(mc.lanterna)mc.lanterna.position.set(p.x,2.2,p.z);
  if(mc.chaves)for(const c of mc.chaves){c.g.rotation.y+=dt*(c.ok?2:.4);if(!c.ok&&Math.hypot(p.x-c.x,p.z-c.z)<1.5){c.ok=true;c.mat.color.set('#ffe9a0');c.mat.emissive.set('#ffc83a');c.mat.emissiveIntensity=1.2;
    const n=mc.chaves.filter(q=>q.ok).length;faisca(c.x,1.3,c.z,'#ffe9a0',18);som('cristal')||G.tone(880,.15,'triangle',.08);aviso(n<mc.chaves.length?'💎 Cristal-chave aceso ('+n+'/'+mc.chaves.length+')':'💎 Todos os cristais acesos!',1800)}}
  if(mc.morcegos)for(const m of mc.morcegos){m.f+=dt*m.v;m.s.position.set(m.cx+Math.cos(m.f)*m.r,m.h+Math.sin(m.f*3)*.3,m.cz+Math.sin(m.f)*m.r)}}
function fisica(dt){const R=RUN,p=R.p,w=R.w;R.t+=dt;if(!p)return;
  if(p.venceu){p.venceu+=dt;p.g.rotation.y+=dt*10;p.m.scale.multiplyScalar(1-dt*1.2);if(p.venceu>1.3)vitoria();return}
  if(p.morto){p.morto+=dt;return}
  for(const k in p.cd)p.cd[k]=Math.max(0,p.cd[k]-dt);p.inv=Math.max(0,p.inv-dt);
  // andar (joystick: tela para cima = +z; a câmera olha para +z, então direita da tela = -x)
  let jx=JOY.x,jy=JOY.y;if(TEC.l)jx=-1;if(TEC.r)jx=1;if(TEC.u)jy=-1;if(TEC.b)jy=1;
  const jm=Math.min(1,Math.hypot(jx,jy));let vx=0,vz=0;
  if(p.dash>0){p.dash-=dt;vx=p.dx*(AR.esquiva_vel||16);vz=p.dz*(AR.esquiva_vel||16)}
  else if(jm>.12&&p.raiz<=0){const sp=(AR.velocidade||4.6)*jm;vx=-jx/jm*sp;vz=-jy/jm*sp}
  p.raiz=Math.max(0,p.raiz-dt);
  if(vx||vz){mover(p,vx*dt,vz*dt);if(p.dash<=0)p.ang=Math.atan2(vx,vz);p.U.uPh.value+=Math.hypot(vx,vz)*dt*2.4;p.U.uAmp.value=Math.min(.45,p.U.uAmp.value+dt*3)}
  else{p.U.uAmp.value=Math.max(0,p.U.uAmp.value-dt*3);if(p.U.uK)p.U.uPh.value+=dt*.7}
  // habilidades
  if(TEC.Ap||(TEC.A&&p.cd.A<=0)){TEC.Ap=false;if(p.cd.A<=0)ataque()}
  if(TEC.Pp){TEC.Pp=false;if(p.cd.P<=0)poder()}
  if(TEC.Ep){TEC.Ep=false;if(!R.espOk)aviso('O especial libera no Nv '+(AR.especial_nivel||10)+' 🔒',1500);else if(p.cd.E<=0)especial()}
  if(TEC.Dp){TEC.Dp=false;if(p.cd.D<=0){p.cd.D=AR.esquiva_recarga||1.2;p.inv=Math.max(p.inv,AR.invencivel||.35);p.dash=.2;
    const a=jm>.12?Math.atan2(-jx,-jy):p.ang;p.dx=Math.sin(a);p.dz=Math.cos(a);som('esquiva')||G.tone(700,.06,'triangle',.05)}}
  p.lunge=Math.max(0,p.lunge-dt);
  // itens
  for(const it of w.itens){if(it.ok)continue;it.f.position.y=(it.t==='L'?1:.85)+Math.sin(R.t*3+it.x)*.12;if(Math.hypot(it.x-p.x,it.z-p.z)<1){it.ok=true;it.g.visible=false;
    if(it.t==='L'){R.leaves++;folhas();if(!som('folha')){G.tone(988,.12,'triangle',.08);setTimeout(()=>G.tone(1318,.14,'triangle',.08),90)}aviso('Folha dourada! '+R.leaves+' de 3',1400);faisca(it.x,1,it.z,'#ffd23c',14)}
    else if(it.t==='B'){R.hero.hp=R.hero.max;num(it.x,1.4,it.z,'Área secreta! ❤','#ffd23c');faisca(it.x,1,it.z,'#ffd23c',20);som('bau')||G.fanfare();aviso('🗝️ Área secreta encontrada! Vida cheia',2200);hud()}
    else{const c=Math.min(R.hero.max-R.hero.hp,Math.round(R.hero.max*(AR.morango_cura||.3)));R.hero.hp+=c;num(it.x,1.2,it.z,c>0?'+'+c+' ❤':'🍓','#9dff8a');som('morango')||G.tone(660,.1,'sine',.08);hud()}}}
  // portal
  mecanicas(dt);
  const faltaCh=!!(w.mec&&w.mec.chaves&&w.mec.chaves.some(c=>!c.ok)),pt=w.portal,poucosMobs=(R.kills||0)<(R.minMobs||0),fech=(w.boss&&w.boss.vivo)||poucosMobs||faltaCh,M=w.M;if(R.fechAnt===true&&!fech)som('portal');R.fechAnt=fech;
  if(pt.veu){pt.veu.visible=fech;pt.luz.visible=!fech;pt.luz.material.opacity=.07+Math.sin(R.t*4)*.05;pt.luz.scale.x=(cfgDe(w.M.tema).portal_tamanho||7.6)*(pt.VE[3]+.002+Math.sin(R.t*3)*.004)}
  else{pt.anel.material.color.set(fech?'#7a6a9a':'#ff9ac8');pt.disco.material.opacity=fech?.15:.45+Math.sin(R.t*4)*.15;pt.anel.rotation.z+=dt*(fech?.3:1.5)}

  if(!fech&&Math.hypot(p.x-M.portal[0],p.z-M.portal[1])<1.4){p.venceu=.001;G.fanfare();return}
  if(fech&&Math.hypot(p.x-M.portal[0],p.z-M.portal[1])<2.2&&!R.avisoPortal){R.avisoPortal=1;aviso(faltaCh?'Acenda os 2 cristais-chave para abrir o portal ('+w.mec.chaves.filter(c=>c.ok).length+'/2) 💎':poucosMobs?'Derrote mais inimigos para abrir o portal ('+(R.kills||0)+'/'+R.minMobs+')':'O portal só abre depois de derrotar o chefão!',2200);setTimeout(()=>{if(RUN===R)R.avisoPortal=0},3000)}
  // inimigos
  for(const e of w.ents)iaInimigo(e,dt);
  // tiros
  for(const t of w.tiros){if(t.fim)continue;t.x+=t.vx*dt;t.z+=t.vz*dt;t.d+=Math.hypot(t.vx,t.vz)*dt;t.s.position.set(t.x,t.y,t.z);
    if(t.d>t.alc||R.w.obs.some(([x,z,r])=>Math.hypot(t.x-x,t.z-z)<r)){t.fim=1;faisca(t.x,t.y,t.z,t.c,6);continue}
    if(t.meu){const e=maisPerto(t,.55);if(e){t.fim=1;golpeia(e,t.mult,'poder');faisca(t.x,t.y,t.z,t.c,10)}}
    else if(p.inv<=0&&Math.hypot(t.x-p.x,t.z-p.z)<p.r+.4){t.fim=1;machuca(dano(t.dono,R.hero,t.mult).d,t.vx,t.vz)}}
  for(const t of w.tiros)if(t.fim&&t.s.parent)t.s.parent.remove(t.s);w.tiros=w.tiros.filter(t=>!t.fim);
  // efeitos (anéis, cones...)
  for(const ef of w.efeitos){ef.t+=dt;const k=ef.t/ef.dur;if(ef.atual)ef.atual(k);if(k>=1){ef.fim=1;if(ef.o.parent)ef.o.parent.remove(ef.o)}}w.efeitos=w.efeitos.filter(f=>!f.fim);
  for(const v of w.vg)v.s.position.y=v.y+Math.sin(R.t*1.5+v.f)*.3;
  const ax=p.x,az=p.z+(AR.cam_frente||2.2),kc=Math.min(1,dt*7);if(!R.cam)R.cam={x:ax,z:az};R.cam.x+=(ax-R.cam.x)*kc;R.cam.z+=(az-R.cam.z)*kc}

// ---- golpes do bichinho ----
function mira(raio){const p=RUN.p,e=maisPerto(p,raio);if(e){p.ang=Math.atan2(e.x-p.x,e.z-p.z)}return e}
function ataque(){const R=RUN,p=R.p;p.cd.A=AR.ataque_recarga||.45;mira(3.2);p.lunge=.18;som('ataque')||G.tone(330,.06,'square',.05);
  const fx=Math.sin(p.ang),fz=Math.cos(p.ang),al=(AR.ataque_alcance||1.6);let acertou=0;
  for(const e of R.w.ents){if(!e.vivo)continue;const dx=e.x-p.x,dz=e.z-p.z,d=Math.hypot(dx,dz);if(d-e.r>al)continue;if(d>.2&&(dx*fx+dz*fz)/d<.15)continue;golpeia(e,1,'ataque');acertou=1}
  arco(p.x+fx*.9,p.z+fz*.9,p.ang,acertou?'#ffffff':'#d8e8ff')}
function poder(){const R=RUN,p=R.p;p.cd.P=AR.poder_recarga||2.2;const e=mira(AR.poder_alcance||9),F=BFX[R.hero.el]||{e:['✨'],c:'#fff'};
  const a=p.ang,s=sprEmoji(F.e[0],.85,F.c);s.position.set(p.x,1,p.z);R.r3.S.add(s);const v=AR.poder_vel||11;
  R.w.tiros.push({s,x:p.x+Math.sin(a)*.6,y:1,z:p.z+Math.cos(a)*.6,vx:Math.sin(a)*v,vz:Math.cos(a)*v,d:0,alc:AR.poder_alcance||9,meu:1,mult:LT.poder,c:F.c});som('poder',R.hero.el)||G.tone(440,.1,'triangle',.07)}
function especial(){const R=RUN,p=R.p,tipo=R.esp[2],F=BFX[R.hero.el]||{c:'#fff'},cor=F.c||'#fff';p.cd.E=AR.especial_recarga||7;som('poder',R.hero.el,true)||G.tone(220,.25,'sawtooth',.06);aviso(R.esp[0]+' '+R.esp[1]+'!',900);
  const em=(raio,mult,extra)=>{for(const e of R.w.ents){if(!e.vivo||dist(p,e)-e.r>raio)continue;golpeia(e,mult,'especial');if(extra)extra(e)}};
  const alvo=mira(8);
  if(tipo==='cone'){const fx=Math.sin(p.ang),fz=Math.cos(p.ang);for(const e of R.w.ents){if(!e.vivo)continue;const dx=e.x-p.x,dz=e.z-p.z,d=Math.hypot(dx,dz);if(d-e.r<4.2&&(d<.3||(dx*fx+dz*fz)/d>.5))golpeia(e,2.1,'especial')}
    for(let k=0;k<14;k++){const a=p.ang+(Math.random()-.5)*1,r=1+Math.random()*3.2;faisca(p.x+Math.sin(a)*r,.8,p.z+Math.cos(a)*r,cor,3)}anel(p.x+fx*2,p.z+fz*2,2.2,cor,.4)}
  else if(tipo==='onda'){anel(p.x,p.z,4,cor,.5);em(4,1.6,e=>{const d=dist(p,e)||1;mover(e,(e.x-p.x)/d*2.2,(e.z-p.z)/d*2.2)})}
  else if(tipo==='raiz'){anel(p.x,p.z,4.2,'#6ee052',.7);em(4.2,1.2,e=>{e.preso=2.2})}
  else if(tipo==='corrente'){let ult=p,ja=new Set();for(let k=0;k<4;k++){const e=maisPerto(ult,7,x=>!ja.has(x));if(!e)break;ja.add(e);raio(ult,e,cor);golpeia(e,1.8,'especial');ult=e}}
  else if(tipo==='nova'){anel(p.x,p.z,3.8,'#aee8ff',.5);em(3.8,1.4,e=>{e.lento=3})}
  else if(tipo==='tremor'){anel(p.x,p.z,3.2,'#c8a070',.4);em(3.2,2.4,e=>{e.preso=1})}
  else if(tipo==='investida'){p.inv=.5;const a=p.ang,x0=p.x,z0=p.z;mover(p,Math.sin(a)*5,Math.cos(a)*5);for(const e of R.w.ents){if(!e.vivo)continue;const t=Math.max(0,Math.min(1,((e.x-x0)*(p.x-x0)+(e.z-z0)*(p.z-z0))/(Math.hypot(p.x-x0,p.z-z0)**2||1)));
      if(Math.hypot(e.x-(x0+(p.x-x0)*t),e.z-(z0+(p.z-z0)*t))<1.2+e.r)golpeia(e,1.8,'especial')}for(let k=0;k<10;k++)faisca(x0+(p.x-x0)*k/10,.6,z0+(p.z-z0)*k/10,cor,2)}
  else if(tipo==='teleporte'){if(alvo){const a=Math.atan2(p.x-alvo.x,p.z-alvo.z)+Math.PI;p.x=alvo.x-Math.sin(a)*(alvo.r+.7);p.z=alvo.z-Math.cos(a)*(alvo.r+.7);p.ang=Math.atan2(alvo.x-p.x,alvo.z-p.z);golpeia(alvo,2.6,'especial');faisca(p.x,1,p.z,cor,14)}else p.cd.E=1}
  else if(tipo==='cura'){const c=Math.round(R.hero.max*.35);R.hero.hp=Math.min(R.hero.max,R.hero.hp+c);num(p.x,1.6,p.z,'+'+c+' ❤','#9dff8a');hud();anel(p.x,p.z,3,'#fff3a8',.6);em(3,1,null)}
  else if(tipo==='nuvem'){const x=alvo?alvo.x:p.x+Math.sin(p.ang)*2,z=alvo?alvo.z:p.z+Math.cos(p.ang)*2,o=anel(x,z,3,'#9ae03a',4,true);
    for(const e of R.w.ents)if(e.vivo&&Math.hypot(e.x-x,e.z-z)<3+e.r)e.veneno=4}}

// ---- inimigos ----
function iaInimigo(e,dt){const R=RUN,p=R.p,w=R.w;
  if(!e.vivo){if(e.morre<1){e.morre+=dt;e.g.position.y=-e.morre*.8;e.g.rotation.z=e.morre*1.2;if(e.morre>=1)e.g.visible=false}return}
  const d=dist(e,p);e.preso=Math.max(0,e.preso-dt);e.lento=Math.max(0,e.lento-dt);
  if(e.veneno>0){e.veneno-=dt;e.tv=(e.tv||0)+dt;if(e.tv>.5){e.tv=0;golpeia(e,.3,'veneno')}if(!e.vivo)return}
  let vx=0,vz=0;const vel=DF('inimigo_vel',2.4)*(e.chefe?.8:e.tipo==='elite'?.85:1)*(e.lento>0?.45:1)*(e.preso>0?0:1);
  const longeCasa=Math.hypot(e.x-e.cx,e.z-e.cz);
  if(e.estado!=='caca'&&d<(e.chefe?11:DF('aggro',7))&&!p.morto){e.estado='caca';if(e.chefe){$('advBoss').hidden=false;aviso('👑 O chefão apareceu!',2000);som('chefe')||G.tone(140,.5,'sawtooth',.07);som('musica','chefe')}
    // o acampamento inteiro acorda junto
    for(const o of w.ents)if(o!==e&&o.vivo&&o.estado==='parado'&&o.cx===e.cx&&o.cz===e.cz)o.estado='caca'}
  if(e.estado==='caca'&&(longeCasa>(e.chefe?14:15)||p.morto)){e.estado='volta'}
  if(e.estado==='volta'){if(longeCasa<1){e.estado='parado'}else{vx=(e.cx-e.x)/longeCasa*vel;vz=(e.cz-e.z)/longeCasa*vel}e.hp=Math.min(e.max,e.hp+e.max*.15*dt)}
  else if(e.estado==='caca'){
    if(e.aviso>0){e.aviso-=dt;if(e.aviso<=0)golpeDele(e)}
    else{const alc=e.r+p.r+(e.pancada?e.pancada.r*.45:.35);e.cdA-=dt;e.cdT-=dt;e.cdC-=dt;
      if(e.chefe&&e.cdT<=0&&d<12){e.cdT=e.hp<e.max/2?3:4.5;rajada(e)}
      else if(e.tipo==='atirador'&&e.cdT<=0&&d>2.5&&d<9){e.cdT=e.Tp.recarga||2.8;atira(e,Math.atan2(p.x-e.x,p.z-e.z),1)}
      if(e.tipo==='curandeiro'&&e.cdC<=0){const fe=w.ents.filter(o=>o.vivo&&o!==e&&o.hp<o.max&&dist(o,e)<(e.Tp.raio||5.5));
        if(fe.length){e.cdC=e.Tp.recarga||4.5;anel(e.x,e.z,e.Tp.raio||5.5,'#7dff9a',.6);som('cura')||G.tone(880,.12,'sine',.05);
          for(const o of fe){const c=Math.round(o.max*(e.Tp.cura||.22));o.hp=Math.min(o.max,o.hp+c);num(o.x,1.5,o.z,'+'+c,'#7dff9a');faisca(o.x,1,o.z,'#7dff9a',5);if(o.chefe)hud()}}}
      const dl=e.Tp.distancia||5;
      if(e.longe){if(d<dl-1.5){vx=(e.x-p.x)/d*vel*.8;vz=(e.z-p.z)/d*vel*.8}else if(d>dl+1.5){vx=(p.x-e.x)/d*vel;vz=(p.z-e.z)/d*vel}
        else if(d<=alc+.2&&e.cdA<=0){e.cdA=DF('inimigo_recarga',1.4);e.aviso=DF('inimigo_aviso',.5)}}
      else if(d>alc){vx=(p.x-e.x)/d*vel;vz=(p.z-e.z)/d*vel}
      else if(e.cdA<=0){if(e.pancada){e.cdA=e.pancada.rec;e.aviso=e.pancada.av;e.circ=anel(e.x,e.z,e.pancada.r,'#ff4040',e.pancada.av,true,true)}
        else{e.cdA=DF('inimigo_recarga',1.4);e.aviso=DF('inimigo_aviso',.5)}}}
    e.ang=Math.atan2(p.x-e.x,p.z-e.z)}
  else{e.t-=dt;if(e.t<=0){e.t=2+Math.random()*3;e.vag=Math.random()<.5?null:[e.cx+(Math.random()-.5)*3,e.cz+(Math.random()-.5)*3]}
    if(e.vag){const dx=e.vag[0]-e.x,dz=e.vag[1]-e.z,dd=Math.hypot(dx,dz);if(dd>.2){vx=dx/dd*vel*.4;vz=dz/dd*vel*.4;e.ang=Math.atan2(dx,dz)}}}
  if(vx||vz){mover(e,vx*dt,vz*dt);e.U.uPh.value+=Math.hypot(vx,vz)*dt*2.4/(e.chefe?2:1);e.U.uAmp.value=Math.min(.45,e.U.uAmp.value+dt*3);if(e.estado!=='caca')e.ang=Math.atan2(vx,vz)}
  else{e.U.uAmp.value=Math.max(0,e.U.uAmp.value-dt*3);if(e.U.uK)e.U.uPh.value+=dt*.7}}
function golpeDele(e){const R=RUN,p=R.p,d=dist(e,p),k=DF('contato',1);
  if(e.pancada){const P=e.pancada;if(d<P.r+p.r&&p.inv<=0)machuca(Math.round(dano(e,R.hero,P.m).d*k),p.x-e.x,p.z-e.z);faisca(e.x,.3,e.z,'#ffb070',e.chefe?16:10);if(R.r3)R.tremor=e.chefe?.35:.2;return}
  e.lunge=.2;if(d<e.r+p.r+.9&&p.inv<=0)machuca(Math.round(dano(e,R.hero,1).d*k),p.x-e.x,p.z-e.z)}
function atira(e,a,mult){if(!e.chefe&&Math.random()<.6)som('tiro_inimigo');const R=RUN,F=BFX[e.el]||{e:['💥'],c:'#fff'},s=sprEmoji(F.e[0],e.chefe?1.1:.7,F.c);s.position.set(e.x,1,e.z);R.r3.S.add(s);const v=e.chefe?7:DF('tiro_vel',6.5);
  R.w.tiros.push({s,x:e.x,y:e.chefe?1.4:1,z:e.z,vx:Math.sin(a)*v,vz:Math.cos(a)*v,d:0,alc:e.chefe?13:9,meu:0,mult:mult||1,c:F.c,dono:e})}
function rajada(e){const a=e.ang;for(let k=-2;k<=2;k++)atira(e,a+k*.28,.9);som('tiro_inimigo')||G.tone(180,.2,'sawtooth',.05)}
function golpeia(e,mult,como){const R=RUN,r=dano(R.hero,e,mult);let dd=r.d;e.pisca=.2;if(e.estado==='parado'||e.estado==='volta')e.estado='caca';
  let ab=0;if(e.esc>0){ab=Math.min(e.esc,Math.round(dd*(como==='poder'||como==='especial'?.6:1)));e.esc-=ab;dd=Math.max(0,dd-ab);
    if(e.esc<=0){aviso('🛡️ Escudo quebrado!',1100);faisca(e.x,1,e.z,'#7ad0ff',14);som('escudo')||G.tone(520,.12,'square',.05)}}
  e.hp-=dd;if(como!=='veneno'||dd)num(e.x,1.4*(e.chefe?2:1),e.z,'-'+(dd||ab)+(r.crit?'!':''),dd?(r.crit?'#ffe04a':(r.em>1?'#ffb070':'#ffffff')):'#7ad0ff');
  if(como!=='veneno')som('golpe',r.crit)||G.tone(como==='ataque'?380:300,.06,'square',.05);if(r.em>1&&como!=='veneno'&&!R.avisoEf){R.avisoEf=1;aviso('Super eficaz! 💪',900);setTimeout(()=>{if(RUN===R)R.avisoEf=0},2500)}
  if(e.hp<=0){e.vivo=false;e.bar.remove();R.mortos=(R.mortos||0)+1;if(e.chefe)R.chefeMorto=1;else R.kills=(R.kills||0)+1;hud();faisca(e.x,.8,e.z,ECOL[e.el]||'#fff',e.chefe?30:14);som('derrota_inimigo')||G.tone(660,.1,'triangle',.07);
    if(e.chefe){aviso('Você derrotou o chefão! O portal abriu ✨',3000);G.fanfare();$('advBoss').hidden=true;som('musica',R.f.mundo.id)}}
  if(e.chefe)hud()}
function machuca(d,dx,dz){const R=RUN,p=R.p;if(p.inv>0||p.morto)return;R.hero.hp-=d;p.inv=AR.invencivel_dano||.6;const n=Math.hypot(dx,dz)||1;mover(p,dx/n*.6,dz/n*.6);
  num(p.x,1.5,p.z,'-'+d,'#ff8a8a');som('dano')||G.tone(180,.14,'sawtooth',.06);R.tremor=Math.max(R.tremor||0,.18);
  const fl=$('advDano');if(fl){fl.classList.remove('on');void fl.offsetWidth;fl.classList.add('on')}hud();if(R.hero.hp<=0){R.hero.hp=0;hud();derrota()}}
// ---- efeitos ----
function faisca(x,y,z,c,n){const R=RUN,T=G.THREE();for(let k=0;k<n;k++){const m=new T.Mesh(new T.SphereGeometry(.07,5,4),new T.MeshBasicMaterial({color:c}));m.position.set(x,y,z);R.r3.S.add(m);
  const vx=(Math.random()-.5)*4,vy=1+Math.random()*3,vz=(Math.random()-.5)*4;R.w.efeitos.push({o:m,t:0,dur:.5+Math.random()*.3,atual:k=>{m.position.x+=vx/60;m.position.z+=vz/60;m.position.y+=(vy-k*6)/60;m.scale.setScalar(1-k)}})}}
function anel(x,z,r,c,dur,cheio,aviso_){const R=RUN,T=G.THREE(),m=new T.Mesh(cheio?new T.CircleGeometry(r,40):new T.RingGeometry(r*.85,r,48),new T.MeshBasicMaterial({color:c,transparent:true,opacity:.6,depthWrite:false,blending:aviso_?T.NormalBlending:T.AdditiveBlending,side:T.DoubleSide}));
  m.rotation.x=-Math.PI/2;m.position.set(x,.05,z);R.r3.S.add(m);R.w.efeitos.push({o:m,t:0,dur,atual:k=>{if(aviso_){m.material.opacity=.15+.35*k}else if(cheio){m.material.opacity=.45*(1-k)+.1}else{m.scale.setScalar(.3+.7*k);m.material.opacity=.7*(1-k)}}});return m}
function arco(x,z,a,c){const R=RUN,T=G.THREE(),m=new T.Mesh(new T.RingGeometry(.6,.95,20,1,-.9,1.8),new T.MeshBasicMaterial({color:c,transparent:true,opacity:.85,side:T.DoubleSide,depthWrite:false,blending:T.AdditiveBlending}));
  m.rotation.x=-Math.PI/2;m.rotation.z=a-Math.PI/2;m.position.set(x,.7,z);R.r3.S.add(m);R.w.efeitos.push({o:m,t:0,dur:.18,atual:k=>{m.material.opacity=.85*(1-k);m.scale.setScalar(1+k*.4)}})}
function raio(a,b,c){const R=RUN,T=G.THREE(),pts=[];for(let k=0;k<=6;k++){const t=k/6;pts.push(new T.Vector3(a.x+(b.x-a.x)*t+(k%6?(Math.random()-.5)*.5:0),1+(k%6?(Math.random()-.5)*.5:0),a.z+(b.z-a.z)*t))}
  const l=new T.Line(new T.BufferGeometry().setFromPoints(pts),new T.LineBasicMaterial({color:c}));R.r3.S.add(l);R.w.efeitos.push({o:l,t:0,dur:.25})}
function num(x,y,z,t,c){const R=RUN,n=R.w.nums;if(n.length>=14){const o=n.shift();if(o.el)o.el.remove()}n.push({x:x+(Math.random()-.5)*.9,y:y+Math.random()*.3,z,t:.85,s:t,c,el:null})}
function hud(){const R=RUN,h=R.hero,b=$('advHpMe'),baixo=h.hp<h.max*.3;if(b){b.style.width=Math.max(0,h.hp/h.max*100)+'%';b.classList.toggle('baixo',baixo)}
  const t=$('advHpTxt');if(t)t.textContent=Math.max(0,Math.round(h.hp))+'/'+h.max;const sc=$('advScene');if(sc)sc.classList.toggle('baixo',baixo&&h.hp>0);
  const o=$('advObjE');if(o&&R.total)o.textContent='👾 '+(R.mortos||0)+'/'+R.total;
  const w=R.w;if(w&&w.boss){const bb=$('advHpBoss');if(bb)bb.style.width=Math.max(0,w.boss.hp/w.boss.max*100)+'%';const bt=$('advHpBossTxt');if(bt)bt.textContent=Math.max(0,Math.round(w.boss.hp))+'/'+w.boss.max}}
function folhas(){const l=$('advLeaf');if(l)l.innerHTML=[0,1,2].map(k=>'<i class="'+(k<RUN.leaves?'on':'')+'">🍃</i>').join('')}
function derrota(){const R=RUN;if(R.fim)return;R.p.morto=.001;R.fim=true;R.fimPend=1;R.p.m.rotation.z=Math.PI/2;R.p.m.position.y=.3;desenha();setTimeout(()=>terminar(false),900)}
function vitoria(){const R=RUN;if(R.fim)return;R.fim=true;R.fimPend=1;terminar(true)}
function desistir(){const R=RUN;if(!R||(R.fim&&!R.fimPend)){limpa3D();mapa();return}if(R.fimPend)return;
  if(!R.quit){R.quit=1;aviso('Toque de novo em ‹ para desistir (conta como derrota).',2500);setTimeout(()=>{if(RUN===R)R.quit=0},2600);return}
  R.fim=true;R.fimPend=1;terminar(false)}

// ---- desenho ----
const V3=()=>new (G.THREE().Vector3)();
function desenha(){const R=RUN;if(!R||!R.r3||!R.p)return;const {rd,S,cam}=R.r3,p=R.p,w=R.w;
  p.g.position.set(p.x+Math.sin(p.ang)*p.lunge*1.5,0,p.z+Math.cos(p.ang)*p.lunge*1.5);p.g.rotation.y=p.ang;p.g.visible=!(p.inv>0&&!p.dash&&Math.floor(p.inv*16)%2);
  for(const e of w.ents){if(!e.g.visible)continue;e.lunge=Math.max(0,(e.lunge||0)-1/60);e.g.position.x=e.x+Math.sin(e.ang)*e.lunge*1.2;e.g.position.z=e.z+Math.cos(e.ang)*e.lunge*1.2;e.g.rotation.y=e.ang;
    const tr=e.aviso>0&&!e.chefe?1+Math.sin(R.t*40)*.06:1;e.m.scale.setScalar(e.s*tr);e.pisca=Math.max(0,(e.pisca||0)-1/60);e.m.position.y=e.pisca>0?.08:0}
  for(const it of w.itens)if(!it.ok)it.g.rotation.y+=.03;
  // câmera de cima, inclinada, atrás do bichinho
  if(!R.cam)R.cam={x:p.x,z:p.z+(AR.cam_frente||2.2)};
  let ox=0,oz=0;if(R.tremor>0&&!R.pausa){R.tremor=Math.max(0,R.tremor-1/60);ox=(Math.random()-.5)*R.tremor*1.2;oz=(Math.random()-.5)*R.tremor*1.2}
  cam.position.set(R.cam.x+ox,AR.cam_altura||11.5,R.cam.z-(AR.cam_tras||8.5)+oz);cam.lookAt(R.cam.x+ox,0,R.cam.z+oz);
  // só desenha os blocos de árvores/cogumelos que a câmera alcança (largura depende da tela)
  if(w.blocos){const cz=R.cam.z+oz,cx=R.cam.x+ox,hw=2+27*Math.tan(Math.atan(Math.tan(21*Math.PI/180)*cam.aspect));for(const b of w.blocos)b.m.visible=b.z1>cz-9.5&&b.z0<cz+12.5&&b.x1>cx-hw&&b.x0<cx+hw}
  rd.render(S,cam);
  // barras de vida, números e minimapa (HTML por cima do 3D)
  const cv=$('advCv'),W=cv.clientWidth,H=cv.clientHeight,v=V3();
  for(const e of w.ents){if(!e.vivo){continue}v.set(e.x,(e.chefe?3.3:1.5)*e.s/1.1+.2,e.z).project(cam);const vis=v.z<1&&Math.abs(v.x)<1.1&&Math.abs(v.y)<1.1&&e.estado!=='parado'||(e.hp<e.max&&v.z<1);
    e.bar.hidden=!vis||e.chefe;if(vis&&!e.chefe){e.bar.style.transform='translate('+((v.x+1)/2*W)+'px,'+((1-v.y)/2*H)+'px)';e.bar.lastChild.firstChild.style.width=Math.max(0,e.hp/e.max*100)+'%';if(e.escMax){const q=e.bar.querySelector('.esc');q.firstChild.style.width=Math.max(0,e.esc/e.escMax*100)+'%';q.hidden=e.esc<=0}}}
  const fx=$('advFx');for(const n of w.nums){if(!n.el){n.el=document.createElement('b');n.el.className='advnum3';n.el.textContent=n.s;n.el.style.color=n.c;fx.appendChild(n.el)}
    n.t-=1/60*1.2;n.y+=.02;v.set(n.x,n.y,n.z).project(cam);n.el.style.transform='translate('+((v.x+1)/2*W)+'px,'+((1-v.y)/2*H)+'px)';n.el.style.opacity=Math.min(1,n.t*2);if(n.t<=0)n.el.remove()}
  w.nums=w.nums.filter(n=>n.t>0);
  const MX={P:AR.poder_recarga||2.2,E:AR.especial_recarga||7,D:AR.esquiva_recarga||1.2};R.cdAnt=R.cdAnt||{};
  for(const k of ['P','E','D']){const b=document.querySelector('.advskills [data-k="'+k+'"] em');if(b){const c=p.cd[k],bt=b.parentNode;b.textContent=c>=1?Math.ceil(c):'';bt.classList.toggle('carrega',c>0);bt.style.setProperty('--cd',Math.min(1,c/MX[k]).toFixed(3));
    if(R.cdAnt[k]>0&&c<=0&&!(k==='E'&&!R.espOk)){bt.classList.remove('pronto');void bt.offsetWidth;bt.classList.add('pronto')}R.cdAnt[k]=c}}
  minimapa()}
function minimapa(){const R=RUN,c=$('advMini');if(!c)return;const x=c.getContext('2d'),w=R.w,M=w.M,p=R.p,S_=c.width,esc=S_/2/18;x.clearRect(0,0,S_,S_);
  x.save();x.beginPath();x.arc(S_/2,S_/2,S_/2-2,0,7);x.clip();x.fillStyle='rgba(30,52,40,.9)';x.fillRect(0,0,S_,S_);
  const tx=X=>S_/2-(X-p.x)*esc,tz=Z=>S_/2-(Z-p.z)*esc;
  x.strokeStyle='#b8946a';x.lineWidth=2.6*esc;x.lineCap='round';x.beginPath();M.caminho.forEach(([X,Z],k)=>k?x.lineTo(tx(X),tz(Z)):x.moveTo(tx(X),tz(Z)));x.stroke();
  x.fillStyle='rgba(20,40,28,.9)';for(const [X,Z,s] of M.arvores){const a=tx(X),b=tz(Z);if(a>-4&&a<S_+4&&b>-4&&b<S_+4){x.beginPath();x.arc(a,b,.8*s*esc,0,7);x.fill()}}
  for(const it of w.itens)if(!it.ok&&it.t==='L'){x.fillStyle='#ffd23c';x.beginPath();x.arc(tx(it.x),tz(it.z),4,0,7);x.fill()}
  for(const e of w.ents)if(e.vivo){x.fillStyle=e.chefe?'#c070ff':'#ff5a4a';x.beginPath();x.arc(tx(e.x),tz(e.z),e.chefe?6:3.5,0,7);x.fill()}
  x.fillStyle=(w.boss&&w.boss.vivo)?'#8a7aa8':'#ff9ac8';x.beginPath();x.arc(tx(M.portal[0]),tz(M.portal[1]),6,0,7);x.fill();
  x.translate(S_/2,S_/2);x.rotate(-p.ang);x.fillStyle='#fff';x.beginPath();x.moveTo(0,-8);x.lineTo(6,6);x.lineTo(-6,6);x.closePath();x.fill();x.restore();
  x.strokeStyle='rgba(255,255,255,.5)';x.lineWidth=3;x.beginPath();x.arc(S_/2,S_/2,S_/2-2,0,7);x.stroke()}

async function terminar(win){const R=RUN;if(!R||R.salvo)return;R.salvo=1;R.fim=true;
  const f=R.f,id=f.id,st=win?Math.min(3,R.leaves):0;
  // XP como no Pokémon (5ª geração): por bichinho derrotado, mais forte quanto maior o nível do inimigo; chefão vale mais. O servidor refaz a conta.
  const lvMax=Math.max(1,...f.inimigos.map(x=>x[1]),f.chefe?f.chefe[1]:1),xk=(D.xp.por_inimigo||0),kx=Math.floor(xk*lvMax/5*Math.pow((2*lvMax+10)/(lvMax+R.hero.lv+10),2.5)+1);
  const nk=R.kills||0,xpK=nk*kx+(R.chefeMorto&&win?Math.round((D.xp.chefe||1)*kx):0);
  const antes=G.stats(R.i),xp0=G.xp(R.i);
  let res={first:false,stone:-1,coins:0,diam:0,ovo:-1,xp:(win?D.xp.vitoria:D.xp.derrota)+xpK,erro:''};
  if(G.online()){const r=await G.sync('adv_end',{stage:id,win,stars:Math.max(1,st),kills:nk,bossKill:!!R.chefeMorto});
    if(r&&!r.error&&typeof r.coins==='number'){res.coins=r.coins-G.coins();G.setCoins(r.coins);res.xp=r.xp-xp0;G.xpSet(R.i,r.xp);res.first=!!r.first;res.stone=r.stone;res.diam=r.diamonds_got|0;res.ovo=typeof r.egg_leg==='number'?r.egg_leg:-1;if(window.GARRO_LEND)window.GARRO_LEND.servidor(r);if(win)box().prog[id]=Math.max(box().prog[id]||0,Math.max(1,st));if(r.stone>=0)G.stoneLocal(r.stone)}
    else{const det=r&&r.detail||'';res.erro=det.includes('nivel_baixo')?'O servidor não aceitou: seu bichinho ainda é fraco demais para esta fase.':'Não deu para salvar o resultado. Tente de novo.';res.xp=0}}
  else{if(win){res.first=!L.prog[id];L.prog[id]=Math.max(L.prog[id]||0,Math.max(1,st));if(res.first&&f.premio){G.addCoinsLocal(f.premio);res.coins=f.premio}
      if(f.chefe&&!f.desafio&&Math.random()<D.chefe_pedra.chance){const p=D.chefe_pedra.pedras;res.stone=p[Math.floor(Math.random()*p.length)];G.stoneLocal(res.stone)}
      // sem login: os mesmos prêmios do servidor, guardados no aparelho (js/lendarios.js)
      const GL=window.GARRO_LEND,DM=((GD.lendarios||{}).diamantes)||{};
      if(GL){let dd=0,ov=-1;if(f.chefe&&!f.desafio&&GL.premio('chefe_'+id))dd+=DM.chefe_do_mundo||0;
        const fs=f.mundo.fases;if(!f.desafio&&fs.every(x=>(L.prog[x.id]||0)>=3)&&GL.premio('mundo3_'+f.mundo.id))dd+=DM.mundo_3_estrelas||0;
        if(f.desafio&&GL.sorteioHoje()&&Math.random()<(f.chance_ovo||0))ov=f.chefe[0]-LEG0;
        if(dd||ov>=0)GL.local(dd,ov);res.diam=dd;res.ovo=ov}}
    saveL();G.xpLocal(R.i,res.xp)}
  if(win&&!res.erro)G.evento('adventure',1);
  res.antes=antes;res.depois=G.stats(R.i);res.nk=nk;res.xpIni=xpK;res.barra=G.xpBar(R.i);res.xp0=xp0;
  resultado(win,st,res)}
function resultado(win,st,res){const R=RUN,f=R.f,tem=FASES[R.k+1];som('parar');if(win)som('vitoria')||G.fanfare();else som('derrota')||G.tone(196,.4,'sawtooth',.07);
  let h='<div class="advres '+(win?'win':'lose')+'"><h4>'+(win?'Vitória! 🏆':'Derrota 💔')+'</h4>';
  if(win)h+='<div class="advstars">'+estrelas(st)+'</div><small class="advst">'+st+' de 3 folhas douradas 🍃</small>';
  h+='<ul>';if(res.erro)h+='<li>'+res.erro+'</li>';
  if(res.erro){}else if(win&&res.first&&res.coins>0)h+='<li>+'+res.coins+' 🪙 <small>(1ª vitória nesta fase)</small></li>';else if(win&&!R.f.desafio)h+='<li><small>Fase já vencida antes: sem moedas desta vez</small></li>';
  if(!res.erro)h+='<li>+'+res.xp+' XP para '+G.name(R.i)+(res.nk||res.xpIni?' <small>('+res.nk+' derrotado'+(res.nk===1?'':'s')+(R.chefeMorto?' + chefão':'')+')</small>':'')+'<div class="advxp"><i style="width:'+res.barra.pct+'%"></i></div><small>'+res.barra.txt+'</small></li>';
  if(!res.erro&&res.depois&&res.antes&&res.depois.lv>res.antes.lv){const a=res.antes,d=res.depois,r=(n,x,y)=>'<span>'+n+' <s>'+x+'</s> → <b>'+y+'</b></span>';
    h+='<li class="advup"><big>⬆ Subiu de nível! Nv '+a.lv+' → '+d.lv+'</big><div>'+r('ATAQUE',a.atk,d.atk)+r('DEFESA',a.def,d.def)+r('VIDA',a.hp,d.hp)+'</div></li>'}
  if(res.diam>0)h+='<li class="pedra">💎 +'+res.diam+' diamante'+(res.diam>1?'s':'')+' raro'+(res.diam>1?'s':'')+'! <small>(use no Ninho)</small></li>';
  if(res.ovo>=0&&window.GARRO_LEND){const x=window.GARRO_LEND.lendarios[res.ovo];h+='<li class="pedra"><img src="img/lendarios/ovo_'+x.slug+'.webp" alt=""> Ovo de <b>'+x.nome+'</b>! Foi para o 🥚 Ninho</li>'}
  if(res.stone>=0){const s=G.stone(res.stone);h+='<li class="pedra">'+(s&&s.img?'<img src="'+s.img+'" alt="">':'💎')+' O chefão deixou cair: <b>'+(s?s.name:'pedra')+'</b>!</li>'}
  if(!win)h+='<li><small>Dica: quando o inimigo tremer ou aparecer um círculo vermelho no chão, use 💨 Esquivar. Derrote primeiro o curandeiro 💚, use o Poder de longe e pegue morangos 🍓. Bichinho com nível maior aguenta mais.</small></li>';
  h+='</ul><div class="advresb">'+(win&&tem?'<button type="button" data-r="prox">Próxima fase ›</button>':'')+'<button type="button" data-r="de-novo">'+(win?'Jogar de novo':'Tentar de novo')+'</button><button type="button" data-r="mapa" class="sec">Mapa</button></div></div>';
  const d=document.createElement('div');d.innerHTML=h;$('advScene').appendChild(d.firstChild);moedas();
  // mundo completo: só na 1ª vez que a última fase dele é vencida (res.first veio do terminar())
  if(win&&!f.desafio&&res.first){const fs=f.mundo.fases;
    if(fs.filter(x=>x.id!==f.id).every(x=>(box().prog[x.id]||0)>=1)){
      const moedasMundo=fs.reduce((s,x)=>s+(x.premio||0),0),tresEstrelas=fs.every(x=>(box().prog[x.id]||0)>=3);
      let hm='<div class="advres advmundo-ok"><h4>🌎 '+f.mundo.nome+' completo! 🏆</h4><ul>';
      hm+='<li>'+fs.length+' fases vencidas</li>';
      if(moedasMundo>0)hm+='<li>+'+moedasMundo+' 🪙 ganhos neste mundo</li>';
      if(tresEstrelas)hm+='<li>🍃 3 folhas em todas as fases!</li>';
      hm+='</ul><div class="advresb"><button type="button" data-r="mapa">Continuar</button></div></div>';
      const dm=document.createElement('div');dm.innerHTML=hm;$('advScene').appendChild(dm.firstChild)
    }
  }}

window.GARRO_AVENTURA={FASES,lutador,dano,elemMult,energia,liberada,box,recomendado,nivelMin,run:()=>RUN,tec:(k,v)=>{if(v&&!TEC[k])TEC[k+'p']=true;TEC[k]=v},joy:(x,y)=>{JOY.x=x;JOY.y=y},sim:(n,bot)=>{for(let k=0;k<n&&RUN&&RUN.p&&!RUN.fim;k++){if(bot)bot();fisica(1/60)}if(RUN&&RUN.p)desenha()}};// usado nos testes
setTimeout(carregarServidor,3000);
})();
