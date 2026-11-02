"""GARRO — Astrakai deitada (serpente que desliza), a partir do modelo enrolado do Tripo.
O modelo original veio enrolado em pé e com o rabo encostando no corpo, o que impede "desenrolar" a malha.
Então: a CABEÇA do modelo original (com a textura do Tripo) é mantida e o CORPO é refeito como um tubo
deitado em onda (como na imagem de referência): escamas azuis com contorno dourado e estrelinhas, barriga de
placas claras, espinhos dourados no dorso, argolas douradas e espinhos roxos na ponta do rabo.
O tubo tem a coordenada "s" (0 = pescoço, 1 = ponta do rabo) na UV, e o jogo faz a onda de cobra no shader.
Uso: python3 ferramentas/astrakai_deitada.py astrakai_enrolada.glb models/lendarios/astrakai.glb"""
import sys, io, json, struct, numpy as np
from PIL import Image
from scipy.spatial import cKDTree

# ---------- leitura/escrita GLB (uma malha, uma textura) ----------
CT = {5126: '<f4', 5121: 'u1', 5123: '<u2', 5125: '<u4'}; NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}
def le(f):
    d = open(f, 'rb').read(); l = struct.unpack('<I', d[12:16])[0]; j = json.loads(d[20:20+l]); b = d[20+l+8:]
    def acc(i):
        a = j['accessors'][i]; bv = j['bufferViews'][a['bufferView']]; n = NC[a['type']]
        r = np.frombuffer(b, dtype=CT[a['componentType']], count=a['count']*n, offset=bv.get('byteOffset', 0)+a.get('byteOffset', 0)).reshape(a['count'], n).copy()
        if a.get('normalized'): r = r.astype(np.float64)/{5121: 255., 5123: 65535.}[a['componentType']]
        return r
    p = j['meshes'][0]['primitives'][0]
    P = acc(p['attributes']['POSITION']).astype(np.float64); UV = acc(p['attributes']['TEXCOORD_0']).astype(np.float64)
    I = acc(p['indices']).reshape(-1, 3).astype(np.int64)
    im = j['images'][0]; bv = j['bufferViews'][im['bufferView']]
    img = Image.open(io.BytesIO(b[bv.get('byteOffset', 0):bv.get('byteOffset', 0)+bv['byteLength']])).convert('RGB')
    return P, UV, I, img
def normais(P, I):
    N = np.zeros_like(P); t = P[I]; fn = np.cross(t[:, 1]-t[:, 0], t[:, 2]-t[:, 0])
    for k in range(3): np.add.at(N, I[:, k], fn)
    key = np.round(P, 5); _, w = np.unique(key, axis=0, return_inverse=True); w = w.ravel(); S = np.zeros((w.max()+1, 3)); np.add.at(S, w, N); N = S[w]
    return N/(np.linalg.norm(N, axis=1, keepdims=True)+1e-12)
def grava(f, P, N, UV, I, img, q=85):
    buf = io.BytesIO(); img.save(buf, 'JPEG', quality=q); jb = buf.getvalue(); parts = []; views = []; acc = []; off = 0
    def add(arr, target=None):
        nonlocal off; b = arr.tobytes(); pad = (-len(b)) % 4; views.append(dict(buffer=0, byteOffset=off, byteLength=len(b), **({'target': target} if target else {}))); parts.append(b+b'\0'*pad); off += len(b)+pad; return len(views)-1
    P = P.astype(np.float32); N = N.astype(np.float32); UV = UV.astype(np.float32)
    for arr, typ in ((P, 'VEC3'), (N, 'VEC3'), (UV, 'VEC2')):
        a = dict(bufferView=add(arr, 34962), componentType=5126, count=len(arr), type=typ)
        if arr is P: a['min'] = P.min(0).tolist(); a['max'] = P.max(0).tolist()
        acc.append(a)
    Ii = I.astype(np.uint32).ravel(); acc.append(dict(bufferView=add(Ii, 34963), componentType=5125, count=len(Ii), type='SCALAR'))
    iv = add(np.frombuffer(jb, np.uint8))
    j = {'asset': {'version': '2.0', 'generator': 'GARRO astrakai_deitada'}, 'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': [{'mesh': 0}],
         'meshes': [{'primitives': [{'attributes': {'POSITION': 0, 'NORMAL': 1, 'TEXCOORD_0': 2}, 'indices': 3, 'material': 0}]}],
         'materials': [{'pbrMetallicRoughness': {'baseColorTexture': {'index': 0}, 'metallicFactor': 0, 'roughnessFactor': .85}}],
         'textures': [{'source': 0, 'sampler': 0}], 'samplers': [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 33071, 'wrapT': 33071}],
         'images': [{'bufferView': iv, 'mimeType': 'image/jpeg'}], 'accessors': acc, 'bufferViews': views, 'buffers': [{'byteLength': off}]}
    js = json.dumps(j, separators=(',', ':')).encode(); js += b' '*((-len(js)) % 4); bin_ = b''.join(parts)
    open(f, 'wb').write(struct.pack('<III', 0x46546C67, 2, 12+8+len(js)+8+len(bin_))+struct.pack('<I', len(js))+b'JSON'+js+struct.pack('<I', len(bin_))+b'BIN\0'+bin_)

