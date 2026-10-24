# Garro App

Jogo em forma de app para comercialização.

Jogo de máquina de garra no navegador: mova a garra, aperte PEGAR e leve as pelúcias até o buraco de prêmio.
Cada pelúcia tem tamanho e peso próprios, a garra tem três pontas e pode escorregar ou enroscar.
Na coleção, as pelúcias capturadas aparecem em 3D e reagem ao toque (carinho, coçar, bravo, barriga pra cima).


## Estrutura dos arquivos (a partir de 24/10)

O jogo deixou de ser um `index.html` gigante. Agora:

| Arquivo | O que tem |
|---|---|
| `index.html` | Só a estrutura da página (HTML) e um carregador pequeno. |
| `css/garro.css` | Todo o visual. |
| `js/garro.js` | Toda a lógica do jogo. |
| `data/*.json` | **Conteúdo estático do jogo**: `pelucias.json` (lista, força, elementos, nomes das evoluções, pedras), `modelos.json` (ajustes dos modelos 3D), `textos.json`, `regras.json` (preços, decaimento, XP), `sprites*.json` e `fills.json` (imagens). |
| `models/` | Modelos 3D e texturas. |
| `supabase/` | Migrações e a função `sync-estado` (deploy automático pelo GitHub Actions ao dar push em `main`). |

O carregador do `index.html` busca os `data/*.json` e só depois carrega `js/garro.js`; se algum arquivo falhar, aparece um aviso na tela em vez de tela branca.

### Regras do projeto
1. **Banco (Supabase "appgarro") guarda só ESTADO do jogador** (`profiles`, `player_state`, `collection`: moedas, vitórias, o que capturou). Nunca conteúdo do jogo, sprites, base64, textos ou configuração de pelúcias.
2. **Conteúdo do jogo vai em arquivo separado versionado** (`data/*.json`, `js/*.js`), nunca inline gigante dentro do `index.html`.
3. Antes de adicionar algo novo, decidir: é estado do jogador (Supabase) ou conteúdo do jogo (arquivo)?
4. Repositório único: **github.com/joaobazanela/garro-app**. O repositório antigo Alexandre-Mendes151/garro não recebe mais commits.

### Estado do jogador no Supabase (migração 0006)
- Tabelas novas, só estado: `inventory` (comida e pedras), `plush_care` (XP e barras de cada pelúcia), `giants` (gigantes e se evoluíram). Leitura só da própria linha (RLS); escrita só pela `sync-estado`.
- Ações novas na `sync-estado`: `buy`, `swap`, `giant_round_start`, `giant_capture`, `sell_giant`, `giant_evolve`, `use_stone`, `care`, `battle`, `import_local`. Preços e XP ficam no código das funções (precisam bater com `data/regras.json`).
- **Corrige um erro antigo:** `rpc_round_start` e `rpc_refill` (0002) falhavam com "column reference coins is ambiguous", então a jogada nunca marcava `pending_round` e as capturas eram recusadas pelo servidor. Na 0006 as duas foram reescritas.
- Na primeira entrada depois disso, o jogo manda UMA vez o que estava guardado no aparelho (`import_local`), com limites: até 50 comidas, 10 pedras de cada, XP até o máximo, 3 de cada pelúcia, 3 de cada gigante.
- Continua só no aparelho, de propósito: preferências (modo dev, aviso "como brincar"). Sem login (demo/artefato) tudo continua salvo no aparelho.
- Teste local das migrações: `supabase/tests/estado_do_jogador.sql`.

## Jogar
**Link:** https://alexandre-mendes151.github.io/garro/

Abra `index.html` em qualquer navegador, ou ative o GitHub Pages neste repositório
(Settings → Pages → Branch: `main` / pasta raiz) e use o link gerado.

## Modelos 3D
Sylvorn e Terranox usam modelos 3D gerados a partir das fotos (pasta `models/`). Os outros bichinhos usam modelos montados no próprio jogo.

## Tecnologia
Um único arquivo HTML, sem instalação. Usa Matter.js (física) e Three.js (3D), carregados de CDN.

### Pelúcias derivadas (textura dos modelos de referência)
- `models/deer_base.glb`: corpo do Sylvorn sem chifres nem orelhas. Serve de molde para Flarion, Umbros, Voltik, Lunaris, Lumina e Auren, cada um com a pele pintada em `models/skins/<n>.jpg` e as partes próprias (orelhas, asas, cauda...).
- `models/tex/fur.jpg` e `models/tex/scale.jpg`: pelagem e escamas tiradas do Sylvorn e do Terranox, aplicadas nas outras pelúcias 3D.

