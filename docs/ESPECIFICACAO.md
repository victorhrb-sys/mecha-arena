# Mecha Arena — especificação da primeira versão jogável

**Base:** board game V0.1f, anteriormente chamado Auto-Bots.
**Estado:** entendimento confirmado por Victor; base aprovada para implementação.

## 1. Entrega e objetivo

Produzir uma versão completa e jogável da V0.1f, preservando o board game e automatizando sua execução. Victor já está satisfeito com essa base; o primeiro resultado deve permitir jogar uma partida inteira, da preparação à vitória.

- Aplicação em português, aberta no navegador e executada localmente no computador de Victor.
- Partidas com um jogador humano e 1 a 3 bots (2–4 participantes no total). Victor controla apenas seu robô; os adversários escolhem, compram, vendem excedentes, desbloqueiam e montam automaticamente, respeitando as mesmas regras.
- Tabuleiro 2D com identidade de arena de robôs, equipamentos legíveis e animações simples de dados, movimento e dano.
- Após o primeiro teste: tela inicial focada na configuração da partida; instruções complementares em ajudas “?”; peças identificadas por ícones minimalistas e pelos nomes Canhão, Propulsor, Escudo e Coletor, com A/K/Q/J pequenos como referência. Somente equipamentos melhorados recebem um marcador de melhoria.
- Victor pode iniciar uma rolagem conjunta ou ativar **Rolar até o fim**. A sequência mantém as animações, permite pausar e para em qualquer resultado da arena, sem avançar à compra. Retomar um salvamento não religa a sequência automaticamente.
- A barra **Velocidade** permite ajustar a apresentação entre **0,5× e 4×**, em passos de 0,5. A alteração afeta imediatamente o tempo restante da animação e os intervalos das rolagens automáticas, sem alterar regras ou resultados. A preferência é salva separadamente da partida.
- Salvamento automático da partida no mesmo navegador e computador, com opção de continuar ou iniciar outra partida.
- Código e instruções para executar o jogo ficam neste projeto.

Classes, partidas em rede, publicação na internet, editor de regras e ferramentas de simulação/balanceamento ficam fora desta primeira entrega. Classes e apoio ao desenvolvimento poderão ser acrescentados depois da base jogável.

## 2. Experiência de uma partida

1. **Início:** informar seu nome, escolher 1–3 bots e começar uma partida, ou continuar a salva. O humano ocupa o primeiro lugar; os bots recebem nomes automáticos.
2. **Montagem inicial:** fazer suas três escolhas de equipamentos e posicionar suas cartas nos módulos habilitados. Os bots completam a própria preparação automaticamente.
3. **Arena:** destacar seu robô e mostrar os adversários em painéis compactos, com equipamentos expansíveis. Um comando inicia a rolagem conjunta; dados e efeitos ficam visíveis, e o histórico detalhado pode ser expandido.
4. **Resultado da arena:** explicar vitória ou empate, atualizar pontos e pagar a participação.
5. **Compra:** apresentar somente as oportunidades de compra do humano, com suas vendas e desbloqueios. A ordem é preservada e os turnos dos bots passam automaticamente.
6. **Montagem:** reorganizar seus equipamentos, vender excedentes, escolher sua reserva e entrar na arena. Os bots confirmam os próprios robôs.
7. **Continuação:** repetir Compra → Montagem → Arena até alguém alcançar 5 pontos. Mostrar o vencedor e permitir nova partida.

Durante a preparação e a Montagem, a interface mostra apenas suas cartas. Todos os equipamentos são revelados ao entrar na Arena. Os bots usam heurísticas simples com seus próprios equipamentos e as ofertas disponíveis; não consultam cartas ocultas de adversários, o baralho nem resultados futuros. A execução automática para na próxima decisão humana ou ao entrar na Arena; as rolagens continuam sob comando de Victor.

## 3. Componentes e preparação

