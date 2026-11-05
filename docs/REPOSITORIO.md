# Sobre este repositório

Este é o repositório público do código ativo do Mecha Arena. A cópia inicial foi preparada em 15/10/2026 a partir da revisão local `c22d7ef17d389207f2152d5a1b57f39a6db77ed7`. A revisão de legibilidade acrescenta comentários e documentação ao mesmo código, sem alterar suas regras ou comportamento.

## O que faz parte dele

- Fontes da interface e do motor em `dist/`, apesar do nome histórico da pasta.
- Servidor, API, adaptador de hospedagem, esquema e migrações do banco.
- Testes automatizados, scripts de experimentos e dependências de desenvolvimento fixadas no lockfile.
- Imagens usadas pelo jogo e os avisos de licença dos recursos de terceiros.
- Documentação da arquitetura, instruções para desenvolvimento e relatório histórico de balanceamento.

Configuração da hospedagem pessoal, sessões, bancos, caches, instalações de dependências, instruções privadas de trabalho e arquivos temporários ficam fora da cópia pública. O checkout de desenvolvimento mantém sua configuração de publicação; o GitHub não é uma segunda versão do jogo.

## Relatórios e tamanho

O relatório de balanceamento continua em `reports/balance-v01f/RELATORIO.md`, junto dos achados e dos metadados da rodada. Os quatro arquivos volumosos de resultados gerados deixaram de fazer parte da árvore atual. Os originais locais foram preservados, e sua versão já publicada permanece no [histórico público anterior](https://github.com/victorhrb-sys/mecha-arena/tree/80ec88fb5feb1416dc62aa8ea9006670394fdfe1/reports/balance-v01f).

Essa limpeza reduz os arquivos de um checkout novo, mas não remove objetos do histórico Git. `git clone --depth 1` evita baixar esse histórico quando o objetivo é apenas experimentar o código. Não houve reescrita ou exclusão de commits anteriores.

Novas simulações devem usar `--out` com outra pasta. O relatório antigo descreve uma rodada com três sucatas iniciais; o jogo atual começa com zero. [Desenvolvimento](DESENVOLVIMENTO.md) mostra como gerar uma rodada pequena sem sobrescrever essa referência.

## Como ler os documentos

[ARQUITETURA.md](ARQUITETURA.md), [DESENVOLVIMENTO.md](DESENVOLVIMENTO.md) e [JOGAR.md](JOGAR.md) descrevem a implementação atual. Os documentos de especificação, multiplayer e hierarquia visual também conservam decisões de etapas anteriores; suas datas fazem parte do contexto. Uma intenção registrada ali não significa que esteja implementada.

O painel `dist/balance.html` é gerado pelo script de relatórios e não é servido pelo servidor multiplayer. A configuração e o empacotamento da hospedagem pessoal não são necessários para jogar localmente. Consulte os [créditos e limites de licença](CREDITOS.md) antes de reutilizar recursos.
