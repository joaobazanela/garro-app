"""GARRO — Bolinhas (redondos novos): uma bolinha de cada bichinho grande (ids 20+k ↔ grande k), feitas a partir
da folha de arte (5 colunas × 4 linhas, com o nome embaixo, fundo cinza; mesma ordem dos grandes 0..19).

Para cada bolinha gera:
  • img/bolinhas/<slug>.webp — o recorte com transparência (arte de referência);
  • data/sprites.json → SPRITES[20+k] (imagem da máquina, lado maior 210, com o contorno "hull" para a física);
  • data/sprites_luta.json → BSPR[20+k] (imagem da batalha);
  • (com --3d) models/bolinhas/<slug>.glb — 3D simples: a silhueta da arte "inflada" (frente = a própria arte; costas = a arte espelhada
    sem o rosto), costuradas na borda exata da silhueta, olhando para +z e apoiada em y = 0.

Uso: python3 ferramentas/bolinhas.py folha_bolinhas.png [--3d]
Os modelos 3D usados no jogo são os do Tripo (folha 3D das 20 bolinhas separada em 20 arquivos leves, ~14 mil triângulos cada)."""
import sys, os, io, json, base64, struct, unicodedata
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi
from scipy.spatial import ConvexHull

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LINHAS = [(0, 246), (278, 502), (532, 742), (780, 982)]   # faixas das figuras (sem os nomes) numa folha 1536 × 1024

def slug(s): return unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower().replace(' ', '_')

# ---------- recorte: fundo cinza estimado (local por célula e global), sombra neutra fora ----------
def recorta(im):
    Hh, Ww, _ = im.shape; YY, XX = np.mgrid[0:Hh, 0:Ww]; xn = XX/Ww-.5; yn = YY/Hh-.5
    B = np.stack([xn**i*yn**j for i in range(5) for j in range(5-i)], -1).reshape(-1, 15)
    sel = np.where(((im.max(2)-im.min(2)) < 9).ravel())[0][::7]
    for _ in range(4):
        co = [np.linalg.lstsq(B[sel], im[..., k].ravel()[sel], rcond=None)[0] for k in range(3)]
        BG = np.stack([(B@c).reshape(Hh, Ww) for c in co], -1)
        res = np.abs(im-BG).mean(2).ravel(); sel = sel[res[sel] < 10]
    def mascara(a, bg):
        diff = a-bg; lum = diff.mean(2); chroma = np.abs(diff-lum[..., None]).sum(2); sat = a.max(2)-a.min(2)
        m = (chroma > 22) | (np.abs(lum) > 30) | (sat > 28)
        m &= ~((sat < 26) & (lum < 0) & (lum > -75) & (chroma < 22))                  # sombra no chão
        m = ndi.binary_opening(m, iterations=1); lab, n = ndi.label(m)
        if n == 0: return m
        sz = ndi.sum(m, lab, range(1, n+1)); m = np.isin(lab, 1+np.where(sz > max(sz.max()*.04, 150))[0])
        return ndi.binary_fill_holes(ndi.binary_closing(m, iterations=3))
    def borda(m): return m[:4].mean()+m[-4:].mean()+m[:, :4].mean()+m[:, -4:].mean()
    out = []
    W5 = Ww/5
    for r in range(4):
        for c in range(5):
            y0, y1 = LINHAS[r]; x0, x1 = int(c*W5), int((c+1)*W5); a = im[y0:y1, x0:x1]; H, Wd, _ = a.shape
            yy, xx = np.mgrid[0:H, 0:Wd]; band = (xx < 22) | (xx > Wd-23) | (yy < 14) | (yy > H-15)
            Af = np.stack([np.ones_like(xx), xx/Wd, yy/H, xx*yy/(Wd*H), (xx/Wd)**2, (yy/H)**2], -1).reshape(-1, 6)
            s2 = np.where((band & ((a.max(2)-a.min(2)) < 12)).ravel())[0]
            for _ in range(4):
                bg = np.stack([(Af@np.linalg.lstsq(Af[s2], a[..., k].ravel()[s2], rcond=None)[0]).reshape(H, Wd) for k in range(3)], -1)
                rr = np.abs(a-bg).mean(2).ravel(); s2 = s2[rr[s2] < np.percentile(rr[s2], 85)+2]
            m = min([mascara(a, bg), mascara(a, BG[y0:y1, x0:x1])], key=lambda m: (round(borda(m), 2), m.mean()))
            # borda macia: tira 1 px (franja cinza) e suaviza
            al = ndi.gaussian_filter(ndi.binary_erosion(m, iterations=1).astype(float), .7)
            ys, xs = np.where(m); bb = (max(0, xs.min()-2), max(0, ys.min()-2), min(Wd, xs.max()+3), min(H, ys.max()+3))
            rgba = np.dstack([a, al*255]).clip(0, 255).astype(np.uint8)
            out.append(Image.fromarray(rgba).crop(bb))
    return out