| Elemento | Regra |
| --- | --- |
| Equipamentos | 32 cartas: 8 de cada tipo A, K, Q e J. Naipes não alteram efeitos ou triplas. |
| Dado | Um d6 independente para cada robô vivo, rolado junto aos demais. |
| Módulos | Seis posições numeradas. Inicialmente apenas 1, 2 e 3 estão habilitadas. |
| Sucata inicial | 0 para o jogador humano e todos os bots. |
| Trilha | Posição inicial 0; quatro avanços chegam ao objetivo. |
| HP máximo | 1 + quantidade de Q comuns equipados + 2 × quantidade de Q melhorados equipados. |
| Reserva | Uma carta fora dos módulos entre arenas. |
| Vitória na partida | Primeiro jogador a alcançar 5 pontos. |

A primeira rodada começa diretamente na montagem inicial. Cada jogador retira três opções do baralho, escolhe uma e devolve as outras duas; repete até concluir três escolhas, sem pagar sucata. Uma tripla obtida nessas escolhas combina normalmente e pode reduzir a quantidade final de equipamentos. A combinação não concede escolhas extras.

Posições e HP reiniciam a cada Arena: todos voltam à posição inicial e ao HP máximo de sua montagem. Equipamentos, upgrades, módulos desbloqueados, sucata e pontos permanecem entre arenas. Robôs eliminados retornam na próxima Arena.

## 4. Compra, venda e desbloqueio

- No início da Compra, embaralhar o baralho de mercado e revelar duas cartas por jogador. Se faltarem cartas, revelar apenas as disponíveis. A loja pode ficar vazia.
- Cada carta custa 3 sucatas. Comprar é opcional; o jogador pode passar sua oportunidade.
- Cada jogador tem duas oportunidades de adquirir uma carta. A sequência vai do jogador à esquerda da referência até a referência, que faz suas duas escolhas consecutivas, e retorna no sentido inverso.
- Exemplo com quatro jogadores e D como referência: **A → B → C → D → D → C → B → A**.
- A referência é o vencedor da última Arena. Quando uma Arena termina sem vencedor, manter a referência anterior. Sortear uma referência inicial para os casos em que ainda não houve vencedor.
- É permitido vender equipamentos durante a própria vez de Compra e durante a Montagem. Cada equipamento vendido rende 1 sucata e retorna ao baralho.
- Na própria vez de Compra, o jogador pode desbloquear módulos na sequência obrigatória **4 → 5 → 6**, pagando respectivamente 4, 5 e 6 sucatas. Pode realizar mais de um desbloqueio se tiver recursos.
- O desbloqueio é acionado no próprio espaço do módulo, mostrando apenas um símbolo de construção e o custo com um parafuso, símbolo da sucata. Amarelo indica disponibilidade; os demais espaços ficam cinza. Detalhes permanecem na ajuda. Só o próximo módulo da sequência fica disponível quando há saldo. Habilidades futuras dos módulos ainda não fazem parte desta versão.
- Vender e desbloquear módulos não consome uma oportunidade de comprar carta. Essas ações podem ocorrer antes ou depois da escolha de carta, enquanto for a vez do jogador.
- Simplificação posterior da interface solicitada por Victor: clicar numa carta da loja realiza a compra e encerra automaticamente aquela escolha. Na interface humana, vendas, melhorias e construção devem ser feitas antes da compra. As duas oportunidades, seus custos e a ordem dos participantes continuam iguais.
- **Melhoria paga (acrescentada no teste de Victor):** pagar 12 sucatas para transformar uma carta comum própria em melhorada, sem exigir uma tripla. A carta permanece no mesmo módulo ou na reserva; não se devolvem cartas ao baralho. A implementação oferece essa ação na própria vez de Compra, antes ou depois da aquisição de carta, sem consumir a escolha. Não permite melhorar novamente uma carta já melhorada. Os bots também podem usar essa ação.
- A loja revelada não é reabastecida durante essa fase. Cartas vendidas, descartadas em upgrades e não compradas retornam ao baralho para fases futuras.
- Um equipamento vendido volta ao mercado como carta comum; a marca de melhoria pertence à peça melhorada enquanto ela estiver com o jogador, não ao tipo de carta no baralho.

Durante Compra e Montagem, equipamentos recém-adquiridos podem aguardar a organização. Para confirmar a Montagem, todos devem estar em módulos habilitados, no máximo uma carta por módulo, ou na única vaga de reserva. Cada participante escolhe quais excedentes vender; nos adversários, a decisão é automática. Módulos podem ficar vazios.

## 5. Triplas e equipamentos melhorados

