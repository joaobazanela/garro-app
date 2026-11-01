"""GARRO — gera as texturas de chão e rocha dos mundos da Aventura (img/tex/<mundo>/*2_*.jpg e img/tex/comum/).
Todas são "tileáveis" (repetem sem emenda). Feitas a partir das imagens de referência dos mundos:
  fogo   → lajes de basalto escuro com lava brilhando nas rachaduras
  trevas → pedras de calçamento escuras com frestas e poças roxas
  montanha (caverna) → lajes irregulares roxo-acinzentadas com musgo e pontinhos de cristal
  luz    → mármore branco em placas com rejunte e losangos dourados
  mar    → areia clara com ondinhas + mapa de cáusticas (luz do sol na água, animada no jogo)
  comum  → rocha genérica (tingida por mundo no jogo) e rachaduras de lava para as rochas do fogo
Uso: python3 ferramentas/gerar_texturas_mundos.py   (grava em img/tex/)"""
import os, numpy as np
from PIL import Image
from scipy.spatial import cKDTree

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'img', 'tex')
rng = np.random.default_rng(20261101)

def ruido(n, beta=2.0, seed=None):
    """ruído fBm periódico (filtro 1/f^beta no domínio da frequência), normalizado 0..1"""
    r = np.random.default_rng(seed) if seed is not None else rng
    f = np.fft.fftfreq(n)
    fx, fy = np.meshgrid(f, f)
    k = np.sqrt(fx**2 + fy**2); k[0, 0] = 1
    spec = np.fft.fft2(r.standard_normal((n, n))) / k**(beta / 2)
    spec[0, 0] = 0
    o = np.real(np.fft.ifft2(spec))
    return (o - o.min()) / (o.max() - o.min())

def voronoi(n, pts, jitter_pts=None):
    """F1, F2 e índice da célula com distância periódica (toro)"""
    yy, xx = np.mgrid[0:n, 0:n] / n
    q = np.stack([xx.ravel(), yy.ravel()], 1)
    t = cKDTree(pts, boxsize=1.0)
    d, i = t.query(q, k=2)
    return d[:, 0].reshape(n, n), d[:, 1].reshape(n, n), i[:, 0].reshape(n, n)

def pontos(m, minimo=None):
    p = rng.random((m, 2))
    if minimo:  # relaxa um pouco (Lloyd simples) para células mais parelhas
        for _ in range(2):
            n = 256; _, _, idx = voronoi(n, p)
            yy, xx = np.mgrid[0:n, 0:n] / n
            for c in range(m):
                msk = idx == c
                if msk.any():
                    # média circular (periódica)
                    ax = np.angle(np.exp(2j*np.pi*xx[msk]).mean()) / (2*np.pi) % 1
                    ay = np.angle(np.exp(2j*np.pi*yy[msk]).mean()) / (2*np.pi) % 1
                    p[c] = [ax, ay]
    return p

def warp(n, campo, forca, seed):
    """desloca um campo por ruído (bordas menos retas)"""
    dx = (ruido(n, 2.6, seed) - .5) * forca * n
    dy = (ruido(n, 2.6, seed + 1) - .5) * forca * n
    yy, xx = np.mgrid[0:n, 0:n]
    return campo[((yy + dy).astype(int)) % n, ((xx + dx).astype(int)) % n]

def normal(h, forca):
    gx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * forca
    gy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * forca
    nz = np.ones_like(h)
    l = np.sqrt(gx**2 + gy**2 + nz**2)
    rgb = np.stack([-gx / l, gy / l, nz / l], -1) * .5 + .5
    return (rgb * 255).clip(0, 255).astype(np.uint8)

def cor(hexs):
    return np.array([[int(h[i:i+2], 16) for i in (1, 3, 5)] for h in hexs], float) / 255

def mistura(a, b, t):
    t = t[..., None] if t.ndim == 2 else t
    return a * (1 - t) + b * t

