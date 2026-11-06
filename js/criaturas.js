/* GARRO — criaturas da Aventura (inimigos básicos e evoluídos de cada mundo), modeladas em 3D aqui mesmo com formas simples.
   Referência: a arte "GARRO — Inimigos por ambiente" (ícones em img/criaturas/<slug>.webp). Dados (nome, mundo, força) em data/aventura.json → criaturas.
   GARRO_CRIATURAS.modelo(slug) devolve um THREE.Group com 1 de altura (ou 1,7 de comprimento, se for baixinha), apoiado em y=0 e olhando para +z (igual aos modelos dos bichinhos).
   Os chefões continuam sendo bichinhos do jogo (um do elemento do mundo). */
(function(){
const T=()=>window.THREE;
function M(cor,o){o=o||{};const m=new (T().MeshStandardMaterial)({color:cor,roughness:o.r??.75,metalness:o.m??0,flatShading:o.flat!==false,emissive:o.em||0x000000,emissiveIntensity:o.ei??1,transparent:o.op!=null,opacity:o.op??1,side:o.dupla?T().DoubleSide:T().FrontSide});if(o.op!=null)m.depthWrite=o.op>.8;m.color.convertSRGBToLinear();m.emissive.convertSRGBToLinear();return m}// cores pensadas em sRGB (o jogo desenha com saída sRGB)
function P(g,geo,mat,pos,rot,esc){const m=new (T().Mesh)(geo,mat);if(pos)m.position.set(...pos);if(rot)m.rotation.set(...rot);if(esc)(typeof esc==='number'?m.scale.setScalar(esc):m.scale.set(...esc));g.add(m);return m}
const V=(x,y,z)=>new (T().Vector3)(x,y,z);
function tubo(g,pts,r,mat,seg,rf){const c=new (T().CatmullRomCurve3)(pts.map(p=>V(...p))),geo=new (T().TubeGeometry)(c,seg||16,r,6,false);
  if(rf){const p=geo.attributes.position,n=(seg||16)+1;for(let i=0;i<n;i++){const k=1-rf*(i/(n-1)),cc=c.getPoint(i/(n-1));for(let j=0;j<7;j++){const q=i*7+j;p.setXYZ(q,cc.x+(p.getX(q)-cc.x)*k,cc.y+(p.getY(q)-cc.y)*k,cc.z+(p.getZ(q)-cc.z)*k)}}p.needsUpdate=true;geo.computeVertexNormals()}
  return P(g,geo,mat)}
function olhos(g,x,y,z,d,r,cor,pup){const e=M(cor,{em:cor,ei:1.4,flat:false}),pp=M(pup??0x1a0a00,{flat:false});
  for(const s of[-1,1]){P(g,new (T().SphereGeometry)(r,12,10),e,[s*x,y,z]);if(pup!==null)P(g,new (T().SphereGeometry)(r*.45,8,8),pp,[s*x,y,z+r*.75])}}
// espinhos espalhados numa esfera (só na parte de cima/frente)
function espinhos(g,cx,cy,cz,R,n,h,r,mat,ymin){const ga=Math.PI*(3-Math.sqrt(5));for(let k=0;k<n;k++){const y=1-(k+.5)/n*2,rr=Math.sqrt(1-y*y),t=ga*k,v=V(Math.cos(t)*rr,y,Math.sin(t)*rr);if(v.y<(ymin??-.2))continue;
  const c=P(g,new (T().ConeGeometry)(r,h,5),mat,[cx+v.x*R,cy+v.y*R,cz+v.z*R]);c.quaternion.setFromUnitVectors(V(0,1,0),v)}}
function patas(g,lista,r,mat){for(const pts of lista)tubo(g,pts,r,mat,10,.55)}
function normaliza(g){g.updateMatrixWorld(true);const b=new (T().Box3)().setFromObject(g),h=Math.max(b.max.y-b.min.y,(b.max.x-b.min.x)*.6,(b.max.z-b.min.z)*.6)||1,o=new (T().Group)();g.scale.setScalar(1/h);g.position.set(-(b.min.x+b.max.x)/2/h,-b.min.y/h,-(b.min.z+b.max.z)/2/h);o.add(g);return o}

const F={
// ---- Floresta ----
broquim(g){const casca=M(0x7a5532),musgo=M(0x4a7a22),esp=M(0xc8642a),perna=M(0x5a4a26);
  P(g,new (T().IcosahedronGeometry)(.5,1),casca,[0,.62,0]);P(g,new (T().SphereGeometry)(.5,12,8,0,Math.PI*2,0,1.1),musgo,[0,.66,-.02],null,[1.04,1,1.04]);
  espinhos(g,0,.62,0,.46,30,.3,.065,esp,-.15);olhos(g,.17,.66,.42,0,.085,0xffb020);
  P(g,new (T().BoxGeometry)(.34,.04,.04),M(0x2a1a08),[0,.52,.47],[0,0,0]);
  patas(g,[[[.3,.4,.15],[.62,.42,.3],[.75,0,.42]],[[-.3,.4,.15],[-.62,.42,.3],[-.75,0,.42]],[[.3,.38,-.15],[.65,.4,-.3],[.72,0,-.45]],[[-.3,.38,-.15],[-.65,.4,-.3],[-.72,0,-.45]]],.045,perna)},
ciporgo(g){const tronco=M(0x7a5a34),folha=M(0x5aa83a),boca=M(0xb8302a),dente=M(0xf4ecd0);
  tubo(g,[[0,.35,0],[.03,.7,0],[-.02,1.05,.02],[0,1.3,0]],.17,tronco,12,.4);P(g,new (T().SphereGeometry)(.2,10,8),tronco,[0,1.32,.02],null,[1,1.15,.9]);
  olhos(g,.08,1.36,.17,0,.04,0xffd23a);for(let k=0;k<7;k++){const a=k/7*Math.PI*2;P(g,new (T().ConeGeometry)(.06,.3,4),folha,[Math.cos(a)*.1,1.5,Math.sin(a)*.1],[Math.sin(a)*.5,0,-Math.cos(a)*.5])}
  for(const s of[-1,1]){tubo(g,[[0,.4,0],[s*.12,.2,.05],[s*.3,0,.15]],.06,tronco,8,.6);tubo(g,[[0,.4,0],[s*.08,.2,-.12],[s*.18,0,-.3]],.05,tronco,8,.6);
    tubo(g,[[s*.08,1.05,0],[s*.35,1.15,.05],[s*.55,1.0,.12]],.055,tronco,10,.3);
    const cab=new (T().Group)();cab.position.set(s*.62,.98,.15);g.add(cab);
    P(cab,new (T().SphereGeometry)(.17,10,6,0,Math.PI*2,0,Math.PI/2),boca,[0,.01,0],[.5,0,0]);P(cab,new (T().SphereGeometry)(.17,10,6,0,Math.PI*2,0,Math.PI/2),boca,[0,-.01,0],[Math.PI-.5,0,0]);
    for(let k=0;k<6;k++){const a=-1.2+k*.48;P(cab,new (T().ConeGeometry)(.02,.08,3),dente,[Math.sin(a)*.15,0,Math.cos(a)*.15+.02],[Math.PI,0,0])}
    for(let k=0;k<3;k++)P(g,new (T().ConeGeometry)(.05,.18,4),folha,[s*(.2+k*.12),1.13-k*.03,.04],[0,0,s*1.2])}},
// ---- Caverna ----
grutim(g){const casco=M(0x8a8a90),escuro=M(0x5a5a62),ponta=M(0x66c8ff,{em:0x2a9cff});
  for(let k=0;k<6;k++){const z=.38-k*.15,r=.3-Math.abs(k-2)*.025;P(g,new (T().SphereGeometry)(r,12,8,0,Math.PI*2,0,Math.PI/2),k%2?escuro:casco,[0,.12,z],null,[1.15,.95,.55])}
  P(g,new (T().SphereGeometry)(.12,10,8),escuro,[0,.16,.5]);olhos(g,.06,.2,.6,0,.03,0x111111,null);
  for(const s of[-1,1]){tubo(g,[[s*.05,.2,.6],[s*.2,.38,.76],[s*.36,.32,.94]],.01,escuro,10);P(g,new (T().SphereGeometry)(.03,8,6),ponta,[s*.36,.32,.94])
    for(let k=0;k<4;k++){const z=.35-k*.2;tubo(g,[[s*.25,.15,z],[s*.42,.2,z+.05],[s*.48,0,z+.08]],.022,escuro,6,.6)}}},
grutar(g){const pedra=M(0x55555f),esc=M(0x3a3a44),brilho=M(0x5ab8ff,{em:0x3a9cff,ei:1.6}),osso=M(0xe8dcc0);
  for(let k=0;k<6;k++){const z=.5-k*.2;P(g,new (T().DodecahedronGeometry)(.3-Math.abs(k-2)*.03,0),k%2?esc:pedra,[0,.38,z],null,[1.25,.7,.75]);
    for(const s of[-1,0,1])P(g,new (T().ConeGeometry)(.06,.26,4),pedra,[s*.18,.62,z],[-.4,0,s*.5]);P(g,new (T().BoxGeometry)(.5,.02,.04),brilho,[0,.36,z+.09])}
  P(g,new (T().DodecahedronGeometry)(.2,0),esc,[0,.36,.75]);olhos(g,.1,.42,.9,0,.035,0x7ad0ff,null);
  for(const s of[-1,1]){tubo(g,[[s*.1,.3,.85],[s*.25,.22,1.0],[s*.12,.15,1.12]],.035,osso,10,.8);
    tubo(g,[[s*.08,.5,.8],[s*.25,.85,.9],[s*.45,.95,.7],[s*.4,.8,.55]],.012,brilho,14);P(g,new (T().SphereGeometry)(.035,8,6),brilho,[s*.4,.8,.55]);
    for(let k=0;k<4;k++){const z=.5-k*.25;tubo(g,[[s*.3,.32,z],[s*.6,.42,z+.05],[s*.72,0,z+.1]],.035,esc,6,.75)}}},
// ---- Luz ----
lumisco(g){const ouro=M(0xf2c040,{m:.5,r:.35,em:0x6a4a00}),branco=M(0xfff8e0,{flat:false}),pup=M(0x2a1800,{flat:false}),claro=M(0xfff0a0,{em:0xffc040,m:.4,r:.3});
  P(g,new (T().OctahedronGeometry)(.42,0),ouro,[0,.7,0],null,[.9,1.25,.7]);P(g,new (T().SphereGeometry)(.12,14,10),branco,[0,.72,.26],null,[1.2,.8,.6]);P(g,new (T().SphereGeometry)(.055,10,8),pup,[0,.72,.33]);
  for(let k=0;k<4;k++){const a=k/4*Math.PI*2+.4;P(g,new (T().OctahedronGeometry)(.07,0),claro,[Math.cos(a)*.62,.7+Math.sin(a*2)*.25,Math.sin(a)*.3],null,[.6,1.4,.6])}
  P(g,new (T().OctahedronGeometry)(.01,0),claro,[0,0,0])},
prismar(g){const ouro=M(0xf0c850,{m:.5,r:.35,em:0x5a3a00}),claro=M(0xfff2b0,{em:0xffd060,m:.4,r:.3}),branco=M(0xfff8e0,{flat:false}),pup=M(0x2a1800,{flat:false});
  P(g,new (T().OctahedronGeometry)(.3,0),ouro,[0,.95,0],null,[1.1,1.1,.8]);P(g,new (T().ConeGeometry)(.12,.4,4),ouro,[0,1.32,0]);P(g,new (T().ConeGeometry)(.1,.35,4),claro,[0,.6,0],[Math.PI,0,0]);
  P(g,new (T().SphereGeometry)(.08,12,8),branco,[0,.97,.22],null,[1.3,.8,.6]);P(g,new (T().SphereGeometry)(.04,8,6),pup,[0,.97,.27]);
  for(const s of[-1,1]){P(g,new (T().ConeGeometry)(.07,.5,4),ouro,[s*.35,1.12,0],[0,0,-s*1.1]);
    for(const dz of[-.12,.12]){P(g,new (T().ConeGeometry)(.07,.42,4),ouro,[s*.4,.78,dz],[dz,0,-s*.6]);P(g,new (T().ConeGeometry)(.07,.6,4),claro,[s*.6,.32,dz*1.6],[Math.PI,0,s*.25])}}
  for(let k=0;k<5;k++){const a=k/5*Math.PI*2;P(g,new (T().OctahedronGeometry)(.05,0),claro,[Math.cos(a)*.8,1.0+Math.sin(a*3)*.2,Math.sin(a)*.35],null,[.6,1.4,.6])}},
// ---- Fogo ----
fagulho(g){const rocha=M(0x5a3a2a),lava=M(0xff7a20,{em:0xff5a00,ei:1.5});
  const corpo=P(g,new (T().DodecahedronGeometry)(.42,1),rocha,[0,.72,0]);
  for(let k=0;k<14;k++){const a=k*2.4,y=Math.sin(k*1.7)*.3;P(g,new (T().BoxGeometry)(.16,.02,.02),lava,[Math.cos(a)*.4*Math.sqrt(1-y*y),.72+y*.4,Math.sin(a)*.4*Math.sqrt(1-y*y)],[0,-a,Math.sin(k)*.8])}
  olhos(g,.14,.8,.36,0,.07,0xffb020,null);P(g,new (T().BoxGeometry)(.2,.05,.05),lava,[0,.62,.4]);
  for(const s of[-1,1]){P(g,new (T().DodecahedronGeometry)(.13,0),rocha,[s*.52,.62,.05]);P(g,new (T().DodecahedronGeometry)(.12,0),rocha,[s*.6,.42,.1]);
    P(g,new (T().BoxGeometry)(.17,.3,.17),rocha,[s*.18,.18,0]);P(g,new (T().BoxGeometry)(.2,.08,.24),rocha,[s*.18,.04,.03])}
  for(let k=0;k<3;k++)P(g,new (T().OctahedronGeometry)(.05,0),lava,[(k-1)*.3,1.25+k%2*.08,0])},
brasgor(g){const rocha=M(0x4a3228),lava=M(0xff8a2a,{em:0xff5a00,ei:1.6});
  P(g,new (T().BoxGeometry)(.62,.55,.42),rocha,[0,.85,0]);P(g,new (T().BoxGeometry)(.5,.08,.05),lava,[0,.75,.22]);
  for(let k=0;k<4;k++)P(g,new (T().BoxGeometry)(.05,.22,.04),lava,[-.15+k*.1,.82,.215]);
  P(g,new (T().DodecahedronGeometry)(.2,0),rocha,[0,1.25,.04]);olhos(g,.08,1.28,.19,0,.035,0xffc030,null);
  for(let k=0;k<4;k++)P(g,new (T().ConeGeometry)(.05,.16,4),rocha,[-.15+k*.1,1.44,0]);
  for(const s of[-1,1]){P(g,new (T().DodecahedronGeometry)(.17,0),rocha,[s*.42,1.0,0]);P(g,new (T().BoxGeometry)(.18,.35,.18),rocha,[s*.48,.7,.04]);
    P(g,new (T().DodecahedronGeometry)(.2,0),rocha,[s*.52,.4,.1]);for(let k=0;k<5;k++)P(g,new (T().BoxGeometry)(.12,.02,.02),lava,[s*.52+Math.cos(k)*.12,.4+Math.sin(k*2)*.15,.1+Math.sin(k)*.12],[0,k,k])
    P(g,new (T().BoxGeometry)(.22,.45,.22),rocha,[s*.17,.24,0]);P(g,new (T().BoxGeometry)(.04,.3,.02),lava,[s*.17,.24,.115])}},
// ---- Água ----
bolhim(g){const gel=M(0x5ae0e0,{op:.72,flat:false,r:.2,em:0x0a5a6a}),ten=M(0x7ae8d8,{op:.8,flat:false,r:.3,em:0x0a4a4a});
  P(g,new (T().SphereGeometry)(.42,20,12,0,Math.PI*2,0,Math.PI/2),gel,[0,.75,0],null,[1,1.05,1]);P(g,new (T().CircleGeometry)(.42,20),gel,[0,.75,0],[Math.PI/2,0,0]);
  olhos(g,.13,.93,.34,0,.055,0xffffff,0x10202a);P(g,new (T().BoxGeometry)(.12,.025,.02),M(0x10303a),[-.13,1.0,.37],[0,0,-.4]);P(g,new (T().BoxGeometry)(.12,.025,.02),M(0x10303a),[.13,1.0,.37],[0,0,.4]);
  for(let k=0;k<6;k++){const a=k/6*Math.PI*2,x=Math.cos(a)*.24,z=Math.sin(a)*.24;tubo(g,[[x,.72,z],[x*1.2,.45,z*1.2+.05],[x*.9,.2,z*.9],[x*1.25,0,z*1.25]],.035,ten,14,.75)}},
urtigor(g){const gel=M(0x4ab8e8,{op:.78,flat:false,r:.2,em:0x1a3a8a}),ten=M(0x5ac0e0,{flat:false,r:.4,em:0x1a3a7a}),esp=M(0xd8f0ff,{em:0x6ab0ff}),boca=M(0x1a1030),dente=M(0xf4f0e8);
  P(g,new (T().SphereGeometry)(.48,22,12,0,Math.PI*2,0,Math.PI/2),gel,[0,.82,0]);P(g,new (T().CircleGeometry)(.48,22),gel,[0,.82,0],[Math.PI/2,0,0]);
  espinhos(g,0,.82,0,.47,30,.14,.03,esp,.15);olhos(g,.15,.98,.4,0,.05,0xcfe8ff,0x101830);
  P(g,new (T().SphereGeometry)(.15,12,8),boca,[0,.8,.36],null,[1.2,.6,.4]);for(let k=0;k<7;k++)P(g,new (T().ConeGeometry)(.016,.06,3),dente,[-.15+k*.05,.86,.42],[Math.PI,0,0]);
  for(let k=0;k<8;k++){const a=k/8*Math.PI*2,x=Math.cos(a)*.3,z=Math.sin(a)*.3;tubo(g,[[x,.8,z],[x*1.6,.55,z*1.6],[x*1.9,.25,z*1.9],[x*1.5,.05,z*1.5],[x*1.25,.15,z*1.25]],.045,ten,18,.8)}},
// ---- Trevas ----
trapim(g){const pano=M(0x8a6a44,{flat:false}),rem=M(0x6a5a3a,{flat:false}),olho=0xb060ff,boca=M(0x1a0a18),corda=M(0x5a4628);
  const pts=[];for(let k=0;k<=12;k++){const t=k/12,r=t<.75?.32+Math.sin(t*Math.PI/.75)*.06-t*.05:.13-(t-.75)*.25;pts.push(new (T().Vector2)(Math.max(.02,r),t*1.05))}
  const s=P(g,new (T().LatheGeometry)(pts,16),pano,[0,.12,0]);const p=s.geometry.attributes.position;for(let q=0;q<p.count;q++){if(p.getY(q)<.08)p.setY(q,p.getY(q)-.06*Math.abs(Math.sin(q*2.3)))}s.geometry.computeVertexNormals();
  P(g,new (T().TorusGeometry)(.12,.025,6,12),corda,[0,1.0,0],[Math.PI/2,0,0]);for(let k=0;k<4;k++){const a=k/4*Math.PI*2;P(g,new (T().ConeGeometry)(.05,.18,4),pano,[Math.cos(a)*.08,1.12,Math.sin(a)*.08],[Math.sin(a)*.6,0,-Math.cos(a)*.6])}
  P(g,new (T().BoxGeometry)(.14,.12,.02),rem,[.12,.45,.33],[0,.3,.2]);olhos(g,.1,.62,.33,0,.05,olho,null);
  P(g,new (T().BoxGeometry)(.24,.05,.03),boca,[0,.45,.36]);for(let k=0;k<4;k++)P(g,new (T().ConeGeometry)(.018,.05,3),M(0xe8dcc0),[-.08+k*.055,.47,.375],[Math.PI,0,0]);
  for(const sx of[-1,1]){tubo(g,[[sx*.3,.55,0],[sx*.48,.5,.08],[sx*.55,.35,.15]],.025,corda,8,.4);for(const d of[-1,0,1])tubo(g,[[sx*.55,.35,.15],[sx*(.6+d*.03),.28,.2+d*.04]],.01,corda,4)}},
farrapo(g){const pano=M(0x6a5a46,{flat:false,dupla:true}),escuro=M(0x15101a,{flat:false}),olho=0xb060ff;
  const c=P(g,new (T().ConeGeometry)(.4,1.15,18,6,true),pano,[0,.6,0]);const p=c.geometry.attributes.position;
  for(let q=0;q<p.count;q++){const y=p.getY(q);if(y<-.45){p.setY(q,y-.12*Math.abs(Math.sin(q*1.9)));p.setX(q,p.getX(q)*(1+.15*Math.sin(q*3.1)))}}c.geometry.computeVertexNormals();
  P(g,new (T().SphereGeometry)(.2,14,10,0,Math.PI*2,0,Math.PI*.7),pano,[0,1.15,0],[-.25,0,0]);P(g,new (T().SphereGeometry)(.15,10,8),escuro,[0,1.1,.06]);
  P(g,new (T().ConeGeometry)(.08,.25,6),pano,[0,1.38,-.08],[-.6,0,0]);olhos(g,.055,1.12,.18,0,.03,olho,null);
  for(const s of[-1,1]){const b=P(g,new (T().ConeGeometry)(.12,.6,8,3,true),pano,[s*.38,.85,.05],[0,0,s*1.2]);
    for(let k=0;k<4;k++)tubo(g,[[s*.62,.72,.08],[s*(.72+k*.02),.6-k*.04,.12+k*.03],[s*(.78+k*.03),.5-k*.06,.15+k*.04]],.012,escuro,6,.5)}}
};
// junta as peças de mesmo material numa malha só (menos chamadas de desenho: o celular agradece)
function junta(g){g.updateMatrixWorld(true);const por=new Map();g.traverse(o=>{if(o.isMesh){if(!por.has(o.material))por.set(o.material,[]);por.get(o.material).push(o)}});
  const out=new (T().Group)();for(const [mat,ms] of por){const P_=[],N_=[];for(const m of ms){let geo=m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone();geo.applyMatrix4(m.matrixWorld);
      if(!geo.attributes.normal)geo.computeVertexNormals();P_.push(geo.attributes.position.array);N_.push(geo.attributes.normal.array)}
    const tot=P_.reduce((a,b)=>a+b.length,0),pa=new Float32Array(tot),na=new Float32Array(tot);let o=0;for(let k=0;k<P_.length;k++){pa.set(P_[k],o);na.set(N_[k],o);o+=P_[k].length}
    const geo=new (T().BufferGeometry)();geo.setAttribute('position',new (T().BufferAttribute)(pa,3));geo.setAttribute('normal',new (T().BufferAttribute)(na,3));geo.computeBoundingSphere();out.add(new (T().Mesh)(geo,mat))}
  return out}
function modelo(slug){const f=F[slug];if(!f||!T())return null;const g=new (T().Group)();f(g);return normaliza(junta(g))}
window.GARRO_CRIATURAS={modelo,tem:slug=>!!F[slug],lista:Object.keys(F)};
})();
