"""GARRO — repõe a pata que o Tripo fundiu/sumiu (modelo olhando para +z, apoiado em y=0).
Acha os pés (pedaços encostados no chão, dedos juntados), separa em dianteiros (z maior) e traseiros. Se um par tem só 1 pé,
cresce a perna a partir desse pé pela malha (até a altura do quadril, sem pegar o meio do corpo) e copia espelhada do outro lado
da linha do meio (a linha do meio vem do par que está completo).
Uso: python3 ferramentas/patas.py entrada.glb saida.glb"""
import sys, os, numpy as np
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from astrakai_deitada import le, grava, normais

def pes(P, I, frac=.1):
    y0 = P[:, 1].min(); h = P[:, 1].max()-y0; C = P[I].mean(1); low = np.nonzero(C[:, 1] < y0+h*frac)[0]; Il = I[low]; n = len(P)
    r = np.r_[Il[:, 0], Il[:, 1], Il[:, 2]]; c = np.r_[Il[:, 1], Il[:, 2], Il[:, 0]]
    _, lab = connected_components(coo_matrix((np.ones(len(r)), (r, c)), shape=(n, n)), directed=False)
    tl = lab[Il[:, 0]]; out = []
    for g in np.unique(tl):
        tri = low[tl == g]; v = np.unique(I[tri])
        if len(v) >= 12: out.append(dict(x=P[v, 0].mean(), z=P[v, 2].mean(), n=len(v), tri=list(tri)))
    L = P[:, 2].max()-P[:, 2].min(); junto = True
    while junto and len(out) > 1:
        junto = False
        for a in range(len(out)):
            for b in range(a+1, len(out)):
                A, B = out[a], out[b]
                if np.hypot(A['x']-B['x'], A['z']-B['z']) < L*.13:
                    t = A['n']+B['n']; out[a] = dict(x=(A['x']*A['n']+B['x']*B['n'])/t, z=(A['z']*A['n']+B['z']*B['n'])/t, n=t, tri=A['tri']+B['tri']); del out[b]; junto = True; break
            if junto: break
    return [f for f in out if f['n'] >= 30], h, y0

def perna(P, I, f, mid, hip):
    # triângulos ligados ao pé, abaixo do quadril e do lado do pé (longe da linha do meio)
    n = len(P); lado = np.sign(f['x']-mid) or 1
    C = P[I].mean(1); ok = (C[:, 1] < hip) & ((C[:, 0]-mid)*lado > abs(f['x']-mid)*.25)
    idx = np.nonzero(ok)[0]; sub = I[idx]
    r = np.r_[sub[:, 0], sub[:, 1], sub[:, 2]]; c = np.r_[sub[:, 1], sub[:, 2], sub[:, 0]]
    _, lab = connected_components(coo_matrix((np.ones(len(r)), (r, c)), shape=(n, n)), directed=False)
    seeds = set(lab[I[t, 0]] for t in f['tri'] if ok[t])
    return idx[np.isin(lab[sub[:, 0]], list(seeds))]

def conserta(P, UV, I, verbose=True):
    F, h, y0 = pes(P, I)
    if len(F) < 2: return P, UV, I, 0
    zc = np.median([f['z'] for f in F]); zs = sorted(f['z'] for f in F); gap = np.argmax(np.diff(zs)) if len(zs) > 1 else 0
    zc = (zs[gap]+zs[gap+1])/2 if len(zs) > 1 else zc
    fr = [f for f in F if f['z'] > zc]; tr = [f for f in F if f['z'] <= zc]
    if verbose: print('  dianteiros', [(round(f['x'], 2), round(f['z'], 2)) for f in fr], 'traseiros', [(round(f['x'], 2), round(f['z'], 2)) for f in tr])
    body = P[P[:, 1] > y0+h*.35]; mid0 = np.median(body[:, 0]); feitos = 0; P0, UV0, I0 = P, UV, I
    for grupo, outro in ((fr, tr), (tr, fr)):
        if len(grupo) != 1: continue
        mid = np.mean([g['x'] for g in sorted(outro, key=lambda g: -g['n'])[:2]]) if len(outro) >= 2 else mid0
        f = grupo[0]
        if abs(f['x']-mid) < .08: continue                 # pé no meio: provavelmente os dois juntos (copiar ficaria por cima)
        t = perna(P0, I0, f, mid, y0+h*.45)
        if len(t) < 30: continue
        Ic = I0[t]; u = np.unique(Ic); rm = -np.ones(len(P0), int); rm[u] = np.arange(len(u))
        Pn = P0[u].copy(); Pn[:, 0] = 2*mid-Pn[:, 0]
        # a perna copiada tem que encostar no corpo pelo alto (senão fica solta no ar): confere a distância do topo dela ao modelo
        from scipy.spatial import cKDTree
        topo = Pn[Pn[:, 1] > np.percentile(Pn[:, 1], 85)]; d = cKDTree(P0).query(topo)[0].min()
        if d > .12:
            if verbose: print('  pata NÃO copiada (ficaria solta, distância', round(float(d), 3), ')')
            continue
        P = np.vstack([P, Pn]); UV = np.vstack([UV, UV0[u]]); I = np.vstack([I, rm[Ic][:, ::-1]+len(P)-len(Pn)]); feitos += 1
        if verbose: print('  pata copiada: pé', round(f['x'], 2), round(f['z'], 2), 'linha do meio', round(mid, 2), len(t), 'triângulos')
    return P, UV, I, feitos

if __name__ == '__main__':
    src, dst = sys.argv[1:3]
    P, UV, I, img = le(src); P = P.astype(np.float64); UV = UV.astype(np.float64); I = I.astype(np.int64)
    P, UV, I, n = conserta(P, UV, I)
    grava(dst, P.astype(np.float32), normais(P, I).astype(np.float32), UV.astype(np.float32), I.astype(np.uint32), img, q=90)
    print(os.path.basename(dst), 'patas repostas:', n)
