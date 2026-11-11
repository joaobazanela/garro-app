import sys,os;sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
# Separa um .glb do Tripo com vários objetos (pedaços soltos) em um .glb por objeto, com textura própria reempacotada
# e malha reduzida. Uso: python3 separar.py modelo.glb saida/ nome1,nome2,... rot1,rot2,... S cells
import sys,numpy as np,collections

from glbio import read
from bake import components,prep
from nb import charts,rebake
from PIL import Image
def ordem(P,L):
  # objetos em 2 fileiras (de cima/trás e de baixo/frente), cada uma da esquerda para a direita
  cs=[c for c,n in collections.Counter(L).most_common() if n>2000]
  info=[(c,P[L==c].min(0),P[L==c].max(0)) for c in cs]
  ymid=np.median([ (mn[1]+mx[1])/2 for _,mn,mx in info])
  top=sorted([i for i in info if (i[1][1]+i[2][1])/2>ymid],key=lambda i:i[1][0]);bot=sorted([i for i in info if (i[1][1]+i[2][1])/2<=ymid],key=lambda i:i[1][0])
  return [i[0] for i in top+bot]
def reatlas(P,UV,I,img,S,pad=3):
  W,H=img.size;ch=charts(I,len(P));nch=ch.max()+1
  u=UV[:,0]*W;v=UV[:,1]*H
  x0=np.full(nch,1e9);x1=np.full(nch,-1e9);y0=np.full(nch,1e9);y1=np.full(nch,-1e9)
  np.minimum.at(x0,ch,u);np.maximum.at(x1,ch,u);np.minimum.at(y0,ch,v);np.maximum.at(y1,ch,v)
  used=np.unique(ch[I.ravel()])
  bw=np.ceil(x1-x0)+2*pad;bh=np.ceil(y1-y0)+2*pad
  def pack(s):
    order=sorted(used,key=lambda c:-bh[c]);pos={};x=y=rowh=0
    for c in order:
      w=int(np.ceil(bw[c]*s))+2;h=int(np.ceil(bh[c]*s))+2
      if x+w>S:x=0;y+=rowh;rowh=0
      if y+h>S:return None
      pos[c]=(x,y,w,h);x+=w;rowh=max(rowh,h)
    return pos
  lo,hi=0.05,4.0
  for _ in range(22):
    m=(lo+hi)/2
    if pack(m):lo=m
    else:hi=m
  s=lo;pos=pack(s);out=Image.new('RGB',(S,S),(128,128,128));nUV=UV.copy()
  for c in used:
    X,Y,w,h=pos[c];cx0=x0[c]-pad;cy0=y0[c]-pad
    box=(int(np.floor(cx0)),int(np.floor(cy0)),int(np.ceil(cx0+bw[c])),int(np.ceil(cy0+bh[c])))
    crop=img.crop(box);tw=max(1,int(round((box[2]-box[0])*s)));th=max(1,int(round((box[3]-box[1])*s)))
    out.paste(crop.resize((tw,th),Image.LANCZOS),(X+1,Y+1))
    m=ch==c;nUV[m,0]=(X+1+(u[m]-box[0])*s)/S;nUV[m,1]=(Y+1+(v[m]-box[1])*s)/S
  return nUV,out,s
ESP=set();DX={};CELLS={}
if __name__=='__main__':
  src,dst=sys.argv[1],sys.argv[2];nomes=sys.argv[3].split(',');rots=[float(x) for x in sys.argv[4].split(',')];S=int(sys.argv[5]);cells=int(sys.argv[6])
  so=sys.argv[7].split(',') if len(sys.argv)>7 and sys.argv[7] else None
  if len(sys.argv)>8:ESP.update(sys.argv[8].split(','))
  if len(sys.argv)>9:CELLS.update({a.split('=')[0]:int(a.split('=')[1]) for a in sys.argv[9].split(',')})
  G=read(src);P0=G['P'].astype(np.float64);UV0=G['UV'].astype(np.float64);I0=G['I'];L=components(P0,I0)
  cs=ordem(P0,L)
  for k,c in enumerate(cs):
    if so and nomes[k] not in so:continue
    tri=(L==c)[I0[:,0]];Ic=I0[tri];used=np.unique(Ic);rm=-np.ones(len(P0),np.int64);rm[used]=np.arange(len(used))
    P=P0[used];UV=UV0[used];I=rm[Ic]
    nUV,img,s=reatlas(P,UV,I,G['img'],S)
    P=prep(P,None,None,rots[k])
    if nomes[k] in ESP:
      # o lado escondido na imagem saiu inventado pelo Tripo: usa o lado bom (x<meio) espelhado
      xm=float(np.median(P[:,0]))+DX.get(nomes[k],0);t=P[I].mean(1)[:,0]<=xm;Ib=I[t]
      P2=P.copy();P2[:,0]=2*xm-P2[:,0];n=len(P)
      P=np.r_[P,P2];nUV=np.r_[nUV,nUV];I=np.r_[Ib,Ib[:,::-1]+n]
      used=np.unique(I);rm=-np.ones(len(P),np.int64);rm[used]=np.arange(len(used));P=P[used];nUV=nUV[used];I=rm[I]
      P=prep(P,None,None,0)
    r=rebake(P,nUV,I,img,CELLS.get(nomes[k],cells),S,82,f'{dst}/{nomes[k]}.glb')
    print(nomes[k],'escala textura',round(s,3),'bytes/tri/verts',r,flush=True)
