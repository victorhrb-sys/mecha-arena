# Mecha Arena v0.1f — rodada de simulações

187.200 arenas controladas; 8.400 partidas no torneio; 3.840 partidas com escolha inicial controlada. Semente 20260911. Regras da v0.1f preservadas.

## O ciclo existe, mas não em todas as etapas

No início, AAQ venceu KKQ em 78,3% e KQQ em 59,9% dos duelos. Nas montagens intermediárias, o ciclo apareceu: ataque venceu corrida em 64,7%; corrida venceu defesa em 54,4%; defesa venceu ataque em 55,9%. Assim, o contrajogo defensivo testado não segurou o ataque inicial. São confrontos de montagens específicas, com faces variadas, não uma prova sobre todas as combinações.

## O tamanho da mesa muda quem leva vantagem

No torneio, o Agressivo venceu 61,5% dos duelos, 29,2% das mesas de três e 15,2% das de quatro. O Investidor venceu 34,0%, 39,6% e 37,6%, respectivamente. As referências simétricas são 50%, 33,3% e 25%. A economia fica competitiva nas mesas maiores sob estas políticas. Isso é um efeito conjunto de seleção, montagem e gastos; não demonstra que J sozinho cause a vantagem.

## Evoluções têm efeitos muito diferentes

Com K + Q de apoio no início de um duelo, melhorar A elevou a vitória de 42,6% para 77,2%; melhorar K, de 51,3% para 68,4%. Já adquirir a terceira Q e combinar duas Q equipadas reduziu a vitória em 4,6 pontos percentuais (IC 95%: −7,0 a −2,2). Duas Q comuns e uma Q melhorada concedem o mesmo HP passivo, mas a tripla perde uma face de cura até repor a vaga. O custo de aquisição não entra nesses testes de arena.

## O Coletor sofre quando falta tempo para reinvestir

Na escolha inicial controlada do perfil Equilibrado, K + Q + J venceu 52,5% das partidas iniciadas em 0–0, contra 61,3% com um K adicional. No cenário 4–4, foram 27,1% com J e 57,9% com K. No perfil Investidor, J ficou 3,8 pontos abaixo de K em 0–0, mas o IC da diferença incluiu zero; em 4–4 ficou 30,0 pontos abaixo. Não há evidência de J dominar a abertura dos duelos. Em 4–4 com três módulos, perder força imediata por renda futura foi claramente ruim.

## O valor marginal do Escudo depende da proteção que já existe

Nas montagens intermediárias de três e quatro jogadores, adicionar Q comum foi a melhor estimativa entre as quatro opções: 38,3% e 29,6% de vitória. Na base avançada, que já inclui Q e Q melhorado, melhorar a Q adicional aumentou a vitória em apenas 0,8 a 1,3 pontos percentuais. Isso indica retorno marginal pequeno nessa base protegida, não que Escudo seja fraco em todo final de partida. A base avançada também tem mais melhorias que os adversários; compare cartas dentro da etapa, não taxas absolutas entre etapas.

## A melhoria paga quase não apareceu em mesas pequenas

Houve 24 melhorias pagas nas 5.040 partidas de dois jogadores, 14 nas 1.680 de três e 940 nas 1.680 de quatro. Partidas de quatro duraram em média 11,85 arenas, contra 7,42 nos duelos. O preço de 12 sucatas e a prioridade de compras dos bots são candidatos conjuntos à investigação; a frequência baixa não prova que o preço esteja errado. Antes da v0.2, priorizar testes de contrajogo ao ataque inicial, perda de faces na tripla de Q e incentivo para poupar pela melhoria paga. Calibrar os perfis com decisões humanas antes de tratá-los como uma população representativa.

## Carta acrescentada à montagem

Taxa de vitória na arena. Cada célula tem 1.800 repetições. A linha compara uma carta no mesmo espaço, preservando a base e os adversários. “Melhorada” não desconta o custo de aquisição.

