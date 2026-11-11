import sys,os;sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import sys,numpy as np

from glbio import read
from decim import decimate
from compact import write_compact
from bake import prep,components
from PIL import Image
from scipy.spatial import cKDTree
import scipy.sparse as sp,scipy.sparse.csgraph as cg
def charts(I,n):
  e=np.r_[I[:,[0,1]],I[:,[1,2]]];A=sp.coo_matrix((np.ones(len(e)),(e[:,0],e[:,1])),shape=(n,n));return cg.connected_components(A,directed=False)[1]
def rebake(P,UV,I,img,cells,S,q,out):
  ch=charts(I,len(P))
  nP,_,nI=decimate(P,UV,I,cells,uvq=1)
  A=nP[nI];ar=np.linalg.norm(np.cross(A[:,1]-A[:,0],A[:,2]-A[:,0]),axis=1);nI=nI[ar>1e-10]
  tc=P[I].mean(1);tt=cKDTree(tc);_,ti=tt.query(nP[nI].mean(1),workers=-1);tch=ch[I[ti,0]]
  BIG=1e3;t4=cKDTree(np.c_[P,ch*BIG])
  corner=nP[nI].reshape(-1,3);cc=np.repeat(tch,3)
  _,vi=t4.query(np.c_[corner,cc*BIG],workers=-1)
  key=np.c_[nI.ravel(),vi];u,inv=np.unique(key,axis=0,return_inverse=True);inv=inv.ravel()
  VP=nP[u[:,0]];VU=UV[u[:,1]];VI=inv.reshape(-1,3)
  im=img.resize((S,S),Image.LANCZOS) if img.size[0]!=S else img
  sz=write_compact(out,VP.astype(np.float32),VU.astype(np.float64),VI,im,q=q)
  return sz,len(VI),len(VP)
