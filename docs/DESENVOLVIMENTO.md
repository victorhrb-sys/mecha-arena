# Executar, testar e explorar

## Começar

Use **Node.js 24 ou posterior**, que inclui o SQLite usado pelo servidor. Jogar, executar testes e rodar simulações não exige instalar pacotes: o código usa módulos nativos do navegador e do Node.

```sh
git clone --depth 1 https://github.com/victorhrb-sys/mecha-arena.git
cd mecha-arena
node server.mjs
```

Abra `http://127.0.0.1:43818`. No Windows, `JOGAR.cmd` inicia o servidor e abre o navegador. O servidor guarda salas e perfis em `.runtime/multiplayer.sqlite`; os saves do single player ficam no navegador. Não publique essa pasta de dados.

Por padrão, o servidor escuta em `0.0.0.0`, permitindo partidas na rede local. Outros dispositivos usam o endereço **Mesma rede** mostrado no terminal. Para desenvolvimento restrito ao próprio computador, use `HOST=127.0.0.1`. `PORT` altera a porta. Em PowerShell:

```powershell
$env:HOST = '127.0.0.1'
$env:PORT = '43818'
node server.mjs
```

## Validar uma alteração

```sh
node --test tests/*.test.mjs
node scripts/check.mjs
```

Os testes usam estados próprios, bancos em memória ou diretórios temporários. Os testes HTTP precisam poder conectar a `127.0.0.1` em portas disponíveis. Um erro `EACCES` nessa conexão pode ser uma restrição do ambiente de execução.

| Área | Testes de entrada |
| --- | --- |
| Ordem de resolução, cartas, custos e conservação | `engine.test.mjs` |
| Carga, críticos, migração e regras experimentais | `laboratory.test.mjs` |
| Decisões e partidas completas dos bots | `bots.test.mjs`, `simulation.test.mjs`, `room-bots.test.mjs` |
| Saves e separação dos modos locais | `solo.test.mjs` |
| HTTP, sessões, concorrência e recuperação | `multiplayer.test.mjs`, `parallel-preparation.test.mjs`, `profiles.test.mjs` |
| Visão privada e ações vindas da interface | `ui-port-network.test.mjs`, `multiplayer-client.test.mjs` |
| Renderização, interação e apresentação | `multiplayer-ui.test.mjs`, testes de arena, dados e mercado |

Os testes de UI usam um ambiente simulado. Eles não substituem uma inspeção visual em navegador real. Para mudanças de interface, percorra as três entradas, montagem, loja, arena e resultado em desktop; confira teclado, arraste, replay, velocidade e movimento reduzido. Mudanças em salas também pedem duas sessões de navegador, incluindo desconexão e retomada.

## Rodar um experimento pequeno

Escolha uma pasta nova para cada rodada. O padrão antigo de `run.mjs` aponta para o relatório histórico e pode sobrescrevê-lo.

```sh
node simulations/run.mjs --samples 12 --matches 12 --seed 20260911 --out reports/local-smoke
node simulations/report.mjs reports/local-smoke
```

Essa amostra serve para conferir o fluxo, não para concluir sobre balanceamento. O primeiro comando gera `summary.json`, `matches.jsonl`, `opening-choices.jsonl` e `matches.csv`. O segundo lê a rodada, escreve `RELATORIO.md` na mesma pasta e gera `dist/balance.html`.

Abra o HTML gerado diretamente no navegador; o servidor do jogo bloqueia `/balance.html` intencionalmente. O gerador sempre atualiza esse HTML, mesmo quando o relatório usa outra pasta. Dados brutos e o painel gerado estão no `.gitignore`; revise qualquer relatório novo antes de adicioná-lo ao Git.

A rodada histórica usou regras anteriores, inclusive três sucatas iniciais. A regra atual começa com zero. Repetir parâmetros no motor atual produz uma nova medição, não uma reprodução exata do resultado antigo. [Método e limites](SIMULACOES.md) explicam sementes, comparação pareada e censura.

## Banco e hospedagem

As migrações SQL de `drizzle/` são executadas automaticamente pelo adaptador SQLite local. O esquema TypeScript em `db/schema.ts` serve para gerar migrações; ele não é compilado para iniciar o jogo. Só para trabalhar no esquema, instale as dependências de desenvolvimento fixadas no lockfile:

```sh
pnpm install --ignore-scripts
pnpm db:generate
```

Revise a migração gerada antes de usá-la com dados existentes. O número em `PRAGMA user_version` indica o progresso das migrações, não a versão do jogo.

O código também inclui um adaptador de Cloudflare Workers/D1 em `multiplayer/worker.mjs`. Seu `assets.mjs` é gerado pelo empacotamento da hospedagem. Esse worker não é a entrada para execução direta em Node. A cópia pública conserva o adaptador e as migrações; configurações da publicação pessoal permanecem no checkout de desenvolvimento. O fluxo público documentado e testado é `node server.mjs`.

## Fazer mudanças pequenas

Comece pelo arquivo que possui a responsabilidade descrita na [arquitetura](ARQUITETURA.md). Preserve IDs de cartas, chaves de salvamento e ordem do RNG ao alterar código compatível com saves. Comportamento de combate deve ser verificado com estados e dados controlados; comportamento de sala precisa passar pela autorização e pela persistência.

Mantenha `simulations/legacy-bots.mjs` como controle histórico. Não consolide a cascata CSS ou divida `app.js` numa revisão de documentação: essas mudanças precisam de validação própria. Commits de legibilidade devem explicar o motivo da decisão e ser fáceis de distinguir de uma mudança de regra.
