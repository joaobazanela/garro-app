import sys,os;sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
# Separa as folhas do Tripo pelos PEDAÇOS LIGADOS da malha (cada bicho é um pedaço), em vez de cortar por região:
# na folha os bichos se sobrepõem, e o corte por região misturava partes de um no outro (cores misturadas).
import sys,numpy as np

import quadrantes as Q
def plano(G,P0,I0):
  # só o plano do fundo da folha (claro, numa profundidade só). O pelo branco virado para a frente NÃO é lixo
  # (a regra antiga tirava o pelo branco e deixava buracos/manchas escuras no peito).
  img=np.asarray(G['img']);H,W=img.shape[:2];uv=G['UV'][I0].mean(1)
  col=img[np.clip((uv[:,1]*H).astype(int),0,H-1),np.clip((uv[:,0]*W).astype(int),0,W-1)].astype(int)
  a=P0[I0];n=np.cross(a[:,1]-a[:,0],a[:,2]-a[:,0]);n=n/(np.linalg.norm(n,axis=1)[:,None]+1e-12)
  cl=(col.min(1)>140)&(col.max(1)-col.min(1)<55);C=a.mean(1);h,e=np.histogram(C[cl,2],bins=400);zp=(e[np.argmax(h)]+e[np.argmax(h)+1])/2
  br=(col.min(1)>200)&(col.max(1)-col.min(1)<35)
  return (cl&(np.abs(C[:,2]-zp)<.004)&(np.abs(n).max(1)>.97))|(br&(np.abs(n).max(1)>.985))  # plano do fundo e degraus brancos (faces retas)
def corta_comp(src,tlf,dst,grupos,pca=None,rot=-90,cells=150,so=None,lixo=True):
  tl=np.load(tlf);G=Q.read(src);P0=G['P'].astype(np.float64);UV0=G['UV'].astype(np.float64);I0=G['I'];LX=plano(G,P0,I0) if lixo else np.zeros(len(I0),bool);print('lixo',LX.sum())
  for nome,comps in grupos:
    if so and nome not in so:continue
    m=np.isin(tl,comps)&~LX;Ic=I0[m];used=np.unique(Ic);rm=-np.ones(len(P0),np.int64);rm[used]=np.arange(len(used));P,UV,I=P0[used],UV0[used],rm[Ic]
    nUV,img,s=Q.sep.reatlas(P,UV,I,G['img'],1024);r=Q.alinha(P,pca[nome]) if pca else rot;P=Q.prep(P,None,None,r);print(nome,'tris',len(I),'giro',round(r),flush=True)
    np.savez(f'{dst}/{nome}_hi.npz',P=P,UV=nUV,I=I);img.save(f'{dst}/{nome}_hi.png')
    print(nome,'→',Q.rebake(P,nUV,I,img,cells,1024,82,f'{dst}/{nome}.glb'),flush=True)
if __name__=='__main__':
  qual=sys.argv[1];so=sys.argv[2].split(',') if len(sys.argv)>2 and sys.argv[2] else None
  if qual=='leg':
    corta_comp('/mnt/user-data/uploads/fantasy_dragon_3d_model__1_.glb','/tmp/claude-0/fdr_tl.npy','/tmp/claude-0/novos/comp',
      [('lunaria',[0]),('solaris',[2,3,1]),('obsidragon',[4]),('noctalis',[5])],pca={'lunaria':-81,'noctalis':-60,'solaris':-84,'obsidragon':-53},so=so)
  else:
    corta_comp('/mnt/user-data/uploads/elemental_dragon_3d_model.glb','/tmp/claude-0/eld_tl.npy','/tmp/claude-0/novos/comp',
      [('infernyx',[3]),('abyssor',[6]),('zephyrax',[2]),('terravyn',[7])],so=so,lixo=False)
def leg_regiao(so=None,cells=150):
  # folha dos lendários (2×2, sem sobreposição): mantém o corte por região, mas o "lixo" só tira o plano do fundo
  # e só ficam os 4 pedaços grandes da malha (o degrau branco com a chama e o pedaço bege do canto são enfeites da folha)
  tl=np.load('/tmp/claude-0/fdr_tl.npy')
  def LX(G,P0,I0):
    C=P0[I0].mean(1);vela=(tl==0)&(C[:,0]>-.165)&(C[:,1]<.66)&(C[:,2]>-.02)  # vela branca com chama encostada na Lunária
    # Obsidragon e Noctalis não têm nada branco: o branco/cinza claro neles é degrau do fundo e a "lua" pendurada da folha
    img=np.asarray(G['img']);H,W=img.shape[:2];uv=G['UV'][I0].mean(1);col=img[np.clip((uv[:,1]*H).astype(int),0,H-1),np.clip((uv[:,0]*W).astype(int),0,W-1)].astype(int)
    branco=np.isin(tl,[4,5])&(col.min(1)>165)&(col.max(1)-col.min(1)<45)
    print('vela',int(vela.sum()),'branco',int(branco.sum()));return plano(G,P0,I0)|~np.isin(tl,[0,2,3,4,5])|vela|branco
  Q.lixo=LX;Y=.46;X=.05
  Q.corta('/mnt/user-data/uploads/fantasy_dragon_3d_model__1_.glb','/tmp/claude-0/novos/comp',[
    ('lunaria',lambda x,y,z:(y>Y)&(x<X)),('obsidragon',lambda x,y,z:(y>Y)&(x>=X)),
    ('solaris',lambda x,y,z:(y<=Y)&(x<X)),('noctalis',lambda x,y,z:(y<=Y)&(x>=X))],so=so,cells=cells,pca={'lunaria':-81,'obsidragon':-53,'solaris':-84,'noctalis':-60})
