# Mecha Arena

O Mecha Arena nasceu da vontade de criar meu próprio jogo de tabuleiro: um passion project de construção e combate de robôs, pensado para jogar à mesa.

Ao experimentar as regras, percebi que era mais fácil desenvolver um motor de jogo junto ao Codex e testar as ideias em código do que acompanhar tudo com papel e caneta. A versão digital cresceu a partir dessa necessidade.

Com bots de comportamentos diferentes, também ficou mais fácil testar milhares de partidas e comparar estratégias do que reunir jogadores presenciais a cada mudança. Isso me deu espaço para experimentar e investigar o balanceamento antes de levar as ideias à mesa.

No jogo, você escolhe peças, monta seu robô e disputa arenas contra outras pessoas ou bots.

**[Jogar Mecha Arena](https://mecha-arena-multiplayer.victor-hrb.chatgpt.site)**

## Como uso IA

Uso o Codex para transformar as regras do jogo de tabuleiro em um motor que posso testar, implementar os bots e desenvolver a interface. Meu trabalho é definir as mecânicas, orientar o desenvolvimento, revisar o comportamento do jogo e decidir o que manter ou mudar.

Os adversários do jogo usam estratégias programadas. A IA generativa entra no processo de desenvolvimento.

## Onde entra a estatística

Além de jogar, construí experimentos para estudar o balanceamento: quais montagens levam vantagem, como o número de participantes muda o jogo e quando vale investir em recursos para as próximas arenas.

Uma rodada documentada reuniu:

- **187.200 arenas controladas** para comparar equipamentos e montagens.
- **8.400 partidas** entre diferentes estratégias de bots.
- **3.840 partidas** para investigar escolhas iniciais e o tempo disponível para recuperar um investimento.

As comparações usam sementes reproduzíveis, cenários controlados e intervalos de confiança. Os resultados descrevem as regras e os bots daquela versão; não representam automaticamente o comportamento de jogadores humanos.

Um exemplo: a estratégia agressiva teve mais sucesso nos duelos, enquanto a estratégia de investimento ganhou espaço nas mesas maiores. Isso abriu novas perguntas sobre o tempo necessário para a economia compensar a perda de força imediata.

[Leia o relatório dos experimentos](reports/balance-v01f/RELATORIO.md).

## Modos de jogo

| Modo | Como funciona |
| --- | --- |
| Single player | Uma pessoa contra 1–3 bots, com progresso salvo no navegador. |
| Multiplayer | Salas para 2–4 participantes, combinando pessoas e bots; estado oficial no servidor. |
| Laboratório | Partida local com carga e críticos, usando um save separado. |

A interface está em português e a prioridade atual é desktop. Os perfis online são públicos e selecionados pelo nome, sem senha; o controle do robô depende da sessão privada da sala. [Como jogar e retomar uma partida](docs/JOGAR.md).

## Experimentar localmente

Com **Node.js 24 ou posterior**, sem instalar dependências:

```sh
git clone --depth 1 https://github.com/victorhrb-sys/mecha-arena.git
cd mecha-arena
node server.mjs
```

Abra **http://127.0.0.1:43818**. No Windows, também é possível iniciar pelo `JOGAR.cmd`.

```sh
node --test tests/*.test.mjs
node scripts/check.mjs
```

O servidor usa SQLite nativo do Node. Os modos locais executam o motor no navegador; as salas usam o mesmo motor no servidor. Não há framework de interface ou serviço de IA em tempo de execução.

## Entender o código

Comece por [como o jogo funciona](docs/ARQUITETURA.md): o guia acompanha uma ação desde o clique até o próximo estado, explica a ordem do combate e mostra como os bots e as salas usam o motor.

| Quero entender… | Onde começar |
| --- | --- |
| Regras, fases e conservação das cartas | [Motor](dist/engine.js) e [arquitetura](docs/ARQUITETURA.md) |
| Decisões dos bots | [Política dos bots](dist/bots.js) |
| Salas, privacidade e comandos simultâneos | [Serviço de salas](multiplayer/rooms.mjs) |
| Interface e replay de rolagens | [Coordenador da interface](dist/app.js) |
| Executar, validar e medir mudanças | [Guia de desenvolvimento](docs/DESENVOLVIMENTO.md) |
| Regras de carga e crítico | [Laboratório](docs/LABORATORIO.md) |

`dist/` contém fontes editadas diretamente, apesar do nome. Bancos, caches e dados brutos gerados não fazem parte da árvore atual do repositório. Os experimentos históricos usaram uma versão anterior das regras, inclusive três sucatas iniciais; hoje a partida começa com zero. [Escopo do repositório e dados históricos](docs/REPOSITORIO.md).

O projeto segue em desenvolvimento. As próximas mudanças partem das partidas, dos testes e das perguntas que os experimentos deixam em aberto.

## Créditos

As atribuições dos ícones e os registros disponíveis sobre as imagens estão em [Créditos e recursos](docs/CREDITOS.md). Ainda não foi definida uma licença geral de reutilização para o projeto.
