# Grava JSON legível com listas curtas numa linha só (para os arquivos de conteúdo em data/)
import json,re,sys
def dump(obj,path):
  t=json.dumps(obj,ensure_ascii=False,indent=1)
  # listas só de números/strings curtas ficam numa linha
  t=re.sub(r'\[\s*\n\s*((?:[-\d."#\w]+,\s*\n\s*)*[-\d."#\w]+)\s*\n\s*\]',lambda m:'['+re.sub(r',\s*\n\s*',',',m.group(1))+']',t)
  open(path,'w').write(t+'\n')
if __name__=='__main__':
  for p in sys.argv[1:]:dump(json.load(open(p)),p)