### Modelos Tripo novos
- `draksel.glb`, `glacien.glb`, `flarion.glb`, `magmord.glb`, `petrun.glb` (reduzidos de ~1 milhão para ~50 mil triângulos).
- Primos repintados (`models/skins/<n>.jpg`): Aquarim e Zephyra usam o Glacien; Floriss e Toxilys, o Magmord; Umbros e Voltik, o Flarion; Coralith, o Petrun.
- Visualizador 3D: chão conforme o elemento de cada pelúcia, sombra real sob as patas e, ao deslizar o dedo para cima no bichinho, ele corre em círculos.

### Rodada 3
- Todas as 20 pelúcias agora usam modelo 3D de verdade (Tripo): Umbros, Ignovus e Sombril entraram como modelos próprios; Nimbri usa o Sombril, Zephyra usa o Ignovus, e Lunaris/Lumina/Auren usam o Umbros, cada um com pele própria.
- Modelos com mapa de relevo (normal map) para a pelagem e as escamas ficarem com volume.
- Tela inicial com a máquina de garra 3D (`models/machine.glb`); tocar em JOGAR aproxima a câmera e entra no jogo.
- Correções: a janela 3D aparecia por cima do jogo em alguns navegadores; a garra agora afunda um pouco na pilha antes de fechar (menos “fechou no vazio”); a sombra acompanha a cabeça quando o bicho vira.

### Rodada 4 (movimentos e tela da pelúcia)
- Sozinhos, os bichos agora fazem coisas: olham em volta, farejam o chão, pulam, se espreguiçam, sentam, abanam o rabo; Draksel, Ignovus e Zephyra batem as asas.
- Reações mais claras: ao ficar bravo ele recua, agacha e bufa; carinho faz inclinar e balançar; um aviso no topo mostra o humor.
- Correções: agachar não faz mais o bicho flutuar; Ignovus/Zephyra estavam de lado e agora olham pra frente; a corrida em círculos não sai mais da tela; área da cabeça certa no Sombril e no Ignovus.
- Tela da pelúcia: elemento e raridade, setas para passar entre as pelúcias capturadas e “Como brincar” recolhível.

### Rodada 5 (bichinhos redondos e evolução)
- 23 pelúcias redondas (ids 20 a 42) entraram na máquina e na coleção: Cianim, Tigrel, Folhim, Draquim, Nevim, Trevim, Rosalis, Melzim, Marim, Cinzim, Noctis, Carneli, Brasim, Cobaltin, Zorbi, e os 8 da folha “ovo → pelúcia”: Terranox Mini, Draksel Mini, Petrun Mini, Nimbri Mini, Ignovus Mini, Flarion Mini, Umbrio e Auren Mini. São montadas em código (sem .glb).
- **Os redondos não evoluem.** São só prêmios da garra, em uma forma só, e aparecem em maior quantidade (cerca de 70% da pilha, até 3 iguais). Pegar repetido só soma na coleção.
- **Quem evolui são as 20 pelúcias grandes.** Comida, Carinho e Brincar (as voltas em círculo) enchem barras e dão XP; com 60 XP ela vira a forma da folha de evolução (Terranox Prime, Aquarim Leviatã, Flarion Inferno... Auren Divino): maior, com brilho, faíscas e anel na cor do elemento. Repetida dá +20 XP.
- **Redondos guardados e vendáveis:** os redondos pegos ficam na coleção e repetidos somam (×2, ×3...). Na tela de cada redondo há **Vender repetidas**: a cada 2 repetidas vendidas, 1 moeda (sempre fica 1 de cada). Eles também podem ser alimentados (Comida, Carinho, Brincar), só que sem evoluir.
- **Servidor:** a migração `0003_redondos_e_venda.sql` e a função `sync-estado` (ações `capture` até o id 42 e `sell`) precisam ser publicadas no Supabase. Enquanto isso não for feito, o jogo guarda os redondos e as moedas da venda no próprio aparelho (junta com o servidor pelo maior valor).
- **Formas evoluídas (Nível 50):** cada um dos 20 grandes ganha peças da folha de evolução: asas (Zephyra, Umbros, Draksel, Ignovus, Lumina, Auren, Flarion), cristais (Glacien, Toxilys), espinhos (Terranox, Magmord), flores, coral, musgo, auréola etc. Ficam em `EVOX` no código. A folha de referência está em `docs/referencia-evolucao.png`. São peças sobre o corpo atual, não modelos 3D novos.
- **Nível, Ataque, Defesa e Vida** nos 43 bichinhos (tabela `STAT` no código). Os redondos têm bem menos poder e nível máximo 30; os 20 grandes chegam ao nível 100 e **evoluem no nível 50** (poder ×1,35). O nível sobe com XP de Comida, Carinho, Brincar e batalhas.
- **Batalha:** botão "Batalhar" na tela do bichinho. Sorteia um adversário (75% da mesma categoria), a luta é automática por rodadas. Vencer dá +10 XP e 1 moeda (no máximo 5 moedas por hora); perder dá +4 XP.
- **Flarion e Nimbri** foram remontados (raposa de fogo e carneirinho de nuvem, código `buildFox` e `buildCloud`); o Flarion é uma raposa de fogo igual à referência (código em `buildFox`): cabeça grande, orelhas, gola creme, juba e cauda de folhas de fogo. Tem as mesmas brincadeiras e evolução dos outros.
- O progresso fica salvo no aparelho (`localStorage`, chave `garro-care`).