| Etapa | Jogadores | Carta | Comum (IC 95%) | Melhorada (IC 95%) | Ganho da melhoria |
|---|---:|---|---|---|---:|
| Início | 2 | Canhão | 42,6% (40,3%–44,9%) | 77,2% (75,2%–79,1%) | +34,7 p.p. |
| Início | 2 | Propulsor | 51,3% (49,0%–53,6%) | 68,4% (66,2%–70,5%) | +17,1 p.p. |
| Início | 2 | Escudo | 33,2% (31,1%–35,4%) | 45,1% (42,8%–47,4%) | +11,9 p.p. |
| Início | 2 | Coletor | 21,9% (20,0%–23,9%) | 21,9% (20,0%–23,9%) | +0,0 p.p. |
| Início | 3 | Canhão | 22,4% (20,6%–24,4%) | 50,1% (47,8%–52,4%) | +27,7 p.p. |
| Início | 3 | Propulsor | 37,8% (35,6%–40,0%) | 58,7% (56,4%–61,0%) | +20,9 p.p. |
| Início | 3 | Escudo | 27,9% (25,9%–30,1%) | 39,3% (37,1%–41,6%) | +11,4 p.p. |
| Início | 3 | Coletor | 11,7% (10,3%–13,2%) | 11,7% (10,3%–13,2%) | +0,0 p.p. |
| Início | 4 | Canhão | 18,2% (16,5%–20,0%) | 35,2% (33,0%–37,4%) | +17,0 p.p. |
| Início | 4 | Propulsor | 35,8% (33,7%–38,1%) | 56,2% (53,9%–58,5%) | +20,4 p.p. |
| Início | 4 | Escudo | 27,8% (25,8%–29,9%) | 33,8% (31,7%–36,1%) | +6,0 p.p. |
| Início | 4 | Coletor | 13,8% (12,3%–15,4%) | 13,8% (12,3%–15,4%) | +0,0 p.p. |
| Meio | 2 | Canhão | 52,9% (50,6%–55,2%) | 73,4% (71,4%–75,4%) | +20,6 p.p. |
| Meio | 2 | Propulsor | 46,4% (44,1%–48,7%) | 61,7% (59,4%–63,9%) | +15,3 p.p. |
| Meio | 2 | Escudo | 49,3% (47,0%–51,6%) | 57,3% (55,0%–59,5%) | +7,9 p.p. |
| Meio | 2 | Coletor | 25,9% (23,9%–28,0%) | 25,9% (23,9%–28,0%) | +0,0 p.p. |
| Meio | 3 | Canhão | 34,1% (32,0%–36,3%) | 54,2% (51,9%–56,5%) | +20,1 p.p. |
| Meio | 3 | Propulsor | 30,7% (28,6%–32,8%) | 47,6% (45,3%–49,9%) | +16,9 p.p. |
| Meio | 3 | Escudo | 38,3% (36,1%–40,6%) | 48,0% (45,7%–50,3%) | +9,7 p.p. |
| Meio | 3 | Coletor | 17,1% (15,4%–18,9%) | 17,1% (15,4%–18,9%) | +0,0 p.p. |
| Meio | 4 | Canhão | 23,2% (21,3%–25,2%) | 40,0% (37,8%–42,3%) | +16,8 p.p. |
| Meio | 4 | Propulsor | 20,9% (19,1%–22,8%) | 36,8% (34,6%–39,1%) | +15,9 p.p. |
| Meio | 4 | Escudo | 29,6% (27,5%–31,7%) | 40,4% (38,1%–42,7%) | +10,8 p.p. |
| Meio | 4 | Coletor | 11,4% (10,0%–12,9%) | 11,4% (10,0%–12,9%) | +0,0 p.p. |
| Avançado | 2 | Canhão | 67,6% (65,4%–69,7%) | 83,8% (82,0%–85,4%) | +16,2 p.p. |
| Avançado | 2 | Propulsor | 71,4% (69,3%–73,5%) | 81,4% (79,6%–83,2%) | +10,0 p.p. |
| Avançado | 2 | Escudo | 63,1% (60,9%–65,3%) | 63,9% (61,6%–66,1%) | +0,8 p.p. |
| Avançado | 2 | Coletor | 59,8% (57,5%–62,1%) | 59,8% (57,5%–62,1%) | +0,0 p.p. |
| Avançado | 3 | Canhão | 50,1% (47,7%–52,4%) | 65,5% (63,3%–67,7%) | +15,4 p.p. |
| Avançado | 3 | Propulsor | 48,8% (46,5%–51,1%) | 64,5% (62,3%–66,7%) | +15,7 p.p. |
| Avançado | 3 | Escudo | 40,0% (37,8%–42,3%) | 41,2% (39,0%–43,5%) | +1,2 p.p. |
| Avançado | 3 | Coletor | 36,6% (34,4%–38,9%) | 36,6% (34,4%–38,9%) | +0,0 p.p. |
| Avançado | 4 | Canhão | 36,8% (34,6%–39,1%) | 54,1% (51,7%–56,3%) | +17,2 p.p. |
| Avançado | 4 | Propulsor | 39,8% (37,6%–42,1%) | 58,1% (55,8%–60,3%) | +18,2 p.p. |
| Avançado | 4 | Escudo | 30,4% (28,4%–32,6%) | 31,7% (29,6%–33,9%) | +1,3 p.p. |
| Avançado | 4 | Coletor | 27,1% (25,1%–29,2%) | 27,1% (25,1%–29,2%) | +0,0 p.p. |

