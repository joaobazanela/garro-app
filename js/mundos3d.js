/* GARRO — cenário 3D dos mundos da Aventura (Mar, Caverna, Trevas, Fogo e Luz), feito a partir das imagens de referência.
   Tudo é geometria 3D montada aqui (rochas esculpidas, corais, algas, conchas, cristais, cogumelos que brilham, estalagmites,
   braseiros, árvores secas, ruínas, colunas, floreiras, luminárias, nuvens, peixes, águas-vivas…), desenhada em lotes
   (InstancedMesh) por faixa do mapa para não pesar no celular. As paredes do labirinto (mapa.arvores) viram paredões do mundo;
   pedras e "cogumelos" do mapa viram peças soltas. Não há estrada desenhada no chão: o caminho é o espaço entre as paredes.
   Usado por js/aventura.js quando o mundo tem tema.cenario2 (data/aventura.json). */
(function(){
let T=null;
// ---------- utilidades ----------
const hs=(a,b,c,s)=>{const v=Math.sin(a*12.9898+b*78.233+c*37.719+s*4.17)*43758.5453;return v-Math.floor(v)};
function vn(x,y,z,s){const xi=Math.floor(x),yi=Math.floor(y),zi=Math.floor(z),xf=x-xi,yf=y-yi,zf=z-zi,u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf),w=zf*zf*(3-2*zf),
  c=(a,b,d)=>hs(xi+a,yi+b,zi+d,s),l=(a,b,t)=>a+(b-a)*t;
  return l(l(l(c(0,0,0),c(1,0,0),u),l(c(0,1,0),c(1,1,0),u),v),l(l(c(0,0,1),c(1,0,1),u),l(c(0,1,1),c(1,1,1),u),v),w)}
function rng(s){let a=(s>>>0)||1;return()=>{a=(a*1664525+1013904223)>>>0;return a/4294967296}}
const M4=()=>new T.Matrix4();
function mt(x,y,z,rx,ry,rz,sx,sy,sz){const m=M4();m.compose(new T.Vector3(x||0,y||0,z||0),new T.Quaternion().setFromEuler(new T.Euler(rx||0,ry||0,rz||0,'YXZ')),new T.Vector3(sx??1,sy??sx??1,sz??sx??1));return m}
// junta várias geometrias numa só (com cor por vértice opcional)
function junta(lista){let n=0;const gs=lista.map(([g,m,cor])=>{const q=g.index?g.toNonIndexed():g.clone();if(m)q.applyMatrix4(m);if(!q.attributes.normal)q.computeVertexNormals();n+=q.attributes.position.count;return[q,cor]});
  const P=new Float32Array(n*3),N=new Float32Array(n*3),U=new Float32Array(n*2),C=new Float32Array(n*3);let o=0;const c=new T.Color();
  for(const [q,cor] of gs){const k=q.attributes.position.count;P.set(q.attributes.position.array,o*3);N.set(q.attributes.normal.array,o*3);if(q.attributes.uv)U.set(q.attributes.uv.array,o*2);
    if(q.attributes.color)C.set(q.attributes.color.array,o*3);else{c.set(cor||'#ffffff');for(let i=0;i<k;i++){C[(o+i)*3]=c.r;C[(o+i)*3+1]=c.g;C[(o+i)*3+2]=c.b}}o+=k}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(P,3));g.setAttribute('normal',new T.BufferAttribute(N,3));g.setAttribute('uv',new T.BufferAttribute(U,2));g.setAttribute('color',new T.BufferAttribute(C,3));
  g.computeBoundingSphere();return g}
// normais suaves numa geometria sem índice (vértices na mesma posição dividem a normal)
function suave(g){const p=g.attributes.position,n=g.attributes.normal,acc={},k=i=>Math.round(p.getX(i)*1e3)+'_'+Math.round(p.getY(i)*1e3)+'_'+Math.round(p.getZ(i)*1e3);
  for(let i=0;i<p.count;i++){const q=k(i),a=acc[q]||(acc[q]=[0,0,0]);a[0]+=n.getX(i);a[1]+=n.getY(i);a[2]+=n.getZ(i)}
  for(let i=0;i<p.count;i++){const a=acc[k(i)],l=Math.hypot(a[0],a[1],a[2])||1;n.setXYZ(i,a[0]/l,a[1]/l,a[2]/l)}n.needsUpdate=true;return g}
// rocha esculpida: icosaedro deformado por ruído, base achatada; "musgo" = cor nos lados virados para cima
function geoRocha(seed,o){o=o||{};const g=new T.IcosahedronGeometry(1,o.det??2),p=g.attributes.position,v=new T.Vector3();
  for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);const n=vn(v.x*1.5+seed*3.1,v.y*1.5,v.z*1.5,seed)*.65+vn(v.x*3.6,v.y*3.6+seed,v.z*3.6,seed+1)*.35;
    v.multiplyScalar(1+(n-.5)*2*(o.amp??.38));if(o.afia&&v.y>0){const t=v.y;v.x*=1-t*.45;v.z*=1-t*.45;v.y*=1+t*.5}if(v.y<0)v.y*=.3;v.y=v.y*(o.alto??.75)+.05;p.setXYZ(i,v.x,v.y,v.z)}
  g.computeVertexNormals();if(!o.afia)suave(g);
  if(o.musgo){const nn=g.attributes.normal,C=new Float32Array(p.count*3),a=new T.Color('#ffffff'),b=new T.Color(o.musgo),c=new T.Color();
    for(let i=0;i<p.count;i++){const t=Math.max(0,Math.min(1,(nn.getY(i)-.45)*2.4))*(.6+.4*vn(p.getX(i)*4,p.getY(i)*4,p.getZ(i)*4,seed+7));c.copy(a).lerp(b,t);C[i*3]=c.r;C[i*3+1]=c.g;C[i*3+2]=c.b}
    g.setAttribute('color',new T.BufferAttribute(C,3))}
  g.computeBoundingSphere();return g}
// cristais: prismas de 6 lados com ponta, em tufo
function geoCristais(seed,n){const r=rng(seed),L=[];for(let k=0;k<n;k++){const h=.5+r()*.9,rad=.07+r()*.07,a=r()*6.28,inc=k?.25+r()*.55:r()*.15,d=k?.08+r()*.12:0;
    const pr=new T.CylinderGeometry(rad,rad*1.1,h,6),pt=new T.ConeGeometry(rad,rad*2.2,6);pt.translate(0,h/2+rad*1.1,0);pr.translate(0,h/2,0);pt.translate(0,h/2,0);
    const m=mt(Math.sin(a)*d,0,Math.cos(a)*d,Math.cos(a)*inc,r()*6,-Math.sin(a)*inc);L.push([pr,m],[pt,m])}return junta(L)}
// coral de galhos (ramos que se dividem, pontas arredondadas)
function geoCoral(seed){const r=rng(seed),L=[];function ramo(x,y,z,dx,dy,dz,len,rad,nv){const ex=x+dx*len,ey=y+dy*len,ez=z+dz*len,c=new T.CylinderGeometry(rad*.8,rad,len,6);c.translate(0,len/2,0);
    const q=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),new T.Vector3(dx,dy,dz).normalize()),m=M4().compose(new T.Vector3(x,y,z),q,new T.Vector3(1,1,1));L.push([c,m]);
    if(nv<=0||len<.12){const s=new T.SphereGeometry(rad*1.05,6,4);s.translate(ex,ey,ez);L.push([s,null]);return}
    const nf=2+(r()<.4?1:0);for(let k=0;k<nf;k++){const a=r()*6.28,sp=.35+r()*.45;let ndx=dx+Math.cos(a)*sp,ndy=dy+.15,ndz=dz+Math.sin(a)*sp;const l=Math.hypot(ndx,ndy,ndz);ramo(ex,ey,ez,ndx/l,ndy/l,ndz/l,len*(.62+r()*.2),rad*.72,nv-1)}}
  for(let k=0;k<3;k++){const a=k*2.1+r(),sp=k?.35:.05;ramo(Math.cos(a)*.06,0,Math.sin(a)*.06,Math.cos(a)*sp,1,Math.sin(a)*sp,.32+r()*.12,.07,3)}return junta(L)}
