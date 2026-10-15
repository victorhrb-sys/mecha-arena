# Sobre este repositório

Cópia pública do código ativo do Mecha Arena preparada em 15/10/2026, a partir da revisão `c22d7ef17d389207f2152d5a1b57f39a6db77ed7`.

- `dist/` contém o código da interface e do motor mantido diretamente neste projeto, apesar do nome da pasta.
- `multiplayer/` contém as regras de salas, a persistência e a API. `server.mjs` executa o jogo localmente com SQLite; não requer instalação de dependências externas.
- `tests/` contém os testes automatizados. `node scripts/check.mjs` verifica a sintaxe.
- `simulations/` contém os experimentos e o gerador de relatórios. Consulte [o método](SIMULACOES.md).
- `reports/balance-v01f/` preserva os resultados históricos e os hashes registrados daquela rodada. Novas simulações devem usar `--out` com outra pasta, para não sobrescrever a referência. Os resultados antigos não devem ser atribuídos automaticamente às regras atuais.
- `db/`, `drizzle/` e `multiplayer/worker.mjs` preservam a implementação para Cloudflare D1. A configuração da hospedagem pessoal e os scripts específicos de publicação não fazem parte desta cópia; não são necessários para jogar localmente.

Os documentos de regras descrevem etapas do desenvolvimento e podem conservar decisões antigas. Para os modos atuais, consulte o jogo e os testes. O painel histórico `dist/balance.html` não é servido pelo servidor multiplayer; o relatório em Markdown está disponível neste repositório.

As licenças dos recursos de terceiros estão preservadas em `dist/assets/`.
