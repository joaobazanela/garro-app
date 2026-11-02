# Uniformiza as cores da textura de um .glb (troca as manchas de cor "de outro bicho" pela cor do próprio bicho).
import sys,json,struct,io,numpy as np
from PIL import Image
def le(f):
  d=open(f,'rb').read();l=struct.unpack('<I',d[12:16])[0];j=json.loads(d[20:20+l]);o=20+l;bl=struct.unpack('<I',d[o:o+4])[0];b=d[o+8:o+8+bl];return j,b
def grava(f,j,b,views):
  out=b'';nv=[]
  for k,v in enumerate(j['bufferViews']):
    dat=views.get(k,b[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']]);v2=dict(v);v2['byteOffset']=len(out);v2['byteLength']=len(dat);out+=dat+b'\0'*((-len(dat))%4);nv.append(v2)
  j['bufferViews']=nv;j['buffers']=[{'byteLength':len(out)}]
  js=json.dumps(j,separators=(',',':')).encode();js+=b' '*((-len(js))%4)
  tot=12+8+len(js)+8+len(out);open(f,'wb').write(struct.pack('<III',0x46546C67,2,tot)+struct.pack('<I',len(js))+b'JSON'+js+struct.pack('<I',len(out))+b'BIN\0'+out)
def hsv(a):
  r,g,b=a[...,0],a[...,1],a[...,2];mx=a.max(-1);mn=a.min(-1);d=mx-mn+1e-9
  h=np.where(mx==r,((g-b)/d)%6,np.where(mx==g,(b-r)/d+2,(r-g)/d+4))*60;s=np.where(mx>0,d/(mx+1e-9),0);return h,s,mx
def rgb(h,s,v):
  c=v*s;x=c*(1-np.abs((h/60)%2-1));m=v-c;z=np.zeros_like(h);k=(h//60).astype(int)%6
  R=np.choose(k,[c,x,z,z,x,c]);G=np.choose(k,[x,c,c,x,z,z]);B=np.choose(k,[z,z,x,c,c,x]);return np.stack([R+m,G+m,B+m],-1)
REGRAS={ # (faixa de matiz que fica, matiz nova, saturação mínima p/ trocar, fator de saturação)
 'zephyrax':(lambda h:(h>=165)&(h<=255),205,.16,.55),
 'terravyn':(lambda h:~((h>=150)&(h<=265)),80,.2,1.0),
 'abyssor':(lambda h:~((h<45)|(h>325)),210,.3,1.0),
 'infernyx':(lambda h:~((h>=165)&(h<=260)),18,.22,1.0)}
def recolore(f,nome):
  j,b=le(f);views={}
  for im in j['images']:
    v=j['bufferViews'][im['bufferView']];raw=b[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']]
    img=Image.open(io.BytesIO(raw)).convert('RGB');a=np.asarray(img).astype(np.float64)/255;h,s,vv=hsv(a)
    fica,hn,smin,fs=REGRAS[nome];troca=(~fica(h))&(s>smin)
    h2=np.where(troca,hn,h);s2=np.where(troca,s*fs,s);o=rgb(h2,s2,vv)
    buf=io.BytesIO();Image.fromarray((o*255).clip(0,255).astype(np.uint8)).save(buf,'JPEG',quality=85);views[im['bufferView']]=buf.getvalue()
    print(nome,'pixels trocados',round(troca.mean()*100,1),'%')
  grava(f,j,b,views)
if __name__=='__main__':
  for f in sys.argv[2:]:recolore(f,sys.argv[1])
