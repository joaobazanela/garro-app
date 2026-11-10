"""GARRO — junta a CAUDA da figura de lado na figura de frente (folhas do Tripo com cada criatura de frente e de lado).
Na folha, a figura de frente tem as duas asas mas quase não tem cauda; a de lado tem a cauda inteira mas uma asa só.
Aqui: as duas já estão olhando +z com os pés em y=0 (saída do separar_folha_tripo). Passos:
  1) encaixa a de lado na de frente pelas patas: escala pelo comprimento entre a pata da frente e a de trás (z) e alinha;
  2) corta a de lado um pouco à frente da pata de trás e fica com o pedaço de trás ligado ao quadril (a cauda), sem as patas
     e sem pedaços da asa;
  3) a base da cauda entra dentro do quadril da figura de frente (não aparece borda aberta) e a cor da cauda é ajustada
     para a cor da pele perto do quadril (sem emenda de cor); a costura é suavizada por uma faixa onde a cor vai mudando;
  4) as duas texturas viram uma só (lado a lado) e grava um .glb único.
Uso: python3 -I ferramentas/junta_cauda.py frente.glb lado.glb saida.glb [--dentro 0.06]"""
import sys, os, io, numpy as np
from PIL import Image
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from astrakai_deitada import le, grava, normais

def pes(P, frac=.06):
    """pontos das patas (perto do chão) e o comprimento frente-trás delas"""
    H = P[:, 1].max(); m = P[:, 1] < frac*H; Q = P[m]
    return Q, np.percentile(Q[:, 2], 3), np.percentile(Q[:, 2], 97)

def silh(P, H, R=96, zr=(-.7, .7)):
    """silhueta de lado (z, y) da parte de baixo do corpo (até 55% da altura de referência H)"""
    m = P[:, 1] < .55*H; Q = P[m]; im = np.zeros((R, R), bool)
    zi = ((Q[:, 2]-zr[0])/(zr[1]-zr[0])*(R-1)).astype(int); yi = (Q[:, 1]/(.55*H)*(R-1)).astype(int)
    ok = (zi >= 0) & (zi < R) & (yi >= 0) & (yi < R); im[yi[ok], zi[ok]] = True
    from scipy import ndimage; return ndimage.binary_closing(ndimage.binary_dilation(im, iterations=1), iterations=2)

def encaixe(PF, PL):
    """procura a escala e o deslocamento em z da figura de lado que melhor cobre a silhueta de lado da de frente
    (só as patas e o tronco, onde as duas são iguais; a cauda da de lado fica de fora porque a de frente não tem)"""
    HF = PF[:, 1].max(); A = silh(PF, HF); zF = PF[:, 2].min()
    best = (-1, 1, 0)
    for sc in np.linspace(.7, 1.45, 31):
        Q = PL*sc
        for dz in np.linspace(-.45, .45, 61):
            Q2 = Q.copy(); Q2[:, 2] += dz; Q2 = Q2[Q2[:, 2] > zF]     # ignora o que passa atrás da de frente (cauda)
            B = silh(Q2, HF); iou = (A & B).sum()/max(1, (A | B).sum())
            if iou > best[0]: best = (iou, sc, dz)
    print('encaixe: iou', round(best[0], 3), 'escala', round(best[1], 3), 'dz', round(best[2], 3))
    return best[1], best[2]

def comp(I, n, P=None):
    if P is not None:   # junta vértices repetidos (costuras da textura) para a malha não se partir em pedaços
        _, w = np.unique(np.round(P, 5), axis=0, return_inverse=True); w = w.ravel(); I = w[I]; n = w.max()+1
        lab = comp(I, n); return lab[w]
    E = np.concatenate([I[:, [0, 1]], I[:, [1, 2]]]); G = coo_matrix((np.ones(len(E)), (E[:, 0], E[:, 1])), shape=(n, n))
    return connected_components(G, directed=False)[1]

def cor_media(img, UV, idx):
    A = np.asarray(img).astype(np.float64); S = A.shape[0]
    u = np.clip((UV[idx, 0]*(A.shape[1]-1)).astype(int), 0, A.shape[1]-1); v = np.clip((UV[idx, 1]*(S-1)).astype(int), 0, S-1)
    return A[v, u].reshape(-1, 3).mean(0)

