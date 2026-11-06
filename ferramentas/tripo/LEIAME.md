# Módulos para separar folhas 3D do Tripo

Usados por `ferramentas/separar_folha_tripo.py` (veja o cabeçalho dele para o uso).

- `glbio.py`, `decim.py`, `compact.py`, `bake.py`, `nb.py`: ler/gravar GLB, simplificar, refazer a textura;
- `separar.py`, `quadrantes.py`, `componentes.py`: recortar pedaços da folha, novo atlas, simplificação final (`rebake3`).

A simplificação usa a biblioteca **meshoptimizer** (C++). Compile uma vez e aponte a variável `LIBMESHOPT`
(ou deixe `libmeshopt.so` nesta pasta; ela não vai no repositório):

    git clone https://github.com/zeux/meshoptimizer && cd meshoptimizer
    g++ -O2 -shared -fPIC src/*.cpp -o libmeshopt.so
