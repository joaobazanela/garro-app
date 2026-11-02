/* GARRO — sons das batalhas e da Aventura: música de fundo de cada mundo (e da batalha/chefão) e efeitos
   (golpe, crítico, poder e especial com o som do elemento, esquiva, dano, inimigo derrotado, chefão, portal, lava,
   correnteza, itens, vitória e derrota). Tudo é sintetizado na hora (Web Audio), sem arquivos de áudio.
   Preferência do jogador em localStorage 'garro-som': 0 = música e efeitos, 1 = só efeitos, 2 = mudo. */
(function(){
const G=window.GARRO;if(!G)return;
let modo=0;try{modo=Math.max(0,Math.min(2,+(localStorage.getItem('garro-som')||0)))}catch(e){}
let C=null,mestre=null,musG=null,sfxG=null,eco=null,NB=null,mus=null;
function ctx(){if(C)return C;C=G.ac&&G.ac();if(!C)return null;
  const comp=C.createDynamicsCompressor();comp.threshold.value=-14;comp.ratio.value=4;comp.connect(C.destination);
  mestre=C.createGain();mestre.gain.value=.95;mestre.connect(comp);musG=C.createGain();sfxG=C.createGain();musG.connect(mestre);sfxG.connect(mestre);
  // eco suave só para a música
  const d=C.createDelay(1);d.delayTime.value=.32;const fb=C.createGain();fb.gain.value=.28;const wet=C.createGain();wet.gain.value=.22;d.connect(fb).connect(d);d.connect(wet).connect(musG);eco=d;
  aplica();return C}
function aplica(){if(!musG)return;musG.gain.setTargetAtTime(modo===0?(mus&&mus.abaixa?.08:.3):0,C.currentTime,.08);sfxG.gain.setTargetAtTime(modo===2?0:.85,C.currentTime,.03)}
function ruido(){if(!NB){const n=C.sampleRate;NB=C.createBuffer(1,n,n);const d=NB.getChannelData(0);for(let i=0;i<n;i++)d[i]=Math.random()*2-1}return NB}
// tom com envelope (ataque rápido, queda exponencial) e deslize de frequência
function T(t0,f,f2,dur,tipo,vol,dest,at){const o=C.createOscillator(),g=C.createGain();o.type=tipo||'sine';o.frequency.setValueAtTime(f,t0);if(f2)o.frequency.exponentialRampToValueAtTime(Math.max(20,f2),t0+dur);
  g.gain.setValueAtTime(.0001,t0);g.gain.exponentialRampToValueAtTime(vol,t0+(at||.006));g.gain.exponentialRampToValueAtTime(.0001,t0+dur);o.connect(g).connect(dest||sfxG);o.start(t0);o.stop(t0+dur+.03);return o}
// ruído filtrado (sopro, explosão, chiado)
function N(t0,dur,vol,tipoF,f1,f2,q,dest){const s=C.createBufferSource();s.buffer=ruido();s.loop=true;const fl=C.createBiquadFilter();fl.type=tipoF||'lowpass';fl.frequency.setValueAtTime(f1,t0);if(f2)fl.frequency.exponentialRampToValueAtTime(Math.max(30,f2),t0+dur);fl.Q.value=q||1;
  const g=C.createGain();g.gain.setValueAtTime(.0001,t0);g.gain.exponentialRampToValueAtTime(vol,t0+.01);g.gain.exponentialRampToValueAtTime(.0001,t0+dur);s.connect(fl).connect(g).connect(dest||sfxG);s.start(t0,Math.random()*.5);s.stop(t0+dur+.03)}
const ok=()=>modo<2&&ctx();
// grupo de som de cada elemento (data/pelucias.json → ELEM)
const GRUPO={embers:'fogo',lava:'fogo',water:'agua',sand:'agua',swamp:'agua',ice:'gelo',cloud:'vento',electric:'raio',leaves:'planta',flowers:'planta',petals:'planta',earth:'pedra',stone:'pedra',shadow:'sombra',stars:'luz',gold:'luz'};
const gr=el=>GRUPO[el]||'vento';
const SFX={
  golpe(crit){if(!ok())return;const t=C.currentTime;N(t,.12,.5,'bandpass',1800,400,1.2);T(t,170,70,.16,'triangle',.45);if(crit){T(t+.02,1250,1650,.18,'square',.12);N(t,.25,.4,'highpass',3000,6000,.7);T(t,90,40,.3,'sine',.6)}},
  ataque(){if(!ok())return;const t=C.currentTime;N(t,.13,.22,'bandpass',600,2400,2)},
  esquiva(){if(!ok())return;const t=C.currentTime;N(t,.22,.3,'bandpass',500,3000,3);T(t,500,900,.12,'sine',.06)},
  dano(){if(!ok())return;const t=C.currentTime;T(t,220,90,.22,'sawtooth',.2);N(t,.15,.35,'lowpass',900,200,1)},
  derrota_inimigo(){if(!ok())return;const t=C.currentTime;T(t,520,180,.18,'square',.12);N(t,.2,.3,'lowpass',2000,300);[880,1175,1568].forEach((f,k)=>T(t+.12+k*.06,f,0,.14,'triangle',.1))},
  escudo(){if(!ok())return;const t=C.currentTime;[1400,1100,1700].forEach((f,k)=>T(t+k*.03,f,f*.7,.25,'square',.07));N(t,.3,.3,'highpass',2500,4000)},
  cura(){if(!ok())return;const t=C.currentTime;[660,880,1320].forEach((f,k)=>T(t+k*.08,f,f*1.02,.3,'sine',.12))},
  tiro_inimigo(){if(!ok())return;const t=C.currentTime;T(t,700,300,.15,'square',.06);N(t,.12,.12,'bandpass',1200,500,2)},
  pancada(){if(!ok())return;const t=C.currentTime;T(t,80,35,.5,'sine',.7);N(t,.35,.45,'lowpass',600,80)},
  // poder/especial com o som do elemento (forte = especial)
  poder(el,forte){if(!ok())return;const t=C.currentTime,k=forte?1.6:1,g_=gr(el);
    if(g_==='fogo'){N(t,.35*k,.45,'bandpass',500,2500,1.5);for(let i=0;i<6*k;i++)N(t+i*.04,.05,.25,'highpass',3000+Math.random()*3000,0,1);T(t,120,60,.3*k,'sawtooth',.12)}
    else if(g_==='agua'){for(let i=0;i<6*k;i++)T(t+i*.05,300+Math.random()*300,900+Math.random()*500,.08,'sine',.16);N(t,.4*k,.2,'lowpass',1200,300)}
    else if(g_==='gelo'){[1568,2093,1760,2349,2637].slice(0,forte?5:3).forEach((f,i)=>T(t+i*.05,f,f*1.01,.4,'triangle',.1));N(t,.3,.18,'highpass',5000,8000)}
    else if(g_==='raio'){for(let i=0;i<5*k;i++)T(t+i*.035,1800-i*200,120,.06,'square',.12);N(t,.25*k,.35,'highpass',2000,600)}
    else if(g_==='planta'){N(t,.45*k,.25,'bandpass',300,1400,2);[784,988,1175].forEach((f,i)=>T(t+.1+i*.07,f,0,.25,'sine',.09))}
    else if(g_==='pedra'){T(t,110,40,.45*k,'sine',.7);N(t,.4*k,.5,'lowpass',700,90);T(t+.08,70,30,.4,'triangle',.4)}
    else if(g_==='sombra'){const a=T(t,90,60,.6*k,'sawtooth',.18),b=T(t,93,58,.6*k,'sawtooth',.18);N(t,.6*k,.25,'bandpass',300,120,3)}
    else if(g_==='luz'){[1046,1318,1568,2093,2637].slice(0,forte?5:3).forEach((f,i)=>T(t+i*.06,f,0,.45,'triangle',.11));N(t,.3,.12,'highpass',6000,9000)}
    else{N(t,.5*k,.35,'bandpass',400,2600,2.5);T(t,300,700,.3,'sine',.05)}
    if(forte){T(t,60,30,.7,'sine',.5)}},
  chefe(){if(!ok())return;const t=C.currentTime;T(t,70,45,1.1,'sawtooth',.3,undefined,.08);T(t,73,47,1.1,'sawtooth',.25,undefined,.08);N(t,1,.4,'bandpass',300,90,4);T(t+.15,140,90,.9,'square',.08)},
  portal(){if(!ok())return;const t=C.currentTime;[523,659,784,1046,1318,1568,2093].forEach((f,i)=>T(t+i*.07,f,f*1.01,.6,'triangle',.09));N(t,1.2,.15,'highpass',4000,9000)},
  cristal(){if(!ok())return;const t=C.currentTime;[1318,1760,2637].forEach((f,i)=>T(t+i*.06,f,0,.5,'triangle',.1))},
  lava(){if(!ok())return;const t=C.currentTime;N(t,.5,.4,'bandpass',900,300,1.5);for(let i=0;i<5;i++)N(t+Math.random()*.35,.04,.3,'highpass',2500,0,1)},
  corrente(){if(!ok())return;const t=C.currentTime;N(t,.9,.25,'lowpass',500,1400,1.5);for(let i=0;i<6;i++)T(t+i*.12,250+Math.random()*250,700,.07,'sine',.08)},
  folha(){if(!ok())return;const t=C.currentTime;T(t,988,0,.15,'triangle',.12);T(t+.09,1318,0,.22,'triangle',.12);T(t+.18,1976,0,.25,'sine',.06)},
  morango(){if(!ok())return;const t=C.currentTime;T(t,520,880,.14,'sine',.14);T(t+.08,700,1100,.12,'sine',.08)},
  bau(){if(!ok())return;const t=C.currentTime;T(t,180,90,.2,'square',.1);[523,659,784,1046,1318,1568].forEach((f,i)=>T(t+.15+i*.07,f,0,.35,'triangle',.11))},
  vitoria(){if(!ok())return;const t=C.currentTime;[[523,0],[659,.12],[784,.24],[1046,.36],[784,.52],[1046,.62],[1318,.74]].forEach(([f,d])=>{T(t+d,f,0,.32,'square',.07);T(t+d,f/2,0,.3,'triangle',.12)});N(t+.74,.6,.12,'highpass',5000,9000)},
  derrota(){if(!ok())return;const t=C.currentTime;[[392,0],[370,.25],[349,.5],[262,.8]].forEach(([f,d],i)=>T(t+d,f,i===3?220:0,i===3?.9:.3,'triangle',.14))},
  nivel(){if(!ok())return;const t=C.currentTime;[659,880,1175,1568].forEach((f,i)=>T(t+i*.07,f,0,.25,'square',.06))}
};
// ---------- música: sequenciador simples (melodia em escala, baixo, acordes e bateria) ----------
const TEMAS={
  floresta:{bpm:100,raiz:261.6,esc:[0,2,4,7,9],lead:'triangle',baixo:'triangle',bat:.25,pad:.5,seed:3},
  mar:{bpm:84,raiz:293.7,esc:[0,2,4,6,7,9,11],lead:'sine',baixo:'sine',bat:.1,pad:.7,seed:7,bolhas:1},
  montanha:{bpm:76,raiz:220,esc:[0,3,5,7,10],lead:'square',baixo:'triangle',bat:.15,pad:.6,seed:11,suave:1},
  trevas:{bpm:70,raiz:146.8,esc:[0,2,3,5,7,8,11],lead:'sawtooth',baixo:'sawtooth',bat:.2,pad:.8,seed:13,suave:1,menor:1},
  fogo:{bpm:132,raiz:164.8,esc:[0,1,4,5,7,8,10],lead:'square',baixo:'sawtooth',bat:.75,pad:.3,seed:17},
  luz:{bpm:92,raiz:196,esc:[0,2,4,5,7,9,11],lead:'triangle',baixo:'sine',bat:.15,pad:.6,seed:19,harpa:1},
  batalha:{bpm:144,raiz:220,esc:[0,2,3,5,7,8,10],lead:'square',baixo:'sawtooth',bat:.9,pad:.25,seed:23},
  chefe:{bpm:152,raiz:155.6,esc:[0,1,3,5,6,8,10],lead:'sawtooth',baixo:'sawtooth',bat:1,pad:.35,seed:29,menor:1}
};
function rng(s){let a=s>>>0;return()=>{a=(a*1664525+1013904223)>>>0;return a/4294967296}}
function compoe(tm){// 4 compassos de 8 colcheias: melodia por passos na escala; baixo e acordes (I–VI–IV–V ou i–VI–VII–i)
  const r=rng(tm.seed),mel=[];let g=7;
  for(let i=0;i<32;i++){if(r()<.22&&i%2){mel.push(null);continue}g=Math.max(2,Math.min(12,g+[-2,-1,-1,0,1,1,2][Math.floor(r()*7)]));mel.push(g)}
  for(let i=28;i<32;i++)mel[i]=i===31?null:(i===28?7:5);
  const prog=tm.menor?[0,5,6,0]:[0,5,3,4];return{mel,prog}}
const nota=(tm,grau,oit)=>{const n=tm.esc.length,o=Math.floor(grau/n),st=tm.esc[((grau%n)+n)%n];return tm.raiz*Math.pow(2,(st+12*(o+(oit||0)))/12)};
function toca(t,tm,c,passo){const dur=60/tm.bpm/2,i=passo%32,bar=Math.floor(i/8),cg=c.prog[bar];
  const g=c.mel[i];if(g!==null){const f=nota(tm,g,0),o=T(t,f,0,dur*(tm.suave?1.8:1.1),tm.lead,tm.lead==='sawtooth'||tm.lead==='square'?.05:.09,musG,tm.suave?.05:.01);try{const s=C.createGain();s.gain.value=.5;o.connect(s).connect(eco)}catch(e){}}
  if(i%4===0)T(t,nota(tm,cg,-2),0,dur*3.6,tm.baixo,tm.baixo==='sawtooth'?.08:.16,musG,.02);
  if(i%8===0&&tm.pad)for(const k of [0,2,4])T(t,nota(tm,cg+k,-1),0,dur*7.5,'sine',.035*tm.pad,musG,.25);
  if(tm.harpa&&i%2===0)T(t,nota(tm,cg+[0,2,4,7][(i/2)%4],1),0,dur*2,'triangle',.04,musG);
  if(tm.bolhas&&Math.random()<.12)T(t,400+Math.random()*400,900,.06,'sine',.03,musG);
  const b=tm.bat;if(b){if(i%4===0)T(t,110,40,.18,'sine',.5*b,musG);if(i%4===2&&b>.5)N(t,.12,.22*b,'bandpass',1800,900,1,musG);if(b>.2||i%2===0)N(t,.03,.07*b,'highpass',7000,0,1,musG)}}
function musica(nome){if(!ctx())return;const tm=TEMAS[nome]||TEMAS.floresta;if(mus&&mus.nome===nome)return;parar();
  const c=compoe(tm),m={nome,tm,c,passo:0,t:C.currentTime+.08,abaixa:false};mus=m;aplica();
  m.iv=setInterval(()=>{if(mus!==m)return;const dur=60/tm.bpm/2;while(m.t<C.currentTime+.18){if(modo===0)toca(m.t,tm,c,m.passo);m.passo++;m.t+=dur}},40)}
function parar(){if(mus){clearInterval(mus.iv);mus=null}}
function abaixar(on){if(mus){mus.abaixa=!!on;aplica()}}
function setModo(m){modo=m;try{localStorage.setItem('garro-som',String(m))}catch(e){}if(C)aplica();document.querySelectorAll('[data-som]').forEach(rotulo)}
const NOMES=['🔊 Música e efeitos','🔉 Só efeitos','🔇 Sem som'];
function rotulo(b){b.textContent=NOMES[modo];b.setAttribute('aria-label','Som: '+NOMES[modo].slice(2))}
// botão de som (troca entre os 3 modos)
function botao(cls){const b=document.createElement('button');b.type='button';b.className='somb '+(cls||'');b.dataset.som='1';rotulo(b);b.addEventListener('click',e=>{e.stopPropagation();ctx();setModo((modo+1)%3)});return b}
// botão de som no topo da batalha
{const h=document.querySelector('#battle h3');if(h&&!h.querySelector('[data-som]'))h.appendChild(botao('batsom'))}
window.GARRO_SOM=Object.assign({},SFX,{musica,parar,abaixar,botao,modo:()=>modo,mudoEfeitos:()=>modo===2,setModo});
})();
