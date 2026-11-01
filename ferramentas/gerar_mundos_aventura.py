# Gera os mundos novos da Aventura (Mar e Montanha) e grava em data/aventura.json (a Floresta não é mexida).
# Regra de design (RPG): cada fase apresenta UM bichinho novo (o mais forte da fase); os outros dois já apareceram antes.
# Nível dos inimigos: +2 por fase (mesma curva da Floresta: fase q tem base b+2(q-1) e níveis b, b+1, b+2); a base de cada
# mundo continua de onde o chefão do mundo anterior parou. Uso: python3 ferramentas/gerar_mundos_aventura.py
import json,random,subprocess,sys,os
AQUI=os.path.dirname(os.path.abspath(__file__));RAIZ=os.path.dirname(AQUI)
sys.path.insert(0,AQUI)
def dump(o,p):open(p,'w',encoding='utf-8').write(json.dumps(o,ensure_ascii=False,indent=1)+'\n')  # mesmo formato do arquivo original
D=json.load(open(RAIZ+'/data/aventura.json'));P=json.load(open(RAIZ+'/data/pelucias.json'))
ELEM=P['ELEM']
D['mundos']=[m for m in D['mundos'] if m['id']=='floresta']   # recomeça pelos mundos novos
vistos=[]
for f in D['mundos'][0]['fases']:
  for i,_ in f['inimigos']:vistos.append(i)
  if f.get('chefe'):vistos.append(f['chefe'][0])
MUNDOS=[
 dict(id='mar',pref='a',nome='Mar Cristalino',elemento='sand',base=25,grupo={'water','sand','ice','cloud'},
  tema=dict(ceu='#1b3d57',neblina='#2c5f7d',chao='#d9c58e',pintas=['#e6d39d','#cdb77f','#dcc994','#c9b177','#e2cf9a'],trilha=['#9c8458','#b49a6a','#c8ae7c','#d6bd8c'],flores=['#9fe6ff','#ffffff','#ffd1e8','#c9b4ff'],
            arvore='#7fd6c9',cogumelo='#ff9ec2',pedra='#7a9db5',deco=['🌊','🐚','🪸','🐠','🌴','🫧','🐚','🪨']),
  dif=dict(vel=1.06,recarga=0.93,extra=1,tipos_n=2,dens=dict(arv=0.8,ped=0.7)),
  caveiras=[2,2,3,3,3,4,4,4,5,5],
  novos=[28,20,24,38,33,1,15,3,9,6],   # o último é o chefão
  nomes=['Praia das Conchas','Recife de Coral','Lagoa Azul','Gruta das Marés','Ilha das Nuvens','Correnteza Elétrica','Cais Naufragado','Mar de Brisa','Abismo da Lua','Coração do Oceano']),
 dict(id='montanha',pref='t',nome='Montanha de Pedra',elemento='stone',base=49,grupo={'earth','stone','lava','embers','shadow'},
  tema=dict(ceu='#3a2418',neblina='#5a3a28',chao='#8a5a3a',pintas=['#9a6a46','#7a4e32','#a2744e','#6e4630','#8f6040'],trilha=['#6e5a46','#a58a68','#bd9f7a','#cdb28c'],flores=['#ffb36b','#ffe2b0','#ff8a5c','#ffffff'],
            arvore='#b58a4a',cogumelo='#d9a066',pedra='#6e5a50',deco=['⛰️','🪨','🌋','🔥','🏜️','🪨','🌵','⛏️']),
  dif=dict(vel=1.12,recarga=0.87,extra=2,tipos_n=4,dens=dict(arv=0.45,ped=2.2)),
  caveiras=[4,4,4,4,5,5,5,5,5,5],
  novos=[35,37,32,39,36,23,16,4,11,8],
  nomes=['Sopé da Montanha','Vale de Pedras','Trilha de Brasas','Mina Esquecida','Cratera Quente','Desfiladeiro','Rio de Lava','Cume Sombrio','Fornalha Antiga','Coração do Vulcão']),
]
rnd=random.Random(2026)
pedidos=[]  # (mundo, fase) que precisam de mapa3d
for w in MUNDOS:
  fases=[]
  for q,novo in enumerate(w['novos'],1):
    assert novo not in vistos,('bicho repetido como novo',novo)
    b=w['base']+2*(q-1);boss=(q==10)
    pool=[i for i in vistos if i!=novo];pref=[i for i in pool if ELEM[i] in w['grupo'] or True]
    # prefere os que já apareceram há pouco (mais fracos) mas varia: sorteio pesado pelos mais recentes
    pesos=[1+k*0.25 for k,_ in enumerate(pool)]
    velhos=[]
    while len(velhos)<(1 if boss else 2):
      c=rnd.choices(pool,weights=pesos)[0]
      if c not in velhos:velhos.append(c)
    if boss:inim=[[velhos[0],b+3]];fase=dict(id=w['pref']+'%02d'%q,nome=w['nomes'][q-1],premio=3,inimigos=inim,chefe=[novo,b+7],caveiras=w['caveiras'][q-1])
    else:
      inim=[[velhos[0],b],[velhos[1],b+1],[novo,b+2]]
      fase=dict(id=w['pref']+'%02d'%q,nome=w['nomes'][q-1],premio=1,inimigos=inim,caveiras=w['caveiras'][q-1])
    fases.append(fase);vistos.append(novo)
  w['fases']=fases
