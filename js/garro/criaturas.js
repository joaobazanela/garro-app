/* GARRO — criaturas 3D com reações de cachorro e superfícies esculpidas. Parte 4 de 8 do antigo js/garro.js: os arquivos são carregados em ordem (js/garro/*.js) e dividem o mesmo escopo global. */
/* ---------- 3D creatures with dog-like reactions ---------- */
// b body, c belly, a accent, e eye, size [halfWidth, halfHeight, halfLength], h head radius, sn snout, ea ears, lg leg length, tl tail, x extras
const SPEC=GD.modelos.SPEC;
const V={open:false};
let FUR=null;const MATS=GD.modelos.MATS;let SPH=null;
function furTex(){if(FUR)return FUR;const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');x.fillStyle='#ececec';x.fillRect(0,0,256,256);
  for(let i=0;i<7000;i++){const g=175+Math.random()*80|0;x.strokeStyle='rgba('+g+','+g+','+g+',.6)';const px=Math.random()*256,py=Math.random()*256,a=Math.random()*6.28,l=2+Math.random()*5;x.beginPath();x.moveTo(px,py);x.lineTo(px+Math.cos(a)*l,py+Math.sin(a)*l);x.stroke()}
  FUR=new THREE.CanvasTexture(c);FUR.wrapS=FUR.wrapT=THREE.RepeatWrapping;FUR.repeat.set(2.5,2.5);return FUR}
function M(col,o){o=o||{};const k=col+'|'+JSON.stringify(o);if(MATS[k])return MATS[k];
  const smooth=o.gloss||o.flat||o.glass||o.glow;
  const m=new THREE.MeshStandardMaterial({color:new THREE.Color(col).convertSRGBToLinear(),roughness:o.gloss?.12:o.glass?.2:1,metalness:o.metal||0,
    flatShading:!!o.flat,
    transparent:!!o.op,opacity:o.op||1,side:o.side?THREE.DoubleSide:THREE.FrontSide,depthWrite:!o.op});
  if(o.glow){m.emissive=new THREE.Color(col).convertSRGBToLinear();m.emissiveIntensity=o.glow}
  m.userData.fur=!smooth&&!o.op;
  if(!smooth&&!o.side)plushify(m);
  return MATS[k]=m}
const SHELLS=GD.modelos.SHELLS;const NSHELL=12;const FURTIME={value:0};
// strand fur: stacked shells; each strand lives in a 3D cell, thins toward the tip, droops and sways
function furMat(base,l,len,dens){const key=base.uuid+'|'+l+'|'+len+'|'+dens;if(SHELLS[key])return SHELLS[key];
  const t=l/NSHELL,m=new THREE.MeshStandardMaterial({color:base.color.clone(),vertexColors:!!base.vertexColors,map:base.map,roughness:1,metalness:0});
  m.onBeforeCompile=sh=>{sh.uniforms.uTime=FURTIME;
    sh.vertexShader='uniform float uTime;\nattribute float furK;\nvarying vec3 vFurP;\n'+sh.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\n vFurP=position;\n float fl='+t.toFixed(3)+';\n transformed+=normalize(objectNormal)*fl*furK*'+len.toFixed(4)+';\n transformed.y-=fl*fl*'+(len*.4).toFixed(4)+';\n transformed.x+=sin(uTime*1.6+position.y*7.+position.z*5.)*fl*fl*'+(len*.15).toFixed(4)+';');
    sh.fragmentShader='varying vec3 vFurP;\n'+sh.fragmentShader.replace('#include <map_fragment>',
      '#include <map_fragment>\n {vec3 q=vFurP*'+dens.toFixed(1)+';vec3 c=floor(q);vec3 f=fract(q)-.5;\n  float h=fract(sin(dot(c,vec3(12.9898,78.233,37.719)))*43758.5453);\n  if(h<'+(t*.92).toFixed(3)+'||length(f)>'+(.62-t*.42).toFixed(3)+')discard;\n  float h2=fract(sin(dot(c,vec3(39.346,11.135,83.155)))*24634.6345);\n  diffuseColor.rgb*='+(0.7+t*.42).toFixed(3)+'*vec3(1.07,1.,.9)*(1.+step(.84,h2)*'+(t*.35).toFixed(3)+');}')};
  m.customProgramCacheKey=()=>'fur'+l+'_'+len+'_'+dens+(base.map?'m':'')+(base.vertexColors?'v':'');
  return SHELLS[key]=m}
const noRay=()=>{};
function addFur(root,sp,C){const len0=(sp&&sp.fl)||.05,dens0=(sp&&sp.fd)||48,list=[],head=C&&C.head,legs=(C&&C.legs)||[],tail=C&&C.tail,bs=(sp&&sp.s)||[.5,.5,.8];
  root.traverse(o=>{if(o.isMesh&&(o.material===SDFMAT||o.material.userData.photo)&&!o.userData.shell)list.push(o)});
  for(const m of list){if(!m.userData.skinDark){m.material=m.material.clone();m.material.color.multiplyScalar(.8);m.material.userData=Object.assign({},m.material.userData,{photo:true});m.userData.skinDark=1}
    let cat='body';for(let u=m;u;u=u.parent){if(u===head){cat='head';break}if(u===tail){cat='tail';break}if(legs.includes(u)){cat='leg';break}}
    const len=len0,dens=cat==='head'?dens0*1.7:dens0,pa=m.geometry.attributes.position,K=new Float32Array(pa.count);
    for(let k=0;k<pa.count;k++){const y=pa.getY(k),z=pa.getZ(k);
      K[k]=cat==='head'?.3:cat==='tail'?1.45:cat==='leg'?(.45+.5*Math.min(1,Math.max(0,(y+.05)/.25))+.85*Math.exp(-(((y+(sp.lg||.4)*.72)/.07)**2))):(.8+.75*Math.min(1,Math.max(0,z/(bs[2]*.75)))*Math.min(1,Math.max(0,(bs[1]*.7-y)/bs[1])))}
    m.geometry.setAttribute('furK',new THREE.BufferAttribute(K,1));
    for(let l=1;l<=NSHELL;l++){const s=new THREE.Mesh(m.geometry,furMat(m.material,l,len,dens));s.userData.shell=1;s.raycast=noRay;m.add(s)}}}
function ell(col,sx,sy,sz,o){const m=new THREE.Mesh(SPH,M(col,o));m.scale.set(sx,sy,sz);return m}
function cone(col,r,h,o,seg){const g=new THREE.ConeGeometry(r,h,seg||14);g.translate(0,h/2,0);return new THREE.Mesh(g,M(col,o))}
function cyl(col,r0,r1,h,o){const g=new THREE.CylinderGeometry(r0,r1,h,12);g.translate(0,-h/2,0);return new THREE.Mesh(g,M(col,o))}
function P(o,x,y,z){o.position.set(x,y,z);return o}
function R(o,x,y,z){o.rotation.set(x||0,y||0,z||0);return o}
function grp(){return new THREE.Group()}
function wingShape(w,h,bat){const s=new THREE.Shape();s.moveTo(0,0);
  if(bat){s.quadraticCurveTo(w*.4,h*.9,w,h);s.lineTo(w*.85,h*.35);s.quadraticCurveTo(w*.7,h*.5,w*.62,h*.18);s.quadraticCurveTo(w*.45,h*.35,w*.38,h*.05);s.quadraticCurveTo(w*.2,h*.2,0,0)}
  else{s.bezierCurveTo(w*.3,h*1.1,w*1.05,h*1.05,w,h*.45);s.bezierCurveTo(w*.95,h*.05,w*.4,-h*.1,0,0)}
  return new THREE.ShapeGeometry(s,16)}