## Modelos Tripo próprios (9 bichos)
Aquarim, Zephyra, Floriss, Voltik, Lunaris, Coralith, Lumina, Toxilys e Auren agora usam o corpo e a textura do próprio modelo Tripo (antes eram "primos" repintados de outros corpos). Arquivos em `models/` (versão completa; a versão leve vai embutida na demo/artefato). Lumina, Toxilys e Auren vieram juntos num único GLB e foram separados por componente. Na forma evoluída recebem coroa/halo e aura (as peças antigas foram tiradas para não duplicar asas/flores).

## Ataques por elemento na batalha
Cada golpe usa o elemento do bicho: raio (choque em zigue-zague), pedra/terra (arremesso), água/mar (jato), fogo/lava (bola de fogo), gelo, vento, sombra, flores/folhas/luz (chuva de pétalas), lua, veneno e sagrado. O dano só aparece quando o golpe acerta.

## Movimento na luta
Os dois lutadores ficam de frente (o da direita é espelhado). Respiram parados, investem para frente ao atacar (mais forte no crítico) e balançam ao levar o golpe. Quem perde deita acinzentado; quem ganha comemora com uma das três: três pulinhos, deitar e rolar ou correr em círculos, com estrelas e corações.

## Loja e pedras raras
Botão 🛒 Loja no topo. Comida custa 5 moedas e Pedra de evolução 400. A comida agora é item: cada vez que o bichinho come gasta 1 (começa com 3). As 6 pedras (Fogo, Ar, Terra, Planta, Fantasma, Psíquico) também aparecem raramente na máquina (cerca de 1% por pelúcia sorteada, no máximo uma por vez). Uso único: no bicho grande do mesmo elemento ela leva direto ao Nv 50 e evolui; depois a pedra some. Inventário e gastos ficam no aparelho (localStorage `garro-inv` e `garro-bonus`), sem servidor por enquanto.

### Cores conferidas com a referência
- Magmord (preto com lava), Glacien (cristais azuis), Draksel (vermelho) e Petrun (pedra cinza com musgo) foram repintados em `models/skins/` a partir dos modelos Tripo já enviados. Os .glb não mudaram.
- Ainda pedem modelo novo do Tripo para ficarem iguais na forma: Flarion e Nimbri (hoje feitos em código) e Petrun (o modelo atual é um golem de lava).
- Fim do "quadriculado": Aquarim, Coralith, Lunaris, Voltik, Floriss, Zephyra, Lumina, Toxilys e Auren foram reduzidos de novo mantendo a textura original do Tripo (sem mosaico). Terranox ficou mais verde.
- Arquivos de modelo e pele agora levam `?v=` no endereço, para o celular não mostrar a versão antiga guardada.
- **Flarion** agora usa o corpo de raposa do Voltik pintado de fogo (`models/skins/2.jpg`), no lugar da raposa feita em código. Quando chegar um modelo próprio do Tripo, é só trocar o arquivo em `MODELS[2]`.

