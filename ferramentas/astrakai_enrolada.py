"""GARRO — Astrakai enrolada (pose da coleção), como nas imagens de referência:
um enrolado largo deitado no chão, o pescoço subindo do meio em S, a cabeça erguida olhando para a frente,
um anel (auréola) dourado e roxo atrás da cabeça e argolas douradas no pescoço e no rabo.
A CABEÇA vem do modelo original do Tripo (com a textura dele); o corpo é um tubo refeito (mesmas escamas
da versão deitada, ferramentas/astrakai_deitada.py, de onde vêm as funções de leitura/gravação e a textura).
Uso: python3 ferramentas/astrakai_enrolada.py astrakai_original.glb models/lendarios/astrakai.glb"""
import sys, os
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from astrakai_deitada import le, grava, normais, textura_corpo, catmull, ss, cor, rng

def main(src, dst):
    P, UV, I, img = le(src)
    # ---- cabeça original (tudo à frente da nuca e acima de y 0,62), olhando para +z ----
    C = P[I].mean(1); m = (C[:, 2] > -.02) & (C[:, 1] > .62)
    Ic = I[m]; used = np.unique(Ic); rm = -np.ones(len(P), int); rm[used] = np.arange(len(used))
    Ph, UVh, Ih = P[used], UV[used], rm[Ic]
    nuca = Ph[np.abs(Ph[:, 2]+.01) < .03]; c0 = np.array([0, np.median(nuca[:, 1]), -.02]); r0 = np.median(np.abs(nuca[:, 1]-c0[1]))*1.45
    alvo = np.array([0, 1.0, .06]); KC = 1.35; Ph = alvo+(Ph-c0)*KC; r0 *= KC   # cabeça maior, como na referência
    # ---- eixo: pescoço em S descendo até o meio do enrolado, depois quase uma volta inteira no chão ----
    pesc = [alvo+np.array([0, .01, .11])*KC, alvo+np.array([0, 0, .03])*KC, alvo+[0, -.06, -.11], [0, .82, -.2], [0, .66, -.19], [0, .52, -.08],
            [0, .40, .02], [0, .30, .03], [0, .23, -.06], [0, .18, -.22]]   # entra no enrolado por trás (barriga sempre para a frente)
    Rc, yc = .42, .16
    voltas = np.linspace(.0, .93, 12)                                   # fração da volta (0 = atrás, -z)
    anel = [[-np.sin(2*np.pi*f)*(Rc+.16*f), yc, -np.cos(2*np.pi*f)*(Rc+.16*f)] for f in voltas]
    ctrl = pesc+anel; i_anel = len(pesc)
    Cc = catmull(ctrl, 18); seg = np.linalg.norm(np.diff(Cc, axis=0), axis=1); arc = np.r_[0, np.cumsum(seg)]; L = arc[-1]
    # s em que começa o anel (ponto de controle i_anel)
    s_anel = arc[i_anel*18]/L
    n = 360; sq = np.linspace(0, L, n); Cc = np.array([np.interp(sq, arc, Cc[:, j]) for j in range(3)]).T; s = sq/L
    rr = np.where(s < .1, r0+(.135-r0)*ss(0, .1, s), .135)+.045*ss(s_anel-.08, s_anel+.05, s)   # corpo do enrolado mais grosso
    rr = rr*np.where(s > .72, 1-ss(.72, 1.0, s)*.85, 1); rr = np.maximum(rr, .012)
    Cc[:, 1] = np.maximum(Cc[:, 1], rr*.92)
    T = np.gradient(Cc, axis=0); T /= np.linalg.norm(T, axis=1, keepdims=True)
    # dorso: no pescoço, para trás (barriga clara virada para a frente); no enrolado, para cima e para fora
    Dp = np.c_[np.zeros(n), -T[:, 2], T[:, 1]]
    fora = np.c_[Cc[:, 0], np.zeros(n), Cc[:, 2]]; fora /= np.linalg.norm(fora, axis=1, keepdims=True)+1e-9
    Da = np.array([0, .9, 0])-fora*.3
    w = ss(s_anel-.05, s_anel+.04, s)[:, None]; D = Dp*(1-w)+Da*w
    N = D-T*(T*D).sum(1, keepdims=True); N /= np.linalg.norm(N, axis=1, keepdims=True)
    B = np.cross(T, N)
    M = 28; ang = np.linspace(0, 2*np.pi, M+1); V = []; UVb = []
    for k in range(n):
        for q in range(M+1):
            th = ang[q]; V.append(Cc[k]+N[k]*np.cos(th)*rr[k]*.95+B[k]*np.sin(th)*rr[k]*1.06); UVb.append([s[k], q/M])
    V = np.array(V); UVb = np.array(UVb); Ib = []
    for k in range(n-1):
        for q in range(M):
            a = k*(M+1)+q; b = a+M+1; Ib += [[a, a+1, b], [a+1, b+1, b]]
    tip = len(V); V = np.vstack([V, Cc[-1]+T[-1]*.01]); UVb = np.vstack([UVb, [1, .5]])
    Ib = np.vstack([np.array(Ib), [[(n-1)*(M+1)+q, (n-1)*(M+1)+q+1, tip] for q in range(M)]])
    # ---- enfeites ----
    extra = []
    def cone(base, dirv, h, r, seg=6):
        dirv = dirv/np.linalg.norm(dirv); a = np.cross(dirv, [1, 0, 0]); a = a/np.linalg.norm(a) if np.linalg.norm(a) > 1e-6 else np.array([0, 0, 1.]); b2 = np.cross(dirv, a)
        vs = [base+(a*np.cos(t)+b2*np.sin(t))*r for t in np.linspace(0, 2*np.pi, seg, endpoint=False)]+[base+dirv*h]
        return np.array(vs), np.array([[q, (q+1) % seg, seg] for q in range(seg)])
    def toro(c, t_, rad, tub, seg=28, ts=6, kt=1.6, a=None):
        t_ = t_/np.linalg.norm(t_)
        if a is None: a = np.cross(t_, [0, 1, 0]); a = a/np.linalg.norm(a) if np.linalg.norm(a) > 1e-6 else np.array([1, 0, 0.])
        b2 = np.cross(t_, a); vs = []; fs = []
        for i in range(seg):
            u = i/seg*2*np.pi; rd = a*np.cos(u)+b2*np.sin(u)
            for j in range(ts):
                v = j/ts*2*np.pi; vs.append(c+rd*rad+rd*np.cos(v)*tub+t_*np.sin(v)*tub*kt)
        for i in range(seg):
            for j in range(ts):
                a1 = i*ts+j; b1 = ((i+1) % seg)*ts+j; a2 = i*ts+(j+1) % ts; b3 = ((i+1) % seg)*ts+(j+1) % ts; fs += [[a1, b1, a2], [a2, b1, b3]]
        return np.array(vs), np.array(fs)
    OURO = (.75, .12); ROXO = (.75, .37)
    for sk in np.arange(.1, .97, .032):                                 # espinhos dourados no dorso
        k = int(sk*(n-1)); h = .13*(1-sk*.5)*(1.15 if int(sk/.032) % 2 else .8); base = Cc[k]+N[k]*rr[k]*.85
        extra.append(cone(base, N[k]*.8-T[k]*.6, h, .03*(1-sk*.4))+(OURO,))
    for sk in (s_anel-.17, s_anel-.11, .9):                              # argolas: duas no pescoço, uma perto do rabo
        k = int(sk*(n-1)); extra.append(toro(Cc[k], T[k], rr[k]*1.08, .014, kt=2.2)+(OURO,))
    for sk, ab in [(.97, -.5), (.985, .5), (1., 0.)]:
        k = min(n-1, int(sk*(n-1))); extra.append(cone(Cc[k]+N[k]*rr[k]*.6, N[k]*.9+B[k]*ab-T[k]*.5, .05, .007)+(ROXO,))
    # auréola atrás da cabeça (no plano xy), dourada em cima e roxa embaixo, com contas e estrelinhas em cruz
    hc = Ph.mean(0); hc = np.array([0, hc[1]-.03, alvo[2]-.1]); Rh = .43
    av, af = toro(hc, np.array([0, 0, 1.]), Rh, .012, seg=72, ts=6, kt=1., a=np.array([0, 1., 0]))
    ang_a = np.arctan2(av[:, 0]-hc[0], av[:, 1]-hc[1])                   # 0 = topo
    t_a = ss(.25, .95, np.abs(ang_a)/np.pi)                              # 0 dourado (topo) -> 1 roxo (embaixo)
    uva = np.c_[.52+t_a*.46, np.full(len(av), 60/2048)]
    extra_uv = [(av, af, uva)]
    for q in range(12):                                                 # contas na auréola
        u = q/12*2*np.pi; p = hc+np.array([np.sin(u), np.cos(u), 0])*Rh; tq = ss(.25, .95, abs((u+np.pi) % (2*np.pi)-np.pi)/np.pi)
        cv, cf = toro(p, np.array([-np.cos(u), np.sin(u), 0]), .02, .008, seg=10, ts=4, kt=1.)
        extra_uv.append((cv, cf, np.tile([.52+tq*.46, 60/2048], (len(cv), 1))))
    for u in (0, -np.pi/2, np.pi/2, np.pi*.75):                          # estrelinhas em cruz
        p = hc+np.array([np.sin(u), np.cos(u), 0])*Rh; tq = ss(.25, .95, abs(u)/np.pi); d1 = np.array([np.sin(u), np.cos(u), 0])
        for d in (d1, -d1, np.array([0, 0, 1.]), np.array([0, 0, -1.])):
            cv, cf = cone(p, d, .07 if d is d1 else .045, .01, seg=5); extra_uv.append((cv, cf, np.tile([.52+tq*.46, 60/2048], (len(cv), 1))))
    # ---- atlas 2048: cabeça (textura original), corpo embaixo, ouro/roxo e o degradê da auréola em cima ----
    A = Image.new('RGB', (2048, 2048), (40, 50, 160)); A.paste(img.resize((1024, 1024), Image.LANCZOS), (0, 0))
    A.paste(textura_corpo(kx=L/2.05, dens=1.8), (0, 1024))
    g = np.linspace(0, 1, 512)[:, None]*np.ones((1, 1024))
    A.paste(Image.fromarray(((cor('#fff0a0')*(1-g[..., None])+cor('#b07818')*g[..., None])*255).astype(np.uint8)), (1024, 0))
    A.paste(Image.fromarray(((cor('#e8a0ff')*(1-g[..., None])+cor('#6a2ac8')*g[..., None])*255).astype(np.uint8)), (1024, 512))
    x = np.linspace(0, 1, 1024)[None, :]*np.ones((80, 1)); x = ((x-.02)/.96).clip(0, 1)[..., None]
    halo = cor('#ffc93a')*(1-x)+cor('#c070ff')*x; A.paste(Image.fromarray((halo*255).astype(np.uint8)), (1024, 20))
    UVb2 = np.c_[.003+UVb[:, 0]*.994, .5+.004+UVb[:, 1]*.492]
    Vs = [Ph, V]; UVs = [UVh*.5, UVb2]; Is = [Ih, Ib+len(Ph)]; off = len(Ph)+len(V)
    for vs, fs, (u0, v0) in extra:
        Vs.append(vs); UVs.append(np.tile([u0, v0+.1*rng.random()], (len(vs), 1))); Is.append(fs+off); off += len(vs)
    for vs, fs, uv in extra_uv:
        Vs.append(vs); UVs.append(uv); Is.append(fs+off); off += len(vs)
    Pn = np.vstack(Vs); UVn = np.vstack(UVs); In = np.vstack(Is); Pn[:, 1] -= Pn[:, 1].min()
    grava(dst, Pn, normais(Pn, In), UVn, In, A)
    print('ok', dst, len(Pn), 'vértices', len(In), 'triângulos', 'L', round(L, 2), 'tamanho', Pn.min(0).round(2), Pn.max(0).round(2))

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
