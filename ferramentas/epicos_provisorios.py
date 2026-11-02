#!/usr/bin/env python3
"""Épicos provisórios: copia o modelo da Noctalis e recolore a textura nas 4 versões (Fogo, Água, Ar, Terra).
Troque pelos modelos próprios quando chegarem. Uso: python3 ferramentas/epicos_provisorios.py"""
import sys, io, colorsys, numpy as np
from PIL import Image
sys.path.insert(0, __file__.rsplit('/', 1)[0])
from ajusta_asas import le, view, grava

def hsv(A):
    r, g, b = A[..., 0], A[..., 1], A[..., 2]
    mx = A.max(-1); mn = A.min(-1); d = mx - mn + 1e-6
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) / 6
    return h, (mx - mn) / (mx + 1e-6), mx

def rgb(h, s, v):
    i = np.floor(h * 6).astype(int) % 6; f = h * 6 - np.floor(h * 6)
    p, q, t = v * (1 - s), v * (1 - s * f), v * (1 - s * (1 - f))
    sel = [(v, t, p), (q, v, p), (p, v, t), (p, q, v), (t, p, v), (v, p, q)]
    out = np.zeros(h.shape + (3,))
    for k, (a, b, c) in enumerate(sel):
        m = i == k; out[m, 0] = a[m]; out[m, 1] = b[m]; out[m, 2] = c[m]
    return out

# (cor das chamas: matiz, saturação, brilho extra) e (pelo escuro: matiz, saturação, brilho base, brilho ganho)
PAL = {
    'infernyx': ((0.07, 1.0, 1.25), (0.04, 0.55, 0.10, 0.75)),
    'abyssor':  ((0.58, 0.95, 1.2), (0.62, 0.65, 0.10, 0.75)),
    'zephyrax': ((0.56, 0.35, 1.45), (0.60, 0.08, 0.55, 0.50)),
    'terravyn': ((0.27, 0.7, 1.0), (0.08, 0.35, 0.22, 0.70)),
}

def main():
    j, bn = le('models/lendarios/noctalis.glb'); pr = j['meshes'][0]['primitives'][0]
    P = view(j, bn, pr['attributes']['POSITION']); UV = view(j, bn, pr['attributes']['TEXCOORD_0']); I = view(j, bn, pr['indices'])
    bvi = j['bufferViews'][j['images'][0]['bufferView']]
    A = np.array(Image.open(io.BytesIO(bytes(bn[bvi['byteOffset']:bvi['byteOffset'] + bvi['byteLength']]))).convert('RGB')).astype('f8') / 255
    h, s, v = hsv(A)
    chama = np.clip((s - 0.25) / 0.3, 0, 1) * ((h > 0.65) | (h < 0.03))          # roxo/rosa da Noctalis
    for nome, ((fh, fs, fv), (dh, ds, d0, dg)) in PAL.items():
        F = rgb(np.full_like(h, fh), np.full_like(h, fs) * np.clip(s * 1.3, 0, 1), np.clip(v * fv, 0, 1))
        Dk = rgb(np.full_like(h, dh), np.full_like(h, ds), np.clip(d0 + v * dg, 0, 1))
        out = F * chama[..., None] + Dk * (1 - chama[..., None])
        buf = io.BytesIO(); Image.fromarray((np.clip(out, 0, 1) * 255).astype('u1')).save(buf, 'JPEG', quality=88)
        grava(f'models/lendarios/{nome}.glb', j, P.astype('f4'), UV, I, buf.getvalue())
        print(nome, 'ok')

main()
