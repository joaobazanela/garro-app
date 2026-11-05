/* GARRO — cuidados, evolução (pedras e renascimento), loja e inventário. Parte 6 de 8 do antigo js/garro.js: os arquivos são carregados em ordem (js/garro/*.js) e dividem o mesmo escopo global. */
/* ---------- cuidados: comida, carinho e brincar até evoluir ---------- */
const CARE_KEY='garro-care';
let CARE={};try{CARE=JSON.parse(localStorage.getItem(CARE_KEY)||'{}')||{}}catch(e){CARE={}}
function saveCare(){try{localStorage.setItem(CARE_KEY,JSON.stringify(CARE))}catch(e){}}
const DECAY=GD.regras.DECAY;// pontos por minuto
const XPG=GD.regras.XPG;
// cuidar dá no máximo CUIDAR_XP_DIA de XP por bichinho por dia (data/regras.json); o dia é o de Brasília
const XPDIA=GD.regras.CUIDAR_XP_DIA||30,diaHoje=()=>new Date(Date.now()-3*3600e3).toISOString().slice(0,10),xpHoje=i=>{const c=careOf(i);return c.xd===diaHoje()?(c.xh|0):0};
// the first 20 plushes keep their painted look: they only grow a bit; the 15 round ones also change shape and color
const GROW=GD.regras.GROW;
// regras da evolução (data/regras.json → EVOLUCAO): no Nv 100, com 5 pedras do grupo, evolui e continua no Nv 100; no Nv 100 renasce (volta ao 1, +10% de força)
const EVO=Object.assign({nivel:100,pedras:5,renascer_nivel:100,bonus_por_renascimento:.1},GD.regras.EVOLUCAO||{});
const EVO_LV=EVO.nivel,PEDRAS=EVO.pedras,REB_B=EVO.bonus_por_renascimento;
// força por classe (data/regras.json → FORCA): a classe pesa mais que o nível
const FORCA=Object.assign({redondo:19,grande:40,lendario:90,epico:400,gigante:1.2,gigante_evoluido:1.35,evoluido:1.35,nivel_max_bonus:.5},GD.regras.FORCA||{});
const classeDe=i=>isEpic(i)?'epico':isLeg(i)?'lendario':i<CH0?'grande':'redondo',MEDIA_CL={};
// ataque e defesa no nível 1: os grandes são bem mais fortes que os redondos (cada um tem seu jeito)
const STAT=GD.pelucias.STAT;
// curva de níveis (data/regras.json → NIVEL): XP total para o nível N = linear×(N−1) + cubo×(N−1)³ (como as curvas cúbicas do Pokémon)
const NV=GD.regras.NIVEL||{grande:{max:100,linear:10,cubo:.03},redondo:{max:100,linear:12,cubo:.03}},nvP=i=>grande(i)?NV.grande:NV.redondo;
const capOf=i=>nvP(i).max;
function xpTotal(i,L){const p=nvP(i),n=Math.max(0,Math.min(L,capOf(i))-1);return p.linear*n+Math.round(Math.round(p.cubo*1000)*n*n*n/1000)}
function lvFromXp(i,xp){const cap=capOf(i);let L=1;while(L<cap&&xpTotal(i,L+1)<=xp)L++;return L}
function lvOf(i){return lvFromXp(i,careOf(i).xp)}
// XP salvo no aparelho na escala antiga (4 ou 5 XP por nível): converte uma vez mantendo o nível (o servidor converte na migração 0011)
try{if(localStorage.getItem('garro-xp-curva')!=='2'){for(const k in CARE){const i=+k,c=CARE[k];if(!c||!(c.xp>0)||!PLUSH[i])continue;const dv=grande(i)?4:5,cap=capOf(i),L0=Math.min(cap,1+Math.floor(c.xp/dv)),rest=c.xp-(L0-1)*dv;
    c.xp=L0>=cap?xpTotal(i,cap):xpTotal(i,L0)+Math.floor(rest/dv*(xpTotal(i,L0+1)-xpTotal(i,L0)))}saveCare();localStorage.setItem('garro-xp-curva','2')}}catch(e){}