# ---------- contorno simplificado (fração da largura/altura), como o resto do jogo ----------
def hull(img, n=12):
    al = np.asarray(img)[..., 3] > 100; ys, xs = np.where(al); P = np.c_[xs/img.width, ys/img.height]
    h = P[ConvexHull(P).vertices]
    while len(h) > n:
        ar = [abs((lambda u, v: u[0]*v[1]-u[1]*v[0])(h[i]-h[i-1], h[(i+1) % len(h)]-h[i-1])) for i in range(len(h))]; h = np.delete(h, int(np.argmin(ar)), 0)
    return [[round(float(x), 3), round(float(y), 3)] for x, y in h]

def webp_url(img, q=82):
    b = io.BytesIO(); img.save(b, 'WEBP', quality=q, method=6); return 'data:image/webp;base64,'+base64.b64encode(b.getvalue()).decode()

# ---------- 3D: silhueta inflada ----------
def costas(img):
    """costas: a arte espelhada, mas cada coluna usa só o pelo de cima (acima dos olhos), esticado até perto dos pés;
    assim não aparece rosto atrás e o padrão do pelo/espinhos continua o mesmo da frente"""
    a = np.asarray(img.transpose(Image.FLIP_LEFT_RIGHT)).astype(float); rgb, al = a[..., :3], a[..., 3]/255
    H, W = al.shape; m = al > .5
    yy, xx = np.mgrid[0:H, 0:W].astype(float)
    tem = m.any(0); ty = np.where(tem, m.argmax(0), 0).astype(float); by = np.where(tem, H-1-m[::-1].argmax(0), H-1).astype(float)
    ty = ndi.uniform_filter1d(ty, 9); by = ndi.uniform_filter1d(by, 9)
    alt = np.maximum(by-ty, 1)[None, :]; rel = np.clip((yy-ty[None, :])/alt, 0, 1)
    src = rel*.42                                         # só a faixa de cima (testa, pelo, espinhos)
    pe = np.clip((rel-.95)/.05, 0, 1); src = src*(1-pe)+rel*pe   # só a pontinha de baixo (pés) usa a própria arte
    sy = ty[None, :]+src*alt
    out = np.dstack([ndi.map_coordinates(rgb[..., k], [sy, xx], order=1, mode='nearest') for k in range(3)])
    out = out*.9                                          # um pouco mais escuro atrás (luz vem da frente)
    return Image.fromarray(np.dstack([out, al*255]).clip(0, 255).astype(np.uint8))

