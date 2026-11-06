import sys,os;sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import json,struct,io,numpy as np,sys
from PIL import Image
import scipy.sparse as sp,scipy.sparse.csgraph as cg

from glbio import read
from decim import decimate
def write_compact(f,P,UV,I,img,q=80,nrm=None):
  buf=io.BytesIO();img.save(buf,'JPEG',quality=q);jb=buf.getvalue()
  nb=None
  if nrm is not None:
    b2=io.BytesIO();nrm.save(b2,'JPEG',quality=88);nb=b2.getvalue()
  parts=[];views=[];acc=[];off=0
  def add(b,target=None):
    nonlocal off;pad=(-len(b))%4;views.append(dict(buffer=0,byteOffset=off,byteLength=len(b),**({'target':target} if target else {})));parts.append(b+b'\0'*pad);off+=len(b)+pad;return len(views)-1
  P=P.astype(np.float32);uv=np.clip(np.round(np.mod(UV,1.0)*65535),0,65535).astype(np.uint16)
  acc.append(dict(bufferView=add(P.tobytes(),34962),componentType=5126,count=len(P),type='VEC3',min=P.min(0).tolist(),max=P.max(0).tolist()))
  acc.append(dict(bufferView=add(uv.tobytes(),34962),componentType=5123,normalized=True,count=len(P),type='VEC2'))
  big=len(P)>65535;ii=I.astype(np.uint32 if big else np.uint16).ravel()
  acc.append(dict(bufferView=add(ii.tobytes(),34963),componentType=5125 if big else 5123,count=len(ii),type='SCALAR'))
  vi=add(jb);ni=add(nb) if nb else None
  j=dict(asset=dict(version='2.0',generator='garro-compact'),scene=0,scenes=[dict(nodes=[0])],nodes=[dict(mesh=0,name='plush')],
    meshes=[dict(primitives=[dict(attributes=dict(POSITION=0,TEXCOORD_0=1),indices=2,material=0)])],
    materials=[dict(pbrMetallicRoughness=dict(baseColorTexture=dict(index=0),metallicFactor=0,roughnessFactor=.9),**({'normalTexture':dict(index=1,scale=1)} if nb else {}))],
    textures=[dict(source=0,sampler=0)]+([dict(source=1,sampler=0)] if nb else []),samplers=[dict(magFilter=9729,minFilter=9987)],images=[dict(bufferView=vi,mimeType='image/jpeg')]+([dict(bufferView=ni,mimeType='image/jpeg')] if nb else []),
    accessors=acc,bufferViews=views,buffers=[dict(byteLength=off)])
  js=json.dumps(j).encode();js+=b' '*((-len(js))%4);bn=b''.join(parts)
  out=struct.pack('<III',0x46546C67,2,28+len(js)+len(bn))+struct.pack('<II',len(js),0x4E4F534A)+js+struct.pack('<II',len(bn),0x004E4942)+bn
  open(f,'wb').write(out);return len(out)
def clean(P,UV,I,keep=.02):
  key=np.round(P,6);_,w=np.unique(key,axis=0,return_inverse=True);w=w.ravel();n=w.max()+1
  e=np.r_[I[:,[0,1]],I[:,[1,2]]];e=w[e];G=sp.coo_matrix((np.ones(len(e)),(e[:,0],e[:,1])),shape=(n,n))
  nc,lab=cg.connected_components(G,directed=False);tl=lab[w[I[:,0]]];cnt=np.bincount(tl,minlength=nc)
  okc=cnt>=keep*len(I);I=I[okc[tl]]
  used=np.unique(I);r=-np.ones(len(P),np.int64);r[used]=np.arange(len(used))
  return P[used],UV[used],r[I],nc,(~okc).sum()
if __name__=='__main__':
  src,out=sys.argv[1],sys.argv[2];rot=float(sys.argv[3]) if len(sys.argv)>3 else 0;tex=int(sys.argv[4]) if len(sys.argv)>4 else 1024
  G=read(src);P,UV,I=decimate(G['P'].astype(float),G['UV'].astype(float),G['I'],100,128)
  P,UV,I,nc,dropped=clean(P,UV,I)
  if rot:
    a=np.radians(rot);R=np.array([[np.cos(a),0,np.sin(a)],[0,1,0],[-np.sin(a),0,np.cos(a)]]);P=P@R.T
  P[:,1]-=P[:,1].min()
  img=G['img'].resize((tex,tex),Image.LANCZOS);img.save(out.replace('.glb','_tex.png'))
  print(out,len(P),len(I),'comps',nc,'dropped',dropped,write_compact(out,P,UV,I,img))