rng = np.random.default_rng(52)
def ss(e0, e1, x): t = np.clip((x-e0)/(e1-e0), 0, 1); return t*t*(3-2*t)
def cor(h): return np.array([int(h[i:i+2], 16) for i in (1, 3, 5)], float)/255

def textura_corpo(W=2048, H=1024):
    """x = ao longo do corpo (pescoço → rabo), y = em volta (0 = dorso, 0,5 = barriga)"""
    yy, xx = np.mgrid[0:H, 0:W].astype(float)
    a = yy/H; s = xx/W
    # escamas: Voronoi periódico em volta do corpo, células alongadas (~26 px)
    pts = np.c_[rng.random(1100)*W, rng.random(1100)*H]
    t = cKDTree(pts, boxsize=[W*4, H]); d, i = t.query(np.c_[xx.ravel(), yy.ravel()], k=2)
    f1 = d[:, 0].reshape(H, W); f2 = d[:, 1].reshape(H, W); idx = i[:, 0].reshape(H, W)
    borda = f2-f1; var = (np.sin(idx*12.9898)*43758.5453) % 1
    azuis = np.array([cor('#2a46d0'), cor('#3460ea'), cor('#2238b8'), cor('#3c74f0'), cor('#3a90f4'), cor('#3a4ad8')])
    base = azuis[(var*len(azuis)).astype(int) % len(azuis)]
    brilho = (1-np.clip(f1/34, 0, 1))[..., None]*.45            # centro da escama mais claro
    base = base*(.75+brilho)
    cx = pts[idx, 0]; sombra = np.clip((xx-cx)/26, 0, 1)[..., None]*.35   # lado de trás da escama mais escuro (parece sobreposta)
    base = base*(1-sombra)
    roxo = ss(.7, 1, s)[..., None]; base = base*(1-roxo*.5)+cor('#7a3ae0')*roxo*.5   # rabo puxando para o roxo
    ouro = (1-ss(1.5, 4.0, borda))[..., None]
    c = base*(1-ouro*.85)+cor('#e0b048')*ouro*.85
    # estrelinhas
    est = (rng.random((H, W)) > .9988)
    from scipy.ndimage import gaussian_filter, maximum_filter
    e = gaussian_filter(maximum_filter(est.astype(float), 3), 1.0); e = (e/e.max()).clip(0, 1)[..., None]*(1-ss(.3, .4, np.abs(a-.5)))[..., None]
    c = c*(1-e)+e
    # barriga: placas claras em faixas
    barr = (1-ss(.11, .145, np.abs(a-.5)))[..., None]
    faixa = (xx % 44)/44; placa = 1-ss(.82, .98, faixa)*.35-(1-ss(0, .1, faixa))*.2
    bc = (cor('#e8d3a0')*(1-np.abs(a-.5)[..., None]*5)+cor('#c4a670')*(np.abs(a-.5)[..., None]*5)).clip(0,1)*placa[..., None]
    c = c*(1-barr)+bc*barr
    return Image.fromarray((c.clip(0, 1)*255).astype(np.uint8))

