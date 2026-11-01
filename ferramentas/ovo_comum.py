"""Desenha o ovo comum da Máquina de Ovos (branco com pintinhas, fosco) -> img/lendarios/ovo_comum.webp
e imprime w, h e o contorno (hull) para o data/lendarios.json. Uso: python3 ferramentas/ovo_comum.py"""
import numpy as np,json,os
from PIL import Image
S=3;W,H=170,230;w,h=W*S,H*S
y,x=np.mgrid[0:h,0:w].astype(float)
cx,cy=w/2,h*.5;ry=h*.46
t=(y-cy)/ry                                    # -1 topo .. 1 base
rx=w*.46*np.sqrt(np.clip(1-t**2,0,1))*(1-.13*np.clip(-t,0,1))   # topo mais fino
inside=np.abs(x-cx)<=rx
nx=np.where(rx>0,(x-cx)/np.maximum(rx,1),0);nz=np.sqrt(np.clip(1-nx**2-(t*.55)**2,0,1))
L=np.clip(.55+.45*(nz*.75-nx*.35-t*.25),0,1)    # luz de cima à esquerda
base=np.array([247,240,226.]);sombra=np.array([196,180,160.])
img=sombra+(base-sombra)*L[...,None]
rng=np.random.default_rng(7)
for k in range(70):                             # pintinhas marrons
  px,py=rng.uniform(.1,.9)*w,rng.uniform(.12,.95)*h;r=rng.uniform(2.2,6.5)*S*(1 if k%4 else 1.6)
  d=((x-px)/(r*rng.uniform(.8,1.3)))**2+((y-py)/r)**2
  a=np.clip(1.4-d,0,1)*rng.uniform(.35,.75)
  img=img*(1-a[...,None])+np.array([150,105,70.])*a[...,None]
hl=np.exp(-(((x-(cx-w*.17))/(w*.08))**2+((y-(cy-h*.22))/(h*.07))**2))*.35   # brilho fosco pequeno
img=img+(255-img)*hl[...,None]
edge=np.clip((rx-np.abs(x-cx))/(2.5*S),0,1)*np.clip((ry-np.abs(y-cy))/(2.5*S),0,1)
rgba=np.dstack([np.clip(img,0,255),np.where(inside,edge,0)*255]).astype(np.uint8)
im=Image.fromarray(rgba,'RGBA').resize((W,H),Image.LANCZOS)
a=np.asarray(im)[...,3];ys,xs=np.nonzero(a>40);x0,x1,y0,y1=xs.min(),xs.max(),ys.min(),ys.max()
im=im.crop((x0,y0,x1+1,y1+1));cw,chh=im.size
out=os.path.join(os.path.dirname(__file__),'..','img','lendarios','ovo_comum.webp');im.save(out,'WEBP',quality=88)
hull=[]
for k in range(16):
  ang=2*np.pi*k/16;bx,by=np.cos(ang),np.sin(ang);A=np.asarray(im)[...,3]>40;yy,xx=np.nonzero(A)
  i=np.argmax(xx*bx+yy*by);hull.append([round(xx[i]/(cw-1),3),round(yy[i]/(chh-1),3)])
print(json.dumps({'w':cw,'h':chh,'hull':hull}))
