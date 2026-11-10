/* GARRO — vitrine 3D da máquina, bichos montados em código, formas evoluídas e a API GARRO. Parte 8 de 8 do antigo js/garro.js: os arquivos são carregados em ordem (js/garro/*.js) e dividem o mesmo escopo global. */
/* ---------- attract screen: the real 3D claw machine ---------- */
(function attract(){const el=$('attract');if(!window.THREE||!THREE.GLTFLoader)return;
  let R;try{R=new THREE.WebGLRenderer({canvas:$('a3d'),antialias:true,alpha:true})}catch(e){return}
  el.hidden=false;R.setPixelRatio(Math.min(devicePixelRatio||1,2));R.outputEncoding=THREE.sRGBEncoding;R.shadowMap.enabled=true;R.shadowMap.type=THREE.PCFSoftShadowMap;
  const sc=new THREE.Scene(),cam=new THREE.PerspectiveCamera(34,1,.05,50);
  sc.add(new THREE.HemisphereLight(0xfff0f6,0x3a1830,.75));
  const k=new THREE.DirectionalLight(0xffffff,1.1);k.position.set(1.6,3.2,2.4);k.castShadow=true;k.shadow.mapSize.set(1024,1024);Object.assign(k.shadow.camera,{left:-1.2,right:1.2,top:1.6,bottom:-.4,near:.5,far:8});k.shadow.radius=4;sc.add(k);
  const pk=new THREE.PointLight(0xff4f9a,1.2,4);pk.position.set(-1,1.2,1);sc.add(pk);const bl=new THREE.PointLight(0x4f8aff,.9,4);bl.position.set(1.1,.6,-.8);sc.add(bl);
  const ft=floorTex('stars'),fl=new THREE.Mesh(new THREE.CircleGeometry(1.25,64),new THREE.MeshStandardMaterial({map:ft.map,emissiveMap:ft.glow,emissive:0xffffff,emissiveIntensity:.6,transparent:true,roughness:.6}));
  fl.rotation.x=-Math.PI/2;fl.receiveShadow=true;sc.add(fl);
  const sh=new THREE.Mesh(new THREE.PlaneGeometry(.75,.75),new THREE.MeshBasicMaterial({map:shadowTex(),transparent:true,depthWrite:false}));sh.rotation.x=-Math.PI/2;sh.position.y=.004;sc.add(sh);
  const spin=new THREE.Group();sc.add(spin);let t0=performance.now(),raf=0,leaving=0,ok=false;
  const size=()=>{const w=innerWidth,h=innerHeight;R.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix()};size();addEventListener('resize',size);
  loadGLB({file:'models/machine.glb'}).then(src=>{const o=src.clone(true);o.traverse(m=>{if(m.isMesh){if(!m.geometry.attributes.normal)weldNormals(m.geometry);m.castShadow=true;
      const mm=m.material.clone();if(mm.map)mm.map.encoding=THREE.sRGBEncoding;mm.roughness=.55;mm.metalness=.1;m.material=mm}});
    const b=new THREE.Box3().setFromObject(o),z=b.getSize(new THREE.Vector3()),s=1.3/z.y;o.scale.setScalar(s);o.position.set(-(b.min.x+z.x/2)*s,0,-(b.min.z+z.z/2)*s);spin.add(o);ok=true}).catch(()=>{});
  const target=new THREE.Vector3(0,.82,.6);
  function loop(now){const t=(now-t0)/1000;
    if(!leaving){spin.rotation.y=Math.sin(t*.35)*.55;const fit=Math.max(1,.62/cam.aspect);cam.position.set(Math.sin(t*.2)*.15,.95,2.9*fit);cam.lookAt(0,.62,0)}
    else{const u=Math.min(1,(now-leaving)/900);spin.rotation.y*=.88;cam.position.lerp(target,.12);cam.lookAt(0,.78,0);if(u>=1){end();return}}
    fl.material.emissiveIntensity=.5+Math.sin(t*2)*.15;pk.intensity=1+Math.sin(t*3)*.3;
    try{R.render(sc,cam)}catch(e){if(leaving){end();return}}raf=requestAnimationFrame(loop)}
  let fim=false;
  function end(){if(fim)return;fim=true;cancelAnimationFrame(raf);el.classList.add('out');setTimeout(()=>{el.hidden=true;try{R.dispose();R.forceContextLoss&&R.forceContextLoss()}catch(e){}},520)}
  // JOGAR sempre entra: o som e a animação são extras (se falharem no celular, entra assim mesmo)
  $('play').addEventListener('click',()=>{if(leaving)return;leaving=performance.now();try{audio();[392,523,659,784].forEach((f,i)=>setTimeout(()=>tone(f,.12,'triangle',.1),i*80))}catch(e){}
    if(!ok)end();setTimeout(end,1300)});
  raf=requestAnimationFrame(loop);
})();
/* ---------- Flarion: raposa de fogo montada em código, igual à folha de referência ---------- */
const FOXC=GD.modelos.FOXC;
let FLM=null;
function flameLeaf(len,wid,c0,c1,bend,seed){
  const sh=new THREE.Shape();sh.moveTo(0,0);sh.bezierCurveTo(wid*1.5,len*.2,wid*1.3,len*.82,wid*.1,len);sh.bezierCurveTo(-wid*.9,len*.88,-wid*1.4,len*.3,0,0);
  const g=new THREE.ShapeGeometry(sh,14),p=g.attributes.position,n=p.count,col=new Float32Array(n*3),A=new THREE.Color(c0).convertSRGBToLinear(),B=new THREE.Color(c1).convertSRGBToLinear();
  for(let i=0;i<n;i++){const t=Math.min(1,Math.max(0,p.getY(i)/len)),u=Math.min(1,t*1.15);p.setZ(i,t*t*bend*len);col[i*3]=A.r+(B.r-A.r)*u;col[i*3+1]=A.g+(B.g-A.g)*u;col[i*3+2]=A.b+(B.b-A.b)*u}
  g.setAttribute('color',new THREE.BufferAttribute(col,3));g.computeVertexNormals();
  FLM=FLM||new THREE.MeshStandardMaterial({vertexColors:true,roughness:.85,metalness:0,side:THREE.DoubleSide});
  return new THREE.Mesh(g,FLM)}