function rbOf(i){return CARE[i]?CARE[i].rb|0:0}
// evoluído: os seus usam a marca de evolução (pedras no Nv 100); inimigos da Aventura (outro nível) contam evoluídos no Nv da evolução
function isEvo(i,lv,rb){if(i>=CH0)return false;const c=CARE[i];if(c&&(coll[i]||0)>0&&lvOf(i)===lv&&(c.rb|0)===(rb|0))return !!c.ev;return lv>=EVO_LV}
function mediaClasse(k){if(MEDIA_CL[k])return MEDIA_CL[k];let t=0,n=0;STAT.forEach((b,i)=>{if(b&&classeDe(i)===k){t+=(b[0]+b[1])/2;n++}});return MEDIA_CL[k]=n?t/n:1}
function statsAt(i,lv,rb){rb=rb|0;const b=STAT[i],k=classeDe(i),esc=FORCA[k]/mediaClasse(k),ev=(isEvo(i,lv,rb)?FORCA.evoluido:1)*(1+REB_B*rb),nv=1+(lv-1)*FORCA.nivel_max_bonus/99;
  const atk=Math.round(b[0]*esc*nv*ev),df=Math.round(b[1]*esc*nv*ev);return{lv,atk,def:df,hp:Math.round((atk+df)*2+lv*5)}}
function renderPow(i){const e=$('vPow');if(!e)return;const S=statsAt(i,lvOf(i),rbOf(i));e.innerHTML=(rbOf(i)?'<span>🔄 <b>'+rbOf(i)+'</b></span>':'')+'<span>Nv <b>'+S.lv+'</b></span><span>⚔️ <b>'+S.atk+'</b></span><span>🛡️ <b>'+S.def+'</b></span><span>❤️ <b>'+S.hp+'</b></span>'}
const EVN=GD.pelucias.EVN;
const ECOL=GD.pelucias.ECOL;
function evName(i,st){const n=PLUSH[i].name;return st>0?(EVN[n]||n):n}
function careOf(i){let c=CARE[i];const now=Date.now();
  if(!c){c=CARE[i]={xp:0,f:55,l:55,p:55,rb:0,sp:0,t:now};saveCare()}
  const mins=Math.max(0,(now-c.t)/60000);if(mins>.02){for(const k in DECAY)c[k]=Math.max(0,c[k]-DECAY[k]*mins);c.t=now}
  return c}