/* ---------- sculpted surfaces: smooth-union of ellipsoids meshed with surface nets ---------- */
const SDFCACHE={};let SDFMAT=null;
function sdfMat(){if(SDFMAT)return SDFMAT;SDFMAT=plushify(new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:1}));SDFMAT.userData.fur=true;return SDFMAT}
// real plush surface: fur / scale detail taken from the Sylvorn and Terranox models, triplanar so it has no seams
const DETU=GD.modelos.DETU,DETT={};
const SCALY=GD.modelos.SCALY;
function detTex(kind){if(DETT[kind])return DETT[kind];const f='models/tex/'+kind+'.jpg',src=GLBDATA[f]?'data:image/jpeg;base64,'+GLBDATA[f]:f;
  const t=new THREE.TextureLoader().load(src);t.wrapS=t.wrapT=THREE.RepeatWrapping;return DETT[kind]=t}
function setDet(i){const sc=SCALY.includes(i);DETU.uDet.value=detTex(sc?'scale':'fur');DETU.uDS.value=i>=20?2.6:sc?.9:1.15;DETU.uStr.value=i>=20?.2:sc?1.2:1.3}
function plushify(m){m.map=null;m.bumpMap=null;
  m.onBeforeCompile=sh=>{Object.assign(sh.uniforms,DETU);
    sh.vertexShader='varying vec3 vTP;\nvarying vec3 vON;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n vTP=position*vec3(length(modelMatrix[0].xyz),length(modelMatrix[1].xyz),length(modelMatrix[2].xyz));vON=normalize(normal);');
    sh.fragmentShader='uniform sampler2D uDet;uniform float uDS,uStr;\nvarying vec3 vTP;\nvarying vec3 vON;\n'+sh.fragmentShader
      .replace('#include <color_fragment>','#include <color_fragment>\n float gDet=.5;{vec3 bw=pow(abs(vON),vec3(4.));bw/=bw.x+bw.y+bw.z;vec3 p=vTP*uDS;gDet=texture2D(uDet,p.yz).r*bw.x+texture2D(uDet,p.xz+.37).r*bw.y+texture2D(uDet,p.xy+.71).r*bw.z;\n diffuseColor.rgb*=clamp(1.+(gDet*2.-1.)*uStr,.72,1.35);}')
      .replace('#include <normal_fragment_begin>','#include <normal_fragment_begin>\n {vec2 dh=vec2(dFdx(gDet),dFdy(gDet))*uStr*.3;vec3 sx=dFdx(-vViewPosition),sy=dFdy(-vViewPosition);vec3 r1=cross(sy,normal),r2=cross(normal,sx);float fd=dot(sx,r1);normal=normalize(abs(fd)*normal-sign(fd)*(dh.x*r1+dh.y*r2));}')};
  m.customProgramCacheKey=()=>'pl'+(m.vertexColors?'v':'');return m}
function vh(x,y,z){let h=(x*374761393+y*668265263+z*1274126177)|0;h=(h^(h>>>13))*1274126177|0;return((h^(h>>>16))>>>0)/4294967295}
function vnoise(x,y,z){const X=Math.floor(x),Y=Math.floor(y),Z=Math.floor(z),fx=x-X,fy=y-Y,fz=z-Z,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy),w=fz*fz*(3-2*fz);
  const L=(a,b,t)=>a+(b-a)*t;return L(L(L(vh(X,Y,Z),vh(X+1,Y,Z),u),L(vh(X,Y+1,Z),vh(X+1,Y+1,Z),u),v),L(L(vh(X,Y,Z+1),vh(X+1,Y,Z+1),u),L(vh(X,Y+1,Z+1),vh(X+1,Y+1,Z+1),u),v),w)}
function sdfMesh(prims,k,step,noise){
  step=step||.035;const key=JSON.stringify(prims)+k+step+'|'+(noise||0);let geo=SDFCACHE[key];
  if(!geo){
    const P=prims.map(p=>({c:p.c,r:p.r,rx:p.rx||0,w:p.w||1,paint:!!p.paint,col:new THREE.Color(p.col).convertSRGBToLinear(),cos:Math.cos(-(p.rx||0)),sin:Math.sin(-(p.rx||0)),mr:Math.min(...p.r)}));
    const mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];
    for(const p of P.filter(q=>!q.paint))for(let a=0;a<3;a++){const e=(p.rx?Math.max(...p.r):p.r[a])+k*2.5;mn[a]=Math.min(mn[a],p.c[a]-e);mx[a]=Math.max(mx[a],p.c[a]+e)}
    const nx=Math.ceil((mx[0]-mn[0])/step)+2,ny=Math.ceil((mx[1]-mn[1])/step)+2,nz=Math.ceil((mx[2]-mn[2])/step)+2;
    const pd=(p,x,y,z)=>{let dx=x-p.c[0],dy=y-p.c[1],dz=z-p.c[2];if(p.rx){const ty=dy*p.cos-dz*p.sin,tz=dy*p.sin+dz*p.cos;dy=ty;dz=tz}
      const ax=dx/p.r[0],ay=dy/p.r[1],az=dz/p.r[2],k0=Math.sqrt(ax*ax+ay*ay+az*az),bx=ax/p.r[0],by=ay/p.r[1],bz=az/p.r[2],k1=Math.sqrt(bx*bx+by*by+bz*bz)||1e-6;return k0*(k0-1)/k1};
    const SH=P.filter(p=>!p.paint),NA=noise||0;const field=(x,y,z)=>{let s=0;for(const p of SH){const d=pd(p,x,y,z);if(d<k*12)s+=Math.exp(-d/k)}return (s>0?-k*Math.log(s):k*12)+(NA?NA*(vnoise(x*9,y*9,z*9)*.7+vnoise(x*23,y*23,z*23)*.3-.5):0)};
    const F=new Float32Array(nx*ny*nz),id=(i,j,l)=>i+nx*(j+ny*l);
    for(let l=0;l<nz;l++)for(let j=0;j<ny;j++)for(let i=0;i<nx;i++)F[id(i,j,l)]=field(mn[0]+i*step,mn[1]+j*step,mn[2]+l*step);
    const cell=new Int32Array(nx*ny*nz).fill(-1),pos=[];
    const v=new Float32Array(8);const E=[[0,1],[2,3],[4,5],[6,7],[0,2],[1,3],[4,6],[5,7],[0,4],[1,5],[2,6],[3,7]],O=[[0,0,0],[1,0,0],[0,1,0],[1,1,0],[0,0,1],[1,0,1],[0,1,1],[1,1,1]];
    for(let l=0;l<nz-1;l++)for(let j=0;j<ny-1;j++)for(let i=0;i<nx-1;i++){
      const b0=id(i,j,l),dyy=nx,dzz=nx*ny;
      v[0]=F[b0];v[1]=F[b0+1];v[2]=F[b0+dyy];v[3]=F[b0+dyy+1];v[4]=F[b0+dzz];v[5]=F[b0+dzz+1];v[6]=F[b0+dzz+dyy];v[7]=F[b0+dzz+dyy+1];
      let neg=0;for(let q=0;q<8;q++)if(v[q]<0)neg++;if(!neg||neg===8)continue;
      let sx=0,sy=0,sz=0,n=0;for(const [a,b] of E){if((v[a]<0)===(v[b]<0))continue;const t=v[a]/(v[a]-v[b]);
        sx+=O[a][0]+(O[b][0]-O[a][0])*t;sy+=O[a][1]+(O[b][1]-O[a][1])*t;sz+=O[a][2]+(O[b][2]-O[a][2])*t;n++}
      cell[id(i,j,l)]=pos.length/3;pos.push(mn[0]+(i+sx/n)*step,mn[1]+(j+sy/n)*step,mn[2]+(l+sz/n)*step)}
    const idx=[];
    const quad=(a,b,c,d,flip)=>{if(a<0||b<0||c<0||d<0)return;if(flip)idx.push(a,c,b,a,d,c);else idx.push(a,b,c,a,c,d)};
    for(let l=1;l<nz-1;l++)for(let j=1;j<ny-1;j++)for(let i=0;i<nx-1;i++){const f0=F[id(i,j,l)],f1=F[id(i+1,j,l)];if((f0<0)===(f1<0))continue;
      quad(cell[id(i,j-1,l-1)],cell[id(i,j,l-1)],cell[id(i,j,l)],cell[id(i,j-1,l)],f0>0)}
    for(let l=1;l<nz-1;l++)for(let j=0;j<ny-1;j++)for(let i=1;i<nx-1;i++){const f0=F[id(i,j,l)],f1=F[id(i,j+1,l)];if((f0<0)===(f1<0))continue;
      quad(cell[id(i-1,j,l-1)],cell[id(i-1,j,l)],cell[id(i,j,l)],cell[id(i,j,l-1)],f0>0)}
    for(let l=0;l<nz-1;l++)for(let j=1;j<ny-1;j++)for(let i=1;i<nx-1;i++){const f0=F[id(i,j,l)],f1=F[id(i,j,l+1)];if((f0<0)===(f1<0))continue;
      quad(cell[id(i-1,j-1,l)],cell[id(i,j-1,l)],cell[id(i,j,l)],cell[id(i-1,j,l)],f0>0)}
    const nv=pos.length/3,col=new Float32Array(nv*3),uv=new Float32Array(nv*2);
    let cx=0,cy=0,cz=0;for(let v=0;v<nv;v++){cx+=pos[v*3];cy+=pos[v*3+1];cz+=pos[v*3+2]}cx/=nv;cy/=nv;cz/=nv;
    const kc=k*.55;
    for(let v=0;v<nv;v++){const x=pos[v*3],y=pos[v*3+1],z=pos[v*3+2];let r=0,g=0,b=0,w=0;
      for(const p of P){const ww=Math.exp(-Math.max(0,pd(p,x,y,z))/(p.paint?kc*.35:kc))*p.w;r+=p.col.r*ww;g+=p.col.g*ww;b+=p.col.b*ww;w+=ww}
      col[v*3]=r/w;col[v*3+1]=g/w;col[v*3+2]=b/w;
      const dx=x-cx,dy=y-cy,dz=z-cz,L=Math.hypot(dx,dy,dz)||1;uv[v*2]=Math.atan2(dz,dx)/(2*Math.PI)*3;uv[v*2+1]=Math.acos(dy/L)/Math.PI*2}
    geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('color',new THREE.BufferAttribute(col,3));
    geo.setAttribute('uv',new THREE.BufferAttribute(uv,2));geo.setIndex(nv>65535?new THREE.Uint32BufferAttribute(idx,1):new THREE.Uint16BufferAttribute(idx,1));
    geo.computeVertexNormals();SDFCACHE[key]=geo;
  }
  return new THREE.Mesh(geo,sdfMat());
}

