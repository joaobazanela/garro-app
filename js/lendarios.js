/* GARRO — Lendários: ovos, ninho (carinho para chocar), máquina de ovos, diamantes 💎 e loja de ovos.
   Conteúdo (nomes, artes, preços, chances, dias mínimo/máximo, dicas) vem de data/lendarios.json (window.GD.lendarios).
   Logado: o servidor decide tudo (ovo verdadeiro, dias secretos para chocar, diamantes) — tabelas legendary_eggs e
   player_state.diamonds (migração 0010). Sem login: fica no aparelho. Modo dev: diamantes infinitos. */
(function(){
const G=window.GARRO,D=(window.GD||{}).lendarios;
if(!G||!D||!D.lendarios)return;
const $=id=>document.getElementById(id);
const LS=D.lendarios,CH=D.chocar,MQ=D.maquina,LJ=D.loja,DM=D.diamantes||{};
const KEY='garro-lendarios';
const leg=k=>LS[k],porId=i=>LS[i-G.LEG0];
const hoje=()=>new Date(Date.now()-3*3600e3).toISOString().slice(0,10);// dia de Brasília (igual ao servidor)
// lendário do dia (Desafio Lendário na Aventura): igual à sync-estado
function legDoDia(){return Math.floor(Date.parse(hoje()+'T00:00:00Z')/864e5)%LS.length}

// ---------- estado: diamantes e ovos ----------
let L={diam:0,ovos:[],seq:0};try{const o=JSON.parse(localStorage.getItem(KEY)||'');if(o&&Array.isArray(o.ovos))L=Object.assign(L,o)}catch(e){}
function saveL(){try{localStorage.setItem(KEY,JSON.stringify(L))}catch(e){}}
let S=null;// logado: vindo do servidor
const box=()=>G.online()&&S?S:L;
const dev=()=>G.dev();
function diam(){return dev()?Infinity:box().diam}
async function carregar(){
  if(!G.online()){S=null;tudo();return}
  try{const sb=G.sb();
    const [{data:ps},{data:ov}]=await Promise.all([sb.from('player_state').select('diamonds').single(),
      sb.from('legendary_eggs').select('id,leg,days,last_day,hint,source,created_at,hatched_at').order('id')]);
    S={diam:ps&&typeof ps.diamonds==='number'?ps.diamonds:0,ovos:(ov||[]).map(r=>({id:r.id,leg:r.leg,days:r.days,last:r.last_day,hint:r.hint,src:r.source,nasceu:!!r.hatched_at}))};
  }catch(e){console.warn('lendarios',e)}
  tudo()}
function tudo(){chip();estante();if(!$('ninho').hidden)ninho()}

// ---------- HUD: diamantes ----------
const hud=document.querySelector('.hud');
if(hud&&!$('btnNinho')){const b=document.createElement('button');b.className='chip shopbtn diam';b.id='btnNinho';b.type='button';b.innerHTML='<span>Ninho</span><b id="diamN">0</b>';hud.appendChild(b);hud.classList.add('com-lend');b.addEventListener('click',()=>abrirNinho())}
function chip(){const d=diam();const e=$('diamN');if(e)e.textContent=d===Infinity?'∞💎':d+'💎'}

// ---------- coleção: seção dos lendários ----------
const grid=$('grid');let sec=$('legSec');
if(grid&&!sec){sec=document.createElement('div');sec.id='legSec';sec.className='legsec';grid.parentNode.insertBefore(sec,grid.nextSibling)}
function estante(){if(!sec)return;const coll=G.coll(),ovos=box().ovos.filter(o=>!o.nasceu);let got=0;
  let h='<div class="leghead"><h3>✦ Lendários <small>'+LS.filter(x=>coll[x.id]>0).length+' de '+LS.length+'</small></h3><button type="button" id="legNinho">🥚 Ninho'+(ovos.length?' <b>'+ovos.length+'</b>':'')+'</button></div><div class="leggrid">';
  for(const x of LS){const n=coll[x.id]||0;if(n)got++;
    h+='<button type="button" class="legslot'+(n?'':' lock')+'" data-i="'+x.id+'"><img src="'+(n?G.plush(x.id).img:'img/lendarios/ovo_'+x.slug+'.webp')+'" alt=""><span>'+(n?x.nome:'???')+'</span>'+(n?'<u>NV '+G.lvOf(x.id)+'</u>':'')+'</button>'}
  sec.innerHTML=h+'</div>';
  $('legNinho').addEventListener('click',()=>abrirNinho());
  sec.querySelectorAll('.legslot').forEach(b=>b.addEventListener('click',()=>{const i=+b.dataset.i;if(G.coll()[i]>0)G.abrir(i);else abrirNinho('loja')}))}
window.addEventListener('garro:estante',estante);

// ---------- ninho (ovos) e loja de ovos ----------
const pan=document.createElement('div');pan.className='shop ninho';pan.id='ninho';pan.hidden=true;
pan.innerHTML='<h3>🥚 Ninho</h3><div class="shopcoins">Seus diamantes: <b id="nDiam">0</b> 💎<div id="nMsg" class="nmsg"></div></div><div class="shopscroll" id="nBody"></div><button class="shclose" id="nClose" type="button">Voltar</button>';
document.body.appendChild(pan);
$('nClose').addEventListener('click',()=>{pan.hidden=true;document.body.style.overflow=''});
function abrirNinho(foco){G.click(640);msg('');pan.hidden=false;document.body.style.overflow='hidden';ninho();if(G.online())carregar();
  if(foco==='loja')setTimeout(()=>{const l=$('nLoja');if(l)l.scrollIntoView({block:'start'})},30)}
function msg(t,ok){const m=$('nMsg');if(m){m.textContent=t||'';m.classList.toggle('ok',!!ok)}}
function dica(o){return (CH.dicas||[])[Math.max(0,Math.min(3,o.hint|0))]||''}
function ninho(){const B=box(),d=diam();$('nDiam').textContent=d===Infinity?'∞':d;
  const ovos=B.ovos.filter(o=>!o.nasceu),hj=hoje();
  let h='<div class="shsec">Seus ovos <small>· dê carinho 1 vez por dia; cada ovo tem um tempo secreto para chocar</small></div>';
  if(!ovos.length)h+='<p class="shnote">Você ainda não tem ovos. Tente a 🥚 Máquina de Ovos, o 👑 Desafio Lendário da Aventura ou compre na loja abaixo.</p>';
  h+='<div class="ninhovos">'+ovos.map(o=>{const x=leg(o.leg),feito=o.last===hj;
    return '<div class="ovo h'+(o.hint|0)+'"><img src="img/lendarios/ovo_'+x.slug+'.webp" alt=""><b>Ovo de '+x.nome+'</b><small>'+o.days+' dia'+(o.days===1?'':'s')+' de carinho</small><small class="dica">'+dica(o)+'</small>'+
      '<button type="button" data-ovo="'+o.id+'"'+(feito?' disabled':'')+'>'+(feito?'✓ Carinho de hoje feito':'🤍 Dar carinho')+'</button>'+(dev()&&!G.online()?'<button type="button" class="dev" data-pula="'+o.id+'">⏩ dev: pular 1 dia</button>':'')+'</div>'}).join('')+'</div>';
  h+='<div class="shsec" id="nLoja">Loja de ovos <small>· '+LJ.preco_ovo_diamantes+' 💎 cada</small></div><div class="lojaovos">'+LS.map((x,k)=>'<button type="button" class="lovo" data-compra="'+k+'"'+(d<LJ.preco_ovo_diamantes?' disabled':'')+'><img src="img/lendarios/ovo_'+x.slug+'.webp" alt=""><b>'+x.nome+'</b><i>'+LJ.preco_ovo_diamantes+' 💎</i></button>').join('')+'</div>';
  h+='<p class="shnote"><b>Como ganhar 💎 (raros):</b> '+DM.chefe_do_mundo+' 💎 na 1ª vitória contra o chefão de cada mundo da Aventura · '+DM.mundo_3_estrelas+' 💎 com 3 estrelas em todas as fases de um mundo · 1% de chance a cada pelúcia gigante pega.</p>';
  $('nBody').innerHTML=h}
$('nBody').addEventListener('click',e=>{const c=e.target.closest('[data-ovo]');if(c){carinho(+c.dataset.ovo,c);return}
  const p=e.target.closest('[data-pula]');if(p){const o=L.ovos.find(x=>x.id===+p.dataset.pula);if(o){o.last=null;saveL();ninho()}return}
  const b=e.target.closest('[data-compra]');if(b)comprar(+b.dataset.compra,b)});

async function carinho(id,btn){const B=box(),o=B.ovos.find(x=>x.id===id);if(!o||o.nasceu)return;btn.disabled=true;G.tone(880,.12,'sine',.06);
  if(G.online()){const r=await G.sync('egg_care',{eggId:id});
    if(!r||r.error||typeof r.days!=='number'){msg('Não deu para dar carinho agora. Tente de novo.');btn.disabled=false;return}
    o.days=r.days;o.hint=r.hint;o.last=hoje();if(r.hatched){o.nasceu=true;G.collSet(r.nasceu,(G.coll()[r.nasceu]||0)+1);if(typeof r.xp==='number')G.xpSet(r.nasceu,r.xp);nascer(o.leg)}
    else msg(r.counted?'🤍 Carinho de hoje dado! '+dica(o):'Você já deu carinho hoje. Volte amanhã!',r.counted)}
  else{if(o.last!==hoje()){o.days++;o.last=hoje()}o.hint=Math.min(3,Math.floor(o.days*4/o.need));
    if(o.days>=o.need){o.nasceu=true;const i=G.LEG0+o.leg;G.collAdd(i,1);G.xpSet(i,Math.max(0,(CH.nivel_ao_nascer-1)*4));nascer(o.leg)}else msg('🤍 Carinho de hoje dado! '+dica(o),true);saveL()}
  G.evento('pet');tudo()}

// ovo novo (máquina, desafio, loja). Sem login sorteia aqui os dias secretos.
function ovoLocal(k,src){const need=CH.dias_min+Math.floor(Math.random()*(CH.dias_max-CH.dias_min+1));L.ovos.push({id:++L.seq,leg:k,need,days:0,last:null,hint:0,src});saveL()}
async function comprar(k,btn){const p=LJ.preco_ovo_diamantes,x=leg(k);if(diam()<p){msg('Faltam diamantes ('+p+' 💎).');return}btn.disabled=true;
  if(G.online()){const r=await G.sync('egg_buy',{leg:k});if(!r||r.error||typeof r.diamonds!=='number'){msg('Não deu para comprar agora. Tente de novo.');btn.disabled=false;return}S.diam=r.diamonds;await carregar()}
  else{if(!dev())L.diam-=p;ovoLocal(k,'loja')}
  G.fanfare();msg('🥚 Ovo de '+x.nome+' foi para o ninho!',true);tudo()}

// ---------- nasceu! (a arte da carta do lendário) ----------
function nascer(k){const x=leg(k),i=G.LEG0+k;G.fanfare();setTimeout(()=>G.fanfare(),700);
  const d=document.createElement('div');d.className='nasceu';
  d.innerHTML='<div class="ncarta"><img src="img/lendarios/carta_'+x.slug+'.webp" alt=""><div class="nbrilho"></div></div><h4>Nasceu!</h4><b>✦ '+x.nome+'</b><small>'+x.desc+'</small><small>Nv '+CH.nivel_ao_nascer+' · já está na sua coleção</small><div><button type="button" data-v="3d">Ver em 3D ✨</button><button type="button" class="sec" data-v="ok">Fechar</button></div>';
  document.body.appendChild(d);d.addEventListener('click',e=>{const b=e.target.closest('[data-v]');if(!b)return;d.remove();if(b.dataset.v==='3d'){pan.hidden=true;document.body.style.overflow='';G.abrir(i)}});
  G.estante()}

// ---------- máquina de ovos: o servidor decide se o ovo pego é verdadeiro ----------
window.addEventListener('garro:ovo',async e=>{const k=e.detail.leg,x=leg(k);if(!x)return;
  let real=false;
  if(G.online()){const r=await G.sync('egg_capture',{leg:k});if(!r||r.error){G.banner('Ops!','Não deu para abrir o ovo. Tente de novo.');return}
    G.setCoins(r.coins);real=!!r.real_egg;if(real)await carregar()}
  else{real=Math.random()<MQ.chance_ovo;if(real)ovoLocal(k,'maquina');else G.addCoinsLocal(MQ.ovo_falso_moedas)}
  if(real){G.banner('🥚 OVO VERDADEIRO!','Ovo de '+x.nome+' foi para o Ninho!',true);G.fanfare();setTimeout(()=>G.fanfare(),600);setTimeout(()=>abrirNinho(),1400)}
  else{G.banner('Ovo falso... 🐣','Era só casca! +'+MQ.ovo_falso_moedas+' 🪙');G.tone(300,.15,'triangle',.06)}
  tudo()});

// ---------- 💎 raro na máquina gigante ----------
window.addEventListener('garro:gigante',e=>{const r=e.detail||{};
  if(r.local){if(!dev()&&Math.random()<(DM.gigante_chance||0)){L.diam++;saveL();ganhou(1)}return}
  if(typeof r.diamonds==='number'&&S){S.diam=r.diamonds;if(r.diamond)ganhou(1)}chip()});
function ganhou(n){setTimeout(()=>{G.banner('💎 Diamante raro!','+'+n+' diamante'+(n>1?'s':'')+' · use no Ninho',true);G.fanfare()},1600);chip()}

// interface para a Aventura (js/aventura.js): lendário do dia, prêmios do servidor e prêmios sem login
window.GARRO_LEND={legDoDia,porId,lendarios:LS,
  servidor:r=>{if(!S)return;if(typeof r.diamonds==='number')S.diam=r.diamonds;if(r.diamonds_got>0)ganhou(r.diamonds_got);if(r.egg_leg>=0)carregar();else chip()},
  local:(diamantes,ovoLeg)=>{if(diamantes>0){L.diam+=diamantes;ganhou(diamantes)}if(ovoLeg>=0)ovoLocal(ovoLeg,'desafio');saveL();tudo()},
  premio:(award)=>{L.premios=L.premios||{};if(L.premios[award])return false;L.premios[award]=1;saveL();return true},
  sorteioHoje:()=>{if(L.sorteio===hoje())return false;L.sorteio=hoje();saveL();return true},
  abrirNinho};
setTimeout(carregar,3200);tudo();
})();