Três cartas comuns do mesmo tipo combinam automaticamente em um equipamento melhorado: duas cartas retornam ao baralho e uma permanece melhorada. A regra vale também na montagem inicial e considera as cartas comuns do jogador, equipadas ou fora dos módulos.

Cartas já melhoradas não entram na contagem de novas triplas. Assim, é possível obter mais de um equipamento melhorado do mesmo tipo. Não há melhoria acima desse nível na V0.1f.

A melhoria paga por 12 sucatas tem exatamente os mesmos efeitos da melhoria por tripla, inclusive HP passivo do Escudo, venda e exclusão de novas triplas.

| Carta | Comum | Melhorada |
| --- | --- | --- |
| A — Canhão | Causa 1 de dano ao adversário vivo mais avançado. Sortear entre alvos empatados. | Dois disparos consecutivos. Selecionar o alvo novamente antes de cada disparo; o segundo pode atingir outro robô. |
| K — Propulsor | Avança uma casa. | Avança duas casas, até o objetivo. |
| Q — Escudo | Aumenta o HP máximo em 1 quando equipado; a ativação cura 1, sem ultrapassar o máximo. | Aumenta o HP máximo em 2 quando equipado; a ativação cura 2, sem ultrapassar o máximo. |
| J — Coletor | Ganha 1 sucata. | Ganha 2 sucatas. |

## 6. Ordem e simultaneidade na Arena

1. Rolar um dado para cada robô vivo.
2. Resolver resultados por face, de **1 a 6**.
3. Dentro da mesma face, resolver tipos na ordem **A → K → Q → J**.
4. Mesma face e mesmo tipo formam um grupo de ativações simultâneas. A ordem de jogadores na interface não pode decidir esses efeitos.
5. Um módulo vazio não produz efeito. Um robô eliminado em um grupo anterior não executa ativações posteriores.
6. Concluir o grupo simultâneo e verificar encerramento antes de seguir para o próximo tipo ou face. Após resolver todos os resultados dessa rolagem, se a Arena continua, aguardar o comando para a próxima rolagem conjunta.

A apresentação registra cada disparo com atacante, alvo e dano. Mostra setas na direção dos disparos, destaca atiradores, módulos ativados e robôs atingidos, e mantém um resumo dos ataques após a animação. Ataques simultâneos são apresentados no mesmo grupo. A opção de rever a animação utiliza o resultado salvo, sem novos sorteios ou efeitos.

Coletor e Escudo têm realces e indicadores junto ao robô e nos recursos. A coleta mostra a sucata realmente recebida; o Escudo mostra o HP efetivamente recuperado, inclusive cura parcial, ou “HP cheio” quando não houve cura. Os indicadores usam os estados já resolvidos da rolagem.

O jogo utiliza a altura disponível da janela, com botões de rolagem, pausa, compra e confirmação sempre fora das áreas roláveis. O tabuleiro se redimensiona mantendo a proporção. Mercado e montagem usam cartas compactas; detalhes da rolagem abrem em uma janela sobre o jogo. Em espaços reduzidos, conteúdo excedente rola dentro do próprio painel, sem deslocar a página ou os controles principais.

Na arena, controles e avisos têm alturas reservadas. Ícones, indicadores de ganho e mensagens não redimensionam o tabuleiro; o resultado é apresentado sobre ele. A seleção de equipamentos também reserva espaço para suas ações, evitando deslocamentos quando uma carta é selecionada.

Vida, sucata e pontos do humano ocupam uma faixa fixa no topo em todas as fases. Fora da arena, a vida exibida é a máxima da montagem atual; durante a arena, a faixa acompanha o estado de cada evento apresentado. A próxima decisão dá título à área principal. O painel lateral da arena reúne equipamento próprio, dado, avanço ao centro, adversários e velocidade. No resumo, ataques recebidos pelo humano vêm primeiro, seguidos de seus ataques e das disputas entre bots, sem mudar a ordem de execução das regras.

O placar completo abre sob consulta. Regras, nova partida e confirmação de salvamento ficam no menu; erros de salvamento continuam visíveis diretamente. Os efeitos das cartas da loja e da peça selecionada ficam próximos da decisão de compra, venda ou melhoria. A classificação completa consta em `HIERARQUIA_VISUAL.md`.

