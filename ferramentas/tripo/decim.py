import sys,os;sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import sys,numpy as np
from PIL import Image

from glbio import read,write,normals
def decimate(P,UV,I,cells=170,uvq=384):
  mn=P.min(0);ext=(P.max(0)-mn).max();q=np.floor((P-mn)/ext*cells).astype(np.int64)
  pk=(q[:,0]*(cells+1)+q[:,1])*(cells+1)+q[:,2]
  _,pc=np.unique(pk,return_inverse=True);pc=pc.ravel()
  uq=np.floor(np.mod(UV,1.0001)*uvq).astype(np.int64);k2=pc*(uvq*uvq+1)+uq[:,0]*uvq+uq[:,1]
  _,cid=np.unique(k2,return_inverse=True);cid=cid.ravel();n=cid.max()+1
  # position = mean of pos cell ; uv = mean of (cell,uvcell)
  npc=pc.max()+1;ps=np.zeros((npc,3));np.add.at(ps,pc,P);pcnt=np.bincount(pc,minlength=npc);ppos=ps/pcnt[:,None]
  us=np.zeros((n,2));np.add.at(us,cid,UV);ucnt=np.bincount(cid,minlength=n);nuv=us/ucnt[:,None]
  cpc=np.zeros(n,np.int64);cpc[cid]=pc;nP=ppos[cpc]
  T=cid[I];pT=pc[I]
  ok=(pT[:,0]!=pT[:,1])&(pT[:,1]!=pT[:,2])&(pT[:,0]!=pT[:,2]);T=T[ok]
  s=np.sort(T,axis=1);_,u=np.unique(s,axis=0,return_index=True);T=T[np.sort(u)]
  used=np.unique(T);remap=-np.ones(n,np.int64);remap[used]=np.arange(len(used))
  return nP[used].astype(np.float32),nuv[used].astype(np.float32),remap[T]
if __name__=='__main__':
  f,out=sys.argv[1],sys.argv[2];cells=int(sys.argv[3]) if len(sys.argv)>3 else 170
  G=read(f);P,UV,I=G['P'].astype(np.float64),G['UV'].astype(np.float64),G['I']
  nP,nUV,nI=decimate(P,UV,I,cells)
  N=normals(nP,nI);img=G['img'].resize((1024,1024),Image.LANCZOS)
  sz=write(out,nP,N,nUV,nI,img,q=82);print(out,len(nP),len(nI),sz)
