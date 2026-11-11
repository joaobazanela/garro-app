import sys,os;sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import sys,io,numpy as np

from glbio import read
from decim import decimate
from compact import write_compact
from PIL import Image
from scipy.spatial import cKDTree
import scipy.sparse as sp,scipy.sparse.csgraph as cg
def components(P,I):
  key=np.round(P,5);_,w=np.unique(key,axis=0,return_inverse=True);w=w.ravel();n=w.max()+1
  e=np.r_[I[:,[0,1]],I[:,[1,2]]];A=sp.coo_matrix((np.ones(len(e)),(w[e[:,0]],w[e[:,1]])),shape=(n,n));nc,lab=cg.connected_components(A,directed=False);return lab[w]
def prep(P,UV,I,rot):
  a=np.radians(rot);P=np.c_[P[:,0]*np.cos(a)+P[:,2]*np.sin(a),P[:,1],-P[:,0]*np.sin(a)+P[:,2]*np.cos(a)]
  mn=P.min(0);mx=P.max(0);ext=mx-mn;s=.98/max(ext[0],ext[2],ext[1]);P=(P-np.array([(mn[0]+mx[0])/2,mn[1],(mn[2]+mx[2])/2]))*s;return P
def bake(P,UV,I,tex,cells,S,q,out,rot_done=True):
  nP,_,nI=decimate(P,UV,I,cells)
  # drop tiny/degenerate
  A=nP[nI];ar=np.linalg.norm(np.cross(A[:,1]-A[:,0],A[:,2]-A[:,0]),axis=1);nI=nI[ar>1e-9]
  nT=len(nI);N=(nT+1)//2;g=int(np.ceil(np.sqrt(N)));Pt=S//g;T=Pt-2
  tree=cKDTree(P);TW,TH=tex.size;ta=np.asarray(tex)
  atlas=np.zeros((S,S,3),np.uint8)
  # texel local coords
  ii,jj=np.meshgrid(np.arange(T),np.arange(T),indexing='ij')  # i=row(b) j=col(a)
  a=(jj/(T-1.)).ravel();b=(ii/(T-1.)).ravel()
  tri=nP[nI].astype(np.float64)  # nT,3,3
  tri2=np.concatenate([tri,tri[-1:]],0) if nT%2 else tri
  X1=tri2[0::2];X2=tri2[1::2]
  m1=(a+b<=1+1e-9);m2=(a+b>=1-1e-9)
  pos=np.zeros((N,T*T,3))
  pos[:,m1]=X1[:,0:1]+a[m1][None,:,None]*(X1[:,1:2]-X1[:,0:1])+b[m1][None,:,None]*(X1[:,2:3]-X1[:,0:1])
  a2=1-a;b2=1-b
  pos[:,m2]=X2[:,0:1]+a2[m2][None,:,None]*(X2[:,1:2]-X2[:,0:1])+b2[m2][None,:,None]*(X2[:,2:3]-X2[:,0:1])
  _,vi=tree.query(pos.reshape(-1,3),workers=-1)
  u=UV[vi];px=np.clip((np.mod(u[:,0],1)*(TW-1)).round().astype(int),0,TW-1);py=np.clip((np.mod(u[:,1],1)*(TH-1)).round().astype(int),0,TH-1)
  col=ta[py,px].reshape(N,T,T,3)
  for k in range(N):
    r,c=divmod(k,g);y0=r*Pt;x0=c*Pt
    t=col[k];tp=np.pad(t,((1,1),(1,1),(0,0)),mode='edge');atlas[y0:y0+Pt,x0:x0+Pt]=tp
  img=Image.fromarray(atlas)
  # verts: 6 per tile (3+3), uv
  V=np.zeros((N*2,3,3));U=np.zeros((N*2,3,2))
  ar=lambda k:(k//g*Pt+1,k%g*Pt+1)
  for_k=np.arange(N);y0=(for_k//g)*Pt+1;x0=(for_k%g)*Pt+1
  def uv(xa,yb,k):return np.stack([(x0[k]+xa*(T-1)+.5)/S,(y0[k]+yb*(T-1)+.5)/S],-1)
  # T1 corners (a,b): (0,0),(1,0),(0,1) ; T2 corners: (1,1),(0,1),(1,0)  with tex row index = b*(T-1)
  K=np.arange(N)
  c1=[(0,0),(1,0),(0,1)];c2=[(1,1),(0,1),(1,0)]
  for q_,(ca,cb) in enumerate(c1):U[0::2,q_]=uv(ca,cb,K)
  for q_,(ca,cb) in enumerate(c2):U[1::2,q_]=uv(ca,cb,K)
  V[0::2]=X1;V[1::2]=X2
  Vv=V.reshape(-1,3)[:nT*3];Uu=U.reshape(-1,2)[:nT*3]
  Ii=np.arange(len(Vv)).reshape(-1,3)
  sz=write_compact(out,Vv.astype(np.float32),Uu.astype(np.float64),Ii,img,q=q)
  return sz,nT,S,T
if __name__=='__main__':
  pass