// coral cérebro (bola enrugada) e coral tubo
function geoCerebro(seed){const g=new T.SphereGeometry(.45,18,10,0,6.283,0,Math.PI*.55),p=g.attributes.position,v=new T.Vector3();
  for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);const s=1+.08*Math.sin(v.x*28+Math.sin(v.z*22)*2.2)*Math.cos(v.z*24);v.multiplyScalar(s);v.y*=.8;p.setXYZ(i,v.x,v.y,v.z)}g.computeVertexNormals();return g}
function geoTubos(seed){const r=rng(seed),L=[];for(let k=0;k<6;k++){const h=.35+r()*.5,a=r()*6.28,d=k?.12+r()*.12:0,c=new T.CylinderGeometry(.075,.06,h,8,1,true);c.translate(0,h/2,0);
    L.push([c,mt(Math.cos(a)*d,0,Math.sin(a)*d,(r()-.5)*.4,0,(r()-.5)*.4)]);const t=new T.TorusGeometry(.075,.018,4,10);t.rotateX(Math.PI/2);t.translate(0,h,0);L.push([t,mt(Math.cos(a)*d,0,Math.sin(a)*d,(r()-.5)*.4,0,(r()-.5)*.4)])}return junta(L)}
// alga: fitas altas e curvas (balançam no shader)
function geoAlga(seed){const r=rng(seed),L=[];for(let k=0;k<4;k++){const h=1.1+r()*1.1,g=new T.PlaneGeometry(.16,h,1,8),p=g.attributes.position;g.translate(0,h/2,0);
    for(let i=0;i<p.count;i++){const y=p.getY(i),t=y/h;p.setX(i,p.getX(i)*(1-t*.6)+Math.sin(t*3+k)*.12*t);p.setZ(i,Math.cos(t*2.5+k)*.1*t)}g.computeVertexNormals();
    const a=r()*6.28,d=k?.1+r()*.15:0;L.push([g,mt(Math.cos(a)*d,0,Math.sin(a)*d,0,r()*6,0)])}return junta(L)}
// concha aberta com pérola
function geoConcha(){const L=[],metade=(cima)=>{const g=new T.SphereGeometry(.5,16,6,Math.PI*.05,Math.PI*.9,0,Math.PI/2),p=g.attributes.position;
    for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),a=Math.atan2(z,x);p.setY(i,p.getY(i)*.35+Math.abs(Math.sin(a*8))*.03)}g.computeVertexNormals();return g};
  const b=metade();b.rotateX(Math.PI);b.translate(0,.17,0);L.push([b,mt(0,0,0,0,0,0,1,1,1),'#f4d6e4']);
  const t=metade();t.translate(0,0,0);L.push([t,mt(0,.17,-.42,-1.0,0,0),'#f7e2ee']);return junta(L)}
// estrela-do-mar
function geoEstrela(){const s=new T.Shape();for(let k=0;k<10;k++){const a=k/10*6.283+Math.PI/2,r=k%2?.12:.34;k?s.lineTo(Math.cos(a)*r,Math.sin(a)*r):s.moveTo(Math.cos(a)*r,Math.sin(a)*r)}
  const g=new T.ExtrudeGeometry(s,{depth:.04,bevelEnabled:true,bevelThickness:.04,bevelSize:.04,bevelSegments:2});g.rotateX(-Math.PI/2);g.translate(0,.04,0);return g}
// baú do tesouro com moedas
function geoBau(){const L=[];const cx=new T.BoxGeometry(1,.55,.65);cx.translate(0,.28,0);L.push([cx,null,'#8a5a2c']);
  const tp=new T.CylinderGeometry(.33,.33,1,12,1,false,0,Math.PI);tp.rotateZ(Math.PI/2);tp.rotateX(-.9);tp.translate(0,.62,-.25);L.push([tp,null,'#9a6634']);
  for(const x of[-.4,0,.4]){const f=new T.BoxGeometry(.07,.58,.68);f.translate(x,.29,0);L.push([f,null,'#e8b84a'])}
  const ou=new T.SphereGeometry(.42,10,6,0,6.283,0,Math.PI/2);ou.scale(1.05,.45,.68);ou.translate(0,.55,0);L.push([ou,null,'#ffd24a']);return junta(L)}
// coluna (plinto, fuste canelado, capitel); quebrada = sem capitel e mais baixa
function geoColuna(alt,quebrada,corCap){const L=[],c=new T.CylinderGeometry(.3,.33,alt,16,1),p=c.attributes.position;
  for(let i=0;i<p.count;i++){const a=Math.atan2(p.getZ(i),p.getX(i)),k=1-.06*Math.abs(Math.sin(a*8));p.setX(i,p.getX(i)*k);p.setZ(i,p.getZ(i)*k)}c.computeVertexNormals();c.translate(0,alt/2+.25,0);L.push([c,null]);
  const b=new T.BoxGeometry(.85,.25,.85);b.translate(0,.125,0);L.push([b,null]);
  if(quebrada){const t=new T.CylinderGeometry(.3,.3,.18,16);t.rotateZ(.35);t.translate(0,alt+.3,0);L.push([t,null])}
  else{const ca=new T.CylinderGeometry(.46,.3,.28,16);ca.translate(0,alt+.39,0);L.push([ca,null,corCap]);const tb=new T.BoxGeometry(.95,.16,.95);tb.translate(0,alt+.61,0);L.push([tb,null,corCap])}
  return junta(L)}
// arco em ruínas (dois pilares de blocos e o arco)
function geoArco(){const L=[];for(const x of[-1,1])for(let k=0;k<4;k++){const b=new T.BoxGeometry(.5,.45,.5);b.translate(x*.95+(k%2?.03:-.03),.23+k*.46,0);L.push([b,null])}
  const a=new T.TorusGeometry(.95,.24,4,12,Math.PI);a.rotateZ(0);a.translate(0,1.84,0);L.push([a,null]);return junta(L)}
// muro de blocos (trevas): 2–3 fiadas, com falhas
function geoMuro(seed){const r=rng(seed),L=[];for(let f=0;f<3;f++)for(let k=0;k<3;k++){if(f===2&&r()<.5)continue;const w=.38+r()*.08,b=new T.BoxGeometry(w,.36,.5);b.translate(-.37+k*.37+(f%2?.18:0)-.09,.18+f*.37,(r()-.5)*.06);
    L.push([b,mt(0,0,0,0,(r()-.5)*.08,0)])}return junta(L)}
// árvore seca torta
function geoArvSeca(seed){const r=rng(seed),L=[];function ramo(x,y,z,dx,dy,dz,len,rad,nv){const c=new T.CylinderGeometry(rad*.65,rad,len,5);c.translate(0,len/2,0);
    const q=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),new T.Vector3(dx,dy,dz).normalize());L.push([c,M4().compose(new T.Vector3(x,y,z),q,new T.Vector3(1,1,1))]);if(nv<=0)return;
    const ex=x+dx*len,ey=y+dy*len,ez=z+dz*len,nf=nv>2?2:2+(r()<.5?1:0);for(let k=0;k<nf;k++){const a=r()*6.28,sp=.6+r()*.6;let a1=dx+Math.cos(a)*sp,a2=dy*.6+.05,a3=dz+Math.sin(a)*sp;const l=Math.hypot(a1,a2,a3);ramo(ex,ey,ez,a1/l,a2/l,a3/l,len*(.6+r()*.15),rad*.62,nv-1)}}
  ramo(0,0,0,(r()-.5)*.3,1,(r()-.5)*.3,1.3,.16,4);return junta(L)}