### Luta cara a cara (correção definitiva) e Terranox novo
- O bote e o empurrão da luta usavam a mesma direção para os dois lados; com a imagem espelhada, o bicho dava o bote para trás e parecia olhar para o rabo do outro. Agora os movimentos são escritos "para a frente" e o lado direito espelha o movimento inteiro (`bA`). Testado nas 1806 duplas possíveis (43 × 42): cabeça virada para o adversário, parado e no ataque.
- **Terranox** usa o modelo Tripo do dinossauro (espinhos repintados de marrom, corpo verde), sem as peças extras de antes.
- Dos arquivos enviados, 9 eram iguais aos que já estavam no jogo e o `baby_dragon` saiu do Tripo como um quadro plano (a folha inteira), então não foi usado.

### Os 20 com modelo Tripo próprio
- Chegaram os que faltavam: **Glacien** (dragão de gelo), **Flarion** (raposa de fogo), **Petrun** (tartaruga de pedra com musgo) e **Nimbri** (nuvem fofa; veio no mesmo arquivo do Petrun e foi separado). Todos reduzidos mantendo a textura original.
- Flarion e Nimbri não são mais montados em código (`PROC` vazio). As peles repintadas antigas `skins/0, 2, 6, 13` saíram.
- Evolução desses quatro: brilho, anel e auréola na cor do elemento (`EVCROWN`).

### Economia e máquina
- **Moedas infinitas só para desenvolvedores:** as contas Google `alexandre.et@gmail.com` e `joaobazanela@gmail.com` (lista `DEV_EMAILS`) veem ∞ e jogam, compram e trocam sem gastar. Para todos os outros nada muda. A cópia de teste dos devs (artefato do Claude) já abre com ∞. No demo público sem login começa normal; nos dois, 7 toques no contador de moedas ligam/desligam o modo dev, só naquele aparelho.
- **Reposição mais lenta:** a máquina não enche mais de volta a cada jogada. Cai 1 bichinho novo a cada 4 jogadas quando a pilha está baixa; só repõe 3 de uma vez se ficar quase vazia (menos de 6).
- **Trocar bichinhos da máquina:** botão abaixo dos controles, custa 10 moedas (`SWAP_COST`). Tira todos e sorteia uma pilha nova.
- **Venda de um em um:** cada redondo vendido vale 1 moeda e dá para vender até o último. **Servidor:** publicar a migração `0004_venda_um_a_um.sql` e a função `sync-estado` atualizada (aceita `qty` a partir de 1). Até lá, a venda é guardada no aparelho.

### Itens e pedras novas
- Botão **Itens 🎒** no topo: mostra quanta comida e quantas pedras você tem (as que você tem aparecem primeiro). Tocando numa pedra, lista os seus bichinhos que podem evoluir com ela; escolher um abre a tela dele e evolui na hora.
- Duas pedras novas: **Pedra de Luz** (Lunaris, Lumina, Auren) e **Pedra Sombria** (Umbros, Sombril). A Pedra Fantasma ficou para o Toxilys; a Psíquica, sem bicho por enquanto. Aparecem raras na máquina e custam 400 na loja, como as outras.

### Nitidez e forma evoluída
- Texturas da versão leve (artefato) subiram de 640 para 1024 px nos 14 modelos Tripo novos: não fica mais desfocado de perto.
- Forma evoluída: sem auréola. Enquanto não chega o modelo evoluído do Tripo, o mesmo corpo ganha uma **pele evoluída** gerada no aparelho (`evoTex`): Petrun com mais musgo, Magmord mais escuro com lava, gelo mais azul, sombra mais roxa etc., além de ficar maior e com o anel/brilho.
- Quando chegar o .glb da forma evoluída, basta colocar em `models/<nome>_evo.glb` e registrar em `EVOFILE[id]`; a tela troca de modelo sozinha ao evoluir.

### Formas evoluídas com modelo próprio
- 14 evoluções vieram do Tripo (cada arquivo trazia base + evolução; foi usada a evolução): Terranox Prime, Aquarim Leviatã, Zephyra Celestial, Umbros Sombrio, Glacien Ártico, Voltik Tempestade, Magmord Lava, Lunaris Solaris (sem o pedestal), Sylvorn Imperial, Sombril Abissal, Coralith Oceânico, Lumina Celestial, Toxilys Veneno e Auren Divino → `models/<nome>_evo.glb`, registradas em `EVOFILE` com pontos de cabeça/cauda em `NBE`.
- Ao chegar no Nv 50 (ou usar a pedra) a tela troca para o modelo evoluído. Na luta aparece a imagem da forma evoluída (`EVOSPR`).
- Ainda sem modelo evoluído (usam a pele evoluída): Flarion, Floriss, Draksel (o arquivo veio como cartão plano), Nimbri, Petrun e Ignovus.
- O artefato do Claude não cabe mais 14 modelos dentro dele (limite de 16 MB): ele busca as evoluções no repositório público do demo pelo jsDelivr; se não conseguir, usa a pele evoluída.

