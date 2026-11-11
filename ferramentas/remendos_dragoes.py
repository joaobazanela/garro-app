"""GARRO — remendos nos dragões da folha do Tripo de 06/11 (a folha é de frente, então o Tripo não fez o fundo de alguns):
  • Soprim: não tinha a metade de trás (só cabeça, peito, patas da frente e asas) → copia o peito + patas da frente 0,26 para trás;
  • Breumin: faltava 1 pata de trás → espelha a que existe em volta da linha do meio (x = -0,15).
Uso: python3 ferramentas/remendos_dragoes.py pasta_com_os_glb  (sobrescreve soprim.glb e breumin.glb)"""
import sys, os, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from astrakai_deitada import le, grava, normais
def copia(P, UV, I, m, f):
    Ic = I[m]; u = np.unique(Ic); rm = -np.ones(len(P), int); rm[u] = np.arange(len(u)); Pn, inv = f(P[u].copy())
    In = rm[Ic][:, ::-1] if inv else rm[Ic]
    return np.vstack([P, Pn]), np.vstack([UV, UV[u]]), np.vstack([I, In+len(P)])
def abre(f):
    P, UV, I, img = le(f); return P.astype(float), UV.astype(float), I.astype(int), img
def salva(f, P, UV, I, img): grava(f, P.astype(np.float32), normais(P, I).astype(np.float32), UV.astype(np.float32), I.astype(np.uint32), img, q=90)
pasta = sys.argv[1]
P, UV, I, img = abre(os.path.join(pasta, 'soprim.glb')); y0 = P[:, 1].min(); h = P[:, 1].max()-y0; C = P[I].mean(1)
# patas e peito copiados para trás; o vão entre as duas metades é preenchido com um "barril" liso (elipsoide) na cor do corpo
pernas = (C[:, 2] > -.2) & (C[:, 2] < .12) & (C[:, 1] < y0+h*.5) & (np.abs(C[:, 0]) < .42)
def tras(Q): Q[:, 2] -= .26; return Q, False
P, UV, I = copia(P, UV, I, pernas, tras)
fat = (np.abs(C[:, 2]) < .05) & (C[:, 1] > y0+h*.22) & (C[:, 1] < y0+h*.6) & (np.abs(C[:, 0]) < .3)
v = np.unique(I[:len(C)][fat]); Pt = P[v]; cx = np.median(Pt[:, 0]); cy = (np.percentile(Pt[:, 1], 10)+np.percentile(Pt[:, 1], 90))/2
rx = (np.percentile(Pt[:, 0], 95)-np.percentile(Pt[:, 0], 5))/2*1.02; ry = (np.percentile(Pt[:, 1], 95)-np.percentile(Pt[:, 1], 5))/2*1.0
# cor: um texel do lado do corpo (vértice de 'fat' mais para fora em x)
uvc = UV[v[np.argmax(np.abs(Pt[:, 0]-cx))]]
nu, nv = 24, 14; E = []
for a in range(nv+1):
    th = np.pi*a/nv
    for b in range(nu):
        ph = 2*np.pi*b/nu; E.append([cx+rx*np.sin(th)*np.cos(ph), cy+ry*np.sin(th)*np.sin(ph), -.13+.2*np.cos(th)])
E = np.array(E); F = []
for a in range(nv):
    for b in range(nu):
        p0 = a*nu+b; p1 = a*nu+(b+1) % nu; q0 = p0+nu; q1 = p1+nu; F += [[p0, q0, p1], [p1, q0, q1]]
# textura: cada ponto do barril pega o UV do vértice do corpo mais perto em (x, y) (as penas e marcas continuam no meio)
from scipy.spatial import cKDTree
_, k = cKDTree(Pt[:, :2]).query(E[:, :2]); uvE = UV[v][k]
F = np.array(F)[:, ::-1]                      # faces viradas para fora
n0 = len(P); P = np.vstack([P, E]); UV = np.vstack([UV, uvE]); I = np.vstack([I, F+n0])
salva(os.path.join(pasta, 'soprim.glb'), P, UV, I, img)
P, UV, I, img = abre(os.path.join(pasta, 'breumin.glb')); y0 = P[:, 1].min(); h = P[:, 1].max()-y0; C = P[I].mean(1); mid = -.15
m = (C[:, 0] > mid+.02) & (C[:, 0] < .08) & (C[:, 2] > -.35) & (C[:, 2] < -.02) & (C[:, 1] < y0+h*.42)
def esp(Q): Q[:, 0] = 2*mid-Q[:, 0]; return Q, True
salva(os.path.join(pasta, 'breumin.glb'), *copia(P, UV, I, m, esp), img)
print('ok: soprim e breumin remendados')
