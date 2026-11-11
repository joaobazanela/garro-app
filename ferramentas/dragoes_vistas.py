"""GARRO — dragões 3D (cor por vértice) corrigidos pelas 4 vistas de referência (frente, costas, esquerda, direita).
Os modelos 3D vêm com cores lavadas/claras; as vistas PNG são a arte certa vista de 4 lados. Para cada vértice:
  • projeta nas 4 vistas (projeção paralela; a silhueta do modelo é encaixada na silhueta do desenho em cada vista);
  • só usa a vista em que o vértice aparece (teste de profundidade) e está virado para ela (peso pela normal);
  • mistura as vistas pelo peso; onde nenhuma vê bem, fica a cor original escurecida (sRGB -> linear, como as vistas).
Depois reduz a malha (meshoptimizer) para o celular e grava um .glb leve com cor por vértice, pés em y=0, olhando +z.
Uso: python3 -I ferramentas/dragoes_vistas.py pasta_glb pasta_png pasta_saida [nome,nome...] [--alvo 40000]"""
import sys, os, json, struct, io, glob, numpy as np
from PIL import Image
from scipy import ndimage as ndi
AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(AQUI, 'tripo'))

CT = {5126: '<f4', 5121: 'u1', 5123: '<u2', 5125: '<u4'}; NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}
def le(f):
    d = open(f, 'rb').read(); l = struct.unpack('<I', d[12:16])[0]; j = json.loads(d[20:20+l]); b = d[20+l+8:]
    def acc(i):
        a = j['accessors'][i]; bv = j['bufferViews'][a['bufferView']]; n = NC[a['type']]
        r = np.frombuffer(b, dtype=CT[a['componentType']], count=a['count']*n, offset=bv.get('byteOffset', 0)+a.get('byteOffset', 0)).reshape(a['count'], n).copy()
        if a.get('normalized'): r = r.astype(np.float32)/{5121: 255., 5123: 65535.}[a['componentType']]
        return r
    p = j['meshes'][0]['primitives'][0]
    return (acc(p['attributes']['POSITION']).astype(np.float64), acc(p['attributes']['COLOR_0'])[:, :3].astype(np.float64),
            acc(p['indices']).reshape(-1, 3).astype(np.int64))

def normais(P, I):
    N = np.zeros_like(P); t = P[I]; fn = np.cross(t[:, 1]-t[:, 0], t[:, 2]-t[:, 0])
    for k in range(3): np.add.at(N, I[:, k], fn)
    return N/(np.linalg.norm(N, axis=1, keepdims=True)+1e-12)

# vista: (u na tela, profundidade para a câmera, direção da câmera); v = y sempre
VISTAS = {'frente': (lambda P: P[:, 0], lambda P: P[:, 2], (0, 0, 1)),
          'costas': (lambda P: -P[:, 0], lambda P: -P[:, 2], (0, 0, -1)),
          'esquerda': (lambda P: -P[:, 2], lambda P: P[:, 0], (1, 0, 0)),
          'direita': (lambda P: P[:, 2], lambda P: -P[:, 0], (-1, 0, 0))}

PESO = {'frente': .6, 'costas': .6, 'esquerda': 1, 'direita': 1}
def srgb2lin(c): return np.where(c <= .04045, c/12.92, ((c+.055)/1.055)**2.4)

