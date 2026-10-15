# Hierarquia visual — Mecha Arena

Revisão solicitada por Victor: dar posições claras e visíveis às informações mais relevantes e mais consultadas. A classificação usa o impacto na decisão e a frequência esperada de consulta durante uma partida; não representa dados de uso medidos.

## Prioridades

| Informação | Relevância | Apresentação |
| --- | --- | --- |
| Próxima decisão e comando principal | Essencial | Título da etapa e ação destacada acima da área de jogo: escolher, montar, rolar ou concluir a compra. |
| Vida, sucata e pontos próprios | Essencial | Faixa fixa no topo, na mesma ordem em todas as fases, com números maiores e rótulos explícitos. |
| Vida atual durante a arena | Essencial | Atualiza junto de cada evento apresentado. Dano destaca o número; vida reduzida a 1 recebe alerta de cor quando o máximo é maior. |
| Vida máxima fora da arena | Essencial na montagem | A mesma posição da faixa superior, com rótulo “Vida máxima”; calculada a partir dos módulos atuais. |
| Ataque recebido ou feito pelo jogador | Essencial na arena | Setas e efeitos no tabuleiro; título contextual e registros prioritários na faixa fixa de eventos. Recebidos aparecem antes dos feitos; a ordem das regras permanece intacta. |
| Resultado, ponto e recompensa da arena | Essencial ao encerrar | Janela sobre o tabuleiro com a próxima ação. A arena mantém suas dimensões. |
| Erro de ação ou salvamento | Essencial quando ocorre | Aviso direto, sem exigir abrir menu. |
| Equipamentos e módulos próprios | Consulta frequente | Área central na montagem; painel próprio na compra e na lateral da arena. Módulo ativado recebe realce. |
| Dado próprio e avanço ao centro | Consulta frequente na arena | Ao lado dos equipamentos, com número do dado e progresso visual de 0 a 4. |
| Vida, posição e pontos dos adversários | Consulta frequente na arena | Linhas compactas sempre presentes na lateral; ganhos transitórios não ocultam vida ou posição. |
| Efeito, melhoria e custo das cartas disponíveis | Essencial para escolher ou comprar | Nas próprias cartas. O efeito da peça própria selecionada também aparece junto das ações de vender e melhorar. |
| Escolhas restantes, reserva excedente e recursos insuficientes | Essencial na etapa correspondente | Próximo das opções e do comando de confirmação. |
| Venda, melhoria e desbloqueio | Consulta frequente na compra | Junto do equipamento próprio; ações permanecem fora da área interna que rola. Custos explícitos. |
| Velocidade e pausa | Controle recorrente | Velocidade em área fixa na base do painel lateral; pausa ao lado da rolagem. |
| Fase e número da arena | Essencial para orientação | Títulos explícitos “Loja de peças”, “Oficina de montagem” e “Arena”, com uma instrução curta. Fundos próprios e cores de ambiente distinguem as fases; a trilha complementar indica Loja → Oficina → Arena. |
| Coleta, cura e movimento | Acompanhamento | Efeitos no robô e faixa de eventos; recursos próprios também atualizam no topo. |
| Ataques apenas entre adversários | Acompanhamento secundário | Continuam visíveis, após os que envolvem o jogador, com menor destaque. |
| Placar completo, módulos e sucata de todos | Consulta ocasional | Botão “Placar” no topo. Os pontos dos adversários também ficam visíveis durante a arena. |
| Equipamento, sucata e estilo de um adversário | Consulta ocasional | Expandir sua linha na arena; estilo e totais também constam no placar. |
| Ordem detalhada dos eventos e repetição da animação | Consulta ocasional | “Ver detalhes” na faixa de eventos, abrindo uma janela. |
| Regras, ordem de compra e explicações de módulos | Consulta ocasional | Ajudas “?” no contexto e “Menu → Como jogar”. |
| Nome próprio e identidade dos robôs | Orientação secundária | Nome na faixa superior em telas com espaço; cores e nomes junto aos robôs e adversários. |
| Letras A/K/Q/J, melhoria e números de módulos | Referência das peças | Letras pequenas; melhoria e número do módulo junto do equipamento. Ícone e nome da peça têm precedência visual. |
| Salvamento concluído e nova partida | Consulta ocasional | Menu da partida; erros de salvamento continuam fora do menu. |
| Marca do jogo | Identidade | Cabeçalho compacto, com menor destaque que os recursos e comandos. |

## Celular

- A folha de estilos específica só se aplica até 700 px de largura, ou até 1000 × 550 px com apontador de toque. Os painéis do computador continuam lado a lado.
- Vida, sucata e pontos permanecem no topo. O título da fase substitui a trilha complementar em telas pequenas.
- Na compra, **Loja / Meu robô** alterna ofertas e equipamentos. O comando de concluir ou passar fica acima das abas, disponível em ambas.
- Na arena, **Arena / Robôs** alterna tabuleiro e consulta dos equipamentos/adversários. Rolagens e velocidade ficam disponíveis nas duas abas. Consultar os robôs pausa as rolagens automáticas; rolar volta ao tabuleiro, e o resultado também o reabre.
- A montagem apresenta seis espaços em duas linhas no celular em pé e em uma linha deitado. Ofertas e cartas usam ícones e textos mais compactos, com os efeitos essenciais nas cartas da loja.
- O desbloqueio acontece no próprio módulo, com símbolo de construção e custo em parafusos, sem texto permanente. Amarelo indica que o espaço pode ser construído; cinza indica indisponibilidade. Pré-requisito e motivo ficam na ajuda. Só o próximo espaço pode ser construído, na loja e com saldo suficiente. Essa interação também vale no computador.
- Conteúdo excedente usa rolagem interna; comandos principais ficam fora dessa área.
- Um parafuso amarelo identifica sucata em toda a interface, com números ao lado. Os rótulos acessíveis mantêm o nome do recurso. Estrelas ficam reservadas às melhorias de equipamentos.
- Comprar uma carta conclui imediatamente a escolha e avança a sequência, sem um botão de confirmação adicional. Vendas, melhorias e construção podem ser feitas antes de comprar; Passar encerra a escolha sem compra.

## Estabilidade

- A faixa de recursos acompanha os estados já resolvidos da animação, sem antecipar recompensas nem aplicar efeitos novamente.
- Controles, painel próprio, velocidade e faixa de eventos têm áreas reservadas. O tabuleiro usa apenas o espaço restante, independentemente dos ícones ou avisos presentes.
- Detalhes extensos usam janelas ou rolagem interna. Abrir equipamentos adversários não desloca a velocidade nem redimensiona o tabuleiro.
- Os efeitos e nomes das cartas permanecem acessíveis por rótulos, descrições e ajudas. A cor complementa o texto.
- A revisão preserva regras, bots, preferências de velocidade e partidas salvas.
- A loja tem iluminação âmbar; a oficina, iluminação azul; a arena, iluminação vermelha. Cartas e recursos mantêm suas cores habituais. Preparação inicial usa a oficina; resultado e repetição da animação continuam no ambiente de arena.