function careXp(i){return careOf(i).xp}
// quanto falta para o próximo nível (barra de XP como no Pokémon)
function xpPct(i){const lv=lvOf(i);if(lv>=capOf(i))return 100;const a=xpTotal(i,lv),b=xpTotal(i,lv+1);return Math.max(0,Math.min(100,(careOf(i).xp-a)/(b-a)*100))}
function xpTxt(i){const lv=lvOf(i),a=xpTotal(i,lv),b=xpTotal(i,lv+1);return 'XP '+Math.max(0,careOf(i).xp-a)+'/'+(b-a)}
function careStage(i){return isLeg(i)?0:i>=CH0?2:isEvo(i,lvOf(i),rbOf(i))?1:0}
function gsOf(i,st){return i>=CH0?1:GROW[st].gs}
function refreshVStats(i){const p=PLUSH[i],st=careStage(i);$('vStats').textContent=Math.round(p.cm*gsOf(i,st))+' cm · '+p.g+' g · pego '+(coll[i]||0)+'x'+(i>=CH0?'':' · '+(st?'Evoluído':'Base'))+(GCOLL[i]?' · 🏆 gigante'+(GEVO[i]?' evoluído':'')+' ×'+GCOLL[i]:'');if(i<CH0)$('vName').textContent=evName(i,st);renderPow(i)}
function renderCare(){
  if(!V.open||V.cur===undefined)return;const i=V.cur;renderSell(i);renderPow(i);
  const c=careOf(i),lv=lvOf(i),cap=capOf(i),st=careStage(i),m=(c.f+c.l+c.p)/3;
  if(isLeg(i)){$('cStage').textContent=(isEpic(i)?'🔥 Épico · ':'✦ Lendário · ')+(m>60?'😊 Feliz':m>30?'🙂 Tranquilo':'😟 Carente');$('cXp').textContent='Nv '+lv+(lv>=cap?' (máx)':' · '+xpTxt(i))+(isEpic(i)?' · o mais forte de todos':' · mais forte que as pelúcias grandes')+(rbOf(i)?' · 🔄 '+rbOf(i)+'×':'');$('cXpBar').style.width=xpPct(i)+'%'}
  else if(i>=CH0){$('cStage').textContent=m>60?'😊 Feliz':m>30?'🙂 Tranquilo':'😟 Carente';$('cXp').textContent='Nv '+lv+(lv>=cap?' (máx)':' · '+xpTxt(i))+(ehBolinha(i)?' · '+Math.min(coll[i]||0,BOL_N)+'/'+BOL_N+' para evoluir':' · 2 repetidas = 1 moeda')+(rbOf(i)?' · 🔄 '+rbOf(i)+'×':'');$('cXpBar').style.width=xpPct(i)+'%'}
  else{$('cStage').textContent=st?'★ '+evName(i,1):PLUSH[i].name;
    $('cXp').textContent='Nv '+lv+(lv>=cap?' (máx)':' · '+xpTxt(i))+(st?' · forma evoluída!':' · evolui no Nv '+EVO_LV+' com '+PEDRAS+' pedras')+' · cuidar hoje '+xpHoje(i)+'/'+XPDIA+' XP'+(rbOf(i)?' · 🔄 '+rbOf(i)+'× (+'+Math.round(REB_B*rbOf(i)*100)+'% força)':'');
    $('cXpBar').style.width=xpPct(i)+'%'}
  for(const [k,id,b] of [['f','mF','cFeed'],['l','mL','cPet'],['p','mP','cPlay']]){$(id).style.width=Math.round(c[k])+'%';$(b).classList.toggle('low',c[k]<25)}
  updFood();const sb=$('cStone'),rbb=$('cRebirth');
  if(rbb){const topo=lv>=cap;rbb.hidden=!topo;if(rbb.dataset.armedFor!=String(i)){rbb.dataset.armed='';rbb.dataset.armedFor=String(i);rbb.innerHTML='🔄 Renascer <small>· volta ao Nv 1 · +'+Math.round(REB_B*100)+'% de força</small>'}}
  if(sb&&ehBolinha(i)){const g=i-CH0,sk=STONE_OF(g),n=INV.st[sk]||0,b=coll[i]||0,ok=b>=BOL_N&&n>=PEDRAS;sb.hidden=false;sb.classList.toggle('buy',!ok);
    sb.innerHTML=ok?'✨ Virar '+evName(g,1)+' <small>(usa '+BOL_N+' bolinhas e '+PEDRAS+' '+STONES[sk].name+')</small>'
      :'✨ '+evName(g,1)+': '+Math.min(b,BOL_N)+'/'+BOL_N+' bolinhas · '+Math.min(n,PEDRAS)+'/'+PEDRAS+' '+STONES[sk].name+(b>=BOL_N?' <small>· '+PRICE.stone+' 🪙 cada pedra</small>':'');return}
  if(sb){const sk=STONE_OF(i),n=INV.st[sk]||0,pode=lv>=EVO_LV;sb.hidden=!(i<CH0&&!c.ev);sb.classList.toggle('buy',!pode||n<PEDRAS);
    sb.innerHTML=!pode?'💎 Evolui no Nv '+EVO_LV+' <small>· usa '+PEDRAS+' '+STONES[sk].name+' · você tem '+n+'</small>'
      :n>=PEDRAS?'💎 Evoluir agora <small>(usa '+PEDRAS+' '+STONES[sk].name+' · você tem '+n+')</small>'
      :'💎 Evoluir: faltam '+(PEDRAS-n)+' '+STONES[sk].name+' <small>· '+PRICE.stone+' 🪙 cada</small>'}
}
function updFood(){const s=$('cFeed')&&$('cFeed').querySelector('span');if(s)s.textContent='🍓 Comida ×'+INV.food}
// bolinha: BOL_N iguais + PEDRAS pedras do grupo = o grande evoluído (novo entra no Nv 1; se já tinha o grande, ele evolui e mantém o nível)
function bolinhaEvolve(i){const g=i-CH0,k=STONE_OF(g),b=coll[i]||0,n=INV.st[k]||0;
  if(b<BOL_N){banner('Faltam bolinhas','Junte '+BOL_N+' '+PLUSH[i].name+' (tem '+b+')');return}
  if(n<PEDRAS){audio();renderShop();$('shMsg').textContent='Precisa de '+PEDRAS+' '+STONES[k].name+' (você tem '+n+')';$('shop').hidden=false;return}
  if(!bolinhaEvolve.ok){escolha({titulo:'Ritual de evolução',sub:BOL_N+' bolinhas + '+PEDRAS+' '+STONES[k].name,
      cards:[{img:PLUSH[i].img,nome:PLUSH[i].name,tag:'bolinha',info:infoCopia(i,false),tem:b,fixo:BOL_N,fixoTxt:'usa '+BOL_N+' de '+b},
        {img:STONES[k].img,nome:STONES[k].name,tag:'pedra',info:[],tem:n,fixo:PEDRAS,fixoTxt:'usa '+PEDRAS+' de '+n},
        {img:(EVOSPR[g]?EVOSPR[g].img:PLUSH[g].img),nome:evName(g,1),tag:'★ resultado',destaque:1,info:coll[g]>0?['o seu '+PLUSH[g].name+' evolui','continua no Nv '+lvOf(g)]:['entra na coleção','Nv 1, já evoluído']}],
      resumo:()=>'Sobram '+(b-BOL_N)+' bolinha'+(b-BOL_N===1?'':'s')+' e '+(n-PEDRAS)+' pedra'+(n-PEDRAS===1?'':'s'),botao:()=>'✨ Fazer o ritual',pode:()=>true,
      ok:()=>{bolinhaEvolve.ok=1;try{bolinhaEvolve(i)}finally{bolinhaEvolve.ok=0}}});return}
  const novo=!(coll[g]>0);coll[i]=b-BOL_N;INV.st[k]=n-PEDRAS;coll[g]=(coll[g]||0)+1;const c=careOf(g);if(novo){c.xp=0;c.rb=0}c.ev=true;c.sp=0;saveX();saveInv();saveCare();evento('stone',PEDRAS);evento('capture');
  srv('bolinha_evolve',{plushId:i},r=>{coll[i]=r.balls;INV.st[k]=r.stones;coll[g]=r.count;const cc=careOf(g);cc.ev=true;cc.xp=r.xp;saveX();saveInv();saveCare();renderShelf()});
  audio();fanfare();for(let q=0;q<8;q++)setTimeout(()=>float('✨','love'),q*90);banner('✨ '+evName(g,1)+'!',(novo?'Novo na coleção · Nv 1':'O seu '+PLUSH[g].name+' evoluiu'),true);
  renderShelf(g);setTimeout(()=>openViewer(g),700)}