function leafAt(parent,pos,dir,len,wid,c0,c1,bend,roll){const m=flameLeaf(len,wid,c0,c1,bend);m.position.set(pos[0],pos[1],pos[2]);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(dir[0],dir[1],dir[2]).normalize());m.rotateY(roll||0);parent.add(m);return m}
function buildFox(evo){
  if(!SPH)SPH=new THREE.SphereGeometry(1,30,22);
  const F=FOXC,body=grp(),root=grp(),C={root,body,ears:[],legs:[],eyes:[],lids:[],brows:[],segs:[],wings:[],smoke:[]};root.add(body);
  // corpo: tronco baixo e fofo, peito largo, manchas escuras nos flancos
  const bp=[{c:[0,-.12,-.12],r:[.37,.33,.5],col:F.o},{c:[0,-.1,.22],r:[.34,.33,.3],col:F.o},{c:[0,-.2,-.5],r:[.3,.28,.3],col:F.o}];
  for(const s of[-1,1]){bp.push({c:[s*.34,-.08,-.18],r:[.1,.12,.14],col:F.dk,w:5,paint:1},{c:[s*.3,-.24,-.4],r:[.1,.08,.12],col:F.dk,w:5,paint:1},{c:[s*.28,.12,-.35],r:[.09,.07,.1],col:F.r,w:5,paint:1},{c:[s*.2,.2,-.1],r:[.14,.06,.2],col:F.o2,w:3,paint:1})}
  bp.push({c:[0,-.38,.0],r:[.22,.08,.4],col:F.cr,w:3,paint:1});
  body.add(sdfMesh(bp,.1,.034,.004));
  // gola creme: peito felpudo de lóbulos macios
  const ru=[{c:[0,-.22,.36],r:[.3,.26,.22],col:F.cr,w:1},{c:[0,-.34,.34],r:[.24,.16,.22],col:F.cr,w:1}];
  for(let k=0;k<11;k++){const a=(k-5)/5,x=a*.3;ru.push({c:[x,-.34+Math.abs(a)*.12+(k%2?-.04:.02),.46-Math.abs(a)*.1],r:[.1,.1,.1],col:F.cr,w:1})}
  for(const s of[-1,1])ru.push({c:[s*.27,-.14,.34],r:[.1,.16,.14],col:F.cr,w:1});
  body.add(sdfMesh(ru,.05,.03,.004));
  // juba de chamas: folhas de fogo largas varridas para trás, por cima do pescoço e das costas
  let sd=7;const rnd=()=>(sd=(sd*16807)%2147483647)/2147483647;
  for(let q=0;q<5;q++)for(const x of[-.34,-.17,0,.17,.34]){const z0=.2-q*.2-Math.abs(x)*.3,y0=.2-Math.abs(x)*.35+(q?0:.05);
    leafAt(body,[x,y0,z0],[x*1.3,.5+rnd()*.25,-.8-rnd()*.3],.66+rnd()*.2-q*.05,.2+rnd()*.06,q%2?'#e4501a':'#f06a22',rnd()>.5?'#ffc23a':'#ffa52e',.14,rnd()*3)}
  // pernas: coxa laranja, canela e pata escuras
  [[-.2,.3,1],[.2,.3,1],[-.22,-.42,0],[.22,-.42,0]].forEach(([x,z,fr])=>{const g=P(grp(),x,-.27,z);g.userData.front=!!fr;
    g.add(sdfMesh([{c:[0,-.07,0],r:[.13,.17,.13],col:F.o,w:1},{c:[0,-.21,0],r:[.1,.1,.1],col:F.paw,w:1},{c:[0,-.3,.05],r:[.11,.06,.15],col:F.paw,w:1}],.05,.03,0));
    if(fr)for(const tx of[-1,0,1])g.add(P(ell('#150a08',.022,.02,.03),tx*.05,-.33,.19));
    body.add(g);C.legs.push(g)});
  C.feet=-.6;
  // cabeça
  const head=P(grp(),0,0,0);head.userData.part='head';body.add(head);C.head=head;
  const hp=[{c:[0,0,0],r:[.34,.29,.3],col:F.o},{c:[0,-.07,.27],r:[.12,.1,.19],col:F.o2,w:2},{c:[0,-.14,.12],r:[.2,.08,.2],col:F.cr,w:2,paint:1},{c:[0,-.13,.36],r:[.08,.05,.1],col:F.cr,w:6,paint:1}];
  for(const s of[-1,1]){hp.push({c:[s*.3,-.1,.06],r:[.1,.14,.2],col:F.cr,w:2,paint:1},{c:[s*.14,.2,.2],r:[.06,.05,.07],col:F.dk,w:5,paint:1})}
  hp.push({c:[0,.14,.24],r:[.035,.07,.05],col:F.r,w:4,paint:1});
  const hm=sdfMesh(hp,.08,.028,.003);head.add(hm);hm.updateMatrixWorld(true);const rc=new THREE.Raycaster();
  const hitAt=(o,d)=>{rc.set(o,d.clone().normalize());const h=rc.intersectObject(hm,false)[0];return h?h.point:o.clone().add(d.clone().multiplyScalar(-1.5))};
  const zAt=(x,y)=>hitAt(new THREE.Vector3(x,y,2),new THREE.Vector3(0,0,-1)).z;
  head.add(P(ell('#120808',.05,.038,.04,{gloss:1}),0,-.04,zAt(0,-.04)-.005));
  const tube=new THREE.MeshStandardMaterial({color:new THREE.Color('#3a1812').convertSRGBToLinear(),roughness:.6});
  for(const s of[-1,1]){const a=new THREE.Mesh(new THREE.TorusGeometry(.04,.009,6,14,Math.PI),tube);a.rotation.z=Math.PI;a.position.set(s*.04,-.13,zAt(s*.04,-.13)+.004);head.add(a)}
  const nl=new THREE.Mesh(new THREE.BoxGeometry(.009,.05,.009),tube);nl.position.set(0,-.09,zAt(0,-.09)+.003);head.add(nl);
  const tg=P(ell('#ff7d9a',.04,.016,.06,{gloss:1}),0,-.17,zAt(0,-.17)-.04);tg.userData.base=tg.scale.clone();tg.visible=false;head.add(tg);C.tongue=tg;
  // olhos (no lugar certo da superfície)
  const er=.088;
  for(const s of[-1,1]){const x=s*.14,y=.07,z=zAt(x,y),d=new THREE.Vector3(s*.45,.15,1).normalize(),eo=P(grp(),x-d.x*.03,y-d.y*.03,z-d.z*.03);eo.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),d);head.add(eo);
    const eg=grp();eo.add(eg);
    eg.add(ell('#150b0a',er*1.05,er*1.15,er*.55,{gloss:1}));
    eg.add(P(ell('#4a2412',er*.8,er*.9,er*.5,{gloss:1}),0,0,er*.12));
    eg.add(P(ell('#050303',er*.58,er*.66,er*.42,{gloss:1}),0,0,er*.3));
    const hl=new THREE.Mesh(SPH,new THREE.MeshBasicMaterial({color:0xffffff}));hl.scale.set(er*.26,er*.28,er*.2);P(hl,er*.3,er*.34,er*.7);eg.add(hl);
    const lid=new THREE.Mesh(new THREE.SphereGeometry(er*1.18,20,10,0,Math.PI*2,0,Math.PI/2),M(F.o));lid.scale.set(1,1.1,1);lid.rotation.x=-1.95;eg.add(lid);C.lids.push(lid);
    const brow=new THREE.Mesh(new THREE.BoxGeometry(er*1.7,er*.32,er*.35),M('#2a1a1e',{gloss:1}));P(brow,0,er*1.3,er*.5);brow.rotation.z=s*.5;brow.visible=false;eg.add(brow);C.brows.push(brow)}
  // orelhas de raposa: altas, laranja por fora, escuras por dentro, ponta escura
  for(const s of[-1,1]){const g=P(grp(),s*.2,.22,-.04);g.rotation.set(0,0,-s*.38);g.scale.setScalar(1.02);head.add(g);C.ears.push(g);
    g.add(sdfMesh([{c:[0,0,0],r:[.15,.12,.07],col:F.o,w:1},{c:[0,.2,0],r:[.12,.2,.055],col:F.o,w:1},{c:[0,.4,0],r:[.04,.15,.035],col:'#5a2418',w:10},{c:[0,.2,.045],r:[.075,.2,.035],col:'#2a100c',w:9,paint:1},{c:[0,.05,.05],r:[.08,.07,.03],col:F.cr,w:6,paint:1}],.05,.02,.002));
  }
  for(const s of[-1,1])for(let q=0;q<3;q++)leafAt(head,[s*(.12+q*.03),.22,-.12-q*.05],[s*.25,.8,-.6],.4+q*.04,.1,'#e4501a','#ffb02e',.12,q);
  for(let q=0;q<4;q++){const x=(q-1.5)*.07;leafAt(head,[x,.24,-.02-Math.abs(x)],[x*2,.7,-.5],.42+(q%2)*.1,.1,'#f06a22','#ffc23a',.1,q)}
  for(const s of[-1,1])for(let q=0;q<4;q++)leafAt(head,[s*.3,-.12+q*.07,.0-q*.03],[s*.5,.12-q*.04,-1],.36-q*.03,.11,q%2?'#f08a2a':'#e4581e','#ffc940',.1,q);
  // tufos creme no peito e nas bochechas
  for(let k=0;k<11;k++){const a=(k-5)/5;leafAt(body,[a*.3,-.16,.5-Math.abs(a)*.12],[a*1.1,-.9,.5],.26,.13,'#f2dfc0','#fff8e8',.15,k)}
  for(let k=0;k<9;k++){const a=(k-4)/4;leafAt(body,[a*.26,-.3,.46-Math.abs(a)*.1],[a*1.0,-1,.2],.24,.13,'#f2dfc0','#fff8e8',.15,k+2)}
  for(const s of[-1,1])for(let q=0;q<3;q++)leafAt(head,[s*.26,-.14-q*.03,.1],[s*1,-.5-q*.2,.6],.22,.12,'#f5e4c6','#fff8e8',.15,q);
  // cauda enorme de chamas, enrolada para cima
  const tail=P(grp(),0,-.12,-.58);tail.rotation.x=.25;body.add(tail);C.tail=tail;C.tailBase=.25;
  const tp=[[0,0,0],[0,.02,-.2],[0,.12,-.4],[0,.32,-.52],[0,.58,-.52],[0,.8,-.4]];
  tail.add(xchain(tp,.18,.1,F.o,F.o2));
  for(let q=0;q<28;q++){const t=.15+q/27*.85,py=.05+t*.85,pz=-.3-Math.sin(t*2.3)*.28,side=(q%3-1);
    leafAt(tail,[side*.07,py,pz],[side*.55,.6+t*.5,-.25+t*.45],.62+t*.28,.28,q%3?'#e4501a':'#c8391a',q%2?'#ffc23a':'#ffa52e',.14,q)}
  leafAt(tail,[0,.8,-.35],[0,1,.15],.8,.3,'#f06a22','#ffd04a',.1,0);
  if(evo){// Flarion Inferno: asas de chamas, juba maior e brilho
    for(const s of[-1,1]){const w=P(grp(),s*.14,.2,-.02);body.add(w);for(let k=0;k<9;k++){const t=k/8,a=(-10+t*95)*Math.PI/180;leafAt(w,[0,0,0],[s*Math.cos(a),Math.sin(a),-.35-.3*t],.95-.25*Math.abs(t-.3),.2,t<.5?'#e4501a':'#f06a22',t<.5?'#ffb02e':'#ffd64a',.18,0)}C.wings.push(w)}
    for(let q=0;q<10;q++){const x=(q%5-2)*.14;leafAt(body,[x,.25,.1-Math.floor(q/5)*.2],[x*1.3,.6,-.8],.8,.22,'#f06a22','#ffd04a',.15,q)}}
  head.position.set(0,.27,.4);head.scale.setScalar(1.3);C.lidOpen=-1.95;C.baseY=0;C.mouth=[0,-.12,.45];C.headTest=lp=>lp.z>-.2&&lp.y>-.3;return C}