// tufo de capim (fino e pontudo)
function geoCapim(seed){const r=rng(seed),L=[];for(let k=0;k<9;k++){const h=.25+r()*.35,c=new T.ConeGeometry(.025,h,3);c.translate(0,h/2,0);const a=r()*6.28,d=r()*.18;L.push([c,mt(Math.cos(a)*d,0,Math.sin(a)*d,(r()-.5)*.6,0,(r()-.5)*.6)])}return junta(L)}
// cogumelo (pé claro + chapéu que brilha) em grupinho
function geoCogPe(seed){const r=rng(seed),L=[];for(let k=0;k<3;k++){const h=.3+r()*.5,a=k*2.1+r(),d=k?.22:0,c=new T.CylinderGeometry(.045,.065,h,7);c.translate(Math.cos(a)*d,h/2,Math.sin(a)*d);L.push([c,null])}return junta(L)}
function geoCogChapeu(seed){const r=rng(seed),L=[];for(let k=0;k<3;k++){const h=.3+r()*.5,a=k*2.1+r(),d=k?.22:0,s=.17+r()*.12,c=new T.SphereGeometry(1,12,6,0,6.283,0,Math.PI/2);c.scale(s,s*.55,s);c.translate(Math.cos(a)*d,h,Math.sin(a)*d);L.push([c,null])}return junta(L)}
// estalagmite
function geoEstalag(seed){const g=new T.CylinderGeometry(.02,.32,1.5,7,5),p=g.attributes.position;g.translate(0,.75,0);
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),n=1+(vn(x*6,y*3,z*6,seed)-.5)*.5;p.setXYZ(i,x*n,y,z*n)}g.computeVertexNormals();return g}
// braseiro: taça sobre pedestal
function geoBraseiro(){const pf=[[0,0],[.32,0],[.3,.12],[.12,.2],[.1,.75],[.16,.8],[.42,.95],[.46,1.08],[.38,1.1],[0,1.0]].map(([x,y])=>new T.Vector2(x,y));return new T.LatheGeometry(pf,12)}
// floreira com lírios (luz)
function geoFloreira(seed){const r=rng(seed),L=[];const v=new T.CylinderGeometry(.5,.42,.5,14);v.translate(0,.25,0);L.push([v,null,'#f2efe8']);const aro=new T.TorusGeometry(.5,.05,5,16);aro.rotateX(Math.PI/2);aro.translate(0,.5,0);L.push([aro,null,'#e8c050']);
  for(let k=0;k<10;k++){const f=new T.ConeGeometry(.06,.5,4);f.scale(1,1,.3);f.translate(0,.25,0);const a=r()*6.28,d=r()*.32;L.push([f,mt(Math.cos(a)*d,.45,Math.sin(a)*d,(r()-.5)*1,r()*6,(r()-.5)*1),'#4f9a4a'])}
  for(let k=0;k<5;k++){const a=r()*6.28,d=r()*.3,x=Math.cos(a)*d,z=Math.sin(a)*d,y=.75+r()*.2;for(let p=0;p<6;p++){const pe=new T.ConeGeometry(.05,.2,3);pe.scale(1,1,.3);pe.translate(0,.1,0);L.push([pe,mt(x,y,z,1.1,p*1.047,0),'#ffffff'])}
    const c=new T.SphereGeometry(.035,5,4);c.translate(x,y+.03,z);L.push([c,null,'#ffd84a'])}return junta(L)}
// pedestal dourado das luminárias de cristal
function geoPedestal(){const pf=[[0,0],[.3,0],[.3,.1],[.12,.2],[.09,.9],[.2,1.0],[.24,1.1],[0,1.1]].map(([x,y])=>new T.Vector2(x,y));return new T.LatheGeometry(pf,10)}
// balaustrada (luz): mureta com balaústres e corrimão
function geoBalaustre(){const L=[],pf=[[0,0],[.09,0],[.09,.06],[.05,.12],[.1,.3],[.05,.48],[.08,.52],[0,.52]].map(([x,y])=>new T.Vector2(x,y));
  for(let k=0;k<4;k++){const b=new T.LatheGeometry(pf,8);b.translate(-.39+k*.26,.12,0);L.push([b,null])}const base=new T.BoxGeometry(1.08,.12,.34);base.translate(0,.06,0);L.push([base,null]);
  const top=new T.BoxGeometry(1.1,.1,.3);top.translate(0,.69,0);L.push([top,null,'#e8c050']);return junta(L)}
// nuvem (bolas fofas)
function geoNuvem(seed){const r=rng(seed),L=[];for(let k=0;k<7;k++){const s=.5+r()*.6,g=new T.SphereGeometry(s,10,7);g.translate((r()-.5)*2.4,s*.4+r()*.3,(r()-.5)*1.4);L.push([g,null])}return junta(L)}
// peixinho (corpo + rabo)
function geoPeixe(){const c=new T.SphereGeometry(.12,8,6);c.scale(1,.7,2);const r=new T.ConeGeometry(.09,.16,4);r.rotateX(-Math.PI/2);r.scale(.3,1,1);r.translate(0,0,-.3);return junta([[c,null],[r,null]])}
// água-viva: cúpula + tentáculos
function geoAguaViva(){const L=[],d=new T.SphereGeometry(.38,14,8,0,6.283,0,Math.PI/2);d.scale(1,.8,1);L.push([d,null]);
  for(let k=0;k<8;k++){const a=k/8*6.283,t=new T.CylinderGeometry(.015,.008,.9,3);t.translate(Math.cos(a)*.22,-.45,Math.sin(a)*.22);L.push([t,null])}return junta(L)}
