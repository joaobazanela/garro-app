"""GARRO — BASE para usar folhas 3D do Tripo (várias criaturas num arquivo só, em grade) no jogo.
Separa cada criatura num modelo leve (atlas de textura novo 1024 px + malha simplificada), apoiado em y = 0 e olhando para +z.

Como funciona:
  1) cada criatura da folha é um pedaço separado da malha (componente). O script acha os componentes e põe cada um na célula
     da grade mais perto (linhas de cima para baixo, colunas da esquerda para a direita);
  2) para cada célula: refaz a textura só com o que aquela criatura usa e simplifica até 'alvo' triângulos;
  3) 'giro' (graus) vira a criatura para olhar para +z (o Tripo às vezes deixa de lado/3/4).

Uso:
  python3 ferramentas/separar_folha_tripo.py folha.glb receita.json pasta_saida [nome1,nome2,...]
receita.json (exemplo em ferramentas/receitas/dragoes_luz.json):
  {"colunas": 3, "linhas": 6, "nomes": ["brasin", ...], "alvo": [14000,16000,20000], "giro": {"breumin": -45}}
  'alvo' pode ser 1 número ou 1 por coluna. Para conferir, abra os .glb gerados de frente: a cara tem que aparecer.
Requer: numpy, scipy, Pillow (os módulos em ferramentas/tripo)."""
import sys, os, json, numpy as np
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tripo'))
import quadrantes as Q, componentes as K
from bake import components, prep

def celulas(P, I, nc, nl):
    L = components(P, I); tl = L[I[:, 0]]; C = P[I].mean(1)
    u, inv, cnt = np.unique(tl, return_inverse=True, return_counts=True)
    cx = np.bincount(inv, C[:, 0])/cnt; cy = np.bincount(inv, C[:, 1])/cnt
    mn, mx = P.min(0), P.max(0)
    X = mn[0]+(np.arange(nc)+.5)/nc*(mx[0]-mn[0]); Y = mx[1]-(np.arange(nl)+.5)/nl*(mx[1]-mn[1])
    # refina os centros com k-médias (as linhas da folha nem sempre têm a mesma altura)
    cent = np.array([(x, y) for y in Y for x in X]); w = cnt.astype(float)
    for _ in range(20):
        d = (cx[:, None]-cent[None, :, 0])**2+(cy[:, None]-cent[None, :, 1])**2; a = d.argmin(1)
        for k in range(len(cent)):
            m = a == k
            if m.any(): cent[k] = [np.average(cx[m], weights=w[m]), np.average(cy[m], weights=w[m])]
    print(len(u), 'pedaços na folha; triângulos por célula:', [int(cnt[a == k].sum()) for k in range(len(cent))])
    return a[inv]

def main(src, receita, out, so=None):
    R = json.load(open(receita)); nc, nl, nomes = R['colunas'], R['linhas'], R['nomes']; alvo = R.get('alvo', 16000); giro = R.get('giro', {})
    os.makedirs(out, exist_ok=True)
    G = Q.read(src); P0 = G['P'].astype(np.float64); UV0 = G['UV'].astype(np.float64); I0 = G['I']
    cel = celulas(P0, I0, nc, nl)
    for k, nome in enumerate(nomes):
        if not nome or (so and nome not in so): continue
        Ic = I0[cel == k]
        if not len(Ic): print(nome, 'célula vazia'); continue
        used = np.unique(Ic); rm = -np.ones(len(P0), np.int64); rm[used] = np.arange(len(used)); P, UV, I = P0[used], UV0[used], rm[Ic]
        nUV, img, s = Q.sep.reatlas(P, UV, I, G['img'], 1024); P = prep(P, None, None, giro.get(nome, 0))
        a = alvo[k % nc] if isinstance(alvo, list) else alvo
        print(nome, len(I), 'triângulos →', K.rebake3(P, nUV, I, img, 150, 1024, 84, os.path.join(out, nome+'.glb'), alvo=a), flush=True)

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4].split(',') if len(sys.argv) > 4 else None)