function foxSize(id){const C=PROC[id](false);C.root.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(C.root),z=b.getSize(new THREE.Vector3());return{xz:Math.max(z.x,z.z),y:z.y}}
let FOXSZ={};

/* ---------- Nimbri: carneirinho de nuvem montado em código, igual à folha de referência ---------- */
function buildCloud(evo){
  if(!SPH)SPH=new THREE.SphereGeometry(1,30,22);
  const W='#f4f6fb',W2='#dde7f7',B='#6f9be0',B2='#9dbcf0',body=grp(),root=grp(),C={root,body,ears:[],legs:[],eyes:[],lids:[],brows:[],segs:[],wings:[],smoke:[]};root.add(body);
  let sd=11;const rnd=()=>(sd=(sd*16807)%2147483647)/2147483647;
  // corpo: couve-flor de bolinhas de algodão brancas, algumas azuladas
  const bp=[{c:[0,-.05,-.08],r:[.46,.38,.55],col:W}];
  for(let k=0;k<38;k++){const t=(k+.5)/38,ph=Math.acos(1-2*t),th=Math.PI*(1+Math.sqrt(5))*k,x=Math.sin(ph)*Math.cos(th),y=Math.cos(ph),z=Math.sin(ph)*Math.sin(th);
    if(y<-.55)continue;const r=.17+rnd()*.08;bp.push({c:[x*.52,-.03+y*.42,-.1+z*.58],r:[r,r,r],col:k%5===2?W2:W,w:1})}
  body.add(sdfMesh(bp,.028,.03,.006));
  // golinha de pelo ao redor do pescoço
  const nk=[];for(let k=0;k<9;k++){const a=(k/9)*Math.PI*2;nk.push({c:[Math.cos(a)*.28,.02+Math.sin(a)*.2,.34],r:[.15,.15,.15],col:k%3?W:W2,w:1})}
  body.add(sdfMesh(nk,.03,.03,.005));
  // pernas curtas, patinhas azul-claras
  [[-.2,.3,1],[.2,.3,1],[-.22,-.4,0],[.22,-.4,0]].forEach(([x,z,fr])=>{const g=P(grp(),x,-.34,z);g.userData.front=!!fr;
    g.add(sdfMesh([{c:[0,-.08,0],r:[.14,.15,.14],col:W,w:1},{c:[0,-.22,.04],r:[.11,.06,.14],col:B2,w:1}],.04,.03,0));body.add(g);C.legs.push(g)});
  C.feet=-.62;
  // cauda: nuvem grande de bolinhas azuis e brancas
  const tail=P(grp(),0,.0,-.62);tail.rotation.x=.2;body.add(tail);C.tail=tail;C.tailBase=.2;
  const tp=[];[[-.12,.12,-.12,.17,B],[.08,.3,-.2,.18,B2],[-.16,.46,-.1,.15,B],[.12,.14,-.3,.17,W],[0,.0,-.1,.17,W],[.16,.42,-.28,.14,B2],[-.06,.26,-.34,.15,B],[.2,.26,-.08,.13,W2],[-.2,.28,-.26,.14,B2],[.02,.46,-.24,.13,B]].forEach(([x,y,z,r,c])=>tp.push({c:[x,y,z],r:[r,r,r],col:c,w:c===B||c===B2?4:1}));
  tail.add(sdfMesh(tp,.03,.03,.005));
  // cabeça pequena e branca
  const head=P(grp(),0,0,0);head.userData.part='head';body.add(head);C.head=head;
  const hp=[{c:[0,0,0],r:[.29,.25,.27],col:W},{c:[0,-.07,.22],r:[.13,.1,.12],col:W,w:1},{c:[0,-.1,.3],r:[.04,.03,.03],col:B2,w:5,paint:1}];
  for(const s of[-1,1])hp.push({c:[s*.2,-.1,.1],r:[.14,.13,.14],col:W,w:1});
  const hm=sdfMesh(hp,.05,.026,.004);head.add(hm);hm.updateMatrixWorld(true);const rc=new THREE.Raycaster();
  const zAt=(x,y)=>{rc.set(new THREE.Vector3(x,y,2),new THREE.Vector3(0,0,-1));const h=rc.intersectObject(hm,false)[0];return h?h.point.z:.25};
  head.add(P(ell('#8fb4ee',.036,.026,.03,{gloss:1}),0,-.07,zAt(0,-.07)-.004));
  const tube=new THREE.MeshStandardMaterial({color:new THREE.Color('#6a86b8').convertSRGBToLinear(),roughness:.6});
  for(const s of[-1,1]){const a=new THREE.Mesh(new THREE.TorusGeometry(.035,.008,6,14,Math.PI),tube);a.rotation.z=Math.PI;a.position.set(s*.035,-.12,zAt(s*.035,-.12)+.004);head.add(a)}
  const tg=P(ell('#ff7d9a',.035,.014,.05,{gloss:1}),0,-.15,zAt(0,-.15)-.03);tg.userData.base=tg.scale.clone();tg.visible=false;head.add(tg);C.tongue=tg;
  const er=.082;
  for(const s of[-1,1]){const x=s*.13,y=.05,z=zAt(x,y),d=new THREE.Vector3(s*.5,.1,1).normalize(),eo=P(grp(),x-d.x*.03,y-d.y*.03,z-d.z*.03);eo.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),d);head.add(eo);
    const eg=grp();eo.add(eg);
    eg.add(ell('#15202e',er*1.05,er*1.15,er*.55,{gloss:1}));
    eg.add(P(ell('#3f8fe6',er*.8,er*.9,er*.5,{gloss:1}),0,0,er*.12));
    eg.add(P(ell('#05080e',er*.55,er*.62,er*.42,{gloss:1}),0,0,er*.3));
    const hl=new THREE.Mesh(SPH,new THREE.MeshBasicMaterial({color:0xffffff}));hl.scale.set(er*.26,er*.28,er*.2);P(hl,er*.3,er*.34,er*.7);eg.add(hl);
    const lid=new THREE.Mesh(new THREE.SphereGeometry(er*1.18,20,10,0,Math.PI*2,0,Math.PI/2),M(W));lid.scale.set(1,1.1,1);lid.rotation.x=-1.95;eg.add(lid);C.lids.push(lid);
    const brow=new THREE.Mesh(new THREE.BoxGeometry(er*1.7,er*.32,er*.35),M('#3a4a6a',{gloss:1}));P(brow,0,er*1.3,er*.5);brow.rotation.z=s*.5;brow.visible=false;eg.add(brow);C.brows.push(brow)}
  // orelhas: tufos azuis encaracolados ao lado da cabeça + topete azul atrás
  for(const s of[-1,1]){const g=P(grp(),s*.24,.16,-.05);head.add(g);C.ears.push(g);
    g.add(sdfMesh([{c:[0,0,0],r:[.13,.13,.13],col:B,w:1},{c:[s*.06,.1,-.05],r:[.1,.1,.1],col:B2,w:1},{c:[s*.12,-.02,-.06],r:[.09,.09,.09],col:B,w:1},{c:[0,.02,.1],r:[.08,.08,.08],col:B,w:1}],.04,.026,.003))}
  head.add(sdfMesh([{c:[-.1,.26,-.12],r:[.13,.12,.12],col:B,w:1},{c:[.1,.28,-.1],r:[.12,.12,.12],col:B2,w:1},{c:[0,.33,-.2],r:[.14,.13,.13],col:B,w:1},{c:[0,.22,-.02],r:[.1,.08,.1],col:W,w:1}],.05,.028,.003));
  if(evo){// Nimbri Tempestade: nuvem maior, mais azul, com raios
    const cp=[];for(let k=0;k<12;k++){const a=k*2.4;cp.push({c:[Math.cos(a)*.3,.38+(k%3)*.07,-.1+Math.sin(a)*.4],r:[.17,.17,.17],col:k%2?B:B2,w:4})}
    body.add(sdfMesh(cp,.03,.03,.005));
    const bolt=new THREE.MeshBasicMaterial({color:0xffe85a});
    for(const s of[-1,1])for(let k=0;k<3;k++){const g=P(grp(),s*(.5+k*.04),.1+k*.2,-.1-k*.18);const pts=[[0,.2,0],[.06*s,.08,0],[-.02*s,.02,0],[.05*s,-.14,0]];for(let q=0;q<3;q++){const a=pts[q],b=pts[q+1],d=new THREE.Vector3(b[0]-a[0],b[1]-a[1],0),m=new THREE.Mesh(new THREE.BoxGeometry(.014,d.length(),.014),bolt);m.position.set((a[0]+b[0])/2,(a[1]+b[1])/2,0);m.rotation.z=-Math.atan2(d.x,d.y);g.add(m)}body.add(g)}}
  head.position.set(0,.1,.6);head.scale.setScalar(1.12);
  C.lidOpen=-1.95;C.baseY=0;C.mouth=[0,-.1,.28];C.headTest=lp=>lp.z>-.2&&lp.y>-.28;return C}