def malha(img, prof=.5, passo=7):
    """frente e costas costuradas na borda exata da silhueta (contorno + triangulação de Delaunay)"""
    from scipy.spatial import Delaunay
    from skimage import measure
    al = np.asarray(img)[..., 3]/255.; H, W = al.shape; m = ndi.binary_fill_holes(al > .5)
    d = ndi.distance_transform_edt(m); dmax = d.max()
    z = np.sqrt(np.clip(1-(1-d/dmax)**2, 0, 1))*dmax*prof*2          # perfil redondo: zero na borda, máximo no miolo
    z = ndi.gaussian_filter(z, 1.0)*(d > 0)
    # pontos: grade por dentro (longe da borda) + contorno denso
    gy, gx = np.mgrid[passo/2:H:passo, passo/2:W:passo]; gin = d[gy.astype(int), gx.astype(int)] > passo*.6
    pts = [np.c_[gx[gin], gy[gin], np.zeros(gin.sum())]]
    for c in measure.find_contours(np.pad(m, 1).astype(float), .5):
        c = c-1; L = np.r_[0, np.cumsum(np.linalg.norm(np.diff(c, axis=0), axis=1))]
        if L[-1] < 12: continue
        t = np.arange(0, L[-1], 1.6); pts.append(np.c_[np.interp(t, L, c[:, 1]), np.interp(t, L, c[:, 0]), np.ones(len(t))])
    for lv in (2., 4.5):                                          # anéis na parede lateral (mais vértices onde a profundidade muda rápido)
        for c in measure.find_contours(d, lv):
            L = np.r_[0, np.cumsum(np.linalg.norm(np.diff(c, axis=0), axis=1))]
            if L[-1] < 20: continue
            t = np.arange(0, L[-1], 2.4); pts.append(np.c_[np.interp(t, L, c[:, 1]), np.interp(t, L, c[:, 0]), np.zeros(len(t))])
    Q = np.vstack(pts); Q = np.unique(np.round(Q, 2), axis=0); borda = Q[:, 2] > 0; Q = Q[:, :2]
    tri = Delaunay(Q).simplices
    cen = Q[tri].mean(1); ok = m[np.clip(cen[:, 1].round().astype(int), 0, H-1), np.clip(cen[:, 0].round().astype(int), 0, W-1)]
    # tira triângulos compridos demais (atravessam vãos entre espinhos)
    e = np.max([np.linalg.norm(Q[tri[:, i]]-Q[tri[:, (i+1) % 3]], axis=1) for i in range(3)], axis=0)
    tri = tri[ok & (e < passo*2.2)]
    used = np.unique(tri); rm = -np.ones(len(Q), int); rm[used] = np.arange(len(used)); Q = Q[used]; borda = borda[used]; tri = rm[tri]
    s = 1/H
    zi = ndi.map_coordinates(z, [Q[:, 1], Q[:, 0]], order=1); zi[borda] = 0              # frente e costas se encontram na borda
    vf = np.c_[(Q[:, 0]-W/2)*s, (H-Q[:, 1])*s, zi*s]
    # cor da borda e da lateral: perto da borda a UV entra na arte (a lateral mostra o pelo de dentro, não a beira esticada);
    gy_, gx_ = np.gradient(ndi.gaussian_filter(d, 2)); gn = np.hypot(gx_, gy_)+1e-6
    qi = np.clip(Q.round().astype(int), 0, [W-1, H-1]); dq = d[qi[:, 1], qi[:, 0]]
    # na parede a UV "desenrola" para dentro conforme a profundidade (a lateral mostra o pelo, não uma faixa esticada)
    alvo = np.maximum(dq+3, 3+.35*zi)                               # distância da borda (na arte) que cada vértice mostra
    off = alvo-dq; dirv = np.c_[gx_[qi[:, 1], qi[:, 0]]/gn[qi[:, 1], qi[:, 0]], gy_[qi[:, 1], qi[:, 0]]/gn[qi[:, 1], qi[:, 0]]]
    for _ in range(6):                                              # espinho fino: diminui o empurrão até ficar dentro da arte
        Qu = np.clip(Q+dirv*off[:, None], 0, [W-1, H-1]); qu = Qu.round().astype(int)
        fora = d[qu[:, 1], qu[:, 0]] < 2; off[fora] *= .5
    Qu = np.clip(Q+dirv*off[:, None], 0, [W-1, H-1])
    uf = np.c_[Qu[:, 0]/W*.5, Qu[:, 1]/H]
    vb = vf.copy(); vb[:, 2] *= -.85; ub = uf.copy(); ub[:, 0] = 1-uf[:, 0]
    # a frente olha para +z: ordem dos vértices conforme a orientação
    t0 = vf[tri]; nz = np.cross(t0[:, 1]-t0[:, 0], t0[:, 2]-t0[:, 0])[:, 2]
    tri = np.where((nz < 0)[:, None], tri[:, ::-1], tri)
    n0 = len(vf); P = np.vstack([vf, vb]); UV = np.vstack([uf, ub]); I = np.vstack([tri, tri[:, ::-1]+n0])
    P[:, 1] -= P[:, 1].min()
    return P, UV, I