function build(sp){
  if(!SPH)SPH=new THREE.SphereGeometry(1,30,22);
  const [bx,by,bz]=sp.s,hr=sp.h,body=grp(),root=grp(),C={root,body,ears:[],legs:[],eyes:[],lids:[],brows:[],segs:[],wings:[],smoke:[]};
  root.add(body);
  const hc=sp.hc||sp.b;
  // torso
  const nk=sp.nk||0,HY=sp.bird?by*1.05:by*(.75+nk*1.5),HZ=sp.bird?bz*.45:bz*(.88+nk*.02);
  const bp=[{c:[0,0,0],r:[bx,by,bz],col:sp.b},{c:[0,-by*.25,bz*.1],r:[bx*.8,by*.74,bz*.78],col:sp.bc||sp.c}];
  if(sp.tc)bp.push({c:[0,by*.42,-bz*.05],r:[bx*.8,by*.6,bz*.9],col:sp.tc,w:5});
  if(sp.paint)for(const q of sp.paint)bp.push({c:[q[0]*bx,q[1]*by,q[2]*bz],r:[q[3],q[4],q[5]],col:q[6],w:q[7]||8,paint:1});
  if(sp.chest)bp.push({c:[0,HY-hr*1.0,HZ-hr*.1],r:[hr*.72,hr*.95,hr*.5],col:sp.c,w:6},{c:[0,by*.25,bz*.8],r:[bx*.5,by*.45,bz*.18],col:sp.c,w:4});
  else if(sp.x.includes('ruff')||sp.x.includes('maneBig'))bp.push({c:[0,HY-hr*.95,HZ-hr*.15],r:[hr*.82,hr*.95,hr*.62],col:sp.c,w:6},{c:[0,by*.1,bz*.72],r:[bx*.7,by*.7,bz*.32],col:sp.c,w:6});
  if(sp.x.includes('maneBlue'))bp.push({c:[0,HY-hr*.55,HZ-hr*.75],r:[hr*.8,hr*.85,hr*.6],col:sp.a,w:6});
  if(!sp.bird)bp.push({c:[0,(by*.45+HY)/2,(bz*.62+HZ)/2],r:[hr*.62,Math.max(hr*.85,(HY-by*.2)/2+hr*.25),hr*.56],col:sp.b,rx:.45},{c:[0,0,-bz*.52],r:[bx*.9,by*.82,bz*.5],col:sp.b},{c:[0,-by*.1,bz*.56],r:[bx*.62,by*.64,bz*.42],col:sp.c});
  body.add(sdfMesh(bp,.09,.04,sp.fluff||.035));
  // legs
  const lr=.11*Math.max(1,bx/.5)*(sp.lt||1),L=sp.lg,lc=sp.lc||sp.b;
  const hips=sp.bird?[[-bx*.45,-by*.5,-bz*.05],[bx*.45,-by*.5,-bz*.05]]:[[-bx*.6,-by*.42,bz*.58],[bx*.6,-by*.42,bz*.58],[-bx*.6,-by*.42,-bz*.58],[bx*.6,-by*.42,-bz*.58]];
  hips.forEach((h,i)=>{const g=P(grp(),...h);
    if(sp.bird){g.add(cyl(lc,.05,.04,L,{}));for(const a of[-.5,0,.5])g.add(R(P(cone(lc,.035,.18),0,-L,0),Math.PI/2,a,0))}
    else{const tp=sp.face==='doe'?.78:1;const lp=[{c:[0,-lr*.5,0],r:[lr*1.55,lr*2.1,lr*1.7],col:lc},{c:[0,-L*.55,0],r:[lr*1.05*tp,L*.5,lr*1.05*tp],col:lc},{c:[0,-L*.9,lr*.05],r:[lr*.85*tp*.85,lr*.7,lr*.85*tp*.85],col:lc}];
      if(sp.toes){lp.push({c:[0,-L-lr*.1,lr*.25],r:[lr*1.35,lr*.8,lr*1.45],col:lc});for(const tx of[-1,0,1])lp.push({c:[tx*lr*.7,-L-lr*.3,lr*1.35],r:[lr*.52,lr*.48,lr*.55],col:lc})}
      else if(!sp.hoof)lp.push({c:[0,-L-lr*.05,lr*.35],r:[lr*1.2,lr*.75,lr*1.4],col:sp.c===sp.b?lc:sp.c});
      g.add(sdfMesh(lp,lr*.45,.03,(sp.fluff||.035)*.5));
      if(sp.hoof)g.add(P(cyl(sp.hoof,lr*.8,lr*.95,lr*.9,{gloss:1}),0,-L+lr*.25,lr*.05))}
    g.userData.front=i<2&&!sp.bird;body.add(g);C.legs.push(g)});
  C.feet=-by*.42-L-lr*.75;if(sp.bird)C.feet=-by*.5-L;
  // head
  const head=P(grp(),0,HY,HZ);head.userData.part='head';body.add(head);C.head=head;
  const snC=sp.sn==='skull'?hc:(sp.c===sp.b?hc:sp.c);
  const doeEye=(s)=>{const d=new THREE.Vector3(s*.6,.16,.78).normalize(),t=1/Math.sqrt((d.x/.92)**2+(d.y/.88)**2+(d.z/1.18)**2);return{d,p:[d.x*t*hr*.94,d.y*t*hr*.94,hr*.1+d.z*t*hr*.94]}};
  const hp=sp.face==='doe'?[{c:[0,-hr*.04,hr*.1],r:[hr*.9,hr*.8,hr*1.18],col:hc},{c:[0,hr*.3,-hr*.15],r:[hr*.78,hr*.42,hr*.8],col:hc}]:[{c:[0,0,0],r:[hr,hr*.95,hr],col:hc}];
  if(sp.sn!=='beak'&&sp.sn!=='skull')for(const s of[-1,1])hp.push({c:[s*hr*.42,-hr*.3,hr*.38],r:[hr*.42,hr*.36,hr*.42],col:sp.chk?sp.c:hc,w:sp.chk?3:1});
  if(sp.chk)hp.push({c:[0,hr*.55,-hr*.05],r:[hr*.6,hr*.35,hr*.7],col:'#8a6644',w:4,paint:1});
  if(sp.sn==='dog')hp.push({c:[0,-hr*.28,hr*.8],r:[hr*.42,hr*.33,hr*.45],col:snC});
  if(sp.sn==='short')hp.push({c:[0,-hr*.3,hr*.78],r:[hr*.38,hr*.28,hr*.34],col:snC});
  if(sp.sn==='deer')hp.push(sp.face==='doe'?{c:[0,-hr*.33,hr*(sp.snz?1.0:1.12)],r:[hr*.27,hr*.24,hr*(sp.snz||.82)],col:snC}:{c:[0,-hr*.34,hr*.9],r:[hr*.33,hr*.29,hr*.72],col:snC});
  if(sp.face==='doe'){hp.push({c:[0,-hr*.6,hr*.62],r:[hr*.3,hr*.2,hr*.4],col:sp.c});
    hp.push({c:[0,-hr*.1,hr*1.0],r:[hr*.2,hr*.1,hr*.62],col:hc,w:6,paint:1},{c:[0,hr*.35,hr*.35],r:[hr*.4,hr*.3,hr*.4],col:'#7a5a3c',w:5,paint:1});
    for(const s of[-1,1]){const e=doeEye(s).p;hp.push({c:[e[0],e[1]-hr*.04,e[2]],r:[hr*.26,hr*.22,hr*.22],col:sp.c,w:5,paint:1})}}
  if(sp.sn==='flat')hp.push({c:[0,-hr*.32,hr*.62],r:[hr*.36,hr*.25,hr*.3],col:sp.c});
  head.add(sdfMesh(hp,hr*.16,.032,(sp.fluff||.035)*.45));
  if(sp.sn==='dog')head.add(P(ell('#2a1a1e',hr*.13,hr*.09,hr*.09,{gloss:1}),0,-hr*.14,hr*1.22));
  if(sp.sn==='short')head.add(P(ell('#2a1a1e',hr*.09,hr*.06,hr*.06,{gloss:1}),0,-hr*.2,hr*1.1));
  if(sp.sn==='deer'){head.add(P(ell('#1a1012',hr*.19,hr*.12,hr*.12,{gloss:1}),0,-hr*.18,hr*(sp.face==='doe'?(sp.snz?1.0+sp.snz*.95:1.85):1.58)));
    if(sp.face==='doe'){const mo=new THREE.Mesh(new THREE.TorusGeometry(hr*.12,hr*.014,6,16,Math.PI),M('#3a2018',{gloss:1}));mo.rotation.set(-.35,0,Math.PI);const nz=sp.snz?1.0+sp.snz*.95:1.85;P(mo,0,-hr*.42,hr*(nz-.15));head.add(mo);
      head.add(P(ell('#3a2018',hr*.012,hr*.08,hr*.012,{gloss:1}),0,-hr*.32,hr*(nz-.06)))}}
  if(sp.sn==='flat'){head.add(P(ell('#f08aa8',hr*.07,hr*.05,hr*.05,{gloss:1}),0,-hr*.18,hr*.98))}
  if(sp.sn==='skull'){head.add(P(ell('#1a1220',hr*.06,hr*.08,hr*.04),-.04,-hr*.25,hr*.96));head.add(P(ell('#1a1220',hr*.06,hr*.08,hr*.04),.04,-hr*.25,hr*.96))}
  if(sp.sn==='beak'){head.add(R(P(cone('#ffc24a',hr*.24,hr*.6,{gloss:1}),0,-hr*.12,hr*.8),Math.PI/2,0,0))}
  const tg=P(ell('#ff7d9a',hr*.13,hr*.04,hr*.2,{gloss:1}),0,-hr*.5,hr*(sp.sn==='dog'?1.05:.9));tg.userData.base=tg.scale.clone();head.add(tg);C.tongue=tg;
  // eyes: glossy plush eyes with lids and brows
  const er=hr*(sp.sn==='flat'?.24:.2)*(sp.es||1);
  for(const s of[-1,1]){
    const doe=sp.face==='doe',ey=doe?(sp.eyR||.78):1;
    const d=doe?new THREE.Vector3(s*.6,.16,.78).normalize():new THREE.Vector3(s*(sp.bird?.72:.52),.22,sp.bird?.6:.8).normalize();
    const eo=doe?P(grp(),...doeEye(s).p):P(grp(),d.x*hr*.86,d.y*hr*.86,d.z*hr*.86);eo.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),d);head.add(eo);
    const eg=grp();eo.add(eg);if(doe){eg.rotation.z=s*.18;eg.add(ell('#1a0f0a',er*1.12,er*ey*1.1,er*.5,{gloss:1}))}
    eg.add(ell(sp.e,er,er*ey,er*(doe?.6:.8),{gloss:1}));
    eg.add(P(ell('#050305',er*(doe?.4:.45),er*(doe?.52:.45)*ey,er*.3,{gloss:1}),0,0,er*(doe?.45:.62)));
    const hl=new THREE.Mesh(SPH,new THREE.MeshBasicMaterial({color:0xffffff}));hl.scale.setScalar(er*.2);P(hl,er*.35,er*.38*ey,er*(doe?.6:.7));eg.add(hl);
    if(doe){const h2=new THREE.Mesh(SPH,new THREE.MeshBasicMaterial({color:0xffffff}));h2.scale.setScalar(er*.09);P(h2,-er*.3,-er*.3*ey,er*.58);eg.add(h2);
      const wing=ell('#1a0f0a',er*.42,er*.07,er*.08,{gloss:1});P(wing,s*er*1.1,er*.12,er*.05);wing.rotation.z=s*.35;eg.add(wing)}
    const lid=new THREE.Mesh(new THREE.SphereGeometry(er*1.12,20,10,0,Math.PI*2,0,Math.PI/2),M(hc));lid.scale.y=ey;lid.rotation.x=-1.25;eg.add(lid);
    if(sp.x.includes('eyeRim')&&!doe){const rim=new THREE.Mesh(new THREE.TorusGeometry(er*.98,er*.13,8,24),M('#2a1a12',{gloss:1}));rim.position.z=er*.3;eg.add(rim)}C.lids.push(lid);
    const brow=new THREE.Mesh(new THREE.BoxGeometry(er*1.7,er*.32,er*.35),M('#2a1a1e',{gloss:1}));P(brow,0,er*1.2,er*.55);brow.rotation.z=s*.5;brow.visible=false;eg.add(brow);C.brows.push(brow);
  }
  // ears
  const ear=(s)=>{const g=P(grp(),s*hr*.5,hr*.62,-hr*.12);g.rotation.z=-s*.35;head.add(g);C.ears.push(g);return g};
  for(const s of[-1,1]){
    if(sp.ea==='point'){const g=ear(s);g.add(R(cone(sp.b,hr*.28,hr*.62),-.15,0,0));g.add(P(R(cone(sp.c,hr*.16,hr*.42),-.15,0,0),0,.02,.06))}
    if(sp.ea==='long'){const g=ear(s);g.add(R(cone(sp.b,hr*.2,hr*.95),-.3,0,0));g.add(P(R(cone(sp.a,hr*.1,hr*.6),-.3,0,0),0,.04,.05))}
    if(sp.ea==='big'){const g=ear(s);g.rotation.z=-s*.7;g.add(R(cone(sp.b,hr*.36,hr*.85),-.1,0,0));g.add(P(R(cone(sp.a,hr*.22,hr*.6),-.1,0,0),0,.03,.07))}
    if(sp.ea==='zig'){const g=ear(s);g.rotation.z=-s*.6;g.add(R(cone(sp.a,hr*.3,hr*1.05),-.1,0,0));g.add(P(cone('#1a1716',hr*.12,hr*.35),0,hr*.95,-.08))}
    if(sp.ea==='finLong'){const g=ear(s);g.add(P(R(ell(sp.a,.04,hr*.25,hr*.9),.9,0,0),0,hr*.1,-hr*.6));g.add(P(R(ell(sp.b,.035,hr*.2,hr*.7),.6,s*.3,0),0,-hr*.1,-hr*.5))}
    if(sp.ea==='leaf'){const g=ear(s);g.rotation.z=-s*1.1;g.add(R(P(ell('#9ab65a',hr*.22,hr*.55,hr*.06),0,hr*.45,0),-.1,0,0))}
    if(sp.ea==='pointDark'){const g=ear(s);g.add(R(cone(sp.b,hr*.32,hr*.8),-.15,0,0));g.add(P(R(cone('#2a1510',hr*.2,hr*.55),-.15,0,0),0,.03,.07))}
    if(sp.ea==='longPurple'){const g=ear(s);g.add(R(cone(sp.b,hr*.26,hr*1.15),-.25,0,0));g.add(P(R(cone(sp.a,hr*.15,hr*.8),-.25,0,0),0,.04,.06))}
    if(sp.ea==='deerBig'){const g=ear(s);g.scale.setScalar(sp.ear||1);g.position.set(s*hr*.72,hr*.42,-hr*.2);g.rotation.set(-.15,s*.55,-s*1.05);g.add(P(ell(sp.b,hr*.34,hr*.72,hr*.09),0,hr*.62,0));g.add(P(ell('#e2c9a8',hr*.2,hr*.5,hr*.05),0,hr*.6,hr*.07));g.add(P(ell('#5e4430',hr*.06,hr*.1,hr*.05),0,hr*1.28,0))}
    if(sp.ea==='deer'){const g=ear(s);g.rotation.z=-s*1.25;g.add(P(ell(sp.b,hr*.15,hr*.38,hr*.1),0,hr*.3,0));g.add(P(ell(sp.c,hr*.09,hr*.26,hr*.05),0,hr*.3,.04))}
  }
  // tail
  const tail=P(grp(),0,sp.bird?-by*.2:by*.25,-bz*.92);tail.rotation.x=sp.bird?-.2:.55;body.add(tail);C.tail=tail;
  const chain=(n,len,r0,r1,col,o,bend)=>{let parent=tail;for(let i=0;i<n;i++){const g=grp();if(i)P(g,0,0,-len);g.rotation.x=bend||0;
      const r=r0+(r1-r0)*i/Math.max(1,n-1);g.add(P(ell(col,r,r,len*.82,o),0,0,-len/2));parent.add(g);C.segs.push(g);parent=g}return parent};
  let end;
  switch(sp.tl){
    case'thick':end=chain(3,.3,.2,.09,sp.b);if(sp.x.includes('plates'))C.segs.forEach((g,i)=>g.add(P(cone(sp.a,.07,.16),0,.14-i*.03,-.15)));break;
    case'fin':end=chain(3,.28,.12,.06,sp.b);end.add(P(R(ell(sp.a,.03,.3,.36),.3,0,0),0,.05,-.45));break;
    case'flame':end=chain(2,.28,.13,.12,sp.b);for(const [c,r,h,a] of [[sp.b,.22,.55,0],['#ff9a1f',.17,.5,.35],['#ffd23a',.12,.42,-.3]])end.add(R(P(cone(c,r,h),0,0,-.2),-1.2+a*.3,0,a));break;
    case'feather':end=tail;for(let i=-2;i<=2;i++)tail.add(R(P(ell(i%2?sp.a:(sp.bird?'#ffb52a':sp.b),.06,.08,.5),i*.08,0,-.4),-.2,i*.25,0));break;
    case'curl':end=chain(4,.25,.12,.07,sp.b,{},.45);end.add(P(cone(sp.a,.07,.2),0,0,-.25));break;
    case'curlBig':end=chain(5,.28,.17,.14,sp.a,{},.5);end.add(P(R(new THREE.Mesh(new THREE.TorusGeometry(.07,.02,8,16,Math.PI*1.4),M('#f2c84a',{gloss:1,metal:.3})),0,Math.PI/2,0),0,.1,-.2));break;
    case'zig':end=chain(3,.28,.1,.06,sp.a);C.segs.forEach((g,i)=>{g.rotation.y=i%2?.6:-.6;g.children[0].scale.x*=.4;g.children[0].scale.y*=1.5});end.add(R(P(cone('#1a1716',.08,.25),0,0,-.25),-Math.PI/2,0,0));break;
    case'short':end=chain(1,.2,.12,.12,sp.b);break;
    case'finLong':end=chain(5,.26,.13,.05,sp.b,{},-.25);end.add(P(R(ell(sp.a,.03,.16,.22),.3,0,0),0,.03,-.15));tail.rotation.x=-.4;break;
    case'flameBig':end=chain(3,.3,.2,.28,sp.b,{},.35);for(const [c,r,h,a] of [['#ff9a1f',.24,.6,0],['#ffd23a',.17,.5,.4],[sp.b,.19,.55,-.4]])end.add(R(P(cone(c,r,h),0,.05,-.2),-1.3,0,a));tail.rotation.x=.3;break;
    case'zigBig':end=chain(3,.3,.14,.1,sp.a);C.segs.forEach((g,i)=>{g.rotation.y=i%2?.7:-.7;g.children[0].scale.x*=.35;g.children[0].scale.y*=2.2});for(let i=0;i<4;i++)end.add(R(P(cone(i%2?'#1a1716':sp.a,.1,.35),0,.05,-.1*i),-1.2,0,(i-1.5)*.4));break;
    case'deer':end=chain(1,.16,.14,.15,sp.c);tail.rotation.x=.9;break;
    case'bushySdf':{const TL=sp.tlen||1;tail.rotation.x=sp.tang!==undefined?sp.tang:-.75;const tp=[];for(let i=0;i<9;i++){const t=i/8;tp.push({c:[0,Math.sin(t*2.4)*.16*TL,-.1-t*.95*TL],r:[(.11+.1*Math.sin(t*Math.PI))*(sp.tw||1),(.13+.12*Math.sin(t*Math.PI*.9))*(sp.tw||1)*1.15,.18*TL],col:i>=7?sp.c:sp.b,w:i>=7?3:1})}
      tail.add(sdfMesh(tp,.08,.03,(sp.fluff||.035)*1.2));end=tail;break}
    case'bushy':end=chain(4,.26,.19,.27,sp.b,{},.22);tail.rotation.x=-.55;end.add(P(ell(sp.c,.2,.2,.2),0,0,-.28));break;
    case'smoke':end=chain(3,.28,.18,.1,sp.a,{op:.55});break;
    case'long':end=chain(5,.26,.15,.05,sp.b);if(sp.x.includes('spikesP')||sp.x.includes('spikes'))C.segs.forEach((g,i)=>g.add(P(R(cone(sp.x.includes('spikes')?'#2a1a1c':sp.a,.06,.18),-.4,0,0),0,.1-i*.015,-.12)));break;
    case'leaf':end=chain(2,.3,.14,.1,sp.b);end.add(P(R(ell('#9ab65a',.2,.04,.32),0,0,0),0,0,-.25));end.add(P(flower(sp.a,.5),0,.08,-.2));break;
    case'fluffy':end=chain(2,.22,.17,.2,sp.b);break;
    case'fluffyBig':end=chain(3,.3,.2,.28,sp.b);end.add(P(ell(sp.a,.12,.12,.14),0,0,-.25));break;
  }
  C.tailBase=tail.rotation.x;
  C.nB=body.children.length;C.nH=head.children.length;
  // extras
  const top=(t)=>{const z=t*bz*.9;return [0,by*Math.sqrt(Math.max(0,1-(t*.9)**2))*.96,z]};
  const surf=(th,ph,k)=>[bx*Math.cos(ph)*Math.sin(th)*k,by*Math.sin(ph)*k,bz*Math.cos(ph)*Math.cos(th)*k];
  const rnd=(i)=>{const v=Math.sin(i*127.1+sp.b.length*311.7)*43758.5;return v-Math.floor(v)};
  const dots=(n,col,r,o,minPh)=>{for(let i=0;i<n;i++){const th=rnd(i)*6.28,ph=(minPh||-.2)+rnd(i+50)*(1.4-(minPh||-.2));const m=P(ell(col,r,r*.4,r,o),...surf(th,ph,.94));m.lookAt(0,0,0);m.userData.dot=1;body.add(m)}};
  function flower(col,k){const f=grp();for(let i=0;i<6;i++){const p=ell(col,.12*k,.04*k,.22*k);const a=i/6*Math.PI*2;P(p,Math.cos(a)*.17*k,0,Math.sin(a)*.17*k);p.rotation.y=-a+Math.PI/2;p.rotation.x=.2;f.add(p)}f.add(ell('#ffd23a',.1*k,.07*k,.1*k));return f}
  const wingPair=(make)=>{for(const s of[-1,1]){const g=P(grp(),s*bx*.55,by*.65,sp.bird?0:bz*.15);make(g,s);body.add(g);C.wings.push(g)}};
  const ring=(par,n,cx,cy,cz,Rr,tilt,mk)=>{for(let i=0;i<n;i++){const a=i/n*Math.PI*2,g=P(grp(),cx+Math.cos(a)*Rr,cy+Math.sin(a)*Rr*.95,cz);g.rotation.set(tilt,0,a-Math.PI/2);g.add(mk(i,a));par.add(g)}};
  for(const ex of sp.x){switch(ex){
    case'ruff':break;
    case'flameMane':ring(head,13,0,-hr*.05,-hr*.45,hr*.85,-.7,(i)=>{const c=cone(i%3===0?'#ffd23a':i%3===1?'#ff9a1f':sp.b,hr*.3,hr*1.05);c.scale.z=.55;c.position.y=hr*.1;return c});break;
    case'leafMane':ring(head,12,0,-hr*.1,-hr*.45,hr*.85,-.7,(i)=>{const l=ell(i%2?'#6f8f3a':'#9ab65a',hr*.26,hr*.7,hr*.07);l.position.y=hr*.55;return l});break;
    case'headFins':for(const s of[-1,1])for(let i=0;i<3;i++){const f=ell(i%2?sp.b:sp.a,.06,hr*.42,hr*(1.7-i*.3));P(f,s*hr*(.45+i*.2),hr*(.7-i*.35),-hr*(1.3-i*.1));f.rotation.set(-.45+i*.2,s*.35,s*.35);head.add(f)}break;
    case'sideFinsBig':for(const s of[-1,1]){const f=ell(sp.a,.75,.03,.32);P(f,s*bx*1.3,by*.1,bz*.1);f.rotation.set(0,s*.5,-s*.45);body.add(f);const f2=ell(sp.b,.5,.025,.22);P(f2,s*bx*1.2,-by*.2,-bz*.45);f2.rotation.set(0,s*.8,-s*.3);body.add(f2)}break;
    case'crystalsBig':for(let i=0;i<26;i++){const th=rnd(i)*6.28,ph=.05+rnd(i+11)*1.35,c=new THREE.Mesh(new THREE.OctahedronGeometry(.15),M(i%3?sp.a:'#a8c8f4',{glass:1}));c.scale.set(.55,2+rnd(i+5)*1.4,.55);P(c,...surf(th,ph,.98));c.lookAt(0,0,0);c.rotateX&&0;body.add(c);const w=grp();body.add(w)}
      ring(head,9,0,hr*.1,-hr*.45,hr*.85,-.9,(i)=>{const c=new THREE.Mesh(new THREE.OctahedronGeometry(.12),M(i%2?sp.a:'#a8c8f4',{glass:1}));c.scale.set(.55,2.6,.55);c.position.y=hr*.35;return c});break;
    case'spikesYBig':for(let i=0;i<16;i++){const th=(rnd(i)-.5)*2.2+Math.PI,ph=.35+rnd(i+20)*1.1,c=cone(i%4===0?'#1a1716':sp.a,.11,.42+rnd(i)*.2);P(c,...surf(th,ph,.96));c.lookAt(0,0,0);c.rotation.x+=Math.PI/2*0;body.add(c)}
      ring(head,7,0,hr*.25,-hr*.4,hr*.6,-1.1,(i)=>cone(sp.a,hr*.18,hr*.6));break;
    case'lavaBig':dots(34,sp.a,.14,{glow:1.6},-.4);dots(12,'#ffc23a',.07,{glow:1.8},-.2);break;
    case'rocksDark':for(let i=0;i<10;i++){const th=rnd(i)*6.28,ph=rnd(i+20)*1.2,r=.2+rnd(i+40)*.12;const m=new THREE.Mesh(new THREE.DodecahedronGeometry(r),M(i%2?'#2e2522':'#4a3b34',{flat:1}));m.scale.y=.55;P(m,...surf(th,ph,.95));body.add(m)}break;
    case'smokeDark':for(let i=0;i<20;i++){const th=rnd(i)*6.28,ph=-.3+rnd(i+10)*1.6,r=.22+rnd(i+70)*.16;const ac=i%4===0;const m=P(ell(ac?sp.a:'#221a2c',ac?r*.6:r,ac?r*.6:r,ac?r*.9:r,{op:ac?.6:.9}),...surf(th,ph,ac?1.12:1.02));m.userData.base=m.position.clone();body.add(m);C.smoke.push(m)}break;
    case'wingsUp':wingPair((g,s)=>{g.rotation.set(-.35,0,-s*.2);for(let i=0;i<8;i++){const f=ell(i<3?sp.a:sp.b,.05,.4+i*.08,.14);P(f,s*(.05+i*.08),.36+i*.06,-i*.07);f.rotation.set(0,0,-s*(.05+i*.075));g.add(f)}});break;
    case'fairyWingsBig':wingPair((g,s)=>{g.position.y+=.1;for(const [k,y,a,col] of[[1.25,.1,-.1,'#d9c4ff'],[.85,-.12,-.9,'#ffc2dc']]){const m=new THREE.Mesh(wingShape(k,k*.85),M(col,{op:.55,side:1,gloss:1}));m.scale.x=s;m.rotation.set(-.15,s*.55,a*s*.4);P(m,0,y,-.1);g.add(m)}});break;
    case'tuft':ring(head,5,0,hr*.7,-hr*.1,hr*.25,-.3,(i)=>cone(sp.a,hr*.12,hr*.4));break;
    case'spikesPBig':for(let i=0;i<9;i++){const t=.75-i*.2,c=cone(sp.a,.1,.36+rnd(i)*.14);P(c,...top(t));c.rotation.x=-.45;body.add(c);
      for(const s of[-1,1]){const d=cone(i%2?'#4a2a8c':sp.a,.08,.3);P(d,s*.24,top(t)[1]-.08,top(t)[2]);d.rotation.set(-.4,0,-s*.75);body.add(d)}}
      ring(head,5,0,hr*.5,-hr*.45,hr*.35,-1.2,(i)=>cone(sp.a,hr*.12,hr*.45));break;
    case'plates':for(let i=0;i<6;i++){const t=.65-i*.27;const c=cone(sp.a,.15-i*.008,.3-i*.015);P(c,...top(t));c.scale.x=.45;c.rotation.x=-t*.6;body.add(c)}break;
    case'spotsBrown':dots(10,'#5f7a30',.12,{},0);break;
    case'dorsalFin':body.add(P(R(ell(sp.a,.04,.32,.5),.2,0,0),...top(-.1)));break;
    case'sideFins':for(const s of[-1,1])body.add(R(P(ell(sp.a,.45,.03,.22),s*bx*1.05,-by*.1,bz*.2),0,s*.4,s*-.3));break;
    case'flames':for(let i=0;i<7;i++){const t=.5-i*.17,c=cone(i%2?'#ff9a1f':'#ffd23a',.1,.32);P(c,...top(t));c.rotation.x=-.7;body.add(c)}
      for(let i=-1;i<=1;i++)head.add(R(P(cone(i?'#ff9a1f':'#ffd23a',.08,.3),i*.12,hr*.85,-hr*.1),-.4,0,-i*.3));
      body.add(P(ell(sp.c,bx*.55,by*.45,.2),0,by*.3,bz*.82));break;
    case'spots':dots(8,'#3a1a10',.07,{},-.1);break;
    case'wings':wingPair((g,s)=>{for(let i=0;i<5;i++){const f=ell(i%2?sp.a:sp.b,.06,.1,.45+i*.06);P(f,s*(.12+i*.13),.18+i*.07,-.05-i*.05);f.rotation.set(-.6,s*(.5+i*.1),s*-(.9+i*.12));g.add(f)}});break;
    case'crest':for(let i=-1;i<=1;i++)head.add(R(P(cone(sp.a,.06,.28),i*.1,hr*.8,-hr*.3),-.6,0,-i*.25));break;
    case'batWings':case'batWingsBig':{const big=ex==='batWingsBig',k=big?1.3:.75;wingPair((g,s)=>{g.rotation.z=-s*.45;const m=new THREE.Mesh(wingShape(k,k*.85,true),M(big?'#8e1a1e':sp.a,{side:1}));m.scale.x=s;m.rotation.set(.25,s*.3,s*.2);g.add(m);
      g.add(R(cyl(big?'#2a1a1c':'#2a2236',.025,.02,k*1.2),0,0,-s*2.1))})};break;
    case'glowPurple':dots(6,sp.a,.08,{glow:.6},-.1);break;
    case'leaves':for(let i=0;i<8;i++){const t=.5-i*.15,l=ell(i%2?'#6f8f3a':'#9ab65a',.12,.04,.3);P(l,(i%2?.15:-.15),top(t)[1],top(t)[2]);l.rotation.set(-.5,0,i%2?-.6:.6);body.add(l)}break;
    case'flower':head.add(P(flower(sp.a,1.1),.1,hr*.92,-.05));break;
    case'crystals':for(let i=0;i<9;i++){const t=.75-i*.19,c=new THREE.Mesh(new THREE.OctahedronGeometry(.13),M(i%3?sp.a:'#a8c8f4',{glass:1}));c.scale.set(.6,1.8+rnd(i)*.8,.6);P(c,(rnd(i+9)-.5)*.3,top(t)[1]+.1,top(t)[2]);c.rotation.set(-.4,0,(rnd(i+3)-.5)*.8);body.add(c)}
      for(let i=-1;i<=1;i++){const c=new THREE.Mesh(new THREE.OctahedronGeometry(.09),M(sp.a,{glass:1}));c.scale.set(.6,2,.6);P(c,i*.15,hr*.9,-hr*.2);c.rotation.z=-i*.4;head.add(c)}break;
    case'spikesY':for(let i=0;i<5;i++){const c=cone(sp.a,.08,.28);P(c,...top(.6-i*.25));c.rotation.x=-.8;body.add(c)}
      head.add(P(ell(sp.a,hr*.7,hr*.3,hr*.6),0,hr*.55,-hr*.25));break;
    case'patch':body.add(P(ell('#1a1716',bx*.4,by*.35,bz*.3),bx*.5,-by*.05,-bz*.1));break;
    case'lava':dots(16,sp.a,.09,{glow:1.2},-.3);break;
    case'horn':head.add(R(P(cone('#e82a14',.12,.35,{gloss:1}),0,hr*.85,0),-.3,0,0));for(const s of[-1,1])head.add(R(P(cone('#b8241a',.06,.15),s*.25,hr*.7,-.05),0,0,-s*.5));break;
    case'spotsNavy':dots(11,sp.a,.16,{},-.3);break;
    case'moon':head.add(R(P(new THREE.Mesh(new THREE.TorusGeometry(.16,.04,8,24,Math.PI*1.3),M('#f2c84a',{gloss:1,metal:.4})),0,hr*1.05,-hr*.1),0,0,.6));break;
    case'maneBlue':for(let i=0;i<7;i++)head.add(R(P(ell(sp.a,.13,.12,.42),(i-3)*.11,hr*(.75-Math.abs(i-3)*.08),-hr*.55),.6,0,(i-3)*.25));break;
    case'antlers':for(const s of[-1,1]){const g=P(grp(),s*hr*.32,hr*.82,-hr*.15);g.rotation.set(-.35,0,-s*.42);g.scale.setScalar(sp.ant||1);head.add(g);
      if(sp.antStyle==='branch'){g.rotation.set(-.3,s*.2,-s*.95);
        const seg=(par,len,r0,r1,depth,ang,twist)=>{const b=grp();b.rotation.set(twist||0,0,ang);par.add(b);b.add(R(cyl(sp.a,r1,r0,len,{velvet:1}),Math.PI,0,0));
          b.add(P(ell(sp.a,r1*1.35,r1*1.35,r1*1.35,{velvet:1}),0,len,0));const t=P(grp(),0,len,0);b.add(t);
          if(depth>0){seg(t,len*.72,r1,r1*.78,depth-1,s*.35,0);seg(t,len*.62,r1*.9,r1*.72,depth-1,-s*.75,.5)}if(depth>1){const mid=P(grp(),0,len*.5,0);b.add(mid);seg(mid,len*.55,r1*.85,r1*.7,0,s*1.05,-.7)}};
        seg(g,.3,.09,.075,3,s*.25,0)}
      else{g.add(R(cyl(sp.a,.075,.11,.75,{velvet:1}),Math.PI,0,0));
      for(const [y,a,l] of[[.25,1,.3],[.48,-1,.26]]){const b=P(grp(),0,y,0);b.rotation.z=s*a*.9;g.add(b);b.add(R(cyl(sp.a,.045,.065,l,{velvet:1}),Math.PI,0,0));b.add(P(ell('#6e5640',.036,.05,.036),0,l,0))}
      g.add(P(ell('#6e5640',.06,.08,.06),0,.8,0))}}break;
    case'maneBig':for(let i=0;i<0;i++){const t=i/13,a=(rnd(i)-.5)*1.6,r=.17+rnd(i+3)*.07;body.add(P(ell(sp.c,r*1.1,r*1.15,r*.9),Math.sin(a)*bx*.5,-by*.35+t*(HY-hr*.6+by*.35),bz*.72+(HZ-bz*.72)*t+.12*Math.cos(a)))}
      for(let i=0;i<4;i++)head.add(P(ell(sp.c,.13,.11,.1),(i-1.5)*.12,-hr*.75,hr*.15));break;
    case'mane':body.add(P(ell(sp.c,bx*.75,by*.6,.3),0,by*.35,bz*.75));break;
    case'eyeRim':C.eyes&&0;break;
    case'legTufts':C.legs.forEach(g=>{for(let i=0;i<3;i++)g.add(P(ell(sp.c,.07,.05,.06),(i-1)*.05,-sp.lg*.7,.08))});break;
    case'patchesBrown':dots(10,'#9a7650',.17,{},.15);dots(6,'#e8dcc8',.07,{},.3);break;
    case'spotsWhite':dots(8,'#f4ece0',.06,{},.1);break;
    case'horns2':for(const s of[-1,1])head.add(R(P(cone('#8c8590',.08,.4,{gloss:1}),s*hr*.4,hr*.7,-hr*.2),-1.1,0,-s*.4));break;
    case'spikes':for(let i=0;i<6;i++){const c=cone('#2a1a1c',.06,.18);P(c,...top(.6-i*.22));c.rotation.x=-.6;body.add(c)}break;
    case'patchesBlack':dots(7,sp.a,.14,{},-.2);break;
    case'cloud':for(let i=0;i<46;i++){const th=rnd(i)*6.28,ph=-.3+rnd(i+30)*1.6,r=.12+rnd(i+60)*.1;body.add(P(ell(i%3?sp.b:sp.a,r,r*.9,r),...surf(th,ph,.95)))}
      for(let i=0;i<5;i++)head.add(P(ell(i%2?sp.a:sp.b,.13,.12,.13),(i-2)*.15,hr*.8,-hr*.35));break;
    case'rocks':for(let i=0;i<14;i++){const th=rnd(i)*6.28,ph=rnd(i+20)*1.3,r=.18+rnd(i+40)*.14;const m=new THREE.Mesh(new THREE.DodecahedronGeometry(r),M(i%2?'#7a756c':'#958f83',{flat:1}));m.scale.y=.6;P(m,...surf(th,ph,.95));m.lookAt(0,0,0);body.add(m)}break;
    case'moss':dots(10,sp.a,.13,{},.3);break;
    case'smoke':for(let i=0;i<12;i++){const th=rnd(i)*6.28,ph=-.2+rnd(i+10)*1.4,r=.2+rnd(i+70)*.15;const m=P(ell(i%2?sp.a:'#5a2a9a',r,r,r,{op:.45}),...surf(th,ph,1.05));m.userData.base=m.position.clone();body.add(m);C.smoke.push(m)}break;
    case'shell':{const sh=new THREE.Mesh(new THREE.SphereGeometry(1,28,14,0,Math.PI*2,0,Math.PI/2),M(sp.a));sh.scale.set(bx*1.15,by*1.6,bz*1.08);P(sh,0,by*.1,-bz*.05);body.add(sh);
      const rim=new THREE.Mesh(new THREE.TorusGeometry(1,.09,8,32),M('#2b56b0'));rim.scale.set(bx*1.15,bz*1.08,1);rim.rotation.x=Math.PI/2;P(rim,0,by*.12,-bz*.05);body.add(rim);
      for(let i=0;i<10;i++){const th=rnd(i)*6.28,r=.4+rnd(i+5)*.45;body.add(P(ell('#2b56b0',.12,.05,.12),Math.sin(th)*bx*r,by*.1+by*1.6*Math.sqrt(1-r*r)*.98,Math.cos(th)*bz*r-bz*.05))}}break;
    case'coral':for(let i=0;i<7;i++){const col=['#f26a8a','#ff9a3a','#ffd23a','#c45ad8'][i%4],g=P(grp(),(rnd(i)-.5)*bx*1.1,by*1.55,(rnd(i+3)-.5)*bz);
      g.add(R(cyl(col,.03,.045,.4),Math.PI,0,(rnd(i+7)-.5)*.6));for(const a of[-.7,.7])g.add(P(R(cyl(col,.02,.03,.22),Math.PI,0,a),0,.2,0));body.add(g)}break;
    case'fireWings':wingPair((g,s)=>{for(let i=0;i<6;i++){const f=ell(['#ff5a1a','#ffb52a','#e8401c'][i%3],.05,.12,.4+i*.07);P(f,s*(.1+i*.12),.25+i*.05,-.05);f.rotation.set(-.3,s*.3,s*-(.5+i*.18));g.add(f)}});break;
    case'crestFire':for(let i=-1;i<=1;i++)head.add(R(P(cone(i?'#ffb52a':'#e8401c',.06,.3),i*.08,hr*.75,-hr*.4),-.9,0,-i*.3));break;
    case'fairyWings':wingPair((g,s)=>{for(const [k,y,a,col] of[[.9,.15,-.2,'#d9c4ff'],[.6,-.05,-.9,'#ffc2dc']]){const m=new THREE.Mesh(wingShape(k,k*.8),M(col,{op:.5,side:1,gloss:1}));m.scale.x=s;m.rotation.set(-.4,s*.5,a*s*.4);P(m,0,y,0);g.add(m)}});break;
    case'bow':for(const s of[-1,1])head.add(P(R(ell(sp.a,.1,.07,.05),0,0,s*.4),s*.1,-hr*.85,hr*.25));head.add(P(ell(sp.a,.05,.05,.05),0,-hr*.85,hr*.28));break;
    case'spikesP':for(let i=0;i<7;i++){const t=.7-i*.22,c=cone(sp.a,.08,.26+rnd(i)*.1);P(c,...top(t));c.rotation.x=-.5;body.add(c);
      for(const s of[-1,1]){const d=cone(sp.a,.06,.2);P(d,s*.18,top(t)[1]-.05,top(t)[2]);d.rotation.set(-.4,0,-s*.6);body.add(d)}}break;
    case'spotsDark':dots(10,'#3f5a1c',.08,{},-.2);break;
    case'hornsGold':for(const s of[-1,1]){const g=P(grp(),s*hr*.38,hr*.55,-hr*.15);g.rotation.set(-1.95,0,-s*.25);head.add(g);g.add(cone(sp.a,.075,.55,{gloss:1,metal:.4}));g.add(P(R(cone(sp.a,.05,.45,{gloss:1,metal:.4}),.45,0,0),0,.5,0));g.add(P(R(cone(sp.a,.03,.3,{gloss:1,metal:.4}),.9,0,0),0,.9,.18))}break;
    case'goldMarks':dots(14,sp.a,.11,{gloss:1,metal:.4},-.3);break;
  }}
  if(sp.bird)body.rotation.x=-.35;
  return C;
}

