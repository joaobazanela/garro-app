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
  const L=desafio?96:chefe?150:92+n*9;// percurso mais longo (antes 58+6n / chefão 96 / desafio 64): as fases acabavam rápido demais
  const pts=[];let x=0;
  for(let z=0;z<=L;z+=6){if(z>6&&z<L-6)x=Math.max(-8,Math.min(8,x+rnd.uniform(-4.5,4.5)));else if(z>=L-6)x*=.4;pts.push([r2(x),z])}
  const dcam=(px,pz)=>{let best=1e9;for(let k=0;k<pts.length-1;k++){const[ax,az]=pts[k],[bx,bz]=pts[k+1],vx=bx-ax,vz=bz-az;const t=Math.max(0,Math.min(1,((px-ax)*vx+(pz-az)*vz)/(vx*vx+vz*vz)));best=Math.min(best,Math.hypot(px-(ax+t*vx),pz-(az+t*vz)))}return best};
  const xcam=z=>{for(let k=0;k<pts.length-1;k++){const[ax,az]=pts[k],[bx,bz]=pts[k+1];if(az<=z&&z<=bz)return ax+(bx-ax)*(z-az)/(bz-az)}return pts[pts.length-1][0]};
  const livre=[[chefe?0:pts[pts.length-1][0],L-2,5.2]];// diorama do portal
  // acampamentos de inimigos ao longo do caminho
  const total=Math.max(2,(desafio?4:chefe?9:6+n)+(extra|0)),inim=f.inimigos,camps=[];let k=0;
  const fim=chefe?L-30:L-14,nc=Math.max(2,Math.ceil(total/2)),zs=[];for(let q=0;q<nc;q++)zs.push(14+(fim-14)*q/(nc-1));
  for(let q=0;q<nc;q++){const z=zs[q],cx=xcam(z)+rnd.uniform(-2.5,2.5),quant=q<nc-1?Math.min(desafio?2:3,total-k):total-k;if(quant<=0)break;
    const grupo=[];for(let j=0;j<quant;j++){const[i,lv]=inim[k%inim.length];k++;const a=j/Math.max(1,quant)*6.283+rnd.uniform(0,1);
      const e=[i,lv,r2(cx+Math.cos(a)*1.6),r2(z+Math.sin(a)*1.6)];if(desafio)e.push('elite');grupo.push(e)}
    camps.push({x:r2(cx),z:r2(z),inimigos:grupo});livre.push([cx,z,3.5])}
  let arena=null;
  if(chefe){const az=L-16;arena={x:0,z:az,r:9};livre.push([0,az,10]);pts[pts.length-1]=[0,L];pts[pts.length-2][0]=0;pts[pts.length-3][0]=r2(pts[pts.length-3][0]*.3)}
  // folhas douradas: fora do caminho, longe dos acampamentos
  const folhas=[];let tent=0;
  while(folhas.length<3&&tent<4000){tent++;const z=rnd.uniform(10,L-12),x=xcam(z)+rnd.choice([-1,1])*rnd.uniform(4.5,8.5);
    if(Math.abs(x)<LARG/2-2&&folhas.every(([a,b])=>Math.hypot(x-a,z-b)>8)&&camps.every(c=>Math.hypot(x-c.x,z-c.z)>(tent<400?9.5:5)))folhas.push([r2(x),r2(z)])}
  // guardas nas fases finais: folha vigiada por elite (+ ajudante)
  const ng=nt<6||desafio?0:nt<8?1:2,lvmax=Math.max(...inim.map(e=>e[1])),forte=inim.reduce((a,b)=>b[1]>a[1]?b:a)[0];
  const longe=folhas.filter(([fx,fz])=>camps.every(c=>Math.hypot(fx-c.x,fz-c.z)>9));
  for(let q=0;q<Math.min(ng,longe.length);q++){const[fx,fz]=longe[q],grupo=[[forte,lvmax,r2(fx+1.2),fz,'elite']];
    if(nt>=8){const[i,lv]=inim[q%inim.length];grupo.push([i,lv,r2(fx-1.2),r2(fz+.6)])}
    camps.push({x:fx,z:fz,inimigos:grupo,guarda:true});livre.push([fx,fz,3.2])}
  // tipos: atiradores a partir da fase 3, curandeiro a partir da 8, elite no último acampamento da fase do chefão
  const cada=nt<3||desafio?0:nt<6?4:3;let c=0;const nor=camps.filter(cp=>!cp.guarda);
  for(const cp of nor)for(const e of cp.inimigos){c++;if(cada&&c%cada===0&&e.length===4)e.push('atirador')}
  if(nt>=8&&!desafio){const big=nor[Math.floor(nor.length/2)];for(const e of big.inimigos)if(e.length===4){e.push('curandeiro');break}}
  if(chefe&&!desafio){const e=nor[nor.length-1].inimigos[0];if(e.length===4)e.push('elite')}
  const morangos=[];const nm=desafio?3:n<=3?4:n<=6?3:2;
  for(let q=0;q<nm;q++){const z=rnd.uniform(8,L-8);morangos.push([r2(xcam(z)+rnd.choice([-1,1])*rnd.uniform(2.2,3.4)),r2(z)])}
  // árvores, pedras e cogumelos (fora do caminho, dos acampamentos e dos itens)
  const arv=[],ped=[],cog=[],ocup=folhas.concat(morangos).map(([a,b])=>[a,b,1.6]);
  const ok=(x,z,r)=>dcam(x,z)>=2.9+r&&livre.every(([a,b,rr])=>Math.hypot(x-a,z-b)>=rr+r)&&ocup.every(([a,b,rr])=>Math.hypot(x-a,z-b)>=rr+r);
  const pa=Math.min(.9,.62*(dens.arv??1)),pr=Math.min(.97,pa+.23*(dens.ped??1));
  for(let q=0;q<Math.floor(L*2.3);q++){const x=rnd.uniform(-LARG/2+.5,LARG/2-.5),z=rnd.uniform(-2,L+2),t=rnd.random(),s=rnd.uniform(.85,1.35),r=t<pa?.55*s:t<pr?.5*s:.35*s;
    if(!ok(x,z,r))continue;ocup.push([x,z,r+.4]);(t<pa?arv:t<pr?ped:cog).push([r2(x),r2(z),r2(s)])}
  for(let z=-2;z<=L+2;z+=2)for(const sx of[-1,1])arv.push([r2(sx*(LARG/2+rnd.uniform(-.3,.6))),z,r2(rnd.uniform(1,1.5))]);
  for(let x=-LARG/2;x<=LARG/2;x+=2)arv.push([x,r2(-3+rnd.uniform(-.4,.4)),r2(rnd.uniform(1,1.4))]);
  return{largura:LARG,comprimento:L,caminho:pts,inicio:[pts[0][0],1.5],portal:[pts[pts.length-1][0],L-2],acampamentos:camps,folhas,morangos,arvores:arv,pedras:ped,cogumelos:cog,arena,semente:seed,extra:extra|0}}
// mapa de uma partida nova: semente e quantidade de bichinhos sorteadas (variacao.menos .. variacao.mais)
function novo(n,f,desafio,V,W){V=V||{};W=W||{};const seed=1+Math.floor(Math.random()*1e9),extra=Math.floor(Math.random()*((V.mais??2)+(V.menos??1)+1))-(V.menos??1)+(W.extra|0);
  return gera(n,f,seed,desafio,extra,W)}
window.GARRO_MAPAS={gera,novo,semente};
})();