// textura de brilho redondo e de facho de luz
function texArq(url,rep){const t=new T.TextureLoader().load(url);t.wrapS=t.wrapT=T.RepeatWrapping;if(rep)t.repeat.set(rep[0],rep[1]);return t}
function texCanvas(f,w,h){const c=document.createElement('canvas');c.width=w;c.height=h||w;f(c.getContext('2d'),w,h||w);const t=new T.CanvasTexture(c);return t}
let TX={};
function texturas(){if(TX.halo)return TX;
  TX.halo=texCanvas((x,w)=>{const g=x.createRadialGradient(w/2,w/2,0,w/2,w/2,w/2);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.25,'rgba(255,255,255,.55)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,w,w)},64);
  TX.facho=texCanvas((x,w,h)=>{const g=x.createLinearGradient(0,0,0,h);g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(.35,'rgba(255,255,255,.7)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,w,h);
    const g2=x.createLinearGradient(0,0,w,0);g2.addColorStop(0,'rgba(0,0,0,1)');g2.addColorStop(.5,'rgba(0,0,0,0)');g2.addColorStop(1,'rgba(0,0,0,1)');x.globalCompositeOperation='destination-out';x.fillStyle=g2;x.fillRect(0,0,w,h)},32,128);
  TX.chama=texCanvas((x,w,h)=>{const g=x.createRadialGradient(w/2,h*.72,2,w/2,h*.62,w*.5);g.addColorStop(0,'rgba(255,255,230,1)');g.addColorStop(.3,'rgba(255,220,120,.9)');g.addColorStop(.7,'rgba(255,255,255,.35)');g.addColorStop(1,'rgba(255,255,255,0)');
    x.fillStyle=g;x.beginPath();x.moveTo(w/2,0);x.bezierCurveTo(w*.95,h*.45,w*.95,h*.95,w/2,h*.98);x.bezierCurveTo(w*.05,h*.95,w*.05,h*.45,w/2,0);x.fill()},64,96);
  TX.estrela=texCanvas((x,w)=>{x.translate(w/2,w/2);x.strokeStyle='rgba(232,190,80,1)';x.fillStyle='rgba(232,190,80,1)';x.lineWidth=w*.012;
    for(const r of[.47,.43,.25])x.beginPath(),x.arc(0,0,r*w,0,7),x.stroke();
    const est=(n,r1,r2,rot)=>{x.beginPath();for(let k=0;k<n*2;k++){const a=k/(n*2)*6.283+rot,r=k%2?r2:r1;k?x.lineTo(Math.cos(a)*r*w,Math.sin(a)*r*w):x.moveTo(Math.cos(a)*r*w,Math.sin(a)*r*w)}x.closePath()};
    est(8,.42,.12,0);x.globalAlpha=.55;x.fill();x.globalAlpha=1;est(4,.46,.08,0);x.fill()},256);
  for(const k in TX)TX[k].encoding=T.sRGBEncoding;return TX}
// ---------- lotes por faixa do mapa ----------
function Lotes(S,blocos,BZ){const G_=new Map();
  return{elev:0,add(g,mat,m,cor){if(this.elev)m.elements[13]+=this.elev;const ch=Math.floor(m.elements[14]/BZ),k=g.uuid+'|'+mat.uuid+'|'+ch;let e=G_.get(k);if(!e)G_.set(k,e={g,mat,ch,ms:[],cs:[]});e.ms.push(m);e.cs.push(cor||null)},
    fecha(){const c=new T.Color();for(const e of G_.values()){const im=new T.InstancedMesh(e.g,e.mat,e.ms.length),tc=e.cs.some(Boolean);e.ms.forEach((m,i)=>{im.setMatrixAt(i,m);if(tc)im.setColorAt(i,c.set(e.cs[i]||'#ffffff'))});
      im.instanceMatrix.needsUpdate=true;if(im.instanceColor)im.instanceColor.needsUpdate=true;im.frustumCulled=false;S.add(im);blocos.push({m:im,z0:e.ch*BZ-3.5,z1:(e.ch+1)*BZ+3.5,x0:-99,x1:99})}}}}
// shader: balanço (algas, capim) e chama tremendo
function balanca(mat,U,forca,kind){mat.onBeforeCompile=sh=>{sh.uniforms.uT=U.uT;sh.vertexShader='uniform float uT;\n'+sh.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
  #ifdef USE_INSTANCING
  vec4 ip=instanceMatrix[3];
  #else
  vec4 ip=vec4(0.);
  #endif
  ${kind==='chama'?`float fl=sin(uT*11.+ip.x*3.1+ip.z*5.3)*.5+.5;transformed.x+=sin(uT*8.+transformed.y*5.+ip.z)*.07*transformed.y;transformed.y*=.82+.32*fl;`
  :`float hh=max(transformed.y,0.);transformed.x+=sin(uT*1.7+ip.x*.7+ip.z*.9)*hh*hh*${forca.toFixed(3)};transformed.z+=cos(uT*1.3+ip.x*.5+ip.z*.3)*hh*hh*${(forca*.6).toFixed(3)};`}`)};
  mat.customProgramCacheKey=()=>'m3d_'+kind+forca}
// partículas (brasas que sobem, faíscas, esporos, bolhas): um só desenho para o mapa inteiro
function particulas(S,U,W,L,n,cor,tam,vel,alt,seed){const r=rng(seed),P=new Float32Array(n*3),F=new Float32Array(n);for(let i=0;i<n;i++){P[i*3]=(r()-.5)*W;P[i*3+1]=r()*alt;P[i*3+2]=-4+r()*(L+8);F[i]=r()*6.28}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(P,3));g.setAttribute('fase',new T.BufferAttribute(F,1));
  const m=new T.ShaderMaterial({uniforms:{uT:U.uT,uCor:{value:new T.Color(cor)},uTam:{value:tam},uVel:{value:vel},uAlt:{value:alt}},transparent:true,depthWrite:false,blending:T.AdditiveBlending,
    vertexShader:'uniform float uT,uTam,uVel,uAlt;attribute float fase;varying float vA;void main(){vec3 p=position;p.y=mod(p.y+uT*uVel,uAlt);p.x+=sin(uT*.8+fase)*.4;p.z+=cos(uT*.6+fase)*.3;vA=sin(p.y/uAlt*3.1416)*(.6+.4*sin(uT*3.+fase*5.));vec4 mv=modelViewMatrix*vec4(p,1.);gl_PointSize=uTam*(300./-mv.z);gl_Position=projectionMatrix*mv;}',
    fragmentShader:'uniform vec3 uCor;varying float vA;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;gl_FragColor=vec4(uCor,(1.-d*2.)*vA);}'});
  const pt=new T.Points(g,m);pt.frustumCulled=false;S.add(pt);return pt}
// ---------- montagem do mundo ----------
function monta(ctx){T=ctx.T;const {S,M,blocos,texPBR}=ctx,TT=M.tema||{},E=TT.cenario2,mundo=E&&E.estilo;if(!mundo)return null;
  const tx=texturas(),U={uT:{value:0}},rnd=rng(M.semente*7+M.comprimento*13+5),LT=Lotes(S,blocos,14),anim=[],W=M.largura,L=M.comprimento;
  // olhando para a câmera (que nunca gira): placas de brilho/chama/facho sempre de frente
  const qCam=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,0,1),new T.Vector3(0,ctx.cam[0],-ctx.cam[1]).normalize()),mCam=new T.Matrix4().makeRotationFromQuaternion(qCam);
  const bill=(w,h,y0)=>{const g=new T.PlaneGeometry(w,h);g.translate(0,h/2+(y0||0),0);g.applyMatrix4(mCam);return g};
  const halo=bill(1,1,-.5),haloMat=new T.MeshBasicMaterial({map:tx.halo,transparent:true,depthWrite:false,blending:T.AdditiveBlending,opacity:E.halo??.55});
  const brilho=(x,y,z,s,cor)=>LT.add(halo,haloMat,mt(x,y,z,0,0,0,s,s,s),cor);
  // materiais
  const rochaTex={map:texArq('img/tex/comum/rocha_cor.jpg',[2,1]),normalMap:texArq('img/tex/comum/rocha_normal.jpg',[2,1])};rochaTex.map.encoding=T.sRGBEncoding;
  const mRocha=new T.MeshStandardMaterial(Object.assign({color:E.rocha||'#8a8a8a',roughness:.92,metalness:0,vertexColors:true},rochaTex));mRocha.normalScale.set(.9,.9);
  const mVC=new T.MeshStandardMaterial({vertexColors:true,roughness:.75,metalness:0});
  const mCor=new T.MeshStandardMaterial({color:'#ffffff',roughness:.7,metalness:0});// cor por instância
  const mLuz=new T.MeshBasicMaterial({color:'#ffffff'});// "acende" (cor por instância, ignora sombra)
  const mCristal=c=>new T.MeshStandardMaterial({color:c,emissive:c,emissiveIntensity:E.cristal_brilho??.75,roughness:.12,metalness:.15,flatShading:true});
  // posição de cada parede e sua direção (vizinho mais próximo)
  const A=M.arvores,dir=A.map(([x,z],i)=>{let b=null,bd=9;for(let j=0;j<A.length;j++){if(j===i)continue;const d=Math.hypot(A[j][0]-x,A[j][1]-z);if(d<bd){bd=d;b=A[j]}}return b?Math.atan2(b[0]-x,b[1]-z):0});
  const dcam=(px,pz)=>{let best=1e9;const P=M.caminho;for(let k=0;k<P.length-1;k++){const[ax,az]=P[k],[bx,bz]=P[k+1],vx=bx-ax,vz=bz-az,l2=vx*vx+vz*vz||1,t=Math.max(0,Math.min(1,((px-ax)*vx+(pz-az)*vz)/l2));best=Math.min(best,Math.hypot(px-(ax+t*vx),pz-(az+t*vz)))}return best};
  const borda=[];for(const sx of[-1,1])for(let z=-5;z<=L+5;z+=1.5)for(const dx of[1.4,3.1,4.9])borda.push([sx*(W/2+dx+(rnd()-.5)*.6),z+(rnd()-.5)*.8,1.1+rnd()*.6,0,1]);
  for(let x=-W/2-5;x<=W/2+5;x+=1.5)for(const dz of[1.2,3])borda.push([x+(rnd()-.5)*.6,-3-dz,1.1+rnd()*.5,0,1]);
  const paredes=A.map(([x,z,s],i)=>[x,z,s,dir[i],0]).concat(borda);
  const R3=[0,1,2].map(k=>geoRocha(11+k*7,{musgo:E.musgo,amp:.4,alto:.75})),RA=[0,1,2].map(k=>geoRocha(31+k*5,{det:1,afia:true,amp:.5,alto:.9}));
  const rocha=(x,z,s,ry,alto,cor)=>{const sy=s*(alto||1)*(E.rocha_alto??.75)/.75;LT.add(R3[Math.floor(rnd()*3)],mRocha,mt(x,0,z,0,ry,0,s,sy,s*(.8+rnd()*.4)),cor);return sy*.82};
  // sombra no pé das paredes (separa a parede do chão, vista de cima)
  const sombraM=new T.MeshBasicMaterial({map:tx.halo,color:'#000000',transparent:true,opacity:E.sombra??.55,depthWrite:false}),sombraG=new T.PlaneGeometry(1,1);sombraG.rotateX(-Math.PI/2);
  A.forEach(([x,z])=>LT.add(sombraG,sombraM,mt(x,.022,z,0,0,0,2.9,1,2.9)));
  // ladoFn: enfeite encostado na parede, do lado de dentro do corredor (devolve o raio de colisão); chaoFn: miudezas soltas no chão
  let ladoFn=null,chaoFn=null,pLado=.55;const obs=[];
  // ------------------------------------------------------------------ MAR
  if(mundo==='mar'){const CO=[geoCoral(3),geoCoral(8),geoCoral(15)],CB=geoCerebro(2),TU=geoTubos(4),AL=[geoAlga(1),geoAlga(6)],CN=geoConcha(),ES=geoEstrela(),BA=geoBau(),COL=geoColuna(1.4,true),AR=geoArco(),PE=new T.SphereGeometry(.11,10,8);
    const mAlga=new T.MeshStandardMaterial({color:'#ffffff',vertexColors:true,roughness:.6,side:T.DoubleSide});balanca(mAlga,U,.09,'alga');
    const mRuina=new T.MeshStandardMaterial(Object.assign({color:'#8fa7a8',roughness:.9,vertexColors:true},rochaTex));
    const cores=['#b45aff','#ff5aa0','#ff8a3a','#ff6a6a','#d46aff','#ffb03a'];const ca=()=>cores[Math.floor(rnd()*cores.length)];
    const enfeite=(x,z,s,forte)=>{s*=1.25;const t=rnd();if(t<.42)LT.add(CO[Math.floor(rnd()*3)],mCor,mt(x,.1,z,0,rnd()*6,0,s*1.5),ca());else if(t<.58)LT.add(TU,mCor,mt(x,.1,z,0,rnd()*6,0,s*1.2),ca());
      else if(t<.7)LT.add(CB,mCor,mt(x,.05,z,0,rnd()*6,0,s),['#ff7aa8','#c47aff','#ffa04a'][Math.floor(rnd()*3)]);else LT.add(AL[Math.floor(rnd()*2)],mAlga,mt(x,0,z,0,rnd()*6,0,s*(forte?1.4:1.1)),['#4fbf5a','#3aa070','#7ad05a'][Math.floor(rnd()*3)])};
    ladoFn=(x,z)=>{const t=rnd();if(t<.3){rocha(x,z,.45+rnd()*.2,rnd()*6,1.2,'#8aa0b4');enfeite(x+(rnd()-.5)*.3,z+(rnd()-.5)*.3,.7,0);return .45}if(t<.75){enfeite(x,z,.8+rnd()*.4,0);return .3}LT.add(AL[Math.floor(rnd()*2)],mAlga,mt(x,0,z,0,rnd()*6,0,1+rnd()*.4),['#4fbf5a','#3aa070','#7ad05a'][Math.floor(rnd()*3)]);return 0};
    chaoFn=(x,z)=>{const t=rnd();if(t<.35)LT.add(ES,mCor,mt(x,0,z,0,rnd()*6,0,.6+rnd()*.4),['#ff7a3a','#ffb04a','#ff6a8a'][Math.floor(rnd()*3)]);else if(t<.6)rocha(x,z,.2+rnd()*.2,rnd()*6,.8,'#9aaabb');else if(t<.8)LT.add(AL[Math.floor(rnd()*2)],mAlga,mt(x,0,z,0,rnd()*6,0,.6+rnd()*.3),'#5ab05a');else enfeite(x,z,.5,0)};
    for(const [x,z,s,ry,bd] of paredes){const top=rocha(x,z,(bd?1.4:.8+rnd()*.15)*s,rnd()*6,bd?1.5:1.5,['#7d93a8','#6f86a0','#8a9cb0'][Math.floor(rnd()*3)]);
      LT.elev=top*.8;const n=bd?2:1+(rnd()<.6?1:0);for(let q=0;q<n;q++)enfeite(x+(rnd()-.5)*.4,z+(rnd()-.5)*.4,bd?.8+rnd()*.4:.5+rnd()*.25,bd);LT.elev=0}
    for(const [x,z,s] of M.pedras){const f=dcam(x,z)>3.2;if(f&&rnd()<.35){LT.add(COL,mRuina,mt(x,0,z,0,rnd()*6,(rnd()-.5)*.15,s*.9));continue}rocha(x,z,.5*s,rnd()*6,.9,'#8297aa');enfeite(x+.3,z+.2,.6,0)}
    for(const [x,z,s] of M.cogumelos){const f=dcam(x,z)>3.2,t=rnd();
      if(f&&t<.25){LT.add(BA,mVC,mt(x,0,z,0,rnd()*6,0,.9));brilho(x,.75,z,1.6,'#ffd86a')}
      else if(t<.6){const ry=rnd()*6;LT.add(CN,mVC,mt(x,0,z,0,ry,0,s*.9));LT.add(PE,mLuz,mt(x+Math.sin(ry)*.05*s,.25*s,z+Math.cos(ry)*.05*s,0,0,0,s),'#fff4fa');brilho(x,.3*s,z,.9*s,'#ffe6f6')}
      else LT.add(ES,mCor,mt(x,0,z,0,rnd()*6,0,s*.9),['#ff7a3a','#ff9a4a','#ff6a5a'][Math.floor(rnd()*3)])}
    // ruínas e arcos nas casas fechadas
    for(const [x,z] of M.pedras.filter(([x,z])=>dcam(x,z)>4.5).slice(0,Math.floor(L/22)))LT.add(AR,mRuina,mt(x,0,z,0,rnd()*3,0,.9));
    // cáusticas (luz do sol tremendo no fundo), fachos de luz, peixes e águas-vivas
    const camC=[];for(const [vel,rep,op] of[[[.012,.02],(W+24)/5,E.causticas_forca??.2],[[-.017,.011],(W+24)/3.8,(E.causticas_forca??.2)*.65]]){const t=texArq('img/tex/mar/causticas.jpg',[rep,rep*(L+24)/(W+24)]);
      const m=new T.Mesh(new T.PlaneGeometry(W+24,L+24),new T.MeshBasicMaterial({map:t,color:E.causticas||'#a8f2ff',transparent:true,opacity:op,blending:T.AdditiveBlending,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.set(0,.03,L/2);S.add(m);camC.push([t,vel])}
    anim.push((dt,tt)=>{for(const [t,v] of camC){t.offset.x=(tt*v[0])%1;t.offset.y=(tt*v[1])%1}});
    const facho=new T.PlaneGeometry(1.6,10);facho.translate(0,5,0);facho.applyMatrix4(mCam);const mF=new T.MeshBasicMaterial({map:tx.facho,color:'#c8f6ff',transparent:true,opacity:.16,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide});
    for(let z=4;z<L;z+=5+rnd()*5)LT.add(facho,mF,mt((rnd()-.5)*W*.9,0,z,0,0,(rnd()-.5)*.5,1+rnd()));
    anim.push((dt,tt)=>{mF.opacity=.13+Math.sin(tt*.7)*.05});
    const PX=geoPeixe(),cardumes=[],nC=Math.floor(L/14);const imP=new T.InstancedMesh(PX,new T.MeshStandardMaterial({color:'#ffffff',roughness:.4,metalness:.2}),nC*7);imP.frustumCulled=false;S.add(imP);
    for(let k=0;k<nC;k++){const cor=['#ffb03a','#ffd84a','#5ad8ff','#ff7a5a','#b4f0ff'][k%5];cardumes.push({x:(rnd()-.5)*W*.8,z:6+k*14+rnd()*6,r:2+rnd()*2.5,v:(rnd()<.5?-1:1)*(.3+rnd()*.3),f:rnd()*6,y:1.6+rnd()*1.2});for(let q=0;q<7;q++)imP.setColorAt(k*7+q,new T.Color(cor))}
    imP.instanceColor.needsUpdate=true;const o3=new T.Object3D();
    anim.push((dt,tt)=>{cardumes.forEach((c,k)=>{for(let q=0;q<7;q++){const a=c.f+tt*c.v+q*.22,rr=c.r+Math.sin(q*1.7)*.5;o3.position.set(c.x+Math.cos(a)*rr,c.y+Math.sin(q*2.1+tt)*.2,c.z+Math.sin(a)*rr);o3.rotation.set(0,-a+(c.v>0?0:Math.PI),0);o3.updateMatrix();imP.setMatrixAt(k*7+q,o3.matrix)}});imP.instanceMatrix.needsUpdate=true});
    const AV=geoAguaViva(),mAV=new T.MeshBasicMaterial({color:'#ff9ae0',transparent:true,opacity:.55,blending:T.AdditiveBlending,depthWrite:false}),nAV=Math.floor(L/16),imA=new T.InstancedMesh(AV,mAV,nAV),avs=[];imA.frustumCulled=false;S.add(imA);
    for(let k=0;k<nAV;k++)avs.push({x:(rnd()-.5)*W*.9,z:8+k*16+rnd()*8,f:rnd()*6,y:2.4+rnd()*1.2});
    anim.push((dt,tt)=>{avs.forEach((a,k)=>{o3.position.set(a.x+Math.sin(tt*.2+a.f)*.6,a.y+Math.sin(tt*1.2+a.f)*.35,a.z);const p=1+Math.sin(tt*2.4+a.f)*.08;o3.rotation.set(0,0,0);o3.scale.set(p,1/p,p);o3.updateMatrix();imA.setMatrixAt(k,o3.matrix)});imA.instanceMatrix.needsUpdate=true});
    particulas(S,U,W+8,L,260,'#dff8ff',.18,.35,4,9);
  }
  // ------------------------------------------------------------------ CAVERNA
  if(mundo==='caverna'){const CR=[geoCristais(5,6),geoCristais(9,5),geoCristais(13,7)],EG=[geoEstalag(1),geoEstalag(4)],CP=geoCogPe(3),CC=geoCogChapeu(3),CP2=geoCogPe(7),CC2=geoCogChapeu(7),BA=geoBau();
    const mCr={roxo:mCristal('#b46aff'),azul:mCristal('#5ae0ff'),rosa:mCristal('#ff6ad9')},crCor={roxo:'#c58aff',azul:'#7aeaff',rosa:'#ff8ae0'};const ks=Object.keys(mCr);
    const mEst=new T.MeshStandardMaterial(Object.assign({color:'#9a8494',roughness:.9},rochaTex));
    const cristal=(x,z,s)=>{const k=ks[Math.floor(rnd()*ks.length)];LT.add(CR[Math.floor(rnd()*3)],mCr[k],mt(x,0,z,(rnd()-.5)*.3,rnd()*6,(rnd()-.5)*.3,s));brilho(x,.5*s,z,2.2*s,crCor[k])};
    const cogu=(x,z,s)=>{const v=rnd()<.5,ry=rnd()*6,cor=['#5af0ff','#ff7ae0','#b48aff'][Math.floor(rnd()*3)];LT.add(v?CP:CP2,mCor,mt(x,0,z,0,ry,0,s),'#e8dcd0');LT.add(v?CC:CC2,mLuz,mt(x,0,z,0,ry,0,s),cor);brilho(x,.55*s,z,1.6*s,cor)};
    ladoFn=(x,z)=>{const t=rnd();if(t<.35){cristal(x,z,.7+rnd()*.5);return .35}if(t<.65){cogu(x,z,.9+rnd()*.5);return .3}if(t<.85){LT.add(EG[Math.floor(rnd()*2)],mEst,mt(x,0,z,0,rnd()*6,0,.6+rnd()*.5));return .3}rocha(x,z,.4+rnd()*.25,rnd()*6,1.1,'#8a7686');return .4};
    chaoFn=(x,z)=>{const t=rnd();if(t<.5)rocha(x,z,.2+rnd()*.2,rnd()*6,.9,'#8a7686');else if(t<.75)cogu(x,z,.45+rnd()*.25);else LT.add(CR[Math.floor(rnd()*3)],mCr[ks[Math.floor(rnd()*3)]],mt(x,0,z,0,rnd()*6,0,.35+rnd()*.2))};
    for(const [x,z,s,ry,bd] of paredes){const top=rocha(x,z,(bd?1.5:.82+rnd()*.15)*s,rnd()*6,bd?1.9:1.8,['#b09aa6','#9a8aa8','#b8a0a8'][Math.floor(rnd()*3)]);const t=rnd();LT.elev=top*.75;
      if(t<.34)cristal(x+(rnd()-.5)*.5,z+(rnd()-.5)*.5,.8+rnd()*.6);else if(t<.52)cogu(x+(rnd()-.5)*.5,z+(rnd()-.5)*.5,.9+rnd()*.5);else if(t<.72)LT.add(EG[Math.floor(rnd()*2)],mEst,mt(x+(rnd()-.5)*.4,0,z+(rnd()-.5)*.4,0,rnd()*6,0,(.6+rnd()*.5)*(bd?1.5:1)));LT.elev=0}
    for(const [x,z,s] of M.pedras){if(rnd()<.5){LT.add(EG[Math.floor(rnd()*2)],mEst,mt(x,0,z,0,rnd()*6,0,.7*s+.3));LT.add(EG[0],mEst,mt(x+.35,0,z+.2,0,1,0,.45*s))}else rocha(x,z,.55*s,rnd()*6,1,'#7a6676')}
    for(const [x,z,s] of M.cogumelos){const f=dcam(x,z)>3.2,t=rnd();if(f&&t<.18){LT.add(BA,mVC,mt(x,0,z,0,rnd()*6,0,.85));brilho(x,.7,z,1.6,'#ffd86a')}else if(t<.55)cristal(x,z,.8*s+.2);else cogu(x,z,1.1*s)}
    // poças de água que brilham nas casas fechadas
    const cau=texArq('img/tex/mar/causticas.jpg',[.5,.5]);
    const mPoca=new T.MeshBasicMaterial({color:'#2ad8ff',map:cau,transparent:true,opacity:.85}),pocas=M.pedras.filter(([x,z])=>dcam(x,z)>4).slice(0,Math.floor(L/18));
    for(const [x,z] of pocas){const g=new T.CircleGeometry(1.3,18),p=g.attributes.position;for(let i=1;i<p.count;i++){const a=Math.atan2(p.getY(i),p.getX(i)),k=.75+.35*vn(Math.cos(a)*2,Math.sin(a)*2,x,3);p.setXY(i,p.getX(i)*k,p.getY(i)*k)}
      const m=new T.Mesh(g,mPoca);m.rotation.x=-Math.PI/2;m.position.set(x,.04,z);S.add(m);brilho(x,.1,z,3.2,'#3ae0ff')}
    anim.push((dt,tt)=>{cau.offset.set(tt*.03%1,tt*.02%1)});
    particulas(S,U,W+8,L,220,'#c8a8ff',.16,.25,4,13);
  }
  // ------------------------------------------------------------------ TREVAS
  if(mundo==='trevas'){const MU=[geoMuro(2),geoMuro(5),geoMuro(9)],AS=[geoArvSeca(3),geoArvSeca(8),geoArvSeca(12)],CR=[geoCristais(4,6),geoCristais(10,5)],CA=geoCapim(2),BR=geoBraseiro(),AR=geoArco();
    const mMuro=new T.MeshStandardMaterial(Object.assign({color:'#5a566a',roughness:.95,vertexColors:true},rochaTex)),mArv=new T.MeshStandardMaterial(Object.assign({color:'#3a3040',roughness:.95,vertexColors:true},rochaTex));
    const mCap=new T.MeshStandardMaterial({color:'#7a4ab8',roughness:.8,emissive:'#3a1a6a',emissiveIntensity:.5});balanca(mCap,U,.25,'capim');
    const cr1=mCristal('#b46aff'),cr2=mCristal('#8a5aff');const mBr=new T.MeshStandardMaterial(Object.assign({color:'#4a4652',roughness:.6,metalness:.4},rochaTex));
    const chama=bill(.55,.9,-.05),mCh=new T.MeshBasicMaterial({map:tx.chama,color:E.chama||'#b46aff',transparent:true,depthWrite:false,blending:T.AdditiveBlending});balanca(mCh,U,0,'chama');
    const braseiro=(x,z)=>{LT.add(BR,mBr,mt(x,0,z,0,0,0,1));LT.add(chama,mCh,mt(x,1.05,z,0,0,0,1.2));brilho(x,1.4,z,3,E.chama||'#a45aff')};
    const cristal=(x,z,s)=>{LT.add(CR[Math.floor(rnd()*2)],rnd()<.5?cr1:cr2,mt(x,0,z,(rnd()-.5)*.3,rnd()*6,(rnd()-.5)*.3,s));brilho(x,.4*s,z,2*s,'#b07aff')};
    ladoFn=(x,z)=>{const t=rnd();if(t<.3){cristal(x,z,.6+rnd()*.5);return .3}if(t<.45){LT.add(AS[Math.floor(rnd()*3)],mArv,mt(x,0,z,0,rnd()*6,0,.9+rnd()*.4));return .3}if(t<.75){LT.add(CA,mCap,mt(x,0,z,0,rnd()*6,0,1.1+rnd()*.6));return 0}rocha(x,z,.4+rnd()*.25,rnd()*6,1,'#5e5a6e');return .4};
    chaoFn=(x,z)=>{const t=rnd();if(t<.55)LT.add(CA,mCap,mt(x,0,z,0,rnd()*6,0,.8+rnd()*.5));else rocha(x,z,.2+rnd()*.2,rnd()*6,.9,'#5e5a6e')};
    paredes.forEach(([x,z,s,ry,bd],i)=>{if(bd){rocha(x,z,1.3*s,rnd()*6,1.5,['#4a4658','#3e3a4c'][Math.floor(rnd()*2)]);if(rnd()<.25)LT.add(AS[Math.floor(rnd()*3)],mArv,mt(x,0,z,0,rnd()*6,0,1.3+rnd()*.5));return}
      LT.add(MU[Math.floor(rnd()*3)],mMuro,mt(x,0,z,0,ry+Math.PI/2,0,1,.9+rnd()*.5,1),['#6a6678','#5a566a','#76728a'][Math.floor(rnd()*3)]);const t=rnd();
      if(t<.12)LT.add(AS[Math.floor(rnd()*3)],mArv,mt(x,0,z,0,rnd()*6,0,1+rnd()*.4));else if(t<.32)cristal(x+(rnd()-.5)*.5,z+(rnd()-.5)*.5,.7+rnd()*.5);else if(t<.6)LT.add(CA,mCap,mt(x+(rnd()-.5)*.9,0,z+(rnd()-.5)*.9,0,rnd()*6,0,1+rnd()*.6))});
    for(const [x,z,s] of M.pedras){if(dcam(x,z)>3.2&&rnd()<.4){LT.add(AS[Math.floor(rnd()*3)],mArv,mt(x,0,z,0,rnd()*6,0,1+rnd()*.5));continue}rocha(x,z,.5*s,rnd()*6,1,'#4e4a5e');LT.add(CA,mCap,mt(x+.4,0,z,0,rnd()*6,0,1))}
    let nb=0;for(const [x,z,s] of M.cogumelos){const f=dcam(x,z)>3.2;if(f&&nb<L/12&&rnd()<.5){braseiro(x,z);nb++}else if(f&&rnd()<.3)LT.add(AR,mMuro,mt(x,0,z,0,rnd()*3,0,.85),'#5e5a70');else cristal(x,z,.7*s+.2)}
    // braseiros perto do caminho, de tempos em tempos (luz roxa)
    trechosDe(M).forEach(([x0,z0,x1,z1,d,ux,uz],k)=>{if(k%3)return;const sd=k%6?1:-1,x=(x0+x1)/2-uz*2.35*sd,z=(z0+z1)/2+ux*2.35*sd;braseiro(x,z)});
    // névoa roxa rasteira (faixas que se movem devagar)
    const nev=texCanvas((x,w)=>{for(let k=0;k<26;k++){const a=Math.random()*w,b=Math.random()*w,r=w*(.1+Math.random()*.2),g=x.createRadialGradient(a,b,0,a,b,r);g.addColorStop(0,'rgba(255,255,255,.22)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;for(const dx of[-w,0,w])for(const dy of[-w,0,w]){x.save();x.translate(dx,dy);x.fillRect(a-r,b-r,2*r,2*r);x.restore()}}},256);
    nev.wrapS=nev.wrapT=T.RepeatWrapping;nev.repeat.set(2,2*(L+24)/(W+24));const mN=new T.Mesh(new T.PlaneGeometry(W+24,L+24),new T.MeshBasicMaterial({map:nev,color:'#a07aff',transparent:true,opacity:.55,depthWrite:false,blending:T.AdditiveBlending}));
    mN.rotation.x=-Math.PI/2;mN.position.set(0,.35,L/2);S.add(mN);anim.push((dt,tt)=>{nev.offset.set(tt*.006%1,tt*.004%1)});
    particulas(S,U,W+8,L,200,'#c49aff',.14,.3,3.5,17);
  }
  // ------------------------------------------------------------------ FOGO
  if(mundo==='fogo'){const CR=[geoCristais(6,6),geoCristais(11,5)],BR=geoBraseiro();
    const mRA=new T.MeshStandardMaterial({map:rochaTex.map,normalMap:rochaTex.normalMap,emissiveMap:texArq('img/tex/comum/rocha_lava_emis.jpg',[2,1]),emissive:'#ff7a2a',emissiveIntensity:1.0,color:'#3a302c',roughness:.85,flatShading:true});
    const crL=mCristal('#ff8a3a'),crA=mCristal('#ffc04a');const mBr=new T.MeshStandardMaterial(Object.assign({color:'#5a4a44',roughness:.7,metalness:.3},rochaTex));
    const chama=bill(.6,1,-.05),mCh=new T.MeshBasicMaterial({map:tx.chama,color:'#ff9a3a',transparent:true,depthWrite:false,blending:T.AdditiveBlending});balanca(mCh,U,0,'chama');
    const braseiro=(x,z)=>{LT.add(BR,mBr,mt(x,0,z,0,0,0,1));LT.add(chama,mCh,mt(x,1.05,z,0,0,0,1.3));brilho(x,1.4,z,3.2,'#ff8a2a')};
    const rochaA=(x,z,s,h)=>LT.add(RA[Math.floor(rnd()*3)],mRA,mt(x,0,z,(rnd()-.5)*.2,rnd()*6,(rnd()-.5)*.2,s*.8,s*h,s*.8));
    const cristal=(x,z,s)=>{LT.add(CR[Math.floor(rnd()*2)],rnd()<.6?crL:crA,mt(x,0,z,(rnd()-.5)*.3,rnd()*6,(rnd()-.5)*.3,s));brilho(x,.5*s,z,2.2*s,'#ff9a3a')};
    ladoFn=(x,z)=>{const t=rnd();if(t<.45){rochaA(x,z,.45+rnd()*.3,1.1+rnd()*.8);return .4}if(t<.8){cristal(x,z,.7+rnd()*.5);return .35}LT.add(chama,mCh,mt(x,.05,z,0,0,0,.7+rnd()*.4));brilho(x,.5,z,1.8,'#ff7a2a');return 0};
    chaoFn=(x,z)=>{if(rnd()<.7)rochaA(x,z,.22+rnd()*.2,.8+rnd()*.5);else LT.add(CR[Math.floor(rnd()*2)],crL,mt(x,0,z,0,rnd()*6,0,.35+rnd()*.2))};
    for(const [x,z,s,ry,bd] of paredes){const sc=(bd?1.5:.85+rnd()*.15)*s,h=(bd?1.4:1.15)+rnd()*.5;rochaA(x,z,sc,h);const t=rnd();LT.elev=sc*h*.55;if(t<.25)cristal(x+(rnd()-.5)*.4,z+(rnd()-.5)*.4,.7+rnd()*.5);else if(t<.33)LT.add(chama,mCh,mt(x,.2,z,0,0,0,.8+rnd()*.5));LT.elev=0}
    for(const [x,z,s] of M.pedras)rochaA(x,z,.55*s,.9+rnd()*.6);
    let nb=0;for(const [x,z,s] of M.cogumelos){if(dcam(x,z)>3.2&&nb<L/12&&rnd()<.5){braseiro(x,z);nb++}else cristal(x,z,.8*s+.2)}
    trechosDe(M).forEach(([x0,z0,x1,z1,d,ux,uz],k)=>{if(k%4!==1)return;const sd=k%8>3?1:-1;braseiro((x0+x1)/2-uz*2.35*sd,(z0+z1)/2+ux*2.35*sd)});
    // poças de lava nas casas fechadas
    const lava=ctx.matLava;if(lava)for(const [x,z] of M.pedras.filter(([x,z])=>dcam(x,z)>4).slice(0,Math.floor(L/15))){const g=new T.CircleGeometry(1.4,18),p=g.attributes.position;for(let i=1;i<p.count;i++){const a=Math.atan2(p.getY(i),p.getX(i)),k=.7+.4*vn(Math.cos(a)*2,Math.sin(a)*2,x,5);p.setXY(i,p.getX(i)*k,p.getY(i)*k)}
      const m=new T.Mesh(g,lava);m.rotation.x=-Math.PI/2;m.position.set(x,.035,z);S.add(m);brilho(x,.2,z,3.6,'#ff6a1a')}
    particulas(S,U,W+8,L,320,'#ffa04a',.16,.9,5,21);
  }
  // ------------------------------------------------------------------ LUZ
  if(mundo==='luz'){const BL=geoBalaustre(),CO=geoColuna(2.6,false,'#e8c050'),FL=[geoFloreira(2),geoFloreira(6)],PD=geoPedestal(),NU=[geoNuvem(1),geoNuvem(4),geoNuvem(9)],OC=new T.OctahedronGeometry(.28,0);OC.scale(1,1.9,1);
    const mMar=new T.MeshStandardMaterial({vertexColors:true,color:'#ffffff',roughness:.35,metalness:.05,map:(()=>{const t=texArq('img/tex/luz/marmore_cor.jpg',[1,1]);t.encoding=T.sRGBEncoding;return t})()});
    const mOuro=new T.MeshStandardMaterial({color:'#f0c050',roughness:.3,metalness:.75,emissive:'#6a4a10',emissiveIntensity:.4});
    const mNuv=new T.MeshLambertMaterial({color:'#ffffff',emissive:'#e8eeff',emissiveIntensity:.45});const crB=mCristal('#fff4c8'),crZ=mCristal('#bfe4ff');
    const luminaria=(x,z,s)=>{LT.add(PD,mOuro,mt(x,0,z,0,0,0,s));LT.add(OC,rnd()<.6?crB:crZ,mt(x,1.1*s+.5*s,z,0,rnd()*6,0,s));brilho(x,1.6*s,z,2.6*s,'#fff0b0')};
    chaoFn=(x,z)=>{if(rnd()<.35)LT.add(FL[Math.floor(rnd()*2)],mVC,mt(x,-.32,z,0,rnd()*6,0,.6))};
    pLado=.22;ladoFn=(x,z)=>{if(rnd()<.6){LT.add(FL[Math.floor(rnd()*2)],mVC,mt(x,0,z,0,rnd()*6,0,.75));return .45}luminaria(x,z,.75);return .3};
    paredes.forEach(([x,z,s,ry,bd],i)=>{if(bd){LT.add(NU[Math.floor(rnd()*3)],mNuv,mt(x,-.3,z,0,rnd()*6,0,1+rnd()*.5));if(rnd()<.12)LT.add(CO,mMar,mt(x,0,z,0,0,0,1.1));return}
      LT.add(BL,mMar,mt(x,0,z,0,ry+Math.PI/2,0,1,1.1,1));if(i%5===0)LT.add(CO,mMar,mt(x,0,z,0,0,0,.85));else if(rnd()<.12)LT.add(FL[Math.floor(rnd()*2)],mVC,mt(x+(rnd()-.5)*.3,0,z+(rnd()-.5)*.3,0,rnd()*6,0,.8));else if(rnd()<.08)luminaria(x,z,.8)});
    for(const [x,z,s] of M.pedras){if(dcam(x,z)>3.2&&rnd()<.5){LT.add(CO,mMar,mt(x,0,z,0,0,0,.9));continue}LT.add(FL[Math.floor(rnd()*2)],mVC,mt(x,0,z,0,rnd()*6,0,.8*s))}
    for(const [x,z,s] of M.cogumelos){if(dcam(x,z)>3.2&&rnd()<.4)LT.add(NU[Math.floor(rnd()*3)],mNuv,mt(x,-.2,z,0,rnd()*6,0,.8));else luminaria(x,z,.9)}
    trechosDe(M).forEach(([x0,z0,x1,z1,d,ux,uz],k)=>{if(k%3!==1)return;const sd=k%6>2?1:-1;luminaria((x0+x1)/2-uz*2.3*sd,(z0+z1)/2+ux*2.3*sd,1)});
    // rosáceas douradas embutidas no piso, em algumas casas do caminho
    const mEs=new T.MeshBasicMaterial({map:tx.estrela,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3});const gE=new T.PlaneGeometry(3.6,3.6);gE.rotateX(-Math.PI/2);
    trechosDe(M).forEach(([x0,z0,x1,z1,d],k)=>{if(k%4!==2||d<5)return;const m=new T.Mesh(gE,mEs);m.position.set((x0+x1)/2,.02,(z0+z1)/2);S.add(m)});
    const facho=new T.PlaneGeometry(2,12);facho.translate(0,6,0);facho.applyMatrix4(mCam);const mF=new T.MeshBasicMaterial({map:tx.facho,color:'#fff2c0',transparent:true,opacity:.2,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide});
    for(let z=4;z<L;z+=6+rnd()*6)LT.add(facho,mF,mt((rnd()-.5)*W*.9,0,z,0,0,(rnd()-.5)*.4,1+rnd()));
    particulas(S,U,W+8,L,240,'#fff2b0',.15,.25,4,23);
  }
  // enfeites dos dois lados das paredes (só onde é corredor) e miudezas no chão do caminho
  if(ladoFn)A.forEach(([x,z],i)=>{const ry=dir[i],px=Math.cos(ry),pz=-Math.sin(ry);for(const sd of[-1,1]){if(rnd()>pLado)continue;const d=1.15+rnd()*.35,qx=x+px*d*sd+(rnd()-.5)*.4,qz=z+pz*d*sd+(rnd()-.5)*.4;
    if(Math.abs(qx)>W/2-.6||qz<.5||qz>L-1||dcam(qx,qz)>3.4||dcam(qx,qz)<1.5||Math.hypot(qx-M.portal[0],qz-M.portal[1])<6||Math.hypot(qx-M.inicio[0],qz-M.inicio[1])<2)continue;
    const r=ladoFn(qx,qz);if(r)obs.push([qx,qz,r])}});
  if(chaoFn)for(let k=0;k<L*(E.miudezas??4);k++){const x=(rnd()-.5)*W,z=rnd()*L,d=dcam(x,z);if(d<1.3||d>2.8||Math.hypot(x-M.portal[0],z-M.portal[1])<5)continue;chaoFn(x,z)}
  LT.fecha();
  return{obs,anim:(dt,tt)=>{U.uT.value=tt;for(const f of anim)f(dt,tt)}}}
function trechosDe(M){const out=[];for(let k=0;k<M.caminho.length-1;k++){const [x0,z0]=M.caminho[k],[x1,z1]=M.caminho[k+1],d=Math.hypot(x1-x0,z1-z0);if(d>.5)out.push([x0,z0,x1,z1,d,(x1-x0)/d,(z1-z0)/d])}return out}
window.GARRO_MUNDOS3D={monta};
})();
