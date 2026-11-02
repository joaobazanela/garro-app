/* GARRO — gerador dos mapas da Aventura 3D (vista de cima). Cada partida sorteia uma semente nova: percurso, acampamentos,
   folhas, morangos e árvores mudam, e a quantidade de bichinhos varia (regras em data/aventura.json → "variacao").
   É a mesma receita de ferramentas/gerar_mapas_aventura.py, que grava em data/aventura.json o mapa reserva de cada fase
   (usado se este arquivo não carregar e pelo servidor para saber quantos inimigos uma fase pode ter).
   Unidades em metros do jogo; o mapa vai de z=0 (início) até z=L (portal) e x de -LARG/2 a +LARG/2. */
(function(){
const LARG=26;
// gerador de números com semente (mulberry32)
function semente(s){s=s>>>0;const r=()=>{s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296};
  return{random:r,uniform:(a,b)=>a+(b-a)*r(),choice:l=>l[Math.floor(r()*l.length)],int:(a,b)=>a+Math.floor(r()*(b-a+1))}}
const r2=v=>Math.round(v*100)/100;
// n = número da fase no mundo (1..10; 11 = Desafio Lendário); f = fase (inimigos, chefe); extra = bichinhos a mais (ou a menos)
// W = ajustes do mundo (data/aventura.json → mundos[].dif): extra = bichinhos a mais, tipos_n = adianta atiradores/curandeiro/guardas, dens = {arv,ped} (quantidade de árvores e pedras)
function gera(n,f,seed,desafio,extra,W){W=W||{};const nt=n+(W.tipos_n|0),dens=W.dens||{};
  const rnd=semente(seed*1009+n),chefe=!!f.chefe;
  const L=desafio?96:chefe?150:92+n*9;
  // LABIRINTO: grade de 4 colunas (x -9,-3,3,9) × linhas de 8 m. O caminho é um passeio que vai para os lados, sobe e às vezes
  // VOLTA para baixo, sem repetir casa; paredes (árvores/pedras do mundo) fecham tudo o que não é caminho. No fim, praça aberta com o portal.
  const CW=6,RH=8,NC=4,cx=c=>-9+c*CW,praca=chefe?34:16,NR=Math.max(4,Math.floor((L-praca)/RH)),zc=r=>RH/2+r*RH,zTopo=NR*RH;
  const visto=new Set(),key=(c,r)=>c+','+r,cam=[];
  function anda(c,r){visto.add(key(c,r));cam.push([c,r]);if(r===NR-1&&cam.length>NR*1.5)return true;
    const op=[[0,1,2],[1,0,3],[-1,0,3],[0,-1,(r>1&&r<NR-2)?2.4:0]].filter(([dc,dr,w])=>w>0&&c+dc>=0&&c+dc<NC&&r+dr>=0&&r+dr<NR&&!visto.has(key(c+dc,r+dr)));
    while(op.length){let t=op.reduce((a,o)=>a+o[2],0)*rnd.random(),k=0;for(;k<op.length-1;k++){t-=op[k][2];if(t<0)break}const [dc,dr]=op.splice(k,1)[0];
      if(anda(c+dc,r+dr))return true}
    cam.pop();visto.delete(key(c,r));return false}
  const c0=rnd.int(0,NC-1);if(!anda(c0,0)){visto.clear();cam.length=0;for(let r=0;r<NR;r++){visto.add(key(c0,r));cam.push([c0,r])}}
  const noCam=new Set(cam.map(([c,r])=>key(c,r))),idx={};cam.forEach(([c,r],k)=>idx[key(c,r)]=k);
  const pts=[[cx(c0),0]];for(const [c,r] of cam)pts.push([cx(c),zc(r)]);const [cu]=cam[cam.length-1];pts.push([cx(cu),zTopo+2]);pts.push([0,zTopo+4]);pts.push([0,L]);
  const dcam=(px,pz)=>{let best=1e9;for(let k=0;k<pts.length-1;k++){const[ax,az]=pts[k],[bx,bz]=pts[k+1],vx=bx-ax,vz=bz-az,l2=vx*vx+vz*vz||1;const t=Math.max(0,Math.min(1,((px-ax)*vx+(pz-az)*vz)/l2));best=Math.min(best,Math.hypot(px-(ax+t*vx),pz-(az+t*vz)))}return best};
  const livre=[[0,L-2,5.2]];
  // área secreta: uma casa fechada do lado do caminho, com a parede aberta só para ela (um "beco" escondido)
  let secreto=null,secK=null,secPor=null;
  if(!desafio){const meio=cam.slice(Math.floor(cam.length*.35),Math.floor(cam.length*.75));for(const [c,r] of meio.sort(()=>rnd.random()-.5)){
    const viz=[[1,0],[-1,0],[0,1],[0,-1]].map(([a,b])=>[c+a,r+b]).filter(([a,b])=>a>=0&&a<NC&&b>=0&&b<NR&&!noCam.has(key(a,b)));if(viz.length){const [a,b]=viz[0];secK=key(a,b);secPor=key(c,r);secreto=[cx(a),zc(b)];break}}}
  // paredes: entre casas vizinhas que não são passos seguidos do caminho (a do segredo fica aberta)
  const arv=[],ped=[],cog=[],parede=(x0,z0,x1,z1)=>{const d=Math.hypot(x1-x0,z1-z0),n=Math.max(2,Math.round(d/1.05));for(let q=0;q<=n;q++)arv.push([r2(x0+(x1-x0)*q/n),r2(z0+(z1-z0)*q/n),r2(rnd.uniform(1.05,1.25))])};
  const ligado=(a,b)=>{const ia=idx[a],ib=idx[b];return(ia!==undefined&&ib!==undefined&&Math.abs(ia-ib)===1)||(a===secK&&b===secPor)||(b===secK&&a===secPor)};
  const aberto=k=>noCam.has(k)||k===secK;
  for(let r=0;r<NR;r++)for(let c=0;c<NC;c++){const a=key(c,r);
    if(c<NC-1){const b=key(c+1,r);if((aberto(a)||aberto(b))&&!ligado(a,b))parede(cx(c)+CW/2,r*RH,cx(c)+CW/2,(r+1)*RH)}
    if(r<NR-1){const b=key(c,r+1);if((aberto(a)||aberto(b))&&!ligado(a,b))parede(cx(c)-CW/2,(r+1)*RH,cx(c)+CW/2,(r+1)*RH)}
    if(r===NR-1&&aberto(a)&&c!==cu)parede(cx(c)-CW/2,zTopo,cx(c)+CW/2,zTopo)}// só a última casa do caminho abre para a praça
  // acampamentos nas casas do caminho (espalhados do começo ao fim)
  const total=Math.max(2,(desafio?4:chefe?9:6+n)+(extra|0)),inim=f.inimigos,camps=[];let k=0;
  const casas=cam.slice(1),nc=Math.min(casas.length,Math.max(2,Math.ceil(total/2)));
  for(let q=0;q<nc;q++){const [c,r]=casas[Math.floor((q+.5)*casas.length/nc)],X=cx(c)+rnd.uniform(-1,1),Z=zc(r)+rnd.uniform(-1.2,1.2),quant=q<nc-1?Math.min(desafio?2:3,total-k):total-k;if(quant<=0)break;
    const grupo=[];for(let j=0;j<quant;j++){const[i,lv]=inim[k%inim.length];k++;const a=j/Math.max(1,quant)*6.283+rnd.uniform(0,1);
      const e=[i,lv,r2(X+Math.cos(a)*1.5),r2(Z+Math.sin(a)*1.5)];if(desafio)e.push('elite');grupo.push(e)}
    camps.push({x:r2(X),z:r2(Z),inimigos:grupo});livre.push([X,Z,2.2])}
  let arena=null;if(chefe){const az=L-16;arena={x:0,z:az,r:9};livre.push([0,az,10])}
  // folhas douradas e morangos: dentro das casas do caminho, longe dos acampamentos
  const folhas=[];let tent=0;
  while(folhas.length<3&&tent<4000){tent++;const [c,r]=casas[rnd.int(0,casas.length-1)],x=cx(c)+rnd.uniform(-1.8,1.8),z=zc(r)+rnd.uniform(-2.5,2.5);
    if(folhas.every(([a,b])=>Math.hypot(x-a,z-b)>10)&&camps.every(cp=>Math.hypot(x-cp.x,z-cp.z)>(tent<400?5:3)))folhas.push([r2(x),r2(z)])}
  const ng=nt<6||desafio?0:nt<8?1:2,lvmax=Math.max(...inim.map(e=>e[1])),forte=inim.reduce((a,b)=>b[1]>a[1]?b:a)[0];
  for(let q=0;q<Math.min(ng,folhas.length);q++){const[fx,fz]=folhas[q],grupo=[[forte,lvmax,r2(fx+1.2),fz,'elite']];
    if(nt>=8){const[i,lv]=inim[q%inim.length];grupo.push([i,lv,r2(fx-1.2),r2(fz+.6)])}
    camps.push({x:fx,z:fz,inimigos:grupo,guarda:true})}
  if(secreto){const[sx,sz]=secreto;camps.push({x:sx,z:sz,inimigos:[[forte,lvmax+1,r2(sx+1.2),r2(sz+1),'elite']],secreto:true});secreto=[r2(sx-.6),r2(sz-1.2)]}
  const cada=nt<3||desafio?0:nt<6?4:3;let c2=0;const nor=camps.filter(cp=>!cp.guarda&&!cp.secreto);
  for(const cp of nor)for(const e of cp.inimigos){c2++;if(cada&&c2%cada===0&&e.length===4)e.push('atirador')}
  if(nt>=8&&!desafio){const big=nor[Math.floor(nor.length/2)];for(const e of big.inimigos)if(e.length===4){e.push('curandeiro');break}}
  if(chefe&&!desafio){const e=nor[nor.length-1].inimigos[0];if(e.length===4)e.push('elite')}
  const morangos=[];const nm=desafio?3:n<=3?4:n<=6?3:2;
  for(let q=0;q<nm;q++){const [c,r]=casas[Math.floor((q+.5)*casas.length/nm)];morangos.push([r2(cx(c)+rnd.uniform(-1.6,1.6)),r2(zc(r)+rnd.uniform(-2.4,2.4))])}
  // enfeites: casas fechadas ficam cheias (mato fechado), o caminho e a praça ficam livres
  const ocup=folhas.concat(morangos).map(([a,b])=>[a,b,1.4]);
  const pa=Math.min(.9,.62*(dens.arv??1)),pr=Math.min(.97,pa+.23*(dens.ped??1));
  for(let r=0;r<NR;r++)for(let c=0;c<NC;c++){if(aberto(key(c,r)))continue;for(let q=0;q<5;q++){const x=cx(c)+rnd.uniform(-2.2,2.2),z=zc(r)+rnd.uniform(-3,3),t=rnd.random(),s=rnd.uniform(.85,1.35);
    if(ocup.some(([a,b,rr])=>Math.hypot(x-a,z-b)<rr+.5))continue;ocup.push([x,z,.7]);(t<pa?arv:t<pr?ped:cog).push([r2(x),r2(z),r2(s)])}}
  // cantinhos dentro do caminho (pedras e cogumelos encostados nas paredes) e enfeites na praça, longe da trilha
  for(let q=0;q<Math.floor(L*.8);q++){const x=rnd.uniform(-LARG/2+.5,LARG/2-.5),z=rnd.uniform(0,L+2),t=rnd.random(),s=rnd.uniform(.7,1.1);
    if(dcam(x,z)<2.3||livre.some(([a,b,rr])=>Math.hypot(x-a,z-b)<rr+.4)||ocup.some(([a,b,rr])=>Math.hypot(x-a,z-b)<rr+.4))continue;ocup.push([x,z,.6]);(t<.5?ped:cog).push([r2(x),r2(z),r2(s)])}
  for(let z=-2;z<=L+2;z+=2)for(const sx of[-1,1])arv.push([r2(sx*(LARG/2+rnd.uniform(-.3,.6))),z,r2(rnd.uniform(1,1.5))]);
  for(let x=-LARG/2;x<=LARG/2;x+=2)arv.push([x,r2(-3+rnd.uniform(-.4,.4)),r2(rnd.uniform(1,1.4))]);
  return{largura:LARG,comprimento:L,caminho:pts,inicio:[cx(c0),1.5],portal:[0,L-2],acampamentos:camps,folhas,morangos,arvores:arv,pedras:ped,cogumelos:cog,arena,secreto,labirinto:{CW,RH,NR,NC},semente:seed,extra:extra|0}}
// mapa de uma partida nova: semente e quantidade de bichinhos sorteadas (variacao.menos .. variacao.mais)
function novo(n,f,desafio,V,W){V=V||{};W=W||{};const seed=1+Math.floor(Math.random()*1e9),extra=Math.floor(Math.random()*((V.mais??2)+(V.menos??1)+1))-(V.menos??1)+(W.extra|0);
  return gera(n,f,seed,desafio,extra,W)}
window.GARRO_MAPAS={gera,novo,semente};
})();