/* ---------- photo skin: project the reference photo onto the sculpted body ---------- */
const FILLS=GD.fills.FILLS;const PTEX={};
function photoTex(i){if(PTEX[i])return PTEX[i];const t=new THREE.TextureLoader().load(FILLS[i]);t.encoding=THREE.sRGBEncoding;t.anisotropy=4;return PTEX[i]=t}
function projectPhoto(C,i,sp){
  const pv=sp.pv||[50,12],a=pv[0]*Math.PI/180,p=pv[1]*Math.PI/180,ca=Math.cos(a),sa=Math.sin(a),cp=Math.cos(p),spp=Math.sin(p);
  const pr=(x,y,z)=>{const X=ca*x+sa*z,Z=-sa*x+ca*z;return[X,cp*y-spp*Z]};
  C.root.updateMatrixWorld(true);const inv=new THREE.Matrix4().copy(C.root.matrixWorld).invert(),v=new THREE.Vector3(),targets=[];
  let mnx=1e9,mny=1e9,mxx=-1e9,mxy=-1e9;
  C.root.traverse(o=>{if(!o.isMesh||o.userData.shell||!o.geometry.attributes.position)return;const m=new THREE.Matrix4().multiplyMatrices(inv,o.matrixWorld),pos=o.geometry.attributes.position;
    for(let k=0;k<pos.count;k+=2){v.fromBufferAttribute(pos,k).applyMatrix4(m);const q=pr(v.x,v.y,v.z);if(q[0]<mnx)mnx=q[0];if(q[0]>mxx)mxx=q[0];if(q[1]<mny)mny=q[1];if(q[1]>mxy)mxy=q[1]}
    if(o.material===SDFMAT){let inHead=false;for(let u=o;u;u=u.parent)if(u===C.head)inHead=true;if(!inHead)targets.push([o,m])}});
  if(!targets.length||!FILLS[i])return;
  const mat=new THREE.MeshStandardMaterial({map:photoTex(i),roughness:1,metalness:0});mat.userData.fur=true;mat.userData.photo=true;
  for(const [o,m] of targets){const g=o.geometry.clone(),pos=g.attributes.position,uv=new Float32Array(pos.count*2);
    for(let k=0;k<pos.count;k++){v.fromBufferAttribute(pos,k).applyMatrix4(m);const q=pr(Math.abs(v.x),v.y,v.z);uv[k*2]=(q[0]-mnx)/(mxx-mnx);uv[k*2+1]=(q[1]-mny)/(mxy-mny)}
    g.setAttribute('uv',new THREE.BufferAttribute(uv,2));
    if(sp.chest){const cl=new Float32Array(pos.count*3),bz=sp.s[2],by=sp.s[1];for(let k=0;k<pos.count;k++){v.fromBufferAttribute(pos,k).applyMatrix4(m);
      const w=Math.min(1,Math.max(0,(v.z-bz*.45)/(bz*.3)))*Math.min(1,Math.max(0,(v.y+by*.7)/(by*.4)));cl[k*3]=1+.22*w;cl[k*3+1]=1+.17*w;cl[k*3+2]=1+.08*w}
      g.setAttribute('color',new THREE.BufferAttribute(cl,3));mat.vertexColors=true}
    o.geometry=g;o.material=mat}
}