def catmull(pts, n):
    pts = np.asarray(pts, float); P = np.vstack([pts[0]*2-pts[1], pts, pts[-1]*2-pts[-2]]); out = []
    for k in range(1, len(P)-2):
        for t in np.linspace(0, 1, n, endpoint=False):
            p0, p1, p2, p3 = P[k-1:k+3]
            out.append(.5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t**3))
    out.append(P[-2]); return np.array(out)

def frames(C):
    T = np.gradient(C, axis=0); T /= np.linalg.norm(T, axis=1, keepdims=True); N = np.zeros_like(T)
    up = np.array([0, 1., 0]); n0 = up-T[0]*T[0].dot(up); N[0] = n0/np.linalg.norm(n0)
    for k in range(1, len(C)):
        v = N[k-1]-T[k]*T[k].dot(N[k-1]); v /= np.linalg.norm(v)
        w = up-T[k]*T[k].dot(up); nw = np.linalg.norm(w)
        if nw > .45: v = w/nw                                  # trecho deitado: dorso sempre para cima (sem torção)
        N[k] = v
    return T, N, np.cross(T, N)

def main(src, dst):
    P, UV, I, img = le(src)
    # ---- cabeça: tudo à frente da nuca (z > -0,02) e acima de y 0,62 ----
    C = P[I].mean(1); m = (C[:, 2] > -.02) & (C[:, 1] > .62)
    Ic = I[m]; used = np.unique(Ic); rm = -np.ones(len(P), int); rm[used] = np.arange(len(used))
    Ph, UVh, Ih = P[used], UV[used], rm[Ic]
    nuca = Ph[np.abs(Ph[:, 2]+.01) < .03]; c0 = np.array([0, np.median(nuca[:, 1]), -.02]); r0 = np.median(np.abs(nuca[:, 1]-c0[1]))*1.45
    alvo = np.array([0, .40, .40]); Ph = Ph+(alvo-c0)
    # ---- eixo do corpo: S deitada (como na referência), pescoço descendo até o chão e rabo um pouco erguido ----
    ctrl = [alvo+[0, .01, .11], alvo+[0, 0, .03], alvo+[0, -.04, -.12], [0, .25, .19], [0, .12, .08], [.05, .085, -.10], [.12, .08, -.36], [-.05, .075, -.63],
            [-.11, .07, -.86], [.04, .065, -1.10], [.09, .07, -1.30], [.02, .12, -1.47]]
    Cc = catmull(ctrl, 18); seg = np.linalg.norm(np.diff(Cc, axis=0), axis=1); arc = np.r_[0, np.cumsum(seg)]; L = arc[-1]
    n = 260; sq = np.linspace(0, L, n); Cc = np.array([np.interp(sq, arc, Cc[:, j]) for j in range(3)]).T; s = sq/L
    rr = np.where(s < .15, r0+(.125-r0)*ss(0, .15, s), .125)*np.where(s > .55, 1-ss(.55, 1.0, s)*.9, 1); rr = np.maximum(rr, .009)
    Cc[:, 1] = np.maximum(Cc[:, 1], rr*.92)
    T, N, B = frames(Cc)
    M = 28; ang = np.linspace(0, 2*np.pi, M+1)                       # 0 = dorso (N = cima), pi = barriga
    V = []; UVb = []
    for k in range(n):
        for q in range(M+1):
            th = ang[q]; off = N[k]*np.cos(th)*rr[k]*.95+B[k]*np.sin(th)*rr[k]*1.06
            V.append(Cc[k]+off); UVb.append([s[k], q/M])
    V = np.array(V); UVb = np.array(UVb); Ib = []
    for k in range(n-1):
        for q in range(M):
            a = k*(M+1)+q; b = a+M+1; Ib += [[a, a+1, b], [a+1, b+1, b]]            # normais para fora
    Ib = np.array(Ib)
    # ponta do rabo fechada
    tip = len(V); V = np.vstack([V, Cc[-1]+T[-1]*.01]); UVb = np.vstack([UVb, [1, .5]]); Ib = np.vstack([Ib, [[(n-1)*(M+1)+q, (n-1)*(M+1)+q+1, tip] for q in range(M)]])
    # ---- espinhos dourados no dorso, argolas e espinhos roxos no rabo ----
    extra = []
    def cone(base, dirv, h, r, seg=6):
        dirv = dirv/np.linalg.norm(dirv); a = np.cross(dirv, [1, 0, 0]); a = a/np.linalg.norm(a) if np.linalg.norm(a) > 1e-6 else np.array([0, 0, 1.]); b2 = np.cross(dirv, a)
        vs = [base+(a*np.cos(t)+b2*np.sin(t))*r for t in np.linspace(0, 2*np.pi, seg, endpoint=False)]+[base+dirv*h]
        fs = [[q, (q+1) % seg, seg] for q in range(seg)]; return np.array(vs), np.array(fs)
    def toro(c, t_, rad, tub, seg=24, ts=6):
        t_ = t_/np.linalg.norm(t_); a = np.cross(t_, [0, 1, 0]); a = a/np.linalg.norm(a) if np.linalg.norm(a) > 1e-6 else np.array([1, 0, 0.]); b2 = np.cross(t_, a); vs = []; fs = []
        for i in range(seg):
            u = i/seg*2*np.pi; ctr = c+(a*np.cos(u)+b2*np.sin(u))*rad; rd = (a*np.cos(u)+b2*np.sin(u))
            for j in range(ts):
                v = j/ts*2*np.pi; vs.append(ctr+rd*np.cos(v)*tub+t_*np.sin(v)*tub*1.6)
        for i in range(seg):
            for j in range(ts):
                a1 = i*ts+j; b1 = ((i+1) % seg)*ts+j; a2 = i*ts+(j+1) % ts; b3 = ((i+1) % seg)*ts+(j+1) % ts; fs += [[a1, b1, a2], [a2, b1, b3]]
        return np.array(vs), np.array(fs)
    OURO = (.75, .12); ROXO = (.75, .37)
    for sk in np.arange(.13, .97, .045):
        k = int(sk*(n-1)); h = .12*(1-sk*.55)*(1.15 if int(sk/.045) % 2 else .85); base = Cc[k]+N[k]*rr[k]*.85
        extra.append(cone(base, N[k]*.8-T[k]*.6, h, .022*(1-sk*.4))+(OURO,))
    for sk in (.17, .43, .67, .85):
        k = int(sk*(n-1)); extra.append(toro(Cc[k], T[k], rr[k]*1.07, .011+.006*(1-sk))+(OURO,))
    for q, (sk, ab) in enumerate([(.95, -.5), (.97, .5), (.985, 0.), (1., 0.)]):
        k = min(n-1, int(sk*(n-1))); extra.append(cone(Cc[k]+N[k]*rr[k]*.6, N[k]*.9+B[k]*ab-T[k]*.5, .06, .008)+(ROXO,))
    # ---- atlas 2048: cabeça (textura original) no canto, corpo embaixo, ouro e roxo no outro canto ----
    A = Image.new('RGB', (2048, 2048), (40, 50, 160)); A.paste(img.resize((1024, 1024), Image.LANCZOS), (0, 0))
    A.paste(textura_corpo(), (0, 1024))
    g = np.linspace(0, 1, 512)[:, None]*np.ones((1, 1024)); ouro = (cor('#fff0a0')*(1-g[..., None])+cor('#b07818')*g[..., None]); A.paste(Image.fromarray((ouro*255).astype(np.uint8)), (1024, 0))
    roxo = (cor('#e8a0ff')*(1-g[..., None])+cor('#6a2ac8')*g[..., None]); A.paste(Image.fromarray((roxo*255).astype(np.uint8)), (1024, 512))
    UVh2 = UVh*.5
    UVb2 = np.c_[.003+UVb[:, 0]*.994, .5+.004+UVb[:, 1]*.492]
    Vs = [Ph, V]; UVs = [UVh2, UVb2]; Is = [Ih, Ib+len(Ph)]; off = len(Ph)+len(V)
    for vs, fs, (u0, v0) in extra:
        Vs.append(vs); UVs.append(np.tile([u0, v0+.1*rng.random()], (len(vs), 1))); Is.append(fs+off); off += len(vs)
    Pn = np.vstack(Vs); UVn = np.vstack(UVs); In = np.vstack(Is)
    Pn[:, 1] -= Pn[:, 1].min()
    grava(dst, Pn, normais(Pn, In), UVn, In, A)
    print('ok', dst, len(Pn), 'vértices', len(In), 'triângulos', 'tamanho', Pn.min(0).round(2), Pn.max(0).round(2))

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