def normais(P, I):
    N = np.zeros_like(P); t = P[I]; fn = np.cross(t[:, 1]-t[:, 0], t[:, 2]-t[:, 0])
    for k in range(3): np.add.at(N, I[:, k], fn)
    _, w = np.unique(np.round(P, 6), axis=0, return_inverse=True); w = w.ravel(); S = np.zeros((w.max()+1, 3)); np.add.at(S, w, N); N = S[w]   # borda: frente e costas com a mesma normal (sem vinco)
    return N/(np.linalg.norm(N, axis=1, keepdims=True)+1e-12)

def grava_glb(f, P, UV, I, tex):
    buf = io.BytesIO(); tex.convert('RGB').save(buf, 'JPEG', quality=90); jb = buf.getvalue(); parts = []; views = []; acc = []; off = 0
    def add(arr, target=None):
        nonlocal off; b = arr.tobytes(); pad = (-len(b)) % 4
        views.append(dict(buffer=0, byteOffset=off, byteLength=len(b), **({'target': target} if target else {}))); parts.append(b+b'\0'*pad); off += len(b)+pad
        return len(views)-1
    N = normais(P, I).astype(np.float32); P = P.astype(np.float32); UV = UV.astype(np.float32)
    for arr, typ in ((P, 'VEC3'), (N, 'VEC3'), (UV, 'VEC2')):
        a = dict(bufferView=add(arr, 34962), componentType=5126, count=len(arr), type=typ)
        if arr is P: a['min'] = P.min(0).tolist(); a['max'] = P.max(0).tolist()
        acc.append(a)
    Ii = I.astype(np.uint32).ravel(); acc.append(dict(bufferView=add(Ii, 34963), componentType=5125, count=len(Ii), type='SCALAR'))
    iv = add(np.frombuffer(jb, np.uint8))
    j = {'asset': {'version': '2.0', 'generator': 'GARRO bolinhas'}, 'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': [{'mesh': 0, 'name': 'bolinha'}],
         'meshes': [{'primitives': [{'attributes': {'POSITION': 0, 'NORMAL': 1, 'TEXCOORD_0': 2}, 'indices': 3, 'material': 0}]}],
         'materials': [{'pbrMetallicRoughness': {'baseColorTexture': {'index': 0}, 'metallicFactor': 0, 'roughnessFactor': .9},
                        'doubleSided': False}],
         'textures': [{'source': 0, 'sampler': 0}], 'samplers': [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 33071, 'wrapT': 33071}],
         'images': [{'bufferView': iv, 'mimeType': 'image/jpeg'}], 'accessors': acc, 'bufferViews': views, 'buffers': [{'byteLength': off}]}
    js = json.dumps(j, separators=(',', ':')).encode(); js += b' '*((-len(js)) % 4); bn = b''.join(parts)
    open(f, 'wb').write(struct.pack('<III', 0x46546C67, 2, 12+8+len(js)+8+len(bn))+struct.pack('<I', len(js))+b'JSON'+js+struct.pack('<I', len(bn))+b'BIN\0'+bn)

