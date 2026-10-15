# Multiplayer — implementação inicial

Implementado em 11/09/2026 na branch `codex/multiplayer`, a partir da tag `base`.

## Entregue

- Salas por código/link, nomes individuais e 2–4 participantes.
- Controle do próprio robô para qualquer posição na sala.
- Todas as fases do motor original: seleção, montagem, arena, loja e vitória aos 5 pontos.
- Três escolhas iniciais simultâneas e montagem independente, iniciada assim que cada jogador termina suas escolhas.
- Montagem simultânea também depois de cada loja; a arena começa somente após todos confirmarem **Estou pronto ✓**.
- Rolagens oficiais e avanço de arena pelo criador; animações locais independentes.
- Sessões recuperáveis, reenvio seguro de ações e partida persistente.
- Visões privadas por jogador e histórico das composições reveladas.
- Servidor local SQLite e entrada Cloudflare Workers/D1 no mesmo código de API.
- Ambiente de publicação separado da Base.
- Perfis públicos identificados somente pelo nome, reutilizáveis em qualquer aparelho, sem senha ou e-mail.
- Estatísticas de partidas completas, vitórias e arenas vencidas; histórico das últimas dez partidas.
- Bots adicionados/removidos pelo criador antes do início, com até quatro participantes entre humanos e bots.
- Testes de partidas completas via HTTP com 2, 3 e 4 sessões, preparação concorrente, privacidade e retomada.

## Decisões da primeira versão

Compras preservam a sequência da Base porque disputam as mesmas cartas da loja. Escolhas iniciais e montagem são independentes por jogador: as ofertas são reservadas do mesmo baralho, e quem termina as escolhas pode montar enquanto os demais ainda escolhem. A confirmação trava o robô até a arena, que só começa após todos estarem prontos.

O servidor centraliza todos os sorteios. Cada comando possui um identificador de reenvio. Na preparação, um identificador da partida e rodada e uma revisão individual permitem aceitar comandos simultâneos sem conflitos causados por outro jogador. A loja e a arena continuam usando a revisão compartilhada. O banco atualiza partida e recibo numa única operação condicional. Os clientes consultam o estado a cada 1,2 segundo e descartam respostas anteriores às já recebidas. Atualizações recebidas durante um arraste são aplicadas ao soltá-lo, para não remover a peça sob o cursor.

Salas existentes são convertidas ao retomar, preservando ofertas já visíveis, escolhas e montagens confirmadas. O cliente precisa ser recarregado para obter a interface atualizada. Não há mudança no esquema do banco.

## Perfis por nome — 11/09/2026

O usuário escolheu explicitamente retomar o mesmo perfil pelo nome em qualquer aparelho, confiando no grupo. Esse seletor não comprova a identidade do jogador. Perfis e estatísticas são públicos; a autorização para controlar o robô continua na sessão privada da sala. Não foi implementada autenticação por senha, e-mail ou provedor externo, nem ranking competitivo.

A migração `0001_username_profiles.sql` acrescenta `profiles` e `profile_results`, sem modificar salas existentes. O nome normalizado é único. Cada resultado é único por partida e perfil, e só é aceito junto com a atualização oficial da sala. A condição também compara o estado gravado para que comandos que perdem uma disputa de revisão não registrem um resultado diferente. Reenvios e revanche não duplicam contagens; perfis e resultados não expiram com a sala.

O histórico passa a registrar partidas concluídas a partir desta atualização. Estatísticas de arenas são somadas ao terminar a partida completa. O navegador guarda apenas a seleção do perfil; o servidor é a fonte dos resultados.

O criador conduz as rolagens e o avanço de arena. Se ele sair antes de iniciar, o próximo jogador assume. Depois de iniciar, vagas ficam reservadas para reconexão, sem substituição por bots ou transferência de controle. Uma sala expira após 7 dias sem ações.

## Bots em salas — 12/09/2026

Salas podem combinar humanos e bots, com pelo menos um humano e até quatro participantes. Apenas o criador adiciona/remove bots e somente antes de iniciar. Se sair antes da partida, o controle passa a outro humano; se nenhum humano permanecer, os bots são removidos.

As escolhas, montagens e compras dos bots são executadas no servidor, dentro da mesma atualização atômica da ação humana. A preparação dos humanos continua simultânea, e a loja só para quando chega a vez de um humano. Rolagens e passagem de arena permanecem com o criador. Revanche e retomada preservam os bots.

A política original de bots é reutilizada com uma projeção restrita das informações disponíveis. Bot não recebe cartas alheias privadas, baralho, estado aleatório ou dados futuros. O histórico humano identifica partidas com bots; nenhum resultado cria ou credita um perfil para o bot. Não há mudança no esquema do banco.

## Validação pendente com pessoas

A primeira implementação ainda deve ser exercitada manualmente em computadores e celulares diferentes: conforto dos turnos, visibilidade dos controles, comportamento das animações em conexões lentas e duração da espera entre decisões. Os testes automatizados cobrem a lógica, os fluxos HTTP e a renderização; não são uma rodada manual em dispositivos físicos.

Depois dessa estabilização, integrar **Jogar contra bots** e **Jogar online** numa tela inicial comum, preservando o motor compartilhado.

Instruções de uso e limites estão no [README](../README.md).
