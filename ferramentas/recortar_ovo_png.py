"""GARRO — recorta um ovo desenhado em fundo branco (PNG) e grava o sprite .webp com transparência + contorno (hull) para data/lendarios.json.
Uso: python3 ferramentas/recortar_ovo_png.py entrada.png saida.webp  → imprime o JSON {w,h,hull,img}
O fundo branco é achado por inundação a partir das bordas; nas bordas do desenho (chamas, gotas, vento) a cor é "desmisturada" do branco,
o que deixa os efeitos semitransparentes em vez de com halo branco."""
import sys,json,numpy as np,cv2
from PIL import Image
from scipy import ndimage
def recorta(src,dst,alt=256):
  a=np.asarray(Image.open(src).convert('RGB')).astype(np.float32);H,W=a.shape[:2]
  claro=a.min(2)>232
  lab,_=ndimage.label(claro);borda=np.unique(np.r_[lab[0],lab[-1],lab[:,0],lab[:,-1]]);borda=borda[borda>0]
  fundo=np.isin(lab,borda)
  dist=ndimage.distance_transform_edt(~fundo)          # distância até o fundo
  # alfa: quanto o pixel se afasta do branco (só perto do fundo); longe do fundo é opaco
  al=np.clip((255-a.min(2))/255*2.2,0,1)
  al=np.where(fundo,0,np.where(dist>28,1,al))
  al=ndimage.gaussian_filter(al,.6)
  F=np.where(al[...,None]>.02,(a-(1-al[...,None])*255)/np.maximum(al[...,None],.02),a)
  rgba=np.dstack([np.clip(F,0,255),al*255]).astype(np.uint8)
  ys,xs=np.where(al>.06);x0,x1,y0,y1=xs.min(),xs.max(),ys.min(),ys.max()
  im=Image.fromarray(rgba).crop((max(0,x0-2),max(0,y0-2),min(W,x1+3),min(H,y1+3)))
  w,h=im.size;sc=alt/h;im=im.resize((round(w*sc),alt),Image.LANCZOS)
  m=(np.asarray(im)[...,3]>110).astype(np.uint8);cs,_=cv2.findContours(m,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
  hull=cv2.convexHull(max(cs,key=cv2.contourArea));ap=cv2.approxPolyDP(hull,2.0,True)[:,0,:]
  while len(ap)>16:ap=cv2.approxPolyDP(hull,2.0+(len(ap)-16)*1.2,True)[:,0,:]
  im.save(dst,'WEBP',quality=85,method=6);w,h=im.size
  return {'w':w,'h':h,'hull':[[round(float(x)/w,3),round(float(y)/h,3)] for x,y in ap]}
if __name__=='__main__':print(json.dumps(recorta(sys.argv[1],sys.argv[2])))
