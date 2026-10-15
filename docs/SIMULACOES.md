# Rodada de balanceamento da v0.1f

Esta rodada mantém as regras de `dist/engine.js`. O objetivo é identificar sinais de desequilíbrio e limitações dos bots antes de decidir a v0.2. Os resultados não estimam a população de jogadores humanos: os perfis são hipóteses ainda não calibradas com partidas humanas.

## Bots

Novas partidas recebem oponentes de estilos distintos: Agressivo, Corredor, Defensivo, Investidor, Oportunista e Equilibrado. Cada indivíduo tem habilidade e persistência de estilo próprias, derivadas da semente da partida e gravadas no salvamento. A habilidade modula adaptação e imprecisão de avaliação; não é uma dificuldade calibrada. A arena continua inteiramente automática pelas regras: o bot decide seleção, mercado e montagem.

- O Agressivo prefere dano; o Corredor prefere avanço; o Defensivo combina resistência com uma condição de vitória.
- O Investidor aceita menor força imediata para gerar sucata, mas reduz o interesse em J quando alguém se aproxima de cinco pontos.
- O Oportunista dá mais valor a triplas quando há módulos e cartas suficientes; o Equilibrado distribui sua montagem.
- Todos consideram o custo de comprimir duas cartas já possuídas em uma melhorada ao adquirir a terceira; preservam uma condição de vitória quando disponível.
- A adaptação considera apenas equipamentos revelados na última arena e o placar público. Na montagem seguinte, essa memória continua sendo a montagem anterior.
- As preferências imprecisas permanecem estáveis durante a organização. Arrastar, reequipar ou recarregar a página não sorteia uma nova decisão.
- Não há consulta ao baralho oculto, às ofertas futuras, aos equipamentos adversários ainda não revelados ou ao gerador de dados.

Os salvamentos anteriores, sem personalidade gravada, conservam a política clássica. Inicie uma nova partida para experimentar os seis estilos. A política anterior está congelada em `simulations/legacy-bots.mjs` como controle experimental; não deve ser atualizada junto com os novos bots.

## Experimentos

1. **Substituição de uma carta:** três montagens de base, com 3, 5 ou 6 módulos. Trocar uma mesma posição por A, K, Q ou J; repetir com a carta melhorada. Comparar 2, 3 e 4 jogadores. Base, adversários, posições dos módulos e semente são iguais dentro de cada comparação. A posição do piloto focal roda entre os assentos. Montagens inimigas de ataque, corrida e defesa são misturadas; o experimento não representa todas as montagens possíveis.
2. **Confrontos entre montagens:** ataque, corrida, defesa e economia enfrentam-se em duelos nas três etapas de equipamento. As faces são embaralhadas para não impor a ordem de montagem dos bots clássicos. Cada lado ocupa os dois assentos.
3. **Intervenções pontuais:** adquirir a terceira carta comum (e combinar), adicionar o primeiro Escudo e trocar posições de módulos. Na tripla, o estado anterior tem duas cartas comuns daquele tipo e um apoio; o posterior tem uma melhorada e o apoio, com uma face vazia. Trata-se do efeito imediato de aceitar a terceira carta, sem descontar preço nem modelar o preenchimento futuro da vaga.
4. **Torneio completo:** seis estilos novos e a política clássica. Duelo entre cada par, além de mesas mistas de três e quatro participantes. Nos blocos de mesas mistas, cada perfil passa uma vez por cada assento. Todos começam pelo draft e jogam até cinco pontos. Não se interfere em compra, venda, desbloqueio, melhoria paga, triplas ou oferta limitada.
5. **Escolha inicial e horizonte econômico:** em duelos, fixar K + Q e comparar a terceira carta A/K/Q/J. Jogar até o fim com perfis Equilibrado e Investidor, alternando o assento e o adversário. Repetir com placar inicial 0–0 e 4–4. A carta e a montagem são concedidas, sem custo nem draft, igualmente nas quatro variantes; portanto o resultado mede a escolha condicional, não sua disponibilidade no draft. No caso 4–4, manter três módulos isola o horizonte de pontuação da potência dos equipamentos; não representa uma montagem típica avançada.

Nos estados controlados há exatamente 32 cartas, oito de cada tipo, e nenhuma tripla comum pendente. Equipamentos melhorados são estados legais concedidos para isolar seu efeito; o custo de adquiri-los não entra nos resultados de arena. Todos os combates usam o mesmo motor do jogo, sem uma segunda implementação das regras.

## Estatística e limites

- Vitória é um ponto/vitória real, sem dar meia vitória aos empates. A taxa usa todas as execuções, incluindo empates e limites; estes últimos são mostrados separadamente como censura, nunca convertidos em empates legais.
- IC 95% de Wilson para taxas; diferenças das intervenções usam IC normal de 95% calculado sobre diferenças pareadas por semente. Intervalos são exploratórios e não têm correção por múltiplas comparações.
- A mesma semente alinha condições iniciais, mas sequências de sorteios podem divergir após ações que mudem a quantidade de sorteios de alvo ou a duração da partida. O pareamento continua sendo feito por cenário inicial.
- O torneio mede a força conjunta da política e das regras. Um bot vencedor não prova que sua carta preferida seja universalmente superior. Frequência de cartas nos vencedores também não é evidência causal.
- “Início/meio/avançado” nas arenas designa equipamento, não placar; o experimento 0–0/4–4 mede separadamente a proximidade do fim da partida.
- Coletor não altera o resultado de uma arena isolada por meio da sucata. Seu retorno deve ser avaliado em partidas completas. Comparar apenas arenas penaliza sua função econômica por construção.
- Limites: 600 rolagens por arena, 100 arenas por partida e 15.000 ações por partida. Registrar separadamente qualquer execução interrompida e sua causa.
- A força dos bots não foi ajustada depois de observar os resultados desta rodada. Regras ou pesos futuros devem ganhar outra versão e outra rodada, preservando esta referência.

## Reproduzir

Sem pacotes adicionais, com Node.js disponível:

```sh
node --test tests/*.test.mjs
node simulations/run.mjs --samples 1800 --matches 240 --seed 20260911
node simulations/report.mjs
```

`--samples` define repetições por cenário controlado. `--matches` define repetições de cada par no torneio de duelos, blocos de sete nas mesas mistas e repetições por escolha inicial. Para amostras equilibradas entre assentos e adversários, use múltiplos de 12. `--out` permite salvar outra rodada; o gerador de relatório aceita a pasta como argumento.

Artefatos em `reports/balance-v01f/`:

- `summary.json`: agregações, parâmetros e SHA-256 dos arquivos usados.
- `matches.jsonl`: partidas do torneio com montagens, sucata e resultado por arena.
- `opening-choices.jsonl`: partidas das intervenções de escolha inicial.
- `matches.csv`: resultado e ações por participante no torneio.
- `RELATORIO.md`: leitura dos resultados e prioridades para discussão.

O painel local fica em `dist/balance.html`, acessível pelo mesmo servidor do jogo em `/balance.html`. O relatório é uma fotografia da execução, não roda simulações enquanto é aberto. A semente permite reproduzir resultados; data e tempo de execução variam.
