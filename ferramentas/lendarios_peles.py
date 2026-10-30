# Pele (cor) e brilho dos 10 lendários: pega a textura da pelúcia base (dentro do .glb) e repinta.
# Uso: python3 ferramentas/lendarios_peles.py [nome ...]   (grava em img/lendarios/<nome>.jpg e <nome>_brilho.jpg)
import os,tempfile
AQUI=os.path.dirname(os.path.abspath(__file__));REPO=os.path.join(AQUI,'..');TEX=tempfile.mkdtemp()
import json,struct,sys
def glb(path):
  b=open(path,'rb').read();assert b[:4]==b'glTF'
  off=12;J=None;B=None
  while off<len(b):
    ln,t=struct.unpack('<II',b[off:off+8]);c=b[off+8:off+8+ln]
    if t==0x4E4F534A:J=json.loads(c)
    elif t==0x004E4942:B=c
    off+=8+ln
  return J,B
def extrai(names):
 for name in names:
  J,B=glb(os.path.join(REPO,'models',name+'.glb'))
  pass #'meshes',len(J['meshes']),'mats',len(J.get('materials',[])),'imgs',len(J.get('images',[])),[m.get('pbrMetallicRoughness',{}).get('baseColorTexture') for m in J.get('materials',[])])
  for k,im in enumerate(J.get('images',[])):
    bv=J['bufferViews'][im['bufferView']];data=B[bv.get('byteOffset',0):bv.get('byteOffset',0)+bv['byteLength']]
    ext='png' if 'png' in im['mimeType'] else 'jpg';open(os.path.join(TEX,f'{name}_{k}.{ext}'),'wb').write(data)

import numpy as np,sys,os
from PIL import Image,ImageFilter
OUT=os.path.join(REPO,'img','lendarios')+'/'
def load(n):return np.asarray(Image.open(os.path.join(TEX,f'{n}.jpg')).convert('RGB')).astype(np.float32)/255
def hsv(a):
  r,g,b=a[...,0],a[...,1],a[...,2];mx=a.max(-1);mn=a.min(-1);d=mx-mn+1e-6
  h=np.where(mx==r,((g-b)/d)%6,np.where(mx==g,(b-r)/d+2,(r-g)/d+4))*60;s=np.where(mx>0,d/(mx+1e-6),0);return h,s,mx
def lum(a):return a[...,0]*.299+a[...,1]*.587+a[...,2]*.114
def hexc(c):c=c.lstrip('#');return np.array([int(c[i:i+2],16)/255 for i in (0,2,4)],np.float32)
def grad(t,stops):
  # stops: [(pos,'#hex'),...]
  t=np.clip(t,0,1);ps=np.array([p for p,_ in stops]);cs=np.stack([hexc(c) for _,c in stops])
  out=np.zeros(t.shape+(3,),np.float32)
  for k in range(3):out[...,k]=np.interp(t,ps,cs[:,k])
  return out