function useStone(){const i=V.cur;if(i===undefined)return;if(ehBolinha(i)){bolinhaEvolve(i);return}if(i>=CH0)return;const k=STONE_OF(i),lv=lvOf(i),c=careOf(i);if(c.ev)return;
  if(lv<EVO_LV){banner('Ainda não dá','Evolui no Nv '+EVO_LV+' com '+PEDRAS+' '+STONES[k].name);return}
  if((INV.st[k]||0)<PEDRAS){audio();renderShop();$('shMsg').textContent='Para evoluir precisa de '+PEDRAS+' '+STONES[k].name+' (você tem '+(INV.st[k]||0)+')';$('shop').hidden=false;return}
  INV.st[k]-=PEDRAS;c.ev=true;c.sp=0;saveInv();saveCare();evento('stone',PEDRAS);
  srv('use_stone',{plushId:i,stone:k},r=>{INV.st[k]=r.stones;const cc=careOf(i);cc.ev=!!r.evolved;cc.rb=r.rebirths|0;saveInv();saveCare();if(V.open&&V.cur===i){renderCare();refreshVStats(i)}});
  audio();[523,784,1046,1568].forEach((f,q)=>setTimeout(()=>tone(f,.14,'triangle',.1),q*90));for(let q=0;q<6;q++)setTimeout(()=>float('💎','love'),q*90);
  setTimeout(()=>evolve(i,0,1),500);renderCare();refreshVStats(i)}
function rebirth(){const i=V.cur;if(i===undefined||lvOf(i)<capOf(i))return;const b=$('cRebirth');
  if(b.dataset.armed!=='1'){b.dataset.armed='1';b.textContent='Toque de novo: renascer ('+PLUSH[i].name+' volta ao Nv 1 e fica +'+Math.round(REB_B*100)+'% mais forte)';return}
  const c=careOf(i);c.xp=0;c.sp=0;c.rb=(c.rb|0)+1;saveCare();evento('rebirth');
  srv('rebirth',{plushId:i},r=>{const cc=careOf(i);cc.xp=r.xp;cc.rb=r.rebirths|0;cc.sp=0;saveCare();if(V.open&&V.cur===i){renderCare();refreshVStats(i)}});
  audio();fanfare();for(let q=0;q<8;q++)setTimeout(()=>float('🔄','love'),q*90);banner('🔄 Renasceu!',PLUSH[i].name+' · '+c.rb+'× · +'+Math.round(REB_B*c.rb*100)+'% de força',true);
  renderCare();refreshVStats(i)}
/* ---------- escolher cópias (vender, ritual das bolinhas, gigantes) ----------
   Cópias iguais (mesmo nível, XP e cuidado): o jogador só escolhe a quantidade. Cópias diferentes (normal × gigante,
   gigante evoluído): ficam lado a lado, cada uma com o que tem de diferente, e cada uma com a sua quantidade. */
