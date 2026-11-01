# Recorta os ovos e as cartas dos lendários das duas folhas de arte enviadas (5 colunas x 2 linhas).
# Ovo: fundo removido com o modelo u2net (onnxruntime; arquivo u2net.onnx do projeto rembg, baixado à parte).
# Uso: python3 ferramentas/lendarios_ovos.py folha_ovos.png folha_lendarios.png caminho/u2net.onnx
import sys,os,numpy as np,cv2,onnxruntime as ort
from PIL import Image
OUT=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','img','lendarios')
NOMES=['obsidragon','lunaria','incendyr','verdantis','noctalis','ocearion','terralith','solaris','crystalyn','astrakai']
COLS=[(0,258),(264,521),(529,786),(793,1051),(1058,1312)]
ovos,cartas,modelo=sys.argv[1:4]
sess=ort.InferenceSession(modelo,providers=['CPUExecutionProvider']);inp=sess.get_inputs()[0].name
def mascara(im):
  a=np.asarray(im.resize((320,320),Image.LANCZOS)).astype(np.float32)/255
  a=((a-[0.485,0.456,0.406])/[0.229,0.224,0.225]).transpose(2,0,1)[None].astype(np.float32)
  m=sess.run(None,{inp:a})[0][0,0];m=(m-m.min())/(m.max()-m.min()+1e-6)
  return np.asarray(Image.fromarray((m*255).astype(np.uint8)).resize(im.size,Image.LANCZOS))
S=Image.open(ovos).convert('RGB')
for k,n in enumerate(NOMES):
  (x0,x1),(y0,y1)=COLS[k%5],[(0,505),(590,1040)][k//5];c=S.crop((x0,y0,x1,y1));al=mascara(c)
  num,lab,st,_=cv2.connectedComponentsWithStats((al>60).astype(np.uint8),8);big=1+np.argmax(st[1:,cv2.CC_STAT_AREA])
  keep=cv2.dilate((lab==big).astype(np.uint8),np.ones((7,7),np.uint8));a=np.dstack([np.asarray(c),(al*keep).astype(np.uint8)])
  o=Image.fromarray(a);o=o.crop(o.getchannel('A').point(lambda v:255 if v>40 else 0).getbbox());o.thumbnail((256,256),Image.LANCZOS)
  o.save(os.path.join(OUT,f'ovo_{n}.webp'),quality=88,method=6)
C=Image.open(cartas).convert('RGB')
for k,n in enumerate(NOMES):
  (x0,x1),(y0,y1)=COLS[k%5],[(0,535),(605,1082)][k//5];c=C.crop((x0,y0,x1,y1));c.thumbnail((240,500),Image.LANCZOS)
  c.save(os.path.join(OUT,f'carta_{n}.webp'),quality=84,method=6)