/* ---------- formas evoluídas dos 20 grandes (nível 50): asas, cristais, coroas e brilhos, como na folha de evolução ---------- */
const EVY=new THREE.Vector3(0,1,0),EVS=.5;
function evBasis(m,dir){const y=new THREE.Vector3(dir[0],dir[1],dir[2]).normalize(),z=new THREE.Vector3(0,0,1).addScaledVector(y,-y.z);if(z.lengthSq()<.02)z.set(0,1,0);z.normalize();const x=new THREE.Vector3().crossVectors(y,z);m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,y,z))}
function evLeaf(g,pos,dir,len,wid,c0,c1,bend,flat,roll){len*=EVS;wid*=EVS;const m=flameLeaf(len,wid,c0,c1,bend);m.position.set(pos[0],pos[1],pos[2]);if(flat)evBasis(m,dir);else{m.quaternion.setFromUnitVectors(EVY,new THREE.Vector3(dir[0],dir[1],dir[2]).normalize());m.rotateY(roll||0)}g.add(m);return m}
function evFan(side,pos,n,len,wid,a0,a1,c0,c1,bend){const g=new THREE.Group();g.position.set(pos[0],pos[1],pos[2]);
  for(let k=0;k<n;k++){const t=n>1?k/(n-1):0,a=(a0+(a1-a0)*t)*Math.PI/180;evLeaf(g,[0,0,0],[side*Math.cos(a),Math.sin(a),-.3-.25*t],len*(1-.28*Math.abs(t-.3)),wid,c0,c1,bend,true)}return g}