function escolha(o){let el=$('pick');if(!el){el=document.createElement('div');el.id='pick';el.className='shop pick';el.hidden=true;document.body.appendChild(el)}
  const q=o.cards.map(c=>c.fixo??c.qtd??0);
  const cartao=(c,k)=>'<div class="pkcard'+(c.destaque?' res':'')+'"><img src="'+c.img+'" alt=""><div class="pkcorpo"><div class="pktit"><b>'+c.nome+'</b>'+(c.tag?'<i class="pktag">'+c.tag+'</i>':'')+'</div>'+
    '<div class="pkinfo">'+(c.info||[]).map(t=>'<span>'+t+'</span>').join('')+'</div>'+
    '<div class="pkrodape">'+(c.tem!==undefined?'<small>Tem '+c.tem+'</small>':'')+
    (c.fixo!==undefined?'<div class="pkfixo">'+c.fixoTxt+'</div>':c.max!==undefined?'<div class="pkqt"><button type="button" data-k="'+k+'" data-d="-1" aria-label="Menos">−</button><em id="pkq'+k+'">'+q[k]+'</em><button type="button" data-k="'+k+'" data-d="1" aria-label="Mais">+</button><button type="button" class="pktodos" data-k="'+k+'" data-d="99">todos</button></div>':'')+'</div></div></div>';
  const pinta=()=>{o.cards.forEach((c,k)=>{const e=$('pkq'+k);if(e)e.textContent=q[k]});$('pkRes').innerHTML=o.resumo(q);const b=$('pkOk');b.textContent=o.botao(q);b.disabled=!o.pode(q)};
  el.innerHTML='<h3>'+o.titulo+'</h3><div class="shopcoins">'+(o.sub||'')+'</div><div class="shopscroll"><div class="pkcards">'+o.cards.map((c,k)=>(c.secao?'<div class="pksec">'+c.secao+'</div>':'')+cartao(c,k)).join('')+'</div><div class="pkres" id="pkRes"></div></div>'+
    '<div class="pkbtns"><button type="button" class="shclose" id="pkNo">Voltar</button><button type="button" id="pkOk"></button></div>';
  el.querySelectorAll('.pkqt button').forEach(b=>b.addEventListener('click',()=>{const k=+b.dataset.k,d=+b.dataset.d,c=o.cards[k];q[k]=d===99?c.max:Math.max(c.min||0,Math.min(c.max,q[k]+d));click(600);pinta()}));
  $('pkNo').addEventListener('click',()=>{el.hidden=true});$('pkOk').addEventListener('click',()=>{if(!o.pode(q))return;el.hidden=true;o.ok(q)});
  pinta();el.hidden=false;audio()}
// o que mostrar de cada cópia: nível, força e se é evoluído/gigante (o gigante bate mais forte)
function infoCopia(i,gig){const S=statsAt(i,lvOf(i),rbOf(i)),k=gig?(GEVO[i]?FORCA.gigante_evoluido:FORCA.gigante):1,ev=careStage(i)===1&&i<CH0;
  return ['Nv '+lvOf(i),'⚔️ '+Math.round(S.atk*k),'🛡️ '+Math.round(S.def*k),'❤️ '+Math.round(S.hp*k)].concat(ev?['★ evoluído']:[]).concat(gig&&GEVO[i]?['🏆★ gigante evoluído']:[])}
const SELL_PRICE=1,SELL_BIG=30,SELL_GIANT=40;// redondo 1 · bicho especial (que evolui) 30 · pelúcia gigante 40
function renderSell(i){const b=$('cSell'),bg=$('cSellG');if(!b)return;if(isLeg(i)){b.hidden=true;bg.hidden=true;renderGiantRow(i);return}const n=coll[i]||0,big=i<CH0;b.hidden=false;b.disabled=n<1;b.dataset.armed='';
  const gq=big?GCOLL[i]||0:0;b.textContent=n+gq>1?'💰 Vender… (tenho '+n+(gq?' + '+gq+' gigante'+(gq>1?'s':''):'')+')':n>=1?'💰 Vender 1 · +'+(big?SELL_BIG:SELL_PRICE)+' moeda'+(big?'s':'')+' (tenho '+n+')':'💰 Nenhum para vender';b.disabled=n+gq<1;
  renderGiantRow(i);const gn=GCOLL[i]||0;bg.hidden=!(big&&gn);bg.dataset.armed='';bg.disabled=false;bg.textContent='🏆 Vender gigante · +'+SELL_GIANT+' moedas (tenho '+gn+')'}
