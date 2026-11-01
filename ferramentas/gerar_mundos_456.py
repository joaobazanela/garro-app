# Gera os mundos 4, 5 e 6 da Aventura (Trevas, Fogo e Luz) e acrescenta em data/aventura.json (os outros mundos não mudam).
# Visual inspirado nos mapas GARRO_Mundo_Trevas / GARRO_Mundo_Fogo / GARRO_Mundo_Luz (árvores secas e cristais roxos;
# rios de lava, chamas e vulcões; colunas, cristais dourados/azuis e orbes de luz).
# Os bichinhos que ainda não tinham aparecido entram aqui (um novo por fase enquanto houver); o chefão de cada mundo é um lendário.
# Nível dos inimigos: continua de onde a Montanha parou e sobe 1 por fase, sem passar do Nv 100.
# Uso: python3 ferramentas/gerar_mundos_456.py
import json,random,subprocess,os
AQUI=os.path.dirname(os.path.abspath(__file__));RAIZ=os.path.dirname(AQUI)
D=json.load(open(RAIZ+'/data/aventura.json'));P=json.load(open(RAIZ+'/data/pelucias.json'));ELEM=P['ELEM']
assert [m['id'] for m in D['mundos']]==['floresta','mar','montanha'],'os mundos 4-6 já existem'
vistos=[]
for m in D['mundos']:
  for f in m['fases']:
    for i,_ in f['inimigos']:vistos.append(i)
    if f.get('chefe'):vistos.append(f['chefe'][0])
GRUPO=lambda g:[i for i in range(43) if ELEM[i] in g]
MUNDOS=[
 dict(id='trevas',pref='n',nome='Reino das Trevas',elemento='shadow',base=72,grupo={'shadow','stars','swamp'},chefe=47,
  novos=[25,30,14,41],
  tema=dict(decor='trevas',ceu='#120c1c',neblina='#221634',chao='#3a3046',pintas=['#463a56','#2e2638','#4e4062','#342a44','#3e3450'],trilha=['#2a2234','#4a3e5c','#5a4c6e','#6a5a80'],
            flores=['#b46aff','#7a4aff','#ff7ad9','#ffffff'],arvore='#6a5a7a',cogumelo='#9a6aff',pedra='#4a4058',cristais=['#b46aff','#8a5aff','#ff6ad9'],voadores=['🦇','✨','👻','✨'],
            deco=['🌑','🦇','💀','🕸️','🔮','🪦','👻','🌙']),
  dif=dict(vel=1.15,recarga=0.85,extra=2,tipos_n=4,dens=dict(arv=0.6,ped=1.4)),
  nomes=['Portão Sombrio','Bosque Seco','Pântano da Névoa','Cemitério Antigo','Ponte dos Morcegos','Vale das Sombras','Cripta Esquecida','Torre Negra','Lago de Breu','Trono da Noite']),
 dict(id='fogo',pref='v',nome='Terra do Fogo',elemento='embers',base=82,grupo={'embers','lava','electric','earth'},chefe=45,
  novos=[2,40,7],
  tema=dict(decor='fogo',ceu='#2a0e08',neblina='#4a1a0c',chao='#3e2a24',pintas=['#4a3028','#2e1e1a','#56382e','#3a2620','#5e4032'],trilha=['#2a1a16','#4a2e24','#5e3a2c','#6e4634'],
            flores=['#ff8a2a','#ffd04a','#ff4a2a','#fff0c0'],arvore='#5a3a30',cogumelo='#ff7a3a',pedra='#4a3a36',chamas=['#ff5a1a','#ff9a2a','#ffd04a'],voadores=['🔥','✨','🔥','💥'],
            deco=['🔥','🌋','🪨','💥','♨️','🔥','⛏️','🌋']),
  dif=dict(vel=1.18,recarga=0.83,extra=3,tipos_n=4,dens=dict(arv=0.35,ped=2.0)),
  nomes=['Campo de Cinzas','Rio de Magma','Forja dos Anões','Gêiseres','Ponte de Obsidiana','Vulcão Adormecido','Caverna Ardente','Lago de Lava','Muralha de Fogo','Coração da Chama']),
 dict(id='luz',pref='l',nome='Santuário da Luz',elemento='gold',base=90,grupo={'gold','petals','stars','cloud','flowers'},chefe=50,
  novos=[19],
  tema=dict(decor='luz',ceu='#cfd8e6',neblina='#e8eef6',chao='#d8d4c4',pintas=['#e2dece','#cfc9b6','#e8e4d6','#c9c2ac','#ddd8c6'],trilha=['#bdb59c','#cfc7ae','#e0d9c2','#efe9d6'],
            flores=['#ffd86a','#9fd0ff','#ffffff','#ffe9a0'],arvore='#f0e6c8',cogumelo='#ffe08a',pedra='#b8b4a8',cristais=['#ffd86a','#8ac8ff','#ffffff'],voadores=['✨','🌟','💫','✨'],
            deco=['☀️','✨','🏛️','💎','🌟','🕊️','👑','💫']),
  dif=dict(vel=1.2,recarga=0.8,extra=3,tipos_n=5,dens=dict(arv=0.4,ped=1.0)),
  nomes=['Escadaria Dourada','Jardim de Cristal','Colunas Antigas','Fonte Sagrada','Ponte do Arco-Íris','Templo do Sol','Salão dos Espelhos','Céu de Estrelas','Altar Celeste','Coração da Luz']),
]
rnd=random.Random(2027)
for w in MUNDOS:
  fases=[];grupo=GRUPO(w['grupo'])
  for q in range(1,11):
    b=min(w['base']+(q-1),93);boss=(q==10)
    novo=w['novos'][q-1] if q-1<len(w['novos']) else None
    pool=[i for i in dict.fromkeys(vistos) if i!=novo];pref=[i for i in pool if i in grupo] or pool
    velhos=[]
    while len(velhos)<(1 if boss else 2 if novo is not None else 3):
      c=rnd.choice(pref if rnd.random()<.75 else pool)
      if c not in velhos:velhos.append(c)
    if boss:fase=dict(id=w['pref']+'%02d'%q,nome=w['nomes'][q-1],premio=3,inimigos=[[velhos[0],min(100,b+3)]],chefe=[w['chefe'],min(100,b+7)],caveiras=5)
    else:
      lvs=[b,b+1,b+2];inim=[[v,lvs[k]] for k,v in enumerate(velhos)]
      if novo is not None:inim.append([novo,b+2]);vistos.append(novo)
      fase=dict(id=w['pref']+'%02d'%q,nome=w['nomes'][q-1],premio=1,inimigos=inim[-3:],caveiras=4 if q<5 else 5)
    fases.append(fase)
  w['fases']=fases