def fatia(P, z, larg, H, xlim=None):
    """pontos do corpo numa fatia em z (sem asas: perto do meio em x)"""
    m = (np.abs(P[:, 2]-z) < larg) & (P[:, 1] > .06*H)
    if xlim is not None: m &= np.abs(P[:, 0]-np.median(P[m, 0]) if m.any() else 0) < xlim
    return P[m]

def pe_tras(P):
    H = P[:, 1].max(); Q = P[P[:, 1] < .05*H]; return np.percentile(Q[:, 2], 4), np.percentile(Q[:, 2], 96), H

TETO = float(os.environ.get('TETO', '1.1')); FINO = float(os.environ.get('FINO', '.035'))
def junta(fF, fL, out, dentro=.06, caixa=None):
    PF, UVF, IF, imF = le(fF); PL, UVL, IL, imL = le(fL); PL0 = PL.copy()
    HF = PF[:, 1].max()
    # 1) encaixa a de lado na de frente pela silhueta de lado das patas e do tronco (escala + deslocamento em z)
    s, dz = encaixe(PF, PL); PL = PL*s; PL[:, 2] += dz
    zF0, zF1, _ = pe_tras(PF); spF = zF1-zF0
    # meio do corpo em x: igual nas duas (fatia no quadril, sem as asas)
    sF = fatia(PF, zF0, .05*spF, HF, xlim=.15); sL = fatia(PL, zF0, .05*spF, HF, xlim=.15)
    if len(sF) and len(sL): PL[:, 0] += np.median(sF[:, 0])-np.median(sL[:, 0])
    # 2) corte: onde acaba o quadril da de frente (ela quase não tem cauda), um pouco para dentro
    corpo = (PF[:, 1] > .1*HF) & (np.abs(PF[:, 0]-np.median(sF[:, 0] if len(sF) else PF[:, 0])) < .15)
    zr = np.percentile(PF[corpo, 2], .5); zc = zr+dentro*spF
    T = IL[PL[IL][:, :, 2].max(1) < zc]
    lab = comp(T, len(PL), PL); ids = np.unique(lab[T[:, 0]])
    topo = np.percentile(sL[:, 1], 90) if len(sL) else HF*.6
    info = []
    for k in ids:
        tri = T[lab[T[:, 0]] == k]; Pc = PL[np.unique(tri)]
        perna = Pc[:, 1].min() < .05*HF and (Pc[:, 2].max()-Pc[:, 2].min()) < .2*spF
        asa = np.median(Pc[:, 1]) > topo*1.05
        toca = Pc[:, 2].max() > zc-.03*spF
        info.append((k, len(tri), perna, asa, toca))
    boas = [x for x in info if not x[2] and not x[3] and x[4]] or [x for x in info if not x[2] and not x[3]]
    if not boas and not caixa: raise SystemExit('sem cauda em '+fL)
    if boas: k = max(boas, key=lambda x: x[1])[0]; T = T[lab[T[:, 0]] == k]
    if caixa:   # caixa da cauda dada à mão (coordenadas da figura de lado: z < zmax e y < ymax), abaixo da asa
        zmax, ymax = caixa; dentro_cx = (PL0[IL][:, :, 2] < zmax).all(1) & (PL0[IL][:, :, 1] < ymax).all(1); T = IL[dentro_cx]
        lc = comp(T, len(PL), PL); idc, nc_ = np.unique(lc[T[:, 0]], return_counts=True); T = T[lc[T[:, 0]] == idc[nc_.argmax()]]
    # o pedaço de trás pode vir junto com as patas de trás e a ponta da asa: perto do corte, tira o que é baixo (patas)
    # e o que é alto (asa); depois fica o pedaço que vai mais longe para trás (a cauda)
    tc = PL[T].mean(1); perto = (tc[:, 2] > zc-.35*spF) & (caixa is None)
    T2 = T[~((perto & (tc[:, 1] < .5*topo)) | ((tc[:, 1] > topo*TETO) & (caixa is None)))]   # asa: tudo acima do quadril (a cauda fica mais baixa)
    if len(T2):
        l2 = comp(T2, len(PL), PL); ids2 = np.unique(l2[T2[:, 0]])
        tam = {i: (l2[T2[:, 0]] == i).sum() for i in ids2}; grandes = [i for i in ids2 if tam[i] > .1*max(tam.values())]
        k2 = min(grandes, key=lambda i: PL[np.unique(T2[l2[T2[:, 0]] == i]), 2].min()); T = T2[l2[T2[:, 0]] == k2]
    # asa = folha fina (as duas faces bem perto, viradas para lados opostos); a cauda é um tubo. Tira o que é fino e grande.
    if FINO > 0 and caixa is None:
        from scipy.spatial import cKDTree
        NL = normais(PL, IL); u = np.unique(T); tr = cKDTree(PL[u]); fino = np.zeros(len(PL), bool)
        for a_, viz in zip(u, tr.query_ball_point(PL[u], FINO*spF)):
            vv = u[viz]; fino[a_] = (NL[vv]@NL[a_] < -.5).any()
        tf = fino[T].all(1); T3 = T[~tf]
        if len(T3):
            l3 = comp(T3, len(PL), PL); ids3, n3 = np.unique(l3[T3[:, 0]], return_counts=True); T = T3[l3[T3[:, 0]] == ids3[n3.argmax()]]
        print('fino tirado:', int(tf.sum()), 'de', len(tf))
    used = np.unique(T); rm = -np.ones(len(PL), np.int64); rm[used] = np.arange(len(used))
    PT, UVT, IT = PL[used].copy(), UVL[used].copy(), rm[T]
    # 3) a base da cauda fica DENTRO do quadril: se ficou longe do corpo da de frente, aproxima
    base = PT[PT[:, 2] > PT[:, 2].max()-.04*spF].mean(0)
    from scipy.spatial import cKDTree
    d, j = cKDTree(PF[corpo]).query(base)
    if caixa:   # alvo: o fim do quadril da de frente, na altura do quadril, no meio do corpo; a base entra um pouco nele
        yq = np.percentile(sF[:, 1], 60) if len(sF) else HF*.3
        rab = PF[corpo & (np.abs(PF[:, 1]-yq) < .12*HF)]
        alvo = np.array([np.median(rab[:, 0]), yq, np.percentile(rab[:, 2], 1)+dentro*spF])
        PT += alvo-np.array([base[0], base[1], PT[:, 2].max()])
    elif d > .02: PT += (PF[corpo][j]-base)+np.array([0, 0, dentro*spF*.5])
    # 4) cor: a cauda puxa para a cor do quadril da de frente
    qF = np.nonzero((np.abs(PF[:, 2]-zr) < .1*spF) & corpo)[0]; qL = np.nonzero((np.abs(PL[:, 2]-zr) < .1*spF) & (PL[:, 1] > .1*HF))[0]
    ganho = np.clip(cor_media(imF, UVF, qF)/np.maximum(cor_media(imL, UVL, qL), 1), .8, 1.25) if len(qF) and len(qL) else np.ones(3)
    imL2 = Image.fromarray(np.clip(np.asarray(imL).astype(np.float64)*ganho, 0, 255).astype(np.uint8))
    W = max(imF.width, imL2.width); Hh = max(imF.height, imL2.height)
    at = Image.new('RGB', (W*2, Hh)); at.paste(imF.resize((W, Hh)), (0, 0)); at.paste(imL2.resize((W, Hh)), (W, 0))
    UVa = np.c_[UVF[:, 0]*.5, UVF[:, 1]]; UVb = np.c_[UVT[:, 0]*.5+.5, UVT[:, 1]]
    P = np.concatenate([PF, PT]); UV = np.concatenate([UVa, UVb]); I = np.concatenate([IF, IT+len(PF)])
    P[:, 1] -= P[:, 1].min()
    mn, mx = P.min(0), P.max(0); kk = .98/max(mx-mn); P = (P-np.array([(mn[0]+mx[0])/2, mn[1], (mn[2]+mx[2])/2]))*kk
    if os.environ.get('SO_CAUDA'): P, UV, I = P[len(PF):], UV[len(PF):], I[len(IF):]-len(PF)
    grava(out, P, normais(P, I), UV, I, at, q=86)
    print(os.path.basename(out), 'cauda', len(IT), 'tri; escala', round(s, 2), 'base longe', round(float(d), 3), 'pedaços', [(x[1], 'perna' if x[2] else 'asa' if x[3] else 'ok', bool(x[4])) for x in sorted(info, key=lambda x: -x[1])[:5]])

if __name__ == '__main__':
    a = [x for x in sys.argv[1:] if not x.startswith('--')]; d = float(sys.argv[sys.argv.index('--dentro')+1]) if '--dentro' in sys.argv else .06
    if '--dentro' in sys.argv: a.remove(str(d)) if str(d) in a else None
    cx = os.environ.get('CAIXA'); junta(a[0], a[1], a[2], d, [float(v) for v in cx.split(',')] if cx else None)
