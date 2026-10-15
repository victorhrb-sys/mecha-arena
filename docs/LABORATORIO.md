# Laboratório — Carga e Crítico

Decisão de Victor em 18/09/2026, confirmada após entrevista grill-me/grilling na tarefa `01a0b53c-67ba-7e20-93b0-5abf956a109f`.

Terceira entrada do Mecha Arena, abrindo diretamente uma partida local contra 1–3 bots (padrão 3). Compartilha o motor e a interface do single player. O experimento usa `laboratory-v2` e salva em `mecha-arena.laboratory.v1`; o single player continua em `mecha-arena.solo.v1`. Revanche conserva o modo e inicia com zero carga. Salas e perfis online não recebem estas regras.

## Regras aprovadas

Revisão de Victor em 18/09/2026: três execuções no crítico, baralho ampliado, kit inicial e ícone de raio. Substitui o crítico de quatro execuções da D-v0.1fm.14.

- Baralho de 36 cartas: nove de cada tipo. Cada jogador recebe um Propulsor e um Canhão comuns do baralho e escolhe uma carta entre três opções. As outras duas retornam ao baralho.

- Todos começam com zero carga, inclusive bots. Teto rígido de seis; excedente descartado. Carga persiste entre arenas, eliminações e lojas.
- Cada dado 4 ou 5 gera uma carga; 6 gera duas. Ganho imediato ao rolar, inclusive em casa vazia/bloqueada ou antes de morrer naquela rolagem.
- Se começar a rolagem com seis cargas, consumir todas e rolar dois dados. Os resultados geram nova carga; completar seis durante a resolução só modifica a próxima rolagem.
- Dois dados iguais ativam três execuções do equipamento: duas dos dados e uma adicional. O crítico não multiplica carga natural nem bônus passivos de vida máxima.
- Ordem global de faces 1–6 e, em cada face, A–K–Q–J. Grupos de mesma face/tipo permanecem simultâneos. Completar execuções do grupo antes de verificar eliminações/vitória; eliminados não executam grupos posteriores.
- Cada execução de ataque escolhe alvo segundo a regra usual. O upgrade mantém os dois tiros no alvo enquanto possível. Reescolher entre execuções, considerando os danos próprios anteriores; ignorar danos de outros atores simultâneos até fechar o grupo. Crítico melhorado: até seis tiros, sem perder execuções por dano letal simultâneo.
- Cura ativa excedente converte 1:1 em carga até o teto. Crítico de cura comum: até três; melhorado: até seis. Restauração de HP entre arenas não gera carga.

## Apresentação

Raio pequeno nos medidores e nos ganhos (+ quantidade e raio), pelos dados e pela cura excedente. Seis segmentos por jogador, com indicação de próxima rolagem carregada ao chegar a seis. Dois dados reais e persistentes na rolagem carregada, destaque breve “Rolagem carregada”. Crítico válido: chamada central **CRÍTICO**, identificação do jogador, brilho nos dados e pausa automática curta, sem clique. Dupla sem equipamento ativo: “Sem efeito” discreto. Respeitar movimento reduzido, velocidade, histórico e reprodução sem novo sorteio ou ganho de recursos.

## Compatibilidade e validação

Salvamentos laboratory-v1 recebem uma carta extra de cada tipo ao retomar, sem mudar inventário, ofertas, RNG ou a rolagem já registrada. Preparações antigas mantêm suas três escolhas; partidas novas e revanches usam o kit fixo mais uma escolha. A migração é idempotente.

A correção do alvo do upgrade é exclusiva do Laboratório. Regras e RNG dos modos anteriores permanecem compatíveis. Política de escolhas dos bots reutilizada; o motor aplica as regras novas igualmente. Testes específicos cobrem ciclo de carga, crítico, cura, alvos, simultaneidade, ordem, salvamento independente e partidas completas com 1–3 bots. Avaliação de equilíbrio por Victor permanece parte do propósito experimental.
