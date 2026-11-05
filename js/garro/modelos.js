/* GARRO — modelos 3D (GLB), visualizador e os 15 bichinhos redondos. Parte 5 de 8 do antigo js/garro.js: os arquivos são carregados em ordem (js/garro/*.js) e dividem o mesmo escopo global. */
/* ---------- real 3D models (GLB from image-to-3D) ---------- */
// per model: file, head region (z,y thresholds) + neck pivot, tail start + pivot, personality speed
const NOEXTRA=new Set();
const MODELS={
  0:{file:'models/terranox.glb',skin:null,key:'terra1',hc:[0,.22,.4],hr:.12,hp:[0,.17,.3],tz:-.4,tp:[0,.2,-.42],spd:.55,wag:.18},
  10:{file:'models/sylvorn.glb',hc:[0,.42,.36],hr:.14,hp:[0,.36,.24],tz:-.3,tp:[0,.32,-.3],spd:1,wag:.35}
};
// derived plushes: the Sylvorn mesh without antlers/ears, a painted skin per plush, plus the plush's own parts (ears, wings, fins, tail...)
const DEER=GD.modelos.DEER;
const DER=GD.modelos.DER;
for(const k in DER)MODELS[k]=Object.assign({},DEER,DER[k],{skin:'models/skins/'+k+'.jpg',key:'d'+k});
// Tripo models sent by the team; each one is also the base for its "cousins" (same body, repainted skin)
const NB=GD.modelos.NB;
for(const [k,b,o] of [[11,'draksel',{spd:.9,wag:.3}],[6,'glacien',{spd:.7,wag:.2}],[2,'flarion',{spd:1.1,wag:.4}],[8,'magmord',{spd:.5,wag:.15}],[13,'petrun',{spd:.4,wag:.12}],
  [4,'umbros',{spd:.9,wag:.35}],[16,'ignovus',{spd:1,wag:.25}],[14,'sombril',{spd:.6,wag:.15}],
  [12,'sombril',{spd:.6,wag:.15,skin:1}]])
  MODELS[k]=Object.assign({file:'models/'+b+'.glb'},NB[b],o,{skin:(k==14||k==16)?null:'models/skins/'+k+'.jpg',key:b+k});

// Tripo models made for each plush (own body and own painted texture, no repaint)
NB.aquarim={hc:[0,.4,.33],hr:.13,hp:[0,.3,.2],tz:-.2,tp:[0,.12,-.2],wing:{x:.1,y:.38,z0:-.1,z1:.2,a:.3}};
NB.coralith={hc:[0,.27,.38],hr:.1,hp:[0,.2,.25],tz:-.3,tp:[0,.12,-.3]};
NB.lunaris={hc:[0,.5,.36],hr:.14,hp:[0,.42,.2],tz:-.2,tp:[0,.35,-.25]};
NB.voltik={hc:[0,.55,.32],hr:.15,hp:[0,.45,.2],tz:-.28,tp:[0,.35,-.3]};
NB.floriss={hc:[0,.55,.33],hr:.17,hp:[0,.4,.2],tz:-.3,tp:[0,.25,-.3]};
NB.lumina={hc:[0,.5,.3],hr:.14,hp:[0,.4,.2],tz:-.2,tp:[0,.15,-.2],wing:{x:.08,y:.5,z0:-.15,z1:.15,a:.5}};
NB.toxilys={hc:[0,.38,.36],hr:.12,hp:[0,.3,.22],tz:-.25,tp:[0,.2,-.3]};
NB.auren={hc:[0,.55,.33],hr:.17,hp:[0,.45,.2],tz:-.3,tp:[0,.25,-.35]};
NB.zephyra={hc:[0,.5,.35],hr:.13,hp:[0,.42,.2],tz:-.15,tp:[0,.12,-.15],wing:{x:.1,y:.45,z0:-.12,z1:.15,a:.5}};
for(const [k,b,o] of [[1,'aquarim',{spd:1,wag:.3}],[15,'coralith',{spd:.45,wag:.12}],[9,'lunaris',{spd:.9,wag:.3}],[7,'voltik',{spd:1.3,wag:.4}],[5,'floriss',{spd:.8,wag:.25}],[3,'zephyra',{spd:1,wag:.25}],[17,'lumina',{spd:1,wag:.3}],[18,'toxilys',{spd:.6,wag:.25}],[19,'auren',{spd:.7,wag:.3}]]){
  MODELS[k]=Object.assign({file:'models/'+b+'.glb'},NB[b],o,{skin:null,key:b+k});NOEXTRA.add(k)}
// Tripo próprios que faltavam: Glacien, Petrun, Flarion e Nimbri (corpo e textura do próprio modelo)
NB.glacien2={hc:[0,.31,.4],hr:.13,hp:[0,.25,.3],tz:-.4,tp:[0,.18,-.43]};
NB.flarion2={hc:[-.1,.42,.38],hr:.15,hp:[-.08,.34,.28],tz:-.4,tp:[.12,.3,-.43]};
NB.petrun2={hc:[0,.15,.42],hr:.12,hp:[0,.13,.32],tz:-.4,tp:[.04,.18,-.42]};
NB.nimbri2={hc:[.06,.3,.38],hr:.16,hp:[.04,.26,.26],tz:-.4,tp:[-.1,.28,-.43]};
for(const [k,b,o] of [[6,'glacien',{spd:.8,wag:.25}],[13,'petrun',{spd:.4,wag:.12}],[2,'flarion',{spd:1.1,wag:.4}],[12,'nimbri',{spd:.7,wag:.2}]]){
  MODELS[k]=Object.assign({file:'models/'+b+'.glb'},NB[b+'2'],o,{skin:null,key:b+'T'+k});NOEXTRA.add(k)}
NOEXTRA.add(0);// Terranox: modelo Tripo próprio (dinossauro)
const GLB={};
const GLBDATA={};
// um carregamento que falha (rede ruim no celular) não fica guardado: tenta de novo até 3 vezes antes de desistir
const cacheNome=()=>'garro-glb-'+ASSETV;
function cacheOk(){try{return !!(window.caches&&/^https?:/.test(location.protocol)&&!window.GARRO_OFFLINE)}catch(e){return false}}
// busca o .glb no cache do aparelho; se não tiver, baixa e guarda (versão nova do jogo = cache novo, o velho é apagado)
async function baixaGLB(url,soGuardar){const c=await caches.open(cacheNome());let r=await c.match(url);
  if(!r){r=await fetch(url);if(!r.ok)throw new Error('HTTP '+r.status+' '+url);try{await c.put(url,r.clone())}catch(e){}}
  return soGuardar?null:r.arrayBuffer()}
// com a máquina parada e rede boa, deixa guardados no aparelho (sem abrir) os modelos dos bichinhos que estão na máquina
function aquecerModelos(){try{const cn=navigator.connection||{};if(!cacheOk())return;caches.keys().then(ks=>ks.filter(k=>k.startsWith('garro-glb-')&&k!==cacheNome()).forEach(k=>caches.delete(k)));if(cn.saveData||/(^|-)2g$/.test(cn.effectiveType||''))return;
  const fila=[...new Set(bodies.map(b=>b.plush&&b.plush.i).filter(i=>MODELS[i]))].map(i=>MODELS[i].file);let k=0;
  const prox=()=>{if(k>=fila.length)return;const f=fila[k++];baixaGLB(f+'?v='+ASSETV,true).catch(()=>{}).then(()=>setTimeout(prox,600))};prox()}catch(e){}}
function loadGLB(m,t){t=t|0;if(GLB[m.file])return GLB[m.file];
  const pr=loadGLB1(m);GLB[m.file]=pr;pr.catch(()=>{if(GLB[m.file]===pr)delete GLB[m.file]});
  return t>=2?pr.catch(e=>{logErro('modelo3d:'+m.file,e);throw e}):pr.catch(e=>new Promise(r=>setTimeout(r,700*(t+1))).then(()=>loadGLB(m,t+1)))}
function loadGLB1(m){
  return new Promise((res,rej)=>{if(!THREE.GLTFLoader)return rej('noloader');const b64=GLBDATA[m.file];if(!b64&&(window.GARRO_GLBTXT||(window.GARRO_EVOTXT&&m.evoM))){fetch(m.file+'.txt?v='+ASSETV).then(r=>{if(!r.ok)throw new Error('evo');return r.text()}).then(t=>{const bin=Uint8Array.from(atob(t.trim()),c=>c.charCodeAt(0));new THREE.GLTFLoader().parse(bin.buffer,'',g=>res(g.scene),rej)}).catch(rej);return}
    if(!b64){const url=((window.GARRO_REMOTE&&m.remote)?window.GARRO_REMOTE:'')+m.file+'?v='+ASSETV,direto=()=>new THREE.GLTFLoader().load(url,g=>res(g.scene),undefined,rej);
      if(!cacheOk())return direto();// guardado no aparelho: na 2ª vez o modelo abre sem baixar de novo (internet fraca)
      return baixaGLB(url).then(buf=>new THREE.GLTFLoader().parse(buf,'',g=>res(g.scene),rej)).catch(direto)}
    const bin=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));new THREE.GLTFLoader().parse(bin.buffer,'',g=>res(g.scene),rej)})}
// pelo fofo nas formas evoluídas (modelos Tripo saem lisos/em placas): mesma textura de pelo dos bichos de pelúcia, por cima da cor do modelo
function furDet(mat,k){const U={uDet:DETU.uDet,uDS:{value:.22},uFS:{value:k}};
  mat.onBeforeCompile=sh=>{Object.assign(sh.uniforms,U);
    sh.vertexShader='varying vec3 vTP;\nvarying vec3 vON;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n vTP=position*vec3(length(modelMatrix[0].xyz),length(modelMatrix[1].xyz),length(modelMatrix[2].xyz));vON=normalize(normal);');
    sh.fragmentShader='uniform sampler2D uDet;uniform float uDS,uFS;\nvarying vec3 vTP;\nvarying vec3 vON;\n'+sh.fragmentShader
      .replace('#include <map_fragment>','#include <map_fragment>\n float gDet=.5;{vec3 bw=pow(abs(vON),vec3(4.));bw/=bw.x+bw.y+bw.z;vec3 p=vTP*uDS;gDet=texture2D(uDet,p.yz).r*bw.x+texture2D(uDet,p.xz+.37).r*bw.y+texture2D(uDet,p.xy+.71).r*bw.z;\n diffuseColor.rgb*=clamp(1.+(gDet*2.-1.)*uFS,.75,1.25);}')
      .replace('#include <normal_fragment_begin>','#include <normal_fragment_begin>\n {vec2 dh=vec2(dFdx(gDet),dFdy(gDet))*uFS*.3;vec3 sx=dFdx(-vViewPosition),sy=dFdy(-vViewPosition);vec3 r1=cross(sy,normal),r2=cross(normal,sx);float fd=dot(sx,r1);normal=normalize(abs(fd)*normal-sign(fd)*(dh.x*r1+dh.y*r2));}')};
  mat.customProgramCacheKey=()=>'glbfur'+k}
