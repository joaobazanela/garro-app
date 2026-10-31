# Gera os mapas 3D (vista de cima) das fases da Aventura e grava em data/aventura.json (campo "mapa3d" de cada fase).
# Unidades em metros do jogo (o bichinho grande tem ~1 de altura). O mapa vai de z=0 (início) até z=L (portal);
# x de -LARG/2 a +LARG/2. Rodar de novo SOBRESCREVE os mapas (os números ficam iguais com a mesma semente).
# Uso: python3 ferramentas/gerar_mapas_aventura.py
import json,math,os,random
LARG=26
def gera(n,f,seed=7,desafio=False):
  rnd=random.Random(seed*1009+n);chefe='chefe' in f
  L=64 if desafio else 58+n*6 if not chefe else 96
  # caminho sinuoso
  pts=[];x=0.0
  for z in range(0,L+1,6):
    if 6<z<L-6:x=max(-8,min(8,x+rnd.uniform(-4.5,4.5)))
    elif z>=L-6:x*=.4
    pts.append([round(x,2),float(z)])
  def dcam(px,pz):
    best=1e9
    for (ax,az),(bx,bz) in zip(pts,pts[1:]):
      vx,vz=bx-ax,bz-az;t=max(0,min(1,((px-ax)*vx+(pz-az)*vz)/(vx*vx+vz*vz)));best=min(best,math.hypot(px-(ax+t*vx),pz-(az+t*vz)))
    return best
  def xcam(z):
    for (ax,az),(bx,bz) in zip(pts,pts[1:]):
      if az<=z<=bz:return ax+(bx-ax)*(z-az)/(bz-az)
    return pts[-1][0]
  livre=[]  # áreas que não podem ter árvore (acampamentos, arena)
  livre.append((pts[-1][0] if not chefe else 0.0,L-2,5.2))  # diorama do portal
  # acampamentos de inimigos ao longo do caminho
  total=3 if desafio else 4+n if not chefe else 7;inim=f['inimigos'];camps=[];k=0
  fim=L-14 if not chefe else L-30
  nc=max(2,math.ceil(total/2));zs=[14+(fim-14)*q/(nc-1) for q in range(nc)]
  for q,z in enumerate(zs):
    cx=xcam(z)+rnd.uniform(-2.5,2.5);quant=min(2 if desafio else 3,total-k) if q<nc-1 else total-k
    if quant<=0:break
    grupo=[]
    for j in range(quant):
      i,lv=inim[k%len(inim)];k+=1;a=j/max(1,quant)*6.283+rnd.uniform(0,1)
      grupo.append([i,lv,round(cx+math.cos(a)*1.6,2),round(z+math.sin(a)*1.6,2)])
    camps.append({"x":round(cx,2),"z":round(z,2),"inimigos":grupo});livre.append((cx,z,3.5))
  arena=None
  if chefe:
    az=L-16;arena={"x":0.0,"z":float(az),"r":9.0};livre.append((0,az,10));pts[-1]=[0.0,float(L)];pts[-2][0]=0.0;pts[-3][0]*=.3
  # folhas douradas: fora do caminho, escondidas
  folhas=[];tent=0
  while len(folhas)<3:
    tent+=1;z=rnd.uniform(10,L-12);x=xcam(z)+rnd.choice([-1,1])*rnd.uniform(4.5,8.5)
    # longe dos acampamentos (nas fases finais elas ganham guardas próprios)
    if abs(x)<LARG/2-2 and all(math.hypot(x-a,z-b)>8 for a,b in folhas) and all(math.hypot(x-c['x'],z-c['z'])>(9.5 if tent<400 else 5) for c in camps):folhas.append([round(x,2),round(z,2)])
  # guardas: nas fases finais, folhas douradas vigiadas (elite + ajudante)
  ng=0 if n<6 or desafio else 1 if n<8 else 2
  lvmax=max(lv for _,lv in inim);forte=max(inim,key=lambda x:x[1])[0]
  # só vigia folhas longe dos acampamentos (para não juntar duas lutas numa só)
  longe=[f_ for f_ in folhas if all(math.hypot(f_[0]-c['x'],f_[1]-c['z'])>9 for c in camps)]
  for q in range(min(ng,len(longe))):
    fx,fz=longe[q];grupo=[[forte,lvmax,round(fx+1.2,2),round(fz,2),'elite']]
    if n>=8:i,lv=inim[q%len(inim)];grupo.append([i,lv,round(fx-1.2,2),round(fz+.6,2)])
    camps.append({"x":fx,"z":fz,"inimigos":grupo,"guarda":True});livre.append((fx,fz,3.2))
  # tipos: atiradores a partir da fase 3, curandeiro a partir da 8, elite também no último acampamento da fase 10
  cada=0 if n<3 or desafio else 4 if n<6 else 3;c=0
  for cp in camps:
    if cp.get('guarda'):continue
    for e in cp['inimigos']:
      c+=1
      if cada and c%cada==0:e.append('atirador')
  if n>=8 and not desafio:
    nor=[cp for cp in camps if not cp.get('guarda')];big=nor[len(nor)//2]
    for e in big['inimigos']:
      if len(e)==4:e.append('curandeiro');break
  if chefe and not desafio:
    last=[cp for cp in camps if not cp.get('guarda')][-1];e=last['inimigos'][0]
    if len(e)==4:e.append('elite')
  # menos morangos nas fases finais
  morangos=[]
  for q in range(3 if desafio else 4 if n<=3 else 3 if n<=6 else 2):
    z=rnd.uniform(8,L-8);x=xcam(z)+rnd.choice([-1,1])*rnd.uniform(2.2,3.4);morangos.append([round(x,2),round(z,2)])
  # árvores, pedras e cogumelos (fora do caminho, dos acampamentos e dos itens)
  arv,ped,cog=[],[],[]
  ocup=[(a,b,1.6) for a,b in folhas+morangos]
  def ok(x,z,r):
    if dcam(x,z)<2.9+r:return False
    if any(math.hypot(x-a,z-b)<rr+r for a,b,rr in livre):return False
    if any(math.hypot(x-a,z-b)<rr+r for a,b,rr in ocup):return False
    return True
  for _ in range(int(L*2.3)):
    x=rnd.uniform(-LARG/2+.5,LARG/2-.5);z=rnd.uniform(-2,L+2);t=rnd.random()
    s=rnd.uniform(.85,1.35)
    if t<.62:r=.55*s
    elif t<.85:r=.5*s
    else:r=.35*s
    if not ok(x,z,r):continue
    ocup.append((x,z,r+.4));(arv if t<.62 else ped if t<.85 else cog).append([round(x,2),round(z,2),round(s,2)])
  # borda: fileira de árvores dos dois lados e no começo
  for z in range(-2,L+3,2):
    for sx in (-1,1):arv.append([round(sx*(LARG/2+rnd.uniform(-.3,.6)),2),float(z),round(rnd.uniform(1,1.5),2)])
  for x in range(-LARG//2,LARG//2+1,2):arv.append([float(x),round(-3+rnd.uniform(-.4,.4),2),round(rnd.uniform(1,1.4),2)])
  return {"largura":LARG,"comprimento":L,"caminho":pts,"inicio":[pts[0][0],1.5],"portal":[pts[-1][0],float(L-2)],
          "acampamentos":camps,"folhas":folhas,"morangos":morangos,"arvores":arv,"pedras":ped,"cogumelos":cog,"arena":arena}
p=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','data','aventura.json');D=json.load(open(p))
# Desafio Lendário: fase extra depois do chefão do mundo 1; o chefão é o lendário do dia (troca todo dia, ver js/aventura.js)
D.setdefault('desafio',{"id":"lenda","nome":"Desafio Lendário","depois_de":"f10","nivel":42,"chance_ovo":0.05,"premio":0,
  "inimigos":[[18,36],[13,36],[4,37]],"caveiras":5})
dz=D['desafio'];dz['mapa3d']=gera(11,{'inimigos':dz['inimigos'],'chefe':[43,dz['nivel']]},seed=11,desafio=True)
for c in dz['mapa3d']['acampamentos']:
  for e in c['inimigos']:
    if len(e)==4:e.append('elite')
print('desafio L',dz['mapa3d']['comprimento'],'inimigos',sum(len(c['inimigos']) for c in dz['mapa3d']['acampamentos']))
for k,f in enumerate(D['mundos'][0]['fases']):
  f.pop('mapa',None);f['mapa3d']=gera(k+1,f);f['caveiras']=1+k//2
  m=f['mapa3d'];tp=[e[4] for c in m['acampamentos'] for e in c['inimigos'] if len(e)>4];print(f['id'],'L',m['comprimento'],'inimigos',sum(len(c['inimigos']) for c in m['acampamentos']),'tipos',{t:tp.count(t) for t in set(tp)},'morangos',len(m['morangos']),'árvores',len(m['arvores']))
D.pop('plataforma',None)
D.setdefault('arena',{})
# cenário 3D (modelos em models/cenario/, recortados do diorama do portal): portal de chegada, árvores e canteiros de cogumelos
D.setdefault('cenario3d',{"portal":"models/cenario/portal.glb","portal_tamanho":7.6,"arvores":["models/cenario/arvore1.glb","models/cenario/arvore2.glb"],"arvore_tamanho":3.4,
  "cogumelos":"models/cenario/cogumelos.glb","cogumelo_tamanho":1.5,"bloco":6})
# dificuldade que cresce fase a fase: [valor na 1ª fase, valor na última]; o jogo interpola pelas fases do mundo
D.setdefault('curva',{"inimigo_vel":[2.2,3.3],"inimigo_recarga":[1.7,0.9],"inimigo_aviso":[0.65,0.32],"aggro":[6,9.5],"contato":[1.0,1.3],"tiro_vel":[5.5,8.5]})
# tipos de inimigo (o 5º número de cada inimigo no mapa)
D.setdefault('tipos',{"atirador":{"nome":"Atirador","icone":"🎯","recarga":2.8,"distancia":5,"vida":0.8},
  "elite":{"nome":"Elite","icone":"🛡️","vida":1.8,"escudo":0.5,"tamanho":1.35,"dano":1.3,"pancada_raio":1.9,"pancada_aviso":0.75,"recarga":2.2},
  "curandeiro":{"nome":"Curandeiro","icone":"💚","vida":0.75,"cura":0.15,"recarga":4.5,"raio":5.5,"distancia":5}})
txt=json.dumps(D,ensure_ascii=False,indent=1)
# mapas numa linha só por lista (o arquivo fica bem menor e legível)
import re
txt=re.sub(r'\[\s+(-?[\d.]+),\s+(-?[\d.]+)(?:,\s+(-?[\d.]+))?(?:,\s+(-?[\d.]+))?(?:,\s+("[a-z]+"))?\s+\]',lambda m_:'['+','.join(g for g in m_.groups() if g is not None)+']',txt)
open(p,'w').write(txt)