def salva(nome, arr, tam=None, q=86):
    os.makedirs(os.path.dirname(os.path.join(RAIZ, nome)), exist_ok=True)
    if arr.dtype != np.uint8:
        arr = (arr.clip(0, 1) * 255).astype(np.uint8)
    im = Image.fromarray(arr)
    if tam and im.size[0] != tam:
        im = im.resize((tam, tam), Image.LANCZOS)
    im.save(os.path.join(RAIZ, nome), quality=q, optimize=True)
    print('ok', nome, os.path.getsize(os.path.join(RAIZ, nome)) // 1024, 'KB')

def ss(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)

N = 1024

# ---------------- FOGO: basalto + lava nas rachaduras ----------------
def fogo():
    p = pontos(58, True)
    f1, f2, idx = voronoi(N, p)
    borda = warp(N, f2 - f1, .02, 11)
    nz = ruido(N, 1.6, 12); nz2 = ruido(N, 2.4, 13)
    larg = .004 + .007 * ruido(N, 2.2, 14)          # rachadura de largura variável
    racha = 1 - ss(larg * .4, larg, borda)            # 1 = dentro da rachadura
    brilho = 1 - ss(0, .035, borda)                    # calor perto da borda
    var = (np.sin(idx * 12.9898) * 43758.5453) % 1    # cada laje um tom
    base = mistura(cor(['#3a302d'])[0], cor(['#5e504a'])[0], (var[..., None] * .6 + nz[..., None] * .5).clip(0, 1))
    base = base * (.75 + .5 * nz2[..., None])
    base = mistura(base, cor(['#5a2a18'])[0], brilho * .55)          # beira avermelhada
    lava = mistura(cor(['#a8300a'])[0], cor(['#ff8a2a'])[0], ss(.5, 1, racha))
    c = mistura(base, lava, racha)
    h = ss(0, .05, borda) * .8 + nz2 * .25 + var * .15
    em = mistura(np.zeros(3), cor(['#ff5a10'])[0], (racha * 1.0 + brilho**2 * .25).clip(0, 1))
    em = mistura(em, cor(['#ffd070'])[0], ss(.6, 1, racha))
    salva('fogo/chao2_cor.jpg', c)
    salva('fogo/chao2_normal.jpg', normal(h, 6), 512)
    salva('fogo/chao2_emis.jpg', em, 512)

# ---------------- TREVAS: calçamento escuro, frestas e poças roxas ----------------
def trevas():
    p = pontos(90, True)
    f1, f2, idx = voronoi(N, p)
    borda = warp(N, f2 - f1, .012, 21)
    nz = ruido(N, 1.8, 22); nz2 = ruido(N, 2.6, 23); poca = ruido(N, 3.2, 24)
    pedra = ss(.006, .028, borda)
    var = (np.sin(idx * 78.233) * 43758.5453) % 1
    base = mistura(cor(['#2e2c3a'])[0], cor(['#57536a'])[0], (var * .7 + nz * .4)[..., None].clip(0, 1))
    base = base * (.8 + .35 * nz2[..., None])
    junta = mistura(cor(['#0e0c14'])[0], cor(['#3b2a52'])[0], nz2)   # rejunte escuro com musgo roxo
    c = mistura(junta, base, pedra)
    mp = ss(.77, .83, poca)                                           # poças roxas brilhantes
    c = mistura(c, mistura(cor(['#3a1a6a'])[0], cor(['#9a5aff'])[0], ss(.72, .9, poca)), mp * (1 - pedra * .7))
    h = pedra * (.7 + .3 * ss(.02, .08, borda)) + nz2 * .15
    em = mistura(np.zeros(3), cor(['#8a4aff'])[0], (mp * (1 - pedra * .6) * .9 + (1 - pedra) * ss(.68, .85, poca) * .35).clip(0, 1))
    salva('trevas/chao2_cor.jpg', c)
    salva('trevas/chao2_normal.jpg', normal(h, 5), 512)
    salva('trevas/chao2_emis.jpg', em, 512)

# ---------------- CAVERNA: lajes irregulares, musgo e pontinhos de cristal ----------------
def caverna():
    p = pontos(48, True)
    f1, f2, idx = voronoi(N, p)
    borda = warp(N, f2 - f1, .03, 31)
    nz = ruido(N, 1.7, 32); nz2 = ruido(N, 2.5, 33); musgo = ruido(N, 3.0, 34)
    pedra = ss(.008, .03, borda)
    var = (np.sin(idx * 39.71) * 43758.5453) % 1
    base = mistura(cor(['#4a3e52'])[0], cor(['#7a6670'])[0], (var * .6 + nz * .5)[..., None].clip(0, 1))
    base = base * (.78 + .4 * nz2[..., None])
    junta = cor(['#17121c'])[0]
    c = mistura(np.broadcast_to(junta, base.shape), base, pedra)
    mm = ss(.6, .75, musgo) * (1 - ss(.02, .09, borda) * .6)
    c = mistura(c, cor(['#4a5a3a'])[0], mm * .3)
    esp = (rng.random((N, N)) > .99975).astype(float)
    from scipy.ndimage import gaussian_filter, maximum_filter
    esp = gaussian_filter(maximum_filter(esp, 3), 1.2); esp = (esp / esp.max()).clip(0, 1)
    c = mistura(c, cor(['#9ef0ff'])[0], esp)
    h = pedra * .8 + nz2 * .3
    em = mistura(np.zeros(3), cor(['#6ef0ff'])[0], esp)
    salva('montanha/chao2_cor.jpg', c)
    salva('montanha/chao2_normal.jpg', normal(h, 5), 512)
    salva('montanha/chao2_emis.jpg', em, 512)

# ---------------- LUZ: mármore branco, rejunte e losangos dourados ----------------
def luz():
    yy, xx = np.mgrid[0:N, 0:N] / N
    nz = ruido(N, 1.5, 41)
    # veios do mármore: seno deformado por ruído
    veio = np.abs(np.sin((xx * 3 + yy * 2 + nz * 3.2) * np.pi * 2))
    veio = 1 - ss(0, .12, veio)
    T = 4  # 4×4 placas por textura
    gx = np.abs(((xx * T) % 1) - .5); gy = np.abs(((yy * T) % 1) - .5)
    rej = np.maximum(ss(.493, .498, gx), ss(.493, .498, gy))           # rejunte dourado
    # losango dourado nos cantos das placas
    dx = .5 - gx; dy = .5 - gy
    los = 1 - ss(.075, .085, dx + dy)
    losb = 1 - ss(.055, .062, dx + dy)
    ouro = np.maximum(rej, los - losb * 0)                            # losango cheio
    tom = (np.floor(xx * T) * 7 + np.floor(yy * T) * 13) % 5 / 5
    base = mistura(cor(['#f4f1ea'])[0], cor(['#e6e1d6'])[0], (tom * .5 + nz * .5)[..., None])
    base = mistura(base, cor(['#a99f8e'])[0], veio * .55)
    c = mistura(base, mistura(cor(['#b8892a'])[0], cor(['#ffe08a'])[0], nz), ouro)
    h = 1 - rej * .8 + nz * .05
    em = mistura(np.zeros(3), cor(['#ffcf5a'])[0], ouro * .25)
    salva('luz/chao2_cor.jpg', c)
    salva('luz/chao2_normal.jpg', normal(h, 3), 512)
    salva('luz/chao2_emis.jpg', em, 512)

# ---------------- MAR: areia com ondinhas e cáusticas ----------------
def mar():
    yy, xx = np.mgrid[0:N, 0:N] / N
    nz = ruido(N, 1.8, 51); nz2 = ruido(N, 2.8, 52)
    ond = np.sin((yy * 9 + xx * 2 + nz * 1.6) * np.pi * 2) * .5 + .5
    base = mistura(cor(['#d8c69a'])[0], cor(['#f1e6c6'])[0], (ond * .45 + nz2 * .55)[..., None])
    grao = rng.random((N, N))
    base = base * (.92 + .1 * grao[..., None])
    salva('mar/chao2_cor.jpg', base)
    salva('mar/chao2_normal.jpg', normal(ond * .6 + nz2 * .4, 4), 512)
    # cáusticas: rede brilhante de bordas de Voronoi (F2-F1 pequeno), deformada
    p = pontos(40, True)
    f1, f2, _ = voronoi(N, p)
    e = warp(N, f2 - f1, .03, 53)
    cau = (1 - ss(0, .035, e))**1.6 + (1 - ss(0, .012, e)) * .6
    salva('mar/causticas.jpg', np.stack([cau.clip(0, 1)] * 3, -1), 512)

# ---------------- COMUM: rocha genérica + rachaduras de lava ----------------
def comum():
    # rocha: ruído em camadas com estrias (sem "células", para não se confundir com os pisos de laje)
    yy, xx = np.mgrid[0:N, 0:N] / N
    nz = ruido(N, 1.5, 62); nz2 = ruido(N, 2.3, 63); nz3 = ruido(N, 3.2, 65)
    rid = 1 - np.abs(nz2 * 2 - 1)                                   # cristas
    estr = np.sin((yy * 14 + nz * 3) * np.pi * 2) * .5 + .5          # estrias
    v = .48 + .22 * nz + .12 * rid + .08 * estr + .1 * nz3
    p = pontos(30)
    f1, f2, _ = voronoi(N, p)
    racha = (1 - ss(0, .006, warp(N, f2 - f1, .04, 61))) * ss(.45, .7, ruido(N, 2.0, 66))
    v = v * (1 - racha * .5)
    salva('comum/rocha_cor.jpg', np.stack([v, v * .97, v * .95], -1).clip(0, 1))
    salva('comum/rocha_normal.jpg', normal(nz * .5 + rid * .4 + estr * .15 + nz3 * .3 - racha * .4, 8), 512)
    lava = (1 - ss(0, .02, warp(N, f2 - f1, .04, 61))) * ss(.3, .55, ruido(N, 2.2, 64))
    em = mistura(np.zeros(3), cor(['#ff6a1a'])[0], lava)
    em = mistura(em, cor(['#ffd070'])[0], ss(.5, 1, lava))
    salva('comum/rocha_lava_emis.jpg', em, 512)

# ---------------- LAVA (rios do mundo do fogo): magma laranja com crosta escura ----------------
def lava():
    a = ruido(N, 2.0, 71); b = ruido(N, 3.0, 72)
    t = warp(N, a * .7 + b * .3, .06, 73)
    crosta = 1 - ss(.36, .5, t)
    quente = ss(.5, .85, t)
    c = mistura(mistura(cor(['#ff4a08'])[0], cor(['#ffd860'])[0], quente), cor(['#2a0e06'])[0], crosta * .92)
    em = mistura(mistura(cor(['#ff5a10'])[0], cor(['#fff0a0'])[0], quente), np.zeros(3), crosta)
    h = 1 - crosta * .6 + b * .2
    salva('fogo/lava_cor.jpg', c, 512)
    salva('fogo/lava_emis.jpg', em, 512)
    salva('fogo/lava_normal.jpg', normal(h, 4), 512)

if __name__ == '__main__':
    for f in (fogo, trevas, caverna, luz, mar, comum, lava):
        f()