### Correção de Victor sobre o A melhorado

**Os dois disparos pertencem a uma única ativação e acontecem imediatamente um após o outro. Nenhuma outra ativação entra entre eles.** Um A melhorado que recebe dano simultâneo completa seus dois disparos, mesmo que esse dano destrua seu robô.

Para conciliar essa sequência com a simultaneidade, a interpretação de execução aprovada é:

- Cada A do grupo parte do mesmo estado anterior aos ataques simultâneos.
- Dentro de um A melhorado, o segundo disparo considera o resultado do primeiro disparo daquele mesmo A, inclusive a eliminação do primeiro alvo.
- Os ataques dos outros A não se intercalam com essa sequência. Após determinar as ativações completas de todos os A do grupo, combinar seus danos e resolver eliminações e encerramento.

**Exemplo:** Ana ativa A melhorado e Bruno ativa A comum na mesma face. O ataque de Bruno destruirá Ana. Ana ainda executa os dois disparos; se seu primeiro disparo eliminar Bruno, seu segundo poderá atingir outro adversário. Só após resolver o grupo completo se determina quem sobrevive e se há vencedor.

Essa simultaneidade também significa que dois K da mesma face que alcancem o objetivo em seu grupo produzem chegada simultânea. Uma chegada em uma face anterior encerra a Arena antes das faces posteriores.

## 7. Encerramento e pontuação

| Situação | Resultado |
| --- | --- |
| Um robô chega ao objetivo | Esse jogador ganha 1 ponto. |
| Resta exatamente um robô vivo | Esse jogador ganha 1 ponto. |
| Dois ou mais robôs chegam simultaneamente | Arena termina sem pontos. |
| Todos os últimos robôs são destruídos simultaneamente | Arena termina sem pontos. |
| Há pelo menos dois sobreviventes e nenhum possui A ou K equipado | Arena termina sem pontos por ausência de possibilidade de vitória. |

Ao encerrar qualquer Arena, todos recebem **3 sucatas**, inclusive eliminados e participantes de arenas sem vencedor. Vitória ou eliminação completa é verificada antes da condição de Arena sem possibilidade de vitória.

Quando um jogador atinge 5 pontos, a partida termina. Uma Arena empatada não altera a referência da próxima Compra.

## 8. Salvamento e retomada

- Salvar automaticamente as escolhas e os resultados de execução para retomar a partida no mesmo navegador e computador.
- Fechar ou recarregar a página não pode duplicar compras, recompensas, dano ou outros efeitos já realizados.
- Uma rolagem já realizada deve manter seu resultado ao retomar. A apresentação pode concluir uma animação interrompida sem sortear novamente.
- Oferecer continuar a partida salva e iniciar outra, com confirmação antes de descartar a partida em andamento.
- Partidas salvas na versão de controle de todos os pilotos mantêm seu estado: o primeiro piloto passa a ser o humano e os demais são assumidos pelos bots. Retomar no meio de um turno de bot deve concluir apenas as ações restantes.
- A correção da sucata inicial para zero se aplica a novas partidas. Não descontar sucatas retroativamente de partidas já em andamento.

## 9. Critérios de conclusão da primeira entrega

- Conseguir completar partidas com um humano e 1, 2 ou 3 bots, da montagem inicial até 5 pontos.
- Realizar Compra, venda, desbloqueio, montagem, reserva e triplas respeitando custos, turnos e capacidade.
- Executar os quatro tipos de equipamento e suas melhorias com a ordem de faces e tipos correta.
- Preservar simultaneidade e os dois disparos completos do A melhorado.
- Tratar chegada simultânea, destruição mútua, loja reduzida ou vazia e Arena sem A/K conforme as decisões acima.
- Mostrar claramente suas decisões e recursos; destacar seu robô na arena e permitir consultar os adversários e o histórico sem concentrar todas as informações na tela principal.
- Adaptar telas de celular sem reorganizar o computador: abas Loja / Meu robô e Arena / Robôs, mantendo recursos e comandos acessíveis. A disposição se ajusta à orientação da tela, sem detectar marca ou sistema do aparelho.
- Salvar e retomar sem perder decisões ou repetir efeitos.
- Abrir localmente com instruções claras e apresentar a experiência 2D combinada.