function evMat(col,glow){return new THREE.MeshStandardMaterial({color:new THREE.Color(col).convertSRGBToLinear(),roughness:.55,metalness:.05,emissive:new THREE.Color(col).convertSRGBToLinear(),emissiveIntensity:glow||0})}
function evCone(g,pos,dir,r,h,col,glow,seg){r*=EVS;h*=EVS;const geo=new THREE.ConeGeometry(r,h,seg||6);geo.translate(0,h/2,0);const m=new THREE.Mesh(geo,evMat(col,glow));m.position.set(pos[0],pos[1],pos[2]);m.quaternion.setFromUnitVectors(EVY,new THREE.Vector3(dir[0],dir[1],dir[2]).normalize());g.add(m);return m}
function evBall(g,pos,r,col,glow){const m=new THREE.Mesh(new THREE.SphereGeometry(r,14,10),evMat(col,glow));m.position.set(pos[0],pos[1],pos[2]);g.add(m);return m}
function evFlower(g,pos,size,col,col2,mid){size*=.75;const f=new THREE.Group();f.position.set(pos[0],pos[1],pos[2]);for(let k=0;k<6;k++){const a=k/6*Math.PI*2;evLeaf(f,[0,0,0],[Math.cos(a),.35,Math.sin(a)],size,size*.42,col,col2,.1,false,0)}evBall(f,[0,.02,0],size*.2,mid||'#ffd23c',.3);g.add(f);return f}
function evRing(g,pos,r,col,arc,rot){const m=new THREE.Mesh(new THREE.TorusGeometry(r,.014,8,40,arc||Math.PI*2),new THREE.MeshBasicMaterial({color:new THREE.Color(col)}));m.position.set(pos[0],pos[1],pos[2]);if(rot)m.rotation.set(rot[0],rot[1],rot[2]);g.add(m);return m}
// cada forma: recebe (g, hc) com g no espaço do modelo (corpo ~1 de comprimento, costas em y~.5)
const EVCROWN=(c1,c2)=>(g,h)=>{};const EVCROWN_OLD=(c1,c2)=>(g,h)=>{evRing(g,[h[0],h[1]+.2,h[2]-.04],.15,c1,Math.PI*2,[Math.PI/2.4,0,0]);evRing(g,[h[0],h[1]+.2,h[2]-.04],.11,c2,Math.PI*2,[Math.PI/2.4,0,0]);for(let k=0;k<5;k++){const a=k*1.26;evBall(g,[h[0]+Math.sin(a)*.15,h[1]+.2+Math.cos(a)*.03,h[2]-.04+Math.cos(a)*.15],.018,c2,1)}};
const EVOX={
 1:EVCROWN('#7fd8ff','#ffffff'),2:EVCROWN('#ff5a1a','#ffe08a'),12:EVCROWN('#9fd8ff','#ffffff'),3:EVCROWN('#d8c8ff','#ffffff'),5:EVCROWN('#ff7ac0','#ffe0f0'),7:EVCROWN('#ffd21c','#fff7b0'),9:EVCROWN('#ffd870','#ffffff'),15:EVCROWN('#ff9ab8','#ffe0a0'),17:EVCROWN('#ff9ad4','#fff0fa'),18:EVCROWN('#a060ff','#d8ff60'),19:EVCROWN('#ffd23c','#fff7d0'),
 0:EVCROWN('#9a6a44','#d8ffa0'),
 4:g=>{for(const s of[-1,1]){const f=evFan(s,[s*.1,.44,.08],8,.58,.14,5,95,'#3a1f78','#b060ff',.22);g.add(f);(g.userData.w=g.userData.w||[]).push({g:f,s})}},
 6:EVCROWN('#7fd0ff','#ffffff'),
 8:g=>{for(let k=0;k<7;k++){const s=k%2?1:-1;evCone(g,[s*.12,.52,.3-k*.11],[s*.5,1,-.3],.07,.2+(k%3)*.05,'#ff6a1a',.9,6)}for(const s of[-1,1])evCone(g,[s*.14,.4,.38],[s*.8,.9,.4],.05,.2,'#ff8a2a',.9,6)},
 10:(g,h)=>{for(const s of[-1,1])for(let k=0;k<4;k++)evLeaf(g,[h[0]+s*.07,h[1]+.17,h[2]-.04],[s*(.5+k*.2),1,-.15-k*.1],.2,.06,'#4a9a2e','#b4ee70',.1,false,k);evRing(g,[h[0],h[1]+.1,h[2]-.1],.17,'#d8f090',Math.PI*2,[0,0,0])},
 11:g=>{for(const s of[-1,1]){const f=evFan(s,[s*.1,.46,.06],8,.68,.15,5,100,'#7a1418','#e04a28',.2);g.add(f);(g.userData.w=g.userData.w||[]).push({g:f,s})}},
 13:EVCROWN('#8a8478','#b8e070'),
 14:g=>{for(let k=0;k<10;k++){const a=k/10*Math.PI*2;evLeaf(g,[Math.cos(a)*.25,.15+(k%3)*.1,Math.sin(a)*.4],[Math.cos(a)*.6,.8,Math.sin(a)*.6],.34,.06,'#6a22c0','#d090ff',.2,false,k)}},
 16:g=>{for(const s of[-1,1]){const f=evFan(s,[s*.1,.4,.06],10,.62,.15,0,95,'#ff5a14','#ffd64a',.2);g.add(f);(g.userData.w=g.userData.w||[]).push({g:f,s})}for(let k=0;k<5;k++)evLeaf(g,[0,.2,-.2],[(k-2)*.3,.2,-1],.5,.1,'#ff5a14','#ffd64a',.15,true)},
};
function makeEvo(i){const C=V.C;if(!C||!C.obj||!EVOX[i]||(C.m&&C.m.evoM))return;const m=C.m||{};let h=m.hc||m.HC||[0,.3,.35];const g=new THREE.Group();g.userData.keep=1;
  // altura real das costas no centro do corpo: as peças nascem ali
  C.obj.updateMatrixWorld(true);const rc=new THREE.Raycaster();let ys=[];for(const z of[.12,0,-.12]){const o=C.obj.localToWorld(new THREE.Vector3(0,3,z));rc.set(o,new THREE.Vector3(0,-1,0));const hh=rc.intersectObject(C.obj,true)[0];if(hh)ys.push(C.obj.worldToLocal(hh.point.clone()).y)}
  const T=ys.length?ys.reduce((a,b)=>a+b)/ys.length:.45,dy=Math.max(-.2,Math.min(.2,T-.5));g.position.y=dy;h=[h[0],h[1]-dy,h[2]];
  EVOX[i](g,h);g.traverse(o=>{o.userData.keep=1;o.castShadow=false});C.obj.add(g);V.evoG=g;V.evoW=g.userData.w||null;
  if(!V.evoK){V.evoK=1;V.size={xz:V.size.xz*(g.userData.w?1.35:1.1),y:V.size.y*1.1};if(V.open)fit()}}