def tri_zbuf(pu, pv, dz, I, W, H):
    """profundidade máxima (mais perto da câmera) por pixel, rasterizando os triângulos (vetorizado por tamanho)"""
    Z = np.full((H, W), -1e9)
    t = I; x = pu[t]; y = pv[t]; z = dz[t]
    x0 = np.floor(x.min(1)).astype(int); x1 = np.ceil(x.max(1)).astype(int); y0 = np.floor(y.min(1)).astype(int); y1 = np.ceil(y.max(1)).astype(int)
    span = np.maximum(x1-x0, y1-y0)+1
    for s in np.unique(span):
        k = np.nonzero(span == s)[0]
        if s > 40: k = k[:0]
        if len(k) == 0: continue
        gx, gy = np.meshgrid(np.arange(s), np.arange(s)); gx = gx.ravel(); gy = gy.ravel()
        for c in np.array_split(k, max(1, len(k)*len(gx)//4_000_000+1)):
            X = x0[c, None]+gx[None]+.5; Y = y0[c, None]+gy[None]+.5
            ax, ay, bx, by, cx, cy = x[c, 0, None], y[c, 0, None], x[c, 1, None], y[c, 1, None], x[c, 2, None], y[c, 2, None]
            d = (by-cy)*(ax-cx)+(cx-bx)*(ay-cy); d = np.where(np.abs(d) < 1e-12, 1e-12, d)
            l1 = ((by-cy)*(X-cx)+(cx-bx)*(Y-cy))/d; l2 = ((cy-ay)*(X-cx)+(ax-cx)*(Y-cy))/d; l3 = 1-l1-l2
            m = (l1 >= -1e-3) & (l2 >= -1e-3) & (l3 >= -1e-3)
            zz = l1*z[c, 0, None]+l2*z[c, 1, None]+l3*z[c, 2, None]
            Xi = X.astype(int); Yi = Y.astype(int); m &= (Xi >= 0) & (Xi < W) & (Yi >= 0) & (Yi < H)
            np.maximum.at(Z, (Yi[m], Xi[m]), zz[m])
    return Z

def pinta(P, C, I, pasta, nome, diag=None):
    N = normais(P, I); acc = np.zeros((len(P), 3)); wsum = np.zeros(len(P)); info = {}
    for vn, (fu, fz, cd) in VISTAS.items():
        A = np.asarray(Image.open(f'{pasta}/{nome}_{vn}.png').convert('RGBA')).astype(np.float64)/255; H, W = A.shape[:2]
        al = A[..., 3] > .5; ys, xs = np.nonzero(al); x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
        U = fu(P); V = P[:, 1]; D = fz(P)
        # escala única (o desenho não estica): encaixa pela altura e centraliza pela largura
        sy = (y1-y0)/(V.max()-V.min()); sx = (x1-x0)/(U.max()-U.min()); s = (sx+sy)/2
        pu = (x0+x1)/2+(U-(U.max()+U.min())/2)*s; pv = y1-(V-V.min())*s
        Z = tri_zbuf(pu, pv, D*s, I, W, H)
        iu = np.clip(pu.astype(int), 0, W-1); iv = np.clip(pv.astype(int), 0, H-1)
        vis = D*s >= Z[iv, iu]-2.5                       # 2,5 px de tolerância
        bom = ndi.binary_erosion(al, iterations=3)
        dn = N@np.array(cd, float); w = np.clip((dn-.55)/.45, 0, 1)**2*vis*bom[iv, iu]*PESO.get(vn, 1)
        col = srgb2lin(A[iv, iu, :3])                    # as vistas estão em sRGB; a cor do vértice é linear
        acc += col*w[:, None]; wsum += w
        mod = Z > -1e8; iou = (mod & al).sum()/max(1, (mod | al).sum()); info[vn] = round(float(iou), 3)
        if diag is not None:
            im = np.zeros((H, W, 3), np.uint8); im[al] = (0, 120, 255); im[mod] += np.array((200, 0, 0), np.uint8); Image.fromarray(im).resize((256, 256)).save(f'{diag}/{nome}_{vn}_enc.png')
    base = srgb2lin(C)
    a = np.clip(wsum/.35, 0, 1)[:, None]
    novo = np.where(wsum[:, None] > 1e-6, acc/np.maximum(wsum, 1e-6)[:, None], base)*a+base*(1-a)
    # preenche vértices que não receberam nada olhando os vizinhos (borda entre vistas), 3 passos
    E = np.concatenate([I[:, [0, 1]], I[:, [1, 2]], I[:, [2, 0]]]); E = np.concatenate([E, E[:, ::-1]])
    for _ in range(3):
        s = np.zeros_like(novo); c = np.zeros(len(P)); np.add.at(s, E[:, 0], novo[E[:, 1]]); np.add.at(c, E[:, 0], 1)
        fraco = wsum < .05; novo[fraco] = (s[fraco]/np.maximum(c[fraco], 1)[:, None])*.6+novo[fraco]*.4
    return novo, info, float((wsum > .05).mean())

def tira_placa(P, C, I, alt=.12):
    """a sombra branca do chão da arte virou uma 'placa' clara ligando as patas: apaga as faces claras e sem cor perto do chão
    (e os pedacinhos soltos que sobram)"""
    H = P[:, 1].max(); br = C.mean(1); sat = C.max(1)-C.min(1)
    cl = (P[:, 1] < alt*H) & (br > .55) & (sat < .3)
    I = I[~cl[I].all(1)]
    # pedaços pequenos soltos
    from scipy.sparse import coo_matrix; from scipy.sparse.csgraph import connected_components
    E = np.concatenate([I[:, [0, 1]], I[:, [1, 2]]]); G = coo_matrix((np.ones(len(E)), (E[:, 0], E[:, 1])), shape=(len(P), len(P)))
    _, lab = connected_components(G, directed=False); cnt = np.bincount(lab[I[:, 0]], minlength=lab.max()+1)
    return I[cnt[lab[I[:, 0]]] > len(I)*.002]

def tira_base(P, C, I, alt=.05):
    """a 'sombra/chão' branco da arte virou geometria clara sob os pés: pinta esses vértices com a cor dos vizinhos (garras/pele)"""
    H = P[:, 1].max(); br = C.mean(1); sat = C.max(1)-C.min(1)
    m = (P[:, 1] < alt*H) & (br > .55) & (sat < .25)
    E = np.concatenate([I[:, [0, 1]], I[:, [1, 2]], I[:, [2, 0]]]); E = np.concatenate([E, E[:, ::-1]])
    C = C.copy(); ok = ~m
    for _ in range(60):
        if ok.all(): break
        s_ = np.zeros_like(C); c = np.zeros(len(C)); e = E[ok[E[:, 1]] & ~ok[E[:, 0]]]
        np.add.at(s_, e[:, 0], C[e[:, 1]]); np.add.at(c, e[:, 0], 1); novo = c > 0; C[novo] = s_[novo]/c[novo, None]; ok |= novo
    return C, int(m.sum())

COR_PESO = float(os.environ.get('COR_PESO', '1'))
def simplifica(P, I, alvo, C):
    import ctypes
    L = ctypes.CDLL(os.environ.get('LIBMESHOPT') or os.path.join(AQUI, 'tripo', 'libmeshopt.so')); L.meshopt_simplify.restype = ctypes.c_size_t
    V = np.ascontiguousarray(P.astype(np.float32)); J = np.ascontiguousarray(I.astype(np.uint32).ravel()); out = np.zeros_like(J); err = ctypes.c_float(0)
    # leva a cor em conta (sem isso a redução borrava a cor em listras)
    A = np.ascontiguousarray(C.astype(np.float32)); Wt = (ctypes.c_float*3)(*[COR_PESO]*3); L.meshopt_simplifyWithAttributes.restype = ctypes.c_size_t
    n = L.meshopt_simplifyWithAttributes(out.ctypes.data_as(ctypes.c_void_p), J.ctypes.data_as(ctypes.c_void_p), ctypes.c_size_t(len(J)), V.ctypes.data_as(ctypes.c_void_p),
                           ctypes.c_size_t(len(V)), ctypes.c_size_t(12), A.ctypes.data_as(ctypes.c_void_p), ctypes.c_size_t(12), Wt, ctypes.c_size_t(3), None,
                           ctypes.c_size_t(int(alvo)*3), ctypes.c_float(0.02), ctypes.c_uint(0), ctypes.byref(err))
    T = out[:n].reshape(-1, 3).astype(np.int64); used = np.unique(T); rm = -np.ones(len(V), np.int64); rm[used] = np.arange(len(used))
    return used, rm[T]

def grava(f, P, N, C, I):
    parts = []; views = []; acc = []; off = 0
    def add(b, target):
        nonlocal off; pad = (-len(b)) % 4; views.append(dict(buffer=0, byteOffset=off, byteLength=len(b), target=target)); parts.append(b+b'\0'*pad); off += len(b)+pad; return len(views)-1
    P = P.astype(np.float32); N = N.astype(np.float32); Cb = np.clip(np.round(np.concatenate([C, np.ones((len(C), 1))], 1)*255), 0, 255).astype(np.uint8)
    acc.append(dict(bufferView=add(P.tobytes(), 34962), componentType=5126, count=len(P), type='VEC3', min=P.min(0).tolist(), max=P.max(0).tolist()))
    acc.append(dict(bufferView=add(N.tobytes(), 34962), componentType=5126, count=len(N), type='VEC3'))
    acc.append(dict(bufferView=add(Cb.tobytes(), 34962), componentType=5121, normalized=True, count=len(Cb), type='VEC4'))
    It = I.astype(np.uint32 if len(P) > 65535 else np.uint16).ravel()
    acc.append(dict(bufferView=add(It.tobytes(), 34963), componentType=5125 if It.dtype == np.uint32 else 5123, count=len(It), type='SCALAR'))
    j = dict(asset=dict(version='2.0', generator='GARRO dragoes_vistas'), scene=0, scenes=[dict(nodes=[0])], nodes=[dict(mesh=0, name=os.path.basename(f)[:-4])],
             meshes=[dict(primitives=[dict(attributes=dict(POSITION=0, NORMAL=1, COLOR_0=2), indices=3, material=0)])],
             materials=[dict(name='garro_cor_vertice', pbrMetallicRoughness=dict(baseColorFactor=[1, 1, 1, 1], metallicFactor=0, roughnessFactor=.9))],
             accessors=acc, bufferViews=views, buffers=[dict(byteLength=off)])
    js = json.dumps(j, separators=(',', ':')).encode(); js += b' '*((-len(js)) % 4); bin_ = b''.join(parts)
    with open(f, 'wb') as o:
        o.write(struct.pack('<III', 0x46546C67, 2, 12+8+len(js)+8+len(bin_))); o.write(struct.pack('<II', len(js), 0x4E4F534A)); o.write(js)
        o.write(struct.pack('<II', len(bin_), 0x004E4942)); o.write(bin_)

if __name__ == '__main__':
    a = [x for x in sys.argv[1:] if not x.startswith('--')]; alvo = int(sys.argv[sys.argv.index('--alvo')+1]) if '--alvo' in sys.argv else 40000
    if '--alvo' in sys.argv: a.remove(str(alvo))
    src, png, dst = a[:3]; nomes = a[3].split(',') if len(a) > 3 else sorted(os.path.basename(f)[:-4] for f in glob.glob(src+'/*.glb'))
    diag = os.environ.get('DIAG'); os.makedirs(dst, exist_ok=True)
    for n in nomes:
        P, C, I = le(f'{src}/{n}.glb')
        I = tira_placa(P, C, I)
        C, nb = tira_base(P, C, I)
        if '--so-cor' in sys.argv: novo, info, cob = srgb2lin(C), {}, 1.0
        else: novo, info, cob = pinta(P, C, I, png, n, diag)
        used, T = simplifica(P, I, alvo, novo); P2 = P[used]; C2 = novo[used]; P2[:, 1] -= P2[:, 1].min()
        grava(f'{dst}/{n}.glb', P2, normais(P2, T), C2, T)
        print(n, 'encaixe', info, 'coberto', round(cob*100), '%', 'tri', len(I), '->', len(T), os.path.getsize(f'{dst}/{n}.glb')//1000, 'KB')