js="""global.window={};require(process.argv[1]+'/js/mapas.js');const E=JSON.parse(process.argv[2]);const out=E.map(e=>window.GARRO_MAPAS.gera(e.n,{inimigos:e.inimigos,chefe:e.chefe},1+e.k,false,e.W.extra,e.W));console.log(JSON.stringify(out))"""
ped=[];ref=[]
for w in MUNDOS:
  for q,f in enumerate(w['fases'],1):ped.append(dict(n=q,k=500+len(ped),inimigos=f['inimigos'],chefe=f.get('chefe'),W=w['dif']));ref.append(f)
mapas=json.loads(subprocess.check_output(['node','-e',js,RAIZ,json.dumps(ped)],text=True))
for f,m in zip(ref,mapas):m['arvores']=[];m['pedras']=[];m['cogumelos']=[];f['mapa3d']=m
txt=open(RAIZ+'/data/aventura.json',encoding='utf-8').read()
i0=txt.index('"mundos": [')+len('"mundos": ');arr,fim=json.JSONDecoder().raw_decode(txt,i0)
novos=[dict(id=w['id'],nome=w['nome'],elemento=w['elemento'],tema=w['tema'],dif=w['dif'],fases=w['fases']) for w in MUNDOS]
trecho=',\n'.join('  '+json.dumps(m,ensure_ascii=False,indent=1).replace('\n','\n  ') for m in novos)
corpo=txt[:fim-1].rstrip();assert corpo.endswith('}'),corpo[-20:]
open(RAIZ+'/data/aventura.json','w',encoding='utf-8').write(corpo+',\n'+trecho+'\n '+txt[fim-1:])
D=json.load(open(RAIZ+'/data/aventura.json'))
print('mundos:',[(m['id'],len(m['fases'])) for m in D['mundos']])
for w in MUNDOS:print(w['id'],[(f['id'],[(P['DATA'][i][0] if i<43 else 'LEND%d'%i,l) for i,l in f['inimigos']],f.get('chefe')) for f in w['fases']][-2:])
