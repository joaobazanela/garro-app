"""GARRO — cria/repõe as pernas de trás quando a folha do Tripo não fez (a criatura de frente esconde o fundo).
Copia uma perna que existe (crescida a partir do pé pela malha, até a altura do quadril) para outro lugar:
  python3 ferramentas/pernas_tras.py entrada.glb saida.glb "x_pé,z_pé:dx,dz[,espelha]" ...
  - x_pé,z_pé  : onde fica o pé que serve de molde (perto do chão);
  - dx,dz      : quanto andar com a cópia; espelha=1 vira a cópia de lado (x → -x em volta do pé).
Ex.: soprim (sem as de trás): "-0.28,0:0,-0.3" "0.29,-0.02:0,-0.3"."""
import sys, os, numpy as np
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from astrakai_deitada import le, grava, normais

def perna(P, I, fx, fz, hip_frac=.45, raio=.16):
    y0 = P[:, 1].min(); h = P[:, 1].max()-y0; C = P[I].mean(1)
    ok = (C[:, 1] < y0+h*hip_frac) & (np.hypot(C[:, 0]-fx, C[:, 2]-fz) < raio)
    idx = np.nonzero(ok)[0]; sub = I[idx]; n = len(P)
    r = np.r_[sub[:, 0], sub[:, 1], sub[:, 2]]; c = np.r_[sub[:, 1], sub[:, 2], sub[:, 0]]
    _, lab = connected_components(coo_matrix((np.ones(len(r)), (r, c)), shape=(n, n)), directed=False)
    sem = (C[idx, 1] < y0+h*.06) & (np.hypot(C[idx, 0]-fx, C[idx, 2]-fz) < raio*.5)   # o pé
    alvo = set(lab[sub[sem, 0]])
    return idx[np.isin(lab[sub[:, 0]], list(alvo))]

if __name__ == '__main__':
    src, dst = sys.argv[1:3]
    P, UV, I, img = le(src); P = P.astype(np.float64); UV = UV.astype(np.float64); I = I.astype(np.int64)
    P0, UV0, I0 = P, UV, I
    for spec in sys.argv[3:]:
        a, b = spec.split(':'); fx, fz = map(float, a.split(',')); bb = b.split(','); dx, dz = float(bb[0]), float(bb[1]); esp = len(bb) > 2 and bb[2] == '1'
        t = perna(P0, I0, fx, fz)
        if len(t) < 20: print('  sem perna perto de', fx, fz); continue
        Ic = I0[t]; u = np.unique(Ic); rm = -np.ones(len(P0), int); rm[u] = np.arange(len(u)); Pn = P0[u].copy()
        if esp: Pn[:, 0] = 2*fx-Pn[:, 0]
        Pn[:, 0] += dx; Pn[:, 2] += dz; In = rm[Ic]; In = In[:, ::-1] if esp else In
        P = np.vstack([P, Pn]); UV = np.vstack([UV, UV0[u]]); I = np.vstack([I, In+len(P)-len(Pn)])
        print('  perna', spec, len(t), 'triângulos')
    grava(dst, P.astype(np.float32), normais(P, I).astype(np.float32), UV.astype(np.float32), I.astype(np.uint32), img, q=90)
