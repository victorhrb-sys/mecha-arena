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

## Experimentar localmente

Com **Node.js 24 ou posterior**, execute na pasta do projeto:

```bash
node server.mjs
```

Depois, abra **http://127.0.0.1:43818**.

Para executar os testes:

```bash
node --test tests/*.test.mjs
```

O projeto segue em desenvolvimento. As próximas mudanças partem das partidas, dos testes e das perguntas que os experimentos deixam em aberto.
