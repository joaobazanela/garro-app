/* GARRO — Aventura: mapa de fases; cada fase é um mapa 3D visto de cima (floresta): o bichinho anda com o joystick,
   enfrenta os bichinhos selvagens em tempo real (Atacar, Poder, Especial do elemento, Esquivar) e chega ao portal.
   O mapa de cada fase vem do JSON (data/aventura.json, campo mapa3d).
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
// Desafio Lendário: fase extra depois do chefão do mundo; o chefão é o lendário do dia (troca à meia-noite de Brasília, igual ao servidor)
function legDoDia(){const h=new Date(Date.now()-3*3600e3).toISOString().slice(0,10);return Math.floor(Date.parse(h+'T00:00:00Z')/864e5)%10}
if(D.desafio&&D.desafio.mapa3d&&NLEG>=10){const f=Object.assign({mundo:D.mundos[0],desafio:true},D.desafio);Object.defineProperty(f,'chefe',{get:()=>[LEG0+legDoDia(),D.desafio.nivel],enumerable:true});FASES.push(f)}
const LKEY='garro-aventura';

// ---------- números da luta (mesmas fórmulas usadas para equilibrar as fases) ----------
const media=a=>a.reduce((x,y)=>x+y,0)/a.length;
const MB=media(STAT.slice(0,G.CH0).map(s=>(s[0]+s[1])/2)),MS=media(STAT.slice(G.CH0,G.LEG0||43).map(s=>(s[0]+s[1])/2));
// o nível pesa muito: ataque, defesa e vida crescem juntos; bichinhos redondos são equiparados aos grandes
function lutador(i,lv,o){o=o||{};const s=STAT[i],M=grande(i)?MB:MS,k=MB/M,a=(s[0]+M)/2*k,d=(s[1]+M)/2*k;
  const P=1+LT.nivel_k*(lv-1),ev=(i<G.CH0&&lv>=G.EVO_LV)?LT.evoluido:1;
  let atk=a*P*ev,def=d*P*ev,hp=(a+d)*P*ev*LT.vida_k*(o.heroi?LT.heroi_vida:1);
  if(o.chefe){hp*=LT.chefe_vida;atk*=LT.chefe_ataque}
  hp=Math.round(hp);return{i,lv,atk,def,hp,max:hp,el:ELEM[i],cd:0,defesa:false,chefe:!!o.chefe}}
const grupo=el=>(D.grupos&&D.grupos[el])||el;
function elemMult(A,B){const a=grupo(A.el),b=grupo(B.el);if((D.vantagens[a]||[]).includes(b))return LT.vantagem;if((D.vantagens[b]||[]).includes(a))return LT.desvantagem;return 1}
function dano(A,B,mult){const em=elemMult(A,B);let d=A.atk*mult*(1-LT.variacao+Math.random()*2*LT.variacao)*60/(60+B.def)*em;
  const crit=Math.random()<LT.critico;if(crit)d*=1.5;if(B.defesa)d*=LT.defesa;return{d:Math.max(1,Math.round(d)),crit,em}}
function nivelMax(f){return Math.max(...f.inimigos.map(x=>x[1]).concat(f.chefe?[f.chefe[1]]:[]))}
function recomendado(f){return nivelMax(f)+(f.chefe?2:3)}
// o servidor só aceita vitória se o bichinho tiver pelo menos este nível (nível do inimigo mais forte − folga)
function nivelMin(f){return Math.max(1,nivelMax(f)-(D.nivel_min_folga??6))}

// ---------- estado: progresso (estrelas por fase) e energia por bichinho ----------
let L={prog:{},en:{}};try{const o=JSON.parse(localStorage.getItem(LKEY)||'');if(o&&o.prog)L=Object.assign(L,o)}catch(e){}
function saveL(){try{localStorage.setItem(LKEY,JSON.stringify(L))}catch(e){}}
let S=null;// vindo do servidor quando logado
const box=()=>G.online()&&S?S:L;
function liberada(k){return k===0||!!box().prog[FASES[k-1].id]}
function energia(i){const r=box().en[i];if(!r)return{e:EN.max,s:Date.now(),falta:0};let e=r.e,s=r.s;const step=EN.recarga_min*6e4;
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
// mapa: caminho de baixo (fase 1) para cima (chefe)
const XS=[50,74,30,66,26,70,34,72,30,50];
function mapa(){limpa3D();TELA='mapa';RUN=null;moedas();const M=FASES[0].mundo;$('advTitle').textContent=M.nome;
  const n=FASES.length,H=n*104+150,pos=FASES.map((f,k)=>({x:XS[k%XS.length],y:H-80-k*104}));
  let d='M'+pos[0].x+' '+pos[0].y;for(let k=1;k<n;k++){const a=pos[k-1],b=pos[k],my=(a.y+b.y)/2;d+=' C'+a.x+' '+my+' '+b.x+' '+my+' '+b.x+' '+b.y}
  let h='<div class="advmap" style="height:'+H+'px"><svg viewBox="0 0 100 '+H+'" preserveAspectRatio="none"><path d="'+d+'" class="trilha"/><path d="'+d+'" class="trilha2"/></svg>';
  const deco=['🌲','🌳','🍄','🌿','🌸','🌲','🌳','🪨'];for(let k=0;k<26;k++){const x=(k*37+11)%92+2,y=(k*131+40)%(H-40);h+='<span class="advdeco" style="left:'+x+'%;top:'+y+'px">'+deco[k%deco.length]+'</span>'}
  let cur=FASES.findIndex((f,k)=>liberada(k)&&!box().prog[f.id]);if(cur<0)cur=n;
  FASES.forEach((f,k)=>{const ok=liberada(k),st=box().prog[f.id]||0,cls=st?'feita':ok?'atual':'bloq';
    h+='<button type="button" class="advnode '+cls+(f.chefe?' chefe':'')+(f.desafio?' lenda':'')+'" data-k="'+k+'" style="left:'+pos[k].x+'%;top:'+pos[k].y+'px"'+(ok?'':' disabled')+'>'+
      (f.chefe?'<img src="'+G.sprite(f.chefe[0],G.EVO_LV,1)+'" alt="">':'<b>'+(k+1)+'</b>')+(ok?'':'<em>🔒</em>')+'<i>'+(f.desafio?'':st?estrelas(st):f.chefe?'Chefão':'')+'</i><s class="cav" aria-label="Dificuldade '+(f.caveiras||1)+' de 5">'+caveiras(f)+'</s></button>';
    if(k===cur||f.desafio)h+='<div class="advlabel'+(f.desafio?' lenda':'')+'" style="left:'+pos[k].x+'%;top:'+(pos[k].y+(f.desafio?-84:40))+'px">'+(f.desafio?'👑 ':'')+f.nome+'</div>'});
  h+='</div><p class="advnote">Jogar não custa nada. Cada fase cansa um pouco o bichinho (⚡). Vencer pela 1ª vez dá moedas.</p>';
  $('advBody').innerHTML=h;
  const alvo=$('advBody').querySelector('.advnode.atual')||$('advBody').querySelector('.advnode.feita:last-of-type');
  if(alvo)setTimeout(()=>alvo.scrollIntoView({block:'center'}),30)}

// escolher o bichinho
function pips(e){let s='';for(let k=0;k<EN.max;k++)s+='<i class="'+(k<e?'on':'')+'"></i>';return '<span class="advpips">'+s+'</span>'}
function escolha(k){limpa3D();TELA='escolha';FK=k;const f=FASES[k];moedas();$('advTitle').textContent=f.desafio?f.nome:'Fase '+(k+1);
  const coll=G.coll(),meus=Object.keys(coll).map(Number).filter(i=>coll[i]>0).sort((a,b)=>G.lvOf(b)-G.lvOf(a));
  if(SEL===null||!meus.includes(SEL))SEL=meus[0]??null;
  const LG=f.desafio&&window.GARRO_LEND?window.GARRO_LEND.porId(f.chefe[0]):null;
  let h='<div class="advfase'+(f.desafio?' lenda':'')+'"><b>'+f.nome+'</b><small>'+(f.desafio?'👑 Hoje: <b>'+(LG?LG.nome:G.name(f.chefe[0]))+'</b> · '+Math.round((f.chance_ovo||0)*100)+'% de chance do ovo dele (na 1ª vitória do dia) · troca todo dia':box().prog[f.id]?'Já vencida '+estrelas(box().prog[f.id])+' · repetir dá só XP':'1ª vitória: +'+f.premio+' 🪙'+(f.chefe?' · chance de pedra de evolução · 💎 na 1ª vitória':''))+'</small>';
  const meuLv=SEL!==null?G.lvOf(SEL):1,tps=tiposDa(f);
  h+='<div class="advdif"><span class="cav">'+caveiras(f)+'</span>'+Object.keys(tps).map(t=>TP[t]?'<span class="tp">'+TP[t].icone+' '+TP[t].nome+(tps[t]>1?' ×'+tps[t]:'')+'</span>':'').join('')+'</div>';
  h+='<div class="advfoes">'+f.inimigos.map(([j,lv])=>'<span><img src="'+G.sprite(j,lv)+'" alt=""><small class="'+corNv(lv,meuLv)+'">Nv '+lv+'</small></span>').join('')+(f.chefe?'<span class="chefe"><img src="'+G.sprite(f.chefe[0],G.EVO_LV,1)+'" alt=""><small class="'+corNv(f.chefe[1],meuLv)+'">👑 Nv '+f.chefe[1]+'</small></span>':'')+'</div>';
  h+='<small class="advrec">Recomendado: Nv '+recomendado(f)+' ou mais</small></div>';
  if(!meus.length)h+='<p class="advnote">Pegue uma pelúcia na máquina para começar a aventura.</p>';
  h+='<div class="advpets">'+meus.map(i=>{const lv=G.lvOf(i),E=energia(i),el=ELEM[i];return '<button type="button" class="advpet'+(i===SEL?' sel':'')+(lv<recomendado(f)-4?' fraco':'')+'" data-i="'+i+'"><img src="'+G.sprite(i,lv)+'" alt=""><b>'+(lv>=G.EVO_LV&&i<G.CH0?G.evName(i):G.name(i))+'</b><small>Nv '+lv+' · '+(ELNAME[el]||'')+'</small>'+pips(E.e)+(E.e<EN.max?'<small class="advwait">+1 ⚡ em '+tempo(E.falta)+'</small>':'')+'</button>'}).join('')+'</div>';
  if(SEL!==null){const E=energia(SEL),nm=nivelMin(f),lvs=G.lvOf(SEL);h+='<div class="advgo">'+(lvs<nm?'<button type="button" disabled>Precisa de Nv '+nm+'</button><small>'+G.name(SEL)+' ainda é fraco para esta fase. Cuide dele para subir de nível ou escolha outro bichinho.</small>':E.e>0?'<button type="button" id="advStart">Jogar! ▶</button>':'<button type="button" id="advRest">😴 Descansar · '+EN.descanso_preco+' 🪙</button><small>'+G.name(SEL)+' está cansado. Volta 1 ⚡ em '+tempo(E.falta)+', ou descanse agora.</small>')+'</div>'}
  $('advBody').innerHTML=h;
  const st=$('advStart');if(st)st.addEventListener('click',()=>comecar(k,SEL));
  const rs=$('advRest');if(rs)rs.addEventListener('click',()=>descansar(SEL))}
$('advBody').addEventListener('click',e=>{
  const n=e.target.closest('.advnode');if(n&&TELA==='mapa'){G.click(700);msg('');escolha(+n.dataset.k);return}
  const p=e.target.closest('.advpet');if(p&&TELA==='escolha'){G.click(760);SEL=+p.dataset.i;msg('');escolha(FK);return}
  const r=e.target.closest('[data-r]');if(r){const v=r.dataset.r;if(v==='mapa')mapa();else if(v==='prox')escolha(FK+1);else escolha(FK)}
});

async function descansar(i){if(G.coins()<EN.descanso_preco){msg('Faltam moedas para descansar ('+EN.descanso_preco+' 🪙).');return}
  if(G.online()){const r=await G.sync('adv_rest',{plushId:i});if(!r||r.error||typeof r.coins!=='number'){msg('Não deu para descansar agora. Tente de novo.');return}
    G.setCoins(r.coins);S.en[i]={e:r.energy,s:Date.now()}}
  else{G.addCoinsLocal(-EN.descanso_preco);L.en[i]={e:EN.max,s:Date.now()};saveL()}
  G.tone(523,.2,'sine',.08);msg('');escolha(FK)}

const ERROS={cansado:'Seu bichinho está cansado. Descanse ou espere a energia voltar.',fase_bloqueada:'Vença a fase anterior primeiro.',nao_tem:'Você não tem esse bichinho.'};
async function comecar(k,i){const f=FASES[k];if(!liberada(k))return;const E=energia(i);if(E.e<1||G.lvOf(i)<nivelMin(f)){escolha(k);return}
  const b=$('advStart');if(b)b.disabled=true;G.click(820);
  if(G.online()){const r=await G.sync('adv_start',{plushId:i,stage:f.id});
    if(!r||r.error||typeof r.energy!=='number'){const det=r&&r.detail||'';msg(Object.keys(ERROS).map(x=>det.includes(x)?ERROS[x]:'').join('')||'Não deu para começar. Tente de novo.');if(b)b.disabled=false;await carregarServidor();return}
    S.en[i]={e:r.energy,s:Date.parse(r.since)}}
  else{L.en[i]={e:E.e-1,s:E.e>=EN.max?Date.now():E.s};saveL()}
  const lv=G.lvOf(i);
  RUN={k,f,i,hero:lutador(i,lv,{heroi:1}),fim:false,quit:0,leaves:0,dif:difDe(k)};
  luta()}

// ---------- a fase: mapa 3D visto de cima (joystick, luta em tempo real, habilidades) ----------
const AR=D.arena||{},TP=D.tipos||{};
// dificuldade que cresce fase a fase (data/aventura.json: curva = [1ª fase, última fase])
function difDe(k){const f=FASES[k],fs=f.mundo.fases,i=fs.findIndex(x=>x.id===f.id),t=fs.length>1?i/(fs.length-1):0,o={};
  for(const [c,[a,b]] of Object.entries(D.curva||{}))o[c]=a+(b-a)*t;return o}
const DF=(c,pad)=>{const v=RUN&&RUN.dif&&RUN.dif[c];return v??AR[c]??pad};
// cor do nível do inimigo comparado ao seu bichinho: verde fácil, amarelo parelho, vermelho difícil
function corNv(lv,meu){return lv<=meu-3?'fac':lv>meu+2?'dif':'med'}
function caveiras(f){const n=f.caveiras||1;return '💀'.repeat(n)+'<b>'+'💀'.repeat(5-n)+'</b>'}
function tiposDa(f){const c={};for(const cp of (f.mapa3d&&f.mapa3d.acampamentos)||[])for(const e of cp.inimigos)if(e[4])c[e[4]]=(c[e[4]]||0)+1;return c}
const ESPECIAIS={fogo:['🔥','Chamas','cone'],agua:['🌊','Onda','onda'],planta:['🌿','Cipós','raiz'],raio:['⚡','Corrente','corrente'],gelo:['❄️','Nevasca','nova'],
  terra:['🪨','Tremor','tremor'],ar:['🌪️','Rajada','investida'],sombra:['🌑','Sombra Veloz','teleporte'],luz:['✨','Brilho Curador','cura'],veneno:['☠️','Névoa Tóxica','nuvem']};
let TEC={},JOY={x:0,y:0};
function nomeDe(i,lv){return lv>=G.EVO_LV&&i<G.CH0?G.evName(i):G.name(i)}
function pausar(on){const R=RUN;if(!R||!R.r3||R.fim)return;R.pausaU=on;R.pausa=on;$('advPause').hidden=!on;TEC={};JOY.x=JOY.y=0;G.click(on?600:760)}
function aviso(t,ms){const a=$('advAviso');if(!a)return;a.textContent=t;a.classList.add('on');clearTimeout(aviso.t);aviso.t=setTimeout(()=>a.classList.remove('on'),ms||2600)}
function luta(){TELA='luta';msg('');const R=RUN,f=R.f,h=R.hero;$('advTitle').textContent=f.nome;
  const pw=(BFX[h.el]&&BFX[h.el].e[0])||'✨',E=ESPECIAIS[grupo(h.el)]||ESPECIAIS.terra;R.esp=E;R.espOk=h.lv>=(AR.especial_nivel||10);
  const cor=ECOL[h.el]||'#ffb23a';
  $('advBody').innerHTML='<div class="advscene a3d" id="advScene" style="--el:'+cor+'"><canvas id="advCv"></canvas><div class="advdano" id="advDano"></div>'+
    '<div class="advhud"><div class="advme"><span class="foto"><img src="'+G.sprite(R.i,h.lv)+'" alt=""><small>'+h.lv+'</small></span><div class="info"><b>'+nomeDe(R.i,h.lv)+'</b>'+
      '<div class="hp"><i id="advHpMe"></i><span id="advHpTxt"></span></div><div class="advobj"><span id="advObjE"></span><span class="advleaf" id="advLeaf"></span><span class="cav">'+caveiras(f)+'</span></div></div></div>'+
      '<div class="advdir"><canvas class="advmini" id="advMini" width="192" height="192"></canvas><button type="button" class="advpausa" id="advPausa" aria-label="Pausar">⏸</button></div></div>'+
    '<div class="advboss" id="advBoss" hidden><b>👑 '+(f.chefe?G.evName(f.chefe[0]):'')+' <small>Nv '+(f.chefe?f.chefe[1]:'')+'</small><span id="advHpBossTxt"></span></b><div class="hp"><i id="advHpBoss"></i></div></div>'+
    '<div class="advfx" id="advFx"></div><div class="advaviso" id="advAviso"></div><div class="advload" id="advLoad"><i></i>Entrando na floresta…</div>'+
    '<div class="advjoy" id="advJoy"><i id="advJoyK"></i></div>'+
    '<div class="advskills"><button type="button" data-k="A" class="atk">⚔️<span>Atacar</span></button>'+
    '<button type="button" data-k="P" class="pw">'+pw+'<span>Poder</span><em></em></button>'+
    '<button type="button" data-k="E" class="esp'+(R.espOk?'':' trava')+'">'+(R.espOk?E[0]:'🔒')+'<span>'+(R.espOk?E[1]:'Nv '+(AR.especial_nivel||10))+'</span><em></em></button>'+
    '<button type="button" data-k="D" class="dodge">💨<span>Esquivar</span><em></em></button></div>'+
    '<div class="advpause" id="advPause" hidden><h4>Pausado</h4><button type="button" id="advCont">▶ Continuar</button><button type="button" id="advSair" class="sec">Desistir da fase</button><small>Desistir conta como derrota.</small></div></div>';
  $('advPausa').addEventListener('click',()=>pausar(true));$('advCont').addEventListener('click',()=>pausar(false));
  $('advSair').addEventListener('click',()=>{const R=RUN;if(!R||R.fimPend)return;$('advPause').hidden=true;R.pausaU=false;R.pausa=false;R.fim=true;R.fimPend=1;terminar(false)});
  controles();folhas();iniciar3D().catch(e=>{console.warn('aventura 3d',e);aviso('Não deu para carregar a fase. Volte e tente de novo.',6000)})}

// ---- pernas andando no próprio modelo 3D (passo diagonal, a pata de apoio fica no chão) ----
function prepAndar(g,mini){const T=G.THREE(),inv=new T.Matrix4(),v=new T.Vector3();g.updateMatrixWorld(true);inv.copy(g.matrixWorld).invert();
  const ms=[],mn=new T.Vector3(1e9,1e9,1e9),mx=new T.Vector3(-1e9,-1e9,-1e9),low=[];
  g.traverse(o=>{if(!o.isMesh||!o.geometry||!o.geometry.attributes.position)return;const M=new T.Matrix4().multiplyMatrices(inv,o.matrixWorld),p=o.geometry.attributes.position;
    let lo=1e9;const st=Math.max(1,Math.floor(p.count/3000)),pts=[];for(let k=0;k<p.count;k+=st){v.fromBufferAttribute(p,k).applyMatrix4(M);mn.min(v);mx.max(v);if(v.y<lo)lo=v.y;pts.push(v.x,v.y,v.z)}
    ms.push({o,M,lo,pts})});
  const H=mx.y-mn.y||1,hip=mn.y+H*(mini?.2:.34);let sx=0,n=0;const zs=[];
  for(const m of ms)for(let k=0;k<m.pts.length;k+=3)if(m.pts[k+1]<mn.y+H*.12){sx+=m.pts[k];n++;zs.push(m.pts[k+2])}
  zs.sort((a,b)=>a-b);const zm=zs.length?zs[zs.length>>1]:(mn.z+mx.z)/2,av=a=>a.reduce((s,x)=>s+x,0)/Math.max(1,a.length);
  const U={uPh:{value:0},uAmp:{value:0},uHip:{value:hip},uMin:{value:mn.y},uXm:{value:n?sx/n:0},uZm:{value:zm},uDx:{value:(mx.x-mn.x)*.08},uDz:{value:(mx.z-mn.z)*.06},uH:{value:H}};
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
  x.fillStyle='#3f6b3a';x.fillRect(0,0,cw,ch);
  for(let k=0;k<cw*ch/60;k++){x.fillStyle=['#4a7a40','#36602f','#557f45','#3a6838','#2f5a2c'][k%5];const a=rnd()*cw,b=rnd()*ch;x.fillRect(a,b,1.5,3+rnd()*3)}
  const linha=(w,cor)=>{x.strokeStyle=cor;x.lineWidth=w/W*cw;x.lineCap='round';x.lineJoin='round';x.beginPath();M.caminho.forEach(([X,Z],k)=>k?x.lineTo(px(X),pz(Z)):x.moveTo(px(X),pz(Z)));x.stroke()};
  linha(4.8,'#4f6a38');linha(3.6,'#7a6446');linha(3.0,'#8f7452');linha(2.0,'#9c7f5a');
  for(let k=0;k<cw*ch/500;k++){const a=rnd()*cw,b=rnd()*ch;x.fillStyle='rgba(120,100,80,.35)';x.beginPath();x.arc(a,b,1+rnd()*2,0,7);x.fill()}
  if(M.arena){const a=M.arena;x.fillStyle='#8a6f4c';x.beginPath();x.ellipse(px(a.x),pz(a.z),a.r/W*cw,a.r/Lz*ch,0,0,7);x.fill();x.strokeStyle='#c9b4ff';x.lineWidth=3;x.setLineDash([8,8]);x.stroke();x.setLineDash([])}
  for(let k=0;k<cw*ch/1400;k++){const a=rnd()*cw,b=rnd()*ch,c=['#ffb3d1','#fff3c4','#c9b4ff','#ffffff'][k%4];for(let q=0;q<4;q++){x.fillStyle=c;x.beginPath();x.arc(a+Math.cos(q*1.57)*1.6,b+Math.sin(q*1.57)*1.6,1.3,0,7);x.fill()}x.fillStyle='#ffd23c';x.beginPath();x.arc(a,b,.9,0,7);x.fill()}
  const t=new T.CanvasTexture(c);t.encoding=T.sRGBEncoding;t.anisotropy=4;return t}
function semente(s){let a=s>>>0||1;return()=>{a=(a*1664525+1013904223)>>>0;return a/4294967296}}
function sprEmoji(e,tam,brilho){const T=G.THREE(),c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');
  if(brilho){const g=x.createRadialGradient(64,64,8,64,64,62);g.addColorStop(0,brilho);g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(0,0,128,128)}
  x.font='76px system-ui';x.textAlign='center';x.textBaseline='middle';x.fillText(e,64,70);const t=new T.CanvasTexture(c);t.encoding=T.sRGBEncoding;
  const s=new T.Sprite(new T.SpriteMaterial({map:t,transparent:true,depthWrite:false}));s.scale.set(tam,tam,tam);return s}
let SOMBRA=null;function sombra(r){const T=G.THREE();if(!SOMBRA){const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d'),g=x.createRadialGradient(32,32,2,32,32,31);
    g.addColorStop(0,'rgba(0,0,0,.45)');g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(0,0,64,64);SOMBRA=new T.CanvasTexture(c)}
  const m=new T.Mesh(new T.PlaneGeometry(r*2,r*2),new T.MeshBasicMaterial({map:SOMBRA,transparent:true,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.y=.02;return m}
function cenario(S,M){const T=G.THREE(),rnd=semente(M.comprimento*13+1);
  const chao=new T.Mesh(new T.PlaneGeometry(M.largura+24,M.comprimento+24),new T.MeshLambertMaterial({map:texChao(M)}));chao.rotation.x=-Math.PI/2;chao.position.set(0,0,M.comprimento/2);S.add(chao);
  const inst=(geo,mat,lista,f)=>{const im=new T.InstancedMesh(geo,mat,lista.length),o=new T.Object3D(),c=new T.Color();lista.forEach((q,k)=>{f(o,q,c);o.updateMatrix();im.setMatrixAt(k,o.matrix);im.setColorAt(k,c)});im.instanceMatrix.needsUpdate=true;if(im.instanceColor)im.instanceColor.needsUpdate=true;S.add(im);return im};
  const lam=()=>new T.MeshLambertMaterial({color:0xffffff});
  inst(new T.CylinderGeometry(.13,.2,1,6),lam(),M.arvores,(o,[x,z,s],c)=>{o.position.set(x,.75*s,z);o.scale.set(s,1.5*s,s);o.rotation.set(0,0,0);c.set('#6b4a32')});
  const cores=['#2e6b4a','#3a7d4e','#2a5e52','#4a8a4a','#365f3a'];
  inst(new T.IcosahedronGeometry(1,0),lam(),M.arvores,(o,[x,z,s],c)=>{o.position.set(x,1.9*s,z);o.scale.set(.95*s,1.05*s,.95*s);o.rotation.set(0,(x*7+z)%6,0);c.set(cores[Math.abs(Math.round(x*3+z))%5])});
  inst(new T.IcosahedronGeometry(1,0),lam(),M.arvores,(o,[x,z,s],c)=>{o.position.set(x,2.7*s,z);o.scale.set(.6*s,.7*s,.6*s);o.rotation.set(0,(x+z*5)%6,0);c.set(cores[Math.abs(Math.round(x+z*3))%5]).offsetHSL(0,0,.05)});
  inst(new T.DodecahedronGeometry(.5,0),lam(),M.pedras,(o,[x,z,s],c)=>{o.position.set(x,.2*s,z);o.scale.set(s,.65*s,s*1.1);o.rotation.set(0,(x*3+z)%6,0);c.set('#8a8a7e')});
  inst(new T.CylinderGeometry(.09,.12,1,6),lam(),M.cogumelos,(o,[x,z,s],c)=>{o.position.set(x,.3*s,z);o.scale.set(s,.6*s,s);o.rotation.set(0,0,0);c.set('#efe6d8')});
  inst(new T.SphereGeometry(.42,10,6,0,Math.PI*2,0,Math.PI/2),lam(),M.cogumelos,(o,[x,z,s],c)=>{o.position.set(x,.58*s,z);o.scale.set(s,.8*s,s);o.rotation.set(0,0,0);c.set(['#e86a8a','#b46ae8','#f2a04a'][Math.abs(Math.round(x+z))%3])});
  // sombras das árvores
  for(const [x,z,s] of M.arvores){if(z<-1||z>M.comprimento+1)continue;const sh=sombra(1.1*s);sh.position.set(x+.25,.015,z+.25);S.add(sh)}
  // morangos (moitas) e folhas douradas
  const itens=[];
  for(const [x,z] of M.morangos){const g=new T.Group(),b=new T.Mesh(new T.IcosahedronGeometry(.45,1),new T.MeshLambertMaterial({color:'#3f8a4a'}));b.position.y=.35;b.scale.y=.75;g.add(b);
    const f=sprEmoji('🍓',.6);f.position.y=.85;g.add(f);g.position.set(x,0,z);S.add(g);itens.push({t:'S',x,z,g,f})}
  for(const [x,z] of M.folhas){const g=new T.Group(),f=sprEmoji('🍃',.9,'rgba(255,220,90,.9)');f.position.y=1;g.add(f);g.position.set(x,0,z);S.add(g);itens.push({t:'L',x,z,g,f})}
  // portal
  const pg=new T.Group(),anel=new T.Mesh(new T.TorusGeometry(1.25,.13,10,40),new T.MeshBasicMaterial({color:'#ff9ac8'})),
    disco=new T.Mesh(new T.CircleGeometry(1.15,32),new T.MeshBasicMaterial({color:'#ffd0ea',transparent:true,opacity:.55,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide}));
  anel.position.y=1.45;disco.position.y=1.45;pg.add(anel,disco);const base=new T.Mesh(new T.CylinderGeometry(1.4,1.5,.15,24),new T.MeshLambertMaterial({color:'#6b5a7a'}));base.position.y=.07;pg.add(base);
  pg.position.set(M.portal[0],0,M.portal[1]);S.add(pg);
  // vagalumes
  const vg=[];for(let k=0;k<40;k++){const s=sprEmoji('✨',.25);s.position.set((rnd()-.5)*M.largura,1+rnd()*2.5,rnd()*M.comprimento);S.add(s);vg.push({s,y:s.position.y,f:rnd()*6})}
  // obstáculos para colisão
  const obs=[];for(const [x,z,s] of M.arvores)obs.push([x,z,.38*s]);for(const [x,z,s] of M.pedras)obs.push([x,z,.5*s]);for(const [x,z,s] of M.cogumelos)obs.push([x,z,.3*s]);
  return{itens,portal:{g:pg,anel,disco},vg,obs}}

// ---- montar a fase ----
async function iniciar3D(){const R=RUN,f=R.f,M=f.mapa3d,T=G.THREE();if(!T||!M)throw new Error('sem 3d');
  const cv=$('advCv'),rd=new T.WebGLRenderer({canvas:cv,antialias:true,powerPreference:'high-performance'});rd.setPixelRatio(Math.min(window.devicePixelRatio||1,2));rd.outputEncoding=T.sRGBEncoding;
  const S=new T.Scene();S.background=new T.Color('#2c3a52');S.fog=new T.Fog('#2c3a52',26,52);
  S.add(new T.HemisphereLight(0xfff2e0,0x2f4a32,1.05));const sol=new T.DirectionalLight(0xffe2c4,.95);sol.position.set(6,12,-5);S.add(sol);
  const cam=new T.PerspectiveCamera(42,1,.1,120);R.r3={rd,S,cam,T};R.w={M,...cenario(S,M),ents:[],tiros:[],efeitos:[],nums:[]};
  // modelos: o bichinho e um de cada tipo de inimigo (cada inimigo é uma cópia)
  const heroEvo=R.i<G.CH0&&R.hero.lv>=G.EVO_LV;
  const hg=await G.modelo(R.i,heroEvo);if(RUN!==R)return;const Hs=redondo(R.i)?(AR.tam_redondo||.95):(AR.tam_heroi||1.3)*(R.i>=LEG0?1.12:1);hg.scale.setScalar(Hs);
  const hU=prepAndar(hg,redondo(R.i));const hroot=new T.Group();hroot.add(hg);hroot.add(sombra(.6*Hs));S.add(hroot);
  R.p={g:hroot,m:hg,U:hU,x:M.inicio[0],z:M.inicio[1],ang:0,r:.42*Hs,inv:0,cd:{A:0,P:0,E:0,D:0},dash:0,dx:0,dz:0,venceu:0,morto:0,lunge:0,raiz:0};
  for(const c of M.acampamentos)for(const [j,lv,x,z,tp] of c.inimigos)R.w.ents.push(await novoInimigo(j,lv,x,z,c,false,tp));R.total=R.w.ents.length+(f.chefe&&M.arena?1:0);
  if(f.chefe&&M.arena){const b=await novoInimigo(f.chefe[0],f.chefe[1],M.arena.x,M.arena.z+2,{x:M.arena.x,z:M.arena.z},true);R.w.ents.push(b);R.w.boss=b}
  if(RUN!==R)return;
  R.t=0;R.cam=null;tamanho3D();hud();const ld=$('advLoad');if(ld)ld.hidden=true;
  aviso(f.chefe?'Atravesse a floresta e derrote o chefão!':'Siga o caminho até o portal ✨ · 3 folhas douradas escondidas',3200);
  R.last=performance.now();R.acc=0;R.raf=requestAnimationFrame(passo)}
async function novoInimigo(j,lv,x,z,camp,chefe,tipo){const R=RUN,T=G.THREE(),L_=lutador(j,lv,{chefe}),Tp=(tipo&&TP[tipo])||{};const k=(chefe?(AR.chefe_vida||1.6):(AR.inimigo_vida||.45))*(Tp.vida||1);L_.hp=L_.max=Math.max(10,Math.round(L_.hp*k));
  if(Tp.dano)L_.atk*=Tp.dano;const esc=Tp.escudo?Math.round(L_.max*Tp.escudo):0;
  const g=await G.modelo(j,chefe),s=(chefe?(AR.tam_chefe||3):redondo(j)?(AR.tam_redondo_inimigo||.8):(AR.tam_inimigo||1.1))*(Tp.tamanho||1);g.scale.setScalar(s);
  const U=prepAndar(g,redondo(j)),root=new T.Group();root.add(g);root.add(sombra(.55*s));root.position.set(x,0,z);R.r3.S.add(root);
  const bar=document.createElement('div');bar.className='advebar'+(chefe?' chefe':'')+(tipo?' '+tipo:'');bar.innerHTML='<small class="'+corNv(lv,R.hero.lv)+'">'+(Tp.icone?Tp.icone+' ':'')+'Nv '+lv+'</small>'+(esc?'<i class="esc"><b></b></i>':'')+'<i><b></b></i>';bar.hidden=true;$('advFx').appendChild(bar);
  if(tipo==='elite'){const a=new T.Mesh(new T.RingGeometry(.55*s,.68*s,32),new T.MeshBasicMaterial({color:'#7ad0ff',transparent:true,opacity:.7,depthWrite:false,side:T.DoubleSide}));a.rotation.x=-Math.PI/2;a.position.y=.04;root.add(a)}
  if(tipo==='curandeiro'){const a=sprEmoji('💚',.45);a.position.y=1.55*s;root.add(a)}
  return Object.assign(L_,{j,lv,g:root,m:g,U,x,z,cx:camp.x,cz:camp.z,ang:Math.PI,r:(chefe?.95:.4)*s/1.1,s,chefe:!!chefe,vivo:true,estado:'parado',t:0,cdA:1+Math.random(),cdT:2+Math.random()*2,
    aviso:0,lento:0,preso:0,veneno:0,morre:0,bar,nome:chefe?G.evName(j):G.name(j),tipo:tipo||'',Tp,esc,escMax:esc,longe:tipo==='atirador'||tipo==='curandeiro',cdC:2+Math.random()*2,
    pancada:chefe?{r:2.6,av:.9,m:1.5,rec:2}:tipo==='elite'?{r:Tp.pancada_raio||1.9,av:Tp.pancada_aviso||.75,m:1.2,rec:Tp.recarga||2.2}:null,ph:Math.random()*6})}
function tamanho3D(){const R=RUN;if(!R||!R.r3)return;const cv=$('advCv'),r=cv.getBoundingClientRect();R.r3.rd.setSize(r.width,r.height,false);R.r3.cam.aspect=r.width/Math.max(1,r.height);R.r3.cam.updateProjectionMatrix()}
window.addEventListener('resize',()=>{if(RUN&&TELA==='luta'&&RUN.r3)tamanho3D()});
function limpa3D(){const R=RUN;if(!R||!R.r3)return;cancelAnimationFrame(R.raf);try{R.r3.rd.dispose();R.r3.rd.forceContextLoss()}catch(e){}R.r3=null}

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
  else p.U.uAmp.value=Math.max(0,p.U.uAmp.value-dt*3);
  // habilidades
  if(TEC.Ap||(TEC.A&&p.cd.A<=0)){TEC.Ap=false;if(p.cd.A<=0)ataque()}
  if(TEC.Pp){TEC.Pp=false;if(p.cd.P<=0)poder()}
  if(TEC.Ep){TEC.Ep=false;if(!R.espOk)aviso('O especial libera no Nv '+(AR.especial_nivel||10)+' 🔒',1500);else if(p.cd.E<=0)especial()}
  if(TEC.Dp){TEC.Dp=false;if(p.cd.D<=0){p.cd.D=AR.esquiva_recarga||1.2;p.inv=Math.max(p.inv,AR.invencivel||.35);p.dash=.2;
    const a=jm>.12?Math.atan2(-jx,-jy):p.ang;p.dx=Math.sin(a);p.dz=Math.cos(a);G.tone(700,.06,'triangle',.05)}}
  p.lunge=Math.max(0,p.lunge-dt);
  // itens
  for(const it of w.itens){if(it.ok)continue;it.f.position.y=(it.t==='L'?1:.85)+Math.sin(R.t*3+it.x)*.12;if(Math.hypot(it.x-p.x,it.z-p.z)<1){it.ok=true;it.g.visible=false;
    if(it.t==='L'){R.leaves++;folhas();G.tone(988,.12,'triangle',.08);setTimeout(()=>G.tone(1318,.14,'triangle',.08),90);aviso('Folha dourada! '+R.leaves+' de 3',1400);faisca(it.x,1,it.z,'#ffd23c',14)}
    else{const c=Math.min(R.hero.max-R.hero.hp,Math.round(R.hero.max*(AR.morango_cura||.3)));R.hero.hp+=c;num(it.x,1.2,it.z,c>0?'+'+c+' ❤':'🍓','#9dff8a');G.tone(660,.1,'sine',.08);hud()}}}
  // portal
  const pt=w.portal,fech=w.boss&&w.boss.vivo,M=w.M;pt.anel.material.color.set(fech?'#7a6a9a':'#ff9ac8');pt.disco.material.opacity=fech?.15:.45+Math.sin(R.t*4)*.15;pt.anel.rotation.z+=dt*(fech?.3:1.5);
  if(!fech&&Math.hypot(p.x-M.portal[0],p.z-M.portal[1])<1.4){p.venceu=.001;G.fanfare();return}
  if(fech&&Math.hypot(p.x-M.portal[0],p.z-M.portal[1])<2.2&&!R.avisoPortal){R.avisoPortal=1;aviso('O portal só abre depois de derrotar o chefão!',2200);setTimeout(()=>{if(RUN===R)R.avisoPortal=0},3000)}
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
function ataque(){const R=RUN,p=R.p;p.cd.A=AR.ataque_recarga||.45;mira(3.2);p.lunge=.18;G.tone(330,.06,'square',.05);
  const fx=Math.sin(p.ang),fz=Math.cos(p.ang),al=(AR.ataque_alcance||1.6);let acertou=0;
  for(const e of R.w.ents){if(!e.vivo)continue;const dx=e.x-p.x,dz=e.z-p.z,d=Math.hypot(dx,dz);if(d-e.r>al)continue;if(d>.2&&(dx*fx+dz*fz)/d<.15)continue;golpeia(e,1,'ataque');acertou=1}
  arco(p.x+fx*.9,p.z+fz*.9,p.ang,acertou?'#ffffff':'#d8e8ff')}
function poder(){const R=RUN,p=R.p;p.cd.P=AR.poder_recarga||2.2;const e=mira(AR.poder_alcance||9),F=BFX[R.hero.el]||{e:['✨'],c:'#fff'};
  const a=p.ang,s=sprEmoji(F.e[0],.85,F.c);s.position.set(p.x,1,p.z);R.r3.S.add(s);const v=AR.poder_vel||11;
  R.w.tiros.push({s,x:p.x+Math.sin(a)*.6,y:1,z:p.z+Math.cos(a)*.6,vx:Math.sin(a)*v,vz:Math.cos(a)*v,d:0,alc:AR.poder_alcance||9,meu:1,mult:LT.poder,c:F.c});G.tone(440,.1,'triangle',.07)}
function especial(){const R=RUN,p=R.p,tipo=R.esp[2],F=BFX[R.hero.el]||{c:'#fff'},cor=F.c||'#fff';p.cd.E=AR.especial_recarga||7;G.tone(220,.25,'sawtooth',.06);aviso(R.esp[0]+' '+R.esp[1]+'!',900);
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
  if(e.estado!=='caca'&&d<(e.chefe?11:DF('aggro',7))&&!p.morto){e.estado='caca';if(e.chefe){$('advBoss').hidden=false;aviso('👑 O chefão apareceu!',2000);G.tone(140,.5,'sawtooth',.07)}
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
        if(fe.length){e.cdC=e.Tp.recarga||4.5;anel(e.x,e.z,e.Tp.raio||5.5,'#7dff9a',.6);G.tone(880,.12,'sine',.05);
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
  else e.U.uAmp.value=Math.max(0,e.U.uAmp.value-dt*3)}
function golpeDele(e){const R=RUN,p=R.p,d=dist(e,p),k=DF('contato',1);
  if(e.pancada){const P=e.pancada;if(d<P.r+p.r&&p.inv<=0)machuca(Math.round(dano(e,R.hero,P.m).d*k),p.x-e.x,p.z-e.z);faisca(e.x,.3,e.z,'#ffb070',e.chefe?16:10);if(R.r3)R.tremor=e.chefe?.35:.2;return}
  e.lunge=.2;if(d<e.r+p.r+.9&&p.inv<=0)machuca(Math.round(dano(e,R.hero,1).d*k),p.x-e.x,p.z-e.z)}
function atira(e,a,mult){const R=RUN,F=BFX[e.el]||{e:['💥'],c:'#fff'},s=sprEmoji(F.e[0],e.chefe?1.1:.7,F.c);s.position.set(e.x,1,e.z);R.r3.S.add(s);const v=e.chefe?7:DF('tiro_vel',6.5);
  R.w.tiros.push({s,x:e.x,y:e.chefe?1.4:1,z:e.z,vx:Math.sin(a)*v,vz:Math.cos(a)*v,d:0,alc:e.chefe?13:9,meu:0,mult:mult||1,c:F.c,dono:e})}
function rajada(e){const a=e.ang;for(let k=-2;k<=2;k++)atira(e,a+k*.28,.9);G.tone(180,.2,'sawtooth',.05)}
function golpeia(e,mult,como){const R=RUN,r=dano(R.hero,e,mult);let dd=r.d;e.pisca=.2;if(e.estado==='parado'||e.estado==='volta')e.estado='caca';
  let ab=0;if(e.esc>0){ab=Math.min(e.esc,Math.round(dd*(como==='poder'||como==='especial'?.6:1)));e.esc-=ab;dd=Math.max(0,dd-ab);
    if(e.esc<=0){aviso('🛡️ Escudo quebrado!',1100);faisca(e.x,1,e.z,'#7ad0ff',14);G.tone(520,.12,'square',.05)}}
  e.hp-=dd;if(como!=='veneno'||dd)num(e.x,1.4*(e.chefe?2:1),e.z,'-'+(dd||ab)+(r.crit?'!':''),dd?(r.crit?'#ffe04a':(r.em>1?'#ffb070':'#ffffff')):'#7ad0ff');
  if(como!=='veneno')G.tone(como==='ataque'?380:300,.06,'square',.05);if(r.em>1&&como!=='veneno'&&!R.avisoEf){R.avisoEf=1;aviso('Super eficaz! 💪',900);setTimeout(()=>{if(RUN===R)R.avisoEf=0},2500)}
  if(e.hp<=0){e.vivo=false;e.bar.remove();R.mortos=(R.mortos||0)+1;hud();faisca(e.x,.8,e.z,ECOL[e.el]||'#fff',e.chefe?30:14);G.tone(660,.1,'triangle',.07);
    if(e.chefe){aviso('Você derrotou o chefão! O portal abriu ✨',3000);G.fanfare();$('advBoss').hidden=true}}
  if(e.chefe)hud()}
function machuca(d,dx,dz){const R=RUN,p=R.p;if(p.inv>0||p.morto)return;R.hero.hp-=d;p.inv=AR.invencivel_dano||.6;const n=Math.hypot(dx,dz)||1;mover(p,dx/n*.6,dz/n*.6);
  num(p.x,1.5,p.z,'-'+d,'#ff8a8a');G.tone(180,.14,'sawtooth',.06);R.tremor=Math.max(R.tremor||0,.18);
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
  let res={first:false,stone:-1,coins:0,diam:0,ovo:-1,xp:win?D.xp.vitoria:D.xp.derrota,erro:''};
  if(G.online()){const r=await G.sync('adv_end',{stage:id,win,stars:Math.max(1,st)});
    if(r&&!r.error&&typeof r.coins==='number'){res.coins=r.coins-G.coins();G.setCoins(r.coins);G.xpSet(R.i,r.xp);res.first=!!r.first;res.stone=r.stone;res.diam=r.diamonds_got|0;res.ovo=typeof r.egg_leg==='number'?r.egg_leg:-1;if(window.GARRO_LEND)window.GARRO_LEND.servidor(r);if(win)S.prog[id]=Math.max(S.prog[id]||0,Math.max(1,st));if(r.stone>=0)G.stoneLocal(r.stone)}
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
  resultado(win,st,res)}
function resultado(win,st,res){const R=RUN,f=R.f,tem=FASES[R.k+1];if(win)G.fanfare();else G.tone(196,.4,'sawtooth',.07);
  let h='<div class="advres '+(win?'win':'lose')+'"><h4>'+(win?'Vitória! 🏆':'Derrota 💔')+'</h4>';
  if(win)h+='<div class="advstars">'+estrelas(st)+'</div><small class="advst">'+st+' de 3 folhas douradas 🍃</small>';
  h+='<ul>';if(res.erro)h+='<li>'+res.erro+'</li>';
  if(res.erro){}else if(win&&res.first&&res.coins>0)h+='<li>+'+res.coins+' 🪙 <small>(1ª vitória nesta fase)</small></li>';else if(win&&!R.f.desafio)h+='<li><small>Fase já vencida antes: sem moedas desta vez</small></li>';
  if(!res.erro)h+='<li>+'+res.xp+' XP para '+G.name(R.i)+'</li>';
  if(res.diam>0)h+='<li class="pedra">💎 +'+res.diam+' diamante'+(res.diam>1?'s':'')+' raro'+(res.diam>1?'s':'')+'! <small>(use no Ninho)</small></li>';
  if(res.ovo>=0&&window.GARRO_LEND){const x=window.GARRO_LEND.lendarios[res.ovo];h+='<li class="pedra"><img src="img/lendarios/ovo_'+x.slug+'.webp" alt=""> Ovo de <b>'+x.nome+'</b>! Foi para o 🥚 Ninho</li>'}
  if(res.stone>=0){const s=G.stone(res.stone);h+='<li class="pedra">'+(s&&s.img?'<img src="'+s.img+'" alt="">':'💎')+' O chefão deixou cair: <b>'+(s?s.name:'pedra')+'</b>!</li>'}
  if(!win)h+='<li><small>Dica: quando o inimigo tremer ou aparecer um círculo vermelho no chão, use 💨 Esquivar. Derrote primeiro o curandeiro 💚, use o Poder de longe e pegue morangos 🍓. Bichinho com nível maior aguenta mais.</small></li>';
  h+='</ul><div class="advresb">'+(win&&tem?'<button type="button" data-r="prox">Próxima fase ›</button>':'')+'<button type="button" data-r="de-novo">'+(win?'Jogar de novo':'Tentar de novo')+'</button><button type="button" data-r="mapa" class="sec">Mapa</button></div></div>';
  const d=document.createElement('div');d.innerHTML=h;$('advScene').appendChild(d.firstChild);moedas()}

window.GARRO_AVENTURA={FASES,lutador,dano,elemMult,energia,liberada,box,recomendado,nivelMin,run:()=>RUN,tec:(k,v)=>{if(v&&!TEC[k])TEC[k+'p']=true;TEC[k]=v},joy:(x,y)=>{JOY.x=x;JOY.y=y},sim:(n,bot)=>{for(let k=0;k<n&&RUN&&RUN.p&&!RUN.fim;k++){if(bot)bot();fisica(1/60)}if(RUN&&RUN.p)desenha()}};// usado nos testes
setTimeout(carregarServidor,3000);
})();