function deformMat(mat,m,U){
  // formas evoluídas: o modelo inteiro se mexe, sem dobrar cabeça/cauda (dobrar esticava o rosto)
  if(m.noDeform){if(m.pelo&&!mat.isMeshDepthMaterial){furDet(mat,m.pelo);return}mat.customProgramCacheKey=()=>'glbnd';return}
  const ds=(m.ds!=null?m.ds:.5).toFixed(3);// força das dobras: os modelos Tripo esticam se a cabeça/cauda gira demais
  mat.onBeforeCompile=sh=>{Object.assign(sh.uniforms,U);
    sh.vertexShader='uniform float uHY,uHP,uHR,uTail,uT,uWing;\nmat3 rY(float a){float c=cos(a),s=sin(a);return mat3(c,0.,-s,0.,1.,0.,s,0.,c);}\nmat3 rX(float a){float c=cos(a),s=sin(a);return mat3(1.,0.,0.,0.,c,s,0.,-s,c);}\nmat3 rZ(float a){float c=cos(a),s=sin(a);return mat3(c,s,0.,-s,c,0.,0.,0.,1.);}\n'+
    sh.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      {vec3 hp=vec3(${m.hp.map(v=>v.toFixed(3)).join(',')});float hw=${m.hc?`1.-smoothstep(${(m.hr*.8).toFixed(3)},${(m.hr*1.8).toFixed(3)},length(transformed-vec3(${m.hc.map(v=>v.toFixed(3)).join(',')})))`:`smoothstep(${(m.hz-.04).toFixed(3)},${(m.hz+.18).toFixed(3)},transformed.z)*smoothstep(${(m.hy-.18).toFixed(3)},${(m.hy+.04).toFixed(3)},transformed.y)`};
       vec3 d=transformed-hp;transformed=mix(transformed,hp+rY(uHY*${ds})*rX(uHP*${ds})*rZ(uHR*${ds})*d,hw);
       vec3 tp=vec3(${m.tp.map(v=>v.toFixed(3)).join(',')});float tw=(1.-smoothstep(${(m.tz-.12).toFixed(3)},${m.tz.toFixed(3)},transformed.z))*(1.-smoothstep(${(m.tx||.6).toFixed(3)},${((m.tx||.6)+.1).toFixed(3)},abs(transformed.x)));
       float far=max(0.,${m.tz.toFixed(3)}-transformed.z);vec3 e=transformed-tp;transformed=mix(transformed,tp+rY(uTail*${ds}*(.4+far*2.))*e,tw);${m.wing?`{const float wx=${m.wing.x.toFixed(3)},wy=${m.wing.y.toFixed(3)};float ww=smoothstep(wx,wx+.14,abs(transformed.x))*smoothstep(wy,wy+.1,transformed.y)*smoothstep(${(m.wing.z0-.1).toFixed(3)},${m.wing.z0.toFixed(3)},transformed.z)*(1.-smoothstep(${m.wing.z1.toFixed(3)},${(m.wing.z1+.1).toFixed(3)},transformed.z))*(1.-hw);
       float sx=sign(transformed.x);vec3 wp=vec3(sx*wx,wy,transformed.z);transformed=wp+rZ(sx*uWing*${ds}*ww)*(transformed-wp);}`:''}}`)};
  mat.customProgramCacheKey=()=>'glb'+(m.key||m.file)+ds;
}
function weldNormals(g){const p=g.attributes.position,n=p.count,id=new Int32Array(n),map=new Map();let m=0;
  for(let i=0;i<n;i++){const k=Math.round(p.getX(i)*1e5)+','+Math.round(p.getY(i)*1e5)+','+Math.round(p.getZ(i)*1e5);let v=map.get(k);if(v===undefined){v=m++;map.set(k,v)}id[i]=v}
  const acc=new Float32Array(m*3),ix=g.index.array,a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
  for(let t=0;t<ix.length;t+=3){a.fromBufferAttribute(p,ix[t]);b.fromBufferAttribute(p,ix[t+1]);c.fromBufferAttribute(p,ix[t+2]);b.sub(a);c.sub(a);b.cross(c);
    for(let q=0;q<3;q++){const w=id[ix[t+q]]*3;acc[w]+=b.x;acc[w+1]+=b.y;acc[w+2]+=b.z}}
  const N=new Float32Array(n*3);for(let i=0;i<n;i++){const w=id[i]*3,l=Math.hypot(acc[w],acc[w+1],acc[w+2])||1;N[i*3]=acc[w]/l;N[i*3+1]=acc[w+1]/l;N[i*3+2]=acc[w+2]/l}
  g.setAttribute('normal',new THREE.BufferAttribute(N,3))}
const SKIN={};
// forma evoluída: arquivo .glb próprio quando existir (ex.: 'models/petrun_evo.glb'); senão o mesmo corpo com a pele evoluída
// modelos Tripo das formas evoluídas (cada arquivo veio com base+evolução; aqui só a evolução)
const LEVES=new Set(GD.modelos.LEVES||[]);
const EVOFILE=GD.modelos.EVOFILE,NBE=GD.modelos.NBE,EVOFAIL={};
// lendários: modelo 3D próprio (Tripo), em models/lendarios/. O modelo inteiro se mexe (sem dobrar cabeça/cauda).
for(const L of LEGS.concat(EPS)){if(!L.modelo)continue;
  MODELS[L.id]={file:L.modelo,skin:null,evoM:1,noDeform:1,wing:null,notail:false,hc:[0,.62,.3],hr:.16,hp:[0,.5,.2],tz:-.3,tp:[0,.3,-.3],spd:.8,wag:.25,
    glowCol:L.cor,escala:L.tamanho||1.15,leg:1,key:'L'+L.slug,extraLeg:L.extra||null,vista:L.vista??-.62,desliza:L.anda==='desliza',fileAnda:L.modelo_anda||null};NOEXTRA.add(L.id)}
// ângulo em que o lendário aparece no visualizador (data/lendarios.json → vista; os da folha nova olham para outro lado)
const vistaLeg=i=>(MODELS[i]&&MODELS[i].vista)??-.62;
// bolinhas (20+k = mini do grande k): modelos 3D do Tripo (folha das 20 bolinhas separada em models/bolinhas/)
for(let k=0;k<20;k++){const id=CH0+k;if(PLUSH[id]&&!PLUSH[id].fora)MODELS[id]={file:'models/bolinhas/'+PLUSH[k].name.toLowerCase()+'.glb',skin:null,evoM:1,noDeform:1,wing:null,notail:false,
  hc:[0,.62,.25],hr:.2,hp:[0,.45,.2],tz:-.3,tp:[0,.3,-.3],spd:.9,wag:.2,key:'B'+k,bol:1,vista:-.35,
  fileAnda:'models/bolinhas/'+PLUSH[k].name.toLowerCase()+'_lo.glb'}}// na Aventura: versão leve (~3,5 mil triângulos); na coleção: a detalhada
const temVista=i=>isLeg(i)||!!(MODELS[i]&&MODELS[i].bol);
const EVT={};
function evoTex(i,map){if(EVT[i])return EVT[i];const img=map.image;if(!img||!img.width)return map;
  const S=Math.min(1024,img.width),cv=document.createElement('canvas');cv.width=cv.height=S;const x=cv.getContext('2d');x.drawImage(img,0,0,S,S);
  const D=x.getImageData(0,0,S,S),d=D.data,e=ELEM[i];let seed=i*977+13;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
  // manchas grandes (musgo, brasas, estrelas) num grid grosso
  const G=24,grid=new Float32Array((G+1)*(G+1));for(let k=0;k<grid.length;k++)grid[k]=rnd();
  const noise=(px,py)=>{const gx=px/S*G,gy=py/S*G,ix=gx|0,iy=gy|0,fx=gx-ix,fy=gy-iy,a=grid[iy*(G+1)+ix],b=grid[iy*(G+1)+ix+1],c=grid[(iy+1)*(G+1)+ix],dd=grid[(iy+1)*(G+1)+ix+1];return a+(b-a)*fx+(c-a)*fy+(a-b-c+dd)*fx*fy};
  for(let p=0,n=0;p<d.length;p+=4,n++){let r=d[p]/255,g=d[p+1]/255,b=d[p+2]/255;const mx=Math.max(r,g,b),mn=Math.min(r,g,b),L=(mx+mn)/2,sat=mx-mn;
    const px=n%S,py=(n/S)|0;let nz=noise(px,py);
    // contraste + cor mais forte para todos
    const k=1.28;r=L+(r-L)*k;g=L+(g-L)*k;b=L+(b-L)*k;r=(r-.5)*1.1+.5;g=(g-.5)*1.1+.5;b=(b-.5)*1.1+.5;
    if(e==='stone'||e==='earth'){if(sat<.18&&nz>.52){const t=Math.min(1,(nz-.52)*6);r=r*(1-t)+(.30+.25*L)*t;g=g*(1-t)+(.46+.3*L)*t;b=b*(1-t)+(.12+.1*L)*t}if(e==='earth'){r*=.95;g*=1.04;b*=.9}}
    else if(e==='lava'||e==='embers'){if(L<.35){r*=.55;g*=.42;b*=.42}else{r=Math.min(1,r*1.12+.06);g=Math.min(1,g*1.1+.03)}if(L<.3&&nz>.6){const t=Math.min(1,(nz-.6)*5);r+=t*.7;g+=t*.25}}
    else if(e==='ice'||e==='water'||e==='cloud'){if(sat<.2&&L>.55){r*=.86;g*=.94}b=Math.min(1,b*1.08+.03);if(nz>.72&&L>.5){const t=Math.min(1,(nz-.72)*6);r+=t*.15;g+=t*.2;b+=t*.25}}
    else if(e==='shadow'){r*=.82;g*=.72;b*=.92;if(sat>.15){r=Math.min(1,r*1.15+.04);b=Math.min(1,b*1.3+.06)}}
    else if(e==='stars'||e==='gold'||e==='petals'){if(L>.5){r=Math.min(1,r*1.06+.03);g=Math.min(1,g*1.03+.02)}if(nz>.8&&L>.45){const t=Math.min(1,(nz-.8)*8);r+=t*.35;g+=t*.28;b+=t*.05}}
    else if(e==='electric'){if(r>b){r=Math.min(1,r*1.1+.04);g=Math.min(1,g*1.1+.04)}}
    else if(e==='leaves'||e==='flowers'||e==='sand'){if(g>r&&g>b){g=Math.min(1,g*1.08)}if(r>g&&r>b){r=Math.min(1,r*1.1)}}
    else if(e==='swamp'){if(sat>.15){r=Math.min(1,r*1.1);b=Math.min(1,b*1.12)}}
    d[p]=Math.max(0,Math.min(255,r*255));d[p+1]=Math.max(0,Math.min(255,g*255));d[p+2]=Math.max(0,Math.min(255,b*255))}
  x.putImageData(D,0,0);const t=new THREE.CanvasTexture(cv);t.flipY=map.flipY;t.encoding=THREE.sRGBEncoding;t.anisotropy=4;t.wrapS=map.wrapS;t.wrapT=map.wrapT;return EVT[i]=t}
function applyEvoTex(i){const C=V.C;if(!C||!C.obj)return;C.obj.traverse(o=>{if(o.isMesh&&!o.userData.keep&&o.userData.baseMap){o.material.map=evoTex(i,o.userData.baseMap);o.material.needsUpdate=true}})}
const ASSETV='78';
// lendários: mapa de brilho (partes que acendem: veias, runas, estrelas)
// enfeite próprio de alguns lendários (auréola de ouro do Solaris), preso na cabeça do modelo
function enfeiteLeg(obj,m){if(m.extraLeg!=='aureola')return;
  // acha o alto da cabeça: os vértices mais altos na frente do modelo (o modelo olha para +z)
  const v=new THREE.Vector3(),pts=[];let z0=1e9,z1=-1e9;obj.updateMatrixWorld(true);const inv=new THREE.Matrix4().copy(obj.matrixWorld).invert();
  obj.traverse(o=>{if(!o.isMesh||!o.geometry.attributes.position)return;const M=new THREE.Matrix4().multiplyMatrices(inv,o.matrixWorld),p=o.geometry.attributes.position,st=Math.max(1,p.count/4000|0);
    for(let k=0;k<p.count;k+=st){v.fromBufferAttribute(p,k).applyMatrix4(M);pts.push(v.x,v.y,v.z);z0=Math.min(z0,v.z);z1=Math.max(z1,v.z)}});
  const zf=z1-(z1-z0)*.35;let top=-1e9,tx=0,tz=0;for(let k=0;k<pts.length;k+=3)if(pts[k+2]>zf&&pts[k+1]>top){top=pts[k+1];tx=pts[k];tz=pts[k+2]}
  const r=(z1-z0)*.09,t=new THREE.Mesh(new THREE.TorusGeometry(r,r*.16,12,48),new THREE.MeshStandardMaterial({color:'#ffd24a',emissive:'#ffb820',emissiveIntensity:.9,roughness:.35,metalness:.6}));
  t.rotation.x=Math.PI/2-.3;t.position.set(tx,top+r*.9,tz-r*.4);t.userData.keep=1;obj.add(t)}
function brilhoLeg(mm,m,glow){if(!glow)return;mm.emissiveMap=glow;mm.emissive=new THREE.Color(m.glowCol||'#ffffff');mm.emissiveIntensity=m.glowK||1}
function loadSkin(f){if(SKIN[f])return SKIN[f];return SKIN[f]=new Promise(res=>{const src=GLBDATA[f]?'data:image/jpeg;base64,'+GLBDATA[f]:f+'?v='+ASSETV;
  new THREE.TextureLoader().load(src,t=>{t.flipY=false;t.encoding=THREE.sRGBEncoding;t.anisotropy=4;res(t)},undefined,()=>res(null))})}
function dropTail(g,m){const w=g.attributes.uv2;if(!w)return g;g=g.clone();const p=g.attributes.position,B=m.TA;
  for(let i=0;i<p.count;i++){const k=w.getX(i);if(k<=0)continue;const x=p.getX(i),y=p.getY(i),z=p.getZ(i);p.setXYZ(i,x+(B[0]+(x-B[0])*.1-x)*k,y+(B[1]+(y-B[1])*.1-y)*k,z+(B[2]+(z-B[2])*.1-z)*k)}
  p.needsUpdate=true;return g}
// build the procedural plush and move its own parts (ears, horns, wings, fins, tail...) onto the GLB body
function attachParts(obj,i,m){const sp0=SPEC[i],sp=Object.assign({},sp0,{x:sp0.x.filter(k=>m.only?m.only.includes(k):!(m.skip||[]).includes(k))}),C=build(sp),[bx,by,bz]=sp.s,hr=sp.h;
  const kH=m.HR/hr,rB=[m.BR[0]/bx,m.BR[1]/by,m.BR[2]/bz],kB=(rB[0]+rB[1]+rB[2])/3;
  const hpG=new THREE.Group();hpG.position.fromArray(m.hp);hpG.rotation.order='YXZ';obj.add(hpG);
  const tpG=new THREE.Group();tpG.position.fromArray(m.tp);obj.add(tpG);
  const bodyG=new THREE.Group();obj.add(bodyG);
  const hx=C.head.children.slice(C.nH).concat(m.noears?[]:C.ears);
  for(const o of hx){o.position.multiplyScalar(kH).add(new THREE.Vector3(m.HC[0]-m.hp[0],m.HC[1]-m.hp[1],m.HC[2]-m.hp[2]));o.scale.multiplyScalar(kH);hpG.add(o)}
  const bx_=C.body.children.slice(C.nB).filter(o=>!o.userData.dot);
  for(const o of bx_){if(C.wings.includes(o)){o.children=o.children.filter(c=>!(c.geometry&&c.geometry.type==='CylinderGeometry'));o.scale.multiplyScalar(m.ws||1)}o.position.set(m.BC[0]+o.position.x*rB[0],m.BC[1]+o.position.y*rB[1],m.BC[2]+o.position.z*rB[2]);o.scale.multiplyScalar(kB);bodyG.add(o)}
  if(m.notail){const t=C.tail;t.position.set(m.TA[0]-m.tp[0],m.TA[1]-m.tp[1],m.TA[2]-m.tp[2]);t.scale.multiplyScalar(kB*1.15*(m.ts||1));tpG.add(t)}
  const wings=(C.wings||[]).map(w=>({w,z:w.rotation.z,s:Math.sign(w.position.x)||1}));
  return{hpG,tpG,wings,segs:C.segs||[]}}
// modelo 3D pronto para outras telas (Aventura): grandes = GLB (o evoluído quando houver), redondos = montados em código.
// Volta um grupo com altura 1, pés em y=0 e olhando para +z. Não mexe no visualizador.
async function montaModelo(i,evo){
  if(i>=CH0&&!isLeg(i)&&!MODELS[i]){const C=buildChibi(CH[i-CH0],2),g=new THREE.Group();g.add(C.root);C.root.updateMatrixWorld(true);
    const b=new THREE.Box3().setFromObject(C.root),h=b.max.y-b.min.y||1;C.root.scale.setScalar(1/h);C.root.position.y=-b.min.y/h;return g}
  let m0=MODELS[i];if(!m0)throw new Error('sem modelo '+i);
  if(m0.fileAnda)m0=Object.assign({},m0,{file:m0.fileAnda,key:m0.key+'A'});// Aventura: pose de andar (ex.: serpente deitada); a coleção usa o modelo normal
  let m=evo&&EVOFILE[i]&&!EVOFAIL[i]?Object.assign({},m0,NBE[i]||{},{file:EVOFILE[i],skin:null,key:m0.key+'E',remote:1,evoM:1,wing:null,notail:false,noDeform:1}):m0;
  if(LEVES.has(m.file)){const ml=Object.assign({},m,{file:m.file.replace(/\.glb$/,'_lo.glb'),key:m.key+'L'});if(m===m0)m0=ml;m=ml}// Aventura: versão leve do modelo (data/modelos.json → LEVES)
  let src;try{src=await loadGLB(m)}catch(e){if(m===m0)throw e;m=m0;src=await loadGLB(m)}
  const obj=src.clone(true),skin=m.skin?await loadSkin(m.skin):null,glow=m.glow?await loadSkin(m.glow):null;
  obj.traverse(o=>{if(o.isMesh){if(m.notail)o.geometry=dropTail(o.geometry,m);if(!o.geometry.attributes.normal)weldNormals(o.geometry);
    const mm=o.material.clone();if(skin)mm.map=skin;if(mm.map)mm.map.encoding=THREE.sRGBEncoding;mm.roughness=.92;mm.metalness=0;brilhoLeg(mm,m,glow);o.material=mm}});
  if(!m.evoM){try{if(m.HC)attachParts(obj,i,m);else attachExtras(obj,i,m)}catch(e){}}enfeiteLeg(obj,m);
  obj.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(obj),h=Math.max(b.max.y-b.min.y,m.desliza?Math.max(b.max.z-b.min.z,b.max.x-b.min.x)*.45:0)||1,g=new THREE.Group();// serpente deitada: escala pelo comprimento, não pela altura
  obj.scale.setScalar(1/h);obj.position.set(-(b.min.x+b.max.x)/2/h,-b.min.y/h,-(b.min.z+b.max.z)/2/h);g.add(obj);g.userData.bol=!!m.bol;return g}
// tira da cena qualquer modelo que tenha ficado de uma abertura anterior (evita dois bichinhos na tela)
function tiraModelos(){if(!V.spin)return;for(const c of V.spin.children.slice())if(c.userData.modelo)V.spin.remove(c)}
async function openGLB(i){setDet(i);const tok=V.abre=(V.abre||0)+1;// se abrir de novo antes de terminar, só o último vale
  const evo=careStage(i)>0&&i<CH0,m0=MODELS[i];let m=evo&&EVOFILE[i]&&!EVOFAIL[i]?Object.assign({},m0,NBE[i]||{},{file:EVOFILE[i],skin:null,key:m0.key+'E',remote:1,evoM:1,wing:null,notail:false,noDeform:1}):m0;if(!initViewer())return false;
  let src;try{src=await loadGLB(m)}catch(e){if(m===m0)return false;EVOFAIL[i]=1;delete GLB[m.file];m=m0;try{src=await loadGLB(m)}catch(e2){return false}}
  if(tok!==V.abre)return false;
  const evoModel=m!==m0;
  if(V.C)V.spin.remove(V.C.root);if(V.T){V.spin.remove(V.T.root);V.T=null}
  const U={uHY:{value:0},uHP:{value:0},uHR:{value:0},uTail:{value:0},uT:{value:0},uWing:{value:0}};
  const obj=src.clone(true);
  const skin=m.skin?await loadSkin(m.skin):null,glow=m.glow?await loadSkin(m.glow):null;
  if(tok!==V.abre)return false;
  obj.traverse(o=>{if(o.isMesh){if(m.notail)o.geometry=dropTail(o.geometry,m);if(!o.geometry.attributes.normal)weldNormals(o.geometry);
    const mm=o.material.clone();if(skin)mm.map=skin;if(mm.map)mm.map.encoding=THREE.sRGBEncoding;if(evo&&!evoModel&&mm.map){o.userData.baseMap=mm.map;mm.map=evoTex(i,mm.map)}else if(mm.map)o.userData.baseMap=mm.map;mm.roughness=.92;mm.metalness=0;brilhoLeg(mm,m,glow);deformMat(mm,m,U);o.material=mm;const dm=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking});deformMat(dm,m,U);o.customDepthMaterial=dm}});
  enfeiteLeg(obj,m);const box=new THREE.Box3().setFromObject(obj),sz=box.getSize(new THREE.Vector3()),k=2/Math.max(sz.x,sz.y,sz.z);
  const parts=m.evoM?null:(m.HC?attachParts(obj,i,m):attachExtras(obj,i,m));
  const roll=new THREE.Group(),root=new THREE.Group();obj.scale.setScalar(k);obj.position.y=-sz.y*k/2;roll.add(obj);roll.position.y=sz.y*k/2;root.add(roll);
  root.position.y=-1;tiraModelos();root.userData.modelo=1;V.spin.add(root);
  setFloor(i);castAll(root);
  V.C={root,roll,obj,U,m,h:sz.y*k,wx:sz.x*k,parts};V.mode='glb';V.chibi=false;V.sp={};
  {const st=careStage(i);V.C.gs=m.leg?GROW[1].gs*(m.escala||1):m.bol?.85:GROW[st].gs;root.scale.setScalar(V.C.gs);killAura()}
  V.size={xz:Math.max(sz.x,sz.z)*k,y:sz.y*k};if(careStage(i)||m.leg)makeAura(i);
  Object.assign(V,{ry:temVista(i)?vistaLeg(i):-.6,rx:.1,vy:0,st:'idle',until:0,taps:[],t0:performance.now(),wag:0,side:1,
    G:{hy:0,hp:0,hr:0,tail:0,wagA:.2,wagS:4,roll:0,crouch:0,bob:0,shake:0,lift:0}});
  return true;
}
function hitGLB(e){
  const r=$('v3d').getBoundingClientRect();V.ray.setFromCamera({x:(e.clientX-r.left)/r.width*2-1,y:-(e.clientY-r.top)/r.height*2+1},V.cam);
  const h=V.ray.intersectObject(V.C.root,true)[0];if(!h)return null;
  const lp=V.C.obj.worldToLocal(h.point.clone()),m=V.C.m;
  if(m.hc?lp.distanceTo(new THREE.Vector3().fromArray(m.hc))<m.hr*1.6:(lp.z>m.hz&&lp.y>m.hy-.05))return'head';if(lp.z<m.tz)return'tail';return'body';
}
function gloop(now){
  const dt=Math.min(.05,(now-V.last)/1000),t=(now-V.t0)/1000;V.last=now;
  const C=V.C,G=V.G,sp=C.m.spd,m=C.m;
  if(V.st!=='idle'&&V.st!=='belly'&&t>V.until){V.st='idle';V.nextIdle=t+2+Math.random()*2.5;mood('')}
  // when left alone the plush does little things by itself
  if(V.st==='idle'&&t>(V.nextIdle||3)){const acts=['look','look','sniff','hop','stretch','sit','wag'];if(m.wing)acts.push('flap','flap');
    V.act=acts[Math.random()*acts.length|0];V.actT=t;V.actSide=Math.random()<.5?-1:1;V.nextIdle=t+4.5+Math.random()*4}
  const st=V.st,el=t-(V.stT||0),toCam=Math.max(-.7,Math.min(.7,-V.ry));
  const ae=t-(V.actT||-99),act=st==='idle'&&ae<2.6?V.act:null,ap=act?Math.sin(Math.min(1,ae/2.6)*Math.PI):0;
  const X={byaw:0,hy:Math.sin(t*.5*sp)*.14+Math.sin(t*1.3*sp)*.03,hp:Math.sin(t*.7*sp)*.05,hr:0,wagA:m.wag,wagS:3.5*sp,roll:0,crouch:0,bob:0,shake:0,lean:0,pitch:0,back:0,hop:0,wing:.05,wingS:2.4};
  if(act==='look')Object.assign(X,{hy:V.actSide*.3*ap,hp:-.08*ap,hr:V.actSide*.06*ap,byaw:V.actSide*.3*ap});
  if(act==='sniff')Object.assign(X,{hp:.28*ap,hy:Math.sin(t*7)*.1*ap,pitch:.07*ap});
  if(act==='hop')Object.assign(X,{hop:ap,wagA:m.wag*2,wagS:9*sp,wing:.3});
  if(act==='stretch')Object.assign(X,{crouch:.85*ap,pitch:.1*ap,hp:-.25*ap});
  if(act==='sit')Object.assign(X,{pitch:-.13*ap,crouch:.35*ap,hp:-.1*ap});
  if(act==='wag')Object.assign(X,{wagA:m.wag*2.6,wagS:11*sp,hy:toCam*.25*ap,byaw:toCam*.25*ap});
  if(act==='flap')Object.assign(X,{wing:.6*ap,wingS:9,hp:-.1*ap});
  if(st==='pet')Object.assign(X,{hy:toCam*.28,hp:.08,hr:.12*V.side,byaw:toCam*.3,wagA:m.wag*2.4,wagS:12*sp,bob:1,lean:V.side*.1,wing:.3,wingS:8});
  if(st==='scratch')Object.assign(X,{hy:.15,hp:-.12,hr:.1,wagA:m.wag*2,wagS:11*sp,shake:.3,lean:-.08,bob:.6,wing:.2,wingS:10});
  if(st==='tail')Object.assign(X,{hy:(V.ry>0?-1:1)*.32,byaw:(V.ry>0?-1:1)*.35,wagA:m.wag*2.8,wagS:10*sp,lean:(V.ry>0?-1:1)*.06});
  if(st==='hurt'){Object.assign(X,{hy:Math.max(-.35,Math.min(.35,-toCam*.4+.2)),byaw:Math.max(-.45,Math.min(.45,-toCam*.5+.25)),hp:.2,hr:0,wagA:0,crouch:.9,back:el<.3?.2:.12,wing:0});if(el<.3){X.hy=toCam*.3;X.byaw=0}
    if(el>1.5)Object.assign(X,{hr:Math.sin(t*9)*.12,crouch:.5})}
  if(st==='belly')Object.assign(X,{hy:.12,hp:-.1,hr:.08,wagA:m.wag*2,wagS:8,roll:Math.PI,wing:.25,wingS:7});
  if(st==='tired')Object.assign(X,{hy:.1,hp:.32,hr:.2,wagA:m.wag*.25,wagS:2,roll:Math.PI*.46,crouch:.6,wing:0,wingS:1,bob:0});
  if(st==='shake'&&el>.45)X.shake=1;
  if(st==='run')Object.assign(X,{hy:0,hp:-.12,hr:0,wagA:m.wag*2.6,wagS:16,wing:.55,wingS:13});
  if(st==='eat'){Object.assign(X,{hy:0,hp:.1+Math.sin(t*16)*.12,wagA:m.wag*2,wagS:9*sp,byaw:0,bob:.5,wing:.25,wingS:7});V.ry+=((temVista(V.cur)?vistaLeg(V.cur):-.18)-V.ry)*Math.min(1,dt*3)}
  const k=Math.min(1,dt*6*sp),kr=Math.min(1,dt*(st==='run'?7:2.5*sp)),kf=Math.min(1,dt*9);
  for(const n of['hy','hp','hr','wagA','wagS','crouch','bob','shake','lean','pitch','wing','wingS','byaw'])G[n]=(G[n]||0)+(X[n]-(G[n]||0))*k;
  G.back=(G.back||0)+(X.back-(G.back||0))*kf;G.hop=(G.hop||0)+(X.hop-(G.hop||0))*kf;G.roll+=(X.roll-G.roll)*kr;
  V.wag+=dt*G.wagS;V.wph=(V.wph||0)+dt*G.wingS;
  C.U.uHY.value=G.hy;C.U.uHP.value=G.hp;C.U.uHR.value=G.hr+(st==='hurt'&&el<1?Math.sin(t*40)*.04:0);C.U.uTail.value=Math.sin(V.wag)*G.wagA;
  if(C.U.uWing)C.U.uWing.value=G.wing*Math.sin(V.wph)*(m.wing?m.wing.a:0);
  const shk=G.shake*Math.sin(t*28)*.25*(st==='shake'?Math.max(0,1-(el-.45)/1.1):1);
  if(C.parts){const q=C.parts;q.hpG.rotation.set(C.U.uHP.value,C.U.uHY.value,C.U.uHR.value);q.tpG.rotation.y=C.U.uTail.value*1.1;
    const fl=(m.wing||q.xw)?(st==='pet'||st==='scratch'?.5:.18):0;for(const w of q.wings)w.w.rotation.z=w.z+w.s*Math.sin(t*(st==='idle'?3:9)*sp)*fl}
  // squash keeps the feet on the floor (scale is taken around the middle of the body)
  const br=Math.sin(t*2.2*sp)*.015,sy=1+br-G.crouch*.1;
  C.roll.scale.set(1+G.crouch*.05,sy,1+G.crouch*.03);
  C.roll.rotation.z=G.roll+shk+G.lean*(1-G.roll/Math.PI);C.roll.rotation.x=G.pitch;C.roll.rotation.y=G.byaw*(1-G.roll/Math.PI);
  const desl=!!(MODELS[V.cur]&&MODELS[V.cur].desliza),hopY=act==='hop'&&!desl?Math.abs(Math.sin(ae*Math.PI*1.6))*.16*G.hop:0;// serpente desliza: sem pulinhos
  C.roll.position.y=C.h/2*sy+(st==='belly'?.04:0)+(desl?0:G.bob*Math.abs(Math.sin(t*7))*.05)+hopY+Math.abs(G.pitch)*C.h*.25+(C.wx?(C.wx/2-C.h/2*sy)*Math.max(0,Math.sin(Math.min(G.roll,Math.PI/2))):0)+(st==='tired'?Math.sin(t*2.4)*.008:0);
  V.ry+=V.vy;V.vy*=.92;V.spin.rotation.y=V.ry;V.spin.rotation.x=V.rx*.6;
  if(st==='run'){const r=runPose(el,V.until-V.stT);C.root.position.x=r.x;C.root.position.z=r.z;C.root.rotation.y=r.yaw;C.roll.position.y+=Math.abs(Math.sin(t*14))*.1*r.sp;C.roll.rotation.x=Math.sin(t*14)*.07*r.sp}
  else{C.root.position.x*=.8;C.root.position.z+=(-G.back-C.root.position.z)*.25;C.root.rotation.y*=.8}
  popTick(C);stage(t);
  V.renderer.render(V.scene,V.cam);
  if(V.open&&V.mode==='glb')V.raf=requestAnimationFrame(gloop);
}

/* ---------- viewer ---------- */
// ---------- element floor under the plush ----------
const ELEM=GD.pelucias.ELEM;
const FLOORS=GD.modelos.FLOORS;
function floorTex(el){if(FLOORS[el])return FLOORS[el];
  const S=512,c=document.createElement('canvas');c.width=c.height=S;const x=c.getContext('2d'),g=document.createElement('canvas');g.width=g.height=S;const gx=g.getContext('2d');
  let seed=el.length*977+el.charCodeAt(0)*31;const R=()=>{seed=(seed*16807)%2147483647;return seed/2147483647};
  const P={earth:['#7a5a3a','#5e4630'],water:['#2f7fb8','#1d5a8c'],embers:['#3a2620','#221612'],cloud:['#9fb0cc','#7486a8'],shadow:['#2a2236','#16121e'],flowers:['#6f9a3c','#4f7a2a'],
    ice:['#d8ecfa','#a9cdea'],electric:['#3a3d4a','#24262f'],lava:['#3a2a26','#1c1412'],stars:['#1d2350','#0c1030'],leaves:['#5e6e34','#3e4a22'],stone:['#8e8a82','#6a665f'],
    sand:['#e2cfa0','#c8b07c'],petals:['#f6dbe8','#e8bfd4'],swamp:['#3e5228','#26341a'],gold:['#f3ead8','#d9c8a4']}[el];
  const rg=x.createRadialGradient(S/2,S/2,10,S/2,S/2,S/2);rg.addColorStop(0,P[0]);rg.addColorStop(1,P[1]);x.fillStyle=rg;x.fillRect(0,0,S,S);
  const dots=(n,cols,r0,r1,a)=>{for(let i=0;i<n;i++){x.globalAlpha=a||.35;x.fillStyle=cols[i%cols.length];x.beginPath();x.arc(R()*S,R()*S,r0+R()*(r1-r0),0,7);x.fill()}x.globalAlpha=1};
  const crack=(ctx,col,w,n,len,glow)=>{ctx.strokeStyle=col;ctx.lineWidth=w;ctx.lineCap='round';if(glow){ctx.shadowColor=col;ctx.shadowBlur=glow}
    for(let i=0;i<n;i++){let px=R()*S,py=R()*S,a=R()*6.3;ctx.beginPath();ctx.moveTo(px,py);for(let k=0;k<len;k++){a+=(R()-.5)*1.3;px+=Math.cos(a)*9;py+=Math.sin(a)*9;ctx.lineTo(px,py)}ctx.stroke()}ctx.shadowBlur=0};
  const blades=(n,cols,h)=>{x.lineWidth=2;for(let i=0;i<n;i++){const px=R()*S,py=R()*S,a=-1.57+(R()-.5)*.9,l=h*(.5+R());x.strokeStyle=cols[i%cols.length];x.globalAlpha=.7;x.beginPath();x.moveTo(px,py);x.quadraticCurveTo(px+Math.cos(a)*l*.5+3,py+Math.sin(a)*l*.5,px+Math.cos(a)*l,py+Math.sin(a)*l);x.stroke()}x.globalAlpha=1};
  const flower=(px,py,r,col)=>{x.fillStyle=col;for(let k=0;k<5;k++){const a=k/5*6.28;x.beginPath();x.arc(px+Math.cos(a)*r,py+Math.sin(a)*r,r*.75,0,7);x.fill()}x.fillStyle='#ffd23a';x.beginPath();x.arc(px,py,r*.6,0,7);x.fill()};
  let glow=false;dots(5000,['#000','#fff'],.6,1.8,.07);
  switch(el){
    case'earth':dots(260,['#4a3420','#8f6e48','#6b4e32'],3,9,.5);for(let i=0;i<18;i++){const px=R()*S,py=R()*S;x.save();x.translate(px,py);x.globalAlpha=.85;x.fillStyle='#5f7f30';x.beginPath();x.ellipse(0,0,22+R()*30,12+R()*18,R()*3,0,7);x.fill();x.restore();x.globalAlpha=1}blades(900,['#6f9a3c','#86b04a','#4f7a2a'],12);break;
    case'water':for(let i=0;i<40;i++){x.strokeStyle='rgba(255,255,255,'+(.08+R()*.18)+')';x.lineWidth=1+R()*2;x.beginPath();x.ellipse(R()*S,R()*S,10+R()*60,5+R()*25,R()*3,0,7);x.stroke()}crack(x,'rgba(160,220,255,.35)',2,30,14);break;
    case'embers':dots(400,['#151010','#4a3328'],2,8,.6);crack(gx,'#ff6a1a',2,10,10,5);for(let i=0;i<140;i++){gx.fillStyle=['#ff9a2a','#ffd23a','#ff5a14'][i%3];gx.beginPath();gx.arc(R()*S,R()*S,1+R()*3,0,7);gx.fill()}glow=true;break;
    case'cloud':for(let i=0;i<70;i++){const px=R()*S,py=R()*S,r=18+R()*40,q=x.createRadialGradient(px,py,1,px,py,r);q.addColorStop(0,'rgba(255,255,255,.9)');q.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=q;x.fillRect(px-r,py-r,2*r,2*r)}dots(200,['#b9c9e6'],4,12,.2);break;
    case'shadow':dots(500,['#120e18','#3a2e4a'],3,10,.5);for(let i=0;i<30;i++){const px=R()*S,py=R()*S,r=30+R()*60,q=x.createRadialGradient(px,py,1,px,py,r);q.addColorStop(0,'rgba(138,60,240,.22)');q.addColorStop(1,'rgba(138,60,240,0)');x.fillStyle=q;x.fillRect(px-r,py-r,2*r,2*r)}break;
    case'flowers':blades(1500,['#7fae44','#5a8a30','#9cc45a'],13);for(let i=0;i<70;i++)flower(R()*S,R()*S,3+R()*3,['#f6a6c6','#ffffff','#ffd23a','#c9a6f6'][i%4]);break;
    case'petals':dots(300,['#ffffff','#f7c6da'],3,8,.5);for(let i=0;i<120;i++){x.save();x.translate(R()*S,R()*S);x.rotate(R()*6.3);x.fillStyle=['#f6a6c6','#f27aa8','#ffffff','#d9c4ff'][i%4];x.globalAlpha=.8;x.beginPath();x.ellipse(0,0,6,3,0,0,7);x.fill();x.restore()}x.globalAlpha=1;
      for(let i=0;i<60;i++){gx.fillStyle='#fff';gx.beginPath();gx.arc(R()*S,R()*S,1+R()*1.5,0,7);gx.fill()}glow=true;break;
    case'ice':crack(x,'rgba(255,255,255,.75)',1.5,26,12);dots(300,['#ffffff','#8ec2ea'],2,7,.4);for(let i=0;i<90;i++){gx.fillStyle='#e8f6ff';gx.beginPath();gx.arc(R()*S,R()*S,1+R()*1.8,0,7);gx.fill()}glow=true;break;
    case'electric':for(let i=0;i<40;i++){x.strokeStyle='rgba(0,0,0,.35)';x.lineWidth=2;x.strokeRect(R()*S,R()*S,30+R()*50,30+R()*50)}crack(gx,'#ffe14a',2,14,9,6);glow=true;break;
    case'lava':dots(700,['#120c0a','#4a3a34','#2a1e1a'],3,12,.6);crack(gx,'#ff5a14',2.5,16,12,6);crack(gx,'#ffc23a',1.2,10,8,3);glow=true;break;
    case'stars':dots(500,['#ffffff'],.6,1.6,.7);for(let i=0;i<60;i++){gx.fillStyle=['#ffffff','#9cc4ff','#f2c84a'][i%3];gx.beginPath();gx.arc(R()*S,R()*S,1+R()*2.2,0,7);gx.fill()}glow=true;break;
    case'leaves':dots(300,['#2e3818','#6e7e40'],3,10,.5);for(let i=0;i<260;i++){x.save();x.translate(R()*S,R()*S);x.rotate(R()*6.3);x.fillStyle=['#8a6a2a','#a8843a','#6e8a3a','#5a4420'][i%4];x.globalAlpha=.85;x.beginPath();x.ellipse(0,0,10,4.5,0,0,7);x.fill();x.restore()}x.globalAlpha=1;break;
    case'stone':for(let i=0;i<120;i++){const px=R()*S,py=R()*S,r=12+R()*22;x.fillStyle=['#9a958c','#7d7870','#a8a39a','#86817a'][i%4];x.beginPath();x.ellipse(px,py,r,r*.8,R()*3,0,7);x.fill();x.strokeStyle='rgba(40,36,32,.5)';x.lineWidth=2;x.stroke()}dots(80,['#6f8a2c'],4,10,.5);break;
    case'sand':dots(1500,['#b89c68','#f2e2b8','#a88a58'],.8,2.2,.5);for(let i=0;i<24;i++){const col=['#f26a8a','#ff9a3a','#c45ad8','#ffffff'][i%4];x.fillStyle=col;x.save();x.translate(R()*S,R()*S);x.rotate(R()*6.3);x.beginPath();x.ellipse(0,0,6,4,0,0,7);x.fill();x.restore()}
      for(let i=0;i<14;i++){x.strokeStyle='rgba(80,160,220,.25)';x.lineWidth=3;x.beginPath();x.ellipse(R()*S,R()*S,20+R()*40,8+R()*14,R()*3,0,7);x.stroke()}break;
    case'swamp':dots(500,['#1a2410','#4e6a2c'],3,12,.5);for(let i=0;i<20;i++){x.fillStyle='rgba(30,50,30,.55)';x.beginPath();x.ellipse(R()*S,R()*S,20+R()*40,10+R()*20,R()*3,0,7);x.fill()}for(let i=0;i<50;i++){gx.strokeStyle='#9be05a';gx.lineWidth=1.5;gx.beginPath();gx.arc(R()*S,R()*S,2+R()*4,0,7);gx.stroke()}glow=true;break;
    case'gold':x.strokeStyle='rgba(180,140,70,.55)';x.lineWidth=3;for(let r=40;r<S/2;r+=46){x.beginPath();x.arc(S/2,S/2,r,0,7);x.stroke()}for(let a=0;a<16;a++){x.beginPath();x.moveTo(S/2,S/2);x.lineTo(S/2+Math.cos(a/16*6.28)*S/2,S/2+Math.sin(a/16*6.28)*S/2);x.stroke()}
      crack(x,'rgba(150,130,110,.25)',1,20,10);for(let i=0;i<40;i++){gx.fillStyle='#ffd77a';gx.beginPath();gx.arc(R()*S,R()*S,1+R()*2,0,7);gx.fill()}glow=true;break;
  }
  const mask=(ctx)=>{ctx.globalCompositeOperation='destination-in';const m=ctx.createRadialGradient(S/2,S/2,S*.3,S/2,S/2,S/2);m.addColorStop(0,'rgba(0,0,0,1)');m.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=m;ctx.fillRect(0,0,S,S);ctx.globalCompositeOperation='source-over'};
  mask(x);const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.anisotropy=4;
  let e=null;if(glow){mask(gx);e=new THREE.CanvasTexture(g);e.encoding=THREE.sRGBEncoding}
  return FLOORS[el]={map:t,glow:e}}
function setFloor(i){const el=ELEM[i]||'earth',f=floorTex(el),m=V.floor.material;m.map=f.map;m.emissiveMap=f.glow;m.emissive.set(f.glow?0xffffff:0x000000);m.emissiveIntensity=f.glow?1:0;
  m.roughness=el==='water'||el==='ice'?.35:.95;m.needsUpdate=true;V.floorEl=el}
function castAll(root){root.traverse(o=>{if(o.isMesh&&!o.userData.shell&&!(o.material&&o.material.transparent)){o.castShadow=true}})}
// run in circles (swipe up on the plush)
function runPose(el,dur){const u=Math.min(1,el/dur),e=Math.max(0,Math.min(1,(u-.08)/.84)),a=2*Math.PI*2*(e-Math.sin(2*Math.PI*e)/(2*Math.PI)),R=.55*Math.min(1,e*5,(1-e)*5);
  return{x:-R+R*Math.cos(a),z:R*Math.sin(a),yaw:-a,on:e>0&&e<1,sp:Math.sin(Math.PI*e)}}
const _wp=new THREE.Vector3();
function popTick(C){if(!V.pop||!C.gs)return;const u=(performance.now()-V.pop)/900;if(u<1)C.root.scale.setScalar(C.gs*(u<.3?.55+u/.3*.7:1+.2*Math.sin((u-.3)/.7*Math.PI*2)*(1-u)));else{C.root.scale.setScalar(C.gs);V.pop=0}}
function stage(t){tickFood();tickAura(t);// floor turns with the plush, shadow follows it
  const run=V.st==='run',K=V.runK=(V.runK||1)+((run?.7:1)-(V.runK||1))*.06;
  V.spin.scale.setScalar(V.k*K);V.spin.position.y=V.ground+V.k*K;
  V.floor.rotation.z=V.ry;V.floor.scale.setScalar(V.floorR*K);V.floor.position.y=V.ground;
  if(V.floorEl&&V.floor.material.emissiveMap)V.floor.material.emissiveIntensity=.55+Math.sin(t*2.2)*.2;
  V.C.root.getWorldPosition(_wp);V.shadow.position.x=_wp.x;V.shadow.position.z=_wp.z;V.shadow.position.y=V.ground+.012;
  V.shadow.scale.set(V.size.xz*V.k*K*.95,V.size.xz*V.k*K*.7,1)}
function shadowTex(){const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');
  const g=x.createRadialGradient(64,64,4,64,64,62);g.addColorStop(0,'rgba(0,0,0,.8)');g.addColorStop(.3,'rgba(0,0,0,.5)');g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(0,0,128,128);return new THREE.CanvasTexture(c)}
function initViewer(){
  if(V.renderer)return true;if(!window.THREE)return false;
  const cvs=$('v3d');try{V.renderer=new THREE.WebGLRenderer({canvas:cvs,antialias:true,alpha:true})}catch(e){return false}
  V.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));V.renderer.outputEncoding=THREE.sRGBEncoding;
  V.scene=new THREE.Scene();V.cam=new THREE.PerspectiveCamera(36,1,.1,50);V.cam.position.set(0,.35,6);V.cam.lookAt(0,-.15,0);
  V.scene.add(new THREE.HemisphereLight(0xfff4ee,0x40202e,.85));
  V.renderer.shadowMap.enabled=true;V.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const key=new THREE.DirectionalLight(0xffffff,1.05);key.position.set(2.5,5,3);key.castShadow=true;key.shadow.mapSize.set(1024,1024);
  Object.assign(key.shadow.camera,{left:-3,right:3,top:3,bottom:-3,near:.5,far:20});key.shadow.bias=-.0015;key.shadow.normalBias=.02;key.shadow.radius=4;V.scene.add(key);V.key=key;
  const fill=new THREE.DirectionalLight(0xffe2c8,.35);fill.position.set(-3,1,3);V.scene.add(fill);
  const rim=new THREE.DirectionalLight(0xff9cc4,.55);rim.position.set(-2,2,-4);V.scene.add(rim);
  V.spin=new THREE.Group();V.scene.add(V.spin);
  V.shadow=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:shadowTex(),transparent:true,depthWrite:false}));V.shadow.rotation.x=-Math.PI/2;V.shadow.renderOrder=2;V.scene.add(V.shadow);
  V.floor=new THREE.Mesh(new THREE.CircleGeometry(1,64),new THREE.MeshStandardMaterial({color:0xffffff,transparent:true,depthWrite:false,roughness:.95}));V.floor.rotation.x=-Math.PI/2;V.floor.receiveShadow=true;V.floor.renderOrder=1;V.scene.add(V.floor);
  V.ray=new THREE.Raycaster();
  let down=null,moved=false,lp=0;
  cvs.addEventListener('pointerdown',e=>{e.preventDefault();audio();try{cvs.setPointerCapture(e.pointerId)}catch(_){}
    if(V.mode==='terra'){tDown(e);return}
    down={x:e.clientX,y:e.clientY,t:performance.now(),lx:e.clientX,ly:e.clientY,rx:V.rx,ry:V.ry,onC:!!hit(e)};moved=false;
    clearTimeout(lp);lp=setTimeout(()=>{if(down&&!moved&&hit(e))setState('belly',1e9)},550)});
  cvs.addEventListener('pointermove',e=>{if(V.mode==='terra'){tMove(e);return}if(!down)return;const dx=e.clientX-down.lx,dy=e.clientY-down.ly;
    if(Math.hypot(e.clientX-down.x,e.clientY-down.y)>9){moved=true;clearTimeout(lp)}
    if(moved&&V.st!=='belly'){V.vy=dx*.011;V.ry+=dx*.011;V.rx=Math.max(-.35,Math.min(.6,V.rx+dy*.006))}
    down.lx=e.clientX;down.ly=e.clientY});
  const up=e=>{if(V.mode==='terra'){tUp(e);return}if(!down)return;clearTimeout(lp);const dt=performance.now()-down.t;
    const sx=e.clientX-down.x,sy=e.clientY-down.y;
    if(V.st==='belly'){setState('shake',1.5);playShake()}
    else if(moved&&down.onC&&sy<-50&&Math.abs(sy)>Math.abs(sx)*1.4&&dt<1200&&V.st!=='run'){V.rx=down.rx;V.ry=down.ry;V.vy=0;setState('run',4.2);float('💨','love',e);[523,659,784,1047].forEach((f,k)=>setTimeout(()=>tone(f,.07,'square',.04),k*70));careGain(V.cur,'p',30)}
    else if(!moved&&dt<350){const part=hit(e);if(part)tap(part,e)}down=null};
  cvs.addEventListener('pointerup',up);cvs.addEventListener('pointercancel',e=>{if(V.mode==='terra'){tUp(e);return}clearTimeout(lp);if(V.st==='belly')setState('shake',1.5);down=null});
  addEventListener('resize',()=>V.open&&fit());
// a área do bicho muda de tamanho quando os botões de baixo aparecem/somem: sem reajustar, a imagem esticava
if(window.ResizeObserver){new ResizeObserver(()=>{if(V.open&&V.renderer)fit()}).observe($('v3d'))}
  return true;
}
function hit(e){
  if(V.mode==='glb')return hitGLB(e);
  const r=$('v3d').getBoundingClientRect();V.ray.setFromCamera({x:(e.clientX-r.left)/r.width*2-1,y:-(e.clientY-r.top)/r.height*2+1},V.cam);
  const h=V.ray.intersectObject(V.C.root,true)[0];if(!h)return null;
  if(V.chibi){const lp=V.C.head.worldToLocal(h.point.clone());return V.C.headTest?(V.C.headTest(lp)?'head':'body'):lp.y>-.22?'head':'body'}
  for(let o=h.object;o;o=o.parent)if(o.userData.part)return o.userData.part;return'body';
}
function fit(){
  const cvs=$('v3d'),w=cvs.clientWidth,h=cvs.clientHeight;if(!w||!h)return;
  V.renderer.setSize(w,h,false);V.cam.aspect=w/h;V.cam.updateProjectionMatrix();
  const visH=2*6*Math.tan(18*Math.PI/180),visW=visH*V.cam.aspect;
  const gg=Math.max(1,(V.C&&V.C.gs)||1),Sxz=V.size.xz*gg,Sy=V.size.y*gg;
  const nar=visW<visH*1.2;// tela estreita (celular): o bicho ocupa mais da área
  const k=Math.min(visW*(nar?.86:.7)/Sxz,visH*(nar?.6:.5)/Sy,visW*(nar?.74:.62)/Math.max(Sy,1e-3));V.spin.scale.setScalar(k);
  const ground=-k*V.size.y/2-.15;V.spin.position.y=ground+k;V.k=k;V.ground=ground;V.floorR=Math.min(visW*.5,visH*.42,V.size.xz*k*1.15);
  V.shadow.position.y=ground+.01;V.shadow.scale.set(V.size.xz*k*1.1,V.size.xz*k*.8,1);
}
const GEST0='<span>Arraste: girar</span><span>Toque na cabeça: carinho</span><span>Toque no corpo: coçar</span><span>3 toques rápidos: fica bravo</span><span>Segure: barriga pra cima</span><span>Deslize pra cima nele: corre em círculos</span>';
const FOXID=2;
function openFoxViewer(i){if(!openFox(i)){detail(i);return}const p=PLUSH[i];$('gest').innerHTML=GEST0;$('vName').textContent=p.name;refreshVStats(i);$('vDesc').textContent=p.desc;
  $('viewer').hidden=false;V.open=true;document.body.style.overflow='hidden';fit();renderCare();cancelAnimationFrame(V.raf);V.last=performance.now();V.raf=requestAnimationFrame(vloop)}
function openChibiViewer(i){killAura();if(!openChibi(i,2)){detail(i);return}const p=PLUSH[i];$('gest').innerHTML=GEST0;$('vName').textContent=p.name;refreshVStats(i);$('vDesc').textContent=p.desc;
  $('viewer').hidden=false;V.open=true;document.body.style.overflow='hidden';fit();renderCare();cancelAnimationFrame(V.raf);V.last=performance.now();V.raf=requestAnimationFrame(vloop)}
function openViewer(i){
  vTags(i);if(i>=CH0&&!isLeg(i)&&!MODELS[i]){openChibiViewer(i);return}if(PROC[i]){openFoxViewer(i);return}try{if(!localStorage.getItem('garro-help')){$('gest').hidden=false;$('vHelp').setAttribute('aria-expanded',true);localStorage.setItem('garro-help','1')}}catch(e){}
  if(MODELS[i]){const rq=V.rq=(V.rq|0)+1;// o corpo antigo (em código) nunca aparece: se o modelo 3D não carregar, tenta de novo e avisa
    const tenta=n=>openGLB(i).then(ok=>{if(V.rq!==rq)return;if(ok){const p=PLUSH[i];$('gest').innerHTML=GEST0;$('vName').textContent=p.name;refreshVStats(i);$('vDesc').textContent=p.desc;
      $('viewer').hidden=false;V.open=true;document.body.style.overflow='hidden';fit();renderCare();cancelAnimationFrame(V.raf);V.last=performance.now();V.raf=requestAnimationFrame(gloop)}
      else if(n<8){if(n===0)banner('Carregando '+PLUSH[i].name+'…','um instante');EVOFAIL[i]=0;setTimeout(()=>{if(V.rq===rq)tenta(n+1)},1200+n*500)}
      else{logErro('viewer:'+PLUSH[i].name,'modelo 3D não carregou depois de 8 tentativas');banner('Não carregou','Confira a internet e toque no bichinho de novo')}});
    tenta(0);return}
  openProc(i)}
function openProc(i){
  setDet(i);
  if(!initViewer()){detail(i);return}
  if(V.C){V.spin.remove(V.C.root)}if(V.T){V.spin.remove(V.T.root);V.T=null}V.mode='creature';$('gest').innerHTML=GEST0;
  const sp=SPEC[i],C=build(sp);V.C=C;V.sp=sp;
  try{projectPhoto(C,i,sp)}catch(e){}addFur(C.root,sp,C);
  setFloor(i);castAll(C.root);
  C.baseY=-1-C.feet;C.backY=-1+sp.s[1]*(sp.x.includes('shell')?1.5:1.02);C.root.position.y=C.baseY;V.abre=(V.abre||0)+1;tiraModelos();C.root.userData.modelo=1;V.spin.add(C.root);
  C.root.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(C.root),sz=box.getSize(new THREE.Vector3());
  V.size={xz:Math.max(sz.x,sz.z),y:sz.y};
  Object.assign(V,{ry:-.7,rx:.1,vy:0,st:'idle',until:0,taps:[],t0:performance.now(),blinkAt:1.5,blinkTo:0,wag:0,side:1,
    S:{lid:0,ear:0,tailX:0,wagA:.2,wagS:5,tongue:0,hx:0,hy:0,hz:0,crouch:0,roll:0,paddle:0,scratch:0,shake:0,brow:0,flap:0}});
  const p=PLUSH[i];$('vName').textContent=p.name;$('vStats').textContent=p.cm+' cm · '+p.g+' g · pego '+(coll[i]||0)+'x';$('vDesc').textContent=p.desc;
  $('viewer').hidden=false;V.open=true;document.body.style.overflow='hidden';fit();
  cancelAnimationFrame(V.raf);V.last=performance.now();V.raf=requestAnimationFrame(vloop);
}
function closeViewer(){killAura();if(FOOD){V.scene.remove(FOOD.g);FOOD=null}$('vEvo').classList.remove('on');$('viewer').hidden=true;V.open=false;document.body.style.overflow='';cancelAnimationFrame(V.raf)}
function setState(s,dur){if(MOODS[s])mood(MOODS[s]);V.st=s;V.until=(performance.now()-V.t0)/1000+dur;V.stT=(performance.now()-V.t0)/1000;
  if(s==='belly'){float('✨','love');[988,1175,1318,1175,1480].forEach((f,k)=>setTimeout(()=>tone(f,.09,'triangle',.06),k*80))}}
function float(txt,cls,e){
  const box=$('viewer').getBoundingClientRect(),s=document.createElement('span');s.className='fx '+cls;s.textContent=txt;
  s.style.left=((e?e.clientX:box.left+box.width/2)-box.left+(Math.random()-.5)*40)+'px';s.style.top=((e?e.clientY:box.top+box.height/2)-box.top-20)+'px';
  $('viewer').appendChild(s);setTimeout(()=>s.remove(),1300);
}
function growl(){if(!ac)return;try{const o=ac.createOscillator(),l=ac.createOscillator(),g=ac.createGain(),lg=ac.createGain(),f=ac.createBiquadFilter();
  o.type='sawtooth';o.frequency.value=92;f.type='lowpass';f.frequency.value=420;l.frequency.value=26;lg.gain.value=.05;g.gain.value=.07;
  l.connect(lg).connect(g.gain);o.connect(f).connect(g).connect(ac.destination);const t=ac.currentTime;g.gain.setTargetAtTime(0,t+.55,.08);o.start();l.start();o.stop(t+.9);l.stop(t+.9)}catch(e){}}
function playShake(){for(let k=0;k<8;k++)setTimeout(()=>tone(140+Math.random()*80,.05,'triangle',.05),500+k*55)}
function tap(part,e){
  const t=(performance.now()-V.t0)/1000;V.taps=V.taps.filter(x=>t-x<.9);V.taps.push(t);
  if(V.taps.length>=3||(V.st==='hurt'&&t<V.until)){
    setState('hurt',2.8);V.snap=t;float('💢','mad',e);growl();if(V.taps.length>3)setTimeout(()=>{tone(420,.08,'square',.08);setTimeout(()=>tone(300,.1,'square',.07),70)},250);
  }else if(V.st==='belly'||V.st==='shake'){}
  else if(part==='head'){setState('pet',2.2);V.side=Math.random()<.5?-1:1;float('❤','love',e);if(t-(V.lc||-9)>.7){V.lc=t;careGain(V.cur,'l',12)}
    tone(620,.25,'sine',.06);setTimeout(()=>tone(880,.3,'sine',.05),180)}
  else if(part==='tail'&&V.mode==='glb'){setState('tail',2);tone(260,.15,'sine',.06)}
  else{setState('scratch',2.2);float('❤','love',e);if(t-(V.lc||-9)>.7){V.lc=t;careGain(V.cur,'l',8)}for(let k=0;k<7;k++)setTimeout(()=>tone(75,.07,'sine',.2),150+k*95)}
}
function vloop(now){
  const dt=Math.min(.05,(now-V.last)/1000),t=(now-V.t0)/1000;V.last=now;FURTIME.value=t;
  const C=V.C,S=V.S,T={lid:0,ear:0,tailX:0,wagA:.22,wagS:5,tongue:0,hx:Math.sin(t*.7)*.08,hy:Math.sin(t*.45)*.35+Math.sin(t*1.3)*.05,hz:0,crouch:0,roll:0,paddle:0,scratch:0,shake:0,brow:0,flap:.1};
  if(V.st!=='idle'&&V.st!=='belly'&&t>V.until)V.st='idle';
  const st=V.st,el=t-(V.stT||0);
  if(st==='idle'){if(t>V.blinkAt){V.blinkTo=t+.13;V.blinkAt=t+2.5+Math.random()*3}if(t<V.blinkTo)T.lid=1;
    if(Math.sin(t*.23)>.92)T.tongue=.6}
  if(st==='pet')Object.assign(T,{lid:.92,ear:-.45,tailX:.15,wagA:.75,wagS:17,tongue:1,hx:-.28,hy:.1*V.side,hz:.32*V.side});
  if(st==='scratch')Object.assign(T,{lid:.75,ear:-.25,tailX:.15,wagA:.7,wagS:15,tongue:1,hx:-.32,hy:0,hz:.12,scratch:1});
  if(st==='hurt'){Object.assign(T,{lid:.48,ear:-1.15,tailX:-1.25,wagA:0,wagS:5,tongue:0,hx:.35,hy:.75,hz:-.1,crouch:1,brow:1});
    if(t-V.snap<.35)Object.assign(T,{hy:-.1,hx:-.05,crouch:.4})}
  if(st==='tired')Object.assign(T,{lid:.62,ear:-.9,tailX:-.2,wagA:.05,wagS:2,hx:.2,hy:.1,hz:.25,roll:Math.PI*.42,paddle:0,flap:0});
  if(st==='belly')Object.assign(T,{lid:.88,ear:-.7,tailX:-.3,wagA:.85,wagS:11,tongue:1,hx:-.25,hy:.35,hz:.2,roll:Math.PI,paddle:1,flap:0});
  if(st==='shake'){Object.assign(T,{lid:.3,ear:0,tailX:.3,wagA:.5,wagS:9,tongue:.5});if(el>.45)T.shake=1}
  if(st==='run')Object.assign(T,{lid:.1,ear:-.5,tailX:.4,wagA:0,wagS:5,tongue:1,hx:-.15,hy:0,hz:0});
  if(st==='eat'){Object.assign(T,{lid:.3,ear:.15+Math.sin(t*16)*.1,tailX:.2,wagA:.7,wagS:12,tongue:.6+.4*Math.sin(t*15),hx:.1+Math.sin(t*16)*.2,hy:0,hz:0,crouch:.1});V.ry+=((temVista(V.cur)?vistaLeg(V.cur):-.18)-V.ry)*Math.min(1,dt*3)}
  const k=Math.min(1,dt*7),k2=Math.min(1,dt*(st==='belly'||st==='shake'?3.2:7));
  for(const n in S)S[n]+=(T[n]-S[n])*(n==='roll'?k2:k);
  V.wag+=dt*S.wagS;
  // turntable
  if(st==='pet'||st==='scratch')V.ry+=((temVista(V.cur)?vistaLeg(V.cur):-.35)-V.ry)*dt*2;
  V.ry+=V.vy;V.vy*=.92;V.spin.rotation.y=V.ry;V.spin.rotation.x=V.rx*.6;
  // body
  const shakeOsc=S.shake*Math.sin(el*30)*.45*Math.max(0,1-(el-.45)/1);
  C.root.rotation.z=S.roll+shakeOsc;
  C.root.position.y=C.baseY+(C.backY-C.baseY)*(S.roll/Math.PI)-S.crouch*.14+(st==='belly'?Math.sin(t*3)*.02:0);
  C.root.position.x=st==='hurt'?Math.sin(t*55)*.01:0;
  C.body.scale.set(1+S.crouch*.03,1-S.crouch*.07+Math.sin(t*2.4)*.012,1);
  C.body.rotation.y=st==='belly'?Math.sin(t*2.6)*.12:0;
  C.head.rotation.set(S.hx,S.hy,S.hz+(st==='shake'?shakeOsc*.6:0));
  C.ears.forEach((g,i)=>{g.rotation.x=S.ear+(st==='shake'?Math.sin(el*30+i)*.6*S.shake:0)+(st==='idle'&&Math.sin(t*1.7+i*2)>.97?-.3:0)});
  C.tail.rotation.y=Math.sin(V.wag)*S.wagA;
  C.tail.rotation.x=C.tailBase+S.tailX;
  C.segs.forEach((g,i)=>{if(i)g.rotation.y=(V.sp.tl==='zig'?(i%2?.6:-.6):0)+Math.sin(V.wag-i*.7)*S.wagA*.45});
  C.legs.forEach((g,i)=>{let r=S.paddle*((g.userData.front?.9:-.6)+Math.sin(t*9+i*1.7)*.4);
    if(i===3||(V.sp.bird&&i===1))r+=S.scratch*(-.9+Math.sin(t*32)*.45);
    if(st==='hurt')r+=g.userData.front?-.15*S.crouch:.2*S.crouch;
    g.rotation.x=r});
  {const lo=C.lidOpen!==undefined?C.lidOpen:-1.25;C.lids.forEach(l=>l.rotation.x=lo+S.lid*(Math.PI/2-lo))}
  C.brows.forEach(b=>b.visible=S.brow>.5);
  C.tongue.visible=S.tongue>.05;C.tongue.scale.copy(C.tongue.userData.base).multiplyScalar(Math.max(.01,S.tongue));
  C.tongue.position.y=-V.sp.h*.5-Math.abs(Math.sin(t*9))*.015*S.tongue;
  C.wings.forEach((g,i)=>{const s=i?1:-1;g.rotation.z=s*(Math.sin(t*(st==='pet'||st==='scratch'?14:2.2))*(st==='pet'||st==='scratch'?.25:.05))});
  C.smoke.forEach((m,i)=>{m.position.y=m.userData.base.y+Math.sin(t*1.3+i)*.05});
  if(st==='run'){const r=runPose(el,V.until-V.stT);C.root.position.x=r.x;C.root.position.z=r.z;C.root.rotation.y=r.yaw;C.root.position.y+=Math.abs(Math.sin(t*15))*.09*r.sp;C.body.rotation.x=Math.sin(t*15)*.06*r.sp;
    C.legs.forEach((g,i)=>g.rotation.x=Math.sin(t*15+(i%2?Math.PI:0)+(i>1?.6:0))*.8*r.sp);C.tail.rotation.y=Math.sin(t*20)*.6;C.ears.forEach(g=>g.rotation.x=-.5*r.sp)}
  else{C.root.position.z+=(0-C.root.position.z)*.2;C.root.rotation.y*=.8;if(st!=='hurt')C.root.position.x*=.8;C.body.rotation.x*=.8}
  V.shadow.material.opacity=1-S.roll/Math.PI*.2;popTick(C);stage(t);
  V.renderer.render(V.scene,V.cam);
  if(V.open&&V.mode==='creature')V.raf=requestAnimationFrame(vloop);
}
$('vClose').addEventListener('click',closeViewer);
addEventListener('keydown',e=>{if(e.key==='Escape'&&V.open)closeViewer()});

/* ---------- Terranox: GLB-based validation model ---------- */
const TERRA={};
// personality: calm, sturdy reptile. Everything runs slower and heavier.
const TP=GD.modelos.TP;
function b64u8(s){const bin=atob(s),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return u}
function buildTerra(){
  const mat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.86,metalness:0});
  const parent={head:'body',eyeL:'head',eyeR:'head',legFL:'body',legFR:'body',legBL:'body',legBR:'body',tail0:'body'};
  for(let k=1;k<8;k++)parent['tail'+k]='tail'+(k-1);
  const tag=n=>n==='body'?'body':n==='head'||n.startsWith('eye')?'head':n.startsWith('leg')?'leg':'tail';
  const G={};
  for(const n in TERRA){const d=TERRA[n],g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(b64u8(d.p).buffer),3));
    const c8=b64u8(d.c),cf=new Float32Array(c8.length);for(let i=0;i<c8.length;i++)cf[i]=Math.pow(c8[i]/255,2.2);
    g.setAttribute('color',new THREE.BufferAttribute(cf,3));g.setIndex(new THREE.BufferAttribute(new Uint16Array(b64u8(d.i).buffer),1));g.computeVertexNormals();
    const m=new THREE.Mesh(g,mat);m.userData.part=tag(n);m.userData.leg=n.startsWith('leg')?n:null;
    const grp=new THREE.Group();grp.add(m);G[n]=grp}
  for(const n in TERRA){if(n==='body')continue;const p=TERRA[n].pivot,q=TERRA[parent[n]].pivot;G[n].position.set(p[0]-q[0],p[1]-q[1],p[2]-q[2]);G[parent[n]].add(G[n])}
  // eyelids + brows (added so the face can blink, relax and frown)
  const lidMat=new THREE.MeshStandardMaterial({color:new THREE.Color('#8e9d58').convertSRGBToLinear(),roughness:.9});
  const browMat=new THREE.MeshStandardMaterial({color:new THREE.Color('#3e4a24').convertSRGBToLinear(),roughness:.8});
  const lids=[],brows=[];
  for(const [n,s] of [['eyeL',-1],['eyeR',1]]){
    const lid=new THREE.Mesh(new THREE.SphereGeometry(.215,24,12,0,Math.PI*2,0,Math.PI/2),lidMat);lid.position.set(0,0,.05);G[n].add(lid);lids.push(lid);
    const brow=new THREE.Mesh(new THREE.BoxGeometry(.32,.07,.1),browMat);brow.position.set(0,.25,.1);brow.rotation.z=s*.45;brow.visible=false;G[n].add(brow);brows.push(brow);
  }
  const roll=new THREE.Group();roll.position.y=1.15;G.body.position.y=-1.15;roll.add(G.body);
  const root=new THREE.Group();root.add(roll);
  return {root,roll,G,lids,brows,tail:[0,1,2,3,4,5,6,7].map(k=>G['tail'+k]),legs:{FL:G.legFL,FR:G.legFR,BL:G.legBL,BR:G.legBR}};
}
const TS=GD.modelos.TS;
function tnow(){return (performance.now()-V.t0)/1000}
function tset(s,dur,extra){TS.st=s;TS.stT=tnow();TS.until=TS.stT+dur;Object.assign(TS,extra||{});TS.lastTouch=tnow()}
function openTerra(){
  if(!initViewer()){detail(0);return}
  if(V.C)V.spin.remove(V.C.root);if(V.T)V.spin.remove(V.T.root);
  V.abre=(V.abre||0)+1;tiraModelos();V.mode='terra';V.T=buildTerra();V.C={root:V.T.root};V.T.root.userData.modelo=1;V.spin.add(V.T.root);
  V.T.root.position.y=-1;V.T.root.updateMatrixWorld(true);
  const sz=new THREE.Box3().setFromObject(V.T.root).getSize(new THREE.Vector3());V.size={xz:Math.max(sz.x,sz.z)*.62,y:sz.y};
  Object.assign(V,{ry:-.75,rx:.12,vy:0,t0:performance.now(),taps:[]});
  Object.assign(TS,{st:'idle',until:0,stT:0,lastTouch:0,blinkAt:2,blinkTo:0,lookAt:4,lookY:0,walkAt:9,stroke:0,leg:null,wag:0,
    S:{lid:0,hx:0,hy:0,hz:0,bodyY:0,pitch:0,roll:0,tailX:0,tailAmp:.06,tailSpd:1.2,paddle:0,brow:0,tickle:0,walk:0,lift:0}});
  const p=PLUSH[0];$('vName').textContent=p.name;$('vStats').textContent=p.cm+' cm · '+p.g+' g · protótipo 3D';$('vDesc').textContent='Tranquilo e resistente. Movimentos lentos de réptil.';
  $('gest').innerHTML='<span>Arraste no fundo: girar</span><span>Deslize nele: carinho</span><span>Cabeça · barriga · patas · rabo: reações</span><span>3 toques: incomodado</span><span>Segure: barriga pra cima</span><span>Deslize pra cima nele: corre em círculos</span>';
  $('viewer').hidden=false;V.open=true;document.body.style.overflow='hidden';fit();
  cancelAnimationFrame(V.raf);V.last=performance.now();V.raf=requestAnimationFrame(tloop);
}
function tpart(e){
  const r=$('v3d').getBoundingClientRect();V.ray.setFromCamera({x:(e.clientX-r.left)/r.width*2-1,y:-(e.clientY-r.top)/r.height*2+1},V.cam);
  const h=V.ray.intersectObject(V.T.root,true)[0];if(!h)return null;
  let part=h.object.userData.part||'body';
  if(part==='body'){const lp=V.T.G.body.worldToLocal(h.point.clone());if(lp.y<.75)part='belly'}
  return {part,leg:h.object.userData.leg,point:h.point};
}
function tWake(){if(TS.st==='sleep'){tset('surprise',1.4);tone(520,.12,'sine',.06);setTimeout(()=>tone(700,.1,'sine',.05),90);return true}return false}
function tTap(hit,e){
  const t=tnow();V.taps=V.taps.filter(x=>t-x<1);V.taps.push(t);
  if(tWake())return;
  if(V.taps.length>=3||(TS.st==='annoyed'&&t<TS.until)){tset('annoyed',3.4);float('💢','mad',e);growl();return}
  if(V.taps.length===2&&hit.part!=='head'){tset('curious',1.8);float('❓','love',e);return}
  switch(hit.part){
    case'head':tset('pet',2.6);float('❤','love',e);tone(330,.3,'sine',.07);setTimeout(()=>tone(440,.35,'sine',.06),220);break;
    case'belly':tset('tickle',2.4);float('✨','love',e);[600,760,640,820,700].forEach((f,k)=>setTimeout(()=>tone(f,.08,'triangle',.05),k*110));break;
    case'leg':tset('paw',1.6,{leg:hit.leg});tone(200,.12,'sine',.08);break;
    case'tail':tset('tailTap',2.2);tone(260,.15,'sine',.06);break;
    default:tset('scratch',2.4);float('❤','love',e);for(let k=0;k<5;k++)setTimeout(()=>tone(70,.08,'sine',.18),150+k*160);
  }
}
let tdown=null,tlp=0;
function tDown(e){
  audio();const hit=tpart(e);tdown={x:e.clientX,y:e.clientY,lx:e.clientX,ly:e.clientY,t:performance.now(),hit,moved:false};
  clearTimeout(tlp);if(hit)tlp=setTimeout(()=>{if(tdown&&!tdown.moved){tWake();tset('belly',1e9);float('✨','love');[392,494,587,494,659].forEach((f,k)=>setTimeout(()=>tone(f,.12,'triangle',.06),k*110))}},600);
}
function tMove(e){
  if(!tdown)return;const dx=e.clientX-tdown.lx,dy=e.clientY-tdown.ly;
  if(Math.hypot(e.clientX-tdown.x,e.clientY-tdown.y)>9&&!tdown.moved){tdown.moved=true;clearTimeout(tlp)}
  if(tdown.moved){
    if(tdown.hit&&TS.st!=='belly'){ // stroking the plush
      TS.stroke+=Math.hypot(dx,dy);if(TS.st!=='stroke'){tWake();tset('stroke',1.2)}else TS.until=tnow()+1.2;
      if(TS.stroke>160){TS.stroke=0;float('❤','love',e);tone(300,.35,'sine',.05)}
    }else if(!tdown.hit){V.vy=dx*.011;V.ry+=dx*.011;V.rx=Math.max(-.35,Math.min(.6,V.rx+dy*.006))}
  }
  tdown.lx=e.clientX;tdown.ly=e.clientY;
}
function tUp(e){
  if(!tdown)return;clearTimeout(tlp);
  if(TS.st==='belly'){tset('shake',2.2)}
  else if(!tdown.moved&&performance.now()-tdown.t<350&&tdown.hit)tTap(tdown.hit,e);
  tdown=null;
}
function tloop(now){
  const dt=Math.min(.05,(now-V.last)/1000),t=tnow(),sp=TP.spd;V.last=now;
  const T=V.T,S=TS.S,G=T.G;
  if(TS.st!=='idle'&&TS.st!=='belly'&&TS.st!=='sleep'&&t>TS.until)TS.st='idle';
  if(TS.st==='idle'&&t-(TS.lastTouch||0)>16)tset('sleep',1e9);
  const st=TS.st,el=t-TS.stT;
  // look toward the player: undo the turntable yaw
  const toCam=Math.max(-.9,Math.min(.9,-V.ry));
  const X={lid:0,hx:.05,hy:0,hz:0,bodyY:Math.sin(t*1.1*sp)*.012,pitch:0,roll:0,tailX:0,tailAmp:.07,tailSpd:1.3,paddle:0,brow:0,tickle:0,walk:0,lift:0};
  if(st==='idle'){
    if(t>TS.blinkAt){TS.blinkTo=t+.22;TS.blinkAt=t+3.5+Math.random()*4}if(t<TS.blinkTo)X.lid=1;
    if(t>TS.lookAt){TS.lookY=Math.random()<.4?toCam:(Math.random()-.5)*1.1;TS.lookAt=t+4+Math.random()*4}
    X.hy=TS.lookY;X.hx=.05+Math.sin(t*.4)*.04;
    if(t>TS.walkAt){TS.walkUntil=t+3.2;TS.walkAt=t+14+Math.random()*10}
    if(t<(TS.walkUntil||0))X.walk=1;
  }
  if(st==='sleep')Object.assign(X,{lid:1,hx:.38,hy:.15,bodyY:-.06+Math.sin(t*.9)*.025,tailAmp:.02,tailSpd:.6});
  if(st==='surprise')Object.assign(X,{lid:-.35,hx:-.2,hy:toCam,bodyY:.05,tailX:.15,tailAmp:.15,tailSpd:4});
  if(st==='curious')Object.assign(X,{hx:-.1,hy:toCam,hz:.35*Math.sin(el*2),tailAmp:.12});
  if(st==='pet')Object.assign(X,{lid:el<.3?1:.8,hx:-.15,hy:toCam*.6,hz:.25,tailAmp:.35,tailSpd:3.2});
  if(st==='stroke')Object.assign(X,{lid:.9,hx:.12,hy:toCam*.3,hz:.12,bodyY:-.04,tailAmp:.3,tailSpd:2.4});
  if(st==='scratch')Object.assign(X,{lid:.7,hx:-.2,hz:.18,tailAmp:.4,tailSpd:3.5,lift:1});
  if(st==='tickle')Object.assign(X,{lid:.75,hx:-.25,tickle:1,tailAmp:.45,tailSpd:5,paddle:.5});
  if(st==='paw')Object.assign(X,{hy:TS.leg&&TS.leg.endsWith('L')?.5:-.5,hx:.25});
  if(st==='tailTap')Object.assign(X,{hy:(V.ry>0?-1:1)*.9,hx:.1,tailAmp:.6,tailSpd:4.5,tailX:.25});
  if(st==='annoyed'){Object.assign(X,{lid:.45,hx:.3,hy:-toCam*.9+.4,bodyY:-.08,tailX:-.15,tailAmp:.5,tailSpd:7,brow:1});if(el<.25)X.hy=toCam}
  if(st==='belly')Object.assign(X,{lid:.85,hx:-.2,hy:.3,roll:Math.PI,paddle:1,tailAmp:.3,tailSpd:2.6,bodyY:.12});
  if(st==='shake'){Object.assign(X,{lid:.3,tailAmp:.3,tailSpd:3});}
  const k=Math.min(1,dt*5*sp),kr=Math.min(1,dt*2.2*sp);
  for(const n in S)S[n]+=(X[n]-S[n])*(n==='roll'?kr:k);
  // turntable
  V.ry+=V.vy;V.vy*=.92;V.spin.rotation.y=V.ry;V.spin.rotation.x=V.rx*.6;
  // body: breathing, roll, shake (heavy, low frequency)
  const shake=st==='shake'&&el>.9?Math.sin(el*16)*.28*Math.max(0,1-(el-.9)/1.2):0;
  T.roll.rotation.z=S.roll+shake+(st==='tickle'?Math.sin(t*14)*.06:0);
  T.roll.position.y=1.15+S.bodyY;
  G.body.scale.set(1,1+Math.sin(t*1.1*sp)*.018,1+Math.sin(t*1.1*sp)*.008);
  G.head.rotation.set(S.hx+(st==='sleep'?Math.sin(t*.9)*.02:0),S.hy,S.hz);
  T.lids.forEach(l=>l.rotation.x=-.55+S.lid*(Math.PI/2+.55));T.brows.forEach(b=>b.visible=S.brow>.5);
  // tail: slow S-curve sway
  TS.wag+=dt*S.tailSpd;T.tail.forEach((g,i)=>{g.rotation.y=Math.sin(TS.wag-i*.45)*S.tailAmp*(i?.55:1);g.rotation.x=i===0?-S.tailX:0});
  // legs
  const L=T.legs,wk=S.walk,ph=t*3.2;
  const legSwing={FL:Math.sin(ph)*.28*wk,BR:Math.sin(ph)*.28*wk,FR:Math.sin(ph+Math.PI)*.28*wk,BL:Math.sin(ph+Math.PI)*.28*wk};
  for(const n in L){let r=legSwing[n];
    r+=S.paddle*((n[0]==='F'?-.7:.5)+Math.sin(t*6*sp+'FBRL'.indexOf(n[1])*1.7+(n[0]==='F'?0:2))*.35);
    if(n==='BR')r+=S.lift*(-.6+Math.sin(t*18)*.3);
    if(st==='paw'&&TS.leg==='leg'+n)r+=-.75*Math.sin(Math.min(1,el/1.6)*Math.PI);
    L[n].rotation.x=r;L[n].rotation.z=st==='paw'&&TS.leg==='leg'+n?(n[1]==='L'?-.25:.25)*Math.sin(Math.min(1,el/1.6)*Math.PI):0}
  if(wk>.05)T.roll.rotation.z+=Math.sin(ph)*.025*wk;
  if(st==='sleep'&&Math.floor(t/2.4)!==TS.zz){TS.zz=Math.floor(t/2.4);float('💤','love')}
  V.shadow.material.opacity=1;
  V.renderer.render(V.scene,V.cam);
  if(V.open&&V.mode==='terra')V.raf=requestAnimationFrame(tloop);
}

$('t3d')&&$('t3d').addEventListener('click',()=>{audio();openTerra()});

/* ---------- 15 bichinhos redondos (folha nova): construídos em código, com 3 estágios ---------- */
// b corpo, c focinho/barriga, a detalhe, e íris, f patinhas; ear/horn/extra descrevem as partes. m = manchas pintadas [x,y,z,rx,ry,rz,cor]
const CH_STAGES=GD.pelucias.CH_STAGES;
const CH=GD.pelucias.CH;

const CHF=GD.pelucias.CHF;
function mixc(a,b,t){const A=new THREE.Color(a),B=new THREE.Color(b);return '#'+A.lerp(B,t).getHexString()}
function chibiStage(xp){return xp>=CH_STAGES[2].xp?2:xp>=CH_STAGES[1].xp?1:0}
function sphChain(pts,r0,r1,col){const n=pts.length,pr=pts.map((p,i)=>{const r=r0+(r1-r0)*i/(n-1);return{c:p,r:[r,r,r],col,w:1}});return sdfMesh(pr,.035,.014,0)}
function curve(f,n){const a=[];for(let i=0;i<n;i++)a.push(f(i/(n-1)));return a}
function buildChibi(sp,stage){
  if(!SPH)SPH=new THREE.SphereGeometry(1,30,22);
  const S=CH_STAGES[stage],pf=S.pf,pale=S.pale,tn=c=>pale?mixc(c,'#efe6dc',pale):c;
  const body=grp(),root=grp(),C={root,body,ears:[],legs:[],eyes:[],lids:[],brows:[],segs:[],wings:[],smoke:[]};root.add(body);
  const RX=.64,RY=.56,RZ=.58,B=tn(sp.b),Cc=tn(sp.c),A=tn(sp.a);
  // head blob (the whole body): egg shaped, wider at the bottom, with painted markings and muzzle
  const prims=[{c:[0,.07,0],r:[.58,.52,.54],col:B},{c:[0,-.1,0],r:[.64,.5,.57],col:B,w:1}];
  prims.push({c:[0,-.17,.49],r:[.21,.15,.13],col:Cc,w:6,paint:1});
  if(sp.ear!=='fin')prims.push({c:[0,-.4,.28],r:[.34,.14,.26],col:Cc===B?B:mixc(B,Cc,.5),w:2,paint:1});
  if(stage>=1&&sp.m){const h0=sdfMesh(prims,.1,.03,.004),rc0=new THREE.Raycaster();
    for(const m of sp.m){const p=new THREE.Vector3(m[0],m[1],m[2]);rc0.set(p.clone().multiplyScalar(3),p.clone().negate().normalize());const h=rc0.intersectObject(h0,false)[0],c=h?h.point.clone().multiplyScalar(.97):p;
      prims.push({c:[c.x,c.y,c.z],r:[m[3],m[4],m[5]],col:tn(m[6]),w:stage>=2?16:6,paint:1})}}
  const head=P(grp(),0,0,0);head.userData.part='head';body.add(head);C.head=head;
  const hm=sdfMesh(prims,.1,.03,.004);head.add(hm);hm.updateMatrixWorld(true);const rc=new THREE.Raycaster();
  const hitAt=(o,d)=>{rc.set(o,d.clone().normalize().negate());const h=rc.intersectObject(hm,false)[0];return h?h.point:o.clone().multiplyScalar(.3)};
  // feet
  const fcol=tn(sp.f||sp.c);
  [[-.27,-.5,.3,1],[.27,-.5,.3,1],[-.34,-.48,-.22,0],[.34,-.48,-.22,0]].forEach(([x,y,z,fr])=>{const g=P(grp(),x,y+.12,z);g.userData.front=!!fr;
    g.add(P(ell(fcol,.17,.1,.2),0,-.12,fr?.04:0));if(fr)for(const tx of[-1,0,1])g.add(P(ell(mixc(fcol,'#000000',.18),.035,.03,.04),tx*.07,-.1,.2));body.add(g);C.legs.push(g)});
  C.feet=-.6;
  // eyes
  const er=.2*S.ef*(sp.es||1);
  for(const s of[-1,1]){
    const d=new THREE.Vector3(s*.43,.07,.9).normalize(),t=1/Math.sqrt((d.x/RX)**2+(d.y/RY)**2+(d.z/RZ)**2);
    const hp_=hitAt(d.clone().multiplyScalar(2),d),eo=P(grp(),hp_.x-d.x*.035,hp_.y-d.y*.035,hp_.z-d.z*.035);eo.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),d);head.add(eo);
    const eg=grp();eo.add(eg);
    eg.add(ell('#14101a',er*1.06,er*1.14,er*.55,{gloss:1}));
    eg.add(P(ell(sp.e,er*.86,er*.95,er*.55,{gloss:1}),0,0,er*.12));
    eg.add(P(ell(mixc(sp.e,'#ffffff',.45),er*.62,er*.2,er*.2,{gloss:1}),0,-er*.5,er*.5));
    eg.add(P(ell('#07060a',er*.52,er*.58,er*.4,{gloss:1}),0,er*.02,er*.4));
    const hl=new THREE.Mesh(SPH,new THREE.MeshBasicMaterial({color:0xffffff}));hl.scale.set(er*.22,er*.24,er*.18);P(hl,er*.32,er*.36,er*.74);eg.add(hl);
    const h2=new THREE.Mesh(SPH,new THREE.MeshBasicMaterial({color:0xffffff}));h2.scale.setScalar(er*.12);P(h2,-er*.3,-er*.28,er*.68);eg.add(h2);
    const lid=new THREE.Mesh(new THREE.SphereGeometry(er*1.16,20,10,0,Math.PI*2,0,Math.PI/2),M(B));lid.scale.set(1,1.1,1);lid.rotation.x=-1.95;eg.add(lid);C.lids.push(lid);
    const brow=new THREE.Mesh(new THREE.BoxGeometry(er*1.7,er*.32,er*.35),M('#2a1a1e',{gloss:1}));P(brow,0,er*1.3,er*.5);brow.rotation.z=s*.5;brow.visible=false;eg.add(brow);C.brows.push(brow);
  }
  // nose and w-shaped mouth
  const nz=.5,ny=-.1;const nzz=hitAt(new THREE.Vector3(0,-.1,2),new THREE.Vector3(0,0,1)).z;head.add(P(ell(sp.nose||'#e08a96',.055,.04,.04,{gloss:1}),0,-.1,nzz-.005));
  const tube=new THREE.MeshStandardMaterial({color:new THREE.Color(sp.mouth||'#5a3a3a').convertSRGBToLinear(),roughness:.6});
  for(const s of[-1,1]){const a=new THREE.Mesh(new THREE.TorusGeometry(.04,.0095,6,14,Math.PI),tube);a.rotation.z=Math.PI;const mz=hitAt(new THREE.Vector3(s*.04,-.185,2),new THREE.Vector3(0,0,1)).z;a.position.set(s*.042,-.17,mz+.004);a.rotation.y=s*.12;head.add(a)}
  const nl=new THREE.Mesh(new THREE.BoxGeometry(.009,.05,.009),tube);nl.position.set(0,-.145,hitAt(new THREE.Vector3(0,-.145,2),new THREE.Vector3(0,0,1)).z+.003);head.add(nl);
  const tg=P(ell('#ff7d9a',.05,.018,.07,{gloss:1}),0,-.22,hitAt(new THREE.Vector3(0,-.22,2),new THREE.Vector3(0,0,1)).z-.03);tg.userData.base=tg.scale.clone();tg.visible=false;head.add(tg);C.tongue=tg;
  if((sp.extra||[]).includes('fangs'))for(const s of[-1,1])head.add(P(R(cone('#ffffff',.018,.06,{gloss:1},8),Math.PI,0,0),s*.085,-.2,hitAt(new THREE.Vector3(s*.085,-.2,2),new THREE.Vector3(0,0,1)).z-.005));
  // ears
  const ear=(x,y,z,rz,ry)=>{const g=P(grp(),x,y,z);g.rotation.set(0,ry||0,rz||0);head.add(g);C.ears.push(g);return g};
  const sx=pf;
  const softEar=(col,inCol,L,Wd,T,tipCol)=>{const pr=[{c:[0,0,0],r:[Wd,Wd*.85,T*1.15],col,w:1},{c:[0,L*.5,0],r:[Wd*.78,L*.52,T*.9],col,w:1},{c:[0,L*.92,0],r:[Wd*.3,L*.3,T*.6],col:tipCol||col,w:tipCol?20:1}];
    if(inCol)pr.push({c:[0,L*.45,T*.75],r:[Wd*.5,L*.42,T*.42],col:inCol,w:9,paint:1});return sdfMesh(pr,.05,.02,.002)};
  for(const s of[-1,1]){
    const E=sp.ear,eb=B,ei=tn(sp.earIn||sp.c),tip=sp.tip?tn(sp.tip):null,k=pf;
    const put=(m,x,y,z,rz,ry,rx)=>{const g=ear(x,y,z,rz,ry);m.scale.setScalar(k);m.rotation.x=rx||0;g.add(m);return g};
    if(E==='fox')put(softEar(eb,ei,.58,.3,.09,tip),s*.37,.38,-.04,-s*.42);
    if(E==='cat')put(softEar(eb,ei,.46,.21,.08,tip),s*.37,.38,-.02,-s*.4);
    if(E==='dragonEar'){const g=put(softEar(eb,ei,.5,.21,.08,null),s*.38,.4,-.02,-s*.4);
      for(const [col,r,h,rz] of[['#ff9a1f',.07,.22,.0],['#ffd23a',.05,.16,.5]])g.add(P(R(cone(col,r*k,h*k,{glow:.7}),0,0,-s*rz),0,.5*k,0))}
    if(E==='bat')put(softEar(eb,ei,.56,.27,.08,null),s*.4,.38,-.04,-s*.62);
    if(E==='leaf'){put(softEar(eb,ei,.58,.25,.07,null),s*.4,.38,-.03,-s*.62)}
    if(E==='bunny')put(softEar(eb,ei,.86,.17,.075,null),s*.27,.42,-.06,-s*.2,0,-.08);
    if(E==='bear')put(softEar(eb,ei,.05,.21,.12,null),s*.45,.4,-.03,-s*.35,0,.1);
    if(E==='floppy'){const m=softEar(sp.earC?tn(sp.earC):eb,ei,.52,.14,.07,null);const g=put(m,s*.62,.12,-.08,-s*(2.65),0,0);g.scale.setScalar(sp.horn==='ram'?.62:1)}
    if(E==='fin'){const g=ear(s*.58,.02,-.08,0,s*.9),kk=Math.max(.6,pf);const fg=wingShape(.8*kk,.62*kk,false),fm=new THREE.Mesh(fg,M(sp.fin,{side:1}));fm.rotation.set(0,s>0?0:Math.PI,0);fm.rotation.z=s*.3;fm.position.set(0,-.12*kk,0);g.add(fm);
      for(const q of[-.1,.12,.32]){const rb=new THREE.Mesh(new THREE.BoxGeometry(.52*kk,.014,.014),M(tn(sp.a)));rb.position.set(s*.27*kk,q*kk-.02,.003);rb.rotation.z=s*(q*1.4-.1);g.add(rb)}}
  }
  // horns / crest / extras
  if(sp.horn==='drag'||sp.horn==='demon'){const k=pf*(sp.horn==='demon'?.8:1);for(const s of[-1,1]){const pts=curve(t=>[s*(.48+Math.sin(t*2.2)*.2*k),.34+t*.5*k,-.05-t*.12*k],10);
    const g=sphChain(pts,.075*k,.014,tn(sp.hornC||'#6a2ca6'),{gloss:.6});head.add(g);if(sp.horn==='drag'){const b=P(ell(tn('#b898e8'),.04*k,.04*k,.04*k,{gloss:1}),s*.54,.43,-.05);head.add(b)}}}
  if(sp.horn==='ram'){const k=pf;for(const s of[-1,1]){const pts=curve(t=>{const a=t*Math.PI*2.5+.2,r=.27*k*(1-t*.62);return[s*(.58+Math.sin(a)*r),.26+Math.cos(a)*r-.08*k,-.06+Math.sin(a*.0)*0]},26);
    const g=sphChain(pts,.082*k,.03*k,tn(sp.hornC),{gloss:.35});head.add(g)}}
  if((sp.extra||[]).includes('unihorn')){const h=cone(tn(sp.hornC),.07*pf,.3*pf,{gloss:.6},12);P(h,0,.52,.22);h.rotation.x=.3;head.add(h)}
  if((sp.extra||[]).includes('crestSpikes')){for(const [x,z,h,rz] of[[0,-.08,.3,0],[-.15,-.1,.22,.4],[.15,-.1,.22,-.4]]){const q=P(cone(tn(sp.spikeC||(sp.a==='#5a1f90'?'#8a7aa8':'#3a4a78')),.075*pf,h*pf,{},10),x,.5,z);q.rotation.x=-.25;q.rotation.z=rz;head.add(q)}}
  if((sp.extra||[]).includes('flame')){const g=P(grp(),0,.5,.05);head.add(g);[[0,.34,0],[-.1,.24,.5],[.1,.24,-.5]].forEach(([x,h,rz],i)=>{const q=R(P(cone(sp.flameC[i?1:0],.1*pf,h*pf,{glow:.5},10),x*.4,0,0),0,0,rz*.5);q.scale.z=.7;g.add(q)})}
  if((sp.extra||[]).includes('sprout')){const g=P(grp(),0,.55,.04);head.add(g);g.add(P(cyl('#4f8a2a',.02*pf,.02*pf,.2*pf),0,.2*pf,0));
    for(const s of[-1,1]){const l=R(P(ell('#7cc84a',.15*pf,.045*pf,.07*pf),s*.12*pf,.0,0),0,0,s*.4);l.rotation.z=s*.45;const lg=P(grp(),0,.19*pf,0);lg.add(l);g.add(lg)}}
  if((sp.extra||[]).includes('dorsal')){const k=Math.max(.6,pf);const m=new THREE.Mesh(wingShape(.5*k,.5*k,false),M(sp.fin,{side:1}));m.rotation.set(0,Math.PI/2,Math.PI/2);m.position.set(0,.5,-.1);m.scale.set(1.2,1.5,1);head.add(m);}
  if((sp.extra||[]).includes('antenna')){for(const s of[-1,1]){const g=P(grp(),s*.2,.5,-.02);g.rotation.z=-s*.38;head.add(g);const k=pf;g.add(P(cyl(tn('#8ede44'),.022,.022,.5*k),0,.5*k,0));g.add(P(ell(tn('#8ede44'),.085*k,.085*k,.085*k),0,.56*k,0))}}
  if((sp.extra||[]).includes('diamond')&&stage>=1){const d=new THREE.Mesh(new THREE.OctahedronGeometry(.13*Math.min(1,pf+.1),0),M(sp.dia,{gloss:1,glow:.35}));d.scale.set(.78,1.2,.35);d.position.set(0,.3,.53);head.add(d)}
  if((sp.extra||[]).includes('heart')&&stage>=1){}
  // tail
  const tail=P(grp(),0,-.35,-.5);tail.rotation.x=.45;body.add(tail);C.tail=tail;C.tailBase=.45;const T=sp.tail;
  const tk=Math.max(.6,pf);
  if(T==='puff')tail.add(P(ell(B,.14*tk,.14*tk,.14*tk),0,0,-.1));
  if(T==='fox'){tail.add(P(ell(B,.18*tk,.18*tk,.34*tk),0,0,-.22));tail.add(P(ell(tn(sp.c),.15*tk,.15*tk,.14*tk),0,0,-.5*tk))}
  if(T==='cat'){tail.add(P(ell(B,.07*tk,.07*tk,.4*tk),0,0,-.25));tail.add(P(ell(sp.tip?tn(sp.tip):B,.075*tk,.075*tk,.1*tk),0,0,-.52*tk))}
  if(T==='leaf'){tail.add(R(P(ell(tn('#8ccf5a'),.14*tk,.04*tk,.3*tk),0,0,-.25),0,0,0))}
  if(T==='dragon'){tail.add(P(ell(B,.1*tk,.1*tk,.32*tk),0,0,-.2));const c=R(P(cone(tn(sp.tailFlame?'#ff9a1f':(sp.a)),.11*tk,.34*tk,{glow:sp.tailFlame?.5:0},12),0,0,-.45*tk),-Math.PI/2,0,0);tail.add(c)}
  if(T==='fish'){const m=new THREE.Mesh(wingShape(.5*tk,.5*tk,false),M(sp.fin,{side:1}));m.rotation.set(0,Math.PI/2,-Math.PI/2);m.position.set(0,-.18*tk,0);tail.add(m);tail.add(P(ell(B,.1*tk,.1*tk,.2*tk),0,0,-.12))}
  C.lidOpen=-1.95;C.baseY=0;return C}
function chibiSize(i,stage){const sp=CH[i-CH0];if(stage===2){}const C=buildChibi(sp,2);C.root.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(C.root),z=b.getSize(new THREE.Vector3());return{xz:Math.max(z.x,z.z),y:z.y,top:b.max.y}}
const CHSZ=GD.pelucias.CHSZ;
function openChibi(i,stage,pop){
  setDet(i);
  if(!initViewer())return false;
  if(V.C&&V.C.root)V.spin.remove(V.C.root);if(V.T){V.spin.remove(V.T.root);V.T=null}
  const sp=CH[i-CH0],S=CH_STAGES[stage],C=buildChibi(sp,stage);
  V.mode='creature';V.chibi=true;V.C=C;V.sp={h:.5,tl:'',bird:0};
  const gs=S.gs;C.gs=gs;C.root.scale.setScalar(gs);
  setFloor(i);castAll(C.root);
  C.baseY=-1-C.feet*gs;C.backY=-1+.62*gs;C.root.position.y=C.baseY;V.abre=(V.abre||0)+1;tiraModelos();C.root.userData.modelo=1;V.spin.add(C.root);
  if(!CHSZ[i])CHSZ[i]=chibiSize(i,2);V.size={xz:CHSZ[i].xz,y:CHSZ[i].y};
  Object.assign(V,{ry:-.5,rx:.1,vy:0,st:'idle',until:0,taps:[],t0:performance.now(),blinkAt:1.5,blinkTo:0,wag:0,side:1,pop:pop?performance.now():0,
    S:{lid:0,ear:0,tailX:0,wagA:.2,wagS:5,tongue:0,hx:0,hy:0,hz:0,crouch:0,roll:0,paddle:0,scratch:0,shake:0,brow:0,flap:0}});
  return true}