### Luta cara a cara (definitivo)
- As imagens da luta agora são próprias (`BSPR` para as 43 formas normais, `BSPRE` para as 14 evoluídas): todas desenhadas de perfil **olhando para a direita**. O bicho da esquerda usa a imagem como está e o da direita é sempre espelhado, então não depende mais de adivinhar para que lado cada modelo olha. Testado nas 1806 duplas (metade com formas evoluídas).
- A coleção usa as mesmas imagens evoluídas.

### Garra nova e Máquina Gigante
- **Garra mais realista** (no estilo da máquina 3D): carrinho no trilho com rodinhas, cabo de aço trançado, motor cromado com faixa laranja e luz, aro com pinos e três garras curvas com junta parafusada e ponta de borracha. A física continua a mesma.
- **Máquina Gigante:** abas acima do vidro trocam entre a máquina normal (1 moeda) e a Gigante (**50 moedas** por jogada, `GCOST`). Nela fica um único bichinho grande (2,4×), sorteado entre os 20; a garra fica maior (`CS`). Pegou: vai para a coleção com +60 XP e cai outro gigante. "Trocar bichinhos" (10 moedas) sorteia outro gigante. Em teste com mira boa: 3 vitórias em 10 jogadas.
- As 50 moedas da Gigante são descontadas no aparelho (como a loja), até o servidor ganhar essa ação.

### Gigante com cara de gigante, venda de qualquer pelúcia e máquina pequena
- **Gigante:** cai de cima do vidro com estrondo, tremor e poeira, e aparece o nome dele grande; três redondinhos de enfeite aos pés (não saem como prêmio) e régua em centímetros no vidro para comparar; quando a garra segura, o cabo treme, a subida e a volta ficam mais lentas e o motor fica mais grave; máquina com placa dourada "★ GIGANTE ★", luzes piscando e fundo próprio; ganhar dá tremor, confete e um selo 🏆 na coleção (`garro-giant`).
- **Venda:** qualquer pelúcia pode ser vendida, até a última. Redondo = 1 moeda, bicho especial (que evolui) = 30 moedas (toque duas vezes para confirmar), pelúcia gigante = 40 moedas (botão próprio). **Servidor:** publicar `0005_venda_especiais.sql` e a `sync-estado` atualizada (aceita ids 0 a 42). A venda do gigante fica no aparelho por enquanto.
- **Máquina pequena:** mais redondos (86% da pilha) e uma parede invisível sobre a divisória para nenhum bicho solto escorregar para o buraco do prêmio sem ser pego.
- **Artefato:** as 14 formas evoluídas agora vão junto com o artefato (arquivos `models/*_evo.glb.txt`), sem depender de internet externa.

### Evoluídos com lugar próprio, gigante na luta e cansaço
- **Coleção:** quando um bicho evolui, ele ganha um lugar novo na seção "★ Evoluídos" (com a imagem e o nome da evolução). O lugar antigo continua com a forma de antes, marcado "evoluiu ↓".
- **Gigante na luta:** quem tem a pelúcia gigante ganha o botão "⚔️ Lutar com o gigante 🏆" (mais forte). Às vezes o adversário também é gigante (12%). Na tela, o gigante aparece bem maior e o pequeno menor.
- **Gigante evolui com 5 pedras** do elemento dele (botão na tela do bicho). Sem pedras suficientes, abre a loja.
- **Gigante nítido:** redesenhado no tamanho grande a partir da imagem original (antes era a pequena esticada) e sempre em pé, sem tombar.
- **Sem pedra ou sem comida:** abre a loja com o aviso do que falta.
- **Cansaço:** com a barra de Brincar cheia, apertar de novo deixa o bicho cansado; na terceira vez ele faz cara de cansado e deita de lado para descansar.

### Correções: gigante capturado e evoluídos sem deformar
- Gigante: enquanto está na garra ele atravessa o vidro e a divisória; se a garra o leva até a porta do prêmio, conta como capturado e cai pela portinhola. Testado com 8 gigantes diferentes: 8 capturados.
- Formas evoluídas não dobram mais cabeça e cauda por dentro do modelo (isso esticava o rosto, como no Umbros Sombrio); elas se mexem inteiras.