async function sellDup(){const i=V.cur;if(i===undefined||isLeg(i))return;const n=coll[i]||0;if(n<1)return;const big=i<CH0,b=$('cSell');
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
// vender: o bichinho aberto fica em cima; embaixo, todos os outros que dá para vender (no mesmo formato), para vender vários de uma vez
function cartoesVenda(i,principal){const big=i<CH0,n=coll[i]||0,gn=big?GCOLL[i]||0:0,img=(careStage(i)===1&&EVOSPR[i]?EVOSPR[i].img:PLUSH[i].img),nome=evName(i,careStage(i)===1?1:0),out=[];
  const nm=ehBolinha(i)?['bolinha','bolinhas']:big?['normal','normais']:['pelúcia','pelúcias'];
  if(n)out.push({id:i,tipo:'n',img,nome,tag:big?'normal':ehBolinha(i)?'bolinha':PLUSH[i].fora?'antigo':'',info:infoCopia(i,false),tem:n,max:n,qtd:principal&&!gn?1:0,preco:big?SELL_BIG:SELL_PRICE,nm});
  if(gn)out.push({id:i,tipo:'g',img,nome,tag:'🏆 gigante',info:infoCopia(i,true),tem:gn,max:gn,qtd:principal&&!n?1:0,preco:SELL_GIANT,nm:['gigante','gigantes']});
  return out}
function venda(foco){const i=foco===null?undefined:foco===undefined?V.cur:foco;const tem=j=>!isLeg(j)&&((coll[j]||0)>0||(j<CH0&&(GCOLL[j]||0)>0));
  if(i!==undefined&&(isLeg(i)||!tem(i)))return;
  const outros=[];for(let j=0;j<LEG0;j++)if(j!==i&&tem(j))outros.push(j);
  // repetidos primeiro (são os que a gente normalmente vende)
  outros.sort((a,b)=>((coll[b]||0)+(GCOLL[b]||0))-((coll[a]||0)+(GCOLL[a]||0))||a-b);
  const cards=(i!==undefined?cartoesVenda(i,true):[]).concat(...outros.map((j,k)=>{const cs=cartoesVenda(j,false);if(k===0&&cs.length&&i!==undefined)cs[0].secao='Outros que você pode vender';return cs}));
  if(!cards.length){banner('Nada para vender');return}
  const tot=q=>q.reduce((s,v,k)=>s+v*cards[k].preco,0);
  escolha({titulo:'Vender',sub:'Escolha quantos de cada um',cards,
    resumo:q=>{const r=[];q.forEach((v,k)=>{if(v)r.push(v+' '+cards[k].nome+(cards[k].tipo==='g'?' gigante':''))});const n=q.reduce((s,v)=>s+v,0);
      return n?'Vai vender '+(r.length<=2?r.join(' e '):n+' bichinhos')+' · <b>+'+tot(q)+' 🪙</b>':'Escolha pelo menos 1'},
    botao:q=>'Vender · +'+tot(q)+' 🪙',pode:q=>q.some(v=>v>0),
    ok:async q=>{let ganho=0,qt=0;const fecha=[];
      for(let k=0;k<cards.length;k++){const c=cards[k],v=q[k];if(!v)continue;const j=c.id;qt+=v;ganho+=v*c.preco;
        if(c.tipo==='n'){const n0=coll[j]||0,r=await syncEstado('sell',{plushId:j,qty:v});if(r&&typeof r.coins==='number'){coins=r.coins+bonus;coll[j]=Math.max(0,typeof r.count==='number'?r.count:n0-v)}else{coll[j]=n0-v;bonus+=v*c.preco;coins+=v*c.preco;saveBonus()}}
        else for(let t=0;t<v;t++){GCOLL[j]=(GCOLL[j]||0)-1;if(!GCOLL[j])delete GEVO[j];coins+=SELL_GIANT;if(ONL)srv('sell_giant',{plushId:j},r=>{coins=r.coins;GCOLL[j]=r.giants;saveG();hud()});else{bonus+=SELL_GIANT;saveBonus()}}}
      saveX();saveG();audio();[784,988,1319,1568].forEach((f,k)=>setTimeout(()=>tone(f,.12,'triangle',.09),k*80));for(let k=0;k<6;k++)setTimeout(()=>float('🪙','love'),k*100);
      banner('+'+ganho+' moedas','Vendeu '+qt+' bichinho'+(qt>1?'s':''),true);hud();renderShelf();
      if(V.open&&V.cur!==undefined){const c=V.cur;if(!coll[c]&&!(GCOLL[c]>0)){$('vClose').click();return}renderSell(c);refreshVStats(c)}}})}
// um só deste bichinho e nenhum outro para vender: continua o jeito rápido (toque duas vezes)
function vendaBotao(){const i=V.cur;if(i===undefined||isLeg(i))return;const n=coll[i]||0,gn=i<CH0?GCOLL[i]||0:0;let outros=0;for(let j=0;j<LEG0;j++)if(j!==i&&((coll[j]||0)>0||(j<CH0&&GCOLL[j]>0)))outros++;
  if(n+gn<=1&&!outros){if(gn)sellGiant();else sellDup();return}venda(i)}
$('cSell').addEventListener('click',vendaBotao);$('cSellG').addEventListener('click',vendaBotao);
$('cBatG').addEventListener('click',()=>openBattle(true));
function renderGiantRow(i){const r=$('gRow');if(!r)return;const gn=i<CH0?GCOLL[i]||0:0;r.hidden=!gn;if(!gn)return;const k=STONE_OF(i),n=INV.st[k]||0,b=$('cGEvo');
  b.hidden=!!GEVO[i];b.classList.toggle('buy',n<GEVO_STONES);b.innerHTML=n>=GEVO_STONES?'💎 Evoluir o gigante <small>(usa '+GEVO_STONES+' '+STONES[k].name+' · tem '+n+')</small>':'💎 Gigante evolui com '+GEVO_STONES+' '+STONES[k].name+' <small>· tem '+n+' · comprar</small>'}
function evolveGiant(){const i=V.cur;if(i===undefined||!(GCOLL[i]>0)||GEVO[i])return;const k=STONE_OF(i);audio();
  if((INV.st[k]||0)<GEVO_STONES){renderShop();$('shMsg').textContent='Para evoluir o gigante precisa de '+GEVO_STONES+' '+STONES[k].name+' (tem '+(INV.st[k]||0)+')';$('shop').hidden=false;return}
  INV.st[k]-=GEVO_STONES;saveInv();GEVO[i]=1;saveG();evento('giant_evolve');srv('giant_evolve',{plushId:i,stone:k},r=>{INV.st[k]=r.stones;saveInv()});[523,659,784,1046,1318,1568,2093].forEach((q,n)=>setTimeout(()=>tone(q,.24,'triangle',.11),n*100));for(let n=0;n<10;n++)setTimeout(()=>float(['💎','✨','🏆','🌟'][n%4],'love'),n*110);
  const e=$('vEvo');e.innerHTML='🏆 Gigante evoluiu!<small>'+evName(i,1)+' gigante</small>';e.classList.remove('on');void e.offsetWidth;e.classList.add('on');renderGiantRow(i);renderShelf();refreshVStats(i)}
$('cGEvo').addEventListener('click',evolveGiant);
$('btnSwap').addEventListener('click',swapMachine);
$('mach1').addEventListener('click',()=>setMachine(1));$('mach2').addEventListener('click',()=>setMachine(2));if($('mach4'))$('mach4').addEventListener('click',()=>setMachine(3));if($('mach5'))$('mach5').addEventListener('click',()=>setMachine(4));tabsMaq();
{let tc=0,tt=0;$('coins').parentElement.addEventListener('click',()=>{if(!window.GARRO_OFFLINE)return;const now=Date.now();if(now-tt>1500)tc=0;tt=now;if(++tc>=7){tc=0;DEV=!DEV;try{localStorage.setItem('garro-dev',DEV?'1':'0')}catch(e){}banner(DEV?'Modo dev: moedas infinitas':'Modo dev desligado');hud()}})}

/* ---------- loja ---------- */
const PRICE=GD.regras.PRICE;
function renderShop(){$('shCoins').textContent=DEV?'∞':coins;$('shFood').textContent=INV.food;$('buyFood').disabled=!canPay(PRICE.food);
  const g=$('shStones');if(!g.children.length){STONES.forEach((p,k)=>{const d=document.createElement('div');d.className='shst';d.innerHTML='<img src="'+p.img+'" alt=""><b>'+p.name+'</b><small>'+p.desc+'</small><small>Você tem: <i id="shS'+k+'">0</i></small><button data-k="'+k+'">'+PRICE.stone+' 🪙</button>';g.appendChild(d)});
    g.addEventListener('click',e=>{const b=e.target.closest('button');if(b)buyThing('stone',+b.dataset.k)})}
  STONES.forEach((p,k)=>{$('shS'+k).textContent=INV.st[k]});g.querySelectorAll('button').forEach(b=>b.disabled=!canPay(PRICE.stone))}
function buyThing(kind,k){const pr=PRICE[kind];if(!canPay(pr)){$('shMsg').textContent='Moedas insuficientes: faltam '+(pr-coins)+' 🪙';return}$('shMsg').textContent='';
  if(ONL&&!DEV){const item=kind==='food'?'food':'stone_'+k;$('shMsg').textContent='Comprando...';syncEstado('buy',{item}).then(r=>{if(!r||r.error){$('shMsg').textContent='Não deu para comprar agora. Tente de novo.';return}
    $('shMsg').textContent='';coins=r.coins;if(kind==='food')INV.food=r.qty;else{INV.st[k]=r.qty;evento('stone')}saveInv();hud();audio();[784,988,1319].forEach((f,q)=>setTimeout(()=>tone(f,.1,'triangle',.08),q*70));renderShop();if(V.open)renderCare()});return}
  spend(pr);if(kind==='food')INV.food++;else{INV.st[k]++;evento('stone')}saveInv();hud();audio();[784,988,1319].forEach((f,q)=>setTimeout(()=>tone(f,.1,'triangle',.08),q*70));renderShop();if(V.open)renderCare()}
$('btnShop').addEventListener('click',()=>{audio();renderShop();$('shop').hidden=false});
$('shClose').addEventListener('click',()=>{$('shop').hidden=true});
$('buyFood').addEventListener('click',()=>buyThing('food'));
$('cStone').addEventListener('click',useStone);$('cRebirth').addEventListener('click',rebirth);
/* ---------- inventário ---------- */
function canEvolveWith(i,k){return i<CH0&&(coll[i]||0)>0&&STONE_OF(i)===k&&!careOf(i).ev&&lvOf(i)>=EVO_LV}
function renderInv(){$('ivFood').textContent=INV.food;const g=$('ivStones');g.innerHTML='';
  STONES.map((p,k)=>k).sort((a,b)=>((INV.st[b]||0)>0)-((INV.st[a]||0)>0)||a-b).forEach(k=>{const p=STONES[k],n=INV.st[k]||0,d=document.createElement('div');d.className='shst ivst'+(n?'':' zero');
    const who=[];for(let i=0;i<CH0;i++)if(STONE_OF(i)===k)who.push(PLUSH[i].name);
    d.innerHTML='<span class="n">×'+n+'</span><img src="'+p.img+'" alt=""><b>'+p.name+'</b><small>'+(who.length?'Evolui: '+who.join(', '):'Ainda sem bicho')+'</small><button data-k="'+k+'">'+(n?'Evoluir um bichinho':'Comprar na loja')+'</button>';g.appendChild(d)});
}
function invPick(k){const box=$('ivPick'),list=[];for(let i=0;i<CH0;i++)if(canEvolveWith(i,k))list.push(i);
  box.hidden=false;box.innerHTML='<h4>'+STONES[k].name+' · escolha quem evolui</h4>'+(list.length?list.map(i=>'<div class="ivrow"><img src="'+PLUSH[i].img+'" alt=""><div><b>'+PLUSH[i].name+'</b><small>Nv '+lvOf(i)+' → vira '+(EVN[PLUSH[i].name]||'forma evoluída')+'</small></div><button data-i="'+i+'">Evoluir</button></div>').join(''):'<small style="color:var(--dim);font-weight:700">Nenhum bichinho seu pode evoluir com esta pedra agora (precisa estar no Nv '+EVO_LV+', ainda não evoluído, e ter '+PEDRAS+' pedras).</small>');
  box.parentElement.scrollTo({top:0,behavior:'smooth'})}
$('ivStones').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const k=+b.dataset.k;audio();if((INV.st[k]||0)>0)invPick(k);else{$('inv').hidden=true;renderShop();$('shop').hidden=false}});
$('ivPick').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const i=+b.dataset.i;$('inv').hidden=true;openViewer(i);setTimeout(useStone,900)});
$('btnInv').addEventListener('click',()=>{audio();renderInv();$('ivPick').hidden=true;$('inv').hidden=false});
$('ivClose').addEventListener('click',()=>{$('inv').hidden=true});
$('ivVender').addEventListener('click',()=>{$('inv').hidden=true;venda(null)});
$('ivBuy').addEventListener('click',()=>{$('inv').hidden=true;renderShop();$('shop').hidden=false});