## Confrontos entre montagens

Vitórias de A e B não somam 100% quando há empate. Faces embaralhadas e assentos alternados.

| Etapa | Montagem A | Montagem B | Vitória A | Vitória B | Empate | Limite |
|---|---|---|---:|---:|---:|---:|
| Início | Ataque | Corrida | 78,3% | 21,7% | 0,0% | 0 |
| Início | Ataque | Defesa | 59,9% | 40,1% | 0,0% | 0 |
| Início | Ataque | Economia | 94,7% | 5,3% | 0,0% | 0 |
| Início | Corrida | Defesa | 84,4% | 14,8% | 0,8% | 0 |
| Início | Corrida | Economia | 86,6% | 12,8% | 0,6% | 0 |
| Início | Defesa | Economia | 51,1% | 48,0% | 0,9% | 0 |
| Meio | Ataque | Corrida | 64,7% | 34,3% | 0,9% | 0 |
| Meio | Ataque | Defesa | 43,2% | 55,9% | 0,9% | 0 |
| Meio | Ataque | Economia | 77,4% | 22,1% | 0,5% | 0 |
| Meio | Corrida | Defesa | 54,4% | 45,2% | 0,4% | 0 |
| Meio | Corrida | Economia | 67,4% | 31,9% | 0,7% | 0 |
| Meio | Defesa | Economia | 73,7% | 25,8% | 0,4% | 0 |
| Avançado | Ataque | Corrida | 61,1% | 38,1% | 0,8% | 0 |
| Avançado | Ataque | Defesa | 50,4% | 48,7% | 0,9% | 0 |
| Avançado | Ataque | Economia | 85,6% | 13,8% | 0,6% | 0 |
| Avançado | Corrida | Defesa | 56,3% | 43,3% | 0,3% | 0 |
| Avançado | Corrida | Economia | 81,2% | 18,1% | 0,7% | 0 |
| Avançado | Defesa | Economia | 68,3% | 31,1% | 0,7% | 0 |

## Intervenções no início

A tripla compara duas comuns + apoio com a melhorada + apoio; a terceira carta dispara a combinação. Não é “três comuns equipadas”, um estado que as regras não permitem. O custo da terceira carta e o uso futuro da vaga livre ficam fora deste teste imediato.