const PROC={};
function openFox(i,pop){
  setDet(i);
  if(!initViewer())return false;
  if(V.C&&V.C.root)V.spin.remove(V.C.root);if(V.T){V.spin.remove(V.T.root);V.T=null}
  const C=PROC[i](careStage(i)>0);
  V.mode='creature';V.chibi=true;V.C=C;V.sp={h:.24,tl:'',bird:0};
  C.gs=gsOf(i,careStage(i));C.root.scale.setScalar(C.gs);
  setFloor(i);castAll(C.root);
  C.baseY=-1-C.feet*C.gs;C.backY=-1+.62*C.gs;C.root.position.y=C.baseY;V.abre=(V.abre||0)+1;tiraModelos();C.root.userData.modelo=1;V.spin.add(C.root);
  if(!FOXSZ[i])FOXSZ[i]=foxSize(i);V.size={xz:FOXSZ[i].xz,y:FOXSZ[i].y};
  Object.assign(V,{ry:-.5,rx:.1,vy:0,st:'idle',until:0,taps:[],t0:performance.now(),blinkAt:1.5,blinkTo:0,wag:0,side:1,pop:pop?performance.now():0,
    S:{lid:0,ear:0,tailX:0,wagA:.2,wagS:5,tongue:0,hx:0,hy:0,hz:0,crouch:0,roll:0,paddle:0,scratch:0,shake:0,brow:0,flap:0}});
  killAura();if(careStage(i))makeAura(i);
  return true}

