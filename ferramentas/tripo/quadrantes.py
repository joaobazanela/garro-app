import sys,os;sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
# Separa folhas 2x2 do Tripo por regiões (função de atribuição por triângulo), limpa pedaços soltos, gira e regrava compacto.
import sys,numpy as np

from glbio import read
from bake import prep
from nb import rebake
from compact import clean
import importlib.util
spec=importlib.util.spec_from_file_location('sep',__import__('os').path.join(__import__('os').path.dirname(__file__),'separar.py'));sep=importlib.util.module_from_spec(spec);spec.loader.exec_module(sep)
def lixo(G,P0,I0):
  # pedaços do fundo branco que o Tripo grudou (planos brancos virados para a câmera da folha)
  img=np.asarray(G['img']);H,W=img.shape[:2];uv=G['UV'][I0].mean(1)
  col=img[np.clip((uv[:,1]*H).astype(int),0,H-1),np.clip((uv[:,0]*W).astype(int),0,W-1)].astype(int)
  a=P0[I0];n=np.cross(a[:,1]-a[:,0],a[:,2]-a[:,0]);ar=np.linalg.norm(n,axis=1);n=n/(ar[:,None]+1e-12)
  br=(col.min(1)>200)&(col.max(1)-col.min(1)<35);cl=(col.min(1)>140)&(col.max(1)-col.min(1)<55)
  # o fundo da folha é um plano numa profundidade só: acha essa profundidade (moda do z dos claros) e tira os claros colados nela
  C=a.mean(1);h,e=np.histogram(C[cl,2],bins=400);zp=(e[np.argmax(h)]+e[np.argmax(h)+1])/2;print('plano do fundo z',round(float(zp),4))
  plano=cl&(np.abs(C[:,2]-zp)<.008)&((np.abs(n[:,2])>.7)|(np.abs(n).max(1)>.9))
  return (br&(np.abs(n[:,2])>.8)&(ar>2.5e-6))|plano  # planos de frente e as bordas retas do quadro
def alinha(P,giro):
  # eixo comprido do corpo (no chão) vira o eixo z; giro extra (graus) escolhe para que lado a cabeça fica
  c=P[:,[0,2]]-P[:,[0,2]].mean(0);w,v=np.linalg.eigh(np.cov(c.T));ax=v[:,np.argmax(w)];ang=np.degrees(np.arctan2(ax[0],ax[1]))
  return ang+giro
def corta(src,dst,regras,rot=-90,S=1024,cells=220,keep=.05,so=None,pca=None):
  G=read(src);P0=G['P'].astype(np.float64);UV0=G['UV'].astype(np.float64);I0=G['I'];C=P0[I0].mean(1);LX=lixo(G,P0,I0);print('lixo',LX.sum())
  for nome,f in regras:
    if so and nome not in so:continue
    m=f(C[:,0],C[:,1],C[:,2])&~LX;Ic=I0[m];used=np.unique(Ic);rm=-np.ones(len(P0),np.int64);rm[used]=np.arange(len(used))
    P,UV,I=P0[used],UV0[used],rm[Ic]
    # só fica o bicho: o maior pedaço e os pedaços que estão dentro da caixa dele (sobras do fundo e pontas dos vizinhos saem)
    from bake import components
    L=components(P,I);tl=L[I[:,0]];cnt=np.bincount(tl);big=np.argmax(cnt);vb=np.unique(I[tl==big]);mn,mx=P[vb].min(0),P[vb].max(0);pad=(mx-mn)*.04
    ok=np.zeros(len(cnt),bool)
    for c in np.nonzero(cnt)[0]:
      vc=np.unique(I[tl==c]);cc=P[vc].mean(0);ok[c]=c==big or (cnt[c]>=30 and np.all(cc>mn-pad) and np.all(cc<mx+pad) and np.all(P[vc].min(0)>mn-pad*3) and np.all(P[vc].max(0)<mx+pad*3))
    I=I[ok[tl]];used=np.unique(I);r2=-np.ones(len(P),np.int64);r2[used]=np.arange(len(used));P,UV,I=P[used],UV[used],r2[I]
    print(nome,'pedaços',len(np.nonzero(cnt)[0]),'ficaram',int(ok.sum()))
    nUV,img,s=sep.reatlas(P,UV,I,G['img'],S);r=alinha(P,pca[nome]) if pca else rot;P=prep(P,None,None,r);print(nome,'giro',round(r))
    print(nome,len(I),'→',rebake(P,nUV,I,img,cells,S,82,f'{dst}/{nome}.glb'),flush=True)
if __name__=='__main__':
  import json
  qual=sys.argv[1];so=sys.argv[2].split(',') if len(sys.argv)>2 and sys.argv[2] else None;CE=int(sys.argv[3]) if len(sys.argv)>3 else 150
  GIRO=json.loads(sys.argv[4]) if len(sys.argv)>4 else {'lunaria':0,'obsidragon':0,'solaris':0,'noctalis':0}
  if qual=='leg':
    Y=.46;X=.05
    corta('/mnt/user-data/uploads/fantasy_dragon_3d_model__1_.glb','/tmp/claude-0/novos/leg',[
      ('lunaria',lambda x,y,z:(y>Y)&(x<X)),('obsidragon',lambda x,y,z:(y>Y)&(x>=X)),
      ('solaris',lambda x,y,z:(y<=Y)&(x<X)),('noctalis',lambda x,y,z:(y<=Y)&(x>=X))],so=so,cells=CE,pca=GIRO)
  else:
    Y=.36
    corta('/mnt/user-data/uploads/elemental_dragon_3d_model.glb','/tmp/claude-0/novos/epi',[
      ('infernyx',lambda x,y,z:(y>Y)&((z>0)|(x<-.12))),('abyssor',lambda x,y,z:(y>Y)&~((z>0)|(x<-.12))),
      ('zephyrax',lambda x,y,z:(y<=Y)&((z>0)|(x<-.12))),('terravyn',lambda x,y,z:(y<=Y)&~((z>0)|(x<-.12)))],so=so,rot=-90,cells=CE)