| Experimento | Antes | Depois | Variação de vitória | IC 95% da diferença |
|---|---|---|---:|---|
| triple-A | A / A / Q | A* / Q / vazio | +10,8 p.p. | +8,2 p.p. a +13,5 p.p. |
| triple-K | K / K / Q | K* / Q / vazio | +4,5 p.p. | +2,6 p.p. a +6,4 p.p. |
| triple-Q | Q / Q / K | Q* / K / vazio | -4,6 p.p. | -7,0 p.p. a -2,2 p.p. |
| triple-J | J / J / Q | J* / Q / vazio | +0,0 p.p. | +0,0 p.p. a +0,0 p.p. |
| shield-first | K / J / vazio | K / J / Q | +1,9 p.p. | +1,3 p.p. a +2,5 p.p. |
| cannon-first-face | Q / A / K | A / Q / K | +1,4 p.p. | -1,6 p.p. a +4,5 p.p. |
| thruster-first-face | A / Q / K | K / Q / A | +0,3 p.p. | -2,7 p.p. a +3,2 p.p. |

## Torneio completo

Taxas de vitória na partida até 5 pontos. O referencial de uma mesa simétrica é 50%, 33,3% e 25% para 2, 3 e 4 participantes. O perfil mede uma política inteira, não o efeito isolado de uma carta.

| Jogadores | Perfil | Partidas | Vitórias | Taxa (IC 95%) | Melhorias pagas por partida | Triplas por partida |
|---|---|---:|---:|---|---:|---:|
| 2 | Agressivo | 1440 | 885 | 61,5% (58,9%–63,9%) | 0.00 | 1.22 |
| 2 | Corredor | 1440 | 671 | 46,6% (44,0%–49,2%) | 0.00 | 1.27 |
| 2 | Defensivo | 1440 | 627 | 43,5% (41,0%–46,1%) | 0.00 | 1.31 |
| 2 | Investidor | 1440 | 490 | 34,0% (31,6%–36,5%) | 0.01 | 1.63 |
| 2 | Oportunista | 1440 | 794 | 55,1% (52,6%–57,7%) | 0.00 | 1.34 |
| 2 | Equilibrado | 1440 | 805 | 55,9% (53,3%–58,4%) | 0.00 | 1.33 |
| 2 | Clássico | 1440 | 768 | 53,3% (50,8%–55,9%) | 0.00 | 1.52 |
| 3 | Equilibrado | 720 | 245 | 34,0% (30,7%–37,6%) | 0.00 | 2.20 |
| 3 | Oportunista | 720 | 233 | 32,4% (29,0%–35,9%) | 0.00 | 2.19 |
| 3 | Defensivo | 720 | 245 | 34,0% (30,7%–37,6%) | 0.00 | 2.13 |
| 3 | Clássico | 720 | 187 | 26,0% (22,9%–29,3%) | 0.00 | 2.18 |
| 3 | Investidor | 720 | 285 | 39,6% (36,1%–43,2%) | 0.02 | 2.44 |
| 3 | Corredor | 720 | 275 | 38,2% (34,7%–41,8%) | 0.00 | 2.03 |
| 3 | Agressivo | 720 | 210 | 29,2% (26,0%–32,6%) | 0.00 | 2.11 |
| 4 | Corredor | 960 | 317 | 33,0% (30,1%–36,1%) | 0.13 | 1.80 |
| 4 | Oportunista | 960 | 185 | 19,3% (16,9%–21,9%) | 0.09 | 2.02 |
| 4 | Investidor | 960 | 361 | 37,6% (34,6%–40,7%) | 0.33 | 2.22 |
| 4 | Clássico | 960 | 153 | 15,9% (13,8%–18,4%) | 0.12 | 2.13 |
| 4 | Equilibrado | 960 | 229 | 23,9% (21,3%–26,7%) | 0.11 | 1.96 |
| 4 | Agressivo | 960 | 146 | 15,2% (13,1%–17,6%) | 0.08 | 1.93 |
| 4 | Defensivo | 960 | 289 | 30,1% (27,3%–33,1%) | 0.13 | 1.85 |

## Horizonte econômico da terceira carta

Mesmos K + Q iniciais, adversário, semente e assento por comparação; a terceira carta é concedida. Depois disso, compras, melhorias e montagem seguem a política do perfil. São 240 partidas por célula. Placar 4–4 com três módulos é um cenário de isolamento do horizonte, não uma estimativa do equipamento típico no fim.