// interface pequena para os módulos em arquivos separados (js/missoes.js); nada de conteúdo aqui
window.GARRO={
  online:()=>ONL&&!DEV,sb:()=>sb,sync:(a,x)=>syncEstado(a,x),
  coins:()=>coins,setCoins:n=>{coins=n;hud()},addCoinsLocal:n=>{coins+=n;bonus+=n;saveBonus();hud()},
  ac:()=>{audio();return ac},coll:()=>coll,lvOf:i=>lvOf(i),CH0,banner:(t,s,w)=>banner(t,s,w),fanfare:()=>fanfare(),click:f=>{audio();click(f||600)},
  // usados pela Aventura (js/aventura.js)
  modelo:(i,evo)=>montaModelo(i,evo),THREE:()=>window.THREE,
  copias:i=>({n:coll[i]||0,g:i<CH0?GCOLL[i]||0:0,gevo:!!GEVO[i]}),escolheCopia:(i,t,f)=>escolheCopia(i,t,f),
  name:i=>PLUSH[i].name,evName:i=>evName(i,1),sprite:(i,lv,giant,rb)=>bSrc({i,lv,rb:rb|0,giant:giant?1:0}),EVO_LV,
  xpLocal:(i,n)=>gainXp(i,n),xpSet:(i,x)=>{careOf(i).xp=x;saveCare()},xpTotal,lvFromXp,xp:i=>careOf(i).xp,xpBar:i=>({pct:xpPct(i),txt:lvOf(i)>=capOf(i)?'Nível máximo':'Nv '+lvOf(i)+' · '+xpTxt(i)}),
  stoneLocal:k=>{INV.st[k]=(INV.st[k]||0)+1;saveInv()},stone:k=>STONES[k],
  tone:(f,d,t,v)=>{audio();tone(f,d,t,v)},evento:(k,n)=>evento(k,n),hint:t=>{$('hint').textContent=t},
  // usados pelos Lendários (js/lendarios.js)
  LEG0,fora:i=>FORA.has(i),isLeg:i=>isLeg(i),isDrag:i=>isDrag(i),tamForma:i=>isDrag(i)?(DRESC[formaDoDrag(i)]||1):1,atualizaDragoes:()=>atualizaDragoes(),grande:i=>grande(i),dev:()=>DEV,plush:i=>PLUSH[i],stats:i=>statsAt(i,lvOf(i),rbOf(i)),rbOf:i=>rbOf(i),isEvo,REB_B,
  abrir:i=>openViewer(i),estante:()=>renderShelf(),collAdd:(i,n)=>{coll[i]=(coll[i]||0)+(n||1);saveX();renderShelf()},collSet:(i,n)=>{coll[i]=n;saveX()},
  hud:()=>hud(),maquina:()=>MACH,
  glb:f=>loadGLB({file:f}).then(g=>g.clone(true))
};
window.dispatchEvent(new Event('garro:pronto'));setTimeout(aquecerModelos,6000);
renderShelf();hud();
/* ---------- entrada: só depois de todas as partes carregadas (antes ficava na parte 1 e chamava hud() cedo demais) ---------- */
sb.auth.onAuthStateChange((event,s)=>{
  if(s)iniciarAposLogin();
});

$('btnGoogleLogin').addEventListener('click',entrarComGoogle);
$('btnRetryLogin').addEventListener('click',()=>showAuthState('Default'));

(async()=>{
  const {data:{session:s}}=await sb.auth.getSession();
  if(s)await iniciarAposLogin();
})();
/* admin (DEV): já começa com um bichinho de cada, só na memória do jogo (não vai para o servidor) */
function devTudo(){if(!DEV)return;for(const p of PLUSH)if(p&&!p.fora&&!(coll[p.i]>0))coll[p.i]=1;// (os redondos antigos aposentados não entram)
 try{renderShelf();hud()}catch(e){}}
setTimeout(devTudo,150);
