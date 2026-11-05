# Jogar Mecha Arena

Abra o [jogo](https://mecha-arena-multiplayer.victor-hrb.chatgpt.site) ou inicie o [servidor local](DESENVOLVIMENTO.md). A tela inicial oferece três entradas que compartilham o motor e a interface.

| Entrada | Participantes | Onde fica o progresso |
| --- | --- | --- |
| Single player | Você e 1–3 bots; padrão de três | Neste navegador e endereço |
| Multiplayer | 2–4 participantes, misturando pessoas e bots, com ao menos uma pessoa | Servidor da sala; credencial de controle no navegador |
| Laboratório | Você e 1–3 bots, com regras de carga e crítico | Save separado neste navegador |

## Partida local

Escolha o modo, informe um nome e a quantidade de bots. **Continuar** retoma o save daquele modo; **Nova partida** o substitui. Os bots decidem automaticamente, e você conduz as rolagens e a passagem entre arenas. Os resultados locais não entram nas estatísticas online.

Depois de carregar a página, motor e bots funcionam no navegador. Não há service worker ou instalação offline: abrir novamente o site ainda depende de acesso à página. Limpar os dados do navegador remove os saves locais.

## Sala com amigos e bots

1. Escolha **Multiplayer** e um nome de usuário. Uma pessoa cria a sala.
2. Compartilhe o link ou código de seis caracteres. Cada pessoa entra no próprio navegador.
3. O criador pode adicionar ou remover bots enquanto a partida não começou.
4. Com dois a quatro participantes, o criador inicia a partida.
5. Cada pessoa escolhe e monta seu robô no próprio ritmo. A arena começa quando todos confirmam.
6. Na loja, as compras seguem turnos porque as cartas são compartilhadas. O criador conduz as rolagens e a próxima arena.

**Retomar sala** no navegador original recupera o controle do mesmo robô. Voltar à tela inicial não libera a vaga. Antes de iniciar, **Sair da sala** libera a vaga e transfere a criação para outro humano, se necessário. Depois de iniciar, os participantes ficam definidos até o fim.

O perfil é público e não tem senha. Qualquer pessoa que usar o mesmo nome acessa as mesmas estatísticas; selecionar esse nome em outro aparelho não transfere a sessão privada da sala. O modelo foi pensado para grupos que confiam uns nos outros, sem ranking competitivo autenticado.

## Ciclo de jogo

Na partida normal, cada jogador começa sem sucata, escolhe três equipamentos e monta o robô nos módulos de um a três. Cada módulo corresponde a uma face do dado. A reserva permite uma carta; equipe ou venda o excedente antes de confirmar.

Na arena, todos rolam juntos. Os efeitos resolvem por face, de um a seis, e depois por tipo: Canhão, Propulsor, Escudo e Coletor. Mesmo tipo na mesma face resolve simultaneamente. Vence a arena quem chega ao centro ou fica como último sobrevivente. Empates não dão ponto. Todos ganham três sucatas ao terminar; vence a partida quem alcançar cinco pontos.

Entre arenas, cartas custam três sucatas e vendas rendem uma. Módulos quatro, cinco e seis são construídos nessa ordem, pelo custo do número do módulo. Uma melhoria custa doze sucatas; três cartas comuns iguais também se combinam automaticamente em uma melhorada. Comprar já conclui a oportunidade atual.

**Histórico** explica a última rolagem e permite rever sua animação. Alterar a velocidade ou rever o resultado não altera a partida. As diferenças do modo experimental estão em [Laboratório](LABORATORIO.md).

## Limites atuais

- Não há entrada no meio de uma partida, espectadores ou substituição automática por bots.
- Uma desconexão mantém a vaga. Os demais podem preparar seus robôs, mas decisões que dependem daquele jogador aguardam sua volta.
- Salas expiram após sete dias sem ações; perfis e resultados concluídos permanecem.
- O navegador guarda a credencial do robô. Apagar seus dados pode impedir a retomada daquela sala.
- A prioridade atual de desenvolvimento e validação é desktop. O suporte móvel existente não equivale a testes completos em todos os aparelhos.