| Perfil focal | Placar inicial | Terceira carta | Vitória na partida (IC 95%) | Arenas em média | Coletor menos esta carta (IC 95%) |
|---|---|---|---|---:|---|
| Equilibrado | 0–0 | Canhão | 50,4% (44,1%–56,7%) | 7.7 | +2,1 p.p. (-6,6 p.p. a +10,8 p.p.) |
| Equilibrado | 0–0 | Propulsor | 61,3% (55,0%–67,2%) | 7.7 | -8,8 p.p. (-17,4 p.p. a -0,1 p.p.) |
| Equilibrado | 0–0 | Escudo | 47,5% (41,3%–53,8%) | 7.8 | +5,0 p.p. (-3,6 p.p. a +13,6 p.p.) |
| Equilibrado | 0–0 | Coletor | 52,5% (46,2%–58,7%) | 7.7 | — |
| Equilibrado | 4–4 | Canhão | 44,2% (38,0%–50,5%) | 1.0 | -17,1 p.p. (-24,7 p.p. a -9,5 p.p.) |
| Equilibrado | 4–4 | Propulsor | 57,9% (51,6%–64,0%) | 1.0 | -30,8 p.p. (-36,7 p.p. a -25,0 p.p.) |
| Equilibrado | 4–4 | Escudo | 39,6% (33,6%–45,9%) | 1.0 | -12,5 p.p. (-16,7 p.p. a -8,3 p.p.) |
| Equilibrado | 4–4 | Coletor | 27,1% (21,9%–33,0%) | 1.0 | — |
| Investidor | 0–0 | Canhão | 43,8% (37,6%–50,1%) | 7.5 | +0,0 p.p. (-8,2 p.p. a +8,2 p.p.) |
| Investidor | 0–0 | Propulsor | 47,5% (41,3%–53,8%) | 7.5 | -3,8 p.p. (-11,4 p.p. a +3,9 p.p.) |
| Investidor | 0–0 | Escudo | 41,3% (35,2%–47,6%) | 7.4 | +2,5 p.p. (-5,7 p.p. a +10,7 p.p.) |
| Investidor | 0–0 | Coletor | 43,8% (37,6%–50,1%) | 7.4 | — |
| Investidor | 4–4 | Canhão | 41,7% (35,6%–48,0%) | 1.0 | -21,7 p.p. (-28,8 p.p. a -14,5 p.p.) |
| Investidor | 4–4 | Propulsor | 50,0% (43,7%–56,3%) | 1.0 | -30,0 p.p. (-35,8 p.p. a -24,2 p.p.) |
| Investidor | 4–4 | Escudo | 34,6% (28,9%–40,8%) | 1.0 | -14,6 p.p. (-19,1 p.p. a -10,1 p.p.) |
| Investidor | 4–4 | Coletor | 20,0% (15,4%–25,5%) | 1.0 | — |

## Validade e limites

0 partidas interrompidas por limite; 0 execuções controladas interrompidas. Limites não foram classificados como empates. Intervalos exploratórios, sem correção por múltiplas comparações. Mesma semente não garante dados iguais depois de decisões divergentes. As montagens são legais e conservam o baralho, mas as bases escolhidas não cobrem todo o espaço estratégico. Não houve calibração humana nem ajuste dos pesos após observar esta rodada.

A ordem de módulos também muda a precedência dos efeitos; os testes de carta embaralham faces, e as intervenções de face medem mudanças específicas. O Escudo aumenta HP passivo; o Coletor exige medir retorno econômico. A melhoria paga de 12 sucatas acontece no torneio, mas a comparação “comum/melhorada” nas arenas não é uma estimativa do retorno desse gasto.

O protocolo completo está em [SIMULACOES.md](../../docs/SIMULACOES.md). Parâmetros, resumos e hashes estão em [summary.json](summary.json); trajetórias em [matches.jsonl](matches.jsonl) e [opening-choices.jsonl](opening-choices.jsonl).

## Reproduzir

```sh
node simulations/run.mjs --samples 1800 --matches 240 --seed 20260911
node simulations/report.mjs
```