def noise(shape,cell,seed):
  rng=np.random.default_rng(seed);g=rng.random((shape[0]//cell+2,shape[1]//cell+2)).astype(np.float32)
  im=Image.fromarray((g*255).astype(np.uint8)).resize((shape[1]+cell*2,shape[0]+cell*2),Image.BICUBIC)
  return np.asarray(im).astype(np.float32)[:shape[0],:shape[1]]/255
def stretch(L,lo=2,hi=98):a,b=np.percentile(L,[lo,hi]);return np.clip((L-a)/(b-a+1e-6),0,1)
def mix(a,b,m):m=m[...,None];return a*(1-m)+b*m
def save(n,col,glow,gk=1.0):
  Image.fromarray((np.clip(col,0,1)*255).astype(np.uint8)).save(OUT+n+'.jpg',quality=80,optimize=True)
  if glow is not None:
    g=np.clip(glow*gk,0,1);Image.fromarray((g*255).astype(np.uint8)).resize((512,512),Image.LANCZOS).save(OUT+n+'_brilho.jpg',quality=78,optimize=True)
def olhos(src,col):
  # preserva olhos (bem escuros e pequenos realces brancos ficam iguais)
  L=lum(src);h,s,v=hsv(src);m=((L<.07)).astype(np.float32);return mix(col,src,m)

def obsidragon():
  a=load('draksel_0');h,s,v=hsv(a);L=stretch(lum(a))
  tan=((h>20)&(h<55)&(s<.55)&(lum(a)>.42)).astype(np.float32)
  tan=np.asarray(Image.fromarray((tan*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))).astype(np.float32)/255
  preto=grad(L,[(0,'#07070a'),(.45,'#17151a'),(.75,'#2c2830'),(.92,'#6a5a3a'),(1,'#d9b25a')])
  ouro=grad(L,[(0,'#5a3c10'),(.4,'#a8761c'),(.75,'#e3b440'),(1,'#fff0a0')])
  c=mix(preto,ouro,tan)
  n=noise(L.shape,9,1);fis=((n>.62)&(n<.66)&(tan<.3)).astype(np.float32)  # fendas douradas
  fis=np.asarray(Image.fromarray((fis*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1))).astype(np.float32)/255
  c=mix(c,grad(L,[(0,'#c88a20'),(1,'#ffd76a')]),fis*.85)
  glow=(fis*.9+tan*.12)[...,None]*hexc('#ffb83a')
  save('obsidragon',olhos(a,c),glow)
def lunaria():
  a=load('glacien_0');h,s,v=hsv(a);L=stretch(lum(a),1,99)
  azul=((h>185)&(h<250)&(s>.35)).astype(np.float32)
  branco=grad(L,[(0,'#6a7aa0'),(.3,'#c8d4ee'),(.6,'#f4f7ff'),(1,'#ffffff')])
  az=grad(L,[(0,'#0a2a8a'),(.45,'#1a6aff'),(.8,'#5ad0ff'),(1,'#e0faff')])
  c=mix(branco,az,np.clip(azul*1.2,0,1))
  n=noise(L.shape,5,2);sp=((n>.88)&(L>.45)).astype(np.float32)
  glow=(azul*np.clip(L,0,1)*.7+sp*.9)[...,None]*hexc('#6ad8ff')
  save('lunaria',olhos(a,c),glow)

def incendyr():
  a=load('ignovus_0');L=stretch(lum(a));n=noise(L.shape,7,3)
  t=np.clip(L*1.08+(n-.5)*.12,0,1)
  c=grad(t,[(0,'#2a0402'),(.25,'#7a0c06'),(.45,'#d8280a'),(.62,'#ff7a12'),(.78,'#ffc23a'),(.9,'#ffe98a'),(1,'#fffdf0')])
  quente=np.clip((t-.55)*2.2,0,1)
  glow=(quente*(.55+.45*n))[...,None]*hexc('#ff9a2a')
  save('incendyr',olhos(a,c),glow)

def verdantis():
  a=load('sylvorn_0');h,s,v=hsv(a);L=stretch(lum(a))
  n=noise(L.shape,6,4);n2=noise(L.shape,23,5)
  creme=((L>.68)&(s<.4)).astype(np.float32)
  escuro=(L<.25).astype(np.float32)  # chifres e sombras: tronco marrom
  verde=grad(np.clip(L*.8+n*.3-.08,0,1),[(0,'#12300e'),(.3,'#2f6420'),(.6,'#5e9a36'),(.85,'#94c858'),(1,'#d0e8a0')])
  verde=mix(verde,verde*np.array([1.12,.95,.62],np.float32),(n2>.62).astype(np.float32)*.7)
  cr=grad(L,[(0,'#8a7a5a'),(.6,'#ece2c6'),(1,'#fffaf0')])
  c=mix(verde,cr,creme*.9)
  c=mix(c,grad(L,[(0,'#2a1a0e'),(1,'#6a4a2a')]),escuro*.6)
  fl=((n>.94)&(creme<.5)).astype(np.float32)
  c=mix(c,np.ones_like(c)*hexc('#ffd0e4'),fl*.95)
  glow=(fl*.5)[...,None]*hexc('#e8ffb0')
  save('verdantis',olhos(a,c),glow)

def noctalis():
  a=load('umbros_0');h,s,v=hsv(a);L=stretch(lum(a))
  roxo=((h>250)&(h<330)&(s>.35)&(L>.35)).astype(np.float32)
  preto=grad(L,[(0,'#020104'),(.5,'#0a0712'),(.8,'#18122a'),(1,'#33284e')])
  vio=grad(L,[(0,'#3a0a7a'),(.5,'#9a3aff'),(1,'#f0d0ff')])
  c=mix(preto,vio,roxo)
  glow=(roxo*np.clip(L*1.5,0,1))[...,None]*hexc('#b060ff')
  save('noctalis',olhos(a,c),glow,1.4)

def ocearion():
  a=load('coralith_0');h,s,v=hsv(a);L=stretch(lum(a));n=noise(L.shape,9,6)
  cinza=(s<.28).astype(np.float32)
  tur=grad(L,[(0,'#04304a'),(.35,'#0a8ab8'),(.7,'#3ae6f0'),(1,'#e0feff')])
  # casco/corais: arco-íris (gira o tom com ruído)
  pal=np.stack([hexc('#ff6aa8'),hexc('#ffa04a'),hexc('#3ad8ff'),hexc('#7a6aff'),hexc('#4af0b0')])
  idx=(np.clip(n,0,.999)*5).astype(int);arco=pal[idx]*(.45+.7*L[...,None])
  c=mix(np.clip(arco,0,1),tur,cinza)
  # azul do corpo vira água-viva brilhante
  azul=((h>185)&(h<250)&(s>.3)).astype(np.float32)
  c=mix(c,grad(L,[(0,'#023a5a'),(.6,'#20c8ff'),(1,'#d8f8ff')]),azul*.8)
  sp=((noise(L.shape,4,13)>.88)&(cinza+azul>.5)).astype(np.float32)
  glow=(azul*np.clip(L,0,1)*.5+sp*.9)[...,None]*hexc('#5ff4ff')
  save('ocearion',olhos(a,c),glow)

def terralith():
  a=load('petrun_0');h,s,v=hsv(a);L=stretch(lum(a))
  musgo=((h>60)&(h<160)&(s>.3)).astype(np.float32)
  rocha=grad(L,[(0,'#0e0b09'),(.35,'#2e2721'),(.7,'#5e5246'),(1,'#a89884')])
  mg=grad(L,[(0,'#2a3a08'),(.6,'#6a9a1a'),(1,'#c8e060')])
  c=mix(rocha,mg,musgo)
  n=noise(L.shape,13,7);n2=noise(L.shape,5,8)
  run=(np.abs(n-.5)<.018)&(musgo<.3)
  run=run|((n2>.955)&(L<.6)&(musgo<.3))
  run=np.asarray(Image.fromarray((run*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.1))).astype(np.float32)/255
  run=np.clip(run*2.2,0,1)
  c=mix(c,np.ones_like(c)*hexc('#8ae0ff'),run)
  glow=run[...,None]*hexc('#2a9aff')
  save('terralith',olhos(a,c),glow,1.6)

def solaris():
  a=load('auren_evo_0');h,s,v=hsv(a);L=stretch(lum(a))
  ouro=((h>25)&(h<60)&(s>.4)).astype(np.float32)
  br=grad(L,[(0,'#8a7a6a'),(.4,'#e8e0d6'),(.8,'#fffaf2'),(1,'#ffffff')])
  au=grad(L,[(0,'#6a4208'),(.45,'#c8901a'),(.8,'#ffd04a'),(1,'#fff6c8')])
  c=mix(br,au,ouro*.95)
  glow=(ouro*np.clip(L*1.3,0,1)*.6)[...,None]*hexc('#ffd86a')
  save('solaris',olhos(a,c),glow)
def crystalyn():
  a=load('lumina_0');h,s,v=hsv(a);L=stretch(lum(a))
  sat=(s>.2).astype(np.float32);n=noise(L.shape,7,9)
  pal=np.stack([hexc('#ff6ad0'),hexc('#a46aff'),hexc('#5ac0ff'),hexc('#ff9ae8'),hexc('#7ae0ff')])
  idx=(np.clip(n,0,.999)*5).astype(int);base=pal[idx]
  cr=np.clip(base*(.5+.7*L[...,None])+(L[...,None]>.82)*.3,0,1)
  br=grad(L,[(0,'#8a7a9a'),(.4,'#f0eaf8'),(1,'#ffffff')])
  c=mix(br,cr,sat)
  sp=((noise(L.shape,4,10)>.86)&(sat>.5)).astype(np.float32)
  glow=(sat*.45+sp*.9)[...,None]*hexc('#ffb8ff')
  save('crystalyn',olhos(a,c),glow)

def astrakai():
  a=load('aquarim_evo_0');h,s,v=hsv(a);L=stretch(lum(a))
  claro=((s<.25)&(L>.6)).astype(np.float32)
  nav=grad(L,[(0,'#03051a'),(.4,'#0c1450'),(.75,'#24307e'),(1,'#5a6ac8')])
  cr=grad(L,[(0,'#8a7a5a'),(.6,'#efe2c0'),(1,'#fffaf0')])
  c=mix(nav,cr,claro*.9)
  rng=np.random.default_rng(11);st=(rng.random(L.shape)>.9965).astype(np.float32)
  st=np.asarray(Image.fromarray((st*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.1))).astype(np.float32)/255*4
  st=np.clip(st,0,1)*(1-claro)
  gal=noise(L.shape,30,12);neb=np.clip((gal-.6)*2.5,0,1)*(1-claro)
  c=mix(c,np.ones_like(c)*hexc('#7a3ab8'),neb*.45)
  ouro=((L>.85)&(claro<.5)).astype(np.float32)
  c=mix(c,np.ones_like(c)*hexc('#ffd24a'),ouro*.7)
  c=mix(c,np.ones_like(c)*hexc('#fffbe8'),st)
  glow=(st+ouro*.4)[...,None]*hexc('#ffe9a0')+neb[...,None]*.25*hexc('#8a4aff')
  save('astrakai',olhos(a,c),glow)
extrai(['draksel','glacien','ignovus','sylvorn','umbros','coralith','petrun','auren_evo','lumina','aquarim_evo'])
for f in (sys.argv[1:] or ['obsidragon','lunaria','incendyr','verdantis','noctalis','ocearion','terralith','solaris','crystalyn','astrakai']):globals()[f]();print('ok',f)