def rebake2(P,UV,I,img,cells,S,q,out):
  # como nb.rebake, mas a UV de cada canto vem da PROJEÇÃO no triângulo original mais perto (do mesmo pedaço de UV),
  # e não do vértice mais perto: some o salpicado de cores trocadas
  from nb import charts,decimate,write_compact,cKDTree,Image
  ch=charts(I,len(P));nP,_,nI=decimate(P,UV,I,cells,uvq=1)
  A=nP[nI];ar=np.linalg.norm(np.cross(A[:,1]-A[:,0],A[:,2]-A[:,0]),axis=1);nI=nI[ar>1e-10]
  tc=P[I].mean(1);tch=ch[I[:,0]];tt=cKDTree(tc);_,ti=tt.query(nP[nI].mean(1),workers=-1);fch=tch[ti]
  BIG=1e3;t4=cKDTree(np.c_[tc,tch*BIG]);corner=nP[nI].reshape(-1,3);cc=np.repeat(fch,3)
  _,k8=t4.query(np.c_[corner,cc*BIG],k=6,workers=-1)
  best=np.full(len(corner),1e9);buv=np.zeros((len(corner),2))
  for j in range(k8.shape[1]):
    t=I[k8[:,j]];a,b,c=P[t[:,0]],P[t[:,1]],P[t[:,2]];v0,v1,v2=b-a,c-a,corner-a
    d00=(v0*v0).sum(1);d01=(v0*v1).sum(1);d11=(v1*v1).sum(1);d20=(v2*v0).sum(1);d21=(v2*v1).sum(1);den=d00*d11-d01*d01+1e-20
    v=(d11*d20-d01*d21)/den;w=(d00*d21-d01*d20)/den;v=np.clip(v,0,1);w=np.clip(w,0,1);s=v+w;over=s>1;v[over]/=s[over];w[over]/=s[over];u=1-v-w
    pt=a*u[:,None]+b*v[:,None]+c*w[:,None];dist=np.linalg.norm(pt-corner,axis=1);uvp=UV[t[:,0]]*u[:,None]+UV[t[:,1]]*v[:,None]+UV[t[:,2]]*w[:,None]
    m=dist<best;best[m]=dist[m];buv[m]=uvp[m]
  key=np.c_[nI.ravel(),np.round(buv*8192).astype(np.int64)];uq,inv=np.unique(key,axis=0,return_inverse=True);inv=inv.ravel()
  first=np.zeros(len(uq),np.int64);first[inv]=np.arange(len(inv))
  VP=nP[uq[:,0]];VU=buv[first];VI=inv.reshape(-1,3)
  im=img.resize((S,S),Image.LANCZOS) if img.size[0]!=S else img
  return write_compact(out,VP.astype(np.float32),VU.astype(np.float64),VI,im,q=q),len(VI),len(VP)
def simplifica(P,I,alvo):
  # simplificação por quádricas (meshoptimizer): mantém as camadas de pelo separadas (o agrupamento de vértices furava e salpicava)
  import ctypes
  L=ctypes.CDLL(os.environ.get('LIBMESHOPT') or os.path.join(os.path.dirname(os.path.abspath(__file__)),'libmeshopt.so'));L.meshopt_simplify.restype=ctypes.c_size_t
  key=np.round(P,6);uq,w=np.unique(key,axis=0,return_inverse=True);w=w.ravel();V=np.ascontiguousarray(uq.astype(np.float32));J=np.ascontiguousarray(w[I].astype(np.uint32).ravel())
  out=np.zeros_like(J);err=ctypes.c_float(0)
  n=L.meshopt_simplify(out.ctypes.data_as(ctypes.c_void_p),J.ctypes.data_as(ctypes.c_void_p),ctypes.c_size_t(len(J)),V.ctypes.data_as(ctypes.c_void_p),ctypes.c_size_t(len(V)),ctypes.c_size_t(12),
    ctypes.c_size_t(int(alvo)*3),ctypes.c_float(0.05),ctypes.c_uint(0),ctypes.byref(err))
  T=out[:n].reshape(-1,3).astype(np.int64);used=np.unique(T);rm=-np.ones(len(V),np.int64);rm[used]=np.arange(len(used))
  return V[used].astype(np.float64),rm[T]
