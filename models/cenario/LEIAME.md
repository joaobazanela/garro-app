# Modelos de cenário (models/cenario/)

Modelos 3D usados na Aventura. Os do Tripo chegam pesados (até 1 milhão de vértices e 65 MB); antes de entrar no jogo eles são
simplificados e regravados com uma textura de 1024 px (alvo: menos de 1 MB por arquivo).

| Arquivo | O que é | Onde está no jogo | Bom para usar depois em |
|---|---|---|---|
| `pilha_pedras.glb` | pilha de pedras com musgo | Floresta Encantada: no lugar das pedras do mapa (`cenario3d.pedras_modelos`) | trilhas de floresta/montanha, bordas do mapa, obstáculos |
| `tronco.glb` | tronco caído com galho e musgo | Floresta Encantada: alterna com a pilha de pedras | floresta, beira de rio, obstáculo baixo |
| `castelo_assombrado.glb` | castelo assombrado com árvore, abóboras, túmulos e fantasmas | Reino das Trevas: marco no fundo, depois do portal (`tema.cenario3d.marcos`) | fase de chefe das Trevas, evento de Halloween, tela do mundo |
| `masmorra.glb` | sala de masmorra (paredes de pedra, porta, janela com grade, tocha) | Caverna Encantada: dois marcos fora das paredes | Desafio Lendário, sala secreta/baú, fases de calabouço |
| `dio_*.glb`, `portal.glb` | dioramas do portal de cada mundo | portal no fim de cada fase | — |
| `arvore1/2`, `cogumelos`, `coral_*`, `concha`, `pedras`, `barril`, `lanterna`, `cogumelo_*` | peças soltas | paredes e enfeites de cada mundo | — |

Como colocar um modelo novo numa fase (data/aventura.json, dentro de `tema.cenario3d` do mundo):

- `"marcos": [{"modelo": "models/cenario/X.glb", "tamanho": 10, "x": 1.5, "z": 0.4, "giro": -2.2}]` coloca um cenário grande fora do caminho:
  `x` em meias-larguras do mapa (|x| > 1 fica fora das paredes), `z` em fração do comprimento (> 1 fica depois do portal), `giro` em radianos (o modelo olha para +z).
- `"pedras_modelos": [...]` e `"pedra_tamanho"` trocam as pedras do mapa (mundos sem `cenario2`).
