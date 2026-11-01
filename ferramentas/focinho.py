#!/usr/bin/env python3
"""Puxa o focinho dos lendarios para frente e afina (de frente a cara ficava chata/larga).
Deformacao suave em volta da ponta do focinho (acha sozinha: ponto mais a frente na altura da cabeca).
Uso: python3 ferramentas/focinho.py entrada.glb saida.glb --puxa 0.05 --raio 0.09 --afina 0.3 [--ymin 0.35]
"""
import sys, numpy as np
sys.path.insert(0, __file__.rsplit('/', 1)[0])
from ajusta_asas import le, view, grava

def arg(a, k, d):
    return float(a[a.index(k) + 1]) if k in a else d

def main():
    src, dst = sys.argv[1], sys.argv[2]; a = sys.argv[3:]
    puxa, raio, afina, ymin = arg(a, '--puxa', .05), arg(a, '--raio', .09), arg(a, '--afina', .3), arg(a, '--ymin', .35)
    desce = arg(a, '--desce', 0.0)
    j, bn = le(src); pr = j['meshes'][0]['primitives'][0]
    pos = view(j, bn, pr['attributes']['POSITION']).astype('f8').copy()
    uv = view(j, bn, pr['attributes']['TEXCOORD_0']).copy()
    idx = view(j, bn, pr['indices']).astype('u4').copy()
    bvi = j['bufferViews'][j['images'][0]['bufferView']]
    img = bytes(bn[bvi['byteOffset']:bvi['byteOffset'] + bvi['byteLength']])
    X, Y, Z = pos.T
    cand = (np.abs(X) < .03) & (Y > ymin)
    k = np.argmax(np.where(cand, Z, -9)); T = pos[k].copy(); T[0] = 0
    if '--ty' in a: T[1] = arg(a, '--ty', T[1])
    # distancia anisotropica: alcanca mais para tras (z) que para os lados
    d = np.sqrt(((X - T[0]) / 1.0) ** 2 + ((Y - T[1]) / 0.9) ** 2 + ((Z - T[2]) / 1.6) ** 2)
    w = np.clip(1 - d / raio, 0, 1); w = w * w * (3 - 2 * w)
    pos[:, 2] += puxa * w
    pos[:, 1] -= desce * w
    pos[:, 0] *= 1 - afina * w
    grava(dst, j, pos.astype('f4'), uv, idx, img)
    print(src.rsplit('/', 1)[-1], 'ponta', T.round(3), 'vertices mexidos', int((w > 0).sum()))

main()