def main(folha):
    im = np.asarray(Image.open(folha).convert('RGB').resize((1536, 1024), Image.LANCZOS)).astype(float)
    P = json.load(open(os.path.join(RAIZ, 'data/pelucias.json'), encoding='utf-8'))
    bases = [d[0] for d in P['DATA'][:20]]; nomes = [P['EVN'][b] for b in bases]
    recs = recorta(im)
    os.makedirs(os.path.join(RAIZ, 'img/bolinhas'), exist_ok=True); os.makedirs(os.path.join(RAIZ, 'models/bolinhas'), exist_ok=True)
    SP = json.load(open(os.path.join(RAIZ, 'data/sprites.json'), encoding='utf-8')); LU = json.load(open(os.path.join(RAIZ, 'data/sprites_luta.json'), encoding='utf-8'))
    for k, (rec, nome) in enumerate(zip(recs, nomes)):
        sl = slug(bases[k]); rec.save(os.path.join(RAIZ, f'img/bolinhas/{sl}.webp'), 'WEBP', quality=88, method=6)
        e = 210/max(rec.width, rec.height); w, h = round(rec.width*e), round(rec.height*e); m = rec.resize((w, h), Image.LANCZOS)
        SP['SPRITES'][20+k] = {'w': w, 'h': h, 'hull': hull(m), 'img': webp_url(m)}
        e = 150/max(rec.width, rec.height); wb, hb = round(rec.width*e), round(rec.height*e); mb = rec.resize((wb, hb), Image.LANCZOS)
        LU['BSPR'][str(20+k)] = {'w': wb, 'h': hb, 'hull': hull(mb), 'img': webp_url(mb)}
        # 3D: textura 1024 × 512 (frente | costas)
        t = rec.resize((512, round(512*rec.height/rec.width)), Image.LANCZOS) if rec.width >= rec.height else rec.resize((round(512*rec.width/rec.height), 512), Image.LANCZOS)
        sq = Image.new('RGBA', (512, 512), (0, 0, 0, 0)); sq.paste(t, ((512-t.width)//2, 512-t.height));
        atlas = Image.new('RGBA', (1024, 512), (0, 0, 0, 0)); atlas.paste(sq, (0, 0)); atlas.paste(costas(sq), (512, 0))
        # sangria: estende a cor para fora do recorte (sem halo escuro no filtro), mantendo o alfa
        rgb = np.asarray(atlas).astype(float); a = rgb[..., 3:]/255
        bl = np.dstack([ndi.gaussian_filter(rgb[..., c]*a[..., 0], 3) for c in range(3)])/(ndi.gaussian_filter(a[..., 0], 3)[..., None]+1e-6)
        rgb[..., :3] = np.where(a > .5, rgb[..., :3], bl); atlas = Image.fromarray(rgb.clip(0, 255).astype(np.uint8))
        if '--3d' in sys.argv:            # 3D simples da arte (só frente); os modelos do jogo hoje vêm do Tripo
            Pm, UVm, Im = malha(sq)
            grava_glb(os.path.join(RAIZ, f'models/bolinhas/{sl}.glb'), Pm, UVm, Im, atlas)
        print(20+k, nome, sl, rec.size, len(Pm), 'vért')
    # dados: bolinha 20+k = mini do grande k (mesmo elemento e pedra), força de redondo (~36% do grande), raridade do grande
    for k in range(20):
        b = P['DATA'][k]; ev = P['EVN'][b[0]]
        P['DATA'][20+k] = [ev, 20+round(b[1]/8), 200+round(b[2]/12), 1.0, b[4],
                           f'Bolinha do {b[0]}. Junte 10 e use 5 pedras para ganhar o {ev} evoluído.']
        P['ELEM'][20+k] = P['ELEM'][k]; P['STAT'][20+k] = [round(v*.36) for v in P['STAT'][k]]
    P['FORA'] = [40, 41, 42]          # redondos antigos aposentados: saem da máquina e da coleção (ids mantidos no banco)
    json.dump(P, open(os.path.join(RAIZ, 'data/pelucias.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    json.dump(SP, open(os.path.join(RAIZ, 'data/sprites.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    json.dump(LU, open(os.path.join(RAIZ, 'data/sprites_luta.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))

if __name__ == '__main__':
    main(sys.argv[1])
