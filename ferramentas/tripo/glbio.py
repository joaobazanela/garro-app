import sys,os;sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import json,struct,numpy as np,io
from PIL import Image
CT={5126:'<f4',5121:'u1',5123:'<u2',5125:'<u4'};NC={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}
def read(f):
  d=open(f,'rb').read();l=struct.unpack('<I',d[12:16])[0];j=json.loads(d[20:20+l]);b=d[20+l+8:]
  def acc(i):
    a=j['accessors'][i];bv=j['bufferViews'][a['bufferView']];n=NC[a['type']]
    r=np.frombuffer(b,dtype=CT[a['componentType']],count=a['count']*n,offset=bv.get('byteOffset',0)+a.get('byteOffset',0)).reshape(a['count'],n).copy()
    if a.get('normalized'):r=r.astype(np.float32)/{5121:255.,5123:65535.}[a['componentType']]
    return r
  p=j['meshes'][0]['primitives'][0]
  P=acc(p['attributes']['POSITION']).astype(np.float32);UV=acc(p['attributes']['TEXCOORD_0']).astype(np.float32)
  N=acc(p['attributes']['NORMAL']).astype(np.float32) if 'NORMAL' in p['attributes'] else None
  I=acc(p['indices']).reshape(-1,3).astype(np.int64)
  def image(k):
    im=j['images'][k];bv=j['bufferViews'][im['bufferView']];return Image.open(io.BytesIO(b[bv.get('byteOffset',0):bv.get('byteOffset',0)+bv['byteLength']])).convert('RGB')
  mat=j['materials'][p.get('material',0)] if j.get('materials') else {}
  bi=j['textures'][mat['pbrMetallicRoughness']['baseColorTexture']['index']]['source'] if mat.get('pbrMetallicRoughness',{}).get('baseColorTexture') else 0
  ni=j['textures'][mat['normalTexture']['index']]['source'] if mat.get('normalTexture') else None
  img=image(bi);nrm=image(ni) if ni is not None else None
  return dict(P=P,UV=UV,N=N,I=I,img=img,j=j,nrm=nrm)
def normals(P,I):
  N=np.zeros_like(P,dtype=np.float64);t=P[I].astype(np.float64);fn=np.cross(t[:,1]-t[:,0],t[:,2]-t[:,0])
  for k in range(3):np.add.at(N,I[:,k],fn)
  # smooth across uv seams: average by welded position
  key=np.round(P,5);_,w=np.unique(key,axis=0,return_inverse=True);w=w.ravel();S=np.zeros((w.max()+1,3));np.add.at(S,w,N);N=S[w]
  return (N/(np.linalg.norm(N,axis=1,keepdims=True)+1e-12)).astype(np.float32)
def write(f,P,N,UV,I,img,q=82,UV2=None):
  buf=io.BytesIO();img.save(buf,'JPEG',quality=q);jb=buf.getvalue()
  parts=[];views=[];acc=[];off=0
  def add(arr,target=None):
    nonlocal off;b=arr.tobytes();pad=(-len(b))%4;views.append(dict(buffer=0,byteOffset=off,byteLength=len(b),**({'target':target} if target else {})));parts.append(b+b'\0'*pad);off+=len(b)+pad;return len(views)-1
  P=P.astype(np.float32);N=N.astype(np.float32);UV=UV.astype(np.float32);Ii=I.astype(np.uint32).ravel()
  L=[(P,34962,'VEC3'),(N,34962,'VEC3'),(UV,34962,'VEC2')]+([(UV2.astype(np.float32),34962,'VEC2')] if UV2 is not None else [])
  for arr,t,typ in L:
    v=add(arr,t);a=dict(bufferView=v,componentType=5126,count=len(arr),type=typ)
    if typ=='VEC3' and arr is P:a['min']=P.min(0).tolist();a['max']=P.max(0).tolist()
    acc.append(a)
  ni=len(acc);v=add(Ii,34963);acc.append(dict(bufferView=v,componentType=5125,count=len(Ii),type='SCALAR'))
  vi=add(np.frombuffer(jb,np.uint8))
  j=dict(asset=dict(version='2.0',generator='garro-derive'),scene=0,scenes=[dict(nodes=[0])],nodes=[dict(mesh=0,name='plush')],
    meshes=[dict(primitives=[dict(attributes=dict(POSITION=0,NORMAL=1,TEXCOORD_0=2,**({'TEXCOORD_1':3} if UV2 is not None else {})),indices=ni,material=0)])],
    materials=[dict(pbrMetallicRoughness=dict(baseColorTexture=dict(index=0),metallicFactor=0,roughnessFactor=.9))],
    textures=[dict(source=0,sampler=0)],samplers=[dict(magFilter=9729,minFilter=9987)],images=[dict(bufferView=vi,mimeType='image/jpeg')],
    accessors=acc,bufferViews=views,buffers=[dict(byteLength=off)])
  js=json.dumps(j).encode();js+=b' '*((-len(js))%4);bin_=b''.join(parts)
  out=struct.pack('<III',0x46546C67,2,12+8+len(js)+8+len(bin_))+struct.pack('<II',len(js),0x4E4F534A)+js+struct.pack('<II',len(bin_),0x004E4942)+bin_
  open(f,'wb').write(out);return len(out)
