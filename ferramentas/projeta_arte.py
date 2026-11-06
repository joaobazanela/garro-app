"""GARRO — pinta o modelo 3D com a própria arte de referência (projeção).
Os modelos das criaturas/dragões vieram de uma folha do Tripo com pouco detalhe e cores diferentes da arte. Como o Tripo
montou o 3D a partir da mesma arte, a silhueta do modelo visto de lado (dragões) ou de frente (monstros) bate com o desenho.
Então: para cada pixel da textura, acha o ponto 3D dele, projeta esse ponto no desenho (de lado ou de frente) e pega a cor.
Onde o desenho não cobre (fora da silhueta), fica a cor antiga. As bordas dos pedaços da textura são esticadas para não
aparecer costura.
Uso: python3 ferramentas/projeta_arte.py entrada.glb arte_rgba.png saida.glb lado|frente"""
import sys, os, numpy as np
from PIL import Image
from scipy import ndimage as ndi
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from astrakai_deitada import le, grava, normais

def projeta(P, UV, I, tex, arte, lado):
    T = np.asarray(tex.convert('RGB')).astype(np.float32); S = T.shape[0]
    A = np.asarray(arte.convert('RGBA')).astype(np.float32); Ah, Aw = A.shape[:2]
    ys, xs = np.nonzero(A[..., 3] > 128); x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    # pixels bons do desenho: dentro da silhueta (2 px para dentro da borda) e sem o creme/cinza do fundo e da sombra
    rgb = A[..., :3]; sat = rgb.max(2)-rgb.min(2); claro = (rgb.mean(2) > 175) & (sat < 40)
    bom = ndi.binary_erosion(A[..., 3] > 128, iterations=2) & ~claro
    U = -P[:, 2] if lado == 'lado' else P[:, 2] if lado == 'lado_d' else P[:, 0]; V = P[:, 1]
    # silhueta do modelo nessa vista: ajusta para a caixa do desenho
    pu = x0+(U-U.min())/(U.max()-U.min())*(x1-x0); pv = y1-(V-V.min())/(V.max()-V.min())*(y1-y0)
    out = T.copy(); feito = np.zeros((S, S), bool)
    uv = UV*[S, S]; uv[:, 1] = uv[:, 1]  # glTF: v para baixo na imagem
    for t in I:
        a, b, c = uv[t]; mn = np.floor(np.minimum(np.minimum(a, b), c)).astype(int); mx = np.ceil(np.maximum(np.maximum(a, b), c)).astype(int)
        mn = np.clip(mn, 0, S-1); mx = np.clip(mx, 0, S-1)
        if mx[0] < mn[0] or mx[1] < mn[1]: continue
        gx, gy = np.meshgrid(np.arange(mn[0], mx[0]+1)+.5, np.arange(mn[1], mx[1]+1)+.5)
        d = (b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
        if abs(d) < 1e-12: continue
        l1 = ((b[1]-c[1])*(gx-c[0])+(c[0]-b[0])*(gy-c[1]))/d; l2 = ((c[1]-a[1])*(gx-c[0])+(a[0]-c[0])*(gy-c[1]))/d; l3 = 1-l1-l2
        m = (l1 >= -.02) & (l2 >= -.02) & (l3 >= -.02)
        if not m.any(): continue
        qu = l1*pu[t[0]]+l2*pu[t[1]]+l3*pu[t[2]]; qv = l1*pv[t[0]]+l2*pv[t[1]]+l3*pv[t[2]]
        iu = np.clip(qu.astype(int), 0, Aw-1); iv = np.clip(qv.astype(int), 0, Ah-1)
        m &= bom[iv, iu]
        if not m.any(): continue
        px = gx[m].astype(int); py = gy[m].astype(int)
        out[py, px] = A[iv[m], iu[m], :3]; feito[py, px] = True
    # estica as bordas pintadas por 3 texels (costuras)
    for _ in range(3):
        viz = ndi.binary_dilation(feito) & ~feito
        if not viz.any(): break
        acc = np.zeros_like(out); cnt = np.zeros((S, S), np.float32)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                sh = np.roll(np.roll(feito, dy, 0), dx, 1); acc += np.roll(np.roll(out, dy, 0), dx, 1)*sh[..., None]; cnt += sh
        out[viz] = acc[viz]/np.maximum(cnt[viz, None], 1); feito |= viz
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)), feito.mean()

if __name__ == '__main__':
    src, arte, dst, lado = sys.argv[1:5]
    P, UV, I, img = le(src); P = P.astype(np.float64); UV = UV.astype(np.float64); I = I.astype(np.int64)
    if isinstance(img, np.ndarray): img = Image.fromarray(img)
    novo, f = projeta(P, UV, I, img, Image.open(arte), lado)
    grava(dst, P.astype(np.float32), normais(P, I).astype(np.float32), UV.astype(np.float32), I.astype(np.uint32), novo, q=90)
    print(os.path.basename(dst), 'textura pintada pela arte:', round(f*100), '%')
