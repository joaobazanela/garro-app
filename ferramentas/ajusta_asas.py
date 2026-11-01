#!/usr/bin/env python3
"""Ajusta asas dos lendarios (modelos GLB 'garro-compact': 1 malha, sem esqueleto).

  espelha : copia a asa de um lado para o outro (Incendyr tinha asa direita minuscula)
  focinho : alonga o focinho (de frente a cara ficava chata, sem focinho)
  abre    : inclina as asas para fora (vistas de frente ficavam finas / "deformadas")

Uso: python3 ferramentas/ajusta_asas.py <nome> [--espelha esq|dir] [--abre 0.35]
Le/escreve models/lendarios/<nome>.glb (guarde uma copia antes).
"""
import json, struct, sys
import numpy as np


def le(p):
    b = open(p, 'rb').read()
    l = struct.unpack('<I', b[12:16])[0]
    j = json.loads(b[20:20 + l])
    o = 20 + l
    bl = struct.unpack('<I', b[o:o + 4])[0]
    return j, b[o + 8:o + 8 + bl]


def view(j, bn, ai):
    a = j['accessors'][ai]
    bv = j['bufferViews'][a['bufferView']]
    off = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    n = a['count']
    t = {'VEC3': 3, 'VEC2': 2, 'SCALAR': 1}[a['type']]
    dt = {5126: '<f4', 5123: '<u2', 5125: '<u4'}[a['componentType']]
    return np.frombuffer(bn, dtype=dt, count=n * t, offset=off).reshape(n, t) if t > 1 else np.frombuffer(bn, dtype=dt, count=n, offset=off)


def grava(p, j, pos, uv, idx, img):
    big = pos.shape[0] > 65535
    idx = idx.astype('<u4' if big else '<u2')
    parts = [pos.astype('<f4').tobytes(), uv.astype('<u2').tobytes(), idx.tobytes(), img]
    pad = lambda b: b + b'\0' * (-len(b) % 4)
    parts = [pad(x) for x in parts]
    offs = np.cumsum([0] + [len(x) for x in parts])
    bvs = [
        {'buffer': 0, 'byteOffset': int(offs[0]), 'byteLength': len(parts[0]), 'target': 34962},
        {'buffer': 0, 'byteOffset': int(offs[1]), 'byteLength': len(parts[1]), 'target': 34962},
        {'buffer': 0, 'byteOffset': int(offs[2]), 'byteLength': len(parts[2]), 'target': 34963},
        {'buffer': 0, 'byteOffset': int(offs[3]), 'byteLength': len(parts[3])},
    ]
    j = json.loads(json.dumps(j))
    j['bufferViews'] = bvs
    j['buffers'] = [{'byteLength': int(offs[4])}]
    j['accessors'] = [
        {'bufferView': 0, 'componentType': 5126, 'count': int(pos.shape[0]), 'type': 'VEC3',
         'min': pos.min(0).tolist(), 'max': pos.max(0).tolist()},
        {'bufferView': 1, 'componentType': 5123, 'normalized': True, 'count': int(pos.shape[0]), 'type': 'VEC2'},
        {'bufferView': 2, 'componentType': 5125 if big else 5123, 'count': int(idx.shape[0]), 'type': 'SCALAR'},
    ]
    j['images'][0]['bufferView'] = 3
    js = json.dumps(j, separators=(',', ':')).encode()
    js += b' ' * (-len(js) % 4)
    bin_ = b''.join(parts)
    out = struct.pack('<4sII', b'glTF', 2, 12 + 8 + len(js) + 8 + len(bin_))
    out += struct.pack('<I4s', len(js), b'JSON') + js + struct.pack('<I4s', len(bin_), b'BIN\0') + bin_
    open(p, 'wb').write(out)


def main():
    nome = sys.argv[1]
    lado = None
    abre = 0.0
    a = sys.argv[2:]
    if '--espelha' in a:
        lado = a[a.index('--espelha') + 1]
    if '--abre' in a:
        abre = float(a[a.index('--abre') + 1])
    p = f'models/lendarios/{nome}.glb'
    j, bn = le(p)
    pr = j['meshes'][0]['primitives'][0]
    pos = view(j, bn, pr['attributes']['POSITION']).astype('f4').copy()
    uv = view(j, bn, pr['attributes']['TEXCOORD_0']).copy()
    idx = view(j, bn, pr['indices']).astype('u4').reshape(-1, 3).copy()
    img = bytes(bn[j['bufferViews'][j['images'][0]['bufferView']]['byteOffset']:][:j['bufferViews'][j['images'][0]['bufferView']]['byteLength']])

    X, Y, Z = pos[:, 0], pos[:, 1], pos[:, 2]
    # zona da asa: acima do dorso, atras do ombro (frente do bicho = +z)
    zona = (Y > 0.33) & (Z < 0.06)
    if lado:
        s = -1 if lado == 'esq' else 1                  # lado que tem a asa boa
        boa = zona & (X * s > 0.045)
        ruim = zona & (X * -s > 0.045)
        tri_boa = boa[idx].all(1)
        tri_ruim = ruim[idx].any(1)
        keep = idx[~tri_ruim]
        # copia espelhada da asa boa
        used = np.unique(idx[tri_boa])
        mp = -np.ones(len(pos), 'i8')
        mp[used] = np.arange(len(used)) + len(pos)
        npos = pos[used].copy(); npos[:, 0] *= -1
        nuv = uv[used]
        nidx = mp[idx[tri_boa]][:, ::-1]               # inverte o giro dos triangulos
        pos = np.vstack([pos, npos]); uv = np.vstack([uv, nuv]); idx = np.vstack([keep, nidx])
        print('removidos', int(tri_ruim.sum()), 'triangulos; espelhados', int(tri_boa.sum()))
    if '--focinho' in a:
        k, z0, y0, y1 = [float(x) for x in a[a.index('--focinho') + 1:a.index('--focinho') + 5]]
        X, Y, Z = pos[:, 0], pos[:, 1], pos[:, 2]
        wz = np.clip((Z - z0) / 0.08, 0, 1)
        wy = np.clip((Y - y0) / 0.04, 0, 1) * np.clip((y1 - Y) / 0.04, 0, 1)
        pos[:, 2] = Z + k * np.clip(Z - z0, 0, None) * wz * wy   # alonga o focinho para frente
    if abre:
        X, Y, Z = pos[:, 0], pos[:, 1], pos[:, 2]
        zona = (Y > 0.33) & (Z < 0.06)
        w = np.clip((np.abs(X) - 0.03) / 0.05, 0, 1) * zona      # so a asa, nao o corpo
        pos[:, 0] = X + np.sign(X) * abre * np.clip(Y - 0.33, 0, None) * w
    # remove vertices nao usados
    u = np.unique(idx)
    m = -np.ones(len(pos), 'i8'); m[u] = np.arange(len(u))
    grava(p, j, pos[u], uv[u], m[idx].reshape(-1), img)
    print(nome, 'vertices', len(pos[u]), 'x', pos[u][:, 0].min().round(3), pos[u][:, 0].max().round(3))


if __name__ == '__main__':
    main()