def rebake3(P,UV,I,img,cells,S,q,out,alvo=80000):
  from nb import charts,write_compact,cKDTree,Image
  # só o corpo: grade 3D com os triângulos; pedaços que não encostam no corpo (com folga de 1 célula) saem
  from scipy import ndimage
  C=P[I].mean(1);mn=C.min(0);ext=(C.max(0)-mn).max();G_=200;qv=np.clip(((C-mn)/ext*G_).astype(int),0,G_)
  occ=np.zeros((G_+1,)*3,bool);occ[qv[:,0],qv[:,1],qv[:,2]]=True;occ=ndimage.binary_dilation(occ)
  lab,nl=ndimage.label(occ,structure=np.ones((3,3,3)));tl=lab[qv[:,0],qv[:,1],qv[:,2]];cnt=np.bincount(tl);cnt[0]=0;big=np.argmax(cnt)
  keep=np.isin(tl,[c for c in range(1,nl+1) if c==big or cnt[c]>.05*cnt[big]]);print('corpo: tirados',int((~keep).sum()),'triângulos soltos')
  I=I[keep];used=np.unique(I);rm=-np.ones(len(P),np.int64);rm[used]=np.arange(len(used));P,UV,I=P[used],UV[used],rm[I]
  ch=charts(I,len(P));nP,nI=simplifica(P,I,alvo)
  # tira pedacinhos soltos fora do corpo (fios do degrau do fundo, enfeites da folha)
  lab=charts(nI,len(nP));tl2=lab[nI[:,0]];cnt=np.bincount(tl2);big=np.argmax(cnt);vb=np.unique(nI[tl2==big]);mn,mx=nP[vb].min(0),nP[vb].max(0)
  fora=[c for c in np.nonzero(cnt)[0] if c!=big and cnt[c]<.02*cnt[big] and not np.all((nP[np.unique(nI[tl2==c])].mean(0)>mn)&(nP[np.unique(nI[tl2==c])].mean(0)<mx))]
  nI=nI[~np.isin(tl2,fora)];print('soltos fora',len(fora))
  A=nP[nI];ar=np.linalg.norm(np.cross(A[:,1]-A[:,0],A[:,2]-A[:,0]),axis=1);nI=nI[ar>1e-12]
  tc=P[I].mean(1);tch=ch[I[:,0]];tt=cKDTree(tc);_,ti=tt.query(nP[nI].mean(1),workers=-1);fch=tch[ti]
  BIG=1e3;t4=cKDTree(np.c_[tc,tch*BIG]);corner=nP[nI].reshape(-1,3);cc=np.repeat(fch,3)
  _,k8=t4.query(np.c_[corner,cc*BIG],k=6,workers=-1)
  best=np.full(len(corner),1e9);buv=np.zeros((len(corner),2))
  for j in range(k8.shape[1]):
    t=I[k8[:,j]];a,b,c=P[t[:,0]],P[t[:,1]],P[t[:,2]];v0,v1,v2=b-a,c-a,corner-a
    d00=(v0*v0).sum(1);d01=(v0*v1).sum(1);d11=(v1*v1).sum(1);d20=(v2*v0).sum(1);d21=(v2*v1).sum(1);den=d00*d11-d01*d01+1e-20
    v=(d11*d20-d01*d21)/den;w=(d00*d21-d01*d20)/den;v=np.clip(v,0,1);w=np.clip(w,0,1);s=v+w;over=s>1;v[over]/=s[over];w[over]/=s[over];u=1-v-w
    pt=a*u[:,None]+b*v[:,None]+c*w[:,None];dist=np.linalg.norm(pt-corner,axis=1);uvp=UV[t[:,0]]*u[:,None]+UV[t[:,1]]*v[:,None]+UV[t[:,2]]*w[:,None]
    m=dist<best;best[m]=dist[m];buv[m]=uvp[m]
  key=np.c_[nI.ravel(),np.round(buv*8192).astype(np.int64)];uq,inv=np.unique(key,axis=0,return_inverse=True);inv=inv.ravel()
  first=np.zeros(len(uq),np.int64);first[inv]=np.arange(len(inv))
  VP=nP[uq[:,0]];VU=buv[first];VI=inv.reshape(-1,3)
  im=img.resize((S,S),Image.LANCZOS) if img.size[0]!=S else img
  return write_compact(out,VP.astype(np.float32),VU.astype(np.float64),VI,im,q=q),len(VI),len(VP)