# mapa reserva (o jogo sorteia um novo a cada partida; este vale se js/mapas.js não carregar): mesma receita do js/mapas.js
js="""global.window={};require(process.argv[1]+'/js/mapas.js');const E=JSON.parse(process.argv[2]);const out=E.map(e=>window.GARRO_MAPAS.gera(e.n,{inimigos:e.inimigos,chefe:e.chefe},1+e.k,false,e.W.extra,e.W));console.log(JSON.stringify(out))"""
pedidos=[];ref=[]
for w in MUNDOS:
  for q,f in enumerate(w['fases'],1):
    pedidos.append(dict(n=q,k=len(pedidos),inimigos=f['inimigos'],chefe=f.get('chefe'),W=w['dif']));ref.append(f)
mapas=json.loads(subprocess.check_output(['node','-e',js,RAIZ,json.dumps(pedidos)],text=True))
# reserva enxuta (sem árvores/pedras/cogumelos, que são só enfeite e pesariam muito): o mapa completo vem de js/mapas.js
for f,m in zip(ref,mapas):m['arvores']=[];m['pedras']=[];m['cogumelos']=[];f['mapa3d']=m
# grava só o acréscimo no texto do arquivo (não reformata o resto, para o diff ficar só com os mundos novos)
txt=open(RAIZ+'/data/aventura.json',encoding='utf-8').read()
i0=txt.index('"mundos": [')+len('"mundos": ');arr,fim=json.JSONDecoder().raw_decode(txt,i0)
base=[m for m in arr if m['id']=='floresta']
novos=[dict(id=w['id'],nome=w['nome'],elemento=w['elemento'],tema=w['tema'],dif=w['dif'],fases=w['fases']) for w in MUNDOS]
trecho=',\n'.join('  '+json.dumps(m,ensure_ascii=False,indent=1).replace('\n','\n  ') for m in novos)
# fim aponta para depois do ']' da lista; o texto antes dele termina no último '}' do mundo da Floresta
corpo=txt[:fim-1].rstrip()
assert corpo.endswith('}'),corpo[-20:]
open(RAIZ+'/data/aventura.json','w',encoding='utf-8').write(corpo+',\n'+trecho+'\n '+txt[fim-1:])
D=json.load(open(RAIZ+'/data/aventura.json'))
print('mundos:',[(m['id'],len(m['fases'])) for m in D['mundos']],'bichos usados:',len(set(vistos)))
